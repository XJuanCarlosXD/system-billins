"""print-data endpoints para documentos transaccionales de TODOS los módulos.

Devuelven el shape estandarizado `{cia, doc, cliente|proveedor, lineas, totales}`
que consume el sistema /print del frontend (plantillas Puck editables en
/settings/pdf-templates/<codigo>).

Endpoints:
  GET /api/cxc/documentos/<no_docu>/print-data/         → recibo-cobro / nota-cobro
  GET /api/cxp/documentos/<tipo>/<no_docu>/print-data/  → comprobante-pago
  GET /api/odc/ordenes/<no_orden>/print-data/           → orden-compra
  GET /api/chc/cheques/<tipo>/<no_docu>/print-data/     → cheque-caja-chica
  GET /api/acc/documentos/<no_docu>/print-data/         → acc-documento
"""
from __future__ import annotations

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from apps.legacy import client
from apps.legacy.repositories import (
    cxc_repo, cxp_repo, odc_repo, chc_repo, acc_repo,
    cnt_repo, acf_repo, sdn_repo,
)
from apps.fat.views_print_data import _cia_payload, _money


def _money_or_zero(v):
    return _money(v)


# ─── CXC ─────────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["GET"])
def cxc_documento_print_data(request, no_docu: str):
    """Print-data UNIFICADO para todos los tipos CXC.

    Sirve para RI/NC/ND/CD/AC/AD/DV/BC/BI/FC/AF. El frontend usa una sola plantilla
    'cxc-documento' y los textos/colores cambian con doc.tipo_movi y doc.tipo_label.
    """
    from apps.fat.views_print_data import _numero_a_letras as _nl
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    cia = _cia_payload(no_cia, request=request)
    doc_full = cxc_repo.get_documento(no_cia, no_docu)
    if not doc_full:
        return JsonResponse({'error': 'Documento CXC no encontrado'}, status=404)
    tipo_s = (doc_full.get('tipo_doc') or '').strip().upper()

    # Resolver tipo_label + tipo_movi desde TCXC_TDOCU (FCXC104, configuración real)
    tipo_label = ''
    tipo_movi = ''
    try:
        tdocs = cxc_repo.list_tdocu(no_cia)
        td = next((t for t in tdocs if (t.get('tipo_doc') or '').strip().upper() == tipo_s), None)
        if td:
            tipo_label = (td.get('descripcion') or '').strip().upper()
            tipo_movi = (td.get('tipo_movimiento') or '').strip().upper()
    except Exception:
        pass

    # Fallbacks legacy
    if not tipo_label:
        tipo_label = {
            'RI': 'RECIBO DE INGRESO', 'NC': 'NOTA DE CREDITO', 'ND': 'NOTA DE DEBITO',
            'CD': 'CHEQUE DEVUELTO', 'AC': 'AJUSTE CREDITO', 'AD': 'AJUSTE DEBITO',
            'AF': 'ANULACION FACTURA', 'BC': 'BALANCE CREDITO', 'BI': 'BALANCE INICIAL',
            'DV': 'DEVOLUCION', 'FC': 'FACTURA CREDITO',
        }.get(tipo_s, f'DOCUMENTO {tipo_s}')

    # Distribución contable (TCXC_DCDOCU) — las cuentas reales con sus nombres
    dist = doc_full.get('lineas') or []
    dist_contable = []
    try:
        cuentas_cat = {}  # cache de catálogo
        from apps.legacy.repositories import cnt_repo
        cat_rows = cnt_repo.list_catalogo() if hasattr(cnt_repo, 'list_catalogo') else []
        for c in cat_rows or []:
            cuentas_cat[str(c.get('cuenta') or '').strip()] = (
                c.get('nombre') or c.get('descripcion') or ''
            )
    except Exception:
        cuentas_cat = {}
    for l in dist:
        cu = str(l.get('cuenta') or '').strip()
        nombre = cuentas_cat.get(cu, '')
        # fallback: nombres comunes legacy
        if not nombre:
            nombre = {
                '1101-01': 'CAJA GENERAL EN RD$',
                '1103-01': 'CUENTAS POR COBRAR - CLIENTES',
                '1103-03': 'CUENTAS POR COBRAR CHEQUES DEVUELTOS',
                '8101-02': 'TRANSFERENCIA',
                '2106-02': 'IMPUESTO S/TRANSF. DE BIENES IND',
            }.get(cu, '')
        dist_contable.append({
            'cuenta': cu,
            'descripcion': nombre,
            'centro_costo': l.get('centro_costo', ''),
            'debito': _money_or_zero(l.get('debito')),
            'credito': _money_or_zero(l.get('credito')),
        })

    # Documentos afectados (TCXC_REFEDOCU) — las facturas referenciadas
    documentos_afectados = []
    try:
        refes = client.fetch_dicts(
            "SELECT r.tipo_refe, r.no_refe, r.monto, d.fecha, d.saldo, "
            "       d.posiciones_fijas_ncf, d.ncf "
            "  FROM CXC.TCXC_REFEDOCU r "
            "  LEFT JOIN CXC.TCXC_DOCUMENTO d "
            "    ON d.no_cia=r.no_cia AND d.punto=r.punto "
            "   AND d.tipo_docu=r.tipo_refe AND d.no_docu=r.no_refe "
            " WHERE r.no_cia=:1 AND r.no_docu=:2 "
            " ORDER BY r.tipo_refe, r.no_refe",
            [no_cia, no_docu])
        for r in refes:
            posiciones = (r.get('posiciones_fijas_ncf') or '').strip()
            ncf_n = r.get('ncf')
            ncf_dgi = ''
            if posiciones and ncf_n:
                try:
                    ncf_dgi = f"{posiciones}{int(ncf_n):08d}"
                except (TypeError, ValueError):
                    ncf_dgi = str(ncf_n)
            documentos_afectados.append({
                'tipo_doc': (r.get('tipo_refe') or '').strip(),
                'no_doc': str(r.get('no_refe') or '').strip(),
                'numero_display': f"{(r.get('tipo_refe') or '').strip()}-{str(r.get('no_refe') or '').strip()}",
                'fecha': str(r.get('fecha') or '')[:10] if r.get('fecha') else '',
                'saldo': _money_or_zero(r.get('saldo')),
                'itbis_retenido': 0,
                'isr_retenido': 0,
                'valor_aplicado': _money_or_zero(r.get('monto')),
                'ncf_dgi': ncf_dgi,
            })
    except Exception:
        pass

    total = _money_or_zero(doc_full.get('valor'))
    try:
        monto_letras = _nl(total)
    except Exception:
        monto_letras = ''

    doc = {
        'tipo': tipo_s,
        'tipo_label': tipo_label,
        'tipo_movi': tipo_movi or 'C',
        'tipo_movi_label': 'Crédito' if tipo_movi == 'C' else 'Débito',
        'acreditado_debitado': 'Acreditado' if tipo_movi == 'C' else 'Debitado',
        'no': doc_full.get('no_doc'),
        'numero_display': f"{tipo_s}-{(doc_full.get('no_doc') or '').strip()}",
        'fecha': str(doc_full.get('fecha') or '')[:10],
        'ncf': doc_full.get('ncf'),
        'ncf_dgi': (doc_full.get('ncf') or '').strip() if isinstance(doc_full.get('ncf'), str) else str(doc_full.get('ncf') or ''),
        'tipo_ncf': '', 'tipo_ncf_label': '',
        'estado': doc_full.get('estado') or '',
        'anulada': (doc_full.get('estado') or 'A') == 'R',
        'impresion': 'IMPRESA',
        'detalle': doc_full.get('detalle') or '',
        'nota': doc_full.get('detalle') or '',
        'condicion_pago': '', 'forma_pago': '', 'plazo_pago': 0,
        'vendedor': doc_full.get('vendedor') or '',
        'cobrador': doc_full.get('cobrador') or '',
        'moneda': 'DOP', 'tasa': 0, 'porc_impuesto': 0,
        'hecho_por': doc_full.get('usuario') or doc_full.get('hecho_por') or '',
    }
    cliente = {
        'no': doc_full.get('no_cliente'),
        'nombre': (doc_full.get('nombre_cliente') or '').strip() or '(sin nombre)',
        'rnc': (doc_full.get('rnc') or '').strip(),
        'direccion': doc_full.get('direccion') or '',
        'telefono': doc_full.get('telefono') or '',
        'email': '', 'tipo_ncf': '',
    }
    return JsonResponse({
        'cia': cia, 'doc': doc, 'cliente': cliente,
        'lineas': [],  # CXC no usa la tabla de lineas FAT — usa dist_contable
        'totales': {
            'subtotal': total, 'descuento': 0, 'itbis': 0,
            'propina': 0, 'otros': 0, 'total': total,
            'monto_letras': monto_letras,
        },
        'extra': {
            'saldo': _money_or_zero(doc_full.get('saldo')),
            'dist_contable': dist_contable,
            'documentos_afectados': documentos_afectados,
            'valor_recibido': total,
            'total_aplicado': sum(d['valor_aplicado'] for d in documentos_afectados) or total,
        },
    })


# ─── CXP ─────────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["GET"])
def cxp_documento_print_data(request, tipo_docu: str, no_docu: str):
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    cia = _cia_payload(no_cia, request=request)
    tipo_s = (tipo_docu or '').strip().upper()
    doc_full = cxp_repo.get_documento(no_cia, punto, tipo_s, no_docu)
    if not doc_full:
        return JsonResponse({'error': 'Documento CXP no encontrado'}, status=404)
    label_map = {'CP': 'Comprobante de Pago', 'FC': 'Factura Crédito',
                 'NC': 'Nota de Crédito', 'ND': 'Nota de Débito',
                 'AJ': 'Ajuste', 'RT': 'Retención'}
    doc = {
        'tipo': tipo_s,
        'tipo_label': label_map.get(tipo_s, f'Documento CXP {tipo_s}'),
        'no': doc_full.get('no_docu'),
        'numero_display': f"{tipo_s}-{(doc_full.get('no_docu') or '').strip()}",
        'fecha': str(doc_full.get('fecha') or '')[:10],
        'fecha_venc': str(doc_full.get('fecha_vence') or '')[:10] if doc_full.get('fecha_vence') else None,
        'ncf': doc_full.get('ncf'),
        'ncf_dgi': f"{(doc_full.get('posiciones_fijas_ncf') or '').strip()}{(doc_full.get('ncf') or '').strip()}",
        'tipo_ncf': (doc_full.get('posiciones_fijas_ncf') or '').strip(),
        'tipo_ncf_label': (doc_full.get('posiciones_fijas_ncf') or '').strip(),
        'estado': doc_full.get('status') or '',
        'anulada': (doc_full.get('status') or 'A') in ('R', 'X'),
        'impresion': 'IMPRESA',
        'forma_pago': doc_full.get('forma_pago') or '',
        'condicion_pago': '', 'plazo_pago': 0, 'vendedor': '',
        'nota': '', 'detalle': '', 'moneda': 'DOP', 'tasa': 0, 'porc_impuesto': 0,
    }
    proveedor = {
        'no': doc_full.get('no_proveedor'),
        'nombre': (doc_full.get('nombre_proveedor') or '').strip() or '(sin nombre)',
        'rnc': (doc_full.get('rnc') or '').strip(),
        'direccion': '', 'telefono': '', 'email': '', 'tipo_ncf': '',
    }
    lineas = [{
        'no_linea': i + 1,
        'codigo': l.get('cuenta', ''),
        'descripcion': '', 'cantidad': 1,
        'precio': _money_or_zero(l.get('monto')),
        'descuento': 0, 'itbis': 0,
        'total': _money_or_zero(l.get('monto')),
    } for i, l in enumerate(doc_full.get('lineas') or [])]
    total = _money_or_zero(doc_full.get('valor_original'))
    return JsonResponse({
        'cia': cia, 'doc': doc, 'proveedor': proveedor,
        'lineas': lineas,
        'totales': {
            'subtotal': total - _money_or_zero(doc_full.get('impuesto')),
            'descuento': 0,
            'itbis': _money_or_zero(doc_full.get('impuesto')),
            'propina': 0,
            'otros': _money_or_zero(doc_full.get('itbis_retenido')) + _money_or_zero(doc_full.get('isr_retenido')),
            'total': total, 'monto_letras': '',
        },
        'extra': {'saldo': _money_or_zero(doc_full.get('saldo'))},
    })


# ─── ODC ─────────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["GET"])
def odc_orden_print_data(request, no_orden: str):
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    cia = _cia_payload(no_cia, request=request)
    orden = odc_repo.get_orden(no_cia, punto, no_orden)
    if not orden:
        return JsonResponse({'error': 'Orden no encontrada'}, status=404)
    lineas_raw = odc_repo.list_lineas_orden(no_cia, punto, no_orden)
    doc = {
        'tipo': 'ODC', 'tipo_label': 'Orden de Compra',
        'no': orden.get('no_orden'),
        'numero_display': f"ODC-{(orden.get('no_orden') or '').strip()}",
        'fecha': str(orden.get('fecha') or '')[:10],
        'fecha_venc': str(orden.get('fecha_entrega') or '')[:10] if orden.get('fecha_entrega') else None,
        'estado': orden.get('estado') or '',
        'anulada': (orden.get('estado') or '').upper() in ('R', 'X', 'A'),
        'impresion': 'IMPRESA',
        'forma_pago': '', 'condicion_pago': '', 'plazo_pago': 0,
        'vendedor': '', 'nota': orden.get('nota') or '',
        'detalle': '', 'moneda': 'DOP', 'tasa': 0, 'porc_impuesto': 0,
    }
    proveedor = {
        'no': orden.get('no_proveedor'),
        'nombre': (orden.get('nombre_proveedor') or '').strip() or '(sin nombre)',
        'rnc': (orden.get('rnc_proveedor') or '').strip(),
        'direccion': '', 'telefono': '', 'email': '', 'tipo_ncf': '',
    }
    lineas = [{
        'no_linea': l.get('no_linea'),
        'codigo': l.get('no_produ') or '',
        'descripcion': l.get('descripcion_producto') or '',
        'cantidad': _money_or_zero(l.get('cantidad_pedida')),
        'unidad': l.get('empaque') or '',
        'precio': _money_or_zero(l.get('costo')),
        'porc_descuento': _money_or_zero(l.get('porc_descuento')),
        'descuento': _money_or_zero(l.get('descuento')),
        'porciento_impuesto': _money_or_zero(l.get('porciento_impuesto') or l.get('porc_impuesto')),
        'itbis': _money_or_zero(l.get('impuesto')),
        'total': _money_or_zero(l.get('monto_neto')),
    } for l in lineas_raw]
    subtotal = sum(l['precio'] * l['cantidad'] for l in lineas)
    descuento = sum(l['descuento'] for l in lineas)
    itbis = sum(l['itbis'] for l in lineas)
    total = sum(l['total'] for l in lineas)
    return JsonResponse({
        'cia': cia, 'doc': doc, 'proveedor': proveedor,
        'lineas': lineas,
        'totales': {
            'subtotal': subtotal, 'descuento': descuento, 'itbis': itbis,
            'propina': 0, 'otros': 0, 'total': total, 'monto_letras': '',
        }, 'extra': {},
    })


# ─── CHC ─────────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["GET"])
def chc_cheque_print_data(request, tipo_docu: str, no_docu: str):
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    cia = _cia_payload(no_cia, request=request)
    tipo_s = (tipo_docu or '').strip().upper()
    cheque = chc_repo.get_cheque(no_cia, punto, tipo_s, no_docu)
    if not cheque:
        return JsonResponse({'error': 'Cheque CHC no encontrado'}, status=404)
    label_map = {'CK': 'Cheque', 'RE': 'Reembolso Caja Chica', 'CG': 'Comprobante Gasto'}
    doc = {
        'tipo': tipo_s,
        'tipo_label': label_map.get(tipo_s, f'Documento CHC {tipo_s}'),
        'no': cheque.get('no_docu'),
        'numero_display': f"{tipo_s}-{(cheque.get('no_docu') or '').strip()}",
        'fecha': str(cheque.get('fecha') or '')[:10],
        'estado': cheque.get('estado') or '',
        'anulada': (cheque.get('st_anulado') or 'N') == 'S',
        'impresion': 'IMPRESA',
        'detalle': cheque.get('descripcion') or cheque.get('detalle') or '',
        'nota': cheque.get('descripcion') or '',
        'forma_pago': 'CHEQUE', 'condicion_pago': '', 'plazo_pago': 0,
        'vendedor': cheque.get('solicitado_por') or '',
        'moneda': 'DOP', 'tasa': 0, 'porc_impuesto': 0,
        'banco': cheque.get('banco') or '', 'cuenta': cheque.get('cuenta') or '',
    }
    beneficiario = {
        'no': cheque.get('beneficiario_codigo') or '',
        'nombre': (cheque.get('beneficiario_nombre') or cheque.get('nombre') or '').strip() or '(sin nombre)',
        'rnc': (cheque.get('rnc') or '').strip(),
        'direccion': '', 'telefono': '', 'email': '', 'tipo_ncf': '',
    }
    total = _money_or_zero(cheque.get('monto') or cheque.get('total'))
    return JsonResponse({
        'cia': cia, 'doc': doc, 'cliente': beneficiario,
        'lineas': [{
            'no_linea': 1,
            'codigo': cheque.get('cuenta_contable') or '',
            'descripcion': cheque.get('descripcion') or '',
            'cantidad': 1, 'precio': total,
            'descuento': 0, 'itbis': 0, 'total': total,
        }],
        'totales': {
            'subtotal': total, 'descuento': 0, 'itbis': 0,
            'propina': 0, 'otros': 0, 'total': total, 'monto_letras': '',
        }, 'extra': {},
    })


# ─── CNT — Comprobante contable (asiento) ────────────────────────────────

@login_required
@require_http_methods(["GET"])
def cnt_asiento_print_data(request, ano: int, mes: int, no_asiento: int):
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    cia = _cia_payload(no_cia, request=request)
    try:
        asiento = cnt_repo.get_asiento(no_cia, punto, int(ano), int(mes), int(no_asiento))
    except Exception as e:
        return JsonResponse({'error': f'Error consultando asiento: {e}'}, status=500)
    if not asiento:
        return JsonResponse({'error': 'Asiento no encontrado'}, status=404)

    debitos = _money_or_zero(asiento.get('debitos'))
    creditos = _money_or_zero(asiento.get('creditos'))

    doc = {
        'tipo': 'AS', 'tipo_label': 'Comprobante Contable',
        'no': str(asiento.get('no_asiento') or ''),
        'numero_display': f"AS-{int(ano):04d}-{int(mes):02d}-{int(asiento.get('no_asiento') or 0):05d}",
        'fecha': str(asiento.get('fecha') or '')[:10],
        'fecha_venc': None,
        'estado': asiento.get('autorizado') == 'S' and 'AUTORIZADO' or 'PENDIENTE',
        'anulada': (asiento.get('st_anulado') or 'N') == 'S',
        'impresion': 'IMPRESA',
        'condicion_pago': '', 'forma_pago': '', 'plazo_pago': 0,
        'vendedor': '', 'nota': asiento.get('detalle') or '',
        'detalle': asiento.get('detalle') or '',
        'moneda': 'DOP', 'tasa': 0, 'porc_impuesto': 0,
        'periodo': f"{int(mes):02d}/{int(ano)}",
    }
    cliente = {  # En CNT no hay "cliente" — usamos un slot vacío para el bloque
        'no': '', 'nombre': '— Comprobante Contable —',
        'rnc': '', 'direccion': '', 'telefono': '', 'email': '', 'tipo_ncf': '',
    }
    lineas = [{
        'no_linea': l.get('no_linea'),
        'codigo': (l.get('cuenta') or '').strip(),
        'descripcion': (l.get('cuenta_desc') or '').strip(),
        'almacen': (l.get('centro_costo') or '').strip(),
        'cantidad': 1,
        'precio': _money_or_zero(l.get('monto')),
        'descuento': 0, 'itbis': 0,
        'tipo_movi': l.get('tipo_movi') or '',
        'debito': _money_or_zero(l.get('monto')) if l.get('tipo_movi') == 'D' else 0,
        'credito': _money_or_zero(l.get('monto')) if l.get('tipo_movi') == 'C' else 0,
        'total': _money_or_zero(l.get('monto')),
    } for l in asiento.get('lineas') or []]
    return JsonResponse({
        'cia': cia, 'doc': doc, 'cliente': cliente,
        'lineas': lineas,
        'totales': {
            'subtotal': debitos, 'descuento': 0, 'itbis': 0,
            'propina': 0, 'otros': 0, 'total': debitos,
            'monto_letras': '',
        },
        'extra': {'debitos': debitos, 'creditos': creditos, 'diferencia': debitos - creditos},
    })


# ─── ACF — Acta de Activo Fijo ───────────────────────────────────────────

@login_required
@require_http_methods(["GET"])
def acf_acta_print_data(request, no_activo: str):
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    cia = _cia_payload(no_cia, request=request)
    activo = acf_repo.get_activo(no_cia, punto, no_activo)
    if not activo:
        return JsonResponse({'error': 'Activo no encontrado'}, status=404)
    doc = {
        'tipo': 'AAF', 'tipo_label': 'Acta de Activo Fijo',
        'no': activo.get('no_activo'),
        'numero_display': f"ACF-{(activo.get('no_activo') or '').strip()}",
        'fecha': str(activo.get('fecha_compra') or activo.get('fecha_alta') or '')[:10],
        'estado': activo.get('status') or '',
        'anulada': (activo.get('status') or 'A').upper() == 'R',  # R = Retirado
        'impresion': 'IMPRESA',
        'nota': activo.get('descripcion') or '',
        'detalle': activo.get('descripcion') or '',
        'moneda': 'DOP', 'tasa': 0, 'porc_impuesto': 0,
        'grupo': activo.get('grupo') or '',
        'ubicacion': activo.get('ubicacion') or '',
        'serial': activo.get('serial') or '',
        'marca': activo.get('marca') or '',
        'modelo': activo.get('modelo') or '',
        'condicion_pago': '', 'forma_pago': '', 'plazo_pago': 0, 'vendedor': '',
    }
    cliente = {
        'no': activo.get('responsable') or '',
        'nombre': activo.get('responsable_nombre') or activo.get('responsable') or '— Responsable —',
        'rnc': '', 'direccion': activo.get('ubicacion') or '',
        'telefono': '', 'email': '', 'tipo_ncf': '',
    }
    valor = _money_or_zero(activo.get('valor_compra') or activo.get('valor'))
    return JsonResponse({
        'cia': cia, 'doc': doc, 'cliente': cliente,
        'lineas': [{
            'no_linea': 1,
            'codigo': activo.get('no_activo') or '',
            'descripcion': activo.get('descripcion') or '',
            'cantidad': 1,
            'precio': valor, 'descuento': 0, 'itbis': 0, 'total': valor,
        }],
        'totales': {
            'subtotal': valor, 'descuento': 0, 'itbis': 0,
            'propina': 0, 'otros': 0, 'total': valor, 'monto_letras': '',
        },
        'extra': {
            'depreciacion_acum': _money_or_zero(activo.get('depreciacion_acumulada')),
            'valor_residual': _money_or_zero(activo.get('valor_residual')),
            'vida_util': activo.get('vida_util'),
        },
    })


# ─── SDN — Cabecera de Nómina (no volante individual aún) ─────────────────

@login_required
@require_http_methods(["GET"])
def sdn_nomina_print_data(request, nomina: str):
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    cia = _cia_payload(no_cia, request=request)
    nom = sdn_repo.get_nomina(no_cia, punto, nomina)
    if not nom:
        return JsonResponse({'error': 'Nómina no encontrada'}, status=404)
    doc = {
        'tipo': 'NOM', 'tipo_label': f"Nómina {nom.get('descripcion') or nomina}",
        'no': nomina, 'numero_display': f"NOM-{nomina}",
        'fecha': str(nom.get('fecha_inicial') or '')[:10],
        'fecha_venc': str(nom.get('fecha_final') or '')[:10] if nom.get('fecha_final') else None,
        'estado': nom.get('estado') or '', 'anulada': False,
        'impresion': 'IMPRESA',
        'forma_pago': nom.get('forma_pago') or '',
        'condicion_pago': '', 'plazo_pago': 0, 'vendedor': '',
        'nota': '', 'detalle': nom.get('descripcion') or '',
        'moneda': nom.get('tipo_moneda') or 'DOP', 'tasa': 0, 'porc_impuesto': 0,
        'periodo': f"{nom.get('mes_proceso') or ''}/{nom.get('ano_proceso') or ''}",
    }
    cliente = {
        'no': '', 'nombre': f"Resumen Nómina {nom.get('descripcion') or nomina}",
        'rnc': '', 'direccion': '', 'telefono': '', 'email': '', 'tipo_ncf': '',
    }
    return JsonResponse({
        'cia': cia, 'doc': doc, 'cliente': cliente,
        'lineas': [],  # cabecera sin desglose — volante por empleado pendiente
        'totales': {
            'subtotal': 0, 'descuento': 0, 'itbis': 0,
            'propina': 0, 'otros': 0, 'total': 0, 'monto_letras': '',
        },
        'extra': {
            'cuenta_contable': nom.get('cuenta_contable') or '',
            'cuenta_bancaria': nom.get('cuenta_bancaria') or '',
        },
    })


# ─── ACC ─────────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["GET"])
def acc_documento_print_data(request, no_docu: str):
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    cia = _cia_payload(no_cia, request=request)
    doc_full = acc_repo.get_documento(no_cia, punto, no_docu)
    if not doc_full:
        return JsonResponse({'error': 'Documento ACC no encontrado'}, status=404)
    doc = {
        'tipo': (doc_full.get('tipo_docu') or '').strip().upper(),
        'tipo_label': doc_full.get('tipo_docu_descri') or 'Documento ACC',
        'no': doc_full.get('no_docu'),
        'numero_display': f"ACC-{(doc_full.get('no_docu') or '').strip()}",
        'fecha': str(doc_full.get('fecha') or '')[:10],
        'estado': doc_full.get('estado') or '',
        'anulada': (doc_full.get('st_anulado') or 'N') == 'S',
        'impresion': 'IMPRESA',
        'detalle': doc_full.get('descripcion') or '',
        'nota': doc_full.get('descripcion') or '',
        'forma_pago': '', 'condicion_pago': '', 'plazo_pago': 0,
        'vendedor': '', 'moneda': 'DOP', 'tasa': 0, 'porc_impuesto': 0,
    }
    total = _money_or_zero(doc_full.get('monto') or doc_full.get('total'))
    return JsonResponse({
        'cia': cia, 'doc': doc,
        'cliente': {
            'no': '', 'nombre': doc_full.get('beneficiario') or '',
            'rnc': '', 'direccion': '', 'telefono': '', 'email': '', 'tipo_ncf': '',
        },
        'lineas': [{
            'no_linea': i + 1,
            'codigo': l.get('cuenta') or '',
            'descripcion': l.get('descripcion') or '',
            'cantidad': 1,
            'precio': _money_or_zero(l.get('monto')),
            'descuento': 0, 'itbis': 0,
            'total': _money_or_zero(l.get('monto')),
        } for i, l in enumerate(doc_full.get('lineas') or doc_full.get('detalle_cuentas') or [])],
        'totales': {
            'subtotal': total, 'descuento': 0, 'itbis': 0,
            'propina': 0, 'otros': 0, 'total': total, 'monto_letras': '',
        }, 'extra': {},
    })
