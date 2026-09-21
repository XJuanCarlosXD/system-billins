import { RotateCw } from 'lucide-react'
import { useMyTicketAlerts } from '@/hooks/use-my-ticket-alerts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ESTADO_LABEL,
  ESTADO_VARIANT,
  NotaResolucion,
  PreguntaYRespuesta,
} from './soporte-dialog'

/**
 * Alerta global (montada una vez en el layout autenticado) para los tickets
 * propios que acaban de resolverse/cancelarse o que están en HOLD esperando
 * respuesta. Se puede cerrar (X/Escape/clic afuera) pero vuelve a aparecer
 * en la próxima carga de la app hasta que el usuario la acepte o responda.
 */
export function TicketAlertDialog() {
  const { current, dismiss, acknowledgeCurrent } = useMyTicketAlerts()

  if (!current) return null

  const esResuelto = current.estado === 'COMPLETADO' || current.estado === 'CANCELADO'

  return (
    <Dialog open onOpenChange={(open) => !open && dismiss(current)}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <div className='flex items-center gap-2'>
            <DialogTitle className='text-base'>{current.titulo}</DialogTitle>
            <Badge variant={ESTADO_VARIANT[current.estado]}>
              {ESTADO_LABEL[current.estado]}
            </Badge>
          </div>
        </DialogHeader>

        {esResuelto ? (
          <>
            <p className='text-muted-foreground text-sm'>
              Tu reporte «{current.titulo}» fue{' '}
              {current.estado === 'COMPLETADO' ? 'resuelto' : 'cancelado'}.
            </p>
            <NotaResolucion reporteId={current.reporte_id} />
            <DialogFooter className='gap-2 sm:gap-2'>
              <Button
                variant='outline'
                onClick={() => window.location.reload()}
              >
                <RotateCw className='size-4' /> Actualizar página
              </Button>
              <Button onClick={() => acknowledgeCurrent(current)}>
                Aceptar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <p className='text-muted-foreground text-sm'>
              El sistema tiene una pregunta sobre tu reporte «{current.titulo}
              » antes de continuar.
            </p>
            <PreguntaYRespuesta reporteId={current.reporte_id} />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
