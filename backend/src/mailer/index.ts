import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

export interface EnvioCorreo {
  to: string;
  subject: string;
  html: string;
  icsContent?: string;
  icsFilename?: string;
}

export interface Mailer {
  enviar(correo: EnvioCorreo): Promise<boolean>;
}

/** Mailer de desarrollo: no envía correos reales, solo registra el intento en consola. */
export class MockMailer implements Mailer {
  async enviar(correo: EnvioCorreo): Promise<boolean> {
    console.log(`[MockMailer] Simulando envío a ${correo.to}: "${correo.subject}"`);
    return true;
  }
}

/**
 * Mailer determinista para pruebas: retorna los resultados de `guion` en el orden dado.
 * Si se agotan los valores del guion, los envíos siguientes se consideran exitosos.
 */
export class ScriptedMailer implements Mailer {
  private indice = 0;

  constructor(private readonly guion: boolean[]) {}

  async enviar(): Promise<boolean> {
    const resultado = this.indice < this.guion.length ? this.guion[this.indice] : true;
    this.indice += 1;
    return resultado;
  }
}

/** Mailer real vía Gmail SMTP (usa GMAIL_USER / GMAIL_APP_PASSWORD). */
export class GmailMailer implements Mailer {
  private transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: config.gmailUser, pass: config.gmailAppPassword },
  });

  async enviar(correo: EnvioCorreo): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: config.gmailUser,
        to: correo.to,
        subject: correo.subject,
        html: correo.html,
        attachments: correo.icsContent
          ? [
              {
                filename: correo.icsFilename || 'servicio.ics',
                content: correo.icsContent,
                contentType: 'text/calendar; method=PUBLISH',
              },
            ]
          : undefined,
      });
      return true;
    } catch (error) {
      console.error('[GmailMailer] Error al enviar correo', error);
      return false;
    }
  }
}

let mailerDePruebas: Mailer | null = null;

/**
 * Solo tiene efecto cuando `NODE_ENV === 'test'` (mismo patrón que `db/index.ts` para elegir
 * `TEST_DATABASE_URL`): permite que una prueba intercepte el mailer que usa `obtenerMailerActivo`
 * (p. ej. para verificar el acuse de recibo de `confirmController.submitForm`) sin depender de
 * red real ni de las credenciales de Gmail del entorno. Pasar `null` restaura el mailer normal.
 */
export function establecerMailerDePruebas(mailer: Mailer | null): void {
  if (process.env.NODE_ENV !== 'test') return;
  mailerDePruebas = mailer;
}

/** Selecciona el mailer activo: Gmail si hay credenciales configuradas, o Mock en su ausencia. */
export function obtenerMailerActivo(): Mailer {
  if (process.env.NODE_ENV === 'test' && mailerDePruebas) {
    return mailerDePruebas;
  }
  if (config.gmailUser && config.gmailAppPassword) {
    return new GmailMailer();
  }
  return new MockMailer();
}
