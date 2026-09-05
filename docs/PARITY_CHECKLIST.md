# Lista de Verificación de Paridad Funcional

Esta lista asegura que la nueva arquitectura en Node.js + TypeScript y React cumpla al 100% con todos los requisitos del sistema original.

---

## 1. Módulo de Servicios y Dashboard
- [x] Validación estricta: `fecha_cierre_confirmacion < fecha_servicio`.
- [x] Cálculo reactivo de 4 estados: `Pendiente`, `Vencido`, `Cerrado`, `Completo`.
- [x] Ordenamiento de servicios por orden de criticidad (`Vencido` > `Pendiente` > `Cerrado` > `Completo`) y secundariamente por fecha cronológica ascendente.
- [x] Formateo de fechas en español (variante Costa Rica: "Setiembre").
- [x] Cálculo dinámico de horas de llegada según grupo (`Servidor` = -1.5h, `Inducción` = -2h).

---

## 2. Módulo de Servidores y Roles
- [x] Validación de unicidad de correo electrónico al registrar participantes.
- [x] Modificación y cambio dinámico de rol (`groupId`).
- [x] Filtrado de servidores por servicio convocado.

---

## 3. Módulo de Confirmación Pública
- [x] Tokens HMAC/JWT válidos por 7 días (`604800` segundos).
- [x] Enlaces de confirmación rápida (`/confirm/:token/si`, `/confirm/:token/no`).
- [x] Bloqueo de cambios de respuesta si la fecha actual supera `fecha_cierre_confirmacion`.
- [x] Visualización del estado actual y hora de llegada recomendada en la confirmación exitosa.

---

## 4. Módulo de Recordatorios Automáticos
- [x] Exclusión de grupos directivos (`Líder`, `Director`).
- [x] Límite de envío: se dejan de enviar recordatorios un día antes del cierre (`hoy > fecha_cierre - 1`).
- [x] Omisión de participantes que ya confirmaron.
- [x] Tope estricto de máximo 3 recordatorios exitosos por participante/servicio.
- [x] Generación de adjunto de calendario `.ics` RFC 5545 con zona horaria Costa Rica (UTC-6).
- [x] Autenticación dual (Sesión o Bearer `CRON_SECRET`).
