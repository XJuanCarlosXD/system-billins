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


# ---------------------------------------------------------------------------
# Oracle implementations (TCHAT_*).
# ---------------------------------------------------------------------------


class OracleHistoryStore:
    """Persistencia sobre ABREGONZA.TCHAT_CONVERSACION + TCHAT_MENSAJE.

    El CLOB se inserta directamente como string (oracledb maneja el bind
    cuando el valor es str y la columna es CLOB).
    """

    def append_message(self, msg: StoredMessage) -> None:
        from apps.legacy import client

        with client.cursor() as cur:
            cur.execute(
                "INSERT INTO ABREGONZA.TCHAT_MENSAJE "
                "(MENSAJE_ID, CONV_ID, SEQ, ROLE, CONTENIDO, "
                " TOOL_CALLS_JSON, TOOL_CALL_ID, TOKENS_IN, TOKENS_OUT, "
                " CACHE_HIT_IN, COSTO_USD, FECHA_CREACION) "
                "VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, "
                "        SYSDATE)",
                [
                    msg.mensaje_id, msg.conv_id, msg.seq, msg.role,
                    msg.contenido or "",
                    msg.tool_calls_json, msg.tool_call_id,
                    msg.tokens_in, msg.tokens_out, msg.cache_hit_in,
                    msg.costo_usd,
                ],
            )
            cur.connection.commit()

    def load_messages(self, conv_id: str) -> list[StoredMessage]:
        from apps.legacy import client

        rows = client.fetch_dicts(
            "SELECT MENSAJE_ID, CONV_ID, SEQ, ROLE, CONTENIDO, "
            "       TOOL_CALLS_JSON, TOOL_CALL_ID, TOKENS_IN, TOKENS_OUT, "
            "       CACHE_HIT_IN, COSTO_USD "
            "FROM ABREGONZA.TCHAT_MENSAJE "
            "WHERE CONV_ID = :1 "
            "ORDER BY SEQ",
            [conv_id],
        )
        out: list[StoredMessage] = []
        for r in rows:
            contenido = r.get("contenido") or ""
            tcj = r.get("tool_calls_json")
            if hasattr(contenido, "read"):
                contenido = contenido.read()
            if hasattr(tcj, "read"):
                tcj = tcj.read()
            out.append(StoredMessage(
                mensaje_id=r["mensaje_id"],
                conv_id=r["conv_id"],
                seq=int(r["seq"]),
                role=r["role"],
                contenido=str(contenido) if contenido else "",
                tool_calls_json=str(tcj) if tcj else None,
                tool_call_id=r.get("tool_call_id"),
                tokens_in=int(r.get("tokens_in") or 0),
                tokens_out=int(r.get("tokens_out") or 0),
                cache_hit_in=int(r.get("cache_hit_in") or 0),
                costo_usd=float(r.get("costo_usd") or 0),
            ))
        return out

    def update_conv_metrics(
        self, conv_id: str, *, tokens_in: int, tokens_out: int,
        costo_usd: float, skill_activa: str | None = None,
    ) -> None:
        from apps.legacy import client

        with client.cursor() as cur:
            if skill_activa is not None:
                cur.execute(
                    "UPDATE ABREGONZA.TCHAT_CONVERSACION "
                    "SET TOKENS_IN_TOT = NVL(TOKENS_IN_TOT,0) + :1, "
                    "    TOKENS_OUT_TOT = NVL(TOKENS_OUT_TOT,0) + :2, "
                    "    COSTO_USD = NVL(COSTO_USD,0) + :3, "
                    "    SKILL_ACTIVA = :4, "
                    "    FECHA_ULTIMO = SYSDATE "
                    "WHERE CONV_ID = :5",
                    [tokens_in, tokens_out, costo_usd, skill_activa, conv_id],
                )
            else:
                cur.execute(
                    "UPDATE ABREGONZA.TCHAT_CONVERSACION "
                    "SET TOKENS_IN_TOT = NVL(TOKENS_IN_TOT,0) + :1, "
                    "    TOKENS_OUT_TOT = NVL(TOKENS_OUT_TOT,0) + :2, "
                    "    COSTO_USD = NVL(COSTO_USD,0) + :3, "
                    "    FECHA_ULTIMO = SYSDATE "
                    "WHERE CONV_ID = :4",
                    [tokens_in, tokens_out, costo_usd, conv_id],
                )
            cur.connection.commit()


class OraclePendingStore:
    """Persistencia sobre ABREGONZA.TCHAT_TOOL_PENDING."""

    def create(self, p: StoredPending) -> None:
        from apps.legacy import client

        with client.cursor() as cur:
            cur.execute(
                "INSERT INTO ABREGONZA.TCHAT_TOOL_PENDING "
                "(SIG, CONV_ID, MENSAJE_ID, TOOL_NAME, ARGS_JSON, PREVIEW, "
                " STATUS, USUARIO, FECHA_CREACION, FECHA_EXPIRA) "
                "VALUES (:1, :2, :3, :4, :5, :6, 'P', :7, "
                "        :8, :9)",
                [
                    p.sig, p.conv_id, p.mensaje_id, p.tool_name,
                    p.args_json, p.preview, p.usuario,
                    p.fecha_creacion, p.fecha_expira,
                ],
            )
            cur.connection.commit()

    def get(self, sig: str) -> StoredPending | None:
        from apps.legacy import client

        rows = client.fetch_dicts(
            "SELECT SIG, CONV_ID, MENSAJE_ID, TOOL_NAME, ARGS_JSON, "
            "       PREVIEW, STATUS, USUARIO, FECHA_CREACION, "
            "       FECHA_EXPIRA, FECHA_RESUELTA "
            "FROM ABREGONZA.TCHAT_TOOL_PENDING WHERE SIG = :1",
            [sig],
        )
        if not rows:
            return None
        r = rows[0]
        args_json = r.get("args_json")
        if hasattr(args_json, "read"):
            args_json = args_json.read()
        return StoredPending(
            sig=r["sig"],
            conv_id=r["conv_id"],
            mensaje_id=r.get("mensaje_id"),
            tool_name=r["tool_name"],
            args_json=str(args_json) if args_json else "",
            preview=r.get("preview") or "",
            usuario=r["usuario"],
            fecha_creacion=r["fecha_creacion"],
            fecha_expira=r["fecha_expira"],
            status=r["status"],
            fecha_resuelta=r.get("fecha_resuelta"),
        )

    def resolve(
        self, sig: str, *, approved: bool, by: str
    ) -> StoredPending | None:
        from apps.legacy import client

        new_status = "A" if approved else "R"
        with client.cursor() as cur:
            cur.execute(
                "UPDATE ABREGONZA.TCHAT_TOOL_PENDING "
                "SET STATUS = :1, FECHA_RESUELTA = SYSDATE "
                "WHERE SIG = :2 AND STATUS = 'P'",
                [new_status, sig],
            )
            cur.connection.commit()
        return self.get(sig)

