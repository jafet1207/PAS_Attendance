# Confirmación de Asistencia a Servicios (PAS Attendance)

**Jafet Valverde Villegas** · SINT-732 Laboratorio Ejecutivo en Claude Code
Entrega y presentación: martes 8 de septiembre de 2026, Sesión 8

> Este es mi enunciado del proyecto del curso. Reemplaza a los casos semilla de la
> consigna oficial; todo lo demás de esa consigna —el núcleo, la rúbrica de nueve
> criterios y las restricciones— aplica igual.

## 1. Qué es y para quién

Una app web para que los servidores de una iglesia confirmen su asistencia a los servicios, y
para que el coordinador vea quién falta sin tener que revisarlo a mano.

- **Quién lo usa:** ~100 servidores convocados, repartidos en 4 grupos (Servidor, Inducción,
  Líder, Director), y un coordinador.
- **Qué dispara el uso:** se abre un servicio (regular o extraordinario) y arranca la ventana de
  confirmación; ahí el sistema empieza a enviar recordatorios diarios a quien no ha respondido.

## 2. El eje de valor

**Eje declarado:** antes/después estimado.

Hoy se resuelve con una app móvil externa que falla — el enlace de confirmación no llega — así
que el coordinador saca un Excel a mano y persigue a los pendientes por WhatsApp, en su propio
tiempo personal, no en horario asignado para eso.

| | Hoy | Con el prototipo | Origen del número |
|---|---|---|---|
| Servidores sin confirmar a mitad de semana | Hasta 55 de 100 | El sistema calcula la lista al instante, sin reconstruirla a mano | Estimado (declarado en `FICHA-APROBACION.md`) |
| Recordatorios garantizados por servidor/servicio | Ninguno fijo; depende de si el coordinador tiene tiempo | Mínimo 3 recordatorios **exitosos** (no intentos) | Medido — regla implementada y cubierta por prueba automatizada (RN-6) |
| Horas semanales del coordinador en seguimiento manual | ~5 h/semana (Excel + WhatsApp + dudas) | ~1 h/semana (revisar el dashboard, casos excepcionales) | Supuesto declarado, no medido — desglose completo en `DOCUMENTO_NEGOCIO.md` |

Sobre este eje se argumentan el criterio 1 —oportunidad— y el criterio 6 —hoja de ruta y
retorno—, ambos ya escritos en `DOCUMENTO_NEGOCIO.md`.

## 3. El recorrido principal

1. El coordinador crea un servicio (fecha, hora, tipo, fecha de cierre de confirmación).
2. El sistema convoca a todos los servidores activos por igual; el grupo de cada uno solo cambia
   el contenido de su recordatorio (hora de llegada) y si se le envía o no.
3. Mientras la ventana esté abierta, el sistema envía recordatorios diarios por correo a quien no
   ha respondido, con un enlace firmado y acciones de un clic (`Sí` / `No`).
4. El servidor confirma desde el enlace, sin necesidad de cuenta ni contraseña.
5. El coordinador ve, en todo momento, quién falta y el historial de envíos de cada servicio.

**Queda afuera a propósito:** reporte histórico de 6 meses, exportación CSV, resumen por correo a
Líder/Director, y un panel administrativo más allá de lo mínimo para operar (ver
`FICHA-APROBACION.md`, "Queda afuera", y el cambio de alcance documentado ahí mismo sobre el
acuse de recibo y el adjunto de calendario, que sí se terminaron incluyendo).

## 4. Las reglas que valen

1. El estado de un servicio no puede mentir sobre si ya está resuelto: si la ventana sigue
   abierta y falta alguien por responder, no puede aparecer como completo (ni al revés).
2. Nadie puede confirmar después de que cerró el plazo de un servicio.
3. La garantía de los 3 recordatorios es real, no de palabra: cuenta envíos que de verdad
   resultaron exitosos, no intentos.
4. Los grupos Líder y Director no reciben recordatorios automáticos — convocan, no se les
   persigue.

**La decisión difícil.** Cómo garantizar los 3 recordatorios bajo el tope de ~100 correos/día de
un Gmail personal: se eligió un contador de envíos **exitosos** (no de intentos, ni de días
fijos), para que un envío fallido no deje a nadie por debajo del mínimo. Esto es lo que se
defiende en la Sesión 8.

## 5. Los datos

- **Qué persiste:** grupos, participantes (servidores), servicios, respuestas de confirmación e
  intentos de envío de recordatorio, con su resultado.
- **De dónde salen para la demostración:** sintéticos (nombres y correos ficticios,
  `@ejemplo-sintetico.test`), cargados con un script de siembra idempotente
  (`npm run seed:demo`).
- **Confidencialidad:** ninguno de los datos usados en el desarrollo o la demo es real; no se
  cargó nunca información de servidores reales de ninguna iglesia.

## 6. Frontera técnica

- **Depende de:** una cuenta de Gmail personal para el envío de correos (recordatorios y acuses
  de recibo).
- **Acceso real:** sí es posible (implementado como `GmailMailer`), pero el desarrollo y las
  pruebas corrieron con un mailer simulado (`MockMailer`) que no envía nada real — así se puede
  demostrar el prototipo sin exponer una cuenta de correo real ni gastar el tope diario.
- **Restricciones impuestas:** el tope de ~100 correos/día de un Gmail personal es la restricción
  central del diseño (ver "La decisión difícil").

## 7. Qué debe ser cierto cuando entregue

1. **La oportunidad está comparada.** Hasta 55 de 100 servidores sin confirmar a mitad de semana
   hoy, contra un sistema que garantiza mínimo 3 recordatorios exitosos y calcula la lista de
   pendientes al instante — comparación completa en `DOCUMENTO_NEGOCIO.md`.
2. **La arquitectura se decidió antes que el código.** Módulos, contratos y diagrama de secuencia
   en `DISENO.md`, escrito antes de empezar a programar cada etapa.
3. **El prototipo funciona de extremo a extremo y persiste datos de verdad.** El recorrido de la
   sección 3, contra PostgreSQL real (Neon), verificado clonando el repositorio en limpio y
   siguiendo solo el `README.md`.
4. **Las reglas del negocio están cubiertas por pruebas que corren en cada push.** Las cuatro de
   la sección 4 (y el resto de las reglas de `ESPECIFICACION.md`) están cubiertas por 84 pruebas
   automatizadas. La integración continua que las correría en cada push queda como excepción
   abierta — ver sección 8.
5. **El proceso de construcción quedó registrado.** `CLAUDE.md` propio, `BITACORA.md` fechada, e
   historial de commits (con la limitación de concentración de fechas declarada en la bitácora,
   no ocultada).
6. **La gobernanza quedó registrada en la bitácora.** Dos casos reales fechados: un mecanismo de
   concurrencia que se afirmó correcto y no lo era (detectado con una prueba, no releyendo
   código), y un script de siembra que se afirmó idempotente sin serlo (detectado corriéndolo dos
   veces antes de darlo por bueno). Detalle en `BITACORA.md`.
7. **La decisión de adoptar está fundamentada.** Tres escenarios de adopción con sus riesgos
   (técnico, operativo, ético/regulatorio) y mitigación, más hoja de ruta con estimación de
   retorno, en `DOCUMENTO_NEGOCIO.md`.
8. **La presentación defiende decisiones.** Pendiente de preparar para la Sesión 8 (10 a 12
   minutos): la decisión difícil de la sección 4, el cambio de alcance de la sección 3, y los dos
   casos de gobernanza de la bitácora.

## 8. El núcleo en este proyecto

| Pieza | Cómo se cumple acá |
|---|---|
| Prototipo de extremo a extremo | Servicio → recordatorios → confirmación → vista de pendientes (Etapas 1-5) |
| Persistencia en base de datos real | PostgreSQL (Neon), sin sustitutos en memoria ni en archivos |
| Pruebas sobre las reglas del negocio | 84 pruebas (Vitest + Supertest), backend/tests/etapa1-5 |
| `CLAUDE.md` propio y bitácora con entradas de gobernanza | Cumplido |
| Skill de arranque en `.claude/` | Cumplido (`.claude/skills/arranque-demo/`) |
| Los dos documentos | Cumplidos (`DOCUMENTO_NEGOCIO.md`, `DISENO.md`) |

**Excepciones abiertas.** Integración continua (pruebas corriendo en cada push): pospuesta
deliberadamente hasta después de cerrar el desarrollo técnico (Etapas 1-6), por decisión propia
registrada en `BITACORA.md` el 2026-09-07. Pendiente de resolución antes de la entrega final.

## 9. Calendario

Horas disponibles por semana: **10**. Semanas hasta la entrega: **5**.

| Para la sesión | Qué tengo que tener listo |
|---|---|
| 4 · 11 de agosto | `CLAUDE.md` propio, arquitectura con módulos y contratos, diagramas versionados, bitácora abierta |
| 5 · 18 de agosto | Recorrido principal funcionando de extremo a extremo, con persistencia real |
| 6 · 25 de agosto | Pruebas de las reglas de negocio corriendo, refactorización de lo acumulado |
| 7 · 1.º de septiembre | Skill de arranque, escenarios de adopción y riesgos en el documento de negocio |
| 8 · 8 de septiembre | Repositorio completo y presentación |

Todo lo anterior quedó listo, pero concentrado en menos sesiones de trabajo de las planeadas —
el historial de commits lo muestra y `BITACORA.md` lo declara como riesgo conocido para el
criterio 4, en vez de disimularlo.

## 10. Supuestos declarados

- El estudiante pertenece a la iglesia y usaría su Gmail personal para los envíos reales (no
  usado durante el desarrollo; se demuestra con `MockMailer`).
- Cada participante pertenece a un solo grupo; roles exactos: Servidor, Inducción, Líder,
  Director.
- Los recordatorios siguen diariamente a los pendientes hasta un día antes del cierre; el mínimo
  de 3 exitosos es piso, no techo.
- Las horas semanales del coordinador en el seguimiento manual (~5 h/semana) no se midieron; son
  un supuesto declarado y desglosado en `DOCUMENTO_NEGOCIO.md`.

## 11. Lo que este documento no decide

A propósito. Estas decisiones fueron tomadas después, durante el diseño técnico
(`DISENO.md`), no aquí:

- La arquitectura: módulos, responsabilidades y contratos entre ellos.
- El modelo de datos.
- El stack: Node.js + Express + TypeScript + PostgreSQL en el backend, React 19 + Vite en el
  frontend — decidido en la fase de diseño conceptual, no en este enunciado.

## Cambios de Alcance

- **2026-09-07 — Correo de acuse de recibo (RN-10) y adjunto de calendario `.ics`.** Declarados
  "afuera" en la ficha aprobada (3 de agosto de 2026). Se incluyeron en las Etapas 4 y 5 porque,
  para cuando se construyó el servicio de correo, ya existían el mailer y la misma plantilla HTML
  de la página de confirmación web — agregar ambos envíos sobre esa base tuvo un costo marginal
  casi nulo frente al valor de que un servidor tenga comprobante de su respuesta y una invitación
  real en su calendario. No amplió de forma significativa las ~33 horas de construcción
  planeadas. Detalle completo en `FICHA-APROBACION.md` ("Cambio de alcance") y en `BITACORA.md`.
