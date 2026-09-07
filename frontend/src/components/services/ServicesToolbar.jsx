import { Search } from 'lucide-react'
import { ModernSelect } from '../form/ModernFields'
import styles from './ServicesToolbar.module.css'

export default function ServicesToolbar({ search, onSearchChange, status, onStatusChange, statuses }) {
  const statusOptions = [
    { value: '', label: 'Todos los estados' },
    ...statuses.map((s) => ({ value: s, label: s })),
  ]

  return (
    <div className={styles.toolbar}>
      <div className={styles.searchBox}>
        <Search size={16} className={styles.searchIcon} />
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Buscar servicio..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className={styles.selectWrap}>
        <ModernSelect
          ariaLabel="Filtrar por estado"
          value={status}
          onChange={onStatusChange}
          options={statusOptions}
          placeholder="Todos los estados"
        />
      </div>
    </div>
  )
}
