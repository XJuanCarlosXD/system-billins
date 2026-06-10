import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search } from 'lucide-react'

export function AccBeneficiarios() {
  const [search, setSearch] = useState('')
  const [activo, setActivo] = useState('S')
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['acc-bene', search, activo], queryFn: () => api.accListBeneficiarios({ search, activo }) })

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Beneficiarios</h3>
        <p className="text-sm text-muted-foreground">Personas/entidades que reciben pagos desde caja chica.</p>
      </div>
      <div className="flex items-end gap-3">
        <div className="grow max-w-md">
          <Label className="text-xs">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8 h-9" placeholder="Nombre / código / RNC…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div>
          <Label className="text-xs">Estado</Label>
          <select className="h-9 border rounded px-2 text-sm" value={activo} onChange={(e) => setActivo(e.target.value)}>
            <option value="S">Activos</option>
            <option value="N">Inactivos</option>
            <option value="">Todos</option>
          </select>
        </div>
        <div className="ml-auto text-sm text-muted-foreground">{data.length} beneficiarios</div>
      </div>
      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="rounded border">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Código</TableHead><TableHead>Nombre</TableHead><TableHead>Tipo</TableHead>
              <TableHead>RNC/Cédula</TableHead><TableHead>Activo</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.slice(0, 500).map((b: any) => (
                <TableRow key={b.no_bene}>
                  <TableCell className="font-mono">{b.no_bene}</TableCell>
                  <TableCell>{b.nombre}</TableCell>
                  <TableCell className="text-xs">{b.tipo_bene} — {b.tipo_desc}</TableCell>
                  <TableCell className="font-mono text-xs">{b.rnc}</TableCell>
                  <TableCell><Badge variant={b.activo === 'S' ? 'default' : 'secondary'}>{b.activo === 'S' ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                </TableRow>
              ))}
              {!isLoading && data.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sin beneficiarios para el filtro.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
