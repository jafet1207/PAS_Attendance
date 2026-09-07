import styles from './ServicesStats.module.css'

function findNearestService(services) {
  if (services.length === 0) return null
  const now = new Date()
  const sorted = [...services].sort((a, b) => new Date(a.date) - new Date(b.date))
  const upcoming = sorted.find((s) => new Date(s.date) >= now)
  return upcoming ?? sorted[sorted.length - 1]
}

export default function ServicesStats({ services }) {
  const nearest = findNearestService(services)

  const items = [
    { label: 'Convocados', value: nearest ? nearest.invited : '—' },
    { label: 'Confirmados', value: nearest ? nearest.confirmed : '—' },
    { label: 'Pendientes', value: nearest ? nearest.pending : '—' },
    { label: 'Confirmación', value: nearest ? `${nearest.confirmationPercentage}%` : '—' },
  ]

  return (
    <div className={styles.wrapper}>
      <div className={styles.nearestGroup}>
        {nearest && <p className={styles.caption}>Servicio más próximo: {nearest.name}</p>}
        <div className={styles.grid}>
          {items.map((item, i) => (
            <div className={styles.item} key={item.label}>
              {i > 0 && <span className={styles.divider} />}
              <span className={styles.value}>{item.value}</span>
              <span className={styles.label}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.totalGroup}>
        <span className={styles.value}>{services.length}</span>
        <span className={styles.label}>Servicios activos</span>
      </div>
    </div>
  )
}
