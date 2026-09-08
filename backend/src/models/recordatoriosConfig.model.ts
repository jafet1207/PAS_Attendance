import { query } from '../db/index.js';

/** Configuración del ciclo de recordatorios, guardada en la fila singleton de Recordatorios_Lock. */
export class RecordatoriosConfigModel {
  static async obtenerHoraEnvioUtc6(): Promise<number> {
    const res = await query<{ hora_envio_utc6: number }>(
      'SELECT hora_envio_utc6 FROM Recordatorios_Lock WHERE id = 1'
    );
    return res.rows[0]?.hora_envio_utc6 ?? 7;
  }

  static async actualizarHoraEnvioUtc6(hora: number): Promise<void> {
    await query('UPDATE Recordatorios_Lock SET hora_envio_utc6 = $1 WHERE id = 1', [hora]);
  }
}
