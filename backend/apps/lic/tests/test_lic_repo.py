import re

from apps.legacy.repositories import lic_repo


def _bind_names(sql: str) -> set[str]:
    """Nombres de bind (:name) que aparecen en el SQL, ignorando literales
    entre comillas simples (p.ej. 'YYYY-MM-DD HH24:MI' no debe contar como
    un bind ':MI')."""
    sql_sin_literales = re.sub(r"'[^']*'", "", sql)
    return set(re.findall(r":([A-Za-z_]\w*)", sql_sin_literales))


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


def test_upsert_oportunidad_insert_binds_match_placeholders(mock_client):
    """Regresion ORA-01036: el dict de binds del INSERT no debe traer claves
    que no aparezcan como :placeholder en el SQL (oracledb thick mode lo
    rechaza con 'illegal variable name/number')."""
    mock_client.fetch_dicts.return_value = []
    cur = mock_client.cursor.return_value.__enter__.return_value
    lic_repo.upsert_oportunidad(
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
    sql, params = cur.execute.call_args[0]
    assert set(params.keys()) == _bind_names(sql)


def test_list_oportunidades_retorna_total_y_oportunidades(mock_client):
    mock_client.fetch_dicts.side_effect = [
        [{"total": 3}],
        [{"id": 1, "documentos_faltantes": None}],
    ]
    resultado = lic_repo.list_oportunidades("01")
    assert resultado["total"] == 3
    assert resultado["oportunidades"] == [{"id": 1, "documentos_faltantes": []}]


def test_list_oportunidades_sin_page_size_no_pagina(mock_client):
    mock_client.fetch_dicts.side_effect = [[{"total": 0}], []]
    lic_repo.list_oportunidades("01")
    sql_conteo, params_conteo = mock_client.fetch_dicts.call_args_list[0][0]
    sql_filas, params_filas = mock_client.fetch_dicts.call_args_list[1][0]
    assert "ROWNUM" not in sql_filas
    assert set(params_conteo.keys()) == _bind_names(sql_conteo)
    assert set(params_filas.keys()) == _bind_names(sql_filas)


def test_list_oportunidades_con_page_size_pagina_con_rownum(mock_client):
    """Oracle 11g (BD real, verificado en vivo el 2026-07-27) no soporta
    OFFSET/FETCH -- se pagina con el patrón clásico de ROWNUM anidado."""
    mock_client.fetch_dicts.side_effect = [[{"total": 50}], []]
    lic_repo.list_oportunidades("01", page=3, page_size=20)
    sql_filas, params_filas = mock_client.fetch_dicts.call_args_list[1][0]
    assert "ROWNUM <= :fila_hasta" in sql_filas
    assert "rnum > :fila_desde" in sql_filas
    assert params_filas["fila_hasta"] == 60
    assert params_filas["fila_desde"] == 40
    assert set(params_filas.keys()) == _bind_names(sql_filas)


def test_list_oportunidades_solo_santo_domingo_agrega_filtro_lugar(mock_client):
    mock_client.fetch_dicts.side_effect = [[{"total": 0}], []]
    lic_repo.list_oportunidades("01", solo_santo_domingo=True)
    sql_conteo = mock_client.fetch_dicts.call_args_list[0][0][0]
    sql_filas = mock_client.fetch_dicts.call_args_list[1][0][0]
    assert "UPPER(lugar_entrega) LIKE '%SANTO DOMINGO%'" in sql_conteo
    assert "UPPER(lugar_entrega) LIKE '%SANTO DOMINGO%'" in sql_filas
    assert "DISTRITO NACIONAL" in sql_filas


def test_list_oportunidades_sin_solo_santo_domingo_no_agrega_filtro(mock_client):
    # "lugar_entrega" SI aparece en el SELECT (columna siempre traida) -- lo que no
    # debe aparecer es el filtro LIKE cuando solo_santo_domingo=False (default).
    mock_client.fetch_dicts.side_effect = [[{"total": 0}], []]
    lic_repo.list_oportunidades("01", solo_santo_domingo=False)
    sql_filas = mock_client.fetch_dicts.call_args_list[1][0][0]
    assert "UPPER(lugar_entrega) LIKE" not in sql_filas


def test_upsert_oportunidad_update_binds_match_placeholders(mock_client):
    """Regresion ORA-01036: idem para la rama UPDATE, que es la que
    realmente fallaba (el dict compartido traia no_cia/referencia, que el
    UPDATE no usa)."""
    mock_client.fetch_dicts.return_value = [{"id": 1}]
    cur = mock_client.cursor.return_value.__enter__.return_value
    lic_repo.upsert_oportunidad(
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
    sql, params = cur.execute.call_args[0]
    assert set(params.keys()) == _bind_names(sql)
