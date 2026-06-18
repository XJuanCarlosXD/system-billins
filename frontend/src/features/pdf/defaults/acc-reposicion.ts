// Plantilla ACC — Reposición de Caja Chica (Facc204 / Racc303).
const tablaDocs = `
<table style="width:100%;border-collapse:collapse;font-size:9px;margin-top:8px">
  <thead>
    <tr style="background:#0e7490;color:#fff">
      <th style="padding:6px 4px;text-align:left">No. Doc</th>
      <th style="padding:6px 4px;text-align:left">Fecha</th>
      <th style="padding:6px 4px;text-align:left">Beneficiario</th>
      <th style="padding:6px 4px;text-align:left">Tipo gasto</th>
      <th style="padding:6px 4px;text-align:left">NCF</th>
      <th style="padding:6px 4px;text-align:right">Valor</th>
    </tr>
  </thead>
  <tbody>
    {{#each lineas}}
    <tr style="page-break-inside:avoid;border-bottom:1px solid #e2e8f0">
      <td style="padding:4px;font-family:monospace">ACC-{{ no_docu }}</td>
      <td style="padding:4px">{{ fecha_docu }}</td>
      <td style="padding:4px">{{ nombre_bene }}</td>
      <td style="padding:4px">{{ desc_gasto }}</td>
      <td style="padding:4px;font-family:monospace">{{#if ncf}}{{ ncf }}{{else}}—{{/if}}</td>
      <td style="padding:4px;text-align:right;font-family:monospace">{{ formatMoney precio }}</td>
    </tr>
    {{/each}}
  </tbody>
  <tfoot>
    <tr style="border-top:2px solid #0e7490;background:#ecfeff">
      <td colspan="5" style="padding:6px 4px;font-weight:700">{{ totales.cantidad_docs }} documento(s)</td>
      <td style="padding:6px 4px;text-align:right;font-family:monospace;font-weight:800;color:#0e7490">RD$ {{ formatMoney totales.total }}</td>
    </tr>
  </tfoot>
</table>
`

const datosReposicion = `
<div style="margin-top:10px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:10px">
  <div style="padding:8px;background:#f1f5f9;border-radius:6px"><div style="color:#64748b">Cuenta banco</div><div style="font-weight:600;font-family:monospace">{{ default extra.cuenta_banco "—" }}</div></div>
  <div style="padding:8px;background:#f1f5f9;border-radius:6px"><div style="color:#64748b">No. cheque</div><div style="font-weight:600;font-family:monospace">{{ default extra.no_cheque "—" }}</div></div>
  <div style="padding:8px;background:#f1f5f9;border-radius:6px"><div style="color:#64748b">Doc CHC</div><div style="font-weight:600;font-family:monospace">{{ default extra.tipo_docu_chc "—" }}-{{ default extra.no_docu_chc "—" }}</div></div>
  <div style="padding:8px;background:#ecfdf5;border-radius:6px"><div style="color:#64748b">Efectivo</div><div style="font-weight:600;font-family:monospace">RD$ {{ formatMoney totales.efectivo }}</div></div>
  <div style="padding:8px;background:#fef3c7;border-radius:6px"><div style="color:#64748b">Comprob. proveedor</div><div style="font-weight:600;font-family:monospace">RD$ {{ formatMoney totales.valor_compro_prov }}</div></div>
  <div style="padding:8px;background:#0e7490;color:#fff;border-radius:6px"><div>Total reposición</div><div style="font-weight:800;font-family:monospace;font-size:14px">RD$ {{ formatMoney totales.total }}</div></div>
</div>
`

export const accReposicionDefault: any = {
  content: [
    { type: 'WatermarkAnulada', props: { id: 'wm', texto: 'ANULADA', opacity: 0.18, angle: -30, color: '#dc2626' } },
    { type: 'EncabezadoFactura', props: {
      id: 'encab', showLogo: true, colorPrimario: '#0e7490',
      showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 15,
      docBg: '#0e7490', docColor: '#ffffff', showNcf: false, showImpresion: true,
    } },
    { type: 'TextoLibre', props: {
      id: 'intro',
      html: '<div style="margin-top:8px;padding:10px;background:#ecfeff;border-left:3px solid #0e7490"><b>Reposición:</b> {{ doc.numero_display }} &nbsp; <b>Fecha:</b> {{ formatDate doc.fecha }}<br/><b>Caja:</b> {{ cliente.no }} — {{ cliente.nombre }}<br/><b>Usuario:</b> {{ cliente.usuario }} &nbsp; <b>Estado:</b> {{ doc.estado_label }}{{#if doc.ncf_dgi}}<br/><b>NCF proveedor:</b> {{ doc.ncf_dgi }}{{/if}}</div>',
      fontSize: 10, textAlign: 'left',
    } },
    { type: 'TextoLibre', props: { id: 'tabla', html: tablaDocs, fontSize: 9, textAlign: 'left' } },
    { type: 'TextoLibre', props: { id: 'datos', html: datosReposicion, fontSize: 10, textAlign: 'left' } },
    { type: 'NotaDetalle', props: { id: 'nota', titulo: 'Observaciones:', mostrarSiVacio: false } },
    { type: 'Firmas', props: { id: 'fi', cantidad: 3, labels: 'Solicitado por|Autorizado por|Pagado por', lineWidth: 60 } },
    { type: 'FooterEmpresa', props: {
      id: 'fo', texto: '{{ cia.razon_social }} | RNC {{ cia.rnc }}',
      showPaginacion: true, showFechaGeneracion: true, color: '#777777',
    } },
  ],
  root: { props: {} }, zones: {},
}
