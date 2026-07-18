"""Skill loader del asistente.

Estructura en disco: backend/apps/asistente/skills/<name>/SKILL.md
con frontmatter YAML (description, modules_required, tools_used, ...).

Fase 1 (Task 14) extendera esto; ahora dejamos los handlers minimos
registrados para que el agent loop pueda invocarlos.
"""

from __future__ import annotations

import os
from typing import Any

from apps.asistente.tools.registry import REGISTRY, ToolSpec, register_tool


SKILLS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "skills")
)


def _parse_frontmatter(text: str) -> tuple[dict, str]:
    """Mini parser: extrae frontmatter YAML simple (key: value) entre `---`."""
    if not text.startswith("---"):
        return {}, text
    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}, text
    head, _, body = parts[1], parts[2][:1], parts[2]
    fm: dict[str, Any] = {}
    for line in head.splitlines():
        line = line.rstrip()
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if ":" not in line:
            continue
        key, _, val = line.partition(":")
        val = val.strip()
        if val.startswith("[") and val.endswith("]"):
            inner = val[1:-1].strip()
            fm[key.strip()] = [
                v.strip().strip("'\"") for v in inner.split(",") if v.strip()
            ]
        else:
            fm[key.strip()] = val.strip("'\"")
    return fm, body.lstrip("\n")


def read_skill_file(name: str) -> dict | None:
    path = os.path.join(SKILLS_DIR, name, "SKILL.md")
    if not os.path.isfile(path):
        return None
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    fm, body = _parse_frontmatter(text)
    return {
        "name": fm.get("name", name),
        "description": fm.get("description", ""),
        "modules_required": fm.get("modules_required", []) or [],
        "tools_used": fm.get("tools_used", []) or [],
        "frontmatter": fm,
        "body": body,
    }


def list_skills_index(user) -> list[dict]:
    """Indice compacto de skills accesibles al usuario (version sincrona).

    El agent loop lo inyecta al system prompt de cada turno para que el
    modelo elija la skill correcta de una vez (sin skill_listar). Filtra
    por los flags de modulo del usuario: una operacion sin permiso ni
    siquiera aparece como opcion.
    """
    from apps.asistente.tools.permissions import get_user_module_flags

    flags = get_user_module_flags(user) if user is not None else {}
    out: list[dict] = []
    if not os.path.isdir(SKILLS_DIR):
        return out
    for entry in sorted(os.listdir(SKILLS_DIR)):
        sk = read_skill_file(entry)
        if not sk:
            continue
        if all(flags.get(m) == "S" for m in sk["modules_required"]):
            wtu = sk["frontmatter"].get("when_to_use", []) or []
            out.append({
                "name": sk["name"],
                "description": sk["description"],
                "when_to_use": wtu if isinstance(wtu, list) else [str(wtu)],
            })
    return out


async def _skill_listar(user=None) -> dict:
    """Devuelve nombres + frontmatter de skills accesibles al usuario."""
    from apps.asistente.tools.permissions import get_user_module_flags

    flags = get_user_module_flags(user) if user is not None else {}
    out = []
    if not os.path.isdir(SKILLS_DIR):
        return {"skills": []}
    for entry in sorted(os.listdir(SKILLS_DIR)):
        sk = read_skill_file(entry)
        if not sk:
            continue
        if all(flags.get(m) == "S" for m in sk["modules_required"]):
            out.append({
                "name": sk["name"],
                "description": sk["description"],
                "modules_required": sk["modules_required"],
                "tools_used": sk["tools_used"],
            })
    return {"skills": out}


async def _skill_cargar(name: str, user=None) -> dict:
    """Devuelve el cuerpo markdown de la skill + warnings.

    El agent loop usa esta data para:
    - inyectar `body` al system prompt del proximo turno.
    - persistir SKILL_ACTIVA en TCHAT_CONVERSACION.
    """
    from apps.asistente.tools.permissions import get_user_module_flags

    sk = read_skill_file(name)
    if not sk:
        return {"ok": False, "error": "SKILL_NOT_FOUND", "name": name}

    flags = get_user_module_flags(user) if user is not None else {}
    missing_mods = [m for m in sk["modules_required"] if flags.get(m) != "S"]
    if missing_mods:
        return {
            "ok": False,
            "error": "FORBIDDEN_MODULE",
            "missing": missing_mods,
        }

    missing_tools = [t for t in sk["tools_used"] if t not in REGISTRY]
    return {
        "ok": True,
        "name": sk["name"],
        "description": sk["description"],
        "body": sk["body"],
        "warnings": (
            [f"tool '{t}' no esta registrada" for t in missing_tools]
            if missing_tools else []
        ),
    }


def _register_all() -> None:
    register_tool(ToolSpec(
        name="skill_listar",
        description="Lista las skills (workflows pre-armados) disponibles.",
        input_schema={"type": "object", "properties": {}},
        handler=_skill_listar,
    ))
    register_tool(ToolSpec(
        name="skill_cargar",
        description=(
            "Carga el cuerpo de una skill por nombre. El agent loop la "
            "inyectara al system prompt del proximo turno."
        ),
        input_schema={
            "type": "object",
            "properties": {"name": {"type": "string"}},
            "required": ["name"],
        },
        handler=_skill_cargar,
    ))


_register_all()
