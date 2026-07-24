import pytest
from apps.legacy.repositories import lic_repo


@pytest.mark.django_db
def test_crear_y_listar_tipo_documento():
    tipo_id = lic_repo.crear_tipo_documento("TEST1", "Documento de prueba")
    tipos = lic_repo.list_tipos_documento()
    assert any(t["id"] == tipo_id and t["codigo"] == "TEST1" and t["activo"] == "S" for t in tipos)


@pytest.mark.django_db
def test_list_tipos_documento_excluye_inactivos_por_defecto():
    tipo_id = lic_repo.crear_tipo_documento("TEST2", "Otro de prueba")
    lic_repo.actualizar_tipo_documento(tipo_id, activo="N")
    activos = lic_repo.list_tipos_documento()
    todos = lic_repo.list_tipos_documento(solo_activos=False)
    assert not any(t["id"] == tipo_id for t in activos)
    assert any(t["id"] == tipo_id and t["activo"] == "N" for t in todos)


@pytest.mark.django_db
def test_guardar_documento_empresa_con_tipo_documento_id():
    tipo_id = lic_repo.crear_tipo_documento("TEST3", "Tipo para matching")
    doc_id = lic_repo.guardar_documento_empresa(
        "01", "01", "archivo.pdf", "/x/archivo.pdf", None, None, tipo_documento_id=tipo_id
    )
    docs = lic_repo.list_documentos_empresa("01")
    doc = next(d for d in docs if d["id"] == doc_id)
    assert doc["tipo_documento_id"] == tipo_id
    assert doc["tipo_documento_nombre"] == "Tipo para matching"
