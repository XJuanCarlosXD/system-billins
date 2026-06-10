import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function ChcPuntos() {
  const { selectedCompany } = useCompany()
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['chc-puntos', selectedCompany], queryFn: () => api.chcListPuntos(selectedCompany) })
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Sucursales / Puntos CHC</h3>
        <p className="text-sm text-muted-foreground">Empresa <b>{selectedCompany}</b>. Configuración por punto: modelo de cheque y afectación a CxP.</p>
      </div>
      {isLoading ? <Skeleton className="h-32 w-full" /> : (
        <div className="rounded border">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Punto</TableHead><TableHead>Descripción</TableHead><TableHead>Activo</TableHead>
              <TableHead>Modelo cheque</TableHead><TableHead>Afecta CxP</TableHead>
              <TableHead>Registrar fecha futura</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.map((p: any) => (
                <TableRow key={p.punto}>
                  <TableCell className="font-mono">{p.punto}</TableCell>
                  <TableCell>{p.descri}</TableCell>
                  <TableCell><Badge variant={p.activo === 'S' ? 'default' : 'secondary'}>{p.activo === 'S' ? 'Sí' : 'No'}</Badge></TableCell>
                  <TableCell>{p.modelo_cheque}</TableCell>
                  <TableCell>{p.afectar_cxp === 'S' ? 'Sí' : 'No'}</TableCell>
                  <TableCell>{p.registrar_docu_fecha_futura === 'S' ? 'Sí' : 'No'}</TableCell>
                </TableRow>
              ))}
              {!isLoading && data.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sin puntos para esta empresa.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
