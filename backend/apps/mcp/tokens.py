"""Generacion, hash y validacion de tokens MCP.

Formato: mcp_<prefijo8>_<random32>. Solo el SHA-256 del plaintext se persiste.

Acceso Oracle via apps.legacy.client (binding :1, :2, ...). Django default DB es
SQLite, asi que NO usamos django.db.connection aqui.
"""
from __future__ import annotations

import hashlib
import re
import secrets
import time
import uuid
from dataclasses import dataclass
from typing import Optional

from django.conf import settings

from apps.legacy import client as oracle


_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
_TOKEN_RE = re.compile(r"^mcp_([a-zA-Z0-9]{8})_([a-zA-Z0-9]{32})$")


def _rand(n: int) -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(n))


def generate_token_plaintext() -> tuple[str, str]:
    prefijo = _rand(8)
    body = _rand(32)
    return f"mcp_{prefijo}_{body}", prefijo


def hash_token(plaintext: str) -> str:
    return hashlib.sha256(plaintext.encode("utf-8")).hexdigest()


def extract_prefix(plaintext: str) -> Optional[str]:
    if not plaintext:
        return None
    m = _TOKEN_RE.match(plaintext)
    return m.group(1) if m else None


@dataclass
class TokenContext:
    token_id: str
    usuario: str
    no_cia: Optional[str]
    bloquear_cia: bool
    punto: Optional[str]
    bloquear_punto: bool
    fecha_expira: Optional[str]


_CACHE: dict[str, tuple[float, Optional[TokenContext]]] = {}


def _cache_get(key: str) -> Optional[TokenContext]:
    now = time.time()
    v = _CACHE.get(key)
    if v is None:
        return None
    expires, ctx = v
    if now > expires:
        _CACHE.pop(key, None)
        return None
    return ctx


def _cache_put(key: str, ctx: Optional[TokenContext]) -> None:
    ttl = getattr(settings, "MCP_TOKEN_CACHE_TTL", 60)
    _CACHE[key] = (time.time() + ttl, ctx)


def lookup_token(plaintext: str) -> Optional[TokenContext]:
    """Resuelve un Bearer plaintext a TokenContext, None si invalido/expirado/revocado."""
    prefijo = extract_prefix(plaintext)
    if prefijo is None:
        return None
    h = hash_token(plaintext)

    cached = _cache_get(h)
    if cached is not None:
        return cached

    row = oracle.fetch_one(
        """
        SELECT TOKEN_ID, USUARIO, NO_CIA, BLOQUEAR_CIA, PUNTO, BLOQUEAR_PUNTO,
               TO_CHAR(FECHA_EXPIRA, 'YYYY-MM-DD"T"HH24:MI:SS')
          FROM ABREGONZA.TMCP_TOKEN
         WHERE PREFIJO = :1
           AND TOKEN_HASH = :2
           AND ST_ACTIVO = 'S'
           AND (FECHA_EXPIRA IS NULL OR FECHA_EXPIRA > SYSDATE)
        """,
        [prefijo, h],
    )

    if row is None:
        _cache_put(h, None)
        return None

    ctx = TokenContext(
        token_id=row[0],
        usuario=row[1],
        no_cia=row[2],
        bloquear_cia=row[3] == "S",
        punto=row[4],
        bloquear_punto=row[5] == "S",
        fecha_expira=row[6],
    )
    _cache_put(h, ctx)
    return ctx


def touch_token(token_id: str, ip: Optional[str]) -> None:
    """Actualiza FECHA_ULTIMO_USO y IP_ULTIMO_USO. Best-effort."""
    oracle.execute(
        """
        UPDATE ABREGONZA.TMCP_TOKEN
           SET FECHA_ULTIMO_USO = SYSDATE, IP_ULTIMO_USO = :1
         WHERE TOKEN_ID = :2
        """,
        [ip[:45] if ip else None, token_id],
    )


def invalidate_cache(token_hash: Optional[str] = None) -> None:
    if token_hash is None:
        _CACHE.clear()
    else:
        _CACHE.pop(token_hash, None)


def create_token_row(
    *,
    usuario: str,
    nombre: str,
    no_cia: Optional[str],
    bloquear_cia: bool,
    punto: Optional[str],
    bloquear_punto: bool,
    fecha_expira_iso: Optional[str],
    creado_por: str,
) -> tuple[str, str]:
    """Inserta una fila en TMCP_TOKEN. Devuelve (token_id, plaintext)."""
    token_id = str(uuid.uuid4())
    plaintext, prefijo = generate_token_plaintext()
    token_hash = hash_token(plaintext)

    oracle.execute(
        """
        INSERT INTO ABREGONZA.TMCP_TOKEN
          (TOKEN_ID, USUARIO, NO_CIA, BLOQUEAR_CIA, PUNTO, BLOQUEAR_PUNTO,
           NOMBRE, TOKEN_HASH, PREFIJO, FECHA_EXPIRA, ST_ACTIVO, CREADO_POR)
        VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9,
                TO_DATE(:10, 'YYYY-MM-DD"T"HH24:MI:SS'), 'S', :11)
        """,
        [
            token_id, usuario, no_cia, "S" if bloquear_cia else "N",
            punto, "S" if bloquear_punto else "N",
            nombre, token_hash, prefijo, fecha_expira_iso, creado_por,
        ],
    )
    return token_id, plaintext


def revoke_token(token_id: str) -> bool:
    rc = oracle.execute(
        "UPDATE ABREGONZA.TMCP_TOKEN SET ST_ACTIVO='N' WHERE TOKEN_ID=:1",
        [token_id],
    )
    return rc > 0
