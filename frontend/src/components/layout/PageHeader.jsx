import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import styles from './PageHeader.module.css'

export default function PageHeader({ backTo, backLabel, title, actions, illustration }) {
  return (
    <div className={styles.wrapper}>
      {backTo && (
        <Link className={styles.back} to={backTo}>
          <ArrowLeft size={18} /> {backLabel}
        </Link>
      )}
      <div className={styles.row}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>{title}</h1>
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
        {illustration && <div className={styles.illustration} aria-hidden="true">{illustration}</div>}
      </div>
    </div>
  )
}
