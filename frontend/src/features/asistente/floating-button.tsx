import { useEffect } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const HIDDEN_PREFIXES = ['/asistente', '/print', '/sign-in', '/sign-up']

export function AsistenteFloatingButton() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const hidden = HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))

  useEffect(() => {
    if (hidden) return
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        navigate({ to: '/asistente' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hidden, navigate])

  if (hidden) return null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label='Abrir asistente (Ctrl+K)'
          onClick={() => navigate({ to: '/asistente' })}
          className={cn(
            'fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg',
            'bg-primary hover:bg-primary/90'
          )}
          size='icon'
        >
          <Bot className='size-7' />
        </Button>
      </TooltipTrigger>
      <TooltipContent side='left'>
        Asistente · Ctrl+K
      </TooltipContent>
    </Tooltip>
  )
}
