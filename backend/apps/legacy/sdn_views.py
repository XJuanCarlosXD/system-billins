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
@require_http_methods(['GET', 'POST'])
def sdn_afp(request):
    if request.method == 'GET':
        return JsonResponse(sdn_repo.list_afp(), safe=False)
    data = json.loads(request.body or '{}')
    return JsonResponse({'no_afp': sdn_repo.upsert_afp(data)}, status=201)


@login_required
@csrf_exempt
@require_http_methods(['DELETE'])
def sdn_afp_delete(request, no_afp):
    return _crud_delete(lambda: sdn_repo.delete_afp(no_afp))


@login_required
@csrf_exempt
@require_http_methods(['GET', 'POST'])
def sdn_ars(request):
    if request.method == 'GET':
        return JsonResponse(sdn_repo.list_ars(), safe=False)
    data = json.loads(request.body or '{}')
    return JsonResponse({'no_ars': sdn_repo.upsert_ars(data)}, status=201)


@login_required
@csrf_exempt
@require_http_methods(['DELETE'])
def sdn_ars_delete(request, no_ars):
    return _crud_delete(lambda: sdn_repo.delete_ars(no_ars))


@login_required
@csrf_exempt
@require_http_methods(['GET', 'POST'])
def sdn_gerencias(request):
    if request.method == 'GET':
        return JsonResponse(sdn_repo.list_gerencias(), safe=False)
    data = json.loads(request.body or '{}')
    return JsonResponse({'no_gerencia': sdn_repo.upsert_gerencia(data)}, status=201)


@login_required
@csrf_exempt
@require_http_methods(['DELETE'])
def sdn_gerencia_delete(request, no_gerencia):
    return _crud_delete(lambda: sdn_repo.delete_gerencia(no_gerencia))


@login_required
@csrf_exempt
@require_http_methods(['GET', 'POST'])
def sdn_areas(request):
    if request.method == 'GET':
        return JsonResponse(sdn_repo.list_areas(), safe=False)
    data = json.loads(request.body or '{}')
    ng, na = sdn_repo.upsert_area(data)
    return JsonResponse({'no_gerencia': ng, 'no_area': na}, status=201)


@login_required
@csrf_exempt
@require_http_methods(['DELETE'])
def sdn_area_delete(request, no_gerencia, no_area):
    return _crud_delete(lambda: sdn_repo.delete_area(no_gerencia, no_area))


@login_required
@csrf_exempt
@require_http_methods(['GET', 'POST'])
def sdn_deptos(request):
    if request.method == 'GET':
        return JsonResponse(sdn_repo.list_deptos(), safe=False)
    data = json.loads(request.body or '{}')
    ng, na, nd = sdn_repo.upsert_depto(data)
    return JsonResponse(
        {'no_gerencia': ng, 'no_area': na, 'no_depto': nd}, status=201
    )


@login_required
@csrf_exempt
@require_http_methods(['DELETE'])
def sdn_depto_delete(request, no_gerencia, no_area, no_depto):
    return _crud_delete(
        lambda: sdn_repo.delete_depto(no_gerencia, no_area, no_depto)
    )


def _crud_delete(fn):
    try:
        fn()
        return JsonResponse({'ok': True})
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


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
@require_http_methods(['GET', 'POST'])
def sdn_empleados(request):
    if request.method == 'POST':
        data = json.loads(request.body or '{}')
        try:
            row = sdn_repo.crear_empleado(data, request.user.username)
            return JsonResponse(row, status=201)
        except ValueError as e:
            return JsonResponse({'error': str(e)}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
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
def sdn_empleado_catalogos(request):
    return JsonResponse(sdn_repo.empleado_catalogos(request.GET.get('no_cia', '')))


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def sdn_empleado_baja(request, no_cia, no_empleado):
    data = json.loads(request.body or '{}')
    try:
        row = sdn_repo.dar_baja_empleado(no_cia, no_empleado, data.get('fecha_egreso'))
        return JsonResponse(row)
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def sdn_empleado_reactivar(request, no_cia, no_empleado):
    try:
        row = sdn_repo.reactivar_empleado(no_cia, no_empleado)
        return JsonResponse(row)
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


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


# --- Movimientos manuales (Fsdn204/205) --------------------------------------

@login_required
@csrf_exempt
@require_http_methods(['GET'])
def sdn_movimientos_list(request):
    rows = sdn_repo.list_movimientos(
        no_cia=request.GET.get('no_cia', ''),
        punto=_norm_punto(request.GET.get('punto', '01')),
        nomina=(request.GET.get('nomina') or '').upper(),
        ano=int(request.GET.get('ano', 0)),
        mes=int(request.GET.get('mes', 0)),
        periodo=int(request.GET.get('periodo', 1)),
        no_empleado=int(request.GET.get('no_empleado', 0)) or None,
        tipo=request.GET.get('tipo') or None,
        origen=request.GET.get('origen') or None,
    )
    return JsonResponse(rows, safe=False)


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def sdn_movimientos_crear(request):
    data = json.loads(request.body or '{}')
    try:
        out = sdn_repo.crear_movimiento_manual(
            no_cia=data['no_cia'],
            punto=_norm_punto(data['punto']),
            nomina=(data['nomina'] or '').upper(),
            ano=int(data['ano']),
            mes=int(data['mes']),
            periodo=int(data.get('periodo', 1)),
            no_empleado=int(data['no_empleado']),
            tipo_transaccion=data['tipo_transaccion'],
            no_transaccion=data['no_transaccion'],
            monto=float(data['monto']),
            clase_transaccion=(data.get('clase_transaccion') or 'L').upper(),
            empleado_patrono=(data.get('empleado_patrono') or 'E').upper(),
            usuario=request.user.username,
        )
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse(out, status=201)


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def sdn_deduccion_masiva(request):
    """POST /api/sdn/deduccion-masiva/

    Body:
      no_cia, punto, nomina, ano, mes, periodo, no_deduccion
      [empleados_ids]  list[int]  opcional, restringe los empleados
      [dry_run]        bool       si true sólo devuelve el preview

    Útil para AFP (TSS), ARS (SFS), ISR, etc. — aplica el % o valor
    del catálogo TSDN_DEDUCCIONES a todos los empleados activos.
    """
    data = json.loads(request.body or '{}')
    try:
        out = sdn_repo.aplicar_deduccion_masiva(
            no_cia=data['no_cia'],
            punto=_norm_punto(data['punto']),
            nomina=(data['nomina'] or '').upper(),
            ano=int(data['ano']),
            mes=int(data['mes']),
            periodo=int(data.get('periodo', 1)),
            no_deduccion=(data['no_deduccion'] or '').upper(),
            empleados_ids=data.get('empleados_ids') or None,
            usuario=request.user.username,
            dry_run=bool(data.get('dry_run', False)),
        )
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse(out, status=200 if out.get('dry_run') else 201)


@login_required
@csrf_exempt
@require_http_methods(['DELETE', 'POST'])
def sdn_movimientos_eliminar(request):
    data = json.loads(request.body or '{}')
    try:
        sdn_repo.eliminar_movimiento_manual(
            no_cia=data['no_cia'],
            punto=_norm_punto(data['punto']),
            nomina=(data['nomina'] or '').upper(),
            ano=int(data['ano']),
            mes=int(data['mes']),
            periodo=int(data.get('periodo', 1)),
            no_empleado=int(data['no_empleado']),
            linea=int(data['linea']),
        )
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse({'ok': True})


# --- Generar Vacaciones (Fsdn401) --------------------------------------------

@login_required
@csrf_exempt
@require_http_methods(['POST'])
def sdn_generar_vacaciones(request):
    data = json.loads(request.body or '{}')
    try:
        out = sdn_repo.generar_vacaciones(
            no_cia=data['no_cia'],
            punto=_norm_punto(data['punto']),
            nomina=(data['nomina'] or '').upper(),
            ano=int(data['ano']),
            usuario=request.user.username,
            dry_run=bool(data.get('dry_run', False)),
        )
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse(out)


# --- Generar Solicitud de Cheques (Fsdn409) ----------------------------------

@login_required
@csrf_exempt
@require_http_methods(['GET'])
def sdn_preview_cheques(request):
    try:
        out = sdn_repo.preview_solicitud_cheques(
            no_cia=request.GET.get('no_cia', ''),
            punto=_norm_punto(request.GET.get('punto', '01')),
            nomina=(request.GET.get('nomina') or '').upper(),
        )
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse(out)


# --- Informe de Nómina (Fsdn207) ---------------------------------------------

@login_required
@csrf_exempt
@require_http_methods(['GET'])
def sdn_rep_informe(request):
    try:
        out = sdn_repo.rep_informe_nomina(
            no_cia=request.GET.get('no_cia', ''),
            punto=_norm_punto(request.GET.get('punto', '01')),
            nomina=(request.GET.get('nomina') or '').upper(),
            ano=int(request.GET.get('ano', 0)),
            mes=int(request.GET.get('mes', 0)),
            periodo=int(request.GET.get('periodo', 1)),
            no_empleado=int(request.GET.get('no_empleado', 0)) or None,
            no_gerencia=request.GET.get('no_gerencia') or None,
            no_area=request.GET.get('no_area') or None,
            no_depto=request.GET.get('no_depto') or None,
        )
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse(out)


# --- RNC Empleados (DGII) ----------------------------------------------------

@login_required
@csrf_exempt
@require_http_methods(['GET'])
def sdn_rep_empleados_rnc(request):
    rows = sdn_repo.rep_empleados_rnc(
        no_cia=request.GET.get('no_cia', ''),
        punto=_norm_punto(request.GET.get('punto', '')) or None,
        activos=request.GET.get('activos', '1') in ('1', 'true', 'S'),
        search=request.GET.get('search', ''),
    )
    return JsonResponse(rows, safe=False)


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
