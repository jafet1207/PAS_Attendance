# Plan de Implementación por Etapas Verticales

El desarrollo del proyecto se estructura en **6 etapas incrementales y verificables** siguiendo la metodología de **rebanadas verticales (Vertical Slices)** de la skill `/desarrollar-por-etapas`. Cada etapa integra su componente en el Frontend, su API/lógica en el Backend y sus pruebas automatizadas.

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
