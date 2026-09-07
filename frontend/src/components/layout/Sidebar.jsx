import { NavLink, useLocation } from 'react-router-dom'
import { Calendar, Church, Users } from 'lucide-react'
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
]

export default function Sidebar({ open, onNavigate }) {
  const { pathname } = useLocation()

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
      </aside>
      {open && <div className={styles.overlay} onClick={onNavigate} aria-hidden="true" />}
    </>
  )
}
