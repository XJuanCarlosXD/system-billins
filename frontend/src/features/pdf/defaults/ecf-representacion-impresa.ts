// Representacion Impresa (RI) de un e-CF -- Fase 5 de la Postulacion 81443
// de certificacion DGII. Replica el estilo fino "cxp-documento" (ver skill
// `sigaft-pdf-simple-design`) y agrega el bloque QRCode alimentado por la
// URL que arma server-side `apps/fe/representacion_impresa.armar_qr_url`.
//
// Layout fiscal exigido por DGII (rechazo Fase 5 55va corrida 2026-10-05):
//   - El tipo de comprobante electronico (nombre + codigo) debe ir visible
//     y claro en el encabezado.
//   - El Codigo de Seguridad y la Fecha Hora Firma deben ir DEBAJO del QR.
//
// Datos esperados en el payload (ver endpoint
// GET /api/fe/documentos/<e_ncf>/representacion-impresa/print-data/):
//   { cia, doc, cliente, lineas, totales,
//     ecf: { e_ncf, tipo_ecf, tipo_ecf_nombre, ambiente, qr_url,
//            codigo_seguridad, fecha_firma } }
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

    // ── 1. Encabezado: empresa izq + tipo e-CF (DGII) + e-NCF + fecha der
    //    NO se muestra fecha-hora-firma aqui: DGII exige que vaya debajo
    //    del QR, no en el encabezado.
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
      <div style="font-size:12px;font-weight:bold">{{ecf.tipo_ecf_nombre}}</div>
      <div style="font-size:10px;font-weight:bold;margin-top:2px">Tipo e-CF {{ecf.tipo_ecf}}</div>
      <div style="font-size:9px;margin-top:4px"><b>e-NCF:</b> {{ecf.e_ncf}}</div>
      {{#if doc.numero_display}}<div style="font-size:9px"><b>Doc:</b> {{doc.numero_display}}</div>{{/if}}
      <div style="font-size:9px">Fecha {{formatDate doc.fecha}}</div>
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

    // ── 5a. QR centrado (version 8 aprox, size 160 CSS px). DGII exige
    //      que el Codigo de Seguridad y la Fecha Hora Firma vayan DEBAJO.
    {
      type: 'QRCode',
      props: {
        id: 'qr', contenido: '{{ecf.qr_url}}', size: 160, align: 'center',
      },
    },

    // ── 5b. Debajo del QR: Codigo de Seguridad + Fecha Hora Firma + e-NCF
    //      + leyenda de validez. Centrado para que lea claro bajo el QR.
    {
      type: 'TextoLibre',
      props: {
        id: 'fiscal-bajo-qr',
        html: `
<div style="text-align:center;font-size:10px;margin-top:4px">
  <div><b>Codigo de Seguridad:</b> {{ecf.codigo_seguridad}}</div>
  <div><b>Fecha Hora Firma:</b> {{ecf.fecha_firma}}</div>
</div>
<div style="margin-top:8px;padding-top:4px;border-top:1px solid #333;font-size:8px;color:#444;text-align:center">
  Representacion Impresa de la {{ecf.tipo_ecf_nombre}} (Tipo {{ecf.tipo_ecf}}).
  Verifique la validez en <b>{{ecf.qr_url}}</b>
</div>`,
        fontSize: 9, textAlign: 'center',
      },
    },
  ],
  root: { props: {} },
  zones: {},
}
