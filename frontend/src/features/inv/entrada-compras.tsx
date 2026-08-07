import { useEffect, useState, useCallback } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { Plus, Trash2, Search, FileDown, CheckCircle2, History } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { BuscarProductoModal } from '@/features/fat/components/buscar-producto-modal'
import { CrearProductoModal } from '@/features/fat/components/crear-producto-modal'
import { empaqueLabel } from '@/features/fat/utils/empaque-label'
import { ProveedorPicker } from '@/features/cxp/cxp-procesos'
import { regalGeneralApi, api } from '@/lib/regal-general-api'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

interface EmpaqueOpt {
  empaque: number
  unidad: string
  descripcion?: string
  referencia?: string
  cant_por_emp: number
  por_defecto: boolean
  permite_fraccion?: boolean
}

const ENDPOINT_READY = true
const invRoute = getRouteApi('/_authenticated/inv')

interface Props {
  noCia: string
  punto: string
}

interface TipoDocu {
  tipo_docu?: string
  tipo_doc?: string
  descripcion?: string
  tipo_mov?: string
  [key: string]: any
}

interface Almacen {
  almacen?: string
  codigo?: string
  descripcion?: string
  desc_almacen?: string
  [key: string]: any
}

interface ProductoRow {
  id: number
  noProdu: string
  nombre: string
  cantidad: string
  costo: string
  almacen: string
  empaque?: string
  empaques: EmpaqueOpt[]
  costoBase: number
}

interface ProveedorSel {
  no_proveedor: string
  nombre: string
  rnc: string
  direccion: string
  [key: string]: any
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

let rowIdCounter = 100

function newRow(almacen = ''): ProductoRow {
  return { id: rowIdCounter++, noProdu: '', nombre: '', cantidad: '', costo: '',
           almacen, empaque: 'UND', empaques: [], costoBase: 0 }
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function EntradaCompras({ noCia, punto }: Props) {
  const navigate = invRoute.useNavigate()
  // Header
  const [tipoDocu, setTipoDocu] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [tasaUsd, setTasaUsd] = useState('')
  const [almacenHeader, setAlmacenHeader] = useState('')

  // Proveedor (picker con lupa — igual al selector de cliente en FAT)
  const [proveedorSel, setProveedorSel] = useState<ProveedorSel | null>(null)
  const proveedor = proveedorSel?.no_proveedor ?? ''
  const [ncf, setNcf] = useState('')
  const [formaPago, setFormaPago] = useState('')
  const [fechaVcto, setFechaVcto] = useState('')
  // RNC editable: se precarga con el del proveedor pero el usuario puede
  // sobrescribirlo (compras con TC llegan con RNC ficticio en el proveedor).
  const [rnc, setRnc] = useState('')

  // Cargar desde Orden de Compra (ODC)
  const [noOrdenOdc, setNoOrdenOdc] = useState('')
  const [cargandoOdc, setCargandoOdc] = useState(false)
  const [ordenCargada, setOrdenCargada] = useState<{ no_orden: string; nombre_proveedor: string; total: number } | null>(null)

  // Comentario / nota del documento
  const [nota, setNota] = useState('')

  // Totales
  const [pctDescuento, setPctDescuento] = useState('')
  const [pctItbis, setPctItbis] = useState('18')

  // Catalogs
  const [tiposDocu, setTiposDocu] = useState<TipoDocu[]>([])
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])

  // Grid
  const [rows, setRows] = useState<ProductoRow[]>([newRow()])

  // Product search (legacy inline, conservado)
  const [searchIdx, setSearchIdx] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<ProductoResult[]>([])
  const [searching, setSearching] = useState(false)

  // Modal "Crear Producto" — disparado desde el dropdown de búsqueda inline
  // cuando no hay resultados para el texto tecleado.
  const [crearProductoOpen, setCrearProductoOpen] = useState(false)
  const [crearProductoIdx, setCrearProductoIdx] = useState<number | null>(null)
  const [crearProductoTerm, setCrearProductoTerm] = useState('')

  const abrirCrearProducto = (idx: number, term: string) => {
    setCrearProductoIdx(idx)
    setCrearProductoTerm(term)
    setCrearProductoOpen(true)
    setSearchIdx(null)
    setSearchResults([])
  }

  // Modal de buscar producto (FAT-style)
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [productModalForIdx, setProductModalForIdx] = useState<number | null>(null)

  const [saving, setSaving] = useState(false)

  // Precarga el RNC con el del proveedor al seleccionarlo/cambiarlo.
  // El usuario puede editarlo después (ej. compras con TC con RNC ficticio).
  useEffect(() => {
    setRnc(proveedorSel?.rnc ?? '')
  }, [proveedorSel?.no_proveedor])

  useEffect(() => {
    if (!noCia) return
    apiFetch<any>(`/inv/tipos-docu/?no_cia=${encodeURIComponent(noCia)}`)
      .then((data) => {
        const items: TipoDocu[] = Array.isArray(data) ? data : (data.results ?? data.items ?? [])
        // Esta vista es SOLO Entrada de Compra (EC): no debe permitir otros tipos.
        const filtered = items.filter((t) => String(t.tipo_docu ?? t.tipo_doc ?? '').toUpperCase() === 'EC')
        setTiposDocu(filtered)
        if (filtered.length === 1) setTipoDocu(String(filtered[0].tipo_docu ?? filtered[0].tipo_doc ?? ''))
      })
      .catch(() => setTiposDocu([]))

    apiFetch<any>(`/inv/almacenes/?no_cia=${encodeURIComponent(noCia)}`)
      .then((data) => {
        const items: Almacen[] = Array.isArray(data) ? data : (data.results ?? data.items ?? [])
        setAlmacenes(items)
        // Si hay un solo almacén, preseleccionarlo (seguro). Con varios NO se
        // auto-elige para no registrar en el almacén equivocado por error.
        if (items.length === 1) setAlmacenHeader((prev) => prev || String(items[0].almacen))
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

  const updateRow = (idx: number, patch: Partial<ProductoRow>) => {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))
  }

  const cargarEmpaques = useCallback(async (idx: number, noProdu: string, costoBase: number) => {
    try {
      const r = await regalGeneralApi.fatProductoEmpaques(noProdu)
      const items = (r.items || []) as Array<{ unidad: string; descripcion?: string; por_defecto?: boolean; cant_por_emp?: number; empaque?: number }>
      const emps: EmpaqueOpt[] = items.map((e: any, i) => ({
        empaque: e.empaque ?? i + 1,
        unidad: (e.unidad || 'UND').trim() || 'UND',
        descripcion: e.descripcion || e.unidad,
        referencia: e.referencia || '',
        cant_por_emp: e.cant_por_emp && e.cant_por_emp > 0 ? e.cant_por_emp : 1,
        por_defecto: !!e.por_defecto,
        permite_fraccion: !!e.permite_fraccion,
      }))
      const def = emps.find(e => e.por_defecto) || emps[0]
      setRows(prev => {
        const arr = [...prev]
        if (!arr[idx] || arr[idx].noProdu !== noProdu) return prev
        const empaque = def ? (def.descripcion || def.unidad) : 'UND'
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
    } catch { /* sin empaques => UND */ }
  }, [])

  const cambiarEmpaque = (idx: number, unidad: string) => {
    setRows(prev => {
      const arr = [...prev]
      const row = arr[idx]
      if (!row) return prev
      const emp = row.empaques.find(e => (e.descripcion || e.unidad) === unidad || e.unidad === unidad)
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

  const openProductModal = (idx: number) => {
    setProductModalForIdx(idx)
    setProductModalOpen(true)
  }

  // Carga cabecera + líneas de una orden de compra (ODC) autorizada
  // dentro del formulario. Equivalente al `extraer por número de orden`
  // del legacy Finv. Sólo importa órdenes activas (st_anulado='A') del
  // punto/empresa actuales.
  const cargarDesdeOrden = useCallback(async () => {
    const noOrden = noOrdenOdc.trim().padStart(8, '0')
    if (!noOrden) {
      toast.error('Ingrese un número de orden de compra')
      return
    }
    setCargandoOdc(true)
    try {
      const data = await api.odcGetOrden(noCia, punto, noOrden)
      if (!data?.cabecera) { toast.error(`Orden ODC-${noOrden} no encontrada`); return }
      const c: any = data.cabecera
      if ((c.st_anulado || 'A').toUpperCase() === 'N') {
        toast.error(`Orden ODC-${noOrden} está anulada`); return
      }
      if (c.estado === 'R') {
        toast.error(`Orden ODC-${noOrden} ya está cerrada / recibida`); return
      }
      const codProv = String(c.no_proveedor || '').trim()
      if (codProv) {
        // Trae ficha completa del proveedor (nombre, RNC, dirección) para el card
        try {
          const p = await api.cxpGetProveedor(codProv)
          setProveedorSel(p?.no_proveedor ? p : { no_proveedor: codProv, nombre: c.nombre_proveedor || codProv, rnc: '', direccion: '' })
        } catch {
          setProveedorSel({ no_proveedor: codProv, nombre: c.nombre_proveedor || codProv, rnc: '', direccion: '' })
        }
      } else {
        setProveedorSel(null)
      }
      if (c.plazo_pago && c.plazo_pago > 0) {
        setFormaPago('credito')
        const f = new Date(c.fecha || Date.now()); f.setDate(f.getDate() + Number(c.plazo_pago))
        setFechaVcto(f.toISOString().slice(0, 10))
      } else {
        setFormaPago('contado')
        setFechaVcto('')
      }
      const nuevasRows: ProductoRow[] = (data.lineas || []).map((l: any) => ({
        id: rowIdCounter++,
        noProdu: l.no_produ || '',
        nombre: l.descripcion_producto || '',
        cantidad: String(Number(l.cantidad_pedida || 0) - Number(l.cantidad_recibida || 0)),
        costo: Number(l.costo || 0).toFixed(4),
        almacen: almacenHeader,
        empaque: 'UND',
        empaques: [],
        costoBase: Number(l.costo || 0),
      }))
      setRows(nuevasRows.length ? nuevasRows : [newRow(almacenHeader)])
      setOrdenCargada({
        no_orden: noOrden,
        nombre_proveedor: c.nombre_proveedor || c.no_proveedor || '',
        total: Number(c.total_neto || 0),
      })
      toast.success(`Orden ODC-${noOrden} cargada: ${(data.lineas || []).length} líneas`)
    } catch (e: any) {
      toast.error(`No se pudo cargar la orden: ${e?.detail?.error || e?.message || 'error'}`)
    } finally {
      setCargandoOdc(false)
    }
  }, [noOrdenOdc, noCia, punto, almacenHeader])

  const limpiarOrden = () => {
    setOrdenCargada(null)
    setNoOrdenOdc('')
    setRows([newRow(almacenHeader)])
  }

  const addRow = () => setRows((prev) => {
    const next = [...prev, newRow(almacenHeader)]
    setTimeout(() => openProductModal(next.length - 1), 0)
    return next
  })

  const removeRow = (idx: number) => {
    setRows((prev) => prev.length === 1 ? [newRow(almacenHeader)] : prev.filter((_, i) => i !== idx))
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

  const fmt = (n: number) => n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // Computed totals
  const subtotal = rows.reduce((acc, r) => acc + (parseFloat(r.cantidad) || 0) * (parseFloat(r.costo) || 0), 0)
  const descMonto = subtotal * ((parseFloat(pctDescuento) || 0) / 100)
  const totalBruto = subtotal - descMonto
  const totalItbis = totalBruto * ((parseFloat(pctItbis) || 0) / 100)
  const totalNeto = totalBruto + totalItbis

  const handleSave = async () => {
    if (!ENDPOINT_READY) return
    if (!tipoDocu) { toast.error('Seleccione el Tipo de Documento'); return }
    if (!proveedorSel) { toast.error('Seleccione el proveedor (use la lupa para buscarlo)'); return }
    const validRows = rows.filter((r) => r.noProdu.trim() && (parseFloat(r.cantidad) || 0) > 0)
    if (validRows.length === 0) { toast.error('Agregue al menos un producto con cantidad válida'); return }

    const payload = {
      no_cia: noCia,
      punto,
      tipo_docu: tipoDocu,
      fecha,
      tasa_usd: parseFloat(tasaUsd) || 1,
      almacen: almacenHeader,
      proveedor,
      rnc,
      ncf,
      forma_pago: formaPago,
      fecha_vcto: fechaVcto,
      pct_descuento: parseFloat(pctDescuento) || 0,
      pct_itbis: parseFloat(pctItbis) || 0,
      tipo: 'compra',
      nota,
      no_orden: ordenCargada?.no_orden,
      detalle: validRows.map((r) => ({
        no_produ: r.noProdu,
        almacen: r.almacen || almacenHeader,
        cantidad: parseFloat(r.cantidad) || 0,
        costo: parseFloat(r.costo) || 0,
      })),
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
      const docNo =
        created.no_doc ??
        created.no_docu ??
        created.data?.no_doc ??
        created.data?.no_docu ??
        ''
      toast.success(`Documento ${docNo} guardado correctamente`)
      const cxpMirror = created.cxp_mirror ?? created.data?.cxp_mirror
      if (tipoDocu === 'EC' && cxpMirror?.error) {
        // El espejo en Cuentas por Pagar (que alimenta el 606) puede fallar
        // sin revertir la entrada de inventario -- si eso pasa el operador
        // debe saberlo para corregirlo manualmente en CxP, no descubrirlo
        // dias despues cuando falte en el 606.
        toast.error(
          `La compra se guardó en Inventario, pero NO se generó el documento en Cuentas por Pagar (no aparecerá en el 606): ${cxpMirror.error}`,
          { duration: 15000 }
        )
      }
      // Tipo Documento y Almacen se conservan: el operador registra varios
      // documentos seguidos del mismo tipo, y resetearlos hacia que el
      // siguiente Guardar cayera en "Seleccione el Tipo de Documento" sin
      // que se notara.
      setFecha(new Date().toISOString().slice(0, 10))
      setTasaUsd(''); setProveedorSel(null)
      setNcf(''); setRnc(''); setFormaPago(''); setFechaVcto(''); setPctDescuento('')
      setNota(''); setOrdenCargada(null); setNoOrdenOdc('')
      setRows([newRow()])
    } catch (err: any) {
      toast.error(`Error al guardar: ${err.message ?? 'Error desconocido'}`)
    } finally {
      setSaving(false)
    }
  }

  const tipoDocuKey = (t: TipoDocu) => t.tipo_docu ?? t.tipo_doc ?? ''
  const almacenKey = (a: Almacen) => a.almacen ?? a.codigo ?? ''
  const almacenDesc = (a: Almacen) => a.descripcion ?? a.desc_almacen ?? almacenKey(a)

  return (
    <TooltipProvider>
      <section className='space-y-6'>
        <div className='flex items-start justify-between gap-3'>
          <div>
            <h2 className='text-lg font-semibold'>Entrada de Compras</h2>
            <p className='text-sm text-muted-foreground'>FINV202 — Registro de entradas de mercancía por compras</p>
          </div>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() =>
              navigate({
                search: (prev) => ({ ...prev, section: 'consultas', view: 'consulta-documentos', tipo_docu: 'EC' }),
                replace: true,
              })
            }
          >
            <History className='mr-2 h-4 w-4' /> Ver entradas anteriores
          </Button>
        </div>

        {/* Cabecera */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Encabezado del Documento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'>
              <div className='space-y-1'>
                <Label htmlFor='ec-tipo-docu'>Tipo Documento</Label>
                <Select value={tipoDocu} onValueChange={setTipoDocu}>
                  <SelectTrigger id='ec-tipo-docu' className='h-9'>
                    <SelectValue placeholder='Seleccionar...' />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposDocu.map((t) => {
                      const k = tipoDocuKey(t)
                      return (
                        <SelectItem key={k} value={k}>
                          {k}{t.descripcion ? ` — ${t.descripcion}` : ''}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-1'>
                <Label htmlFor='ec-fecha'>Fecha</Label>
                <Input id='ec-fecha' type='date' className='h-9' value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>

              <div className='space-y-1'>
                <Label htmlFor='ec-tasa'>Tasa USD</Label>
                <Input id='ec-tasa' type='number' min={0} step='0.0001' className='h-9 text-right tabular-nums' placeholder='1.0000' value={tasaUsd} onChange={(e) => setTasaUsd(e.target.value)} />
              </div>

              <div className='space-y-1'>
                <Label htmlFor='ec-almacen'>Almacén</Label>
                <Select value={almacenHeader} onValueChange={(v) => {
                  setAlmacenHeader(v)
                  setRows((prev) => prev.map((r) => ({ ...r, almacen: v })))
                }}>
                  <SelectTrigger id='ec-almacen' className='h-9'>
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
          </CardContent>
        </Card>

        {/* Cargar desde Orden de Compra (paridad con SIGAF Finv) */}
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base flex items-center gap-2'>
              <FileDown className='h-4 w-4' /> Cargar desde Orden de Compra
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='flex flex-wrap items-end gap-2'>
              <div className='space-y-1'>
                <Label htmlFor='ec-no-orden' className='text-xs'>No. Orden</Label>
                <Input id='ec-no-orden' className='h-9 w-40 font-mono'
                  placeholder='Ej. 4170'
                  value={noOrdenOdc}
                  onChange={(e) => setNoOrdenOdc(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') cargarDesdeOrden() }}
                  disabled={!!ordenCargada || cargandoOdc} />
              </div>
              {!ordenCargada ? (
                <Button size='sm' onClick={cargarDesdeOrden} disabled={cargandoOdc || !noOrdenOdc.trim()}>
                  <FileDown className='h-4 w-4 mr-1' />
                  {cargandoOdc ? 'Cargando…' : 'Cargar líneas'}
                </Button>
              ) : (
                <>
                  <div className='flex items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm'>
                    <CheckCircle2 className='h-4 w-4 text-emerald-600' />
                    <span><b>ODC-{ordenCargada.no_orden}</b> {ordenCargada.nombre_proveedor}</span>
                    <Badge variant='outline' className='font-mono tabular-nums text-[10px]'>
                      RD$ {fmt(ordenCargada.total)}
                    </Badge>
                  </div>
                  <Button size='sm' variant='ghost' onClick={limpiarOrden}>Quitar</Button>
                </>
              )}
              <p className='basis-full text-xs text-muted-foreground'>
                Al cargar, se traen proveedor, condición y líneas (cantidad pendiente) de la orden.
                Sólo órdenes activas y no recibidas todavía.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Proveedor */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Datos del Proveedor</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <ProveedorPicker value={proveedorSel} onChange={setProveedorSel} />

            <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'>
              <div className='space-y-1'>
                <Label htmlFor='ec-rnc'>RNC / Cédula</Label>
                <Input id='ec-rnc' className='h-9 font-mono' placeholder='RNC del proveedor' value={rnc} onChange={(e) => setRnc(e.target.value)} />
                <p className='text-[11px] text-muted-foreground'>
                  Editable: en compras con TC el RNC del proveedor puede ser ficticio.
                </p>
              </div>

              <div className='space-y-1'>
                <Label htmlFor='ec-ncf'>NCF</Label>
                <Input id='ec-ncf' className='h-9 font-mono' placeholder='B0100000000' value={ncf} onChange={(e) => setNcf(e.target.value)} />
              </div>

              <div className='space-y-1'>
                <Label htmlFor='ec-forma-pago'>Forma de Pago</Label>
                <Select value={formaPago} onValueChange={setFormaPago}>
                  <SelectTrigger id='ec-forma-pago' className='h-9'>
                    <SelectValue placeholder='Seleccionar...' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='contado'>Contado</SelectItem>
                    <SelectItem value='credito'>Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-1'>
                <Label htmlFor='ec-fecha-vcto'>Fecha Vcto.</Label>
                <Input id='ec-fecha-vcto' type='date' className='h-9' value={fechaVcto} onChange={(e) => setFechaVcto(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grid de productos */}
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-base'>Detalle de Productos</CardTitle>
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
                    <TableHead className='w-[110px]'>UM</TableHead>
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
                            <button
                              type='button'
                              className='absolute right-1 top-1 h-6 w-6 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground'
                              title='Buscar producto'
                              onClick={() => openProductModal(idx)}
                            >
                              <Search className='h-3.5 w-3.5' />
                            </button>
                            {isSearching && (searching || searchResults.length > 0 || searchTerm.trim()) && (
                              <div className='absolute z-50 top-full left-0 mt-1 w-[280px] rounded-md border bg-popover shadow-md text-xs'>
                                {searching && <div className='px-3 py-2 text-muted-foreground'>Buscando...</div>}
                                {!searching && searchResults.map((p) => {
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
                                {!searching && searchResults.length === 0 && searchTerm.trim() && (
                                  <div
                                    className='px-3 py-2 cursor-pointer text-blue-600 hover:bg-accent hover:underline'
                                    onMouseDown={(e) => { e.preventDefault(); abrirCrearProducto(idx, searchTerm) }}
                                  >
                                    + Crear producto "{searchTerm}" →
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className='py-1 px-2'>
                          <Input className='h-8 text-xs' placeholder='Descripción del producto' value={row.nombre} readOnly tabIndex={-1} />
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
                          {row.empaques.length > 0 ? (
                            <Select value={row.empaque || 'UND'} onValueChange={(v) => cambiarEmpaque(idx, v)}>
                              <SelectTrigger className='h-8 text-xs'>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {row.empaques.map((e) => (
                                  <SelectItem key={`${e.empaque}-${e.unidad}`} value={e.descripcion || e.unidad} className='text-xs'>
                                    {empaqueLabel(e)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className='text-xs text-muted-foreground'>{row.empaque || '—'}</span>
                          )}
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
                    <TableCell colSpan={6} className='text-xs font-medium text-right pr-4'>Subtotal:</TableCell>
                    <TableCell className='text-right font-mono text-xs font-semibold tabular-nums'>{fmt(subtotal)}</TableCell>
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
            <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end'>
              <div className='space-y-1'>
                <Label>Subtotal</Label>
                <div className='h-9 flex items-center px-3 rounded-md border bg-muted font-mono text-sm tabular-nums'>{fmt(subtotal)}</div>
              </div>
              <div className='space-y-1'>
                <Label htmlFor='ec-pct-desc'>% Descuento</Label>
                <Input id='ec-pct-desc' type='number' min={0} max={100} step='0.01' className='h-9 text-right tabular-nums' placeholder='0.00' value={pctDescuento} onChange={(e) => setPctDescuento(e.target.value)} />
              </div>
              <div className='space-y-1'>
                <Label>Total Bruto</Label>
                <div className='h-9 flex items-center px-3 rounded-md border bg-muted font-mono text-sm tabular-nums'>{fmt(totalBruto)}</div>
              </div>
              <div className='space-y-1'>
                <Label htmlFor='ec-pct-itbis'>% ITBIS</Label>
                <Input id='ec-pct-itbis' type='number' min={0} max={100} step='0.01' className='h-9 text-right tabular-nums' placeholder='18.00' value={pctItbis} onChange={(e) => setPctItbis(e.target.value)} />
              </div>
              <div className='space-y-1'>
                <Label>Total ITBIS</Label>
                <div className='h-9 flex items-center px-3 rounded-md border bg-muted font-mono text-sm tabular-nums'>{fmt(totalItbis)}</div>
              </div>
            </div>
            <div className='mt-4 flex justify-end'>
              <div className='space-y-1 text-right'>
                <Label className='text-muted-foreground text-xs'>Total Neto</Label>
                <div className='text-2xl font-bold tabular-nums font-mono'>{fmt(totalNeto)}</div>
              </div>
            </div>
            <div className='mt-4 space-y-1'>
              <Label htmlFor='ec-nota'>Comentario</Label>
              <Textarea
                id='ec-nota'
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder='Información pertinente sobre la factura'
                rows={2}
                className='resize-none'
              />
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
                <p>Endpoint en construccion - POST /api/inv/movimientos/</p>
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </section>

      <BuscarProductoModal
        open={productModalOpen}
        onClose={() => { setProductModalOpen(false); setProductModalForIdx(null) }}
        noCia={noCia}
        punto={punto}
        almacenes={almacenes as any}
        listas={[]}
        noLista={''}
        defaultAlmacen={almacenHeader}
        defaultSoloExistencia={false}
        onSelect={(p, qty, alm) => {
          if (productModalForIdx == null) return
          const idx = productModalForIdx
          const baseQty = qty && qty > 0 ? qty : 1
          updateRow(idx, {
            noProdu: p.no_produ,
            nombre: p.descri,
            almacen: alm || almacenHeader,
            cantidad: String(baseQty),
          })
          fetch(`${API_BASE}/inv/existencia/${encodeURIComponent(p.no_produ)}/?no_cia=${encodeURIComponent(noCia)}&punto=${encodeURIComponent(punto)}`, { credentials: 'include' })
            .then(r => r.json())
            .then(j => {
              const r = (j.results || []).find((x: any) => x.almacen === (alm || almacenHeader)) || (j.results || [])[0]
              const costoBase = Number(r?.costo_actual || 0)
              cargarEmpaques(idx, p.no_produ, costoBase)
            })
            .catch(() => cargarEmpaques(idx, p.no_produ, 0))
          setProductModalOpen(false); setProductModalForIdx(null)
        }}
      />

      <CrearProductoModal
        open={crearProductoOpen}
        onClose={() => { setCrearProductoOpen(false); setCrearProductoIdx(null) }}
        noCia={noCia}
        descripcionInicial={crearProductoTerm}
        onCreated={(p) => {
          if (crearProductoIdx == null) return
          const idx = crearProductoIdx
          updateRow(idx, { noProdu: p.no_produ, nombre: p.descri, costo: String(p.costo) })
          cargarEmpaques(idx, p.no_produ, p.costo)
          setCrearProductoOpen(false)
          setCrearProductoIdx(null)
        }}
      />
    </TooltipProvider>
  )
}
