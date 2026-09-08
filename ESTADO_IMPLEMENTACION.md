# Estado de la Implementación por Etapas

| Etapa | Alcance / Módulo | Tipo | Estado | Pruebas Asociadas |
|---|---|---|---|---|
| **Doc Inicial** | Especificación, diseño técnico y plan | Docs | ✅ Completado | Validación documental |
| **Etapa 1** | Infraestructura, Express, Auth y Frontend Login | Fullstack | ✅ Completado | `backend/tests/etapa1.test.ts` |
| **Etapa 2** | Servicios, cálculo de estados y Frontend Dashboard | Fullstack | ✅ Completado | `backend/tests/etapa2.test.ts` |
| **Etapa 3** | Participantes, roles y Frontend Personas | Fullstack | ✅ Completado | `backend/tests/etapa3.test.ts` |
| **Etapa 4** | Tokens y Confirmación Pública Web | Backend/Público | ✅ Completado | `backend/tests/etapa4.test.ts` |
| **Etapa 5** | Recordatorios Automáticos y Servicio Mailer | Backend/Servicio | ✅ Completado | `backend/tests/etapa5.test.ts` |
| **Etapa 6** | Integración Fullstack Final y Documentación | Fullstack | ✅ Completado | Suite completa Vitest + Build E2E |
| **Etapa 7** | Persistencia de Sesión en Postgres (DM-7) y Despliegue Serverless en Vercel con npm workspaces (DM-6) | Fullstack/Infraestructura | ✅ Completado | `backend/tests/etapa7.test.ts` (sesión: 86/87 en suite completa — 1 falla preexistente y no relacionada, ver `BITACORA.md`). Verificado contra el despliegue real en producción (https://pasattendance.vercel.app): login, sesión persistida y dashboard cargando autenticado, confirmado por el usuario. |
| **Etapa 8** | Hora de Envío Configurable (RN-11/RN-12) y Planificador Local de Recordatorios | Fullstack | ✅ Completado | `backend/tests/etapa5.test.ts` (tope de RN-6 a lo largo de varios días y RN-12 — no reenvío el mismo día). |
| **Etapa 9** | Envío Manual de Recordatorios por Servicio (RN-13) | Fullstack | ✅ Completado | `backend/tests/etapa5.test.ts` (95/97 en suite completa — 2 fallas preexistentes y no relacionadas, causadas por `GMAIL_USER` configurado en el entorno local de pruebas, ver `BITACORA.md`). |
| **Etapa 10** | Catálogo de Puestos — Áreas Semilla y CRUD de Puestos (RN-17, RN-19) | Fullstack | ✅ Completado | `backend/tests/etapa10.test.ts` (14/14: siembra RN-19, validación RN-17, baja lógica, autenticación). Suite completa 111/113 (mismas 2 fallas preexistentes de `GMAIL_USER`, ver `BITACORA.md`). Verificado manualmente en el navegador (crear, editar, activar/desactivar puestos). |
| **Etapa 11** | Pantalla "Puestos" — Asignación de Puestos por Servicio (RN-14, RN-15, RN-16, RN-18) | Fullstack | ✅ Completado | `backend/tests/etapa10.test.ts` (30/30: ventana RN-14, elegibilidad RN-15 incl. Líder/Director, tope de Principal RN-16, puestos desactivados, reemplazo atómico). Suite completa 127/129 (mismas 2 fallas preexistentes de `GMAIL_USER`, ver `BITACORA.md`). Verificado manualmente en el navegador contra datos reales: asignar Principal + Secundario a un Líder sin respuesta, y ver el puesto reflejado en Gestionar Servicio. |
