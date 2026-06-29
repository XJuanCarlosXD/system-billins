from rest_framework.response import Response
from rest_framework.views import APIView


class ChatStreamView(APIView):
    """POST /api/asistente/conversaciones/<conv_id>/chat/

    Stub. Implementacion real en Task 6 (Step 3): StreamingHttpResponse + SSE
    consumiendo apps.asistente.agent_loop.AgentLoop.run().
    """

    def post(self, request, conv_id):
        return Response(
            {"detail": "not_implemented", "conv_id": conv_id},
            status=501,
        )


class ConfirmView(APIView):
    """POST /api/asistente/confirm/<sig>/

    Stub. Implementacion real en Task 6 (Step 4): despierta el asyncio.Future
    del agent_loop indexado por sig.
    """

    def post(self, request, sig):
        return Response(
            {"detail": "not_implemented", "sig": sig},
            status=501,
        )
