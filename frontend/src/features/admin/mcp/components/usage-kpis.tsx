import type { McpUsageResponse } from '../api'

type Props = { kpis: McpUsageResponse['kpis'] }

const Kpi = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-lg border p-4">
    <div className="text-2xl font-semibold">{value}</div>
    <div className="text-xs text-muted-foreground">{label}</div>
  </div>
)

export function UsageKpis({ kpis }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
      <Kpi label="Llamadas" value={kpis.total_calls.toLocaleString()} />
      <Kpi label="Error rate" value={`${(kpis.error_rate * 100).toFixed(2)}%`} />
      <Kpi label="p95" value={`${kpis.p95_ms} ms`} />
      <Kpi label="Usuarios activos" value={kpis.usuarios_activos} />
      <Kpi label="PDFs" value={kpis.downloads_pdf} />
      <Kpi label="Excel" value={kpis.downloads_xlsx} />
    </div>
  )
}
