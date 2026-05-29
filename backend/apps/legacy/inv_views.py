"""Inventario (INV) — vistas legacy.

Usa fetch_dicts / fetch_one del cliente Oracle directo.
No usa Django ORM ni DRF serializers.
"""
from __future__ import annotations

import decimal
import datetime
import io
import json

from django.http import JsonResponse, HttpResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
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


@login_required
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


@login_required
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


@login_required
@csrf_exempt
@require_http_methods(["GET", "POST"])
def inv_grupos(request):
    """GET /api/inv/grupos/?no_cia=01 -> lista. POST -> crea (PK no_grupo)."""
    if request.method == 'POST':
        try:
            d = _body(request)
            no_grupo = str(d.get('grupo_produ', '') or d.get('no_grupo', '') or '').strip()
            descripcion = str(d.get('descripcion', '') or '').strip()
            if not no_grupo:
                return JsonResponse({"error": "El codigo de grupo es requerido"}, status=400)
            if inv_repo.get_grupo(no_grupo):
                return JsonResponse({"error": f"El grupo {no_grupo} ya existe"}, status=400)
            inv_repo.create_grupo(no_grupo, descripcion)
            return JsonResponse({"ok": True, "grupo_produ": no_grupo}, status=201)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)
    try:
        no_cia = request.GET.get('no_cia', '01')
        results = inv_repo.list_grupos(no_cia=no_cia)
        return JsonResponse({
            "results": _jsonify(results),
            "count": len(results),
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
@csrf_exempt
@require_http_methods(["GET", "POST"])
def inv_lineas(request):
    """GET /api/inv/lineas/?no_cia=01 -> lista. POST -> crea (PK linea)."""
    if request.method == 'POST':
        try:
            d = _body(request)
            linea = str(d.get('linea', '') or '').strip()
            descripcion = str(d.get('descripcion', '') or '').strip()
            if not linea:
                return JsonResponse({"error": "El codigo de linea es requerido"}, status=400)
            if inv_repo.get_linea(linea):
                return JsonResponse({"error": f"La linea {linea} ya existe"}, status=400)
            inv_repo.create_linea(linea, descripcion)
            return JsonResponse({"ok": True, "linea": linea}, status=201)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)
    try:
        no_cia = request.GET.get('no_cia', '01')
        results = inv_repo.list_lineas(no_cia=no_cia)
        return JsonResponse({
            "results": _jsonify(results),
            "count": len(results),
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
@require_http_methods(["GET"])
def inv_existencias(request):
    """GET /api/inv/existencia/?no_cia=01&punto=&almacen=&no_produ=&grupo=&search=&solo_con_existencia="""
    try:
        no_cia = request.GET.get('no_cia', '01')
        punto = request.GET.get('punto', '')
        almacen = request.GET.get('almacen', '')
        no_produ = request.GET.get('no_produ', '')
        search = request.GET.get('search', '')
        grupo = request.GET.get('grupo', '')
        solo_con_existencia = request.GET.get('solo_con_existencia', '').lower() in {'1','true','yes','y','s'}
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 50))

        results = inv_repo.list_existencias(
            no_cia=no_cia,
            punto=punto,
            almacen=almacen,
            no_produ=no_produ,
            search=search,
            grupo=grupo,
            solo_con_existencia=solo_con_existencia,
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


@login_required
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


def _body(request) -> dict:
    """Parsea el cuerpo JSON de la petición (POST/PATCH/DELETE)."""
    if not request.body:
        return {}
    try:
        data = json.loads(request.body.decode('utf-8'))
        return data if isinstance(data, dict) else {}
    except (ValueError, UnicodeDecodeError):
        return {}


@login_required
@csrf_exempt
@require_http_methods(["GET", "POST"])
def inv_almacenes(request):
    """GET  /api/inv/almacenes/?no_cia=01   -> lista de almacenes
    POST /api/inv/almacenes/               -> crea almacen (PK no_cia + almacen)
    """
    if request.method == 'POST':
        try:
            d = _body(request)
            no_cia = str(d.get('no_cia', '') or '').strip()
            punto = str(d.get('punto', '') or '').strip()
            almacen = str(d.get('almacen', '') or '').strip()
            descripcion = str(d.get('descripcion', '') or '').strip()
            if not no_cia or not punto or not almacen or not descripcion:
                return JsonResponse(
                    {"error": "no_cia, punto, almacen y descripcion son requeridos"}, status=400)
            if inv_repo.get_almacen(no_cia, punto, almacen):
                return JsonResponse(
                    {"error": f"El almacen {almacen} ya existe en el punto {punto}"}, status=400)
            inv_repo.create_almacen(
                no_cia,
                punto,
                almacen,
                descripcion,
                tipo_almacen=str(d.get('tipo_almacen', 'F') or 'F').strip(),
                cual_costo=str(d.get('cual_costo', 'P') or 'P').strip(),
                activo=str(d.get('activo', 'S') or 'S').strip(),
            )
            return JsonResponse(
                {"ok": True, "no_cia": no_cia, "punto": punto, "almacen": almacen}, status=201)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

    # GET
    try:
        no_cia = request.GET.get('no_cia', '01')
        punto = request.GET.get('punto', '') or None
        results = inv_repo.list_almacenes(no_cia=no_cia, punto=punto)
        return JsonResponse({
            "results": _jsonify(results),
            "count": len(results),
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
@csrf_exempt
@require_http_methods(["GET", "PATCH", "DELETE"])
def inv_almacen_detail(request, almacen: str):
    """GET/PATCH/DELETE /api/inv/almacenes/<almacen>/?no_cia=01&punto=01
    La PK es (no_cia, punto, almacen); no_cia y punto vienen de query params o del body.
    """
    body = _body(request)
    no_cia = request.GET.get('no_cia', '') or str(body.get('no_cia', '') or '').strip()
    punto = request.GET.get('punto', '') or str(body.get('punto', '') or '').strip()
    if not no_cia or not punto:
        return JsonResponse({"error": "no_cia y punto son requeridos"}, status=400)

    existing = inv_repo.get_almacen(no_cia, punto, almacen)
    if not existing:
        return JsonResponse({"error": "Almacen no encontrado"}, status=404)

    if request.method == 'GET':
        return JsonResponse({"data": _jsonify(existing)})

    if request.method == 'PATCH':
        try:
            payload = {k: v for k, v in body.items() if k not in ('no_cia', 'punto', 'almacen')}
            inv_repo.update_almacen(no_cia, punto, almacen, **payload)
            return JsonResponse({"ok": True})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

    # DELETE
    try:
        inv_repo.delete_almacen(no_cia, punto, almacen)
        return JsonResponse({"ok": True})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@login_required
@csrf_exempt
@require_http_methods(["GET", "POST"])
def inv_tipos_docu(request):
    """GET /api/inv/tipos-docu/ -> lista. POST -> crea (PK tipo_docu)."""
    if request.method == 'POST':
        try:
            d = _body(request)
            tipo_docu = str(d.get('tipo_docu', '') or '').strip()
            descripcion = str(d.get('descripcion', '') or '').strip()
            if not tipo_docu or not descripcion:
                return JsonResponse(
                    {"error": "tipo_docu y descripcion son requeridos"}, status=400)
            if inv_repo.get_tdocu(tipo_docu):
                return JsonResponse(
                    {"error": f"El tipo de documento {tipo_docu} ya existe"}, status=400)
            inv_repo.create_tdocu(
                tipo_docu, descripcion,
                tipo_movi=str(d.get('tipo_movi', 'E') or 'E').strip(),
                tipo_transaccion=str(d.get('tipo_transaccion', 'E') or 'E').strip(),
                nc_obligatoria=str(d.get('nc_obligatoria', 'N') or 'N').strip(),
            )
            return JsonResponse({"ok": True, "tipo_docu": tipo_docu}, status=201)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)
    try:
        results = inv_repo.list_tipos_docu_inv()
        return JsonResponse({
            "results": _jsonify(results),
            "count": len(results),
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


# ─── NEW VIEWS ────────────────────────────────────────────────────────────────

@login_required
@csrf_exempt
@require_http_methods(["GET", "POST"])
def inv_companias(request):
    """GET /api/inv/companias/  -> lista. POST -> crea (PK no_cia)."""
    if request.method == 'POST':
        try:
            d = _body(request)
            no_cia = str(d.get('no_cia', '') or '').strip()
            descripcion = str(d.get('descripcion', '') or '').strip()
            if not no_cia or not descripcion:
                return JsonResponse({"error": "no_cia y descripcion son requeridos"}, status=400)
            if inv_repo.get_compania(no_cia):
                return JsonResponse({"error": f"La compania {no_cia} ya existe"}, status=400)
            inv_repo.create_compania(
                no_cia, descripcion,
                activo=str(d.get('activo', 'S') or 'S').strip(),
                registro_cont=str(d.get('registro_cont', 'S') or 'S').strip(),
            )
            return JsonResponse({"ok": True, "no_cia": no_cia}, status=201)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)
    try:
        results = inv_repo.list_companias()
        return JsonResponse({"results": _jsonify(results), "count": len(results)})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
@csrf_exempt
@require_http_methods(["GET", "PATCH", "DELETE"])
def inv_compania_detail(request, no_cia: str):
    """GET/PATCH/DELETE /api/inv/companias/<no_cia>/ — PK (no_cia)."""
    existing = inv_repo.get_compania(no_cia)
    if not existing:
        return JsonResponse({"error": "Compania no encontrada"}, status=404)
    if request.method == 'GET':
        return JsonResponse({"data": _jsonify(existing)})
    if request.method == 'PATCH':
        try:
            body = _body(request)
            payload = {k: v for k, v in body.items() if k != 'no_cia'}
            inv_repo.update_compania(no_cia, **payload)
            return JsonResponse({"ok": True})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)
    try:
        inv_repo.delete_compania(no_cia)
        return JsonResponse({"ok": True})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@login_required
@csrf_exempt
@require_http_methods(["GET", "POST"])
def inv_puntos(request):
    """GET /api/inv/puntos/?no_cia=01 -> lista. POST -> crea (PK no_cia, punto)."""
    if request.method == 'POST':
        try:
            d = _body(request)
            no_cia = str(d.get('no_cia', '') or '').strip()
            punto = str(d.get('punto', '') or '').strip()
            descripcion = str(d.get('descripcion', '') or '').strip()
            if not no_cia or not punto or not descripcion:
                return JsonResponse(
                    {"error": "no_cia, punto y descripcion son requeridos"}, status=400)
            if inv_repo.get_punto(no_cia, punto):
                return JsonResponse(
                    {"error": f"El punto {punto} ya existe en la cia {no_cia}"}, status=400)
            inv_repo.create_punto(
                no_cia, punto, descripcion,
                ano_proceso=int(d.get('ano_proceso') or 0),
                mes_proceso=int(d.get('mes_proceso') or 0),
                mes_cierre=int(d.get('mes_cierre') or 12),
                activo=str(d.get('activo', 'S') or 'S').strip(),
            )
            return JsonResponse({"ok": True, "no_cia": no_cia, "punto": punto}, status=201)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)
    try:
        no_cia = request.GET.get('no_cia', '01')
        results = inv_repo.list_puntos(no_cia=no_cia)
        return JsonResponse({"results": _jsonify(results), "count": len(results)})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
@csrf_exempt
@require_http_methods(["GET", "PATCH", "DELETE"])
def inv_punto_detail(request, punto: str):
    """GET/PATCH/DELETE /api/inv/puntos/<punto>/?no_cia=01 — PK (no_cia, punto)."""
    body = _body(request)
    no_cia = request.GET.get('no_cia', '') or str(body.get('no_cia', '') or '').strip()
    if not no_cia:
        return JsonResponse({"error": "no_cia es requerido"}, status=400)
    existing = inv_repo.get_punto(no_cia, punto)
    if not existing:
        return JsonResponse({"error": "Punto no encontrado"}, status=404)
    if request.method == 'GET':
        return JsonResponse({"data": _jsonify(existing)})
    if request.method == 'PATCH':
        try:
            payload = {k: v for k, v in body.items() if k not in ('no_cia', 'punto')}
            inv_repo.update_punto(no_cia, punto, **payload)
            return JsonResponse({"ok": True})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)
    try:
        inv_repo.delete_punto(no_cia, punto)
        return JsonResponse({"ok": True})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@login_required
@csrf_exempt
@require_http_methods(["GET", "POST"])
def inv_unidades(request):
    """GET /api/inv/unidades/ -> lista. POST -> crea (PK unidad)."""
    if request.method == 'POST':
        try:
            d = _body(request)
            unidad = str(d.get('unidad', '') or d.get('cod_unidad', '') or '').strip()
            descripcion = str(d.get('descripcion', '') or '').strip()
            if not unidad:
                return JsonResponse({"error": "unidad es requerida"}, status=400)
            if inv_repo.get_unidad(unidad):
                return JsonResponse({"error": f"La unidad {unidad} ya existe"}, status=400)
            inv_repo.create_unidad(unidad, descripcion)
            return JsonResponse({"ok": True, "unidad": unidad}, status=201)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)
    try:
        results = inv_repo.list_unidades()
        return JsonResponse({"results": _jsonify(results), "count": len(results)})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
@csrf_exempt
@require_http_methods(["GET", "PATCH", "DELETE"])
def inv_unidad_detail(request, unidad: str):
    """GET/PATCH/DELETE /api/inv/unidades/<unidad>/ — PK (unidad)."""
    existing = inv_repo.get_unidad(unidad)
    if not existing:
        return JsonResponse({"error": "Unidad no encontrada"}, status=404)
    if request.method == 'GET':
        return JsonResponse({"data": _jsonify(existing)})
    if request.method == 'PATCH':
        try:
            body = _body(request)
            descripcion = str(body.get('descripcion', '') or '').strip()
            inv_repo.update_unidad(unidad, descripcion)
            return JsonResponse({"ok": True})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)
    try:
        inv_repo.delete_unidad(unidad)
        return JsonResponse({"ok": True})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@login_required
@csrf_exempt
@require_http_methods(["GET", "POST"])
def inv_sublineas(request):
    """GET /api/inv/sublineas/?linea=0001 -> lista. POST -> crea (PK linea, sub_linea)."""
    if request.method == 'POST':
        try:
            d = _body(request)
            linea = str(d.get('linea', '') or '').strip()
            sub_linea = str(d.get('sub_linea', '') or '').strip()
            descripcion = str(d.get('descripcion', '') or '').strip()
            if not linea or not sub_linea:
                return JsonResponse({"error": "linea y sub_linea son requeridos"}, status=400)
            if inv_repo.get_sublinea(linea, sub_linea):
                return JsonResponse(
                    {"error": f"La sub-linea {sub_linea} ya existe en la linea {linea}"}, status=400)
            inv_repo.create_sublinea(
                linea, sub_linea, descripcion,
                pct_comision=d.get('pct_comision'),
                pct_margen=d.get('pct_margen'),
            )
            return JsonResponse({"ok": True, "linea": linea, "sub_linea": sub_linea}, status=201)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)
    try:
        no_cia = request.GET.get('no_cia', '01')
        linea = request.GET.get('linea', '')
        results = inv_repo.list_sublineas(no_cia=no_cia, linea=linea)
        return JsonResponse({"results": _jsonify(results), "count": len(results)})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
@csrf_exempt
@require_http_methods(["GET", "PATCH", "DELETE"])
def inv_sublinea_detail(request, sub_linea: str):
    """GET/PATCH/DELETE /api/inv/sublineas/<sub_linea>/?linea=0001 — PK (linea, sub_linea)."""
    body = _body(request)
    linea = request.GET.get('linea', '') or str(body.get('linea', '') or '').strip()
    if not linea:
        return JsonResponse({"error": "linea es requerida"}, status=400)
    existing = inv_repo.get_sublinea(linea, sub_linea)
    if not existing:
        return JsonResponse({"error": "Sub-linea no encontrada"}, status=404)
    if request.method == 'GET':
        return JsonResponse({"data": _jsonify(existing)})
    if request.method == 'PATCH':
        try:
            payload = {k: v for k, v in body.items() if k not in ('linea', 'sub_linea')}
            inv_repo.update_sublinea(linea, sub_linea, **payload)
            return JsonResponse({"ok": True})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)
    try:
        inv_repo.delete_sublinea(linea, sub_linea)
        return JsonResponse({"ok": True})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


# ─── GRUPOS / LÍNEAS / REFERENCIA / GRUPO CONTABLE / TIPOS DOC — CRUD ──────────

@login_required
@csrf_exempt
@require_http_methods(["GET", "PATCH", "DELETE"])
def inv_grupo_detail(request, no_grupo: str):
    """GET/PATCH/DELETE /api/inv/grupos/<no_grupo>/ — PK (no_grupo)."""
    existing = inv_repo.get_grupo(no_grupo)
    if not existing:
        return JsonResponse({"error": "Grupo no encontrado"}, status=404)
    if request.method == 'GET':
        return JsonResponse({"data": _jsonify(existing)})
    if request.method == 'PATCH':
        try:
            body = _body(request)
            descripcion = str(body.get('descripcion', '') or '').strip()
            inv_repo.update_grupo(no_grupo, descripcion)
            return JsonResponse({"ok": True})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)
    try:
        inv_repo.delete_grupo(no_grupo)
        return JsonResponse({"ok": True})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@login_required
@csrf_exempt
@require_http_methods(["GET", "PATCH", "DELETE"])
def inv_linea_detail(request, linea: str):
    """GET/PATCH/DELETE /api/inv/lineas/<linea>/ — PK (linea)."""
    existing = inv_repo.get_linea(linea)
    if not existing:
        return JsonResponse({"error": "Linea no encontrada"}, status=404)
    if request.method == 'GET':
        return JsonResponse({"data": _jsonify(existing)})
    if request.method == 'PATCH':
        try:
            body = _body(request)
            descripcion = str(body.get('descripcion', '') or '').strip()
            inv_repo.update_linea(linea, descripcion)
            return JsonResponse({"ok": True})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)
    try:
        inv_repo.delete_linea(linea)
        return JsonResponse({"ok": True})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@login_required
@csrf_exempt
@require_http_methods(["GET", "POST"])
def inv_referencias(request):
    """GET /api/inv/referencias-empaque/ -> lista. POST -> crea (PK referencia)."""
    if request.method == 'POST':
        try:
            d = _body(request)
            referencia = str(d.get('referencia', '') or d.get('cod_referencia', '') or '').strip()
            descripcion = str(d.get('descripcion', '') or '').strip()
            if not referencia:
                return JsonResponse({"error": "referencia es requerida"}, status=400)
            if inv_repo.get_referencia(referencia):
                return JsonResponse({"error": f"La referencia {referencia} ya existe"}, status=400)
            inv_repo.create_referencia(referencia, descripcion)
            return JsonResponse({"ok": True, "referencia": referencia}, status=201)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)
    try:
        results = inv_repo.list_referencias()
        return JsonResponse({"results": _jsonify(results), "count": len(results)})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
@csrf_exempt
@require_http_methods(["GET", "PATCH", "DELETE"])
def inv_referencia_detail(request, referencia: str):
    """GET/PATCH/DELETE /api/inv/referencias-empaque/<referencia>/ — PK (referencia)."""
    existing = inv_repo.get_referencia(referencia)
    if not existing:
        return JsonResponse({"error": "Referencia no encontrada"}, status=404)
    if request.method == 'GET':
        return JsonResponse({"data": _jsonify(existing)})
    if request.method == 'PATCH':
        try:
            body = _body(request)
            descripcion = str(body.get('descripcion', '') or '').strip()
            inv_repo.update_referencia(referencia, descripcion)
            return JsonResponse({"ok": True})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)
    try:
        inv_repo.delete_referencia(referencia)
        return JsonResponse({"ok": True})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@login_required
@csrf_exempt
@require_http_methods(["GET", "POST"])
def inv_grupos_contables(request):
    """GET /api/inv/grupos-contables/ -> lista. POST -> crea (PK grupo_contable)."""
    if request.method == 'POST':
        try:
            d = _body(request)
            grupo = str(d.get('grupo_contable', '') or '').strip()
            descripcion = str(d.get('descripcion', '') or '').strip()
            if not grupo:
                return JsonResponse({"error": "grupo_contable es requerido"}, status=400)
            if inv_repo.get_grupo_contable(grupo):
                return JsonResponse({"error": f"El grupo contable {grupo} ya existe"}, status=400)
            inv_repo.create_grupo_contable(
                grupo, descripcion,
                inventario=(d.get('inventario') or None),
                ajuste_inventario=(d.get('ajuste_inventario') or None),
                costo_venta_contado=(d.get('costo_venta_contado') or None),
                costo_venta_credito=(d.get('costo_venta_credito') or None),
                ingreso_venta_contado=(d.get('ingreso_venta_contado') or None),
                ingreso_venta_credito=(d.get('ingreso_venta_credito') or None),
            )
            return JsonResponse({"ok": True, "grupo_contable": grupo}, status=201)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)
    try:
        results = inv_repo.list_grupos_contables()
        return JsonResponse({"results": _jsonify(results), "count": len(results)})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
@csrf_exempt
@require_http_methods(["GET", "PATCH", "DELETE"])
def inv_grupo_contable_detail(request, grupo_contable: str):
    """GET/PATCH/DELETE /api/inv/grupos-contables/<grupo_contable>/ — PK (grupo_contable)."""
    existing = inv_repo.get_grupo_contable(grupo_contable)
    if not existing:
        return JsonResponse({"error": "Grupo contable no encontrado"}, status=404)
    if request.method == 'GET':
        return JsonResponse({"data": _jsonify(existing)})
    if request.method == 'PATCH':
        try:
            body = _body(request)
            payload = {k: v for k, v in body.items() if k != 'grupo_contable'}
            inv_repo.update_grupo_contable(grupo_contable, **payload)
            return JsonResponse({"ok": True})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)
    try:
        inv_repo.delete_grupo_contable(grupo_contable)
        return JsonResponse({"ok": True})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@login_required
@csrf_exempt
@require_http_methods(["GET", "PATCH", "DELETE"])
def inv_tdocu_detail(request, tipo_docu: str):
    """GET/PATCH/DELETE /api/inv/tipos-docu/<tipo_docu>/ — PK (tipo_docu)."""
    existing = inv_repo.get_tdocu(tipo_docu)
    if not existing:
        return JsonResponse({"error": "Tipo de documento no encontrado"}, status=404)
    if request.method == 'GET':
        return JsonResponse({"data": _jsonify(existing)})
    if request.method == 'PATCH':
        try:
            body = _body(request)
            payload = {k: v for k, v in body.items() if k != 'tipo_docu'}
            inv_repo.update_tdocu(tipo_docu, **payload)
            return JsonResponse({"ok": True})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)
    try:
        inv_repo.delete_tdocu(tipo_docu)
        return JsonResponse({"ok": True})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@login_required
@require_http_methods(["GET"])
def inv_existencia_producto(request, no_produ: str):
    """GET /api/inv/existencia/<no_produ>/?no_cia=01"""
    try:
        no_cia = request.GET.get('no_cia', '01')
        results = inv_repo.get_existencia_producto(no_cia=no_cia, no_produ=no_produ)
        return JsonResponse({"results": _jsonify(results), "count": len(results)})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
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


@login_required
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


@login_required
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
        from reportlab.lib.pagesizes import letter
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


@login_required
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


@login_required
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
    from reportlab.lib.pagesizes import letter, landscape
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
                val = r.get(c.lower(), r.get(c.upper(), ''))
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


@login_required
@require_http_methods(["GET"])
def inv_reporte_existencia_pdf(request):
    """GET /api/inv/reportes/existencia/pdf/?no_cia=01&almacen="""
    try:
        from reportlab.lib.pagesizes import letter  # noqa: probe import
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


@login_required
@require_http_methods(["GET"])
def inv_reporte_movimientos_pdf(request):
    """GET /api/inv/reportes/movimientos/pdf/?no_cia=01&desde=&hasta=&tipo_docu="""
    try:
        from reportlab.lib.pagesizes import letter  # noqa: probe import
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


@login_required
@require_http_methods(["GET"])
def inv_reporte_kardex_pdf(request):
    """GET /api/inv/reportes/kardex/pdf/?no_cia=01&no_produ=X&almacen=&desde=&hasta="""
    try:
        from reportlab.lib.pagesizes import letter  # noqa: probe import
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


@login_required
@require_http_methods(["GET"])
def inv_reporte_valorizacion_pdf(request):
    """GET /api/inv/reportes/valorizacion/pdf/?no_cia=01&almacen="""
    try:
        from reportlab.lib.pagesizes import letter  # noqa: probe import
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


@login_required
@require_http_methods(["GET"])
def inv_cierre_entrada_diario_pdf(request):
    """GET /api/inv/cierre/entrada-diario/pdf/?no_cia=01&punto=01&mes=05&ano=2026&tipo=detallado&fecha="""
    try:
        from reportlab.lib.pagesizes import letter  # noqa: probe import
    except ImportError:
        return JsonResponse({"error": "reportlab no instalado"}, status=500)
    try:
        no_cia = request.GET.get('no_cia', '01')
        punto = request.GET.get('punto', '')
        mes = request.GET.get('mes', '')
        ano = request.GET.get('ano', '')
        tipo = request.GET.get('tipo', 'detallado')
        fecha = request.GET.get('fecha', '')
        if not mes or not ano:
            return JsonResponse({"error": "Parametros mes y ano requeridos"}, status=400)
        rows = inv_repo.list_entrada_diario(
            no_cia=no_cia, punto=punto, ano=ano, mes=mes,
            fecha=fecha, tipo=tipo,
        )
        # Detectar si vienen de TINV_ED (tiene campo 'cuenta') o de TINV_MOVIMIENTO
        if rows and 'cuenta' in rows[0]:
            cols = ['FECHA', 'TIPO_DOCU', 'NO_DOCU', 'CUENTA', 'TIPO_MOVI',
                    'CENTRO_COSTO', 'MONTO']
        else:
            cols = ['FECHA', 'TIPO_DOCU', 'NO_DOCU', 'ALMACEN', 'NO_PRODU',
                    'TIPO_MOVI', 'CANTIDAD', 'COSTO', 'MONTO']
        titulo = f"Entrada de Diario {'Detallado' if tipo == 'detallado' else 'Resumido'} — {mes}/{ano} — Cia {no_cia}"
        pdf = _build_pdf_report(titulo, cols, rows)
        resp = HttpResponse(pdf, content_type='application/pdf')
        resp['Content-Disposition'] = f'inline; filename="INV_EntradaDiario_{no_cia}_{ano}{mes}.pdf"'
        return resp
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


# =============================================================================
# Conteo Físico — FINV705
# =============================================================================

@login_required
@require_http_methods(["GET"])
def inv_conteo_fisico_pendiente(request):
    """GET /api/inv/conteo-fisico/pendiente/?no_cia=01&punto=&almacen=&no_produ=
    Devuelve el comparativo de filas pendientes contra exist_actual del libro.
    """
    try:
        no_cia = request.GET.get('no_cia', '01')
        punto = request.GET.get('punto', '')
        almacen = request.GET.get('almacen', '')
        no_produ = request.GET.get('no_produ', '')
        rows = inv_repo.comparativo_conteo_fisico(no_cia, punto, almacen, no_produ)
        return JsonResponse({"results": rows, "count": len(rows)})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def inv_conteo_fisico_cargar(request):
    """POST /api/inv/conteo-fisico/cargar/
    body: { rows: [ { no_cia, punto, almacen, no_produ, conteo_fisico_uni,
                       conteo_fisico_cjs?, contador?, empaque?, cpe? }, ... ] }
    """
    try:
        body = json.loads(request.body or b'{}')
        rows = body.get('rows') or []
        usuario = request.user.username if request.user.is_authenticated else 'API'
        result = inv_repo.cargar_conteo_fisico(rows, usuario)
        return JsonResponse(result)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def inv_conteo_fisico_aplicar(request):
    """POST /api/inv/conteo-fisico/aplicar/
    body: { no_cia, punto, almacen?, no_produ? }
    Aplica TODOS los pendientes (o filtrado a un almacen/produ). Devuelve el
    resumen { procesados, entradas_generadas, salidas_generadas, sin_cambio, errores }.
    """
    try:
        body = json.loads(request.body or b'{}')
        no_cia = body.get('no_cia') or '01'
        punto = body.get('punto') or '01'
        almacen = body.get('almacen') or ''
        no_produ = body.get('no_produ') or ''
        usuario = request.user.username if request.user.is_authenticated else 'API'
        result = inv_repo.aplicar_conteo_fisico(no_cia, punto, usuario, almacen, no_produ)
        return JsonResponse(result)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@login_required
@require_http_methods(["DELETE"])
def inv_conteo_fisico_descartar(request):
    """DELETE /api/inv/conteo-fisico/descartar/?no_cia&punto&almacen&no_produ
    Borra una fila pendiente sin aplicar ajuste. Útil para corregir cargas malas.
    """
    try:
        no_cia = request.GET.get('no_cia', '')
        punto = request.GET.get('punto', '')
        almacen = request.GET.get('almacen', '')
        no_produ = request.GET.get('no_produ', '')
        if not (no_cia and punto and almacen and no_produ):
            return JsonResponse({"error": "Faltan parametros"}, status=400)
        from apps.legacy import client as _c
        with _c.connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "DELETE FROM INV.TINV_CONTEO_FISICO "
                "WHERE no_cia=:1 AND punto=:2 AND almacen=:3 AND no_produ=:4",
                [no_cia, punto, almacen, no_produ.upper()],
            )
            n = cur.rowcount
            conn.commit()
        return JsonResponse({"deleted": n})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
@require_http_methods(["GET"])
def inv_conteo_fisico_historico(request):
    """GET /api/inv/conteo-fisico/historico/?no_cia&no_produ?&almacen?&desde?&hasta?&page&page_size"""
    try:
        no_cia = request.GET.get('no_cia', '01')
        no_produ = request.GET.get('no_produ', '')
        almacen = request.GET.get('almacen', '')
        desde = request.GET.get('desde', '')
        hasta = request.GET.get('hasta', '')
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 50))
        result = inv_repo.historico_conteo_fisico(
            no_cia, no_produ=no_produ, almacen=almacen,
            desde=desde, hasta=hasta, page=page, page_size=page_size)
        return JsonResponse(result)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
