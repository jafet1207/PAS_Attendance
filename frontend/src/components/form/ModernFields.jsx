import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react'
import { useOutsideClose } from '../../hooks/useOutsideClose'
import styles from './ModernFields.module.css'

// El menú se renderiza en un portal (fuera del árbol DOM del control) y se posiciona con
// `position: fixed` a partir del rectángulo real del trigger. Así no lo recorta ningún
// ancestro con overflow (por ejemplo, un Modal), que es lo que causaba que el combo quedara
// cortado y obligara a hacer scroll dentro del modal para verlo completo.
export function ModernSelect({ ariaLabel, options, placeholder, value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false)
  const [menuRect, setMenuRect] = useState(null)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const root = useRef(null)
  const menuRef = useRef(null)
  const instanceId = useId()
  useOutsideClose([root, menuRef], () => setOpen(false))
  const selected = options.find((option) => String(option.value) === String(value))
  const selectedIndex = options.findIndex((option) => String(option.value) === String(value))

  function openMenu() {
    if (root.current) {
      const rect = root.current.getBoundingClientRect()
      const menuMaxHeight = 250
      const espacioAbajo = window.innerHeight - rect.bottom
      // Si no cabe hacia abajo pero sí hacia arriba, abre el menú por encima del control en
      // vez de dejarlo cortado fuera de la ventana (p. ej. un selector al fondo de una tabla).
      const abrirHaciaArriba = espacioAbajo < menuMaxHeight && rect.top > espacioAbajo
      setMenuRect(
        abrirHaciaArriba
          ? { bottom: window.innerHeight - rect.top + 6, left: rect.left, width: rect.width }
          : { top: rect.bottom + 6, left: rect.left, width: rect.width }
      )
    }
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0)
    setOpen(true)
  }

  function closeMenu() {
    setOpen(false)
    setHighlightedIndex(-1)
  }

  function selectOption(option) {
    onChange(String(option.value))
    closeMenu()
  }

  // Navegación por teclado tipo <select> nativo: flechas mueven el resaltado, Enter/Espacio
  // confirman, Escape cierra. El foco se queda en el botón (el menú vive en un portal), así
  // que el resaltado se controla por estado y se expone por aria-activedescendant.
  function handleTriggerKeyDown(event) {
    if (disabled) return
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault()
        openMenu()
      }
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedIndex((current) => (current + 1) % options.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex((current) => (current - 1 + options.length) % options.length)
    } else if (event.key === 'Home') {
      event.preventDefault()
      setHighlightedIndex(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setHighlightedIndex(options.length - 1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (options[highlightedIndex]) selectOption(options[highlightedIndex])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      closeMenu()
    }
  }

  useEffect(() => {
    if (!open || highlightedIndex < 0) return
    menuRef.current?.querySelector(`#${instanceId}-option-${highlightedIndex}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, highlightedIndex, instanceId])

  return <div className={styles.control} ref={root}>
    <button
      aria-activedescendant={open && highlightedIndex >= 0 ? `${instanceId}-option-${highlightedIndex}` : undefined}
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-label={ariaLabel}
      className={styles.trigger}
      disabled={disabled}
      onClick={() => (open ? closeMenu() : openMenu())}
      onKeyDown={handleTriggerKeyDown}
      type="button"
    ><span className={selected ? '' : styles.placeholder}>{selected?.label ?? placeholder}</span><ChevronDown aria-hidden size={18} /></button>
    {open && menuRect && createPortal(
      <div aria-label={ariaLabel} className={styles.menu} ref={menuRef} role="listbox" style={{ position: 'fixed', ...menuRect }}>
        {options.map((option, index) => (
          <button
            aria-selected={String(option.value) === String(value)}
            className={`${styles.option} ${index === highlightedIndex ? styles.optionHighlighted : ''}`}
            id={`${instanceId}-option-${index}`}
            key={option.value}
            onClick={() => selectOption(option)}
            onMouseEnter={() => setHighlightedIndex(index)}
            role="option"
            type="button"
          ><span>{option.label}</span>{String(option.value) === String(value) && <Check size={17} />}</button>
        ))}
      </div>,
      document.body
    )}
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
  useOutsideClose([root], () => setOpen(false))
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
