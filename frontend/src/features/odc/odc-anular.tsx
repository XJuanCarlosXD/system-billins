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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { XCircle } from 'lucide-react'

const fmt = (n: any) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (s: any) => s ? String(s).slice(0, 10) : ''

export function OdcAnular() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()
  const [motivos, setMotivos] = useState<Record<string, string>>({})

  const ordenesQ = useQuery<any[]>({
    queryKey: ['odc-pend-anular', selectedCompany, selectedPoint],
    queryFn: () => api.odcListOrdenes({ no_cia: selectedCompany, punto: selectedPoint, st_anulado: 'A', limit: 200 }),
  })
  const reqsQ = useQuery<any[]>({
    queryKey: ['odc-req-anular', selectedCompany, selectedPoint],
    queryFn: () => api.odcListRequisiciones({ no_cia: selectedCompany, punto: selectedPoint, limit: 200 }),
  })

  const anularOrden = useMutation({
    mutationFn: (o: any) => api.odcAnularOrden({ no_cia: o.no_cia, punto: o.punto, no_orden: o.no_orden, motivo: motivos[`O-${o.no_orden}`] || 'Sin motivo' }),
    onSuccess: () => { toast.success('Orden anulada'); qc.invalidateQueries({ queryKey: ['odc-pend-anular'] }) },
    onError: (e: any) => toast.error(e?.detail?.error || 'Error al anular'),
  })
  const anularReq = useMutation({
    mutationFn: (r: any) => api.odcAnularRequisicion({ no_cia: r.no_cia, punto: r.punto, no_requisicion: r.no_requisicion, motivo: motivos[`R-${r.no_requisicion}`] || 'Sin motivo' }),
    onSuccess: () => { toast.success('Requisición anulada'); qc.invalidateQueries({ queryKey: ['odc-req-anular'] }) },
    onError: (e: any) => toast.error(e?.detail?.error || 'Error al anular'),
  })

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Anular órdenes o requisiciones</h3>
        <p className="text-sm text-muted-foreground">Ingresa un motivo y confirma. La anulación queda registrada en el detalle del documento.</p>
      </div>
      <Tabs defaultValue="ordenes">
        <TabsList>
          <TabsTrigger value="ordenes">Órdenes</TabsTrigger>
          <TabsTrigger value="requisiciones">Requisiciones</TabsTrigger>
        </TabsList>
        <TabsContent value="ordenes" className="pt-4">
          {ordenesQ.isLoading ? <Skeleton className="h-40 w-full" /> : (
            <div className="rounded border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No.</TableHead><TableHead>Fecha</TableHead><TableHead>Proveedor</TableHead>
                    <TableHead className="text-right">Monto</TableHead><TableHead>Estado</TableHead>
                    <TableHead className="w-64">Motivo</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(ordenesQ.data || []).map((o: any) => (
                    <TableRow key={o.no_orden}>
                      <TableCell className="font-mono text-xs">ODC-{o.no_orden}</TableCell>
                      <TableCell>{fmtDate(o.fecha)}</TableCell>
                      <TableCell className="truncate max-w-xs">{o.nombre_proveedor}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(o.total_neto)}</TableCell>
                      <TableCell>{o.estado}</TableCell>
                      <TableCell>
                        <Input value={motivos[`O-${o.no_orden}`] || ''} onChange={(e) => setMotivos({ ...motivos, [`O-${o.no_orden}`]: e.target.value })} placeholder="Motivo…" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="destructive" disabled={!motivos[`O-${o.no_orden}`] || anularOrden.isPending} onClick={() => anularOrden.mutate(o)}>
                          <XCircle className="h-4 w-4 mr-1" /> Anular
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="requisiciones" className="pt-4">
          {reqsQ.isLoading ? <Skeleton className="h-40 w-full" /> : (
            <div className="rounded border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No.</TableHead><TableHead>Fecha</TableHead><TableHead>Tipo</TableHead>
                    <TableHead>Localidad</TableHead><TableHead>Estado</TableHead>
                    <TableHead className="w-64">Motivo</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(reqsQ.data || []).map((r: any) => (
                    <TableRow key={r.no_requisicion}>
                      <TableCell className="font-mono text-xs">REQ-{r.no_requisicion}</TableCell>
                      <TableCell>{fmtDate(r.fecha)}</TableCell>
                      <TableCell>{r.tipo_requisicion}</TableCell>
                      <TableCell>{r.no_localidad}</TableCell>
                      <TableCell>{r.estado}</TableCell>
                      <TableCell>
                        <Input value={motivos[`R-${r.no_requisicion}`] || ''} onChange={(e) => setMotivos({ ...motivos, [`R-${r.no_requisicion}`]: e.target.value })} placeholder="Motivo…" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="destructive" disabled={!motivos[`R-${r.no_requisicion}`] || anularReq.isPending} onClick={() => anularReq.mutate(r)}>
                          <XCircle className="h-4 w-4 mr-1" /> Anular
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
