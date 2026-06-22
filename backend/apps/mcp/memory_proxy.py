"""Cliente HTTP hacia el MCP memory-router. Resiliente: errores propios no tumban el server."""
from typing import Any, Optional

import httpx

from .envelope import ok, error


class MemoryProxy:
    def __init__(self, url: str, token: str, project: str, *, _transport=None):
        self.url = url.rstrip("/")
        self.token = token
        self.project = project
        self._client = httpx.AsyncClient(
            base_url=self.url,
            timeout=8.0,
            transport=_transport,
            headers={
                "Authorization": f"Bearer {token}",
                "X-Memory-Project": project,
            },
        )

    async def _call(self, tool: str, args: dict) -> dict:
        try:
            r = await self._client.post(f"/tools/{tool}", json=args)
            r.raise_for_status()
            return ok(r.json().get("result"))
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
