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
_URL_BASE_ECF = {
    'testecf': 'https://ecf.dgii.gov.do/testecf/consultatimbre',
    'certecf': 'https://ecf.dgii.gov.do/certecf/consultatimbre',
    'ecf':     'https://ecf.dgii.gov.do/ecf/consultatimbre',
}
_URL_BASE_RFCE = {
    'testecf': 'https://fc.dgii.gov.do/testecf/consultatimbrefc',
    'certecf': 'https://fc.dgii.gov.do/certecf/consultatimbrefc',
    'ecf':     'https://fc.dgii.gov.do/ecf/consultatimbrefc',
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


def armar_qr_url(xml_firmado: str, ambiente: str = 'certecf') -> str:
    """Arma la URL del QR para la Representacion Impresa de un e-CF.

    - El tipo (ECF normal vs RFCE) se decide por el root del XML firmado y,
      para los tipo 32, por el ``MontoTotal`` leido del propio XML.
    - El ``encf`` va en minusculas y la ``fechafirma`` lleva el espacio
      URL-encoded como ``%20`` (ver ejemplo oficial en el PDF).
    - ``rnccomprador`` se omite si el XML no lo trae (consumidor final sin
      RNC).
    """
    campos = _parse_campos_ecf(xml_firmado)
    encf = (campos.get('encf') or '').lower()
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
            f"rncemisor={quote(rnc_emisor, safe='')}"
            f"&encf={quote(encf, safe='')}"
            f"&montototal={quote(monto_total, safe='')}"
            f"&codigoseguridad={quote(codigo_seguridad, safe='')}"
        )
        return f"{base}?{qs}"

    base = _URL_BASE_ECF.get(ambiente)
    if not base:
        raise ValueError(f"ambiente no soportado para QR: {ambiente!r}")
    fecha_emision = campos.get('fecha_emision') or ''
    fecha_firma = campos.get('fecha_hora_firma') or ''
    rnc_comprador = campos.get('rnc_comprador') or ''

    params = [f"rncemisor={quote(rnc_emisor, safe='')}"]
    if rnc_comprador:
        params.append(f"rnccomprador={quote(rnc_comprador, safe='')}")
    params.append(f"encf={quote(encf, safe='')}")
    params.append(f"fechaemision={quote(fecha_emision, safe='-')}")
    params.append(f"montototal={quote(monto_total, safe='')}")
    # El PDF oficial deja los ":" sin encodear en fechafirma pero sustituye
    # el espacio por %20 -- replicamos exacto.
    params.append(
        f"fechafirma={quote(fecha_firma, safe='-:')}")
    params.append(f"codigoseguridad={quote(codigo_seguridad, safe='')}")
    return f"{base}?{'&'.join(params)}"
