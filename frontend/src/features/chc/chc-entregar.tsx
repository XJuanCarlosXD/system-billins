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
import { Truck, Search } from 'lucide-react'

const fmt = (n: any) =>
  Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (s: any) => (s ? String(s).slice(0, 10) : '')

export function ChcEntregar() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()
  const [cuentaBanco, setCuentaBanco] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [selected, setSelected] = useState<any | null>(null)
  const [entregadoA, setEntregadoA] = useState('')
  const [cedula, setCedula] = useState('')
  const [fechaEntrega, setFechaEntrega] = useState(() => new Date().toISOString().slice(0, 10))

  const cuentasQ = useQuery({
    queryKey: ['chc-cuentas-entregar', selectedCompany, selectedPoint],
    queryFn: () => api.chcListCuentas({ no_cia: selectedCompany, punto: selectedPoint, activa: 'S' }),
  })

  // Cheques activos no entregados — el legacy entrega solo los ya impresos,
  // pero el SO previo a imprimir también puede entregarse en este clon.
  const listQ = useQuery({
    queryKey: ['chc-pendientes-entregar', selectedCompany, selectedPoint, cuentaBanco],
    queryFn: () => api.chcListCheques({
      no_cia: selectedCompany,
      punto: selectedPoint,
      cuenta_banco: cuentaBanco || undefined,
      status: 'A',
      entregado: 'N',
      limit: 300,
    }),
  })

  const rows = (listQ.data || []).filter((c: any) =>
    !busqueda.trim() ||
    `${c.tipo_docu}${c.no_docu}${c.beneficiario || ''}`.toLowerCase().includes(busqueda.trim().toLowerCase())
  )

  const entregar = useMutation({
    mutationFn: () => api.chcEntregarCheque({
      no_cia: selected.no_cia,
      punto: selected.punto,
      tipo_docu: selected.tipo_docu,
      no_docu: selected.no_docu,
      entregado_a: entregadoA.trim().toUpperCase() || undefined,
      cedula: cedula.trim() || undefined,
      fecha_entrega: fechaEntrega || undefined,
    }),
    onSuccess: () => {
      toast.success(`${selected.tipo_docu}-${selected.no_docu} entregado a ${entregadoA || selected.beneficiario}`)
      qc.invalidateQueries({ queryKey: ['chc-pendientes-entregar'] })
      qc.invalidateQueries({ queryKey: ['chc-cheques'] })
      setSelected(null); setEntregadoA(''); setCedula('')
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'No se pudo registrar la entrega'),
  })

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Entregar Cheques</h3>
        <p className="text-sm text-muted-foreground">
          Cheques activos pendientes de entrega. Registra a quién y cuándo se entregó.
          Equivale a la opción <i>Entregar Cheques</i> del menú legacy CHC.
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
        <div className="text-sm text-muted-foreground">{rows.length} pendientes</div>
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
              <TableHead>Impresión</TableHead>
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
                <TableCell>
                  {c.st_impresion === 'S'
                    ? <Badge variant="outline">Impreso</Badge>
                    : <Badge variant="secondary">Sin imprimir</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => {
                    setSelected(c); setEntregadoA(c.beneficiario || '')
                  }}>
                    <Truck className="h-4 w-4 mr-1" /> Entregar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                  Sin cheques pendientes de entrega.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selected} onOpenChange={(v) => { if (!v) setSelected(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Entregar {selected?.tipo_docu}-{selected?.no_docu}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Beneficiario original: </span>{selected.beneficiario}</div>
                <div><span className="text-muted-foreground">Valor: </span>
                  <span className="tabular-nums">{fmt(selected.valor_original)}</span></div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Entregado a *</Label>
                <Input value={entregadoA} onChange={(e) => setEntregadoA(e.target.value)}
                       className="uppercase" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Cédula / Identificación</Label>
                  <Input value={cedula} onChange={(e) => setCedula(e.target.value)} className="font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fecha de entrega *</Label>
                  <Input type="date" value={fechaEntrega}
                         onChange={(e) => setFechaEntrega(e.target.value)} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)} disabled={entregar.isPending}>
              Cancelar
            </Button>
            <Button onClick={() => entregar.mutate()}
                    disabled={!entregadoA.trim() || !fechaEntrega || entregar.isPending}>
              {entregar.isPending ? 'Guardando…' : 'Confirmar entrega'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
