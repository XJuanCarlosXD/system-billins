import { useMemo } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { Command } from 'lucide-react'
import { useLayout } from '@/context/layout-provider'
import { useMe } from '@/hooks/use-me'
import { useAccess } from '@/hooks/use-access'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { Search } from '@/components/search'
import { sidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import { TeamSwitcher } from './team-switcher'
import type { NavItem, NavGroup as NavGroupType } from './types'

function currentModuleCode(pathname: string): string | null {
  const seg = pathname.split('/')[1]
  return seg && sidebarData.modules.some((m) => m.code === seg) ? seg : null
}

function filterNavItems(
  items: NavItem[],
  isAdmin: boolean,
  hasModule: (m: string) => boolean
): NavItem[] {
  const out: NavItem[] = []
  for (const item of items) {
    if (item.requires === 'is_dba' && !isAdmin) continue
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

// Fila fija "volver a Inicio" — reemplaza el rol de navegacion del logo,
// visible solo cuando el usuario esta dentro de un modulo.
function ModuleHomeLink() {
  const { setOpenMobile } = useSidebar()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip='Volver a Inicio'>
          <Link to='/' onClick={() => setOpenMobile(false)}>
            <Command />
            <span className='font-semibold'>ZentoryERP</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
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
  const pathname = useLocation({ select: (l) => l.pathname })
  const moduleCode = currentModuleCode(pathname)
  const activeModule = moduleCode
    ? sidebarData.modules.find((m) => m.code === moduleCode)
    : undefined

  const navGroups: NavGroupType[] = useMemo(() => {
    if (!activeModule) return []
    return activeModule.navGroups
      .map((g) => ({ ...g, items: filterNavItems(g.items, isAdmin, modGate) }))
      .filter((g) => g.items.length > 0)
  }, [activeModule, isAdmin, modGate])

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        {activeModule && <ModuleHomeLink />}
        <TeamSwitcher teams={sidebarData.teams} />
        {activeModule && (
          <div>
            <SidebarSearch />
          </div>
        )}
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
