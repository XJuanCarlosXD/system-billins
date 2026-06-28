"""Tests para endpoints admin /api/admin/mcp/tokens/.

Adaptado al stack DRF + apps.legacy.client. En vez de helper login_as_dba
inexistente, usa APIClient.force_authenticate + mock de users_repo.is_dba.
"""
from unittest.mock import patch

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient


@pytest.fixture
def user():
    u, _ = User.objects.get_or_create(username="JCABREU")
    return u


@pytest.fixture
def dba_client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.mark.django_db
def test_list_requires_auth():
    c = APIClient()
    r = c.get("/api/admin/mcp/tokens/")
    assert r.status_code in (401, 403)


@pytest.mark.django_db
def test_list_forbidden_for_non_dba(dba_client):
    with patch("apps.auth_legacy.views.users_repo.is_dba", return_value=False):
        r = dba_client.get("/api/admin/mcp/tokens/")
    assert r.status_code == 403


@pytest.mark.django_db
def test_create_returns_plaintext_once(dba_client):
    with patch("apps.auth_legacy.views.users_repo.is_dba", return_value=True), \
         patch(
             "apps.mcp.views_admin.create_token_row",
             return_value=("tk1", "mcp_abcdefgh_" + "X" * 32),
         ) as create_mock, \
         patch("apps.mcp.views_admin.oracle.fetch_all", return_value=[]):
        r = dba_client.post(
            "/api/admin/mcp/tokens/",
            data={
                "usuario": "MARIA", "nombre": "Laptop",
                "no_cia": "01", "bloquear_cia": True,
                "punto": "01", "bloquear_punto": False,
                "expira_dias": 30,
            },
            format="json",
        )
        assert r.status_code == 201
        body = r.json()
        assert body["plaintext"].startswith("mcp_")
        assert body["token_id"] == "tk1"
        create_mock.assert_called_once()

        lst = dba_client.get("/api/admin/mcp/tokens/").json()
        assert all("plaintext" not in t for t in lst["items"])


@pytest.mark.django_db
def test_revoke_marks_inactive(dba_client):
    with patch("apps.auth_legacy.views.users_repo.is_dba", return_value=True), \
         patch("apps.mcp.views_admin.oracle.execute", return_value=1) as exe, \
         patch(
             "apps.mcp.views_admin.oracle.fetch_one",
             return_value=("N", "Laptop"),
         ), \
         patch("apps.mcp.views_admin.invalidate_cache") as inv:
        r = dba_client.patch(
            "/api/admin/mcp/tokens/tk1/",
            data={"st_activo": "N"},
            format="json",
        )
        assert r.status_code == 200
        assert r.json()["st_activo"] == "N"
        assert exe.called
        inv.assert_called_once()
