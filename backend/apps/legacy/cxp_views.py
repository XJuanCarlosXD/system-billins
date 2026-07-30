import json
import datetime
from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from apps.legacy.repositories import cxp_repo


def _norm_punto(p):
    if not p:
        return p
    try:
        return str(int(p)).zfill(2)
    except ValueError:
        return p


@login_required
@csrf_exempt
@require_http_methods(['GET', 'POST'])
def cxp_proveedores(request):
    if request.method == 'GET':
        search = request.GET.get('search', '')
        activo = request.GET.get('activo', '')
        rows = cxp_repo.list_proveedores(search=search, activo=activo)
        return JsonResponse(rows, safe=False)
    data = json.loads(request.body)
    result = cxp_repo.save_proveedor(data)
    return JsonResponse(result, status=201)


@login_required
@csrf_exempt
@require_http_methods(['GET', 'PATCH'])
def cxp_proveedor(request, no):
    if request.method == 'GET':
        row = cxp_repo.get_proveedor(no)
        if row is None:
            return JsonResponse({'error': 'not found'}, status=404)
        return JsonResponse(row)
    data = json.loads(request.body)
    data['no_proveedor'] = no
    result = cxp_repo.save_proveedor(data)
    return JsonResponse(result)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def cxp_documentos(request):
    no_cia = request.GET.get('no_cia', '')
    punto = _norm_punto(request.GET.get('punto', ''))
    rows = cxp_repo.list_documentos(
        no_cia=no_cia,
        punto=punto,
        no_proveedor=request.GET.get('no_proveedor', ''),
        tipo=request.GET.get('tipo', ''),
        no_doc=request.GET.get('no_doc', ''),
        desde=request.GET.get('desde', ''),
        hasta=request.GET.get('hasta', ''),
        status=request.GET.get('status', 'A'),
    )
    return JsonResponse(rows, safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def cxp_documento(request, no_cia, punto, tipo, no):
    punto = _norm_punto(punto)
    # NO_DOCU es VARCHAR2(7) con ceros a la izquierda: "8347" → "0008347"
    no = no.strip()
    if no.isdigit():
        no = no.rjust(7, '0')
    row = cxp_repo.get_documento(no_cia, punto, tipo, no)
    if row is None:
        return JsonResponse({'error': 'not found'}, status=404)
    return JsonResponse(row)


@login_required
@csrf_exempt
@require_http_methods(['GET', 'POST'])
def cxp_saldos_menores(request):
    """GET → preview de docs candidatos (sin escribir nada).
       POST → ejecuta los ajustes (1 AC por proveedor positivos, 1 AD por negativos)."""
    no_cia = request.GET.get('no_cia', '01')
    punto = _norm_punto(request.GET.get('punto', '01'))
    if request.method == 'GET':
        max_q = request.GET.get('max_saldo')
        try:
            max_saldo = float(max_q) if max_q else cxp_repo.get_max_saldo_menor_aj(no_cia, punto)
        except Exception:
            max_saldo = 0.0
        data = cxp_repo.get_saldos_menores_preview(no_cia, punto, max_saldo)
        data['max_saldo_default'] = cxp_repo.get_max_saldo_menor_aj(no_cia, punto)
        return JsonResponse(data)
    data = json.loads(request.body or '{}')
    try:
        res = cxp_repo.aplicar_saldos_menores(
            no_cia=data.get('no_cia', '01'),
            punto=_norm_punto(data.get('punto', '01')),
            max_saldo=float(data.get('max_saldo', 0) or 0),
            fecha=data.get('fecha', ''),
            motivo=data.get('motivo', ''),
            usuario=request.user.username if request.user else '',
        )
        return JsonResponse(res)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def cxp_estado_cuenta(request):
    """GET /api/cxp/estado-cuenta/?no_cia=01&no_proveedor=X[&punto=01]"""
    no_cia = request.GET.get('no_cia', '01')
    no_prov = request.GET.get('no_proveedor', '')
    punto = _norm_punto(request.GET.get('punto', ''))
    if not no_prov:
        return JsonResponse({'error': 'no_proveedor requerido'}, status=400)
    data = cxp_repo.estado_cuenta(no_cia, no_prov, punto)
    if not data:
        return JsonResponse({'error': 'Proveedor no encontrado'}, status=404)
    return JsonResponse(data, safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def cxp_aging(request):
    no_cia = request.GET.get('no_cia', '')
    punto = _norm_punto(request.GET.get('punto', ''))
    no_proveedor = request.GET.get('no_proveedor', '')
    rows = cxp_repo.get_aging(no_cia=no_cia, punto=punto, no_proveedor=no_proveedor)
    return JsonResponse(rows, safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def cxp_tipos_docu(request):
    rows = cxp_repo.list_tipos_docu()
    return JsonResponse(rows, safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def cxp_proveedor_cuenta(request, no):
    no_cia = request.GET.get('no_cia', '01')
    punto  = _norm_punto(request.GET.get('punto', '01'))
    data   = cxp_repo.get_proveedor_cuenta(no_cia, punto, no)
    return JsonResponse(data or {}, status=200 if data else 404)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def cxp_cuenta_itbis_default(request):
    no_cia = request.GET.get('no_cia', '01')
    return JsonResponse({'cuenta': cxp_repo.get_cuenta_itbis_default(no_cia)})


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def cxp_rep_606_archivo_dgii(request):
    """GET /api/cxp/rep-606/archivo-dgii/?no_cia=&anio=&mes=&punto=

    Genera el archivo de texto pipe-delimited para subir a la DGII (formato
    606), igual al que produce el legado en C:\\archivo_ncf\\archivo_606_*.txt.
    """
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto') or ''
    try:
        anio = int(request.GET.get('anio') or 0)
        mes = int(request.GET.get('mes') or 0)
    except ValueError:
        return JsonResponse({'detail': 'anio y mes deben ser numericos'}, status=400)
    if not anio or not mes:
        return JsonResponse({'detail': 'anio y mes son requeridos'}, status=400)
    contenido, cantidad = cxp_repo.archivo_dgii_606(no_cia, anio, mes, punto)
    resp = HttpResponse(contenido, content_type='text/plain; charset=utf-8')
    resp['Content-Disposition'] = f'attachment; filename="606_{no_cia}_{anio}{mes:02d}.txt"'
    resp['X-Registros'] = str(cantidad)
    return resp


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def cxp_tipos_gasto(request):
    return JsonResponse(cxp_repo.list_tipos_gasto(), safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def cxp_tipos_retencion(request):
    return JsonResponse(cxp_repo.list_tipos_retencion(), safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def cxp_formas_pago(request):
    return JsonResponse(cxp_repo.list_formas_pago(), safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def cxp_proveedor_ncf_info(request, no):
    """GET /api/cxp/proveedores/<no>/ncf-info/?no_cia=&punto= → config NCF."""
    no_cia = request.GET.get('no_cia', '01')
    punto  = _norm_punto(request.GET.get('punto', '01'))
    # Normaliza el codigo si viene corto
    raw = (no or '').strip()
    if raw.isdigit() and len(raw) < 6:
        no = raw.zfill(6)
    data = cxp_repo.get_proveedor_ncf_info(no_cia, punto, no)
    return JsonResponse(data or {"codigo_ncf": None}, status=200)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def cxp_cuentas_proveedor(request, no):
    no_cia    = request.GET.get('no_cia', '01')
    punto     = _norm_punto(request.GET.get('punto', '01'))
    tipo_movi = request.GET.get('tipo_movi', '')
    en_cero   = request.GET.get('en_cero', 'N')
    rows = cxp_repo.list_cuentas_proveedor(no_cia, punto, no, tipo_movi, en_cero)
    return JsonResponse(rows, safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def cxp_movimientos_proveedor(request, no):
    no_cia = request.GET.get('no_cia', '01')
    punto  = _norm_punto(request.GET.get('punto', '01'))
    desde  = request.GET.get('desde', '')
    hasta  = request.GET.get('hasta', '')
    rows = cxp_repo.list_movimientos_proveedor(no_cia, punto, no, desde, hasta)
    return JsonResponse(rows, safe=False)


# ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────

@login_required
@csrf_exempt
@require_http_methods(['GET'])
def cxp_cias(request):
    rows = cxp_repo.list_cias()
    return JsonResponse(rows, safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def cxp_puntos(request):
    no_cia = request.GET.get('no_cia', '')
    rows = cxp_repo.list_puntos(no_cia)
    return JsonResponse(rows, safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def cxp_tproveedores(request):
    rows = cxp_repo.list_tproveedores()
    return JsonResponse(rows, safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def cxp_tdocu_config(request):
    rows = cxp_repo.list_tdocu_config()
    return JsonResponse(rows, safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def cxp_ciudades(request):
    rows = cxp_repo.list_ciudades()
    return JsonResponse(rows, safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def cxp_rep_cuadre(request):
    """GET ?no_cia=&punto=&mes=&ano= → cuadre contable por cuenta del periodo."""
    no_cia = request.GET.get('no_cia', '')
    punto  = _norm_punto(request.GET.get('punto', ''))
    mes    = request.GET.get('mes', '')
    ano    = request.GET.get('ano', '')
    if not no_cia or not punto or not mes or not ano:
        return JsonResponse({'error': 'no_cia, punto, mes, ano son requeridos'}, status=400)
    try:
        result = cxp_repo.rep_cuadre(no_cia, punto, int(mes), int(ano))
        return JsonResponse(result)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def cxp_rep_retenciones(request):
    """GET ?no_cia=&punto=&ano=&no_proveedor= → certificado retenciones por proveedor."""
    no_cia = request.GET.get('no_cia', '')
    punto  = _norm_punto(request.GET.get('punto', ''))
    ano    = request.GET.get('ano', '')
    no_proveedor = request.GET.get('no_proveedor', '')
    if not no_cia or not punto or not ano:
        return JsonResponse({'error': 'no_cia, punto, ano son requeridos'}, status=400)
    try:
        result = cxp_repo.rep_retenciones(no_cia, punto, int(ano), no_proveedor)
        return JsonResponse(result)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
@csrf_exempt
@require_http_methods(['GET', 'POST', 'PATCH', 'DELETE'])
def cxp_usuarios(request):
    """
    GET    ?no_cia=&punto= → lista accesos al modulo CxP
    POST   {no_cia, punto, usuario, ...flags S/N} → crea
    PATCH  {no_cia, punto, usuario, ...flags S/N} → actualiza (upsert)
    DELETE ?no_cia=&punto=&usuario= → elimina acceso
    """
    if request.method == 'GET':
        no_cia = request.GET.get('no_cia', '')
        punto  = _norm_punto(request.GET.get('punto', ''))
        rows   = cxp_repo.list_usuarios(no_cia, punto)
        return JsonResponse(rows, safe=False)
    if request.method == 'DELETE':
        no_cia  = request.GET.get('no_cia', '')
        punto   = _norm_punto(request.GET.get('punto', ''))
        usuario = request.GET.get('usuario', '')
        try:
            result = cxp_repo.delete_usuario(no_cia, punto, usuario)
            return JsonResponse(result)
        except ValueError as e:
            return JsonResponse({'error': str(e)}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    # POST / PATCH → upsert
    try:
        data = json.loads(request.body or '{}')
        if 'punto' in data:
            data['punto'] = _norm_punto(data.get('punto', ''))
        result = cxp_repo.upsert_usuario(data)
        return JsonResponse(result, status=201 if result.get('action') == 'created' else 200)
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def cxp_barrios(request):
    ciudad = request.GET.get('ciudad', '')
    rows = cxp_repo.list_barrios(ciudad)
    return JsonResponse(rows, safe=False)


# ─── REPORTES READ-ONLY ───────────────────────────────────────────────────────

@login_required
@csrf_exempt
@require_http_methods(['GET'])
def cxp_rep_alfabetico(request):
    no_cia = request.GET.get('no_cia', '')
    punto  = _norm_punto(request.GET.get('punto', ''))
    search = request.GET.get('search', '')
    data = cxp_repo.rep_alfabetico(no_cia=no_cia, punto=punto, search=search)
    return JsonResponse(data)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def cxp_rep_mayor(request):
    no_cia       = request.GET.get('no_cia', '')
    punto        = _norm_punto(request.GET.get('punto', ''))
    desde        = request.GET.get('desde', '')
    hasta        = request.GET.get('hasta', '')
    no_proveedor = request.GET.get('no_proveedor', '')
    if not no_cia or not punto or not desde or not hasta:
        return JsonResponse({'error': 'no_cia, punto, desde, hasta son requeridos'}, status=400)
    data = cxp_repo.rep_mayor_auxiliar(no_cia, punto, desde, hasta, no_proveedor)
    return JsonResponse(data)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def cxp_rep_606(request):
    _hoy = datetime.date.today()
    no_cia = request.GET.get('no_cia', '01')
    anio   = request.GET.get('anio', str(_hoy.year))
    mes    = request.GET.get('mes', str(_hoy.month))
    punto  = _norm_punto(request.GET.get('punto', ''))
    if not no_cia or not anio or not mes:
        return JsonResponse({'error': 'no_cia, anio, mes son requeridos'}, status=400)
    data = cxp_repo.rep_606(no_cia, int(anio), int(mes), punto)
    return JsonResponse(data)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def cxp_rep_607(request):
    _hoy = datetime.date.today()
    no_cia = request.GET.get('no_cia', '01')
    anio   = request.GET.get('anio', str(_hoy.year))
    mes    = request.GET.get('mes', str(_hoy.month))
    punto  = _norm_punto(request.GET.get('punto', ''))
    if not no_cia or not anio or not mes:
        return JsonResponse({'error': 'no_cia, anio, mes son requeridos'}, status=400)
    data = cxp_repo.rep_607(no_cia, int(anio), int(mes), punto)
    return JsonResponse(data)


# ─── PROCESOS ESCRITURA ───────────────────────────────────────────────────────

@login_required
@csrf_exempt
@require_http_methods(['GET', 'POST'])
def cxp_entrada_documentos(request):
    """
    GET  ?no_cia=&punto=&tipo_docu=  → siguiente numero disponible
    POST {no_cia, punto, tipo_docu, no_proveedor, fecha, valor_original, ...} → crea doc
    """
    if request.method == 'GET':
        no_cia    = request.GET.get('no_cia', '')
        punto     = _norm_punto(request.GET.get('punto', ''))
        tipo_docu = request.GET.get('tipo_docu', '')
        if not no_cia or not punto or not tipo_docu:
            return JsonResponse({'error': 'no_cia, punto, tipo_docu son requeridos'}, status=400)
        # Return next doc number preview (read-only query, no commit)
        siguiente = cxp_repo.get_siguiente_no_docu(no_cia, punto, tipo_docu)
        return JsonResponse({'siguiente': siguiente})
    data = json.loads(request.body)
    try:
        no_docu = cxp_repo.entrada_documento(data)
        return JsonResponse({'ok': True, 'no_docu': no_docu}, status=201)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def cxp_reversar(request):
    """
    POST {no_cia, punto, tipo_docu, no_docu} → marca doc como reversado (status=R).
    REVERSIBLE. Solo sobre docs con status=A.
    """
    try:
        data = json.loads(request.body)
        no_cia    = data['no_cia']
        punto     = _norm_punto(data.get('punto', '01'))
        tipo_docu = data['tipo_docu']
        no_docu   = str(data['no_docu']).strip()
        if no_docu.isdigit():
            no_docu = no_docu.rjust(7, '0')
        result    = cxp_repo.reversar_documento(no_cia, punto, tipo_docu, no_docu,
                                                usuario=data.get('usuario', 'API'),
                                                motivo=data.get('motivo', ''))
        return JsonResponse(result)
    except (KeyError, ValueError) as e:
        return JsonResponse({'error': str(e)}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
@csrf_exempt
@require_http_methods(['GET', 'POST'])
def cxp_liberar_debito(request):
    """
    GET  ?no_cia=&punto=&no_proveedor= → documentos con saldo > 0 del proveedor
    POST {no_cia, punto, no_docu_cr, tipo_docu_cr, debitos:[{no_docu,tipo_docu,monto}]}
         → aplica credito contra debitos. REVERSIBLE en ZZTEST.
    """
    if request.method == 'GET':
        no_cia       = request.GET.get('no_cia', '')
        punto        = _norm_punto(request.GET.get('punto', ''))
        no_proveedor = request.GET.get('no_proveedor', '')
        tipo_movi    = request.GET.get('tipo_movi', '')
        if not no_cia or not punto:
            return JsonResponse({'error': 'no_cia y punto son requeridos'}, status=400)
        rows = cxp_repo.list_cuentas_proveedor(no_cia, punto, no_proveedor, tipo_movi, 'N')
        return JsonResponse(rows, safe=False)
    try:
        data      = json.loads(request.body)
        no_cia    = data['no_cia']
        punto     = _norm_punto(data.get('punto', '01'))
        no_cr     = data['no_docu_cr']
        tipo_cr   = data['tipo_docu_cr']
        debitos   = data.get('debitos', [])
        result    = cxp_repo.liberar_debito(no_cia, punto, no_cr, tipo_cr, debitos)
        return JsonResponse(result)
    except (KeyError, ValueError) as e:
        return JsonResponse({'error': str(e)}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def cxp_bloquear_pago(request):
    """
    POST {no_cia, punto, tipo_docu, no_docu, bloquear: true/false}
    Toggle pago_bloqueado. REVERSIBLE: enviar bloquear=false para desbloquear.
    """
    try:
        data      = json.loads(request.body)
        no_cia    = data['no_cia']
        punto     = _norm_punto(data.get('punto', '01'))
        tipo_docu = data['tipo_docu']
        no_docu   = data['no_docu']
        bloquear  = bool(data.get('bloquear', True))
        result    = cxp_repo.bloquear_pago(no_cia, punto, tipo_docu, no_docu, bloquear)
        return JsonResponse(result)
    except (KeyError, ValueError) as e:
        return JsonResponse({'error': str(e)}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
@csrf_exempt
@require_http_methods(['GET', 'POST'])
def cxp_corregir_ncf(request):
    """
    Fcxp212 — Corregir NCF / datos DGII de un documento.
    GET  ?no_cia=&punto=&no_proveedor= (o tipo_docu=&no_docu=)
         → documentos con sus datos DGII actuales.
    POST {no_cia, punto, tipo_docu, no_docu, ncf, posiciones_fijas_ncf, rnc,
          impuesto, itbis_retenido, isr_retenido, tipo_gasto, tipo_retencion,
          forma_pago} → actualiza. No toca valores ni saldos.
    """
    if request.method == 'GET':
        no_cia       = request.GET.get('no_cia', '')
        punto        = _norm_punto(request.GET.get('punto', ''))
        no_proveedor = request.GET.get('no_proveedor', '')
        tipo_docu    = request.GET.get('tipo_docu', '')
        no_docu      = request.GET.get('no_docu', '')
        if not no_cia or not punto:
            return JsonResponse({'error': 'no_cia y punto son requeridos'}, status=400)
        if not no_proveedor and not (tipo_docu and no_docu):
            return JsonResponse(
                {'error': 'Indique no_proveedor o tipo_docu + no_docu'}, status=400)
        rows = cxp_repo.list_documentos_dgii(no_cia, punto, no_proveedor,
                                             tipo_docu, no_docu)
        return JsonResponse(rows, safe=False)
    try:
        data = json.loads(request.body)
        result = cxp_repo.corregir_datos_dgii(data)
        return JsonResponse(result)
    except (KeyError, ValueError) as e:
        return JsonResponse({'error': str(e)}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
@csrf_exempt
@require_http_methods(['GET', 'POST'])
def cxp_aplicar_movimientos(request):
    """
    Fcxp206 — Aplicación de Movimientos (saldo a favor).
    GET  ?no_cia=&punto=&no_proveedor=&tipo_docu=&no_docu=
         → {a_favor: débitos con saldo a favor, pendientes: créditos con saldo}
    POST {no_cia, punto, tipo_docu, no_docu,
          aplicaciones:[{tipo_docu, no_docu, monto}]}
         → aplica el débito contra las facturas indicadas (TCXP_REFEDOCU).
    """
    if request.method == 'GET':
        no_cia       = request.GET.get('no_cia', '')
        punto        = _norm_punto(request.GET.get('punto', ''))
        no_proveedor = request.GET.get('no_proveedor', '')
        tipo_docu    = request.GET.get('tipo_docu', '')
        no_docu      = request.GET.get('no_docu', '')
        if not no_cia or not punto or not no_proveedor:
            return JsonResponse(
                {'error': 'no_cia, punto y no_proveedor son requeridos'}, status=400)
        data = cxp_repo.aplicar_movimientos_pendientes(
            no_cia, punto, no_proveedor, tipo_docu, no_docu)
        return JsonResponse(data)
    try:
        data      = json.loads(request.body)
        no_cia    = data['no_cia']
        punto     = _norm_punto(data.get('punto', '01'))
        tipo_docu = data['tipo_docu']
        no_docu   = data['no_docu']
        result    = cxp_repo.aplicar_movimiento(
            no_cia, punto, tipo_docu, no_docu, data.get('aplicaciones', []))
        return JsonResponse(result)
    except (KeyError, ValueError) as e:
        return JsonResponse({'error': str(e)}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ─── SOLICITUDES DE PAGO (Fcxp209 / Fcxp207 — puente CxP → CHC) ──────────────

@login_required
@csrf_exempt
@require_http_methods(['GET', 'POST'])
def cxp_solicitud_cheque(request):
    """
    Fcxp209 — Generar Solicitud a Cheque.
    GET  ?no_cia=&punto=&no_proveedor= → docs con saldo del proveedor
         (incluye monto_solicitado ya comprometido en solicitudes pendientes).
    POST {no_cia, punto, cuenta_banco, no_proveedor, fecha_cheque?, detalle?,
          docs:[{tipo_docu, no_docu, monto}]} → crea el SO en CHC.
    """
    if request.method == 'GET':
        no_cia       = request.GET.get('no_cia', '')
        punto        = _norm_punto(request.GET.get('punto', ''))
        no_proveedor = request.GET.get('no_proveedor', '')
        if not no_cia or not punto or not no_proveedor:
            return JsonResponse({'error': 'no_cia, punto y no_proveedor son requeridos'}, status=400)
        rows = cxp_repo.documentos_por_pagar(no_cia, punto, no_proveedor)
        return JsonResponse(rows, safe=False)
    try:
        data   = json.loads(request.body)
        result = cxp_repo.generar_solicitud_cheque(
            no_cia=data['no_cia'],
            punto=_norm_punto(data.get('punto', '01')),
            cuenta_banco=data['cuenta_banco'],
            no_proveedor=data['no_proveedor'],
            docs=data.get('docs', []),
            usuario=(getattr(request.user, 'username', '') or 'API').upper(),
            fecha_cheque=data.get('fecha_cheque') or None,
            detalle=data.get('detalle') or None,
        )
        return JsonResponse(result, status=201)
    except (KeyError, ValueError) as e:
        return JsonResponse({'error': str(e)}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def cxp_solicitudes_pago(request):
    """
    Fcxp207 — Consultar/Procesar Solicitudes de Pago.
    GET ?no_cia=&punto=&no_proveedor=&pendientes=S|N → solicitudes SO en CHC.
    """
    no_cia = request.GET.get('no_cia', '')
    punto  = _norm_punto(request.GET.get('punto', ''))
    if not no_cia or not punto:
        return JsonResponse({'error': 'no_cia y punto son requeridos'}, status=400)
    rows = cxp_repo.solicitudes_pago(
        no_cia, punto,
        no_proveedor=request.GET.get('no_proveedor') or None,
        pendientes=request.GET.get('pendientes', 'S'),
    )
    return JsonResponse(rows, safe=False)


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def cxp_solicitud_referencias(request, no_docu):
    """GET ?no_cia=&punto= → documentos CxP referenciados por la solicitud SO."""
    no_cia = request.GET.get('no_cia', '')
    punto  = _norm_punto(request.GET.get('punto', ''))
    if not no_cia or not punto:
        return JsonResponse({'error': 'no_cia y punto son requeridos'}, status=400)
    rows = cxp_repo.solicitud_referencias(no_cia, punto, no_docu)
    return JsonResponse(rows, safe=False)


# ─── CIERRE / ASIENTO ────────────────────────────────────────────────────────

@login_required
@csrf_exempt
@require_http_methods(['GET'])
def cxp_asiento_contable(request):
    """
    GET ?no_cia=&punto=&mes=&ano= → lineas contables consolidadas del periodo (read-only).
    """
    no_cia = request.GET.get('no_cia', '')
    punto  = _norm_punto(request.GET.get('punto', ''))
    mes    = request.GET.get('mes', '')
    ano    = request.GET.get('ano', '')
    if not no_cia or not punto or not mes or not ano:
        return JsonResponse({'error': 'no_cia, punto, mes, ano son requeridos'}, status=400)
    rows = cxp_repo.get_asiento_contable_cxp(no_cia, punto, int(mes), int(ano))
    return JsonResponse(rows, safe=False)


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def cxp_generar_asiento(request):
    """
    POST {no_cia, punto, mes_proceso, ano_proceso}
    Marca docs del periodo como generados al mayor (IRREVERSIBLE sobre datos reales).
    Solo valida params aqui; la ejecucion real requiere supervision.
    """
    try:
        data = json.loads(request.body)
        no_cia       = data.get('no_cia', '')
        punto        = _norm_punto(data.get('punto', ''))
        mes_proceso  = data.get('mes_proceso', '')
        ano_proceso  = data.get('ano_proceso', '')
        if not no_cia or not punto or not mes_proceso or not ano_proceso:
            return JsonResponse(
                {'error': 'no_cia, punto, mes_proceso, ano_proceso son requeridos'},
                status=400)
        result = cxp_repo.generar_asiento_mayor_cxp(
            no_cia, punto, int(mes_proceso), int(ano_proceso))
        return JsonResponse(result)
    except (KeyError, ValueError) as e:
        return JsonResponse({'error': str(e)}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def cxp_cierre(request):
    """
    POST {no_cia, punto} → avanza mes_proceso en TCXP_PUNTO (IRREVERSIBLE sobre datos reales).
    Solo valida params aqui; la ejecucion real requiere supervision.
    """
    try:
        data  = json.loads(request.body)
        no_cia = data.get('no_cia', '')
        punto  = _norm_punto(data.get('punto', ''))
        if not no_cia or not punto:
            return JsonResponse({'error': 'no_cia y punto son requeridos'}, status=400)
        result = cxp_repo.cierre_cxp(no_cia, punto)
        return JsonResponse({'ok': True, **result})
    except (KeyError, ValueError) as e:
        return JsonResponse({'error': str(e)}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
