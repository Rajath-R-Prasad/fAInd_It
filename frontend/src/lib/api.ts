export const API_BASE = (
  import.meta.env['VITE_API_BASE_URL'] || 'http://localhost:8000'
).replace(/\/$/, '')

export function imageUrl(path?: string | null) {
  if (!path) return null
  if (/^https?:\/\//.test(path)) return path
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
}

export function authHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {}
}
