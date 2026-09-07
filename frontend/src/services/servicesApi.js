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
