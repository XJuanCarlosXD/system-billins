"""Tests de ``apps.fe.ecf_builder.construir_acecf`` -- Aprobacion Comercial
(Paso 3 de certificacion DGII). Formato confirmado 1:1 contra el XSD real
``ACECF v.1.0.xsd`` de dgii.gov.do (probado real 2026-09-17: 11/11
"Aprobacion Comercial Aprobada" contra certecf, ver memoria del proyecto).
"""
from __future__ import annotations

from apps.fe import ecf_builder


ROW = {
    'Version': '1.0',
    'RNCEmisor': '131880681',
    'eNCF': 'E310000000001',
    'FechaEmision': '01-04-2020',
    'MontoTotal': 7080,
    'RNCComprador': '130217432',
    'Estado': 1,
    'DetalleMotivoRechazo': None,
    'FechaHoraAprobacionComercial': '17-09-2026 11:44:23',
}


def test_construir_acecf_incluye_los_9_campos_en_orden():
    xml = ecf_builder.construir_acecf(ROW)
    assert '<ACECF>' in xml
    assert '<DetalleAprobacionComercial>' in xml
    assert '<Version>1.0</Version>' in xml
    assert '<RNCEmisor>131880681</RNCEmisor>' in xml
    assert '<eNCF>E310000000001</eNCF>' in xml
    assert '<FechaEmision>01-04-2020</FechaEmision>' in xml
    assert '<MontoTotal>7080.00</MontoTotal>' in xml
    assert '<RNCComprador>130217432</RNCComprador>' in xml
    assert '<Estado>1</Estado>' in xml
    assert '<FechaHoraAprobacionComercial>17-09-2026 11:44:23</FechaHoraAprobacionComercial>' in xml
    # orden real del XSD: eNCF antes que FechaEmision, MontoTotal antes que RNCComprador
    assert xml.index('<eNCF>') < xml.index('<FechaEmision>')
    assert xml.index('<MontoTotal>') < xml.index('<RNCComprador>')


def test_construir_acecf_monto_total_redondea_a_2_decimales():
    row = {**ROW, 'MontoTotal': 96365.3}
    xml = ecf_builder.construir_acecf(row)
    assert '<MontoTotal>96365.30</MontoTotal>' in xml


def test_construir_acecf_estado_rechazado_incluye_detalle_motivo():
    row = {**ROW, 'Estado': 2, 'DetalleMotivoRechazo': 'Monto no coincide'}
    xml = ecf_builder.construir_acecf(row)
    assert '<Estado>2</Estado>' in xml
    assert '<DetalleMotivoRechazo>Monto no coincide</DetalleMotivoRechazo>' in xml


def test_construir_acecf_sin_motivo_rechazo_omite_el_elemento():
    xml = ecf_builder.construir_acecf(ROW)
    assert 'DetalleMotivoRechazo' not in xml
