import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Lock, Printer, Search, X, Eye, CheckCircle2 } from 'lucide-react'

const fmt = (n: any) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (s: any) => s ? String(s).slice(0, 10) : ''

interface Orden {
  no_cia: string; punto: string; no_orden: string
  no_proveedor: string; nombre_proveedor: string; rnc: string
  fecha: string; fecha_entrega: string
  total_neto: number; usuario: string; detalle: string
  autorizada_por: string | null; tipo_orden: string
}

export function OdcRecibir() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()
  const [filtros, setFiltros] = useState({ search: '', fecha_desde: '', fecha_hasta: '' })
  const [selected, setSelected] = useState<Orden | null>(null)

  // Pendientes de recepción = estado='P' AND st_anulado='A' AND autorizada_por NOT NULL.
  const { data: dataRaw = [], isLoading } = useQuery<Orden[]>({
    queryKey: ['odc-pend-recibir', selectedCompany, selectedPoint, filtros.fecha_desde, filtros.fecha_hasta],
    queryFn: () => api.odcListOrdenes({
      no_cia: selectedCompany, punto: selectedPoint,
      estado: 'P', st_anulado: 'A',
      fecha_desde: filtros.fecha_desde || undefined,
      fecha_hasta: filtros.fecha_hasta || undefined,
      limit: 500,
    }),
  })

  const data = useMemo<Orden[]>(() => {
    const term = filtros.search.trim().toLowerCase()
    return dataRaw.filter((o: any) => {
      if (!o.autorizada_por) return false
      if (!term) return true
      const hay = `${o.no_orden} ${o.no_proveedor} ${o.nombre_proveedor || ''} ${o.rnc || ''} ${o.detalle || ''}`
        .toLowerCase()
      return hay.includes(term)
    })
  }, [dataRaw, filtros.search])

  const totalMonto = useMemo(
    () => data.reduce((acc, o) => acc + Number(o.total_neto || 0), 0),
    [data],
  )

  const detalleQ = useQuery({
    enabled: !!selected,
    queryKey: ['odc-detalle-recibir', selected?.no_cia, selected?.punto, selected?.no_orden],
    queryFn: () => api.odcGetOrden(selected!.no_cia, selected!.punto, selected!.no_orden),
  })

  const cerrar = useMutation({
    mutationFn: (o: Orden) => api.odcCerrarOrden({ no_cia: o.no_cia, punto: o.punto, no_orden: o.no_orden }),
    onSuccess: () => {
      toast.success(`Orden ODC-${selected?.no_orden} marcada como Recibida`)
      qc.invalidateQueries({ queryKey: ['odc-pend-recibir'] })
      qc.invalidateQueries({ queryKey: ['odc-ordenes'] })
      setSelected(null)
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'Error al marcar como recibida'),
  })

  const limpiar = () => setFiltros({ search: '', fecha_desde: '', fecha_hasta: '' })

  const verPdf = (o: Orden) => {
    const qs = new URLSearchParams({ no_cia: o.no_cia, punto: o.punto }).toString()
    window.open(`/print/orden-compra/${encodeURIComponent(o.no_orden)}?${qs}`, '_blank')
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Recibir mercancía de órdenes autorizadas</h3>
        <p className="text-sm text-muted-foreground">
          Sólo órdenes con estado <b>Pendiente</b>, activas y con autorización aprobada.
          Haz click en una fila para revisar el detalle y marcarla como recibida.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card><CardContent className="py-3">
          <div className="text-xs text-muted-foreground">Pendientes de recepción</div>
          <div className="text-2xl font-semibold">{dataRaw.filter((o: any) => !!o.autorizada_por).length}</div>
        </CardContent></Card>
        <Card><CardContent className="py-3">
          <div className="text-xs text-muted-foreground">Filtradas</div>
          <div className="text-2xl font-semibold">{data.length}</div>
        </CardContent></Card>
        <Card><CardContent className="py-3">
          <div className="text-xs text-muted-foreground">Monto en tránsito</div>
          <div className="text-xl font-semibold tabular-nums">RD$ {fmt(totalMonto)}</div>
        </CardContent></Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-2 rounded border bg-muted/30 px-3 py-2">
        <div className="grow max-w-md">
          <Label className="text-xs">Buscar (orden / proveedor / RNC / detalle)</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8 h-9" value={filtros.search}
              onChange={(e) => setFiltros({ ...filtros, search: e.target.value })}
              placeholder="Ej. INDISA, 000443, ODC-4170…" />
          </div>
        </div>
        <div>
          <Label className="text-xs">Desde</Label>
          <Input type="date" className="h-9 w-40" value={filtros.fecha_desde}
            onChange={(e) => setFiltros({ ...filtros, fecha_desde: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Hasta</Label>
          <Input type="date" className="h-9 w-40" value={filtros.fecha_hasta}
            onChange={(e) => setFiltros({ ...filtros, fecha_hasta: e.target.value })} />
        </div>
        <Button size="sm" variant="ghost" onClick={limpiar} className="h-9">
          <X className="h-4 w-4 mr-1" /> Limpiar
        </Button>
      </div>

      {/* Tabla */}
      {isLoading ? <Skeleton className="h-60 w-full" /> : (
        <div className="rounded border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Orden</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Autorizó</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((o) => (
                <TableRow
                  key={`${o.no_cia}-${o.punto}-${o.no_orden}`}
                  onClick={() => setSelected(o)}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <TableCell className="font-mono text-xs">ODC-{o.no_orden}</TableCell>
                  <TableCell>{fmtDate(o.fecha)}</TableCell>
                  <TableCell>{fmtDate(o.fecha_entrega)}</TableCell>
                  <TableCell className="truncate max-w-xs">
                    <span className="font-mono text-xs text-muted-foreground">{o.no_proveedor}</span>{' '}
                    {o.nombre_proveedor}
                    {o.rnc && <Badge variant="outline" className="ml-2 font-mono text-[10px]">{o.rnc}</Badge>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">
                      {o.tipo_orden === 'S' ? 'Servicios' : 'Inventariable'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{o.autorizada_por}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">RD$ {fmt(o.total_neto)}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => verPdf(o)} title="Ver PDF">
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setSelected(o)} title="Ver detalle">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && data.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  {dataRaw.filter((o: any) => !!o.autorizada_por).length === 0
                    ? 'No hay órdenes autorizadas pendientes de recepción.'
                    : 'Ninguna orden coincide con los filtros actuales.'}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modal de detalle / recepción */}
      <Dialog open={!!selected} onOpenChange={(v) => { if (!v) setSelected(null) }}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle>
              Recepción de Orden ODC-{selected?.no_orden}
              {selected?.nombre_proveedor && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  — {selected.nombre_proveedor}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {detalleQ.isLoading && <Skeleton className="h-40 w-full" />}
            {detalleQ.data && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div><span className="text-muted-foreground">Proveedor:</span> {detalleQ.data.cabecera.no_proveedor} — {detalleQ.data.cabecera.nombre_proveedor}</div>
                  <div><span className="text-muted-foreground">RNC:</span> {detalleQ.data.cabecera.rnc_proveedor || '—'}</div>
                  <div><span className="text-muted-foreground">Fecha emisión:</span> {fmtDate(detalleQ.data.cabecera.fecha)}</div>
                  <div><span className="text-muted-foreground">Fecha entrega:</span> {fmtDate(detalleQ.data.cabecera.fecha_entrega)}</div>
                  <div><span className="text-muted-foreground">Condición pago:</span> {detalleQ.data.cabecera.condicion_pago || `${detalleQ.data.cabecera.plazo_pago || 0} días`}</div>
                  <div><span className="text-muted-foreground">Autorizó:</span> {detalleQ.data.cabecera.autorizada_por}</div>
                  {detalleQ.data.cabecera.detalle && (
                    <div className="col-span-2 md:col-span-3">
                      <span className="text-muted-foreground">Observaciones:</span> {detalleQ.data.cabecera.detalle}
                    </div>
                  )}
                </div>
                <div className="rounded border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Pedida</TableHead>
                        <TableHead className="text-right">Recibida</TableHead>
                        <TableHead className="text-right">Costo</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detalleQ.data.lineas.map((l: any) => (
                        <TableRow key={l.no_linea}>
                          <TableCell>{l.no_linea}</TableCell>
                          <TableCell className="font-mono text-xs">{l.no_produ}</TableCell>
                          <TableCell className="truncate max-w-[18rem]">{l.descripcion_producto}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(l.cantidad_pedida)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(l.cantidad_recibida)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(l.costo)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(l.monto_neto)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t">
                  <div><span className="text-muted-foreground">Subtotal:</span> RD$ {fmt(detalleQ.data.cabecera.total_linea)}</div>
                  <div><span className="text-muted-foreground">Descuento:</span> RD$ {fmt(detalleQ.data.cabecera.descuento)}</div>
                  <div><span className="text-muted-foreground">ITBIS:</span> RD$ {fmt(detalleQ.data.cabecera.impuesto)}</div>
                  <div className="font-semibold"><span className="text-muted-foreground">Total:</span> RD$ {fmt(detalleQ.data.cabecera.total_neto)}</div>
                </div>
                <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Al marcar como recibida, la orden pasa a estado <b>Recibida</b> en una sola operación.
                  La captura por línea de cantidades parciales se entrega en el siguiente sprint.
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="shrink-0 border-t bg-background px-6 py-3 gap-2">
            {selected && (
              <Button size="sm" variant="outline" onClick={() => verPdf(selected)}>
                <Printer className="h-4 w-4 mr-1" /> Imprimir
              </Button>
            )}
            {selected && (
              <Button size="sm" onClick={() => cerrar.mutate(selected)} disabled={cerrar.isPending}>
                {cerrar.isPending
                  ? <><CheckCircle2 className="h-4 w-4 mr-1 animate-pulse" /> Recibiendo…</>
                  : <><Lock className="h-4 w-4 mr-1" /> Marcar Recibida</>}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
