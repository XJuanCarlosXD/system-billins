import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { downloadCsv } from '@/lib/csv-utils'

interface Producto {
  no_produ: string; descri: string; upc: string
  grupo_produ: string; linea: string; sub_linea: string; marca: string
  activo: string; servicio: string
  costo_mercado: number; costo_mercado_rd: number; precio_compra: number
  tiene_impuesto: string; porciento_impuesto: number
  indi_lote: string; usa_serie: string
}

interface CatItem { codigo: string; descri: string }

const SERVICIO_MAP: Record<string, { label: string; cls: string }> = {
  I: { label: 'Inventario', cls: 'bg-blue-100 text-blue-800' },
  S: { label: 'Servicio',   cls: 'bg-purple-100 text-purple-800' },
  K: { label: 'Kit',        cls: 'bg-teal-100 text-teal-800' },
  C: { label: 'Compuesto',  cls: 'bg-indigo-100 text-indigo-800' },
}

const fmt = (n: number) => n?.toLocaleString('es-DO', { minimumFractionDigits: 2 }) ?? '0.00'
const PAGE = 50

export function InvProductos() {
  const [search, setSearch] = useState('')
  const [grupo, setGrupo] = useState('')
  const [linea, setLinea] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)

  const { data: grupos = [] } = useQuery<CatItem[]>({
    queryKey: ['inv-grupos'],
    queryFn: () => api.invListGrupos(),
    staleTime: 300_000,
  })

  const { data: lineas = [] } = useQuery<CatItem[]>({
    queryKey: ['inv-lineas'],
    queryFn: () => api.invListLineas(),
    staleTime: 300_000,
  })

  const { data = [], isLoading, isError } = useQuery<Producto[]>({
    queryKey: ['inv-productos', search, grupo, linea],
    queryFn: () => api.invListProductos({ search, grupo, linea, activo: 'I' }),
    staleTime: 60_000,
  })

  const { data: detalle } = useQuery<Producto>({
    queryKey: ['inv-producto', selected],
    queryFn: () => api.invGetProducto(selected!),
    enabled: !!selected,
    staleTime: 60_000,
  })

  const totalPages = Math.max(1, Math.ceil(data.length / PAGE))
  const slice = data.slice((page - 1) * PAGE, page * PAGE)

  function exportExcel() {
    downloadCsv(data.map(r => ({
      Código: r.no_produ, Descripción: r.descri, Grupo: r.grupo_produ,
      Línea: r.linea, 'Costo USD': r.costo_mercado, 'Costo DOP': r.costo_mercado_rd,
      Tipo: SERVICIO_MAP[r.servicio]?.label ?? r.servicio,
    })), 'inv-productos.csv')
  }

  const tipoInfo = (s: string) => SERVICIO_MAP[s] ?? { label: s, cls: 'bg-gray-100 text-gray-600' }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="Buscar código o descripción…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-60"
          />
          <select
            className="border rounded px-3 py-2 text-sm"
            value={grupo}
            onChange={e => { setGrupo(e.target.value); setPage(1) }}
          >
            <option value="">Todos los grupos</option>
            {grupos.map(g => (
              <option key={g.codigo} value={g.codigo}>{g.codigo} — {g.descri}</option>
            ))}
          </select>
          <select
            className="border rounded px-3 py-2 text-sm"
            value={linea}
            onChange={e => { setLinea(e.target.value); setPage(1) }}
          >
            <option value="">Todas las líneas</option>
            {lineas.map(l => (
              <option key={l.codigo} value={l.codigo}>{l.codigo} — {l.descri}</option>
            ))}
          </select>
        </div>
        <Button variant="outline" size="sm" onClick={exportExcel}>Excel</Button>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Grupo</TableHead>
              <TableHead>Línea</TableHead>
              <TableHead className="text-right">Costo USD</TableHead>
              <TableHead className="text-right">Costo DOP</TableHead>
              <TableHead>Tipo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
            ) : isError ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-red-500">Error al cargar productos. Intente nuevamente.</TableCell></TableRow>
            ) : slice.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                {search || grupo || linea ? 'No se encontraron productos con los filtros actuales.' : 'Sin resultados.'}
              </TableCell></TableRow>
            ) : slice.map(p => (
              <TableRow key={p.no_produ} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(p.no_produ)}>
                <TableCell className="font-mono text-xs">{p.no_produ}</TableCell>
                <TableCell title={p.descri}>{p.descri}</TableCell>
                <TableCell className="text-xs">{p.grupo_produ}</TableCell>
                <TableCell className="text-xs">{p.linea}</TableCell>
                <TableCell className="text-right font-mono text-sm">{fmt(p.costo_mercado)}</TableCell>
                <TableCell className="text-right font-mono text-sm">{fmt(p.costo_mercado_rd)}</TableCell>
                <TableCell>
                  <Badge className={tipoInfo(p.servicio).cls}>{tipoInfo(p.servicio).label}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 text-sm items-center">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
          <span>Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={o => { if (!o) setSelected(null) }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{detalle?.descri ?? 'Cargando…'}</SheetTitle>
          </SheetHeader>
          {detalle && (
            <div className="mt-4 space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Código:</span> <span className="font-mono">{detalle.no_produ}</span></div>
                <div><span className="text-muted-foreground">UPC:</span> <span className="font-mono">{detalle.upc ?? '—'}</span></div>
                <div><span className="text-muted-foreground">Grupo:</span> {detalle.grupo_produ}{grupos.find(g => g.codigo === detalle.grupo_produ) ? ` — ${grupos.find(g => g.codigo === detalle.grupo_produ)!.descri}` : ''}</div>
                <div><span className="text-muted-foreground">Línea:</span> {detalle.linea}{lineas.find(l => l.codigo === detalle.linea) ? ` — ${lineas.find(l => l.codigo === detalle.linea)!.descri}` : ''}</div>
                <div><span className="text-muted-foreground">Marca:</span> {detalle.marca ?? '—'}</div>
                <div><span className="text-muted-foreground">Sub-línea:</span> {detalle.sub_linea ?? '—'}</div>
                <div><span className="text-muted-foreground">Costo USD:</span> {fmt(detalle.costo_mercado)}</div>
                <div><span className="text-muted-foreground">Costo DOP:</span> {fmt(detalle.costo_mercado_rd)}</div>
                <div><span className="text-muted-foreground">Precio Compra:</span> {fmt(detalle.precio_compra)}</div>
                <div>
                  <span className="text-muted-foreground">Aplica ITBIS:</span>{' '}
                  {detalle.tiene_impuesto === 'S' ? `Sí (${detalle.porciento_impuesto}%)` : 'No (Exento)'}
                </div>
                <div><span className="text-muted-foreground">Control Lote:</span> {detalle.indi_lote === 'S' ? 'Sí' : 'No'}</div>
                <div><span className="text-muted-foreground">Control Serie:</span> {detalle.usa_serie === 'S' ? 'Sí' : 'No'}</div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
