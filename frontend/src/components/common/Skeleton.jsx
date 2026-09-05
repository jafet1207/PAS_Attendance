import styles from './Skeleton.module.css'

export default function Skeleton({ height = 76, count = 4 }) {
  return (
    <div className={styles.stack}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.row} style={{ height }} />
      ))}
    </div>
  )
}
