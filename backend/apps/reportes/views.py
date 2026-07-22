"""Endpoints /api/reportes/ — reportes de problemas ("Soporte")."""

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
            )
        except repo.ValidationError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(
            {"reporte_id": reporte_id, "estado": "ABIERTO"}, status=201
        )


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
