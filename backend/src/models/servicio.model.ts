import { query } from '../db/index.js';

export interface Servicio {
  id: number;
  fecha_servicio: string | Date;
  hora_servicio: string;
  fecha_cierre_confirmacion: string | Date;
  tipo: 'Regular' | 'Extraordinario';
  fecha_creacion?: Date;
}

export class ServicioModel {
  static async getAll(): Promise<Servicio[]> {
    const res = await query<Servicio>(`
      SELECT * FROM Servicio
      ORDER BY fecha_servicio DESC
    `);
    return res.rows;
  }

  static async getById(id: number): Promise<Servicio | null> {
    const res = await query<Servicio>('SELECT * FROM Servicio WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  static async create(
    fechaServicio: string,
    horaServicio: string,
    fechaCierre: string,
    tipo: 'Regular' | 'Extraordinario' = 'Regular'
  ): Promise<number> {
    const res = await query<{ id: number }>(
      `
      INSERT INTO Servicio (fecha_servicio, hora_servicio, fecha_cierre_confirmacion, tipo)
      VALUES ($1, $2, $3, $4) RETURNING id
    `,
      [fechaServicio, horaServicio, fechaCierre, tipo]
    );
    return res.rows[0].id;
  }
}
