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
            {
              title: 'Configuracion',
              items: [
                { title: 'Companias', url: '/fat/companias' },
                { title: 'Puntos de Trabajo', url: '/fat/puntos' },
                { title: 'Tipos de Documento', url: '/fat/tdocu' },
                { title: 'Listas de Precio', url: '/fat/listas-precio' },
                { title: 'Transportistas', url: '/fat/transportistas' },
                { title: 'Condiciones de Pago', url: '/fat/condiciones' },
                { title: 'Tipos de Pago en Caja', url: '/fat/tipos-pago' },
                { title: 'Notas Pie de Factura', url: '/fat/notas' },
                { title: 'Control de NCF', url: '/fat/ncf' },
              ],
            },
            {
              title: 'Proceso',
              items: [
                { title: 'Facturacion', url: '/fat/nueva-factura' },
                { title: 'Cotizacion / Conduce', url: '/fat/nuevo-conduce' },
                { title: 'Anular Factura', url: '/fat/anular-factura' },
                { title: 'Cuadre de Caja', url: '/fat/cuadre-caja' },
              ],
            },
            {
              title: 'Consultas',
              items: [
                { title: 'Consulta de Facturas', url: '/fat/facturas' },
                { title: 'Pedidos / Cotizaciones / Conduces', url: '/fat/conduces' },
              ],
            },
            {
              title: 'Reportes',
              items: [
                { title: 'Ventas por Producto', url: '/fat/rep-ventas' },
                { title: 'Ventas por Cliente', url: '/fat/rep-ventas-cliente' },
                { title: 'Ventas por Vendedor', url: '/fat/rep-ventas-vendedor' },
                { title: 'Analitica de Ventas', url: '/fat/rep-analitica' },
                { title: 'NCF Form 607', url: '/fat/rep-607' },
                { title: 'NCF Nulos', url: '/fat/rep-ncf-nulos' },
              ],
            },
            {
              title: 'Cierres',
              items: [
                { title: 'Generar Asiento a Contabilidad', url: '/fat/generar-asientos' },
                { title: 'Cierre Mensual', url: '/fat/cierre-mensual' },
              ],
            },
          ],
        },
        {
          title: 'Cuentas por Cobrar',
          icon: CreditCard,
          items: [
            {
              title: 'Configuracion',
              items: [
                { title: 'Companias', url: '/cxc/cias' },
                { title: 'Sucursales / Puntos', url: '/cxc/puntos' },
                { title: 'Tipo de Documento', url: '/cxc/tdocu' },
                { title: 'Tipo de Clientes', url: '/cxc/tcli' },
                { title: 'Supervisores', url: '/cxc/supervisores' },
                { title: 'Vendedores', url: '/cxc/vendedores' },
                { title: 'Grupo de Ruta', url: '/cxc/rutas' },
                { title: 'Tipo Contable de Cliente', url: '/cxc/tcontable' },
                { title: 'Ciudades', url: '/cxc/ciudades' },
                { title: 'Sectores / Barrios', url: '/cxc/barrios' },
                { title: 'Zonas', url: '/cxc/zonas' },
                { title: 'Cadenas de Negocios', url: '/cxc/cadenas' },
              ],
            },
            {
              title: 'Clientes',
              items: [
                { title: 'Clientes', url: '/cxc/clientes' },
                { title: 'Asignacion Cliente a Ruta', url: '/cxc/cliente-ruta' },
              ],
            },
            {
              title: 'Documentos',
              items: [
                { title: 'Entrada de Transacciones', url: '/cxc/transacciones' },
                { title: 'Consulta / Impresion de Documentos', url: '/cxc/documentos' },
              ],
            },
            {
              title: 'Procesos',
              items: [
                { title: 'Reversar Documento', url: '/cxc/reversar' },
                { title: 'Pagos Masivos', url: '/cxc/pagos-masivos' },
                { title: 'Liberar Credito', url: '/cxc/liberar-credito' },
                { title: 'Corregir / Liberar NCF', url: '/cxc/corregir-ncf' },
              ],
            },
            {
              title: 'Consultas',
              items: [
                { title: 'Estado de Cuenta', url: '/cxc/estado-cuenta' },
                { title: 'Balance de Clientes (Envejecimiento)', url: '/cxc/balance' },
                { title: 'Historico de Pagos', url: '/cxc/historico' },
                { title: 'Libro de Ventas', url: '/cxc/libro-ventas' },
              ],
            },
            {
              title: 'Reportes',
              items: [
                { title: 'Envejecimiento de Cartera', url: '/cxc/rep-envejecimiento' },
                { title: 'Cobros por Vendedor', url: '/cxc/rep-cobros-vendedor' },
                { title: 'Comisiones por Vendedor', url: '/cxc/rep-comisiones' },
                { title: 'NCF Emitidos por Periodo', url: '/cxc/rep-ncf' },
              ],
            },
            {
              title: 'Cierre',
              items: [
                { title: 'Imprimir Asiento Contable', url: '/cxc/asiento-contable' },
                { title: 'Generar Asiento al Mayor', url: '/cxc/generar-asiento' },
                { title: 'Cierre de CxC', url: '/cxc/cierre' },
              ],
            },
          ],
        },
        {
          title: 'Cuentas por Pagar',
          icon: Wallet,
          items: [
            {
              title: 'Configuracion',
              items: [
                { title: 'Companias', url: '/cxp/cias' },
                { title: 'Sucursales / Puntos', url: '/cxp/puntos' },
                { title: 'Tipos de Proveedores', url: '/cxp/tproveedores' },
                { title: 'Tipos de Documento', url: '/cxp/tdocu' },
                { title: 'Acceso de Usuarios', url: '/cxp/usuarios' },
                { title: 'Ciudades', url: '/cxp/ciudades' },
                { title: 'Sectores / Barrios', url: '/cxp/barrios' },
              ],
            },
            {
              title: 'Proveedores',
              items: [
                { title: 'Proveedores', url: '/cxp/proveedores' },
              ],
            },
            {
              title: 'Documentos',
              items: [
                { title: 'Entrada de Documentos DR/CR', url: '/cxp/entrada-documentos' },
                { title: 'Consulta / Impresion de Documentos', url: '/cxp/documentos' },
                { title: 'Cuentas por Pagar', url: '/cxp/cuentas' },
                { title: 'Movimientos de Proveedor', url: '/cxp/movimientos' },
              ],
            },
            {
              title: 'Procesos',
              items: [
                { title: 'Reversar Documento', url: '/cxp/reversar' },
                { title: 'Liberar Debito', url: '/cxp/liberar-debito' },
                { title: 'Bloquear / Desbloquear Pago', url: '/cxp/bloquear-pago' },
              ],
            },
            {
              title: 'Consultas',
              items: [
                { title: 'Antiguedad de Saldos', url: '/cxp/envejecimiento' },
                { title: 'Movimientos de Proveedores', url: '/cxp/rep-movimientos' },
              ],
            },
            {
              title: 'Reportes',
              items: [
                { title: 'Alfabetico de Proveedores', url: '/cxp/rep-alfabetico' },
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
                { title: 'Imprimir Asiento Contable', url: '/cxp/asiento-contable' },
                { title: 'Generar Asiento a Contabilidad', url: '/cxp/generar-asiento' },
                { title: 'Cierre Mensual', url: '/cxp/cierre' },
              ],
            },
          ],
        },
        {
          title: 'Inventario (INV)',
          icon: Package,
          items: [
            {
              title: 'Configuración',
              items: [
                { title: 'Compañías', url: '/inv', search: { section: 'configuracion', view: 'companias' } },
                { title: 'Puntos de Trabajo', url: '/inv', search: { section: 'configuracion', view: 'puntos-trabajo' } },
                { title: 'Almacenes', url: '/inv', search: { section: 'configuracion', view: 'almacenes' } },
                { title: 'Tipos de Documentos', url: '/inv', search: { section: 'configuracion', view: 'tipos-documentos' } },
                { title: 'Grupo de Productos', url: '/inv', search: { section: 'configuracion', view: 'grupo-productos' } },
                { title: 'Línea de Productos', url: '/inv', search: { section: 'configuracion', view: 'linea-productos' } },
                { title: 'Sub Línea de Productos', url: '/inv', search: { section: 'configuracion', view: 'sublinea-productos' } },
                { title: 'Grupo Contable', url: '/inv', search: { section: 'configuracion', view: 'grupo-contable' } },
                { title: 'Unidades de Empaque', url: '/inv', search: { section: 'configuracion', view: 'unidades-empaque' } },
                { title: 'Referencia de Empaque', url: '/inv', search: { section: 'configuracion', view: 'referencia-empaque' } },
                { title: 'Productos', url: '/inv', search: { section: 'configuracion', view: 'productos' } },
                { title: 'Asignar Prod. a Cia./Almacén', url: '/inv', search: { section: 'configuracion', view: 'asignar-prod-cia' } },
                { title: 'Modificar Costo', url: '/inv', search: { section: 'configuracion', view: 'modificar-costo' } },
                { title: 'Mínimo y Máximo', url: '/inv', search: { section: 'configuracion', view: 'minimo-maximo' } },
                { title: 'Estantes y Tramos', url: '/inv', search: { section: 'configuracion', view: 'estantes-tramos' } },
              ],
            },
            {
              title: 'Procesos',
              items: [
                { title: 'Entrada de Compras', url: '/inv', search: { section: 'procesos', view: 'entrada-compras' } },
                { title: 'Entrada Mercancía Almacén', url: '/inv', search: { section: 'procesos', view: 'entrada-mercancia' } },
                { title: 'Salida de Mercancía', url: '/inv', search: { section: 'procesos', view: 'salida-mercancia' } },
                { title: 'Transferencia de Mercancía', url: '/inv', search: { section: 'procesos', view: 'transferencia-mercancia' } },
                { title: 'Devolución a Suplidores', url: '/inv', search: { section: 'procesos', view: 'devolucion-suplidores' } },
                { title: 'Devolución de Ventas', url: '/inv', search: { section: 'procesos', view: 'devolucion-ventas' } },
                { title: 'Reversar Documento', url: '/inv', search: { section: 'procesos', view: 'reversar-documento' } },
                { title: 'Impresión de Documentos', url: '/inv', search: { section: 'procesos', view: 'impresion-documentos' } },
              ],
            },
            {
              title: 'Consultas',
              items: [
                { title: 'Consulta de Documentos', url: '/inv', search: { section: 'consultas', view: 'consulta-documentos' } },
                { title: 'Existencia de Producto', url: '/inv', search: { section: 'consultas', view: 'existencia-producto' } },
                { title: 'Existencia en Grupo', url: '/inv', search: { section: 'consultas', view: 'existencia-grupo' } },
              ],
            },
            {
              title: 'Reportes',
              items: [
                { title: 'Existencia', url: '/inv', search: { section: 'reportes', view: 'reporte-existencia' } },
                { title: 'Movimientos', url: '/inv', search: { section: 'reportes', view: 'reporte-movimientos' } },
                { title: 'Líneas y Sublíneas', url: '/inv', search: { section: 'reportes', view: 'lineas-sublineas' } },
              ],
            },
            {
              title: 'Conteo Físico',
              items: [
                { title: 'Reportes CF', url: '/inv', search: { section: 'conteo-fisico', view: 'reportes-cf' } },
                { title: 'Cargar CF desde Excel', url: '/inv', search: { section: 'conteo-fisico', view: 'cargar-cf-excel' } },
                { title: 'Entrada CF Manual', url: '/inv', search: { section: 'conteo-fisico', view: 'entrada-cf-manual' } },
                { title: 'Comparativo Físico vs Teórico', url: '/inv', search: { section: 'conteo-fisico', view: 'comparativo-fisico' } },
                { title: 'Ajuste de Inventario por CF', url: '/inv', search: { section: 'conteo-fisico', view: 'ajuste-inventario-cf' } },
              ],
            },
            {
              title: 'Cierre',
              items: [
                { title: 'Entrada de Diario', url: '/inv', search: { section: 'cierre', view: 'entrada-diario' } },
                { title: 'Generar Asiento a Contabilidad', url: '/inv', search: { section: 'cierre', view: 'generar-asiento' } },
                { title: 'Cierre Mensual', url: '/inv', search: { section: 'cierre', view: 'cierre-mensual' } },
              ],
            },
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
            {
              title: 'Configuracion',
              items: [
                { title: 'Companias', url: '/cnt', search: { section: 'configuracion', view: 'companias' } },
                { title: 'Sucursales', url: '/cnt', search: { section: 'configuracion', view: 'sucursales' } },
                { title: 'Tipos de cuenta', url: '/cnt', search: { section: 'configuracion', view: 'tipos-cuenta' } },
                { title: 'Catalogo de cuentas', url: '/cnt', search: { section: 'configuracion', view: 'catalogo' } },
                { title: 'Asignar cuenta a sucursal', url: '/cnt', search: { section: 'configuracion', view: 'catalogo-sucursal' } },
                { title: 'Grupo contable sucursal', url: '/cnt', search: { section: 'configuracion', view: 'grupos-sucursal' } },
                { title: 'Centros de costo', url: '/cnt', search: { section: 'configuracion', view: 'centros' } },
                { title: 'Mantenimiento NCF', url: '/cnt', search: { section: 'configuracion', view: 'ncf' } },
                { title: 'Periodos y cierres', url: '/cnt', search: { section: 'configuracion', view: 'periodos' } },
              ],
            },
            {
              title: 'Procesos',
              items: [
                { title: 'Entrada de diario', url: '/cnt', search: { section: 'procesos', view: 'asientos' } },
                { title: 'Verificacion de asientos', url: '/cnt', search: { section: 'procesos', view: 'verificacion' } },
                { title: 'Autorizar asientos', url: '/cnt', search: { section: 'procesos', view: 'autorizar' } },
                { title: 'Procesos meses anteriores', url: '/cnt', search: { section: 'procesos', view: 'autorizar-anterior' } },
                { title: 'Presupuesto', url: '/cnt', search: { section: 'procesos', view: 'presupuesto' } },
              ],
            },
            {
              title: 'Consultas',
              items: [
                { title: 'Consulta de asientos', url: '/cnt', search: { section: 'consultas', view: 'consulta-asientos' } },
                { title: 'Movimientos de cuentas', url: '/cnt', search: { section: 'consultas', view: 'movimientos' } },
              ],
            },
            {
              title: 'Reportes',
              items: [
                { title: 'Balance de comprobacion', url: '/cnt', search: { section: 'reportes', view: 'balance' } },
                { title: 'Mayor general', url: '/cnt', search: { section: 'reportes', view: 'mayor' } },
                { title: 'Estados financieros', url: '/cnt', search: { section: 'reportes', view: 'estados' } },
              ],
            },
            {
              title: 'Cierres',
              items: [
                { title: 'Cierres contables', url: '/cnt', search: { section: 'cierres', view: 'cierres' } },
                { title: 'Cierre mensual', url: '/cnt', search: { section: 'cierres', view: 'cierre-mensual' } },
              ],
            },
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

