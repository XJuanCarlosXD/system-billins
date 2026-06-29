from rest_framework.response import Response
from rest_framework.views import APIView


class ToolsView(APIView):
    """GET /api/asistente/tools/

    Stub. Implementacion real en Task 6 (Step 5): devuelve REGISTRY filtrado
    por get_user_module_flags(user).
    """

    def get(self, request):
        return Response({"detail": "not_implemented"}, status=501)


class AuditoriaView(APIView):
    """GET /api/admin/asistente/auditoria/

    Stub. Implementacion real en Task 7 (Step 2). Gate DBA.
    """

    def get(self, request):
        return Response({"detail": "not_implemented"}, status=501)
