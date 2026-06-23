import os
from contextlib import asynccontextmanager

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'facturation_api.settings')

_django_app = get_asgi_application()

# Montar servidor MCP en /mcp/. Django sigue sirviendo el resto.
from starlette.applications import Starlette  # noqa: E402
from starlette.routing import Mount  # noqa: E402

from apps.mcp.server import build_mcp  # noqa: E402

_mcp_server = build_mcp()
_mcp_app = _mcp_server.streamable_http_app()


@asynccontextmanager
async def _lifespan(app):
    # streamable_http_app necesita que el session_manager este corriendo.
    async with _mcp_server.session_manager.run():
        yield


application = Starlette(
    routes=[
        Mount("/mcp", app=_mcp_app),
        Mount("/", app=_django_app),
    ],
    lifespan=_lifespan,
)
