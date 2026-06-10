import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Search, FileSearch, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  TableFooter,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { EntityPickerModal } from '@/components/shared/entity-picker-modal'
import { empaqueLabel } from '@/features/fat/utils/empaque-label'
import { BuscarDocumentoModal } from './components/buscar-documento-modal'

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

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

interface EmpaqueOpt {
  empaque: number
  unidad: string
  descripcion?: string
  referencia?: string
  cant_por_emp: number
  por_defecto: boolean
  permite_fraccion?: boolean
}

interface LineaOrigen {
  no_linea?: number | string
  no_produ: string
  descripcion: string
  almacen?: string
  cantidad: number
  costo: number
  precio?: number
  unidad?: string
  empaque?: number
  monto_neto?: number
}

interface DevRow {
  id: number
  noProdu: string
  nombre: string
  cantidad: string
  costo: string
  almacen: string
  empaque?: string
  empaques: EmpaqueOpt[]
  // Línea de origen vinculada (para no exceder cantidad original)
  origenLinea?: number | string
  origenCantidad?: number
}

let rowIdCounter = 300

function newRow(almacen = ''): DevRow {
  return {
    id: rowIdCounter++,
    noProdu: '',
    nombre: '',
    cantidad: '',
    costo: '',
    almacen,
    empaque: 'UND',
    empaques: [],
  }
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

  // Documento original a afectar
  const [tipoDocOrigen, setTipoDocOrigen] = useState('EC') // EC = Entrada de Compra
  const [docOriginal, setDocOriginal] = useState('')
  const [lineasOrigen, setLineasOrigen] = useState<LineaOrigen[]>([])
  const [headerOrigen, setHeaderOrigen] = useState<Record<string, any> | null>(
    null
  )
  const [loadingOrigen, setLoadingOrigen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerForIdx, setPickerForIdx] = useState<number | null>(null)
  const [buscarDocOpen, setBuscarDocOpen] = useState(false)

  // Totales
  const [pctItbis, setPctItbis] = useState('18')

  // Catálogos
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])

  // Grid de líneas a devolver
  const [rows, setRows] = useState<DevRow[]>([newRow()])

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!noCia) return
    apiFetch<any>(`/inv/almacenes/?no_cia=${encodeURIComponent(noCia)}`)
      .then((data) => {
        const items: Almacen[] = Array.isArray(data)
          ? data
          : (data.results ?? data.items ?? [])
        setAlmacenes(items)
      })
      .catch(() => setAlmacenes([]))
  }, [noCia])

  // Cuando hay tipo + no del doc original, cargar líneas
  const cargarOrigenWith = useCallback(
    async (tipo: string, no: string) => {
      if (!tipo || !no.trim()) {
        toast.error('Indique el tipo y número del documento a devolver')
        return
      }
      setLoadingOrigen(true)
      try {
        const data = await apiFetch<any>(
          `/inv/documentos/${encodeURIComponent(tipo)}/${encodeURIComponent(no.trim())}/?no_cia=${encodeURIComponent(noCia)}`
        )
        const payload = data?.data ?? data
        const h = payload?.header ?? {}
        const lines = (payload?.lines ?? payload?.lineas ?? []) as any[]
        if (!lines.length) {
          toast.error('El documento no tiene líneas registradas')
          setLineasOrigen([])
          setHeaderOrigen(null)
          return
        }
        const norm: LineaOrigen[] = lines.map((l) => ({
          no_linea: l.no_linea ?? l.NO_LINEA,
          no_produ: String(l.no_produ ?? l.NO_PRODU ?? '').trim(),
          descripcion: String(l.descripcion ?? l.DESCRIPCION ?? '').trim(),
          almacen: String(l.almacen ?? l.ALMACEN ?? '').trim(),
          cantidad: Number(l.cantidad ?? l.CANTIDAD ?? 0),
          costo: Number(l.costo ?? l.COSTO ?? 0),
          precio: Number(l.precio ?? l.PRECIO ?? 0),
          unidad: String(l.unidad ?? l.UNIDAD ?? '').trim(),
          empaque: Number(l.empaque ?? l.EMPAQUE ?? 0) || undefined,
          monto_neto: Number(l.monto_neto ?? l.MONTO_NETO ?? 0),
        }))
        setLineasOrigen(norm)
        setHeaderOrigen(h)
        // Si trae proveedor, pre-rellenarlo
        if (h.no_proveedor && !proveedor) {
          setProveedor(String(h.no_proveedor))
          setProveedorNombre(String(h.proveedor_nombre || ''))
        }
        if (h.almacen && !almacenHeader) {
          setAlmacenHeader(String(h.almacen))
        }
        if (h.ncf_dgi && !ncf) {
          setNcf(String(h.ncf_dgi))
        }
        toast.success(
          `Se cargaron ${norm.length} línea${norm.length === 1 ? '' : 's'} del documento`
        )
      } catch (e: any) {
        const msg = e?.message || ''
        if (msg.includes('404')) toast.error('Documento no encontrado')
        else toast.error('Error al cargar el documento')
        setLineasOrigen([])
        setHeaderOrigen(null)
      } finally {
        setLoadingOrigen(false)
      }
    },
    [noCia, proveedor, almacenHeader, ncf]
  )

  const cargarOrigen = useCallback(
    () => cargarOrigenWith(tipoDocOrigen, docOriginal),
    [cargarOrigenWith, tipoDocOrigen, docOriginal]
  )

  const updateRow = (idx: number, patch: Partial<DevRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  const cargarEmpaques = useCallback(
    async (idx: number, noProdu: string, costoBase: number) => {
      try {
        const r = await regalGeneralApi.fatProductoEmpaques(noProdu)
        const items = (r.items || []) as Array<{
          unidad: string
          descripcion?: string
          por_defecto?: boolean
          cant_por_emp?: number
          empaque?: number
        }>
        const emps: EmpaqueOpt[] = items.map((e: any, i) => ({
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
            costo: costoBase ? (costoBase * factor).toFixed(4) : arr[idx].costo,
          }
          return arr
        })
      } catch {
        /* sin empaques */
      }
    },
    []
  )

  const cambiarEmpaque = (idx: number, unidad: string) => {
    setRows((prev) => {
      const arr = [...prev]
      const row = arr[idx]
      if (!row) return prev
      const emp = row.empaques.find(
        (e) => (e.descripcion || e.unidad) === unidad || e.unidad === unidad
      )
      if (!emp) return prev
      const factorActual =
        row.empaques.find(
          (e) =>
            (e.descripcion || e.unidad) === row.empaque ||
            e.unidad === row.empaque
        )?.cant_por_emp || 1
      const costoBase = (parseFloat(row.costo) || 0) / factorActual
      arr[idx] = {
        ...row,
        empaque: emp.descripcion || emp.unidad,
        costo: (costoBase * (emp.cant_por_emp || 1)).toFixed(4),
      }
      return arr
    })
  }

  const openPicker = (idx: number) => {
    if (!lineasOrigen.length) {
      toast.error('Cargue primero el documento original a devolver')
      return
    }
    setPickerForIdx(idx)
    setPickerOpen(true)
  }

  const addRow = () => {
    setRows((prev) => {
      const next = [...prev, newRow(almacenHeader)]
      setTimeout(() => openPicker(next.length - 1), 0)
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

  const selectFromOrigen = (linea: LineaOrigen) => {
    if (pickerForIdx == null) return
    const idx = pickerForIdx
    // Verificar si ya se eligió esa línea en otra fila
    const yaUsada = rows.some(
      (r, i) => i !== idx && r.origenLinea && r.origenLinea === linea.no_linea
    )
    if (yaUsada) {
      toast.error('Esa línea ya fue añadida al detalle')
      return
    }
    updateRow(idx, {
      noProdu: linea.no_produ,
      nombre: linea.descripcion,
      almacen: linea.almacen || almacenHeader,
      cantidad: String(linea.cantidad),
      costo: String(linea.costo),
      empaque: (linea.unidad || 'UND').toUpperCase() || 'UND',
      origenLinea: linea.no_linea,
      origenCantidad: linea.cantidad,
    })
    cargarEmpaques(idx, linea.no_produ, linea.costo)
    setPickerOpen(false)
    setPickerForIdx(null)
  }

  const fmt = (n: number) =>
    n.toLocaleString('es-DO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

  const montoNeto = rows.reduce(
    (acc, r) =>
      acc + (parseFloat(r.cantidad) || 0) * (parseFloat(r.costo) || 0),
    0
  )
  const totalItbis = montoNeto * ((parseFloat(pctItbis) || 0) / 100)
  const totalNeto = montoNeto + totalItbis

  const handleSave = async () => {
    if (!ENDPOINT_READY) return
    if (!proveedor.trim()) {
      toast.error('Seleccione el proveedor')
      return
    }
    if (!lineasOrigen.length) {
      toast.error('Cargue el documento original a devolver')
      return
    }
    const validRows = rows.filter(
      (r) => r.noProdu.trim() && (parseFloat(r.cantidad) || 0) > 0
    )
    if (validRows.length === 0) {
      toast.error('Agregue al menos un producto con cantidad válida')
      return
    }
    // Validar que no se exceda la cantidad original
    for (const r of validRows) {
      if (
        r.origenCantidad != null &&
        (parseFloat(r.cantidad) || 0) > r.origenCantidad
      ) {
        toast.error(
          `Cantidad a devolver (${r.cantidad}) excede la original (${r.origenCantidad}) en ${r.noProdu}`
        )
        return
      }
    }

    const payload = {
      no_cia: noCia,
      punto,
      tipo_docu: 'DC',
      fecha,
      almacen: almacenHeader,
      tipo_docu_devuelto: tipoDocOrigen,
      no_docu_devuelto: docOriginal,
      no_proveedor: proveedor,
      ncf,
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
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail ?? errData.error ?? `HTTP ${res.status}`)
      }
      const created = await res.json()
      toast.success(
        `Devolución ${created.no_doc ?? ''} registrada correctamente`
      )
      setFecha(new Date().toISOString().slice(0, 10))
      setAlmacenHeader('')
      setProveedor('')
      setProveedorNombre('')
      setNcf('')
      setDocOriginal('')
      setLineasOrigen([])
      setHeaderOrigen(null)
      setPctItbis('18')
      setRows([newRow()])
    } catch (err: any) {
      toast.error(`Error al guardar: ${err.message ?? 'Error desconocido'}`)
    } finally {
      setSaving(false)
    }
  }

  const almacenKey = (a: Almacen) => a.almacen ?? a.codigo ?? ''
  const almacenDesc = (a: Almacen) =>
    a.descripcion ?? a.desc_almacen ?? almacenKey(a)

  return (
    <TooltipProvider>
      <section className='space-y-6'>
        <div>
          <h2 className='text-lg font-semibold'>Devolución a Suplidores</h2>
          <p className='text-sm text-muted-foreground'>
            FINV205 — Devolución de mercancía a proveedores (afecta documento
            original)
          </p>
        </div>

        {/* Documento original a afectar */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>
              Documento Original a Devolver
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-2 items-end gap-4 md:grid-cols-4 lg:grid-cols-5'>
              <div className='space-y-1'>
                <Label htmlFor='ds-tipo-origen'>Tipo Doc.</Label>
                <Select value={tipoDocOrigen} onValueChange={setTipoDocOrigen}>
                  <SelectTrigger id='ds-tipo-origen' className='h-9'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='EC'>EC — Entrada de Compra</SelectItem>
                    <SelectItem value='EA'>EA — Entrada de Almacén</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-1'>
                <Label htmlFor='ds-doc-original'>No. Documento</Label>
                <div className='flex gap-1'>
                  <Input
                    id='ds-doc-original'
                    className='h-9 flex-1 font-mono'
                    placeholder='Click 🔍'
                    value={docOriginal}
                    onChange={(e) => setDocOriginal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') cargarOrigen()
                    }}
                  />
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    className='h-9 w-9 shrink-0'
                    title='Buscar documento'
                    onClick={() => setBuscarDocOpen(true)}
                  >
                    <Search className='h-4 w-4' />
                  </Button>
                </div>
              </div>

              <div className='space-y-1'>
                <Label className='invisible'>cargar</Label>
                <Button
                  variant='outline'
                  className='h-9 w-full gap-2'
                  onClick={cargarOrigen}
                  disabled={loadingOrigen || !docOriginal.trim()}
                >
                  {loadingOrigen ? (
                    <RefreshCw className='h-4 w-4 animate-spin' />
                  ) : (
                    <FileSearch className='h-4 w-4' />
                  )}
                  {loadingOrigen ? 'Cargando...' : 'Cargar líneas'}
                </Button>
              </div>

              {headerOrigen && (
                <>
                  <div className='col-span-2 space-y-1'>
                    <Label className='text-xs text-muted-foreground'>
                      Documento cargado
                    </Label>
                    <div className='flex h-9 items-center gap-2 rounded-md border bg-muted px-3 text-xs'>
                      <span className='font-mono font-semibold'>
                        {tipoDocOrigen}-{String(docOriginal).padStart(7, '0')}
                      </span>
                      <span className='text-muted-foreground'>·</span>
                      <span className='truncate'>
                        {headerOrigen.proveedor_nombre ||
                          headerOrigen.cliente_nombre ||
                          '—'}
                      </span>
                      <span className='ml-auto text-muted-foreground'>
                        {lineasOrigen.length} línea
                        {lineasOrigen.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cabecera devolución */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>
              Encabezado de la Devolución
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4'>
              <div className='space-y-1'>
                <Label htmlFor='ds-fecha'>Fecha</Label>
                <Input
                  id='ds-fecha'
                  type='date'
                  className='h-9'
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>

              <div className='space-y-1'>
                <Label htmlFor='ds-almacen'>Almacén</Label>
                <Select
                  value={almacenHeader}
                  onValueChange={(v) => {
                    setAlmacenHeader(v)
                    setRows((prev) => prev.map((r) => ({ ...r, almacen: v })))
                  }}
                >
                  <SelectTrigger id='ds-almacen' className='h-9'>
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

              <div className='col-span-2 space-y-1'>
                <Label>Proveedor</Label>
                <div className='flex gap-2'>
                  <Input
                    id='ds-proveedor'
                    className='h-9 w-28 font-mono'
                    placeholder='Código'
                    value={proveedor}
                    readOnly
                    onClick={() => setProvModalOpen(true)}
                  />
                  <Input
                    className='h-9 flex-1 bg-background'
                    placeholder='Click la lupa para buscar'
                    value={proveedorNombre}
                    readOnly
                  />
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    className='h-9 w-9 shrink-0'
                    onClick={() => setProvModalOpen(true)}
                  >
                    <Search className='h-4 w-4' />
                  </Button>
                </div>
              </div>

              <div className='space-y-1'>
                <Label htmlFor='ds-ncf'>NCF</Label>
                <Input
                  id='ds-ncf'
                  className='h-9 font-mono'
                  placeholder='B0100000000'
                  value={ncf}
                  onChange={(e) => setNcf(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grid de productos a devolver */}
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-base'>Productos a Devolver</CardTitle>
            <Button
              variant='outline'
              size='sm'
              className='gap-1'
              onClick={addRow}
            >
              <Plus className='h-4 w-4' /> Agregar línea de la factura
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
                      Cant. Original
                    </TableHead>
                    <TableHead className='w-[110px] text-right'>
                      Cant. a Devolver
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
                    return (
                      <TableRow key={row.id}>
                        <TableCell className='px-2 py-1'>
                          <div className='relative'>
                            <Input
                              className='h-8 pr-7 font-mono text-xs'
                              placeholder='Click 🔍'
                              value={row.noProdu}
                              readOnly
                              onClick={() => openPicker(idx)}
                            />
                            <button
                              type='button'
                              className='absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent'
                              title='Elegir línea del documento original'
                              onClick={() => openPicker(idx)}
                            >
                              <Search className='h-3.5 w-3.5' />
                            </button>
                          </div>
                        </TableCell>

                        <TableCell className='px-2 py-1'>
                          <Input
                            className='h-8 text-xs'
                            value={row.nombre}
                            readOnly
                            tabIndex={-1}
                            placeholder='Descripción'
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

                        <TableCell className='px-2 py-1 text-right'>
                          <div className='flex h-8 items-center justify-end rounded-md border bg-muted/50 px-2 font-mono text-xs text-muted-foreground tabular-nums'>
                            {row.origenCantidad != null
                              ? fmt(row.origenCantidad)
                              : '—'}
                          </div>
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
                      colSpan={7}
                      className='pr-4 text-right text-xs font-medium'
                    >
                      Monto Neto:
                    </TableCell>
                    <TableCell className='text-right font-mono text-xs font-semibold tabular-nums'>
                      {fmt(montoNeto)}
                    </TableCell>
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
            <div className='grid grid-cols-2 items-end gap-4 md:grid-cols-3 lg:grid-cols-4'>
              <div className='space-y-1'>
                <Label>Monto Neto</Label>
                <div className='flex h-9 items-center rounded-md border bg-muted px-3 font-mono text-sm tabular-nums'>
                  {fmt(montoNeto)}
                </div>
              </div>

              <div className='space-y-1'>
                <Label htmlFor='ds-pct-itbis'>% ITBIS</Label>
                <Input
                  id='ds-pct-itbis'
                  type='number'
                  min={0}
                  max={100}
                  step='0.01'
                  className='h-9 text-right tabular-nums'
                  placeholder='18.00'
                  value={pctItbis}
                  onChange={(e) => setPctItbis(e.target.value)}
                />
              </div>

              <div className='space-y-1'>
                <Label>Total ITBIS</Label>
                <div className='flex h-9 items-center rounded-md border bg-muted px-3 font-mono text-sm tabular-nums'>
                  {fmt(totalItbis)}
                </div>
              </div>

              <div className='space-y-1'>
                <Label>Total Neto</Label>
                <div className='flex h-9 items-center rounded-md border bg-muted px-3 font-mono text-sm font-bold tabular-nums'>
                  {fmt(totalNeto)}
                </div>
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
                  title={
                    !ENDPOINT_READY ? 'Endpoint en construcción' : undefined
                  }
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </Button>
              </span>
            </TooltipTrigger>
            {!ENDPOINT_READY && (
              <TooltipContent side='left'>
                <p>POST /api/inv/movimientos/ con tipo_docu=DC</p>
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </section>

      {/* Picker de líneas del documento original */}
      <Dialog
        open={pickerOpen}
        onOpenChange={(o) => {
          if (!o) {
            setPickerOpen(false)
            setPickerForIdx(null)
          }
        }}
      >
        <DialogContent className='flex max-h-[80vh] w-[80vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none'>
          <DialogHeader className='shrink-0 border-b px-6 py-4'>
            <DialogTitle>
              Líneas del documento {tipoDocOrigen}-
              {String(docOriginal).padStart(7, '0')}
            </DialogTitle>
            <p className='text-xs text-muted-foreground'>
              Selecciona la línea del producto a devolver
            </p>
          </DialogHeader>

          <div className='flex-1 overflow-y-auto px-6 py-2'>
            <Table>
              <TableHeader className='sticky top-0 z-10 bg-background'>
                <TableRow>
                  <TableHead className='w-12'>Ln</TableHead>
                  <TableHead className='w-28'>Código</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className='w-20'>Almacén</TableHead>
                  <TableHead className='w-16'>UM</TableHead>
                  <TableHead className='w-24 text-right'>Cantidad</TableHead>
                  <TableHead className='w-24 text-right'>Costo</TableHead>
                  <TableHead className='w-24 text-right'>Total</TableHead>
                  <TableHead className='w-24 text-center'>Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineasOrigen.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className='py-10 text-center text-sm text-muted-foreground'
                    >
                      Sin líneas. Carga el documento original primero.
                    </TableCell>
                  </TableRow>
                )}
                {lineasOrigen.map((l) => {
                  const yaUsada = rows.some((r) => r.origenLinea === l.no_linea)
                  return (
                    <TableRow
                      key={String(l.no_linea)}
                      className={
                        yaUsada
                          ? 'opacity-50'
                          : 'cursor-pointer hover:bg-blue-50'
                      }
                      onDoubleClick={() => !yaUsada && selectFromOrigen(l)}
                    >
                      <TableCell className='text-center font-mono text-xs'>
                        {l.no_linea}
                      </TableCell>
                      <TableCell className='font-mono text-xs font-semibold'>
                        {l.no_produ}
                      </TableCell>
                      <TableCell className='text-sm'>{l.descripcion}</TableCell>
                      <TableCell className='text-xs'>
                        {l.almacen || '—'}
                      </TableCell>
                      <TableCell className='text-xs'>
                        {l.unidad || '—'}
                      </TableCell>
                      <TableCell className='text-right font-mono text-sm tabular-nums'>
                        {fmt(l.cantidad)}
                      </TableCell>
                      <TableCell className='text-right font-mono text-sm tabular-nums'>
                        {fmt(l.costo)}
                      </TableCell>
                      <TableCell className='text-right font-mono text-sm font-semibold tabular-nums'>
                        {fmt(
                          l.monto_neto && l.monto_neto > 0
                            ? l.monto_neto
                            : l.cantidad * l.costo
                        )}
                      </TableCell>
                      <TableCell className='text-center'>
                        <Button
                          size='sm'
                          variant={yaUsada ? 'ghost' : 'default'}
                          disabled={yaUsada}
                          onClick={() => selectFromOrigen(l)}
                        >
                          {yaUsada ? 'Añadida' : 'Devolver'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className='flex shrink-0 items-center justify-between border-t bg-background px-6 py-3 text-sm text-gray-500'>
            <span>
              {lineasOrigen.length} línea{lineasOrigen.length === 1 ? '' : 's'}{' '}
              en el documento
            </span>
            <Button
              variant='outline'
              size='sm'
              onClick={() => {
                setPickerOpen(false)
                setPickerForIdx(null)
              }}
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: buscar documento original (EC/EA) */}
      <BuscarDocumentoModal
        open={buscarDocOpen}
        onClose={() => setBuscarDocOpen(false)}
        source='inv'
        noCia={noCia}
        punto={punto}
        title='Buscar Entrada de Compra / Almacén'
        defaultTipo={tipoDocOrigen}
        tipos={[
          { value: 'EC', label: 'EC — Entrada de Compra' },
          { value: 'EA', label: 'EA — Entrada de Almacén' },
        ]}
        onSelect={(r) => {
          setTipoDocOrigen(r.tipo)
          setDocOriginal(String(r.no_docu))
          cargarOrigenWith(r.tipo, String(r.no_docu))
        }}
      />

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
