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
import { Eye, CheckCircle2, XCircle, Lock, Loader2, Search, Printer } from 'lucide-react'

interface Requisicion {
  no_cia: string; punto: string; no_requisicion: string
  fecha: string; fecha_entrega: string
  usuario: string; procesado_almacen: string; st_anulado: string; estado: string
  tipo_requisicion: string; cerrada: string; st_impresion: string
  detalle: string; no_localidad: string; no_depto: string; consolidada: string
}

const ESTADO_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  P: { label: 'Pendiente', variant: 'secondary' },
  A: { label: 'Autorizada', variant: 'default' },
  C: { label: 'Cerrada', variant: 'outline' },
  N: { label: 'Anulada', variant: 'destructive' },
}

const formatDate = (s: string | null | undefined) => s ? s.slice(0, 10) : ''
const formatNum = (n: number | null | undefined) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })

export function OdcRequisiciones() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()
  const [filtros, setFiltros] = useState({ estado: '', fecha_desde: '', fecha_hasta: '' })
  const [selected, setSelected] = useState<Requisicion | null>(null)
  const [openAnular, setOpenAnular] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [slot, setSlot] = useState<number>(1)

  const listQ = useQuery<Requisicion[]>({
    queryKey: ['odc-requisiciones', selectedCompany, selectedPoint, filtros],
    queryFn: () => api.odcListRequisiciones({
      no_cia: selectedCompany,
      punto: selectedPoint,
      estado: filtros.estado || undefined,
      fecha_desde: filtros.fecha_desde || undefined,
      fecha_hasta: filtros.fecha_hasta || undefined,
      limit: 200,
    }),
  })

  const detalleQ = useQuery({
    enabled: !!selected,
    queryKey: ['odc-req-detalle', selected?.no_cia, selected?.punto, selected?.no_requisicion],
    queryFn: () => api.odcGetRequisicion(selected!.no_cia, selected!.punto, selected!.no_requisicion),
  })

  const autorizar = useMutation({
    mutationFn: () => api.odcAutorizarRequisicion({
      no_cia: selected!.no_cia, punto: selected!.punto,
      no_requisicion: selected!.no_requisicion, slot,
    }),
    onSuccess: () => {
      toast.success(`Requisición autorizada (slot ${slot})`)
      qc.invalidateQueries({ queryKey: ['odc-requisiciones'] })
      setSelected(null)
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'Error al autorizar'),
  })

  const cerrar = useMutation({
    mutationFn: (r: Requisicion) => api.odcCerrarRequisicion({
      no_cia: r.no_cia, punto: r.punto, no_requisicion: r.no_requisicion,
    }),
    onSuccess: () => {
      toast.success('Requisición cerrada')
      qc.invalidateQueries({ queryKey: ['odc-requisiciones'] })
      setSelected(null)
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'Error al cerrar'),
  })

  const anular = useMutation({
    mutationFn: () => api.odcAnularRequisicion({
      no_cia: selected!.no_cia, punto: selected!.punto,
      no_requisicion: selected!.no_requisicion, motivo,
    }),
    onSuccess: () => {
      toast.success('Requisición anulada')
      qc.invalidateQueries({ queryKey: ['odc-requisiciones'] })
      setOpenAnular(false); setSelected(null); setMotivo('')
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'Error al anular'),
  })

  const rows = listQ.data || []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Estado</Label>
          <Select value={filtros.estado || 'all'} onValueChange={(v) => setFiltros({ ...filtros, estado: v === 'all' ? '' : v })}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="P">Pendiente</SelectItem>
              <SelectItem value="A">Autorizada</SelectItem>
              <SelectItem value="C">Cerrada</SelectItem>
              <SelectItem value="N">Anulada</SelectItem>
            </SelectContent>
          </Select>
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
        <Button size="sm" variant="outline" onClick={() => listQ.refetch()}>
          <Search className="h-4 w-4 mr-1" /> Buscar
        </Button>
        <div className="ml-auto text-sm text-muted-foreground">
          {rows.length} requisic{rows.length !== 1 ? 'iones' : 'ión'}
        </div>
      </div>

      {listQ.isLoading && (
        <div className="flex items-center gap-2 p-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      )}

      {!listQ.isLoading && (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">No.</TableHead>
                <TableHead className="w-28">Fecha</TableHead>
                <TableHead className="w-28">Tipo</TableHead>
                <TableHead>Localidad</TableHead>
                <TableHead>Depto.</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead className="w-20 text-right">Ver</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={`${r.no_cia}-${r.punto}-${r.no_requisicion}`}>
                  <TableCell className="font-mono text-xs">REQ-{r.no_requisicion}</TableCell>
                  <TableCell>{formatDate(r.fecha)}</TableCell>
                  <TableCell>{r.tipo_requisicion}</TableCell>
                  <TableCell>{r.no_localidad}</TableCell>
                  <TableCell>{r.no_depto}</TableCell>
                  <TableCell>
                    {r.st_anulado === 'N'
                      ? <Badge variant="destructive">Anulada</Badge>
                      : <Badge variant={ESTADO_MAP[r.estado]?.variant || 'secondary'}>
                          {ESTADO_MAP[r.estado]?.label || r.estado}
                        </Badge>}
                  </TableCell>
                  <TableCell className="text-xs">{r.usuario}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setSelected(r)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                  Sin requisiciones.
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(v) => { if (!v) setSelected(null) }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Requisición REQ-{selected?.no_requisicion}</DialogTitle>
          </DialogHeader>
          {detalleQ.data && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <div><span className="text-muted-foreground">Fecha:</span> {formatDate(detalleQ.data.cabecera.fecha)}</div>
                <div><span className="text-muted-foreground">Tipo:</span> {detalleQ.data.cabecera.tipo_requisicion}</div>
                <div><span className="text-muted-foreground">Localidad:</span> {detalleQ.data.cabecera.no_localidad}</div>
                <div className="col-span-3"><span className="text-muted-foreground">Detalle:</span> {detalleQ.data.cabecera.detalle}</div>
                <div><span className="text-muted-foreground">Aut. 1:</span> {detalleQ.data.cabecera.autorizacion_1 || '—'}</div>
                <div><span className="text-muted-foreground">Aut. 2:</span> {detalleQ.data.cabecera.autorizacion_2 || '—'}</div>
                <div><span className="text-muted-foreground">Aut. 3:</span> {detalleQ.data.cabecera.autorizacion_3 || '—'}</div>
              </div>
              <div className="rounded border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Pedida</TableHead>
                      <TableHead className="text-right">Pendiente</TableHead>
                      <TableHead className="text-right">Autorizada</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalleQ.data.lineas.map((l: any) => (
                      <TableRow key={l.no_linea}>
                        <TableCell>{l.no_linea}</TableCell>
                        <TableCell className="font-mono text-xs">{l.no_produ}</TableCell>
                        <TableCell className="truncate max-w-[18rem]">{l.descripcion_producto}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNum(l.cantidad_pedida)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNum(l.cantidad_pendiente)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNum(l.cantidad_autorizada)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 items-center">
            {selected && (
              <Button size="sm" variant="outline" onClick={() => {
                const qs = new URLSearchParams({ no_cia: selected.no_cia, punto: selected.punto }).toString()
                window.open(`/print/requisicion-compra/${encodeURIComponent(selected.no_requisicion)}?${qs}`, '_blank')
              }}>
                <Printer className="h-4 w-4 mr-1" /> Imprimir
              </Button>
            )}
            {selected && selected.st_anulado === 'A' && selected.estado === 'P' && (
              <>
                <Label className="text-xs ml-2">Slot</Label>
                <Select value={String(slot)} onValueChange={(v) => setSlot(Number(v))}>
                  <SelectTrigger className="w-20 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={() => autorizar.mutate()} disabled={autorizar.isPending}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Autorizar
                </Button>
              </>
            )}
            {selected && selected.st_anulado === 'A' && selected.estado === 'A' && (
              <Button size="sm" variant="outline" onClick={() => cerrar.mutate(selected)} disabled={cerrar.isPending}>
                <Lock className="h-4 w-4 mr-1" /> Cerrar
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
            <DialogTitle>Anular Requisición REQ-{selected?.no_requisicion}</DialogTitle>
          </DialogHeader>
          <Label>Motivo</Label>
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo de anulación" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAnular(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => anular.mutate()} disabled={!motivo || anular.isPending}>Anular</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
