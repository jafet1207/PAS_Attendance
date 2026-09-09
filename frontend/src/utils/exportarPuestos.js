import { formatServiceTime } from './date'
import { dibujarIcono } from './canvasIcons'

// Tokens visuales del PNG (punto 17 del pedido de rediseño): coherentes con la paleta de la app
// pero definidos acá como constantes propias — el póster se exporta como imagen estática y no
// participa del theming en vivo, así que no toca tokens.css.
const PRIMARY_DARK = '#174C3A'
const PRIMARY = '#267A5C'
const PRIMARY_SUBTLE = '#E8F3ED'
const BACKGROUND = '#FAF9F6'
const SURFACE = '#FFFFFF'
const TEXT = '#172B27'
const TEXT_SECONDARY = '#59635F'
const BORDER = '#E3E6E2'

const FONT = 'Arial, Helvetica, sans-serif'

// Paleta de badges de Rol por Área (bg suave + texto oscuro), la misma clasificación formal que
// ya existe en el catálogo (Puesto.areaId) — no son colores arbitrarios (punto 13).
const AREA_COLORS = [
  { bg: PRIMARY_SUBTLE, text: PRIMARY_DARK },
  { bg: '#E8F2F8', text: '#2f5f78' },
  { bg: '#f7efe6', text: '#8c531b' },
  { bg: '#efeaf7', text: '#5b4b8a' },
  { bg: '#f6ece9', text: '#78443b' },
]

// Los 3 puestos Secundario son un catálogo fijo (RN-19, config.PUESTOS_SECUNDARIOS_BASE en el
// backend) — de ahí el ícono y el tinte de cada uno, igual que antes con los emoji.
const SECUNDARIOS_INFO = {
  'Café': { icono: 'coffee', bg: '#F3E9DE', color: '#8C5A2B' },
  'Apertura Puertas': { icono: 'doorOpen', bg: '#FBEADD', color: '#B5642F' },
  'Apoyo Logística': { icono: 'package', bg: '#FBE7EC', color: '#B33F5B' },
}

function colorDeArea(areaIndex) {
  return AREA_COLORS[areaIndex % AREA_COLORS.length]
}

/**
 * Solo entran quienes tienen un puesto Principal asignado (una fila por persona); quien solo
 * tiene Secundario(s) no aparece, se marcan como un ícono junto al nombre de la fila que sí tiene
 * Principal. `catalogo.puestos` trae `areaId` (la respuesta de asignaciones no lo trae por
 * puesto), así que se cruza por id para saber a qué Área pertenece cada Principal.
 */
function construirFilas(data, catalogo) {
  const puestosPorId = new Map(catalogo.puestos.map((p) => [p.id, p]))
  const areaIndexPorId = new Map(catalogo.areas.map((area, index) => [area.id, index]))

  const filas = data.participants
    .map((participant) => {
      const principal = participant.puestos.find((p) => p.tipo === 'Principal')
      if (!principal) return null
      const puestoCompleto = puestosPorId.get(principal.id)
      const areaIndex = puestoCompleto ? areaIndexPorId.get(puestoCompleto.areaId) ?? 0 : 0
      return {
        participantId: participant.id,
        name: participant.name,
        role: principal.nombre,
        areaIndex,
        // Dentro de la misma Área, el id del puesto respeta el orden de siembra del catálogo
        // (el "Coordinador de área" siempre se sembró primero), sin necesidad de una lista aparte.
        ordenEnArea: puestoCompleto?.id ?? 0,
        secundarios: participant.puestos.filter((p) => p.tipo === 'Secundario').map((p) => p.nombre),
      }
    })
    .filter(Boolean)

  filas.sort((a, b) => a.areaIndex - b.areaIndex || a.ordenEnArea - b.ordenEnArea)
  return filas
}

/** "Andrea Mora" -> "AM", "Jafet Valverde" -> "JV", "Ana Vargas Mora" -> "AV" (primera letra de
 * las primeras dos palabras, sin importar cuántas más tenga el nombre). */
function iniciales(nombre) {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return ''
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase()
  return (palabras[0][0] + palabras[1][0]).toUpperCase()
}

function truncarTexto(ctx, texto, anchoMaximo) {
  if (ctx.measureText(texto).width <= anchoMaximo) return texto
  let recortado = texto
  while (recortado.length > 1 && ctx.measureText(`${recortado}…`).width > anchoMaximo) {
    recortado = recortado.slice(0, -1)
  }
  return `${recortado}…`
}

/**
 * Ajusta un texto a un ancho máximo: primero intenta reducir moderadamente el tamaño de fuente
 * (hasta `fontMin`); si ni así cabe en una línea, lo parte en un máximo de 2 líneas al tamaño
 * mínimo (truncando la segunda línea solo como último recurso). Nunca corta información de forma
 * arbitraria en una sola línea (punto 14 del rediseño).
 */
function ajustarTexto(ctx, texto, anchoMaximo, peso, fontBase, fontMin) {
  for (let size = fontBase; size >= fontMin; size -= 1) {
    ctx.font = `${peso} ${size}px ${FONT}`
    if (ctx.measureText(texto).width <= anchoMaximo) {
      return { lineas: [texto], fontSize: size }
    }
  }

  ctx.font = `${peso} ${fontMin}px ${FONT}`
  const palabras = texto.split(' ')
  let linea1 = ''
  let i = 0
  while (i < palabras.length) {
    const intento = linea1 ? `${linea1} ${palabras[i]}` : palabras[i]
    if (linea1 && ctx.measureText(intento).width > anchoMaximo) break
    linea1 = intento
    i += 1
  }
  if (!linea1) linea1 = palabras[0]

  let linea2 = palabras.slice(i).join(' ')
  if (!linea2) return { lineas: [linea1], fontSize: fontMin }
  if (ctx.measureText(linea2).width > anchoMaximo) linea2 = truncarTexto(ctx, linea2, anchoMaximo)
  return { lineas: [linea1, linea2], fontSize: fontMin }
}

const ANCHO = 600
const MARGEN_EXTERIOR = 20
const PADDING = 32
const RADIO_TARJETA = 26
const RADIO_BADGE = 14
const RADIO_FILA = 10

const ALTO_ENCABEZADO_ICONO = 52
const ALTO_TITULO = 34
const ALTO_SUBTITULO = 26
const GAP_SECCION = 20
const ALTO_LINEA_METADATOS = 34
const ALTO_RESUMEN = 44
const ALTO_TABLA_HEADER = 34
const ALTO_FILA_BASE = 78
const ALTO_FILA_EXTRA_DOS_LINEAS = 22
const AVATAR_SIZE = 52
// Espacio que ocupa el avatar + su separación antes de que arranque el texto del nombre
// (debe coincidir con `xNombre` en `dibujarPoster`), y un respiro mínimo antes del badge de Rol.
const OFFSET_NOMBRE = 16 + AVATAR_SIZE + 14
// El badge de Rol se ancla a la derecha de su propia columna (línea `xBadge` más abajo), así que
// en el peor caso (badge tan ancho como su columna lo permite) su borde izquierdo puede meterse
// hasta 16px dentro de la columna de Nombre; se descuenta ese margen más un respiro visual.
const GAP_NOMBRE_BADGE = 16 + 8

const anchoInterior = ANCHO - MARGEN_EXTERIOR * 2 - PADDING * 2

/**
 * Distribuye los ítems de la fila de metadatos (hora + los 3 Secundario del catálogo) en líneas,
 * en orden, sin que ninguno se corte a la mitad — se recalcula igual en el cálculo del alto y en
 * el dibujado final para que ambos coincidan.
 */
function distribuirMetadatos(ctx, items) {
  const lineas = []
  let lineaActual = []
  let xActual = 0
  const gap = 18

  for (const item of items) {
    ctx.font = `600 13px ${FONT}`
    const anchoLabel = ctx.measureText(item.label).width
    const anchoItem = 26 + 6 + anchoLabel // ícono + separación + texto
    if (lineaActual.length > 0 && xActual + anchoItem > anchoInterior) {
      lineas.push(lineaActual)
      lineaActual = []
      xActual = 0
    }
    lineaActual.push(item)
    xActual += anchoItem + gap
  }
  if (lineaActual.length > 0) lineas.push(lineaActual)
  return lineas
}

/**
 * Hace todo el trabajo de medición de texto una sola vez (en un <canvas> descartable, ya que
 * `measureText` no depende del tamaño real del canvas) y devuelve un plan con las líneas ya
 * resueltas y el alto total — así el cálculo del alto y el dibujado usan exactamente los mismos
 * saltos de línea, sin duplicar la lógica.
 */
function construirPlan(data, catalogo) {
  const ctxMedicion = document.createElement('canvas').getContext('2d')
  const filas = construirFilas(data, catalogo)

  const anchoColumnaNombre = Math.round(anchoInterior * 0.52)
  const anchoColumnaRol = anchoInterior - anchoColumnaNombre

  const filasConLayout = filas.map((fila) => {
    const anchoIconos = fila.secundarios.length * 22
    ctxMedicion.font = `600 16px ${FONT}`
    const anchoDisponibleNombre = anchoColumnaNombre - OFFSET_NOMBRE - GAP_NOMBRE_BADGE - anchoIconos
    const nombreTruncado = truncarTexto(ctxMedicion, fila.name, anchoDisponibleNombre)

    const anchoBadgeDisponible = anchoColumnaRol - 28
    const { lineas: rolLineas, fontSize: rolFontSize } = ajustarTexto(
      ctxMedicion,
      fila.role,
      anchoBadgeDisponible,
      600,
      14,
      12
    )

    const alturaFila = rolLineas.length > 1 ? ALTO_FILA_BASE + ALTO_FILA_EXTRA_DOS_LINEAS : ALTO_FILA_BASE

    return { ...fila, nombreTruncado, rolLineas, rolFontSize, alturaFila }
  })

  const metadatos = [
    // Solo la hora: el día ya se mostró una vez en el subtítulo (punto 4, evitar redundancia).
    { tipo: 'hora', icono: 'clock', label: formatServiceTime(data.service.date).split(' · ').pop(), bg: PRIMARY_SUBTLE, color: PRIMARY_DARK },
    ...Object.entries(SECUNDARIOS_INFO).map(([nombre, info]) => ({
      tipo: 'secundario',
      icono: info.icono,
      label: nombre,
      bg: info.bg,
      color: info.color,
    })),
  ]
  const lineasMetadatos = distribuirMetadatos(ctxMedicion, metadatos)
  const altoMetadatos = lineasMetadatos.length * ALTO_LINEA_METADATOS

  const altoTabla =
    filasConLayout.length === 0
      ? 60
      : ALTO_TABLA_HEADER + filasConLayout.reduce((suma, f) => suma + f.alturaFila, 0)

  const altoContenido =
    ALTO_ENCABEZADO_ICONO +
    GAP_SECCION +
    altoMetadatos +
    GAP_SECCION +
    ALTO_RESUMEN +
    GAP_SECCION +
    altoTabla

  const altoTarjeta = PADDING * 2 + altoContenido
  const altoCanvas = altoTarjeta + MARGEN_EXTERIOR * 2

  return {
    nombreServicio: data.service.name,
    filas: filasConLayout,
    lineasMetadatos,
    anchoColumnaNombre,
    anchoColumnaRol,
    altoTarjeta,
    altoCanvas,
  }
}

function dibujarBadgeIcono(ctx, x, y, size, bg, iconColor, nombreIcono, iconoSize) {
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.roundRect(x, y, size, size, size / 2)
  ctx.fill()
  dibujarIcono(ctx, nombreIcono, x + (size - iconoSize) / 2, y + (size - iconoSize) / 2, iconoSize, iconColor)
}

/** Dibuja el póster completo con la API 2D de <canvas> (nada de DOM/SVG externo — Chrome bloquea
 * en silencio el dibujado de contenido HTML embebido en SVG dentro de un canvas, ver historial de
 * este archivo). Formato vertical, pensado para compartirse como imagen por WhatsApp. */
function dibujarPoster(ctx, plan) {
  const { nombreServicio, filas, lineasMetadatos, anchoColumnaNombre, anchoColumnaRol, altoTarjeta, altoCanvas } = plan

  ctx.fillStyle = BACKGROUND
  ctx.fillRect(0, 0, ANCHO, altoCanvas)

  // Tarjeta principal
  ctx.fillStyle = SURFACE
  ctx.strokeStyle = BORDER
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(MARGEN_EXTERIOR, MARGEN_EXTERIOR, ANCHO - MARGEN_EXTERIOR * 2, altoTarjeta, RADIO_TARJETA)
  ctx.fill()
  ctx.stroke()

  const xContenido = MARGEN_EXTERIOR + PADDING
  const anchoContenido = anchoInterior
  let y = MARGEN_EXTERIOR + PADDING
  ctx.textBaseline = 'top'

  // Encabezado: ícono calendario + título + subtítulo (una sola vez la fecha, punto 4).
  dibujarBadgeIcono(ctx, xContenido, y, ALTO_ENCABEZADO_ICONO, PRIMARY_SUBTLE, PRIMARY_DARK, 'calendar', 26)
  const xTexto = xContenido + ALTO_ENCABEZADO_ICONO + 16
  const anchoTexto = anchoContenido - ALTO_ENCABEZADO_ICONO - 16

  ctx.fillStyle = PRIMARY_DARK
  ctx.font = `700 26px ${FONT}`
  ctx.fillText('Asignación de puestos', xTexto, y + 2)

  ctx.fillStyle = TEXT_SECONDARY
  ctx.font = `400 15px ${FONT}`
  ctx.fillText(truncarTexto(ctx, nombreServicio, anchoTexto), xTexto, y + ALTO_TITULO)

  y += ALTO_ENCABEZADO_ICONO + GAP_SECCION

  // Metadatos: hora del servicio + leyenda de los 3 Secundario del catálogo.
  for (const linea of lineasMetadatos) {
    let x = xContenido
    for (const item of linea) {
      dibujarBadgeIcono(ctx, x, y, 26, item.bg, item.color, item.icono, 16)
      ctx.fillStyle = TEXT
      ctx.font = `600 13px ${FONT}`
      ctx.fillText(item.label, x + 26 + 6, y + 6)
      x += 26 + 6 + ctx.measureText(item.label).width + 18
    }
    y += ALTO_LINEA_METADATOS
  }
  y += GAP_SECCION

  // Resumen: cantidad de servidores asignados.
  ctx.fillStyle = PRIMARY_SUBTLE
  ctx.beginPath()
  ctx.roundRect(xContenido, y, anchoContenido, ALTO_RESUMEN, 14)
  ctx.fill()

  const cantidad = filas.length
  dibujarIcono(ctx, 'users', xContenido + 16, y + (ALTO_RESUMEN - 20) / 2, 20, PRIMARY_DARK)
  ctx.fillStyle = PRIMARY_DARK
  ctx.font = `600 15px ${FONT}`
  ctx.fillText(
    `${cantidad} servidor${cantidad === 1 ? '' : 'es'} asignado${cantidad === 1 ? '' : 's'}`,
    xContenido + 16 + 20 + 10,
    y + (ALTO_RESUMEN - 15) / 2 - 1
  )

  y += ALTO_RESUMEN + GAP_SECCION

  if (filas.length === 0) {
    ctx.fillStyle = TEXT_SECONDARY
    ctx.font = `400 14px ${FONT}`
    ctx.fillText('Todavía no hay ningún puesto Principal asignado en este servicio.', xContenido, y)
    return
  }

  // Encabezado de tabla.
  ctx.fillStyle = '#F2F1EC'
  ctx.beginPath()
  ctx.roundRect(xContenido, y, anchoContenido, ALTO_TABLA_HEADER, 8)
  ctx.fill()
  ctx.fillStyle = TEXT_SECONDARY
  ctx.font = `600 12px ${FONT}`
  ctx.fillText('SERVIDOR', xContenido + 16, y + 10)
  ctx.textAlign = 'right'
  ctx.fillText('ROL', xContenido + anchoContenido - 16, y + 10)
  ctx.textAlign = 'left'
  y += ALTO_TABLA_HEADER + 6

  // Filas: avatar de iniciales + nombre (+ íconos de Secundario) + badge de Rol por Área.
  filas.forEach((fila, index) => {
    const alturaFila = fila.alturaFila
    ctx.fillStyle = index % 2 === 0 ? SURFACE : '#FBFAF7'
    ctx.beginPath()
    ctx.roundRect(xContenido, y, anchoContenido, alturaFila - 4, RADIO_FILA)
    ctx.fill()

    const yCentro = y + (alturaFila - 4) / 2

    // Avatar
    const avatarY = yCentro - AVATAR_SIZE / 2
    ctx.fillStyle = PRIMARY_SUBTLE
    ctx.beginPath()
    ctx.arc(xContenido + 16 + AVATAR_SIZE / 2, yCentro, AVATAR_SIZE / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = PRIMARY_DARK
    ctx.font = `600 16px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(iniciales(fila.name), xContenido + 16 + AVATAR_SIZE / 2, yCentro + 1)
    ctx.textAlign = 'left'

    // Nombre + íconos de Secundario
    const xNombre = xContenido + OFFSET_NOMBRE
    ctx.fillStyle = TEXT
    ctx.font = `600 16px ${FONT}`
    ctx.fillText(fila.nombreTruncado, xNombre, yCentro)
    let xIcono = xNombre + ctx.measureText(fila.nombreTruncado).width + 8
    for (const nombreSecundario of fila.secundarios) {
      const info = SECUNDARIOS_INFO[nombreSecundario]
      if (!info) continue
      dibujarIcono(ctx, info.icono, xIcono, yCentro - 9, 18, info.color)
      xIcono += 24
    }

    // Badge de Rol, alineado a la derecha del ancho de columna.
    const color = colorDeArea(fila.areaIndex)
    ctx.font = `600 ${fila.rolFontSize}px ${FONT}`
    const anchoTextoRol = Math.max(...fila.rolLineas.map((linea) => ctx.measureText(linea).width))
    const anchoBadge = anchoTextoRol + 28
    const xBadge = xContenido + anchoContenido - 16 - anchoBadge
    const altoBadge = fila.rolLineas.length > 1 ? 20 + fila.rolLineas.length * 16 : 32

    ctx.fillStyle = color.bg
    ctx.beginPath()
    ctx.roundRect(xBadge, yCentro - altoBadge / 2, anchoBadge, altoBadge, altoBadge / 2)
    ctx.fill()

    ctx.fillStyle = color.text
    ctx.textAlign = 'center'
    if (fila.rolLineas.length === 1) {
      ctx.fillText(fila.rolLineas[0], xBadge + anchoBadge / 2, yCentro)
    } else {
      const alturaLinea = 16
      const yInicio = yCentro - ((fila.rolLineas.length - 1) * alturaLinea) / 2
      fila.rolLineas.forEach((linea, i) => {
        ctx.fillText(linea, xBadge + anchoBadge / 2, yInicio + i * alturaLinea)
      })
    }
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'

    y += alturaFila
  })
}

/**
 * Genera el póster de "Servidor | Rol" como PNG y dispara su descarga.
 *
 * Se descartó la técnica de armar el árbol con React y rasterizarlo vía
 * <svg><foreignObject>...</foreignObject></svg> → <canvas>: Chrome bloquea en silencio el
 * dibujado de contenido HTML embebido en un SVG cuando se usa `drawImage` sobre un canvas (no
 * lanza error, simplemente no pinta nada), así que la imagen resultante salía en blanco. Por eso
 * este módulo dibuja todo directamente con la API 2D de canvas (texto, rectángulos, íconos
 * vectoriales de lucide-react convertidos a trazos de canvas — ver canvasIcons.js), sin DOM ni
 * SVG de por medio y sin agregar ninguna librería nueva.
 */
export async function exportarPuestosComoImagen(data, catalogo) {
  const plan = construirPlan(data, catalogo)

  const escala = 2 // exporta a 2x para que se vea nítido en pantallas de alta densidad
  const canvas = document.createElement('canvas')
  canvas.width = ANCHO * escala
  canvas.height = plan.altoCanvas * escala
  const ctx = canvas.getContext('2d')
  ctx.scale(escala, escala)

  dibujarPoster(ctx, plan)

  const enlace = document.createElement('a')
  enlace.href = canvas.toDataURL('image/png')
  enlace.download = `puestos-${data.service.date.slice(0, 10)}.png`
  document.body.appendChild(enlace)
  enlace.click()
  document.body.removeChild(enlace)
}
