import { query } from '../db/index.js';

export interface HistorialParticipante {
  id: number;
  participante_id: number;
  accion: 'Desactivado' | 'Reactivado';
  comentario: string | null;
  actor: string;
  timestamp: Date;
}

export class HistorialParticipanteModel {
  static async registrar(
    participanteId: number,
    accion: 'Desactivado' | 'Reactivado',
    comentario: string | null
  ): Promise<void> {
    await query(
      `
      INSERT INTO Historial_Participante (participante_id, accion, comentario)
      VALUES ($1, $2, $3)
    `,
      [participanteId, accion, comentario]
    );
  }

  static async getUltimoPorParticipante(participanteId: number): Promise<HistorialParticipante | null> {
    const res = await query<HistorialParticipante>(
      `
      SELECT * FROM Historial_Participante
      WHERE participante_id = $1
      ORDER BY timestamp DESC
      LIMIT 1
    `,
      [participanteId]
    );
    return res.rows[0] || null;
  }
}
