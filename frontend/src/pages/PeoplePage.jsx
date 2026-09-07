import { useEffect, useMemo, useState } from 'react'
import { Check, Pencil, Plus, Search, Users, X } from 'lucide-react'
import Button from '../components/common/Button'
import ErrorState from '../components/common/ErrorState'
import Modal from '../components/common/Modal'
import PageContainer from '../components/layout/PageContainer'
import PageHeader from '../components/layout/PageHeader'
import Skeleton from '../components/common/Skeleton'
import { ModernSelect } from '../components/form/ModernFields'
import { createParticipant, getGroups, getParticipants, updateParticipantRole } from '../services/servicesApi'
import styles from './PeoplePage.module.css'

const emptyForm = { nombre: '', primer_apellido: '', segundo_apellido: '', correo: '', grupo_id: '' }

export default function PeoplePage() {
  const [people, setPeople] = useState(null)
  const [groups, setGroups] = useState(null)
  const [query, setQuery] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formErrors, setFormErrors] = useState([])
  const [error, setError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [roleId, setRoleId] = useState('')
  const [updatingRole, setUpdatingRole] = useState(false)

  function load() {
    setError(null)
    Promise.all([getParticipants(), getGroups()])
      .then(([participants, availableGroups]) => {
        setPeople(participants)
        setGroups(availableGroups)
      })
      .catch(() => setError('No pudimos cargar las personas.'))
  }
  useEffect(() => {
    load()
  }, [])

  const visiblePeople = useMemo(
    () =>
      (people ?? []).filter((person) => {
        const matchesText = `${person.name} ${person.email}`.toLowerCase().includes(query.trim().toLowerCase())
        const matchesGroup = !groupFilter || person.group.id === Number(groupFilter)
        return matchesText && matchesGroup
      }),
    [people, query, groupFilter]
  )

  function updateForm(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
    setFormErrors([])
  }

  function closeModal() {
    setModalOpen(false)
    setForm(emptyForm)
    setFormErrors([])
  }

  const canSave = Boolean(
    form.nombre.trim() && form.primer_apellido.trim() && form.correo.trim() && form.grupo_id
  )

  async function submit(event) {
    event.preventDefault()
    if (!canSave) {
      setFormErrors(['Completa el nombre, el primer apellido, el correo y selecciona un grupo.'])
      return
    }
    setSaving(true)
    setFormErrors([])
    try {
      const participant = await createParticipant(form)
      setPeople((current) => [...current, participant].sort((a, b) => a.name.localeCompare(b.name, 'es')))
      closeModal()
    } catch (requestError) {
      setFormErrors(requestError.message ? [requestError.message] : ['No fue posible guardar la persona.'])
    } finally {
      setSaving(false)
    }
  }

  function startRoleEdit(person) {
    setEditingId(person.id)
    setRoleId(String(person.group.id))
    setError(null)
  }

  async function saveRole(personId) {
    setUpdatingRole(true)
    setError(null)
    try {
      const updated = await updateParticipantRole(personId, roleId)
      setPeople((current) =>
        current.map((person) => (person.id === personId ? { ...person, group: updated.group } : person))
      )
      setEditingId(null)
    } catch (requestError) {
      setError(requestError.message || 'No fue posible cambiar el rol.')
    } finally {
      setUpdatingRole(false)
    }
  }

  if (error && people === null) return <PageContainer><ErrorState message={error} onRetry={load} /></PageContainer>
  if (people === null || groups === null) return <PageContainer><Skeleton /></PageContainer>

  const groupOptions = groups.map((g) => ({ value: g.id, label: g.name }))

  return (
    <PageContainer>
      <PageHeader
        title="Servidores"
        description="Administra los servidores convocados a los servicios y el grupo al que pertenecen."
        actions={(
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={16} />
            Agregar servidor
          </Button>
        )}
      />

      {error && <div className={styles.inlineError} role="alert">{error}</div>}

      <section className={styles.list}>
        <div className={styles.controls}>
          <label className={styles.search}>
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre o correo" />
          </label>
          <div className={styles.filterSelect}>
            <ModernSelect
              ariaLabel="Filtrar por grupo"
              value={groupFilter}
              onChange={setGroupFilter}
              placeholder="Todos los grupos"
              options={[{ value: '', label: 'Todos los grupos' }, ...groupOptions]}
            />
          </div>
        </div>

        <div className={styles.count}>
          {visiblePeople.length} {visiblePeople.length === 1 ? 'servidor' : 'servidores'}
        </div>

        <div className={styles.rows}>
          {visiblePeople.map((person) => (
            <article className={styles.row} key={person.id}>
              <div className={styles.avatar}>
                {person.name.split(' ').slice(0, 2).map((part) => part[0]).join('')}
              </div>
              <div>
                <strong>{person.name}</strong>
                <span>{person.email}</span>
              </div>
              {editingId === person.id ? (
                <div className={styles.roleEditor}>
                  <div className={styles.roleEditorSelect}>
                    <ModernSelect ariaLabel={`Rol de ${person.name}`} value={roleId} onChange={setRoleId} options={groupOptions} placeholder="Selecciona un grupo" />
                  </div>
                  <button aria-label="Guardar rol" className={styles.saveRole} disabled={updatingRole} onClick={() => saveRole(person.id)} type="button">
                    <Check size={16} />
                  </button>
                  <button aria-label="Cancelar cambio de rol" className={styles.cancelRole} disabled={updatingRole} onClick={() => setEditingId(null)} type="button">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className={styles.roleActions}>
                  <span className={styles.group}>{person.group.name}</span>
                  <button className={styles.changeRole} onClick={() => startRoleEdit(person)} type="button">
                    <Pencil size={15} /> Cambiar rol
                  </button>
                </div>
              )}
            </article>
          ))}
          {visiblePeople.length === 0 && <p className={styles.empty}>No hay servidores que coincidan con esta búsqueda.</p>}
        </div>
      </section>

      {modalOpen && (
        <Modal title="Agregar servidor" onClose={closeModal}>
          <form className={styles.form} onSubmit={submit}>
            {formErrors.length > 0 && (
              <div className={styles.errors} role="alert">
                {formErrors.map((formError) => <p key={formError}>{formError}</p>)}
              </div>
            )}
            <div className={styles.formTitle}>
              <Users size={18} />
              <span>Datos del servidor</span>
            </div>
            <label className={styles.field}>Nombre
              <input value={form.nombre} onChange={(event) => updateForm('nombre', event.target.value)} required />
            </label>
            <div className={styles.fields}>
              <label className={styles.field}>Primer apellido
                <input value={form.primer_apellido} onChange={(event) => updateForm('primer_apellido', event.target.value)} required />
              </label>
              <label className={styles.field}>Segundo apellido (opcional)
                <input value={form.segundo_apellido} onChange={(event) => updateForm('segundo_apellido', event.target.value)} />
              </label>
            </div>
            <label className={styles.field}>Correo electrónico
              <input type="email" value={form.correo} onChange={(event) => updateForm('correo', event.target.value)} required />
            </label>
            <label className={styles.field}>Grupo
              <ModernSelect ariaLabel="Grupo" value={form.grupo_id} onChange={(value) => updateForm('grupo_id', value)} options={groupOptions} placeholder="Selecciona un grupo" />
            </label>
            <div className={styles.formActions}>
              <button type="button" onClick={closeModal}>Cancelar</button>
              <Button type="submit" disabled={saving || !canSave}>{saving ? 'Guardando…' : 'Guardar servidor'}</Button>
            </div>
          </form>
        </Modal>
      )}
    </PageContainer>
  )
}
