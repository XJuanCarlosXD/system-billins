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


@pytest.mark.django_db
def test_buscar_precio_historico_encuentra_por_descripcion_similar():
    # Setup minimo: una factura con un detalle cuyo producto coincide por LIKE.
    from apps.legacy import client
    with client.cursor() as cur:
        cur.execute(
            "INSERT INTO FAT.TFAT_FACTURA (no_cia, punto, tipo_factura, no_factura, "
            "no_cliente, fecha, afecta_cxc, estado, st_generado_cnt, st_impresion, "
            "st_anulado, tipo_transaccion) VALUES "
            "('01', '01', 'FT', '9999999', '1', SYSDATE, 'S', 'C', 'N', 'S', 'N', 'F')"
        )
        cur.execute(
            "INSERT INTO FAT.TFAT_FACTURAL (no_cia, punto, tipo_factura, no_factura, "
            "no_linea, almacen, no_produ, descripcion, precio, cantidad, costo, empaque, cpe) "
            "VALUES ('01', '01', 'FT', '9999999', 1, '01', '00000001', "
            "'Laptop core i5 16GB', 45000, 1, 0, 1, 1)"
        )
        cur.connection.commit()

    resultados = lic_repo.buscar_precio_historico("01", "laptop core i5")

    assert any(r["descripcion"] == "Laptop core i5 16GB" and float(r["precio"]) == 45000 for r in resultados)

    with client.cursor() as cur:
        cur.execute(
            "DELETE FROM FAT.TFAT_FACTURAL WHERE no_cia='01' AND no_factura='9999999'"
        )
        cur.execute(
            "DELETE FROM FAT.TFAT_FACTURA WHERE no_cia='01' AND no_factura='9999999'"
        )
        cur.connection.commit()
