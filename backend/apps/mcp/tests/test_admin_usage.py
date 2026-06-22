"""Tests para /api/admin/mcp/usage/.

Mockea apps.legacy.client (oracle.fetch_one / oracle.fetch_all) y is_dba.
No depende de seed real en Oracle.
"""
from unittest.mock import patch

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient


@pytest.fixture
def dba_client():
    u, _ = User.objects.get_or_create(username="JCABREU")
    c = APIClient()
    c.force_authenticate(user=u)
    return c


@pytest.mark.django_db
def test_usage_requires_dba(dba_client):
    with patch("apps.auth_legacy.views.users_repo.is_dba", return_value=False):
        r = dba_client.get("/api/admin/mcp/usage/")
    assert r.status_code == 403


@pytest.mark.django_db
def test_usage_returns_kpis_and_top_tools(dba_client):
    kpi_row = (5, 4, 1, 100, 150, 180, 1, 1)
    serie_rows = [("2026-06-22T10:00", 4, 1, 150)]
    tools_rows = [("fat_listar_facturas", 5, 0.2, 150)]
    users_rows = [("JCABREU", 5, "2026-06-22T10:30")]
    err_rows = [("PERMISSION_DENIED", 1, "fat_listar_facturas")]
    dl_rows = []

    with patch("apps.auth_legacy.views.users_repo.is_dba", return_value=True), \
         patch("apps.mcp.views_usage.oracle.fetch_one", return_value=kpi_row), \
         patch(
             "apps.mcp.views_usage.oracle.fetch_all",
             side_effect=[serie_rows, tools_rows, users_rows, err_rows, dl_rows],
         ):
        r = dba_client.get("/api/admin/mcp/usage/")

    assert r.status_code == 200
    body = r.json()
    assert body["kpis"]["total_calls"] == 5
    assert body["kpis"]["calls_ok"] == 4
    assert body["kpis"]["calls_error"] == 1
    assert body["kpis"]["error_rate"] == 0.2
    assert body["serie_temporal"] == [
        {"bucket": "2026-06-22T10:00", "ok": 4, "error": 1, "p95_ms": 150}
    ]
    assert any(t["tool"] == "fat_listar_facturas" for t in body["top_tools"])
    assert body["top_usuarios"][0]["usuario"] == "JCABREU"
    assert body["top_errores"][0]["error_code"] == "PERMISSION_DENIED"


@pytest.mark.django_db
def test_usage_empty_when_no_data(dba_client):
    with patch("apps.auth_legacy.views.users_repo.is_dba", return_value=True), \
         patch("apps.mcp.views_usage.oracle.fetch_one", return_value=(0, 0, 0, 0, 0, 0, 0, 0)), \
         patch("apps.mcp.views_usage.oracle.fetch_all", return_value=[]):
        r = dba_client.get("/api/admin/mcp/usage/")
    assert r.status_code == 200
    body = r.json()
    assert body["kpis"]["total_calls"] == 0
    assert body["kpis"]["error_rate"] == 0.0
    assert body["serie_temporal"] == []
