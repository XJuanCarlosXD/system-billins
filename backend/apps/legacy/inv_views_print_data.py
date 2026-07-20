"""print-data endpoints para INV.

Sustituyen progresivamente los renderers ReportLab en apps/legacy/inv_views.py
(inv_documento_pdf, inv_reporte_*_pdf). El frontend renderiza el PDF en
/print/<codigo_doc>/<id> con plantillas Puck.
"""
from __future__ import annotations

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from apps.legacy.repositories import inv_repo
from apps.fat.views_print_data import _cia_payload, _money, _filtros_basicos


def _check_inv_access(request, no_cia: str):
    # Reusa la verificación del módulo INV existente.
    from apps.legacy.inv_views import _check_inv_access as _orig
    return _orig(getattr(request.user, 'username', ''), no_cia)


_INV_TIPO_DOCU_LABEL = {
    'EC': 'Entrada por Compra', 'DC': 'Devolución de Compra',
    'EI': 'Entrada por Inventario', 'SI': 'Salida por Inventario',
    'AI': 'Ajuste de Inventario', 'TI': 'Traspaso entre Almacenes',
    'EP': 'Entrada de Producción', 'SP': 'Salida de Producción',
    'TA': 'Transferencia de Almacén',
}


# ─── /api/inv/documentos/<tipo>/<no>/print-data/ ─────────────────────────

@login_required
@require_http_methods(["GET"])
def inv_documento_print_data(request, tipo_docu: str, no_docu: str):
    no_cia = request.GET.get('no_cia', '01')
    err = _check_inv_access(request, no_cia)
    if err is not None:
        return err
    tipo_s = (tipo_docu or '').strip().upper()
    no_s = (no_docu or '').strip()
    doc_full = inv_repo.get_documento_detalle(no_cia=no_cia, tipo_docu=tipo_s, no_docu=no_s)
    if not doc_full:
        return JsonResponse({'error': 'Documento INV no encontrado'}, status=404)
    h = doc_full.get('header', {}) or {}
    lines = doc_full.get('lines', []) or []
    cia = _cia_payload(no_cia, request=request)
    descripcion = (h.get('tipo_docu_descri') or _INV_TIPO_DOCU_LABEL.get(tipo_s, f'Documento {tipo_s}')).strip()
    doc = {
        'tipo': tipo_s, 'tipo_label': descripcion,
        'no': h.get('no_docu') or no_s, 'numero_display': f"{tipo_s}-{(h.get('no_docu') or no_s).strip()}",
        'fecha': str(h.get('fecha') or '')[:10],
        'fecha_venc': None,
        'ncf': h.get('ncf'),
        'ncf_dgi': h.get('ncf_dgi') or '',
        'tipo_ncf': '', 'tipo_ncf_label': '',
        'estado': h.get('estado') or '',
        'anulada': str(h.get('st_anulado', 'N')).upper() == 'S',
        'impresion': 'REIMPRESA' if str(h.get('st_impresion', 'N')).upper() == 'S' else 'IMPRESA',
        'condicion_pago': h.get('condicion_pago') or '',
        'forma_pago': '',
        'plazo_pago': 0,
        'vendedor': (h.get('vendedor_nombre') or h.get('vendedor') or '').strip(),
        'nota': h.get('observacion') or h.get('nota') or '',
        'detalle': h.get('detalle') or '',
        'moneda': h.get('moneda') or 'DOP',
        'tasa': _money(h.get('tasa_us')),
        'almacen_origen': (h.get('almacen') or '').strip(),
        'almacen_destino': (h.get('almacen_destino') or '').strip(),
        'tipo_movi': h.get('tipo_movi') or '',
        'tipo_transaccion': h.get('tipo_transaccion') or '',
    }
    # cliente o proveedor según tipo_docu
    party = {
        'no': h.get('no_cliente') or h.get('no_suplidor'),
        'nombre': (h.get('nombre_cliente') or h.get('nombre_proveedor') or h.get('nombre') or '').strip(),
        'rnc': (h.get('rnc') or '').strip(),
        'direccion': (h.get('direccion') or '').strip(),
        'telefono': (h.get('telefono') or '').strip(),
        'email': (h.get('email') or '').strip(),
        'tipo_ncf': '',
    }
    payload_key = 'proveedor' if tipo_s in ('EC', 'DC') else 'cliente'
    lineas = [{
        'no_linea': l.get('no_linea'),
        'codigo': (l.get('no_produ') or '').strip(),
        'descripcion': (l.get('descripcion') or '').strip(),
        'almacen': (l.get('almacen') or '').strip(),
        'cantidad': _money(l.get('cantidad')),
        'unidad': (l.get('unidad') or '').strip(),
        'precio': _money(l.get('costo') or l.get('precio')),
        'porc_descuento': _money(l.get('porc_descuento')),
        'descuento': _money(l.get('descuento')),
        'porciento_impuesto': _money(l.get('porc_impuesto')),
        'itbis': _money(l.get('impuesto')),
        'total': _money(l.get('valor') or l.get('total') or l.get('monto_neto')),
        'cantidad_regalia': 0,
        'anulada': (l.get('st_anulado') or 'N') == 'S',
    } for l in lines]
    subtotal = sum(l['precio'] * l['cantidad'] for l in lineas)
    descuento = sum(l['descuento'] for l in lineas)
    itbis = sum(l['itbis'] for l in lineas)
    # l['total'] es el monto neto por linea (subtotal - descuento, sin
    # impuesto) — el total del documento debe sumarle el ITBIS.
    total = sum(l['total'] for l in lineas) + itbis
    totales = {
        'subtotal': subtotal, 'descuento': descuento, 'itbis': itbis,
        'propina': 0, 'otros': 0, 'total': total, 'monto_letras': '',
    }
    return JsonResponse({
        'cia': cia, 'doc': doc, payload_key: party,
        'lineas': lineas, 'totales': totales, 'extra': {},
    })


# ─── Reportes INV ────────────────────────────────────────────────────────

@login_required
@require_http_methods(["GET"])
def inv_existencia_print_data(request):
    no_cia = request.GET.get('no_cia', '01')
    err = _check_inv_access(request, no_cia)
    if err is not None:
        return err
    cia = _cia_payload(no_cia, request=request)
    almacen = request.GET.get('almacen', '')
    punto = request.GET.get('punto', '')
    rows = inv_repo.list_existencias(no_cia=no_cia, almacen=almacen, punto=punto)
    filas = [{
        'almacen': (r.get('almacen') or '').strip(),
        'almacen_desc': (r.get('almacen_desc') or '').strip(),
        'no_produ': r.get('no_produ', ''),
        'descripcion': (r.get('descripcion') or '')[:80],
        'existencia': _money(r.get('existencia')),
        'costo_prom': _money(r.get('costo_prom') or r.get('costo_actual')),
        'valor': _money(r.get('valor')),
    } for r in rows]
    total = sum(f['valor'] for f in filas)
    return JsonResponse({
        'cia': cia,
        'reporte': {
            'codigo': 'inv-existencia', 'titulo': 'Existencia de Inventario',
            'fecha_generacion': None,
            'filtros': _filtros_basicos(request),
        },
        'filas': filas,
        'totales': {'total': total, 'cantidad': len(filas)},
    })


@login_required
@require_http_methods(["GET"])
def inv_movimientos_print_data(request):
    no_cia = request.GET.get('no_cia', '01')
    err = _check_inv_access(request, no_cia)
    if err is not None:
        return err
    cia = _cia_payload(no_cia, request=request)
    rows = inv_repo.list_movimientos(
        no_cia=no_cia,
        almacen=request.GET.get('almacen', ''),
        tipo_docu=request.GET.get('tipo', ''),
        desde=request.GET.get('desde', ''),
        hasta=request.GET.get('hasta', ''),
    ) if hasattr(inv_repo, 'list_movimientos') else []
    filas = [{
        'fecha': str(r.get('fecha') or '')[:10],
        'tipo_docu': r.get('tipo_docu', ''),
        'no_docu': r.get('no_docu', ''),
        'almacen': (r.get('almacen') or '').strip(),
        'no_produ': r.get('no_produ', ''),
        'descripcion': (r.get('descripcion') or '')[:60],
        'cantidad': _money(r.get('cantidad')),
        'tipo_movi': r.get('tipo_movi', ''),
        'valor': _money(r.get('valor') or r.get('total')),
    } for r in rows]
    return JsonResponse({
        'cia': cia,
        'reporte': {
            'codigo': 'inv-movimientos', 'titulo': 'Movimientos de Inventario',
            'fecha_generacion': None,
            'filtros': _filtros_basicos(request),
        },
        'filas': filas,
        'totales': {'cantidad': len(filas)},
    })


@login_required
@require_http_methods(["GET"])
def inv_kardex_print_data(request):
    no_cia = request.GET.get('no_cia', '01')
    err = _check_inv_access(request, no_cia)
    if err is not None:
        return err
    cia = _cia_payload(no_cia, request=request)
    no_produ = request.GET.get('no_produ', '')
    almacen = request.GET.get('almacen', '')
    rows = inv_repo.kardex_producto(
        no_cia=no_cia, no_produ=no_produ, almacen=almacen,
        desde=request.GET.get('desde', ''), hasta=request.GET.get('hasta', ''),
    ) if hasattr(inv_repo, 'kardex_producto') else []
    return JsonResponse({
        'cia': cia,
        'reporte': {
            'codigo': 'inv-kardex', 'titulo': f'Kardex Producto {no_produ}',
            'fecha_generacion': None,
            'filtros': _filtros_basicos(request, {'Producto': no_produ, 'Almacén': almacen}),
        },
        'filas': rows,
        'totales': {'cantidad': len(rows)},
    })


@login_required
@require_http_methods(["GET"])
def inv_valorizacion_print_data(request):
    no_cia = request.GET.get('no_cia', '01')
    err = _check_inv_access(request, no_cia)
    if err is not None:
        return err
    cia = _cia_payload(no_cia, request=request)
    rows = inv_repo.list_existencias(no_cia=no_cia, almacen=request.GET.get('almacen', ''))
    filas = [{
        'almacen': (r.get('almacen') or '').strip(),
        'no_produ': r.get('no_produ', ''),
        'descripcion': (r.get('descripcion') or '')[:60],
        'existencia': _money(r.get('existencia')),
        'costo_prom': _money(r.get('costo_prom') or r.get('costo_actual')),
        'valor': _money(r.get('valor')),
    } for r in rows]
    total = sum(f['valor'] for f in filas)
    return JsonResponse({
        'cia': cia,
        'reporte': {
            'codigo': 'inv-valorizacion', 'titulo': 'Valorización de Inventario',
            'fecha_generacion': None,
            'filtros': _filtros_basicos(request),
        },
        'filas': filas,
        'totales': {'total': total, 'cantidad': len(filas)},
    })


@login_required
@require_http_methods(["GET"])
def inv_cierre_entrada_print_data(request):
    no_cia = request.GET.get('no_cia', '01')
    err = _check_inv_access(request, no_cia)
    if err is not None:
        return err
    cia = _cia_payload(no_cia, request=request)
    # Reusar logic del inv_views si existe; si no, devolver lista vacía.
    rows = inv_repo.list_cierre_entrada_diario(
        no_cia=no_cia, fecha=request.GET.get('fecha', ''),
    ) if hasattr(inv_repo, 'list_cierre_entrada_diario') else []
    return JsonResponse({
        'cia': cia,
        'reporte': {
            'codigo': 'inv-cierre-entrada', 'titulo': 'Cierre Entrada Diario',
            'fecha_generacion': None,
            'filtros': _filtros_basicos(request),
        },
        'filas': rows,
        'totales': {'cantidad': len(rows)},
    })
