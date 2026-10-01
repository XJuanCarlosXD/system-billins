// Representacion Impresa (RI) de un e-CF -- Fase 5 de la Postulacion 81443
// de certificacion DGII. Replica el estilo fino "cxp-documento" (ver skill
// `sigaft-pdf-simple-design`) y agrega el bloque QRCode alimentado por la
// URL que arma server-side `apps/fe/representacion_impresa.armar_qr_url`.
//
// Datos esperados en el payload (ver endpoint
// GET /api/fe/documentos/<e_ncf>/representacion-impresa/print-data/):
//   { cia, doc, cliente, lineas, totales,
//     ecf: { e_ncf, tipo_ecf, ambiente, qr_url, codigo_seguridad,
//            fecha_firma } }
export const ecfRepresentacionImpresaDefault: any = {
  content: [
    // ── Watermark ANULADA (si el e-CF original fue anulado)
    {
      type: 'WatermarkAnulada',
      props: {
        id: 'wm', texto: 'ANULADA', opacity: 0.18, angle: -30,
        color: '#dc2626',
      },
    },

    // ── 1. Encabezado: empresa izq + tipo e-CF + e-NCF + fecha + QR der
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
      <div style="font-size:12px;font-weight:bold">{{upper doc.tipo_label}}</div>
      <div style="font-size:9px;margin-top:4px"><b>e-NCF:</b> {{ecf.e_ncf}}</div>
      {{#if doc.numero_display}}<div style="font-size:9px"><b>Doc:</b> {{doc.numero_display}}</div>{{/if}}
      <div style="font-size:9px">Fecha {{formatDate doc.fecha}}</div>
      {{#if ecf.fecha_firma}}<div style="font-size:8px;color:#666">Firma: {{ecf.fecha_firma}}</div>{{/if}}
    </td>
  </tr>
</table>`,
        fontSize: 10, textAlign: 'left',
      },
    },

    // ── 2. Tabla Cliente (misma forma que cxp-documento)
    {
      type: 'TextoLibre',
      props: {
        id: 'cliente-tabla',
        html: `
{{#if cliente.nombre}}
<table style="width:100%;border-collapse:collapse;border-top:1px solid #333;border-bottom:1px solid #333;font-size:9px;margin-bottom:6px">
  <tr style="border-bottom:1px solid #ccc">
    <td style="padding:3px 6px;width:90px;font-weight:bold;border-right:1px solid #ccc">CLIENTE</td>
    <td style="padding:3px 6px">{{cliente.nombre}}</td>
    <td style="padding:3px 6px;text-align:right">{{#if cliente.rnc}}RNC: {{cliente.rnc}}{{/if}}</td>
  </tr>
  {{#if cliente.direccion}}
  <tr style="border-bottom:1px solid #ccc">
    <td style="padding:3px 6px;font-weight:bold;border-right:1px solid #ccc">DIRECCION</td>
    <td style="padding:3px 6px" colspan="2">{{cliente.direccion}}</td>
  </tr>
  {{/if}}
  {{#if cliente.telefono}}
  <tr>
    <td style="padding:3px 6px;font-weight:bold;border-right:1px solid #ccc">TELEFONO</td>
    <td style="padding:3px 6px" colspan="2">{{cliente.telefono}}</td>
  </tr>
  {{/if}}
</table>
{{/if}}`,
        fontSize: 9, textAlign: 'left',
      },
    },

    // ── 3. Tabla de lineas (si hay) -- estilo fino, borde fino, sin barra
    {
      type: 'TextoLibre',
      props: {
        id: 'lineas',
        html: `
{{#if lineas.length}}
<table style="width:100%;border-collapse:collapse;font-size:9px;margin-top:4px">
  <thead>
    <tr style="border-top:1px solid #333;border-bottom:1px solid #333;font-weight:bold">
      <td style="padding:3px 4px;width:70px">Codigo</td>
      <td style="padding:3px 4px">Descripcion</td>
      <td style="padding:3px 4px;text-align:right;width:50px">Cant.</td>
      <td style="padding:3px 4px;text-align:right;width:80px">Precio</td>
      <td style="padding:3px 4px;text-align:right;width:80px">ITBIS</td>
      <td style="padding:3px 4px;text-align:right;width:90px">Total</td>
    </tr>
  </thead>
  <tbody>
    {{#each lineas}}
    <tr style="border-bottom:1px solid #ccc">
      <td style="padding:3px 4px">{{this.codigo}}</td>
      <td style="padding:3px 4px">{{this.descripcion}}</td>
      <td style="padding:3px 4px;text-align:right">{{this.cantidad}}</td>
      <td style="padding:3px 4px;text-align:right">{{formatMoney this.precio}}</td>
      <td style="padding:3px 4px;text-align:right">{{formatMoney this.itbis}}</td>
      <td style="padding:3px 4px;text-align:right">{{formatMoney this.total}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>
{{/if}}`,
        fontSize: 9, textAlign: 'left',
      },
    },

    // ── 4. Totales compactos (estilo cxp-documento)
    {
      type: 'TextoLibre',
      props: {
        id: 'totales',
        html: `
<table style="width:100%;border-collapse:collapse;margin-top:6px">
  <tr>
    <td style="width:60%"></td>
    <td style="width:40%">
      <table style="width:100%;border-collapse:collapse;font-size:9px">
        <tr><td style="padding:3px 6px">Subtotal</td><td style="padding:3px 6px;text-align:right">{{formatMoney totales.subtotal}}</td></tr>
        {{#if totales.descuento}}<tr><td style="padding:3px 6px">Descuento</td><td style="padding:3px 6px;text-align:right">{{formatMoney totales.descuento}}</td></tr>{{/if}}
        <tr><td style="padding:3px 6px">ITBIS</td><td style="padding:3px 6px;text-align:right">{{formatMoney totales.itbis}}</td></tr>
        {{#if totales.propina}}<tr><td style="padding:3px 6px">Propina</td><td style="padding:3px 6px;text-align:right">{{formatMoney totales.propina}}</td></tr>{{/if}}
        <tr style="border-top:1px solid #333">
          <td style="padding:3px 6px;font-weight:bold">TOTAL RD$</td>
          <td style="padding:3px 6px;text-align:right;font-weight:bold">{{formatMoney totales.total}}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>`,
        fontSize: 9, textAlign: 'left',
      },
    },

    // ── 5. Bloque de validacion fiscal (QR + codigo seguridad + leyenda)
    //      Lo que la DGII exige mostrar impreso en una RI (Formato-e-CF-
    //      V1.0.pdf). El QR codifica la URL que arma el backend.
    {
      type: 'TextoLibre',
      props: {
        id: 'fiscal-leyenda',
        html: `
<div style="margin-top:14px;padding-top:6px;border-top:1px solid #333;font-size:8px;color:#444;text-align:center">
  Representacion Impresa de la Factura Electronica.
  Verifique la validez en <b>{{ecf.qr_url}}</b>
</div>
<table style="width:100%;margin-top:4px">
  <tr>
    <td style="vertical-align:top;width:50%;font-size:9px">
      <div><b>e-NCF:</b> {{ecf.e_ncf}}</div>
      <div><b>Tipo:</b> {{ecf.tipo_ecf}} ({{doc.tipo_label}})</div>
      <div><b>Codigo Seguridad:</b> {{ecf.codigo_seguridad}}</div>
      <div><b>Ambiente:</b> {{ecf.ambiente}}</div>
      {{#if ecf.fecha_firma}}<div><b>Fecha Firma:</b> {{ecf.fecha_firma}}</div>{{/if}}
    </td>
    <td style="vertical-align:top;width:50%">
    </td>
  </tr>
</table>`,
        fontSize: 9, textAlign: 'left',
      },
    },

    // QRCode: el bloque es dinamico y lee el contenido via Handlebars,
    // asi que la URL confirmada por el backend viaja intacta. size 140 =
    // version 8 aprox del QR (Descripcion-Tecnica-Servicios-DGII.pdf).
    {
      type: 'QRCode',
      props: {
        id: 'qr', contenido: '{{ecf.qr_url}}', size: 140, align: 'right',
      },
    },
  ],
  root: { props: {} },
  zones: {},
}
