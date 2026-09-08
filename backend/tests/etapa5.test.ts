import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { Request } from 'express';
import { createApp } from '../src/app.js';
import { config } from '../src/config/env.js';
import { generarIcs, ejecutarCicloDeRecordatorios } from '../src/services/recordatoriosService.js';
import { opcionesDesdeCuerpo, SolicitudInvalidaError } from '../src/controllers/remindersController.js';
import { estaEnVentanaDeEnvioRecordatorio } from '../src/services/serviciosService.js';
import { ScriptedMailer, MockMailer, GmailMailer, Mailer } from '../src/mailer/index.js';
import { RespuestaModel } from '../src/models/respuesta.model.js';
import { query } from '../src/db/index.js';

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('Etapa 5: Reglas de dominio en memoria', () => {
  it('generarIcs produce un VCALENDAR válido (RFC 5545) con CRLF y datos escapados', () => {
    const ics = generarIcs({
      servicioId: 1,
      participanteId: 2,
      nombreServicio: 'Servicio Regular, con coma; y punto y coma',
      fechaServicioYMD: '2026-09-13',
      horaServicioHHMM: '09:00',
      horaLlegadaHHMM: '07:30',
      bufferLlegadaHoras: 1.5,
    });

    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('VERSION:2.0\r\n');
    expect(ics).toContain('BEGIN:VEVENT\r\n');
    expect(ics).toContain('UID:servicio-1-participante-2@pas-attendance\r\n');
    expect(ics).toContain('DTSTART:20260913T133000Z\r\n'); // 07:30 CR (UTC-6) -> 13:30 UTC
    expect(ics).toContain('DTEND:20260913T170000Z\r\n'); // 09:00 CR + 2h -> 11:00 CR -> 17:00 UTC
    expect(ics).toContain('SUMMARY:Servicio Regular\\, con coma\\; y punto y coma\r\n');
    expect(ics.trim().endsWith('END:VCALENDAR')).toBe(true);
  });

  it('generarIcs no invierte DTSTART/DTEND cuando el buffer de llegada cruza la medianoche', () => {
    // Servicio a las 00:30 con un buffer de 2h (Inducción): la llegada cae el día anterior a
    // las 22:30. Antes, generarIcs reparseaba la hora normalizada (22:30) sobre la MISMA fecha
    // calendario del servicio, produciendo un DTSTART posterior a DTEND (evento invertido).
    const ics = generarIcs({
      servicioId: 1,
      participanteId: 2,
      nombreServicio: 'Servicio de madrugada',
      fechaServicioYMD: '2026-09-13',
      horaServicioHHMM: '00:30',
      horaLlegadaHHMM: '22:30',
      bufferLlegadaHoras: 2,
    });

    expect(ics).toContain('DTSTART:20260913T043000Z\r\n'); // 12 Sep 22:30 CR (mismo instante) -> UTC
    expect(ics).toContain('DTEND:20260913T083000Z\r\n'); // 13 Sep 00:30 CR + 2h -> 02:30 CR -> UTC
    const inicioMs = Date.parse('2026-09-13T04:30:00Z');
    const finMs = Date.parse('2026-09-13T08:30:00Z');
    expect(inicioMs).toBeLessThan(finMs); // DTSTART antes que DTEND: el evento no se invierte
  });

  it('ScriptedMailer retorna los resultados del guion en orden y luego éxito por defecto', async () => {
    const mailer = new ScriptedMailer([true, false, true]);
    const correo = { to: 'a@test.com', subject: 's', html: '<p></p>' };
    expect(await mailer.enviar(correo)).toBe(true);
    expect(await mailer.enviar(correo)).toBe(false);
    expect(await mailer.enviar(correo)).toBe(true);
    expect(await mailer.enviar(correo)).toBe(true); // guion agotado -> éxito
  });

  it('MockMailer siempre reporta éxito sin enviar correos reales', async () => {
    const mailer = new MockMailer();
    expect(await mailer.enviar({ to: 'a@test.com', subject: 's', html: '<p></p>' })).toBe(true);
  });

  it('GmailMailer simula el envío (sin tocar SMTP real) cuando el destinatario no es @gmail.com', async () => {
    const mailer = new GmailMailer();
    expect(await mailer.enviar({ to: 'servidor@outlook.com', subject: 's', html: '<p></p>' })).toBe(true);
    expect(await mailer.enviar({ to: 'otro@hotmail.com', subject: 's', html: '<p></p>' })).toBe(true);
  });

  it('RN-13: estaEnVentanaDeEnvioRecordatorio solo es true dentro de la ventana RN-7 y con la ventana de confirmación abierta', () => {
    expect(estaEnVentanaDeEnvioRecordatorio(true, 2)).toBe(true);
    expect(estaEnVentanaDeEnvioRecordatorio(true, 1)).toBe(true);
    expect(estaEnVentanaDeEnvioRecordatorio(true, 0)).toBe(true);
    expect(estaEnVentanaDeEnvioRecordatorio(true, 5)).toBe(false); // fuera de la ventana de envío
    expect(estaEnVentanaDeEnvioRecordatorio(false, 0)).toBe(false); // ventana de confirmación ya cerrada
  });

  it('RN-13: opcionesDesdeCuerpo acota servicioIds con sesión de coordinador aunque NODE_ENV no sea "test"', () => {
    const nodeEnvOriginal = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const reqConSesion = {
        session: { coordinador_autenticado: true },
        body: { servicioIds: [7], participanteIds: [9] },
      } as unknown as Request;
      // participanteIds sigue exclusivo de pruebas: una sesión de coordinador solo habilita servicioIds.
      expect(opcionesDesdeCuerpo(reqConSesion)).toEqual({ servicioIds: [7] });

      const reqSinSesion = { session: undefined, body: { servicioIds: [7] } } as unknown as Request;
      expect(opcionesDesdeCuerpo(reqSinSesion)).toEqual({});
    } finally {
      process.env.NODE_ENV = nodeEnvOriginal;
    }
  });

  it('RN-13: opcionesDesdeCuerpo rechaza servicioIds no numéricos en vez de convertirlos en NaN', () => {
    const reqConSesion = {
      session: { coordinador_autenticado: true },
      body: { servicioIds: ['abc'] },
    } as unknown as Request;
    expect(() => opcionesDesdeCuerpo(reqConSesion)).toThrow(SolicitudInvalidaError);
  });
});

// Estas pruebas insertan participantes y servicios reales contra TEST_DATABASE_URL (mismo
// criterio que las etapas 2-4: no se limpia la base, las filas quedan para revisión manual).
// `ejecutarCicloDeRecordatorios` recibe `servicioIds`/`participanteIds` para acotar el barrido
// a las filas creadas por la prueba y no reprocesar todos los participantes/servicios reales
// ya existentes; ese acotamiento es exclusivo de pruebas y no está expuesto por el endpoint HTTP.
describe('Etapa 5: Flujo de éxito contra base de datos real', () => {
  let app: ReturnType<typeof createApp>;
  let agent: ReturnType<typeof request.agent>;

  async function crearParticipante(grupoId: number, sufijo: string) {
    const correo = `prueba.etapa5.${sufijo}.${Date.now()}.${Math.random().toString(36).slice(2)}@ejemplo-sintetico.test`;
    const res = await agent
      .post('/api/participants')
      .send({ nombre: 'Prueba', primer_apellido: 'EtapaCinco', correo, grupo_id: grupoId });
    return res.body.data.id as number;
  }

  // A diferencia de crearParticipante, el correo puede ya existir (p. ej. config.gmailUser, si
  // el coordinador ya lo dio de alta a mano para probar el envío real) — el correo es único
  // (RN de esquema), así que en ese caso se reutiliza el participante existente en vez de fallar.
  async function crearParticipanteConCorreo(grupoId: number, correo: string) {
    const res = await agent
      .post('/api/participants')
      .send({ nombre: 'Prueba', primer_apellido: 'EtapaCincoGmail', correo, grupo_id: grupoId });
    if (res.status === 201 || res.status === 200) {
      return res.body.data.id as number;
    }
    const lista = await agent.get('/api/participants');
    const existente = lista.body.data.find((p: { email: string }) => p.email === correo);
    if (!existente) throw new Error(`No se pudo crear ni encontrar al participante con correo ${correo}`);
    return existente.id as number;
  }

  async function crearServicioAbierto() {
    // Cierre a 1 día (dentro de la ventana de envío de recordatorios, RN-7: 2/1/0 días antes).
    const res = await agent.post('/api/services').send({
      fecha_servicio: addDays(2),
      hora_servicio: '09:00',
      fecha_cierre_confirmacion: addDays(1),
      tipo: 'Regular',
    });
    return res.body.data.id as number;
  }

  async function crearServicioFueraDeVentanaDeEnvio() {
    // Ventana de confirmación abierta (RN-2), pero el cierre está a 5 días — fuera de la
    // ventana de envío de recordatorios (RN-7: solo 2, 1 o 0 días antes).
    const res = await agent.post('/api/services').send({
      fecha_servicio: addDays(6),
      hora_servicio: '09:00',
      fecha_cierre_confirmacion: addDays(5),
      tipo: 'Regular',
    });
    return res.body.data.id as number;
  }

  async function crearServicioConVentanaCerrada() {
    const res = await agent.post('/api/services').send({
      fecha_servicio: addDays(-1),
      hora_servicio: '09:00',
      fecha_cierre_confirmacion: addDays(-2),
      tipo: 'Regular',
    });
    return res.body.data.id as number;
  }

  beforeAll(async () => {
    app = createApp();
    agent = request.agent(app);
    await agent.post('/api/login').send({ password: config.coordinadorPassword });
  });

  it('RN-5: excluye a Líder/Director del barrido y solo evalúa al Servidor', async () => {
    const servidorId = await crearParticipante(1, 'servidor'); // Servidor
    const liderId = await crearParticipante(3, 'lider'); // Líder
    const servicioId = await crearServicioAbierto();

    const resumen = await ejecutarCicloDeRecordatorios({
      mailer: new ScriptedMailer([true]),
      servicioIds: [servicioId],
      participanteIds: [servidorId, liderId],
    });

    expect(resumen.servicios_procesados).toBe(1);
    expect(resumen.participantes_evaluados).toBe(1); // el líder ni se cuenta
    expect(resumen.recordatorios_exitosos).toBe(1);
    expect(resumen.recordatorios_fallidos).toBe(0);
  });

  it('RN-6: tope de 3 recordatorios exitosos por participante/servicio (a lo largo de varios días)', async () => {
    const servidorId = await crearParticipante(1, 'tope');
    const servicioId = await crearServicioAbierto();
    const opciones = { servicioIds: [servicioId], participanteIds: [servidorId] };

    // Simula 2 recordatorios exitosos ya enviados en días anteriores: no se puede lograr esto
    // llamando al ciclo varias veces en la misma corrida, porque la regla de "no reenviar al
    // mismo servidor el mismo día" (ver ajuste de hora de envío) lo impediría.
    await query(
      `
      INSERT INTO Intento_Envio (participante_id, servicio_id, numero_recordatorio, resultado, timestamp)
      VALUES ($1, $2, 1, 'exitoso', NOW() - interval '2 days'),
             ($1, $2, 2, 'exitoso', NOW() - interval '1 day')
    `,
      [servidorId, servicioId]
    );

    const r3 = await ejecutarCicloDeRecordatorios({ ...opciones, mailer: new ScriptedMailer([true]) });
    expect(r3.recordatorios_exitosos).toBe(1); // el tercero (hoy) alcanza el tope de 3

    const r4 = await ejecutarCicloDeRecordatorios({ ...opciones, mailer: new ScriptedMailer([true]) });
    expect(r4.recordatorios_exitosos).toBe(0);
    expect(r4.ya_completados).toBe(1);
  });

  it('No reenvía al mismo servidor el mismo día aunque el ciclo se vuelva a ejecutar (cambio de hora de envío)', async () => {
    const servidorId = await crearParticipante(1, 'mismo-dia');
    const servicioId = await crearServicioAbierto();
    const opciones = { servicioIds: [servicioId], participanteIds: [servidorId] };

    const r1 = await ejecutarCicloDeRecordatorios({ ...opciones, mailer: new ScriptedMailer([true]) });
    expect(r1.recordatorios_exitosos).toBe(1);

    const r2 = await ejecutarCicloDeRecordatorios({ ...opciones, mailer: new ScriptedMailer([true]) });
    expect(r2.recordatorios_exitosos).toBe(0);
    expect(r2.ya_enviado_hoy).toBe(1);
    expect(r2.ya_completados).toBe(0); // no es por haber alcanzado el tope, sino por el mismo día
  });

  it('Simula un fallo de envío: un intento fallido no consume el tope de 3 exitosos', async () => {
    const servidorId = await crearParticipante(1, 'fallo');
    const servicioId = await crearServicioAbierto();
    const opciones = { servicioIds: [servicioId], participanteIds: [servidorId] };

    const rFallido = await ejecutarCicloDeRecordatorios({ ...opciones, mailer: new ScriptedMailer([false]) });
    expect(rFallido.recordatorios_fallidos).toBe(1);
    expect(rFallido.recordatorios_exitosos).toBe(0);

    const rExitoso = await ejecutarCicloDeRecordatorios({ ...opciones, mailer: new ScriptedMailer([true]) });
    expect(rExitoso.recordatorios_exitosos).toBe(1);
  });

  it('RN-7: un servicio con la ventana de confirmación ya cerrada no se procesa', async () => {
    const servidorId = await crearParticipante(1, 'cerrado');
    const servicioId = await crearServicioConVentanaCerrada();

    const resumen = await ejecutarCicloDeRecordatorios({
      mailer: new ScriptedMailer([true]),
      servicioIds: [servicioId],
      participanteIds: [servidorId],
    });

    expect(resumen.servicios_procesados).toBe(0);
    expect(resumen.participantes_evaluados).toBe(0);
    expect(resumen.recordatorios_exitosos).toBe(0);
  });

  it('RN-7: un servicio con la ventana de confirmación abierta pero fuera de la ventana de envío (faltan más de 2 días) no se procesa', async () => {
    const servidorId = await crearParticipante(1, 'lejano');
    const servicioId = await crearServicioFueraDeVentanaDeEnvio();

    const resumen = await ejecutarCicloDeRecordatorios({
      mailer: new ScriptedMailer([true]),
      servicioIds: [servicioId],
      participanteIds: [servidorId],
    });

    expect(resumen.servicios_procesados).toBe(0);
    expect(resumen.participantes_evaluados).toBe(0);
    expect(resumen.recordatorios_exitosos).toBe(0);
  });

  // Solo corre cuando hay credenciales reales de Gmail configuradas en el entorno (igual que la
  // guardia de seguridad de las pruebas HTTP más abajo); en CI o sin GMAIL_USER/GMAIL_APP_PASSWORD
  // se omite automáticamente, nunca falla por su ausencia.
  const gmailConfigurado = Boolean(config.gmailUser && config.gmailAppPassword);

  /**
   * Envuelve un GmailMailer real pero solo deja pasar a SMTP real el primer destinatario
   * @gmail.com que vea; cualquier otro @gmail.com posterior se simula (sin tocar la red), para
   * no arriesgar varios envíos reales de golpe si esta prueba corre con múltiples destinatarios
   * @gmail.com sintéticos.
   */
  class GmailUnaVezMailer implements Mailer {
    enviosReales: string[] = [];
    private yaEnvioUnGmailReal = false;
    constructor(private readonly real: Mailer) {}

    async enviar(correo: { to: string; subject: string; html: string }): Promise<boolean> {
      const esGmail = correo.to.toLowerCase().endsWith('@gmail.com');
      if (esGmail && this.yaEnvioUnGmailReal) {
        return true; // ya se usó el único envío real permitido en esta prueba
      }
      if (esGmail) this.yaEnvioUnGmailReal = true;
      const resultado = await this.real.enviar(correo);
      if (esGmail) this.enviosReales.push(correo.to);
      return resultado;
    }
  }

  (gmailConfigurado ? it : it.skip)(
    'GmailMailer real: con varios destinatarios @gmail.com en la misma corrida, solo el primero recibe un envío real',
    async () => {
      const idReal = await crearParticipanteConCorreo(1, config.gmailUser);
      const idGmailExtra = await crearParticipanteConCorreo(
        1,
        `otro.prueba.etapa5.${Date.now()}@gmail.com`
      );
      const idNoGmail = await crearParticipante(1, 'no-gmail-junto-a-real');
      const servicioId = await crearServicioAbierto();

      const espia = new GmailUnaVezMailer(new GmailMailer());
      const resumen = await ejecutarCicloDeRecordatorios({
        mailer: espia,
        servicioIds: [servicioId],
        participanteIds: [idReal, idGmailExtra, idNoGmail],
      });

      expect(resumen.recordatorios_exitosos).toBe(3); // los 3 reportan éxito (1 real + 2 simulados)
      expect(espia.enviosReales).toEqual([config.gmailUser]); // solo el primer @gmail.com tocó SMTP real
    },
    20000
  );

  it('Lock del ciclo: una invocación concurrente se omite en vez de duplicar el envío', async () => {
    const servidorId = await crearParticipante(1, 'lock');
    const servicioId = await crearServicioAbierto();
    const opciones = { servicioIds: [servicioId], participanteIds: [servidorId] };

    // Mailer lento a propósito para garantizar que ambas invocaciones se solapen en el tiempo.
    const mailerLento: Mailer = {
      async enviar() {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return true;
      },
    };

    const [r1, r2] = await Promise.all([
      ejecutarCicloDeRecordatorios({ ...opciones, mailer: mailerLento }),
      ejecutarCicloDeRecordatorios({ ...opciones, mailer: mailerLento }),
    ]);

    const omitidas = [r1, r2].filter((r) => r.omitido_por_ejecucion_concurrente);
    const procesadas = [r1, r2].filter((r) => !r.omitido_por_ejecucion_concurrente);

    expect(omitidas.length).toBe(1);
    expect(procesadas.length).toBe(1);
    expect(procesadas[0].recordatorios_exitosos).toBe(1);
  });

  it('Omite a un participante que ya respondió (ya_confirmados) y no le envía recordatorio', async () => {
    const servidorId = await crearParticipante(1, 'respondio');
    const servicioId = await crearServicioAbierto();

    await RespuestaModel.registrar(servidorId, servicioId, 'Sí');

    const resumen = await ejecutarCicloDeRecordatorios({
      mailer: new ScriptedMailer([true]),
      servicioIds: [servicioId],
      participanteIds: [servidorId],
    });

    expect(resumen.ya_confirmados).toBe(1);
    expect(resumen.recordatorios_exitosos).toBe(0);
  });

  it('Sin participanteIds, evalúa a todos los participantes elegibles (no solo al de la prueba)', async () => {
    // Cubre la rama real de producción (ejecutarCicloDeRecordatorios sin ningún filtro procesa
    // TODOS los participantes elegibles). Se acota por servicioIds a un único servicio propio
    // de la prueba para que el costo quede limitado a los participantes reales existentes, en
    // vez de multiplicarlos también por todos los servicios abiertos de la base.
    await crearParticipante(1, 'sin-filtro-participantes');
    const servicioId = await crearServicioAbierto();

    const resumen = await ejecutarCicloDeRecordatorios({
      mailer: new ScriptedMailer([true]),
      servicioIds: [servicioId],
      // participanteIds deliberadamente omitido.
    });

    expect(resumen.servicios_procesados).toBe(1);
    // Más que solo el participante recién creado: confirma que no se aplicó ningún filtro.
    expect(resumen.participantes_evaluados).toBeGreaterThan(1);
  });

  it('RN-13: GET /api/services/:id/submissions expone reminderWindowOpen según RN-7', async () => {
    const servicioEnVentana = await crearServicioAbierto();
    const servicioFueraDeVentana = await crearServicioFueraDeVentanaDeEnvio();

    const resEnVentana = await agent.get(`/api/services/${servicioEnVentana}/submissions`);
    const resFueraDeVentana = await agent.get(`/api/services/${servicioFueraDeVentana}/submissions`);

    expect(resEnVentana.body.data.service.reminderWindowOpen).toBe(true);
    expect(resFueraDeVentana.body.data.service.reminderWindowOpen).toBe(false);
  });

  it('GET /api/enviar-recordatorios sin autenticación retorna 401', async () => {
    const res = await request(app).get('/api/enviar-recordatorios');
    expect(res.status).toBe(401);
  });

  it('GET /api/enviar-recordatorios con Bearer CRON_SECRET incorrecto retorna 401', async () => {
    const res = await request(app)
      .get('/api/enviar-recordatorios')
      .set('Authorization', 'Bearer clave-incorrecta');
    expect(res.status).toBe(401);
  });

  it('POST /api/enviar-recordatorios con sesión de coordinador y servicioIds no numéricos retorna 400', async () => {
    const res = await agent.post('/api/enviar-recordatorios').send({ servicioIds: ['no-es-un-id'] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/servicioIds/);
  });

  // RemindersController solo honra servicioIds/participanteIds en el cuerpo cuando
  // NODE_ENV === 'test' (ver remindersController.ts): así estas pruebas acotan el barrido a
  // sus propias filas en vez de reprocesar todos los servicios/participantes reales de la base
  // compartida en cada corrida de la suite, sin exponer ese acotamiento en producción.
  //
  // Guardia de seguridad adicional: aunque ya está acotado, si alguna vez hay credenciales de
  // Gmail configuradas en el entorno donde corre la suite, este intento sí enviaría un correo
  // real (al participante sintético de la prueba). Preferimos fallar explícitamente a arriesgar
  // ese envío silencioso.
  it('GET /api/enviar-recordatorios con Bearer CRON_SECRET correcto ejecuta el ciclo (200)', async () => {
    expect(
      config.gmailUser || config.gmailAppPassword,
      'GMAIL_USER/GMAIL_APP_PASSWORD no deben estar configurados al correr esta prueba.'
    ).toBeFalsy();

    const servidorId = await crearParticipante(1, 'http-get');
    const servicioId = await crearServicioAbierto();

    const res = await request(app)
      .get('/api/enviar-recordatorios')
      .set('Authorization', `Bearer ${config.cronSecret}`)
      .send({ servicioIds: [servicioId], participanteIds: [servidorId] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      servicios_procesados: 1,
      participantes_evaluados: 1,
      recordatorios_exitosos: 1,
      recordatorios_fallidos: 0,
      ya_completados: 0,
      ya_confirmados: 0,
      ya_enviado_hoy: 0,
    });
  });

  it('POST /api/enviar-recordatorios con sesión de coordinador activa ejecuta el ciclo (200)', async () => {
    expect(
      config.gmailUser || config.gmailAppPassword,
      'GMAIL_USER/GMAIL_APP_PASSWORD no deben estar configurados al correr esta prueba.'
    ).toBeFalsy();

    const servidorId = await crearParticipante(1, 'http-post');
    const servicioId = await crearServicioAbierto();

    const res = await agent
      .post('/api/enviar-recordatorios')
      .send({ servicioIds: [servicioId], participanteIds: [servidorId] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      servicios_procesados: 1,
      participantes_evaluados: 1,
      recordatorios_exitosos: 1,
      recordatorios_fallidos: 0,
      ya_completados: 0,
      ya_confirmados: 0,
      ya_enviado_hoy: 0,
    });
  });
});
