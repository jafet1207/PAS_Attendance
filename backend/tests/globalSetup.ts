/**
 * Se ejecuta una sola vez antes de toda la suite (ver `globalSetup` en vitest.config.ts).
 * Necesario para integración continua: un runner nuevo arranca con una base de datos Postgres
 * efímera y vacía, y ningún archivo de prueba llama a `initDb()` por su cuenta — hasta ahora el
 * esquema existía porque alguien ya había arrancado el servidor de desarrollo antes de correr
 * las pruebas localmente. `initDb()` es idempotente (CREATE TABLE IF NOT EXISTS, etc.), así que
 * llamarla aquí no tiene efecto en un entorno donde el esquema ya existe.
 */
import { initDb } from '../src/db/index.js';

export default async function setup(): Promise<void> {
  await initDb();
}
