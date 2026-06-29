"""Tests del AgentLoop (PR1 Task 5).

MockProvider: yieldea una secuencia scripteada de ProviderEvent.
"""

import asyncio
from dataclasses import dataclass, field
from types import SimpleNamespace
from typing import AsyncIterator

import pytest

from apps.asistente.persist import (
    InMemoryHistoryStore,
    InMemoryPendingStore,
)
from apps.asistente.providers.base import (
    MessageComplete,
    ProviderEvent,
    TextDelta,
    ToolUse,
)


@dataclass
class MockProvider:
    default_model: str = "mock-model"
    scripts: list[list[ProviderEvent]] = field(default_factory=list)
    _calls: int = 0
    captured: list[dict] = field(default_factory=list)

    async def stream(self, *, system, messages, tools=None, model=None,
                     max_tokens=1024) -> AsyncIterator[ProviderEvent]:
        self.captured.append({
            "system": system,
            "messages": list(messages),
            "tools": list(tools or []),
        })
        events = self.scripts[self._calls]
        self._calls += 1
        for ev in events:
            yield ev


def _user():
    return SimpleNamespace(username="ZZTEST")


def _make_loop(provider, **kw):
    from apps.asistente.agent_loop import AgentLoop

    return AgentLoop(
        provider=provider,
        history_store=InMemoryHistoryStore(),
        pending_store=InMemoryPendingStore(),
        max_turns=kw.get("max_turns", 5),
        daily_budget_usd=kw.get("daily_budget_usd", 1.0),
        pending_ttl_sec=kw.get("pending_ttl_sec", 60),
    )


@pytest.mark.asyncio
async def test_simple_text_response_no_tools(monkeypatch):
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {"FAT": "S"},
    )
    provider = MockProvider(scripts=[[
        TextDelta(text="Hola "),
        TextDelta(text="mundo"),
        MessageComplete(stop_reason="end_turn", tokens_in=10, tokens_out=2),
    ]])
    loop = _make_loop(provider)

    events = []
    async for ev in loop.run(conv_id="c1", user_message="hola", user=_user()):
        events.append(ev)

    kinds = [e["event"] for e in events]
    assert kinds[0] == "turn_started"
    tokens = [e["data"]["text"] for e in events if e["event"] == "token"]
    assert tokens == ["Hola ", "mundo"]
    last = events[-1]
    assert last["event"] == "message_complete"
    assert last["data"]["stopped_for_confirm"] is False
    assert last["data"]["tokens_in"] == 10
    assert last["data"]["tokens_out"] == 2


@pytest.mark.asyncio
async def test_tool_use_then_text(monkeypatch):
    """Provider pide una tool -> agent dispatcha -> provider 2do turno -> texto."""
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {"FAT": "S"},
    )

    # Registramos una tool dummy read-only que el dispatch puede llamar.
    from apps.asistente.tools.registry import REGISTRY, ToolSpec

    async def _h(query):
        return {"hits": [{"no_cliente": "001234", "nombre": "JUAN PEREZ"}]}

    REGISTRY["zz_fat_test_buscar"] = ToolSpec(
        name="zz_fat_test_buscar",
        description="x",
        input_schema={"type": "object",
                      "properties": {"query": {"type": "string"}},
                      "required": ["query"]},
        handler=_h,
    )

    provider = MockProvider(scripts=[
        # Turno 1: pide la tool.
        [
            ToolUse(call_id="t1", name="zz_fat_test_buscar",
                    args={"query": "PEREZ"}),
            MessageComplete(stop_reason="tool_use",
                            tokens_in=20, tokens_out=10),
        ],
        # Turno 2: responde texto final.
        [
            TextDelta(text="Encontre 1 cliente."),
            MessageComplete(stop_reason="end_turn",
                            tokens_in=30, tokens_out=5),
        ],
    ])
    loop = _make_loop(provider)

    events = []
    async for ev in loop.run(conv_id="c2", user_message="buscame PEREZ",
                             user=_user()):
        events.append(ev)

    kinds = [e["event"] for e in events]
    assert "tool_call" in kinds
    assert "tool_result" in kinds
    assert kinds[-1] == "message_complete"
    final_text = "".join(
        e["data"]["text"] for e in events if e["event"] == "token"
    )
    assert "Encontre" in final_text


@pytest.mark.asyncio
async def test_write_tool_pauses_for_confirm(monkeypatch):
    """Tool con write=True dispara tool_pending y espera confirm."""
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {"FAT": "S"},
    )

    from apps.asistente.agent_loop import signal_confirm
    from apps.asistente.tools.registry import REGISTRY, ToolSpec

    async def _h(monto):
        return {"ok": True, "no_doc": "FT-0001", "monto": monto}

    REGISTRY["zz_fat_test_crear"] = ToolSpec(
        name="zz_fat_test_crear",
        description="crea factura test",
        input_schema={"type": "object",
                      "properties": {"monto": {"type": "number"}}},
        handler=_h,
        write=True,
    )

    provider = MockProvider(scripts=[
        [
            ToolUse(call_id="w1", name="zz_fat_test_crear",
                    args={"monto": 5000.0}),
            MessageComplete(stop_reason="tool_use",
                            tokens_in=15, tokens_out=8),
        ],
        [
            TextDelta(text="Factura creada FT-0001"),
            MessageComplete(stop_reason="end_turn",
                            tokens_in=20, tokens_out=5),
        ],
    ])
    loop = _make_loop(provider, pending_ttl_sec=2)

    captured: list[dict] = []
    gen = loop.run(conv_id="c3", user_message="crea factura", user=_user())

    async def _consume():
        async for ev in gen:
            captured.append(ev)
            if ev["event"] == "tool_pending":
                # Confirm desde "el otro lado" (HTTP confirm view).
                await asyncio.sleep(0.05)
                assert signal_confirm(ev["data"]["sig"], approved=True,
                                      by="ZZTEST") is True

    await asyncio.wait_for(_consume(), timeout=5.0)

    kinds = [e["event"] for e in captured]
    assert "tool_pending" in kinds
    # Tras confirm, debe ejecutar y emitir tool_result + segundo turno + final.
    assert "tool_result" in kinds
    assert kinds[-1] == "message_complete"


@pytest.mark.asyncio
async def test_max_turns_safety_cap(monkeypatch):
    """Si el modelo loopea pidiendo tools, max_turns lo corta."""
    monkeypatch.setattr(
        "apps.asistente.tools.permissions.get_user_module_flags",
        lambda u: {"FAT": "S"},
    )

    from apps.asistente.tools.registry import REGISTRY, ToolSpec

    async def _h(**_):
        return {"x": 1}

    REGISTRY["zz_loop_tool"] = ToolSpec(
        name="zz_loop_tool",
        description="loop",
        input_schema={"type": "object", "properties": {}},
        handler=_h,
    )

    # Cada turno pide la misma tool -> nunca termina por si solo.
    loop_script = [
        ToolUse(call_id="lN", name="zz_loop_tool", args={}),
        MessageComplete(stop_reason="tool_use", tokens_in=5, tokens_out=2),
    ]
    provider = MockProvider(scripts=[list(loop_script) for _ in range(20)])
    loop = _make_loop(provider, max_turns=3)

    events = []
    async for ev in loop.run(conv_id="c4", user_message="x", user=_user()):
        events.append(ev)

    # Debe terminar con tool_error MAX_TURNS_EXCEEDED.
    errors = [e for e in events
              if e["event"] == "tool_error"
              and e["data"].get("error_code") == "MAX_TURNS_EXCEEDED"]
    assert len(errors) == 1
