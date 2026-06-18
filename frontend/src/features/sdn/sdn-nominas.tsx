import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, Printer } from 'lucide-react'

const fmtDate = (s: any) => s ? String(s).slice(0, 10) : ''

export function SdnNominas() {
  const { selectedCompany, selectedPoint } = useCompany()
  const [f, setF] = useState({ ano: '', mes: '', estado: '' })
  const q = useQuery({
    queryKey: ['sdn-nominas', selectedCompany, selectedPoint, f],
    queryFn: () => api.sdnListNominas({
      no_cia: selectedCompany, punto: selectedPoint,
      ano: f.ano ? Number(f.ano) : undefined,
      mes: f.mes ? Number(f.mes) : undefined,
      estado: f.estado || undefined,
      limit: 100,
    }),
  })
  const rows = q.data || []
  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div><Label className="text-xs">Año</Label><Input className="w-24 h-9" type="number" value={f.ano} onChange={(e) => setF({ ...f, ano: e.target.value })} /></div>
        <div><Label className="text-xs">Mes</Label><Input className="w-20 h-9" type="number" value={f.mes} onChange={(e) => setF({ ...f, mes: e.target.value })} /></div>
        <div><Label className="text-xs">Estado</Label><Input className="w-24 h-9" value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })} placeholder="A/C" /></div>
        <Button size="sm" variant="outline" onClick={() => q.refetch()}><Search className="h-4 w-4 mr-1" /> Buscar</Button>
        <div className="ml-auto text-sm text-muted-foreground">{rows.length} nóminas</div>
      </div>
      <div className="rounded border overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Nómina</TableHead><TableHead>Descripción</TableHead><TableHead>Punto</TableHead>
            <TableHead>Período</TableHead><TableHead>Inicial</TableHead><TableHead>Final</TableHead>
            <TableHead>Forma Pago</TableHead><TableHead>Cuenta Bco</TableHead><TableHead>Calc.</TableHead><TableHead>Estado</TableHead>
            <TableHead className="text-right">PDF</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((n: any) => (
              <TableRow key={`${n.punto}-${n.nomina}-${n.ano_proceso}-${n.mes_proceso}-${n.periodo}`}>
                <TableCell className="font-mono">{n.nomina}</TableCell>
                <TableCell>{n.descripcion}</TableCell>
                <TableCell>{n.punto}</TableCell>
                <TableCell>{String(n.mes_proceso).padStart(2, '0')}/{n.ano_proceso} P{n.periodo}</TableCell>
                <TableCell>{fmtDate(n.fecha_inicial)}</TableCell>
                <TableCell>{fmtDate(n.fecha_final)}</TableCell>
                <TableCell>{n.forma_pago}</TableCell>
                <TableCell className="font-mono text-xs">{n.cuenta_bancaria}</TableCell>
                <TableCell>{n.calculo_nomina === 'S' ? '✓' : ''}</TableCell>
                <TableCell><Badge variant={n.estado === 'A' ? 'default' : n.estado === 'C' ? 'outline' : 'secondary'}>{n.estado}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" title="Imprimir PDF nómina"
                    onClick={() => {
                      const qs = new URLSearchParams({ no_cia: n.no_cia || selectedCompany, punto: n.punto || selectedPoint }).toString()
                      window.open(`/print/sdn-nomina/${encodeURIComponent(n.nomina)}?${qs}`, '_blank')
                    }}>
                    <Printer className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-6">Sin nóminas.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
