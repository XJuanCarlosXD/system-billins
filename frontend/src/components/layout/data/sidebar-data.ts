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
          title: 'Reportes de Problemas',
          url: '/reportes',
          icon: LifeBuoy,
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
          title: 'Facturacion',
          icon: Receipt,
          items: [
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
          title: 'Cuentas por Cobrar',
          icon: CreditCard,
          items: [
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
          title: 'Cuentas por Pagar',
          icon: Wallet,
          items: [
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
          title: 'Órdenes de Compra',
          icon: ShoppingCart,
          items: [
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
          title: 'Inventario',
          icon: Package,
          items: [
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
          title: 'Bancos / Cheques',
          icon: Banknote,
          items: [
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
      ],
    },
    {
      title: 'Administracion',
      items: [
        {
          title: 'Caja Chica',
          icon: Coins,
          items: [
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
          title: 'Nomina',
          icon: UsersIcon,
          items: [
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
          title: 'Activos Fijos',
          icon: Package,
          items: [
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
          title: 'Contabilidad',
          icon: Calculator,
          items: [
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
    },
    {
      title: 'Sistema',
      items: [
        {
          title: 'Permisos',
          icon: ShieldCheck,
          url: '/sistema/usuarios',
        },
        {
          title: 'Manuales',
          url: '/man',
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
