import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Wrench,
} from 'lucide-react'
import { confirmTool } from '@/lib/api-client-asistente'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { type ToolEntry } from './use-chat-stream'

type Props = {
  tools: Record<string, ToolEntry>
}

function StatusIcon({ status }: { status: ToolEntry['status'] }) {
  if (status === 'running')
    return <Loader2 size={14} className='animate-spin text-muted-foreground' />
  if (status === 'pending')
    return <Clock size={14} className='text-amber-500' />
  if (status === 'error')
    return <AlertCircle size={14} className='text-destructive' />
  return <CheckCircle2 size={14} className='text-emerald-500' />
}

export function AsistenteToolLog({ tools }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const entries = Object.values(tools).sort((a, b) => a.ts - b.ts)

  if (collapsed) {
    return (
      <aside className='hidden flex-col items-center border-s bg-card/40 px-1 py-2 lg:flex'>
        <Button
          variant='ghost'
          size='icon'
          onClick={() => setCollapsed(false)}
          aria-label='Mostrar tool log'
        >
          <PanelRightOpen size={18} />
        </Button>
      </aside>
    )
  }

  return (
    <aside className='hidden w-72 flex-col border-s bg-card/40 lg:flex'>
      <div className='flex items-center justify-between border-b p-3'>
        <div className='flex items-center gap-2'>
          <Wrench size={14} />
          <h2 className='text-sm font-semibold'>Tool log</h2>
          <span className='text-xs text-muted-foreground'>
            ({entries.length})
          </span>
        </div>
        <Button
          variant='ghost'
          size='icon'
          className='h-7 w-7'
          onClick={() => setCollapsed(true)}
          aria-label='Ocultar tool log'
        >
          <PanelRightClose size={16} />
        </Button>
      </div>

      <ScrollArea className='flex-1'>
        {entries.length === 0 && (
          <div className='p-4 text-xs text-muted-foreground'>
            Aun no hay tools ejecutadas en esta conversacion.
          </div>
        )}
        <div className='flex flex-col gap-1 p-2'>
          {entries.map((t) => (
            <ToolRow key={t.call_id} tool={t} />
          ))}
        </div>
      </ScrollArea>
    </aside>
  )
}

function ToolRow({ tool }: { tool: ToolEntry }) {
  const [open, setOpen] = useState(false)
  const confirmMut = useMutation({
    mutationFn: (approved: boolean) =>
      confirmTool(tool.sig!, approved),
  })

  return (
    <div className='rounded-md border bg-card p-2 text-xs'>
      <button
        type='button'
        className='flex w-full items-center gap-2 text-start'
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <StatusIcon status={tool.status} />
        <span className='flex-1 truncate font-mono'>{tool.tool_name}</span>
        {tool.duration_ms != null && (
          <span className='text-[10px] text-muted-foreground'>
            {tool.duration_ms}ms
          </span>
        )}
      </button>

      {tool.status === 'pending' && tool.sig && (
        <div className='mt-2 rounded border border-amber-500/40 bg-amber-50/40 p-2 dark:bg-amber-950/20'>
          {tool.preview && (
            <p className='mb-2 text-[11px] text-muted-foreground'>
              {tool.preview}
            </p>
          )}
          <div className='flex gap-2'>
            <Button
              size='sm'
              className='h-7 flex-1'
              disabled={confirmMut.isPending}
              onClick={() => confirmMut.mutate(true)}
            >
              Confirmar
            </Button>
            <Button
              size='sm'
              variant='outline'
              className='h-7 flex-1'
              disabled={confirmMut.isPending}
              onClick={() => confirmMut.mutate(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {open && (
        <div className='mt-2 space-y-1 border-t pt-2'>
          {tool.args !== undefined && (
            <details className='text-[11px]'>
              <summary className='cursor-pointer text-muted-foreground'>
                args
              </summary>
              <pre className='mt-1 overflow-x-auto rounded bg-muted/50 p-1 text-[10px]'>
                {JSON.stringify(tool.args, null, 2)}
              </pre>
            </details>
          )}
          {tool.result !== undefined && (
            <details className='text-[11px]'>
              <summary className='cursor-pointer text-muted-foreground'>
                result
              </summary>
              <pre className='mt-1 overflow-x-auto rounded bg-muted/50 p-1 text-[10px]'>
                {typeof tool.result === 'string'
                  ? tool.result
                  : JSON.stringify(tool.result, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
