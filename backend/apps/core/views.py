from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.legacy import client as legacy


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({'status': 'ok'})


class OracleHealthView(APIView):
    """Verifica conexion al Oracle del sistema legado SIN escribir nada.

    Usa el pool oracledb thick mode directamente, sin Django ORM
    (Django 5 no soporta Oracle <19).
    """
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            info = legacy.ping()
            return Response({'status': 'ok', **info})
        except Exception as exc:
            return Response({'status': 'error', 'detail': str(exc)}, status=503)
