import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useNavigate } from '@tanstack/react-router'
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
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Search, Plus, Trash2, Save } from 'lucide-react'
import { CrearProductoModal } from '@/features/fat/components/crear-producto-modal'

// Fodc201 — Entrada de Orden de Compra (legacy).
// Cabecera (TODC_ORDEN) + Detalle (TODC_ORDENL).
// Patrón equivalente a CxP/FAT nueva-factura: picker proveedor + picker producto.

interface Proveedor {
  no_proveedor: string
  nombre: string
  rnc: string
  direccion: string
}

interface Producto {
  no_produ: string
  descri: string
  precio: number
  porciento_impuesto: number
}

interface Linea {
  uid: string
  no_produ: string
  descripcion: string
  cantidad_pedida: number
  costo: number
  porc_descuento: number
  porciento_impuesto: number
}

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

// ─── Picker de Proveedor ──────────────────────────────────────────────────────
function ProveedorPicker({
  value, onChange,
}: { value: Proveedor | null; onChange: (p: Proveedor | null) => void }) {
  const [codigo, setCodigo] = useState(value?.no_proveedor ?? '')
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Proveedor[]>([])
  const [searching, setSearching] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setCodigo(value?.no_proveedor ?? '') }, [value?.no_proveedor])

  const cargar = async (cod: string) => {
    const t = cod.trim()
    if (!t) { onChange(null); return }
    try {
      const p = await api.cxpGetProveedor(t)
      if (p?.no_proveedor) onChange(p)
      else { toast.error(`Proveedor ${t} no encontrado`); onChange(null) }
    } catch { toast.error(`Proveedor ${t} no encontrado`); onChange(null) }
  }

  const buscar = async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const rows = await api.cxpListProveedores({ search: q, activo: 'S' })
      setResults(rows)
    } catch { setResults([]) } finally { setSearching(false) }
  }

  const aplicar = (p: Proveedor) => {
    onChange(p); setOpen(false); setSearch(''); setResults([])
  }

  return (
    <div className="flex items-end gap-2">
      <div className="w-36">
        <Label className="text-xs">Código Proveedor <span className="text-destructive">*</span></Label>
        <Input
          value={codigo}
          onChange={(e) => { setCodigo(e.target.value); if (value) onChange(null) }}
          onBlur={(e) => cargar(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') cargar(codigo) }}
          placeholder="Código"
          className="h-10 font-mono"
        />
      </div>
      <Button type="button" variant="outline" className="h-10"
        onClick={() => { setOpen(true); setTimeout(() => searchRef.current?.focus(), 50) }}>
        <Search className="h-4 w-4" />
      </Button>
      {value ? (
        <div className="flex flex-1 flex-wrap items-center gap-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2">
          <div className="min-w-0">
            <span className="block text-xs font-medium text-emerald-600">Nombre</span>
            <span className="block truncate font-semibold text-emerald-900">{value.nombre}</span>
          </div>
          {value.rnc && (
            <div className="shrink-0">
              <span className="block text-xs font-medium text-emerald-600">RNC / Cédula</span>
              <span className="font-mono text-sm text-emerald-800">{value.rnc}</span>
            </div>
          )}
          {value.direccion && (
            <div className="min-w-0">
              <span className="block text-xs font-medium text-emerald-600">Dirección</span>
              <span className="block truncate text-sm text-emerald-700">{value.direccion}</span>
            </div>
          )}
          <Button size="sm" variant="ghost" onClick={() => { onChange(null); setCodigo('') }}
            className="ml-auto text-gray-400 hover:text-red-500">Cambiar</Button>
        </div>
      ) : (
        <div className="flex h-10 flex-1 items-center rounded-lg border border-dashed border-gray-300 px-3 text-sm text-gray-400">
          Ingrese código o use la lupa para buscar
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="picker">
          <DialogHeader className="border-b px-6 py-4"><DialogTitle>Buscar Proveedor</DialogTitle></DialogHeader>
          <div className="border-b bg-background px-6 py-3">
            <Input ref={searchRef} value={search}
              onChange={(e) => { setSearch(e.target.value); buscar(e.target.value) }}
              placeholder="Nombre, código o RNC…" className="h-11 text-base" autoFocus />
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="w-32">Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="w-36">RNC / Cédula</TableHead>
                  <TableHead className="w-64">Dirección</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-12 text-center text-gray-400">
                      {searching ? 'Buscando…' : search.length >= 2 ? 'Sin resultados' : 'Escriba al menos 2 caracteres'}
                    </TableCell>
                  </TableRow>
                )}
                {results.map((p) => (
                  <TableRow key={p.no_proveedor} className="cursor-pointer hover:bg-blue-50"
                    onDoubleClick={() => aplicar(p)} onClick={() => aplicar(p)}>
                    <TableCell className="font-mono font-semibold">{p.no_proveedor}</TableCell>
                    <TableCell className="font-medium">{p.nombre}</TableCell>
                    <TableCell className="font-mono text-sm">{p.rnc || '—'}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-gray-600">{p.direccion || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Picker de Producto (modal) ───────────────────────────────────────────────
function ProductoPickerDialog({
  open, onClose, onPick, noCia, punto,
}: {
  open: boolean
  onClose: () => void
  onPick: (p: Producto) => void
  noCia: string
  punto: string
}) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Producto[]>([])
  const [loading, setLoading] = useState(false)
  const [crearOpen, setCrearOpen] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) { setSearch(''); setResults([]); setCrearOpen(false); setTimeout(() => ref.current?.focus(), 50) }
  }, [open])

  const buscar = async (q: string) => {
    setLoading(true)
    try {
      const data = await regalGeneralApi.fatSearchProductos(noCia, punto, '', q, 1, 30)
      setResults(data.items)
    } catch { setResults([]) } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent size="picker">
        <DialogHeader className="border-b px-6 py-4"><DialogTitle>Buscar Producto</DialogTitle></DialogHeader>
        <div className="border-b bg-background px-6 py-3">
          <Input ref={ref} value={search}
            onChange={(e) => { setSearch(e.target.value); buscar(e.target.value) }}
            placeholder="Código o descripción…" className="h-11 text-base" autoFocus />
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-2">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="w-32">Código</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="w-32 text-right">Precio sug.</TableHead>
                <TableHead className="w-24 text-right">ITBIS %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-12 text-center text-gray-400">
                    <p>{loading ? 'Buscando…' : search ? 'Sin resultados' : 'Escriba código o descripción'}</p>
                    {!loading && search && (
                      <Button variant="link" className="mt-2" onClick={() => setCrearOpen(true)}>
                        Crear producto "{search}" →
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )}
              {results.map((p) => (
                <TableRow key={p.no_produ} className="cursor-pointer hover:bg-blue-50"
                  onDoubleClick={() => onPick(p)} onClick={() => onPick(p)}>
                  <TableCell className="font-mono font-semibold">{p.no_produ}</TableCell>
                  <TableCell>{p.descri}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtMoney(p.precio)}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.porciento_impuesto}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>

      {crearOpen && (
        <CrearProductoModal
          open={crearOpen}
          onClose={() => setCrearOpen(false)}
          noCia={noCia}
          descripcionInicial={search}
          onCreated={(p) => {
            setCrearOpen(false)
            onPick({
              no_produ: p.no_produ,
              descri: p.descri,
              precio: p.costo,
              porciento_impuesto: p.porciento_impuesto,
            })
          }}
        />
      )}
    </Dialog>
  )
}

// ─── Vista principal ──────────────────────────────────────────────────────────
export function OdcNuevaOrden() {
  const nav = useNavigate()
  const { selectedCompany, selectedPoint } = useCompany()

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

  const totales = lineas.reduce((acc, l) => {
    const c = calcLinea(l)
    acc.bruto += c.bruto; acc.descuento += c.desc; acc.impuesto += c.imp; acc.total += c.total
    return acc
  }, { bruto: 0, descuento: 0, impuesto: 0, total: 0 })

  const addProducto = (p: Producto) => {
    setLineas((prev) => [...prev, {
      uid: `${p.no_produ}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      no_produ: p.no_produ,
      descripcion: p.descri,
      cantidad_pedida: 1,
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
    mutationFn: () => api.odcCrearOrden({
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
    }),
    onSuccess: (res) => {
      toast.success(`Orden ODC-${res.no_orden} creada`)
      const qs = new URLSearchParams({ no_cia: selectedCompany, punto: selectedPoint }).toString()
      window.open(
        `/print/orden-compra/${encodeURIComponent(res.no_orden)}?${qs}`,
        '_blank',
        'noopener',
      )
      nav({ to: '/odc/ordenes' })
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'No se pudo guardar la orden'),
  })

  const puedeGuardar = !!proveedor && lineas.length > 0 &&
    lineas.every((l) => l.cantidad_pedida > 0 && l.costo >= 0) && !guardar.isPending

  const formRef = useEnterAdvancesFocus<HTMLDivElement>()

  return (
    <div className="space-y-4" ref={formRef}>
      <div>
        <h3 className="text-base font-semibold">Entrada de Orden de Compra</h3>
        <p className="text-sm text-muted-foreground">
          Equivale a <i>Fodc201 — Entrada Órdenes de Compras</i>. Inserta cabecera en
          {' '}<code>TODC_ORDEN</code> y líneas en <code>TODC_ORDENL</code>. La orden queda
          {' '}<b>Pendiente</b> hasta que sea autorizada en Procesos → Autorizar.
        </p>
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
                      <Input type="number" min={0} step="0.01" className="h-8 text-right tabular-nums"
                        value={l.cantidad_pedida}
                        onChange={(e) => upLinea(l.uid, { cantidad_pedida: Number(e.target.value) || 0 })} />
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
          {guardar.isPending ? 'Guardando…' : 'Guardar orden'}
        </Button>
      </div>

      <ProductoPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addProducto}
        noCia={selectedCompany}
        punto={selectedPoint}
      />
    </div>
  )
}
