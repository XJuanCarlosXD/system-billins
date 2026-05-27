import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, ShieldCheck, ChevronDown, ChevronRight, FileText, ToggleLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { sigafApi, ApiError, type AdminUser, type Company, type ModuleAccess } from '@/lib/sigaf-api'

// Etiquetas amigables para los flags de cada módulo
const FLAG_LABELS: Record<string, string> = {
  // FAT
  PERMITE_FACTURAR: 'Facturar',
  GENERAR_ESTADISTICAS: 'Estadísticas',
  VARIAR_TIPO_PRECIO: 'Variar tipo precio',
  VARIAR_PORC_DESCUENTO: 'Variar % descuento',
  VARIAR_PRECIO: 'Variar precio',
  VARIAR_VENDEDOR: 'Variar vendedor',
  VARIAR_PLAZO_PAGO: 'Variar plazo pago',
  IMPRIMIR_DOCU: 'Imprimir',
  REIMPRIMIR_DOCU: 'Reimprimir',
  AUTORIZAR_PEDIDO: 'Autorizar pedido',
  ANULAR_PEDIDO: 'Anular pedido',
  ASIGNAR_OFERTA: 'Asignar oferta',
  INTEGRAR_DOCU: 'Integrar doc.',
  DIGITAR_DEVOLUCION: 'Devoluciones',
  ENSAMBLAR_PRODUCTO: 'Ensamblar prod.',
  ENVIAR_FACTURA: 'Enviar factura',
  HACER_CUADRE_CAJA: 'Cuadre de caja',
  CREAR_CONTROL_FACTURA: 'Control factura',
  MODIFICAR_CONDUCE_USUARIO: 'Modificar conduce',
  // CXC
  VARIAR_TIPO_DOCU: 'Variar tipo doc.',
  VARIAR_LIMITE_CREDITO: 'Variar límite crédito',
  HACER_TRANSACCIONES: 'Transacciones',
  GENERAR_LISTADO_CXC: 'Listado CXC',
  CREAR_CLIENTES: 'Crear clientes',
  ASIGNAR_CLIENTE_RUTA: 'Asignar ruta',
  ASIGNAR_NCF: 'Asignar NCF',
  TRABAJAR_COMISION: 'Comisiones',
  MODIFICAR_VENDEDOR: 'Modificar vendedor',
  CREAR_TIPO_FINANCIAMIENTO: 'Tipo financiamiento',
  CREAR_FINANCIAMIENTO: 'Financiamiento',
  EXONERAR_MORA: 'Exonerar mora',
  IMPRIMIR_FINANCIAMIENTO: 'Imprimir finan.',
  ANULAR_FINANCIAMIENTO: 'Anular finan.',
  LIBERAR_CREDITO: 'Liberar crédito',
  // CXP
  GENERAR_LISTADO_CXP: 'Listado CXP',
  CREAR_PROVEEDOR: 'Crear proveedor',
  HACER_CIERRE: 'Hacer cierre',
  ASIGNAR_PROVEEDOR: 'Asignar proveedor',
  ASIGNAR_CUENTA_BANCARIA: 'Cuenta bancaria',
  LIBERAR_DEBITO: 'Liberar débito',
  BLOQUEAR_PAGO: 'Bloquear pago',
  // INV
  DIGITAR_ENTRADA: 'Digitar entrada',
  DIGITAR_DV: 'Devoluciones',
  HACER_AJUSTES: 'Ajustes',
  GENERAR_INV: 'Generar inv.',
  CERRAR_INV: 'Cerrar inventario',
  CREAR_PRODU: 'Crear productos',
  MODIFICAR_COSTO: 'Modificar costo',
  ASIGNAR_PRODU_ALMACEN: 'Asig. almacén',
  VER_COSTO: 'Ver costo',
  PREPARAR_TOMA_FISICA: 'Toma física',
  // CHC
  CREAR_CUENTA: 'Crear cuenta',
  ASIGNAR_CUENTA: 'Asignar cuenta',
  AFECTAR_CXP: 'Afectar CXP',
  ANULAR_COMPROBANTE_INGRESO: 'Anular comprobante',
  // ODC
  CREAR_ODC_INV: 'ODC Inventario',
  CREAR_ODC_SUMINISTRO: 'ODC Suministro',
  GENERAR_REP_ODC: 'Reporte ODC',
  IMPRIMIR_ODC: 'Imprimir ODC',
  REIMPRIMIR_ODC: 'Reimprimir ODC',
  ANULAR_ODC: 'Anular ODC',
  CREAR_REQUISICION: 'Requisición',
  ANULAR_REQUISICION: 'Anular req.',
  CERRAR_REQUISICION: 'Cerrar req.',
  AUTORIZAR_REQUISICION: 'Autorizar req.',
  CERRAR_ORDEN: 'Cerrar orden',
  // SDN
  CREAR_NOMINA: 'Crear nómina',
  CREAR_PUESTO: 'Crear puesto',
  CREAR_EMPLEADO: 'Crear empleado',
  TRASLADAR_EMPLEADO: 'Trasladar emp.',
  CREAR_LISTA_SERVICIOS: 'Lista servicios',
  CREAR_PUESTO_SERVICIOS: 'Puesto servicios',
  COPIAR_LISTA_SERVICIOS: 'Copiar lista serv.',
  MODIFICAR_LS: 'Modificar LS',
  CREAR_PLANTILLA_HORARIO: 'Plantilla horario',
  CONSULTAR_PLANTILLA_HORARIO: 'Consultar horario',
  // CNT
  DIGITAR_ASIENTO: 'Digitar asiento',
  APROBAR_ASIENTO: 'Aprobar asiento',
  ACTUALIZAR_ASIENTO: 'Actualizar asiento',
  DIGITAR_ASIENTO_MA: 'Asiento moneda alt.',
  APROBAR_ASIENTO_MA: 'Aprobar asiento MA',
  ACTUALIZAR_ASIENTO_MA: 'Actualizar MA',
  GENERAR_ESTADOS: 'Estados financieros',
  GENERAR_BALANCE: 'Balance',
  IMPRIMIR_MAYOR: 'Mayor',
  CONSULTAR_BALANCE: 'Consultar balance',
  ADMINISTRAR_NCF: 'Administrar NCF',
  // ACC
  CREAR_BENEFICIARIO: 'Crear beneficiario',
  CREAR_CAJA_CHICA: 'Crear caja chica',
}

const MODULE_LABELS: Record<string, string> = {
  fat: 'Facturación',
  cxc: 'Cuentas por Cobrar',
  cxp: 'Cuentas por Pagar',
  inv: 'Inventario',
  odc: 'Órdenes de Compra',
  chc: 'Bancos / Cheques',
  acc: 'Caja Chica',
  cnt: 'Contabilidad',
  sdn: 'Nómina',
}

const PUNTOS = ['01', '02', '03']

type DocPerm = { tipo_docu: string; descripcion: string; assigned: boolean; por_defecto: boolean }

function ModuleFlagsPanel({
  username, modulo, no_cia, punto,
}: { username: string; modulo: string; no_cia: string; punto: string }) {
  const [flags, setFlags] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [working, setWorking] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await sigafApi.adminGetModuleFlags(username, modulo, no_cia, punto)
      setFlags(res.flags)
    } catch {
      setFlags({})
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [username, modulo, no_cia, punto])

  async function toggle(flag: string, current: boolean) {
    setWorking(flag)
    try {
      await sigafApi.adminSetModuleFlag(username, modulo, no_cia, punto, flag, !current)
      setFlags((prev) => ({ ...prev, [flag]: !current }))
    } catch (e) {
      const msg = e instanceof ApiError ? e.detail?.detail || 'Error' : 'Error de red'
      toast.error(msg)
    } finally {
      setWorking(null)
    }
  }

  if (loading) return <div className='py-2 text-xs text-muted-foreground flex items-center gap-1'><Loader2 className='h-3 w-3 animate-spin' /> Cargando permisos...</div>
  const entries = Object.entries(flags)
  if (entries.length === 0) return null

  return (
    <div className='mt-2 rounded border bg-muted/20 p-3'>
      <div className='text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1'>
        <ToggleLeft className='h-3 w-3' /> Permisos del módulo
      </div>
      <div className='grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4'>
        {entries.map(([flag, value]) => (
          <label
            key={flag}
            className={`flex items-center gap-2 rounded border px-2 py-1.5 cursor-pointer text-xs transition
              ${value ? 'border-green-500/40 bg-green-50 dark:bg-green-950/20' : 'border-border bg-background hover:bg-muted/40'}
              ${working === flag ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <Checkbox
              checked={value}
              onCheckedChange={() => toggle(flag, value)}
              disabled={working === flag}
            />
            <span className='truncate'>{FLAG_LABELS[flag] || flag.toLowerCase().replace(/_/g, ' ')}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function DocPermsPanel({
  username, modulo, no_cia, punto,
}: { username: string; modulo: string; no_cia: string; punto: string }) {
  const [docs, setDocs] = useState<DocPerm[]>([])
  const [loading, setLoading] = useState(false)
  const [working, setWorking] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await sigafApi.adminGetDocPerms(username, modulo, no_cia, punto)
      const assignedSet = new Set(res.assigned.map((a) => a.tipo_docu))
      const defSet = new Set(res.assigned.filter((a) => a.por_defecto).map((a) => a.tipo_docu))
      setDocs(res.available.map((av) => ({
        tipo_docu: av.tipo_docu,
        descripcion: av.descripcion,
        assigned: assignedSet.has(av.tipo_docu),
        por_defecto: defSet.has(av.tipo_docu),
      })))
    } catch {
      setDocs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [username, modulo, no_cia, punto])

  async function toggle(doc: DocPerm) {
    setWorking(doc.tipo_docu)
    try {
      if (doc.assigned) {
        await sigafApi.adminRevokeDocAccess(username, modulo, no_cia, punto, doc.tipo_docu)
        toast.success(`Documento ${doc.tipo_docu} removido`)
      } else {
        await sigafApi.adminGrantDocAccess(username, modulo, { no_cia, punto, tipo_docu: doc.tipo_docu })
        toast.success(`Documento ${doc.tipo_docu} asignado`)
      }
      load()
    } catch (e) {
      const msg = e instanceof ApiError ? e.detail?.detail || 'Error' : 'Error de red'
      toast.error(msg)
    } finally {
      setWorking(null)
    }
  }

  if (loading) return <div className='py-2 text-xs text-muted-foreground flex items-center gap-1'><Loader2 className='h-3 w-3 animate-spin' /> Cargando documentos...</div>
  if (docs.length === 0) return <div className='py-2 text-xs text-muted-foreground'>Este módulo no tiene tipos de documentos configurados.</div>

  return (
    <div className='mt-2 rounded border bg-muted/20 p-3'>
      <div className='text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1'>
        <FileText className='h-3 w-3' /> Documentos del módulo
      </div>
      <div className='grid grid-cols-2 gap-1.5 sm:grid-cols-3'>
        {docs.map((doc) => (
          <label
            key={doc.tipo_docu}
            className={`flex items-center gap-2 rounded border px-2 py-1.5 cursor-pointer text-xs transition
              ${doc.assigned ? 'border-primary/40 bg-primary/5' : 'border-border bg-background hover:bg-muted/40'}
              ${working === doc.tipo_docu ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <Checkbox
              checked={doc.assigned}
              onCheckedChange={() => toggle(doc)}
              disabled={working === doc.tipo_docu}
            />
            <span>
              <span className='font-mono font-semibold'>{doc.tipo_docu}</span>
              <span className='block text-muted-foreground truncate max-w-[100px]'>{doc.descripcion}</span>
            </span>
            {doc.por_defecto && <Badge variant='outline' className='text-[9px] ml-auto'>def</Badge>}
          </label>
        ))}
      </div>
    </div>
  )
}

export function UserAccessDialog({
  user,
  companies,
  onChanged,
}: {
  user: AdminUser
  companies: Company[]
  onChanged?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [access, setAccess] = useState<ModuleAccess[]>([])
  const [loading, setLoading] = useState(false)
  const [working, setWorking] = useState(false)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  // Form nuevo acceso
  const [newCia, setNewCia] = useState(companies[0]?.no_cia ?? '01')
  const [newModulo, setNewModulo] = useState('')
  const [newPunto, setNewPunto] = useState('01')
  const [newPorDefecto, setNewPorDefecto] = useState(false)
  const [availableModules, setAvailableModules] = useState<string[]>([])
  const [loadingModules, setLoadingModules] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await sigafApi.adminListUserAccess(user.username)
      setAccess(res.access)
    } catch (e) {
      const msg = e instanceof ApiError ? e.detail?.detail || 'Error' : 'Error de red'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  async function loadModules(cia: string) {
    setLoadingModules(true)
    try {
      const res = await sigafApi.adminListModulesForCompany(cia)
      setAvailableModules(res.modules)
      if (res.modules.length > 0) setNewModulo(res.modules[0])
    } catch {
      setAvailableModules([])
    } finally {
      setLoadingModules(false)
    }
  }

  useEffect(() => { if (open) load() }, [open])
  useEffect(() => { if (open && newCia) loadModules(newCia) }, [newCia, open])

  async function grant() {
    setWorking(true)
    try {
      await sigafApi.adminGrantAccess(user.username, {
        modulo: newModulo, no_cia: newCia, punto: newPunto,
        activo: true, por_defecto: newPorDefecto,
      })
      toast.success(`Acceso a ${MODULE_LABELS[newModulo] || newModulo.toUpperCase()} otorgado`)
      load(); onChanged?.()
    } catch (e) {
      const msg = e instanceof ApiError ? e.detail?.detail || 'Error' : 'Error de red'
      toast.error(msg)
    } finally {
      setWorking(false) }
  }

  async function revoke(a: ModuleAccess) {
    if (!confirm(`Quitar acceso a ${MODULE_LABELS[a.modulo] || a.modulo.toUpperCase()} en empresa ${a.no_cia}?`)) return
    try {
      await sigafApi.adminRevokeAccess(user.username, a.modulo, a.no_cia, a.punto)
      toast.success('Acceso removido')
      load(); onChanged?.()
    } catch (e) {
      const msg = e instanceof ApiError ? e.detail?.detail || 'Error' : 'Error de red'
      toast.error(msg)
    }
  }

  const rowKey = (a: ModuleAccess) => `${a.modulo}-${a.no_cia}-${a.punto}`

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size='sm' variant='outline' title='Permisos por módulo'>
          <ShieldCheck className='h-3.5 w-3.5' />
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-4xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle className='text-xl'>Permisos — {user.username}</DialogTitle>
          <DialogDescription>
            Gestiona los módulos y documentos a los que tiene acceso este usuario.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-6'>
          {/* ── Sección 1: Accesos actuales ── */}
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <span className='text-sm font-semibold uppercase tracking-wide'>Módulos asignados</span>
              <Badge variant='outline'>{access.length} {access.length === 1 ? 'módulo' : 'módulos'}</Badge>
            </div>
            <div className='rounded border'>
              <Table>
                <TableHeader className='sticky top-0 bg-muted/50'>
                  <TableRow>
                    <TableHead className='w-6' />
                    <TableHead className='font-semibold'>Módulo</TableHead>
                    <TableHead className='font-semibold'>Empresa</TableHead>
                    <TableHead className='font-semibold'>Punto</TableHead>
                    <TableHead className='font-semibold'>Estado</TableHead>
                    <TableHead className='text-right font-semibold'>Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow><TableCell colSpan={6} className='text-center py-6'>
                      <Loader2 className='inline h-4 w-4 animate-spin' />
                    </TableCell></TableRow>
                  )}
                  {!loading && access.length === 0 && (
                    <TableRow><TableCell colSpan={6} className='text-center py-6 text-muted-foreground'>
                      Sin módulos asignados
                    </TableCell></TableRow>
                  )}
                  {access.map((a) => {
                    const key = rowKey(a)
                    const expanded = expandedRow === key
                    return (
                      <>
                        <TableRow key={key} className='hover:bg-muted/50'>
                          <TableCell className='pr-0'>
                            <Button
                              variant='ghost' size='sm'
                              className='h-6 w-6 p-0'
                              onClick={() => setExpandedRow(expanded ? null : key)}
                              title={expanded ? 'Cerrar documentos' : 'Ver documentos'}
                            >
                              {expanded
                                ? <ChevronDown className='h-3.5 w-3.5' />
                                : <ChevronRight className='h-3.5 w-3.5' />}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className='font-semibold'>{MODULE_LABELS[a.modulo] || a.modulo.toUpperCase()}</div>
                            <div className='text-xs text-muted-foreground font-mono'>{a.modulo.toUpperCase()}</div>
                          </TableCell>
                          <TableCell className='font-mono'>{a.no_cia}</TableCell>
                          <TableCell className='font-mono'>{a.punto}</TableCell>
                          <TableCell>
                            <div className='flex gap-1'>
                              {a.activo
                                ? <Badge className='text-xs'>activo</Badge>
                                : <Badge className='text-xs' variant='secondary'>inactivo</Badge>}
                              {a.por_defecto && <Badge className='text-xs' variant='outline'>default</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className='text-right'>
                            <Button size='sm' variant='ghost' onClick={() => revoke(a)}
                              className='hover:bg-red-50 hover:text-red-600' title='Quitar módulo'>
                              <Trash2 className='h-4 w-4' />
                            </Button>
                          </TableCell>
                        </TableRow>
                        {expanded && (
                          <TableRow key={`${key}-docs`}>
                            <TableCell colSpan={6} className='bg-muted/10 pb-4 pt-0 px-6'>
                              <ModuleFlagsPanel
                                username={user.username}
                                modulo={a.modulo}
                                no_cia={a.no_cia}
                                punto={a.punto}
                              />
                              <DocPermsPanel
                                username={user.username}
                                modulo={a.modulo}
                                no_cia={a.no_cia}
                                punto={a.punto}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* ── Sección 2: Otorgar acceso a módulo ── */}
          <div className='rounded border p-5 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 space-y-4'>
            <div className='flex items-center justify-between'>
              <div>
                <div className='text-sm font-semibold uppercase tracking-wide'>Otorgar acceso a módulo</div>
                <p className='text-xs text-muted-foreground mt-0.5'>Selecciona empresa, módulo y punto</p>
              </div>
              {loadingModules && <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />}
            </div>

            <div className='grid grid-cols-2 gap-3'>
              <div>
                <Label className='text-xs font-medium mb-1 block'>Empresa</Label>
                <Select value={newCia} onValueChange={setNewCia}>
                  <SelectTrigger className='h-9'><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.no_cia} value={c.no_cia}>
                        {c.no_cia} · {c.descripcion.slice(0, 25)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className='text-xs font-medium mb-1 block'>Módulo</Label>
                <Select value={newModulo} onValueChange={setNewModulo}
                  disabled={loadingModules || availableModules.length === 0}>
                  <SelectTrigger className='h-9'>
                    <SelectValue placeholder={loadingModules ? 'Cargando...' : 'Selecciona módulo'} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModules.map((mod) => (
                      <SelectItem key={mod} value={mod}>
                        {MODULE_LABELS[mod] || mod.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className='text-xs font-medium mb-1 block'>Punto de entrada</Label>
                <Select value={newPunto} onValueChange={setNewPunto}>
                  <SelectTrigger className='h-9'><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PUNTOS.map((p) => <SelectItem key={p} value={p}>Punto {p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className='text-xs font-medium mb-1 block'>Por defecto</Label>
                <div className='flex items-center gap-2 h-9 px-3 border rounded bg-background'>
                  <Switch checked={newPorDefecto} onCheckedChange={setNewPorDefecto} id='dft' />
                  <Label htmlFor='dft' className='text-xs cursor-pointer'>{newPorDefecto ? 'Sí — módulo predeterminado' : 'No'}</Label>
                </div>
              </div>
            </div>

            <Button className='w-full' onClick={grant}
              disabled={working || !newModulo || !newCia || !newPunto}>
              {working ? <Loader2 className='h-4 w-4 animate-spin mr-2' /> : <Plus className='h-4 w-4 mr-2' />}
              Otorgar acceso al módulo
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => setOpen(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
