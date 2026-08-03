import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { AlertTriangle, Search, XCircle } from 'lucide-react'
import { GuardedButton } from '@/components/access'

const fmt = (n: any) =>
  Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (s: any) => (s ? String(s).slice(0, 10) : '')

export function AccAnular() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()
  const [noCaja, setNoCaja] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [selected, setSelected] = useState<any | null>(null)
  const [motivo, setMotivo] = useState('')

  const cajasQ = useQuery({
    queryKey: ['acc-cajas-anular', selectedCompany, selectedPoint],
    queryFn: () => api.accListCajas(selectedCompany, selectedPoint),
  })
  const listQ = useQuery({
    queryKey: ['acc-documentos-activos', selectedCompany, selectedPoint, noCaja],
    queryFn: () => api.accListDocumentos({
      no_cia: selectedCompany,
      punto: selectedPoint,
      no_caja: noCaja || undefined,
      anulado: 'N',
      limit: 300,
    }),
  })

  const rows = (listQ.data || []).filter((d: any) =>
    !busqueda.trim() ||
    `${d.no_docu}${d.nombre_bene || ''}${d.detalle || ''}`
      .toLowerCase().includes(busqueda.trim().toLowerCase())
  )

  const anular = useMutation({
    mutationFn: () => api.accAnularDocumento({
      no_cia: selected.no_cia,
      punto: selected.punto,
      no_docu: selected.no_docu,
      motivo: motivo.trim(),
    }),
    onSuccess: () => {
      toast.success(`Egreso ACC-${selected.no_docu} anulado`)
      qc.invalidateQueries({ queryKey: ['acc-documentos-activos'] })
      qc.invalidateQueries({ queryKey: ['acc-documentos'] })
      qc.invalidateQueries({ queryKey: ['acc-rep-resumen'] })
      setSelected(null); setMotivo('')
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'No se pudo anular'),
  })

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Anular Egresos de Caja Chica</h3>
        <p className="text-sm text-muted-foreground">
          Lista los egresos activos de caja chica. Anula con motivo obligatorio
          (marca <code>anulado='S'</code> en <code>TACC_DOCUMENTO</code>).
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Caja</Label>
          <Select value={noCaja || 'all'} onValueChange={(v) => setNoCaja(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-56 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {(cajasQ.data || []).map((c: any) => (
                <SelectItem key={c.no_caja} value={c.no_caja}>
                  {c.no_caja} — {c.descripcion}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex-1 min-w-64">
          <Label className="text-xs">Buscar</Label>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                   placeholder="Documento, beneficiario o detalle" className="h-9 pl-8" />
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
              <TableHead>Caja</TableHead>
              <TableHead>Beneficiario</TableHead>
              <TableHead>Tipo gasto</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((d: any) => (
              <TableRow key={`${d.no_docu}-${d.punto}`}>
                <TableCell className="font-mono text-xs">ACC-{d.no_docu}</TableCell>
                <TableCell>{fmtDate(d.fecha)}</TableCell>
                <TableCell className="font-mono text-xs">{d.no_caja}</TableCell>
                <TableCell className="truncate max-w-xs">{d.nombre_bene || d.no_bene}</TableCell>
                <TableCell className="text-xs">{d.desc_gasto || d.tipo_gasto}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(d.valor)}</TableCell>
                <TableCell className="text-right">
                  <GuardedButton modulo="acc" flag="ANULAR_EGRESO" size="sm" variant="destructive" onClick={() => { setSelected(d); setMotivo('') }}>
                    <XCircle className="h-4 w-4 mr-1" /> Anular
                  </GuardedButton>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                  Sin egresos activos para anular.
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
              Anular ACC-{selected?.no_docu}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="rounded border border-destructive/40 bg-destructive/5 p-3 text-destructive">
                El egreso quedará marcado como anulado y la reposición de la caja no lo incluirá.
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Beneficiario: </span>
                  {selected.nombre_bene || selected.no_bene}</div>
                <div><span className="text-muted-foreground">Valor: </span>
                  <span className="tabular-nums">RD$ {fmt(selected.valor)}</span></div>
                <div><span className="text-muted-foreground">Caja: </span>{selected.no_caja}</div>
                <div><span className="text-muted-foreground">Fecha: </span>{fmtDate(selected.fecha)}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Motivo de anulación *</Label>
                <Input value={motivo} onChange={(e) => setMotivo(e.target.value)}
                       placeholder="Ej. Comprobante duplicado" />
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
