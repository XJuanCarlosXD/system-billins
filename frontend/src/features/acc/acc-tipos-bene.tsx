import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function AccTiposBene() {
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['acc-tbene'], queryFn: api.accListTiposBene })
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Tipos de Beneficiario</h3>
        <p className="text-sm text-muted-foreground">Categorización de personas/entidades que reciben egresos.</p>
      </div>
      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="rounded border max-w-2xl">
          <Table>
            <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Descripción</TableHead><TableHead>Activo</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map((t: any) => (
                <TableRow key={t.tipo_bene}>
                  <TableCell className="font-mono">{t.tipo_bene}</TableCell>
                  <TableCell>{t.descripcion}</TableCell>
                  <TableCell><Badge variant={t.activo === 'S' ? 'default' : 'secondary'}>{t.activo === 'S' ? 'Sí' : 'No'}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
