import { describe, expect, it } from 'vitest'
import { ApiError, parseJsonOrThrow } from './api-client'

describe('parseJsonOrThrow', () => {
  it('returns null for empty text', () => {
    expect(parseJsonOrThrow('', 200)).toBeNull()
  })

  it('parses valid JSON', () => {
    expect(parseJsonOrThrow('{"a":1}', 200)).toEqual({ a: 1 })
    expect(parseJsonOrThrow('[1,2,3]', 200)).toEqual([1, 2, 3])
  })

  it('throws ApiError (not SyntaxError) when server returns HTML', () => {
    const html = '<!DOCTYPE html><html><body>500 Server Error</body></html>'
    let caught: unknown = null
    try { parseJsonOrThrow(html, 500) } catch (e) { caught = e }
    expect(caught).toBeInstanceOf(ApiError)
    expect((caught as ApiError).status).toBe(500)
    expect((caught as ApiError).message).toContain('HTTP 500')
    expect((caught as ApiError).message).toContain('<!DOCTYPE')
  })

  it('preserves the original http status in the error', () => {
    let caught: unknown = null
    try { parseJsonOrThrow('<html>login</html>', 401) } catch (e) { caught = e }
    expect((caught as ApiError).status).toBe(401)
  })
})
