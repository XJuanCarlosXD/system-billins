"""Tests de apps.fe.dgii_client (Task 2, Fase 2 e-CF): enviar_ecf,
enviar_rfce, consultar_estado.

Estrategia (misma que test_ecf_builder.py): monkeypatch sobre
apps.legacy.repositories.fe_repo, apps.fe.crypto, apps.fe.firma y
apps.fe.dgii_client.obtener_token -- nunca se llama a Oracle real ni se
hace un request real a la DGII (es un sistema tributario real en
producción/certificación, un request real podría consumir un e-NCF o
disparar un rechazo real durante la certificación en curso). ``requests``
se monkeypatchea también, capturando los argumentos exactos para poder
verificar URL/host/headers/multipart sin red.

Las URLs/formas de respuesta verificadas aquí vienen de
``Descripcion-Tecnica-Servicios-DGII.pdf`` (v1.7, mayo 2026) en
``backend/docs/superpowers/reference/2026-08-31-set-pruebas-paso2/``, no
inventadas: "Recepción de e-CF" (pág. 12-15), "Recepción de resumen
factura de consumo electrónica (RFCE)" (pág. 15-19, HOST distinto
fc.dgii.gov.do) y "Consulta de resultado e-CF" (pág. 22-25).
"""
from __future__ import annotations

import pytest

from apps.fe import crypto, dgii_client, firma
from apps.legacy.repositories import fe_repo

FAKE_TOKEN = 'FAKE.JWT.TOKEN'
FAKE_P12 = b'\x00FAKE-P12-BYTES'
FAKE_PASSWORD_ENC = 'enc(clave123)'
FAKE_PASSWORD = 'clave123'
FAKE_XML_FIRMADO = '<ECF>...firmado...</ECF>'


class FakeResponse:
    def __init__(self, status_code=200, json_data=None, text=''):
        self.status_code = status_code
        self._json_data = json_data
        self.text = text if text else (str(json_data) if json_data is not None else '')

    def json(self):
        if self._json_data is None:
            raise ValueError('no es JSON')
        return self._json_data


@pytest.fixture(autouse=True)
def _patch_comunes(monkeypatch):
    """Evita Oracle real, evita invocar la App oficial de verdad (Mono no
    corre en el entorno de test) y evita cualquier request real."""
    state = {
        'config': {'no_cia': '01', 'rnc_emisor': '130217432'},
        'certificado': (FAKE_P12, FAKE_PASSWORD_ENC),
        'firmar_calls': [],
        'firmar_xml_calls': [],
        'token_calls': [],
        'requests_post_calls': [],
        'requests_get_calls': [],
    }

    def fake_get_config(no_cia):
        return state['config']

    def fake_get_certificado(no_cia):
        return state['certificado']

    def fake_decrypt(token):
        assert token == FAKE_PASSWORD_ENC
        return FAKE_PASSWORD

    def fake_firmar_con_app_oficial(xml_str, p12_bytes, password):
        state['firmar_calls'].append((xml_str, p12_bytes, password))
        return FAKE_XML_FIRMADO

    def fake_firmar_xml(xml_str, p12_bytes, password):
        # No debe usarse nunca para envio a la DGII (ver firma.py docstring
        # de firmar_con_app_oficial) -- si algun test lo dispara, es un bug.
        state['firmar_xml_calls'].append((xml_str, p12_bytes, password))
        raise AssertionError('firmar_xml() NO debe usarse para enviar a la DGII')

    def fake_obtener_token(no_cia, ambiente, forzar=False):
        state['token_calls'].append((no_cia, ambiente, forzar))
        return FAKE_TOKEN

    monkeypatch.setattr(fe_repo, 'get_config', fake_get_config)
    monkeypatch.setattr(fe_repo, 'get_certificado', fake_get_certificado)
    monkeypatch.setattr(crypto, 'decrypt', fake_decrypt)
    monkeypatch.setattr(firma, 'firmar_con_app_oficial', fake_firmar_con_app_oficial)
    monkeypatch.setattr(firma, 'firmar_xml', fake_firmar_xml)
    monkeypatch.setattr(dgii_client, 'obtener_token', fake_obtener_token)
    return state


def _patch_post(monkeypatch, state, response):
    def fake_post(url, headers=None, files=None, timeout=None, **kw):
        state['requests_post_calls'].append(
            {'url': url, 'headers': headers, 'files': files, 'timeout': timeout})
        return response
    monkeypatch.setattr(dgii_client.requests, 'post', fake_post)


def _patch_get(monkeypatch, state, response):
    def fake_get(url, headers=None, params=None, timeout=None, **kw):
        state['requests_get_calls'].append(
            {'url': url, 'headers': headers, 'params': params, 'timeout': timeout})
        return response
    monkeypatch.setattr(dgii_client.requests, 'get', fake_get)


# ---------------------------------------------------------------------------
# enviar_ecf
# ---------------------------------------------------------------------------

def test_enviar_ecf_firma_con_app_oficial_no_con_firmar_xml(monkeypatch, _patch_comunes):
    state = _patch_comunes
    _patch_post(monkeypatch, state, FakeResponse(200, {'trackId': 'TRACK-1'}))

    dgii_client.enviar_ecf('01', 'testecf', 'E320000000006', '<ECF>sin firmar</ECF>')

    assert len(state['firmar_calls']) == 1
    assert state['firmar_calls'][0] == ('<ECF>sin firmar</ECF>', FAKE_P12, FAKE_PASSWORD)
    assert state['firmar_xml_calls'] == []


def test_enviar_ecf_url_y_host_correctos(monkeypatch, _patch_comunes):
    state = _patch_comunes
    _patch_post(monkeypatch, state, FakeResponse(200, {'trackId': 'TRACK-1'}))

    dgii_client.enviar_ecf('01', 'certecf', 'E320000000006', '<ECF/>')

    assert len(state['requests_post_calls']) == 1
    url = state['requests_post_calls'][0]['url']
    assert url == 'https://ecf.dgii.gov.do/certecf/recepcion/api/facturaselectronicas'


def test_enviar_ecf_nombre_archivo_rnc_mas_encf_sin_separador(monkeypatch, _patch_comunes):
    state = _patch_comunes
    _patch_post(monkeypatch, state, FakeResponse(200, {'trackId': 'TRACK-1'}))

    dgii_client.enviar_ecf('01', 'testecf', 'E320000000006', '<ECF/>')

    files = state['requests_post_calls'][0]['files']
    nombre_archivo, contenido, content_type = files['xml']
    assert nombre_archivo == '130217432E320000000006.xml'
    assert contenido == FAKE_XML_FIRMADO.encode('utf-8')
    assert content_type == 'text/xml'


def test_enviar_ecf_header_authorization_bearer(monkeypatch, _patch_comunes):
    state = _patch_comunes
    _patch_post(monkeypatch, state, FakeResponse(200, {'trackId': 'TRACK-1'}))

    dgii_client.enviar_ecf('01', 'testecf', 'E320000000006', '<ECF/>')

    headers = state['requests_post_calls'][0]['headers']
    assert headers == {'Authorization': f'Bearer {FAKE_TOKEN}'}
    assert state['token_calls'][0][:2] == ('01', 'testecf')


def test_enviar_ecf_retorna_trackid_xml_firmado_y_respuesta_cruda(monkeypatch, _patch_comunes):
    state = _patch_comunes
    respuesta_dgii = {'trackId': 'TRACK-XYZ', 'error': None, 'mensaje': None}
    _patch_post(monkeypatch, state, FakeResponse(200, respuesta_dgii))

    resultado = dgii_client.enviar_ecf('01', 'testecf', 'E320000000006', '<ECF/>')

    assert resultado == {
        'trackId': 'TRACK-XYZ',
        'xml_firmado': FAKE_XML_FIRMADO,
        'respuesta_cruda': respuesta_dgii,
    }


def test_enviar_ecf_http_no_200_lanza_dgiierror(monkeypatch, _patch_comunes):
    state = _patch_comunes
    _patch_post(monkeypatch, state, FakeResponse(500, None, text='Internal Server Error'))

    with pytest.raises(dgii_client.DgiiError, match='HTTP 500'):
        dgii_client.enviar_ecf('01', 'testecf', 'E320000000006', '<ECF/>')


def test_enviar_ecf_respuesta_no_json_lanza_dgiierror(monkeypatch, _patch_comunes):
    state = _patch_comunes
    _patch_post(monkeypatch, state, FakeResponse(200, None, text='<html>no json</html>'))

    with pytest.raises(dgii_client.DgiiError, match='no JSON'):
        dgii_client.enviar_ecf('01', 'testecf', 'E320000000006', '<ECF/>')


def test_enviar_ecf_respuesta_sin_trackid_lanza_dgiierror(monkeypatch, _patch_comunes):
    state = _patch_comunes
    _patch_post(monkeypatch, state, FakeResponse(
        200, {'trackId': None, 'error': 'FirmaInvalida', 'mensaje': 'Firma inválida'}))

    with pytest.raises(dgii_client.DgiiError, match='FirmaInvalida'):
        dgii_client.enviar_ecf('01', 'testecf', 'E320000000006', '<ECF/>')


def test_enviar_ecf_sin_certificado_lanza_dgiierror(monkeypatch, _patch_comunes):
    state = _patch_comunes
    state['certificado'] = None
    _patch_post(monkeypatch, state, FakeResponse(200, {'trackId': 'X'}))

    with pytest.raises(dgii_client.DgiiError, match='certificado'):
        dgii_client.enviar_ecf('01', 'testecf', 'E320000000006', '<ECF/>')
    assert state['requests_post_calls'] == []  # no debe ni intentar el request


def test_enviar_ecf_sin_config_lanza_dgiierror(monkeypatch, _patch_comunes):
    state = _patch_comunes
    state['config'] = None
    _patch_post(monkeypatch, state, FakeResponse(200, {'trackId': 'X'}))

    with pytest.raises(dgii_client.DgiiError, match='RNC emisor'):
        dgii_client.enviar_ecf('01', 'testecf', 'E320000000006', '<ECF/>')


# ---------------------------------------------------------------------------
# enviar_rfce
# ---------------------------------------------------------------------------

def test_enviar_rfce_firma_con_app_oficial_no_con_firmar_xml(monkeypatch, _patch_comunes):
    state = _patch_comunes
    _patch_post(monkeypatch, state, FakeResponse(200, {'estado': 'Aceptado', 'codigo': '1'}))

    dgii_client.enviar_rfce('01', 'testecf', 'E320000000014', '<RFCE/>')

    assert len(state['firmar_calls']) == 1
    assert state['firmar_xml_calls'] == []


def test_enviar_rfce_host_es_fc_dgii_no_ecf_dgii(monkeypatch, _patch_comunes):
    """Bug real que este test específicamente cubre: RFCE NO vive bajo
    ecf.dgii.gov.do como los demás servicios -- vive en fc.dgii.gov.do. Un
    envío real a la URL equivocada sería silenciosamente rechazado/no
    encontrado en el sistema real de la DGII."""
    state = _patch_comunes
    _patch_post(monkeypatch, state, FakeResponse(200, {'estado': 'Aceptado', 'codigo': '1'}))

    dgii_client.enviar_rfce('01', 'certecf', 'E320000000014', '<RFCE/>')

    url = state['requests_post_calls'][0]['url']
    assert url == 'https://fc.dgii.gov.do/certecf/recepcionfc/api/recepcion/ecf'
    assert 'ecf.dgii.gov.do' not in url


def test_enviar_rfce_nombre_archivo_rnc_mas_encf(monkeypatch, _patch_comunes):
    state = _patch_comunes
    _patch_post(monkeypatch, state, FakeResponse(200, {'estado': 'Aceptado'}))

    dgii_client.enviar_rfce('01', 'testecf', 'E320000000014', '<RFCE/>')

    nombre_archivo, _contenido, _ct = state['requests_post_calls'][0]['files']['xml']
    assert nombre_archivo == '130217432E320000000014.xml'


def test_enviar_rfce_usa_el_mismo_obtener_token_que_ecf(monkeypatch, _patch_comunes):
    """La documentación oficial no define autenticación separada para
    RFCE -- confirma que enviar_rfce reutiliza obtener_token(no_cia,
    ambiente), no inventa un flujo de auth paralelo."""
    state = _patch_comunes
    _patch_post(monkeypatch, state, FakeResponse(200, {'estado': 'Aceptado'}))

    dgii_client.enviar_rfce('01', 'testecf', 'E320000000014', '<RFCE/>')

    assert len(state['token_calls']) == 1
    headers = state['requests_post_calls'][0]['headers']
    assert headers == {'Authorization': f'Bearer {FAKE_TOKEN}'}


def test_enviar_rfce_retorna_respuesta_completa_no_solo_booleano(monkeypatch, _patch_comunes):
    """Rechazado es un resultado de negocio válido (RFCE es síncrono) -- no
    debe colapsarse a True/False ni lanzar excepción, el llamador necesita
    'mensajes' para saber por qué."""
    state = _patch_comunes
    respuesta_dgii = {
        'codigo': 2, 'estado': 'Rechazado',
        'mensajes': [{'codigo': '5', 'valor': 'El e-NCF autorizado se encuentra vencido'}],
        'encf': 'E320000000014', 'secuenciaUtilizada': True,
    }
    _patch_post(monkeypatch, state, FakeResponse(200, respuesta_dgii))

    resultado = dgii_client.enviar_rfce('01', 'testecf', 'E320000000014', '<RFCE/>')

    assert resultado['estado'] == 'Rechazado'
    assert resultado['codigo'] == 2
    assert resultado['secuencia_utilizada'] is True
    assert resultado['mensajes'] == respuesta_dgii['mensajes']
    assert resultado['respuesta_cruda'] == respuesta_dgii
    assert resultado['xml_firmado'] == FAKE_XML_FIRMADO


def test_enviar_rfce_http_no_200_lanza_dgiierror(monkeypatch, _patch_comunes):
    state = _patch_comunes
    _patch_post(monkeypatch, state, FakeResponse(503, None, text='Service Unavailable'))

    with pytest.raises(dgii_client.DgiiError, match='HTTP 503'):
        dgii_client.enviar_rfce('01', 'testecf', 'E320000000014', '<RFCE/>')


def test_enviar_rfce_respuesta_no_json_lanza_dgiierror(monkeypatch, _patch_comunes):
    state = _patch_comunes
    _patch_post(monkeypatch, state, FakeResponse(200, None, text='no es json'))

    with pytest.raises(dgii_client.DgiiError, match='no JSON'):
        dgii_client.enviar_rfce('01', 'testecf', 'E320000000014', '<RFCE/>')


# ---------------------------------------------------------------------------
# reenviar_ecf (Task 4)
# ---------------------------------------------------------------------------

def test_reenviar_ecf_no_firma_de_nuevo(monkeypatch, _patch_comunes):
    """El bug concreto que este test cubre: reenviar_ecf NO debe llamar a
    firma.firmar_con_app_oficial() -- el XML ya viene firmado (guardado en
    TFE_DOCUMENTO.XML_FIRMADO), firmarlo otra vez sería double-signing."""
    state = _patch_comunes
    _patch_post(monkeypatch, state, FakeResponse(200, {'trackId': 'TRACK-2'}))

    dgii_client.reenviar_ecf('01', 'testecf', 'E320000000006', FAKE_XML_FIRMADO)

    assert state['firmar_calls'] == []
    assert state['firmar_xml_calls'] == []


def test_reenviar_ecf_url_igual_a_enviar_ecf(monkeypatch, _patch_comunes):
    state = _patch_comunes
    _patch_post(monkeypatch, state, FakeResponse(200, {'trackId': 'TRACK-2'}))

    dgii_client.reenviar_ecf('01', 'certecf', 'E320000000006', FAKE_XML_FIRMADO)

    url = state['requests_post_calls'][0]['url']
    assert url == 'https://ecf.dgii.gov.do/certecf/recepcion/api/facturaselectronicas'


def test_reenviar_ecf_envia_el_xml_firmado_tal_cual(monkeypatch, _patch_comunes):
    state = _patch_comunes
    _patch_post(monkeypatch, state, FakeResponse(200, {'trackId': 'TRACK-2'}))

    dgii_client.reenviar_ecf('01', 'testecf', 'E320000000006', FAKE_XML_FIRMADO)

    files = state['requests_post_calls'][0]['files']
    nombre_archivo, contenido, content_type = files['xml']
    assert nombre_archivo == '130217432E320000000006.xml'
    assert contenido == FAKE_XML_FIRMADO.encode('utf-8')
    assert content_type == 'text/xml'


def test_reenviar_ecf_retorna_nuevo_trackid_y_respuesta_cruda(monkeypatch, _patch_comunes):
    state = _patch_comunes
    respuesta_dgii = {'trackId': 'TRACK-NUEVO', 'error': None, 'mensaje': None}
    _patch_post(monkeypatch, state, FakeResponse(200, respuesta_dgii))

    resultado = dgii_client.reenviar_ecf(
        '01', 'testecf', 'E320000000006', FAKE_XML_FIRMADO)

    assert resultado == {'trackId': 'TRACK-NUEVO', 'respuesta_cruda': respuesta_dgii}
    assert 'xml_firmado' not in resultado


def test_reenviar_ecf_sin_trackid_lanza_dgiierror(monkeypatch, _patch_comunes):
    state = _patch_comunes
    _patch_post(monkeypatch, state, FakeResponse(
        200, {'trackId': None, 'error': 'DuplicadoTrackId', 'mensaje': 'Ya procesado'}))

    with pytest.raises(dgii_client.DgiiError, match='DuplicadoTrackId'):
        dgii_client.reenviar_ecf('01', 'testecf', 'E320000000006', FAKE_XML_FIRMADO)


def test_reenviar_ecf_http_no_200_lanza_dgiierror(monkeypatch, _patch_comunes):
    state = _patch_comunes
    _patch_post(monkeypatch, state, FakeResponse(500, None, text='Internal Server Error'))

    with pytest.raises(dgii_client.DgiiError, match='HTTP 500'):
        dgii_client.reenviar_ecf('01', 'testecf', 'E320000000006', FAKE_XML_FIRMADO)


def test_reenviar_ecf_sin_config_lanza_dgiierror(monkeypatch, _patch_comunes):
    state = _patch_comunes
    state['config'] = None
    _patch_post(monkeypatch, state, FakeResponse(200, {'trackId': 'X'}))

    with pytest.raises(dgii_client.DgiiError, match='RNC emisor'):
        dgii_client.reenviar_ecf('01', 'testecf', 'E320000000006', FAKE_XML_FIRMADO)
    assert state['requests_post_calls'] == []


# ---------------------------------------------------------------------------
# consultar_estado
# ---------------------------------------------------------------------------

def test_consultar_estado_url_y_query_param_trackid(monkeypatch, _patch_comunes):
    state = _patch_comunes
    _patch_get(monkeypatch, state, FakeResponse(200, {'trackId': 'TRACK-1', 'codigo': 1}))

    dgii_client.consultar_estado('01', 'testecf', 'TRACK-1')

    assert len(state['requests_get_calls']) == 1
    call = state['requests_get_calls'][0]
    assert call['url'] == 'https://ecf.dgii.gov.do/testecf/consultaresultado/api/consultas/estado'
    assert call['params'] == {'trackid': 'TRACK-1'}
    assert call['headers'] == {'Authorization': f'Bearer {FAKE_TOKEN}'}


def test_consultar_estado_retorna_dict_completo_no_solo_codigo(monkeypatch, _patch_comunes):
    """El caller necesita el motivo del rechazo (mensajes), no solo el
    código numérico 0-4."""
    state = _patch_comunes
    respuesta_dgii = {
        'trackId': 'TRACK-1', 'codigo': 2, 'estado': 'Rechazado',
        'rnc': '130217432', 'eNCF': 'E320000000006', 'secuenciaUtilizada': False,
        'fechaRecepcion': '2026-08-31T10:00:00Z',
        'mensajes': [{'valor': 'RNC comprador inválido', 'codigo': 12}],
    }
    _patch_get(monkeypatch, state, FakeResponse(200, respuesta_dgii))

    resultado = dgii_client.consultar_estado('01', 'testecf', 'TRACK-1')

    assert resultado == respuesta_dgii
    assert 'mensajes' in resultado
    assert not isinstance(resultado, int)


def test_consultar_estado_http_no_200_lanza_dgiierror(monkeypatch, _patch_comunes):
    state = _patch_comunes
    _patch_get(monkeypatch, state, FakeResponse(404, None, text='Not Found'))

    with pytest.raises(dgii_client.DgiiError, match='HTTP 404'):
        dgii_client.consultar_estado('01', 'testecf', 'TRACK-DESCONOCIDO')


def test_consultar_estado_respuesta_no_json_lanza_dgiierror(monkeypatch, _patch_comunes):
    state = _patch_comunes
    _patch_get(monkeypatch, state, FakeResponse(200, None, text='<html/>'))

    with pytest.raises(dgii_client.DgiiError, match='no JSON'):
        dgii_client.consultar_estado('01', 'testecf', 'TRACK-1')


def test_consultar_estado_ambiente_invalido_lanza_dgiierror(monkeypatch, _patch_comunes):
    with pytest.raises(dgii_client.DgiiError, match='Ambiente inválido'):
        dgii_client.consultar_estado('01', 'produccion-mal-escrito', 'TRACK-1')


# ---------------------------------------------------------------------------
# Ambiente inválido (comparte _base/_base_fc con Fase 1, pero se ejercita
# explícitamente vía las funciones nuevas)
# ---------------------------------------------------------------------------

def test_enviar_rfce_ambiente_invalido_lanza_dgiierror_antes_de_firmar(monkeypatch, _patch_comunes):
    state = _patch_comunes
    with pytest.raises(dgii_client.DgiiError, match='Ambiente inválido'):
        dgii_client.enviar_rfce('01', 'produccion', 'E320000000014', '<RFCE/>')
    # Alcanza a firmar (la firma no depende del ambiente) pero nunca llega
    # a intentar el request HTTP con un host inválido.
    assert state['requests_post_calls'] == []
