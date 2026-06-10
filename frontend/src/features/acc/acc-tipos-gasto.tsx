import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function AccTiposGasto() {
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['acc-tgasto'], queryFn: api.accListTiposGasto })
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Tipos de Gasto</h3>
        <p className="text-sm text-muted-foreground">Catálogo de conceptos de gasto con su cuenta contable de débito.</p>
      </div>
      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="rounded border">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Código</TableHead><TableHead>Descripción</TableHead>
              <TableHead>Cuenta</TableHead><TableHead>Centro Costo</TableHead><TableHead>Activo</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.map((g: any) => (
                <TableRow key={g.tipo_gasto}>
                  <TableCell className="font-mono">{g.tipo_gasto}</TableCell>
                  <TableCell>{g.descripcion}</TableCell>
                  <TableCell className="font-mono text-xs">{g.cuenta}</TableCell>
                  <TableCell className="font-mono text-xs">{g.centro_costo}</TableCell>
                  <TableCell><Badge variant={g.activo === 'S' ? 'default' : 'secondary'}>{g.activo === 'S' ? 'Sí' : 'No'}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
