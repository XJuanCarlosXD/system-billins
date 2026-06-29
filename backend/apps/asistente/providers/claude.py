"""ClaudeProvider: wrap async de anthropic.AsyncAnthropic.

Diseno:
- `client` se inyecta por constructor para tests (default = AsyncAnthropic()).
- `stream(...)` es un async generator que traduce los eventos crudos del SDK
  (RawMessageStreamEvent y derivados) a `ProviderEvent` del modulo base.
- Prompt cache: se aplica `cache_control={"type":"ephemeral"}` al bloque
  system y al ultimo tool de la lista (Anthropic permite hasta 4 puntos de
  cache; con estos dos cubrimos el caso comun: instrucciones largas + tools).
- Tool use: se acumula `input_json_delta` por content_block y se emite
  `ToolUse(call_id, name, args)` al cerrar el bloque.
"""

from __future__ import annotations

import json
from typing import AsyncIterator, Iterable

from django.conf import settings

from apps.asistente.providers.base import (
    BaseProvider,
    Error,
    MessageComplete,
    ProviderEvent,
    TextDelta,
    ToolUse,
)


def _default_client():
    """Lazy import para que el modulo cargue aun si anthropic falta (tests)."""
    from anthropic import AsyncAnthropic

    return AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY or None)


class ClaudeProvider(BaseProvider):
    def __init__(self, client=None, default_model: str | None = None):
        self._client = client
        self.default_model = default_model or getattr(
            settings, "ASISTENTE_DEFAULT_MODEL", "claude-haiku-4-5"
        )

    @property
    def client(self):
        if self._client is None:
            self._client = _default_client()
        return self._client

    @staticmethod
    def _build_system(system: str) -> list[dict]:
        """Empaqueta el system prompt como bloque con cache_control."""
        if not system:
            return []
        return [
            {
                "type": "text",
                "text": system,
                "cache_control": {"type": "ephemeral"},
            }
        ]

    @staticmethod
    def _build_tools(tools: Iterable[dict] | None) -> list[dict]:
        """Aplica cache_control al ULTIMO tool del listado.

        Anthropic cachea desde el primer bloque marcado hasta el final del
        bloque marcado, asi que poner el marker al final implica cachear
        TODOS los tools previos como un solo prefijo.
        """
        if not tools:
            return []
        out = [dict(t) for t in tools]
        if out:
            out[-1] = {**out[-1], "cache_control": {"type": "ephemeral"}}
        return out

    async def stream(
        self,
        *,
        system: str,
        messages: list[dict],
        tools: Iterable[dict] | None = None,
        model: str | None = None,
        max_tokens: int = 1024,
    ) -> AsyncIterator[ProviderEvent]:
        params = {
            "model": model or self.default_model,
            "max_tokens": max_tokens,
            "messages": messages,
        }
        sys_blocks = self._build_system(system)
        if sys_blocks:
            params["system"] = sys_blocks
        tool_blocks = self._build_tools(tools)
        if tool_blocks:
            params["tools"] = tool_blocks

        # Acumuladores por content_block.index.
        tool_accum: dict[int, dict] = {}
        cache_hit_in = 0
        cache_write_in = 0
        tokens_in = 0
        tokens_out = 0
        stop_reason = "end_turn"

        try:
            stream = await self.client.messages.create(stream=True, **params)
            async for ev in stream:
                etype = getattr(ev, "type", None)

                if etype == "message_start":
                    msg = getattr(ev, "message", None)
                    usage = getattr(msg, "usage", None) if msg else None
                    if usage is not None:
                        tokens_in = (
                            getattr(usage, "input_tokens", 0) or 0
                        )
                        cache_hit_in = (
                            getattr(usage, "cache_read_input_tokens", 0) or 0
                        )
                        cache_write_in = (
                            getattr(usage, "cache_creation_input_tokens", 0)
                            or 0
                        )

                elif etype == "content_block_start":
                    block = getattr(ev, "content_block", None)
                    btype = getattr(block, "type", None)
                    if btype == "tool_use":
                        tool_accum[ev.index] = {
                            "call_id": getattr(block, "id", ""),
                            "name": getattr(block, "name", ""),
                            "buf": "",
                        }

                elif etype == "content_block_delta":
                    delta = getattr(ev, "delta", None)
                    dtype = getattr(delta, "type", None)
                    if dtype == "text_delta":
                        text = getattr(delta, "text", "") or ""
                        if text:
                            yield TextDelta(text=text)
                    elif dtype == "input_json_delta":
                        idx = ev.index
                        if idx in tool_accum:
                            tool_accum[idx]["buf"] += getattr(
                                delta, "partial_json", ""
                            ) or ""

                elif etype == "content_block_stop":
                    idx = ev.index
                    if idx in tool_accum:
                        raw = tool_accum[idx]
                        try:
                            args = json.loads(raw["buf"]) if raw["buf"] else {}
                        except json.JSONDecodeError:
                            args = {}
                        yield ToolUse(
                            call_id=raw["call_id"],
                            name=raw["name"],
                            args=args,
                        )
                        del tool_accum[idx]

                elif etype == "message_delta":
                    delta = getattr(ev, "delta", None)
                    if delta is not None:
                        sr = getattr(delta, "stop_reason", None)
                        if sr:
                            stop_reason = sr
                    usage = getattr(ev, "usage", None)
                    if usage is not None:
                        tokens_out = (
                            getattr(usage, "output_tokens", 0) or 0
                        )

                elif etype == "message_stop":
                    break
        except Exception as exc:  # noqa: BLE001
            yield Error(message=str(exc), code=type(exc).__name__)
            return

        yield MessageComplete(
            stop_reason=stop_reason,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            cache_hit_in=cache_hit_in,
            cache_write_in=cache_write_in,
        )
