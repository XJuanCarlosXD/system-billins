"""Tests de tools FAT (read).

Estrategia: monkeypatch sobre apps.legacy.repositories.fat_repo.* y verificar
que el handler delega correctamente y que el dispatch_tool respeta el gate
`modules_required=['FAT']`.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest


# Asegura que las tools fat estan registradas (idempotente).
from apps.asistente.tools import fat as _fat_tools  # noqa: F401
from apps.asistente.tools.registry import REGISTRY


def test_fat_tools_registered():
    expected = {
        "fat_buscar_cliente",
        "fat_proximo_ncf",
        "fat_buscar_producto",
        "fat_listar_facturas",
        "fat_cuadre_caja",
    }
    assert expected.issubset(set(REGISTRY.keys()))
    for name in expected:
        assert REGISTRY[name].modules_required == ["FAT"]
        assert REGISTRY[name].write is False


@pytest.mark.asyncio
async def test_fat_buscar_cliente_dispatches_to_repo(monkeypatch):
    from apps.asistente import agent_loop
    from apps.legacy.repositories import fat_repo

    seen: dict = {}

    def fake_list_clientes(**kw):
        seen.update(kw)
        return {"items": [{"no_cliente": 1, "nombre": "ACME"}], "total": 1,
                "page": 1, "page_size": 20, "total_pages": 1}

    monkeypatch.setattr(fat_repo, "list_clientes", fake_list_clientes)
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {"FAT": "S"},
    )
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.user_has_cia", lambda u, c: True,
    )

    user = SimpleNamespace(username="JCABREU")
    res = await agent_loop.dispatch_tool(
        user, "fat_buscar_cliente",
        {"no_cia": "01", "search": "acme", "page": 1, "page_size": 20},
    )
    assert res.ok is True
    assert res.data["items"][0]["nombre"] == "ACME"
    assert seen["no_cia"] == "01"
    assert seen["search"] == "acme"


@pytest.mark.asyncio
async def test_fat_proximo_ncf_dispatches(monkeypatch):
    from apps.asistente import agent_loop
    from apps.legacy.repositories import fat_repo

    monkeypatch.setattr(fat_repo, "get_proximo_ncf",
                        lambda **kw: {"codigo_ncf": kw["codigo_ncf"],
                                      "prox_ncf": 42,
                                      "ncf_dgi_proximo": "B0100000042"})
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {"FAT": "S"},
    )
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.user_has_cia", lambda u, c: True,
    )

    user = SimpleNamespace(username="JCABREU")
    res = await agent_loop.dispatch_tool(
        user, "fat_proximo_ncf",
        {"no_cia": "01", "codigo_ncf": "B01"},
    )
    assert res.ok is True
    assert res.data["prox_ncf"] == 42


@pytest.mark.asyncio
async def test_fat_tool_blocked_for_user_without_module(monkeypatch):
    """Sin FAT.ACTIVO='S', dispatch devuelve FORBIDDEN_MODULE."""
    from apps.asistente import agent_loop

    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {},
    )

    user = SimpleNamespace(username="ZZNOFAT")
    res = await agent_loop.dispatch_tool(
        user, "fat_buscar_cliente", {"no_cia": "01", "search": "x"},
    )
    assert res.ok is False
    assert res.error_code == "FORBIDDEN_MODULE"


@pytest.mark.asyncio
async def test_fat_buscar_producto_passes_solo_existencia(monkeypatch):
    from apps.asistente import agent_loop
    from apps.legacy.repositories import fat_repo

    seen: dict = {}

    def fake_search(**kw):
        seen.update(kw)
        return {"items": [], "total": 0, "page": 1, "page_size": 20}

    monkeypatch.setattr(fat_repo, "search_productos", fake_search)
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {"FAT": "S"},
    )
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.user_has_cia", lambda u, c: True,
    )

    user = SimpleNamespace(username="JCABREU")
    res = await agent_loop.dispatch_tool(
        user, "fat_buscar_producto",
        {"no_cia": "01", "search": "cemento", "solo_existencia": True},
    )
    assert res.ok is True
    assert seen["solo_existencia"] is True
    assert seen["search"] == "cemento"


@pytest.mark.asyncio
async def test_fat_listar_facturas_passes_filters(monkeypatch):
    from apps.asistente import agent_loop
    from apps.legacy.repositories import fat_repo

    seen: dict = {}

    def fake_list_facturas(**kw):
        seen.update(kw)
        return {"items": [], "total": 0, "page": 1, "page_size": 20}

    monkeypatch.setattr(fat_repo, "list_facturas", fake_list_facturas)
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {"FAT": "S"},
    )
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.user_has_cia", lambda u, c: True,
    )

    user = SimpleNamespace(username="JCABREU")
    res = await agent_loop.dispatch_tool(
        user, "fat_listar_facturas",
        {"no_cia": "01", "punto": "01",
         "fecha_desde": "2026-06-01", "fecha_hasta": "2026-06-29",
         "tipo": "F", "vendedor": "001"},
    )
    assert res.ok is True
    assert seen["fecha_desde"] == "2026-06-01"
    assert seen["tipo"] == "F"
    assert seen["vendedor"] == "001"


@pytest.mark.asyncio
async def test_fat_cuadre_caja_dispatches(monkeypatch):
    from apps.asistente import agent_loop
    from apps.legacy.repositories import fat_repo

    monkeypatch.setattr(fat_repo, "list_cuadre_caja",
                        lambda **kw: [{"fecha": "2026-06-29", "total": 1000}])
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {"FAT": "S"},
    )
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.user_has_cia", lambda u, c: True,
    )

    user = SimpleNamespace(username="JCABREU")
    res = await agent_loop.dispatch_tool(
        user, "fat_cuadre_caja",
        {"no_cia": "01", "desde": "2026-06-29", "hasta": "2026-06-29"},
    )
    assert res.ok is True
    assert res.data[0]["total"] == 1000
