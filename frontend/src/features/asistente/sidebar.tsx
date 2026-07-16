import { Fragment, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { Plus, Search as SearchIcon, MessageSquare, Trash2 } from 'lucide-react'
import {
  type AsistenteConversacionResumen,
  createConversacion,
  deleteConversacion,
  listConversaciones,
} from '@/lib/api-client-asistente'
import { useCompany } from '@/context/company-context'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

type Props = {
  selectedConvId: string | null
  onSelectConv: (id: string) => void
}

function groupKey(iso: string): string {
  const d = parseISO(iso)
  if (isToday(d)) return 'Hoy'
  if (isYesterday(d)) return 'Ayer'
  return format(d, 'd MMM yyyy')
}

export function AsistenteSidebar({ selectedConvId, onSelectConv }: Props) {
  const [search, setSearch] = useState('')
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()

  const { data: convs = [], isLoading } = useQuery({
    queryKey: ['asistente', 'conversaciones'],
    queryFn: listConversaciones,
  })

  const createMut = useMutation({
    mutationFn: () =>
      createConversacion({ no_cia: selectedCompany, punto: selectedPoint }),
    onSuccess: (conv) => {
      qc.invalidateQueries({ queryKey: ['asistente', 'conversaciones'] })
      onSelectConv(conv.conv_id)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteConversacion(id),
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
    const acc: Record<string, AsistenteConversacionResumen[]> = {}
    for (const c of filtered) {
      const k = groupKey(c.fecha_ultimo)
      if (!acc[k]) acc[k] = []
      acc[k].push(c)
    }
    return acc
  }, [filtered])

  return (
    <aside className='flex h-full w-full flex-col border-e bg-card/40 sm:w-64 lg:w-72'>
      <div className='flex flex-col gap-3 border-b p-3'>
        <Button
          className='w-full justify-start gap-2 rounded-xl'
          variant='outline'
          disabled={createMut.isPending}
          onClick={() => createMut.mutate()}
        >
          <Plus size={16} />
          Nueva conversación
        </Button>

        <label className='flex h-9 items-center rounded-xl border bg-background px-2'>
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
                key={c.conv_id}
                className={cn(
                  'group mx-2 flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground',
                  selectedConvId === c.conv_id && 'bg-muted'
                )}
              >
                <button
                  type='button'
                  className='flex-1 truncate text-start'
                  onClick={() => onSelectConv(c.conv_id)}
                >
                  <div className='truncate font-medium'>{c.titulo}</div>
                  <div className='truncate text-xs text-muted-foreground'>
                    {format(parseISO(c.fecha_ultimo), 'HH:mm')}
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
                      deleteMut.mutate(c.conv_id)
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
