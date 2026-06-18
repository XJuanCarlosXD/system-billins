// Plantilla SDN — Volante de Pago individual (Fsdn206 por empleado).
// Tabla de conceptos (Ingresos vs Deducciones) con etiquetas reales.
const tablaConceptos = `
<table style="width:100%;border-collapse:collapse;font-size:9px;margin-top:8px">
  <thead>
    <tr style="background:#0e7490;color:#fff">
      <th style="padding:6px 4px;text-align:left">Código</th>
      <th style="padding:6px 4px;text-align:left">Concepto</th>
      <th style="padding:6px 4px;text-align:center">Tipo</th>
      <th style="padding:6px 4px;text-align:right">Ingreso</th>
      <th style="padding:6px 4px;text-align:right">Deducción</th>
    </tr>
  </thead>
  <tbody>
    {{#each lineas}}
    <tr style="page-break-inside:avoid;border-bottom:1px solid #e2e8f0">
      <td style="padding:4px;font-family:monospace">{{ codigo }}</td>
      <td style="padding:4px">{{ descripcion }}</td>
      <td style="padding:4px;text-align:center">{{ tipo }}</td>
      <td style="padding:4px;text-align:right;font-family:monospace">{{#if monto_ingreso}}{{ formatMoney monto_ingreso }}{{else}}—{{/if}}</td>
      <td style="padding:4px;text-align:right;font-family:monospace">{{#if monto_deduccion}}{{ formatMoney monto_deduccion }}{{else}}—{{/if}}</td>
    </tr>
    {{/each}}
  </tbody>
  <tfoot>
    <tr style="border-top:2px solid #0e7490;background:#ecfeff">
      <td colspan="3" style="padding:6px 4px;font-weight:700">Totales · {{ extra.moneda_label }}</td>
      <td style="padding:6px 4px;text-align:right;font-family:monospace;font-weight:700">{{ formatMoney totales.total_ingresos }}</td>
      <td style="padding:6px 4px;text-align:right;font-family:monospace;font-weight:700">{{ formatMoney totales.total_deducciones }}</td>
    </tr>
  </tfoot>
</table>
`

const resumenNeto = `
<div style="margin-top:10px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font-size:10px">
  <div style="padding:8px;background:#f1f5f9;border-radius:6px"><div style="color:#64748b">Salario base</div><div style="font-weight:700;font-family:monospace">{{ extra.moneda_label }} {{ formatMoney totales.salario_base }}</div></div>
  <div style="padding:8px;background:#ecfdf5;border-radius:6px"><div style="color:#64748b">Ingresos</div><div style="font-weight:700;font-family:monospace">{{ extra.moneda_label }} {{ formatMoney totales.total_ingresos }}</div></div>
  <div style="padding:8px;background:#fef2f2;border-radius:6px"><div style="color:#64748b">Deducciones</div><div style="font-weight:700;font-family:monospace">{{ extra.moneda_label }} {{ formatMoney totales.total_deducciones }}</div></div>
  <div style="padding:8px;background:#0e7490;color:#fff;border-radius:6px"><div>Neto a pagar</div><div style="font-weight:800;font-family:monospace;font-size:14px">{{ extra.moneda_label }} {{ formatMoney totales.total }}</div></div>
</div>
`

export const volantePagoDefault: any = {
  content: [
    { type: 'EncabezadoFactura', props: {
      id: 'encab', showLogo: true, colorPrimario: '#0e7490',
      showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 15,
      docBg: '#0e7490', docColor: '#ffffff', showNcf: false, showImpresion: true,
    } },
    { type: 'TextoLibre', props: {
      id: 'empleado',
      html: '<div style="margin-top:8px;padding:10px;background:#ecfeff;border-left:3px solid #0e7490"><b>Empleado:</b> {{ cliente.no }} — {{ cliente.nombre }}<br/><b>Cédula:</b> {{ cliente.cedula }} &nbsp; <b>NSS:</b> {{ default cliente.nss "—" }}<br/><b>Cargo:</b> {{ default cliente.cargo "—" }} &nbsp; <b>Depto:</b> {{ default cliente.depto "—" }}<br/><b>Nómina:</b> {{ doc.nomina }} — {{ doc.detalle }} &nbsp; <b>Período:</b> {{ doc.periodo }}<br/><b>Fecha:</b> {{ formatDate doc.fecha }} → {{ formatDate doc.fecha_venc }}</div>',
      fontSize: 10, textAlign: 'left',
    } },
    { type: 'TextoLibre', props: { id: 'tabla', html: tablaConceptos, fontSize: 9, textAlign: 'left' } },
    { type: 'TextoLibre', props: { id: 'neto', html: resumenNeto, fontSize: 10, textAlign: 'left' } },
    { type: 'NotaDetalle', props: { id: 'nota', titulo: 'Observaciones:', mostrarSiVacio: false } },
    { type: 'Firmas', props: { id: 'fi', cantidad: 2, labels: 'Recibí conforme|Pagador', lineWidth: 80 } },
    { type: 'FooterEmpresa', props: {
      id: 'fo', texto: '{{ cia.razon_social }} | RNC {{ cia.rnc }}',
      showPaginacion: true, showFechaGeneracion: true, color: '#777777',
    } },
  ],
  root: { props: {} }, zones: {},
}
