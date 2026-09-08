import pg from 'pg';
import { config, BUSINESS_CONSTANTS } from '../config/env.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString =
      process.env.NODE_ENV === 'test' && config.testDatabaseUrl
        ? config.testDatabaseUrl
        : config.databaseUrl;

    if (!connectionString) {
      console.warn(
        '[DB Warning] No DATABASE_URL or TEST_DATABASE_URL defined. Running in mock or standalone mode.'
      );
    }

    pool = new Pool({
      connectionString: connectionString || undefined,
      ssl: connectionString && connectionString.includes('sslmode=require')
        ? { rejectUnauthorized: false }
        : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
}

export function setPool(customPool: pg.Pool | null) {
  pool = customPool;
}

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  const currentPool = getPool();
  return currentPool.query<T>(text, params);
}

export async function initDb(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS Grupo (
        id SERIAL PRIMARY KEY,
        nombre TEXT UNIQUE NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS Participante (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        primer_apellido TEXT NOT NULL,
        segundo_apellido TEXT,
        correo TEXT UNIQUE NOT NULL,
        grupo_id INTEGER NOT NULL REFERENCES Grupo(id),
        activo BOOLEAN NOT NULL DEFAULT true
      );
    `);

    // Idempotente: agrega la columna si la tabla ya existía de una versión anterior.
    await client.query(`
      ALTER TABLE Participante ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS Servicio (
        id SERIAL PRIMARY KEY,
        fecha_servicio DATE NOT NULL,
        hora_servicio TIME NOT NULL DEFAULT '00:00:00',
        fecha_cierre_confirmacion DATE NOT NULL,
        tipo TEXT NOT NULL DEFAULT 'Regular' CHECK (tipo IN ('Regular', 'Extraordinario')),
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Idempotente: congela, la primera vez que se detecta un servicio ya cerrado, cuántos
    // participantes estaban convocados/confirmados en ese momento (RN: una desactivación
    // posterior ya no debe mover los números de un servicio que dejó de aceptar respuestas).
    await client.query(`
      ALTER TABLE Servicio ADD COLUMN IF NOT EXISTS convocados_congelados INTEGER;
    `);
    await client.query(`
      ALTER TABLE Servicio ADD COLUMN IF NOT EXISTS confirmados_congelados INTEGER;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS Respuesta (
        id SERIAL PRIMARY KEY,
        participante_id INTEGER NOT NULL REFERENCES Participante(id),
        servicio_id INTEGER NOT NULL REFERENCES Servicio(id),
        respuesta TEXT NOT NULL CHECK (respuesta IN ('Sí', 'No')),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notificaciones_enviadas INTEGER NOT NULL DEFAULT 0,
        UNIQUE (participante_id, servicio_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS Intento_Envio (
        id SERIAL PRIMARY KEY,
        participante_id INTEGER NOT NULL REFERENCES Participante(id),
        servicio_id INTEGER NOT NULL REFERENCES Servicio(id),
        numero_recordatorio INTEGER NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resultado TEXT NOT NULL CHECK (resultado IN ('exitoso', 'fallido'))
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS Historial_Participante (
        id SERIAL PRIMARY KEY,
        participante_id INTEGER NOT NULL REFERENCES Participante(id),
        accion TEXT NOT NULL CHECK (accion IN ('Desactivado', 'Reactivado')),
        comentario TEXT,
        actor TEXT NOT NULL DEFAULT 'Coordinador',
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Lock de una sola fila para serializar el ciclo de recordatorios (evita envíos duplicados
    // si dos invocaciones se solapan). Se implementa como fila de tabla, no como advisory lock
    // de Postgres, porque el endpoint pooled de Neon (PgBouncer en modo transacción) no
    // garantiza que un advisory lock de sesión persista entre sentencias del mismo cliente.
    await client.query(`
      CREATE TABLE IF NOT EXISTS Recordatorios_Lock (
        id INTEGER PRIMARY KEY,
        bloqueado_desde TIMESTAMP
      );
    `);
    await client.query(`
      INSERT INTO Recordatorios_Lock (id, bloqueado_desde) VALUES (1, NULL)
      ON CONFLICT (id) DO NOTHING;
    `);

    // Ajuste del coordinador (pantalla de Ajustes): hora del día, en UTC-6, en la que debe
    // correr el ciclo de recordatorios. Vive en la misma fila singleton que el lock porque es
    // el mismo concepto de "estado del ciclo de recordatorios", no una tabla de configuración
    // aparte para un solo valor.
    await client.query(`
      ALTER TABLE Recordatorios_Lock ADD COLUMN IF NOT EXISTS hora_envio_utc6 INTEGER NOT NULL DEFAULT 7;
    `);

    // Sesión del coordinador (DM-7): esquema oficial de connect-pg-simple. Se crea acá, con el
    // mismo patrón idempotente que el resto de las tablas, en vez de dejar que la librería la
    // cree por su cuenta (createTableIfMissing), para mantener el esquema en un solo lugar.
    await client.query(`
      CREATE TABLE IF NOT EXISTS session (
        sid VARCHAR NOT NULL COLLATE "default",
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL,
        CONSTRAINT session_pkey PRIMARY KEY (sid)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON session(expire);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_respuesta_participante_servicio ON Respuesta(participante_id, servicio_id);
      CREATE INDEX IF NOT EXISTS idx_intentos_servicio ON Intento_Envio(servicio_id);
      CREATE INDEX IF NOT EXISTS idx_intentos_participante_servicio ON Intento_Envio(participante_id, servicio_id, resultado);
      CREATE INDEX IF NOT EXISTS idx_historial_participante ON Historial_Participante(participante_id);
    `);

    // Defensa adicional (junto al lock de Recordatorios_Lock del ciclo de recordatorios)
    // contra una ejecución concurrente que intente registrar el mismo intento dos veces.
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_intento_envio_unico
        ON Intento_Envio(participante_id, servicio_id, numero_recordatorio);
    `);

    for (const grupo of BUSINESS_CONSTANTS.GRUPOS_BASE) {
      await client.query(
        'INSERT INTO Grupo (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING',
        [grupo]
      );
    }

    // RN-19: catálogo de puestos (Etapa 10). Área es fija y sembrada una sola vez (mismo patrón
    // que Grupo); Puesto no tiene una restricción UNIQUE sobre nombre en el esquema (RF-7 permite
    // editar nombres libremente desde el CRUD), así que la siembra idempotente se hace revisando
    // qué nombres ya existen en vez de depender de ON CONFLICT.
    await client.query(`
      CREATE TABLE IF NOT EXISTS Area (
        id SERIAL PRIMARY KEY,
        nombre TEXT UNIQUE NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS Puesto (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        tipo TEXT NOT NULL CHECK (tipo IN ('Principal', 'Secundario')),
        area_id INTEGER REFERENCES Area(id),
        activo BOOLEAN NOT NULL DEFAULT true,
        CHECK ((tipo = 'Principal' AND area_id IS NOT NULL) OR (tipo = 'Secundario' AND area_id IS NULL))
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_puesto_area ON Puesto(area_id);
    `);

    const areaIdPorNombre = new Map<string, number>(
      (await client.query<{ id: number; nombre: string }>('SELECT id, nombre FROM Area')).rows.map(
        (a) => [a.nombre, a.id]
      )
    );
    for (const { area } of BUSINESS_CONSTANTS.AREAS_Y_PUESTOS_BASE) {
      if (!areaIdPorNombre.has(area)) {
        const res = await client.query<{ id: number }>(
          'INSERT INTO Area (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING RETURNING id',
          [area]
        );
        if (res.rows[0]) {
          areaIdPorNombre.set(area, res.rows[0].id);
        } else {
          // El INSERT chocó con una fila que no estaba en la lectura inicial (p. ej. dos
          // initDb() corriendo a la vez). Sin este fallback, esta Área quedaría fuera del mapa
          // y sus Puestos se saltarían en silencio más abajo.
          const existente = await client.query<{ id: number }>('SELECT id FROM Area WHERE nombre = $1', [area]);
          if (existente.rows[0]) areaIdPorNombre.set(area, existente.rows[0].id);
        }
      }
    }

    const nombresDePuestoExistentes = new Set(
      (await client.query<{ nombre: string }>('SELECT nombre FROM Puesto')).rows.map((p) => p.nombre)
    );
    for (const { area, puestos } of BUSINESS_CONSTANTS.AREAS_Y_PUESTOS_BASE) {
      const areaId = areaIdPorNombre.get(area);
      for (const nombre of puestos) {
        if (areaId && !nombresDePuestoExistentes.has(nombre)) {
          await client.query(
            "INSERT INTO Puesto (nombre, tipo, area_id) VALUES ($1, 'Principal', $2)",
            [nombre, areaId]
          );
        }
      }
    }
    for (const nombre of BUSINESS_CONSTANTS.PUESTOS_SECUNDARIOS_BASE) {
      if (!nombresDePuestoExistentes.has(nombre)) {
        await client.query(
          "INSERT INTO Puesto (nombre, tipo, area_id) VALUES ($1, 'Secundario', NULL)",
          [nombre]
        );
      }
    }

    // RN-15/RN-16: asignación de un puesto a un participante para un servicio puntual (Etapa 11).
    await client.query(`
      CREATE TABLE IF NOT EXISTS Asignacion_Puesto (
        id SERIAL PRIMARY KEY,
        participante_id INTEGER NOT NULL REFERENCES Participante(id),
        servicio_id INTEGER NOT NULL REFERENCES Servicio(id),
        puesto_id INTEGER NOT NULL REFERENCES Puesto(id),
        UNIQUE (participante_id, servicio_id, puesto_id)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_asignacion_servicio ON Asignacion_Puesto(servicio_id);
    `);

    await client.query('COMMIT');
    console.log('[DB] Base de datos PostgreSQL inicializada exitosamente.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[DB Error] Fallo al inicializar la base de datos:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function resetDb(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query(`
      DROP TABLE IF EXISTS session CASCADE;
      DROP TABLE IF EXISTS Recordatorios_Lock CASCADE;
      DROP TABLE IF EXISTS Historial_Participante CASCADE;
      DROP TABLE IF EXISTS Intento_Envio CASCADE;
      DROP TABLE IF EXISTS Respuesta CASCADE;
      DROP TABLE IF EXISTS Servicio CASCADE;
      DROP TABLE IF EXISTS Participante CASCADE;
      DROP TABLE IF EXISTS Grupo CASCADE;
    `);
  } finally {
    client.release();
  }
}
