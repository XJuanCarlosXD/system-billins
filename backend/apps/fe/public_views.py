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

from apps.fe import crypto, firma, tokens
from apps.legacy.repositories import fe_repo

_RNC_RE = re.compile(r'\d{9,11}')


def _err(msg: str, status: int = 400) -> JsonResponse:
    return JsonResponse({'detail': str(msg)}, status=status)


def _arecf_firmado(no_cia: str, rnc_emisor: str, rnc_comprador: str,
                   e_ncf: str, estado: int = 0,
                   codigo_motivo: int | None = None) -> HttpResponse:
    """Acuse de Recibo (ARECF) firmado, formato oficial DGII v1.0.

    Hallazgo 75va corrida (2026-10-10): la respuesta `<RespuestaRecepcion>`
    de la "Descripcion-Tecnica-Servicios-DGII" es la que entrega la DGII
    cuando ELLA es receptor (sus endpoints `/recepcion/api/ecf`); el
    receptor terceo (nosotros) debe responder con `<ARECF>` según el
    "Formato Acuse de Recibo v1.0" oficial (`DetalleAcusedeRecibo` +
    Signature XMLDSig obligatoria). Root distinto, estructura distinta.
    """
    from datetime import datetime
    from xml.sax.saxutils import escape
    fecha = datetime.now().strftime('%d-%m-%Y %H:%M:%S')
    motivo = (f'<CodigoMotivoNoRecibido>{codigo_motivo}</CodigoMotivoNoRecibido>'
              if estado == 1 and codigo_motivo else '')
    xml_str = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<ARECF>'
        '<DetalleAcusedeRecibo>'
        '<Version>1.0</Version>'
        f'<RNCEmisor>{escape(rnc_emisor)}</RNCEmisor>'
        f'<RNCComprador>{escape(rnc_comprador)}</RNCComprador>'
        f'<eNCF>{escape(e_ncf)}</eNCF>'
        f'<Estado>{estado}</Estado>'
        f'{motivo}'
        f'<FechaHoraAcuseRecibo>{fecha}</FechaHoraAcuseRecibo>'
        '</DetalleAcusedeRecibo>'
        '</ARECF>'
    )
    cert = fe_repo.get_certificado(no_cia)
    if cert:
        try:
            p12_bytes, password_enc = cert
            password = crypto.decrypt(password_enc)
            xml_str = firma.firmar_xml(xml_str, p12_bytes, password)
        except Exception as exc:
            print(f'[ARECF] firma falló (sin firmar): {exc!r}', flush=True)
    return HttpResponse(xml_str, content_type='text/xml; charset=utf-8')


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
    import traceback, time as _t
    archivo = _archivo(request)
    if not archivo:
        print(f'[VALCERT] {_t.time()} sin archivo. files={list(request.FILES)} ct={request.content_type}', flush=True)
        return _err('Falta el archivo xml firmado')
    xml_bytes = archivo.read()
    try:
        with open(f'/tmp/valcert_{int(_t.time())}.xml', 'wb') as _f:
            _f.write(xml_bytes)
    except Exception:
        pass
    try:
        root = etree.fromstring(xml_bytes)
        valor = _texto(root, 'valor')
        if not valor or not tokens.validar_semilla(valor):
            print(f'[VALCERT] semilla inv: valor={valor!r} len_xml={len(xml_bytes)}', flush=True)
            return _err('Semilla inválida o expirada', 401)
        cert = firma.verificar_xml(xml_bytes)
    except Exception as exc:
        print(f'[VALCERT] firma invalida exc={exc!r}\n{traceback.format_exc()}', flush=True)
        return _err(f'Firma inválida: {exc}', 401)
    subject = cert.subject.rfc4514_string()
    match = _RNC_RE.search(subject)
    rnc = match.group(0) if match else subject[:20]
    token, exp = tokens.emitir_token(rnc)
    from datetime import datetime, timezone
    exp_iso = datetime.fromtimestamp(exp, tz=timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000')
    print(f'[VALCERT] OK rnc={rnc} exp={exp_iso}', flush=True)
    return JsonResponse({'token': token, 'expira': exp_iso, 'expiraEn': exp_iso, 'Token': token, 'Expira': exp_iso})


@csrf_exempt
@require_http_methods(['POST'])
def recepcion_view(request):
    rnc_bearer = _bearer_rnc(request)
    if not rnc_bearer:
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
    rnc_emisor = _texto(root, 'RNCEmisor') or rnc_bearer
    rnc_comprador = _texto(root, 'RNCComprador')
    cfg = fe_repo.get_config_por_rnc(rnc_comprador) if rnc_comprador else None
    if not cfg:
        return _err('RNCComprador no corresponde a ninguna empresa configurada', 404)
    track_id = uuid.uuid4().hex.upper()[:16]
    fe_repo.save_documento_recibido(
        no_cia=cfg['no_cia'], rnc_emisor=rnc_emisor, e_ncf=e_ncf,
        tipo='ECF', xml=xml_bytes.decode('utf-8', 'replace'),
        track_id=track_id)
    print(f'[ARECF] recepcion ok rnc_emisor_ecf={rnc_emisor} rnc_bearer={rnc_bearer} rnc_comprador={rnc_comprador} eNCF={e_ncf}', flush=True)
    return _arecf_firmado(cfg['no_cia'], rnc_emisor, rnc_comprador, e_ncf)


@csrf_exempt
@require_http_methods(['POST'])
def aprobacioncomercial_view(request):
    import time as _t
    rnc_bearer = _bearer_rnc(request)
    if not rnc_bearer:
        return _err('Token inválido, expirado o ausente', 401)
    archivo = _archivo(request)
    if not archivo:
        return _err('Falta el archivo de aprobación comercial')
    xml_bytes = archivo.read()
    try:
        with open(f'/tmp/acecf_{int(_t.time())}.xml', 'wb') as _f:
            _f.write(xml_bytes)
    except Exception:
        pass
    try:
        root = etree.fromstring(xml_bytes)
    except etree.XMLSyntaxError as exc:
        return _err(f'XML inválido: {exc}')
    e_ncf = _texto(root, 'eNCF') or archivo.name
    rnc_emisor_acecf = _texto(root, 'RNCEmisor')
    rnc_comprador_acecf = _texto(root, 'RNCComprador')
    # ACECF para un e-CF emitido por nosotros: RNCEmisor=nuestra empresa.
    # Fallback (Fase 3 style, nosotros como comprador): RNCComprador.
    cfg = (fe_repo.get_config_por_rnc(rnc_emisor_acecf) if rnc_emisor_acecf else None) \
        or (fe_repo.get_config_por_rnc(rnc_comprador_acecf) if rnc_comprador_acecf else None)
    if not cfg:
        print(f'[ARECF] aprobcom 404 rnc_emisor={rnc_emisor_acecf} rnc_comprador={rnc_comprador_acecf} rnc_bearer={rnc_bearer}', flush=True)
        return _err('No se pudo determinar la empresa destino', 404)
    track_id = uuid.uuid4().hex.upper()[:16]
    fe_repo.save_documento_recibido(
        no_cia=cfg['no_cia'], rnc_emisor=rnc_emisor_acecf or rnc_bearer, e_ncf=e_ncf,
        tipo='ACECF', xml=xml_bytes.decode('utf-8', 'replace'),
        track_id=track_id)
    print(f'[ARECF] aprobcom ok rnc_emisor={rnc_emisor_acecf} rnc_comprador={rnc_comprador_acecf} rnc_bearer={rnc_bearer} eNCF={e_ncf}', flush=True)
    return _arecf_firmado(cfg['no_cia'], rnc_emisor_acecf or rnc_bearer,
                          rnc_comprador_acecf or rnc_bearer, e_ncf)
