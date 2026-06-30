import { AlertTriangle } from 'lucide-react'
import { ReactNode } from 'react'

interface Props {
  children: ReactNode
  tone?: 'amber' | 'red'
}

export function AlertIrreversible({ children, tone = 'amber' }: Props) {
  const cls =
    tone === 'red'
      ? 'border-red-300 bg-red-50 text-red-900'
      : 'border-amber-300 bg-amber-50 text-amber-900'
  return (
    <div
      className={`border rounded-lg p-3 text-sm flex items-start gap-2 ${cls}`}
    >
      <AlertTriangle className='h-4 w-4 mt-0.5 shrink-0' />
      <div>{children}</div>
    </div>
  )
}
