// ACF — Comprobante de Compra de Activo Fijo
export const comprobanteCompraAcfDefault: any = {
  content: [
    { type: 'EncabezadoFactura', props: {
      id: 'encab', showLogo: true, colorPrimario: '#155e75',
      showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 15,
      docBg: '#155e75', docColor: '#ffffff', showNcf: false, showImpresion: true,
    } },
    { type: 'TextoLibre', props: {
      id: 'datos',
      html: '<div style="margin-top:8px;padding:10px;background:#ecfeff;border-left:3px solid #155e75"><b>No. Activo:</b> {{ doc.no_activo }}<br/><b>Descripción:</b> {{ doc.descripcion_activo }}<br/><b>Serie / Placa:</b> {{ default doc.serie "—" }} &nbsp; <b>Vida útil:</b> {{ default doc.duracion_ano "—" }} años<br/><b>Departamento:</b> {{ default doc.departamento "—" }} &nbsp; <b>Responsable:</b> {{ default doc.responsable "—" }}<br/><b>Proveedor:</b> {{ default cliente.nombre "—" }}<br/><b>Fecha de Compra:</b> {{ formatDate doc.fecha }} &nbsp; <b>No. Documento:</b> {{ doc.numero_display }}</div>',
      fontSize: 10, textAlign: 'left',
    } },
    { type: 'TextoLibre', props: {
      id: 'valores',
      html: '<div style="margin-top:8px;padding:10px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:4px"><table style="width:100%"><tr><td><b>Valor de Compra:</b></td><td style="text-align:right">RD$ {{ formatMoney totales.total }}</td></tr><tr><td>Cuenta Contable:</td><td style="text-align:right">{{ doc.cuenta_contable }}</td></tr></table></div>',
      fontSize: 10, textAlign: 'left',
    } },
    { type: 'TextoLibre', props: {
      id: 'declaracion',
      html: '<div style="margin-top:12px;font-size:10px">Por la presente se hace constar la incorporación del activo descrito al inventario de activos fijos de la empresa. La depreciación se aplicará mensualmente según la vida útil registrada.</div>',
      fontSize: 10, textAlign: 'left',
    } },
    { type: 'Firmas', props: { id: 'fi', cantidad: 2, labels: 'Recibido por|Autorizado por', lineWidth: 70 } },
    { type: 'FooterEmpresa', props: {
      id: 'fo', texto: '{{ cia.razon_social }} | RNC {{ cia.rnc }}',
      showPaginacion: true, showFechaGeneracion: true, color: '#777777',
    } },
  ],
  root: { props: {} }, zones: {},
}
