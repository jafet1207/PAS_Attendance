import { query } from '../db/index.js';

export interface Participante {
  id: number;
  nombre: string;
  primer_apellido: string;
  segundo_apellido: string | null;
  correo: string;
  grupo_id: number;
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
}
