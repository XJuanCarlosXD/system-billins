"""Empresas (multi-cía) del sistema legado.

Cada módulo tiene su propia tabla TXXX_CIAS. Tomamos FAT.TFAT_CIAS
como canónica porque tiene los campos más completos (DESCRIPCION, RNC,
DIRECCION, IMPUESTO, COD_DIARIO, ACTIVA, etc).
"""
from __future__ import annotations

from .. import client
from ..dtos import LegacyCompany


def list_active() -> list[LegacyCompany]:
    rows = client.fetch_dicts(
        "SELECT no_cia, descripcion, rnc, activa "
        "FROM FAT.TFAT_CIAS "
        "WHERE NVL(activa, 'S') = 'S' "
        "ORDER BY no_cia"
    )
    return [
        LegacyCompany(
            no_cia=r['no_cia'],
            descripcion=r['descripcion'] or '',
            rnc=r['rnc'],
            activa=(r['activa'] == 'S'),
        )
        for r in rows
    ]


def get(no_cia: str) -> LegacyCompany | None:
    rows = client.fetch_dicts(
        "SELECT no_cia, descripcion, rnc, activa "
        "FROM FAT.TFAT_CIAS WHERE no_cia = :1",
        [no_cia],
    )
    if not rows:
        return None
    r = rows[0]
    return LegacyCompany(
        no_cia=r['no_cia'],
        descripcion=r['descripcion'] or '',
        rnc=r['rnc'],
        activa=(r['activa'] == 'S'),
    )
