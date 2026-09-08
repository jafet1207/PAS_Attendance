import { useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Calendar, ChevronDown, Church, LogOut, Settings, Tag, Users } from 'lucide-react'
import { useOutsideClose } from '../../hooks/useOutsideClose'
import styles from './Sidebar.module.css'

const NAV_ITEMS = [
  {
    to: '/services',
    label: 'Servicios',
    icon: Calendar,
    isActive: (pathname) => pathname.startsWith('/services'),
  },
  {
    to: '/people',
    label: 'Servidores',
    icon: Users,
    isActive: (pathname) => pathname.startsWith('/people'),
  },
  {
    to: '/roles',
    label: 'Puestos',
    icon: Tag,
    isActive: (pathname) => pathname.startsWith('/roles'),
  },
  {
    to: '/settings',
    label: 'Ajustes',
    icon: Settings,
    isActive: (pathname) => pathname.startsWith('/settings'),
  },
]

export default function Sidebar({ open, onNavigate, onLogout }) {
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  const userMenuRef = useRef(null)

  useOutsideClose([userMenuRef], () => setMenuOpen(false))

  async function handleLogout() {
    setMenuOpen(false)
    await onLogout()
    navigate('/login')
  }

  return (
    <>
      <aside className={`${styles.sidebar} ${open ? styles.open : ''}`} aria-label="Navegación principal">
        <div className={styles.identity}>
          <span className={styles.mark}>
            <Church size={22} strokeWidth={1.75} />
          </span>
          <span className={styles.systemName}>
            Confirmación<br />de Asistencia
          </span>
        </div>

        <nav className={styles.nav}>
          {NAV_ITEMS.map(({ to, label, icon: Icon, isActive }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
              className={isActive(pathname) ? styles.navLinkActive : styles.navLink}
            >
              <Icon size={18} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.userMenu} ref={userMenuRef}>
          {menuOpen && (
            <div className={styles.dropdown} role="menu">
              <button className={styles.dropdownItem} onClick={handleLogout} role="menuitem">
                <LogOut size={16} />
                Cerrar sesión
              </button>
            </div>
          )}
          <button className={styles.userButton} onClick={() => setMenuOpen((v) => !v)} aria-haspopup="menu" aria-expanded={menuOpen}>
            <span className={styles.avatar}>C</span>
            <span className={styles.roleLabel}>Coordinación</span>
            <ChevronDown size={16} />
          </button>
        </div>
      </aside>
      {open && <div className={styles.overlay} onClick={onNavigate} aria-hidden="true" />}
    </>
  )
}
