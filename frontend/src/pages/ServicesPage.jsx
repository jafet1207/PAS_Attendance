import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import PageContainer from '../components/layout/PageContainer'
import PageHeader from '../components/layout/PageHeader'
import ServicesStats from '../components/services/ServicesStats'
import ServicesToolbar from '../components/services/ServicesToolbar'
import ServicesList from '../components/services/ServicesList'
import Skeleton from '../components/common/Skeleton'
import ErrorState from '../components/common/ErrorState'
import Button from '../components/common/Button'
import { getServices } from '../services/servicesApi'
import styles from './ServicesPage.module.css'

export default function ServicesPage() {
  const navigate = useNavigate()
  const [services, setServices] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  function load() {
    setError(null)
    setServices(null)
    getServices()
      .then(setServices)
      .catch(() => setError('No pudimos cargar los servicios.'))
  }

  useEffect(() => {
    load()
  }, [])

  const statuses = ['Pendiente', 'Vencido', 'Cerrado', 'Completo']

  const filtered = useMemo(() => {
    if (!services) return []
    const term = search.trim().toLowerCase()
    return services.filter((s) => {
      const matchesSearch = !term
        || s.name.toLowerCase().includes(term)
        || s.status.toLowerCase().includes(term)
      const matchesStatus = !status || s.status === status
      return matchesSearch && matchesStatus
    })
  }, [services, search, status])

  function clearFilters() {
    setSearch('')
    setStatus('')
  }

  const hasFilters = Boolean(search || status)

  return (
    <PageContainer>
      <PageHeader
        title="Servicios"
        description="Gestiona convocatorias, confirmaciones y asistencia de tus servicios."
        actions={(
          <Button onClick={() => navigate('/services/new')}>
            <Plus size={16} />
            Crear servicio
          </Button>
        )}
      />

      {error && <ErrorState onRetry={load} />}

      {!error && services === null && <Skeleton />}

      {!error && services !== null && (
        <div className={styles.body}>
          <ServicesStats services={services} />
          <ServicesToolbar
            search={search}
            onSearchChange={setSearch}
            status={status}
            onStatusChange={setStatus}
            statuses={statuses}
          />
          <ServicesList services={filtered} hasFilters={hasFilters} onClearFilters={clearFilters} />
        </div>
      )}
    </PageContainer>
  )
}
