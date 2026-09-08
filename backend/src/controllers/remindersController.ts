import { Request, Response } from 'express';
import { ejecutarCicloDeRecordatorios, OpcionesCicloRecordatorios } from '../services/recordatoriosService.js';

function esSesionDeCoordinador(req: Request): boolean {
  return !!(req.session && req.session.coordinador_autenticado);
}

/** Cuerpo de la petición con un arreglo de IDs no numérico (p. ej. `["abc"]`): se responde 400
 * en vez de dejar que `Number(...)` produzca `NaN` y el ciclo simplemente no procese nada. */
export class SolicitudInvalidaError extends Error {}

function idsNumericos(valor: unknown, campo: string): number[] {
  const ids = (valor as unknown[]).map(Number);
  if (ids.some((id) => !Number.isFinite(id))) {
    throw new SolicitudInvalidaError(`${campo} debe ser un arreglo de números.`);
  }
  return ids;
}

/**
 * `participanteIds` solo se honra cuando `NODE_ENV === 'test'` (mismo patrón que `db/index.ts`
 * para elegir `TEST_DATABASE_URL`): permite que las pruebas de integración acoten el barrido a
 * las filas que ellas mismas crearon, sin exponer ese acotamiento fuera de pruebas.
 *
 * `servicioIds` además se honra con una sesión de coordinador activa (RN-13): es lo que usa el
 * botón de envío manual de la pantalla de Registro de envíos para acotar el ciclo a un único
 * servicio, sin depender de `NODE_ENV`. No se expone para un disparo autenticado solo con Bearer
 * `CRON_SECRET` (el cron automático siempre corre sin acotar).
 */
export function opcionesDesdeCuerpo(req: Request): OpcionesCicloRecordatorios {
  const esPrueba = process.env.NODE_ENV === 'test';
  const body = req.body || {};
  const opciones: OpcionesCicloRecordatorios = {};

  if ((esPrueba || esSesionDeCoordinador(req)) && Array.isArray(body.servicioIds)) {
    // Normalizado a number: los IDs de servicio se comparan por igualdad estricta contra
    // `Servicio.id` (number) en recordatoriosService.ts, y el body es JSON externo al cliente
    // (p. ej. `useParams()` en React entrega el ID como string).
    opciones.servicioIds = idsNumericos(body.servicioIds, 'servicioIds');
  }
  if (esPrueba && Array.isArray(body.participanteIds)) {
    opciones.participanteIds = idsNumericos(body.participanteIds, 'participanteIds');
  }
  return opciones;
}

/**
 * Solo el disparo automático (Vercel Cron, autenticado con CRON_SECRET) respeta la hora de
 * envío configurada por el coordinador: un disparo manual del coordinador desde su propia
 * sesión corre de inmediato, sin esperar a que el reloj llegue a esa hora. En pruebas nunca se
 * respeta (mismo criterio que `opcionesDesdeCuerpo`), para no depender de a qué hora real
 * corra la suite.
 */
function debeRespetarHorarioConfigurado(req: Request): boolean {
  if (process.env.NODE_ENV === 'test') return false;
  return !esSesionDeCoordinador(req);
}

export class RemindersController {
  static async triggerReminders(req: Request, res: Response): Promise<void> {
    try {
      const resumen = await ejecutarCicloDeRecordatorios({
        ...opcionesDesdeCuerpo(req),
        respetarHorarioConfigurado: debeRespetarHorarioConfigurado(req),
      });
      res.json(resumen);
    } catch (error) {
      if (error instanceof SolicitudInvalidaError) {
        res.status(400).json({ error: error.message });
        return;
      }
      console.error('[RemindersController.triggerReminders Error]', error);
      res.status(500).json({ error: 'Error al ejecutar el ciclo de recordatorios.' });
    }
  }
}
