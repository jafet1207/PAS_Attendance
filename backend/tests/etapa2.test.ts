import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { config } from '../src/config/env.js';
import { calcularEstado, formatearNombreServicio } from '../src/services/serviciosService.js';

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('Etapa 2: Reglas de negocio y gestión de servicios', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp();
  });

  describe('Cálculo de reglas de dominio en memoria', () => {
    it('formatearNombreServicio formatea correctamente con mes y día en español', () => {
      // 2026-09-12 es Sábado
      const nombre = formatearNombreServicio('2026-09-12', 'Regular');
      expect(nombre).toBe('Servicio Regular Sábado 12 Setiembre');
    });

    it('calcularEstado deriva correctamente los 4 estados según ventana y pendientes', () => {
      // Ventana abierta (hoy < fecha_cierre)
      expect(calcularEstado(true, 5)).toBe('Pendiente');
      expect(calcularEstado(true, 0)).toBe('Completo');

      // Ventana cerrada (hoy >= fecha_cierre)
      expect(calcularEstado(false, 3)).toBe('Vencido');
      expect(calcularEstado(false, 0)).toBe('Cerrado');
    });
  });

  describe('Protección de rutas de servicios y grupos', () => {
    it('GET /api/services sin autenticación retorna 401', async () => {
      const res = await request(app).get('/api/services');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'No autorizado' });
    });

    it('GET /api/groups sin autenticación retorna 401', async () => {
      const res = await request(app).get('/api/groups');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'No autorizado' });
    });

    it('POST /api/services sin autenticación retorna 401', async () => {
      const res = await request(app)
        .post('/api/services')
        .send({
          fecha_servicio: '2026-09-15',
          hora_servicio: '09:00',
          fecha_cierre_confirmacion: '2026-09-12',
          tipo: 'Regular',
        });
      expect(res.status).toBe(401);
    });

    it('GET /api/services/:id sin autenticación retorna 401', async () => {
      const res = await request(app).get('/api/services/1');
      expect(res.status).toBe(401);
    });

    it('GET /api/services/:id/submissions sin autenticación retorna 401', async () => {
      const res = await request(app).get('/api/services/1/submissions');
      expect(res.status).toBe(401);
    });
  });

  describe('Validaciones de creación de servicio (POST /api/services)', () => {
    it('Rechaza si faltan campos obligatorios', async () => {
      const agent = request.agent(app);
      await agent.post('/api/login').send({ password: config.coordinadorPassword });

      const res = await agent.post('/api/services').send({});
      expect(res.status).toBe(400);
      expect(res.body.errors).toContain('Todos los campos son requeridos.');
    });

    it('Rechaza si la fecha de cierre es igual o posterior a la fecha del servicio', async () => {
      const agent = request.agent(app);
      await agent.post('/api/login').send({ password: config.coordinadorPassword });

      const res = await agent.post('/api/services').send({
        fecha_servicio: '2026-09-15',
        hora_servicio: '09:00',
        fecha_cierre_confirmacion: '2026-09-15', // Mismo día
        tipo: 'Regular',
      });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(
        'La fecha de cierre de confirmación debe ser estrictamente anterior a la fecha del servicio.'
      );
    });

    it('Rechaza si el tipo de servicio no es Regular ni Extraordinario', async () => {
      const agent = request.agent(app);
      await agent.post('/api/login').send({ password: config.coordinadorPassword });

      const res = await agent.post('/api/services').send({
        fecha_servicio: '2026-09-15',
        hora_servicio: '09:00',
        fecha_cierre_confirmacion: '2026-09-10',
        tipo: 'Invalido',
      });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain('Tipo de servicio inválido.');
    });

    it('Rechaza si el formato de hora es inválido', async () => {
      const agent = request.agent(app);
      await agent.post('/api/login').send({ password: config.coordinadorPassword });

      const res = await agent.post('/api/services').send({
        fecha_servicio: '2026-09-15',
        hora_servicio: '25:99',
        fecha_cierre_confirmacion: '2026-09-10',
        tipo: 'Regular',
      });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain('Formato de hora inválido.');
    });
  });

  describe('GET /api/servicios (ruta pública/legacy)', () => {
    it('no requiere autenticación', async () => {
      const res = await request(app).get('/api/servicios');
      expect(res.status).not.toBe(401);
    });
  });

  describe('GET /api/services/config', () => {
    it('sin autenticación retorna 401', async () => {
      const res = await request(app).get('/api/services/config');
      expect(res.status).toBe(401);
    });

    it('retorna los días de cierre configurados por defecto', async () => {
      const agent = request.agent(app);
      await agent.post('/api/login').send({ password: config.coordinadorPassword });

      const res = await agent.get('/api/services/config');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        data: {
          diasCierreRegular: 3,
          diasCierreExtraordinario: 1,
        },
      });
    });
  });
});

// Estas pruebas insertan un servicio real contra TEST_DATABASE_URL (misma base de
// desarrollo, confirmada por el usuario como segura para pruebas). No se hace limpieza
// automática (DELETE) por restricción explícita del proyecto: las filas creadas aquí
// quedan en la base para revisión/limpieza manual del coordinador.
describe('Etapa 2: Flujo de éxito contra base de datos real', () => {
  let app: ReturnType<typeof createApp>;
  let agent: ReturnType<typeof request.agent>;
  let createdServiceId: number;
  const fechaServicio = addDays(400);
  const fechaCierre = addDays(399);

  beforeAll(async () => {
    app = createApp();
    agent = request.agent(app);
    await agent.post('/api/login').send({ password: config.coordinadorPassword });
  });

  it('POST /api/services crea un servicio y retorna los campos calculados', async () => {
    const res = await agent.post('/api/services').send({
      fecha_servicio: fechaServicio,
      hora_servicio: '10:00',
      fecha_cierre_confirmacion: fechaCierre,
      tipo: 'Regular',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toEqual(expect.any(Number));
    expect(res.body.data.type).toBe('Regular');
    expect(res.body.data.name).toContain('Servicio Regular');
    expect(res.body.data.date.startsWith(fechaServicio)).toBe(true);
    expect(res.body.data.closingDate).toBe(fechaCierre);
    expect(res.body.data.windowOpen).toBe(true);
    expect(['Pendiente', 'Completo']).toContain(res.body.data.status);
    expect(typeof res.body.data.invited).toBe('number');
    expect(typeof res.body.data.confirmed).toBe('number');
    expect(typeof res.body.data.pending).toBe('number');
    expect(res.body.data.invited).toBe(res.body.data.confirmed + res.body.data.pending);

    createdServiceId = res.body.data.id;
  });

  it('GET /api/services incluye el servicio recién creado con el mismo cálculo', async () => {
    const res = await agent.get('/api/services');
    expect(res.status).toBe(200);

    const creado = res.body.data.find((s: { id: number }) => s.id === createdServiceId);
    expect(creado).toBeDefined();
    expect(creado.closingDate).toBe(fechaCierre);
    expect(creado.windowOpen).toBe(true);
  });

  it('GET /api/services/:id retorna el detalle con la lista de participantes convocados', async () => {
    const res = await agent.get(`/api/services/${createdServiceId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.service.id).toBe(createdServiceId);
    expect(Array.isArray(res.body.data.participants)).toBe(true);
    expect(res.body.data.participants.length).toBe(res.body.data.service.invited);

    for (const participant of res.body.data.participants) {
      expect(participant).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          name: expect.any(String),
          email: expect.any(String),
          status: expect.any(String),
        })
      );
    }
  });

  it('GET /api/services/:id/submissions retorna la estructura del historial de envíos', async () => {
    const res = await agent.get(`/api/services/${createdServiceId}/submissions`);
    expect(res.status).toBe(200);
    expect(res.body.data.service.id).toBe(createdServiceId);
    expect(Array.isArray(res.body.data.submissions)).toBe(true);
    // Servicio recién creado: nunca se le han enviado recordatorios.
    expect(res.body.data.submissions.length).toBe(0);
  });
});
