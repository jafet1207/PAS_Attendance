import { createApp } from './app.js';
import { config } from './config/env.js';
import { initDb } from './db/index.js';
import { ejecutarCicloDeRecordatorios } from './services/recordatoriosService.js';

// Solo tiene sentido acá (proceso persistente de `node`/`tsx`), no en `api/index.ts`: una
// función serverless de Vercel no vive entre invocaciones, así que un setInterval ahí no
// llegaría a disparar nunca. En este proceso sí puede revisar cada minuto si ya es la hora de
// envío configurada (pantalla de Ajustes) y correr el ciclo, dando la experiencia de "ver el
// envío en vivo" al cambiar la hora, sin depender del cron de Vercel ni de un redeploy.
const INTERVALO_PLANIFICADOR_MS = 60_000;

function iniciarPlanificadorLocalDeRecordatorios() {
  setInterval(() => {
    ejecutarCicloDeRecordatorios({ respetarHorarioConfigurado: true }).catch((error) => {
      console.error('[Planificador de recordatorios] Error al ejecutar el ciclo', error);
    });
  }, INTERVALO_PLANIFICADOR_MS);
}

async function startServer() {
  const app = createApp();

  if (config.databaseUrl) {
    try {
      await initDb();
      iniciarPlanificadorLocalDeRecordatorios();
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
