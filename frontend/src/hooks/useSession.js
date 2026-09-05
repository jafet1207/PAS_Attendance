import { useCallback, useEffect, useState } from 'react'
import { getSession, login as loginRequest, logout as logoutRequest } from '../services/sessionApi'

export function useSession() {
  const [status, setStatus] = useState('loading') // loading | authenticated | anonymous
  const [role, setRole] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const data = await getSession()
      setStatus(data.authenticated ? 'authenticated' : 'anonymous')
      setRole(data.role)
    } catch {
      setStatus('anonymous')
      setRole(null)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = useCallback(async (password) => {
    const data = await loginRequest(password)
    setStatus('authenticated')
    setRole(data.role)
  }, [])

  const logout = useCallback(async () => {
    await logoutRequest()
    setStatus('anonymous')
    setRole(null)
  }, [])

  return { status, role, login, logout, refresh }
}
