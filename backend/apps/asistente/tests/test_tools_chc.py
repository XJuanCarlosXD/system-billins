"""Tests de tools CHC (read)."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

# side-effect: registra las tools.
from apps.asistente.tools import chc as _chc  # noqa: F401
from apps.asistente.tools.registry import REGISTRY


def test_chc_tools_registered():
    expected_read = {
        "chc_listar_cuentas", "chc_listar_cheques",
        "chc_rep_disponibilidad", "chc_rep_movimientos",
    }
    expected_write = {"chc_conciliar_bulk", "chc_cierre_conciliacion"}
    assert expected_read.issubset(REGISTRY.keys())
    assert expected_write.issubset(REGISTRY.keys())
    for n in expected_read:
        assert REGISTRY[n].modules_required == ["CHC"]
        assert REGISTRY[n].write is False
    for n in expected_write:
        assert REGISTRY[n].modules_required == ["CHC"]
        assert REGISTRY[n].write is True


@pytest.mark.asyncio
async def test_chc_listar_cheques_dispatches(monkeypatch):
    from apps.asistente import agent_loop
    from apps.legacy.repositories import chc_repo

    seen: dict = {}

    def fake(**kw):
        seen.update(kw)
        return [{"no_docu": "0000001", "valor_original": 100}]

    monkeypatch.setattr(chc_repo, "list_cheques", fake)
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {"CHC": "S"},
    )
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.user_has_cia", lambda u, c: True,
    )

    user = SimpleNamespace(username="JCABREU")
    res = await agent_loop.dispatch_tool(
        user, "chc_listar_cheques",
        {"no_cia": "01", "status": "A", "limit": 50},
    )
    assert res.ok is True
    assert seen["no_cia"] == "01"
    assert seen["status"] == "A"
    assert seen["limit"] == 50
    assert res.data[0]["no_docu"] == "0000001"


@pytest.mark.asyncio
async def test_chc_conciliar_bulk_dispatches(monkeypatch):
    from apps.asistente import agent_loop
    from apps.legacy.repositories import chc_repo

    seen: dict = {}

    def fake_bulk(**kw):
        seen.update(kw)
        return len(kw["items"])

    monkeypatch.setattr(chc_repo, "marcar_conciliados_bulk", fake_bulk)
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {"CHC": "S"},
    )
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.user_has_cia", lambda u, c: True,
    )
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.user_has_punto",
        lambda u, c, p: True,
    )

    user = SimpleNamespace(username="JCABREU")
    res = await agent_loop.dispatch_tool(
        user, "chc_conciliar_bulk",
        {"no_cia": "01", "punto": "01",
         "items": [{"tipo_docu": "CH", "no_docu": "0000001"},
                   {"tipo_docu": "CH", "no_docu": "0000002"}]},
    )
    assert res.ok is True
    assert res.was_write is True
    assert res.data["conciliados"] == 2
    assert seen["no_cia"] == "01"
    assert len(seen["items"]) == 2


@pytest.mark.asyncio
async def test_chc_cierre_conciliacion_dispatches_and_injects_user(monkeypatch):
    from apps.asistente import agent_loop
    from apps.legacy.repositories import chc_repo

    seen: dict = {}

    def fake_cierre(**kw):
        seen.update(kw)
        return None

    monkeypatch.setattr(chc_repo, "cierre_conciliacion", fake_cierre)
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {"CHC": "S"},
    )
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.user_has_cia", lambda u, c: True,
    )
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.user_has_punto",
        lambda u, c, p: True,
    )

    user = SimpleNamespace(username="JCABREU")
    res = await agent_loop.dispatch_tool(
        user, "chc_cierre_conciliacion",
        {"no_cia": "01", "punto": "01",
         "cuenta_banco": "01-001", "ano": 2026, "mes": 6},
    )
    assert res.ok is True
    assert res.was_write is True
    assert seen["usuario"] == "JCABREU"
    assert seen["ano"] == 2026
    assert seen["mes"] == 6


@pytest.mark.asyncio
async def test_chc_conciliar_bulk_rejects_empty_items(monkeypatch):
    from apps.asistente import agent_loop

    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {"CHC": "S"},
    )
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.user_has_cia", lambda u, c: True,
    )
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.user_has_punto",
        lambda u, c, p: True,
    )

    user = SimpleNamespace(username="JCABREU")
    res = await agent_loop.dispatch_tool(
        user, "chc_conciliar_bulk",
        {"no_cia": "01", "punto": "01", "items": []},
    )
    assert res.ok is False
    assert res.error_code == "HANDLER_ERROR"


@pytest.mark.asyncio
async def test_chc_forbidden_without_module(monkeypatch):
    from apps.asistente import agent_loop

    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {},
    )
    user = SimpleNamespace(username="ZZNOCHC")
    res = await agent_loop.dispatch_tool(
        user, "chc_rep_disponibilidad", {"no_cia": "01"},
    )
    assert res.ok is False
    assert res.error_code == "FORBIDDEN_MODULE"
