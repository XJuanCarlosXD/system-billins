"""Tools del modulo CNT (read + write) e INV (read).

CNT: listar_companias (read) + crear_compania / crear_punto (write).
INV: buscar_producto (con existencia y precios) y listar_movimientos.
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


def _cnt_crear_compania(
    user,
    no_cia: str,
    descripcion: str,
    rnc: str = "",
    direccion1: str = "",
    telefono1: str = "",
    email: str = "",
    tasa_us: float = 58,
    itbis: float = 18,
) -> dict[str, Any]:
    """Crea una nueva compania en TCNT_CIAS. Write (gate _perm_modulo=CNT)."""
    from apps.legacy.repositories import cnt_repo

    cnt_repo.create_cia(
        no_cia=str(no_cia),
        descripcion=str(descripcion),
        usuario=getattr(user, "username", "") or "",
        rnc=rnc or None,
        direccion1=direccion1 or None,
        telefono1=telefono1 or None,
        email=email or None,
        tasa_us=tasa_us,
        itbis=itbis,
    )
    return {"ok": True, "no_cia": str(no_cia), "descripcion": descripcion}


def _cnt_crear_punto(
    user,
    no_cia: str,
    nuevo_punto: str,
    descripcion: str,
    ano_proceso: int,
    mes_proceso: int = 1,
    mes_cierre: int = 12,
    grupo_contable: str = "",
) -> dict[str, Any]:
    """Crea una nueva sucursal/punto en TCNT_PUNTO. Write.

    El parametro se llama `nuevo_punto` (no `punto`) para evitar el gate
    `user_has_punto` que verifica acceso a un punto existente, ya que aqui
    el punto aun no existe.
    """
    from apps.legacy.repositories import cnt_repo

    cnt_repo.create_punto(
        no_cia=str(no_cia),
        punto=str(nuevo_punto),
        descripcion=str(descripcion),
        ano_proceso=int(ano_proceso),
        usuario=getattr(user, "username", "") or "",
        mes_proceso=int(mes_proceso),
        mes_cierre=int(mes_cierre),
        grupo_contable=grupo_contable or None,
    )
    return {
        "ok": True,
        "no_cia": str(no_cia),
        "punto": str(nuevo_punto),
        "ano_proceso": int(ano_proceso),
    }


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
        name="cnt_crear_compania",
        description=(
            "Crea una nueva compania contable en TCNT_CIAS (write). Requiere "
            "no_cia + descripcion. Opcional: rnc, direccion1, telefono1, "
            "email, tasa_us (default 58), itbis (default 18)."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "no_cia": {"type": "string"},
                "descripcion": {"type": "string"},
                "rnc": {"type": "string"},
                "direccion1": {"type": "string"},
                "telefono1": {"type": "string"},
                "email": {"type": "string"},
                "tasa_us": {"type": "number", "default": 58},
                "itbis": {"type": "number", "default": 18},
                "_perm_modulo": {"type": "string", "default": "CNT"},
                "_perm_accion": {"type": "string", "default": "escritura"},
            },
            "required": ["no_cia", "descripcion"],
        },
        handler=_cnt_crear_compania,
        write=True,
        modules_required=["CNT"],
    ))
    register_tool(ToolSpec(
        name="cnt_crear_punto",
        description=(
            "Crea una nueva sucursal/punto en TCNT_PUNTO (write). Requiere "
            "no_cia + nuevo_punto + descripcion + ano_proceso. Opcional: "
            "mes_proceso (default 1), mes_cierre (default 12), "
            "grupo_contable. Usa `nuevo_punto` (no `punto`) porque el punto "
            "aun no existe y no se le puede verificar acceso."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "no_cia": {"type": "string"},
                "nuevo_punto": {"type": "string"},
                "descripcion": {"type": "string"},
                "ano_proceso": {"type": "integer"},
                "mes_proceso": {"type": "integer", "default": 1},
                "mes_cierre": {"type": "integer", "default": 12},
                "grupo_contable": {"type": "string"},
                "_perm_modulo": {"type": "string", "default": "CNT"},
                "_perm_accion": {"type": "string", "default": "escritura"},
            },
            "required": [
                "no_cia", "nuevo_punto", "descripcion", "ano_proceso",
            ],
        },
        handler=_cnt_crear_punto,
        write=True,
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
