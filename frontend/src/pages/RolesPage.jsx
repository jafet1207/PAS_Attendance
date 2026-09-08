import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Pencil, Plus, ToggleLeft, ToggleRight } from 'lucide-react'
import Badge from '../components/common/Badge'
import Button from '../components/common/Button'
import ErrorState from '../components/common/ErrorState'
import Modal from '../components/common/Modal'
import PageContainer from '../components/layout/PageContainer'
import PageHeader from '../components/layout/PageHeader'
import Skeleton from '../components/common/Skeleton'
import { ModernSelect } from '../components/form/ModernFields'
import { createPuesto, getPuestos, getServices, setPuestoStatus, updatePuesto } from '../services/servicesApi'
import { formatClosingDate, formatServiceDate } from '../utils/date'
import styles from './RolesPage.module.css'

const emptyForm = { nombre: '', tipo: 'Principal', area_id: '' }
const TIPO_OPTIONS = [
  { value: 'Principal', label: 'Principal' },
  { value: 'Secundario', label: 'Secundario' },
]

function PuestoRow({ puesto, onEdit, onToggle, updating }) {
  return (
    <div className={`${styles.puestoRow} ${!puesto.activo ? styles.puestoInactivo : ''}`}>
      <span className={styles.puestoNombre}>{puesto.nombre}</span>
      <Badge tone={puesto.activo ? 'success' : 'danger'}>{puesto.activo ? 'Activo' : 'Inactivo'}</Badge>
      <div className={styles.puestoActions}>
        <button aria-label={`Editar ${puesto.nombre}`} className={`${styles.iconButton} ${styles.iconButtonInfo}`} onClick={onEdit} type="button">
          <Pencil size={16} />
        </button>
        <button
          aria-label={`${puesto.activo ? 'Desactivar' : 'Activar'} ${puesto.nombre}`}
          className={`${styles.iconButton} ${puesto.activo ? styles.iconButtonDanger : styles.iconButtonSuccess}`}
          disabled={updating}
          onClick={onToggle}
          type="button"
        >
          {puesto.activo ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
        </button>
      </div>
    </div>
  )
}

export default function RolesPage() {
  const [data, setData] = useState(null)
  const [services, setServices] = useState(null)
  const [error, setError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formErrors, setFormErrors] = useState([])
  const [saving, setSaving] = useState(false)
  const [statusUpdatingId, setStatusUpdatingId] = useState(null)

  function load() {
    setError(null)
    Promise.all([getPuestos(), getServices()])
      .then(([puestos, servicios]) => {
        setData(puestos)
        setServices(servicios)
      })
      .catch(() => setError('No pudimos cargar la pantalla de Puestos.'))
  }
  useEffect(() => {
    load()
  }, [])

  function openCreateModal() {
    setEditingId(null)
    setForm(emptyForm)
    setFormErrors([])
    setModalOpen(true)
  }

  function openEditModal(puesto) {
    setEditingId(puesto.id)
    setForm({ nombre: puesto.nombre, tipo: puesto.tipo, area_id: puesto.areaId ? String(puesto.areaId) : '' })
    setFormErrors([])
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
  }

  function updateForm(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
    setFormErrors([])
  }

  async function submit(event) {
    event.preventDefault()
    const nombre = form.nombre.trim()
    const errores = []
    if (nombre.length < 2) errores.push('El nombre debe tener al menos 2 caracteres.')
    if (form.tipo === 'Principal' && !form.area_id) errores.push('Selecciona un Área para un puesto Principal.')
    if (errores.length > 0) {
      setFormErrors(errores)
      return
    }

    setSaving(true)
    setFormErrors([])
    const payload = {
      nombre,
      tipo: form.tipo,
      ...(form.tipo === 'Principal' ? { area_id: Number(form.area_id) } : {}),
    }
    try {
      if (editingId) {
        const updated = await updatePuesto(editingId, payload)
        setData((current) => ({
          ...current,
          puestos: current.puestos.map((p) => (p.id === editingId ? updated : p)),
        }))
      } else {
        const created = await createPuesto(payload)
        setData((current) => ({ ...current, puestos: [...current.puestos, created] }))
      }
      closeModal()
    } catch (requestError) {
      setFormErrors([requestError.message || 'No fue posible guardar el puesto.'])
    } finally {
      setSaving(false)
    }
  }

  async function toggleActivo(puesto) {
    setStatusUpdatingId(puesto.id)
    setError(null)
    try {
      const updated = await setPuestoStatus(puesto.id, !puesto.activo)
      setData((current) => ({
        ...current,
        puestos: current.puestos.map((p) => (p.id === puesto.id ? updated : p)),
      }))
    } catch (requestError) {
      setError(requestError.message || 'No fue posible actualizar el estado del puesto.')
    } finally {
      setStatusUpdatingId(null)
    }
  }

  if (error && data === null) return <PageContainer><ErrorState message={error} onRetry={load} /></PageContainer>
  if (data === null || services === null) return <PageContainer><Skeleton /></PageContainer>

  const serviciosParaAsignar = services.filter((s) => s.assignmentWindowOpen)
  const areaOptions = data.areas.map((a) => ({ value: a.id, label: a.nombre }))
  const secundarios = data.puestos.filter((p) => p.tipo === 'Secundario')
  const gruposPorArea = data.areas.map((area) => ({
    area,
    puestos: data.puestos.filter((p) => p.areaId === area.id),
  }))

  return (
    <PageContainer>
      <PageHeader
        title="Puestos"
        actions={(
          <Button size="sm" onClick={openCreateModal}>
            <Plus size={16} />
            Agregar puesto
          </Button>
        )}
      />

      {error && <div className={styles.inlineError} role="alert">{error}</div>}

      <section className={styles.catalog}>
        <h2 className={styles.sectionTitle}>Asignar puestos por servicio</h2>
        <div className={styles.areaGroup}>
          <div className={styles.puestoList}>
            {serviciosParaAsignar.map((service) => (
              <Link className={styles.serviceRow} key={service.id} to={`/roles/services/${service.id}`}>
                <div>
                  <strong className={styles.serviceName}>{service.name}</strong>
                  <span className={styles.serviceDates}>{formatServiceDate(service.date)} · Cierre {formatClosingDate(service.closingDate)}</span>
                </div>
                <ArrowRight size={18} />
              </Link>
            ))}
            {serviciosParaAsignar.length === 0 && (
              <p className={styles.empty}>Ningún servicio está en la ventana de asignación ahora mismo (debe estar cerrado y no haber ocurrido todavía).</p>
            )}
          </div>
        </div>
      </section>

      <section className={styles.catalog}>
        <h2 className={styles.sectionTitle}>Catálogo de puestos</h2>
        {gruposPorArea.map(({ area, puestos }) => (
          <div className={styles.areaGroup} key={area.id}>
            <h3 className={styles.areaTitle}>{area.nombre}</h3>
            <div className={styles.puestoList}>
              {puestos.map((puesto) => (
                <PuestoRow
                  key={puesto.id}
                  onEdit={() => openEditModal(puesto)}
                  onToggle={() => toggleActivo(puesto)}
                  puesto={puesto}
                  updating={statusUpdatingId === puesto.id}
                />
              ))}
              {puestos.length === 0 && <p className={styles.empty}>Sin puestos en esta área todavía.</p>}
            </div>
          </div>
        ))}
        <div className={styles.areaGroup}>
          <h3 className={styles.areaTitle}>Secundarios (sin Área)</h3>
          <div className={styles.puestoList}>
            {secundarios.map((puesto) => (
              <PuestoRow
                key={puesto.id}
                onEdit={() => openEditModal(puesto)}
                onToggle={() => toggleActivo(puesto)}
                puesto={puesto}
                updating={statusUpdatingId === puesto.id}
              />
            ))}
            {secundarios.length === 0 && <p className={styles.empty}>Sin puestos secundarios todavía.</p>}
          </div>
        </div>
      </section>

      {modalOpen && (
        <Modal title={editingId ? 'Editar puesto' : 'Agregar puesto'} onClose={closeModal}>
          <form className={styles.form} onSubmit={submit}>
            {formErrors.length > 0 && (
              <div className={styles.errors} role="alert">
                {formErrors.map((formError) => <p key={formError}>{formError}</p>)}
              </div>
            )}
            <label className={styles.field}>Nombre
              <input value={form.nombre} onChange={(event) => updateForm('nombre', event.target.value)} required />
            </label>
            <label className={styles.field}>Tipo
              <ModernSelect ariaLabel="Tipo de puesto" onChange={(value) => updateForm('tipo', value)} options={TIPO_OPTIONS} value={form.tipo} />
            </label>
            {form.tipo === 'Principal' && (
              <label className={styles.field}>Área
                <ModernSelect ariaLabel="Área" onChange={(value) => updateForm('area_id', value)} options={areaOptions} placeholder="Selecciona un Área" value={form.area_id} />
              </label>
            )}
            <div className={styles.formActions}>
              <button type="button" onClick={closeModal}>Cancelar</button>
              <Button disabled={saving} type="submit">{saving ? 'Guardando…' : 'Guardar puesto'}</Button>
            </div>
          </form>
        </Modal>
      )}
    </PageContainer>
  )
}
