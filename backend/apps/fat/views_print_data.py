"""Endpoints `print-data` para FAT.

Devuelven JSON con todo lo necesario para que el frontend renderice el PDF
en /print/<codigo_doc>/<id>. Sustituyen progresivamente a views_print.py
(ReportLab) — ver spec 2026-06-10-pdf-frontend-templates-design.md.

Forma estándar familia "documento":
  { cia, doc, cliente, lineas, totales, extra? }

Forma estándar familia "reporte":
  { cia, reporte, filas, totales }
"""
from __future__ import annotations

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from apps.legacy.repositories import fat_repo, inv_repo, cxc_repo, permissions_repo
from apps.legacy.logo_helpers import get_logo_path


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


def _resolve_logo_url(request, no_cia: str) -> str:
    """Devuelve la URL pública absoluta del logo de la empresa, o '' si no existe.

    El logo se sube vía POST /api/cnt/cia-header/ y se guarda en
    MEDIA_ROOT/logos/<no_cia>.<ext>. Aquí se compone {scheme}://{host}{MEDIA_URL}logos/...
    para que el frontend (Netlify, distinto origen) pueda hacer <img src> sin CORS.
    """
    p = get_logo_path(no_cia)
    if not p:
        return ''
    media_url = getattr(settings, 'MEDIA_URL', '/media/')
    # Construye URL absoluta usando request.build_absolute_uri para portabilidad.
    try:
        return request.build_absolute_uri(f"{media_url}logos/{p.name}")
    except Exception:
        return f"{media_url}logos/{p.name}"


def _cia_payload(no_cia: str, request=None) -> dict:
    """Resuelve datos de empresa (razón social, RNC, dirección, etc.) desde TFAT_CIAS o TCNT_CIAS."""
    cia = {}
    try:
        cia = next(
            (c for c in fat_repo.list_companias_fat() if str(c.get('no_cia')).strip() == no_cia),
            None,
        ) or {}
    except Exception:
        cia = {}
    if not cia:
        cia = inv_repo.get_compania(no_cia) or {}
    logo_url = _resolve_logo_url(request, no_cia) if request is not None else ''
    return {
        'no_cia': no_cia,
        'razon_social': (cia.get('descripcion') or no_cia).strip(),
        'rnc': (cia.get('rnc') or '').strip(),
        'direccion': (cia.get('direccion') or '').strip(),
        'telefono': (cia.get('telefono') or '').strip(),
        'email': (cia.get('email') or '').strip(),
        'logo_url': logo_url,
        'color_primario': cia.get('color_primario') or '#0F172A',
    }


def _check_fat_access(request, no_cia: str, punto: str):
    perms = permissions_repo.get_for(request.user.username, 'fat', no_cia, punto)
    if perms is None or not perms.activo:
        return JsonResponse({'detail': 'sin acceso a FAT en esta empresa/punto'}, status=403)
    return None


def _money(v) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def _numero_a_letras(monto: float) -> str:
    """Convierte el monto a su representación en letras (es-DO).

    Reusa el helper de views_print si está disponible; si no, devuelve cadena vacía.
    """
    try:
        from apps.fat.views_print import _importe_en_letras
        return _importe_en_letras(monto)
    except Exception:
        return ''


# ─── /api/fat/documentos/<tipo>/<no_factura>/print-data/ ─────────────────────

@login_required
@require_http_methods(["GET"])
def fat_factura_print_data(request, tipo: str, no_factura: str):
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    err = _check_fat_access(request, no_cia, punto)
    if err is not None:
        return err

    tipo_s = (tipo or '').strip().upper()
    factura = fat_repo.get_factura(no_cia, punto, tipo_s, (no_factura or '').strip())
    if factura is None:
        return JsonResponse({'error': 'Factura no encontrada'}, status=404)

    cia = _cia_payload(no_cia, request=request)

    no_cliente_str = str(factura.get('no_cliente') or '')
    cliente_row = cxc_repo.get_cliente(no_cia, no_cliente_str) or {}

    nombre_vendedor = fat_repo.get_vendedor_nombre(no_cia, factura.get('vendedor', '')) or ''
    descripcion_cond_pago = fat_repo.get_condicion_pago_descripcion(
        factura.get('no_condicion_pago', '')) or ''
    forma_pago = (factura.get('forma_pago') or '').strip()
    try:
        tipos_pago = fat_repo.list_tipos_pago(no_cia, punto)
        tp = next((p for p in tipos_pago if str(p.get('tipo_pago')).strip() == forma_pago), None)
        if tp and tp.get('descripcion'):
            forma_pago = tp['descripcion']
    except Exception:
        pass

    tipo_ncf_fiscal = (factura.get('posiciones_fijas_ncf') or
                       factura.get('tipo_ncf_fiscal') or '').strip().upper()
    ncf_descripcion = NCF_DESCRIPCION.get(tipo_ncf_fiscal, '')

    doc = {
        'tipo': tipo_s,
        'tipo_label': {'FC': 'Factura Crédito', 'FT': 'Factura Contado'}.get(tipo_s, 'Factura'),
        'no': factura.get('no_factura'),
        'numero_display': f"{tipo_s}-{factura.get('no_factura')}",
        'fecha': factura.get('fecha'),
        'fecha_venc': None,
        'ncf': factura.get('ncf'),
        'ncf_dgi': factura.get('ncf_dgi') or '',
        'tipo_ncf': tipo_ncf_fiscal,
        'tipo_ncf_label': (
            f"{tipo_ncf_fiscal} — {ncf_descripcion}" if tipo_ncf_fiscal and ncf_descripcion else tipo_ncf_fiscal
        ),
        'estado': factura.get('estado') or 'P',
        'anulada': (factura.get('st_anulado') or 'N') == 'S',
        'impresion': 'REIMPRESA' if (factura.get('st_impresion') or 'N') == 'S' else 'IMPRESA',
        'condicion_pago': descripcion_cond_pago,
        'forma_pago': forma_pago,
        'plazo_pago': factura.get('plazo_pago') or 0,
        'vendedor_codigo': (factura.get('vendedor') or '').strip(),
        'vendedor_nombre': nombre_vendedor,
        'vendedor': (
            f"{(factura.get('vendedor') or '').strip()} — {nombre_vendedor}"
            if nombre_vendedor else (factura.get('vendedor') or '').strip()
        ),
        'nota': factura.get('nota') or '',
        'detalle': factura.get('detalle') or '',
        'moneda': 'DOP',
        'tasa': factura.get('tasa_us') or 0,
        'porc_impuesto': factura.get('porc_impuesto') or 0,
    }

    cliente = {
        'no': factura.get('no_cliente'),
        'nombre': (factura.get('nombre_cliente') or cliente_row.get('nombre') or '').strip() or '(sin nombre)',
        'rnc': (cliente_row.get('rnc') or '').strip(),
        'direccion': (cliente_row.get('direccion') or '').strip(),
        'telefono': (cliente_row.get('telefono') or '').strip(),
        'email': (cliente_row.get('email') or '').strip(),
        'tipo_ncf': tipo_ncf_fiscal,
    }

    lineas = [{
        'no_linea': l.get('no_linea'),
        'codigo': l.get('no_produ') or '',
        'descripcion': l.get('descripcion') or '',
        'almacen': l.get('almacen') or '',
        'cantidad': _money(l.get('cantidad')),
        'unidad': '',
        'precio': _money(l.get('precio')),
        'porc_descuento': _money(l.get('porc_descuento')),
        'descuento': _money(l.get('descuento')),
        'porciento_impuesto': _money(l.get('porciento_impuesto')),
        'itbis': _money(l.get('impuesto')),
        'total': _money(l.get('monto_neto')),
        'cantidad_regalia': _money(l.get('cantidad_regalia')),
        'anulada': (l.get('st_anulado') or 'N') == 'S',
    } for l in (factura.get('lineas') or []) if (l.get('st_anulado') or 'N') != 'S']

    subtotal = _money(factura.get('total_linea'))
    descuento = _money(factura.get('descuento'))
    itbis = _money(factura.get('impuesto'))
    propina = _money(factura.get('propina'))
    total = _money(factura.get('total_neto'))
    totales = {
        'subtotal': subtotal,
        'descuento': descuento,
        'itbis': itbis,
        'propina': propina,
        'otros': 0.0,
        'total': total,
        'monto_letras': _numero_a_letras(total),
    }

    return JsonResponse({
        'cia': cia,
        'doc': doc,
        'cliente': cliente,
        'lineas': lineas,
        'totales': totales,
        'extra': {},
    })


# ─── /api/fat/conduces/<tipo>/<no_conduce>/print-data/ ───────────────────────

@login_required
@require_http_methods(["GET"])
def fat_conduce_print_data(request, tipo: str, no_conduce: str):
    """Sirve tanto conduce (CO) como cotización (CT) — el frontend pinta uno u otro
    según `codigo_doc` (conduce vs cotizacion) usando este mismo payload."""
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    err = _check_fat_access(request, no_cia, punto)
    if err is not None:
        return err

    tipo_s = (tipo or '').strip().upper()
    conduce = fat_repo.get_conduce(no_cia, punto, tipo_s, (no_conduce or '').strip())
    if conduce is None:
        return JsonResponse({'error': 'Conduce no encontrado'}, status=404)

    cia = _cia_payload(no_cia, request=request)

    no_cliente_str = str(conduce.get('no_cliente') or '')
    cliente_row = cxc_repo.get_cliente(no_cia, no_cliente_str) or {}

    nombre_vendedor = fat_repo.get_vendedor_nombre(no_cia, conduce.get('vendedor', '')) or ''
    descripcion_cond_pago = fat_repo.get_condicion_pago_descripcion(
        conduce.get('no_condicion_pago', '')) or ''

    es_cotizacion = tipo_s == 'CT'
    tipo_label = 'Cotización' if es_cotizacion else 'Conduce'

    doc = {
        'tipo': tipo_s,
        'tipo_label': tipo_label,
        'no': conduce.get('no_conduce'),
        'numero_display': f"{tipo_s}-{conduce.get('no_conduce')}",
        'fecha': conduce.get('fecha'),
        'fecha_venc': conduce.get('fecha_vencimiento'),
        'ncf': None,
        'ncf_dgi': '',
        'tipo_ncf': '',
        'tipo_ncf_label': '',
        'estado': conduce.get('estado') or 'P',
        'anulada': (conduce.get('st_anulado') or 'N') == 'S',
        'impresion': 'REIMPRESA' if (conduce.get('st_impresion') or 'N') == 'S' else 'IMPRESA',
        'condicion_pago': descripcion_cond_pago,
        'forma_pago': '',
        'plazo_pago': conduce.get('plazo_pago') or 0,
        'vendedor_codigo': (conduce.get('vendedor') or '').strip(),
        'vendedor_nombre': nombre_vendedor,
        'vendedor': (
            f"{(conduce.get('vendedor') or '').strip()} — {nombre_vendedor}"
            if nombre_vendedor else (conduce.get('vendedor') or '').strip()
        ),
        'nota': conduce.get('nota') or '',
        'detalle': conduce.get('detalle') or '',
        'moneda': 'DOP',
        'tasa': conduce.get('tasa_us') or 0,
        'porc_impuesto': conduce.get('porc_impuesto') or 0,
        'factura_relacionada': (
            f"{(conduce.get('tipo_factura') or '').strip()}-{(conduce.get('no_factura') or '').strip()}"
            if (conduce.get('no_factura') or '').strip() else ''
        ),
    }

    cliente = {
        'no': conduce.get('no_cliente'),
        'nombre': (conduce.get('nombre_cliente') or cliente_row.get('nombre') or '').strip() or '(sin nombre)',
        'rnc': (cliente_row.get('rnc') or '').strip(),
        'direccion': (cliente_row.get('direccion') or '').strip(),
        'telefono': (cliente_row.get('telefono') or '').strip(),
        'email': (cliente_row.get('email') or '').strip(),
        'tipo_ncf': '',
    }

    lineas = [{
        'no_linea': l.get('no_linea'),
        'codigo': l.get('no_produ') or '',
        'descripcion': l.get('descripcion') or '',
        'almacen': l.get('almacen') or '',
        'cantidad': _money(l.get('cantidad')),
        'unidad': '',
        'precio': _money(l.get('precio')),
        'porc_descuento': _money(l.get('porc_descuento')),
        'descuento': _money(l.get('descuento')),
        'porciento_impuesto': _money(l.get('porciento_impuesto')),
        'itbis': _money(l.get('impuesto')),
        'total': _money(l.get('monto_neto')),
        'cantidad_regalia': _money(l.get('cantidad_regalia')),
        'anulada': (l.get('st_anulado') or 'N') == 'S',
    } for l in (conduce.get('lineas') or []) if (l.get('st_anulado') or 'N') != 'S']

    subtotal = _money(conduce.get('total_linea'))
    descuento = _money(conduce.get('descuento'))
    itbis = _money(conduce.get('impuesto'))
    total = _money(conduce.get('total_neto'))
    totales = {
        'subtotal': subtotal,
        'descuento': descuento,
        'itbis': itbis,
        'propina': 0.0,
        'otros': 0.0,
        'total': total,
        'monto_letras': _numero_a_letras(total),
    }

    return JsonResponse({
        'cia': cia,
        'doc': doc,
        'cliente': cliente,
        'lineas': lineas,
        'totales': totales,
        'extra': {},
    })


# ─── /api/fat/reportes/listado-facturas/print-data/ ──────────────────────────

@login_required
@require_http_methods(["GET"])
def fat_listado_facturas_print_data(request):
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    err = _check_fat_access(request, no_cia, punto)
    if err is not None:
        return err

    desde = request.GET.get('desde', '')
    hasta = request.GET.get('hasta', '')
    tipo = request.GET.get('tipo', '')
    estado = request.GET.get('estado', '')
    search = request.GET.get('search', '')

    try:
        result = fat_repo.list_facturas(
            no_cia=no_cia, punto=punto,
            fecha_desde=desde, fecha_hasta=hasta,
            tipo=tipo, estado=estado, search=search,
            page=1, page_size=10000,
        )
        items = result.get('items', [])
    except Exception as e:
        return JsonResponse({'error': f'Error consultando facturas: {e}'}, status=500)

    cia = _cia_payload(no_cia, request=request)

    filas = []
    total_general = 0.0
    for r in items:
        ncf_dgi = r.get('ncf_dgi') or ''
        total = _money(r.get('total_neto'))
        total_general += total
        filas.append({
            'tipo': r.get('tipo_factura', ''),
            'no_factura': f"{r.get('tipo_factura', '')}-{r.get('no_factura', '')}",
            'fecha': r.get('fecha') or '',
            'cliente': r.get('nombre_cliente', ''),
            'ncf_dgi': ncf_dgi,
            'estado': r.get('estado', ''),
            'total': total,
        })

    filtros_legibles = {}
    if desde:
        filtros_legibles['Desde'] = desde
    if hasta:
        filtros_legibles['Hasta'] = hasta
    if tipo:
        filtros_legibles['Tipo'] = tipo
    if estado:
        filtros_legibles['Estado'] = estado
    if search:
        filtros_legibles['Búsqueda'] = search

    return JsonResponse({
        'cia': cia,
        'reporte': {
            'codigo': 'listado-facturas',
            'titulo': 'Listado de Facturas',
            'fecha_generacion': None,  # frontend pone la suya al imprimir
            'filtros': filtros_legibles,
        },
        'filas': filas,
        'totales': {
            'total': total_general,
            'cantidad': len(filas),
        },
    })
