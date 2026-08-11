from rest_framework.permissions import AllowAny, IsAuthenticated
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


class SidebarBadgesView(APIView):
    """Conteos de documentos por módulo para los badges del sidebar.

    Devuelve, por compañía/punto, el total de documentos de cada módulo
    documental (FAT/CxC/CxP/INV). El frontend guarda el último total visto
    en localStorage y muestra como badge la diferencia (documentos nuevos
    desde la última visita a esa consulta). Cada conteo va aislado en su
    propio try para que el fallo de un módulo no tumbe el resto.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia')
        punto = (request.query_params.get('punto') or '').strip()
        if not no_cia:
            return Response({'detail': 'no_cia es requerido'}, status=400)

        if punto:
            where = 'no_cia=:1 AND punto=:2'
            params = [no_cia, punto]
        else:
            where = 'no_cia=:1'
            params = [no_cia]

        counts: dict[str, int | None] = {}

        def _count(key: str, sql: str) -> None:
            try:
                row = legacy.fetch_one(sql, params)
                counts[key] = int(row[0]) if row and row[0] is not None else 0
            except Exception:
                counts[key] = None

        _count('fat', f"SELECT COUNT(*) FROM FAT.TFAT_FACTURA "
                      f"WHERE {where} AND NVL(st_anulado,'N')='N'")
        _count('cxc', f"SELECT COUNT(*) FROM CXC.TCXC_DOCUMENTO WHERE {where}")
        _count('cxp', f"SELECT COUNT(*) FROM CXP.TCXP_DOCUMENTO WHERE {where}")
        _count('inv', f"SELECT COUNT(*) FROM ("
                      f"  SELECT DISTINCT tipo_docu, no_docu, punto, almacen "
                      f"  FROM INV.TINV_MOVIMIENTO WHERE {where})")

        return Response({'no_cia': no_cia, 'punto': punto, 'counts': counts})
