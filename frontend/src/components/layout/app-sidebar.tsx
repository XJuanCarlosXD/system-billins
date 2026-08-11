import { useEffect, useMemo } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { Command, LayoutDashboard } from 'lucide-react'
import { useLayout } from '@/context/layout-provider'
import { useAccess } from '@/hooks/use-access'
import { useMe } from '@/hooks/use-me'
import {
  useSidebarBadges,
  type SidebarBadge,
  type BadgeKey,
} from '@/hooks/use-sidebar-badges'
import {
  CONSULTA_PATHS,
  DOC_MODULES,
  INV_CONSULTA_VIEW,
  type DocModule,
} from '@/lib/sidebar-badges'
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
import type { NavItem, NavGroup as NavGroupType, SidebarModule } from './types'

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

function shortcut(url: string, badge?: SidebarBadge): NavItem {
  const s = sidebarData.homeShortcuts.find((h) => h.url === url)!
  return { title: s.title, url: s.url, icon: s.icon, ...badgeProps(badge) }
}

type Badges = Partial<Record<BadgeKey, SidebarBadge>>

function badgeProps(b?: SidebarBadge): Pick<NavItem, 'badge' | 'badgeVariant'> {
  return b ? { badge: String(b.count), badgeVariant: b.variant } : {}
}

// Pone el badge del módulo en la hoja de su Consulta de Documentos (o
// Consulta de Facturas para FAT) Y en cada sección ancestro que la contiene,
// para que al abrir el dropdown del módulo se vea de dónde es la novedad.
function withConsultaBadge(
  items: NavItem[],
  code: DocModule,
  badge?: SidebarBadge
): NavItem[] {
  if (!badge) return items
  const target = CONSULTA_PATHS[code]
  const isTarget = (it: NavItem) =>
    it.url === target &&
    (code !== 'inv' ||
      (it.search as { view?: string } | undefined)?.view === INV_CONSULTA_VIEW)

  // Devuelve [item, contieneObjetivo]; propaga el badge hacia arriba.
  const inject = (it: NavItem): [NavItem, boolean] => {
    if (it.items) {
      let hit = false
      const kids = it.items.map((c) => {
        const [ni, m] = inject(c)
        hit = hit || m
        return ni
      })
      return hit
        ? [{ ...it, items: kids, ...badgeProps(badge) }, true]
        : [{ ...it, items: kids }, false]
    }
    return isTarget(it) ? [{ ...it, ...badgeProps(badge) }, true] : [it, false]
  }
  return items.map((it) => inject(it)[0])
}

// El sidebar de Inicio (fuera de cualquier modulo) reconstruye el menu
// completo de los 11 modulos apilados, con la misma agrupacion
// General/Operacion/Administracion/Sistema que tenia el sidebar viejo —
// el usuario prefiere verlo asi (con el grid de ModuleLauncher en el
// contenido, no en el sidebar) en vez de un sidebar vacio.
function buildHomeNavGroups(
  isAdmin: boolean,
  hasModule: (m: string) => boolean,
  badges: Badges
): NavGroupType[] {
  const byCode = (codes: string[]) =>
    sidebarData.modules
      .filter((m) => codes.includes(m.code) && (isAdmin || hasModule(m.code)))
      .map((m) => {
        const item = moduleAsNavItem(m)
        const code = m.code as DocModule
        const b = DOC_MODULES.includes(code) ? badges[code] : undefined
        if (!b) return item
        // Badge en el módulo (nivel superior) + en la sección/hoja de consulta
        // para que el dropdown indique de dónde es la novedad.
        return {
          ...item,
          ...badgeProps(b),
          items: withConsultaBadge(item.items ?? [], code, b),
        }
      })

  return [
    {
      title: 'General',
      items: [
        { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
        shortcut('/novedades', badges.novedades),
        shortcut('/reportes', badges.reportes),
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
  const {
    hasModule,
    isAdmin: accessIsAdmin,
    isLoading: accessLoading,
  } = useAccess()
  const isAdmin = accessIsAdmin || (me?.is_admin ?? false)
  // While /api/me/access/ is loading, do not filter by module (would hide
  // everything for non-admins). Fall back to the previous isAdmin-only rule.
  const modGate = accessLoading ? () => true : hasModule
  const pathname = useLocation({ select: (l) => l.pathname })
  const searchView = useLocation({
    select: (l) => (l.search as { view?: string } | undefined)?.view,
  })
  const moduleCode = currentModuleCode(pathname)
  const activeModule = moduleCode
    ? sidebarData.modules.find((m) => m.code === moduleCode)
    : undefined

  const { badges, markSeen } = useSidebarBadges()

  // Al entrar a una vista con contador, limpiar su badge.
  useEffect(() => {
    if (pathname === '/novedades') markSeen('novedades')
    else if (pathname === '/reportes') markSeen('reportes')
    else if (pathname === CONSULTA_PATHS.fat) markSeen('fat')
    else if (pathname === CONSULTA_PATHS.cxc) markSeen('cxc')
    else if (pathname === CONSULTA_PATHS.cxp) markSeen('cxp')
    else if (pathname === CONSULTA_PATHS.inv && searchView === INV_CONSULTA_VIEW)
      markSeen('inv')
  }, [pathname, searchView, markSeen])

  const navGroups: NavGroupType[] = useMemo(() => {
    if (activeModule) {
      const code = activeModule.code as DocModule
      const consultaBadge = DOC_MODULES.includes(code)
        ? badges[code]
        : undefined
      return activeModule.navGroups
        .map((g) => ({
          ...g,
          items: withConsultaBadge(
            filterNavItems(g.items, isAdmin, modGate),
            code,
            consultaBadge
          ),
        }))
        .filter((g) => g.items.length > 0)
    }
    return buildHomeNavGroups(isAdmin, modGate, badges)
  }, [activeModule, isAdmin, modGate, badges])

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
