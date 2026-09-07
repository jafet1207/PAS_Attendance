import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { config } from '../src/config/env.js';
import { generarToken } from '../src/tokens/index.js';
import { HistorialParticipanteModel } from '../src/models/historialParticipante.model.js';

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

    it('PATCH /api/participants/:id/email sin autenticación retorna 401', async () => {
      const res = await request(app).patch('/api/participants/1/email').send({ correo: 'x@test.com' });
      expect(res.status).toBe(401);
    });

    it('PATCH /api/participants/:id/status sin autenticación retorna 401', async () => {
      const res = await request(app).patch('/api/participants/1/status').send({ activo: false });
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

  describe('Validaciones de edición de correo (PATCH /api/participants/:id/email)', () => {
    it('Rechaza si el correo no es válido', async () => {
      const agent = request.agent(app);
      await agent.post('/api/login').send({ password: config.coordinadorPassword });

      const res = await agent.patch('/api/participants/1/email').send({ correo: 'no-es-un-correo' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Ingresa un correo válido.' });
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

  it('PATCH /api/participants/:id/email actualiza el correo', async () => {
    const nuevoCorreo = `editado.${Date.now()}@ejemplo-sintetico.test`;
    const res = await agent.patch(`/api/participants/${createdParticipantId}/email`).send({
      correo: nuevoCorreo,
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: createdParticipantId, email: nuevoCorreo });
  });

  it('PATCH /api/participants/:id/email retorna 404 si el participante no existe', async () => {
    const res = await agent
      .patch('/api/participants/999999999/email')
      .send({ correo: `no-existe.${Date.now()}@ejemplo-sintetico.test` });
    expect(res.status).toBe(404);
  });

  it('PATCH /api/participants/:id/email rechaza un correo ya usado por otro participante (409)', async () => {
    const otro = await agent.post('/api/participants').send({
      nombre: 'Prueba',
      primer_apellido: 'EtapaTresConflicto',
      correo: `prueba.etapa3.conflicto.${Date.now()}@ejemplo-sintetico.test`,
      grupo_id: 1,
    });
    expect(otro.status).toBe(201);

    const res = await agent
      .patch(`/api/participants/${createdParticipantId}/email`)
      .send({ correo: otro.body.data.email });

    expect(res.status).toBe(409);
  });

  it('PATCH /api/participants/:id/status retorna 404 si el participante no existe', async () => {
    const res = await agent.patch('/api/participants/999999999/status').send({ activo: false });
    expect(res.status).toBe(404);
  });

  it('GET /api/participants marca a los participantes como activos por defecto', async () => {
    const res = await agent.get('/api/participants');
    const creado = res.body.data.find((p: { id: number }) => p.id === createdParticipantId);
    expect(creado.active).toBe(true);
  });

  it('PATCH /api/participants/:id/status desactiva a un participante sin confirmaciones próximas', async () => {
    const res = await agent.patch(`/api/participants/${createdParticipantId}/status`).send({
      activo: false,
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: createdParticipantId, active: false });

    const lista = await agent.get('/api/participants');
    const encontrado = lista.body.data.find((p: { id: number }) => p.id === createdParticipantId);
    expect(encontrado.active).toBe(false);
  });

  it('PATCH /api/participants/:id/status reactiva a un participante', async () => {
    const res = await agent.patch(`/api/participants/${createdParticipantId}/status`).send({
      activo: true,
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: createdParticipantId, active: true });
  });

  describe('Desactivación con confirmación próxima (exige comentario)', () => {
    let participanteConfirmadoId: number;
    let servicioProximoId: number;

    beforeAll(async () => {
      const fechaFutura = new Date();
      fechaFutura.setDate(fechaFutura.getDate() + 400);
      const fechaServicio = fechaFutura.toISOString().slice(0, 10);
      const fechaCierre = new Date(fechaFutura.getTime() - 24 * 3600 * 1000).toISOString().slice(0, 10);

      const participante = await agent.post('/api/participants').send({
        nombre: 'Prueba',
        primer_apellido: 'ConfirmacionProxima',
        correo: `prueba.confirmacion.proxima.${Date.now()}@ejemplo-sintetico.test`,
        grupo_id: 1,
      });
      participanteConfirmadoId = participante.body.data.id;

      const servicio = await agent.post('/api/services').send({
        fecha_servicio: fechaServicio,
        hora_servicio: '09:00',
        fecha_cierre_confirmacion: fechaCierre,
        tipo: 'Regular',
      });
      servicioProximoId = servicio.body.data.id;

      const token = generarToken(participanteConfirmadoId, servicioProximoId);
      const confirmacion = await request(app).post(`/confirm/${token}`).send({ respuesta: 'Sí' });
      expect(confirmacion.status).toBe(200);
    });

    it('Rechaza la desactivación sin comentario y avisa que requiere justificación', async () => {
      const res = await agent.patch(`/api/participants/${participanteConfirmadoId}/status`).send({
        activo: false,
      });

      expect(res.status).toBe(400);
      expect(res.body.requiresComment).toBe(true);
    });

    it('Permite la desactivación cuando se incluye el comentario de justificación', async () => {
      const res = await agent.patch(`/api/participants/${participanteConfirmadoId}/status`).send({
        activo: false,
        comentario: 'Renunció al equipo de servidores esta semana.',
      });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ id: participanteConfirmadoId, active: false });
    });

    it('Registra la desactivación en Historial_Participante con la acción y el comentario', async () => {
      const historial = await HistorialParticipanteModel.getUltimoPorParticipante(participanteConfirmadoId);
      expect(historial).not.toBeNull();
      expect(historial?.accion).toBe('Desactivado');
      expect(historial?.comentario).toBe('Renunció al equipo de servidores esta semana.');
    });

    it('El servidor desactivado deja de contar como convocado en el servicio', async () => {
      const res = await agent.get(`/api/services/${servicioProximoId}`);
      expect(res.status).toBe(200);
      const sigueApareciendo = res.body.data.participants.some(
        (p: { id: number }) => p.id === participanteConfirmadoId
      );
      expect(sigueApareciendo).toBe(false);
    });
  });
});
