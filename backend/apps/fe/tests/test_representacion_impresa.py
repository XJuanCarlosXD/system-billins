"""Tests del helper ``apps.fe.representacion_impresa.armar_qr_url`` -- QR
de la Representacion Impresa (Fase 5 de la Postulacion 81443).

Formato oficial citado en el plan maestro (seccion "Formato QR confirmado
2026-10-01"), extraido de ``Descripcion-Tecnica-Servicios-DGII.pdf``.
"""
from __future__ import annotations

import pytest

from apps.fe.ecf_builder import ECFBuilderError
from apps.fe.representacion_impresa import armar_qr_url


def _xml_firmado(
    *,
    root_tag: str = 'ECF',
    encf: str = 'E310000000001',
    rnc_emisor: str = '130217432',
    rnc_comprador: str | None = '131265863',
    fecha_emision: str = '10-10-2020',
    fecha_hora_firma: str | None = '10-10-2020 09:00:00',
    monto_total: str = '682709.10',
    signature_value: str = 'dcp79qZZZabcdefghij==',
) -> str:
    """Mini XML con la forma exacta que arma ``ecf_builder.construir_ecf``
    (post-firma). Solo trae los campos que el helper del QR necesita."""
    comprador = (
        f'<Comprador><RNCComprador>{rnc_comprador}</RNCComprador></Comprador>'
        if rnc_comprador else ''
    )
    firma_root = (
        f'<FechaHoraFirma>{fecha_hora_firma}</FechaHoraFirma>'
        if fecha_hora_firma else ''
    )
    return (
        f'<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<{root_tag}>'
        f'  <Encabezado>'
        f'    <Version>1.0</Version>'
        f'    <IdDoc><TipoeCF>{encf[1:3]}</TipoeCF><eNCF>{encf}</eNCF></IdDoc>'
        f'    <Emisor>'
        f'      <RNCEmisor>{rnc_emisor}</RNCEmisor>'
        f'      <FechaEmision>{fecha_emision}</FechaEmision>'
        f'    </Emisor>'
        f'    {comprador}'
        f'    <Totales><MontoTotal>{monto_total}</MontoTotal></Totales>'
        f'  </Encabezado>'
        f'  {firma_root}'
        f'  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">'
        f'    <SignedInfo></SignedInfo>'
        f'    <SignatureValue>{signature_value}</SignatureValue>'
        f'  </Signature>'
        f'</{root_tag}>'
    )


def test_ecf_normal_arma_url_contra_consultatimbre_certecf():
    """Un e-CF31 (normal) va contra consultatimbre con los 7 query params
    en el orden exacto del ejemplo oficial del PDF."""
    url = armar_qr_url(_xml_firmado(), ambiente='certecf')
    assert url == (
        'https://ecf.dgii.gov.do/certecf/consultatimbre'
        '?rncemisor=130217432'
        '&rnccomprador=131265863'
        '&encf=e310000000001'
        '&fechaemision=10-10-2020'
        '&montototal=682709.10'
        '&fechafirma=10-10-2020%2009:00:00'
        '&codigoseguridad=dcp79q'
    )


def test_rfce_arma_url_contra_consultatimbrefc_certecf():
    """Un tipo 32 con MontoTotal<250K va contra consultatimbrefc, 4 params
    en el orden exacto del ejemplo oficial del PDF."""
    xml = _xml_firmado(
        root_tag='RFCE', encf='E320000000064',
        rnc_emisor='131880738', rnc_comprador=None,
        monto_total='6225.09',
        signature_value='uabnyhZZZabcdefg==',
    )
    url = armar_qr_url(xml, ambiente='certecf')
    assert url == (
        'https://fc.dgii.gov.do/certecf/consultatimbrefc'
        '?rncemisor=131880738'
        '&encf=e320000000064'
        '&montototal=6225.09'
        '&codigoseguridad=uabnyh'
    )


def test_tipo_32_mayor_a_250k_va_por_consultatimbre_normal():
    """Un tipo 32 con MontoTotal>=250K ya NO es RFCE, va por el servicio
    e-CF normal (consultatimbre) con los 7 params. Esto refleja que la
    DGII solo trata como RFCE las facturas de consumo <250K."""
    xml = _xml_firmado(
        encf='E320000001015', rnc_comprador='131265863',
        monto_total='299999.00',
    )
    url = armar_qr_url(xml, ambiente='certecf')
    assert url.startswith('https://ecf.dgii.gov.do/certecf/consultatimbre?')
    assert 'rnccomprador=131265863' in url
    assert 'fechafirma=' in url  # presente -> es la rama ECF normal


def test_consumidor_final_sin_rnc_omite_rnccomprador():
    """Si el XML no trae RNCComprador (consumidor final), el QR del e-CF
    normal omite el param -- no manda cadena vacia."""
    xml = _xml_firmado(rnc_comprador=None)
    url = armar_qr_url(xml, ambiente='certecf')
    assert 'rnccomprador=' not in url
    # Los otros 6 params siguen ahi:
    for key in ('rncemisor=', 'encf=', 'fechaemision=', 'montototal=',
                'fechafirma=', 'codigoseguridad='):
        assert key in url


def test_xml_sin_signaturevalue_lanza_errorbuilder():
    """derivar_codigo_seguridad falla si no hay SignatureValue -- esto se
    propaga como ECFBuilderError, no un AttributeError misterioso."""
    xml = (
        '<?xml version="1.0"?><ECF>'
        '<Encabezado><IdDoc><eNCF>E310000000001</eNCF></IdDoc>'
        '<Emisor><RNCEmisor>1</RNCEmisor><FechaEmision>01-01-2020</FechaEmision></Emisor>'
        '<Totales><MontoTotal>1.00</MontoTotal></Totales></Encabezado>'
        '</ECF>'
    )
    with pytest.raises(ECFBuilderError):
        armar_qr_url(xml, ambiente='certecf')


def test_xml_sin_encf_lanza_errorbuilder():
    """No hay fallback razonable si falta eNCF -- es la pieza central del
    QR."""
    xml = (
        '<?xml version="1.0"?><ECF>'
        '<Encabezado><IdDoc></IdDoc>'
        '<Emisor><RNCEmisor>1</RNCEmisor></Emisor>'
        '<Totales><MontoTotal>1.00</MontoTotal></Totales></Encabezado>'
        '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">'
        '<SignatureValue>abcdefghij</SignatureValue></Signature>'
        '</ECF>'
    )
    with pytest.raises(ECFBuilderError):
        armar_qr_url(xml, ambiente='certecf')


def test_root_tag_desconocido_lanza_errorbuilder():
    """Un XML cuyo root no es ni <ECF> ni <RFCE> es un error programatico
    -- probablemente el XML venia malformado."""
    xml = '<?xml version="1.0"?><FOO></FOO>'
    with pytest.raises(ECFBuilderError):
        armar_qr_url(xml, ambiente='certecf')


def test_ambiente_no_soportado_lanza_valueerror():
    """Guard de nombre de ambiente: typo 'cert' en vez de 'certecf' debe
    fallar explicito, no cambiar silenciosamente la URL."""
    with pytest.raises(ValueError):
        armar_qr_url(_xml_firmado(), ambiente='cert')
