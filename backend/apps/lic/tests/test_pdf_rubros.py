from unittest.mock import patch

from apps.lic.services.pdf_rubros import structurar_rubros_desde_texto


def test_structurar_rubros_parses_claude_json_response():
    fake_response_text = (
        '[{"codigo": "72101500", "descripcion": "Reparación de equipos electrónicos"}, '
        '{"codigo": "72141500", "descripcion": "Mantenimiento de aires acondicionados"}]'
    )
    with patch("apps.lic.services.pdf_rubros._llamar_claude", return_value=fake_response_text):
        rubros = structurar_rubros_desde_texto("texto extraido del pdf de rpe...")
    assert rubros == [
        {"codigo": "72101500", "descripcion": "Reparación de equipos electrónicos"},
        {"codigo": "72141500", "descripcion": "Mantenimiento de aires acondicionados"},
    ]


def test_structurar_rubros_returns_empty_list_on_malformed_response():
    with patch("apps.lic.services.pdf_rubros._llamar_claude", return_value="no es json"):
        rubros = structurar_rubros_desde_texto("texto")
    assert rubros == []


def test_structurar_rubros_strips_markdown_code_fences():
    fake_response_text = (
        '```json\n'
        '[{"codigo": "81112000", "descripcion": "Servicios de soporte informatico"}]\n'
        '```'
    )
    with patch("apps.lic.services.pdf_rubros._llamar_claude", return_value=fake_response_text):
        rubros = structurar_rubros_desde_texto("texto")
    assert rubros == [
        {"codigo": "81112000", "descripcion": "Servicios de soporte informatico"},
    ]


def test_structurar_rubros_returns_empty_list_on_api_error():
    with patch(
        "apps.lic.services.pdf_rubros._llamar_claude",
        side_effect=RuntimeError("rate limited"),
    ):
        rubros = structurar_rubros_desde_texto("texto")
    assert rubros == []
