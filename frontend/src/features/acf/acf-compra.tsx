// ACF — Compra de Activo Fijo (Facf201).
// Registra una fila en TACF_ACTIVOS + documento de tipo 'C' en TACF_DOCUMENTO.
import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { useEnterAdvancesFocus } from '@/hooks/use-enter-advances-focus'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Search, Save, Package, Printer } from 'lucide-react'

const fmt = (n: any) =>
  Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type Proveedor = { no_proveedor: string; nombre: string; rnc?: string }

function ProveedorPicker({
  value, onChange,
}: { value: Proveedor | null; onChange: (p: Proveedor | null) => void }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const q = useQuery({
    queryKey: ['acf-prov-pick', search],
    queryFn: () => api.cxpListProveedores({ activo: 'S', search }),
    enabled: open,
  })
  return (
    <div className="space-y-1">
      <Label className="text-xs">Proveedor</Label>
      <div className="flex items-center gap-2">
        <Input value={value?.no_proveedor ?? ''} readOnly placeholder="—"
               className="h-9 w-32 font-mono" />
        <Button type="button" variant="outline" size="sm" className="h-9"
                onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}>
          <Search className="h-4 w-4" />
        </Button>
        {value ? (
          <div className="flex flex-1 flex-wrap items-center gap-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm">
            <div className="min-w-0">
              <div className="text-[10px] uppercase text-emerald-600">Nombre</div>
              <div className="truncate font-medium text-emerald-900">{value.nombre}</div>
            </div>
            {value.rnc && (
              <div>
                <div className="text-[10px] uppercase text-emerald-600">RNC</div>
                <div className="font-mono text-emerald-800">{value.rnc}</div>
              </div>
            )}
            <Button type="button" size="sm" variant="ghost"
                    className="ml-auto text-muted-foreground hover:text-destructive"
                    onClick={() => onChange(null)}>Cambiar</Button>
          </div>
        ) : (
          <div className="flex h-9 flex-1 items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground">
            Opcional. Usa la lupa para buscar.
          </div>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="picker">
          <DialogHeader className="shrink-0 border-b px-6 py-4"><DialogTitle>Buscar Proveedor</DialogTitle></DialogHeader>
          <div className="shrink-0 border-b bg-background px-6 py-3">
            <Input ref={inputRef} value={search} onChange={(e) => setSearch(e.target.value)}
                   placeholder="Nombre, código o RNC…" className="h-11 text-base" autoFocus />
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background"><TableRow>
                <TableHead className="w-24">Código</TableHead><TableHead>Nombre</TableHead>
                <TableHead className="w-36">RNC</TableHead><TableHead className="w-24 text-center">Acción</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(q.data || []).length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                    {q.isFetching ? 'Buscando…' : 'Sin resultados'}
                  </TableCell></TableRow>
                ) : (q.data || []).map((p: any) => (
                  <TableRow key={p.no_proveedor} className="cursor-pointer hover:bg-muted/40"
                            onClick={() => { onChange(p); setOpen(false); setSearch('') }}>
                    <TableCell className="font-mono text-xs">{p.no_proveedor}</TableCell>
                    <TableCell>{p.nombre}</TableCell>
                    <TableCell className="font-mono text-xs">{p.rnc || ''}</TableCell>
                    <TableCell className="text-center"><Button size="sm" variant="outline">Elegir</Button></TableCell>
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

export function AcfCompra() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()

  const catQ = useQuery({ queryKey: ['acf-cats'], queryFn: () => api.acfListCategorias() })
  const grpQ = useQuery({ queryKey: ['acf-grupos'], queryFn: () => api.acfListGrupos() })
  const subQ = useQuery({ queryKey: ['acf-subgs'], queryFn: () => api.acfListSubgrupos() })
  const mrkQ = useQuery({ queryKey: ['acf-marcas'], queryFn: () => api.acfListMarcas() })
  const respQ = useQuery({ queryKey: ['acf-resps'], queryFn: () => api.acfListResponsables() })
  const depQ = useQuery({ queryKey: ['acf-depts'], queryFn: () => api.acfListDepartamentos() })

  const [descripcion, setDescripcion] = useState('')
  const [tipoContable, setTipoContable] = useState('')
  const [tipo, setTipo] = useState('')
  const [grupo, setGrupo] = useState('')
  const [subgrupo, setSubgrupo] = useState('')
  const [marca, setMarca] = useState<string | undefined>(undefined)
  const [responsable, setResponsable] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [proveedor, setProveedor] = useState<Proveedor | null>(null)
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [valor, setValor] = useState('')
  const [duracion, setDuracion] = useState('5')
  const [depreciable, setDepreciable] = useState<'S' | 'N'>('S')
  const [anoModelo, setAnoModelo] = useState('')
  const [serie, setSerie] = useState('')
  const [cuenta, setCuenta] = useState('')
  const [detalle, setDetalle] = useState('')
  const [ultimoDocu, setUltimoDocu] = useState<{ no_docu: string; no_activo: string } | null>(null)

  const reset = () => {
    setDescripcion(''); setTipoContable(''); setTipo(''); setGrupo(''); setSubgrupo('')
    setMarca(undefined); setResponsable(''); setDepartamento(''); setProveedor(null)
    setFecha(new Date().toISOString().slice(0, 10)); setValor(''); setDuracion('5')
    setDepreciable('S'); setAnoModelo(''); setSerie(''); setCuenta(''); setDetalle('')
  }

  const crear = useMutation({
    mutationFn: () => api.acfCrearCompra({
      no_cia: selectedCompany,
      punto: selectedPoint,
      descripcion: descripcion.trim(),
      tipo_contable: tipoContable,
      tipo, grupo, subgrupo,
      responsable, departamento,
      marca: marca || undefined,
      ano_modelo: anoModelo ? Number(anoModelo) : undefined,
      serie: serie.trim() || undefined,
      no_proveedor: proveedor?.no_proveedor,
      fecha_compra: fecha,
      valor_original: Number(valor),
      duracion_ano: Number(duracion || 0),
      depreciable,
      cuenta: cuenta.trim(),
      detalle: detalle.trim() || undefined,
    }),
    onSuccess: (res) => {
      toast.success(`Activo ${res.no_activo} registrado por RD$ ${fmt(valor)}`)
      qc.invalidateQueries({ queryKey: ['acf-act'] })
      qc.invalidateQueries({ queryKey: ['acf-res'] })
      setUltimoDocu({ no_docu: res.no_docu, no_activo: res.no_activo })
      reset()
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'No se pudo registrar el activo'),
  })

  const formRef = useEnterAdvancesFocus<HTMLDivElement>()
  const valorNum = Number(valor || 0)
  const puedeGuardar = !!selectedCompany && !!selectedPoint && !!descripcion && !!tipoContable
    && !!tipo && !!grupo && !!subgrupo && !!responsable && !!departamento
    && !!fecha && valorNum > 0 && !!cuenta

  return (
    <div className="space-y-4" ref={formRef}>
      <div>
        <h3 className="text-base font-semibold">Compra de Activo Fijo</h3>
        <p className="text-sm text-muted-foreground">
          Da de alta un activo desde la factura del proveedor. Equivale a{' '}
          <i>Facf201 — Compra de Activos</i>. Tablas: <code>TACF_ACTIVOS</code> + <code>TACF_DOCUMENTO</code>.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">
          <Package className="h-4 w-4" /> Datos del activo
        </CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Descripción *</Label>
              <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
                     placeholder="Ej. Laptop Dell Latitude 5440" className="h-9" maxLength={50} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fecha de compra *</Label>
              <Input type="date" className="h-9" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Categoría contable *</Label>
              <Select value={tipoContable} onValueChange={setTipoContable}>
                <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {(catQ.data || []).map((c: any) => (
                    <SelectItem key={c.tipo_contable || c.codigo}
                                value={c.tipo_contable || c.codigo}>
                      {(c.tipo_contable || c.codigo)} — {c.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo *</Label>
              <Input value={tipo} onChange={(e) => setTipo(e.target.value.toUpperCase())}
                     className="h-9 font-mono" maxLength={3} placeholder="Ej. EQI" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Grupo *</Label>
              <Select value={grupo} onValueChange={setGrupo}>
                <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {(grpQ.data || []).map((g: any) => (
                    <SelectItem key={g.grupo || g.codigo} value={g.grupo || g.codigo}>
                      {(g.grupo || g.codigo)} — {g.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Subgrupo *</Label>
              <Select value={subgrupo} onValueChange={setSubgrupo}>
                <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {(subQ.data || []).map((s: any) => (
                    <SelectItem key={s.subgrupo || s.codigo} value={s.subgrupo || s.codigo}>
                      {(s.subgrupo || s.codigo)} — {s.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Responsable *</Label>
              <Select value={responsable} onValueChange={setResponsable}>
                <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {(respQ.data || []).map((r: any) => (
                    <SelectItem key={r.responsable || r.codigo} value={r.responsable || r.codigo}>
                      {(r.responsable || r.codigo)} — {r.nombre || r.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Departamento *</Label>
              <Select value={departamento} onValueChange={setDepartamento}>
                <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {(depQ.data || []).map((d: any) => (
                    <SelectItem key={d.departamento || d.codigo} value={d.departamento || d.codigo}>
                      {(d.departamento || d.codigo)} — {d.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Marca</Label>
              <Select value={marca || ''} onValueChange={(v) => setMarca(v || undefined)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {(mrkQ.data || []).map((m: any) => (
                    <SelectItem key={m.marca || m.codigo} value={m.marca || m.codigo}>
                      {(m.marca || m.codigo)} — {m.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ProveedorPicker value={proveedor} onChange={setProveedor} />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Valor original (RD$) *</Label>
              <Input type="number" min="0.01" step="0.01" className="h-9 text-right tabular-nums"
                     value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Duración (años)</Label>
              <Input type="number" min="0" step="1" className="h-9 text-right tabular-nums"
                     value={duracion} onChange={(e) => setDuracion(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">¿Depreciable?</Label>
              <Select value={depreciable} onValueChange={(v) => setDepreciable(v as 'S' | 'N')}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="S">Sí</SelectItem>
                  <SelectItem value="N">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Año modelo</Label>
              <Input type="number" min="1900" max="2100" className="h-9 text-right tabular-nums"
                     value={anoModelo} onChange={(e) => setAnoModelo(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Cuenta contable activo *</Label>
              <Input value={cuenta} onChange={(e) => setCuenta(e.target.value)}
                     placeholder="Ej. 1.2.01.0001" className="h-9 font-mono" maxLength={24} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Serie / Placa</Label>
              <Input value={serie} onChange={(e) => setSerie(e.target.value)}
                     placeholder="Ej. ABC123XYZ" className="h-9 font-mono" maxLength={30} />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Detalle</Label>
            <Input value={detalle} onChange={(e) => setDetalle(e.target.value)}
                   placeholder="Notas adicionales" className="h-9" maxLength={100} />
          </div>

          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm flex flex-wrap gap-x-6 gap-y-1">
            <span><span className="text-muted-foreground">Valor: </span>
              <span className="tabular-nums font-medium">RD$ {fmt(valorNum)}</span></span>
            {depreciable === 'S' && Number(duracion) > 0 && (
              <span><span className="text-muted-foreground">Depreciación mensual estimada: </span>
                <span className="tabular-nums">RD$ {fmt(valorNum / (Number(duracion) * 12))}</span></span>
            )}
          </div>

          {ultimoDocu && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm flex items-center justify-between">
              <div>
                <span className="text-emerald-700">Último registrado: </span>
                <b>Activo {ultimoDocu.no_activo}</b> · doc CP-{ultimoDocu.no_docu}
              </div>
              <Button type="button" variant="outline" size="sm"
                      onClick={() => window.open(
                        `/print/comprobante-compra-acf/${encodeURIComponent(ultimoDocu.no_docu)}?no_cia=${selectedCompany}&punto=${selectedPoint}`,
                        '_blank')}>
                <Printer className="h-4 w-4 mr-1" /> Imprimir comprobante
              </Button>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t pt-3">
            <Button type="button" variant="outline" onClick={reset} disabled={crear.isPending}>
              Limpiar
            </Button>
            <Button type="button" onClick={() => crear.mutate()}
                    disabled={!puedeGuardar || crear.isPending}>
              <Save className="h-4 w-4 mr-1" />
              {crear.isPending ? 'Guardando…' : 'Registrar activo'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
