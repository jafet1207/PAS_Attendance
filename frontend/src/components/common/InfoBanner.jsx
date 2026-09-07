import { Info } from 'lucide-react'
import styles from './InfoBanner.module.css'

export default function InfoBanner({ children }) {
  return (
    <div className={styles.banner} role="note">
      <Info size={16} className={styles.icon} />
      <span>{children}</span>
    </div>
  )
}
