"""Bancos / Cheques / Conciliación (CHC) — vistas HTTP."""
import json
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from apps.legacy.repositories import chc_repo


def _norm_punto(p):
    if not p: return p
    try: return str(int(p)).zfill(2)
    except ValueError: return p


# ---- Bancos / Config ----
@login_required
@csrf_exempt
@require_http_methods(['GET', 'POST'])
def chc_bancos(request):
    if request.method == 'GET':
        return JsonResponse(chc_repo.list_bancos(request.GET.get('activo', '')), safe=False)
    data = json.loads(request.body)
    chc_repo.upsert_banco(data['banco'], data['descri'], data.get('activo', 'S'),
                          data.get('rnc'), data.get('siglas_banco'))
    return JsonResponse({'ok': True}, status=201)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def chc_cias(request):
    return JsonResponse(chc_repo.list_cias(), safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def chc_puntos(request):
    return JsonResponse(chc_repo.list_puntos(request.GET.get('no_cia', '')), safe=False)


# ---- Cuentas ----
@login_required
@csrf_exempt
@require_http_methods(['GET'])
def chc_cuentas(request):
    return JsonResponse(chc_repo.list_cuentas_bancarias(
        request.GET.get('no_cia', ''),
        _norm_punto(request.GET.get('punto', '')) or None,
        request.GET.get('activa', ''),
    ), safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def chc_cuenta_saldo(request):
    return JsonResponse(chc_repo.get_saldo_cuenta(
        request.GET.get('no_cia', ''),
        _norm_punto(request.GET.get('punto', '')),
        request.GET.get('cuenta_banco', ''),
    ))


# ---- Cheques ----
@login_required
@csrf_exempt
@require_http_methods(['GET'])
def chc_cheques(request):
    rows = chc_repo.list_cheques(
        no_cia=request.GET.get('no_cia', ''),
        punto=_norm_punto(request.GET.get('punto', '')) or None,
        cuenta_banco=request.GET.get('cuenta_banco') or None,
        status=request.GET.get('status') or None,
        conciliado=request.GET.get('conciliado') or None,
        entregado=request.GET.get('entregado') or None,
        no_proveedor=request.GET.get('no_proveedor') or None,
        fecha_desde=request.GET.get('fecha_desde') or None,
        fecha_hasta=request.GET.get('fecha_hasta') or None,
        limit=int(request.GET.get('limit', 200)),
    )
    return JsonResponse(rows, safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def chc_cheque(request, no_cia, punto, tipo_docu, no_docu):
    row = chc_repo.get_cheque(no_cia, _norm_punto(punto), tipo_docu, no_docu)
    if not row:
        return JsonResponse({'error': 'not found'}, status=404)
    return JsonResponse(row)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def chc_tipos_docu(request):
    return JsonResponse(chc_repo.list_tipos_docu(), safe=False)


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def chc_cheque_anular(request):
    data = json.loads(request.body)
    chc_repo.anular_cheque(data['no_cia'], _norm_punto(data['punto']),
                           data['tipo_docu'], data['no_docu'], data.get('motivo', ''))
    return JsonResponse({'ok': True})


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def chc_cheque_entregar(request):
    data = json.loads(request.body)
    chc_repo.marcar_entregado(data['no_cia'], _norm_punto(data['punto']),
                              data['tipo_docu'], data['no_docu'], request.user.username)
    return JsonResponse({'ok': True})


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def chc_cheque_conciliar(request):
    data = json.loads(request.body)
    chc_repo.marcar_conciliado(data['no_cia'], _norm_punto(data['punto']),
                               data['tipo_docu'], data['no_docu'])
    return JsonResponse({'ok': True})


# ---- Cierres ----
@login_required
@csrf_exempt
@require_http_methods(['GET'])
def chc_cierres(request):
    return JsonResponse(chc_repo.list_cierres(
        request.GET.get('no_cia', ''),
        _norm_punto(request.GET.get('punto', '')) or None,
        request.GET.get('cuenta_banco') or None,
    ), safe=False)


# ---- Reportes ----
@login_required
@csrf_exempt
@require_http_methods(['GET'])
def chc_rep_resumen_cuenta(request):
    return JsonResponse(chc_repo.rep_resumen_cuenta(
        request.GET.get('no_cia', ''),
        _norm_punto(request.GET.get('punto', '')),
        request.GET.get('cuenta_banco', ''),
        request.GET.get('fecha_desde', ''),
        request.GET.get('fecha_hasta', ''),
    ))


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def chc_rep_balance(request):
    return JsonResponse(chc_repo.rep_balance_cuentas(
        request.GET.get('no_cia', ''),
        _norm_punto(request.GET.get('punto', '')) or None,
    ), safe=False)
