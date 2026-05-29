"""View de impresión/PDF de documentos FAT (facturas FC/FT).

Endpoint: GET /api/fat/documentos/<tipo>/<no_factura>/pdf/?no_cia=01&punto=01

Patrón establecido en spec 2026-05-29-fat-print-factura-design.md:
- Razón social en lugar de "Empresa 01" (lookup inv_repo.get_compania).
- NCF formato fiscal DGI B01-B15 (validado).
- Nombre de vendedor (no código).
- Descripción de condición de pago (no código).
- Sin IDs internos.

Nota de implementación:
  fat_repo.get_factura devuelve no_cliente como int; se convierte a str
  al llamar cxc_repo.get_cliente para compat con su firma (no_cliente: str).
"""
from __future__ import annotations

from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_http_methods

from apps.legacy.pdf_helpers import build_pdf_report
from apps.legacy.repositories import fat_repo, inv_repo, cxc_repo

TIPOS_DOCUMENTO_SOPORTADOS = {'FC', 'FT'}

TIPOS_NCF_VALIDOS_FISICOS = {
    'B01', 'B02', 'B03', 'B04',
    'B11', 'B12', 'B13', 'B14', 'B15',
}

NCF_DESCRIPCION = {
    'B01': 'Crédito Fiscal',
    'B02': 'Consumo',
    'B03': 'Nota de Débito',
    'B04': 'Nota de Crédito',
    'B11': 'Compras',
    'B12': 'Registro Único de Ingresos',
    'B13': 'Gastos Menores',
    'B14': 'Regímenes Especiales',
    'B15': 'Gubernamental',
}


@login_required
@require_http_methods(["GET"])
def fat_documento_pdf(request, tipo: str, no_factura: str):
    """GET /api/fat/documentos/<tipo>/<no_factura>/pdf/?no_cia=01&punto=01

    Devuelve el PDF de una factura existente para impresión.
    """
    try:
        from reportlab.lib.pagesizes import letter  # probe
    except ImportError:
        return JsonResponse({"error": "reportlab no instalado"}, status=500)

    tipo = (tipo or '').strip().upper()
    if tipo not in TIPOS_DOCUMENTO_SOPORTADOS:
        return JsonResponse(
            {"error": f"Tipo de documento '{tipo}' no soportado en este sprint (solo FC, FT)"},
            status=400)

    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')

    try:
        factura = fat_repo.get_factura(no_cia, punto, tipo, no_factura)
    except Exception as e:
        return JsonResponse({"error": f"Error consultando factura: {e}"}, status=500)

    if factura is None:
        return JsonResponse({"error": "Factura no encontrada"}, status=404)

    tipo_ncf = (factura.get('posiciones_fijas_ncf') or factura.get('tipo_ncf_fiscal') or '').strip().upper()
    # Solo rechazar si hay un tipo explícito que no sea válido DGI.
    # NULL/vacío se permite: la factura puede no tener NCF aún (datos legacy)
    # y el renderer mostrará "(sin NCF asignado)".
    if tipo_ncf and tipo_ncf not in TIPOS_NCF_VALIDOS_FISICOS:
        return JsonResponse(
            {"error": f"NCF tipo '{tipo_ncf}' no es válido DGI (debe ser B01..B15)"},
            status=422)

    # ── Resolver lookups (código → descripción) ──────────────────────────────
    cia = inv_repo.get_compania(no_cia) or {}
    razon_social = (cia.get('descripcion') or no_cia).strip()

    # no_cliente viene como int desde get_factura; get_cliente espera str
    no_cliente_str = str(factura['no_cliente'])
    cliente = cxc_repo.get_cliente(no_cia, no_cliente_str) or {}
    rnc_cliente = (cliente.get('rnc') or '').strip()
    direccion_cliente = (cliente.get('direccion') or '').strip()

    nombre_vendedor = fat_repo.get_vendedor_nombre(no_cia, factura.get('vendedor', ''))
    descripcion_cond_pago = fat_repo.get_condicion_pago_descripcion(
        factura.get('no_condicion_pago', ''))

    try:
        pdf_bytes = _render_factura_pdf(
            factura=factura,
            razon_social=razon_social,
            rnc_cliente=rnc_cliente,
            direccion_cliente=direccion_cliente,
            nombre_vendedor=nombre_vendedor,
            descripcion_cond_pago=descripcion_cond_pago,
            tipo_ncf=tipo_ncf,
        )
    except Exception as e:
        return JsonResponse({"error": f"Error generando PDF: {e}"}, status=500)

    resp = HttpResponse(pdf_bytes, content_type='application/pdf')
    resp['Content-Disposition'] = (
        f'inline; filename="FAT_{tipo}_{no_factura}.pdf"'
    )
    return resp


def _render_factura_pdf(*, factura, razon_social, rnc_cliente, direccion_cliente,
                         nombre_vendedor, descripcion_cond_pago, tipo_ncf) -> bytes:
    """Arma header_extra + footer_extra y llama a build_pdf_report."""
    from reportlab.lib.pagesizes import letter

    tipo = factura.get('tipo_factura', '')
    no_factura = factura.get('no_factura', '')
    fecha = factura.get('fecha', '') or ''
    fecha_display = (
        f"{fecha[8:10]}/{fecha[5:7]}/{fecha[:4]}" if fecha and len(fecha) >= 10 else fecha
    )
    # Componer NCF real desde POSICIONES_FIJAS_NCF + LPAD(NCF, 8, '0').
    # El campo CODIGO_NCF de la tabla es un código de SERIE legacy ('FC-001'),
    # no el NCF DGI. El NCF real se compone de los dos campos por separado.
    posiciones = (factura.get('posiciones_fijas_ncf') or '').strip().upper()
    ncf_num = factura.get('ncf')
    if posiciones and ncf_num:
        codigo_ncf = f"{posiciones}{int(ncf_num):08d}"
    else:
        codigo_ncf = ''
    nombre_cliente = (factura.get('nombre_cliente') or '').strip() or '(sin nombre)'
    vendedor_codigo = (factura.get('vendedor') or '').strip()
    vendedor_display = (
        f"{vendedor_codigo} — {nombre_vendedor}" if nombre_vendedor else vendedor_codigo
    )
    cond_pago_display = descripcion_cond_pago or 'N/A'
    ncf_descripcion = NCF_DESCRIPCION.get(tipo_ncf, '')
    if codigo_ncf and tipo_ncf:
        ncf_display = f"<b>NCF:</b> {codigo_ncf} ({tipo_ncf} — {ncf_descripcion})"
    elif tipo_ncf:
        ncf_display = f"<b>NCF:</b> (no asignado, tipo {tipo_ncf})"
    else:
        ncf_display = "<b>NCF:</b> (sin NCF asignado)"

    header_extra = [
        f"<b>{razon_social}</b>",
        f"<b>Cliente:</b> {nombre_cliente}",
        f"<b>RNC/Cédula:</b> {rnc_cliente or 'N/A'}",
        f"<b>Dirección:</b> {direccion_cliente or 'N/A'}",
        f"<b>Fecha:</b> {fecha_display}  <b>Vendedor:</b> {vendedor_display or 'N/A'}",
        f"<b>Condición de pago:</b> {cond_pago_display}",
        ncf_display,
    ]

    # Construir filas de líneas (sólo líneas no anuladas)
    lineas = [
        {
            'linea': l['no_linea'],
            'codigo': l['no_produ'],
            'descripcion': l['descripcion'],
            'cant': l['cantidad'],
            'precio': l['precio'],
            'dscto': l['descuento'],
            'itbis': l['impuesto'],
            'total': l['monto_neto'],
        }
        for l in factura.get('lineas', [])
        if (l.get('st_anulado') or 'N') == 'N'
    ]

    columns = ['LINEA', 'CODIGO', 'DESCRIPCION', 'CANT', 'PRECIO', 'DSCTO', 'ITBIS', 'TOTAL']
    col_widths = None  # default reportlab

    subtotal = float(factura.get('total_linea') or 0)
    descuento_total = float(factura.get('descuento') or 0)
    impuesto_total = float(factura.get('impuesto') or 0)
    total_general = float(factura.get('total_neto') or 0)

    footer_extra = [
        f"<b>Subtotal:</b> {subtotal:,.2f}",
        f"<b>Descuento:</b> {descuento_total:,.2f}",
        f"<b>ITBIS:</b> {impuesto_total:,.2f}",
        f"<b>TOTAL:</b> {total_general:,.2f}",
    ]

    nota = (factura.get('nota') or '').strip()
    if nota:
        footer_extra.append(f"<i>Nota:</i> {nota}")

    return build_pdf_report(
        title=f"Factura {tipo}-{no_factura}",
        columns=columns,
        rows=lineas,
        col_widths=col_widths,
        header_extra=header_extra,
        footer_extra=footer_extra,
        page_size=letter,  # portrait
    )
