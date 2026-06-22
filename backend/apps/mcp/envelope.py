"""Envelope uniforme para respuestas MCP: {ok, data | error_code, message, detail}."""
from typing import Any, Optional


def ok(data: Any) -> dict:
    return {"ok": True, "data": data}


def error(code: str, message: str, detail: Optional[dict] = None) -> dict:
    out = {"ok": False, "error_code": code, "message": message}
    if detail is not None:
        out["detail"] = detail
    return out


class MCPError(Exception):
    def __init__(self, code: str, message: str, detail: Optional[dict] = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.detail = detail or {}

    def as_dict(self) -> dict:
        return error(self.code, self.message, self.detail)
