import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

interface Props { noCia: string; punto: string }

interface Almacen {
  no_almacen: string
  descripcion: string
}

interface Producto {
  no_produ: string
  descripcion: string
  existencia?: number
  costo?: number
  [key: string]: any
}

type Alcance = 'almacen' | 'punto' | 'empresa'

const ENDPOINT_EXISTE = false // Cambiar a true cuando el backend esté listo

async function fetchAlmacenes(noCia: string): Promise<Almacen[]> {
  const res = await fetch(`${API_BASE}/inv/almacenes/?no_cia=${encodeURIComponent(noCia)}`, {
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`Error ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : (data.results ?? [])
}

async function fetchProducto(noProdu: string): Promise<Producto> {
  const res = await fetch(`${API_BASE}/inv/productos/${encodeURIComponent(noProdu)}/`, {
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`Producto no encontrado (${res.status})`)
  return res.json()
}

export function ModificarCosto({ noCia, punto }: Props) {
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [almacen, setAlmacen] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [producto, setProducto] = useState<Producto | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null)
  const [nuevoCosto, setNuevoCosto] = useState('')
  const [alcance, setAlcance] = useState<Alcance>('almacen')
  const [observacion, setObservacion] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (noCia) {
      fetchAlmacenes(noCia).then(setAlmacenes).catch(() => {})
    }
  }, [noCia])

  const buscarProducto = async () => {
    const noProdu = busqueda.trim()
    if (!noProdu) return
    setBuscando(true)
    setErrorBusqueda(null)
    setProducto(null)
    setNuevoCosto('')
    try {
      const prod = await fetchProducto(noProdu)
      setProducto(prod)
    } catch (err: any) {
      setErrorBusqueda(err.message ?? 'Error al buscar producto')
    } finally {
      setBuscando(false)
    }
  }

  const guardar = async () => {
    if (!ENDPOINT_EXISTE || !producto || !almacen || !nuevoCosto) return
    setSaving(true)
    setSaveMsg(null)
    setSaveError(null)
    try {
      const res = await fetch(`${API_BASE}/inv/modificar-costo/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          no_cia: noCia,
          almacen,
          no_produ: producto.no_produ,
          nuevo_costo: parseFloat(nuevoCosto),
          alcance,
          observacion,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail ?? `Error ${res.status}`)
      }
      setSaveMsg('Costo modificado exitosamente.')
      setProducto(null)
      setBusqueda('')
      setNuevoCosto('')
      setObservacion('')
    } catch (err: any) {
      setSaveError(err.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const puedeGuardar = ENDPOINT_EXISTE && !!producto && !!almacen && !!nuevoCosto && !saving

  return (
    <TooltipProvider>
      <section className='space-y-6 max-w-2xl'>
        <div>
          <h2 className='text-lg font-semibold'>Modificar Costo</h2>
          <p className='text-sm text-muted-foreground'>Ajuste manual del costo de un producto (FINV114).</p>
        </div>

        {/* Almacén */}
        <div className='space-y-2'>
          <Label>Almacén</Label>
          <Select value={almacen} onValueChange={setAlmacen}>
            <SelectTrigger className='w-72'>
              <SelectValue placeholder='Seleccionar almacén...' />
            </SelectTrigger>
            <SelectContent>
              {almacenes.map((a) => (
                <SelectItem key={a.no_almacen} value={a.no_almacen}>
                  {a.no_almacen} — {a.descripcion}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Buscar producto */}
        <div className='space-y-2'>
          <Label>No. Producto</Label>
          <div className='flex gap-2'>
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && buscarProducto()}
              placeholder='Ej: 00001'
              className='w-48'
            />
            <Button variant='outline' size='sm' onClick={buscarProducto} disabled={buscando}>
              <Search className='mr-1 h-4 w-4' />
              {buscando ? 'Buscando...' : 'Buscar'}
            </Button>
          </div>
          {errorBusqueda && (
            <p className='text-xs text-red-500'>{errorBusqueda}</p>
          )}
        </div>

        {/* Datos del producto */}
        {producto && (
          <div className='rounded-lg border bg-muted/30 p-4 space-y-4'>
            <div className='grid grid-cols-2 gap-3 text-sm'>
              <div>
                <p className='text-xs text-muted-foreground'>No. Producto</p>
                <p className='font-mono font-medium'>{producto.no_produ}</p>
              </div>
              <div>
                <p className='text-xs text-muted-foreground'>Descripción</p>
                <p>{producto.descripcion ?? producto.nombre ?? '—'}</p>
              </div>
              <div>
                <p className='text-xs text-muted-foreground'>Existencia Actual</p>
                <p className='font-medium'>{producto.existencia ?? '—'}</p>
              </div>
              <div>
                <p className='text-xs text-muted-foreground'>Costo Anterior</p>
                <p className='font-medium text-muted-foreground'>
                  {producto.costo != null ? Number(producto.costo).toFixed(4) : '—'}
                </p>
              </div>
            </div>

            <div className='space-y-2'>
              <Label>Nuevo Costo</Label>
              <Input
                type='number'
                step='0.0001'
                min='0'
                value={nuevoCosto}
                onChange={(e) => setNuevoCosto(e.target.value)}
                placeholder='0.0000'
                className='w-40'
              />
            </div>

            <div className='space-y-2'>
              <Label>Observación</Label>
              <Input
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                placeholder='Motivo del ajuste...'
              />
            </div>

            <div className='space-y-2'>
              <Label>Modificar costo en:</Label>
              <RadioGroup value={alcance} onValueChange={(v) => setAlcance(v as Alcance)} className='flex flex-col gap-1'>
                <div className='flex items-center gap-2'>
                  <RadioGroupItem value='almacen' id='alcance-almacen' />
                  <Label htmlFor='alcance-almacen' className='font-normal cursor-pointer'>Solo este almacén</Label>
                </div>
                <div className='flex items-center gap-2'>
                  <RadioGroupItem value='punto' id='alcance-punto' />
                  <Label htmlFor='alcance-punto' className='font-normal cursor-pointer'>Todos los almacenes del punto</Label>
                </div>
                <div className='flex items-center gap-2'>
                  <RadioGroupItem value='empresa' id='alcance-empresa' />
                  <Label htmlFor='alcance-empresa' className='font-normal cursor-pointer'>Todos los almacenes de la empresa</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        )}

        {saveMsg && (
          <div className='rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400'>
            {saveMsg}
          </div>
        )}
        {saveError && (
          <p className='text-sm text-red-500'>{saveError}</p>
        )}

        <div className='pt-2'>
          {ENDPOINT_EXISTE ? (
            <Button onClick={guardar} disabled={!puedeGuardar}>
              {saving ? 'Guardando...' : 'Guardar Cambio de Costo'}
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button disabled>Guardar Cambio de Costo</Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Endpoint en construcción — POST /api/inv/modificar-costo/</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Contexto */}
        <p className='text-xs text-muted-foreground'>Cía: {noCia} | Punto: {punto}</p>
      </section>
    </TooltipProvider>
  )
}
