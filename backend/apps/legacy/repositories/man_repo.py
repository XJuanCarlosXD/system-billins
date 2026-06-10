"""Manuales (MAN) — repo de lectura.

Solo dos tablas en este esquema:
- TCSC      catálogo de servicios (compartido)
- TMANUAL   manuales del sistema
"""
from __future__ import annotations

from .. import client


def list_manuales() -> list[dict]:
    return client.fetch_dicts("SELECT * FROM MAN.TMANUAL ORDER BY 1")


def list_csc() -> list[dict]:
    return client.fetch_dicts("SELECT * FROM MAN.TCSC ORDER BY 1")
