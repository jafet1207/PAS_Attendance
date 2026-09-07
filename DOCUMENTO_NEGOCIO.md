# Documento de Negocio — PAS Attendance

*Origen de cada cifra marcado entre corchetes: **[medido]** viene de una regla implementada y
probada en el sistema; **[estimado/declarado]** viene de `FICHA-APROBACION.md`; **[supuesto]** es
una estimación razonada, hecha explícita en este documento, no medida.*

---

## 1. La oportunidad

### Situación actual

Una iglesia con **~100 servidores convocados** [estimado/declarado] confirma su asistencia hoy
mediante una app móvil externa cuyo enlace de confirmación falla con frecuencia. Cuando eso
pasa, el coordinador saca un reporte en Excel a mano y persigue a los pendientes por WhatsApp,
en su propio tiempo personal — no en horario asignado para esa tarea.

El síntoma medible que motivó el proyecto: **hasta 55 de cada 100 servidores siguen sin
confirmar a mitad de semana** [estimado/declarado], y no hay ninguna lista automática de quién
falta — el coordinador la reconstruye cada vez que decide revisar.

### Situación esperada con el prototipo

El sistema construido (Etapas 1-5, ver `ESTADO_IMPLEMENTACION.md`) reemplaza ese proceso con:

- Envío automático de recordatorios diarios por correo a quien no ha respondido, con enlaces de
  confirmación de un solo clic (`Sí` / `No`).
- Un **tope garantizado de al menos 3 recordatorios exitosos** por servidor y por servicio antes
  de dejar de insistir (RN-6) — "exitosos", no "intentos": un envío fallido no cuenta contra ese
  mínimo. **[medido]** — es una regla de negocio implementada y cubierta por prueba automatizada
  (`backend/tests/etapa5.test.ts`, caso "RN-6: tope de 3 recordatorios exitosos").
- Una lista de pendientes que el sistema calcula al instante (`GET /api/services`), en vez de
  reconstruirla a mano desde un Excel.

### La comparación

| | Antes | Después |
|---|---|---|
| Cómo se sabe quién falta | Reconstruir un Excel a mano | Lista automática, siempre actualizada |
| Recordatorio al pendiente | Mensaje manual de WhatsApp, si el coordinador tiene tiempo | Mínimo 3 intentos automáticos garantizados |
| Dónde vive el trabajo | Tiempo personal del coordinador | Un cron / clic del coordinador (`/api/enviar-recordatorios`) |
| Con quién compite el problema | Enlace de confirmación que a veces no llega | Enlace firmado (HMAC/JWT), válido 7 días, con acción de un clic |

La comparación se sostiene en el trabajo de decidir y perseguir que hoy consume tiempo personal,
no en que "antes nadie confirmaba": el sistema no aumenta cuántos servidores responden por sí
mismos, automatiza que se les insista y deja ver quién falta sin reconstruirlo a mano.

---

## 2. Escenarios de adopción

### Escenario A — Adopción total (reemplazar la app externa)

El coordinador deja de usar la app externa y usa PAS Attendance como único canal de convocatoria
y confirmación.

| Riesgo | Tipo | Mitigación |
|---|---|---|
| Tope de envío de un Gmail personal (~100 correos/día) | Técnico | **Ya mitigado en el diseño**: el contador de RN-6 cuenta envíos exitosos, no intentos ni días fijos, así que un envío fallido no deja a nadie por debajo del mínimo garantizado (ver `FICHA-APROBACION.md`, "La decisión difícil"). |
| Una sola contraseña de coordinador compartida, sin cuentas individuales | Operativo | Ya existe una auditoría parcial (`Historial_Participante` registra desactivaciones con actor genérico "Coordinador"). Cuentas individuales por persona quedan fuera del alcance de esta entrega — es la limitación conocida más relevante para una adopción real con más de una persona coordinando. |
| Datos personales (nombre, correo, asistencia) de ~100 personas en una base de datos en la nube | Ético / regulatorio | Todo el desarrollo y las pruebas de este repositorio usaron **datos sintéticos** (`@ejemplo-sintetico.test`), nunca datos reales de la congregación. Antes de cargar datos reales hace falta: (1) informar a los servidores qué datos se procesan y con qué fin, y (2) confirmar que la política de privacidad de Neon (el proveedor de base de datos) es aceptable para la iglesia. Ninguna de las dos cosas está resuelta todavía — es una condición para adoptar, no un detalle técnico. |
| El correo de recordatorio no llega (spam, buzón lleno) | Técnico | El sistema ya registra cada intento con su resultado (`Intento_Envio`) y lo muestra en "Ver envíos" por servicio — el coordinador puede ver quién nunca recibió nada, en vez de asumir que todos los correos llegaron. |

### Escenario B — Piloto en paralelo (correr ambos sistemas unas semanas)

| Riesgo | Tipo | Mitigación |
|---|---|---|
| Servidores reciben recordatorios duplicados de los dos sistemas y se confunden sobre cuál responder | Operativo | Definir una fecha de corte firme y comunicarla una sola vez; no dejar el paralelo abierto indefinidamente. Un piloto sin fecha de corte es, en la práctica, el Escenario A a medias. |
| El coordinador compara resultados entre ambos sistemas y pierde el tiempo que se quería ahorrar | Operativo | Limitar el paralelo a un solo servicio de prueba, no a toda la convocatoria, mientras dure el piloto. |

### Escenario C — No adopción (seguir con el proceso manual)

No introduce riesgo nuevo, pero tampoco resuelve el problema declarado: el coordinador sigue
gastando tiempo personal en decidir a quién escribir, y el síntoma de fondo (hasta 55 de 100 sin
confirmar a mitad de semana) permanece igual. Se incluye como referencia, no como alternativa
recomendada.

---

## 3. Hoja de ruta y estimación de retorno

### Supuestos declarados explícitamente

- **Horas de construcción:** ~33 horas (10 h/semana × 5 semanas), según lo declarado en
  `FICHA-APROBACION.md`. **[estimado/declarado]**
- **Horas semanales que hoy se van en el seguimiento manual:** no se midió con un cronómetro
  durante el proyecto. Se declara aquí un **supuesto de ~5 horas/semana** [supuesto], construido
  de abajo hacia arriba: revisar y actualizar el Excel (~1 h) + escribir individualmente a los
  pendientes por WhatsApp, hasta 55 personas a un ritmo de 2-3 minutos cada una (~2-2.5 h) +
  atender dudas y confirmaciones que llegan por ese mismo canal (~1-1.5 h).
- **Cuánto de esas horas absorbe el sistema:** se asume que el sistema elimina la parte que hoy
  es puramente mecánica (armar la lista, decidir a quién insistir, redactar y enviar el mensaje),
  pero no elimina por completo el rol del coordinador — se asume que sigue revisando el dashboard
  y atendiendo casos excepcionales. **Supuesto: reduce esas ~5 h/semana a ~1 h/semana**, un ahorro
  neto de **~4 horas/semana**. [supuesto]
- **Mantenimiento del sistema:** se asume **~1 hora/semana** [supuesto] para monitorear que los
  recordatorios se enviaron (revisar el conteo de `recordatorios_fallidos` que ya retorna el
  endpoint), vigilar el límite diario de la cuenta de Gmail, y atender consultas puntuales de
  servidores sobre sus enlaces.

### El cálculo

Ahorro neto semanal tras descontar el mantenimiento: **4 h − 1 h = 3 h/semana**.

Con esas ~33 horas de construcción, el punto de equilibrio (cuándo el tiempo ahorrado iguala el
tiempo invertido en construir) llega alrededor de **11 semanas de uso real** (33 ÷ 3 ≈ 11), unos
2.5 meses después de empezar a usarlo con datos reales. Este cálculo depende enteramente de los
supuestos declarados arriba — si el seguimiento manual real toma menos de 5 h/semana, el punto de
equilibrio se aleja; si toma más, se acerca. No se presenta como una cifra financiera precisa,
sino como el razonamiento que sustenta que la inversión de construcción se recupera en un plazo
de semanas, no de meses o años.

### Hoja de ruta (qué sigue después de esta entrega)

| Cuándo | Qué |
|---|---|
| Antes de cargar datos reales | Resolver las dos condiciones éticas/regulatorias del Escenario A: informar a los servidores y confirmar la política de privacidad del proveedor de base de datos. |
| Corto plazo | Integración continua (pruebas corriendo en cada push) — pospuesta deliberadamente en esta entrega, ver `BITACORA.md`. |
| Mediano plazo | Cuentas individuales de coordinador (hoy hay una sola contraseña compartida), para que la auditoría de `Historial_Participante` registre quién actuó, no solo "Coordinador" genérico. |
| Pendiente de resolver antes de la entrega final | **`FICHA-APROBACION.md` declaró "afuera" el correo de confirmación al responder y la invitación de calendario (ICS) — pero ambos se terminaron construyendo (RN-10 en Etapa 4/5, y el adjunto `.ics` en Etapa 5). Es un cambio de alcance respecto a lo aprobado que la consigna exige documentar y justificar; falta actualizar `PROYECTO.md`/`FICHA-APROBACION.md` con ese cambio y su razón antes de entregar.** Siguen fuera de alcance, sin cambios: reporte histórico de 6 meses, exportación CSV, resumen por correo a Líder/Director. |
