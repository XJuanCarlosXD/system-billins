"""Cliente de los servicios web de la DGII (facturación electrónica).

Fase 1: autenticación semilla→firma→token con cache en TFE_TOKEN.
Fase 2 añadirá recepción de e-CF, consulta de resultados y RFCE.
"""
from __future__ import annotations

from datetime import datetime, timedelta

import requests

from apps.fe import crypto, firma
from apps.legacy.repositories import fe_repo

AMBIENTES = ('testecf', 'certecf', 'ecf')
BASE = 'https://ecf.dgii.gov.do/{amb}'
TIMEOUT = 30


class DgiiError(Exception):
    pass


def _base(ambiente: str) -> str:
    if ambiente not in AMBIENTES:
        raise DgiiError(f'Ambiente inválido: {ambiente}')
    return BASE.format(amb=ambiente)


def obtener_semilla(ambiente: str) -> str:
    r = requests.get(
        f'{_base(ambiente)}/autenticacion/api/autenticacion/semilla',
        timeout=TIMEOUT)
    if r.status_code != 200:
        raise DgiiError(f'Semilla HTTP {r.status_code}: {r.text[:300]}')
    return r.text


def obtener_token(no_cia: str, ambiente: str, forzar: bool = False) -> str:
    """Token vigente para la cía (cacheado en TFE_TOKEN)."""
    if not forzar:
        cached = fe_repo.get_token(no_cia, ambiente)
        if cached:
            return cached

    cert = fe_repo.get_certificado(no_cia)
    if not cert:
        raise DgiiError('La empresa no tiene certificado digital cargado')
    p12_bytes, password_enc = cert
    password = crypto.decrypt(password_enc)

    semilla = obtener_semilla(ambiente)
    semilla_firmada = firma.firmar_xml(semilla, p12_bytes, password)

    r = requests.post(
        f'{_base(ambiente)}/autenticacion/api/autenticacion/validarsemilla',
        files={'xml': ('semilla.xml', semilla_firmada.encode('utf-8'),
                       'text/xml')},
        timeout=TIMEOUT)
    if r.status_code != 200:
        raise DgiiError(f'ValidarSemilla HTTP {r.status_code}: {r.text[:300]}')
    try:
        data = r.json()
    except ValueError:
        raise DgiiError(f'Respuesta no JSON de la DGII: {r.text[:300]}')
    token = data.get('token')
    if not token:
        raise DgiiError(f'Respuesta sin token: {str(data)[:300]}')
    expira = _parse_fecha(data.get('expira')) or (
        datetime.now() + timedelta(minutes=55))
    fe_repo.save_token(no_cia, ambiente, token, expira)
    return token


def _parse_fecha(valor) -> datetime | None:
    if not valor:
        return None
    texto = str(valor)
    for fmt in ('%Y-%m-%dT%H:%M:%S.%f', '%Y-%m-%dT%H:%M:%S',
                '%m/%d/%Y %I:%M:%S %p'):
        try:
            return datetime.strptime(texto[:26], fmt)
        except ValueError:
            continue
    return None


def probar_conexion(no_cia: str, ambiente: str) -> dict:
    """Semilla→firma→token de punta a punta. Devuelve dict apto para la UI."""
    token = obtener_token(no_cia, ambiente, forzar=True)
    return {'ok': True, 'ambiente': ambiente,
            'token_preview': token[:24] + '…',
            'mensaje': 'Autenticación exitosa contra la DGII'}
