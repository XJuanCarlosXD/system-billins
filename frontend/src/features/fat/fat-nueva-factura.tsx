import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { useToast } from '@/hooks/use-toast'
import { BuscarProductoModal } from './components/buscar-producto-modal'

interface Props {
  noCia: string
  punto: string
}

interface TipoDoc {
  tipo_docu: string
  descripcion: string
  tipo_transaccion: string
  codigo_ncf: string | null
  almacen: string
  activo: boolean
}

interface Vendedor { vendedor: string; nombre: string }
interface TipoPago { tipo_pago: string; descripcion: string }
interface CondicionPago { no_condicion_pago: string; descripcion: string; plazo_pago: number }

interface NcfInfo {
  codigo_ncf: string
  tipo_ncf_fiscal: string
  prox_ncf: number
  ncf_final: number
  ncf_inicial: number
  disponibles: number
  low_stock: boolean
  critical: boolean
}

interface ProximoNcf {
  codigo_ncf: string
  prox_ncf: number
  posiciones_fijas: string
  descripcion: string
  ncf_dgi_proximo: string
  agotado: boolean
}

interface Lista { no_lista: number | string; descripcion?: string; nombre?: string }
interface Almacen { almacen: string; descripcion?: string }

interface Cliente {
  no_cliente: string | number
  nombre: string
  rnc?: string
  cedula?: string
  direccion?: string
  vendedor?: string
  plazo?: number
}

interface Producto {
  no_produ: string
  descri: string
  precio: number
  porciento_impuesto: number
  unidad_empaque: string
  existencia: number
}

interface EmpaqueOpcion {
  unidad: string
  descripcion: string
  por_defecto: boolean
  cant_por_emp: number
}

interface Linea {
  id: number
  almacen: string
  no_produ: string
  emp: string
  descripcion: string
  cantidad: number
  precio: number
  porc_descuento: number
  monto: number
  porciento_impuesto: number
  itbis: boolean
  // Empaques alternos del producto. >1 => UM editable como Select.
  empaques: EmpaqueOpcion[]
  precioBase: number      // precio para la unidad por defecto (ratio cant_por_emp=1)
  cantPorEmpBase: number  // cant_por_emp de la unidad por defecto (normalmente 1)
}

const fmtN = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const formatNcf = (info: NcfInfo) =>
  `${info.codigo_ncf}-${String(info.prox_ncf).padStart(8, '0')}`

const esContadoLabel = (desc: string) =>
  /contado|cash|efectivo/i.test(desc)

let lineaIdCounter = 1

export function NuevaFactura({ noCia, punto }: Props) {
  const navigate = useNavigate()
  const { toast } = useToast()

  // Catalog
  const [tiposDoc, setTiposDoc] = useState<TipoDoc[]>([])
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [tiposPago, setTiposPago] = useState<TipoPago[]>([])
  const [condicionesPago, setCondicionesPago] = useState<CondicionPago[]>([])
  const [ncfRanges, setNcfRanges] = useState<NcfInfo[]>([])
  const [listas, setListas] = useState<Lista[]>([])
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])

  // Document
  const [noCotizacion, setNoCotizacion] = useState('')
  const [tipoDoc, setTipoDoc] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [formaPago, setFormaPago] = useState('')
  const [tipoMoneda, setTipoMoneda] = useState('RD')
  const [tasa, setTasa] = useState<number>(57.5)
  const [ncfInfo, setNcfInfo] = useState<NcfInfo | null>(null)

  // NCF derivado del cliente
  const [codigoNcfDeCliente, setCodigoNcfDeCliente] = useState<string>('')
  const [proximoNcf, setProximoNcf] = useState<ProximoNcf | null>(null)

  // Client
  const [noClienteInput, setNoClienteInput] = useState('')
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null)
  const [noCliente, setNoCliente] = useState('')
  const [direccion, setDireccion] = useState('')
  const [rnc, setRnc] = useState('')
  const [cargandoCliente, setCargandoCliente] = useState(false)

  // Client search modal
  const [clienteModalOpen, setClienteModalOpen] = useState(false)
  const [clienteSearch, setClienteSearch] = useState('')
  const [clienteResults, setClienteResults] = useState<Cliente[]>([])
  const [buscandoClientes, setBuscandoClientes] = useState(false)

  // Commercial
  const [vendedor, setVendedor] = useState('')
  const [noLista, setNoLista] = useState<string>('1')
  const [condicionPago, setCondicionPago] = useState('')
  const [plazoPago, setPlazoPago] = useState<number>(0)
  const [descProntoPago, setDescProntoPago] = useState<number>(0)
  const [nota, setNota] = useState('')
  const [detalle, setDetalle] = useState('')
  const [tipoIngreso, setTipoIngreso] = useState('')
  const [itbisEnPrecio, setItbisEnPrecio] = useState(false)

  // Lines
  const [lineas, setLineas] = useState<Linea[]>([])
  const [defaultAlmacen, setDefaultAlmacen] = useState('')

  // Product modal
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<Producto[]>([])
  const [currentLineaIdx, setCurrentLineaIdx] = useState<number | null>(null)
  const [modalCantidades, setModalCantidades] = useState<Record<string, number>>({})
  const [modalAlmacen, setModalAlmacen] = useState('')
  const [modalLista, setModalLista] = useState('')
  const [soloExistencia, setSoloExistencia] = useState(true)

  const [guardando, setGuardando] = useState(false)

  const clienteSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const productSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noClienteInputRef = useRef<HTMLInputElement>(null)
  const clienteModalInputRef = useRef<HTMLInputElement>(null)

  // Is contado?
  const pagoSeleccionado = tiposPago.find(p => p.tipo_pago === formaPago)
  const esContado = pagoSeleccionado ? esContadoLabel(pagoSeleccionado.descripcion) : false

  // Keep modal lista in sync
  useEffect(() => { setModalLista(noLista) }, [noLista])

  useEffect(() => {
    async function cargarDatos() {
      try {
        const [docsRes, vendsRes, pagosRes, condsRes, ncfRes, listasRes, almRes] = await Promise.all([
          regalGeneralApi.fatListDocumentTypes(noCia, punto),
          regalGeneralApi.fatListVendedores(noCia),
          regalGeneralApi.fatListTiposPago(noCia, punto),
          regalGeneralApi.fatListCondicionesPago(),
          regalGeneralApi.fatNcf(noCia, punto),
          regalGeneralApi.fatListasPrecio(noCia, punto),
          regalGeneralApi.invAlmacenes(noCia, punto),
        ])
        const filtrados = (docsRes.items || []).filter(
          (d: TipoDoc) =>
            (d.tipo_transaccion === 'F' || d.tipo_transaccion === 'O') &&
            !/anular/i.test(d.descripcion)
        )
        setTiposDoc(filtrados)
        setVendedores(vendsRes.items || [])

        const pagos: TipoPago[] = pagosRes.items || []
        setTiposPago(pagos)
        // Auto-select first forma de pago
        if (pagos.length > 0) setFormaPago(pagos[0].tipo_pago)

        const conds: CondicionPago[] = condsRes.items || []
        setCondicionesPago(conds)
        // Auto-select first condicion
        if (conds.length > 0) {
          setCondicionPago(conds[0].no_condicion_pago)
          setPlazoPago(conds[0].plazo_pago)
        }

        setNcfRanges(ncfRes.items || [])

        const listasArr: Lista[] = listasRes.tipos ?? listasRes.items ?? (Array.isArray(listasRes) ? listasRes : [])
        setListas(listasArr)
        if (listasArr.length > 0) {
          const first = String(listasArr[0].no_lista)
          setNoLista(first)
          setModalLista(first)
        }

        // Almacenes reales del catálogo INV (no derivados del tipo de doc)
        const almArr: Almacen[] = (almRes?.results ?? [])
          .filter((a: any) => (a.activo ?? 'S') !== 'N')
          .map((a: any) => ({
            almacen: String(a.almacen ?? '').trim(),
            descripcion: (a.descripcion ?? '').trim(),
          }))
          .filter((a: Almacen) => a.almacen)
        setAlmacenes(almArr)
        if (almArr.length > 0) {
          setDefaultAlmacen(almArr[0].almacen)
          setModalAlmacen(almArr[0].almacen)
        }
      } catch {
        toast({ title: 'Error', description: 'Error cargando datos iniciales', variant: 'destructive' })
      }
    }
    cargarDatos()
  }, [noCia, punto])

  const handleTipoDocChange = (value: string) => {
    setTipoDoc(value)
    const td = tiposDoc.find(d => d.tipo_docu === value)
    if (td) {
      const ncf = ncfRanges.find(n => n.codigo_ncf === td.codigo_ncf)
      setNcfInfo(ncf || null)
      if (td.almacen) setDefaultAlmacen(td.almacen)
    } else {
      setNcfInfo(null)
    }
  }

  const handleFormaPagoChange = (value: string) => {
    setFormaPago(value)
    const tp = tiposPago.find(p => p.tipo_pago === value)
    if (tp && esContadoLabel(tp.descripcion)) {
      // Contado: reset credit fields
      setCondicionPago('')
      setPlazoPago(0)
      setDescProntoPago(0)
    } else {
      // Credito: auto-select first condicion if none selected
      if (!condicionPago && condicionesPago.length > 0) {
        setCondicionPago(condicionesPago[0].no_condicion_pago)
        setPlazoPago(condicionesPago[0].plazo_pago)
      }
    }
  }

  const handleCondicionChange = (value: string) => {
    setCondicionPago(value)
    const cond = condicionesPago.find(c => c.no_condicion_pago === value)
    if (cond) setPlazoPago(cond.plazo_pago)
  }

  // ── Client by code (blur) ──────────────────────────────────
  const cargarClientePorCodigo = async (codigo: string) => {
    const cod = codigo.trim()
    if (!cod) return
    setCargandoCliente(true)
    try {
      const res = await regalGeneralApi.fatListClientes(noCia, cod, 1, 5)
      const items: Cliente[] = res.items || []
      // Try exact match first
      const exact = items.find(c => String(c.no_cliente).trim() === cod)
      const match = exact ?? (items.length === 1 ? items[0] : null)
      if (match) {
        aplicarCliente(match)
      } else if (items.length > 1) {
        // Multiple matches — open modal with these results
        setClienteResults(items)
        setClienteSearch(cod)
        setClienteModalOpen(true)
      } else {
        toast({ title: 'Cliente no encontrado', description: `Codigo: ${cod}`, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar el cliente', variant: 'destructive' })
    } finally {
      setCargandoCliente(false)
    }
  }

  const aplicarCliente = (c: Cliente) => {
    setClienteSeleccionado(c)
    setNoCliente(String(c.no_cliente))
    setNoClienteInput(String(c.no_cliente))
    setDireccion(c.direccion || '')
    setRnc(c.rnc || c.cedula || '')
    if (c.vendedor) setVendedor(c.vendedor)
    if (c.plazo) setPlazoPago(c.plazo)
    setClienteModalOpen(false)
    setClienteResults([])
    setClienteSearch('')
  }

  const limpiarCliente = () => {
    setClienteSeleccionado(null)
    setNoCliente('')
    setNoClienteInput('')
    setDireccion('')
    setRnc('')
    setCodigoNcfDeCliente('')
    setProximoNcf(null)
    setTimeout(() => noClienteInputRef.current?.focus(), 50)
  }

  // ── Client search modal ────────────────────────────────────
  const buscarClientesModal = useCallback(
    (q: string) => {
      if (clienteSearchRef.current) clearTimeout(clienteSearchRef.current)
      if (!q || q.length < 2) { setClienteResults([]); return }
      setBuscandoClientes(true)
      clienteSearchRef.current = setTimeout(async () => {
        try {
          const res = await regalGeneralApi.fatListClientes(noCia, q, 1, 50)
          setClienteResults(res.items || [])
        } catch {
          setClienteResults([])
        } finally {
          setBuscandoClientes(false)
        }
      }, 300)
    },
    [noCia]
  )

  const abrirClienteModal = () => {
    setClienteSearch('')
    setClienteResults([])
    setClienteModalOpen(true)
    setTimeout(() => clienteModalInputRef.current?.focus(), 80)
  }

  // ── Derivar tipo NCF del cliente y cargar próximo NCF ─────────
  useEffect(() => {
    let cancelled = false
    if (!clienteSeleccionado) {
      setCodigoNcfDeCliente('')
      setProximoNcf(null)
      return
    }
    // El campo codigo_ncf viene en el objeto cliente (fatListClientes lo incluye)
    const codigoNcf = (clienteSeleccionado as any).codigo_ncf as string | undefined
    if (!codigoNcf) {
      setCodigoNcfDeCliente('')
      setProximoNcf(null)
      return
    }
    setCodigoNcfDeCliente(codigoNcf)
    regalGeneralApi.fatProximoNcf(noCia, codigoNcf)
      .then(data => { if (!cancelled) setProximoNcf(data) })
      .catch(() => { if (!cancelled) setProximoNcf(null) })
    return () => { cancelled = true }
  }, [clienteSeleccionado, noCia])

  // ── Lines ──────────────────────────────────────────────────
  const agregarLinea = () => {
    const newIdx = lineas.length
    setLineas(prev => [...prev, {
      id: lineaIdCounter++,
      almacen: defaultAlmacen,
      no_produ: '',
      emp: '',
      descripcion: '',
      cantidad: 1,
      precio: 0,
      porc_descuento: 0,
      monto: 0,
      porciento_impuesto: 0,
      itbis: false,
      empaques: [],
      precioBase: 0,
      cantPorEmpBase: 1,
    }])
    // Auto-open product search modal for the new line
    setCurrentLineaIdx(newIdx)
    setProductSearch('')
    setProductResults([])
    setModalCantidades({})
    setModalAlmacen(defaultAlmacen)
    setModalLista(noLista)
    setProductDialogOpen(true)
  }

  const updateLinea = (idx: number, field: keyof Linea, value: string | number | boolean) => {
    setLineas(prev => {
      const arr = [...prev]
      const linea = { ...arr[idx], [field]: value }
      if (['cantidad', 'precio', 'porc_descuento'].includes(field as string)) {
        linea.monto = linea.cantidad * linea.precio * (1 - linea.porc_descuento / 100)
      }
      arr[idx] = linea
      return arr
    })
  }

  const eliminarLinea = (idx: number) => setLineas(prev => prev.filter((_, i) => i !== idx))

  // Carga empaques alternos y los aplica a la línea — define la UM por defecto
  // y la base de precio para poder recalcular cuando se cambie de empaque.
  const aplicarEmpaquesALinea = async (idx: number, noProdu: string, precioDefault: number) => {
    try {
      const res = await regalGeneralApi.fatProductoEmpaques(noProdu)
      const emps = res.items || []
      const porDefecto = emps.find(e => e.por_defecto) || emps[0]
      const cantBase = porDefecto?.cant_por_emp && porDefecto.cant_por_emp > 0 ? porDefecto.cant_por_emp : 1
      setLineas(prev => {
        const arr = [...prev]
        if (!arr[idx] || arr[idx].no_produ !== noProdu) return prev
        const l = { ...arr[idx] }
        l.empaques = emps
        l.precioBase = precioDefault / cantBase
        l.cantPorEmpBase = cantBase
        if (porDefecto && (!l.emp || l.emp === '—')) l.emp = porDefecto.descripcion || porDefecto.unidad
        arr[idx] = l
        return arr
      })
    } catch { /* sin empaques => UM queda como estática */ }
  }

  // Cambiar UM en la línea: recalcula precio = precioBase * cant_por_emp del empaque elegido
  const cambiarEmpaqueLinea = (idx: number, unidad: string) => {
    setLineas(prev => {
      const arr = [...prev]
      const l = { ...arr[idx] }
      const emp = l.empaques.find(e => e.unidad === unidad)
      if (!emp) return prev
      l.emp = emp.descripcion || emp.unidad
      const cant = emp.cant_por_emp && emp.cant_por_emp > 0 ? emp.cant_por_emp : 1
      l.precio = l.precioBase * cant
      l.monto = l.cantidad * l.precio * (1 - l.porc_descuento / 100)
      arr[idx] = l
      return arr
    })
  }

  const buscarProductoPorCodigo = async (idx: number, codigo: string) => {
    if (!codigo) return
    try {
      const res = await regalGeneralApi.fatSearchProductos(noCia, punto, noLista, codigo, 1, 1)
      if (res.items && res.items.length > 0) {
        const p = res.items[0]
        setLineas(prev => {
          const arr = [...prev]
          const l = { ...arr[idx] }
          l.no_produ = p.no_produ
          l.descripcion = p.descri
          l.precio = p.precio
          l.porciento_impuesto = p.porciento_impuesto
          l.itbis = p.porciento_impuesto > 0
          l.emp = p.unidad_empaque
          l.monto = l.cantidad * l.precio * (1 - l.porc_descuento / 100)
          l.empaques = []
          l.precioBase = p.precio
          l.cantPorEmpBase = 1
          arr[idx] = l
          return arr
        })
        aplicarEmpaquesALinea(idx, p.no_produ, p.precio)
      }
    } catch {
      toast({ title: 'Producto no encontrado', description: codigo, variant: 'destructive' })
    }
  }

  const abrirBusquedaProducto = (idx: number) => {
    setCurrentLineaIdx(idx)
    setProductSearch('')
    setProductResults([])
    setModalCantidades({})
    setModalAlmacen(lineas[idx]?.almacen || defaultAlmacen)
    setModalLista(noLista)
    setProductDialogOpen(true)
  }

  const buscarProductos = useCallback(
    (search: string, lista: string, almacen?: string, conExistencia?: boolean) => {
      if (productSearchRef.current) clearTimeout(productSearchRef.current)
      if (!search) { setProductResults([]); return }
      productSearchRef.current = setTimeout(async () => {
        try {
          const res = await regalGeneralApi.fatSearchProductos(
            noCia, punto, lista || noLista, search, 1, 100,
            almacen && almacen !== '__all__' ? almacen : undefined,
            conExistencia
          )
          setProductResults(res.items || [])
        } catch { setProductResults([]) }
      }, 300)
    },
    [noCia, punto, noLista]
  )

  const seleccionarProducto = (p: Producto, cantidad?: number) => {
    if (currentLineaIdx === null) return
    const idx = currentLineaIdx
    const qty = cantidad && cantidad > 0 ? cantidad : 1
    setLineas(prev => {
      const arr = [...prev]
      const l = { ...arr[idx] }
      l.no_produ = p.no_produ
      l.descripcion = p.descri
      l.precio = p.precio
      l.porciento_impuesto = p.porciento_impuesto
      l.itbis = p.porciento_impuesto > 0
      l.emp = p.unidad_empaque
      l.cantidad = qty
      l.monto = qty * l.precio * (1 - l.porc_descuento / 100)
      if (modalAlmacen && modalAlmacen !== '__all__') l.almacen = modalAlmacen
      l.empaques = []
      l.precioBase = p.precio
      l.cantPorEmpBase = 1
      arr[idx] = l
      return arr
    })
    setProductDialogOpen(false)
    setCurrentLineaIdx(null)
    aplicarEmpaquesALinea(idx, p.no_produ, p.precio)
  }

  // ── Totals ─────────────────────────────────────────────────
  const subtotalBruto = lineas.reduce((s, l) => s + l.cantidad * l.precio, 0)
  const descuentoTotal = lineas.reduce((s, l) => s + l.cantidad * l.precio * (l.porc_descuento / 100), 0)
  const baseNeta = lineas.reduce((s, l) => s + l.monto, 0)
  const itbisTotal = lineas.filter(l => l.itbis).reduce((s, l) => s + l.monto * (l.porciento_impuesto / 100), 0)
  const totalNeto = baseNeta + itbisTotal

  // ── Save ───────────────────────────────────────────────────
  const guardar = async () => {
    if (!tipoDoc) { toast({ title: 'Validacion', description: 'Seleccione el Tipo de Documento', variant: 'destructive' }); return }
    if (!noCliente) { toast({ title: 'Validacion', description: 'Seleccione un cliente', variant: 'destructive' }); return }
    if (ncfInfo && ncfInfo.disponibles === 0) { toast({ title: 'Error NCF', description: 'NCF agotado', variant: 'destructive' }); return }
    if (proximoNcf && proximoNcf.agotado) { toast({ title: 'Error NCF', description: `Serie ${proximoNcf.codigo_ncf} agotada — no hay NCF disponibles`, variant: 'destructive' }); return }
    if (proximoNcf && !proximoNcf.agotado) {
      try {
        const { usado } = await regalGeneralApi.fatNcfUsado(noCia, proximoNcf.prox_ncf)
        if (usado) {
          toast({ title: 'NCF duplicado', description: 'El próximo NCF ya está usado. Refrescá el formulario.', variant: 'destructive' })
          return
        }
      } catch (err) {
        console.warn('[fatNcfUsado] check failed, proceeding:', err)
        // If the check fails we let the backend enforce uniqueness; don't block submit.
      }
    }
    const lineasValidas = lineas.filter(l => l.no_produ && l.cantidad > 0)
    if (lineasValidas.length === 0) { toast({ title: 'Validacion', description: 'Agregue al menos una linea', variant: 'destructive' }); return }
    setGuardando(true)
    try {
      const res = await regalGeneralApi.fatCrearFactura({
        no_cia: noCia, punto, tipo_factura: tipoDoc, no_cliente: noCliente,
        fecha, vendedor, forma_pago: formaPago, no_lista: noLista,
        nota, detalle, tipo_moneda: tipoMoneda, tasa_us: tasa,
        plazo_pago: plazoPago, porc_pronto_pago: descProntoPago,
        no_condicion_pago: condicionPago, tipo_ingreso: tipoIngreso,
        itbis_en_precio: itbisEnPrecio, no_cotizacion: noCotizacion,
        lineas: lineasValidas.map(l => ({
          no_produ: l.no_produ, almacen: l.almacen, descripcion: l.descripcion,
          cantidad: l.cantidad, precio: l.precio, porc_descuento: l.porc_descuento,
          porciento_impuesto: l.porciento_impuesto,
        })),
      })
      toast({ title: 'Factura creada', description: `No. ${res.no_factura}  |  NCF: ${res.ncf || '—'}` })
      navigate({ to: '/fat/facturas' as never })
    } catch {
      toast({ title: 'Error al guardar', description: 'Verifique los datos e intente de nuevo', variant: 'destructive' })
    } finally {
      setGuardando(false)
    }
  }

  const listaLabel = (l: Lista) => `${l.no_lista}${l.descripcion ? ' — ' + l.descripcion : l.nombre ? ' — ' + l.nombre : ''}`
  const almacenLabel = (a: Almacen) => `${a.almacen}${a.descripcion ? ' — ' + a.descripcion : ''}`

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4">

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Nueva Factura</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate({ to: '/fat/facturas' as never })}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando} className="min-w-32">
            {guardando ? 'Guardando...' : 'Guardar Factura'}
          </Button>
        </div>
      </div>

      {/* ── Section 1: Document ── */}
      <div className="border rounded-lg p-4 space-y-4 bg-white">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Datos del Documento</p>

        <div className="grid grid-cols-6 gap-3">
          <div className="space-y-1">
            <Label>Cotizacion/Pedido</Label>
            <Input value={noCotizacion} onChange={e => setNoCotizacion(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="space-y-1 col-span-2">
            <Label>Tipo Documento <span className="text-red-500">*</span></Label>
            <Select value={tipoDoc} onValueChange={handleTipoDocChange}>
              <SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger>
              <SelectContent>
                {tiposDoc.map(d => (
                  <SelectItem key={d.tipo_docu} value={d.tipo_docu}>
                    {d.tipo_docu} — {d.descripcion}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Fecha</Label>
            <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Forma de Pago</Label>
            <Select value={formaPago} onValueChange={handleFormaPagoChange}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {tiposPago.map(p => (
                  <SelectItem key={p.tipo_pago} value={p.tipo_pago}>{p.descripcion}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Moneda</Label>
            <Select value={tipoMoneda} onValueChange={setTipoMoneda}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="RD">RD — Peso</SelectItem>
                <SelectItem value="US">US — Dolar</SelectItem>
                <SelectItem value="EUR">EUR — Euro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* NCF info card */}
        {ncfInfo && (
          <div className={`rounded-md border p-3 flex flex-wrap items-center gap-6 text-sm ${ncfInfo.critical ? 'bg-red-50 border-red-300' : ncfInfo.low_stock ? 'bg-yellow-50 border-yellow-300' : 'bg-blue-50 border-blue-200'}`}>
            <div>
              <span className="block text-xs text-gray-500 uppercase font-medium mb-0.5">NCF Proximo</span>
              <span className="font-mono font-bold text-xl tracking-widest">{formatNcf(ncfInfo)}</span>
            </div>
            <div>
              <span className="block text-xs text-gray-500 uppercase font-medium mb-0.5">Serie</span>
              <span className="font-mono font-semibold">{ncfInfo.codigo_ncf}</span>
            </div>
            <div>
              <span className="block text-xs text-gray-500 uppercase font-medium mb-0.5">Tipo Fiscal</span>
              <span>{ncfInfo.tipo_ncf_fiscal}</span>
            </div>
            <div>
              <span className="block text-xs text-gray-500 uppercase font-medium mb-0.5">Disponibles</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-base">{ncfInfo.disponibles.toLocaleString()}</span>
                {ncfInfo.critical && <Badge variant="destructive" className="text-xs">CRITICO</Badge>}
                {!ncfInfo.critical && ncfInfo.low_stock && <Badge className="text-xs bg-yellow-500 hover:bg-yellow-500 text-white">Stock Bajo</Badge>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 2: Client ── */}
      <div className="border rounded-lg p-4 space-y-3 bg-white">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Cliente <span className="text-red-500 font-normal normal-case">* requerido</span>
        </p>

        <div className="flex items-end gap-2">
          {/* Code input */}
          <div className="space-y-1 w-36">
            <Label>Codigo</Label>
            <Input
              ref={noClienteInputRef}
              value={noClienteInput}
              onChange={e => { setNoClienteInput(e.target.value); if (clienteSeleccionado) limpiarCliente() }}
              onBlur={e => cargarClientePorCodigo(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') cargarClientePorCodigo(noClienteInput) }}
              placeholder="Cod. cliente"
              disabled={cargandoCliente}
            />
          </div>

          {/* Search button */}
          <Button
            variant="outline"
            onClick={abrirClienteModal}
            className="h-10 px-3"
            title="Buscar cliente"
            type="button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </Button>

          {/* Client info display */}
          {clienteSeleccionado ? (
            <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 flex items-center gap-6">
              <div className="min-w-0">
                <span className="block text-xs text-emerald-600 font-medium">Nombre</span>
                <span className="font-semibold text-emerald-900 truncate block">{clienteSeleccionado.nombre}</span>
              </div>
              {rnc && (
                <div className="shrink-0">
                  <span className="block text-xs text-emerald-600 font-medium">RNC / Cedula</span>
                  <span className="font-mono text-emerald-800 text-sm">{rnc}</span>
                </div>
              )}
              {direccion && (
                <div className="min-w-0 flex-1">
                  <span className="block text-xs text-emerald-600 font-medium">Direccion</span>
                  <span className="text-emerald-700 text-sm truncate block">{direccion}</span>
                </div>
              )}
              <Button size="sm" variant="ghost" onClick={limpiarCliente} className="shrink-0 text-gray-400 hover:text-red-500">
                Cambiar
              </Button>
            </div>
          ) : (
            <div className="flex-1 flex items-center px-3 py-2 rounded-lg border border-dashed border-gray-300 text-sm text-gray-400">
              {cargandoCliente ? 'Cargando cliente...' : 'Ingrese el codigo o use la lupa para buscar'}
            </div>
          )}
        </div>
      </div>

      {/* ── NCF derivado del cliente ── */}
      {codigoNcfDeCliente && (
        <div className="border rounded-lg p-4 bg-white space-y-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">NCF del Cliente</p>
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div>
              <span className="block text-xs text-gray-500 uppercase font-medium mb-0.5">Tipo NCF</span>
              <span className="font-mono font-semibold">{codigoNcfDeCliente}</span>
            </div>
            {proximoNcf && (
              <>
                <div>
                  <span className="block text-xs text-gray-500 uppercase font-medium mb-0.5">Descripcion</span>
                  <span>{proximoNcf.descripcion || codigoNcfDeCliente}</span>
                </div>
                <div>
                  <span className="block text-xs text-gray-500 uppercase font-medium mb-0.5">Proximo NCF disponible</span>
                  <span className={`font-mono font-bold text-lg tracking-widest ${proximoNcf.agotado ? 'text-red-600' : 'text-emerald-700'}`}>
                    {proximoNcf.agotado ? 'AGOTADO' : proximoNcf.ncf_dgi_proximo}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Section 3: Commercial ── */}
      <div className="border rounded-lg p-4 space-y-3 bg-white">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Configuracion Comercial</p>

        <div className="grid grid-cols-6 gap-3">
          <div className="space-y-1">
            <Label>Vendedor</Label>
            <Select value={vendedor} onValueChange={setVendedor}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {vendedores.map(v => (
                  <SelectItem key={v.vendedor} value={v.vendedor}>{v.vendedor} — {v.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Lista de Precio</Label>
            <Select value={noLista} onValueChange={setNoLista}>
              <SelectTrigger><SelectValue placeholder="Lista..." /></SelectTrigger>
              <SelectContent>
                {listas.length > 0
                  ? listas.map(l => <SelectItem key={l.no_lista} value={String(l.no_lista)}>{listaLabel(l)}</SelectItem>)
                  : <SelectItem value={noLista}>Lista {noLista}</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {/* Credit-only fields */}
          {!esContado && (
            <>
              <div className="space-y-1 col-span-2">
                <Label>Condicion de Pago</Label>
                <Select value={condicionPago} onValueChange={handleCondicionChange}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {condicionesPago.map(c => (
                      <SelectItem key={c.no_condicion_pago} value={c.no_condicion_pago}>{c.descripcion}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Plazo (dias)</Label>
                <Input type="number" value={plazoPago} onChange={e => setPlazoPago(parseInt(e.target.value) || 0)} min={0} />
              </div>
              <div className="space-y-1">
                <Label>Desc. Pronto Pago (%)</Label>
                <Input type="number" value={descProntoPago} onChange={e => setDescProntoPago(parseFloat(e.target.value) || 0)} min={0} max={100} step="0.01" />
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-6 gap-3">
          <div className="space-y-1">
            <Label>Tasa Cambio US</Label>
            <Input type="number" value={tasa} onChange={e => setTasa(parseFloat(e.target.value) || 0)} step="0.01" />
          </div>
          <div className="space-y-1">
            <Label>Tipo Ingreso</Label>
            <Input value={tipoIngreso} onChange={e => setTipoIngreso(e.target.value)} maxLength={5} placeholder="Opcional" />
          </div>
          <div className="space-y-1 col-span-2">
            <Label>Nota</Label>
            <Input value={nota} onChange={e => setNota(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="space-y-1 col-span-2">
            <Label>Detalle</Label>
            <Input value={detalle} onChange={e => setDetalle(e.target.value)} placeholder="Opcional" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="itbis-en-precio" checked={itbisEnPrecio} onCheckedChange={v => setItbisEnPrecio(v === true)} />
          <Label htmlFor="itbis-en-precio" className="cursor-pointer font-normal">ITBIS incluido en el precio de venta</Label>
        </div>
      </div>

      {/* ── Section 4: Lines ── */}
      <div className="border rounded-lg p-4 space-y-3 bg-white">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Lineas de Detalle</p>
          <Button size="sm" onClick={agregarLinea} disabled={!tipoDoc}>+ Agregar Linea</Button>
        </div>

        {!tipoDoc && (
          <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Seleccione el Tipo de Documento antes de agregar lineas.
          </p>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-36">Almacen</TableHead>
                <TableHead className="w-44">No. Producto</TableHead>
                <TableHead className="w-16 text-center">UM</TableHead>
                <TableHead className="min-w-52">Descripcion</TableHead>
                <TableHead className="w-40 text-center">Cantidad</TableHead>
                <TableHead className="w-28 text-right">Precio</TableHead>
                <TableHead className="w-16 text-right">%Desc</TableHead>
                <TableHead className="w-28 text-right">Monto</TableHead>
                <TableHead className="w-16 text-center">ITBIS</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-gray-400 py-10">
                    No hay lineas. Haga clic en "+ Agregar Linea".
                  </TableCell>
                </TableRow>
              )}
              {lineas.map((linea, idx) => (
                <TableRow key={linea.id} className="hover:bg-gray-50">
                  <TableCell className="p-1">
                    {almacenes.length > 0 ? (
                      <Select value={linea.almacen || '__none__'} onValueChange={v => updateLinea(idx, 'almacen', v === '__none__' ? '' : v)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Alm." /></SelectTrigger>
                        <SelectContent>
                          {almacenes.map(a => <SelectItem key={a.almacen} value={a.almacen}>{almacenLabel(a)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={linea.almacen} onChange={e => updateLinea(idx, 'almacen', e.target.value)} maxLength={6} className="h-7 text-sm" placeholder="Alm." />
                    )}
                  </TableCell>
                  <TableCell className="p-1">
                    <div className="flex gap-1 items-center">
                      <Input
                        value={linea.no_produ}
                        onChange={e => updateLinea(idx, 'no_produ', e.target.value)}
                        onBlur={e => buscarProductoPorCodigo(idx, e.target.value)}
                        className="h-7 text-xs w-20 font-mono"
                        placeholder="Codigo"
                      />
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs shrink-0" onClick={() => abrirBusquedaProducto(idx)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="p-1 text-center">
                    {linea.empaques.length > 1 ? (
                      <Select
                        value={(linea.empaques.find(e => (e.descripcion || e.unidad) === linea.emp)?.unidad) || linea.empaques[0].unidad}
                        onValueChange={v => cambiarEmpaqueLinea(idx, v)}
                      >
                        <SelectTrigger className="h-7 text-xs px-2 w-auto min-w-[3.5rem] gap-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {linea.empaques.map(e => (
                            <SelectItem key={e.unidad} value={e.unidad}>
                              {(e.descripcion || e.unidad)}{e.cant_por_emp && e.cant_por_emp !== 1 ? ` × ${e.cant_por_emp}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5">{linea.emp || '—'}</span>
                    )}
                  </TableCell>
                  <TableCell className="p-1">
                    <Input value={linea.descripcion} onChange={e => updateLinea(idx, 'descripcion', e.target.value)} className="h-7 text-sm" placeholder="Descripcion" />
                  </TableCell>
                  <TableCell className="p-1">
                    <div className="flex items-center gap-0.5 justify-center">
                      <Button
                        type="button" variant="outline" size="icon" className="h-7 w-7 shrink-0"
                        onClick={() => updateLinea(idx, 'cantidad', Math.max(1, linea.cantidad - 1))}
                      >−</Button>
                      <Input
                        type="number" value={linea.cantidad} min={1}
                        onChange={e => updateLinea(idx, 'cantidad', Math.max(1, parseFloat(e.target.value) || 1))}
                        className="h-7 text-sm text-center w-14 px-1"
                      />
                      <Button
                        type="button" variant="outline" size="icon" className="h-7 w-7 shrink-0"
                        onClick={() => updateLinea(idx, 'cantidad', linea.cantidad + 1)}
                      >+</Button>
                    </div>
                  </TableCell>
                  <TableCell className="p-1">
                    <Input type="number" value={linea.precio} onChange={e => updateLinea(idx, 'precio', parseFloat(e.target.value) || 0)} className="h-7 text-sm text-right w-28" min={0} step="0.01" />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input type="number" value={linea.porc_descuento} onChange={e => updateLinea(idx, 'porc_descuento', parseFloat(e.target.value) || 0)} className="h-7 text-sm text-right w-16" min={0} max={100} />
                  </TableCell>
                  <TableCell className="p-1 text-right font-mono text-sm pr-3 font-medium">{fmtN(linea.monto)}</TableCell>
                  <TableCell className="p-1 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <Checkbox checked={linea.itbis} onCheckedChange={v => updateLinea(idx, 'itbis', v === true)} />
                      {linea.itbis && linea.porciento_impuesto > 0 && (
                        <span className="text-xs text-gray-400">{linea.porciento_impuesto}%</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="p-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => eliminarLinea(idx)}>×</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {lineas.length > 0 && (
          <div className="flex justify-end border-t pt-3">
            <div className="w-80 space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal bruto:</span>
                <span className="font-mono">{fmtN(subtotalBruto)}</span>
              </div>
              {descuentoTotal > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Descuento:</span>
                  <span className="font-mono">({fmtN(descuentoTotal)})</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Base neta:</span>
                <span className="font-mono">{fmtN(baseNeta)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>ITBIS:</span>
                <span className="font-mono">{fmtN(itbisTotal)}</span>
              </div>
              <div className="flex justify-between font-bold text-xl border-t pt-2 mt-1">
                <span>Total Neto:</span>
                <span className="font-mono">{fmtN(totalNeto)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Client Search Modal ── */}
      <Dialog open={clienteModalOpen} onOpenChange={setClienteModalOpen}>
        <DialogContent className="w-[60vw] h-[70vh] max-w-none sm:max-w-none flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle>Buscar Cliente</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-3 border-b shrink-0 bg-gray-50">
            <Input
              ref={clienteModalInputRef}
              value={clienteSearch}
              onChange={e => { setClienteSearch(e.target.value); buscarClientesModal(e.target.value) }}
              placeholder="Buscar por nombre, codigo o RNC..."
              className="text-base h-11"
              autoFocus
            />
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead className="w-32">Codigo</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="w-36">RNC / Cedula</TableHead>
                  <TableHead className="w-64">Direccion</TableHead>
                  <TableHead className="w-24 text-center">Accion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clienteResults.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-400 py-12">
                      {buscandoClientes ? 'Buscando...' : clienteSearch.length >= 2 ? 'No se encontraron clientes' : 'Escriba al menos 2 caracteres para buscar'}
                    </TableCell>
                  </TableRow>
                )}
                {clienteResults.map(c => (
                  <TableRow key={c.no_cliente} className="hover:bg-blue-50 cursor-pointer" onDoubleClick={() => aplicarCliente(c)}>
                    <TableCell className="font-mono font-semibold">{c.no_cliente}</TableCell>
                    <TableCell className="font-medium">{c.nombre}</TableCell>
                    <TableCell className="font-mono text-sm">{c.rnc || c.cedula || '—'}</TableCell>
                    <TableCell className="text-sm text-gray-600 truncate max-w-xs">{c.direccion || '—'}</TableCell>
                    <TableCell className="text-center">
                      <Button size="sm" className="h-7 px-3" onClick={() => aplicarCliente(c)}>Seleccionar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="px-6 py-3 border-t shrink-0 bg-gray-50 flex items-center justify-between text-sm text-gray-500">
            <span>{clienteResults.length > 0 ? `${clienteResults.length} cliente${clienteResults.length !== 1 ? 's' : ''} encontrado${clienteResults.length !== 1 ? 's' : ''}` : ''}</span>
            <span className="text-xs">Doble clic o "Seleccionar" para cargar el cliente</span>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Product Search Modal (componente compartido) ── */}
      <BuscarProductoModal
        open={productDialogOpen}
        onClose={() => { setProductDialogOpen(false); setCurrentLineaIdx(null) }}
        onSelect={(p, qty, alm) => {
          // p.* viene del modal; alm es el almacén elegido en el modal.
          // Reutilizamos la lógica original de seleccionarProducto, pero pasando
          // explícitamente el almacén para no depender del estado interno del modal.
          if (currentLineaIdx === null) return
          const idx = currentLineaIdx
          setLineas(prev => {
            const arr = [...prev]
            const l = { ...arr[idx] }
            l.no_produ = p.no_produ
            l.descripcion = p.descri
            l.precio = p.precio
            l.porciento_impuesto = p.porciento_impuesto
            l.itbis = p.porciento_impuesto > 0
            l.emp = p.unidad_empaque
            l.cantidad = qty
            l.monto = qty * l.precio * (1 - l.porc_descuento / 100)
            if (alm) l.almacen = alm
            l.empaques = []
            l.precioBase = p.precio
            l.cantPorEmpBase = 1
            arr[idx] = l
            return arr
          })
          setProductDialogOpen(false)
          setCurrentLineaIdx(null)
          aplicarEmpaquesALinea(idx, p.no_produ, p.precio)
        }}
        noCia={noCia}
        punto={punto}
        almacenes={almacenes}
        listas={listas}
        noLista={noLista}
        defaultAlmacen={modalAlmacen || defaultAlmacen}
      />
    </div>
  )
}
