import { Request, Response } from 'express';
import { ejecutarCicloDeRecordatorios, OpcionesCicloRecordatorios } from '../services/recordatoriosService.js';

/**
 * `servicioIds`/`participanteIds` solo se honran cuando `NODE_ENV === 'test'` (mismo patrón que
 * `db/index.ts` para elegir `TEST_DATABASE_URL`): permite que las pruebas de integración acoten
 * el barrido a las filas que ellas mismas crearon, en vez de reprocesar todos los servicios y
 * participantes reales de la base de datos en cada corrida de la suite. Fuera de pruebas, el
 * cuerpo de la petición se ignora por completo y el ciclo siempre corre sin acotar, igual que
 * antes de este cambio.
 */
function opcionesSoloParaPruebas(req: Request): OpcionesCicloRecordatorios {
  if (process.env.NODE_ENV !== 'test') return {};

  const body = req.body || {};
  const opciones: OpcionesCicloRecordatorios = {};
  if (Array.isArray(body.servicioIds)) opciones.servicioIds = body.servicioIds;
  if (Array.isArray(body.participanteIds)) opciones.participanteIds = body.participanteIds;
  return opciones;
}

export class RemindersController {
  static async triggerReminders(req: Request, res: Response): Promise<void> {
    try {
      const resumen = await ejecutarCicloDeRecordatorios(opcionesSoloParaPruebas(req));
      res.json(resumen);
    } catch (error) {
      console.error('[RemindersController.triggerReminders Error]', error);
      res.status(500).json({ error: 'Error al ejecutar el ciclo de recordatorios.' });
    }
  }
}
