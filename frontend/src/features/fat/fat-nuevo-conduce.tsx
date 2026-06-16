import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Textarea } from '@/components/ui/textarea'
import { BuscarProductoModal } from './components/buscar-producto-modal'
import { empaqueLabel } from './utils/empaque-label'

interface EmpaqueOpcion {
  empaque?: number
  unidad: string
  descripcion: string
  referencia?: string
  por_defecto: boolean
  cant_por_emp: number
  permite_fraccion?: boolean
}

interface Props {
  noCia: string
  punto: string
  editId?: string
  editTipo?: string
}

interface TipoDoc {
  tipo_docu: string
  descripcion: string
  tipo_transaccion: string
  almacen: string
  activo: boolean | string
}

interface Vendedor {
  vendedor: string
  nombre: string
}

interface TipoPago {
  tipo_pago: string
  descripcion: string
}

interface Cliente {
  no_cliente: string | number
  punto?: string
  nombre: string
  rnc?: string
  cedula?: string
  direccion?: string
  ciudad?: string
  vendedor?: string
}

interface Producto {
  no_produ: string
  descri: string
  precio: number
  porciento_impuesto: number
  unidad_empaque: string
  existencia: number
}

interface Linea {
  id: number
  lin: number
  almacen: string
  cod_barra: string
  no_produ: string
  emp: string
  descripcion: string
  no_lista: string
  precio_lista: number
  precio: number
  cantidad: number
  porc_descuento: number
  monto: number
  porciento_impuesto: number
  itbis: boolean
  empaques: EmpaqueOpcion[]
  precioBase: number // precio para la unidad base (cant_por_emp=1)
  cantPorEmpBase: number // cant_por_emp del empaque por defecto
}

const fmtN = (n: number) =>
  n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

let lineaIdCounter = 1

export function NuevoConduce({ noCia, punto, editId, editTipo }: Props) {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [tiposDoc, setTiposDoc] = useState<TipoDoc[]>([])
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [tiposPago, setTiposPago] = useState<TipoPago[]>([])
  const [noLista, setNoLista] = useState<string>('1')

  const [tipoDoc, setTipoDoc] = useState('')
  const [cantBultos, setCantBultos] = useState<number>(0)
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [formaPago, setFormaPago] = useState('')
  const [noCliente, setNoCliente] = useState('')
  const [noClienteInput, setNoClienteInput] = useState('')
  const [clienteSeleccionado, setClienteSeleccionado] =
    useState<Cliente | null>(null)
  const [cargandoCliente, setCargandoCliente] = useState(false)
  const [clase, setClase] = useState('C')
  const [tipoMoneda, setTipoMoneda] = useState('RD')
  const [tasa, setTasa] = useState<number>(57.5)
  const [direccion, setDireccion] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [detalleNota, setDetalleNota] = useState('')
  const [vendedor, setVendedor] = useState('')
  const [copiarDesde, setCopiarDesde] = useState('')
  const [rutaEntrega, setRutaEntrega] = useState('')
  const [localidad, setLocalidad] = useState('')

  const [lineas, setLineas] = useState<Linea[]>([])

  // Cliente modal
  const [clienteModalOpen, setClienteModalOpen] = useState(false)
  const [clienteSearch, setClienteSearch] = useState('')
  const [clienteResults, setClienteResults] = useState<Cliente[]>([])
  const [buscandoClientes, setBuscandoClientes] = useState(false)

  // Product modal
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<Producto[]>([])
  const [currentLineaIdx, setCurrentLineaIdx] = useState<number | null>(null)
  const [modalCantidades, setModalCantidades] = useState<
    Record<string, number>
  >({})
  const [modalAlmacen, setModalAlmacen] = useState('')
  const [soloExistencia, setSoloExistencia] = useState(true)
  const [buscandoProductos, setBuscandoProductos] = useState(false)

  const [guardando, setGuardando] = useState(false)

  // Edit mode state
  const [modoEdicion, setModoEdicion] = useState(false)
  const [noConduceEdit, setNoConduceEdit] = useState('')
  const [ncfDgi, setNcfDgi] = useState('')
  const [cargandoEdicion, setCargandoEdicion] = useState(false)

  const noClienteInputRef = useRef<HTMLInputElement>(null)
  const clienteModalInputRef = useRef<HTMLInputElement>(null)
  const clienteSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clienteLookupSeqRef = useRef(0)
  const productSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Catálogos para el modal de Buscar Producto
  const [almacenes, setAlmacenes] = useState<
    Array<{ almacen: string; descripcion?: string }>
  >([])
  const [listas, setListas] = useState<
    Array<{ no_lista: number | string; descripcion?: string; nombre?: string }>
  >([])

  useEffect(() => {
    async function cargarDatos() {
      try {
        const [docsRes, vendsRes, pagosRes, listasRes, almRes] =
          await Promise.all([
            regalGeneralApi.fatListDocumentTypes(noCia, punto),
            regalGeneralApi.fatListVendedores(noCia),
            regalGeneralApi.fatListTiposPago(noCia, punto),
            regalGeneralApi.fatListasPrecio(noCia, punto),
            regalGeneralApi.invAlmacenes(noCia, punto),
          ])
        const conducesMap = new Map<string, TipoDoc>()
        const docs = (docsRes.items || []) as TipoDoc[]
        docs
          .filter(
            (d) =>
              d.tipo_transaccion === 'C' &&
              d.activo !== false &&
              d.activo !== 'N'
          )
          .forEach((d) => {
            const code = String(d.tipo_docu ?? '').trim()
            if (code && !conducesMap.has(code)) {
              conducesMap.set(code, { ...d, tipo_docu: code })
            }
          })
        const conduces = Array.from(conducesMap.values())
        setTiposDoc(conduces)
        if (!editId && conduces.length > 0) {
          setTipoDoc((prev) => prev || conduces[0].tipo_docu)
        }
        setVendedores(vendsRes.items || [])
        setTiposPago(pagosRes.items || [])

        const listasArr =
          listasRes.tipos ??
          listasRes.items ??
          (Array.isArray(listasRes) ? listasRes : [])
        setListas(listasArr)
        if (listasArr.length > 0) setNoLista(String(listasArr[0].no_lista))

        const almArr = (almRes?.results ?? [])
          .filter((a: any) => (a.activo ?? 'S') !== 'N')
          .map((a: any) => ({
            almacen: String(a.almacen ?? '').trim(),
            descripcion: (a.descripcion ?? '').trim(),
          }))
          .filter((a: any) => a.almacen)
        setAlmacenes(almArr)
        if (almArr.length > 0) setModalAlmacen(almArr[0].almacen)
      } catch {
        toast({
          title: 'Error',
          description: 'Error cargando datos iniciales',
          variant: 'destructive',
        })
      }
    }
    cargarDatos()
  }, [noCia, punto])

  // ── Load for edit mode ────────────────────────────────────
  useEffect(() => {
    if (!editId || !editTipo || !noCia) return
    setCargandoEdicion(true)
    regalGeneralApi
      .fatGetConduce(noCia, punto, editTipo, editId)
      .then((d: any) => {
        setModoEdicion(true)
        setNoConduceEdit(d.no_conduce || '')
        setNcfDgi(d.ncf_dgi || '')
        // Populate header fields
        if (d.tipo_conduce) setTipoDoc(d.tipo_conduce)
        if (d.fecha) setFecha(d.fecha)
        if (d.forma_pago) setFormaPago(d.forma_pago)
        if (d.vendedor) setVendedor(d.vendedor)
        if (d.clase) setClase(String(d.clase).trim().charAt(0).toUpperCase() === 'P' ? 'P' : 'C')
        if (d.tipo_moneda) setTipoMoneda(d.tipo_moneda)
        if (d.tasa_us) setTasa(d.tasa_us)
        if (d.detalle) setDetalleNota(d.detalle)
        // cant_bultos not in TFAT_CONDUCE schema
        // Populate client
        if (d.no_cliente) {
          setNoCliente(String(d.no_cliente))
          setNoClienteInput(String(d.no_cliente))
          setClienteSeleccionado({
            no_cliente: String(d.no_cliente),
            nombre: d.nombre_cliente || '',
          })
        }
        // Populate lines
        if (d.lineas && Array.isArray(d.lineas)) {
          const lineasCargadas: Linea[] = d.lineas
            .filter((l: any) => l.st_anulado !== 'S')
            .map((l: any) => ({
              id: lineaIdCounter++,
              lin: l.no_linea,
              almacen: l.almacen || '',
              cod_barra: '',
              no_produ: l.no_produ || '',
              emp: '',
              descripcion: l.descripcion || '',
              no_lista: noLista,
              precio_lista: l.precio || 0,
              precio: l.precio || 0,
              cantidad: l.cantidad || 1,
              porc_descuento: l.porc_descuento || 0,
              monto:
                (l.cantidad || 1) *
                (l.precio || 0) *
                (1 - (l.porc_descuento || 0) / 100),
              porciento_impuesto: l.porciento_impuesto || 0,
              itbis: (l.porciento_impuesto || 0) > 0,
              empaques: [],
              precioBase: l.precio || 0,
              cantPorEmpBase: 1,
            }))
          setLineas(lineasCargadas)
        }
      })
      .catch(() => {
        toast({
          title: 'Error',
          description: 'No se pudo cargar el conduce para edicion',
          variant: 'destructive',
        })
      })
      .finally(() => setCargandoEdicion(false))
  }, [editId, editTipo, noCia])

  // ── Client ────────────────────────────────────────────────
  const cargarClientePorCodigo = async (codigo: string) => {
    const cod = codigo.trim()
    if (!cod) return
    const requestId = ++clienteLookupSeqRef.current
    setCargandoCliente(true)
    try {
      const res = await regalGeneralApi.fatListClientes(noCia, cod, 1, 5, punto)
      if (requestId !== clienteLookupSeqRef.current) return
      const items: Cliente[] = res.items || []
      const exact = items.find((c) => String(c.no_cliente).trim() === cod)
      const match = exact ?? (items.length === 1 ? items[0] : null)
      if (match) {
        aplicarCliente(match)
      } else if (items.length > 1) {
        setClienteResults(items)
        setClienteSearch(cod)
        setClienteModalOpen(true)
      } else {
        toast({
          title: 'Cliente no encontrado',
          description: `Codigo: ${cod}`,
          variant: 'destructive',
        })
      }
    } catch {
      if (requestId !== clienteLookupSeqRef.current) return
      toast({
        title: 'Error',
        description: 'No se pudo cargar el cliente',
        variant: 'destructive',
      })
    } finally {
      if (requestId === clienteLookupSeqRef.current) setCargandoCliente(false)
    }
  }

  const aplicarCliente = (c: Cliente) => {
    clienteLookupSeqRef.current += 1
    setClienteSeleccionado(c)
    setNoCliente(String(c.no_cliente))
    setNoClienteInput(String(c.no_cliente))
    setDireccion(c.direccion || '')
    setCiudad(c.ciudad || '')
    if (c.vendedor) setVendedor(c.vendedor)
    setClienteModalOpen(false)
    setClienteResults([])
    setClienteSearch('')
  }

  const limpiarCliente = () => {
    setClienteSeleccionado(null)
    setNoCliente('')
    setNoClienteInput('')
    setDireccion('')
    setCiudad('')
    setTimeout(() => noClienteInputRef.current?.focus(), 50)
  }

  const buscarClientesModal = useCallback(
    (q: string) => {
      if (clienteSearchRef.current) clearTimeout(clienteSearchRef.current)
      if (!q || q.length < 2) {
        setClienteResults([])
        return
      }
      setBuscandoClientes(true)
      const requestId = ++clienteLookupSeqRef.current
      clienteSearchRef.current = setTimeout(async () => {
        try {
          const res = await regalGeneralApi.fatListClientes(noCia, q, 1, 50, punto)
          if (requestId !== clienteLookupSeqRef.current) return
          setClienteResults(res.items || [])
        } catch {
          if (requestId !== clienteLookupSeqRef.current) return
          setClienteResults([])
        } finally {
          if (requestId === clienteLookupSeqRef.current) setBuscandoClientes(false)
        }
      }, 300)
    },
    [noCia, punto]
  )

  const abrirClienteModal = () => {
    clienteLookupSeqRef.current += 1
    setClienteSearch('')
    setClienteResults([])
    setClienteModalOpen(true)
    setTimeout(() => clienteModalInputRef.current?.focus(), 80)
  }

  // ── Lines ────────────────────────────────────────────────
  const agregarLinea = () => {
    const td = tiposDoc.find((d) => d.tipo_docu === tipoDoc)
    const lin = lineas.length + 1
    const nuevaLinea: Linea = {
      id: lineaIdCounter++,
      lin,
      almacen: td?.almacen || '',
      cod_barra: '',
      no_produ: '',
      emp: '',
      descripcion: '',
      no_lista: noLista,
      precio_lista: 0,
      precio: 0,
      cantidad: 1,
      porc_descuento: 0,
      monto: 0,
      porciento_impuesto: 0,
      itbis: false,
      empaques: [],
      precioBase: 0,
      cantPorEmpBase: 1,
    }
    setLineas((prev) => {
      const next = [...prev, nuevaLinea]
      // auto-open product search for new line
      const newIdx = next.length - 1
      setTimeout(() => {
        setCurrentLineaIdx(newIdx)
        setProductSearch('')
        setProductResults([])
        setModalCantidades({})
        setModalAlmacen(td?.almacen || '')
        setProductDialogOpen(true)
      }, 0)
      return next
    })
  }

  const agregarLineaCustom = () => {
    const lin = lineas.length + 1
    const nuevaLinea: Linea = {
      id: lineaIdCounter++,
      lin,
      almacen: 'X',
      cod_barra: '',
      no_produ: 'X',
      emp: 'UND',
      descripcion: '',
      no_lista: noLista,
      precio_lista: 0,
      precio: 0,
      cantidad: 1,
      porc_descuento: 0,
      monto: 0,
      porciento_impuesto: 0,
      itbis: false,
      empaques: [],
      precioBase: 0,
      cantPorEmpBase: 1,
    }
    setLineas((prev) => [...prev, nuevaLinea])
  }

  const updateLinea = (
    idx: number,
    field: keyof Linea,
    value: string | number | boolean
  ) => {
    setLineas((prev) => {
      const arr = [...prev]
      const linea = { ...arr[idx], [field]: value }
      if (field === 'itbis') {
        linea.itbis = value === true
        linea.porciento_impuesto = linea.itbis
          ? linea.porciento_impuesto > 0
            ? linea.porciento_impuesto
            : 18
          : 0
      }
      if (['cantidad', 'precio', 'porc_descuento'].includes(field as string)) {
        linea.monto =
          linea.cantidad * linea.precio * (1 - linea.porc_descuento / 100)
      }
      arr[idx] = linea
      return arr
    })
  }

  const eliminarLinea = (idx: number) => {
    setLineas((prev) =>
      prev.filter((_, i) => i !== idx).map((l, i) => ({ ...l, lin: i + 1 }))
    )
  }

  // Carga empaques alternos del producto y los aplica a la línea — define la
  // UM por defecto y la base de precio para poder recalcular cuando se cambie.
  const cargarEmpaquesLinea = async (
    idx: number,
    noProdu: string,
    precio: number
  ) => {
    try {
      const res = await regalGeneralApi.fatProductoEmpaques(noProdu)
      const emps: EmpaqueOpcion[] = (res.items || []) as any[]
      const porDefecto = emps.find((e) => e.por_defecto) || emps[0]
      const cantBase =
        porDefecto?.cant_por_emp && porDefecto.cant_por_emp > 0
          ? porDefecto.cant_por_emp
          : 1
      const precioBase = cantBase > 0 ? precio / cantBase : precio
      setLineas((prev) => {
        const arr = [...prev]
        if (!arr[idx] || arr[idx].no_produ !== noProdu) return prev
        const linea = { ...arr[idx] }
        linea.empaques = emps
        linea.precioBase = precioBase
        linea.cantPorEmpBase = cantBase
        if (porDefecto) linea.emp = porDefecto.descripcion || porDefecto.unidad
        arr[idx] = linea
        return arr
      })
    } catch {
      /* sin empaques => UM queda estática */
    }
  }

  // Cambia la UM de la línea: recalcula precio = precioBase * cant_por_emp
  const cambiarEmpaqueLinea = (idx: number, unidad: string) => {
    setLineas((prev) => {
      const arr = [...prev]
      const linea = { ...arr[idx] }
      const emp = linea.empaques.find((e) => e.unidad === unidad)
      if (!emp) return prev
      const cant =
        emp.cant_por_emp && emp.cant_por_emp > 0 ? emp.cant_por_emp : 1
      linea.emp = emp.descripcion || emp.unidad
      linea.precio = parseFloat((linea.precioBase * cant).toFixed(4))
      linea.monto =
        linea.cantidad * linea.precio * (1 - linea.porc_descuento / 100)
      arr[idx] = linea
      return arr
    })
  }

  const buscarProductoPorCodigo = async (idx: number, codigo: string) => {
    if (!codigo) return
    // Codigo manual 'X' → producto generico editable (sin lookup en TINV_PRODUCTO)
    if (codigo.trim().toUpperCase() === 'X') {
      setLineas((prev) => {
        const arr = [...prev]
        const linea = { ...arr[idx] }
        linea.no_produ = 'X'
        linea.almacen = 'X'
        linea.descripcion = linea.descripcion || ''
        linea.precio = linea.precio || 0
        linea.precio_lista = linea.precio
        linea.precioBase = linea.precio
        linea.cantPorEmpBase = 1
        linea.empaques = []
        linea.porciento_impuesto = linea.itbis
          ? linea.porciento_impuesto || 18
          : linea.porciento_impuesto || 0
        linea.itbis = linea.porciento_impuesto > 0
        linea.emp = linea.emp || 'UND'
        linea.monto =
          linea.cantidad * linea.precio * (1 - linea.porc_descuento / 100)
        arr[idx] = linea
        return arr
      })
      return
    }
    try {
      const res = await regalGeneralApi.fatSearchProductos(
        noCia,
        punto,
        noLista,
        codigo,
        1,
        1
      )
      if (res.items && res.items.length > 0) {
        const p = res.items[0]
        setLineas((prev) => {
          const arr = [...prev]
          const linea = { ...arr[idx] }
          linea.no_produ = p.no_produ
          linea.descripcion = p.descri
          linea.precio = p.precio
          linea.precio_lista = p.precio
          linea.precioBase = p.precio
          linea.cantPorEmpBase = 1
          linea.empaques = []
          linea.porciento_impuesto = p.porciento_impuesto
          linea.itbis = p.porciento_impuesto > 0
          linea.emp = p.unidad_empaque
          linea.monto =
            linea.cantidad * linea.precio * (1 - linea.porc_descuento / 100)
          arr[idx] = linea
          return arr
        })
        cargarEmpaquesLinea(idx, p.no_produ, p.precio)
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Producto no encontrado',
        variant: 'destructive',
      })
    }
  }

  const abrirBusquedaProducto = (idx: number) => {
    setCurrentLineaIdx(idx)
    setProductSearch('')
    setProductResults([])
    setModalCantidades({})
    setModalAlmacen(lineas[idx]?.almacen || '')
    setProductDialogOpen(true)
  }

  const buscarProductos = useCallback(
    (search: string, alm?: string, soloExist?: boolean) => {
      if (productSearchRef.current) clearTimeout(productSearchRef.current)
      setBuscandoProductos(true)
      productSearchRef.current = setTimeout(async () => {
        try {
          const res = await regalGeneralApi.fatSearchProductos(
            noCia,
            punto,
            noLista,
            search,
            1,
            50,
            alm ?? modalAlmacen,
            soloExist ?? soloExistencia
          )
          setProductResults(res.items || [])
        } catch {
          setProductResults([])
        } finally {
          setBuscandoProductos(false)
        }
      }, 300)
    },
    [noCia, punto, noLista, modalAlmacen, soloExistencia]
  )

  const seleccionarProducto = (p: Producto, cantidad?: number) => {
    if (currentLineaIdx === null) return
    const qty = cantidad && cantidad > 0 ? cantidad : 1
    setLineas((prev) => {
      const arr = [...prev]
      const linea = { ...arr[currentLineaIdx] }
      linea.no_produ = p.no_produ
      linea.descripcion = p.descri
      linea.precio = p.precio
      linea.precio_lista = p.precio
      linea.porciento_impuesto = p.porciento_impuesto
      linea.itbis = p.porciento_impuesto > 0
      linea.emp = p.unidad_empaque
      linea.cantidad = qty
      linea.monto = qty * linea.precio * (1 - linea.porc_descuento / 100)
      arr[currentLineaIdx] = linea
      return arr
    })
    setProductDialogOpen(false)
    setCurrentLineaIdx(null)
  }

  // ── Totals ───────────────────────────────────────────────
  const cantProd = lineas.filter((l) => l.no_produ).length
  const subTotal = lineas.reduce((s, l) => s + l.cantidad * l.precio, 0)
  const totalDesc = lineas.reduce(
    (s, l) => s + l.cantidad * l.precio * (l.porc_descuento / 100),
    0
  )
  const totalItbis = lineas
    .filter((l) => l.itbis)
    .reduce((s, l) => s + l.monto * (l.porciento_impuesto / 100), 0)
  const totalConduce = lineas.reduce((s, l) => s + l.monto, 0) + totalItbis

  // ── Save ─────────────────────────────────────────────────
  const guardar = async () => {
    if (!tipoDoc && tiposDoc.length > 0) {
      toast({
        title: 'Validacion',
        description: 'Debe seleccionar el Tipo de Documento',
        variant: 'destructive',
      })
      return
    }
    if (!noCliente) {
      toast({
        title: 'Validacion',
        description: 'Debe seleccionar un cliente',
        variant: 'destructive',
      })
      return
    }
    const lineasValidas = lineas.filter((l) => l.no_produ && l.cantidad > 0)
    if (lineasValidas.length === 0) {
      toast({
        title: 'Validacion',
        description: 'Debe agregar al menos una linea valida',
        variant: 'destructive',
      })
      return
    }
    setGuardando(true)
    const payload = {
      no_cia: noCia,
      punto,
      tipo_conduce: tipoDoc || 'CO',
      no_cliente: noCliente,
      fecha,
      forma_pago: formaPago,
      vendedor,
      no_lista: noLista,
      clase,
      detalle: detalleNota,
      cant_bultos: cantBultos,
      tipo_moneda: tipoMoneda,
      tasa_us: tasa,
      ruta_entrega: rutaEntrega,
      copiar_desde: copiarDesde,
      lineas: lineasValidas.map((l) => ({
        no_produ: l.no_produ,
        almacen: l.almacen,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        precio: l.precio,
        porc_descuento: l.porc_descuento,
        porciento_impuesto: l.porciento_impuesto,
      })),
    }
    try {
      if (modoEdicion && editTipo && editId) {
        await regalGeneralApi.fatActualizarConduce(editTipo, editId, payload)
        toast({
          title: 'Conduce actualizado',
          description: `Conduce ${editTipo}-${editId} actualizado`,
        })
      } else {
        const res = await regalGeneralApi.fatCrearConduce(payload)
        toast({
          title: 'Conduce creado',
          description: `Conduce ${res.no_conduce} creado exitosamente`,
        })
        const tipoCreado = String(res.tipo_conduce || payload.tipo_conduce)
        const noCreado = String(res.no_conduce || '')
        const codigoPrint = tipoCreado === 'CT' ? 'cotizacion' : 'conduce'
        const qs = new URLSearchParams({ no_cia: noCia, punto }).toString()
        const printUrl = `/print/${codigoPrint}/${encodeURIComponent(`${tipoCreado}-${noCreado}`)}?${qs}`
        const popup = window.open(printUrl, '_blank', 'noopener,width=900,height=1100')
        if (!popup) {
          toast({
            title: 'Bloqueado por el navegador',
            description: 'Permita ventanas emergentes para imprimir automáticamente.',
          })
        }
      }
      navigate({ to: '/fat/conduces' as never })
    } catch (e: any) {
      const detail = (e?.detail && (e.detail.detail || e.detail)) || ''
      const msg = typeof detail === 'string' ? detail.trim() : ''
      toast({
        title: 'Error',
        description:
          msg ||
          (modoEdicion
            ? 'Error al actualizar el conduce'
            : 'Error al guardar el conduce'),
        variant: 'destructive',
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className='space-y-4 p-4'>
      {/* ── Header ── */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-xl font-bold'>
            {modoEdicion
              ? `Editar Conduce ${editTipo}-${noConduceEdit}`
              : 'Nuevo Conduce'}
          </h1>
          {modoEdicion && ncfDgi && (
            <p className='mt-0.5 font-mono text-sm text-blue-700'>
              NCF: {ncfDgi}
            </p>
          )}
          {cargandoEdicion && (
            <p className='mt-0.5 text-sm text-muted-foreground'>
              Cargando datos del conduce...
            </p>
          )}
        </div>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            onClick={() => navigate({ to: '/fat/conduces' as never })}
          >
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando || cargandoEdicion}>
            {guardando
              ? modoEdicion
                ? 'Actualizando...'
                : 'Guardando...'
              : modoEdicion
                ? 'Actualizar'
                : 'Guardar'}
          </Button>
        </div>
      </div>

      {/* ── Section 1: Header fields ── */}
      <div className='space-y-3 rounded-md border p-4'>
        <div className='grid grid-cols-5 items-end gap-3'>
          <div className='space-y-1'>
            <Label>Tipo Documento</Label>
            <Select value={tipoDoc} onValueChange={setTipoDoc}>
              <SelectTrigger>
                <SelectValue placeholder='Seleccionar...' />
              </SelectTrigger>
              <SelectContent>
                {tiposDoc.map((d) => (
                  <SelectItem key={d.tipo_docu} value={d.tipo_docu}>
                    {d.tipo_docu} - {d.descripcion}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-1'>
            <Label>Cant. Bultos</Label>
            <Input
              type='number'
              value={cantBultos}
              onChange={(e) => setCantBultos(parseInt(e.target.value) || 0)}
              min={0}
            />
          </div>
          <div className='space-y-1'>
            <Label>Fecha</Label>
            <Input
              type='date'
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div className='space-y-1'>
            <Label>Forma Pago</Label>
            <Select value={formaPago} onValueChange={setFormaPago}>
              <SelectTrigger>
                <SelectValue placeholder='Seleccionar...' />
              </SelectTrigger>
              <SelectContent>
                {tiposPago.map((p) => (
                  <SelectItem key={p.tipo_pago} value={p.tipo_pago}>
                    {p.descripcion}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='flex items-end'>
            <Button variant='outline' disabled className='w-full text-gray-400'>
              Anular
            </Button>
          </div>
        </div>

        {/* ── Section 2: Client ── */}
        <div className='space-y-2 rounded-lg border bg-background p-3'>
          <p className='text-xs font-semibold tracking-wider text-gray-400 uppercase'>
            Cliente{' '}
            <span className='font-normal text-red-500 normal-case'>
              * requerido
            </span>
          </p>
          <div className='flex items-end gap-2'>
            {/* Code input */}
            <div className='w-36 space-y-1'>
              <Label>Codigo</Label>
              <Input
                ref={noClienteInputRef}
                value={noClienteInput}
                onChange={(e) => {
                  setNoClienteInput(e.target.value)
                  if (clienteSeleccionado) limpiarCliente()
                }}
                onBlur={(e) => cargarClientePorCodigo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') cargarClientePorCodigo(noClienteInput)
                }}
                placeholder='Cod. cliente'
                disabled={cargandoCliente}
              />
            </div>

            {/* Magnifier button */}
            <Button
              variant='outline'
              onClick={abrirClienteModal}
              className='h-10 px-3'
              title='Buscar cliente'
              type='button'
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                width='16'
                height='16'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <circle cx='11' cy='11' r='8' />
                <line x1='21' y1='21' x2='16.65' y2='16.65' />
              </svg>
            </Button>

            {/* Client info display */}
            {clienteSeleccionado ? (
              <div className='flex flex-1 items-center gap-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2'>
                <div className='min-w-0'>
                  <span className='block text-xs font-medium text-emerald-600'>
                    Nombre
                  </span>
                  <span className='block truncate font-semibold text-emerald-900'>
                    {clienteSeleccionado.nombre}
                  </span>
                </div>
                {(clienteSeleccionado.rnc || clienteSeleccionado.cedula) && (
                  <div className='shrink-0'>
                    <span className='block text-xs font-medium text-emerald-600'>
                      RNC / Cedula
                    </span>
                    <span className='font-mono text-sm text-emerald-800'>
                      {clienteSeleccionado.rnc || clienteSeleccionado.cedula}
                    </span>
                  </div>
                )}
                {direccion && (
                  <div className='min-w-0 flex-1'>
                    <span className='block text-xs font-medium text-emerald-600'>
                      Direccion
                    </span>
                    <span className='block truncate text-sm text-emerald-700'>
                      {direccion}
                    </span>
                  </div>
                )}
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-7 shrink-0 px-2 text-gray-400 hover:text-red-500'
                  onClick={limpiarCliente}
                >
                  ×
                </Button>
              </div>
            ) : (
              <div className='flex flex-1 items-center rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-400'>
                {cargandoCliente
                  ? 'Cargando cliente...'
                  : 'Ingrese el codigo o use la lupa para buscar'}
              </div>
            )}
          </div>
        </div>

        <div className='grid grid-cols-4 gap-3'>
          <div className='space-y-1'>
            <Label>Clase</Label>
            <Select value={clase} onValueChange={setClase}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='C'>C - Normal</SelectItem>
                <SelectItem value='P'>P - Pre-factura</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-1'>
            <Label>Tipo Moneda</Label>
            <Select value={tipoMoneda} onValueChange={setTipoMoneda}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='RD'>RD - Peso Dominicano</SelectItem>
                <SelectItem value='US'>US - Dolar Americano</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-1'>
            <Label>Tasa</Label>
            <Input
              type='number'
              value={tasa}
              onChange={(e) => setTasa(parseFloat(e.target.value) || 0)}
              step='0.01'
            />
          </div>
          <div className='space-y-1'>
            <Label>Vendedor</Label>
            <Select value={vendedor} onValueChange={setVendedor}>
              <SelectTrigger>
                <SelectValue placeholder='Seleccionar...' />
              </SelectTrigger>
              <SelectContent>
                {vendedores.map((v) => (
                  <SelectItem key={v.vendedor} value={v.vendedor}>
                    {v.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className='grid grid-cols-2 gap-3'>
          <div className='space-y-1'>
            <Label>Direccion</Label>
            <Input
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              className='bg-background'
            />
          </div>
          <div className='space-y-1'>
            <Label>Ciudad</Label>
            <Input
              value={ciudad}
              onChange={(e) => setCiudad(e.target.value)}
              className='bg-background'
            />
          </div>
        </div>

        <div className='grid grid-cols-3 gap-3'>
          <div className='space-y-1'>
            <Label>Copiar desde</Label>
            <Input
              value={copiarDesde}
              onChange={(e) => setCopiarDesde(e.target.value)}
              placeholder='Ref. opcional'
            />
          </div>
          <div className='space-y-1'>
            <Label>Ruta Entrega</Label>
            <Input
              value={rutaEntrega}
              onChange={(e) => setRutaEntrega(e.target.value)}
            />
          </div>
          <div className='space-y-1'>
            <Label>Localidad</Label>
            <Input
              value={localidad}
              onChange={(e) => setLocalidad(e.target.value)}
              className='bg-background'
              readOnly
            />
          </div>
        </div>

        <div className='space-y-1'>
          <Label>Detalle / Nota</Label>
          <Textarea
            value={detalleNota}
            onChange={(e) => setDetalleNota(e.target.value)}
            rows={2}
            className='resize-none'
          />
        </div>
      </div>

      {/* ── Section 3: Lines ── */}
      <div className='space-y-2 rounded-md border p-3'>
        <div className='flex items-center justify-between'>
          <h2 className='font-semibold'>Lineas de Detalle</h2>
          <div className='flex items-center gap-2'>
            <Button size='sm' variant='outline' onClick={agregarLineaCustom}>
              Linea X
            </Button>
            <Button size='sm' variant='outline' onClick={agregarLinea}>
              + Agregar Linea
            </Button>
          </div>
        </div>
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-10'>Lin</TableHead>
                <TableHead className='w-16'>Alm</TableHead>
                <TableHead className='w-28'>No Produ</TableHead>
                <TableHead className='w-14'>UM</TableHead>
                <TableHead className='min-w-40'>Nombre Producto</TableHead>
                <TableHead className='w-24 text-right'>Precio</TableHead>
                <TableHead className='w-32 text-center'>Cantidad</TableHead>
                <TableHead className='w-16'>%Desc</TableHead>
                <TableHead className='w-24 text-right'>Monto</TableHead>
                <TableHead className='w-16 text-center'>Itbis?</TableHead>
                <TableHead className='w-8'></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineas.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className='py-10 text-center text-gray-400'
                  >
                    No hay lineas. Haga clic en "+ Agregar Linea".
                  </TableCell>
                </TableRow>
              )}
              {lineas.map((linea, idx) => (
                <TableRow key={linea.id} className='hover:bg-background'>
                  <TableCell className='p-1 text-center font-mono text-sm'>
                    {linea.lin}
                  </TableCell>
                  <TableCell className='p-1'>
                    <Input
                      value={linea.almacen}
                      onChange={(e) =>
                        updateLinea(idx, 'almacen', e.target.value)
                      }
                      maxLength={6}
                      className='h-7 w-14 text-sm'
                      placeholder='Alm.'
                    />
                  </TableCell>
                  <TableCell className='p-1'>
                    <div className='flex items-center gap-1'>
                      <Input
                        value={linea.no_produ}
                        onChange={(e) =>
                          updateLinea(idx, 'no_produ', e.target.value)
                        }
                        onBlur={(e) =>
                          buscarProductoPorCodigo(idx, e.target.value)
                        }
                        className='h-7 w-20 font-mono text-xs'
                        placeholder='Codigo'
                      />
                      <Button
                        size='sm'
                        variant='outline'
                        className='h-7 shrink-0 px-2 text-xs'
                        onClick={() => abrirBusquedaProducto(idx)}
                      >
                        <svg
                          xmlns='http://www.w3.org/2000/svg'
                          width='12'
                          height='12'
                          viewBox='0 0 24 24'
                          fill='none'
                          stroke='currentColor'
                          strokeWidth='2'
                          strokeLinecap='round'
                          strokeLinejoin='round'
                        >
                          <circle cx='11' cy='11' r='8' />
                          <line x1='21' y1='21' x2='16.65' y2='16.65' />
                        </svg>
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className='p-1 text-center'>
                    {linea.empaques.length > 1 ? (
                      <Select
                        value={
                          linea.empaques.find(
                            (e) => (e.descripcion || e.unidad) === linea.emp
                          )?.unidad || linea.empaques[0].unidad
                        }
                        onValueChange={(v) => cambiarEmpaqueLinea(idx, v)}
                      >
                        <SelectTrigger className='h-7 w-auto min-w-[3.5rem] gap-1 px-2 text-xs'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {linea.empaques.map((e) => (
                            <SelectItem
                              key={`${e.empaque ?? e.unidad}`}
                              value={e.unidad}
                            >
                              {empaqueLabel(e)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className='rounded border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700'>
                        {linea.emp || '—'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className='p-1'>
                    <Input
                      value={linea.descripcion}
                      onChange={(e) =>
                        updateLinea(idx, 'descripcion', e.target.value)
                      }
                      className='h-7 text-sm'
                      placeholder='Descripcion'
                    />
                  </TableCell>
                  <TableCell className='p-1'>
                    <Input
                      type='number'
                      value={linea.precio}
                      onChange={(e) =>
                        updateLinea(
                          idx,
                          'precio',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className='h-7 w-24 text-right text-sm'
                      min={0}
                      step='0.01'
                    />
                  </TableCell>
                  <TableCell className='p-1'>
                    <div className='flex items-center justify-center gap-0.5'>
                      <Button
                        type='button'
                        variant='outline'
                        size='icon'
                        className='h-7 w-7 shrink-0'
                        onClick={() =>
                          updateLinea(
                            idx,
                            'cantidad',
                            Math.max(1, linea.cantidad - 1)
                          )
                        }
                      >
                        −
                      </Button>
                      <Input
                        type='number'
                        value={linea.cantidad}
                        min={1}
                        onChange={(e) =>
                          updateLinea(
                            idx,
                            'cantidad',
                            Math.max(1, parseFloat(e.target.value) || 1)
                          )
                        }
                        className='h-7 w-14 px-1 text-center text-sm'
                      />
                      <Button
                        type='button'
                        variant='outline'
                        size='icon'
                        className='h-7 w-7 shrink-0'
                        onClick={() =>
                          updateLinea(idx, 'cantidad', linea.cantidad + 1)
                        }
                      >
                        +
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className='p-1'>
                    <Input
                      type='number'
                      value={linea.porc_descuento}
                      onChange={(e) =>
                        updateLinea(
                          idx,
                          'porc_descuento',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className='h-7 w-14 text-right text-sm'
                      min={0}
                      max={100}
                    />
                  </TableCell>
                  <TableCell className='p-1 pr-3 text-right font-mono text-sm font-medium'>
                    {fmtN(linea.monto)}
                  </TableCell>
                  <TableCell className='p-1 text-center'>
                    <div className='flex flex-col items-center gap-0.5'>
                      <Checkbox
                        checked={linea.itbis}
                        onCheckedChange={(v) =>
                          updateLinea(idx, 'itbis', v === true)
                        }
                      />
                      {linea.itbis && linea.porciento_impuesto > 0 && (
                        <span className='text-xs text-gray-400'>
                          {linea.porciento_impuesto}%
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className='p-1'>
                    <Button
                      size='sm'
                      variant='ghost'
                      className='h-7 w-7 p-0 text-red-400 hover:bg-red-50 hover:text-red-600'
                      onClick={() => eliminarLinea(idx)}
                    >
                      ×
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {lineas.length > 0 && (
          <div className='flex justify-end border-t pt-3'>
            <div className='w-72 space-y-1.5 text-sm'>
              <div className='flex justify-between text-gray-600'>
                <span>Cant. Prod.:</span>
                <span className='font-mono'>{cantProd}</span>
              </div>
              <div className='flex justify-between text-gray-600'>
                <span>Sub Total:</span>
                <span className='font-mono'>{fmtN(subTotal)}</span>
              </div>
              {totalDesc > 0 && (
                <div className='flex justify-between text-red-600'>
                  <span>Descuento:</span>
                  <span className='font-mono'>({fmtN(totalDesc)})</span>
                </div>
              )}
              <div className='flex justify-between text-gray-600'>
                <span>ITBIS:</span>
                <span className='font-mono'>{fmtN(totalItbis)}</span>
              </div>
              <div className='mt-1 flex justify-between border-t pt-2 text-lg font-bold'>
                <span>Total Conduce:</span>
                <span className='font-mono'>{fmtN(totalConduce)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Cliente Modal ── */}
      <Dialog open={clienteModalOpen} onOpenChange={setClienteModalOpen}>
        <DialogContent className='flex h-[70vh] w-[60vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none'>
          <DialogHeader className='shrink-0 border-b px-6 py-4'>
            <DialogTitle>Buscar Cliente</DialogTitle>
          </DialogHeader>
          <div className='shrink-0 border-b bg-background px-6 py-3'>
            <Input
              ref={clienteModalInputRef}
              value={clienteSearch}
              onChange={(e) => {
                setClienteSearch(e.target.value)
                buscarClientesModal(e.target.value)
              }}
              placeholder='Buscar por nombre, codigo o RNC...'
              className='h-11 text-base'
              autoFocus
            />
          </div>
          <div className='flex-1 overflow-y-auto px-6 py-2'>
            <Table>
              <TableHeader className='sticky top-0 z-10 bg-background'>
                <TableRow>
                  <TableHead className='w-32'>Codigo</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className='w-36'>RNC / Cedula</TableHead>
                  <TableHead className='w-64'>Direccion</TableHead>
                  <TableHead className='w-24 text-center'>Accion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clienteResults.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className='py-12 text-center text-gray-400'
                    >
                      {buscandoClientes
                        ? 'Buscando...'
                        : clienteSearch.length >= 2
                          ? 'No se encontraron clientes'
                          : 'Escriba al menos 2 caracteres para buscar'}
                    </TableCell>
                  </TableRow>
                )}
                {clienteResults.map((c) => (
                  <TableRow
                    key={`${c.punto || punto}-${c.no_cliente}`}
                    className='cursor-pointer hover:bg-blue-50'
                    onDoubleClick={() => aplicarCliente(c)}
                  >
                    <TableCell className='font-mono font-semibold'>
                      {c.no_cliente}
                    </TableCell>
                    <TableCell className='font-medium'>{c.nombre}</TableCell>
                    <TableCell className='font-mono text-sm'>
                      {c.rnc || c.cedula || '—'}
                    </TableCell>
                    <TableCell className='max-w-xs truncate text-sm text-gray-600'>
                      {c.direccion || '—'}
                    </TableCell>
                    <TableCell className='text-center'>
                      <Button
                        size='sm'
                        className='h-7 px-3'
                        onClick={() => aplicarCliente(c)}
                      >
                        Seleccionar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className='flex shrink-0 items-center justify-between border-t bg-background px-6 py-3 text-sm text-gray-500'>
            <span>
              {clienteResults.length > 0
                ? `${clienteResults.length} cliente${clienteResults.length !== 1 ? 's' : ''} encontrado${clienteResults.length !== 1 ? 's' : ''}`
                : ''}
            </span>
            <span className='text-xs'>
              Doble clic o "Seleccionar" para cargar el cliente
            </span>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Product Search Modal (componente compartido) ── */}
      <BuscarProductoModal
        open={productDialogOpen}
        onClose={() => {
          setProductDialogOpen(false)
          setCurrentLineaIdx(null)
        }}
        onSelect={(p, qty, alm) => {
          if (currentLineaIdx === null) return
          const idx = currentLineaIdx
          setLineas((prev) => {
            const arr = [...prev]
            const l = { ...arr[idx] }
            l.no_produ = p.no_produ
            l.descripcion = p.descri
            l.precio = p.precio
            l.precioBase = p.precio
            l.cantPorEmpBase = 1
            l.empaques = []
            l.porciento_impuesto = p.porciento_impuesto
            l.itbis = p.porciento_impuesto > 0
            l.emp = p.unidad_empaque
            l.cantidad = qty
            l.monto = qty * l.precio * (1 - (l.porc_descuento ?? 0) / 100)
            if (alm) l.almacen = alm
            arr[idx] = l
            return arr
          })
          // Cargar empaques alternos en background
          cargarEmpaquesLinea(currentLineaIdx, p.no_produ, p.precio)
          setProductDialogOpen(false)
          setCurrentLineaIdx(null)
        }}
        noCia={noCia}
        punto={punto}
        almacenes={almacenes}
        listas={listas}
        noLista={noLista}
        defaultAlmacen={modalAlmacen}
      />
    </div>
  )
}
