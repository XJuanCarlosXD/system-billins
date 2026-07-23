// Oportunidades descubiertas en el portal DGCP para la empresa activa: tabla filtrable
// por estado_portal + botón "Buscar ahora" que dispara un ScrapeJob y hace polling en
// vivo de su estado. Módulo nuevo del clon (no hay pantalla legacy Oracle Forms).
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Eye,
  FileText,
  Loader2,
  Search,
  Settings,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { useCompany } from '@/hooks/use-company'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type Documento,
  LicApiError,
  type Oportunidad,
  type Requisito,
  useAnalizarOportunidad,
  useBuscarAhora,
  useDocumentos,
  useGenerarResumenDocumento,
  useOportunidades,
  useRequisitos,
  useScrapeJobStatus,
} from './api'

const TODOS = 'Todos'

function formatDate(s: string | null): string {
  return s ? String(s).slice(0, 10) : ''
}

const CUMPLIMIENTO_INFO: Record<
  'verde' | 'amarillo' | 'rojo',
  { color: string; label: string; corto: string }
> = {
  verde: {
    color: 'bg-green-500',
    label: 'Cumple los requisitos evaluados',
    corto: 'Aplica',
  },
  amarillo: {
    color: 'bg-yellow-500',
    label: 'Cumple parcialmente',
    corto: 'Parcial',
  },
  rojo: {
    color: 'bg-red-500',
    label: 'No cumple / faltan documentos',
    corto: 'No aplica',
  },
}

function CumplimientoDot({
  estado,
}: {
  estado: 'verde' | 'amarillo' | 'rojo' | null
}) {
  if (!estado) {
    return (
      <span
        title='Sin analizar todavía'
        className='inline-block h-2.5 w-2.5 rounded-full bg-muted-foreground/30'
      />
    )
  }
  const info = CUMPLIMIENTO_INFO[estado]
  return (
    <span
      title={info.label}
      className={`inline-block h-2.5 w-2.5 rounded-full ${info.color}`}
    />
  )
}

const REQUISITO_ESTADO_INFO: Record<
  Requisito['estado'],
  { color: string; label: string }
> = {
  cumple: { color: 'bg-green-500', label: 'Cumple' },
  parcial: { color: 'bg-yellow-500', label: 'Parcial' },
  no_cumple: { color: 'bg-red-500', label: 'No cumple' },
  sin_evaluar: { color: 'bg-muted-foreground/30', label: 'Sin evaluar' },
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
  // Parámetro de búsqueda configurable vía el botón de ajustes: por defecto el
  // backend solo trae oportunidades cuya fecha límite no ha pasado
  // (fecha_limite >= hoy, ver lic_repo.list_oportunidades) -- activar "todas"
  // agrega también el historial de procesos ya cerrados/adjudicados.
  const [todas, setTodas] = useState(false)
  // El guardia de concurrencia del backend (scrape_view) es POR no_cia: jobs para
  // empresas distintas corren en paralelo sin bloquearse (solo un job "todas las
  // empresas" bloquea a todos). Por eso el job en curso se rastrea junto con la
  // empresa para la que se lanzó, no como un simple jobId -- así "Buscar ahora" para
  // la empresa B nunca queda deshabilitado por un job de la empresa A, y los
  // toasts/refetch de finalización solo aplican mientras se está viendo la empresa
  // dueña de ese job (ver gating de `esJobDeEstaEmpresa` más abajo).
  const [job, setJob] = useState<{ jobId: number; company: string } | null>(null)
  const [selectedOportunidad, setSelectedOportunidad] = useState<Oportunidad | null>(null)

  const { data, isLoading, refetch } = useOportunidades(selectedCompany, undefined, todas)
  const buscarAhora = useBuscarAhora()
  const { data: jobStatus } = useScrapeJobStatus(job?.jobId ?? null)
  const documentosQ = useDocumentos(selectedOportunidad?.id ?? null)
  const esJobDeEstaEmpresa = job?.company === selectedCompany

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
  //
  // También se guarda contra el job aquí gatillado por una empresa DISTINTA a la que
  // se está viendo ahora mismo (`esJobDeEstaEmpresa`): sin ese guardia, terminar un job
  // de la empresa A mientras el usuario ya cambió a la empresa B refrescaría/mostraría
  // el toast de A encima de los datos de B -- y al marcar el ref como "manejado" nunca
  // se le mostraría ese resultado al volver a A. El guardia hace que el efecto no toque
  // el ref en absoluto mientras la empresa no coincide, así que el toast/refetch de A
  // sigue pendiente y se dispara correctamente si el usuario vuelve a seleccionar A.
  const lastHandledJobRef = useRef<number | null>(null)
  useEffect(() => {
    if (!job || !esJobDeEstaEmpresa || !jobStatus || jobStatus.estado === 'corriendo') return
    if (lastHandledJobRef.current === job.jobId) return
    lastHandledJobRef.current = job.jobId

    if (jobStatus.estado === 'completado') {
      refetch()
      toast.success(
        `Búsqueda completada: ${jobStatus.resumen.oportunidades_nuevas} oportunidad(es) nueva(s), ` +
          `${jobStatus.resumen.documentos_descargados} documento(s) descargado(s)`
      )
    } else if (jobStatus.estado === 'completado_con_errores') {
      refetch()
      toast.warning(
        `Búsqueda completada con ${jobStatus.resumen.errores.length} error(es). ` +
          `${jobStatus.resumen.oportunidades_nuevas} oportunidad(es) nueva(s).`
      )
    } else if (jobStatus.estado === 'error') {
      // No se refresca la lista: un job en "error" no llegó a modificar datos (ver
      // `_ejecutar_scrape_seguro` en views.py -- se marca error antes de escribir
      // ningún resumen), así que no hay nada nuevo que traer del backend.
      toast.error('La búsqueda terminó con error. Intente de nuevo más tarde.')
    }
  }, [job, esJobDeEstaEmpresa, jobStatus, refetch])

  const buscando = esJobDeEstaEmpresa && jobStatus?.estado === 'corriendo'

  const handleBuscarAhora = () => {
    const company = selectedCompany
    buscarAhora.mutate(company, {
      onSuccess: (res) => {
        setJob({ jobId: res.job_id, company })
        toast.info('Búsqueda iniciada en el portal DGCP')
      },
      onError: (e) => {
        // Bug #2 del reference: un 409 de la guardia de concurrencia (Task 10) trae
        // job_id del job que YA está corriendo -- en vez de un error sin salida, se
        // engancha el polling a ESE job para mostrar su progreso en tiempo real. Ese
        // job en curso cubre `company` (el guardia solo lo devuelve cuando coincide con
        // esa empresa o es un job de "todas las empresas"), así que asociarlo a
        // `company` aquí es correcto para el gating de arriba.
        if (e instanceof LicApiError && e.job_id) {
          setJob({ jobId: e.job_id, company })
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
          {/* Pocos valores distintos en la práctica (derivados de los datos reales,
              no un enum fijo) -- botones en línea en vez de un dropdown que hay que
              abrir para ver las opciones. */}
          <div className='flex flex-wrap gap-1.5'>
            <Button
              type='button'
              size='sm'
              variant={estado === TODOS ? 'default' : 'outline'}
              onClick={() => setEstado(TODOS)}
            >
              Todos
            </Button>
            {estadosDisponibles.map((e) => (
              <Button
                key={e}
                type='button'
                size='sm'
                variant={estado === e ? 'default' : 'outline'}
                onClick={() => setEstado(e)}
              >
                {e}
              </Button>
            ))}
          </div>
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

        <Popover>
          <PopoverTrigger asChild>
            <Button type='button' variant='outline' size='icon' title='Configurar búsqueda'>
              <Settings className='h-4 w-4' />
            </Button>
          </PopoverTrigger>
          <PopoverContent className='w-72 space-y-3' align='start'>
            <div>
              <p className='text-sm font-medium'>Parámetros de búsqueda</p>
              <p className='text-xs text-muted-foreground'>
                Ajustan qué se muestra de lo ya encontrado, no lo que el scraper
                busca en el portal.
              </p>
            </div>
            <div className='flex items-center justify-between gap-3'>
              <Label htmlFor='lic-todas' className='text-sm font-normal'>
                Incluir cerradas/vencidas
              </Label>
              <Switch id='lic-todas' checked={todas} onCheckedChange={setTodas} />
            </div>
          </PopoverContent>
        </Popover>

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
                <TableHead className='w-24' title='¿Aplica según el análisis de IA?'>
                  Requisitos
                </TableHead>
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
                  <TableCell>
                    <span className='flex items-center gap-1.5 text-xs'>
                      <CumplimientoDot estado={o.estado_cumplimiento} />
                      {o.estado_cumplimiento
                        ? CUMPLIMIENTO_INFO[o.estado_cumplimiento].corto
                        : 'Sin analizar'}
                    </span>
                  </TableCell>
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
                  <TableCell colSpan={8} className='text-center text-muted-foreground py-6'>
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
        <DialogContent className='max-w-3xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden'>
          <DialogHeader className='shrink-0 border-b px-6 py-4'>
            <DialogTitle>{selectedOportunidad?.referencia}</DialogTitle>
            <DialogDescription>{selectedOportunidad?.titulo}</DialogDescription>
          </DialogHeader>
          <div className='flex-1 overflow-y-auto px-6 py-4 space-y-5'>
            {selectedOportunidad?.unidad_requisicion || selectedOportunidad?.presupuesto_estimado ? (
              <div className='flex flex-wrap gap-4 text-sm'>
                {selectedOportunidad.unidad_requisicion && (
                  <span>
                    <span className='text-muted-foreground'>Unidad de requisición: </span>
                    {selectedOportunidad.unidad_requisicion}
                  </span>
                )}
                {selectedOportunidad.presupuesto_estimado && (
                  <span>
                    <span className='text-muted-foreground'>Presupuesto estimado: </span>
                    {selectedOportunidad.presupuesto_estimado}
                  </span>
                )}
              </div>
            ) : null}

            {selectedOportunidad && <AnalisisSeccion oportunidad={selectedOportunidad} />}

            <div className='space-y-2'>
              <h4 className='text-sm font-semibold'>Documentos descargados del portal</h4>
              {documentosQ.isLoading ? (
                <Skeleton className='h-24 w-full' />
              ) : !documentosQ.data?.documentos.length ? (
                <p className='text-sm text-muted-foreground py-4'>
                  No hay documentos descargados para esta oportunidad.
                </p>
              ) : (
                <ul className='space-y-2'>
                  {documentosQ.data.documentos.map((d) => (
                    <DocumentoItem key={d.id} documento={d} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AnalisisSeccion({ oportunidad }: { oportunidad: Oportunidad }) {
  const analizar = useAnalizarOportunidad()
  const requisitosQ = useRequisitos(oportunidad.id)
  // El backend devuelve el resumen/recomendación ya guardados en la propia
  // oportunidad (Task de análisis actualiza TLIC_OPORTUNIDAD); el resultado
  // de la última mutación exitosa se usa mientras tanto para no esperar el
  // refetch de la lista completa.
  const resumen = analizar.data?.resumen ?? oportunidad.resumen_ia
  const recomendacion = analizar.data?.recomendacion ?? oportunidad.recomendacion_ia
  const estadoCumplimiento = analizar.data?.estado_cumplimiento ?? oportunidad.estado_cumplimiento
  const requisitos = analizar.data?.requisitos ?? requisitosQ.data?.requisitos ?? []

  // El análisis (resumen, requisitos, evaluación) NO se dispara acá al
  // abrir el detalle -- eso implicaría una llamada a la IA en vivo cada vez
  // que alguien mira una oportunidad, con el usuario esperando. Ya viene
  // pre-calculado por el scraper apenas descubre la oportunidad (ver
  // `_analizar_y_registrar` en `orchestrator.py`), así que lo que se ve acá
  // es lo que ya está guardado en `oportunidad.resumen_ia`/etc. Este botón
  // es solo para volver a correrlo a mano cuando haga falta (ej. después de
  // subir un documento nuevo de la empresa).

  return (
    <div className='space-y-3 rounded-md border p-3'>
      <div className='flex items-center justify-between gap-2'>
        <div className='flex items-center gap-2'>
          <CumplimientoDot estado={estadoCumplimiento} />
          <h4 className='text-sm font-semibold'>Análisis con IA</h4>
        </div>
        <Button
          type='button'
          size='sm'
          variant='outline'
          className='gap-1.5'
          disabled={analizar.isPending}
          onClick={() =>
            analizar.mutate(oportunidad.id, {
              onError: (e) => toast.error(e.message),
            })
          }
        >
          <Wand2 className='h-3.5 w-3.5' />
          {analizar.isPending
            ? 'Analizando…'
            : resumen
              ? 'Volver a analizar'
              : 'Analizar oportunidad'}
        </Button>
      </div>

      {!resumen && !analizar.isPending && (
        <p className='text-xs text-muted-foreground'>
          Genera un resumen de la licitación, extrae los requisitos para
          participar y evalúa cuáles cumple la empresa según los documentos
          subidos en Configuración.
        </p>
      )}

      {resumen && (
        <p className='whitespace-pre-wrap text-sm'>{resumen}</p>
      )}

      {recomendacion && (
        <p className='rounded bg-muted/50 px-3 py-2 text-sm'>
          <span className='font-medium'>Recomendación: </span>
          {recomendacion}
        </p>
      )}

      {requisitos.length > 0 && (
        <div className='overflow-x-auto rounded border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-8' />
                <TableHead>Requisito</TableHead>
                <TableHead>Justificación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requisitos.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <span
                      title={REQUISITO_ESTADO_INFO[r.estado].label}
                      className={`inline-block h-2.5 w-2.5 rounded-full ${REQUISITO_ESTADO_INFO[r.estado].color}`}
                    />
                  </TableCell>
                  <TableCell className='text-sm'>{r.descripcion}</TableCell>
                  <TableCell className='text-xs text-muted-foreground'>
                    {r.justificacion}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function DocumentoItem({ documento: d }: { documento: Documento }) {
  const generarResumen = useGenerarResumenDocumento()

  return (
    <li className='rounded border px-3 py-2 text-sm'>
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

      {d.estado === 'ok' && (
        <div className='mt-2'>
          {d.resumen_ia ? (
            <p className='whitespace-pre-wrap rounded bg-muted/50 px-2 py-1.5 text-xs'>
              {d.resumen_ia}
            </p>
          ) : (
            <Button
              type='button'
              size='sm'
              variant='ghost'
              className='h-7 gap-1.5 px-2 text-xs'
              disabled={generarResumen.isPending}
              onClick={() =>
                generarResumen.mutate(d.id, {
                  onError: (e) => toast.error(e.message),
                })
              }
            >
              <Sparkles className='h-3.5 w-3.5' />
              {generarResumen.isPending ? 'Generando resumen…' : 'Generar resumen con IA'}
            </Button>
          )}
        </div>
      )}
    </li>
  )
}
