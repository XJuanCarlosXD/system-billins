"""Tests de construir_ecf_acc (Task 6).

ACC emite siempre tipo 43 (Gastos Menores) para egresos de caja chica
que tienen NCF. Totales reducidos: solo MontoExento + MontoTotal.
"""
from __future__ import annotations

import pytest

from apps.fe import ecf_builder


_CFG_EMISOR = {
    'rnc_emisor': '130217432',
    'razon_social': 'ABREGONZA S.R.L.',
    'nombre_comercial': 'ABREGONZA',
    'direccion_emisor': 'SD',
    'municipio': 'DN', 'provincia': 'SD',
    'activo': 'S',
}


def _patch_builder(monkeypatch, *, documento):
    captured = {}
    secuencia = {'e_ncf': 'E430000000118',
                 'fecha_vencimiento_secuencia': '2027-12-31'}

    from apps.legacy.repositories import acc_repo as _real_acc
    monkeypatch.setattr(_real_acc, 'get_documento',
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


def test_acc_sin_documento_lanza(monkeypatch):
    _patch_builder(monkeypatch, documento=None)
    with pytest.raises(ecf_builder.ECFBuilderError, match='ACC'):
        ecf_builder.construir_ecf_acc(43, '03', '01', 'EG', '999')


def test_acc_egreso_genera_tipo_43_con_totales_simplificados(monkeypatch):
    captured = _patch_builder(monkeypatch, documento={
        'fecha': '2026-10-24',
        'total': 1500,
        'detalle': 'Compra café para oficina',
    })

    xml = ecf_builder.construir_ecf_acc(43, '03', '01', 'EG', '55')

    assert xml == '<ECF-FAKE/>'
    assert captured['tipo_ecf'] == 43
    assert captured['e_ncf'] == 'E430000000118'
    d = captured['datos']
    assert d['MontoExento'] == '1500.00'
    assert d['MontoTotal'] == '1500.00'
    assert 'MontoGravadoTotal' not in d
    assert 'TotalITBIS' not in d
    assert d['IndicadorFacturacion[1]'] == '3'  # exento
    assert d['NombreItem[1]'] == 'Compra café para oficina'
    assert d['CantidadItem[1]'] == '1'


def test_acc_toma_valor_como_fallback_de_total(monkeypatch):
    captured = _patch_builder(monkeypatch, documento={
        'fecha': '2026-10-24',
        'valor': 800,  # algunos egresos usan 'valor' en vez de 'total'
    })

    ecf_builder.construir_ecf_acc(43, '03', '01', 'EG', '56')
    assert captured['datos']['MontoTotal'] == '800.00'
    assert captured['datos']['MontoExento'] == '800.00'


def test_acc_sin_detalle_usa_concepto_o_fallback(monkeypatch):
    captured = _patch_builder(monkeypatch, documento={
        'fecha': '2026-10-24',
        'total': 500,
        'concepto': 'Papelería',
    })

    ecf_builder.construir_ecf_acc(43, '03', '01', 'EG', '57')
    assert captured['datos']['NombreItem[1]'] == 'Papelería'


def test_acc_sin_detalle_ni_concepto_usa_fallback(monkeypatch):
    captured = _patch_builder(monkeypatch, documento={
        'fecha': '2026-10-24', 'total': 100,
    })

    ecf_builder.construir_ecf_acc(43, '03', '01', 'EG', '58')
    assert captured['datos']['NombreItem[1]'] == 'Gasto menor'


def test_acc_setea_fecha_vencimiento_secuencia_cuando_viene(monkeypatch):
    captured = _patch_builder(monkeypatch, documento={
        'fecha': '2026-10-24', 'total': 100,
    })

    ecf_builder.construir_ecf_acc(43, '03', '01', 'EG', '59')
    assert 'FechaVencimientoSecuencia' in captured['datos']
