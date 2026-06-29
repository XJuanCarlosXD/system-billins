"""Tools del modulo CXP (cuentas por pagar) — read-only.

Wrappea `apps.legacy.repositories.cxp_repo`.
"""

from __future__ import annotations

from typing import Any

from apps.asistente.tools.registry import ToolSpec, register_tool


def _cxp_buscar_proveedor(
    search: str = "", activo: str = "",
) -> list[dict[str, Any]]:
    from apps.legacy.repositories import cxp_repo

    return cxp_repo.list_proveedores(search=search, activo=activo)


def _cxp_estado_cuenta(
    no_cia: str, no_proveedor: str, punto: str = "",
) -> dict[str, Any]:
    from apps.legacy.repositories import cxp_repo

    return cxp_repo.estado_cuenta(
        no_cia=no_cia, no_proveedor=no_proveedor, punto=punto,
    )


def _cxp_aging(
    no_cia: str, punto: str = "", no_proveedor: str = "",
) -> list[dict[str, Any]]:
    from apps.legacy.repositories import cxp_repo

    return cxp_repo.get_aging(
        no_cia=no_cia, punto=punto, no_proveedor=no_proveedor,
    )


def _register_all() -> None:
    register_tool(ToolSpec(
        name="cxp_buscar_proveedor",
        description="Busca proveedores CXP por texto libre. Filtro `activo`.",
        input_schema={
            "type": "object",
            "properties": {
                "search": {"type": "string"},
                "activo": {"type": "string"},
            },
        },
        handler=_cxp_buscar_proveedor,
        modules_required=["CXP"],
    ))
    register_tool(ToolSpec(
        name="cxp_estado_cuenta",
        description="Estado de cuenta de un proveedor CXP.",
        input_schema={
            "type": "object",
            "properties": {
                "no_cia": {"type": "string"},
                "no_proveedor": {"type": "string"},
                "punto": {"type": "string"},
            },
            "required": ["no_cia", "no_proveedor"],
        },
        handler=_cxp_estado_cuenta,
        modules_required=["CXP"],
    ))
    register_tool(ToolSpec(
        name="cxp_aging",
        description="Aging CXP. Filtros opcionales: punto, no_proveedor.",
        input_schema={
            "type": "object",
            "properties": {
                "no_cia": {"type": "string"},
                "punto": {"type": "string"},
                "no_proveedor": {"type": "string"},
            },
            "required": ["no_cia"],
        },
        handler=_cxp_aging,
        modules_required=["CXP"],
    ))


_register_all()
