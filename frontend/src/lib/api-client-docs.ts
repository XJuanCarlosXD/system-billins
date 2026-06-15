// Endpoints de docs (separado de api-client.ts para no inflarlo).
import { ApiError } from './api-client'

export { ApiError }

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' })
  const text = await res.text()
  const body = text ? JSON.parse(text) : null
  if (!res.ok) throw new ApiError(res.status, body)
  return body as T
}

export type DocItem = {
  slug: string
  filename: string
  title: string
  size: number
  matches?: { line: number; snippet: string }[]
}

export type DocFull = DocItem & { content: string }

export const apiClient = {
  docsList: (q = '') =>
    request<{ count: number; q: string; items: DocItem[] }>(`/docs/?q=${encodeURIComponent(q)}`),
  docsGet: (slug: string) =>
    request<DocFull>(`/docs/${encodeURIComponent(slug)}/`),
}
