import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Mail, Search } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ErrorState from '../components/common/ErrorState'
import Skeleton from '../components/common/Skeleton'
import PageContainer from '../components/layout/PageContainer'
import ServiceStatusBadge from '../components/services/ServiceStatusBadge'
import { formatClosingDate, formatServiceDate, formatServiceTime } from '../utils/date'
import { getServiceDetail } from '../services/servicesApi'
import styles from './ServiceDetailPage.module.css'

export default function ServiceDetailPage() {
  const { serviceId } = useParams()
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('Todos')
  const [query, setQuery] = useState('')

  function load() { setError(null); setDetail(null); getServiceDetail(serviceId).then(setDetail).catch(() => setError('No pudimos cargar este servicio.')) }
  useEffect(() => { load() }, [serviceId])

  const participants = useMemo(() => (detail?.participants ?? []).filter((participant) => {
    const matchesText = participant.name.toLowerCase().includes(query.trim().toLowerCase())
    const matchesFilter = filter === 'Todos' || (filter === 'Pendientes' ? participant.status === 'Pendiente' : participant.status !== 'Pendiente')
    return matchesText && matchesFilter
  }), [detail, filter, query])

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
        <div><h1>{service.name}</h1><p>{formatServiceTime(service.date)} · Cierre {formatClosingDate(service.closingDate)}</p></div>
        <ServiceStatusBadge status={service.status} />
      </header>
      <section className={styles.summary} aria-label="Resumen de asistencia">
        <div><strong>{detail.participants.length}</strong><span>Convocados</span></div>
        <div><strong>{confirmed}</strong><span>Confirmados</span></div>
        <div><strong>{pending}</strong><span>Pendientes</span></div>
      </section>
      <section className={styles.participants}>
        <div className={styles.listHeader}><div><h2>Personas convocadas</h2><p>Revisa la respuesta y el último recordatorio de cada persona.</p></div><Link to={`/services/${service.id}/submissions`}><Mail size={17} /> Ver envíos</Link></div>
        <div className={styles.controls}><label className={styles.search}><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre" /></label>{['Todos', 'Pendientes', 'Confirmados'].map((item) => <button className={filter === item ? styles.active : ''} key={item} onClick={() => setFilter(item)} type="button">{item}</button>)}</div>
        <div className={styles.rows}>{participants.map((participant) => <article className={styles.row} key={participant.id}><div className={styles.avatar}>{participant.name.split(' ').slice(0, 2).map((part) => part[0]).join('')}</div><div className={styles.person}><strong>{participant.name}</strong><span>{participant.email}</span></div><span className={participant.status === 'Pendiente' ? styles.pending : styles.confirmed}>{participant.status === 'Pendiente' ? 'Pendiente' : `Confirmado: ${participant.status}`}</span><span className={styles.delivery}>{participant.lastDelivery ? `Último envío: ${participant.lastDelivery.result}` : 'Sin envíos todavía'}</span></article>)}</div>
      </section>
    </PageContainer>
  )
}
