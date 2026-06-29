"""Tests de tools CHC (read)."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

# side-effect: registra las tools.
from apps.asistente.tools import chc as _chc  # noqa: F401
from apps.asistente.tools.registry import REGISTRY


def test_chc_tools_registered():
    expected = {
        "chc_listar_cuentas", "chc_listar_cheques",
        "chc_rep_disponibilidad", "chc_rep_movimientos",
    }
    assert expected.issubset(REGISTRY.keys())
    for n in expected:
        assert REGISTRY[n].modules_required == ["CHC"]
        assert REGISTRY[n].write is False


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
