// Modal compartido para buscar y seleccionar un documento (factura / entrada
// de compra / etc.) que servirá como ORIGEN de una devolución. El padre define
// el `source` (inv | fat) y los tipos permitidos. Al seleccionar uno, devuelve
// {tipo, no_docu} para que el padre dispare su carga de líneas.
import { useEffect, useMemo, useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

export type DocSource = 'inv' | 'fat'

export interface DocRow {
  tipo: string // tipo_docu / tipo_factura
  no_docu: string
  fecha?: string
  desc_tipo?: string
  desc_almacen?: string
  total?: number
  cliente?: string
  proveedor?: string
  estado?: string
  st_anulado?: string
}

export interface TipoOpt {
  value: string
  label: string
}

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (row: DocRow) => void

  /** 'inv' usa /inv/documentos/, 'fat' usa /fat/facturas/. */
  source: DocSource
  /** Tipos disponibles en el filtro. Si solo uno, se fija. */
  tipos: TipoOpt[]
  defaultTipo: string
  /** Forzado por backend en ambas APIs. */
  noCia: string
  /** Solo aplica a 'fat'. */
  punto: string
  /** Título del modal. */
  title?: string
}

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function fmtN(n?: number) {
  if (n == null) return '—'
  return Number(n).toLocaleString('es-DO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function fmtDate(s?: string) {
  if (!s) return '—'
  const d = s.slice(0, 10)
  if (d.length !== 10) return d
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function BuscarDocumentoModal({
  open,
  onClose,
  onSelect,
  source,
  tipos,
  defaultTipo,
  noCia,
  punto,
  title,
}: Props) {
  const today = new Date()
  const thirtyAgo = new Date(today)
  thirtyAgo.setDate(today.getDate() - 30)

  const [tipo, setTipo] = useState(defaultTipo)
  const [desde, setDesde] = useState(toInputDate(thirtyAgo))
  const [hasta, setHasta] = useState(toInputDate(today))
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [rows, setRows] = useState<DocRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setTipo(defaultTipo)
      setSearch('')
      setDebouncedSearch('')
      setRows([])
      setError('')
      setDesde(toInputDate(thirtyAgo))
      setHasta(toInputDate(today))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultTipo])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError('')
    const qs = new URLSearchParams()
    if (source === 'inv') {
      qs.set('no_cia', noCia)
      if (tipo) qs.set('tipo_docu', tipo)
      if (desde) qs.set('desde', desde)
      if (hasta) qs.set('hasta', hasta)
      qs.set('limit', '60')
      apiFetch<any>(`/inv/documentos/?${qs}`)
        .then((d) => {
          const items = (d.results || d.items || []) as any[]
          const norm: DocRow[] = items.map((r) => ({
            tipo: r.tipo_docu,
            no_docu: String(r.no_docu),
            fecha: r.fecha,
            desc_tipo: r.desc_tipo_docu,
            desc_almacen: r.desc_almacen,
            total: Number(r.total) || 0,
            estado: r.estado,
            st_anulado: r.st_anulado,
          }))
          setRows(norm)
        })
        .catch((e) => setError(e?.message || 'Error'))
        .finally(() => setLoading(false))
    } else {
      qs.set('no_cia', noCia)
      qs.set('punto', punto)
      if (tipo) qs.set('tipo', tipo)
      if (desde) qs.set('desde', desde)
      if (hasta) qs.set('hasta', hasta)
      if (debouncedSearch) qs.set('search', debouncedSearch)
      qs.set('page_size', '60')
      apiFetch<any>(`/fat/facturas/?${qs}`)
        .then((d) => {
          const items = (d.items || d.results || []) as any[]
          const norm: DocRow[] = items.map((r) => ({
            tipo: r.tipo_factura || r.tipo_docu || r.tipo,
            no_docu: String(r.no_factura || r.no_docu || ''),
            fecha: r.fecha,
            cliente:
              r.nombre_cliente || r.cliente_nombre || `${r.no_cliente ?? ''}`,
            total: Number(r.total_neto ?? r.total) || 0,
            estado: r.estado,
            st_anulado: r.st_anulado,
          }))
          setRows(norm)
        })
        .catch((e) => setError(e?.message || 'Error'))
        .finally(() => setLoading(false))
    }
  }, [open, source, noCia, punto, tipo, desde, hasta, debouncedSearch])

  // Filtro local cuando es INV (que no soporta search en backend para este caso)
  const filtered = useMemo(() => {
    if (source !== 'inv' || !debouncedSearch.trim()) return rows
    const q = debouncedSearch.trim().toLowerCase()
    return rows.filter(
      (r) =>
        String(r.no_docu).toLowerCase().includes(q) ||
        (r.desc_tipo || '').toLowerCase().includes(q) ||
        (r.desc_almacen || '').toLowerCase().includes(q)
    )
  }, [rows, debouncedSearch, source])

  const handleSelect = (r: DocRow) => {
    onSelect(r)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent size='picker-lg'>
        <DialogHeader className='shrink-0 border-b bg-background px-6 py-3'>
          <DialogTitle className='text-base'>
            {title || 'Buscar documento'}
          </DialogTitle>
        </DialogHeader>

        <div className='shrink-0 border-b bg-background px-6 py-3'>
          <div className='grid grid-cols-2 items-end gap-2 md:grid-cols-5'>
            <div className='space-y-1'>
              <Label className='text-xs'>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className='h-8 text-xs'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tipos.map((t) => (
                    <SelectItem
                      key={t.value}
                      value={t.value}
                      className='text-xs'
                    >
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-1'>
              <Label className='text-xs'>Desde</Label>
              <Input
                type='date'
                className='h-8 text-xs'
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </div>

            <div className='space-y-1'>
              <Label className='text-xs'>Hasta</Label>
              <Input
                type='date'
                className='h-8 text-xs'
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
              />
            </div>

            <div className='space-y-1 md:col-span-2'>
              <Label className='text-xs'>Buscar</Label>
              <div className='relative'>
                <Search className='absolute top-2 left-2 h-3.5 w-3.5 text-muted-foreground' />
                <Input
                  className='h-8 pl-7 text-xs'
                  placeholder={
                    source === 'fat'
                      ? 'Cliente, no. factura...'
                      : 'No. doc, almacén, tipo...'
                  }
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
          </div>
        </div>

        <div className='flex-1 overflow-y-auto px-6 py-2'>
          {error && (
            <div className='my-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive'>
              {error}
            </div>
          )}
          <Table>
            <TableHeader className='sticky top-0 z-10 bg-background'>
              <TableRow>
                <TableHead className='w-20'>Tipo</TableHead>
                <TableHead className='w-32'>No. Documento</TableHead>
                <TableHead className='w-24'>Fecha</TableHead>
                <TableHead>
                  {source === 'fat' ? 'Cliente' : 'Almacén'}
                </TableHead>
                <TableHead className='w-28 text-right'>Total</TableHead>
                <TableHead className='w-24 text-center'>Estado</TableHead>
                <TableHead className='w-24 text-center'>Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className='py-10 text-center text-muted-foreground'
                  >
                    <Loader2 className='mr-2 inline h-4 w-4 animate-spin' />
                    Cargando...
                  </TableCell>
                </TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className='py-10 text-center text-sm text-muted-foreground'
                  >
                    No se encontraron documentos en el período
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                filtered.map((r) => {
                  const isAnul =
                    (r.st_anulado || 'N').toUpperCase() === 'S' ||
                    (r.estado || '').toUpperCase() === 'N'
                  return (
                    <TableRow
                      key={`${r.tipo}-${r.no_docu}`}
                      className={`${isAnul ? 'opacity-60' : 'cursor-pointer hover:bg-blue-50'}`}
                      onDoubleClick={() => !isAnul && handleSelect(r)}
                    >
                      <TableCell>
                        <span className='rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold'>
                          {r.tipo}
                        </span>
                      </TableCell>
                      <TableCell className='font-mono text-xs'>
                        {r.tipo}-{String(r.no_docu).padStart(7, '0')}
                      </TableCell>
                      <TableCell className='text-xs tabular-nums'>
                        {fmtDate(r.fecha)}
                      </TableCell>
                      <TableCell className='max-w-[300px] truncate text-xs'>
                        {source === 'fat'
                          ? r.cliente || '—'
                          : r.desc_almacen || '—'}
                      </TableCell>
                      <TableCell className='text-right font-mono text-xs font-semibold tabular-nums'>
                        RD$ {fmtN(r.total)}
                      </TableCell>
                      <TableCell className='text-center'>
                        {isAnul ? (
                          <span className='text-[10px] font-medium text-destructive uppercase'>
                            Anulado
                          </span>
                        ) : (
                          <span className='text-[10px] font-medium text-emerald-700 uppercase'>
                            {r.estado || 'A'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className='text-center'>
                        <Button
                          size='sm'
                          variant={isAnul ? 'ghost' : 'default'}
                          disabled={isAnul}
                          onClick={() => handleSelect(r)}
                        >
                          {isAnul ? '—' : 'Elegir'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
        </div>

        <div className='flex shrink-0 items-center justify-between border-t bg-background px-6 py-2 text-xs text-gray-500'>
          <span>
            {filtered.length} resultado{filtered.length === 1 ? '' : 's'}
          </span>
          <Button variant='outline' size='sm' onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
