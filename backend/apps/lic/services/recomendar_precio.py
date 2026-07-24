"""Recomendacion de precio para TODOS los productos/servicios de una
oportunidad en una sola llamada a Claude -- la IA NUNCA busca el historial
por su cuenta (eso ya lo trae lic_repo.buscar_precio_historico, codigo puro,
uno por producto) ni recibe una llamada separada por producto: se le manda
todo junto y devuelve todo junto. No repite informacion que la licitacion ya
trae (las descripciones las aporta quien llama)."""
import json
import logging

from django.conf import settings

logger = logging.getLogger(__name__)


class RecomendacionPrecioError(Exception):
    pass


def _llamar_claude(prompt: str) -> str:
    import anthropic

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    mensaje = client.messages.create(
        model=settings.ASISTENTE_DEFAULT_MODEL,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )
    return mensaje.content[0].text


def _limpiar_fences_markdown(texto: str) -> str:
    lineas = texto.strip().split("\n")
    if lineas and lineas[0].strip().lower().startswith("```"):
        lineas = lineas[1:]
    if lineas and lineas[-1].strip() == "```":
        lineas = lineas[:-1]
    return "\n".join(lineas).strip()


def recomendar_precios(productos: list[dict], historiales: dict[int, list[dict]]) -> dict[int, dict]:
    """``productos`` es [{"id", "descripcion"}], ``historiales`` es {producto_id:
    [{"descripcion","precio","fecha"}]} ya buscado por buscar_precio_historico.
    Retorna {producto_id: {"precio_sugerido", "justificacion"}}."""
    bloques = []
    for p in productos:
        historial = historiales.get(p["id"], [])
        if historial:
            bloque_hist = "\n".join(
                f"    - {h['descripcion']}: {h['precio']} (facturado/cotizado el {h['fecha']})"
                for h in historial[:10]
            )
        else:
            bloque_hist = "    (sin historial de precios previos parecido en el sistema)"
        bloques.append(f'  Producto id={p["id"]}: "{p["descripcion"]}"\n{bloque_hist}')

    prompt = (
        "Eres un asistente que ayuda a una empresa dominicana a fijar precios para participar "
        "en una licitación pública. Para CADA producto/servicio de abajo, con su historial de "
        "precios ya facturados/cotizados por la empresa para algo parecido:\n\n"
        + "\n\n".join(bloques) + "\n\n"
        "Devuelve SOLO un objeto JSON (sin texto adicional, sin markdown) con esta forma exacta "
        "-- una clave por cada id de producto de arriba, como string:\n"
        '{"<id>": {"precio_sugerido": "rango o monto en DOP, o null si el historial no alcanza", '
        '"justificacion": "1-2 frases basadas SOLO en el historial de ese producto"}, ...}\n\n'
        "No inventes precios de mercado que no estén en el historial entregado para cada producto."
    )

    respuesta = _llamar_claude(prompt)
    respuesta_limpia = _limpiar_fences_markdown(respuesta) if isinstance(respuesta, str) else respuesta
    try:
        data = json.loads(respuesta_limpia)
    except (json.JSONDecodeError, TypeError) as exc:
        logger.warning("Respuesta de Claude no es JSON valido para recomendar_precios: %r", respuesta)
        raise RecomendacionPrecioError("La IA no devolvió una respuesta utilizable") from exc

    resultado: dict[int, dict] = {}
    for p in productos:
        entrada = data.get(str(p["id"])) or {}
        resultado[p["id"]] = {
            "precio_sugerido": entrada.get("precio_sugerido"),
            "justificacion": str(entrada.get("justificacion", ""))[:1000],
        }
    return resultado
