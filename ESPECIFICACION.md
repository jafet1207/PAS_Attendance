# Especificación de Requisitos de Software

## Nombre del Proyecto
**Confirmación de Asistencia a Servicios (PAS Attendance)**

---

## 1. Declaración del Problema y Contexto
La coordinación de servidores de la iglesia requiere una plataforma centralizada y eficiente para planificar los servicios eclesiásticos (regulares y extraordinarios), convocar a los diferentes grupos de servidores (`Servidor`, `Inducción`, `Líder`, `Director`), y automatizar el proceso de confirmación de asistencia mediante el envío de correos electrónicos con enlaces directos y recordatorios periódicos.

El sistema debe operar de forma desacoplada con un **Frontend en React 19 + Vite** y un **Backend en Node.js + Express + TypeScript** respaldado por una base de datos relacional **PostgreSQL en la nube (Neon)**.

---

## 2. Actores del Sistema
1. **Coordinador:** Administrador que inicia sesión con contraseña maestra, crea servicios, gestiona servidores, cambia roles de participantes y supervisa el avance de las confirmaciones.
2. **Participante / Servidor:** Integrante de un grupo convocado que recibe correos de invitación y recordatorios con enlaces firmados seguros para confirmar (`Sí`) o declinar (`No`) su asistencia.
3. **Automatización (Cron Job):** Tarea programada diaria que invoca el endpoint de recordatorios para evaluar y despachar correos a los servidores pendientes.

---

## 3. Reglas de Negocio (RN)
- **RN-1 (Validación de Fechas de Servicio):** La `fecha_cierre_confirmacion` debe ser estrictamente anterior a la `fecha_servicio` (`fecha_cierre_confirmacion < fecha_servicio`).
- **RN-2 (Ventana de Confirmación):** Un participante solo puede confirmar o modificar su respuesta mientras la fecha actual sea menor o igual a la fecha de cierre (`hoy <= fecha_cierre_confirmacion`).
- **RN-3 (Cálculo de Estados de Servicio):**
  - Si la ventana está **abierta**:
    - `pendientes == 0` → Estado: **`Completo`**
    - `pendientes > 0` → Estado: **`Pendiente`**
  - Si la ventana está **cerrada**:
    - `pendientes == 0` → Estado: **`Cerrado`**
    - `pendientes > 0` → Estado: **`Vencido`**
- **RN-4 (Prioridad de Atención del Dashboard):** Los servicios en el dashboard se ordenan por criticidad: `Vencido` (prioridad 0) > `Pendiente` (prioridad 1) > `Cerrado` (prioridad 2) > `Completo` (prioridad 3), y secundariamente por fecha cronológica ascendente.
- **RN-5 (Exclusión de Recordatorios para Líderes y Directores):** Los participantes de los grupos `Líder` y `Director` nunca reciben recordatorios automáticos por correo.
- **RN-6 (Tope de Recordatorios Exitosos):** Un participante nunca recibirá más de 3 recordatorios exitosos para un mismo servicio.
- **RN-7 (Límite de Envío de Recordatorios):** Se dejan de enviar recordatorios automáticos un día antes del cierre (`hoy > fecha_cierre_confirmacion - 1 día`).
- **RN-8 (Hora de Llegada según Grupo):**
  - `Servidor`: Llegada 1.5 horas antes del inicio del servicio.
  - `Inducción`: Llegada 2.0 horas antes del inicio del servicio.
- **RN-9 (Tokens de Confirmación):** Los enlaces de correo contienen tokens HMAC/JWT válidos por 7 días (`604800` segundos).
- **RN-10 (Límite de Notificaciones de Respuesta):** Se envía un correo de acuse de recibo en la primera confirmación y un máximo de 1 correo adicional si el usuario cambia de respuesta (tope de 2 correos de confirmación por participante/servicio).

---

## 4. Requisitos Funcionales (RF)

### RF-1: Autenticación y Gestión de Sesión
- `RF-1.1`: `GET /api/session` - Retornar estado actual de autenticación (`{ authenticated: boolean, role: 'coordinador' | null }`).
- `RF-1.2`: `POST /api/login` - Validar contraseña del coordinador y generar cookie de sesión HTTP-only (`express-session`).
- `RF-1.3`: `POST /api/logout` - Destruir la sesión activa y expirar la cookie.

### RF-2: Gestión de Servicios
- `RF-2.1`: `GET /api/services` - Listar servicios con métricas calculadas (`invited`, `confirmed`, `pending`, `confirmationPercentage`, `windowOpen`, `daysUntilClosing`, `status`) ordenados por prioridad de atención.
- `RF-2.2`: `POST /api/services` - Crear nuevo servicio validando `fecha_cierre < fecha_servicio` y campos requeridos.
- `RF-2.3`: `GET /api/services/:id` - Obtener detalle completo de un servicio con la lista de participantes y el estado de su último recordatorio.
- `RF-2.4`: `GET /api/services/:id/submissions` - Historial cronológico de todos los intentos de recordatorios del servicio.

### RF-3: Administración de Servidores y Grupos
- `RF-3.1`: `GET /api/groups` - Listar grupos disponibles (`Servidor`, `Inducción`, `Líder`, `Director`).
- `RF-3.2`: `GET /api/participants` - Listar participantes registrados con su grupo asignado. Un servicio convoca a todos los participantes por igual (ver RF-2), por lo que no existe filtro por `service_id`; el estado de confirmación por servicio se consulta en `GET /api/services/:id`.
- `RF-3.3`: `POST /api/participants` - Registrar nuevo servidor validando unicidad de correo electrónico.
- `RF-3.4`: `PATCH /api/participants/:id/role` - Modificar el rol/grupo asignado a un servidor.

### RF-4: Confirmación Pública por Enlace (Participantes)
- `RF-4.1`: `GET /confirm/:token` - Renderizar interfaz web limpia y accesible para que el participante confirme asistencia o visualice el estado si la ventana cerró.
- `RF-4.2`: `POST /confirm/:token` - Procesar envío de respuesta (`Sí` / `No`) validando vigencia de la ventana y token.
- `RF-4.3`: `GET /confirm/:token/:accion` - Endpoint de confirmación de un solo clic (`si` / `no`) para los botones de acción del correo electrónico.

### RF-5: Automatización y Despacho de Recordatorios
- `RF-5.1`: `GET` / `POST /api/enviar-recordatorios` - Ejecutar evaluación diaria y despacho de correos electrónicos con cuerpo HTML y adjunto de calendario RFC 5545 (`.ics`).
- `RF-5.2`: Proteger el endpoint mediante sesión activa o header `Authorization: Bearer <CRON_SECRET>`.
- `RF-5.3`: Registrar cada intento en `Intento_Envio` con resultado `exitoso` o `fallido`.

---

## 5. Requisitos No Funcionales (RNF)
- **RNF-1 (Seguridad en Base de Datos):** Todas las sentencias SQL deben ser parametrizadas con placeholders (`$1, $2...`) garantizando inmunidad contra inyección SQL.
- **RNF-2 (Rendimiento y Conexiones):** Uso de pool de conexiones (`pg.Pool`) optimizado para bases de datos en la nube (Neon).
- **RNF-3 (Compatibilidad y UI):** Cumplimiento estricto con los contratos JSON esperados por el frontend en React 19.
- **RNF-4 (Accesibilidad y Estilo):** Diseño con contraste WCAG AA, paleta visual con verde institucional (`#2E5A44`) y componentes responsivos en CSS Modules.
- **RNF-5 (Pruebas Automatizadas):** Cobertura mediante pruebas unitarias y de integración en Vitest para cada etapa vertical.
