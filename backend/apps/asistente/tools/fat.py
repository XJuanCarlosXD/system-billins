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
# Handlers write. dispatch_tool inyecta `user` automaticamente y aplica los
# gates de modulo/no_cia/punto. El gate de tipo_docu (USUARIOD) se aplica con
# las claves magicas `_perm_modulo`/`_perm_tipo_docu`/`_perm_accion`.
# ---------------------------------------------------------------------------


def _fat_crear_factura(
    user,
    no_cia: str,
    punto: str,
    tipo_factura: str,
    no_cliente: str,
    fecha: str,
    vendedor: str,
    forma_pago: str = "",
    no_lista: str = "",
    nota: str = "",
    lineas: list | None = None,
    codigo_ncf: str = "",
    detalle: str = "",
) -> dict[str, Any]:
    from apps.legacy.repositories import fat_repo

    if not lineas:
        raise ValueError("crear_factura requiere al menos una linea")

    return fat_repo.create_factura(
        no_cia=no_cia, punto=punto, tipo_factura=tipo_factura,
        no_cliente=str(no_cliente), fecha=fecha, vendedor=vendedor,
        forma_pago=forma_pago, no_lista=no_lista, nota=nota,
        lineas=lineas, usuario=getattr(user, "username", "") or "",
        codigo_ncf=codigo_ncf, detalle=detalle,
    )


def _fat_crear_cotizacion(
    user,
    no_cia: str,
    punto: str,
    tipo_factura: str,
    no_cliente: str,
    fecha: str,
    vendedor: str,
    no_lista: str = "",
    nota: str = "",
    lineas: list | None = None,
    detalle: str = "",
) -> dict[str, Any]:
    """Crea una cotizacion. Reutiliza `create_factura` con tipo_factura del
    catalogo `TFAT_TDOCU` configurado como cotizacion (tipo_transaccion='C').
    El backend valida via la secuencia + tdocu; aqui solo delegamos.
    """
    from apps.legacy.repositories import fat_repo

    if not lineas:
        raise ValueError("crear_cotizacion requiere al menos una linea")

    return fat_repo.create_factura(
        no_cia=no_cia, punto=punto, tipo_factura=tipo_factura,
        no_cliente=str(no_cliente), fecha=fecha, vendedor=vendedor,
        forma_pago="", no_lista=no_lista, nota=nota,
        lineas=lineas, usuario=getattr(user, "username", "") or "",
        codigo_ncf="", detalle=detalle,
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
        name="fat_crear_factura",
        description=(
            "Crea una factura en FAT (write). Requiere tipo_factura del "
            "catalogo TFAT_TDOCU + lineas {no_produ, almacen, cantidad, "
            "precio, porc_descuento, porciento_impuesto, descripcion}. "
            "Asigna NCF automaticamente si codigo_ncf no se especifica."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "no_cia": {"type": "string"},
                "punto": {"type": "string"},
                "tipo_factura": {"type": "string"},
                "no_cliente": {"type": "string"},
                "fecha": {"type": "string", "description": "YYYY-MM-DD"},
                "vendedor": {"type": "string"},
                "forma_pago": {"type": "string"},
                "no_lista": {"type": "string"},
                "nota": {"type": "string"},
                "codigo_ncf": {"type": "string"},
                "detalle": {"type": "string"},
                "lineas": {"type": "array"},
                "_perm_modulo": {"type": "string", "default": "FAT"},
                "_perm_tipo_docu": {"type": "string"},
                "_perm_accion": {"type": "string", "default": "escritura"},
            },
            "required": [
                "no_cia", "punto", "tipo_factura", "no_cliente",
                "fecha", "vendedor", "lineas",
            ],
        },
        handler=_fat_crear_factura,
        write=True,
        modules_required=["FAT"],
    ))

    register_tool(ToolSpec(
        name="fat_crear_cotizacion",
        description=(
            "Crea una cotizacion en FAT (write). tipo_factura debe ser un "
            "tipo configurado en TFAT_TDOCU con tipo_transaccion='C'. "
            "No reserva NCF ni afecta inventario."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "no_cia": {"type": "string"},
                "punto": {"type": "string"},
                "tipo_factura": {"type": "string"},
                "no_cliente": {"type": "string"},
                "fecha": {"type": "string", "description": "YYYY-MM-DD"},
                "vendedor": {"type": "string"},
                "no_lista": {"type": "string"},
                "nota": {"type": "string"},
                "detalle": {"type": "string"},
                "lineas": {"type": "array"},
                "_perm_modulo": {"type": "string", "default": "FAT"},
                "_perm_tipo_docu": {"type": "string"},
                "_perm_accion": {"type": "string", "default": "escritura"},
            },
            "required": [
                "no_cia", "punto", "tipo_factura", "no_cliente",
                "fecha", "vendedor", "lineas",
            ],
        },
        handler=_fat_crear_cotizacion,
        write=True,
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
