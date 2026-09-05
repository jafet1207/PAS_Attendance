import { createApp } from './app.js';
import { config } from './config/env.js';
import { initDb } from './db/index.js';

async function startServer() {
  const app = createApp();

  if (config.databaseUrl) {
    try {
      await initDb();
    } catch (err) {
      console.warn('[Server Warning] No se pudo inicializar la base de datos automáticamente al arrancar:', err);
    }
  } else {
    console.log('[Server] DATABASE_URL no configurada; iniciando servidor en modo local sin BD conectada.');
  }

  app.listen(config.port, () => {
    console.log(`[PAS Attendance Backend] Servidor corriendo en http://localhost:${config.port}`);
  });
}

startServer().catch((error) => {
  console.error('[Server Fatal Error]', error);
  process.exit(1);
});
