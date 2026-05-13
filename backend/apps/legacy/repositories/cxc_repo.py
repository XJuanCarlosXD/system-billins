"""Cuentas por Cobrar (CxC) — repo de lectura."""
from __future__ import annotations

from .. import client


def count_clientes(no_cia: str) -> int:
    row = client.fetch_one(
        "SELECT COUNT(*) FROM CXC.TCXC_CLIENTE WHERE no_cia = :1",
        [no_cia],
    )
    return int(row[0]) if row else 0


def list_document_types(no_cia: str) -> list[dict]:
    return client.fetch_dicts(
        "SELECT no_cia, tipo_docu, descripcion, NVL(activo,'S') AS activo, codigo_ncf "
        "FROM CXC.TCXC_TDOCU WHERE no_cia = :1 AND NVL(activo,'S')='S' "
        "ORDER BY tipo_docu",
        [no_cia],
    )
