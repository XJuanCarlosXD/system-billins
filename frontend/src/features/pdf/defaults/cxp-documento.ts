// Plantilla CxP universal — replica el layout legado Rcxp207 manteniendo
// COHERENCIA VISUAL con la plantilla cxc-documento (mismo estilo de header,
// tablas y firmas).
//
// Sirve para FP (Factura Proveedor), AC/AD (Ajuste C/D), BD/BC (Balance),
// NC/ND (Nota C/D), SO (Solicitud Cheque). El título y el texto
// "Acreditado/Debitado" cambian con doc.tipo_label y doc.acreditado_debitado.
//
// Estructura:
//   1. Header: Logo + empresa | TÍTULO DOC + No-DGI + Fecha (estilo CxC)
//   2. Tabla Proveedor (PROVEEDOR NO. / NOMBRE / DIRECCION / TEL / RNC)
//   3. "Hemos Acreditado/Debitado a su Cuenta" + monto letras + Por concepto
//   4. Valor Recibido + Saldo (tabla horizontal)
//   5. Tabla Documento(s) Afectado(s) (Componente/Documento/Fecha/Monto/Saldo)
//   6. Tabla Distribución Contable (Componente/Cuenta/Descripción/Débito/Crédito)
//   7. Firmas (Hecho por / Autorizado por [+ Recibido Conforme si D])
export const cxpDocumentoDefault: any = {
  content: [
    // ── Watermark ANULADA
    {
      type: 'WatermarkAnulada',
      props: { id: 'wm', texto: 'ANULADA', opacity: 0.18, angle: -30, color: '#dc2626' },
    },

    // ── 1. Encabezado: empresa izq + título doc der (igual a CxC)
    {
      type: 'TextoLibre',
      props: {
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
      <div style="font-size:9px;margin-top:6px">Fecha {{default doc.fecha_larga doc.fecha}}</div>
      {{#if doc.ncf_dgi}}<div style="font-size:9px;margin-top:2px"><b>NCF:</b> {{doc.ncf_dgi}}</div>{{/if}}
      {{#if extra.ncfs_afectados.length}}<div style="font-size:9px;margin-top:2px"><b>NCF Afectado:</b> {{#each extra.ncfs_afectados}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}</div>{{/if}}
      <div style="font-size:8px;color:#666;font-style:italic;margin-top:4px">{{default doc.reporte_codigo "Rcxp207"}}</div>
    </td>
  </tr>
</table>`,
        fontSize: 10, textAlign: 'left',
      },
    },

    // ── 2. Tabla Proveedor (mismo estilo que tabla Cliente de CxC)
    {
      type: 'TextoLibre',
      props: {
        id: 'proveedor-tabla',
        html: `
<table style="width:100%;border-collapse:collapse;border-top:1px solid #333;border-bottom:1px solid #333;font-size:9px;margin-bottom:6px">
  <tr style="border-bottom:1px solid #ccc">
    <td style="padding:3px 6px;width:90px;font-weight:bold;border-right:1px solid #ccc">PROVEEDOR NO.</td>
    <td style="padding:3px 6px">{{proveedor.no}}</td>
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
  <tr>
    <td style="padding:3px 6px;font-weight:bold;border-right:1px solid #ccc">TELEFONO</td>
    <td style="padding:3px 6px" colspan="2">{{default proveedor.telefono "—"}}</td>
  </tr>
</table>`,
        fontSize: 9, textAlign: 'left',
      },
    },

    // ── 3. "Hemos Acreditado/Debitado" + monto en letras + Por concepto
    {
      type: 'TextoLibre',
      props: {
        id: 'mensaje',
        html: `
<div style="margin:8px 0">
  <div style="font-weight:bold;font-size:11px">Hemos {{doc.acreditado_debitado}} a su Cuenta</div>
  <div style="font-size:9px;margin-top:2px">La Suma de: {{upper totales.monto_letras}}</div>
  <div style="font-size:10px;margin-top:8px"><b>Por Concepto:</b> {{default doc.detalle ""}}</div>
</div>`,
        fontSize: 10, textAlign: 'left',
      },
    },

    // ── 4. Valor + Saldo (tabla horizontal estilo CxC)
    {
      type: 'TextoLibre',
      props: {
        id: 'valores',
        html: `
<table style="width:100%;font-size:10px;margin-top:8px">
  <tr>
    <td style="width:30%"><b>Valor RD$</b></td>
    <td style="width:25%;text-align:right">{{formatMoney totales.total}}</td>
    <td style="width:20%"><b>Saldo</b></td>
    <td style="width:25%;text-align:right">{{formatMoney extra.saldo}}</td>
  </tr>
</table>`,
        fontSize: 10, textAlign: 'left',
      },
    },

    // ── 5. Tabla Documentos Afectados (TCXP_REFEDOCU) — estilo CxC
    {
      type: 'TextoLibre',
      props: {
        id: 'docs-afectados',
        html: `
{{#if extra.documentos_afectados.length}}
<div style="margin-top:6px;font-weight:bold;font-size:9px">Documento(s) Afectado(s)</div>
<table style="width:100%;border-collapse:collapse;font-size:9px;margin-top:2px">
  <thead>
    <tr style="border-bottom:1px solid #333;font-weight:bold">
      <td style="padding:3px 4px;width:80px">Componente</td>
      <td style="padding:3px 4px">Documento</td>
      <td style="padding:3px 4px;width:90px">Fecha</td>
      <td style="padding:3px 4px;text-align:right;width:100px">Monto</td>
      <td style="padding:3px 4px;text-align:right;width:100px">Saldo</td>
    </tr>
  </thead>
  <tbody>
    {{#each extra.documentos_afectados}}
    <tr>
      <td style="padding:3px 4px">{{this.componente}}</td>
      <td style="padding:3px 4px">{{this.numero_display}}</td>
      <td style="padding:3px 4px">{{formatDate this.fecha}}</td>
      <td style="padding:3px 4px;text-align:right">{{formatMoney this.monto}}</td>
      <td style="padding:3px 4px;text-align:right">{{formatMoney this.saldo}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>
{{/if}}`,
        fontSize: 9, textAlign: 'left',
      },
    },

    // ── 6. Tabla Distribución Contable (TCXP_DCDOCU) — estilo CxC
    {
      type: 'TextoLibre',
      props: {
        id: 'dist-contable',
        html: `
<table style="width:100%;border-collapse:collapse;font-size:9px;margin-top:10px">
  <thead>
    <tr style="border-top:1px solid #333;border-bottom:1px solid #333;font-weight:bold">
      <td style="padding:3px 4px;width:80px">Componente</td>
      <td style="padding:3px 4px;width:90px">Cuenta</td>
      <td style="padding:3px 4px">Descripción</td>
      <td style="padding:3px 4px;text-align:right;width:100px">Débito</td>
      <td style="padding:3px 4px;text-align:right;width:100px">Crédito</td>
    </tr>
  </thead>
  <tbody>
    {{#each extra.dist_contable}}
    <tr>
      <td style="padding:3px 4px">{{this.componente}}</td>
      <td style="padding:3px 4px;font-family:monospace">{{this.cuenta}}</td>
      <td style="padding:3px 4px">{{upper this.descripcion}}</td>
      <td style="padding:3px 4px;text-align:right">{{formatMoney this.debito}}</td>
      <td style="padding:3px 4px;text-align:right">{{formatMoney this.credito}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>`,
        fontSize: 9, textAlign: 'left',
      },
    },

    { type: 'Spacer', props: { id: 'sp', height: 24 } },

    // ── 7. Firmas (estilo CxC: border-top sólido) — 3a firma cuando D
    {
      type: 'TextoLibre',
      props: {
        id: 'firmas',
        html: `
<table style="width:100%;margin-top:20px">
  {{#if extra.mostrar_recibido_conforme}}
  <tr>
    <td style="border-top:1px solid #000;width:30%;padding-top:4px;font-size:9px">
      Hecho por {{default doc.hecho_por ""}}
    </td>
    <td style="width:5%"></td>
    <td style="border-top:1px solid #000;width:30%;padding-top:4px;font-size:9px;text-align:center">
      Autorizado por
    </td>
    <td style="width:5%"></td>
    <td style="border-top:1px solid #000;width:30%;padding-top:4px;font-size:9px;text-align:center">
      Recibido Conforme
    </td>
  </tr>
  {{else}}
  <tr>
    <td style="border-top:1px solid #000;width:45%;padding-top:4px;font-size:9px">
      Hecho por {{default doc.hecho_por ""}}
    </td>
    <td style="width:10%"></td>
    <td style="border-top:1px solid #000;width:45%;padding-top:4px;font-size:9px;text-align:center">
      Autorizado por
    </td>
  </tr>
  {{/if}}
</table>`,
        fontSize: 9, textAlign: 'left',
      },
    },
  ],
  root: { props: {} },
  zones: {},
}
