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
