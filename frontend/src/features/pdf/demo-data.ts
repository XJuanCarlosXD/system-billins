// Payload de demo para mostrar dentro del editor visual (Puck).
// Permite que el usuario vea cómo se ve cada bloque sin tener que abrir el documento real.
import type { DocumentoPrintPayload, ReportePrintPayload } from './types'

const ciaDemo = {
  no_cia: '01',
  razon_social: 'GRUPO ABREGONZA S.R.L.',
  rnc: '131-12345-6',
  direccion: 'Av. Independencia #1234, Santo Domingo, R.D.',
  telefono: '809-555-0100',
  email: 'contacto@grupo-abregonza.com',
  logo_url: '',
  color_primario: '#0F172A',
}

const clienteDemo = {
  no: 1234,
  nombre: 'JUAN CARLOS PÉREZ MARTÍNEZ',
  rnc: '402-12345-7',
  direccion: 'Calle Duarte #45, Santiago, R.D.',
  telefono: '829-555-9876',
  email: 'jc.perez@example.com',
  tipo_ncf: 'B01',
}

const lineasDemo = [
  { codigo: 'PRD-001', descripcion: 'Producto demostración A — caja 12 unidades', cantidad: 5, unidad: 'CAJ', precio: 1200, porc_descuento: 0, descuento: 0, porciento_impuesto: 18, itbis: 1080, total: 7080 },
  { codigo: 'PRD-002', descripcion: 'Producto demostración B — saco 50lb', cantidad: 2, unidad: 'SAC', precio: 850, porc_descuento: 5, descuento: 85, porciento_impuesto: 18, itbis: 291.6, total: 1911.6 },
  { codigo: 'SVC-010', descripcion: 'Servicio de instalación y entrenamiento', cantidad: 1, unidad: 'HRS', precio: 2500, porc_descuento: 0, descuento: 0, porciento_impuesto: 18, itbis: 450, total: 2950 },
  { codigo: 'PRD-003', descripcion: 'Repuesto especial OEM ref. 1023-A', cantidad: 4, unidad: 'UND', precio: 320, porc_descuento: 10, descuento: 128, porciento_impuesto: 18, itbis: 207.36, total: 1359.36 },
]

const totalesDemo = {
  subtotal: 13037,
  descuento: 213,
  itbis: 2028.96,
  propina: 0,
  otros: 0,
  total: 13300.96,
  monto_letras: 'TRECE MIL TRESCIENTOS PESOS CON 96/100',
}

export const facturaDemo: DocumentoPrintPayload = {
  cia: ciaDemo,
  doc: {
    tipo: 'FT', tipo_label: 'Factura Contado',
    no: '0039350', numero_display: 'FT-0039350',
    fecha: '2026-06-10', fecha_venc: null,
    ncf: 35, ncf_dgi: 'B0200000035',
    tipo_ncf: 'B02', tipo_ncf_label: 'B02 — Consumo',
    estado: 'F', anulada: false,
    impresion: 'IMPRESA',
    condicion_pago: 'CONTADO',
    forma_pago: 'EFECTIVO',
    plazo_pago: 0,
    vendedor_codigo: 'V01',
    vendedor_nombre: 'Pedro García',
    vendedor: 'V01 — Pedro García',
    nota: 'Gracias por su preferencia. Cambios sujetos a presentación de factura.',
    detalle: '',
    moneda: 'DOP', tasa: 0,
    porc_impuesto: 18,
  },
  cliente: clienteDemo,
  lineas: lineasDemo,
  totales: totalesDemo,
  extra: {},
}

export const conduceDemo: DocumentoPrintPayload = {
  ...facturaDemo,
  doc: {
    ...facturaDemo.doc,
    tipo: 'CO', tipo_label: 'Conduce',
    no: '00002409', numero_display: 'CO-00002409',
    ncf_dgi: '', tipo_ncf: '', tipo_ncf_label: '',
    impresion: 'IMPRESA',
    factura_relacionada: 'FT-0039350',
  },
}

export const cotizacionDemo: DocumentoPrintPayload = {
  ...facturaDemo,
  doc: {
    ...facturaDemo.doc,
    tipo: 'CT', tipo_label: 'Cotización',
    no: '00003931', numero_display: 'CT-00003931',
    fecha_venc: '2026-06-25',
    ncf_dgi: '', tipo_ncf: '', tipo_ncf_label: '',
    impresion: '',
  },
}

export const listadoFacturasDemo: ReportePrintPayload = {
  cia: ciaDemo,
  reporte: {
    codigo: 'listado-facturas',
    titulo: 'Listado de Facturas',
    fecha_generacion: null,
    filtros: { Desde: '2026-06-01', Hasta: '2026-06-10', Tipo: 'FT' },
  },
  filas: [
    { no_factura: 'FT-0039350', fecha: '2026-06-10', cliente: 'JUAN CARLOS PÉREZ MARTÍNEZ', ncf_dgi: 'B0200000035', estado: 'F', total: 13300.96 },
    { no_factura: 'FT-0039349', fecha: '2026-06-10', cliente: 'INDUSTRIAS DEL CARIBE S.A.', ncf_dgi: 'B0200000034', estado: 'F', total: 45200.50 },
    { no_factura: 'FT-0039348', fecha: '2026-06-09', cliente: 'COMERCIAL EL SOL S.R.L.', ncf_dgi: 'B0200000033', estado: 'F', total: 8750.00 },
    { no_factura: 'FC-0039347', fecha: '2026-06-09', cliente: 'DISTRIBUIDORA NORTE S.A.', ncf_dgi: 'B0100000020', estado: 'F', total: 125000.00 },
    { no_factura: 'FT-0039346', fecha: '2026-06-08', cliente: 'CONSTRUCTORA OESTE S.R.L.', ncf_dgi: 'B0200000032', estado: 'A', total: 9800.00 },
  ],
  totales: { total: 202051.46, cantidad: 5 },
}

export function getDemoData(codigo: string): DocumentoPrintPayload | ReportePrintPayload | null {
  switch (codigo) {
    case 'factura': return facturaDemo
    case 'conduce': return conduceDemo
    case 'cotizacion': return cotizacionDemo
    case 'listado-facturas': return listadoFacturasDemo
    default: return null
  }
}
