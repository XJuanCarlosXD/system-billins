import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Sparkles, X } from 'lucide-react'
import { type AsistenteSkill, listSkills } from '@/lib/api-client-asistente'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type Props = {
  active: string | null
  onChange: (skill: string | null) => void
  lastUserMessage?: string | null
}

// Triggers de auto-sugerencia: matchea palabras clave en el ultimo mensaje del
// usuario para sugerir activar una skill especifica.
const SUGGEST_TRIGGERS: Array<{ skill: string; pattern: RegExp; label: string }> = [
  { skill: 'facturar', pattern: /\b(factur|hacer factura|nueva factura|crear factura)/i, label: 'facturar' },
  { skill: 'cotizar', pattern: /\b(cotizaci|cotizar|presupuesto)/i, label: 'cotizar' },
  { skill: 'cerrar-caja', pattern: /\b(cerrar caja|cuadre|cierre de caja)/i, label: 'cerrar-caja' },
  { skill: 'conciliar-banco', pattern: /\b(conciliar|conciliacion bancaria|banco)/i, label: 'conciliar-banco' },
  { skill: 'consultar-cuenta-cliente', pattern: /\b(estado de cuenta|cuenta del cliente|aging)/i, label: 'consultar-cuenta-cliente' },
  { skill: 'nueva-empresa-onboarding', pattern: /\b(nueva empresa|crear compa|onboarding)/i, label: 'nueva-empresa-onboarding' },
]

export function SkillPicker({ active, onChange, lastUserMessage }: Props) {
  const { data: skills = [] } = useQuery({
    queryKey: ['asistente', 'skills'],
    queryFn: listSkills,
  })
  const [dismissed, setDismissed] = useState<string | null>(null)

  const suggestion =
    lastUserMessage && !active
      ? SUGGEST_TRIGGERS.find(
          (t) =>
            t.pattern.test(lastUserMessage) &&
            t.label !== dismissed &&
            skills.some((s) => s.name === t.skill)
        )
      : null

  const activeSkill = skills.find((s) => s.name === active)

  return (
    <div className='flex items-center gap-2'>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={active ? 'default' : 'outline'}
            size='sm'
            className='h-7 gap-1 text-xs'
          >
            <Sparkles size={12} />
            {active ? `Skill: ${active}` : 'Sin skill'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-64'>
          <DropdownMenuItem
            onSelect={() => onChange(null)}
            className='text-xs'
          >
            Ninguna
          </DropdownMenuItem>
          {skills.map((s: AsistenteSkill) => (
            <DropdownMenuItem
              key={s.name}
              onSelect={() => onChange(s.name)}
              className='flex flex-col items-start gap-0.5'
            >
              <span className='text-xs font-medium'>{s.name}</span>
              <span className='line-clamp-2 text-[10px] text-muted-foreground'>
                {s.description}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {active && (
        <Button
          variant='ghost'
          size='icon'
          className='h-7 w-7'
          aria-label='Desactivar skill'
          onClick={() => onChange(null)}
        >
          <X size={14} />
        </Button>
      )}

      {activeSkill && (
        <span className='hidden text-[10px] text-muted-foreground md:inline'>
          {activeSkill.description}
        </span>
      )}

      {suggestion && (
        <div className='flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-50/60 px-2 py-1 text-[11px] dark:bg-amber-950/30'>
          <Sparkles size={12} className='text-amber-600' />
          <span>Activar modo</span>
          <button
            type='button'
            className='font-medium underline'
            onClick={() => onChange(suggestion.skill)}
          >
            {suggestion.label}
          </button>
          <button
            type='button'
            className='ml-1 text-muted-foreground'
            aria-label='Descartar sugerencia'
            onClick={() => setDismissed(suggestion.label)}
          >
            <X size={11} />
          </button>
        </div>
      )}
    </div>
  )
}
