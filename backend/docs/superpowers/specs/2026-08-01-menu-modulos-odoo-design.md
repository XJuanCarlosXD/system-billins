# Spec — Navegación por módulo estilo Odoo (Home + sidebar filtrado)

- Fecha: 2026-08-01
- Autor: JCABREU + Claude
- Estado: aprobado para implementación
- Alcance: `sidebar-data.ts`, `AppSidebar`, `Dashboard` (`/`), nuevo componente
  de grid de módulos. No toca ninguna pantalla interna de ningún módulo ni
  ninguna ruta existente.

## 0. Motivación

Hoy `AppSidebar` renderiza los 11 módulos (Facturación, CxC, CxP, ODC,
Licitaciones, Inventario, Bancos/Cheques, Caja Chica, Nómina, Activos Fijos,
Contabilidad) apilados simultáneamente en el sidebar, cada uno expandible.
El pedido es un flujo estilo Odoo: una pantalla de Inicio con un ícono grande
por módulo (el "app launcher"), y que al entrar a un módulo el sidebar
muestre **solo** el árbol de ese módulo — nada de los otros diez.

## 1. Qué ya existe (no se toca)

- `NavItem` / `NavCollapsible` / `NavLink` / `NavGroup` (`components/layout/types.ts`)
  — el modelo de datos de 3 niveles (Sección > Subsección > Item) se reutiliza
  tal cual para el árbol de cada módulo.
- `NavGroup` (`components/layout/nav-group.tsx`) — el componente que renderiza
  un árbol colapsable con soporte de sidebar colapsado (dropdown flyout). No
  se modifica: se le sigue pasando un `NavGroup[]`, solo cambia *cuántos* se
  le pasan (uno, el del módulo activo, en vez de todos).
- `TeamSwitcher` (`components/layout/team-switcher.tsx`) — selector de
  empresa/compañía activa. Es transversal a todos los módulos, se mantiene
  en el header del sidebar sin cambios.
- `useAccess().hasModule(code)` — ya filtra por permiso de módulo. Se sigue
  usando igual, solo que ahora también gatea qué tiles aparecen en el grid
  de Inicio.
- Todas las rutas (`/fat/nueva-factura`, `/odc/nueva-orden`, etc.) — **sin
  cambios**. Esto es un cambio de shell/navegación, no de contenido.

## 2. Modelo de datos — `sidebar-data.ts`

Reestructurar de un `navGroups: NavGroup[]` plano a un registro de módulos:

```ts
export interface SidebarModule {
  code: string          // 'fat' | 'cxc' | 'cxp' | 'odc' | 'lic' | 'inv' |
                         // 'chc' | 'acc' | 'sdn' | 'acf' | 'cnt'
  title: string          // 'Facturación', 'Cuentas por Cobrar', ...
  icon: React.ElementType
  navGroups: NavGroup[]  // el árbol de 3 niveles que hoy vive inline
}

export interface HomeShortcut {
  title: string
  url: LinkProps['to'] | (string & {})
  icon: React.ElementType
}

export const sidebarData: {
  user: User
  teams: Team[]
  modules: SidebarModule[]
  homeShortcuts: HomeShortcut[]
}
```

- Cada entrada de `modules` toma el `items` que hoy vive bajo
  `navGroups[…].items` con `title` = nombre del módulo (ej. "Facturación",
  "Órdenes de Compra") y lo convierte en `{ code, title, icon, navGroups }`
  donde `navGroups` son las secciones actuales de ese módulo tal cual
  (`Proceso`/`Consultas`/`Reportes`/`Cierres` para Facturación, etc.) — el
  árbol de 3 niveles no cambia, solo se saca del anidamiento
  `navGroups[grupo].items[móduloItem].items[sección]` y pasa a
  `modules[módulo].navGroups[sección]`.
- `homeShortcuts` reemplaza el contenido no-modular de hoy: Alertas NCF
  (`/ncf-alerts`), Empresas (`/empresas`), Permisos (`/sistema/usuarios`),
  Historial (`/sistema/historial`), Manuales (`/man`), Configuración
  (`/settings`). "Dashboard" (`/`) no entra en esta lista — es la ruta de
  Inicio misma, no un shortcut hacia otra parte.
- Códigos de módulo (11 total): `fat, cxc, cxp, odc, lic, inv, chc, acc,
  sdn, acf, cnt`. **`lic` se agrega al registro** — hoy `Licitaciones` vive
  en el sidebar pero `MODULE_PREFIXES` en `app-sidebar.tsx` no lo incluye,
  así que nunca se filtra por `hasModule('lic')`. Al construir el registro
  de módulos como fuente única de verdad, este gap se cierra: cualquier
  módulo que no esté en `hasModule` para el usuario actual queda fuera del
  grid de Inicio automáticamente.
- Íconos: se reutilizan los ya importados en `sidebar-data.ts`
  (`Receipt, CreditCard, Wallet, ShoppingCart, FileSearch, Package,
  Banknote, Coins, UsersIcon, Calculator`), excepto Activos Fijos, que hoy
  comparte `Package` con Inventario — se le asigna `Archive` (nuevo import
  de `lucide-react`) para que cada tile del grid tenga ícono distinguible.

## 3. Detección de "módulo actual"

Nueva función pura en `components/layout/app-sidebar.tsx` (reemplaza la
lógica ad-hoc de `inferModule`, que hoy solo mira el primer item de cada
grupo):

```ts
function currentModuleCode(pathname: string): string | null {
  const seg = pathname.split('/')[1]
  return seg && sidebarData.modules.some((m) => m.code === seg) ? seg : null
}
```

Se usa `useLocation({ select: (l) => l.pathname })` de TanStack Router
(mismo hook que ya usa `NavGroup` vía `href`). `pathname === '/'` o
cualquier ruta cuyo primer segmento no matchee un `code` de módulo (ej.
`/ncf-alerts`, `/settings`, `/sistema/historial`) → `currentModuleCode`
devuelve `null` → se trata como "fuera de módulo" (ver §4).

## 4. `AppSidebar` — dos estados

**Estado "Inicio"** (`currentModuleCode() === null`):
- Header: solo `TeamSwitcher`.
- Content: vacío — sin `NavGroup`. La navegación ocurre en la página de
  Inicio (grid de módulos + shortcuts), no en el sidebar.
- Footer: `NavUser` (sin cambios).

**Estado "dentro de módulo X"** (`currentModuleCode() === 'fat'` etc.):
- Header, en este orden:
  1. Fila fija "← Inicio": logo ZentoryERP + texto, `<Link to="/">`.
     Componente nuevo `ModuleHomeLink`, mismo alto/padding que
     `SidebarMenuButton` para verse integrado, no un elemento suelto.
  2. `TeamSwitcher` (sin cambios, sigue siendo necesario dentro del módulo).
- Content: el módulo activo se busca en `sidebarData.modules` por `code`,
  se le aplica el mismo `filterNavItems` que existe hoy (permiso
  `is_dba` + `hasModule`, aunque a nivel de módulo ya sabemos que
  `hasModule(code)` es true porque si no, no se pudo llegar a esa URL desde
  el grid — igual se deja corriendo `filterNavItems` sobre los hijos por si
  algún item interno individual tiene su propio `requires: 'is_dba'`), y se
  renderiza con `<NavGroup>` uno por sección del módulo — el mismo
  componente de hoy, sin tocar.
- Footer: `NavUser` (sin cambios).

`filterNavItems` se mantiene igual (opera sobre `NavItem[]`), solo cambia
la fuente de datos que se le pasa (un módulo a la vez, no los 4 grupos
completos).

## 5. Página de Inicio (`/`, `features/dashboard/index.tsx`)

Nuevo componente `frontend/src/features/dashboard/components/module-launcher.tsx`:

- Recibe `modules: SidebarModule[]` (ya filtrados por `hasModule` — módulo
  sin permiso **no aparece**, no se muestra deshabilitado).
- Grid responsivo (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` o similar,
  siguiendo breakpoints ya usados en el resto del dashboard) de tiles
  cuadrados: ícono grande + título del módulo. Cada tile es
  `<Link to={primeraUrlDelModulo}>` — la primera URL hoja encontrada
  recorriendo `module.navGroups` en orden (mismo patrón que
  `inferModule` usa hoy para inferir una URL representativa).
- Se inserta en `Dashboard()` (`features/dashboard/index.tsx`) como primera
  sección, antes de las cards de KPIs/ventas que ya existen — el resto del
  dashboard (ventas del día, alertas NCF, empresas activas, actividad
  reciente) **no se toca**.
- Debajo o junto al grid, una fila compacta de `homeShortcuts` (Alertas
  NCF, Empresas, Permisos, Historial, Manuales, Configuración) como
  botones/links pequeños — no reemplaza las cards ricas de Alertas NCF /
  Empresas que el dashboard ya renderiza con datos en vivo; es una vía de
  navegación rápida adicional hacia esas y las 4 secciones (Permisos,
  Historial, Manuales, Configuración) que hoy solo viven en el grupo
  "Sistema" del sidebar y no tienen ninguna presencia en el dashboard.

## 6. Fuera de alcance

- Cambiar cualquier ruta existente (`/fat/...`, `/odc/...`, etc.).
- Cambiar contenido interno de cualquier módulo.
- Persistir "último módulo visitado" o favoritos — cada visita a `/` muestra
  el grid completo, sin estado adicional.
- Cambiar el comportamiento del sidebar colapsado (rail con dropdowns) —
  `NavGroup` ya maneja ese caso y no se toca.
- Mobile — se hereda el comportamiento ya existente de `Sidebar`/`NavGroup`
  (`isMobile`, `setOpenMobile`), sin ajustes adicionales.
- Tocar `NavUser`, `Header`, `SidebarTrigger` — sin cambios.
