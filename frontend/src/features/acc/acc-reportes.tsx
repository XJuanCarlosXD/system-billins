import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search } from 'lucide-react'

const fmt = (n: any) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })

export function AccReportes() {
  const { selectedCompany, selectedPoint } = useCompany()
  const [f, setF] = useState({ fecha_desde: '', fecha_hasta: '' })
  const resQ = useQuery({ queryKey: ['acc-rep-res', selectedCompany, selectedPoint, f], queryFn: () => api.accRepResumen({ no_cia: selectedCompany, punto: selectedPoint, ...f }) })
  const gastosQ = useQuery({ queryKey: ['acc-rep-gastos', selectedCompany, selectedPoint, f], queryFn: () => api.accRepGastosTipo({ no_cia: selectedCompany, punto: selectedPoint, ...f }) })
  const d: any = resQ.data || {}

  return (
    <Tabs defaultValue="resumen">
      <TabsList>
        <TabsTrigger value="resumen">Resumen</TabsTrigger>
        <TabsTrigger value="gastos">Gastos por Tipo</TabsTrigger>
      </TabsList>
      <div className="flex items-end gap-2 pt-3">
        <div><Label className="text-xs">Desde</Label><Input type="date" className="h-9 w-40" value={f.fecha_desde} onChange={(e) => setF({ ...f, fecha_desde: e.target.value })} /></div>
        <div><Label className="text-xs">Hasta</Label><Input type="date" className="h-9 w-40" value={f.fecha_hasta} onChange={(e) => setF({ ...f, fecha_hasta: e.target.value })} /></div>
        <Button size="sm" variant="outline" onClick={() => { resQ.refetch(); gastosQ.refetch() }}><Search className="h-4 w-4 mr-1" /> Generar</Button>
      </div>
      <TabsContent value="resumen" className="pt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Documentos</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{Number(d.total_docs || 0).toLocaleString()}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Anulados</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{Number(d.anulados || 0).toLocaleString()}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Monto Total</CardTitle></CardHeader><CardContent className="text-xl font-semibold tabular-nums">RD$ {fmt(d.monto_total)}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Impuesto Total</CardTitle></CardHeader><CardContent className="text-xl font-semibold tabular-nums">RD$ {fmt(d.impuesto_total)}</CardContent></Card>
        </div>
      </TabsContent>
      <TabsContent value="gastos" className="pt-4">
        <div className="rounded border overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Tipo</TableHead><TableHead>Descripción</TableHead><TableHead>Cuenta</TableHead>
              <TableHead>Centro Costo</TableHead><TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(gastosQ.data || []).map((r: any) => (
                <TableRow key={r.tipo_gasto}>
                  <TableCell className="font-mono">{r.tipo_gasto}</TableCell>
                  <TableCell>{r.descripcion}</TableCell>
                  <TableCell className="font-mono text-xs">{r.cuenta}</TableCell>
                  <TableCell className="font-mono text-xs">{r.centro_costo}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(r.cantidad || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{fmt(r.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </TabsContent>
    </Tabs>
  )
}
