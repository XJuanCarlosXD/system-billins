"""Tests de construir_ecf_cxc (Task 5).

Regla DGII crítica: toda ND (33) o NC (34) electrónica DEBE incluir
InformacionReferencia con el NCF original (minOccurs=1). Sin esa referencia
el schema falla y la DGII rechaza el envío.

ND → CodigoModificacion='1'; NC → '2'. NC además lleva IndicadorNotaCredito='1'.
"""
from __future__ import annotations

import pytest

from apps.fe import ecf_builder


_CFG_EMISOR = {
    'rnc_emisor': '130217432',
    'razon_social': 'ABREGONZA S.R.L.',
    'nombre_comercial': 'ABREGONZA',
    'direccion_emisor': 'SANTO DOMINGO',
    'municipio': 'DN',
    'provincia': 'SD',
    'activo': 'S',
}


def _patch_builder(monkeypatch, *, documento, secuencia=None):
    captured = {}
    secuencia = secuencia or {'e_ncf': 'E340000000062',
                              'fecha_vencimiento_secuencia': None}

    from apps.legacy.repositories import cxc_repo as _real_cxc
    monkeypatch.setattr(_real_cxc, 'get_documento',
                        lambda *a, **k: documento, raising=False)
    monkeypatch.setattr(ecf_builder.fe_repo, 'get_config',
                        lambda no_cia: _CFG_EMISOR)
    monkeypatch.setattr(ecf_builder.fe_repo, 'consumir_siguiente_encf',
                        lambda no_cia, tipo_ecf: secuencia)

    def fake_generico(tipo_ecf, e_ncf, datos):
        captured['tipo_ecf'] = tipo_ecf
        captured['e_ncf'] = e_ncf
        captured['datos'] = dict(datos)
        return '<ECF-FAKE/>'
    monkeypatch.setattr(ecf_builder, 'construir_ecf_generico', fake_generico)
    return captured


def test_cxc_sin_documento_lanza(monkeypatch):
    _patch_builder(monkeypatch, documento=None)
    with pytest.raises(ecf_builder.ECFBuilderError, match='CxC'):
        ecf_builder.construir_ecf_cxc(34, '03', '01', 'NC', '9')


# ---------------------------------------------------------------------------
# ND (tipo 33)
# ---------------------------------------------------------------------------

def test_cxc_nd_33_setea_codigo_modificacion_1(monkeypatch):
    captured = _patch_builder(monkeypatch, documento={
        'fecha': '2026-10-24',
        'valor_original': 1180,
        'impuesto': 180,
        'rnc': '101234567',
        'nombre_cliente': 'CLIENTE RNC',
        'ncf_referencia': 'E310000000100',
        'fecha_ncf_r': '2026-10-01',
        'detalle': 'Cargo adicional',
    })

    ecf_builder.construir_ecf_cxc(33, '03', '01', 'ND', '15')

    d = captured['datos']
    assert d['NCFModificado'] == 'E310000000100'
    assert d['FechaNCFModificado'] == '2026-10-01'
    assert d['CodigoModificacion'] == '1'
    assert 'IndicadorNotaCredito' not in d  # Solo NC lo lleva
    assert d['RNCComprador'] == '101234567'
    assert d['RazonSocialComprador'] == 'CLIENTE RNC'
    assert d['MontoGravadoTotal'] == '1000.00'
    assert d['TotalITBIS'] == '180.00'
    assert d['MontoTotal'] == '1180.00'


def test_cxc_nd_33_sin_referencia_ncf_lanza(monkeypatch):
    """DGII rechaza ND/NC sin NCF original — minOccurs=1."""
    _patch_builder(monkeypatch, documento={
        'fecha': '2026-10-24',
        'valor_original': 100,
        'impuesto': 0,
        'nombre_cliente': 'X',
        # sin ncf_referencia / ncf_r / ncf
    })

    with pytest.raises(ecf_builder.ECFBuilderError, match='referencia'):
        ecf_builder.construir_ecf_cxc(33, '03', '01', 'ND', '16')


def test_cxc_toma_ncf_r_como_fallback(monkeypatch):
    captured = _patch_builder(monkeypatch, documento={
        'fecha': '2026-10-24',
        'valor_original': 100, 'impuesto': 0,
        'nombre_cliente': 'X',
        'ncf_r': 'E310000000500',  # el nombre alterno de la columna
        'fecha': '2026-10-10',
    })
    ecf_builder.construir_ecf_cxc(33, '03', '01', 'ND', '17')
    assert captured['datos']['NCFModificado'] == 'E310000000500'


# ---------------------------------------------------------------------------
# NC (tipo 34)
# ---------------------------------------------------------------------------

def test_cxc_nc_34_setea_indicador_nota_credito_y_codigo_2(monkeypatch):
    captured = _patch_builder(monkeypatch, documento={
        'fecha': '2026-10-24',
        'valor_original': 590,
        'impuesto': 90,
        'rnc': '101234567',
        'nombre_cliente': 'CLIENTE RNC',
        'ncf_referencia': 'E310000000101',
        'fecha_ncf_r': '2026-09-30',
        'detalle': 'Devolución parcial',
    })

    ecf_builder.construir_ecf_cxc(34, '03', '01', 'NC', '20')

    d = captured['datos']
    assert d['IndicadorNotaCredito'] == '1'
    assert d['CodigoModificacion'] == '2'
    assert d['NCFModificado'] == 'E310000000101'
    assert d['MontoTotal'] == '590.00'


def test_cxc_sin_rnc_omite_comprador_rnc(monkeypatch):
    captured = _patch_builder(monkeypatch, documento={
        'fecha': '2026-10-24',
        'valor_original': 100, 'impuesto': 0,
        'nombre_cliente': 'CONSUMIDOR FINAL',
        'ncf_referencia': 'E320000000050',
    })

    ecf_builder.construir_ecf_cxc(34, '03', '01', 'NC', '21')

    d = captured['datos']
    assert 'RNCComprador' not in d
    assert d['RazonSocialComprador'] == 'CONSUMIDOR FINAL'


def test_cxc_fecha_vencimiento_secuencia_solo_en_33(monkeypatch):
    """FechaVencimientoSecuencia aplica a ND (33), no a NC (34)."""
    seq = {'e_ncf': 'E330000000024',
           'fecha_vencimiento_secuencia': '2027-12-31'}
    doc = {
        'fecha': '2026-10-24', 'valor_original': 100, 'impuesto': 0,
        'nombre_cliente': 'X', 'ncf_referencia': 'E310000000001',
    }

    captured33 = _patch_builder(monkeypatch, documento=doc, secuencia=seq)
    ecf_builder.construir_ecf_cxc(33, '03', '01', 'ND', '1')
    assert 'FechaVencimientoSecuencia' in captured33['datos']

    seq34 = {'e_ncf': 'E340000000024',
             'fecha_vencimiento_secuencia': '2027-12-31'}
    captured34 = _patch_builder(monkeypatch, documento=doc, secuencia=seq34)
    ecf_builder.construir_ecf_cxc(34, '03', '01', 'NC', '2')
    assert 'FechaVencimientoSecuencia' not in captured34['datos']
