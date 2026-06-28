import { useMemo } from 'react'
import { useLayout } from '@/context/layout-provider'
import { useMe } from '@/hooks/use-me'
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

function filterNavItems(items: NavItem[], isAdmin: boolean): NavItem[] {
  const out: NavItem[] = []
  for (const item of items) {
    if (item.requires === 'is_dba' && !isAdmin) continue
    if ('items' in item && item.items) {
      const children = filterNavItems(item.items, isAdmin)
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
  const isAdmin = me?.is_admin ?? false
  const navGroups = useMemo(
    () =>
      sidebarData.navGroups
        .map((g) => ({ ...g, items: filterNavItems(g.items, isAdmin) }))
        .filter((g) => g.items.length > 0),
    [isAdmin]
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
