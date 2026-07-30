import pytest

from apps.reportes import repo


@pytest.fixture
def mock_client(mocker):
    return mocker.patch("apps.reportes.repo.client")


def test_crear_run_returns_pendiente(mock_client):
    cur = mock_client.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = None  # get_run_activo: no hay run activo

    result = repo.crear_run(usuario="JCABREU")

    assert result["estado"] == "PENDIENTE"
    assert cur.execute.call_count == 2  # SELECT get_run_activo + INSERT
    insert_sql = cur.execute.call_args_list[1][0][0]
    assert "INSERT INTO ABREGONZA.TREP_AGENTE_RUN" in insert_sql


def test_crear_run_rejects_if_run_activo(mock_client):
    cur = mock_client.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = ("r1", "PENDIENTE", "JCABREU", None)
    cur.description = [
        ("RUN_ID",), ("ESTADO",), ("SOLICITADO_POR",), ("FECHA_SOLICITUD",),
    ]

    with pytest.raises(repo.ValidationError):
        repo.crear_run(usuario="JCABREU")


def test_reclamar_pendiente_returns_none_if_no_run(mock_client):
    cur = mock_client.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = None

    assert repo.reclamar_pendiente() is None


def test_reclamar_pendiente_claims_and_returns_abiertos(mock_client):
    cur = mock_client.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = ("run-1",)
    cur.rowcount = 1
    cur.fetchall.return_value = [
        ("rep-1", "FAT", "Factura no cuadra", "descripcion larga"),
    ]

    result = repo.reclamar_pendiente()

    assert result["run_id"] == "run-1"
    assert result["reportes"][0]["reporte_id"] == "rep-1"
    assert result["reportes"][0]["descripcion"] == "descripcion larga"


def test_reclamar_pendiente_returns_none_on_race(mock_client):
    cur = mock_client.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = ("run-1",)
    cur.rowcount = 0  # otro proceso ya lo reclamo entre el SELECT y el UPDATE

    assert repo.reclamar_pendiente() is None


def test_finalizar_run_completado(mock_client):
    cur = mock_client.cursor.return_value.__enter__.return_value
    cur.rowcount = 1

    result = repo.finalizar_run(
        "run-1", estado="completado", resumen="ok", commit_sha="abc123"
    )

    assert result == {"run_id": "run-1", "estado": "COMPLETADO"}


def test_finalizar_run_estado_invalido():
    with pytest.raises(repo.ValidationError):
        repo.finalizar_run("run-1", estado="RARO", resumen="", commit_sha=None)


def test_finalizar_run_not_found(mock_client):
    cur = mock_client.cursor.return_value.__enter__.return_value
    cur.rowcount = 0

    with pytest.raises(LookupError):
        repo.finalizar_run("run-1", estado="ERROR", resumen="x", commit_sha=None)
