import { useEffect, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Bot } from 'lucide-react'
import { listConversaciones } from '@/lib/api-client-asistente'
import { AsistenteChat } from './chat'
import { AsistenteSidebar } from './sidebar'
import { AsistenteToolLog } from './tool-log'
import { type ChatTotals, type ToolEntry } from './use-chat-stream'

const DEFAULT_MODEL = 'claude-sonnet-4-6'

export function AsistentePage() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as {
    conv_id?: string | number
  }
  const [model, setModel] = useState<string>(DEFAULT_MODEL)
  const [tools, setTools] = useState<Record<string, ToolEntry>>({})
  const [totals, setTotals] = useState<ChatTotals | undefined>(undefined)

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
          <AsistenteChat
            key={selectedConvId}
            convId={selectedConvId}
            onToolsChange={setTools}
            onTotalsChange={setTotals}
          />
        )}
      </main>

      <AsistenteToolLog tools={tools} totals={totals} />
    </div>
  )
}
