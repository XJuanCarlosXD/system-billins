"""Smoke test del servidor MCP: confirma que las tools esperadas estan registradas."""
import pytest


@pytest.mark.asyncio
async def test_server_registers_expected_tools():
    from apps.mcp.server import build_mcp

    server = build_mcp()
    tools = await server.list_tools()
    names = {t.name for t in tools}

    assert "memoria_buscar" in names
    assert "memoria_obtener" in names
    assert "memoria_briefing" in names
    assert "memoria_skills_disponibles" in names
    assert "memoria_obtener_skill" in names
    assert "doc_tipos_listar" in names
    assert "doc_tipos_describir" in names


def test_server_streamable_http_app_builds():
    from apps.mcp.server import build_mcp

    server = build_mcp()
    app = server.streamable_http_app()
    assert app is not None
