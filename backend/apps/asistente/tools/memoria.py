"""Wrappers in-process de apps.mcp.tools.memoria.

Reusa el proxy HTTP del memory-router que ya monta apps.mcp; no se
duplica configuracion. Los handlers se registran en el REGISTRY al
importar este modulo (side-effect via apps.asistente.apps.ready()).
"""

from __future__ import annotations

from apps.asistente.tools.registry import ToolSpec, register_tool


async def _memoria_buscar(query: str, limit: int = 10) -> dict:
    from apps.mcp.tools import memoria as m

    return await m.memoria_buscar(query=query, limit=limit)


async def _memoria_obtener(ids: list) -> dict:
    from apps.mcp.tools import memoria as m

    return await m.memoria_obtener(ids=ids)


async def _memoria_briefing(query: str | None = None) -> dict:
    from apps.mcp.tools import memoria as m

    # Algunas versiones de m.memoria_briefing solo aceptan kwargs vacios.
    if query is None:
        return await m.memoria_briefing()
    return await m.memoria_briefing(query=query)


async def _memoria_skills_disponibles() -> dict:
    from apps.mcp.tools import memoria as m

    return await m.memoria_skills_disponibles()


async def _memoria_obtener_skill(name: str) -> dict:
    from apps.mcp.tools import memoria as m

    return await m.memoria_obtener_skill(name=name)


def _register_all() -> None:
    register_tool(ToolSpec(
        name="memoria_buscar",
        description="Busca en las memorias del proyecto por texto libre.",
        input_schema={
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "limit": {"type": "integer", "default": 10},
            },
            "required": ["query"],
        },
        handler=_memoria_buscar,
    ))
    register_tool(ToolSpec(
        name="memoria_obtener",
        description="Trae memorias por lista de IDs.",
        input_schema={
            "type": "object",
            "properties": {
                "ids": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["ids"],
        },
        handler=_memoria_obtener,
    ))
    register_tool(ToolSpec(
        name="memoria_briefing",
        description="Devuelve el briefing actual del proyecto.",
        input_schema={
            "type": "object",
            "properties": {"query": {"type": "string"}},
        },
        handler=_memoria_briefing,
    ))
    register_tool(ToolSpec(
        name="memoria_skills_disponibles",
        description="Lista skills (frontmatter) registradas en memory-router.",
        input_schema={"type": "object", "properties": {}},
        handler=_memoria_skills_disponibles,
    ))
    register_tool(ToolSpec(
        name="memoria_obtener_skill",
        description="Trae el cuerpo markdown de una skill por nombre.",
        input_schema={
            "type": "object",
            "properties": {"name": {"type": "string"}},
            "required": ["name"],
        },
        handler=_memoria_obtener_skill,
    ))


_register_all()
