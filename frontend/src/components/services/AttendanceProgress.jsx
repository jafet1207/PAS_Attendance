import styles from './AttendanceProgress.module.css'

export default function AttendanceProgress({ confirmed, total, percentage }) {
  const isComplete = total > 0 && confirmed === total
  return (
    <div className={styles.wrapper}>
      <div className={styles.labelRow}>
        <span className={styles.label}>{confirmed} de {total} confirmados</span>
        <span className={styles.percentage}>{percentage}%</span>
      </div>
      <div className={styles.track}>
        <div
          className={`${styles.fill} ${isComplete ? styles.complete : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {total - confirmed > 0 && (
        <span className={styles.pending}>{total - confirmed} pendientes</span>
      )}
    </div>
  )
}
