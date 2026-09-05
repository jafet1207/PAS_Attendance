import { Navigate, Route, Routes } from 'react-router-dom'
import AppHeader from './components/layout/AppHeader'
import AppFooter from './components/layout/AppFooter'
import LoginPage from './pages/LoginPage'
import { useSession } from './hooks/useSession'

export default function App() {
  const { status, login, logout } = useSession()

  if (status === 'loading') {
    return null
  }

  if (status === 'anonymous') {
    return (
      <div className="app-shell">
        <Routes>
          <Route path="*" element={<LoginPage onLogin={login} />} />
        </Routes>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <AppHeader onLogout={logout} />
      <main className="app-main">
        <Routes>
          <Route path="*" element={
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <h2 style={{ color: 'var(--color-primary, #2E5A44)', marginBottom: '8px' }}>Bienvenido al Panel de Coordinación</h2>
              <p style={{ color: 'var(--color-text-muted, #5C5852)' }}>Sesión de coordinador iniciada correctamente.</p>
            </div>
          } />
        </Routes>
      </main>
      <AppFooter />
    </div>
  )
}
