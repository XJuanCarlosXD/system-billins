"""Endpoint de monitoreo del uso del MCP. Agregados directamente en Oracle.

Adaptado al stack DRF + apps.legacy.client (no JsonResponse + django.db.connection).
"""
from datetime import datetime, timedelta, timezone

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.legacy import client as oracle
from apps.auth_legacy.views import IsLegacyAdmin


_GRAN_MAP = {"hora": "HH24", "dia": "DD", "semana": "IW"}


def _gran(g: str) -> str:
    return _GRAN_MAP.get(g, "HH24")


class UsageView(APIView):
    """GET /api/admin/mcp/usage/?desde=...&hasta=...&granularidad=hora|dia|semana"""
    permission_classes = [IsAuthenticated, IsLegacyAdmin]

    def get(self, request):
        desde = request.query_params.get("desde")
        hasta = request.query_params.get("hasta")
        now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
        if not desde:
            desde = (now_utc - timedelta(hours=24)).strftime("%Y-%m-%d %H:%M")
        if not hasta:
            hasta = now_utc.strftime("%Y-%m-%d %H:%M")
        gran = request.query_params.get("granularidad", "hora")
        usuario_f = request.query_params.get("usuario")
        tool_f = request.query_params.get("tool")
        only_err = request.query_params.get("ok") == "N"

        where = ["u.FECHA BETWEEN TO_DATE(:1,'YYYY-MM-DD HH24:MI') AND TO_DATE(:2,'YYYY-MM-DD HH24:MI')"]
        p: list = [desde, hasta]
        i = 3
        if usuario_f:
            where.append(f"t.USUARIO = :{i}"); p.append(usuario_f); i += 1
        if tool_f:
            where.append(f"u.TOOL = :{i}"); p.append(tool_f); i += 1
        if only_err:
            where.append("u.OK = 'N'")
        where_sql = " AND ".join(where)

        join = (
            "FROM ABREGONZA.TMCP_TOKEN_USO u "
            "JOIN ABREGONZA.TMCP_TOKEN t ON t.TOKEN_ID = u.TOKEN_ID "
            "WHERE " + where_sql
        )

        gran_token = _gran(gran)

        kpi_row = oracle.fetch_one(
            f"""
            SELECT COUNT(*) AS total,
                   SUM(CASE WHEN u.OK='S' THEN 1 ELSE 0 END) AS ok,
                   SUM(CASE WHEN u.OK='N' THEN 1 ELSE 0 END) AS err,
                   MEDIAN(u.DURATION_MS) AS p50,
                   PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY u.DURATION_MS) AS p95,
                   PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY u.DURATION_MS) AS p99,
                   COUNT(DISTINCT t.USUARIO) AS usrs,
                   COUNT(DISTINCT t.TOKEN_ID) AS toks
            {join}
            """,
            p,
        ) or (0, 0, 0, 0, 0, 0, 0, 0)
        total, ok, err, p50, p95, p99, usrs, toks = kpi_row

        serie_rows = oracle.fetch_all(
            f"""
            SELECT TO_CHAR(TRUNC(u.FECHA, '{gran_token}'),'YYYY-MM-DD"T"HH24:MI'),
                   SUM(CASE WHEN u.OK='S' THEN 1 ELSE 0 END),
                   SUM(CASE WHEN u.OK='N' THEN 1 ELSE 0 END),
                   PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY u.DURATION_MS)
            {join}
            GROUP BY TRUNC(u.FECHA, '{gran_token}')
            ORDER BY 1
            """,
            p,
        )
        serie = [
            {"bucket": r[0], "ok": int(r[1] or 0), "error": int(r[2] or 0), "p95_ms": int(r[3] or 0)}
            for r in serie_rows
        ]

        tools_rows = oracle.fetch_all(
            f"""
            SELECT u.TOOL, COUNT(*) calls,
                   ROUND(SUM(CASE WHEN u.OK='N' THEN 1 ELSE 0 END) / COUNT(*), 4) error_rate,
                   PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY u.DURATION_MS) p95
            {join}
            GROUP BY u.TOOL
            ORDER BY calls DESC FETCH FIRST 10 ROWS ONLY
            """,
            p,
        )
        top_tools = [
            {"tool": r[0], "calls": int(r[1]), "error_rate": float(r[2] or 0), "p95_ms": int(r[3] or 0)}
            for r in tools_rows
        ]

        users_rows = oracle.fetch_all(
            f"""
            SELECT t.USUARIO, COUNT(*) calls,
                   TO_CHAR(MAX(u.FECHA),'YYYY-MM-DD"T"HH24:MI')
            {join}
            GROUP BY t.USUARIO
            ORDER BY calls DESC FETCH FIRST 10 ROWS ONLY
            """,
            p,
        )
        top_users = [
            {"usuario": r[0], "calls": int(r[1]), "ultimo_uso": r[2]}
            for r in users_rows
        ]

        err_rows = oracle.fetch_all(
            f"""
            SELECT NVL(u.ERROR_CODE,'N/A') ec, COUNT(*) calls,
                   MAX(u.TOOL) KEEP (DENSE_RANK FIRST ORDER BY u.FECHA DESC) ultima_tool
            {join}
              AND u.OK = 'N'
            GROUP BY u.ERROR_CODE
            ORDER BY calls DESC FETCH FIRST 10 ROWS ONLY
            """,
            p,
        )
        top_err = [
            {"error_code": r[0], "calls": int(r[1]), "ultima_tool": r[2]}
            for r in err_rows
        ]

        dl_rows = oracle.fetch_all(
            """
            SELECT u.TOOL, COUNT(*) FROM ABREGONZA.TMCP_TOKEN_USO u
             WHERE u.TOOL IN ('download:pdf','download:xlsx')
               AND u.FECHA BETWEEN TO_DATE(:1,'YYYY-MM-DD HH24:MI') AND TO_DATE(:2,'YYYY-MM-DD HH24:MI')
             GROUP BY u.TOOL
            """,
            [desde, hasta],
        )
        downloads = {r[0]: int(r[1]) for r in dl_rows}

        total_i = int(total or 0)
        err_rate = (int(err or 0) / total_i) if total_i else 0.0

        return Response({
            "kpis": {
                "total_calls": total_i,
                "calls_ok":    int(ok or 0),
                "calls_error": int(err or 0),
                "error_rate":  round(err_rate, 4),
                "p50_ms": int(p50 or 0), "p95_ms": int(p95 or 0), "p99_ms": int(p99 or 0),
                "usuarios_activos": int(usrs or 0),
                "tokens_activos":   int(toks or 0),
                "downloads_pdf":  downloads.get("download:pdf", 0),
                "downloads_xlsx": downloads.get("download:xlsx", 0),
            },
            "serie_temporal": serie,
            "top_tools":  top_tools,
            "top_usuarios": top_users,
            "top_errores":  top_err,
        })
