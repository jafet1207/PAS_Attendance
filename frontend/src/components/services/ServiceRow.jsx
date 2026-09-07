import { Link } from 'react-router-dom'
import ServiceStatusBadge from './ServiceStatusBadge'
import AttendanceProgress from './AttendanceProgress'
import { formatServiceDate, formatServiceTime, formatClosingDate, formatDaysUntilClosing } from '../../utils/date'
import styles from './ServiceRow.module.css'

export default function ServiceRow({ service }) {
  return (
    <tr className={styles.row}>
      <td className={styles.serviceCell}>
        <div className={styles.dateBadge}>{formatServiceDate(service.date)}</div>
        <div>
          <div className={styles.serviceName}>{service.name}</div>
          <div className={styles.meta}>{formatServiceTime(service.date)}</div>
        </div>
      </td>
      <td>
        <div>{formatClosingDate(service.closingDate)}</div>
        <div className={styles.meta}>{formatDaysUntilClosing(service.daysUntilClosing)}</div>
      </td>
      <td>
        <AttendanceProgress confirmed={service.confirmed} total={service.invited} percentage={service.confirmationPercentage} />
      </td>
      <td>
        <ServiceStatusBadge status={service.status} />
      </td>
      <td className={styles.actions}>
        <Link to={`/services/${service.id}/submissions`} className={styles.secondaryAction}>Envíos</Link>
        <Link to={`/services/${service.id}`} className={styles.primaryAction}>Gestionar →</Link>
      </td>
    </tr>
  )
}
