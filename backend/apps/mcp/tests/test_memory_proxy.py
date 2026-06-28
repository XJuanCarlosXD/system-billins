import json

import httpx
import pytest

from apps.mcp.memory_proxy import MemoryProxy


@pytest.mark.asyncio
async def test_buscar_calls_router_jsonrpc_and_returns_results():
    """memory-router responde como SSE con un `data: {jsonrpc...}` con
    `result.structuredContent.result` o `result.content[0].text`. El proxy
    desempaqueta lo util."""

    def handler(request: httpx.Request):
        assert request.url.path.endswith("/mcp")
        assert request.headers["Authorization"] == "Bearer secret"
        assert request.headers["X-Memory-Project"] == "facture-project"
        body = json.loads(request.content.decode())
        assert body["method"] == "tools/call"
        assert body["params"]["name"] == "memory_search"
        assert body["params"]["arguments"] == {"query": "hola", "limit": 3}
        rpc = {
            "jsonrpc": "2.0",
            "id": body["id"],
            "result": {
                "content": [{"type": "text", "text": "ok-data"}],
                "structuredContent": {"result": "ok-data"},
                "isError": False,
            },
        }
        return httpx.Response(
            200,
            text=f"event: message\ndata: {json.dumps(rpc)}\n\n",
            headers={"Content-Type": "text/event-stream"},
        )

    transport = httpx.MockTransport(handler)
    proxy = MemoryProxy(
        "http://memrouter/mcp", "secret", "facture-project", _transport=transport
    )
    out = await proxy.buscar("hola", limit=3)
    assert out["ok"] is True
    assert out["data"] == "ok-data"


@pytest.mark.asyncio
async def test_router_down_returns_upstream_unavailable():
    def handler(request):
        raise httpx.ConnectError("connection refused")

    proxy = MemoryProxy(
        "http://x/mcp", "s", "p", _transport=httpx.MockTransport(handler)
    )
    out = await proxy.buscar("q")
    assert out["ok"] is False
    assert out["error_code"] == "UPSTREAM_UNAVAILABLE"


@pytest.mark.asyncio
async def test_router_jsonrpc_error_returns_upstream_error():
    def handler(request):
        rpc = {
            "jsonrpc": "2.0",
            "id": 1,
            "error": {"code": -32601, "message": "Method not found"},
        }
        return httpx.Response(
            200,
            text=f"data: {json.dumps(rpc)}\n\n",
            headers={"Content-Type": "text/event-stream"},
        )

    proxy = MemoryProxy(
        "http://x/mcp", "s", "p", _transport=httpx.MockTransport(handler)
    )
    out = await proxy.buscar("q")
    assert out["ok"] is False
    assert out["error_code"] == "UPSTREAM_ERROR"
