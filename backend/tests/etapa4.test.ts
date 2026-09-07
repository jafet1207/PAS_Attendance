import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { config } from '../src/config/env.js';
import { generarToken, decodificarToken } from '../src/tokens/index.js';
import { calcularHoraLlegada, ventanaDeConfirmacionAbierta } from '../src/controllers/confirmController.js';

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
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
    expect(res.text).toContain('07:30'); // Servidor: 1.5h antes de las 09:00
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
    expect(res.text).toContain('07:30');
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
