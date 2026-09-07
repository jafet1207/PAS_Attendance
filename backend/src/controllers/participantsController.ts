import { Request, Response } from 'express';
import { ParticipanteModel } from '../models/participante.model.js';
import { GrupoModel } from '../models/grupo.model.js';
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

    if (!nombre) {
      errores.push('El nombre es requerido.');
    }

    if (!primerApellido) {
      errores.push('El primer apellido es requerido.');
    }

    if (!correo || !correo.includes('@')) {
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
}
