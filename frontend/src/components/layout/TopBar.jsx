import { Menu } from 'lucide-react'
import styles from './TopBar.module.css'

// Barra visible solo en móvil (Sidebar vive fuera de pantalla ahí, ver Sidebar.module.css):
// su único propósito es dar acceso al botón que abre la navegación. En escritorio no se
// renderiza nada (el usuario y el cierre de sesión viven en el pie del Sidebar).
export default function TopBar({ onOpenSidebar }) {
  return (
    <header className={styles.header}>
      <button className={styles.menuButton} onClick={onOpenSidebar} aria-label="Abrir navegación">
        <Menu size={22} />
      </button>
    </header>
  )
}
