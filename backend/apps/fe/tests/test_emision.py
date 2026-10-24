"""Tests del orquestador apps.fe.emision (Task 2).

emitir_ecf_si_activo es el "pegamento" entre el flujo de negocio (FAT/CxP/
CxC/ACC) y la infraestructura e-CF (builder/firma/envío). Se llama DESPUÉS
del commit del documento original — un fallo aquí nunca debe propagar
excepciones ni revertir el documento de negocio.

Verifica:
- Si no hay config activa → no-op (None).
- Flujo FAT tipo 31 → construir_ecf_31 → enviar_ecf → save_documento_enviado.
- RFCE: tipo 32 con total < 250K → enviar_rfce (NO enviar_ecf).
- Factura anulada → no se envía nada.
- Excepciones internas → return None (no se propagan).
"""
from __future__ import annotations

from decimal import Decimal

import pytest

from apps.fe import emision


class _StubEcfBuilder:
    """Doble de apps.fe.ecf_builder — captura llamadas, devuelve XMLs falsos."""
    def __init__(self, xml='<ECF><eNCF>E310000000141</eNCF></ECF>'):
        self.xml = xml
        self.calls: list[tuple[str, tuple, dict]] = []

    def _record(self, name, args, kwargs):
        self.calls.append((name, args, kwargs))
        return self.xml

    def construir_ecf_31(self, *a, **k): return self._record('31', a, k)
    def construir_ecf_32(self, *a, **k): return self._record('32', a, k)
    def construir_ecf_cxp(self, *a, **k): return self._record('cxp', a, k)
    def construir_ecf_cxc(self, *a, **k): return self._record('cxc', a, k)
    def construir_ecf_acc(self, *a, **k): return self._record('acc', a, k)


class _StubDgiiClient:
    """Doble de apps.fe.dgii_client."""
    def __init__(self):
        self.enviar_ecf_calls: list[tuple] = []
        self.enviar_rfce_calls: list[tuple] = []
        self.resp_ecf = {
            'trackId': 'TRK-ECF-1',
            'xml_firmado': '<signed/>',
            'respuesta_cruda': '{"trackId":"TRK-ECF-1"}',
        }
        self.resp_rfce = {
            'trackId': 'TRK-RFCE-1',
            'estado': 'ACEPTADO',
            'xml_firmado': '<signed-rfce/>',
            'respuesta_cruda': '{"trackId":"TRK-RFCE-1"}',
        }

    def enviar_ecf(self, no_cia, ambiente, e_ncf, xml):
        self.enviar_ecf_calls.append((no_cia, ambiente, e_ncf, xml))
        return self.resp_ecf

    def enviar_rfce(self, no_cia, ambiente, e_ncf, xml):
        self.enviar_rfce_calls.append((no_cia, ambiente, e_ncf, xml))
        return self.resp_rfce


def _patch_dependencies(monkeypatch, *, cfg, factura=None,
                        builder=None, dgii=None, saved=None):
    """Montamos los dobles sobre los módulos que emision importa en runtime."""
    from apps.fe import ecf_builder as _real_builder, dgii_client as _real_dgii
    from apps.legacy.repositories import fat_repo as _real_fat

    monkeypatch.setattr(
        emision.fe_repo, 'get_config', lambda no_cia: cfg)

    saved_calls = saved if saved is not None else []
    def fake_save(**kwargs):
        saved_calls.append(kwargs)
    monkeypatch.setattr(emision.fe_repo, 'save_documento_enviado', fake_save)

    monkeypatch.setattr(_real_fat, 'get_factura',
                        lambda no_cia, punto, td, no_docu: factura)

    stub_builder = builder or _StubEcfBuilder()
    stub_dgii = dgii or _StubDgiiClient()
    monkeypatch.setattr(_real_builder, 'construir_ecf_31',
                        stub_builder.construir_ecf_31, raising=False)
    monkeypatch.setattr(_real_builder, 'construir_ecf_32',
                        stub_builder.construir_ecf_32, raising=False)
    monkeypatch.setattr(_real_builder, 'construir_ecf_cxp',
                        stub_builder.construir_ecf_cxp, raising=False)
    monkeypatch.setattr(_real_builder, 'construir_ecf_cxc',
                        stub_builder.construir_ecf_cxc, raising=False)
    monkeypatch.setattr(_real_builder, 'construir_ecf_acc',
                        stub_builder.construir_ecf_acc, raising=False)
    monkeypatch.setattr(_real_dgii, 'enviar_ecf', stub_dgii.enviar_ecf,
                        raising=False)
    monkeypatch.setattr(_real_dgii, 'enviar_rfce', stub_dgii.enviar_rfce,
                        raising=False)

    return stub_builder, stub_dgii, saved_calls


# ---------------------------------------------------------------------------
# No-op cases
# ---------------------------------------------------------------------------

def test_sin_config_no_hace_nada(monkeypatch):
    _patch_dependencies(monkeypatch, cfg=None)

    result = emision.emitir_ecf_si_activo(
        no_cia='03', punto='01', modulo='FAT', tipo_docu='FT', no_docu='123')

    assert result is None


def test_config_inactiva_no_hace_nada(monkeypatch):
    _, dgii, saved = _patch_dependencies(
        monkeypatch, cfg={'activo': 'N', 'ambiente': 'ecf'})

    result = emision.emitir_ecf_si_activo(
        no_cia='03', punto='01', modulo='FAT', tipo_docu='FT', no_docu='123')

    assert result is None
    assert dgii.enviar_ecf_calls == []
    assert dgii.enviar_rfce_calls == []
    assert saved == []


def test_factura_fat_no_existe_devuelve_none(monkeypatch):
    _, dgii, saved = _patch_dependencies(
        monkeypatch,
        cfg={'activo': 'S', 'ambiente': 'ecf'},
        factura=None,
    )

    result = emision.emitir_ecf_si_activo(
        no_cia='03', punto='01', modulo='FAT', tipo_docu='FT', no_docu='999')

    assert result is None
    assert dgii.enviar_ecf_calls == []
    assert saved == []


def test_factura_anulada_no_se_emite(monkeypatch):
    _, dgii, saved = _patch_dependencies(
        monkeypatch,
        cfg={'activo': 'S', 'ambiente': 'ecf'},
        factura={'posiciones_fijas_ncf': 'B01', 'total': 15000,
                 'st_anulado': 'S'},
    )

    result = emision.emitir_ecf_si_activo(
        no_cia='03', punto='01', modulo='FAT', tipo_docu='FT', no_docu='124')

    assert result is None
    assert dgii.enviar_ecf_calls == []
    assert saved == []


# ---------------------------------------------------------------------------
# Flujo exitoso FAT
# ---------------------------------------------------------------------------

def test_fat_tipo_31_envia_por_endpoint_normal(monkeypatch):
    builder, dgii, saved = _patch_dependencies(
        monkeypatch,
        cfg={'activo': 'S', 'ambiente': 'ecf'},
        factura={'posiciones_fijas_ncf': 'B01', 'total': 500_000},
    )

    result = emision.emitir_ecf_si_activo(
        no_cia='03', punto='01', modulo='FAT', tipo_docu='FT', no_docu='140')

    assert result == {
        'e_ncf': 'E310000000141',
        'track_id': 'TRK-ECF-1',
        'estado': 'ENVIADO',
    }
    # Builder correcto
    assert [c[0] for c in builder.calls] == ['31']
    # Envío por endpoint normal, no RFCE
    assert len(dgii.enviar_ecf_calls) == 1
    assert dgii.enviar_rfce_calls == []
    # Bitácora persistida
    assert len(saved) == 1
    assert saved[0]['e_ncf'] == 'E310000000141'
    assert saved[0]['tipo_ecf'] == '31'
    assert saved[0]['track_id'] == 'TRK-ECF-1'


def test_fat_tipo_32_sobre_umbral_va_por_ecf_normal(monkeypatch):
    """Tipo 32 con total >= 250K NO es RFCE — se envía al endpoint normal."""
    builder, dgii, _ = _patch_dependencies(
        monkeypatch,
        cfg={'activo': 'S', 'ambiente': 'ecf'},
        factura={'posiciones_fijas_ncf': 'B02', 'total': 300_000},
        builder=_StubEcfBuilder(xml='<ECF><eNCF>E320000001066</eNCF></ECF>'),
    )

    result = emision.emitir_ecf_si_activo(
        no_cia='03', punto='01', modulo='FAT', tipo_docu='FT', no_docu='500')

    assert result is not None
    assert result['e_ncf'] == 'E320000001066'
    assert len(dgii.enviar_ecf_calls) == 1
    assert dgii.enviar_rfce_calls == []
    assert [c[0] for c in builder.calls] == ['32']


# ---------------------------------------------------------------------------
# RFCE: tipo 32 bajo RD$250,000
# ---------------------------------------------------------------------------

def test_fat_tipo_32_bajo_umbral_usa_rfce(monkeypatch):
    """DGII: tipo 32 con total < 250K → RFCE, no e-CF normal."""
    builder, dgii, saved = _patch_dependencies(
        monkeypatch,
        cfg={'activo': 'S', 'ambiente': 'ecf'},
        factura={'posiciones_fijas_ncf': 'B02', 'total': Decimal('15000.00')},
        builder=_StubEcfBuilder(xml='<ECF><eNCF>E320000001066</eNCF></ECF>'),
    )

    result = emision.emitir_ecf_si_activo(
        no_cia='03', punto='01', modulo='FAT', tipo_docu='FT', no_docu='501')

    assert result is not None
    assert result['e_ncf'] == 'E320000001066'
    assert result['track_id'] == 'TRK-RFCE-1'
    # Vía RFCE, no ecf normal
    assert len(dgii.enviar_rfce_calls) == 1
    assert dgii.enviar_ecf_calls == []
    # El resultado toma el 'estado' del response de RFCE (síncrono)
    assert result['estado'] == 'ACEPTADO'
    # Bitácora persistida con tipo 32
    assert saved[0]['tipo_ecf'] == '32'


def test_fat_tipo_32_justo_en_umbral_no_es_rfce(monkeypatch):
    """Monto == 250000 NO es RFCE (regla < 250K, no <=)."""
    _, dgii, _ = _patch_dependencies(
        monkeypatch,
        cfg={'activo': 'S', 'ambiente': 'ecf'},
        factura={'posiciones_fijas_ncf': 'B02', 'total': 250_000},
        builder=_StubEcfBuilder(xml='<ECF><eNCF>E320000001066</eNCF></ECF>'),
    )

    emision.emitir_ecf_si_activo(
        no_cia='03', punto='01', modulo='FAT', tipo_docu='FT', no_docu='502')

    assert len(dgii.enviar_ecf_calls) == 1
    assert dgii.enviar_rfce_calls == []


# ---------------------------------------------------------------------------
# Mapeo de posiciones NCF papel → tipo e-CF
# ---------------------------------------------------------------------------

@pytest.mark.parametrize('posicion,tipo_esperado', [
    ('B01', 31), ('B02', 32), ('B14', 44), ('B15', 45), ('B16', 46),
])
def test_mapeo_posiciones_fijas_ncf_a_tipo_ecf(monkeypatch, posicion, tipo_esperado):
    xml = f'<ECF><eNCF>E{tipo_esperado:02d}0000000001</eNCF></ECF>'
    _, dgii, saved = _patch_dependencies(
        monkeypatch,
        cfg={'activo': 'S', 'ambiente': 'ecf'},
        factura={'posiciones_fijas_ncf': posicion, 'total': 1_000_000},
        builder=_StubEcfBuilder(xml=xml),
    )

    emision.emitir_ecf_si_activo(
        no_cia='03', punto='01', modulo='FAT', tipo_docu='FT', no_docu='X')

    assert saved[0]['tipo_ecf'] == str(tipo_esperado)
    assert len(dgii.enviar_ecf_calls) == 1


def test_posiciones_desconocidas_caen_a_tipo_32(monkeypatch):
    """Facturas sin B?? reconocido se tratan como consumo (32)."""
    _, _, saved = _patch_dependencies(
        monkeypatch,
        cfg={'activo': 'S', 'ambiente': 'ecf'},
        factura={'posiciones_fijas_ncf': '', 'total': 400_000},
        builder=_StubEcfBuilder(xml='<ECF><eNCF>E320000000001</eNCF></ECF>'),
    )

    emision.emitir_ecf_si_activo(
        no_cia='03', punto='01', modulo='FAT', tipo_docu='FT', no_docu='Y')

    assert saved[0]['tipo_ecf'] == '32'


# ---------------------------------------------------------------------------
# Módulos no-FAT (CxP, CxC, ACC)
# ---------------------------------------------------------------------------

def test_cxp_fp_delega_al_builder_cxp(monkeypatch):
    builder, dgii, saved = _patch_dependencies(
        monkeypatch,
        cfg={'activo': 'S', 'ambiente': 'ecf'},
        builder=_StubEcfBuilder(xml='<ECF><eNCF>E410000000118</eNCF></ECF>'),
    )

    result = emision.emitir_ecf_si_activo(
        no_cia='03', punto='01', modulo='CXP', tipo_docu='FP', no_docu='77')

    assert result['e_ncf'] == 'E410000000118'
    assert [c[0] for c in builder.calls] == ['cxp']
    # Primer arg del builder debe ser el tipo_ecf resuelto (41)
    _, args, _ = builder.calls[0]
    assert args[0] == 41
    assert saved[0]['tipo_ecf'] == '41'
    assert len(dgii.enviar_ecf_calls) == 1


def test_cxc_nc_delega_al_builder_cxc_tipo_34(monkeypatch):
    builder, _, saved = _patch_dependencies(
        monkeypatch,
        cfg={'activo': 'S', 'ambiente': 'ecf'},
        builder=_StubEcfBuilder(xml='<ECF><eNCF>E340000000062</eNCF></ECF>'),
    )

    emision.emitir_ecf_si_activo(
        no_cia='03', punto='01', modulo='CXC', tipo_docu='NC', no_docu='9')

    assert [c[0] for c in builder.calls] == ['cxc']
    _, args, _ = builder.calls[0]
    assert args[0] == 34
    assert saved[0]['tipo_ecf'] == '34'


def test_acc_siempre_tipo_43(monkeypatch):
    builder, _, saved = _patch_dependencies(
        monkeypatch,
        cfg={'activo': 'S', 'ambiente': 'ecf'},
        builder=_StubEcfBuilder(xml='<ECF><eNCF>E430000000118</eNCF></ECF>'),
    )

    emision.emitir_ecf_si_activo(
        no_cia='03', punto='01', modulo='ACC', tipo_docu='EG', no_docu='55')

    assert [c[0] for c in builder.calls] == ['acc']
    _, args, _ = builder.calls[0]
    assert args[0] == 43
    assert saved[0]['tipo_ecf'] == '43'


def test_cxp_tipo_desconocido_devuelve_none(monkeypatch):
    _, dgii, saved = _patch_dependencies(
        monkeypatch, cfg={'activo': 'S', 'ambiente': 'ecf'})

    result = emision.emitir_ecf_si_activo(
        no_cia='03', punto='01', modulo='CXP', tipo_docu='ZZ', no_docu='1')

    assert result is None
    assert dgii.enviar_ecf_calls == []
    assert saved == []


# ---------------------------------------------------------------------------
# Resiliencia: nunca propaga excepciones
# ---------------------------------------------------------------------------

def test_excepcion_en_builder_no_se_propaga(monkeypatch):
    """Si construir XML falla, el documento de negocio NO debe revertirse."""
    class _BoomBuilder(_StubEcfBuilder):
        def construir_ecf_31(self, *a, **k):
            raise RuntimeError('boom XML')

    _, dgii, saved = _patch_dependencies(
        monkeypatch,
        cfg={'activo': 'S', 'ambiente': 'ecf'},
        factura={'posiciones_fijas_ncf': 'B01', 'total': 500_000},
        builder=_BoomBuilder(),
    )

    result = emision.emitir_ecf_si_activo(
        no_cia='03', punto='01', modulo='FAT', tipo_docu='FT', no_docu='142')

    assert result is None
    assert dgii.enviar_ecf_calls == []
    assert saved == []


def test_excepcion_en_envio_dgii_no_se_propaga(monkeypatch):
    class _BoomDgii(_StubDgiiClient):
        def enviar_ecf(self, *a, **k):
            raise ConnectionError('DGII caída')

    _, dgii, saved = _patch_dependencies(
        monkeypatch,
        cfg={'activo': 'S', 'ambiente': 'ecf'},
        factura={'posiciones_fijas_ncf': 'B01', 'total': 500_000},
        dgii=_BoomDgii(),
    )

    result = emision.emitir_ecf_si_activo(
        no_cia='03', punto='01', modulo='FAT', tipo_docu='FT', no_docu='143')

    assert result is None
    assert saved == []


# ---------------------------------------------------------------------------
# _extraer_encf: utilidad de parsing
# ---------------------------------------------------------------------------

def test_extraer_encf_desde_xml():
    xml = '<ECF><Encabezado><eNCF>E310000000141</eNCF></Encabezado></ECF>'
    assert emision._extraer_encf(xml) == 'E310000000141'


def test_extraer_encf_lanza_si_falta():
    with pytest.raises(ValueError, match='no contiene'):
        emision._extraer_encf('<ECF></ECF>')
