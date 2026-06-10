import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, Search, Eye, CheckCircle2, XCircle, Lock } from 'lucide-react'

interface Orden {
  no_cia: string; punto: string; no_orden: string
  no_proveedor: string; nombre_proveedor: string; rnc: string
  fecha: string; fecha_entrega: string
  total_neto: number; impuesto: number; descuento: number; total_linea: number
  usuario: string; st_impresion: string; st_anulado: string; estado: string
  tipo_orden: string; plazo_pago: number; condicion_pago: string
  detalle: string; no_localidad: string; autorizada_por: string
}

// Dominio real del legado para TODC_ORDEN.estado: I/P/R.
// I = Inicial (creada sin proceso aún)
// P = Pendiente de recepción
// R = Recibida (cerrada)
const ESTADO_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  I: { label: 'Inicial', variant: 'secondary' },
  P: { label: 'Pendiente', variant: 'default' },
  R: { label: 'Recibida', variant: 'outline' },
}

function formatMoney(n: number | null | undefined) {
  return Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(s: string | null | undefined) {
  if (!s) return ''
  return s.slice(0, 10)
}

export function OdcOrdenes() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()
  const [filtros, setFiltros] = useState({
    estado: '',
    st_anulado: 'A',  // por defecto solo activas
    no_proveedor: '',
    fecha_desde: '',
    fecha_hasta: '',
  })
  const [selected, setSelected] = useState<Orden | null>(null)
  const [openAnular, setOpenAnular] = useState(false)
  const [motivo, setMotivo] = useState('')

  const ordenesQ = useQuery<Orden[]>({
    queryKey: ['odc-ordenes', selectedCompany, selectedPoint, filtros],
    queryFn: () => api.odcListOrdenes({
      no_cia: selectedCompany,
      punto: selectedPoint,
      estado: filtros.estado || undefined,
      st_anulado: filtros.st_anulado || undefined,
      no_proveedor: filtros.no_proveedor || undefined,
      fecha_desde: filtros.fecha_desde || undefined,
      fecha_hasta: filtros.fecha_hasta || undefined,
      limit: 200,
    }),
  })

  const detalleQ = useQuery({
    enabled: !!selected,
    queryKey: ['odc-orden-detalle', selected?.no_cia, selected?.punto, selected?.no_orden],
    queryFn: () => api.odcGetOrden(selected!.no_cia, selected!.punto, selected!.no_orden),
  })

  const autorizar = useMutation({
    mutationFn: (o: Orden) => api.odcAutorizarOrden({ no_cia: o.no_cia, punto: o.punto, no_orden: o.no_orden }),
    onSuccess: () => {
      toast.success('Orden autorizada')
      qc.invalidateQueries({ queryKey: ['odc-ordenes'] })
      setSelected(null)
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'Error al autorizar'),
  })

  const cerrar = useMutation({
    mutationFn: (o: Orden) => api.odcCerrarOrden({ no_cia: o.no_cia, punto: o.punto, no_orden: o.no_orden }),
    onSuccess: () => {
      toast.success('Orden cerrada')
      qc.invalidateQueries({ queryKey: ['odc-ordenes'] })
      setSelected(null)
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'Error al cerrar'),
  })

  const anular = useMutation({
    mutationFn: () => api.odcAnularOrden({
      no_cia: selected!.no_cia, punto: selected!.punto,
      no_orden: selected!.no_orden, motivo,
    }),
    onSuccess: () => {
      toast.success('Orden anulada')
      qc.invalidateQueries({ queryKey: ['odc-ordenes'] })
      setOpenAnular(false)
      setSelected(null)
      setMotivo('')
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'Error al anular'),
  })

  const rows = ordenesQ.data || []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Estado</Label>
          <Select value={filtros.estado || 'all'} onValueChange={(v) => setFiltros({ ...filtros, estado: v === 'all' ? '' : v })}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="I">Inicial</SelectItem>
              <SelectItem value="P">Pendiente</SelectItem>
              <SelectItem value="R">Recibida</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Anulación</Label>
          <Select value={filtros.st_anulado || 'all'} onValueChange={(v) => setFiltros({ ...filtros, st_anulado: v === 'all' ? '' : v })}>
            <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="A">Activas</SelectItem>
              <SelectItem value="N">Anuladas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Proveedor (cód.)</Label>
          <Input className="w-32 h-9" value={filtros.no_proveedor}
            onChange={(e) => setFiltros({ ...filtros, no_proveedor: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Desde</Label>
          <Input type="date" className="w-40 h-9" value={filtros.fecha_desde}
            onChange={(e) => setFiltros({ ...filtros, fecha_desde: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Hasta</Label>
          <Input type="date" className="w-40 h-9" value={filtros.fecha_hasta}
            onChange={(e) => setFiltros({ ...filtros, fecha_hasta: e.target.value })} />
        </div>
        <Button size="sm" variant="outline" onClick={() => ordenesQ.refetch()}>
          <Search className="h-4 w-4 mr-1" /> Buscar
        </Button>
        <div className="ml-auto text-sm text-muted-foreground">
          {rows.length} órden{rows.length !== 1 ? 'es' : ''}
        </div>
      </div>

      {ordenesQ.isLoading && (
        <div className="flex items-center gap-2 p-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando órdenes…
        </div>
      )}

      {!ordenesQ.isLoading && (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">No. Orden</TableHead>
                <TableHead className="w-28">Fecha</TableHead>
                <TableHead className="w-28">Proveedor</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead className="w-20 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((o) => (
                <TableRow key={`${o.no_cia}-${o.punto}-${o.no_orden}`}>
                  <TableCell className="font-mono text-xs">ODC-{o.no_orden}</TableCell>
                  <TableCell>{formatDate(o.fecha)}</TableCell>
                  <TableCell className="font-mono text-xs">{o.no_proveedor}</TableCell>
                  <TableCell className="truncate max-w-xs">{o.nombre_proveedor}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(o.total_neto)}</TableCell>
                  <TableCell>
                    {o.st_anulado === 'N'
                      ? <Badge variant="destructive">Anulada</Badge>
                      : <Badge variant={ESTADO_MAP[o.estado]?.variant || 'secondary'}>
                          {ESTADO_MAP[o.estado]?.label || o.estado}
                        </Badge>}
                  </TableCell>
                  <TableCell className="text-xs">{o.usuario}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setSelected(o)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                  Sin órdenes para el filtro actual.
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detalle */}
      <Dialog open={!!selected} onOpenChange={(v) => { if (!v) setSelected(null) }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Orden ODC-{selected?.no_orden}</DialogTitle>
          </DialogHeader>
          {detalleQ.isLoading && <div className="text-muted-foreground">Cargando…</div>}
          {detalleQ.data && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Proveedor:</span> {detalleQ.data.cabecera.no_proveedor} — {detalleQ.data.cabecera.nombre_proveedor}</div>
                <div><span className="text-muted-foreground">RNC:</span> {detalleQ.data.cabecera.rnc_proveedor}</div>
                <div><span className="text-muted-foreground">Fecha:</span> {formatDate(detalleQ.data.cabecera.fecha)}</div>
                <div><span className="text-muted-foreground">Entrega:</span> {formatDate(detalleQ.data.cabecera.fecha_entrega)}</div>
                <div><span className="text-muted-foreground">Condición pago:</span> {detalleQ.data.cabecera.condicion_pago || `${detalleQ.data.cabecera.plazo_pago || 0} días`}</div>
                <div><span className="text-muted-foreground">Tipo:</span> {detalleQ.data.cabecera.tipo_orden}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Detalle:</span> {detalleQ.data.cabecera.detalle}</div>
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
                        <TableCell className="truncate max-w-[20rem]">{l.descripcion_producto}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(l.cantidad_pedida)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(l.cantidad_recibida)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(l.costo)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(l.monto_neto)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="grid grid-cols-4 gap-3 pt-2 border-t">
                <div><span className="text-muted-foreground">Subtotal:</span> {formatMoney(detalleQ.data.cabecera.total_linea)}</div>
                <div><span className="text-muted-foreground">Descuento:</span> {formatMoney(detalleQ.data.cabecera.descuento)}</div>
                <div><span className="text-muted-foreground">ITBIS:</span> {formatMoney(detalleQ.data.cabecera.impuesto)}</div>
                <div className="font-semibold"><span className="text-muted-foreground">Total:</span> {formatMoney(detalleQ.data.cabecera.total_neto)}</div>
              </div>
            </div>
          )}
          <DialogFooter>
            {/* Autorizar: orden Pendiente todavía sin autorizar */}
            {selected && selected.st_anulado === 'A' && selected.estado === 'P' && !selected.autorizada_por && (
              <Button size="sm" onClick={() => autorizar.mutate(selected)} disabled={autorizar.isPending}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Autorizar
              </Button>
            )}
            {/* Cerrar (= Marcar Recibida): orden Pendiente ya autorizada */}
            {selected && selected.st_anulado === 'A' && selected.estado === 'P' && !!selected.autorizada_por && (
              <Button size="sm" variant="outline" onClick={() => cerrar.mutate(selected)} disabled={cerrar.isPending}>
                <Lock className="h-4 w-4 mr-1" /> Marcar Recibida
              </Button>
            )}
            {selected && selected.st_anulado === 'A' && (
              <Button size="sm" variant="destructive" onClick={() => setOpenAnular(true)}>
                <XCircle className="h-4 w-4 mr-1" /> Anular
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openAnular} onOpenChange={setOpenAnular}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular Orden ODC-{selected?.no_orden}</DialogTitle>
          </DialogHeader>
          <Label>Motivo</Label>
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo de anulación" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAnular(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => anular.mutate()} disabled={!motivo || anular.isPending}>
              Anular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
