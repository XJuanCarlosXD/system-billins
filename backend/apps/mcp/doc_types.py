"""Registry declarativo de tipos de documento por modulo.

En Plan 1 esta vacio. Cada modulo (FAT, CXC, ...) registrara sus entradas
en sus respectivos planes (`register_module(...)`). El registry solo lo lee
`doc_types_tools.py` para responder `doc_tipos_listar` y `doc_tipos_describir`.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Optional


@dataclass
class TipoDocSchema:
    codigo: str
    descripcion: str
    tipo_transaccion: Optional[str] = None
    afecta_cxc: bool = False
    afecta_cxp: bool = False
    afecta_inv: bool = False
    afecta_cnt: bool = False
    usa_ncf: bool = False
    cont_secuencia: bool = True
    ejemplo_payload: dict = field(default_factory=dict)
    campos_requeridos: list = field(default_factory=list)


@dataclass
class ModuleEntry:
    modulo: str
    tabla: str
    listar_fn: Callable
    describir_fn: Callable


_REGISTRY: dict = {}


def register_module(entry: ModuleEntry) -> None:
    _REGISTRY[entry.modulo.lower()] = entry


def get_module(modulo: str) -> Optional[ModuleEntry]:
    return _REGISTRY.get(modulo.lower())


def modulos_disponibles() -> list:
    return sorted(_REGISTRY.keys())
