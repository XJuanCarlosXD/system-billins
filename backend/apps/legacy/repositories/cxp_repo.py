"""Cuentas por Pagar (CxP) — repo de lectura."""
from __future__ import annotations

from .. import client


def count_proveedores(no_cia: str) -> int:
    row = client.fetch_one(
        "SELECT COUNT(*) FROM CXP.TCXP_DPROVEEDOR WHERE no_cia = :1",
        [no_cia],
    )
    return int(row[0]) if row else 0


def list_tipo_retencion_dgii() -> list[dict]:
    return client.fetch_dicts(
        "SELECT * FROM CXP.TCXP_TIPO_RETENCION_DGII ORDER BY tipo_retencion"
    )
