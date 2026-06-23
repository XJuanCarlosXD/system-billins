import type { McpUsageResponse } from '../api'

type Props = { items: McpUsageResponse['top_errores'] }

export function UsageRecentErrors({ items }: Props) {
  return (
    <div className="rounded-lg border">
      <div className="border-b px-3 py-2 font-medium">Errores frecuentes</div>
      <ul className="divide-y">
        {items.map((e, i) => (
          <li key={i} className="px-3 py-2 text-sm">
            <span className="font-mono">{e.error_code}</span> · {e.calls} veces · última:{' '}
            <span className="font-mono">{e.ultima_tool}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
