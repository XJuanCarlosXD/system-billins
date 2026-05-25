import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

interface Props { noCia: string; punto: string }

interface TipoDocu {
  tipo_docu?: string
  tipo_doc?: string
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

const TAMANOS_HOJA = [
  { value: 'CARTA', label: 'Carta' },
  { value: 'LEGAL', label: 'Legal' },
  { value: 'OFICIO', label: 'Oficio' },
]

const now = new Date()
const padZ = (n: number) => String(n).padStart(2, '0')

export function ImpresionDocumentos({ noCia, punto }: Props) {
  const [mes, setMes] = useState(padZ(now.getMonth() + 1))
  const [anio, setAnio] = useState(String(now.getFullYear()))
  const [sucursal, setSucursal] = useState(punto || '')
  const [localidad, setLocalidad] = useState('')
  const [modoImpresion, setModoImpresion] = useState<'imprimir' | 'reimprimir'>('imprimir')
  const [imprimirValores, setImprimirValores] = useState(true)
  const [tipoDocu, setTipoDocu] = useState('')
  const [desdeDoc, setDesdeDoc] = useState('')
  const [hastaDoc, setHastaDoc] = useState('')
  const [tamanoHoja, setTamanoHoja] = useState('CARTA')

  const [tiposDocu, setTiposDocu] = useState<TipoDocu[]>([])
  const [loadingTipos, setLoadingTipos] = useState(false)
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    if (!noCia) return
    setLoadingTipos(true)
    fetch(`${API_BASE}/inv/tipos-docu/?no_cia=${encodeURIComponent(noCia)}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then((data) => {
        const items: TipoDocu[] = Array.isArray(data) ? data : (data.results ?? data.items ?? [])
        setTiposDocu(items)
      })
      .catch(() => {
        setTiposDocu([])
        toast.error('No se pudieron cargar los tipos de documento')
      })
      .finally(() => setLoadingTipos(false))
  }, [noCia])

  const handleImprimir = () => {
    if (!tipoDocu) {
      toast.error('Seleccione un Tipo de Documento')
      return
    }
    if (!mes || !anio) {
      toast.error('Indique el Mes y Año en proceso')
      return
    }

    setPrinting(true)
    const qs = new URLSearchParams({
      no_cia: noCia,
      mes,
      anio,
      sucursal: sucursal || punto,
      localidad,
      modo: modoImpresion,
      imprimir_valores: imprimirValores ? 'S' : 'N',
      tipo_docu: tipoDocu,
      tamano_hoja: tamanoHoja,
    })
    if (desdeDoc) qs.set('desde_doc', desdeDoc)
    if (hastaDoc) qs.set('hasta_doc', hastaDoc)

    const url = `${API_BASE}/inv/reportes/documentos/pdf/?${qs.toString()}`
    const win = window.open(url, '_blank')
    if (!win) {
      toast.error('El navegador bloqueó la ventana emergente. Permita las ventanas emergentes e intente de nuevo.')
    } else {
      toast.success('Generando documento PDF...')
    }
    setPrinting(false)
  }

  const tipoDocuLabel = (t: TipoDocu) => {
    const code = t.tipo_docu ?? t.tipo_doc ?? ''
    const desc = t.descripcion ?? ''
    return desc ? `${code} — ${desc}` : code
  }

  return (
    <section className='space-y-6'>
      <div>
        <h2 className='text-lg font-semibold flex items-center gap-2'>
          <Printer className='h-5 w-5 text-primary' />
          Impresión de Documentos
        </h2>
        <p className='text-sm text-muted-foreground'>FINV206 — Generar reportes Rinv206/Rinv207 en PDF</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Parámetros de Impresión</CardTitle>
        </CardHeader>
        <CardContent className='space-y-6'>

          {/* Mes y Año / Sucursal / Localidad */}
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
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
              <Label htmlFor='sucursal'>Sucursal</Label>
              <Input
                id='sucursal'
                className='h-9'
                placeholder='Código sucursal'
                value={sucursal}
                onChange={(e) => setSucursal(e.target.value)}
              />
            </div>

            <div className='space-y-1'>
              <Label htmlFor='localidad'>No. Localidad</Label>
              <Input
                id='localidad'
                className='h-9'
                placeholder='Localidad'
                value={localidad}
                onChange={(e) => setLocalidad(e.target.value)}
              />
            </div>
          </div>

          {/* Modo Impresión */}
          <div className='space-y-2'>
            <Label>Modo</Label>
            <RadioGroup
              value={modoImpresion}
              onValueChange={(v) => setModoImpresion(v as 'imprimir' | 'reimprimir')}
              className='flex gap-6'
            >
              <div className='flex items-center gap-2'>
                <RadioGroupItem value='imprimir' id='modo-imprimir' />
                <Label htmlFor='modo-imprimir' className='font-normal cursor-pointer'>Imprimir</Label>
              </div>
              <div className='flex items-center gap-2'>
                <RadioGroupItem value='reimprimir' id='modo-reimprimir' />
                <Label htmlFor='modo-reimprimir' className='font-normal cursor-pointer'>Reimprimir</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Imprimir Valores */}
          <div className='flex items-center gap-3'>
            <Switch
              id='imprimir-valores'
              checked={imprimirValores}
              onCheckedChange={setImprimirValores}
            />
            <Label htmlFor='imprimir-valores' className='cursor-pointer'>
              Imprimir Valores: <strong>{imprimirValores ? 'Sí' : 'No'}</strong>
            </Label>
          </div>

          {/* Tipo Documento */}
          <div className='space-y-1'>
            <Label htmlFor='tipo-docu'>Tipo Documento</Label>
            <Select
              value={tipoDocu}
              onValueChange={setTipoDocu}
              disabled={loadingTipos}
            >
              <SelectTrigger id='tipo-docu' className='h-9 w-full md:w-[360px]'>
                <SelectValue placeholder={loadingTipos ? 'Cargando...' : 'Seleccionar tipo...'} />
              </SelectTrigger>
              <SelectContent>
                {tiposDocu.map((t) => {
                  const code = t.tipo_docu ?? t.tipo_doc ?? ''
                  return (
                    <SelectItem key={code} value={code}>
                      {tipoDocuLabel(t)}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Desde / Hasta Documento */}
          <div className='grid grid-cols-2 gap-4 md:w-[360px]'>
            <div className='space-y-1'>
              <Label htmlFor='desde-doc'>Desde Documento</Label>
              <Input
                id='desde-doc'
                className='h-9'
                type='number'
                min={0}
                placeholder='0'
                value={desdeDoc}
                onChange={(e) => setDesdeDoc(e.target.value)}
              />
            </div>
            <div className='space-y-1'>
              <Label htmlFor='hasta-doc'>Hasta Documento</Label>
              <Input
                id='hasta-doc'
                className='h-9'
                type='number'
                min={0}
                placeholder='999999'
                value={hastaDoc}
                onChange={(e) => setHastaDoc(e.target.value)}
              />
            </div>
          </div>

          {/* Tamaño Hoja */}
          <div className='space-y-1'>
            <Label htmlFor='tamano-hoja'>Tamaño de Hoja</Label>
            <Select value={tamanoHoja} onValueChange={setTamanoHoja}>
              <SelectTrigger id='tamano-hoja' className='h-9 w-[180px]'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TAMANOS_HOJA.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action */}
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
