"""Tests de la guardia de concurrencia en `scrape_view`.

Sin esta guardia, un "Buscar ahora" manual disparado mientras ya hay una corrida
"corriendo" (el cron diario u otro manual) para la misma empresa -- o para "todas
las empresas" (no_cia=None), que se solapa con cualquier empresa especifica --
crearia un segundo ScrapeJob y un segundo login concurrente contra el portal,
escribiendo sobre las mismas filas de Oracle a la vez. Estos tests verifican que
la vista rechaza esa segunda corrida con 409 en vez de crearla, y que casos que
genuinamente NO se solapan (empresas distintas, corridas ya terminadas) sí
proceden con normalidad.
"""
import json

import pytest
from django.contrib.auth.models import User
from django.test import Client

from apps.lic.models import ScrapeJob


@pytest.fixture
def cliente(db):
    user = User.objects.create_user(username="tester", password="x")
    c = Client()
    c.force_login(user)
    return c


@pytest.mark.django_db
def test_rechaza_con_409_si_ya_hay_corrida_para_la_misma_empresa(cliente):
    job_previo = ScrapeJob.objects.create(trigger="manual", no_cia="01", estado="corriendo")

    resp = cliente.post(
        "/api/lic/scrape/", data=json.dumps({"no_cia": "01"}), content_type="application/json"
    )

    assert resp.status_code == 409
    body = resp.json()
    assert body["job_id"] == job_previo.id
    # No se creo un segundo job.
    assert ScrapeJob.objects.filter(estado="corriendo").count() == 1


@pytest.mark.django_db
def test_rechaza_solicitud_para_empresa_especifica_si_hay_corrida_de_todas(cliente):
    job_previo = ScrapeJob.objects.create(trigger="auto", no_cia=None, estado="corriendo")

    resp = cliente.post(
        "/api/lic/scrape/", data=json.dumps({"no_cia": "01"}), content_type="application/json"
    )

    assert resp.status_code == 409
    assert resp.json()["job_id"] == job_previo.id


@pytest.mark.django_db
def test_rechaza_solicitud_de_todas_si_hay_cualquier_corrida_activa(cliente):
    job_previo = ScrapeJob.objects.create(trigger="manual", no_cia="02", estado="corriendo")

    resp = cliente.post(
        "/api/lic/scrape/", data=json.dumps({}), content_type="application/json"
    )

    assert resp.status_code == 409
    assert resp.json()["job_id"] == job_previo.id


@pytest.mark.django_db
def test_no_bloquea_empresas_distintas_sin_corrida_de_todas(cliente, mocker):
    ScrapeJob.objects.create(trigger="manual", no_cia="02", estado="corriendo")
    mocker.patch(
        "apps.lic.views.lic_repo.list_credenciales",
        return_value=[{"no_cia": "01", "estado": "activo"}],
    )
    mocker.patch("apps.lic.views.threading.Thread")

    resp = cliente.post(
        "/api/lic/scrape/", data=json.dumps({"no_cia": "01"}), content_type="application/json"
    )

    assert resp.status_code == 200
    nuevo_job_id = resp.json()["job_id"]
    assert ScrapeJob.objects.get(id=nuevo_job_id).no_cia == "01"


@pytest.mark.django_db
def test_no_bloquea_si_la_corrida_previa_ya_termino(cliente, mocker):
    ScrapeJob.objects.create(trigger="manual", no_cia="01", estado="completado")
    mocker.patch(
        "apps.lic.views.lic_repo.list_credenciales",
        return_value=[{"no_cia": "01", "estado": "activo"}],
    )
    mocker.patch("apps.lic.views.threading.Thread")

    resp = cliente.post(
        "/api/lic/scrape/", data=json.dumps({"no_cia": "01"}), content_type="application/json"
    )

    assert resp.status_code == 200
