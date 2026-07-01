"""Caja Chica (ACC) — vistas HTTP."""
import json
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt

from apps.legacy.repositories import acc_repo


def _norm_punto(p):
    if not p: return p
    try: return str(int(p)).zfill(2)
    except ValueError: return p


# ---- Config ----
@login_required
@csrf_exempt
@require_http_methods(['GET', 'POST'])
def acc_cias(request):
    if request.method == 'GET':
        return JsonResponse(acc_repo.list_cias(), safe=False)
    data = json.loads(request.body)
    acc_repo.upsert_cia(data['no_cia'], data['descripcion'],
                        data.get('registro_cont', 'N'), data.get('activa', 'S'))
    return JsonResponse({'ok': True}, status=201)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def acc_puntos(request):
    return JsonResponse(acc_repo.list_puntos(request.GET.get('no_cia', '')), safe=False)


# ---- Cajas ----
@login_required
@csrf_exempt
@require_http_methods(['GET', 'POST'])
def acc_cajas(request):
    if request.method == 'GET':
        return JsonResponse(acc_repo.list_cajas_chicas(
            request.GET.get('no_cia', ''),
            _norm_punto(request.GET.get('punto', '')) or None,
        ), safe=False)
    data = json.loads(request.body)
    data['punto'] = _norm_punto(data['punto'])
    data['usuario'] = request.user.username
    acc_repo.upsert_caja_chica(data)
    return JsonResponse({'ok': True}, status=201)


# ---- Beneficiarios / Tipos ----
@login_required
@csrf_exempt
@require_http_methods(['GET'])
def acc_beneficiarios(request):
    return JsonResponse(acc_repo.list_beneficiarios(
        activo=request.GET.get('activo', 'S'),
        search=request.GET.get('search', ''),
    ), safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def acc_tipos_bene(request):
    return JsonResponse(acc_repo.list_tipos_bene(), safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def acc_tipos_gasto(request):
    return JsonResponse(acc_repo.list_tipos_gasto(), safe=False)


# ---- Documentos ----
@login_required
@csrf_exempt
@require_http_methods(['GET'])
def acc_documentos(request):
    rows = acc_repo.list_documentos(
        no_cia=request.GET.get('no_cia', ''),
        punto=_norm_punto(request.GET.get('punto', '')) or None,
        no_caja=request.GET.get('no_caja') or None,
        fecha_desde=request.GET.get('fecha_desde') or None,
        fecha_hasta=request.GET.get('fecha_hasta') or None,
        anulado=request.GET.get('anulado') or None,
        limit=int(request.GET.get('limit', 200)),
    )
    return JsonResponse(rows, safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def acc_documento(request, no_cia, punto, no_docu):
    cab = acc_repo.get_documento(no_cia, _norm_punto(punto), no_docu)
    if not cab:
        return JsonResponse({'error': 'not found'}, status=404)
    lineas = acc_repo.list_lineas_documento(no_cia, _norm_punto(punto), no_docu)
    return JsonResponse({'cabecera': cab, 'lineas': lineas})


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def acc_documento_crear(request):
    data = json.loads(request.body)
    no_docu = acc_repo.crear_documento(
        data['no_cia'], _norm_punto(data['punto']),
        data, request.user.username,
    )
    return JsonResponse({'no_docu': no_docu}, status=201)


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def acc_documento_anular(request):
    data = json.loads(request.body)
    acc_repo.anular_documento(data['no_cia'], _norm_punto(data['punto']),
                              data['no_docu'], data.get('motivo', ''))
    return JsonResponse({'ok': True})


# ---- Reposiciones ----
@login_required
@csrf_exempt
@require_http_methods(['GET'])
def acc_reposiciones(request):
    rows = acc_repo.list_reposiciones(
        no_cia=request.GET.get('no_cia', ''),
        punto=_norm_punto(request.GET.get('punto', '')) or None,
        no_caja=request.GET.get('no_caja') or None,
        fecha_desde=request.GET.get('fecha_desde') or None,
        fecha_hasta=request.GET.get('fecha_hasta') or None,
        limit=int(request.GET.get('limit', 200)),
    )
    return JsonResponse(rows, safe=False)


# ---- Reportes ----
@login_required
@csrf_exempt
@require_http_methods(['GET'])
def acc_rep_resumen(request):
    return JsonResponse(acc_repo.rep_resumen(
        no_cia=request.GET.get('no_cia', ''),
        punto=_norm_punto(request.GET.get('punto', '')) or None,
        fecha_desde=request.GET.get('fecha_desde') or None,
        fecha_hasta=request.GET.get('fecha_hasta') or None,
    ))


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def acc_rep_gastos_tipo(request):
    return JsonResponse(acc_repo.rep_gastos_por_tipo(
        no_cia=request.GET.get('no_cia', ''),
        punto=_norm_punto(request.GET.get('punto', '')) or None,
        fecha_desde=request.GET.get('fecha_desde') or None,
        fecha_hasta=request.GET.get('fecha_hasta') or None,
    ), safe=False)


# ---- Reposiciones (CRUD adicional) ----
@login_required
@csrf_exempt
@require_http_methods(['GET'])
def acc_reposicion_detalle(request, no_cia, punto, no_reposicion):
    cab = acc_repo.get_reposicion(no_cia, _norm_punto(punto), no_reposicion)
    if not cab:
        return JsonResponse({'error': 'not found'}, status=404)
    docs = acc_repo.list_docs_reposicion(no_cia, _norm_punto(punto), no_reposicion)
    return JsonResponse({'cabecera': cab, 'documentos': docs})


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def acc_docs_pendientes_reposicion(request):
    rows = acc_repo.list_docs_pendientes_reposicion(
        no_cia=request.GET.get('no_cia', ''),
        punto=_norm_punto(request.GET.get('punto', '')) or '01',
        no_caja=request.GET.get('no_caja') or None,
    )
    return JsonResponse(rows, safe=False)


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def acc_reposicion_crear(request):
    data = json.loads(request.body)
    no_rep = acc_repo.crear_reposicion(
        data['no_cia'], _norm_punto(data['punto']),
        data, request.user.username,
    )
    return JsonResponse({'no_reposicion': no_rep}, status=201)


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def acc_reposicion_anular(request):
    data = json.loads(request.body)
    acc_repo.anular_reposicion(
        data['no_cia'], _norm_punto(data['punto']),
        data['no_reposicion'], data.get('motivo', ''),
        request.user.username,
    )
    return JsonResponse({'ok': True})


# ---- Asiento contable mensual ----
@login_required
@csrf_exempt
@require_http_methods(['GET', 'POST'])
def acc_asiento(request):
    if request.method == 'GET':
        return JsonResponse(acc_repo.preview_asiento(
            no_cia=request.GET.get('no_cia', ''),
            punto=_norm_punto(request.GET.get('punto', '')) or '01',
            ano=int(request.GET.get('ano') or 0),
            mes=int(request.GET.get('mes') or 0),
        ))
    data = json.loads(request.body)
    res = acc_repo.generar_asiento(
        no_cia=data['no_cia'],
        punto=_norm_punto(data['punto']),
        ano=int(data['ano']),
        mes=int(data['mes']),
    )
    return JsonResponse(res, status=200)


# ---- Cierre mensual ----
@login_required
@csrf_exempt
@require_http_methods(['GET'])
def acc_cierre_status(request):
    return JsonResponse(acc_repo.cierre_status(
        no_cia=request.GET.get('no_cia', ''),
        punto=_norm_punto(request.GET.get('punto', '')) or '01',
    ))


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def acc_cierre_list(request):
    return JsonResponse(acc_repo.list_cierres(
        no_cia=request.GET.get('no_cia', ''),
        punto=_norm_punto(request.GET.get('punto', '')) or '01',
        ano=int(request.GET.get('ano') or 0) or None,
    ), safe=False)


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def acc_cierre_aplicar(request):
    data = json.loads(request.body)
    try:
        res = acc_repo.aplicar_cierre(
            data['no_cia'], _norm_punto(data['punto']),
            request.user.username,
        )
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse(res, status=201)


# ---- Beneficiarios / tipos (CRUD complementario) ----
@login_required
@csrf_exempt
@require_http_methods(['POST'])
def acc_beneficiario_save(request):
    data = json.loads(request.body)
    no_bene = acc_repo.upsert_beneficiario(data, request.user.username)
    return JsonResponse({'no_bene': no_bene}, status=201)


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def acc_tipo_gasto_save(request):
    data = json.loads(request.body)
    tg = acc_repo.upsert_tipo_gasto(data)
    return JsonResponse({'tipo_gasto': tg}, status=201)


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def acc_tipo_bene_save(request):
    data = json.loads(request.body)
    tb = acc_repo.upsert_tipo_bene(data)
    return JsonResponse({'tipo_bene': tb}, status=201)


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def acc_caja_save(request):
    data = json.loads(request.body)
    if not data.get('usuario'):
        data['usuario'] = request.user.username
    acc_repo.upsert_caja_chica(data)
    return JsonResponse({'no_caja': data['no_caja']}, status=201)


def _delete_view(fn):
    try:
        fn()
        return JsonResponse({'ok': True})
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
@csrf_exempt
@require_http_methods(['DELETE'])
def acc_beneficiario_delete(request, no_bene):
    return _delete_view(lambda: acc_repo.delete_beneficiario(no_bene))


@login_required
@csrf_exempt
@require_http_methods(['DELETE'])
def acc_tipo_bene_delete(request, tipo_bene):
    return _delete_view(lambda: acc_repo.delete_tipo_bene(tipo_bene))


@login_required
@csrf_exempt
@require_http_methods(['DELETE'])
def acc_tipo_gasto_delete(request, tipo_gasto):
    return _delete_view(lambda: acc_repo.delete_tipo_gasto(tipo_gasto))


@login_required
@csrf_exempt
@require_http_methods(['DELETE'])
def acc_caja_delete(request, no_cia, punto, no_caja):
    return _delete_view(lambda: acc_repo.delete_caja_chica(no_cia, punto, no_caja))
