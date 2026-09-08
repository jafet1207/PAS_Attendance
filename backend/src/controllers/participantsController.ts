import { Request, Response } from 'express';
import { ParticipanteModel } from '../models/participante.model.js';
import { GrupoModel } from '../models/grupo.model.js';
import { HistorialParticipanteModel } from '../models/historialParticipante.model.js';
import { construirNombreCompleto } from '../services/serviciosService.js';

export class ParticipantsController {
  static async getParticipants(req: Request, res: Response): Promise<void> {
    try {
      const grupos = await GrupoModel.getAll();
      const gruposMap = new Map(grupos.map((g) => [g.id, g.nombre]));

      const participantes = await ParticipanteModel.getAll();

      res.json({
        data: participantes.map((p) => ({
          id: p.id,
          name: construirNombreCompleto(p.nombre, p.primer_apellido, p.segundo_apellido),
          email: p.correo,
          active: p.activo,
          group: {
            id: p.grupo_id,
            name: gruposMap.get(p.grupo_id) || 'Sin grupo',
          },
        })),
      });
    } catch (error) {
      console.error('[ParticipantsController.getParticipants Error]', error);
      res.status(500).json({ error: 'Error al obtener la lista de participantes.' });
    }
  }

  static async createParticipant(req: Request, res: Response): Promise<void> {
    const datos = req.body || {};
    const nombre = (datos.nombre || '').toString().trim();
    const primerApellido = (datos.primer_apellido || '').toString().trim();
    const segundoApellidoRaw = (datos.segundo_apellido || '').toString().trim();
    const segundoApellido = segundoApellidoRaw || null;
    const correo = (datos.correo || '').toString().trim();
    const grupoIdRaw = datos.grupo_id;

    const errores: string[] = [];

    // Mínimo 2 caracteres y no compuesto solo por dígitos (evita valores como "1" o "42").
    const esTextoValido = (valor: string) => valor.length >= 2 && !/^\d+$/.test(valor);

    if (!esTextoValido(nombre)) {
      errores.push('El nombre debe tener al menos 2 caracteres y no puede ser solo números.');
    }

    if (!esTextoValido(primerApellido)) {
      errores.push('El primer apellido debe tener al menos 2 caracteres y no puede ser solo números.');
    }

    if (segundoApellido && !esTextoValido(segundoApellido)) {
      errores.push('El segundo apellido debe tener al menos 2 caracteres y no puede ser solo números.');
    }

    if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      errores.push('Ingresa un correo válido.');
    }

    const grupoId = parseInt(grupoIdRaw, 10);
    if (isNaN(grupoId)) {
      errores.push('Selecciona un grupo válido.');
    }

    if (errores.length > 0) {
      res.status(400).json({ errors: errores });
      return;
    }

    try {
      const grupo = await GrupoModel.getById(grupoId);
      if (!grupo) {
        res.status(400).json({ errors: ['Selecciona un grupo válido.'] });
        return;
      }

      const participanteId = await ParticipanteModel.create(
        nombre,
        primerApellido,
        segundoApellido,
        correo,
        grupoId
      );

      res.status(201).json({
        data: {
          id: participanteId,
          name: construirNombreCompleto(nombre, primerApellido, segundoApellido),
          email: correo,
          group: {
            id: grupo.id,
            name: grupo.nombre,
          },
        },
      });
    } catch (error: any) {
      console.error('[ParticipantsController.createParticipant Error]', error);
      if (error?.code === '23505') {
        // Violación de unicidad en correo
        res.status(409).json({
          error: 'No fue posible guardar la persona. Verifica que el correo no esté repetido.',
        });
        return;
      }
      res.status(500).json({ error: 'Error interno al crear el participante.' });
    }
  }

  static async updateParticipantRole(req: Request, res: Response): Promise<void> {
    const participanteId = parseInt(req.params.id, 10);
    if (isNaN(participanteId)) {
      res.status(400).json({ error: 'ID de participante inválido.' });
      return;
    }

    const datos = req.body || {};
    const grupoId = parseInt(datos.grupo_id, 10);

    if (isNaN(grupoId)) {
      res.status(400).json({ error: 'Selecciona un rol válido.' });
      return;
    }

    try {
      const grupo = await GrupoModel.getById(grupoId);
      if (!grupo) {
        res.status(400).json({ error: 'Selecciona un rol válido.' });
        return;
      }

      const actualizado = await ParticipanteModel.updateGrupo(participanteId, grupoId);
      if (!actualizado) {
        res.status(404).json({ error: 'Servidor no encontrado.' });
        return;
      }

      res.json({
        data: {
          id: participanteId,
          group: {
            id: grupo.id,
            name: grupo.nombre,
          },
        },
      });
    } catch (error) {
      console.error('[ParticipantsController.updateParticipantRole Error]', error);
      res.status(500).json({ error: 'Error interno al actualizar el rol del participante.' });
    }
  }

  static async updateParticipantEmail(req: Request, res: Response): Promise<void> {
    const participanteId = parseInt(req.params.id, 10);
    if (isNaN(participanteId)) {
      res.status(400).json({ error: 'ID de participante inválido.' });
      return;
    }

    const correo = (req.body?.correo || '').toString().trim();
    if (!correo || !correo.includes('@')) {
      res.status(400).json({ error: 'Ingresa un correo válido.' });
      return;
    }

    try {
      const actualizado = await ParticipanteModel.updateCorreo(participanteId, correo);
      if (!actualizado) {
        res.status(404).json({ error: 'Servidor no encontrado.' });
        return;
      }

      res.json({ data: { id: participanteId, email: correo } });
    } catch (error: any) {
      console.error('[ParticipantsController.updateParticipantEmail Error]', error);
      if (error?.code === '23505') {
        res.status(409).json({ error: 'Ya existe otro servidor registrado con este correo.' });
        return;
      }
      res.status(500).json({ error: 'Error interno al actualizar el correo del participante.' });
    }
  }

  static async updateParticipantStatus(req: Request, res: Response): Promise<void> {
    const participanteId = parseInt(req.params.id, 10);
    if (isNaN(participanteId)) {
      res.status(400).json({ error: 'ID de participante inválido.' });
      return;
    }

    const datos = req.body || {};
    const activo = Boolean(datos.activo);
    const comentario = (datos.comentario || '').toString().trim() || null;

    try {
      const participante = await ParticipanteModel.getById(participanteId);
      if (!participante) {
        res.status(404).json({ error: 'Servidor no encontrado.' });
        return;
      }

      // Al desactivar, si el servidor ya confirmó "Sí" a un servicio cuya fecha aún no pasa,
      // se exige un comentario que justifique la decisión (queda en el historial de auditoría).
      if (!activo) {
        const confirmacionProxima = await ParticipanteModel.tieneConfirmacionProxima(participanteId);
        if (confirmacionProxima && !comentario) {
          res.status(400).json({
            requiresComment: true,
            error:
              'Este servidor confirmó asistencia a un servicio próximo. Debes justificar con un comentario por qué lo desactivas.',
          });
          return;
        }
      }

      await ParticipanteModel.updateActivo(participanteId, activo);
      await HistorialParticipanteModel.registrar(
        participanteId,
        activo ? 'Reactivado' : 'Desactivado',
        comentario
      );

      res.json({ data: { id: participanteId, active: activo } });
    } catch (error) {
      console.error('[ParticipantsController.updateParticipantStatus Error]', error);
      res.status(500).json({ error: 'Error interno al actualizar el estado del participante.' });
    }
  }
}
