import { apiRequest } from './apiClient'

export function getSession() {
  return apiRequest('/api/session')
}

export function login(password) {
  return apiRequest('/api/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
}

export function logout() {
  return apiRequest('/api/logout', { method: 'POST' })
}
