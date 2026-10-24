import { useEffect, useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FeGuiaInteractiva } from './fe-guia-interactiva'
import type { GuiaPaso } from './fe-guia-pasos'

interface Props {
  moduloKey: string
  pasos: GuiaPaso[]
  feActivo: boolean
}

export function FeTutorialButton({ moduloKey, pasos, feActivo }: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!feActivo) return
    try {
      const key = `fe-guia-visto-${moduloKey}`
      if (!localStorage.getItem(key)) {
        const timer = setTimeout(() => setOpen(true), 800)
        return () => clearTimeout(timer)
      }
    } catch {
      // ignore
    }
  }, [feActivo, moduloKey])

  if (!feActivo) return null

  return (
    <>
      <Button
        variant='outline'
        size='sm'
        onClick={() => setOpen(true)}
        className='gap-1.5'
        aria-label='Ver guía paso a paso de facturación electrónica'
        title='Ver guía paso a paso de facturación electrónica'
      >
        <GraduationCap className='h-4 w-4' />
        Guía e-CF
      </Button>

      <FeGuiaInteractiva
        moduloKey={moduloKey}
        pasos={pasos}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
