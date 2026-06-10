import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CheckCircle2 } from 'lucide-react'

const fmt = (n: any) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (s: any) => s ? String(s).slice(0, 10) : ''

export function OdcAutorizar() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()
  // Pendientes de autorización = estado='P' AND st_anulado='A' AND autorizada_por IS NULL
  // (filtramos el flag autorizada_por en cliente — el backend ya excluye anuladas).
  const { data: dataRaw = [], isLoading } = useQuery<any[]>({
    queryKey: ['odc-pend-autorizar', selectedCompany, selectedPoint],
    queryFn: () => api.odcListOrdenes({ no_cia: selectedCompany, punto: selectedPoint, estado: 'P', st_anulado: 'A', limit: 200 }),
  })
  const data = dataRaw.filter((o: any) => !o.autorizada_por)

  const autorizar = useMutation({
    mutationFn: (o: any) => api.odcAutorizarOrden({ no_cia: o.no_cia, punto: o.punto, no_orden: o.no_orden }),
    onSuccess: () => { toast.success('Orden autorizada'); qc.invalidateQueries({ queryKey: ['odc-pend-autorizar'] }); qc.invalidateQueries({ queryKey: ['odc-ordenes'] }) },
    onError: (e: any) => toast.error(e?.detail?.error || 'Error al autorizar'),
  })

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Autorizar Órdenes pendientes</h3>
        <p className="text-sm text-muted-foreground">Empresa <b>{selectedCompany}</b> · Punto <b>{selectedPoint}</b> — solo se muestran órdenes con estado <b>Pendiente</b> y no anuladas.</p>
      </div>
      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="rounded border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Orden</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((o: any) => (
                <TableRow key={`${o.no_cia}-${o.punto}-${o.no_orden}`}>
                  <TableCell className="font-mono text-xs">ODC-{o.no_orden}</TableCell>
                  <TableCell>{fmtDate(o.fecha)}</TableCell>
                  <TableCell className="truncate max-w-xs">{o.no_proveedor} — {o.nombre_proveedor}</TableCell>
                  <TableCell className="text-right tabular-nums">RD$ {fmt(o.total_neto)}</TableCell>
                  <TableCell className="text-xs truncate max-w-md">{o.detalle}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" onClick={() => autorizar.mutate(o)} disabled={autorizar.isPending}>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Autorizar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && data.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No hay órdenes pendientes de autorización.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
