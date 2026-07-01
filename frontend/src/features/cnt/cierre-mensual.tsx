import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, AlertTriangle, CheckCircle2, Lock } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { PeriodoBadge, AlertIrreversible } from '@/components/cierre'
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

const MESES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function CierreMensual({ noCia, punto }: Props) {
  const qc = useQueryClient()

  const infoQ = useQuery({
    queryKey: ['cnt-cierre-info', noCia, punto],
    queryFn: () => regalGeneralApi.cntCierreMensualInfo(noCia, punto) as Promise<CierreInfo>,
    enabled: !!noCia && !!punto,
  })

  const cerrarMut = useMutation({
    mutationFn: () => regalGeneralApi.cntEjecutarCierreMensual(noCia, punto),
    onSuccess: (result: any) => {
      toast.success(
        `Período ${MESES[result.mes_cerrado]} ${result.ano_cerrado} cerrado exitosamente. ` +
          `Próximo período: ${MESES[result.proximo_mes]} ${result.proximo_ano}.`,
      )
      qc.invalidateQueries({ queryKey: ['cnt-cierre-info'] })
    },
    onError: (err: any) => toast.error(err?.detail?.error || err?.message || 'Error ejecutando el cierre'),
  })

  const handleCerrar = () => {
    if (!infoQ.data) return
    const info = infoQ.data
    const confirmMsg = `¿Confirma el cierre del período ${MESES[info.mes_proceso]} ${info.ano_proceso}? Esta acción no se puede deshacer.`
    if (!window.confirm(confirmMsg)) return
    cerrarMut.mutate()
  }

  if (infoQ.isLoading) {
    return <div className='py-10 text-center text-sm text-muted-foreground'>Cargando…</div>
  }

  const info = infoQ.data
  if (!info) {
    return (
      <div className='py-10 text-center text-sm text-muted-foreground'>
        Seleccione empresa y punto para ver el cierre.
      </div>
    )
  }

  const canClose = !info.ya_cerrado && info.asientos_pendientes === 0

  return (
    <div className='p-6 space-y-4 max-w-4xl mx-auto'>
      <Card>
        <CardHeader className='pb-3'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div>
              <CardTitle className='text-lg'>Cierre Mensual de Contabilidad</CardTitle>
              <p className='text-xs text-muted-foreground mt-0.5'>
                Cierra el período contable actual y avanza al siguiente mes de proceso.
              </p>
            </div>
            <PeriodoBadge mes={info.mes_proceso} ano={info.ano_proceso} loading={infoQ.isLoading} />
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
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

          {info.ya_cerrado && (
            <Alert>
              <CheckCircle2 className='h-4 w-4' />
              <AlertDescription>Este período ya está cerrado.</AlertDescription>
            </Alert>
          )}

          {!info.ya_cerrado && info.asientos_pendientes > 0 && (
            <AlertIrreversible tone='amber'>
              Hay <b>{info.asientos_pendientes}</b> asiento
              {info.asientos_pendientes !== 1 ? 's' : ''} sin autorizar. Debe autorizar
              todos antes de cerrar el período.
            </AlertIrreversible>
          )}

          {canClose && (
            <Alert>
              <AlertCircle className='h-4 w-4' />
              <AlertDescription>
                Todos los asientos están autorizados. El período está listo para cerrar.
              </AlertDescription>
            </Alert>
          )}

          {info.es_cierre_fiscal && !info.ya_cerrado && (
            <Alert>
              <AlertTriangle className='h-4 w-4' />
              <AlertDescription>
                Este es el mes de <strong>Cierre del Año Fiscal ({info.mes_cierre_nombre})</strong>.
                Después del cierre mensual se habilitará el Cierre de Período Fiscal.
              </AlertDescription>
            </Alert>
          )}

          <div className='flex justify-center pt-2'>
            <Button
              size='lg'
              disabled={!canClose || cerrarMut.isPending}
              onClick={handleCerrar}
              variant='destructive'
              className='min-w-40'
            >
              <Lock className='mr-2 h-4 w-4' />
              {cerrarMut.isPending ? 'Cerrando…' : 'Ejecutar Cierre'}
            </Button>
          </div>
        </CardContent>
      </Card>
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
