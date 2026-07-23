from unittest.mock import MagicMock, patch

import pytest

from apps.lic.services.pdf_rubros import (
    TextoNoExtraibleError,
    extraer_texto_pdf,
    structurar_rubros_desde_texto,
)


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


def test_structurar_rubros_preserves_backticks_inside_description():
    # La valla de markdown solo debe quitarse en la primera/ultima linea; una
    # descripcion que contenga backticks en medio del texto no debe corromperse.
    fake_response_text = (
        '```json\n'
        '[{"codigo": "81112000", "descripcion": "Soporte de `sistema legado`"}]\n'
        '```'
    )
    with patch("apps.lic.services.pdf_rubros._llamar_claude", return_value=fake_response_text):
        rubros = structurar_rubros_desde_texto("texto")
    assert rubros == [
        {"codigo": "81112000", "descripcion": "Soporte de `sistema legado`"},
    ]


def test_structurar_rubros_propagates_api_errors():
    """Un fallo real de la API (rate limit, auth, red) debe propagar para que
    la vista (Task 10) lo distinga de un "0 rubros" legitimo y marque
    ESTADO_EXTRACCION="error" con posibilidad de reintento."""
    with patch(
        "apps.lic.services.pdf_rubros._llamar_claude",
        side_effect=RuntimeError("rate limited"),
    ):
        with pytest.raises(RuntimeError):
            structurar_rubros_desde_texto("texto")


def test_extraer_texto_pdf_raises_on_empty_text():
    fake_page = MagicMock()
    fake_page.extract_text.return_value = ""
    fake_reader = MagicMock()
    fake_reader.pages = [fake_page]
    with patch("apps.lic.services.pdf_rubros.PdfReader", return_value=fake_reader):
        with pytest.raises(TextoNoExtraibleError):
            extraer_texto_pdf("ruta/falsa.pdf")


def test_extraer_texto_pdf_raises_on_whitespace_only_text():
    fake_page = MagicMock()
    fake_page.extract_text.return_value = "   \n\n  "
    fake_reader = MagicMock()
    fake_reader.pages = [fake_page]
    with patch("apps.lic.services.pdf_rubros.PdfReader", return_value=fake_reader):
        with pytest.raises(TextoNoExtraibleError):
            extraer_texto_pdf("ruta/falsa.pdf")


def test_extraer_texto_pdf_returns_text_when_present():
    fake_page = MagicMock()
    fake_page.extract_text.return_value = "RPE certificado texto real"
    fake_reader = MagicMock()
    fake_reader.pages = [fake_page]
    with patch("apps.lic.services.pdf_rubros.PdfReader", return_value=fake_reader):
        texto = extraer_texto_pdf("ruta/falsa.pdf")
    assert texto == "RPE certificado texto real"
