import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Loader2, Check, Plus, Star, ToggleLeft, FileText, ArrowLeft, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { apiClient, ApiError, type AdminUser, type Company, type ModuleAccess } from '@/lib/api-client'

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
  acf: 'Activos Fijos',
}

// Orden fijo de las cards -- el mismo orden en que aparecen en el sidebar operativo.
const MODULE_ORDER = ['fat', 'cxc', 'cxp', 'inv', 'odc', 'chc', 'acc', 'cnt', 'acf', 'sdn']

const FLAG_LABELS: Record<string, string> = {
  PERMITE_FACTURAR: 'Facturar', GENERAR_ESTADISTICAS: 'Estadísticas',
  VARIAR_TIPO_PRECIO: 'Variar tipo precio', VARIAR_PORC_DESCUENTO: 'Variar % descuento',
  VARIAR_PRECIO: 'Variar precio', VARIAR_VENDEDOR: 'Variar vendedor',
  VARIAR_PLAZO_PAGO: 'Variar plazo pago', IMPRIMIR_DOCU: 'Imprimir',
  REIMPRIMIR_DOCU: 'Reimprimir', AUTORIZAR_PEDIDO: 'Autorizar pedido',
  ANULAR_PEDIDO: 'Anular pedido', ASIGNAR_OFERTA: 'Asignar oferta',
  INTEGRAR_DOCU: 'Integrar doc.', DIGITAR_DEVOLUCION: 'Devoluciones',
  ENSAMBLAR_PRODUCTO: 'Ensamblar prod.', ENVIAR_FACTURA: 'Enviar factura',
  HACER_CUADRE_CAJA: 'Cuadre de caja', CREAR_CONTROL_FACTURA: 'Control factura',
  MODIFICAR_CONDUCE_USUARIO: 'Modificar conduce',
  VARIAR_TIPO_DOCU: 'Variar tipo doc.', VARIAR_LIMITE_CREDITO: 'Variar límite crédito',
  HACER_TRANSACCIONES: 'Transacciones', GENERAR_LISTADO_CXC: 'Listado CXC',
  CREAR_CLIENTES: 'Crear clientes', ASIGNAR_CLIENTE_RUTA: 'Asignar ruta',
  ASIGNAR_NCF: 'Asignar NCF', TRABAJAR_COMISION: 'Comisiones',
  MODIFICAR_VENDEDOR: 'Modificar vendedor', CREAR_TIPO_FINANCIAMIENTO: 'Tipo financiamiento',
  CREAR_FINANCIAMIENTO: 'Financiamiento', EXONERAR_MORA: 'Exonerar mora',
  IMPRIMIR_FINANCIAMIENTO: 'Imprimir finan.', ANULAR_FINANCIAMIENTO: 'Anular finan.',
  LIBERAR_CREDITO: 'Liberar crédito',
  GENERAR_LISTADO_CXP: 'Listado CXP', CREAR_PROVEEDOR: 'Crear proveedor',
  HACER_CIERRE: 'Hacer cierre', ASIGNAR_PROVEEDOR: 'Asignar proveedor',
  ASIGNAR_CUENTA_BANCARIA: 'Cuenta bancaria', LIBERAR_DEBITO: 'Liberar débito',
  BLOQUEAR_PAGO: 'Bloquear pago',
  DIGITAR_ENTRADA: 'Digitar entrada', DIGITAR_DV: 'Devoluciones',
  HACER_AJUSTES: 'Ajustes', GENERAR_INV: 'Generar inv.', CERRAR_INV: 'Cerrar inventario',
  CREAR_PRODU: 'Crear productos', MODIFICAR_COSTO: 'Modificar costo',
  ASIGNAR_PRODU_ALMACEN: 'Asig. almacén', VER_COSTO: 'Ver costo',
  PREPARAR_TOMA_FISICA: 'Toma física',
  CREAR_CUENTA: 'Crear cuenta', ASIGNAR_CUENTA: 'Asignar cuenta',
  AFECTAR_CXP: 'Afectar CXP', ANULAR_COMPROBANTE_INGRESO: 'Anular comprobante',
  CREAR_ODC_INV: 'ODC Inventario', CREAR_ODC_SUMINISTRO: 'ODC Suministro',
  GENERAR_REP_ODC: 'Reporte ODC', IMPRIMIR_ODC: 'Imprimir ODC',
  REIMPRIMIR_ODC: 'Reimprimir ODC', ANULAR_ODC: 'Anular ODC',
  CREAR_REQUISICION: 'Requisición', ANULAR_REQUISICION: 'Anular req.',
  CERRAR_REQUISICION: 'Cerrar req.', AUTORIZAR_REQUISICION: 'Autorizar req.',
  CERRAR_ORDEN: 'Cerrar orden',
  CREAR_NOMINA: 'Crear nómina', CREAR_PUESTO: 'Crear puesto',
  CREAR_EMPLEADO: 'Crear empleado', TRASLADAR_EMPLEADO: 'Trasladar emp.',
  CREAR_LISTA_SERVICIOS: 'Lista servicios', CREAR_PUESTO_SERVICIOS: 'Puesto servicios',
  COPIAR_LISTA_SERVICIOS: 'Copiar lista serv.', MODIFICAR_LS: 'Modificar LS',
  CREAR_PLANTILLA_HORARIO: 'Plantilla horario', CONSULTAR_PLANTILLA_HORARIO: 'Consultar horario',
  DIGITAR_ASIENTO: 'Digitar asiento', APROBAR_ASIENTO: 'Aprobar asiento',
  ACTUALIZAR_ASIENTO: 'Actualizar asiento', DIGITAR_ASIENTO_MA: 'Asiento moneda alt.',
  APROBAR_ASIENTO_MA: 'Aprobar asiento MA', ACTUALIZAR_ASIENTO_MA: 'Actualizar MA',
  GENERAR_ESTADOS: 'Estados financieros', GENERAR_BALANCE: 'Balance',
  IMPRIMIR_MAYOR: 'Mayor', CONSULTAR_BALANCE: 'Consultar balance',
  ADMINISTRAR_NCF: 'Administrar NCF',
  CREAR_BENEFICIARIO: 'Crear beneficiario', CREAR_CAJA_CHICA: 'Crear caja chica',
  ANULAR_EGRESO: 'Anular egreso', ANULAR_CHEQUE: 'Anular cheque',
}

const PUNTOS = ['01', '02', '03']

type DocPerm = { tipo_docu: string; descripcion: string; assigned: boolean; por_defecto: boolean }

function ModuleFlagsPanel({ username, modulo, no_cia, punto }: { username: string; modulo: string; no_cia: string; punto: string }) {
  const [flags, setFlags] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [working, setWorking] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    apiClient.adminGetModuleFlags(username, modulo, no_cia, punto)
      .then((r) => setFlags(r.flags))
      .catch(() => setFlags({}))
      .finally(() => setLoading(false))
  }, [username, modulo, no_cia, punto])

  async function toggle(flag: string, current: boolean) {
    setWorking(flag)
    try {
      await apiClient.adminSetModuleFlag(username, modulo, no_cia, punto, flag, !current)
      setFlags((prev) => ({ ...prev, [flag]: !current }))
    } catch (e) {
      toast.error(e instanceof ApiError ? e.detail?.detail || 'Error' : 'Error de red')
    } finally { setWorking(null) }
  }

  if (loading) return <div className='py-2 text-xs text-muted-foreground flex items-center gap-1'><Loader2 className='h-3 w-3 animate-spin' /> Cargando permisos...</div>
  const entries = Object.entries(flags)
  if (entries.length === 0) return null

  return (
    <div className='rounded border bg-muted/20 p-3'>
      <div className='text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1'>
        <ToggleLeft className='h-3 w-3' /> Acciones del módulo
      </div>
      <div className='grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4'>
        {entries.map(([flag, value]) => (
          <label key={flag}
            className={`flex items-center gap-2 rounded border px-2 py-1.5 cursor-pointer text-xs transition
              ${value ? 'border-green-500/40 bg-green-50 dark:bg-green-950/20' : 'border-border bg-background hover:bg-muted/40'}
              ${working === flag ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <Checkbox checked={value} onCheckedChange={() => toggle(flag, value)} disabled={working === flag} />
            <span className='truncate'>{FLAG_LABELS[flag] || flag.toLowerCase().replace(/_/g, ' ')}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function DocPermsPanel({ username, modulo, no_cia, punto }: { username: string; modulo: string; no_cia: string; punto: string }) {
  const [docs, setDocs] = useState<DocPerm[]>([])
  const [loading, setLoading] = useState(false)
  const [working, setWorking] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await apiClient.adminGetDocPerms(username, modulo, no_cia, punto)
      const assignedSet = new Set(res.assigned.map((a) => a.tipo_docu))
      const defSet = new Set(res.assigned.filter((a) => a.por_defecto).map((a) => a.tipo_docu))
      setDocs(res.available.map((av) => ({
        tipo_docu: av.tipo_docu, descripcion: av.descripcion,
        assigned: assignedSet.has(av.tipo_docu), por_defecto: defSet.has(av.tipo_docu),
      })))
    } catch { setDocs([]) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [username, modulo, no_cia, punto])

  async function toggle(doc: DocPerm) {
    setWorking(doc.tipo_docu)
    try {
      if (doc.assigned) {
        await apiClient.adminRevokeDocAccess(username, modulo, no_cia, punto, doc.tipo_docu)
        toast.success(`Documento ${doc.tipo_docu} removido`)
      } else {
        await apiClient.adminGrantDocAccess(username, modulo, { no_cia, punto, tipo_docu: doc.tipo_docu })
        toast.success(`Documento ${doc.tipo_docu} asignado`)
      }
      load()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.detail?.detail || 'Error' : 'Error de red')
    } finally { setWorking(null) }
  }

  if (loading) return <div className='py-2 text-xs text-muted-foreground flex items-center gap-1'><Loader2 className='h-3 w-3 animate-spin' /> Cargando documentos...</div>
  if (docs.length === 0) return <div className='py-2 text-xs text-muted-foreground'>Este módulo no maneja permisos por tipo de documento.</div>

  return (
    <div className='rounded border bg-muted/20 p-3'>
      <div className='text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1'>
        <FileText className='h-3 w-3' /> Documentos del módulo
      </div>
      <div className='grid grid-cols-2 gap-1.5 sm:grid-cols-3'>
        {docs.map((doc) => (
          <label key={doc.tipo_docu}
            className={`flex items-center gap-2 rounded border px-2 py-1.5 cursor-pointer text-xs transition
              ${doc.assigned ? 'border-primary/40 bg-primary/5' : 'border-border bg-background hover:bg-muted/40'}
              ${working === doc.tipo_docu ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <Checkbox checked={doc.assigned} onCheckedChange={() => toggle(doc)} disabled={working === doc.tipo_docu} />
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

/**
 * Una card por módulo: empresas como chips clicables (grant/revoke inmediato,
 * sin formulario aparte) + flags/documentos de la empresa enfocada, todo en
 * el mismo lugar. Reemplaza el flujo anterior de "otorgar acceso" -> expandir
 * fila -> abrir panel de flags -> abrir panel de documentos (4 pasos
 * separados) por un solo lugar por módulo.
 */
function ModuleCard({
  username, modulo, companies, access, ciaFilter, onChanged,
}: {
  username: string
  modulo: string
  companies: Company[]
  access: ModuleAccess[]
  ciaFilter: string
  onChanged: () => void
}) {
  const [punto, setPunto] = useState('01')
  const [busyCia, setBusyCia] = useState<string | null>(null)
  const [focusCia, setFocusCia] = useState<string | null>(null)

  const grantedCias = Array.from(
    new Set(access.filter((a) => a.activo && a.punto === punto).map((a) => a.no_cia)),
  ).sort()

  useEffect(() => {
    if (focusCia && grantedCias.includes(focusCia)) return
    setFocusCia(grantedCias[0] ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grantedCias.join(',')])

  const visibleCompanies = ciaFilter === 'todas' ? companies : companies.filter((c) => c.no_cia === ciaFilter)
  const focusEntry = access.find((a) => a.no_cia === focusCia && a.punto === punto)

  async function grantCia(cia: Company) {
    setBusyCia(cia.no_cia)
    try {
      await apiClient.adminGrantAccess(username, { modulo, no_cia: cia.no_cia, punto, activo: true })
      toast.success(`Acceso otorgado en empresa ${cia.no_cia}`)
      setFocusCia(cia.no_cia)
      onChanged()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.detail?.detail || 'Error' : 'Error de red')
    } finally { setBusyCia(null) }
  }

  async function revokeCia(cia: Company) {
    if (!confirm(`Quitar acceso a ${MODULE_LABELS[modulo] || modulo.toUpperCase()} en empresa ${cia.no_cia}?`)) return
    setBusyCia(cia.no_cia)
    try {
      await apiClient.adminRevokeAccess(username, modulo, cia.no_cia, punto)
      toast.success(`Acceso a ${cia.no_cia} removido`)
      onChanged()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.detail?.detail || 'Error' : 'Error de red')
    } finally { setBusyCia(null) }
  }

  async function toggleDefault() {
    if (!focusCia) return
    try {
      await apiClient.adminGrantAccess(username, {
        modulo, no_cia: focusCia, punto, activo: true, por_defecto: !focusEntry?.por_defecto,
      })
      onChanged()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.detail?.detail || 'Error' : 'Error de red')
    }
  }

  return (
    <Card>
      <CardHeader className='pb-3'>
        <div className='flex items-center justify-between gap-2'>
          <div>
            <CardTitle className='text-base'>{MODULE_LABELS[modulo] || modulo.toUpperCase()}</CardTitle>
            <CardDescription className='font-mono text-xs'>{modulo.toUpperCase()}</CardDescription>
          </div>
          <Badge variant={grantedCias.length ? 'default' : 'outline'}>
            {grantedCias.length ? `${grantedCias.length} empresa${grantedCias.length === 1 ? '' : 's'}` : 'sin acceso'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className='space-y-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <Select value={punto} onValueChange={setPunto}>
            <SelectTrigger className='h-8 w-24'><SelectValue /></SelectTrigger>
            <SelectContent>
              {PUNTOS.map((p) => <SelectItem key={p} value={p}>Punto {p}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className='flex flex-wrap gap-1.5'>
            {visibleCompanies.map((c) => {
              const granted = grantedCias.includes(c.no_cia)
              const focused = focusCia === c.no_cia
              const busy = busyCia === c.no_cia
              return (
                <span
                  key={c.no_cia}
                  className={`inline-flex items-center gap-1 rounded-full border pl-2.5 pr-1 py-1 text-xs font-medium transition
                    ${granted ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:bg-muted/50'}
                    ${focused ? 'ring-2 ring-primary/40' : ''}
                    ${busy ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <button
                    type='button'
                    title={granted ? `Ver/editar permisos de empresa ${c.no_cia}` : `Dar acceso a empresa ${c.no_cia}`}
                    onClick={() => (granted ? setFocusCia(c.no_cia) : grantCia(c))}
                    disabled={busy}
                    className='inline-flex items-center gap-1'
                  >
                    {busy ? <Loader2 className='h-3 w-3 animate-spin' /> : granted ? <Check className='h-3 w-3' /> : <Plus className='h-3 w-3' />}
                    {c.no_cia}
                  </button>
                  {granted && (
                    <button
                      type='button'
                      title={`Quitar acceso a empresa ${c.no_cia}`}
                      onClick={() => revokeCia(c)}
                      disabled={busy}
                      className='rounded-full p-0.5 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/40'
                    >
                      <X className='h-3 w-3' />
                    </button>
                  )}
                </span>
              )
            })}
          </div>
        </div>

        {grantedCias.length > 0 && (
          <div className='space-y-3 border-t pt-3'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              {grantedCias.length > 1 ? (
                <div className='flex flex-wrap gap-1'>
                  {grantedCias.map((cia) => (
                    <Button
                      key={cia}
                      type='button'
                      size='sm'
                      variant={focusCia === cia ? 'secondary' : 'ghost'}
                      className='h-7 px-2 text-xs'
                      onClick={() => setFocusCia(cia)}
                    >
                      {cia} · {companies.find((c) => c.no_cia === cia)?.descripcion?.slice(0, 16) || cia}
                    </Button>
                  ))}
                </div>
              ) : (
                <span className='text-xs text-muted-foreground'>
                  Configurando {focusCia} · {companies.find((c) => c.no_cia === focusCia)?.descripcion?.slice(0, 30)}
                </span>
              )}
              <button
                type='button'
                onClick={toggleDefault}
                title='Marcar como módulo predeterminado de esta empresa'
                className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition
                  ${focusEntry?.por_defecto ? 'text-amber-600' : 'text-muted-foreground hover:text-amber-600'}`}
              >
                <Star className={`h-3.5 w-3.5 ${focusEntry?.por_defecto ? 'fill-amber-500' : ''}`} />
                {focusEntry?.por_defecto ? 'Predeterminado' : 'Marcar predeterminado'}
              </button>
            </div>
            {focusCia && (
              <>
                <ModuleFlagsPanel username={username} modulo={modulo} no_cia={focusCia} punto={punto} />
                <DocPermsPanel username={username} modulo={modulo} no_cia={focusCia} punto={punto} />
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function UserAccessPage({
  user,
  companies,
  onBack,
  onChanged,
}: {
  user: AdminUser
  companies: Company[]
  onBack: () => void
  onChanged?: () => void
}) {
  const [access, setAccess] = useState<ModuleAccess[]>([])
  const [loading, setLoading] = useState(false)
  const [ciaFilter, setCiaFilter] = useState<string>('todas')

  async function load() {
    setLoading(true)
    try {
      const res = await apiClient.adminListUserAccess(user.username)
      setAccess(res.access)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.detail?.detail || 'Error' : 'Error de red')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function handleChanged() {
    load()
    onChanged?.()
  }

  const ciasWithAccess = Array.from(new Set(access.map((a) => a.no_cia))).sort()
  const totalActivos = access.filter((a) => a.activo).length

  return (
    <div className='space-y-4'>
      {/* Header con back */}
      <div className='flex items-center gap-3'>
        <Button variant='ghost' size='sm' onClick={onBack} className='gap-1'>
          <ArrowLeft className='h-4 w-4' /> Volver
        </Button>
        <div>
          <h2 className='text-xl font-semibold'>Permisos — {user.username}</h2>
          <p className='text-sm text-muted-foreground'>
            {user.full_name || 'Sin nombre registrado'}{user.role ? ` · ${user.role}` : ''}
          </p>
        </div>
      </div>

      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-sm text-muted-foreground'>
          Haz clic en una empresa dentro de cada módulo para dar o quitar acceso. Los permisos y tipos de
          documento de la empresa seleccionada aparecen debajo, sin pasos extra.
        </p>
        <div className='flex items-center gap-2'>
          <Label className='text-xs text-muted-foreground'>Ver empresa</Label>
          <Select value={ciaFilter} onValueChange={setCiaFilter}>
            <SelectTrigger className='h-8 w-44'><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value='todas'>Todas las empresas</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.no_cia} value={c.no_cia}>
                  {c.no_cia} · {c.descripcion.slice(0, 20)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant='outline'>
            {totalActivos} activo{totalActivos === 1 ? '' : 's'} en {ciasWithAccess.length} empresa{ciasWithAccess.length === 1 ? '' : 's'}
          </Badge>
        </div>
      </div>

      {loading ? (
        <div className='flex items-center justify-center py-16 text-muted-foreground'>
          <Loader2 className='h-5 w-5 animate-spin' />
        </div>
      ) : (
        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
          {MODULE_ORDER.map((modulo) => (
            <ModuleCard
              key={modulo}
              username={user.username}
              modulo={modulo}
              companies={companies}
              access={access.filter((a) => a.modulo === modulo)}
              ciaFilter={ciaFilter}
              onChanged={handleChanged}
            />
          ))}
        </div>
      )}
    </div>
  )
}
