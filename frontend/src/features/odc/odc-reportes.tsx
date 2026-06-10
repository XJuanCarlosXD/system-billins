import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Search, Loader2 } from 'lucide-react'

const fmt = (n: any) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (s: any) => (s ? String(s).slice(0, 10) : '')

function ResumenTab() {
  const { selectedCompany, selectedPoint } = useCompany()
  const [f, setF] = useState({ fecha_desde: '', fecha_hasta: '' })
  const q = useQuery({
    queryKey: ['odc-rep-resumen', selectedCompany, selectedPoint, f],
    queryFn: () => api.odcRepResumen({
      no_cia: selectedCompany, punto: selectedPoint,
      fecha_desde: f.fecha_desde || undefined, fecha_hasta: f.fecha_hasta || undefined,
    }),
  })
  const d: any = q.data || {}
  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div><Label className="text-xs">Desde</Label><Input type="date" className="h-9 w-40" value={f.fecha_desde} onChange={(e) => setF({ ...f, fecha_desde: e.target.value })} /></div>
        <div><Label className="text-xs">Hasta</Label><Input type="date" className="h-9 w-40" value={f.fecha_hasta} onChange={(e) => setF({ ...f, fecha_hasta: e.target.value })} /></div>
        <Button size="sm" variant="outline" onClick={() => q.refetch()}><Search className="h-4 w-4 mr-1" /> Generar</Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total órdenes</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{Number(d.total_ordenes || 0).toLocaleString()}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pendientes</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{Number(d.pendientes || 0).toLocaleString()}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Autorizadas</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{Number(d.autorizadas || 0).toLocaleString()}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Cerradas</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{Number(d.cerradas || 0).toLocaleString()}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Anuladas</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{Number(d.anuladas || 0).toLocaleString()}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Monto total</CardTitle></CardHeader><CardContent className="text-xl font-semibold tabular-nums">RD$ {fmt(d.monto_total)}</CardContent></Card>
      </div>
    </div>
  )
}

function OrdenesPendientesTab() {
  const { selectedCompany, selectedPoint } = useCompany()
  const [f, setF] = useState({ fecha_desde: '', fecha_hasta: '' })
  const q = useQuery({
    queryKey: ['odc-rep-pend', selectedCompany, selectedPoint, f],
    queryFn: () => api.odcRepOrdenesPendientes({
      no_cia: selectedCompany, punto: selectedPoint,
      fecha_desde: f.fecha_desde || undefined, fecha_hasta: f.fecha_hasta || undefined,
    }),
  })
  const rows = q.data || []
  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div><Label className="text-xs">Desde</Label><Input type="date" className="h-9 w-40" value={f.fecha_desde} onChange={(e) => setF({ ...f, fecha_desde: e.target.value })} /></div>
        <div><Label className="text-xs">Hasta</Label><Input type="date" className="h-9 w-40" value={f.fecha_hasta} onChange={(e) => setF({ ...f, fecha_hasta: e.target.value })} /></div>
        <Button size="sm" variant="outline" onClick={() => q.refetch()}><Search className="h-4 w-4 mr-1" /> Generar</Button>
        <div className="ml-auto text-sm text-muted-foreground">{rows.length} órdenes con pendientes</div>
      </div>
      {q.isLoading && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>}
      <div className="rounded border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Orden</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Pedida</TableHead>
              <TableHead className="text-right">Recibida</TableHead>
              <TableHead className="text-right">Pendiente</TableHead>
              <TableHead className="text-right">Monto total</TableHead>
            </TableRow>
          </TableHeader>
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
            {rows.length === 0 && !q.isLoading && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Sin órdenes pendientes.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function RequisicionesPendientesTab() {
  const { selectedCompany, selectedPoint } = useCompany()
  const q = useQuery({
    queryKey: ['odc-rep-req-pend', selectedCompany, selectedPoint],
    queryFn: () => api.odcRepRequisicionesPendientes({ no_cia: selectedCompany, punto: selectedPoint, limit: 500 }),
  })
  const rows = q.data || []
  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">{rows.length} líneas pendientes</div>
      <div className="rounded border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Requisición</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Pedida</TableHead>
              <TableHead className="text-right">Pendiente</TableHead>
              <TableHead className="text-right">Autorizada</TableHead>
            </TableRow>
          </TableHeader>
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
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Sin requisiciones pendientes.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export function OdcReportes() {
  return (
    <Tabs defaultValue="resumen">
      <TabsList>
        <TabsTrigger value="resumen">Resumen</TabsTrigger>
        <TabsTrigger value="pendientes">Órdenes Pendientes</TabsTrigger>
        <TabsTrigger value="requisiciones">Requisiciones Pendientes</TabsTrigger>
      </TabsList>
      <TabsContent value="resumen" className="pt-4"><ResumenTab /></TabsContent>
      <TabsContent value="pendientes" className="pt-4"><OrdenesPendientesTab /></TabsContent>
      <TabsContent value="requisiciones" className="pt-4"><RequisicionesPendientesTab /></TabsContent>
    </Tabs>
  )
}
