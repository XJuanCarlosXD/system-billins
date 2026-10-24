"""Tests del fallback TFE_CONFIG → cia '01' para grupo multi-empresa (Task 1).

El grupo Abregonza tiene un solo RNC (130217432) con config e-CF en NO_CIA='01',
mientras que los módulos de negocio (FAT/CxP/CxC) usan NO_CIA='03' para
Abregonza SRL. _resolve_fe_cia resuelve la cia real que tiene TFE_CONFIG para
que get_config / list_secuencias / consumir_siguiente_encf no devuelvan NULL
en operaciones de la 03.
"""
from __future__ import annotations

from apps.legacy.repositories import fe_repo


def _fake_fetch_dicts_factory(responses):
    """Devuelve un stub de fetch_dicts que responde según el SQL recibido.

    responses: list[list[dict]] — cada llamada consume la siguiente respuesta.
    """
    calls = []
    iter_responses = iter(responses)

    def fake_fetch_dicts(sql, params=None):
        calls.append((sql, params))
        try:
            return next(iter_responses)
        except StopIteration:
            return []

    return fake_fetch_dicts, calls


def test_resolve_fe_cia_devuelve_01_sin_tocar_db(monkeypatch):
    """Si piden la '01' directamente, no se consulta la BD."""
    calls = []

    def fake_fetch_dicts(sql, params=None):
        calls.append((sql, params))
        return []

    monkeypatch.setattr(fe_repo.client, 'fetch_dicts', fake_fetch_dicts)

    assert fe_repo._resolve_fe_cia('01') == '01'
    assert calls == []  # Short-circuit, nunca consulta


def test_resolve_fe_cia_03_sin_config_cae_a_01(monkeypatch):
    """Si no_cia='03' no tiene fila en TFE_CONFIG, el fallback es '01'."""
    fake_fetch_dicts, calls = _fake_fetch_dicts_factory([[]])  # sin filas
    monkeypatch.setattr(fe_repo.client, 'fetch_dicts', fake_fetch_dicts)

    assert fe_repo._resolve_fe_cia('03') == '01'

    sql, params = calls[0]
    assert 'TFE_CONFIG' in sql
    assert params == ['03']


def test_resolve_fe_cia_03_con_config_propia_devuelve_03(monkeypatch):
    """Si la 03 llegara a tener su propia TFE_CONFIG, se respeta."""
    fake_fetch_dicts, _ = _fake_fetch_dicts_factory([[{'1': 1}]])
    monkeypatch.setattr(fe_repo.client, 'fetch_dicts', fake_fetch_dicts)

    assert fe_repo._resolve_fe_cia('03') == '03'


def test_get_config_usa_fallback_cuando_cia_no_tiene_fila(monkeypatch):
    """get_config('03') sin fila propia debe traer la config de '01'."""
    cfg_fila = {
        'no_cia': '01', 'ambiente': 'ecf', 'rnc_emisor': '130217432',
        'razon_social': 'ABREGONZA S.R.L.', 'nombre_comercial': 'ABREGONZA',
        'direccion_emisor': 'SANTO DOMINGO', 'municipio': 'SD',
        'provincia': 'SD', 'cert_subject': None, 'cert_vence': None,
        'estado_cert': 'VIGENTE', 'activo': 'S', 'fecha_actualiza': None,
        'tiene_cert': 'S',
    }
    # 1ª call: _resolve_fe_cia('03') → sin filas (fallback a '01').
    # 2ª call: get_config('01') → devuelve la fila real.
    fake_fetch_dicts, calls = _fake_fetch_dicts_factory([[], [cfg_fila]])
    monkeypatch.setattr(fe_repo.client, 'fetch_dicts', fake_fetch_dicts)

    cfg = fe_repo.get_config('03')

    assert cfg is not None
    assert cfg['no_cia'] == '01'
    assert cfg['activo'] == 'S'
    assert cfg['rnc_emisor'] == '130217432'

    # La 2ª consulta debió usar bind '01', no '03'.
    _, params = calls[1]
    assert params == ['01']


def test_get_config_devuelve_none_si_ni_la_01_tiene_fila(monkeypatch):
    """Caso defensivo: ni la 03 ni la 01 tienen config → None."""
    fake_fetch_dicts, _ = _fake_fetch_dicts_factory([[], []])
    monkeypatch.setattr(fe_repo.client, 'fetch_dicts', fake_fetch_dicts)

    assert fe_repo.get_config('03') is None


def test_list_secuencias_tambien_cae_a_01(monkeypatch):
    """list_secuencias respeta el mismo fallback — las secuencias viven en '01'."""
    secs = [
        {'no_cia': '01', 'tipo_ecf': '31', 'secuencia_desde': 1,
         'secuencia_hasta': 10_000_000, 'prox_secuencia': 141,
         'fecha_vence': None, 'activa': 'S'},
    ]
    fake_fetch_dicts, calls = _fake_fetch_dicts_factory([[], secs])
    monkeypatch.setattr(fe_repo.client, 'fetch_dicts', fake_fetch_dicts)

    result = fe_repo.list_secuencias('03')

    assert len(result) == 1
    assert result[0]['tipo_ecf'] == '31'
    # 2ª call (la real) debe usar '01' como bind.
    _, params = calls[1]
    assert params == ['01']
