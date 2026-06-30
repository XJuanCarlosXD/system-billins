import type { ReactNode } from 'react'
import {
  Banknote,
  BookOpen,
  Building2,
  Calculator,
  Coins,
  CreditCard,
  FileText,
  Layers,
  Package,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  UserCog,
  Users as UsersIcon,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useCompany } from '@/context/company-context'
import { AccBeneficiarios } from '@/features/acc/acc-beneficiarios'
// ACC
import { AccCajas } from '@/features/acc/acc-cajas'
import { AccTiposBene } from '@/features/acc/acc-tipos-bene'
import { AccTiposGasto } from '@/features/acc/acc-tipos-gasto'
// ACF
import {
  AcfCategorias,
  AcfGrupos,
  AcfSubgrupos,
  AcfMarcas,
  AcfResponsables,
  AcfDepartamentos,
} from '@/features/acf/acf-simple-tables'
// CHC
import { ChcBancos } from '@/features/chc/chc-bancos'
import { ChcCuentas } from '@/features/chc/chc-cuentas'
import { ChcTiposDocu } from '@/features/chc/chc-tipos-docu'
import { CatalogoCuentas } from '@/features/cnt/catalogo'
import { CatalogoSucursal } from '@/features/cnt/catalogo-sucursal'
import { CentrosCosto } from '@/features/cnt/centros-costo'
import { GruposSucursal } from '@/features/cnt/grupos-sucursal'
import { NcfContabilidad } from '@/features/cnt/ncf'
import { PeriodosFiscales } from '@/features/cnt/periodos'
// CNT
import { TiposCuenta } from '@/features/cnt/tipos-cuenta'
// CxC catálogos
import {
  CxcTdocu,
  CxcTcli,
  CxcSupervisores,
  CxcRutas,
  CxcTcontable,
  CxcCiudades,
  CxcBarrios,
  CxcZonas,
  CxcCadenas,
} from '@/features/cxc/cxc-catalogos'
import { CxcVendedores } from '@/features/cxc/cxc-vendedores'
// CxP catálogos
import {
  CxpTproveedores,
  CxpTdocu,
  CxpCiudades,
  CxpBarrios,
} from '@/features/cxp/cxp-catalogos'
// Master
import { EmpresasPage } from '@/features/empresas'
import { CondicionesPago } from '@/features/fat/condiciones-pago'
import { ListasPrecioFat } from '@/features/fat/listas-precio'
import { NotasFat } from '@/features/fat/fat-notas'
import { TiposPagoFat } from '@/features/fat/fat-tipos-pago'
import { TransportistasFat } from '@/features/fat/fat-transportistas'
// FAT catálogos
import { TiposDocumentoFat } from '@/features/fat/tdocu'
// INV catálogos
import { Almacenes } from '@/features/inv/almacenes'
import { CatalogoProductos } from '@/features/inv/catalogo-productos'
import { EstantesTramos } from '@/features/inv/estantes-tramos'
import { GrupoContable } from '@/features/inv/grupo-contable'
import { GruposProductos } from '@/features/inv/grupos'
import { LineasProductos } from '@/features/inv/lineas'
import { MinimosMaximos } from '@/features/inv/minimos-maximos'
import { ModificarCosto } from '@/features/inv/modificar-costo'
// ODC
import { OdcUsuarios } from '@/features/odc/odc-usuarios'
// SDN
import {
  SdnAfp,
  SdnArs,
  SdnGerencias,
  SdnAreas,
  SdnDeptos,
  SdnIngresos,
  SdnDeducciones,
} from '@/features/sdn/sdn-simple-tables'
// General / inline
import { AccountForm } from '../account/account-form'
import { AppearanceForm } from '../appearance/appearance-form'
import { DisplayForm } from '../display/display-form'
import { NotificationsForm } from '../notifications/notifications-form'
import { PdfTemplatesEditor } from '../pdf-templates'
import { ProfileForm } from '../profile/profile-form'
// Unified
import { UnifiedCompanias } from '../unified/unified-companias'
import { UnifiedPuntos } from '../unified/unified-puntos'

// Wrappers that read company context and pass props ---------------------------------

const withCompany = (Cmp: React.ComponentType<any>) => () => {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto = selectedPoint ?? ''
  return <Cmp noCia={noCia} punto={punto} />
}

const today = new Date()
const withCompanyMesAno = (Cmp: React.ComponentType<any>) => () => {
  const { selectedCompany, selectedPoint } = useCompany()
  return (
    <Cmp
      noCia={selectedCompany ?? ''}
      punto={selectedPoint ?? ''}
      mes={today.getMonth() + 1}
      ano={today.getFullYear()}
    />
  )
}

// Catalog types ----------------------------------------------------------------------

export type SettingsItem = {
  slug: string
  title: string
  description?: string
  keywords?: string[]
  render: () => ReactNode
}

export type SettingsGroup = {
  title: string
  items: SettingsItem[]
}

export type SettingsCategory = {
  id: string
  title: string
  description: string
  icon: LucideIcon
  groups: SettingsGroup[]
}

// Catalog -----------------------------------------------------------------------------

export const settingsCatalog: SettingsCategory[] = [
  {
    id: 'general',
    title: 'General',
    description: 'Preferencias del usuario actual.',
    icon: UserCog,
    groups: [
      {
        title: 'Cuenta del usuario',
        items: [
          {
            slug: 'profile',
            title: 'Perfil',
            description: 'Nombre visible, biografía y enlaces.',
            render: () => <ProfileForm />,
          },
        ],
      },
    ],
  },
  {
    id: 'empresas',
    title: 'Empresas y Sucursales',
    description:
      'Configuración compartida por todos los módulos. Al guardar, las pestañas vecinas se refrescan automáticamente.',
    icon: Building2,
    groups: [
      {
        title: 'Maestros',
        items: [
          {
            slug: 'empresas',
            title: 'Empresas (maestro)',
            description:
              'TCNT_CIAS: registro central que comparten todos los módulos.',
            render: () => <EmpresasPage />,
          },
        ],
      },
      {
        title: 'Vistas unificadas',
        items: [
          {
            slug: 'companias',
            title: 'Compañías (todas)',
            description:
              'Edita en pestañas la configuración de Compañías por módulo (FAT, CxC, CxP, ODC, INV, CHC, ACC, SDN, ACF, CNT). Al guardar en una, las otras se invalidan.',
            keywords: [
              'compania',
              'cias',
              'tcnt_cias',
              'tfat_cias',
              'tcxc_cias',
              'tcxp_cias',
            ],
            render: () => <UnifiedCompanias />,
          },
          {
            slug: 'sucursales',
            title: 'Sucursales / Puntos (todos)',
            description:
              'Configuración de Sucursales / Puntos de trabajo en pestañas por módulo.',
            keywords: ['sucursal', 'puntos', 'punto', 'pdv'],
            render: () => <UnifiedPuntos />,
          },
        ],
      },
    ],
  },
  {
    id: 'fat',
    title: 'Facturación',
    description:
      'Documentos, NCF, precios y catálogos comerciales del módulo FAT.',
    icon: Receipt,
    groups: [
      {
        title: 'Documentos y NCF',
        items: [
          {
            slug: 'fat-tdocu',
            title: 'Tipos de Documento',
            description: 'FT, FC, CO, CT y sus rangos NCF.',
            render: withCompany(TiposDocumentoFat),
          },
          {
            slug: 'fat-notas',
            title: 'Notas Pie de Factura',
            description: 'Mensajes legales y términos al pie del PDF.',
            render: () => <NotasFat />,
          },
        ],
      },
      {
        title: 'Comercial',
        items: [
          {
            slug: 'fat-listas-precio',
            title: 'Listas de Precio',
            render: withCompany(ListasPrecioFat),
          },
          {
            slug: 'fat-transportistas',
            title: 'Transportistas',
            render: () => <TransportistasFat />,
          },
          {
            slug: 'fat-condiciones',
            title: 'Condiciones de Pago',
            render: withCompany(CondicionesPago),
          },
          {
            slug: 'fat-tipos-pago',
            title: 'Tipos de Pago en Caja',
            render: withCompany(TiposPagoFat),
          },
        ],
      },
    ],
  },
  {
    id: 'cxc',
    title: 'Cuentas por Cobrar',
    description:
      'Vendedores, supervisores, rutas, zonas y catálogos comerciales.',
    icon: CreditCard,
    groups: [
      {
        title: 'Documentos',
        items: [
          {
            slug: 'cxc-tdocu',
            title: 'Tipo de Documento',
            render: withCompany(CxcTdocu),
          },
        ],
      },
      {
        title: 'Clientes',
        items: [
          {
            slug: 'cxc-tcli',
            title: 'Tipo de Clientes',
            render: withCompany(CxcTcli),
          },
          {
            slug: 'cxc-tcontable',
            title: 'Tipo Contable de Cliente',
            render: withCompany(CxcTcontable),
          },
          {
            slug: 'cxc-cadenas',
            title: 'Cadenas de Negocios',
            render: withCompany(CxcCadenas),
          },
        ],
      },
      {
        title: 'Fuerza de ventas',
        items: [
          {
            slug: 'cxc-supervisores',
            title: 'Supervisores',
            render: withCompany(CxcSupervisores),
          },
          {
            slug: 'cxc-vendedores',
            title: 'Vendedores',
            render: withCompany(CxcVendedores),
          },
          {
            slug: 'cxc-rutas',
            title: 'Grupo de Ruta',
            render: withCompany(CxcRutas),
          },
        ],
      },
      {
        title: 'Geografía',
        items: [
          {
            slug: 'cxc-ciudades',
            title: 'Ciudades',
            render: withCompany(CxcCiudades),
          },
          {
            slug: 'cxc-barrios',
            title: 'Sectores / Barrios',
            render: withCompany(CxcBarrios),
          },
          { slug: 'cxc-zonas', title: 'Zonas', render: withCompany(CxcZonas) },
        ],
      },
    ],
  },
  {
    id: 'cxp',
    title: 'Cuentas por Pagar',
    description: 'Proveedores, retenciones y documentos CxP.',
    icon: Wallet,
    groups: [
      {
        title: 'Proveedores',
        items: [
          {
            slug: 'cxp-tproveedores',
            title: 'Tipos de Proveedores',
            render: withCompany(CxpTproveedores),
          },
          {
            slug: 'cxp-tdocu',
            title: 'Tipos de Documento',
            render: withCompany(CxpTdocu),
          },
        ],
      },
      {
        title: 'Geografía',
        items: [
          {
            slug: 'cxp-ciudades',
            title: 'Ciudades',
            render: withCompany(CxpCiudades),
          },
          {
            slug: 'cxp-barrios',
            title: 'Sectores / Barrios',
            render: withCompany(CxpBarrios),
          },
        ],
      },
    ],
  },
  {
    id: 'odc',
    title: 'Órdenes de Compra',
    description: 'Permisos y autorizaciones para ODC.',
    icon: ShoppingCart,
    groups: [
      {
        title: 'Seguridad',
        items: [
          {
            slug: 'odc-usuarios',
            title: 'Acceso de Usuarios',
            render: () => <OdcUsuarios />,
          },
        ],
      },
    ],
  },
  {
    id: 'inv',
    title: 'Inventario',
    description: 'Almacenes, productos, líneas y políticas de existencia.',
    icon: Package,
    groups: [
      {
        title: 'Estructura',
        items: [
          {
            slug: 'inv-almacenes',
            title: 'Almacenes',
            render: withCompany(Almacenes),
          },
        ],
      },
      {
        title: 'Productos',
        items: [
          {
            slug: 'inv-grupos',
            title: 'Grupo de Productos',
            render: withCompany(GruposProductos),
          },
          {
            slug: 'inv-lineas',
            title: 'Línea de Productos',
            render: withCompany(LineasProductos),
          },
          {
            slug: 'inv-grupo-contable',
            title: 'Grupo Contable',
            render: () => <GrupoContable />,
          },
          {
            slug: 'inv-productos',
            title: 'Productos',
            render: () => <CatalogoProductos />,
          },
        ],
      },
      {
        title: 'Costos y existencias',
        items: [
          {
            slug: 'inv-modificar-costo',
            title: 'Modificar Costo',
            render: withCompany(ModificarCosto),
          },
          {
            slug: 'inv-minimos-maximos',
            title: 'Mínimo y Máximo',
            render: withCompany(MinimosMaximos),
          },
          {
            slug: 'inv-estantes-tramos',
            title: 'Estantes y Tramos',
            render: withCompany(EstantesTramos),
          },
        ],
      },
    ],
  },
  {
    id: 'chc',
    title: 'Bancos / Cheques',
    description: 'Bancos, cuentas bancarias y tipos de documento.',
    icon: Banknote,
    groups: [
      {
        title: 'Bancos',
        items: [
          {
            slug: 'chc-bancos',
            title: 'Catálogo de Bancos',
            render: () => <ChcBancos />,
          },
          {
            slug: 'chc-cuentas',
            title: 'Cuentas Bancarias',
            render: () => <ChcCuentas />,
          },
          {
            slug: 'chc-tipos-docu',
            title: 'Tipos de Documento',
            render: () => <ChcTiposDocu />,
          },
        ],
      },
    ],
  },
  {
    id: 'acc',
    title: 'Caja Chica',
    description: 'Cajas, beneficiarios y tipos de gasto.',
    icon: Coins,
    groups: [
      {
        title: 'Cajas',
        items: [
          {
            slug: 'acc-cajas',
            title: 'Cajas Chicas',
            render: () => <AccCajas />,
          },
        ],
      },
      {
        title: 'Beneficiarios y gastos',
        items: [
          {
            slug: 'acc-beneficiarios',
            title: 'Beneficiarios',
            render: () => <AccBeneficiarios />,
          },
          {
            slug: 'acc-tipos-bene',
            title: 'Tipos de Beneficiario',
            render: () => <AccTiposBene />,
          },
          {
            slug: 'acc-tipos-gasto',
            title: 'Tipos de Gasto',
            render: () => <AccTiposGasto />,
          },
        ],
      },
    ],
  },
  {
    id: 'sdn',
    title: 'Nómina',
    description: 'Organigrama, conceptos de pago, AFP/ARS.',
    icon: UsersIcon,
    groups: [
      {
        title: 'Organigrama',
        items: [
          {
            slug: 'sdn-gerencias',
            title: 'Gerencias',
            render: () => <SdnGerencias />,
          },
          { slug: 'sdn-areas', title: 'Áreas', render: () => <SdnAreas /> },
          {
            slug: 'sdn-deptos',
            title: 'Departamentos',
            render: () => <SdnDeptos />,
          },
        ],
      },
      {
        title: 'Conceptos',
        items: [
          {
            slug: 'sdn-ingresos',
            title: 'Ingresos',
            render: () => <SdnIngresos />,
          },
          {
            slug: 'sdn-deducciones',
            title: 'Deducciones',
            render: () => <SdnDeducciones />,
          },
        ],
      },
      {
        title: 'Entidades',
        items: [
          { slug: 'sdn-afp', title: 'AFP', render: () => <SdnAfp /> },
          { slug: 'sdn-ars', title: 'ARS', render: () => <SdnArs /> },
        ],
      },
    ],
  },
  {
    id: 'acf',
    title: 'Activos Fijos',
    description: 'Categorización y responsables.',
    icon: Layers,
    groups: [
      {
        title: 'Jerarquía',
        items: [
          {
            slug: 'acf-categorias',
            title: 'Categorías',
            render: () => <AcfCategorias />,
          },
          { slug: 'acf-grupos', title: 'Grupos', render: () => <AcfGrupos /> },
          {
            slug: 'acf-subgrupos',
            title: 'Subgrupos',
            render: () => <AcfSubgrupos />,
          },
          { slug: 'acf-marcas', title: 'Marcas', render: () => <AcfMarcas /> },
        ],
      },
      {
        title: 'Responsables',
        items: [
          {
            slug: 'acf-responsables',
            title: 'Responsables',
            render: () => <AcfResponsables />,
          },
          {
            slug: 'acf-departamentos',
            title: 'Departamentos',
            render: () => <AcfDepartamentos />,
          },
        ],
      },
    ],
  },
  {
    id: 'cnt',
    title: 'Contabilidad',
    description: 'Plan de cuentas, centros de costo, NCF y períodos.',
    icon: Calculator,
    groups: [
      {
        title: 'Plan de cuentas',
        items: [
          {
            slug: 'cnt-tipos-cuenta',
            title: 'Tipos de cuenta',
            render: () => <TiposCuenta />,
          },
          {
            slug: 'cnt-catalogo',
            title: 'Catálogo de cuentas',
            render: withCompany(CatalogoCuentas),
          },
          {
            slug: 'cnt-catalogo-sucursal',
            title: 'Asignar cuenta a sucursal',
            render: withCompany(CatalogoSucursal),
          },
          {
            slug: 'cnt-grupos-sucursal',
            title: 'Grupo contable sucursal',
            render: withCompany(GruposSucursal),
          },
        ],
      },
      {
        title: 'Costos y períodos',
        items: [
          {
            slug: 'cnt-centros',
            title: 'Centros de costo',
            render: withCompany(CentrosCosto),
          },
          {
            slug: 'cnt-ncf',
            title: 'Mantenimiento NCF',
            render: withCompanyMesAno(NcfContabilidad),
          },
          {
            slug: 'cnt-periodos',
            title: 'Períodos y cierres',
            render: withCompanyMesAno(PeriodosFiscales),
          },
        ],
      },
    ],
  },
  {
    id: 'plantillas-pdf',
    title: 'Plantillas PDF',
    description: 'Cabecera, logo, columnas y leyenda fiscal de cada PDF.',
    icon: FileText,
    groups: [
      {
        title: 'Editor',
        items: [
          {
            slug: 'pdf-templates',
            title: 'Editor de plantillas',
            keywords: [
              'pdf',
              'factura',
              'conduce',
              'cheque',
              'asiento',
              'logo',
              'cabecera',
              'footer',
              'plantilla',
              'columnas',
              'ncf',
            ],
            render: () => <PdfTemplatesEditor />,
          },
        ],
      },
    ],
  },
  {
    id: 'sistema',
    title: 'Sistema',
    description: 'Permisos y documentación.',
    icon: ShieldCheck,
    groups: [
      {
        title: 'Seguridad',
        items: [
          {
            slug: 'sis-usuarios',
            title: 'Usuarios',
            render: () => (
              <PlaceholderLink href='/sistema/usuarios' label='Usuarios' />
            ),
          },
          {
            slug: 'sis-permisos',
            title: 'Matriz de accesos',
            render: () => (
              <PlaceholderLink
                href='/sistema/permisos'
                label='Matriz de accesos'
              />
            ),
          },
        ],
      },
      {
        title: 'Documentación',
        items: [
          {
            slug: 'sis-manuales',
            title: 'Manuales',
            render: () => <PlaceholderLink href='/man' label='Manuales' />,
          },
          {
            slug: 'sis-docs',
            title: 'Documentación técnica',
            render: () => (
              <PlaceholderLink href='/docs' label='Documentación técnica' />
            ),
          },
        ],
      },
      {
        title: 'MCP (Model Context Protocol)',
        items: [
          {
            slug: 'sis-mcp-tokens',
            title: 'Tokens MCP',
            description:
              'Generar y revocar tokens para que clientes MCP externos (Claude Desktop, agentes) accedan al servidor.',
            keywords: ['mcp', 'tokens', 'api', 'bearer', 'claude desktop'],
            render: () => (
              <PlaceholderLink href='/admin/mcp/tokens' label='Tokens MCP' />
            ),
          },
          {
            slug: 'sis-mcp-usage',
            title: 'Auditoría MCP',
            description:
              'Llamadas registradas: KPIs por tool, usuario y código de error. Tiempos de respuesta y tasa de fallas.',
            keywords: ['mcp', 'auditoria', 'uso', 'logs', 'kpis'],
            render: () => (
              <PlaceholderLink href='/admin/mcp/usage' label='Auditoría MCP' />
            ),
          },
        ],
      },
    ],
  },
]

function PlaceholderLink({ href, label }: { href: string; label: string }) {
  return (
    <div className='flex flex-col items-start gap-2 p-6 text-sm text-muted-foreground'>
      <p>
        {label} se gestiona en una pantalla aparte. Abrir en{' '}
        <a className='font-medium text-foreground underline' href={href}>
          {href}
        </a>
        .
      </p>
    </div>
  )
}

export const allSettingsItems = (): SettingsItem[] =>
  settingsCatalog.flatMap((c) => c.groups.flatMap((g) => g.items))

export const findSettingsItem = (slug: string) =>
  allSettingsItems().find((i) => i.slug === slug)

export const findContext = (slug: string) => {
  for (const cat of settingsCatalog) {
    for (const g of cat.groups) {
      const it = g.items.find((i) => i.slug === slug)
      if (it) return { cat, group: g, item: it }
    }
  }
  return null
}

export const itemMatchesQuery = (
  item: SettingsItem,
  catTitle: string,
  groupTitle: string,
  needle: string
) => {
  if (!needle) return true
  const haystack = [
    item.title,
    item.description ?? '',
    ...(item.keywords ?? []),
    catTitle,
    groupTitle,
  ]
  return haystack.some((s) => s.toLowerCase().includes(needle.toLowerCase()))
}
