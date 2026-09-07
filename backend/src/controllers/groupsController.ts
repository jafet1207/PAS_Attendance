import { Request, Response } from 'express';
import { GrupoModel } from '../models/grupo.model.js';

export class GroupsController {
  static async getGroups(req: Request, res: Response): Promise<void> {
    try {
      const grupos = await GrupoModel.getAll();
      res.json({
        data: grupos.map((g) => ({
          id: g.id,
          name: g.nombre,
        })),
      });
    } catch (error) {
      console.error('[GroupsController Error]', error);
      res.status(500).json({ error: 'Error al obtener los grupos.' });
    }
  }
}
