import { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useNavigate, getRouteApi } from '@tanstack/react-router'
import { api, regalGeneralApi } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { useEnterAdvancesFocus } from '@/hooks/use-enter-advances-focus'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, Save } from 'lucide-react'
import { ProveedorPicker } from '@/features/cxp/cxp-procesos'
import {
  BuscarProductoModal,
  type BuscarProductoModalAlmacen,
  type BuscarProductoModalProducto,
} from '@/features/fat/components/buscar-producto-modal'

// Fodc201 — Entrada de Orden de Compra (legacy).
// Cabecera (TODC_ORDEN) + Detalle (TODC_ORDENL).
// Usa los pickers compartidos de CxP (proveedor) y FAT/INV (producto) — antes
// esta pantalla tenia copias locales mas simples de ambos (sin crear proveedor
// inline, sin filtro de almacen/existencia en productos).

interface Proveedor {
  no_proveedor: string
  nombre: string
  rnc: string
  direccion: string
}

interface Linea {
  uid: string
  no_produ: string
  descripcion: string
  cantidad_pedida: number
  costo: number
  porc_descuento: number
  porciento_impuesto: number
  recibida?: number  // cantidad ya recibida (solo en edición); no bajar de aquí
}

const routeApi = getRouteApi('/_authenticated/odc/nueva-orden')

const fmtMoney = (n: number) =>
  Number(n || 0).toLocaleString('es-DO', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })

const today = () => new Date().toISOString().slice(0, 10)

function calcLinea(l: Linea) {
  const bruto = l.cantidad_pedida * l.costo
  const desc = bruto * (l.porc_descuento / 100)
  const base = bruto - desc
  const imp = base * (l.porciento_impuesto / 100)
  return { bruto, desc, base, imp, total: base + imp }
}

// ─── Vista principal ──────────────────────────────────────────────────────────
export function OdcNuevaOrden() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()
  const { edit: editId } = routeApi.useSearch()
  const isEdit = !!editId

  const [proveedor, setProveedor] = useState<Proveedor | null>(null)
  const [fecha, setFecha] = useState(today())
  const [fechaEntrega, setFechaEntrega] = useState(today())
  const [tipoOrden, setTipoOrden] = useState<'I' | 'S'>('I')
  const [plazoPago, setPlazoPago] = useState(0)
  const [condicionPago, setCondicionPago] = useState('CONTADO')
  const [noLocalidad, setNoLocalidad] = useState('')
  const [detalle, setDetalle] = useState('')

  const [lineas, setLineas] = useState<Linea[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)

  // ── Modo edición: cargar la orden y precargar el formulario ─────────────
  const editQ = useQuery({
    enabled: isEdit,
    queryKey: ['odc-orden-edit', selectedCompany, selectedPoint, editId],
    queryFn: () => api.odcGetOrden(selectedCompany, selectedPoint, editId!),
  })
  const loadedRef = useRef(false)
  useEffect(() => {
    const d: any = editQ.data
    if (!isEdit || !d?.cabecera || loadedRef.current) return
    loadedRef.current = true
    const c = d.cabecera
    const cod = String(c.no_proveedor || '').trim()
    ;(async () => {
      try {
        const p = await api.cxpGetProveedor(cod)
        setProveedor(p?.no_proveedor ? p : {
          no_proveedor: cod, nombre: c.nombre_proveedor || cod,
          rnc: c.rnc_proveedor || '', direccion: '',
        })
      } catch {
        setProveedor({
          no_proveedor: cod, nombre: c.nombre_proveedor || cod,
          rnc: c.rnc_proveedor || '', direccion: '',
        })
      }
    })()
    setFecha(String(c.fecha || today()).slice(0, 10))
    setFechaEntrega(String(c.fecha_entrega || c.fecha || today()).slice(0, 10))
    setTipoOrden(c.tipo_orden === 'S' ? 'S' : 'I')
    setPlazoPago(Number(c.plazo_pago) || 0)
    setCondicionPago(c.condicion_pago || 'CONTADO')
    setNoLocalidad(c.no_localidad || '')
    setDetalle(c.detalle || '')
    setLineas((d.lineas || []).map((l: any) => ({
      uid: `${l.no_produ}-${l.no_linea}-${Math.random().toString(36).slice(2, 6)}`,
      no_produ: l.no_produ,
      descripcion: l.descripcion_producto || '',
      cantidad_pedida: Number(l.cantidad_pedida) || 0,
      costo: Number(l.costo) || 0,
      porc_descuento: Number(l.porc_descuento) || 0,
      porciento_impuesto: Number(l.porciento_impuesto) || 0,
      recibida: Number(l.cantidad_recibida) || 0,
    })))
  }, [editQ.data, isEdit])

  const totales = lineas.reduce((acc, l) => {
    const c = calcLinea(l)
    acc.bruto += c.bruto; acc.descuento += c.desc; acc.impuesto += c.imp; acc.total += c.total
    return acc
  }, { bruto: 0, descuento: 0, impuesto: 0, total: 0 })

  // Almacenes solo para el filtro de existencia dentro de BuscarProductoModal
  // -- TODC_ORDENL no guarda almacen (la orden aun no es una entrada fisica,
  // eso se decide despues en Entrada de Mercancia), asi que el `almacen`
  // devuelto por el modal se ignora al armar la linea.
  const almacenesQ = useQuery({
    queryKey: ['odc-almacenes', selectedCompany, selectedPoint],
    queryFn: () => regalGeneralApi.invAlmacenes(selectedCompany, selectedPoint),
    enabled: !!selectedCompany,
  })
  const almacenes = (almacenesQ.data?.results || []) as BuscarProductoModalAlmacen[]

  const addProducto = (p: BuscarProductoModalProducto, cantidad: number) => {
    setLineas((prev) => [...prev, {
      uid: `${p.no_produ}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      no_produ: p.no_produ,
      descripcion: p.descri,
      cantidad_pedida: cantidad > 0 ? cantidad : 1,
      costo: Number(p.precio) || 0,
      porc_descuento: 0,
      porciento_impuesto: Number(p.porciento_impuesto) || 0,
    }])
    setPickerOpen(false)
  }

  const upLinea = (uid: string, patch: Partial<Linea>) =>
    setLineas((prev) => prev.map((l) => l.uid === uid ? { ...l, ...patch } : l))

  const rmLinea = (uid: string) =>
    setLineas((prev) => prev.filter((l) => l.uid !== uid))

  const guardar = useMutation({
    mutationFn: () => {
      const payload = {
        no_cia: selectedCompany,
        punto: selectedPoint,
        cabecera: {
          no_proveedor: proveedor!.no_proveedor,
          fecha, fecha_entrega: fechaEntrega,
          tipo_orden: tipoOrden,
          plazo_pago: Number(plazoPago) || 0,
          condicion_pago: condicionPago || undefined,
          no_localidad: noLocalidad || undefined,
          detalle: detalle || undefined,
          porc_impuesto: 18,
        },
        lineas: lineas.map((l) => {
          const c = calcLinea(l)
          return {
            no_produ: l.no_produ,
            cantidad_pedida: l.cantidad_pedida,
            costo: l.costo,
            porc_descuento: l.porc_descuento,
            descuento: c.desc,
            impuesto: c.imp,
            monto_neto: c.total,
            porciento_impuesto: l.porciento_impuesto,
          }
        }),
      }
      return isEdit
        ? api.odcActualizarOrden({ ...payload, no_orden: editId })
        : api.odcCrearOrden(payload)
    },
    onSuccess: (res: any) => {
      const noOrden = res?.no_orden || editId
      if (isEdit) {
        toast.success(`Orden ODC-${noOrden} actualizada`)
      } else {
        toast.success(`Orden ODC-${noOrden} creada`)
        const qs = new URLSearchParams({ no_cia: selectedCompany, punto: selectedPoint }).toString()
        window.open(
          `/print/orden-compra/${encodeURIComponent(noOrden)}?${qs}`,
          '_blank',
          'noopener',
        )
      }
      qc.invalidateQueries({ queryKey: ['odc-ordenes'] })
      nav({ to: '/odc/ordenes' })
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'No se pudo guardar la orden'),
  })

  const puedeGuardar = !!proveedor && lineas.length > 0 &&
    lineas.every((l) => l.cantidad_pedida > 0 && l.costo >= 0 &&
      l.cantidad_pedida >= (l.recibida || 0)) &&
    !guardar.isPending && !(isEdit && editQ.isLoading)

  const formRef = useEnterAdvancesFocus<HTMLDivElement>()

  return (
    <div className="space-y-4" ref={formRef}>
      <div>
        <h3 className="text-base font-semibold">
          {isEdit ? `Editar Orden ODC-${editId}` : 'Entrada de Orden de Compra'}
        </h3>
        {isEdit ? (
          <p className="text-sm text-muted-foreground">
            Editando la orden <b>ODC-{editId}</b>. Se conserva el número y la
            cantidad ya recibida por producto; no puedes pedir menos de lo
            recibido ni quitar un producto con recepción.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Equivale a <i>Fodc201 — Entrada Órdenes de Compras</i>. Inserta cabecera en
            {' '}<code>TODC_ORDEN</code> y líneas en <code>TODC_ORDENL</code>. La orden queda
            {' '}<b>Pendiente</b> hasta que sea autorizada en Procesos → Autorizar.
          </p>
        )}
      </div>

      {/* Cabecera */}
      <div className="rounded border p-4 space-y-3">
        <ProveedorPicker value={proveedor} onChange={setProveedor} />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div>
            <Label className="text-xs">Fecha <span className="text-destructive">*</span></Label>
            <Input type="date" className="h-9" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Fecha entrega</Label>
            <Input type="date" className="h-9" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Tipo orden</Label>
            <Select value={tipoOrden} onValueChange={(v) => setTipoOrden(v as 'I' | 'S')}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="I">Inventariable</SelectItem>
                <SelectItem value="S">Servicios</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Plazo pago (días)</Label>
            <Input type="number" min={0} className="h-9 tabular-nums" value={plazoPago}
              onChange={(e) => setPlazoPago(Number(e.target.value) || 0)} />
          </div>
          <div>
            <Label className="text-xs">Condición pago</Label>
            <Input className="h-9" value={condicionPago} onChange={(e) => setCondicionPago(e.target.value)}
              placeholder="CONTADO / CRÉDITO" />
          </div>
          <div>
            <Label className="text-xs">Localidad</Label>
            <Input className="h-9 font-mono" value={noLocalidad} onChange={(e) => setNoLocalidad(e.target.value)}
              placeholder="cód." />
          </div>
        </div>
        <div>
          <Label className="text-xs">Observaciones</Label>
          <Textarea className="min-h-[60px]" value={detalle} onChange={(e) => setDetalle(e.target.value)}
            placeholder="Notas internas u observaciones del proveedor…" />
        </div>
      </div>

      {/* Líneas */}
      <div className="rounded border">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="text-sm font-medium">Detalle</div>
          <Button size="sm" onClick={() => setPickerOpen(true)} disabled={!proveedor}>
            <Plus className="h-4 w-4 mr-1" /> Agregar producto
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Producto</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="w-24 text-right">Cantidad</TableHead>
                <TableHead className="w-28 text-right">Costo unit.</TableHead>
                <TableHead className="w-20 text-right">% Desc</TableHead>
                <TableHead className="w-20 text-right">% ITBIS</TableHead>
                <TableHead className="w-32 text-right">Total línea</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineas.map((l) => {
                const c = calcLinea(l)
                return (
                  <TableRow key={l.uid}>
                    <TableCell className="font-mono text-xs">{l.no_produ}</TableCell>
                    <TableCell className="truncate max-w-[20rem]">{l.descripcion}</TableCell>
                    <TableCell className="text-right">
                      <Input type="number" min={l.recibida || 0} step="0.01"
                        className="h-8 text-right tabular-nums"
                        title={l.recibida ? `Ya recibido: ${l.recibida}` : undefined}
                        value={l.cantidad_pedida}
                        onChange={(e) => upLinea(l.uid, { cantidad_pedida: Number(e.target.value) || 0 })} />
                      {!!l.recibida && (
                        <span className="block text-[10px] text-muted-foreground">recibido: {l.recibida}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input type="number" min={0} step="0.01" className="h-8 text-right tabular-nums"
                        value={l.costo}
                        onChange={(e) => upLinea(l.uid, { costo: Number(e.target.value) || 0 })} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input type="number" min={0} max={100} step="0.01" className="h-8 text-right tabular-nums"
                        value={l.porc_descuento}
                        onChange={(e) => upLinea(l.uid, { porc_descuento: Number(e.target.value) || 0 })} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input type="number" min={0} max={100} step="0.01" className="h-8 text-right tabular-nums"
                        value={l.porciento_impuesto}
                        onChange={(e) => upLinea(l.uid, { porciento_impuesto: Number(e.target.value) || 0 })} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">RD$ {fmtMoney(c.total)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => rmLinea(l.uid)} title="Quitar línea">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
              {lineas.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                  Sin productos. Selecciona un proveedor y agrega productos a la orden.
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Totales + acciones */}
      <div className="flex items-end justify-between gap-4">
        <Button variant="outline" onClick={() => nav({ to: '/odc/ordenes' })}>Cancelar</Button>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Subtotal</div>
            <div className="tabular-nums">RD$ {fmtMoney(totales.bruto)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Descuento</div>
            <div className="tabular-nums">RD$ {fmtMoney(totales.descuento)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">ITBIS</div>
            <div className="tabular-nums">RD$ {fmtMoney(totales.impuesto)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Total neto</div>
            <div className="text-lg font-semibold tabular-nums">RD$ {fmtMoney(totales.total)}</div>
          </div>
        </div>
        <Button onClick={() => guardar.mutate()} disabled={!puedeGuardar}>
          <Save className="h-4 w-4 mr-1" />
          {guardar.isPending
            ? (isEdit ? 'Actualizando…' : 'Guardando…')
            : (isEdit ? 'Actualizar orden' : 'Guardar orden')}
        </Button>
      </div>

      <BuscarProductoModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(p, cantidad) => addProducto(p, cantidad)}
        noCia={selectedCompany}
        punto={selectedPoint}
        almacenes={almacenes}
        listas={[]}
        noLista=""
        defaultSoloExistencia={false}
      />
    </div>
  )
}
