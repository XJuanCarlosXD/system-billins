"""Nómina y RRHH (Sdn) — repo de lectura."""
from __future__ import annotations

from .. import client


def count_empleados(no_cia: str) -> int:
    row = client.fetch_one(
        "SELECT COUNT(*) FROM SDN.TSDN_EMPLEADO WHERE no_cia = :1",
        [no_cia],
    )
    return int(row[0]) if row else 0


def list_afp() -> list[dict]:
    return client.fetch_dicts(
        "SELECT no_afp, descripcion FROM SDN.TSDN_AFP ORDER BY no_afp"
    )


def list_ars() -> list[dict]:
    return client.fetch_dicts(
        "SELECT no_ars, descripcion FROM SDN.TSDN_ARS ORDER BY no_ars"
    )
