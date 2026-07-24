from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from apps.legacy.repositories import lic_repo


@pytest.fixture
def cliente_autenticado(db):
    User = get_user_model()
    user = User.objects.create_user(username="tester3", password="x")
    client = Client()
    client.force_login(user)
    return client


@pytest.mark.django_db
def test_preparar_oferta_view_dispara_job_y_responde_job_id(cliente_autenticado):
    oportunidad_id, _ = lic_repo.upsert_oportunidad("01", {"referencia": "REF-OFERTA-2", "titulo": "x"})

    with patch("apps.lic.views.threading.Thread") as ThreadCls:
        resp = cliente_autenticado.post(f"/api/lic/oportunidades/{oportunidad_id}/preparar-oferta/")

    assert resp.status_code == 200
    assert "job_id" in resp.json()
    ThreadCls.return_value.start.assert_called_once()


@pytest.mark.django_db
def test_confirmar_envio_oferta_view_requiere_job_listo_para_enviar(cliente_autenticado):
    oportunidad_id, _ = lic_repo.upsert_oportunidad("01", {"referencia": "REF-OFERTA-3", "titulo": "x"})
    from apps.lic.models import OfertaJob
    OfertaJob.objects.create(oportunidad_id=oportunidad_id, estado="faltan_documentos")

    resp = cliente_autenticado.post(f"/api/lic/oportunidades/{oportunidad_id}/confirmar-envio-oferta/")

    assert resp.status_code == 400
    assert "faltan" in resp.json()["error"].lower()


@pytest.mark.django_db
def test_confirmar_envio_oferta_view_envia_cuando_esta_listo(cliente_autenticado):
    oportunidad_id, _ = lic_repo.upsert_oportunidad("01", {"referencia": "REF-OFERTA-4", "titulo": "x"})
    from apps.lic.models import OfertaJob
    OfertaJob.objects.create(oportunidad_id=oportunidad_id, estado="listo_para_enviar")
    credencial = {"no_cia": "01", "usuario_portal": "abregonza", "password_cifrado": "x"}

    with patch("apps.lic.views.lic_repo.get_credencial_con_password", return_value=credencial), \
         patch("apps.lic.views.crypto.decrypt", return_value="plain"), \
         patch("apps.lic.views.LicitacionesScraper") as ScraperCls:
        scraper_instance = MagicMock()
        scraper_instance.confirmar_envio_oferta.return_value = {"enviado": True}
        ScraperCls.return_value.__enter__.return_value = scraper_instance
        resp = cliente_autenticado.post(f"/api/lic/oportunidades/{oportunidad_id}/confirmar-envio-oferta/")

    assert resp.status_code == 200
    scraper_instance.confirmar_envio_oferta.assert_called_once_with("REF-OFERTA-4")
