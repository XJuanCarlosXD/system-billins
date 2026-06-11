import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Eye, Plus, XCircle, Search, Printer } from 'lucide-react'

const fmt = (n: any) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })
const fmtDate = (s: any) => s ? String(s).slice(0, 10) : ''

export function AccDocumentos() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()
  const [filtros, setFiltros] = useState({ no_caja: '', fecha_desde: '', fecha_hasta: '', anulado: '' })
  const [selected, setSelected] = useState<any | null>(null)
  const [openNew, setOpenNew] = useState(false)
  const [openAnular, setOpenAnular] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [newDoc, setNewDoc] = useState<any>(null)

  const cajasQ = useQuery({ queryKey: ['acc-cajas-pick', selectedCompany, selectedPoint], queryFn: () => api.accListCajas(selectedCompany, selectedPoint) })
  const benesQ = useQuery({ queryKey: ['acc-bene-pick'], queryFn: () => api.accListBeneficiarios({ activo: 'S' }) })
  const tiposQ = useQuery({ queryKey: ['acc-gasto-pick'], queryFn: api.accListTiposGasto })

  const listQ = useQuery({
    queryKey: ['acc-documentos', selectedCompany, selectedPoint, filtros],
    queryFn: () => api.accListDocumentos({
      no_cia: selectedCompany, punto: selectedPoint,
      no_caja: filtros.no_caja || undefined,
      fecha_desde: filtros.fecha_desde || undefined,
      fecha_hasta: filtros.fecha_hasta || undefined,
      anulado: filtros.anulado || undefined,
      limit: 200,
    }),
  })

  const detalleQ = useQuery({
    enabled: !!selected,
    queryKey: ['acc-doc-detalle', selected?.no_docu],
    queryFn: () => api.accGetDocumento(selected.no_cia, selected.punto, selected.no_docu),
  })

  const crear = useMutation({
    mutationFn: () => api.accCrearDocumento(newDoc),
    onSuccess: (r) => {
      toast.success(`Documento ACC-${r.no_docu} creado`)
      qc.invalidateQueries({ queryKey: ['acc-documentos'] })
      setOpenNew(false); setNewDoc(null)
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'Error'),
  })

  const anular = useMutation({
    mutationFn: () => api.accAnularDocumento({ no_cia: selected.no_cia, punto: selected.punto, no_docu: selected.no_docu, motivo }),
    onSuccess: () => {
      toast.success('Documento anulado')
      qc.invalidateQueries({ queryKey: ['acc-documentos'] })
      setOpenAnular(false); setSelected(null); setMotivo('')
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'Error'),
  })

  const rows = listQ.data || []

  const openCrear = () => {
    const primeraCaja = cajasQ.data?.[0]
    setNewDoc({
      no_cia: selectedCompany, punto: selectedPoint,
      no_caja: primeraCaja?.no_caja || '', cuenta: primeraCaja?.cuenta || '',
      no_bene: '', tipo_gasto: '', cuenta_gasto: '', centro_costo: '0000000000',
      fecha: new Date().toISOString().slice(0, 10),
      valor: 0, impuesto: 0, detalle: '', moneda: 'DOP', forma_pago: 1,
    })
    setOpenNew(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Caja</Label>
          <Select value={filtros.no_caja || 'all'} onValueChange={(v) => setFiltros({ ...filtros, no_caja: v === 'all' ? '' : v })}>
            <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {cajasQ.data?.map((c: any) => <SelectItem key={c.no_caja} value={c.no_caja}>{c.no_caja} — {c.descripcion}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Desde</Label><Input type="date" className="w-40 h-9" value={filtros.fecha_desde} onChange={(e) => setFiltros({ ...filtros, fecha_desde: e.target.value })} /></div>
        <div><Label className="text-xs">Hasta</Label><Input type="date" className="w-40 h-9" value={filtros.fecha_hasta} onChange={(e) => setFiltros({ ...filtros, fecha_hasta: e.target.value })} /></div>
        <div>
          <Label className="text-xs">Estado</Label>
          <Select value={filtros.anulado || 'all'} onValueChange={(v) => setFiltros({ ...filtros, anulado: v === 'all' ? '' : v })}>
            <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="N">Activos</SelectItem>
              <SelectItem value="S">Anulados</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" variant="outline" onClick={() => listQ.refetch()}><Search className="h-4 w-4 mr-1" /> Buscar</Button>
        <Button size="sm" onClick={openCrear}><Plus className="h-4 w-4 mr-1" /> Nuevo Egreso</Button>
        <div className="ml-auto text-sm text-muted-foreground">{rows.length} documentos</div>
      </div>

      <div className="rounded border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No.</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Caja</TableHead>
              <TableHead>Beneficiario</TableHead>
              <TableHead>Tipo Gasto</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>NCF</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Ver</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((d: any) => (
              <TableRow key={d.no_docu}>
                <TableCell className="font-mono text-xs">ACC-{d.no_docu}</TableCell>
                <TableCell>{fmtDate(d.fecha)}</TableCell>
                <TableCell className="font-mono">{d.no_caja}</TableCell>
                <TableCell className="truncate max-w-[14rem]">{d.no_bene} — {d.nombre_bene}</TableCell>
                <TableCell className="text-xs">{d.desc_gasto}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(d.valor)}</TableCell>
                <TableCell className="text-xs font-mono">{d.ncf || ''}</TableCell>
                <TableCell>
                  {d.anulado === 'S'
                    ? <Badge variant="destructive">Anulado</Badge>
                    : <Badge variant={d.st_generado_cnt === 'S' ? 'outline' : 'secondary'}>{d.st_generado_cnt === 'S' ? 'Contabilizado' : 'Pendiente CNT'}</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => setSelected(d)}><Eye className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Sin documentos.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detalle */}
      <Dialog open={!!selected} onOpenChange={(v) => { if (!v) setSelected(null) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Egreso ACC-{selected?.no_docu}</DialogTitle></DialogHeader>
          {detalleQ.data && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Fecha:</span> {fmtDate(detalleQ.data.cabecera.fecha)}</div>
                <div><span className="text-muted-foreground">Caja:</span> {detalleQ.data.cabecera.no_caja}</div>
                <div><span className="text-muted-foreground">Beneficiario:</span> {detalleQ.data.cabecera.no_bene} — {detalleQ.data.cabecera.nombre_bene}</div>
                <div><span className="text-muted-foreground">Tipo Gasto:</span> {detalleQ.data.cabecera.desc_gasto}</div>
                <div><span className="text-muted-foreground">Valor:</span> RD$ {fmt(detalleQ.data.cabecera.valor)}</div>
                <div><span className="text-muted-foreground">Impuesto:</span> RD$ {fmt(detalleQ.data.cabecera.impuesto)}</div>
                <div><span className="text-muted-foreground">NCF:</span> {detalleQ.data.cabecera.ncf || '—'}</div>
                <div><span className="text-muted-foreground">RNC:</span> {detalleQ.data.cabecera.rnc || '—'}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Detalle:</span> {detalleQ.data.cabecera.detalle}</div>
              </div>
              <div className="rounded border">
                <Table>
                  <TableHeader><TableRow><TableHead>Cuenta</TableHead><TableHead>C/C</TableHead><TableHead>D/C</TableHead><TableHead className="text-right">Monto</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {detalleQ.data.lineas.map((l: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono">{l.cuenta}</TableCell>
                        <TableCell className="font-mono text-xs">{l.centro_costo}</TableCell>
                        <TableCell>{l.tipo_movi}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(l.monto)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          <DialogFooter>
            {selected && (
              <Button size="sm" variant="outline" onClick={() => {
                const qs = new URLSearchParams({ no_cia: selected.no_cia, punto: selected.punto }).toString()
                window.open(`/print/acc-documento/${encodeURIComponent(selected.no_docu)}?${qs}`, '_blank')
              }}>
                <Printer className="h-4 w-4 mr-1" /> Imprimir
              </Button>
            )}
            {selected && selected.anulado !== 'S' && (
              <Button size="sm" variant="destructive" onClick={() => setOpenAnular(true)}>
                <XCircle className="h-4 w-4 mr-1" /> Anular
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Anular */}
      <Dialog open={openAnular} onOpenChange={setOpenAnular}>
        <DialogContent>
          <DialogHeader><DialogTitle>Anular ACC-{selected?.no_docu}</DialogTitle></DialogHeader>
          <Label>Motivo</Label>
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAnular(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => anular.mutate()} disabled={!motivo || anular.isPending}>Anular</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nuevo */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Nuevo Egreso de Caja Chica</DialogTitle></DialogHeader>
          {newDoc && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Caja</Label>
                <Select value={newDoc.no_caja} onValueChange={(v) => {
                  const caja = cajasQ.data?.find((c: any) => c.no_caja === v)
                  setNewDoc({ ...newDoc, no_caja: v, cuenta: caja?.cuenta || newDoc.cuenta })
                }}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {cajasQ.data?.map((c: any) => <SelectItem key={c.no_caja} value={c.no_caja}>{c.no_caja} — {c.descripcion}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo Gasto</Label>
                <Select value={newDoc.tipo_gasto} onValueChange={(v) => {
                  const tg = tiposQ.data?.find((t: any) => t.tipo_gasto === v)
                  setNewDoc({ ...newDoc, tipo_gasto: v, cuenta_gasto: tg?.cuenta, centro_costo: tg?.centro_costo || '0000000000' })
                }}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {tiposQ.data?.filter((t: any) => t.activo === 'S').map((t: any) =>
                      <SelectItem key={t.tipo_gasto} value={t.tipo_gasto}>{t.tipo_gasto} — {t.descripcion}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Beneficiario</Label>
                <Select value={newDoc.no_bene} onValueChange={(v) => setNewDoc({ ...newDoc, no_bene: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {benesQ.data?.slice(0, 200).map((b: any) => <SelectItem key={b.no_bene} value={b.no_bene}>{b.no_bene} — {b.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Fecha</Label><Input type="date" value={newDoc.fecha} onChange={(e) => setNewDoc({ ...newDoc, fecha: e.target.value })} /></div>
              <div><Label>Valor</Label><Input type="number" value={newDoc.valor} onChange={(e) => setNewDoc({ ...newDoc, valor: Number(e.target.value) })} /></div>
              <div><Label>Impuesto</Label><Input type="number" value={newDoc.impuesto} onChange={(e) => setNewDoc({ ...newDoc, impuesto: Number(e.target.value) })} /></div>
              <div><Label>NCF</Label><Input value={newDoc.ncf || ''} onChange={(e) => setNewDoc({ ...newDoc, ncf: e.target.value })} /></div>
              <div><Label>RNC</Label><Input value={newDoc.rnc || ''} onChange={(e) => setNewDoc({ ...newDoc, rnc: e.target.value })} /></div>
              <div className="col-span-2"><Label>Detalle</Label><Input value={newDoc.detalle} onChange={(e) => setNewDoc({ ...newDoc, detalle: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>Cancelar</Button>
            <Button onClick={() => crear.mutate()} disabled={!newDoc?.no_caja || !newDoc?.tipo_gasto || !newDoc?.no_bene || newDoc?.valor <= 0 || crear.isPending}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
