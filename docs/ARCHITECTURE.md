# Arquitectura del Sistema e Infraestructura

## 1. Visión General de la Arquitectura
El sistema **PAS Attendance** adopta una arquitectura desacoplada y orientada a servicios, donde la interfaz de usuario opera como una Single Page Application (SPA) en **React 19** y el backend opera como una REST API en **Node.js + Express + TypeScript** con persistencia en **PostgreSQL (Neon)**.

```
┌──────────────────────────────────────────────────────────┐
│                   Cliente (Navegador)                    │
│                                                          │
│   [ React 19 SPA (Vite + React Router + CSS Modules) ]   │
│   [ Vistas Públicas de Confirmación (HTML Responsivo) ]  │
└────────────────────────────┬─────────────────────────────┘
                             │ HTTPS / REST (Cookies HTTP-only)
                             ▼
┌──────────────────────────────────────────────────────────┐
│             Backend (Node.js + TypeScript)               │
│                                                          │
│   ├── Servidor Express (CORS, JSON, Session)             │
│   ├── Capa de Controladores (Auth, Services, etc.)       │
│   ├── Capa de Servicios de Dominio (Fechas, Estados)     │
│   ├── Capa de Modelos y Consultas Parametrizadas         │
│   └── Módulo de Correo y Generador ICS (RFC 5545)        │
└────────────────────────────┬─────────────────────────────┘
                             │ TCP / TLS (pg.Pool)
                             ▼
┌──────────────────────────────────────────────────────────┐
│              Base de Datos PostgreSQL (Neon)             │
│                                                          │
│   ├── Grupo, Participante, Servicio                      │
│   └── Respuesta, Intento_Envio                           │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Componentes del Backend
1. **Módulo de Autenticación (`authController.ts`):** Gestiona el ciclo de vida de sesiones con cookies seguras y middleware `requireAuth`.
2. **Módulo de Servicios (`servicesController.ts`, `serviciosService.ts`):** Aplica las reglas de dominio para formatear nombres en español de Costa Rica, derivar estados reactivos (`Pendiente`, `Vencido`, `Cerrado`, `Completo`) y calcular orden de prioridad.
3. **Módulo de Servidores (`participantsController.ts`):** Administra el registro y cambio de roles de servidores.
4. **Módulo de Confirmación (`confirmController.ts`, `tokens/index.ts`):** Genera y valida tokens firmados HMAC/JWT de 7 días y renderiza las vistas web de confirmación con hora de llegada.
5. **Módulo de Recordatorios (`remindersController.ts`, `recordatoriosService.ts`, `mailer/`):** Automatiza el procesamiento de recordatorios con tope de 3 envíos exitosos y exclusión de líderes y directores.

---

## 3. Modelo de Persistencia y Seguridad
- **Pool de Conexiones:** Administrado por `pg.Pool` con límite de 10 conexiones simultáneas y `idleTimeout` de 30 segundos.
- **Consultas Parametrizadas:** Cero concatenación de cadenas SQL; todos los valores dinámicos se inyectan mediante parámetros posicionales (`$1, $2...`).
- **Idempotencia:** La inicialización del esquema (`initDb`) emplea `CREATE TABLE IF NOT EXISTS` y bloques transaccionales seguros.
