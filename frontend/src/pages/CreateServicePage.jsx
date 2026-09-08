import { useEffect, useState } from 'react'
import { CalendarDays, Save, Users } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Button from '../components/common/Button'
import InfoBanner from '../components/common/InfoBanner'
import PageContainer from '../components/layout/PageContainer'
import PageHeader from '../components/layout/PageHeader'
import FormSection from '../components/layout/FormSection'
import Skeleton from '../components/common/Skeleton'
import { createService, getServiceDetail, getServicesConfig, updateService } from '../services/servicesApi'
import { ModernDateField, ModernSelect, ModernTimeField } from '../components/form/ModernFields'
import { subtractDays } from '../utils/date'
import styles from './CreateServicePage.module.css'

const initialForm = { fecha_servicio: '', hora_servicio: '', tipo: 'Regular', fecha_cierre_confirmacion: '' }

export default function CreateServicePage() {
  const navigate = useNavigate()
  const { serviceId } = useParams()
  const isEditing = Boolean(serviceId)
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(isEditing)
  const [loadError, setLoadError] = useState(null)
  const [errors, setErrors] = useState([])
  const [saving, setSaving] = useState(false)
  const [diasCierre, setDiasCierre] = useState({ Regular: 3, Extraordinario: 1 })
  const [cierreEditadoManualmente, setCierreEditadoManualmente] = useState(false)

  useEffect(() => {
    getServicesConfig()
      .then((cfg) => setDiasCierre({ Regular: cfg.diasCierreRegular, Extraordinario: cfg.diasCierreExtraordinario }))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!isEditing) return
    setCierreEditadoManualmente(true)
    getServiceDetail(serviceId)
      .then(({ service }) => {
        setForm({
          fecha_servicio: service.date.slice(0, 10),
          hora_servicio: service.date.slice(11, 16),
          tipo: service.type,
          fecha_cierre_confirmacion: service.closingDate,
        })
        setLoading(false)
      })
      .catch(() => setLoadError('No pudimos cargar este servicio.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId])

  function calcularCierrePorDefecto(fechaServicio, tipo) {
    if (!fechaServicio) return ''
    return subtractDays(fechaServicio, diasCierre[tipo] ?? 0)
  }

  function update(name, value) {
    setForm((current) => {
      const next = { ...current, [name]: value }

      if (name === 'fecha_cierre_confirmacion') {
        return next
      }

      if (name === 'fecha_servicio' || name === 'tipo') {
        if (!cierreEditadoManualmente) {
          next.fecha_cierre_confirmacion = calcularCierrePorDefecto(next.fecha_servicio, next.tipo)
        } else if (name === 'fecha_servicio' && current.fecha_cierre_confirmacion >= value) {
          next.fecha_cierre_confirmacion = ''
        }
      }

      return next
    })
    if (name === 'fecha_cierre_confirmacion') {
      setCierreEditadoManualmente(true)
    }
    setErrors([])
  }

  const datesAreValid = Boolean(form.fecha_servicio && form.fecha_cierre_confirmacion && form.fecha_cierre_confirmacion < form.fecha_servicio)
  const canSave = Boolean(form.fecha_servicio && form.hora_servicio && form.tipo && datesAreValid)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canSave) {
      setErrors(['Completa todos los campos y selecciona una fecha de cierre anterior al servicio.'])
      return
    }
    setSaving(true)
    setErrors([])
    try {
      const service = isEditing ? await updateService(serviceId, form) : await createService(form)
      navigate(`/services/${service.id}`)
    } catch (error) {
      setErrors(error.message ? [error.message] : ['No fue posible guardar el servicio.'])
    } finally {
      setSaving(false)
    }
  }

  if (isEditing && loadError) return <PageContainer><div className={styles.errors} role="alert"><p>{loadError}</p></div></PageContainer>
  if (isEditing && loading) return <PageContainer><Skeleton /></PageContainer>

  return (
    <PageContainer className={styles.compactPage}>
      <PageHeader
        backTo={isEditing ? `/services/${serviceId}` : '/services'}
        backLabel="Servicios"
        title={isEditing ? 'Editar servicio' : 'Programar un servicio'}
        illustration={<CalendarDays size={96} strokeWidth={1} />}
      />
      <form className={styles.form} onSubmit={handleSubmit}>
        {errors.length > 0 && <div className={styles.errors} role="alert">{errors.map((error) => <p key={error}>{error}</p>)}</div>}

        <div className={styles.card}>
          <FormSection icon={Users} title="Convocatoria">
            <label className={styles.field}>Tipo de servicio
              <ModernSelect ariaLabel="Tipo de servicio" onChange={(value) => update('tipo', value)} options={[{ value: 'Regular', label: 'Regular' }, { value: 'Extraordinario', label: 'Extraordinario' }]} placeholder="Selecciona un tipo" value={form.tipo} />
            </label>
          </FormSection>

          <FormSection icon={CalendarDays} title="Fecha y hora">
            <div className={styles.fields}>
              <label className={styles.field}>Fecha del servicio<ModernDateField ariaLabel="Fecha del servicio" onChange={(value) => update('fecha_servicio', value)} value={form.fecha_servicio} /></label>
              <label className={styles.field}>Hora del servicio<ModernTimeField onChange={(value) => update('hora_servicio', value)} value={form.hora_servicio} /></label>
            </div>
            <label className={styles.field}>Fecha de cierre de confirmación<ModernDateField ariaLabel="Fecha de cierre de confirmación" disabled={!form.fecha_servicio} isDateDisabled={(date) => date.toISOString().slice(0, 10) >= form.fecha_servicio} onChange={(value) => update('fecha_cierre_confirmacion', value)} value={form.fecha_cierre_confirmacion} /></label>
            <InfoBanner>Se sugiere automáticamente según el tipo de servicio, pero puedes cambiarla. Debe ser anterior al día del servicio.</InfoBanner>
          </FormSection>

          <div className={styles.actions}>
            <Link to={isEditing ? `/services/${serviceId}` : '/services'} className={styles.cancel}>Cancelar</Link>
            <Button type="submit" disabled={saving || !canSave}><Save size={18} />{saving ? 'Guardando…' : 'Guardar servicio'}</Button>
          </div>
        </div>
      </form>
    </PageContainer>
  )
}
