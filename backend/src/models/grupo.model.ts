import { query } from '../db/index.js';

export interface Grupo {
  id: number;
  nombre: string;
}

export class GrupoModel {
  static async getAll(): Promise<Grupo[]> {
    const res = await query<Grupo>('SELECT * FROM Grupo ORDER BY nombre ASC');
    return res.rows;
  }

  static async getById(id: number): Promise<Grupo | null> {
    const res = await query<Grupo>('SELECT * FROM Grupo WHERE id = $1', [id]);
    return res.rows[0] || null;
  }
}
