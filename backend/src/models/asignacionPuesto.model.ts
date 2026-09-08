import { getPool, query } from '../db/index.js';

export interface AsignacionPuesto {
  id: number;
  participante_id: number;
  servicio_id: number;
  puesto_id: number;
}

export class AsignacionPuestoModel {
  static async getPorServicio(servicioId: number): Promise<AsignacionPuesto[]> {
    const res = await query<AsignacionPuesto>(
      'SELECT * FROM Asignacion_Puesto WHERE servicio_id = $1',
      [servicioId]
    );
    return res.rows;
  }

  /**
   * RF-7.6: sustituye por completo el conjunto de puestos de un participante para un servicio
   * (borra e inserta dentro de una transacción), en vez de agregar/quitar de a uno. Así el
   * llamador solo necesita mandar la lista final deseada y RN-16 (a lo sumo un Principal) se
   * valida sobre ese conjunto completo antes de escribir, sin dejar estados intermedios
   * inválidos si la escritura fallara a la mitad.
   */
  static async reemplazarParaParticipante(
    participanteId: number,
    servicioId: number,
    puestoIds: number[]
  ): Promise<void> {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'DELETE FROM Asignacion_Puesto WHERE participante_id = $1 AND servicio_id = $2',
        [participanteId, servicioId]
      );
      for (const puestoId of puestoIds) {
        await client.query(
          'INSERT INTO Asignacion_Puesto (participante_id, servicio_id, puesto_id) VALUES ($1, $2, $3)',
          [participanteId, servicioId, puestoId]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
