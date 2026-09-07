import { Link } from 'react-router-dom'
import ServiceStatusBadge from './ServiceStatusBadge'
import AttendanceProgress from './AttendanceProgress'
import { formatServiceDate, formatServiceTime, formatClosingDate, formatDaysUntilClosing } from '../../utils/date'
import styles from './ServiceCard.module.css'

export default function ServiceCard({ service }) {
  return (
    <div className={styles.card}>
      <div className={styles.topRow}>
        <span className={styles.date}>{formatServiceDate(service.date)}</span>
        <ServiceStatusBadge status={service.status} />
      </div>
      <div className={styles.name}>{service.name}</div>
      <div className={styles.meta}>{formatServiceTime(service.date)}</div>

      <AttendanceProgress confirmed={service.confirmed} total={service.invited} percentage={service.confirmationPercentage} />

      <div className={styles.closing}>
        <span className={styles.closingLabel}>Cierre</span>
        <span>{formatClosingDate(service.closingDate)} · {formatDaysUntilClosing(service.daysUntilClosing)}</span>
      </div>

      <div className={styles.footer}>
        <Link to={`/services/${service.id}/submissions`} className={styles.secondaryAction}>Envíos</Link>
        <Link to={`/services/${service.id}`} className={styles.primaryAction}>Gestionar →</Link>
      </div>
    </div>
  )
}
