// Plantilla CXC universal — replica EXACTAMENTE el layout legado SIGAFT.
// Sirve para RI (Recibo de Ingreso), NC (Nota de Crédito), ND (Nota de Débito),
// CD (Cheque Devuelto), AC/AD (Ajustes), DV (Devolución), AF (Anulación), BC/BI.
//
// Estructura legacy (validada contra recibo de ingreso.pdf / nota_de_credito.pdf /
// nota_debito.pdf / cheque_devuelto.pdf):
//   1. Header: Logo + Empresa | Título DINÁMICO + No-DGI + Fecha
//   2. Tabla Cliente (Cliente No, Nombre, Dirección, Vendedor, Contacto)
//   3. "Hemos {{Acreditado|Debitado}} a su Cuenta"
//   4. La Suma de: <monto en letras>
//   5. Por Concepto: <detalle>
//   6. Valor Recibido RD$ | Total Aplicado
//   7. Tabla Documentos Afectados (No., Saldo, ITBIS Reten., ISR Reten., Valor Apl., NCF)
//   8. Tabla Distribución Contable (Cuenta, Descripción, Débito, Crédito)
//   9. Hecho por <usuario> | Autorizado por
export const cxcDocumentoDefault: any = {
  content: [
    // ── Watermark ANULADA
    {
      type: 'WatermarkAnulada',
      props: {
        id: 'wm', texto: 'ANULADA', opacity: 0.18, angle: -30, color: '#dc2626',
      },
    },

    // ── 1. Encabezado: empresa izq + título doc der
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
      <div style="font-size:9px;margin-top:6px">Fecha {{formatDate doc.fecha}}</div>
    </td>
  </tr>
</table>`,
        fontSize: 10, textAlign: 'left',
      },
    },

    // ── 2. Tabla Cliente (estilo legacy con borders simples)
    {
      type: 'TextoLibre',
      props: {
        id: 'cliente-tabla',
        html: `
<table style="width:100%;border-collapse:collapse;border-top:1px solid #333;border-bottom:1px solid #333;font-size:9px;margin-bottom:6px">
  <tr style="border-bottom:1px solid #ccc">
    <td style="padding:3px 6px;width:90px;font-weight:bold;border-right:1px solid #ccc">CLIENTE NO.</td>
    <td style="padding:3px 6px">{{cliente.no}}</td>
    <td style="padding:3px 6px;text-align:right">{{#if cliente.rnc}}RNC: {{cliente.rnc}}{{/if}}</td>
  </tr>
  <tr style="border-bottom:1px solid #ccc">
    <td style="padding:3px 6px;font-weight:bold;border-right:1px solid #ccc">NOMBRE</td>
    <td style="padding:3px 6px" colspan="2">{{cliente.nombre}}</td>
  </tr>
  <tr style="border-bottom:1px solid #ccc">
    <td style="padding:3px 6px;font-weight:bold;border-right:1px solid #ccc">DIRECCION</td>
    <td style="padding:3px 6px" colspan="2">{{default cliente.direccion "—"}}</td>
  </tr>
  <tr style="border-bottom:1px solid #ccc">
    <td style="padding:3px 6px;font-weight:bold;border-right:1px solid #ccc">VENDEDOR</td>
    <td style="padding:3px 6px" colspan="2">{{default doc.vendedor "—"}}</td>
  </tr>
  <tr>
    <td style="padding:3px 6px;font-weight:bold;border-right:1px solid #ccc">CONTACTO</td>
    <td style="padding:3px 6px" colspan="2"></td>
  </tr>
</table>`,
        fontSize: 9, textAlign: 'left',
      },
    },

    // ── 3+4+5. "Hemos Acreditado/Debitado" + monto en letras + Por Concepto
    {
      type: 'TextoLibre',
      props: {
        id: 'mensaje',
        html: `
<div style="margin:8px 0">
  <div style="font-weight:bold;font-size:11px">Hemos {{doc.acreditado_debitado}} a su Cuenta</div>
  <div style="font-size:9px;margin-top:2px">La Suma de: {{upper totales.monto_letras}}</div>
  <div style="font-size:10px;margin-top:8px"><b>Por Concepto:</b> {{doc.detalle}}</div>
</div>`,
        fontSize: 10, textAlign: 'left',
      },
    },

    // ── 6. Valor Recibido + Total Aplicado (+ Pago En Efectivo si RI)
    {
      type: 'TextoLibre',
      props: {
        id: 'valores',
        html: `
<table style="width:100%;font-size:10px;margin-top:8px">
  <tr>
    <td style="width:30%"><b>Valor Recibido RD$</b></td>
    <td style="width:25%;text-align:right">{{formatMoney totales.total}}</td>
    <td style="width:20%"><b>Total Aplicado</b></td>
    <td style="width:15%;text-align:right">{{formatMoney extra.total_aplicado}}</td>
    <td style="width:10%;text-align:right">{{#if (eq doc.tipo "RI")}}Pago En Efectivo{{/if}}</td>
  </tr>
</table>`,
        fontSize: 10, textAlign: 'left',
      },
    },

    // ── 7. Tabla Documentos Afectados (TCXC_REFEDOCU)
    {
      type: 'TextoLibre',
      props: {
        id: 'docs-afectados',
        html: `
{{#if extra.documentos_afectados.length}}
<div style="margin-top:6px;font-weight:bold;font-size:9px">Docu(s) Afectado(s)</div>
<table style="width:100%;border-collapse:collapse;font-size:9px;margin-top:2px">
  <thead>
    <tr style="border-bottom:1px solid #333;font-weight:bold">
      <td style="padding:3px 4px">No.</td>
      <td style="padding:3px 4px;text-align:right">Saldo</td>
      <td style="padding:3px 4px;text-align:right">ITBIS Retenido</td>
      <td style="padding:3px 4px;text-align:right">ISR Retenido</td>
      <td style="padding:3px 4px;text-align:right">Valor Aplicado</td>
      <td style="padding:3px 4px;text-align:right">Comprobante Fiscal</td>
    </tr>
  </thead>
  <tbody>
    {{#each extra.documentos_afectados}}
    <tr>
      <td style="padding:3px 4px">{{this.numero_display}}</td>
      <td style="padding:3px 4px;text-align:right">{{formatMoney this.saldo}}</td>
      <td style="padding:3px 4px;text-align:right">{{formatMoney this.itbis_retenido}}</td>
      <td style="padding:3px 4px;text-align:right">{{formatMoney this.isr_retenido}}</td>
      <td style="padding:3px 4px;text-align:right">{{formatMoney this.valor_aplicado}}</td>
      <td style="padding:3px 4px;text-align:right">{{this.ncf_dgi}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>
{{/if}}`,
        fontSize: 9, textAlign: 'left',
      },
    },

    { type: 'Spacer', props: { id: 'sp', height: 24 } },

    // ── 9. Firmas
    {
      type: 'TextoLibre',
      props: {
        id: 'firmas',
        html: `
<table style="width:100%;margin-top:20px">
  <tr>
    <td style="border-top:1px solid #000;width:45%;padding-top:4px;font-size:9px">
      Hecho por {{default doc.hecho_por ""}}
    </td>
    <td style="width:10%"></td>
    <td style="border-top:1px solid #000;width:45%;padding-top:4px;font-size:9px;text-align:center">
      Autorizado por
    </td>
  </tr>
</table>`,
        fontSize: 9, textAlign: 'left',
      },
    },
  ],
  root: { props: {} },
  zones: {},
}
