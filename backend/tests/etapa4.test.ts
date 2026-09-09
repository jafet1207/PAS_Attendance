import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { config } from '../src/config/env.js';
import { generarToken, decodificarToken } from '../src/tokens/index.js';
import {
  calcularHoraLlegada,
  ventanaDeConfirmacionAbierta,
  redondearBufferAMinutos,
} from '../src/controllers/confirmController.js';
import { generarIcs } from '../src/services/recordatoriosService.js';
import { RespuestaModel } from '../src/models/respuesta.model.js';
import { Mailer, GmailMailer, establecerMailerDePruebas } from '../src/mailer/index.js';
import { hoyEnCostaRica } from '../src/services/serviciosService.js';

// Ancla el desplazamiento al mismo "hoy" (Costa Rica, UTC-6) que usa la producción
// (`hoyEnCostaRica`), en vez de al día calendario UTC: entre las 6pm y medianoche hora de
// Costa Rica esos dos días calendario difieren, y un `addDays` en UTC generaría fixtures
// desalineados con la ventana real que el código bajo prueba calcula.
function addDays(days: number): string {
  const d = new Date(`${hoyEnCostaRica()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('Etapa 4: Reglas de dominio en memoria', () => {
  it('generarToken/decodificarToken hacen un viaje de ida y vuelta correcto', () => {
    const token = generarToken(42, 7);
    const decoded = decodificarToken(token);
    expect(decoded).toEqual({ participanteId: 42, servicioId: 7 });
  });

  it('decodificarToken retorna nulos ante un token inválido', () => {
    const decoded = decodificarToken('esto-no-es-un-token-valido');
    expect(decoded).toEqual({ participanteId: null, servicioId: null });
  });

  it('calcularHoraLlegada resta el buffer según el grupo (RN-8)', () => {
    expect(calcularHoraLlegada('09:00', 'Servidor')).toBe('07:30'); // 1.5h antes
    expect(calcularHoraLlegada('09:00', 'Inducción')).toBe('07:00'); // 2.0h antes
  });

  it('redondearBufferAMinutos evita un desajuste de sub-minuto entre el texto y el .ics', () => {
    // Regresión: un buffer que no cae en un número entero de minutos (1.51h = 90.6 min) debe
    // redondearse UNA sola vez, en un único lugar, para que el texto mostrado y el adjunto de
    // calendario .ics usen exactamente el mismo instante de llegada (antes, calcularHoraLlegada
    // redondeaba a 91 min mientras generarIcs restaba 90.6 min sin redondear).
    const bufferFraccionario = 1.51;
    const bufferRedondeado = redondearBufferAMinutos(bufferFraccionario);
    expect(bufferRedondeado * 60).toBe(91);

    const horaServicio = '09:00';
    const totalMinutos = 9 * 60 - Math.round(bufferRedondeado * 60); // 540 - 91 = 449
    const horaLlegada = `${String(Math.floor(totalMinutos / 60)).padStart(2, '0')}:${String(totalMinutos % 60).padStart(2, '0')}`;
    expect(horaLlegada).toBe('07:29');

    const ics = generarIcs({
      servicioId: 1,
      participanteId: 1,
      nombreServicio: 'Servicio de prueba',
      fechaServicioYMD: '2026-09-13',
      horaServicioHHMM: horaServicio,
      horaLlegadaHHMM: horaLlegada,
      bufferLlegadaHoras: bufferRedondeado,
    });

    // 09:00 CR (UTC-6) -> 15:00 UTC; menos los mismos 91 minutos -> 13:29 UTC.
    expect(ics).toContain('DTSTART:20260913T132900Z\r\n');
  });

  it('ventanaDeConfirmacionAbierta usa "hoy <= fecha_cierre" (RN-2, inclusive)', () => {
    const hoy = addDays(0);
    const ayer = addDays(-1);
    const manana = addDays(1);
    expect(ventanaDeConfirmacionAbierta(manana)).toBe(true);
    expect(ventanaDeConfirmacionAbierta(hoy)).toBe(true);
    expect(ventanaDeConfirmacionAbierta(ayer)).toBe(false);
  });
});

describe('Etapa 4: Rutas públicas de confirmación (sin datos válidos)', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    app = createApp();
  });

  it('GET /confirm/:token con token inválido retorna 400', async () => {
    const res = await request(app).get('/confirm/no-es-un-token');
    expect(res.status).toBe(400);
    expect(res.text).toContain('no es válido');
  });

  it('POST /confirm/:token con respuesta inválida retorna 400', async () => {
    const token = generarToken(1, 1);
    const res = await request(app).post(`/confirm/${token}`).send({ respuesta: 'tal vez' });
    expect(res.status).toBe(400);
    expect(res.text).toContain('no es válida');
  });

  it('GET /confirm/:token con participante/servicio inexistentes retorna 404', async () => {
    const token = generarToken(999999999, 999999999);
    const res = await request(app).get(`/confirm/${token}`);
    expect(res.status).toBe(404);
  });
});

// Estas pruebas insertan un participante y un servicio reales contra TEST_DATABASE_URL
// (misma base de desarrollo, confirmada por el usuario como segura para pruebas). No se
// hace limpieza automática (DELETE) por restricción explícita del proyecto: las filas
// creadas aquí quedan en la base para revisión/limpieza manual del coordinador.
describe('Etapa 4: Flujo de éxito contra base de datos real', () => {
  let app: ReturnType<typeof createApp>;
  let agent: ReturnType<typeof request.agent>;
  let participanteId: number;
  let servicioAbiertoId: number;
  let servicioCerradoId: number;
  const correoUnico = `prueba.etapa4.${Date.now()}@ejemplo-sintetico.test`;

  beforeAll(async () => {
    app = createApp();
    agent = request.agent(app);
    await agent.post('/api/login').send({ password: config.coordinadorPassword });

    const participante = await agent.post('/api/participants').send({
      nombre: 'Prueba',
      primer_apellido: 'EtapaCuatro',
      correo: correoUnico,
      grupo_id: 1, // Servidor
    });
    participanteId = participante.body.data.id;

    const servicioAbierto = await agent.post('/api/services').send({
      fecha_servicio: addDays(400),
      hora_servicio: '09:00',
      fecha_cierre_confirmacion: addDays(399),
      tipo: 'Regular',
    });
    servicioAbiertoId = servicioAbierto.body.data.id;

    const servicioCerrado = await agent.post('/api/services').send({
      fecha_servicio: addDays(-1),
      hora_servicio: '09:00',
      fecha_cierre_confirmacion: addDays(-2),
      tipo: 'Regular',
    });
    servicioCerradoId = servicioCerrado.body.data.id;
  });

  it('GET /confirm/:token con ventana abierta muestra el formulario con hora de llegada', async () => {
    const token = generarToken(participanteId, servicioAbiertoId);
    const res = await request(app).get(`/confirm/${token}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Confirmación de Asistencia');
    expect(res.text).toContain('7:30 AM'); // Servidor: 1.5h antes de las 09:00 (formato 12h)
    expect(res.text).toContain(`action="/confirm/${token}"`);
  });

  it('Escapa el nombre del participante en el HTML público (regresión XSS)', async () => {
    const correoXss = `prueba.etapa4.xss.${Date.now()}@ejemplo-sintetico.test`;
    const participanteXss = await agent.post('/api/participants').send({
      nombre: '<script>alert(1)</script>',
      primer_apellido: 'XSS',
      correo: correoXss,
      grupo_id: 1,
    });
    const token = generarToken(participanteXss.body.data.id, servicioAbiertoId);
    const res = await request(app).get(`/confirm/${token}`);
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('<script>alert(1)</script>');
    expect(res.text).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('POST /confirm/:token con "Sí" registra la respuesta y muestra la hora de llegada', async () => {
    const token = generarToken(participanteId, servicioAbiertoId);
    const res = await request(app).post(`/confirm/${token}`).send({ respuesta: 'Sí' });
    expect(res.status).toBe(200);
    expect(res.text).toContain('¡Asistencia Confirmada!');
    expect(res.text).toContain('7:30 AM');
  });

  it('GET /confirm/:token vuelve a mostrar el formulario con la respuesta actual', async () => {
    const token = generarToken(participanteId, servicioAbiertoId);
    const res = await request(app).get(`/confirm/${token}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Tu estado actual');
    expect(res.text).toContain('Sí');
  });

  it('GET /confirm/:token/no (acción rápida) cambia la respuesta a "No"', async () => {
    const token = generarToken(participanteId, servicioAbiertoId);
    const res = await request(app).get(`/confirm/${token}/no`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Respuesta Actualizada');
  });

  it('GET /confirm/:token con ventana cerrada muestra la página de cierre, no el formulario', async () => {
    const token = generarToken(participanteId, servicioCerradoId);
    const res = await request(app).get(`/confirm/${token}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Confirmación Cerrada');
    expect(res.text).not.toContain('<form');
  });

  it('POST /confirm/:token con ventana cerrada rechaza la respuesta (400)', async () => {
    const token = generarToken(participanteId, servicioCerradoId);
    const res = await request(app).post(`/confirm/${token}`).send({ respuesta: 'Sí' });
    expect(res.status).toBe(400);
    expect(res.text).toContain('Confirmación Cerrada');
  });
});

describe('Etapa 4: RN-10 - Tope de notificaciones de respuesta', () => {
  let agent: ReturnType<typeof request.agent>;
  let servicioId: number;

  beforeAll(async () => {
    const app = createApp();
    agent = request.agent(app);
    await agent.post('/api/login').send({ password: config.coordinadorPassword });

    const servicio = await agent.post('/api/services').send({
      fecha_servicio: addDays(400),
      hora_servicio: '09:00',
      fecha_cierre_confirmacion: addDays(399),
      tipo: 'Regular',
    });
    servicioId = servicio.body.data.id;
  });

  async function crearParticipante(sufijo: string) {
    const res = await agent.post('/api/participants').send({
      nombre: 'Prueba',
      primer_apellido: 'EtapaCuatroRN10',
      correo: `prueba.etapa4.rn10.${sufijo}.${Date.now()}@ejemplo-sintetico.test`,
      grupo_id: 1,
    });
    return res.body.data.id as number;
  }

  it('Notifica en el alta y en el primer cambio; deja de notificar del segundo cambio en adelante', async () => {
    const participanteId = await crearParticipante('tope');

    const alta = await RespuestaModel.registrar(participanteId, servicioId, 'Sí');
    expect(alta).toEqual({ respuesta: 'Sí', debeNotificar: true, esCambio: false });

    const cambio1 = await RespuestaModel.registrar(participanteId, servicioId, 'No');
    expect(cambio1).toEqual({ respuesta: 'No', debeNotificar: true, esCambio: true });

    const cambio2 = await RespuestaModel.registrar(participanteId, servicioId, 'Sí');
    expect(cambio2).toEqual({ respuesta: 'Sí', debeNotificar: false, esCambio: true });

    const cambio3 = await RespuestaModel.registrar(participanteId, servicioId, 'No');
    expect(cambio3).toEqual({ respuesta: 'No', debeNotificar: false, esCambio: true });
  });

  it('Repetir la misma respuesta no cuenta como cambio ni notifica de nuevo', async () => {
    const participanteId = await crearParticipante('repetido');

    const alta = await RespuestaModel.registrar(participanteId, servicioId, 'Sí');
    expect(alta.debeNotificar).toBe(true);

    const repetir = await RespuestaModel.registrar(participanteId, servicioId, 'Sí');
    expect(repetir).toEqual({ respuesta: 'Sí', debeNotificar: false, esCambio: false });
  });
});

// `establecerMailerDePruebas` intercepta el mailer real de `confirmController.submitForm`
// (obtenerMailerActivo) solo bajo NODE_ENV=test, para verificar el acuse de recibo sin
// depender de credenciales de Gmail ni de red real. Se restaura a null tras cada prueba.
describe('Etapa 4: RN-10 - Acuse de recibo por correo (mailer)', () => {
  let app: ReturnType<typeof createApp>;
  let agent: ReturnType<typeof request.agent>;

  class MailerEspia implements Mailer {
    llamadas: { to: string; subject: string }[] = [];
    async enviar(correo: { to: string; subject: string }): Promise<boolean> {
      this.llamadas.push({ to: correo.to, subject: correo.subject });
      return true;
    }
  }

  beforeAll(async () => {
    app = createApp();
    agent = request.agent(app);
    await agent.post('/api/login').send({ password: config.coordinadorPassword });
  });

  afterEach(() => {
    establecerMailerDePruebas(null);
  });

  async function crearParticipanteYServicio(correo: string) {
    const participante = await agent.post('/api/participants').send({
      nombre: 'Prueba',
      primer_apellido: 'EtapaCuatroAcuse',
      correo,
      grupo_id: 1,
    });
    const servicio = await agent.post('/api/services').send({
      fecha_servicio: addDays(400),
      hora_servicio: '09:00',
      fecha_cierre_confirmacion: addDays(399),
      tipo: 'Regular',
    });
    return { participanteId: participante.body.data.id as number, servicioId: servicio.body.data.id as number };
  }

  it('Dispara un correo de acuse de recibo al confirmar por primera vez', async () => {
    const correo = `prueba.etapa4.acuse.${Date.now()}@ejemplo-sintetico.test`;
    const { participanteId, servicioId } = await crearParticipanteYServicio(correo);
    const token = generarToken(participanteId, servicioId);

    const espia = new MailerEspia();
    establecerMailerDePruebas(espia);

    const res = await request(app).post(`/confirm/${token}`).send({ respuesta: 'Sí' });
    expect(res.status).toBe(200);

    // El envío es "fire and forget" (no bloquea la respuesta HTTP): esperar un tick para que
    // la promesa interna del mailer se resuelva antes de verificar la llamada.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(espia.llamadas).toEqual([{ to: correo, subject: 'Confirmación de asistencia registrada' }]);
  });

  it('No envía un segundo acuse si se repite la misma respuesta (RN-10, sin cambio)', async () => {
    const correo = `prueba.etapa4.acuse-repetido.${Date.now()}@ejemplo-sintetico.test`;
    const { participanteId, servicioId } = await crearParticipanteYServicio(correo);
    const token = generarToken(participanteId, servicioId);

    await request(app).post(`/confirm/${token}`).send({ respuesta: 'Sí' }); // alta, sin espía instalado

    const espia = new MailerEspia();
    establecerMailerDePruebas(espia);

    const res = await request(app).post(`/confirm/${token}`).send({ respuesta: 'Sí' }); // repetir misma respuesta
    expect(res.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(espia.llamadas).toEqual([]);
  });
});

// Solo corre cuando hay credenciales reales de Gmail configuradas (GMAIL_USER/GMAIL_APP_PASSWORD);
// en CI o sin ellas se omite automáticamente, nunca falla por su ausencia. Usa la misma cuenta
// real (config.gmailUser) como remitente y destinatario a la vez, para no depender de una
// segunda bandeja real.
describe('Etapa 4: ambas respuestas (Sí/No), por botón rápido del correo y por formulario, con acuse real', () => {
  let app: ReturnType<typeof createApp>;
  let agent: ReturnType<typeof request.agent>;
  const gmailConfigurado = Boolean(config.gmailUser && config.gmailAppPassword);

  beforeAll(async () => {
    app = createApp();
    agent = request.agent(app);
    await agent.post('/api/login').send({ password: config.coordinadorPassword });
  });

  afterEach(() => {
    establecerMailerDePruebas(null);
  });

  (gmailConfigurado ? it : it.skip)(
    'Botones rápidos (correo) y formulario funcionan para Sí y No, y el acuse de recibo llega de verdad (RN-10, tope de 2)',
    async () => {
      // El correo es único (RN de esquema): si config.gmailUser ya está dado de alta (p. ej. de
      // una prueba manual anterior), se reutiliza ese participante en vez de fallar al crearlo.
      const intentoCrear = await agent.post('/api/participants').send({
        nombre: 'Prueba',
        primer_apellido: 'EtapaCuatroGmailReal',
        correo: config.gmailUser,
        grupo_id: 1,
      });
      let participanteId: number;
      if (intentoCrear.status === 201) {
        participanteId = intentoCrear.body.data.id as number;
      } else {
        const lista = await agent.get('/api/participants');
        const existente = lista.body.data.find(
          (p: { email: string }) => p.email === config.gmailUser
        );
        if (!existente) throw new Error('No se pudo crear ni encontrar al participante de Gmail real.');
        participanteId = existente.id as number;
      }

      const servicio = await agent.post('/api/services').send({
        fecha_servicio: addDays(400),
        hora_servicio: '09:00',
        fecha_cierre_confirmacion: addDays(399),
        tipo: 'Regular',
      });
      const token = generarToken(participanteId, servicio.body.data.id as number);

      establecerMailerDePruebas(new GmailMailer());

      // 1. Botón "Sí" del correo (quickAction) -> alta, dispara acuse real.
      const resSiCorreo = await request(app).get(`/confirm/${token}/si`);
      expect(resSiCorreo.status).toBe(200);
      expect(resSiCorreo.text).toContain('¡Asistencia Confirmada!');

      // 2. Botón "No" del correo (quickAction) -> cambio, dispara el segundo (y último, RN-10)
      // acuse real.
      const resNoCorreo = await request(app).get(`/confirm/${token}/no`);
      expect(resNoCorreo.status).toBe(200);
      expect(resNoCorreo.text).toContain('Respuesta Registrada');

      // Deja tiempo a que los dos envíos "fire and forget" anteriores terminen antes de seguir.
      await new Promise((resolve) => setTimeout(resolve, 300));

      // 3. Botón "Sí" del formulario -> cambio otra vez, pero ya se alcanzó el tope de 2
      // acuses (RN-10): se registra igual, sin disparar un tercer correo.
      const resSiForm = await request(app).post(`/confirm/${token}`).send({ respuesta: 'Sí' });
      expect(resSiForm.status).toBe(200);
      expect(resSiForm.text).toContain('¡Asistencia Confirmada!');

      // 4. Botón "No" del formulario -> idem, cuarto cambio, tampoco dispara correo.
      const resNoForm = await request(app).post(`/confirm/${token}`).send({ respuesta: 'No' });
      expect(resNoForm.status).toBe(200);
      expect(resNoForm.text).toContain('Respuesta Registrada');

      const respuestaFinal = await RespuestaModel.getByParticipanteServicio(
        participanteId,
        servicio.body.data.id as number
      );
      expect(respuestaFinal?.respuesta).toBe('No');
      expect(respuestaFinal?.notificaciones_enviadas).toBe(2); // RN-10: tope de 2, no 4
    },
    30000
  );
});
