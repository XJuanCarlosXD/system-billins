import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useCompany } from '@/context/company-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

interface Producto {
  no_produ: string
  descripcion: string
  [key: string]: any
}

interface ExistenciaRow {
  almacen: string
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

function fmt(n?: number) {
  return n == null
    ? '—'
    : n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function ExistenciaProducto() {
  const { selectedCompany } = useCompany()
  const noCia = selectedCompany || '01'

  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Producto[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null)
  const [loadingSugg, setLoadingSugg] = useState(false)

  const [rows, setRows] = useState<ExistenciaRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Autocomplete search
  useEffect(() => {
    const q = query.trim()
    if (!q || q.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setLoadingSugg(true)
      apiFetch<any>(`/inv/productos/?no_cia=${noCia}&search=${encodeURIComponent(q)}&limit=10`)
        .then((d) => {
          const items: Producto[] = Array.isArray(d) ? d : d.items ?? d.results ?? []
          setSuggestions(items)
          setShowSuggestions(items.length > 0)
        })
        .catch(() => setSuggestions([]))
        .finally(() => setLoadingSugg(false))
    }, 300)
  }, [query, noCia])

  // Load existencia when product selected
  useEffect(() => {
    if (!selectedProduct) {
      setRows([])
      return
    }
    setLoading(true)
    setError('')
    apiFetch<any>(`/inv/existencia/${encodeURIComponent(selectedProduct.no_produ)}/?no_cia=${noCia}`)
      .then((d) => {
        const items: ExistenciaRow[] = Array.isArray(d) ? d : d.items ?? d.results ?? []
        setRows(items)
      })
      .catch((e) => setError(e.message ?? 'Error al cargar existencia'))
      .finally(() => setLoading(false))
  }, [selectedProduct, noCia])

  function selectProduct(p: Producto) {
    setSelectedProduct(p)
    setQuery(`${p.no_produ} - ${p.descripcion}`)
    setSuggestions([])
    setShowSuggestions(false)
  }

  function clearProduct() {
    setSelectedProduct(null)
    setQuery('')
    setRows([])
    setError('')
    setSuggestions([])
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const totalExistencia = rows.reduce((acc, r) => acc + (r.existencia ?? 0), 0)
  const totalValor = rows.reduce((acc, r) => acc + (r.valor_total ?? 0), 0)

  return (
    <div className='space-y-4'>
      <div>
        <h2 className='text-lg font-semibold'>Existencia de Producto</h2>
        <p className='text-sm text-muted-foreground'>
          Consultar existencia de un producto por almacén
        </p>
      </div>

      {/* Product search */}
      <div className='relative max-w-xl'>
        <div className='relative flex items-center'>
          <Search className='absolute left-2.5 h-4 w-4 text-muted-foreground' />
          <Input
            ref={inputRef}
            placeholder='Buscar producto por código o descripción...'
            className='pl-8 pr-8 h-9'
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              if (selectedProduct) setSelectedProduct(null)
            }}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true)
            }}
            onBlur={() => {
              // Delay to allow click on suggestion
              setTimeout(() => setShowSuggestions(false), 150)
            }}
          />
          {(query || selectedProduct) && (
            <button
              type='button'
              className='absolute right-2 text-muted-foreground hover:text-foreground'
              onClick={clearProduct}
            >
              <X className='h-4 w-4' />
            </button>
          )}
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && (
          <div className='absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md'>
            {loadingSugg && (
              <div className='px-3 py-2 text-xs text-muted-foreground'>Buscando...</div>
            )}
            {!loadingSugg && suggestions.map((p) => (
              <button
                key={p.no_produ}
                type='button'
                className='w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-start gap-2'
                onMouseDown={() => selectProduct(p)}
              >
                <span className='font-mono text-xs text-muted-foreground mt-0.5 min-w-[80px]'>
                  {p.no_produ}
                </span>
                <span className='flex-1'>{p.descripcion}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected product info */}
      {selectedProduct && (
        <div className='flex items-center gap-3 rounded-md border bg-muted/40 px-4 py-2 text-sm'>
          <span className='font-mono text-xs font-medium text-muted-foreground'>
            {selectedProduct.no_produ}
          </span>
          <span className='font-medium'>{selectedProduct.descripcion}</span>
          {selectedProduct.unidad && (
            <span className='text-xs text-muted-foreground'>({selectedProduct.unidad})</span>
          )}
          <Button variant='ghost' size='sm' className='ml-auto h-7 gap-1 text-xs' onClick={clearProduct}>
            <X className='h-3 w-3' /> Cambiar
          </Button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className='rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive'>
          {error}
        </div>
      )}

      {/* Empty state when no product selected */}
      {!selectedProduct && !error && (
        <div className='rounded-md border-2 border-dashed p-12 text-center text-muted-foreground'>
          <Search className='h-8 w-8 mx-auto mb-3 opacity-30' />
          <p className='text-sm'>Busque un producto para ver su existencia por almacén</p>
        </div>
      )}

      {/* Table */}
      {selectedProduct && (
        <div className='rounded-md border overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-[100px]'>Almacén</TableHead>
                <TableHead>Descripción Almacén</TableHead>
                <TableHead className='text-right'>Existencia</TableHead>
                <TableHead className='text-right'>Costo Promedio</TableHead>
                <TableHead className='text-right'>Valor Total</TableHead>
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
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className='py-10 text-center text-muted-foreground'>
                    Sin existencia registrada para este producto
                  </TableCell>
                </TableRow>
              )}
              {!loading && rows.map((r, idx) => (
                <TableRow key={`${r.almacen}-${idx}`}>
                  <TableCell className='font-mono text-xs font-medium'>{r.almacen}</TableCell>
                  <TableCell className='text-sm'>{r.desc_almacen ?? '—'}</TableCell>
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
                  <TableCell colSpan={2} className='text-right text-xs'>Totales:</TableCell>
                  <TableCell className='text-right font-mono'>
                    {totalExistencia.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell />
                  <TableCell className='text-right font-mono'>
                    {totalValor.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <p className='text-xs text-muted-foreground text-right'>
          {rows.length} almacén(es) con existencia
        </p>
      )}
    </div>
  )
}
