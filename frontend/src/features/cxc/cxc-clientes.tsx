// FCXC115 — Mantenimiento de Clientes (7-tab mega form)
import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Pencil, Plus, Trash2, Search, X } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'

interface P { noCia: string; punto?: string }

const BLANK_CLIENTE = {
  no_cliente: '', nombre_cliente: '', nombre_comercial: '', rnc: '',
  tipo_cli: '', vendedor: '', ruta: '', zona: '', ciudad: '',
  barrio: '', cadena: '', tipo_conta: '', codigo_ncf: '', limite_credito: 0,
  dias_credito: 0, telefono: '', celular: '', email: '',
  direccion: '', activo: 'S', tipo_persona: 'J',
  contactos: [], referencias: [], referencias_banco: []
}

export function CxcClientes({ noCia, punto = '01' }: P) {
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<any>({ ...BLANK_CLIENTE })
  const [isNew, setIsNew] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // Catalogs
  const [tclis, setTclis] = useState<any[]>([])
  const [vendedores, setVendedores] = useState<any[]>([])
  const [rutas, setRutas] = useState<any[]>([])
  const [zonas, setZonas] = useState<any[]>([])
  const [ciudades, setCiudades] = useState<any[]>([])
  const [barrios, setBarrios] = useState<any[]>([])
  const [cadenas, setCadenas] = useState<any[]>([])
  const [tcontables, setTcontables] = useState<any[]>([])
  const [ncfOptions, setNcfOptions] = useState<any[]>([])

  useEffect(() => {
    Promise.all([
      regalGeneralApi.cxcListTcli(noCia),
      regalGeneralApi.cxcListVendedores(noCia),
      regalGeneralApi.cxcListRutas(noCia),
      regalGeneralApi.cxcListZonas(noCia),
      regalGeneralApi.cxcListCiudades(noCia),
      regalGeneralApi.cxcListBarrios(noCia),
      regalGeneralApi.cxcListCadenas(noCia),
      regalGeneralApi.cxcListTcontable(noCia),
      regalGeneralApi.cntNcf(noCia, punto),
    ]).then(([t, v, r, z, c, b, ca, tc, ncf]) => {
      setTclis(t); setVendedores(v); setRutas(r); setZonas(z)
      setCiudades(c); setBarrios(b); setCadenas(ca); setTcontables(tc)
      setNcfOptions(ncf || [])
    })
  }, [noCia, punto])

  const load = useCallback(async (pg = page, search = q) => {
    setLoading(true)
    try {
      const res = await regalGeneralApi.cxcListClientes(noCia, search, pg)
      setRows(res.items || [])
      setTotal(res.count || 0)
    } finally { setLoading(false) }
  }, [noCia, page, q])

  useEffect(() => { load(page, q) }, [page])

  const search = () => { setPage(1); load(1, q) }

  const openNew = () => {
    setForm({ ...BLANK_CLIENTE, no_cia: noCia, punto })
    setIsNew(true); setError(''); setOpen(true)
  }

  // get_cliente devuelve las columnas reales de TCXC_CLIENTE (tipo_contable,
  // tipo_cliente, no_cadena); el formulario/Sel usan los alias cortos
  // (tipo_conta, tipo_cli, cadena) que save_cliente tambien acepta -- sin
  // este mapeo, al editar un cliente existente esos 3 selects se ven vacios
  // aunque el dato si este guardado.
  const openEdit = async (row: any) => {
    try {
      const detail = await regalGeneralApi.cxcGetCliente(noCia, row.no_cliente)
      setForm({
        ...detail,
        tipo_cli: detail.tipo_cliente ?? detail.tipo_cli,
        tipo_conta: detail.tipo_contable ?? detail.tipo_conta,
        cadena: detail.no_cadena ?? detail.cadena,
        no_cia: noCia, punto,
      })
    } catch { setForm({ ...row, no_cia: noCia, punto, contactos: [], referencias: [], referencias_banco: [] }) }
    setIsNew(false); setError(''); setOpen(true)
  }

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true); setError('')
    try {
      const res = await regalGeneralApi.cxcSaveCliente(form)
      setOpen(false); load(page, q)
    } catch (e: any) { setError(e?.detail?.error || e?.message || 'Error') } finally { setSaving(false) }
  }

  const del = async (row: any) => {
    if (!confirm(`¿Inactivar cliente ${row.no_cliente} — ${row.nombre_cliente}?`)) return
    await regalGeneralApi.cxcDeleteCliente(noCia, row.no_cliente)
    load(page, q)
  }

  // Contact/references row helpers
  const addContacto = () => set('contactos', [...(form.contactos || []), { nombre: '', cargo: '', telefono: '', email: '' }])
  const setContacto = (i: number, k: string, v: string) => {
    const arr = [...(form.contactos || [])]
    arr[i] = { ...arr[i], [k]: v }
    set('contactos', arr)
  }
  const removeContacto = (i: number) => set('contactos', (form.contactos || []).filter((_: any, j: number) => j !== i))

  const addRef = () => set('referencias', [...(form.referencias || []), { empresa: '', telefono: '', contacto: '' }])
  const setRef = (i: number, k: string, v: string) => {
    const arr = [...(form.referencias || [])]
    arr[i] = { ...arr[i], [k]: v }
    set('referencias', arr)
  }
  const removeRef = (i: number) => set('referencias', (form.referencias || []).filter((_: any, j: number) => j !== i))

  const addRefBanco = () => set('referencias_banco', [...(form.referencias_banco || []), { banco: '', no_cuenta: '', tipo_cuenta: '' }])
  const setRefBanco = (i: number, k: string, v: string) => {
    const arr = [...(form.referencias_banco || [])]
    arr[i] = { ...arr[i], [k]: v }
    set('referencias_banco', arr)
  }
  const removeRefBanco = (i: number) => set('referencias_banco', (form.referencias_banco || []).filter((_: any, j: number) => j !== i))

  const Sel = ({ field, opts, labelKey = 'descripcion', valKey }: { field: string; opts: any[]; labelKey?: string; valKey: string }) => (
    <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
      value={form[field] || ''} onChange={e => set(field, e.target.value)}>
      <option value="">-- Seleccione --</option>
      {opts.map(o => <option key={o[valKey]} value={o[valKey]}>{o[valKey]} — {o[labelKey]}</option>)}
    </select>
  )

  const fmt = (n: any) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })
  const pageSize = 50

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Mantenimiento de Clientes</h1>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" />Nuevo Cliente</Button>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Buscar por nombre o código..." value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()} className="max-w-sm" />
        <Button onClick={search} variant="secondary"><Search className="h-4 w-4 mr-1" />Buscar</Button>
      </div>

      <div className="text-sm text-muted-foreground">{total} cliente{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}</div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">No Cliente</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-28">RNC</TableHead>
              <TableHead className="w-24">NCF</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead className="w-28">Límite Crd.</TableHead>
              <TableHead className="w-20">Días</TableHead>
              <TableHead className="w-20">Estado</TableHead>
              <TableHead className="w-20">Acc.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={9} className="text-center py-8">Cargando...</TableCell></TableRow>}
            {!loading && rows.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Sin resultados</TableCell></TableRow>}
            {rows.map(r => (
              <TableRow key={r.no_cliente}>
                <TableCell className="font-mono">{r.no_cliente}</TableCell>
                <TableCell className="font-medium">{r.nombre_cliente}</TableCell>
                <TableCell>{r.rnc}</TableCell>
                <TableCell className="font-mono text-xs">{r.codigo_ncf || ''}</TableCell>
                <TableCell>{r.nombre_vendedor || r.vendedor}</TableCell>
                <TableCell className="text-right">{fmt(r.limite_credito)}</TableCell>
                <TableCell className="text-center">{r.dias_credito}</TableCell>
                <TableCell>
                  <Badge variant={r.activo === 'S' ? 'default' : 'secondary'}>{r.activo === 'S' ? 'Activo' : 'Inactivo'}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => del(r)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Anterior</Button>
        <span className="text-sm">Pág. {page} / {Math.max(1, Math.ceil(total / pageSize))}</span>
        <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * pageSize >= total}>Siguiente</Button>
      </div>

      {/* Client Form Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[70vw] w-[95vw] sm:w-[70vw] h-[80vh] sm:h-[60vh] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isNew ? 'Nuevo Cliente' : `Editar Cliente — ${form.no_cliente}`}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="general">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="credito">Crédito</TabsTrigger>
              <TabsTrigger value="contactos">Contactos</TabsTrigger>
              <TabsTrigger value="refs">Ref. Com.</TabsTrigger>
              <TabsTrigger value="banco">Ref. Banc.</TabsTrigger>
            </TabsList>

            {/* TAB 1: General */}
            <TabsContent value="general" className="pt-4">
              <div className="grid grid-cols-3 gap-3">
                {!isNew && (
                  <div className="space-y-1">
                    <Label>No. Cliente</Label>
                    <Input value={form.no_cliente} disabled />
                  </div>
                )}
                <div className="space-y-1 col-span-2">
                  <Label>Nombre Cliente * <span className="text-xs text-muted-foreground">({(form.nombre_cliente || '').length}/40)</span></Label>
                  <Input value={form.nombre_cliente} onChange={e => set('nombre_cliente', e.target.value)} maxLength={40} />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>Nombre Comercial</Label>
                  <Input value={form.nombre_comercial} onChange={e => set('nombre_comercial', e.target.value)} maxLength={40} />
                </div>
                <div className="space-y-1">
                  <Label>RNC / Cédula</Label>
                  <Input value={form.rnc} onChange={e => set('rnc', e.target.value)} maxLength={16} />
                </div>
                <div className="space-y-1">
                  <Label>Tipo Persona</Label>
                  <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={form.tipo_persona || 'J'} onChange={e => set('tipo_persona', e.target.value)}>
                    <option value="J">Jurídico</option>
                    <option value="F">Físico</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Tipo de Cliente *</Label>
                  <Sel field="tipo_cli" opts={tclis} valKey="tipo_cliente" />
                </div>
                <div className="space-y-1">
                  <Label>Tipo Contable *</Label>
                  <Sel field="tipo_conta" opts={tcontables} valKey="tipo_contable" />
                </div>
                <div className="space-y-1">
                  <Label>NCF del Cliente</Label>
                  <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={form.codigo_ncf || ''} onChange={e => set('codigo_ncf', e.target.value)}>
                    <option value="">-- Por tipo documento --</option>
                    {ncfOptions.map(n => (
                      <option key={n.codigo_ncf} value={n.codigo_ncf}>
                        {n.codigo_ncf} - {n.posiciones_fijas || n.tipo_ncf_fiscal || ''}{n.descripcion ? ` - ${n.descripcion}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Teléfono</Label>
                  <Input value={form.telefono} onChange={e => set('telefono', e.target.value)} maxLength={14} />
                </div>
                <div className="space-y-1">
                  <Label>Celular</Label>
                  <Input value={form.celular} onChange={e => set('celular', e.target.value)} maxLength={14} />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} maxLength={80} />
                </div>
                <div className="space-y-1 col-span-3">
                  <Label>Dirección <span className="text-xs text-muted-foreground">({(form.direccion || '').length}/60)</span></Label>
                  <Input value={form.direccion} onChange={e => set('direccion', e.target.value)} maxLength={60} />
                </div>
                <div className="space-y-1">
                  <Label>Ciudad</Label>
                  <Sel field="ciudad" opts={ciudades} valKey="ciudad" />
                </div>
                <div className="space-y-1">
                  <Label>Barrio / Sector</Label>
                  <Sel field="barrio" opts={barrios} valKey="barrio" />
                </div>
                <div className="space-y-1">
                  <Label>Zona</Label>
                  <Sel field="zona" opts={zonas} valKey="zona" />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input type="checkbox" checked={form.activo === 'S'} onChange={e => set('activo', e.target.checked ? 'S' : 'N')} className="h-4 w-4" />
                  <Label>Activo</Label>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: Crédito + Asignaciones */}
            <TabsContent value="credito" className="pt-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Límite de Crédito</Label>
                  <Input type="number" value={form.limite_credito} onChange={e => set('limite_credito', Number(e.target.value))} />
                </div>
                <div className="space-y-1">
                  <Label>Días de Crédito</Label>
                  <Input type="number" value={form.dias_credito} onChange={e => set('dias_credito', Number(e.target.value))} />
                </div>
                <div className="space-y-1">
                  <Label>Cadena</Label>
                  <Sel field="cadena" opts={cadenas} valKey="no_cadena" />
                </div>
                <div className="space-y-1">
                  <Label>Vendedor</Label>
                  <Sel field="vendedor" opts={vendedores} valKey="vendedor" labelKey="nombre" />
                </div>
                <div className="space-y-1">
                  <Label>Ruta</Label>
                  <Sel field="ruta" opts={rutas} valKey="ruta" labelKey="descripcion" />
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: Contactos */}
            <TabsContent value="contactos" className="pt-4 space-y-3">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={addContacto}><Plus className="h-4 w-4 mr-1" />Agregar Contacto</Button>
              </div>
              {(form.contactos || []).map((c: any, i: number) => (
                <div key={i} className="grid grid-cols-4 gap-2 border rounded p-3 relative">
                  <button className="absolute top-2 right-2 text-red-500 hover:text-red-700" onClick={() => removeContacto(i)}><X className="h-4 w-4" /></button>
                  <div className="space-y-1">
                    <Label>Nombre</Label>
                    <Input value={c.nombre} onChange={e => setContacto(i, 'nombre', e.target.value)} maxLength={50} />
                  </div>
                  <div className="space-y-1">
                    <Label>Cargo</Label>
                    <Input value={c.cargo} onChange={e => setContacto(i, 'cargo', e.target.value)} maxLength={80} />
                  </div>
                  <div className="space-y-1">
                    <Label>Teléfono</Label>
                    <Input value={c.telefono} onChange={e => setContacto(i, 'telefono', e.target.value)} maxLength={12} />
                  </div>
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <Input value={c.email} onChange={e => setContacto(i, 'email', e.target.value)} maxLength={80} />
                  </div>
                </div>
              ))}
              {(form.contactos || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sin contactos registrados</p>}
            </TabsContent>

            {/* TAB 4: Referencias Comerciales */}
            <TabsContent value="refs" className="pt-4 space-y-3">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={addRef}><Plus className="h-4 w-4 mr-1" />Agregar Referencia</Button>
              </div>
              {(form.referencias || []).map((r: any, i: number) => (
                <div key={i} className="grid grid-cols-3 gap-2 border rounded p-3 relative">
                  <button className="absolute top-2 right-2 text-red-500 hover:text-red-700" onClick={() => removeRef(i)}><X className="h-4 w-4" /></button>
                  <div className="space-y-1">
                    <Label>Empresa</Label>
                    <Input value={r.empresa} onChange={e => setRef(i, 'empresa', e.target.value)} maxLength={60} />
                  </div>
                  <div className="space-y-1">
                    <Label>Teléfono</Label>
                    <Input value={r.telefono} onChange={e => setRef(i, 'telefono', e.target.value)} maxLength={12} />
                  </div>
                  <div className="space-y-1">
                    <Label>Contacto</Label>
                    <Input value={r.contacto} onChange={e => setRef(i, 'contacto', e.target.value)} maxLength={40} />
                  </div>
                </div>
              ))}
              {(form.referencias || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sin referencias comerciales</p>}
            </TabsContent>

            {/* TAB 5: Referencias Bancarias */}
            <TabsContent value="banco" className="pt-4 space-y-3">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={addRefBanco}><Plus className="h-4 w-4 mr-1" />Agregar Banco</Button>
              </div>
              {(form.referencias_banco || []).map((b: any, i: number) => (
                <div key={i} className="grid grid-cols-3 gap-2 border rounded p-3 relative">
                  <button className="absolute top-2 right-2 text-red-500 hover:text-red-700" onClick={() => removeRefBanco(i)}><X className="h-4 w-4" /></button>
                  <div className="space-y-1">
                    <Label>Banco</Label>
                    <Input value={b.banco} onChange={e => setRefBanco(i, 'banco', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>No. Cuenta</Label>
                    <Input value={b.no_cuenta} onChange={e => setRefBanco(i, 'no_cuenta', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Tipo Cuenta</Label>
                    <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={b.tipo_cuenta || ''} onChange={e => setRefBanco(i, 'tipo_cuenta', e.target.value)}>
                      <option value="AH">Ahorro</option>
                      <option value="CC">Corriente</option>
                    </select>
                  </div>
                </div>
              ))}
              {(form.referencias_banco || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sin referencias bancarias</p>}
            </TabsContent>
          </Tabs>

          {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar Cliente'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
