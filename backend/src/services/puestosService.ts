import { query } from '../db/index.js';
import { BUSINESS_CONSTANTS } from '../config/env.js';
import { AreaModel } from '../models/area.model.js';
import { PuestoModel, Puesto } from '../models/puesto.model.js';
import { construirNombreCompleto } from './serviciosService.js';

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

export interface ParticipanteElegible {
  id: number;
  nombreCompleto: string;
  correo: string;
  grupoNombre: string;
}

/**
 * RN-15: elegibles para asignación de puesto en un servicio son quienes confirmaron "Sí", más
 * los participantes de los grupos que nunca pasan por el flujo de confirmación por correo
 * (RN-5: Líder y Director) — se reutiliza esa misma lista de grupos, es la misma excepción de
 * negocio en ambos casos.
 */
export async function obtenerElegibles(servicioId: number): Promise<ParticipanteElegible[]> {
  const res = await query<{
    id: number;
    nombre: string;
    primer_apellido: string;
    segundo_apellido: string | null;
    correo: string;
    grupo_nombre: string;
  }>(
    `
    SELECT p.id, p.nombre, p.primer_apellido, p.segundo_apellido, p.correo, g.nombre AS grupo_nombre
    FROM Participante p
    JOIN Grupo g ON p.grupo_id = g.id
    LEFT JOIN Respuesta r ON r.participante_id = p.id AND r.servicio_id = $1
    WHERE p.activo = true
      AND (r.respuesta = 'Sí' OR g.nombre = ANY($2::text[]))
    ORDER BY p.nombre ASC, p.primer_apellido ASC
    `,
    [servicioId, BUSINESS_CONSTANTS.GRUPOS_SIN_RECORDATORIOS as unknown as string[]]
  );
  return res.rows.map((r) => ({
    id: r.id,
    nombreCompleto: construirNombreCompleto(r.nombre, r.primer_apellido, r.segundo_apellido),
    correo: r.correo,
    grupoNombre: r.grupo_nombre,
  }));
}

/**
 * RN-16: a lo sumo un puesto `Principal` en el conjunto recibido. También rechaza IDs de puesto
 * que no existan o que estén desactivados (RN-17: un puesto dado de baja no debe recibir
 * asignaciones nuevas, aunque conserve las que ya tenía en el historial).
 */
export async function validarConjuntoDePuestos(
  puestoIds: number[]
): Promise<{ error: string } | { ok: true }> {
  if (puestoIds.length === 0) return { ok: true };

  const puestos = await PuestoModel.getAll();
  const puestosPorId = new Map(puestos.map((p) => [p.id, p]));

  let principales = 0;
  for (const id of puestoIds) {
    const puesto = puestosPorId.get(id);
    if (!puesto) {
      return { error: `El puesto ${id} no existe.` };
    }
    if (!puesto.activo) {
      return { error: `El puesto "${puesto.nombre}" está desactivado y no se puede asignar.` };
    }
    if (puesto.tipo === 'Principal') principales += 1;
  }

  if (principales > 1) {
    return { error: 'Un participante no puede tener más de un puesto Principal por servicio (RN-16).' };
  }
  return { ok: true };
}
