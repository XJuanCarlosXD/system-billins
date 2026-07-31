from apps.historial.diff import diff_campos

DENYLIST_DEFAULT = {"no_cia", "punto", "usuario", "fecha_sysdate", "no_docu", "no_factura"}


def test_diff_campos_detects_changed_field():
    antes = {"total": 1500.0, "condicion_pago": "CONTADO"}
    despues = {"total": 1800.0, "condicion_pago": "CONTADO"}
    cambios = diff_campos(antes, despues)
    assert cambios == [
        {"campo": "total", "etiqueta": "Total", "valor_anterior": "1500.0", "valor_nuevo": "1800.0"},
    ]


def test_diff_campos_no_changes_returns_empty_list():
    antes = {"total": 1500.0}
    despues = {"total": 1500.0}
    assert diff_campos(antes, despues) == []


def test_diff_campos_ignores_denylisted_fields():
    antes = {"total": 1500.0, "no_cia": "01", "usuario": "JCABREU"}
    despues = {"total": 1500.0, "no_cia": "02", "usuario": "MPILAR"}
    assert diff_campos(antes, despues) == []


def test_diff_campos_ignores_keys_missing_in_either_side():
    antes = {"total": 1500.0, "solo_antes": "x"}
    despues = {"total": 1500.0, "solo_despues": "y"}
    assert diff_campos(antes, despues) == []


def test_diff_campos_uses_etiqueta_map_when_present():
    antes = {"condicion_pago": "CONTADO"}
    despues = {"condicion_pago": "CREDITO"}
    cambios = diff_campos(antes, despues, etiquetas={"condicion_pago": "Condición de pago"})
    assert cambios == [
        {"campo": "condicion_pago", "etiqueta": "Condición de pago",
         "valor_anterior": "CONTADO", "valor_nuevo": "CREDITO"},
    ]


def test_diff_campos_autohumaniza_etiqueta_sin_mapa():
    antes = {"forma_pago_fat": "01"}
    despues = {"forma_pago_fat": "02"}
    cambios = diff_campos(antes, despues)
    assert cambios[0]["etiqueta"] == "Forma pago fat"


def test_diff_campos_none_values_se_muestran_como_vacio():
    antes = {"nota": None}
    despues = {"nota": "urgente"}
    cambios = diff_campos(antes, despues)
    assert cambios == [
        {"campo": "nota", "etiqueta": "Nota", "valor_anterior": "", "valor_nuevo": "urgente"},
    ]
