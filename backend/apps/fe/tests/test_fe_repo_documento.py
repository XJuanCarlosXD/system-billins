"""Tests de apps.legacy.repositories.fe_repo (Task 3, Fase 2 e-CF):
save_documento_enviado / list_documentos sobre la bitácora TFE_DOCUMENTO.

Misma estrategia que test_dgii_client.py / test_ecf_builder.py: nunca se
toca Oracle real. Aquí se monkeypatchea directamente el módulo `client`
que usa fe_repo (`fe_repo.client.cursor` / `fe_repo.client.fetch_dicts`),
capturando el SQL y los binds exactos para verificar el MERGE y el
paginado ROWNUM sin abrir conexión.
"""
from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime
from types import SimpleNamespace

from apps.legacy.repositories import fe_repo


class FakeCursor:
    def __init__(self):
        self.executed: list[tuple[str, object]] = []
        self.committed = False

    def execute(self, sql, params=None):
        self.executed.append((sql, params))

    @property
    def connection(self):
        def _commit():
            self.committed = True
        return SimpleNamespace(commit=_commit)


# ---------------------------------------------------------------------------
# save_documento_enviado
# ---------------------------------------------------------------------------

def test_save_documento_enviado_hace_merge_con_binds_nombrados(monkeypatch):
    cur = FakeCursor()

    @contextmanager
    def fake_cursor():
        yield cur

    monkeypatch.setattr(fe_repo.client, 'cursor', fake_cursor)

    fe_repo.save_documento_enviado(
        '01', 'E320000000006', '32', 'TRACK-123',
        '<ECF>firmado</ECF>', '{"trackId": "TRACK-123"}', es_prueba='N',
    )

    assert len(cur.executed) == 1
    sql, params = cur.executed[0]
    assert 'MERGE INTO FAT.TFE_DOCUMENTO' in sql
    assert params == {
        'b1': '01', 'b2': 'E320000000006', 'b3': '32', 'b4': 'TRACK-123',
        'b5': '<ECF>firmado</ECF>', 'b6': '{"trackId": "TRACK-123"}',
        'b7': 'N',
    }
    assert cur.committed is True


def test_save_documento_enviado_default_es_prueba_n(monkeypatch):
    cur = FakeCursor()

    @contextmanager
    def fake_cursor():
        yield cur

    monkeypatch.setattr(fe_repo.client, 'cursor', fake_cursor)

    fe_repo.save_documento_enviado(
        '01', 'E310000000010', '31', 'TRACK-9',
        '<ECF/>', '{}',
    )

    _, params = cur.executed[0]
    assert params['b7'] == 'N'


def test_save_documento_enviado_es_prueba_s_para_certificacion(monkeypatch):
    """El flujo del Set de Pruebas (Task 5) debe poder marcar es_prueba='S'
    sin que save_documento_enviado le imponga el default 'N'."""
    cur = FakeCursor()

    @contextmanager
    def fake_cursor():
        yield cur

    monkeypatch.setattr(fe_repo.client, 'cursor', fake_cursor)

    fe_repo.save_documento_enviado(
        '01', 'E310000000011', '31', 'TRACK-10',
        '<ECF/>', '{}', es_prueba='S',
    )

    _, params = cur.executed[0]
    assert params['b7'] == 'S'


# ---------------------------------------------------------------------------
# list_documentos
# ---------------------------------------------------------------------------

def _fake_fetch_dicts_factory(rows):
    calls = []

    def fake_fetch_dicts(sql, params=None):
        calls.append((sql, params))
        return rows

    return fake_fetch_dicts, calls


def test_list_documentos_sin_filtros_usa_defaults_y_no_falla(monkeypatch):
    fake_fetch_dicts, calls = _fake_fetch_dicts_factory([])
    monkeypatch.setattr(fe_repo.client, 'fetch_dicts', fake_fetch_dicts)

    result = fe_repo.list_documentos('01')

    assert result == []
    sql, params = calls[0]
    assert params[0] == '01'
    # limit=50, offset=0 -> end_row=50, start_row=0, son los dos últimos binds
    assert params[-2:] == [50, 0]
    where_clause = sql.split('WHERE', 2)[1]
    assert 'estado =' not in where_clause
    assert 'tipo_ecf =' not in where_clause
    assert 'es_prueba' not in where_clause


def test_list_documentos_filtra_por_estado_tipo_y_es_prueba(monkeypatch):
    fake_fetch_dicts, calls = _fake_fetch_dicts_factory([])
    monkeypatch.setattr(fe_repo.client, 'fetch_dicts', fake_fetch_dicts)

    fe_repo.list_documentos('01', {
        'estado': 'RECHAZADO', 'tipo_ecf': '32', 'es_prueba': 'S',
    })

    sql, params = calls[0]
    assert 'estado = :2' in sql
    assert 'tipo_ecf = :3' in sql
    assert "NVL(es_prueba,'N') = :4" in sql
    assert params[:4] == ['01', 'RECHAZADO', '32', 'S']


def test_list_documentos_pagina_con_limit_y_offset(monkeypatch):
    fake_fetch_dicts, calls = _fake_fetch_dicts_factory([])
    monkeypatch.setattr(fe_repo.client, 'fetch_dicts', fake_fetch_dicts)

    fe_repo.list_documentos('01', {'limit': 20, 'offset': 40})

    _, params = calls[0]
    # end_row = offset + limit = 60, start_row = offset = 40
    assert params[-2:] == [60, 40]


def test_list_documentos_acota_limit_maximo_500(monkeypatch):
    fake_fetch_dicts, calls = _fake_fetch_dicts_factory([])
    monkeypatch.setattr(fe_repo.client, 'fetch_dicts', fake_fetch_dicts)

    fe_repo.list_documentos('01', {'limit': 10000, 'offset': 0})

    _, params = calls[0]
    assert params[-2] == 500  # end_row acotado, no 10000


def test_list_documentos_formatea_fechas_y_descarta_rn(monkeypatch):
    rows = [{
        'no_cia': '01', 'e_ncf': 'E320000000006', 'tipo_ecf': '32',
        'punto': '01', 'tipo_docu': 'FT', 'no_docu': '0001234',
        'rnc_comprador': '130217432', 'monto_total': 1180.0,
        'estado': 'ACEPTADO', 'track_id': 'TRACK-1',
        'codigo_seguridad': 'ABC123', 'es_prueba': 'N', 'intentos': 1,
        'fecha_firma': datetime(2026, 8, 31, 10, 30, 0),
        'fecha_crea': datetime(2026, 8, 31, 10, 29, 0),
        'fecha_actualiza': datetime(2026, 8, 31, 10, 31, 0),
        'rn': 1,
    }]
    fake_fetch_dicts, _ = _fake_fetch_dicts_factory(rows)
    monkeypatch.setattr(fe_repo.client, 'fetch_dicts', fake_fetch_dicts)

    result = fe_repo.list_documentos('01')

    assert len(result) == 1
    r = result[0]
    assert 'rn' not in r
    assert r['fecha_firma'] == '2026-08-31 10:30:00'
    assert r['fecha_crea'] == '2026-08-31 10:29:00'
    assert r['fecha_actualiza'] == '2026-08-31 10:31:00'


def test_list_documentos_tolera_fechas_nulas(monkeypatch):
    rows = [{
        'no_cia': '01', 'e_ncf': 'E320000000007', 'tipo_ecf': '32',
        'punto': None, 'tipo_docu': None, 'no_docu': None,
        'rnc_comprador': None, 'monto_total': None, 'estado': 'PENDIENTE',
        'track_id': None, 'codigo_seguridad': None, 'es_prueba': 'N',
        'intentos': 0, 'fecha_firma': None, 'fecha_crea': None,
        'fecha_actualiza': None, 'rn': 1,
    }]
    fake_fetch_dicts, _ = _fake_fetch_dicts_factory(rows)
    monkeypatch.setattr(fe_repo.client, 'fetch_dicts', fake_fetch_dicts)

    result = fe_repo.list_documentos('01')

    assert result[0]['fecha_firma'] is None
    assert result[0]['fecha_crea'] is None
    assert result[0]['fecha_actualiza'] is None
