export const MODULE_DESCRIPTIONS: Record<string, string> = {
  fat: 'Facturas, cotizaciones, conduces, cuadre de caja y cierre mensual con NCF/e-CF.',
  cxc: 'Clientes, cobros, estados de cuenta, envejecimiento de cartera y comisiones por vendedor.',
  cxp: 'Proveedores, aplicación de pagos, retenciones y reportes 606.',
  odc: 'Órdenes y requisiciones a proveedores, integradas con Inventario y Cuentas por Pagar.',
  lic: 'Gestión de procesos de licitación y propuestas.',
  inv: 'Entradas, salidas, existencias por almacén y ajustes, multi-empresa.',
  chc: 'Conciliación bancaria, emisión y control de cheques.',
  acc: 'Reposiciones, asientos y cierre de caja chica con reportes.',
  sdn: 'Movimientos, vacaciones, cheques de pago e informes DGII.',
  acf: 'Compra, depreciación, retiro y cierre de activos fijos.',
  cnt: 'Asientos, mayor general y cierres contables consolidando todos los módulos.',
}

export type SkillExample = {
  name: string
  example: string
  description: string
}

export const SKILL_EXAMPLES: SkillExample[] = [
  {
    name: 'Facturar',
    example: 'Factura a {cliente}',
    description: 'Crear una factura de venta nueva en FAT (NCF B01-B15).',
  },
  {
    name: 'Cotizar',
    example: 'Cotizar para {cliente}',
    description:
      'Crear una cotización en FAT (sin NCF — no genera transacción contable).',
  },
  {
    name: 'Consultar cuenta cliente',
    example: '¿Cuánto debe {cliente}?',
    description:
      'Estado de cuenta de un cliente CXC con saldo, aging y movimientos.',
  },
  {
    name: 'Devolución de ventas',
    example: 'El cliente devolvió mercancía',
    description: 'Preparar una devolución de ventas (factura FT, FC o AF).',
  },
]
