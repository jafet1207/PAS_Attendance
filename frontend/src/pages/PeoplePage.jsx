import { useEffect, useMemo, useState } from 'react'
import { Check, Crown, Filter, Mail, Pencil, Plus, Search, Star, User, UserCheck, UserPlus, UserX, Users, X } from 'lucide-react'
import Badge from '../components/common/Badge'
import Button from '../components/common/Button'
import ErrorState from '../components/common/ErrorState'
import Modal from '../components/common/Modal'
import Pagination from '../components/common/Pagination'
import RowActionsMenu from '../components/common/RowActionsMenu'
import PageContainer from '../components/layout/PageContainer'
import PageHeader from '../components/layout/PageHeader'
import Skeleton from '../components/common/Skeleton'
import { ModernSelect } from '../components/form/ModernFields'
import { usePagination } from '../hooks/usePagination'
import {
  createParticipant,
  getGroups,
  getParticipants,
  updateParticipantEmail,
  updateParticipantRole,
  updateParticipantStatus,
} from '../services/servicesApi'
import styles from './PeoplePage.module.css'

const emptyForm = { nombre: '', primer_apellido: '', segundo_apellido: '', correo: '', grupo_id: '' }

// Mínimo 2 caracteres y no compuesto solo por dígitos (evita valores como "1" o "42").
const esTextoValido = (valor) => valor.trim().length >= 2 && !/^\d+$/.test(valor.trim())
const esCorreoValido = (valor) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim())

// Tono visual del badge de rol: puramente decorativo, asigna un color estable según el nombre
// del grupo (no representa ninguna regla de negocio).
const ROLE_TONES = ['info', 'violet', 'warning', 'neutral']
function roleTone(name) {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 997
  return ROLE_TONES[hash % ROLE_TONES.length]
}

// Icono decorativo por rol para el selector de "Cambiar rol" (no representa ninguna regla de
// negocio). Cubre los 4 grupos reales del sistema (config/env.ts::GRUPOS_BASE); cualquier grupo
// nuevo que no esté en el mapa cae al ícono genérico.
const ROLE_ICONS = { Servidor: User, Inducción: UserPlus, Líder: Star, Director: Crown }
function roleIcon(name) {
  return ROLE_ICONS[name] ?? Users
}

// Mismo umbral que RowActionsMenu (MOBILE_BREAKPOINT): por debajo de este ancho, "Cambiar rol"
// se abre en un modal en vez de editar inline la fila, que quedaría demasiado angosta para
// selector + Estado + Guardar/Cancelar en una sola línea.
const MOBILE_BREAKPOINT = 767

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
  const [roleEditIsModal, setRoleEditIsModal] = useState(false)
  const [updatingRole, setUpdatingRole] = useState(false)
  const [emailEditingId, setEmailEditingId] = useState(null)
  const [emailValue, setEmailValue] = useState('')
  const [updatingEmail, setUpdatingEmail] = useState(false)
  const [statusUpdatingId, setStatusUpdatingId] = useState(null)
  const [commentPromptId, setCommentPromptId] = useState(null)
  const [commentText, setCommentText] = useState('')

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
      (people ?? [])
        .filter((person) => {
          const matchesText = `${person.name} ${person.email}`.toLowerCase().includes(query.trim().toLowerCase())
          const matchesGroup = !groupFilter || person.group.id === Number(groupFilter)
          return matchesText && matchesGroup
        })
        // Primero por estado (activos antes que inactivos), luego por nombre.
        .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'es')),
    [people, query, groupFilter]
  )

  const { page, setPage, pageSize, setPageSize, pageItems, totalPages, totalItems } =
    usePagination(visiblePeople, 10)

  useEffect(() => {
    setPage(1)
  }, [query, groupFilter, setPage])

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
    esTextoValido(form.nombre) &&
    esTextoValido(form.primer_apellido) &&
    (!form.segundo_apellido.trim() || esTextoValido(form.segundo_apellido)) &&
    esCorreoValido(form.correo) &&
    form.grupo_id
  )

  function validar() {
    const errores = []
    if (!esTextoValido(form.nombre)) errores.push('El nombre debe tener al menos 2 caracteres y no puede ser solo números.')
    if (!esTextoValido(form.primer_apellido)) errores.push('El primer apellido debe tener al menos 2 caracteres y no puede ser solo números.')
    if (form.segundo_apellido.trim() && !esTextoValido(form.segundo_apellido)) errores.push('El segundo apellido debe tener al menos 2 caracteres y no puede ser solo números.')
    if (!esCorreoValido(form.correo)) errores.push('Ingresa un correo electrónico válido.')
    if (!form.grupo_id) errores.push('Selecciona un grupo.')
    return errores
  }

  async function submit(event) {
    event.preventDefault()
    const errores = validar()
    if (errores.length > 0) {
      setFormErrors(errores)
      return
    }
    setSaving(true)
    setFormErrors([])
    try {
      const participant = await createParticipant(form)
      setPeople((current) =>
        [...current, { ...participant, active: true }].sort((a, b) => a.name.localeCompare(b.name, 'es'))
      )
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
    setRoleEditIsModal(window.innerWidth <= MOBILE_BREAKPOINT)
    setError(null)
  }

  function cancelRoleEdit() {
    setEditingId(null)
    setRoleEditIsModal(false)
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
      setRoleEditIsModal(false)
    } catch (requestError) {
      setError(requestError.message || 'No fue posible cambiar el rol.')
    } finally {
      setUpdatingRole(false)
    }
  }

  function startEmailEdit(person) {
    setEmailEditingId(person.id)
    setEmailValue(person.email)
    setError(null)
  }

  async function saveEmail(personId) {
    setUpdatingEmail(true)
    setError(null)
    try {
      const updated = await updateParticipantEmail(personId, emailValue)
      setPeople((current) =>
        current.map((person) => (person.id === personId ? { ...person, email: updated.email } : person))
      )
      setEmailEditingId(null)
    } catch (requestError) {
      setError(requestError.message || 'No fue posible actualizar el correo.')
    } finally {
      setUpdatingEmail(false)
    }
  }

  async function changeStatus(person, activo, comentario) {
    setStatusUpdatingId(person.id)
    setError(null)
    try {
      const updated = await updateParticipantStatus(person.id, activo, comentario)
      setPeople((current) =>
        current.map((p) => (p.id === person.id ? { ...p, active: updated.active } : p))
      )
      setCommentPromptId(null)
      setCommentText('')
    } catch (requestError) {
      if (!activo && requestError.body?.requiresComment) {
        setCommentPromptId(person.id)
      } else {
        setError(requestError.message || 'No fue posible actualizar el estado del servidor.')
      }
    } finally {
      setStatusUpdatingId(null)
    }
  }

  function confirmDeactivateWithComment(person) {
    if (!commentText.trim()) return
    changeStatus(person, false, commentText.trim())
  }

  function cancelCommentPrompt() {
    setCommentPromptId(null)
    setCommentText('')
  }

  if (error && people === null) return <PageContainer><ErrorState message={error} onRetry={load} /></PageContainer>
  if (people === null || groups === null) return <PageContainer><Skeleton /></PageContainer>

  const groupOptions = groups.map((g) => ({ value: g.id, label: g.name }))
  // Opciones con ícono exclusivas del selector de "Cambiar rol" (no se reutiliza groupOptions
  // para no afectar el filtro de arriba ni el formulario de "Agregar servidor").
  const roleEditOptions = groups.map((g) => {
    const Icon = roleIcon(g.name)
    return { value: g.id, label: <><Icon size={14} /> {g.name}</> }
  })
  const grupoServidorId = groups.find((g) => g.name === 'Servidor')?.id ?? ''
  const roleModalPerson = roleEditIsModal ? people.find((p) => p.id === editingId) ?? null : null

  function openModal() {
    setForm({ ...emptyForm, grupo_id: grupoServidorId ? String(grupoServidorId) : '' })
    setModalOpen(true)
  }

  return (
    <PageContainer>
      <PageHeader
        title="Servidores"
        actions={(
          <Button size="sm" onClick={openModal}>
            <Plus size={16} />
            Agregar servidor
          </Button>
        )}
      />

      {error && <div className={styles.inlineError} role="alert">{error}</div>}

      <div className={styles.controls}>
        <label className={styles.search}>
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre o correo" />
        </label>
        <div className={styles.filterSelect}>
          <Filter aria-hidden="true" className={styles.filterIcon} size={16} />
          <ModernSelect
            ariaLabel="Filtrar por grupo"
            value={groupFilter}
            onChange={setGroupFilter}
            placeholder="Todos los grupos"
            options={[{ value: '', label: 'Todos los grupos' }, ...groupOptions]}
          />
        </div>
      </div>

      <section className={styles.list}>
        <div className={styles.rowsHeader}>
          <span>Servidor</span>
          <span>Grupo</span>
          <span>Estado</span>
          <span />
        </div>

        <div className={styles.rows}>
          {pageItems.map((person) => (
            <article
              className={`${styles.row} ${!person.active ? styles.rowInactive : ''} ${
                editingId === person.id && !roleEditIsModal ? styles.rowEditingRole : ''
              }`}
              key={person.id}
            >
              <div className={styles.identityCell}>
                <div className={styles.avatar}>
                  {person.name.split(' ').slice(0, 2).map((part) => part[0]).join('')}
                </div>
                <div className={styles.identityText}>
                  <strong className={styles.name} title={person.name}>{person.name}</strong>
                  {emailEditingId === person.id ? (
                    <div className={styles.emailEditor}>
                      <input
                        type="email"
                        value={emailValue}
                        onChange={(event) => setEmailValue(event.target.value)}
                        autoFocus
                      />
                      <button aria-label="Guardar correo" className={styles.saveRole} disabled={updatingEmail} onClick={() => saveEmail(person.id)} type="button">
                        <Check size={16} />
                      </button>
                      <button aria-label="Cancelar edición de correo" className={styles.cancelRole} disabled={updatingEmail} onClick={() => setEmailEditingId(null)} type="button">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <span className={styles.email} title={person.email}>{person.email}</span>
                  )}
                </div>
              </div>

              <div className={styles.rolCell}>
                {editingId === person.id && !roleEditIsModal ? (
                  <div className={styles.roleSelectWrap}>
                    <ModernSelect ariaLabel={`Rol de ${person.name}`} value={roleId} onChange={setRoleId} options={roleEditOptions} placeholder="Selecciona un grupo" />
                  </div>
                ) : (
                  <Badge dot={false} tone={roleTone(person.group.name)}>{person.group.name}</Badge>
                )}
              </div>

              <div className={styles.estadoCell}>
                <Badge tone={person.active ? 'success' : 'danger'}>{person.active ? 'Activo' : 'Inactivo'}</Badge>
              </div>

              <div className={styles.actionsCell}>
                {editingId === person.id && !roleEditIsModal ? (
                  <div className={styles.roleEditActions}>
                    <button aria-label={`Guardar rol de ${person.name}`} className={styles.roleSaveButton} disabled={updatingRole} onClick={() => saveRole(person.id)} type="button">
                      <Check size={14} />
                      {updatingRole ? 'Guardando…' : 'Guardar'}
                    </button>
                    <button aria-label={`Cancelar cambio de rol de ${person.name}`} className={styles.roleCancelButton} disabled={updatingRole} onClick={cancelRoleEdit} type="button">
                      <X size={14} />
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <>
                    <div className={styles.inlineActions}>
                      <button aria-label={`Cambiar rol de ${person.name}`} className={`${styles.inlineActionButton} ${styles.inlineActionInfo}`} onClick={() => startRoleEdit(person)} type="button">
                        <Pencil size={16} />
                      </button>
                      <button aria-label={`Editar correo de ${person.name}`} className={`${styles.inlineActionButton} ${styles.inlineActionViolet}`} onClick={() => startEmailEdit(person)} type="button">
                        <Mail size={16} />
                      </button>
                      <button
                        aria-label={`${person.active ? 'Desactivar' : 'Reactivar'} a ${person.name}`}
                        className={`${styles.inlineActionButton} ${person.active ? styles.inlineActionDanger : styles.inlineActionSuccess}`}
                        disabled={statusUpdatingId === person.id}
                        onClick={() => changeStatus(person, !person.active, null)}
                        type="button"
                      >
                        {person.active ? <UserX size={16} /> : <UserCheck size={16} />}
                      </button>
                    </div>
                    <div className={styles.menuActions}>
                      <RowActionsMenu
                        ariaLabel={`Acciones para ${person.name}`}
                        title={person.name}
                        subtitle={person.email}
                        items={[
                          { key: 'rol', label: 'Cambiar rol', icon: Pencil, onClick: () => startRoleEdit(person) },
                          { key: 'correo', label: 'Editar correo', icon: Mail, onClick: () => startEmailEdit(person) },
                          {
                            key: 'estado',
                            label: person.active ? 'Desactivar' : 'Reactivar',
                            icon: person.active ? UserX : UserCheck,
                            tone: person.active ? 'danger' : undefined,
                            disabled: statusUpdatingId === person.id,
                            onClick: () => changeStatus(person, !person.active, null),
                          },
                        ]}
                      />
                    </div>
                  </>
                )}
              </div>

              {commentPromptId === person.id && (
                <div className={styles.commentPrompt}>
                  <p>
                    Este servidor confirmó asistencia a un servicio próximo. Justifica por qué lo desactivas:
                  </p>
                  <textarea
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    placeholder="Motivo de la desactivación"
                    autoFocus
                  />
                  <div className={styles.commentActions}>
                    <button className={styles.commentCancel} type="button" onClick={cancelCommentPrompt}>Cancelar</button>
                    <Button
                      type="button"
                      disabled={statusUpdatingId === person.id || !commentText.trim()}
                      onClick={() => confirmDeactivateWithComment(person)}
                    >
                      Confirmar desactivación
                    </Button>
                  </div>
                </div>
              )}
            </article>
          ))}
          {totalItems === 0 && <p className={styles.empty}>No hay servidores que coincidan con esta búsqueda.</p>}
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
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

      {roleModalPerson && (
        <Modal title="Cambiar rol" onClose={cancelRoleEdit}>
          <div className={styles.roleModalBody}>
            <div className={styles.roleModalIdentity}>
              <strong>{roleModalPerson.name}</strong>
              <span>{roleModalPerson.email}</span>
            </div>
            <label className={styles.field}>Rol
              <ModernSelect
                ariaLabel={`Rol de ${roleModalPerson.name}`}
                value={roleId}
                onChange={setRoleId}
                options={roleEditOptions}
                placeholder="Selecciona un grupo"
              />
            </label>
            {error && <div className={styles.errors} role="alert"><p>{error}</p></div>}
            <div className={styles.formActions}>
              <button type="button" onClick={cancelRoleEdit} disabled={updatingRole}>Cancelar</button>
              <Button type="button" disabled={updatingRole} onClick={() => saveRole(roleModalPerson.id)}>
                {updatingRole ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </PageContainer>
  )
}
