import styles from './Badge.module.css'

export default function Badge({ children, tone = 'neutral', dot = true }) {
  return <span className={`${styles.badge} ${styles[tone]} ${dot ? '' : styles.noDot}`}>{children}</span>
}
