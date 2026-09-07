import styles from './FormSection.module.css'

export default function FormSection({ icon: Icon, title, children }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>
        {Icon && (
          <span className={styles.iconBadge}>
            <Icon size={18} strokeWidth={1.75} />
          </span>
        )}
        {title}
      </h2>
      <div className={styles.body}>{children}</div>
    </section>
  )
}
