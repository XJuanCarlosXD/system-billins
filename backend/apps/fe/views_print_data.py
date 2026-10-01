"""Endpoint ``print-data`` para la Representacion Impresa (RI) de un e-CF
-- Fase 5 de la Postulacion 81443 de certificacion DGII.

El PDF en si se arma en el frontend con Puck (plantilla
``defaults/ecf-representacion-impresa.ts``); este endpoint solo devuelve el
JSON con los datos ya resueltos: encabezado de empresa, cliente, lineas,
totales, y los campos fiscales que van al QR.

Reusa deliberadamente ``apps.fat.views_print_data._cia_payload`` (para
que el encabezado de empresa salga igual que en una factura FAT normal) y
``apps.legacy.repositories.fat_repo.get_factura`` (para que las lineas,
totales y cliente sean los MISMOS que la factura real que origino el e-CF
-- la DGII revisa que la RI corresponda al e-CF enviado).
"""
from __future__ import annotations

import json

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from apps.fat.views_print_data import (
    NCF_DESCRIPCION,
    _cia_payload,
    _money,
    _numero_a_letras,
)
from apps.fe.ecf_builder import ECFBuilderError, derivar_codigo_seguridad
from apps.fe.representacion_impresa import armar_qr_url
from apps.legacy.repositories import fat_repo, fe_repo
from apps.legacy.repositories import cxc_repo


# Hoy toda la Fase 5 corre en certecf -- cuando se migre a produccion esto
# tiene que leerse de TFE_CONFIG.ambiente de la cia del documento.
_AMBIENTE_RI = 'certecf'


def _err(msg: str, status: int = 400) -> JsonResponse:
    return JsonResponse({'detail': str(msg)}, status=status)


@login_required
@require_http_methods(["GET"])
def fe_documento_ri_print_data(request, e_ncf: str):
    """GET /api/fe/documentos/<e_ncf>/representacion-impresa/print-data/

    Devuelve el JSON que el frontend Puck usa para pintar la RI del e-CF.
    """
    no_cia = request.GET.get('no_cia', '01')
    e_ncf = (e_ncf or '').strip().upper()

    doc_tfe = fe_repo.get_documento(no_cia, e_ncf)
    if not doc_tfe:
        return _err('e-NCF no encontrado en la bitacora', status=404)

    xml_firmado = (doc_tfe.get('xml_firmado') or '').strip()
    if not xml_firmado:
        return _err(
            'El e-NCF no tiene XML firmado almacenado -- probablemente nunca '
            'se envio o fue borrado despues del envio (no se puede generar RI)',
            status=400)

    # Campos fiscales que van al QR -- SIEMPRE desde el XML firmado (fuente
    # de verdad: lo que la DGII tiene). codigo_seguridad en TFE_DOCUMENTO se
    # llena hoy solo para RFCE; para e-CF normal se deriva aqui.
    try:
        qr_url = armar_qr_url(xml_firmado, ambiente=_AMBIENTE_RI)
        codigo_seguridad = (
            doc_tfe.get('codigo_seguridad') or ''
        ).strip() or derivar_codigo_seguridad(xml_firmado)
    except ECFBuilderError as exc:
        return _err(f'XML firmado invalido: {exc}', status=500)

    # Factura real que origino el e-CF -- las lineas y totales del PDF
    # tienen que coincidir con lo firmado, asi que leemos la factura FAT
    # original por (no_cia, punto, tipo_docu, no_docu) guardados en
    # TFE_DOCUMENTO al momento del envio.
    punto = (doc_tfe.get('punto') or '01').strip() or '01'
    tipo_docu = (doc_tfe.get('tipo_docu') or '').strip().upper()
    no_docu = (doc_tfe.get('no_docu') or '').strip()
    factura = None
    if tipo_docu and no_docu:
        try:
            factura = fat_repo.get_factura(no_cia, punto, tipo_docu, no_docu)
        except Exception:
            factura = None

    cia = _cia_payload(no_cia, request=request)

    if factura is None:
        # Puede pasar en los e-CF del Paso 2/4 que se enviaron desde el Set
        # de Pruebas de la DGII (payload sintetico, sin factura FAT real
        # detras). La RI de esos NO se pide en la Fase 5, pero devolvemos
        # un shape minimo utilizable igual.
        return JsonResponse({
            'cia': cia,
            'doc': {
                'tipo': tipo_docu, 'tipo_label': 'e-CF',
                'numero_display': e_ncf,
                'fecha': (doc_tfe.get('fecha_firma') or '')[:10],
                'ncf_dgi': e_ncf,
                'anulada': False,
            },
            'cliente': {
                'nombre': '', 'rnc': (doc_tfe.get('rnc_comprador') or '').strip(),
                'direccion': '', 'telefono': '',
            },
            'lineas': [],
            'totales': {
                'subtotal': _money(doc_tfe.get('monto_total')),
                'descuento': 0, 'itbis': 0, 'propina': 0,
                'total': _money(doc_tfe.get('monto_total')),
                'monto_letras': _numero_a_letras(
                    _money(doc_tfe.get('monto_total'))),
            },
            'ecf': {
                'e_ncf': e_ncf,
                'tipo_ecf': (doc_tfe.get('tipo_ecf') or '').strip(),
                'ambiente': _AMBIENTE_RI,
                'qr_url': qr_url,
                'codigo_seguridad': codigo_seguridad,
                'fecha_firma': (doc_tfe.get('fecha_firma') or ''),
            },
        })

    # Camino normal: factura FAT real detras del e-CF. Replicamos el shape
    # de ``fat_factura_print_data`` para que el frontend pueda reutilizar
    # los mismos helpers Handlebars (formatMoney, cliente.*, lineas[]...).
    no_cliente_str = str(factura.get('no_cliente') or '')
    cliente_row = cxc_repo.get_cliente(no_cia, no_cliente_str, punto) or {}

    tipo_ncf_fiscal = (
        factura.get('posiciones_fijas_ncf')
        or factura.get('tipo_ncf_fiscal') or '').strip().upper()
    ncf_descripcion = NCF_DESCRIPCION.get(tipo_ncf_fiscal, '')

    doc = {
        'tipo': tipo_docu,
        'tipo_label': {
            'FC': 'Factura Credito', 'FT': 'Factura Contado',
            'NC': 'Nota de Credito', 'ND': 'Nota de Debito',
            'DV': 'Devolucion', 'AF': 'Ajuste Factura',
        }.get(tipo_docu, f'Documento {tipo_docu}'),
        'no': factura.get('no_factura'),
        'numero_display': f"{tipo_docu}-{factura.get('no_factura')}",
        'fecha': factura.get('fecha'),
        'ncf': factura.get('ncf'),
        'ncf_dgi': factura.get('ncf_dgi') or e_ncf,
        'tipo_ncf': tipo_ncf_fiscal,
        'tipo_ncf_label': (
            f"{tipo_ncf_fiscal} - {ncf_descripcion}"
            if tipo_ncf_fiscal and ncf_descripcion else tipo_ncf_fiscal),
        'estado': factura.get('estado') or 'P',
        'anulada': (factura.get('st_anulado') or 'N') == 'S',
        'condicion_pago': '',
        'forma_pago': (factura.get('forma_pago') or '').strip(),
        'vendedor': (factura.get('vendedor') or '').strip(),
        'nota': factura.get('nota') or '',
        'detalle': factura.get('detalle') or '',
        'moneda': 'DOP',
    }

    cliente = {
        'no': factura.get('no_cliente'),
        'nombre': (
            factura.get('nombre_cliente_factura')
            or factura.get('nombre_cliente')
            or cliente_row.get('nombre') or '').strip() or '(sin nombre)',
        'rnc': (
            factura.get('rnc_factura')
            or cliente_row.get('rnc') or '').strip(),
        'direccion': (cliente_row.get('direccion') or '').strip(),
        'telefono': (cliente_row.get('telefono') or '').strip(),
        'email': (cliente_row.get('email') or '').strip(),
    }

    lineas = []
    for l in (factura.get('lineas') or []):
        if (l.get('st_anulado') or 'N') == 'S':
            continue
        lineas.append({
            'no_linea': l.get('no_linea'),
            'codigo': l.get('no_produ') or '',
            'descripcion': l.get('descripcion') or '',
            'cantidad': _money(l.get('cantidad')),
            'precio': _money(l.get('precio')),
            'descuento': _money(l.get('descuento')),
            'itbis': _money(l.get('impuesto')),
            'total': _money(l.get('monto_neto')),
        })

    subtotal = _money(factura.get('total_linea'))
    descuento = _money(factura.get('descuento'))
    itbis = _money(factura.get('impuesto'))
    propina = _money(factura.get('propina'))
    total = _money(factura.get('total_neto'))
    totales = {
        'subtotal': subtotal, 'descuento': descuento, 'itbis': itbis,
        'propina': propina, 'otros': 0.0, 'total': total,
        'monto_letras': _numero_a_letras(total),
    }

    return JsonResponse({
        'cia': cia,
        'doc': doc,
        'cliente': cliente,
        'lineas': lineas,
        'totales': totales,
        'ecf': {
            'e_ncf': e_ncf,
            'tipo_ecf': (doc_tfe.get('tipo_ecf') or '').strip(),
            'ambiente': _AMBIENTE_RI,
            'qr_url': qr_url,
            'codigo_seguridad': codigo_seguridad,
            'fecha_firma': (doc_tfe.get('fecha_firma') or ''),
        },
    })
