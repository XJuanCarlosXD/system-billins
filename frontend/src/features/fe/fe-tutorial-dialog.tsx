import { useCallback, useEffect, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { FeTutorialAvatar } from './fe-tutorial-avatar'
import { useTTS } from './fe-tutorial-voice'

export interface TutorialPaso {
  titulo: string
  descripcion: string
  icono: string
}

interface Props {
  moduloKey: string
  titulo: string
  pasos: TutorialPaso[]
  feActivo: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

const VOICE_PREF_KEY = 'fe-tutorial-voz-habilitada'

export function FeTutorialDialog({
  moduloKey,
  titulo,
  pasos,
  feActivo,
  open,
  onOpenChange,
}: Props) {
  const [pasoActual, setPasoActual] = useState(0)
  const [speaking, setSpeaking] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const { speak, stop, supported } = useTTS()

  useEffect(() => {
    try {
      const stored = localStorage.getItem(VOICE_PREF_KEY)
      if (stored === '0') setVoiceEnabled(false)
    } catch {
      // ignore
    }
  }, [])

  const paso = pasos[pasoActual]

  const leer = useCallback(
    (p: TutorialPaso) => {
      if (!voiceEnabled || !supported) return
      setSpeaking(true)
      speak(`${p.titulo}. ${p.descripcion}`, () => setSpeaking(false))
    },
    [speak, voiceEnabled, supported],
  )

  useEffect(() => {
    if (open && paso) {
      leer(paso)
    }
    return () => {
      stop()
      setSpeaking(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pasoActual, voiceEnabled])

  const toggleVoice = () => {
    const next = !voiceEnabled
    setVoiceEnabled(next)
    try {
      localStorage.setItem(VOICE_PREF_KEY, next ? '1' : '0')
    } catch {
      // ignore
    }
    if (!next) {
      stop()
      setSpeaking(false)
    }
  }

  const siguiente = () => {
    if (pasoActual < pasos.length - 1) {
      setPasoActual(pasoActual + 1)
    } else {
      cerrar()
    }
  }

  const anterior = () => {
    if (pasoActual > 0) setPasoActual(pasoActual - 1)
  }

  const cerrar = () => {
    stop()
    setSpeaking(false)
    setPasoActual(0)
    onOpenChange(false)
    try {
      localStorage.setItem(`fe-tutorial-visto-${moduloKey}`, '1')
    } catch {
      // ignore
    }
  }

  if (!feActivo || !paso) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) cerrar()
      }}
    >
      <DialogContent className='sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-3'>
            <FeTutorialAvatar speaking={speaking} className='h-12 w-12' />
            <span>{titulo}</span>
          </DialogTitle>
          <DialogDescription>
            Tutorial rápido de facturación electrónica para este módulo.
          </DialogDescription>
        </DialogHeader>

        <div className='flex items-center justify-between'>
          <div className='flex gap-1.5'>
            {pasos.map((_, i) => (
              <button
                key={i}
                type='button'
                aria-label={`Ir al paso ${i + 1}`}
                onClick={() => setPasoActual(i)}
                className={cn(
                  'h-2 rounded-full transition-all',
                  i === pasoActual ? 'bg-primary w-6' : 'bg-muted w-2',
                )}
              />
            ))}
          </div>
          {supported && (
            <Button
              variant='ghost'
              size='sm'
              onClick={toggleVoice}
              className='gap-1.5'
              aria-label={voiceEnabled ? 'Silenciar voz' : 'Activar voz'}
            >
              {voiceEnabled ? (
                <>
                  <Volume2 className='h-4 w-4' />
                  <span className='text-xs'>Voz</span>
                </>
              ) : (
                <>
                  <VolumeX className='h-4 w-4' />
                  <span className='text-xs'>Sin voz</span>
                </>
              )}
            </Button>
          )}
        </div>

        <div className='bg-muted/40 flex min-h-[140px] gap-4 rounded-lg border p-4'>
          <span className='flex-shrink-0 text-4xl' aria-hidden>
            {paso.icono}
          </span>
          <div className='flex-1'>
            <p className='text-base font-semibold'>{paso.titulo}</p>
            <p className='text-muted-foreground mt-1.5 text-sm leading-relaxed'>
              {paso.descripcion}
            </p>
          </div>
        </div>

        <p className='text-muted-foreground text-center text-xs'>
          Paso {pasoActual + 1} de {pasos.length}
        </p>

        <DialogFooter className='flex-row justify-between gap-2 sm:justify-between'>
          <Button variant='ghost' onClick={cerrar}>
            Saltar
          </Button>
          <div className='flex gap-2'>
            {pasoActual > 0 && (
              <Button variant='outline' onClick={anterior}>
                Anterior
              </Button>
            )}
            <Button onClick={siguiente}>
              {pasoActual < pasos.length - 1 ? 'Siguiente' : 'Entendido'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
