"""Persistencia minima sobre TCHAT_* en Oracle.

Diseno: dos interfaces (`HistoryStore`, `PendingStore`) que el AgentLoop
puede recibir por DI. Aqui implementamos las versiones Oracle reales
(`OracleHistoryStore`, `OraclePendingStore`). Los tests inyectan in-memory
para no depender de la base.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Protocol


@dataclass
class StoredMessage:
    mensaje_id: str
    conv_id: str
    seq: int
    role: str
    contenido: str
    tool_calls_json: str | None = None
    tool_call_id: str | None = None
    tokens_in: int = 0
    tokens_out: int = 0
    cache_hit_in: int = 0
    costo_usd: float = 0.0


@dataclass
class StoredPending:
    sig: str
    conv_id: str
    mensaje_id: str | None
    tool_name: str
    args_json: str
    preview: str
    usuario: str
    fecha_creacion: datetime
    fecha_expira: datetime
    status: str = "P"
    fecha_resuelta: datetime | None = None


class HistoryStore(Protocol):
    def append_message(self, msg: StoredMessage) -> None: ...
    def load_messages(self, conv_id: str) -> list[StoredMessage]: ...
    def update_conv_metrics(
        self, conv_id: str, *, tokens_in: int, tokens_out: int, costo_usd: float,
        skill_activa: str | None = None,
    ) -> None: ...


class PendingStore(Protocol):
    def create(self, p: StoredPending) -> None: ...
    def get(self, sig: str) -> StoredPending | None: ...
    def resolve(self, sig: str, *, approved: bool, by: str) -> StoredPending | None: ...


# ---------------------------------------------------------------------------
# In-memory implementations (default + para tests).
# ---------------------------------------------------------------------------


@dataclass
class InMemoryHistoryStore:
    by_conv: dict[str, list[StoredMessage]] = field(default_factory=dict)
    metrics: dict[str, dict] = field(default_factory=dict)

    def append_message(self, msg: StoredMessage) -> None:
        self.by_conv.setdefault(msg.conv_id, []).append(msg)

    def load_messages(self, conv_id: str) -> list[StoredMessage]:
        return list(self.by_conv.get(conv_id, []))

    def update_conv_metrics(
        self, conv_id: str, *, tokens_in: int, tokens_out: int,
        costo_usd: float, skill_activa: str | None = None,
    ) -> None:
        m = self.metrics.setdefault(
            conv_id, {"tokens_in": 0, "tokens_out": 0, "costo_usd": 0.0}
        )
        m["tokens_in"] += tokens_in
        m["tokens_out"] += tokens_out
        m["costo_usd"] += costo_usd
        if skill_activa is not None:
            m["skill_activa"] = skill_activa


@dataclass
class InMemoryPendingStore:
    by_sig: dict[str, StoredPending] = field(default_factory=dict)

    def create(self, p: StoredPending) -> None:
        self.by_sig[p.sig] = p

    def get(self, sig: str) -> StoredPending | None:
        return self.by_sig.get(sig)

    def resolve(
        self, sig: str, *, approved: bool, by: str
    ) -> StoredPending | None:
        p = self.by_sig.get(sig)
        if p is None or p.status != "P":
            return None
        p.status = "A" if approved else "R"
        p.fecha_resuelta = datetime.utcnow()
        return p
