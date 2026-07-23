"""Tests del manejo de JSON invalido en las vistas que parsean `request.body`.

Antes de este fix, `json.loads(request.body or b"{}")` sin try/except causaba un
500 con traceback ante un body malformado, en vez del 400 limpio que ya usa
`apps/fe/views.py` para el mismo caso."""
import pytest
from django.contrib.auth.models import User
from django.test import Client


@pytest.fixture
def cliente(db):
    user = User.objects.create_user(username="tester", password="x")
    c = Client()
    c.force_login(user)
    return c


@pytest.mark.django_db
def test_credenciales_view_400_en_json_invalido(cliente):
    resp = cliente.post(
        "/api/lic/credenciales/", data="{esto no es json", content_type="application/json"
    )
    assert resp.status_code == 400
    assert resp.json()["error"] == "JSON inválido"


@pytest.mark.django_db
def test_probar_conexion_view_400_en_json_invalido(cliente):
    resp = cliente.post(
        "/api/lic/credenciales/probar-conexion/",
        data="{esto no es json",
        content_type="application/json",
    )
    assert resp.status_code == 400
    assert resp.json()["error"] == "JSON inválido"


@pytest.mark.django_db
def test_scrape_view_400_en_json_invalido(cliente):
    resp = cliente.post(
        "/api/lic/scrape/", data="{esto no es json", content_type="application/json"
    )
    assert resp.status_code == 400
    assert resp.json()["error"] == "JSON inválido"
