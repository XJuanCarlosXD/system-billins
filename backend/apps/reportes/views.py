"""Endpoints /api/reportes/ — reportes de problemas ("Soporte")."""

import hmac

from django.conf import settings
from django.http import HttpResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.legacy.repositories import users_repo

from . import repo


def _u(request) -> str:
    return (request.user.username or "").upper()


def _is_admin(request) -> bool:
    return bool(users_repo.is_dba(_u(request)))


class ReportesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        is_admin = _is_admin(request)
        mine = request.query_params.get("mine") in ("1", "true", "True")
        rows = repo.list_reportes(
            usuario=_u(request),
            is_admin=is_admin,
            mine=mine or not is_admin,
            estado=request.query_params.get("estado"),
            modulo=request.query_params.get("modulo"),
        )
        return Response({"items": rows})

    def post(self, request):
        body = request.data or {}
        try:
            reporte_id = repo.create_reporte(
                usuario=_u(request),
                modulo=body.get("modulo"),
                titulo=body.get("titulo"),
                descripcion=body.get("descripcion"),
                imagenes=body.get("imagenes") or [],
                error_log_id=body.get("error_log_id"),
            )
        except repo.ValidationError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(
            {"reporte_id": reporte_id, "estado": "ABIERTO"}, status=201
        )


class ErrorLogView(APIView):
    """POST /api/reportes/error-log/ — registro silencioso de un error del
    frontend (API error o crash de render). Best-effort: nunca devuelve 4xx/5xx
    por una falla propia, para no interrumpir el flujo del usuario que ya tuvo
    un error. Ademas de TSYS_ERROR_LOG, abre un TREP_PROBLEMA vinculado para
    que el runner ZentoryERP-Reportes-AutoFix lo revise en su ciclo normal."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        body = request.data or {}
        try:
            result = repo.log_error_ticket(
                usuario=_u(request),
                modulo=body.get("modulo"),
                url=body.get("url"),
                status_http=body.get("status_http"),
                mensaje=body.get("mensaje") or "error desconocido",
                detalle=body.get("detalle"),
            )
        except Exception:  # noqa: BLE001
            result = {"error_id": 0, "reporte_id": None}
        return Response(result, status=201)


class ReporteDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, reporte_id):
        try:
            row = repo.get_reporte(
                reporte_id, usuario=_u(request), is_admin=_is_admin(request)
            )
        except PermissionError:
            return Response({"detail": "forbidden"}, status=403)
        if not row:
            return Response({"detail": "not_found"}, status=404)
        return Response(row)

    def patch(self, request, reporte_id):
        body = request.data or {}
        try:
            result = repo.update_estado(
                reporte_id,
                usuario=_u(request),
                is_admin=_is_admin(request),
                nuevo_estado=body.get("estado"),
                nota_resolucion=body.get("nota_resolucion"),
            )
        except LookupError:
            return Response({"detail": "not_found"}, status=404)
        except PermissionError:
            return Response({"detail": "forbidden"}, status=403)
        except repo.ValidationError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(result)


class ReporteResponderView(APIView):
    """POST /api/reportes/<id>/responder/ — el autor (o un admin) responde
    la pregunta que el runner dejo en HOLD. Reabre el reporte a ABIERTO."""

    permission_classes = [IsAuthenticated]

    def post(self, request, reporte_id):
        body = request.data or {}
        try:
            result = repo.responder_hold(
                reporte_id,
                usuario=_u(request),
                is_admin=_is_admin(request),
                mensaje=body.get("mensaje"),
            )
        except LookupError:
            return Response({"detail": "not_found"}, status=404)
        except PermissionError:
            return Response({"detail": "forbidden"}, status=403)
        except repo.ValidationError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(result)


class ReporteImagenView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, reporte_id, imagen_id):
        try:
            found = repo.get_imagen(
                reporte_id, imagen_id,
                usuario=_u(request), is_admin=_is_admin(request),
            )
        except PermissionError:
            return Response({"detail": "forbidden"}, status=403)
        if not found:
            return Response({"detail": "not_found"}, status=404)
        media_type, data = found
        return HttpResponse(
            data, content_type=media_type or "application/octet-stream"
        )


def _check_agente_token(request) -> bool:
    auth = request.headers.get("Authorization") or ""
    if not auth.startswith("Bearer "):
        return False
    token = auth[len("Bearer "):]
    expected = settings.AGENTE_REPORTES_TOKEN
    return bool(expected) and hmac.compare_digest(token, expected)


class AgenteLanzarView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not _is_admin(request):
            return Response({"detail": "forbidden"}, status=403)
        try:
            result = repo.crear_run(usuario=_u(request))
        except repo.ValidationError as e:
            return Response({"detail": str(e)}, status=409)
        return Response(result, status=201)


class AgenteEstadoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        row = repo.get_ultimo_run()
        return Response(row or {})


class AgentePendienteView(APIView):
    permission_classes = []

    def get(self, request):
        if not _check_agente_token(request):
            return Response({"detail": "forbidden"}, status=403)
        claimed = repo.reclamar_pendiente()
        if not claimed:
            return Response({"pendiente": False})
        return Response({"pendiente": True, **claimed})


class AgenteResultadoView(APIView):
    permission_classes = []

    def post(self, request):
        if not _check_agente_token(request):
            return Response({"detail": "forbidden"}, status=403)
        body = request.data or {}
        try:
            result = repo.finalizar_run(
                body.get("run_id"),
                estado=body.get("estado"),
                resumen=body.get("resumen"),
                commit_sha=body.get("commit_sha"),
            )
        except repo.ValidationError as e:
            return Response({"detail": str(e)}, status=400)
        except LookupError:
            return Response({"detail": "not_found"}, status=404)
        return Response(result)
