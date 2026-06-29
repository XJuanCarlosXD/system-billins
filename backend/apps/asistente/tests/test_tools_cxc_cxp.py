"""Tests de tools CXC y CXP (read)."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

# side-effect: registra las tools.
from apps.asistente.tools import cxc as _cxc  # noqa: F401
from apps.asistente.tools import cxp as _cxp  # noqa: F401
from apps.asistente.tools.registry import REGISTRY


def test_cxc_cxp_tools_registered():
    cxc_expected = {
        "cxc_buscar_cliente", "cxc_estado_cuenta",
        "cxc_aging", "cxc_listar_documentos",
    }
    cxp_expected = {
        "cxp_buscar_proveedor", "cxp_estado_cuenta", "cxp_aging",
    }
    assert cxc_expected.issubset(REGISTRY.keys())
    assert cxp_expected.issubset(REGISTRY.keys())
    for n in cxc_expected:
        assert REGISTRY[n].modules_required == ["CXC"]
        assert REGISTRY[n].write is False
    for n in cxp_expected:
        assert REGISTRY[n].modules_required == ["CXP"]
        assert REGISTRY[n].write is False


@pytest.mark.asyncio
async def test_cxc_estado_cuenta_dispatches(monkeypatch):
    from apps.asistente import agent_loop
    from apps.legacy.repositories import cxc_repo

    monkeypatch.setattr(cxc_repo, "estado_cuenta",
                        lambda **kw: {"saldo": 1234.5, "docs": []})
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {"CXC": "S"},
    )
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.user_has_cia", lambda u, c: True,
    )

    user = SimpleNamespace(username="JCABREU")
    res = await agent_loop.dispatch_tool(
        user, "cxc_estado_cuenta",
        {"no_cia": "01", "no_cliente": "12345"},
    )
    assert res.ok is True
    assert res.data["saldo"] == 1234.5


@pytest.mark.asyncio
async def test_cxp_buscar_proveedor_dispatches(monkeypatch):
    from apps.asistente import agent_loop
    from apps.legacy.repositories import cxp_repo

    seen: dict = {}

    def fake(**kw):
        seen.update(kw)
        return [{"no_proveedor": "001", "nombre": "ACME"}]

    monkeypatch.setattr(cxp_repo, "list_proveedores", fake)
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {"CXP": "S"},
    )

    user = SimpleNamespace(username="JCABREU")
    res = await agent_loop.dispatch_tool(
        user, "cxp_buscar_proveedor",
        {"search": "ACME", "activo": "S"},
    )
    assert res.ok is True
    assert seen["search"] == "ACME"
    assert seen["activo"] == "S"
    assert res.data[0]["nombre"] == "ACME"


@pytest.mark.asyncio
async def test_cxc_tool_forbidden_without_module(monkeypatch):
    from apps.asistente import agent_loop

    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {},
    )
    user = SimpleNamespace(username="ZZNOCXC")
    res = await agent_loop.dispatch_tool(
        user, "cxc_aging", {"no_cia": "01"},
    )
    assert res.ok is False
    assert res.error_code == "FORBIDDEN_MODULE"
