import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { ChevronDown, LogOut } from 'lucide-react'
import styles from './AppHeader.module.css'

export default function AppHeader({ onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  async function handleLogout() {
    setMenuOpen(false)
    await onLogout()
    navigate('/login')
  }

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <span className={styles.logo}>Confirmación de Asistencia</span>
        <nav className={styles.nav}>
          <NavLink to="/services" className={({ isActive }) => (isActive ? styles.navLinkActive : styles.navLink)}>
            Servicios
          </NavLink>
          <NavLink to="/services/new" className={({ isActive }) => (isActive ? styles.navLinkActive : styles.navLink)}>
            Nuevo Servicio
          </NavLink>
          <NavLink to="/people" className={({ isActive }) => (isActive ? styles.navLinkActive : styles.navLink)}>
            Servidores
          </NavLink>
        </nav>
      </div>

      <div className={styles.right}>
        <span className={styles.roleBadge}>Coordinación</span>
        <div className={styles.userMenu}>
          <button className={styles.userButton} onClick={() => setMenuOpen((v) => !v)}>
            <span className={styles.avatar}>C</span>
            <ChevronDown size={16} />
          </button>
          {menuOpen && (
            <div className={styles.dropdown}>
              <button className={styles.dropdownItem} onClick={handleLogout}>
                <LogOut size={16} />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
