"""Agent loop: orquesta provider + tools + persistencia.

Fase 1 (PR1 Task 4-5): `dispatch_tool` con los 4 gates iniciales.
Fase 2 (PR1 Task 5):    `AgentLoop.run` async generator que yieldea SSE.
"""

from __future__ import annotations

import inspect
import time
from dataclasses import dataclass
from typing import Any

from apps.asistente.tools import permissions as _perms
from apps.asistente.tools.registry import REGISTRY, ToolSpec, get_tool


class ToolError(Exception):
    def __init__(self, code: str, message: str = ""):
        super().__init__(message or code)
        self.code = code
        self.message = message or code


@dataclass
class ToolResult:
    ok: bool
    data: Any = None
    error_code: str = ""
    error_message: str = ""
    duration_ms: int = 0
    was_write: bool = False


async def dispatch_tool(
    user, name: str, args: dict | None = None
) -> ToolResult:
    """Ejecuta una tool aplicando las 4 capas de gates:

    1. registry: la tool existe y el usuario tiene los modulos requeridos.
    2. no_cia : si los args traen `no_cia`, el usuario tiene acceso a esa cia.
    3. punto  : si traen `(no_cia, punto)`, el usuario tiene ese punto.
    4. USUARIOD: si la tool indica `modulo + tipo_docu + accion` en args
       especiales (`_perm_modulo`, `_perm_tipo_docu`, `_perm_accion`), gate
       contra TUSUARIOD.

    Retorna `ToolResult` siempre (nunca lanza); errores caen en `ok=False`.
    """
    args = dict(args or {})
    started = time.monotonic()

    spec: ToolSpec | None = get_tool(name)
    if spec is None:
        return ToolResult(
            ok=False,
            error_code="UNKNOWN_TOOL",
            error_message=f"Tool '{name}' no esta registrada",
        )

    # Capa 1: modulos requeridos.
    flags = _perms.get_user_module_flags(user)
    missing = [m for m in spec.modules_required if flags.get(m) != "S"]
    if missing:
        return ToolResult(
            ok=False,
            error_code="FORBIDDEN_MODULE",
            error_message=f"Modulos faltantes: {','.join(missing)}",
            was_write=spec.write,
        )

    # Capa 2: no_cia.
    no_cia = args.get("no_cia") or args.get("NO_CIA")
    if no_cia and not _perms.user_has_cia(user, no_cia):
        return ToolResult(
            ok=False,
            error_code="FORBIDDEN_CIA",
            error_message=f"Usuario sin acceso a la cia {no_cia}",
            was_write=spec.write,
        )

    # Capa 3: punto.
    punto = args.get("punto") or args.get("PUNTO")
    if no_cia and punto and not _perms.user_has_punto(user, no_cia, punto):
        return ToolResult(
            ok=False,
            error_code="FORBIDDEN_PUNTO",
            error_message=f"Usuario sin acceso al punto {no_cia}/{punto}",
            was_write=spec.write,
        )

    # Capa 4: USUARIOD (solo si la tool lo declara via metadata en args).
    perm_modulo = args.pop("_perm_modulo", None)
    perm_tipo = args.pop("_perm_tipo_docu", None)
    perm_accion = args.pop("_perm_accion", "lectura")
    if perm_modulo and perm_tipo:
        if not _perms.user_can_doc(
            user, perm_modulo, no_cia or "", punto or "", perm_tipo, perm_accion
        ):
            return ToolResult(
                ok=False,
                error_code="FORBIDDEN_DOC",
                error_message=(
                    f"Usuario sin acceso al tipo {perm_modulo}/{perm_tipo}"
                ),
                was_write=spec.write,
            )

    # Ejecuta el handler.
    try:
        handler = spec.handler
        # El handler puede recibir 'user' como kwarg si lo declara.
        sig = inspect.signature(handler)
        kwargs = dict(args)
        if "user" in sig.parameters:
            kwargs["user"] = user
        result = handler(**kwargs)
        if inspect.isawaitable(result):
            result = await result
        return ToolResult(
            ok=True,
            data=result,
            duration_ms=int((time.monotonic() - started) * 1000),
            was_write=spec.write,
        )
    except ToolError as exc:
        return ToolResult(
            ok=False,
            error_code=exc.code,
            error_message=exc.message,
            duration_ms=int((time.monotonic() - started) * 1000),
            was_write=spec.write,
        )
    except Exception as exc:  # noqa: BLE001
        return ToolResult(
            ok=False,
            error_code="HANDLER_ERROR",
            error_message=str(exc),
            duration_ms=int((time.monotonic() - started) * 1000),
            was_write=spec.write,
        )
