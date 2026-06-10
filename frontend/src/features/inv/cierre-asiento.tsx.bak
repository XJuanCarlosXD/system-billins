import { useEffect, useState } from 'react'
import { Calculator } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
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
const todayIso = `${now.getFullYear()}-${padZ(now.getMonth() + 1)}-${padZ(now.getDate())}`

export function CierreAsiento({ noCia, punto }: Props) {
  const [mesProceso, setMesProceso] = useState(padZ(now.getMonth() + 1))
  const [anioProceso, setAnioProceso] = useState(String(now.getFullYear()))
  const [mesCont, setMesCont] = useState(padZ(now.getMonth() + 1))
  const [anioCont, setAnioCont] = useState(String(now.getFullYear()))
  const [puntoSel, setPuntoSel] = useState(punto || '')
  const [fecha, setFecha] = useState(todayIso)
  const [cierrePeriodo, setCierrePeriodo] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
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

  const handleGenerar = async () => {
    setShowConfirm(false)
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/inv/cierre/generar-asiento/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          no_cia: noCia,
          mes_proceso: mesProceso,
          ano_proceso: anioProceso,
          mes_cont: mesCont,
          ano_cont: anioCont,
          punto: puntoSel || punto,
          fecha,
          cierre_periodo: cierrePeriodo,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message ?? 'Asiento generado exitosamente')
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
          <Calculator className='h-5 w-5 text-primary' />
          Generar Asiento al Mayor
        </h2>
        <p className='text-sm text-muted-foreground'>FINV402 — Genera el asiento contable del período de inventario</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Parámetros</CardTitle>
        </CardHeader>
        <CardContent className='space-y-6'>

          {/* Mes/Año Proceso */}
          <div>
            <p className='text-sm font-medium mb-2'>Mes y Año en Proceso</p>
            <div className='grid grid-cols-2 gap-4 md:w-[360px]'>
              <div className='space-y-1'>
                <Label htmlFor='mes-proceso'>Mes</Label>
                <Select value={mesProceso} onValueChange={setMesProceso}>
                  <SelectTrigger id='mes-proceso' className='h-9'>
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
                <Label htmlFor='anio-proceso'>Año</Label>
                <Input
                  id='anio-proceso'
                  className='h-9'
                  type='number'
                  min={2000}
                  max={2099}
                  value={anioProceso}
                  onChange={(e) => setAnioProceso(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Mes/Año Contabilidad */}
          <div>
            <p className='text-sm font-medium mb-2'>Mes y Año Contabilidad</p>
            <div className='grid grid-cols-2 gap-4 md:w-[360px]'>
              <div className='space-y-1'>
                <Label htmlFor='mes-cont'>Mes</Label>
                <Select value={mesCont} onValueChange={setMesCont}>
                  <SelectTrigger id='mes-cont' className='h-9'>
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
                <Label htmlFor='anio-cont'>Año</Label>
                <Input
                  id='anio-cont'
                  className='h-9'
                  type='number'
                  min={2000}
                  max={2099}
                  value={anioCont}
                  onChange={(e) => setAnioCont(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Punto de Trabajo */}
          <div className='space-y-1'>
            <Label htmlFor='punto-trabajo'>Punto de Trabajo</Label>
            <Select value={puntoSel} onValueChange={setPuntoSel} disabled={loadingPuntos}>
              <SelectTrigger id='punto-trabajo' className='h-9 w-full md:w-[360px]'>
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

          {/* Fecha */}
          <div className='space-y-1'>
            <Label htmlFor='fecha-asiento'>Fecha</Label>
            <Input
              id='fecha-asiento'
              className='h-9 md:w-[200px]'
              type='date'
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>

          {/* Cierre del Período Fiscal */}
          <div className='flex items-center gap-3'>
            <Switch
              id='cierre-periodo'
              checked={cierrePeriodo}
              onCheckedChange={setCierrePeriodo}
            />
            <Label htmlFor='cierre-periodo' className='cursor-pointer'>
              Cierre del Período Fiscal: <strong>{cierrePeriodo ? 'Sí' : 'No'}</strong>
            </Label>
          </div>

          {/* Acción */}
          <div className='pt-2'>
            <Button
              onClick={() => setShowConfirm(true)}
              disabled={loading}
              className='gap-2'
            >
              <Calculator className='h-4 w-4' />
              {loading ? 'Generando...' : 'Generar Asiento'}
            </Button>
          </div>

        </CardContent>
      </Card>

      {/* Confirmación */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Generación de Asiento</DialogTitle>
            <DialogDescription>
              Se generará el asiento contable para el período{' '}
              <strong>{MESES.find(m => m.value === mesProceso)?.label} {anioProceso}</strong>{' '}
              con contabilidad en{' '}
              <strong>{MESES.find(m => m.value === mesCont)?.label} {anioCont}</strong>.
              {cierrePeriodo && (
                <span className='block mt-1 text-amber-600 font-medium'>
                  Incluye cierre del período fiscal.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setShowConfirm(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGenerar} disabled={loading}>
              {loading ? 'Procesando...' : 'Confirmar y Generar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
