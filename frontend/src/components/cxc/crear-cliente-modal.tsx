// Sidesheet rápido para crear un cliente (CXC.TCXC_CLIENTE) desde cualquier
// picker que no encuentre resultados (FAT nueva factura, CxC transacciones,
// etc.) — mismo patrón que CrearProductoModal. Cubre los campos requeridos
// por cxc_repo.save_cliente (nombre, tipo de cliente, tipo contable) más los
// más usados; la ficha completa (contactos, referencias, banco) sigue en
// Mantenimiento de Clientes (CxC › Catálogos) para quien necesite el detalle.
import { useEffect, useState } from 'react'
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
import type { Cliente } from './cliente-picker'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (cliente: Cliente) => void
  noCia: string
  punto?: string
  /** Prefill de nombre con el texto que el usuario ya había tecleado en el
   * buscador que disparó este modal. */
  nombreInicial?: string
}

interface CatalogItem {
  [key: string]: unknown
}

function catalogCode(item: CatalogItem, ...keys: string[]): string {
  for (const k of keys) {
    const v = item[k]
    if (v !== undefined && v !== null && v !== '') return String(v)
  }
  return ''
}

export function CrearClienteModal({
  open,
  onClose,
  onCreated,
  noCia,
  punto = '01',
  nombreInicial = '',
}: Props) {
  const [nombre, setNombre] = useState('')
  const [rnc, setRnc] = useState('')
  const [tipoPersona, setTipoPersona] = useState<'J' | 'F'>('J')
  const [tipoCliente, setTipoCliente] = useState('')
  const [tipoContable, setTipoContable] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')
  const [vendedor, setVendedor] = useState('')

  const [tclis, setTclis] = useState<CatalogItem[]>([])
  const [tcontables, setTcontables] = useState<CatalogItem[]>([])
  const [vendedores, setVendedores] = useState<CatalogItem[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setNombre(nombreInicial)
    setRnc('')
    setTipoPersona('J')
    setTipoCliente('')
    setTipoContable('')
    setTelefono('')
    setDireccion('')
    setVendedor('')
    setError('')

    regalGeneralApi
      .cxcListTcli(noCia)
      .then((r: any) => setTclis(Array.isArray(r) ? r : []))
      .catch(() => setTclis([]))
    regalGeneralApi
      .cxcListTcontable(noCia)
      .then((r: any) => setTcontables(Array.isArray(r) ? r : []))
      .catch(() => setTcontables([]))
    regalGeneralApi
      .cxcListVendedores(noCia)
      .then((r: any) => setVendedores(Array.isArray(r) ? r : []))
      .catch(() => setVendedores([]))
  }, [open, noCia, nombreInicial])

  const handleCrear = async () => {
    setError('')
    if (!nombre.trim()) return setError('El nombre es requerido')
    if (nombre.trim().length > 40) return setError('El nombre supera los 40 caracteres')
    if (!tipoCliente) return setError('Seleccione el tipo de cliente')
    if (!tipoContable) return setError('Seleccione el tipo contable')

    setSaving(true)
    try {
      const res = await regalGeneralApi.cxcSaveCliente({
        no_cia: noCia,
        punto,
        nombre_cliente: nombre.trim(),
        rnc: rnc.trim(),
        tipo_persona: tipoPersona,
        tipo_cli: tipoCliente,
        tipo_conta: tipoContable,
        telefono: telefono.trim(),
        direccion: direccion.trim(),
        vendedor,
        activo: 'S',
      })
      const noCliente = res?.no_cliente ?? res?.data?.no_cliente
      toast.success(`Cliente ${noCliente ?? ''} creado`)
      onCreated({
        no_cliente: noCliente,
        nombre: nombre.trim(),
        nombre_cliente: nombre.trim(),
        rnc: rnc.trim(),
        direccion: direccion.trim(),
        telefono: telefono.trim(),
      })
    } catch (err: any) {
      setError(err?.detail?.error ?? err?.message ?? 'Error desconocido al crear el cliente')
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
          <SheetTitle>Crear Cliente</SheetTitle>
        </SheetHeader>

        <div className='flex-1 space-y-4 overflow-y-auto px-6 py-4'>
          <div className='space-y-1'>
            <Label htmlFor='cc-nombre'>
              Nombre <span className='text-destructive'>*</span>
            </Label>
            <Input
              id='cc-nombre'
              className='h-9'
              placeholder='Nombre del cliente'
              value={nombre}
              maxLength={40}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
            />
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-1'>
              <Label htmlFor='cc-rnc'>RNC / Cédula</Label>
              <Input
                id='cc-rnc'
                className='h-9'
                value={rnc}
                maxLength={16}
                onChange={(e) => setRnc(e.target.value)}
              />
            </div>
            <div className='space-y-1'>
              <Label htmlFor='cc-persona'>Tipo Persona</Label>
              <Select value={tipoPersona} onValueChange={(v) => setTipoPersona(v as 'J' | 'F')}>
                <SelectTrigger id='cc-persona' className='h-9'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='J'>Jurídico</SelectItem>
                  <SelectItem value='F'>Físico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-1'>
              <Label htmlFor='cc-tipo-cli'>
                Tipo de Cliente <span className='text-destructive'>*</span>
              </Label>
              <Select value={tipoCliente} onValueChange={setTipoCliente}>
                <SelectTrigger id='cc-tipo-cli' className='h-9'>
                  <SelectValue placeholder='Seleccionar...' />
                </SelectTrigger>
                <SelectContent>
                  {tclis.map((t) => {
                    const code = catalogCode(t, 'tipo_cliente')
                    return (
                      <SelectItem key={code} value={code}>
                        {code} — {String(t.descripcion ?? '')}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-1'>
              <Label htmlFor='cc-tipo-conta'>
                Tipo Contable <span className='text-destructive'>*</span>
              </Label>
              <Select value={tipoContable} onValueChange={setTipoContable}>
                <SelectTrigger id='cc-tipo-conta' className='h-9'>
                  <SelectValue placeholder='Seleccionar...' />
                </SelectTrigger>
                <SelectContent>
                  {tcontables.map((t) => {
                    const code = catalogCode(t, 'tipo_contable')
                    return (
                      <SelectItem key={code} value={code}>
                        {code} — {String(t.descripcion ?? '')}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-1'>
              <Label htmlFor='cc-telefono'>Teléfono</Label>
              <Input
                id='cc-telefono'
                className='h-9'
                value={telefono}
                maxLength={14}
                onChange={(e) => setTelefono(e.target.value)}
              />
            </div>

            <div className='space-y-1'>
              <Label htmlFor='cc-vendedor'>Vendedor</Label>
              <Select value={vendedor} onValueChange={setVendedor}>
                <SelectTrigger id='cc-vendedor' className='h-9'>
                  <SelectValue placeholder='Sin asignar' />
                </SelectTrigger>
                <SelectContent>
                  {vendedores.map((v) => {
                    const code = catalogCode(v, 'vendedor')
                    return (
                      <SelectItem key={code} value={code}>
                        {code} — {String(v.nombre ?? '')}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className='space-y-1'>
            <Label htmlFor='cc-direccion'>Dirección</Label>
            <Input
              id='cc-direccion'
              className='h-9'
              value={direccion}
              maxLength={60}
              onChange={(e) => setDireccion(e.target.value)}
            />
          </div>

          {error && <p className='text-sm text-destructive'>{error}</p>}
        </div>

        <SheetFooter>
          <Button variant='outline' onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleCrear} disabled={saving}>
            {saving ? 'Creando...' : 'Crear y continuar'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
