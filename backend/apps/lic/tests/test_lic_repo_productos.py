import json

import pytest
from apps.legacy.repositories import lic_repo


def _crear_oportunidad(no_cia="01", referencia="REF-PROD-1"):
    oportunidad_id, _ = lic_repo.upsert_oportunidad(no_cia, {"referencia": referencia, "titulo": "algo"})
    return oportunidad_id


@pytest.mark.django_db
def test_reemplazar_productos_borra_e_inserta():
    oportunidad_id = _crear_oportunidad()
    lic_repo.reemplazar_productos(oportunidad_id, [{"descripcion": "100 laptops", "cantidad": "100"}])
    assert [p["descripcion"] for p in lic_repo.list_productos(oportunidad_id)] == ["100 laptops"]

    lic_repo.reemplazar_productos(oportunidad_id, [{"descripcion": "50 impresoras", "cantidad": "50"}])
    assert [p["descripcion"] for p in lic_repo.list_productos(oportunidad_id)] == ["50 impresoras"]


@pytest.mark.django_db
def test_guardar_analisis_oportunidad_con_documentos_faltantes():
    oportunidad_id = _crear_oportunidad(referencia="REF-PROD-2")
    faltantes = [{"tipo_documento": "Registro Mercantil", "motivo": "no subido"}]
    lic_repo.guardar_analisis_oportunidad(
        oportunidad_id, "resumen", "amarillo", "recomendacion",
        documentos_faltantes=faltantes,
    )
    oportunidad = lic_repo.get_oportunidad_completa(oportunidad_id)
    assert json.loads(oportunidad["documentos_faltantes"]) == faltantes
