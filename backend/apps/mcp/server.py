"""Servidor MCP HTTP. Registra tools y construye la app ASGI.

Las tools de modulos (FAT, CXC, ...) se registran en siguientes planes.
"""
# NOTA: NO usar `from __future__ import annotations` aqui. Pydantic/FastMCP
# necesita evaluar las anotaciones reales (Optional[str], etc.) para construir
# el inputSchema de cada tool.
import inspect
import time
from typing import Any, Awaitable, Callable, Optional

from mcp.server.fastmcp import FastMCP, Context

from . import auth as auth_mod
from . import audit as audit_mod
from . import ratelimit as rate_mod
from .envelope import error
from .tools import memoria, doc_types_tools


_mcp: Optional[FastMCP] = None


def _request_ip(ctx: Optional[Context]) -> Optional[str]:
    try:
        req = getattr(ctx, "request", None) or getattr(ctx, "request_context", None)
        if req is None:
            return None
        client = getattr(req, "client", None)
        return client.host if client else None
    except Exception:
        return None


def _request_auth_header(ctx: Optional[Context]) -> Optional[str]:
    try:
        req = getattr(ctx, "request", None) or getattr(ctx, "request_context", None)
        if req is None:
            return None
        headers = getattr(req, "headers", None)
        if headers is None:
            return None
        return headers.get("authorization")
    except Exception:
        return None


def _wrap_tool(name: str, fn: Callable[..., Awaitable[dict]]):
    """Decora una tool con auth + rate-limit + audit + envelope."""

    async def wrapper(**kwargs: Any) -> dict:
        ctx: Optional[Context] = kwargs.pop("ctx", None)
        t0 = time.time()
        try:
            tctx = auth_mod.authenticate_bearer(_request_auth_header(ctx), ip=_request_ip(ctx))
        except auth_mod.AuthError as e:
            return error(e.code, e.message)

        limiter = rate_mod.get_limiter()
        if not limiter.allow(tctx.token_id):
            audit_mod.log_usage(
                token_id=tctx.token_id,
                tool=name,
                params_hash=None,
                ip=_request_ip(ctx),
                ok=False,
                error_code="RATE_LIMITED",
                duration_ms=int((time.time() - t0) * 1000),
            )
            return error("RATE_LIMITED", "60 calls/min superado para este token")

        params_hash = audit_mod.hash_params(kwargs)
        try:
            out = await fn(**kwargs)
        except Exception as e:  # noqa: BLE001
            audit_mod.log_usage(
                token_id=tctx.token_id,
                tool=name,
                params_hash=params_hash,
                ip=_request_ip(ctx),
                ok=False,
                error_code="ORACLE_ERROR",
                duration_ms=int((time.time() - t0) * 1000),
            )
            return error("ORACLE_ERROR", "Error interno", {"detail": str(e)[:200]})

        ok_flag = bool(out.get("ok", True))
        audit_mod.log_usage(
            token_id=tctx.token_id,
            tool=name,
            params_hash=params_hash,
            ip=_request_ip(ctx),
            ok=ok_flag,
            error_code=None if ok_flag else out.get("error_code"),
            duration_ms=int((time.time() - t0) * 1000),
        )
        return out

    wrapper.__name__ = name
    wrapper.__doc__ = getattr(fn, "__doc__", None)

    # Propagar la signature de la tool original asi FastMCP genera el
    # inputSchema con los params reales (no kwargs).
    orig_sig = inspect.signature(fn)
    ctx_param = inspect.Parameter("ctx", inspect.Parameter.KEYWORD_ONLY, annotation=Context)
    new_params = [
        inspect.Parameter(p.name, inspect.Parameter.KEYWORD_ONLY,
                          default=p.default, annotation=p.annotation)
        for p in orig_sig.parameters.values()
    ] + [ctx_param]
    wrapper.__signature__ = orig_sig.replace(parameters=new_params)
    wrapper.__annotations__ = {p.name: p.annotation for p in new_params}
    wrapper.__annotations__["return"] = dict
    return wrapper


def build_mcp() -> FastMCP:
    global _mcp
    if _mcp is not None:
        return _mcp

    # streamable_http_path='/' para que cuando Starlette monte este app en
    # '/mcp' la URL final sea '/mcp/' (sin doble prefijo /mcp/mcp).
    server = FastMCP(name="ZentoryERP MCP", stateless_http=True, streamable_http_path="/")

    # === Memoria (proxy a memory-router) ===
    server.add_tool(
        _wrap_tool("memoria_buscar", memoria.memoria_buscar),
        name="memoria_buscar",
        description="Busca en las memorias del proyecto (proxy memory_search).",
    )
    server.add_tool(
        _wrap_tool("memoria_obtener", memoria.memoria_obtener),
        name="memoria_obtener",
        description="Devuelve memorias por ID (proxy memory_get).",
    )
    server.add_tool(
        _wrap_tool("memoria_briefing", memoria.memoria_briefing),
        name="memoria_briefing",
        description="Briefing del proyecto desde memory-router.",
    )
    server.add_tool(
        _wrap_tool("memoria_skills_disponibles", memoria.memoria_skills_disponibles),
        name="memoria_skills_disponibles",
        description="Listado de skills configuradas en memory-router.",
    )
    server.add_tool(
        _wrap_tool("memoria_obtener_skill", memoria.memoria_obtener_skill),
        name="memoria_obtener_skill",
        description="Contenido completo de una skill por nombre.",
    )

    # === Tipos de documento (registry transversal) ===
    async def _doc_listar(modulo: str, no_cia: str, punto: Optional[str] = None) -> dict:
        return doc_types_tools.doc_tipos_listar(modulo, no_cia, punto)

    async def _doc_describir(
        modulo: str, no_cia: str, tipo_documento: str, punto: Optional[str] = None
    ) -> dict:
        return doc_types_tools.doc_tipos_describir(modulo, no_cia, tipo_documento, punto)

    server.add_tool(
        _wrap_tool("doc_tipos_listar", _doc_listar),
        name="doc_tipos_listar",
        description="Lista tipos de documento de un modulo para una cia/punto.",
    )
    server.add_tool(
        _wrap_tool("doc_tipos_describir", _doc_describir),
        name="doc_tipos_describir",
        description="Devuelve schema completo de un tipo de documento.",
    )

    _mcp = server
    return _mcp
