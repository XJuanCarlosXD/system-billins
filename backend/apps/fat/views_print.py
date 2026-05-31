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
from apps.legacy.repositories import fat_repo, inv_repo, cxc_repo, permissions_repo

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

    perms = permissions_repo.get_for(request.user.username, 'fat', no_cia, punto)
    if perms is None or not perms.activo:
        return JsonResponse({'detail': 'sin acceso a FAT en esta empresa/punto'}, status=403)

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


@login_required
@require_http_methods(["GET"])
def fat_lista_facturas_pdf(request):
    """GET /api/fat/reportes/listado/pdf/?no_cia=01&punto=01&desde=...&hasta=...&tipo=...&estado=...

    Devuelve un PDF con el listado de facturas según los filtros activos.
    """
    try:
        from reportlab.lib.pagesizes import letter  # probe
    except ImportError:
        return JsonResponse({"error": "reportlab no instalado"}, status=500)

    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')

    perms = permissions_repo.get_for(request.user.username, 'fat', no_cia, punto)
    if perms is None or not perms.activo:
        return JsonResponse({'detail': 'sin acceso a FAT en esta empresa/punto'}, status=403)

    desde = request.GET.get('desde', '')
    hasta = request.GET.get('hasta', '')
    tipo = request.GET.get('tipo', '')
    estado = request.GET.get('estado', '')
    vendedor = request.GET.get('vendedor', '')
    no_cliente = request.GET.get('no_cliente', '')

    try:
        result = fat_repo.list_facturas(
            no_cia=no_cia, punto=punto,
            fecha_desde=desde, fecha_hasta=hasta,
            tipo=tipo, estado=estado,
            vendedor=vendedor, no_cliente=no_cliente,
            page=1, page_size=10000,
        )
        items = result['items']
    except Exception as e:
        return JsonResponse({"error": f"Error consultando facturas: {e}"}, status=500)

    cia = inv_repo.get_compania(no_cia) or {}
    razon = (cia.get('descripcion') or no_cia).strip()

    periodo = ''
    if desde or hasta:
        if desde and hasta:
            periodo = f"{desde} a {hasta}"
        elif desde:
            periodo = f"Desde {desde}"
        else:
            periodo = f"Hasta {hasta}"

    # Alineado con Rfat321: composite documento PUNTO-TIPO-NO, vendedor visible,
    # no_cliente con LPAD(5), anulados muestran 0.00 en TOTAL.
    col_display = ['DOCUMENTO', 'FECHA', 'VENDEDOR', 'NO_CLIENTE', 'CLIENTE', 'NCF', 'TOTAL']

    rows_data = []
    total_general = 0.0
    for r in items:
        es_anulado = (r.get('st_anulado') or 'N') == 'S'
        total_efectivo = 0.0 if es_anulado else float(r.get('total_neto') or 0)
        total_general += total_efectivo
        rows_data.append({
            'documento': f"{r['punto']}-{r['tipo_factura']}-{r['no_factura']}",
            'fecha': r['fecha'] or '',
            'vendedor': r['vendedor'] or '',
            'no_cliente': str(r['no_cliente']).rjust(5, '0'),
            'cliente': (r.get('nombre_cliente') or '') + (' (ANULADA)' if es_anulado else ''),
            'ncf': r.get('ncf_dgi') or '',
            'total': total_efectivo,
        })

    # Mapeo de codigos legado: F=Credito, O=Contado, T=Todos
    tipo_label_legado = {'F': 'Credito (F)', 'O': 'Contado (O)', 'T': 'Todos'}
    tipo_display = tipo_label_legado.get(tipo.upper(), tipo) if tipo else 'Todos'

    header_extra = [f"<b>{razon}</b>"]
    if periodo:
        header_extra.append(f"<b>Período:</b> {periodo}")
    filtros_desc = [f"Tipo: {tipo_display}"]
    if vendedor:
        filtros_desc.append(f"Vendedor: {vendedor}")
    if no_cliente:
        filtros_desc.append(f"Cliente: {no_cliente.rjust(5,'0')}")
    if estado:
        filtros_desc.append(f"Estado: {estado}")
    header_extra.append(f"<b>Filtros:</b> {' | '.join(filtros_desc)}")
    header_extra.append(f"<b>Total registros:</b> {len(rows_data)}")
    header_extra.append(f"<b>Total neto (excluyendo anuladas):</b> {total_general:,.2f}")

    try:
        pdf = build_pdf_report(
            title=f"Listado de Facturas — {razon}",
            columns=col_display,
            rows=rows_data,
            col_widths=None,
            header_extra=header_extra,
        )
    except Exception as e:
        return JsonResponse({"error": f"Error generando PDF: {e}"}, status=500)

    resp = HttpResponse(pdf, content_type='application/pdf')
    resp['Content-Disposition'] = 'inline; filename="listado_facturas.pdf"'
    return resp


@login_required
@require_http_methods(["GET"])
def fat_lista_precio_pdf(request):
    """GET /api/fat/reportes/lista-precio/pdf/?no_cia=01&punto=01&no_lista=1[&no_produ_desde=&no_produ_hasta=]

    Clone de Rfat333 (Ffat310). Lista productos y precios de una lista
    especifica con filtro opcional por rango de producto (LPAD 8 como legado).
    """
    try:
        from reportlab.lib.pagesizes import letter  # probe
    except ImportError:
        return JsonResponse({"error": "reportlab no instalado"}, status=500)

    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    no_lista = (request.GET.get('no_lista') or '').strip()
    no_produ_desde = (request.GET.get('no_produ_desde') or '').strip()
    no_produ_hasta = (request.GET.get('no_produ_hasta') or '').strip()

    if not no_lista:
        return JsonResponse({"error": "no_lista es requerido"}, status=400)

    perms = permissions_repo.get_for(request.user.username, 'fat', no_cia, punto)
    if perms is None or not perms.activo:
        return JsonResponse({'detail': 'sin acceso a FAT en esta empresa/punto'}, status=403)

    try:
        items = fat_repo.list_lista_precio_detalle(
            no_cia, punto, no_lista,
            no_produ_desde=no_produ_desde,
            no_produ_hasta=no_produ_hasta,
        )
    except Exception as e:
        return JsonResponse({"error": f"Error consultando lista de precio: {e}"}, status=500)

    # Lookup descripcion de la lista
    tipos = fat_repo.list_tipos_lista_precio(no_cia)
    lista_info = next((t for t in tipos if str(t['no_lista']) == str(no_lista)), None)
    descripcion_lista = (lista_info or {}).get('descripcion', '')
    tipo_moneda = (lista_info or {}).get('tipo_moneda', 'RD')

    cia = inv_repo.get_compania(no_cia) or {}
    razon = (cia.get('descripcion') or no_cia).strip()

    col_display = ['NO_PRODU', 'DESCRIPCION', 'PRECIO', 'ACTIVA', 'NOTA']
    rows_data = [{
        'no_produ': r['no_produ'],
        'descripcion': (r['descripcion'] or '')[:60],
        'precio': r['precio'],
        'activa': 'S' if r['activo'] else 'N',
        'nota': (r.get('nota') or '')[:30],
    } for r in items]

    header_extra = [
        f"<b>{razon}</b>",
        f"<b>Lista de Precio:</b> {no_lista} — {descripcion_lista or '(sin descripción)'} ({tipo_moneda})",
    ]
    filtros = []
    if no_produ_desde:
        filtros.append(f"Desde producto: {no_produ_desde.rjust(8,'0')}")
    if no_produ_hasta:
        filtros.append(f"Hasta producto: {no_produ_hasta.rjust(8,'0')}")
    if filtros:
        header_extra.append(f"<b>Filtros:</b> {' | '.join(filtros)}")
    header_extra.append(f"<b>Total productos:</b> {len(rows_data)}")

    try:
        pdf = build_pdf_report(
            title=f"Listado Lista de Precio {no_lista} — {razon}",
            columns=col_display,
            rows=rows_data,
            col_widths=None,
            header_extra=header_extra,
        )
    except Exception as e:
        return JsonResponse({"error": f"Error generando PDF: {e}"}, status=500)

    resp = HttpResponse(pdf, content_type='application/pdf')
    resp['Content-Disposition'] = f'inline; filename="lista_precio_{no_lista}.pdf"'
    return resp


@login_required
@require_http_methods(["GET"])
def fat_conduce_pdf(request, tipo: str, no_conduce: str):
    """GET /api/fat/conduces/<tipo>/<no_conduce>/pdf/?no_cia=01&punto=01

    Devuelve el PDF de un conduce/cotizacion para impresion. NCF es opcional
    (los conduces solo tienen NCF si ya fueron facturados).
    """
    try:
        from reportlab.lib.pagesizes import letter  # probe
    except ImportError:
        return JsonResponse({"error": "reportlab no instalado"}, status=500)

    tipo_s = (tipo or '').strip().upper()
    no_conduce_s = (no_conduce or '').strip()

    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')

    perms = permissions_repo.get_for(request.user.username, 'fat', no_cia, punto)
    if perms is None or not perms.activo:
        return JsonResponse({'detail': 'sin acceso a FAT en esta empresa/punto'}, status=403)

    try:
        conduce = fat_repo.get_conduce(no_cia, punto, tipo_s, no_conduce_s)
    except Exception as e:
        return JsonResponse({"error": f"Error consultando conduce: {e}"}, status=500)

    if conduce is None:
        return JsonResponse({"error": "Conduce no encontrado"}, status=404)

    cia = inv_repo.get_compania(no_cia) or {}
    razon_social = (cia.get('descripcion') or no_cia).strip()

    no_cliente_str = str(conduce.get('no_cliente') or '')
    cliente = cxc_repo.get_cliente(no_cia, no_cliente_str) or {}
    rnc_cliente = (cliente.get('rnc') or '').strip()
    direccion_cliente = (cliente.get('direccion') or '').strip()

    nombre_vendedor = fat_repo.get_vendedor_nombre(no_cia, conduce.get('vendedor', ''))
    descripcion_cond_pago = fat_repo.get_condicion_pago_descripcion(
        conduce.get('no_condicion_pago', ''))

    try:
        pdf_bytes = _render_conduce_pdf(
            conduce=conduce,
            razon_social=razon_social,
            rnc_cliente=rnc_cliente,
            direccion_cliente=direccion_cliente,
            nombre_vendedor=nombre_vendedor,
            descripcion_cond_pago=descripcion_cond_pago,
        )
    except Exception as e:
        return JsonResponse({"error": f"Error generando PDF: {e}"}, status=500)

    resp = HttpResponse(pdf_bytes, content_type='application/pdf')
    resp['Content-Disposition'] = (
        f'inline; filename="FAT_CONDUCE_{tipo_s}_{no_conduce_s}.pdf"'
    )
    return resp


@login_required
@require_http_methods(["GET"])
def fat_lista_conduces_pdf(request):
    """GET /api/fat/reportes/listado-conduces/pdf/?no_cia=01&punto=01&desde=...&hasta=...&tipo=...

    Devuelve un PDF con el listado de conduces/cotizaciones segun los filtros.
    """
    try:
        from reportlab.lib.pagesizes import letter  # probe
    except ImportError:
        return JsonResponse({"error": "reportlab no instalado"}, status=500)

    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')

    perms = permissions_repo.get_for(request.user.username, 'fat', no_cia, punto)
    if perms is None or not perms.activo:
        return JsonResponse({'detail': 'sin acceso a FAT en esta empresa/punto'}, status=403)

    desde = request.GET.get('desde', '')
    hasta = request.GET.get('hasta', '')
    tipo = request.GET.get('tipo', '')
    estado = request.GET.get('estado', '')
    search = request.GET.get('search', '')

    try:
        result = fat_repo.list_conduces(
            no_cia=no_cia, punto=punto,
            fecha_desde=desde, fecha_hasta=hasta,
            tipo=tipo, estado=estado, search=search,
            page=1, page_size=10000,
        )
        items = result.get('items', [])
    except Exception as e:
        return JsonResponse({"error": f"Error consultando conduces: {e}"}, status=500)

    cia = inv_repo.get_compania(no_cia) or {}
    razon = (cia.get('descripcion') or no_cia).strip()

    periodo = ''
    if desde or hasta:
        if desde and hasta:
            periodo = f"{desde} a {hasta}"
        elif desde:
            periodo = f"Desde {desde}"
        else:
            periodo = f"Hasta {hasta}"

    col_display = ['TIPO', 'NO_CONDUCE', 'FECHA', 'CLIENTE', 'FACTURA', 'TOTAL']

    rows_data = [{
        'tipo': r.get('tipo_conduce', ''),
        'no_conduce': f"{r.get('tipo_conduce', '')}-{r.get('no_conduce', '')}",
        'fecha': r.get('fecha') or '',
        'cliente': r.get('nombre_cliente', ''),
        'factura': (
            f"{(r.get('tipo_factura') or '').strip()}-{(r.get('no_factura') or '').strip()}"
            if (r.get('no_factura') or '').strip() else ''
        ),
        'total': r.get('total_neto', 0),
    } for r in items]

    header_extra = [f"<b>{razon}</b>"]
    if periodo:
        header_extra.append(f"<b>Período:</b> {periodo}")
    filtros_desc = []
    if tipo:
        filtros_desc.append(f"Tipo: {tipo}")
    if estado:
        filtros_desc.append(f"Estado: {estado}")
    if search:
        filtros_desc.append(f"Búsqueda: {search}")
    if filtros_desc:
        header_extra.append(f"<b>Filtros:</b> {' | '.join(filtros_desc)}")
    header_extra.append(f"<b>Total registros:</b> {len(rows_data)}")

    try:
        pdf = build_pdf_report(
            title=f"Listado de Conduces/Cotizaciones — {razon}",
            columns=col_display,
            rows=rows_data,
            col_widths=None,
            header_extra=header_extra,
        )
    except Exception as e:
        return JsonResponse({"error": f"Error generando PDF: {e}"}, status=500)

    resp = HttpResponse(pdf, content_type='application/pdf')
    resp['Content-Disposition'] = 'inline; filename="listado_conduces.pdf"'
    return resp


def _render_conduce_pdf(*, conduce, razon_social, rnc_cliente, direccion_cliente,
                        nombre_vendedor, descripcion_cond_pago) -> bytes:
    """Renderiza el PDF de un conduce/cotizacion (similar a factura)."""
    from reportlab.lib.pagesizes import letter

    tipo = conduce.get('tipo_conduce', '')
    no_conduce = conduce.get('no_conduce', '')
    clase = (conduce.get('clase') or '').strip().upper()
    clase_label = {'C': 'Conduce', 'O': 'Cotización', 'P': 'Pedido'}.get(clase, clase or 'Documento')

    fecha = conduce.get('fecha', '') or ''
    fecha_display = (
        f"{fecha[8:10]}/{fecha[5:7]}/{fecha[:4]}" if fecha and len(fecha) >= 10 else fecha
    )

    nombre_cliente = (conduce.get('nombre_cliente') or '').strip() or '(sin nombre)'
    vendedor_codigo = (conduce.get('vendedor') or '').strip()
    vendedor_display = (
        f"{vendedor_codigo} — {nombre_vendedor}" if nombre_vendedor else vendedor_codigo
    )
    cond_pago_display = descripcion_cond_pago or 'N/A'

    # NCF DGI (opcional en conduces)
    ncf_dgi = (conduce.get('ncf_dgi') or '').strip()
    if ncf_dgi:
        ncf_display = f"<b>NCF:</b> {ncf_dgi}"
    else:
        ncf_display = "<b>NCF:</b> (pendiente facturación)"

    # Factura vinculada (si aplica)
    no_factura = (conduce.get('no_factura') or '').strip()
    tipo_factura = (conduce.get('tipo_factura') or '').strip()
    factura_display = (
        f"<b>Factura vinculada:</b> {tipo_factura}-{no_factura}"
        if no_factura else ''
    )

    header_extra = [
        f"<b>{razon_social}</b>",
        f"<b>Cliente:</b> {nombre_cliente}",
        f"<b>RNC/Cédula:</b> {rnc_cliente or 'N/A'}",
        f"<b>Dirección:</b> {direccion_cliente or 'N/A'}",
        f"<b>Fecha:</b> {fecha_display}  <b>Vendedor:</b> {vendedor_display or 'N/A'}",
        f"<b>Condición de pago:</b> {cond_pago_display}",
        ncf_display,
    ]
    if factura_display:
        header_extra.append(factura_display)

    # Lineas (no anuladas) — usa los campos derivados por _build_conduce_lineas
    lineas = [
        {
            'linea': l.get('no_linea'),
            'codigo': l.get('no_produ'),
            'descripcion': l.get('descripcion'),
            'cant': l.get('cantidad'),
            'precio': l.get('precio'),
            'dscto': l.get('descuento'),
            'itbis': l.get('itbis'),
            'total': (
                float(l.get('cantidad') or 0) * float(l.get('precio') or 0)
                - float(l.get('descuento') or 0) + float(l.get('itbis') or 0)
            ),
        }
        for l in conduce.get('lineas', [])
        if (l.get('st_anulado') or 'N') == 'N'
    ]

    columns = ['LINEA', 'CODIGO', 'DESCRIPCION', 'CANT', 'PRECIO', 'DSCTO', 'ITBIS', 'TOTAL']

    subtotal = float(conduce.get('total_linea') or 0)
    descuento_total = float(conduce.get('descuento') or 0)
    impuesto_total = float(conduce.get('impuesto') or 0)
    total_general = float(conduce.get('total_neto') or 0)

    footer_extra = [
        f"<b>Subtotal:</b> {subtotal:,.2f}",
        f"<b>Descuento:</b> {descuento_total:,.2f}",
        f"<b>ITBIS:</b> {impuesto_total:,.2f}",
        f"<b>TOTAL:</b> {total_general:,.2f}",
    ]

    detalle = (conduce.get('detalle') or '').strip()
    if detalle:
        footer_extra.append(f"<i>Nota:</i> {detalle}")

    return build_pdf_report(
        title=f"{clase_label} {tipo}-{no_conduce}",
        columns=columns,
        rows=lineas,
        col_widths=None,
        header_extra=header_extra,
        footer_extra=footer_extra,
        page_size=letter,
    )


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
