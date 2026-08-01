import { type LinkProps } from '@tanstack/react-router'

type User = {
  name: string
  email: string
  avatar: string
}

type Team = {
  name: string
  logo: React.ElementType
  plan: string
}

type BaseNavItem = {
  title: string
  badge?: string
  icon?: React.ElementType
  search?: Record<string, unknown>
  requires?: 'is_dba'
}

type NavLink = BaseNavItem & {
  url: LinkProps['to'] | (string & {})
  items?: never
}

// Collapsible groups can nest arbitrarily: their children are themselves
// NavItems (links or further collapsibles), enabling the 3-level
// "Contabilidad > Configuracion > Catalogo de cuentas" sidebar tree.
type NavCollapsible = BaseNavItem & {
  items: NavItem[]
  url?: never
}

type NavItem = NavCollapsible | NavLink

type NavGroup = {
  title: string
  items: NavItem[]
}

// Un modulo de negocio (Facturacion, Cuentas por Cobrar, ...). Cada uno
// trae su propio arbol de 3 niveles (navGroups), que es lo unico que el
// sidebar muestra cuando el usuario esta "dentro" de ese modulo.
type SidebarModule = {
  code: string
  title: string
  icon: React.ElementType
  navGroups: NavGroup[]
}

// Accesos rapidos que no pertenecen a ningun modulo (Alertas NCF, Empresas,
// Permisos, Historial, Manuales, Configuracion, Reportes de Problemas).
// Viven solo en la pantalla de Inicio, no en el sidebar de un modulo.
type HomeShortcut = {
  title: string
  url: LinkProps['to'] | (string & {})
  icon: React.ElementType
}

type SidebarData = {
  user: User
  teams: Team[]
  modules: SidebarModule[]
  homeShortcuts: HomeShortcut[]
}

export type {
  SidebarData,
  SidebarModule,
  HomeShortcut,
  NavGroup,
  NavItem,
  NavCollapsible,
  NavLink,
}
