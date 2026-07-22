from apps.legacy.repositories import lic_repo


def test_get_credencial_returns_none_when_missing(mock_client):
    mock_client.fetch_dicts.return_value = []
    assert lic_repo.get_credencial("01") is None


def test_get_credencial_returns_row(mock_client):
    mock_client.fetch_dicts.return_value = [
        {"no_cia": "01", "usuario_portal": "abregonza", "estado": "activo"}
    ]
    result = lic_repo.get_credencial("01")
    assert result["usuario_portal"] == "abregonza"


def test_upsert_credencial_inserts_when_new(mock_client):
    mock_client.fetch_dicts.return_value = []
    cur = mock_client.cursor.return_value.__enter__.return_value
    lic_repo.upsert_credencial("01", "abregonza", "cifrado123")
    assert cur.execute.call_count == 1
    sql = cur.execute.call_args[0][0]
    assert "INSERT INTO FAT.TLIC_CREDENCIAL" in sql


def test_upsert_credencial_updates_when_existing(mock_client):
    mock_client.fetch_dicts.return_value = [{"id": 1}]
    cur = mock_client.cursor.return_value.__enter__.return_value
    lic_repo.upsert_credencial("01", "abregonza", "cifrado123")
    sql = cur.execute.call_args[0][0]
    assert "UPDATE FAT.TLIC_CREDENCIAL" in sql


def test_upsert_oportunidad_returns_is_new_true_for_first_seen(mock_client):
    mock_client.fetch_dicts.return_value = []
    oportunidad_id, is_new = lic_repo.upsert_oportunidad(
        "01",
        {
            "referencia": "HPDEF-DAF-CM-2026-0021",
            "opportunity_uid": "DO1.OPDOS.5660234",
            "tipo_proceso": "Contratación Menor",
            "entidad": "Hospital Provincial Dr. Elio Fiallo",
            "titulo": "ADQUISICION DE AIRE ACONDICIONADO, TV E IMPRESORA",
            "estado_portal": "SELECCIÓN",
            "ofertas_presentadas": 0,
            "ofertas_creadas": 1,
            "fecha_publicacion": "2026-07-21 14:40",
            "fecha_limite": "2026-07-28 11:00",
        },
    )
    assert is_new is True


def test_upsert_oportunidad_returns_is_new_false_when_seen_before(mock_client):
    mock_client.fetch_dicts.return_value = [{"id": 42}]
    oportunidad_id, is_new = lic_repo.upsert_oportunidad(
        "01",
        {
            "referencia": "HPDEF-DAF-CM-2026-0021",
            "opportunity_uid": "DO1.OPDOS.5660234",
            "tipo_proceso": "Contratación Menor",
            "entidad": "Hospital Provincial Dr. Elio Fiallo",
            "titulo": "ADQUISICION DE AIRE ACONDICIONADO, TV E IMPRESORA",
            "estado_portal": "SELECCIÓN",
            "ofertas_presentadas": 0,
            "ofertas_creadas": 1,
            "fecha_publicacion": "2026-07-21 14:40",
            "fecha_limite": "2026-07-28 11:00",
        },
    )
    assert oportunidad_id == 42
    assert is_new is False
