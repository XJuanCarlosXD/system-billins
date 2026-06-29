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
    """GET `/api/admin/asistente/auditoria/` — agregados de TCHAT_TOOL_LOG.

    Gate: sólo usuarios con rol DBA/REGAL_GENERAL (ver users_repo.is_dba).
    Query params: ?days=N (default 7), ?no_cia=XX.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.asistente import audit
        from apps.legacy.repositories import users_repo

        username = getattr(request.user, "username", "") or ""
        if not users_repo.is_dba(username):
            return Response({"detail": "forbidden"}, status=403)

        try:
            days = int(request.query_params.get("days", 7))
        except (TypeError, ValueError):
            days = 7
        days = max(1, min(days, 365))
        no_cia = request.query_params.get("no_cia") or None

        data = audit.fetch_aggregates(days=days, no_cia=no_cia)
        return Response(data)
