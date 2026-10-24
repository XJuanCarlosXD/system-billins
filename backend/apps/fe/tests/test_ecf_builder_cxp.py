"""Tests de construir_ecf_cxp (Task 4).

CxP emite 3 tipos e-CF distintos — cada uno con reglas DGII específicas:

- Tipo 41 (Compras): comprador = emisor (la propia empresa compra); si hay
  retención de ITBIS/ISR, agrega el indicador y los montos; TipoPago='1'.
- Tipo 43 (Gastos Menores): sin RNC comprador, totales reducidos (sólo
  MontoExento + MontoTotal, no ITBIS).
- Tipo 47 (Pago al Exterior): comprador = nombre del proveedor extranjero,
  ISR retenido obligatorio si aplica.

Monkeypatcheamos `construir_ecf_generico` para capturar el dict `datos`
sin tener que validar el XML completo (eso lo cubren los tests existentes
de test_ecf_builder_generico.py).
"""
from __future__ import annotations

import pytest

from apps.fe import ecf_builder


_CFG_EMISOR = {
    'rnc_emisor': '130217432',
    'razon_social': 'ABREGONZA S.R.L.',
    'nombre_comercial': 'ABREGONZA',
    'direccion_emisor': 'SANTO DOMINGO',
    'municipio': 'DISTRITO NACIONAL',
    'provincia': 'SANTO DOMINGO',
    'activo': 'S',
}


def _patch_builder(monkeypatch, *, documento, secuencia=None,
                   cfg=None):
    """Monkeypatchea repo y helpers compartidos. Retorna un capturador."""
    captured = {}

    secuencia = secuencia or {
        'e_ncf': 'E410000000118',
        'fecha_vencimiento_secuencia': None,
    }

    from apps.legacy.repositories import cxp_repo as _real_cxp
    monkeypatch.setattr(_real_cxp, 'get_documento',
                        lambda *a, **k: documento, raising=False)
    monkeypatch.setattr(ecf_builder.fe_repo, 'get_config',
                        lambda no_cia: cfg if cfg is not None else _CFG_EMISOR)
    monkeypatch.setattr(ecf_builder.fe_repo, 'consumir_siguiente_encf',
                        lambda no_cia, tipo_ecf: secuencia)

    def fake_generico(tipo_ecf, e_ncf, datos):
        captured['tipo_ecf'] = tipo_ecf
        captured['e_ncf'] = e_ncf
        captured['datos'] = dict(datos)
        return '<ECF-FAKE/>'

    monkeypatch.setattr(ecf_builder, 'construir_ecf_generico', fake_generico)
    return captured


# ---------------------------------------------------------------------------
# Documento inexistente
# ---------------------------------------------------------------------------

def test_cxp_sin_documento_lanza(monkeypatch):
    _patch_builder(monkeypatch, documento=None)
    with pytest.raises(ecf_builder.ECFBuilderError, match='CxP'):
        ecf_builder.construir_ecf_cxp(41, '03', '01', 'FP', '999')


# ---------------------------------------------------------------------------
# Tipo 41 — Compras
# ---------------------------------------------------------------------------

def test_cxp_tipo_41_setea_comprador_igual_al_emisor(monkeypatch):
    captured = _patch_builder(monkeypatch, documento={
        'fecha': '2026-10-24',
        'valor_original': 11800,
        'impuesto': 1800,
        'detalle': 'Compra inventario',
    })

    ecf_builder.construir_ecf_cxp(41, '03', '01', 'FP', '77')

    d = captured['datos']
    assert d['RNCComprador'] == d['RNCEmisor'] == '130217432'
    assert d['RazonSocialComprador'] == d['RazonSocialEmisor']
    assert d['TipoPago'] == '1'
    assert d['IndicadorAgenteRetencionoPercepcion'] == '0'  # sin retención
    # Totales con ITBIS
    assert d['MontoGravadoTotal'] == '10000.00'
    assert d['TotalITBIS'] == '1800.00'
    assert d['MontoGravadoI1'] == '10000.00'
    assert d['TotalITBIS1'] == '1800.00'
    assert d['MontoTotal'] == '11800.00'
    # Línea única con el detalle del documento
    assert d['NombreItem[1]'] == 'Compra inventario'
    assert d['IndicadorFacturacion[1]'] == '1'


def test_cxp_tipo_41_con_retencion_itbis_e_isr(monkeypatch):
    captured = _patch_builder(monkeypatch, documento={
        'fecha': '2026-10-24',
        'valor_original': 11800,
        'impuesto': 1800,
        'itbis_retenido': 540,
        'isr_retenido': 200,
    })

    ecf_builder.construir_ecf_cxp(41, '03', '01', 'FP', '78')

    d = captured['datos']
    assert d['IndicadorAgenteRetencionoPercepcion'] == '1'
    assert d['MontoITBISRetenido'] == '540.00'
    assert d['MontoISRRetenido'] == '200.00'


def test_cxp_tipo_41_sin_impuesto_usa_monto_exento(monkeypatch):
    captured = _patch_builder(monkeypatch, documento={
        'fecha': '2026-10-24',
        'valor_original': 5000,
        'impuesto': 0,
    })

    ecf_builder.construir_ecf_cxp(41, '03', '01', 'FP', '79')

    d = captured['datos']
    assert d['MontoExento'] == '5000.00'
    assert 'MontoGravadoTotal' not in d
    assert d['MontoTotal'] == '5000.00'
    assert d['IndicadorFacturacion[1]'] == '3'


# ---------------------------------------------------------------------------
# Tipo 43 — Gastos Menores
# ---------------------------------------------------------------------------

def test_cxp_tipo_43_gastos_menores_sin_comprador(monkeypatch):
    captured = _patch_builder(monkeypatch, documento={
        'fecha': '2026-10-24',
        'valor_original': 3500,
        'impuesto': 0,
        'detalle': 'Gasto informal',
    })

    ecf_builder.construir_ecf_cxp(43, '03', '01', 'FP', '80')

    d = captured['datos']
    assert 'RNCComprador' not in d
    assert d['MontoExento'] == '3500.00'
    assert d['MontoTotal'] == '3500.00'
    assert 'MontoGravadoTotal' not in d
    assert 'TotalITBIS' not in d


# ---------------------------------------------------------------------------
# Tipo 47 — Pago al Exterior
# ---------------------------------------------------------------------------

def test_cxp_tipo_47_pago_exterior_usa_nombre_proveedor(monkeypatch):
    captured = _patch_builder(monkeypatch, documento={
        'fecha': '2026-10-24',
        'valor_original': 50000,
        'impuesto': 0,
        'nombre_proveedor': 'ACME CORP (USA)',
        'isr_retenido': 2500,
    })

    ecf_builder.construir_ecf_cxp(47, '03', '01', 'FP', '81')

    d = captured['datos']
    assert d['RazonSocialComprador'] == 'ACME CORP (USA)'
    assert 'RNCComprador' not in d  # Proveedor extranjero no tiene RNC DO
    assert d['IndicadorAgenteRetencionoPercepcion'] == '1'
    assert d['MontoISRRetenido'] == '2500.00'
    assert d['MontoExento'] == '50000.00'
    assert d['MontoTotal'] == '50000.00'


def test_cxp_tipo_47_sin_isr_retenido(monkeypatch):
    captured = _patch_builder(monkeypatch, documento={
        'fecha': '2026-10-24',
        'valor_original': 10000,
        'impuesto': 0,
        'nombre_proveedor': 'FOREIGN LTD',
    })

    ecf_builder.construir_ecf_cxp(47, '03', '01', 'FP', '82')

    d = captured['datos']
    assert d['IndicadorAgenteRetencionoPercepcion'] == '0'
    assert 'MontoISRRetenido' not in d


# ---------------------------------------------------------------------------
# e-NCF consumido viene de la secuencia correcta
# ---------------------------------------------------------------------------

def test_cxp_consume_encf_del_tipo_correcto(monkeypatch):
    tipos_pedidos = []

    def fake_consumir(no_cia, tipo_ecf):
        tipos_pedidos.append(tipo_ecf)
        return {'e_ncf': f'E{tipo_ecf:02d}0000000001',
                'fecha_vencimiento_secuencia': None}

    monkeypatch.setattr(ecf_builder.fe_repo, 'consumir_siguiente_encf',
                        fake_consumir)
    monkeypatch.setattr(ecf_builder.fe_repo, 'get_config',
                        lambda no_cia: _CFG_EMISOR)
    monkeypatch.setattr(ecf_builder, 'construir_ecf_generico',
                        lambda t, e, d: '<x/>')

    from apps.legacy.repositories import cxp_repo as _real_cxp
    monkeypatch.setattr(_real_cxp, 'get_documento',
                        lambda *a, **k: {'valor_original': 100, 'impuesto': 0},
                        raising=False)

    ecf_builder.construir_ecf_cxp(41, '03', '01', 'FP', '1')
    ecf_builder.construir_ecf_cxp(43, '03', '01', 'FP', '2')
    ecf_builder.construir_ecf_cxp(47, '03', '01', 'FP', '3')

    assert tipos_pedidos == [41, 43, 47]
