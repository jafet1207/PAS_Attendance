import { useEffect, useState } from 'react'
import { ArrowLeft, Mail } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ErrorState from '../components/common/ErrorState'
import Pagination from '../components/common/Pagination'
import Skeleton from '../components/common/Skeleton'
import PageContainer from '../components/layout/PageContainer'
import { usePagination } from '../hooks/usePagination'
import { getServiceSubmissions } from '../services/servicesApi'
import { formatServiceDate } from '../utils/date'
import styles from './ServiceSubmissionsPage.module.css'

export default function ServiceSubmissionsPage() {
  const { serviceId } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  function load() { setError(null); setData(null); getServiceSubmissions(serviceId).then(setData).catch(() => setError('No pudimos cargar los envíos.')) }
  useEffect(() => { load() }, [serviceId])
  const { page, setPage, pageSize, setPageSize, pageItems, totalPages, totalItems } =
    usePagination(data?.submissions ?? [])
  if (error) return <PageContainer><ErrorState message={error} onRetry={load} /></PageContainer>
  if (!data) return <PageContainer><Skeleton /></PageContainer>
  return <PageContainer><Link className={styles.back} to={`/services/${serviceId}`}><ArrowLeft size={18} /> Gestionar servicio</Link><header className={styles.header}><Mail size={28} /><div><h1>Registro de envíos</h1><p>{data.service.name} · {formatServiceDate(data.service.date)}</p></div></header>{data.submissions.length === 0 ? <div className={styles.empty}>Aún no se han enviado recordatorios para este servicio.</div> : <div className={styles.tableWrap}><table><thead><tr><th>Participante</th><th>Recordatorio</th><th>Fecha</th><th>Resultado</th></tr></thead><tbody>{pageItems.map((submission) => <tr key={submission.id}><td>{submission.participantName}</td><td>#{submission.number}</td><td>{new Date(submission.at).toLocaleString('es-CR')}</td><td><span className={submission.result === 'exitoso' ? styles.success : styles.failure}>{submission.result}</span></td></tr>)}</tbody></table><Pagination page={page} totalPages={totalPages} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} onPageSizeChange={setPageSize} /></div>}</PageContainer>
}
