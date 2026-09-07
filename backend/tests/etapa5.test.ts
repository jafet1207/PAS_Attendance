import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { config } from '../src/config/env.js';
import { generarIcs, ejecutarCicloDeRecordatorios } from '../src/services/recordatoriosService.js';
import { ScriptedMailer, MockMailer, Mailer } from '../src/mailer/index.js';
import { RespuestaModel } from '../src/models/respuesta.model.js';

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

  async function crearServicioAbierto() {
    const res = await agent.post('/api/services').send({
      fecha_servicio: addDays(400),
      hora_servicio: '09:00',
      fecha_cierre_confirmacion: addDays(399),
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

  it('RN-6: tope de 3 recordatorios exitosos por participante/servicio', async () => {
    const servidorId = await crearParticipante(1, 'tope');
    const servicioId = await crearServicioAbierto();
    const opciones = { servicioIds: [servicioId], participanteIds: [servidorId] };

    const r1 = await ejecutarCicloDeRecordatorios({ ...opciones, mailer: new ScriptedMailer([true]) });
    const r2 = await ejecutarCicloDeRecordatorios({ ...opciones, mailer: new ScriptedMailer([true]) });
    const r3 = await ejecutarCicloDeRecordatorios({ ...opciones, mailer: new ScriptedMailer([true]) });
    const r4 = await ejecutarCicloDeRecordatorios({ ...opciones, mailer: new ScriptedMailer([true]) });

    expect([r1, r2, r3].every((r) => r.recordatorios_exitosos === 1)).toBe(true);
    expect(r4.recordatorios_exitosos).toBe(0);
    expect(r4.ya_completados).toBe(1);
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
    });
  });
});
