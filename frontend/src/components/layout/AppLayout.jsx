import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import AppFooter from './AppFooter'
import styles from './AppLayout.module.css'

export default function AppLayout({ onLogout, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  return (
    <div className={styles.shell}>
      <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
      <div className={styles.column}>
        <TopBar onLogout={onLogout} onOpenSidebar={() => setSidebarOpen(true)} />
        <main className={styles.main}>{children}</main>
        <AppFooter />
      </div>
    </div>
  )
}
