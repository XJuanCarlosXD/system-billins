"""Middleware Bearer -> TokenContext para tools MCP."""
from typing import Optional

from .tokens import lookup_token, touch_token, TokenContext


class AuthError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def authenticate_bearer(authorization_header: Optional[str], *, ip: Optional[str]) -> TokenContext:
    if not authorization_header:
        raise AuthError("MISSING_AUTH", "Falta header Authorization")
    parts = authorization_header.strip().split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1]:
        raise AuthError("MISSING_AUTH", "Header Authorization debe ser 'Bearer <token>'")

    plaintext = parts[1].strip()
    ctx = lookup_token(plaintext)
    if ctx is None:
        raise AuthError("INVALID_TOKEN", "Token invalido, expirado o revocado")

    try:
        touch_token(ctx.token_id, ip)
    except Exception:
        pass

    return ctx
