"""Inventario (Inv) — repo de lectura."""
from __future__ import annotations

from .. import client


def count_productos(no_cia: str) -> int:
    row = client.fetch_one(
        "SELECT COUNT(*) FROM INV.TINV_PRODUCTO WHERE no_cia = :1",
        [no_cia],
    )
    return int(row[0]) if row else 0


def list_almacenes(no_cia: str) -> list[dict]:
    return client.fetch_dicts(
        "SELECT no_cia, almacen, descripcion FROM INV.TINV_ALMACEN "
        "WHERE no_cia = :1 ORDER BY almacen",
        [no_cia],
    )
