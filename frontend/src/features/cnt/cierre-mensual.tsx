import { useEffect, useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Lock } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { toast } from 'sonner'

interface Props {
  noCia: string
  punto: string
}

interface CierreInfo {
  no_cia: string
  punto: string
  ano_proceso: number
  mes_proceso: number
  mes_proceso_nombre: string
  mes_cierre: number
  mes_cierre_nombre: string
  fecha_inicial: string
  fecha_proceso: string
  fecha_siguiente: string
  utilidad_retenida: string | null
  tasa_us: number
  asientos_pendientes: number
  ya_cerrado: boolean
  es_cierre_fiscal: boolean
}

export function CierreMensual({ noCia, punto }: Props) {
  const [info, setInfo] = useState<CierreInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [executing, setExecuting] = useState(false)

  const loadInfo = () => {
    if (!noCia || !punto) return
    setLoading(true)
    regalGeneralApi
      .cntCierreMensualInfo(noCia, punto)
      .then(setInfo)
      .catch(() => toast.error('Error cargando datos del cierre'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadInfo()
  }, [noCia, punto])

  const handleCerrar = async () => {
    if (!info) return
    const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    const confirmMsg = `¿Confirma el cierre del período ${meses[info.mes_proceso]} ${info.ano_proceso}? Esta acción no se puede deshacer.`
    if (!window.confirm(confirmMsg)) return

    setExecuting(true)
    try {
      const result = await regalGeneralApi.cntEjecutarCierreMensual(noCia, punto)
      toast.success(
        `Período ${meses[result.mes_cerrado]} ${result.ano_cerrado} cerrado exitosamente. ` +
        `Próximo período: ${meses[result.proximo_mes]} ${result.proximo_ano}.`
      )
      loadInfo()
    } catch (err: any) {
      const msg = err?.message || 'Error ejecutando el cierre'
      toast.error(msg)
    } finally {
      setExecuting(false)
    }
  }

  if (loading) {
    return <div className='py-10 text-center text-sm text-muted-foreground'>Cargando...</div>
  }

  if (!info) {
    return (
      <div className='py-10 text-center text-sm text-muted-foreground'>
        Seleccione empresa y punto para ver el cierre.
      </div>
    )
  }

  const canClose = !info.ya_cerrado && info.asientos_pendientes === 0

  return (
    <div className='mx-auto max-w-xl space-y-5'>
      <div>
        <h2 className='text-lg font-semibold'>Cierre Mensual</h2>
        <p className='text-sm text-muted-foreground'>FCNT401 — Contabilidad General</p>
      </div>

      {/* Datos del período — idéntico al legado */}
      <div className='rounded-xl border divide-y text-sm'>
        <Row label='No Cia' value={info.no_cia} />
        <Row label='Punto' value={info.punto} />
        <Row
          label='Período Fiscal Desde'
          value={`${info.fecha_inicial} Hasta ${calcFechaFinal(info.fecha_inicial)}`}
        />
        <Row label='Fecha Proceso' value={info.fecha_proceso} />
        <Row label='Fecha Siguiente' value={info.fecha_siguiente} />
        <Row
          label='Mes y Año en Proceso'
          value={`${info.mes_proceso_nombre} ${info.ano_proceso}`}
        />
        <Row
          label='Mes Cierre Año Fiscal'
          value={info.mes_cierre_nombre}
          badge={info.es_cierre_fiscal ? { label: 'Cierre Fiscal', variant: 'destructive' } : undefined}
        />
      </div>

      {/* Alertas */}
      {info.ya_cerrado && (
        <Alert>
          <CheckCircle2 className='h-4 w-4' />
          <AlertDescription>
            Este período ya está cerrado.
          </AlertDescription>
        </Alert>
      )}

      {!info.ya_cerrado && info.asientos_pendientes > 0 && (
        <Alert variant='destructive'>
          <AlertTriangle className='h-4 w-4' />
          <AlertDescription>
            Hay <strong>{info.asientos_pendientes}</strong> asiento{info.asientos_pendientes !== 1 ? 's' : ''} sin
            autorizar. Debe autorizar todos antes de cerrar el período.
          </AlertDescription>
        </Alert>
      )}

      {canClose && (
        <Alert>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>
            Todos los asientos están autorizados. El período está listo para cerrar.
          </AlertDescription>
        </Alert>
      )}

      {/* Botón CERRAR — igual que el legado */}
      <div className='flex justify-center pt-2'>
        <Button
          size='lg'
          disabled={!canClose || executing}
          onClick={handleCerrar}
          className='min-w-40'
        >
          <Lock className='mr-2 h-4 w-4' />
          {executing ? 'Cerrando...' : 'CERRAR'}
        </Button>
      </div>

      {info.es_cierre_fiscal && !info.ya_cerrado && (
        <Alert>
          <AlertTriangle className='h-4 w-4' />
          <AlertDescription>
            Este es el mes de <strong>Cierre del Año Fiscal ({info.mes_cierre_nombre})</strong>.
            Después del cierre mensual se habilitará el Cierre de Período Fiscal (FCNT402).
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function Row({
  label,
  value,
  badge,
}: {
  label: string
  value: string
  badge?: { label: string; variant: 'destructive' | 'secondary' | 'outline' }
}) {
  return (
    <div className='flex items-center justify-between px-4 py-2'>
      <span className='text-muted-foreground'>{label}</span>
      <div className='flex items-center gap-2'>
        <span className='font-mono text-right'>{value}</span>
        {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
      </div>
    </div>
  )
}

function calcFechaFinal(fechaInicial: string): string {
  if (!fechaInicial) return ''
  const d = new Date(fechaInicial)
  d.setFullYear(d.getFullYear() + 1)
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}
