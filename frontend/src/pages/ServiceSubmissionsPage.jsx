import { useEffect, useState } from 'react'
import { ArrowLeft, Mail, Send } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import Button from '../components/common/Button'
import ErrorState from '../components/common/ErrorState'
import InfoBanner from '../components/common/InfoBanner'
import Pagination from '../components/common/Pagination'
import Skeleton from '../components/common/Skeleton'
import PageContainer from '../components/layout/PageContainer'
import { usePagination } from '../hooks/usePagination'
import { getServiceSubmissions, sendManualReminders } from '../services/servicesApi'
import { formatServiceDate } from '../utils/date'
import styles from './ServiceSubmissionsPage.module.css'

function resumenEnvioManual(resumen) {
  if (resumen.omitido_por_ejecucion_concurrente) {
    return 'Ya hay un envío de recordatorios en curso; intente de nuevo en un momento.'
  }
  const partes = [`${resumen.recordatorios_exitosos} enviados`]
  if (resumen.recordatorios_fallidos > 0) partes.push(`${resumen.recordatorios_fallidos} fallidos`)
  if (resumen.ya_enviado_hoy > 0) partes.push(`${resumen.ya_enviado_hoy} ya recibieron uno hoy`)
  if (resumen.ya_completados > 0) partes.push(`${resumen.ya_completados} alcanzaron el máximo de 3`)
  if (resumen.ya_confirmados > 0) partes.push(`${resumen.ya_confirmados} ya habían confirmado`)
  return partes.join(', ') + '.'
}

export default function ServiceSubmissionsPage() {
  const { serviceId } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState(null)
  function load() { setError(null); setData(null); getServiceSubmissions(serviceId).then(setData).catch(() => setError('No pudimos cargar los envíos.')) }
  useEffect(() => { load() }, [serviceId])
  const { page, setPage, pageSize, setPageSize, pageItems, totalPages, totalItems } =
    usePagination(data?.submissions ?? [])

  async function handleSendNow() {
    setSending(true)
    setSendResult(null)
    try {
      const resumen = await sendManualReminders(serviceId)
      setSendResult(resumenEnvioManual(resumen))
      await load()
    } catch {
      setSendResult('No pudimos enviar los recordatorios. Intente de nuevo.')
    } finally {
      setSending(false)
    }
  }

  if (error) return <PageContainer><ErrorState message={error} onRetry={load} /></PageContainer>
  if (!data) return <PageContainer><Skeleton /></PageContainer>
  return <PageContainer><Link className={styles.back} to={`/services/${serviceId}`}><ArrowLeft size={18} /> Gestionar servicio</Link><header className={styles.header}><Mail size={28} /><div><h1>Registro de envíos</h1><p>{data.service.name} · {formatServiceDate(data.service.date)}</p></div>{data.service.reminderWindowOpen && <Button variant="secondary" onClick={handleSendNow} disabled={sending}><Send size={16} />{sending ? 'Enviando…' : 'Enviar recordatorios ahora'}</Button>}</header>{sendResult && <InfoBanner>{sendResult}</InfoBanner>}{data.submissions.length === 0 ? <div className={styles.empty}>Aún no se han enviado recordatorios para este servicio.</div> : <div className={styles.tableWrap}><table><thead><tr><th>Participante</th><th>Recordatorio</th><th>Fecha</th><th>Resultado</th></tr></thead><tbody>{pageItems.map((submission) => <tr key={submission.id}><td>{submission.participantName}</td><td>#{submission.number}</td><td>{new Date(submission.at).toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' })}</td><td><span className={submission.result === 'exitoso' ? styles.success : styles.failure}>{submission.result}</span></td></tr>)}</tbody></table><Pagination page={page} totalPages={totalPages} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} onPageSizeChange={setPageSize} /></div>}</PageContainer>
}
