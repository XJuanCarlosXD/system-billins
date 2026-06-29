"""Provider interface comun a Claude / Ollama.

Eventos que el agent loop espera ver desde provider.stream(...):

- TextDelta(text)           -> token incremental para SSE 'token'.
- ToolUse(call_id, name, args) -> el modelo decidio invocar una tool.
- MessageComplete(...)      -> turno terminado, con metricas de tokens.
- Error(message, code)      -> fallo del provider (red, rate-limit, etc).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import AsyncIterator, Iterable, Union


@dataclass
class TextDelta:
    text: str


@dataclass
class ToolUse:
    call_id: str
    name: str
    args: dict


@dataclass
class MessageComplete:
    stop_reason: str = "end_turn"
    tokens_in: int = 0
    tokens_out: int = 0
    cache_hit_in: int = 0
    cache_write_in: int = 0


@dataclass
class Error:
    message: str
    code: str = ""


ProviderEvent = Union[TextDelta, ToolUse, MessageComplete, Error]


class BaseProvider:
    """Interfaz abstracta. Las subclases implementan `stream`."""

    async def stream(
        self,
        *,
        system: str,
        messages: list[dict],
        tools: Iterable[dict] | None = None,
        model: str | None = None,
        max_tokens: int = 1024,
    ) -> AsyncIterator[ProviderEvent]:
        raise NotImplementedError
        yield  # pragma: no cover  (hack: marca el metodo como generator)
