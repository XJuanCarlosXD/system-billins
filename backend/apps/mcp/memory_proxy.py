"""Cliente JSON-RPC hacia el MCP memory-router. Resiliente: errores propios no tumban el server.

memory-router habla MCP Streamable HTTP (POST con `Accept: application/json, text/event-stream`)
y devuelve la respuesta como un unico `data: <json>` SSE. No es REST `/tools/<name>`.
"""
import itertools
import json
from typing import Any, Optional

import httpx

from .envelope import ok, error


_id_counter = itertools.count(1)


class MemoryProxy:
    def __init__(self, url: str, token: str, project: str, *, _transport=None):
        # url debe ser el endpoint MCP completo (ej. https://mcp.aiviber.io/mcp).
        self.url = url
        self.token = token
        self.project = project
        self._client = httpx.AsyncClient(
            timeout=15.0,
            transport=_transport,
            headers={
                "Authorization": f"Bearer {token}",
                "X-Memory-Project": project,
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
            },
        )

    @staticmethod
    def _parse_sse_or_json(body_text: str) -> Optional[dict]:
        """Devuelve el primer payload JSON encontrado, sea SSE (`data: {...}`) o JSON plano."""
        body_text = body_text.strip()
        if not body_text:
            return None
        if body_text.startswith("{"):
            try:
                return json.loads(body_text)
            except json.JSONDecodeError:
                return None
        for line in body_text.splitlines():
            line = line.strip()
            if line.startswith("data:"):
                payload = line[5:].strip()
                if payload:
                    try:
                        return json.loads(payload)
                    except json.JSONDecodeError:
                        continue
        return None

    @staticmethod
    def _extract_result(rpc: dict) -> Any:
        """De un JSON-RPC response MCP `tools/call`, saca el contenido util.

        Prioridad: structuredContent.result > content[0].text (parseado si JSON) > content > None.
        """
        result = rpc.get("result") or {}
        if isinstance(result, dict):
            structured = result.get("structuredContent")
            if isinstance(structured, dict) and "result" in structured:
                return structured["result"]
            content = result.get("content")
            if isinstance(content, list) and content:
                first = content[0] or {}
                text = first.get("text")
                if isinstance(text, str):
                    try:
                        return json.loads(text)
                    except json.JSONDecodeError:
                        return text
                return content
            return result
        return result

    async def _call(self, tool: str, args: dict) -> dict:
        req = {
            "jsonrpc": "2.0",
            "id": next(_id_counter),
            "method": "tools/call",
            "params": {"name": tool, "arguments": args},
        }
        try:
            r = await self._client.post(self.url, json=req)
            r.raise_for_status()
            rpc = self._parse_sse_or_json(r.text)
            if rpc is None:
                return error(
                    "UPSTREAM_ERROR",
                    "respuesta vacia/ininteligible de memory-router",
                    {"body": r.text[:500]},
                )
            if "error" in rpc and rpc["error"]:
                rpc_err = rpc["error"] or {}
                return error(
                    "UPSTREAM_ERROR",
                    f"memory-router JSON-RPC error {rpc_err.get('code')}",
                    {"message": rpc_err.get("message"), "data": rpc_err.get("data")},
                )
            return ok(self._extract_result(rpc))
        except (httpx.ConnectError, httpx.ReadTimeout, httpx.RemoteProtocolError) as e:
            return error(
                "UPSTREAM_UNAVAILABLE",
                "memory-router no disponible",
                {"detail": str(e)},
            )
        except httpx.HTTPStatusError as e:
            return error(
                "UPSTREAM_ERROR",
                f"memory-router HTTP {e.response.status_code}",
                {"body": e.response.text[:500]},
            )

    async def buscar(self, query: str, limit: int = 10) -> dict:
        return await self._call("memory_search", {"query": query, "limit": limit})

    async def obtener(self, ids: list) -> dict:
        return await self._call("memory_get", {"ids": ids})

    async def briefing(self) -> dict:
        return await self._call("memory_briefing", {})

    async def skills_disponibles(self) -> dict:
        return await self._call("memory_list_agents", {})

    async def obtener_skill(self, nombre: str) -> dict:
        return await self._call("memory_get_skill", {"name": nombre})
