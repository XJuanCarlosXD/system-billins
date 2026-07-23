"""Resumen con IA de un documento de licitacion (pliego, TDR, anexo, etc.).

Mismo patron que pdf_rubros.py: se extrae el texto del PDF con pypdf y se le
manda el TEXTO (no el PDF crudo) a Claude, mas barato en tokens que adjuntar
el archivo completo. Se dispara bajo demanda (boton en el frontend), no en
cada corrida del scraper, para no generar costo de API sin control por cada
documento descargado automaticamente.
"""
from django.conf import settings

from apps.lic.services.pdf_rubros import extraer_texto_pdf  # noqa: F401 (reexport)

MAX_CARACTERES_TEXTO = 60_000  # limite razonable de contexto, evita mandar PDFs enormes completos


def resumir_documento(texto_pdf: str) -> str:
    """Devuelve un resumen en español de los puntos clave de un documento de
    licitación: qué se está comprando, monto/presupuesto si aparece, fecha
    límite, requisitos para participar y criterios de evaluación si se
    mencionan. Deja propagar errores del SDK (mismo criterio que
    structurar_rubros_desde_texto) para que el llamador decida cómo
    reportarlos."""
    import anthropic

    texto_recortado = texto_pdf[:MAX_CARACTERES_TEXTO]
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    mensaje = client.messages.create(
        model=settings.ASISTENTE_DEFAULT_MODEL,
        max_tokens=500,  # ~500 tokens caben holgadamente en VARCHAR2(4000)
        messages=[{
            "role": "user",
            "content": (
                "Este es el texto de un documento de un proceso de compras públicas "
                "de República Dominicana (pliego de condiciones, términos de referencia "
                "o similar). Resume en español, en formato de lista corta con viñetas "
                "(máximo 8 líneas), SOLO lo esencial para decidir si participar: "
                "qué bien/servicio se solicita, presupuesto o monto estimado si aparece, "
                "fecha límite de entrega de ofertas si aparece, requisitos/documentos "
                "que el proveedor debe presentar para participar, y criterios de "
                "evaluación si se mencionan. Si algo no aparece en el texto, simplemente "
                "omite esa viñeta. No inventes información que no esté en el texto.\n\n"
                f"Texto:\n\n{texto_recortado}"
            ),
        }],
    )
    return mensaje.content[0].text
