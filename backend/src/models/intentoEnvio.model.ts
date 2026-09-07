import { query } from '../db/index.js';

export interface IntentoEnvio {
  id: number;
  participante_id: number;
  servicio_id: number;
  numero_recordatorio: number;
  timestamp: Date;
  resultado: 'exitoso' | 'fallido';
}

export class IntentoEnvioModel {
  /**
   * Registra en una sola sentencia todos los intentos de un servicio (uno por participante),
   * en vez de un INSERT por participante: evita un round-trip de red por participante contra
   * la base en la nube al ejecutar el barrido completo de recordatorios. `ON CONFLICT DO
   * NOTHING` es una defensa adicional al lock de `ejecutarCicloDeRecordatorios`: si
   * dos ejecuciones lograran solaparse, la segunda no duplica la fila de auditoría.
   */
  static async registrarLote(
    servicioId: number,
    intentos: { participanteId: number; numeroRecordatorio: number; resultado: 'exitoso' | 'fallido' }[]
  ): Promise<void> {
    if (intentos.length === 0) return;

    const valores: string[] = [];
    const params: (number | string)[] = [];
    intentos.forEach((intento, i) => {
      const base = i * 4;
      valores.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
      params.push(intento.participanteId, servicioId, intento.numeroRecordatorio, intento.resultado);
    });

    await query(
      `
      INSERT INTO Intento_Envio (participante_id, servicio_id, numero_recordatorio, resultado)
      VALUES ${valores.join(', ')}
      ON CONFLICT (participante_id, servicio_id, numero_recordatorio) DO NOTHING
    `,
      params
    );
  }
}
