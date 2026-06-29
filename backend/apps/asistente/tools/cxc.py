"""Tools del modulo CXC (cuentas por cobrar) — read-only.

Wrappea `apps.legacy.repositories.cxc_repo`.
"""

from __future__ import annotations

from typing import Any

from apps.asistente.tools.registry import ToolSpec, register_tool


def _cxc_buscar_cliente(
    no_cia: str, q: str = "", page: int = 1, page_size: int = 50,
) -> dict[str, Any]:
    from apps.legacy.repositories import cxc_repo

    return cxc_repo.search_clientes(
        no_cia=no_cia, q=q, page=int(page), page_size=int(page_size),
    )


def _cxc_estado_cuenta(no_cia: str, no_cliente: str) -> dict[str, Any]:
    from apps.legacy.repositories import cxc_repo

    return cxc_repo.estado_cuenta(no_cia=no_cia, no_cliente=no_cliente)


def _cxc_aging(
    no_cia: str, punto: str = "", vendedor: str = "",
) -> list[dict[str, Any]]:
    from apps.legacy.repositories import cxc_repo

    return cxc_repo.rep_envejecimiento(
        no_cia=no_cia, punto=punto, vendedor=vendedor,
    )


def _cxc_listar_documentos(
    no_cia: str, punto: str = "", tipo_doc: str = "",
    no_cliente: str = "", desde: str = "", hasta: str = "",
    page: int = 1, page_size: int = 30,
) -> dict[str, Any]:
    from apps.legacy.repositories import cxc_repo

    return cxc_repo.list_documentos(
        no_cia=no_cia, punto=punto, tipo_doc=tipo_doc,
        no_cliente=no_cliente, desde=desde, hasta=hasta,
        page=int(page), page_size=int(page_size),
    )


def _register_all() -> None:
    register_tool(ToolSpec(
        name="cxc_buscar_cliente",
        description="Busca clientes CXC por nombre o numero (paginado).",
        input_schema={
            "type": "object",
            "properties": {
                "no_cia": {"type": "string"},
                "q": {"type": "string"},
                "page": {"type": "integer", "default": 1},
                "page_size": {"type": "integer", "default": 50},
            },
            "required": ["no_cia"],
        },
        handler=_cxc_buscar_cliente,
        modules_required=["CXC"],
    ))
    register_tool(ToolSpec(
        name="cxc_estado_cuenta",
        description=(
            "Estado de cuenta de un cliente CXC: saldo + documentos abiertos "
            "+ historico."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "no_cia": {"type": "string"},
                "no_cliente": {"type": "string"},
            },
            "required": ["no_cia", "no_cliente"],
        },
        handler=_cxc_estado_cuenta,
        modules_required=["CXC"],
    ))
    register_tool(ToolSpec(
        name="cxc_aging",
        description=(
            "Reporte de envejecimiento de cartera CXC (aging). Filtros: "
            "punto, vendedor."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "no_cia": {"type": "string"},
                "punto": {"type": "string"},
                "vendedor": {"type": "string"},
            },
            "required": ["no_cia"],
        },
        handler=_cxc_aging,
        modules_required=["CXC"],
    ))
    register_tool(ToolSpec(
        name="cxc_listar_documentos",
        description=(
            "Lista documentos CXC con filtros (tipo, cliente, fechas). "
            "Paginado."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "no_cia": {"type": "string"},
                "punto": {"type": "string"},
                "tipo_doc": {"type": "string"},
                "no_cliente": {"type": "string"},
                "desde": {"type": "string"},
                "hasta": {"type": "string"},
                "page": {"type": "integer", "default": 1},
                "page_size": {"type": "integer", "default": 30},
            },
            "required": ["no_cia"],
        },
        handler=_cxc_listar_documentos,
        modules_required=["CXC"],
    ))


_register_all()
