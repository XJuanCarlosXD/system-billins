"""Extracción de rubros RPE desde el PDF del certificado, con IA para estructurar.

Taxonomía de fallos (importante para Task 10, cuyo view marca
`TLIC_DOCUMENTO.ESTADO_EXTRACCION` = pendiente/hecho/error):

- Un PDF sin capa de texto (escaneado sin OCR) se detecta ANTES de llamar a
  Claude: `extraer_texto_pdf` lanza `TextoNoExtraibleError` si el texto extraído
  es vacío/solo espacios. Esto evita gastar una llamada de API en un texto vacío
  y le permite al llamador distinguir "no hay OCR" de "la API falló".
- Fallos reales de la llamada a Claude (rate limit, auth, red, timeouts del
  SDK) en `_llamar_claude` se dejan propagar como excepciones sin atrapar aquí.
  Si se atraparan y convirtieran en `[]`, esas fallas serían indistinguibles de
  un certificado que legítimamente no tiene rubros, y la vista nunca marcaría
  `ESTADO_EXTRACCION = "error"` ni ofrecería reintento al usuario. El try/except
  que decide ese estado vive en la vista (Task 10), no en este servicio.
- Solo se degrada a lista vacía cuando Claude SÍ respondió pero el contenido no
  es utilizable (JSON inválido, no es una lista, prosa en vez de JSON) — eso es
  un resultado legítimo de "no hay rubros que estructurar", no una falla de API.

Nota sobre `apps.asistente`: `ClaudeProvider.stream` (en
`apps/asistente/providers/claude.py`) tampoco descarta errores del SDK — los
atrapa y los vuelve a exponer al llamador como un evento `Error` explícito en
vez de tragárselos en silencio. Este módulo sigue el mismo espíritu (que el
llamador se entere de los fallos reales de la API), aunque aquí el mecanismo es
dejar propagar la excepción directamente en vez de emitir un evento.
"""
import json
import logging

from django.conf import settings
from pypdf import PdfReader

logger = logging.getLogger(__name__)


class TextoNoExtraibleError(Exception):
    """El PDF no tiene una capa de texto extraíble (ej. escaneado sin OCR)."""


def extraer_texto_pdf(ruta_archivo: str) -> str:
    reader = PdfReader(ruta_archivo)
    texto = "\n".join(page.extract_text() or "" for page in reader.pages)
    if not texto.strip():
        raise TextoNoExtraibleError(
            f"No se pudo extraer texto de '{ruta_archivo}' "
            "(¿PDF escaneado sin OCR?)"
        )
    return texto


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
    pide texto plano. Se quita solo la valla de apertura/cierre (primera y
    última línea), sin tocar el contenido intermedio, para no corromper una
    `descripcion` que legítimamente contenga backticks."""
    lineas = texto.strip().split("\n")
    if lineas and lineas[0].strip().lower().startswith("```"):
        lineas = lineas[1:]
    if lineas and lineas[-1].strip() == "```":
        lineas = lineas[:-1]
    return "\n".join(lineas).strip()


def structurar_rubros_desde_texto(texto_pdf: str) -> list[dict]:
    # No se atrapa aqui: un fallo real de la API (rate limit, auth, red) debe
    # propagar para que la vista (Task 10) lo distinga de un "0 rubros" legitimo
    # y marque ESTADO_EXTRACCION="error" con posibilidad de reintento.
    respuesta = _llamar_claude(texto_pdf)

    respuesta_limpia = _limpiar_fences_markdown(respuesta) if isinstance(respuesta, str) else respuesta
    try:
        rubros = json.loads(respuesta_limpia)
    except (json.JSONDecodeError, TypeError):
        logger.warning("Respuesta de Claude no es JSON valido para rubros RPE: %r", respuesta)
        return []
    if not isinstance(rubros, list):
        return []
    return [r for r in rubros if isinstance(r, dict) and "descripcion" in r]
