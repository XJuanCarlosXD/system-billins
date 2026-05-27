import { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { toast } from 'sonner'

interface Props {
  noCia: string
  punto: string
  ano: number
  mes: number
}

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export function AutorizarMes({ noCia, punto, ano, mes }: Props) {
  const [pendientes, setPendientes] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [executing, setExecuting] = useState(false)

  const loadPendientes = () => {
    if (!noCia || !punto || !ano || !mes) return
    setLoading(true)
    regalGeneralApi
      .cntAsientos(noCia, punto, ano, mes, { page: 1, pageSize: 1, autorizado: false })
      .then((r) => setPendientes(r.total))
      .catch(() => setPendientes(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadPendientes()
  }, [noCia, punto, ano, mes])

  const handleAutorizar = async () => {
    if (!window.confirm(
      `Se autorizarán TODOS los asientos pendientes de ${MESES[mes]} ${ano}.\n¿Confirma?`
    )) return

    setExecuting(true)
    try {
      const result = await regalGeneralApi.cntAutorizarMes(noCia, punto, ano, mes)
      toast.success(`${result.asientos_autorizados} asiento${result.asientos_autorizados !== 1 ? 's' : ''} autorizado${result.asientos_autorizados !== 1 ? 's' : ''} exitosamente.`)
      loadPendientes()
    } catch (err: any) {
      toast.error(err?.message || 'Error al autorizar asientos')
    } finally {
      setExecuting(false)
    }
  }

  return (
    <div className='mx-auto max-w-md space-y-5'>
      <div>
        <h2 className='text-lg font-semibold'>Autorización de Asientos</h2>
        <p className='text-sm text-muted-foreground'>FCNT202 — Contabilidad General</p>
      </div>

      {/* Panel igual al legado */}
      <div className='rounded-xl border divide-y text-sm'>
        <div className='flex items-center justify-between px-4 py-2'>
          <span className='text-muted-foreground'>No Cia</span>
          <span className='font-mono'>{noCia}</span>
        </div>
        <div className='flex items-center justify-between px-4 py-2'>
          <span className='text-muted-foreground'>Punto</span>
          <span className='font-mono'>{punto}</span>
        </div>
        <div className='flex items-center justify-between px-4 py-2'>
          <span className='text-muted-foreground'>Mes y Año en Proceso</span>
          <span className='font-mono'>
            {mes && ano ? `${MESES[mes]} ${ano}` : '—'}
          </span>
        </div>
      </div>

      {loading ? (
        <p className='text-center text-sm text-muted-foreground'>Verificando asientos...</p>
      ) : pendientes === 0 ? (
        <Alert>
          <CheckCircle2 className='h-4 w-4' />
          <AlertDescription>
            Todos los asientos de este período ya están autorizados.
          </AlertDescription>
        </Alert>
      ) : pendientes !== null && (
        <Alert variant='destructive'>
          <AlertDescription>
            Hay <strong>{pendientes}</strong> asiento{pendientes !== 1 ? 's' : ''} pendiente{pendientes !== 1 ? 's' : ''} de autorizar.
          </AlertDescription>
        </Alert>
      )}

      <div className='flex justify-center pt-2'>
        <Button
          size='lg'
          disabled={executing || loading || pendientes === 0}
          onClick={handleAutorizar}
          className='min-w-40'
        >
          {executing ? 'Autorizando...' : 'AUTORIZAR'}
        </Button>
      </div>

      <p className='text-center text-xs text-muted-foreground'>
        Se autorizarán los asientos que pertenezcan a este mes y año en Proceso
      </p>
    </div>
  )
}
