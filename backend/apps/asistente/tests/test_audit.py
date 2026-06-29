"""Tests de auditoria (Task 7).

- dispatch_tool con audit_ctx escribe via audit sink.
- args_hash deterministico y trunca preview a 480 chars.
- AuditoriaView gateada por is_dba (403 si no, 200 si si).
- expire_pending management cmd marca filas viejas como 'X'.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest


# ---------------------------------------------------------------------------
# Sink stub para tests.
# ---------------------------------------------------------------------------


class _SinkStub:
    def __init__(self):
        self.rows: list[dict] = []

    def __call__(self, row: dict) -> None:
        self.rows.append(row)


@pytest.mark.asyncio
async def test_dispatch_tool_invokes_audit_sink_on_success(monkeypatch):
    from apps.asistente import agent_loop, audit
    from apps.asistente.tools import registry as reg

    async def _h(**_):
        return {"ok": True, "rows": [1, 2, 3]}

    reg.register_tool(reg.ToolSpec(
        name="zz_audit_ok",
        description="x",
        input_schema={"type": "object"},
        handler=_h,
    ))

    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {},
    )

    sink = _SinkStub()
    monkeypatch.setattr(audit, "log_tool_call", sink)

    user = SimpleNamespace(username="ZZTEST")
    ctx = {"conv_id": "c1", "mensaje_id": "m1", "confirmed_by": None}
    res = await agent_loop.dispatch_tool(
        user, "zz_audit_ok", {"foo": "bar"}, audit_ctx=ctx,
    )
    assert res.ok is True
    assert len(sink.rows) == 1
    row = sink.rows[0]
    assert row["usuario"] == "ZZTEST"
    assert row["tool_name"] == "zz_audit_ok"
    assert row["ok"] == "S"
    assert row["was_write"] == "N"
    assert row["conv_id"] == "c1"
    assert row["mensaje_id"] == "m1"
    assert "args_hash" in row
    # Hash determinista sobre el args canonicalizado.
    expected = hashlib.sha256(
        json.dumps({"foo": "bar"}, sort_keys=True).encode("utf-8")
    ).hexdigest()
    assert row["args_hash"] == expected


@pytest.mark.asyncio
async def test_dispatch_tool_audits_failure_with_error_code(monkeypatch):
    from apps.asistente import agent_loop, audit
    from apps.asistente.tools import registry as reg

    reg.register_tool(reg.ToolSpec(
        name="zz_audit_fail_cia",
        description="x",
        input_schema={"type": "object"},
        handler=lambda **_: None,
        modules_required=["FAT"],
    ))

    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {"FAT": "S"},
    )
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.user_has_cia",
        lambda u, c: False,
    )

    sink = _SinkStub()
    monkeypatch.setattr(audit, "log_tool_call", sink)

    user = SimpleNamespace(username="ZZTEST")
    res = await agent_loop.dispatch_tool(
        user, "zz_audit_fail_cia", {"no_cia": "99"},
        audit_ctx={"conv_id": "c1", "mensaje_id": "m1"},
    )
    assert res.ok is False
    assert res.error_code == "FORBIDDEN_CIA"
    assert len(sink.rows) == 1
    assert sink.rows[0]["ok"] == "N"
    assert sink.rows[0]["error_code"] == "FORBIDDEN_CIA"


@pytest.mark.asyncio
async def test_dispatch_tool_works_without_audit_ctx(monkeypatch):
    """audit_ctx es opcional: sin ctx, no se llama al sink, tool corre OK."""
    from apps.asistente import agent_loop, audit
    from apps.asistente.tools import registry as reg

    async def _h(**_):
        return {"ok": True}

    reg.register_tool(reg.ToolSpec(
        name="zz_audit_no_ctx",
        description="x",
        input_schema={"type": "object"},
        handler=_h,
    ))
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {},
    )

    sink = _SinkStub()
    monkeypatch.setattr(audit, "log_tool_call", sink)

    user = SimpleNamespace(username="ZZTEST")
    res = await agent_loop.dispatch_tool(user, "zz_audit_no_ctx", {})
    assert res.ok is True
    assert sink.rows == []


def test_auditoria_view_forbidden_for_non_dba(monkeypatch, mock_user):
    from rest_framework.test import APIClient

    monkeypatch.setattr(
        "apps.legacy.repositories.users_repo.is_dba",
        lambda u: False,
    )
    client = APIClient()
    client.force_authenticate(mock_user)
    resp = client.get("/api/admin/asistente/auditoria/")
    assert resp.status_code == 403


def test_auditoria_view_ok_for_dba_returns_aggregates(monkeypatch, mock_user):
    from rest_framework.test import APIClient

    monkeypatch.setattr(
        "apps.legacy.repositories.users_repo.is_dba",
        lambda u: True,
    )
    monkeypatch.setattr(
        "apps.asistente.audit.fetch_aggregates",
        lambda **kw: {
            "by_user": [{"usuario": "X", "calls": 3, "errors": 0}],
            "by_tool": [{"tool_name": "fat_buscar_cliente", "calls": 3}],
            "by_day": [{"dia": "2026-06-29", "calls": 3}],
            "totals": {"calls": 3, "errors": 0, "avg_ms": 120},
        },
    )

    client = APIClient()
    client.force_authenticate(mock_user)
    resp = client.get("/api/admin/asistente/auditoria/")
    assert resp.status_code == 200
    body = resp.json()
    assert "by_user" in body
    assert "by_tool" in body
    assert "by_day" in body
    assert body["totals"]["calls"] == 3


def test_expire_pending_marks_expired_rows(monkeypatch):
    """La logica de expiracion: filas con STATUS='P' y FECHA_EXPIRA<SYSDATE -> 'X'."""
    from apps.asistente import audit

    calls: list[tuple[str, list]] = []

    class FakeCursor:
        def __enter__(self): return self
        def __exit__(self, *a): return None
        def execute(self, sql, params=None):
            calls.append((sql, params or []))
            self.rowcount = 4
        @property
        def connection(self):
            return SimpleNamespace(commit=lambda: calls.append(("COMMIT", [])))

    class FakeClient:
        @staticmethod
        def cursor():
            return FakeCursor()

    monkeypatch.setattr("apps.legacy.client.cursor", FakeClient.cursor)

    n = audit.expire_pending()
    assert n == 4
    sql_executed = calls[0][0]
    assert "TCHAT_TOOL_PENDING" in sql_executed
    assert "STATUS" in sql_executed
    assert "FECHA_EXPIRA" in sql_executed
