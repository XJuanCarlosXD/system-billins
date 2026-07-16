import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Bot,
  LockKeyhole,
  Plus,
  Receipt,
  Search,
  ShieldCheck,
  MessageSquare,
  Sparkles,
} from 'lucide-react'
import {
  createConversacion,
  fetchAsistenteStatus,
} from '@/lib/api-client-asistente'
import { useCompany } from '@/context/company-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AsistenteChat } from './chat'
import { AsistenteSidebar } from './sidebar'

const CAPABILITIES = [
  {
    icon: Search,
    title: 'Consultar tu información',
    desc: 'Listar facturas pendientes, ver el aging de un cliente, revisar saldos bancarios, traer movimientos de inventario, buscar productos por descripción.',
  },
  {
    icon: Receipt,
    title: 'Crear documentos',
    desc: 'Emitir facturas (B01-B15), cotizaciones, cheques o ajustes — siempre con un paso de confirmación antes de tocar Oracle.',
  },
  {
    icon: LockKeyhole,
    title: 'Cerrar y conciliar',
    desc: 'Conciliación bancaria masiva, cierres de mes, cuadres de caja del día siguiendo el flujo exacto del sistema legado.',
  },
  {
    icon: Sparkles,
    title: 'Skills (playbooks)',
    desc: 'Activa modos como "facturar", "cotizar" o "conciliar-banco" y el asistente sigue el flujo paso a paso para no equivocarse.',
  },
  {
    icon: MessageSquare,
    title: 'Memoria del proyecto',
    desc: 'Busca en las memorias guardadas del proyecto: configuraciones, decisiones, helpers, formatos DGII.',
  },
  {
    icon: ShieldCheck,
    title: 'Limitado a tus permisos',
    desc: 'El asistente sólo puede hacer lo que tu usuario puede hacer — los flags TXXX_USUARIO y los permisos por documento se aplican siempre.',
  },
]

export function AsistentePage() {
  const { data: status } = useQuery({
    queryKey: ['asistente-status'],
    queryFn: fetchAsistenteStatus,
    staleTime: 5 * 60 * 1000,
  })
  const apiKeyOk = status?.api_key_configurada === true

  const [convId, setConvId] = useState<string | null>(null)
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()
  const createMut = useMutation({
    mutationFn: () =>
      createConversacion({ no_cia: selectedCompany, punto: selectedPoint }),
    onSuccess: (conv) => {
      qc.invalidateQueries({ queryKey: ['asistente', 'conversaciones'] })
      setConvId(conv.conv_id)
    },
  })

  if (apiKeyOk) {
    return (
      <div className='flex h-svh w-full'>
        <AsistenteSidebar selectedConvId={convId} onSelectConv={setConvId} />
        <div className='min-w-0 flex-1'>
          {convId ? (
            <AsistenteChat convId={convId} onConvSwitch={setConvId} />
          ) : (
            <div className='flex h-full flex-col items-center justify-center gap-4 text-center'>
              <div className='flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-md'>
                <Bot size={26} />
              </div>
              <div>
                <h2 className='text-xl font-semibold'>Asistente ZentoryERP</h2>
                <p className='mt-1 text-sm text-muted-foreground'>
                  Consulta tu ERP, busca precios en internet o analiza PDFs e
                  imágenes.
                </p>
              </div>
              <Button
                className='gap-2 rounded-full'
                disabled={createMut.isPending}
                onClick={() => createMut.mutate()}
              >
                <Plus size={16} />
                Nueva conversación
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Fallback: the provider API key isn't configured server-side yet, so the
  // chat can't run. Show what the assistant will do instead of an empty page.
  return (
    <div className='min-h-svh w-full overflow-y-auto bg-background'>
      <div className='mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10'>
        <div className='flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200'>
          <AlertTriangle className='size-5 shrink-0' />
          <div className='text-sm'>
            <strong>El asistente no está conectado todavía.</strong>{' '}
            Falta configurar la API key del proveedor en el servidor. Avisa al
            administrador del sistema.
          </div>
        </div>

        <div className='flex flex-col items-center gap-4 pt-6 text-center'>
          <div className='relative flex size-20 items-center justify-center rounded-full border-2 border-primary/30 bg-primary/5'>
            <Bot className='size-10 text-primary' />
            <Sparkles className='absolute -right-1 -top-1 size-5 text-amber-500' />
          </div>
          <h1 className='text-3xl font-semibold tracking-tight'>
            Asistente ZentoryERP
          </h1>
          <p className='max-w-xl text-base text-muted-foreground'>
            Un copiloto integrado al ERP que entiende tu empresa, conoce el
            flujo del sistema y puede ejecutar tareas contigo sin que tengas
            que salir de la pantalla.
          </p>
          <div className='flex flex-wrap items-center justify-center gap-2'>
            <Badge variant='outline'>Claude 4.5 Haiku</Badge>
            <Badge variant='outline'>FAT · CHC · CXC · CXP · CNT · INV</Badge>
          </div>
        </div>

        <div>
          <h2 className='mb-4 text-lg font-semibold'>Lo que podrás hacer</h2>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
            {CAPABILITIES.map(({ icon: Icon, title, desc }) => (
              <Card key={title} className='transition hover:border-primary/40'>
                <CardHeader className='flex flex-row items-center gap-3 space-y-0 pb-2'>
                  <div className='flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10'>
                    <Icon className='size-4 text-primary' />
                  </div>
                  <CardTitle className='text-sm font-semibold'>
                    {title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className='text-sm text-muted-foreground'>{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
