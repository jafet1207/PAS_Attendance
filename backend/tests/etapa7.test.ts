import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { config } from '../src/config/env.js';

// DM-7: la sesión del coordinador vive en Postgres (connect-pg-simple), no en memoria del
// proceso. La comprobación real no es "el login funciona" (eso ya lo cubre etapa1.test.ts) sino
// que la sesión sobrevive a una instancia de `createApp()` completamente distinta de la que hizo
// el login — que es justamente lo que simula una invocación serverless nueva sin memoria
// compartida con la anterior.
describe('Etapa 7: Persistencia de sesión en Postgres (DM-7)', () => {
  it('La sesión sobrevive a una instancia de app distinta a la que inició sesión', async () => {
    const appInstanciaA = createApp();
    const loginRes = await request(appInstanciaA)
      .post('/api/login')
      .send({ password: config.coordinadorPassword });
    expect(loginRes.status).toBe(200);

    const cookie = loginRes.headers['set-cookie'];
    expect(cookie).toBeDefined();

    // Instancia nueva de la app: sin memoria compartida con appInstanciaA.
    const appInstanciaB = createApp();
    const sessionRes = await request(appInstanciaB).get('/api/session').set('Cookie', cookie!);

    expect(sessionRes.status).toBe(200);
    expect(sessionRes.body).toEqual({ authenticated: true, role: 'coordinador' });
  });

  it('Sin cookie, una instancia nueva sigue sin reconocer sesión (regresión)', async () => {
    const app = createApp();
    const res = await request(app).get('/api/session');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ authenticated: false, role: null });
  });

  it('El logout invalida la sesión también para una instancia de app distinta', async () => {
    const appA = createApp();
    const loginRes = await request(appA)
      .post('/api/login')
      .send({ password: config.coordinadorPassword });
    const cookie = loginRes.headers['set-cookie'];
    expect(cookie).toBeDefined();

    const appB = createApp();
    const logoutRes = await request(appB).post('/api/logout').set('Cookie', cookie!);
    expect(logoutRes.status).toBe(200);

    const appC = createApp();
    const sessionRes = await request(appC).get('/api/session').set('Cookie', cookie!);
    expect(sessionRes.body).toEqual({ authenticated: false, role: null });
  });
});
