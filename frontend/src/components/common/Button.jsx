import styles from './Button.module.css'

export default function Button({ variant = 'primary', size = 'md', children, ...props }) {
  return (
    <button className={`${styles.button} ${styles[variant]} ${size === 'sm' ? styles.sm : ''}`} {...props}>
      {children}
    </button>
  )
}
