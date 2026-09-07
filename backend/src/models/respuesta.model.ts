import { query } from '../db/index.js';

export interface Respuesta {
  id: number;
  participante_id: number;
  servicio_id: number;
  respuesta: 'Sí' | 'No';
  timestamp: Date;
  notificaciones_enviadas: number;
}

export interface RegistroRespuestaResult {
  respuesta: 'Sí' | 'No';
  debeNotificar: boolean;
  esCambio: boolean;
}

export class RespuestaModel {
  static async getByParticipanteServicio(
    participanteId: number,
    servicioId: number
  ): Promise<Respuesta | null> {
    const res = await query<Respuesta>(
      `
      SELECT * FROM Respuesta
      WHERE participante_id = $1 AND servicio_id = $2
    `,
      [participanteId, servicioId]
    );
    return res.rows[0] || null;
  }

  /**
   * Registra la respuesta de un participante para un servicio. Si ya existía una respuesta
   * distinta, la actualiza y controla el tope de notificaciones (RN-10: máximo 2 correos de
   * confirmación por participante/servicio: 1 en el alta + 1 si cambia de respuesta).
   */
  static async registrar(
    participanteId: number,
    servicioId: number,
    respuesta: 'Sí' | 'No'
  ): Promise<RegistroRespuestaResult> {
    const res = await query<Respuesta>(
      `
      SELECT respuesta, notificaciones_enviadas FROM Respuesta
      WHERE participante_id = $1 AND servicio_id = $2
    `,
      [participanteId, servicioId]
    );

    const existente = res.rows[0];

    if (!existente) {
      await query(
        `
        INSERT INTO Respuesta (participante_id, servicio_id, respuesta, notificaciones_enviadas)
        VALUES ($1, $2, $3, 1)
      `,
        [participanteId, servicioId, respuesta]
      );
      return { respuesta, debeNotificar: true, esCambio: false };
    }

    if (respuesta === existente.respuesta) {
      return { respuesta, debeNotificar: false, esCambio: false };
    }

    const notificaciones = existente.notificaciones_enviadas || 0;
    const debeNotificar = notificaciones < 2;
    const nuevasNotificaciones = debeNotificar ? notificaciones + 1 : notificaciones;

    await query(
      `
      UPDATE Respuesta
      SET respuesta = $1, notificaciones_enviadas = $2
      WHERE participante_id = $3 AND servicio_id = $4
    `,
      [respuesta, nuevasNotificaciones, participanteId, servicioId]
    );

    return { respuesta, debeNotificar, esCambio: true };
  }
}
