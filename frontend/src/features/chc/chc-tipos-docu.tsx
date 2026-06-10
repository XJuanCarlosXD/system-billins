import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function ChcTiposDocu() {
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['chc-tdocu'], queryFn: api.chcListTiposDocu })
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Tipos de Documento de Cheques</h3>
        <p className="text-sm text-muted-foreground">CH cheque, OP orden de pago, DE depósito, NC nota de crédito, ND nota de débito, etc.</p>
      </div>
      {isLoading ? <Skeleton className="h-32 w-full" /> : (
        <div className="rounded border">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Tipo</TableHead><TableHead>Descripción</TableHead>
              <TableHead>Movi (D/C)</TableHead><TableHead>Transacción</TableHead>
              <TableHead>Cuenta contable</TableHead><TableHead>Centro Costo</TableHead><TableHead>Activo</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.map((t: any) => (
                <TableRow key={t.tipo_docu}>
                  <TableCell className="font-mono">{t.tipo_docu}</TableCell>
                  <TableCell>{t.descri}</TableCell>
                  <TableCell>{t.tipo_movi}</TableCell>
                  <TableCell>{t.tipo_transaccion}</TableCell>
                  <TableCell className="font-mono text-xs">{t.cuenta}</TableCell>
                  <TableCell className="font-mono text-xs">{t.centro_costo}</TableCell>
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
