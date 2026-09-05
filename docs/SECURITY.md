# Directrices de Seguridad y Protección de Datos

Este documento define las políticas y mecanismos de seguridad aplicados en el sistema **PAS Attendance**.

---

## 1. Gestión de Sesión y Autenticación
- **Cookies HTTP-Only:** Las cookies de sesión (`express-session`) se transmiten con la bandera `httpOnly: true`, evitando acceso directo desde scripts del cliente (mitigación de ataques XSS).
- **Protección SameSite:** Configurado con `sameSite: 'lax'` para proteger las solicitudes contra ataques CSRF.
- **Transmisión Segura:** En entornos de producción, las cookies obligan `secure: true` (HTTPS).

---

## 2. Inyección SQL y Base de Datos
- **Consultas Parametrizadas:** Toda interacción con PostgreSQL (a través de `pg`) utiliza sentencias preparadas con parámetros vinculados (`$1, $2, $3...`).
- **Validación de Tipos:** Los identificadores y parámetros numéricos son parseados estrictamente antes de llegar a la capa de persistencia.

---

## 3. Tokens Criptográficos de Confirmación Pública
- **Firma HMAC/JWT:** Los tokens de confirmación enviados a los participantes se firman con la clave secreta del servidor (`SECRET_KEY`) conteniendo `{ p: participante_id, s: servicio_id }`.
- **Tiempo de Expiración:** Cada token tiene una vida útil máxima de 7 días (`604800` segundos).
- **Control de Ventana de Servicio:** Aun con un token válido, el backend valida que la fecha actual no exceda la `fecha_cierre_confirmacion` del servicio convocado.

---

## 4. Endpoint de Automatización y Cron Jobs
- **Autorización Dual:** El endpoint `/api/enviar-recordatorios` únicamente procesa solicitudes si:
  1. Existe una sesión activa de coordinador autenticado, o bien:
  2. La petición incluye la cabecera `Authorization: Bearer <CRON_SECRET>` coincidente con la variable de entorno del servidor.
- Cualquier intento no autenticado responde inmediatamente con `401 Unauthorized`.

---

## 5. Prevención de Spam y Límites de Correo
- **Tope de Recordatorios:** Máximo 3 recordatorios exitosos por participante para un mismo servicio.
- **Tope de Notificaciones de Respuesta:** Máximo 2 correos de confirmación/cambio de respuesta por participante/servicio.
- **Exclusión de Roles:** Servidores con roles directivos (`Líder`, `Director`) quedan automáticamente excluidos del envío recurrente de recordatorios.
