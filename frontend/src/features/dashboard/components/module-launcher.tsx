import { Link } from '@tanstack/react-router'
import { useAccess } from '@/hooks/use-access'
import { useMe } from '@/hooks/use-me'
import { Skeleton } from '@/components/ui/skeleton'
import { sidebarData } from '@/components/layout/data/sidebar-data'
import type { NavGroup, NavItem } from '@/components/layout/types'

// Encuentra la primera URL hoja del arbol de un modulo, recorriendo
// navGroups en orden (mismo patron que antes usaba inferModule).
function firstUrlOf(navGroups: NavGroup[]): string | null {
  for (const group of navGroups) {
    const url = firstUrlOfItems(group.items)
    if (url) return url
  }
  return null
}

function firstUrlOfItems(items: NavItem[]): string | null {
  for (const item of items) {
    if ('url' in item && item.url) return String(item.url)
    if ('items' in item && item.items) {
      const nested = firstUrlOfItems(item.items)
      if (nested) return nested
    }
  }
  return null
}

export function ModuleLauncher() {
  const { data: me } = useMe()
  const { hasModule, isAdmin: accessIsAdmin, isLoading } = useAccess()
  const isAdmin = accessIsAdmin || (me?.is_admin ?? false)

  if (isLoading) {
    return (
      <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4'>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className='h-24 w-full rounded-lg' />
        ))}
      </div>
    )
  }

  const visibleModules = sidebarData.modules.filter(
    (m) => isAdmin || hasModule(m.code)
  )

  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4'>
        {visibleModules.map((m) => {
          const url = firstUrlOf(m.navGroups)
          if (!url) return null
          return (
            <Link
              key={m.code}
              to={url}
              className='flex flex-col items-center justify-center gap-2 rounded-lg border bg-card p-4 text-center transition-colors hover:bg-accent hover:text-accent-foreground'
            >
              <m.icon className='h-8 w-8' />
              <span className='text-sm font-medium'>{m.title}</span>
            </Link>
          )
        })}
      </div>
      <div className='flex flex-wrap gap-2'>
        {sidebarData.homeShortcuts.map((s) => (
          <Link
            key={s.url}
            to={s.url}
            className='inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground'
          >
            <s.icon className='h-3.5 w-3.5' />
            {s.title}
          </Link>
        ))}
      </div>
    </div>
  )
}
