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
import { EntityPickerModal } from '@/components/shared/entity-picker-modal'
import { regalGeneralApi } from '@/lib/regal-general-api'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

const ENDPOINT_READY = true

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

interface DevRow {
  id: number
  noProdu: string
  nombre: string
  cantidad: string
  costo: string
  almacen: string
}

interface ProductoResult {
  no_produ?: string
  codigo?: string
  descripcion?: string
  nombre?: string
  costo_prom?: number
  costo?: number
  [key: string]: any
}

let rowIdCounter = 300

function newRow(almacen = ''): DevRow {
  return { id: rowIdCounter++, noProdu: '', nombre: '', cantidad: '', costo: '', almacen }
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function DevolucionSuplidores({ noCia, punto }: Props) {
  // Cabecera
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [almacenHeader, setAlmacenHeader] = useState('')

  // Proveedor
  const [proveedor, setProveedor] = useState('')
  const [proveedorNombre, setProveedorNombre] = useState('')
  const [provModalOpen, setProvModalOpen] = useState(false)
  const [ncf, setNcf] = useState('')
  const [docOriginal, setDocOriginal] = useState('')

  // Totales
  const [pctItbis, setPctItbis] = useState('18')

  // Catalogs
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])

  // Grid
  const [rows, setRows] = useState<DevRow[]>([newRow()])

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

  const updateRow = (idx: number, patch: Partial<DevRow>) => {
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
      costo: String(p.costo_prom ?? p.costo ?? ''),
    })
    setSearchIdx(null)
    setSearchTerm('')
    setSearchResults([])
  }

  const fmt = (n: number) => n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // Computed totals
  const montoNeto = rows.reduce((acc, r) => acc + (parseFloat(r.cantidad) || 0) * (parseFloat(r.costo) || 0), 0)
  const totalItbis = montoNeto * ((parseFloat(pctItbis) || 0) / 100)
  const totalNeto = montoNeto + totalItbis

  const handleSave = async () => {
    if (!ENDPOINT_READY) return
    if (!proveedor.trim()) { toast.error('Ingrese el proveedor'); return }
    const validRows = rows.filter((r) => r.noProdu.trim() && (parseFloat(r.cantidad) || 0) > 0)
    if (validRows.length === 0) { toast.error('Agregue al menos un producto con cantidad válida'); return }

    const payload = {
      no_cia: noCia,
      punto,
      tipo_docu: 'DC',
      fecha,
      almacen: almacenHeader,
      detalle: validRows.map((r) => ({
        no_produ: r.noProdu,
        almacen: r.almacen || almacenHeader,
        cantidad: parseFloat(r.cantidad) || 0,
        costo: parseFloat(r.costo) || 0,
      })),
    }

    setSaving(true)
    try {
      const csrf = (document.cookie.split('; ').find(c => c.startsWith('csrftoken=')) || '').split('=')[1] || ''
      const res = await fetch(`${API_BASE}/inv/movimientos/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail ?? errData.error ?? `HTTP ${res.status}`)
      }
      const created = await res.json()
      toast.success(`Devolución ${created.no_doc ?? ''} registrada correctamente`)
      setFecha(new Date().toISOString().slice(0, 10)); setAlmacenHeader('')
      setProveedor(''); setNcf(''); setDocOriginal(''); setPctItbis('18')
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
          <h2 className='text-lg font-semibold'>Devolución a Suplidores</h2>
          <p className='text-sm text-muted-foreground'>FINV205 — Registro de devoluciones de mercancía a proveedores</p>
        </div>

        {/* Cabecera */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Encabezado del Documento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'>
              <div className='space-y-1'>
                <Label htmlFor='ds-fecha'>Fecha</Label>
                <Input id='ds-fecha' type='date' className='h-9' value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>

              <div className='space-y-1'>
                <Label htmlFor='ds-almacen'>Almacén</Label>
                <Select value={almacenHeader} onValueChange={(v) => {
                  setAlmacenHeader(v)
                  setRows((prev) => prev.map((r) => ({ ...r, almacen: v })))
                }}>
                  <SelectTrigger id='ds-almacen' className='h-9'>
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
            </div>
          </CardContent>
        </Card>

        {/* Datos del proveedor */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Datos del Proveedor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'>
              <div className='space-y-1 col-span-2'>
                <Label>Proveedor</Label>
                <div className='flex gap-2'>
                  <Input
                    id='ds-proveedor'
                    className='h-9 font-mono w-28'
                    placeholder='Código'
                    value={proveedor}
                    readOnly
                    onClick={() => setProvModalOpen(true)}
                  />
                  <Input
                    className='h-9 flex-1 bg-gray-50'
                    placeholder='Click la lupa para buscar'
                    value={proveedorNombre}
                    readOnly
                  />
                  <Button type='button' variant='outline' size='icon' className='h-9 w-9 shrink-0' onClick={() => setProvModalOpen(true)}>
                    <Search className='h-4 w-4' />
                  </Button>
                </div>
              </div>

              <div className='space-y-1'>
                <Label htmlFor='ds-ncf'>NCF</Label>
                <Input id='ds-ncf' className='h-9 font-mono' placeholder='B0100000000' value={ncf} onChange={(e) => setNcf(e.target.value)} />
              </div>

              <div className='space-y-1'>
                <Label htmlFor='ds-doc-original'>Doc. Original a Afectar</Label>
                <Input id='ds-doc-original' className='h-9 font-mono' placeholder='No. documento' value={docOriginal} onChange={(e) => setDocOriginal(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grid de productos */}
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-base'>Productos a Devolver</CardTitle>
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
                    <TableHead className='w-[120px] text-right'>Costo Unit.</TableHead>
                    <TableHead className='w-[120px] text-right'>Total</TableHead>
                    <TableHead className='w-[48px]'></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => {
                    const lineTotal = (parseFloat(row.cantidad) || 0) * (parseFloat(row.costo) || 0)
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
                          <Input className='h-8 text-xs text-right tabular-nums' type='number' min={0} step='0.01' placeholder='0.00' value={row.costo} onChange={(e) => updateRow(idx, { costo: e.target.value })} />
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
                    <TableCell colSpan={5} className='text-xs font-medium text-right pr-4'>Monto Neto:</TableCell>
                    <TableCell className='text-right font-mono text-xs font-semibold tabular-nums'>{fmt(montoNeto)}</TableCell>
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
                <Label>Monto Neto</Label>
                <div className='h-9 flex items-center px-3 rounded-md border bg-muted font-mono text-sm tabular-nums'>{fmt(montoNeto)}</div>
              </div>

              <div className='space-y-1'>
                <Label htmlFor='ds-pct-itbis'>% ITBIS</Label>
                <Input id='ds-pct-itbis' type='number' min={0} max={100} step='0.01' className='h-9 text-right tabular-nums' placeholder='18.00' value={pctItbis} onChange={(e) => setPctItbis(e.target.value)} />
              </div>

              <div className='space-y-1'>
                <Label>Total ITBIS</Label>
                <div className='h-9 flex items-center px-3 rounded-md border bg-muted font-mono text-sm tabular-nums'>{fmt(totalItbis)}</div>
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
                <p>Endpoint en construcción — POST /api/inv/devoluciones/proveedor/</p>
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </section>

      <EntityPickerModal<any>
        open={provModalOpen}
        onClose={() => setProvModalOpen(false)}
        title='Buscar Proveedor'
        placeholder='Buscar por código o nombre del proveedor...'
        fetcher={async (q) => {
          const list = await regalGeneralApi.cxpListProveedores({ search: q })
          return Array.isArray(list) ? list.slice(0, 100) : []
        }}
        columns={[
          { key: 'no_proveedor', label: 'Código', width: '110px' },
          { key: 'nombre', label: 'Nombre' },
          { key: 'rnc', label: 'RNC', width: '140px' },
          { key: 'telefono', label: 'Teléfono', width: '140px' },
        ]}
        getKey={(p) => p.no_proveedor}
        onSelect={(p) => {
          setProveedor(String(p.no_proveedor || ''))
          setProveedorNombre((p.nombre || '').trim())
        }}
      />
    </TooltipProvider>
  )
}
