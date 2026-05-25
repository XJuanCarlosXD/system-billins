import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

interface Props { noCia: string; punto: string }

interface Linea {
  linea: string
  descripcion: string
  [key: string]: any
}

interface SubLinea {
  linea: string
  sub_linea: string
  descripcion: string
  porc_comision?: number | null
  porc_margen?: number | null
  [key: string]: any
}

async function fetchLineas(noCia: string): Promise<Linea[]> {
  const res = await fetch(`${API_BASE}/inv/lineas/?no_cia=${encodeURIComponent(noCia)}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`)
  const data = await res.json()
  return Array.isArray(data) ? data : (data.results ?? [])
}

async function fetchSubLineas(noCia: string, linea: string): Promise<SubLinea[]> {
  const params = new URLSearchParams({ no_cia: noCia })
  if (linea) params.set('linea', linea)
  const res = await fetch(`${API_BASE}/inv/sublineas/?${params.toString()}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`)
  const data = await res.json()
  return Array.isArray(data) ? data : (data.results ?? [])
}

export function SubLineasProductos({ noCia }: Props) {
  const [lineas, setLineas] = useState<Linea[]>([])
  const [selectedLinea, setSelectedLinea] = useState<string>('')
  const [rows, setRows] = useState<SubLinea[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (noCia) {
      fetchLineas(noCia).then(setLineas).catch(() => {})
    }
  }, [noCia])

  const load = () => {
    setLoading(true)
    setError(null)
    fetchSubLineas(noCia, selectedLinea)
      .then(setRows)
      .catch((err) => setError(err.message ?? 'Error al cargar sublíneas'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (noCia) load()
  }, [noCia, selectedLinea])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        String(r.linea ?? '').toLowerCase().includes(q) ||
        String(r.sub_linea ?? '').toLowerCase().includes(q) ||
        String(r.descripcion ?? '').toLowerCase().includes(q),
    )
  }, [rows, search])

  const PAGE_SIZE = 20
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold'>Sub Líneas de Productos</h2>
          <p className='text-sm text-muted-foreground'>Catálogo de sublíneas para la clasificación detallada de productos.</p>
        </div>
        <span className='text-sm text-muted-foreground'>{filtered.length} registros</span>
      </div>

      <div className='flex flex-wrap gap-3'>
        <Select
          value={selectedLinea || '__all__'}
          onValueChange={(v) => { setPage(1); setSelectedLinea(v === '__all__' ? '' : v) }}
        >
          <SelectTrigger className='h-9 w-56'>
            <SelectValue placeholder='Todas las líneas' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='__all__'>Todas las líneas</SelectItem>
            {lineas.map((l) => (
              <SelectItem key={l.linea} value={l.linea}>
                {l.linea} — {l.descripcion}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className='relative flex-1'>
          <Search className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' />
          <Input
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value) }}
            placeholder='Filtrar por código o descripción...'
            className='h-9 pl-8'
          />
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
            <TableHead className='w-28'>Línea</TableHead>
            <TableHead className='w-32'>Sub Línea</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className='text-right w-32'>% Comisión</TableHead>
            <TableHead className='text-right w-32'>% Margen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell colSpan={5} className='py-10 text-center text-muted-foreground'>
                Cargando...
              </TableCell>
            </TableRow>
          )}
          {!loading && paged.map((row, idx) => (
            <TableRow key={`${row.linea}-${row.sub_linea}-${idx}`}>
              <TableCell>
                <Badge variant='outline' className='font-mono'>{row.linea}</Badge>
              </TableCell>
              <TableCell className='font-mono font-medium'>{row.sub_linea}</TableCell>
              <TableCell>{row.descripcion}</TableCell>
              <TableCell className='text-right font-mono'>
                {row.porc_comision != null ? `${Number(row.porc_comision).toFixed(2)}%` : '—'}
              </TableCell>
              <TableCell className='text-right font-mono'>
                {row.porc_margen != null ? `${Number(row.porc_margen).toFixed(2)}%` : '—'}
              </TableCell>
            </TableRow>
          ))}
          {!loading && !error && filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className='py-10 text-center text-muted-foreground'>
                No se encontraron sublíneas de productos.
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
