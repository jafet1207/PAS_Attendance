# PAS Attendance · Confirmación de Asistencia a Servicios

Aplicación web fullstack para que los servidores de una iglesia confirmen su asistencia a los
servicios (regulares y extraordinarios) mediante enlaces de correo firmados, y para que el
coordinador convoque, dé seguimiento y automatice los recordatorios sin trabajo manual.

- **Frontend:** React 19 + Vite + React Router 7 + CSS Modules.
- **Backend:** Node.js + Express + TypeScript, con sesiones HTTP-only y tokens HMAC/JWT.
- **Persistencia:** PostgreSQL (probado contra [Neon](https://neon.tech)) vía `pg.Pool` nativo, con
  esquema y migraciones idempotentes que se aplican solas al arrancar el servidor.
- **Pruebas:** Vitest + Supertest, 84 pruebas contra la base de datos real de pruebas.

Repositorio oficial: `https://github.com/jafet1207/PAS_Attendance.git`

---

## Arquitectura

```
[ Navegador Web / Cliente ]
      │
      ├── (React 19 + Vite + CSS Modules) ──> [ React Router / Dashboard UI ]
      │                                                │
      │                                       (REST API + Cookie Session)
      │                                                ▼
      └── (Correo / Link de Confirmación) ──> [ Express REST API (Node.js + TypeScript) ]
                                                       │
                                        ┌──────────────┴──────────────┐
                                        ▼                             ▼
                              [ PostgreSQL (Neon) ]        [ Mailer: Gmail / Mock ]
```

Detalle de componentes, contratos entre módulos y decisiones de arquitectura en
[`DISENO.md`](DISENO.md) y [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Requisitos previos

- Node.js 18 o superior y npm.
- Una base de datos PostgreSQL accesible por red (por ejemplo, un proyecto gratuito de
  [Neon](https://neon.tech)). No se requiere ninguna instalación local de PostgreSQL: el
  proyecto se conecta por `DATABASE_URL`.

## Instalación

```bash
git clone https://github.com/jafet1207/PAS_Attendance.git
cd PAS_Attendance

npm install --prefix backend
npm install --prefix frontend
```

## Configuración

El backend carga variables de entorno desde `backend/.env` (y, como respaldo, desde un `.env` en
la raíz). Copie la plantilla y complétela:

```bash
cp .env.example backend/.env
```

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Cadena de conexión de PostgreSQL (Neon u otro proveedor). El backend activa SSL automáticamente solo si la cadena incluye `sslmode=require` (necesario para Neon). |
| `TEST_DATABASE_URL` | Solo para pruebas | Base usada por `npm test` cuando `NODE_ENV=test`. Puede apuntar a la misma base que `DATABASE_URL` (así se hizo durante el desarrollo). |
| `PORT` | No (default `5000`) | Puerto del servidor backend. |
| `SECRET_KEY` | Sí en producción | Firma las cookies de sesión y los tokens de confirmación (HMAC/JWT). |
| `CRON_SECRET` | Sí para automatizar recordatorios | Permite invocar `/api/enviar-recordatorios` con `Authorization: Bearer <CRON_SECRET>` sin sesión de coordinador (para un cron externo). |
| `COORDINADOR_PASSWORD` | Sí | Contraseña única del panel de coordinación (no hay cuentas individuales todavía). |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | No | Si se configuran ambas, los correos (confirmaciones y recordatorios) se envían de verdad por Gmail SMTP. Si se omiten, se usa un `MockMailer` que solo registra el intento en consola — así se puede levantar y demostrar el prototipo sin credenciales reales. |
| `APP_BASE_URL` | No (default `http://localhost:5000`) | Host público que se usa para construir los enlaces de confirmación dentro de los correos de recordatorio. |

**Nunca se necesita ejecutar una migración a mano:** al arrancar, el backend crea o actualiza el
esquema (tablas, índices, datos base de los 4 grupos) de forma idempotente.

## Ejecutar en desarrollo

En dos terminales separadas, desde la raíz del repositorio:

```bash
npm run dev:backend   # http://localhost:5000
```

```bash
npm run dev:frontend  # http://localhost:5173
```

Abra `http://localhost:5173` e ingrese con la contraseña definida en `COORDINADOR_PASSWORD`
(`coordinador123` si no se cambió). El frontend usa el proxy de Vite (`/api/*`) hacia el backend en
el puerto 5000, así que ambos deben estar corriendo a la vez.

**Datos de demostración:** para no capturar nada a mano, siembre datos sintéticos (8 servidores
repartidos en los 4 grupos y 2 servicios de ejemplo) con:

```bash
npm run seed:demo
```

Es idempotente: se puede correr varias veces sin duplicar datos. También hay un skill de Claude
Code que hace esto y arranca todo de una vez — ver `.claude/skills/arranque-demo/`.

### Probar el ciclo de recordatorios manualmente

Con sesión de coordinador activa en el navegador, o con `CRON_SECRET` configurado:

```bash
curl -X POST http://localhost:5000/api/enviar-recordatorios \
  -H "Authorization: Bearer <CRON_SECRET>"
```

## Pruebas

```bash
npm run test:backend
```

Ejecuta la suite completa de Vitest (84 pruebas al momento de escribir esto) contra
`TEST_DATABASE_URL`. Cubre las reglas de negocio de las cinco etapas del backend: sesión y
autenticación, cálculo de estados de servicio, administración de servidores y roles, tokens y
confirmación pública, y el ciclo de recordatorios automáticos (incluyendo su protección ante
ejecuciones concurrentes). No se limpian las filas que las pruebas insertan — quedan en la base
para revisión manual, por diseño del proyecto.

## Build de producción

```bash
npm run build   # compila backend (tsc) y frontend (vite build)
npm start       # sirve el backend compilado (dist/)
```

## Estructura del repositorio

```
backend/    API Express + TypeScript (controllers, services, models, mailer, tests)
frontend/   SPA en React 19 + Vite
docs/       Contrato de API, arquitectura, checklist de paridad funcional, seguridad
```

## Endpoints

Contrato completo, con ejemplos de cuerpo y respuesta, en [`docs/API.md`](docs/API.md). Resumen:

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/session` | Pública | Estado de la sesión actual. |
| `POST` | `/api/login` | Pública | Inicia sesión de coordinador. |
| `POST` | `/api/logout` | Pública | Cierra la sesión. |
| `GET` | `/api/groups` | Sesión | Lista los 4 grupos (Servidor, Inducción, Líder, Director). |
| `GET` | `/api/services` | Sesión | Servicios con métricas y estado calculado (RN-3/RN-4). |
| `POST` | `/api/services` | Sesión | Crea un servicio. |
| `GET` | `/api/services/:id` | Sesión | Detalle de un servicio y sus participantes convocados. |
| `GET` | `/api/services/:id/submissions` | Sesión | Historial de intentos de recordatorio del servicio. |
| `GET` | `/api/services/config` | Sesión | Días de cierre por defecto (regular/extraordinario). |
| `GET` | `/api/participants` | Sesión | Lista de servidores con su grupo y estado activo/inactivo. |
| `POST` | `/api/participants` | Sesión | Da de alta un servidor. |
| `PATCH` | `/api/participants/:id/role` | Sesión | Cambia el grupo/rol de un servidor. |
| `PATCH` | `/api/participants/:id/email` | Sesión | Edita el correo de un servidor. |
| `PATCH` | `/api/participants/:id/status` | Sesión | Desactiva/reactiva un servidor (con auditoría). |
| `GET` | `/api/servicios` | Pública (legacy) | Ruta pública heredada, sin las métricas calculadas. |
| `GET` | `/confirm/:token` | Token HMAC/JWT | Página pública de confirmación de asistencia. |
| `POST` | `/confirm/:token` | Token HMAC/JWT | Registra la respuesta (`Sí`/`No`). |
| `GET` | `/confirm/:token/:accion` | Token HMAC/JWT | Confirmación de un clic (`si`/`no`) desde el correo. |
| `GET` / `POST` | `/api/enviar-recordatorios` | Sesión o `Bearer CRON_SECRET` | Ejecuta el ciclo de recordatorios automáticos. |

## Documentación adicional

- [`ESPECIFICACION.md`](ESPECIFICACION.md) — actores, reglas de negocio (RN) y requisitos
  funcionales (RF).
- [`DISENO.md`](DISENO.md) — arquitectura, esquema de base de datos, decisiones técnicas y
  diagrama de secuencia.
- [`PLAN_IMPLEMENTACION.md`](PLAN_IMPLEMENTACION.md) / [`ESTADO_IMPLEMENTACION.md`](ESTADO_IMPLEMENTACION.md) — plan por etapas y su estado actual.
- [`docs/API.md`](docs/API.md) — contrato detallado de cada endpoint.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — vista de componentes del backend.
- [`docs/SECURITY.md`](docs/SECURITY.md) — controles de seguridad aplicados.
- [`CLAUDE.md`](CLAUDE.md) — convenciones y restricciones para el desarrollo asistido por IA de
  este repositorio.

## Estado del proyecto

Etapas 1 a 6 completadas (infraestructura y sesión, servicios y dashboard, servidores y roles,
confirmación pública por token, recordatorios automáticos y mailer, e integración fullstack
final). Pendiente, pospuesto deliberadamente: integración continua — ver `BITACORA.md` y
`ESTADO_IMPLEMENTACION.md` para el detalle.
