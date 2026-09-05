import Button from './Button'
import styles from './ErrorState.module.css'

export default function ErrorState({ message = 'No pudimos cargar los servicios.', onRetry }) {
  return (
    <div className={styles.wrapper}>
      <p className={styles.message}>{message}</p>
      {onRetry && <Button variant="secondary" onClick={onRetry}>Reintentar</Button>}
    </div>
  )
}
