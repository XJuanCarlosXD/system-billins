"""pytest fixtures comunes a apps.reportes.tests."""

import pytest


@pytest.fixture
def mock_user(db):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    return User.objects.create_user(username="ZZTEST", password="x")
