import { useEffect, useState } from 'react'
import { AlertTriangle, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

interface Props {
  noCia: string
  punto: string
}

const MESES = [
  { value: '1', label: 'Enero' },
  { value: '2', label: 'Febrero' },
  { value: '3', label: 'Marzo' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Mayo' },
  { value: '6', label: 'Junio' },
  { value: '7', label: 'Julio' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
]

export function AjusteConteoFisico({ noCia, punto }: Props) {
  const now = new Date()
  const [mes, setMes] = useState(String(now.getMonth() + 1))
  const [anio, setAnio] = useState(String(now.getFullYear()))
  const [tasaUsd, setTasaUsd] = useState('')
  const [noLocalidad, setNoLocalidad] = useState('')
  const [almacen, setAlmacen] = useState('')
  const [noProducto, setNoProducto] = useState('')
  const [fecha, setFecha] = useState(now.toISOString().slice(0, 10))

  const [almacenes, setAlmacenes] = useState<any[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    if (!noCia) return
    apiFetch<any>(`/inv/almacenes/?no_cia=${noCia}`)
      .then((d) => setAlmacenes(Array.isArray(d) ? d : d.items ?? d.results ?? []))
      .catch(() => {})
  }, [noCia])

  async function handleEjecutar() {
    setExecuting(true)
    setResultado(null)
    try {
      const res = await fetch(`${API_BASE}/inv/conteo-fisico/ajustar/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          no_cia: noCia,
          punto,
          mes: Number(mes),
          anio: Number(anio),
          tasa_usd: tasaUsd ? Number(tasaUsd) : undefined,
          no_localidad: noLocalidad || undefined,
          almacen: almacen || undefined,
          no_producto: noProducto || undefined,
          fecha,
        }),
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        setResultado({ ok: true, msg: data?.detail ?? 'Ajuste ejecutado exitosamente.' })
      } else {
        const err = await res.json().catch(() => ({}))
        setResultado({ ok: false, msg: err?.detail ?? `Error HTTP ${res.status}` })
      }
    } catch {
      setResultado({ ok: false, msg: 'No se pudo conectar con el servidor. El endpoint puede estar en construcción.' })
    } finally {
      setExecuting(false)
    }
  }

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-lg font-semibold'>Ajuste Conteo Físico vs Existencia en Libro</h2>
        <p className='text-sm text-muted-foreground'>
          FINV705 — Ajusta el inventario en base al conteo físico capturado. Operación irreversible.
        </p>
      </div>

      <div className='rounded-md border p-5 bg-muted/20 space-y-5'>
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
          <div className='space-y-1.5'>
            <Label>Mes en Proceso</Label>
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger className='h-9'><SelectValue /></SelectTrigger>
              <SelectContent>
                {MESES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-1.5'>
            <Label>Año en Proceso</Label>
            <Input
              type='number'
              className='h-9'
              min={2000}
              max={2100}
              value={anio}
              onChange={(e) => setAnio(e.target.value)}
            />
          </div>

          <div className='space-y-1.5'>
            <Label>Tasa USD</Label>
            <Input
              type='number'
              className='h-9'
              step='0.01'
              min={0}
              placeholder='Ej: 36.50'
              value={tasaUsd}
              onChange={(e) => setTasaUsd(e.target.value)}
            />
          </div>

          <div className='space-y-1.5'>
            <Label>No. Localidad</Label>
            <Input
              className='h-9'
              placeholder='Código de localidad'
              value={noLocalidad}
              onChange={(e) => setNoLocalidad(e.target.value)}
            />
          </div>

          <div className='space-y-1.5'>
            <Label>Almacén</Label>
            <Select value={almacen || '__all__'} onValueChange={(v) => setAlmacen(v === '__all__' ? '' : v)}>
              <SelectTrigger className='h-9'><SelectValue placeholder='Todos los almacenes' /></SelectTrigger>
              <SelectContent>
                <SelectItem value='__all__'>Todos los almacenes</SelectItem>
                {almacenes.map((a: any) => {
                  const key = a.almacen ?? a.codigo ?? a.id
                  return (
                    <SelectItem key={key} value={String(key)}>
                      {a.descripcion ?? a.desc_almacen ?? key}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-1.5'>
            <Label>No. Producto</Label>
            <Input
              className='h-9'
              placeholder='Opcional — todos si vacío'
              value={noProducto}
              onChange={(e) => setNoProducto(e.target.value)}
            />
          </div>

          <div className='space-y-1.5'>
            <Label>Fecha</Label>
            <Input
              type='date'
              className='h-9'
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
        </div>

        <div className='pt-2 border-t'>
          <Button
            variant='destructive'
            className='gap-2'
            onClick={() => { setResultado(null); setDialogOpen(true) }}
          >
            <Play className='h-4 w-4' />
            Ejecutar Ajuste
          </Button>
        </div>
      </div>

      {/* Dialog de confirmación */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='max-w-[70vw] max-h-[70vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <AlertTriangle className='h-5 w-5 text-destructive' />
              Confirmar Ajuste de Inventario
            </DialogTitle>
            <DialogDescription asChild>
              <div className='space-y-3 pt-2'>
                <p className='text-sm rounded-md bg-destructive/10 border border-destructive/30 text-destructive px-3 py-2 font-medium'>
                  Esta accion ajustara el inventario segun el conteo fisico. No se puede deshacer.
                </p>
                <div className='text-sm space-y-1'>
                  <p><span className='font-medium'>Periodo:</span> {MESES.find((m) => m.value === mes)?.label} {anio}</p>
                  {almacen && <p><span className='font-medium'>Almacen:</span> {almacen}</p>}
                  {noProducto && <p><span className='font-medium'>Producto:</span> {noProducto}</p>}
                  <p><span className='font-medium'>Fecha:</span> {fecha}</p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>

          {resultado && (
            <Badge
              variant={resultado.ok ? 'outline' : 'destructive'}
              className='text-xs w-fit'
            >
              {resultado.msg}
            </Badge>
          )}

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setDialogOpen(false)}
              disabled={executing}
            >
              Cancelar
            </Button>
            <Button
              variant='destructive'
              disabled={executing || resultado?.ok === true}
              onClick={handleEjecutar}
            >
              {executing ? 'Ejecutando...' : 'Confirmar Ajuste'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
