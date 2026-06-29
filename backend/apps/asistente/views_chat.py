"""SSE chat stream + confirm endpoint."""

import json

from asgiref.sync import async_to_sync
from django.conf import settings
from django.http import StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.asistente.agent_loop import AgentLoop, signal_confirm
from apps.asistente.persist import OracleHistoryStore, OraclePendingStore
from apps.asistente.providers.claude import ClaudeProvider
from apps.legacy import client


def _u(request) -> str:
    return (request.user.username or "").upper()


def _sse_format(event: str, data: dict) -> bytes:
    """`event: <name>\\ndata: <json>\\n\\n` codificado."""
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n".encode(
        "utf-8"
    )


@method_decorator(csrf_exempt, name="dispatch")
class ChatStreamView(APIView):
    """POST `/api/asistente/conversaciones/<conv_id>/chat/`

    Body: {"message": "...", "skill": "..."?}
    Responde con `Content-Type: text/event-stream`.

    Notas:
    - Por simplicidad, se ejecuta el async generator vía async_to_sync y
      se yieldea desde un sync generator a StreamingHttpResponse. Para una
      version ASGI nativa, refactorizar a `async def` view + mount asgi.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, conv_id):
        # Validar que la conversacion pertenece al usuario.
        own = client.fetch_one(
            "SELECT 1 FROM ABREGONZA.TCHAT_CONVERSACION "
            "WHERE CONV_ID = :1 AND UPPER(USUARIO) = :2 "
            "AND NVL(ARCHIVADA,'N') = 'N'",
            [conv_id, _u(request)],
        )
        if not own:
            return Response({"detail": "not_found"}, status=404)

        body = request.data or {}
        user_message = (body.get("message") or "").strip()
        if not user_message:
            return Response({"detail": "empty_message"}, status=400)
        skill_activa = body.get("skill") or None

        provider = ClaudeProvider()
        loop = AgentLoop(
            provider=provider,
            history_store=OracleHistoryStore(),
            pending_store=OraclePendingStore(),
        )

        # Convertir async generator a sync iter para StreamingHttpResponse.
        async_gen = loop.run(
            conv_id=conv_id,
            user_message=user_message,
            user=request.user,
            skill_activa=skill_activa,
        )

        def _drain():
            # Drena el async generator usando un loop privado.
            import asyncio

            loop_a = asyncio.new_event_loop()
            try:
                ait = async_gen.__aiter__()
                while True:
                    try:
                        ev = loop_a.run_until_complete(ait.__anext__())
                    except StopAsyncIteration:
                        return
                    yield _sse_format(ev["event"], ev["data"])
            finally:
                loop_a.close()

        resp = StreamingHttpResponse(
            _drain(),
            content_type="text/event-stream",
        )
        resp["Cache-Control"] = "no-cache"
        resp["X-Accel-Buffering"] = "no"
        return resp


@method_decorator(csrf_exempt, name="dispatch")
class ConfirmView(APIView):
    """POST `/api/asistente/confirm/<sig>/`  body: {"approve": true|false}.

    Despierta el `asyncio.Future` registrado por el AgentLoop. Si ya no hay
    futuro (TTL expirado o resuelto antes), igual marca la fila en
    TCHAT_TOOL_PENDING como A/R/X segun corresponda.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, sig):
        approve = bool((request.data or {}).get("approve"))
        # Mark fila igual: idempotente si ya fue resuelta.
        store = OraclePendingStore()
        store.resolve(sig, approved=approve, by=_u(request))

        woke = signal_confirm(sig, approved=approve, by=_u(request))
        return Response({"ok": True, "woke_future": woke})
