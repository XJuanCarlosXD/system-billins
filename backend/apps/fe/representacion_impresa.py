"""Helpers para la Representacion Impresa (RI) de e-CF -- Fase 5 de la
Postulacion 81443 de certificacion DGII.

El contenido del QR de la RI se arma SERVER-SIDE desde el XML YA FIRMADO
(fuente de verdad: lo que la DGII tiene). Dos formatos distintos:

- e-CF normales (31, 32>=250K, 33, 34, 41, 43, 44, 45, 46, 47): URL con
  7 query params (rncemisor, rnccomprador, encf, fechaemision, montototal,
  fechafirma, codigoseguridad) contra ``.../consultatimbre``.
- RFCE (tipo 32 con MontoTotal<250K): URL con 4 query params (rncemisor,
  encf, montototal, codigoseguridad) contra ``.../consultatimbrefc``.

Fuente del formato: ``Descripcion-Tecnica-Servicios-DGII.pdf`` paginas
40-43 (ver plan maestro, "Formato QR confirmado 2026-10-01").
"""
from __future__ import annotations

from urllib.parse import quote

from lxml import etree

from apps.fe.ecf_builder import ECFBuilderError, derivar_codigo_seguridad

# Ambientes posibles del QR -- hoy toda la Fase 5 corre en certecf. Cuando
# se habilite produccion habra que leer esto de TFE_CONFIG.ambiente.
#
# El path y los nombres de params van en CamelCase (ConsultaTimbre,
# RncEmisor, ENCF, etc) por hallazgo #22 (2026-10-08, 65va corrida):
# el rechazo DGII Fase 5 61va/62va trae el ejemplo literal
# "https://ecf.dgii.gov.do/ecf/ConsultaTimbre?RncEmisor=XXX&..." y la
# validacion exige ese formato exacto. Verificado empiricamente contra
# los servicios reales de certecf: tanto path lowercase como CamelCase
# aceptan y devuelven "Estado Aceptado", pero DGII validador de Fase 5
# espera el formato CamelCase impreso en el QR. El path se mantiene en
# certecf (no prod) porque es donde estan registrados los e-CFs de la
# postulacion -- cambiar a /ecf/ (62va) era incorrecto: prod no reconoce
# los e-CFs de certificacion y por eso DGII seguia rechazando con "QR
# no abren".
_URL_BASE_ECF = {
    'testecf': 'https://ecf.dgii.gov.do/testecf/ConsultaTimbre',
    'certecf': 'https://ecf.dgii.gov.do/certecf/ConsultaTimbre',
    'ecf':     'https://ecf.dgii.gov.do/ecf/ConsultaTimbre',
}
_URL_BASE_RFCE = {
    'testecf': 'https://fc.dgii.gov.do/testecf/ConsultaTimbreFC',
    'certecf': 'https://fc.dgii.gov.do/certecf/ConsultaTimbreFC',
    'ecf':     'https://fc.dgii.gov.do/eCF/ConsultaTimbreFC',
}

_RFCE_MONTO_TOPE = 250_000.0  # tope DGII para que un tipo 32 vaya como RFCE


def _text_or_none(root, xpath: str) -> str | None:
    el = root.find(xpath)
    if el is None:
        return None
    text = (el.text or '').strip()
    return text or None


def _usar_rfce(tipo_ecf: str, monto_total: float | None) -> bool:
    """Un tipo 32 va por el servicio RFCE solo si MontoTotal<250K."""
    if str(tipo_ecf).strip() != '32':
        return False
    try:
        return float(monto_total or 0) < _RFCE_MONTO_TOPE
    except (TypeError, ValueError):
        return False


def _parse_campos_ecf(xml_firmado: str) -> dict:
    """Lee del XML firmado los campos que van al QR. Soporta tanto ``ECF``
    como ``RFCE`` como raiz."""
    if isinstance(xml_firmado, str):
        xml_bytes = xml_firmado.encode('utf-8')
    else:
        xml_bytes = xml_firmado
    root = etree.fromstring(xml_bytes)
    tag = etree.QName(root.tag).localname
    if tag not in ('ECF', 'RFCE'):
        raise ECFBuilderError(
            f"XML firmado no es ni <ECF> ni <RFCE> (root=<{tag}>) -- "
            "no se puede derivar el contenido del QR")
    return {
        'root_tag': tag,
        'encf': _text_or_none(root, 'Encabezado/IdDoc/eNCF'),
        'rnc_emisor': _text_or_none(root, 'Encabezado/Emisor/RNCEmisor'),
        # FechaEmision esta en <Emisor> para ECF normal, en <Emisor> tambien
        # para RFCE (ver ecf_builder._construir_rfce) -- misma ruta.
        'fecha_emision': _text_or_none(root, 'Encabezado/Emisor/FechaEmision'),
        'rnc_comprador': _text_or_none(root, 'Encabezado/Comprador/RNCComprador'),
        'monto_total': _text_or_none(root, 'Encabezado/Totales/MontoTotal'),
        # FechaHoraFirma esta en la raiz, hermano de <Encabezado> (ver
        # ecf_builder: _sub(ecf, 'FechaHoraFirma', ...)).
        'fecha_hora_firma': _text_or_none(root, 'FechaHoraFirma'),
    }


def extraer_resumen_para_ri(xml_firmado: str) -> dict:
    """Lee del XML firmado los campos minimos para pintar la RI cuando no
    hay factura FAT atras del e-CF (caso Set de Pruebas, o paso4 que no
    guardo la referencia).

    Retorna un dict con comprador (razon_social, rnc, direccion), totales
    (subtotal, descuento, itbis, propina, total) y lineas (lista de items
    del XML con descripcion/cantidad/precio/itbis/total). Todas las claves
    siempre existen; los campos que no esten en el XML van vacios/en 0.
    """
    if isinstance(xml_firmado, str):
        xml_bytes = xml_firmado.encode('utf-8')
    else:
        xml_bytes = xml_firmado
    root = etree.fromstring(xml_bytes)

    def _t(xpath: str) -> str:
        return (_text_or_none(root, xpath) or '').strip()

    def _f(xpath: str) -> float:
        v = _t(xpath)
        try:
            return float(v) if v else 0.0
        except ValueError:
            return 0.0

    comprador = {
        'rnc': _t('Encabezado/Comprador/RNCComprador'),
        'razon_social': _t('Encabezado/Comprador/RazonSocialComprador'),
        'direccion': _t('Encabezado/Comprador/DireccionComprador'),
        'identificador_extranjero': _t(
            'Encabezado/Comprador/IdentificadorExtranjero'),
    }
    totales = {
        'subtotal': _f('Encabezado/Totales/MontoGravadoTotal') or _f(
            'Encabezado/Totales/MontoExento') or _f(
            'Encabezado/Totales/MontoTotal'),
        'descuento': _f('Encabezado/Totales/MontoDescuentoTotal'),
        'itbis': _f('Encabezado/Totales/TotalITBIS'),
        'propina': 0.0,
        'total': _f('Encabezado/Totales/MontoTotal'),
    }
    lineas = []
    for item in root.findall('DetallesItems/Item'):
        def _it(path: str) -> str:
            return (_text_or_none(item, path) or '').strip()

        def _if(path: str) -> float:
            v = _it(path)
            try:
                return float(v) if v else 0.0
            except ValueError:
                return 0.0

        lineas.append({
            'no_linea': _it('NumeroLinea'),
            'codigo': _it('CodigoItem') or '',
            'descripcion': _it('NombreItem') or '',
            'cantidad': _if('CantidadItem'),
            'precio': _if('PrecioUnitarioItem'),
            'descuento': _if('DescuentoMonto'),
            'itbis': _if('ITBISEspecifico'),
            'total': _if('MontoItem'),
        })
    return {'comprador': comprador, 'totales': totales, 'lineas': lineas}


def armar_qr_url(xml_firmado: str, ambiente: str = 'certecf') -> str:
    """Arma la URL del QR para la Representacion Impresa de un e-CF.

    - El tipo (ECF normal vs RFCE) se decide por el root del XML firmado y,
      para los tipo 32, por el ``MontoTotal`` leido del propio XML.
    - El ``encf`` va **en MAYUSCULAS** (ej: ``E310000000137``). El ejemplo
      oficial del PDF ``Descripcion-Tecnica-Servicios-DGII.pdf`` muestra el
      e-NCF en minusculas, pero el servicio real ``.../consultatimbre`` de
      la DGII (verificado 2026-10-07 contra certecf, testecf y la RFCE
      ``/consultatimbrefc``) devuelve ``"No fue encontrada la factura
      (e-CF)"`` cuando el encf va en minusculas y devuelve el documento
      Aceptado solo cuando va en mayusculas. El rechazo DGII 55va de Fase
      5 ``"Los QR no abren, verificar configuracion de la URL"`` se debe
      exactamente a esto.
    - ``fechafirma`` lleva el espacio URL-encoded como ``%20``.
    - ``rnccomprador`` se omite si el XML no lo trae (consumidor final sin
      RNC).
    """
    campos = _parse_campos_ecf(xml_firmado)
    encf = (campos.get('encf') or '').upper()
    if not encf:
        raise ECFBuilderError(
            "XML firmado no tiene <eNCF> -- no se puede armar el QR")
    rnc_emisor = campos.get('rnc_emisor') or ''
    monto_total = campos.get('monto_total') or '0'
    codigo_seguridad = derivar_codigo_seguridad(xml_firmado)

    # TipoeCF se lee del XML tambien (en Encabezado/IdDoc/TipoeCF) para
    # evitar ambiguedad entre el root (ECF puede ser cualquiera de los 10
    # tipos) y lo que mande el llamador.
    tipo_ecf = encf[1:3]  # eXXnnn...: pos 1-3 es el tipo
    es_rfce = _usar_rfce(tipo_ecf, float(monto_total))

    if es_rfce:
        base = _URL_BASE_RFCE.get(ambiente)
        if not base:
            raise ValueError(f"ambiente no soportado para QR: {ambiente!r}")
        qs = (
            f"RncEmisor={quote(rnc_emisor, safe='')}"
            f"&ENCF={quote(encf, safe='')}"
            f"&MontoTotal={quote(monto_total, safe='')}"
            f"&CodigoSeguridad={quote(codigo_seguridad, safe='')}"
        )
        return f"{base}?{qs}"

    base = _URL_BASE_ECF.get(ambiente)
    if not base:
        raise ValueError(f"ambiente no soportado para QR: {ambiente!r}")
    fecha_emision = campos.get('fecha_emision') or ''
    fecha_firma = campos.get('fecha_hora_firma') or ''
    rnc_comprador = campos.get('rnc_comprador') or ''

    params = [f"RncEmisor={quote(rnc_emisor, safe='')}"]
    if rnc_comprador:
        params.append(f"RncComprador={quote(rnc_comprador, safe='')}")
    params.append(f"ENCF={quote(encf, safe='')}")
    params.append(f"FechaEmision={quote(fecha_emision, safe='-')}")
    params.append(f"MontoTotal={quote(monto_total, safe='')}")
    # El PDF oficial deja los ":" sin encodear en fechafirma pero sustituye
    # el espacio por %20 -- replicamos exacto.
    params.append(
        f"FechaFirma={quote(fecha_firma, safe='-:')}")
    params.append(f"CodigoSeguridad={quote(codigo_seguridad, safe='')}")
    return f"{base}?{'&'.join(params)}"
