"""Auditoria de uso del MCP en TMCP_TOKEN_USO.

Adaptado a apps.legacy.client + binding :N (Oracle real). Django default DB
es SQLite asi que NO usamos django.db.connection aqui (consistente con
apps.mcp.tokens).
"""
import hashlib
import json
from typing import Optional

from apps.legacy import client as oracle


def hash_params(params: dict) -> str:
    encoded = json.dumps(params, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def log_usage(
    *,
    token_id: str,
    tool: str,
    params_hash: Optional[str],
    ip: Optional[str],
    ok: bool,
    error_code: Optional[str],
    duration_ms: int,
) -> None:
    oracle.execute(
        """
        INSERT INTO ABREGONZA.TMCP_TOKEN_USO
          (USO_ID, TOKEN_ID, TOOL, PARAMS_HASH, IP, OK, ERROR_CODE, DURATION_MS)
        VALUES
          (ABREGONZA.SQ_TMCP_TOKEN_USO.NEXTVAL, :1, :2, :3, :4, :5, :6, :7)
        """,
        [
            token_id, tool, params_hash, (ip[:45] if ip else None),
            "S" if ok else "N", error_code, duration_ms,
        ],
    )
