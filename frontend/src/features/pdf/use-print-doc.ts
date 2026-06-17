import { useEffect, useMemo, useState } from 'react'
import { fetchPrintData, getPlantilla } from './api'
import { getRegistryEntry } from './registry'
import type { PrintPayload, Plantilla } from './types'

type PrintTemplateBlock = {
  type?: string
  props?: Record<string, unknown>
}

type PrintTemplateData = {
  content?: PrintTemplateBlock[]
  root?: { props?: Record<string, unknown> }
  zones?: Record<string, unknown>
}

export type UsePrintDocResult = {
  loading: boolean
  error?: string
  data?: PrintPayload
  template?: PrintTemplateData
  plantilla?: Plantilla
}

function hasTemplateBlock(
  template: PrintTemplateData | undefined,
  type: string
) {
  return !!template?.content?.some((block) => block.type === type)
}

function normalizeTemplate(
  codigo: string,
  template: PrintTemplateData | undefined,
  fallback: PrintTemplateData
) {
  if (
    codigo === 'cuadre-caja' &&
    !hasTemplateBlock(template, 'BloqueCuadreCaja')
  ) {
    return fallback
  }
  return template ?? fallback
}

/**
 * Hook usado por la página /print/<codigo>/<id>.
 * Hace dos fetches: print-data + plantilla (con fallback al default del registry).
 */
export function usePrintDoc(
  codigo: string,
  id: string,
  no_cia: string,
  punto: string,
  extra?: Record<string, string>
): UsePrintDocResult {
  const entry = getRegistryEntry(codigo)
  const extraKey = JSON.stringify(extra || {})
  const qs = useMemo(() => {
    const u = new URLSearchParams()
    u.set('no_cia', no_cia)
    u.set('punto', punto)
    if (extra) for (const [k, v] of Object.entries(extra)) if (v) u.set(k, v)
    return u
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [no_cia, punto, extraKey])

  const [data, setData] = useState<PrintPayload | undefined>()
  const [plantilla, setPlantilla] = useState<Plantilla | undefined>()
  const [error, setError] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let canceled = false
    queueMicrotask(() => {
      if (canceled) return
      if (!entry) {
        setError(`código '${codigo}' no registrado`)
        setLoading(false)
        return
      }
      setLoading(true)
      setError(undefined)
      Promise.all([
        fetchPrintData(entry.printDataPath(id, qs)),
        getPlantilla(no_cia, codigo).catch(() => undefined),
      ])
        .then(([pd, pl]) => {
          if (canceled) return
          setData(pd)
          setPlantilla(pl)
          setLoading(false)
        })
        .catch((err) => {
          if (canceled) return
          setError((err as Error).message)
          setLoading(false)
        })
    })
    return () => {
      canceled = true
    }
  }, [codigo, id, no_cia, punto, qs, entry])

  const template = useMemo<PrintTemplateData | undefined>(() => {
    if (!entry) return undefined
    const fallback = entry.defaultTemplate as PrintTemplateData
    if (plantilla?.definicion_json) {
      try {
        return normalizeTemplate(
          codigo,
          JSON.parse(plantilla.definicion_json) as PrintTemplateData,
          fallback
        )
      } catch {
        return fallback
      }
    }
    return fallback
  }, [codigo, entry, plantilla])

  return { loading, error, data, template, plantilla }
}

/**
 * Helper que las pantallas FAT llaman al hacer click en "Imprimir".
 * Abre la ventana /print/<codigo>/<id> que se auto-imprime al cargar.
 */
export function openPrintWindow(
  codigo: string,
  id: string,
  opts?: { no_cia?: string; punto?: string }
) {
  const qs = new URLSearchParams()
  if (opts?.no_cia) qs.set('no_cia', opts.no_cia)
  if (opts?.punto) qs.set('punto', opts.punto)
  const url = `/print/${encodeURIComponent(codigo)}/${encodeURIComponent(id)}${qs.toString() ? `?${qs.toString()}` : ''}`
  window.open(url, '_blank', 'noopener')
}
