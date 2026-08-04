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
        zebra: true, headerBg: '#0F172A', headerColor: '#ffffff', fontSize: 9,
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

// Plantilla INV — estilo "sencillo" (mismo lenguaje visual que cxp-documento):
// tablas HTML vía TextoLibre en vez de paneles boxy con casillas "N/A".
// Cubre EC/DC (con proveedor), EA/SA/TA/AE/AS/EP/SP (sin tercero — la tabla
// de proveedor/cliente simplemente no se renderiza si no hay datos).
export const invDocumentoDefault: any = {
  content: [
    { type: 'WatermarkAnulada', props: { id: 'wm', texto: 'ANULADA', opacity: 0.18, angle: -30, color: '#dc2626' } },

    // ── 1. Encabezado: empresa izq + título doc / NCF der (igual a CxP)
    { type: 'TextoLibre', props: {
      id: 'header',
      html: `
<table style="width:100%;border-collapse:collapse;margin-bottom:8px">
  <tr>
    <td style="vertical-align:top;width:50%">
      <table>
        <tr>
          <td style="vertical-align:top">
            {{#if cia.logo_url}}<img src="{{cia.logo_url}}" style="max-height:60px;max-width:80px;margin-right:8px" />{{/if}}
          </td>
          <td style="vertical-align:top">
            <div style="font-weight:bold;font-size:11px">{{cia.razon_social}}</div>
            <div style="font-size:9px">{{cia.direccion}}</div>
            <div style="font-size:9px">TEL. {{cia.telefono}}</div>
            <div style="font-size:9px">RNC {{cia.rnc}}</div>
          </td>
        </tr>
      </table>
    </td>
    <td style="vertical-align:top;text-align:right">
      <div style="font-size:14px;font-weight:bold">{{upper doc.tipo_label}}</div>
      <div style="font-size:14px;font-weight:bold">{{doc.numero_display}}</div>
      <div style="font-size:9px;margin-top:6px">Fecha {{formatDate doc.fecha}}</div>
      {{#if doc.ncf_dgi}}<div style="font-size:10px;margin-top:4px"><b>NCF:</b> {{doc.ncf_dgi}}</div>{{/if}}
      {{#if doc.anulada}}<div style="font-size:10px;color:#dc2626;font-weight:bold;margin-top:2px">ANULADA</div>{{/if}}
    </td>
  </tr>
</table>`,
      fontSize: 10, textAlign: 'left',
    } },

    // ── 2. Línea Almacén / Movimiento (propia de INV, no existe en CxP)
    { type: 'TextoLibre', props: {
      id: 'almacen-linea',
      html: `
<table style="width:100%;border-collapse:collapse;border-top:1px solid #333;border-bottom:1px solid #333;font-size:9px;margin-bottom:6px">
  <tr>
    <td style="padding:3px 6px;width:110px;font-weight:bold;border-right:1px solid #ccc">ALMACÉN</td>
    <td style="padding:3px 6px">{{doc.almacen_origen}}{{#if doc.almacen_destino}} &rarr; {{doc.almacen_destino}}{{/if}}</td>
    <td style="padding:3px 6px;text-align:right">{{#if doc.vendedor}}Vendedor: {{doc.vendedor}}{{/if}}</td>
  </tr>
</table>`,
      fontSize: 9, textAlign: 'left',
    } },

    // ── 3. Tabla Proveedor (solo EC/DC — mismo estilo que la tabla Proveedor de CxP)
    { type: 'TextoLibre', props: {
      id: 'proveedor-tabla',
      html: `
{{#if proveedor.nombre}}
<table style="width:100%;border-collapse:collapse;border-bottom:1px solid #333;font-size:9px;margin-bottom:6px">
  <tr style="border-bottom:1px solid #ccc">
    <td style="padding:3px 6px;width:90px;font-weight:bold;border-right:1px solid #ccc">PROVEEDOR NO.</td>
    <td style="padding:3px 6px">{{proveedor.no}}</td>
    <td style="padding:3px 6px;text-align:right">{{#if proveedor.rnc}}RNC: {{proveedor.rnc}}{{/if}}</td>
  </tr>
  <tr style="border-bottom:1px solid #ccc">
    <td style="padding:3px 6px;font-weight:bold;border-right:1px solid #ccc">NOMBRE</td>
    <td style="padding:3px 6px" colspan="2">{{proveedor.nombre}}</td>
  </tr>
  <tr>
    <td style="padding:3px 6px;font-weight:bold;border-right:1px solid #ccc">DIRECCION</td>
    <td style="padding:3px 6px" colspan="2">{{default proveedor.direccion "—"}} {{#if proveedor.telefono}}&nbsp;|&nbsp;TEL. {{proveedor.telefono}}{{/if}}</td>
  </tr>
</table>
{{/if}}`,
      fontSize: 9, textAlign: 'left',
    } },

    // ── 3b. Tabla Cliente (solo cuando el documento sí referencia un cliente)
    { type: 'TextoLibre', props: {
      id: 'cliente-tabla',
      html: `
{{#if cliente.nombre}}
<table style="width:100%;border-collapse:collapse;border-bottom:1px solid #333;font-size:9px;margin-bottom:6px">
  <tr style="border-bottom:1px solid #ccc">
    <td style="padding:3px 6px;width:90px;font-weight:bold;border-right:1px solid #ccc">CLIENTE NO.</td>
    <td style="padding:3px 6px">{{cliente.no}}</td>
    <td style="padding:3px 6px;text-align:right">{{#if cliente.rnc}}RNC: {{cliente.rnc}}{{/if}}</td>
  </tr>
  <tr style="border-bottom:1px solid #ccc">
    <td style="padding:3px 6px;font-weight:bold;border-right:1px solid #ccc">NOMBRE</td>
    <td style="padding:3px 6px" colspan="2">{{cliente.nombre}}</td>
  </tr>
  <tr>
    <td style="padding:3px 6px;font-weight:bold;border-right:1px solid #ccc">DIRECCION</td>
    <td style="padding:3px 6px" colspan="2">{{default cliente.direccion "—"}}</td>
  </tr>
</table>
{{/if}}`,
      fontSize: 9, textAlign: 'left',
    } },

    { type: 'TextoLibre', props: {
      id: 'factura-afectada',
      html: `
{{#if extra.factura_afectada}}
<div style="margin:4px 0 6px;padding:4px 6px;border:1px solid #cbd5e1;border-radius:3px;font-size:9px">
  <b>Factura afectada:</b> {{extra.factura_afectada.numero_display}}
  &nbsp;|&nbsp; Cliente: {{extra.factura_afectada.cliente}}
  &nbsp;|&nbsp; NCF: {{extra.factura_afectada.ncf_dgi}}
  &nbsp;|&nbsp; Total original: {{formatMoney extra.factura_afectada.total_neto}}
</div>
{{/if}}`,
      fontSize: 9, textAlign: 'left',
    } },
    { type: 'TablaLineas', props: {
      id: 'tabla',
      columnas: ['codigo', 'descripcion', 'cantidad', 'precio', 'total'],
      zebra: true, headerBg: '#0F172A', headerColor: '#ffffff', fontSize: 9,
    } },
    { type: 'BloqueTotales', props: {
      id: 'tot', showSubtotal: true, showDescuento: true, showItbis: true,
      showPropina: false, showOtros: false, showMontoLetras: false, align: 'right', colorTotal: '#0F172A',
    } },
    { type: 'NotaDetalle', props: { id: 'nota', titulo: 'Observación:', mostrarSiVacio: false } },
    { type: 'Firmas', props: { id: 'fi', cantidad: 2, labels: 'Recibido por|Entregado por', lineWidth: 80 } },
    { type: 'FooterEmpresa', props: {
      id: 'fo', texto: '{{ cia.razon_social }}',
      showPaginacion: true, showFechaGeneracion: true, color: '#777777',
    } },
  ],
  root: { props: {} },
  zones: {},
}
