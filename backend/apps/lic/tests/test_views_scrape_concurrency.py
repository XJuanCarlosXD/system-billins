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
import datetime
import json

import pytest
from django.contrib.auth.models import User
from django.test import Client
from django.utils import timezone

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


@pytest.mark.django_db
def test_no_bloquea_job_corriendo_pero_huerfano_por_antiguedad(cliente, mocker):
    """Un ScrapeJob "corriendo" mas viejo que SCRAPE_JOB_STALE_MINUTES se trata como
    huerfano (el contenedor corre `uvicorn --reload`, un deploy a mitad de un scrape
    mata el hilo sin que llegue a marcar estado="error") y no debe bloquear un nuevo
    intento para el mismo alcance."""
    job_viejo = ScrapeJob.objects.create(trigger="manual", no_cia="01", estado="corriendo")
    # auto_now_add impide fijar iniciado_en en el create(); se sobreescribe despues
    # con un .update() a nivel de queryset, que si lo permite.
    ScrapeJob.objects.filter(id=job_viejo.id).update(
        iniciado_en=timezone.now() - datetime.timedelta(minutes=61)
    )
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
    assert nuevo_job_id != job_viejo.id


@pytest.mark.django_db
def test_scrape_job_view_marca_error_a_un_job_huerfano_por_antiguedad(cliente):
    """Regresion 2026-07-27: un job "corriendo" huerfano (hilo real muerto por un
    reinicio de uvicorn --reload a mitad de la corrida) se quedaba reportando
    "corriendo" para siempre via GET /scrape/<id>/, dejando el spinner del
    frontend trabado indefinidamente aunque la guardia de POST /scrape/ ya lo
    tratara como huerfano para permitir una corrida nueva."""
    job_viejo = ScrapeJob.objects.create(trigger="manual", no_cia="01", estado="corriendo")
    ScrapeJob.objects.filter(id=job_viejo.id).update(
        iniciado_en=timezone.now() - datetime.timedelta(minutes=61)
    )

    resp = cliente.get(f"/api/lic/scrape/{job_viejo.id}/")

    assert resp.status_code == 200
    assert resp.json()["estado"] == "error"
    job_viejo.refresh_from_db()
    assert job_viejo.estado == "error"
    assert job_viejo.terminado_en is not None


@pytest.mark.django_db
def test_scrape_job_view_no_toca_job_corriendo_reciente(cliente):
    job = ScrapeJob.objects.create(trigger="manual", no_cia="01", estado="corriendo")

    resp = cliente.get(f"/api/lic/scrape/{job.id}/")

    assert resp.status_code == 200
    assert resp.json()["estado"] == "corriendo"
    job.refresh_from_db()
    assert job.estado == "corriendo"
