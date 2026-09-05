# Inventario Funcional y Matriz de Componentes

Matriz de correspondencia entre las pantallas/componentes del **Frontend (React 19)** y los endpoints/controladores del **Backend (Node.js + Express + TypeScript)**.

---

## 1. Mapeo de Funcionalidades

| Componente / Pantalla Frontend | Endpoint Backend Consumido | Método HTTP | Controlador / Servicio Backend |
|---|---|---|---|
| `LoginPage.jsx` / `useSession.js` | `/api/login` | `POST` | `AuthController.login` |
| `LoginPage.jsx` / `useSession.js` | `/api/session` | `GET` | `AuthController.getSession` |
| `AppHeader.jsx` | `/api/logout` | `POST` | `AuthController.logout` |
| `ServicesPage.jsx` / `ServicesList.jsx` | `/api/services` | `GET` | `ServicesController.getServices` |
| `CreateServicePage.jsx` | `/api/services` | `POST` | `ServicesController.createService` |
| `CreateServicePage.jsx` / `PeoplePage.jsx` | `/api/groups` | `GET` | `GroupsController.getGroups` |
| `ServiceDetailPage.jsx` | `/api/services/:id` | `GET` | `ServicesController.getServiceDetail` |
| `ServiceSubmissionsPage.jsx` | `/api/services/:id/submissions` | `GET` | `ServicesController.getServiceSubmissions` |
| `PeoplePage.jsx` | `/api/participants` | `GET` | `ParticipantsController.getParticipants` |
| `PeoplePage.jsx` (Modal Alta) | `/api/participants` | `POST` | `ParticipantsController.createParticipant` |
| `PeoplePage.jsx` (Selector Rol) | `/api/participants/:id/role` | `PATCH` | `ParticipantsController.updateParticipantRole` |
| Enlaces de Correo (Participantes) | `/confirm/:token` | `GET` / `POST` | `ConfirmController.getForm` / `submitForm` |
| Enlaces Directos de Correo | `/confirm/:token/:accion` | `GET` | `ConfirmController.quickAction` |
| Tarea Cron / Panel de Control | `/api/enviar-recordatorios` | `GET` / `POST` | `RemindersController.triggerReminders` |
