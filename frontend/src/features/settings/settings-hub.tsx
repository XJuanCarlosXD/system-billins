import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Search as SearchIcon, Settings as SettingsIcon, X } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ConfigDrawer } from '@/components/config-drawer'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { useDebounce } from '@/hooks/use-debounce'
import {
  settingsCatalog,
  findContext,
  findSettingsItem,
} from './data/settings-catalog'
import { SettingsTree } from './components/settings-tree'
import { PanelErrorBoundary } from './components/panel-error-boundary'

const DEFAULT_SLUG = 'profile'

type RouteParams = { slug?: string }
type RouteSearch = { q?: string }

export function SettingsHub() {
  const params = useParams({ strict: false }) as RouteParams
  const navigate = useNavigate()

  const activeSlug = params.slug ?? DEFAULT_SLUG
  const active = useMemo(
    () => findSettingsItem(activeSlug) ?? findSettingsItem(DEFAULT_SLUG)!,
    [activeSlug]
  )
  const ctx = useMemo(() => findContext(active.slug), [active.slug])

  const initialQ = ((): string => {
    if (typeof window === 'undefined') return ''
    return new URL(window.location.href).searchParams.get('q') ?? ''
  })()
  const [query, setQuery] = useState(initialQ)
  // El tree filtra por debouncedQuery — antes filtraba con cada keystroke,
  // disparando re-renders pesados a 60Hz.
  const debouncedQuery = useDebounce(query, 200)

  useEffect(() => {
    const url = new URL(window.location.href)
    if (debouncedQuery) url.searchParams.set('q', debouncedQuery)
    else url.searchParams.delete('q')
    window.history.replaceState(null, '', url.toString())
  }, [debouncedQuery])

  const handleSelect = (slug: string) => {
    navigate({
      to: '/settings/$slug',
      params: { slug },
      search: query ? ({ q: query } as RouteSearch) : ({} as RouteSearch),
    })
  }

  return (
    <>
      <Header>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main fixed>
        <div className='flex items-center gap-3'>
          <SettingsIcon className='h-6 w-6 text-muted-foreground' />
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>Configuración</h1>
            <p className='text-sm text-muted-foreground'>
              {ctx
                ? `${ctx.cat.title} · ${ctx.group.title}`
                : 'Preferencias y catálogos del sistema.'}
            </p>
          </div>
          <div className='ms-auto w-72'>
            <div className='relative'>
              <SearchIcon className='pointer-events-none absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Buscar en configuración…'
                className='ps-8'
              />
              {query && (
                <Button
                  variant='ghost'
                  size='icon'
                  className='absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2'
                  onClick={() => setQuery('')}
                >
                  <X className='h-3.5 w-3.5' />
                </Button>
              )}
            </div>
          </div>
        </div>

        <Separator className='my-4' />

        <div className='flex flex-1 gap-4 overflow-hidden lg:gap-6'>
          <aside className='hidden w-64 shrink-0 overflow-hidden rounded-md border bg-card lg:block'>
            <SettingsTree
              categories={settingsCatalog}
              activeSlug={active.slug}
              onSelect={handleSelect}
              query={debouncedQuery}
            />
          </aside>

          <section className='flex flex-1 flex-col overflow-hidden'>
            <div>
              <h2 className='text-lg font-semibold'>{active.title}</h2>
              {active.description && (
                <p className='text-sm text-muted-foreground'>{active.description}</p>
              )}
            </div>
            <div
              key={active.slug}
              className='mt-3 flex-1 overflow-auto rounded-md border bg-card p-4'
            >
              <PanelErrorBoundary resetKey={active.slug}>
                {active.render()}
              </PanelErrorBoundary>
            </div>
          </section>
        </div>
      </Main>
    </>
  )
}
