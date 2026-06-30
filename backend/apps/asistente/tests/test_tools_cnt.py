"""Tests de tools CNT (writes: crear_compania, crear_punto).

Estrategia: monkeypatch sobre apps.legacy.repositories.cnt_repo.* y verificar
que el handler delega correctamente y que dispatch_tool respeta el gate
`modules_required=['CNT']` + inyecta `user.username`.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest


from apps.asistente.tools import cnt_inv as _cnt_tools  # noqa: F401
from apps.asistente.tools.registry import REGISTRY


def test_cnt_writes_registered():
    assert "cnt_crear_compania" in REGISTRY
    assert "cnt_crear_punto" in REGISTRY
    for n in ("cnt_crear_compania", "cnt_crear_punto"):
        spec = REGISTRY[n]
        assert spec.modules_required == ["CNT"]
        assert spec.write is True


@pytest.mark.asyncio
async def test_cnt_crear_compania_dispatches_and_injects_user(monkeypatch):
    from apps.asistente import agent_loop
    from apps.legacy.repositories import cnt_repo

    seen: dict = {}

    def fake_create_cia(no_cia, descripcion, usuario, **kwargs):
        seen.update(
            {
                "no_cia": no_cia,
                "descripcion": descripcion,
                "usuario": usuario,
                **kwargs,
            }
        )
        return None

    monkeypatch.setattr(cnt_repo, "create_cia", fake_create_cia)
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {"CNT": "S"},
    )
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.user_has_cia", lambda u, c: True,
    )

    user = SimpleNamespace(username="JCABREU")
    res = await agent_loop.dispatch_tool(
        user,
        "cnt_crear_compania",
        {
            "no_cia": "99",
            "descripcion": "Test SRL",
            "rnc": "131000001",
            "itbis": 18,
        },
    )
    assert res.ok is True, res.error_message
    assert res.was_write is True
    assert seen["no_cia"] == "99"
    assert seen["usuario"] == "JCABREU"
    assert seen["itbis"] == 18


@pytest.mark.asyncio
async def test_cnt_crear_punto_dispatches(monkeypatch):
    from apps.asistente import agent_loop
    from apps.legacy.repositories import cnt_repo

    seen: dict = {}

    def fake_create_punto(no_cia, punto, descripcion, ano_proceso, usuario, **kwargs):
        seen.update(
            {
                "no_cia": no_cia,
                "punto": punto,
                "descripcion": descripcion,
                "ano_proceso": ano_proceso,
                "usuario": usuario,
                **kwargs,
            }
        )
        return None

    monkeypatch.setattr(cnt_repo, "create_punto", fake_create_punto)
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {"CNT": "S"},
    )
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.user_has_cia", lambda u, c: True,
    )

    user = SimpleNamespace(username="JCABREU")
    res = await agent_loop.dispatch_tool(
        user,
        "cnt_crear_punto",
        {
            "no_cia": "99",
            "nuevo_punto": "01",
            "descripcion": "Sucursal Principal",
            "ano_proceso": 2026,
            "mes_proceso": 6,
        },
    )
    assert res.ok is True, res.error_message
    assert res.was_write is True
    assert seen["punto"] == "01"
    assert seen["usuario"] == "JCABREU"
    assert seen["ano_proceso"] == 2026


@pytest.mark.asyncio
async def test_cnt_crear_compania_blocked_without_module(monkeypatch):
    from apps.asistente import agent_loop

    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {},
    )

    user = SimpleNamespace(username="ZZNOCNT")
    res = await agent_loop.dispatch_tool(
        user,
        "cnt_crear_compania",
        {"no_cia": "99", "descripcion": "Test"},
    )
    assert res.ok is False
    assert res.error_code == "FORBIDDEN_MODULE"
    assert res.was_write is True
