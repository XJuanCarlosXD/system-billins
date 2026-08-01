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
from apps.legacy.pdf_helpers import build_pdf_report


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
            res = inv_repo.create_movimiento_documento(
                no_cia=str(payload.get('no_cia', '01')).strip(),
                punto=str(payload.get('punto', '01')).strip(),
                tipo_docu=str(payload.get('tipo_docu', '')).strip().upper(),
                fecha=str(payload.get('fecha', '')).strip()[:10],
                almacen=str(payload.get('almacen', '')).strip(),
                almacen_destino=str(payload.get('almacen_destino', '')).strip(),
                lineas=payload.get('detalle') or payload.get('lineas') or [],
                usuario=getattr(request.user, 'username', '') or 'API',
                cuenta_contable=str(payload.get('cuenta', '')).strip(),
                departamento=str(payload.get('departamento', '')).strip(),
                nota=str(payload.get('nota', '')).strip(),
                no_proveedor=str(payload.get('proveedor', '')).strip(),
                rnc=str(payload.get('rnc', '')).strip(),
                no_cliente=str(payload.get('no_cliente', '')).strip(),
                vendedor=str(payload.get('vendedor', '')).strip(),
                tipo_docu_devuelto=str(payload.get('tipo_docu_devuelto', '')).strip(),
                no_docu_devuelto=str(payload.get('no_docu_devuelto', '')).strip(),
                ncf=str(payload.get('ncf', '')).strip(),
                pct_itbis=float(payload.get('pct_itbis') or 0),
                # El selector de Entrada de Compras manda 'contado'/'credito'
                # (texto), no el codigo DGII de TCXP_FORMA_PAGO_DGII (1-7) que
                # espera el espejo en CxP.
                forma_pago={'contado': 1, 'credito': 4}.get(
                    str(payload.get('forma_pago', '')).strip().lower()),
                fecha_vcto=str(payload.get('fecha_vcto', '')).strip()[:10],
            )
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


_INV_TIPO_DOCU_LABEL = {
    'AE': 'Ajuste de Entrada',
    'AF': 'Ajuste Fisico',
    'AS': 'Ajuste de Salida',
    'DC': 'Devolucion de Compra',
    'DV': 'Devolucion',
    'EA': 'Entrada de Almacen',
    'EC': 'Entrada de Compra',
    'EP': 'Entrada de Produccion',
    'SA': 'Salida de Almacen',
    'SP': 'Salida de Produccion',
    'TA': 'Transferencia de Almacen',
}


@login_required
@require_http_methods(["GET"])
def inv_documento_pdf(request, tipo_docu: str, no_docu: str):
    """GET /api/inv/documentos/<tipo_docu>/<no_docu>/pdf/?no_cia=01

    Documento individual de inventario con paridad legacy: bloques
    condicionales por tipo_docu (proveedor+NCF+RNC para EC/DC, cliente+vendedor
    para DV, conduce/localidad/componente siempre, sucursales para TA),
    columnas extra (empaque, unidad, itbis) en líneas y totales completos
    (bruto, descuento, itbis, neto, valor bienes/servicio). Watermark
    ANULADA cuando st_anulado=S.
    """
    from apps.fat.views_print import _render_modern_report_pdf
    no_cia = request.GET.get('no_cia', '01')
    tipo_s = (tipo_docu or '').strip().upper()
    no_docu_s = (no_docu or '').strip()

    # Guard multi-empresa
    forbidden = _check_inv_access(getattr(request.user, 'username', ''), no_cia)
    if forbidden is not None:
        return forbidden

    try:
        doc = inv_repo.get_documento_detalle(no_cia=no_cia, tipo_docu=tipo_s, no_docu=no_docu_s)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

    if not doc:
        return JsonResponse({"error": "Documento no encontrado"}, status=404)

    h = doc.get('header', {}) or {}
    lines = doc.get('lines', []) or []

    def hg(k, d=''):
        v = h.get(k, d)
        return v if v is not None else d

    documento_label = (hg('tipo_docu_descri') or _INV_TIPO_DOCU_LABEL.get(tipo_s, f"Documento {tipo_s}")).strip()
    tipo_movi = str(hg('tipo_movi', '')).strip().upper()
    tipo_movi_label = {'E': 'Entrada', 'S': 'Salida'}.get(tipo_movi, tipo_movi or 'N/A')
    tipo_trans = str(hg('tipo_transaccion', '')).strip().upper()
    tipo_trans_label = {
        'C': 'Compra', 'V': 'Venta', 'D': 'Devolución', 'E': 'Entrada Almacén',
        'S': 'Salida Almacén', 'T': 'Transferencia', 'J': 'Ajuste',
        'P': 'Producción', 'M': 'Movimiento Interno', 'R': 'Reverso',
        'A': 'Ajuste Físico', 'F': 'Factura',
    }.get(tipo_trans, tipo_trans)

    fecha_raw = str(hg('fecha') or '')
    fecha = fecha_raw[:10] if len(fecha_raw) >= 10 else fecha_raw
    fecha_display = (f"{fecha[8:10]}/{fecha[5:7]}/{fecha[:4]}" if len(fecha) == 10 else fecha) or 'N/A'

    is_anulado = str(hg('st_anulado', 'N')).upper() == 'S'

    # Construir bloques info_blocks (grilla 2-col) + subtitle_lines (texto largo)
    def fmt_alm(code, desc):
        code = str(code or '').strip()
        desc = str(desc or '').strip()
        if code and desc:
            return f"{code} - {desc}"
        return code or desc or '—'

    almacen = (lines[0].get('almacen', lines[0].get('ALMACEN', '')) if lines else '') or hg('almacen', '')
    almacen_desc = hg('almacen_descripcion', '')
    punto_code = hg('punto') or '01'
    punto_desc = hg('punto_descripcion', '')

    estado_label = {'A': 'Autorizado', 'P': 'Pendiente', 'C': 'Cerrado'}.get(
        str(hg('estado', '')).upper(), hg('estado', '')
    )

    # Bloque DOCUMENTO
    doc_rows = [
        ('Punto', fmt_alm(punto_code, punto_desc)),
        ('Almacén', fmt_alm(almacen, almacen_desc)),
    ]
    if hg('localidad_descripcion') or hg('no_localidad'):
        doc_rows.append(('Localidad', fmt_alm(hg('no_localidad'), hg('localidad_descripcion'))))
    doc_rows.append(('Fecha', fecha_display))
    if hg('conduce'):
        doc_rows.append(('Conduce', str(hg('conduce'))))

    # Bloque MOVIMIENTO
    mov_rows = [
        ('Tipo Movimiento', tipo_movi_label),
        ('Tipo Transacción', tipo_trans_label or 'N/A'),
    ]
    if estado_label:
        if is_anulado:
            mov_rows.append(('Estado', f'{estado_label} (ANULADO)'))
        else:
            mov_rows.append(('Estado', estado_label))
    if hg('usuario'):
        mov_rows.append(('Usuario', str(hg('usuario'))))
    if str(hg('st_impresion', 'N')).upper() == 'S':
        mov_rows.append(('Marca', 'Reimpresión'))

    info_blocks = [
        {'title': 'DOCUMENTO', 'rows': doc_rows},
        {'title': 'MOVIMIENTO', 'rows': mov_rows},
    ]

    # Bloque ORIGEN/DESTINO — Proveedor (EC, DC) o Cliente (DV, EA)
    od_rows = []
    if hg('no_proveedor'):
        od_rows.append(('Proveedor', f"{hg('no_proveedor')} - {hg('proveedor_nombre') or 'N/A'}"))
        if hg('proveedor_rnc'):
            od_rows.append(('RNC', str(hg('proveedor_rnc'))))
    if hg('no_cliente'):
        od_rows.append(('Cliente', f"{hg('no_cliente')} - {hg('cliente_nombre') or 'N/A'}"))
        if hg('cliente_rnc'):
            od_rows.append(('RNC', str(hg('cliente_rnc'))))
        if hg('cliente_direccion'):
            od_rows.append(('Dirección', str(hg('cliente_direccion'))[:80]))
    if hg('vendedor'):
        od_rows.append(('Vendedor', f"{hg('vendedor')} - {hg('vendedor_nombre') or ''}".strip(' -')))
    if hg('ncf_dgi'):
        od_rows.append(('NCF', str(hg('ncf_dgi'))))

    # Bloque REFERENCIAS — refe / devuelto / reversado / motivo
    ref_rows = []
    if hg('tipo_refe') and hg('no_refe'):
        ref_rows.append(('Referencia', f"{hg('tipo_refe')}-{hg('no_refe')}"))
    if hg('tipo_docu_devuelto') and hg('no_docu_devuelto'):
        ref_rows.append(('Doc. devuelto', f"{hg('tipo_docu_devuelto')}-{hg('no_docu_devuelto')}"))
    if hg('tipo_docu_rev') and hg('no_docu_rev'):
        ref_rows.append(('Doc. reversado', f"{hg('tipo_docu_rev')}-{hg('no_docu_rev')}"))
    if hg('no_motivo'):
        ref_rows.append(('Motivo reverso', str(hg('no_motivo'))))
    if hg('con_restock_almacen') == 'S':
        ref_rows.append(('Restock', 'Sí (al almacén)'))

    # Bloque PROYECTO / OP
    proj_rows = []
    if hg('no_componente'): proj_rows.append(('Componente', str(hg('no_componente'))))
    if hg('no_depto'): proj_rows.append(('Depto', str(hg('no_depto'))))
    if hg('orden_produccion'): proj_rows.append(('OP', str(hg('orden_produccion'))))
    if hg('no_orden_ot'): proj_rows.append(('OT', str(hg('no_orden_ot'))))
    if hg('tipo_orden_op'): proj_rows.append(('Tipo OP', str(hg('tipo_orden_op'))))

    # Bloque PRODUCCIÓN (Finv204)
    prod_rows = []
    if hg('granulometria'): prod_rows.append(('Granulometría', f"{float(hg('granulometria')):.2f}"))
    if hg('viscosidad'): prod_rows.append(('Viscosidad', f"{float(hg('viscosidad')):.2f}"))
    if hg('peso1'): prod_rows.append(('Peso 1', f"{float(hg('peso1')):,.2f}"))
    if hg('peso2'): prod_rows.append(('Peso 2', f"{float(hg('peso2')):,.2f}"))

    # Tasa / ITBIS
    tasa = float(hg('tasa_us', 0) or 0)
    porc_imp = float(hg('porc_impuesto', 0) or 0)
    tasa_rows = []
    if tasa: tasa_rows.append(('Tasa USD', f"{tasa:,.2f}"))
    if porc_imp: tasa_rows.append(('% ITBIS', f"{porc_imp:.2f}"))

    if od_rows and ref_rows:
        info_blocks.append({'title': 'ORIGEN / DESTINO', 'rows': od_rows})
        info_blocks.append({'title': 'REFERENCIAS', 'rows': ref_rows})
    elif od_rows:
        info_blocks.append({'title': 'ORIGEN / DESTINO', 'span_full': True, 'rows': od_rows})
    elif ref_rows:
        info_blocks.append({'title': 'REFERENCIAS', 'span_full': True, 'rows': ref_rows})

    if proj_rows and prod_rows:
        info_blocks.append({'title': 'PROYECTO / OP', 'rows': proj_rows})
        info_blocks.append({'title': 'PRODUCCIÓN', 'rows': prod_rows})
    elif proj_rows:
        info_blocks.append({'title': 'PROYECTO / OP', 'span_full': True, 'rows': proj_rows})
    elif prod_rows:
        info_blocks.append({'title': 'PRODUCCIÓN', 'span_full': True, 'rows': prod_rows})

    if tasa_rows:
        info_blocks.append({'title': 'TASA / IMPUESTO', 'span_full': True, 'inline': True, 'rows': tasa_rows})

    # subtitle_lines reservado para texto largo (Detalle / Nota) que no calza en grilla
    subtitle = []
    if hg('detalle'): subtitle.append(f"Detalle: {str(hg('detalle'))[:160]}")
    if hg('nota'): subtitle.append(f"Nota: {str(hg('nota'))[:160]}")

    # Líneas con empaque + ITBIS
    rows_data = []
    for ln in lines[:500]:
        cant = float(ln.get('cantidad', ln.get('CANTIDAD', 0)) or 0)
        costo = float(ln.get('costo', ln.get('COSTO', 0)) or 0)
        precio = float(ln.get('precio', ln.get('PRECIO', 0)) or 0)
        monto = float(ln.get('monto_neto', ln.get('MONTO_NETO', 0)) or 0)
        imp = float(ln.get('impuesto', ln.get('IMPUESTO', 0)) or 0)
        if not monto:
            monto = round(cant * (costo or precio), 2)
        unit = costo if costo else precio
        rows_data.append({
            'no_linea': ln.get('no_linea', ln.get('NO_LINEA', '')),
            'no_produ': ln.get('no_produ', ln.get('NO_PRODU', '')),
            'descripcion': str(ln.get('descripcion', ln.get('DESCRIPCION', '')) or '')[:60],
            'unidad': str(ln.get('unidad', ln.get('UNIDAD', '')) or '')[:8],
            'cantidad': cant,
            'costo': unit,
            'impuesto': imp,
            'monto_neto': monto,
        })

    columns = [
        {'key': 'no_linea', 'label': 'Ln', 'align': 'center', 'width': 8},
        {'key': 'no_produ', 'label': 'Código', 'align': 'left', 'width': 20},
        {'key': 'descripcion', 'label': 'Descripción', 'align': 'left', 'width': 60},
        {'key': 'unidad', 'label': 'Unid.', 'align': 'left', 'width': 12},
        {'key': 'cantidad', 'label': 'Cantidad', 'align': 'right', 'format': 'qty', 'width': 18},
        {'key': 'costo', 'label': 'Costo/Precio', 'align': 'right', 'format': 'money', 'width': 22},
        {'key': 'impuesto', 'label': 'ITBIS', 'align': 'right', 'format': 'money', 'width': 18},
        {'key': 'monto_neto', 'label': 'Monto Neto', 'align': 'right', 'format': 'money', 'width': 24},
    ]

    # Totales legacy
    total_neto = float(hg('total_neto', 0) or 0)
    total_linea = float(hg('total_linea', 0) or 0)
    impuesto_t = float(hg('impuesto', 0) or 0)
    desc_t = float(hg('descuento', 0) or 0)
    valor_bienes = float(hg('valor_bienes', 0) or 0)
    valor_serv = float(hg('valor_servicio', 0) or 0)
    monto_sum = sum(r['monto_neto'] for r in rows_data) or total_neto

    totals_row = {
        'descripcion': f"Subtotal ({len(rows_data)} líneas)",
        'cantidad': sum(r['cantidad'] for r in rows_data),
        'monto_neto': total_linea or monto_sum,
    }

    # Bloque TOTALES como info_block inline ancho completo (TOTAL NETO destacado)
    tot_rows = []
    if total_linea: tot_rows.append(('Total Bruto', f"{total_linea:,.2f}"))
    if desc_t: tot_rows.append(('Descuento', f"{desc_t:,.2f}"))
    if impuesto_t: tot_rows.append(('ITBIS', f"{impuesto_t:,.2f}"))
    if valor_bienes: tot_rows.append(('Valor Bienes', f"{valor_bienes:,.2f}"))
    if valor_serv: tot_rows.append(('Valor Servicio', f"{valor_serv:,.2f}"))
    tot_rows.append(('TOTAL NETO', f"{total_neto or monto_sum:,.2f}"))
    info_blocks.append({
        'title': 'TOTALES',
        'span_full': True,
        'inline': True,
        'rows': tot_rows,
    })

    # Firmas según tipo
    if tipo_s in ('EC', 'DC'):
        sigs = ['Recibido por', 'Aprobado por', 'Entregado por']
    elif tipo_s in ('DV',):
        sigs = ['Recibido por', 'Autorizado por', 'Entregado por']
    elif tipo_s in ('TA',):
        sigs = ['Despachado por', 'Recibido en destino', 'Autorizado por']
    elif tipo_s in ('SA', 'SP'):
        sigs = ['Despachado por', 'Autorizado por', 'Recibido por']
    elif tipo_s in ('EA', 'EP'):
        sigs = ['Recibido por', 'Autorizado por', 'Entregado por']
    elif tipo_s in ('AE', 'AS', 'AF'):
        sigs = ['Contado por', 'Autorizado por', 'Aplicado por']
    else:
        sigs = ['Realizado por', 'Autorizado por', 'Recibido por']

    try:
        cia_full = _get_cia_full(no_cia)
        # Marca de anulado en el título
        title = documento_label + (" — ANULADO" if is_anulado else "")
        pdf = _render_modern_report_pdf(
            report_id=f"{tipo_s}-{no_docu_s}",
            title=title,
            cia=cia_full,
            subtitle_lines=subtitle,
            info_blocks=info_blocks,
            sections=[{
                'columns': columns,
                'rows': rows_data,
                'totals_row': totals_row,
            }],
            signature_labels=sigs,
            impreso_por=getattr(request.user, 'username', '') or '',
            orientation='portrait',
        )
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

    response = HttpResponse(pdf, content_type='application/pdf')
    response['Content-Disposition'] = f'inline; filename="INV_{tipo_s}_{no_docu_s}.pdf"'
    return response


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


def _get_cia_full(no_cia: str) -> dict:
    """Devuelve compania con descripcion/direccion/rnc/telefono (TFAT_CIAS preferred)."""
    try:
        from apps.legacy.repositories import fat_repo as _fat_repo
        cia = next(
            (c for c in _fat_repo.list_companias_fat() if str(c.get('no_cia')).strip() == no_cia),
            None,
        ) or {}
    except Exception:
        cia = {}
    if not cia:
        cia = inv_repo.get_compania(no_cia) or {}
    return cia


@login_required
@require_http_methods(["GET"])
def inv_reporte_existencia_pdf(request):
    """GET /api/inv/reportes/existencia/pdf/?no_cia=01&almacen="""
    from apps.fat.views_print import _render_modern_report_pdf
    try:
        no_cia = request.GET.get('no_cia', '01')
        almacen = request.GET.get('almacen', '')
        punto = request.GET.get('punto', '')
        rows = inv_repo.list_existencias(no_cia=no_cia, almacen=almacen, punto=punto)
        rows_data = [{
            'almacen_label': f"{(r.get('almacen') or '').strip()} {(r.get('almacen_desc') or '').strip()}".strip(),
            'almacen': (r.get('almacen') or '').strip(),
            'no_produ': r.get('no_produ', ''),
            'descripcion': (r.get('descripcion') or '')[:80],
            'existencia': float(r.get('existencia') or 0),
            'costo_prom': float(r.get('costo_prom') or r.get('costo_actual') or 0),
            'valor': float(r.get('valor') or 0),
        } for r in rows]
        rows_data.sort(key=lambda r: (r['almacen'], r['no_produ']))
        total_valor = sum(r['valor'] for r in rows_data)
        columns = [
            {'key': 'almacen_label', 'label': 'Almacen', 'align': 'left', 'width': 50},
            {'key': 'no_produ', 'label': 'No. Producto', 'align': 'left', 'width': 24},
            {'key': 'descripcion', 'label': 'Descripcion', 'align': 'left', 'width': 80},
            {'key': 'existencia', 'label': 'Existencia', 'align': 'right', 'format': 'qty', 'width': 24},
            {'key': 'costo_prom', 'label': 'Costo Prom', 'align': 'right', 'format': 'money', 'width': 26},
            {'key': 'valor', 'label': 'Valor', 'align': 'right', 'format': 'money', 'width': 34},
        ]
        subtitle = [f"Total productos: {len(rows_data)}"]
        if almacen:
            subtitle.append(f"Almacen filtrado: {almacen}")
        pdf = _render_modern_report_pdf(
            report_id='Rinv301', title='Existencia de Inventario',
            cia=_get_cia_full(no_cia), subtitle_lines=subtitle,
            sections=[{
                'columns': columns, 'rows': rows_data, 'group_by': 'almacen_label',
                'totals_row': {'almacen_label': f"Total general ({len(rows_data)})",
                               'valor': total_valor},
            }],
            impreso_por=getattr(request.user, 'username', '') or '',
            orientation='landscape',
        )
        resp = HttpResponse(pdf, content_type='application/pdf')
        resp['Content-Disposition'] = f'inline; filename="INV_Existencias_{no_cia}.pdf"'
        return resp
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
@require_http_methods(["GET"])
def inv_reporte_movimientos_pdf(request):
    """GET /api/inv/reportes/movimientos/pdf/?no_cia=01&desde=&hasta=&tipo_docu="""
    from apps.fat.views_print import _render_modern_report_pdf
    try:
        no_cia = request.GET.get('no_cia', '01')
        almacen = request.GET.get('almacen', '')
        tipo = request.GET.get('tipo', '')
        desde = request.GET.get('desde', '')
        hasta = request.GET.get('hasta', '')
        rows = inv_repo.list_movimientos(
            no_cia=no_cia, almacen=almacen, tipo=tipo, desde=desde, hasta=hasta,
        )
        rows_data = [{
            'tipo_docu': (r.get('tipo_docu') or '').strip(),
            'fecha': str(r.get('fecha') or '')[:10],
            'no_docu': r.get('no_docu') or '',
            'almacen': (r.get('almacen') or '').strip(),
            'no_produ': r.get('no_produ', ''),
            'descripcion': (r.get('descripcion') or '')[:60],
            'tipo_movi': r.get('tipo_movi') or '',
            'cantidad': float(r.get('cantidad') or 0),
            'costo': float(r.get('costo') or 0),
            'monto_neto': float(r.get('monto_neto') or 0),
        } for r in rows]
        rows_data.sort(key=lambda r: (r['tipo_docu'], r['fecha'], r['no_docu']))
        total_neto = sum(r['monto_neto'] for r in rows_data)
        columns = [
            {'key': 'tipo_docu', 'label': 'Tipo', 'align': 'center', 'width': 14},
            {'key': 'no_docu', 'label': 'No. Doc', 'align': 'left', 'width': 22},
            {'key': 'fecha', 'label': 'Fecha', 'align': 'center', 'width': 22},
            {'key': 'almacen', 'label': 'Alm.', 'align': 'center', 'width': 14},
            {'key': 'no_produ', 'label': 'Producto', 'align': 'left', 'width': 22},
            {'key': 'descripcion', 'label': 'Descripcion', 'align': 'left', 'width': 60},
            {'key': 'tipo_movi', 'label': 'E/S', 'align': 'center', 'width': 12},
            {'key': 'cantidad', 'label': 'Cantidad', 'align': 'right', 'format': 'qty', 'width': 22},
            {'key': 'costo', 'label': 'Costo', 'align': 'right', 'format': 'money', 'width': 22},
            {'key': 'monto_neto', 'label': 'Monto Neto', 'align': 'right', 'format': 'money', 'width': 28},
        ]
        subtitle = []
        if desde and hasta:
            subtitle.append(f"Periodo: {desde} a {hasta}")
        elif desde:
            subtitle.append(f"Desde: {desde}")
        elif hasta:
            subtitle.append(f"Hasta: {hasta}")
        if tipo:
            subtitle.append(f"Tipo Docu: {tipo}")
        if almacen:
            subtitle.append(f"Almacen: {almacen}")
        subtitle.append(f"Total movimientos: {len(rows_data)}")
        pdf = _render_modern_report_pdf(
            report_id='Rinv305', title='Reporte de Movimientos',
            cia=_get_cia_full(no_cia), subtitle_lines=subtitle,
            sections=[{
                'columns': columns, 'rows': rows_data, 'group_by': 'tipo_docu',
                'totals_row': {'tipo_docu': 'Total general',
                               'monto_neto': total_neto,
                               'cantidad': sum(r['cantidad'] for r in rows_data)},
            }],
            impreso_por=getattr(request.user, 'username', '') or '',
            orientation='landscape',
        )
        resp = HttpResponse(pdf, content_type='application/pdf')
        resp['Content-Disposition'] = f'inline; filename="INV_Movimientos_{no_cia}.pdf"'
        return resp
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
@require_http_methods(["GET"])
def inv_reporte_kardex_pdf(request):
    """GET /api/inv/reportes/kardex/pdf/?no_cia=01&no_produ=X&almacen=&desde=&hasta="""
    from apps.fat.views_print import _render_modern_report_pdf
    try:
        no_cia = request.GET.get('no_cia', '01')
        no_produ = request.GET.get('no_produ', '')
        almacen = request.GET.get('almacen', '')
        desde = request.GET.get('desde', '')
        hasta = request.GET.get('hasta', '')
        if not no_produ:
            return JsonResponse({"error": "Parametro no_produ requerido"}, status=400)
        rows = inv_repo.list_kardex(
            no_cia=no_cia, no_produ=no_produ, almacen=almacen, desde=desde, hasta=hasta,
        )
        rows_data = [{
            'fecha': str(r.get('fecha') or '')[:10],
            'tipo_docu': (r.get('tipo_docu') or '').strip(),
            'no_docu': r.get('no_docu') or '',
            'almacen': (r.get('almacen') or '').strip(),
            'tipo_movi': r.get('tipo_movi') or '',
            'cantidad': float(r.get('cantidad') or 0),
            'costo': float(r.get('costo') or 0),
            'saldo': float(r.get('saldo') or 0),
        } for r in rows]
        columns = [
            {'key': 'fecha', 'label': 'Fecha', 'align': 'center', 'width': 24},
            {'key': 'tipo_docu', 'label': 'Tipo', 'align': 'center', 'width': 16},
            {'key': 'no_docu', 'label': 'No. Docu', 'align': 'left', 'width': 26},
            {'key': 'almacen', 'label': 'Almacen', 'align': 'center', 'width': 16},
            {'key': 'tipo_movi', 'label': 'E/S', 'align': 'center', 'width': 12},
            {'key': 'cantidad', 'label': 'Cantidad', 'align': 'right', 'format': 'qty', 'width': 24},
            {'key': 'costo', 'label': 'Costo', 'align': 'right', 'format': 'money', 'width': 24},
            {'key': 'saldo', 'label': 'Saldo', 'align': 'right', 'format': 'qty', 'width': 24},
        ]
        subtitle = [f"Producto: {no_produ}"]
        if almacen:
            subtitle.append(f"Almacen: {almacen}")
        if desde and hasta:
            subtitle.append(f"Periodo: {desde} a {hasta}")
        subtitle.append(f"Total movimientos: {len(rows_data)}")
        pdf = _render_modern_report_pdf(
            report_id='Rinv304', title='Kardex de Producto',
            cia=_get_cia_full(no_cia), subtitle_lines=subtitle,
            sections=[{'columns': columns, 'rows': rows_data}],
            impreso_por=getattr(request.user, 'username', '') or '',
            orientation='landscape',
        )
        resp = HttpResponse(pdf, content_type='application/pdf')
        resp['Content-Disposition'] = f'inline; filename="INV_Kardex_{no_produ}.pdf"'
        return resp
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
@require_http_methods(["GET"])
def inv_reporte_valorizacion_pdf(request):
    """GET /api/inv/reportes/valorizacion/pdf/?no_cia=01&almacen="""
    from apps.fat.views_print import _render_modern_report_pdf
    try:
        no_cia = request.GET.get('no_cia', '01')
        almacen = request.GET.get('almacen', '')
        rows = inv_repo.get_valoracion_inventario(no_cia=no_cia, almacen=almacen)
        rows_data = [{
            'almacen_label': f"{(r.get('almacen') or '').strip()} {(r.get('almacen_desc') or '').strip()}".strip(),
            'almacen': (r.get('almacen') or '').strip(),
            'no_produ': r.get('no_produ', ''),
            'descripcion': (r.get('descripcion') or '')[:80],
            'existencia': float(r.get('existencia') or 0),
            'costo_actual': float(r.get('costo_actual') or 0),
            'valor': float(r.get('valor') or 0),
        } for r in rows]
        rows_data.sort(key=lambda r: (r['almacen'], r['no_produ']))
        total_valor = sum(r['valor'] for r in rows_data)
        columns = [
            {'key': 'almacen_label', 'label': 'Almacen', 'align': 'left', 'width': 50},
            {'key': 'no_produ', 'label': 'No. Producto', 'align': 'left', 'width': 24},
            {'key': 'descripcion', 'label': 'Descripcion', 'align': 'left', 'width': 80},
            {'key': 'existencia', 'label': 'Existencia', 'align': 'right', 'format': 'qty', 'width': 24},
            {'key': 'costo_actual', 'label': 'Costo Actual', 'align': 'right', 'format': 'money', 'width': 28},
            {'key': 'valor', 'label': 'Valor', 'align': 'right', 'format': 'money', 'width': 34},
        ]
        subtitle = [f"Total productos: {len(rows_data)}", f"Valor total: {total_valor:,.2f}"]
        if almacen:
            subtitle.append(f"Almacen filtrado: {almacen}")
        pdf = _render_modern_report_pdf(
            report_id='Rinv315', title='Valoracion de Inventario',
            cia=_get_cia_full(no_cia), subtitle_lines=subtitle,
            sections=[{
                'columns': columns, 'rows': rows_data, 'group_by': 'almacen_label',
                'totals_row': {'almacen_label': f"Total general ({len(rows_data)})",
                               'valor': total_valor},
            }],
            impreso_por=getattr(request.user, 'username', '') or '',
            orientation='landscape',
        )
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
        pdf = build_pdf_report(titulo, cols, rows, no_cia=no_cia)
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


