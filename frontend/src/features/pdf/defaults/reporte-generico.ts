// Plantilla default genérica para reportes (TablaReporte con columnas configurables).
// Las columnas se ajustan después editando el bloque TablaReporte en el editor.

export function reporteGenericoDefault(
  titulo: string,
  columnas: Array<{ campo: string; label: string; align?: 'left' | 'right' | 'center'; format?: 'money' | 'date' | 'text' }>,
  agrupado?: { groupBy: string; subtotalCampos: string }
): any {
  return {
    content: [
      { type: 'HeaderEmpresa', props: {
        id: 'he', showLogo: true, logoAlign: 'left', colorPrimario: '#0F172A',
        showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 14,
      } },
      { type: 'HeaderReporte', props: {
        id: 'hr', showFiltros: true, showFechaGeneracion: true, colorPrimario: '#0F172A',
      } },
      { type: 'TablaReporte', props: {
        id: 'tr',
        columnasJson: JSON.stringify(columnas, null, 2),
        // Estilo "sencillo" CxP: encabezado en negrita con raya fina (sin barra
        // oscura ni zebra) — el bloque TablaReporte dibuja la raya #333.
        zebra: false, headerBg: '#ffffff', headerColor: '#0F172A', fontSize: 9,
        groupBy: agrupado?.groupBy || '',
        subtotalCampos: agrupado?.subtotalCampos || '',
      } },
      { type: 'FooterReporte', props: {
        id: 'fr', showCantidad: true, showTotal: true, colorPrimario: '#0F172A',
      } },
      { type: 'FooterEmpresa', props: {
        id: 'fo', texto: '{{ cia.razon_social }}',
        showPaginacion: true, showFechaGeneracion: false, color: '#777777',
      } },
      ...(titulo ? [] : []),  // placeholder por si añadimos algo basado en titulo
    ],
    root: { props: {} },
    zones: {},
  }
}

// Asiento Contable (CxC/CxP) — resumen por cuenta, estilo fino con fila TOTALES
// de débito/crédito. Reemplaza las vistas previas client-side (document.write).
export const asientoContableDefault: any = {
  content: [
    { type: 'HeaderEmpresa', props: {
      id: 'he', showLogo: true, logoAlign: 'left', colorPrimario: '#0F172A',
      showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 14,
    } },
    { type: 'HeaderReporte', props: {
      id: 'hr', showFiltros: true, showFechaGeneracion: true, colorPrimario: '#0F172A',
    } },
    { type: 'TablaReporte', props: {
      id: 'tr',
      columnasJson: JSON.stringify([
        { campo: 'cuenta', label: 'Cuenta', align: 'left' },
        { campo: 'centro_costo', label: 'Centro Costo', align: 'left' },
        { campo: 'total_debito', label: 'Débito', align: 'right', format: 'money' },
        { campo: 'total_credito', label: 'Crédito', align: 'right', format: 'money' },
      ], null, 2),
      zebra: false, headerBg: '#ffffff', headerColor: '#0F172A', fontSize: 9,
      groupBy: '', subtotalCampos: '',
    } },
    { type: 'TextoLibre', props: {
      id: 'tot',
      html: `
<table style="width:100%;border-collapse:collapse;font-size:9px">
  <tr style="border-top:1px solid #333;font-weight:bold">
    <td style="padding:4px 6px" colspan="2">TOTALES</td>
    <td style="padding:4px 6px;text-align:right">{{formatMoney totales.total_debito}}</td>
    <td style="padding:4px 6px;text-align:right">{{formatMoney totales.total_credito}}</td>
  </tr>
</table>`,
      fontSize: 9, textAlign: 'left',
    } },
    { type: 'FooterEmpresa', props: {
      id: 'fo', texto: '{{ cia.razon_social }}',
      showPaginacion: true, showFechaGeneracion: false, color: '#777777',
    } },
  ],
  root: { props: {} },
  zones: {},
}

// Predefinidos por reporte:
export const ncfNulosDefault = reporteGenericoDefault('NCF Nulos', [
  { campo: 'ncf_dgi', label: 'NCF', align: 'left' },
  { campo: 'tipo_factura', label: 'Tipo', align: 'left' },
  { campo: 'no_factura', label: 'No.', align: 'left' },
  { campo: 'fecha', label: 'Fecha', align: 'left', format: 'date' },
  { campo: 'motivo', label: 'Motivo', align: 'left' },
])

export const facturasRncDefault = reporteGenericoDefault('Facturas con RNC', [
  { campo: 'fecha', label: 'Fecha', align: 'left', format: 'date' },
  { campo: 'tipo_factura', label: 'Tipo', align: 'left' },
  { campo: 'no_factura', label: 'No.', align: 'left' },
  { campo: 'ncf_dgi', label: 'NCF', align: 'left' },
  { campo: 'rnc', label: 'RNC Cliente', align: 'left' },
  { campo: 'nombre_cliente', label: 'Cliente', align: 'left' },
  { campo: 'total_neto', label: 'Total', align: 'right', format: 'money' },
])

export const margenBrutoDefault = reporteGenericoDefault('Margen Bruto', [
  { campo: 'no_produ', label: 'Producto', align: 'left' },
  { campo: 'descripcion', label: 'Descripción', align: 'left' },
  { campo: 'venta', label: 'Venta', align: 'right', format: 'money' },
  { campo: 'costo', label: 'Costo', align: 'right', format: 'money' },
  { campo: 'beneficio', label: 'Beneficio', align: 'right', format: 'money' },
  { campo: 'margen_pct', label: 'Margen %', align: 'right' },
])

export const ncf607Default = reporteGenericoDefault('Reporte 607 NCF', [
  { campo: 'ncf', label: 'NCF', align: 'left' },
  { campo: 'fecha', label: 'Fecha', align: 'left', format: 'date' },
  { campo: 'rnc', label: 'RNC', align: 'left' },
  { campo: 'nombre', label: 'Razón Social', align: 'left' },
  { campo: 'monto', label: 'Monto', align: 'right', format: 'money' },
  { campo: 'itbis', label: 'ITBIS', align: 'right', format: 'money' },
])

export const listaPreciosDefault = reporteGenericoDefault('Lista de Precios', [
  { campo: 'no_produ', label: 'Código', align: 'left' },
  { campo: 'descripcion', label: 'Descripción', align: 'left' },
  { campo: 'precio', label: 'Precio', align: 'right', format: 'money' },
  { campo: 'porc_descuento', label: 'Desc %', align: 'right' },
])

export const cuadreCajaDefault = reporteGenericoDefault('Cuadre de Caja', [
  { campo: 'no_factura', label: 'Factura', align: 'left' },
  { campo: 'fecha', label: 'Fecha', align: 'left', format: 'date' },
  { campo: 'cliente', label: 'Cliente', align: 'left' },
  { campo: 'forma_pago', label: 'Forma Pago', align: 'left' },
  { campo: 'total', label: 'Total', align: 'right', format: 'money' },
])

export const ventasProductosDefault = reporteGenericoDefault('Ventas por Producto', [
  { campo: 'no_produ', label: 'Producto', align: 'left' },
  { campo: 'descripcion', label: 'Descripción', align: 'left' },
  { campo: 'cantidad', label: 'Cant.', align: 'right' },
  { campo: 'total_neto', label: 'Total', align: 'right', format: 'money' },
])

export const listadoConducesDefault = reporteGenericoDefault('Listado de Conduces', [
  { campo: 'no_conduce', label: 'No.', align: 'left' },
  { campo: 'fecha', label: 'Fecha', align: 'left', format: 'date' },
  { campo: 'cliente', label: 'Cliente', align: 'left' },
  { campo: 'factura', label: 'Factura', align: 'left' },
  { campo: 'total', label: 'Total', align: 'right', format: 'money' },
])

export const invExistenciaDefault = reporteGenericoDefault('Existencia INV', [
  { campo: 'almacen', label: 'Almacén', align: 'left' },
  { campo: 'no_produ', label: 'Producto', align: 'left' },
  { campo: 'descripcion', label: 'Descripción', align: 'left' },
  { campo: 'existencia', label: 'Existencia', align: 'right' },
  { campo: 'costo_prom', label: 'Costo Prom.', align: 'right', format: 'money' },
  { campo: 'valor', label: 'Valor', align: 'right', format: 'money' },
])

export const invMovimientosDefault = reporteGenericoDefault('Movimientos INV', [
  { campo: 'fecha', label: 'Fecha', align: 'left', format: 'date' },
  { campo: 'tipo_docu', label: 'Tipo', align: 'left' },
  { campo: 'no_docu', label: 'No.', align: 'left' },
  { campo: 'no_produ', label: 'Producto', align: 'left' },
  { campo: 'descripcion', label: 'Descripción', align: 'left' },
  { campo: 'cantidad', label: 'Cant.', align: 'right' },
  { campo: 'valor', label: 'Valor', align: 'right', format: 'money' },
])

export const invKardexDefault = reporteGenericoDefault('Kardex Producto', [
  { campo: 'fecha', label: 'Fecha', align: 'left', format: 'date' },
  { campo: 'tipo_docu', label: 'Tipo', align: 'left' },
  { campo: 'no_docu', label: 'No.', align: 'left' },
  { campo: 'entrada', label: 'Entrada', align: 'right' },
  { campo: 'salida', label: 'Salida', align: 'right' },
  { campo: 'balance', label: 'Balance', align: 'right' },
  { campo: 'costo_prom', label: 'Costo Prom.', align: 'right', format: 'money' },
])

export const invValorizacionDefault = reporteGenericoDefault('Valorización INV', [
  { campo: 'almacen', label: 'Almacén', align: 'left' },
  { campo: 'no_produ', label: 'Producto', align: 'left' },
  { campo: 'descripcion', label: 'Descripción', align: 'left' },
  { campo: 'existencia', label: 'Existencia', align: 'right' },
  { campo: 'costo_prom', label: 'Costo Prom.', align: 'right', format: 'money' },
  { campo: 'valor', label: 'Valor', align: 'right', format: 'money' },
])

export const invCierreEntradaDefault = reporteGenericoDefault('Cierre Entrada Diario', [
  { campo: 'tipo_docu', label: 'Tipo', align: 'left' },
  { campo: 'no_docu', label: 'No.', align: 'left' },
  { campo: 'fecha', label: 'Fecha', align: 'left', format: 'date' },
  { campo: 'almacen', label: 'Almacén', align: 'left' },
  { campo: 'total', label: 'Total', align: 'right', format: 'money' },
])

// Plantilla INV — usa el bloque reutilizable DocumentoSimple (estilo CxP:
// líneas finas, sin barra oscura ni zebra). Un solo componente arma header +
// tercero (proveedor/cliente auto) + almacén + líneas + totales + firmas para
// TODOS los tipos de documento INV (EC/DC con proveedor, EA/SA/TA/AE/AS/EP/SP
// sin tercero). Sin HTML suelto: la lógica vive en el componente.
export const invDocumentoDefault: any = {
  content: [
    { type: 'WatermarkAnulada', props: { id: 'wm', texto: 'ANULADA', opacity: 0.18, angle: -30, color: '#dc2626' } },
    { type: 'DocumentoSimple', props: {
      id: 'doc', firmaIzq: 'Recibido por', firmaDer: 'Entregado por', mostrarAlmacen: true,
    } },
    { type: 'FooterEmpresa', props: {
      id: 'fo', texto: '{{ cia.razon_social }}',
      showPaginacion: true, showFechaGeneracion: true, color: '#777777',
    } },
  ],
  root: { props: {} },
  zones: {},
}
