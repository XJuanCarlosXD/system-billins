from unittest.mock import patch

from apps.lic.services.recomendar_precio import recomendar_precios


def test_recomendar_precios_una_sola_llamada_para_varios_productos():
    productos = [
        {"id": 1, "descripcion": "100 laptops core i5"},
        {"id": 2, "descripcion": "Servicio de instalación"},
    ]
    historiales = {
        1: [{"no_produ": "LAPTOP01", "descripcion": "Laptop core i5 16GB", "precio": 45000, "fecha": "2026-05-10"}],
        2: [],
    }
    with patch("apps.lic.services.recomendar_precio._llamar_claude") as llamar_claude:
        llamar_claude.return_value = (
            '{"1": {"precio_sugerido": "45,000 - 47,000 DOP", "justificacion": "Se cotizó similar en mayo"}, '
            '"2": {"precio_sugerido": null, "justificacion": "Sin historial"}}'
        )
        resultado = recomendar_precios(productos, historiales)

    assert llamar_claude.call_count == 1  # UNA sola llamada para ambos productos
    assert resultado[1]["precio_sugerido"] == "45,000 - 47,000 DOP"
    assert resultado[2]["precio_sugerido"] is None
    prompt_enviado = llamar_claude.call_args[0][0]
    assert "100 laptops core i5" in prompt_enviado and "Servicio de instalación" in prompt_enviado
