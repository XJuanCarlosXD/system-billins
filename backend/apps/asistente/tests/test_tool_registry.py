"""Tests del registry + dispatch (PR1 Task 4)."""

from types import SimpleNamespace

import pytest


@pytest.mark.asyncio
async def test_list_for_user_filters_by_module_flags(monkeypatch):
    """list_for_user devuelve solo tools con modulos que el usuario tiene."""
    from apps.asistente.tools import registry as reg

    async def _h(**_):
        return {}

    reg.register_tool(reg.ToolSpec(
        name="zz_test_universal",
        description="x",
        input_schema={"type": "object"},
        handler=_h,
    ))
    reg.register_tool(reg.ToolSpec(
        name="zz_test_fat_only",
        description="x",
        input_schema={"type": "object"},
        handler=_h,
        modules_required=["FAT"],
    ))
    reg.register_tool(reg.ToolSpec(
        name="zz_test_chc_only",
        description="x",
        input_schema={"type": "object"},
        handler=_h,
        modules_required=["CHC"],
    ))

    # Usuario con solo FAT.
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {"FAT": "S"},
    )
    user = SimpleNamespace(username="ZZTEST")
    names = {s.name for s in reg.list_for_user(user)}
    assert "zz_test_universal" in names
    assert "zz_test_fat_only" in names
    assert "zz_test_chc_only" not in names


@pytest.mark.asyncio
async def test_dispatch_rejects_forbidden_cia(monkeypatch):
    """dispatch_tool devuelve FORBIDDEN_CIA si user no tiene esa cia."""
    from apps.asistente.agent_loop import dispatch_tool
    from apps.asistente.tools import registry as reg

    async def _h(**_):
        return {"ok": True}

    reg.register_tool(reg.ToolSpec(
        name="zz_needs_cia",
        description="x",
        input_schema={"type": "object"},
        handler=_h,
        modules_required=["FAT"],
    ))

    # Usuario tiene FAT pero solo en cia '01'.
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {"FAT": "S"},
    )
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.user_has_cia",
        lambda u, c: c == "01",
    )

    user = SimpleNamespace(username="ZZTEST")
    res = await dispatch_tool(user, "zz_needs_cia", {"no_cia": "99"})
    assert res.ok is False
    assert res.error_code == "FORBIDDEN_CIA"

    res_ok = await dispatch_tool(user, "zz_needs_cia", {"no_cia": "01"})
    assert res_ok.ok is True


@pytest.mark.asyncio
async def test_dispatch_unknown_tool():
    from apps.asistente.agent_loop import dispatch_tool

    user = SimpleNamespace(username="ZZTEST")
    res = await dispatch_tool(user, "no_existe_jamas", {})
    assert res.ok is False
    assert res.error_code == "UNKNOWN_TOOL"
