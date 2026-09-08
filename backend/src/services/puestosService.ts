import { AreaModel } from '../models/area.model.js';
import { Puesto } from '../models/puesto.model.js';

export interface PuestoJson {
  id: number;
  nombre: string;
  tipo: 'Principal' | 'Secundario';
  areaId: number | null;
  areaNombre: string | null;
  activo: boolean;
}

export function puestoAJson(p: Puesto, areasPorId: Map<number, string>): PuestoJson {
  return {
    id: p.id,
    nombre: p.nombre,
    tipo: p.tipo,
    areaId: p.area_id,
    areaNombre: p.area_id != null ? areasPorId.get(p.area_id) ?? null : null,
    activo: p.activo,
  };
}

export interface DatosPuestoValidados {
  nombre: string;
  tipo: 'Principal' | 'Secundario';
  areaId: number | null;
}

/**
 * RN-17: un puesto `Principal` requiere Área; uno `Secundario` no debe tenerla — mismo `CHECK`
 * que ya existe en el esquema (`db/index.ts`), reforzado acá para devolver un error 400 con
 * mensaje claro en vez de dejar que la violación del `CHECK` llegue como un error 500 genérico.
 * También valida que el Área indicada exista de verdad, para no dejar un `area_id` huérfano.
 */
export async function validarDatosPuesto(
  datos: Record<string, unknown>
): Promise<{ error: string } | { datos: DatosPuestoValidados }> {
  const nombre = (datos.nombre ?? '').toString().trim();
  if (nombre.length < 2) {
    return { error: 'El nombre del puesto debe tener al menos 2 caracteres.' };
  }

  if (datos.tipo !== 'Principal' && datos.tipo !== 'Secundario') {
    return { error: 'El tipo debe ser "Principal" o "Secundario".' };
  }
  const tipo = datos.tipo;

  if (tipo === 'Principal') {
    const areaId = Number(datos.area_id);
    const area = Number.isInteger(areaId) ? await AreaModel.getById(areaId) : null;
    if (!area) {
      return { error: 'Un puesto Principal requiere un Área válida.' };
    }
    return { datos: { nombre, tipo, areaId: area.id } };
  }

  if (datos.area_id !== undefined && datos.area_id !== null && datos.area_id !== '') {
    return { error: 'Un puesto Secundario no debe tener Área.' };
  }
  return { datos: { nombre, tipo, areaId: null } };
}
