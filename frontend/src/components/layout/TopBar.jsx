import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, LogOut, Menu } from 'lucide-react'
import styles from './TopBar.module.css'

export default function TopBar({ onLogout, onOpenSidebar }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  async function handleLogout() {
    setMenuOpen(false)
    await onLogout()
    navigate('/login')
  }

  return (
    <header className={styles.header}>
      <button className={styles.menuButton} onClick={onOpenSidebar} aria-label="Abrir navegación">
        <Menu size={22} />
      </button>

      <div className={styles.userMenu}>
        <button className={styles.userButton} onClick={() => setMenuOpen((v) => !v)} aria-haspopup="menu" aria-expanded={menuOpen}>
          <span className={styles.avatar}>C</span>
          <span className={styles.roleLabel}>Coordinación</span>
          <ChevronDown size={16} />
        </button>
        {menuOpen && (
          <div className={styles.dropdown} role="menu">
            <button className={styles.dropdownItem} onClick={handleLogout} role="menuitem">
              <LogOut size={16} />
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
