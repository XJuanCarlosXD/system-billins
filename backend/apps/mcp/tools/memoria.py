"""Tools MCP que envuelven memory-router con prefijo `memoria_*`."""
from typing import Optional

from django.conf import settings

from ..memory_proxy import MemoryProxy


_proxy: Optional[MemoryProxy] = None


def get_proxy() -> MemoryProxy:
    global _proxy
    if _proxy is None:
        _proxy = MemoryProxy(
            settings.MEMORY_ROUTER_URL,
            settings.MEMORY_ROUTER_TOKEN,
            settings.MEMORY_ROUTER_PROJECT,
        )
    return _proxy


async def memoria_buscar(query: str, limit: int = 10) -> dict:
    """Busca en las memorias del proyecto (proxy memory_search)."""
    return await get_proxy().buscar(query, limit)


async def memoria_obtener(ids: list) -> dict:
    """Devuelve memorias por ID (proxy memory_get)."""
    return await get_proxy().obtener(ids)


async def memoria_briefing() -> dict:
    """Briefing del proyecto desde memory-router."""
    return await get_proxy().briefing()


async def memoria_skills_disponibles() -> dict:
    """Listado de skills configuradas en memory-router."""
    return await get_proxy().skills_disponibles()


async def memoria_obtener_skill(nombre: str) -> dict:
    """Contenido completo de una skill por nombre."""
    return await get_proxy().obtener_skill(nombre)
