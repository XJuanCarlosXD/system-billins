import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function ChcBancos() {
  const { data = [] } = useQuery({ queryKey: ['chc-bancos'], queryFn: () => api.chcListBancos() })
  return (
    <div className="rounded border">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Código</TableHead><TableHead>Banco</TableHead>
          <TableHead>RNC</TableHead><TableHead>Siglas</TableHead><TableHead>Activo</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {(data as any[]).map((b) => (
            <TableRow key={b.banco}>
              <TableCell className="font-mono">{b.banco}</TableCell>
              <TableCell>{b.descri}</TableCell>
              <TableCell className="font-mono text-xs">{b.rnc}</TableCell>
              <TableCell>{b.siglas_banco}</TableCell>
              <TableCell><Badge variant={b.activo === 'S' ? 'default' : 'secondary'}>{b.activo === 'S' ? 'Sí' : 'No'}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
