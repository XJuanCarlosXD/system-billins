import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useCompany } from '@/context/company-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

interface Movimiento {
  tipo_docu?: string
  no_movim?: string | number
  no_produ?: string
  descripcion?: string
  almacen?: string
  desc_almacen?: string
  fecha?: string
  cantidad?: number
  costo?: number
  usuario?: string
  [key: string]: any
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function MovimientosInv() {
  const { selectedCompany } = useCompany()

  // Default: last 30 days
  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(today.getDate() - 30)

  const [desde, setDesde] = useState(toInputDate(thirtyDaysAgo))
  const [hasta, setHasta] = useState(toInputDate(today))
  const [almacen, setAlmacen] = useState('__all__')
  const [tipoDocu, setTipoDocu] = useState('__all__')
  const [noProdu, setNoProdu] = useState('')

  const [rows, setRows] = useState<Movimiento[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [almacenes, setAlmacenes] = useState<any[]>([])
  const [tiposDocu, setTiposDocu] = useState<any[]>([])

  // Load almacenes and tipos de documento once
  useEffect(() => {
    if (!selectedCompany) return

    apiFetch<any>(`/inv/almacenes/?no_cia=${selectedCompany}`)
      .then((data) => {
        const items = Array.isArray(data) ? data : data.items ?? data.results ?? []
        setAlmacenes(items)
      })
      .catch(() => setAlmacenes([]))

    // Try to load document types for the inv module
    apiFetch<any>(`/inv/tipos-documento/?no_cia=${selectedCompany}`)
      .then((data) => {
        const items = Array.isArray(data) ? data : data.items ?? data.results ?? []
        setTiposDocu(items)
      })
      .catch(() => setTiposDocu([]))
  }, [selectedCompany])

  // Load movimientos
  useEffect(() => {
    if (!selectedCompany) return
    setLoading(true)
    setError('')

    const qs = new URLSearchParams({ no_cia: selectedCompany })
    if (desde) qs.set('desde', desde)
    if (hasta) qs.set('hasta', hasta)
    if (almacen && almacen !== '__all__') qs.set('almacen', almacen)
    if (tipoDocu && tipoDocu !== '__all__') qs.set('tipo', tipoDocu)
    if (noProdu) qs.set('no_produ', noProdu)

    apiFetch<any>(`/inv/movimientos/?${qs.toString()}`)
      .then((data) => {
        const items = Array.isArray(data) ? data : data.items ?? data.results ?? []
        setRows(items)
      })
      .catch((err) => setError(err.message ?? 'Error al cargar movimientos'))
      .finally(() => setLoading(false))
  }, [selectedCompany, desde, hasta, almacen, tipoDocu, noProdu])

  const fmt = (n?: number) =>
    n == null ? '—' : n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const fmtDate = (s?: string) => {
    if (!s) return '—'
    // Accept ISO date or datetime
    return s.slice(0, 10)
  }

  const reset = () => {
    setDesde(toInputDate(thirtyDaysAgo))
    setHasta(toInputDate(today))
    setAlmacen('__all__')
    setTipoDocu('__all__')
    setNoProdu('')
  }

  const hasFilters = almacen !== '__all__' || tipoDocu !== '__all__' || noProdu

  return (
    <div className='space-y-4'>
      {/* Header */}
      <div>
        <h2 className='text-lg font-semibold'>Movimientos de Inventario</h2>
        <p className='text-sm text-muted-foreground'>
          Entradas, salidas y ajustes por período
        </p>
      </div>

      {/* Filters */}
      <div className='flex flex-wrap gap-2 items-end'>
        {/* Date range */}
        <div className='flex items-center gap-1'>
          <label className='text-xs text-muted-foreground whitespace-nowrap'>Desde:</label>
          <Input
            type='date'
            className='h-9 w-[140px] text-sm'
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </div>
        <div className='flex items-center gap-1'>
          <label className='text-xs text-muted-foreground whitespace-nowrap'>Hasta:</label>
          <Input
            type='date'
            className='h-9 w-[140px] text-sm'
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </div>

        <Select value={almacen} onValueChange={setAlmacen}>
          <SelectTrigger className='h-9 w-[180px]'>
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

        <Select value={tipoDocu} onValueChange={setTipoDocu}>
          <SelectTrigger className='h-9 w-[180px]'>
            <SelectValue placeholder='Tipo Doc.' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='__all__'>Todos los tipos</SelectItem>
            {tiposDocu.map((t: any) => {
              const key = t.tipo_docu ?? t.codigo ?? t.id
              return (
                <SelectItem key={key} value={String(key)}>
                  {key} - {t.descripcion ?? ''}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>

        <div className='relative'>
          <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
          <Input
            placeholder='Código producto...'
            className='pl-8 h-9 w-[160px]'
            value={noProdu}
            onChange={(e) => setNoProdu(e.target.value)}
          />
        </div>

        {hasFilters && (
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
              <TableHead>Tipo Doc</TableHead>
              <TableHead>No. Mov.</TableHead>
              <TableHead className='min-w-[100px]'>Producto</TableHead>
              <TableHead className='min-w-[180px]'>Descripción</TableHead>
              <TableHead>Almacén</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className='text-right'>Cantidad</TableHead>
              <TableHead className='text-right'>Costo</TableHead>
              <TableHead>Usuario</TableHead>
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
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className='py-10 text-center text-muted-foreground'>
                  No se encontraron movimientos en el período seleccionado
                </TableCell>
              </TableRow>
            )}
            {!loading && rows.map((r, idx) => (
              <TableRow key={`${r.tipo_docu}-${r.no_movim}-${idx}`}>
                <TableCell>
                  <span className='rounded bg-muted px-1.5 py-0.5 text-xs font-mono'>
                    {r.tipo_docu ?? '—'}
                  </span>
                </TableCell>
                <TableCell className='font-mono text-xs'>{r.no_movim ?? '—'}</TableCell>
                <TableCell className='font-mono text-xs font-medium'>{r.no_produ ?? '—'}</TableCell>
                <TableCell className='text-xs max-w-[200px] truncate'>{r.descripcion ?? '—'}</TableCell>
                <TableCell className='text-xs text-muted-foreground'>
                  {r.desc_almacen ?? r.almacen ?? '—'}
                </TableCell>
                <TableCell className='text-xs tabular-nums'>{fmtDate(r.fecha)}</TableCell>
                <TableCell className='text-right font-mono text-xs'>
                  {r.cantidad != null
                    ? r.cantidad.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : '—'}
                </TableCell>
                <TableCell className='text-right font-mono text-xs'>{fmt(r.costo)}</TableCell>
                <TableCell className='text-xs text-muted-foreground'>{r.usuario ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {!loading && rows.length > 0 && (
        <p className='text-xs text-muted-foreground text-right'>
          {rows.length} movimientos mostrados
        </p>
      )}
    </div>
  )
}
