import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { config } from '../src/config/env.js';

describe('Etapa 10: Catálogo de Puestos (Áreas y CRUD de Puestos)', () => {
  let app: ReturnType<typeof createApp>;
  let agent: ReturnType<typeof request.agent>;
  let areaAuditorioId: number;

  beforeAll(async () => {
    app = createApp();
    agent = request.agent(app);
    await agent.post('/api/login').send({ password: config.coordinadorPassword });

    const res = await agent.get('/api/puestos');
    const area = res.body.data.areas.find((a: { nombre: string }) => a.nombre === 'Auditorio');
    areaAuditorioId = area.id;
  });

  describe('Protección de rutas', () => {
    it('GET /api/puestos sin autenticación retorna 401', async () => {
      const res = await request(app).get('/api/puestos');
      expect(res.status).toBe(401);
    });

    it('POST /api/puestos sin autenticación retorna 401', async () => {
      const res = await request(app).post('/api/puestos').send({ nombre: 'X', tipo: 'Secundario' });
      expect(res.status).toBe(401);
    });
  });

  describe('RN-19: catálogo semilla', () => {
    it('GET /api/puestos incluye las 5 Áreas y sus puestos, más los 3 Secundarios', async () => {
      const res = await agent.get('/api/puestos');
      expect(res.status).toBe(200);

      const nombresDeArea = res.body.data.areas.map((a: { nombre: string }) => a.nombre);
      expect(nombresDeArea).toEqual(
        expect.arrayContaining(['Parqueo', 'Auditorio', 'Lobby y Pasillos', 'Quiero orar por vos', 'Kids'])
      );

      const nombresDePuesto = res.body.data.puestos.map((p: { nombre: string }) => p.nombre);
      expect(nombresDePuesto).toEqual(
        expect.arrayContaining([
          'Coordinador de área (Parqueo)',
          'Parqueo',
          'Coordinador de área (Auditorio)',
          'Sala KZN Babies',
          'Kids',
          'Café',
          'Apertura Puertas',
          'Apoyo Logística',
        ])
      );

      // Kids no tiene "Coordinador de área (Kids)" (confirmado explícitamente por el usuario).
      expect(nombresDePuesto).not.toContain('Coordinador de área (Kids)');

      const secundarios = res.body.data.puestos.filter((p: { tipo: string }) => p.tipo === 'Secundario');
      expect(secundarios.every((p: { areaId: number | null }) => p.areaId === null)).toBe(true);

      const principales = res.body.data.puestos.filter((p: { tipo: string }) => p.tipo === 'Principal');
      expect(principales.every((p: { areaId: number | null }) => p.areaId !== null)).toBe(true);
    });
  });

  describe('RN-17: validación del catálogo (CHECK a nivel de aplicación)', () => {
    it('Rechaza un puesto Principal sin Área válida', async () => {
      const res = await agent.post('/api/puestos').send({ nombre: 'Estación nueva', tipo: 'Principal' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Área válida/);
    });

    it('Rechaza un puesto Principal con un area_id que no existe', async () => {
      const res = await agent
        .post('/api/puestos')
        .send({ nombre: 'Estación nueva', tipo: 'Principal', area_id: 999999 });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Área válida/);
    });

    it('Rechaza un puesto Secundario con Área', async () => {
      const res = await agent
        .post('/api/puestos')
        .send({ nombre: 'Secundario nuevo', tipo: 'Secundario', area_id: areaAuditorioId });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/no debe tener Área/);
    });

    it('Rechaza un tipo distinto de Principal/Secundario', async () => {
      const res = await agent.post('/api/puestos').send({ nombre: 'Puesto raro', tipo: 'Otro' });
      expect(res.status).toBe(400);
    });

    it('Rechaza un nombre vacío', async () => {
      const res = await agent
        .post('/api/puestos')
        .send({ nombre: ' ', tipo: 'Secundario' });
      expect(res.status).toBe(400);
    });
  });

  describe('CRUD de puestos', () => {
    it('Crea un puesto Principal dentro de un Área existente', async () => {
      const res = await agent
        .post('/api/puestos')
        .send({ nombre: 'Estación de prueba Etapa10', tipo: 'Principal', area_id: areaAuditorioId });
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        nombre: 'Estación de prueba Etapa10',
        tipo: 'Principal',
        areaId: areaAuditorioId,
        areaNombre: 'Auditorio',
        activo: true,
      });
    });

    it('Crea un puesto Secundario sin Área', async () => {
      const res = await agent.post('/api/puestos').send({ nombre: 'Secundario de prueba Etapa10', tipo: 'Secundario' });
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        nombre: 'Secundario de prueba Etapa10',
        tipo: 'Secundario',
        areaId: null,
        activo: true,
      });
    });

    it('Edita nombre y tipo de un puesto existente', async () => {
      const creado = await agent
        .post('/api/puestos')
        .send({ nombre: 'Editable Etapa10', tipo: 'Secundario' });
      const id = creado.body.data.id;

      const res = await agent
        .patch(`/api/puestos/${id}`)
        .send({ nombre: 'Editable Etapa10 (renombrado)', tipo: 'Secundario' });
      expect(res.status).toBe(200);
      expect(res.body.data.nombre).toBe('Editable Etapa10 (renombrado)');
    });

    it('PATCH /api/puestos/:id con id inexistente retorna 404', async () => {
      const res = await agent.patch('/api/puestos/999999').send({ nombre: 'No existe', tipo: 'Secundario' });
      expect(res.status).toBe(404);
    });

    it('Cambia el tipo de un puesto existente de Secundario a Principal (RN-17)', async () => {
      const creado = await agent
        .post('/api/puestos')
        .send({ nombre: 'Cambia a Principal Etapa10', tipo: 'Secundario' });
      const id = creado.body.data.id;

      const res = await agent
        .patch(`/api/puestos/${id}`)
        .send({ nombre: 'Cambia a Principal Etapa10', tipo: 'Principal', area_id: areaAuditorioId });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ tipo: 'Principal', areaId: areaAuditorioId, areaNombre: 'Auditorio' });
    });

    it('Cambia el tipo de un puesto existente de Principal a Secundario (RN-17)', async () => {
      const creado = await agent
        .post('/api/puestos')
        .send({ nombre: 'Cambia a Secundario Etapa10', tipo: 'Principal', area_id: areaAuditorioId });
      const id = creado.body.data.id;

      const res = await agent
        .patch(`/api/puestos/${id}`)
        .send({ nombre: 'Cambia a Secundario Etapa10', tipo: 'Secundario' });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ tipo: 'Secundario', areaId: null });
    });

    it('Rechaza cambiar un puesto existente a Principal sin Área válida', async () => {
      const creado = await agent
        .post('/api/puestos')
        .send({ nombre: 'Se queda Secundario Etapa10', tipo: 'Secundario' });
      const id = creado.body.data.id;

      const res = await agent
        .patch(`/api/puestos/${id}`)
        .send({ nombre: 'Se queda Secundario Etapa10', tipo: 'Principal' });
      expect(res.status).toBe(400);
    });

    it('RN-17: desactivar un puesto es baja lógica (sigue existiendo en el catálogo)', async () => {
      const creado = await agent
        .post('/api/puestos')
        .send({ nombre: 'Para desactivar Etapa10', tipo: 'Secundario' });
      const id = creado.body.data.id;

      const desactivado = await agent.patch(`/api/puestos/${id}/status`).send({ activo: false });
      expect(desactivado.status).toBe(200);
      expect(desactivado.body.data.activo).toBe(false);

      const lista = await agent.get('/api/puestos');
      const puesto = lista.body.data.puestos.find((p: { id: number }) => p.id === id);
      expect(puesto).toBeDefined();
      expect(puesto.activo).toBe(false);

      const reactivado = await agent.patch(`/api/puestos/${id}/status`).send({ activo: true });
      expect(reactivado.body.data.activo).toBe(true);
    });

    it('PATCH /api/puestos/:id/status con id inexistente retorna 404', async () => {
      const res = await agent.patch('/api/puestos/999999/status').send({ activo: false });
      expect(res.status).toBe(404);
    });
  });
});
