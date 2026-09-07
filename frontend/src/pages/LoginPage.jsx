import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff, AlertCircle, Church, ArrowRight } from 'lucide-react'
import Button from '../components/common/Button'
import { ApiError } from '../services/apiClient'
import styles from './LoginPage.module.css'

export default function LoginPage({ onLogin }) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!password.trim()) {
      setError('Por favor ingrese la contraseña de acceso.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await onLogin(password)
      navigate('/services')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión. Verifique su contraseña.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.ambientGlow} aria-hidden="true" />
      
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.iconMedallion}>
            <Church className={styles.churchIcon} size={28} strokeWidth={1.75} />
          </div>
          <h1 className={styles.title}>Confirmación de Asistencia</h1>
          <p className={styles.subtitle}>Panel de Coordinación Ministerial</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="password">
              Contraseña de acceso
            </label>
            <div className={styles.inputWrapper}>
              <Lock className={styles.inputIcon} size={18} />
              <input
                id="password"
                className={styles.input}
                type={showPassword ? 'text' : 'password'}
                placeholder="Ingrese su contraseña"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (error) setError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSubmit(e)
                  }
                }}
                disabled={submitting}
                autoFocus
                autoComplete="current-password"
              />
              <button
                type="button"
                className={styles.toggleVisibility}
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className={styles.errorAlert} role="alert">
              <AlertCircle size={16} className={styles.errorIcon} />
              <span>{error}</span>
            </div>
          )}

          <div className={styles.actions}>
            <Button
              type="submit"
              disabled={submitting || !password.trim()}
              className={styles.submitButton}
            >
              <span>{submitting ? 'Iniciando sesión...' : 'Ingresar al sistema'}</span>
              {!submitting && <ArrowRight size={18} className={styles.buttonArrow} />}
            </Button>
          </div>
        </form>

        <div className={styles.footer}>
          <p className={styles.footerNote}>
            PAS Attendance &bull; Acceso seguro para coordinadores
          </p>
        </div>
      </div>
    </div>
  )
}
