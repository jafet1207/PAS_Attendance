import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Mail, Search } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ErrorState from '../components/common/ErrorState'
import Pagination from '../components/common/Pagination'
import Skeleton from '../components/common/Skeleton'
import PageContainer from '../components/layout/PageContainer'
import ServiceStatusBadge from '../components/services/ServiceStatusBadge'
import { usePagination } from '../hooks/usePagination'
import { formatClosingDate, formatServiceDate, formatServiceTime } from '../utils/date'
import { getAsignaciones, getServiceDetail } from '../services/servicesApi'
import styles from './ServiceDetailPage.module.css'

export default function ServiceDetailPage() {
  const { serviceId } = useParams()
  const [detail, setDetail] = useState(null)
  const [puestosPorParticipante, setPuestosPorParticipante] = useState({})
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('Todos')
  const [query, setQuery] = useState('')

  function load() {
    setError(null)
    setDetail(null)
    getServiceDetail(serviceId).then(setDetail).catch(() => setError('No pudimos cargar este servicio.'))
    // Asignaciones de puestos (Etapa 11): informativo, se ignora si falla (p. ej. servicio sin
    // participantes elegibles todavía) para no bloquear el detalle del servicio por esto.
    getAsignaciones(serviceId)
      .then((asignaciones) => {
        const mapa = Object.fromEntries(
          asignaciones.participants
            .filter((p) => p.puestos.some((puesto) => puesto.tipo === 'Principal'))
            .map((p) => [p.id, p.puestos.find((puesto) => puesto.tipo === 'Principal').nombre])
        )
        setPuestosPorParticipante(mapa)
      })
      .catch(() => setPuestosPorParticipante({}))
  }
  useEffect(() => { load() }, [serviceId])

  const participants = useMemo(() => (detail?.participants ?? []).filter((participant) => {
    const matchesText = participant.name.toLowerCase().includes(query.trim().toLowerCase())
    const matchesFilter = filter === 'Todos' || (filter === 'Pendientes' ? participant.status === 'Pendiente' : participant.status !== 'Pendiente')
    return matchesText && matchesFilter
  }), [detail, filter, query])

  const { page, setPage, pageSize, setPageSize, pageItems, totalPages, totalItems } =
    usePagination(participants)

  useEffect(() => {
    setPage(1)
  }, [query, filter, setPage])

  if (error) return <PageContainer><ErrorState message={error} onRetry={load} /></PageContainer>
  if (!detail) return <PageContainer><Skeleton /></PageContainer>

  const { service } = detail
  const confirmed = detail.participants.filter((participant) => participant.status !== 'Pendiente').length
  const pending = detail.participants.length - confirmed
  return (
    <PageContainer>
      <Link className={styles.back} to="/services"><ArrowLeft size={18} /> Servicios</Link>
      <header className={styles.header}>
        <div className={styles.date}>{formatServiceDate(service.date)}</div>
        <div className={styles.titleBlock}><h1>{service.name}</h1><p>{formatServiceTime(service.date)} · Cierre {formatClosingDate(service.closingDate)}</p></div>
        <div className={styles.summary} aria-label="Resumen de asistencia">
          <div><strong>{detail.participants.length}</strong><span>Convocados</span></div>
          <div><strong>{confirmed}</strong><span>Confirmados</span></div>
          <div><strong>{pending}</strong><span>Pendientes</span></div>
        </div>
        <ServiceStatusBadge status={service.status} />
      </header>
      <section className={styles.participants}>
        <div className={styles.listHeader}><div><h2>Personas convocadas</h2><p>Revisa la respuesta y el último recordatorio de cada persona.</p></div><Link to={`/services/${service.id}/submissions`}><Mail size={17} /> Ver envíos</Link></div>
        <div className={styles.controls}><label className={styles.search}><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre" /></label>{['Todos', 'Pendientes', 'Confirmados'].map((item) => <button className={filter === item ? styles.active : ''} key={item} onClick={() => setFilter(item)} type="button">{item}</button>)}</div>
        <div className={styles.rows}>{pageItems.map((participant) => <article className={styles.row} key={participant.id}><div className={styles.avatar}>{participant.name.split(' ').slice(0, 2).map((part) => part[0]).join('')}</div><div className={styles.person}><strong>{participant.name}</strong><span>{participant.email}</span></div><span className={participant.status === 'Pendiente' ? styles.pending : styles.confirmed}>{participant.status === 'Pendiente' ? 'Pendiente' : `Confirmado: ${participant.status}`}</span>{puestosPorParticipante[participant.id] && <span className={styles.puesto}>{puestosPorParticipante[participant.id]}</span>}<span className={styles.delivery}>{participant.lastDelivery ? `Último envío: ${participant.lastDelivery.result}` : 'Sin envíos todavía'}</span></article>)}</div>
        <Pagination page={page} totalPages={totalPages} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </section>
    </PageContainer>
  )
}
