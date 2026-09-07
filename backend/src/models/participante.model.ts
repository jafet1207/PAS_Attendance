import { query } from '../db/index.js';

export interface Participante {
  id: number;
  nombre: string;
  primer_apellido: string;
  segundo_apellido: string | null;
  correo: string;
  grupo_id: number;
  activo: boolean;
}

export class ParticipanteModel {
  static async getAll(): Promise<Participante[]> {
    const res = await query<Participante>(
      'SELECT * FROM Participante ORDER BY nombre ASC, primer_apellido ASC'
    );
    return res.rows;
  }

  static async getById(id: number): Promise<Participante | null> {
    const res = await query<Participante>('SELECT * FROM Participante WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  static async create(
    nombre: string,
    primerApellido: string,
    segundoApellido: string | null,
    correo: string,
    grupoId: number
  ): Promise<number> {
    const res = await query<{ id: number }>(
      `
      INSERT INTO Participante (nombre, primer_apellido, segundo_apellido, correo, grupo_id)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `,
      [nombre, primerApellido, segundoApellido, correo, grupoId]
    );
    return res.rows[0].id;
  }

  static async updateGrupo(id: number, grupoId: number): Promise<boolean> {
    const res = await query('UPDATE Participante SET grupo_id = $1 WHERE id = $2', [
      grupoId,
      id,
    ]);
    return (res.rowCount ?? 0) > 0;
  }

  static async updateCorreo(id: number, correo: string): Promise<boolean> {
    const res = await query('UPDATE Participante SET correo = $1 WHERE id = $2', [correo, id]);
    return (res.rowCount ?? 0) > 0;
  }

  static async updateActivo(id: number, activo: boolean): Promise<boolean> {
    const res = await query('UPDATE Participante SET activo = $1 WHERE id = $2', [activo, id]);
    return (res.rowCount ?? 0) > 0;
  }

  /** RN interna: ¿este participante confirmó "Sí" a algún servicio cuya fecha aún no pasa? */
  static async tieneConfirmacionProxima(id: number): Promise<boolean> {
    const res = await query<{ count: string }>(
      `
      SELECT COUNT(*) as count
      FROM Respuesta r
      JOIN Servicio s ON r.servicio_id = s.id
      WHERE r.participante_id = $1
        AND r.respuesta = 'Sí'
        AND s.fecha_servicio >= CURRENT_DATE
    `,
      [id]
    );
    return parseInt(res.rows[0]?.count || '0', 10) > 0;
  }
}
