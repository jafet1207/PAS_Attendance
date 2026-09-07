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
| **Queda afuera** | Reporte histórico de 6 meses, exportación CSV, resumen por correo a Líder/Director; panel administrativo al mínimo. *(El correo de confirmación al responder y la invitación de calendario ICS, originalmente también "afuera", se incluyeron durante el desarrollo — ver "Cambio de alcance" abajo.)* |
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
- **Cambio de alcance (2026-09-07)** — el correo de acuse de recibo al responder (RN-10) y el adjunto de calendario `.ics` en los recordatorios, declarados "afuera" arriba, se construyeron en las Etapas 4 y 5. Razón: para cuando se implementó el servicio de correo (Etapa 5), ya existía el mailer y la misma plantilla HTML que usa la página de confirmación web; agregar el envío del acuse y el `.ics` sobre esa base tuvo un costo marginal casi nulo frente al valor de que un servidor tenga comprobante de su respuesta y una invitación real en su calendario, sin ampliar de forma significativa las ~33 horas planeadas. Se detectó la discrepancia contra esta ficha al redactar `DOCUMENTO_NEGOCIO.md`, no antes.

## Supuestos que quedaron declarados

- El estudiante pertenece a la iglesia y usará su Gmail personal para los envíos en clase.
- Cada participante pertenece a un solo grupo; roles exactos: Servidor, Inducción, Líder, Director.
- Los recordatorios siguen diariamente a los pendientes hasta un día antes del cierre; el mínimo de 3 exitosos es piso, no techo.
- Las horas personales del coordinador en el seguimiento manual no se llegaron a medir durante el proyecto; quedaron como supuesto declarado (~5 h/semana, desglosado) en `DOCUMENTO_NEGOCIO.md`.

## Preguntas para el docente

- ¿Envío real de correos desde Gmail personal en clase, o prefiere que esa frontera se simule?

---

*Enunciado completo en `PROYECTO.md`.*
