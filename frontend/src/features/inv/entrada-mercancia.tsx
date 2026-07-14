import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  TableFooter,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  BuscarProductoModal,
  type BuscarProductoModalAlmacen,
} from '@/features/fat/components/buscar-producto-modal'
import { empaqueLabel } from '@/features/fat/utils/empaque-label'

const API_BASE =
  import.meta.env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

interface EmpaqueOpt {
  empaque: number
  unidad: string
  descripcion?: string
  referencia?: string
  cant_por_emp: number
  por_defecto: boolean
  permite_fraccion?: boolean
}

interface Props {
  noCia: string
  punto: string
  tipoMov?: 'entrada' | 'salida'
}

interface TipoDocu {
  tipo_docu?: string
  tipo_doc?: string
  descripcion?: string
  tipo_mov?: string
  [key: string]: unknown
}

interface Almacen {
  almacen?: string
  codigo?: string
  descripcion?: string
  desc_almacen?: string
  [key: string]: unknown
}

interface ProductoRow {
  id: number
  noProdu: string
  nombre: string
  cantidad: string
  costo: string
  almacen: string
  empaque?: string // unidad (UND, FUNDA, CAJA, etc.)
  empaques: EmpaqueOpt[]
  costoBase: number // costo de la unidad detallada (cant_por_emp=1)
}

interface ProductoResult {
  no_produ?: string
  codigo?: string
  descripcion?: string
  nombre?: string
  costo_prom?: number
  costo?: number
  [key: string]: unknown
}

interface ApiListResponse<T> {
  results?: T[]
  items?: T[]
}

interface EmpaqueApiItem {
  empaque?: number
  unidad?: string
  descripcion?: string
  referencia?: string
  cant_por_emp?: number
  por_defecto?: boolean
  permite_fraccion?: boolean
}

interface ExistenciaRow {
  almacen?: string
  costo_actual?: number
}

interface ExistenciaResponse {
  results?: ExistenciaRow[]
}

interface MovimientoCreateResponse {
  data?: {
    no_movim?: string
    no_docu?: string
    no_doc?: string
  }
  no_movim?: string
  no_docu?: string
  no_doc?: string
}

let rowIdCounter = 1

function newRow(almacen = ''): ProductoRow {
  return {
    id: rowIdCounter++,
    noProdu: '',
    nombre: '',
    cantidad: '',
    costo: '',
    almacen,
    empaque: 'UND',
    empaques: [],
    costoBase: 0,
  }
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error desconocido'
}

export function EntradaMercancia({ noCia, punto, tipoMov = 'entrada' }: Props) {
  const isEntrada = tipoMov === 'entrada'
  const title = isEntrada
    ? 'Entrada de Mercancía al Almacén'
    : 'Salida de Mercancía del Almacén'
  const legacy = isEntrada ? 'FINV210' : 'FINV211'
  const totalLabel = isEntrada ? 'Total Entrada' : 'Total Salida'

  // Header — la cuenta contable y centro de costo vienen del TINV_TDOCU
  // (no son input del usuario en el legado Finv210/Finv211).
  const [tipoDocu, setTipoDocu] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [almacenHeader, setAlmacenHeader] = useState('')
  const [nota, setNota] = useState('')

  // Catalog data
  const [tiposDocu, setTiposDocu] = useState<TipoDocu[]>([])
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])

  // Grid
  const [rows, setRows] = useState<ProductoRow[]>([newRow()])

  // Product search (legacy inline, conservado para compatibilidad)
  const [searchIdx, setSearchIdx] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<ProductoResult[]>([])
  const [searching, setSearching] = useState(false)

  // Modal de buscar producto (preferido, mismo estilo que FAT)
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [productModalForIdx, setProductModalForIdx] = useState<number | null>(
    null
  )

  const [saving, setSaving] = useState(false)

  // Load catalog data
  useEffect(() => {
    if (!noCia) return

    apiFetch<TipoDocu[] | ApiListResponse<TipoDocu>>(
      `/inv/tipos-docu/?no_cia=${encodeURIComponent(noCia)}`
    )
      .then((data) => {
        const items: TipoDocu[] = Array.isArray(data)
          ? data
          : (data.results ?? data.items ?? [])
        // Filter by movement direction
        const movFilter = isEntrada ? 'E' : 'S'
        const filtered = items.filter((t) => {
          const mov = String(t.tipo_mov ?? '').toUpperCase()
          return mov === movFilter || mov === ''
        })
        setTiposDocu(filtered.length > 0 ? filtered : items)
      })
      .catch(() => setTiposDocu([]))

    apiFetch<Almacen[] | ApiListResponse<Almacen>>(
      `/inv/almacenes/?no_cia=${encodeURIComponent(noCia)}`
    )
      .then((data) => {
        const items: Almacen[] = Array.isArray(data)
          ? data
          : (data.results ?? data.items ?? [])
        setAlmacenes(items)
      })
      .catch(() => setAlmacenes([]))
  }, [noCia, isEntrada])

  const searchProducto = useCallback(
    async (term: string) => {
      if (!term.trim()) {
        setSearchResults([])
        return
      }
      setSearching(true)
      try {
        const data = await apiFetch<
          ProductoResult[] | ApiListResponse<ProductoResult>
        >(
          `/inv/productos/?no_cia=${encodeURIComponent(noCia)}&search=${encodeURIComponent(term)}&limit=10`
        )
        const items: ProductoResult[] = Array.isArray(data)
          ? data
          : (data.results ?? data.items ?? [])
        setSearchResults(items)
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    },
    [noCia]
  )

  const updateRow = (idx: number, patch: Partial<ProductoRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  // Carga los empaques de un producto (FUNDA, CAJA, DETALLADO, etc.) para
  // que el usuario pueda cambiar la UM en la grilla.
  const cargarEmpaques = useCallback(
    async (idx: number, noProdu: string, costoBase: number) => {
      try {
        const r = await regalGeneralApi.fatProductoEmpaques(noProdu)
        const items = (r.items || []) as EmpaqueApiItem[]
        const emps: EmpaqueOpt[] = items.map((e, i) => ({
          empaque: e.empaque ?? i + 1,
          unidad: (e.unidad || 'UND').trim() || 'UND',
          descripcion: e.descripcion || e.unidad,
          referencia: e.referencia || '',
          cant_por_emp:
            e.cant_por_emp && e.cant_por_emp > 0 ? e.cant_por_emp : 1,
          por_defecto: !!e.por_defecto,
          permite_fraccion: !!e.permite_fraccion,
        }))
        const def = emps.find((e) => e.por_defecto) || emps[0]
        setRows((prev) => {
          const arr = [...prev]
          if (!arr[idx] || arr[idx].noProdu !== noProdu) return prev
          const empaque = def ? def.descripcion || def.unidad : 'UND'
          const factor = def?.cant_por_emp || 1
          arr[idx] = {
            ...arr[idx],
            empaques: emps,
            empaque,
            costoBase,
            costo: (costoBase * factor).toFixed(4),
          }
          return arr
        })
      } catch {
        /* sin empaques => UM queda como UND */
      }
    },
    []
  )

  const openProductModal = (idx: number) => {
    setProductModalForIdx(idx)
    setProductModalOpen(true)
  }

  const addRow = () => {
    setRows((prev) => {
      const next = [...prev, newRow(almacenHeader)]
      // Abre modal automáticamente para la nueva fila
      setTimeout(() => openProductModal(next.length - 1), 0)
      return next
    })
  }

  const removeRow = (idx: number) => {
    setRows((prev) =>
      prev.length === 1
        ? [newRow(almacenHeader)]
        : prev.filter((_, i) => i !== idx)
    )
  }

  const selectProducto = (idx: number, p: ProductoResult) => {
    const code = p.no_produ ?? p.codigo ?? ''
    const nombre = p.descripcion ?? p.nombre ?? ''
    const costo = String(p.costo_prom ?? p.costo ?? '')
    updateRow(idx, { noProdu: code, nombre, costo })
    setSearchIdx(null)
    setSearchTerm('')
    setSearchResults([])
    cargarEmpaques(idx, code, parseFloat(costo) || 0)
  }

  // Cambia la unidad de empaque elegida y recalcula costo = costoBase * cant_por_emp
  const cambiarEmpaque = (idx: number, unidad: string) => {
    setRows((prev) => {
      const arr = [...prev]
      const row = arr[idx]
      if (!row) return prev
      const emp = row.empaques.find(
        (e) => (e.descripcion || e.unidad) === unidad || e.unidad === unidad
      )
      if (!emp) return prev
      const factor = emp.cant_por_emp || 1
      arr[idx] = {
        ...row,
        empaque: emp.descripcion || emp.unidad,
        costo: (row.costoBase * factor).toFixed(4),
      }
      return arr
    })
  }

  // Computed totals
  const totalUnidades = rows.reduce(
    (acc, r) => acc + (parseFloat(r.cantidad) || 0),
    0
  )
  const totalMonto = rows.reduce((acc, r) => {
    const qty = parseFloat(r.cantidad) || 0
    const costo = parseFloat(r.costo) || 0
    return acc + qty * costo
  }, 0)

  const fmt = (n: number) =>
    n.toLocaleString('es-DO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

  const handleSave = async () => {
    if (!tipoDocu) {
      toast.error('Seleccione el Tipo de Documento')
      return
    }
    if (!fecha) {
      toast.error('Ingrese la fecha')
      return
    }
    const validRows = rows.filter(
      (r) => r.noProdu.trim() && (parseFloat(r.cantidad) || 0) > 0
    )
    if (validRows.length === 0) {
      toast.error('Agregue al menos un producto con cantidad válida')
      return
    }

    const payload = {
      no_cia: noCia,
      punto,
      tipo_docu: tipoDocu,
      fecha,
      almacen: almacenHeader,
      tipo_mov: tipoMov,
      nota,
      detalle: validRows.map((r) => {
        const emp = r.empaques.find(
          (e) =>
            (e.descripcion || e.unidad) === r.empaque || e.unidad === r.empaque
        )
        return {
          no_produ: r.noProdu,
          almacen: r.almacen || almacenHeader,
          cantidad: parseFloat(r.cantidad) || 0,
          costo: parseFloat(r.costo) || 0,
          empaque: emp?.empaque,
          cpe: emp?.cant_por_emp,
          unidad: r.empaque,
        }
      }),
    }

    setSaving(true)
    try {
      const csrf =
        (
          document.cookie.split('; ').find((c) => c.startsWith('csrftoken=')) ||
          ''
        ).split('=')[1] || ''
      const res = await fetch(`${API_BASE}/inv/movimientos/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as {
          detail?: string
          error?: string
        }
        throw new Error(errData.detail ?? errData.error ?? `HTTP ${res.status}`)
      }
      const created = (await res.json()) as MovimientoCreateResponse
      const docNo =
        created.no_movim ??
        created.no_docu ??
        created.no_doc ??
        created.data?.no_movim ??
        created.data?.no_docu ??
        created.data?.no_doc ??
        ''
      toast.success(`Documento ${docNo} guardado correctamente`)
      // Reset de lineas/nota. Tipo Documento y Almacen se conservan: el
      // operador suele registrar varios documentos seguidos del mismo tipo,
      // y resetearlos hacia que el siguiente Guardar fallara en la
      // validacion "Seleccione el Tipo de Documento" sin que se notara.
      setFecha(new Date().toISOString().slice(0, 10))
      setNota('')
      setRows([newRow(almacenHeader)])
    } catch (err: unknown) {
      toast.error(`Error al guardar: ${getErrorMessage(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const tipoDocuKey = (t: TipoDocu) => t.tipo_docu ?? t.tipo_doc ?? ''
  const almacenKey = (a: Almacen) => (a.almacen ?? a.codigo ?? '').trim()
  const almacenDesc = (a: Almacen) =>
    (a.descripcion ?? a.desc_almacen ?? almacenKey(a)).trim()
  const almacenesModal: BuscarProductoModalAlmacen[] = almacenes
    .map((a) => ({
      almacen: almacenKey(a),
      descripcion: almacenDesc(a),
    }))
    .filter((a) => a.almacen)

  return (
    <TooltipProvider>
      <section className='space-y-6'>
        <div>
          <h2 className='text-lg font-semibold'>{title}</h2>
          <p className='text-sm text-muted-foreground'>
            {legacy} — Movimiento de inventario
          </p>
        </div>

        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>
              Encabezado del Documento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4'>
              <div className='space-y-1'>
                <Label htmlFor='tipo-docu-mov'>Tipo Documento</Label>
                <Select value={tipoDocu} onValueChange={setTipoDocu}>
                  <SelectTrigger id='tipo-docu-mov' className='h-9'>
                    <SelectValue placeholder='Seleccionar...' />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposDocu.map((t) => {
                      const k = tipoDocuKey(t)
                      return (
                        <SelectItem key={k} value={k}>
                          {k}
                          {t.descripcion ? ` — ${t.descripcion}` : ''}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-1'>
                <Label htmlFor='fecha-mov'>Fecha</Label>
                <Input
                  id='fecha-mov'
                  type='date'
                  className='h-9'
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>

              <div className='space-y-1'>
                <Label htmlFor='almacen-header'>Almacén</Label>
                <Select
                  value={almacenHeader}
                  onValueChange={(v) => {
                    setAlmacenHeader(v)
                    setRows((prev) => prev.map((r) => ({ ...r, almacen: v })))
                  }}
                >
                  <SelectTrigger id='almacen-header' className='h-9'>
                    <SelectValue placeholder='Seleccionar...' />
                  </SelectTrigger>
                  <SelectContent>
                    {almacenes.map((a) => {
                      const k = almacenKey(a)
                      return (
                        <SelectItem key={k} value={k}>
                          {k} — {almacenDesc(a)}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className='mt-4 space-y-1'>
              <Label htmlFor='nota-mov'>Comentario</Label>
              <Textarea
                id='nota-mov'
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder='Informacion pertinente sobre la factura'
                rows={2}
                className='resize-none'
              />
            </div>
          </CardContent>
        </Card>

        {/* Product grid */}
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-base'>Detalle de Productos</CardTitle>
            <Button
              variant='outline'
              size='sm'
              className='gap-1'
              onClick={addRow}
            >
              <Plus className='h-4 w-4' /> Agregar fila
            </Button>
          </CardHeader>
          <CardContent className='p-0'>
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-[130px]'>No. Producto</TableHead>
                    <TableHead className='min-w-[200px]'>
                      Nombre / Descripción
                    </TableHead>
                    <TableHead className='w-[120px]'>Almacén</TableHead>
                    <TableHead className='w-[110px]'>UM</TableHead>
                    <TableHead className='w-[110px] text-right'>
                      Cantidad
                    </TableHead>
                    <TableHead className='w-[120px] text-right'>
                      Costo Unit.
                    </TableHead>
                    <TableHead className='w-[120px] text-right'>
                      Total
                    </TableHead>
                    <TableHead className='w-[48px]'></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => {
                    const lineTotal =
                      (parseFloat(row.cantidad) || 0) *
                      (parseFloat(row.costo) || 0)
                    const isSearching = searchIdx === idx
                    return (
                      <TableRow key={row.id}>
                        {/* Product code cell with inline search */}
                        <TableCell className='px-2 py-1'>
                          <div className='relative'>
                            <Input
                              className='h-8 pr-7 font-mono text-xs'
                              placeholder='Código...'
                              value={isSearching ? searchTerm : row.noProdu}
                              onChange={(e) => {
                                if (!isSearching) {
                                  setSearchIdx(idx)
                                  setSearchResults([])
                                }
                                setSearchTerm(e.target.value)
                                updateRow(idx, {
                                  noProdu: e.target.value,
                                  nombre: '',
                                })
                                searchProducto(e.target.value)
                              }}
                              onFocus={() => {
                                setSearchIdx(idx)
                                setSearchTerm(row.noProdu)
                              }}
                              onBlur={() => {
                                setTimeout(() => {
                                  setSearchIdx(null)
                                  setSearchResults([])
                                }, 200)
                              }}
                            />
                            <button
                              type='button'
                              className='absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent'
                              title='Buscar producto'
                              onClick={() => openProductModal(idx)}
                            >
                              <Search className='h-3.5 w-3.5' />
                            </button>
                            {isSearching && searchResults.length > 0 && (
                              <div className='absolute top-full left-0 z-50 mt-1 w-[280px] rounded-md border bg-popover text-xs shadow-md'>
                                {searching && (
                                  <div className='px-3 py-2 text-muted-foreground'>
                                    Buscando...
                                  </div>
                                )}
                                {searchResults.map((p) => {
                                  const code = p.no_produ ?? p.codigo ?? ''
                                  return (
                                    <div
                                      key={code}
                                      className='cursor-pointer px-3 py-2 hover:bg-accent hover:text-accent-foreground'
                                      onMouseDown={(e) => {
                                        e.preventDefault()
                                        selectProducto(idx, p)
                                      }}
                                    >
                                      <span className='font-mono font-medium'>
                                        {code}
                                      </span>
                                      {' — '}
                                      <span className='text-muted-foreground'>
                                        {p.descripcion ?? p.nombre ?? ''}
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className='px-2 py-1'>
                          <Input
                            className='h-8 text-xs'
                            placeholder='Descripción del producto'
                            value={row.nombre}
                            readOnly
                            tabIndex={-1}
                          />
                        </TableCell>

                        <TableCell className='px-2 py-1'>
                          <Select
                            value={row.almacen}
                            onValueChange={(v) =>
                              updateRow(idx, { almacen: v })
                            }
                          >
                            <SelectTrigger className='h-8 text-xs'>
                              <SelectValue placeholder='Alm.' />
                            </SelectTrigger>
                            <SelectContent>
                              {almacenes.map((a) => {
                                const k = almacenKey(a)
                                return (
                                  <SelectItem
                                    key={k}
                                    value={k}
                                    className='text-xs'
                                  >
                                    {k}
                                  </SelectItem>
                                )
                              })}
                            </SelectContent>
                          </Select>
                        </TableCell>

                        <TableCell className='px-2 py-1'>
                          {row.empaques.length > 0 ? (
                            <Select
                              value={row.empaque || 'UND'}
                              onValueChange={(v) => cambiarEmpaque(idx, v)}
                            >
                              <SelectTrigger className='h-8 text-xs'>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {row.empaques.map((e) => (
                                  <SelectItem
                                    key={`${e.empaque}-${e.unidad}`}
                                    value={e.descripcion || e.unidad}
                                    className='text-xs'
                                  >
                                    {empaqueLabel(e)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className='text-xs text-muted-foreground'>
                              {row.empaque || '—'}
                            </span>
                          )}
                        </TableCell>

                        <TableCell className='px-2 py-1'>
                          <Input
                            className='h-8 text-right text-xs tabular-nums'
                            type='number'
                            min={0}
                            step='0.0001'
                            placeholder='0.00'
                            value={row.cantidad}
                            onChange={(e) =>
                              updateRow(idx, { cantidad: e.target.value })
                            }
                          />
                        </TableCell>

                        <TableCell className='px-2 py-1'>
                          <Input
                            className='h-8 text-right text-xs tabular-nums'
                            type='number'
                            min={0}
                            step='0.01'
                            placeholder='0.00'
                            value={row.costo}
                            onChange={(e) =>
                              updateRow(idx, { costo: e.target.value })
                            }
                          />
                        </TableCell>

                        <TableCell className='px-2 py-1 text-right font-mono text-xs tabular-nums'>
                          {lineTotal > 0 ? fmt(lineTotal) : '—'}
                        </TableCell>

                        <TableCell className='px-1 py-1'>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='h-7 w-7 text-muted-foreground hover:text-destructive'
                            onClick={() => removeRow(idx)}
                          >
                            <Trash2 className='h-3.5 w-3.5' />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className='pr-4 text-right text-xs font-medium'
                    >
                      Totales:
                    </TableCell>
                    <TableCell className='text-right font-mono text-xs font-semibold tabular-nums'>
                      {fmt(totalUnidades)}
                    </TableCell>
                    <TableCell className='text-right text-xs text-muted-foreground'>
                      {totalLabel}:
                    </TableCell>
                    <TableCell className='text-right font-mono text-sm font-bold tabular-nums'>
                      {fmt(totalMonto)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Save */}
        <div className='flex justify-end'>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleSave}
                disabled={saving}
                className='min-w-[120px]'
              >
                {saving ? 'Guardando...' : 'Guardar Documento'}
              </Button>
            </TooltipTrigger>
            <TooltipContent side='left'>
              <p>POST a /api/inv/movimientos/</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </section>

      <BuscarProductoModal
        open={productModalOpen}
        onClose={() => {
          setProductModalOpen(false)
          setProductModalForIdx(null)
        }}
        noCia={noCia}
        punto={punto}
        almacenes={almacenesModal}
        listas={[]}
        noLista={''}
        defaultAlmacen={almacenHeader}
        onSelect={(p, qty, alm) => {
          if (productModalForIdx == null) return
          const idx = productModalForIdx
          // Costo base = costo_actual del producto (FAT lo expone como precio en busqueda
          // a falta de costo en el modal; usamos lookup directo a /api/inv/existencia/<no_produ>/
          // para obtener el costo real del almacen elegido).
          const baseQty = qty && qty > 0 ? qty : 1
          updateRow(idx, {
            noProdu: p.no_produ,
            nombre: p.descri,
            almacen: alm || almacenHeader,
            cantidad: String(baseQty),
          })
          // Lookup costo del almacen
          fetch(
            `${API_BASE}/inv/existencia/${encodeURIComponent(p.no_produ)}/?no_cia=${encodeURIComponent(noCia)}&punto=${encodeURIComponent(punto)}`,
            { credentials: 'include' }
          )
            .then((r) => r.json())
            .then((j: ExistenciaResponse) => {
              const results = j.results || []
              const row =
                results.find((x) => x.almacen === (alm || almacenHeader)) ||
                results[0]
              const costoBase = Number(row?.costo_actual || 0)
              cargarEmpaques(idx, p.no_produ, costoBase)
            })
            .catch(() => cargarEmpaques(idx, p.no_produ, 0))
          setProductModalOpen(false)
          setProductModalForIdx(null)
        }}
      />
    </TooltipProvider>
  )
}
