"""Tools del modulo FAT (facturacion) — read-only en este iter.

Cada handler wrappea una funcion de `apps.legacy.repositories.fat_repo`.
Convierte los params del LLM (snake_case, opcionales, defaults sensatos) en la
firma del repo. Devuelve dicts JSON-serializables.

`modules_required=['FAT']` filtra las tools del REGISTRY para usuarios que no
tienen acceso al modulo. Los gates de no_cia/punto los aplica `dispatch_tool`.
"""

from __future__ import annotations

from typing import Any

from apps.asistente.tools.registry import ToolSpec, register_tool


# ---------------------------------------------------------------------------
# Handlers (sync OK; dispatch_tool acepta sync y async).
# ---------------------------------------------------------------------------


def _fat_buscar_cliente(
    no_cia: str,
    punto: str = "01",
    search: str = "",
    page: int = 1,
    page_size: int = 20,
) -> dict[str, Any]:
    from apps.legacy.repositories import fat_repo

    return fat_repo.list_clientes(
        no_cia=no_cia, punto=punto, search=search,
        page=int(page), page_size=int(page_size),
    )


def _fat_proximo_ncf(no_cia: str, codigo_ncf: str) -> dict[str, Any]:
    from apps.legacy.repositories import fat_repo

    return fat_repo.get_proximo_ncf(no_cia=no_cia, codigo_ncf=codigo_ncf)


def _fat_buscar_producto(
    no_cia: str,
    punto: str = "01",
    search: str = "",
    no_lista: str = "",
    almacen: str = "",
    solo_existencia: bool = False,
    page: int = 1,
    page_size: int = 20,
) -> dict[str, Any]:
    from apps.legacy.repositories import fat_repo

    return fat_repo.search_productos(
        no_cia=no_cia, punto=punto, no_lista=no_lista, search=search,
        page=int(page), page_size=int(page_size),
        almacen=almacen, solo_existencia=bool(solo_existencia),
    )


def _fat_listar_facturas(
    no_cia: str,
    punto: str = "01",
    page: int = 1,
    page_size: int = 20,
    search: str = "",
    tipo: str = "",
    estado: str = "",
    fecha_desde: str = "",
    fecha_hasta: str = "",
    vendedor: str = "",
    no_cliente: str = "",
) -> dict[str, Any]:
    from apps.legacy.repositories import fat_repo

    return fat_repo.list_facturas(
        no_cia=no_cia, punto=punto,
        page=int(page), page_size=int(page_size),
        search=search, tipo=tipo, estado=estado,
        fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
        vendedor=vendedor, no_cliente=no_cliente,
    )


def _fat_cuadre_caja(
    no_cia: str,
    punto: str = "01",
    desde: str = "",
    hasta: str = "",
) -> list[dict[str, Any]]:
    from apps.legacy.repositories import fat_repo

    return fat_repo.list_cuadre_caja(
        no_cia=no_cia, punto=punto, desde=desde, hasta=hasta,
    )


# ---------------------------------------------------------------------------
# Registro.
# ---------------------------------------------------------------------------


def _register_all() -> None:
    register_tool(ToolSpec(
        name="fat_buscar_cliente",
        description=(
            "Busca clientes del modulo FAT por nombre o numero. Devuelve dict "
            "paginado con items/total/page/page_size."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "no_cia": {"type": "string"},
                "punto": {"type": "string", "default": "01"},
                "search": {"type": "string"},
                "page": {"type": "integer", "default": 1},
                "page_size": {"type": "integer", "default": 20},
            },
            "required": ["no_cia"],
        },
        handler=_fat_buscar_cliente,
        modules_required=["FAT"],
    ))

    register_tool(ToolSpec(
        name="fat_proximo_ncf",
        description=(
            "Devuelve el proximo NCF disponible para una serie + el NCF DGI "
            "compuesto (prefix + correlativo)."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "no_cia": {"type": "string"},
                "codigo_ncf": {"type": "string"},
            },
            "required": ["no_cia", "codigo_ncf"],
        },
        handler=_fat_proximo_ncf,
        modules_required=["FAT"],
    ))

    register_tool(ToolSpec(
        name="fat_buscar_producto",
        description=(
            "Busca productos en inventario con existencia y precio. Filtros "
            "opcionales: lista de precio, almacen, solo con existencia."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "no_cia": {"type": "string"},
                "punto": {"type": "string", "default": "01"},
                "search": {"type": "string"},
                "no_lista": {"type": "string"},
                "almacen": {"type": "string"},
                "solo_existencia": {"type": "boolean", "default": False},
                "page": {"type": "integer", "default": 1},
                "page_size": {"type": "integer", "default": 20},
            },
            "required": ["no_cia"],
        },
        handler=_fat_buscar_producto,
        modules_required=["FAT"],
    ))

    register_tool(ToolSpec(
        name="fat_listar_facturas",
        description=(
            "Lista facturas del FAT con filtros (tipo, estado, fechas, "
            "vendedor, cliente). Pagina ordenada por fecha desc."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "no_cia": {"type": "string"},
                "punto": {"type": "string", "default": "01"},
                "page": {"type": "integer", "default": 1},
                "page_size": {"type": "integer", "default": 20},
                "search": {"type": "string"},
                "tipo": {"type": "string"},
                "estado": {"type": "string"},
                "fecha_desde": {"type": "string"},
                "fecha_hasta": {"type": "string"},
                "vendedor": {"type": "string"},
                "no_cliente": {"type": "string"},
            },
            "required": ["no_cia"],
        },
        handler=_fat_listar_facturas,
        modules_required=["FAT"],
    ))

    register_tool(ToolSpec(
        name="fat_cuadre_caja",
        description=(
            "Cuadre de caja por dia/rango. Devuelve totales por fecha + "
            "tipo de factura."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "no_cia": {"type": "string"},
                "punto": {"type": "string", "default": "01"},
                "desde": {"type": "string"},
                "hasta": {"type": "string"},
            },
            "required": ["no_cia"],
        },
        handler=_fat_cuadre_caja,
        modules_required=["FAT"],
    ))


_register_all()
