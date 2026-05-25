import {
  AlertTriangle,
  Banknote,
  BookOpen,
  Building2,
  Calculator,
  Coins,
  Command,
  CreditCard,
  LayoutDashboard,
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
      name: 'Regal General Clon',
      logo: Command,
      plan: 'AbreGonza Â· Multi-empresa',
    },
  ],
  navGroups: [
    {
      title: 'General',
      items: [
        {
          title: 'Dashboard',
          url: '/',
          icon: LayoutDashboard,
        },
        {
          title: 'Alertas NCF',
          url: '/ncf-alerts',
          icon: AlertTriangle,
        },
        {
          title: 'Empresas',
          url: '/empresas',
          icon: Building2,
        },
      ],
    },
    {
      title: 'Operacion',
      items: [
        {
          title: 'Facturacion (FAT)',
          icon: Receipt,
          items: [
            { title: 'Configuracion', url: '/fat', search: { section: 'configuracion' } },
            { title: 'Operacion', url: '/fat', search: { section: 'operacion' } },
            { title: 'Consultas', url: '/fat', search: { section: 'consultas' } },
            { title: 'Reportes', url: '/fat', search: { section: 'reportes' } },
            { title: 'Administracion', url: '/fat', search: { section: 'administracion' } },
          ],
        },
        {
          title: 'Cuentas por Cobrar',
          url: '/cxc',
          icon: CreditCard,
        },
        {
          title: 'Cuentas por Pagar',
          url: '/cxp',
          icon: Wallet,
        },
        {
          title: 'Inventario (INV)',
          icon: Package,
          items: [
            { title: 'Configuración', url: '/inv', search: { section: 'configuracion' } },
            { title: 'Procesos', url: '/inv', search: { section: 'procesos' } },
            { title: 'Consultas', url: '/inv', search: { section: 'consultas' } },
            { title: 'Reportes', url: '/inv', search: { section: 'reportes' } },
            { title: 'Conteo Físico', url: '/inv', search: { section: 'conteo-fisico' } },
            { title: 'Cierre', url: '/inv', search: { section: 'cierre' } },
          ],
        },
        {
          title: 'Ordenes de Compra',
          url: '/odc',
          icon: ShoppingCart,
        },
        {
          title: 'Bancos / Cheques',
          url: '/chc',
          icon: Banknote,
        },
        {
          title: 'Caja Chica',
          url: '/acc',
          icon: Coins,
        },
      ],
    },
    {
      title: 'Administracion',
      items: [
        {
          title: 'Contabilidad',
          icon: Calculator,
          items: [
            { title: 'Configuracion', url: '/cnt', search: { section: 'configuracion' } },
            { title: 'Procesos', url: '/cnt', search: { section: 'procesos' } },
            { title: 'Consultas', url: '/cnt', search: { section: 'consultas' } },
            { title: 'Reportes', url: '/cnt', search: { section: 'reportes' } },
            { title: 'Cierres', url: '/cnt', search: { section: 'cierres' } },
          ],
        },
        {
          title: 'Nomina',
          url: '/sdn',
          icon: UsersIcon,
        },
      ],
    },
    {
      title: 'Sistema',
      items: [
        {
          title: 'Permisos',
          icon: ShieldCheck,
          items: [
            { title: 'Usuarios', url: '/sistema/usuarios' },
            { title: 'Matriz de accesos', url: '/sistema/permisos' },
          ],
        },
        {
          title: 'Documentacion',
          url: '/docs',
          icon: BookOpen,
        },
        {
          title: 'Configuracion',
          url: '/settings',
          icon: Settings,
        },
      ],
    },
  ],
}

