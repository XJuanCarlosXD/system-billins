"""Bancos / Cheques / Conciliación (Chc) — repo de lectura."""
from __future__ import annotations

from .. import client


def list_bancos() -> list[dict]:
    return client.fetch_dicts(
        "SELECT * FROM CHC.TCHC_BANCO ORDER BY 1"
    )


def list_cuentas_bancarias(no_cia: str) -> list[dict]:
    return client.fetch_dicts(
        "SELECT * FROM CHC.TCHC_BCUENTA WHERE no_cia = :1 ORDER BY cuenta_banco",
        [no_cia],
    )
