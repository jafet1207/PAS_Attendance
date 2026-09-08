import { Request, Response } from 'express';
import { ServicioModel } from '../models/servicio.model.js';
import { RespuestaModel } from '../models/respuesta.model.js';
import { IntentoEnvioModel } from '../models/intentoEnvio.model.js';
import { config } from '../config/env.js';
import {
  obtenerServiciosEnriquecidos,
  obtenerServicioEnriquecidoPorId,
  obtenerParticipantesConEstado,
  obtenerIntentosPorServicio,
  servicioAJson,
  parseDate,
} from '../services/serviciosService.js';

interface DatosServicioValidados {
  fechaServicio: string;
  horaServicio: string;
  fechaCierre: string;
  tipo: 'Regular' | 'Extraordinario';
}

/**
 * Reglas comunes a la creación y a la edición de un servicio (formato de hora, tipo válido,
 * cierre estrictamente anterior al servicio): las mismas para no duplicar la regla de negocio
 * en dos controladores.
 */
function validarDatosServicio(datos: Record<string, unknown>): {
  errores: string[];
  datos?: DatosServicioValidados;
} {
  const fechaServicio = (datos.fecha_servicio || '').toString().trim();
  const horaServicio = (datos.hora_servicio || '').toString().trim();
  const fechaCierre = (datos.fecha_cierre_confirmacion || '').toString().trim();
  const tipo = (datos.tipo || 'Regular').toString().trim();

  const errores: string[] = [];

  if (!fechaServicio || !horaServicio || !fechaCierre || !tipo) {
    errores.push('Todos los campos son requeridos.');
  }

  if (tipo !== 'Regular' && tipo !== 'Extraordinario') {
    errores.push('Tipo de servicio inválido.');
  }

  if (horaServicio && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(horaServicio)) {
    errores.push('Formato de hora inválido.');
  }

  if (fechaServicio && fechaCierre) {
    const dateServicio = parseDate(fechaServicio);
    const dateCierre = parseDate(fechaCierre);

    if (isNaN(dateServicio.getTime()) || isNaN(dateCierre.getTime())) {
      errores.push('Formato de fecha inválido.');
    } else if (dateCierre >= dateServicio) {
      errores.push(
        'La fecha de cierre de confirmación debe ser estrictamente anterior a la fecha del servicio.'
      );
    }
  }

  if (errores.length > 0) {
    return { errores };
  }

  return {
    errores: [],
    datos: {
      fechaServicio,
      horaServicio: horaServicio.length === 5 ? `${horaServicio}:00` : horaServicio,
      fechaCierre,
      tipo: tipo as 'Regular' | 'Extraordinario',
    },
  };
}

export class ServicesController {
  static getConfig(req: Request, res: Response): void {
    res.json({
      data: {
        diasCierreRegular: config.diasCierreRegular,
        diasCierreExtraordinario: config.diasCierreExtraordinario,
      },
    });
  }

  static async getServices(req: Request, res: Response): Promise<void> {
    try {
      const servicios = await obtenerServiciosEnriquecidos();
      res.json({
        data: servicios.map((s) => servicioAJson(s)),
      });
    } catch (error) {
      console.error('[ServicesController.getServices Error]', error);
      res.status(500).json({ error: 'Error al obtener la lista de servicios.' });
    }
  }

  static async createService(req: Request, res: Response): Promise<void> {
    const { errores, datos } = validarDatosServicio(req.body || {});
    if (errores.length > 0) {
      res.status(400).json({ errors: errores });
      return;
    }

    try {
      const servicioId = await ServicioModel.create(
        datos!.fechaServicio,
        datos!.horaServicio,
        datos!.fechaCierre,
        datos!.tipo
      );

      const servicioEnriquecido = await obtenerServicioEnriquecidoPorId(servicioId);
      if (!servicioEnriquecido) {
        res.status(500).json({ error: 'No se pudo recuperar el servicio recién creado.' });
        return;
      }

      res.status(201).json({
        data: servicioAJson(servicioEnriquecido),
      });
    } catch (error) {
      console.error('[ServicesController.createService Error]', error);
      res.status(500).json({ error: 'No fue posible guardar el servicio.' });
    }
  }

  /**
   * Solo se puede editar un servicio mientras no tenga actividad real registrada: ninguna
   * Respuesta (confirmación) ni ningún Intento_Envio (recordatorio ya despachado). Autoritativo
   * en el backend, no solo un adorno de la UI — un PATCH directo no debe poder saltarse la regla
   * aunque la pantalla la respete.
   */
  static async updateService(req: Request, res: Response): Promise<void> {
    const servicioId = parseInt(req.params.id, 10);
    if (isNaN(servicioId)) {
      res.status(400).json({ error: 'ID de servicio inválido.' });
      return;
    }

    const { errores, datos } = validarDatosServicio(req.body || {});
    if (errores.length > 0) {
      res.status(400).json({ errors: errores });
      return;
    }

    try {
      const servicio = await ServicioModel.getById(servicioId);
      if (!servicio) {
        res.status(404).json({ error: 'Servicio no encontrado.' });
        return;
      }

      const [tieneRespuestas, tieneEnvios] = await Promise.all([
        RespuestaModel.existsForServicio(servicioId),
        IntentoEnvioModel.existsForServicio(servicioId),
      ]);
      if (tieneRespuestas || tieneEnvios) {
        res.status(409).json({
          error: 'Este servicio ya tiene actividad registrada (confirmaciones o recordatorios enviados) y no se puede editar.',
        });
        return;
      }

      await ServicioModel.update(
        servicioId,
        datos!.fechaServicio,
        datos!.horaServicio,
        datos!.fechaCierre,
        datos!.tipo
      );

      const servicioEnriquecido = await obtenerServicioEnriquecidoPorId(servicioId);
      if (!servicioEnriquecido) {
        res.status(500).json({ error: 'No se pudo recuperar el servicio recién actualizado.' });
        return;
      }

      res.json({
        data: servicioAJson(servicioEnriquecido),
      });
    } catch (error) {
      console.error('[ServicesController.updateService Error]', error);
      res.status(500).json({ error: 'No fue posible actualizar el servicio.' });
    }
  }

  static async getServiceDetail(req: Request, res: Response): Promise<void> {
    const servicioId = parseInt(req.params.id, 10);
    if (isNaN(servicioId)) {
      res.status(400).json({ error: 'ID de servicio inválido.' });
      return;
    }

    try {
      const servicio = await obtenerServicioEnriquecidoPorId(servicioId);
      if (!servicio) {
        res.status(404).json({ error: 'Servicio no encontrado.' });
        return;
      }

      const participantes = await obtenerParticipantesConEstado(servicioId);

      res.json({
        data: {
          service: servicioAJson(servicio),
          participants: participantes.map((p) => ({
            id: p.id,
            name: p.nombreCompleto,
            email: p.correo,
            status: p.respuesta ?? 'Pendiente',
            lastDelivery: p.ultimoEnvio
              ? {
                  at:
                    p.ultimoEnvio.timestamp instanceof Date
                      ? p.ultimoEnvio.timestamp.toISOString()
                      : new Date(p.ultimoEnvio.timestamp).toISOString(),
                  result: p.ultimoEnvio.resultado,
                }
              : null,
          })),
        },
      });
    } catch (error) {
      console.error('[ServicesController.getServiceDetail Error]', error);
      res.status(500).json({ error: 'Error al obtener el detalle del servicio.' });
    }
  }

  static async getServiceSubmissions(req: Request, res: Response): Promise<void> {
    const servicioId = parseInt(req.params.id, 10);
    if (isNaN(servicioId)) {
      res.status(400).json({ error: 'ID de servicio inválido.' });
      return;
    }

    try {
      const servicio = await obtenerServicioEnriquecidoPorId(servicioId);
      if (!servicio) {
        res.status(404).json({ error: 'Servicio no encontrado.' });
        return;
      }

      const intentos = await obtenerIntentosPorServicio(servicioId);

      res.json({
        data: {
          service: servicioAJson(servicio),
          submissions: intentos.map((intento) => ({
            id: intento.id,
            participantName: intento.participanteNombre,
            number: intento.numero,
            at:
              intento.timestamp instanceof Date
                ? intento.timestamp.toISOString()
                : new Date(intento.timestamp).toISOString(),
            result: intento.resultado,
          })),
        },
      });
    } catch (error) {
      console.error('[ServicesController.getServiceSubmissions Error]', error);
      res.status(500).json({ error: 'Error al obtener los envíos del servicio.' });
    }
  }

  static async getServiciosLegacy(req: Request, res: Response): Promise<void> {
    try {
      const servicios = await ServicioModel.getAll();
      res.json({
        servicios,
      });
    } catch (error) {
      console.error('[ServicesController.getServiciosLegacy Error]', error);
      res.status(500).json({ error: 'Error al consultar servicios.' });
    }
  }
}
