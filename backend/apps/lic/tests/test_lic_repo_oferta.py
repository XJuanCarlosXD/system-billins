import pytest
from apps.legacy.repositories import lic_repo


@pytest.mark.django_db
def test_documentos_a_subir_devuelve_solo_los_requisitos_con_documento_vigente():
    oportunidad_id, _ = lic_repo.upsert_oportunidad("01", {"referencia": "REF-OFERTA-1", "titulo": "x"})
    tipo_id = lic_repo.crear_tipo_documento("OFERTA1", "Tipo para oferta")
    doc_id = lic_repo.guardar_documento_empresa(
        "01", None, "doc.pdf", "/x/doc.pdf", None, None, tipo_documento_id=tipo_id
    )
    lic_repo.reemplazar_requisitos(oportunidad_id, [
        {"descripcion": "Tipo para oferta vigente", "estado": "cumple", "documento_empresa_id": doc_id},
        {"descripcion": "Otro requisito sin documento", "estado": "no_cumple", "documento_empresa_id": None},
    ])

    resultado = lic_repo.documentos_a_subir(oportunidad_id)

    assert resultado["listos"] == [{"documento_empresa_id": doc_id, "ruta_archivo": "/x/doc.pdf",
                                      "nombre_archivo": "doc.pdf"}]
    assert resultado["faltantes"] == ["Otro requisito sin documento"]
