from rest_framework.response import Response
from rest_framework.views import APIView


class ConversacionesView(APIView):
    """GET (list) + POST (create) /api/asistente/conversaciones/

    Stub. Implementacion real en Task 6 (Steps 1-2) sobre TCHAT_CONVERSACION.
    """

    def get(self, request):
        return Response({"detail": "not_implemented"}, status=501)

    def post(self, request):
        return Response({"detail": "not_implemented"}, status=501)


class ConversacionDetailView(APIView):
    """GET (detail con mensajes) + DELETE (soft) /api/asistente/conversaciones/<conv_id>/

    Stub. Implementacion real en Task 6 (Step 2).
    """

    def get(self, request, conv_id):
        return Response(
            {"detail": "not_implemented", "conv_id": conv_id},
            status=501,
        )

    def delete(self, request, conv_id):
        return Response(
            {"detail": "not_implemented", "conv_id": conv_id},
            status=501,
        )
