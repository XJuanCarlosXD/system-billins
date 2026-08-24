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
    'EC': 'Entrada de Compra', 'DC': 'Devolución de Compra',
    'EA': 'Entrada Almacén', 'SA': 'Salida Almacén',
    'AE': 'Ajuste Entrada', 'AS': 'Ajuste Salida',
    'TA': 'Transferencia Almacén', 'DV': 'Devolución',
    'EP': 'Entrada de Producción', 'SP': 'Salida de Producción',
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
        'tipo_docu_devuelto': (h.get('tipo_docu_devuelto') or '').strip(),
        'no_docu_devuelto': (h.get('no_docu_devuelto') or '').strip(),
        'tipo_refe': (h.get('tipo_refe') or '').strip(),
        'no_refe': (h.get('no_refe') or '').strip(),
        'tipo_docu_rev': (h.get('tipo_docu_rev') or '').strip(),
        'no_docu_rev': (h.get('no_docu_rev') or '').strip(),
        'no_motivo': (h.get('no_motivo') or '').strip(),
    }
    # Documento afectado: si esta devolucion (u otro tipo con referencia)
    # apunta a una factura FAT (FT/FC/AF), se resuelve su data real (cliente,
    # NCF, total) en vez de solo mostrar el codigo -- antes el print no
    # mostraba nada de esto (se perdio en la migracion a print-data/Puck).
    factura_afectada = None
    tdv = (h.get('tipo_docu_devuelto') or '').strip().upper()
    ndv = (h.get('no_docu_devuelto') or '').strip()
    if tdv and ndv and tdv in ('FT', 'FC', 'AF'):
        try:
            from apps.legacy.repositories import fat_repo
            fact = fat_repo.get_factura(no_cia, h.get('punto') or '01', tdv, ndv)
            if fact:
                factura_afectada = {
                    'tipo_doc': tdv, 'no_doc': ndv,
                    'numero_display': f"{tdv}-{ndv}",
                    'cliente': fact.get('nombre_cliente') or '',
                    'fecha': fact.get('fecha') or '',
                    'total_neto': _money(fact.get('total_neto')),
                    'ncf_dgi': (
                        f"{fact.get('posiciones_fijas_ncf')}{fact['ncf']:08d}"
                        if fact.get('posiciones_fijas_ncf') and fact.get('ncf') else ''
                    ),
                }
        except Exception:
            factura_afectada = None
    # cliente o proveedor según tipo_docu — el header (get_documento_detalle)
    # expone claves separadas proveedor_*/cliente_*, no 'nombre'/'rnc' genéricos.
    payload_key = 'proveedor' if tipo_s in ('EC', 'DC') else 'cliente'
    if payload_key == 'proveedor':
        party = {
            'no': str(h.get('no_proveedor') or '').strip(),
            'nombre': str(h.get('proveedor_nombre') or '').strip(),
            'rnc': str(h.get('proveedor_rnc') or '').strip(),
            'direccion': str(h.get('proveedor_direccion') or '').strip(),
            'telefono': str(h.get('proveedor_telefono') or '').strip(),
            'email': str(h.get('proveedor_email') or '').strip(),
            'tipo_ncf': '',
        }
    else:
        party = {
            'no': str(h.get('no_cliente') or '').strip(),
            'nombre': str(h.get('cliente_nombre') or '').strip(),
            'rnc': str(h.get('cliente_rnc') or '').strip(),
            'direccion': str(h.get('cliente_direccion') or '').strip(),
            'telefono': '',
            'email': '',
            'tipo_ncf': '',
        }
    lineas = [{
        'no_linea': l.get('no_linea'),
        'codigo': (l.get('no_produ') or '').strip(),
        'descripcion': (l.get('descripcion') or '').strip(),
        'almacen': (l.get('almacen') or '').strip(),
        'cantidad': _money(l.get('cantidad')),
        'unidad': (l.get('unidad') or '').strip(),
        # Precio de la TRANSACCION (venta/compra) primero; el costo es solo
        # fallback para movimientos puros de inventario (ajustes/transferencias)
        # donde no hay precio. Antes se priorizaba el costo, y en una DV eso
        # imprimia el costo del producto (p.ej. 733.05) en vez del precio de
        # venta real de la factura (1101.69) -> el precio no cuadraba con la
        # factura y el subtotal quedaba inconsistente con el total.
        'precio': _money(l.get('precio') or l.get('costo')),
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
        'lineas': lineas, 'totales': totales,
        'extra': {'factura_afectada': factura_afectada},
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
        'almacen_label': f"{(r.get('almacen') or '').strip()} {(r.get('almacen_desc') or '').strip()}".strip(),
        'no_produ': r.get('no_produ', ''),
        'descripcion': (r.get('descripcion') or '')[:80],
        'existencia': _money(r.get('existencia')),
        'costo_prom': _money(r.get('costo_prom') or r.get('costo_actual')),
        'valor': _money(r.get('valor')),
    } for r in rows]
    filas.sort(key=lambda f: (f['almacen'], f['no_produ']))
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
    almacen = request.GET.get('almacen', '')
    tipo = request.GET.get('tipo', '')
    desde = request.GET.get('desde', '')
    hasta = request.GET.get('hasta', '')
    # list_movimientos toma 'tipo' (no 'tipo_docu') y el campo monetario real
    # es monto_neto (mismo que usaba el renderer ReportLab retirado).
    rows = inv_repo.list_movimientos(
        no_cia=no_cia, almacen=almacen, tipo=tipo, desde=desde, hasta=hasta,
    )
    filas = [{
        'fecha': str(r.get('fecha') or '')[:10],
        'tipo_docu': (r.get('tipo_docu') or '').strip(),
        'no_docu': r.get('no_docu', ''),
        'almacen': (r.get('almacen') or '').strip(),
        'no_produ': r.get('no_produ', ''),
        'descripcion': (r.get('descripcion') or '')[:60],
        'cantidad': _money(r.get('cantidad')),
        'tipo_movi': r.get('tipo_movi', ''),
        'monto_neto': _money(r.get('monto_neto')),
    } for r in rows]
    # Mismo orden que usaba el renderer ReportLab retirado (agrupado por tipo_docu).
    filas.sort(key=lambda f: (f['tipo_docu'], f['fecha'], f['no_docu']))
    return JsonResponse({
        'cia': cia,
        'reporte': {
            'codigo': 'inv-movimientos', 'titulo': 'Movimientos de Inventario',
            'fecha_generacion': None,
            'filtros': _filtros_basicos(request),
        },
        'filas': filas,
        'totales': {'cantidad': len(filas), 'total': sum(f['monto_neto'] for f in filas)},
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
    desde = request.GET.get('desde', '')
    hasta = request.GET.get('hasta', '')
    # inv_repo.kardex_producto no existe: la funcion real es list_kardex
    # (misma que usaba el renderer ReportLab retirado).
    rows = inv_repo.list_kardex(
        no_cia=no_cia, no_produ=no_produ, almacen=almacen, desde=desde, hasta=hasta,
    )
    filas = [{
        'fecha': str(r.get('fecha') or '')[:10],
        'tipo_docu': (r.get('tipo_docu') or '').strip(),
        'no_docu': r.get('no_docu') or '',
        'almacen': (r.get('almacen') or '').strip(),
        'tipo_movi': r.get('tipo_movi') or '',
        'cantidad': _money(r.get('cantidad')),
        'costo': _money(r.get('costo')),
        'saldo': _money(r.get('saldo')),
    } for r in rows]
    return JsonResponse({
        'cia': cia,
        'reporte': {
            'codigo': 'inv-kardex', 'titulo': f'Kardex Producto {no_produ}',
            'fecha_generacion': None,
            'filtros': _filtros_basicos(request, {'Producto': no_produ, 'Almacén': almacen}),
        },
        'filas': filas,
        'totales': {'cantidad': len(filas)},
    })


@login_required
@require_http_methods(["GET"])
def inv_valorizacion_print_data(request):
    no_cia = request.GET.get('no_cia', '01')
    err = _check_inv_access(request, no_cia)
    if err is not None:
        return err
    cia = _cia_payload(no_cia, request=request)
    almacen = request.GET.get('almacen', '')
    # list_existencias no aplica el filtro de existencia<>0 ni junta almacen_desc
    # de la misma forma que el renderer ReportLab retirado; usar la misma fuente
    # real (get_valoracion_inventario) para no cambiar los totales del reporte.
    rows = inv_repo.get_valoracion_inventario(no_cia=no_cia, almacen=almacen)
    filas = [{
        'almacen': (r.get('almacen') or '').strip(),
        'almacen_desc': (r.get('almacen_desc') or '').strip(),
        'almacen_label': f"{(r.get('almacen') or '').strip()} {(r.get('almacen_desc') or '').strip()}".strip(),
        'no_produ': r.get('no_produ', ''),
        'descripcion': (r.get('descripcion') or '')[:60],
        'existencia': _money(r.get('existencia')),
        'costo_prom': _money(r.get('costo_actual')),
        'valor': _money(r.get('valor')),
    } for r in rows]
    filas.sort(key=lambda f: (f['almacen'], f['no_produ']))
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
    punto = request.GET.get('punto', '')
    mes = request.GET.get('mes', '')
    ano = request.GET.get('ano', '')
    tipo = request.GET.get('tipo', 'detallado')
    fecha = request.GET.get('fecha', '')
    if not mes or not ano:
        return JsonResponse({'error': 'Parametros mes y ano requeridos'}, status=400)
    cia = _cia_payload(no_cia, request=request)
    # inv_repo.list_cierre_entrada_diario no existe: la funcion real es
    # list_entrada_diario (misma que usaba el renderer ReportLab retirado).
    # Trae dos formas de fila segun la fuente (TINV_ED con cuenta contable, o
    # TINV_MOVIMIENTO de respaldo con almacen/producto) — se normalizan a un
    # unico set de columnas para la plantilla, dejando vacio lo que no aplique.
    rows = inv_repo.list_entrada_diario(
        no_cia=no_cia, punto=punto, ano=ano, mes=mes, fecha=fecha, tipo=tipo,
    )
    filas = [{
        'fecha': str(r.get('fecha') or '')[:10],
        'tipo_docu': (r.get('tipo_docu') or '').strip(),
        'no_docu': r.get('no_docu') or '',
        'cuenta': (r.get('cuenta') or '').strip(),
        'centro_costo': (r.get('centro_costo') or '').strip(),
        'almacen': (r.get('almacen') or '').strip(),
        'no_produ': r.get('no_produ') or '',
        'tipo_movi': r.get('tipo_movi') or '',
        'monto': _money(r.get('monto')),
    } for r in rows]
    total = sum(f['monto'] for f in filas)
    return JsonResponse({
        'cia': cia,
        'reporte': {
            'codigo': 'inv-cierre-entrada',
            'titulo': f"Entrada de Diario {'Detallado' if tipo == 'detallado' else 'Resumido'} — {mes}/{ano}",
            'fecha_generacion': None,
            'filtros': _filtros_basicos(request, {'Punto': punto, 'Período': f'{mes}/{ano}', 'Tipo': tipo}),
        },
        'filas': filas,
        'totales': {'cantidad': len(filas), 'total': total},
    })


# ─── /api/inv/reportes/lineas-sublineas/print-data/ ──────────────────────

@login_required
@require_http_methods(["GET"])
def inv_lineas_sublineas_print_data(request):
    """Catálogo de Líneas (y sus Sublíneas si detalle_sublinea=1) por rango."""
    no_cia = request.GET.get('no_cia', '01')
    err = _check_inv_access(request, no_cia)
    if err is not None:
        return err
    cia = _cia_payload(no_cia, request=request)
    linea_ini = (request.GET.get('linea_ini') or '').strip()
    linea_fin = (request.GET.get('linea_fin') or '').strip()
    detalle = (request.GET.get('detalle_sublinea', '1') or '1') != '0'
    lineas = inv_repo.list_lineas(no_cia=no_cia) or []
    filas = []
    for l in lineas:
        code = str(l.get('linea') or '').strip()
        if linea_ini and code < linea_ini:
            continue
        if linea_fin and code > linea_fin:
            continue
        filas.append({
            'linea': code, 'sub_linea': '',
            'descripcion': (l.get('descripcion') or '').strip(),
        })
        if detalle:
            try:
                subs = inv_repo.list_sublineas(no_cia=no_cia, linea=code) or []
            except Exception:
                subs = []
            for s in subs:
                filas.append({
                    'linea': code,
                    'sub_linea': str(s.get('sub_linea') or '').strip(),
                    'descripcion': '   ' + (s.get('descripcion') or '').strip(),
                })
    return JsonResponse({
        'cia': cia,
        'reporte': {
            'codigo': 'inv-lineas-sublineas', 'titulo': 'Líneas y Sublíneas',
            'fecha_generacion': None,
            'filtros': _filtros_basicos(request, {'Desde línea': linea_ini, 'Hasta línea': linea_fin}),
        },
        'filas': filas,
        'totales': {'cantidad': len(filas)},
    })


# ─── /api/inv/reportes/auxiliar/print-data/ (FINV303 — Auxiliar) ──────────

@login_required
@require_http_methods(["GET"])
def inv_auxiliar_print_data(request):
    """Auxiliar de Inventario: movimientos detallados del período/almacén.
    Reusa list_movimientos (mismo dato que el reporte de Movimientos) con el
    rango del mes cuando se pasa mes/anio, filtrando por producto si se indica."""
    no_cia = request.GET.get('no_cia', '01')
    err = _check_inv_access(request, no_cia)
    if err is not None:
        return err
    cia = _cia_payload(no_cia, request=request)
    almacen = request.GET.get('almacen', '')
    no_produ = (request.GET.get('no_produ') or '').strip().upper()
    desde = request.GET.get('desde', '')
    hasta = request.GET.get('hasta', '')
    mes = request.GET.get('mes', '')
    anio = request.GET.get('anio', '') or request.GET.get('ano', '')
    if mes and anio and not (desde and hasta):
        import calendar
        try:
            a, m = int(anio), int(mes)
            desde = '%04d-%02d-01' % (a, m)
            hasta = '%04d-%02d-%02d' % (a, m, calendar.monthrange(a, m)[1])
        except Exception:
            desde = hasta = ''
    rows = inv_repo.list_movimientos(
        no_cia=no_cia, almacen=almacen, tipo='', desde=desde, hasta=hasta) or []
    filas = []
    for r in rows:
        if no_produ and str(r.get('no_produ') or '').strip().upper() != no_produ:
            continue
        filas.append({
            'fecha': str(r.get('fecha') or '')[:10],
            'tipo_docu': (r.get('tipo_docu') or '').strip(),
            'no_docu': r.get('no_docu') or '',
            'almacen': (r.get('almacen') or '').strip(),
            'no_produ': r.get('no_produ') or '',
            'descripcion': (r.get('descripcion') or '')[:50],
            'tipo_movi': r.get('tipo_movi') or '',
            'cantidad': _money(r.get('cantidad')),
            'costo': _money(r.get('costo')),
            'monto_neto': _money(r.get('monto_neto')),
        })
    filas.sort(key=lambda f: (f['no_produ'], f['fecha'], f['no_docu']))
    return JsonResponse({
        'cia': cia,
        'reporte': {
            'codigo': 'inv-auxiliar', 'titulo': 'Auxiliar de Inventario',
            'fecha_generacion': None,
            'filtros': _filtros_basicos(request, {'Período': ('%s/%s' % (mes, anio)) if mes and anio else '', 'Almacén': almacen, 'Producto': no_produ}),
        },
        'filas': filas,
        'totales': {'cantidad': len(filas), 'total': sum(f['monto_neto'] for f in filas)},
    })


# ─── /api/inv/reportes/conteo-comparativo/print-data/ ────────────────────

@login_required
@require_http_methods(["GET"])
def inv_conteo_comparativo_print_data(request):
    """Comparativo de Conteo Físico vs existencia en libro (filas pendientes)."""
    no_cia = request.GET.get('no_cia', '01')
    err = _check_inv_access(request, no_cia)
    if err is not None:
        return err
    cia = _cia_payload(no_cia, request=request)
    punto = request.GET.get('punto', '')
    almacen = request.GET.get('almacen', '')
    no_produ = (request.GET.get('no_produ') or '').strip()
    try:
        rows = inv_repo.comparativo_conteo_fisico(no_cia, punto, almacen, no_produ) or []
    except Exception:
        rows = []
    filas = [{
        'almacen': (r.get('almacen') or '').strip(),
        'no_produ': r.get('no_produ') or '',
        'descripcion': (r.get('descripcion') or '')[:50],
        'conteo_fisico': _money(r.get('conteo_total') if r.get('conteo_total') is not None else r.get('conteo_fisico')),
        'exist_libro': _money(r.get('exist_libro')),
        'diferencia': _money(r.get('diferencia')),
        'costo_actual': _money(r.get('costo_actual')),
        'valor_diferencia': _money(r.get('valor_diferencia')),
    } for r in rows]
    return JsonResponse({
        'cia': cia,
        'reporte': {
            'codigo': 'inv-conteo-comparativo', 'titulo': 'Comparativo de Conteo Físico',
            'fecha_generacion': None,
            'filtros': _filtros_basicos(request, {'Punto': punto, 'Almacén': almacen, 'Producto': no_produ}),
        },
        'filas': filas,
        'totales': {'cantidad': len(filas), 'total': sum(f['valor_diferencia'] for f in filas)},
    })
