import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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

export function CierreEntradaDiario({ noCia, punto }: Props) {
  const [mes, setMes] = useState(padZ(now.getMonth() + 1))
  const [anio, setAnio] = useState(String(now.getFullYear()))
  const [puntoSel, setPuntoSel] = useState(punto || '')
  const [fecha, setFecha] = useState(todayIso)
  const [tipo, setTipo] = useState<'detallado' | 'resumido'>('detallado')
  const [printing, setPrinting] = useState(false)

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

  const handleImprimir = () => {
    if (!mes || !anio) {
      toast.error('Indique el Mes y Año en proceso')
      return
    }
    setPrinting(true)
    const qs = new URLSearchParams({
      no_cia: noCia,
      punto: puntoSel || punto,
      mes,
      ano: anio,
      tipo,
      fecha,
    })
    const url = `${API_BASE}/inv/cierre/entrada-diario/pdf/?${qs.toString()}`
    const win = window.open(url, '_blank')
    if (!win) {
      toast.error('El navegador bloqueó la ventana emergente. Permita las ventanas emergentes e intente de nuevo.')
    } else {
      toast.success('Generando PDF de Entrada de Diario...')
    }
    setPrinting(false)
  }

  return (
    <section className='space-y-6'>
      <div>
        <h2 className='text-lg font-semibold flex items-center gap-2'>
          <Printer className='h-5 w-5 text-primary' />
          Impresión Entrada de Diario
        </h2>
        <p className='text-sm text-muted-foreground'>FINV401 — Soporte de entrada de diario del cierre de inventario</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Parámetros</CardTitle>
        </CardHeader>
        <CardContent className='space-y-6'>

          {/* Mes / Año */}
          <div className='grid grid-cols-2 md:grid-cols-3 gap-4'>
            <div className='space-y-1'>
              <Label htmlFor='mes-proceso'>Mes en Proceso</Label>
              <Select value={mes} onValueChange={setMes}>
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
              <Label htmlFor='anio-proceso'>Año en Proceso</Label>
              <Input
                id='anio-proceso'
                className='h-9'
                type='number'
                min={2000}
                max={2099}
                value={anio}
                onChange={(e) => setAnio(e.target.value)}
              />
            </div>

            <div className='space-y-1'>
              <Label htmlFor='fecha-cierre'>Fecha</Label>
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

          {/* Tipo de reporte */}
          <div className='space-y-2'>
            <Label>Tipo de Reporte</Label>
            <RadioGroup
              value={tipo}
              onValueChange={(v) => setTipo(v as 'detallado' | 'resumido')}
              className='flex gap-6'
            >
              <div className='flex items-center gap-2'>
                <RadioGroupItem value='detallado' id='tipo-detallado' />
                <Label htmlFor='tipo-detallado' className='font-normal cursor-pointer'>
                  Soporte Entrada de Diario Detallado
                </Label>
              </div>
              <div className='flex items-center gap-2'>
                <RadioGroupItem value='resumido' id='tipo-resumido' />
                <Label htmlFor='tipo-resumido' className='font-normal cursor-pointer'>
                  Entrada de Diario
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Acción */}
          <div className='pt-2'>
            <Button
              onClick={handleImprimir}
              disabled={printing}
              className='gap-2'
            >
              <Printer className='h-4 w-4' />
              {printing ? 'Generando...' : 'Imprimir'}
            </Button>
            <p className='mt-2 text-xs text-muted-foreground'>
              Se abrirá el PDF en una nueva pestaña del navegador.
            </p>
          </div>

        </CardContent>
      </Card>
    </section>
  )
}
