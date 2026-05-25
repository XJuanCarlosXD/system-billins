"""Inventario (INV) — vistas legacy.

Usa fetch_dicts / fetch_one del cliente Oracle directo.
No usa Django ORM ni DRF serializers.
"""
from __future__ import annotations

import decimal
import datetime
import io

from django.http import JsonResponse, HttpResponse
from django.views.decorators.http import require_http_methods

from apps.legacy.repositories import inv_repo


def _jsonify(data):
    """Convierte tipos Oracle (Decimal, date, datetime) a tipos JSON-serializables."""
    if isinstance(data, list):
        return [_jsonify(row) for row in data]
    if isinstance(data, dict):
        return {k: _jsonify(v) for k, v in data.items()}
    if isinstance(data, decimal.Decimal):
        return float(data)
    if isinstance(data, (datetime.date, datetime.datetime)):
        return data.isoformat()
    return data


@require_http_methods(["GET"])
def inv_productos(request):
    """GET /api/inv/productos/?no_cia=01&search=&grupo=&linea=&page=1&page_size=50"""
    try:
        no_cia = request.GET.get('no_cia', '01')
        search = request.GET.get('search', '')
        grupo = request.GET.get('grupo', '')
        linea = request.GET.get('linea', '')
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 50))
        offset = (page - 1) * page_size

        results = inv_repo.list_productos(
            search=search,
            grupo=grupo,
            linea=linea,
            no_cia=no_cia,
            limit=page_size,
            offset=offset,
        )
        count = inv_repo.count_productos()
        return JsonResponse({
            "results": _jsonify(results),
            "count": count,
            "page": page,
            "page_size": page_size,
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@require_http_methods(["GET"])
def inv_producto(request, no_produ: str):
    """GET /api/inv/productos/<no_produ>/?no_cia=01"""
    try:
        no_cia = request.GET.get('no_cia', '01')
        item = inv_repo.get_producto(no_produ=no_produ, no_cia=no_cia)
        if item is None:
            return JsonResponse({"error": "Producto no encontrado"}, status=404)
        return JsonResponse({"data": _jsonify(item)})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@require_http_methods(["GET"])
def inv_grupos(request):
    """GET /api/inv/grupos/?no_cia=01"""
    try:
        no_cia = request.GET.get('no_cia', '01')
        results = inv_repo.list_grupos(no_cia=no_cia)
        return JsonResponse({
            "results": _jsonify(results),
            "count": len(results),
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@require_http_methods(["GET"])
def inv_lineas(request):
    """GET /api/inv/lineas/?no_cia=01"""
    try:
        no_cia = request.GET.get('no_cia', '01')
        results = inv_repo.list_lineas(no_cia=no_cia)
        return JsonResponse({
            "results": _jsonify(results),
            "count": len(results),
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@require_http_methods(["GET"])
def inv_existencias(request):
    """GET /api/inv/existencia/?no_cia=01&almacen=&no_produ=&search="""
    try:
        no_cia = request.GET.get('no_cia', '01')
        almacen = request.GET.get('almacen', '')
        no_produ = request.GET.get('no_produ', '')
        search = request.GET.get('search', '')
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 50))

        results = inv_repo.list_existencias(
            no_cia=no_cia,
            almacen=almacen,
            no_produ=no_produ,
            search=search,
        )
        count = len(results)
        offset = (page - 1) * page_size
        page_results = results[offset: offset + page_size]
        return JsonResponse({
            "results": _jsonify(page_results),
            "count": count,
            "page": page,
            "page_size": page_size,
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@require_http_methods(["GET"])
def inv_movimientos(request):
    """GET /api/inv/movimientos/?no_cia=01&almacen=&no_produ=&desde=&hasta=&tipo="""
    try:
        no_cia = request.GET.get('no_cia', '01')
        almacen = request.GET.get('almacen', '')
        no_produ = request.GET.get('no_produ', '')
        desde = request.GET.get('desde', '')
        hasta = request.GET.get('hasta', '')
        tipo = request.GET.get('tipo', '')
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 50))

        results = inv_repo.list_movimientos(
            no_cia=no_cia,
            almacen=almacen,
            no_produ=no_produ,
            desde=desde,
            hasta=hasta,
            tipo=tipo,
        )
        count = len(results)
        offset = (page - 1) * page_size
        page_results = results[offset: offset + page_size]
        return JsonResponse({
            "results": _jsonify(page_results),
            "count": count,
            "page": page,
            "page_size": page_size,
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@require_http_methods(["GET"])
def inv_almacenes(request):
    """GET /api/inv/almacenes/?no_cia=01"""
    try:
        no_cia = request.GET.get('no_cia', '01')
        results = inv_repo.list_almacenes(no_cia=no_cia)
        return JsonResponse({
            "results": _jsonify(results),
            "count": len(results),
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@require_http_methods(["GET"])
def inv_tipos_docu(request):
    """GET /api/inv/tipos-docu/"""
    try:
        results = inv_repo.list_tipos_docu_inv()
        return JsonResponse({
            "results": _jsonify(results),
            "count": len(results),
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


# ─── NEW VIEWS ────────────────────────────────────────────────────────────────

@require_http_methods(["GET"])
def inv_companias(request):
    """GET /api/inv/companias/"""
    try:
        results = inv_repo.list_companias()
        return JsonResponse({"results": _jsonify(results), "count": len(results)})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@require_http_methods(["GET"])
def inv_puntos(request):
    """GET /api/inv/puntos/?no_cia=01"""
    try:
        no_cia = request.GET.get('no_cia', '01')
        results = inv_repo.list_puntos(no_cia=no_cia)
        return JsonResponse({"results": _jsonify(results), "count": len(results)})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@require_http_methods(["GET"])
def inv_unidades(request):
    """GET /api/inv/unidades/"""
    try:
        results = inv_repo.list_unidades()
        return JsonResponse({"results": _jsonify(results), "count": len(results)})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@require_http_methods(["GET"])
def inv_sublineas(request):
    """GET /api/inv/sublineas/?linea=0001"""
    try:
        no_cia = request.GET.get('no_cia', '01')
        linea = request.GET.get('linea', '')
        results = inv_repo.list_sublineas(no_cia=no_cia, linea=linea)
        return JsonResponse({"results": _jsonify(results), "count": len(results)})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@require_http_methods(["GET"])
def inv_existencia_producto(request, no_produ: str):
    """GET /api/inv/existencia/<no_produ>/?no_cia=01"""
    try:
        no_cia = request.GET.get('no_cia', '01')
        results = inv_repo.get_existencia_producto(no_cia=no_cia, no_produ=no_produ)
        return JsonResponse({"results": _jsonify(results), "count": len(results)})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@require_http_methods(["GET"])
def inv_consulta_documentos(request):
    """GET /api/inv/documentos/?no_cia=01&punto=&tipo_docu=&desde=&hasta=&almacen=&limit=100"""
    try:
        no_cia = request.GET.get('no_cia', '01')
        punto = request.GET.get('punto', '')
        tipo_docu = request.GET.get('tipo_docu', '')
        desde = request.GET.get('desde', '')
        hasta = request.GET.get('hasta', '')
        almacen = request.GET.get('almacen', '')
        limit = int(request.GET.get('limit', 100))
        results = inv_repo.list_consulta_documentos(
            no_cia=no_cia, punto=punto, tipo_docu=tipo_docu,
            desde=desde, hasta=hasta, almacen=almacen, limit=limit,
        )
        return JsonResponse({"results": _jsonify(results), "count": len(results)})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@require_http_methods(["GET"])
def inv_documento_detalle(request, tipo_docu: str, no_docu: str):
    """GET /api/inv/documentos/<tipo_docu>/<no_docu>/?no_cia=01"""
    try:
        no_cia = request.GET.get('no_cia', '01')
        doc = inv_repo.get_documento_detalle(no_cia=no_cia, tipo_docu=tipo_docu, no_docu=no_docu)
        if doc is None:
            return JsonResponse({"error": "Documento no encontrado"}, status=404)
        return JsonResponse({"data": _jsonify(doc)})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@require_http_methods(["GET"])
def inv_documento_pdf(request, tipo_docu: str, no_docu: str):
    """GET /api/inv/documentos/<tipo_docu>/<no_docu>/pdf/?no_cia=01"""
    no_cia = request.GET.get('no_cia', '01')
    try:
        doc = inv_repo.get_documento_detalle(no_cia=no_cia, tipo_docu=tipo_docu, no_docu=no_docu)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

    if not doc:
        return JsonResponse({"error": "Documento no encontrado"}, status=404)

    try:
        from reportlab.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib import colors
        from reportlab.lib.units import inch

        buffer = io.BytesIO()
        doc_pdf = SimpleDocTemplate(buffer, pagesize=letter,
                                    leftMargin=0.75*inch, rightMargin=0.75*inch,
                                    topMargin=0.75*inch, bottomMargin=0.75*inch)
        styles = getSampleStyleSheet()
        elements = []

        header = doc.get('header', {})
        elements.append(Paragraph(
            f"Documento Inventario: {tipo_docu} #{no_docu}", styles['Title']
        ))
        elements.append(Spacer(1, 8))

        info_data = [
            ['Empresa:', str(header.get('no_cia', no_cia)),
             'Fecha:', str(header.get('fecha', ''))],
            ['Almacén:', str(header.get('almacen', '')),
             'Tipo Mov:', str(header.get('tipo_movi', ''))],
            ['Punto:', str(header.get('punto', '')),
             'Total:', str(round(float(header.get('total', 0) or 0), 2))],
        ]
        info_table = Table(info_data, colWidths=[1.2*inch, 2*inch, 1.2*inch, 2*inch])
        info_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ]))
        elements.append(info_table)
        elements.append(Spacer(1, 12))

        lines = doc.get('lines', [])
        if lines:
            col_keys = ['no_linea', 'no_produ', 'descripcion', 'cantidad', 'costo', 'monto_neto']
            col_labels = ['Línea', 'Código', 'Descripción', 'Cantidad', 'Costo', 'Monto']
            # normalise keys (Oracle returns uppercase)
            def _get(row, key):
                return str(row.get(key.upper(), row.get(key, '')) or '')

            data = [col_labels]
            for row in lines[:100]:
                data.append([_get(row, k) for k in col_keys])

            t = Table(data, colWidths=[0.5*inch, 1*inch, 2.5*inch, 0.8*inch, 0.8*inch, 0.9*inch])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4472C4')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#DCE6F1')]),
                ('GRID', (0, 0), (-1, -1), 0.4, colors.grey),
                ('ALIGN', (3, 0), (-1, -1), 'RIGHT'),
            ]))
            elements.append(t)

        doc_pdf.build(elements)
        buffer.seek(0)
        response = HttpResponse(buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="INV_{tipo_docu}_{no_docu}.pdf"'
        return response
    except ImportError:
        return JsonResponse({"error": "reportlab no instalado en el servidor"}, status=500)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@require_http_methods(["GET"])
def inv_kardex(request):
    """GET /api/inv/kardex/?no_cia=01&no_produ=X&almacen=&desde=&hasta="""
    try:
        no_cia = request.GET.get('no_cia', '01')
        no_produ = request.GET.get('no_produ', '')
        almacen = request.GET.get('almacen', '')
        desde = request.GET.get('desde', '')
        hasta = request.GET.get('hasta', '')
        if not no_produ:
            return JsonResponse({"error": "Parámetro no_produ requerido"}, status=400)
        results = inv_repo.list_kardex(
            no_cia=no_cia, no_produ=no_produ,
            almacen=almacen, desde=desde, hasta=hasta,
        )
        return JsonResponse({"results": _jsonify(results), "count": len(results)})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@require_http_methods(["GET"])
def inv_valorizacion(request):
    """GET /api/inv/valorizacion/?no_cia=01&almacen="""
    try:
        no_cia = request.GET.get('no_cia', '01')
        almacen = request.GET.get('almacen', '')
        results = inv_repo.get_valoracion_inventario(no_cia=no_cia, almacen=almacen)
        total = sum(float(r.get('VALOR', r.get('valor', 0)) or 0) for r in results)
        return JsonResponse({
            "results": _jsonify(results),
            "count": len(results),
            "total_valor": round(total, 2),
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


# ─── REPORT PDFs ──────────────────────────────────────────────────────────────

def _build_pdf_report(title: str, columns: list[str], rows: list[dict],
                      col_widths: list | None = None) -> bytes:
    """Helper: construye un PDF simple con título y tabla."""
    from reportlab.pagesizes import letter, landscape
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib import colors
    from reportlab.lib.units import inch

    buffer = io.BytesIO()
    doc_pdf = SimpleDocTemplate(buffer, pagesize=landscape(letter),
                                leftMargin=0.5*inch, rightMargin=0.5*inch,
                                topMargin=0.5*inch, bottomMargin=0.5*inch)
    styles = getSampleStyleSheet()
    elements = [Paragraph(title, styles['Title']), Spacer(1, 8)]

    if rows:
        header_row = [c.upper() for c in columns]
        data = [header_row]
        for r in rows[:500]:
            row_data = []
            for c in columns:
                val = r.get(c.upper(), r.get(c, ''))
                if isinstance(val, float):
                    val = f"{val:,.2f}"
                row_data.append(str(val or ''))
            data.append(row_data)

        t = Table(data, colWidths=col_widths)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4472C4')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 7),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#DCE6F1')]),
            ('GRID', (0, 0), (-1, -1), 0.3, colors.grey),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 6))
        elements.append(Paragraph(f"Total registros: {len(rows)}", styles['Normal']))
    else:
        elements.append(Paragraph("Sin datos.", styles['Normal']))

    doc_pdf.build(elements)
    buffer.seek(0)
    return buffer.read()


@require_http_methods(["GET"])
def inv_reporte_existencia_pdf(request):
    """GET /api/inv/reportes/existencia/pdf/?no_cia=01&almacen="""
    try:
        from reportlab.pagesizes import letter  # noqa: probe import
    except ImportError:
        return JsonResponse({"error": "reportlab no instalado"}, status=500)
    try:
        no_cia = request.GET.get('no_cia', '01')
        almacen = request.GET.get('almacen', '')
        punto = request.GET.get('punto', '')
        rows = inv_repo.list_existencias(no_cia=no_cia, almacen=almacen, punto=punto)
        cols = ['ALMACEN', 'NO_PRODU', 'DESCRIPCION', 'EXISTENCIA', 'COSTO_PROM', 'VALOR']
        pdf = _build_pdf_report(f"Reporte de Existencias — Empresa {no_cia}", cols, rows)
        resp = HttpResponse(pdf, content_type='application/pdf')
        resp['Content-Disposition'] = f'inline; filename="INV_Existencias_{no_cia}.pdf"'
        return resp
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@require_http_methods(["GET"])
def inv_reporte_movimientos_pdf(request):
    """GET /api/inv/reportes/movimientos/pdf/?no_cia=01&desde=&hasta=&tipo_docu="""
    try:
        from reportlab.pagesizes import letter  # noqa: probe import
    except ImportError:
        return JsonResponse({"error": "reportlab no instalado"}, status=500)
    try:
        no_cia = request.GET.get('no_cia', '01')
        almacen = request.GET.get('almacen', '')
        tipo = request.GET.get('tipo', '')
        desde = request.GET.get('desde', '')
        hasta = request.GET.get('hasta', '')
        rows = inv_repo.list_movimientos(
            no_cia=no_cia, almacen=almacen, tipo=tipo,
            desde=desde, hasta=hasta,
        )
        cols = ['FECHA', 'TIPO_DOCU', 'NO_DOCU', 'ALMACEN', 'NO_PRODU',
                'DESCRIPCION', 'TIPO_MOVI', 'CANTIDAD', 'COSTO', 'MONTO_NETO']
        pdf = _build_pdf_report(f"Reporte de Movimientos — Empresa {no_cia}", cols, rows)
        resp = HttpResponse(pdf, content_type='application/pdf')
        resp['Content-Disposition'] = f'inline; filename="INV_Movimientos_{no_cia}.pdf"'
        return resp
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@require_http_methods(["GET"])
def inv_reporte_kardex_pdf(request):
    """GET /api/inv/reportes/kardex/pdf/?no_cia=01&no_produ=X&almacen=&desde=&hasta="""
    try:
        from reportlab.pagesizes import letter  # noqa: probe import
    except ImportError:
        return JsonResponse({"error": "reportlab no instalado"}, status=500)
    try:
        no_cia = request.GET.get('no_cia', '01')
        no_produ = request.GET.get('no_produ', '')
        almacen = request.GET.get('almacen', '')
        desde = request.GET.get('desde', '')
        hasta = request.GET.get('hasta', '')
        if not no_produ:
            return JsonResponse({"error": "Parámetro no_produ requerido"}, status=400)
        rows = inv_repo.list_kardex(
            no_cia=no_cia, no_produ=no_produ,
            almacen=almacen, desde=desde, hasta=hasta,
        )
        cols = ['FECHA', 'TIPO_DOCU', 'NO_DOCU', 'ALMACEN',
                'TIPO_MOVI', 'CANTIDAD', 'COSTO', 'SALDO']
        pdf = _build_pdf_report(f"Kardex — {no_produ} — Empresa {no_cia}", cols, rows)
        resp = HttpResponse(pdf, content_type='application/pdf')
        resp['Content-Disposition'] = f'inline; filename="INV_Kardex_{no_produ}.pdf"'
        return resp
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@require_http_methods(["GET"])
def inv_reporte_valorizacion_pdf(request):
    """GET /api/inv/reportes/valorizacion/pdf/?no_cia=01&almacen="""
    try:
        from reportlab.pagesizes import letter  # noqa: probe import
    except ImportError:
        return JsonResponse({"error": "reportlab no instalado"}, status=500)
    try:
        no_cia = request.GET.get('no_cia', '01')
        almacen = request.GET.get('almacen', '')
        rows = inv_repo.get_valoracion_inventario(no_cia=no_cia, almacen=almacen)
        cols = ['ALMACEN', 'ALMACEN_DESC', 'NO_PRODU', 'DESCRIPCION',
                'EXISTENCIA', 'COSTO_ACTUAL', 'VALOR']
        pdf = _build_pdf_report(f"Valoración de Inventario — Empresa {no_cia}", cols, rows)
        resp = HttpResponse(pdf, content_type='application/pdf')
        resp['Content-Disposition'] = f'inline; filename="INV_Valorizacion_{no_cia}.pdf"'
        return resp
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
