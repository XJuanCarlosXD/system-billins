"""Caja Chica (Acc) — repo de lectura."""
from __future__ import annotations

from .. import client


def list_cajas_chicas(no_cia: str) -> list[dict]:
    return client.fetch_dicts(
        "SELECT * FROM ACC.TACC_CAJA_CHICA WHERE no_cia = :1 ORDER BY 1",
        [no_cia],
    )


def count_beneficiarios(no_cia: str) -> int:
    row = client.fetch_one(
        "SELECT COUNT(*) FROM ACC.TACC_BENEFICIARIO WHERE no_cia = :1",
        [no_cia],
    )
    return int(row[0]) if row else 0
