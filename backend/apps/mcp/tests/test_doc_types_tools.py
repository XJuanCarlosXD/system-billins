from apps.mcp.doc_types import register_module, ModuleEntry, TipoDocSchema, _REGISTRY
from apps.mcp.tools.doc_types_tools import doc_tipos_listar, doc_tipos_describir


def setup_function():
    _REGISTRY.clear()


def _listar(cia, pto):
    return [{"codigo": "F", "descripcion": "Factura credito"}]


def _describir(cia, pto, tipo):
    if tipo != "F":
        return None
    return TipoDocSchema(codigo="F", descripcion="Factura credito", afecta_cxc=True, usa_ncf=True)


def test_listar_unknown_module():
    out = doc_tipos_listar("xxx", "01")
    assert out["ok"] is False
    assert out["error_code"] == "VALIDATION_ERROR"


def test_listar_ok_with_registered_module():
    register_module(ModuleEntry(
        modulo="fat", tabla="TFAT_TDOCU",
        listar_fn=_listar, describir_fn=_describir,
    ))
    out = doc_tipos_listar("fat", "01")
    assert out["ok"]
    assert out["data"]["tipos"][0]["codigo"] == "F"


def test_describir_returns_full_schema():
    register_module(ModuleEntry(
        modulo="fat", tabla="TFAT_TDOCU",
        listar_fn=_listar, describir_fn=_describir,
    ))
    out = doc_tipos_describir("fat", "01", "F")
    assert out["ok"]
    assert out["data"]["efectos"]["usa_ncf"] is True


def test_describir_unknown_type_returns_not_found():
    register_module(ModuleEntry(
        modulo="fat", tabla="TFAT_TDOCU",
        listar_fn=_listar, describir_fn=_describir,
    ))
    out = doc_tipos_describir("fat", "01", "ZZ")
    assert out["error_code"] == "NOT_FOUND"
