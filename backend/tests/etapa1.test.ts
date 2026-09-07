import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { config } from '../src/config/env.js';

describe('Etapa 1: Infraestructura y autenticación de sesión', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp();
  });

  it('GET /api/session retorna estado anónimo por defecto', async () => {
    const res = await request(app).get('/api/session');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      // ROTURA DELIBERADA para la demo rojo→verde de la CI: el sistema real devuelve `false`.
      authenticated: true,
      role: null,
    });
  });

  it('POST /api/login con contraseña incorrecta retorna 401', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ password: 'contraseña_invalida' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Contraseña incorrecta.' });
  });

  it('POST /api/login con contraseña correcta autentica al coordinador y persiste la sesión', async () => {
    const agent = request.agent(app);

    // 1. Iniciar sesión
    const loginRes = await agent
      .post('/api/login')
      .send({ password: config.coordinadorPassword });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toEqual({
      authenticated: true,
      role: 'coordinador',
    });

    // 2. Verificar que /api/session ahora reporta autenticado con la cookie
    const sessionRes = await agent.get('/api/session');
    expect(sessionRes.status).toBe(200);
    expect(sessionRes.body).toEqual({
      authenticated: true,
      role: 'coordinador',
    });

    // 3. Cerrar sesión
    const logoutRes = await agent.post('/api/logout');
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body).toEqual({
      authenticated: false,
    });

    // 4. Verificar que /api/session vuelve a ser anónimo
    const afterLogoutRes = await agent.get('/api/session');
    expect(afterLogoutRes.status).toBe(200);
    expect(afterLogoutRes.body).toEqual({
      authenticated: false,
      role: null,
    });
  });
});
