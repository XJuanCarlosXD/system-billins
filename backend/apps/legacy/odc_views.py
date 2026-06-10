"""Órdenes de Compra (ODC) — vistas HTTP estilo CxP.

Endpoint base: /api/odc/ (registrado en facturation_api/urls.py).
Patrón: vistas función, login_required, csrf_exempt, JSON in/out.
"""
import json
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt

from apps.legacy.repositories import odc_repo


def _norm_punto(p):
    if not p:
        return p
    try:
        return str(int(p)).zfill(2)
    except ValueError:
        return p


# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------

@login_required
@csrf_exempt
@require_http_methods(['GET', 'POST'])
def odc_cias(request):
    if request.method == 'GET':
        return JsonResponse(odc_repo.list_cias(), safe=False)
    data = json.loads(request.body)
    odc_repo.upsert_cia(
        data['no_cia'], data['descripcion'],
        data.get('activa', 'S'), data.get('usa_requisicion', 'N'),
    )
    return JsonResponse({'ok': True}, status=201)


@login_required
@csrf_exempt
@require_http_methods(['GET', 'POST'])
def odc_puntos(request):
    if request.method == 'GET':
        no_cia = request.GET.get('no_cia', '')
        return JsonResponse(odc_repo.list_puntos(no_cia), safe=False)
    data = json.loads(request.body)
    odc_repo.upsert_punto(
        data['no_cia'], _norm_punto(data['punto']), data['descripcion'],
        data.get('activo', 'S'),
        int(data.get('prox_orden', 1)),
        int(data.get('prox_requisicion', 1)),
    )
    return JsonResponse({'ok': True}, status=201)


@login_required
@csrf_exempt
@require_http_methods(['GET', 'POST', 'DELETE'])
def odc_usuarios(request):
    if request.method == 'GET':
        no_cia = request.GET.get('no_cia', '')
        punto = _norm_punto(request.GET.get('punto', '')) or None
        return JsonResponse(odc_repo.list_usuarios(no_cia, punto), safe=False)
    if request.method == 'DELETE':
        no_cia = request.GET.get('no_cia', '')
        punto = _norm_punto(request.GET.get('punto', ''))
        usuario = request.GET.get('usuario', '')
        odc_repo.delete_usuario(no_cia, punto, usuario)
        return JsonResponse({'ok': True})
    data = json.loads(request.body)
    odc_repo.upsert_usuario(
        data['no_cia'], _norm_punto(data['punto']), data['usuario'], data,
    )
    return JsonResponse({'ok': True}, status=201)


# ---------------------------------------------------------------------------
# Órdenes
# ---------------------------------------------------------------------------

@login_required
@csrf_exempt
@require_http_methods(['GET'])
def odc_ordenes(request):
    rows = odc_repo.list_ordenes(
        no_cia=request.GET.get('no_cia', ''),
        punto=_norm_punto(request.GET.get('punto', '')) or None,
        estado=request.GET.get('estado') or None,
        st_anulado=request.GET.get('st_anulado') or None,
        no_proveedor=request.GET.get('no_proveedor') or None,
        fecha_desde=request.GET.get('fecha_desde') or None,
        fecha_hasta=request.GET.get('fecha_hasta') or None,
        limit=int(request.GET.get('limit', 200)),
    )
    return JsonResponse(rows, safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def odc_orden(request, no_cia, punto, no_orden):
    cab = odc_repo.get_orden(no_cia, _norm_punto(punto), no_orden)
    if not cab:
        return JsonResponse({'error': 'not found'}, status=404)
    lineas = odc_repo.list_lineas_orden(no_cia, _norm_punto(punto), no_orden)
    return JsonResponse({'cabecera': cab, 'lineas': lineas})


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def odc_orden_crear(request):
    data = json.loads(request.body)
    no_orden = odc_repo.create_orden(
        no_cia=data['no_cia'],
        punto=_norm_punto(data['punto']),
        cabecera=data.get('cabecera', {}),
        lineas=data.get('lineas', []),
        usuario=request.user.username,
    )
    return JsonResponse({'no_orden': no_orden}, status=201)


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def odc_orden_autorizar(request):
    data = json.loads(request.body)
    odc_repo.autorizar_orden(
        data['no_cia'], _norm_punto(data['punto']),
        data['no_orden'], request.user.username,
    )
    return JsonResponse({'ok': True})


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def odc_orden_anular(request):
    data = json.loads(request.body)
    odc_repo.anular_orden(
        data['no_cia'], _norm_punto(data['punto']),
        data['no_orden'], data.get('motivo', ''),
    )
    return JsonResponse({'ok': True})


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def odc_orden_cerrar(request):
    data = json.loads(request.body)
    odc_repo.cerrar_orden(
        data['no_cia'], _norm_punto(data['punto']), data['no_orden'],
    )
    return JsonResponse({'ok': True})


# ---------------------------------------------------------------------------
# Requisiciones
# ---------------------------------------------------------------------------

@login_required
@csrf_exempt
@require_http_methods(['GET'])
def odc_requisiciones(request):
    rows = odc_repo.list_requisiciones(
        no_cia=request.GET.get('no_cia', ''),
        punto=_norm_punto(request.GET.get('punto', '')) or None,
        estado=request.GET.get('estado') or None,
        fecha_desde=request.GET.get('fecha_desde') or None,
        fecha_hasta=request.GET.get('fecha_hasta') or None,
        limit=int(request.GET.get('limit', 200)),
    )
    return JsonResponse(rows, safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def odc_requisicion(request, no_cia, punto, no_requisicion):
    cab = odc_repo.get_requisicion(no_cia, _norm_punto(punto), no_requisicion)
    if not cab:
        return JsonResponse({'error': 'not found'}, status=404)
    lineas = odc_repo.list_lineas_requisicion(
        no_cia, _norm_punto(punto), no_requisicion,
    )
    return JsonResponse({'cabecera': cab, 'lineas': lineas})


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def odc_requisicion_crear(request):
    data = json.loads(request.body)
    no_req = odc_repo.create_requisicion(
        no_cia=data['no_cia'],
        punto=_norm_punto(data['punto']),
        cabecera=data.get('cabecera', {}),
        lineas=data.get('lineas', []),
        usuario=request.user.username,
    )
    return JsonResponse({'no_requisicion': no_req}, status=201)


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def odc_requisicion_autorizar(request):
    data = json.loads(request.body)
    odc_repo.autorizar_requisicion(
        data['no_cia'], _norm_punto(data['punto']),
        data['no_requisicion'], request.user.username,
        int(data.get('slot', 1)),
    )
    return JsonResponse({'ok': True})


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def odc_requisicion_anular(request):
    data = json.loads(request.body)
    odc_repo.anular_requisicion(
        data['no_cia'], _norm_punto(data['punto']),
        data['no_requisicion'], data.get('motivo', ''),
    )
    return JsonResponse({'ok': True})


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def odc_requisicion_cerrar(request):
    data = json.loads(request.body)
    odc_repo.cerrar_requisicion(
        data['no_cia'], _norm_punto(data['punto']), data['no_requisicion'],
    )
    return JsonResponse({'ok': True})


# ---------------------------------------------------------------------------
# Reportes
# ---------------------------------------------------------------------------

@login_required
@csrf_exempt
@require_http_methods(['GET'])
def odc_rep_ordenes_pendientes(request):
    rows = odc_repo.rep_ordenes_pendientes(
        no_cia=request.GET.get('no_cia', ''),
        punto=_norm_punto(request.GET.get('punto', '')) or None,
        fecha_desde=request.GET.get('fecha_desde') or None,
        fecha_hasta=request.GET.get('fecha_hasta') or None,
    )
    return JsonResponse(rows, safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def odc_rep_resumen(request):
    result = odc_repo.rep_resumen(
        no_cia=request.GET.get('no_cia', ''),
        punto=_norm_punto(request.GET.get('punto', '')) or None,
        fecha_desde=request.GET.get('fecha_desde') or None,
        fecha_hasta=request.GET.get('fecha_hasta') or None,
    )
    return JsonResponse(result)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def odc_rep_requisiciones_pendientes(request):
    rows = odc_repo.rep_requisiciones_pendientes(
        no_cia=request.GET.get('no_cia', ''),
        punto=_norm_punto(request.GET.get('punto', '')) or None,
        limit=int(request.GET.get('limit', 200)),
    )
    return JsonResponse(rows, safe=False)
