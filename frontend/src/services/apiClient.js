/**
 * Cliente centralizado para hablar con la API de Flask. Usa cookies de
 * sesión (credentials: "include") — la misma sesión que usan las rutas
 * Jinja que aún existen (/confirm/*). No hay tokens en localStorage.
 */
export class ApiError extends Error {
  constructor(message, status, body) {
    super(message)
    this.status = status
    this.body = body
  }
}

export async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  const isJson = response.headers.get('content-type')?.includes('application/json')
  const body = isJson ? await response.json().catch(() => null) : null

  if (!response.ok) {
    const message = body?.error || `Error ${response.status} al llamar ${path}`
    throw new ApiError(message, response.status, body)
  }

  return body
}
