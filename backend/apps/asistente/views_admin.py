"""Views admin: lista de tools y auditoria."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.asistente.tools.registry import list_for_user


class ToolsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        specs = list_for_user(request.user)
        return Response({
            "tools": [
                {
                    "name": s.name,
                    "description": s.description,
                    "write": s.write,
                    "modules_required": s.modules_required,
                    "input_schema": s.input_schema,
                }
                for s in specs
            ],
        })


class AuditoriaView(APIView):
    """GET `/api/admin/asistente/auditoria/`  (gate DBA en Task 7)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Stub: la query agregada y el gate DBA se implementan en Task 7.
        return Response({"detail": "not_implemented_yet"}, status=501)
