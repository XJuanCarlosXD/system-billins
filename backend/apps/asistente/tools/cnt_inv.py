"""Tools del modulo CNT (read) e INV (read).

CNT: listar_companias (catalogo basico para el chat).
INV: buscar_producto (con existencia y precios) y listar_movimientos.

Writes de CNT (crear_compania/crear_punto) quedan deferidos al proximo iter
porque requieren tests con DB real.
"""

from __future__ import annotations

from typing import Any

from apps.asistente.tools.registry import ToolSpec, register_tool


# ---------------------------------------------------------------------------
# CNT
# ---------------------------------------------------------------------------


def _cnt_listar_companias() -> list[dict[str, Any]]:
    from apps.legacy.repositories import cnt_repo

    return cnt_repo.list_cias()


# ---------------------------------------------------------------------------
# INV
# ---------------------------------------------------------------------------


def _inv_buscar_producto(
    no_cia: str = "01",
    punto: str = "",
    search: str = "",
    grupo: str = "",
    linea: str = "",
    page: int = 1,
    page_size: int = 20,
) -> dict[str, Any]:
    """Lista productos del modulo INV con filtros opcionales.

    Para precios y existencia paginadas usa fat_buscar_producto (alias
    funcional). Aqui devolvemos el listado plano con su info maestra.
    """
    from apps.legacy.repositories import inv_repo

    return inv_repo.list_productos(
        search=search, grupo=grupo, linea=linea,
        page=int(page), page_size=int(page_size),
    )


def _inv_listar_movimientos(
    no_cia: str = "01",
    no_produ: str = "",
    almacen: str = "",
    desde: str = "",
    hasta: str = "",
    page: int = 1,
    page_size: int = 30,
) -> dict[str, Any]:
    from apps.legacy.repositories import inv_repo

    return inv_repo.list_movimientos(
        no_cia=no_cia, no_produ=no_produ, almacen=almacen,
        desde=desde, hasta=hasta,
        page=int(page), page_size=int(page_size),
    )


def _register_all() -> None:
    register_tool(ToolSpec(
        name="cnt_listar_companias",
        description="Lista las companias contables registradas (catalogo).",
        input_schema={"type": "object", "properties": {}},
        handler=_cnt_listar_companias,
        modules_required=["CNT"],
    ))
    register_tool(ToolSpec(
        name="inv_buscar_producto",
        description=(
            "Busca productos en el maestro de inventario con filtros "
            "(search, grupo, linea). Paginado."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "search": {"type": "string"},
                "grupo": {"type": "string"},
                "linea": {"type": "string"},
                "page": {"type": "integer", "default": 1},
                "page_size": {"type": "integer", "default": 20},
            },
        },
        handler=_inv_buscar_producto,
        modules_required=["INV"],
    ))
    register_tool(ToolSpec(
        name="inv_listar_movimientos",
        description=(
            "Lista movimientos de inventario por producto/almacen/fechas. "
            "Paginado."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "no_cia": {"type": "string", "default": "01"},
                "no_produ": {"type": "string"},
                "almacen": {"type": "string"},
                "desde": {"type": "string"},
                "hasta": {"type": "string"},
                "page": {"type": "integer", "default": 1},
                "page_size": {"type": "integer", "default": 30},
            },
        },
        handler=_inv_listar_movimientos,
        modules_required=["INV"],
    ))


_register_all()
