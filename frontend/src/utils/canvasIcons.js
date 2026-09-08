// Rutas SVG extraídas tal cual de `lucide-react` (ya instalado, mismo paquete que usa el resto
// del frontend) vía ReactDOMServer.renderToStaticMarkup, para no depender de emoji al generar el
// PNG de asignación de puestos (los emoji se ven distinto entre sistemas operativos/entornos —
// ver exportarPuestos.js). Son íconos de trazo (stroke), no de relleno, igual que en la UI.
const ICONOS = {
  calendar: [
    { type: 'path', d: 'M8 2v3' },
    { type: 'path', d: 'M16 2v3' },
    { type: 'rect', x: 3, y: 3, w: 18, h: 18, rx: 2 },
    { type: 'path', d: 'M3 9h18' },
  ],
  clock: [
    { type: 'circle', cx: 12, cy: 12, r: 10 },
    { type: 'path', d: 'M12 6v6l4 2' },
  ],
  coffee: [
    { type: 'path', d: 'M10 2v2' },
    { type: 'path', d: 'M14 2v2' },
    {
      type: 'path',
      d: 'M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1',
    },
    { type: 'path', d: 'M6 2v2' },
  ],
  doorOpen: [
    { type: 'path', d: 'M10 21H2' },
    { type: 'path', d: 'M10 4a2 2 0 012.36-1.968l5.41.992A1.5 1.5 0 0119 4.5V21l-7.876.992A1 1 0 0110 21z' },
    { type: 'path', d: 'M10.268 3H7a2 2 0 00-2 2v16' },
    { type: 'path', d: 'M14 12h.01' },
    { type: 'path', d: 'M22 21h-3' },
  ],
  package: [
    {
      type: 'path',
      d: 'M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z',
    },
    { type: 'path', d: 'M12 22V12' },
    { type: 'polyline', points: [[3.29, 7], [12, 12], [20.71, 7]] },
    { type: 'path', d: 'm7.5 4.27 9 5.15' },
  ],
  users: [
    { type: 'path', d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' },
    { type: 'path', d: 'M16 3.128a4 4 0 0 1 0 7.744' },
    { type: 'path', d: 'M22 21v-2a4 4 0 0 0-3-3.87' },
    { type: 'circle', cx: 9, cy: 7, r: 4 },
  ],
}

/** Dibuja un ícono de `ICONOS` centrado en (x, y) con lado `size`, en el sistema de coordenadas
 * original de lucide (viewBox 24x24) escalado — así el grosor de trazo escala proporcional al
 * tamaño pedido, igual que si fuera un <svg> reescalado. */
export function dibujarIcono(ctx, nombre, x, y, size, color) {
  const shapes = ICONOS[nombre]
  if (!shapes) return

  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / 24, size / 24)
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const shape of shapes) {
    ctx.beginPath()
    if (shape.type === 'path') {
      ctx.stroke(new Path2D(shape.d))
    } else if (shape.type === 'rect') {
      ctx.roundRect(shape.x, shape.y, shape.w, shape.h, shape.rx ?? 0)
      ctx.stroke()
    } else if (shape.type === 'circle') {
      ctx.arc(shape.cx, shape.cy, shape.r, 0, Math.PI * 2)
      ctx.stroke()
    } else if (shape.type === 'polyline') {
      shape.points.forEach(([px, py], i) => {
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      })
      ctx.stroke()
    }
  }

  ctx.restore()
}
