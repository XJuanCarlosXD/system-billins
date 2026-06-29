"""Tool registry del asistente.

Cada modulo (memoria, doc_types, skills, FAT, CHC, ...) registra sus tools
via `register_tool(ToolSpec(...))` al ser importado. El agent loop consulta
`list_for_user(user)` para obtener la lista filtrada por permisos de modulo.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable


HandlerType = Callable[..., Awaitable[Any]]


@dataclass
class ToolSpec:
    name: str
    description: str
    input_schema: dict
    handler: HandlerType
    write: bool = False
    modules_required: list[str] = field(default_factory=list)


REGISTRY: dict[str, ToolSpec] = {}


def register_tool(spec: ToolSpec) -> None:
    REGISTRY[spec.name] = spec


def get_tool(name: str) -> ToolSpec | None:
    return REGISTRY.get(name)


def list_for_user(user) -> list[ToolSpec]:
    """Filtra el REGISTRY por los flags de modulo del usuario.

    Tools sin `modules_required` (memoria/doc_types/skills) son universales.
    Tools con `modules_required=['FAT']` solo aparecen si el usuario tiene al
    menos un (no_cia, punto) con `FAT.ACTIVO = 'S'`.
    """
    from apps.asistente.tools.permissions import get_user_module_flags

    flags = get_user_module_flags(user)
    out: list[ToolSpec] = []
    for spec in REGISTRY.values():
        if all(flags.get(m) == "S" for m in spec.modules_required):
            out.append(spec)
    return out
