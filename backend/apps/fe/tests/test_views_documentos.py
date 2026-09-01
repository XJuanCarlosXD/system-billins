"""Tests de las vistas nuevas de apps.fe.views (Task 4, Fase 2 e-CF):
documentos_view, documento_detalle_view, documento_consultar_estado_view,
documento_reenviar_view.

Misma estrategia que el resto de la suite de fe: nunca se toca Oracle real
ni la DGII real -- se monkeypatchea apps.legacy.repositories.fe_repo y
apps.fe.dgii_client directamente, y se ejercitan las rutas HTTP reales con
el test Client de Django (login_required + csrf_exempt, igual que las
vistas ya existentes de este mismo módulo).
"""
from __future__ import annotations

import json

import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from apps.fe import dgii_client
from apps.legacy.repositories import fe_repo


@pytest.fixture
def cliente_autenticado(db):
    User = get_user_model()
    user = User.objects.create_user(username='tester', password='x')
    client = Client()
    client.force_login(user)
    return client


DOC_BASE = {
    'no_cia': '01', 'e_ncf': 'E320000000006', 'tipo_ecf': '32',
    'punto': '01', 'tipo_docu': 'FT', 'no_docu': '0001234',
    'rnc_comprador': '130217432', 'monto_total': 1180.0,
    'estado': 'ENVIADO', 'track_id': 'TRACK-1', 'codigo_seguridad': 'ABC123',
    'es_prueba': 'N', 'intentos': 1,
    'fecha_firma': '2026-08-31 10:30:00', 'fecha_crea': '2026-08-31 10:29:00',
    'fecha_actualiza': '2026-08-31 10:31:00',
}

FAKE_CONFIG = {'no_cia': '01', 'ambiente': 'testecf', 'rnc_emisor': '130217432'}


# ---------------------------------------------------------------------------
# documentos_view (listado)
# ---------------------------------------------------------------------------

def test_documentos_view_requiere_no_cia(cliente_autenticado):
    resp = cliente_autenticado.get('/api/fe/documentos/')
    assert resp.status_code == 400


def test_documentos_view_requiere_login(client, db, monkeypatch):
    monkeypatch.setattr(fe_repo, 'list_documentos', lambda *a, **k: [])
    resp = client.get('/api/fe/documentos/?no_cia=01')
    assert resp.status_code in (302, 401, 403)


def test_documentos_view_lista_y_pasa_filtros(cliente_autenticado, monkeypatch):
    calls = []

    def fake_list_documentos(no_cia, filtros=None):
        calls.append((no_cia, filtros))
        return [DOC_BASE]

    monkeypatch.setattr(fe_repo, 'list_documentos', fake_list_documentos)

    resp = cliente_autenticado.get(
        '/api/fe/documentos/?no_cia=01&estado=RECHAZADO&tipo_ecf=32'
        '&es_prueba=N&limit=10&offset=5')

    assert resp.status_code == 200
    assert resp.json()['items'] == [DOC_BASE]
    no_cia, filtros = calls[0]
    assert no_cia == '01'
    assert filtros['estado'] == 'RECHAZADO'
    assert filtros['tipo_ecf'] == '32'
    assert filtros['es_prueba'] == 'N'
    assert filtros['limit'] == '10'
    assert filtros['offset'] == '5'


# ---------------------------------------------------------------------------
# documento_detalle_view
# ---------------------------------------------------------------------------

def test_documento_detalle_requiere_no_cia(cliente_autenticado):
    resp = cliente_autenticado.get('/api/fe/documentos/E320000000006/')
    assert resp.status_code == 400


def test_documento_detalle_404_si_no_existe(cliente_autenticado, monkeypatch):
    monkeypatch.setattr(fe_repo, 'get_documento', lambda *a, **k: None)
    resp = cliente_autenticado.get('/api/fe/documentos/E320000000006/?no_cia=01')
    assert resp.status_code == 404


def test_documento_detalle_incluye_xml_firmado_y_respuesta(cliente_autenticado, monkeypatch):
    doc_completo = {**DOC_BASE, 'xml_firmado': '<ECF>firmado</ECF>',
                    'respuesta_dgii': '{"trackId": "TRACK-1"}'}
    monkeypatch.setattr(fe_repo, 'get_documento', lambda no_cia, e_ncf: doc_completo)

    resp = cliente_autenticado.get('/api/fe/documentos/E320000000006/?no_cia=01')

    assert resp.status_code == 200
    body = resp.json()['documento']
    assert body['xml_firmado'] == '<ECF>firmado</ECF>'
    assert body['respuesta_dgii'] == '{"trackId": "TRACK-1"}'


# ---------------------------------------------------------------------------
# documento_consultar_estado_view
# ---------------------------------------------------------------------------

def test_consultar_estado_requiere_no_cia(cliente_autenticado):
    resp = cliente_autenticado.post(
        '/api/fe/documentos/E320000000006/consultar-estado/',
        data='{}', content_type='application/json')
    assert resp.status_code == 400


def test_consultar_estado_404_si_no_existe_documento(cliente_autenticado, monkeypatch):
    monkeypatch.setattr(fe_repo, 'get_documento', lambda *a, **k: None)
    resp = cliente_autenticado.post(
        '/api/fe/documentos/E320000000006/consultar-estado/',
        data=json.dumps({'no_cia': '01'}), content_type='application/json')
    assert resp.status_code == 404


def test_consultar_estado_sin_track_id_da_error_claro(cliente_autenticado, monkeypatch):
    doc_sin_track = {**DOC_BASE, 'track_id': None}
    monkeypatch.setattr(fe_repo, 'get_documento', lambda *a, **k: doc_sin_track)
    resp = cliente_autenticado.post(
        '/api/fe/documentos/E320000000006/consultar-estado/',
        data=json.dumps({'no_cia': '01'}), content_type='application/json')
    assert resp.status_code == 400
    assert 'trackId' in resp.json()['detail']


def test_consultar_estado_llama_dgii_client_y_actualiza_estado(cliente_autenticado, monkeypatch):
    monkeypatch.setattr(fe_repo, 'get_documento', lambda *a, **k: dict(DOC_BASE))
    monkeypatch.setattr(fe_repo, 'get_config', lambda no_cia: FAKE_CONFIG)

    consultar_calls = []

    def fake_consultar_estado(no_cia, ambiente, track_id):
        consultar_calls.append((no_cia, ambiente, track_id))
        return {'codigo': 1, 'estado': 'Aceptado', 'mensajes': []}

    monkeypatch.setattr(dgii_client, 'consultar_estado', fake_consultar_estado)

    actualizar_calls = []
    monkeypatch.setattr(
        fe_repo, 'actualizar_estado_documento',
        lambda no_cia, e_ncf, estado, respuesta=None:
            actualizar_calls.append((no_cia, e_ncf, estado, respuesta)))

    resp = cliente_autenticado.post(
        '/api/fe/documentos/E320000000006/consultar-estado/',
        data=json.dumps({'no_cia': '01'}), content_type='application/json')

    assert resp.status_code == 200
    assert resp.json()['estado'] == 'ACEPTADO'
    assert consultar_calls == [('01', 'testecf', 'TRACK-1')]
    assert len(actualizar_calls) == 1
    no_cia, e_ncf, estado, respuesta = actualizar_calls[0]
    assert (no_cia, e_ncf, estado) == ('01', 'E320000000006', 'ACEPTADO')
    assert json.loads(respuesta)['estado'] == 'Aceptado'


def test_consultar_estado_dgii_error_devuelve_502(cliente_autenticado, monkeypatch):
    monkeypatch.setattr(fe_repo, 'get_documento', lambda *a, **k: dict(DOC_BASE))
    monkeypatch.setattr(fe_repo, 'get_config', lambda no_cia: FAKE_CONFIG)

    def fake_consultar_estado(no_cia, ambiente, track_id):
        raise dgii_client.DgiiError('Consulta resultado HTTP 500: boom')

    monkeypatch.setattr(dgii_client, 'consultar_estado', fake_consultar_estado)

    resp = cliente_autenticado.post(
        '/api/fe/documentos/E320000000006/consultar-estado/',
        data=json.dumps({'no_cia': '01'}), content_type='application/json')

    assert resp.status_code == 502


# ---------------------------------------------------------------------------
# documento_reenviar_view
# ---------------------------------------------------------------------------

def test_reenviar_404_si_no_existe_documento(cliente_autenticado, monkeypatch):
    monkeypatch.setattr(fe_repo, 'get_documento', lambda *a, **k: None)
    resp = cliente_autenticado.post(
        '/api/fe/documentos/E320000000006/reenviar/',
        data=json.dumps({'no_cia': '01'}), content_type='application/json')
    assert resp.status_code == 404


def test_reenviar_sin_xml_firmado_da_error_claro(cliente_autenticado, monkeypatch):
    doc_sin_xml = {**DOC_BASE, 'xml_firmado': None}
    monkeypatch.setattr(fe_repo, 'get_documento', lambda *a, **k: doc_sin_xml)
    resp = cliente_autenticado.post(
        '/api/fe/documentos/E320000000006/reenviar/',
        data=json.dumps({'no_cia': '01'}), content_type='application/json')
    assert resp.status_code == 400
    assert 'XML firmado' in resp.json()['detail']


def test_reenviar_usa_xml_firmado_guardado_no_lo_refirma(cliente_autenticado, monkeypatch):
    """El reenvío debe pasar el XML_FIRMADO tal cual está guardado a
    dgii_client.reenviar_ecf -- no debe pasar por enviar_ecf() ni por
    ningún llamado a firma.firmar_con_app_oficial()."""
    doc_completo = {**DOC_BASE, 'xml_firmado': '<ECF>ya firmado</ECF>'}
    monkeypatch.setattr(fe_repo, 'get_documento', lambda *a, **k: doc_completo)
    monkeypatch.setattr(fe_repo, 'get_config', lambda no_cia: FAKE_CONFIG)

    reenviar_calls = []

    def fake_reenviar_ecf(no_cia, ambiente, e_ncf, xml_firmado):
        reenviar_calls.append((no_cia, ambiente, e_ncf, xml_firmado))
        return {'trackId': 'TRACK-NEW', 'respuesta_cruda': {'trackId': 'TRACK-NEW'}}

    def fail_if_called(*a, **k):
        raise AssertionError('enviar_ecf NO debe llamarse desde el flujo de reenvío')

    monkeypatch.setattr(dgii_client, 'reenviar_ecf', fake_reenviar_ecf)
    monkeypatch.setattr(dgii_client, 'enviar_ecf', fail_if_called)

    save_calls = []
    monkeypatch.setattr(
        fe_repo, 'save_documento_enviado',
        lambda *a, **k: save_calls.append((a, k)))

    resp = cliente_autenticado.post(
        '/api/fe/documentos/E320000000006/reenviar/',
        data=json.dumps({'no_cia': '01'}), content_type='application/json')

    assert resp.status_code == 200
    assert resp.json()['trackId'] == 'TRACK-NEW'
    assert reenviar_calls == [('01', 'testecf', 'E320000000006', '<ECF>ya firmado</ECF>')]
    assert len(save_calls) == 1
    args, kwargs = save_calls[0]
    assert args[:5] == ('01', 'E320000000006', '32', 'TRACK-NEW', '<ECF>ya firmado</ECF>')
    assert kwargs['es_prueba'] == 'N'


def test_reenviar_dgii_error_devuelve_502(cliente_autenticado, monkeypatch):
    doc_completo = {**DOC_BASE, 'xml_firmado': '<ECF>ya firmado</ECF>'}
    monkeypatch.setattr(fe_repo, 'get_documento', lambda *a, **k: doc_completo)
    monkeypatch.setattr(fe_repo, 'get_config', lambda no_cia: FAKE_CONFIG)

    def fake_reenviar_ecf(no_cia, ambiente, e_ncf, xml_firmado):
        raise dgii_client.DgiiError('Reenvío e-CF HTTP 500: boom')

    monkeypatch.setattr(dgii_client, 'reenviar_ecf', fake_reenviar_ecf)

    resp = cliente_autenticado.post(
        '/api/fe/documentos/E320000000006/reenviar/',
        data=json.dumps({'no_cia': '01'}), content_type='application/json')

    assert resp.status_code == 502
