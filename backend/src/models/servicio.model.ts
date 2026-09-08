import { query } from '../db/index.js';

export interface Servicio {
  id: number;
  fecha_servicio: string | Date;
  hora_servicio: string;
  fecha_cierre_confirmacion: string | Date;
  tipo: 'Regular' | 'Extraordinario';
  fecha_creacion?: Date;
  convocados_congelados: number | null;
  confirmados_congelados: number | null;
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

  /** Congela, para un servicio que ya cerró, cuántos participantes estaban convocados/confirmados
   * en ese momento. A partir de ahí, desactivar o reactivar servidores ya no debe mover estos
   * números (solo aplican a servicios cuya ventana de confirmación todavía está abierta). */
  static async congelarConteo(
    id: number,
    convocados: number,
    confirmados: number
  ): Promise<void> {
    await query(
      'UPDATE Servicio SET convocados_congelados = $1, confirmados_congelados = $2 WHERE id = $3',
      [convocados, confirmados, id]
    );
  }
}
