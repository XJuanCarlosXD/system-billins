"""Tools del modulo CHC (cheques / bancos) — read-only.

Wrappea `apps.legacy.repositories.chc_repo`.
"""

from __future__ import annotations

from typing import Any

from apps.asistente.tools.registry import ToolSpec, register_tool


def _chc_listar_cuentas(
    no_cia: str, punto: str = "", activa: str = "",
) -> list[dict[str, Any]]:
    from apps.legacy.repositories import chc_repo

    return chc_repo.list_cuentas_bancarias(
        no_cia=no_cia, punto=(punto or None), activa=activa,
    )


def _chc_listar_cheques(
    no_cia: str,
    punto: str = "",
    cuenta_banco: str = "",
    status: str = "",
    conciliado: str = "",
    entregado: str = "",
    fecha_desde: str = "",
    fecha_hasta: str = "",
    no_proveedor: str = "",
    limit: int = 200,
) -> list[dict[str, Any]]:
    from apps.legacy.repositories import chc_repo

    return chc_repo.list_cheques(
        no_cia=no_cia,
        punto=(punto or None),
        cuenta_banco=(cuenta_banco or None),
        status=(status or None),
        conciliado=(conciliado or None),
        entregado=(entregado or None),
        fecha_desde=(fecha_desde or None),
        fecha_hasta=(fecha_hasta or None),
        no_proveedor=(no_proveedor or None),
        limit=int(limit),
    )


def _chc_rep_disponibilidad(
    no_cia: str, punto: str = "",
) -> list[dict[str, Any]]:
    from apps.legacy.repositories import chc_repo

    return chc_repo.rep_disponibilidad(no_cia=no_cia, punto=(punto or None))


def _chc_rep_movimientos(
    no_cia: str, punto: str, cuenta_banco: str,
    fecha_desde: str, fecha_hasta: str,
) -> dict[str, Any]:
    from apps.legacy.repositories import chc_repo

    return chc_repo.rep_movimientos_cuenta(
        no_cia=no_cia, punto=punto, cuenta_banco=cuenta_banco,
        fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
    )


def _chc_conciliar_bulk(
    user,
    no_cia: str,
    punto: str,
    items: list | None = None,
) -> dict[str, Any]:
    """Marca como conciliados un lote de cheques. items: lista de dicts con
    tipo_docu y no_docu."""
    from apps.legacy.repositories import chc_repo

    if not items:
        raise ValueError("conciliar_bulk requiere al menos un item")
    n = chc_repo.marcar_conciliados_bulk(
        no_cia=no_cia, punto=punto, items=items,
    )
    return {"conciliados": n, "items": len(items)}


def _chc_cierre_conciliacion(
    user,
    no_cia: str,
    punto: str,
    cuenta_banco: str,
    ano: int,
    mes: int,
) -> dict[str, Any]:
    """Inserta un cierre mensual de conciliacion bancaria."""
    from apps.legacy.repositories import chc_repo

    chc_repo.cierre_conciliacion(
        no_cia=no_cia, punto=punto, cuenta_banco=cuenta_banco,
        ano=int(ano), mes=int(mes),
        usuario=(getattr(user, "username", "") or "")[:30],
    )
    return {"ok": True, "cuenta_banco": cuenta_banco,
            "ano": int(ano), "mes": int(mes)}


def _register_all() -> None:
    register_tool(ToolSpec(
        name="chc_listar_cuentas",
        description=(
            "Lista cuentas bancarias del modulo CHC. Filtros: punto, "
            "activa ('S'/'N')."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "no_cia": {"type": "string"},
                "punto": {"type": "string"},
                "activa": {"type": "string"},
            },
            "required": ["no_cia"],
        },
        handler=_chc_listar_cuentas,
        modules_required=["CHC"],
    ))
    register_tool(ToolSpec(
        name="chc_listar_cheques",
        description=(
            "Lista cheques con filtros (cuenta, status, conciliado, entregado, "
            "fechas, proveedor). Ordenado por fecha desc, limite default 200."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "no_cia": {"type": "string"},
                "punto": {"type": "string"},
                "cuenta_banco": {"type": "string"},
                "status": {"type": "string"},
                "conciliado": {"type": "string"},
                "entregado": {"type": "string"},
                "fecha_desde": {"type": "string"},
                "fecha_hasta": {"type": "string"},
                "no_proveedor": {"type": "string"},
                "limit": {"type": "integer", "default": 200},
            },
            "required": ["no_cia"],
        },
        handler=_chc_listar_cheques,
        modules_required=["CHC"],
    ))
    register_tool(ToolSpec(
        name="chc_rep_disponibilidad",
        description=(
            "Disponibilidad bancaria: saldo aprox - cheques por entregar "
            "= disponible neto por cuenta."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "no_cia": {"type": "string"},
                "punto": {"type": "string"},
            },
            "required": ["no_cia"],
        },
        handler=_chc_rep_disponibilidad,
        modules_required=["CHC"],
    ))
    register_tool(ToolSpec(
        name="chc_rep_movimientos",
        description=(
            "Movimientos de una cuenta bancaria en un rango. Devuelve "
            "saldo_inicial + movimientos cronologicos + totales."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "no_cia": {"type": "string"},
                "punto": {"type": "string"},
                "cuenta_banco": {"type": "string"},
                "fecha_desde": {"type": "string"},
                "fecha_hasta": {"type": "string"},
            },
            "required": [
                "no_cia", "punto", "cuenta_banco",
                "fecha_desde", "fecha_hasta",
            ],
        },
        handler=_chc_rep_movimientos,
        modules_required=["CHC"],
    ))
    register_tool(ToolSpec(
        name="chc_conciliar_bulk",
        description=(
            "Marca un lote de cheques como conciliados (write). items: "
            "lista de {tipo_docu, no_docu}. Solo afecta cheques con "
            "conciliado='N'."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "no_cia": {"type": "string"},
                "punto": {"type": "string"},
                "items": {"type": "array"},
                "_perm_modulo": {"type": "string", "default": "CHC"},
                "_perm_tipo_docu": {"type": "string"},
                "_perm_accion": {"type": "string", "default": "escritura"},
            },
            "required": ["no_cia", "punto", "items"],
        },
        handler=_chc_conciliar_bulk,
        write=True,
        modules_required=["CHC"],
    ))
    register_tool(ToolSpec(
        name="chc_cierre_conciliacion",
        description=(
            "Inserta un cierre mensual de conciliacion bancaria (write). "
            "Falla si ya existe para (cuenta, ano, mes). usuario lo "
            "inyecta dispatch_tool."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "no_cia": {"type": "string"},
                "punto": {"type": "string"},
                "cuenta_banco": {"type": "string"},
                "ano": {"type": "integer"},
                "mes": {"type": "integer"},
                "_perm_modulo": {"type": "string", "default": "CHC"},
                "_perm_tipo_docu": {"type": "string"},
                "_perm_accion": {"type": "string", "default": "escritura"},
            },
            "required": ["no_cia", "punto", "cuenta_banco", "ano", "mes"],
        },
        handler=_chc_cierre_conciliacion,
        write=True,
        modules_required=["CHC"],
    ))


_register_all()
