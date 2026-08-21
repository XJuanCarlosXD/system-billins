// Sidesheet rápido para crear un proveedor (CXP.TCXP_DPROVEEDOR) desde
// cualquier picker que no encuentre resultados (Entrada de Compras, ODC,
// CxP, Solicitudes CHC/ACF) — mismo patrón que CrearProductoModal. Solo
// "nombre" es requerido por cxp_repo.save_proveedor (el no_proveedor lo
// asigna el backend); la ficha completa (categoría, cuenta bancaria, etc.)
// sigue en CxP › Catálogos › Proveedores para quien necesite el detalle.
import { useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

export interface ProveedorCreado {
  no_proveedor: string
  nombre: string
  rnc?: string
  direccion?: string
  telefono?: string
}

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (proveedor: ProveedorCreado) => void
  /** Prefill de nombre con el texto que el usuario ya había tecleado en el
   * buscador que disparó este modal. */
  nombreInicial?: string
}

export function CrearProveedorModal({
  open,
  onClose,
  onCreated,
  nombreInicial = '',
}: Props) {
  const [nombre, setNombre] = useState(nombreInicial)
  const [rnc, setRnc] = useState('')
  const [cedula, setCedula] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')
  const [plazoPago, setPlazoPago] = useState('0')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const reset = (prefill: string) => {
    setNombre(prefill)
    setRnc('')
    setCedula('')
    setTelefono('')
    setDireccion('')
    setPlazoPago('0')
    setError('')
  }

  const handleCrear = async () => {
    setError('')
    if (!nombre.trim()) return setError('El nombre es requerido')

    setSaving(true)
    try {
      const res: any = await api.cxpSaveProveedor({
        nombre: nombre.trim(),
        rnc: rnc.trim(),
        cedula: cedula.trim(),
        telefono: telefono.trim(),
        direccion: direccion.trim(),
        plazo_pago: parseInt(plazoPago, 10) || 0,
        activo: 'S',
      })
      const noProveedor = res?.no_proveedor ?? res?.data?.no_proveedor
      toast.success(`Proveedor ${noProveedor ?? ''} creado`)
      onCreated({
        no_proveedor: noProveedor,
        nombre: nombre.trim(),
        rnc: rnc.trim(),
        direccion: direccion.trim(),
        telefono: telefono.trim(),
      })
      reset('')
    } catch (err: any) {
      setError(err?.detail?.error ?? err?.message ?? 'Error desconocido al crear el proveedor')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset('')
          onClose()
        }
      }}
    >
      <SheetContent size='md'>
        <SheetHeader>
          <SheetTitle>Crear Proveedor</SheetTitle>
        </SheetHeader>

        <div className='flex-1 space-y-4 overflow-y-auto px-6 py-4'>
          <div className='space-y-1'>
            <Label htmlFor='cp-prov-nombre'>
              Nombre <span className='text-destructive'>*</span>
            </Label>
            <Input
              id='cp-prov-nombre'
              className='h-9'
              placeholder='Nombre o razón social'
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
            />
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-1'>
              <Label htmlFor='cp-prov-rnc'>RNC</Label>
              <Input
                id='cp-prov-rnc'
                className='h-9'
                value={rnc}
                onChange={(e) => setRnc(e.target.value)}
              />
            </div>
            <div className='space-y-1'>
              <Label htmlFor='cp-prov-cedula'>Cédula</Label>
              <Input
                id='cp-prov-cedula'
                className='h-9'
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
              />
            </div>
            <div className='space-y-1'>
              <Label htmlFor='cp-prov-telefono'>Teléfono</Label>
              <Input
                id='cp-prov-telefono'
                className='h-9'
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
              />
            </div>
            <div className='space-y-1'>
              <Label htmlFor='cp-prov-plazo'>Plazo de Pago (días)</Label>
              <Input
                id='cp-prov-plazo'
                className='h-9 text-right tabular-nums'
                type='number'
                min={0}
                value={plazoPago}
                onChange={(e) => setPlazoPago(e.target.value)}
              />
            </div>
          </div>

          <div className='space-y-1'>
            <Label htmlFor='cp-prov-direccion'>Dirección</Label>
            <Input
              id='cp-prov-direccion'
              className='h-9'
              value={direccion}
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
