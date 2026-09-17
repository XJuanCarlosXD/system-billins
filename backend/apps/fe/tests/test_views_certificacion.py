"""Tests de los endpoints de ``apps.fe.views.certificacion_paso2_ecf_view``
/ ``certificacion_paso2_rfce_view`` / ``certificacion_paso3_view`` --
version "bulk" (sube el Excel oficial de la DGII completo) de lo que
``pruebas_enviar_view`` hace fila por fila.

Misma estrategia que ``test_views_pruebas.py``: nunca se toca Oracle real
ni la DGII real -- se monkeypatchea ``ecf_builder``/``dgii_client`` en la
frontera.
"""
from __future__ import annotations

import io

import openpyxl
import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from apps.fe import dgii_client, ecf_builder


@pytest.fixture
def cliente_autenticado(db):
    User = get_user_model()
    user = User.objects.create_user(username='tester', password='x')
    client = Client()
    client.force_login(user)
    return client


def _excel_ecf_bytes(filas):
    """Arma un .xlsx en memoria con hoja 'ECF', misma forma que el Excel
    real de la DGII: fila 0 = headers, resto = datos."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'ECF'
    headers = ['TipoeCF', 'ENCF', 'RNCEmisor', 'RNCComprador', 'MontoTotal']
    ws.append(headers)
    for fila in filas:
        ws.append([fila.get(h) for h in headers])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()


def test_requiere_login(client, db):
    resp = client.post('/api/fe/certificacion/paso2-ecf/', data={'no_cia': '01'})
    assert resp.status_code in (302, 401, 403)


def test_sin_archivo_da_400(cliente_autenticado):
    resp = cliente_autenticado.post(
        '/api/fe/certificacion/paso2-ecf/', data={'no_cia': '01'})
    assert resp.status_code == 400
    assert 'archivo' in resp.json()['detail'].lower()


def test_envia_cada_fila_y_reporta_resultados(cliente_autenticado, monkeypatch):
    filas = [
        {'TipoeCF': 32, 'ENCF': 'E320000000006', 'RNCEmisor': '130217432',
         'RNCComprador': '131880681', 'MontoTotal': 1180},
        {'TipoeCF': 31, 'ENCF': 'E310000000001', 'RNCEmisor': '130217432',
         'RNCComprador': '131880681', 'MontoTotal': 7080},
    ]
    archivo = _excel_ecf_bytes(filas)

    build_calls = []
    monkeypatch.setattr(
        ecf_builder, 'construir_ecf_generico',
        lambda tipo, encf, datos: build_calls.append((tipo, encf)) or '<ECF/>')

    envios = []

    def fake_enviar_ecf(no_cia, ambiente, e_ncf, xml_sin_firmar):
        envios.append((ambiente, e_ncf))
        return {'trackId': f'TRACK-{e_ncf}', 'xml_firmado': '<ECF firmado/>',
                'respuesta_cruda': {'trackId': f'TRACK-{e_ncf}'}}

    monkeypatch.setattr(dgii_client, 'enviar_ecf', fake_enviar_ecf)
    monkeypatch.setattr(
        'apps.legacy.repositories.fe_repo.save_documento_enviado',
        lambda *a, **k: None)

    resp = cliente_autenticado.post(
        '/api/fe/certificacion/paso2-ecf/',
        data={'no_cia': '01', 'archivo': _as_upload(archivo)},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body['resultados']) == 2
    assert all(r['ok'] for r in body['resultados'])
    assert {e for _, e in envios} == {'E320000000006', 'E310000000001'}
    # SIEMPRE certecf, sin importar TFE_CONFIG.ambiente -- mismo requisito
    # de seguridad que pruebas_enviar_view.
    assert all(amb == 'certecf' for amb, _ in envios)


def test_fila_con_error_no_detiene_las_demas(cliente_autenticado, monkeypatch):
    filas = [
        {'TipoeCF': 32, 'ENCF': 'E320000000006', 'RNCEmisor': '130217432',
         'RNCComprador': '131880681', 'MontoTotal': 1180},
        {'TipoeCF': 31, 'ENCF': 'E310000000001', 'RNCEmisor': '130217432',
         'RNCComprador': '131880681', 'MontoTotal': 7080},
    ]
    archivo = _excel_ecf_bytes(filas)

    def fake_construir(tipo, encf, datos):
        if encf == 'E320000000006':
            raise ecf_builder.ECFBuilderError('dato invalido')
        return '<ECF/>'

    monkeypatch.setattr(ecf_builder, 'construir_ecf_generico', fake_construir)
    monkeypatch.setattr(
        dgii_client, 'enviar_ecf',
        lambda no_cia, ambiente, e_ncf, xml: {
            'trackId': 'T1', 'xml_firmado': '<x/>', 'respuesta_cruda': {}})
    monkeypatch.setattr(
        'apps.legacy.repositories.fe_repo.save_documento_enviado',
        lambda *a, **k: None)

    resp = cliente_autenticado.post(
        '/api/fe/certificacion/paso2-ecf/',
        data={'no_cia': '01', 'archivo': _as_upload(archivo)},
    )
    assert resp.status_code == 200
    resultados = {r['encf']: r for r in resp.json()['resultados']}
    assert resultados['E320000000006']['ok'] is False
    assert resultados['E310000000001']['ok'] is True


def _as_upload(contenido: bytes):
    from django.core.files.uploadedfile import SimpleUploadedFile
    return SimpleUploadedFile(
        'set-pruebas.xlsx', contenido,
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
