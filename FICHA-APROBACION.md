# Ficha de aprobación · Confirmación de asistencia a servicios

**Jafet Valverde Villegas** · SINT-732 · 3 de agosto de 2026

**Qué es.** Aplicación web para que ~100 personas de una iglesia confirmen su asistencia a los servicios, y para que el coordinador vea quién falta sin revisarlo a mano.

**Cómo se hace hoy.** Una app móvil externa que falla: el enlace de confirmación no llega, así que el coordinador saca un Excel a mano y persigue por WhatsApp, en su tiempo personal.

---

## Lo esencial

| | |
|---|---|
| **Eje de valor** | Antes/después estimado |
| **La comparación** | De "los recordatorios no llegan y hay hasta 55 de 100 sin confirmar a mitad de semana, con seguimiento manual del coordinador" a "cada persona recibe mínimo 3 recordatorios exitosos y la lista de pendientes la da el sistema" |
| **Recorrido principal** | Servicio abierto → recordatorios diarios con enlace → participante se busca en su grupo y marca Sí/No → coordinador ve pendientes y registro de envíos |
| **Queda afuera** | Correo de confirmación al responder, invitación de calendario (ICS), reporte histórico de 6 meses, exportación CSV, resumen por correo a Líder/Director; panel administrativo al mínimo |
| **La decisión difícil** | Cómo garantizar los 3 recordatorios bajo el tope de 100 correos/día de un Gmail personal: se eligió un contador de envíos **exitosos** (no de intentos) en vez de días fijos, para que un envío fallido no deje a nadie corto |
| **Datos para la demo** | Sintéticos (nombres y correos ficticios), cargados con script de siembra |
| **Horas por semana** | 10, por 5 semanas (~33 h de construcción real) |
| **Punto de partida** | Desde cero en código. La app externa actual no se toca; es lo que se reemplaza |

## El núcleo

| Pieza | | Cómo se cumple acá |
|---|---|---|
| Prototipo de extremo a extremo | ✔ | Servicio → recordatorios → confirmación → vista de pendientes |
| Persistencia en base de datos real | ✔ | Grupos, participantes, servicios, respuestas, corridas y registros de envío |
| Pruebas sobre las reglas del negocio | ✔ | Las cinco reglas (respuesta única, ventana, quién es pendiente, solo a no confirmados, tope y contador de envíos) |
| CLAUDE.md y bitácora con entradas de gobernanza | ✔ | Aplica igual que a todos |
| Integración continua y skill de arranque | ✔ | Aplica igual que a todos |
| Los dos documentos | ✔ | Aplica igual que a todos |

## Decisiones y pendientes

- **Envío de correos: simulado hasta revisión final** — El desarrollo se hará con envío simulado (no real a Gmail). Antes de la entrega final, revisar si hay tiempo para implementar envío real; de lo contrario, se documenta la decisión como limitación conocida.
- **Alcance ajustado** — el caso original que trajo el estudiante era mucho más grande (invitación de calendario, reportes históricos, CSV, panel completo). Se recortó a un núcleo que cabe en ~33 horas; lo demás quedó como hoja de ruta. Se levanta solo para que el docente sepa que el recorte fue deliberado.

## Supuestos que quedaron declarados

- El estudiante pertenece a la iglesia y usará su Gmail personal para los envíos en clase.
- Cada participante pertenece a un solo grupo; roles exactos: Servidor, Inducción, Líder, Director.
- Los recordatorios siguen diariamente a los pendientes hasta un día antes del cierre; el mínimo de 3 exitosos es piso, no techo.
- Las horas personales del coordinador en el seguimiento manual se cuantificarán durante el proyecto.

## Preguntas para el docente

- ¿Envío real de correos desde Gmail personal en clase, o prefiere que esa frontera se simule?

---

*Enunciado completo en `PROYECTO.md`.*
