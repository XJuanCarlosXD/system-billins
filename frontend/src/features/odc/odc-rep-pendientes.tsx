import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search } from 'lucide-react'

const fmt = (n: any) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (s: any) => s ? String(s).slice(0, 10) : ''

// Default a últimos 90 días para que el reporte cargue rápido (sin filtros
// pueden ser 5+ segundos y 600+ KB con histórico desde 2021).
function defaultRange() {
  const today = new Date()
  const desde = new Date(today)
  desde.setDate(desde.getDate() - 90)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { fecha_desde: iso(desde), fecha_hasta: iso(today) }
}

export function OdcRepPendientes() {
  const { selectedCompany, selectedPoint } = useCompany()
  const [f, setF] = useState(defaultRange)
  const q = useQuery({
    queryKey: ['odc-rep-pend-v', selectedCompany, selectedPoint, f],
    queryFn: () => api.odcRepOrdenesPendientes({ no_cia: selectedCompany, punto: selectedPoint, fecha_desde: f.fecha_desde || undefined, fecha_hasta: f.fecha_hasta || undefined }),
  })
  const rows = q.data || []
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Movimientos Pendientes (Rodc201)</h3>
        <p className="text-sm text-muted-foreground">Órdenes con cantidad pendiente de recibir (cantidad_pedida {`>`} cantidad_recibida) y no anuladas.</p>
      </div>
      <div className="flex items-end gap-2">
        <div><Label className="text-xs">Desde</Label><Input type="date" className="h-9 w-40" value={f.fecha_desde} onChange={(e) => setF({ ...f, fecha_desde: e.target.value })} /></div>
        <div><Label className="text-xs">Hasta</Label><Input type="date" className="h-9 w-40" value={f.fecha_hasta} onChange={(e) => setF({ ...f, fecha_hasta: e.target.value })} /></div>
        <Button size="sm" variant="outline" onClick={() => q.refetch()}><Search className="h-4 w-4 mr-1" /> Generar</Button>
        <div className="ml-auto text-sm text-muted-foreground">{rows.length} órdenes con pendientes</div>
      </div>
      {q.isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="rounded border overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>No. Orden</TableHead><TableHead>Fecha</TableHead><TableHead>Proveedor</TableHead>
              <TableHead>Estado</TableHead><TableHead className="text-right">Pedida</TableHead>
              <TableHead className="text-right">Recibida</TableHead><TableHead className="text-right">Pendiente</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r: any) => (
                <TableRow key={`${r.no_orden}-${r.no_proveedor}`}>
                  <TableCell className="font-mono">ODC-{r.no_orden}</TableCell>
                  <TableCell>{fmtDate(r.fecha)}</TableCell>
                  <TableCell className="truncate max-w-xs">{r.no_proveedor} — {r.nombre}</TableCell>
                  <TableCell>{r.estado}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.cantidad_pedida_total)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.cantidad_recibida_total)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{fmt(r.pendiente)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.monto_total)}</TableCell>
                </TableRow>
              ))}
              {!q.isLoading && rows.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Sin pendientes.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
