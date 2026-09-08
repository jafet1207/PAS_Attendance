import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical, X } from 'lucide-react'
import { useOutsideClose } from '../../hooks/useOutsideClose'
import styles from './RowActionsMenu.module.css'

const MOBILE_BREAKPOINT = 767
const MENU_WIDTH = 200

// En desktop se comporta como el menú de ModernSelect (portal + position: fixed calculado
// desde el trigger, para no quedar recortado por el overflow:hidden de la tarjeta de la tabla).
// En mobile se convierte en un bottom sheet, que es más usable con el dedo que un dropdown chico.
export default function RowActionsMenu({ ariaLabel, title, subtitle, items }) {
  const [open, setOpen] = useState(false)
  const [menuRect, setMenuRect] = useState(null)
  const [mobile, setMobile] = useState(false)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  useOutsideClose([triggerRef, menuRef], () => setOpen(false))

  function openMenu() {
    const isMobile = window.innerWidth <= MOBILE_BREAKPOINT
    setMobile(isMobile)
    if (!isMobile && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const menuMaxHeight = items.length * 44 + 16
      const espacioAbajo = window.innerHeight - rect.bottom
      const abrirHaciaArriba = espacioAbajo < menuMaxHeight && rect.top > espacioAbajo
      const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8))
      setMenuRect(
        abrirHaciaArriba
          ? { bottom: window.innerHeight - rect.top + 6, left, width: MENU_WIDTH }
          : { top: rect.bottom + 6, left, width: MENU_WIDTH }
      )
    }
    setOpen(true)
  }

  function closeMenu() {
    setOpen(false)
  }

  function runItem(item) {
    closeMenu()
    item.onClick()
  }

  useEffect(() => {
    if (!open) return
    function onKeyDown(event) {
      if (event.key === 'Escape') closeMenu()
    }
    document.addEventListener('keydown', onKeyDown)
    menuRef.current?.querySelector('button')?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={ariaLabel}
        className={styles.trigger}
        onClick={() => (open ? closeMenu() : openMenu())}
        ref={triggerRef}
        type="button"
      >
        <MoreVertical size={18} />
      </button>
      {open && mobile && createPortal(
        <div className={styles.sheetOverlay} onClick={closeMenu}>
          <div aria-label={ariaLabel} className={styles.sheet} onClick={(event) => event.stopPropagation()} ref={menuRef} role="menu">
            <div className={styles.sheetHeader}>
              <div className={styles.sheetIdentity}>
                <strong>{title}</strong>
                {subtitle && <span>{subtitle}</span>}
              </div>
              <button aria-label="Cerrar" className={styles.sheetClose} onClick={closeMenu} type="button">
                <X size={18} />
              </button>
            </div>
            {items.map((item) => (
              <button
                className={`${styles.sheetItem} ${item.tone === 'danger' ? styles.dangerItem : ''}`}
                disabled={item.disabled}
                key={item.key}
                onClick={() => runItem(item)}
                role="menuitem"
                type="button"
              >
                {item.icon && <item.icon size={17} />}
                {item.label}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
      {open && !mobile && menuRect && createPortal(
        <div aria-label={ariaLabel} className={styles.menu} ref={menuRef} role="menu" style={{ position: 'fixed', ...menuRect }}>
          {items.map((item) => (
            <button
              className={`${styles.menuItem} ${item.tone === 'danger' ? styles.dangerItem : ''}`}
              disabled={item.disabled}
              key={item.key}
              onClick={() => runItem(item)}
              role="menuitem"
              type="button"
            >
              {item.icon && <item.icon size={16} />}
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
