import { query } from '../db/index.js';

export interface Area {
  id: number;
  nombre: string;
}

export class AreaModel {
  static async getAll(): Promise<Area[]> {
    const res = await query<Area>('SELECT * FROM Area ORDER BY id ASC');
    return res.rows;
  }

  static async getById(id: number): Promise<Area | null> {
    const res = await query<Area>('SELECT * FROM Area WHERE id = $1', [id]);
    return res.rows[0] || null;
  }
}
