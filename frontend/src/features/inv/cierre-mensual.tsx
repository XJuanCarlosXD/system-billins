import { useEffect, useState } from 'react'
import { BookOpenCheck, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

interface Props { noCia: string; punto: string }

interface PuntoTrabajo {
  punto?: string
  no_punto?: string
  descripcion?: string
  [key: string]: any
}

const MESES = [
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
]

const now = new Date()
const padZ = (n: number) => String(n).padStart(2, '0')
// Last day of current month
const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
const defaultFecha = `${lastDay.getFullYear()}-${padZ(lastDay.getMonth() + 1)}-${padZ(lastDay.getDate())}`

export function CierreMensual({ noCia, punto }: Props) {
  const [mes, setMes] = useState(padZ(now.getMonth() + 1))
  const [anio, setAnio] = useState(String(now.getFullYear()))
  const [puntoSel, setPuntoSel] = useState(punto || '')
  const [fecha, setFecha] = useState(defaultFecha)
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmInput, setConfirmInput] = useState('')
  const [loading, setLoading] = useState(false)

  const [puntos, setPuntos] = useState<PuntoTrabajo[]>([])
  const [loadingPuntos, setLoadingPuntos] = useState(false)

  useEffect(() => {
    if (!noCia) return
    setLoadingPuntos(true)
    fetch(`${API_BASE}/inv/puntos/?no_cia=${encodeURIComponent(noCia)}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then((data) => {
        const items: PuntoTrabajo[] = Array.isArray(data) ? data : (data.results ?? data.items ?? [])
        setPuntos(items)
      })
      .catch(() => {
        setPuntos([])
        toast.error('No se pudieron cargar los puntos de trabajo')
      })
      .finally(() => setLoadingPuntos(false))
  }, [noCia])

  const puntoLabel = (p: PuntoTrabajo) => {
    const code = p.punto ?? p.no_punto ?? ''
    const desc = p.descripcion ?? ''
    return desc ? `${code} ${desc}` : code
  }

  const mesLabel = MESES.find(m => m.value === mes)?.label ?? mes

  const handleEjecutar = async () => {
    if (confirmInput !== 'CONFIRMAR') {
      toast.error('Debe escribir CONFIRMAR para continuar')
      return
    }
    setShowConfirm(false)
    setConfirmInput('')
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/inv/cierre/mensual/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          no_cia: noCia,
          mes,
          ano: anio,
          punto: puntoSel || punto,
          fecha,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message ?? 'Cierre mensual ejecutado exitosamente')
      } else {
        toast.error(data.error ?? `Error ${res.status}`)
      }
    } catch (e: any) {
      toast.error(e.message ?? 'Error al conectar con el servidor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className='space-y-6'>
      <div>
        <h2 className='text-lg font-semibold flex items-center gap-2'>
          <BookOpenCheck className='h-5 w-5 text-primary' />
          Cierre Mensual
        </h2>
        <p className='text-sm text-muted-foreground'>FINV403 — Proceso irreversible de cierre mensual de inventario</p>
      </div>

      {/* Advertencia */}
      <div className='flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3'>
        <AlertTriangle className='h-5 w-5 text-destructive mt-0.5 shrink-0' />
        <div>
          <p className='text-sm font-semibold text-destructive'>Acción Irreversible</p>
          <p className='text-sm text-destructive/80 mt-0.5'>
            El cierre mensual es irreversible para el período seleccionado. Una vez ejecutado, no
            podrán realizarse movimientos de inventario en ese período.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Parámetros</CardTitle>
        </CardHeader>
        <CardContent className='space-y-6'>

          {/* Mes / Año */}
          <div className='grid grid-cols-2 md:grid-cols-3 gap-4'>
            <div className='space-y-1'>
              <Label htmlFor='mes-cierre'>Mes en Proceso</Label>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger id='mes-cierre' className='h-9'>
                  <SelectValue placeholder='Mes' />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-1'>
              <Label htmlFor='anio-cierre'>Año</Label>
              <Input
                id='anio-cierre'
                className='h-9'
                type='number'
                min={2000}
                max={2099}
                value={anio}
                onChange={(e) => setAnio(e.target.value)}
              />
            </div>

            <div className='space-y-1'>
              <Label htmlFor='fecha-cierre'>Fecha de Cierre</Label>
              <Input
                id='fecha-cierre'
                className='h-9'
                type='date'
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
          </div>

          {/* Punto de Trabajo */}
          <div className='space-y-1'>
            <Label htmlFor='punto-cierre'>Punto de Trabajo</Label>
            <Select value={puntoSel} onValueChange={setPuntoSel} disabled={loadingPuntos}>
              <SelectTrigger id='punto-cierre' className='h-9 w-full md:w-[360px]'>
                <SelectValue placeholder={loadingPuntos ? 'Cargando...' : 'Seleccionar punto...'} />
              </SelectTrigger>
              <SelectContent>
                {puntos.map((p) => {
                  const code = p.punto ?? p.no_punto ?? ''
                  return (
                    <SelectItem key={code} value={code}>
                      {puntoLabel(p)}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Acción */}
          <div className='pt-2'>
            <Button
              variant='destructive'
              onClick={() => { setConfirmInput(''); setShowConfirm(true) }}
              disabled={loading}
              className='gap-2'
            >
              <BookOpenCheck className='h-4 w-4' />
              {loading ? 'Procesando...' : 'Ejecutar Cierre'}
            </Button>
          </div>

        </CardContent>
      </Card>

      {/* Doble confirmación */}
      <Dialog open={showConfirm} onOpenChange={(open) => { if (!open) setConfirmInput(''); setShowConfirm(open) }}>
        <DialogContent className='max-w-[70vw] max-h-[70vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2 text-destructive'>
              <AlertTriangle className='h-5 w-5' />
              Confirmar Cierre Mensual
            </DialogTitle>
            <DialogDescription className='space-y-2'>
              <span className='block'>
                Está a punto de ejecutar el cierre mensual para{' '}
                <strong>{mesLabel} {anio}</strong> — Punto:{' '}
                <strong>{puntoSel || punto}</strong>.
              </span>
              <span className='block text-destructive font-medium'>
                Esta acción es irreversible y bloqueará el período de inventario.
              </span>
              <span className='block mt-3'>
                Para confirmar, escriba <strong>CONFIRMAR</strong> en el campo a continuación:
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className='py-2'>
            <Input
              placeholder='Escriba CONFIRMAR'
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              className='font-mono'
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => { setConfirmInput(''); setShowConfirm(false) }}>
              Cancelar
            </Button>
            <Button
              variant='destructive'
              onClick={handleEjecutar}
              disabled={confirmInput !== 'CONFIRMAR' || loading}
            >
              {loading ? 'Ejecutando...' : 'Ejecutar Cierre'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
