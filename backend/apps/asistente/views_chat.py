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
        # Validar que la conversacion pertenece al usuario (y traer su
        # compania/punto persistidos como fallback del contexto activo).
        own = client.fetch_one(
            "SELECT NO_CIA, PUNTO, TITULO FROM ABREGONZA.TCHAT_CONVERSACION "
            "WHERE CONV_ID = :1 AND UPPER(USUARIO) = :2 "
            "AND NVL(ARCHIVADA,'N') = 'N'",
            [conv_id, _u(request)],
        )
        if not own:
            return Response({"detail": "not_found"}, status=404)

        body = request.data or {}
        user_message = (body.get("message") or "").strip()
        skill_activa = body.get("skill") or None

        # Adjuntos: [{name, media_type, data(base64)}]. Solo PDF e imagenes.
        raw_attach = body.get("attachments") or []
        if not isinstance(raw_attach, list):
            return Response({"detail": "bad_attachments"}, status=400)
        if len(raw_attach) > 4:
            return Response({"detail": "max_4_attachments"}, status=400)
        allowed = {
            "application/pdf", "image/png", "image/jpeg",
            "image/gif", "image/webp",
        }
        attachments = []
        total_b64 = 0
        for a in raw_attach:
            if not isinstance(a, dict):
                return Response({"detail": "bad_attachments"}, status=400)
            mt = (a.get("media_type") or "").lower()
            data = a.get("data") or ""
            if mt not in allowed or not isinstance(data, str) or not data:
                return Response(
                    {"detail": f"tipo_no_soportado:{mt}"}, status=400
                )
            total_b64 += len(data)
            attachments.append({
                "name": str(a.get("name") or "archivo")[:200],
                "media_type": mt,
                "data": data,
            })
        # ~15MB en base64 (~11MB reales) para no exceder limites del API.
        if total_b64 > 15_000_000:
            return Response({"detail": "attachments_too_large"}, status=400)

        if not user_message and not attachments:
            return Response({"detail": "empty_message"}, status=400)
        if not user_message:
            user_message = "Analiza el archivo adjunto."

        # Auto-titulo estilo Gemini: la primera vez que se escribe en una
        # conversacion con titulo por defecto, el titulo pasa a ser el
        # primer mensaje (recortado). Las continuaciones ("· cont.") y los
        # titulos ya personalizados no se tocan.
        cur_titulo = (own[2] or "").strip()
        if cur_titulo in ("", "Nueva conversacion", "Nueva conversación"):
            nuevo = " ".join(user_message.split()).strip()
            if len(nuevo) > 60:
                nuevo = nuevo[:60].rstrip() + "…"
            if nuevo:
                try:
                    with client.cursor() as cur:
                        cur.execute(
                            "UPDATE ABREGONZA.TCHAT_CONVERSACION "
                            "SET TITULO = :1 "
                            "WHERE CONV_ID = :2 AND UPPER(USUARIO) = :3",
                            [nuevo, conv_id, _u(request)],
                        )
                        cur.connection.commit()
                except Exception:  # noqa: BLE001
                    pass  # el titulo es cosmetico; nunca rompe el chat

        # Contexto de compania/punto: el seleccionado en la UI (body) manda;
        # fallback a lo persistido en la conversacion.
        ctx_no_cia = (str(body.get("no_cia") or "") or (own[0] or "")).strip() or None
        ctx_punto = (str(body.get("punto") or "") or (own[1] or "")).strip() or None

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
            attachments=attachments or None,
            no_cia=ctx_no_cia,
            punto=ctx_punto,
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
        body = request.data or {}
        # Acepta ambas claves: el frontend envia "approved".
        approve = bool(body.get("approve", body.get("approved")))
        # Mark fila igual: idempotente si ya fue resuelta.
        store = OraclePendingStore()
        store.resolve(sig, approved=approve, by=_u(request))

        woke = signal_confirm(sig, approved=approve, by=_u(request))
        return Response({"ok": True, "woke_future": woke})
