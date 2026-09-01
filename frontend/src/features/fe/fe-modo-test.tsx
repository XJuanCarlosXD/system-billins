// Modo Test — Set de Pruebas de certificación DGII (Fase 2, Task 5 backend).
// Flujo deliberadamente manual y de bajo volumen: el operador copia, fila
// por fila, los valores del Excel oficial descargado del Portal de
// Certificación (backend/docs/superpowers/reference/2026-08-31-set-pruebas-paso2/
// set-pruebas-130217432.xlsx) y los pega aquí como JSON -- NO existe (ni
// tiene sentido construir) un formulario con un campo por cada una de las
// ~5000 columnas aplanadas de ese archivo.
//
// Visualmente diferenciado a propósito (borde/fondo ámbar) del listado de
// comprobantes reales de arriba: el usuario fue explícito en que un envío
// de prueba NUNCA debe confundirse con tráfico real de producción.
import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { TIPOS_ECF, useEnviarPrueba } from '@/features/fe/api'

const PLACEHOLDER_JSON = `{
  "RNCEmisor": "130217432",
  "RazonSocialEmisor": "ABREGONZA, SRL",
  "FechaEmision": "31-12-2028",
  "TipoIngresos": "01",
  "TipoPago": 1,
  "RNCComprador": "101623232",
  "RazonSocialComprador": "CLIENTE DE PRUEBA",
  "MontoTotal": "1180.00",
  "FormaPago[1]": 1,
  "MontoPago[1]": "1180.00"
}`

export function FeModoTest({ noCia }: { noCia: string }) {
  const [tipoEcf, setTipoEcf] = useState('32')
  const [encf, setEncf] = useState('')
  const [datosJson, setDatosJson] = useState('')
  const enviarPrueba = useEnviarPrueba(noCia)

  const enviar = () => {
    if (!encf.trim()) {
      toast.error('Digite el eNCF del escenario (columna CasoPrueba/ENCF del Excel)')
      return
    }
    let datos: Record<string, unknown>
    try {
      datos = datosJson.trim() ? JSON.parse(datosJson) : {}
    } catch {
      toast.error('El bloque de datos no es JSON válido — revise comas y comillas')
      return
    }
    enviarPrueba.mutate(
      { tipo_ecf: Number(tipoEcf), encf: encf.trim(), datos },
      {
        onSuccess: (r) =>
          toast.success(
            `Escenario ${encf} enviado a la DGII (testecf)${r.trackId ? ` — trackId ${r.trackId}` : ''}`
          ),
        onError: (e: any) =>
          toast.error(
            e.message?.includes('404')
              ? 'El endpoint de envío de pruebas aún no está disponible en el backend (pendiente Task 5).'
              : e.message
          ),
      }
    )
  }

  return (
    <div className='space-y-4'>
      <div>
        <h3 className='text-base font-semibold'>Modo Test — Set de Pruebas DGII</h3>
        <p className='text-muted-foreground text-sm'>
          Ejecuta manualmente, escenario por escenario, el Set de Pruebas del
          Paso 2 de certificación (los 25 casos de la hoja{' '}
          <code className='text-xs'>ECF</code> del Excel descargado del
          Portal de Certificación). Cada envío se marca{' '}
          <code className='text-xs'>ES_PRUEBA='S'</code> y va contra el
          ambiente <code className='text-xs'>testecf</code> — nunca contra
          producción.
        </p>
      </div>

      <Card className='border-amber-500/60 bg-amber-50 dark:bg-amber-950/20'>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-base text-amber-700 dark:text-amber-400'>
            <AlertTriangle className='h-5 w-5' />
            Envío de prueba — NO es facturación real
          </CardTitle>
          <CardDescription className='text-amber-700/80 dark:text-amber-400/80'>
            Copie los valores de una fila del Excel del Set de Pruebas
            (columnas nombradas igual que los elementos del XSD, ej.{' '}
            <code className='text-xs'>TipoeCF</code>,{' '}
            <code className='text-xs'>ENCF</code>,{' '}
            <code className='text-xs'>FormaPago[1]</code>) y péguelos como
            JSON abajo.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
            <div>
              <Label>Tipo de e-CF (columna TipoeCF)</Label>
              <Select value={tipoEcf} onValueChange={setTipoEcf}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPOS_ECF).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {k} — {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>eNCF del escenario (columna ENCF / CasoPrueba)</Label>
              <Input
                value={encf}
                placeholder='E320000000006'
                maxLength={13}
                onChange={(e) => setEncf(e.target.value.trim().toUpperCase())}
              />
            </div>
          </div>
          <div>
            <Label>Datos del escenario (JSON, resto de las columnas del Excel)</Label>
            <Textarea
              className='min-h-48 font-mono text-xs'
              placeholder={PLACEHOLDER_JSON}
              value={datosJson}
              onChange={(e) => setDatosJson(e.target.value)}
            />
            <p className='text-muted-foreground mt-1 text-xs'>
              El valor <code>#e</code> del Excel significa "campo vacío / no
              aplica" — omita esa clave en vez de escribir el texto{' '}
              <code>#e</code>.
            </p>
          </div>
          <Button
            variant='outline'
            className='border-amber-600 bg-amber-500 text-white hover:bg-amber-600 hover:text-white'
            disabled={enviarPrueba.isPending}
            onClick={enviar}
          >
            {enviarPrueba.isPending ? 'Enviando…' : 'Enviar prueba a la DGII'}
          </Button>
        </CardContent>
      </Card>

      <Alert>
        <AlertTitle>Referencia</AlertTitle>
        <AlertDescription>
          Set de Pruebas y notas de mapeo en{' '}
          <code className='text-xs'>
            backend/docs/superpowers/reference/2026-08-31-set-pruebas-paso2/
          </code>
          . Marque en la memoria del proyecto el resultado
          (aceptado/rechazado) de cada escenario a medida que lo confirme en
          el propio Portal de Certificación de la DGII.
        </AlertDescription>
      </Alert>
    </div>
  )
}
