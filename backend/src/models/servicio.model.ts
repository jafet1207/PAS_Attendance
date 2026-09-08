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

  static async update(
    id: number,
    fechaServicio: string,
    horaServicio: string,
    fechaCierre: string,
    tipo: 'Regular' | 'Extraordinario'
  ): Promise<void> {
    await query(
      `
      UPDATE Servicio
      SET fecha_servicio = $1, hora_servicio = $2, fecha_cierre_confirmacion = $3, tipo = $4
      WHERE id = $5
    `,
      [fechaServicio, horaServicio, fechaCierre, tipo, id]
    );
  }

  /** Congela, para un servicio que ya cerró, cuántos participantes estaban convocados/confirmados
   * en ese momento. A partir de ahí, desactivar o reactivar servidores ya no debe mover estos
   * números (solo aplican a servicios cuya ventana de confirmación todavía está abierta).
   * `AND convocados_congelados IS NULL` hace el `UPDATE` seguro de repetir: quien la llama
   * (`obtenerServiciosEnriquecidos`) lo hace de forma perezosa desde un GET la primera vez que
   * ve un servicio recién cerrado, así que dos peticiones concurrentes podrían intentarlo a la
   * vez; con la guarda, la segunda no pisa nada (no-op) en vez de repetir la misma escritura. */
  static async congelarConteo(
    id: number,
    convocados: number,
    confirmados: number
  ): Promise<void> {
    await query(
      'UPDATE Servicio SET convocados_congelados = $1, confirmados_congelados = $2 WHERE id = $3 AND convocados_congelados IS NULL',
      [convocados, confirmados, id]
    );
  }
}
