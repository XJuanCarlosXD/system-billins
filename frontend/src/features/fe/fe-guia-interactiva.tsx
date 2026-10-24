import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { FeTutorialAvatar } from './fe-tutorial-avatar'
import type { GuiaPaso } from './fe-guia-pasos'

interface Props {
  pasos: GuiaPaso[]
  open: boolean
  onClose: () => void
  moduloKey: string
}

const PADDING = 8
const TOOLTIP_W = 320
const TOOLTIP_H = 220

export function FeGuiaInteractiva({ pasos, open, onClose, moduloKey }: Props) {
  const [paso, setPaso] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const current = pasos[paso]

  const calcRect = useCallback(() => {
    if (!current) return
    const el = document.querySelector(current.selector)
    if (el) {
      const r = el.getBoundingClientRect()
      setRect(r)
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    } else {
      setRect(null)
    }
  }, [current])

  useEffect(() => {
    if (!open) return
    calcRect()
    window.addEventListener('resize', calcRect)
    window.addEventListener('scroll', calcRect, true)
    return () => {
      window.removeEventListener('resize', calcRect)
      window.removeEventListener('scroll', calcRect, true)
    }
  }, [open, paso, calcRect])

  const cerrar = useCallback(() => {
    setPaso(0)
    onClose()
    try {
      localStorage.setItem(`fe-guia-visto-${moduloKey}`, '1')
    } catch {
      // ignore
    }
  }, [moduloKey, onClose])

  const siguiente = () => {
    if (paso < pasos.length - 1) setPaso(paso + 1)
    else cerrar()
  }
  const anterior = () => {
    if (paso > 0) setPaso(paso - 1)
  }

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, cerrar])

  useEffect(() => {
    if (open) {
      tooltipRef.current
        ?.querySelector<HTMLButtonElement>('button[data-tour-primary]')
        ?.focus()
    }
  }, [open, paso])

  if (!open || !current) return null

  const clampToViewport = (style: React.CSSProperties): React.CSSProperties => {
    const s: React.CSSProperties = { ...style }
    const W = window.innerWidth
    const H = window.innerHeight
    if (typeof s.left === 'number' && (s.left as number) + TOOLTIP_W > W - 16) {
      s.left = W - TOOLTIP_W - 16
    }
    if (typeof s.top === 'number' && (s.top as number) + TOOLTIP_H > H - 16) {
      s.top = H - TOOLTIP_H - 16
    }
    if (typeof s.left === 'number' && (s.left as number) < 16) s.left = 16
    if (typeof s.top === 'number' && (s.top as number) < 16) s.top = 16
    return s
  }

  if (!rect) {
    return createPortal(
      <div className='fixed inset-0 z-[9999] flex items-center justify-center bg-black/40'>
        <div
          ref={tooltipRef}
          className='animate-in fade-in slide-in-from-bottom-2 w-80 rounded-xl border bg-background p-4 shadow-2xl duration-200'
        >
          <div className='mb-3 flex items-start gap-3'>
            <FeTutorialAvatar speaking={false} className='h-10 w-10 flex-shrink-0' />
            <div>
              <p className='font-semibold'>{current.titulo}</p>
              <p className='text-muted-foreground mt-1 text-sm leading-relaxed'>
                Este paso no aplica a tu formulario actual. Puedes continuar.
              </p>
            </div>
          </div>
          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground text-xs'>
              {paso + 1} / {pasos.length}
            </span>
            <div className='flex gap-2'>
              <Button variant='ghost' size='sm' onClick={cerrar}>
                Saltar
              </Button>
              {paso > 0 && (
                <Button variant='outline' size='sm' onClick={anterior}>
                  Anterior
                </Button>
              )}
              <Button size='sm' onClick={siguiente} data-tour-primary>
                {paso < pasos.length - 1 ? 'Siguiente' : 'Listo'}
              </Button>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    )
  }

  const clipPath = `polygon(
    0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
    ${rect.left - PADDING}px ${rect.top - PADDING}px,
    ${rect.left - PADDING}px ${rect.bottom + PADDING}px,
    ${rect.right + PADDING}px ${rect.bottom + PADDING}px,
    ${rect.right + PADDING}px ${rect.top - PADDING}px,
    ${rect.left - PADDING}px ${rect.top - PADDING}px
  )`

  let tooltipStyle: React.CSSProperties = {}
  const pos = current.posicion
  if (pos === 'bottom') {
    tooltipStyle.top = rect.bottom + PADDING + 12
    tooltipStyle.left = Math.max(16, rect.left)
  } else if (pos === 'top') {
    tooltipStyle.top = rect.top - PADDING - 12 - TOOLTIP_H
    tooltipStyle.left = Math.max(16, rect.left)
  } else if (pos === 'right') {
    tooltipStyle.top = rect.top
    tooltipStyle.left = rect.right + PADDING + 12
  } else {
    tooltipStyle.top = rect.top
    tooltipStyle.left = rect.left - PADDING - 12 - TOOLTIP_W
  }
  tooltipStyle = clampToViewport(tooltipStyle)

  return createPortal(
    <div className='fixed inset-0 z-[9999]'>
      <div
        className='absolute inset-0 bg-black/60 transition-all duration-300'
        style={{ clipPath }}
        onClick={cerrar}
      />

      <div
        className='border-primary shadow-primary/30 pointer-events-none absolute rounded-md border-2 shadow-lg transition-all duration-300'
        style={{
          top: rect.top - PADDING,
          left: rect.left - PADDING,
          width: rect.width + PADDING * 2,
          height: rect.height + PADDING * 2,
        }}
      />

      <div
        ref={tooltipRef}
        className='animate-in fade-in slide-in-from-bottom-2 absolute z-[10000] w-80 rounded-xl border bg-background p-4 shadow-2xl duration-200'
        style={tooltipStyle}
      >
        <div className='mb-3 flex items-start gap-3'>
          <FeTutorialAvatar speaking={false} className='h-10 w-10 flex-shrink-0' />
          <div>
            <p className='font-semibold'>{current.titulo}</p>
            <p className='text-muted-foreground mt-1 text-sm leading-relaxed'>
              {current.descripcion}
            </p>
          </div>
        </div>

        <div className='flex items-center justify-between'>
          <span className='text-muted-foreground text-xs'>
            {paso + 1} / {pasos.length}
          </span>
          <div className='flex gap-2'>
            <Button variant='ghost' size='sm' onClick={cerrar}>
              Saltar
            </Button>
            {paso > 0 && (
              <Button variant='outline' size='sm' onClick={anterior}>
                Anterior
              </Button>
            )}
            <Button size='sm' onClick={siguiente} data-tour-primary>
              {paso < pasos.length - 1 ? 'Siguiente' : 'Listo'}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
