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


_register_all()
