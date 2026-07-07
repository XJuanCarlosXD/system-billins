"""API Facturación Electrónica: configuración por empresa (Fase 1).

Rutas:
  GET/PUT /api/fe/config/?no_cia=01
  POST    /api/fe/config/certificado/        (multipart: no_cia, password, certificado)
  POST    /api/fe/config/probar-conexion/
  GET/POST /api/fe/secuencias/?no_cia=01
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
