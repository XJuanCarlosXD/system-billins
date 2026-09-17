"""API Facturación Electrónica: configuración por empresa (Fase 1) y
bitácora de documentos enviados (Fase 2, Task 4).

Rutas:
  GET/PUT /api/fe/config/?no_cia=01
  POST    /api/fe/config/certificado/        (multipart: no_cia, password, certificado)
  POST    /api/fe/config/probar-conexion/
  GET/POST /api/fe/secuencias/?no_cia=01
  GET     /api/fe/documentos/?no_cia=01&estado=&tipo_ecf=&es_prueba=&limit=&offset=
  GET     /api/fe/documentos/<e_ncf>/?no_cia=01
  POST    /api/fe/documentos/<e_ncf>/consultar-estado/   (body: {no_cia})
  POST    /api/fe/documentos/<e_ncf>/reenviar/            (body: {no_cia})
  POST    /api/fe/pruebas/enviar/             (body: {no_cia, tipo_ecf, encf, datos})
"""
from __future__ import annotations

import json
import re

import openpyxl
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.fe import crypto, dgii_client, ecf_builder, firma
from apps.legacy.repositories import fe_repo


def _err(msg: str, status: int = 400) -> JsonResponse:
    return JsonResponse({'detail': str(msg)}, status=status)


@login_required
@csrf_exempt
@require_http_methods(['GET', 'PUT'])
def config_view(request):
    if request.method == 'GET':
        no_cia = request.GET.get('no_cia')
        if not no_cia:
            return _err('no_cia requerido')
        return JsonResponse({'config': fe_repo.get_config(no_cia)})
    try:
        data = json.loads(request.body or b'{}')
    except json.JSONDecodeError:
        return _err('JSON inválido')
    no_cia = data.get('no_cia')
    if not no_cia or not data.get('rnc_emisor') or not data.get('razon_social'):
        return _err('no_cia, rnc_emisor y razon_social son requeridos')
    if data.get('ambiente') not in dgii_client.AMBIENTES:
        return _err('ambiente debe ser testecf, certecf o ecf')
    fe_repo.upsert_config(no_cia, data)
    return JsonResponse({'config': fe_repo.get_config(no_cia)})


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def certificado_view(request):
    no_cia = request.POST.get('no_cia')
    password = request.POST.get('password')
    archivo = request.FILES.get('certificado')
    if not (no_cia and password and archivo):
        return _err('no_cia, password y certificado son requeridos')
    p12_bytes = archivo.read()
    try:
        _key, _cert, subject, vence = firma.leer_p12(p12_bytes, password)
    except Exception as exc:
        return _err(f'Certificado o contraseña inválidos: {exc}')
    try:
        fe_repo.save_certificado(no_cia, p12_bytes, crypto.encrypt(password),
                                 subject, vence)
    except ValueError as exc:
        return _err(str(exc))
    return JsonResponse({'cert_subject': subject,
                         'cert_vence': vence.strftime('%Y-%m-%d')})


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def probar_conexion_view(request):
    try:
        data = json.loads(request.body or b'{}')
    except json.JSONDecodeError:
        return _err('JSON inválido')
    no_cia = data.get('no_cia')
    if not no_cia:
        return _err('no_cia requerido')
    cfg = fe_repo.get_config(no_cia)
    if not cfg:
        return _err('La empresa no tiene configuración de FE guardada')
    try:
        return JsonResponse(
            dgii_client.probar_conexion(no_cia, cfg['ambiente']))
    except dgii_client.DgiiError as exc:
        return JsonResponse({'ok': False, 'mensaje': str(exc)}, status=502)
    except Exception as exc:
        return JsonResponse({'ok': False, 'mensaje': str(exc)}, status=500)


@login_required
@csrf_exempt
@require_http_methods(['GET', 'POST'])
def secuencias_view(request):
    if request.method == 'GET':
        no_cia = request.GET.get('no_cia')
        if not no_cia:
            return _err('no_cia requerido')
        return JsonResponse({'items': fe_repo.list_secuencias(no_cia)})
    try:
        data = json.loads(request.body or b'{}')
    except json.JSONDecodeError:
        return _err('JSON inválido')
    no_cia = data.get('no_cia')
    requeridos = ('tipo_ecf', 'secuencia_desde', 'secuencia_hasta',
                  'prox_secuencia', 'fecha_vence')
    if not no_cia or any(data.get(k) in (None, '') for k in requeridos):
        return _err(f'Requeridos: no_cia, {", ".join(requeridos)}')
    if int(data['secuencia_hasta']) < int(data['secuencia_desde']):
        return _err('secuencia_hasta debe ser mayor o igual a secuencia_desde')
    if not (int(data['secuencia_desde']) <= int(data['prox_secuencia'])
            <= int(data['secuencia_hasta']) + 1):
        return _err('prox_secuencia fuera del rango autorizado')
    fe_repo.upsert_secuencia(no_cia, data)
    return JsonResponse({'items': fe_repo.list_secuencias(no_cia)})


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def documentos_view(request):
    no_cia = request.GET.get('no_cia')
    if not no_cia:
        return _err('no_cia requerido')
    filtros = {
        'estado': request.GET.get('estado'),
        'tipo_ecf': request.GET.get('tipo_ecf'),
        'es_prueba': request.GET.get('es_prueba'),
        'limit': request.GET.get('limit'),
        'offset': request.GET.get('offset'),
    }
    return JsonResponse({'items': fe_repo.list_documentos(no_cia, filtros)})


@login_required
@csrf_exempt
@require_http_methods(['GET'])
def documento_detalle_view(request, e_ncf):
    no_cia = request.GET.get('no_cia')
    if not no_cia:
        return _err('no_cia requerido')
    doc = fe_repo.get_documento(no_cia, e_ncf)
    if not doc:
        return _err('Documento no encontrado', status=404)
    return JsonResponse({'documento': doc})


def _doc_o_404(no_cia: str, e_ncf: str):
    """Busca el documento en TFE_DOCUMENTO; devuelve ``(doc, None)`` si
    existe o ``(None, respuesta_404)`` si no. Compartido por
    documento_consultar_estado_view y documento_reenviar_view -- antes
    duplicaban el mismo bloque verbatim (code review post-commit)."""
    doc = fe_repo.get_documento(no_cia, e_ncf)
    if not doc:
        return None, _err('Documento no encontrado', status=404)
    return doc, None


def _cfg_o_error(no_cia: str):
    """Busca la config FE de la cía; devuelve ``(cfg, None)`` si existe o
    ``(None, respuesta_400)`` si no. Mismo motivo que ``_doc_o_404``."""
    cfg = fe_repo.get_config(no_cia)
    if not cfg:
        return None, _err('La empresa no tiene configuración de FE guardada')
    return cfg, None


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def documento_consultar_estado_view(request, e_ncf):
    try:
        data = json.loads(request.body or b'{}')
    except json.JSONDecodeError:
        return _err('JSON inválido')
    no_cia = data.get('no_cia')
    if not no_cia:
        return _err('no_cia requerido')
    doc, error = _doc_o_404(no_cia, e_ncf)
    if error:
        return error
    if not doc.get('track_id'):
        return _err('El documento no tiene trackId (no fue enviado a la DGII)')
    cfg, error = _cfg_o_error(no_cia)
    if error:
        return error
    try:
        resultado = dgii_client.consultar_estado(
            no_cia, cfg['ambiente'], doc['track_id'])
    except dgii_client.DgiiError as exc:
        return _err(str(exc), status=502)
    estado = (resultado.get('estado') or '').upper() or 'DESCONOCIDO'
    try:
        fe_repo.actualizar_estado_documento(
            no_cia, e_ncf, estado, json.dumps(resultado))
    except ValueError as exc:
        # Carrera muy poco probable: el documento se borró entre el
        # _doc_o_404 de arriba y este UPDATE. Mejor un 404 limpio que un 500.
        return _err(str(exc), status=404)
    return JsonResponse({'estado': estado, 'respuesta_dgii': resultado})


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def documento_reenviar_view(request, e_ncf):
    try:
        data = json.loads(request.body or b'{}')
    except json.JSONDecodeError:
        return _err('JSON inválido')
    no_cia = data.get('no_cia')
    if not no_cia:
        return _err('no_cia requerido')
    doc, error = _doc_o_404(no_cia, e_ncf)
    if error:
        return error
    if not doc.get('xml_firmado'):
        return _err('El documento no tiene XML firmado almacenado; no se '
                    'puede reenviar (vuelva a generarlo desde cero)')
    cfg, error = _cfg_o_error(no_cia)
    if error:
        return error
    try:
        resultado = dgii_client.reenviar_ecf(
            no_cia, cfg['ambiente'], e_ncf, doc['xml_firmado'])
    except dgii_client.DgiiError as exc:
        return _err(str(exc), status=502)
    fe_repo.save_documento_enviado(
        no_cia, e_ncf, doc['tipo_ecf'], resultado['trackId'],
        doc['xml_firmado'], json.dumps(resultado['respuesta_cruda']),
        es_prueba=doc.get('es_prueba') or 'N')
    return JsonResponse({'trackId': resultado['trackId'],
                         'respuesta_dgii': resultado['respuesta_cruda']})


# AMBIENTE hardcodeado a 'certecf' a proposito (Task 5, modo test) -- NO se
# lee de TFE_CONFIG.ambiente de la cia. CORREGIDO 2026-09-17: el Set de
# Pruebas de certificacion (Paso 2 de la Postulacion) tiene que ir contra
# el ambiente de CERTIFICACION, no contra 'testecf' (Pre-Certificacion).
# El hardcode original a 'testecf' trataba ese ambiente con la misma
# cautela que produccion por error -- confirmado con la DGII (correo
# 2026-09-17, con captura de su propia herramienta de consulta interna
# filtrando por Ambiente) que el contador "Estado actual de las pruebas"
# del portal solo cuenta comprobantes enviados a 'certecf'; todo lo
# enviado a 'testecf' es aceptado por la API pero nunca cuenta para el
# avance de la Postulacion 81443. Ver Descripcion-Tecnica-Servicios-DGII.pdf
# p.7 ("Certificacion: ambiente que tiene por objetivo validar capacidades
# ... debiendo para ello agotar un conjunto de pruebas") -- es literalmente
# la descripcion de este paso. 'ecf' (produccion) sigue fuera de alcance.
_AMBIENTE_MODO_TEST = 'certecf'


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def pruebas_enviar_view(request):
    """Modo test del Set de Pruebas de certificacion DGII (Paso 2): arma el
    e-CF directo desde el payload plano que el operador copia de una fila
    de ``set-pruebas-130217432.xlsx`` (NO pasa por ``TFAT_FACTURA``), firma
    con la App oficial (via ``dgii_client.enviar_ecf`` -> ``firma.
    firmar_con_app_oficial``) y envia SIEMPRE contra ``testecf``.

    ``encf`` viene explicito en el body (columna ``ENCF``/``CasoPrueba`` del
    Excel) -- son e-NCF fijos que la propia DGII define para sus 25/29
    escenarios de prueba, NUNCA se llama aqui a
    ``fe_repo.consumir_siguiente_encf`` (eso quemaria numeracion real de
    ``TFE_SECUENCIA`` sobre datos de prueba, ver ``ecf_builder.
    construir_ecf_generico``).

    Se guarda en ``TFE_DOCUMENTO`` con ``es_prueba='S'`` siempre (nunca
    'N') para que estos envios de certificacion queden separados de la
    bitacora de facturacion real (Task 3/4).
    """
    try:
        data = json.loads(request.body or b'{}')
    except json.JSONDecodeError:
        return _err('JSON inválido')
    no_cia = data.get('no_cia')
    tipo_ecf_raw = data.get('tipo_ecf')
    encf = (data.get('encf') or '').strip().upper()
    datos = data.get('datos') if data.get('datos') is not None else {}
    if not no_cia or tipo_ecf_raw in (None, '') or not encf:
        return _err('no_cia, tipo_ecf y encf son requeridos')
    if not isinstance(datos, dict):
        return _err("'datos' debe ser un objeto JSON (columnas del Set de Pruebas)")
    try:
        tipo_ecf = int(tipo_ecf_raw)
    except (TypeError, ValueError):
        return _err('tipo_ecf debe ser un entero del catálogo TipoeCF '
                    '(31,32,33,34,41,43,44,45,46,47)')
    try:
        xml_sin_firmar = ecf_builder.construir_ecf_generico(tipo_ecf, encf, datos)
    except ecf_builder.ECFBuilderError as exc:
        return _err(str(exc))
    try:
        resultado = dgii_client.enviar_ecf(no_cia, _AMBIENTE_MODO_TEST, encf, xml_sin_firmar)
    except dgii_client.DgiiError as exc:
        return _err(str(exc), status=502)
    fe_repo.save_documento_enviado(
        no_cia, encf, str(tipo_ecf), resultado['trackId'],
        resultado['xml_firmado'], json.dumps(resultado['respuesta_cruda']),
        es_prueba='S')
    return JsonResponse({'trackId': resultado['trackId'],
                         'respuesta_dgii': resultado['respuesta_cruda']})


# e-NCF de tipo 32 que NO se envian por este endpoint -- van por RFCE
# (ver certificacion_paso2_rfce_view). Filtrado por convencion, no por
# monto real: en el Set de Pruebas de la DGII estas 4 filas SIEMPRE son
# las de "Facturas de consumo < 250Mil" (hoja RFCE del mismo Excel).
_RFCE_ENCFS_PASO2 = frozenset({
    'E320000000012', 'E320000000013', 'E320000000014', 'E320000000015',
})


def _leer_filas_excel(archivo, hoja: str) -> list[dict]:
    wb = openpyxl.load_workbook(archivo, data_only=True)
    if hoja not in wb.sheetnames:
        raise ValueError(f"El Excel no tiene una hoja '{hoja}'")
    ws = wb[hoja]
    filas = list(ws.iter_rows(values_only=True))
    if not filas:
        return []
    headers = filas[0]
    return [dict(zip(headers, r)) for r in filas[1:]]


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def certificacion_paso2_ecf_view(request):
    """Paso 2 de certificacion DGII (grupos "Primero"+"Segundo", 21
    escenarios): sube el Excel oficial completo (hoja ``ECF``) y envia
    CADA fila contra ``certecf`` -- version "bulk" de
    ``pruebas_enviar_view``, mismo codigo de construccion/envio, sin que
    el operador tenga que copiar filas a mano.

    Las 4 filas de Facturas de Consumo < 250Mil (``_RFCE_ENCFS_PASO2``) se
    saltan aqui -- van por ``certificacion_paso2_rfce_view``, servicio de
    Recepcion distinto (ver ``dgii_client.enviar_rfce``).
    """
    no_cia = request.POST.get('no_cia')
    archivo = request.FILES.get('archivo')
    if not no_cia:
        return _err('no_cia requerido')
    if not archivo:
        return _err('archivo (.xlsx) requerido')
    try:
        filas = _leer_filas_excel(archivo, 'ECF')
    except ValueError as exc:
        return _err(str(exc))

    resultados = []
    for row in filas:
        encf = row.get('ENCF')
        if not encf or encf in _RFCE_ENCFS_PASO2:
            continue
        try:
            tipo_ecf = int(row['TipoeCF'])
            xml_sin_firmar = ecf_builder.construir_ecf_generico(tipo_ecf, encf, row)
            resultado = dgii_client.enviar_ecf(no_cia, _AMBIENTE_MODO_TEST, encf, xml_sin_firmar)
        except (ecf_builder.ECFBuilderError, dgii_client.DgiiError, KeyError, ValueError) as exc:
            resultados.append({'encf': encf, 'ok': False, 'error': str(exc)})
            continue
        fe_repo.save_documento_enviado(
            no_cia, encf, str(tipo_ecf), resultado['trackId'],
            resultado['xml_firmado'], json.dumps(resultado['respuesta_cruda']),
            es_prueba='S')
        resultados.append({'encf': encf, 'ok': True, 'trackId': resultado['trackId']})

    return JsonResponse({'resultados': resultados})


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def certificacion_paso2_rfce_view(request):
    """Paso 2 de certificacion DGII (grupo "Tercero", las 4 Facturas de
    Consumo < RD$250,000): construye+firma el e-CF32 completo, deriva
    ``CodigoSeguridadeCF`` de SU FIRMA REAL (``ecf_builder.
    derivar_codigo_seguridad`` -- primeros 6 caracteres crudos del
    SignatureValue, NO un hash), arma+envia el RFCE, y devuelve el e-CF32
    YA FIRMADO en la respuesta para que el operador lo descargue y lo
    suba a mano en el widget "Facturas de consumo < 250Mil" del propio
    Portal de Certificacion (paso "Cuarto" -- no automatizable, es una
    accion de navegador en el sitio de la DGII, no un servicio REST).
    """
    no_cia = request.POST.get('no_cia')
    archivo = request.FILES.get('archivo')
    if not no_cia:
        return _err('no_cia requerido')
    if not archivo:
        return _err('archivo (.xlsx) requerido')
    try:
        filas_ecf = {r['ENCF']: r for r in _leer_filas_excel(archivo, 'ECF')
                     if r.get('ENCF') in _RFCE_ENCFS_PASO2}
        archivo.seek(0)
        filas_rfce = {r.get('ENCF') or r.get('CasoPrueba'): r
                      for r in _leer_filas_excel(archivo, 'RFCE')}
    except ValueError as exc:
        return _err(str(exc))

    resultados = []
    for encf, ecf_row in filas_ecf.items():
        rfce_row = filas_rfce.get(encf, ecf_row)
        try:
            ecf_sin_firmar = ecf_builder.construir_ecf_generico(32, encf, ecf_row)
            ecf_firmado, rnc_emisor = dgii_client._firmar_para_envio(no_cia, ecf_sin_firmar)
            codigo_seguridad = ecf_builder.derivar_codigo_seguridad(ecf_firmado)
            rfce_sin_firmar = ecf_builder.construir_rfce(encf, rfce_row, codigo_seguridad)
            resultado = dgii_client.enviar_rfce(no_cia, _AMBIENTE_MODO_TEST, encf, rfce_sin_firmar)
        except (ecf_builder.ECFBuilderError, dgii_client.DgiiError, KeyError, ValueError) as exc:
            resultados.append({'encf': encf, 'ok': False, 'error': str(exc)})
            continue
        resultados.append({
            'encf': encf,
            'ok': True,
            'estado_rfce': resultado['estado'],
            'codigo_seguridad': codigo_seguridad,
            'ecf32_firmado_xml': ecf_firmado,
            'nombre_archivo': f'{rnc_emisor}{encf}.xml',
        })

    return JsonResponse({'resultados': resultados})


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def certificacion_paso3_view(request):
    """Paso 3 de certificacion DGII (Aprobaciones Comerciales): sube el
    Excel que se descarga del Portal de Certificacion ("Descargar
    aprobaciones comerciales", hoja ``ACEECF_Generadas``) y envia cada
    fila TAL CUAL viene -- certecf exige los datos exactos del "conjunto
    de datos entregados", no hay que corregir RNCEmisor/RNCComprador aqui
    (a diferencia de lo que se penso al principio con RNCComprador en
    Paso 2, ver memoria del proyecto).
    """
    no_cia = request.POST.get('no_cia')
    archivo = request.FILES.get('archivo')
    if not no_cia:
        return _err('no_cia requerido')
    if not archivo:
        return _err('archivo (.xlsx) requerido')
    try:
        filas = _leer_filas_excel(archivo, 'ACEECF_Generadas')
    except ValueError as exc:
        return _err(str(exc))

    resultados = []
    for row in filas:
        encf = row.get('eNCF')
        if not encf:
            continue
        try:
            xml_sin_firmar = ecf_builder.construir_acecf(row)
            resultado = dgii_client.enviar_aprobacion_comercial(
                no_cia, _AMBIENTE_MODO_TEST, encf, str(row['RNCComprador']), xml_sin_firmar)
        except (ecf_builder.ECFBuilderError, dgii_client.DgiiError, KeyError, ValueError) as exc:
            resultados.append({'encf': encf, 'ok': False, 'error': str(exc)})
            continue
        resultados.append({
            'encf': encf, 'ok': True,
            'estado': resultado['estado'], 'codigo': resultado['codigo'],
        })

    return JsonResponse({'resultados': resultados})


_BUILDERS_DESDE_FACTURA = {31: 'construir_ecf_31', 32: 'construir_ecf_32'}


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def certificacion_paso4_factura_real_view(request):
    """Paso 4 de certificacion DGII (grupo "Primero", tipos 31/32): arma
    el e-CF desde una factura REAL ya emitida en TFAT_FACTURA (mismo
    pipeline de produccion de Fase 1, ``ecf_builder.construir_ecf_31/32``
    -- consume secuencia REAL de TFE_SECUENCIA, no reutilizable) y la
    envia contra ``certecf``. A diferencia del Paso 2, aqui NO hay Excel
    de la DGII: el operador elige que factura real usar.
    """
    no_cia = request.POST.get('no_cia')
    tipo_ecf_raw = request.POST.get('tipo_ecf')
    punto = request.POST.get('punto')
    tipo_factura = request.POST.get('tipo_factura')
    no_factura = request.POST.get('no_factura')
    if not no_cia:
        return _err('no_cia requerido')
    if not all([punto, tipo_factura, no_factura]):
        return _err('punto, tipo_factura y no_factura son requeridos')
    try:
        tipo_ecf = int(tipo_ecf_raw)
    except (TypeError, ValueError):
        return _err('tipo_ecf debe ser 31 o 32')
    builder_name = _BUILDERS_DESDE_FACTURA.get(tipo_ecf)
    if builder_name is None:
        return _err('tipo_ecf debe ser 31 (Credito Fiscal) o 32 (Consumo)')
    builder = getattr(ecf_builder, builder_name)
    try:
        xml_sin_firmar = builder(no_cia, punto, tipo_factura, no_factura)
    except ecf_builder.ECFBuilderError as exc:
        return _err(str(exc))
    # ecf_builder ya consumio la secuencia real dentro de xml_sin_firmar;
    # extraer el eNCF asignado para guardar la bitacora.
    m = re.search(r'<eNCF>([^<]+)</eNCF>', xml_sin_firmar)
    e_ncf = m.group(1) if m else None
    try:
        resultado = dgii_client.enviar_ecf(no_cia, _AMBIENTE_MODO_TEST, e_ncf, xml_sin_firmar)
    except dgii_client.DgiiError as exc:
        return _err(str(exc), status=502)
    fe_repo.save_documento_enviado(
        no_cia, e_ncf, str(tipo_ecf), resultado['trackId'],
        resultado['xml_firmado'], json.dumps(resultado['respuesta_cruda']),
        es_prueba='S')
    return JsonResponse({'ok': True, 'encf': e_ncf, 'trackId': resultado['trackId']})


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def certificacion_paso4_manual_view(request):
    """Paso 4 de certificacion DGII (grupo "Segundo": tipos 33/34; y el
    resto de "Primero" sin pipeline de produccion: 41/43/44/45/46/47).
    Mismo builder que Modo Test (``ecf_builder.construir_ecf_generico``,
    datos planos escritos a mano por el operador) pero, a diferencia de
    Modo Test, consume una secuencia REAL y no reutilizable de
    TFE_SECUENCIA (``fe_repo.consumir_siguiente_encf``) en vez de un
    e-NCF fijo -- el Paso 4 exige datos de operaciones reales, no el
    Set de Pruebas fijo de la DGII.

    Para tipo 34 (Nota de Credito), ``datos`` debe incluir
    ``NCFModificado`` con el e-NCF de un documento YA enviado en el
    grupo "Primero" (el operador lo copia del resultado de
    ``certificacion_paso4_factura_real_view``/otro envio manual previo).
    """
    try:
        data = json.loads(request.body or b'{}')
    except json.JSONDecodeError:
        return _err('JSON invalido')
    no_cia = data.get('no_cia')
    tipo_ecf_raw = data.get('tipo_ecf')
    datos = data.get('datos') if data.get('datos') is not None else {}
    if not no_cia or tipo_ecf_raw in (None, ''):
        return _err('no_cia y tipo_ecf son requeridos')
    if not isinstance(datos, dict):
        return _err("'datos' debe ser un objeto JSON")
    try:
        tipo_ecf = int(tipo_ecf_raw)
    except (TypeError, ValueError):
        return _err('tipo_ecf debe ser un entero del catalogo TipoeCF')
    try:
        secuencia = fe_repo.consumir_siguiente_encf(no_cia, tipo_ecf)
    except ValueError as exc:
        return _err(str(exc))
    e_ncf = secuencia['e_ncf']
    try:
        xml_sin_firmar = ecf_builder.construir_ecf_generico(tipo_ecf, e_ncf, datos)
    except ecf_builder.ECFBuilderError as exc:
        return _err(str(exc))
    try:
        resultado = dgii_client.enviar_ecf(no_cia, _AMBIENTE_MODO_TEST, e_ncf, xml_sin_firmar)
    except dgii_client.DgiiError as exc:
        return _err(str(exc), status=502)
    fe_repo.save_documento_enviado(
        no_cia, e_ncf, str(tipo_ecf), resultado['trackId'],
        resultado['xml_firmado'], json.dumps(resultado['respuesta_cruda']),
        es_prueba='S')
    return JsonResponse({'ok': True, 'encf': e_ncf, 'trackId': resultado['trackId']})
