"""Endpoints /api/historial/ — bitácora de auditoría."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.auth_legacy.views import IsLegacyAdmin

from . import repo


class MiActividadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        limit = request.query_params.get("limit", "10")
        items = repo.list_mio(request.user.username, limit=int(limit))
        return Response({"items": items})


class HistorialAdminView(APIView):
    permission_classes = [IsAuthenticated, IsLegacyAdmin]

    def get(self, request):
        qp = request.query_params
        result = repo.list_admin(
            usuario=qp.get("usuario"),
            modulo=qp.get("modulo"),
            tipo_documento=qp.get("tipo_documento"),
            no_documento=qp.get("no_documento"),
            accion=qp.get("accion"),
            fecha_desde=qp.get("fecha_desde"),
            fecha_hasta=qp.get("fecha_hasta"),
            page=int(qp.get("page", "1")),
            page_size=int(qp.get("page_size", "25")),
        )
        return Response(result)


class HistorialDocumentoView(APIView):
    """El historial de UN documento requiere el mismo permiso que ya protege
    verlo (asignación de tipo_docu por módulo/empresa/punto) — no requiere ser
    admin, salvo que el usuario sea DBA, que ve todo."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.legacy.repositories import permissions_repo, users_repo

        qp = request.query_params
        no_cia = qp.get("no_cia")
        punto = qp.get("punto")
        modulo = qp.get("modulo")
        tipo_documento = qp.get("tipo_documento")
        no_documento = qp.get("no_documento")
        if not all([no_cia, punto, modulo, tipo_documento, no_documento]):
            return Response(
                {"detail": "no_cia, punto, modulo, tipo_documento y no_documento son requeridos"},
                status=400,
            )

        username = request.user.username
        if not users_repo.is_dba(username):
            if permissions_repo.module_has_doc_perms(modulo):
                # Módulo con permisos finos por tipo de documento (FAT/CXP/INV/CXC/CHC/ACF).
                asignados = permissions_repo.list_user_doc_perms(username, modulo, no_cia, punto)
                tipos_asignados = {d["tipo_docu"] for d in asignados}
                if tipo_documento.upper() not in tipos_asignados:
                    return Response({"detail": "forbidden"}, status=403)
            else:
                # Módulo sin tabla de tipo-documento (ej. ODC): gatear por
                # acceso al módulo, igual que ya protege ver la orden/requisición.
                if permissions_repo.get_for(username, modulo, no_cia, punto) is None:
                    return Response({"detail": "forbidden"}, status=403)

        items = repo.list_documento(
            no_cia=no_cia, punto=punto, modulo=modulo,
            tipo_documento=tipo_documento, no_documento=no_documento,
        )
        return Response({"items": items})
