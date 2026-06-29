import { Fragment, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { Plus, Search as SearchIcon, MessageSquare, Trash2 } from 'lucide-react'
import {
  ASISTENTE_MODELS,
  type AsistenteConversacion,
  createConversacion,
  deleteConversacion,
  listConversaciones,
} from '@/lib/api-client-asistente'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Props = {
  selectedConvId: number | null
  onSelectConv: (id: number) => void
  model: string
  onModelChange: (m: string) => void
}

function groupKey(iso: string): string {
  const d = parseISO(iso)
  if (isToday(d)) return 'Hoy'
  if (isYesterday(d)) return 'Ayer'
  return format(d, 'd MMM yyyy')
}

export function AsistenteSidebar({
  selectedConvId,
  onSelectConv,
  model,
  onModelChange,
}: Props) {
  const [search, setSearch] = useState('')
  const qc = useQueryClient()

  const { data: convs = [], isLoading } = useQuery({
    queryKey: ['asistente', 'conversaciones'],
    queryFn: listConversaciones,
  })

  const createMut = useMutation({
    mutationFn: () => createConversacion({ modelo: model }),
    onSuccess: (conv) => {
      qc.invalidateQueries({ queryKey: ['asistente', 'conversaciones'] })
      onSelectConv(conv.id)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteConversacion(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asistente', 'conversaciones'] })
    },
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return convs
    return convs.filter((c) => c.titulo.toLowerCase().includes(q))
  }, [convs, search])

  const grouped = useMemo(() => {
    const acc: Record<string, AsistenteConversacion[]> = {}
    for (const c of filtered) {
      const k = groupKey(c.ts_actualizado)
      if (!acc[k]) acc[k] = []
      acc[k].push(c)
    }
    return acc
  }, [filtered])

  return (
    <aside className='flex h-full w-full flex-col border-e bg-card/40 sm:w-64 lg:w-72'>
      <div className='flex flex-col gap-3 border-b p-3'>
        <div className='flex items-center justify-between'>
          <h2 className='text-base font-semibold'>Conversaciones</h2>
          <Button
            size='icon'
            variant='ghost'
            aria-label='Nueva conversacion'
            disabled={createMut.isPending}
            onClick={() => createMut.mutate()}
          >
            <Plus size={18} />
          </Button>
        </div>

        <Select value={model} onValueChange={onModelChange}>
          <SelectTrigger className='h-8 text-xs'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ASISTENTE_MODELS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className='flex h-9 items-center rounded-md border bg-background px-2'>
          <SearchIcon size={14} className='me-2 stroke-muted-foreground' />
          <input
            type='text'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Buscar...'
            className='w-full bg-transparent text-sm focus:outline-none'
          />
        </label>
      </div>

      <ScrollArea className='flex-1'>
        {isLoading && (
          <div className='p-4 text-xs text-muted-foreground'>Cargando...</div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className='flex flex-col items-center gap-2 p-6 text-center text-xs text-muted-foreground'>
            <MessageSquare size={28} className='opacity-50' />
            <span>No hay conversaciones todavia.</span>
            <span>Crea una con el boton +.</span>
          </div>
        )}
        {Object.entries(grouped).map(([key, items]) => (
          <Fragment key={key}>
            <div className='px-3 pt-3 pb-1 text-xs font-medium text-muted-foreground'>
              {key}
            </div>
            {items.map((c) => (
              <div
                key={c.id}
                className={cn(
                  'group mx-2 flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground',
                  selectedConvId === c.id && 'bg-muted'
                )}
              >
                <button
                  type='button'
                  className='flex-1 truncate text-start'
                  onClick={() => onSelectConv(c.id)}
                >
                  <div className='truncate font-medium'>{c.titulo}</div>
                  <div className='truncate text-xs text-muted-foreground'>
                    {c.modelo.replace('claude-', '')} ·{' '}
                    {format(parseISO(c.ts_actualizado), 'HH:mm')}
                  </div>
                </button>
                <Button
                  size='icon'
                  variant='ghost'
                  aria-label='Eliminar conversacion'
                  className='h-7 w-7 opacity-0 group-hover:opacity-100'
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm('Eliminar esta conversacion?')) {
                      deleteMut.mutate(c.id)
                    }
                  }}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </Fragment>
        ))}
      </ScrollArea>
    </aside>
  )
}
