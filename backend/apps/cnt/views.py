from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from apps.legacy.repositories import cnt_repo
from apps.legacy.repositories.permissions_repo import get_user_flags, list_user_modules


def _get_ctx(request):
    """Extract no_cia and punto from query params or POST data."""
    data = request.query_params if request.method == 'GET' else request.data
    no_cia = data.get('no_cia', '')
    punto = data.get('punto', '')
    return no_cia, punto


def _check_flag(request, flag: str, no_cia: str, punto: str):
    """Return True if user has the given CNT flag for this company/punto."""
    try:
        flags = get_user_flags(request.user.username, 'cnt', no_cia, punto)
        return bool(flags.get(flag, False))
    except Exception:
        return False


def _has_cnt_access(request, no_cia: str):
    """Check if user has ANY access to CNT module for the given company."""
    try:
        modules = list_user_modules(request.user.username)
        return any(m.get('MODULO', '').upper() == 'CNT' for m in modules)
    except Exception:
        return False


class CntConfigView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia, _ = _get_ctx(request)
        if not no_cia:
            return Response({'error': 'no_cia requerido'}, status=400)
        try:
            data = cnt_repo.get_config(no_cia)
            return Response(data)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class CatalogoListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        search = request.query_params.get('search')
        tipo = request.query_params.get('tipo')
        clase = request.query_params.get('clase')
        activa = request.query_params.get('activa')
        if activa is not None:
            activa = activa.lower() in ('true', '1', 's')
        data = cnt_repo.list_catalogo(search=search, tipo=tipo, clase=clase, activa=activa)
        return Response(data)

    def post(self, request):
        no_cia, punto = _get_ctx(request)
        if not _check_flag(request, 'CREAR_CUENTA', no_cia, punto):
            return Response({'error': 'Sin permiso CREAR_CUENTA'}, status=403)
        d = request.data
        try:
            cnt_repo.create_cuenta(
                d['cuenta'], d['descripcion'], d['tipo'], d['clase'],
                d.get('acepta_movimiento', 'S'), d.get('activa', 'S')
            )
            return Response({'ok': True}, status=201)
        except Exception as e:
            return Response({'error': str(e)}, status=400)


class CatalogoDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, cuenta):
        data = cnt_repo.get_cuenta(cuenta)
        if not data:
            return Response({'error': 'Cuenta no encontrada'}, status=404)
        return Response(data)

    def patch(self, request, cuenta):
        no_cia, punto = _get_ctx(request)
        if not _check_flag(request, 'CREAR_CUENTA', no_cia, punto):
            return Response({'error': 'Sin permiso CREAR_CUENTA'}, status=403)
        try:
            cnt_repo.update_cuenta(cuenta, **request.data)
            return Response({'ok': True})
        except Exception as e:
            return Response({'error': str(e)}, status=400)


class TcuentaListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(cnt_repo.list_tcuenta())


class CentrosCostoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia, _ = _get_ctx(request)
        if not no_cia:
            return Response({'error': 'no_cia requerido'}, status=400)
        return Response(cnt_repo.list_centros_costo(no_cia))

    def post(self, request):
        no_cia, punto = _get_ctx(request)
        if not _check_flag(request, 'CREAR_CUENTA', no_cia, punto):
            return Response({'error': 'Sin permiso CREAR_CUENTA'}, status=403)
        d = request.data
        try:
            data = cnt_repo.create_centro_costo(
                d['centro_costo'],
                d['descripcion'],
                d.get('acepta_movi', 'N'),
                request.user.username,
            )
            return Response(data, status=201)
        except Exception as e:
            return Response({'error': str(e)}, status=400)


class PeriodosView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia, _ = _get_ctx(request)
        if not no_cia:
            return Response({'error': 'no_cia requerido'}, status=400)
        return Response(cnt_repo.list_periodos(no_cia))


class NcfListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia, punto = _get_ctx(request)
        if not no_cia:
            return Response({'error': 'no_cia requerido'}, status=400)
        return Response(cnt_repo.list_ncf(no_cia))

    def post(self, request):
        no_cia, punto = _get_ctx(request)
        if not _check_flag(request, 'ADMINISTRAR_NCF', no_cia, punto):
            return Response({'error': 'Sin permiso ADMINISTRAR_NCF'}, status=403)
        d = request.data
        try:
            data = cnt_repo.create_ncf(
                no_cia,
                d['codigo_ncf'],
                d['ncf_inicial'],
                d['ncf_final'],
                d.get('tipo_ncf_fiscal', 'NORMAL'),
                d.get('cant_min_ncf', 50),
                d.get('fecha_vencimiento'),
                d.get('ncf_manual', 'N'),
            )
            return Response(data, status=201)
        except Exception as e:
            return Response({'error': str(e)}, status=400)


class NcfDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, codigo_ncf):
        no_cia, punto = _get_ctx(request)
        if not _check_flag(request, 'ADMINISTRAR_NCF', no_cia, punto):
            return Response({'error': 'Sin permiso ADMINISTRAR_NCF'}, status=403)
        try:
            cnt_repo.update_ncf(no_cia, codigo_ncf, **request.data)
            return Response({'ok': True})
        except Exception as e:
            return Response({'error': str(e)}, status=400)


class AsientosListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qp = request.query_params
        no_cia = qp.get('no_cia', '')
        punto = qp.get('punto', '')
        ano = qp.get('ano')
        mes = qp.get('mes')
        if not all([no_cia, punto, ano, mes]):
            return Response({'error': 'no_cia, punto, ano, mes requeridos'}, status=400)
        aut = qp.get('autorizado')
        act = qp.get('actualizado')
        anu = qp.get('anulado')
        def parse_bool(v):
            if v is None: return None
            return v.lower() in ('true', '1', 's')
        try:
            data = cnt_repo.list_asientos(
                no_cia, punto, int(ano), int(mes),
                page=int(qp.get('page', 1)),
                page_size=int(qp.get('page_size', 50)),
                search=qp.get('search'),
                autorizado=parse_bool(aut),
                actualizado=parse_bool(act),
                anulado=parse_bool(anu),
            )
            return Response(data)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    def post(self, request):
        d = request.data
        no_cia = d.get('no_cia', '')
        punto = d.get('punto', '')
        if not _check_flag(request, 'DIGITAR_ASIENTO', no_cia, punto):
            return Response({'error': 'Sin permiso DIGITAR_ASIENTO'}, status=403)
        try:
            no_asiento = cnt_repo.create_asiento(
                usuario=request.user.username,
                no_cia=no_cia,
                punto=punto,
                ano=d['ano'],
                mes=d['mes'],
                fecha=d['fecha'],
                detalle=d['detalle'],
                lineas=d['lineas'],
                afecta_us=d.get('afecta_us', 'N'),
            )
            return Response({'no_asiento': no_asiento}, status=201)
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class AsientoDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, no_asiento):
        qp = request.query_params
        no_cia = qp.get('no_cia', '')
        punto = qp.get('punto', '')
        ano = qp.get('ano')
        mes = qp.get('mes')
        if not all([no_cia, punto, ano, mes]):
            return Response({'error': 'no_cia, punto, ano, mes requeridos'}, status=400)
        data = cnt_repo.get_asiento(no_cia, punto, int(ano), int(mes), no_asiento)
        if not data:
            return Response({'error': 'Asiento no encontrado'}, status=404)
        return Response(data)


class AprobarAsientoView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, no_asiento):
        d = request.data
        no_cia = d.get('no_cia', '')
        punto = d.get('punto', '')
        if not _check_flag(request, 'APROBAR_ASIENTO', no_cia, punto):
            return Response({'error': 'Sin permiso APROBAR_ASIENTO'}, status=403)
        try:
            cnt_repo.aprobar_asiento(no_cia, punto, d['ano'], d['mes'], no_asiento, request.user.username)
            return Response({'ok': True})
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class ActualizarAsientoView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, no_asiento):
        d = request.data
        no_cia = d.get('no_cia', '')
        punto = d.get('punto', '')
        if not _check_flag(request, 'ACTUALIZAR_ASIENTO', no_cia, punto):
            return Response({'error': 'Sin permiso ACTUALIZAR_ASIENTO'}, status=403)
        try:
            cnt_repo.actualizar_asiento(no_cia, punto, d['ano'], d['mes'], no_asiento, request.user.username)
            return Response({'ok': True})
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class AnularAsientoView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, no_asiento):
        d = request.data
        no_cia = d.get('no_cia', '')
        punto = d.get('punto', '')
        try:
            cnt_repo.anular_asiento(no_cia, punto, d['ano'], d['mes'], no_asiento, request.user.username)
            return Response({'ok': True})
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class BalanceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qp = request.query_params
        no_cia = qp.get('no_cia', '')
        punto = qp.get('punto', '')
        ano = qp.get('ano')
        mes = qp.get('mes')
        if not _check_flag(request, 'GENERAR_BALANCE', no_cia, punto):
            return Response({'error': 'Sin permiso GENERAR_BALANCE'}, status=403)
        if not all([no_cia, punto, ano, mes]):
            return Response({'error': 'no_cia, punto, ano, mes requeridos'}, status=400)
        try:
            data = cnt_repo.get_balance(no_cia, punto, int(ano), int(mes))
            return Response(data)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class MayorView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qp = request.query_params
        no_cia = qp.get('no_cia', '')
        punto = qp.get('punto', '')
        cuenta = qp.get('cuenta', '')
        ano = qp.get('ano')
        mes_ini = qp.get('mes_ini', '1')
        mes_fin = qp.get('mes_fin', '12')
        if not _check_flag(request, 'IMPRIMIR_MAYOR', no_cia, punto):
            return Response({'error': 'Sin permiso IMPRIMIR_MAYOR'}, status=403)
        if not all([no_cia, punto, cuenta, ano]):
            return Response({'error': 'no_cia, punto, cuenta, ano requeridos'}, status=400)
        try:
            data = cnt_repo.get_mayor(no_cia, punto, cuenta, int(ano), int(mes_ini), int(mes_fin))
            return Response(data)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class CierresView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia, punto = _get_ctx(request)
        if not all([no_cia, punto]):
            return Response({'error': 'no_cia y punto requeridos'}, status=400)
        return Response(cnt_repo.get_cierres(no_cia, punto))
