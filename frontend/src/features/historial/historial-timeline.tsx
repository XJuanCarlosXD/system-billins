import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, XCircle, Undo2 } from 'lucide-react'
import type { EventoHistorial } from '@/lib/api-client-historial'

const ACCION_META: Record<
  EventoHistorial['accion'],
  { label: string; icon: typeof Plus; className: string }
> = {
  CREAR: { label: 'Creó', icon: Plus, className: 'text-emerald-600' },
  EDITAR: { label: 'Editó', icon: Pencil, className: 'text-blue-600' },
  ANULAR: { label: 'Anuló', icon: XCircle, className: 'text-destructive' },
  REVERSAR: { label: 'Reversó', icon: Undo2, className: 'text-amber-600' },
}

function fmtFecha(iso: string) {
  return iso ? iso.replace('T', ' ').slice(0, 16) : ''
}

function esNumero(v: string) {
  return v !== '' && !isNaN(Number(v))
}

interface Props {
  eventos: EventoHistorial[]
  modo?: 'compacto' | 'completo'
  onDocumentoClick?: (evento: EventoHistorial) => void
}

export function HistorialTimeline({ eventos, modo = 'completo', onDocumentoClick }: Props) {
  if (eventos.length === 0) {
    return (
      <div className='text-sm text-muted-foreground py-4 text-center'>
        Sin actividad registrada.
      </div>
    )
  }

  return (
    <div className='space-y-3'>
      {eventos.map((ev) => {
        const meta = ACCION_META[ev.accion]
        const Icon = meta.icon
        return (
          <div key={ev.bitacora_id} className='flex gap-3 border-b pb-3 last:border-0'>
            <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${meta.className}`} />
            <div className='flex-1 min-w-0'>
              <div className='flex items-center gap-2 flex-wrap'>
                <button
                  type='button'
                  className={onDocumentoClick ? 'font-medium hover:underline text-left' : 'font-medium text-left'}
                  onClick={() => onDocumentoClick?.(ev)}
                  disabled={!onDocumentoClick}
                >
                  {ev.descripcion}
                </button>
                <Badge variant='outline' className='font-mono text-xs'>
                  {ev.modulo}
                </Badge>
              </div>
              <div className='text-xs text-muted-foreground'>{fmtFecha(ev.fecha)}</div>
              {ev.motivo && (
                <div className='text-xs text-muted-foreground mt-1'>
                  Motivo: <span className='text-foreground'>{ev.motivo}</span>
                </div>
              )}
              {modo === 'completo' && ev.cambios.length > 0 && (
                <ul className='mt-2 space-y-1 text-xs'>
                  {ev.cambios.map((c) => (
                    <li key={c.campo} className='text-muted-foreground'>
                      <span className='text-foreground'>{c.etiqueta}:</span>{' '}
                      <span className={esNumero(c.valor_anterior) ? 'tabular-nums' : ''}>
                        {c.valor_anterior || '—'}
                      </span>{' '}
                      →{' '}
                      <span className={esNumero(c.valor_nuevo) ? 'tabular-nums font-medium' : 'font-medium'}>
                        {c.valor_nuevo || '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
