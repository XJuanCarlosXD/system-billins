import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

interface Props { noCia: string; punto: string }

interface TipoDocumento {
  tipo_doc: string
  descripcion: string
  tipo_transaccion?: string | null
  tipo_mov?: string | null
  cuenta?: string | null
  centro_costo?: string | null
  [key: string]: any
}

async function fetchTiposDocumento(noCia: string): Promise<TipoDocumento[]> {
  const res = await fetch(`${API_BASE}/inv/tipos-docu/?no_cia=${encodeURIComponent(noCia)}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`)
  const data = await res.json()
  return Array.isArray(data) ? data : (data.results ?? [])
}

const TIPO_DOC_COLORS: Record<string, string> = {
  DC: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200',
  DV: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-200',
  EA: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200',
  EP: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900 dark:text-teal-200',
  SP: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-200',
  AS: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200',
  AE: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900 dark:text-amber-200',
  SA: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900 dark:text-rose-200',
  TA: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900 dark:text-indigo-200',
  EC: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900 dark:text-cyan-200',
}

export function TiposDocumento({ noCia }: Props) {
  const [rows, setRows] = useState<TipoDocumento[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const load = () => {
    setLoading(true)
    setError(null)
    fetchTiposDocumento(noCia)
      .then(setRows)
      .catch((err) => setError(err.message ?? 'Error al cargar tipos de documento'))
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
        String(r.tipo_doc ?? '').toLowerCase().includes(q) ||
        String(r.descripcion ?? '').toLowerCase().includes(q) ||
        String(r.tipo_transaccion ?? '').toLowerCase().includes(q) ||
        String(r.tipo_mov ?? '').toLowerCase().includes(q),
    )
  }, [rows, search])

  const PAGE_SIZE = 20
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold'>Tipos de Documento</h2>
          <p className='text-sm text-muted-foreground'>Mantenimiento de tipos de documento de inventario (FINV112).</p>
        </div>
        <span className='text-sm text-muted-foreground'>{filtered.length} registros</span>
      </div>

      <div className='relative rounded-xl border p-4'>
        <Search className='absolute left-6 top-6 h-4 w-4 text-muted-foreground' />
        <Input
          value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value) }}
          placeholder='Filtrar por tipo, descripción o transacción...'
          className='h-9 pl-8'
        />
      </div>

      {error && (
        <div className='rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400'>
          {error}
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-24'>Tipo Doc.</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className='w-40'>Tipo Transacción</TableHead>
            <TableHead className='w-32'>Tipo Mov.</TableHead>
            <TableHead className='w-40'>Cuenta</TableHead>
            <TableHead className='w-36'>Centro Costo</TableHead>
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
          {!loading && paged.map((row) => {
            const colorClass = TIPO_DOC_COLORS[row.tipo_doc] ?? 'bg-gray-100 text-gray-800 border-gray-200'
            return (
              <TableRow key={row.tipo_doc}>
                <TableCell>
                  <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-mono font-semibold ${colorClass}`}>
                    {row.tipo_doc}
                  </span>
                </TableCell>
                <TableCell>{row.descripcion}</TableCell>
                <TableCell className='text-sm text-muted-foreground'>{row.tipo_transaccion ?? '—'}</TableCell>
                <TableCell className='text-sm text-muted-foreground'>{row.tipo_mov ?? '—'}</TableCell>
                <TableCell className='font-mono text-sm'>{row.cuenta ?? '—'}</TableCell>
                <TableCell className='font-mono text-sm'>{row.centro_costo ?? '—'}</TableCell>
              </TableRow>
            )
          })}
          {!loading && !error && filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className='py-10 text-center text-muted-foreground'>
                No se encontraron tipos de documento.
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
