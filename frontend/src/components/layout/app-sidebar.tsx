import { useMemo } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { Command, LayoutDashboard } from 'lucide-react'
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
import type {
  NavItem,
  NavGroup as NavGroupType,
  SidebarModule,
} from './types'

const OPERACION_CODES = ['fat', 'cxc', 'cxp', 'odc', 'lic', 'inv', 'chc']
const ADMINISTRACION_CODES = ['acc', 'sdn', 'acf', 'cnt']

function currentModuleCode(pathname: string): string | null {
  const seg = pathname.split('/')[1]
  return seg && sidebarData.modules.some((m) => m.code === seg) ? seg : null
}

function moduleAsNavItem(m: SidebarModule): NavItem {
  // En el sidebar de Inicio (menu completo apilado, todos los modulos a
  // la vez) no se repite el grupo Configuracion de cada modulo dentro de
  // su dropdown -- ese grupo (title vacio, ver sidebar-data.ts) vive solo
  // en el sidebar angosto de cuando el usuario ya entro a ese modulo
  // especifico (ver activeModule mas abajo).
  return {
    title: m.title,
    icon: m.icon,
    items: m.navGroups.filter((g) => g.title !== ''),
  }
}

function shortcut(url: string): NavItem {
  const s = sidebarData.homeShortcuts.find((h) => h.url === url)!
  return { title: s.title, url: s.url, icon: s.icon }
}

// El sidebar de Inicio (fuera de cualquier modulo) reconstruye el menu
// completo de los 11 modulos apilados, con la misma agrupacion
// General/Operacion/Administracion/Sistema que tenia el sidebar viejo —
// el usuario prefiere verlo asi (con el grid de ModuleLauncher en el
// contenido, no en el sidebar) en vez de un sidebar vacio.
function buildHomeNavGroups(
  isAdmin: boolean,
  hasModule: (m: string) => boolean
): NavGroupType[] {
  const byCode = (codes: string[]) =>
    sidebarData.modules
      .filter((m) => codes.includes(m.code) && (isAdmin || hasModule(m.code)))
      .map(moduleAsNavItem)

  return [
    {
      title: 'General',
      items: [
        { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
        shortcut('/reportes'),
        shortcut('/ncf-alerts'),
        shortcut('/empresas'),
      ],
    },
    { title: 'Operacion', items: byCode(OPERACION_CODES) },
    { title: 'Administracion', items: byCode(ADMINISTRACION_CODES) },
    {
      title: 'Sistema',
      items: [
        shortcut('/sistema/usuarios'),
        shortcut('/sistema/historial'),
        shortcut('/man'),
        shortcut('/settings'),
      ],
    },
  ].filter((g) => g.items.length > 0)
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
          <Link to='/dashboard' onClick={() => setOpenMobile(false)}>
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
    if (activeModule) {
      return activeModule.navGroups
        .map((g) => ({ ...g, items: filterNavItems(g.items, isAdmin, modGate) }))
        .filter((g) => g.items.length > 0)
    }
    return buildHomeNavGroups(isAdmin, modGate)
  }, [activeModule, isAdmin, modGate])

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        {activeModule && <ModuleHomeLink />}
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
