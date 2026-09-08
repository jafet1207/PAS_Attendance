import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { ModernSelect } from '../form/ModernFields'
import { PAGE_SIZE_OPTIONS } from '../../hooks/usePagination'
import styles from './Pagination.module.css'

export default function Pagination({ page, totalPages, pageSize, onPageChange, onPageSizeChange, totalItems }) {
  if (totalItems === 0) return null

  const isFirst = page <= 1
  const isLast = page >= totalPages

  return (
    <div className={styles.pagination}>
      <div className={styles.pageSize}>
        <span>Mostrar</span>
        <ModernSelect
          ariaLabel="Filas por página"
          value={pageSize}
          onChange={(value) => onPageSizeChange(Number(value))}
          options={PAGE_SIZE_OPTIONS.map((n) => ({ value: n, label: String(n) }))}
        />
      </div>

      <div className={styles.info}>Página {page} de {totalPages}</div>

      <div className={styles.controls}>
        <button aria-label="Primera página" disabled={isFirst} onClick={() => onPageChange(1)} type="button">
          <ChevronsLeft size={16} />
        </button>
        <button aria-label="Página anterior" disabled={isFirst} onClick={() => onPageChange(page - 1)} type="button">
          <ChevronLeft size={16} />
        </button>
        <button aria-label="Página siguiente" disabled={isLast} onClick={() => onPageChange(page + 1)} type="button">
          <ChevronRight size={16} />
        </button>
        <button aria-label="Última página" disabled={isLast} onClick={() => onPageChange(totalPages)} type="button">
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  )
}
