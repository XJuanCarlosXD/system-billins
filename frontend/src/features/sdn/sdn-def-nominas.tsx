import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { GuardedButton } from '@/components/access'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertTriangle, CalendarCheck2, Pencil, Plus, Save, XCircle,
} from 'lucide-react'

const fmt = (n: any) =>
  Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (s: any) => (s ? String(s).slice(0, 10) : '')

type Nomina = {
  no_cia: string
  punto: string
  nomina: string
  descripcion: string
  forma_pago: string
  fecha_inicial?: string
  fecha_final?: string
  cuenta_contable: string
  cuenta_bancaria?: string | null
  mes_proceso: number
  ano_proceso: number
  mes_cierre: number
  periodo?: number
  factor_calculo_diario?: number
  factor_calculo_horas?: number
  metodo_pago?: number
  gasto_regalia?: string
  regalia_por_pagar?: string
  tipo_moneda?: string
  calculo_nomina: string
  estado: string
  regalia_por_pagar_flag?: string
}

const FORMA_PAGO_LABELS: Record<string, string> = {
  M: 'Mensual', Q: 'Quincenal', S: 'Semanal',
}

const MONEDA_LABELS: Record<string, string> = {
  P: 'RD$', D: 'US$',
}

const today = () => new Date().toISOString().slice(0, 10)
const firstOfMonth = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
const lastOfMonth = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
}

const emptyForm = () => ({
  nomina: '',
  descripcion: '',
  forma_pago: 'M',
  ano_proceso: new Date().getFullYear(),
  mes_proceso: new Date().getMonth() + 1,
  mes_cierre: 12,
  periodo: 1,
  fecha_inicial: firstOfMonth(),
  fecha_final: lastOfMonth(),
  cuenta_contable: '',
  cuenta_bancaria: '',
  factor_calculo_diario: 30,
  factor_calculo_horas: 1,
  metodo_pago: 1,
  gasto_regalia: '',
  regalia_por_pagar: '',
  tipo_moneda: 'P',
})

export function SdnDefNominas() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()

  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState<Nomina | null>(null)
  const [creando, setCreando] = useState(false)
  const [paraAnular, setParaAnular] = useState<Nomina | null>(null)
  const [form, setForm] = useState(emptyForm())

  const nominasQ = useQuery({
    queryKey: ['sdn-nominas', selectedCompany, selectedPoint],
    queryFn: () => api.sdnListNominas({
      no_cia: selectedCompany, punto: selectedPoint, limit: 200,
    }),
  })

  useEffect(() => {
    if (creando) {
      setForm(emptyForm())
    } else if (editando) {
      setForm({
        nomina: editando.nomina,
        descripcion: editando.descripcion,
        forma_pago: editando.forma_pago || 'M',
        ano_proceso: editando.ano_proceso,
        mes_proceso: editando.mes_proceso,
        mes_cierre: editando.mes_cierre,
        periodo: editando.periodo || 1,
        fecha_inicial: fmtDate(editando.fecha_inicial) || firstOfMonth(),
        fecha_final: fmtDate(editando.fecha_final) || lastOfMonth(),
        cuenta_contable: editando.cuenta_contable || '',
        cuenta_bancaria: editando.cuenta_bancaria || '',
        factor_calculo_diario: editando.factor_calculo_diario || 30,
        factor_calculo_horas: editando.factor_calculo_horas || 1,
        metodo_pago: editando.metodo_pago || 1,
        gasto_regalia: editando.gasto_regalia || '',
        regalia_por_pagar: editando.regalia_por_pagar || '',
        tipo_moneda: editando.tipo_moneda || 'P',
      })
    }
  }, [creando, editando])

  const filas: Nomina[] = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return (nominasQ.data || []).filter((n: Nomina) => {
      if (!q) return true
      return (
        (n.nomina || '').toLowerCase().includes(q) ||
        (n.descripcion || '').toLowerCase().includes(q) ||
        String(n.ano_proceso).includes(q)
      )
    })
  }, [nominasQ.data, busqueda])

  const cerrarForm = () => { setCreando(false); setEditando(null) }

  const guardar = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        no_cia: selectedCompany,
        punto: selectedPoint,
        nomina: form.nomina.toUpperCase().trim(),
        descripcion: form.descripcion.trim(),
        cuenta_contable: form.cuenta_contable.trim(),
        cuenta_bancaria: (form.cuenta_bancaria || '').trim() || null,
        gasto_regalia: form.gasto_regalia.trim(),
        regalia_por_pagar: form.regalia_por_pagar.trim(),
      }
      return creando ? api.sdnCrearNomina(payload) : api.sdnActualizarNomina(payload)
    },
    onSuccess: (res: any) => {
      toast.success(creando
        ? `Nómina ${res.nomina} creada`
        : `Nómina ${res.nomina} actualizada`)
      qc.invalidateQueries({ queryKey: ['sdn-nominas'] })
      qc.invalidateQueries({ queryKey: ['sdn-rep-nominas'] })
      cerrarForm()
    },
    onError: (e: any) =>
      toast.error(e?.detail?.error || e?.message || 'No se pudo guardar la nómina'),
  })

  const anular = useMutation({
    mutationFn: () => api.sdnAnularNomina({
      no_cia: paraAnular!.no_cia,
      punto: paraAnular!.punto,
      nomina: paraAnular!.nomina,
    }),
    onSuccess: () => {
      toast.success(`Nómina ${paraAnular!.nomina} dada de baja`)
      qc.invalidateQueries({ queryKey: ['sdn-nominas'] })
      setParaAnular(null)
    },
    onError: (e: any) =>
      toast.error(e?.detail?.error || 'No se pudo dar de baja la nómina'),
  })

  const puedeGuardar = !!form.nomina.trim() && !!form.descripcion.trim()
    && !!form.cuenta_contable.trim() && !!form.gasto_regalia.trim()
    && !!form.regalia_por_pagar.trim()
    && Number(form.ano_proceso) > 1900 && Number(form.mes_proceso) >= 1
    && Number(form.mes_proceso) <= 12

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Definir Nóminas</h3>
          <p className="text-sm text-muted-foreground">
            Mantenimiento de las nóminas activas: período, forma de pago, cuentas contable y
            bancaria. Equivale a <i>Fsdn101 — Definición de Nóminas</i>. Tabla base:{' '}
            <code>TSDN_NOMINA</code>.
          </p>
        </div>
        <Button onClick={() => { cerrarForm(); setCreando(true) }}>
          <Plus className="h-4 w-4 mr-1" /> Nueva nómina
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1 flex-1 min-w-64">
          <Label className="text-xs">Buscar</Label>
          <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                 placeholder="Código, descripción o año" className="h-9" />
        </div>
        <div className="text-sm text-muted-foreground">{filas.length} nóminas</div>
      </div>

      <div className="rounded border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Código</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="w-28">Forma pago</TableHead>
              <TableHead className="w-28">Período</TableHead>
              <TableHead className="w-32">Fecha inicial</TableHead>
              <TableHead className="w-32">Fecha final</TableHead>
              <TableHead>Cuenta contable</TableHead>
              <TableHead className="w-24">Estado</TableHead>
              <TableHead className="w-28">Cálculo</TableHead>
              <TableHead className="w-40 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nominasQ.isLoading ? (
              <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                Cargando nóminas…
              </TableCell></TableRow>
            ) : filas.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                No hay nóminas para la empresa/punto seleccionado.
              </TableCell></TableRow>
            ) : (
              filas.map((n) => (
                <TableRow key={`${n.punto}-${n.nomina}`}>
                  <TableCell className="font-mono">{n.nomina}</TableCell>
                  <TableCell>{n.descripcion}</TableCell>
                  <TableCell>{FORMA_PAGO_LABELS[n.forma_pago] || n.forma_pago}</TableCell>
                  <TableCell className="tabular-nums">
                    {String(n.mes_proceso).padStart(2, '0')}/{n.ano_proceso}
                  </TableCell>
                  <TableCell>{fmtDate(n.fecha_inicial)}</TableCell>
                  <TableCell>{fmtDate(n.fecha_final)}</TableCell>
                  <TableCell className="font-mono text-xs">{n.cuenta_contable}</TableCell>
                  <TableCell>
                    {n.estado === 'A'
                      ? <Badge>Activa</Badge>
                      : <Badge variant="destructive">Inactiva</Badge>}
                  </TableCell>
                  <TableCell>
                    {n.calculo_nomina === 'S'
                      ? <Badge variant="outline">Calculada</Badge>
                      : <Badge variant="secondary">Pendiente</Badge>}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="outline"
                            onClick={() => { setCreando(false); setEditando(n) }}
                            disabled={n.calculo_nomina === 'S' || n.estado !== 'A'}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <GuardedButton modulo="sdn" flag="CREAR_NOMINA" noCia={n.no_cia} punto={n.punto}
                            size="sm" variant="destructive" onClick={() => setParaAnular(n)}
                            disabled={n.calculo_nomina === 'S' || n.estado !== 'A'}>
                      <XCircle className="h-4 w-4" />
                    </GuardedButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={creando || !!editando} onOpenChange={(v) => { if (!v) cerrarForm() }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarCheck2 className="h-4 w-4" />
              {creando ? 'Nueva nómina' : `Editar nómina ${editando?.nomina}`}
            </DialogTitle>
          </DialogHeader>
          <Card className="border-0 shadow-none">
            <CardHeader className="pb-2 px-0">
              <CardTitle className="text-sm text-muted-foreground">
                {creando
                  ? 'Define una nueva nómina para el período en curso.'
                  : 'Modificar definición. Solo se permite si la nómina no ha sido calculada.'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-0">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Código *</Label>
                  <Input value={form.nomina}
                         onChange={(e) => setForm({ ...form, nomina: e.target.value.toUpperCase().slice(0, 2) })}
                         disabled={!!editando}
                         className="h-9 font-mono uppercase" maxLength={2}
                         placeholder="AD" />
                </div>
                <div className="space-y-1 md:col-span-3">
                  <Label className="text-xs">Descripción *</Label>
                  <Input value={form.descripcion}
                         onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                         className="h-9"
                         placeholder="ADMINISTRATIVA" maxLength={40} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Forma de pago *</Label>
                  <Select value={form.forma_pago}
                          onValueChange={(v) => setForm({ ...form, forma_pago: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Mensual</SelectItem>
                      <SelectItem value="Q">Quincenal</SelectItem>
                      <SelectItem value="S">Semanal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Moneda</Label>
                  <Select value={form.tipo_moneda}
                          onValueChange={(v) => setForm({ ...form, tipo_moneda: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="P">RD$ — Pesos</SelectItem>
                      <SelectItem value="D">US$ — Dólares</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Año *</Label>
                  <Input type="number" min="2000" max="2100"
                         className="h-9 tabular-nums"
                         value={form.ano_proceso}
                         onChange={(e) => setForm({ ...form, ano_proceso: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Mes *</Label>
                  <Input type="number" min="1" max="12"
                         className="h-9 tabular-nums"
                         value={form.mes_proceso}
                         onChange={(e) => setForm({ ...form, mes_proceso: Number(e.target.value) })} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Período</Label>
                  <Input type="number" min="1" max="4"
                         className="h-9 tabular-nums"
                         value={form.periodo}
                         onChange={(e) => setForm({ ...form, periodo: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fecha inicial *</Label>
                  <Input type="date" className="h-9"
                         value={form.fecha_inicial}
                         onChange={(e) => setForm({ ...form, fecha_inicial: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fecha final *</Label>
                  <Input type="date" className="h-9"
                         value={form.fecha_final}
                         onChange={(e) => setForm({ ...form, fecha_final: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Mes de cierre</Label>
                  <Input type="number" min="1" max="12"
                         className="h-9 tabular-nums"
                         value={form.mes_cierre}
                         onChange={(e) => setForm({ ...form, mes_cierre: Number(e.target.value) })} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Cuenta contable de nómina *</Label>
                  <Input value={form.cuenta_contable}
                         onChange={(e) => setForm({ ...form, cuenta_contable: e.target.value })}
                         className="h-9 font-mono"
                         placeholder="0000000000000000000000" maxLength={24} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cuenta bancaria</Label>
                  <Input value={form.cuenta_bancaria || ''}
                         onChange={(e) => setForm({ ...form, cuenta_bancaria: e.target.value })}
                         className="h-9 font-mono"
                         placeholder="Opcional" maxLength={24} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Cuenta gasto regalía *</Label>
                  <Input value={form.gasto_regalia}
                         onChange={(e) => setForm({ ...form, gasto_regalia: e.target.value })}
                         className="h-9 font-mono" maxLength={24} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cuenta regalía por pagar *</Label>
                  <Input value={form.regalia_por_pagar}
                         onChange={(e) => setForm({ ...form, regalia_por_pagar: e.target.value })}
                         className="h-9 font-mono" maxLength={24} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Factor diario</Label>
                  <Input type="number" min="1" max="31" step="1"
                         className="h-9 tabular-nums"
                         value={form.factor_calculo_diario}
                         onChange={(e) => setForm({ ...form, factor_calculo_diario: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Factor horas</Label>
                  <Input type="number" min="0" step="0.01"
                         className="h-9 tabular-nums"
                         value={form.factor_calculo_horas}
                         onChange={(e) => setForm({ ...form, factor_calculo_horas: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Método de pago</Label>
                  <Select value={String(form.metodo_pago)}
                          onValueChange={(v) => setForm({ ...form, metodo_pago: Number(v) })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 — Transferencia</SelectItem>
                      <SelectItem value="2">2 — Cheque</SelectItem>
                      <SelectItem value="3">3 — Efectivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
          <DialogFooter>
            <Button variant="outline" onClick={cerrarForm} disabled={guardar.isPending}>
              Cancelar
            </Button>
            <Button onClick={() => guardar.mutate()}
                    disabled={!puedeGuardar || guardar.isPending}>
              <Save className="h-4 w-4 mr-1" />
              {guardar.isPending ? 'Guardando…' : creando ? 'Crear nómina' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!paraAnular} onOpenChange={(v) => { if (!v) setParaAnular(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Dar de baja nómina {paraAnular?.nomina}
            </DialogTitle>
          </DialogHeader>
          {paraAnular && (
            <div className="space-y-3 text-sm">
              <div className="rounded border border-destructive/40 bg-destructive/5 p-3 text-destructive">
                La nómina dejará de estar disponible para nuevos cálculos. Esta acción
                no borra los datos históricos.
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Descripción: </span>
                  {paraAnular.descripcion}</div>
                <div><span className="text-muted-foreground">Período: </span>
                  <span className="tabular-nums">
                    {String(paraAnular.mes_proceso).padStart(2, '0')}/{paraAnular.ano_proceso}
                  </span></div>
                <div><span className="text-muted-foreground">Empleados: </span>
                  <span className="text-xs">Se conservan en su última nómina</span></div>
                <div><span className="text-muted-foreground">Moneda: </span>
                  {MONEDA_LABELS[paraAnular.tipo_moneda || 'P']}</div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setParaAnular(null)} disabled={anular.isPending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => anular.mutate()} disabled={anular.isPending}>
              <XCircle className="h-4 w-4 mr-1" />
              {anular.isPending ? 'Procesando…' : 'Confirmar baja'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
