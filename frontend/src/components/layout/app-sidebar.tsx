import { useMemo } from 'react'
import { useLayout } from '@/context/layout-provider'
import { useMe } from '@/hooks/use-me'
import { useAccess } from '@/hooks/use-access'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { Search } from '@/components/search'
// import { AppTitle } from './app-title'
import { sidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import { TeamSwitcher } from './team-switcher'
import type { NavItem } from './types'

const MODULE_PREFIXES = ['fat', 'cxc', 'cxp', 'inv', 'cnt', 'chc', 'acc', 'acf', 'odc', 'sdn']

function inferModule(item: NavItem): string | null {
  const url =
    'url' in item && item.url
      ? String(item.url)
      : 'items' in item && item.items?.[0] && 'url' in item.items[0] && item.items[0].url
        ? String(item.items[0].url)
        : null
  if (!url || !url.startsWith('/')) return null
  const first = url.split('/')[1]?.split('?')[0]
  return first && MODULE_PREFIXES.includes(first) ? first : null
}

function filterNavItems(
  items: NavItem[],
  isAdmin: boolean,
  hasModule: (m: string) => boolean
): NavItem[] {
  const out: NavItem[] = []
  for (const item of items) {
    if (item.requires === 'is_dba' && !isAdmin) continue
    const mod = inferModule(item)
    if (mod && !hasModule(mod)) continue
    if ('items' in item && item.items) {
      const children = filterNavItems(item.items, isAdmin, hasModule)
      if (children.length === 0) continue
      out.push({ ...item, items: children })
    } else {
      out.push(item)
    }
  }
  return out
}

function SidebarSearch() {
  const { state } = useSidebar()
  if (state === 'collapsed') return null
  return (
    <div className='px-1 pb-1'>
      <Search placeholder='Buscar pantalla…' className='w-full' />
    </div>
  )
}

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const { data: me } = useMe()
  const { hasModule, isAdmin: accessIsAdmin, isLoading: accessLoading } = useAccess()
  const isAdmin = accessIsAdmin || (me?.is_admin ?? false)
  // While /api/me/access/ is loading, do not filter by module (would hide
  // everything for non-admins). Fall back to the previous isAdmin-only rule.
  const modGate = accessLoading ? () => true : hasModule
  const navGroups = useMemo(
    () =>
      sidebarData.navGroups
        .map((g) => ({ ...g, items: filterNavItems(g.items, isAdmin, modGate) }))
        .filter((g) => g.items.length > 0),
    [isAdmin, modGate]
  )
  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <TeamSwitcher teams={sidebarData.teams} />
        <div>
          <SidebarSearch />
        </div>
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={sidebarData.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
