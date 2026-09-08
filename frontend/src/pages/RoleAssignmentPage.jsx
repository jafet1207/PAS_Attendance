import { useEffect, useState } from 'react'
import { ArrowLeft, Check } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ErrorState from '../components/common/ErrorState'
import PageContainer from '../components/layout/PageContainer'
import Skeleton from '../components/common/Skeleton'
import { ModernSelect } from '../components/form/ModernFields'
import { getAsignaciones, getPuestos, guardarAsignacion } from '../services/servicesApi'
import { formatServiceDate } from '../utils/date'
import styles from './RoleAssignmentPage.module.css'

const SIN_PRINCIPAL = ''

function seleccionInicial(participant) {
  const principal = participant.puestos.find((p) => p.tipo === 'Principal')
  const secundarios = new Set(participant.puestos.filter((p) => p.tipo === 'Secundario').map((p) => p.id))
  return { principalId: principal ? String(principal.id) : SIN_PRINCIPAL, secundarios }
}

export default function RoleAssignmentPage() {
  const { serviceId } = useParams()
  const [data, setData] = useState(null)
  const [catalogo, setCatalogo] = useState(null)
  const [error, setError] = useState(null)
  const [seleccion, setSeleccion] = useState({})
  const [savingId, setSavingId] = useState(null)
  const [savedId, setSavedId] = useState(null)
  const [rowErrors, setRowErrors] = useState({})

  function load() {
    setError(null)
    Promise.all([getAsignaciones(serviceId), getPuestos()])
      .then(([asignaciones, puestos]) => {
        setData(asignaciones)
        setCatalogo(puestos)
        setSeleccion(
          Object.fromEntries(asignaciones.participants.map((p) => [p.id, seleccionInicial(p)]))
        )
      })
      .catch(() => setError('No pudimos cargar la asignación de puestos de este servicio.'))
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId])

  if (error) return <PageContainer><ErrorState message={error} onRetry={load} /></PageContainer>
  if (data === null || catalogo === null) return <PageContainer><Skeleton /></PageContainer>

  const puestosPrincipales = catalogo.puestos.filter((p) => p.tipo === 'Principal' && p.activo)
  const puestosSecundarios = catalogo.puestos.filter((p) => p.tipo === 'Secundario' && p.activo)
  const opcionesPrincipal = [
    { value: SIN_PRINCIPAL, label: 'Sin asignar' },
    ...puestosPrincipales.map((p) => ({ value: p.id, label: p.nombre })),
  ]

  function setPrincipal(participantId, value) {
    setSeleccion((current) => ({
      ...current,
      [participantId]: { ...current[participantId], principalId: value },
    }))
  }

  function toggleSecundario(participantId, puestoId) {
    setSeleccion((current) => {
      const actual = current[participantId]
      const secundarios = new Set(actual.secundarios)
      if (secundarios.has(puestoId)) secundarios.delete(puestoId)
      else secundarios.add(puestoId)
      return { ...current, [participantId]: { ...actual, secundarios } }
    })
  }

  async function guardarFila(participantId) {
    const fila = seleccion[participantId]
    const puestoIds = [
      ...(fila.principalId ? [Number(fila.principalId)] : []),
      ...Array.from(fila.secundarios),
    ]
    setSavingId(participantId)
    setSavedId(null)
    setRowErrors((current) => ({ ...current, [participantId]: null }))
    try {
      await guardarAsignacion(serviceId, participantId, puestoIds)
      setSavedId(participantId)
    } catch (requestError) {
      setRowErrors((current) => ({
        ...current,
        [participantId]: requestError.message || 'No fue posible guardar la asignación.',
      }))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <PageContainer>
      <Link className={styles.back} to="/roles"><ArrowLeft size={18} /> Puestos</Link>
      <header className={styles.header}>
        <h1>Asignar puestos</h1>
        <p>{data.service.name} · {formatServiceDate(data.service.date)}</p>
      </header>

      <div className={styles.rows}>
        {data.participants.map((participant) => {
          const fila = seleccion[participant.id] ?? { principalId: SIN_PRINCIPAL, secundarios: new Set() }
          return (
            <article className={styles.row} key={participant.id}>
              <div className={styles.identity}>
                <strong>{participant.name}</strong>
                <span>{participant.email} · {participant.groupName}</span>
              </div>

              <div className={styles.field}>
                <span className={styles.fieldLabel}>Principal</span>
                <ModernSelect
                  ariaLabel={`Puesto principal de ${participant.name}`}
                  onChange={(value) => setPrincipal(participant.id, value)}
                  options={opcionesPrincipal}
                  value={fila.principalId}
                />
              </div>

              <div className={styles.field}>
                <span className={styles.fieldLabel}>Secundarios</span>
                <div className={styles.chips}>
                  {puestosSecundarios.map((puesto) => (
                    <button
                      className={`${styles.chip} ${fila.secundarios.has(puesto.id) ? styles.chipActive : ''}`}
                      key={puesto.id}
                      onClick={() => toggleSecundario(participant.id, puesto.id)}
                      type="button"
                    >
                      {fila.secundarios.has(puesto.id) && <Check size={13} />}
                      {puesto.nombre}
                    </button>
                  ))}
                  {puestosSecundarios.length === 0 && <span className={styles.noChips}>Sin puestos secundarios en el catálogo.</span>}
                </div>
              </div>

              <div className={styles.rowActions}>
                <button
                  className={styles.saveButton}
                  disabled={savingId === participant.id}
                  onClick={() => guardarFila(participant.id)}
                  type="button"
                >
                  {savingId === participant.id ? 'Guardando…' : 'Guardar'}
                </button>
                {savedId === participant.id && <span className={styles.savedNote}>Guardado</span>}
                {rowErrors[participant.id] && <span className={styles.rowError}>{rowErrors[participant.id]}</span>}
              </div>
            </article>
          )
        })}
        {data.participants.length === 0 && (
          <p className={styles.empty}>Todavía no hay participantes elegibles para asignar puestos en este servicio.</p>
        )}
      </div>
    </PageContainer>
  )
}
