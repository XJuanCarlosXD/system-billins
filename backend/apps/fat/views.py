"""Vistas FAT - endpoints completos de Facturacion."""
import calendar
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.legacy.repositories import companies_repo, fat_repo, permissions_repo


def _ano_mes_to_range(ano: str, mes: str) -> tuple[str, str]:
    """Convert ano/mes integers to desde/hasta date strings (YYYY-MM-DD)."""
    y = int(ano or 0)
    m = int(mes or 0)
    if not y or not m:
        return '', ''
    last_day = calendar.monthrange(y, m)[1]
    return f'{y:04d}-{m:02d}-01', f'{y:04d}-{m:02d}-{last_day:02d}'


def _as_bool(value, default=False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {'1', 'true', 'yes', 'y', 's', 'on'}


def _check_fat_access(username: str, no_cia: str, punto: str):
    perms = permissions_repo.get_for(username, 'fat', no_cia, punto)
    if perms is None or not perms.activo:
        return Response({'detail': 'sin acceso a FAT en esta empresa/punto'},
                        status=status.HTTP_403_FORBIDDEN)
    return None


# -- NCF ----------------------------------------------------------------------

class FatNCFListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia')
        punto = request.query_params.get('punto')
        if not no_cia or not punto:
            return Response({'detail': 'no_cia y punto son requeridos'}, status=400)
        forbidden = _check_fat_access(request.user.username, no_cia, punto)
        if forbidden:
            return forbidden
        rangos = fat_repo.list_ncf_ranges(no_cia, punto)
        tipos = fat_repo.list_document_types(no_cia)
        return Response({'no_cia': no_cia, 'punto': punto, 'usuario': request.user.username,
                         'ncf_ranges': [r.to_dict() for r in rangos],
                         'document_types': [t.to_dict() for t in tipos]})

    def post(self, request):
        punto = request.query_params.get('punto') or request.data.get('punto') or '01'
        no_cia = request.data.get('no_cia')
        codigo_ncf = request.data.get('codigo_ncf')
        tipo_ncf_fiscal = request.data.get('tipo_ncf_fiscal')
        ncf_inicial = request.data.get('ncf_inicial')
        ncf_final = request.data.get('ncf_final')
        if not all([no_cia, codigo_ncf, tipo_ncf_fiscal, ncf_inicial, ncf_final]):
            return Response({'detail': 'campos requeridos faltantes'}, status=400)
        forbidden = _check_fat_access(request.user.username, str(no_cia).strip(), str(punto).strip())
        if forbidden:
            return forbidden
        res = fat_repo.upsert_ncf_range(
            no_cia=str(no_cia).strip(), codigo_ncf=str(codigo_ncf).strip(),
            tipo_ncf_fiscal=str(tipo_ncf_fiscal).strip(),
            ncf_inicial=int(ncf_inicial), ncf_final=int(ncf_final),
            prox_ncf=int(request.data.get('prox_ncf') or ncf_inicial),
            ncf_manual=_as_bool(request.data.get('ncf_manual'), False),
            ncf_opcional=_as_bool(request.data.get('ncf_opcional'), False),
            cant_min_ncf=int(request.data.get('cant_min_ncf') or 0))
        return Response(res, status=201)

    def patch(self, request):
        return self.post(request)


class FatNCFAlertsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        only = request.query_params.get('level', 'low')
        rangos = fat_repo.list_all_ncf_ranges()
        empresas = {c.no_cia: c for c in companies_repo.list_active()}
        alerts = []
        for r in rangos:
            triggered = ((only == 'low' and (r.low_stock or r.critical))
                         or (only == 'critical' and r.critical) or (only == 'all'))
            if not triggered:
                continue
            cia = empresas.get(r.no_cia)
            alerts.append({'no_cia': r.no_cia, 'empresa': cia.descripcion if cia else None,
                           'rnc': cia.rnc if cia else None,
                           'codigo_ncf': r.codigo_ncf,
                           'posiciones_fijas': r.posiciones_fijas,
                           'descripcion': r.descripcion,
                           'ncf_inicial': r.ncf_inicial, 'ncf_final': r.ncf_final,
                           'prox_ncf': r.prox_ncf,
                           'disponibles': r.disponibles,
                           'cant_min_ncf': r.cant_min_ncf, 'low_stock': r.low_stock,
                           'critical': r.critical,
                           'severity': 'critical' if r.critical else ('warning' if r.low_stock else 'ok')})
        alerts.sort(key=lambda a: (not a['critical'], a['disponibles']))
        return Response({'count': len(alerts), 'level': only, 'alerts': alerts})


# -- Tipos de Documento -------------------------------------------------------

class FatDocumentTypesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia')
        punto = request.query_params.get('punto') or '01'
        if not no_cia:
            return Response({'detail': 'no_cia es requerido'}, status=400)
        forbidden = _check_fat_access(request.user.username, no_cia, punto)
        if forbidden:
            return forbidden
        tipos = fat_repo.list_document_types(no_cia, only_active=False)
        return Response({'no_cia': no_cia, 'items': [t.to_dict() for t in tipos]})

    def post(self, request):
        punto = request.query_params.get('punto') or request.data.get('punto') or '01'
        no_cia = request.data.get('no_cia')
        tipo_docu = request.data.get('tipo_docu')
        descripcion = request.data.get('descripcion')
        tipo_transaccion = request.data.get('tipo_transaccion')
        if not all([no_cia, tipo_docu, descripcion, tipo_transaccion]):
            return Response({'detail': 'campos requeridos faltantes'}, status=400)
        forbidden = _check_fat_access(request.user.username, str(no_cia).strip(), str(punto).strip())
        if forbidden:
            return forbidden
        res = fat_repo.upsert_document_type(
            no_cia=str(no_cia).strip(), tipo_docu=str(tipo_docu).strip(),
            descripcion=str(descripcion).strip(), tipo_transaccion=str(tipo_transaccion).strip(),
            codigo_ncf=request.data.get('codigo_ncf'),
            activo=_as_bool(request.data.get('activo'), True),
            cuenta_contado=request.data.get('cuenta_contado'),
            cuenta_propina=request.data.get('cuenta_propina'),
            porciento_propina=request.data.get('porciento_propina', 0),
            afecta_cxc=_as_bool(request.data.get('afecta_cxc'), False),
            controlar_formulario=_as_bool(request.data.get('controlar_formulario'), False),
            almacen=request.data.get('almacen'))
        return Response(res, status=201)

    def patch(self, request):
        return self.post(request)


# -- Facturas -----------------------------------------------------------------

class FatFacturasView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia')
        punto = request.query_params.get('punto', '01')
        if not no_cia:
            return Response({'detail': 'no_cia es requerido'}, status=400)
        forbidden = _check_fat_access(request.user.username, no_cia, punto)
        if forbidden:
            return forbidden
        try:
            page = int(request.query_params.get('page', '1'))
            page_size = int(request.query_params.get('page_size', '30'))
        except ValueError:
            page, page_size = 1, 30
        try:
            result = fat_repo.list_facturas(
                no_cia=no_cia, punto=punto, page=page, page_size=page_size,
                search=request.query_params.get('search', ''),
                tipo=request.query_params.get('tipo', ''),
                estado=request.query_params.get('estado', ''),
                fecha_desde=request.query_params.get('desde', ''),
                fecha_hasta=request.query_params.get('hasta', ''),
                vendedor=request.query_params.get('vendedor', ''),
                no_cliente=request.query_params.get('no_cliente', ''),
                con_ventas_exentas=request.query_params.get('con_ventas_exentas', 'A'))
            return Response(result)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)

    def post(self, request):
        no_cia = request.data.get('no_cia')
        punto = request.data.get('punto', '01')
        tipo_factura = request.data.get('tipo_factura')
        no_cliente = request.data.get('no_cliente')
        fecha = request.data.get('fecha')
        vendedor = request.data.get('vendedor', '')
        forma_pago = request.data.get('forma_pago', '')
        no_lista = request.data.get('no_lista', '')
        nota = request.data.get('nota', '')
        lineas = request.data.get('lineas', [])
        if not all([no_cia, tipo_factura, no_cliente, fecha]):
            return Response({'detail': 'no_cia, tipo_factura, no_cliente y fecha son requeridos'}, status=400)
        if not lineas:
            return Response({'detail': 'Se requiere al menos una linea'}, status=400)
        forbidden = _check_fat_access(request.user.username, str(no_cia).strip(), str(punto).strip())
        if forbidden:
            return forbidden
        try:
            res = fat_repo.create_factura(
                no_cia=str(no_cia).strip(), punto=str(punto).strip(),
                tipo_factura=str(tipo_factura).strip(),
                no_cliente=int(no_cliente), fecha=str(fecha).strip(),
                vendedor=str(vendedor).strip(), forma_pago=str(forma_pago).strip(),
                no_lista=str(no_lista).strip(), nota=str(nota).strip(),
                lineas=lineas, usuario=request.user.username,
                codigo_ncf=str(request.data.get('codigo_ncf', '')).strip())
            return Response(res, status=201)
        except ValueError as e:
            return Response({'detail': str(e)}, status=400)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)


class FatFacturaDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, tipo: str, no_factura: str):
        no_cia = request.query_params.get('no_cia')
        punto = request.query_params.get('punto', '01')
        if not no_cia:
            return Response({'detail': 'no_cia es requerido'}, status=400)
        forbidden = _check_fat_access(request.user.username, no_cia, punto)
        if forbidden:
            return forbidden
        factura = fat_repo.get_factura(no_cia, punto, tipo, no_factura)
        if factura is None:
            return Response({'detail': 'Factura no encontrada'}, status=404)
        return Response(factura)


class FatAnularFacturaView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        no_cia = request.data.get('no_cia')
        punto = request.data.get('punto', '01')
        tipo_factura = request.data.get('tipo_factura')
        no_factura = request.data.get('no_factura')
        motivo = request.data.get('motivo', '')
        liberar_ncf = str(request.data.get('liberar_ncf', '')).lower() in ('true', '1', 's')
        tipo_anula_dgii = request.data.get('tipo_anula_dgii', '')
        if not all([no_cia, tipo_factura, no_factura]):
            return Response({'detail': 'no_cia, tipo_factura y no_factura son requeridos'}, status=400)
        forbidden = _check_fat_access(request.user.username, str(no_cia).strip(), str(punto).strip())
        if forbidden:
            return forbidden
        try:
            res = fat_repo.anular_factura(
                no_cia=str(no_cia).strip(), punto=str(punto).strip(),
                tipo_factura=str(tipo_factura).strip(), no_factura=str(no_factura).strip(),
                usuario=request.user.username, motivo=str(motivo).strip(),
                liberar_ncf=liberar_ncf, tipo_anula_dgii=str(tipo_anula_dgii).strip())
            return Response(res)
        except ValueError as e:
            return Response({'detail': str(e)}, status=404)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)


# -- Vendedores ---------------------------------------------------------------

class FatVendedoresView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia', '01')
        items = fat_repo.list_vendedores(no_cia)
        return Response({'items': items})


# -- Clientes -----------------------------------------------------------------

class FatClientesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia')
        punto = request.query_params.get('punto', '01')
        if not no_cia:
            return Response({'detail': 'no_cia es requerido'}, status=400)
        forbidden = _check_fat_access(request.user.username, no_cia, punto)
        if forbidden:
            return forbidden
        try:
            page = int(request.query_params.get('page', '1'))
            page_size = int(request.query_params.get('page_size', '30'))
        except ValueError:
            page, page_size = 1, 30
        result = fat_repo.list_clientes(no_cia=no_cia,
                                        search=request.query_params.get('search', ''),
                                        page=page, page_size=page_size)
        return Response(result)


# -- Condiciones de Pago ------------------------------------------------------

class FatCondicionesPagoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        items = fat_repo.list_condiciones_pago()
        return Response({'items': items})

    def post(self, request):
        no_condicion_pago = str(request.data.get('no_condicion_pago', '')).strip().upper()
        if not no_condicion_pago:
            return Response({'detail': 'no_condicion_pago requerido'}, status=400)
        if len(no_condicion_pago) > 4:
            return Response({'detail': 'no_condicion_pago no puede exceder 4 caracteres'}, status=400)
        descripcion = request.data.get('descripcion')
        if not descripcion:
            return Response({'detail': 'no_condicion_pago y descripcion son requeridos'}, status=400)
        try:
            res = fat_repo.upsert_condicion_pago(
                no_condicion_pago=no_condicion_pago,
                descripcion=str(descripcion).strip(),
                plazo_pago=int(request.data.get('plazo_pago', 0) or 0),
                porciento=float(request.data.get('porciento', 0) or 0),
                activa=_as_bool(request.data.get('activa'), True))
            return Response(res, status=201)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)

    def patch(self, request):
        return self.post(request)


# -- Companias FAT ------------------------------------------------------------

class FatCompaniasView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            return Response({'items': fat_repo.list_companias_fat()})
        except Exception as e:
            return Response({'detail': str(e)}, status=500)

    def post(self, request):
        no_cia = request.data.get('no_cia')
        descripcion = request.data.get('descripcion')
        if not all([no_cia, descripcion]):
            return Response({'detail': 'no_cia y descripcion son requeridos'}, status=400)
        try:
            res = fat_repo.upsert_compania_fat(
                no_cia=str(no_cia).strip(), descripcion=str(descripcion).strip(),
                direccion=request.data.get('direccion', ''),
                rnc=request.data.get('rnc', ''),
                telefono=request.data.get('telefono', ''),
                fax=request.data.get('fax', ''),
                impuesto=float(request.data.get('impuesto', 18)),
                tasa_us=float(request.data.get('tasa_us', 0)),
                max_descuento=float(request.data.get('max_descuento', 0)),
                activa=_as_bool(request.data.get('activa'), True))
            return Response(res, status=201)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)

    def patch(self, request):
        return self.post(request)


# -- Puntos de Trabajo --------------------------------------------------------

class FatPuntosView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia')
        if not no_cia:
            return Response({'detail': 'no_cia es requerido'}, status=400)
        try:
            return Response({'no_cia': no_cia, 'items': fat_repo.list_puntos_fat(no_cia)})
        except Exception as e:
            return Response({'detail': str(e)}, status=500)

    def post(self, request):
        no_cia = request.data.get('no_cia')
        punto = request.data.get('punto')
        descripcion = request.data.get('descripcion')
        if not all([no_cia, punto, descripcion]):
            return Response({'detail': 'no_cia, punto y descripcion son requeridos'},
                            status=400)
        no_cia_s = str(no_cia).strip()
        punto_s = str(punto).strip().upper()
        descripcion_s = str(descripcion).strip()
        if len(punto_s) > 2:
            return Response({'detail': 'punto no puede exceder 2 caracteres'}, status=400)
        if len(descripcion_s) > 40:
            return Response({'detail': 'descripcion no puede exceder 40 caracteres'},
                            status=400)
        forbidden = _check_fat_access(request.user.username, no_cia_s, punto_s)
        if forbidden:
            return forbidden
        try:
            res = fat_repo.upsert_punto_fat(
                no_cia=no_cia_s,
                punto=punto_s,
                descripcion=descripcion_s,
                max_descuento=request.data.get('max_descuento'),
                activo=_as_bool(request.data.get('activo'), True),
                ano_proceso=int(request.data.get('ano_proceso') or 0),
                mes_proceso=int(request.data.get('mes_proceso') or 0),
                mes_cierre=int(request.data.get('mes_cierre') or 0))
            return Response(res, status=201 if res.get('action') == 'created' else 200)
        except ValueError as e:
            return Response({'detail': str(e)}, status=422)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)

    def patch(self, request):
        return self.post(request)


# -- Tipos de Pago ------------------------------------------------------------

class FatTiposPagoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia')
        punto = request.query_params.get('punto', '01')
        if not no_cia:
            return Response({'detail': 'no_cia es requerido'}, status=400)
        try:
            return Response({'items': fat_repo.list_tipos_pago(no_cia, punto)})
        except Exception as e:
            return Response({'detail': str(e)}, status=500)

    def post(self, request):
        no_cia = request.data.get('no_cia')
        punto = request.data.get('punto', '01')
        tipo_pago = str(request.data.get('tipo_pago', '')).strip().upper()
        if not tipo_pago:
            return Response({'detail': 'tipo_pago requerido'}, status=400)
        if len(tipo_pago) > 4:
            return Response({'detail': 'tipo_pago no puede exceder 4 caracteres'}, status=400)
        descripcion = request.data.get('descripcion')
        if not all([no_cia, descripcion]):
            return Response({'detail': 'no_cia, tipo_pago y descripcion son requeridos'}, status=400)
        forbidden = _check_fat_access(request.user.username, str(no_cia).strip(), str(punto).strip())
        if forbidden:
            return forbidden
        try:
            res = fat_repo.upsert_tipo_pago(
                no_cia=str(no_cia).strip(),
                punto=str(punto).strip(),
                tipo_pago=tipo_pago,
                tipo_pago_fiscal=str(request.data.get('tipo_pago_fiscal', tipo_pago)).strip(),
                descripcion=str(descripcion).strip())
            return Response(res, status=201)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)

    def patch(self, request):
        return self.post(request)


# -- Listas de Precio ---------------------------------------------------------

class FatListasPrecioView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia')
        punto = request.query_params.get('punto', '01')
        no_lista = request.query_params.get('no_lista', '')
        if not no_cia:
            return Response({'detail': 'no_cia es requerido'}, status=400)
        try:
            tipos = fat_repo.list_tipos_lista_precio(no_cia)
            if no_lista:
                detalle = fat_repo.list_lista_precio_detalle(no_cia, punto, no_lista)
                return Response({'tipos': tipos, 'detalle': detalle, 'no_lista': no_lista})
            return Response({'tipos': tipos})
        except Exception as e:
            return Response({'detail': str(e)}, status=500)

    def post(self, request):
        no_cia = request.data.get('no_cia')
        punto = request.data.get('punto', '01')
        if not no_cia:
            return Response({'detail': 'no_cia es requerido'}, status=400)
        forbidden = _check_fat_access(request.user.username, str(no_cia).strip(), str(punto).strip())
        if forbidden:
            return forbidden
        kind = str(request.data.get('kind') or request.data.get('tipo') or '').strip().lower()
        no_produ = request.data.get('no_produ')
        try:
            if kind == 'detalle' or no_produ:
                res = fat_repo.upsert_lista_precio_detalle(
                    no_cia=str(no_cia).strip(),
                    punto=str(punto).strip(),
                    no_lista=str(request.data.get('no_lista', '')).strip(),
                    no_produ=str(no_produ or '').strip(),
                    precio=request.data.get('precio', 0),
                    activo=_as_bool(request.data.get('activo'), True),
                    nota=request.data.get('nota', ''))
            else:
                res = fat_repo.upsert_tipo_lista_precio(
                    no_cia=str(no_cia).strip(),
                    no_lista=str(request.data.get('no_lista', '')).strip(),
                    descripcion=str(request.data.get('descripcion', '')).strip(),
                    activa=_as_bool(request.data.get('activa'), True),
                    tipo_moneda=str(request.data.get('tipo_moneda', 'RD')).strip())
            return Response(res, status=201 if res.get('action') == 'created' else 200)
        except ValueError as e:
            return Response({'detail': str(e)}, status=422)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)

    def patch(self, request):
        return self.post(request)

    def delete(self, request):
        no_cia = request.data.get('no_cia') or request.query_params.get('no_cia')
        punto = request.data.get('punto') or request.query_params.get('punto', '01')
        no_lista = request.data.get('no_lista') or request.query_params.get('no_lista', '')
        no_produ = request.data.get('no_produ') or request.query_params.get('no_produ', '')
        if not no_cia:
            return Response({'detail': 'no_cia es requerido'}, status=400)
        forbidden = _check_fat_access(request.user.username, str(no_cia).strip(), str(punto).strip())
        if forbidden:
            return forbidden
        try:
            if no_produ:
                res = fat_repo.delete_lista_precio_detalle(
                    str(no_cia).strip(), str(punto).strip(), str(no_lista).strip(), str(no_produ).strip())
            else:
                res = fat_repo.delete_tipo_lista_precio(
                    str(no_cia).strip(), str(punto).strip(), str(no_lista).strip())
            return Response(res)
        except ValueError as e:
            return Response({'detail': str(e)}, status=422)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)


# -- Productos ----------------------------------------------------------------

class FatProductosView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia', '')
        punto = request.query_params.get('punto', '01')
        no_lista = request.query_params.get('no_lista', '')
        search = request.query_params.get('search', '')
        try:
            page = int(request.query_params.get('page', '1'))
            page_size = int(request.query_params.get('page_size', '20'))
        except ValueError:
            page, page_size = 1, 20
        almacen = request.query_params.get('almacen', '')
        solo_existencia = request.query_params.get('solo_existencia', '').lower() == 'true'
        try:
            result = fat_repo.search_productos(
                no_cia=no_cia, punto=punto, no_lista=no_lista,
                search=search, page=page, page_size=page_size,
                almacen=almacen, solo_existencia=solo_existencia)
            return Response(result)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)


# -- Empaques por producto (UM alternas) --------------------------------------

class FatProductoEmpaquesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_produ = request.query_params.get('no_produ', '')
        if not no_produ:
            return Response({'items': []})
        try:
            items = fat_repo.list_empaques_producto(no_produ)
            return Response({'items': items})
        except Exception as e:
            return Response({'detail': str(e)}, status=500)


# -- Transportistas -----------------------------------------------------------

class FatTransportistasView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            return Response({'items': fat_repo.list_transportistas()})
        except Exception as e:
            return Response({'detail': str(e)}, status=500)

    def post(self, request):
        codigo = request.data.get('codigo')
        descripcion = request.data.get('descripcion')
        if not all([codigo, descripcion]):
            return Response({'detail': 'codigo y descripcion son requeridos'}, status=400)
        try:
            res = fat_repo.upsert_transportista(
                codigo=int(codigo), descripcion=str(descripcion).strip(),
                direccion=request.data.get('direccion', ''),
                celular=request.data.get('celular', ''),
                status=request.data.get('status', 'A'))
            return Response(res, status=201)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)

    def patch(self, request):
        return self.post(request)


# -- Notas Pie de Factura -----------------------------------------------------

class FatNotasView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            return Response({'items': fat_repo.list_notas_fat()})
        except Exception as e:
            return Response({'detail': str(e)}, status=500)

    def post(self, request):
        codigo = request.data.get('codigo')
        descripcion = request.data.get('descripcion')
        if not all([codigo, descripcion]):
            return Response({'detail': 'codigo y descripcion son requeridos'}, status=400)
        try:
            res = fat_repo.upsert_nota_fat(str(codigo).strip(), str(descripcion).strip())
            return Response(res, status=201)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)

    def patch(self, request):
        return self.post(request)


# -- Conduces -----------------------------------------------------------------

class FatConducesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia')
        punto = request.query_params.get('punto', '01')
        if not no_cia:
            return Response({'detail': 'no_cia es requerido'}, status=400)
        forbidden = _check_fat_access(request.user.username, no_cia, punto)
        if forbidden:
            return forbidden
        try:
            page = int(request.query_params.get('page', '1'))
            page_size = int(request.query_params.get('page_size', '30'))
        except ValueError:
            page, page_size = 1, 30
        try:
            desde = request.query_params.get('desde', '')
            hasta = request.query_params.get('hasta', '')
            if not desde and not hasta:
                ano = request.query_params.get('ano', '')
                mes = request.query_params.get('mes', '')
                if ano and mes:
                    desde, hasta = _ano_mes_to_range(ano, mes)
            result = fat_repo.list_conduces(
                no_cia=no_cia, punto=punto, page=page, page_size=page_size,
                search=request.query_params.get('search', ''),
                tipo=request.query_params.get('tipo', ''),
                estado=request.query_params.get('estado', ''),
                fecha_desde=desde,
                fecha_hasta=hasta)
            return Response(result)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)

    def post(self, request):
        no_cia = request.data.get('no_cia')
        punto = request.data.get('punto', '01')
        tipo_conduce = request.data.get('tipo_conduce', 'CO')
        no_cliente = request.data.get('no_cliente')
        fecha = request.data.get('fecha')
        vendedor = request.data.get('vendedor', '')
        clase = request.data.get('clase', 'C')
        no_lista = request.data.get('no_lista', '')
        lineas = request.data.get('lineas', [])
        if not all([no_cia, no_cliente, fecha]):
            return Response({'detail': 'no_cia, no_cliente y fecha son requeridos'}, status=400)
        if not lineas:
            return Response({'detail': 'Se requiere al menos una linea'}, status=400)
        forbidden = _check_fat_access(request.user.username, str(no_cia).strip(), str(punto).strip())
        if forbidden:
            return forbidden
        try:
            res = fat_repo.create_conduce(
                no_cia=str(no_cia).strip(), punto=str(punto).strip(),
                tipo_conduce=str(tipo_conduce).strip(), no_cliente=int(no_cliente),
                fecha=str(fecha).strip(), vendedor=str(vendedor).strip(),
                clase=str(clase).strip(), no_lista=str(no_lista).strip(),
                lineas=lineas, usuario=request.user.username)
            return Response(res, status=201)
        except ValueError as e:
            return Response({'detail': str(e)}, status=400)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)


# -- Conduce Detail -----------------------------------------------------------

class FatConduceDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, tipo: str, no_conduce: str):
        no_cia = request.query_params.get('no_cia')
        punto = request.query_params.get('punto', '01')
        if not no_cia:
            return Response({'detail': 'no_cia es requerido'}, status=400)
        forbidden = _check_fat_access(request.user.username, no_cia, punto)
        if forbidden:
            return forbidden
        conduce = fat_repo.get_conduce(no_cia, punto, tipo, no_conduce)
        if conduce is None:
            return Response({'detail': 'Conduce no encontrado'}, status=404)
        return Response(conduce)

    def patch(self, request, tipo: str, no_conduce: str):
        """Actualiza un conduce existente (Gap G2 2026-05-30).

        Requiere AUTORIZADO!='S', ST_ANULADO!='S' y NO_FACTURA nulo.
        Body JSON con: no_cia, punto, no_cliente, fecha, vendedor, clase,
        lineas (lista). Opcionales: detalle, forma_pago, no_condicion_pago,
        tipo_moneda.
        """
        no_cia = request.data.get('no_cia') or request.query_params.get('no_cia')
        punto = request.data.get('punto') or request.query_params.get('punto', '01')
        if not no_cia:
            return Response({'detail': 'no_cia es requerido'}, status=400)
        forbidden = _check_fat_access(
            request.user.username, str(no_cia).strip(), str(punto).strip())
        if forbidden:
            return forbidden
        no_cliente = request.data.get('no_cliente')
        fecha = request.data.get('fecha')
        vendedor = request.data.get('vendedor', '')
        clase = request.data.get('clase', 'C')
        lineas = request.data.get('lineas', [])
        if no_cliente is None or not fecha:
            return Response({'detail': 'no_cliente y fecha son requeridos'}, status=400)
        if not lineas:
            return Response({'detail': 'Se requiere al menos una linea'}, status=400)
        try:
            fat_repo.update_conduce(
                no_cia=str(no_cia).strip(), punto=str(punto).strip(),
                tipo_conduce=str(tipo).strip(),
                no_conduce=str(no_conduce).strip(),
                no_cliente=int(no_cliente),
                fecha=str(fecha).strip(),
                vendedor=str(vendedor).strip(),
                clase=str(clase).strip(),
                lineas=lineas,
                usuario=request.user.username,
                detalle=request.data.get('detalle'),
                forma_pago=request.data.get('forma_pago'),
                no_condicion_pago=request.data.get('no_condicion_pago'),
                tipo_moneda=request.data.get('tipo_moneda'))
        except ValueError as e:
            # Regla de editabilidad o validación de input → 422
            return Response({'detail': str(e)}, status=422)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)
        conduce = fat_repo.get_conduce(
            str(no_cia).strip(), str(punto).strip(),
            str(tipo).strip(), str(no_conduce).strip())
        return Response(conduce, status=200)


# -- Cuadre de Caja -----------------------------------------------------------

class FatCuadreCajaView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia')
        punto = request.query_params.get('punto', '01')
        if not no_cia:
            return Response({'detail': 'no_cia es requerido'}, status=400)
        forbidden = _check_fat_access(request.user.username, no_cia, punto)
        if forbidden:
            return forbidden
        try:
            # Support both ano/mes (from frontend) and explicit desde/hasta
            desde = request.query_params.get('desde', '')
            hasta = request.query_params.get('hasta', '')
            if not desde and not hasta:
                ano = request.query_params.get('ano', '')
                mes = request.query_params.get('mes', '')
                if ano and mes:
                    desde, hasta = _ano_mes_to_range(ano, mes)
            tipo_factura = request.query_params.get('tipo', '')
            no_cuadre = request.query_params.get('no_cuadre', '')
            resumen = fat_repo.get_cuadre_caja_detalle(no_cia, punto, tipo_factura, desde, hasta, no_cuadre)
            historial = fat_repo.list_cuadre_caja(no_cia, punto, desde, hasta)
            por_ncf = fat_repo.cuadre_caja_por_ncf(no_cia, punto, desde, hasta, tipo_factura, no_cuadre)
            por_ncf_forma_pago = fat_repo.cuadre_caja_por_ncf_forma_pago(
                no_cia, punto, desde, hasta, tipo_factura, no_cuadre)
            return Response({
                'resumen': resumen, 'historial': historial,
                'por_ncf': por_ncf, 'por_ncf_forma_pago': por_ncf_forma_pago,
            })
        except Exception as e:
            return Response({'detail': str(e)}, status=500)


# -- Reportes -----------------------------------------------------------------

class FatRepVentasView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia')
        punto = request.query_params.get('punto', '01')
        if not no_cia:
            return Response({'detail': 'no_cia es requerido'}, status=400)
        forbidden = _check_fat_access(request.user.username, no_cia, punto)
        if forbidden:
            return forbidden
        try:
            desde = request.query_params.get('desde', '')
            hasta = request.query_params.get('hasta', '')
            if not desde and not hasta:
                ano = request.query_params.get('ano', '')
                mes = request.query_params.get('mes', '')
                if ano and mes:
                    desde, hasta = _ano_mes_to_range(ano, mes)
            rows = fat_repo.rep_ventas_producto(
                no_cia=no_cia, punto=punto,
                desde=desde, hasta=hasta,
                vendedor=request.query_params.get('vendedor', ''),
                almacen=request.query_params.get('almacen', ''))
            total_neto = sum(r['monto_neto'] for r in rows)
            total_itbis = sum(r['impuesto'] for r in rows)
            return Response({'items': rows, 'total_neto': total_neto, 'total_itbis': total_itbis,
                             'count': len(rows)})
        except Exception as e:
            return Response({'detail': str(e)}, status=500)


class FatRep607View(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia')
        punto = request.query_params.get('punto', '01')
        if not no_cia:
            return Response({'detail': 'no_cia es requerido'}, status=400)
        forbidden = _check_fat_access(request.user.username, no_cia, punto)
        if forbidden:
            return forbidden
        try:
            desde = request.query_params.get('desde', '')
            hasta = request.query_params.get('hasta', '')
            if not desde and not hasta:
                ano = request.query_params.get('ano', '')
                mes = request.query_params.get('mes', '')
                if ano and mes:
                    desde, hasta = _ano_mes_to_range(ano, mes)
            rows = fat_repo.rep_ncf_607(no_cia=no_cia, desde=desde, hasta=hasta)
            total_neto = sum(r['total_neto'] for r in rows)
            total_itbis = sum(r['impuesto'] for r in rows)
            return Response({'items': rows, 'total_neto': total_neto,
                             'total_itbis': total_itbis, 'count': len(rows)})
        except Exception as e:
            return Response({'detail': str(e)}, status=500)


class FatRepNcfNulosView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia')
        punto = request.query_params.get('punto', '01')
        if not no_cia:
            return Response({'detail': 'no_cia es requerido'}, status=400)
        forbidden = _check_fat_access(request.user.username, no_cia, punto)
        if forbidden:
            return forbidden
        try:
            desde = request.query_params.get('desde', '')
            hasta = request.query_params.get('hasta', '')
            if not desde and not hasta:
                ano = request.query_params.get('ano', '')
                mes = request.query_params.get('mes', '')
                if ano and mes:
                    desde, hasta = _ano_mes_to_range(ano, mes)
            rows = fat_repo.rep_ncf_nulos(no_cia=no_cia, desde=desde, hasta=hasta)
            return Response({'items': rows, 'count': len(rows)})
        except Exception as e:
            return Response({'detail': str(e)}, status=500)


class FatRepFacturasRncView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia')
        punto = request.query_params.get('punto', '01')
        if not no_cia:
            return Response({'detail': 'no_cia es requerido'}, status=400)
        forbidden = _check_fat_access(request.user.username, no_cia, punto)
        if forbidden:
            return forbidden
        try:
            rows = fat_repo.rep_facturas_rnc(
                no_cia=no_cia, punto=punto,
                desde=request.query_params.get('desde', ''),
                hasta=request.query_params.get('hasta', ''),
                tipo_docu=request.query_params.get('tipo_docu', 'T'),
                rnc=request.query_params.get('rnc', ''),
                no_cliente=request.query_params.get('no_cliente', ''))
            return Response({'items': rows,
                             'total_neto': sum(r['total_neto'] for r in rows),
                             'count': len(rows)})
        except ValueError:
            return Response({'detail': 'no_cliente debe ser numerico'}, status=400)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)


class FatRepMargenBrutoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia')
        punto = request.query_params.get('punto', '01')
        if not no_cia:
            return Response({'detail': 'no_cia es requerido'}, status=400)
        forbidden = _check_fat_access(request.user.username, no_cia, punto)
        if forbidden:
            return forbidden
        try:
            rows = fat_repo.rep_margen_bruto(
                no_cia=no_cia, punto=punto,
                desde=request.query_params.get('desde', ''),
                hasta=request.query_params.get('hasta', ''),
                tipo_docu=request.query_params.get('tipo_docu', 'T'),
                agrupar=request.query_params.get('agrupar', 'producto'),
                vendedor=request.query_params.get('vendedor', ''),
                almacen=request.query_params.get('almacen', ''),
                no_cliente=request.query_params.get('no_cliente', ''),
                no_produ=request.query_params.get('no_produ', ''),
                tipo_transaccion=request.query_params.get('tipo_transaccion', ''))
            venta = sum(r['venta'] for r in rows)
            costo = sum(r['costo'] for r in rows)
            beneficio = sum(r['beneficio'] for r in rows)
            margen_pct = round((beneficio / venta) * 100, 2) if venta else 0
            return Response({
                'items': rows,
                'total_venta': venta,
                'total_costo': costo,
                'total_beneficio': beneficio,
                'margen_pct': margen_pct,
                'count': len(rows),
            })
        except ValueError:
            return Response({'detail': 'no_cliente debe ser numerico'}, status=400)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)



# -- Rep Ventas Vendedor -------------------------------------------------------

class FatRepVentasVendedorView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia')
        punto = request.query_params.get('punto', '01')
        if not no_cia:
            return Response({'detail': 'no_cia es requerido'}, status=400)
        try:
            rows = fat_repo.rep_ventas_vendedor(
                no_cia=no_cia, punto=punto,
                desde=request.query_params.get('desde', ''),
                hasta=request.query_params.get('hasta', ''))
            return Response({'items': rows,
                             'total_neto': sum(r['total_neto'] for r in rows),
                             'total_itbis': sum(r['total_itbis'] for r in rows),
                             'count': len(rows)})
        except Exception as e:
            return Response({'detail': str(e)}, status=500)


# -- Rep Ventas Cliente --------------------------------------------------------

class FatRepVentasClienteView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia')
        punto = request.query_params.get('punto', '01')
        if not no_cia:
            return Response({'detail': 'no_cia es requerido'}, status=400)
        try:
            rows = fat_repo.rep_ventas_cliente(
                no_cia=no_cia, punto=punto,
                desde=request.query_params.get('desde', ''),
                hasta=request.query_params.get('hasta', ''),
                top=int(request.query_params.get('top', 50)))
            return Response({'items': rows,
                             'total_neto': sum(r['total_neto'] for r in rows),
                             'total_itbis': sum(r['total_itbis'] for r in rows),
                             'count': len(rows)})
        except Exception as e:
            return Response({'detail': str(e)}, status=500)


# -- Rep Analitica Mensual -----------------------------------------------------

class FatRepAnaliticaView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia')
        punto = request.query_params.get('punto', '01')
        if not no_cia:
            return Response({'detail': 'no_cia es requerido'}, status=400)
        try:
            ano = int(request.query_params.get('ano', 2026))
        except ValueError:
            return Response({'detail': 'ano debe ser un entero'}, status=400)
        try:
            return Response(fat_repo.rep_analitica_mensual(no_cia, punto, ano))
        except Exception as e:
            return Response({'detail': str(e)}, status=500)

# -- Cierres ------------------------------------------------------------------

class FatCierresView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia')
        punto = request.query_params.get('punto', '01')
        if not no_cia:
            return Response({'detail': 'no_cia es requerido'}, status=400)
        forbidden = _check_fat_access(request.user.username, no_cia, punto)
        if forbidden:
            return forbidden
        try:
            return Response({'items': fat_repo.list_cierres(no_cia, punto)})
        except Exception as e:
            return Response({'detail': str(e)}, status=500)

    def post(self, request):
        no_cia = request.data.get('no_cia')
        punto = request.data.get('punto', '01')
        ano = request.data.get('ano')
        mes = request.data.get('mes')
        if not all([no_cia, ano, mes]):
            return Response({'detail': 'no_cia, ano y mes son requeridos'}, status=400)
        forbidden = _check_fat_access(request.user.username, str(no_cia).strip(), str(punto).strip())
        if forbidden:
            return forbidden
        try:
            res = fat_repo.cierre_mensual(no_cia, punto, int(ano), int(mes),
                                          request.user.username)
            return Response(res, status=201)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)


class FatGenerarAsientosView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia')
        punto = request.query_params.get('punto', '01')
        if not no_cia:
            return Response({'detail': 'no_cia es requerido'}, status=400)
        forbidden = _check_fat_access(request.user.username, no_cia, punto)
        if forbidden:
            return forbidden
        try:
            mes = int(request.query_params.get('mes', 1))
            ano = int(request.query_params.get('ano', 2026))
            pendientes = fat_repo.list_facturas_pendientes_cnt(no_cia, punto, mes, ano)
            return Response({'items': pendientes, 'count': len(pendientes)})
        except Exception as e:
            return Response({'detail': str(e)}, status=500)

    def post(self, request):
        no_cia = request.data.get('no_cia')
        punto = request.data.get('punto', '01')
        if not no_cia:
            return Response({'detail': 'no_cia es requerido'}, status=400)
        forbidden = _check_fat_access(request.user.username, str(no_cia).strip(), str(punto).strip())
        if forbidden:
            return forbidden
        try:
            mes = int(request.data.get('mes', 1))
            ano = int(request.data.get('ano', 2026))
            result = fat_repo.marcar_generado_cnt(no_cia, punto, mes, ano)
            return Response(result, status=201)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)


class FatProximoNcfView(APIView):
    """Devuelve el próximo NCF disponible para una empresa + código NCF."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia', '01')
        codigo_ncf = request.query_params.get('codigo_ncf', '')
        if not codigo_ncf:
            return Response({'detail': 'codigo_ncf es requerido'}, status=400)
        forbidden = _check_fat_access(request.user.username, no_cia, '01')
        if forbidden:
            return forbidden
        try:
            data = fat_repo.get_proximo_ncf(no_cia, codigo_ncf)
            if not data:
                return Response({'detail': 'Serie NCF no encontrada'}, status=404)
            return Response(data)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)


class FatNcfUsadoView(APIView):
    """Comprueba si un número NCF (entero) ya fue usado en una empresa."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia', '01')
        ncf_raw = request.query_params.get('ncf', '')
        codigo_ncf = request.query_params.get('codigo_ncf', '')
        if not ncf_raw:
            return Response({'detail': 'ncf es requerido'}, status=400)
        forbidden = _check_fat_access(request.user.username, no_cia, '01')
        if forbidden:
            return forbidden
        try:
            ncf_num = int(ncf_raw)
        except ValueError:
            return Response({'detail': 'ncf debe ser un entero'}, status=400)
        try:
            usado = fat_repo.ncf_ya_usado(no_cia, ncf_num, codigo_ncf)
            return Response({'usado': usado})
        except Exception as e:
            return Response({'detail': str(e)}, status=500)


class FatProximoNoFacturaView(APIView):
    """Devuelve el próximo no_factura para una serie tipo_docu en la empresa/punto."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia', '01')
        punto = request.query_params.get('punto', '01')
        tipo_docu = request.query_params.get('tipo_docu', '')
        if not tipo_docu:
            return Response({'detail': 'tipo_docu es requerido'}, status=400)
        forbidden = _check_fat_access(request.user.username, no_cia, punto)
        if forbidden:
            return forbidden
        prox = fat_repo.get_proximo_no_factura(no_cia, punto, tipo_docu)
        return Response({'tipo_docu': tipo_docu.upper(), 'prox_no_factura': prox})


class DashboardVentasMesView(APIView):
    """Ventas día a día del mes en curso para el chart del dashboard."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from datetime import date
        no_cia = request.query_params.get('no_cia', '01')
        forbidden = _check_fat_access(request.user.username, no_cia, '01')
        if forbidden:
            return forbidden
        try:
            today = date.today()
            items = fat_repo.ventas_dia_a_dia(no_cia, today.year, today.month)
            return Response({'items': items, 'ano': today.year, 'mes': today.month})
        except Exception as e:
            return Response({'detail': str(e)}, status=500)


class FatSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        no_cia = request.query_params.get('no_cia')
        punto = request.query_params.get('punto', '01')
        search = request.query_params.get('search', '')
        try:
            page = int(request.query_params.get('page', '1'))
            page_size = int(request.query_params.get('page_size', '25'))
        except ValueError:
            return Response({'detail': 'page y page_size deben ser enteros'}, status=400)
        if not no_cia:
            return Response({'detail': 'no_cia es requerido'}, status=400)
        forbidden = _check_fat_access(request.user.username, no_cia, punto)
        if forbidden:
            return forbidden
        try:
            result = fat_repo.search_invoices(no_cia, punto, page, page_size, search)
            return Response(result)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)
