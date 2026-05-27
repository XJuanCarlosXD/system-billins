import os
import mimetypes
from pathlib import Path
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.conf import settings
from django.http import FileResponse, Http404
from apps.legacy.repositories import cnt_repo
from apps.legacy.repositories.permissions_repo import get_user_flags, list_user_modules
from apps.legacy import client as legacy_client

LOGO_DIR = Path(getattr(settings, 'MEDIA_ROOT', '/app/media')) / 'logos'


def _get_ctx(request):
    data = request.query_params if request.method == 'GET' else request.data
    no_cia = data.get('no_cia', '')
    punto = data.get('punto', '')
    return no_cia, punto


def _check_flag(request, flag: str, no_cia: str, punto: str):
    try:
        flags = get_user_flags(request.user.username, 'cnt', no_cia, punto)
        return bool(flags.get(flag, False))
    except Exception:
        return False


def _has_cnt_access(request, no_cia: str):
    try:
        modules = list_user_modules(request.user.username)
        return any(m.get('MODULO', '').upper() == 'CNT' for m in modules)
    except Exception:
        return False


# ---- Config original ----

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


# ---- Compañías (FCNT101) ----

class CiasView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia')
        try:
            if no_cia:
                data = cnt_repo.get_cia(no_cia)
                if not data:
                    return Response({'error': 'Compania no encontrada'}, status=404)
                return Response(data)
            return Response(cnt_repo.list_cias())
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    def post(self, request):
        no_cia = request.data.get('no_cia', '').strip()
        descripcion = request.data.get('descripcion', '').strip()
        if not no_cia or not descripcion:
            return Response({'error': 'no_cia y descripcion son requeridos'}, status=400)
        if cnt_repo.get_cia(no_cia):
            return Response({'error': f'La compania {no_cia} ya existe'}, status=400)
        cnt_repo.create_cia(no_cia, descripcion, request.user.username,
            **{k: v for k, v in request.data.items() if k not in ('no_cia', 'descripcion')})
        return Response({'ok': True, 'no_cia': no_cia})

    def patch(self, request):
        no_cia = request.data.get('no_cia') or request.query_params.get('no_cia')
        if not no_cia:
            return Response({'error': 'no_cia requerido'}, status=400)
        try:
            cnt_repo.update_cia(no_cia, **{k: v for k, v in request.data.items() if k != 'no_cia'})
            return Response({'ok': True})
        except Exception as e:
            return Response({'error': str(e)}, status=400)


# ---- Sucursales / Puntos (FCNT102) ----

class SucursalesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia', '')
        punto = request.query_params.get('punto')
        if not no_cia:
            return Response({'error': 'no_cia requerido'}, status=400)
        try:
            if punto:
                data = cnt_repo.get_punto_full(no_cia, punto)
                if not data:
                    return Response({'error': 'Sucursal no encontrada'}, status=404)
                return Response(data)
            return Response(cnt_repo.list_puntos_full(no_cia))
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    def post(self, request):
        no_cia = request.data.get('no_cia', '').strip()
        punto = request.data.get('punto', '').strip()
        descripcion = request.data.get('descripcion', '').strip()
        ano = request.data.get('ano_proceso')
        if not all([no_cia, punto, descripcion, ano]):
            return Response({'error': 'no_cia, punto, descripcion y ano_proceso son requeridos'}, status=400)
        if cnt_repo.get_punto_full(no_cia, punto):
            return Response({'error': f'La sucursal {punto} ya existe para la compania {no_cia}'}, status=400)
        cnt_repo.create_punto(no_cia, punto, descripcion, int(ano), request.user.username,
            **{k: v for k, v in request.data.items() if k not in ('no_cia', 'punto', 'descripcion', 'ano_proceso')})
        return Response({'ok': True, 'punto': punto})

    def patch(self, request):
        no_cia = request.data.get('no_cia', '')
        punto = request.data.get('punto', '')
        if not all([no_cia, punto]):
            return Response({'error': 'no_cia y punto requeridos'}, status=400)
        try:
            cnt_repo.update_punto(no_cia, punto, **{k: v for k, v in request.data.items() if k not in ('no_cia', 'punto')})
            return Response({'ok': True})
        except Exception as e:
            return Response({'error': str(e)}, status=400)


# ---- Grupos Contables (FCNT107) ----

class GruposContablesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        grupo = request.query_params.get('grupo')
        try:
            if grupo:
                data = cnt_repo.get_grupo_contable(grupo)
                if not data:
                    return Response({'error': 'Grupo no encontrado'}, status=404)
                return Response(data)
            return Response(cnt_repo.list_grupos_contables())
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    def patch(self, request):
        grupo = request.data.get('grupo_contable') or request.query_params.get('grupo')
        if not grupo:
            return Response({'error': 'grupo_contable requerido'}, status=400)
        try:
            cnt_repo.update_grupo_contable(grupo, **{k: v for k, v in request.data.items() if k != 'grupo_contable'})
            return Response({'ok': True})
        except Exception as e:
            return Response({'error': str(e)}, status=400)


# ---- Catálogo ----

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

    def post(self, request):
        tipo = request.data.get('tipo', '').strip().upper()
        descripcion = request.data.get('descripcion', '').strip()
        clase = request.data.get('clase', '').strip().upper()
        if not all([tipo, descripcion, clase]):
            return Response({'error': 'tipo, descripcion y clase son requeridos'}, status=400)
        if clase not in ('A', 'P', 'C', 'I', 'E'):
            return Response({'error': 'clase debe ser A, P, C, I o E'}, status=400)
        if cnt_repo.get_tcuenta(tipo):
            return Response({'error': f'El tipo {tipo} ya existe'}, status=400)
        cnt_repo.create_tcuenta(tipo, descripcion, clase)
        return Response({'ok': True, 'tipo': tipo}, status=201)


class TcuentaDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, tipo):
        data = cnt_repo.get_tcuenta(tipo)
        if not data:
            return Response({'error': 'Tipo no encontrado'}, status=404)
        return Response(data)

    def patch(self, request, tipo):
        if not cnt_repo.get_tcuenta(tipo):
            return Response({'error': 'Tipo no encontrado'}, status=404)
        try:
            cnt_repo.update_tcuenta(tipo, **{k: v for k, v in request.data.items() if k != 'tipo'})
            return Response({'ok': True})
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    def delete(self, request, tipo):
        if not cnt_repo.get_tcuenta(tipo):
            return Response({'error': 'Tipo no encontrado'}, status=404)
        try:
            cnt_repo.delete_tcuenta(tipo)
            return Response({'ok': True})
        except Exception as e:
            return Response({'error': str(e)}, status=400)


class CiaHeaderView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia', '')
        if not no_cia:
            return Response({'error': 'no_cia requerido'}, status=400)
        data = cnt_repo.get_cia_header(no_cia)
        if not data:
            return Response({'error': 'Compania no encontrada'}, status=404)
        return Response(data)

    def post(self, request):
        """Upload company logo. Accepts multipart/form-data with field 'logo'."""
        no_cia = request.data.get('no_cia', '')
        if not no_cia:
            return Response({'error': 'no_cia requerido'}, status=400)
        logo_file = request.FILES.get('logo')
        if not logo_file:
            return Response({'error': 'Campo logo requerido'}, status=400)
        ext = Path(logo_file.name).suffix.lower()
        if ext not in ('.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'):
            return Response({'error': 'Formato de imagen no permitido'}, status=400)
        LOGO_DIR.mkdir(parents=True, exist_ok=True)
        dest = LOGO_DIR / f'{no_cia}{ext}'
        with open(dest, 'wb') as f:
            for chunk in logo_file.chunks():
                f.write(chunk)
        # Persist filename in Oracle
        with legacy_client.connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "UPDATE CNT.TCNT_CIAS SET LOGO=:1 WHERE NO_CIA=:2",
                [f'{no_cia}{ext}', no_cia]
            )
            conn.commit()
        return Response({'logo_url': f'/api/cnt/cia-logo/{no_cia}/'})

    def delete(self, request):
        no_cia = request.data.get('no_cia', '')
        if not no_cia:
            return Response({'error': 'no_cia requerido'}, status=400)
        for ext in ('.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'):
            dest = LOGO_DIR / f'{no_cia}{ext}'
            if dest.exists():
                dest.unlink()
        with legacy_client.connection() as conn:
            cur = conn.cursor()
            cur.execute("UPDATE CNT.TCNT_CIAS SET LOGO=NULL WHERE NO_CIA=:1", [no_cia])
            conn.commit()
        return Response({'ok': True})


class CiaLogoView(APIView):
    """Serve the company logo file (no authentication required so the PDF print window can load it)."""
    permission_classes = []

    def get(self, request, no_cia):
        # Scan for any extension
        for ext in ('.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'):
            fpath = LOGO_DIR / f'{no_cia}{ext}'
            if fpath.exists():
                mime, _ = mimetypes.guess_type(str(fpath))
                return FileResponse(open(fpath, 'rb'), content_type=mime or 'image/png')
        raise Http404('Logo no encontrado')


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


# ---- Asientos ----

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


# ---- Autorizar Mes completo (FCNT202) ----

class AutorizarMesView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        d = request.data
        no_cia = d.get('no_cia', '')
        punto = d.get('punto', '')
        ano = d.get('ano')
        mes = d.get('mes')
        if not all([no_cia, punto, ano, mes]):
            return Response({'error': 'no_cia, punto, ano, mes requeridos'}, status=400)
        if not _check_flag(request, 'APROBAR_ASIENTO', no_cia, punto):
            return Response({'error': 'Sin permiso APROBAR_ASIENTO'}, status=403)
        try:
            count = cnt_repo.autorizar_mes(no_cia, punto, int(ano), int(mes), request.user.username)
            return Response({'ok': True, 'asientos_autorizados': count})
        except Exception as e:
            return Response({'error': str(e)}, status=500)


# ---- Balance ----

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


# ---- Cierres (FCNT401 / FCNT402) ----

class CierresView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia, punto = _get_ctx(request)
        if not all([no_cia, punto]):
            return Response({'error': 'no_cia y punto requeridos'}, status=400)
        return Response(cnt_repo.get_cierres(no_cia, punto))


class CierreMensualView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Vista previa de datos del cierre mensual (FCNT401)."""
        no_cia = request.query_params.get('no_cia', '')
        punto = request.query_params.get('punto', '')
        if not all([no_cia, punto]):
            return Response({'error': 'no_cia y punto requeridos'}, status=400)
        try:
            data = cnt_repo.get_cierre_info(no_cia, punto)
            if not data:
                return Response({'error': 'Punto no encontrado'}, status=404)
            return Response(data)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    def post(self, request):
        """Ejecuta el cierre mensual."""
        d = request.data
        no_cia = d.get('no_cia', '')
        punto = d.get('punto', '')
        if not all([no_cia, punto]):
            return Response({'error': 'no_cia y punto requeridos'}, status=400)
        if not _check_flag(request, 'HACER_CIERRE', no_cia, punto):
            return Response({'error': 'Sin permiso HACER_CIERRE'}, status=403)
        try:
            result = cnt_repo.cierre_mensual(no_cia, punto, request.user.username)
            return Response(result)
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class AutorizarMesAnteriorView(APIView):
    """FCNT204 – Autorizar asientos de meses anteriores."""

    def post(self, request):
        user = request.user
        no_cia = request.data.get('no_cia', '').strip()
        punto = request.data.get('punto', '').strip()
        ano = request.data.get('ano')
        mes = request.data.get('mes')
        if not all([no_cia, punto, ano, mes]):
            return Response({'error': 'no_cia, punto, ano y mes son requeridos'}, status=400)
        perms = cnt_repo.get_permisos(user.username, no_cia, punto)
        if not perms or not perms.get('APROBAR_ASIENTO_MA'):
            return Response({'error': 'Sin permiso APROBAR_ASIENTO_MA'}, status=403)
        count = cnt_repo.autorizar_mes(no_cia, punto, int(ano), int(mes), user.username)
        return Response({'ok': True, 'asientos_autorizados': count})


class CatalogoSucursalView(APIView):
    """FCNT106 – Asignar cuentas a compania/sucursal."""

    def get(self, request):
        no_cia = request.query_params.get('no_cia', '').strip()
        punto = request.query_params.get('punto', '').strip()
        if not no_cia or not punto:
            return Response({'error': 'no_cia y punto son requeridos'}, status=400)
        rows = cnt_repo.list_catalogo_sucursal(no_cia, punto)
        return Response(rows)

    def post(self, request):
        user = request.user
        no_cia = request.data.get('no_cia', '').strip()
        punto = request.data.get('punto', '').strip()
        cuenta = request.data.get('cuenta', '').strip()
        asignar = request.data.get('asignar', True)
        if asignar in (False, 'false', '0', 0):
            asignar = False
        else:
            asignar = True
        if not all([no_cia, punto, cuenta]):
            return Response({'error': 'no_cia, punto y cuenta son requeridos'}, status=400)
        cnt_repo.assign_cuenta_sucursal(no_cia, punto, cuenta, asignar, user.username)
        return Response({'ok': True})


# ---- Tipos de Proyecto (FCNT110) ----

class TipoProyectoListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(cnt_repo.list_tipos_proyecto())

    def post(self, request):
        tipo = request.data.get('tipo', '').strip()
        descripcion = request.data.get('descripcion', '').strip()
        if not tipo or not descripcion:
            return Response({'error': 'tipo y descripcion son requeridos'}, status=400)
        if cnt_repo.get_tipo_proyecto(tipo):
            return Response({'error': f'El tipo {tipo} ya existe'}, status=400)
        cnt_repo.create_tipo_proyecto(tipo, descripcion)
        return Response({'ok': True, 'tipo': tipo}, status=201)


class TipoProyectoDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, tipo):
        data = cnt_repo.get_tipo_proyecto(tipo)
        if not data:
            return Response({'error': 'Tipo no encontrado'}, status=404)
        return Response(data)

    def patch(self, request, tipo):
        descripcion = request.data.get('descripcion', '').strip()
        if not descripcion:
            return Response({'error': 'descripcion requerida'}, status=400)
        if not cnt_repo.get_tipo_proyecto(tipo):
            return Response({'error': 'Tipo no encontrado'}, status=404)
        cnt_repo.update_tipo_proyecto(tipo, descripcion)
        return Response({'ok': True})

    def delete(self, request, tipo):
        if not cnt_repo.get_tipo_proyecto(tipo):
            return Response({'error': 'Tipo no encontrado'}, status=404)
        cnt_repo.delete_tipo_proyecto(tipo)
        return Response({'ok': True})


# ---- Movimientos de cuenta (FCNT502) ----

class MovimientoCuentaView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia', '')
        punto = request.query_params.get('punto', '')
        cuenta = request.query_params.get('cuenta', '').strip()
        desde_ano = int(request.query_params.get('desde_ano', 0) or 0)
        desde_mes = int(request.query_params.get('desde_mes', 1) or 1)
        hasta_ano = int(request.query_params.get('hasta_ano', 0) or 0)
        hasta_mes = int(request.query_params.get('hasta_mes', 12) or 12)
        tipo = request.query_params.get('tipo_movi', 'A')
        if not all([no_cia, punto, cuenta, desde_ano, hasta_ano]):
            return Response({'error': 'no_cia, punto, cuenta, desde_ano y hasta_ano son requeridos'}, status=400)
        rows = cnt_repo.get_movimientos_cuenta(no_cia, punto, cuenta, desde_ano, desde_mes, hasta_ano, hasta_mes, tipo)
        return Response(rows)


# ---- Asignar centros de costo a cuenta (FCNT109) ----

class CentroCuentaView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia', '')
        punto = request.query_params.get('punto', '')
        cuenta = request.query_params.get('cuenta', '').strip()
        if not all([no_cia, punto, cuenta]):
            return Response({'error': 'no_cia, punto y cuenta son requeridos'}, status=400)
        return Response(cnt_repo.get_centros_cuenta(no_cia, punto, cuenta))

    def post(self, request):
        no_cia = request.data.get('no_cia', '')
        punto = request.data.get('punto', '')
        cuenta = request.data.get('cuenta', '').strip()
        centro = request.data.get('centro_costo', '').strip()
        asignar = request.data.get('asignar', True)
        if not all([no_cia, punto, cuenta, centro]):
            return Response({'error': 'no_cia, punto, cuenta y centro_costo son requeridos'}, status=400)
        if asignar in (False, 'false', '0', 0):
            cnt_repo.desasignar_centro_cuenta(no_cia, punto, cuenta, centro)
        else:
            cnt_repo.asignar_centro_cuenta(no_cia, punto, cuenta, centro)
        return Response({'ok': True})