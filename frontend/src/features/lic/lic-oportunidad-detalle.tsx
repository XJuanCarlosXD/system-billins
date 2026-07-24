// Pagina de detalle de una oportunidad (reemplaza el modal): orden fijo
// 1. Descripcion, 2. Requisitos, 3. Productos/servicios (+ documentos
// faltantes), 4. Documentos de la licitacion con descarga.
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ArrowLeft, Download, FileText, Sparkles, Wand2 } from 'lucide-react'
import { useCompany } from '@/hooks/use-company'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  type Documento,
  type DocumentoFaltante,
  type Oportunidad,
  type Producto,
  type RecomendacionPrecioProducto,
  type Requisito,
  documentoDescargarUrl,
  useAnalizarOportunidad,
  useConfirmarEnvioOferta,
  useDocumentos,
  useGenerarResumenDocumento,
  useOfertaJobStatus,
  useOportunidades,
  usePrepararOferta,
  useProductos,
  useRecomendarPrecios,
  useRequisitos,
} from './api'

const CUMPLIMIENTO_INFO: Record<
  'verde' | 'amarillo' | 'rojo',
  { color: string; label: string; corto: string }
> = {
  verde: { color: 'bg-green-500', label: 'Cumple los requisitos evaluados', corto: 'Aplica' },
  amarillo: { color: 'bg-yellow-500', label: 'Cumple parcialmente', corto: 'Parcial' },
  rojo: { color: 'bg-red-500', label: 'No cumple / faltan documentos', corto: 'No aplica' },
}

const REQUISITO_ESTADO_INFO: Record<Requisito['estado'], { color: string; label: string }> = {
  cumple: { color: 'bg-green-500', label: 'Cumple' },
  parcial: { color: 'bg-yellow-500', label: 'Parcial' },
  no_cumple: { color: 'bg-red-500', label: 'No cumple' },
  sin_evaluar: { color: 'bg-muted-foreground/30', label: 'Sin evaluar' },
}

const DOC_ESTADO_VARIANT: Record<'ok' | 'error', 'default' | 'destructive'> = {
  ok: 'default',
  error: 'destructive',
}

export function LicOportunidadDetalle({ oportunidadId }: { oportunidadId: number }) {
  const { selectedCompany } = useCompany()
  const { data, isLoading } = useOportunidades(selectedCompany, undefined, true)
  const oportunidad = data?.oportunidades.find((o) => o.id === oportunidadId) ?? null

  if (isLoading) return <Skeleton className='h-96 w-full' />
  if (!oportunidad) {
    return (
      <div className='space-y-3'>
        <VolverLink />
        <p className='text-sm text-muted-foreground'>
          Oportunidad no encontrada para la empresa {selectedCompany}.
        </p>
      </div>
    )
  }

  return (
    <div className='space-y-5'>
      <VolverLink />

      <div>
        <h3 className='font-mono text-sm text-muted-foreground'>{oportunidad.referencia}</h3>
        <h2 className='text-lg font-semibold'>{oportunidad.titulo}</h2>
        <p className='text-sm text-muted-foreground'>{oportunidad.entidad}</p>
      </div>

      <SeccionDescripcion oportunidad={oportunidad} />
      <SeccionRequisitos oportunidad={oportunidad} />
      <SeccionProductos oportunidad={oportunidad} />
      <SeccionDocumentos oportunidadId={oportunidad.id} />
    </div>
  )
}

function VolverLink() {
  return (
    <Link
      to='/lic/oportunidades'
      className='inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground'
    >
      <ArrowLeft className='h-4 w-4' />
      Volver a Oportunidades
    </Link>
  )
}

// 1. Descripcion
function SeccionDescripcion({ oportunidad }: { oportunidad: Oportunidad }) {
  const analizar = useAnalizarOportunidad()
  const resumen = analizar.data?.resumen ?? oportunidad.resumen_ia
  const recomendacion = analizar.data?.recomendacion ?? oportunidad.recomendacion_ia
  const estadoCumplimiento = analizar.data?.estado_cumplimiento ?? oportunidad.estado_cumplimiento

  return (
    <section className='space-y-3 rounded-md border p-4'>
      <div className='flex items-center justify-between gap-2'>
        <div className='flex items-center gap-2'>
          {estadoCumplimiento && (
            <span
              title={CUMPLIMIENTO_INFO[estadoCumplimiento].label}
              className={`inline-block h-2.5 w-2.5 rounded-full ${CUMPLIMIENTO_INFO[estadoCumplimiento].color}`}
            />
          )}
          <h4 className='text-sm font-semibold'>1. Descripción</h4>
          {oportunidad.modalidad_entrega && (
            <Badge
              variant={oportunidad.modalidad_entrega === 'fisica' ? 'destructive' : 'outline'}
              title='Modalidad de entrega de la oferta/documentación según el proceso'
            >
              {oportunidad.modalidad_entrega === 'fisica' && 'Entrega física requerida'}
              {oportunidad.modalidad_entrega === 'virtual' && 'Entrega virtual'}
              {oportunidad.modalidad_entrega === 'ambas' && 'Física o virtual'}
            </Badge>
          )}
        </div>
        <Button
          type='button'
          size='sm'
          variant='outline'
          className='gap-1.5'
          disabled={analizar.isPending}
          onClick={() =>
            analizar.mutate(oportunidad.id, { onError: (e) => toast.error(e.message) })
          }
        >
          <Wand2 className='h-3.5 w-3.5' />
          {analizar.isPending ? 'Analizando…' : resumen ? 'Volver a analizar' : 'Analizar oportunidad'}
        </Button>
      </div>

      <div className='flex flex-wrap gap-4 text-sm'>
        {oportunidad.unidad_requisicion && (
          <span><span className='text-muted-foreground'>Unidad de requisición: </span>{oportunidad.unidad_requisicion}</span>
        )}
        {oportunidad.presupuesto_estimado && (
          <span><span className='text-muted-foreground'>Presupuesto estimado: </span>{oportunidad.presupuesto_estimado}</span>
        )}
        {oportunidad.fecha_limite && (
          <span><span className='text-muted-foreground'>Fecha límite: </span>{String(oportunidad.fecha_limite).slice(0, 10)}</span>
        )}
      </div>

      {resumen && <p className='whitespace-pre-wrap text-sm'>{resumen}</p>}
      {recomendacion && (
        <p className='rounded bg-muted/50 px-3 py-2 text-sm'>
          <span className='font-medium'>Recomendación: </span>{recomendacion}
        </p>
      )}
      {!resumen && !analizar.isPending && (
        <p className='text-xs text-muted-foreground'>
          Genera un resumen de la licitación, extrae los requisitos para participar y
          evalúa cuáles cumple la empresa según los documentos subidos en Configuración.
        </p>
      )}
    </section>
  )
}

// 2. Requisitos
function SeccionRequisitos({ oportunidad }: { oportunidad: Oportunidad }) {
  const analizar = useAnalizarOportunidad()
  const requisitosQ = useRequisitos(oportunidad.id)
  const requisitos = analizar.data?.requisitos ?? requisitosQ.data?.requisitos ?? []

  return (
    <section className='space-y-2 rounded-md border p-4'>
      <h4 className='text-sm font-semibold'>2. Requisitos</h4>
      {requisitos.length === 0 ? (
        <p className='text-sm text-muted-foreground'>
          Sin requisitos evaluados todavía. Use "Analizar oportunidad" arriba.
        </p>
      ) : (
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
                  <TableCell className='text-xs text-muted-foreground'>{r.justificacion}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}

// 3. Productos/servicios (del scraper, sin IA) + recomendar precio en BATCH (una sola
//    llamada de IA para todos, bajo demanda) + documentos faltantes (codigo puro)
function SeccionProductos({ oportunidad }: { oportunidad: Oportunidad }) {
  const productosQ = useProductos(oportunidad.id)
  const recomendar = useRecomendarPrecios()
  const productos = productosQ.data?.productos ?? []
  const faltantes: DocumentoFaltante[] = oportunidad.documentos_faltantes ?? []
  const recomendaciones = recomendar.data?.recomendaciones ?? []
  const porProducto = new Map(recomendaciones.map((r) => [r.producto_id, r]))

  return (
    <section className='space-y-3 rounded-md border p-4'>
      <div className='flex items-center justify-between gap-2'>
        <h4 className='text-sm font-semibold'>3. Productos/servicios</h4>
        {productos.length > 0 && (
          <Button
            type='button'
            size='sm'
            variant='outline'
            className='gap-1.5'
            disabled={recomendar.isPending}
            onClick={() =>
              recomendar.mutate(oportunidad.id, { onError: (e) => toast.error(e.message) })
            }
          >
            <Sparkles className='h-3.5 w-3.5' />
            {recomendar.isPending ? 'Recomendando precios…' : 'Recomendar precios'}
          </Button>
        )}
      </div>
      {productosQ.isLoading ? (
        <Skeleton className='h-16 w-full' />
      ) : productos.length === 0 ? (
        <p className='text-sm text-muted-foreground'>
          El scraper no encontró productos/servicios estructurados para esta licitación.
        </p>
      ) : (
        <ul className='space-y-2'>
          {productos.map((p) => (
            <ProductoItem key={p.id} producto={p} recomendacion={porProducto.get(p.id)} />
          ))}
        </ul>
      )}

      {faltantes.length > 0 && (
        <div className='space-y-1.5 rounded border border-destructive/30 bg-destructive/5 p-3'>
          <p className='text-sm font-medium'>Documentos faltantes</p>
          <ul className='space-y-1 text-sm'>
            {faltantes.map((f) => (
              <li key={f.tipo_documento} className='flex items-center gap-2'>
                <Badge variant='destructive' className='shrink-0'>{f.motivo}</Badge>
                {f.tipo_documento}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function ProductoItem({
  producto: p,
  recomendacion,
}: {
  producto: Producto
  recomendacion: RecomendacionPrecioProducto | undefined
}) {
  return (
    <li className='rounded border px-3 py-2 text-sm'>
      <span>
        {p.descripcion}
        {p.cantidad && <span className='ml-1.5 text-xs text-muted-foreground'>(cant. {p.cantidad})</span>}
      </span>
      {recomendacion && (
        <div className='mt-2 space-y-1 rounded bg-muted/50 px-2 py-1.5 text-xs'>
          <p>
            <span className='font-medium'>Precio sugerido: </span>
            {recomendacion.precio_sugerido ?? 'Sin suficiente historial'}
          </p>
          <p className='text-muted-foreground'>{recomendacion.justificacion}</p>
          {recomendacion.historial.length > 0 && (
            <ul className='text-muted-foreground'>
              {recomendacion.historial.slice(0, 5).map((h, i) => (
                <li key={i}>
                  {h.descripcion} — {h.precio} ({String(h.fecha).slice(0, 10)})
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  )
}

// 4. Documentos de la licitacion
function SeccionDocumentos({ oportunidadId }: { oportunidadId: number }) {
  const documentosQ = useDocumentos(oportunidadId)
  const prepararOferta = usePrepararOferta()
  const [jobId, setJobId] = useState<number | null>(null)
  const { data: jobStatus } = useOfertaJobStatus(jobId)
  const confirmarEnvio = useConfirmarEnvioOferta()
  const [confirmarAbierto, setConfirmarAbierto] = useState(false)

  return (
    <section className='space-y-2 rounded-md border p-4'>
      <div className='flex items-center justify-between gap-2'>
        <h4 className='text-sm font-semibold'>4. Documentos de la licitación</h4>
        <Button
          type='button'
          size='sm'
          variant='outline'
          disabled={prepararOferta.isPending || jobStatus?.estado === 'corriendo'}
          onClick={() =>
            prepararOferta.mutate(oportunidadId, {
              onSuccess: (r) => setJobId(r.job_id),
              onError: (e) => toast.error(e.message),
            })
          }
        >
          {jobStatus?.estado === 'corriendo' ? 'Preparando oferta…' : 'Preparar oferta'}
        </Button>
      </div>

      {jobStatus && jobStatus.estado !== 'corriendo' && (
        <div className='rounded border p-3 text-sm space-y-2'>
          {jobStatus.estado === 'error' && (
            <p className='text-destructive'>Error: {jobStatus.resumen.error}</p>
          )}
          {jobStatus.resumen.documentos_faltantes && jobStatus.resumen.documentos_faltantes.length > 0 && (
            <div>
              <p className='font-medium text-destructive'>Documentos faltantes:</p>
              <ul className='list-disc pl-5'>
                {jobStatus.resumen.documentos_faltantes.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}
          {jobStatus.estado === 'listo_para_enviar' && (
            <Button type='button' size='sm' variant='destructive' onClick={() => setConfirmarAbierto(true)}>
              Confirmar y enviar oferta
            </Button>
          )}
          {jobStatus.estado === 'enviado' && (
            <p className='font-medium text-green-600'>Oferta enviada.</p>
          )}
        </div>
      )}

      <Dialog open={confirmarAbierto} onOpenChange={setConfirmarAbierto}>
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>Confirmar envío de oferta</DialogTitle>
            <DialogDescription>
              Esto somete una oferta vinculante ante el portal DGCP. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='ghost' onClick={() => setConfirmarAbierto(false)}>Cancelar</Button>
            <Button
              variant='destructive'
              disabled={confirmarEnvio.isPending}
              onClick={() =>
                confirmarEnvio.mutate(oportunidadId, {
                  onSuccess: () => setConfirmarAbierto(false),
                  onError: (e) => toast.error(e.message),
                })
              }
            >
              {confirmarEnvio.isPending ? 'Enviando…' : 'Sí, enviar oferta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {documentosQ.isLoading ? (
        <Skeleton className='h-24 w-full' />
      ) : !documentosQ.data?.documentos.length ? (
        <p className='text-sm text-muted-foreground py-2'>
          No hay documentos descargados para esta oportunidad.
        </p>
      ) : (
        <ul className='space-y-2'>
          {documentosQ.data.documentos.map((d) => (
            <DocumentoItem key={d.id} documento={d} />
          ))}
        </ul>
      )}
    </section>
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
        <div className='flex items-center gap-1 shrink-0'>
          <Badge variant={DOC_ESTADO_VARIANT[d.estado]}>
            {d.estado === 'ok' ? 'Descargado' : 'Error'}
          </Badge>
          {d.estado === 'ok' && (
            <Button size='sm' variant='ghost' asChild title='Descargar'>
              <a href={documentoDescargarUrl(d.id)} target='_blank' rel='noreferrer'>
                <Download className='h-4 w-4' />
              </a>
            </Button>
          )}
        </div>
      </div>
      <div className='mt-1 text-xs text-muted-foreground'>{d.tipo_documento || 'Sin tipo'}</div>
      {d.estado === 'error' && d.mensaje_error && (
        <p className='mt-1 text-xs text-destructive'>{d.mensaje_error}</p>
      )}
      {d.estado === 'ok' && (
        <div className='mt-2'>
          {d.resumen_ia ? (
            <p className='whitespace-pre-wrap rounded bg-muted/50 px-2 py-1.5 text-xs'>{d.resumen_ia}</p>
          ) : (
            <Button
              type='button'
              size='sm'
              variant='ghost'
              className='h-7 gap-1.5 px-2 text-xs'
              disabled={generarResumen.isPending}
              onClick={() =>
                generarResumen.mutate(d.id, { onError: (e) => toast.error(e.message) })
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
