"""Órdenes de Compra (Odc) — repo de lectura."""
from __future__ import annotations

from .. import client


def count_ordenes(no_cia: str) -> int:
    row = client.fetch_one(
        "SELECT COUNT(*) FROM ODC.TODC_DOCUMENTO WHERE no_cia = :1",
        [no_cia],
    )
    return int(row[0]) if row else 0
