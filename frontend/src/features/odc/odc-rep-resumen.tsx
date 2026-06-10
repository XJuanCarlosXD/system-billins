import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Search } from 'lucide-react'

const fmt = (n: any) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function OdcRepResumen() {
  const { selectedCompany, selectedPoint } = useCompany()
  const [f, setF] = useState({ fecha_desde: '', fecha_hasta: '' })
  const q = useQuery({
    queryKey: ['odc-rep-res-v', selectedCompany, selectedPoint, f],
    queryFn: () => api.odcRepResumen({ no_cia: selectedCompany, punto: selectedPoint, fecha_desde: f.fecha_desde || undefined, fecha_hasta: f.fecha_hasta || undefined }),
  })
  const d: any = q.data || {}
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Resumen de Órdenes (Rodc207)</h3>
        <p className="text-sm text-muted-foreground">Totales y conteos por estado en el período. Empresa <b>{selectedCompany}</b> · Punto <b>{selectedPoint}</b>.</p>
      </div>
      <div className="flex items-end gap-2">
        <div><Label className="text-xs">Desde</Label><Input type="date" className="h-9 w-40" value={f.fecha_desde} onChange={(e) => setF({ ...f, fecha_desde: e.target.value })} /></div>
        <div><Label className="text-xs">Hasta</Label><Input type="date" className="h-9 w-40" value={f.fecha_hasta} onChange={(e) => setF({ ...f, fecha_hasta: e.target.value })} /></div>
        <Button size="sm" variant="outline" onClick={() => q.refetch()}><Search className="h-4 w-4 mr-1" /> Generar</Button>
      </div>
      {q.isLoading ? <Skeleton className="h-32 w-full" /> : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total órdenes</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{Number(d.total_ordenes || 0).toLocaleString()}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pendientes</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{Number(d.pendientes || 0).toLocaleString()}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Autorizadas</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{Number(d.autorizadas || 0).toLocaleString()}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Cerradas</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{Number(d.cerradas || 0).toLocaleString()}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Anuladas</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{Number(d.anuladas || 0).toLocaleString()}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Monto total</CardTitle></CardHeader><CardContent className="text-xl font-semibold tabular-nums">RD$ {fmt(d.monto_total)}</CardContent></Card>
        </div>
      )}
    </div>
  )
}
