import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { config } from '../src/config/env.js';

describe('Etapa 3: Servidores y roles', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp();
  });

  describe('Protección de rutas de participantes', () => {
    it('GET /api/participants sin autenticación retorna 401', async () => {
      const res = await request(app).get('/api/participants');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'No autorizado' });
    });

    it('POST /api/participants sin autenticación retorna 401', async () => {
      const res = await request(app).post('/api/participants').send({
        nombre: 'Ana',
        primer_apellido: 'Solano',
        correo: 'ana@ejemplo-sintetico.test',
        grupo_id: 1,
      });
      expect(res.status).toBe(401);
    });

    it('PATCH /api/participants/:id/role sin autenticación retorna 401', async () => {
      const res = await request(app).patch('/api/participants/1/role').send({ grupo_id: 1 });
      expect(res.status).toBe(401);
    });
  });

  describe('Validaciones de creación (POST /api/participants)', () => {
    it('Rechaza si falta el nombre', async () => {
      const agent = request.agent(app);
      await agent.post('/api/login').send({ password: config.coordinadorPassword });

      const res = await agent.post('/api/participants').send({
        primer_apellido: 'Solano',
        correo: 'ana@ejemplo-sintetico.test',
        grupo_id: 1,
      });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain('El nombre es requerido.');
    });

    it('Rechaza si falta el primer apellido', async () => {
      const agent = request.agent(app);
      await agent.post('/api/login').send({ password: config.coordinadorPassword });

      const res = await agent.post('/api/participants').send({
        nombre: 'Ana',
        correo: 'ana@ejemplo-sintetico.test',
        grupo_id: 1,
      });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain('El primer apellido es requerido.');
    });

    it('Rechaza si el correo no es válido', async () => {
      const agent = request.agent(app);
      await agent.post('/api/login').send({ password: config.coordinadorPassword });

      const res = await agent.post('/api/participants').send({
        nombre: 'Ana',
        primer_apellido: 'Solano',
        correo: 'no-es-un-correo',
        grupo_id: 1,
      });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain('Ingresa un correo válido.');
    });

    it('Rechaza si el grupo no es válido', async () => {
      const agent = request.agent(app);
      await agent.post('/api/login').send({ password: config.coordinadorPassword });

      const res = await agent.post('/api/participants').send({
        nombre: 'Ana',
        primer_apellido: 'Solano',
        correo: 'ana@ejemplo-sintetico.test',
        grupo_id: 'no-es-un-numero',
      });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain('Selecciona un grupo válido.');
    });
  });

  describe('Validaciones de cambio de rol (PATCH /api/participants/:id/role)', () => {
    it('Rechaza si el grupo no es un número', async () => {
      const agent = request.agent(app);
      await agent.post('/api/login').send({ password: config.coordinadorPassword });

      const res = await agent.patch('/api/participants/1/role').send({ grupo_id: 'x' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Selecciona un rol válido.' });
    });
  });
});

// Estas pruebas insertan un participante real contra TEST_DATABASE_URL (misma base de
// desarrollo, confirmada por el usuario como segura para pruebas). No se hace limpieza
// automática (DELETE) por restricción explícita del proyecto: las filas creadas aquí
// quedan en la base para revisión/limpieza manual del coordinador.
describe('Etapa 3: Flujo de éxito contra base de datos real', () => {
  let app: ReturnType<typeof createApp>;
  let agent: ReturnType<typeof request.agent>;
  let createdParticipantId: number;
  const correoUnico = `prueba.etapa3.${Date.now()}@ejemplo-sintetico.test`;

  beforeAll(async () => {
    app = createApp();
    agent = request.agent(app);
    await agent.post('/api/login').send({ password: config.coordinadorPassword });
  });

  it('POST /api/participants crea un participante con nombre completo y grupo', async () => {
    const res = await agent.post('/api/participants').send({
      nombre: 'Prueba',
      primer_apellido: 'EtapaTres',
      segundo_apellido: 'Automatica',
      correo: correoUnico,
      grupo_id: 1,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toEqual(expect.any(Number));
    expect(res.body.data.name).toBe('Prueba EtapaTres Automatica');
    expect(res.body.data.email).toBe(correoUnico);
    expect(res.body.data.group).toEqual({ id: 1, name: expect.any(String) });

    createdParticipantId = res.body.data.id;
  });

  it('Rechaza un segundo alta con el mismo correo (409)', async () => {
    const res = await agent.post('/api/participants').send({
      nombre: 'Otra',
      primer_apellido: 'Persona',
      correo: correoUnico,
      grupo_id: 1,
    });

    expect(res.status).toBe(409);
  });

  it('GET /api/participants incluye el participante recién creado', async () => {
    const res = await agent.get('/api/participants');
    expect(res.status).toBe(200);

    const creado = res.body.data.find((p: { id: number }) => p.id === createdParticipantId);
    expect(creado).toBeDefined();
    expect(creado.name).toBe('Prueba EtapaTres Automatica');
    expect(creado.email).toBe(correoUnico);
  });

  it('PATCH /api/participants/:id/role actualiza el grupo del participante', async () => {
    const res = await agent.patch(`/api/participants/${createdParticipantId}/role`).send({
      grupo_id: 2,
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: createdParticipantId, group: { id: 2, name: expect.any(String) } });
  });

  it('PATCH /api/participants/:id/role retorna 404 si el participante no existe', async () => {
    const res = await agent.patch('/api/participants/999999999/role').send({ grupo_id: 1 });
    expect(res.status).toBe(404);
  });
});
