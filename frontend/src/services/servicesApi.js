import { apiRequest } from './apiClient'

export async function getServices() {
  const body = await apiRequest('/api/services')
  return body.data
}

export async function getGroups() {
  const body = await apiRequest('/api/groups')
  return body.data
}

export async function getServicesConfig() {
  const body = await apiRequest('/api/services/config')
  return body.data
}

export async function createService(data) {
  const body = await apiRequest('/api/services', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return body.data
}

export async function getServiceDetail(id) {
  const body = await apiRequest(`/api/services/${id}`)
  return body.data
}

export async function getServiceSubmissions(id) {
  const body = await apiRequest(`/api/services/${id}/submissions`)
  return body.data
}

export async function getParticipants() {
  const body = await apiRequest('/api/participants')
  return body.data
}

export async function createParticipant(data) {
  const body = await apiRequest('/api/participants', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return body.data
}

export async function updateParticipantRole(id, grupoId) {
  const body = await apiRequest(`/api/participants/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ grupo_id: grupoId }),
  })
  return body.data
}

export async function updateParticipantEmail(id, correo) {
  const body = await apiRequest(`/api/participants/${id}/email`, {
    method: 'PATCH',
    body: JSON.stringify({ correo }),
  })
  return body.data
}

export async function updateParticipantStatus(id, activo, comentario) {
  const body = await apiRequest(`/api/participants/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ activo, comentario }),
  })
  return body.data
}
