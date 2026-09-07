import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import ServicesPage from './pages/ServicesPage'
import CreateServicePage from './pages/CreateServicePage'
import ServiceDetailPage from './pages/ServiceDetailPage'
import ServiceSubmissionsPage from './pages/ServiceSubmissionsPage'
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
    <AppLayout onLogout={logout}>
      <Routes>
        <Route path="/" element={<Navigate to="/services" replace />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/services/new" element={<CreateServicePage />} />
        <Route path="/services/:serviceId" element={<ServiceDetailPage />} />
        <Route path="/services/:serviceId/submissions" element={<ServiceSubmissionsPage />} />
        <Route path="*" element={<Navigate to="/services" replace />} />
      </Routes>
    </AppLayout>
  )
}
