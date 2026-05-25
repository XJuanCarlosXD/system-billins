import { useEffect, useState } from 'react'
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useCompany } from '@/context/company-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

interface Producto {
  no_produ: string
  descripcion: string
  linea?: string
  desc_linea?: string
  grupo?: string
  desc_grupo?: string
  costo?: number
  precio?: number
  itbis?: number
  unidad?: string
  empaque?: string
  activo?: string
  [key: string]: any
}

interface PaginatedResponse {
  items?: Producto[]
  results?: Producto[]
  count?: number
  total?: number
  next?: string | null
  previous?: string | null
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function CatalogoProductos() {
  const { selectedCompany } = useCompany()

  const [search, setSearch] = useState('')
  const [grupo, setGrupo] = useState('__all__')
  const [linea, setLinea] = useState('__all__')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const [productos, setProductos] = useState<Producto[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [grupos, setGrupos] = useState<any[]>([])
  const [lineas, setLineas] = useState<any[]>([])

  const [selected, setSelected] = useState<Producto | null>(null)

  // Load catalogues once
  useEffect(() => {
    if (!selectedCompany) return
    apiFetch<any>(`/inv/grupos/?no_cia=${selectedCompany}`)
      .then((data) => {
        const items = Array.isArray(data) ? data : data.items ?? data.results ?? []
        setGrupos(items)
      })
      .catch(() => setGrupos([]))

    apiFetch<any>(`/inv/lineas/?no_cia=${selectedCompany}`)
      .then((data) => {
        const items = Array.isArray(data) ? data : data.items ?? data.results ?? []
        setLineas(items)
      })
      .catch(() => setLineas([]))
  }, [selectedCompany])

  // Load products
  useEffect(() => {
    if (!selectedCompany) return
    setLoading(true)
    setError('')
    const offset = (page - 1) * pageSize
    const qs = new URLSearchParams({
      no_cia: selectedCompany,
      limit: String(pageSize),
      offset: String(offset),
    })
    if (search) qs.set('search', search)
    if (grupo && grupo !== '__all__') qs.set('grupo', grupo)
    if (linea && linea !== '__all__') qs.set('linea', linea)

    apiFetch<PaginatedResponse>(`/inv/productos/?${qs.toString()}`)
      .then((data) => {
        const items = data.items ?? data.results ?? (Array.isArray(data) ? (data as any) : [])
        const count = data.count ?? data.total ?? (Array.isArray(data) ? (data as any).length : 0)
        setProductos(items)
        setTotal(count)
      })
      .catch((err) => setError(err.message ?? 'Error al cargar productos'))
      .finally(() => setLoading(false))
  }, [selectedCompany, search, grupo, linea, page, pageSize])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const fmt = (n?: number) =>
    n == null ? '—' : n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const reset = () => {
    setSearch('')
    setGrupo('__all__')
    setLinea('__all__')
    setPage(1)
  }

  return (
    <div className='space-y-4'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-lg font-semibold'>Catálogo de Productos</h2>
          <p className='text-sm text-muted-foreground'>
            {total > 0 ? `${total.toLocaleString()} productos` : 'Empresa: ' + selectedCompany}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className='flex flex-wrap gap-2'>
        <div className='relative flex-1 min-w-[200px]'>
          <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
          <Input
            placeholder='Buscar código o descripción...'
            className='pl-8 h-9'
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>

        <Select value={linea} onValueChange={(v) => { setLinea(v); setPage(1) }}>
          <SelectTrigger className='h-9 w-[180px]'>
            <SelectValue placeholder='Línea' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='__all__'>Todas las líneas</SelectItem>
            {lineas.map((l: any) => (
              <SelectItem key={l.linea ?? l.codigo ?? l.id} value={String(l.linea ?? l.codigo ?? l.id)}>
                {l.descripcion ?? l.linea}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={grupo} onValueChange={(v) => { setGrupo(v); setPage(1) }}>
          <SelectTrigger className='h-9 w-[180px]'>
            <SelectValue placeholder='Grupo' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='__all__'>Todos los grupos</SelectItem>
            {grupos.map((g: any) => (
              <SelectItem key={g.grupo ?? g.codigo ?? g.id} value={String(g.grupo ?? g.codigo ?? g.id)}>
                {g.descripcion ?? g.grupo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(search || grupo !== '__all__' || linea !== '__all__') && (
          <Button variant='ghost' size='sm' className='h-9 gap-1' onClick={reset}>
            <X className='h-3.5 w-3.5' /> Limpiar
          </Button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className='rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive'>
          {error}
        </div>
      )}

      {/* Table */}
      <div className='rounded-md border overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='min-w-[100px]'>Código</TableHead>
              <TableHead className='min-w-[200px]'>Descripción</TableHead>
              <TableHead>Línea</TableHead>
              <TableHead>Grupo</TableHead>
              <TableHead className='text-right'>Costo</TableHead>
              <TableHead className='text-right'>Precio</TableHead>
              <TableHead className='text-center'>ITBIS%</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead>Empaque</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={9} className='py-10 text-center text-muted-foreground'>
                  Cargando...
                </TableCell>
              </TableRow>
            )}
            {!loading && productos.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className='py-10 text-center text-muted-foreground'>
                  No se encontraron productos
                </TableCell>
              </TableRow>
            )}
            {!loading && productos.map((p) => (
              <TableRow
                key={p.no_produ}
                className='cursor-pointer hover:bg-muted/50'
                onClick={() => setSelected(p)}
              >
                <TableCell className='font-mono text-xs font-medium'>{p.no_produ}</TableCell>
                <TableCell className='max-w-[240px] truncate text-sm'>{p.descripcion}</TableCell>
                <TableCell className='text-xs text-muted-foreground'>{p.desc_linea ?? p.linea ?? '—'}</TableCell>
                <TableCell className='text-xs text-muted-foreground'>{p.desc_grupo ?? p.grupo ?? '—'}</TableCell>
                <TableCell className='text-right font-mono text-xs'>{fmt(p.costo)}</TableCell>
                <TableCell className='text-right font-mono text-xs'>{fmt(p.precio)}</TableCell>
                <TableCell className='text-center text-xs'>{p.itbis ?? '—'}</TableCell>
                <TableCell className='text-xs'>{p.unidad ?? '—'}</TableCell>
                <TableCell className='text-xs'>{p.empaque ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className='flex items-center justify-between text-sm'>
        <div className='flex items-center gap-2 text-muted-foreground'>
          <span>Filas por página:</span>
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}>
            <SelectTrigger className='h-7 w-[70px] text-xs'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[25, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>Página {page} de {totalPages} — {total.toLocaleString()} total</span>
        </div>
        <div className='flex gap-1'>
          <Button variant='outline' size='icon' className='h-7 w-7' disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className='h-4 w-4' />
          </Button>
          <Button variant='outline' size='icon' className='h-7 w-7' disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className='h-4 w-4' />
          </Button>
        </div>
      </div>

      {/* Detail dialog */}
      {selected && (
        <Dialog open onOpenChange={() => setSelected(null)}>
          <DialogContent className='max-w-lg'>
            <DialogHeader>
              <DialogTitle className='flex items-center gap-2'>
                <span className='font-mono text-base'>{selected.no_produ}</span>
                {selected.activo === 'N' && <Badge variant='secondary'>Inactivo</Badge>}
              </DialogTitle>
            </DialogHeader>
            <div className='space-y-3 text-sm'>
              <p className='font-medium'>{selected.descripcion}</p>
              <div className='grid grid-cols-2 gap-x-4 gap-y-2 text-sm'>
                <DetailRow label='Línea' value={selected.desc_linea ?? selected.linea} />
                <DetailRow label='Grupo' value={selected.desc_grupo ?? selected.grupo} />
                <DetailRow label='Costo' value={fmt(selected.costo)} mono />
                <DetailRow label='Precio' value={fmt(selected.precio)} mono />
                <DetailRow label='ITBIS %' value={selected.itbis != null ? String(selected.itbis) : undefined} />
                <DetailRow label='Unidad' value={selected.unidad} />
                <DetailRow label='Empaque' value={selected.empaque} />
              </div>
              {/* Remaining raw fields */}
              <div className='rounded-md bg-muted/40 p-3'>
                <p className='text-xs font-semibold text-muted-foreground mb-2'>Datos adicionales</p>
                <div className='grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground'>
                  {Object.entries(selected)
                    .filter(([k]) => !['no_produ','descripcion','linea','desc_linea','grupo','desc_grupo','costo','precio','itbis','unidad','empaque','activo'].includes(k))
                    .map(([k, v]) => (
                      <div key={k} className='flex gap-1'>
                        <span className='font-medium'>{k}:</span>
                        <span className='truncate'>{v == null ? '—' : String(v)}</span>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function DetailRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <p className='text-xs text-muted-foreground'>{label}</p>
      <p className={mono ? 'font-mono font-medium' : 'font-medium'}>{value ?? '—'}</p>
    </div>
  )
}
