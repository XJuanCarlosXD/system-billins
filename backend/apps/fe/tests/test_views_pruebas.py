"""Tests de ``apps.fe.views.pruebas_enviar_view`` (Task 5, modo test del
Set de Pruebas de certificacion DGII).

Misma estrategia que ``test_views_documentos.py``: nunca se toca Oracle
real ni la DGII real -- se monkeypatchea ``apps.fe.ecf_builder``,
``apps.fe.dgii_client`` y ``apps.legacy.repositories.fe_repo`` en la
frontera, y se ejercita la ruta HTTP real con el test Client de Django.

Los tests mas importantes de seguridad aqui son:

1. ``testecf`` se usa SIEMPRE, sin importar el ambiente configurado en
   ``TFE_CONFIG`` de la cia (hardcodeado en la vista, no debe leerse de
   config -- ver docstring de ``_AMBIENTE_MODO_TEST`` en views.py).
2. ``fe_repo.consumir_siguiente_encf`` NUNCA se llama desde este flujo
   (usar el e-NCF real de ``TFE_SECUENCIA`` para un envio de prueba
   quemaria numeracion de produccion sobre datos falsos).
3. ``es_prueba='S'`` siempre, nunca 'N', al guardar en TFE_DOCUMENTO.
"""
from __future__ import annotations

import json

import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from apps.fe import dgii_client, ecf_builder
from apps.legacy.repositories import fe_repo


@pytest.fixture
def cliente_autenticado(db):
    User = get_user_model()
    user = User.objects.create_user(username='tester', password='x')
    client = Client()
    client.force_login(user)
    return client


VALID_BODY = {
    'no_cia': '01', 'tipo_ecf': 32, 'encf': 'E320000000006',
    'datos': {'RNCEmisor': '130217432'},
}


def _post(client, body):
    return client.post('/api/fe/pruebas/enviar/', data=json.dumps(body),
                       content_type='application/json')


def test_requiere_login(client, db):
    resp = client.post('/api/fe/pruebas/enviar/', data=json.dumps(VALID_BODY),
                       content_type='application/json')
    assert resp.status_code in (302, 401, 403)


def test_json_invalido_da_400(cliente_autenticado):
    resp = cliente_autenticado.post(
        '/api/fe/pruebas/enviar/', data='no es json', content_type='application/json')
    assert resp.status_code == 400


@pytest.mark.parametrize('faltante', ['no_cia', 'tipo_ecf', 'encf'])
def test_campos_requeridos(cliente_autenticado, faltante):
    body = dict(VALID_BODY)
    del body[faltante]
    resp = _post(cliente_autenticado, body)
    assert resp.status_code == 400


def test_tipo_ecf_no_entero_da_400(cliente_autenticado):
    body = {**VALID_BODY, 'tipo_ecf': 'no-es-numero'}
    resp = _post(cliente_autenticado, body)
    assert resp.status_code == 400


def test_datos_no_dict_da_400(cliente_autenticado):
    body = {**VALID_BODY, 'datos': 'no-es-un-objeto'}
    resp = _post(cliente_autenticado, body)
    assert resp.status_code == 400


def test_ecf_builder_error_da_400(cliente_autenticado, monkeypatch):
    def fake_construir(tipo_ecf, e_ncf, datos):
        raise ecf_builder.ECFBuilderError('Emisor/RNCEmisor invalido')

    monkeypatch.setattr(ecf_builder, 'construir_ecf_generico', fake_construir)
    resp = _post(cliente_autenticado, VALID_BODY)
    assert resp.status_code == 400
    assert 'RNCEmisor' in resp.json()['detail']


def test_dgii_error_da_502(cliente_autenticado, monkeypatch):
    monkeypatch.setattr(ecf_builder, 'construir_ecf_generico',
                        lambda tipo_ecf, e_ncf, datos: '<ECF/>')

    def fake_enviar_ecf(no_cia, ambiente, e_ncf, xml_sin_firmar):
        raise dgii_client.DgiiError('Recepción e-CF HTTP 500: boom')

    monkeypatch.setattr(dgii_client, 'enviar_ecf', fake_enviar_ecf)
    resp = _post(cliente_autenticado, VALID_BODY)
    assert resp.status_code == 502


def test_envio_exitoso_usa_testecf_siempre_y_guarda_es_prueba_s(
    cliente_autenticado, monkeypatch
):
    build_calls = []

    def fake_construir(tipo_ecf, e_ncf, datos):
        build_calls.append((tipo_ecf, e_ncf, datos))
        return '<ECF>sin firmar</ECF>'

    monkeypatch.setattr(ecf_builder, 'construir_ecf_generico', fake_construir)

    enviar_calls = []

    def fake_enviar_ecf(no_cia, ambiente, e_ncf, xml_sin_firmar):
        enviar_calls.append((no_cia, ambiente, e_ncf, xml_sin_firmar))
        return {'trackId': 'TRACK-TEST-1', 'xml_firmado': '<ECF>firmado</ECF>',
                'respuesta_cruda': {'trackId': 'TRACK-TEST-1'}}

    monkeypatch.setattr(dgii_client, 'enviar_ecf', fake_enviar_ecf)

    save_calls = []
    monkeypatch.setattr(
        fe_repo, 'save_documento_enviado',
        lambda *a, **k: save_calls.append((a, k)))

    # Config de la cia con ambiente='certecf' (avanzada de fase) -- el
    # endpoint de modo test NO debe usarla, debe forzar 'testecf' siempre.
    monkeypatch.setattr(
        fe_repo, 'get_config',
        lambda no_cia: {'no_cia': no_cia, 'ambiente': 'certecf', 'rnc_emisor': '130217432'})

    # fe_repo.consumir_siguiente_encf NO debe llamarse jamas desde este
    # flujo -- si se llamara, esto haria fallar el test con AssertionError
    # en vez de dejarlo pasar en silencio.
    def fail_if_called(*a, **k):
        raise AssertionError(
            'consumir_siguiente_encf NO debe llamarse desde el modo test '
            '-- quemaria numeracion real de TFE_SECUENCIA sobre datos de prueba')

    monkeypatch.setattr(fe_repo, 'consumir_siguiente_encf', fail_if_called)

    body = {'no_cia': '01', 'tipo_ecf': 32, 'encf': 'e320000000006',
            'datos': {'RNCEmisor': '130217432', 'MontoTotal': '1180.00'}}
    resp = _post(cliente_autenticado, body)

    assert resp.status_code == 200
    assert resp.json() == {'trackId': 'TRACK-TEST-1',
                           'respuesta_dgii': {'trackId': 'TRACK-TEST-1'}}

    assert build_calls == [(32, 'E320000000006',
                            {'RNCEmisor': '130217432', 'MontoTotal': '1180.00'})]

    # Seguridad #1: SIEMPRE 'testecf', pase lo que pase en TFE_CONFIG.
    no_cia, ambiente, e_ncf, xml_sin_firmar = enviar_calls[0]
    assert ambiente == 'testecf'
    assert no_cia == '01'
    assert e_ncf == 'E320000000006'
    assert xml_sin_firmar == '<ECF>sin firmar</ECF>'

    # Seguridad #3: es_prueba='S' siempre.
    assert len(save_calls) == 1
    args, kwargs = save_calls[0]
    assert args[:5] == ('01', 'E320000000006', '32', 'TRACK-TEST-1', '<ECF>firmado</ECF>')
    assert kwargs['es_prueba'] == 'S'


def test_encf_se_normaliza_a_mayusculas(cliente_autenticado, monkeypatch):
    captured = {}

    def fake_construir(tipo_ecf, e_ncf, datos):
        captured['e_ncf'] = e_ncf
        return '<ECF/>'

    monkeypatch.setattr(ecf_builder, 'construir_ecf_generico', fake_construir)
    monkeypatch.setattr(
        dgii_client, 'enviar_ecf',
        lambda no_cia, ambiente, e_ncf, xml: {
            'trackId': 'T1', 'xml_firmado': '<ECF/>', 'respuesta_cruda': {}})
    monkeypatch.setattr(fe_repo, 'save_documento_enviado', lambda *a, **k: None)

    body = {**VALID_BODY, 'encf': ' e320000000006 '}
    resp = _post(cliente_autenticado, body)

    assert resp.status_code == 200
    assert captured['e_ncf'] == 'E320000000006'
