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
from apps.legacy.repositories.fat_repo import _compose_ncf_dgi


def _money_or_zero(v):
    return _money(v)


# ─── ESTADO DE CUENTA (Cliente / Proveedor) ─────────────────────────────

@login_required
@require_http_methods(["GET"])
def cxc_estado_cuenta_print_data(request, no_cliente: str):
    """GET /api/cxc/clientes/<no_cliente>/estado-cuenta/print-data/?no_cia=01"""
    from datetime import datetime
    no_cia = request.GET.get('no_cia', '01')
    fecha_corte = request.GET.get('fecha_corte') or datetime.now().strftime('%Y-%m-%d')
    cia = _cia_payload(no_cia, request=request)
    data = cxc_repo.estado_cuenta(no_cia, no_cliente)
    if not data:
        return JsonResponse({'error': 'Cliente no encontrado'}, status=404)
    documentos = []
    for d in data.get('documentos', []):
        tipo = (d.get('tipo_doc') or '').strip().upper()
        no_doc = (d.get('no_doc') or '').strip()
        documentos.append({
            'numero_display': f"{tipo}-{no_doc}" if tipo else no_doc,
            'tipo_doc': tipo,
            'tipo_label': (d.get('tipo_label') or tipo).strip(),
            'fecha': str(d.get('fecha') or '')[:10],
            'valor': _money(d.get('valor')),
            'saldo': _money(d.get('saldo')),
            'dias_vencido': int(d.get('dias_vencido') or 0),
            'tipo_movi': (d.get('tipo_movi') or '').strip().upper(),
            'ncf': d.get('ncf') or '',
            'detalle': (d.get('detalle') or '')[:80],
        })
    return JsonResponse({
        'cia': cia,
        'doc': {
            'tipo': 'ESTADO_CUENTA',
            'tipo_label': 'Estado de Cuenta',
            'fecha_corte': fecha_corte,
            'fecha_generacion': datetime.now().strftime('%Y-%m-%d %H:%M'),
        },
        'cliente': data['cliente'],
        'totales': {
            'total_debito': data['total_debito'],
            'total_credito': data['total_credito'],
            'total_pendiente': data['total_pendiente'],
        },
        'aging': data['aging'],
        'documentos': documentos,
    })


@login_required
@require_http_methods(["GET"])
def cxp_estado_cuenta_print_data(request, no_proveedor: str):
    """GET /api/cxp/proveedores/<no_proveedor>/estado-cuenta/print-data/?no_cia=01"""
    from datetime import datetime
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '')
    fecha_corte = request.GET.get('fecha_corte') or datetime.now().strftime('%Y-%m-%d')
    cia = _cia_payload(no_cia, request=request)
    data = cxp_repo.estado_cuenta(no_cia, no_proveedor, punto)
    if not data:
        return JsonResponse({'error': 'Proveedor no encontrado'}, status=404)
    documentos = []
    for d in data.get('documentos', []):
        tipo = (d.get('tipo_doc') or '').strip().upper()
        no_doc = (d.get('no_doc') or '').strip()
        documentos.append({
            'numero_display': f"{tipo}-{no_doc}" if tipo else no_doc,
            'tipo_doc': tipo,
            'tipo_label': (d.get('tipo_label') or tipo).strip(),
            'fecha': str(d.get('fecha') or '')[:10],
            'valor': _money(d.get('valor')),
            'saldo': _money(d.get('saldo')),
            'dias_vencido': int(d.get('dias_vencido') or 0),
            'tipo_movi': (d.get('tipo_movi') or '').strip().upper(),
            'ncf': d.get('ncf') or '',
            'detalle': (d.get('detalle') or '')[:80],
        })
    return JsonResponse({
        'cia': cia,
        'doc': {
            'tipo': 'ESTADO_CUENTA_CXP',
            'tipo_label': 'Estado de Cuenta — Proveedor',
            'fecha_corte': fecha_corte,
            'fecha_generacion': datetime.now().strftime('%Y-%m-%d %H:%M'),
        },
        'proveedor': data['proveedor'],
        'totales': {
            'total_debito': data['total_debito'],
            'total_credito': data['total_credito'],
            'total_pendiente': data['total_pendiente'],
        },
        'aging': data['aging'],
        'documentos': documentos,
    })


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
    tipo_q = (request.GET.get('tipo_doc') or request.GET.get('tipo_docu') or '').strip().upper()
    cia = _cia_payload(no_cia, request=request)
    doc_full = cxc_repo.get_documento(no_cia, no_docu, tipo_q, punto)
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
            "SELECT r.tipo_refe, r.no_refe, r.monto, "
            "       NVL(r.itbis_retenido,0) itbis_retenido, "
            "       NVL(r.isr_retenido,0) isr_retenido, "
            "       d.fecha, d.saldo, "
            "       d.posiciones_fijas_ncf, d.ncf "
            "  FROM CXC.TCXC_REFEDOCU r "
            "  LEFT JOIN CXC.TCXC_DOCUMENTO d "
            "    ON d.no_cia=r.no_cia AND d.punto=r.punto "
            "   AND d.tipo_docu=r.tipo_refe AND d.no_docu=r.no_refe "
            " WHERE r.no_cia=:1 AND r.no_docu=:2 AND r.punto=:3 "
            " ORDER BY r.tipo_refe, r.no_refe",
            [no_cia, no_docu, punto])
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
                'itbis_retenido': _money_or_zero(r.get('itbis_retenido')),
                'isr_retenido': _money_or_zero(r.get('isr_retenido')),
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
        'ncf_dgi': (
            f"{(doc_full.get('posiciones_fijas_ncf') or '').strip()}{int(doc_full['ncf']):08d}"
            if doc_full.get('posiciones_fijas_ncf') and doc_full.get('ncf') else
            ((doc_full.get('ncf') or '').strip() if isinstance(doc_full.get('ncf'), str) else str(doc_full.get('ncf') or ''))
        ),
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
    """Print-data UNIFICADO para todos los tipos CxP (FP/AC/AD/BD/NC/ND/SO/...).

    Replica el reporte legacy Rcxp207. El frontend usa una sola plantilla
    'cxp-documento' y los textos cambian con doc.tipo_movi / tipo_label.
    """
    from apps.fat.views_print_data import _numero_a_letras as _nl
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    cia = _cia_payload(no_cia, request=request)
    tipo_s = (tipo_docu or '').strip().upper()
    doc_full = cxp_repo.get_documento(no_cia, punto, tipo_s, no_docu)
    if not doc_full:
        return JsonResponse({'error': 'Documento CXP no encontrado'}, status=404)

    # Resolver tipo_label + tipo_movi desde TCXP_TDOCU (fuente real)
    tipo_label = ''
    tipo_movi_tdoc = ''
    try:
        for t in cxp_repo.list_tipos_docu() or []:
            if (t.get('codigo') or '').strip().upper() == tipo_s:
                tipo_label = (t.get('nombre') or '').strip().upper()
                tipo_movi_tdoc = (t.get('tipo_movi') or '').strip().upper()
                break
    except Exception:
        pass

    # Fallbacks legacy si TCXP_TDOCU está vacío para ese tipo
    if not tipo_label:
        tipo_label = {
            'FP': 'FACTURA PROVEEDORES', 'NC': 'NOTA DE CREDITO',
            'ND': 'NOTA DE DEBITO', 'AC': 'AJUSTE CREDITO',
            'AD': 'AJUSTE DEBITO', 'BD': 'BALANCE DEBITO',
            'BC': 'BALANCE CREDITO', 'SO': 'SOLICITUD DE CHEQUE',
            'CP': 'COMPROBANTE DE PAGO',
        }.get(tipo_s, f'DOCUMENTO {tipo_s}')

    # Tipo_movi: prioriza tipo_movi del header (D/C). Si no, TDOCU. Si no, deduce por tipo.
    tipo_movi = (doc_full.get('tipo_movi') or '').strip().upper() or tipo_movi_tdoc
    if not tipo_movi:
        tipo_movi = 'C' if tipo_s in ('AC', 'NC', 'BC', 'CP', 'SO') else 'D'

    # Distribución contable con nombre de cuenta (TCNT_CATALOGO)
    cuentas_cat = {}
    try:
        from apps.legacy.repositories import cnt_repo
        for c in (cnt_repo.list_catalogo() if hasattr(cnt_repo, 'list_catalogo') else []) or []:
            cuentas_cat[str(c.get('cuenta') or '').strip()] = (
                c.get('nombre') or c.get('descripcion') or ''
            )
    except Exception:
        pass
    dist_contable = []
    for l in (doc_full.get('lineas') or []):
        cu = str(l.get('cuenta') or '').strip()
        nombre = cuentas_cat.get(cu, '') or {
            '1101-01': 'CAJA GENERAL EN RD$',
            '2101-01': 'CUENTAS POR PAGAR - PROVEEDORES LOCALES',
            '4201-01': 'INTERESES Y SOBRANTES',
            '6102-28': 'GASTO DE CERTIFICACION DE IMPUESTOS',
            '8101-02': 'TRANSFERENCIA',
        }.get(cu, '')
        tm = (l.get('tipo_movi') or '').strip().upper()
        monto = _money_or_zero(l.get('monto'))
        dist_contable.append({
            'componente': (l.get('no_componente') or '').strip(),
            'cuenta': cu,
            'descripcion': nombre,
            'centro_costo': (l.get('centro_costo') or '').strip(),
            'debito': monto if tm == 'D' else 0,
            'credito': monto if tm == 'C' else 0,
        })

    # Documentos afectados (TCXP_REFEDOCU)
    docs_afect = []
    try:
        for r in cxp_repo.get_documentos_afectados(no_cia, punto, tipo_s, no_docu) or []:
            tr = (r.get('tipo_doc') or '').strip()
            nr = (r.get('no_doc') or '').strip()
            docs_afect.append({
                'componente': '',
                'tipo_doc': tr,
                'no_doc': nr,
                'numero_display': f"{tr}-{nr}" if tr and nr else nr,
                'fecha': str(r.get('fecha') or '')[:10],
                'monto': _money_or_zero(r.get('monto')),
                'saldo': _money_or_zero(r.get('saldo')),
            })
    except Exception:
        pass

    # Fecha en español largo: "28 de Abril del 2023"
    fecha_str = str(doc_full.get('fecha') or '')[:10]
    fecha_larga = fecha_str
    try:
        from datetime import datetime
        meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
        if fecha_str:
            dt = datetime.strptime(fecha_str, '%Y-%m-%d')
            fecha_larga = f"{dt.day:02d} de {meses[dt.month-1]} del {dt.year}"
    except Exception:
        pass

    total = _money_or_zero(doc_full.get('valor_original'))
    monto_letras = ''
    try:
        monto_letras = _nl(float(total))
    except Exception:
        pass
    # Formato legacy "Valor RD$ ***********300.00" — relleno con asteriscos a la izq.
    total_str = f"{float(total):,.2f}"
    total_padded = total_str.rjust(20, '*')

    no_docu_str = (doc_full.get('no_docu') or '').strip()
    doc = {
        'tipo': tipo_s,
        'tipo_label': tipo_label,
        'no': no_docu_str,
        'numero_display': f"{tipo_s}-{no_docu_str}",
        'fecha': fecha_str,
        'fecha_larga': fecha_larga,
        'fecha_vence': str(doc_full.get('fecha_vence') or '')[:10] if doc_full.get('fecha_vence') else '',
        'ncf': doc_full.get('ncf'),
        'ncf_dgi': doc_full.get('ncf_dgi') or _compose_ncf_dgi(
            doc_full.get('posiciones_fijas_ncf'), doc_full.get('ncf')
        ),
        'estado': doc_full.get('status') or '',
        'anulada': (doc_full.get('status') or 'A') in ('R', 'X'),
        'tipo_movi': tipo_movi,
        'acreditado_debitado': 'Acreditado' if tipo_movi == 'C' else 'Debitado',
        'detalle': (doc_full.get('detalle') or '').strip(),
        'forma_pago': doc_full.get('forma_pago') or '',
        'hecho_por': (doc_full.get('usuario') or '').strip(),
        'reporte_codigo': 'Rcxp207',
    }
    proveedor = {
        'no': (doc_full.get('no_proveedor') or '').strip(),
        'nombre': (doc_full.get('nombre_proveedor') or '').strip() or '(sin nombre)',
        'direccion': (doc_full.get('direccion_proveedor') or '').strip(),
        'telefono': (doc_full.get('telefono_proveedor') or '').strip()
                    or (doc_full.get('celular_proveedor') or '').strip(),
        'rnc': (doc_full.get('rnc') or '').strip(),
    }
    return JsonResponse({
        'cia': cia, 'doc': doc, 'proveedor': proveedor,
        'totales': {
            'subtotal': total - _money_or_zero(doc_full.get('impuesto')),
            'descuento': 0,
            'itbis': _money_or_zero(doc_full.get('impuesto')),
            'otros': _money_or_zero(doc_full.get('itbis_retenido')) + _money_or_zero(doc_full.get('isr_retenido')),
            'total': total,
            'total_padded': total_padded,
            'monto_letras': monto_letras,
        },
        'extra': {
            'saldo': _money_or_zero(doc_full.get('saldo')),
            'documentos_afectados': docs_afect,
            'dist_contable': dist_contable,
            'mostrar_recibido_conforme': tipo_movi == 'D',
        },
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
    estado_label = {
        'I': 'Inicial', 'P': 'Pendiente', 'R': 'Recibida',
    }.get((orden.get('estado') or '').strip().upper(), orden.get('estado') or '')
    doc = {
        'tipo': 'ODC', 'tipo_label': 'Orden de Compra',
        'no': orden.get('no_orden'),
        'numero_display': f"ODC-{(orden.get('no_orden') or '').strip()}",
        'fecha': str(orden.get('fecha') or '')[:10],
        'fecha_venc': str(orden.get('fecha_entrega') or '')[:10] if orden.get('fecha_entrega') else None,
        'estado': orden.get('estado') or '',
        'estado_label': estado_label,
        # ODC.TODC_ORDEN.st_anulado: 'A'=Activa / 'N'=Anulada (NO confundir con estado R/P/I).
        'anulada': (orden.get('st_anulado') or 'A').strip().upper() == 'N',
        'impresion': 'IMPRESA' if (orden.get('st_impresion') or 'N') == 'S' else 'IMPRESA',
        'forma_pago': '',
        'condicion_pago': orden.get('condicion_pago') or '',
        'plazo_pago': orden.get('plazo_pago') or 0,
        'vendedor': orden.get('usuario') or '',
        'nota': orden.get('nota') or orden.get('detalle') or '',
        'detalle': orden.get('detalle') or '',
        'moneda': 'DOP', 'tasa': orden.get('tasa_us') or 0,
        'porc_impuesto': orden.get('porc_impuesto') or 0,
        'autorizada_por': orden.get('autorizada_por') or '',
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


@login_required
@require_http_methods(["GET"])
def odc_requisicion_print_data(request, no_requisicion: str):
    """GET /api/odc/requisiciones/<no_requisicion>/print-data/?no_cia=01&punto=01

    Requisición interna: sólo cantidades + notas (sin precios). Payload usa el
    bloque "cliente" como solicitante (no aplica proveedor).
    """
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    cia = _cia_payload(no_cia, request=request)
    req = odc_repo.get_requisicion(no_cia, punto, no_requisicion)
    if not req:
        return JsonResponse({'error': 'Requisición no encontrada'}, status=404)
    lineas_raw = odc_repo.list_lineas_requisicion(no_cia, punto, no_requisicion)
    estado_label = {
        'P': 'Pendiente', 'A': 'Autorizada', 'C': 'Cerrada', 'R': 'Recibida',
    }.get((req.get('estado') or '').strip().upper(), req.get('estado') or '')
    doc = {
        'tipo': 'REQ', 'tipo_label': 'Requisición Interna',
        'no': req.get('no_requisicion'),
        'numero_display': f"REQ-{(req.get('no_requisicion') or '').strip()}",
        'fecha': str(req.get('fecha') or '')[:10],
        'fecha_venc': str(req.get('fecha_entrega') or '')[:10] if req.get('fecha_entrega') else None,
        'estado': req.get('estado') or '',
        'estado_label': estado_label,
        'anulada': (req.get('st_anulado') or 'A').strip().upper() == 'N',
        'impresion': 'IMPRESA' if (req.get('st_impresion') or 'N') == 'S' else 'IMPRESA',
        'forma_pago': '', 'condicion_pago': '', 'plazo_pago': 0,
        'vendedor': req.get('usuario') or '',
        'nota': req.get('detalle') or '',
        'detalle': req.get('detalle') or '',
        'moneda': 'DOP', 'tasa': 0, 'porc_impuesto': 0,
        'no_localidad': req.get('no_localidad') or '',
        'no_depto': req.get('no_depto') or '',
    }
    solicitante = {
        'nombre': req.get('usuario') or '',
        'rnc': '', 'direccion': '', 'telefono': '', 'email': '', 'tipo_ncf': '',
        'no_localidad': req.get('no_localidad') or '',
        'no_depto': req.get('no_depto') or '',
    }
    lineas = [{
        'no_linea': l.get('no_linea'),
        'codigo': l.get('no_produ') or '',
        'descripcion': l.get('descripcion_producto') or '',
        'cantidad': _money_or_zero(l.get('cantidad_pedida')),
        'cantidad_autorizada': _money_or_zero(l.get('cantidad_autorizada')),
        'cantidad_pendiente': _money_or_zero(l.get('cantidad_pendiente')),
        'unidad': l.get('empaque') or '',
        'precio': 0, 'descuento': 0, 'itbis': 0, 'total': 0,
        'nota': l.get('nota') or '',
    } for l in lineas_raw]
    return JsonResponse({
        'cia': cia, 'doc': doc,
        'cliente': solicitante, 'proveedor': solicitante,
        'lineas': lineas,
        'totales': {
            'subtotal': 0, 'descuento': 0, 'itbis': 0,
            'propina': 0, 'otros': 0, 'total': 0, 'monto_letras': '',
            'cantidad_total': sum(l['cantidad'] for l in lineas),
            'lineas_total': len(lineas),
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


# ─── Asiento Contable CxC / CxP (resumen por cuenta del período) ─────────
# Familia "reporte": migra las vistas previas client-side (document.write) al
# print fino. Reutiliza los mismos repos que la pantalla.

def _asiento_reporte(cia, rows, titulo, mes, ano, tipo):
    filas = [{
        'cuenta': (r.get('cuenta') or '').strip(),
        'centro_costo': (r.get('centro_costo') or '').strip(),
        'total_debito': _money_or_zero(r.get('total_debito')),
        'total_credito': _money_or_zero(r.get('total_credito')),
    } for r in rows]
    td = sum(f['total_debito'] for f in filas)
    tc = sum(f['total_credito'] for f in filas)
    return {
        'cia': cia,
        'reporte': {
            'codigo': 'asiento-contable', 'titulo': titulo,
            'fecha_generacion': None,
            'filtros': {'Mes': mes, 'Año': ano, 'Tipo': tipo},
        },
        'filas': filas,
        'totales': {
            'cantidad': len(filas), 'total_debito': td, 'total_credito': tc,
            'diferencia': round(td - tc, 2), 'total': td,
        },
    }


@login_required
@require_http_methods(["GET"])
def cnt_grupos_contables_print_data(request):
    """Catálogo de Grupos Contables por sucursal (familia reporte)."""
    no_cia = request.GET.get('no_cia', '01')
    cia = _cia_payload(no_cia, request=request)
    try:
        rows = cnt_repo.list_grupos_contables() or []
    except Exception:
        rows = []
    filas = [{
        'grupo': str(r.get('grupo') or '').strip(),
        'descripcion': (r.get('descripcion') or '').strip(),
        'cuenta_inicio': str(r.get('cuenta_inicio') or '').strip(),
        'cuenta_fin': str(r.get('cuenta_fin') or '').strip(),
    } for r in rows]
    return JsonResponse({
        'cia': cia,
        'reporte': {
            'codigo': 'cnt-grupos-contables', 'titulo': 'Grupos Contables por Sucursal',
            'fecha_generacion': None, 'filtros': {},
        },
        'filas': filas,
        'totales': {'cantidad': len(filas)},
    })


@login_required
@require_http_methods(["GET"])
def cxc_asiento_print_data(request):
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    cia = _cia_payload(no_cia, request=request)
    mes = request.GET.get('mes', '')
    ano = request.GET.get('ano', '')
    tipo = request.GET.get('tipo', 'detallado')
    try:
        rows = cxc_repo.get_asiento_contable(no_cia, punto, int(mes), int(ano)) if mes and ano else []
    except Exception:
        rows = []
    return JsonResponse(_asiento_reporte(
        cia, rows, 'Asiento Contable CxC — %s/%s' % (mes, ano), mes, ano, tipo))


@login_required
@require_http_methods(["GET"])
def cxp_asiento_print_data(request):
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    cia = _cia_payload(no_cia, request=request)
    mes = request.GET.get('mes', '')
    ano = request.GET.get('ano', '')
    tipo = request.GET.get('tipo', 'detallado')
    try:
        rows = cxp_repo.get_asiento_contable_cxp(no_cia, punto, int(mes), int(ano)) if mes and ano else []
    except Exception:
        rows = []
    return JsonResponse(_asiento_reporte(
        cia, rows, 'Asiento Contable CxP — %s/%s' % (mes, ano), mes, ano, tipo))


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


# ─── ACF — Comprobante de Compra (familia documento) ─────────────────────

MES_LABEL = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
             'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']


def _acf_doc_payload(request, tipo_docu: str, no_docu: str, tipo_label: str,
                     extra_lookup: dict | None = None):
    """Genera el payload base para los 3 comprobantes de proceso ACF
    (Compra/Retiro/Cierre). Devuelve (status, payload_dict)."""
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    if len(punto) == 1:
        punto = punto.zfill(2)
    cia = _cia_payload(no_cia, request=request)
    docu = acf_repo.get_documento(no_cia, punto, tipo_docu, no_docu)
    if not docu:
        return 404, {'error': f'Documento {tipo_docu}-{no_docu} no encontrado'}
    monto = _money_or_zero(docu.get('monto'))
    doc = {
        'tipo': tipo_docu, 'tipo_label': tipo_label,
        'no': docu.get('no_docu'),
        'numero_display': f"{tipo_docu}-{(docu.get('no_docu') or '').strip()}",
        'fecha': str(docu.get('fecha') or '')[:10],
        'estado': docu.get('tipo_movi') or '',
        'anulada': (docu.get('st_nulo') or 'N') == 'S',
        'impresion': 'IMPRESA',
        'nota': (docu.get('detalle') or '')[:200],
        'detalle': (docu.get('detalle') or '')[:200],
        'no_activo': docu.get('no_activo') or '',
        'descripcion_activo': docu.get('descripcion_activo') or '',
        'serie': docu.get('serie') or '',
        'duracion_ano': docu.get('duracion_ano'),
        'departamento': docu.get('departamento') or '',
        'responsable': docu.get('responsable') or '',
        'cuenta_contable': docu.get('cuenta') or '',
        'moneda': 'DOP', 'tasa': 0, 'porc_impuesto': 0,
    }
    cliente = {
        'no': docu.get('no_proveedor') or docu.get('no_cliente') or '',
        'nombre': (extra_lookup or {}).get('contraparte_nombre')
                  or docu.get('no_proveedor') or '—',
        'rnc': '', 'direccion': '', 'telefono': '', 'email': '', 'tipo_ncf': '',
    }
    return 200, {
        'cia': cia, 'doc': doc, 'cliente': cliente,
        'lineas': [{
            'no_linea': 1,
            'codigo': docu.get('no_activo') or '',
            'descripcion': docu.get('descripcion_activo') or docu.get('detalle') or '',
            'cantidad': 1,
            'precio': monto, 'descuento': 0, 'itbis': 0, 'total': monto,
        }],
        'totales': {
            'subtotal': monto, 'descuento': 0, 'itbis': 0,
            'propina': 0, 'otros': 0, 'total': monto, 'monto_letras': '',
        },
        'extra': {
            'valor_original': _money_or_zero(docu.get('valor_original')),
            'depre_acumu': _money_or_zero(docu.get('depre_acumu')),
            'depre_mes': _money_or_zero(docu.get('depre_mes')),
            'valor_libro': _money_or_zero(docu.get('valor_libro')),
            'departamento': docu.get('departamento') or '',
            'responsable': docu.get('responsable') or '',
            'cuenta': docu.get('cuenta') or '',
            'usuario': docu.get('usuario') or '',
            'serie': docu.get('serie') or '',
        },
    }


@login_required
@require_http_methods(["GET"])
def acf_comprobante_compra_print_data(request, no_docu: str):
    """GET /api/acf/comprobante-compra/<no_docu>/print-data/?no_cia=01&punto=01"""
    code, payload = _acf_doc_payload(request, 'CP', no_docu, 'Compra de Activo Fijo')
    return JsonResponse(payload, status=code)


@login_required
@require_http_methods(["GET"])
def acf_comprobante_retiro_print_data(request, no_docu: str):
    """GET /api/acf/comprobante-retiro/<no_docu>/print-data/?no_cia=01&punto=01"""
    code, payload = _acf_doc_payload(request, 'RT', no_docu, 'Retiro de Activo Fijo')
    return JsonResponse(payload, status=code)


@login_required
@require_http_methods(["GET"])
def acf_comprobante_cierre_print_data(request, ano_mes: str):
    """GET /api/acf/comprobante-cierre/<YYYY-MM>/print-data/?no_cia=01&punto=01"""
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    if len(punto) == 1:
        punto = punto.zfill(2)
    try:
        ano, mes = ano_mes.split('-')
        ano_i = int(ano); mes_i = int(mes)
    except Exception:
        return JsonResponse({'error': 'Formato esperado: YYYY-MM'}, status=400)
    cia = _cia_payload(no_cia, request=request)
    cierre = acf_repo.get_cierre(no_cia, punto, ano_i, mes_i)
    if not cierre:
        return JsonResponse({'error': f'Cierre {mes_i:02d}/{ano_i} no encontrado'}, status=404)
    docs = acf_repo.list_documentos_periodo(no_cia, punto, 'DP', ano_i, mes_i)
    total_depre = sum(_money_or_zero(d.get('depre_mes')) for d in docs)
    doc = {
        'tipo': 'CIE', 'tipo_label': 'Comprobante de Cierre Mensual ACF',
        'no': f"{ano_i}-{mes_i:02d}",
        'numero_display': f"CIE-ACF-{ano_i}-{mes_i:02d}",
        'fecha': str(cierre.get('fecha_cierre') or '')[:10],
        'estado': 'CERRADO', 'anulada': False, 'impresion': 'IMPRESA',
        'detalle': f"Cierre del período {MES_LABEL[mes_i] if 1 <= mes_i <= 12 else mes_i} {ano_i}",
        'nota': '', 'periodo': f"{mes_i:02d}/{ano_i}",
        'moneda': 'DOP', 'tasa': 0, 'porc_impuesto': 0,
    }
    cliente = {
        'no': punto, 'nombre': f"Punto {punto}",
        'rnc': '', 'direccion': '', 'telefono': '', 'email': '', 'tipo_ncf': '',
    }
    return JsonResponse({
        'cia': cia, 'doc': doc, 'cliente': cliente,
        'lineas': [{
            'no_linea': 1, 'codigo': 'DP',
            'descripcion': f"Total depreciado en {MES_LABEL[mes_i]} {ano_i} ({len(docs)} activos)",
            'cantidad': len(docs), 'precio': 0, 'descuento': 0, 'itbis': 0,
            'total': total_depre,
        }],
        'totales': {
            'subtotal': total_depre, 'descuento': 0, 'itbis': 0,
            'propina': 0, 'otros': 0, 'total': total_depre, 'monto_letras': '',
        },
        'extra': {
            'usuario_cierre': cierre.get('usuario') or '',
            'fecha_cierre': cierre.get('fecha_cierre') or '',
            'activos_depreciados': len(docs),
            'periodo': f"{mes_i:02d}/{ano_i}",
            'mes_label': MES_LABEL[mes_i] if 1 <= mes_i <= 12 else '',
        },
    })


# ─── ACF — Reportes (familia reporte) ───────────────────────────────────

@login_required
@require_http_methods(["GET"])
def acf_listado_activos_print_data(request):
    """GET /api/acf/rep-listado/print-data/?no_cia=01&punto=01[&status=A]"""
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto') or None
    if punto and len(punto) == 1: punto = punto.zfill(2)
    status = request.GET.get('status') or None
    cia = _cia_payload(no_cia, request=request)
    rows = acf_repo.rep_listado_completo(no_cia, punto, status) or []
    filas = []
    tot_valor = tot_depre = 0.0
    for r in rows:
        v = _money_or_zero(r.get('valor_original')) + _money_or_zero(r.get('mejora'))
        d = _money_or_zero(r.get('depre_acumu'))
        tot_valor += v; tot_depre += d
        filas.append({
            'no_activo': r.get('no_activo') or '',
            'descripcion': (r.get('descripcion') or '')[:50],
            'grupo': r.get('grupo') or '',
            'departamento': r.get('departamento') or '',
            'responsable': r.get('responsable') or '',
            'fecha_compra': str(r.get('fecha_compra') or '')[:10],
            'valor_original': v,
            'depre_acumu': d,
            'valor_libros': v - d,
            'status': 'Activo' if r.get('status') == 'A' else 'Retirado',
        })
    filtros = {
        'Empresa': no_cia,
        **({'Punto': punto} if punto else {}),
        **({'Estado': 'Activos' if status == 'A' else 'Retirados'} if status else {}),
    }
    return JsonResponse({
        'cia': cia,
        'reporte': {
            'codigo': 'listado-activos-acf',
            'titulo': 'Listado de Activos Fijos',
            'filtros': filtros,
        },
        'filas': filas,
        'totales': {
            'cantidad': len(filas),
            'valor_original': tot_valor,
            'depre_acumu': tot_depre,
            'valor_libros': tot_valor - tot_depre,
            'total': tot_valor - tot_depre,
        },
    })


@login_required
@require_http_methods(["GET"])
def acf_listado_depreciacion_print_data(request, ano_mes: str):
    """GET /api/acf/rep-depreciacion/<YYYY-MM>/print-data/?no_cia=01&punto=01"""
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    if len(punto) == 1: punto = punto.zfill(2)
    try:
        ano, mes = ano_mes.split('-')
        ano_i = int(ano); mes_i = int(mes)
    except Exception:
        return JsonResponse({'error': 'Formato esperado: YYYY-MM'}, status=400)
    cia = _cia_payload(no_cia, request=request)
    docs = acf_repo.list_documentos_periodo(no_cia, punto, 'DP', ano_i, mes_i) or []
    filas = []
    total = 0.0
    for d in docs:
        cuota = _money_or_zero(d.get('depre_mes'))
        total += cuota
        filas.append({
            'no_activo': d.get('no_activo') or '',
            'descripcion': (d.get('descripcion_activo') or '')[:60],
            'grupo': d.get('grupo') or '',
            'departamento': d.get('departamento') or '',
            'valor_original': _money_or_zero(d.get('valor_original')),
            'depre_mes': cuota,
            'depre_acumu': _money_or_zero(d.get('depre_acumu')),
            'valor_libro': _money_or_zero(d.get('valor_libro')),
            'cuenta': d.get('cuenta') or '',
            'fecha': str(d.get('fecha') or '')[:10],
        })
    return JsonResponse({
        'cia': cia,
        'reporte': {
            'codigo': 'listado-depreciacion-acf',
            'titulo': f"Depreciación Mensual · {MES_LABEL[mes_i]} {ano_i}",
            'filtros': {
                'Empresa': no_cia, 'Punto': punto,
                'Período': f"{mes_i:02d}/{ano_i}",
            },
        },
        'filas': filas,
        'totales': {
            'cantidad': len(filas),
            'total_depreciado': total,
            'total': total,
        },
    })


@login_required
@require_http_methods(["GET"])
def acf_rep_valuacion_print_data(request):
    """GET /api/acf/rep-valuacion/print-data/?no_cia=01[&punto=01]"""
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto') or None
    if punto and len(punto) == 1: punto = punto.zfill(2)
    cia = _cia_payload(no_cia, request=request)
    v = acf_repo.rep_valuacion(no_cia, punto) or {}
    grupos = acf_repo.rep_activos_por_grupo(no_cia, punto) or []
    filas = []
    for g in grupos:
        filas.append({
            'grupo': g.get('grupo') or '',
            'cantidad': int(g.get('cantidad') or 0),
        })
    return JsonResponse({
        'cia': cia,
        'reporte': {
            'codigo': 'valuacion-acf',
            'titulo': 'Valuación Contable de Activos Fijos',
            'filtros': {
                'Empresa': no_cia,
                **({'Punto': punto} if punto else {}),
            },
        },
        'filas': filas,
        'totales': {
            'cantidad': int(v.get('cantidad') or 0),
            'valor_original': _money_or_zero(v.get('valor_original')),
            'mejoras': _money_or_zero(v.get('mejoras')),
            'revalorizacion': _money_or_zero(v.get('revalorizacion')),
            'depre_acumu': _money_or_zero(v.get('depre_acumu')),
            'valor_libros': _money_or_zero(v.get('valor_libros')),
            'total': _money_or_zero(v.get('valor_libros')),
        },
    })


@login_required
@require_http_methods(["GET"])
def acf_rep_por_grupo_print_data(request):
    """GET /api/acf/rep-por-grupo/print-data/?no_cia=01[&punto=01]"""
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto') or None
    if punto and len(punto) == 1: punto = punto.zfill(2)
    cia = _cia_payload(no_cia, request=request)
    rows = acf_repo.rep_activos_por_grupo(no_cia, punto) or []
    filas = [{
        'grupo': r.get('grupo') or '',
        'cantidad': int(r.get('cantidad') or 0),
    } for r in rows]
    total = sum(f['cantidad'] for f in filas)
    return JsonResponse({
        'cia': cia,
        'reporte': {
            'codigo': 'activos-por-grupo-acf',
            'titulo': 'Activos Fijos por Grupo',
            'filtros': {
                'Empresa': no_cia,
                **({'Punto': punto} if punto else {}),
            },
        },
        'filas': filas,
        'totales': {'cantidad': total, 'total': total},
    })


@login_required
@require_http_methods(["GET"])
def acf_rep_por_departamento_print_data(request):
    """GET /api/acf/rep-por-departamento/print-data/?no_cia=01[&punto=01]"""
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto') or None
    if punto and len(punto) == 1: punto = punto.zfill(2)
    cia = _cia_payload(no_cia, request=request)
    rows = acf_repo.rep_activos_por_departamento(no_cia, punto) or []
    filas = []
    tot_val = tot_dep = 0.0
    for r in rows:
        v = _money_or_zero(r.get('valor_original'))
        d = _money_or_zero(r.get('depre_acumu'))
        tot_val += v; tot_dep += d
        filas.append({
            'departamento': r.get('departamento') or '',
            'cantidad': int(r.get('cantidad') or 0),
            'valor_original': v,
            'depre_acumu': d,
            'valor_libros': v - d,
        })
    return JsonResponse({
        'cia': cia,
        'reporte': {
            'codigo': 'activos-por-departamento-acf',
            'titulo': 'Activos Fijos por Departamento',
            'filtros': {
                'Empresa': no_cia,
                **({'Punto': punto} if punto else {}),
            },
        },
        'filas': filas,
        'totales': {
            'cantidad': sum(f['cantidad'] for f in filas),
            'valor_original': tot_val,
            'depre_acumu': tot_dep,
            'valor_libros': tot_val - tot_dep,
            'total': tot_val - tot_dep,
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
    # Cargar el volante por empleado (TSDN_MOVIMIENTO o salario base si la
    # nómina aún no se calculó) para listar el detalle en el PDF.
    try:
        vol = sdn_repo.volante_nomina(no_cia, punto, nomina)
    except Exception:
        vol = {'empleados': [], 'totales': {}}
    lineas = []
    for i, e in enumerate(vol.get('empleados') or [], start=1):
        salario = _money_or_zero(e.get('salario_mensual'))
        ingresos = _money_or_zero(e.get('total_ingresos'))
        deducc = _money_or_zero(e.get('total_deducciones'))
        neto = _money_or_zero(e.get('neto'))
        lineas.append({
            'no_linea': i,
            'codigo': str(e.get('no_empleado') or '').zfill(4),
            'descripcion': e.get('nombre_empleado') or '',
            'cantidad': 1,
            'unidad': '',
            'precio': salario,
            'descuento': deducc,
            'itbis': ingresos,
            'total': neto,
            # Campos auxiliares específicos del dominio (uso en TextoLibre con {{#each}}).
            'cedula': e.get('cedula') or '',
            'salario_mensual': salario,
            'total_ingresos': ingresos,
            'total_deducciones': deducc,
            'neto': neto,
        })
    vt = vol.get('totales') or {}
    return JsonResponse({
        'cia': cia, 'doc': doc, 'cliente': cliente,
        'lineas': lineas,
        'totales': {
            'subtotal': _money_or_zero(vt.get('salario')),
            'descuento': _money_or_zero(vt.get('deducciones')),
            'itbis': _money_or_zero(vt.get('ingresos')),
            'propina': 0, 'otros': 0,
            'total': _money_or_zero(vt.get('neto')),
            'monto_letras': '',
            'empleados': int(vt.get('empleados') or len(lineas)),
        },
        'extra': {
            'cuenta_contable': nom.get('cuenta_contable') or '',
            'cuenta_bancaria': nom.get('cuenta_bancaria') or '',
            'moneda_label': 'US$' if (nom.get('tipo_moneda') == 'D') else 'RD$',
        },
    })


# ─── ACC — Reposición de Caja Chica ──────────────────────────────────────

@login_required
@require_http_methods(["GET"])
def acc_reposicion_print_data(request, no_reposicion: str):
    """GET /api/acc/reposiciones/<no_reposicion>/print-data/?no_cia=01&punto=01"""
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    cia = _cia_payload(no_cia, request=request)
    rep = acc_repo.get_reposicion(no_cia, punto, no_reposicion)
    if not rep:
        return JsonResponse({'error': 'Reposición no encontrada'}, status=404)
    docs = acc_repo.list_docs_reposicion(no_cia, punto, no_reposicion) or []
    anulada = bool(rep.get('anulada_por'))
    _no_rep_str = str(rep.get('no_reposicion') or '').strip()
    doc = {
        'tipo': 'REP', 'tipo_label': 'Reposición de Caja Chica',
        'no': _no_rep_str,
        'numero_display': f"REP-{_no_rep_str}",
        'fecha': str(rep.get('fecha') or '')[:10],
        'fecha_venc': None,
        'estado': 'Anulada' if anulada else 'Activa',
        'estado_label': 'Anulada' if anulada else 'Activa',
        'anulada': anulada,
        'impresion': 'IMPRESA',
        'forma_pago': str(rep.get('forma_pago') or ''),
        'condicion_pago': '', 'plazo_pago': 0, 'vendedor': '',
        'nota': rep.get('detalle') or '',
        'detalle': rep.get('detalle') or '',
        'moneda': 'DOP', 'tasa': 0, 'porc_impuesto': 0,
        # Específicos de reposición
        'cuenta_banco': rep.get('cuenta_banco') or '',
        'no_cheque': rep.get('no_cheque') or '',
        'tipo_docu_chc': rep.get('tipo_docu_chc') or '',
        'no_docu_chc': rep.get('no_docu_chc') or '',
        'ncf': _compose_ncf_dgi(rep.get('posiciones_fijas_ncf'), rep.get('ncf')) if rep.get('ncf') else '',
        'ncf_dgi': _compose_ncf_dgi(rep.get('posiciones_fijas_ncf'), rep.get('ncf')) if rep.get('ncf') else '',
    }
    cliente = {
        'no': rep.get('no_caja') or '',
        'nombre': rep.get('desc_caja') or f"Caja {rep.get('no_caja') or ''}",
        'rnc': '', 'direccion': '', 'telefono': '', 'email': '', 'tipo_ncf': '',
        'no_caja': rep.get('no_caja') or '',
        'usuario': rep.get('usuario') or '',
    }
    def _s(v):
        return str(v).strip() if v is not None else ''
    lineas = [{
        'no_linea': i + 1,
        'codigo': _s(d.get('no_docu')),
        'descripcion': f"ACC-{_s(d.get('no_docu'))} · {_s(d.get('nombre_bene'))} · "
                       f"{_s(d.get('desc_gasto'))}",
        'cantidad': 1, 'unidad': '',
        'precio': _money_or_zero(d.get('valor')),
        'descuento': 0,
        'itbis': _money_or_zero(d.get('impuesto')),
        'total': _money_or_zero(d.get('valor')),
        # auxiliares
        'no_docu': _s(d.get('no_docu')),
        'fecha_docu': str(d.get('fecha') or '')[:10],
        'no_bene': _s(d.get('no_bene')),
        'nombre_bene': _s(d.get('nombre_bene')),
        'tipo_gasto': _s(d.get('tipo_gasto')),
        'desc_gasto': _s(d.get('desc_gasto')),
        'ncf': _s(d.get('ncf')),
        'rnc': _s(d.get('rnc')),
        'detalle': _s(d.get('detalle')),
    } for i, d in enumerate(docs)]
    subtotal = sum(l['precio'] for l in lineas)
    itbis = sum(l['itbis'] for l in lineas)
    total = _money_or_zero(rep.get('valor_reposicion'))
    return JsonResponse({
        'cia': cia, 'doc': doc, 'cliente': cliente,
        'lineas': lineas,
        'totales': {
            'subtotal': subtotal,
            'descuento': 0,
            'itbis': itbis,
            'propina': _money_or_zero(rep.get('propina')),
            'otros': _money_or_zero(rep.get('otros_impuestos')),
            'total': total,
            'monto_letras': '',
            'monto_caja': _money_or_zero(rep.get('monto_cc')),
            'efectivo': _money_or_zero(rep.get('efectivo')),
            'valor_compro_prov': _money_or_zero(rep.get('valor_compro_prov')),
            'valor_ncf': _money_or_zero(rep.get('valor_ncf')),
            'cantidad_docs': len(lineas),
        },
        'extra': {
            'cuenta_banco': rep.get('cuenta_banco') or '',
            'no_cheque': rep.get('no_cheque') or '',
            'tipo_docu_chc': rep.get('tipo_docu_chc') or '',
            'no_docu_chc': rep.get('no_docu_chc') or '',
            'anulada_por': rep.get('anulada_por') or '',
            'fecha_anulacion': str(rep.get('fecha_anulacion') or '')[:10],
            'motivo_anulacion': rep.get('motivo_anulacion') or '',
        },
    })


# ─── ACC — Listado de documentos / egresos (familia reporte) ─────────────

@login_required
@require_http_methods(["GET"])
def acc_listado_docs_print_data(request):
    """GET /api/acc/documentos/listado/print-data/?no_cia=01[&...]"""
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    cia = _cia_payload(no_cia, request=request)
    no_caja = request.GET.get('no_caja') or None
    fecha_desde = request.GET.get('fecha_desde') or None
    fecha_hasta = request.GET.get('fecha_hasta') or None
    anulado = request.GET.get('anulado') or None
    rows = acc_repo.list_documentos(
        no_cia=no_cia, punto=punto, no_caja=no_caja,
        fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
        anulado=anulado, limit=2000,
    ) or []
    filas = []
    total_valor = total_impuesto = 0.0
    activos = 0
    for r in rows:
        val = _money_or_zero(r.get('valor'))
        imp = _money_or_zero(r.get('impuesto'))
        is_anul = (r.get('anulado') or 'N') == 'S'
        if not is_anul:
            total_valor += val; total_impuesto += imp; activos += 1
        filas.append({
            'no_docu': f"ACC-{(r.get('no_docu') or '').strip()}",
            'fecha': str(r.get('fecha') or '')[:10],
            'no_caja': r.get('no_caja') or '',
            'no_bene': r.get('no_bene') or '',
            'nombre_bene': r.get('nombre_bene') or '',
            'tipo_gasto': r.get('tipo_gasto') or '',
            'desc_gasto': r.get('desc_gasto') or '',
            'ncf': r.get('ncf') or '',
            'rnc': r.get('rnc') or '',
            'valor': val,
            'impuesto': imp,
            'no_reposicion': (r.get('no_reposicion') or ''),
            'estado': 'Anulado' if is_anul else 'Activo',
        })
    filtros = {
        'Empresa': no_cia, 'Punto': punto,
        **({'Caja': no_caja} if no_caja else {}),
        **({'Desde': fecha_desde} if fecha_desde else {}),
        **({'Hasta': fecha_hasta} if fecha_hasta else {}),
        **({'Estado': 'Anulados' if anulado == 'S' else 'Activos'} if anulado else {}),
    }
    return JsonResponse({
        'cia': cia,
        'reporte': {
            'codigo': 'acc-listado-documentos',
            'titulo': 'Listado de Documentos · Caja Chica',
            'filtros': filtros,
        },
        'filas': filas,
        'totales': {
            'cantidad': len(filas),
            'activos': activos,
            'anulados': len(filas) - activos,
            'valor': total_valor,
            'impuesto': total_impuesto,
            'total': total_valor,
        },
    })


# ─── ACC — Resumen de gastos por tipo (familia reporte) ──────────────────

@login_required
@require_http_methods(["GET"])
def acc_resumen_gastos_print_data(request):
    """GET /api/acc/rep-resumen/print-data/?no_cia=01[&...]"""
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    cia = _cia_payload(no_cia, request=request)
    fecha_desde = request.GET.get('fecha_desde') or None
    fecha_hasta = request.GET.get('fecha_hasta') or None
    resumen = acc_repo.rep_resumen(no_cia, punto, fecha_desde, fecha_hasta) or {}
    gastos = acc_repo.rep_gastos_por_tipo(no_cia, punto, fecha_desde, fecha_hasta) or []
    filas = [{
        'tipo_gasto': r.get('tipo_gasto') or '',
        'descripcion': r.get('descripcion') or '',
        'cuenta': r.get('cuenta') or '',
        'centro_costo': r.get('centro_costo') or '',
        'cantidad': int(r.get('cantidad') or 0),
        'total': _money_or_zero(r.get('total')),
    } for r in gastos]
    filtros = {
        'Empresa': no_cia, 'Punto': punto,
        **({'Desde': fecha_desde} if fecha_desde else {}),
        **({'Hasta': fecha_hasta} if fecha_hasta else {}),
    }
    return JsonResponse({
        'cia': cia,
        'reporte': {
            'codigo': 'acc-resumen-gastos',
            'titulo': 'Resumen de Gastos por Tipo · Caja Chica',
            'filtros': filtros,
        },
        'filas': filas,
        'totales': {
            'cantidad': len(filas),
            'total_docs': int(resumen.get('total_docs') or 0),
            'anulados': int(resumen.get('anulados') or 0),
            'monto_total': _money_or_zero(resumen.get('monto_total')),
            'impuesto_total': _money_or_zero(resumen.get('impuesto_total')),
            'total': _money_or_zero(resumen.get('monto_total')),
        },
    })


# ─── SDN — Volante individual por empleado (Fsdn206 individual) ──────────

@login_required
@require_http_methods(["GET"])
def sdn_volante_empleado_print_data(request, nomina: str, no_empleado: str):
    """GET /api/sdn/nominas/<nomina>/empleado/<no_empleado>/print-data/

    Volante de pago de UN empleado para un período específico. Combina
    cabecera de la nómina, datos del empleado y desglose de
    ingresos/deducciones (TSDN_MOVIMIENTO).
    """
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    cia = _cia_payload(no_cia, request=request)
    nom = sdn_repo.get_nomina(no_cia, punto, nomina)
    if not nom:
        return JsonResponse({'error': 'Nómina no encontrada'}, status=404)
    try:
        no_emp = int(no_empleado)
    except (TypeError, ValueError):
        return JsonResponse({'error': 'no_empleado inválido'}, status=400)
    emp = sdn_repo.get_empleado(no_cia, no_emp)
    if not emp:
        return JsonResponse({'error': 'Empleado no encontrado'}, status=404)

    ano = int(request.GET.get('ano') or nom.get('ano_proceso') or 0)
    mes = int(request.GET.get('mes') or nom.get('mes_proceso') or 0)
    periodo = int(request.GET.get('periodo') or nom.get('periodo') or 1)

    movs = sdn_repo.list_movimientos(
        no_cia=no_cia, punto=punto, nomina=nomina,
        ano=ano, mes=mes, periodo=periodo, no_empleado=no_emp,
    ) or []

    lineas = []
    sum_ing = sum_ded = 0.0
    for i, m in enumerate(movs, start=1):
        tt = (m.get('tipo_transaccion') or '').upper()
        monto = _money_or_zero(m.get('monto_transaccion'))
        if tt == 'I':
            sum_ing += monto
            ing, ded = monto, 0
        else:
            sum_ded += monto
            ing, ded = 0, monto
        lineas.append({
            'no_linea': i,
            'codigo': (m.get('no_transaccion') or '').strip(),
            'descripcion': (m.get('descri_concepto') or m.get('no_transaccion') or '').strip(),
            'cantidad': 1, 'unidad': tt,
            'precio': monto,
            'descuento': ded,
            'itbis': ing,
            'total': ing - ded,
            # auxiliares específicos para {{#each}} si se quiere reescribir el HTML
            'tipo': 'Ingreso' if tt == 'I' else ('Deducción' if tt == 'D' else tt),
            'origen': (m.get('origen') or '').upper(),
            'monto_ingreso': ing,
            'monto_deduccion': ded,
        })
    salario = _money_or_zero(emp.get('salario_mensual'))
    bruto = sum_ing if sum_ing > 0 else salario
    neto = bruto - sum_ded

    estado_label = {'A': 'Abierta', 'C': 'Cerrada', 'P': 'Procesada'}.get(
        (nom.get('estado') or '').strip().upper(), nom.get('estado') or '',
    )
    doc = {
        'tipo': 'VOL', 'tipo_label': 'Volante de Pago',
        'no': f"{nomina}-{no_emp}",
        'numero_display': f"VOL-{nomina}-{str(no_emp).zfill(4)}",
        'fecha': str(nom.get('fecha_inicial') or '')[:10],
        'fecha_venc': str(nom.get('fecha_final') or '')[:10] if nom.get('fecha_final') else None,
        'estado': nom.get('estado') or '', 'estado_label': estado_label, 'anulada': False,
        'impresion': 'IMPRESA',
        'forma_pago': nom.get('forma_pago') or '',
        'condicion_pago': '', 'plazo_pago': 0,
        'vendedor': '',
        'nota': '', 'detalle': nom.get('descripcion') or '',
        'moneda': nom.get('tipo_moneda') or 'DOP', 'tasa': 0, 'porc_impuesto': 0,
        'periodo': f"{mes:02d}/{ano} P{periodo}",
        'nomina': nomina,
    }
    cliente = {
        'no': str(no_emp).zfill(4),
        'nombre': f"{(emp.get('nombre') or '').strip()} {(emp.get('apellido') or '').strip()}".strip(),
        'rnc': (emp.get('cedula') or '').strip(),
        'direccion': (emp.get('direccion') or '').strip(),
        'telefono': (emp.get('telefono') or '').strip(),
        'email': (emp.get('email') or '').strip(),
        'tipo_ncf': '',
        # Auxiliares específicos
        'cedula': (emp.get('cedula') or '').strip(),
        'nss': (emp.get('nss') or '').strip(),
        'cargo': (emp.get('cargo') or '').strip(),
        'gerencia': (emp.get('no_gerencia') or '').strip(),
        'area': (emp.get('no_area') or '').strip(),
        'depto': (emp.get('no_depto') or '').strip(),
        'salario_mensual': salario,
    }
    return JsonResponse({
        'cia': cia, 'doc': doc, 'cliente': cliente,
        'lineas': lineas,
        'totales': {
            'subtotal': salario,
            'descuento': sum_ded,
            'itbis': sum_ing,
            'propina': 0, 'otros': 0,
            'total': neto, 'monto_letras': '',
            'salario_base': salario,
            'total_ingresos': sum_ing,
            'total_deducciones': sum_ded,
            'bruto': bruto,
        }, 'extra': {
            'cuenta_bancaria': nom.get('cuenta_bancaria') or '',
            'moneda_label': 'US$' if (nom.get('tipo_moneda') == 'D') else 'RD$',
        },
    })


# ─── SDN — Informe de Nómina Fsdn207 (familia reporte) ───────────────────

@login_required
@require_http_methods(["GET"])
def sdn_informe_nomina_print_data(request):
    """GET /api/sdn/informe-nomina/print-data/?no_cia=01&punto=01&nomina=01&ano=2026&mes=5&periodo=1[&no_gerencia=&no_area=&no_depto=&no_empleado=]"""
    no_cia = request.GET.get('no_cia', '01')
    punto = _norm_punto = request.GET.get('punto', '01')
    cia = _cia_payload(no_cia, request=request)
    try:
        data = sdn_repo.rep_informe_nomina(
            no_cia=no_cia, punto=punto,
            nomina=(request.GET.get('nomina') or '').upper(),
            ano=int(request.GET.get('ano') or 0),
            mes=int(request.GET.get('mes') or 0),
            periodo=int(request.GET.get('periodo') or 1),
            no_empleado=int(request.GET.get('no_empleado') or 0) or None,
            no_gerencia=request.GET.get('no_gerencia') or None,
            no_area=request.GET.get('no_area') or None,
            no_depto=request.GET.get('no_depto') or None,
        )
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)
    filas = []
    for r in data.get('empleados') or []:
        filas.append({
            'no_empleado': str(r.get('no_empleado') or '').zfill(4),
            'nombre_empleado': r.get('nombre_empleado') or '',
            'cedula': r.get('cedula') or '',
            'no_gerencia': r.get('no_gerencia') or '',
            'no_area': r.get('no_area') or '',
            'no_depto': r.get('no_depto') or '',
            'salario_mensual': _money_or_zero(r.get('salario_mensual')),
            'total_ingresos': _money_or_zero(r.get('total_ingresos')),
            'total_deducciones': _money_or_zero(r.get('total_deducciones')),
            'bruto': _money_or_zero(r.get('bruto')),
            'neto': _money_or_zero(r.get('neto')),
        })
    cab = data.get('cabecera') or {}
    tot = data.get('totales') or {}
    filtros = {
        'Empresa': no_cia, 'Punto': punto,
        'Nómina': f"{cab.get('nomina','')} — {cab.get('descripcion','')}",
        'Período': f"{int(cab.get('mes_proceso') or 0):02d}/{cab.get('ano_proceso','')} P{cab.get('periodo','')}",
    }
    for k in ('no_gerencia', 'no_area', 'no_depto'):
        v = request.GET.get(k)
        if v: filtros[k.replace('no_', '').capitalize()] = v
    return JsonResponse({
        'cia': cia,
        'reporte': {
            'codigo': 'sdn-informe-nomina',
            'titulo': 'Informe de Nómina (Fsdn207)',
            'filtros': filtros,
        },
        'filas': filas,
        'totales': {
            'cantidad': int(tot.get('empleados') or 0),
            'salario': _money_or_zero(tot.get('salario')),
            'ingresos': _money_or_zero(tot.get('ingresos')),
            'deducciones': _money_or_zero(tot.get('deducciones')),
            'neto': _money_or_zero(tot.get('neto')),
            'total': _money_or_zero(tot.get('neto')),
        },
    })


# ─── SDN — RNC Empleados DGII (familia reporte) ──────────────────────────

@login_required
@require_http_methods(["GET"])
def sdn_rnc_empleados_print_data(request):
    """GET /api/sdn/rnc-empleados/print-data/?no_cia=01[&punto=&activos=1&search=]"""
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto') or None
    cia = _cia_payload(no_cia, request=request)
    activos_param = (request.GET.get('activos') or '1').strip()
    activos = activos_param in ('1', 'true', 'S', 'true', 'yes')
    search = request.GET.get('search') or ''
    rows = sdn_repo.rep_empleados_rnc(
        no_cia=no_cia, punto=punto, activos=activos, search=search,
    ) or []
    filas = []
    total_sal = 0.0
    for r in rows:
        sal = _money_or_zero(r.get('salario_mensual'))
        total_sal += sal
        filas.append({
            'no_empleado': str(r.get('no_empleado') or '').zfill(4),
            'cedula': r.get('cedula') or '',
            'nss': r.get('nss') or '',
            'nombre_completo': f"{(r.get('nombre') or '').strip()} {(r.get('apellido') or '').strip()}".strip(),
            'nomina': r.get('nomina') or '',
            'salario_mensual': sal,
            'afp': f"{r.get('no_afp') or ''} — {r.get('afp') or ''}".strip(' —'),
            'ars': f"{r.get('no_ars') or ''} — {r.get('ars') or ''}".strip(' —'),
            'fecha_ingreso': str(r.get('fecha_ingreso') or '')[:10],
            'fecha_egreso': str(r.get('fecha_egreso') or '')[:10] if r.get('fecha_egreso') else '',
        })
    return JsonResponse({
        'cia': cia,
        'reporte': {
            'codigo': 'sdn-rnc-empleados',
            'titulo': 'RNC Empleados (DGII/TSS)',
            'filtros': {
                'Empresa': no_cia,
                'Punto': punto or 'Todos',
                'Estado': 'Solo activos' if activos else 'Todos (activos + egresados)',
                **({'Búsqueda': search} if search else {}),
            },
        },
        'filas': filas,
        'totales': {
            'cantidad': len(filas),
            'masa_salarial': total_sal,
            'total': total_sal,
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
    # TACC_DOCUMENTO trae nombre_bene/valor/detalle (no beneficiario/monto);
    # las líneas contables viven en TACC_DCDOCU vía list_lineas_documento.
    anulada = (doc_full.get('anulado') or doc_full.get('st_anulado') or 'N') == 'S'
    doc = {
        'tipo': 'CC',
        'tipo_label': doc_full.get('desc_gasto') or 'Egreso de Caja Chica',
        'no': doc_full.get('no_docu'),
        'numero_display': f"ACC-{(doc_full.get('no_docu') or '').strip()}",
        'fecha': str(doc_full.get('fecha') or '')[:10],
        'estado': 'ANULADO' if anulada else 'ACTIVO',
        'anulada': anulada,
        'impresion': 'IMPRESA',
        'detalle': doc_full.get('detalle') or '',
        'nota': doc_full.get('detalle') or '',
        'ncf_dgi': (doc_full.get('ncf') or '').strip(),
        'forma_pago': '', 'condicion_pago': '', 'plazo_pago': 0,
        'vendedor': '', 'moneda': 'DOP', 'tasa': 0, 'porc_impuesto': 0,
    }
    total = _money_or_zero(doc_full.get('valor'))
    itbis = _money_or_zero(doc_full.get('impuesto'))
    lineas_cnt = acc_repo.list_lineas_documento(no_cia, punto, no_docu)
    lineas = [{
        'no_linea': i + 1,
        'codigo': (l.get('cuenta') or '').strip(),
        'descripcion': (doc_full.get('desc_gasto') or doc_full.get('detalle') or '')
                       + (f" · CC {l.get('centro_costo')}" if l.get('centro_costo') else ''),
        'cantidad': 1,
        'precio': _money_or_zero(l.get('monto')),
        'descuento': 0, 'itbis': 0,
        'total': _money_or_zero(l.get('monto')),
    } for i, l in enumerate(lineas_cnt)]
    if not lineas:
        lineas = [{
            'no_linea': 1, 'codigo': doc_full.get('tipo_gasto') or '',
            'descripcion': doc_full.get('desc_gasto') or doc_full.get('detalle') or 'Egreso',
            'cantidad': 1, 'precio': total, 'descuento': 0, 'itbis': itbis,
            'total': total,
        }]
    return JsonResponse({
        'cia': cia, 'doc': doc,
        'cliente': {
            'no': (doc_full.get('no_bene') or ''),
            'nombre': doc_full.get('nombre_bene') or '',
            'rnc': (doc_full.get('rnc') or '').strip(),
            'direccion': '', 'telefono': '', 'email': '', 'tipo_ncf': '',
        },
        'lineas': lineas,
        'totales': {
            'subtotal': round(total - itbis, 2), 'descuento': 0, 'itbis': itbis,
            'propina': 0, 'otros': 0, 'total': total, 'monto_letras': '',
        },
        'extra': {
            'no_caja': doc_full.get('no_caja') or '',
            'tipo_gasto': doc_full.get('tipo_gasto') or '',
            'no_reposicion': doc_full.get('no_reposicion') or '',
            'usuario': doc_full.get('usuario') or '',
        },
    })


# ─── CHC — Reportes (Bloque 5) ────────────────────────────────────────────

from apps.legacy.repositories import chc_repo as _chc_repo


@login_required
@require_http_methods(["GET"])
def chc_rep_movimientos_print_data(request):
    """GET /api/chc/rep-movimientos/print-data/?no_cia=01&punto=01&cuenta_banco=...&fecha_desde=YYYY-MM-DD&fecha_hasta=YYYY-MM-DD"""
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    cuenta_banco = request.GET.get('cuenta_banco') or ''
    fecha_desde = request.GET.get('fecha_desde') or ''
    fecha_hasta = request.GET.get('fecha_hasta') or ''
    cia = _cia_payload(no_cia, request=request)
    data = _chc_repo.rep_movimientos_cuenta(
        no_cia=no_cia, punto=punto, cuenta_banco=cuenta_banco,
        fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
    )
    filas = []
    for m in data['movimientos']:
        anul = bool(m.get('anulado'))
        if anul:
            estado = 'NULO'
        elif (m.get('conciliado') or 'N') == 'S':
            estado = 'CONC'
        else:
            estado = 'ACT'
        filas.append({
            'fecha': m.get('fecha') or '',
            'tipo_docu': m.get('tipo_docu') or '',
            'no_docu': (m.get('no_docu') or '').strip(),
            'beneficiario': m.get('beneficiario') or m.get('nombre_proveedor') or '',
            'detalle1': m.get('detalle1') or '',
            'debito': _money_or_zero(m.get('debito')),
            'credito': _money_or_zero(m.get('credito')),
            'saldo': _money_or_zero(m.get('saldo')),
            'estado': estado,
        })
    return JsonResponse({
        'cia': cia,
        'reporte': {
            'codigo': 'chc-rep-movimientos',
            'titulo': 'Movimiento de Cuenta Bancaria',
            'filtros': {
                'Empresa': no_cia, 'Punto': punto,
                'Cuenta': cuenta_banco,
                'Moneda': 'RD$' if (data.get('moneda') or 'P') == 'P' else 'US$',
                'Desde': fecha_desde, 'Hasta': fecha_hasta,
            },
        },
        'filas': filas,
        'totales': {
            'cantidad': data['totales']['cantidad'],
            'saldo_inicial': data['saldo_inicial'],
            'total_debito': data['totales']['total_debito'],
            'total_credito': data['totales']['total_credito'],
            'saldo_final': data['totales']['saldo_final'],
        },
    })


@login_required
@require_http_methods(["GET"])
def chc_rep_diario_print_data(request):
    """GET /api/chc/rep-diario/print-data/?no_cia=01&punto=01&fecha_desde=...&fecha_hasta=..."""
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    fecha_desde = request.GET.get('fecha_desde') or ''
    fecha_hasta = request.GET.get('fecha_hasta') or ''
    cuenta_banco = request.GET.get('cuenta_banco') or None
    tipo_docu = request.GET.get('tipo_docu') or None
    status = request.GET.get('status') or None
    cia = _cia_payload(no_cia, request=request)
    data = _chc_repo.rep_diario_cheques(
        no_cia=no_cia, punto=punto,
        fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
        cuenta_banco=cuenta_banco, tipo_docu=tipo_docu, status=status,
    )
    filas = []
    for m in data['movimientos']:
        anul = bool(m.get('anulado'))
        if anul:
            estado = 'NULO'
        elif (m.get('conciliado') or 'N') == 'S':
            estado = 'CONC'
        else:
            estado = 'ACT'
        filas.append({
            'cuenta_banco': m.get('cuenta_banco') or '',
            'nombre_cuenta': m.get('nombre_cuenta') or '',
            'fecha': m.get('fecha') or '',
            'tipo_docu': m.get('tipo_docu') or '',
            'no_docu': (m.get('no_docu') or '').strip(),
            'beneficiario': m.get('beneficiario') or m.get('nombre_proveedor') or '',
            'no_proveedor': (m.get('no_proveedor') or ''),
            'detalle1': m.get('detalle1') or '',
            'debito': _money_or_zero(m.get('debito')),
            'credito': _money_or_zero(m.get('credito')),
            'estado': estado,
        })
    filtros = {'Empresa': no_cia, 'Punto': punto, 'Desde': fecha_desde, 'Hasta': fecha_hasta}
    if cuenta_banco:
        filtros['Cuenta'] = cuenta_banco
    if tipo_docu:
        filtros['Tipo doc.'] = tipo_docu
    if status:
        filtros['Status'] = 'Activos' if status == 'A' else 'Nulos'
    return JsonResponse({
        'cia': cia,
        'reporte': {
            'codigo': 'chc-rep-diario',
            'titulo': 'Libro Diario de Debito/Credito Bancos',
            'filtros': filtros,
        },
        'filas': filas,
        'totales': {
            'cantidad': data['totales']['cantidad'],
            'activos': data['totales']['activos'],
            'nulos': data['totales']['nulos'],
            'total_debito': data['totales']['total_debito'],
            'total_credito': data['totales']['total_credito'],
            'neto': data['totales']['neto'],
        },
    })


@login_required
@require_http_methods(["GET"])
def chc_rep_disponibilidad_print_data(request):
    """GET /api/chc/rep-disponibilidad/print-data/?no_cia=01[&punto=01]"""
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto') or None
    cia = _cia_payload(no_cia, request=request)
    rows = _chc_repo.rep_disponibilidad(no_cia, punto)
    filas = []
    tot_saldo_dop = tot_che_pe_dop = tot_disp_dop = 0.0
    for c in rows:
        saldo = _money_or_zero(c.get('saldo_aprox'))
        che_pe = _money_or_zero(c.get('che_por_entregar'))
        disp = _money_or_zero(c.get('disponible_neto'))
        if (c.get('moneda') or 'P') == 'P':
            tot_saldo_dop += saldo
            tot_che_pe_dop += che_pe
            tot_disp_dop += disp
        filas.append({
            'cuenta_banco': c.get('cuenta_banco') or '',
            'moneda': 'RD$' if (c.get('moneda') or 'P') == 'P' else 'US$',
            'periodo': f"{str(c.get('mes_proceso') or '').zfill(2)}/{c.get('ano_proceso') or ''}",
            'saldo_aprox': saldo,
            'che_por_entregar': che_pe,
            'disponible_neto': disp,
        })
    filtros = {'Empresa': no_cia}
    if punto:
        filtros['Punto'] = punto
    return JsonResponse({
        'cia': cia,
        'reporte': {
            'codigo': 'chc-rep-disponibilidad',
            'titulo': 'Disponibilidad Bancaria',
            'filtros': filtros,
        },
        'filas': filas,
        'totales': {
            'cantidad': len(filas),
            'total_saldo_dop': round(tot_saldo_dop, 2),
            'total_che_por_entregar_dop': round(tot_che_pe_dop, 2),
            'total_disponible_dop': round(tot_disp_dop, 2),
        },
    })


@login_required
@require_http_methods(["GET"])
def chc_rep_cheques_print_data(request):
    """Rchc503 — Listado de cheques/movimientos por cuenta.
    GET /api/chc/cheques/print-data/?no_cia=&punto=&cuenta_banco=&status=&conciliado=&entregado=&fecha_desde=&fecha_hasta="""
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    g = request.GET
    rows = _chc_repo.list_cheques(
        no_cia=no_cia, punto=punto,
        cuenta_banco=g.get('cuenta_banco') or None,
        status=g.get('status') or None,
        conciliado=g.get('conciliado') or None,
        entregado=g.get('entregado') or None,
        fecha_desde=g.get('fecha_desde') or None,
        fecha_hasta=g.get('fecha_hasta') or None,
        limit=int(g.get('limit', 500)),
    )
    filas = []
    tot_valor = 0.0
    for c in rows:
        valor = _money_or_zero(c.get('valor_original'))
        if (c.get('st_nulo') or 'A') == 'A':
            tot_valor += valor
        filas.append({
            'documento': (c.get('tipo_docu') or '') + '-' + (c.get('no_docu') or '').strip(),
            'fecha': str(c.get('fecha_cheque') or c.get('fecha_solicitud') or '')[:10],
            'cuenta_banco': c.get('cuenta_banco') or '',
            'beneficiario': c.get('beneficiario') or '',
            'valor': valor,
            'estado': 'NULO' if (c.get('st_nulo') or 'A') != 'A' else (
                'CONCILIADO' if (c.get('conciliado') or 'N') == 'S' else 'ACTIVO'),
            'entregado': 'Sí' if (c.get('entregado') or 'N') == 'S' else '',
        })
    filtros = {'Empresa': no_cia, 'Punto': punto}
    for label, key in (('Cuenta', 'cuenta_banco'), ('Estado', 'status'),
                       ('Desde', 'fecha_desde'), ('Hasta', 'fecha_hasta')):
        if g.get(key):
            filtros[label] = g.get(key)
    return JsonResponse({
        'cia': _cia_payload(no_cia, request=request),
        'reporte': {'codigo': 'chc-rep-cheques',
                    'titulo': 'Listado de Cheques y Movimientos Bancarios',
                    'filtros': filtros},
        'filas': filas,
        'totales': {'cantidad': len(filas), 'total': round(tot_valor, 2)},
    })


# ─── CXP — Reportes (rcxp201/202/306/308 etc. → familia 'reporte') ──────────


def _fd(v):
    """Fecha a YYYY-MM-DD para filas de reporte."""
    return str(v)[:10] if v else ''


@login_required
@require_http_methods(["GET"])
def cxp_rep_alfabetico_print_data(request):
    """GET /api/cxp/rep-alfabetico/print-data/?no_cia=&punto=&search="""
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    search = request.GET.get('search') or ''
    data = cxp_repo.rep_alfabetico(no_cia, punto, search)
    filas = [{
        'no_proveedor': i.get('no_proveedor') or '',
        'nombre': i.get('nombre') or '',
        'rnc': i.get('rnc') or '',
        'telefono': i.get('telefono') or '',
        'compras': _money_or_zero(i.get('compras')),
        'pagos': _money_or_zero(i.get('pagos')),
        'saldo': _money_or_zero(i.get('saldo')),
    } for i in data['items']]
    filtros = {'Empresa': no_cia, 'Punto': punto}
    if search:
        filtros['Busqueda'] = search
    return JsonResponse({
        'cia': _cia_payload(no_cia, request=request),
        'reporte': {'codigo': 'cxp-rep-alfabetico',
                    'titulo': 'Listado Alfabético de Proveedores',
                    'filtros': filtros},
        'filas': filas,
        'totales': {'cantidad': data['count'],
                    'total': round(sum(f['saldo'] for f in filas), 2)},
    })


@login_required
@require_http_methods(["GET"])
def cxp_rep_mayor_print_data(request):
    """GET /api/cxp/rep-mayor/print-data/?no_cia=&punto=&desde=&hasta=&no_proveedor="""
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    desde = request.GET.get('desde') or ''
    hasta = request.GET.get('hasta') or ''
    no_proveedor = request.GET.get('no_proveedor') or ''
    data = cxp_repo.rep_mayor_auxiliar(no_cia, punto, desde, hasta, no_proveedor)
    filas = [{
        'no_proveedor': i.get('no_proveedor') or '',
        'nombre': i.get('nombre_proveedor') or '',
        'documento': (i.get('tipo_docu') or '') + '-' + (i.get('no_docu') or ''),
        'fecha': _fd(i.get('fecha')),
        'detalle': i.get('detalle') or '',
        'debito': _money_or_zero(i.get('debito')),
        'credito': _money_or_zero(i.get('credito')),
        'saldo': _money_or_zero(i.get('saldo')),
    } for i in data['items']]
    filtros = {'Empresa': no_cia, 'Punto': punto, 'Desde': desde, 'Hasta': hasta}
    if no_proveedor:
        filtros['Proveedor'] = no_proveedor
    return JsonResponse({
        'cia': _cia_payload(no_cia, request=request),
        'reporte': {'codigo': 'cxp-rep-mayor',
                    'titulo': 'Mayor Auxiliar de Cuentas por Pagar',
                    'filtros': filtros},
        'filas': filas,
        'totales': {'cantidad': len(filas),
                    'total_debito': _money_or_zero(data.get('total_debito')),
                    'total_credito': _money_or_zero(data.get('total_credito'))},
    })


@login_required
@require_http_methods(["GET"])
def cxp_rep_606_print_data(request):
    """GET /api/cxp/rep-606/print-data/?no_cia=&punto=&anio=&mes="""
    import datetime as _dt
    hoy = _dt.date.today()
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto') or ''
    anio = int(request.GET.get('anio', hoy.year))
    mes = int(request.GET.get('mes', hoy.month))
    data = cxp_repo.rep_606(no_cia, anio, mes, punto)
    filas = [{
        'rnc': i.get('rnc_proveedor') or '',
        'nombre': i.get('nombre_proveedor') or '',
        'ncf': (_compose_ncf_dgi(i.get('tipo_ncf'), i.get('ncf'))
                or (str(i['ncf']) if i.get('ncf') else '')),
        'fecha': _fd(i.get('fecha')),
        'monto_facturado': _money_or_zero(i.get('monto_facturado')),
        'itbis_facturado': _money_or_zero(i.get('itbis_facturado')),
        'itbis_retenido': _money_or_zero(i.get('itbis_retenido')),
        'isr_retenido': _money_or_zero(i.get('isr_retenido')),
    } for i in data['items']]
    return JsonResponse({
        'cia': _cia_payload(no_cia, request=request),
        'reporte': {'codigo': 'cxp-rep-606',
                    'titulo': '606 — Compras de Bienes y Servicios %02d/%d' % (mes, anio),
                    'filtros': {'Empresa': no_cia, 'Ano': anio, 'Mes': mes}},
        'filas': filas,
        'totales': {'cantidad': data['count'],
                    'total_monto': _money_or_zero(data.get('total_monto')),
                    'total_itbis': _money_or_zero(data.get('total_itbis'))},
    })


@login_required
@require_http_methods(["GET"])
def cxp_rep_607_print_data(request):
    """GET /api/cxp/rep-607/print-data/?no_cia=&punto=&anio=&mes="""
    import datetime as _dt
    hoy = _dt.date.today()
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto') or ''
    anio = int(request.GET.get('anio', hoy.year))
    mes = int(request.GET.get('mes', hoy.month))
    data = cxp_repo.rep_607(no_cia, anio, mes, punto)
    filas = [{
        'rnc': i.get('rnc_proveedor') or '',
        'nombre': i.get('nombre_proveedor') or '',
        'ncf': i.get('ncf') or '',
        'fecha': _fd(i.get('fecha')),
        'monto_pago': _money_or_zero(i.get('monto_pago')),
        'isr_retenido': _money_or_zero(i.get('isr_retenido')),
        'itbis_retenido': _money_or_zero(i.get('itbis_retenido')),
    } for i in data['items']]
    return JsonResponse({
        'cia': _cia_payload(no_cia, request=request),
        'reporte': {'codigo': 'cxp-rep-607',
                    'titulo': '607 — Retenciones del ISR %02d/%d' % (mes, anio),
                    'filtros': {'Empresa': no_cia, 'Ano': anio, 'Mes': mes}},
        'filas': filas,
        'totales': {'cantidad': data['count'],
                    'total_isr': _money_or_zero(data.get('total_isr')),
                    'total_itbis': _money_or_zero(data.get('total_itbis'))},
    })


@login_required
@require_http_methods(["GET"])
def cxp_rep_cuadre_print_data(request):
    """GET /api/cxp/rep-cuadre/print-data/?no_cia=&punto=&mes=&ano="""
    import datetime as _dt
    hoy = _dt.date.today()
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    mes = int(request.GET.get('mes', hoy.month))
    ano = int(request.GET.get('ano', hoy.year))
    data = cxp_repo.rep_cuadre(no_cia, punto, mes, ano)
    filas = [{
        'cuenta': i.get('cuenta') or '',
        'docs': i.get('docs') or 0,
        'debe': _money_or_zero(i.get('debe')),
        'haber': _money_or_zero(i.get('haber')),
    } for i in data['items']]
    return JsonResponse({
        'cia': _cia_payload(no_cia, request=request),
        'reporte': {'codigo': 'cxp-rep-cuadre',
                    'titulo': 'Cuadre Contable CxP %02d/%d' % (mes, ano),
                    'filtros': {'Empresa': no_cia, 'Punto': punto,
                                'Mes': mes, 'Ano': ano}},
        'filas': filas,
        'totales': {'cantidad': len(filas),
                    'total_debe': _money_or_zero(data.get('total_debe')),
                    'total_haber': _money_or_zero(data.get('total_haber')),
                    'diferencia': _money_or_zero(data.get('diferencia'))},
    })


@login_required
@require_http_methods(["GET"])
def cxp_rep_retenciones_print_data(request):
    """GET /api/cxp/rep-retenciones/print-data/?no_cia=&punto=&ano=&no_proveedor="""
    import datetime as _dt
    hoy = _dt.date.today()
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    ano = int(request.GET.get('ano', hoy.year))
    no_proveedor = request.GET.get('no_proveedor') or ''
    data = cxp_repo.rep_retenciones(no_cia, punto, ano, no_proveedor)
    filas = [{
        'no_proveedor': p.get('no_proveedor') or '',
        'nombre': p.get('nombre_proveedor') or '',
        'rnc': p.get('rnc_proveedor') or '',
        'documentos': len(p.get('documentos') or []),
        'total_itbis': _money_or_zero(p.get('total_itbis')),
        'total_isr': _money_or_zero(p.get('total_isr')),
    } for p in data['proveedores']]
    filtros = {'Empresa': no_cia, 'Punto': punto, 'Ano': ano}
    if no_proveedor:
        filtros['Proveedor'] = no_proveedor
    return JsonResponse({
        'cia': _cia_payload(no_cia, request=request),
        'reporte': {'codigo': 'cxp-rep-retenciones',
                    'titulo': 'Retenciones a Proveedores %d' % ano,
                    'filtros': filtros},
        'filas': filas,
        'totales': {'cantidad': data['count_docs'],
                    'total_itbis': _money_or_zero(data.get('total_itbis')),
                    'total_isr': _money_or_zero(data.get('total_isr'))},
    })


@login_required
@require_http_methods(["GET"])
def cxp_rep_envejecimiento_print_data(request):
    """GET /api/cxp/rep-envejecimiento/print-data/?no_cia=&punto="""
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    rows = cxp_repo.get_aging(no_cia, punto)
    filas = [{
        'no_proveedor': i.get('no_proveedor') or '',
        'nombre': i.get('nombre') or '',
        'corriente': _money_or_zero(i.get('corriente')),
        'd30': _money_or_zero(i.get('d30')),
        'd60': _money_or_zero(i.get('d60')),
        'd90': _money_or_zero(i.get('d90')),
        'mas90': _money_or_zero(i.get('mas90')),
        'total': _money_or_zero(i.get('total')),
    } for i in rows]
    return JsonResponse({
        'cia': _cia_payload(no_cia, request=request),
        'reporte': {'codigo': 'cxp-rep-envejecimiento',
                    'titulo': 'Antigüedad de Saldos CxP',
                    'filtros': {'Empresa': no_cia, 'Punto': punto}},
        'filas': filas,
        'totales': {'cantidad': len(filas),
                    'total': round(sum(f['total'] for f in filas), 2)},
    })


# ─── CXC — Reportes (familia 'reporte') ───────────────────────────────────


@login_required
@require_http_methods(["GET"])
def cxc_rep_envejecimiento_print_data(request):
    """GET /api/cxc/rep-envejecimiento/print-data/?no_cia=&punto=&vendedor=&fecha_corte="""
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto') or ''
    vendedor = request.GET.get('vendedor') or ''
    fecha_corte = request.GET.get('fecha_corte') or ''
    data = cxc_repo.rep_envejecimiento(no_cia, punto, vendedor, fecha_corte)
    filas = [{
        'no_cliente': i.get('no_cliente') or '',
        'nombre_cliente': i.get('nombre_cliente') or '',
        'vendedor': i.get('vendedor') or '',
        'c0': _money_or_zero(i.get('c0')),
        'c30': _money_or_zero(i.get('c30')),
        'c60': _money_or_zero(i.get('c60')),
        'c90': _money_or_zero(i.get('c90')),
        'c120': _money_or_zero(i.get('c120')),
        'total': _money_or_zero(i.get('total')),
    } for i in data.get('items', [])]
    filtros = {'Empresa': no_cia}
    if punto:
        filtros['Punto'] = punto
    if vendedor:
        filtros['Vendedor'] = vendedor
    if fecha_corte:
        filtros['Corte'] = fecha_corte
    return JsonResponse({
        'cia': _cia_payload(no_cia, request=request),
        'reporte': {'codigo': 'cxc-rep-envejecimiento',
                    'titulo': 'Antigüedad de Saldos CxC',
                    'filtros': filtros},
        'filas': filas,
        'totales': {'cantidad': len(filas),
                    'total': _money_or_zero(data.get('total'))},
    })


@login_required
@require_http_methods(["GET"])
def cxc_balance_clientes_print_data(request):
    """GET /api/cxc/balance-clientes/print-data/?no_cia=&punto="""
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto') or None
    rows = cxc_repo.balance_clientes(no_cia, punto)
    filas = [{
        'no_cliente': i.get('no_cliente') or '',
        'nombre_cliente': i.get('nombre_cliente') or '',
        'vendedor': i.get('vendedor') or '',
        'dias_0_30': _money_or_zero(i.get('dias_0_30')),
        'dias_31_60': _money_or_zero(i.get('dias_31_60')),
        'dias_61_90': _money_or_zero(i.get('dias_61_90')),
        'mas_90': _money_or_zero(i.get('mas_90')),
        'total_saldo': _money_or_zero(i.get('total_saldo')),
    } for i in rows]
    filtros = {'Empresa': no_cia}
    if punto:
        filtros['Punto'] = punto
    return JsonResponse({
        'cia': _cia_payload(no_cia, request=request),
        'reporte': {'codigo': 'cxc-balance-clientes',
                    'titulo': 'Balance de Clientes (Documentos por Cobrar)',
                    'filtros': filtros},
        'filas': filas,
        'totales': {'cantidad': len(filas),
                    'total': round(sum(f['total_saldo'] for f in filas), 2)},
    })


@login_required
@require_http_methods(["GET"])
def cxc_rep_ncf_print_data(request):
    """GET /api/cxc/rep-ncf/print-data/?no_cia=&desde=&hasta=&punto="""
    no_cia = request.GET.get('no_cia', '01')
    desde = request.GET.get('desde') or ''
    hasta = request.GET.get('hasta') or ''
    punto = request.GET.get('punto') or ''
    data = cxc_repo.rep_ncf_emitidos(no_cia, desde, hasta, punto)
    filas = [{
        'fecha': str(i.get('fecha') or '')[:10],
        'ncf': str(i.get('ncf') or '').strip(),
        'tipo_doc': str(i.get('tipo_doc') or ''),
        'no_doc': str(i.get('no_doc') or '').strip(),
        'no_cliente': str(i.get('no_cliente') or ''),
        'nombre_cliente': i.get('nombre_cliente') or '',
        'rnc': str(i.get('rnc') or '').strip(),
        'valor': _money_or_zero(i.get('valor')),
        'estado': 'ANULADO' if i.get('estado') == 'R' else 'ACTIVO',
    } for i in data.get('items', [])]
    return JsonResponse({
        'cia': _cia_payload(no_cia, request=request),
        'reporte': {'codigo': 'cxc-rep-ncf',
                    'titulo': 'NCF Emitidos por Período',
                    'filtros': {'Empresa': no_cia, 'Desde': desde, 'Hasta': hasta}},
        'filas': filas,
        'totales': {'cantidad': len(filas),
                    'total': _money_or_zero(data.get('total'))},
    })


@login_required
@require_http_methods(["GET"])
def cxc_rep_cobros_vendedor_print_data(request):
    """GET /api/cxc/rep-cobros-vendedor/print-data/?no_cia=&desde=&hasta=&punto="""
    no_cia = request.GET.get('no_cia', '01')
    desde = request.GET.get('desde') or ''
    hasta = request.GET.get('hasta') or ''
    punto = request.GET.get('punto') or ''
    data = cxc_repo.rep_cobros_vendedor(no_cia, desde, hasta, punto)
    filas = [{
        'vendedor': i.get('vendedor') or '',
        'nombre_vendedor': i.get('nombre_vendedor') or '',
        'cobros': int(i.get('cobros') or 0),
        'total_cobrado': _money_or_zero(i.get('total_cobrado')),
    } for i in data.get('items', [])]
    return JsonResponse({
        'cia': _cia_payload(no_cia, request=request),
        'reporte': {'codigo': 'cxc-rep-cobros-vendedor',
                    'titulo': 'Ingresos / Cobros por Vendedor (Rcxc302)',
                    'filtros': {'Empresa': no_cia, 'Desde': desde, 'Hasta': hasta}},
        'filas': filas,
        'totales': {'cantidad': len(filas),
                    'total': _money_or_zero(data.get('total'))},
    })


@login_required
@require_http_methods(["GET"])
def cxc_listado_documentos_print_data(request):
    """GET /api/cxc/documentos/listado/print-data/?no_cia=&tipo_doc=&estado=&desde=&hasta=

    Listados DR/CR del legado (rcxc204/rcxc207/Rcxc309) — usa los mismos
    filtros de la consulta de documentos.
    """
    no_cia = request.GET.get('no_cia', '01')
    params = {
        'no_cia': no_cia,
        'punto': request.GET.get('punto') or None,
        'tipo_doc': request.GET.get('tipo_doc') or None,
        'no_cliente': request.GET.get('no_cliente') or None,
        'desde': request.GET.get('desde') or None,
        'hasta': request.GET.get('hasta') or None,
        'estado': request.GET.get('estado') or None,
        'page': 1,
    }
    params = {k: v for k, v in params.items() if v is not None}
    data = cxc_repo.list_documentos(**params)
    filas = [{
        'no_doc': str(i.get('no_doc') or '').strip(),
        'tipo_doc': str(i.get('tipo_doc') or ''),
        'fecha': str(i.get('fecha') or '')[:10],
        'no_cliente': str(i.get('no_cliente') or ''),
        'nombre_cliente': i.get('nombre_cliente') or '',
        'ncf': str(i.get('ncf') or '').strip(),
        'detalle': i.get('detalle') or '',
        'valor': _money_or_zero(i.get('valor')),
        'saldo': _money_or_zero(i.get('saldo')),
        'estado': i.get('estado') or '',
    } for i in (data.get('items') or [])]
    filtros = {'Empresa': no_cia}
    for k, lbl in (('tipo_doc', 'Tipo'), ('desde', 'Desde'), ('hasta', 'Hasta'),
                   ('estado', 'Estado'), ('no_cliente', 'Cliente')):
        if request.GET.get(k):
            filtros[lbl] = request.GET.get(k)
    return JsonResponse({
        'cia': _cia_payload(no_cia, request=request),
        'reporte': {'codigo': 'cxc-listado-documentos',
                    'titulo': 'Listado de Documentos CxC',
                    'filtros': filtros},
        'filas': filas,
        'totales': {'cantidad': len(filas),
                    'total_valor': round(sum(f['valor'] for f in filas), 2),
                    'total_saldo': round(sum(f['saldo'] for f in filas), 2)},
    })
