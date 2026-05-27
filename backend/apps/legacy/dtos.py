"""DTOs tipados que devuelven los repositorios legacy.

Convención: 1 dataclass por entidad de negocio del sistema viejo.
Los repos retornan estos DTOs (nunca tuplas crudas hacia las views).
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import date
from typing import Any


@dataclass(frozen=True)
class LegacyUser:
    username: str
    is_oracle_user: bool = True

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class LegacyCompany:
    no_cia: str
    descripcion: str
    rnc: str | None
    activa: bool

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class ModulePermissions:
    """Snapshot de permisos de un usuario en un módulo y empresa+sucursal.

    flags: dict de NOMBRE_FLAG → True/False. Ej: {'PERMITE_FACTURAR': True, 'IMPRIMIR_DOCU': False}.
    extras: campos no booleanos (ej. ALMACEN, CAJERO, NO_CLIENTE, AUTORIZACION_1..3).
    document_perms: lista de tipos doc autorizados con su detalle, ej.
        [{'tipo_docu': 'FC', 'por_defecto': True}, ...]
    """
    no_cia: str
    punto: str
    usuario: str
    modulo: str
    activo: bool
    por_defecto: bool
    flags: dict[str, bool]
    extras: dict[str, Any]
    document_perms: list[dict[str, Any]]

    def has(self, flag: str) -> bool:
        return self.flags.get(flag.upper(), False)

    def to_dict(self) -> dict[str, Any]:
        return {
            'no_cia': self.no_cia,
            'punto': self.punto,
            'usuario': self.usuario,
            'modulo': self.modulo,
            'activo': self.activo,
            'por_defecto': self.por_defecto,
            'flags': self.flags,
            'extras': self.extras,
            'document_perms': self.document_perms,
        }


@dataclass(frozen=True)
class NCFRange:
    no_cia: str
    punto: str
    codigo_ncf: str
    tipo_ncf_fiscal: str
    ncf_inicial: int
    ncf_final: int
    prox_ncf: int
    ncf_manual: bool
    ncf_opcional: bool
    cant_min_ncf: int

    @property
    def disponibles(self) -> int:
        return max(0, self.ncf_final - self.prox_ncf + 1)

    @property
    def low_stock(self) -> bool:
        """True cuando los disponibles bajaron al umbral mínimo configurado."""
        if self.cant_min_ncf <= 0:
            return False
        return self.disponibles <= self.cant_min_ncf

    @property
    def critical(self) -> bool:
        """True cuando queda menos del 25% del rango total — siempre alerta."""
        total = max(1, self.ncf_final - self.ncf_inicial + 1)
        return (self.disponibles / total) <= 0.25

    def to_dict(self) -> dict[str, Any]:
        return {
            **asdict(self),
            'disponibles': self.disponibles,
            'low_stock': self.low_stock,
            'critical': self.critical,
        }


@dataclass(frozen=True)
class DocumentType:
    no_cia: str
    tipo_docu: str
    descripcion: str
    tipo_transaccion: str
    activo: bool
    codigo_ncf: str | None
    cuenta_contado: str | None = None
    cuenta_propina: str | None = None
    porciento_propina: float | None = None
    afecta_cxc: bool = False
    controlar_formulario: bool = False
    almacen: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
