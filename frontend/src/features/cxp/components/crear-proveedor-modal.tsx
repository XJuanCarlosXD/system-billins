// Sidesheet único para crear/editar proveedores (CXP.TCXP_DPROVEEDOR) —
// usado tanto en CxP › Catálogos › Proveedores (con edición) como en
// cualquier picker de proveedor que ofrezca "crear proveedor" al no
// encontrar resultados (Entrada de Compras, CxP Procesos, ODC). Mismo
// patrón que CrearProductoModal/CrearClienteModal: un solo componente,
// incluye búsqueda por RNC en la DGII para llenar más rápido (mismo
// buscador público que usa el alta de clientes).
import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import { api, regalGeneralApi } from '@/lib/regal-general-api'
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

export interface ProveedorCreado {
  no_proveedor: string
  nombre: string
  rnc?: string
  direccion?: string
  telefono?: string
}

const BLANK = {
  no_proveedor: '',
  nombre: '',
  rnc: '',
  cedula: '',
  telefono: '',
  celular: '',
  e_mail: '',
  direccion: '',
  plazo_pago: 0,
  activo: 'S',
  excento_itbis: 'N',
  categoria: '',
  clasificacion: '',
  cuenta_banco: '',
  codigo_banco: '',
  tipo_cuenta: '',
}

interface Props {
  open: boolean
  onClose: () => void
  /** Se llama tras crear un proveedor nuevo con éxito. */
  onCreated?: (proveedor: ProveedorCreado) => void
  /** Se llama tras editar un proveedor existente con éxito. */
  onUpdated?: () => void
  /** Prefill de nombre con el texto que el usuario ya había tecleado en el
   * buscador que disparó este modal. Solo aplica al crear. */
  nombreInicial?: string
  /** Si se define, el sheet abre en modo edición para este no_proveedor. */
  editingNoProveedor?: string | null
}

export function CrearProveedorModal({
  open,
  onClose,
  onCreated,
  onUpdated,
  nombreInicial = '',
  editingNoProveedor = null,
}: Props) {
  const isEdit = !!editingNoProveedor
  const [form, setForm] = useState<typeof BLANK>({ ...BLANK })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [buscandoRnc, setBuscandoRnc] = useState(false)
  const [rncLookupMsg, setRncLookupMsg] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setRncLookupMsg('')
    if (isEdit && editingNoProveedor) {
      api
        .cxpGetProveedor(editingNoProveedor)
        .then((p: any) => setForm({ ...BLANK, ...p }))
        .catch((err: any) => setError(err?.message ?? 'No se pudo cargar el proveedor'))
    } else {
      setForm({ ...BLANK, nombre: nombreInicial })
    }
  }, [open, isEdit, editingNoProveedor, nombreInicial])

  const set = (k: keyof typeof BLANK, v: any) => setForm((f) => ({ ...f, [k]: v }))

  const buscarPorRnc = async () => {
    const rnc = (form.rnc || form.cedula || '').trim()
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
        nombre: f.nombre || r.nombre || f.nombre,
      }))
      const estadoTxt = r.estado ? ` (estado DGII: ${r.estado})` : ''
      setRncLookupMsg(`Encontrado: ${r.nombre}${estadoTxt}.`)
    } catch {
      setRncLookupMsg('No se pudo consultar la DGII ahora mismo — sigue llenando a mano.')
    } finally {
      setBuscandoRnc(false)
    }
  }

  const handleGuardar = async () => {
    setError('')
    if (!form.nombre.trim()) return setError('El nombre es requerido')

    setSaving(true)
    try {
      const res: any = await api.cxpSaveProveedor({
        ...form,
        no_proveedor: isEdit ? editingNoProveedor : '',
        nombre: form.nombre.trim(),
      })
      const noProveedor = isEdit ? editingNoProveedor : res?.no_proveedor ?? res?.data?.no_proveedor
      toast.success(isEdit ? `Proveedor ${noProveedor} actualizado` : `Proveedor ${noProveedor ?? ''} creado`)
      if (isEdit) {
        onUpdated?.()
      } else {
        onCreated?.({
          no_proveedor: noProveedor,
          nombre: form.nombre.trim(),
          rnc: form.rnc,
          direccion: form.direccion,
          telefono: form.telefono,
        })
      }
    } catch (err: any) {
      setError(err?.detail?.error ?? err?.message ?? 'Error desconocido al guardar el proveedor')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <SheetContent size='md'>
        <SheetHeader>
          <SheetTitle>
            {isEdit ? `Editar Proveedor ${editingNoProveedor}` : 'Crear Proveedor'}
          </SheetTitle>
        </SheetHeader>

        <div className='flex-1 overflow-y-auto px-6 py-4'>
          <Tabs defaultValue='general'>
            <TabsList>
              <TabsTrigger value='general'>General</TabsTrigger>
              <TabsTrigger value='fiscal'>Datos Fiscales</TabsTrigger>
              <TabsTrigger value='banco'>Cuenta Bancaria</TabsTrigger>
            </TabsList>

            <TabsContent value='general' className='mt-3 space-y-3'>
              <div className='grid grid-cols-2 gap-3'>
                <div className='col-span-2 space-y-1'>
                  <Label>
                    Nombre <span className='text-destructive'>*</span>
                  </Label>
                  <Input
                    value={form.nombre}
                    onChange={(e) => set('nombre', e.target.value)}
                    autoFocus
                  />
                </div>
                <div className='space-y-1'>
                  <Label>Teléfono</Label>
                  <Input value={form.telefono} onChange={(e) => set('telefono', e.target.value)} />
                </div>
                <div className='space-y-1'>
                  <Label>Celular</Label>
                  <Input value={form.celular} onChange={(e) => set('celular', e.target.value)} />
                </div>
                <div className='col-span-2 space-y-1'>
                  <Label>Dirección</Label>
                  <Input value={form.direccion} onChange={(e) => set('direccion', e.target.value)} />
                </div>
                <div className='space-y-1'>
                  <Label>Correo</Label>
                  <Input value={form.e_mail} onChange={(e) => set('e_mail', e.target.value)} />
                </div>
                <div className='space-y-1'>
                  <Label>Plazo de Pago (días)</Label>
                  <Input
                    type='number'
                    value={form.plazo_pago}
                    onChange={(e) => set('plazo_pago', +e.target.value)}
                  />
                </div>
                <div className='space-y-1'>
                  <Label>Estado</Label>
                  <Select value={form.activo} onValueChange={(v) => set('activo', v)}>
                    <SelectTrigger className='h-9'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='S'>Activo</SelectItem>
                      <SelectItem value='N'>Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value='fiscal' className='mt-3 space-y-3'>
              <div className='grid grid-cols-2 gap-3'>
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
                      placeholder='RNC'
                      className='flex-1'
                    />
                    <Input
                      value={form.cedula}
                      onChange={(e) => set('cedula', e.target.value)}
                      placeholder='Cédula'
                      className='flex-1'
                    />
                    <Button
                      type='button'
                      variant='secondary'
                      size='sm'
                      onClick={buscarPorRnc}
                      disabled={buscandoRnc}
                      className='shrink-0'
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
                  <Label>Categoría</Label>
                  <Input value={form.categoria} onChange={(e) => set('categoria', e.target.value)} />
                </div>
                <div className='space-y-1'>
                  <Label>Clasificación</Label>
                  <Input value={form.clasificacion} onChange={(e) => set('clasificacion', e.target.value)} />
                </div>
                <div className='space-y-1'>
                  <Label>Exento ITBIS</Label>
                  <Select value={form.excento_itbis} onValueChange={(v) => set('excento_itbis', v)}>
                    <SelectTrigger className='h-9'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='N'>No</SelectItem>
                      <SelectItem value='S'>Sí</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value='banco' className='mt-3 space-y-3'>
              <div className='grid grid-cols-2 gap-3'>
                <div className='space-y-1'>
                  <Label>No. Cuenta</Label>
                  <Input value={form.cuenta_banco} onChange={(e) => set('cuenta_banco', e.target.value)} />
                </div>
                <div className='space-y-1'>
                  <Label>Código Banco</Label>
                  <Input value={form.codigo_banco} onChange={(e) => set('codigo_banco', e.target.value)} />
                </div>
                <div className='space-y-1'>
                  <Label>Tipo de Cuenta</Label>
                  <Select value={form.tipo_cuenta} onValueChange={(v) => set('tipo_cuenta', v)}>
                    <SelectTrigger className='h-9'>
                      <SelectValue placeholder='—' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='C'>Corriente</SelectItem>
                      <SelectItem value='A'>Ahorros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {error && <p className='mt-3 text-sm text-destructive'>{error}</p>}
        </div>

        <SheetFooter>
          <Button variant='outline' onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleGuardar} disabled={saving}>
            {saving ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Crear Proveedor'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
