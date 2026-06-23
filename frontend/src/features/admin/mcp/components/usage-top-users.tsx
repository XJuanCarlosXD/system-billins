import type { McpUsageResponse } from '../api'

type Props = {
  items: McpUsageResponse['top_usuarios']
  onPick: (usuario: string) => void
}

export function UsageTopUsers({ items, onPick }: Props) {
  return (
    <div className="rounded-lg border">
      <div className="border-b px-3 py-2 font-medium">Top usuarios</div>
      <ul className="divide-y">
        {items.map((u) => (
          <li
            key={u.usuario}
            className="flex justify-between px-3 py-2 hover:bg-muted cursor-pointer"
            onClick={() => onPick(u.usuario)}
          >
            <span>{u.usuario}</span>
            <span className="text-sm">
              {u.calls.toLocaleString()} · {u.ultimo_uso}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
