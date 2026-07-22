import pytest


@pytest.fixture
def mock_client(mocker):
    return mocker.patch("apps.legacy.repositories.lic_repo.client")
