# Bitácora del Proceso — PAS Attendance

Registro fechado de decisiones, encargos determinantes y correcciones de rumbo durante el
desarrollo asistido por Claude Code. Las fechas y horas de los commits son las que reporta
`git log`; el resto de los hechos (revisiones, hallazgos, correcciones) ocurrieron en las
sesiones de trabajo entre esos commits y se fechan por el día de la sesión.

Las entradas marcadas **[Gobernanza]** son las que exige la consigna: casos reales, ocurridos
durante este proyecto, en que el agente afirmó o implementó algo incorrecto, cómo se detectó, y
qué control quedó establecido para que no se repita.

---

## 2026-09-04 — Fundación del proyecto

**21:59 · `198b778`** — Documentación base inicial (`CLAUDE.md`, ficha del proyecto).

**22:45 · `5a26fe4`** — `ESPECIFICACION.md`, `DISENO.md` y `PLAN_IMPLEMENTACION.md`.
**Decisión:** desarrollar en 6 etapas verticales (infraestructura → servicios → servidores →
confirmación pública → recordatorios → integración final), cada una con su propia prueba
automatizada, en vez de construir capa por capa (todo el backend, luego todo el frontend). La
razón: cada etapa entrega un recorrido observable de punta a punta, verificable por separado.

**23:21 · `364e9c3`** — Etapa 1: Postgres (`pg.Pool` nativo, sin ORM), Express, sesión HTTP-only,
login del coordinador.

## 2026-09-07, madrugada — Etapas 2 a 4

**00:24 · `919389c`** — Etapa 2: servicios, cálculo de los 4 estados (RN-3) y dashboard.

**00:40 · `cf2c25e`** — Etapa 3: alta de servidores, roles y unicidad de correo.

**00:56 · `75bed95`** — Etapa 4: tokens HMAC/JWT y confirmación pública por enlace.

## 2026-09-07, mañana — Ajustes de UI y gestión de servidores

Sesión centrada en pulir la interfaz entregada en las etapas anteriores y en una funcionalidad
nueva pedida por el usuario: editar el correo de un servidor y desactivarlo/reactivarlo sin
perder el historial de convocatorias.

**Encargos determinantes:**
- Corregir varios defectos de UI señalados por el usuario probando la app en el navegador
  (scrollbar de modales, z-index de combos con portal, hover ilegible en botón deshabilitado,
  navegación con flechas en combo).
- "Que se pueda editar el correo y desactivar/reactivar servidores" → llevó a agregar la columna
  `activo` en `Participante`, la tabla `Historial_Participante` (auditoría) y la regla: si el
  servidor a desactivar ya confirmó "Sí" a un servicio próximo, el backend exige un comentario de
  justificación antes de aceptar la baja.

**10:21 · `178b62e`** — Commit de todo lo anterior, autorizado explícitamente por el usuario
antes de ejecutarse (política del proyecto: nunca hacer commit sin pedirlo).

## 2026-09-07, tarde — Etapa 5 y cierre de brechas (esta sesión)

**Implementación de Etapa 5** (recordatorios automáticos y servicio mailer): `MockMailer` /
`ScriptedMailer` / `GmailMailer`, generación de `.ics` RFC 5545, endpoint
`GET`/`POST /api/enviar-recordatorios` con autenticación dual (sesión o `Bearer CRON_SECRET`), y
conexión del acuse de recibo pendiente desde Etapa 4 (RN-10).

### Primera revisión de entrega (`/revisar-entrega`)

El primer reporte de cierre de etapa, escrito por el propio agente inmediatamente después de
implementar, decía que la etapa estaba lista con 11 pruebas en verde. Una revisión adversarial
posterior, pedida explícitamente por el usuario, encontró dos hallazgos de severidad alta que esa
primera pasada no había señalado:

> **[Gobernanza] Caso 1 — Advisory lock que no funcionaba en el entorno real.**
> **Qué se afirmó/implementó:** para evitar que dos ejecuciones concurrentes del ciclo de
> recordatorios enviaran correos duplicados, el agente implementó un `pg_try_advisory_lock` /
> `pg_advisory_unlock` de Postgres y lo presentó como la solución al riesgo de concurrencia,
> sin advertir ninguna limitación.
> **Cómo se detectó:** no releyendo el código, sino escribiendo una prueba que fuerza la
> concurrencia real (dos llamadas en `Promise.all` con un mailer con demora artificial). La
> prueba falló: las dos ejecuciones procesaban los datos, ninguna se omitía. La causa: el
> `DATABASE_URL` de este proyecto usa el endpoint *pooled* de Neon (PgBouncer en modo
> transacción), que no garantiza que un advisory lock de sesión persista entre sentencias del
> mismo cliente lógico — el supuesto en el que se apoyaba la implementación era falso para este
> entorno concreto.
> **Control establecido:** se reemplazó el mecanismo por un lock de una sola fila
> (`Recordatorios_Lock`, `UPDATE` atómico de una sola sentencia, que no depende de la identidad
> de la conexión), se dejó la razón documentada en `DISENO.md` (DM-4) para que no se reintente la
> misma solución en el futuro, y se conservó la prueba de concurrencia como regresión permanente
> (`backend/tests/etapa5.test.ts`, "Lock del ciclo: una invocación concurrente se omite...").

El mismo pase de revisión encontró un segundo hallazgo alto: dos pruebas de integración
ejecutaban un barrido sin acotar sobre la base de datos compartida, dependiendo silenciosamente
de que nadie configurara credenciales reales de Gmail en el entorno donde corre la suite — un
supuesto correcto hoy, pero no verificado por el propio diseño de la prueba. Se corrigió
agregando una aserción que falla explícitamente si esas credenciales llegan a estar presentes, y
después (a pedido del usuario, "Mejoremos eso para mitigar los hallazgos") se eliminó el riesgo
de raíz acotando esas pruebas igual que el resto, sin perder cobertura de la autenticación dual.

**15:12 · `c1a7aab`** — Commit de Etapa 5, con los dos hallazgos ya resueltos y una tercera ronda
de revisión limpia. Autorizado explícitamente por el usuario.

### Auditoría de pruebas unitarias (`/pruebas-unitarias`)

A pedido del usuario ("revise si ya están creadas para todas mis etapas hasta el momento"), se
comparó cada regla de negocio de `ESPECIFICACION.md` contra las pruebas realmente existentes.
Se encontraron 6 reglas documentadas sin ninguna prueba: el orden de prioridad del dashboard
(RN-4), el camino feliz de `GET /api/groups`, el conflicto de correo duplicado y el 404 al editar
un servidor inexistente, el contenido de la auditoría `Historial_Participante`, y — el más
relevante — el tope de notificaciones de respuesta (RN-10) y el envío del acuse de recibo
conectado esta misma sesión, que no tenían ninguna prueba pese a ser código de producción real.
El usuario pidió cubrir los 6; se agregaron 10 pruebas nuevas y se verificó la suite completa.

### Caso borde del `.ics` y su corrección

Al explicarle al usuario un hallazgo de revisión de menor severidad (un desajuste de sub-minuto
entre la hora de llegada mostrada en el correo y el adjunto de calendario, si algún grupo llegara
a configurarse con un buffer que no cayera en un número entero de minutos), el usuario pidió
corregirlo igual, aunque hoy no ocurre con los valores reales. Se centralizó el redondeo en un
solo lugar (`obtenerBufferLlegadaHoras`) y se agregó una prueba de regresión con un valor
fraccionario hipotético (1.51h) que demuestra que ambos caminos ahora coinciden al segundo.

### Revisión de la consigna del curso

A pedido del usuario, se comparó la consigna oficial (`Consigna Proyecto del Curso -
SINT-732.docx`) contra el estado real del repositorio. Se encontraron brechas críticas: no
existía `README.md` en la raíz, `.claude/` estaba completo en `.gitignore` (por lo que ningún
skill del proyecto podría llegar nunca al repositorio entregado), no había integración continua,
no había bitácora, y el historial de commits tenía solo dos fechas de calendario (4 y 7 de
septiembre) — un riesgo que la propia consigna advierte explícitamente para el criterio 4 y que
no se puede corregir retroactivamente sin falsear la evidencia que la consigna pide.

- **README.md**: se escribió y se verificó ejecutando literalmente cada comando que describe
  (`npm run build`, `npm run test:backend`) desde una terminal limpia, no solo redactándolo.
  En el camino se encontró que `npm test` fallaba de forma intermitente por *file parallelism*
  de Vitest contra la base compartida; se corrigió con `backend/vitest.config.ts`
  (`fileParallelism: false`) y se confirmó con dos corridas consecutivas en verde.

> **[Gobernanza] Caso 2 — Script de siembra que se afirmó idempotente sin serlo.**
> **Qué se afirmó/implementó:** al crear `backend/src/scripts/seedDemo.ts` (para el skill de
> arranque), la comparación de fechas para evitar duplicar un servicio usaba
> `String(fecha).slice(0,10)`.
> **Cómo se detectó:** el agente mismo, antes de darlo por terminado, corrió el script dos veces
> seguidas para probar la idempotencia que acababa de afirmar — la segunda corrida creó los
> servicios de nuevo en vez de omitirlos, porque `String()` sobre un objeto `Date` de JavaScript
> produce un formato legible (`"Mon Sep 14 2026..."`), no `YYYY-MM-DD`, así que la comparación de
> fechas nunca coincidía.
> **Control establecido:** se reemplazó por `formatDateYMD`, la misma función que ya usa el resto
> del proyecto para este propósito exacto, y se volvió a correr el script tres veces para
> confirmar la idempotencia real antes de reportarla. Las dos filas de servicio duplicadas que
> ese bug alcanzó a crear en la base real quedaron identificadas por id (228 y 229) y sin
> resolver a la fecha de esta entrada: el intento de borrarlas fue bloqueado por el clasificador
> de seguridad de la herramienta, y el usuario decidió dejarlas (no afectan la demo).

- **`.claude/skills/arranque-demo/`**: skill del proyecto (siembra + arranque + reporte de URL y
  contraseña), y ajuste quirúrgico de `.gitignore` para que sí quede versionado.
- Integración continua: **pospuesta a pedido explícito del usuario** ("aún no porque faltan
  etapas del desarrollo") — no es un olvido, es una decisión registrada.

### `BITACORA.md` (este documento) y `DOCUMENTO_NEGOCIO.md`

Al pedir una cifra real para la hoja de ruta y ROI (horas semanales del seguimiento manual hoy),
el usuario confirmó que nunca se midió; se declaró como supuesto explícito (~5 h/semana,
desglosado) en vez de inventar una medición que no existe.

Al redactar la hoja de ruta del documento de negocio, comparar el alcance realmente construido
contra `FICHA-APROBACION.md` sacó a la luz que la ficha **aprobada** (3 de agosto) declaraba
"afuera" el correo de acuse de recibo (RN-10) y el adjunto `.ics`, y ambos se construyeron igual
en las Etapas 4 y 5 — un cambio de alcance sin documentar, que la consigna exige justificar
explícitamente. Se le preguntó al usuario la razón real (no se inventó una justificación
plausible): **costo marginal casi nulo** una vez que ya existían el mailer y la plantilla HTML de
confirmación construidos para otra cosa. Con esa razón confirmada, se actualizaron
`FICHA-APROBACION.md` (fila "Queda afuera" y una entrada fechada "Cambio de alcance") y
`PROYECTO.md` (nueva sección "Cambios de Alcance"), tal como exige la consigna.

## 2026-09-07, noche — Etapa 7: sesión persistida y despliegue real en Vercel

### Despliegue real: causa raíz y correcciones (gobernanza)

Al desplegar por primera vez contra una cuenta real de Vercel, una serie de fallos aparentemente
inconexos (extensión de archivo no detectada como función, `includeFiles` sin efecto, un empaque
autocontenido que agotaba la memoria del compilador de Vercel, archivos de datos no-JS ausentes en
tiempo de ejecución) resultaron tener la misma causa raíz: `backend/` vivía como paquete npm
separado, fuera del árbol de dependencias que las herramientas de Vercel rastrean de forma
confiable. La corrección definitiva —adoptar *npm workspaces*— revirtió una decisión de diseño ya
tomada en DM-6 ("sin *workspaces*, costo marginal casi nulo de mantenerlos separados"), motivada
por evidencia real y repetida del despliegue, no por preferencia estética. Se le explicó el cambio
de alcance al usuario antes de implementarlo y se pidió autorización explícita.

Después de resolver el despliegue en sí, un segundo problema (sesión de login sin `Set-Cookie` en
producción) no se pudo reproducir localmente con `supertest` pese a varios intentos — el entorno
real de ejecución serverless de Vercel difiere de cualquier simulación local. Una primera hipótesis
(`trust proxy`) se probó y se demostró localmente que **no** explicaba el síntoma por sí sola, y se
documentó así en vez de presentarla como la causa confirmada. Se llegó a preparar un prompt de
traspaso completo para continuar la investigación en una sesión nueva (con todo lo descartado y las
pistas pendientes), pero el propio fix de `trust proxy`, ya desplegado, resultó ser la corrección
correcta — confirmado por el usuario probando el login real en producción.

### Hallazgo no relacionado, reportado por separado

Al migrar a *npm workspaces*, la suite completa pasó de 87/87 a 86/87: un test de
`ventanaDeConfirmacionAbierta` (RN-2) falla de forma intermitente por un problema preexistente del
propio test, no de la migración — su helper `addDays` calcula el día con `new Date().toISOString()`
(UTC) en vez de la zona horaria de negocio (Costa Rica, UTC-6), así que cerca de la medianoche UTC
locale puede cruzar un límite de día distinto al que usa la lógica de producción. No se corrigió en
el momento (fuera del alcance de la tarea en curso) — queda pendiente como hallazgo reportado.

### Limpieza de historial (gobernanza)

A pedido explícito del usuario ("necesito limpiar un poco los commits... al menos no tener tantos"),
los 12 commits de esta etapa (desde `feat(fullstack): etapa 7...` hasta el fix de `trust proxy`) se
aplastaron (`git reset --soft` + recommit) en 2 commits — uno para el código, otro para los ajustes
de CI — verificando antes del push que el árbol final fuera *idéntico byte a byte* al que ya estaba
desplegado (`git diff <commit-viejo> <commit-nuevo>` vacío). Como ya estaba publicado en `origin/main`,
esto requirió `git push --force`, que GitHub rechazó por la regla de protección de rama ("Cannot
force-push to this branch") configurada en la Etapa 6 para la demo de CI; el usuario activó
temporalmente "Allow force pushes" en el ruleset para permitirlo. Se pidió autorización explícita
para el squash y, por separado, para el force-push, antes de ejecutar cualquiera de los dos.

---

## Qué se revisó siempre / qué se delegó sin revisión

**Siempre revisado antes de reportar algo como terminado:**
- Cada cambio de código pasó por `tsc --noEmit` y la suite de Vitest (o el subconjunto afectado)
  antes de describirse como completo; ningún hallazgo de una revisión se dio por resuelto sin
  volver a ejecutar las pruebas.
- Toda operación con efecto externo real — commits, y cualquier `DELETE` contra la base de
  datos — se propuso primero y se ejecutó solo con autorización explícita del usuario en el
  mensaje inmediatamente anterior.
- Los hallazgos de las revisiones (`/revisar-entrega`) se sustentaron releyendo el diff real y,
  cuando fue posible, demostrándolos con una prueba que falla antes de la corrección — no solo
  describiendo el riesgo en abstracto (el caso del advisory lock es el ejemplo).

**Delegado sin revisión línea por línea:**
- El código fuente de las dependencias de terceros (`pg`, `nodemailer`, `jsonwebtoken`,
  `express-session`) se usó tal cual, sin auditar su implementación interna.
- La aceptación de cada etapa se apoyó en los resultados de las pruebas automatizadas y en los
  resúmenes de cierre presentados al usuario, no en una lectura exhaustiva de cada línea generada
  por el agente antes de aprobar seguir a la siguiente etapa.
