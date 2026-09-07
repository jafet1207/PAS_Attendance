import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react'
import styles from './ModernFields.module.css'

function useOutsideClose(ref, close) {
  useEffect(() => {
    function onPointerDown(event) { if (ref.current && !ref.current.contains(event.target)) close() }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [ref, close])
}

export function ModernSelect({ ariaLabel, options, placeholder, value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  useOutsideClose(root, () => setOpen(false))
  const selected = options.find((option) => String(option.value) === String(value))
  return <div className={styles.control} ref={root}>
    <button aria-expanded={open} aria-haspopup="listbox" aria-label={ariaLabel} className={styles.trigger} disabled={disabled} onClick={() => setOpen((current) => !current)} type="button"><span className={selected ? '' : styles.placeholder}>{selected?.label ?? placeholder}</span><ChevronDown aria-hidden size={18} /></button>
    {open && <div aria-label={ariaLabel} className={styles.menu} role="listbox">{options.map((option) => <button aria-selected={String(option.value) === String(value)} className={styles.option} key={option.value} onClick={() => { onChange(String(option.value)); setOpen(false) }} role="option" type="button"><span>{option.label}</span>{String(option.value) === String(value) && <Check size={17} />}</button>)}</div>}
  </div>
}

const weekday = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']
const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre']
function isoDate(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function parseDate(value) { return value ? new Date(`${value}T12:00:00`) : null }
function displayDate(value) { const date = parseDate(value); return date ? `${date.getDate()} de ${monthNames[date.getMonth()]} de ${date.getFullYear()}` : 'Selecciona una fecha' }

export function ModernDateField({ ariaLabel, value, onChange, disabled = false, isDateDisabled }) {
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(() => parseDate(value) ?? new Date())
  const root = useRef(null)
  useOutsideClose(root, () => setOpen(false))
  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const startOffset = (first.getDay() + 6) % 7
    const totalDays = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
    return Array.from({ length: startOffset + totalDays }, (_, index) => index < startOffset ? null : new Date(cursor.getFullYear(), cursor.getMonth(), index - startOffset + 1))
  }, [cursor])
  function moveMonth(offset) { setCursor((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1)) }
  return <div className={styles.control} ref={root}>
    <button aria-expanded={open} aria-haspopup="dialog" aria-label={ariaLabel} className={styles.trigger} disabled={disabled} onClick={() => setOpen((current) => !current)} type="button"><span className={value ? '' : styles.placeholder}>{displayDate(value)}</span><CalendarDays aria-hidden size={18} /></button>
    {open && <div aria-label={ariaLabel} className={styles.calendar} role="dialog"><div className={styles.calendarHeader}><button aria-label="Mes anterior" onClick={() => moveMonth(-1)} type="button"><ChevronLeft size={18} /></button><strong>{monthNames[cursor.getMonth()]} {cursor.getFullYear()}</strong><button aria-label="Mes siguiente" onClick={() => moveMonth(1)} type="button"><ChevronRight size={18} /></button></div><div className={styles.weekdays}>{weekday.map((name) => <span key={name}>{name}</span>)}</div><div className={styles.days}>{days.map((date, index) => date ? <button className={`${styles.day} ${isoDate(date) === value ? styles.selectedDay : ''}`} disabled={isDateDisabled?.(date)} key={isoDate(date)} onClick={() => { onChange(isoDate(date)); setOpen(false) }} type="button">{date.getDate()}</button> : <span key={`blank-${index}`} />)}</div><button className={styles.today} disabled={isDateDisabled?.(new Date())} onClick={() => { onChange(isoDate(new Date())); setCursor(new Date()); setOpen(false) }} type="button">Hoy</button></div>}
  </div>
}

function displayTime(value) {
  if (!value) return 'Selecciona una hora'
  const [hours, minutes] = value.split(':').map(Number); const period = hours >= 12 ? 'PM' : 'AM'; const hour = hours % 12 || 12
  return `${hour}:${String(minutes).padStart(2, '0')} ${period}`
}
const HORA_MIN = 8
const HORA_MAX = 21
const timeOptions = Array.from({ length: (HORA_MAX - HORA_MIN) * 2 + 1 }, (_, index) => { const hours = HORA_MIN + Math.floor(index / 2); const minutes = index % 2 ? 30 : 0; return { value: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`, label: displayTime(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`) } })

export function ModernTimeField({ value, onChange }) {
  return <ModernSelect ariaLabel="Hora del servicio" options={timeOptions.map((option) => ({ ...option, label: <><Clock3 size={16} /> {option.label}</> }))} placeholder="Selecciona una hora" value={value} onChange={onChange} />
}
