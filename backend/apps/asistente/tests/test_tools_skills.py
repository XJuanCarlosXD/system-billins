"""Tests del sistema de skills (Task 14 Fase 1: read + listar + cargar)."""

from __future__ import annotations

import os
import textwrap
from types import SimpleNamespace

import pytest


@pytest.fixture
def skills_dir(tmp_path, monkeypatch):
    """Apunta SKILLS_DIR a un tmp_path con 2 skills de fixture."""
    from apps.asistente.tools import skills as skills_mod

    base = tmp_path / "skills"
    base.mkdir()

    # Skill con FAT — accesible para usuario con FAT.
    (base / "facturar-test").mkdir()
    (base / "facturar-test" / "SKILL.md").write_text(
        textwrap.dedent(
            """\
            ---
            name: facturar-test
            description: Skill de fixture para tests.
            modules_required: [FAT]
            tools_used: [fat_buscar_cliente, fat_proximo_ncf]
            ---

            Cuerpo de la skill de prueba.

            Paso 1: hacer X.
            """,
        ),
        encoding="utf-8",
    )

    # Skill sin requisitos — accesible universalmente.
    (base / "ayuda-general").mkdir()
    (base / "ayuda-general" / "SKILL.md").write_text(
        textwrap.dedent(
            """\
            ---
            name: ayuda-general
            description: Skill sin modulos requeridos.
            modules_required: []
            tools_used: []
            ---

            Cuerpo de la skill general.
            """,
        ),
        encoding="utf-8",
    )

    monkeypatch.setattr(skills_mod, "SKILLS_DIR", str(base))
    return base


def test_read_skill_file_parses_frontmatter(skills_dir):
    from apps.asistente.tools import skills as skills_mod

    sk = skills_mod.read_skill_file("facturar-test")
    assert sk is not None
    assert sk["name"] == "facturar-test"
    assert sk["description"] == "Skill de fixture para tests."
    assert sk["modules_required"] == ["FAT"]
    assert sk["tools_used"] == ["fat_buscar_cliente", "fat_proximo_ncf"]
    assert "Cuerpo de la skill de prueba" in sk["body"]


def test_read_skill_file_returns_none_for_missing(skills_dir):
    from apps.asistente.tools import skills as skills_mod

    assert skills_mod.read_skill_file("no-existe") is None


@pytest.mark.asyncio
async def test_skill_listar_filters_by_module(skills_dir, monkeypatch):
    from apps.asistente.tools import skills as skills_mod

    # Usuario CON FAT — ve ambas.
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {"FAT": "S"},
    )
    user = SimpleNamespace(username="JCABREU")
    res = await skills_mod._skill_listar(user=user)
    names = {s["name"] for s in res["skills"]}
    assert names == {"facturar-test", "ayuda-general"}

    # Usuario SIN FAT — solo ve ayuda-general.
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {},
    )
    res = await skills_mod._skill_listar(user=user)
    names = {s["name"] for s in res["skills"]}
    assert names == {"ayuda-general"}


@pytest.mark.asyncio
async def test_skill_cargar_returns_body_for_authorized(skills_dir, monkeypatch):
    from apps.asistente.tools import skills as skills_mod

    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {"FAT": "S"},
    )
    user = SimpleNamespace(username="JCABREU")
    res = await skills_mod._skill_cargar("facturar-test", user=user)
    assert res["ok"] is True
    assert "Cuerpo de la skill de prueba" in res["body"]


@pytest.mark.asyncio
async def test_skill_cargar_rejects_when_module_missing(skills_dir, monkeypatch):
    from apps.asistente.tools import skills as skills_mod

    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {},
    )
    user = SimpleNamespace(username="ZZNOFAT")
    res = await skills_mod._skill_cargar("facturar-test", user=user)
    assert res["ok"] is False
    assert res["error"] == "FORBIDDEN_MODULE"
    assert res["missing"] == ["FAT"]


@pytest.mark.asyncio
async def test_skill_cargar_missing_skill(skills_dir, monkeypatch):
    from apps.asistente.tools import skills as skills_mod

    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {},
    )
    user = SimpleNamespace(username="JCABREU")
    res = await skills_mod._skill_cargar("inexistente", user=user)
    assert res["ok"] is False
    assert res["error"] == "SKILL_NOT_FOUND"


@pytest.mark.asyncio
async def test_skill_cargar_warns_when_tools_missing(skills_dir, monkeypatch):
    """Una skill que declara tools que no estan en REGISTRY devuelve warnings."""
    from apps.asistente.tools import skills as skills_mod
    from apps.asistente.tools.registry import REGISTRY

    # fat_buscar_cliente esta registrada (por apps.py:ready); usemos una skill que
    # declare una tool inventada.
    bogus = os.path.join(skills_dir, "demo-bogus")
    os.makedirs(bogus, exist_ok=True)
    with open(os.path.join(bogus, "SKILL.md"), "w", encoding="utf-8") as fh:
        fh.write(
            "---\n"
            "name: demo-bogus\n"
            "description: skill demo\n"
            "modules_required: []\n"
            "tools_used: [tool_inexistente]\n"
            "---\n\nCuerpo\n",
        )

    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {},
    )
    user = SimpleNamespace(username="JCABREU")
    res = await skills_mod._skill_cargar("demo-bogus", user=user)
    assert res["ok"] is True
    assert any("tool_inexistente" in w for w in res["warnings"])
    # Sanity: no rompimos el REGISTRY global.
    assert "skill_listar" in REGISTRY
