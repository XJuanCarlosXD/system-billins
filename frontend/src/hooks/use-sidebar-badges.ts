import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useCompany } from '@/context/company-context'
import { listReportes } from '@/lib/api-client-reportes'
import {
  DOC_MODULES,
  NOVEDADES_TOTAL,
  fetchDocCounts,
  seenStore,
  type BadgeVariant,
  type DocModule,
} from '@/lib/sidebar-badges'

export type SidebarBadge = { count: number; variant: BadgeVariant }
export type BadgeKey = 'novedades' | 'reportes' | DocModule

/**
 * Calcula los badges del sidebar (contadores de "nuevo desde la última
 * visita") y expone markSeen(key) para limpiarlos al entrar a la vista.
 */
export function useSidebarBadges() {
  const { selectedCompany, selectedPoint } = useCompany()
  // Se incrementa para forzar el recálculo tras leer/escribir localStorage.
  const [seenVersion, setSeenVersion] = useState(0)

  const docsQ = useQuery({
    queryKey: ['sidebar-badges', 'docs', selectedCompany, selectedPoint],
    queryFn: () => fetchDocCounts(selectedCompany, selectedPoint),
    enabled: !!selectedCompany,
    staleTime: 60_000,
    refetchInterval: 120_000,
  })

  const reportesQ = useQuery({
    queryKey: ['sidebar-badges', 'reportes'],
    queryFn: () => listReportes({}),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })

  // Baseline: la primera vez que conocemos un total lo marcamos como "visto"
  // (sincroniza localStorage) para no mostrar todo el histórico como nuevo —
  // solo el crecimiento futuro. No hace falta re-render: el memo recomputa
  // cuando lleguen nuevos totales y ya lee este baseline.
  useEffect(() => {
    if (seenStore.novedadesSeen() == null) {
      seenStore.setNovedadesSeen(NOVEDADES_TOTAL)
    }
    if (docsQ.data && selectedCompany) {
      for (const code of DOC_MODULES) {
        const total = docsQ.data[code]
        if (
          total != null &&
          seenStore.docSeenTotal(selectedCompany, code) == null
        ) {
          seenStore.setDocSeenTotal(selectedCompany, code, total)
        }
      }
    }
  }, [docsQ.data, selectedCompany])

  const badges = useMemo(() => {
    void seenVersion // dependencia explícita para recomputar tras markSeen
    const out: Partial<Record<BadgeKey, SidebarBadge>> = {}

    // Novedades — azul (default)
    const nSeen = seenStore.novedadesSeen() ?? NOVEDADES_TOTAL
    const nNew = Math.max(0, NOVEDADES_TOTAL - nSeen)
    if (nNew > 0) out.novedades = { count: nNew, variant: 'default' }

    // Reportes de problemas — ámbar si hay abiertos, verde si recién completados
    const items = reportesQ.data?.items ?? []
    const open = items.filter(
      (r) => r.estado === 'ABIERTO' || r.estado === 'EN_PROGRESO'
    ).length
    const done = items.filter((r) => r.estado === 'COMPLETADO').length
    if (open > 0) {
      out.reportes = { count: open, variant: 'warning' }
    } else {
      const dSeen = seenStore.reportesDoneSeen() ?? done
      const dNew = Math.max(0, done - dSeen)
      if (dNew > 0) out.reportes = { count: dNew, variant: 'success' }
    }

    // Documentos por módulo — azul (default)
    if (docsQ.data && selectedCompany) {
      for (const code of DOC_MODULES) {
        const total = docsQ.data[code]
        if (total == null) continue
        const seen = seenStore.docSeenTotal(selectedCompany, code)
        const delta = seen == null ? 0 : Math.max(0, total - seen)
        if (delta > 0) out[code] = { count: delta, variant: 'default' }
      }
    }

    return out
  }, [seenVersion, reportesQ.data, docsQ.data, selectedCompany])

  const markSeen = useCallback(
    (key: BadgeKey) => {
      if (key === 'novedades') {
        // Cuántas novedades nuevas había al entrar (para resaltarlas).
        const old = seenStore.novedadesSeen() ?? NOVEDADES_TOTAL
        seenStore.setNovedadesHighlight(Math.max(0, NOVEDADES_TOTAL - old))
        seenStore.setNovedadesSeen(NOVEDADES_TOTAL)
      } else if (key === 'reportes') {
        const done = (reportesQ.data?.items ?? []).filter(
          (r) => r.estado === 'COMPLETADO'
        ).length
        seenStore.setReportesDoneSeen(done)
      } else if (selectedCompany && docsQ.data) {
        const total = docsQ.data[key as DocModule]
        if (total != null) {
          // Documentos nuevos al entrar (para resaltar las primeras N filas).
          const old = seenStore.docSeenTotal(selectedCompany, key)
          seenStore.setDocHighlight(
            selectedCompany,
            key,
            old == null ? 0 : Math.max(0, total - old)
          )
          seenStore.setDocSeenTotal(selectedCompany, key, total)
        }
      }
      setSeenVersion((v) => v + 1)
    },
    [reportesQ.data, docsQ.data, selectedCompany]
  )

  return { badges, markSeen }
}

/**
 * Cantidad de documentos nuevos a resaltar en una consulta. Se captura una
 * sola vez al montar (después de que el sidebar marca "visto" al entrar), así
 * las primeras N filas (orden más reciente primero) se pueden resaltar.
 */
export function useDocHighlightCount(code: DocModule): number {
  const { selectedCompany } = useCompany()
  const [n, setN] = useState<number | null>(null)
  // Se lee en un effect (no en el render) a propósito: el valor lo escribe el
  // sidebar (markSeen) al entrar a la vista, cuyo effect corre antes que este.
  useEffect(() => {
    if (n === null && selectedCompany) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setN(seenStore.docHighlight(selectedCompany, code))
    }
  }, [n, selectedCompany, code])
  return n ?? 0
}

/** Cantidad de novedades nuevas a resaltar (capturada una vez al montar). */
export function useNovedadesHighlightCount(): number {
  const [n, setN] = useState<number | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (n === null) setN(seenStore.novedadesHighlight())
  }, [n])
  return n ?? 0
}
