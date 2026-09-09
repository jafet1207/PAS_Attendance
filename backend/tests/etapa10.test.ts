import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { config } from '../src/config/env.js';
import { RespuestaModel } from '../src/models/respuesta.model.js';
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

describe('Etapa 11: Asignación de Puestos por Servicio', () => {
  let app: ReturnType<typeof createApp>;
  let agent: ReturnType<typeof request.agent>;
  let puestoPrincipalId: number;
  let puestoPrincipalAlternoId: number;
  let puestoSecundarioId: number;
  let puestoInactivoId: number;

  async function crearParticipante(grupoId: number, sufijo: string) {
    const correo = `prueba.etapa11.${sufijo}.${Date.now()}.${Math.random().toString(36).slice(2)}@ejemplo-sintetico.test`;
    const res = await agent
      .post('/api/participants')
      .send({ nombre: 'Prueba', primer_apellido: 'EtapaOnce', correo, grupo_id: grupoId });
    return res.body.data.id as number;
  }

  async function crearServicio(fechaServicio: string, fechaCierre: string) {
    const res = await agent.post('/api/services').send({
      fecha_servicio: fechaServicio,
      hora_servicio: '09:00',
      fecha_cierre_confirmacion: fechaCierre,
      tipo: 'Regular',
    });
    return res.body.data.id as number;
  }

  // RN-14: ventana cerrada (cierre ya pasó) pero el servicio todavía no ocurre.
  const crearServicioEnVentanaDeAsignacion = () => crearServicio(addDays(3), addDays(-1));
  // RN-14: ventana de confirmación todavía abierta.
  const crearServicioConVentanaAbierta = () => crearServicio(addDays(10), addDays(5));
  // RN-14: el servicio ya ocurrió.
  const crearServicioYaOcurrido = () => crearServicio(addDays(-1), addDays(-3));

  beforeAll(async () => {
    app = createApp();
    agent = request.agent(app);
    await agent.post('/api/login').send({ password: config.coordinadorPassword });

    const catalogo = await agent.get('/api/puestos');
    const areaAuditorio = catalogo.body.data.areas.find((a: { nombre: string }) => a.nombre === 'Auditorio');

    puestoPrincipalId = (
      await agent
        .post('/api/puestos')
        .send({ nombre: 'Principal Etapa11 A', tipo: 'Principal', area_id: areaAuditorio.id })
    ).body.data.id;
    puestoPrincipalAlternoId = (
      await agent
        .post('/api/puestos')
        .send({ nombre: 'Principal Etapa11 B', tipo: 'Principal', area_id: areaAuditorio.id })
    ).body.data.id;
    puestoSecundarioId = (
      await agent.post('/api/puestos').send({ nombre: 'Secundario Etapa11', tipo: 'Secundario' })
    ).body.data.id;

    const inactivo = await agent
      .post('/api/puestos')
      .send({ nombre: 'Inactivo Etapa11', tipo: 'Secundario' });
    puestoInactivoId = inactivo.body.data.id;
    await agent.patch(`/api/puestos/${puestoInactivoId}/status`).send({ activo: false });
  });

  describe('Protección de rutas', () => {
    it('GET /api/services/:id/asignaciones sin autenticación retorna 401', async () => {
      const res = await request(app).get('/api/services/1/asignaciones');
      expect(res.status).toBe(401);
    });

    it('PUT /api/services/:id/asignaciones/:participanteId sin autenticación retorna 401', async () => {
      const res = await request(app).put('/api/services/1/asignaciones/1').send({ puestoIds: [] });
      expect(res.status).toBe(401);
    });
  });

  describe('RN-14: ventana de asignación', () => {
    it('Rechaza asignar puestos si la ventana de confirmación sigue abierta', async () => {
      const servicioId = await crearServicioConVentanaAbierta();
      const participanteId = await crearParticipante(1, 'ventana-abierta');
      await RespuestaModel.registrar(participanteId, servicioId, 'Sí');

      const res = await agent
        .put(`/api/services/${servicioId}/asignaciones/${participanteId}`)
        .send({ puestoIds: [puestoSecundarioId] });
      expect(res.status).toBe(400);
    });

    it('Rechaza asignar puestos si el servicio ya ocurrió', async () => {
      const servicioId = await crearServicioYaOcurrido();
      const participanteId = await crearParticipante(1, 'ya-ocurrio');
      await RespuestaModel.registrar(participanteId, servicioId, 'Sí');

      const res = await agent
        .put(`/api/services/${servicioId}/asignaciones/${participanteId}`)
        .send({ puestoIds: [puestoSecundarioId] });
      expect(res.status).toBe(400);
    });

    it('Permite asignar puestos dentro de la ventana (cerrada, servicio futuro)', async () => {
      const servicioId = await crearServicioEnVentanaDeAsignacion();
      const participanteId = await crearParticipante(1, 'en-ventana');
      await RespuestaModel.registrar(participanteId, servicioId, 'Sí');

      const res = await agent
        .put(`/api/services/${servicioId}/asignaciones/${participanteId}`)
        .send({ puestoIds: [puestoSecundarioId] });
      expect(res.status).toBe(200);
    });
  });

  describe('RN-15: elegibilidad', () => {
    it('Rechaza asignar a quien respondió "No"', async () => {
      const servicioId = await crearServicioEnVentanaDeAsignacion();
      const participanteId = await crearParticipante(1, 'respondio-no');
      await RespuestaModel.registrar(participanteId, servicioId, 'No');

      const res = await agent
        .put(`/api/services/${servicioId}/asignaciones/${participanteId}`)
        .send({ puestoIds: [puestoSecundarioId] });
      expect(res.status).toBe(400);
    });

    it('Rechaza asignar a quien nunca respondió', async () => {
      const servicioId = await crearServicioEnVentanaDeAsignacion();
      const participanteId = await crearParticipante(1, 'sin-respuesta');

      const res = await agent
        .put(`/api/services/${servicioId}/asignaciones/${participanteId}`)
        .send({ puestoIds: [puestoSecundarioId] });
      expect(res.status).toBe(400);
    });

    it('Permite asignar a un Líder aunque nunca haya respondido', async () => {
      const servicioId = await crearServicioEnVentanaDeAsignacion();
      const liderId = await crearParticipante(3, 'lider-sin-respuesta');

      const res = await agent
        .put(`/api/services/${servicioId}/asignaciones/${liderId}`)
        .send({ puestoIds: [puestoSecundarioId] });
      expect(res.status).toBe(200);
    });

    it('GET /api/services/:id/asignaciones incluye a los elegibles con sus puestos actuales', async () => {
      const servicioId = await crearServicioEnVentanaDeAsignacion();
      const participanteId = await crearParticipante(1, 'listado');
      await RespuestaModel.registrar(participanteId, servicioId, 'Sí');
      await agent
        .put(`/api/services/${servicioId}/asignaciones/${participanteId}`)
        .send({ puestoIds: [puestoPrincipalId, puestoSecundarioId] });

      const res = await agent.get(`/api/services/${servicioId}/asignaciones`);
      expect(res.status).toBe(200);
      const fila = res.body.data.participants.find((p: { id: number }) => p.id === participanteId);
      const idsAsignados = fila.puestos.map((p: { id: number }) => p.id).sort();
      expect(idsAsignados).toEqual([puestoPrincipalId, puestoSecundarioId].sort());
    });
  });

  describe('RN-16: a lo sumo un puesto Principal', () => {
    it('Rechaza dos puestos Principal a la vez', async () => {
      const servicioId = await crearServicioEnVentanaDeAsignacion();
      const participanteId = await crearParticipante(1, 'dos-principales');
      await RespuestaModel.registrar(participanteId, servicioId, 'Sí');

      const res = await agent
        .put(`/api/services/${servicioId}/asignaciones/${participanteId}`)
        .send({ puestoIds: [puestoPrincipalId, puestoPrincipalAlternoId] });
      expect(res.status).toBe(400);
    });

    it('Permite un Principal más cualquier cantidad de Secundarios', async () => {
      const servicioId = await crearServicioEnVentanaDeAsignacion();
      const participanteId = await crearParticipante(1, 'principal-y-secundario');
      await RespuestaModel.registrar(participanteId, servicioId, 'Sí');

      const res = await agent
        .put(`/api/services/${servicioId}/asignaciones/${participanteId}`)
        .send({ puestoIds: [puestoPrincipalId, puestoSecundarioId] });
      expect(res.status).toBe(200);
    });
  });

  describe('RN-17: puestos desactivados', () => {
    it('Rechaza asignar un puesto desactivado', async () => {
      const servicioId = await crearServicioEnVentanaDeAsignacion();
      const participanteId = await crearParticipante(1, 'puesto-inactivo');
      await RespuestaModel.registrar(participanteId, servicioId, 'Sí');

      const res = await agent
        .put(`/api/services/${servicioId}/asignaciones/${participanteId}`)
        .send({ puestoIds: [puestoInactivoId] });
      expect(res.status).toBe(400);
    });
  });

  describe('RF-7.6: reemplazo atómico', () => {
    it('Una segunda llamada reemplaza el conjunto en vez de acumularlo', async () => {
      const servicioId = await crearServicioEnVentanaDeAsignacion();
      const participanteId = await crearParticipante(1, 'reemplazo');
      await RespuestaModel.registrar(participanteId, servicioId, 'Sí');

      await agent
        .put(`/api/services/${servicioId}/asignaciones/${participanteId}`)
        .send({ puestoIds: [puestoPrincipalId, puestoSecundarioId] });
      await agent
        .put(`/api/services/${servicioId}/asignaciones/${participanteId}`)
        .send({ puestoIds: [puestoSecundarioId] });

      const res = await agent.get(`/api/services/${servicioId}/asignaciones`);
      const fila = res.body.data.participants.find((p: { id: number }) => p.id === participanteId);
      expect(fila.puestos.map((p: { id: number }) => p.id)).toEqual([puestoSecundarioId]);
    });
  });
});
