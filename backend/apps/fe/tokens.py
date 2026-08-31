"""Semillas y tokens para el flujo peer-to-peer de recepción e-CF.

Distinto de FAT.TFE_TOKEN (el token que la DGII nos entrega a NOSOTROS como
emisores, cacheado en Oracle). Aquí emitimos y validamos los tokens que
OTROS emisores electrónicos usan para autenticarse contra nuestros propios
endpoints de recepción/aprobación comercial. Son auto-contenidos
(HMAC-SHA256 derivado de SECRET_KEY) para no requerir tabla ni estado.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

from django.conf import settings

SEMILLA_TTL = 300   # segundos para firmar y devolver la semilla
TOKEN_TTL = 3600    # vigencia del token emitido a un emisor par


def _key() -> bytes:
    return hashlib.sha256(f'{settings.SECRET_KEY}:fe-peer'.encode()).digest()


def _sign(payload: bytes) -> str:
    mac = hmac.new(_key(), payload, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(mac).decode().rstrip('=')


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip('=')


def _unb64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + '=' * (-len(data) % 4))


def generar_semilla() -> str:
    """XML de semilla con expiración auto-verificable (sin persistencia)."""
    payload = str(int(time.time())).encode()
    valor = f'{payload.decode()}.{_sign(payload)}'
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        f'<SemillaModel><valor>{valor}</valor></SemillaModel>'
    )


def validar_semilla(valor: str) -> bool:
    try:
        ts_str, firma = (valor or '').rsplit('.', 1)
    except ValueError:
        return False
    if not hmac.compare_digest(_sign(ts_str.encode()), firma):
        return False
    return (time.time() - int(ts_str)) <= SEMILLA_TTL


def emitir_token(rnc: str) -> tuple[str, int]:
    exp = int(time.time()) + TOKEN_TTL
    payload = json.dumps({'rnc': rnc, 'exp': exp}).encode()
    return f'{_b64(payload)}.{_sign(payload)}', exp


def validar_token(token: str) -> str | None:
    """Devuelve el RNC del portador si el token es válido, o None."""
    try:
        payload_b64, firma = (token or '').split('.', 1)
        payload = _unb64(payload_b64)
    except Exception:
        return None
    if not hmac.compare_digest(_sign(payload), firma):
        return None
    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        return None
    if data.get('exp', 0) < time.time():
        return None
    return data.get('rnc')
