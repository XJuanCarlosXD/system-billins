from unittest.mock import patch

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.reportes.repo import ValidationError


@pytest.fixture
def user():
    u, _ = User.objects.get_or_create(username="JCABREU")
    return u


@pytest.fixture
def auth_client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.mark.django_db
def test_lanzar_requires_auth():
    c = APIClient()
    r = c.post("/api/reportes/agente/lanzar/")
    assert r.status_code in (401, 403)


@pytest.mark.django_db
def test_lanzar_forbidden_for_non_admin(auth_client):
    with patch("apps.reportes.views.users_repo.is_dba", return_value=False):
        r = auth_client.post("/api/reportes/agente/lanzar/")
    assert r.status_code == 403


@pytest.mark.django_db
def test_lanzar_creates_run_for_admin(auth_client):
    with patch("apps.reportes.views.users_repo.is_dba", return_value=True), \
         patch(
             "apps.reportes.views.repo.crear_run",
             return_value={"run_id": "r1", "estado": "PENDIENTE"},
         ) as create_mock:
        r = auth_client.post("/api/reportes/agente/lanzar/")
    assert r.status_code == 201
    assert r.data["estado"] == "PENDIENTE"
    create_mock.assert_called_once_with(usuario="JCABREU")


@pytest.mark.django_db
def test_lanzar_returns_409_if_ya_hay_run(auth_client):
    with patch("apps.reportes.views.users_repo.is_dba", return_value=True), \
         patch(
             "apps.reportes.views.repo.crear_run",
             side_effect=ValidationError("run_activo_existente"),
         ):
        r = auth_client.post("/api/reportes/agente/lanzar/")
    assert r.status_code == 409


@pytest.mark.django_db
def test_estado_requires_auth():
    c = APIClient()
    r = c.get("/api/reportes/agente/estado/")
    assert r.status_code in (401, 403)


@pytest.mark.django_db
def test_estado_returns_ultimo_run(auth_client):
    with patch(
        "apps.reportes.views.repo.get_ultimo_run",
        return_value={"run_id": "r1", "estado": "COMPLETADO"},
    ):
        r = auth_client.get("/api/reportes/agente/estado/")
    assert r.status_code == 200
    assert r.data["estado"] == "COMPLETADO"


@pytest.mark.django_db
def test_pendiente_rejects_without_token(settings):
    settings.AGENTE_REPORTES_TOKEN = "secreto123"
    c = APIClient()
    r = c.get("/api/reportes/agente/pendiente/")
    assert r.status_code == 403


@pytest.mark.django_db
def test_pendiente_rejects_wrong_token(settings):
    settings.AGENTE_REPORTES_TOKEN = "secreto123"
    c = APIClient()
    r = c.get(
        "/api/reportes/agente/pendiente/",
        HTTP_AUTHORIZATION="Bearer incorrecto",
    )
    assert r.status_code == 403


@pytest.mark.django_db
def test_pendiente_accepts_valid_token(settings):
    settings.AGENTE_REPORTES_TOKEN = "secreto123"
    c = APIClient()
    with patch("apps.reportes.views.repo.reclamar_pendiente", return_value=None):
        r = c.get(
            "/api/reportes/agente/pendiente/",
            HTTP_AUTHORIZATION="Bearer secreto123",
        )
    assert r.status_code == 200
    assert r.data == {"pendiente": False}


@pytest.mark.django_db
def test_resultado_updates_run(settings):
    settings.AGENTE_REPORTES_TOKEN = "secreto123"
    c = APIClient()
    with patch(
        "apps.reportes.views.repo.finalizar_run",
        return_value={"run_id": "r1", "estado": "COMPLETADO"},
    ) as finalizar_mock:
        r = c.post(
            "/api/reportes/agente/resultado/",
            data={
                "run_id": "r1", "estado": "COMPLETADO",
                "resumen": "ok", "commit_sha": "abc123",
            },
            format="json",
            HTTP_AUTHORIZATION="Bearer secreto123",
        )
    assert r.status_code == 200
    finalizar_mock.assert_called_once_with(
        "r1", estado="COMPLETADO", resumen="ok", commit_sha="abc123",
    )
