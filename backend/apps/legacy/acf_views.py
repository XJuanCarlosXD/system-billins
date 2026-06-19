"""Activos Fijos (ACF) — vistas HTTP."""
import json

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from apps.legacy.repositories import acf_repo


def _body(request) -> dict:
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode('utf-8'))
    except (ValueError, UnicodeDecodeError):
        return {}


def _user(request) -> str:
    u = getattr(request, 'user', None)
    return getattr(u, 'username', '') or 'API'


def _np(p):
    if not p: return p
    try: return str(int(p)).zfill(2)
    except ValueError: return p


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def acf_cias(request):
    return JsonResponse(acf_repo.list_cias(), safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def acf_puntos(request):
    return JsonResponse(acf_repo.list_puntos(request.GET.get('no_cia', '')), safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def acf_categorias(request):
    return JsonResponse(acf_repo.list_categorias(), safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def acf_grupos(request):
    return JsonResponse(acf_repo.list_grupos(), safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def acf_subgrupos(request):
    return JsonResponse(acf_repo.list_subgrupos(), safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def acf_marcas(request):
    return JsonResponse(acf_repo.list_marcas(), safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def acf_responsables(request):
    return JsonResponse(acf_repo.list_responsables(), safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def acf_departamentos(request):
    return JsonResponse(acf_repo.list_departamentos(), safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def acf_activos(request):
    rows = acf_repo.list_activos(
        no_cia=request.GET.get('no_cia', ''),
        punto=_np(request.GET.get('punto', '')) or None,
        status=request.GET.get('status') or None,
        tipo=request.GET.get('tipo') or None,
        grupo=request.GET.get('grupo') or None,
        departamento=request.GET.get('departamento') or None,
        search=request.GET.get('search', ''),
        limit=int(request.GET.get('limit', 200)),
    )
    return JsonResponse(rows, safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def acf_activo(request, no_cia, punto, no_activo):
    row = acf_repo.get_activo(no_cia, _np(punto), no_activo)
    if not row:
        return JsonResponse({'error': 'not found'}, status=404)
    return JsonResponse(row)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def acf_rep_resumen(request):
    return JsonResponse(acf_repo.rep_resumen(
        request.GET.get('no_cia', ''),
        _np(request.GET.get('punto', '')) or None,
    ))


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def acf_rep_por_grupo(request):
    return JsonResponse(acf_repo.rep_activos_por_grupo(
        request.GET.get('no_cia', ''),
        _np(request.GET.get('punto', '')) or None,
    ), safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def acf_rep_por_departamento(request):
    return JsonResponse(acf_repo.rep_activos_por_departamento(
        request.GET.get('no_cia', ''),
        _np(request.GET.get('punto', '')) or None,
    ), safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def acf_rep_valuacion(request):
    return JsonResponse(acf_repo.rep_valuacion(
        request.GET.get('no_cia', ''),
        _np(request.GET.get('punto', '')) or None,
    ))


# ---- Procesos ----

@login_required
@csrf_exempt
@require_http_methods(['POST'])
def acf_compra(request):
    data = _body(request)
    if data.get('punto'):
        data['punto'] = _np(data['punto'])
    try:
        return JsonResponse(acf_repo.crear_compra(data, _user(request)))
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def acf_retiro(request):
    data = _body(request)
    if data.get('punto'):
        data['punto'] = _np(data['punto'])
    try:
        return JsonResponse(acf_repo.crear_retiro(data, _user(request)))
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def acf_depreciacion_preview(request):
    return JsonResponse(acf_repo.depreciacion_preview(
        request.GET.get('no_cia', ''),
        _np(request.GET.get('punto', '')),
    ))


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def acf_depreciacion(request):
    data = _body(request)
    try:
        return JsonResponse(acf_repo.aplicar_depreciacion(
            data.get('no_cia', ''),
            _np(data.get('punto', '')),
            _user(request),
            data.get('cuenta_gasto', ''),
            data.get('cuenta_acumulada', ''),
        ))
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def acf_cierre_status(request):
    return JsonResponse(acf_repo.cierre_status(
        request.GET.get('no_cia', ''),
        _np(request.GET.get('punto', '')),
    ))


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def acf_cierres(request):
    ano = request.GET.get('ano')
    return JsonResponse(acf_repo.list_cierres(
        request.GET.get('no_cia', ''),
        _np(request.GET.get('punto', '')),
        int(ano) if ano else None,
    ), safe=False)


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def acf_aplicar_cierre(request):
    data = _body(request)
    try:
        return JsonResponse(acf_repo.aplicar_cierre(
            data.get('no_cia', ''),
            _np(data.get('punto', '')),
            _user(request),
        ))
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)
