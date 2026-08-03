import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { XCircle, Search, AlertTriangle } from 'lucide-react'
import { GuardedButton } from '@/components/access'

const fmt = (n: any) =>
  Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (s: any) => (s ? String(s).slice(0, 10) : '')

export function ChcAnular() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()
  const [cuentaBanco, setCuentaBanco] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [selected, setSelected] = useState<any | null>(null)
  const [motivo, setMotivo] = useState('')

  const cuentasQ = useQuery({
    queryKey: ['chc-cuentas-anular', selectedCompany, selectedPoint],
    queryFn: () => api.chcListCuentas({ no_cia: selectedCompany, punto: selectedPoint, activa: 'S' }),
  })
  const listQ = useQuery({
    queryKey: ['chc-activos-anular', selectedCompany, selectedPoint, cuentaBanco],
    queryFn: () => api.chcListCheques({
      no_cia: selectedCompany, punto: selectedPoint,
      cuenta_banco: cuentaBanco || undefined,
      status: 'A',
      limit: 300,
    }),
  })

  const rows = (listQ.data || []).filter((c: any) =>
    !busqueda.trim() ||
    `${c.tipo_docu}${c.no_docu}${c.beneficiario || ''}`.toLowerCase().includes(busqueda.trim().toLowerCase())
  )

  const anular = useMutation({
    mutationFn: () => api.chcAnularCheque({
      no_cia: selected.no_cia,
      punto: selected.punto,
      tipo_docu: selected.tipo_docu,
      no_docu: selected.no_docu,
      motivo: motivo.trim(),
    }),
    onSuccess: () => {
      toast.success(`${selected.tipo_docu}-${selected.no_docu} anulado`)
      qc.invalidateQueries({ queryKey: ['chc-activos-anular'] })
      qc.invalidateQueries({ queryKey: ['chc-cheques'] })
      setSelected(null); setMotivo('')
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'No se pudo anular'),
  })

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Anular Cheques</h3>
        <p className="text-sm text-muted-foreground">
          Anula un cheque activo con motivo obligatorio. Marca <code>st_nulo='N'</code> y <code>status='N'</code> en TCHC_CHEQUE.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Cuenta</Label>
          <Select value={cuentaBanco || 'all'} onValueChange={(v) => setCuentaBanco(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-56 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {(cuentasQ.data || []).map((c: any) => (
                <SelectItem key={c.cuenta_banco} value={c.cuenta_banco}>{c.cuenta_banco}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex-1 min-w-64">
          <Label className="text-xs">Buscar</Label>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                   placeholder="Documento o beneficiario" className="h-9 pl-8" />
          </div>
        </div>
        <div className="text-sm text-muted-foreground">{rows.length} activos</div>
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
              <TableHead>Entregado</TableHead>
              <TableHead>Conciliado</TableHead>
              <TableHead className="text-right">Acción</TableHead>
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
                <TableCell>{c.entregado === 'S' ? <Badge variant="outline">Sí</Badge> : '—'}</TableCell>
                <TableCell>{c.conciliado === 'S' ? <Badge variant="outline">Sí</Badge> : '—'}</TableCell>
                <TableCell className="text-right">
                  <GuardedButton modulo="chc" flag="ANULAR_CHEQUE" size="sm" variant="destructive" onClick={() => { setSelected(c); setMotivo('') }}>
                    <XCircle className="h-4 w-4 mr-1" /> Anular
                  </GuardedButton>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                  Sin cheques activos para anular.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selected} onOpenChange={(v) => { if (!v) setSelected(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Anular {selected?.tipo_docu}-{selected?.no_docu}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="rounded border border-destructive/40 bg-destructive/5 p-3 text-destructive">
                Esta acción es irreversible. El cheque quedará marcado como nulo y no podrá liquidarse.
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Beneficiario: </span>{selected.beneficiario}</div>
                <div><span className="text-muted-foreground">Valor: </span>
                  <span className="tabular-nums">{fmt(selected.valor_original)}</span></div>
                <div><span className="text-muted-foreground">Cuenta: </span>{selected.cuenta_banco}</div>
                <div><span className="text-muted-foreground">Fecha: </span>
                  {fmtDate(selected.fecha_cheque || selected.fecha_solicitud)}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Motivo de anulación *</Label>
                <Input value={motivo} onChange={(e) => setMotivo(e.target.value)}
                       placeholder="Ej. Error en beneficiario" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)} disabled={anular.isPending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => anular.mutate()}
                    disabled={!motivo.trim() || anular.isPending}>
              <XCircle className="h-4 w-4 mr-1" />
              {anular.isPending ? 'Anulando…' : 'Confirmar anulación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
