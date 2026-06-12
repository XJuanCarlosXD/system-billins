// Plantilla CxP universal — replica el layout legado Rcxp207.
// Sirve para FP (Factura Proveedores), AC/AD (Ajuste C/D), BD (Balance Débito),
// NC/ND (Nota C/D), SO (Solicitud Cheque) y demás. El título y el texto
// "Acreditado/Debitado" cambian con doc.tipo_label y doc.acreditado_debitado.
//
// Estructura legacy (validada contra impresion_doc_FP/AC/AD legacy PDFs):
//   1. Header: Empresa izq | Doc. No. + Rcxp207 + Fecha (en español largo) der
//   2. Proveedor: código + nombre + dirección + tel + RNC
//   3. Numeración FP-XXXX a la izquierda
//   4. "Hemos Acreditado/Debitado a su Cuenta"
//   5. La Suma de: <monto en letras>
//   6. Por concepto: <detalle>
//   7. Valor RD$ ********<monto>
//   8. Tabla Documento(s) Afectado(s) (Documento, Fecha, Monto, Saldo)
//   9. Tabla Componente | Cuenta | Descripción | Débito | Crédito
//  10. Firmas: Hecho por | Autorizado por  [| Recibido Conforme cuando tipo_movi=D]
export const cxpDocumentoDefault: any = {
  content: [
    {
      type: 'WatermarkAnulada',
      props: { id: 'wm', texto: 'ANULADA', opacity: 0.18, angle: -30, color: '#dc2626' },
    },

    // ── 1. Header empresa + doc info
    {
      type: 'TextoLibre',
      props: {
        id: 'header',
        html: `
<table style="width:100%;border-collapse:collapse;margin-bottom:10px">
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
    <td style="vertical-align:top;font-size:10px">
      <div><b>Doc. No.:</b> {{doc.numero_display}}</div>
      <div style="font-style:italic;color:#444">{{default doc.reporte_codigo "Rcxp207"}}</div>
      <div><b>Fecha:</b> {{doc.fecha_larga}}</div>
    </td>
  </tr>
</table>`,
        fontSize: 10, textAlign: 'left',
      },
    },

    // ── 2. Proveedor
    {
      type: 'TextoLibre',
      props: {
        id: 'proveedor',
        html: `
<table style="width:100%;font-size:10px;border-top:1px solid #aaa;border-bottom:1px solid #aaa;padding:4px 0;margin-bottom:6px">
  <tr>
    <td style="width:90px;font-weight:bold;padding:2px 4px;vertical-align:top">Proveedor:</td>
    <td style="padding:2px 4px;vertical-align:top">
      <div>{{proveedor.nombre}}</div>
      <div>{{default proveedor.direccion ""}}</div>
      <div>{{default proveedor.telefono ""}}</div>
      <div>RNC: {{default proveedor.rnc ""}}</div>
    </td>
    <td style="width:120px;padding:2px 4px;vertical-align:top;text-align:right">
      <div>{{proveedor.no}}</div>
      <div style="margin-top:18px;font-weight:bold">{{doc.numero_display}}</div>
    </td>
  </tr>
</table>`,
        fontSize: 10, textAlign: 'left',
      },
    },

    // ── 3+4+5. "Hemos Acreditado/Debitado" + monto en letras + Por concepto
    {
      type: 'TextoLibre',
      props: {
        id: 'mensaje',
        html: `
<div style="margin:8px 0">
  <div style="font-size:10px"><b>Hemos {{doc.acreditado_debitado}} a su Cuenta</b></div>
  <div style="font-size:10px;margin-top:4px"><b>La Suma de:</b> {{upper totales.monto_letras}}</div>
  <div style="font-size:10px;margin-top:6px"><b>Por concepto:</b> {{default doc.detalle ""}}</div>
</div>`,
        fontSize: 10, textAlign: 'left',
      },
    },

    // ── 6. Valor RD$ + tabla de documentos afectados
    {
      type: 'TextoLibre',
      props: {
        id: 'valor-y-afectados',
        html: `
<div style="margin-top:8px;font-size:10px;font-family:monospace"><b>Valor RD$</b> {{totales.total_padded}}</div>
<table style="width:100%;border-collapse:collapse;font-size:9px;margin-top:8px">
  <thead>
    <tr style="font-weight:bold">
      <td style="padding:3px 4px;width:130px"></td>
      <td style="padding:3px 4px">Documento</td>
      <td style="padding:3px 4px;width:90px">Fecha</td>
      <td style="padding:3px 4px;text-align:right;width:110px">Monto</td>
      <td style="padding:3px 4px;text-align:right;width:110px">Saldo</td>
    </tr>
    <tr>
      <td style="padding:3px 4px;font-weight:bold">Documento(s) Afectado(s)=&gt;</td>
      <td colspan="4"></td>
    </tr>
  </thead>
  <tbody>
    {{#each extra.documentos_afectados}}
    <tr>
      <td style="padding:2px 4px"></td>
      <td style="padding:2px 4px">{{this.numero_display}}</td>
      <td style="padding:2px 4px">{{formatDate this.fecha}}</td>
      <td style="padding:2px 4px;text-align:right">{{formatMoney this.monto}}</td>
      <td style="padding:2px 4px;text-align:right">{{formatMoney this.saldo}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>`,
        fontSize: 10, textAlign: 'left',
      },
    },

    // ── 7. Distribución contable (Componente | Cuenta | Descripción | Débito | Crédito)
    {
      type: 'TextoLibre',
      props: {
        id: 'dist-contable',
        html: `
<table style="width:100%;border-collapse:collapse;font-size:9px;margin-top:10px">
  <thead>
    <tr style="border-top:1px solid #333;border-bottom:1px solid #333;font-weight:bold">
      <td style="padding:3px 4px;width:80px">Componente</td>
      <td style="padding:3px 4px;width:80px">Cuenta</td>
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

    { type: 'Spacer', props: { id: 'sp', height: 20 } },

    // ── 8. Firmas (3 cuando tipo_movi=D)
    {
      type: 'TextoLibre',
      props: {
        id: 'firmas',
        html: `
<table style="width:100%;margin-top:16px;font-size:10px">
  <tr>
    <td style="width:33%;padding-top:4px">Hecho por:_____________</td>
    <td style="width:33%;padding-top:4px">Autorizado por:______________</td>
    <td style="width:33%;padding-top:4px">{{#if extra.mostrar_recibido_conforme}}Recibido Conforme:_____________{{/if}}</td>
  </tr>
</table>`,
        fontSize: 10, textAlign: 'left',
      },
    },
  ],
  root: { props: {} },
  zones: {},
}
