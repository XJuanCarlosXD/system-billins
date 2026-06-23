import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useMcpUsage } from '../api'
import { UsageKpis } from '../components/usage-kpis'
import { UsageRecentErrors } from '../components/usage-recent-errors'
import { UsageTimeSeries } from '../components/usage-timeseries'
import { UsageTopTools } from '../components/usage-top-tools'
import { UsageTopUsers } from '../components/usage-top-users'

export function McpUsagePage() {
  const [filtros, setFiltros] = useState<Record<string, string | undefined>>({
    granularidad: 'hora',
  })
  const { data, isFetching, refetch } = useMcpUsage(filtros)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Uso del MCP</h1>
        <Button onClick={() => refetch()} disabled={isFetching}>
          ↻ Refresh
        </Button>
      </div>
      {data && (
        <>
          <UsageKpis kpis={data.kpis} />
          <UsageTimeSeries data={data.serie_temporal} />
          <div className="grid md:grid-cols-2 gap-4">
            <UsageTopTools
              items={data.top_tools}
              onPick={(tool) => setFiltros({ ...filtros, tool })}
            />
            <UsageTopUsers
              items={data.top_usuarios}
              onPick={(usuario) => setFiltros({ ...filtros, usuario })}
            />
          </div>
          <UsageRecentErrors items={data.top_errores} />
        </>
      )}
    </div>
  )
}
