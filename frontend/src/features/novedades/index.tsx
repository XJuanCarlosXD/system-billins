import { useMemo, useState } from 'react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Sparkles, Bug, Rocket, Calendar } from 'lucide-react'
import { NOVEDADES, type Novedad, type TipoNovedad } from '@/data/novedades'
import { cn } from '@/lib/utils'

const TIPO_META: Record<
  TipoNovedad,
  { label: string; icon: typeof Rocket; dot: string; badge: string }
> = {
  nuevo: {
    label: 'Nuevo',
    icon: Rocket,
    dot: 'bg-emerald-500',
    badge:
      'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  },
  mejora: {
    label: 'Mejora',
    icon: Sparkles,
    dot: 'bg-sky-500',
    badge: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400',
  },
  correccion: {
    label: 'Corrección',
    icon: Bug,
    dot: 'bg-amber-500',
    badge:
      'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  },
}

const FILTROS: { key: 'todos' | TipoNovedad; label: string }[] = [
  { key: 'todos', label: 'Todas' },
  { key: 'nuevo', label: 'Nuevo' },
  { key: 'mejora', label: 'Mejoras' },
  { key: 'correccion', label: 'Correcciones' },
]

function formatFecha(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-DO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function NovedadesPage() {
  const [filtro, setFiltro] = useState<'todos' | TipoNovedad>('todos')

  const grupos = useMemo(() => {
    const items = NOVEDADES.filter(
      (n) => filtro === 'todos' || n.tipo === filtro
    )
    const map = new Map<string, Novedad[]>()
    for (const n of items) {
      const arr = map.get(n.fecha) ?? []
      arr.push(n)
      map.set(n.fecha, arr)
    }
    // Ya vienen ordenadas desc por fecha; conservamos ese orden de aparición.
    return Array.from(map.entries())
  }, [filtro])

  const total = NOVEDADES.length

  return (
    <>
      <Header>
        <h2 className='text-lg font-semibold me-auto flex items-center gap-2'>
          <Sparkles className='h-5 w-5' /> Novedades
        </h2>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main fluid>
        <div className='mb-6 flex flex-col gap-2'>
          <p className='text-sm text-muted-foreground max-w-2xl'>
            Historial de actualizaciones de ZentoryERP. Cada vez que se sube una
            mejora, una función nueva o una corrección al sistema, aparece aquí
            como una noticia.
          </p>
          <div className='flex flex-wrap items-center gap-2'>
            {FILTROS.map((f) => (
              <Button
                key={f.key}
                size='sm'
                variant={filtro === f.key ? 'default' : 'outline'}
                onClick={() => setFiltro(f.key)}
              >
                {f.label}
              </Button>
            ))}
            <Badge variant='secondary' className='ms-auto'>
              {total} novedad{total === 1 ? '' : 'es'}
            </Badge>
          </div>
        </div>

        {grupos.length === 0 && (
          <Card>
            <CardContent className='py-10 text-center text-muted-foreground'>
              No hay novedades para este filtro.
            </CardContent>
          </Card>
        )}

        <div className='relative'>
          {grupos.map(([fecha, items]) => (
            <div key={fecha} className='mb-8'>
              <div className='mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground'>
                <Calendar className='h-4 w-4' />
                {formatFecha(fecha)}
              </div>

              <div className='relative ms-2 border-s ps-6'>
                {items.map((n, i) => {
                  const meta = TIPO_META[n.tipo]
                  const Icon = meta.icon
                  return (
                    <div key={`${fecha}-${i}`} className='relative mb-4 last:mb-0'>
                      <span
                        className={cn(
                          'absolute -start-[31px] top-1.5 h-3 w-3 rounded-full ring-4 ring-background',
                          meta.dot
                        )}
                      />
                      <Card>
                        <CardContent className='py-4'>
                          <div className='mb-1 flex flex-wrap items-center gap-2'>
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
                                meta.badge
                              )}
                            >
                              <Icon className='h-3 w-3' />
                              {meta.label}
                            </span>
                            <Badge variant='outline' className='text-xs'>
                              {n.modulo}
                            </Badge>
                            {n.commit && (
                              <span className='ms-auto font-mono text-[11px] text-muted-foreground'>
                                {n.commit}
                              </span>
                            )}
                          </div>
                          <h3 className='font-semibold leading-snug'>
                            {n.titulo}
                          </h3>
                          <p className='mt-1 text-sm text-muted-foreground'>
                            {n.descripcion}
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </Main>
    </>
  )
}
