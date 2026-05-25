import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useCompany } from '@/context/company-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

interface Existencia {
  no_produ: string
  descripcion?: string
  almacen?: string
  desc_almacen?: string
  existencia?: number
  costo_prom?: number
  valor_total?: number
  [key: string]: any
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function ExistenciasInv() {
  const { selectedCompany } = useCompany()

  const [search, setSearch] = useState('')
  const [almacen, setAlmacen] = useState('__all__')

  const [rows, setRows] = useState<Existencia[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [almacenes, setAlmacenes] = useState<any[]>([])

  // Load almacenes once
  useEffect(() => {
    if (!selectedCompany) return
    apiFetch<any>(`/inv/almacenes/?no_cia=${selectedCompany}`)
      .then((data) => {
        const items = Array.isArray(data) ? data : data.items ?? data.results ?? []
        setAlmacenes(items)
      })
      .catch(() => setAlmacenes([]))
  }, [selectedCompany])

  // Load existencias
  useEffect(() => {
    if (!selectedCompany) return
    setLoading(true)
    setError('')
    const qs = new URLSearchParams({ no_cia: selectedCompany })
    if (almacen && almacen !== '__all__') qs.set('almacen', almacen)
    if (search) qs.set('search', search)

    apiFetch<any>(`/inv/existencia/?${qs.toString()}`)
      .then((data) => {
        const items = Array.isArray(data) ? data : data.items ?? data.results ?? []
        setRows(items)
      })
      .catch((err) => setError(err.message ?? 'Error al cargar existencias'))
      .finally(() => setLoading(false))
  }, [selectedCompany, almacen, search])

  const fmt = (n?: number) =>
    n == null ? '—' : n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const totalValor = rows.reduce((acc, r) => acc + (r.valor_total ?? 0), 0)

  const reset = () => {
    setSearch('')
    setAlmacen('__all__')
  }

  return (
    <div className='space-y-4'>
      {/* Header */}
      <div>
        <h2 className='text-lg font-semibold'>Existencias de Inventario</h2>
        <p className='text-sm text-muted-foreground'>
          Stock actual por producto y almacén
        </p>
      </div>

      {/* Filters */}
      <div className='flex flex-wrap gap-2'>
        <div className='relative flex-1 min-w-[200px]'>
          <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
          <Input
            placeholder='Buscar producto...'
            className='pl-8 h-9'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={almacen} onValueChange={setAlmacen}>
          <SelectTrigger className='h-9 w-[200px]'>
            <SelectValue placeholder='Almacén' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='__all__'>Todos los almacenes</SelectItem>
            {almacenes.map((a: any) => {
              const key = a.almacen ?? a.codigo ?? a.id
              return (
                <SelectItem key={key} value={String(key)}>
                  {a.descripcion ?? a.desc_almacen ?? key}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>

        {(search || almacen !== '__all__') && (
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
              <TableHead className='min-w-[100px]'>Producto</TableHead>
              <TableHead className='min-w-[200px]'>Descripción</TableHead>
              <TableHead>Almacén</TableHead>
              <TableHead className='text-right'>Existencia</TableHead>
              <TableHead className='text-right'>Costo Prom.</TableHead>
              <TableHead className='text-right'>Valor Total</TableHead>
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
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className='py-10 text-center text-muted-foreground'>
                  No se encontraron registros de existencia
                </TableCell>
              </TableRow>
            )}
            {!loading && rows.map((r, idx) => (
              <TableRow key={`${r.no_produ}-${r.almacen}-${idx}`}>
                <TableCell className='font-mono text-xs font-medium'>{r.no_produ}</TableCell>
                <TableCell className='text-sm max-w-[240px] truncate'>{r.descripcion ?? '—'}</TableCell>
                <TableCell className='text-xs text-muted-foreground'>
                  {r.desc_almacen ?? r.almacen ?? '—'}
                </TableCell>
                <TableCell className='text-right font-mono text-sm'>
                  {r.existencia != null
                    ? r.existencia.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : '—'}
                </TableCell>
                <TableCell className='text-right font-mono text-xs'>{fmt(r.costo_prom)}</TableCell>
                <TableCell className='text-right font-mono text-xs font-medium'>{fmt(r.valor_total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          {!loading && rows.length > 0 && (
            <TableFooter>
              <TableRow className='font-semibold bg-muted/50'>
                <TableCell colSpan={5} className='text-right'>Total Valor:</TableCell>
                <TableCell className='text-right font-mono'>
                  {totalValor.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      {!loading && rows.length > 0 && (
        <p className='text-xs text-muted-foreground text-right'>
          {rows.length} registros mostrados
        </p>
      )}
    </div>
  )
}
