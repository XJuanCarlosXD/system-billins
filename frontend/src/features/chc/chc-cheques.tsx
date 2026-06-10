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
import { Eye, XCircle, Truck, Link2, Search } from 'lucide-react'

const fmt = (n: any) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })
const fmtDate = (s: any) => s ? String(s).slice(0, 10) : ''

// Dominio real legado para TCHC_CHEQUE.status: A/C/N (no hay P).
//   A = Activo (vigente, sin conciliar)
//   C = Conciliado / Cobrado contra estado de cuenta
//   N = Nulo (anulado)
// st_nulo es independiente: A=Activo / N=Anulado (la inversa de FAT).
const STATUS_MAP: Record<string, { label: string; variant: any }> = {
  A: { label: 'Activo', variant: 'default' },
  C: { label: 'Conciliado', variant: 'outline' },
  N: { label: 'Anulado', variant: 'destructive' },
}

export function ChcCheques() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()
  const [filtros, setFiltros] = useState({ cuenta_banco: '', status: '', conciliado: '', entregado: '', fecha_desde: '', fecha_hasta: '' })
  const [selected, setSelected] = useState<any | null>(null)
  const [openAnular, setOpenAnular] = useState(false)
  const [motivo, setMotivo] = useState('')

  const cuentasQ = useQuery({ queryKey: ['chc-cuentas-pick', selectedCompany, selectedPoint], queryFn: () => api.chcListCuentas({ no_cia: selectedCompany, punto: selectedPoint, activa: 'S' }) })
  const listQ = useQuery({
    queryKey: ['chc-cheques', selectedCompany, selectedPoint, filtros],
    queryFn: () => api.chcListCheques({
      no_cia: selectedCompany, punto: selectedPoint,
      cuenta_banco: filtros.cuenta_banco || undefined,
      status: filtros.status || undefined,
      conciliado: filtros.conciliado || undefined,
      entregado: filtros.entregado || undefined,
      fecha_desde: filtros.fecha_desde || undefined,
      fecha_hasta: filtros.fecha_hasta || undefined,
      limit: 200,
    }),
  })

  const anular = useMutation({
    mutationFn: () => api.chcAnularCheque({ no_cia: selected.no_cia, punto: selected.punto, tipo_docu: selected.tipo_docu, no_docu: selected.no_docu, motivo }),
    onSuccess: () => { toast.success('Cheque anulado'); qc.invalidateQueries({ queryKey: ['chc-cheques'] }); setOpenAnular(false); setSelected(null); setMotivo('') },
    onError: (e: any) => toast.error(e?.detail?.error || 'Error'),
  })
  const entregar = useMutation({
    mutationFn: () => api.chcEntregarCheque({ no_cia: selected.no_cia, punto: selected.punto, tipo_docu: selected.tipo_docu, no_docu: selected.no_docu }),
    onSuccess: () => { toast.success('Marcado como entregado'); qc.invalidateQueries({ queryKey: ['chc-cheques'] }); setSelected(null) },
    onError: (e: any) => toast.error(e?.detail?.error || 'Error'),
  })
  const conciliar = useMutation({
    mutationFn: () => api.chcConciliarCheque({ no_cia: selected.no_cia, punto: selected.punto, tipo_docu: selected.tipo_docu, no_docu: selected.no_docu }),
    onSuccess: () => { toast.success('Marcado como conciliado'); qc.invalidateQueries({ queryKey: ['chc-cheques'] }); setSelected(null) },
    onError: (e: any) => toast.error(e?.detail?.error || 'Error'),
  })

  const rows = listQ.data || []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Cuenta</Label>
          <Select value={filtros.cuenta_banco || 'all'} onValueChange={(v) => setFiltros({ ...filtros, cuenta_banco: v === 'all' ? '' : v })}>
            <SelectTrigger className="w-56 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {cuentasQ.data?.map((c: any) => <SelectItem key={c.cuenta_banco} value={c.cuenta_banco}>{c.cuenta_banco}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Estado</Label>
          <Select value={filtros.status || 'all'} onValueChange={(v) => setFiltros({ ...filtros, status: v === 'all' ? '' : v })}>
            <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="A">Activo</SelectItem>
              <SelectItem value="C">Conciliado</SelectItem>
              <SelectItem value="N">Anulado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Conciliado</Label>
          <Select value={filtros.conciliado || 'all'} onValueChange={(v) => setFiltros({ ...filtros, conciliado: v === 'all' ? '' : v })}>
            <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="S">Sí</SelectItem>
              <SelectItem value="N">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Desde</Label><Input type="date" className="w-40 h-9" value={filtros.fecha_desde} onChange={(e) => setFiltros({ ...filtros, fecha_desde: e.target.value })} /></div>
        <div><Label className="text-xs">Hasta</Label><Input type="date" className="w-40 h-9" value={filtros.fecha_hasta} onChange={(e) => setFiltros({ ...filtros, fecha_hasta: e.target.value })} /></div>
        <Button size="sm" variant="outline" onClick={() => listQ.refetch()}><Search className="h-4 w-4 mr-1" /> Buscar</Button>
        <div className="ml-auto text-sm text-muted-foreground">{rows.length} cheques</div>
      </div>

      <div className="rounded border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Documento</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Cuenta</TableHead>
              <TableHead>Beneficiario</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Entreg.</TableHead>
              <TableHead>Concil.</TableHead>
              <TableHead className="text-right">Ver</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c: any) => (
              <TableRow key={`${c.tipo_docu}-${c.no_docu}-${c.cuenta_banco}`}>
                <TableCell className="font-mono text-xs">{c.tipo_docu}-{c.no_docu}</TableCell>
                <TableCell>{fmtDate(c.fecha_cheque || c.fecha_solicitud)}</TableCell>
                <TableCell className="font-mono text-xs">{c.cuenta_banco}</TableCell>
                <TableCell className="truncate max-w-xs">{c.beneficiario}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(c.valor_original)}</TableCell>
                <TableCell>
                  {c.st_nulo === 'N'
                    ? <Badge variant="destructive">Anulado</Badge>
                    : <Badge variant={STATUS_MAP[c.status]?.variant || 'secondary'}>{STATUS_MAP[c.status]?.label || c.status}</Badge>}
                </TableCell>
                <TableCell>{c.entregado === 'S' ? '✓' : ''}</TableCell>
                <TableCell>{c.conciliado === 'S' ? '✓' : ''}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => setSelected(c)}><Eye className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Sin cheques.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selected} onOpenChange={(v) => { if (!v) setSelected(null) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{selected?.tipo_docu}-{selected?.no_docu}</DialogTitle></DialogHeader>
          {selected && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Cuenta:</span> {selected.cuenta_banco}</div>
              <div><span className="text-muted-foreground">Moneda:</span> {selected.moneda_cuenta}</div>
              <div><span className="text-muted-foreground">Beneficiario:</span> {selected.beneficiario}</div>
              <div><span className="text-muted-foreground">Proveedor:</span> {selected.no_proveedor} {selected.nombre_proveedor}</div>
              <div><span className="text-muted-foreground">Tipo movi:</span> {selected.tipo_movi}</div>
              <div><span className="text-muted-foreground">Tipo trans:</span> {selected.tipo_transaccion}</div>
              <div><span className="text-muted-foreground">F. solicitud:</span> {fmtDate(selected.fecha_solicitud)}</div>
              <div><span className="text-muted-foreground">F. cheque:</span> {fmtDate(selected.fecha_cheque)}</div>
              <div><span className="text-muted-foreground">Valor:</span> {fmt(selected.valor_original)}</div>
              <div><span className="text-muted-foreground">Saldo:</span> {fmt(selected.saldo)}</div>
              <div><span className="text-muted-foreground">Autorizado:</span> {selected.autorizado === 'S' ? '✓ ' + (selected.autorizado_por || '') : '—'}</div>
              <div><span className="text-muted-foreground">Usuario:</span> {selected.usuario}</div>
            </div>
          )}
          <DialogFooter className="gap-2">
            {selected && selected.st_nulo === 'A' && selected.entregado !== 'S' && (
              <Button size="sm" variant="outline" onClick={() => entregar.mutate()}><Truck className="h-4 w-4 mr-1" /> Entregar</Button>
            )}
            {selected && selected.st_nulo === 'A' && selected.conciliado !== 'S' && (
              <Button size="sm" variant="outline" onClick={() => conciliar.mutate()}><Link2 className="h-4 w-4 mr-1" /> Conciliar</Button>
            )}
            {selected && selected.st_nulo === 'A' && (
              <Button size="sm" variant="destructive" onClick={() => setOpenAnular(true)}><XCircle className="h-4 w-4 mr-1" /> Anular</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openAnular} onOpenChange={setOpenAnular}>
        <DialogContent>
          <DialogHeader><DialogTitle>Anular {selected?.tipo_docu}-{selected?.no_docu}</DialogTitle></DialogHeader>
          <Label>Motivo</Label>
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAnular(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => anular.mutate()} disabled={!motivo || anular.isPending}>Anular</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
