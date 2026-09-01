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
"""
from __future__ import annotations

import json

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.fe import crypto, dgii_client, firma
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
