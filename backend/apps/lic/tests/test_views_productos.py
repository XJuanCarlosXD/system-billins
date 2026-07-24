from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from apps.legacy.repositories import lic_repo


@pytest.fixture
def cliente_autenticado(db):
    User = get_user_model()
    user = User.objects.create_user(username="tester2", password="x")
    client = Client()
    client.force_login(user)
    return client


@pytest.mark.django_db
def test_get_productos_de_oportunidad(cliente_autenticado):
    oportunidad_id, _ = lic_repo.upsert_oportunidad("01", {"referencia": "REF-VIEW-1", "titulo": "x"})
    lic_repo.reemplazar_productos(oportunidad_id, [{"descripcion": "50 sillas"}])
    resp = cliente_autenticado.get(f"/api/lic/oportunidades/{oportunidad_id}/productos/")
    assert resp.status_code == 200
    assert resp.json()["productos"][0]["descripcion"] == "50 sillas"


@pytest.mark.django_db
def test_recomendar_precios_de_la_oportunidad(cliente_autenticado):
    oportunidad_id, _ = lic_repo.upsert_oportunidad("01", {"referencia": "REF-VIEW-2", "titulo": "x"})
    lic_repo.reemplazar_productos(oportunidad_id, [
        {"descripcion": "100 laptops", "cantidad": "100"},
        {"descripcion": "Servicio de instalación", "cantidad": "1"},
    ])

    with patch("apps.lic.views.lic_repo.buscar_precio_historico") as buscar, \
         patch("apps.lic.views.recomendar_precios") as recomendar:
        buscar.return_value = []
        productos = lic_repo.list_productos(oportunidad_id)
        recomendar.return_value = {
            productos[0]["id"]: {"precio_sugerido": None, "justificacion": "Sin historial"},
            productos[1]["id"]: {"precio_sugerido": None, "justificacion": "Sin historial"},
        }
        resp = cliente_autenticado.post(f"/api/lic/oportunidades/{oportunidad_id}/recomendar-precios/")

    assert resp.status_code == 200
    assert recomendar.call_count == 1  # UNA sola llamada para los 2 productos
    body = resp.json()
    assert len(body["recomendaciones"]) == 2
