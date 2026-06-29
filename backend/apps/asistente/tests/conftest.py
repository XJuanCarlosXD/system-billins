"""pytest fixtures comunes a apps.asistente.tests."""

import pytest


@pytest.fixture
def mock_user(db):
    """Usuario Django barebones para tests de views.

    Tests que necesiten flags de modulos legacy montaran su propio
    monkeypatch sobre apps.asistente.tools.permissions.get_user_module_flags.
    """
    from django.contrib.auth import get_user_model

    User = get_user_model()
    return User.objects.create_user(username="ZZTEST", password="x")
