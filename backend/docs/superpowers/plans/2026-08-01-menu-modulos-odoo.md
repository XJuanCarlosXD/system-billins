# Menú de Navegación por Módulo (estilo Odoo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el sidebar "todos los módulos apilados" por una pantalla
de Inicio con un grid de módulos (estilo Odoo) y un sidebar que, dentro de un
módulo, muestra solo el árbol de ese módulo.

**Architecture:** `sidebar-data.ts` pasa de `navGroups: NavGroup[]` plano a
`{ modules: SidebarModule[], homeShortcuts: HomeShortcut[] }`. `AppSidebar`
detecta el módulo activo por el primer segmento de la URL y renderiza dos
estados (Inicio sin árbol / dentro-de-módulo con el árbol de ese módulo
usando el `NavGroup` existente sin cambios). Un componente nuevo
`ModuleLauncher` en el Dashboard renderiza el grid de tiles + shortcuts.

**Tech Stack:** React + TypeScript + Vite, TanStack Router (`useLocation`),
shadcn/ui, Django backend sin cambios.

**Spec de referencia:** `docs/superpowers/specs/2026-08-01-menu-modulos-odoo-design.md`

**Nota sobre testing:** sin test runner de frontend en este repo — se valida
con `tsc --noEmit` y smoke manual/visual contra la VM. Cada tarea usa esas
herramientas en vez de tests unitarios.

**Nota de spec:** el spec lista 6 `homeShortcuts` pero el grupo "General"
actual tiene 4 items, no 3 — el spec omitió "Reportes de Problemas"
(`/reportes`, ícono `LifeBuoy`). Esta tarea la incluye como 7º shortcut
(fix de un gap de cobertura del spec, no un cambio de alcance: sigue siendo
"un item que no pertenece a ningún módulo específico").

**Antes de tocar la VM:** este plan solo modifica el frontend. Desplegar con
`sigaft-deploy-vm` (recordar: el frontend real corre en Netlify vía
`git push origin main`, no en la VM — la VM solo sirve backend). Antes de
subir, descargar la versión viva de cada archivo tocado desde
`~/facturation-system` en la VM y diffear contra el baseline pre-edición
(mismo procedimiento que en el plan anterior) para no pisar trabajo que
solo viva ahí.

---

### Task 1: Tipos — `SidebarModule` y `HomeShortcut`

**Files:**
- Modify: `frontend/src/components/layout/types.ts`

- [ ] **Step 1: Agregar los dos tipos nuevos y actualizar `SidebarData`**

Reemplazar el archivo completo por:

```ts
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
```

- [ ] **Step 2: Verificar tipos (fallará hasta Task 2 — es esperado)**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "sidebar-data|app-sidebar|nav-group"`
Expected: errores en `sidebar-data.ts` (todavía usa `navGroups` plano) y
`app-sidebar.tsx` — se resuelven en las tareas 2 y 3. No hacer commit de
este paso solo; se commitea junto con Task 2.

---

### Task 2: Reestructurar `sidebar-data.ts` en módulos

**Files:**
- Modify: `frontend/src/components/layout/data/sidebar-data.ts`

- [ ] **Step 1: Reemplazar el archivo completo**

```ts
import {
  AlertTriangle,
  Archive,
  Banknote,
  BookOpen,
  Building2,
  Calculator,
  Coins,
  Command,
  CreditCard,
  FileSearch,
  History,
  LifeBuoy,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Users as UsersIcon,
  Wallet,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'jcabreu',
    email: 'jcabreu@abregonza.local',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'ZentoryERP',
      logo: Command,
      plan: 'ZentoryERP',
    },
  ],
  homeShortcuts: [
    { title: 'Reportes de Problemas', url: '/reportes', icon: LifeBuoy },
    { title: 'Alertas NCF', url: '/ncf-alerts', icon: AlertTriangle },
    { title: 'Empresas', url: '/empresas', icon: Building2 },
    { title: 'Permisos', url: '/sistema/usuarios', icon: ShieldCheck },
    { title: 'Historial', url: '/sistema/historial', icon: History },
    { title: 'Manuales', url: '/man', icon: BookOpen },
    { title: 'Configuracion', url: '/settings', icon: Settings },
  ],
  modules: [
    {
      code: 'fat',
      title: 'Facturacion',
      icon: Receipt,
      navGroups: [
        {
          title: 'Proceso',
          items: [
            { title: 'Facturacion', url: '/fat/nueva-factura' },
            { title: 'Cotizacion / Conduce', url: '/fat/nuevo-conduce' },
            { title: 'Anular Factura', url: '/fat/anular-factura' },
            { title: 'Cuadre de Caja', url: '/fat/cuadre-caja' },
            { title: 'Vista de Cajero', url: '/fat/cajero' },
          ],
        },
        {
          title: 'Consultas',
          items: [
            { title: 'Consulta de Facturas', url: '/fat/facturas' },
            {
              title: 'Pedidos / Cotizaciones / Conduces',
              url: '/fat/conduces',
            },
          ],
        },
        {
          title: 'Reportes',
          items: [
            { title: 'Ventas por Producto', url: '/fat/rep-ventas' },
            { title: 'Ventas por Cliente', url: '/fat/rep-ventas-cliente' },
            {
              title: 'Ventas por Vendedor',
              url: '/fat/rep-ventas-vendedor',
            },
            { title: 'Analitica de Ventas', url: '/fat/rep-analitica' },
            { title: 'Facturas con RNC', url: '/fat/rep-facturas-rnc' },
            { title: 'Margen bruto', url: '/fat/rep-margen-bruto' },
            { title: 'NCF Form 607', url: '/fat/rep-607' },
            { title: 'NCF Nulos', url: '/fat/rep-ncf-nulos' },
          ],
        },
        {
          title: 'Cierres',
          items: [
            { title: 'Imprimir Asiento Contable', url: '/fat/asiento-contable' },
            { title: 'Generar Asiento al Mayor', url: '/fat/generar-asientos' },
            { title: 'Cierre Mensual', url: '/fat/cierre-mensual' },
          ],
        },
      ],
    },
    {
      code: 'cxc',
      title: 'Cuentas por Cobrar',
      icon: CreditCard,
      navGroups: [
        {
          title: 'Clientes',
          items: [
            { title: 'Clientes', url: '/cxc/clientes' },
            {
              title: 'Asignacion Cliente a Ruta',
              url: '/cxc/cliente-ruta',
            },
          ],
        },
        {
          title: 'Documentos',
          items: [
            {
              title: 'Entrada de Transacciones',
              url: '/cxc/transacciones',
            },
            {
              title: 'Consulta / Impresion de Documentos',
              url: '/cxc/documentos',
            },
          ],
        },
        {
          title: 'Procesos',
          items: [
            { title: 'Reversar Documento', url: '/cxc/reversar' },
            { title: 'Pagos Masivos', url: '/cxc/pagos-masivos' },
            { title: 'Liberar Credito', url: '/cxc/liberar-credito' },
            { title: 'Corregir / Liberar NCF', url: '/cxc/corregir-ncf' },
            { title: 'Aplicar Saldos Menores', url: '/cxc/saldos-menores' },
          ],
        },
        {
          title: 'Consultas',
          items: [
            { title: 'Estado de Cuenta', url: '/cxc/estado-cuenta' },
            {
              title: 'Balance de Clientes (Envejecimiento)',
              url: '/cxc/balance',
            },
            { title: 'Historico de Pagos', url: '/cxc/historico' },
            { title: 'Libro de Ventas', url: '/cxc/libro-ventas' },
          ],
        },
        {
          title: 'Reportes',
          items: [
            {
              title: 'Envejecimiento de Cartera',
              url: '/cxc/rep-envejecimiento',
            },
            {
              title: 'Cobros por Vendedor',
              url: '/cxc/rep-cobros-vendedor',
            },
            {
              title: 'Comisiones por Vendedor',
              url: '/cxc/rep-comisiones',
            },
            { title: 'NCF Emitidos por Periodo', url: '/cxc/rep-ncf' },
          ],
        },
        {
          title: 'Cierre',
          items: [
            {
              title: 'Imprimir Asiento Contable',
              url: '/cxc/asiento-contable',
            },
            {
              title: 'Generar Asiento al Mayor',
              url: '/cxc/generar-asiento',
            },
            { title: 'Cierre de CxC', url: '/cxc/cierre' },
          ],
        },
      ],
    },
    {
      code: 'cxp',
      title: 'Cuentas por Pagar',
      icon: Wallet,
      navGroups: [
        {
          title: 'Proveedores',
          items: [{ title: 'Proveedores', url: '/cxp/proveedores' }],
        },
        {
          title: 'Documentos',
          items: [
            {
              title: 'Entrada de Documentos DR/CR',
              url: '/cxp/entrada-documentos',
            },
            {
              title: 'Consulta / Impresion de Documentos',
              url: '/cxp/documentos',
            },
            { title: 'Cuentas por Pagar', url: '/cxp/cuentas' },
            { title: 'Movimientos de Proveedor', url: '/cxp/movimientos' },
          ],
        },
        {
          title: 'Procesos',
          items: [
            { title: 'Reversar Documento', url: '/cxp/reversar' },
            { title: 'Liberar Debito', url: '/cxp/liberar-debito' },
            { title: 'Aplicación de Movimientos', url: '/cxp/aplicar-movimientos' },
            { title: 'Corregir NCF', url: '/cxp/corregir-ncf' },
            { title: 'Aplicar Saldos Menores', url: '/cxp/saldos-menores' },
            {
              title: 'Bloquear / Desbloquear Pago',
              url: '/cxp/bloquear-pago',
            },
            {
              title: 'Generar Solicitud a Cheque',
              url: '/cxp/generar-solicitud',
            },
            {
              title: 'Solicitudes de Pago',
              url: '/cxp/solicitudes-pago',
            },
          ],
        },
        {
          title: 'Consultas',
          items: [
            { title: 'Estado de Cuenta', url: '/cxp/estado-cuenta' },
            { title: 'Antiguedad de Saldos', url: '/cxp/envejecimiento' },
            {
              title: 'Movimientos de Proveedores',
              url: '/cxp/rep-movimientos',
            },
          ],
        },
        {
          title: 'Reportes',
          items: [
            {
              title: 'Alfabetico de Proveedores',
              url: '/cxp/rep-alfabetico',
            },
            { title: 'Mayor Auxiliar CxP', url: '/cxp/rep-mayor' },
            { title: 'ITBIS Compras Locales 606', url: '/cxp/rep-606' },
            { title: 'Retenciones Proveedores 607', url: '/cxp/rep-607' },
            { title: 'Cuadre Contable', url: '/cxp/rep-cuadre' },
            { title: 'Certificado Retencion', url: '/cxp/rep-retenciones' },
          ],
        },
        {
          title: 'Cierre',
          items: [
            {
              title: 'Imprimir Asiento Contable',
              url: '/cxp/asiento-contable',
            },
            {
              title: 'Generar Asiento a Contabilidad',
              url: '/cxp/generar-asiento',
            },
            { title: 'Cierre Mensual', url: '/cxp/cierre' },
          ],
        },
      ],
    },
    {
      code: 'odc',
      title: 'Ordenes de Compra',
      icon: ShoppingCart,
      navGroups: [
        {
          title: 'Procesos',
          items: [
            { title: 'Entrada de Orden', url: '/odc/nueva-orden' },
            {
              title: 'Entrada de Requisicion',
              url: '/odc/nueva-requisicion',
            },
            { title: 'Autorizar Ordenes', url: '/odc/autorizar' },
            { title: 'Recibir Mercancia', url: '/odc/recibir' },
            { title: 'Anular Orden / Requisicion', url: '/odc/anular' },
          ],
        },
        {
          title: 'Consultas',
          items: [
            { title: 'Consulta de Ordenes', url: '/odc/ordenes' },
            {
              title: 'Consulta de Requisiciones',
              url: '/odc/requisiciones',
            },
          ],
        },
        {
          title: 'Reportes',
          items: [
            { title: 'Movimientos Pendientes', url: '/odc/rep-pendientes' },
            { title: 'Resumen de Ordenes', url: '/odc/rep-resumen' },
            { title: 'Requisicion Detalle', url: '/odc/rep-requisiciones' },
          ],
        },
      ],
    },
    {
      code: 'lic',
      title: 'Licitaciones',
      icon: FileSearch,
      navGroups: [
        {
          title: 'Configuración',
          items: [
            { title: 'Empresas y Rubros RPE', url: '/lic/config' },
            { title: 'Documentos de la empresa', url: '/lic/config/documentos' },
            { title: 'Tipos de documento', url: '/lic/config/tipos-documento' },
          ],
        },
        {
          title: 'Consultas',
          items: [{ title: 'Oportunidades', url: '/lic/oportunidades' }],
        },
      ],
    },
    {
      code: 'inv',
      title: 'Inventario',
      icon: Package,
      navGroups: [
        {
          title: 'Configuración',
          items: [
            {
              title: 'Catálogo de Productos',
              url: '/inv',
              search: { section: 'configuracion', view: 'productos' },
            },
          ],
        },
        {
          title: 'Procesos',
          items: [
            {
              title: 'Entrada de Compras',
              url: '/inv',
              search: { section: 'procesos', view: 'entrada-compras' },
            },
            {
              title: 'Entrada Mercancía Almacén',
              url: '/inv',
              search: { section: 'procesos', view: 'entrada-mercancia' },
            },
            {
              title: 'Salida de Mercancía',
              url: '/inv',
              search: { section: 'procesos', view: 'salida-mercancia' },
            },
            {
              title: 'Transferencia de Mercancía',
              url: '/inv',
              search: {
                section: 'procesos',
                view: 'transferencia-mercancia',
              },
            },
            {
              title: 'Devolución a Suplidores',
              url: '/inv',
              search: {
                section: 'procesos',
                view: 'devolucion-suplidores',
              },
            },
            {
              title: 'Devolución de Ventas',
              url: '/inv',
              search: { section: 'procesos', view: 'devolucion-ventas' },
            },
            {
              title: 'Reversar Documento',
              url: '/inv',
              search: { section: 'procesos', view: 'reversar-documento' },
            },
            {
              title: 'Impresión de Documentos',
              url: '/inv',
              search: { section: 'procesos', view: 'impresion-documentos' },
            },
          ],
        },
        {
          title: 'Consultas',
          items: [
            {
              title: 'Consulta de Documentos',
              url: '/inv',
              search: { section: 'consultas', view: 'consulta-documentos' },
            },
            {
              title: 'Existencia de Producto',
              url: '/inv',
              search: { section: 'consultas', view: 'existencia-producto' },
            },
            {
              title: 'Existencia en Grupo',
              url: '/inv',
              search: { section: 'consultas', view: 'existencia-grupo' },
            },
          ],
        },
        {
          title: 'Reportes',
          items: [
            {
              title: 'Existencia',
              url: '/inv',
              search: { section: 'reportes', view: 'reporte-existencia' },
            },
            {
              title: 'Movimientos',
              url: '/inv',
              search: { section: 'reportes', view: 'reporte-movimientos' },
            },
            {
              title: 'Líneas y Sublíneas',
              url: '/inv',
              search: { section: 'reportes', view: 'lineas-sublineas' },
            },
          ],
        },
        {
          title: 'Conteo Físico',
          items: [
            {
              title: 'Reportes CF',
              url: '/inv',
              search: { section: 'conteo-fisico', view: 'reportes-cf' },
            },
            {
              title: 'Cargar CF desde Excel',
              url: '/inv',
              search: { section: 'conteo-fisico', view: 'cargar-cf-excel' },
            },
            {
              title: 'Entrada CF Manual',
              url: '/inv',
              search: {
                section: 'conteo-fisico',
                view: 'entrada-cf-manual',
              },
            },
            {
              title: 'Comparativo Físico vs Teórico',
              url: '/inv',
              search: {
                section: 'conteo-fisico',
                view: 'comparativo-fisico',
              },
            },
            {
              title: 'Ajuste de Inventario por CF',
              url: '/inv',
              search: {
                section: 'conteo-fisico',
                view: 'ajuste-inventario-cf',
              },
            },
          ],
        },
        {
          title: 'Cierre',
          items: [
            {
              title: 'Entrada de Diario',
              url: '/inv',
              search: { section: 'cierre', view: 'entrada-diario' },
            },
            {
              title: 'Generar Asiento a Contabilidad',
              url: '/inv',
              search: { section: 'cierre', view: 'generar-asiento' },
            },
            {
              title: 'Cierre Mensual',
              url: '/inv',
              search: { section: 'cierre', view: 'cierre-mensual' },
            },
          ],
        },
      ],
    },
    {
      code: 'chc',
      title: 'Bancos / Cheques',
      icon: Banknote,
      navGroups: [
        {
          title: 'Procesos',
          items: [
            { title: 'Solicitar Cheque', url: '/chc/solicitar' },
            { title: 'Imprimir Cheques', url: '/chc/imprimir' },
            { title: 'Entregar Cheques', url: '/chc/entregar' },
            { title: 'Conciliacion Bancaria', url: '/chc/conciliar' },
            { title: 'Anular Cheque', url: '/chc/anular' },
          ],
        },
        {
          title: 'Consultas',
          items: [
            { title: 'Cheques / Movimientos', url: '/chc/cheques' },
            { title: 'Saldos y Disponibilidad', url: '/chc/saldos' },
          ],
        },
        {
          title: 'Reportes',
          items: [
            { title: 'Movimiento de Cuenta', url: '/chc/rep-movimientos' },
            { title: 'Balance de Cuentas', url: '/chc/rep-balance' },
            { title: 'Libro Diario Cheques', url: '/chc/rep-diario' },
            {
              title: 'Disponibilidad Bancaria',
              url: '/chc/rep-disponibilidad',
            },
          ],
        },
        {
          title: 'Cierre',
          items: [{ title: 'Cierre Conciliacion', url: '/chc/cierres' }],
        },
      ],
    },
    {
      code: 'acc',
      title: 'Caja Chica',
      icon: Coins,
      navGroups: [
        {
          title: 'Procesos',
          items: [
            { title: 'Entrada de Egreso', url: '/acc/nuevo-egreso' },
            { title: 'Reposicion de Caja', url: '/acc/reposicion' },
            { title: 'Anular Documento', url: '/acc/anular' },
          ],
        },
        {
          title: 'Consultas',
          items: [
            { title: 'Documentos / Egresos', url: '/acc/documentos' },
            { title: 'Reposiciones', url: '/acc/reposiciones' },
          ],
        },
        {
          title: 'Reportes',
          items: [
            { title: 'Resumen / Gastos por Tipo', url: '/acc/reportes' },
          ],
        },
        {
          title: 'Cierre',
          items: [
            { title: 'Asiento Contable', url: '/acc/asiento' },
            { title: 'Cierre Mensual', url: '/acc/cierre' },
          ],
        },
      ],
    },
    {
      code: 'sdn',
      title: 'Nomina',
      icon: UsersIcon,
      navGroups: [
        {
          title: 'Mantenimiento',
          items: [{ title: 'Empleados', url: '/sdn/empleados' }],
        },
        {
          title: 'Procesos',
          items: [
            { title: 'Movimientos Manuales', url: '/sdn/movimientos' },
            { title: 'Deduccion Masiva (AFP/ARS/ISR)', url: '/sdn/deduccion-masiva' },
            { title: 'Calcular Nomina', url: '/sdn/calcular' },
            { title: 'Generar Vacaciones', url: '/sdn/gen-vacaciones' },
            { title: 'Generar Solicitud Cheques', url: '/sdn/gen-cheques' },
          ],
        },
        {
          title: 'Consultas',
          items: [
            { title: 'Volante / Pre-Nomina', url: '/sdn/volante' },
            { title: 'Nominas Procesadas', url: '/sdn/nominas' },
            { title: 'Vacaciones', url: '/sdn/vacaciones' },
          ],
        },
        {
          title: 'Reportes',
          items: [
            { title: 'Informe de Nomina', url: '/sdn/rep-informe' },
            { title: 'RNC Empleados', url: '/sdn/rep-rnc' },
            { title: 'Catalogo de Conceptos', url: '/sdn/catalogos' },
          ],
        },
      ],
    },
    {
      code: 'acf',
      title: 'Activos Fijos',
      icon: Archive,
      navGroups: [
        {
          title: 'Mantenimiento',
          items: [{ title: 'Activos Fijos', url: '/acf/activos' }],
        },
        {
          title: 'Procesos',
          items: [
            { title: 'Compra de Activo', url: '/acf/compra' },
            { title: 'Retiro de Activo', url: '/acf/retiro' },
            { title: 'Depreciacion', url: '/acf/depreciacion' },
          ],
        },
        {
          title: 'Reportes',
          items: [{ title: 'Resumen / Por grupo', url: '/acf/reportes' }],
        },
        {
          title: 'Cierre',
          items: [{ title: 'Cierre Mensual', url: '/acf/cierre' }],
        },
      ],
    },
    {
      code: 'cnt',
      title: 'Contabilidad',
      icon: Calculator,
      navGroups: [
        {
          title: 'Procesos',
          items: [
            {
              title: 'Entrada de diario',
              url: '/cnt',
              search: { section: 'procesos', view: 'asientos' },
            },
            {
              title: 'Verificacion de asientos',
              url: '/cnt',
              search: { section: 'procesos', view: 'verificacion' },
            },
            {
              title: 'Autorizar asientos',
              url: '/cnt',
              search: { section: 'procesos', view: 'autorizar' },
            },
            {
              title: 'Procesos meses anteriores',
              url: '/cnt',
              search: { section: 'procesos', view: 'autorizar-anterior' },
            },
            {
              title: 'Presupuesto',
              url: '/cnt',
              search: { section: 'procesos', view: 'presupuesto' },
            },
          ],
        },
        {
          title: 'Consultas',
          items: [
            {
              title: 'Consulta de asientos',
              url: '/cnt',
              search: { section: 'consultas', view: 'consulta-asientos' },
            },
            {
              title: 'Movimientos de cuentas',
              url: '/cnt',
              search: { section: 'consultas', view: 'movimientos' },
            },
          ],
        },
        {
          title: 'Reportes',
          items: [
            {
              title: 'Balance de comprobacion',
              url: '/cnt',
              search: { section: 'reportes', view: 'balance' },
            },
            {
              title: 'Mayor general',
              url: '/cnt',
              search: { section: 'reportes', view: 'mayor' },
            },
            {
              title: 'Estados financieros',
              url: '/cnt',
              search: { section: 'reportes', view: 'estados' },
            },
          ],
        },
        {
          title: 'Cierres',
          items: [
            {
              title: 'Cierres contables',
              url: '/cnt',
              search: { section: 'cierres', view: 'cierres' },
            },
            {
              title: 'Cierre mensual',
              url: '/cnt',
              search: { section: 'cierres', view: 'cierre-mensual' },
            },
          ],
        },
      ],
    },
  ],
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep sidebar-data`
Expected: sin salida.

- [ ] **Step 3: Commit (junto con Task 1)**

```bash
git add frontend/src/components/layout/types.ts frontend/src/components/layout/data/sidebar-data.ts
git commit -m "feat(nav): reestructurar sidebar-data en modules[] + homeShortcuts[]"
```

---

### Task 3: Reescribir `AppSidebar` con los dos estados

**Files:**
- Modify: `frontend/src/components/layout/app-sidebar.tsx`

- [ ] **Step 1: Reemplazar el archivo completo**

```tsx
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
```

- [ ] **Step 2: Verificar tipos**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep app-sidebar`
Expected: sin salida.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/app-sidebar.tsx
git commit -m "feat(nav): AppSidebar con dos estados (Inicio vacio / arbol de modulo activo)"
```

---

### Task 4: `ModuleLauncher` — grid de módulos + shortcuts en Inicio

**Files:**
- Create: `frontend/src/features/dashboard/components/module-launcher.tsx`

- [ ] **Step 1: Escribir el componente completo**

```tsx
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
```

- [ ] **Step 2: Verificar tipos**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep module-launcher`
Expected: sin salida.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/dashboard/components/module-launcher.tsx
git commit -m "feat(nav): componente ModuleLauncher (grid de modulos + shortcuts)"
```

---

### Task 5: Insertar `ModuleLauncher` en el Dashboard

**Files:**
- Modify: `frontend/src/features/dashboard/index.tsx`

- [ ] **Step 1: Importar el componente**

Ubicar el bloque de imports de features (junto a `HistorialTimeline`):

```tsx
import { HistorialTimeline } from '@/features/historial/historial-timeline'
```

Agregar debajo:

```tsx
import { ModuleLauncher } from './components/module-launcher'
```

- [ ] **Step 2: Renderizar el grid como primera seccion**

El `return` del componente `Dashboard` arma varias secciones dentro de
`<Main>` (KPIs, alertas, actividad). Ubicar la primera apertura de sección
después de `<Main>` — el patrón existente en este archivo es una serie de
`<div className='space-y-...'>` o similar directamente dentro de `<Main>`.
Insertar `<ModuleLauncher />` como el primer hijo de `<Main>`, antes de
cualquier otra sección, envuelto en el mismo espaciado vertical que ya usa
el resto del layout (`className='mb-6'` si las secciones siguientes usan
margen, o dejarlo como hermano directo si usan `space-y-*` en un contenedor
padre — replicar el patrón de espaciado que ya exista inmediatamente
después de la apertura de `<Main>` en este archivo).

Ejemplo de resultado esperado (ajustar el wrapper exacto al que ya use el
archivo):

```tsx
      <Main>
        <ModuleLauncher />
        {/* ...secciones existentes de KPIs, alertas, actividad sin cambios... */}
```

- [ ] **Step 3: Verificar tipos**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "features/dashboard"`
Expected: sin salida.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/dashboard/index.tsx
git commit -m "feat(nav): mostrar ModuleLauncher al inicio del Dashboard"
```

---

### Task 6: Desplegar y smoke test

**Files:** ninguno nuevo — solo despliegue y verificación.

- [ ] **Step 1: Descargar versiones vivas de la VM y diffear**

Antes de subir, bajar de la VM (`~/facturation-system`) los 3 archivos
modificados (`types.ts`, `sidebar-data.ts`, `app-sidebar.tsx`) y el
`dashboard/index.tsx`, diffear contra el baseline pre-edición de cada uno
(mismo procedimiento que en el plan `2026-08-01-crear-producto-rapido.md`,
Task 5 Step 1) para confirmar que no hay trabajo solo-en-VM que se pise.

- [ ] **Step 2: Push a `origin/main`**

El frontend real se sirve desde Netlify (`git push origin main`
dispara el build), no desde la VM — confirmar con el usuario antes de
pushear igual que en la entrega anterior.

```bash
git push origin main
```

- [ ] **Step 3: Smoke visual en producción (Netlify)**

Una vez que el build termine (verificar con el mismo enfoque de polling
del bundle, sabiendo que como el sidebar/dashboard SÍ están en el chunk
raíz —no son lazy por ruta—, buscar el marker `ZentoryERP` o
`module-launcher` debería aparecer en `index-*.js` sin necesidad de
navegar a una ruta de módulo primero):

1. Login y confirmar que `/` muestra el grid de módulos (uno por módulo
   con permiso) + la fila de shortcuts, y el sidebar solo trae
   `TeamSwitcher` (sin árbol).
2. Click en el tile de Facturación → confirma que aterriza en
   `/fat/nueva-factura` (o la primera URL del árbol) y que el sidebar
   ahora muestra "← ZentoryERP" arriba + solo las secciones de
   Facturación (Proceso/Consultas/Reportes/Cierres) — ningún otro módulo
   visible.
3. Click en "← ZentoryERP" → vuelve a `/` y el sidebar vuelve a mostrar
   solo `TeamSwitcher`.
4. Repetir el punto 2 con otro módulo (ej. Órdenes de Compra) para
   confirmar que el árbol cambia correctamente y no arrastra items del
   módulo anterior.
5. Si el usuario de prueba no es admin, confirmar que el grid de Inicio
   solo muestra los módulos permitidos por `hasModule` (mismo comportamiento
   que hoy tiene el sidebar).
6. Confirmar que Licitaciones ahora sí respeta `hasModule('lic')` — con un
   usuario sin ese permiso, el tile no debe aparecer (antes sí aparecía
   siempre, por el gap de `MODULE_PREFIXES` que este plan corrige).

---

## Auto-revisión del plan

- **Cobertura del spec:** §2 (modelo de datos) → Task 1-2. §3 (deteccion de
  modulo) → Task 3 (`currentModuleCode`). §4 (dos estados del sidebar) →
  Task 3. §5 (pantalla de Inicio) → Task 4-5. El gap de `lic` en
  `MODULE_PREFIXES` (§2) se resuelve al construir `modules[]` como fuente
  unica de verdad — ya no existe una lista `MODULE_PREFIXES` separada que
  pueda desincronizarse.
- **Fix de spec:** homeShortcuts pasa de 6 a 7 items (se agrega "Reportes
  de Problemas", que el spec omitio) — documentado en la nota de spec al
  inicio de este plan.
- **Consistencia de tipos:** `SidebarModule`/`HomeShortcut` (Task 1) son
  consumidos identicos en `sidebar-data.ts` (Task 2), `app-sidebar.tsx`
  (Task 3, via `sidebarData.modules`/`.find`) y `module-launcher.tsx`
  (Task 4, via `sidebarData.modules`/`sidebarData.homeShortcuts`). El tipo
  `NavGroup`/`NavItem` no cambia de forma — solo de ubicacion dentro del
  objeto raiz.
- **Sin placeholders:** todos los steps de codigo tienen el snippet
  completo. Task 5 Step 2 es la unica instruccion no-literal porque
  depende de un wrapper JSX existente que no se cito completo en el spec —
  se deja explicito que hay que replicar el patron de espaciado ya presente
  en el archivo, no inventar uno nuevo.
