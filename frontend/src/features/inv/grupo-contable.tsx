import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

interface Props { noCia: string; punto: string }

interface GrupoContable {
  grupo_contable: string
  descripcion: string
  inventario: string
  ajuste_inventario: string
  costo_venta_contado: string
  costo_venta_credito: string
  ingreso_venta_contado: string
  ingreso_venta_credito: string
  [key: string]: any
}

async function fetchGruposContables(noCia: string): Promise<GrupoContable[]> {
  const res = await fetch(`${API_BASE}/inv/grupos-contables/?no_cia=${encodeURIComponent(noCia)}`, {
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`)
  const data = await res.json()
  return Array.isArray(data) ? data : (data.results ?? [])
}

const PAGE_SIZE = 20

export function GrupoContable({ noCia }: Props) {
  const [rows, setRows] = useState<GrupoContable[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const load = () => {
    setLoading(true)
    setError(null)
    fetchGruposContables(noCia)
      .then(setRows)
      .catch((err) => setError(err.message ?? 'Error al cargar grupos contables'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (noCia) load()
  }, [noCia])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        String(r.grupo_contable ?? '').toLowerCase().includes(q) ||
        String(r.descripcion ?? '').toLowerCase().includes(q),
    )
  }, [rows, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold'>Grupo Contable</h2>
          <p className='text-sm text-muted-foreground'>Grupos contables para integración con contabilidad (FINV108).</p>
        </div>
        <span className='text-sm text-muted-foreground'>{filtered.length} registros</span>
      </div>

      <div className='relative rounded-xl border p-4'>
        <Search className='absolute left-6 top-6 h-4 w-4 text-muted-foreground' />
        <Input
          value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value) }}
          placeholder='Filtrar por código o descripción...'
          className='h-9 pl-8'
        />
      </div>

      {error && (
        <div className='rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400'>
          {error}
        </div>
      )}

      <div className='overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-36'>Grupo Contable</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Inventario</TableHead>
              <TableHead>Ajuste Inv.</TableHead>
              <TableHead>CV Contado</TableHead>
              <TableHead>CV Crédito</TableHead>
              <TableHead>IV Contado</TableHead>
              <TableHead>IV Crédito</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={8} className='py-10 text-center text-muted-foreground'>
                  Cargando...
                </TableCell>
              </TableRow>
            )}
            {!loading && paged.map((row) => (
              <TableRow key={row.grupo_contable}>
                <TableCell>
                  <Badge variant='outline' className='font-mono'>{row.grupo_contable}</Badge>
                </TableCell>
                <TableCell>{row.descripcion}</TableCell>
                <TableCell className='font-mono text-xs text-muted-foreground'>{row.inventario}</TableCell>
                <TableCell className='font-mono text-xs text-muted-foreground'>{row.ajuste_inventario}</TableCell>
                <TableCell className='font-mono text-xs text-muted-foreground'>{row.costo_venta_contado}</TableCell>
                <TableCell className='font-mono text-xs text-muted-foreground'>{row.costo_venta_credito}</TableCell>
                <TableCell className='font-mono text-xs text-muted-foreground'>{row.ingreso_venta_contado}</TableCell>
                <TableCell className='font-mono text-xs text-muted-foreground'>{row.ingreso_venta_credito}</TableCell>
              </TableRow>
            ))}
            {!loading && !error && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className='py-10 text-center text-muted-foreground'>
                  No se encontraron grupos contables.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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
