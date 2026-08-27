import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  getReporte,
  imagenReporteUrl,
  listReportes,
  MODULOS_REPORTE,
  patchReporte,
  type EstadoReporte,
  type ReporteResumen,
} from '@/lib/api-client-reportes'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

const ESTADOS: EstadoReporte[] = [
  'ABIERTO',
  'EN_PROGRESO',
  'HOLD',
  'COMPLETADO',
  'CANCELADO',
]

const ESTADO_LABEL: Record<EstadoReporte, string> = {
  ABIERTO: 'Abierto',
  EN_PROGRESO: 'En progreso',
  HOLD: 'En espera (aprobación externa)',
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

export function ReportesAdminTable() {
  const [estadoFiltro, setEstadoFiltro] = useState<string>('TODOS')
  const [moduloFiltro, setModuloFiltro] = useState<string>('TODOS')
  const [seleccionado, setSeleccionado] = useState<ReporteResumen | null>(null)

  const query = useQuery({
    queryKey: ['reportes', 'admin', estadoFiltro, moduloFiltro],
    queryFn: () =>
      listReportes({
        estado: estadoFiltro === 'TODOS' ? undefined : estadoFiltro,
        modulo: moduloFiltro === 'TODOS' ? undefined : moduloFiltro,
      }),
  })

  const items = query.data?.items ?? []

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap gap-2'>
        <Select value={estadoFiltro} onValueChange={setEstadoFiltro}>
          <SelectTrigger className='w-48'>
            <SelectValue placeholder='Estado' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='TODOS'>Todos los estados</SelectItem>
            {ESTADOS.map((e) => (
              <SelectItem key={e} value={e}>
                {ESTADO_LABEL[e]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={moduloFiltro} onValueChange={setModuloFiltro}>
          <SelectTrigger className='w-56'>
            <SelectValue placeholder='Módulo' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='TODOS'>Todos los módulos</SelectItem>
            {MODULOS_REPORTE.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Estado</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Módulo</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className='text-right'>Imágenes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading && (
              <TableRow>
                <TableCell colSpan={6} className='text-muted-foreground py-8 text-center'>
                  <Loader2 className='mr-2 inline size-4 animate-spin' />
                  Cargando...
                </TableCell>
              </TableRow>
            )}
            {!query.isLoading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className='text-muted-foreground py-8 text-center'>
                  No hay reportes con estos filtros.
                </TableCell>
              </TableRow>
            )}
            {items.map((r) => (
              <TableRow
                key={r.reporte_id}
                className='cursor-pointer'
                onClick={() => setSeleccionado(r)}
              >
                <TableCell>
                  <Badge variant={ESTADO_VARIANT[r.estado]}>
                    {ESTADO_LABEL[r.estado]}
                  </Badge>
                </TableCell>
                <TableCell className='max-w-xs truncate'>{r.titulo}</TableCell>
                <TableCell>{r.modulo}</TableCell>
                <TableCell>{r.usuario}</TableCell>
                <TableCell>
                  {new Date(r.fecha_creacion).toLocaleString()}
                </TableCell>
                <TableCell className='text-right'>{r.num_imagenes}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ReporteDetailSheet
        reporteId={seleccionado?.reporte_id ?? null}
        onOpenChange={(open) => !open && setSeleccionado(null)}
      />
    </div>
  )
}

function ReporteDetailSheet({
  reporteId,
  onOpenChange,
}: {
  reporteId: string | null
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [estado, setEstado] = useState<EstadoReporte>('ABIERTO')
  const [nota, setNota] = useState('')

  const detail = useQuery({
    queryKey: ['reportes', 'detalle', reporteId],
    queryFn: () => getReporte(reporteId as string),
    enabled: !!reporteId,
  })

  useEffect(() => {
    if (detail.data) {
      setEstado(detail.data.estado)
      setNota(detail.data.nota_resolucion ?? '')
    }
  }, [detail.data])

  const guardar = useMutation({
    mutationFn: () =>
      patchReporte(reporteId as string, {
        estado,
        nota_resolucion: nota || undefined,
      }),
    onSuccess: () => {
      toast.success('Reporte actualizado')
      queryClient.invalidateQueries({ queryKey: ['reportes', 'admin'] })
      queryClient.invalidateQueries({ queryKey: ['reportes', 'detalle', reporteId] })
    },
    onError: () => toast.error('No se pudo actualizar el reporte'),
  })

  return (
    <Sheet open={!!reporteId} onOpenChange={onOpenChange}>
      <SheetContent className='w-full overflow-y-auto sm:max-w-lg'>
        <SheetHeader>
          <SheetTitle>{detail.data?.titulo ?? 'Reporte'}</SheetTitle>
        </SheetHeader>
        {detail.isLoading && (
          <div className='text-muted-foreground flex items-center justify-center py-8 text-sm'>
            <Loader2 className='mr-2 size-4 animate-spin' /> Cargando...
          </div>
        )}
        {detail.data && (
          <div className='space-y-4 px-4 pb-4'>
            <p className='text-muted-foreground text-xs'>
              {detail.data.modulo} · {detail.data.usuario} ·{' '}
              {new Date(detail.data.fecha_creacion).toLocaleString()}
            </p>
            <p className='text-sm whitespace-pre-wrap'>
              {detail.data.descripcion}
            </p>
            {detail.data.imagenes.length > 0 && (
              <div className='flex flex-wrap gap-2'>
                {detail.data.imagenes.map((img) => (
                  <a
                    key={img.imagen_id}
                    href={imagenReporteUrl(detail.data.reporte_id, img.imagen_id)}
                    target='_blank'
                    rel='noreferrer'
                  >
                    <img
                      src={imagenReporteUrl(
                        detail.data.reporte_id,
                        img.imagen_id
                      )}
                      crossOrigin='use-credentials'
                      alt={img.nombre_archivo}
                      className='h-20 w-20 rounded-md border object-cover'
                    />
                  </a>
                ))}
              </div>
            )}

            {detail.data.mensajes.length > 0 && (
              <div className='space-y-1.5 rounded-md border p-2'>
                <p className='text-xs font-medium'>Conversación</p>
                {detail.data.mensajes.map((m) => (
                  <p key={m.mensaje_id} className='text-xs'>
                    <span className='font-medium'>
                      {m.rol === 'RUNNER' ? 'Sistema: ' : `${m.usuario || 'Usuario'}: `}
                    </span>
                    {m.contenido}
                  </p>
                ))}
              </div>
            )}

            <div className='space-y-2'>
              <label className='text-sm font-medium'>Estado</label>
              <Select
                value={estado}
                onValueChange={(v) => setEstado(v as EstadoReporte)}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS.map((e) => (
                    <SelectItem key={e} value={e}>
                      {ESTADO_LABEL[e]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Nota de resolución</label>
              <Textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={3}
                placeholder='Visible para quien reportó, ej: qué se corrigió'
              />
            </div>
            <Button
              className='w-full'
              disabled={guardar.isPending}
              onClick={() => guardar.mutate()}
            >
              {guardar.isPending && (
                <Loader2 className='mr-2 size-4 animate-spin' />
              )}
              Guardar
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
