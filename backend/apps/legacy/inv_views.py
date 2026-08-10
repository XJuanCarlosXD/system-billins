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

from apps.legacy.repositories import inv_repo, permissions_repo


def _check_inv_access(username: str, no_cia: str) -> JsonResponse | None:
    """Guard: el user tiene fila activa en INV.TINV_USUARIO para esa empresa.

    Devuelve JsonResponse 403 si no tiene acceso, None si OK.
    """
    if not username:
        return JsonResponse({'error': 'auth requerida'}, status=401)
    try:
        rows = permissions_repo.client.fetch_dicts(
            "SELECT NVL(activo,'N') activo FROM INV.TINV_USUARIO "
            "WHERE UPPER(usuario) = UPPER(:1) AND no_cia = :2 "
            "AND NVL(activo,'N') = 'S' AND ROWNUM <= 1",
            [username, no_cia],
        )
        if not rows:
            return JsonResponse(
                {'error': f'sin acceso a INV en empresa {no_cia}'}, status=403
            )
    except Exception:
        # Si hay error de Oracle no bloqueamos para no romper en dev
        return None
    return None


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
@csrf_exempt
@require_http_methods(["GET", "PUT", "POST"])
def inv_producto_empaques(request, no_produ: str):
    """GET /api/inv/productos/<no_produ>/empaques-mant/  -> lista
    PUT/POST /api/inv/productos/<no_produ>/empaques-mant/ {empaques:[...]}  -> replace all
    """
    if request.method == "GET":
        try:
            return JsonResponse({"items": _jsonify(inv_repo.list_empaques_producto(no_produ))})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    try:
        payload = json.loads(request.body.decode('utf-8') or '{}')
    except Exception:
        return JsonResponse({"error": "JSON invalido"}, status=400)
    try:
        empaques = payload.get('empaques') if isinstance(payload, dict) else payload
        res = inv_repo.save_empaques_producto(no_produ, empaques or [])
        return JsonResponse({"data": _jsonify(res)})
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
@csrf_exempt
@require_http_methods(["POST"])
def inv_asignar_producto_almacen(request):
    """POST /api/inv/asignar-producto-almacen/ — asigna productos existentes
    a un almacen de una cia/punto (crea sus filas en INV.TINV_EPRODUCTO).

    Body JSON: {no_cia, punto, almacen, productos: [no_produ, ...]}
    """
    try:
        payload = json.loads(request.body.decode('utf-8') or '{}')
    except Exception:
        return JsonResponse({"error": "JSON invalido"}, status=400)
    try:
        res = inv_repo.asignar_producto_almacen(
            no_cia=str(payload.get('no_cia', '')).strip(),
            punto=str(payload.get('punto', '')).strip(),
            almacen=str(payload.get('almacen', '')).strip(),
            productos=payload.get('productos') or [],
            usuario=getattr(request.user, 'username', '') or 'API',
        )
        return JsonResponse({"data": res}, status=201)
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
@require_http_methods(["GET"])
def inv_producto_asignaciones(request, no_produ: str):
    """GET /api/inv/productos/<no_produ>/asignaciones/ — empresas/almacenes
    donde el producto ya tiene fila en TINV_EPRODUCTO."""
    try:
        return JsonResponse({"results": _jsonify(inv_repo.list_asignaciones_producto(no_produ))})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
@require_http_methods(["GET"])
def inv_producto_next_codigo(request):
    """GET /api/inv/productos/next-codigo/ — preview del siguiente no_produ."""
    try:
        return JsonResponse({"siguiente": inv_repo.peek_next_producto()})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
@csrf_exempt
@require_http_methods(["GET", "POST"])
def inv_productos(request):
    """GET /api/inv/productos/?no_cia=01&search=&grupo=&linea=&limit=50&offset=0

    POST /api/inv/productos/ — crear producto. Body JSON:
      {no_produ, descripcion, linea, sub_linea, grupo_produ, grupo_contable,
       tiene_impuesto?, porciento_impuesto?, costo?, servicio?, activo?}
    """
    if request.method == 'POST':
        try:
            payload = json.loads(request.body.decode('utf-8') or '{}')
        except Exception:
            return JsonResponse({"error": "JSON invalido"}, status=400)
        try:
            res = inv_repo.create_producto(payload=payload,
                                            usuario=getattr(request.user, 'username', '') or 'API')
            return JsonResponse({"data": _jsonify(res)}, status=201)
        except ValueError as e:
            return JsonResponse({"error": str(e)}, status=400)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    try:
        no_cia = request.GET.get('no_cia', '01')
        search = request.GET.get('search', '')
        grupo = request.GET.get('grupo', '')
        linea = request.GET.get('linea', '')
        almacen = request.GET.get('almacen', '')
        punto = request.GET.get('punto', '')
        # Pantalla "Asignar Prod. a Cia./Almacén" (Finv113): con almacen+punto
        # se listan productos activos con flag 'asignado' (existe fila en
        # TINV_EPRODUCTO para esa cia/punto/almacen).
        if almacen and punto:
            results = inv_repo.list_productos_para_almacen(
                no_cia=no_cia, punto=punto, almacen=almacen, search=search)
            return JsonResponse({"results": _jsonify(results), "count": len(results)})
        # acepta limit/offset directos o page/page_size
        if 'limit' in request.GET or 'offset' in request.GET:
            limit = int(request.GET.get('limit', 50))
            offset = int(request.GET.get('offset', 0))
            page = (offset // max(1, limit)) + 1
            page_size = limit
        else:
            page = int(request.GET.get('page', 1))
            page_size = int(request.GET.get('page_size', 50))
            offset = (page - 1) * page_size
            limit = page_size

        results = inv_repo.list_productos(
            search=search,
            grupo=grupo,
            linea=linea,
            no_cia=no_cia,
            limit=limit,
            offset=offset,
        )
        count = inv_repo.count_productos(search=search, grupo=grupo, linea=linea)
        return JsonResponse({
            "results": _jsonify(results),
            "count": count,
            "page": page,
            "page_size": page_size,
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
@csrf_exempt
@require_http_methods(["GET", "PATCH", "PUT"])
def inv_producto(request, no_produ: str):
    """GET    /api/inv/productos/<no_produ>/?no_cia=01
    PATCH  /api/inv/productos/<no_produ>/  body JSON con campos a modificar.
    """
    if request.method in ("PATCH", "PUT"):
        try:
            payload = json.loads(request.body.decode('utf-8') or '{}')
        except Exception:
            return JsonResponse({"error": "JSON invalido"}, status=400)
        try:
            res = inv_repo.update_producto(
                no_produ=no_produ,
                payload=payload,
                usuario=getattr(request.user, 'username', '') or 'API',
            )
            return JsonResponse({"data": _jsonify(res)})
        except ValueError as e:
            return JsonResponse({"error": str(e)}, status=400)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
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
        truthy = {'1','true','yes','y','s'}
        solo_con_existencia = request.GET.get('solo_con_existencia', '').lower() in truthy
        solo_sin_existencia = request.GET.get('solo_sin_existencia', '').lower() in truthy
        page = max(1, int(request.GET.get('page', 1)))
        page_size = max(1, min(500, int(request.GET.get('page_size', 50))))

        results = inv_repo.list_existencias(
            no_cia=no_cia,
            punto=punto,
            almacen=almacen,
            no_produ=no_produ,
            search=search,
            grupo=grupo,
            solo_con_existencia=solo_con_existencia,
            solo_sin_existencia=solo_sin_existencia,
        )
        count = len(results)
        # Totales sobre el conjunto COMPLETO (no solo la página actual).
        total_existencia = 0.0
        total_valor = 0.0
        for r in results:
            try:
                total_existencia += float(r.get('existencia') or 0)
                total_valor += float(r.get('valor') or 0)
            except Exception:
                pass
        offset = (page - 1) * page_size
        page_results = results[offset: offset + page_size]
        return JsonResponse({
            "results": _jsonify(page_results),
            "count": count,
            "page": page,
            "page_size": page_size,
            "total_existencia": round(total_existencia, 2),
            "total_valor": round(total_valor, 2),
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
@require_http_methods(["GET", "POST"])
def inv_movimientos(request):
    """GET /api/inv/movimientos/?no_cia=01&almacen=&no_produ=&desde=&hasta=&tipo=

    POST /api/inv/movimientos/  -> crea documento de inventario (EA, SA, EC,
    DC, DV, EP, SP, TA, AE, AS). Body JSON:
        {no_cia, punto, tipo_docu, fecha, almacen, almacen_destino?,
         cuenta?, departamento?, no_cliente?, vendedor?, tipo_docu_devuelto?,
         no_docu_devuelto?, detalle:[{no_produ, almacen?, cantidad, costo?,
         precio?, descuento?, impuesto?, porciento_impuesto?}, ...]}
    """
    if request.method == 'POST':
        try:
            payload = json.loads(request.body.decode('utf-8') or '{}')
        except Exception:
            return JsonResponse({"error": "JSON invalido"}, status=400)
        try:
            res = inv_repo.create_movimiento_from_payload(
                payload, getattr(request.user, 'username', '') or 'API')
        except ValueError as e:
            return JsonResponse({"error": str(e)}, status=400)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
        return JsonResponse({"data": res}, status=201)

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
def inv_movimientos_producto(request, no_produ: str):
    """GET /api/inv/movimientos/<no_produ>/?no_cia=01&punto=&almacen=&desde=&hasta=

    Devuelve la lista de movimientos del producto con balance corrido,
    equivalente al reporte Rinv304 del legado.  Cantidades normalizadas al
    empaque para_reporte del producto (TINV_EMPAQUE.para_reporte='S').
    """
    try:
        no_cia = request.GET.get('no_cia', '01')
        punto = request.GET.get('punto', '')
        almacen = request.GET.get('almacen', '')
        desde = request.GET.get('desde', '')
        hasta = request.GET.get('hasta', '')
        data = inv_repo.get_movimientos_producto(
            no_cia=no_cia, no_produ=no_produ,
            punto=punto, almacen=almacen, desde=desde, hasta=hasta,
        )
        return JsonResponse(data)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


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
@require_http_methods(["POST"])
def inv_reversar_documento(request):
    """POST /api/inv/movimientos/reversar/

    Body JSON: {no_cia, punto, tipo_docu, no_docu, motivo?}
    Marca el documento como anulado y crea movimiento AF compensatorio.
    """
    try:
        payload = json.loads(request.body.decode('utf-8') or '{}')
    except Exception:
        return JsonResponse({"error": "JSON invalido"}, status=400)
    try:
        res = inv_repo.reversar_documento_inv(
            no_cia=str(payload.get('no_cia', '01')).strip(),
            punto=str(payload.get('punto', '01')).strip(),
            tipo_docu=str(payload.get('tipo_docu', '')).strip().upper(),
            no_docu=str(payload.get('no_docu', '')).strip(),
            motivo=str(payload.get('motivo', '')).strip(),
            usuario=getattr(request.user, 'username', '') or 'API',
        )
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"data": res})


@login_required
@require_http_methods(["POST"])
def inv_actualizar_documento(request):
    """POST /api/inv/movimientos/actualizar/

    Body JSON: mismo payload que POST /inv/movimientos/ + `no_docu_orig`
    (el documento a editar; el tipo se toma de `tipo_docu`).

    Edita una entrada de inventario (EC/EM/EA...) reversando la versión
    original y creando una versión nueva (con nuevo no_docu) a partir del
    payload editado, en un flujo que deja kardex, existencia, costo y —para
    EC— el espejo 606 consistentes. La Orden de Compra (ODC) NO pasa por aquí.
    """
    try:
        payload = json.loads(request.body.decode('utf-8') or '{}')
    except Exception:
        return JsonResponse({"error": "JSON invalido"}, status=400)
    try:
        res = inv_repo.actualizar_documento_inv(
            no_cia=str(payload.get('no_cia', '01')).strip(),
            punto=str(payload.get('punto', '01')).strip(),
            tipo_docu=str(payload.get('tipo_docu', '')).strip().upper(),
            no_docu=str(payload.get('no_docu_orig', '')).strip(),
            payload=payload,
            usuario=getattr(request.user, 'username', '') or 'API',
        )
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"data": res})


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


# =============================================================================
# Cierre Mensual (Finv402 + Finv403)
# =============================================================================

@login_required
@csrf_exempt
@require_http_methods(["GET", "POST"])
def inv_cierres(request):
    """GET /api/inv/cierres/?no_cia&punto  -> historico de cierres (TINV_CIERRE)"""
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    forbidden = _check_inv_access(request.user.username, no_cia)
    if forbidden:
        return forbidden
    try:
        return JsonResponse({"items": _jsonify(inv_repo.list_cierres(no_cia, punto))})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
@csrf_exempt
@require_http_methods(["POST"])
def inv_cierre_generar_asiento(request):
    """POST /api/inv/cierre/generar-asiento/
    body: { no_cia, punto, mes_proceso, ano_proceso }
    Finv402 - marca los documentos INV del periodo en proceso como generados
    al mayor (TINV_RME.ST_GENERADO_CNT='S'). No postea un asiento real en
    CNT; el contador sigue posteando a mano en CNT usando el reporte
    "Entrada de Diario" como fuente, igual que en FAT/CxC/CxP hoy.
    """
    try:
        body = json.loads(request.body or b'{}')
        no_cia = str(body.get('no_cia') or '01').strip()
        punto = str(body.get('punto') or '01').strip()
        mes_proceso = int(body.get('mes_proceso'))
        ano_proceso = int(body.get('ano_proceso'))
    except (TypeError, ValueError):
        return JsonResponse({"error": "no_cia, punto, mes_proceso y ano_proceso son requeridos"}, status=400)
    forbidden = _check_inv_access(request.user.username, no_cia)
    if forbidden:
        return forbidden
    try:
        result = inv_repo.generar_asiento_mayor(no_cia, punto, mes_proceso, ano_proceso)
        if body.get('cierre_periodo'):
            usuario = request.user.username
            fecha = str(body.get('fecha') or '')
            result['cierre'] = inv_repo.cierre_mensual(
                no_cia, punto, mes_proceso, ano_proceso, usuario, fecha_cierre=fecha)
        return JsonResponse({
            "message": f"{result['generados']} documento(s) generado(s) al mayor",
            **result,
        })
    except PermissionError as e:
        return JsonResponse({"error": str(e)}, status=403)
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
@csrf_exempt
@require_http_methods(["POST"])
def inv_cierre_mensual(request):
    """POST /api/inv/cierre/mensual/
    body: { no_cia, punto, mes, ano, fecha }
    Finv403 - valida bloqueos legado (toma física pendiente, permiso
    CERRAR_INV, documentos sin generar al mayor) y avanza
    TINV_PUNTO.mes_proceso/ano_proceso al siguiente periodo.
    """
    try:
        body = json.loads(request.body or b'{}')
        no_cia = str(body.get('no_cia') or '01').strip()
        punto = str(body.get('punto') or '01').strip()
        mes = int(body.get('mes'))
        ano = int(body.get('ano'))
    except (TypeError, ValueError):
        return JsonResponse({"error": "no_cia, punto, mes y ano son requeridos"}, status=400)
    forbidden = _check_inv_access(request.user.username, no_cia)
    if forbidden:
        return forbidden
    try:
        fecha = str(body.get('fecha') or '')
        result = inv_repo.cierre_mensual(no_cia, punto, mes, ano, request.user.username, fecha_cierre=fecha)
        message = ('Este periodo ya estaba cerrado' if result.get('status') == 'already_closed'
                   else 'Cierre mensual ejecutado exitosamente')
        return JsonResponse({"message": message, **result})
    except PermissionError as e:
        return JsonResponse({"error": str(e)}, status=403)
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


