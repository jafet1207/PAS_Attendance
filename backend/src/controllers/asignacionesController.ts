import { Request, Response } from 'express';
import { AsignacionPuestoModel } from '../models/asignacionPuesto.model.js';
import { ParticipanteModel } from '../models/participante.model.js';
import { PuestoModel } from '../models/puesto.model.js';
import {
  estaEnVentanaDeAsignacionDePuestos,
  obtenerServicioEnriquecidoPorId,
  servicioAJson,
} from '../services/serviciosService.js';
import { obtenerElegibles, validarConjuntoDePuestos } from '../services/puestosService.js';

export class AsignacionesController {
  static async getAsignaciones(req: Request, res: Response): Promise<void> {
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

      const [elegibles, asignaciones, puestos] = await Promise.all([
        obtenerElegibles(servicioId),
        AsignacionPuestoModel.getPorServicio(servicioId),
        PuestoModel.getAll(),
      ]);
      const puestosPorId = new Map(puestos.map((p) => [p.id, p]));

      const puestosPorParticipante = new Map<
        number,
        { id: number; nombre: string; tipo: 'Principal' | 'Secundario' }[]
      >();
      for (const asignacion of asignaciones) {
        const puesto = puestosPorId.get(asignacion.puesto_id);
        if (!puesto) continue; // defensivo: no debería ocurrir (FK), pero no debe tumbar la respuesta
        const lista = puestosPorParticipante.get(asignacion.participante_id) ?? [];
        lista.push({ id: puesto.id, nombre: puesto.nombre, tipo: puesto.tipo });
        puestosPorParticipante.set(asignacion.participante_id, lista);
      }

      res.json({
        data: {
          service: servicioAJson(servicio),
          participants: elegibles.map((p) => ({
            id: p.id,
            name: p.nombreCompleto,
            email: p.correo,
            groupName: p.grupoNombre,
            puestos: puestosPorParticipante.get(p.id) ?? [],
          })),
        },
      });
    } catch (error) {
      console.error('[AsignacionesController.getAsignaciones Error]', error);
      res.status(500).json({ error: 'Error al obtener las asignaciones del servicio.' });
    }
  }

  static async guardarAsignacion(req: Request, res: Response): Promise<void> {
    const servicioId = parseInt(req.params.id, 10);
    const participanteId = parseInt(req.params.participanteId, 10);
    if (isNaN(servicioId) || isNaN(participanteId)) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }

    const puestoIdsRaw = req.body?.puestoIds;
    if (!Array.isArray(puestoIdsRaw)) {
      res.status(400).json({ error: 'puestoIds debe ser un arreglo.' });
      return;
    }
    const puestoIds = puestoIdsRaw.map(Number);
    if (puestoIds.some((id) => !Number.isInteger(id))) {
      res.status(400).json({ error: 'puestoIds debe ser un arreglo de números enteros.' });
      return;
    }

    try {
      const servicio = await obtenerServicioEnriquecidoPorId(servicioId);
      if (!servicio) {
        res.status(404).json({ error: 'Servicio no encontrado.' });
        return;
      }
      // RN-14: autoritativo en el backend, no solo un adorno de la UI — un PUT directo no debe
      // poder saltarse la ventana aunque la pantalla la respete.
      if (!estaEnVentanaDeAsignacionDePuestos(servicio.ventana_abierta, servicio.dias_para_servicio)) {
        res.status(400).json({
          error: 'Este servicio no está en la ventana de asignación de puestos (debe estar cerrado y no haber ocurrido todavía).',
        });
        return;
      }

      const participante = await ParticipanteModel.getById(participanteId);
      if (!participante || !participante.activo) {
        res.status(404).json({ error: 'Servidor no encontrado.' });
        return;
      }

      // RN-15: no se valida contra `obtenerElegibles` completo (evita una consulta extra); el
      // mismo criterio se aplica leyendo directamente si el participante es elegible.
      const elegibles = await obtenerElegibles(servicioId);
      if (!elegibles.some((e) => e.id === participanteId)) {
        res.status(400).json({
          error: 'Este servidor no es elegible para recibir un puesto en este servicio (no confirmó "Sí" ni es Líder/Director).',
        });
        return;
      }

      const validacion = await validarConjuntoDePuestos(puestoIds);
      if ('error' in validacion) {
        res.status(400).json({ error: validacion.error });
        return;
      }

      await AsignacionPuestoModel.reemplazarParaParticipante(participanteId, servicioId, puestoIds);
      res.json({ data: { participanteId, puestoIds } });
    } catch (error) {
      console.error('[AsignacionesController.guardarAsignacion Error]', error);
      res.status(500).json({ error: 'Error interno al guardar la asignación de puestos.' });
    }
  }
}
