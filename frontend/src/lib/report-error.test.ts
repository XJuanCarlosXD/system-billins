import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { logErrorAutomatico } from './report-error'

const fetchMock = vi.hoisted(() => vi.fn())

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ error_id: 1 }) })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('logErrorAutomatico - filtro de errores de red transitorios', () => {
  it.each([
    'Failed to fetch',
    'Load failed',
    'NetworkError when attempting to fetch resource.',
    'Network Error', // mensaje real de axios cuando no hay respuesta (CORS, backend caido, sin conexion)
    'Network request failed',
    'timeout of 5000ms exceeded', // axios timeout
    'ERR_NETWORK',
  ])('no crea ticket para "%s" sin status http', async (mensaje) => {
    await logErrorAutomatico(mensaje)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([502, 503, 504])(
    'no crea ticket para errores de gateway/backend caido (status %d)',
    async (statusHttp) => {
      await logErrorAutomatico('Bad gateway', { statusHttp })
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )

  it('si crea ticket para un error real con status http (no es de red)', async () => {
    await logErrorAutomatico('forbidden', { statusHttp: 403 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('si crea ticket para un crash de aplicacion sin status http', async () => {
    await logErrorAutomatico('Cannot read properties of undefined')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
