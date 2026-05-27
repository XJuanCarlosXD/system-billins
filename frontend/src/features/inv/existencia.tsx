import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadCsv } from '@/lib/csv-utils'

interface Existencia {
  almacen: string
  no_produ: string
  descri: string
  exist_actual: number
  exist_minima: number
  exist_maxima: number
  costo_actual: number
  valor_inventario: number
  grupo_produ: string
  linea: string
  activo: string
}

const fmt = (n: number) => n?.toLocaleString('es-DO', { minimumFractionDigits: 2 }) ?? '0.00'
const fmtQty = (n: number) => n?.toLocaleString('es-DO', { minimumFractionDigits: 2 }) ?? '0.00'

export function InvExistencia() {
  const { selectedCompany: noCia, selectedPoint: punto } = useCompany()
  const [search, setSearch] = useState('')
  const [almacen, setAlmacen] = useState('')
  const [query, setQuery] = useState({ search: '', almacen: '' })

  const { data: rows = [], isLoading } = useQuery<Existencia[]>({
    queryKey: ['inv-existencia', noCia, punto, query.search, query.almacen],
    queryFn: () => api.invListExistencia({
      no_cia: noCia || '', punto: punto || '',
      search: query.search, almacen: query.almacen,
    }),
    enabled: !!noCia,
  })

  function buscar() { setQuery({ search: search.trim(), almacen: almacen.trim() }) }

  const totalValor = rows.reduce((s, r) => s + (r.valor_inventario || 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Buscar producto</p>
          <Input placeholder="Código o descripción" value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && buscar()} className="w-56" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Almacén</p>
          <Input placeholder="Ej: 01" value={almacen}
            onChange={e => setAlmacen(e.target.value)} className="w-24" />
        </div>
        <Button onClick={buscar}>Consultar</Button>
        {rows.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => downloadCsv(rows.map(r => ({
            'Almacén': r.almacen, 'Código': r.no_produ, 'Descripción': r.descri,
            'Existencia': fmtQty(r.exist_actual), 'Mín': fmtQty(r.exist_minima),
            'Máx': fmtQty(r.exist_maxima), 'Costo': fmt(r.costo_actual),
            'Valor': fmt(r.valor_inventario),
          })), 'inv-existencia.csv')}>
            Excel
          </Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">{rows.length} productos</span>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Almacén</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Existencia</TableHead>
              <TableHead className="text-right">Mín</TableHead>
              <TableHead className="text-right">Máx</TableHead>
              <TableHead className="text-right">Costo</TableHead>
              <TableHead className="text-right">Valor Inventario</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
            )}
            {!isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                Ingrese un criterio de búsqueda y presione Consultar
              </TableCell></TableRow>
            )}
            {rows.map((r, i) => (
              <TableRow key={`${r.almacen}-${r.no_produ}-${i}`} className={`text-sm ${r.exist_actual < r.exist_minima && r.exist_minima > 0 ? 'bg-red-50' : ''}`}>
                <TableCell className="font-mono text-xs">{r.almacen}</TableCell>
                <TableCell className="font-mono text-xs">{r.no_produ}</TableCell>
                <TableCell>{r.descri}</TableCell>
                <TableCell className={`text-right font-medium ${r.exist_actual < r.exist_minima && r.exist_minima > 0 ? 'text-red-700' : ''}`}>
                  {fmtQty(r.exist_actual)}
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">{fmtQty(r.exist_minima)}</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">{fmtQty(r.exist_maxima)}</TableCell>
                <TableCell className="text-right text-xs">{fmt(r.costo_actual)}</TableCell>
                <TableCell className="text-right font-medium">{fmt(r.valor_inventario)}</TableCell>
              </TableRow>
            ))}
            {rows.length > 0 && (
              <TableRow className="bg-muted/50 font-semibold border-t-2">
                <TableCell colSpan={7} className="text-right text-sm">Total Valor Inventario:</TableCell>
                <TableCell className="text-right font-bold text-blue-700">{fmt(totalValor)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}