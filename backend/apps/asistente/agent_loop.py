"""Agent loop: orquesta provider + tools + persistencia + SSE.

API publica:
- `dispatch_tool(user, name, args) -> ToolResult` (4 capas de gates).
- `AgentLoop(provider, history_store, pending_store, ...).run(conv_id, user_message, user)`
  async generator que yieldea dicts SSE-compatible:
    {"event":"turn_started",  "data": {...}}
    {"event":"token",         "data": {"text": "..."}}
    {"event":"tool_call",     "data": {...}}      # read
    {"event":"tool_pending",  "data": {...}}      # write -> espera confirm
    {"event":"tool_result",   "data": {...}}
    {"event":"tool_error",    "data": {...}}
    {"event":"skill_activated","data":{...}}
    {"event":"message_complete","data":{...}}
"""

from __future__ import annotations

import asyncio
import inspect
import json
import secrets
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, AsyncIterator

from django.conf import settings

from apps.asistente.persist import (
    HistoryStore,
    InMemoryHistoryStore,
    InMemoryPendingStore,
    PendingStore,
    StoredMessage,
    StoredPending,
)
from apps.asistente.providers.base import (
    BaseProvider,
    Error as ProviderError,
    MessageComplete,
    ProviderEvent,
    TextDelta,
    ToolUse,
)
from apps.asistente.tools import permissions as _perms
from apps.asistente.tools.registry import REGISTRY, ToolSpec, get_tool, list_for_user


# ---------------------------------------------------------------------------
# Tool dispatch (capa unica para tests).
# ---------------------------------------------------------------------------


class ToolError(Exception):
    def __init__(self, code: str, message: str = ""):
        super().__init__(message or code)
        self.code = code
        self.message = message or code


@dataclass
class ToolResult:
    ok: bool
    data: Any = None
    error_code: str = ""
    error_message: str = ""
    duration_ms: int = 0
    was_write: bool = False


async def dispatch_tool(
    user, name: str, args: dict | None = None
) -> ToolResult:
    args = dict(args or {})
    started = time.monotonic()

    spec: ToolSpec | None = get_tool(name)
    if spec is None:
        return ToolResult(
            ok=False,
            error_code="UNKNOWN_TOOL",
            error_message=f"Tool '{name}' no esta registrada",
        )

    flags = _perms.get_user_module_flags(user)
    missing = [m for m in spec.modules_required if flags.get(m) != "S"]
    if missing:
        return ToolResult(
            ok=False,
            error_code="FORBIDDEN_MODULE",
            error_message=f"Modulos faltantes: {','.join(missing)}",
            was_write=spec.write,
        )

    no_cia = args.get("no_cia") or args.get("NO_CIA")
    if no_cia and not _perms.user_has_cia(user, no_cia):
        return ToolResult(
            ok=False, error_code="FORBIDDEN_CIA",
            error_message=f"Usuario sin acceso a la cia {no_cia}",
            was_write=spec.write,
        )

    punto = args.get("punto") or args.get("PUNTO")
    if no_cia and punto and not _perms.user_has_punto(user, no_cia, punto):
        return ToolResult(
            ok=False, error_code="FORBIDDEN_PUNTO",
            error_message=f"Usuario sin acceso al punto {no_cia}/{punto}",
            was_write=spec.write,
        )

    perm_modulo = args.pop("_perm_modulo", None)
    perm_tipo = args.pop("_perm_tipo_docu", None)
    perm_accion = args.pop("_perm_accion", "lectura")
    if perm_modulo and perm_tipo:
        if not _perms.user_can_doc(
            user, perm_modulo, no_cia or "", punto or "", perm_tipo, perm_accion
        ):
            return ToolResult(
                ok=False, error_code="FORBIDDEN_DOC",
                error_message=f"Usuario sin acceso al tipo {perm_modulo}/{perm_tipo}",
                was_write=spec.write,
            )

    try:
        handler = spec.handler
        sig = inspect.signature(handler)
        kwargs = dict(args)
        if "user" in sig.parameters:
            kwargs["user"] = user
        result = handler(**kwargs)
        if inspect.isawaitable(result):
            result = await result
        return ToolResult(
            ok=True, data=result,
            duration_ms=int((time.monotonic() - started) * 1000),
            was_write=spec.write,
        )
    except ToolError as exc:
        return ToolResult(
            ok=False, error_code=exc.code, error_message=exc.message,
            duration_ms=int((time.monotonic() - started) * 1000),
            was_write=spec.write,
        )
    except Exception as exc:  # noqa: BLE001
        return ToolResult(
            ok=False, error_code="HANDLER_ERROR", error_message=str(exc),
            duration_ms=int((time.monotonic() - started) * 1000),
            was_write=spec.write,
        )


# ---------------------------------------------------------------------------
# AgentLoop
# ---------------------------------------------------------------------------


# Confirmaciones globales: el HTTP confirm view despierta el future por sig.
_CONFIRM_FUTURES: dict[str, asyncio.Future] = {}


def signal_confirm(sig: str, approved: bool, by: str) -> bool:
    """Llamado por ConfirmView: resuelve el future del agent loop si existe."""
    fut = _CONFIRM_FUTURES.get(sig)
    if fut is None or fut.done():
        return False
    fut.set_result({"approved": approved, "by": by})
    return True


def _new_uuid() -> str:
    return str(uuid.uuid4())


def _new_sig() -> str:
    return "tpx_" + secrets.token_hex(12)


def _system_prompt() -> str:
    return (
        "Eres el asistente embebido de ZentoryERP. Respondes en espanol "
        "neutro, eres conciso y prefieres datos concretos sobre prosa. "
        "Cuando vayas a hacer una operacion de escritura, explica brevemente "
        "que vas a hacer ANTES de invocar la tool."
    )


def _tools_for_anthropic(specs: list[ToolSpec]) -> list[dict]:
    return [
        {
            "name": s.name,
            "description": s.description,
            "input_schema": s.input_schema,
        }
        for s in specs
    ]


def _messages_for_anthropic(history: list[StoredMessage]) -> list[dict]:
    """Convierte la historia persistida al shape `messages` de Anthropic.

    Reglas:
    - role 'user'        -> {"role":"user","content":text}
    - role 'assistant'   -> si trae tool_calls_json -> content list con
                            tool_use blocks; si no, solo text.
    - role 'tool'        -> appended como user message con tool_result block.
    """
    out: list[dict] = []
    for m in history:
        if m.role == "user":
            out.append({"role": "user", "content": m.contenido})
        elif m.role == "assistant":
            if m.tool_calls_json:
                blocks: list[dict] = []
                if m.contenido:
                    blocks.append({"type": "text", "text": m.contenido})
                try:
                    calls = json.loads(m.tool_calls_json)
                except json.JSONDecodeError:
                    calls = []
                for c in calls:
                    blocks.append({
                        "type": "tool_use",
                        "id": c["call_id"],
                        "name": c["name"],
                        "input": c.get("args", {}),
                    })
                out.append({"role": "assistant", "content": blocks})
            else:
                out.append({"role": "assistant", "content": m.contenido})
        elif m.role == "tool":
            out.append({
                "role": "user",
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": m.tool_call_id,
                    "content": m.contenido,
                }],
            })
    return out


def _preview(tool_name: str, args: dict) -> str:
    """Preview corto y safe para mostrar al usuario en el confirm modal."""
    redacted_keys = {"password", "clave"}
    pretty = ", ".join(
        f"{k}={'***' if k in redacted_keys else v}" for k, v in args.items()
    )
    return f"{tool_name}({pretty})"[:480]


@dataclass
class AgentLoop:
    provider: BaseProvider
    history_store: HistoryStore = field(default_factory=InMemoryHistoryStore)
    pending_store: PendingStore = field(default_factory=InMemoryPendingStore)
    max_turns: int | None = None
    daily_budget_usd: float | None = None
    pending_ttl_sec: int | None = None

    def _cap_max_turns(self) -> int:
        if self.max_turns is not None:
            return self.max_turns
        return getattr(settings, "ASISTENTE_MAX_TURNS", 200)

    def _cap_budget(self) -> float:
        if self.daily_budget_usd is not None:
            return self.daily_budget_usd
        return getattr(settings, "ASISTENTE_DAILY_BUDGET_USD", 2.0)

    def _ttl(self) -> int:
        if self.pending_ttl_sec is not None:
            return self.pending_ttl_sec
        return getattr(settings, "ASISTENTE_TOOL_PENDING_TTL_SEC", 300)

    async def run(
        self,
        *,
        conv_id: str,
        user_message: str,
        user,
        skill_activa: str | None = None,
    ) -> AsyncIterator[dict]:
        """Ejecuta un turno completo. Yieldea eventos SSE-friendly."""
        # 1) Persistir el mensaje del usuario.
        history = self.history_store.load_messages(conv_id)
        next_seq = max((m.seq for m in history), default=0) + 1
        self.history_store.append_message(StoredMessage(
            mensaje_id=_new_uuid(),
            conv_id=conv_id,
            seq=next_seq,
            role="user",
            contenido=user_message,
        ))

        yield {"event": "turn_started",
               "data": {"conversacion_id": conv_id, "model": getattr(
                   self.provider, "default_model", "claude")}}

        # 2) Loop de turnos (al menos 1; mas si se invocan tools).
        max_turns = self._cap_max_turns()
        turn = 0
        accum_cost_usd = 0.0
        running_tokens_in = 0
        running_tokens_out = 0
        last_tool_results: list[dict] = []
        active_skill = skill_activa

        while True:
            turn += 1
            if turn > max_turns:
                yield {"event": "tool_error",
                       "data": {"error_code": "MAX_TURNS_EXCEEDED",
                                "message": f"Limite de {max_turns} turnos por conversacion."}}
                break
            if accum_cost_usd > self._cap_budget():
                yield {"event": "tool_error",
                       "data": {"error_code": "BUDGET_EXCEEDED",
                                "message": "Presupuesto diario superado."}}
                break

            # Cargo historia + appendice de tool_results del turno anterior.
            history = self.history_store.load_messages(conv_id)
            specs = list_for_user(user) if user is not None else list(REGISTRY.values())
            anth_tools = _tools_for_anthropic(specs)

            text_buf: list[str] = []
            tool_calls_in_turn: list[ToolUse] = []
            msg_complete: MessageComplete | None = None
            had_error = False

            async for ev in self.provider.stream(
                system=_system_prompt(),
                messages=_messages_for_anthropic(history),
                tools=anth_tools,
            ):
                if isinstance(ev, TextDelta):
                    text_buf.append(ev.text)
                    yield {"event": "token", "data": {"text": ev.text}}
                elif isinstance(ev, ToolUse):
                    tool_calls_in_turn.append(ev)
                elif isinstance(ev, MessageComplete):
                    msg_complete = ev
                elif isinstance(ev, ProviderError):
                    had_error = True
                    yield {"event": "tool_error",
                           "data": {"error_code": ev.code or "PROVIDER_ERROR",
                                    "message": ev.message}}

            if had_error:
                break

            # 3) Persistir assistant message (con tool_calls si los hubo).
            tokens_in = msg_complete.tokens_in if msg_complete else 0
            tokens_out = msg_complete.tokens_out if msg_complete else 0
            running_tokens_in += tokens_in
            running_tokens_out += tokens_out
            # Costo aproximado haiku-4-5 (placeholder; ajustable luego).
            cost = (tokens_in * 1e-6) + (tokens_out * 5e-6)
            accum_cost_usd += cost

            tool_calls_payload = [
                {"call_id": tu.call_id, "name": tu.name, "args": tu.args}
                for tu in tool_calls_in_turn
            ]
            history = self.history_store.load_messages(conv_id)
            assistant_seq = max((m.seq for m in history), default=0) + 1
            assistant_mid = _new_uuid()
            self.history_store.append_message(StoredMessage(
                mensaje_id=assistant_mid,
                conv_id=conv_id,
                seq=assistant_seq,
                role="assistant",
                contenido="".join(text_buf),
                tool_calls_json=(
                    json.dumps(tool_calls_payload) if tool_calls_payload else None
                ),
                tokens_in=tokens_in,
                tokens_out=tokens_out,
                cache_hit_in=msg_complete.cache_hit_in if msg_complete else 0,
                costo_usd=cost,
            ))

            # 4) Si no pidio tools, terminamos el turno.
            if not tool_calls_in_turn:
                self.history_store.update_conv_metrics(
                    conv_id,
                    tokens_in=running_tokens_in,
                    tokens_out=running_tokens_out,
                    costo_usd=accum_cost_usd,
                    skill_activa=active_skill,
                )
                yield {"event": "message_complete",
                       "data": {
                           "mensaje_id": assistant_mid,
                           "tokens_in": running_tokens_in,
                           "tokens_out": running_tokens_out,
                           "cost_usd": round(accum_cost_usd, 6),
                           "stopped_for_confirm": False,
                       }}
                break

            # 5) Por cada tool_use: pause-on-write o ejecucion directa.
            tool_results_for_next: list[dict] = []
            stopped_for_confirm = False
            for tu in tool_calls_in_turn:
                spec = get_tool(tu.name)
                is_write = bool(spec and spec.write)
                preview = _preview(tu.name, tu.args)

                if is_write:
                    sig = _new_sig()
                    expires = datetime.utcnow() + timedelta(seconds=self._ttl())
                    self.pending_store.create(StoredPending(
                        sig=sig,
                        conv_id=conv_id,
                        mensaje_id=assistant_mid,
                        tool_name=tu.name,
                        args_json=json.dumps(tu.args),
                        preview=preview,
                        usuario=getattr(user, "username", "?"),
                        fecha_creacion=datetime.utcnow(),
                        fecha_expira=expires,
                    ))
                    # IMPORTANTE: registrar el future ANTES de yieldear
                    # tool_pending; el consumer puede llamar signal_confirm
                    # inmediatamente despues de recibir el evento.
                    fut: asyncio.Future = asyncio.get_event_loop().create_future()
                    _CONFIRM_FUTURES[sig] = fut
                    yield {"event": "tool_pending",
                           "data": {"sig": sig, "tool": tu.name,
                                    "args": tu.args, "preview": preview,
                                    "expires_at": expires.isoformat() + "Z"}}

                    try:
                        try:
                            decision = await asyncio.wait_for(fut, timeout=self._ttl())
                        except asyncio.TimeoutError:
                            self.pending_store.resolve(sig, approved=False, by="SYSTEM")
                            tool_results_for_next.append({
                                "call_id": tu.call_id,
                                "content": json.dumps({"error": "USER_TIMEOUT"}),
                            })
                            stopped_for_confirm = True
                            continue
                    finally:
                        _CONFIRM_FUTURES.pop(sig, None)

                    if not decision["approved"]:
                        self.pending_store.resolve(sig, approved=False, by=decision["by"])
                        tool_results_for_next.append({
                            "call_id": tu.call_id,
                            "content": json.dumps({"error": "USER_REJECTED"}),
                        })
                        stopped_for_confirm = True
                        continue
                    self.pending_store.resolve(sig, approved=True, by=decision["by"])

                # Ejecutar (read directo o write tras confirm).
                yield {"event": "tool_call",
                       "data": {"call_id": tu.call_id, "tool": tu.name,
                                "args": tu.args}}
                result = await dispatch_tool(user, tu.name, tu.args)
                if result.ok:
                    payload = result.data
                    if not isinstance(payload, (str, bytes)):
                        payload = json.dumps(payload, default=str)
                    yield {"event": "tool_result",
                           "data": {"call_id": tu.call_id, "ok": True,
                                    "duration_ms": result.duration_ms,
                                    "data": result.data}}
                    tool_results_for_next.append({
                        "call_id": tu.call_id,
                        "content": payload if isinstance(payload, str)
                                   else payload.decode("utf-8", "replace"),
                    })

                    # skill activation: si la tool fue skill_cargar OK, persistir.
                    if tu.name == "skill_cargar" and isinstance(result.data, dict) \
                            and result.data.get("ok"):
                        active_skill = result.data.get("name")
                        yield {"event": "skill_activated",
                               "data": {"skill": active_skill}}
                else:
                    yield {"event": "tool_error",
                           "data": {"call_id": tu.call_id, "ok": False,
                                    "error_code": result.error_code,
                                    "message": result.error_message}}
                    tool_results_for_next.append({
                        "call_id": tu.call_id,
                        "content": json.dumps({
                            "error": result.error_code,
                            "message": result.error_message,
                        }),
                    })

            # 6) Persistir tool_results como mensajes role='tool'.
            for tr in tool_results_for_next:
                history = self.history_store.load_messages(conv_id)
                next_s = max((m.seq for m in history), default=0) + 1
                self.history_store.append_message(StoredMessage(
                    mensaje_id=_new_uuid(),
                    conv_id=conv_id,
                    seq=next_s,
                    role="tool",
                    contenido=tr["content"],
                    tool_call_id=tr["call_id"],
                ))

            if stopped_for_confirm and not any(
                tr["content"].startswith('{"error') is False
                for tr in tool_results_for_next
            ):
                # Todos los tool_results fueron USER_TIMEOUT/REJECTED:
                # corto el loop y termino mensaje.
                self.history_store.update_conv_metrics(
                    conv_id,
                    tokens_in=running_tokens_in,
                    tokens_out=running_tokens_out,
                    costo_usd=accum_cost_usd,
                    skill_activa=active_skill,
                )
                yield {"event": "message_complete",
                       "data": {
                           "mensaje_id": assistant_mid,
                           "tokens_in": running_tokens_in,
                           "tokens_out": running_tokens_out,
                           "cost_usd": round(accum_cost_usd, 6),
                           "stopped_for_confirm": True,
                       }}
                break
            # ...si no, loop continua con el siguiente turno.
