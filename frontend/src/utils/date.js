const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
const DIAS_ABREV = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function pad(n) {
  return String(n).padStart(2, '0')
}

function formatHora12(date) {
  const horas24 = date.getHours()
  const minutos = date.getMinutes()
  const periodo = horas24 >= 12 ? 'PM' : 'AM'
  const horas12 = horas24 % 12 === 0 ? 12 : horas24 % 12
  return `${horas12}:${pad(minutos)} ${periodo}`
}

/** "2026-09-12T15:30:00" -> "12 SEP" */
export function formatServiceDate(isoDateTime) {
  const date = new Date(isoDateTime)
  return `${date.getDate()} ${MESES[date.getMonth()]}`
}

/** "2026-09-12T15:30:00" -> "Sáb · 3:30 PM" */
export function formatServiceTime(isoDateTime) {
  const date = new Date(isoDateTime)
  return `${DIAS_ABREV[date.getDay()]} · ${formatHora12(date)}`
}

/** "2026-09-10" -> "10 sep" */
export function formatClosingDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`)
  return `${date.getDate()} ${MESES[date.getMonth()].charAt(0)}${MESES[date.getMonth()].slice(1).toLowerCase()}`
}

export function formatDaysUntilClosing(days) {
  if (days < 0) return 'Cerrado'
  if (days === 0) return 'Cierra hoy'
  if (days === 1) return 'Falta 1 día'
  return `Faltan ${days} días`
}

/** "2026-09-20", 3 -> "2026-09-17" */
export function subtractDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00`)
  date.setDate(date.getDate() - days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
