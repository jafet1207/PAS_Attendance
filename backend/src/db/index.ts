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
        correo TEXT UNIQUE NOT NULL,
        grupo_id INTEGER NOT NULL REFERENCES Grupo(id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS Servicio (
        id SERIAL PRIMARY KEY,
        fecha_servicio DATE NOT NULL,
        hora_servicio TIME NOT NULL DEFAULT '00:00:00',
        grupo_id INTEGER NOT NULL REFERENCES Grupo(id),
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
      CREATE INDEX IF NOT EXISTS idx_respuesta_participante_servicio ON Respuesta(participante_id, servicio_id);
      CREATE INDEX IF NOT EXISTS idx_intentos_servicio ON Intento_Envio(servicio_id);
      CREATE INDEX IF NOT EXISTS idx_intentos_participante_servicio ON Intento_Envio(participante_id, servicio_id, resultado);
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
