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

interface TransfRow {
  id: number
  noProdu: string
  nombre: string
  existencia: string
  cantidad: string
}

interface ProductoResult {
  no_produ?: string
  codigo?: string
  descripcion?: string
  nombre?: string
  existencia?: number
  cantidad?: number
  [key: string]: any
}

let rowIdCounter = 200

function newRow(): TransfRow {
  return { id: rowIdCounter++, noProdu: '', nombre: '', existencia: '', cantidad: '' }
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function TransferenciaMercancia({ noCia, punto }: Props) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [almacenOrigen, setAlmacenOrigen] = useState('')
  const [almacenDestino, setAlmacenDestino] = useState('')
  const [observaciones, setObservaciones] = useState('')

  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [rows, setRows] = useState<TransfRow[]>([newRow()])

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

  const searchProducto = useCallback(async (term: string, almacen: string) => {
    if (!term.trim()) { setSearchResults([]); return }
    setSearching(true)
    try {
      const params = new URLSearchParams({ no_cia: noCia, search: term, limit: '10' })
      if (almacen) params.set('almacen', almacen)
      const data = await apiFetch<any>(`/inv/productos/?${params}`)
      const items: ProductoResult[] = Array.isArray(data) ? data : (data.results ?? data.items ?? [])
      setSearchResults(items)
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [noCia])

  const updateRow = (idx: number, patch: Partial<TransfRow>) => {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))
  }

  const addRow = () => setRows((prev) => [...prev, newRow()])

  const removeRow = (idx: number) => {
    setRows((prev) => prev.length === 1 ? [newRow()] : prev.filter((_, i) => i !== idx))
  }

  const selectProducto = (idx: number, p: ProductoResult) => {
    updateRow(idx, {
      noProdu: p.no_produ ?? p.codigo ?? '',
      nombre: p.descripcion ?? p.nombre ?? '',
      existencia: String(p.existencia ?? p.cantidad ?? ''),
    })
    setSearchIdx(null)
    setSearchTerm('')
    setSearchResults([])
  }

  const fmt = (n: number) => n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const totalUnidades = rows.reduce((acc, r) => acc + (parseFloat(r.cantidad) || 0), 0)

  const handleSave = async () => {
    if (!ENDPOINT_READY) return
    if (!almacenOrigen) { toast.error('Seleccione el Almacén Origen'); return }
    if (!almacenDestino) { toast.error('Seleccione el Almacén Destino'); return }
    const validRows = rows.filter((r) => r.noProdu.trim() && (parseFloat(r.cantidad) || 0) > 0)
    if (validRows.length === 0) { toast.error('Agregue al menos un producto con cantidad válida'); return }

    const payload = {
      no_cia: noCia,
      punto,
      tipo_docu: 'TA',
      fecha,
      almacen: almacenOrigen,
      almacen_destino: almacenDestino,
      detalle: validRows.map((r) => ({
        no_produ: r.noProdu,
        almacen: almacenOrigen,
        cantidad: parseFloat(r.cantidad) || 0,
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
      toast.success(`Transferencia ${created.no_doc ?? ''} procesada correctamente`)
      setAlmacenOrigen(''); setAlmacenDestino('')
      setFecha(new Date().toISOString().slice(0, 10)); setObservaciones('')
      setRows([newRow()])
    } catch (err: any) {
      toast.error(`Error al transferir: ${err.message ?? 'Error desconocido'}`)
    } finally {
      setSaving(false)
    }
  }

  const almacenKey = (a: Almacen) => a.almacen ?? a.codigo ?? ''
  const almacenDesc = (a: Almacen) => a.descripcion ?? a.desc_almacen ?? almacenKey(a)

  const almacenesDestino = almacenes.filter((a) => almacenKey(a) !== almacenOrigen)

  return (
    <TooltipProvider>
      <section className='space-y-6'>
        <div>
          <h2 className='text-lg font-semibold'>Transferencia de Mercancía</h2>
          <p className='text-sm text-muted-foreground'>FINV203 — Traslado de mercancía entre almacenes</p>
        </div>

        {/* Cabecera */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Datos de la Transferencia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'>
              <div className='space-y-1'>
                <Label htmlFor='tr-fecha'>Fecha</Label>
                <Input id='tr-fecha' type='date' className='h-9' value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>

              <div className='space-y-1'>
                <Label htmlFor='tr-alm-origen'>Almacén Origen</Label>
                <Select value={almacenOrigen} onValueChange={(v) => {
                  setAlmacenOrigen(v)
                  if (almacenDestino === v) setAlmacenDestino('')
                }}>
                  <SelectTrigger id='tr-alm-origen' className='h-9'>
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
                <Label htmlFor='tr-alm-destino'>Almacén Destino</Label>
                <Select value={almacenDestino} onValueChange={setAlmacenDestino}>
                  <SelectTrigger id='tr-alm-destino' className='h-9'>
                    <SelectValue placeholder='Seleccionar...' />
                  </SelectTrigger>
                  <SelectContent>
                    {almacenesDestino.map((a) => {
                      const k = almacenKey(a)
                      return <SelectItem key={k} value={k}>{k} — {almacenDesc(a)}</SelectItem>
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-1 col-span-2 md:col-span-1 lg:col-span-1'>
                <Label htmlFor='tr-obs'>Observaciones</Label>
                <Input id='tr-obs' className='h-9' placeholder='Descripción de la transferencia' value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grid de productos */}
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-base'>Productos a Transferir</CardTitle>
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
                    <TableHead className='w-[130px] text-right'>Existencia Disp.</TableHead>
                    <TableHead className='w-[130px] text-right'>Cantidad a Transferir</TableHead>
                    <TableHead className='w-[48px]'></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => {
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
                                updateRow(idx, { noProdu: e.target.value, nombre: '', existencia: '' })
                                searchProducto(e.target.value, almacenOrigen)
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

                        <TableCell className='py-1 px-2 text-right'>
                          <div className='h-8 flex items-center justify-end px-3 rounded-md border bg-muted font-mono text-xs tabular-nums text-muted-foreground'>
                            {row.existencia !== '' ? fmt(parseFloat(row.existencia) || 0) : '—'}
                          </div>
                        </TableCell>

                        <TableCell className='py-1 px-2'>
                          <Input className='h-8 text-xs text-right tabular-nums' type='number' min={0} step='0.0001' placeholder='0.00' value={row.cantidad} onChange={(e) => updateRow(idx, { cantidad: e.target.value })} />
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
                    <TableCell colSpan={2} className='text-xs font-medium text-right pr-4'>Total Unidades:</TableCell>
                    <TableCell />
                    <TableCell className='text-right font-mono text-sm font-bold tabular-nums'>{fmt(totalUnidades)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
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
                  {saving ? 'Transfiriendo...' : 'Transferir'}
                </Button>
              </span>
            </TooltipTrigger>
            {!ENDPOINT_READY && (
              <TooltipContent side='left'>
                <p>Endpoint en construcción — POST /api/inv/transferencias/</p>
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </section>
    </TooltipProvider>
  )
}
