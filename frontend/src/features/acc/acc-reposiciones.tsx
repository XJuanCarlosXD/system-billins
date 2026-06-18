import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, Printer } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const fmt = (n: any) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })
const fmtDate = (s: any) => s ? String(s).slice(0, 10) : ''

export function AccReposiciones() {
  const { selectedCompany, selectedPoint } = useCompany()
  const [f, setF] = useState({ no_caja: '', fecha_desde: '', fecha_hasta: '' })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _cajasQ = useQuery({ queryKey: ['acc-caj-pick-rep', selectedCompany, selectedPoint], queryFn: () => api.accListCajas(selectedCompany, selectedPoint) })
  const q = useQuery({
    queryKey: ['acc-reposiciones', selectedCompany, selectedPoint, f],
    queryFn: () => api.accListReposiciones({ no_cia: selectedCompany, punto: selectedPoint, no_caja: f.no_caja || undefined, fecha_desde: f.fecha_desde || undefined, fecha_hasta: f.fecha_hasta || undefined, limit: 200 }),
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
              <TableHead className="text-right">PDF</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r: any) => (
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
                    <Button size="sm" variant="ghost" title="Imprimir reposición"
                      onClick={() => {
                        const qs = new URLSearchParams({ no_cia: r.no_cia || selectedCompany, punto: r.punto || selectedPoint }).toString()
                        window.open(`/print/acc-reposicion/${encodeURIComponent(r.no_reposicion)}?${qs}`, '_blank')
                      }}>
                      <Printer className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!q.isLoading && rows.length === 0 && (
                <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-6">Sin reposiciones.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
