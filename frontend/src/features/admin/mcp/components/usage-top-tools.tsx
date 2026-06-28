import type { McpUsageResponse } from '../api'

type Props = {
  items: McpUsageResponse['top_tools']
  onPick: (tool: string) => void
}

export function UsageTopTools({ items, onPick }: Props) {
  return (
    <div className="rounded-lg border">
      <div className="border-b px-3 py-2 font-medium">Top tools</div>
      <ul className="divide-y">
        {items.map((t) => (
          <li
            key={t.tool}
            className="flex justify-between px-3 py-2 hover:bg-muted cursor-pointer"
            onClick={() => onPick(t.tool)}
          >
            <span className="font-mono text-sm">{t.tool}</span>
            <span className="text-sm">
              {t.calls.toLocaleString()} · {(t.error_rate * 100).toFixed(1)}% err · {t.p95_ms} ms p95
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
