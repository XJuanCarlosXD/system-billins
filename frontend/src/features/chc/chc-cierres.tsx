import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function ChcCierres() {
  const { selectedCompany, selectedPoint } = useCompany()
  const { data = [] } = useQuery({
    queryKey: ['chc-cierres', selectedCompany, selectedPoint],
    queryFn: () => api.chcListCierres({ no_cia: selectedCompany, punto: selectedPoint }),
  })
  return (
    <div className="rounded border">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Año</TableHead><TableHead>Mes</TableHead>
          <TableHead>Cuenta</TableHead><TableHead>Fecha cierre</TableHead><TableHead>Usuario</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {(data as any[]).map((c, i) => (
            <TableRow key={`${c.ano}-${c.mes}-${c.cuenta_banco}-${i}`}>
              <TableCell>{c.ano}</TableCell>
              <TableCell>{String(c.mes).padStart(2, '0')}</TableCell>
              <TableCell className="font-mono">{c.cuenta_banco}</TableCell>
              <TableCell>{c.fecha_sysdate ? String(c.fecha_sysdate).slice(0, 10) : ''}</TableCell>
              <TableCell className="text-xs">{c.usuario}</TableCell>
            </TableRow>
          ))}
          {data.length === 0 && (
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sin cierres registrados.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
