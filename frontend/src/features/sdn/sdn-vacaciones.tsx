import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search } from 'lucide-react'

const fmtDate = (s: any) => s ? String(s).slice(0, 10) : ''

export function SdnVacaciones() {
  const { selectedCompany, selectedPoint } = useCompany()
  const [ano, setAno] = useState(new Date().getFullYear().toString())
  const q = useQuery({
    queryKey: ['sdn-vac', selectedCompany, selectedPoint, ano],
    queryFn: () => api.sdnListVacaciones({ no_cia: selectedCompany, punto: selectedPoint, ano: Number(ano) || undefined, limit: 500 }),
  })
  const rows = q.data || []
  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div><Label className="text-xs">Año</Label><Input className="w-28 h-9" type="number" value={ano} onChange={(e) => setAno(e.target.value)} /></div>
        <Button size="sm" variant="outline" onClick={() => q.refetch()}><Search className="h-4 w-4 mr-1" /> Buscar</Button>
        <div className="ml-auto text-sm text-muted-foreground">{rows.length} vacaciones</div>
      </div>
      <div className="rounded border overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Empleado</TableHead><TableHead>Nombre</TableHead><TableHead>Nómina</TableHead>
            <TableHead>F. ingreso</TableHead><TableHead>Inicial</TableHead><TableHead>Final</TableHead>
            <TableHead className="text-right">Días</TableHead><TableHead>Status</TableHead>
            <TableHead>Tiempo</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((v: any, i: number) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-xs">{v.no_empleado}</TableCell>
                <TableCell>{v.nombre_empleado}</TableCell>
                <TableCell>{v.nomina}</TableCell>
                <TableCell>{fmtDate(v.fecha_ingreso)}</TableCell>
                <TableCell>{fmtDate(v.fecha_inicial)}</TableCell>
                <TableCell>{fmtDate(v.fecha_final)}</TableCell>
                <TableCell className="text-right">{v.cantidad_dias}</TableCell>
                <TableCell>{v.st_vacaciones}</TableCell>
                <TableCell className="text-xs">{v.tiempo_ano}a {v.tiempo_mes}m {v.tiempo_dia}d</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Sin registros.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
