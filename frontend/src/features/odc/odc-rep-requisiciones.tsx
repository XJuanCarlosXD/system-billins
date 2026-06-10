import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const fmt = (n: any) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (s: any) => s ? String(s).slice(0, 10) : ''

export function OdcRepRequisiciones() {
  const { selectedCompany, selectedPoint } = useCompany()
  const q = useQuery({
    queryKey: ['odc-rep-req-v', selectedCompany, selectedPoint],
    queryFn: () => api.odcRepRequisicionesPendientes({ no_cia: selectedCompany, punto: selectedPoint, limit: 500 }),
  })
  const rows = q.data || []
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Requisiciones Pendientes (Rodc206)</h3>
        <p className="text-sm text-muted-foreground">Líneas de requisiciones no cerradas ni anuladas. Empresa <b>{selectedCompany}</b> · Punto <b>{selectedPoint}</b>.</p>
      </div>
      {q.isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="rounded border overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Requisición</TableHead><TableHead>Fecha</TableHead><TableHead>Usuario</TableHead>
              <TableHead>Producto</TableHead><TableHead>Descripción</TableHead>
              <TableHead className="text-right">Pedida</TableHead><TableHead className="text-right">Pendiente</TableHead>
              <TableHead className="text-right">Autorizada</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r: any, i: number) => (
                <TableRow key={`${r.no_requisicion}-${r.no_linea}-${i}`}>
                  <TableCell className="font-mono text-xs">REQ-{r.no_requisicion}</TableCell>
                  <TableCell>{fmtDate(r.fecha)}</TableCell>
                  <TableCell className="text-xs">{r.usuario}</TableCell>
                  <TableCell className="font-mono text-xs">{r.no_produ}</TableCell>
                  <TableCell className="truncate max-w-xs">{r.descripcion_producto}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.cantidad_pedida)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.cantidad_pendiente)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.cantidad_autorizada)}</TableCell>
                </TableRow>
              ))}
              {!q.isLoading && rows.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Sin requisiciones pendientes.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
