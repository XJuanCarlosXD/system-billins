"""Extracción de rubros RPE desde el PDF del certificado, con IA para estructurar.

Esta señal es de respaldo/validación: el feed "Oportunidades" del portal DGCP ya
hace el match de rubros del lado del servidor. Si Claude falla (rate limit, auth,
red) o responde algo no parseable, se degrada a lista vacía en vez de propagar
la excepción, siguiendo la misma filosofía defensiva que ``apps.asistente``
(ver ``ClaudeProvider.stream`` en ``apps/asistente/providers/claude.py``, que
atrapa cualquier excepcion del SDK y la convierte en un evento en vez de dejarla
subir sin control).
"""
import json
import logging
import re

from django.conf import settings
from pypdf import PdfReader

logger = logging.getLogger(__name__)

_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE | re.MULTILINE)


def extraer_texto_pdf(ruta_archivo: str) -> str:
    reader = PdfReader(ruta_archivo)
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _llamar_claude(texto_pdf: str) -> str:
    import anthropic

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    mensaje = client.messages.create(
        model=settings.ASISTENTE_DEFAULT_MODEL,
        max_tokens=2000,
        messages=[{
            "role": "user",
            "content": (
                "Este es el texto extraído de un certificado de Registro de Proveedores del "
                "Estado (RPE) de República Dominicana. Devuelve SOLO un array JSON (sin texto "
                "adicional) con los rubros/categorías en los que la empresa está registrada, "
                "formato [{\"codigo\": \"...\", \"descripcion\": \"...\"}]. "
                f"Texto:\n\n{texto_pdf}"
            ),
        }],
    )
    return mensaje.content[0].text


def _limpiar_fences_markdown(texto: str) -> str:
    """Claude a veces envuelve la respuesta en ```json ... ``` pese a que se le
    pide texto plano. Se quitan las vallas antes de intentar json.loads."""
    return _FENCE_RE.sub("", texto.strip()).strip()


def structurar_rubros_desde_texto(texto_pdf: str) -> list[dict]:
    try:
        respuesta = _llamar_claude(texto_pdf)
    except Exception:  # noqa: BLE001 - señal de respaldo: nunca debe tumbar el flujo
        logger.exception("Fallo llamando a Claude para estructurar rubros RPE")
        return []

    respuesta_limpia = _limpiar_fences_markdown(respuesta) if isinstance(respuesta, str) else respuesta
    try:
        rubros = json.loads(respuesta_limpia)
    except (json.JSONDecodeError, TypeError):
        logger.warning("Respuesta de Claude no es JSON valido para rubros RPE: %r", respuesta)
        return []
    if not isinstance(rubros, list):
        return []
    return [r for r in rubros if isinstance(r, dict) and "descripcion" in r]
