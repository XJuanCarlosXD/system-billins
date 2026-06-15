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


def _signature_footer_line() -> str:
    return (
        "<br/><br/><br/>"
        "<b>Recibido por:</b> ____________________________"
        "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"
        "<b>Entregado por:</b> ____________________________"
    )


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
    try:
        cia = next(
            (c for c in fat_repo.list_companias_fat() if str(c.get('no_cia')).strip() == no_cia),
            None,
        ) or {}
    except Exception:
        cia = {}
    if not cia:
        cia = inv_repo.get_compania(no_cia) or {}
    razon_social = (cia.get('descripcion') or no_cia).strip()

    # no_cliente viene como int desde get_factura; get_cliente espera str
    no_cliente_str = str(factura['no_cliente'])
    cliente = cxc_repo.get_cliente(no_cia, no_cliente_str, punto) or {}
    rnc_cliente = (cliente.get('rnc') or '').strip()
    direccion_cliente = (cliente.get('direccion') or '').strip()

    nombre_vendedor = fat_repo.get_vendedor_nombre(no_cia, factura.get('vendedor', ''))
    descripcion_cond_pago = fat_repo.get_condicion_pago_descripcion(
        factura.get('no_condicion_pago', ''))
    forma_pago_display = (factura.get('forma_pago') or '').strip()
    try:
        tipos_pago = fat_repo.list_tipos_pago(no_cia, punto)
        tipo_pago = next(
            (p for p in tipos_pago if str(p.get('tipo_pago')).strip() == forma_pago_display),
            None,
        )
        if tipo_pago and tipo_pago.get('descripcion'):
            forma_pago_display = tipo_pago['descripcion']
    except Exception:
        pass

    try:
        pdf_bytes = _render_factura_pdf_moderno(
            factura=factura,
            cia=cia,
            razon_social=razon_social,
            rnc_cliente=rnc_cliente,
            direccion_cliente=direccion_cliente,
            nombre_vendedor=nombre_vendedor,
            descripcion_cond_pago=descripcion_cond_pago,
            forma_pago_display=forma_pago_display,
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
    con_ventas_exentas = request.GET.get('con_ventas_exentas', 'A')

    try:
        result = fat_repo.list_facturas(
            no_cia=no_cia, punto=punto,
            fecha_desde=desde, fecha_hasta=hasta,
            tipo=tipo, estado=estado,
            vendedor=vendedor, no_cliente=no_cliente,
            con_ventas_exentas=con_ventas_exentas,
            page=1, page_size=10000,
        )
        items = result['items']
    except Exception as e:
        return JsonResponse({"error": f"Error consultando facturas: {e}"}, status=500)

    try:
        cia = next(
            (c for c in fat_repo.list_companias_fat() if str(c.get('no_cia')).strip() == no_cia),
            None,
        ) or {}
    except Exception:
        cia = {}
    if not cia:
        cia = inv_repo.get_compania(no_cia) or {}

    periodo = ''
    if desde and hasta:
        periodo = f"Periodo: {desde} a {hasta}"
    elif desde:
        periodo = f"Periodo: desde {desde}"
    elif hasta:
        periodo = f"Periodo: hasta {hasta}"

    tipo_label_legado = {'F': 'Credito (F)', 'O': 'Contado (O)', 'T': 'Todos'}
    tipo_display = tipo_label_legado.get(tipo.upper(), tipo) if tipo else 'Todos'
    filtros = [f"Tipo: {tipo_display}"]
    if vendedor:
        filtros.append(f"Vendedor: {vendedor}")
    if no_cliente:
        filtros.append(f"Cliente: {no_cliente.rjust(5, '0')}")
    if estado:
        filtros.append(f"Estado: {estado}")
    cve_upper = (con_ventas_exentas or 'A').upper()
    if cve_upper == 'S':
        filtros.append("Solo exentas (ITBIS=0)")
    elif cve_upper == 'N':
        filtros.append("Solo gravadas (ITBIS!=0)")

    # Ordenar por cliente para agrupar (Rfat201 style)
    items_sorted = sorted(items, key=lambda r: (
        str(r.get('no_cliente') or '').rjust(5, '0'),
        r.get('fecha') or '',
        str(r.get('no_factura') or ''),
    ))

    rows_data = []
    total_general = 0.0
    total_itbis = 0.0
    total_desc = 0.0
    for r in items_sorted:
        es_anulado = (r.get('st_anulado') or 'N') == 'S'
        total_efectivo = 0.0 if es_anulado else float(r.get('total_neto') or 0)
        itbis_efectivo = 0.0 if es_anulado else float(r.get('impuesto') or 0)
        desc_efectivo = 0.0 if es_anulado else float(r.get('descuento') or 0)
        total_general += total_efectivo
        total_itbis += itbis_efectivo
        total_desc += desc_efectivo
        nombre = (r.get('nombre_cliente') or '').strip()
        if es_anulado:
            nombre = f"{nombre} (ANULADA)" if nombre else "(ANULADA)"
        rows_data.append({
            'cliente_label': f"{str(r.get('no_cliente') or '').rjust(5, '0')} {nombre}",
            'documento': f"{r.get('punto') or ''}-{r.get('tipo_factura') or ''}-{str(r.get('no_factura') or '').rjust(7,'0')}",
            'vendedor': r.get('vendedor') or '',
            'fecha': r.get('fecha') or '',
            'ncf': r.get('ncf_dgi') or '',
            'descuento': desc_efectivo,
            'itbis': itbis_efectivo,
            'total': total_efectivo,
        })

    columns = [
        {'key': 'cliente_label', 'label': 'Cliente', 'align': 'left', 'width': 50},
        {'key': 'documento', 'label': 'Documento', 'align': 'left', 'width': 28},
        {'key': 'vendedor', 'label': 'Vend.', 'align': 'center', 'width': 14},
        {'key': 'fecha', 'label': 'Fecha', 'align': 'center', 'width': 22},
        {'key': 'ncf', 'label': 'NCF', 'align': 'left', 'width': 30},
        {'key': 'descuento', 'label': 'Descuento', 'align': 'right', 'format': 'money', 'width': 20},
        {'key': 'itbis', 'label': 'ITBIS', 'align': 'right', 'format': 'money', 'width': 20},
        {'key': 'total', 'label': 'Val. Neto', 'align': 'right', 'format': 'money', 'width': 22},
    ]

    totals_row = {
        'cliente_label': f"Total general ({len(rows_data)} docs)",
        'descuento': total_desc,
        'itbis': total_itbis,
        'total': total_general,
    }

    try:
        pdf = _render_modern_report_pdf(
            report_id='Rfat201',
            title='Reporte de Documentos Diario',
            cia=cia,
            subtitle_lines=[s for s in [periodo, ' | '.join(filtros),
                                        'Doc. Nulos y Activos (anuladas en 0.00)'] if s],
            sections=[{
                'columns': columns,
                'rows': rows_data,
                'group_by': 'cliente_label',
                'totals_row': totals_row,
            }],
            impreso_por=getattr(request.user, 'username', '') or '',
            orientation='landscape',
        )
    except Exception as e:
        return JsonResponse({"error": f"Error generando PDF: {e}"}, status=500)

    resp = HttpResponse(pdf, content_type='application/pdf')
    resp['Content-Disposition'] = 'inline; filename="listado_facturas.pdf"'
    return resp


@login_required
@require_http_methods(["GET"])
def fat_rep_ncf_nulos_pdf(request):
    """GET /api/fat/reportes/ncf-nulos/pdf/?no_cia=01&punto=01&desde=YYYY-MM-DD&hasta=YYYY-MM-DD

    Reporte NCF nulos/anulados — compliance fiscal.
    """
    try:
        from reportlab.lib.pagesizes import letter  # probe
    except ImportError:
        return JsonResponse({"error": "reportlab no instalado"}, status=500)

    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    desde = request.GET.get('desde', '')
    hasta = request.GET.get('hasta', '')

    if not desde or not hasta:
        return JsonResponse({"error": "desde y hasta son requeridos (YYYY-MM-DD)"}, status=400)

    perms = permissions_repo.get_for(request.user.username, 'fat', no_cia, punto)
    if perms is None or not perms.activo:
        return JsonResponse({'detail': 'sin acceso a FAT en esta empresa/punto'}, status=403)

    try:
        rows = fat_repo.rep_ncf_nulos(no_cia=no_cia, desde=desde, hasta=hasta)
    except Exception as e:
        return JsonResponse({"error": f"Error consultando NCF nulos: {e}"}, status=500)

    cia = inv_repo.get_compania(no_cia) or {}
    razon = (cia.get('descripcion') or no_cia).strip()
    rnc_empresa = (cia.get('rnc') or '').strip()

    def _date_str(v) -> str:
        return str(v)[:10] if v else ''

    def _ncf_dgi_of(r: dict) -> str:
        ncf = r.get('ncf')
        if not ncf:
            return ''
        prefix = (
            r.get('tipo_ncf_fiscal')
            or r.get('tipo_ncf')
            or r.get('codigo_ncf')
            or ''
        ).strip().upper()
        try:
            n_int = int(ncf)
        except (TypeError, ValueError):
            return str(ncf)
        if prefix.startswith('B') and len(prefix) == 3:
            return f"{prefix}{n_int:08d}"
        return str(ncf)

    rows_data = [{
        'documento': f"{r.get('punto') or '01'}-{r.get('tipo_factura') or ''}-{str(r.get('no_factura') or '').rjust(7,'0')}",
        'nombre_cliente': (r.get('nombre_cliente') or '').strip(),
        'tipo_anul': r.get('tipo_anula_dgii') or r.get('tipo_anula') or '',
        'ncf': _ncf_dgi_of(r),
        'fecha': _date_str(r.get('fecha_anulacion') or r.get('fecha')),
        'detalle': (r.get('motivo_anulacion') or '')[:60],
    } for r in rows]

    columns = [
        {'key': 'documento', 'label': 'Documento', 'align': 'left', 'width': 38},
        {'key': 'nombre_cliente', 'label': 'Nombre Cliente', 'align': 'left', 'width': 70},
        {'key': 'tipo_anul', 'label': 'Tipo Anul.', 'align': 'center', 'width': 22},
        {'key': 'ncf', 'label': 'NCF', 'align': 'left', 'width': 30},
        {'key': 'fecha', 'label': 'Fecha', 'align': 'center', 'width': 22},
        {'key': 'detalle', 'label': 'Detalle de Anulacion', 'align': 'left', 'width': 80},
    ]

    try:
        try:
            cia_full = next(
                (c for c in fat_repo.list_companias_fat() if str(c.get('no_cia')).strip() == no_cia),
                None,
            ) or {}
        except Exception:
            cia_full = {}
        if not cia_full:
            cia_full = cia
        pdf = _render_modern_report_pdf(
            report_id='Rfat321',
            title='Documentos Con NCF Anulados',
            cia=cia_full,
            subtitle_lines=[
                f"Periodo: {desde} a {hasta}",
                f"Total documentos: {len(rows_data)}",
            ],
            sections=[{
                'columns': columns,
                'rows': rows_data,
                'totals_row': {'documento': f"Cantidad Documentos: {len(rows_data)}"},
            }],
            impreso_por=getattr(request.user, 'username', '') or '',
            orientation='landscape',
        )
    except Exception as e:
        return JsonResponse({"error": f"Error generando PDF: {e}"}, status=500)

    resp = HttpResponse(pdf, content_type='application/pdf')
    resp['Content-Disposition'] = f'inline; filename="ncf_nulos_{desde}_{hasta}.pdf"'
    return resp


@login_required
@require_http_methods(["GET"])
def fat_rep_facturas_rnc_pdf(request):
    """GET /api/fat/reportes/facturas-rnc/pdf/?no_cia=01&punto=01&desde=YYYY-MM-DD&hasta=YYYY-MM-DD

    Clone parcial de Rfat328: facturas con RNC, NCF y referencias CXC.
    """
    try:
        from reportlab.lib.pagesizes import letter  # probe
    except ImportError:
        return JsonResponse({"error": "reportlab no instalado"}, status=500)

    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    desde = request.GET.get('desde', '')
    hasta = request.GET.get('hasta', '')
    tipo_docu = request.GET.get('tipo_docu', 'T')
    rnc = request.GET.get('rnc', '')
    no_cliente = request.GET.get('no_cliente', '')

    if not desde or not hasta:
        return JsonResponse({"error": "desde y hasta son requeridos (YYYY-MM-DD)"}, status=400)

    perms = permissions_repo.get_for(request.user.username, 'fat', no_cia, punto)
    if perms is None or not perms.activo:
        return JsonResponse({'detail': 'sin acceso a FAT en esta empresa/punto'}, status=403)

    try:
        rows = fat_repo.rep_facturas_rnc(
            no_cia=no_cia, punto=punto, desde=desde, hasta=hasta,
            tipo_docu=tipo_docu, rnc=rnc, no_cliente=no_cliente)
    except ValueError:
        return JsonResponse({"error": "no_cliente debe ser numerico"}, status=400)
    except Exception as e:
        return JsonResponse({"error": f"Error consultando facturas con RNC: {e}"}, status=500)

    cia = inv_repo.get_compania(no_cia) or {}
    razon = (cia.get('descripcion') or no_cia).strip()
    rnc_empresa = (cia.get('rnc') or '').strip()
    total_neto = sum(float(r.get('total_neto') or 0) for r in rows)

    col_display = ['DOCUMENTO', 'FECHA', 'NO_CLIENTE', 'RNC', 'NOMBRE', 'NCF', 'REF_CXC', 'TOTAL']
    rows_data = [{
        'documento': r.get('documento', ''),
        'fecha': r.get('fecha') or '',
        'no_cliente': r.get('no_cliente_fmt') or '',
        'rnc': r.get('rnc') or '',
        'nombre': (r.get('nombre') or '')[:32],
        'ncf': r.get('ncf') or '',
        'ref_cxc': r.get('referencias_cxc') or r.get('cxc_documento') or '',
        'total': float(r.get('total_neto') or 0),
    } for r in rows]

    header_extra = [
        f"<b>{razon}</b>" + (f" — RNC: {rnc_empresa}" if rnc_empresa else ''),
        f"<b>Rfat328 - Facturas con RNC</b> &middot; Punto: {punto} &middot; Período: {desde} a {hasta}",
        f"<b>Tipo:</b> {tipo_docu or 'T'}" + (f" &middot; <b>RNC:</b> {rnc}" if rnc else ''),
        f"<b>Total registros:</b> {len(rows_data)}",
    ]
    footer_extra = [f"<b>Total Neto:</b> {total_neto:,.2f}"]

    try:
        pdf = build_pdf_report(
            title=f"Facturas con RNC — {razon}",
            columns=col_display,
            rows=rows_data,
            col_widths=None,
            header_extra=header_extra,
            footer_extra=footer_extra,
            no_cia=no_cia,
        )
    except Exception as e:
        return JsonResponse({"error": f"Error generando PDF: {e}"}, status=500)

    resp = HttpResponse(pdf, content_type='application/pdf')
    resp['Content-Disposition'] = f'inline; filename="facturas_rnc_{desde}_{hasta}.pdf"'
    return resp


@login_required
@require_http_methods(["GET"])
def fat_rep_margen_bruto_pdf(request):
    """GET /api/fat/reportes/margen-bruto/pdf/?no_cia=01&punto=01&desde=YYYY-MM-DD&hasta=YYYY-MM-DD

    Clone parcial de Rfat302/Ffat311: margen bruto por producto, cliente o factura.
    """
    try:
        from reportlab.lib.pagesizes import letter  # probe
    except ImportError:
        return JsonResponse({"error": "reportlab no instalado"}, status=500)

    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    desde = request.GET.get('desde', '')
    hasta = request.GET.get('hasta', '')
    tipo_docu = request.GET.get('tipo_docu', 'T')
    agrupar = request.GET.get('agrupar', 'producto')

    if not desde or not hasta:
        return JsonResponse({"error": "desde y hasta son requeridos (YYYY-MM-DD)"}, status=400)

    perms = permissions_repo.get_for(request.user.username, 'fat', no_cia, punto)
    if perms is None or not perms.activo:
        return JsonResponse({'detail': 'sin acceso a FAT en esta empresa/punto'}, status=403)

    try:
        rows = fat_repo.rep_margen_bruto(
            no_cia=no_cia, punto=punto, desde=desde, hasta=hasta,
            tipo_docu=tipo_docu, agrupar=agrupar,
            vendedor=request.GET.get('vendedor', ''),
            almacen=request.GET.get('almacen', ''),
            no_cliente=request.GET.get('no_cliente', ''),
            no_produ=request.GET.get('no_produ', ''),
            tipo_transaccion=request.GET.get('tipo_transaccion', ''))
    except ValueError:
        return JsonResponse({"error": "no_cliente debe ser numerico"}, status=400)
    except Exception as e:
        return JsonResponse({"error": f"Error consultando margen bruto: {e}"}, status=500)

    cia = inv_repo.get_compania(no_cia) or {}
    razon = (cia.get('descripcion') or no_cia).strip()
    rnc_empresa = (cia.get('rnc') or '').strip()
    total_venta = sum(float(r.get('venta') or 0) for r in rows)
    total_costo = sum(float(r.get('costo') or 0) for r in rows)
    total_beneficio = sum(float(r.get('beneficio') or 0) for r in rows)
    margen_pct = (total_beneficio / total_venta * 100) if total_venta else 0

    col_display = ['CLAVE', 'DESCRIPCION', 'CANT', 'FACT', 'VENTA', 'COSTO', 'BENEFICIO', 'MARGEN']
    rows_data = [{
        'clave': r.get('clave') or '',
        'descripcion': (r.get('descripcion') or '')[:36],
        'cant': float(r.get('cantidad') or 0),
        'fact': int(r.get('facturas') or 0),
        'venta': float(r.get('venta') or 0),
        'costo': float(r.get('costo') or 0),
        'beneficio': float(r.get('beneficio') or 0),
        'margen': f"{float(r.get('margen_pct') or 0):.2f}%",
    } for r in rows]

    header_extra = [
        f"<b>{razon}</b>" + (f" &mdash; RNC: {rnc_empresa}" if rnc_empresa else ''),
        f"<b>Rfat302 - Margen de Beneficio Bruto</b> &middot; Punto: {punto} &middot; Período: {desde} a {hasta}",
        f"<b>Agrupado por:</b> {agrupar or 'producto'} &middot; <b>Tipo:</b> {tipo_docu or 'T'}",
        f"<b>Total registros:</b> {len(rows_data)}",
    ]
    footer_extra = [
        f"<b>Venta:</b> {total_venta:,.2f}",
        f"<b>Costo:</b> {total_costo:,.2f}",
        f"<b>Beneficio:</b> {total_beneficio:,.2f}",
        f"<b>Margen:</b> {margen_pct:,.2f}%",
    ]

    try:
        pdf = build_pdf_report(
            title=f"Margen bruto &mdash; {razon}",
            columns=col_display,
            rows=rows_data,
            col_widths=None,
            header_extra=header_extra,
            footer_extra=footer_extra,
            no_cia=no_cia,
        )
    except Exception as e:
        return JsonResponse({"error": f"Error generando PDF: {e}"}, status=500)

    resp = HttpResponse(pdf, content_type='application/pdf')
    resp['Content-Disposition'] = f'inline; filename="margen_bruto_{agrupar}_{desde}_{hasta}.pdf"'
    return resp


@login_required
@require_http_methods(["GET"])
def fat_rep_607_pdf(request):
    """GET /api/fat/reportes/607/pdf/?no_cia=01&punto=01&desde=YYYY-MM-DD&hasta=YYYY-MM-DD

    Reporte 607 DGII (Formato compras/ventas mensuales). Lista NCF con cliente
    RNC, fechas, total neto, ITBIS y total linea. Footer con totales.
    """
    try:
        from reportlab.lib.pagesizes import letter  # probe
    except ImportError:
        return JsonResponse({"error": "reportlab no instalado"}, status=500)

    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    desde = request.GET.get('desde', '')
    hasta = request.GET.get('hasta', '')

    if not desde or not hasta:
        return JsonResponse({"error": "desde y hasta son requeridos (YYYY-MM-DD)"}, status=400)

    perms = permissions_repo.get_for(request.user.username, 'fat', no_cia, punto)
    if perms is None or not perms.activo:
        return JsonResponse({'detail': 'sin acceso a FAT en esta empresa/punto'}, status=403)

    try:
        rows = fat_repo.rep_ncf_607(no_cia=no_cia, desde=desde, hasta=hasta)
    except Exception as e:
        return JsonResponse({"error": f"Error consultando 607: {e}"}, status=500)

    cia = inv_repo.get_compania(no_cia) or {}
    razon = (cia.get('descripcion') or no_cia).strip()
    rnc_empresa = (cia.get('rnc') or '').strip()

    total_neto = sum(float(r.get('total_neto') or 0) for r in rows)
    total_itbis = sum(float(r.get('impuesto') or 0) for r in rows)
    total_linea = sum(float(r.get('total_linea') or 0) for r in rows)

    # Composite NCF DGI: posiciones + LPAD(NCF,8). Si la fila ya trae ncf_dgi,
    # se respeta; sino se compone desde tipo_ncf_fiscal + ncf.
    def _ncf_dgi_of(r: dict) -> str:
        if r.get('ncf_dgi'):
            return r['ncf_dgi']
        prefix = (r.get('tipo_ncf_fiscal') or '').strip().upper()
        n = r.get('ncf')
        try:
            n_int = int(n) if n is not None else 0
        except (TypeError, ValueError):
            n_int = 0
        if prefix and n_int > 0:
            return f"{prefix}{n_int:08d}"
        return ''

    col_display = ['RNC', 'CLIENTE', 'NCF', 'TIPO_NCF', 'FACTURA', 'FECHA', 'TOTAL_NETO', 'ITBIS']
    rows_data = [{
        'rnc': (r.get('rnc') or '').strip(),
        'cliente': (r.get('nombre_cliente') or '')[:30],
        'ncf': _ncf_dgi_of(r) or str(r.get('ncf') or ''),
        'tipo_ncf': r.get('tipo_ncf_fiscal') or r.get('codigo_ncf') or '',
        'factura': f"{r.get('tipo_factura', '')}-{r.get('no_factura', '')}",
        'fecha': r.get('fecha') or '',
        'total_neto': float(r.get('total_neto') or 0),
        'itbis': float(r.get('impuesto') or 0),
    } for r in rows]

    header_extra = [
        f"<b>{razon}</b>" + (f" — RNC: {rnc_empresa}" if rnc_empresa else ''),
        f"<b>Reporte 607 DGII</b> &middot; Período: {desde} a {hasta}",
        f"<b>Total registros:</b> {len(rows_data)}",
    ]
    footer_extra = [
        f"<b>Total Neto:</b> {total_neto:,.2f}",
        f"<b>Total ITBIS:</b> {total_itbis:,.2f}",
        f"<b>Total Linea:</b> {total_linea:,.2f}",
    ]

    try:
        pdf = build_pdf_report(
            title=f"NCF 607 — {razon}",
            columns=col_display,
            rows=rows_data,
            col_widths=None,
            header_extra=header_extra,
            footer_extra=footer_extra,
            no_cia=no_cia,
        )
    except Exception as e:
        return JsonResponse({"error": f"Error generando PDF: {e}"}, status=500)

    resp = HttpResponse(pdf, content_type='application/pdf')
    resp['Content-Disposition'] = f'inline; filename="ncf_607_{desde}_{hasta}.pdf"'
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

    try:
        cia = next(
            (c for c in fat_repo.list_companias_fat() if str(c.get('no_cia')).strip() == no_cia),
            None,
        ) or {}
    except Exception:
        cia = {}
    if not cia:
        cia = inv_repo.get_compania(no_cia) or {}

    rows_data = [{
        'no_produ': r['no_produ'],
        'descripcion': (r['descripcion'] or '')[:80],
        'precio': r['precio'],
        'activa': 'Si' if r['activo'] else 'No',
        'nota': (r.get('nota') or '')[:30],
    } for r in items]

    columns = [
        {'key': 'no_produ', 'label': 'No. Producto', 'align': 'left', 'width': 24},
        {'key': 'descripcion', 'label': 'Descripcion', 'align': 'left', 'width': 90},
        {'key': 'precio', 'label': 'Precio', 'align': 'right', 'format': 'money', 'width': 28},
        {'key': 'activa', 'label': 'Activa', 'align': 'center', 'width': 18},
        {'key': 'nota', 'label': 'Nota', 'align': 'left', 'width': 40},
    ]

    filtros_list = [f"Lista {no_lista} - {descripcion_lista or '(sin descripcion)'} ({tipo_moneda})"]
    if no_produ_desde:
        filtros_list.append(f"Desde: {no_produ_desde.rjust(8,'0')}")
    if no_produ_hasta:
        filtros_list.append(f"Hasta: {no_produ_hasta.rjust(8,'0')}")
    filtros_list.append(f"Total productos: {len(rows_data)}")

    try:
        pdf = _render_modern_report_pdf(
            report_id='Rfat333',
            title='Listado Lista de Precio',
            cia=cia,
            subtitle_lines=filtros_list,
            sections=[{
                'columns': columns,
                'rows': rows_data,
                'totals_row': {'no_produ': f"Total ({len(rows_data)})"},
            }],
            impreso_por=getattr(request.user, 'username', '') or '',
            orientation='portrait',
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

    # Misma logica que la factura: TFAT_CIAS trae razón social, dirección, RNC y tel.
    try:
        cia = next(
            (c for c in fat_repo.list_companias_fat() if str(c.get('no_cia')).strip() == no_cia),
            None,
        ) or {}
    except Exception:
        cia = {}
    if not cia:
        cia = inv_repo.get_compania(no_cia) or {}
    razon_social = (cia.get('descripcion') or no_cia).strip()

    no_cliente_str = str(conduce.get('no_cliente') or '')
    cliente = cxc_repo.get_cliente(no_cia, no_cliente_str, punto) or {}
    rnc_cliente = (cliente.get('rnc') or '').strip()
    direccion_cliente = (cliente.get('direccion') or '').strip()

    nombre_vendedor = fat_repo.get_vendedor_nombre(no_cia, conduce.get('vendedor', ''))
    descripcion_cond_pago = fat_repo.get_condicion_pago_descripcion(
        conduce.get('no_condicion_pago', ''))

    try:
        pdf_bytes = _render_conduce_pdf_moderno(
            conduce=conduce,
            cia=cia,
            razon_social=razon_social,
            nombre_cliente=(cliente.get('nombre') or conduce.get('nombre_cliente') or '').strip(),
            rnc_cliente=rnc_cliente,
            direccion_cliente=direccion_cliente,
            nombre_vendedor=nombre_vendedor,
            descripcion_cond_pago=descripcion_cond_pago,
            impreso_por=getattr(request.user, 'username', '') or '',
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

    # Validar fechas: si vienen mal formadas (ej. 'undefined-...' desde un frontend
    # que aún no setea ano/mes) las descartamos para evitar ORA-01841.
    import re
    _date_re = re.compile(r'^\d{4}-\d{2}-\d{2}$')
    if desde and not _date_re.match(desde):
        desde = ''
    if hasta and not _date_re.match(hasta):
        hasta = ''

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
            no_cia=no_cia,
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
    footer_extra.append(_signature_footer_line())

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


def _render_factura_pdf_moderno(*, factura, cia, razon_social, rnc_cliente, direccion_cliente,
                                nombre_vendedor, descripcion_cond_pago, forma_pago_display,
                                tipo_ncf) -> bytes:
    """Renderiza factura A4 con bloques de informacion del formulario legacy."""
    import io
    from html import escape

    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        KeepTogether,
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    tipo = (factura.get('tipo_factura') or '').strip().upper()
    no_factura = (factura.get('no_factura') or '').strip()
    documento_label = {'FC': 'Factura Credito', 'FT': 'Factura Contado'}.get(tipo, 'Factura')
    fecha = factura.get('fecha', '') or ''
    fecha_display = (
        f"{fecha[8:10]}/{fecha[5:7]}/{fecha[:4]}" if fecha and len(fecha) >= 10 else fecha
    )

    posiciones = (factura.get('posiciones_fijas_ncf') or '').strip().upper()
    ncf_num = factura.get('ncf')
    codigo_ncf = f"{posiciones}{int(ncf_num):08d}" if posiciones and ncf_num else ''
    ncf_descripcion = NCF_DESCRIPCION.get(tipo_ncf, '')
    ncf_label = codigo_ncf or '(sin NCF asignado)'
    tipo_ncf_label = (
        f"{tipo_ncf} - {ncf_descripcion}" if tipo_ncf and ncf_descripcion else (tipo_ncf or 'N/A')
    )

    nombre_cliente = (factura.get('nombre_cliente') or '').strip() or '(sin nombre)'
    vendedor_codigo = (factura.get('vendedor') or '').strip()
    vendedor_display = f"{vendedor_codigo} - {nombre_vendedor}" if nombre_vendedor else vendedor_codigo
    cond_pago_display = descripcion_cond_pago or 'N/A'
    forma_pago_display = (forma_pago_display or factura.get('forma_pago') or 'N/A').strip()
    estado = (factura.get('estado') or '').strip() or 'P'
    anulada = (factura.get('st_anulado') or 'N') == 'S'
    impresion_label = 'REIMPRESA' if (factura.get('st_impresion') or 'N') == 'S' else 'IMPRESA'
    cia_direccion = (cia.get('direccion') or '').strip()
    cia_rnc = (cia.get('rnc') or '').strip()
    cia_telefono = (cia.get('telefono') or '').strip()

    def text(value) -> str:
        return escape(str(value if value is not None else '').strip())

    def money(value) -> str:
        return f"{float(value or 0):,.2f}"

    def qty(value) -> str:
        amount = float(value or 0)
        if amount.is_integer():
            return f"{amount:,.0f}"
        return f"{amount:,.2f}"

    subtotal = float(factura.get('total_linea') or 0)
    descuento_total = float(factura.get('descuento') or 0)
    impuesto_total = float(factura.get('impuesto') or 0)
    propina_total = float(factura.get('propina') or 0)
    total_general = float(factura.get('total_neto') or 0)

    buffer = io.BytesIO()
    doc_pdf = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=12 * mm,
        bottomMargin=14 * mm,
    )
    width = doc_pdf.width
    doc_card_width = 82 * mm
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name='FacturaTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=17,
        textColor=colors.HexColor('#0F172A'),
        spaceAfter=3,
    ))
    styles.add(ParagraphStyle(
        name='FacturaSubtitle',
        parent=styles['Normal'],
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#475569'),
    ))
    styles.add(ParagraphStyle(
        name='Small',
        parent=styles['Normal'],
        fontSize=7.5,
        leading=9,
        textColor=colors.HexColor('#334155'),
    ))
    styles.add(ParagraphStyle(name='SmallRight', parent=styles['Small'], alignment=TA_RIGHT))
    styles.add(ParagraphStyle(name='SmallCenter', parent=styles['Small'], alignment=TA_CENTER))
    styles.add(ParagraphStyle(
        name='TableHead',
        parent=styles['Small'],
        fontName='Helvetica-Bold',
        textColor=colors.white,
    ))
    styles.add(ParagraphStyle(name='TableHeadRight', parent=styles['TableHead'], alignment=TA_RIGHT))
    styles.add(ParagraphStyle(name='TableHeadCenter', parent=styles['TableHead'], alignment=TA_CENTER))
    styles.add(ParagraphStyle(
        name='DocTitle',
        parent=styles['Normal'],
        alignment=TA_RIGHT,
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=11,
        textColor=colors.white,
    ))
    styles.add(ParagraphStyle(
        name='DocNumber',
        parent=styles['Normal'],
        alignment=TA_RIGHT,
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=16,
        textColor=colors.white,
    ))
    styles.add(ParagraphStyle(
        name='TotalLabel',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#334155'),
    ))
    styles.add(ParagraphStyle(
        name='TotalValue',
        parent=styles['Normal'],
        alignment=TA_RIGHT,
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#0F172A'),
    ))
    styles.add(ParagraphStyle(
        name='GrandTotalValue',
        parent=styles['Normal'],
        alignment=TA_RIGHT,
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=15,
        textColor=colors.HexColor('#0F172A'),
    ))

    def label_value(label: str, value) -> Paragraph:
        value_text = text(value) or 'N/A'
        return Paragraph(f"<b>{text(label)}:</b> {value_text}", styles['Small'])

    def draw_footer(canvas, doc):
        canvas.saveState()
        page_w, _ = A4
        canvas.setFont('Helvetica', 7)
        canvas.setFillColor(colors.HexColor('#64748B'))
        canvas.drawRightString(page_w - doc.rightMargin, 8 * mm, f"Pagina {doc.page}")
        if anulada:
            canvas.setFont('Helvetica-Bold', 54)
            canvas.setFillColor(colors.Color(0.85, 0.15, 0.15, alpha=0.10))
            canvas.translate(page_w / 2, 150 * mm)
            canvas.rotate(34)
            canvas.drawCentredString(0, 0, 'ANULADA')
        canvas.restoreState()

    doc_card = Table(
        [[
            Paragraph(f"{text(documento_label)}<br/><font size='7'>{impresion_label}</font>", styles['DocTitle']),
            Paragraph(
                f"{text(tipo)}-{text(no_factura)}<br/><font size='7'>NCF: {text(ncf_label)}</font>",
                styles['DocNumber'],
            ),
        ]],
        colWidths=[28 * mm, doc_card_width - 28 * mm],
        rowHeights=[18 * mm],
    )
    doc_card.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#0F172A')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ('BOX', (0, 0), (-1, -1), 0.6, colors.HexColor('#0F172A')),
    ]))

    # Logo empresa (si esta subido via /api/cnt/cia-header/)
    from apps.legacy.logo_helpers import get_logo_path
    _logo_path = get_logo_path((cia or {}).get('no_cia') or factura.get('no_cia'))
    _logo_img = None
    if _logo_path:
        try:
            from reportlab.platypus import Image as _Img
            _logo_img = _Img(str(_logo_path), width=22 * mm, height=22 * mm, kind='proportional')
        except Exception:
            _logo_img = None

    _company_block = [
        Paragraph(text(razon_social or 'Empresa'), styles['FacturaTitle']),
        Paragraph(text(cia_direccion) or 'Direccion no registrada', styles['FacturaSubtitle']),
        Paragraph(
            ' | '.join(
                part for part in [
                    f"RNC: {text(cia_rnc)}" if cia_rnc else '',
                    f"Tel.: {text(cia_telefono)}" if cia_telefono else '',
                ]
                if part
            ) or 'RNC/telefono no registrados',
            styles['FacturaSubtitle'],
        ),
    ]

    if _logo_img is not None:
        _company_cell = Table(
            [[_logo_img, _company_block]],
            colWidths=[24 * mm, None],
        )
        _company_cell.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (0, 0), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ]))
        _left_col = _company_cell
    else:
        _left_col = _company_block

    header = Table(
        [[_left_col, doc_card]],
        colWidths=[width - doc_card_width - 4 * mm, doc_card_width],
    )
    header.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))

    cliente_rows = [
        [label_value('Cliente', nombre_cliente), label_value('No. Cliente', factura.get('no_cliente'))],
        [label_value('RNC/Cedula', rnc_cliente or 'N/A'), label_value('Fecha', fecha_display or 'N/A')],
        [label_value('Direccion', direccion_cliente or 'N/A'), label_value('Condicion', cond_pago_display)],
        [label_value('Vendedor', vendedor_display or 'N/A'), label_value('Plazo', f"{factura.get('plazo_pago') or 0} dias")],
    ]
    cliente_panel = Table(cliente_rows, colWidths=[width * 0.62, width * 0.38])
    cliente_panel.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#E2E8F0')),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))

    fiscal_panel = Table(
        [[
            label_value('Tipo NCF', tipo_ncf_label),
            label_value('Estado', 'Anulada' if anulada else impresion_label),
            label_value('Forma Pago', forma_pago_display),
            label_value('Fecha', fecha_display or 'N/A'),
        ]],
        colWidths=[width * 0.30, width * 0.22, width * 0.30, width * 0.18],
    )
    fiscal_panel.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#EFF6FF')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#BFDBFE')),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#DBEAFE')),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))

    line_data = [[
        Paragraph('Ln', styles['TableHeadCenter']),
        Paragraph('Codigo', styles['TableHead']),
        Paragraph('Descripcion', styles['TableHead']),
        Paragraph('Cant.', styles['TableHeadRight']),
        Paragraph('Precio', styles['TableHeadRight']),
        Paragraph('% Desc.', styles['TableHeadRight']),
        Paragraph('ITBIS', styles['TableHeadRight']),
        Paragraph('Total', styles['TableHeadRight']),
    ]]
    active_lineas = [
        l for l in factura.get('lineas', [])
        if (l.get('st_anulado') or 'N') == 'N'
    ]
    for linea in active_lineas:
        regalia = float(linea.get('cantidad_regalia') or 0)
        desc = text(linea.get('descripcion') or '')
        if regalia:
            desc = f"{desc}<br/><font color='#64748B'>Regalia: {qty(regalia)}</font>"
        line_data.append([
            Paragraph(text(linea.get('no_linea')), styles['SmallCenter']),
            Paragraph(text(linea.get('no_produ')), styles['Small']),
            Paragraph(desc, styles['Small']),
            Paragraph(qty(linea.get('cantidad')), styles['SmallRight']),
            Paragraph(money(linea.get('precio')), styles['SmallRight']),
            Paragraph(money(linea.get('descuento')), styles['SmallRight']),
            Paragraph(money(linea.get('impuesto')), styles['SmallRight']),
            Paragraph(money(linea.get('monto_neto')), styles['SmallRight']),
        ])
    if not active_lineas:
        line_data.append([
            '',
            '',
            Paragraph('Sin lineas facturadas.', styles['Small']),
            '',
            '',
            '',
            '',
            '',
        ])

    line_table = Table(
        line_data,
        colWidths=[8 * mm, 22 * mm, width - 130 * mm, 17 * mm, 21 * mm, 18 * mm, 20 * mm, 24 * mm],
        repeatRows=1,
    )
    line_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
        ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#CBD5E1')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))

    nota = (factura.get('nota') or factura.get('detalle') or '').strip()
    nota_panel = Table(
        [[Paragraph('<b>Nota / detalle:</b> ' + (text(nota) if nota else 'N/A'), styles['Small'])]],
        colWidths=[width - 84 * mm],
    )
    nota_panel.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FFF7ED')),
        ('BOX', (0, 0), (-1, -1), 0.4, colors.HexColor('#FDBA74')),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))

    total_rows = [
        [Paragraph('Subtotal', styles['TotalLabel']), Paragraph(money(subtotal), styles['TotalValue'])],
        [Paragraph('Descuento', styles['TotalLabel']), Paragraph(money(descuento_total), styles['TotalValue'])],
        [Paragraph('ITBIS', styles['TotalLabel']), Paragraph(money(impuesto_total), styles['TotalValue'])],
    ]
    if propina_total:
        total_rows.append([Paragraph('Propina', styles['TotalLabel']), Paragraph(money(propina_total), styles['TotalValue'])])
    total_rows.append([
        Paragraph('Total Neto', styles['TotalLabel']),
        Paragraph(money(total_general), styles['GrandTotalValue']),
    ])
    totals = Table(total_rows, colWidths=[36 * mm, 42 * mm])
    totals.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -2), colors.HexColor('#F8FAFC')),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#E0F2FE')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#E2E8F0')),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))

    footer_table = Table([[nota_panel, totals]], colWidths=[width - 82 * mm, 82 * mm])
    footer_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))

    signature_table = Table(
        [
            [
                Paragraph('____________________________', styles['SmallCenter']),
                '',
                Paragraph('____________________________', styles['SmallCenter']),
            ],
            [
                Paragraph('Recibido por', styles['SmallCenter']),
                '',
                Paragraph('Entregado por', styles['SmallCenter']),
            ],
        ],
        colWidths=[70 * mm, width - 140 * mm, 70 * mm],
    )
    signature_table.setStyle(TableStyle([
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))

    elements = [
        header,
        Spacer(1, 4 * mm),
        cliente_panel,
        Spacer(1, 2 * mm),
        fiscal_panel,
        Spacer(1, 4 * mm),
        line_table,
        Spacer(1, 4 * mm),
        KeepTogether(footer_table),
        Spacer(1, 4 * mm),
        KeepTogether(signature_table),
    ]

    doc_pdf.build(elements, onFirstPage=draw_footer, onLaterPages=draw_footer)
    buffer.seek(0)
    return buffer.read()


# -- Conduce / Cotizacion en estilo moderno A4 -------------------------------
# Comparte el lenguaje visual de la factura moderna (header oscuro + paneles
# claros) pero replica los campos del PDF legado Rfat218 (cotizacion) /
# equivalente conduce: codigo+nombre cliente, RNC, dir, condicion de pago,
# vendedor, tabla con UM y referencia, importe en letras, 3 firmas y nota
# COTIZACION VALIDA POR 7 DIAS cuando aplica.

_UNIDADES = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
             'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete',
             'dieciocho', 'diecinueve', 'veinte']
_DECENAS = ['', '', 'veinti', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta',
            'ochenta', 'noventa']
_CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
             'seiscientos', 'setecientos', 'ochocientos', 'novecientos']


def _numero_a_letras(n: int) -> str:
    if n < 0:
        return f"menos {_numero_a_letras(-n)}"
    if n <= 20:
        return _UNIDADES[n]
    if n < 100:
        d, u = divmod(n, 10)
        if u == 0:
            return _DECENAS[d] if d != 2 else 'veinte'
        if d == 2:
            return f"veinti{_UNIDADES[u]}"
        return f"{_DECENAS[d]} y {_UNIDADES[u]}"
    if n == 100:
        return 'cien'
    if n < 1000:
        c, r = divmod(n, 100)
        resto = f" {_numero_a_letras(r)}" if r else ''
        return f"{_CENTENAS[c]}{resto}"
    if n < 1_000_000:
        miles, r = divmod(n, 1000)
        if miles == 1:
            cabeza = 'mil'
        else:
            cabeza = f"{_numero_a_letras(miles)} mil"
        resto = f" {_numero_a_letras(r)}" if r else ''
        return f"{cabeza}{resto}"
    if n < 1_000_000_000:
        millones, r = divmod(n, 1_000_000)
        cabeza = 'un millon' if millones == 1 else f"{_numero_a_letras(millones)} millones"
        resto = f" {_numero_a_letras(r)}" if r else ''
        return f"{cabeza}{resto}"
    return str(n)


def _importe_en_letras(monto: float) -> str:
    """Devuelve '**XXX PESOS CON YY/100**' al estilo legado."""
    entero = int(monto)
    centavos = round((monto - entero) * 100)
    if centavos >= 100:
        entero += 1
        centavos -= 100
    palabras = _numero_a_letras(entero).upper()
    if entero == 1:
        moneda = 'PESO'
    else:
        moneda = 'PESOS'
    return f"**{palabras} {moneda} CON {centavos:02d}/100**"


def _render_conduce_pdf_moderno(*, conduce, cia, razon_social, nombre_cliente,
                                rnc_cliente, direccion_cliente,
                                nombre_vendedor, descripcion_cond_pago,
                                impreso_por: str = '') -> bytes:
    """Conduce / Cotizacion / Pedido en estilo factura A4 moderna."""
    import io
    from datetime import datetime
    from html import escape

    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        KeepTogether,
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    tipo = (conduce.get('tipo_conduce') or '').strip().upper()
    no_conduce = (conduce.get('no_conduce') or '').strip()
    documento_label = {'CO': 'Conduce', 'CT': 'Cotizacion', 'PD': 'Pedido'}.get(
        tipo, 'Documento')
    es_cotizacion = tipo == 'CT'

    fecha = (conduce.get('fecha') or '').strip()
    fecha_display = (
        f"{fecha[8:10]}/{fecha[5:7]}/{fecha[:4]}" if fecha and len(fecha) >= 10 else (fecha or 'N/A')
    )

    cond_pago_display = descripcion_cond_pago or 'N/A'
    no_cliente_disp = str(conduce.get('no_cliente') or '').strip()
    if no_cliente_disp:
        no_cliente_disp = no_cliente_disp.zfill(7)
    vendedor_codigo = (conduce.get('vendedor') or '').strip()
    vendedor_display = (
        f"{vendedor_codigo} - {nombre_vendedor}" if nombre_vendedor else (vendedor_codigo or 'N/A')
    )

    ncf_dgi = (conduce.get('ncf_dgi') or '').strip()
    if ncf_dgi:
        ncf_label = ncf_dgi
    elif es_cotizacion:
        ncf_label = 'No aplica'
    else:
        ncf_label = '(pendiente facturacion)'

    no_factura = (conduce.get('no_factura') or '').strip()
    tipo_factura = (conduce.get('tipo_factura') or '').strip()
    factura_vinculada = (
        f"{tipo_factura}-{no_factura}" if no_factura else ''
    )

    anulado = (conduce.get('st_anulado') or 'N') == 'S'
    reimpreso = (conduce.get('st_impresion') or 'N') == 'S'
    impresion_label = 'REIMPRESO' if reimpreso else 'IMPRESO'

    cia_direccion = (cia.get('direccion') or '').strip()
    cia_rnc = (cia.get('rnc') or '').strip()
    cia_telefono = (cia.get('telefono') or '').strip()

    def text(value) -> str:
        return escape(str(value if value is not None else '').strip())

    def money(value) -> str:
        return f"{float(value or 0):,.2f}"

    def qty(value) -> str:
        amount = float(value or 0)
        if amount.is_integer():
            return f"{amount:,.0f}"
        return f"{amount:,.2f}"

    subtotal = float(conduce.get('total_linea') or 0)
    descuento_total = float(conduce.get('descuento') or 0)
    impuesto_total = float(conduce.get('impuesto') or 0)
    total_general = float(conduce.get('total_neto') or 0)

    buffer = io.BytesIO()
    doc_pdf = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=14 * mm, rightMargin=14 * mm,
        topMargin=12 * mm, bottomMargin=14 * mm,
    )
    width = doc_pdf.width
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='FtTitle', parent=styles['Heading1'],
        fontName='Helvetica-Bold', fontSize=18, leading=20,
        textColor=colors.HexColor('#0F172A'), spaceAfter=4))
    styles.add(ParagraphStyle(name='FtSub', parent=styles['Normal'],
        fontSize=8.5, leading=11, textColor=colors.HexColor('#475569')))
    styles.add(ParagraphStyle(name='FtSmall', parent=styles['Normal'],
        fontSize=7.5, leading=9, textColor=colors.HexColor('#334155')))
    styles.add(ParagraphStyle(name='FtSmallR', parent=styles['FtSmall'], alignment=TA_RIGHT))
    styles.add(ParagraphStyle(name='FtSmallC', parent=styles['FtSmall'], alignment=TA_CENTER))
    styles.add(ParagraphStyle(name='FtHead', parent=styles['FtSmall'],
        fontName='Helvetica-Bold', textColor=colors.white))
    styles.add(ParagraphStyle(name='FtHeadR', parent=styles['FtHead'], alignment=TA_RIGHT))
    styles.add(ParagraphStyle(name='FtHeadC', parent=styles['FtHead'], alignment=TA_CENTER))
    styles.add(ParagraphStyle(name='FtDocTitle', parent=styles['Normal'],
        alignment=TA_RIGHT, fontName='Helvetica-Bold', fontSize=10, leading=11,
        textColor=colors.white))
    styles.add(ParagraphStyle(name='FtDocNumber', parent=styles['Normal'],
        alignment=TA_RIGHT, fontName='Helvetica-Bold', fontSize=15, leading=16,
        textColor=colors.white))
    styles.add(ParagraphStyle(name='FtTotalLbl', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=8, leading=10,
        textColor=colors.HexColor('#334155')))
    styles.add(ParagraphStyle(name='FtTotalVal', parent=styles['Normal'],
        alignment=TA_RIGHT, fontName='Helvetica-Bold', fontSize=8, leading=10,
        textColor=colors.HexColor('#0F172A')))
    styles.add(ParagraphStyle(name='FtGrandTotal', parent=styles['Normal'],
        alignment=TA_RIGHT, fontName='Helvetica-Bold', fontSize=13, leading=15,
        textColor=colors.HexColor('#0F172A')))
    styles.add(ParagraphStyle(name='FtNote', parent=styles['Normal'],
        alignment=TA_CENTER, fontName='Helvetica-Bold', fontSize=9, leading=11,
        textColor=colors.HexColor('#0F172A')))

    def label_value(label: str, value) -> Paragraph:
        value_text = text(value) or 'N/A'
        return Paragraph(f"<b>{text(label)}:</b> {value_text}", styles['FtSmall'])

    def draw_footer(canvas, doc):
        canvas.saveState()
        page_w, _ = A4
        canvas.setFont('Helvetica', 7)
        canvas.setFillColor(colors.HexColor('#64748B'))
        canvas.drawRightString(page_w - doc.rightMargin, 8 * mm, f"Pagina {doc.page}")
        if impreso_por:
            canvas.drawString(doc.leftMargin, 8 * mm,
                f"Impreso por: {impreso_por}  -  {datetime.now().strftime('%d/%m/%Y %H:%M')}")
        if anulado:
            canvas.setFont('Helvetica-Bold', 54)
            canvas.setFillColor(colors.Color(0.85, 0.15, 0.15, alpha=0.10))
            canvas.translate(page_w / 2, 150 * mm)
            canvas.rotate(34)
            canvas.drawCentredString(0, 0, 'ANULADO')
        canvas.restoreState()

    doc_card = Table(
        [[
            Paragraph(f"{text(documento_label)}<br/>"
                      f"<font size='7'>{impresion_label}</font>",
                      styles['FtDocTitle']),
            Paragraph(f"{text(tipo)}-{text(no_conduce)}<br/>"
                      f"<font size='7'>NCF: {text(ncf_label)}</font>",
                      styles['FtDocNumber']),
        ]],
        colWidths=[34 * mm, 58 * mm], rowHeights=[20 * mm],
    )
    doc_card.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#0F172A')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('BOX', (0, 0), (-1, -1), 0.6, colors.HexColor('#0F172A')),
    ]))

    # Logo empresa (si esta subido via /api/cnt/cia-header/)
    from apps.legacy.logo_helpers import get_logo_path
    _logo_path = get_logo_path((cia or {}).get('no_cia') or conduce.get('no_cia'))
    _logo_img = None
    if _logo_path:
        try:
            from reportlab.platypus import Image as _Img
            _logo_img = _Img(str(_logo_path), width=22 * mm, height=22 * mm, kind='proportional')
        except Exception:
            _logo_img = None

    _company_block = [
        Paragraph(text(razon_social or 'Empresa'), styles['FtTitle']),
        Paragraph(text(cia_direccion) or 'Direccion no registrada', styles['FtSub']),
        Paragraph(' | '.join(p for p in [
            f"RNC: {text(cia_rnc)}" if cia_rnc else '',
            f"Tel.: {text(cia_telefono)}" if cia_telefono else '',
        ] if p) or 'RNC/telefono no registrados', styles['FtSub']),
    ]

    if _logo_img is not None:
        _company_cell = Table(
            [[_logo_img, _company_block]],
            colWidths=[24 * mm, None],
        )
        _company_cell.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (0, 0), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ]))
        _left_col = _company_cell
    else:
        _left_col = _company_block

    header = Table(
        [[_left_col, doc_card]],
        colWidths=[width - 94 * mm, 94 * mm],
    )
    header.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))

    cliente_rows = [
        [label_value('Cliente', f"{no_cliente_disp} {nombre_cliente}".strip() or 'N/A'),
         label_value('Fecha', fecha_display)],
        [label_value('RNC/Cedula', rnc_cliente or 'N/A'),
         label_value('Condicion', cond_pago_display)],
        [label_value('Direccion', direccion_cliente or 'N/A'),
         label_value('Vendedor', vendedor_display)],
    ]
    if factura_vinculada:
        cliente_rows.append([
            label_value('Factura vinculada', factura_vinculada),
            label_value('Tipo Moneda', conduce.get('tipo_moneda') or 'RD'),
        ])
    cliente_panel = Table(cliente_rows, colWidths=[width * 0.62, width * 0.38])
    cliente_panel.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#E2E8F0')),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))

    line_data = [[
        Paragraph('Ln', styles['FtHeadC']),
        Paragraph('Codigo', styles['FtHead']),
        Paragraph('UM', styles['FtHeadC']),
        Paragraph('Descripcion', styles['FtHead']),
        Paragraph('Cant.', styles['FtHeadR']),
        Paragraph('Precio', styles['FtHeadR']),
        Paragraph('% Desc.', styles['FtHeadR']),
        Paragraph('ITBIS', styles['FtHeadR']),
        Paragraph('Total Neto', styles['FtHeadR']),
    ]]
    active_lineas = [
        l for l in conduce.get('lineas', [])
        if (l.get('st_anulado') or 'N') == 'N'
    ]
    renglones = 0
    for linea in active_lineas:
        cant = float(linea.get('cantidad') or 0)
        precio = float(linea.get('precio') or 0)
        porc_desc = float(linea.get('porc_descuento') or 0)
        itbis = float(linea.get('itbis') or linea.get('impuesto') or 0)
        total_linea = cant * precio * (1 - porc_desc / 100) + itbis
        line_data.append([
            Paragraph(text(linea.get('no_linea')), styles['FtSmallC']),
            Paragraph(text(linea.get('no_produ')), styles['FtSmall']),
            Paragraph(text(linea.get('unidad') or 'UND'), styles['FtSmallC']),
            Paragraph(text(linea.get('descripcion') or ''), styles['FtSmall']),
            Paragraph(qty(cant), styles['FtSmallR']),
            Paragraph(money(precio), styles['FtSmallR']),
            Paragraph(f"{porc_desc:.2f}", styles['FtSmallR']),
            Paragraph(money(itbis), styles['FtSmallR']),
            Paragraph(money(total_linea), styles['FtSmallR']),
        ])
        renglones += 1
    if not active_lineas:
        line_data.append([
            '', '', '', Paragraph('Sin lineas registradas.', styles['FtSmall']),
            '', '', '', '', '',
        ])

    line_table = Table(
        line_data,
        colWidths=[8 * mm, 22 * mm, 12 * mm, width - 140 * mm,
                   17 * mm, 21 * mm, 16 * mm, 20 * mm, 24 * mm],
        repeatRows=1,
    )
    line_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
        ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#CBD5E1')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))

    suma_letras = _importe_en_letras(total_general)
    suma_panel = Table(
        [[Paragraph(f"<b>La Suma de:</b> {text(suma_letras)}", styles['FtSmall'])]],
        colWidths=[width - 84 * mm],
    )
    suma_panel.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FFF7ED')),
        ('BOX', (0, 0), (-1, -1), 0.4, colors.HexColor('#FDBA74')),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))

    total_rows = [
        [Paragraph('Subtotal', styles['FtTotalLbl']),
         Paragraph(money(subtotal), styles['FtTotalVal'])],
        [Paragraph('Descuento', styles['FtTotalLbl']),
         Paragraph(money(descuento_total), styles['FtTotalVal'])],
        [Paragraph('ITBIS', styles['FtTotalLbl']),
         Paragraph(money(impuesto_total), styles['FtTotalVal'])],
        [Paragraph('Total Neto', styles['FtTotalLbl']),
         Paragraph(money(total_general), styles['FtGrandTotal'])],
    ]
    totals = Table(total_rows, colWidths=[36 * mm, 42 * mm])
    totals.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -2), colors.HexColor('#F8FAFC')),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#E0F2FE')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#E2E8F0')),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))

    footer_table = Table([[suma_panel, totals]], colWidths=[width - 82 * mm, 82 * mm])
    footer_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))

    detalle = (conduce.get('detalle') or '').strip()
    observ_panel = None
    if detalle:
        observ_panel = Table(
            [[Paragraph(f"<b>Observaciones:</b> {text(detalle)}", styles['FtSmall'])]],
            colWidths=[width],
        )
        observ_panel.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F1F5F9')),
            ('BOX', (0, 0), (-1, -1), 0.4, colors.HexColor('#94A3B8')),
            ('LEFTPADDING', (0, 0), (-1, -1), 7),
            ('RIGHTPADDING', (0, 0), (-1, -1), 7),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))

    # 3 firmas legacy: Realizado, Autorizado, Recibido
    col_third = (width - 8 * mm) / 3
    signature_table = Table(
        [
            [
                Paragraph('____________________________', styles['FtSmallC']),
                Paragraph('____________________________', styles['FtSmallC']),
                Paragraph('____________________________', styles['FtSmallC']),
            ],
            [
                Paragraph('<b>Realizado por</b>', styles['FtSmallC']),
                Paragraph('<b>Autorizado por</b>', styles['FtSmallC']),
                Paragraph('<b>Recibido por</b>', styles['FtSmallC']),
            ],
        ],
        colWidths=[col_third, col_third, col_third],
    )
    signature_table.setStyle(TableStyle([
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))

    elements = [
        header,
        Spacer(1, 4 * mm),
        cliente_panel,
        Spacer(1, 3 * mm),
        line_table,
        Spacer(1, 2 * mm),
        Paragraph(f"<font size='7'>{renglones} renglon(es)</font>", styles['FtSmall']),
        Spacer(1, 2 * mm),
        KeepTogether(footer_table),
    ]
    if observ_panel is not None:
        elements += [Spacer(1, 3 * mm), observ_panel]
    elements += [Spacer(1, 6 * mm), KeepTogether(signature_table)]
    if es_cotizacion:
        elements += [
            Spacer(1, 4 * mm),
            Paragraph('COTIZACION VALIDA POR 7 DIAS', styles['FtNote']),
        ]

    doc_pdf.build(elements, onFirstPage=draw_footer, onLaterPages=draw_footer)
    buffer.seek(0)
    return buffer.read()


# -- Reportes en estilo factura moderna (compartido para todos los listados) --

def _render_modern_report_pdf(*, report_id: str, title: str, cia,
                              subtitle_lines: list[str] = None,
                              info_blocks: list[dict] = None,
                              sections: list[dict],
                              signature_labels: list[str] = None,
                              impreso_por: str = '',
                              orientation: str = 'portrait') -> bytes:
    """Helper unificado para listados/reportes con el estilo factura moderna.

    `sections` es una lista de bloques `{title, columns, rows, totals_row?, group_by?}`.
    `columns`: lista de dict {key, label, align?: 'left'|'right'|'center', width?: mm}.
    `rows`: lista de dict con los valores por `key`. Para subtotales/totales por
    grupo, set `group_by` = key — el helper inserta filas resumen.
    """
    import io
    from datetime import datetime
    from html import escape

    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
    )

    cia_descripcion = (cia.get('descripcion') or 'Empresa').strip()
    cia_direccion = (cia.get('direccion') or '').strip()
    cia_rnc = (cia.get('rnc') or '').strip()
    cia_telefono = (cia.get('telefono') or '').strip()

    page_size = landscape(A4) if orientation == 'landscape' else A4
    buffer = io.BytesIO()
    doc_pdf = SimpleDocTemplate(
        buffer, pagesize=page_size,
        leftMargin=12 * mm, rightMargin=12 * mm,
        topMargin=12 * mm, bottomMargin=16 * mm,
    )
    width = doc_pdf.width
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='RpTitle', parent=styles['Heading1'],
        fontName='Helvetica-Bold', fontSize=18, leading=20,
        textColor=colors.HexColor('#0F172A'), spaceAfter=4))
    styles.add(ParagraphStyle(name='RpSub', parent=styles['Normal'],
        fontSize=8.5, leading=11, textColor=colors.HexColor('#475569')))
    styles.add(ParagraphStyle(name='RpSmall', parent=styles['Normal'],
        fontSize=7.5, leading=9, textColor=colors.HexColor('#334155')))
    styles.add(ParagraphStyle(name='RpSmallR', parent=styles['RpSmall'], alignment=TA_RIGHT))
    styles.add(ParagraphStyle(name='RpSmallC', parent=styles['RpSmall'], alignment=TA_CENTER))
    styles.add(ParagraphStyle(name='RpHead', parent=styles['RpSmall'],
        fontName='Helvetica-Bold', textColor=colors.white))
    styles.add(ParagraphStyle(name='RpHeadR', parent=styles['RpHead'], alignment=TA_RIGHT))
    styles.add(ParagraphStyle(name='RpHeadC', parent=styles['RpHead'], alignment=TA_CENTER))
    styles.add(ParagraphStyle(name='RpDocTitle', parent=styles['Normal'],
        alignment=TA_RIGHT, fontName='Helvetica-Bold', fontSize=10, leading=11,
        textColor=colors.white))
    styles.add(ParagraphStyle(name='RpDocNumber', parent=styles['Normal'],
        alignment=TA_RIGHT, fontName='Helvetica-Bold', fontSize=14, leading=15,
        textColor=colors.white))
    styles.add(ParagraphStyle(name='RpSecTitle', parent=styles['Heading2'],
        fontName='Helvetica-Bold', fontSize=11, leading=13,
        textColor=colors.HexColor('#0F172A'), spaceAfter=4))

    def text(value) -> str:
        return escape(str(value if value is not None else '').strip())

    def fmt_cell(value, fmt: str) -> str:
        if value is None or value == '':
            return ''
        if fmt == 'money':
            try:
                return f"{float(value):,.2f}"
            except Exception:
                return str(value)
        if fmt == 'qty':
            try:
                amt = float(value)
                return f"{amt:,.0f}" if amt.is_integer() else f"{amt:,.2f}"
            except Exception:
                return str(value)
        if fmt == 'pct':
            try:
                return f"{float(value):.2f}"
            except Exception:
                return str(value)
        return str(value)

    def style_for(align: str, head: bool = False) -> ParagraphStyle:
        if head:
            return {'right': styles['RpHeadR'], 'center': styles['RpHeadC']}.get(align, styles['RpHead'])
        return {'right': styles['RpSmallR'], 'center': styles['RpSmallC']}.get(align, styles['RpSmall'])

    def draw_footer(canvas, doc):
        canvas.saveState()
        page_w, _ = page_size
        canvas.setFont('Helvetica', 7)
        canvas.setFillColor(colors.HexColor('#64748B'))
        canvas.drawRightString(page_w - doc.rightMargin, 8 * mm, f"Pagina {doc.page}")
        if impreso_por:
            stamp = f"Impreso por: {impreso_por}  -  {datetime.now().strftime('%d/%m/%Y %H:%M')}"
            canvas.drawString(doc.leftMargin, 8 * mm, stamp)
        if report_id:
            canvas.drawCentredString(page_w / 2, 8 * mm, f"Ref: {report_id}")
        canvas.restoreState()

    doc_card = Table(
        [[
            Paragraph(text(title), styles['RpDocTitle']),
            Paragraph(f"{text(report_id)}<br/>"
                      f"<font size='7'>{datetime.now().strftime('%d/%m/%Y %H:%M')}</font>",
                      styles['RpDocNumber']),
        ]],
        colWidths=[60 * mm, 40 * mm], rowHeights=[20 * mm],
    )
    doc_card.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#0F172A')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('BOX', (0, 0), (-1, -1), 0.6, colors.HexColor('#0F172A')),
    ]))
    # Logo empresa (si esta subido via /api/cnt/cia-header/)
    from apps.legacy.logo_helpers import get_logo_path
    _logo_path = get_logo_path((cia or {}).get('no_cia'))
    _logo_img = None
    if _logo_path:
        try:
            from reportlab.platypus import Image as _Img
            _logo_img = _Img(str(_logo_path), width=22 * mm, height=22 * mm, kind='proportional')
        except Exception:
            _logo_img = None

    _company_block = [
        Paragraph(text(cia_descripcion), styles['RpTitle']),
        Paragraph(text(cia_direccion) or 'Direccion no registrada', styles['RpSub']),
        Paragraph(' | '.join(p for p in [
            f"RNC: {text(cia_rnc)}" if cia_rnc else '',
            f"Tel.: {text(cia_telefono)}" if cia_telefono else '',
        ] if p) or 'RNC/telefono no registrados', styles['RpSub']),
    ]

    if _logo_img is not None:
        _company_cell = Table(
            [[_logo_img, _company_block]],
            colWidths=[24 * mm, None],
        )
        _company_cell.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (0, 0), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ]))
        _left_col = _company_cell
    else:
        _left_col = _company_block

    header = Table(
        [[_left_col, doc_card]],
        colWidths=[width - 102 * mm, 102 * mm],
    )
    header.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))

    elements = [header, Spacer(1, 2 * mm)]
    if subtitle_lines:
        subtitle_panel = Table(
            [[Paragraph(' &nbsp; • &nbsp; '.join(text(s) for s in subtitle_lines if s),
                        styles['RpSmall'])]],
            colWidths=[width],
        )
        subtitle_panel.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        elements += [subtitle_panel, Spacer(1, 3 * mm)]

    if info_blocks:
        styles.add(ParagraphStyle(name='RpBlockTitle', parent=styles['Normal'],
            fontName='Helvetica-Bold', fontSize=7.5, leading=9,
            textColor=colors.HexColor('#0F172A'), spaceAfter=2))
        styles.add(ParagraphStyle(name='RpKvLabel', parent=styles['Normal'],
            fontName='Helvetica', fontSize=8, leading=10,
            textColor=colors.HexColor('#64748B')))
        styles.add(ParagraphStyle(name='RpKvValue', parent=styles['Normal'],
            fontName='Helvetica-Bold', fontSize=8, leading=10,
            textColor=colors.HexColor('#0F172A')))
        styles.add(ParagraphStyle(name='RpKvValueBig', parent=styles['Normal'],
            fontName='Helvetica-Bold', fontSize=10, leading=12,
            textColor=colors.HexColor('#0F172A')))
        styles.add(ParagraphStyle(name='RpInlineLabel', parent=styles['Normal'],
            fontName='Helvetica', fontSize=8, leading=10,
            textColor=colors.HexColor('#64748B')))

        def _kv_subtable(block_rows, value_style=None):
            vstyle = value_style or styles['RpKvValue']
            data = []
            for label, value in block_rows:
                data.append([
                    Paragraph(text(label) + ':', styles['RpKvLabel']),
                    Paragraph(text(value), vstyle),
                ])
            if not data:
                data = [[Paragraph('', styles['RpKvLabel']),
                         Paragraph('', styles['RpKvValue'])]]
            t = Table(data, colWidths=[26 * mm, None])
            t.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (-1, -1), 4),
                ('TOPPADDING', (0, 0), (-1, -1), 1),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
            ]))
            return t

        def _render_block(block, col_width):
            title_p = (
                Paragraph(text(block.get('title', '')).upper(),
                          styles['RpBlockTitle'])
                if block.get('title') else None
            )
            if block.get('inline'):
                rows = block.get('rows', []) or []
                last_idx = len(rows) - 1
                parts = []
                for i, (lbl, val) in enumerate(rows):
                    big = (i == last_idx)
                    val_color = '#0F172A'
                    if big:
                        parts.append(
                            f"<font color='#64748B'>{text(lbl)}:</font> "
                            f"<font color='{val_color}' size='10'><b>{text(val)}</b></font>"
                        )
                    else:
                        parts.append(
                            f"<font color='#64748B'>{text(lbl)}:</font> "
                            f"<b>{text(val)}</b>"
                        )
                body = Paragraph('  &nbsp; &nbsp; '.join(parts),
                                 styles['RpKvValue'])
            else:
                body = _kv_subtable(block.get('rows', []) or [])
            cell = []
            if title_p:
                cell.append(title_p)
            cell.append(body)
            return cell

        blocks_data = []
        i = 0
        blocks = [b for b in info_blocks if b]
        while i < len(blocks):
            b = blocks[i]
            if b.get('span_full'):
                col_w = width
                cell = _render_block(b, col_w)
                row = Table([[cell]], colWidths=[col_w])
                row.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F1F5F9')),
                    ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('LEFTPADDING', (0, 0), (-1, -1), 8),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                    ('TOPPADDING', (0, 0), (-1, -1), 5),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ]))
                blocks_data.append(row)
                i += 1
            else:
                left = b
                right = blocks[i + 1] if (i + 1) < len(blocks) and not blocks[i + 1].get('span_full') else None
                col_w = width / 2 - 1 * mm
                left_cell = _render_block(left, col_w)
                right_cell = _render_block(right, col_w) if right else [Paragraph('', styles['RpSmall'])]
                row = Table(
                    [[left_cell, right_cell]],
                    colWidths=[col_w, col_w],
                )
                row.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
                    ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
                    ('LINEAFTER', (0, 0), (0, 0), 0.4, colors.HexColor('#CBD5E1')),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('LEFTPADDING', (0, 0), (-1, -1), 8),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                    ('TOPPADDING', (0, 0), (-1, -1), 5),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ]))
                blocks_data.append(row)
                i += 2 if right else 1

        for blk in blocks_data:
            elements.append(blk)
            elements.append(Spacer(1, 1.5 * mm))
        elements.append(Spacer(1, 1.5 * mm))

    for section in sections:
        sec_title = section.get('title') or ''
        columns = section.get('columns', [])
        rows = section.get('rows', [])
        totals_row = section.get('totals_row')
        group_by = section.get('group_by')

        if sec_title:
            elements.append(Paragraph(text(sec_title), styles['RpSecTitle']))

        header_cells = [
            Paragraph(text(c.get('label') or c['key']), style_for(c.get('align', 'left'), head=True))
            for c in columns
        ]
        table_data = [header_cells]

        def push_row(row, is_group_total=False):
            cells = []
            for c in columns:
                v = row.get(c['key'])
                txt = fmt_cell(v, c.get('format', ''))
                cells.append(Paragraph(text(txt), style_for(c.get('align', 'left'))))
            table_data.append(cells)
            if is_group_total:
                section.setdefault('_subtotal_indices', []).append(len(table_data) - 1)

        if group_by and rows:
            current_group = None
            group_buf = []
            agg = {c['key']: 0.0 for c in columns if c.get('format') in ('money', 'qty')}
            agg_count = 0

            def flush_group():
                nonlocal agg_count
                if group_buf:
                    for r in group_buf:
                        push_row(r)
                    subtotal_row = {c['key']: '' for c in columns}
                    subtotal_row[group_by] = f"Subtotal {current_group} ({agg_count})"
                    for k, v in agg.items():
                        if v:
                            subtotal_row[k] = v
                    push_row(subtotal_row, is_group_total=True)
                agg_count = 0
                for k in agg:
                    agg[k] = 0.0

            for r in rows:
                key_val = r.get(group_by) or ''
                if current_group is not None and key_val != current_group:
                    flush_group()
                    group_buf = []
                current_group = key_val
                group_buf.append(r)
                agg_count += 1
                for k in agg:
                    try:
                        agg[k] += float(r.get(k) or 0)
                    except Exception:
                        pass
            flush_group()
        else:
            for r in rows:
                push_row(r)

        if not rows:
            empty = [''] * len(columns)
            empty[0] = Paragraph('Sin registros para los filtros seleccionados.', styles['RpSmall'])
            table_data.append(empty)

        if totals_row:
            cells = []
            for c in columns:
                v = totals_row.get(c['key'], '')
                txt = fmt_cell(v, c.get('format', ''))
                style = style_for(c.get('align', 'left'))
                cells.append(Paragraph(f"<b>{text(txt)}</b>", style))
            table_data.append(cells)

        widths_explicit = [c.get('width') for c in columns]
        if all(w is not None for w in widths_explicit):
            col_widths = [w * mm for w in widths_explicit]
        else:
            col_widths = [width / len(columns)] * len(columns)

        table = Table(table_data, colWidths=col_widths, repeatRows=1)
        table_style = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
            ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#CBD5E1')),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]
        for idx in section.get('_subtotal_indices', []):
            table_style.append(('BACKGROUND', (0, idx), (-1, idx), colors.HexColor('#E0F2FE')))
            table_style.append(('FONTNAME', (0, idx), (-1, idx), 'Helvetica-Bold'))
        if totals_row:
            last = len(table_data) - 1
            table_style.append(('BACKGROUND', (0, last), (-1, last), colors.HexColor('#0EA5E9')))
            table_style.append(('TEXTCOLOR', (0, last), (-1, last), colors.white))
        table.setStyle(TableStyle(table_style))
        elements.append(table)
        elements.append(Spacer(1, 4 * mm))

    if signature_labels:
        col_w = (width - 4 * mm) / len(signature_labels)
        signature_row1 = [Paragraph('____________________________', styles['RpSmallC'])
                          for _ in signature_labels]
        signature_row2 = [Paragraph(f'<b>{text(l)}</b>', styles['RpSmallC'])
                          for l in signature_labels]
        signature_table = Table([signature_row1, signature_row2],
                                colWidths=[col_w] * len(signature_labels))
        signature_table.setStyle(TableStyle([
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements += [Spacer(1, 6 * mm), KeepTogether(signature_table)]

    doc_pdf.build(elements, onFirstPage=draw_footer, onLaterPages=draw_footer)
    buffer.seek(0)
    return buffer.read()


@login_required
@require_http_methods(["GET"])
def fat_cuadre_caja_pdf(request):
    """GET /api/fat/reportes/cuadre-caja/pdf/?no_cia=01&punto=01&desde=...&hasta=...

    Reporte Rfat237 modernizado: resumen por forma de pago, por NCF tipo y por
    NCF x forma de pago. Firmas Cajero/Supervisor.
    """
    try:
        from reportlab.lib.pagesizes import letter  # probe
    except ImportError:
        return JsonResponse({"error": "reportlab no instalado"}, status=500)

    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    desde = request.GET.get('desde', '')
    hasta = request.GET.get('hasta', '')
    tipo_factura = request.GET.get('tipo', '')
    no_cuadre = request.GET.get('no_cuadre', '')

    perms = permissions_repo.get_for(request.user.username, 'fat', no_cia, punto)
    if perms is None or not perms.activo:
        return JsonResponse({'detail': 'sin acceso a FAT en esta empresa/punto'}, status=403)

    try:
        resumen = fat_repo.get_cuadre_caja_detalle(no_cia, punto, tipo_factura, desde, hasta, no_cuadre)
        por_ncf = fat_repo.cuadre_caja_por_ncf(no_cia, punto, desde, hasta, tipo_factura, no_cuadre)
        por_ncf_forma_pago = fat_repo.cuadre_caja_por_ncf_forma_pago(
            no_cia, punto, desde, hasta, tipo_factura, no_cuadre)
    except Exception as e:
        return JsonResponse({"error": f"Error consultando cuadre: {e}"}, status=500)

    try:
        cia = next(
            (c for c in fat_repo.list_companias_fat() if str(c.get('no_cia')).strip() == no_cia),
            None,
        ) or {}
    except Exception:
        cia = {}
    if not cia:
        cia = inv_repo.get_compania(no_cia) or {}

    periodo = (f"Periodo: {desde} a {hasta}" if desde and hasta
               else (f"Periodo: desde {desde}" if desde else (f"Periodo: hasta {hasta}" if hasta else 'Acumulado')))

    total_general = sum(float(r.get('total') or 0) for r in resumen)

    section_resumen = {
        'title': 'Resumen por Forma de Pago',
        'columns': [
            {'key': 'tipo_pago', 'label': 'Cod.', 'align': 'center', 'width': 20},
            {'key': 'forma_pago', 'label': 'Tipo Pago', 'align': 'left', 'width': 80},
            {'key': 'cantidad', 'label': 'Cantidad', 'align': 'right', 'format': 'qty', 'width': 30},
            {'key': 'total', 'label': 'Monto', 'align': 'right', 'format': 'money', 'width': 56},
        ],
        'rows': resumen,
        'totals_row': {
            'forma_pago': 'Total Ingresos',
            'cantidad': sum(int(r.get('cantidad') or 0) for r in resumen),
            'total': total_general,
        },
    }

    section_ncf = {
        'title': 'Resumen por Tipo de NCF',
        'columns': [
            {'key': 'ncf_tipo', 'label': 'Tipo NCF', 'align': 'center', 'width': 22},
            {'key': 'cantidad', 'label': 'Cantidad', 'align': 'right', 'format': 'qty', 'width': 24},
            {'key': 'total_linea', 'label': 'Subtotal', 'align': 'right', 'format': 'money', 'width': 36},
            {'key': 'descuento', 'label': 'Descuento', 'align': 'right', 'format': 'money', 'width': 32},
            {'key': 'impuesto', 'label': 'ITBIS', 'align': 'right', 'format': 'money', 'width': 32},
            {'key': 'total_neto', 'label': 'Total Neto', 'align': 'right', 'format': 'money', 'width': 40},
        ],
        'rows': por_ncf,
        'totals_row': {
            'ncf_tipo': 'Total',
            'cantidad': sum(int(r.get('cantidad') or 0) for r in por_ncf),
            'total_linea': sum(float(r.get('total_linea') or 0) for r in por_ncf),
            'descuento': sum(float(r.get('descuento') or 0) for r in por_ncf),
            'impuesto': sum(float(r.get('impuesto') or 0) for r in por_ncf),
            'total_neto': sum(float(r.get('total_neto') or 0) for r in por_ncf),
        },
    }

    section_ncf_fp = {
        'title': 'Desglose Tipo NCF x Forma de Pago',
        'columns': [
            {'key': 'ncf_tipo', 'label': 'Tipo NCF', 'align': 'center', 'width': 22},
            {'key': 'tipo_pago', 'label': 'Cod.', 'align': 'center', 'width': 16},
            {'key': 'forma_pago', 'label': 'Forma de Pago', 'align': 'left', 'width': 60},
            {'key': 'cantidad', 'label': 'Cantidad', 'align': 'right', 'format': 'qty', 'width': 24},
            {'key': 'total', 'label': 'Monto', 'align': 'right', 'format': 'money', 'width': 40},
        ],
        'rows': por_ncf_forma_pago,
        'group_by': 'ncf_tipo',
    }

    try:
        pdf = _render_modern_report_pdf(
            report_id='Rfat237',
            title='Listado Cuadre de Caja',
            cia=cia,
            subtitle_lines=[periodo, f"Tipo: {tipo_factura or 'Todos'}"],
            sections=[section_resumen, section_ncf, section_ncf_fp],
            signature_labels=['Cajero/Usuario', 'Supervisor/Encargado'],
            impreso_por=getattr(request.user, 'username', '') or '',
            orientation='portrait',
        )
    except Exception as e:
        return JsonResponse({"error": f"Error generando PDF: {e}"}, status=500)

    resp = HttpResponse(pdf, content_type='application/pdf')
    resp['Content-Disposition'] = 'inline; filename="cuadre_caja.pdf"'
    return resp


@login_required
@require_http_methods(["GET"])
def fat_rep_ventas_productos_pdf(request):
    """GET /api/fat/reportes/ventas-productos/pdf/?no_cia=01&punto=01&desde=...&hasta=...

    Rfat326 modernizado: ventas por producto con costo/beneficio bruto.
    """
    try:
        from reportlab.lib.pagesizes import letter  # probe
    except ImportError:
        return JsonResponse({"error": "reportlab no instalado"}, status=500)

    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    desde = request.GET.get('desde', '')
    hasta = request.GET.get('hasta', '')

    if not desde or not hasta:
        return JsonResponse({"error": "desde y hasta son requeridos (YYYY-MM-DD)"}, status=400)

    perms = permissions_repo.get_for(request.user.username, 'fat', no_cia, punto)
    if perms is None or not perms.activo:
        return JsonResponse({'detail': 'sin acceso a FAT en esta empresa/punto'}, status=403)

    try:
        rows = fat_repo.rep_margen_bruto(
            no_cia=no_cia, punto=punto, desde=desde, hasta=hasta, agrupar='producto')
        if not isinstance(rows, list):
            rows = rows.get('items', [])
    except Exception as e:
        return JsonResponse({"error": f"Error consultando ventas: {e}"}, status=500)

    try:
        cia = next(
            (c for c in fat_repo.list_companias_fat() if str(c.get('no_cia')).strip() == no_cia),
            None,
        ) or {}
    except Exception:
        cia = {}
    if not cia:
        cia = inv_repo.get_compania(no_cia) or {}

    total_venta = sum(float(r.get('venta_neta') or r.get('ventas_neta') or r.get('total') or 0) for r in rows)
    total_costo = sum(float(r.get('valor_costo') or r.get('costo') or 0) for r in rows)
    total_benef = total_venta - total_costo

    rows_data = []
    for r in rows:
        venta = float(r.get('venta_neta') or r.get('ventas_neta') or r.get('total') or 0)
        costo = float(r.get('valor_costo') or r.get('costo') or 0)
        benef = venta - costo
        pct_bruto = (benef / venta * 100) if venta else 0
        rows_data.append({
            'codigo': r.get('no_produ') or r.get('codigo') or '',
            'descripcion': r.get('descripcion') or r.get('producto') or '',
            'cantidad': float(r.get('cantidad') or 0),
            'venta_neta': venta,
            'valor_costo': costo,
            'beneficio_bruto': benef,
            'pct_bruto': pct_bruto,
        })

    columns = [
        {'key': 'codigo', 'label': 'Codigo', 'align': 'left', 'width': 24},
        {'key': 'descripcion', 'label': 'Producto', 'align': 'left', 'width': 80},
        {'key': 'cantidad', 'label': 'Cant Neta', 'align': 'right', 'format': 'qty', 'width': 26},
        {'key': 'venta_neta', 'label': 'Venta Neta', 'align': 'right', 'format': 'money', 'width': 32},
        {'key': 'valor_costo', 'label': 'Valor Costo', 'align': 'right', 'format': 'money', 'width': 32},
        {'key': 'beneficio_bruto', 'label': 'Benef Bruto', 'align': 'right', 'format': 'money', 'width': 32},
        {'key': 'pct_bruto', 'label': '% Bruto', 'align': 'right', 'format': 'pct', 'width': 22},
    ]

    try:
        pdf = _render_modern_report_pdf(
            report_id='Rfat326',
            title='Ventas por Productos / MBB',
            cia=cia,
            subtitle_lines=[f"Periodo: {desde} a {hasta}", f"Total productos: {len(rows_data)}"],
            sections=[{
                'columns': columns,
                'rows': rows_data,
                'totals_row': {
                    'descripcion': f"Total general ({len(rows_data)})",
                    'venta_neta': total_venta,
                    'valor_costo': total_costo,
                    'beneficio_bruto': total_benef,
                    'pct_bruto': (total_benef / total_venta * 100) if total_venta else 0,
                },
            }],
            impreso_por=getattr(request.user, 'username', '') or '',
            orientation='landscape',
        )
    except Exception as e:
        return JsonResponse({"error": f"Error generando PDF: {e}"}, status=500)

    resp = HttpResponse(pdf, content_type='application/pdf')
    resp['Content-Disposition'] = f'inline; filename="ventas_productos_{desde}_{hasta}.pdf"'
    return resp


# ── Ticket POS 80mm ──────────────────────────────────────────────────────────
# Renderer en formato 80mm para impresoras térmicas / punto de venta.
# Reusa la misma data ya cargada por fat_documento_pdf.

@login_required
@require_http_methods(["GET"])
def fat_documento_pos_pdf(request, tipo: str, no_factura: str):
    """GET /api/fat/documentos/<tipo>/<no_factura>/pos-pdf/?no_cia=01&punto=01

    Devuelve el PDF de una factura en formato ticket POS 80mm.
    """
    try:
        from reportlab.lib.pagesizes import letter  # probe
    except ImportError:
        return JsonResponse({"error": "reportlab no instalado"}, status=500)

    tipo = (tipo or '').strip().upper()
    if tipo not in TIPOS_DOCUMENTO_SOPORTADOS:
        return JsonResponse(
            {"error": f"Tipo de documento '{tipo}' no soportado (solo FC, FT)"},
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
    if tipo_ncf and tipo_ncf not in TIPOS_NCF_VALIDOS_FISICOS:
        return JsonResponse(
            {"error": f"NCF tipo '{tipo_ncf}' no es válido DGI (debe ser B01..B15)"},
            status=422)

    try:
        cia = next(
            (c for c in fat_repo.list_companias_fat() if str(c.get('no_cia')).strip() == no_cia),
            None,
        ) or {}
    except Exception:
        cia = {}
    if not cia:
        cia = inv_repo.get_compania(no_cia) or {}
    razon_social = (cia.get('descripcion') or no_cia).strip()

    no_cliente_str = str(factura['no_cliente'])
    cliente = cxc_repo.get_cliente(no_cia, no_cliente_str, punto) or {}
    rnc_cliente = (cliente.get('rnc') or '').strip()
    direccion_cliente = (cliente.get('direccion') or '').strip()

    nombre_vendedor = fat_repo.get_vendedor_nombre(no_cia, factura.get('vendedor', ''))
    descripcion_cond_pago = fat_repo.get_condicion_pago_descripcion(
        factura.get('no_condicion_pago', ''))
    forma_pago_display = (factura.get('forma_pago') or '').strip()
    try:
        tipos_pago = fat_repo.list_tipos_pago(no_cia, punto)
        tipo_pago = next(
            (p for p in tipos_pago if str(p.get('tipo_pago')).strip() == forma_pago_display),
            None,
        )
        if tipo_pago and tipo_pago.get('descripcion'):
            forma_pago_display = tipo_pago['descripcion']
    except Exception:
        pass

    try:
        pdf_bytes = _render_factura_pos_ticket(
            factura=factura,
            cia=cia,
            razon_social=razon_social,
            rnc_cliente=rnc_cliente,
            direccion_cliente=direccion_cliente,
            nombre_vendedor=nombre_vendedor,
            descripcion_cond_pago=descripcion_cond_pago,
            forma_pago_display=forma_pago_display,
            tipo_ncf=tipo_ncf,
            cajero=getattr(request.user, 'username', '') or '',
        )
    except Exception as e:
        return JsonResponse({"error": f"Error generando ticket POS: {e}"}, status=500)

    resp = HttpResponse(pdf_bytes, content_type='application/pdf')
    resp['Content-Disposition'] = (
        f'inline; filename="POS_{tipo}_{no_factura}.pdf"'
    )
    return resp


def _render_factura_pos_ticket(*, factura, cia, razon_social, rnc_cliente,
                               direccion_cliente, nombre_vendedor,
                               descripcion_cond_pago, forma_pago_display,
                               tipo_ncf, cajero: str = '') -> bytes:
    """Ticket POS 80mm para impresora térmica.

    Ancho fijo 80mm; alto generoso (297mm) — las térmicas con corte automático
    sólo imprimen hasta donde hay tinta. Tipografía Helvetica, sin colores.
    """
    import io
    from datetime import datetime
    from html import escape

    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
    )

    page_w = 80 * mm
    page_h = 297 * mm
    margin = 3 * mm

    tipo = (factura.get('tipo_factura') or '').strip().upper()
    no_factura = (factura.get('no_factura') or '').strip()
    documento_label = {
        'FC': 'FACTURA CREDITO', 'FT': 'FACTURA CONTADO',
    }.get(tipo, 'FACTURA')
    fecha = factura.get('fecha', '') or ''
    fecha_display = (
        f"{fecha[8:10]}/{fecha[5:7]}/{fecha[:4]}" if fecha and len(fecha) >= 10 else fecha
    )

    posiciones = (factura.get('posiciones_fijas_ncf') or '').strip().upper()
    ncf_num = factura.get('ncf')
    codigo_ncf = f"{posiciones}{int(ncf_num):08d}" if posiciones and ncf_num else ''
    ncf_label = codigo_ncf or '(sin NCF)'
    tipo_ncf_label = tipo_ncf or 'N/A'

    nombre_cliente = (factura.get('nombre_cliente') or '').strip() or 'CONSUMIDOR FINAL'
    cond_pago_display = descripcion_cond_pago or ''
    forma_pago_display = (forma_pago_display or factura.get('forma_pago') or '').strip()
    anulada = (factura.get('st_anulado') or 'N') == 'S'
    impresion_label = 'REIMPRESA' if (factura.get('st_impresion') or 'N') == 'S' else ''

    cia_rnc = (cia.get('rnc') or '').strip()
    cia_telefono = (cia.get('telefono') or '').strip()
    cia_direccion = (cia.get('direccion') or '').strip()

    subtotal = float(factura.get('total_linea') or 0)
    descuento_total = float(factura.get('descuento') or 0)
    impuesto_total = float(factura.get('impuesto') or 0)
    propina_total = float(factura.get('propina') or 0)
    total_general = float(factura.get('total_neto') or 0)

    def t(value) -> str:
        return escape(str(value if value is not None else '').strip())

    def money(value) -> str:
        return f"{float(value or 0):,.2f}"

    def qty(value) -> str:
        amount = float(value or 0)
        if amount.is_integer():
            return f"{amount:,.0f}"
        return f"{amount:,.2f}"

    styles = getSampleStyleSheet()
    base = ParagraphStyle(
        name='POSBase', parent=styles['Normal'],
        fontName='Helvetica', fontSize=8, leading=10,
        textColor=colors.black,
    )
    center = ParagraphStyle(name='POSCenter', parent=base, alignment=TA_CENTER)
    center_bold = ParagraphStyle(
        name='POSCenterBold', parent=center,
        fontName='Helvetica-Bold', fontSize=9, leading=11,
    )
    title = ParagraphStyle(
        name='POSTitle', parent=center,
        fontName='Helvetica-Bold', fontSize=11, leading=13,
    )
    doc_title = ParagraphStyle(
        name='POSDoc', parent=center,
        fontName='Helvetica-Bold', fontSize=10, leading=12,
    )
    right = ParagraphStyle(name='POSRight', parent=base, alignment=TA_RIGHT)
    right_bold = ParagraphStyle(
        name='POSRightBold', parent=right,
        fontName='Helvetica-Bold',
    )
    total_label = ParagraphStyle(
        name='POSTotalLabel', parent=base,
        fontName='Helvetica-Bold', fontSize=8.5, leading=10,
    )
    total_val = ParagraphStyle(
        name='POSTotalVal', parent=right_bold, fontSize=8.5, leading=10,
    )
    grand_total = ParagraphStyle(
        name='POSGrand', parent=center,
        fontName='Helvetica-Bold', fontSize=12, leading=14,
    )
    small = ParagraphStyle(name='POSSmall', parent=base, fontSize=7, leading=8.5)
    small_center = ParagraphStyle(name='POSSmallC', parent=small, alignment=TA_CENTER)
    line_desc = ParagraphStyle(name='POSLineDesc', parent=small, fontSize=7.5, leading=9)
    line_qty = ParagraphStyle(name='POSLineQty', parent=small, fontSize=7.5, leading=9)
    line_right = ParagraphStyle(
        name='POSLineRight', parent=small, fontSize=7.5,
        leading=9, alignment=TA_RIGHT,
    )

    buffer = io.BytesIO()
    doc_pdf = SimpleDocTemplate(
        buffer,
        pagesize=(page_w, page_h),
        leftMargin=margin,
        rightMargin=margin,
        topMargin=margin,
        bottomMargin=margin,
    )
    width = doc_pdf.width

    def hr() -> Table:
        line = Table([['']], colWidths=[width], rowHeights=[0.3])
        line.setStyle(TableStyle([
            ('LINEABOVE', (0, 0), (-1, 0), 0.4, colors.black),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ]))
        return line

    def dashed_hr() -> Table:
        return Table(
            [[Paragraph('-' * 56, small_center)]],
            colWidths=[width],
        )

    elements: list = []

    # Encabezado: razón social, dirección, RNC, teléfono
    elements.append(Paragraph(t(razon_social.upper() or 'EMPRESA'), title))
    if cia_direccion:
        elements.append(Paragraph(t(cia_direccion), center))
    info_line = ' | '.join(
        part for part in [
            f"RNC {t(cia_rnc)}" if cia_rnc else '',
            f"Tel. {t(cia_telefono)}" if cia_telefono else '',
        ] if part
    )
    if info_line:
        elements.append(Paragraph(info_line, center))
    elements.append(Spacer(1, 2 * mm))

    # Tipo doc + número + NCF + tipo NCF (centrado destacado)
    elements.append(hr())
    elements.append(Spacer(1, 1 * mm))
    elements.append(Paragraph(t(documento_label), doc_title))
    elements.append(Paragraph(f"<b>{t(tipo)}-{t(no_factura)}</b>", center_bold))
    elements.append(Paragraph(f"NCF: {t(ncf_label)}", center_bold))
    if tipo_ncf_label and tipo_ncf_label != 'N/A':
        elements.append(Paragraph(f"({t(tipo_ncf_label)})", small_center))
    if impresion_label:
        elements.append(Paragraph(t(impresion_label), small_center))
    elements.append(Spacer(1, 1 * mm))
    elements.append(hr())
    elements.append(Spacer(1, 2 * mm))

    # Fecha + cliente
    elements.append(Paragraph(f"<b>Fecha:</b> {t(fecha_display)}", small))
    elements.append(Paragraph(f"<b>Cliente:</b> {t(nombre_cliente)}", small))
    if rnc_cliente:
        elements.append(Paragraph(f"<b>RNC/Ced:</b> {t(rnc_cliente)}", small))
    if direccion_cliente:
        elements.append(Paragraph(f"<b>Dir:</b> {t(direccion_cliente)}", small))
    if nombre_vendedor:
        elements.append(Paragraph(f"<b>Vendedor:</b> {t(nombre_vendedor)}", small))
    if cond_pago_display:
        elements.append(Paragraph(f"<b>Condicion:</b> {t(cond_pago_display)}", small))
    if forma_pago_display:
        elements.append(Paragraph(f"<b>Forma pago:</b> {t(forma_pago_display)}", small))
    if cajero:
        elements.append(Paragraph(f"<b>Cajero:</b> {t(cajero)}", small))
    elements.append(Spacer(1, 2 * mm))

    # Cabecera de líneas
    head_table = Table(
        [[
            Paragraph('Desc.', ParagraphStyle('h1', parent=small, fontName='Helvetica-Bold')),
            Paragraph('Total', ParagraphStyle('h2', parent=line_right, fontName='Helvetica-Bold')),
        ]],
        colWidths=[width * 0.62, width * 0.38],
    )
    head_table.setStyle(TableStyle([
        ('LINEBELOW', (0, 0), (-1, 0), 0.4, colors.black),
        ('LINEABOVE', (0, 0), (-1, 0), 0.4, colors.black),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    elements.append(head_table)

    # Detalle de líneas: cada producto en 2 filas:
    #   [descripción ............................ monto_neto]
    #   [cant x precio  (-desc)                              ]
    active_lineas = [
        l for l in factura.get('lineas', [])
        if (l.get('st_anulado') or 'N') == 'N'
    ]
    line_rows = []
    for linea in active_lineas:
        cantidad = float(linea.get('cantidad') or 0)
        precio = float(linea.get('precio') or 0)
        descuento = float(linea.get('descuento') or 0)
        regalia = float(linea.get('cantidad_regalia') or 0)
        desc = t(linea.get('descripcion') or '')
        codigo = t(linea.get('no_produ') or '')
        if codigo:
            desc = f"{codigo} {desc}"
        if regalia:
            desc = f"{desc} (Reg: {qty(regalia)})"
        detail_parts = [f"{qty(cantidad)} x {money(precio)}"]
        if descuento:
            detail_parts.append(f"-{money(descuento)}")
        line_rows.append([
            Paragraph(desc, line_desc),
            Paragraph(money(linea.get('monto_neto')), line_right),
        ])
        line_rows.append([
            Paragraph('  ' + ' '.join(detail_parts), small),
            Paragraph('', small),
        ])
    if not active_lineas:
        line_rows.append([
            Paragraph('Sin lineas facturadas.', small),
            Paragraph('', small),
        ])
    lines_table = Table(line_rows, colWidths=[width * 0.62, width * 0.38])
    lines_table.setStyle(TableStyle([
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(lines_table)
    elements.append(hr())
    elements.append(Spacer(1, 1 * mm))

    # Totales
    total_rows = [
        [Paragraph('Subtotal', total_label), Paragraph(money(subtotal), total_val)],
        [Paragraph('Descuento', total_label), Paragraph(money(descuento_total), total_val)],
        [Paragraph('ITBIS', total_label), Paragraph(money(impuesto_total), total_val)],
    ]
    if propina_total:
        total_rows.append(
            [Paragraph('Propina', total_label), Paragraph(money(propina_total), total_val)]
        )
    totals_table = Table(total_rows, colWidths=[width * 0.55, width * 0.45])
    totals_table.setStyle(TableStyle([
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 1 * mm))
    elements.append(hr())
    elements.append(Spacer(1, 1 * mm))

    # Total grande
    grand_table = Table(
        [[
            Paragraph('TOTAL', grand_total),
            Paragraph(f"RD$ {money(total_general)}", ParagraphStyle(
                'gt', parent=grand_total, alignment=TA_RIGHT,
            )),
        ]],
        colWidths=[width * 0.45, width * 0.55],
    )
    grand_table.setStyle(TableStyle([
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(grand_table)
    elements.append(Spacer(1, 1 * mm))

    # Importe en letras
    try:
        letras = _importe_en_letras(total_general)
        elements.append(Paragraph(letras.replace('*', ''), small_center))
    except Exception:
        pass

    nota = (factura.get('nota') or factura.get('detalle') or '').strip()
    if nota:
        elements.append(Spacer(1, 2 * mm))
        elements.append(hr())
        elements.append(Paragraph(f"<b>Nota:</b> {t(nota)}", small))

    # QR del NCF fiscal — para verificación DGII.
    if codigo_ncf:
        try:
            from reportlab.graphics.barcode.qr import QrCodeWidget
            from reportlab.graphics.shapes import Drawing
            qr_widget = QrCodeWidget(codigo_ncf, barLevel='M')
            qr_w = 28 * mm
            bounds = qr_widget.getBounds()
            qw = bounds[2] - bounds[0]
            qh = bounds[3] - bounds[1]
            scale = qr_w / qw
            drawing = Drawing(qr_w, qr_w, transform=[scale, 0, 0, scale, 0, 0])
            drawing.add(qr_widget)
            qr_table = Table(
                [[drawing]],
                colWidths=[width],
                rowHeights=[qr_w + 1 * mm],
            )
            qr_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                ('TOPPADDING', (0, 0), (-1, -1), 1),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
            ]))
            elements.append(Spacer(1, 2 * mm))
            elements.append(qr_table)
            elements.append(Paragraph(f"Comprobante: <b>{t(codigo_ncf)}</b>", small_center))
        except Exception:
            pass

    elements.append(Spacer(1, 3 * mm))
    elements.append(Paragraph('¡Gracias por su compra!', center_bold))
    elements.append(Spacer(1, 1 * mm))
    impreso_at = datetime.now().strftime('%d/%m/%Y %H:%M')
    elements.append(Paragraph(f"Impreso: {impreso_at}", small_center))
    if anulada:
        elements.append(Spacer(1, 2 * mm))
        elements.append(Paragraph('*** ANULADA ***', ParagraphStyle(
            'anul', parent=center_bold, fontSize=14, leading=16,
        )))

    def draw_watermark(canvas, doc):
        if anulada:
            canvas.saveState()
            canvas.setFont('Helvetica-Bold', 36)
            canvas.setFillColor(colors.Color(0.85, 0.15, 0.15, alpha=0.15))
            canvas.translate(page_w / 2, page_h / 2)
            canvas.rotate(28)
            canvas.drawCentredString(0, 0, 'ANULADA')
            canvas.restoreState()

    doc_pdf.build(elements, onFirstPage=draw_watermark, onLaterPages=draw_watermark)
    buffer.seek(0)
    return buffer.read()
