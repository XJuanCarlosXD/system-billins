import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

interface Props { noCia: string; punto: string }

interface Transaccion {
  tipo_doc?: string
  no_transaccion?: string | number
  fecha?: string
  no_almacen?: string
  usuario?: string
  estado?: string
  [key: string]: any
}

async function fetchTransacciones(noCia: string): Promise<Transaccion[]> {
  // Try primary endpoint first
  const res = await fetch(
    `${API_BASE}/inv/transacciones/?no_cia=${encodeURIComponent(noCia)}&limit=50`,
    { credentials: 'include' },
  )
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`)
  const data = await res.json()
  return Array.isArray(data) ? data : (data.results ?? [])
}

function estadoBadge(estado: string | undefined) {
  if (!estado) return <Badge variant='outline'>—</Badge>
  const upper = estado.toUpperCase()
  if (upper === 'A' || upper === 'AUTORIZADA' || upper === 'APLICADA')
    return <Badge variant='default' className='bg-green-600 text-white'>{estado}</Badge>
  if (upper === 'P' || upper === 'PENDIENTE')
    return <Badge variant='secondary'>{estado}</Badge>
  if (upper === 'N' || upper === 'ANULADA')
    return <Badge variant='destructive'>{estado}</Badge>
  return <Badge variant='outline'>{estado}</Badge>
}

export function TransaccionesInv({ noCia }: Props) {
  const [rows, setRows] = useState<Transaccion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState<string>('todos')
  const [page, setPage] = useState(1)

  const load = () => {
    setLoading(true)
    setError(null)
    fetchTransacciones(noCia)
      .then(setRows)
      .catch((err) => setError(err.message ?? 'Error al cargar transacciones'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (noCia) load()
  }, [noCia])

  const filtered = useMemo(() => {
    let data = rows
    if (estadoFilter !== 'todos') {
      data = data.filter((r) =>
        String(r.estado ?? '').toUpperCase() === estadoFilter.toUpperCase(),
      )
    }
    const q = search.trim().toLowerCase()
    if (!q) return data
    return data.filter(
      (r) =>
        String(r.tipo_doc ?? '').toLowerCase().includes(q) ||
        String(r.no_transaccion ?? '').toLowerCase().includes(q) ||
        String(r.no_almacen ?? '').toLowerCase().includes(q) ||
        String(r.usuario ?? '').toLowerCase().includes(q),
    )
  }, [rows, search, estadoFilter])

  const PAGE_SIZE = 20
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Derive unique estados for the filter dropdown
  const estados = useMemo(() => {
    const set = new Set(rows.map((r) => r.estado ?? '').filter(Boolean))
    return Array.from(set).sort()
  }, [rows])

  const formatFecha = (value: string | undefined) => {
    if (!value) return '—'
    // ISO date or datetime — show date portion only
    return value.slice(0, 10)
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold'>Transacciones de Inventario</h2>
          <p className='text-sm text-muted-foreground'>Últimas 50 transacciones registradas.</p>
        </div>
        <div className='flex items-center gap-2'>
          <span className='text-sm text-muted-foreground'>{filtered.length} registros</span>
          <Button variant='outline' size='sm' onClick={load} disabled={loading}>
            Actualizar
          </Button>
        </div>
      </div>

      <div className='flex flex-wrap gap-3'>
        <div className='relative flex-1 min-w-48 rounded-xl border p-4'>
          <Search className='absolute left-6 top-6 h-4 w-4 text-muted-foreground' />
          <Input
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value) }}
            placeholder='Buscar por tipo doc, no. transacción, almacén...'
            className='h-9 pl-8'
          />
        </div>
        <div className='w-44'>
          <Select value={estadoFilter} onValueChange={(v) => { setPage(1); setEstadoFilter(v) }}>
            <SelectTrigger className='h-9'>
              <SelectValue placeholder='Estado' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='todos'>Todos los estados</SelectItem>
              {estados.map((e) => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className='rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400'>
          {error}
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-28'>Tipo Doc</TableHead>
            <TableHead className='w-36'>No. Transacción</TableHead>
            <TableHead className='w-28'>Fecha</TableHead>
            <TableHead className='w-28'>Almacén</TableHead>
            <TableHead>Usuario</TableHead>
            <TableHead className='w-28 text-center'>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell colSpan={6} className='py-10 text-center text-muted-foreground'>
                Cargando...
              </TableCell>
            </TableRow>
          )}
          {!loading && paged.map((row, idx) => (
            <TableRow key={`${row.tipo_doc}-${row.no_transaccion}-${idx}`}>
              <TableCell className='font-mono font-medium'>{row.tipo_doc ?? '—'}</TableCell>
              <TableCell className='font-mono'>{row.no_transaccion ?? '—'}</TableCell>
              <TableCell className='text-sm'>{formatFecha(row.fecha)}</TableCell>
              <TableCell className='font-mono'>{row.no_almacen ?? '—'}</TableCell>
              <TableCell className='text-sm'>{row.usuario ?? '—'}</TableCell>
              <TableCell className='text-center'>{estadoBadge(row.estado)}</TableCell>
            </TableRow>
          ))}
          {!loading && !error && filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className='py-10 text-center text-muted-foreground'>
                No se encontraron transacciones.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className='flex items-center justify-between text-sm'>
        <span className='text-muted-foreground'>Página {page} de {totalPages}</span>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
          <Button variant='outline' size='sm' disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
        </div>
      </div>
    </section>
  )
}
