import { useEffect, useState } from 'react'
import { Bell, Save, Settings as SettingsIcon } from 'lucide-react'
import Button from '../components/common/Button'
import InfoBanner from '../components/common/InfoBanner'
import PageContainer from '../components/layout/PageContainer'
import PageHeader from '../components/layout/PageHeader'
import FormSection from '../components/layout/FormSection'
import Skeleton from '../components/common/Skeleton'
import ErrorState from '../components/common/ErrorState'
import { ModernSelect } from '../components/form/ModernFields'
import { getReminderSettings, updateReminderSettings } from '../services/servicesApi'
import styles from './SettingsPage.module.css'

const HORAS = Array.from({ length: 24 }, (_, hora) => {
  const periodo = hora < 12 ? 'AM' : 'PM'
  const hora12 = hora % 12 || 12
  return { value: hora, label: `${hora12}:00 ${periodo}` }
})

export default function SettingsPage() {
  const [horaEnvioUtc6, setHoraEnvioUtc6] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function load() {
    setError(null)
    getReminderSettings()
      .then((data) => setHoraEnvioUtc6(data.horaEnvioUtc6))
      .catch(() => setError('No pudimos cargar los ajustes.'))
  }
  useEffect(() => {
    load()
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const data = await updateReminderSettings(horaEnvioUtc6)
      setHoraEnvioUtc6(data.horaEnvioUtc6)
      setSaved(true)
    } catch (requestError) {
      setError(requestError.message || 'No fue posible guardar la hora de envío.')
    } finally {
      setSaving(false)
    }
  }

  if (error && horaEnvioUtc6 === null) return <PageContainer><ErrorState message={error} onRetry={load} /></PageContainer>
  if (horaEnvioUtc6 === null) return <PageContainer><Skeleton /></PageContainer>

  return (
    <PageContainer className={styles.compactPage}>
      <PageHeader title="Ajustes" illustration={<SettingsIcon size={96} strokeWidth={1} />} />
      <form className={styles.form} onSubmit={handleSubmit}>
        {error && <div className={styles.errors} role="alert"><p>{error}</p></div>}

        <div className={styles.card}>
          <FormSection icon={Bell} title="Recordatorios automáticos">
            <label className={styles.field}>
              <span>Hora de envío (hora de Costa Rica, <span className={styles.nowrap}>UTC-6)</span></span>
              <ModernSelect
                ariaLabel="Hora de envío de recordatorios"
                onChange={(value) => { setHoraEnvioUtc6(Number(value)); setSaved(false) }}
                options={HORAS}
                value={horaEnvioUtc6}
              />
            </label>
            <InfoBanner>
              El envío automático corre una vez al día y revisa si ya es esta hora. Se respeta
              el máximo de 3 recordatorios por servidor, sin repetir el mismo día.
            </InfoBanner>
          </FormSection>

          <div className={styles.actions}>
            {saved && <span className={styles.saved}>Guardado</span>}
            <Button type="submit" disabled={saving}><Save size={18} />{saving ? 'Guardando…' : 'Guardar cambios'}</Button>
          </div>
        </div>
      </form>
    </PageContainer>
  )
}
