import { Request, Response } from 'express';
import { RecordatoriosConfigModel } from '../models/recordatoriosConfig.model.js';

export class SettingsController {
  static async getReminderSettings(req: Request, res: Response): Promise<void> {
    try {
      const horaEnvioUtc6 = await RecordatoriosConfigModel.obtenerHoraEnvioUtc6();
      res.json({ data: { horaEnvioUtc6 } });
    } catch (error) {
      console.error('[SettingsController.getReminderSettings Error]', error);
      res.status(500).json({ error: 'Error al obtener la configuración de recordatorios.' });
    }
  }

  static async updateReminderSettings(req: Request, res: Response): Promise<void> {
    const horaEnvioUtc6 = Number(req.body?.horaEnvioUtc6);
    if (!Number.isInteger(horaEnvioUtc6) || horaEnvioUtc6 < 0 || horaEnvioUtc6 > 23) {
      res.status(400).json({ error: 'La hora debe ser un número entero entre 0 y 23.' });
      return;
    }

    try {
      await RecordatoriosConfigModel.actualizarHoraEnvioUtc6(horaEnvioUtc6);
      res.json({ data: { horaEnvioUtc6 } });
    } catch (error) {
      console.error('[SettingsController.updateReminderSettings Error]', error);
      res.status(500).json({ error: 'Error al actualizar la configuración de recordatorios.' });
    }
  }
}
