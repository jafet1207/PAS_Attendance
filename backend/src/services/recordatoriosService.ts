import { query } from '../db/index.js';
import { config, BUSINESS_CONSTANTS } from '../config/env.js';
import { generarToken } from '../tokens/index.js';
import {
  escapeHtml,
  calcularHoraLlegada,
  obtenerBufferLlegadaHoras,
  formatearHora12,
  renderEmailHtml,
  EMAIL_ESTILOS,
} from '../controllers/confirmController.js';
import {
  obtenerServiciosEnriquecidos,
  formatDateYMD,
  construirNombreCompleto,
} from './serviciosService.js';
import { IntentoEnvioModel } from '../models/intentoEnvio.model.js';
import { RecordatoriosConfigModel } from '../models/recordatoriosConfig.model.js';
import { Mailer, obtenerMailerActivo } from '../mailer/index.js';

// Minutos tras los cuales un lock de Recordatorios_Lock se considera abandonado (p. ej. el
// proceso murió antes de liberarlo) y puede volver a adquirirse.
const TIEMPO_MAX_LOCK_MINUTOS = 10;

/**
 * Intenta tomar el lock de una sola fila que serializa el ciclo de recordatorios. Se
 * implementa como UPDATE atómico de una fila (no como pg_advisory_lock de Postgres) porque el
 * endpoint pooled de Neon (PgBouncer en modo transacción) no garantiza que un advisory lock de
 * sesión persista entre sentencias del mismo cliente lógico; un UPDATE de una sola sentencia,
 * en cambio, es atómico sin importar el modo de pooling.
 */
async function intentarAdquirirLockRecordatorios(): Promise<boolean> {
  const res = await query(
    `
    UPDATE Recordatorios_Lock
    SET bloqueado_desde = NOW()
    WHERE id = 1
      AND (bloqueado_desde IS NULL OR bloqueado_desde < NOW() - make_interval(mins => $1))
  `,
    [TIEMPO_MAX_LOCK_MINUTOS]
  );
  return (res.rowCount ?? 0) > 0;
}

async function liberarLockRecordatorios(): Promise<void> {
  await query('UPDATE Recordatorios_Lock SET bloqueado_desde = NULL WHERE id = 1');
}

export interface ResumenRecordatorios {
  servicios_procesados: number;
  participantes_evaluados: number;
  recordatorios_exitosos: number;
  recordatorios_fallidos: number;
  ya_completados: number;
  ya_confirmados: number;
  /** Ya recibió un recordatorio exitoso de este servicio hoy (ver ajuste de hora de envío):
   * no se le vuelve a enviar aunque el ciclo corra otra vez el mismo día. */
  ya_enviado_hoy: number;
  /** true solo si esta invocación se omitió por encontrar el ciclo ya en ejecución. */
  omitido_por_ejecucion_concurrente?: boolean;
  /** true solo si se omitió porque la hora actual (UTC-6) no coincide con la hora de envío
   * configurada por el coordinador (ver pantalla de Ajustes). */
  omitido_fuera_de_horario?: boolean;
}

interface ParticipanteElegible {
  id: number;
  nombre: string;
  primer_apellido: string;
  segundo_apellido: string | null;
  correo: string;
  grupo_nombre: string;
}

/**
 * RN-5: participantes activos cuyo grupo no está excluido de recordatorios (Líder/Director).
 * `participanteIds`, cuando se indica, restringe el barrido a ese subconjunto (solo lo usan
 * las pruebas para no reprocesar todos los participantes reales existentes en la base).
 */
async function obtenerParticipantesElegibles(
  participanteIds?: number[]
): Promise<ParticipanteElegible[]> {
  const res = await query<ParticipanteElegible>(
    `
    SELECT p.id, p.nombre, p.primer_apellido, p.segundo_apellido, p.correo, g.nombre as grupo_nombre
    FROM Participante p
    JOIN Grupo g ON p.grupo_id = g.id
    WHERE p.activo = true
      AND NOT (g.nombre = ANY($1))
      AND ($2::int[] IS NULL OR p.id = ANY($2))
    ORDER BY p.id ASC
  `,
    [BUSINESS_CONSTANTS.GRUPOS_SIN_RECORDATORIOS, participanteIds ?? null]
  );
  return res.rows;
}

async function obtenerParticipantesQueYaRespondieron(servicioId: number): Promise<Set<number>> {
  const res = await query<{ participante_id: number }>(
    'SELECT participante_id FROM Respuesta WHERE servicio_id = $1',
    [servicioId]
  );
  return new Set(res.rows.map((r) => r.participante_id));
}

interface ConteoIntentos {
  exitosos: number;
  total: number;
}

/**
 * Trae en una sola consulta los conteos de intentos (RN-6) de todos los participantes para
 * un servicio, en vez de consultar por participante uno a uno (evita un N+1 igual al que se
 * corrigió en `serviciosService.obtenerServiciosEnriquecidos`).
 */
async function obtenerConteosIntentosPorServicio(
  servicioId: number
): Promise<Map<number, ConteoIntentos>> {
  const res = await query<{ participante_id: number; exitosos: string; total: string }>(
    `
    SELECT participante_id,
           COUNT(*) FILTER (WHERE resultado = 'exitoso') as exitosos,
           COUNT(*) as total
    FROM Intento_Envio
    WHERE servicio_id = $1
    GROUP BY participante_id
  `,
    [servicioId]
  );
  return new Map(
    res.rows.map((r) => [
      r.participante_id,
      { exitosos: parseInt(r.exitosos, 10), total: parseInt(r.total, 10) },
    ])
  );
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatIcsUtc(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}` +
    `T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`
  );
}

/** Convierte una fecha/hora local de Costa Rica (UTC-6) a un Date en UTC. */
function localCRaUtc(fechaYMD: string, horaHHMM: string): Date {
  const [year, month, day] = fechaYMD.split('-').map((v) => parseInt(v, 10));
  const [hour, minute] = horaHHMM.split(':').map((v) => parseInt(v, 10));
  const horasUtc = hour - BUSINESS_CONSTANTS.ZONA_HORARIA_OFFSET_HORAS;
  return new Date(Date.UTC(year, month - 1, day, horasUtc, minute));
}

function escaparTextoIcs(valor: string): string {
  return valor
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

interface DatosIcs {
  servicioId: number;
  participanteId: number;
  nombreServicio: string;
  fechaServicioYMD: string;
  horaServicioHHMM: string;
  horaLlegadaHHMM: string;
  /** Horas de anticipación de la llegada (RN-8), usadas para calcular DTSTART por aritmética
   * de instantes (no reparseando `horaLlegadaHHMM`), para que un buffer grande que cruce la
   * medianoche siga produciendo un DTSTART anterior a DTEND en vez de invertir el evento. */
  bufferLlegadaHoras: number;
}

/** Genera un adjunto de calendario RFC 5545 (.ics) de la hora de llegada al fin del servicio. */
export function generarIcs(datos: DatosIcs): string {
  const finServicio = localCRaUtc(datos.fechaServicioYMD, datos.horaServicioHHMM);
  const inicio = new Date(finServicio.getTime() - datos.bufferLlegadaHoras * 3600 * 1000);
  const fin = new Date(finServicio.getTime() + BUSINESS_CONSTANTS.DURACION_EXTRA_HORAS * 3600 * 1000);
  const uid = `servicio-${datos.servicioId}-participante-${datos.participanteId}@pas-attendance`;

  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PAS Attendance//Recordatorios//ES',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatIcsUtc(new Date())}`,
    `DTSTART:${formatIcsUtc(inicio)}`,
    `DTEND:${formatIcsUtc(fin)}`,
    `SUMMARY:${escaparTextoIcs(datos.nombreServicio)}`,
    `DESCRIPTION:${escaparTextoIcs(`Hora de llegada: ${datos.horaLlegadaHHMM}. Hora de inicio: ${datos.horaServicioHHMM}.`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return `${lineas.join('\r\n')}\r\n`;
}

interface DatosRecordatorioHtml {
  participanteNombre: string;
  servicioNombre: string;
  fechaServicio: string;
  horaLlegada: string;
  fechaCierre: string;
  token: string;
}

/**
 * Misma plantilla y clases CSS que las páginas públicas de confirmación
 * (`confirmController.renderBaseHtml`) — para que el correo de recordatorio y el correo de
 * acuse de recibo (y la página web) se vean consistentes entre sí.
 */
function renderRecordatorioHtml(datos: DatosRecordatorioHtml): string {
  const base = config.appBaseUrl;
  const linkFormulario = `${base}/confirm/${datos.token}`;
  const linkSi = `${base}/confirm/${datos.token}/si`;
  const linkNo = `${base}/confirm/${datos.token}/no`;

  const contenido = `
    <h1 style="${EMAIL_ESTILOS.h1}">Recordatorio de Asistencia</h1>
    <p style="${EMAIL_ESTILOS.p}">Hola <strong>${escapeHtml(datos.participanteNombre)}</strong>, todavía no hemos recibido tu confirmación para el siguiente servicio:</p>

    <div style="${EMAIL_ESTILOS.callout}">
      <span style="${EMAIL_ESTILOS.calloutLabel}">Hora de llegada requerida</span>
      <span style="${EMAIL_ESTILOS.calloutTime}">${formatearHora12(datos.horaLlegada)}</span>
    </div>

    <div style="${EMAIL_ESTILOS.details}">
      <p style="${EMAIL_ESTILOS.detailRow}"><strong>Servicio:</strong> ${escapeHtml(datos.servicioNombre)}</p>
      <p style="${EMAIL_ESTILOS.detailRow}"><strong>Fecha:</strong> ${datos.fechaServicio}</p>
      <p style="${EMAIL_ESTILOS.detailRow}"><strong>Fecha límite para responder:</strong> ${datos.fechaCierre}</p>
    </div>

    <a href="${linkSi}" style="${EMAIL_ESTILOS.btnPrimary}">✓ Sí, voy a asistir</a>
    <a href="${linkNo}" style="${EMAIL_ESTILOS.btnDanger}">✗ No podré asistir</a>

    <p style="${EMAIL_ESTILOS.footer}">
      ¿Prefieres revisar los detalles antes? <a href="${linkFormulario}" style="${EMAIL_ESTILOS.link}">Abre el formulario de confirmación</a>.
    </p>
  `;
  return renderEmailHtml('Recordatorio de Asistencia', contenido);
}

export interface OpcionesCicloRecordatorios {
  mailer?: Mailer;
  /** Solo para pruebas: restringe el barrido a estos servicios/participantes puntuales. */
  servicioIds?: number[];
  participanteIds?: number[];
  /** Si es true, el ciclo no hace nada a menos que la hora actual (UTC-6) coincida con la
   * hora de envío configurada por el coordinador (pantalla de Ajustes). Lo usan el disparo
   * automático (Cron) y el planificador local; un disparo manual del coordinador o una prueba
   * no lo activan, así que corren de inmediato sin depender del reloj. */
  respetarHorarioConfigurado?: boolean;
}

/**
 * RN-7: días hasta el cierre de confirmación de un servicio (puede ser negativo si ya cerró).
 * Calculado sobre fechas locales (medianoche a medianoche), no sobre instantes UTC, para que
 * un mismo día calendario siempre dé la misma diferencia entera de días.
 */
function diasHastaCierre(fechaCierreStr: string): number {
  const hoy = new Date(`${formatDateYMD(new Date())}T00:00:00`);
  const cierre = new Date(`${fechaCierreStr}T00:00:00`);
  return Math.round((cierre.getTime() - hoy.getTime()) / (24 * 3600 * 1000));
}

/** Hora actual del día, en UTC-6 (0-23), para comparar contra la hora de envío configurada. */
function horaActualUtc6(): number {
  const horaUtc = new Date().getUTCHours();
  return (((horaUtc + BUSINESS_CONSTANTS.ZONA_HORARIA_OFFSET_HORAS) % 24) + 24) % 24;
}

/** Límites (instantes UTC) del día calendario de hoy en UTC-6, para detectar si ya se envió
 * un recordatorio exitoso "hoy" sin importar a qué hora corrió el ciclo. */
function limitesDelDiaUtc6(): { desde: Date; hasta: Date } {
  const desde = localCRaUtc(formatDateYMD(new Date()), '00:00');
  const hasta = new Date(desde.getTime() + 24 * 3600 * 1000);
  return { desde, hasta };
}

/**
 * RF-5: evalúa los servicios con ventana de confirmación abierta (RN-2) cuyo cierre cae
 * exactamente dentro de la ventana de envío (RN-7: 2 días antes, 1 día antes, o el mismo día
 * del cierre) y despacha un recordatorio a cada participante elegible (RN-5) que aún no
 * respondió, no alcanzó el tope de 3 envíos exitosos (RN-6) y no recibió ya un recordatorio
 * exitoso de ese mismo servicio hoy (para que cambiar la hora de envío configurada a media
 * jornada no le duplique el correo del día).
 *
 * Serializa la ejecución con el lock de `Recordatorios_Lock`: si otra invocación ya está en
 * curso (doble disparo de cron, cron y panel a la vez, reintento de red), esta llamada no
 * reprocesa nada y retorna de inmediato con `omitido_por_ejecucion_concurrente: true`, en vez
 * de arriesgarse a enviar recordatorios duplicados o exceder el tope de RN-6 por una carrera.
 */
export async function ejecutarCicloDeRecordatorios(
  opciones: OpcionesCicloRecordatorios = {}
): Promise<ResumenRecordatorios> {
  const resumenVacio: ResumenRecordatorios = {
    servicios_procesados: 0,
    participantes_evaluados: 0,
    recordatorios_exitosos: 0,
    recordatorios_fallidos: 0,
    ya_completados: 0,
    ya_confirmados: 0,
    ya_enviado_hoy: 0,
  };

  if (opciones.respetarHorarioConfigurado) {
    const horaConfigurada = await RecordatoriosConfigModel.obtenerHoraEnvioUtc6();
    if (horaActualUtc6() !== horaConfigurada) {
      return { ...resumenVacio, omitido_fuera_de_horario: true };
    }
  }

  if (!(await intentarAdquirirLockRecordatorios())) {
    console.warn(
      '[recordatoriosService] El ciclo de recordatorios ya está en ejecución; se omite esta invocación concurrente.'
    );
    return { ...resumenVacio, omitido_por_ejecucion_concurrente: true };
  }

  try {
    return await ejecutarCicloInterno(opciones);
  } finally {
    await liberarLockRecordatorios();
  }
}

async function ejecutarCicloInterno(
  opciones: OpcionesCicloRecordatorios
): Promise<ResumenRecordatorios> {
  const mailer = opciones.mailer ?? obtenerMailerActivo();
  const resumen: ResumenRecordatorios = {
    servicios_procesados: 0,
    participantes_evaluados: 0,
    recordatorios_exitosos: 0,
    recordatorios_fallidos: 0,
    ya_completados: 0,
    ya_confirmados: 0,
    ya_enviado_hoy: 0,
  };

  const { desde: inicioDeHoy, hasta: finDeHoy } = limitesDelDiaUtc6();

  const servicios = (await obtenerServiciosEnriquecidos()).filter(
    (s) =>
      s.ventana_abierta &&
      BUSINESS_CONSTANTS.DIAS_DE_ENVIO_RECORDATORIO.includes(
        diasHastaCierre(formatDateYMD(s.fecha_cierre_confirmacion))
      ) &&
      (!opciones.servicioIds || opciones.servicioIds.includes(s.id))
  );
  const elegibles = await obtenerParticipantesElegibles(opciones.participanteIds);

  for (const servicio of servicios) {
    resumen.servicios_procesados += 1;
    const yaRespondieron = await obtenerParticipantesQueYaRespondieron(servicio.id);
    const conteosIntentos = await obtenerConteosIntentosPorServicio(servicio.id);
    const enviadosHoy = await IntentoEnvioModel.obtenerParticipantesConEnvioExitosoEnRango(
      servicio.id,
      inicioDeHoy,
      finDeHoy
    );
    const intentosDelServicio: {
      participanteId: number;
      numeroRecordatorio: number;
      resultado: 'exitoso' | 'fallido';
    }[] = [];

    for (const participante of elegibles) {
      resumen.participantes_evaluados += 1;

      if (yaRespondieron.has(participante.id)) {
        resumen.ya_confirmados += 1;
        continue;
      }

      const conteo = conteosIntentos.get(participante.id) ?? { exitosos: 0, total: 0 };
      if (conteo.exitosos >= BUSINESS_CONSTANTS.MAX_RECORDATORIOS_EXITOSOS) {
        resumen.ya_completados += 1;
        continue;
      }

      if (enviadosHoy.has(participante.id)) {
        resumen.ya_enviado_hoy += 1;
        continue;
      }

      const numeroRecordatorio = conteo.total + 1;
      const horaServicioStr = (
        typeof servicio.hora_servicio === 'string' ? servicio.hora_servicio : '00:00'
      ).slice(0, 5);
      const horaLlegadaStr = calcularHoraLlegada(horaServicioStr, participante.grupo_nombre);
      const fechaServicioStr = formatDateYMD(servicio.fecha_servicio);
      const fechaCierreStr = formatDateYMD(servicio.fecha_cierre_confirmacion);
      const nombreCompleto = construirNombreCompleto(
        participante.nombre,
        participante.primer_apellido,
        participante.segundo_apellido
      );
      const token = generarToken(participante.id, servicio.id);

      const ics = generarIcs({
        servicioId: servicio.id,
        participanteId: participante.id,
        nombreServicio: servicio.nombre,
        fechaServicioYMD: fechaServicioStr,
        horaServicioHHMM: horaServicioStr,
        horaLlegadaHHMM: horaLlegadaStr,
        bufferLlegadaHoras: obtenerBufferLlegadaHoras(participante.grupo_nombre),
      });

      const html = renderRecordatorioHtml({
        participanteNombre: nombreCompleto,
        servicioNombre: servicio.nombre,
        fechaServicio: fechaServicioStr,
        horaLlegada: horaLlegadaStr,
        fechaCierre: fechaCierreStr,
        token,
      });

      let exito: boolean;
      try {
        exito = await mailer.enviar({
          to: participante.correo,
          subject: `Recordatorio: confirma tu asistencia - ${servicio.nombre}`,
          html,
          icsContent: ics,
          icsFilename: `servicio-${servicio.id}.ics`,
        });
      } catch (error) {
        console.error('[recordatoriosService] Error inesperado al enviar recordatorio', error);
        exito = false;
      }

      intentosDelServicio.push({
        participanteId: participante.id,
        numeroRecordatorio,
        resultado: exito ? 'exitoso' : 'fallido',
      });

      if (exito) {
        resumen.recordatorios_exitosos += 1;
      } else {
        resumen.recordatorios_fallidos += 1;
      }
    }

    await IntentoEnvioModel.registrarLote(servicio.id, intentosDelServicio);
  }

  return resumen;
}
