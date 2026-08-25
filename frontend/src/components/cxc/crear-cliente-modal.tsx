// Sidesheet único para crear/editar clientes (CXC.TCXC_CLIENTE) — usado
// tanto en Mantenimiento de Clientes (CxC › Catálogos, con edición) como en
// cualquier picker de cliente que ofrezca "crear cliente" al no encontrar
// resultados (FAT nueva factura, CxC transacciones). Mismo patrón que
// CrearProductoModal: un solo componente, parte pesada (contactos,
// referencias, RNC lookup) incluida siempre para no perder funcionalidad
// según desde dónde se abra.
import { useEffect, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
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
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Cliente } from './cliente-picker'

interface Contacto {
  nombre: string
  cargo: string
  telefono: string
  email: string
}
interface ReferenciaCom {
  empresa: string
  telefono: string
  contacto: string
}
interface ReferenciaBanco {
  banco: string
  no_cuenta: string
  tipo_cuenta: string
}

const BLANK = {
  no_cliente: '',
  nombre_cliente: '',
  nombre_comercial: '',
  rnc: '',
  tipo_cli: '',
  vendedor: '',
  ruta: '',
  zona: '',
  ciudad: '',
  barrio: '',
  cadena: '',
  tipo_conta: '',
  codigo_ncf: '',
  limite_credito: 0,
  dias_credito: 0,
  telefono: '',
  celular: '',
  email: '',
  direccion: '',
  activo: 'S',
  tipo_persona: 'J',
  contactos: [] as Contacto[],
  referencias: [] as ReferenciaCom[],
  referencias_banco: [] as ReferenciaBanco[],
}

interface CatalogItem {
  [key: string]: unknown
}

interface Props {
  open: boolean
  onClose: () => void
  noCia: string
  punto?: string
  /** Se llama tras crear un cliente nuevo con éxito. */
  onCreated?: (cliente: Cliente) => void
  /** Se llama tras editar un cliente existente con éxito. */
  onUpdated?: () => void
  /** Prefill de nombre con el texto que el usuario ya había tecleado en el
   * buscador que disparó este modal. Solo aplica al crear. */
  nombreInicial?: string
  /** Si se define, el sheet abre en modo edición para este no_cliente. */
  editingNoCliente?: string | null
}

export function CrearClienteModal({
  open,
  onClose,
  noCia,
  punto = '01',
  onCreated,
  onUpdated,
  nombreInicial = '',
  editingNoCliente = null,
}: Props) {
  const isEdit = !!editingNoCliente
  const [form, setForm] = useState<typeof BLANK>({ ...BLANK })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [tclis, setTclis] = useState<CatalogItem[]>([])
  const [vendedores, setVendedores] = useState<CatalogItem[]>([])
  const [rutas, setRutas] = useState<CatalogItem[]>([])
  const [zonas, setZonas] = useState<CatalogItem[]>([])
  const [ciudades, setCiudades] = useState<CatalogItem[]>([])
  const [barrios, setBarrios] = useState<CatalogItem[]>([])
  const [cadenas, setCadenas] = useState<CatalogItem[]>([])
  const [tcontables, setTcontables] = useState<CatalogItem[]>([])
  const [ncfOptions, setNcfOptions] = useState<CatalogItem[]>([])

  const [buscandoRnc, setBuscandoRnc] = useState(false)
  const [rncLookupMsg, setRncLookupMsg] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setRncLookupMsg('')

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
    ]).then(([t, v, r, z, c, b, ca, tc, ncf]: any[]) => {
      setTclis(t || [])
      setVendedores(v || [])
      setRutas(r || [])
      setZonas(z || [])
      setCiudades(c || [])
      setBarrios(b || [])
      setCadenas(ca || [])
      setTcontables(tc || [])
      setNcfOptions(ncf || [])
      // Tipo de Cliente y Tipo Contable son catálogos que casi nadie conoce
      // de memoria — sin un default, cada alta se traba ahí. Se precargan
      // con el primero de la lista (editable) solo al crear, nunca al editar.
      if (!isEdit) {
        const firstTcli = (t || [])[0] as any
        const firstTconta = (tc || [])[0] as any
        setForm((f) => ({
          ...f,
          tipo_cli: f.tipo_cli || String(firstTcli?.tipo_cliente ?? firstTcli?.tipo_cli ?? ''),
          tipo_conta: f.tipo_conta || String(firstTconta?.tipo_contable ?? firstTconta?.tipo_conta ?? ''),
        }))
      }
    })

    if (isEdit && editingNoCliente) {
      regalGeneralApi
        .cxcGetCliente(noCia, editingNoCliente)
        .then((detail: any) => {
          setForm({
            ...BLANK,
            ...detail,
            tipo_cli: detail.tipo_cliente ?? detail.tipo_cli ?? '',
            tipo_conta: detail.tipo_contable ?? detail.tipo_conta ?? '',
            cadena: detail.no_cadena ?? detail.cadena ?? '',
            contactos: detail.contactos ?? [],
            referencias: detail.referencias ?? [],
            referencias_banco: detail.referencias_banco ?? [],
          })
        })
        .catch((err: any) =>
          setError(err?.message ?? 'No se pudo cargar el cliente')
        )
    } else {
      setForm({ ...BLANK, nombre_cliente: nombreInicial })
    }
  }, [open, noCia, punto, isEdit, editingNoCliente, nombreInicial])

  const set = (k: keyof typeof BLANK, v: any) =>
    setForm((f) => ({ ...f, [k]: v }))

  const buscarPorRnc = async () => {
    const rnc = (form.rnc || '').trim()
    if (!rnc) {
      setRncLookupMsg('Escribe un RNC o cédula primero')
      return
    }
    setBuscandoRnc(true)
    setRncLookupMsg('')
    try {
      const r = await regalGeneralApi.cxcRncLookup(rnc)
      if (!r.found) {
        setRncLookupMsg('La DGII no tiene ese RNC/cédula registrado — sigue llenando a mano.')
        return
      }
      setForm((f) => ({
        ...f,
        nombre_cliente: f.nombre_cliente || r.nombre || f.nombre_cliente,
        tipo_persona: r.tipo_persona_sugerida || f.tipo_persona,
        codigo_ncf:
          f.codigo_ncf || (r.tipo_persona_sugerida === 'F' ? 'FT-001' : 'FC-001'),
      }))
      const estadoTxt = r.estado ? ` (estado DGII: ${r.estado})` : ''
      setRncLookupMsg(`Encontrado: ${r.nombre}${estadoTxt}. Revisa el Tipo Contable/Cliente y el comprobante sugerido.`)
    } catch {
      setRncLookupMsg('No se pudo consultar la DGII ahora mismo — sigue llenando a mano.')
    } finally {
      setBuscandoRnc(false)
    }
  }

  const addContacto = () =>
    set('contactos', [...form.contactos, { nombre: '', cargo: '', telefono: '', email: '' }])
  const setContacto = (i: number, k: keyof Contacto, v: string) => {
    const arr = [...form.contactos]
    arr[i] = { ...arr[i], [k]: v }
    set('contactos', arr)
  }
  const removeContacto = (i: number) =>
    set('contactos', form.contactos.filter((_, j) => j !== i))

  const addRef = () =>
    set('referencias', [...form.referencias, { empresa: '', telefono: '', contacto: '' }])
  const setRef = (i: number, k: keyof ReferenciaCom, v: string) => {
    const arr = [...form.referencias]
    arr[i] = { ...arr[i], [k]: v }
    set('referencias', arr)
  }
  const removeRef = (i: number) =>
    set('referencias', form.referencias.filter((_, j) => j !== i))

  const addRefBanco = () =>
    set('referencias_banco', [...form.referencias_banco, { banco: '', no_cuenta: '', tipo_cuenta: '' }])
  const setRefBanco = (i: number, k: keyof ReferenciaBanco, v: string) => {
    const arr = [...form.referencias_banco]
    arr[i] = { ...arr[i], [k]: v }
    set('referencias_banco', arr)
  }
  const removeRefBanco = (i: number) =>
    set('referencias_banco', form.referencias_banco.filter((_, j) => j !== i))

  const handleGuardar = async () => {
    setError('')
    if (!form.nombre_cliente.trim()) return setError('El nombre es requerido')
    if (!form.tipo_cli) return setError('Seleccione el tipo de cliente')
    if (!form.tipo_conta) return setError('Seleccione el tipo contable')

    setSaving(true)
    try {
      const res: any = await regalGeneralApi.cxcSaveCliente({
        ...form,
        no_cliente: isEdit ? editingNoCliente : '',
        no_cia: noCia,
        punto,
      })
      const noCliente = isEdit ? editingNoCliente : res?.no_cliente ?? res?.data?.no_cliente
      toast.success(isEdit ? `Cliente ${noCliente} actualizado` : `Cliente ${noCliente ?? ''} creado`)
      if (isEdit) {
        onUpdated?.()
      } else {
        onCreated?.({
          no_cliente: noCliente,
          nombre: form.nombre_cliente.trim(),
          nombre_cliente: form.nombre_cliente.trim(),
          rnc: form.rnc,
          direccion: form.direccion,
          telefono: form.telefono,
        })
      }
    } catch (err: any) {
      setError(err?.detail?.error ?? err?.message ?? 'Error desconocido al guardar el cliente')
    } finally {
      setSaving(false)
    }
  }

  const Sel = ({
    field,
    opts,
    labelKey = 'descripcion',
    valKey,
  }: {
    field: keyof typeof BLANK
    opts: CatalogItem[]
    labelKey?: string
    valKey: string
  }) => (
    <Select value={String(form[field] ?? '')} onValueChange={(v) => set(field, v)}>
      <SelectTrigger className='h-9'>
        <SelectValue placeholder='Seleccionar...' />
      </SelectTrigger>
      <SelectContent>
        {opts.map((o) => {
          const code = String(o[valKey] ?? '')
          if (!code) return null
          return (
            <SelectItem key={code} value={code}>
              {code} — {String(o[labelKey] ?? '')}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <SheetContent size='lg'>
        <SheetHeader>
          <SheetTitle>
            {isEdit ? `Editar Cliente ${editingNoCliente}` : 'Crear Cliente'}
          </SheetTitle>
        </SheetHeader>

        <div className='flex-1 overflow-y-auto px-6 py-4'>
          <Tabs defaultValue='general'>
            <TabsList className='grid w-full grid-cols-5'>
              <TabsTrigger value='general'>General</TabsTrigger>
              <TabsTrigger value='credito'>Crédito</TabsTrigger>
              <TabsTrigger value='contactos'>Contactos</TabsTrigger>
              <TabsTrigger value='refs'>Ref. Com.</TabsTrigger>
              <TabsTrigger value='banco'>Ref. Banc.</TabsTrigger>
            </TabsList>

            <TabsContent value='general' className='space-y-3 pt-4'>
              <div className='grid grid-cols-2 gap-3'>
                <div className='col-span-2 space-y-1'>
                  <Label>
                    Nombre Cliente <span className='text-destructive'>*</span>{' '}
                    <span className='text-xs text-muted-foreground'>
                      ({form.nombre_cliente.length}/40)
                    </span>
                  </Label>
                  <Input
                    value={form.nombre_cliente}
                    onChange={(e) => set('nombre_cliente', e.target.value)}
                    maxLength={40}
                    autoFocus
                  />
                </div>
                <div className='col-span-2 space-y-1'>
                  <Label>Nombre Comercial</Label>
                  <Input
                    value={form.nombre_comercial}
                    onChange={(e) => set('nombre_comercial', e.target.value)}
                    maxLength={40}
                  />
                </div>
                <div className='col-span-2 space-y-1'>
                  <Label>RNC / Cédula</Label>
                  <div className='flex gap-2'>
                    <Input
                      value={form.rnc}
                      onChange={(e) => {
                        set('rnc', e.target.value)
                        setRncLookupMsg('')
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), buscarPorRnc())}
                      maxLength={16}
                      className='flex-1'
                    />
                    <Button
                      type='button'
                      variant='secondary'
                      size='sm'
                      onClick={buscarPorRnc}
                      disabled={buscandoRnc}
                    >
                      <Search className='mr-1 h-4 w-4' />
                      {buscandoRnc ? 'Buscando…' : 'Buscar en DGII'}
                    </Button>
                  </div>
                  {rncLookupMsg && (
                    <p className='text-xs text-muted-foreground'>{rncLookupMsg}</p>
                  )}
                </div>
                <div className='space-y-1'>
                  <Label>Tipo Persona</Label>
                  <Select
                    value={form.tipo_persona}
                    onValueChange={(v) => set('tipo_persona', v)}
                  >
                    <SelectTrigger className='h-9'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='J'>Jurídico</SelectItem>
                      <SelectItem value='F'>Físico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-1'>
                  <Label>
                    Tipo de Cliente <span className='text-destructive'>*</span>
                  </Label>
                  <Sel field='tipo_cli' opts={tclis} valKey='tipo_cliente' />
                </div>
                <div className='space-y-1'>
                  <Label>
                    Tipo Contable <span className='text-destructive'>*</span>
                  </Label>
                  <Sel field='tipo_conta' opts={tcontables} valKey='tipo_contable' />
                </div>
                <div className='space-y-1'>
                  <Label>NCF del Cliente</Label>
                  <Select
                    value={form.codigo_ncf}
                    onValueChange={(v) => set('codigo_ncf', v)}
                  >
                    <SelectTrigger className='h-9'>
                      <SelectValue placeholder='Por tipo documento' />
                    </SelectTrigger>
                    <SelectContent>
                      {ncfOptions.map((n: any) => (
                        <SelectItem key={n.codigo_ncf} value={n.codigo_ncf}>
                          {n.codigo_ncf} - {n.posiciones_fijas || n.tipo_ncf_fiscal || ''}
                          {n.descripcion ? ` - ${n.descripcion}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-1'>
                  <Label>Teléfono</Label>
                  <Input
                    value={form.telefono}
                    onChange={(e) => set('telefono', e.target.value)}
                    maxLength={14}
                  />
                </div>
                <div className='space-y-1'>
                  <Label>Celular</Label>
                  <Input
                    value={form.celular}
                    onChange={(e) => set('celular', e.target.value)}
                    maxLength={14}
                  />
                </div>
                <div className='col-span-2 space-y-1'>
                  <Label>Email</Label>
                  <Input
                    type='email'
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    maxLength={80}
                  />
                </div>
                <div className='col-span-2 space-y-1'>
                  <Label>
                    Dirección{' '}
                    <span className='text-xs text-muted-foreground'>
                      ({form.direccion.length}/60)
                    </span>
                  </Label>
                  <Input
                    value={form.direccion}
                    onChange={(e) => set('direccion', e.target.value)}
                    maxLength={60}
                  />
                </div>
                <div className='space-y-1'>
                  <Label>Ciudad</Label>
                  <Sel field='ciudad' opts={ciudades} valKey='ciudad' />
                </div>
                <div className='space-y-1'>
                  <Label>Barrio / Sector</Label>
                  <Sel field='barrio' opts={barrios} valKey='barrio' />
                </div>
                <div className='space-y-1'>
                  <Label>Zona</Label>
                  <Sel field='zona' opts={zonas} valKey='zona' />
                </div>
                <div className='flex items-center gap-2 pt-5'>
                  <input
                    type='checkbox'
                    checked={form.activo === 'S'}
                    onChange={(e) => set('activo', e.target.checked ? 'S' : 'N')}
                    className='h-4 w-4'
                  />
                  <Label>Activo</Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value='credito' className='pt-4'>
              <div className='grid grid-cols-3 gap-3'>
                <div className='space-y-1'>
                  <Label>Límite de Crédito</Label>
                  <Input
                    type='number'
                    value={form.limite_credito}
                    onChange={(e) => set('limite_credito', Number(e.target.value))}
                  />
                </div>
                <div className='space-y-1'>
                  <Label>Días de Crédito</Label>
                  <Input
                    type='number'
                    value={form.dias_credito}
                    onChange={(e) => set('dias_credito', Number(e.target.value))}
                  />
                </div>
                <div className='space-y-1'>
                  <Label>Cadena</Label>
                  <Sel field='cadena' opts={cadenas} valKey='no_cadena' />
                </div>
                <div className='space-y-1'>
                  <Label>Vendedor</Label>
                  <Sel field='vendedor' opts={vendedores} valKey='vendedor' labelKey='nombre' />
                </div>
                <div className='space-y-1'>
                  <Label>Ruta</Label>
                  <Sel field='ruta' opts={rutas} valKey='ruta' labelKey='descripcion' />
                </div>
              </div>
            </TabsContent>

            <TabsContent value='contactos' className='space-y-3 pt-4'>
              <div className='flex justify-end'>
                <Button size='sm' variant='outline' onClick={addContacto}>
                  <Plus className='mr-1 h-4 w-4' />
                  Agregar Contacto
                </Button>
              </div>
              {form.contactos.map((c, i) => (
                <div key={i} className='relative grid grid-cols-4 gap-2 rounded border p-3'>
                  <button
                    className='absolute top-2 right-2 text-red-500 hover:text-red-700'
                    onClick={() => removeContacto(i)}
                  >
                    <X className='h-4 w-4' />
                  </button>
                  <div className='space-y-1'>
                    <Label>Nombre</Label>
                    <Input value={c.nombre} onChange={(e) => setContacto(i, 'nombre', e.target.value)} maxLength={50} />
                  </div>
                  <div className='space-y-1'>
                    <Label>Cargo</Label>
                    <Input value={c.cargo} onChange={(e) => setContacto(i, 'cargo', e.target.value)} maxLength={80} />
                  </div>
                  <div className='space-y-1'>
                    <Label>Teléfono</Label>
                    <Input value={c.telefono} onChange={(e) => setContacto(i, 'telefono', e.target.value)} maxLength={12} />
                  </div>
                  <div className='space-y-1'>
                    <Label>Email</Label>
                    <Input value={c.email} onChange={(e) => setContacto(i, 'email', e.target.value)} maxLength={80} />
                  </div>
                </div>
              ))}
              {form.contactos.length === 0 && (
                <p className='py-4 text-center text-sm text-muted-foreground'>Sin contactos registrados</p>
              )}
            </TabsContent>

            <TabsContent value='refs' className='space-y-3 pt-4'>
              <div className='flex justify-end'>
                <Button size='sm' variant='outline' onClick={addRef}>
                  <Plus className='mr-1 h-4 w-4' />
                  Agregar Referencia
                </Button>
              </div>
              {form.referencias.map((r, i) => (
                <div key={i} className='relative grid grid-cols-3 gap-2 rounded border p-3'>
                  <button
                    className='absolute top-2 right-2 text-red-500 hover:text-red-700'
                    onClick={() => removeRef(i)}
                  >
                    <X className='h-4 w-4' />
                  </button>
                  <div className='space-y-1'>
                    <Label>Empresa</Label>
                    <Input value={r.empresa} onChange={(e) => setRef(i, 'empresa', e.target.value)} maxLength={60} />
                  </div>
                  <div className='space-y-1'>
                    <Label>Teléfono</Label>
                    <Input value={r.telefono} onChange={(e) => setRef(i, 'telefono', e.target.value)} maxLength={12} />
                  </div>
                  <div className='space-y-1'>
                    <Label>Contacto</Label>
                    <Input value={r.contacto} onChange={(e) => setRef(i, 'contacto', e.target.value)} maxLength={40} />
                  </div>
                </div>
              ))}
              {form.referencias.length === 0 && (
                <p className='py-4 text-center text-sm text-muted-foreground'>Sin referencias comerciales</p>
              )}
            </TabsContent>

            <TabsContent value='banco' className='space-y-3 pt-4'>
              <div className='flex justify-end'>
                <Button size='sm' variant='outline' onClick={addRefBanco}>
                  <Plus className='mr-1 h-4 w-4' />
                  Agregar Banco
                </Button>
              </div>
              {form.referencias_banco.map((b, i) => (
                <div key={i} className='relative grid grid-cols-3 gap-2 rounded border p-3'>
                  <button
                    className='absolute top-2 right-2 text-red-500 hover:text-red-700'
                    onClick={() => removeRefBanco(i)}
                  >
                    <X className='h-4 w-4' />
                  </button>
                  <div className='space-y-1'>
                    <Label>Banco</Label>
                    <Input value={b.banco} onChange={(e) => setRefBanco(i, 'banco', e.target.value)} />
                  </div>
                  <div className='space-y-1'>
                    <Label>No. Cuenta</Label>
                    <Input value={b.no_cuenta} onChange={(e) => setRefBanco(i, 'no_cuenta', e.target.value)} />
                  </div>
                  <div className='space-y-1'>
                    <Label>Tipo Cuenta</Label>
                    <Select
                      value={b.tipo_cuenta}
                      onValueChange={(v) => setRefBanco(i, 'tipo_cuenta', v)}
                    >
                      <SelectTrigger className='h-9'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='AH'>Ahorro</SelectItem>
                        <SelectItem value='CC'>Corriente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
              {form.referencias_banco.length === 0 && (
                <p className='py-4 text-center text-sm text-muted-foreground'>Sin referencias bancarias</p>
              )}
            </TabsContent>
          </Tabs>

          {error && <p className='mt-3 text-sm text-destructive'>{error}</p>}
        </div>

        <SheetFooter>
          <Button variant='outline' onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleGuardar} disabled={saving}>
            {saving ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Crear Cliente'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
