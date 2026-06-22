"""Resuelve (no_cia, punto) efectivos para una llamada MCP.

Cascada:
  1. Si token.bloquear_cia: cia = token.no_cia; arg distinto -> VALIDATION_ERROR
  2. Si arg presente: validar contra access, usar arg
  3. Si token.no_cia presente (default): usar token.no_cia
  4. Si access tiene exactamente 1 cia: usar esa
  5. Si no: MISSING_CONTEXT con empresas disponibles
Mismo flujo para PUNTO sobre puntos del cia resuelto.
"""
from typing import Optional

from .envelope import MCPError
from .tokens import TokenContext


def _resolve_dim(
    dim: str,
    bloqueado: bool,
    token_val: Optional[str],
    arg_val: Optional[str],
    opciones: list,
) -> str:
    if bloqueado:
        if token_val is None:
            raise MCPError(
                "VALIDATION_ERROR",
                f"Token bloqueado sin {dim} configurado",
                {"campo": dim},
            )
        if arg_val is not None and arg_val != token_val:
            raise MCPError(
                "VALIDATION_ERROR",
                f"Token bloqueado a {dim} {token_val}, no se permite override.",
                {"campo": dim, "valor_token": token_val, "valor_recibido": arg_val},
            )
        return token_val

    if arg_val is not None:
        if arg_val not in opciones:
            raise MCPError(
                "PERMISSION_DENIED",
                f"Usuario sin acceso a {dim}={arg_val}",
                {"campo": dim, "valor_recibido": arg_val, "disponibles": opciones},
            )
        return arg_val

    if token_val is not None:
        if token_val not in opciones:
            raise MCPError(
                "PERMISSION_DENIED",
                f"Default del token ({dim}={token_val}) ya no es accesible para el usuario",
                {"campo": dim, "valor_token": token_val, "disponibles": opciones},
            )
        return token_val

    if len(opciones) == 1:
        return opciones[0]

    raise MCPError(
        "MISSING_CONTEXT",
        f"El token no fija {dim} por defecto y el usuario tiene acceso a varias opciones.",
        {"campo_faltante": dim, "opciones_disponibles": opciones},
    )


def resolve_context(
    token: TokenContext,
    *,
    arg_no_cia: Optional[str],
    arg_punto: Optional[str],
    access: dict,
) -> tuple:
    """access: { no_cia: [puntos] } al que tiene acceso el usuario."""
    cias = list(access.keys())

    try:
        cia = _resolve_dim(
            "no_cia",
            token.bloquear_cia,
            token.no_cia,
            arg_no_cia,
            cias,
        )
    except MCPError as e:
        if e.code == "MISSING_CONTEXT":
            e.detail["empresas_disponibles"] = [
                {"no_cia": c, "descripcion": ""} for c in cias
            ]
        raise

    puntos = access.get(cia, [])
    try:
        punto = _resolve_dim(
            "punto",
            token.bloquear_punto,
            token.punto,
            arg_punto,
            puntos,
        )
    except MCPError as e:
        if e.code == "MISSING_CONTEXT":
            e.detail["puntos_disponibles"] = [
                {"no_cia": cia, "punto": p} for p in puntos
            ]
        raise

    return cia, punto
