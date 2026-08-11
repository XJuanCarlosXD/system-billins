import { Link } from '@tanstack/react-router'
import { useAccess } from '@/hooks/use-access'
import { useMe } from '@/hooks/use-me'
import { useSidebarBadges, type SidebarBadge } from '@/hooks/use-sidebar-badges'
import { DOC_MODULES, type DocModule } from '@/lib/sidebar-badges'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { sidebarData } from '@/components/layout/data/sidebar-data'
import type { NavGroup, NavItem } from '@/components/layout/types'

// Encuentra la primera URL hoja del arbol operativo de un modulo (Proceso/
// Procesos/Mantenimiento/etc), recorriendo navGroups en orden. El grupo
// Configuracion (title vacio, ver sidebar-data.ts) se salta a proposito:
// entrar a un modulo desde el grid debe llevar a la pantalla de trabajo
// del dia a dia, no a un catalogo de configuracion.
type LaunchTarget = { url: string; search?: Record<string, unknown> }

function firstUrlOf(navGroups: NavGroup[]): LaunchTarget | null {
  for (const group of navGroups) {
    if (group.title === '') continue
    const target = firstUrlOfItems(group.items)
    if (target) return target
  }
  return null
}

function firstUrlOfItems(items: NavItem[]): LaunchTarget | null {
  for (const item of items) {
    if ('url' in item && item.url) {
      return { url: String(item.url), search: 'search' in item ? item.search : undefined }
    }
    if ('items' in item && item.items) {
      const nested = firstUrlOfItems(item.items)
      if (nested) return nested
    }
  }
  return null
}

function badgeColor(variant?: SidebarBadge['variant']) {
  return variant === 'warning'
    ? 'bg-amber-500 text-white'
    : variant === 'success'
      ? 'bg-emerald-600 text-white'
      : 'bg-primary text-primary-foreground'
}

export function ModuleLauncher() {
  const { data: me } = useMe()
  const { hasModule, isAdmin: accessIsAdmin, isLoading } = useAccess()
  const isAdmin = accessIsAdmin || (me?.is_admin ?? false)
  const { badges } = useSidebarBadges()

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
          const target = firstUrlOf(m.navGroups)
          if (!target) return null
          const b = DOC_MODULES.includes(m.code as DocModule)
            ? badges[m.code as DocModule]
            : undefined
          return (
            <Link
              key={m.code}
              to={target.url}
              search={target.search as never}
              className='relative flex flex-col items-center justify-center gap-2 rounded-lg border bg-card p-4 text-center transition-colors hover:bg-accent hover:text-accent-foreground'
            >
              {b && (
                <Badge
                  className={cn(
                    'absolute end-2 top-2 min-w-5 justify-center rounded-full px-1 py-0 text-xs border-transparent',
                    badgeColor(b.variant)
                  )}
                >
                  {b.count}
                </Badge>
              )}
              <m.icon className='h-8 w-8' />
              <span className='text-sm font-medium'>{m.title}</span>
            </Link>
          )
        })}
      </div>
      <div className='flex flex-wrap gap-2'>
        {sidebarData.homeShortcuts.map((s) => {
          const sb =
            s.url === '/novedades'
              ? badges.novedades
              : s.url === '/reportes'
                ? badges.reportes
                : undefined
          return (
            <Link
              key={s.url}
              to={s.url}
              className='inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground'
            >
              <s.icon className='h-3.5 w-3.5' />
              {s.title}
              {sb && (
                <Badge
                  className={cn(
                    'ms-1 min-w-4 justify-center rounded-full px-1 py-0 text-[10px] border-transparent',
                    badgeColor(sb.variant)
                  )}
                >
                  {sb.count}
                </Badge>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
