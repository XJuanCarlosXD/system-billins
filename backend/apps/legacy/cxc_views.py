"""CXC (Cuentas por Cobrar) — Django REST views."""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from apps.legacy.repositories import cxc_repo as repo


def _auth(view_class):
    return method_decorator(login_required, name='dispatch')(view_class)


# ─── COMPAÑÍAS ────────────────────────────────────────────────────────────────

@_auth
class CxcCiasView(APIView):
    def get(self, request):
        return Response(repo.list_cias())

    def post(self, request):
        try:
            repo.save_cia(request.data)
            return Response({"ok": True})
        except Exception as e:
            return Response({"error": str(e)}, status=400)


# ─── SUCURSALES ───────────────────────────────────────────────────────────────

@_auth
class CxcPuntosView(APIView):
    def get(self, request):
        no_cia = request.query_params.get("no_cia", "01")
        return Response(repo.list_puntos(no_cia))

    def post(self, request):
        try:
            repo.save_punto(request.data)
            return Response({"ok": True})
        except Exception as e:
            return Response({"error": str(e)}, status=400)


@_auth
class CxcPuntoDetailView(APIView):
    def get(self, request, no_cia, punto):
        r = repo.get_punto(no_cia, punto)
        if not r:
            return Response({"error": "Not found"}, status=404)
        return Response(r)


# ─── TIPO DOCUMENTO ───────────────────────────────────────────────────────────

@_auth
class CxcTdocuView(APIView):
    def get(self, request):
        no_cia = request.query_params.get("no_cia", "01")
        return Response(repo.list_tdocu(no_cia))

    def post(self, request):
        try:
            repo.save_tdocu(request.data)
            return Response({"ok": True})
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    def delete(self, request):
        try:
            repo.delete_tdocu(request.data["no_cia"], request.data["tipo_doc"])
            return Response({"ok": True})
        except Exception as e:
            return Response({"error": str(e)}, status=400)


# ─── TIPO CLIENTES ────────────────────────────────────────────────────────────

@_auth
class CxcTcliView(APIView):
    def get(self, request):
        no_cia = request.query_params.get("no_cia", "01")
        return Response(repo.list_tcli(no_cia))

    def post(self, request):
        try:
            repo.save_tcli(request.data)
            return Response({"ok": True})
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    def delete(self, request):
        try:
            repo.delete_tcli(request.data["no_cia"], request.data["tipo_cli"])
            return Response({"ok": True})
        except Exception as e:
            return Response({"error": str(e)}, status=400)


# ─── SUPERVISORES ─────────────────────────────────────────────────────────────

@_auth
class CxcSupervisoresView(APIView):
    def get(self, request):
        no_cia = request.query_params.get("no_cia", "01")
        return Response(repo.list_supervisores(no_cia))

    def post(self, request):
        try:
            repo.save_supervisor(request.data)
            return Response({"ok": True})
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    def delete(self, request):
        try:
            repo.delete_supervisor(request.data["no_cia"], request.data["supervisor"])
            return Response({"ok": True})
        except Exception as e:
            return Response({"error": str(e)}, status=400)


# ─── VENDEDORES ───────────────────────────────────────────────────────────────

@_auth
class CxcVendedoresView(APIView):
    def get(self, request):
        no_cia = request.query_params.get("no_cia", "01")
        return Response(repo.list_vendedores(no_cia))

    def post(self, request):
        try:
            repo.save_vendedor(request.data)
            return Response({"ok": True})
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    def delete(self, request):
        try:
            repo.delete_vendedor(request.data["no_cia"], request.data["vendedor"])
            return Response({"ok": True})
        except Exception as e:
            return Response({"error": str(e)}, status=400)


# ─── RUTAS ────────────────────────────────────────────────────────────────────

@_auth
class CxcRutasView(APIView):
    def get(self, request):
        no_cia = request.query_params.get("no_cia", "01")
        return Response(repo.list_rutas(no_cia))

    def post(self, request):
        try:
            repo.save_ruta(request.data)
            return Response({"ok": True})
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    def delete(self, request):
        try:
            repo.delete_ruta(request.data["no_cia"], request.data["ruta"])
            return Response({"ok": True})
        except Exception as e:
            return Response({"error": str(e)}, status=400)


# ─── TIPO CONTABLE ────────────────────────────────────────────────────────────

@_auth
class CxcTcontableView(APIView):
    def get(self, request):
        no_cia = request.query_params.get("no_cia", "01")
        return Response(repo.list_tcontable(no_cia))

    def post(self, request):
        try:
            repo.save_tcontable(request.data)
            return Response({"ok": True})
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    def delete(self, request):
        try:
            repo.delete_tcontable(request.data["no_cia"], request.data["tipo_conta"])
            return Response({"ok": True})
        except Exception as e:
            return Response({"error": str(e)}, status=400)


# ─── CIUDADES ─────────────────────────────────────────────────────────────────

@_auth
class CxcCiudadesView(APIView):
    def get(self, request):
        no_cia = request.query_params.get("no_cia", "01")
        return Response(repo.list_ciudades(no_cia))

    def post(self, request):
        try:
            repo.save_ciudad(request.data)
            return Response({"ok": True})
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    def delete(self, request):
        try:
            repo.delete_ciudad(request.data["no_cia"], request.data["ciudad"])
            return Response({"ok": True})
        except Exception as e:
            return Response({"error": str(e)}, status=400)


# ─── BARRIOS ──────────────────────────────────────────────────────────────────

@_auth
class CxcBarriosView(APIView):
    def get(self, request):
        no_cia = request.query_params.get("no_cia", "01")
        return Response(repo.list_barrios(no_cia))

    def post(self, request):
        try:
            repo.save_barrio(request.data)
            return Response({"ok": True})
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    def delete(self, request):
        try:
            repo.delete_barrio(request.data["no_cia"], request.data["barrio"])
            return Response({"ok": True})
        except Exception as e:
            return Response({"error": str(e)}, status=400)


# ─── ZONAS ────────────────────────────────────────────────────────────────────

@_auth
class CxcZonasView(APIView):
    def get(self, request):
        no_cia = request.query_params.get("no_cia", "01")
        return Response(repo.list_zonas(no_cia))

    def post(self, request):
        try:
            repo.save_zona(request.data)
            return Response({"ok": True})
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    def delete(self, request):
        try:
            repo.delete_zona(request.data["no_cia"], request.data["zona"])
            return Response({"ok": True})
        except Exception as e:
            return Response({"error": str(e)}, status=400)


# ─── CADENAS ──────────────────────────────────────────────────────────────────

@_auth
class CxcCadenasView(APIView):
    def get(self, request):
        no_cia = request.query_params.get("no_cia", "01")
        return Response(repo.list_cadenas(no_cia))

    def post(self, request):
        try:
            repo.save_cadena(request.data)
            return Response({"ok": True})
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    def delete(self, request):
        try:
            repo.delete_cadena(request.data["no_cia"], request.data["cadena"])
            return Response({"ok": True})
        except Exception as e:
            return Response({"error": str(e)}, status=400)


# ─── CLIENTES ─────────────────────────────────────────────────────────────────

@_auth
class CxcClientesView(APIView):
    def get(self, request):
        no_cia = request.query_params.get("no_cia", "01")
        q = request.query_params.get("q", "")
        page = int(request.query_params.get("page", 1))
        return Response(repo.search_clientes(no_cia, q, page))

    def post(self, request):
        try:
            no_cliente = repo.save_cliente(request.data)
            return Response({"ok": True, "no_cliente": no_cliente})
        except Exception as e:
            return Response({"error": str(e)}, status=400)


@_auth
class CxcClienteDetailView(APIView):
    def get(self, request, no_cia, no_cliente):
        r = repo.get_cliente(no_cia, no_cliente)
        if not r:
            return Response({"error": "Not found"}, status=404)
        return Response(r)

    def delete(self, request, no_cia, no_cliente):
        try:
            repo.delete_cliente(no_cia, no_cliente)
            return Response({"ok": True})
        except Exception as e:
            return Response({"error": str(e)}, status=400)


# ─── ASIGNACIÓN CLIENTE RUTA ──────────────────────────────────────────────────

@_auth
class CxcClientesRutaView(APIView):
    def get(self, request):
        no_cia = request.query_params.get("no_cia", "01")
        ruta = request.query_params.get("ruta", "")
        return Response(repo.get_clientes_ruta(no_cia, ruta))

    def post(self, request):
        try:
            repo.assign_cliente_ruta(
                request.data["no_cia"],
                request.data["no_cliente"],
                request.data["ruta"]
            )
            return Response({"ok": True})
        except Exception as e:
            return Response({"error": str(e)}, status=400)


# ─── DOCUMENTOS ───────────────────────────────────────────────────────────────

@_auth
class CxcDocumentosView(APIView):
    def get(self, request):
        params = {
            "no_cia": request.query_params.get("no_cia", "01"),
            "punto": request.query_params.get("punto"),
            "tipo_doc": request.query_params.get("tipo_doc"),
            "no_cliente": request.query_params.get("no_cliente"),
            "desde": request.query_params.get("desde"),
            "hasta": request.query_params.get("hasta"),
            "estado": request.query_params.get("estado"),
            "page": int(request.query_params.get("page", 1)),
        }
        return Response(repo.list_documentos(**params))

    def post(self, request):
        try:
            no_doc = repo.save_documento(request.data)
            return Response({"ok": True, "no_doc": no_doc})
        except Exception as e:
            return Response({"error": str(e)}, status=400)


@_auth
class CxcDocumentoDetailView(APIView):
    def get(self, request, no_cia, no_doc):
        r = repo.get_documento(no_cia, no_doc)
        if not r:
            return Response({"error": "Not found"}, status=404)
        return Response(r)


@_auth
class CxcNextDocView(APIView):
    def get(self, request):
        no_cia = request.query_params.get("no_cia", "01")
        punto = request.query_params.get("punto", "01")
        return Response({"no_doc": repo.get_next_no_doc(no_cia, punto)})


# ─── REVERSAR ─────────────────────────────────────────────────────────────────

@_auth
class CxcReversarView(APIView):
    def post(self, request):
        try:
            no_doc_rev = repo.reversar_documento(
                request.data["no_cia"],
                request.data["no_doc"],
                request.data["tipo_doc_rev"],
                request.data["fecha_trans"],
                request.data.get("liberar_ncf", False),
                request.user.username
            )
            return Response({"ok": True, "no_doc_rev": no_doc_rev})
        except Exception as e:
            return Response({"error": str(e)}, status=400)


# ─── PAGOS MASIVOS ────────────────────────────────────────────────────────────

@_auth
class CxcPagosMasivosView(APIView):
    def get(self, request):
        no_cia = request.query_params.get("no_cia", "01")
        desde = request.query_params.get("desde")
        hasta = request.query_params.get("hasta")
        return Response(repo.get_documentos_pendientes_masivo(no_cia, desde, hasta))

    def post(self, request):
        try:
            repo.apply_pagos_masivos(
                request.data["no_cia"],
                request.data["punto"],
                request.data["tipo_doc"],
                request.data["fecha"],
                request.data["pagos"]
            )
            return Response({"ok": True})
        except Exception as e:
            return Response({"error": str(e)}, status=400)


# ─── LIBERAR CRÉDITO ──────────────────────────────────────────────────────────

@_auth
class CxcLiberarCreditoView(APIView):
    def get(self, request):
        no_cia = request.query_params.get("no_cia", "01")
        no_cliente = request.query_params.get("no_cliente")
        no_doc_cr = request.query_params.get("no_doc_cr")
        return Response(repo.get_debitos_cliente(no_cia, no_cliente, no_doc_cr))

    def post(self, request):
        try:
            repo.liberar_credito(
                request.data["no_cia"],
                request.data["no_doc_cr"],
                request.data["aplicaciones"]
            )
            return Response({"ok": True})
        except Exception as e:
            return Response({"error": str(e)}, status=400)


# ─── CORREGIR NCF ─────────────────────────────────────────────────────────────

@_auth
class CxcCorregirNcfView(APIView):
    def post(self, request):
        try:
            repo.corregir_ncf(
                request.data["no_cia"],
                request.data["no_doc"],
                request.data["ncf"],
                request.data.get("ncf_anterior", "")
            )
            return Response({"ok": True})
        except Exception as e:
            return Response({"error": str(e)}, status=400)


# ─── CONSULTAS ────────────────────────────────────────────────────────────────

@_auth
class CxcEstadoCuentaView(APIView):
    def get(self, request):
        no_cia = request.query_params.get("no_cia", "01")
        no_cliente = request.query_params.get("no_cliente")
        if not no_cliente:
            return Response({"error": "no_cliente required"}, status=400)
        return Response(repo.estado_cuenta(no_cia, no_cliente))


@_auth
class CxcBalanceClientesView(APIView):
    def get(self, request):
        no_cia = request.query_params.get("no_cia", "01")
        punto = request.query_params.get("punto")
        return Response(repo.balance_clientes(no_cia, punto))


@_auth
class CxcHistoricoView(APIView):
    def get(self, request):
        no_cia = request.query_params.get("no_cia", "01")
        no_cliente = request.query_params.get("no_cliente")
        desde = request.query_params.get("desde")
        hasta = request.query_params.get("hasta")
        return Response(repo.historico_pagos(no_cia, no_cliente, desde, hasta))


@_auth
class CxcLibroVentasView(APIView):
    def get(self, request):
        no_cia = request.query_params.get("no_cia", "01")
        desde = request.query_params.get("desde")
        hasta = request.query_params.get("hasta")
        punto = request.query_params.get("punto")
        if not desde or not hasta:
            return Response({"error": "desde/hasta required"}, status=400)
        return Response(repo.libro_ventas(no_cia, desde, hasta, punto))


# ─── REPORTES ─────────────────────────────────────────────────────────────────

@_auth
class CxcRepEnvejecimientoView(APIView):
    def get(self, request):
        return Response(repo.rep_envejecimiento(
            request.query_params.get("no_cia", "01"),
            request.query_params.get("punto"),
            request.query_params.get("vendedor"),
            request.query_params.get("fecha_corte"),
        ))


@_auth
class CxcRepCobrosVendedorView(APIView):
    def get(self, request):
        return Response(repo.rep_cobros_vendedor(
            request.query_params.get("no_cia", "01"),
            request.query_params.get("desde"),
            request.query_params.get("hasta"),
            request.query_params.get("punto"),
        ))


@_auth
class CxcRepComisionesView(APIView):
    def get(self, request):
        return Response(repo.rep_comisiones(
            request.query_params.get("no_cia", "01"),
            request.query_params.get("desde"),
            request.query_params.get("hasta"),
            request.query_params.get("punto"),
        ))


@_auth
class CxcRepNcfView(APIView):
    def get(self, request):
        return Response(repo.rep_ncf_emitidos(
            request.query_params.get("no_cia", "01"),
            request.query_params.get("desde"),
            request.query_params.get("hasta"),
            request.query_params.get("punto"),
        ))


# ─── CIERRE ───────────────────────────────────────────────────────────────────

@_auth
class CxcAsientoContableView(APIView):
    def get(self, request):
        return Response(repo.get_asiento_contable(
            request.query_params.get("no_cia", "01"),
            request.query_params.get("punto", "01"),
            int(request.query_params.get("mes", 1)),
            int(request.query_params.get("ano", 2025)),
        ))


@_auth
class CxcGenerarAsientoView(APIView):
    def post(self, request):
        try:
            repo.generar_asiento_mayor(
                request.data["no_cia"],
                request.data["punto"],
                int(request.data["mes_proceso"]),
                int(request.data["ano_proceso"]),
                request.data.get("cierre_fiscal", False)
            )
            return Response({"ok": True})
        except Exception as e:
            return Response({"error": str(e)}, status=400)


@_auth
class CxcCierreView(APIView):
    def post(self, request):
        try:
            result = repo.cierre_cxc(request.data["no_cia"], request.data["punto"])
            return Response({"ok": True, **result})
        except Exception as e:
            return Response({"error": str(e)}, status=400)
