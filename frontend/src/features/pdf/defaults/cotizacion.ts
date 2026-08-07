type PdfBlockDefault = {
  type: string
  props: Record<string, unknown>
}

type PdfTemplateDefault = {
  content: PdfBlockDefault[]
  root: { props: Record<string, unknown> }
  zones: Record<string, unknown>
}

// Cotización A4 — bloque reutilizable DocumentoSimple (estilo fino CxP).
// El saludo va en introHtml (arriba) y validez/condiciones en pieHtml (abajo);
// una sola firma "Aprobado por" (firmaDer vacío). Columnas con ITBIS, sin NCF.
export const cotizacionDefault: PdfTemplateDefault = {
  content: [
    {
      type: 'DocumentoSimple',
      props: {
        id: 'doc',
        columnas: 'codigo,descripcion,cantidad,precio,itbis,total',
        firmaIzq: 'Aprobado por',
        firmaDer: '',
        mostrarAlmacen: false,
        montoLetras: true,
        introHtml:
          '<p>Estimado(a) <b>{{ cliente.nombre }}</b>,</p><p>Por la presente cotización le presentamos nuestra mejor oferta para los siguientes productos y/o servicios:</p>',
        pieHtml:
          '<p><b>Validez:</b> 15 días a partir de la fecha de emisión.</p>',
      },
    },
    {
      type: 'FooterEmpresa',
      props: {
        id: 'fo',
        texto: '{{ cia.razon_social }}',
        showPaginacion: true,
        showFechaGeneracion: true,
        color: '#777777',
      },
    },
  ],
  root: { props: {} },
  zones: {},
}
