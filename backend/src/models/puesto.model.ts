import { query } from '../db/index.js';

export interface Puesto {
  id: number;
  nombre: string;
  tipo: 'Principal' | 'Secundario';
  area_id: number | null;
  activo: boolean;
}

export class PuestoModel {
  /** Incluye inactivos: el historial de asignaciones pasadas debe poder mostrar el nombre
   * correcto de un puesto aunque ya se haya dado de baja (RN-17). */
  static async getAll(): Promise<Puesto[]> {
    const res = await query<Puesto>('SELECT * FROM Puesto ORDER BY area_id ASC NULLS LAST, id ASC');
    return res.rows;
  }

  static async getById(id: number): Promise<Puesto | null> {
    const res = await query<Puesto>('SELECT * FROM Puesto WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  static async create(
    nombre: string,
    tipo: 'Principal' | 'Secundario',
    areaId: number | null
  ): Promise<number> {
    const res = await query<{ id: number }>(
      'INSERT INTO Puesto (nombre, tipo, area_id) VALUES ($1, $2, $3) RETURNING id',
      [nombre, tipo, areaId]
    );
    return res.rows[0].id;
  }

  static async update(
    id: number,
    nombre: string,
    tipo: 'Principal' | 'Secundario',
    areaId: number | null
  ): Promise<boolean> {
    const res = await query(
      'UPDATE Puesto SET nombre = $1, tipo = $2, area_id = $3 WHERE id = $4',
      [nombre, tipo, areaId, id]
    );
    return (res.rowCount ?? 0) > 0;
  }

  static async setActivo(id: number, activo: boolean): Promise<boolean> {
    const res = await query('UPDATE Puesto SET activo = $1 WHERE id = $2', [activo, id]);
    return (res.rowCount ?? 0) > 0;
  }
}
