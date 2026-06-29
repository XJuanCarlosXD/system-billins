"""Tests de ClaudeProvider con un MockAnthropic in-memory.

El mock implementa el shape minimo que el provider toca:
- client.messages.create(stream=True, ...)  -> async iterator de eventos
- cada evento tiene .type y campos correspondientes (.delta, .content_block,
  .usage, .message, .index, etc).
"""

from dataclasses import dataclass, field
from typing import Any

import pytest


# ---------------------------------------------------------------------------
# Mock helpers
# ---------------------------------------------------------------------------


@dataclass
class _Ns:
    """SimpleNamespace casero compatible con getattr(..., default)."""
    _data: dict = field(default_factory=dict)

    def __getattr__(self, name):
        if name == "_data":
            raise AttributeError(name)
        return self._data.get(name)


def ns(**kw):
    return _Ns(_data=kw)


class _AsyncStream:
    def __init__(self, events):
        self._events = list(events)

    def __aiter__(self):
        return self

    async def __anext__(self):
        if not self._events:
            raise StopAsyncIteration
        return self._events.pop(0)


class _MockMessages:
    def __init__(self, events, capture):
        self._events = events
        self._capture = capture

    async def create(self, *, stream, **kwargs):
        assert stream is True
        self._capture.update(kwargs)
        return _AsyncStream(self._events)


class MockAnthropic:
    def __init__(self, events):
        self.capture: dict[str, Any] = {}
        self.messages = _MockMessages(events, self.capture)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_stream_emits_text_deltas():
    """Test base TDD: el provider traduce text_delta del SDK a TextDelta."""
    from apps.asistente.providers.base import (
        MessageComplete,
        TextDelta,
    )
    from apps.asistente.providers.claude import ClaudeProvider

    events = [
        ns(
            type="message_start",
            message=ns(
                usage=ns(
                    input_tokens=12,
                    cache_read_input_tokens=0,
                    cache_creation_input_tokens=0,
                )
            ),
        ),
        ns(type="content_block_start", index=0, content_block=ns(type="text")),
        ns(type="content_block_delta", index=0,
           delta=ns(type="text_delta", text="Hola ")),
        ns(type="content_block_delta", index=0,
           delta=ns(type="text_delta", text="mundo")),
        ns(type="content_block_stop", index=0),
        ns(type="message_delta",
           delta=ns(stop_reason="end_turn"),
           usage=ns(output_tokens=3)),
        ns(type="message_stop"),
    ]
    client = MockAnthropic(events)
    provider = ClaudeProvider(client=client, default_model="test-model")

    out = []
    async for event in provider.stream(
        system="eres ayudante",
        messages=[{"role": "user", "content": "hola"}],
        tools=[],
    ):
        out.append(event)

    text_deltas = [e for e in out if isinstance(e, TextDelta)]
    assert [d.text for d in text_deltas] == ["Hola ", "mundo"]

    completes = [e for e in out if isinstance(e, MessageComplete)]
    assert len(completes) == 1
    assert completes[0].tokens_in == 12
    assert completes[0].tokens_out == 3
    assert completes[0].stop_reason == "end_turn"

    # Prompt cache: system con cache_control + 0 tools => no tools key.
    sys = client.capture["system"]
    assert isinstance(sys, list) and sys[0]["cache_control"] == {
        "type": "ephemeral"
    }


@pytest.mark.asyncio
async def test_tool_use_emitted_when_model_calls_tool():
    """Test del Step 5: input_json_delta acumula y emite ToolUse al stop."""
    from apps.asistente.providers.base import ToolUse
    from apps.asistente.providers.claude import ClaudeProvider

    events = [
        ns(type="message_start",
           message=ns(usage=ns(input_tokens=20))),
        ns(type="content_block_start", index=0,
           content_block=ns(type="tool_use", id="toolu_001",
                            name="fat_buscar_cliente")),
        ns(type="content_block_delta", index=0,
           delta=ns(type="input_json_delta",
                    partial_json='{"query":"PER')),
        ns(type="content_block_delta", index=0,
           delta=ns(type="input_json_delta", partial_json='EZ"}')),
        ns(type="content_block_stop", index=0),
        ns(type="message_delta",
           delta=ns(stop_reason="tool_use"),
           usage=ns(output_tokens=5)),
        ns(type="message_stop"),
    ]
    client = MockAnthropic(events)
    provider = ClaudeProvider(client=client, default_model="test-model")

    out = []
    async for event in provider.stream(
        system="x",
        messages=[{"role": "user", "content": "buscame PEREZ"}],
        tools=[
            {"name": "fat_buscar_cliente",
             "description": "Busca un cliente FAT por nombre/RNC.",
             "input_schema": {
                 "type": "object",
                 "properties": {"query": {"type": "string"}},
                 "required": ["query"],
             }},
        ],
    ):
        out.append(event)

    tool_uses = [e for e in out if isinstance(e, ToolUse)]
    assert len(tool_uses) == 1
    assert tool_uses[0].call_id == "toolu_001"
    assert tool_uses[0].name == "fat_buscar_cliente"
    assert tool_uses[0].args == {"query": "PEREZ"}

    # Prompt cache: el ULTIMO tool debe llevar cache_control.
    tools_param = client.capture["tools"]
    assert tools_param[-1]["cache_control"] == {"type": "ephemeral"}


@pytest.mark.asyncio
async def test_ollama_provider_not_implemented():
    """Step 8: OllamaProvider explicitamente sin activar."""
    from apps.asistente.providers.ollama import OllamaProvider

    with pytest.raises(NotImplementedError):
        await OllamaProvider().stream()
