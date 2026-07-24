import pytest


@pytest.fixture
def mock_client(mocker):
    return mocker.patch("apps.legacy.repositories.lic_repo.client")


@pytest.fixture(autouse=True)
def _limpiar_catalogo_tipo_documento_de_prueba():
    """Los tests de apps.lic corren contra Oracle REAL (no una BD de pruebas
    aislada/transaccional) -- ``TLIC_TIPO_DOCUMENTO.codigo`` es UNIQUE, así que un
    código de prueba fijo (TEST1, SMOKE1, etc.) que ya quedó insertado en una
    corrida anterior rompe la siguiente con ORA-00001. Se limpia ANTES de cada
    test (no solo después) para que quede bien aunque una corrida previa haya
    terminado a la fuerza sin llegar a su propio teardown."""
    from apps.legacy import client as legacy_client

    def _borrar():
        with legacy_client.cursor() as cur:
            # TLIC_REQUISITO puede referenciar (documento_empresa_id) un documento de
            # empresa de tipo de prueba dejado por una corrida anterior -- FK_TLIC_REQ_
            # DOCEMP no tiene ON DELETE CASCADE, así que se borra primero o el DELETE de
            # TLIC_DOCUMENTO_EMPRESA de abajo revienta con ORA-02292.
            cur.execute(
                "DELETE FROM FAT.TLIC_REQUISITO WHERE documento_empresa_id IN ("
                "SELECT id FROM FAT.TLIC_DOCUMENTO_EMPRESA WHERE tipo_documento_id IN ("
                "SELECT id FROM FAT.TLIC_TIPO_DOCUMENTO WHERE codigo LIKE 'TEST%' "
                "OR codigo LIKE 'SMOKE%' OR codigo LIKE 'OFERTA%'))"
            )
            cur.execute(
                "DELETE FROM FAT.TLIC_DOCUMENTO_EMPRESA WHERE tipo_documento_id IN ("
                "SELECT id FROM FAT.TLIC_TIPO_DOCUMENTO WHERE codigo LIKE 'TEST%' "
                "OR codigo LIKE 'SMOKE%' OR codigo LIKE 'OFERTA%')"
            )
            cur.execute(
                "DELETE FROM FAT.TLIC_TIPO_DOCUMENTO WHERE codigo LIKE 'TEST%' "
                "OR codigo LIKE 'SMOKE%' OR codigo LIKE 'OFERTA%'"
            )
            cur.connection.commit()

    _borrar()
    yield
    _borrar()
