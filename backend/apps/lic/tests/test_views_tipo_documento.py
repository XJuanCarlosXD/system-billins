from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from apps.legacy.repositories import lic_repo


@pytest.fixture
def cliente_autenticado(db):
    User = get_user_model()
    user = User.objects.create_user(username="tester", password="x")
    client = Client()
    client.force_login(user)
    return client


@pytest.mark.django_db
def test_get_tipos_documento_devuelve_catalogo(cliente_autenticado):
    lic_repo.crear_tipo_documento("SMOKE1", "Tipo de prueba smoke")
    resp = cliente_autenticado.get("/api/lic/tipos-documento/")
    assert resp.status_code == 200
    assert any(t["codigo"] == "SMOKE1" for t in resp.json()["tipos"])


@pytest.mark.django_db
def test_post_tipos_documento_crea_uno_nuevo(cliente_autenticado):
    resp = cliente_autenticado.post(
        "/api/lic/tipos-documento/",
        data={"codigo": "SMOKE2", "nombre": "Otro tipo smoke"},
        content_type="application/json",
    )
    assert resp.status_code == 201
    assert resp.json()["tipo"]["codigo"] == "SMOKE2"


@pytest.mark.django_db
def test_patch_tipo_documento_desactiva(cliente_autenticado):
    tipo_id = lic_repo.crear_tipo_documento("SMOKE3", "Tipo a desactivar")
    resp = cliente_autenticado.patch(
        f"/api/lic/tipos-documento/{tipo_id}/",
        data={"activo": "N"},
        content_type="application/json",
    )
    assert resp.status_code == 200
    activos = lic_repo.list_tipos_documento()
    assert not any(t["id"] == tipo_id for t in activos)


@pytest.mark.django_db
def test_descargar_documento_empresa_devuelve_404_si_no_existe(cliente_autenticado):
    resp = cliente_autenticado.get("/api/lic/documentos-empresa/999999/descargar/")
    assert resp.status_code == 404


@pytest.mark.django_db
def test_descargar_documento_empresa_sirve_el_archivo(cliente_autenticado, tmp_path):
    archivo = tmp_path / "prueba.pdf"
    archivo.write_bytes(b"%PDF-1.4 contenido de prueba")
    doc_id = lic_repo.guardar_documento_empresa(
        "01", None, "prueba.pdf", str(archivo), None, None
    )
    resp = cliente_autenticado.get(f"/api/lic/documentos-empresa/{doc_id}/descargar/")
    assert resp.status_code == 200
    assert b"".join(resp.streaming_content) == b"%PDF-1.4 contenido de prueba"
