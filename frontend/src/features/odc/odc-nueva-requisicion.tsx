import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useNavigate } from '@tanstack/react-router'
import { api, regalGeneralApi } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
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
import { Plus, Trash2, Save } from 'lucide-react'

// Fodc205 / Fodc206 — Entrada de Requisición Interna.
// Tabla cabecera TODC_REQUISICION + detalle TODC_REQUISICIONL.
// No requiere proveedor; sólo productos, cantidad y observación.

interface Producto {
  no_produ: string
  descri: string
  porciento_impuesto: number
  precio: number
}

interface Linea {
  uid: string
  no_produ: string
  descripcion: string
  cantidad_pedida: number
  nota: string
}

const today = () => new Date().toISOString().slice(0, 10)

function ProductoPickerDialog({
  open, onClose, onPick, noCia, punto,
}: {
  open: boolean; onClose: () => void; onPick: (p: Producto) => void
  noCia: string; punto: string
}) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Producto[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) { setSearch(''); setResults([]); setTimeout(() => ref.current?.focus(), 50) }
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
      <DialogContent className="flex h-[70vh] w-[60vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="py-12 text-center text-gray-400">
                    {loading ? 'Buscando…' : search ? 'Sin resultados' : 'Escriba código o descripción'}
                  </TableCell>
                </TableRow>
              )}
              {results.map((p) => (
                <TableRow key={p.no_produ} className="cursor-pointer hover:bg-blue-50"
                  onDoubleClick={() => onPick(p)} onClick={() => onPick(p)}>
                  <TableCell className="font-mono font-semibold">{p.no_produ}</TableCell>
                  <TableCell>{p.descri}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function OdcNuevaRequisicion() {
  const nav = useNavigate()
  const { selectedCompany, selectedPoint } = useCompany()

  const [fecha, setFecha] = useState(today())
  const [fechaEntrega, setFechaEntrega] = useState(today())
  const [noLocalidad, setNoLocalidad] = useState('')
  const [noDepto, setNoDepto] = useState('')
  const [detalle, setDetalle] = useState('')

  const [lineas, setLineas] = useState<Linea[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)

  const addProducto = (p: Producto) => {
    setLineas((prev) => [...prev, {
      uid: `${p.no_produ}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      no_produ: p.no_produ,
      descripcion: p.descri,
      cantidad_pedida: 1,
      nota: '',
    }])
    setPickerOpen(false)
  }

  const upLinea = (uid: string, patch: Partial<Linea>) =>
    setLineas((prev) => prev.map((l) => l.uid === uid ? { ...l, ...patch } : l))

  const rmLinea = (uid: string) => setLineas((prev) => prev.filter((l) => l.uid !== uid))

  const guardar = useMutation({
    mutationFn: () => api.odcCrearRequisicion({
      no_cia: selectedCompany,
      punto: selectedPoint,
      cabecera: {
        fecha, fecha_entrega: fechaEntrega,
        tipo_requisicion: 'I',
        no_localidad: noLocalidad || undefined,
        no_depto: noDepto || undefined,
        detalle: detalle || undefined,
      },
      lineas: lineas.map((l) => ({
        no_produ: l.no_produ,
        cantidad_pedida: l.cantidad_pedida,
        nota: l.nota || undefined,
      })),
    }),
    onSuccess: (res) => {
      toast.success(`Requisición REQ-${res.no_requisicion} creada`)
      nav({ to: '/odc/requisiciones' })
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'No se pudo guardar la requisición'),
  })

  const puedeGuardar = lineas.length > 0 &&
    lineas.every((l) => l.cantidad_pedida > 0 && !!l.no_produ) && !guardar.isPending

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Entrada de Requisición Interna</h3>
        <p className="text-sm text-muted-foreground">
          Equivale a <i>Fodc205/206 — Entrada de Requisición</i>. Solicitud interna de
          productos que luego será autorizada (hasta 3 firmas) y consolidada en una orden
          de compra. Persiste en <code>TODC_REQUISICION</code> / <code>TODC_REQUISICIONL</code>.
        </p>
      </div>

      <div className="rounded border p-4 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Fecha <span className="text-destructive">*</span></Label>
            <Input type="date" className="h-9" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Fecha requerida</Label>
            <Input type="date" className="h-9" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Localidad</Label>
            <Input className="h-9 font-mono" value={noLocalidad} onChange={(e) => setNoLocalidad(e.target.value)}
              placeholder="cód." />
          </div>
          <div>
            <Label className="text-xs">Departamento</Label>
            <Input className="h-9 font-mono" value={noDepto} onChange={(e) => setNoDepto(e.target.value)}
              placeholder="cód." />
          </div>
        </div>
        <div>
          <Label className="text-xs">Justificación / observaciones</Label>
          <Textarea className="min-h-[60px]" value={detalle} onChange={(e) => setDetalle(e.target.value)}
            placeholder="Por qué se solicita…" />
        </div>
      </div>

      <div className="rounded border">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="text-sm font-medium">Productos solicitados</div>
          <Button size="sm" onClick={() => setPickerOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Agregar producto
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Producto</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="w-28 text-right">Cantidad</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineas.map((l) => (
                <TableRow key={l.uid}>
                  <TableCell className="font-mono text-xs">{l.no_produ}</TableCell>
                  <TableCell className="truncate max-w-[20rem]">{l.descripcion}</TableCell>
                  <TableCell className="text-right">
                    <Input type="number" min={0} step="0.01" className="h-8 text-right tabular-nums"
                      value={l.cantidad_pedida}
                      onChange={(e) => upLinea(l.uid, { cantidad_pedida: Number(e.target.value) || 0 })} />
                  </TableCell>
                  <TableCell>
                    <Input className="h-8" value={l.nota}
                      onChange={(e) => upLinea(l.uid, { nota: e.target.value })}
                      placeholder="Observación…" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => rmLinea(l.uid)} title="Quitar línea">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {lineas.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                  Sin productos. Agrega al menos uno para guardar la requisición.
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => nav({ to: '/odc/requisiciones' })}>Cancelar</Button>
        <div className="text-sm text-muted-foreground">
          {lineas.length} producto{lineas.length !== 1 ? 's' : ''} solicitado{lineas.length !== 1 ? 's' : ''}
        </div>
        <Button onClick={() => guardar.mutate()} disabled={!puedeGuardar}>
          <Save className="h-4 w-4 mr-1" />
          {guardar.isPending ? 'Guardando…' : 'Guardar requisición'}
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
