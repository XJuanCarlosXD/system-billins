"""Endpoints admin para CRUD de tokens MCP. Gateados por DBA / Regal General.

Adaptado al patron DRF + apps.legacy.client del proyecto (no JsonResponse +
django.db.connection como sugeria el plan).
"""
from datetime import datetime, timedelta
from typing import Optional

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.legacy import client as oracle
from apps.auth_legacy.views import IsLegacyAdmin

from .tokens import create_token_row, invalidate_cache


def _parse_expira(payload) -> Optional[str]:
    if payload.get("no_expira"):
        return None
    dias = payload.get("expira_dias")
    if dias is not None:
        dt = datetime.utcnow() + timedelta(days=int(dias))
        return dt.strftime("%Y-%m-%dT%H:%M:%S")
    custom = payload.get("expira_fecha")
    if custom is not None:
        return custom
    return None


class TokensCollectionView(APIView):
    """GET /api/admin/mcp/tokens/  -> lista
    POST /api/admin/mcp/tokens/    -> crea token (devuelve plaintext una sola vez)
    """
    permission_classes = [IsAuthenticated, IsLegacyAdmin]

    def get(self, request):
        usuario = request.query_params.get("usuario")
        activos = request.query_params.get("activos", "todos")
        q = (request.query_params.get("q") or "").strip()

        sql = (
            "SELECT TOKEN_ID, USUARIO, NO_CIA, BLOQUEAR_CIA, PUNTO, BLOQUEAR_PUNTO, "
            "NOMBRE, PREFIJO, "
            "TO_CHAR(FECHA_CREACION, 'YYYY-MM-DD HH24:MI'), "
            "TO_CHAR(FECHA_EXPIRA,   'YYYY-MM-DD HH24:MI'), "
            "TO_CHAR(FECHA_ULTIMO_USO,'YYYY-MM-DD HH24:MI'), "
            "IP_ULTIMO_USO, ST_ACTIVO, CREADO_POR "
            "FROM ABREGONZA.TMCP_TOKEN WHERE 1=1 "
        )
        params: list = []
        i = 1
        if usuario:
            sql += f" AND USUARIO = :{i}"; params.append(usuario); i += 1
        if activos == "activos":
            sql += " AND ST_ACTIVO = 'S'"
        elif activos == "revocados":
            sql += " AND ST_ACTIVO = 'N'"
        if q:
            sql += f" AND (LOWER(NOMBRE) LIKE :{i} OR LOWER(PREFIJO) LIKE :{i+1})"
            like = f"%{q.lower()}%"
            params += [like, like]
            i += 2
        sql += " ORDER BY FECHA_CREACION DESC FETCH FIRST 200 ROWS ONLY"

        rows = oracle.fetch_all(sql, params)
        cols = [
            "token_id", "usuario", "no_cia", "bloquear_cia", "punto", "bloquear_punto",
            "nombre", "prefijo",
            "fecha_creacion", "fecha_expira", "fecha_ultimo_uso",
            "ip_ultimo_uso", "st_activo", "creado_por",
        ]
        items = [dict(zip(cols, row)) for row in rows]
        return Response({"items": items})

    def post(self, request):
        body = request.data or {}
        if not body.get("usuario"):
            return Response({"detail": "usuario es requerido"}, status=status.HTTP_400_BAD_REQUEST)
        token_id, plaintext = create_token_row(
            usuario=body["usuario"],
            nombre=body.get("nombre", "MCP token"),
            no_cia=body.get("no_cia") or None,
            bloquear_cia=bool(body.get("bloquear_cia")),
            punto=body.get("punto") or None,
            bloquear_punto=bool(body.get("bloquear_punto")),
            fecha_expira_iso=_parse_expira(body),
            creado_por=request.user.username,
        )
        return Response(
            {"token_id": token_id, "plaintext": plaintext},
            status=status.HTTP_201_CREATED,
        )


class TokenDetailView(APIView):
    """PATCH /api/admin/mcp/tokens/<token_id>/  -> revoca / renombra"""
    permission_classes = [IsAuthenticated, IsLegacyAdmin]

    def patch(self, request, token_id):
        body = request.data or {}
        fields = []
        params: list = []
        i = 1
        if "st_activo" in body:
            fields.append(f"ST_ACTIVO = :{i}"); params.append(body["st_activo"]); i += 1
        if "nombre" in body:
            fields.append(f"NOMBRE = :{i}"); params.append(body["nombre"]); i += 1
        if not fields:
            return Response({"detail": "no fields"}, status=status.HTTP_400_BAD_REQUEST)
        params.append(token_id)

        rc = oracle.execute(
            f"UPDATE ABREGONZA.TMCP_TOKEN SET {', '.join(fields)} WHERE TOKEN_ID = :{i}",
            params,
        )
        if rc == 0:
            return Response({"detail": "not found"}, status=status.HTTP_404_NOT_FOUND)

        invalidate_cache()
        row = oracle.fetch_one(
            "SELECT ST_ACTIVO, NOMBRE FROM ABREGONZA.TMCP_TOKEN WHERE TOKEN_ID=:1",
            [token_id],
        )
        return Response({"st_activo": row[0], "nombre": row[1]})


class TokenUsageView(APIView):
    """GET /api/admin/mcp/tokens/<token_id>/usage/  -> ultimas 100 llamadas"""
    permission_classes = [IsAuthenticated, IsLegacyAdmin]

    def get(self, request, token_id):
        rows = oracle.fetch_all(
            """
            SELECT TO_CHAR(FECHA, 'YYYY-MM-DD HH24:MI:SS'),
                   TOOL, OK, ERROR_CODE, DURATION_MS, IP
              FROM ABREGONZA.TMCP_TOKEN_USO
             WHERE TOKEN_ID = :1
             ORDER BY FECHA DESC
             FETCH FIRST 100 ROWS ONLY
            """,
            [token_id],
        )
        items = [
            {"fecha": r[0], "tool": r[1], "ok": r[2],
             "error_code": r[3], "duration_ms": r[4], "ip": r[5]}
            for r in rows
        ]
        return Response({"items": items})
