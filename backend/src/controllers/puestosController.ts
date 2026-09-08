import { Request, Response } from 'express';
import { AreaModel } from '../models/area.model.js';
import { PuestoModel } from '../models/puesto.model.js';
import { puestoAJson, validarDatosPuesto } from '../services/puestosService.js';

async function areasPorId(): Promise<Map<number, string>> {
  const areas = await AreaModel.getAll();
  return new Map(areas.map((a) => [a.id, a.nombre]));
}

export class PuestosController {
  static async getPuestos(req: Request, res: Response): Promise<void> {
    try {
      const [areas, puestos] = await Promise.all([AreaModel.getAll(), PuestoModel.getAll()]);
      const mapaAreas = new Map(areas.map((a) => [a.id, a.nombre]));
      res.json({
        data: {
          areas: areas.map((a) => ({ id: a.id, nombre: a.nombre })),
          puestos: puestos.map((p) => puestoAJson(p, mapaAreas)),
        },
      });
    } catch (error) {
      console.error('[PuestosController.getPuestos Error]', error);
      res.status(500).json({ error: 'Error al obtener el catálogo de puestos.' });
    }
  }

  static async createPuesto(req: Request, res: Response): Promise<void> {
    const validacion = await validarDatosPuesto(req.body || {});
    if ('error' in validacion) {
      res.status(400).json({ error: validacion.error });
      return;
    }
    try {
      const id = await PuestoModel.create(
        validacion.datos.nombre,
        validacion.datos.tipo,
        validacion.datos.areaId
      );
      const puesto = await PuestoModel.getById(id);
      res.status(201).json({ data: puestoAJson(puesto!, await areasPorId()) });
    } catch (error) {
      console.error('[PuestosController.createPuesto Error]', error);
      res.status(500).json({ error: 'Error interno al crear el puesto.' });
    }
  }

  static async updatePuesto(req: Request, res: Response): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'ID de puesto inválido.' });
      return;
    }
    const validacion = await validarDatosPuesto(req.body || {});
    if ('error' in validacion) {
      res.status(400).json({ error: validacion.error });
      return;
    }
    try {
      const actualizado = await PuestoModel.update(
        id,
        validacion.datos.nombre,
        validacion.datos.tipo,
        validacion.datos.areaId
      );
      if (!actualizado) {
        res.status(404).json({ error: 'Puesto no encontrado.' });
        return;
      }
      const puesto = await PuestoModel.getById(id);
      res.json({ data: puestoAJson(puesto!, await areasPorId()) });
    } catch (error) {
      console.error('[PuestosController.updatePuesto Error]', error);
      res.status(500).json({ error: 'Error interno al editar el puesto.' });
    }
  }

  static async setPuestoStatus(req: Request, res: Response): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'ID de puesto inválido.' });
      return;
    }
    const activo = Boolean(req.body?.activo);
    try {
      const actualizado = await PuestoModel.setActivo(id, activo);
      if (!actualizado) {
        res.status(404).json({ error: 'Puesto no encontrado.' });
        return;
      }
      const puesto = await PuestoModel.getById(id);
      res.json({ data: puestoAJson(puesto!, await areasPorId()) });
    } catch (error) {
      console.error('[PuestosController.setPuestoStatus Error]', error);
      res.status(500).json({ error: 'Error interno al actualizar el estado del puesto.' });
    }
  }
}
