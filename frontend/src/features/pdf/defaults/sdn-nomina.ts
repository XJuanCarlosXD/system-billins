// Plantilla SDN — Cabecera de Nómina con desglose por empleado.
// Usa TextoLibre + Handlebars {{#each lineas}} para tener etiquetas
// (Salario / Ingresos / Deducciones / Neto) en lugar de las fijas de
// TablaLineas (Precio / Desc / ITBIS / Total).
const tablaEmpleados = `
<table style="width:100%;border-collapse:collapse;font-size:9px;margin-top:8px">
  <thead>
    <tr style="background:#0e7490;color:#fff">
      <th style="padding:6px 4px;text-align:left">Código</th>
      <th style="padding:6px 4px;text-align:left">Empleado</th>
      <th style="padding:6px 4px;text-align:left">Cédula</th>
      <th style="padding:6px 4px;text-align:right">Salario base</th>
      <th style="padding:6px 4px;text-align:right">Ingresos</th>
      <th style="padding:6px 4px;text-align:right">Deducciones</th>
      <th style="padding:6px 4px;text-align:right">Neto</th>
    </tr>
  </thead>
  <tbody>
    {{#each lineas}}
    <tr style="page-break-inside:avoid;border-bottom:1px solid #e2e8f0">
      <td style="padding:4px;font-family:monospace">{{ codigo }}</td>
      <td style="padding:4px">{{ descripcion }}</td>
      <td style="padding:4px;font-family:monospace">{{ cedula }}</td>
      <td style="padding:4px;text-align:right;font-family:monospace">{{ formatMoney salario_mensual }}</td>
      <td style="padding:4px;text-align:right;font-family:monospace">{{ formatMoney total_ingresos }}</td>
      <td style="padding:4px;text-align:right;font-family:monospace">{{ formatMoney total_deducciones }}</td>
      <td style="padding:4px;text-align:right;font-family:monospace;font-weight:600">{{ formatMoney neto }}</td>
    </tr>
    {{/each}}
  </tbody>
  <tfoot>
    <tr style="border-top:2px solid #0e7490;background:#ecfeff">
      <td colspan="3" style="padding:6px 4px;font-weight:700">
        {{ totales.empleados }} empleado(s) · {{ extra.moneda_label }}
      </td>
      <td style="padding:6px 4px;text-align:right;font-family:monospace;font-weight:700">{{ formatMoney totales.subtotal }}</td>
      <td style="padding:6px 4px;text-align:right;font-family:monospace;font-weight:700">{{ formatMoney totales.itbis }}</td>
      <td style="padding:6px 4px;text-align:right;font-family:monospace;font-weight:700">{{ formatMoney totales.descuento }}</td>
      <td style="padding:6px 4px;text-align:right;font-family:monospace;font-weight:800;color:#0e7490">{{ formatMoney totales.total }}</td>
    </tr>
  </tfoot>
</table>
`

export const sdnNominaDefault: any = {
  content: [
    { type: 'EncabezadoFactura', props: {
      id: 'encab', showLogo: true, colorPrimario: '#0e7490',
      showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 15,
      docBg: '#0e7490', docColor: '#ffffff', showNcf: false, showImpresion: true,
    } },
    { type: 'TextoLibre', props: {
      id: 'header',
      html: '<div style="margin-top:8px;padding:10px;background:#ecfeff;border-left:3px solid #0e7490"><b>Nómina:</b> {{ doc.numero_display }}<br/><b>Descripción:</b> {{ doc.detalle }}<br/><b>Período:</b> {{ default doc.periodo "—" }}<br/><b>Fecha inicial:</b> {{ formatDate doc.fecha }} &nbsp; <b>Fecha final:</b> {{ formatDate doc.fecha_venc }}<br/><b>Forma de pago:</b> {{ doc.forma_pago }} &nbsp; <b>Estado:</b> {{ doc.estado }}<br/><b>Cuenta contable:</b> {{ default extra.cuenta_contable "—" }} &nbsp; <b>Cuenta bancaria:</b> {{ default extra.cuenta_bancaria "—" }}</div>',
      fontSize: 10, textAlign: 'left',
    } },
    { type: 'TextoLibre', props: {
      id: 'detalle',
      html: tablaEmpleados,
      fontSize: 9, textAlign: 'left',
    } },
    { type: 'NotaDetalle', props: { id: 'nota', titulo: 'Observaciones:', mostrarSiVacio: false } },
    { type: 'Firmas', props: { id: 'fi', cantidad: 2, labels: 'Preparado por|Autorizado por', lineWidth: 70 } },
    { type: 'FooterEmpresa', props: {
      id: 'fo', texto: '{{ cia.razon_social }} | RNC {{ cia.rnc }}',
      showPaginacion: true, showFechaGeneracion: true, color: '#777777',
    } },
  ],
  root: { props: {} }, zones: {},
}
