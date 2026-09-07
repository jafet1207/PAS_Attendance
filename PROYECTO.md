# Ficha del Proyecto: PAS Attendance

## Resumen Ejecutivo
**PAS Attendance** (Confirmación de Asistencia a Servicios) es un sistema fullstack que permite la administración de convocatorias y confirmación de asistencia de servidores en una iglesia.

## Stack Tecnológico
- **Frontend:** React 19, Vite, React Router 7, CSS Modules, Lucide React.
- **Backend:** Node.js, Express, TypeScript, Vitest, Supertest, Nodemailer.
- **Persistencia:** PostgreSQL (Neon) con pool nativo `pg`.
- **Seguridad:** Cookies de sesión HTTP-only, Tokens HMAC/JWT (7 días), consultas SQL parametrizadas, autorización Bearer para automatización.

## Repositorio Oficial
`https://github.com/jafet1207/PAS_Attendance.git`

## Cambios de Alcance

El enunciado y el alcance detallado (reglas de negocio, requisitos funcionales) viven en
`ESPECIFICACION.md`, `DISENO.md` y `PLAN_IMPLEMENTACION.md`. Frente a `FICHA-APROBACION.md`
(la ficha aprobada, 3 de agosto de 2026), un punto cambió durante el desarrollo:

- **2026-09-07 — Correo de acuse de recibo (RN-10) y adjunto de calendario `.ics`.** La ficha
  aprobada los declaraba explícitamente "afuera". Se incluyeron en las Etapas 4 y 5 porque, para
  cuando se construyó el servicio de correo, ya existían el mailer y la misma plantilla HTML de
  la página de confirmación web — agregar ambos envíos sobre esa base tuvo un costo marginal casi
  nulo frente al valor de que un servidor tenga comprobante de su respuesta y una invitación real
  en su calendario. No amplió de forma significativa las ~33 horas de construcción planeadas.
  Detalle completo en `FICHA-APROBACION.md` ("Cambio de alcance") y en `BITACORA.md`.
