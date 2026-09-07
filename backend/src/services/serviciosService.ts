import { query } from '../db/index.js';
import { Servicio, ServicioModel } from '../models/servicio.model.js';

export const PRIORIDAD_ESTADO: Record<string, number> = {
  Vencido: 0,
  Pendiente: 1,
  Cerrado: 2,
  Completo: 3,
};

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES_COMPLETOS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Setiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export function parseDate(dateVal: string | Date): Date {
  if (dateVal instanceof Date) return dateVal;
  // Parse YYYY-MM-DD
  const parts = dateVal.split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
  return new Date(dateVal);
}

export function formatDateYMD(d: Date | string): string {
  if (typeof d === 'string') {
    return d.slice(0, 10);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatearNombreServicio(fechaServicio: Date | string, tipo: string): string {
  const d = parseDate(fechaServicio);
  const diaSemana = DIAS_SEMANA[d.getDay()];
  const diaMes = d.getDate();
  const mes = MESES_COMPLETOS[d.getMonth()];
  return `Servicio ${tipo} ${diaSemana} ${diaMes} ${mes}`;
}

export function construirNombreCompleto(
  nombre: string,
  primerApellido: string,
  segundoApellido: string | null
): string {
  const apellidos = segundoApellido ? `${primerApellido} ${segundoApellido}` : primerApellido;
  return `${nombre} ${apellidos}`;
}

export function calcularEstado(
  ventanaAbierta: boolean,
  pendientes: number
): 'Pendiente' | 'Vencido' | 'Cerrado' | 'Completo' {
  if (!ventanaAbierta) {
    return pendientes > 0 ? 'Vencido' : 'Cerrado';
  }
  return pendientes === 0 ? 'Completo' : 'Pendiente';
}

export interface ServicioEnriquecido extends Servicio {
  nombre: string;
  pendientes: number;
  total_participantes: number;
  confirmados: number;
  ventana_abierta: boolean;
  dias_para_cierre: number;
  estado: 'Pendiente' | 'Vencido' | 'Cerrado' | 'Completo';
}

export interface ServiceJson {
  id: number;
  name: string;
  type: 'Regular' | 'Extraordinario';
  date: string;
  closingDate: string;
  invited: number;
  confirmed: number;
  pending: number;
  confirmationPercentage: number;
  daysUntilClosing: number;
  windowOpen: boolean;
  status: 'Pendiente' | 'Vencido' | 'Cerrado' | 'Completo';
}

// Un servidor desactivado deja de contar como convocado (RN interna de la Etapa 3): no suma
// en "invited" ni en "confirmed" de ningún servicio, para que "pendientes" siga siendo
// consistente (invited - confirmed) sobre el mismo universo de participantes activos.
async function contarTodosLosParticipantes(): Promise<number> {
  const res = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM Participante WHERE activo = true'
  );
  return parseInt(res.rows[0]?.count || '0', 10);
}

async function contarRespuestasPorTodosLosServicios(): Promise<Map<number, number>> {
  const res = await query<{ servicio_id: number; count: string }>(
    `
    SELECT r.servicio_id, COUNT(*) as count
    FROM Respuesta r
    JOIN Participante p ON r.participante_id = p.id
    WHERE p.activo = true
    GROUP BY r.servicio_id
  `
  );
  return new Map(res.rows.map((row) => [row.servicio_id, parseInt(row.count, 10)]));
}

/**
 * RN-4: orden de atención del dashboard. Extraída como función pura (no depende de la base de
 * datos) para poder probarla de forma determinista, y reutilizada por el `.sort()` de
 * `obtenerServiciosEnriquecidos`.
 */
export function compararServiciosPorPrioridad(
  a: Pick<ServicioEnriquecido, 'estado' | 'fecha_servicio'>,
  b: Pick<ServicioEnriquecido, 'estado' | 'fecha_servicio'>
): number {
  const prioA = PRIORIDAD_ESTADO[a.estado] ?? 99;
  const prioB = PRIORIDAD_ESTADO[b.estado] ?? 99;
  if (prioA !== prioB) {
    return prioA - prioB;
  }
  const dateA = new Date(a.fecha_servicio).getTime();
  const dateB = new Date(b.fecha_servicio).getTime();
  return dateA - dateB;
}

export async function obtenerServiciosEnriquecidos(): Promise<ServicioEnriquecido[]> {
  const servicios = await ServicioModel.getAll();
  const hoy = new Date();
  const hoyStr = formatDateYMD(hoy);
  const hoyDate = parseDate(hoyStr);

  const totalParticipantes = await contarTodosLosParticipantes();
  const confirmadosPorServicio = await contarRespuestasPorTodosLosServicios();

  const serviciosConInfo: ServicioEnriquecido[] = [];

  for (const servicio of servicios) {
    const confirmados = confirmadosPorServicio.get(servicio.id) ?? 0;
    const pendientes = totalParticipantes - confirmados;

    const fechaCierreStr = formatDateYMD(servicio.fecha_cierre_confirmacion);
    const fechaCierreDate = parseDate(fechaCierreStr);

    const ventanaAbierta = hoyDate < fechaCierreDate;
    const diffTime = fechaCierreDate.getTime() - hoyDate.getTime();
    const diasParaCierre = Math.round(diffTime / (1000 * 60 * 60 * 24));
    const estado = calcularEstado(ventanaAbierta, pendientes);

    const servicioEnriquecido: ServicioEnriquecido = {
      ...servicio,
      nombre: formatearNombreServicio(servicio.fecha_servicio, servicio.tipo),
      pendientes,
      total_participantes: totalParticipantes,
      confirmados,
      ventana_abierta: ventanaAbierta,
      dias_para_cierre: diasParaCierre,
      estado,
    };

    serviciosConInfo.push(servicioEnriquecido);
  }

  serviciosConInfo.sort(compararServiciosPorPrioridad);

  return serviciosConInfo;
}

export async function obtenerServicioEnriquecidoPorId(
  id: number
): Promise<ServicioEnriquecido | null> {
  const todos = await obtenerServiciosEnriquecidos();
  return todos.find((s) => s.id === id) || null;
}

export function servicioAJson(s: ServicioEnriquecido): ServiceJson {
  const fechaStr = formatDateYMD(s.fecha_servicio);
  const horaStr = typeof s.hora_servicio === 'string' ? s.hora_servicio.slice(0, 8) : '00:00:00';
  const isoDateTime = `${fechaStr}T${horaStr.length === 5 ? `${horaStr}:00` : horaStr}`;
  const closingStr = formatDateYMD(s.fecha_cierre_confirmacion);

  const confirmationPercentage =
    s.total_participantes > 0 ? Math.round((s.confirmados * 100) / s.total_participantes) : 0;

  return {
    id: s.id,
    name: s.nombre,
    type: s.tipo,
    date: isoDateTime,
    closingDate: closingStr,
    invited: s.total_participantes,
    confirmed: s.confirmados,
    pending: s.pendientes,
    confirmationPercentage,
    daysUntilClosing: s.dias_para_cierre,
    windowOpen: s.ventana_abierta,
    status: s.estado,
  };
}

export interface ParticipanteConEstado {
  id: number;
  nombreCompleto: string;
  correo: string;
  respuesta: 'Sí' | 'No' | null;
  ultimoEnvio: { timestamp: Date; resultado: 'exitoso' | 'fallido' } | null;
}

export async function obtenerParticipantesConEstado(
  servicioId: number
): Promise<ParticipanteConEstado[]> {
  const participantesRes = await query<{
    id: number;
    nombre: string;
    primer_apellido: string;
    segundo_apellido: string | null;
    correo: string;
  }>('SELECT id, nombre, primer_apellido, segundo_apellido, correo FROM Participante WHERE activo = true ORDER BY nombre ASC, primer_apellido ASC');

  const respuestasRes = await query<{ participante_id: number; respuesta: 'Sí' | 'No' }>(
    'SELECT participante_id, respuesta FROM Respuesta WHERE servicio_id = $1',
    [servicioId]
  );
  const respuestasPorParticipante = new Map(
    respuestasRes.rows.map((r) => [r.participante_id, r.respuesta])
  );

  // Trae el último intento de cada participante en una sola consulta (DISTINCT ON + ORDER BY
  // timestamp DESC) en vez de una consulta por participante, para no repetir el mismo N+1 que
  // se corrigió en `obtenerServiciosEnriquecidos`.
  const ultimosEnviosRes = await query<{
    participante_id: number;
    timestamp: Date;
    resultado: 'exitoso' | 'fallido';
  }>(
    `
    SELECT DISTINCT ON (participante_id) participante_id, timestamp, resultado
    FROM Intento_Envio
    WHERE servicio_id = $1
    ORDER BY participante_id, timestamp DESC
  `,
    [servicioId]
  );
  const ultimoEnvioPorParticipante = new Map(
    ultimosEnviosRes.rows.map((r) => [r.participante_id, { timestamp: r.timestamp, resultado: r.resultado }])
  );

  return participantesRes.rows.map((p) => ({
    id: p.id,
    nombreCompleto: construirNombreCompleto(p.nombre, p.primer_apellido, p.segundo_apellido),
    correo: p.correo,
    respuesta: respuestasPorParticipante.get(p.id) ?? null,
    ultimoEnvio: ultimoEnvioPorParticipante.get(p.id) ?? null,
  }));
}

export interface IntentoEnvioConParticipante {
  id: number;
  participanteNombre: string;
  numero: number;
  timestamp: Date;
  resultado: 'exitoso' | 'fallido';
}

export async function obtenerIntentosPorServicio(
  servicioId: number
): Promise<IntentoEnvioConParticipante[]> {
  const res = await query<{
    id: number;
    nombre: string;
    primer_apellido: string;
    segundo_apellido: string | null;
    numero_recordatorio: number;
    timestamp: Date;
    resultado: 'exitoso' | 'fallido';
  }>(
    `
    SELECT i.id, p.nombre, p.primer_apellido, p.segundo_apellido, i.numero_recordatorio, i.timestamp, i.resultado
    FROM Intento_Envio i
    JOIN Participante p ON i.participante_id = p.id
    WHERE i.servicio_id = $1
    ORDER BY i.timestamp DESC
  `,
    [servicioId]
  );

  return res.rows.map((r) => ({
    id: r.id,
    participanteNombre: construirNombreCompleto(r.nombre, r.primer_apellido, r.segundo_apellido),
    numero: r.numero_recordatorio,
    timestamp: r.timestamp,
    resultado: r.resultado,
  }));
}
