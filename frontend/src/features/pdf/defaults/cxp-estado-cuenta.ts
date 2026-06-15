// Plantilla "Estado de Cuenta" CXP — espejo de CxC pero con proveedor.
// Imprime vía /print/cxp-estado-cuenta/<no_proveedor>.
export const cxpEstadoCuentaDefault: any = {
  content: [
    {
      type: 'TextoLibre',
      props: {
        id: 'header',
        html: `
<table style="width:100%;border-collapse:collapse;margin-bottom:8px">
  <tr>
    <td style="vertical-align:top;width:55%">
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
      <div style="font-size:14px;font-weight:bold">ESTADO DE CUENTA</div>
      <div style="font-size:12px;font-weight:bold">— PROVEEDOR —</div>
      <div style="font-size:10px;margin-top:4px">Fecha de corte: {{doc.fecha_corte}}</div>
      <div style="font-size:9px;color:#666">Generado: {{doc.fecha_generacion}}</div>
    </td>
  </tr>
</table>`,
        fontSize: 10, textAlign: 'left',
      },
    },

    {
      type: 'TextoLibre',
      props: {
        id: 'proveedor',
        html: `
<table style="width:100%;border-collapse:collapse;border-top:1px solid #333;border-bottom:1px solid #333;font-size:9px;margin-bottom:8px">
  <tr style="border-bottom:1px solid #ccc">
    <td style="padding:3px 6px;width:100px;font-weight:bold;border-right:1px solid #ccc">PROVEEDOR NO.</td>
    <td style="padding:3px 6px">{{proveedor.no_proveedor}}</td>
    <td style="padding:3px 6px;text-align:right">{{#if proveedor.rnc}}RNC: {{proveedor.rnc}}{{/if}}</td>
  </tr>
  <tr style="border-bottom:1px solid #ccc">
    <td style="padding:3px 6px;font-weight:bold;border-right:1px solid #ccc">NOMBRE</td>
    <td style="padding:3px 6px" colspan="2">{{proveedor.nombre}}</td>
  </tr>
  <tr style="border-bottom:1px solid #ccc">
    <td style="padding:3px 6px;font-weight:bold;border-right:1px solid #ccc">DIRECCION</td>
    <td style="padding:3px 6px" colspan="2">{{default proveedor.direccion "—"}}</td>
  </tr>
  <tr style="border-bottom:1px solid #ccc">
    <td style="padding:3px 6px;font-weight:bold;border-right:1px solid #ccc">TELEFONO</td>
    <td style="padding:3px 6px">{{default proveedor.telefono "—"}}</td>
    <td style="padding:3px 6px;text-align:right">ENCARGADO: {{default proveedor.encargado "—"}}</td>
  </tr>
  <tr>
    <td style="padding:3px 6px;font-weight:bold;border-right:1px solid #ccc">PLAZO PAGO</td>
    <td style="padding:3px 6px" colspan="2">{{proveedor.dias}} días</td>
  </tr>
</table>`,
        fontSize: 9, textAlign: 'left',
      },
    },

    {
      type: 'TextoLibre',
      props: {
        id: 'kpis',
        html: `
<table style="width:100%;border-collapse:collapse;margin-top:6px">
  <tr>
    <td style="padding:4px;text-align:center;border:1px solid #999;background:#e0e7ff">
      <div style="font-size:8px;color:#444">TOTAL A PAGAR</div>
      <div style="font-size:11px;font-weight:bold">RD$ {{formatMoney totales.total_pendiente}}</div>
    </td>
    <td style="padding:4px;text-align:center;border:1px solid #999;background:#dcfce7">
      <div style="font-size:8px;color:#444">AL DÍA (0–30)</div>
      <div style="font-size:11px;font-weight:bold">RD$ {{formatMoney aging.d_0_30}}</div>
    </td>
    <td style="padding:4px;text-align:center;border:1px solid #999;background:#fef9c3">
      <div style="font-size:8px;color:#444">31–60 DÍAS</div>
      <div style="font-size:11px;font-weight:bold">RD$ {{formatMoney aging.d_31_60}}</div>
    </td>
    <td style="padding:4px;text-align:center;border:1px solid #999;background:#ffedd5">
      <div style="font-size:8px;color:#444">61–90 DÍAS</div>
      <div style="font-size:11px;font-weight:bold">RD$ {{formatMoney aging.d_61_90}}</div>
    </td>
    <td style="padding:4px;text-align:center;border:1px solid #999;background:#fee2e2">
      <div style="font-size:8px;color:#444">+90 DÍAS</div>
      <div style="font-size:11px;font-weight:bold">RD$ {{formatMoney aging.d_mas_90}}</div>
    </td>
  </tr>
</table>`,
        fontSize: 9, textAlign: 'left',
      },
    },

    {
      type: 'TextoLibre',
      props: {
        id: 'documentos',
        html: `
<table style="width:100%;border-collapse:collapse;font-size:9px;margin-top:12px">
  <thead>
    <tr style="border-top:1px solid #333;border-bottom:1px solid #333;font-weight:bold">
      <td style="padding:3px 4px;width:90px">Documento</td>
      <td style="padding:3px 4px;width:130px">Tipo</td>
      <td style="padding:3px 4px;width:75px">Fecha</td>
      <td style="padding:3px 4px;text-align:right;width:90px">Valor</td>
      <td style="padding:3px 4px;text-align:right;width:90px">Saldo</td>
      <td style="padding:3px 4px;text-align:right;width:50px">Días</td>
      <td style="padding:3px 4px;width:90px">NCF</td>
      <td style="padding:3px 4px">Detalle</td>
    </tr>
  </thead>
  <tbody>
    {{#each documentos}}
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:3px 4px;font-family:monospace">{{this.numero_display}}</td>
      <td style="padding:3px 4px">{{this.tipo_label}}</td>
      <td style="padding:3px 4px;font-family:monospace">{{this.fecha}}</td>
      <td style="padding:3px 4px;text-align:right">{{formatMoney this.valor}}</td>
      <td style="padding:3px 4px;text-align:right;font-weight:bold">{{formatMoney this.saldo}}</td>
      <td style="padding:3px 4px;text-align:right">{{this.dias_vencido}}</td>
      <td style="padding:3px 4px;font-family:monospace;font-size:8px">{{this.ncf}}</td>
      <td style="padding:3px 4px;font-size:8px">{{this.detalle}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>`,
        fontSize: 9, textAlign: 'left',
      },
    },

    {
      type: 'TextoLibre',
      props: {
        id: 'totales',
        html: `
<table style="width:100%;border-collapse:collapse;border-top:2px solid #333;font-size:10px;margin-top:6px">
  <tr style="font-weight:bold;background:#f4f4f5">
    <td style="padding:4px 6px;text-align:right">Total Débitos:</td>
    <td style="padding:4px 6px;text-align:right;width:120px">RD$ {{formatMoney totales.total_debito}}</td>
    <td style="padding:4px 6px;text-align:right;width:80px">Total Créditos:</td>
    <td style="padding:4px 6px;text-align:right;width:120px;color:#047857">RD$ {{formatMoney totales.total_credito}}</td>
    <td style="padding:4px 6px;text-align:right;width:120px">TOTAL A PAGAR:</td>
    <td style="padding:4px 6px;text-align:right;width:140px;font-size:12px;color:#b91c1c">RD$ {{formatMoney totales.total_pendiente}}</td>
  </tr>
</table>`,
        fontSize: 10, textAlign: 'left',
      },
    },
  ],
  root: { props: {} },
  zones: {},
}
