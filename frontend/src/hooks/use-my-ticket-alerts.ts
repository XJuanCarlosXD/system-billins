import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listReportes, type ReporteResumen } from '@/lib/api-client-reportes'
import {
  acknowledge,
  dismissThisSession,
  hasBaseline,
  isAcknowledged,
  isDismissedThisSession,
  setBaselined,
} from '@/lib/ticket-alerts-store'

const ALERT_ESTADOS = ['COMPLETADO', 'CANCELADO', 'HOLD']

/**
 * Cola de tickets propios que necesitan una alerta en pantalla: recién
 * resueltos/cancelados (mostrar nota) o en HOLD (el sistema espera una
 * respuesta). Comparte el mismo query key que "Mis reportes" para no
 * duplicar el polling.
 */
export function useMyTicketAlerts() {
  const [seenVersion, setSeenVersion] = useState(0)

  const query = useQuery({
    queryKey: ['reportes', 'mine'],
    queryFn: () => listReportes({ mine: true }),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })

  // Primera vez que este navegador ve la lista: reconoce en silencio todo lo
  // que ya estaba resuelto/cancelado/en HOLD antes de este feature, para no
  // mostrar de golpe el historial completo de tickets viejos.
  useEffect(() => {
    if (!query.data || hasBaseline()) return
    for (const r of query.data.items) {
      if (ALERT_ESTADOS.includes(r.estado)) {
        acknowledge(r.reporte_id, r.fecha_actualizacion)
      }
    }
    setBaselined()
    setSeenVersion((v) => v + 1)
  }, [query.data])

  const queue = useMemo(() => {
    void seenVersion
    const items = query.data?.items ?? []
    return items
      .filter((r): r is ReporteResumen => ALERT_ESTADOS.includes(r.estado))
      .filter((r) => !isAcknowledged(r.reporte_id, r.fecha_actualizacion))
      .filter((r) => !isDismissedThisSession(r.reporte_id, r.fecha_actualizacion))
      .sort((a, b) => a.fecha_actualizacion.localeCompare(b.fecha_actualizacion))
  }, [seenVersion, query.data])

  const current = queue[0] ?? null

  return {
    current,
    dismiss: (r: ReporteResumen) => {
      dismissThisSession(r.reporte_id, r.fecha_actualizacion)
      setSeenVersion((v) => v + 1)
    },
    acknowledgeCurrent: (r: ReporteResumen) => {
      acknowledge(r.reporte_id, r.fecha_actualizacion)
      setSeenVersion((v) => v + 1)
    },
  }
}
