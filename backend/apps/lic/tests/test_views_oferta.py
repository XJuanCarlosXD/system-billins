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
