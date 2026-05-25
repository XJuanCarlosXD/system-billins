"""Vistas INV — Inventario.

Cadena: auth Oracle → no_cia → repo legacy → DRF response.
"""
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.legacy.repositories import inv_repo


def _get_no_cia(request) -> str:
    """Extrae no_cia de query params o body."""
    if request.method == 'GET':
        return request.query_params.get('no_cia', '')
    return request.data.get('no_cia', '')


class AlmacenesView(APIView):
    """GET /api/inv/almacenes/?no_cia=01"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = _get_no_cia(request)
        if not no_cia:
            return Response(
                {'detail': 'no_cia es requerido'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            items = inv_repo.list_almacenes(no_cia)
            return Response({'no_cia': no_cia, 'count': len(items), 'items': items})
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ProductosView(APIView):
    """GET /api/inv/productos/?no_cia=01&page=1&page_size=100"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = _get_no_cia(request)
        if not no_cia:
            return Response(
                {'detail': 'no_cia es requerido'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            page = int(request.query_params.get('page', '1'))
            page_size = int(request.query_params.get('page_size', '100'))
        except ValueError:
            return Response(
                {'detail': 'page y page_size deben ser enteros'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        offset = (page - 1) * page_size
        try:
            items = inv_repo.list_productos(no_cia, limit=page_size, offset=offset)
            total = inv_repo.count_productos(no_cia)
            return Response({
                'no_cia': no_cia,
                'page': page,
                'page_size': page_size,
                'total': total,
                'items': items,
            })
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ExistenciaView(APIView):
    """GET /api/inv/existencia/?no_cia=01&almacen=01"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = _get_no_cia(request)
        if not no_cia:
            return Response(
                {'detail': 'no_cia es requerido'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        almacen = request.query_params.get('almacen')
        try:
            items = inv_repo.get_existencia_almacen(no_cia, almacen=almacen)
            return Response({
                'no_cia': no_cia,
                'almacen': almacen,
                'count': len(items),
                'items': items,
            })
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TransaccionesView(APIView):
    """GET /api/inv/transacciones/?no_cia=01&limit=50"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = _get_no_cia(request)
        if not no_cia:
            return Response(
                {'detail': 'no_cia es requerido'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            limit = int(request.query_params.get('limit', '50'))
        except ValueError:
            return Response(
                {'detail': 'limit debe ser un entero'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            items = inv_repo.list_transacciones(no_cia, limit=limit)
            return Response({'no_cia': no_cia, 'count': len(items), 'items': items})
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
