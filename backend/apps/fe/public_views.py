"""Endpoints públicos e-CF: recepción, aprobación comercial y autenticación
peer-to-peer, para OTROS emisores electrónicos que envían documentos donde
la empresa configurada aquí es el receptor/comprador (arquitectura P2P del
e-CF dominicano — el directorio de receptores de la DGII apunta a estas
URLs, no a la DGII misma).

Distinto de apps.fe.views (API interna de configuración de ZentoryERP,
autenticada con sesión Django). Estos son endpoints públicos, sin login,
protegidos por el flujo propio semilla→firma→token (ver apps.fe.tokens).
Montados en la raíz `/fe/...` (no bajo `/api/fe/...`) porque el formulario
de postulación de la DGII exige esa ruta fija.
"""
from __future__ import annotations

import re
import uuid

from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from lxml import etree

from apps.fe import firma, tokens
from apps.legacy.repositories import fe_repo

_RNC_RE = re.compile(r'\d{9,11}')


def _err(msg: str, status: int = 400) -> JsonResponse:
    return JsonResponse({'detail': str(msg)}, status=status)


def _archivo(request):
    return next(iter(request.FILES.values()), None)


def _texto(root, tag: str) -> str | None:
    for el in root.iter():
        if etree.QName(el).localname == tag and el.text:
            return el.text.strip()
    return None


def _bearer_rnc(request) -> str | None:
    auth = request.headers.get('Authorization', '')
    if not auth.startswith('Bearer '):
        return None
    return tokens.validar_token(auth[len('Bearer '):].strip())


@csrf_exempt
@require_http_methods(['GET'])
def semilla_view(request):
    return HttpResponse(tokens.generar_semilla(), content_type='text/xml')


@csrf_exempt
@require_http_methods(['POST'])
def validacioncertificado_view(request):
    archivo = _archivo(request)
    if not archivo:
        return _err('Falta el archivo xml firmado')
    xml_bytes = archivo.read()
    try:
        root = etree.fromstring(xml_bytes)
        valor = _texto(root, 'valor')
        if not valor or not tokens.validar_semilla(valor):
            return _err('Semilla inválida o expirada', 401)
        cert = firma.verificar_xml(xml_bytes)
    except Exception as exc:
        return _err(f'Firma inválida: {exc}', 401)
    subject = cert.subject.rfc4514_string()
    match = _RNC_RE.search(subject)
    rnc = match.group(0) if match else subject[:20]
    token, exp = tokens.emitir_token(rnc)
    return JsonResponse({'token': token, 'expira': exp})


@csrf_exempt
@require_http_methods(['POST'])
def recepcion_view(request):
    rnc_emisor = _bearer_rnc(request)
    if not rnc_emisor:
        return _err('Token inválido, expirado o ausente', 401)
    archivo = _archivo(request)
    if not archivo:
        return _err('Falta el archivo del e-CF')
    xml_bytes = archivo.read()
    try:
        root = etree.fromstring(xml_bytes)
    except etree.XMLSyntaxError as exc:
        return _err(f'XML inválido: {exc}')
    e_ncf = _texto(root, 'eNCF') or archivo.name
    rnc_comprador = _texto(root, 'RNCComprador')
    cfg = fe_repo.get_config_por_rnc(rnc_comprador) if rnc_comprador else None
    if not cfg:
        return _err('RNCComprador no corresponde a ninguna empresa configurada', 404)
    track_id = uuid.uuid4().hex.upper()[:16]
    fe_repo.save_documento_recibido(
        no_cia=cfg['no_cia'], rnc_emisor=rnc_emisor, e_ncf=e_ncf,
        tipo='ECF', xml=xml_bytes.decode('utf-8', 'replace'),
        track_id=track_id)
    return JsonResponse({'trackId': track_id})


@csrf_exempt
@require_http_methods(['POST'])
def aprobacioncomercial_view(request):
    rnc_emisor = _bearer_rnc(request)
    if not rnc_emisor:
        return _err('Token inválido, expirado o ausente', 401)
    archivo = _archivo(request)
    if not archivo:
        return _err('Falta el archivo de aprobación comercial')
    xml_bytes = archivo.read()
    try:
        root = etree.fromstring(xml_bytes)
    except etree.XMLSyntaxError as exc:
        return _err(f'XML inválido: {exc}')
    e_ncf = _texto(root, 'eNCF') or archivo.name
    rnc_destino = _texto(root, 'RNCComprador') or _texto(root, 'RNCEmisor')
    cfg = fe_repo.get_config_por_rnc(rnc_destino) if rnc_destino else None
    if not cfg:
        return _err('No se pudo determinar la empresa destino', 404)
    track_id = uuid.uuid4().hex.upper()[:16]
    fe_repo.save_documento_recibido(
        no_cia=cfg['no_cia'], rnc_emisor=rnc_emisor, e_ncf=e_ncf,
        tipo='ACECF', xml=xml_bytes.decode('utf-8', 'replace'),
        track_id=track_id)
    return JsonResponse({'trackId': track_id})
