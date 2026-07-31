from rest_framework.test import APIClient


def test_mio_requires_auth():
    client = APIClient()
    resp = client.get("/api/historial/mio/")
    assert resp.status_code in (401, 403)


def test_mio_returns_own_events(monkeypatch, mock_user):
    from apps.historial import repo

    monkeypatch.setattr(
        repo, "list_mio",
        lambda usuario, limit: [{"bitacora_id": 1, "usuario": usuario, "accion": "CREAR",
                                  "descripcion": "x", "cambios": []}],
    )
    client = APIClient()
    client.force_authenticate(mock_user)
    resp = client.get("/api/historial/mio/?limit=5")
    assert resp.status_code == 200
    assert resp.json()["items"][0]["accion"] == "CREAR"


def test_admin_forbidden_for_non_dba(monkeypatch, mock_user):
    monkeypatch.setattr("apps.legacy.repositories.users_repo.is_dba", lambda u: False)
    client = APIClient()
    client.force_authenticate(mock_user)
    resp = client.get("/api/historial/")
    assert resp.status_code == 403


def test_admin_ok_for_dba(monkeypatch, mock_user):
    from apps.historial import repo

    monkeypatch.setattr("apps.legacy.repositories.users_repo.is_dba", lambda u: True)
    monkeypatch.setattr(repo, "list_admin", lambda **kw: {"items": [], "total": 0})
    client = APIClient()
    client.force_authenticate(mock_user)
    resp = client.get("/api/historial/?modulo=FAT")
    assert resp.status_code == 200
    assert resp.json() == {"items": [], "total": 0}


def test_documento_requires_params(mock_user):
    client = APIClient()
    client.force_authenticate(mock_user)
    resp = client.get("/api/historial/documento/?no_cia=01&modulo=FAT&punto=01")
    assert resp.status_code == 400


def test_documento_forbidden_without_doc_permission(monkeypatch, mock_user):
    monkeypatch.setattr("apps.legacy.repositories.users_repo.is_dba", lambda u: False)
    monkeypatch.setattr(
        "apps.legacy.repositories.permissions_repo.list_user_doc_perms",
        lambda usuario, modulo, no_cia, punto: [{"tipo_docu": "FC"}],  # FT no está asignado
    )
    client = APIClient()
    client.force_authenticate(mock_user)
    resp = client.get(
        "/api/historial/documento/?no_cia=01&punto=01&modulo=FAT&tipo_documento=FT&no_documento=0001234"
    )
    assert resp.status_code == 403


def test_documento_ok_when_user_has_doc_permission(monkeypatch, mock_user):
    from apps.historial import repo

    monkeypatch.setattr("apps.legacy.repositories.users_repo.is_dba", lambda u: False)
    monkeypatch.setattr(
        "apps.legacy.repositories.permissions_repo.list_user_doc_perms",
        lambda usuario, modulo, no_cia, punto: [{"tipo_docu": "FT"}],
    )
    monkeypatch.setattr(
        repo, "list_documento",
        lambda **kw: [{"bitacora_id": 1, "accion": "CREAR", "cambios": []}],
    )
    client = APIClient()
    client.force_authenticate(mock_user)
    resp = client.get(
        "/api/historial/documento/?no_cia=01&punto=01&modulo=FAT&tipo_documento=FT&no_documento=0001234"
    )
    assert resp.status_code == 200
    assert resp.json()["items"][0]["accion"] == "CREAR"


def test_documento_ok_for_admin_regardless_of_doc_permission(monkeypatch, mock_user):
    from apps.historial import repo

    monkeypatch.setattr("apps.legacy.repositories.users_repo.is_dba", lambda u: True)
    monkeypatch.setattr(
        "apps.legacy.repositories.permissions_repo.list_user_doc_perms",
        lambda usuario, modulo, no_cia, punto: [],  # admin no necesita tener el doc asignado
    )
    monkeypatch.setattr(repo, "list_documento", lambda **kw: [])
    client = APIClient()
    client.force_authenticate(mock_user)
    resp = client.get(
        "/api/historial/documento/?no_cia=01&punto=01&modulo=FAT&tipo_documento=FT&no_documento=0001234"
    )
    assert resp.status_code == 200
