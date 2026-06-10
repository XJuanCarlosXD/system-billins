import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Lock } from 'lucide-react'

const fmt = (n: any) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (s: any) => s ? String(s).slice(0, 10) : ''

export function OdcRecibir() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()
  const [selected, setSelected] = useState<any | null>(null)

  // Pendientes de recepción = estado='P' AND st_anulado='A' AND autorizada_por NOT NULL.
  // Una vez recibidas pasan a estado='R'. Filtramos el flag autorizada_por en cliente.
  const { data: dataRaw = [], isLoading } = useQuery<any[]>({
    queryKey: ['odc-pend-recibir', selectedCompany, selectedPoint],
    queryFn: () => api.odcListOrdenes({ no_cia: selectedCompany, punto: selectedPoint, estado: 'P', st_anulado: 'A', limit: 200 }),
  })
  const data = dataRaw.filter((o: any) => !!o.autorizada_por)

  const detalleQ = useQuery({
    enabled: !!selected,
    queryKey: ['odc-detalle-recibir', selected?.no_orden],
    queryFn: () => api.odcGetOrden(selected!.no_cia, selected!.punto, selected!.no_orden),
  })

  const cerrar = useMutation({
    mutationFn: (o: any) => api.odcCerrarOrden({ no_cia: o.no_cia, punto: o.punto, no_orden: o.no_orden }),
    onSuccess: () => { toast.success('Orden recibida y cerrada'); qc.invalidateQueries({ queryKey: ['odc-pend-recibir'] }); setSelected(null) },
    onError: (e: any) => toast.error(e?.detail?.error || 'Error al cerrar'),
  })

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Recibir mercancía de órdenes autorizadas</h3>
        <p className="text-sm text-muted-foreground">Selecciona una orden <b>Autorizada</b> para ver sus líneas y marcar la recepción.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <div className="text-sm font-medium mb-2">Órdenes autorizadas pendientes de recepción</div>
          {isLoading ? <Skeleton className="h-40 w-full" /> : (
            <div className="rounded border max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No.</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((o: any) => (
                    <TableRow key={o.no_orden} onClick={() => setSelected(o)} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-mono text-xs">{o.no_orden}</TableCell>
                      <TableCell>{fmtDate(o.fecha)}</TableCell>
                      <TableCell className="truncate max-w-[14rem]">{o.nombre_proveedor}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(o.total_neto)}</TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && data.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sin órdenes autorizadas pendientes.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div>
          <div className="text-sm font-medium mb-2">
            {selected ? `Líneas de la orden ODC-${selected.no_orden}` : 'Selecciona una orden para ver sus líneas'}
          </div>
          {selected && (
            <>
              <div className="rounded border max-h-[50vh] overflow-y-auto mb-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Pedida</TableHead>
                      <TableHead className="text-right">Recibida</TableHead>
                      <TableHead className="text-right">Costo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalleQ.data?.lineas.map((l: any) => (
                      <TableRow key={l.no_linea}>
                        <TableCell className="text-xs">{l.no_produ} {l.descripcion_producto}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(l.cantidad_pedida)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(l.cantidad_recibida)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(l.costo)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button size="sm" onClick={() => cerrar.mutate(selected)} disabled={cerrar.isPending}>
                <Lock className="h-4 w-4 mr-1" /> Marcar orden como Recibida / Cerrada
              </Button>
              <p className="text-xs text-muted-foreground mt-2">La actualización de cantidades por línea estará disponible en el próximo sprint; por ahora se cierra la orden completa.</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
