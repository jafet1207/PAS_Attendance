import styles from './PageContainer.module.css'

export default function PageContainer({ children, className = '' }) {
  return <div className={`${styles.container} ${className}`}>{children}</div>
}
