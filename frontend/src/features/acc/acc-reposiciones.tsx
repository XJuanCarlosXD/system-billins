import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Printer, Banknote } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const fmt = (n: any) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })
const fmtDate = (s: any) => s ? String(s).slice(0, 10) : ''

export function AccReposiciones() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()
  const [f, setF] = useState({ no_caja: '', fecha_desde: '', fecha_hasta: '' })
  const [solRep, setSolRep] = useState<any | null>(null)
  const [solCuenta, setSolCuenta] = useState('')
  const [solBene, setSolBene] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _cajasQ = useQuery({ queryKey: ['acc-caj-pick-rep', selectedCompany, selectedPoint], queryFn: () => api.accListCajas(selectedCompany, selectedPoint) })
  const q = useQuery({
    queryKey: ['acc-reposiciones', selectedCompany, selectedPoint, f],
    queryFn: () => api.accListReposiciones({ no_cia: selectedCompany, punto: selectedPoint, no_caja: f.no_caja || undefined, fecha_desde: f.fecha_desde || undefined, fecha_hasta: f.fecha_hasta || undefined, limit: 200 }),
  })
  const cuentasQ = useQuery({
    enabled: !!solRep,
    queryKey: ['chc-cuentas-acc-sol', selectedCompany, selectedPoint],
    queryFn: () => api.chcListCuentas({ no_cia: selectedCompany, punto: selectedPoint, activa: 'S' }),
  })
  const generarSol = useMutation({
    mutationFn: () => api.accGenerarSolicitudReposicion({
      no_cia: selectedCompany, punto: selectedPoint,
      no_reposicion: solRep.no_reposicion,
      cuenta_banco: solCuenta,
      beneficiario: solBene || undefined,
    }),
    onSuccess: (r: any) => {
      toast.success(`Solicitud SO-${r.no_docu} creada en CHC por RD$ ${fmt(r.total)}`)
      setSolRep(null); setSolCuenta(''); setSolBene('')
      qc.invalidateQueries({ queryKey: ['acc-reposiciones'] })
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'No se pudo generar la solicitud'),
  })
  const rows = q.data || []
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Reposiciones de Caja Chica</h3>
        <p className="text-sm text-muted-foreground">Consulta de reposiciones registradas (cheques/débitos), monto, NCF y estado.</p>
      </div>
      <div className="flex items-end gap-3">
        <div><Label className="text-xs">Caja</Label><Input className="w-32 h-9" value={f.no_caja} onChange={(e) => setF({ ...f, no_caja: e.target.value })} placeholder="Cualquiera" /></div>
        <div><Label className="text-xs">Desde</Label><Input type="date" className="h-9 w-40" value={f.fecha_desde} onChange={(e) => setF({ ...f, fecha_desde: e.target.value })} /></div>
        <div><Label className="text-xs">Hasta</Label><Input type="date" className="h-9 w-40" value={f.fecha_hasta} onChange={(e) => setF({ ...f, fecha_hasta: e.target.value })} /></div>
        <Button size="sm" variant="outline" onClick={() => q.refetch()}><Search className="h-4 w-4 mr-1" /> Buscar</Button>
        <div className="ml-auto text-sm text-muted-foreground">{rows.length} reposiciones</div>
      </div>
      {q.isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="rounded border overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>No.</TableHead><TableHead>Caja</TableHead><TableHead>Fecha</TableHead>
              <TableHead>Cheque</TableHead><TableHead>Cuenta Bco</TableHead>
              <TableHead className="text-right">Monto Caja</TableHead><TableHead className="text-right">Valor Reposición</TableHead>
              <TableHead className="text-right">Efectivo</TableHead><TableHead>NCF</TableHead><TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r: any) => {
                const sinSolicitud = !r.anulada_por && !(r.tipo_docu_chc === 'SO' && r.no_docu_chc)
                return (
                  <TableRow key={`${r.no_caja}-${r.no_reposicion}`}>
                    <TableCell className="font-mono">REP-{r.no_reposicion}</TableCell>
                    <TableCell className="font-mono">{r.no_caja}</TableCell>
                    <TableCell>{fmtDate(r.fecha)}</TableCell>
                    <TableCell className="text-xs">{r.tipo_docu_chc}-{r.no_docu_chc}</TableCell>
                    <TableCell className="font-mono text-xs">{r.cuenta_banco}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.monto_cc)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.valor_reposicion)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.efectivo)}</TableCell>
                    <TableCell className="font-mono text-xs">{r.ncf}</TableCell>
                    <TableCell>
                      {r.anulada_por
                        ? <Badge variant="destructive">Anulada</Badge>
                        : <Badge>Activa</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {sinSolicitud && (
                          <Button size="sm" variant="ghost" title="Generar solicitud de cheque (Facc203)"
                            onClick={() => { setSolRep(r); setSolCuenta(r.cuenta_banco || '') }}>
                            <Banknote className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" title="Imprimir reposición"
                          onClick={() => {
                            const qs = new URLSearchParams({ no_cia: r.no_cia || selectedCompany, punto: r.punto || selectedPoint }).toString()
                            window.open(`/print/acc-reposicion/${encodeURIComponent(r.no_reposicion)}?${qs}`, '_blank')
                          }}>
                          <Printer className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              {!q.isLoading && rows.length === 0 && (
                <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-6">Sin reposiciones.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Generar Solicitud de Cheque de Reposición (Facc203) */}
      <Dialog open={!!solRep} onOpenChange={(v) => { if (!v) setSolRep(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-4 w-4" /> Solicitud de cheque · REP-{solRep?.no_reposicion}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded border bg-muted/30 p-3">
              Se creará una <strong>Solicitud de Cheque (SO)</strong> en CHC por
              <strong> RD$ {fmt(solRep?.valor_reposicion)}</strong> para reponer la caja
              {solRep?.no_caja ? <> <strong>{solRep.no_caja}</strong></> : null}.
              El cheque se emite y entrega después desde CHC.
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cuenta bancaria <span className="text-destructive">*</span></Label>
              <Select value={solCuenta} onValueChange={setSolCuenta}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
                <SelectContent>
                  {(cuentasQ.data || []).map((c: any) => (
                    <SelectItem key={c.cuenta_banco} value={c.cuenta_banco}>
                      {c.cuenta_banco} · {c.moneda === 'P' ? 'DOP' : 'USD'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Beneficiario (opcional)</Label>
              <Input value={solBene} onChange={(e) => setSolBene(e.target.value)}
                     placeholder="Por defecto: REPOSICION CAJA CHICA <caja>" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSolRep(null)}>Cancelar</Button>
            <Button onClick={() => generarSol.mutate()} disabled={!solCuenta || generarSol.isPending}>
              {generarSol.isPending ? 'Generando…' : 'Generar solicitud'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
