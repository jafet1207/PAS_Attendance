import ServiceRow from './ServiceRow'
import ServiceCard from './ServiceCard'
import EmptyState from '../common/EmptyState'
import Button from '../common/Button'
import styles from './ServicesList.module.css'

export default function ServicesList({ services, hasFilters, onClearFilters }) {
  if (services.length === 0 && hasFilters) {
    return (
      <EmptyState
        title="No encontramos servicios"
        description="Prueba cambiando la búsqueda o los filtros."
        action={<Button variant="secondary" onClick={onClearFilters}>Limpiar filtros</Button>}
      />
    )
  }

  if (services.length === 0) {
    return (
      <EmptyState
        title="No hay servicios todavía"
        description="Crea tu primer servicio para comenzar a gestionar convocatorias y confirmaciones."
      />
    )
  }

  return (
    <>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Servicio</th>
            <th>Cierre</th>
            <th>Asistencia</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {services.map((s) => (
            <ServiceRow key={s.id} service={s} />
          ))}
        </tbody>
      </table>

      <div className={styles.cards}>
        {services.map((s) => (
          <ServiceCard key={s.id} service={s} />
        ))}
      </div>
    </>
  )
}
