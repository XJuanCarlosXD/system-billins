import { useEffect, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Bot } from 'lucide-react'
import { listConversaciones } from '@/lib/api-client-asistente'
import { AsistenteSidebar } from './sidebar'

const DEFAULT_MODEL = 'claude-sonnet-4-6'

export function AsistentePage() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as {
    conv_id?: string | number
  }
  const [model, setModel] = useState<string>(DEFAULT_MODEL)

  const selectedConvId =
    search.conv_id && search.conv_id !== 'new' ? Number(search.conv_id) : null

  // Si no hay conv_id, intenta usar la mas reciente; si no hay ninguna, deja null
  // (la UI mostrara prompt para crear nueva).
  const { data: convs = [] } = useQuery({
    queryKey: ['asistente', 'conversaciones'],
    queryFn: listConversaciones,
  })

  useEffect(() => {
    if (selectedConvId !== null) return
    if (search.conv_id === 'new') return
    if (convs.length > 0) {
      const last = convs[0]
      navigate({
        to: '.',
        search: { conv_id: last.id },
        replace: true,
      } as any)
    }
  }, [convs, selectedConvId, search.conv_id, navigate])

  const handleSelectConv = (id: number) => {
    navigate({ to: '.', search: { conv_id: id } } as any)
  }

  return (
    <div className='flex h-svh w-full overflow-hidden bg-background'>
      <AsistenteSidebar
        selectedConvId={selectedConvId}
        onSelectConv={handleSelectConv}
        model={model}
        onModelChange={setModel}
      />

      <main className='flex flex-1 flex-col'>
        {selectedConvId === null ? (
          <div className='flex h-full flex-col items-center justify-center gap-3 px-6 text-center'>
            <div className='flex size-16 items-center justify-center rounded-full border-2 border-border'>
              <Bot className='size-8' />
            </div>
            <h1 className='text-xl font-semibold'>Asistente ZentoryERP</h1>
            <p className='max-w-md text-sm text-muted-foreground'>
              Selecciona una conversacion del panel izquierdo o crea una nueva
              con el boton + para empezar.
            </p>
          </div>
        ) : (
          <div className='flex h-full items-center justify-center text-sm text-muted-foreground'>
            Chat de conv #{selectedConvId} (UI en construccion - Task 24).
          </div>
        )}
      </main>

      <aside className='hidden w-72 flex-col border-s bg-card/40 lg:flex'>
        <div className='border-b p-3'>
          <h2 className='text-base font-semibold'>Tool log</h2>
        </div>
        <div className='flex-1 p-4 text-xs text-muted-foreground'>
          Aun no hay tools ejecutadas (Task 25).
        </div>
      </aside>
    </div>
  )
}
