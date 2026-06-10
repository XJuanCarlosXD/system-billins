import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function ChcCias() {
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['chc-cias'], queryFn: api.chcListCias })
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Compañías habilitadas para Cheques/Bancos</h3>
        <p className="text-sm text-muted-foreground">Configuración por empresa: formulario único, secuencia de OP, registro contable.</p>
      </div>
      {isLoading ? <Skeleton className="h-32 w-full" /> : (
        <div className="rounded border">
          <Table>
            <TableHeader><TableRow>
              <TableHead>No. CIA</TableHead><TableHead>Descripción</TableHead><TableHead>Activa</TableHead>
              <TableHead>Formulario único</TableHead><TableHead>Registro cont.</TableHead>
              <TableHead className="text-right">No. Form.</TableHead><TableHead className="text-right">Secuencia OP</TableHead>
              <TableHead>ID Banco</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.map((c: any) => (
                <TableRow key={c.no_cia}>
                  <TableCell className="font-mono">{c.no_cia}</TableCell>
                  <TableCell>{c.descri}</TableCell>
                  <TableCell><Badge variant={c.activa === 'S' ? 'default' : 'secondary'}>{c.activa === 'S' ? 'Sí' : 'No'}</Badge></TableCell>
                  <TableCell>{c.formulario_unico === 'S' ? 'Sí' : 'No'}</TableCell>
                  <TableCell>{c.registro_cont === 'S' ? 'Sí' : 'No'}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.no_formulario}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.secuencia_op}</TableCell>
                  <TableCell className="text-xs">{c.id_del_banco}</TableCell>
                </TableRow>
              ))}
              {!isLoading && data.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Sin empresas habilitadas.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
