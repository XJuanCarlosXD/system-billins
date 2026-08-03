// SDN — Mantenimiento de Empleados (Fsdn117).
// Alta y baja de empleados sobre SDN.TSDN_EMPLEADO. La baja es lógica
// (fecha_egreso) — igual que el legado, nunca se borra el registro porque
// queda enlazado a movimientos y cálculos históricos de nómina.
import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Eye, Search, Plus, UserX, UserCheck } from 'lucide-react'
import { toast } from 'sonner'

const fmtDate = (s: any) => s ? String(s).slice(0, 10) : ''
const today = () => new Date().toISOString().slice(0, 10)

const EMPTY_FORM = {
  nombre: '', apellido: '', apodo: '', cedula: '',
  sexo: 'M', estado_civil: 'C', fecha_nacimiento: '',
  fecha_ingreso: today(),
  pais: '01', ciudad: '', barrio: '', direccion: '',
  email1: '', telefono1: '', celular: '',
  punto: '01', nomina: '', centro_trabajo: '',
  no_gerencia: '', no_area: '', no_depto: '',
  no_profesion: '', no_puesto: '', no_tipo: '',
  tipo_cuenta_banco: '3', cuenta_banco: '', salario_mensual: '',
}

export function SdnEmpleados() {
  const { selectedCompany } = useCompany()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [activos, setActivos] = useState(true)
  const [selected, setSelected] = useState<any | null>(null)
  const [dlgNuevo, setDlgNuevo] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [bajaTarget, setBajaTarget] = useState<any | null>(null)
  const [fechaEgreso, setFechaEgreso] = useState(today())

  const resQ = useQuery({ queryKey: ['sdn-rep-emp', selectedCompany], queryFn: () => api.sdnRepResumenEmpleados(selectedCompany) })
  const empQ = useQuery({
    queryKey: ['sdn-empleados', selectedCompany, search, activos],
    queryFn: () => api.sdnListEmpleados({ no_cia: selectedCompany, search, activos: activos ? '1' : '0', limit: 500 }),
    enabled: !!selectedCompany,
  })
  const catQ = useQuery({
    queryKey: ['sdn-cat-empleado', selectedCompany],
    queryFn: () => api.sdnCatalogosEmpleado(selectedCompany),
    enabled: !!selectedCompany && dlgNuevo,
  })
  const ciudadesQ = useQuery({
    queryKey: ['cxc-ciudades', selectedCompany],
    queryFn: () => api.cxcListCiudades(selectedCompany),
    enabled: !!selectedCompany && dlgNuevo,
  })
  const barriosQ = useQuery({
    queryKey: ['cxc-barrios', selectedCompany],
    queryFn: () => api.cxcListBarrios(selectedCompany),
    enabled: !!selectedCompany && dlgNuevo,
  })

  const cat = catQ.data || {}
  const barriosDeCiudad = useMemo(
    () => (barriosQ.data || []).filter((b: any) => b.ciudad === form.ciudad),
    [barriosQ.data, form.ciudad],
  )
  const deptoValue = form.no_gerencia && form.no_area && form.no_depto
    ? `${form.no_gerencia}|${form.no_area}|${form.no_depto}` : ''

  const crear = useMutation({
    mutationFn: () => api.sdnCrearEmpleado({
      ...form,
      no_cia: selectedCompany,
      salario_mensual: form.salario_mensual ? Number(form.salario_mensual) : 0,
    }),
    onSuccess: (row: any) => {
      toast.success(`Empleado ${row.no_empleado} — ${row.nombre} ${row.apellido} creado`)
      qc.invalidateQueries({ queryKey: ['sdn-empleados'] })
      qc.invalidateQueries({ queryKey: ['sdn-rep-emp'] })
      setDlgNuevo(false)
      setForm({ ...EMPTY_FORM })
    },
    onError: (e: any) => toast.error(e?.detail?.error || e?.message || 'No se pudo crear el empleado'),
  })

  const baja = useMutation({
    mutationFn: () => api.sdnDarBajaEmpleado(bajaTarget.no_cia, bajaTarget.no_empleado, fechaEgreso),
    onSuccess: (row: any) => {
      toast.success(`Empleado ${row.no_empleado} — ${row.nombre} ${row.apellido} dado de baja`)
      qc.invalidateQueries({ queryKey: ['sdn-empleados'] })
      qc.invalidateQueries({ queryKey: ['sdn-rep-emp'] })
      setBajaTarget(null)
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'No se pudo dar de baja al empleado'),
  })

  const reactivar = useMutation({
    mutationFn: (row: any) => api.sdnReactivarEmpleado(row.no_cia, row.no_empleado),
    onSuccess: (row: any) => {
      toast.success(`Empleado ${row.no_empleado} — ${row.nombre} ${row.apellido} reactivado`)
      qc.invalidateQueries({ queryKey: ['sdn-empleados'] })
      qc.invalidateQueries({ queryKey: ['sdn-rep-emp'] })
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'No se pudo reactivar el empleado'),
  })

  const r: any = resQ.data || {}
  const rows = empQ.data || []

  const requeridoNuevo = form.nombre && form.apellido && form.cedula && form.fecha_nacimiento &&
    form.fecha_ingreso && form.direccion && form.ciudad && form.barrio &&
    form.nomina && form.centro_trabajo && deptoValue && form.no_profesion &&
    form.no_puesto && form.no_tipo

  const abrirNuevo = () => {
    const primeraNomina = (cat.nominas || [])[0]
    setForm({
      ...EMPTY_FORM,
      nomina: primeraNomina?.nomina || '',
      punto: primeraNomina?.punto || '01',
      centro_trabajo: (cat.centros_trabajo || [])[0]?.no_centro || '',
      no_profesion: (cat.profesiones || [])[0]?.no_profesion || '',
    })
    setDlgNuevo(true)
  }

  if (!selectedCompany) {
    return <p className="text-muted-foreground py-8 text-center">Seleccione una empresa para ver sus empleados.</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Mantenimiento de Empleados</h3>
        <p className="text-sm text-muted-foreground">
          Alta y baja de empleados de nómina. Equivale a <i>Fsdn117</i> · tabla <code>SDN.TSDN_EMPLEADO</code>.
          La baja es lógica: el empleado queda marcado como egresado, nunca se elimina.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{r.total ?? '—'}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Activos</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-emerald-600">{r.activos ?? '—'}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Egresados</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-muted-foreground">{r.egresados ?? '—'}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Fijos</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{r.fijos ?? '—'}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">No fijos</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{r.no_fijos ?? '—'}</CardContent></Card>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div><Label className="text-xs">Buscar</Label><Input className="w-72 h-9" placeholder="Nombre / cédula / código…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm pb-1"><Checkbox checked={activos} onCheckedChange={(v) => setActivos(!!v)} /> Solo activos</label>
        <Button size="sm" variant="outline" onClick={() => empQ.refetch()}><Search className="h-4 w-4 mr-1" /> Buscar</Button>
        <Button size="sm" className="ml-auto" onClick={abrirNuevo}><Plus className="h-4 w-4 mr-1" /> Nuevo empleado</Button>
        <div className="text-sm text-muted-foreground">{rows.length} empleados</div>
      </div>

      {empQ.isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="rounded border overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>No.</TableHead><TableHead>Nombre</TableHead><TableHead>Cédula</TableHead>
              <TableHead>Nómina</TableHead><TableHead>Ingreso</TableHead><TableHead>Estado</TableHead>
              <TableHead>Email</TableHead><TableHead className="text-right">Acciones</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((e: any) => (
                <TableRow key={e.no_empleado}>
                  <TableCell className="font-mono text-xs">{e.no_empleado}</TableCell>
                  <TableCell>{e.nombre} {e.apellido}</TableCell>
                  <TableCell className="font-mono text-xs">{e.cedula}</TableCell>
                  <TableCell>{e.nomina}</TableCell>
                  <TableCell>{fmtDate(e.fecha_ingreso)}</TableCell>
                  <TableCell>{e.fecha_egreso ? <Badge variant="secondary">Egresado {fmtDate(e.fecha_egreso)}</Badge> : <Badge>Activo</Badge>}</TableCell>
                  <TableCell className="text-xs">{e.email1}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => setSelected(e)}><Eye className="h-4 w-4" /></Button>
                    {e.fecha_egreso ? (
                      <Button size="sm" variant="ghost" title="Reactivar" onClick={() => reactivar.mutate(e)} disabled={reactivar.isPending}>
                        <UserCheck className="h-4 w-4 text-emerald-600" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" title="Dar de baja" onClick={() => { setBajaTarget(e); setFechaEgreso(today()) }}>
                        <UserX className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && !empQ.isLoading && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                  No hay empleados para el filtro actual.
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detalle */}
      <Dialog open={!!selected} onOpenChange={(v) => { if (!v) setSelected(null) }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Empleado {selected?.no_empleado} — {selected?.nombre} {selected?.apellido}</DialogTitle></DialogHeader>
          {selected && (
            <SdnEmpleadoDetalle noCia={selected.no_cia} noEmpleado={selected.no_empleado} />
          )}
        </DialogContent>
      </Dialog>

      {/* Dar de baja */}
      <Dialog open={!!bajaTarget} onOpenChange={(v) => { if (!v) setBajaTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Dar de baja a {bajaTarget?.nombre} {bajaTarget?.apellido}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              El empleado <b>{bajaTarget?.no_empleado}</b> quedará marcado como egresado y dejará de aparecer
              en las nóminas nuevas. El historial de movimientos y cálculos anteriores no se afecta.
            </p>
            <div>
              <Label className="text-xs">Fecha de egreso <span className="text-destructive">*</span></Label>
              <Input type="date" className="h-9" value={fechaEgreso} onChange={(e) => setFechaEgreso(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBajaTarget(null)} disabled={baja.isPending}>Cancelar</Button>
            <Button variant="destructive" onClick={() => baja.mutate()} disabled={!fechaEgreso || baja.isPending}>
              {baja.isPending ? 'Guardando…' : 'Dar de baja'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nuevo empleado */}
      <Dialog open={dlgNuevo} onOpenChange={setDlgNuevo}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nuevo empleado</DialogTitle></DialogHeader>
          {catQ.isLoading ? <Skeleton className="h-64 w-full" /> : (
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">DATOS PERSONALES</p>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Nombre <span className="text-destructive">*</span></Label>
                    <Input value={form.nombre} maxLength={25} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
                  <div><Label className="text-xs">Apellido <span className="text-destructive">*</span></Label>
                    <Input value={form.apellido} maxLength={25} onChange={(e) => setForm({ ...form, apellido: e.target.value })} /></div>
                  <div><Label className="text-xs">Cédula <span className="text-destructive">*</span></Label>
                    <Input value={form.cedula} maxLength={13} placeholder="00000000000" onChange={(e) => setForm({ ...form, cedula: e.target.value })} /></div>
                  <div><Label className="text-xs">Apodo</Label>
                    <Input value={form.apodo} maxLength={30} onChange={(e) => setForm({ ...form, apodo: e.target.value })} /></div>
                  <div><Label className="text-xs">Sexo</Label>
                    <select className="border rounded px-3 py-2 text-sm h-9 w-full bg-background" value={form.sexo} onChange={(e) => setForm({ ...form, sexo: e.target.value })}>
                      <option value="M">Masculino</option><option value="F">Femenino</option>
                    </select></div>
                  <div><Label className="text-xs">Estado civil</Label>
                    <select className="border rounded px-3 py-2 text-sm h-9 w-full bg-background" value={form.estado_civil} onChange={(e) => setForm({ ...form, estado_civil: e.target.value })}>
                      <option value="C">Casado(a)</option><option value="S">Soltero(a)</option><option value="L">Unión libre</option>
                    </select></div>
                  <div><Label className="text-xs">Fecha nacimiento <span className="text-destructive">*</span></Label>
                    <Input type="date" className="h-9" value={form.fecha_nacimiento} onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })} /></div>
                  <div><Label className="text-xs">Fecha ingreso <span className="text-destructive">*</span></Label>
                    <Input type="date" className="h-9" value={form.fecha_ingreso} onChange={(e) => setForm({ ...form, fecha_ingreso: e.target.value })} /></div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">UBICACIÓN Y CONTACTO</p>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">País</Label>
                    <select className="border rounded px-3 py-2 text-sm h-9 w-full bg-background" value={form.pais} onChange={(e) => setForm({ ...form, pais: e.target.value })}>
                      {(cat.paises || []).map((p: any) => <option key={p.no_pais} value={p.no_pais}>{p.descripcion}</option>)}
                    </select></div>
                  <div><Label className="text-xs">Ciudad <span className="text-destructive">*</span></Label>
                    <select className="border rounded px-3 py-2 text-sm h-9 w-full bg-background" value={form.ciudad}
                      onChange={(e) => setForm({ ...form, ciudad: e.target.value, barrio: '' })}>
                      <option value="">— seleccione —</option>
                      {(ciudadesQ.data || []).map((c: any) => <option key={c.ciudad} value={c.ciudad}>{c.descripcion}</option>)}
                    </select></div>
                  <div><Label className="text-xs">Sector/Barrio <span className="text-destructive">*</span></Label>
                    <select className="border rounded px-3 py-2 text-sm h-9 w-full bg-background" value={form.barrio}
                      disabled={!form.ciudad} onChange={(e) => setForm({ ...form, barrio: e.target.value })}>
                      <option value="">— seleccione —</option>
                      {barriosDeCiudad.map((b: any) => <option key={b.barrio} value={b.barrio}>{b.descripcion}</option>)}
                    </select></div>
                  <div><Label className="text-xs">Dirección <span className="text-destructive">*</span></Label>
                    <Input value={form.direccion} maxLength={60} onChange={(e) => setForm({ ...form, direccion: e.target.value })} /></div>
                  <div><Label className="text-xs">Email</Label>
                    <Input type="email" value={form.email1} onChange={(e) => setForm({ ...form, email1: e.target.value })} /></div>
                  <div><Label className="text-xs">Celular</Label>
                    <Input value={form.celular} onChange={(e) => setForm({ ...form, celular: e.target.value })} /></div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">DATOS LABORALES</p>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Nómina <span className="text-destructive">*</span></Label>
                    <select className="border rounded px-3 py-2 text-sm h-9 w-full bg-background" value={form.nomina}
                      onChange={(e) => {
                        const n = (cat.nominas || []).find((x: any) => x.nomina === e.target.value)
                        setForm({ ...form, nomina: e.target.value, punto: n?.punto || form.punto })
                      }}>
                      <option value="">— seleccione —</option>
                      {(cat.nominas || []).map((n: any) => <option key={n.nomina} value={n.nomina}>{n.descripcion}</option>)}
                    </select></div>
                  <div><Label className="text-xs">Centro de trabajo <span className="text-destructive">*</span></Label>
                    <select className="border rounded px-3 py-2 text-sm h-9 w-full bg-background" value={form.centro_trabajo} onChange={(e) => setForm({ ...form, centro_trabajo: e.target.value })}>
                      <option value="">— seleccione —</option>
                      {(cat.centros_trabajo || []).map((c: any) => <option key={c.no_centro} value={c.no_centro}>{c.descripcion}</option>)}
                    </select></div>
                  <div className="col-span-2"><Label className="text-xs">Gerencia / Área / Depto <span className="text-destructive">*</span></Label>
                    <select className="border rounded px-3 py-2 text-sm h-9 w-full bg-background" value={deptoValue}
                      onChange={(e) => {
                        const [g, a, d] = e.target.value.split('|')
                        setForm({ ...form, no_gerencia: g || '', no_area: a || '', no_depto: d || '' })
                      }}>
                      <option value="">— seleccione —</option>
                      {(cat.deptos || []).map((d: any) => (
                        <option key={`${d.no_gerencia}|${d.no_area}|${d.no_depto}`} value={`${d.no_gerencia}|${d.no_area}|${d.no_depto}`}>
                          {d.descripcion}
                        </option>
                      ))}
                    </select></div>
                  <div><Label className="text-xs">Puesto <span className="text-destructive">*</span></Label>
                    <select className="border rounded px-3 py-2 text-sm h-9 w-full bg-background" value={form.no_puesto} onChange={(e) => setForm({ ...form, no_puesto: e.target.value })}>
                      <option value="">— seleccione —</option>
                      {(cat.puestos || []).map((p: any) => <option key={p.no_puesto} value={p.no_puesto}>{p.descripcion}</option>)}
                    </select></div>
                  <div><Label className="text-xs">Tipo de empleado <span className="text-destructive">*</span></Label>
                    <select className="border rounded px-3 py-2 text-sm h-9 w-full bg-background" value={form.no_tipo} onChange={(e) => setForm({ ...form, no_tipo: e.target.value })}>
                      <option value="">— seleccione —</option>
                      {(cat.tipos_empleado || []).map((t: any) => <option key={t.no_tipo} value={t.no_tipo}>{t.descripcion}</option>)}
                    </select></div>
                  <div><Label className="text-xs">Profesión</Label>
                    <select className="border rounded px-3 py-2 text-sm h-9 w-full bg-background" value={form.no_profesion} onChange={(e) => setForm({ ...form, no_profesion: e.target.value })}>
                      {(cat.profesiones || []).map((p: any) => <option key={p.no_profesion} value={p.no_profesion}>{p.descripcion}</option>)}
                    </select></div>
                  <div><Label className="text-xs">Salario mensual (RD$)</Label>
                    <Input type="number" step="0.01" value={form.salario_mensual} onChange={(e) => setForm({ ...form, salario_mensual: e.target.value })} /></div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">DATOS BANCARIOS (opcional)</p>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Tipo de cuenta</Label>
                    <select className="border rounded px-3 py-2 text-sm h-9 w-full bg-background" value={form.tipo_cuenta_banco} onChange={(e) => setForm({ ...form, tipo_cuenta_banco: e.target.value })}>
                      <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option>
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">Código usado por Generar Archivo del Banco.</p></div>
                  <div><Label className="text-xs">No. cuenta</Label>
                    <Input value={form.cuenta_banco} maxLength={26} onChange={(e) => setForm({ ...form, cuenta_banco: e.target.value })} /></div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgNuevo(false)} disabled={crear.isPending}>Cancelar</Button>
            <Button onClick={() => crear.mutate()} disabled={!requeridoNuevo || crear.isPending}>
              {crear.isPending ? 'Guardando…' : 'Crear empleado'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SdnEmpleadoDetalle({ noCia, noEmpleado }: { noCia: string; noEmpleado: number }) {
  const q = useQuery({ queryKey: ['sdn-emp', noCia, noEmpleado], queryFn: () => api.sdnGetEmpleado(noCia, noEmpleado) })
  if (q.isLoading) return <div className="text-muted-foreground">Cargando…</div>
  if (!q.data) return null
  const d: any = q.data
  const field = (l: string, v: any) => <div><span className="text-muted-foreground">{l}:</span> {v ?? '—'}</div>
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      {field('Cédula', d.cedula)}
      {field('Nómina', d.nomina)}
      {field('Centro Trabajo', d.centro_trabajo)}
      {field('Estado civil', d.estado_civil)}
      {field('Fecha ingreso', fmtDate(d.fecha_ingreso))}
      {field('Fecha egreso', fmtDate(d.fecha_egreso))}
      {field('Fecha nacim.', fmtDate(d.fecha_nacimiento))}
      {field('Fijo', d.empleado_fijo)}
      {field('Email', d.email1)}
      {field('Teléfono', d.telefono1 || d.telefono)}
      {field('Ciudad', d.ciudad)}
      {field('Dirección', d.direccion)}
    </div>
  )
}
