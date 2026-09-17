// Panel de Certificación e-CF — ejecuta los Pasos 2 y 3 del flujo de
// certificación DGII (Postulación) subiendo los Excel oficiales que se
// descargan del propio Portal de Certificación, en vez de correr scripts
// sueltos contra la VM. El paso "Cuarto" (subida de las Facturas de
// Consumo < 250Mil al widget del portal) sigue siendo manual a propósito
// -- es una acción de navegador en el sitio de la DGII, no un servicio
// REST que se pueda automatizar desde aquí.
import { useRef, useState } from 'react'
import { CheckCircle2, Download, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  descargarXmlComoArchivo,
  useCertificacionPaso2Ecf,
  useCertificacionPaso2Rfce,
  useCertificacionPaso3,
  type ResultadoAprobacionCertificacion,
  type ResultadoEnvioCertificacion,
  type ResultadoRfceCertificacion,
} from '@/features/fe/api'

function FilaResultado({ r }: { r: ResultadoEnvioCertificacion }) {
  return (
    <TableRow>
      <TableCell className='font-mono text-xs'>{r.encf}</TableCell>
      <TableCell>
        {r.ok ? (
          <Badge className='gap-1 bg-emerald-600'>
            <CheckCircle2 className='h-3 w-3' /> OK
          </Badge>
        ) : (
          <Badge variant='destructive' className='gap-1'>
            <XCircle className='h-3 w-3' /> Error
          </Badge>
        )}
      </TableCell>
      <TableCell className='text-muted-foreground text-xs'>
        {r.ok ? r.trackId : r.error}
      </TableCell>
    </TableRow>
  )
}

function PasoUploadCard({
  titulo,
  descripcion,
  onEnviar,
  isPending,
  resultados,
  extraColumna,
}: {
  titulo: string
  descripcion: string
  onEnviar: (archivo: File) => void
  isPending: boolean
  resultados: ResultadoEnvioCertificacion[] | undefined
  extraColumna?: (r: any) => React.ReactNode
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{titulo}</CardTitle>
        <CardDescription>{descripcion}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <input
            ref={inputRef}
            type='file'
            accept='.xlsx'
            className='text-sm'
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          />
          <Button
            disabled={!archivo || isPending}
            onClick={() => archivo && onEnviar(archivo)}
          >
            {isPending ? 'Enviando…' : 'Enviar a la DGII'}
          </Button>
        </div>
        {resultados && resultados.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>e-NCF</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Detalle</TableHead>
                {extraColumna && <TableHead>Acción</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {resultados.map((r) => (
                <>
                  <FilaResultado key={r.encf} r={r} />
                  {extraColumna && (
                    <TableRow key={`${r.encf}-extra`}>
                      <TableCell colSpan={3} />
                      <TableCell>{extraColumna(r)}</TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

export function FeCertificacion({ noCia }: { noCia: string }) {
  const paso2Ecf = useCertificacionPaso2Ecf(noCia)
  const paso2Rfce = useCertificacionPaso2Rfce(noCia)
  const paso3 = useCertificacionPaso3(noCia)

  return (
    <div className='space-y-4'>
      <Alert>
        <AlertTitle>Panel de Certificación e-CF (Postulación DGII)</AlertTitle>
        <AlertDescription>
          Descargue el Excel oficial de cada paso desde el Portal de
          Certificación (
          <code className='text-xs'>
            https://ecf.dgii.gov.do/certecf/portalcertificacion
          </code>
          ) y súbalo aquí. Todos los envíos van SIEMPRE contra el ambiente{' '}
          <code className='text-xs'>certecf</code>, nunca producción.
        </AlertDescription>
      </Alert>

      <PasoUploadCard
        titulo='Paso 2 — Pruebas de Datos e-CF'
        descripcion='Suba el "Set de datos a utilizar" (botón "Descargar comprobantes" del Paso 2, hoja ECF). Envía las facturas ≥ RD$250,000 y el resto de tipos (31/33/34/41/43/44/45/46/47).'
        onEnviar={(archivo) =>
          paso2Ecf.mutate(archivo, {
            onSuccess: (r) =>
              toast.success(`${r.resultados.filter((x) => x.ok).length}/${r.resultados.length} comprobantes aceptados`),
            onError: (e: any) => toast.error(e.message),
          })
        }
        isPending={paso2Ecf.isPending}
        resultados={paso2Ecf.data?.resultados}
      />

      <PasoUploadCard
        titulo='Paso 2 — Facturas de Consumo < RD$250,000 (RFCE)'
        descripcion='Mismo Excel del Paso 2 (hoja RFCE). Envía el Resumen de cada factura y le devuelve el e-CF32 firmado para descargar y subir a mano en el widget "Facturas de consumo < 250Mil" del propio Portal de Certificación.'
        onEnviar={(archivo) =>
          paso2Rfce.mutate(archivo, {
            onSuccess: (r) =>
              toast.success(`${r.resultados.filter((x) => x.ok).length}/${r.resultados.length} resúmenes aceptados — descargue los XML para subirlos al portal`),
            onError: (e: any) => toast.error(e.message),
          })
        }
        isPending={paso2Rfce.isPending}
        resultados={paso2Rfce.data?.resultados}
        extraColumna={(r: ResultadoRfceCertificacion) =>
          r.ok && r.ecf32_firmado_xml ? (
            <Button
              size='sm'
              variant='outline'
              className='gap-1'
              onClick={() =>
                descargarXmlComoArchivo(r.nombre_archivo!, r.ecf32_firmado_xml!)
              }
            >
              <Download className='h-3 w-3' /> Descargar XML
            </Button>
          ) : null
        }
      />

      <PasoUploadCard
        titulo='Paso 3 — Aprobaciones Comerciales'
        descripcion='Suba el Excel del Paso 3 ("Descargar aprobaciones comerciales", hoja ACEECF_Generadas). Reenvía cada aprobación tal cual la generó la DGII.'
        onEnviar={(archivo) =>
          paso3.mutate(archivo, {
            onSuccess: (r) =>
              toast.success(`${r.resultados.filter((x) => x.ok).length}/${r.resultados.length} aprobaciones enviadas`),
            onError: (e: any) => toast.error(e.message),
          })
        }
        isPending={paso3.isPending}
        resultados={paso3.data?.resultados as ResultadoAprobacionCertificacion[] | undefined}
      />
    </div>
  )
}
