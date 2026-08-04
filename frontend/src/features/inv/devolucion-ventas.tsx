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

interface LineaFactura {
  no_linea: number
  no_produ: string
  descripcion: string
  almacen?: string
  cantidad: number
  precio: number
  descuento?: number
  porc_descuento?: number
  porciento_impuesto?: number
  impuesto?: number
  monto_neto?: number
  st_anulado?: string
}

interface DevRow {
  id: number
  noProdu: string
  nombre: string
  cantidad: string
  precio: string
  almacen: string
  empaque?: string
  empaques: EmpaqueOpt[]
  origenLinea?: number
  origenCantidad?: number
}

let rowIdCounter = 400

function newRow(almacen = ''): DevRow {
  return {
    id: rowIdCounter++,
    noProdu: '',
    nombre: '',
    cantidad: '',
    precio: '',
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

export function DevolucionVentas({ noCia, punto }: Props) {
  // Cabecera
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [almacenHeader, setAlmacenHeader] = useState('')

  // Cliente y vendedor
  const [cliente, setCliente] = useState('')
  const [clienteNombre, setClienteNombre] = useState('')
  const [cliModalOpen, setCliModalOpen] = useState(false)
  const [vendedor, setVendedor] = useState('')
  const [vendedorNombre, setVendedorNombre] = useState('')
  const [vendModalOpen, setVendModalOpen] = useState(false)
  const [ncf, setNcf] = useState('')

  // Factura original a afectar
  const [tipoFactOrigen, setTipoFactOrigen] = useState('FT')
  const [docOriginal, setDocOriginal] = useState('')
  const [lineasOrigen, setLineasOrigen] = useState<LineaFactura[]>([])
  const [headerOrigen, setHeaderOrigen] = useState<Record<string, any> | null>(
    null
  )
  const [loadingOrigen, setLoadingOrigen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerForIdx, setPickerForIdx] = useState<number | null>(null)
  const [buscarFactOpen, setBuscarFactOpen] = useState(false)

  // Totales
  const [pctItbis, setPctItbis] = useState('18')

  // Catálogos
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])

  // Grid
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

  const cargarFacturaWith = useCallback(
    async (tipo: string, no: string) => {
      if (!tipo || !no.trim()) {
        toast.error('Indique tipo y número de factura')
        return
      }
      setLoadingOrigen(true)
      try {
        const url = `/fat/facturas/${encodeURIComponent(tipo)}/${encodeURIComponent(no.trim())}/?no_cia=${encodeURIComponent(noCia)}&punto=${encodeURIComponent(punto)}`
        const data = await apiFetch<any>(url)
        const lineas = (data.lineas || []) as any[]
        if (!lineas.length) {
          toast.error('La factura no tiene líneas')
          setLineasOrigen([])
          setHeaderOrigen(null)
          return
        }
        const norm: LineaFactura[] = lineas
          .filter((l) => (l.st_anulado || 'N') !== 'S')
          .map((l) => ({
            no_linea: Number(l.no_linea || 0),
            no_produ: String(l.no_produ || '').trim(),
            descripcion: String(l.descripcion || '').trim(),
            almacen: String(l.almacen || '').trim(),
            cantidad: Number(l.cantidad || 0),
            precio: Number(l.precio || 0),
            descuento: Number(l.descuento || 0),
            porc_descuento: Number(l.porc_descuento || 0),
            porciento_impuesto: Number(l.porciento_impuesto || 0),
            impuesto: Number(l.impuesto || 0),
            monto_neto: Number(l.monto_neto || 0),
            st_anulado: l.st_anulado || 'N',
          }))
        setLineasOrigen(norm)
        setHeaderOrigen(data)
        // Prefill desde la factura
        if (data.no_cliente && !cliente) {
          setCliente(String(data.no_cliente))
          setClienteNombre(String(data.nombre_cliente || ''))
        }
        if (data.vendedor && !vendedor) {
          setVendedor(String(data.vendedor))
        }
        if (data.ncf_dgi && !ncf) {
          setNcf(String(data.ncf_dgi))
        }
        if (data.porc_impuesto) {
          setPctItbis(String(data.porc_impuesto))
        }
        // Si las líneas tienen un almacén común, usarlo
        const almSet = new Set(norm.map((l) => l.almacen).filter(Boolean))
        if (almSet.size === 1 && !almacenHeader) {
          setAlmacenHeader(Array.from(almSet)[0]!)
        }
        toast.success(
          `Se cargaron ${norm.length} línea${norm.length === 1 ? '' : 's'} de la factura`
        )
      } catch (e: any) {
        const msg = e?.message || ''
        if (msg.includes('404')) toast.error('Factura no encontrada')
        else toast.error('Error al cargar la factura')
        setLineasOrigen([])
        setHeaderOrigen(null)
      } finally {
        setLoadingOrigen(false)
      }
    },
    [noCia, punto, cliente, vendedor, ncf, almacenHeader]
  )

  const cargarFactura = useCallback(
    () => cargarFacturaWith(tipoFactOrigen, docOriginal),
    [cargarFacturaWith, tipoFactOrigen, docOriginal]
  )

  const updateRow = (idx: number, patch: Partial<DevRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  const cargarEmpaques = useCallback(
    async (idx: number, noProdu: string, precioBase: number) => {
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
            precio: precioBase
              ? (precioBase * factor).toFixed(4)
              : arr[idx].precio,
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
      const precioBase = (parseFloat(row.precio) || 0) / factorActual
      arr[idx] = {
        ...row,
        empaque: emp.descripcion || emp.unidad,
        precio: (precioBase * (emp.cant_por_emp || 1)).toFixed(4),
      }
      return arr
    })
  }

  const openPicker = (idx: number) => {
    if (!lineasOrigen.length) {
      toast.error('Carga primero la factura original')
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

  const selectFromFactura = (linea: LineaFactura) => {
    if (pickerForIdx == null) return
    const idx = pickerForIdx
    const yaUsada = rows.some(
      (r, i) => i !== idx && r.origenLinea === linea.no_linea
    )
    if (yaUsada) {
      toast.error('Esa línea ya fue agregada')
      return
    }
    updateRow(idx, {
      noProdu: linea.no_produ,
      nombre: linea.descripcion,
      almacen: linea.almacen || almacenHeader,
      cantidad: String(linea.cantidad),
      precio: String(linea.precio),
      origenLinea: linea.no_linea,
      origenCantidad: linea.cantidad,
    })
    cargarEmpaques(idx, linea.no_produ, linea.precio)
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
      acc + (parseFloat(r.cantidad) || 0) * (parseFloat(r.precio) || 0),
    0
  )
  const totalItbis = montoNeto * ((parseFloat(pctItbis) || 0) / 100)
  const totalNeto = montoNeto + totalItbis

  const handleSave = async () => {
    if (!ENDPOINT_READY) return
    if (!cliente.trim()) {
      toast.error('Seleccione el cliente')
      return
    }
    if (!lineasOrigen.length) {
      toast.error('Cargue la factura original')
      return
    }
    const validRows = rows.filter(
      (r) => r.noProdu.trim() && (parseFloat(r.cantidad) || 0) > 0
    )
    if (validRows.length === 0) {
      toast.error('Agregue al menos un producto')
      return
    }
    for (const r of validRows) {
      if (
        r.origenCantidad != null &&
        (parseFloat(r.cantidad) || 0) > r.origenCantidad
      ) {
        toast.error(
          `Cantidad a devolver (${r.cantidad}) excede la facturada (${r.origenCantidad}) en ${r.noProdu}`
        )
        return
      }
    }

    const payload = {
      no_cia: noCia,
      punto,
      tipo_docu: 'DV',
      fecha,
      almacen: almacenHeader,
      no_cliente: cliente,
      vendedor,
      ncf,
      tipo_docu_devuelto: tipoFactOrigen,
      no_docu_devuelto: docOriginal,
      detalle: validRows.map((r) => {
        const emp = r.empaques.find(
          (e) =>
            (e.descripcion || e.unidad) === r.empaque || e.unidad === r.empaque
        )
        return {
          no_produ: r.noProdu,
          almacen: r.almacen || almacenHeader,
          cantidad: parseFloat(r.cantidad) || 0,
          precio: parseFloat(r.precio) || 0,
          porciento_impuesto: parseFloat(pctItbis) || 0,
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
      setCliente('')
      setClienteNombre('')
      setVendedor('')
      setVendedorNombre('')
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
          <h2 className='text-lg font-semibold'>Devolución sobre Ventas</h2>
          <p className='text-sm text-muted-foreground'>
            FINV209 — Devolución de mercancía de clientes (afecta factura
            original)
          </p>
        </div>

        {/* Factura original */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>
              Factura Original a Devolver
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-2 items-end gap-4 md:grid-cols-4 lg:grid-cols-5'>
              <div className='space-y-1'>
                <Label htmlFor='dv-tipo-origen'>Tipo Factura</Label>
                <Select
                  value={tipoFactOrigen}
                  onValueChange={setTipoFactOrigen}
                >
                  <SelectTrigger id='dv-tipo-origen' className='h-9'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='FT'>FT — Factura Contado</SelectItem>
                    <SelectItem value='FC'>FC — Factura Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-1'>
                <Label htmlFor='dv-doc-original'>No. Factura</Label>
                <div className='flex gap-1'>
                  <Input
                    id='dv-doc-original'
                    className='h-9 flex-1 font-mono'
                    placeholder='Click 🔍'
                    value={docOriginal}
                    onChange={(e) => setDocOriginal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') cargarFactura()
                    }}
                  />
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    className='h-9 w-9 shrink-0'
                    title='Buscar factura'
                    onClick={() => setBuscarFactOpen(true)}
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
                  onClick={cargarFactura}
                  disabled={loadingOrigen || !docOriginal.trim()}
                >
                  {loadingOrigen ? (
                    <RefreshCw className='h-4 w-4 animate-spin' />
                  ) : (
                    <FileSearch className='h-4 w-4' />
                  )}
                  {loadingOrigen ? 'Cargando...' : 'Cargar factura'}
                </Button>
              </div>

              {headerOrigen && (
                <div className='col-span-2 space-y-1'>
                  <Label className='text-xs text-muted-foreground'>
                    Factura cargada
                  </Label>
                  <div className='flex h-9 items-center gap-2 rounded-md border bg-muted px-3 text-xs'>
                    <span className='font-mono font-semibold'>
                      {tipoFactOrigen}-{String(docOriginal).padStart(7, '0')}
                    </span>
                    <span className='text-muted-foreground'>·</span>
                    <span className='truncate'>
                      {headerOrigen.nombre_cliente || '—'}
                    </span>
                    <span className='ml-auto text-muted-foreground'>
                      {lineasOrigen.length} línea
                      {lineasOrigen.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
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
                <Label htmlFor='dv-fecha'>Fecha</Label>
                <Input
                  id='dv-fecha'
                  type='date'
                  className='h-9'
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>

              <div className='space-y-1'>
                <Label htmlFor='dv-almacen'>Almacén</Label>
                <Select
                  value={almacenHeader}
                  onValueChange={(v) => {
                    setAlmacenHeader(v)
                    setRows((prev) => prev.map((r) => ({ ...r, almacen: v })))
                  }}
                >
                  <SelectTrigger id='dv-almacen' className='h-9'>
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
                <Label>Cliente</Label>
                <div className='flex gap-2'>
                  <Input
                    className='h-9 w-28 font-mono'
                    placeholder='Código'
                    value={cliente}
                    readOnly
                    onClick={() => setCliModalOpen(true)}
                  />
                  <Input
                    className='h-9 flex-1 bg-background'
                    placeholder='Click la lupa para buscar'
                    value={clienteNombre}
                    readOnly
                  />
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    className='h-9 w-9 shrink-0'
                    onClick={() => setCliModalOpen(true)}
                  >
                    <Search className='h-4 w-4' />
                  </Button>
                </div>
              </div>

              <div className='col-span-2 space-y-1'>
                <Label>Vendedor</Label>
                <div className='flex gap-2'>
                  <Input
                    className='h-9 w-28 font-mono'
                    placeholder='Código'
                    value={vendedor}
                    readOnly
                    onClick={() => setVendModalOpen(true)}
                  />
                  <Input
                    className='h-9 flex-1 bg-background'
                    placeholder='Click la lupa para buscar'
                    value={vendedorNombre}
                    readOnly
                  />
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    className='h-9 w-9 shrink-0'
                    onClick={() => setVendModalOpen(true)}
                  >
                    <Search className='h-4 w-4' />
                  </Button>
                </div>
              </div>

              <div className='space-y-1'>
                <Label htmlFor='dv-ncf'>NCF</Label>
                <Input
                  id='dv-ncf'
                  className='h-9 font-mono'
                  placeholder='B0400000000'
                  value={ncf}
                  onChange={(e) => setNcf(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grid */}
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
                      Cant. Facturada
                    </TableHead>
                    <TableHead className='w-[110px] text-right'>
                      Cant. a Devolver
                    </TableHead>
                    <TableHead className='w-[120px] text-right'>
                      Precio Unit.
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
                      (parseFloat(row.precio) || 0)
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
                              title='Elegir línea de la factura'
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
                            value={row.precio}
                            onChange={(e) =>
                              updateRow(idx, { precio: e.target.value })
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
                <Label htmlFor='dv-pct-itbis'>% ITBIS</Label>
                <Input
                  id='dv-pct-itbis'
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
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </Button>
              </span>
            </TooltipTrigger>
          </Tooltip>
        </div>
      </section>

      {/* Picker de líneas de la factura */}
      <Dialog
        open={pickerOpen}
        onOpenChange={(o) => {
          if (!o) {
            setPickerOpen(false)
            setPickerForIdx(null)
          }
        }}
      >
        <DialogContent size='picker-lg'>
          <DialogHeader className='shrink-0 border-b px-6 py-4'>
            <DialogTitle>
              Líneas de la factura {tipoFactOrigen}-
              {String(docOriginal).padStart(7, '0')}
            </DialogTitle>
            <p className='text-xs text-muted-foreground'>
              Selecciona la línea del producto que el cliente devuelve
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
                  <TableHead className='w-24 text-right'>Cantidad</TableHead>
                  <TableHead className='w-24 text-right'>Precio</TableHead>
                  <TableHead className='w-24 text-right'>Total</TableHead>
                  <TableHead className='w-24 text-center'>Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineasOrigen.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className='py-10 text-center text-sm text-muted-foreground'
                    >
                      Sin líneas. Carga la factura primero.
                    </TableCell>
                  </TableRow>
                )}
                {lineasOrigen.map((l) => {
                  const yaUsada = rows.some((r) => r.origenLinea === l.no_linea)
                  return (
                    <TableRow
                      key={l.no_linea}
                      className={
                        yaUsada
                          ? 'opacity-50'
                          : 'cursor-pointer hover:bg-blue-50'
                      }
                      onDoubleClick={() => !yaUsada && selectFromFactura(l)}
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
                      <TableCell className='text-right font-mono text-sm tabular-nums'>
                        {fmt(l.cantidad)}
                      </TableCell>
                      <TableCell className='text-right font-mono text-sm tabular-nums'>
                        {fmt(l.precio)}
                      </TableCell>
                      <TableCell className='text-right font-mono text-sm font-semibold tabular-nums'>
                        {fmt(
                          l.monto_neto && l.monto_neto > 0
                            ? l.monto_neto
                            : l.cantidad * l.precio
                        )}
                      </TableCell>
                      <TableCell className='text-center'>
                        <Button
                          size='sm'
                          variant={yaUsada ? 'ghost' : 'default'}
                          disabled={yaUsada}
                          onClick={() => selectFromFactura(l)}
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
              en la factura
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

      <BuscarDocumentoModal
        open={buscarFactOpen}
        onClose={() => setBuscarFactOpen(false)}
        source='fat'
        noCia={noCia}
        punto={punto}
        title='Buscar Factura'
        defaultTipo={tipoFactOrigen}
        tipos={[
          { value: 'FT', label: 'FT — Factura Contado' },
          { value: 'FC', label: 'FC — Factura Crédito' },
        ]}
        onSelect={(r) => {
          setTipoFactOrigen(r.tipo)
          setDocOriginal(String(r.no_docu))
          cargarFacturaWith(r.tipo, String(r.no_docu))
        }}
      />

      <EntityPickerModal<any>
        open={cliModalOpen}
        onClose={() => setCliModalOpen(false)}
        title='Buscar Cliente'
        placeholder='Buscar por código o nombre...'
        fetcher={async (q) => {
          const res = await regalGeneralApi.cxcListClientes(noCia, q, 1)
          const list =
            (res as any)?.items ||
            (res as any)?.results ||
            (Array.isArray(res) ? res : [])
          return Array.isArray(list) ? list.slice(0, 100) : []
        }}
        columns={[
          { key: 'no_cliente', label: 'Código', width: '110px' },
          { key: 'nombre', label: 'Nombre' },
          { key: 'rnc', label: 'RNC', width: '140px' },
        ]}
        getKey={(p) => p.no_cliente}
        onSelect={(p) => {
          setCliente(String(p.no_cliente || ''))
          setClienteNombre((p.nombre || '').trim())
        }}
      />

      <EntityPickerModal<any>
        open={vendModalOpen}
        onClose={() => setVendModalOpen(false)}
        title='Buscar Vendedor'
        placeholder='Buscar vendedor...'
        fetcher={async () => {
          const list = await regalGeneralApi.fatListVendedores(noCia)
          return Array.isArray(list) ? list : []
        }}
        columns={[
          { key: 'vendedor', label: 'Código', width: '110px' },
          { key: 'nombre', label: 'Nombre' },
        ]}
        getKey={(p) => p.vendedor}
        onSelect={(p) => {
          setVendedor(String(p.vendedor || ''))
          setVendedorNombre((p.nombre || '').trim())
        }}
      />
    </TooltipProvider>
  )
}
