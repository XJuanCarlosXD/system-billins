// Oportunidades descubiertas en el portal DGCP para la empresa activa: tabla filtrable
// por estado_portal + botón "Buscar ahora" que dispara un ScrapeJob y hace polling en
// vivo de su estado. Módulo nuevo del clon (no hay pantalla legacy Oracle Forms).
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Eye, FileText, Loader2, Search } from 'lucide-react'
import { useCompany } from '@/hooks/use-company'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  LicApiError,
  type Oportunidad,
  useBuscarAhora,
  useDocumentos,
  useOportunidades,
  useScrapeJobStatus,
} from './api'

// Sentinela para "sin filtro" -- Radix SelectItem no admite value="" (rompe el
// componente, ver feedback_inv_grupos_field_naming.md).
const TODOS = '__todos__'

function formatDate(s: string | null): string {
  return s ? String(s).slice(0, 10) : ''
}

const DOC_ESTADO_VARIANT: Record<'ok' | 'error', 'default' | 'destructive'> = {
  ok: 'default',
  error: 'destructive',
}

export function LicOportunidades() {
  const { selectedCompany } = useCompany()

  // Nota sobre el filtro de estado (bug #3 del reference): `estado_portal` no tiene un
  // enum fijo -- son valores tal cual los reporta el portal (ej. "SELECCIÓN", "OFERTA EN
  // ANÁLISIS"), capturados por el scraper desde `.ws_rc_state`. No hay catálogo de esos
  // valores en el backend (oportunidades_view solo hace WHERE estado_portal = :estado,
  // exact-match) ni justifica agregar uno para una lista que hoy no pagina (ver TODO en
  // `lic_repo.list_oportunidades` / `oportunidades_view`). Por eso: se trae la lista SIN
  // filtro de servidor (una sola consulta), el dropdown de estado se arma dinámicamente
  // con los valores distintos que de verdad aparecen en esos datos, y el filtro se aplica
  // en el cliente sobre ese mismo resultado. Si el volumen de oportunidades por empresa
  // creciera al punto de que esto duela, el primer paso sería paginar el backend (ya
  // anotado como pendiente ahí) y recién entonces valdría la pena mover el filtro al
  // servidor.
  const [estado, setEstado] = useState(TODOS)
  const [jobId, setJobId] = useState<number | null>(null)
  const [selectedOportunidad, setSelectedOportunidad] = useState<Oportunidad | null>(null)

  const { data, isLoading, refetch } = useOportunidades(selectedCompany)
  const buscarAhora = useBuscarAhora()
  const { data: jobStatus } = useScrapeJobStatus(jobId)
  const documentosQ = useDocumentos(selectedOportunidad?.id ?? null)

  const oportunidades = data?.oportunidades ?? []

  const estadosDisponibles = useMemo(() => {
    const set = new Set<string>()
    for (const o of oportunidades) {
      if (o.estado_portal) set.add(o.estado_portal)
    }
    return Array.from(set).sort()
  }, [oportunidades])

  const rows = useMemo(
    () => (estado === TODOS ? oportunidades : oportunidades.filter((o) => o.estado_portal === estado)),
    [oportunidades, estado]
  )

  // Bug #1 del reference: NO se puede refetch() en el cuerpo del render en cada pasada
  // (efecto secundario durante render + reintento infinito). Se dispara UNA sola vez,
  // en un efecto, cuando el job pasa de "corriendo" a un estado final, usando un ref
  // para no repetir el refetch/toast si el componente vuelve a renderizar con el mismo
  // job ya resuelto (ej. al cambiar el filtro de estado).
  const lastHandledJobRef = useRef<number | null>(null)
  useEffect(() => {
    if (!jobId || !jobStatus || jobStatus.estado === 'corriendo') return
    if (lastHandledJobRef.current === jobId) return
    lastHandledJobRef.current = jobId

    refetch()
    if (jobStatus.estado === 'completado') {
      toast.success(
        `Búsqueda completada: ${jobStatus.resumen.oportunidades_nuevas} oportunidad(es) nueva(s), ` +
          `${jobStatus.resumen.documentos_descargados} documento(s) descargado(s)`
      )
    } else if (jobStatus.estado === 'completado_con_errores') {
      toast.warning(
        `Búsqueda completada con ${jobStatus.resumen.errores.length} error(es). ` +
          `${jobStatus.resumen.oportunidades_nuevas} oportunidad(es) nueva(s).`
      )
    } else if (jobStatus.estado === 'error') {
      toast.error('La búsqueda terminó con error. Intente de nuevo más tarde.')
    }
  }, [jobId, jobStatus, refetch])

  const buscando = jobStatus?.estado === 'corriendo'

  const handleBuscarAhora = () => {
    buscarAhora.mutate(selectedCompany, {
      onSuccess: (res) => {
        setJobId(res.job_id)
        toast.info('Búsqueda iniciada en el portal DGCP')
      },
      onError: (e) => {
        // Bug #2 del reference: un 409 de la guardia de concurrencia (Task 10) trae
        // job_id del job que YA está corriendo -- en vez de un error sin salida, se
        // engancha el polling a ESE job para mostrar su progreso en tiempo real.
        if (e instanceof LicApiError && e.job_id) {
          setJobId(e.job_id)
          toast.info('Ya hay una búsqueda en curso para esta empresa. Mostrando su progreso.')
        } else {
          toast.error(e.message)
        }
      },
    })
  }

  return (
    <div className='space-y-4'>
      <div>
        <h3 className='text-base font-semibold'>Oportunidades</h3>
        <p className='text-sm text-muted-foreground'>
          Licitaciones descubiertas en el portal de Compras y Contrataciones (DGCP) para
          la empresa {selectedCompany}. Use "Buscar ahora" para forzar una corrida
          manual sin esperar al cron diario.
        </p>
      </div>

      <div className='flex flex-wrap items-end gap-3'>
        <div>
          <Label className='text-xs'>Estado en el portal</Label>
          <Select value={estado} onValueChange={setEstado}>
            <SelectTrigger className='w-56 h-9'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {estadosDisponibles.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button disabled={buscando || buscarAhora.isPending} onClick={handleBuscarAhora}>
          {buscando || buscarAhora.isPending ? (
            <>
              <Loader2 className='h-4 w-4 mr-1 animate-spin' /> Buscando…
            </>
          ) : (
            <>
              <Search className='h-4 w-4 mr-1' /> Buscar ahora
            </>
          )}
        </Button>

        <div className='ml-auto text-sm text-muted-foreground'>
          {rows.length} oportunidad{rows.length !== 1 ? 'es' : ''}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className='h-40 w-full' />
      ) : (
        <div className='rounded-md border overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referencia</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Entidad</TableHead>
                <TableHead>Título</TableHead>
                <TableHead className='w-28'>Fecha límite</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className='w-16 text-right'>Docs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((o) => (
                <TableRow
                  key={o.id}
                  onClick={() => setSelectedOportunidad(o)}
                  className='cursor-pointer hover:bg-muted/50'
                >
                  <TableCell className='font-mono text-xs'>{o.referencia}</TableCell>
                  <TableCell>{o.tipo_proceso}</TableCell>
                  <TableCell className='truncate max-w-[12rem]'>{o.entidad}</TableCell>
                  <TableCell className='truncate max-w-sm'>{o.titulo}</TableCell>
                  <TableCell>{formatDate(o.fecha_limite)}</TableCell>
                  <TableCell>
                    <Badge variant='outline'>{o.estado_portal || 'Sin estado'}</Badge>
                  </TableCell>
                  <TableCell className='text-right' onClick={(e) => e.stopPropagation()}>
                    <Button
                      size='sm'
                      variant='ghost'
                      onClick={() => setSelectedOportunidad(o)}
                      title='Ver documentos'
                    >
                      <Eye className='h-4 w-4' />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className='text-center text-muted-foreground py-6'>
                    {oportunidades.length === 0
                      ? 'No se han descubierto oportunidades para esta empresa todavía. Use "Buscar ahora" o espere al cron diario.'
                      : 'Ninguna oportunidad coincide con el estado seleccionado.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detalle de documentos descargados para la oportunidad seleccionada */}
      <Dialog
        open={!!selectedOportunidad}
        onOpenChange={(v) => {
          if (!v) setSelectedOportunidad(null)
        }}
      >
        <DialogContent className='max-w-2xl max-h-[80vh] flex flex-col gap-0 p-0 overflow-hidden'>
          <DialogHeader className='shrink-0 border-b px-6 py-4'>
            <DialogTitle>Documentos — {selectedOportunidad?.referencia}</DialogTitle>
          </DialogHeader>
          <div className='flex-1 overflow-y-auto px-6 py-4 space-y-3'>
            <p className='text-sm text-muted-foreground truncate'>
              {selectedOportunidad?.titulo}
            </p>
            {documentosQ.isLoading ? (
              <Skeleton className='h-24 w-full' />
            ) : !documentosQ.data?.documentos.length ? (
              <p className='text-sm text-muted-foreground py-4'>
                No hay documentos descargados para esta oportunidad.
              </p>
            ) : (
              <ul className='space-y-2'>
                {documentosQ.data.documentos.map((d, i) => (
                  <li key={`${d.nombre_archivo}-${i}`} className='rounded border px-3 py-2 text-sm'>
                    <div className='flex items-center justify-between gap-2'>
                      <div className='flex items-center gap-2 min-w-0'>
                        <FileText className='h-4 w-4 shrink-0 text-muted-foreground' />
                        <span className='truncate'>{d.nombre_archivo}</span>
                      </div>
                      <Badge variant={DOC_ESTADO_VARIANT[d.estado]} className='shrink-0'>
                        {d.estado === 'ok' ? 'Descargado' : 'Error'}
                      </Badge>
                    </div>
                    <div className='mt-1 text-xs text-muted-foreground'>
                      {d.tipo_documento || 'Sin tipo'}
                    </div>
                    {d.estado === 'error' && d.mensaje_error && (
                      <p className='mt-1 text-xs text-destructive'>{d.mensaje_error}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
