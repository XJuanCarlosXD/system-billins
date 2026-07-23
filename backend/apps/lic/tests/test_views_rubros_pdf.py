"""Tests de rubros_pdf_view: status code en fallo de extraccion y deduplicacion
de nombre de archivo en subidas repetidas para la misma empresa."""
import pytest
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client


@pytest.fixture
def cliente(db):
    user = User.objects.create_user(username="tester", password="x")
    c = Client()
    c.force_login(user)
    return c


@pytest.fixture
def media_root(tmp_path, settings):
    settings.MEDIA_ROOT = str(tmp_path)
    return tmp_path


@pytest.mark.django_db
def test_error_de_extraccion_responde_400_no_500(cliente, media_root, mocker):
    mocker.patch("apps.lic.views.lic_repo.guardar_rubro_pdf", return_value=1)
    mocker.patch("apps.lic.views.lic_repo.marcar_extraccion_rubros")
    mocker.patch("apps.lic.views.lic_repo.list_rubros", return_value=[])
    mocker.patch(
        "apps.lic.views.pdf_rubros.extraer_texto_pdf",
        side_effect=RuntimeError("PDF sin texto"),
    )

    archivo = SimpleUploadedFile("certificado.pdf", b"%PDF-1.4 contenido falso")
    resp = cliente.post(
        "/api/lic/rubros-pdf/", data={"no_cia": "01", "archivo": archivo}
    )

    assert resp.status_code == 400
    assert "PDF sin texto" in resp.json()["error"]


@pytest.mark.django_db
def test_subida_repetida_del_mismo_nombre_no_pisa_el_archivo_anterior(cliente, media_root, mocker):
    mocker.patch("apps.lic.views.lic_repo.guardar_rubro_pdf", return_value=1)
    mocker.patch("apps.lic.views.lic_repo.marcar_extraccion_rubros")
    mocker.patch("apps.lic.views.lic_repo.list_rubros", return_value=[])
    mocker.patch("apps.lic.views.pdf_rubros.extraer_texto_pdf", return_value="texto")
    mocker.patch("apps.lic.views.pdf_rubros.structurar_rubros_desde_texto", return_value=[])
    mocker.patch("apps.lic.views.lic_repo.guardar_rubros")

    destino = media_root / "lic" / "01" / "rubros"

    archivo1 = SimpleUploadedFile("certificado.pdf", b"contenido original")
    resp1 = cliente.post("/api/lic/rubros-pdf/", data={"no_cia": "01", "archivo": archivo1})
    assert resp1.status_code == 200
    assert (destino / "certificado.pdf").read_bytes() == b"contenido original"

    archivo2 = SimpleUploadedFile("certificado.pdf", b"contenido nuevo")
    resp2 = cliente.post("/api/lic/rubros-pdf/", data={"no_cia": "01", "archivo": archivo2})
    assert resp2.status_code == 200

    # El archivo original no debe haber sido sobreescrito.
    assert (destino / "certificado.pdf").read_bytes() == b"contenido original"
    # Debe existir un segundo archivo fisico distinto con el contenido nuevo.
    archivos = list(destino.iterdir())
    assert len(archivos) == 2
    nombres = {p.name for p in archivos}
    assert "certificado.pdf" in nombres
    otro = next(p for p in archivos if p.name != "certificado.pdf")
    assert otro.read_bytes() == b"contenido nuevo"
