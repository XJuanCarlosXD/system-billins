import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

const ENDPOINT_READY = false

interface Props {
  noCia: string
  punto: string
}

interface Almacen {
  almacen?: string
  codigo?: string
  descripcion?: string
  desc_almacen?: string
  [key: string]: any
}

interface DevVentaRow {
  id: number
  noProdu: string
  nombre: string
  cantidad: string
  precio: string
  almacen: string
}

interface ProductoResult {
  no_produ?: string
  codigo?: string
  descripcion?: string
  nombre?: string
  precio?: number
  precio_venta?: number
  [key: string]: any
}

let rowIdCounter = 400

function newRow(almacen = ''): DevVentaRow {
  return { id: rowIdCounter++, noProdu: '', nombre: '', cantidad: '', precio: '', almacen }
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function DevolucionVentas({ noCia, punto }: Props) {
  // Cabecera
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [almacenHeader, setAlmacenHeader] = useState('')

  // Cliente
  const [cliente, setCliente] = useState('')
  const [vendedor, setVendedor] = useState('')
  const [docOriginal, setDocOriginal] = useState('')
  const [ncf, setNcf] = useState('')

  // Totales
  const [pctItbis, setPctItbis] = useState('18')

  // Catalogs
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])

  // Grid
  const [rows, setRows] = useState<DevVentaRow[]>([newRow()])

  // Search
  const [searchIdx, setSearchIdx] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<ProductoResult[]>([])
  const [searching, setSearching] = useState(false)

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!noCia) return
    apiFetch<any>(`/inv/almacenes/?no_cia=${encodeURIComponent(noCia)}`)
      .then((data) => {
        const items: Almacen[] = Array.isArray(data) ? data : (data.results ?? data.items ?? [])
        setAlmacenes(items)
      })
      .catch(() => setAlmacenes([]))
  }, [noCia])

  const searchProducto = useCallback(async (term: string) => {
    if (!term.trim()) { setSearchResults([]); return }
    setSearching(true)
    try {
      const data = await apiFetch<any>(`/inv/productos/?no_cia=${encodeURIComponent(noCia)}&search=${encodeURIComponent(term)}&limit=10`)
      const items: ProductoResult[] = Array.isArray(data) ? data : (data.results ?? data.items ?? [])
      setSearchResults(items)
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [noCia])

  const updateRow = (idx: number, patch: Partial<DevVentaRow>) => {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))
  }

  const addRow = () => setRows((prev) => [...prev, newRow(almacenHeader)])

  const removeRow = (idx: number) => {
    setRows((prev) => prev.length === 1 ? [newRow(almacenHeader)] : prev.filter((_, i) => i !== idx))
  }

  const selectProducto = (idx: number, p: ProductoResult) => {
    updateRow(idx, {
      noProdu: p.no_produ ?? p.codigo ?? '',
      nombre: p.descripcion ?? p.nombre ?? '',
      precio: String(p.precio_venta ?? p.precio ?? ''),
    })
    setSearchIdx(null)
    setSearchTerm('')
    setSearchResults([])
  }

  const fmt = (n: number) => n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // Computed totals
  const totalBruto = rows.reduce((acc, r) => acc + (parseFloat(r.cantidad) || 0) * (parseFloat(r.precio) || 0), 0)
  const totalImpuesto = totalBruto * ((parseFloat(pctItbis) || 0) / 100)
  const totalNeto = totalBruto + totalImpuesto

  const handleSave = async () => {
    if (!ENDPOINT_READY) return
    if (!cliente.trim()) { toast.error('Ingrese el cliente'); return }
    const validRows = rows.filter((r) => r.noProdu.trim() && (parseFloat(r.cantidad) || 0) > 0)
    if (validRows.length === 0) { toast.error('Agregue al menos un producto con cantidad válida'); return }

    const payload = {
      no_cia: noCia,
      punto,
      fecha,
      almacen: almacenHeader,
      cliente,
      vendedor,
      doc_original: docOriginal,
      ncf,
      pct_itbis: parseFloat(pctItbis) || 0,
      detalle: validRows.map((r) => ({
        no_produ: r.noProdu,
        almacen: r.almacen || almacenHeader,
        cantidad: parseFloat(r.cantidad) || 0,
        precio: parseFloat(r.precio) || 0,
      })),
    }

    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/inv/devoluciones/venta/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail ?? errData.error ?? `HTTP ${res.status}`)
      }
      const created = await res.json()
      toast.success(`Devolución ${created.no_doc ?? ''} registrada correctamente`)
      setFecha(new Date().toISOString().slice(0, 10)); setAlmacenHeader('')
      setCliente(''); setVendedor(''); setDocOriginal(''); setNcf(''); setPctItbis('18')
      setRows([newRow()])
    } catch (err: any) {
      toast.error(`Error al guardar: ${err.message ?? 'Error desconocido'}`)
    } finally {
      setSaving(false)
    }
  }

  const almacenKey = (a: Almacen) => a.almacen ?? a.codigo ?? ''
  const almacenDesc = (a: Almacen) => a.descripcion ?? a.desc_almacen ?? almacenKey(a)

  return (
    <TooltipProvider>
      <section className='space-y-6'>
        <div>
          <h2 className='text-lg font-semibold'>Devolución de Ventas</h2>
          <p className='text-sm text-muted-foreground'>FINV201 — Registro de devoluciones de clientes al almacén</p>
        </div>

        {/* Cabecera */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Encabezado del Documento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'>
              <div className='space-y-1'>
                <Label htmlFor='dv-fecha'>Fecha</Label>
                <Input id='dv-fecha' type='date' className='h-9' value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>

              <div className='space-y-1'>
                <Label htmlFor='dv-almacen'>Almacén</Label>
                <Select value={almacenHeader} onValueChange={(v) => {
                  setAlmacenHeader(v)
                  setRows((prev) => prev.map((r) => ({ ...r, almacen: v })))
                }}>
                  <SelectTrigger id='dv-almacen' className='h-9'>
                    <SelectValue placeholder='Seleccionar...' />
                  </SelectTrigger>
                  <SelectContent>
                    {almacenes.map((a) => {
                      const k = almacenKey(a)
                      return <SelectItem key={k} value={k}>{k} — {almacenDesc(a)}</SelectItem>
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-1'>
                <Label htmlFor='dv-ncf'>Código NCF Devolución</Label>
                <Input id='dv-ncf' className='h-9 font-mono' placeholder='B0400000000' value={ncf} onChange={(e) => setNcf(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Datos del cliente */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Datos del Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'>
              <div className='space-y-1 col-span-2'>
                <Label htmlFor='dv-cliente'>Cliente</Label>
                <Input id='dv-cliente' className='h-9' placeholder='Nombre o código del cliente' value={cliente} onChange={(e) => setCliente(e.target.value)} />
              </div>

              <div className='space-y-1'>
                <Label htmlFor='dv-vendedor'>Vendedor</Label>
                <Input id='dv-vendedor' className='h-9' placeholder='Código del vendedor' value={vendedor} onChange={(e) => setVendedor(e.target.value)} />
              </div>

              <div className='space-y-1'>
                <Label htmlFor='dv-doc-original'>Documento de Venta Original</Label>
                <Input id='dv-doc-original' className='h-9 font-mono' placeholder='No. documento' value={docOriginal} onChange={(e) => setDocOriginal(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grid de productos */}
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-base'>Productos Devueltos</CardTitle>
            <Button variant='outline' size='sm' className='gap-1' onClick={addRow}>
              <Plus className='h-4 w-4' /> Agregar fila
            </Button>
          </CardHeader>
          <CardContent className='p-0'>
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-[130px]'>No. Producto</TableHead>
                    <TableHead className='min-w-[200px]'>Nombre / Descripción</TableHead>
                    <TableHead className='w-[120px]'>Almacén</TableHead>
                    <TableHead className='w-[110px] text-right'>Cantidad</TableHead>
                    <TableHead className='w-[120px] text-right'>Precio Unit.</TableHead>
                    <TableHead className='w-[120px] text-right'>Total</TableHead>
                    <TableHead className='w-[48px]'></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => {
                    const lineTotal = (parseFloat(row.cantidad) || 0) * (parseFloat(row.precio) || 0)
                    const isSearching = searchIdx === idx
                    return (
                      <TableRow key={row.id}>
                        <TableCell className='py-1 px-2'>
                          <div className='relative'>
                            <Input
                              className='h-8 font-mono text-xs pr-7'
                              placeholder='Código...'
                              value={isSearching ? searchTerm : row.noProdu}
                              onChange={(e) => {
                                if (!isSearching) { setSearchIdx(idx); setSearchResults([]) }
                                setSearchTerm(e.target.value)
                                updateRow(idx, { noProdu: e.target.value, nombre: '' })
                                searchProducto(e.target.value)
                              }}
                              onFocus={() => { setSearchIdx(idx); setSearchTerm(row.noProdu) }}
                              onBlur={() => { setTimeout(() => { setSearchIdx(null); setSearchResults([]) }, 200) }}
                            />
                            <Search className='absolute right-2 top-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none' />
                            {isSearching && searchResults.length > 0 && (
                              <div className='absolute z-50 top-full left-0 mt-1 w-[280px] rounded-md border bg-popover shadow-md text-xs'>
                                {searching && <div className='px-3 py-2 text-muted-foreground'>Buscando...</div>}
                                {searchResults.map((p) => {
                                  const code = p.no_produ ?? p.codigo ?? ''
                                  return (
                                    <div
                                      key={code}
                                      className='px-3 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground'
                                      onMouseDown={(e) => { e.preventDefault(); selectProducto(idx, p) }}
                                    >
                                      <span className='font-mono font-medium'>{code}</span>
                                      {' — '}
                                      <span className='text-muted-foreground'>{p.descripcion ?? p.nombre ?? ''}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className='py-1 px-2'>
                          <Input className='h-8 text-xs' value={row.nombre} readOnly tabIndex={-1} placeholder='Descripción' />
                        </TableCell>

                        <TableCell className='py-1 px-2'>
                          <Select value={row.almacen} onValueChange={(v) => updateRow(idx, { almacen: v })}>
                            <SelectTrigger className='h-8 text-xs'>
                              <SelectValue placeholder='Alm.' />
                            </SelectTrigger>
                            <SelectContent>
                              {almacenes.map((a) => {
                                const k = almacenKey(a)
                                return <SelectItem key={k} value={k} className='text-xs'>{k}</SelectItem>
                              })}
                            </SelectContent>
                          </Select>
                        </TableCell>

                        <TableCell className='py-1 px-2'>
                          <Input className='h-8 text-xs text-right tabular-nums' type='number' min={0} step='0.0001' placeholder='0.00' value={row.cantidad} onChange={(e) => updateRow(idx, { cantidad: e.target.value })} />
                        </TableCell>

                        <TableCell className='py-1 px-2'>
                          <Input className='h-8 text-xs text-right tabular-nums' type='number' min={0} step='0.01' placeholder='0.00' value={row.precio} onChange={(e) => updateRow(idx, { precio: e.target.value })} />
                        </TableCell>

                        <TableCell className='py-1 px-2 text-right font-mono text-xs tabular-nums'>
                          {lineTotal > 0 ? fmt(lineTotal) : '—'}
                        </TableCell>

                        <TableCell className='py-1 px-1'>
                          <Button variant='ghost' size='icon' className='h-7 w-7 text-muted-foreground hover:text-destructive' onClick={() => removeRow(idx)}>
                            <Trash2 className='h-3.5 w-3.5' />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={5} className='text-xs font-medium text-right pr-4'>Total Bruto:</TableCell>
                    <TableCell className='text-right font-mono text-xs font-semibold tabular-nums'>{fmt(totalBruto)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Totales */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end'>
              <div className='space-y-1'>
                <Label>Total Bruto</Label>
                <div className='h-9 flex items-center px-3 rounded-md border bg-muted font-mono text-sm tabular-nums'>{fmt(totalBruto)}</div>
              </div>

              <div className='space-y-1'>
                <Label htmlFor='dv-pct-itbis'>% ITBIS</Label>
                <Input id='dv-pct-itbis' type='number' min={0} max={100} step='0.01' className='h-9 text-right tabular-nums' placeholder='18.00' value={pctItbis} onChange={(e) => setPctItbis(e.target.value)} />
              </div>

              <div className='space-y-1'>
                <Label>Total Impuesto</Label>
                <div className='h-9 flex items-center px-3 rounded-md border bg-muted font-mono text-sm tabular-nums'>{fmt(totalImpuesto)}</div>
              </div>

              <div className='space-y-1'>
                <Label>Total Neto</Label>
                <div className='h-9 flex items-center px-3 rounded-md border bg-muted font-mono text-sm font-bold tabular-nums'>{fmt(totalNeto)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Guardar */}
        <div className='flex justify-end'>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  onClick={handleSave}
                  disabled={!ENDPOINT_READY || saving}
                  className='min-w-[140px]'
                  title={!ENDPOINT_READY ? 'Endpoint en construcción' : undefined}
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </Button>
              </span>
            </TooltipTrigger>
            {!ENDPOINT_READY && (
              <TooltipContent side='left'>
                <p>Endpoint en construcción — POST /api/inv/devoluciones/venta/</p>
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </section>
    </TooltipProvider>
  )
}
