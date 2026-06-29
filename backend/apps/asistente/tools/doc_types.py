"""Wrappers in-process para tools de tipos de documento.

Reusa apps.mcp.tools.doc_types_tools (que a su vez consulta TIPDOC / TIPDC).
"""

from __future__ import annotations

from apps.asistente.tools.registry import ToolSpec, register_tool


async def _doc_tipos_listar(modulo: str | None = None) -> dict:
    from apps.mcp.tools import doc_types_tools as d

    if modulo:
        return await d.doc_tipos_listar(modulo=modulo)
    return await d.doc_tipos_listar()


async def _doc_tipos_describir(modulo: str, tipo_docu: str) -> dict:
    from apps.mcp.tools import doc_types_tools as d

    return await d.doc_tipos_describir(modulo=modulo, tipo_docu=tipo_docu)


def _register_all() -> None:
    register_tool(ToolSpec(
        name="doc_tipos_listar",
        description="Lista los tipos de documento por modulo (FAT/CHC/...).",
        input_schema={
            "type": "object",
            "properties": {"modulo": {"type": "string"}},
        },
        handler=_doc_tipos_listar,
    ))
    register_tool(ToolSpec(
        name="doc_tipos_describir",
        description="Describe un tipo de documento (campos, NCF, asiento).",
        input_schema={
            "type": "object",
            "properties": {
                "modulo": {"type": "string"},
                "tipo_docu": {"type": "string"},
            },
            "required": ["modulo", "tipo_docu"],
        },
        handler=_doc_tipos_describir,
    ))


_register_all()
