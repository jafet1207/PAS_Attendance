import { Request, Response } from 'express';
import { decodificarToken } from '../tokens/index.js';
import { obtenerMailerActivo } from '../mailer/index.js';
import { ParticipanteModel } from '../models/participante.model.js';
import { ServicioModel } from '../models/servicio.model.js';
import { RespuestaModel } from '../models/respuesta.model.js';
import { GrupoModel } from '../models/grupo.model.js';
import { BUSINESS_CONSTANTS } from '../config/env.js';
import {
  formatDateYMD,
  formatearNombreServicio,
  construirNombreCompleto,
  hoyEnCostaRica,
} from '../services/serviciosService.js';

// Estas páginas son HTML crudo (sin JSX) y públicas, sin autenticación. Cualquier valor que
// provenga de un campo de texto libre (ej. el nombre del participante, capturado en la Etapa 3
// sin sanitizar) debe escaparse antes de interpolarse aquí, o queda expuesto a XSS almacenado
// contra cualquier persona que abra su enlace de confirmación.
export function escapeHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Plantilla de CORREO (no de página web): estilos 100% inline, sin <style>/clases CSS. Varios
// clientes de correo (comprobado en Gmail) ignoran o eliminan bloques <style>, lo que dejaba
// los botones y el resto del diseño sin ningún estilo (texto azul plano de enlace, sin fondo
// ni bordes). Las páginas web públicas (`renderBaseHtml`, más abajo) sí pueden usar clases
// porque las renderiza un navegador, no un cliente de correo.
export const EMAIL_ESTILOS = {
  body: "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background:#F9F7F3; padding:12px; margin:0; color:#1C1C18;",
  card: 'max-width:480px;margin:0 auto;background:#FFFFFF;border:1px solid #E5DFD5;border-radius:16px;padding:22px 20px;text-align:center;',
  h1: 'font-size:20px;color:#2E5A44;margin:0 0 8px;',
  p: 'font-size:14px;color:#5C5852;line-height:1.4;margin:0 0 10px;',
  details: 'background:#F6F3ED;border-radius:12px;padding:12px 14px;margin:12px 0;text-align:left;font-size:13px;',
  detailRow: 'margin:4px 0;',
  detailRowSecondary: 'margin:4px 0;color:#8C867E;font-weight:400;',
  callout: 'background:#EBF3EE;border-radius:12px;padding:10px 16px;margin:10px 0;text-align:center;',
  calloutLabel: 'display:block;font-size:11px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;color:#2E5A44;margin-bottom:2px;',
  calloutTime: 'font-size:21px;font-weight:800;color:#2E5A44;',
  btnPrimary: 'display:block;box-sizing:border-box;width:100%;padding:11px;border-radius:12px;font-size:15px;font-weight:600;text-decoration:none;margin-bottom:8px;background:#2E5A44;color:#FFFFFF;',
  btnDanger: 'display:block;box-sizing:border-box;width:100%;padding:11px;border-radius:12px;font-size:15px;font-weight:600;text-decoration:none;margin-bottom:8px;background:#FBF0EB;color:#B25E46;border:1px solid #E5C3B6;',
  footer: 'font-size:12px;color:#8C867E;margin-top:8px;',
  link: 'color:#2E5A44;',
};

/** Envoltorio común de los correos (tarjeta centrada), con los mismos estilos inline. */
export function renderEmailHtml(titulo: string, contenidoInterior: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>${titulo}</title></head>
<body style="${EMAIL_ESTILOS.body}">
  <div style="${EMAIL_ESTILOS.card}">
    ${contenidoInterior}
  </div>
</body>
</html>`;
}

// RN-2: la ventana de confirmación permanece abierta hasta el día de cierre inclusive
// (hoy <= fecha_cierre_confirmacion). Es una regla distinta a RN-3 (estado del dashboard,
// que usa "<" estricto) porque responde a una pregunta diferente: "¿puedo confirmar hoy?"
// contra "¿cómo se ve el badge del servicio?".
export function ventanaDeConfirmacionAbierta(fechaCierreStr: string): boolean {
  const hoyStr = hoyEnCostaRica();
  return hoyStr <= fechaCierreStr;
}

/**
 * Redondea un buffer expresado en horas al minuto más cercano (también en horas). Única fuente
 * de verdad del redondeo: la usan tanto el texto mostrado (`calcularHoraLlegada`) como el
 * adjunto de calendario `.ics` (`recordatoriosService.generarIcs`), para que ambos usen
 * exactamente el mismo instante de llegada incluso si algún grupo llega a configurarse con un
 * buffer que no sea ya un número entero de minutos (ej. 1.51h).
 */
export function redondearBufferAMinutos(horas: number): number {
  return Math.round(horas * 60) / 60;
}

/** RN-8: horas de anticipación de llegada según el grupo (1.5 por defecto si no está definido). */
export function obtenerBufferLlegadaHoras(grupoNombre: string): number {
  return redondearBufferAMinutos(BUSINESS_CONSTANTS.BUFFER_LLEGADA_HORAS[grupoNombre] || 1.5);
}

export function calcularHoraLlegada(horaServicioStr: string, grupoNombre: string): string {
  const [h, m] = (horaServicioStr.slice(0, 5) || '00:00').split(':').map((x) => parseInt(x, 10));
  const bufferHoras = obtenerBufferLlegadaHoras(grupoNombre);
  const totalMinutos = (h || 0) * 60 + (m || 0) - Math.round(bufferHoras * 60);
  const minutosNormalizados = (totalMinutos + 24 * 60) % (24 * 60);
  const llegadaH = Math.floor(minutosNormalizados / 60);
  const llegadaM = minutosNormalizados % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(llegadaH)}:${pad(llegadaM)}`;
}

/** "09:00" -> "9:00 AM" (formato de 12 horas, consistente con el resto de la interfaz). */
export function formatearHora12(horaHHMM: string): string {
  const [h, m] = horaHHMM.split(':').map((x) => parseInt(x, 10));
  const periodo = h >= 12 ? 'PM' : 'AM';
  const hora12 = h % 12 === 0 ? 12 : h % 12;
  return `${hora12}:${String(m).padStart(2, '0')} ${periodo}`;
}

/**
 * Exportado para que el correo de recordatorio (`recordatoriosService.ts`) use exactamente la
 * misma plantilla y estilos que las páginas públicas de confirmación — mismo look en ambos
 * correos que recibe un participante.
 */
export function renderBaseHtml(titulo: string, contenido: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titulo} - Confirmación de Asistencia</title>
  <style>
    :root {
      --primary: #2E5A44;
      --primary-hover: #244736;
      --primary-light: #EBF3EE;
      --danger: #B25E46;
      --danger-hover: #964D37;
      --danger-light: #FBF0EB;
      --bg: #F9F7F3;
      --card-bg: #FFFFFF;
      --text: #1C1C18;
      --text-muted: #5C5852;
      --border: #E5DFD5;
      --radius: 16px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 32px 24px;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      text-align: center;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .badge-primary { background: var(--primary-light); color: var(--primary); }
    .badge-danger { background: var(--danger-light); color: var(--danger); }
    .badge-neutral { background: #EFECE6; color: var(--text-muted); }
    h1 { font-size: 24px; color: var(--primary); margin-bottom: 12px; font-weight: 700; }
    p { font-size: 15px; color: var(--text-muted); line-height: 1.5; margin-bottom: 16px; }
    .details {
      background: #F6F3ED;
      border-radius: 12px;
      padding: 18px;
      margin: 20px 0;
      text-align: left;
    }
    .details-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 14px;
      border-bottom: 1px solid #ECE7DE;
    }
    .details-row:last-child { border-bottom: none; }
    .details-label { color: var(--text-muted); }
    .details-value { font-weight: 600; color: var(--text); }
    .details-value-secondary { font-weight: 400; color: var(--text-muted); font-size: 13px; }
    .highlight { color: var(--primary); font-weight: 700; }
    .arrival-callout {
      background: var(--primary-light);
      border-radius: 12px;
      padding: 14px 18px;
      margin: 16px 0;
      text-align: center;
    }
    .arrival-callout .arrival-label {
      display: block;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      color: var(--primary);
      margin-bottom: 4px;
    }
    .arrival-callout .arrival-time { font-size: 24px; font-weight: 800; color: var(--primary); }
    .btn {
      display: block;
      width: 100%;
      padding: 14px;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      text-decoration: none;
      border: none;
      cursor: pointer;
      transition: background 0.2s ease;
      margin-bottom: 12px;
    }
    .btn-primary { background: var(--primary); color: #FFF; }
    .btn-primary:hover { background: var(--primary-hover); }
    .btn-danger { background: var(--danger-light); color: var(--danger); border: 1px solid #E5C3B6; }
    .btn-danger:hover { background: #F3DDD3; }
    .footer-note { font-size: 12px; color: #8C867E; margin-top: 16px; }
    .status-icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px auto;
      font-size: 28px;
    }
    .status-icon-success { background: var(--primary-light); color: var(--primary); }
    .status-icon-danger { background: var(--danger-light); color: var(--danger); }
    .status-icon-error { background: #FCE8E6; color: #C5221F; }
  </style>
</head>
<body>
  <div class="card">
    ${contenido}
  </div>
</body>
</html>`;
}

export function renderErrorHtml(mensaje: string, detalle?: string): string {
  const contenido = `
    <div class="status-icon status-icon-error">✕</div>
    <h1 style="color: #C5221F;">Enlace no válido</h1>
    <p>${mensaje}</p>
    ${detalle ? `<p style="font-size: 13px; color: #8C867E;">${detalle}</p>` : ''}
  `;
  return renderBaseHtml('Error', contenido);
}

export function renderVentanaCerradaHtml(
  participanteNombre: string,
  fechaCierre: string,
  respuestaExistente?: string
): string {
  const contenido = `
    <div class="status-icon status-icon-danger">🔒</div>
    <span class="badge badge-neutral">Período Finalizado</span>
    <h1>Confirmación Cerrada</h1>
    <p>Hola <strong>${participanteNombre}</strong>, el período de confirmación para este servicio cerró el <strong>${fechaCierre}</strong>.</p>
    ${
      respuestaExistente
        ? `<div class="details">
            <div class="details-row">
              <span class="details-label">Tu respuesta registrada:</span>
              <span class="details-value highlight">${respuestaExistente}</span>
            </div>
           </div>`
        : '<p style="font-size: 13px;">No se registró una confirmación antes de la fecha límite.</p>'
    }
  `;
  return renderBaseHtml('Confirmación Cerrada', contenido);
}

export function renderConfirmacionExitosaHtml(
  participanteNombre: string,
  servicioNombre: string,
  fechaServicio: string,
  horaServicio: string,
  horaLlegada: string,
  grupoNombre: string,
  respuesta: 'Sí' | 'No',
  fechaCierre: string,
  esCambio: boolean
): string {
  const esSi = respuesta === 'Sí';
  const contenido = `
    <div class="status-icon ${esSi ? 'status-icon-success' : 'status-icon-danger'}">
      ${esSi ? '✓' : '✗'}
    </div>
    <span class="badge ${esSi ? 'badge-primary' : 'badge-danger'}">
      ${esCambio ? 'Respuesta Actualizada' : 'Respuesta Registrada'}
    </span>
    <h1>${esSi ? '¡Asistencia Confirmada!' : 'Respuesta Registrada'}</h1>
    <p>Hola <strong>${participanteNombre}</strong>, hemos guardado tu respuesta: <strong style="color: ${esSi ? 'var(--primary)' : 'var(--danger)'};">${respuesta}</strong>.</p>

    ${
      esSi
        ? `<div class="arrival-callout">
            <span class="arrival-label">Hora de llegada requerida</span>
            <span class="arrival-time">${formatearHora12(horaLlegada)}</span>
          </div>`
        : ''
    }

    <div class="details">
      <div class="details-row">
        <span class="details-label">Servicio:</span>
        <span class="details-value">${servicioNombre}</span>
      </div>
      <div class="details-row">
        <span class="details-label">Grupo:</span>
        <span class="details-value">${grupoNombre}</span>
      </div>
      <div class="details-row">
        <span class="details-label">Fecha:</span>
        <span class="details-value">${fechaServicio}</span>
      </div>
      <div class="details-row">
        <span class="details-label">Hora de inicio del servicio:</span>
        <span class="details-value-secondary">${formatearHora12(horaServicio)}</span>
      </div>
    </div>

    <p class="footer-note">
      ${
        esSi
          ? `Puedes modificar tu respuesta antes del ${fechaCierre} si surge algún imprevisto.`
          : `Gracias por informarnos con tiempo. Puedes cambiar tu respuesta antes del ${fechaCierre} si tu disponibilidad cambia.`
      }
    </p>
  `;
  return renderBaseHtml('Confirmación Guardada', contenido);
}

/**
 * Versión de CORREO (estilos inline) del acuse de recibo — mismo diseño que el correo de
 * recordatorio (`recordatoriosService.renderRecordatorioHtml`), consistente entre ambos.
 * `renderConfirmacionExitosaHtml` (arriba) sigue usándose para la página web que ve el
 * participante justo después de responder.
 */
export function renderAcuseDeReciboEmailHtml(
  participanteNombre: string,
  servicioNombre: string,
  fechaServicio: string,
  horaServicio: string,
  horaLlegada: string,
  grupoNombre: string,
  respuesta: 'Sí' | 'No',
  fechaCierre: string
): string {
  const esSi = respuesta === 'Sí';
  const contenido = `
    <h1 style="${EMAIL_ESTILOS.h1}">${esSi ? '¡Asistencia Confirmada!' : 'Respuesta Registrada'}</h1>
    <p style="${EMAIL_ESTILOS.p}">Hola <strong>${escapeHtml(participanteNombre)}</strong>, hemos guardado tu respuesta: <strong>${respuesta}</strong>.</p>

    ${
      esSi
        ? `<div style="${EMAIL_ESTILOS.callout}">
            <span style="${EMAIL_ESTILOS.calloutLabel}">Hora de llegada requerida</span>
            <span style="${EMAIL_ESTILOS.calloutTime}">${formatearHora12(horaLlegada)}</span>
          </div>`
        : ''
    }

    <div style="${EMAIL_ESTILOS.details}">
      <p style="${EMAIL_ESTILOS.detailRow}"><strong>Servicio:</strong> ${escapeHtml(servicioNombre)}</p>
      <p style="${EMAIL_ESTILOS.detailRow}"><strong>Grupo:</strong> ${escapeHtml(grupoNombre)}</p>
      <p style="${EMAIL_ESTILOS.detailRow}"><strong>Fecha:</strong> ${fechaServicio}</p>
      <p style="${EMAIL_ESTILOS.detailRowSecondary}"><strong>Hora de inicio del servicio:</strong> ${formatearHora12(horaServicio)}</p>
    </div>

    <p style="${EMAIL_ESTILOS.footer}">
      ${
        esSi
          ? `Puedes modificar tu respuesta antes del ${fechaCierre} si surge algún imprevisto.`
          : `Gracias por informarnos con tiempo. Puedes cambiar tu respuesta antes del ${fechaCierre} si tu disponibilidad cambia.`
      }
    </p>
  `;
  return renderEmailHtml('Confirmación Guardada', contenido);
}

export function renderFormularioConfirmacionHtml(
  token: string,
  participanteNombre: string,
  servicioNombre: string,
  fechaServicio: string,
  horaServicio: string,
  horaLlegada: string,
  grupoNombre: string,
  fechaCierre: string,
  respuestaActual?: 'Sí' | 'No'
): string {
  const contenido = `
    <span class="badge badge-primary">${grupoNombre}</span>
    <h1>Confirmación de Asistencia</h1>
    <p>Hola <strong>${participanteNombre}</strong>, por favor confirma tu participación en el siguiente servicio:</p>

    <div class="arrival-callout">
      <span class="arrival-label">Hora de llegada requerida</span>
      <span class="arrival-time">${formatearHora12(horaLlegada)}</span>
    </div>

    <div class="details">
      <div class="details-row">
        <span class="details-label">Servicio:</span>
        <span class="details-value">${servicioNombre}</span>
      </div>
      <div class="details-row">
        <span class="details-label">Fecha:</span>
        <span class="details-value">${fechaServicio}</span>
      </div>
      <div class="details-row">
        <span class="details-label">Hora de inicio del servicio:</span>
        <span class="details-value-secondary">${formatearHora12(horaServicio)}</span>
      </div>
      <div class="details-row">
        <span class="details-label">Fecha límite:</span>
        <span class="details-value">${fechaCierre}</span>
      </div>
      ${
        respuestaActual
          ? `<div class="details-row">
              <span class="details-label">Tu estado actual:</span>
              <span class="details-value highlight">${respuestaActual}</span>
            </div>`
          : ''
      }
    </div>

    <form method="POST" action="/confirm/${token}">
      <button type="submit" name="respuesta" value="Sí" class="btn btn-primary">
        ✓ Sí, voy a asistir
      </button>
      <button type="submit" name="respuesta" value="No" class="btn btn-danger">
        ✗ No podré asistir
      </button>
    </form>

    <p class="footer-note">
      Puedes registrar o modificar tu respuesta antes del ${fechaCierre}.
    </p>
  `;
  return renderBaseHtml('Confirmar Asistencia', contenido);
}

interface ContextoConfirmacion {
  participanteId: number;
  servicioId: number;
  participanteNombre: string;
  participanteCorreo: string;
  grupoNombre: string;
  servicioNombre: string;
  fechaServicioStr: string;
  horaServicioStr: string;
  horaLlegadaStr: string;
  fechaCierreStr: string;
}

/**
 * Resuelve y valida el token, el participante y el servicio. Devuelve el contexto listo
 * para renderizar, o `null` si ya se envió una respuesta de error/404 al cliente.
 */
async function resolverContexto(
  token: string,
  res: Response
): Promise<ContextoConfirmacion | null> {
  const { participanteId, servicioId } = decodificarToken(token);

  if (!participanteId || !servicioId) {
    res.status(400).send(renderErrorHtml('El enlace de confirmación no es válido o ha expirado.'));
    return null;
  }

  const participante = await ParticipanteModel.getById(participanteId);
  const servicio = await ServicioModel.getById(servicioId);

  if (!participante || !servicio) {
    res.status(404).send(renderErrorHtml('El participante o el servicio convocado ya no existen en el sistema.'));
    return null;
  }

  const grupo = await GrupoModel.getById(participante.grupo_id);
  const grupoNombre = grupo?.nombre || '';

  const fechaServicioStr = formatDateYMD(servicio.fecha_servicio);
  const horaServicioStr = (typeof servicio.hora_servicio === 'string' ? servicio.hora_servicio : '00:00').slice(0, 5);
  const horaLlegadaStr = calcularHoraLlegada(horaServicioStr, grupoNombre);
  const servicioNombre = formatearNombreServicio(servicio.fecha_servicio, servicio.tipo);
  const fechaCierreStr = formatDateYMD(servicio.fecha_cierre_confirmacion);

  return {
    participanteId,
    servicioId,
    participanteNombre: escapeHtml(
      construirNombreCompleto(
        participante.nombre,
        participante.primer_apellido,
        participante.segundo_apellido
      )
    ),
    participanteCorreo: participante.correo,
    grupoNombre,
    servicioNombre,
    fechaServicioStr,
    horaServicioStr,
    horaLlegadaStr,
    fechaCierreStr,
  };
}

export class ConfirmController {
  static async getForm(req: Request, res: Response): Promise<void> {
    const contexto = await resolverContexto(req.params.token, res);
    if (!contexto) return;

    const respuestaExistente = await RespuestaModel.getByParticipanteServicio(
      contexto.participanteId,
      contexto.servicioId
    );

    if (!ventanaDeConfirmacionAbierta(contexto.fechaCierreStr)) {
      res
        .status(200)
        .send(
          renderVentanaCerradaHtml(
            contexto.participanteNombre,
            contexto.fechaCierreStr,
            respuestaExistente?.respuesta
          )
        );
      return;
    }

    res
      .status(200)
      .send(
        renderFormularioConfirmacionHtml(
          req.params.token,
          contexto.participanteNombre,
          contexto.servicioNombre,
          contexto.fechaServicioStr,
          contexto.horaServicioStr,
          contexto.horaLlegadaStr,
          contexto.grupoNombre,
          contexto.fechaCierreStr,
          respuestaExistente?.respuesta
        )
      );
  }

  static async submitForm(req: Request, res: Response): Promise<void> {
    const rawRespuesta = req.body?.respuesta || req.body?.accion;

    let normalizada: 'Sí' | 'No' | null = null;
    if (typeof rawRespuesta === 'string') {
      const lower = rawRespuesta.trim().toLowerCase();
      if (['si', 'sí', 'yes', 'true', '1'].includes(lower)) {
        normalizada = 'Sí';
      } else if (['no', 'false', '0'].includes(lower)) {
        normalizada = 'No';
      }
    }

    if (!normalizada) {
      res.status(400).send(renderErrorHtml('La respuesta indicada no es válida. Debe ser "Sí" o "No".'));
      return;
    }

    const contexto = await resolverContexto(req.params.token, res);
    if (!contexto) return;

    if (!ventanaDeConfirmacionAbierta(contexto.fechaCierreStr)) {
      const respuestaExistente = await RespuestaModel.getByParticipanteServicio(
        contexto.participanteId,
        contexto.servicioId
      );
      res
        .status(400)
        .send(
          renderVentanaCerradaHtml(
            contexto.participanteNombre,
            contexto.fechaCierreStr,
            respuestaExistente?.respuesta
          )
        );
      return;
    }

    const resultado = await RespuestaModel.registrar(
      contexto.participanteId,
      contexto.servicioId,
      normalizada
    );

    // RN-10: cuando resultado.debeNotificar es true, se envía un correo de acuse de recibo
    // (alta o cambio de respuesta). Es asíncrono/"fire and forget": no bloquea la respuesta
    // HTML al participante, y un fallo de envío no debe romper la confirmación ya registrada.
    if (resultado.debeNotificar && contexto.participanteCorreo) {
      const htmlAcuse = renderAcuseDeReciboEmailHtml(
        contexto.participanteNombre,
        contexto.servicioNombre,
        contexto.fechaServicioStr,
        contexto.horaServicioStr,
        contexto.horaLlegadaStr,
        contexto.grupoNombre,
        resultado.respuesta,
        contexto.fechaCierreStr
      );
      obtenerMailerActivo()
        .enviar({
          to: contexto.participanteCorreo,
          subject: resultado.esCambio ? 'Actualizaste tu respuesta de asistencia' : 'Confirmación de asistencia registrada',
          html: htmlAcuse,
        })
        .catch((error) => {
          console.error('[ConfirmController.submitForm] Error al enviar el acuse de recibo', error);
        });
    }

    res
      .status(200)
      .send(
        renderConfirmacionExitosaHtml(
          contexto.participanteNombre,
          contexto.servicioNombre,
          contexto.fechaServicioStr,
          contexto.horaServicioStr,
          contexto.horaLlegadaStr,
          contexto.grupoNombre,
          resultado.respuesta,
          contexto.fechaCierreStr,
          resultado.esCambio
        )
      );
  }

  static async quickAction(req: Request, res: Response): Promise<void> {
    req.body = { respuesta: req.params.accion };
    return ConfirmController.submitForm(req, res);
  }
}
