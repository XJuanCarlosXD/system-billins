import { useEffect, useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FeTutorialDialog, type TutorialPaso } from './fe-tutorial-dialog'

interface Props {
  moduloKey: string
  titulo: string
  pasos: TutorialPaso[]
  feActivo: boolean
}

export function FeTutorialButton({ moduloKey, titulo, pasos, feActivo }: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!feActivo) return
    try {
      const key = `fe-tutorial-visto-${moduloKey}`
      if (!localStorage.getItem(key)) {
        const timer = setTimeout(() => setOpen(true), 400)
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
        title='Ver tutorial de facturación electrónica'
      >
        <GraduationCap className='h-4 w-4' />
        Tutorial e-CF
      </Button>

      <FeTutorialDialog
        moduloKey={moduloKey}
        titulo={titulo}
        pasos={pasos}
        feActivo={feActivo}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
