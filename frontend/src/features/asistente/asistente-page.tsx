import { Link } from '@tanstack/react-router'
import {
  Bot,
  Construction,
  FileText,
  LockKeyhole,
  MessageSquare,
  Receipt,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
  return (
    <div className='min-h-svh w-full overflow-y-auto bg-background'>
      <div className='mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10'>
        {/* Banner under construction */}
        <div className='flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200'>
          <Construction className='size-5 shrink-0' />
          <div className='text-sm'>
            <strong>Sección en construcción.</strong>{' '}
            La interfaz está montada como vista previa, pero el modelo no está
            conectado todavía. Pronto podrás conversar con él.
          </div>
        </div>

        {/* Hero */}
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
            <Badge variant='secondary'>
              <Wrench className='mr-1 size-3' />
              en construcción
            </Badge>
          </div>
        </div>

        {/* Lo que podrá hacer */}
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

        {/* Ejemplos de uso */}
        <div>
          <h2 className='mb-3 text-lg font-semibold'>
            Ejemplos de cosas que podrás pedirle
          </h2>
          <ul className='space-y-2 text-sm text-muted-foreground'>
            <li className='rounded-md border bg-card px-3 py-2'>
              <em>"Lista mis facturas pendientes de cobro de esta semana."</em>
            </li>
            <li className='rounded-md border bg-card px-3 py-2'>
              <em>
                "Hazme una factura a JUAN PEREZ por 5 ARROZ MAYOLO y 2 ACEITE
                1L."
              </em>
            </li>
            <li className='rounded-md border bg-card px-3 py-2'>
              <em>
                "Cuál es el saldo disponible del banco Popular este mes,
                descontando los cheques por entregar."
              </em>
            </li>
            <li className='rounded-md border bg-card px-3 py-2'>
              <em>"Concilia los cheques de junio de la cuenta 030-011926-7."</em>
            </li>
            <li className='rounded-md border bg-card px-3 py-2'>
              <em>"Cierra la caja de hoy del punto 01."</em>
            </li>
          </ul>
        </div>

        {/* Estado actual */}
        <div className='rounded-lg border bg-muted/30 p-4 text-sm'>
          <div className='mb-2 flex items-center gap-2 font-semibold'>
            <FileText className='size-4' />
            Estado actual
          </div>
          <ul className='space-y-1 text-muted-foreground'>
            <li>✅ Backend Django con agent loop, tool registry y RBAC en 6 capas.</li>
            <li>✅ 18 tools wrappeados sobre FAT/CHC/CXC/CXP/CNT/INV.</li>
            <li>✅ 6 skills (playbooks): facturar, cotizar, cerrar-caja, conciliar-banco, consultar-cuenta-cliente, nueva-empresa-onboarding.</li>
            <li>✅ Persistencia en Oracle (TCHAT_CONVERSACION / MENSAJE / TOOL_PENDING / TOOL_LOG).</li>
            <li>⏳ Falta conectar la API key del proveedor para activar las respuestas en vivo.</li>
          </ul>
        </div>

        <div className='flex justify-center pt-2'>
          <Button asChild variant='outline'>
            <Link to='/'>Volver al inicio</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
