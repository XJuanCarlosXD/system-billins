"""Vistas Fat — primer endpoint end-to-end + alertas NCF.

Cadena: auth Oracle → permisos del usuario → repo legacy → DRF response.
"""
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.legacy.repositories import companies_repo, fat_repo, permissions_repo


def _as_bool(value, default=False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {'1', 'true', 'yes', 'y', 's', 'on'}


def _check_fat_access(username: str, no_cia: str, punto: str):
    perms = permissions_repo.get_for(username, 'fat', no_cia, punto)
    if perms is None or not perms.activo:
        return Response(
            {'detail': 'sin acceso a FAT en esta empresa/punto'},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


class FatNCFListView(APIView):
    """GET /api/fat/ncf/?no_cia=01&punto=01"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia')
        punto = request.query_params.get('punto')
        if not no_cia or not punto:
            return Response(
                {'detail': 'no_cia y punto son requeridos'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        forbidden = _check_fat_access(request.user.username, no_cia, punto)
        if forbidden:
            return forbidden
        rangos = fat_repo.list_ncf_ranges(no_cia, punto)
        tipos = fat_repo.list_document_types(no_cia)
        return Response({
            'no_cia': no_cia,
            'punto': punto,
            'usuario': request.user.username,
            'ncf_ranges': [r.to_dict() for r in rangos],
            'document_types': [t.to_dict() for t in tipos],
        })

    def post(self, request):
        punto = request.query_params.get('punto') or request.data.get('punto') or '01'
        no_cia = request.data.get('no_cia')
        codigo_ncf = request.data.get('codigo_ncf')
        tipo_ncf_fiscal = request.data.get('tipo_ncf_fiscal')
        ncf_inicial = request.data.get('ncf_inicial')
        ncf_final = request.data.get('ncf_final')
        if not all([no_cia, codigo_ncf, tipo_ncf_fiscal, ncf_inicial, ncf_final]):
            return Response(
                {'detail': 'no_cia, codigo_ncf, tipo_ncf_fiscal, ncf_inicial y ncf_final son requeridos'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        forbidden = _check_fat_access(request.user.username, str(no_cia).strip(), str(punto).strip())
        if forbidden:
            return forbidden
        res = fat_repo.upsert_ncf_range(
            no_cia=str(no_cia).strip(),
            codigo_ncf=str(codigo_ncf).strip(),
            tipo_ncf_fiscal=str(tipo_ncf_fiscal).strip(),
            ncf_inicial=int(ncf_inicial),
            ncf_final=int(ncf_final),
            prox_ncf=int(request.data.get('prox_ncf') or ncf_inicial),
            ncf_manual=_as_bool(request.data.get('ncf_manual'), False),
            ncf_opcional=_as_bool(request.data.get('ncf_opcional'), False),
            cant_min_ncf=int(request.data.get('cant_min_ncf') or 0),
        )
        return Response(res, status=status.HTTP_201_CREATED)

    def patch(self, request):
        return self.post(request)


class FatDocumentTypesView(APIView):
    """CRUD básico para FAT.TFAT_TDOCU."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia')
        punto = request.query_params.get('punto') or '01'
        if not no_cia:
            return Response(
                {'detail': 'no_cia es requerido'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        forbidden = _check_fat_access(request.user.username, no_cia, punto)
        if forbidden:
            return forbidden
        tipos = fat_repo.list_document_types(no_cia)
        return Response({
            'no_cia': no_cia,
            'items': [t.to_dict() for t in tipos],
        })

    def post(self, request):
        punto = request.query_params.get('punto') or request.data.get('punto') or '01'
        no_cia = request.data.get('no_cia')
        tipo_docu = request.data.get('tipo_docu')
        descripcion = request.data.get('descripcion')
        tipo_transaccion = request.data.get('tipo_transaccion')
        if not all([no_cia, tipo_docu, descripcion, tipo_transaccion]):
            return Response(
                {'detail': 'no_cia, tipo_docu, descripcion y tipo_transaccion son requeridos'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        forbidden = _check_fat_access(request.user.username, str(no_cia).strip(), str(punto).strip())
        if forbidden:
            return forbidden
        res = fat_repo.upsert_document_type(
            no_cia=str(no_cia).strip(),
            tipo_docu=str(tipo_docu).strip(),
            descripcion=str(descripcion).strip(),
            tipo_transaccion=str(tipo_transaccion).strip(),
            codigo_ncf=request.data.get('codigo_ncf'),
            activo=_as_bool(request.data.get('activo'), True),
        )
        return Response(res, status=status.HTTP_201_CREATED)

    def patch(self, request):
        return self.post(request)


class FatNCFAlertsView(APIView):
    """GET /api/fat/ncf/alerts/

    Lista TODOS los rangos NCF de TODAS las empresas que están en bajo stock o
    estado crítico. Replica la alarma del sistema viejo cuando se acerca el
    agotamiento del rango y hay que pedir nuevos NCF a la DGII.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        only = request.query_params.get('level', 'low')  # 'low' | 'critical' | 'all'
        rangos = fat_repo.list_all_ncf_ranges()
        empresas = {c.no_cia: c for c in companies_repo.list_active()}

        alerts = []
        for r in rangos:
            triggered = (
                (only == 'low' and (r.low_stock or r.critical))
                or (only == 'critical' and r.critical)
                or (only == 'all')
            )
            if not triggered:
                continue
            cia = empresas.get(r.no_cia)
            alerts.append({
                'no_cia': r.no_cia,
                'empresa': cia.descripcion if cia else None,
                'rnc': cia.rnc if cia else None,
                'codigo_ncf': r.codigo_ncf,
                'ncf_inicial': r.ncf_inicial,
                'ncf_final': r.ncf_final,
                'prox_ncf': r.prox_ncf,
                'disponibles': r.disponibles,
                'cant_min_ncf': r.cant_min_ncf,
                'low_stock': r.low_stock,
                'critical': r.critical,
                'severity': 'critical' if r.critical else ('warning' if r.low_stock else 'ok'),
            })
        # Orden: critical primero, luego por menos disponibles
        alerts.sort(key=lambda a: (not a['critical'], a['disponibles']))
        return Response({
            'count': len(alerts),
            'level': only,
            'alerts': alerts,
        })


class FatSearchView(APIView):
    """GET /api/fat/search/?no_cia=01&punto=01&page=1&page_size=25&search="""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia')
        punto = request.query_params.get('punto', '01')
        search = request.query_params.get('search', '')
        try:
            page = int(request.query_params.get('page', '1'))
            page_size = int(request.query_params.get('page_size', '25'))
        except ValueError:
            return Response(
                {'detail': 'page y page_size deben ser enteros'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not no_cia:
            return Response(
                {'detail': 'no_cia es requerido'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        forbidden = _check_fat_access(request.user.username, no_cia, punto)
        if forbidden:
            return forbidden

        try:
            result = fat_repo.search_invoices(no_cia, punto, page, page_size, search)
            return Response(result)
        except Exception as e:
            return Response(
                {'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
