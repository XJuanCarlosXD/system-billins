import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function AccPuntos() {
  const { selectedCompany } = useCompany()
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['acc-puntos', selectedCompany], queryFn: () => api.accListPuntos(selectedCompany) })
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Sucursales / Puntos</h3>
        <p className="text-sm text-muted-foreground">Empresa <b>{selectedCompany}</b>. Cada punto controla su período de proceso y secuencias.</p>
      </div>
      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="rounded border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Punto</TableHead><TableHead>Descripción</TableHead><TableHead>Activo</TableHead>
                <TableHead>Año</TableHead><TableHead>Mes</TableHead><TableHead>Mes Cierre</TableHead>
                <TableHead className="text-right">Próx. Documento</TableHead><TableHead className="text-right">Próx. Reposición</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((p: any) => (
                <TableRow key={p.punto}>
                  <TableCell className="font-mono">{p.punto}</TableCell>
                  <TableCell>{p.descripcion}</TableCell>
                  <TableCell><Badge variant={p.activo === 'S' ? 'default' : 'secondary'}>{p.activo === 'S' ? 'Sí' : 'No'}</Badge></TableCell>
                  <TableCell>{p.ano_proceso}</TableCell>
                  <TableCell>{String(p.mes_proceso).padStart(2, '0')}</TableCell>
                  <TableCell>{String(p.mes_cierre).padStart(2, '0')}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.prox_documento}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.prox_reposicion}</TableCell>
                </TableRow>
              ))}
              {!isLoading && data.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Sin puntos definidos.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
