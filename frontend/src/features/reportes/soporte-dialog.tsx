import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Paperclip, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  createReporte,
  fileToBase64,
  getReporte,
  listReportes,
  MODULOS_REPORTE,
  patchReporte,
  responderReporte,
  type EstadoReporte,
  type NuevaImagenReporte,
} from '@/lib/api-client-reportes'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
const MAX_IMAGENES = 3
const MAX_IMAGEN_MB = 5

const ESTADO_LABEL: Record<EstadoReporte, string> = {
  ABIERTO: 'Abierto',
  EN_PROGRESO: 'En progreso',
  HOLD: 'Esperando tu respuesta',
  COMPLETADO: 'Completado',
  CANCELADO: 'Cancelado',
}

const ESTADO_VARIANT: Record<
  EstadoReporte,
  'outline' | 'secondary' | 'default' | 'destructive'
> = {
  ABIERTO: 'outline',
  EN_PROGRESO: 'secondary',
  HOLD: 'destructive',
  COMPLETADO: 'default',
  CANCELADO: 'destructive',
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SoporteDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>Soporte</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue='nuevo'>
          <TabsList className='grid w-full grid-cols-2'>
            <TabsTrigger value='nuevo'>Reportar problema</TabsTrigger>
            <TabsTrigger value='mios'>Mis reportes</TabsTrigger>
          </TabsList>
          <TabsContent value='nuevo'>
            <NuevoReporteForm onCreated={() => onOpenChange(false)} />
          </TabsContent>
          <TabsContent value='mios'>
            <MisReportes />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function NuevoReporteForm({ onCreated }: { onCreated: () => void }) {
  const queryClient = useQueryClient()
  const [titulo, setTitulo] = useState('')
  const [modulo, setModulo] = useState('OTRO')
  const [descripcion, setDescripcion] = useState('')
  const [imagenes, setImagenes] = useState<
    (NuevaImagenReporte & { previewUrl: string })[]
  >([])

  const mutation = useMutation({
    mutationFn: () =>
      createReporte({
        titulo,
        modulo,
        descripcion,
        imagenes: imagenes.map(({ previewUrl: _p, ...rest }) => rest),
      }),
    onSuccess: () => {
      toast.success('Reporte enviado, gracias por avisarnos')
      queryClient.invalidateQueries({ queryKey: ['reportes', 'mine'] })
      setTitulo('')
      setModulo('OTRO')
      setDescripcion('')
      setImagenes([])
      onCreated()
    },
    onError: () => toast.error('No se pudo enviar el reporte'),
  })

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const restantes = MAX_IMAGENES - imagenes.length
    if (restantes <= 0) {
      toast.error(`Máximo ${MAX_IMAGENES} imágenes`)
      return
    }
    for (const file of Array.from(files).slice(0, restantes)) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: solo imágenes`)
        continue
      }
      if (file.size > MAX_IMAGEN_MB * 1024 * 1024) {
        toast.error(`${file.name}: supera ${MAX_IMAGEN_MB}MB`)
        continue
      }
      const data = await fileToBase64(file)
      setImagenes((prev) => [
        ...prev,
        {
          nombre: file.name,
          media_type: file.type,
          data,
          previewUrl: URL.createObjectURL(file),
        },
      ])
    }
  }

  return (
    <div className='space-y-4 py-2'>
      <div className='space-y-2'>
        <label className='text-sm font-medium'>Título</label>
        <Input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder='Resume el problema en pocas palabras'
          maxLength={200}
        />
      </div>
      <div className='space-y-2'>
        <label className='text-sm font-medium'>Módulo relacionado</label>
        <Select value={modulo} onValueChange={setModulo}>
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODULOS_REPORTE.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className='space-y-2'>
        <label className='text-sm font-medium'>Descripción</label>
        <Textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder='¿Qué pasó? ¿Qué esperabas que pasara?'
          rows={4}
        />
      </div>
      <div className='space-y-2'>
        <label className='text-sm font-medium'>
          Imágenes ({imagenes.length}/{MAX_IMAGENES})
        </label>
        {imagenes.length > 0 && (
          <div className='flex flex-wrap gap-2'>
            {imagenes.map((img, i) => (
              <div key={i} className='relative'>
                <img
                  src={img.previewUrl}
                  alt={img.nombre}
                  className='h-16 w-16 rounded-md border object-cover'
                />
                <button
                  type='button'
                  onClick={() =>
                    setImagenes((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  className='bg-background absolute -top-2 -right-2 rounded-full border p-0.5'
                >
                  <X className='size-3' />
                </button>
              </div>
            ))}
          </div>
        )}
        {imagenes.length < MAX_IMAGENES && (
          <label className='text-muted-foreground hover:bg-accent flex w-fit cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm'>
            <Paperclip className='size-4' />
            Adjuntar imagen
            <input
              type='file'
              accept={ACCEPTED_TYPES.join(',')}
              multiple
              className='hidden'
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>
        )}
      </div>
      <Button
        className='w-full'
        disabled={!titulo.trim() || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending && <Loader2 className='mr-2 size-4 animate-spin' />}
        Enviar reporte
      </Button>
    </div>
  )
}

export function MisReportes() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['reportes', 'mine'],
    queryFn: () => listReportes({ mine: true }),
  })

  const cancelar = useMutation({
    mutationFn: (reporteId: string) =>
      patchReporte(reporteId, { estado: 'CANCELADO' }),
    onSuccess: () => {
      toast.success('Reporte cancelado')
      queryClient.invalidateQueries({ queryKey: ['reportes', 'mine'] })
    },
    onError: () => toast.error('No se pudo cancelar'),
  })

  if (query.isLoading) {
    return (
      <div className='text-muted-foreground flex items-center justify-center py-8 text-sm'>
        <Loader2 className='mr-2 size-4 animate-spin' /> Cargando...
      </div>
    )
  }

  const items = query.data?.items ?? []
  if (items.length === 0) {
    return (
      <p className='text-muted-foreground py-8 text-center text-sm'>
        No has reportado ningún problema todavía.
      </p>
    )
  }

  return (
    <ScrollArea className='h-[50vh]'>
      <div className='space-y-3 py-2 pr-3'>
        {items.map((r) => (
          <div key={r.reporte_id} className='space-y-1 rounded-md border p-3'>
            <div className='flex items-start justify-between gap-2'>
              <span className='text-sm font-medium'>{r.titulo}</span>
              <Badge variant={ESTADO_VARIANT[r.estado]}>
                {ESTADO_LABEL[r.estado]}
              </Badge>
            </div>
            <p className='text-muted-foreground text-xs'>
              {r.modulo} · {new Date(r.fecha_creacion).toLocaleString()}
            </p>
            {r.estado === 'HOLD' && <PreguntaYRespuesta reporteId={r.reporte_id} />}
            {(r.estado === 'COMPLETADO' || r.estado === 'CANCELADO') && (
              <NotaResolucion reporteId={r.reporte_id} />
            )}
            {(r.estado === 'ABIERTO' || r.estado === 'EN_PROGRESO') && (
              <Button
                size='sm'
                variant='outline'
                disabled={cancelar.isPending}
                onClick={() => cancelar.mutate(r.reporte_id)}
              >
                Cancelar
              </Button>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}

function NotaResolucion({ reporteId }: { reporteId: string }) {
  const { data } = useQuery({
    queryKey: ['reportes', 'detalle', reporteId],
    queryFn: () => getReporte(reporteId),
  })
  if (!data?.nota_resolucion) return null
  return (
    <p className='bg-muted rounded-md p-2 text-xs'>
      <span className='font-medium'>Nota: </span>
      {data.nota_resolucion}
    </p>
  )
}

// Cuando el runner automático deja un reporte en HOLD, la pregunta queda en
// nota_resolucion (compatibilidad con lo que ya escribe el runner) y también
// como mensaje ROL='RUNNER' en el hilo. Responder aquí reabre el reporte a
// ABIERTO para que la próxima corrida del runner lo retome con la respuesta.
function PreguntaYRespuesta({ reporteId }: { reporteId: string }) {
  const queryClient = useQueryClient()
  const [respuesta, setRespuesta] = useState('')
  const detalle = useQuery({
    queryKey: ['reportes', 'detalle', reporteId],
    queryFn: () => getReporte(reporteId),
  })

  const responder = useMutation({
    mutationFn: () => responderReporte(reporteId, respuesta),
    onSuccess: () => {
      toast.success('Respuesta enviada. Se revisará en la próxima corrida.')
      setRespuesta('')
      queryClient.invalidateQueries({ queryKey: ['reportes', 'mine'] })
      queryClient.invalidateQueries({ queryKey: ['reportes', 'detalle', reporteId] })
    },
    onError: () => toast.error('No se pudo enviar la respuesta'),
  })

  const mensajes = detalle.data?.mensajes ?? []
  const pregunta = [...mensajes].reverse().find((m) => m.rol === 'RUNNER')

  return (
    <div className='space-y-2 rounded-md border border-amber-300 bg-amber-50 p-2 dark:border-amber-700 dark:bg-amber-950/30'>
      {mensajes.length > 0 ? (
        <div className='space-y-1.5'>
          {mensajes.map((m) => (
            <p key={m.mensaje_id} className='text-xs text-amber-900 dark:text-amber-200'>
              <span className='font-medium'>
                {m.rol === 'RUNNER' ? 'Sistema: ' : 'Tú: '}
              </span>
              {m.contenido}
            </p>
          ))}
        </div>
      ) : (
        pregunta === undefined &&
        detalle.data?.nota_resolucion && (
          <p className='text-xs text-amber-900 dark:text-amber-200'>
            <span className='font-medium'>Sistema: </span>
            {detalle.data.nota_resolucion}
          </p>
        )
      )}
      <Textarea
        value={respuesta}
        onChange={(e) => setRespuesta(e.target.value)}
        placeholder='Escribe tu respuesta…'
        rows={2}
        className='bg-background text-xs'
      />
      <Button
        size='sm'
        disabled={!respuesta.trim() || responder.isPending}
        onClick={() => responder.mutate()}
      >
        {responder.isPending && <Loader2 className='mr-2 size-4 animate-spin' />}
        Responder
      </Button>
    </div>
  )
}
