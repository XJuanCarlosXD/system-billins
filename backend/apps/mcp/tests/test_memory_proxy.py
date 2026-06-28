import httpx
import pytest

from apps.mcp.memory_proxy import MemoryProxy


@pytest.mark.asyncio
async def test_buscar_calls_router_and_returns_results():
    def handler(request: httpx.Request):
        assert request.url.path.endswith("/tools/memory_search")
        assert request.headers["Authorization"] == "Bearer secret"
        assert request.headers["X-Memory-Project"] == "facture-project"
        return httpx.Response(200, json={"result": "ok-data"})

    transport = httpx.MockTransport(handler)
    proxy = MemoryProxy("http://memrouter", "secret", "facture-project", _transport=transport)
    out = await proxy.buscar("hola", limit=3)
    assert out["ok"] is True
    assert out["data"] == "ok-data"


@pytest.mark.asyncio
async def test_router_down_returns_upstream_unavailable():
    def handler(request):
        raise httpx.ConnectError("connection refused")
    proxy = MemoryProxy("http://x", "s", "p", _transport=httpx.MockTransport(handler))
    out = await proxy.buscar("q")
    assert out["ok"] is False
    assert out["error_code"] == "UPSTREAM_UNAVAILABLE"
