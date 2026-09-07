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

---

## 4. Layout y Navegación del Frontend
El panel de coordinación (rutas autenticadas) usa un layout de dashboard administrativo compuesto por componentes de `frontend/src/components/layout/`:

- **`AppLayout`:** Contenedor raíz. Compone `Sidebar` + `TopBar` + el contenido enrutado + `AppFooter`, y gestiona el estado de apertura del menú en dispositivos móviles/tablet.
- **`Sidebar`:** Navegación principal vertical (fondo verde oscuro), fija en escritorio. Contiene la identidad del sistema y los enlaces reales de navegación (Servicios, Nuevo Servicio, Servidores); resalta automáticamente la opción activa según la ruta actual.
- **`TopBar`:** Barra superior minimalista (fondo blanco, borde inferior sutil) que muestra únicamente la información del usuario autenticado (avatar, rol, menú de cierre de sesión). No repite navegación ni el nombre del sistema.
- **`PageHeader`:** Encabezado reutilizable de página (enlace de regreso opcional, título, descripción, acciones e ilustración decorativa opcional).
- **`FormSection`:** Sección con icono dentro de una tarjeta de formulario, usada para agrupar campos relacionados sin anidar tarjetas.
- **`InfoBanner`** (en `components/common/`): Aviso contextual de baja intensidad visual para mensajes informativos (no de error).

**Comportamiento responsive:**
- **Escritorio (≥ 1024px):** sidebar fijo de `256px` a la izquierda; la columna de contenido (TopBar + contenido + pie) se desplaza de forma independiente con su propio scroll.
- **Tablet y móvil (< 1024px):** el sidebar se oculta y se abre como un panel tipo *drawer* mediante un botón de menú en la esquina superior izquierda de la TopBar, con superposición (overlay) y cierre automático al seleccionar una opción o al navegar.
- Los formularios de dos columnas (por ejemplo, fecha y hora del servicio) pasan a una sola columna en pantallas angostas.

Esta estructura reemplaza la navegación horizontal previa (antes en `AppHeader`, ahora eliminado) sin alterar las rutas, los contratos de la API ni la lógica de los formularios.
