"""Auditoria de tool calls del asistente.

- `log_tool_call(row)`: INSERT en ABREGONZA.TCHAT_TOOL_LOG. Tolerante a errores:
  si el INSERT falla (DB down, schema mismatch), loguea y sigue; no rompe la
  tool ni el agent loop.
- `make_row(...)`: helper para componer el dict que `log_tool_call` consume.
- `fetch_aggregates(...)`: agregados por usuario / tool / dia para la
  AuditoriaView.
- `expire_pending()`: marca filas TCHAT_TOOL_PENDING expiradas como 'X'.
  Pensado para ser invocado por cron o `manage.py asistente_expire_pending`.
"""

from __future__ import annotations

import hashlib
import json
import logging
import uuid
from datetime import datetime
from typing import Any

logger = logging.getLogger("apps.asistente.audit")


# ---------------------------------------------------------------------------
# Insert por llamada.
# ---------------------------------------------------------------------------


def args_hash(args: dict[str, Any]) -> str:
    """SHA256 deterministico sobre el JSON canonical de args."""
    try:
        payload = json.dumps(args or {}, sort_keys=True, default=str)
    except Exception:  # noqa: BLE001
        payload = repr(args)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def make_row(
    *,
    usuario: str,
    tool_name: str,
    args: dict[str, Any],
    preview: str,
    ok: bool,
    duration_ms: int,
    was_write: bool,
    error_code: str = "",
    conv_id: str | None = None,
    mensaje_id: str | None = None,
    no_cia: str | None = None,
    punto: str | None = None,
    confirmed_by: str | None = None,
) -> dict[str, Any]:
    return {
        "log_id": str(uuid.uuid4()),
        "usuario": (usuario or "").upper()[:30],
        "tool_name": tool_name[:60],
        "args_hash": args_hash(args),
        "args_preview": (preview or "")[:480],
        "ok": "S" if ok else "N",
        "error_code": (error_code or "")[:40] or None,
        "duration_ms": int(duration_ms) if duration_ms else 0,
        "was_write": "S" if was_write else "N",
        "conv_id": conv_id,
        "mensaje_id": mensaje_id,
        "no_cia": no_cia,
        "punto": punto,
        "confirmed_by": (confirmed_by or "").upper()[:30] or None,
    }


def log_tool_call(row: dict[str, Any]) -> None:
    """Inserta en TCHAT_TOOL_LOG. Best-effort: nunca propaga excepciones."""
    try:
        from apps.legacy import client  # local import (evita ciclos en tests)
    except Exception:  # noqa: BLE001
        return
    try:
        with client.cursor() as cur:
            cur.execute(
                "INSERT INTO ABREGONZA.TCHAT_TOOL_LOG ("
                "  LOG_ID, CONV_ID, MENSAJE_ID, USUARIO, NO_CIA, PUNTO, "
                "  TOOL_NAME, ARGS_HASH, ARGS_PREVIEW, OK, ERROR_CODE, "
                "  DURATION_MS, WAS_WRITE, CONFIRMED_BY, FECHA"
                ") VALUES ("
                "  :1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12, :13, "
                "  :14, SYSDATE"
                ")",
                [
                    row["log_id"], row.get("conv_id"), row.get("mensaje_id"),
                    row["usuario"], row.get("no_cia"), row.get("punto"),
                    row["tool_name"], row.get("args_hash"),
                    row.get("args_preview"),
                    row["ok"], row.get("error_code"),
                    row.get("duration_ms"), row.get("was_write"),
                    row.get("confirmed_by"),
                ],
            )
            cur.connection.commit()
    except Exception as exc:  # noqa: BLE001
        logger.warning("TCHAT_TOOL_LOG insert failed: %s", exc)


# ---------------------------------------------------------------------------
# Agregados para AuditoriaView.
# ---------------------------------------------------------------------------


def fetch_aggregates(
    *, days: int = 7, no_cia: str | None = None,
) -> dict[str, Any]:
    """Devuelve agregados de TCHAT_TOOL_LOG en los ultimos `days` dias.

    Forma:
        {
          "by_user": [{usuario, calls, errors, writes, avg_ms}, ...],
          "by_tool": [{tool_name, calls, errors, writes}, ...],
          "by_day":  [{dia, calls, errors}, ...],
          "totals":  {calls, errors, writes, avg_ms},
        }
    """
    from apps.legacy import client

    base_where = "FECHA >= SYSDATE - :days"
    params: list[Any] = [days]
    if no_cia:
        base_where += " AND NO_CIA = :no_cia"
        params.append(no_cia)

    by_user = client.fetch_dicts(
        f"SELECT USUARIO AS usuario, COUNT(*) AS calls, "
        f"       SUM(CASE WHEN OK='N' THEN 1 ELSE 0 END) AS errors, "
        f"       SUM(CASE WHEN WAS_WRITE='S' THEN 1 ELSE 0 END) AS writes, "
        f"       ROUND(AVG(DURATION_MS),0) AS avg_ms "
        f"FROM ABREGONZA.TCHAT_TOOL_LOG WHERE {base_where} "
        f"GROUP BY USUARIO ORDER BY calls DESC",
        params,
    )
    by_tool = client.fetch_dicts(
        f"SELECT TOOL_NAME AS tool_name, COUNT(*) AS calls, "
        f"       SUM(CASE WHEN OK='N' THEN 1 ELSE 0 END) AS errors, "
        f"       SUM(CASE WHEN WAS_WRITE='S' THEN 1 ELSE 0 END) AS writes "
        f"FROM ABREGONZA.TCHAT_TOOL_LOG WHERE {base_where} "
        f"GROUP BY TOOL_NAME ORDER BY calls DESC",
        params,
    )
    by_day = client.fetch_dicts(
        f"SELECT TO_CHAR(TRUNC(FECHA),'YYYY-MM-DD') AS dia, "
        f"       COUNT(*) AS calls, "
        f"       SUM(CASE WHEN OK='N' THEN 1 ELSE 0 END) AS errors "
        f"FROM ABREGONZA.TCHAT_TOOL_LOG WHERE {base_where} "
        f"GROUP BY TRUNC(FECHA) ORDER BY TRUNC(FECHA) DESC",
        params,
    )
    totals_rows = client.fetch_dicts(
        f"SELECT COUNT(*) AS calls, "
        f"       SUM(CASE WHEN OK='N' THEN 1 ELSE 0 END) AS errors, "
        f"       SUM(CASE WHEN WAS_WRITE='S' THEN 1 ELSE 0 END) AS writes, "
        f"       ROUND(AVG(DURATION_MS),0) AS avg_ms "
        f"FROM ABREGONZA.TCHAT_TOOL_LOG WHERE {base_where}",
        params,
    )
    totals = totals_rows[0] if totals_rows else {
        "calls": 0, "errors": 0, "writes": 0, "avg_ms": 0,
    }
    return {
        "by_user": by_user,
        "by_tool": by_tool,
        "by_day": by_day,
        "totals": totals,
    }


# ---------------------------------------------------------------------------
# Expiracion de TCHAT_TOOL_PENDING.
# ---------------------------------------------------------------------------


def expire_pending() -> int:
    """Marca STATUS='X' para filas pending vencidas. Devuelve nro de filas."""
    from apps.legacy import client

    n = 0
    with client.cursor() as cur:
        cur.execute(
            "UPDATE ABREGONZA.TCHAT_TOOL_PENDING "
            "SET STATUS='X', FECHA_RESUELTA=SYSDATE "
            "WHERE STATUS='P' AND FECHA_EXPIRA < SYSDATE"
        )
        n = int(getattr(cur, "rowcount", 0) or 0)
        cur.connection.commit()
    return n
