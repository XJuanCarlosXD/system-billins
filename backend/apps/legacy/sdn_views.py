"""Nómina (SDN) — vistas HTTP."""
import json
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from apps.legacy.repositories import sdn_repo


def _norm_punto(p):
    if not p: return p
    try: return str(int(p)).zfill(2)
    except ValueError: return p


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def sdn_cias(request):
    return JsonResponse(sdn_repo.list_cias(), safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def sdn_afp(request):
    return JsonResponse(sdn_repo.list_afp(), safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def sdn_ars(request):
    return JsonResponse(sdn_repo.list_ars(), safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def sdn_gerencias(request):
    return JsonResponse(sdn_repo.list_gerencias(), safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def sdn_areas(request):
    return JsonResponse(sdn_repo.list_areas(), safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def sdn_deptos(request):
    return JsonResponse(sdn_repo.list_deptos(), safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def sdn_ingresos(request):
    return JsonResponse(sdn_repo.list_ingresos(request.GET.get('status', 'A')), safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def sdn_deducciones(request):
    return JsonResponse(sdn_repo.list_deducciones(request.GET.get('status', 'A')), safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def sdn_empleados(request):
    activos = request.GET.get('activos', '1') in ('1', 'true', 'S', 'y')
    rows = sdn_repo.list_empleados(
        no_cia=request.GET.get('no_cia', ''),
        punto=_norm_punto(request.GET.get('punto', '')) or None,
        nomina=request.GET.get('nomina') or None,
        activos=activos,
        search=request.GET.get('search', ''),
        limit=int(request.GET.get('limit', 200)),
    )
    return JsonResponse(rows, safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def sdn_empleado(request, no_cia, no_empleado):
    row = sdn_repo.get_empleado(no_cia, no_empleado)
    if not row:
        return JsonResponse({'error': 'not found'}, status=404)
    return JsonResponse(row)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def sdn_nominas(request):
    rows = sdn_repo.list_nominas(
        no_cia=request.GET.get('no_cia', ''),
        punto=_norm_punto(request.GET.get('punto', '')) or None,
        estado=request.GET.get('estado') or None,
        ano=int(request.GET.get('ano', 0)) or None,
        mes=int(request.GET.get('mes', 0)) or None,
        limit=int(request.GET.get('limit', 100)),
    )
    return JsonResponse(rows, safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def sdn_vacaciones(request):
    rows = sdn_repo.list_vacaciones(
        no_cia=request.GET.get('no_cia', ''),
        punto=_norm_punto(request.GET.get('punto', '')) or None,
        nomina=request.GET.get('nomina') or None,
        ano=int(request.GET.get('ano', 0)) or None,
        limit=int(request.GET.get('limit', 200)),
    )
    return JsonResponse(rows, safe=False)


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def sdn_nomina_crear(request):
    data = json.loads(request.body)
    try:
        out = sdn_repo.crear_nomina(
            no_cia=data['no_cia'],
            punto=_norm_punto(data['punto']),
            data=data,
        )
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse(out, status=201)


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def sdn_nomina_actualizar(request):
    data = json.loads(request.body)
    try:
        out = sdn_repo.actualizar_nomina(
            no_cia=data['no_cia'],
            punto=_norm_punto(data['punto']),
            nomina=(data['nomina'] or '').upper(),
            data=data,
        )
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse(out)


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def sdn_nomina_anular(request):
    data = json.loads(request.body)
    try:
        sdn_repo.anular_nomina(
            no_cia=data['no_cia'],
            punto=_norm_punto(data['punto']),
            nomina=(data['nomina'] or '').upper(),
        )
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse({'ok': True})


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def sdn_nomina_calcular(request):
    data = json.loads(request.body)
    try:
        out = sdn_repo.calcular_nomina(
            no_cia=data['no_cia'],
            punto=_norm_punto(data['punto']),
            nomina=(data['nomina'] or '').upper(),
            usuario=request.user.username,
        )
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse(out)


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def sdn_nomina_reabrir(request):
    data = json.loads(request.body)
    try:
        out = sdn_repo.reabrir_nomina(
            no_cia=data['no_cia'],
            punto=_norm_punto(data['punto']),
            nomina=(data['nomina'] or '').upper(),
            usuario=request.user.username,
        )
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse(out)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def sdn_nomina_volante(request):
    try:
        out = sdn_repo.volante_nomina(
            no_cia=request.GET.get('no_cia', ''),
            punto=_norm_punto(request.GET.get('punto', '')),
            nomina=(request.GET.get('nomina') or '').upper(),
        )
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse(out)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def sdn_rep_resumen_empleados(request):
    return JsonResponse(sdn_repo.rep_resumen_empleados(request.GET.get('no_cia', '')))


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def sdn_rep_nominas_resumen(request):
    return JsonResponse(sdn_repo.rep_nominas_resumen(
        request.GET.get('no_cia', ''),
        int(request.GET.get('ano', 0)) or None,
    ), safe=False)
