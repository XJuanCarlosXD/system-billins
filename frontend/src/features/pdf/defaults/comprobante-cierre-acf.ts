// ACF — Comprobante de Cierre Mensual de Activos Fijos.
// Estilo fino CxP: header con raya (sin tarjeta oscura) y cajas planas con
// borde fino en vez de fondos de color. No usa DocumentoSimple porque es un
// comprobante de resumen (sin líneas ni tercero), pero comparte el look.
export const comprobanteCierreAcfDefault: any = {
  content: [
    // ── Header: empresa izq + título/período der (estilo CxP, sin barra)
    { type: 'TextoLibre', props: {
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
            <div style="font-weight:bold;font-size:12px">{{cia.razon_social}}</div>
            <div style="font-size:9px">{{cia.direccion}}</div>
            <div style="font-size:9px">TEL. {{cia.telefono}}</div>
            <div style="font-size:9px">RNC {{cia.rnc}}</div>
          </td>
        </tr>
      </table>
    </td>
    <td style="vertical-align:top;text-align:right">
      <div style="font-size:14px;font-weight:bold">{{#if doc.tipo_label}}{{upper doc.tipo_label}}{{else}}COMPROBANTE DE CIERRE MENSUAL{{/if}}</div>
      {{#if doc.numero_display}}<div style="font-size:14px;font-weight:bold">{{doc.numero_display}}</div>{{/if}}
      <div style="font-size:9px;margin-top:6px">Período {{doc.periodo}}</div>
    </td>
  </tr>
</table>`,
      fontSize: 10, textAlign: 'left',
    } },
    // ── Título del cierre (raya fina, sin fondo de color)
    { type: 'TextoLibre', props: {
      id: 'datos',
      html: '<div style="margin-top:4px;padding:6px 0;border-top:1px solid #333;border-bottom:1px solid #333;text-align:center;font-size:12px"><b>Cierre del período {{ extra.mes_label }} {{ extra.periodo }}</b></div>',
      fontSize: 12, textAlign: 'center',
    } },
    // ── Detalle (tabla con bordes finos, sin fondo)
    { type: 'TextoLibre', props: {
      id: 'detalle',
      html: '<table style="width:100%;border-collapse:collapse;font-size:10px;margin-top:10px"><tr style="border-bottom:1px solid #ccc"><td style="padding:3px 6px"><b>Período cerrado:</b></td><td style="padding:3px 6px;text-align:right">{{ doc.periodo }}</td></tr><tr style="border-bottom:1px solid #ccc"><td style="padding:3px 6px">Activos depreciados:</td><td style="padding:3px 6px;text-align:right">{{ extra.activos_depreciados }}</td></tr><tr style="border-bottom:1px solid #ccc"><td style="padding:3px 6px"><b>Total depreciado en el mes:</b></td><td style="padding:3px 6px;text-align:right"><b>RD$ {{ formatMoney totales.total }}</b></td></tr><tr style="border-bottom:1px solid #ccc"><td style="padding:3px 6px">Fecha y hora del cierre:</td><td style="padding:3px 6px;text-align:right">{{ extra.fecha_cierre }}</td></tr><tr><td style="padding:3px 6px">Usuario que aplicó el cierre:</td><td style="padding:3px 6px;text-align:right">{{ extra.usuario_cierre }}</td></tr></table>',
      fontSize: 10, textAlign: 'left',
    } },
    { type: 'TextoLibre', props: {
      id: 'declaracion',
      html: '<div style="margin-top:14px;font-size:10px">Por la presente se deja constancia del cierre contable del módulo de Activos Fijos correspondiente al período arriba indicado. Posteriores movimientos quedarán registrados en el siguiente período.</div>',
      fontSize: 10, textAlign: 'left',
    } },
    { type: 'Firmas', props: { id: 'fi', cantidad: 2, labels: 'Contabilidad|Aprobado por', lineWidth: 70 } },
    { type: 'FooterEmpresa', props: {
      id: 'fo', texto: '{{ cia.razon_social }} | RNC {{ cia.rnc }}',
      showPaginacion: true, showFechaGeneracion: true, color: '#777777',
    } },
  ],
  root: { props: {} }, zones: {},
}
