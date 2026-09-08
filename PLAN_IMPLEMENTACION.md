# Plan de Implementación por Etapas Verticales

El desarrollo del proyecto se estructura en etapas incrementales y verificables siguiendo la metodología de **rebanadas verticales (Vertical Slices)** de la skill `/desarrollar-por-etapas`. Cada etapa integra su componente en el Frontend, su API/lógica en el Backend y sus pruebas automatizadas.

---

## 🗺️ Mapa de Etapas

```
[ Etapa 1: Infraestructura Base, Autenticación y Módulo de Login ]
                             │
                             ▼
[ Etapa 2: Gestión de Servicios, Cálculo de Estados y Dashboard ]
                             │
                             ▼
[ Etapa 3: Administración de Servidores, Roles y Directorio de Personas ]
                             │
                             ▼
[ Etapa 4: Tokens HMAC/JWT y Flujo de Confirmación Pública Web ]
                             │
                             ▼
[ Etapa 5: Recordatorios Automáticos y Servicio Mailer ]
                             │
                             ▼
[ Etapa 6: Integración Fullstack, Scripts de Arranque y Documentación ]
                             │
                             ▼
[ Etapa 7: Persistencia de Sesión y Despliegue Serverless en Vercel ]
                             │
                             ▼
[ Etapa 8: Ajustes de Hora de Envío y Planificador Local de Recordatorios ]
                             │
                             ▼
[ Etapa 9: Envío Manual de Recordatorios por Servicio ]
                             │
                             ▼
[ Etapa 10: Catálogo de Puestos (Áreas y CRUD de Puestos) ]
                             │
                             ▼
[ Etapa 11: Pantalla "Roles" — Asignación de Puestos por Servicio ]
```

---

## 📋 Detalle de las Etapas

### Etapa 1: Infraestructura Base, Autenticación y Módulo de Login (Fullstack)
- **Objetivo:** Establecer la base técnica, conexión con PostgreSQL, configuración de Express, sesiones HTTP-only y pantalla de inicio de sesión en React.
- **Backend:**
  - `backend/src/config/env.ts`, `backend/src/db/index.ts` (Pool Postgres y creación de tablas).
  - `backend/src/middlewares/auth.ts` (`requireAuth`).
  - `backend/src/controllers/authController.ts` (`GET /api/session`, `POST /api/login`, `POST /api/logout`).
- **Frontend:**
  - `frontend/src/styles/globals.css`, `frontend/src/styles/tokens.css` (design tokens).
  - `frontend/src/services/apiClient.js`, `frontend/src/services/sessionApi.js`.
  - `frontend/src/hooks/useSession.js`.
  - `frontend/src/pages/LoginPage.jsx` y componentes base (`Button`, `Badge`, `Skeleton`, `Layout`, `ModernFields`).
- **Pruebas:** `backend/tests/etapa1.test.ts` (validación de sesiones, login y logout).
- **Criterio de Finalización:** Login funcional en frontend y backend, cookie HTTP-only establecida y pruebas de etapa 1 pasando al 100%.

---

### Etapa 2: Gestión de Servicios, Cálculo de Estados y Dashboard (Fullstack)
- **Objetivo:** Implementar la lógica central de servicios eclesiásticos, cálculo reactivo de estados (`Pendiente`, `Vencido`, `Cerrado`, `Completo`), ordenamiento por prioridad y visualización en el dashboard de React.
- **Backend:**
  - `backend/src/models/grupo.model.ts`, `backend/src/models/servicio.model.ts`.
  - `backend/src/services/serviciosService.ts` (reglas de dominio, formato en español y cálculo de estados).
  - `backend/src/controllers/groupsController.ts` (`GET /api/groups`).
  - `backend/src/controllers/servicesController.ts` (`GET /api/services`, `POST /api/services`, `GET /api/services/:id`, `GET /api/services/:id/submissions`).
- **Frontend:**
  - `frontend/src/services/servicesApi.js`, `frontend/src/utils/date.js`.
  - Componentes de servicios: `AttendanceProgress`, `ServiceCard`, `ServiceRow`, `ServicesList`, `ServicesStats`, `ServicesToolbar`, `ServiceStatusBadge`.
  - Páginas: `ServicesPage.jsx`, `CreateServicePage.jsx`, `ServiceDetailPage.jsx`, `ServiceSubmissionsPage.jsx`.
- **Pruebas:** `backend/tests/etapa2.test.ts` (reglas de negocio, validación `fecha_cierre < fecha_servicio` y cálculo de estados).
- **Criterio de Finalización:** Dashboard de servicios y formulario de creación funcionando con cálculo reactivo de estados.

---

### Etapa 3: Administración de Servidores, Roles y Directorio de Personas (Fullstack)
- **Objetivo:** Permitir el registro de participantes, validación de unicidad de correo y asignación/cambio dinámico de roles (`Servidor`, `Inducción`, `Líder`, `Director`).
- **Backend:**
  - `backend/src/models/participante.model.ts`.
  - `backend/src/controllers/participantsController.ts` (`GET /api/participants`, `POST /api/participants`, `PATCH /api/participants/:id/role`).
- **Frontend:**
  - `frontend/src/pages/PeoplePage.jsx` (directorio de servidores, modal de alta y selector de cambio de rol).
- **Pruebas:** `backend/tests/etapa3.test.ts` (alta de participante, unicidad de correo y cambio de rol).
- **Criterio de Finalización:** Directorio de personas operativo con alta de servidores y cambio de roles en tiempo real.

---

### Etapa 4: Tokens HMAC/JWT y Flujo de Confirmación Pública Web (Backend/Público)
- **Objetivo:** Generar y verificar tokens de confirmación seguros de 7 días y renderizar interfaces HTML públicas y accesibles para que los participantes respondan `Sí` o `No`.
- **Backend:**
  - `backend/src/tokens/index.ts` (generador y verificador HMAC/JWT).
  - `backend/src/models/respuesta.model.ts` (registro y control de límite de notificaciones).
  - `backend/src/controllers/confirmController.ts` (`GET /confirm/:token`, `POST /confirm/:token`, `GET /confirm/:token/:accion`).
- **Pruebas:** `backend/tests/etapa4.test.ts` (validación de tokens, links rápidos `si`/`no`, ventana cerrada y control de respuesta).
- **Criterio de Finalización:** Enlaces web de confirmación funcionando con hora de llegada calculada y actualización permitida dentro de la ventana.

---

### Etapa 5: Recordatorios Automáticos y Servicio Mailer (Backend/Servicio)
- **Objetivo:** Automatizar la evaluación y envío diario de recordatorios a los servidores pendientes, adjuntando archivos de calendario `.ics` y aplicando reglas de exclusión y tope de envíos.
- **Pendiente de Etapa 4:** conectar el correo de acuse de recibo (RN-10) en `confirmController.ts::submitForm` — la Etapa 4 ya aplica y registra el tope de notificaciones (`Respuesta.notificaciones_enviadas`), pero no envía el correo porque el Mailer no existía todavía. Cuando `mailer/index.ts` esté listo, conectar el envío donde `resultado.debeNotificar` es `true`.
- **Backend:**
  - `backend/src/models/intentoEnvio.model.ts`.
  - `backend/src/mailer/index.ts` (`MockMailer`, `ScriptedMailer`, `GmailMailer`).
  - `backend/src/services/recordatoriosService.ts` (generación de HTML de correo, `.ics` RFC 5545 y despacho con tope de 3 exitosos).
  - `backend/src/controllers/remindersController.ts` (`GET` / `POST /api/enviar-recordatorios` protegido por sesión o Bearer `CRON_SECRET`).
- **Pruebas:** `backend/tests/etapa5.test.ts` (exclusión de líderes/directores, tope de 3 envíos, generación de ICS y simulación de fallos).
- **Criterio de Finalización:** Despacho automatizado de recordatorios operable vía cron o panel con métricas detalladas.

---

### Etapa 6: Integración Fullstack, Scripts de Arranque y Documentación (Proyecto)
- **Objetivo:** Unificar frontend y backend en los scripts raíz del repositorio, verificar la compilación y pruebas integrales de punta a punta, y documentar el proyecto.
- **Entregables:**
  - `package.json` raíz (`npm run dev`, `npm run build`, `npm test`).
  - `.gitignore` y `.env.example` raíz.
  - `README.md` actualizado con diagrama de arquitectura, guía de inicio rápido y tabla de endpoints.
- **Pruebas:** Suite completa de Vitest ejecutándose desde la raíz (45+ pruebas pasando) y `npm run build` ejecutándose limpiamente para ambos proyectos.
- **Criterio de Finalización:** Repositorio 100% operativo, compila sin errores y pasa todas las pruebas automatizadas.

---

### Etapa 7: Persistencia de Sesión y Despliegue Serverless en Vercel (Fullstack/Infraestructura)
- **Objetivo:** Que el sistema pueda desplegarse en Vercel (un solo dominio, frontend + backend) sin depender de un proceso Node persistente, según DM-6 y DM-7 de `DISENO.md`.
- **Backend:**
  - `backend/src/app.ts`: reemplaza el `MemoryStore` de `express-session` por `connect-pg-simple` sobre el mismo pool de `pg`.
  - `backend/src/db/index.ts`: agrega la tabla `session` de forma idempotente (mismo patrón que el resto del esquema).
  - `backend/src/config/env.ts`: variable `FRONTEND_ORIGIN` (o equivalente) para el origen permitido en desarrollo local; en producción de un solo dominio no hace falta CORS adicional.
  - `backend/api/index.ts` (o ruta equivalente en la raíz, según lo que exija Vercel): punto de entrada serverless que reexporta `createApp()`.
- **Infraestructura:**
  - `vercel.json` en la raíz del repositorio: `builds` explícitos para `backend/` (`@vercel/node`) y `frontend/` (`@vercel/static-build`), `routes`/`rewrites` para `/api/*` y `/confirm/*` hacia el backend, el resto hacia el build estático del frontend.
- **Pruebas:**
  - Persistencia real de sesión contra Postgres: iniciar sesión con un cliente, reutilizar la misma cookie desde un cliente/conexión nueva (simulando una invocación serverless distinta) y confirmar que sigue autenticado.
  - Regresión: sin cookie, sigue sin acceso (401), igual que antes del cambio.
- **Criterio de Finalización:** pruebas verdes localmente (incluida la de persistencia de sesión), y un primer despliegue real accesible en Vercel donde el login y el recorrido principal funcionan de punta a punta — verificado manualmente por el usuario, dado que el desarrollo no tiene acceso a la cuenta de Vercel.
- **Riesgo conocido, sin verificar en este entorno:** no fue posible ejecutar `vercel dev` ni un despliegue real durante el desarrollo (sin cuenta de Vercel conectada en este entorno); la configuración de `vercel.json` puede requerir ajustes en el primer despliegue real.

---

### Etapa 8: Ajustes de Hora de Envío y Planificador Local de Recordatorios (Fullstack)
- **Objetivo:** que el coordinador configure, desde una pantalla de Ajustes, la hora del día (UTC-6) en la que deben correr los recordatorios (RN-11), y pueda ver el envío en vivo al cambiarla sin depender de reconfigurar el cron de Vercel (DM-8).
- **Backend:**
  - `backend/src/db/index.ts`: columna `Recordatorios_Lock.hora_envio_utc6` (idempotente).
  - `backend/src/models/recordatoriosConfig.model.ts`: leer/actualizar la hora configurada.
  - `backend/src/models/intentoEnvio.model.ts`: consulta de participantes ya atendidos exitosamente "hoy" (RN-12).
  - `backend/src/services/recordatoriosService.ts`: gating por hora (`respetarHorarioConfigurado`) y regla de un envío por día.
  - `backend/src/controllers/settingsController.ts` (`GET`/`PUT /api/settings/recordatorios`, RF-6).
  - `backend/src/controllers/remindersController.ts`: el disparo automático (Bearer `CRON_SECRET`) respeta la hora configurada; un disparo manual con sesión de coordinador corre de inmediato.
  - `backend/src/server.ts`: planificador local (revisión cada minuto), solo en el proceso persistente de desarrollo.
- **Frontend:**
  - `frontend/src/pages/SettingsPage.jsx`, entrada "Ajustes" en `Sidebar.jsx`, ruta `/settings` en `App.jsx`.
  - `frontend/src/services/servicesApi.js`: `getReminderSettings`/`updateReminderSettings`.
- **Pruebas:** `backend/tests/etapa5.test.ts` — la prueba de RN-6 (tope de 3) se rehace simulando días distintos (inserta directamente 2 intentos con fecha pasada, porque llamar al ciclo varias veces en la misma corrida ya no produce varios envíos reales); nueva prueba para RN-12 (no reenvía el mismo día).
- **Criterio de Finalización:** hora configurable desde la UI, cambio de hora sin redeploy en desarrollo local, tope de RN-6 y regla de RN-12 verificados por la suite (`tsc --noEmit`, `vitest run`, `npm run build` del frontend, todos verdes).
- **Fuera de alcance (documentado, no implementado):** aumentar la frecuencia del cron de Vercel en producción para que el disparo automático real coincida con cualquier hora configurada (hoy sigue fijo en `vercel.json`, ver DM-8) — requeriría un redeploy y quedó fuera de esta etapa.

---

### Etapa 9: Envío Manual de Recordatorios por Servicio (Fullstack)
- **Objetivo:** que el coordinador pueda disparar el envío de recordatorios pendientes de un servicio puntual desde Registro de envíos, sin esperar al ciclo automático (RN-13).
- **Backend:**
  - `backend/src/services/serviciosService.ts`: campo `reminderWindowOpen` en `ServiceJson`.
  - `backend/src/controllers/remindersController.ts`: acotar `servicioIds` del cuerpo también cuando hay sesión de coordinador activa, no solo en `NODE_ENV=test`.
- **Frontend:**
  - `frontend/src/services/servicesApi.js`: `sendManualReminders(servicioId)`.
  - `frontend/src/pages/ServiceSubmissionsPage.jsx`: botón de envío manual, visible solo si `reminderWindowOpen` es `true`, con resumen del resultado y recarga de la tabla de envíos.
- **Pruebas:** `backend/tests/etapa5.test.ts` — caso de `servicioIds` acotado con sesión de coordinador (no solo `NODE_ENV=test`).
- **Criterio de Finalización:** botón visible solo dentro de la ventana RN-7, envío correcto respetando RN-6/RN-12, suite verde.

---

### Etapa 10: Catálogo de Puestos — Áreas Semilla y CRUD de Puestos (Fullstack)
- **Objetivo:** que exista el catálogo de puestos (RN-19) con el que se asignarán roles en la Etapa 11, y que el coordinador pueda mantenerlo (crear, editar, desactivar) desde la pantalla "Roles" (RN-17).
- **Backend:**
  - `backend/src/db/index.ts`: tablas `Area` y `Puesto` (idempotente, mismo patrón que el resto del esquema), con el `INSERT ... ON CONFLICT DO NOTHING` que siembra las 5 Áreas y sus puestos iniciales de RN-19.
  - `backend/src/models/area.model.ts`: `getAll()`.
  - `backend/src/models/puesto.model.ts`: `getAll()` (incluye inactivos), `create`, `update`, `setActivo`.
  - `backend/src/services/puestosService.ts`: valida el `CHECK` de RN-17 a nivel de aplicación antes de escribir (`tipo='Principal'` requiere `area_id`; `tipo='Secundario'` lo prohíbe), con el mismo mensaje de error para ambos lados.
  - `backend/src/controllers/puestosController.ts`: `GET`/`POST /api/puestos`, `PATCH /api/puestos/:id`, `PATCH /api/puestos/:id/status` (RF-7.1 a RF-7.4). Protegidos con `requireAuth`, igual que `/api/participants`.
- **Frontend:**
  - `frontend/src/pages/RolesPage.jsx` (nueva), entrada "Roles" en `Sidebar.jsx`, ruta `/roles` en `App.jsx`. En esta etapa solo contiene la sección de catálogo (tabla de puestos agrupados por Área + botón "Agregar puesto"); la lista de servicios elegibles se agrega en la Etapa 11.
  - `frontend/src/services/servicesApi.js`: `getPuestos`, `createPuesto`, `updatePuesto`, `setPuestoStatus` (agregadas al archivo existente, no en un `puestosApi.js` aparte — ver Decisión menor en `DISENO.md`).
- **Pruebas:** `backend/tests/etapa10.test.ts` (nuevo) — siembra idempotente de Áreas/Puestos, `CHECK` de RN-17 (rechaza `Principal` sin área y `Secundario` con área), baja lógica (`activo=false` no borra la fila), autenticación requerida.
- **Criterio de Finalización:** catálogo sembrado y visible en "Roles"; alta, edición y baja lógica de puestos funcionando desde la UI; `tsc --noEmit`, `vitest run`, `npm run build` del frontend verdes. **Cumplido** — ver `ESTADO_IMPLEMENTACION.md`.

---

### Etapa 11: Pantalla "Roles" — Asignación de Puestos por Servicio (Fullstack)
- **Objetivo:** que el coordinador asigne, por servicio, un puesto Principal (a lo sumo uno) y cualquier cantidad de Secundarios a cada participante elegible (RN-14, RN-15, RN-16), una vez cerrada la ventana de confirmación y mientras el servicio no haya ocurrido.
- **Backend:**
  - `backend/src/db/index.ts`: tabla `Asignacion_Puesto` (idempotente).
  - `backend/src/models/asignacionPuesto.model.ts`: `getPorServicio(servicioId)`, `reemplazarParaParticipante(participanteId, servicioId, puestoIds)` (borra e inserta dentro de una transacción, para que RF-7.6 sea una sustitución atómica del conjunto).
  - `backend/src/services/puestosService.ts`: `obtenerElegibles(servicioId)` (RN-15: respuesta `Sí`, o grupo `Líder`/`Director`); valida RN-16 (a lo sumo un `Principal` en el conjunto recibido) antes de reemplazar.
  - `backend/src/controllers/asignacionesController.ts`: `GET /api/services/:id/asignaciones`, `PUT /api/services/:id/asignaciones/:participanteId` (RF-7.5, RF-7.6).
- **Frontend:**
  - `frontend/src/pages/RolesPage.jsx`: agrega la lista de servicios dentro de la ventana de RN-14 (`!windowOpen` y la fecha calendario de `service.date` todavía no pasó — misma comparación por día, sin hora, que ya usa el resto del sistema para RN-2/RN-7 — calculado sobre los mismos campos que ya expone `GET /api/services`, sin endpoint nuevo para el listado). Al entrar a un servicio, tabla de participantes elegibles con un `ModernSelect` (Principal) y un multi-select (Secundarios) por fila.
  - `frontend/src/pages/ServiceDetailPage.jsx`: badge con el puesto Principal asignado (si existe) junto a cada participante confirmado, reutilizando `GET /api/services/:id/asignaciones`.
  - `frontend/src/services/servicesApi.js`: `getAsignaciones(servicioId)`, `guardarAsignacion(servicioId, participanteId, puestoIds)`.
- **Pruebas:** `backend/tests/etapa10.test.ts` — ventana de RN-14 (antes del cierre y después de la fecha del servicio, el servicio no aparece), elegibilidad de RN-15 (excluye a quien respondió "No" o no respondió; incluye a Líder/Director sin respuesta), tope de RN-16 (rechaza un segundo `Principal` en el mismo `PUT`), reemplazo atómico (RF-7.6 dos veces seguidas no acumula filas viejas).
- **Criterio de Finalización:** flujo completo verificado manualmente (crear puesto → cerrar ventana de un servicio de prueba → asignar Principal/Secundarios → verse en Gestionar Servicio); suite verde (`tsc --noEmit`, `vitest run`, `npm run build`).
