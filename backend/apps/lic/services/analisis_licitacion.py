"""Analisis completo de una oportunidad: resumen, lista de requisitos para
participar, y evaluacion de cuales de esos requisitos ya cumple la empresa
segun sus propios documentos subidos (RNC, no-mora, garantias, etc.).

Una sola llamada a Claude por analisis (no una por requisito x documento) --
se le manda el texto de TODOS los documentos de la licitacion mas el texto
de TODOS los documentos de la empresa en un solo prompt, y se le pide que
devuelva todo estructurado en un JSON. Mas barato en tokens y mas simple que
orquestar N llamadas.
"""
import json
import logging

from django.conf import settings

logger = logging.getLogger(__name__)

MAX_CARACTERES_POR_DOCUMENTO = 20_000
MAX_DOCUMENTOS_EMPRESA = 15

ESTADOS_VALIDOS = {"cumple", "parcial", "no_cumple"}


class AnalisisError(Exception):
    """Fallo real de la llamada a Claude o de un JSON de respuesta inutilizable."""


def _llamar_claude(prompt: str) -> str:
    import anthropic

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    mensaje = client.messages.create(
        model=settings.ASISTENTE_DEFAULT_MODEL,
        max_tokens=3000,
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


def analizar_licitacion(
    titulo: str,
    textos_licitacion: list[str],
    documentos_empresa: list[dict],
) -> dict:
    """``documentos_empresa`` es una lista de {"id": int, "nombre_archivo": str,
    "texto": str, "vencido": bool}. Retorna
    {"resumen": str, "recomendacion": str, "estado_cumplimiento": "verde"|"amarillo"|"rojo",
     "requisitos": [{"descripcion", "estado", "justificacion", "documento_empresa_id"}]}.
    """
    texto_licitacion = "\n\n---\n\n".join(
        t[:MAX_CARACTERES_POR_DOCUMENTO] for t in textos_licitacion if t
    )

    docs_empresa_recortados = documentos_empresa[:MAX_DOCUMENTOS_EMPRESA]
    bloque_docs_empresa = "\n\n".join(
        f"[Documento de la empresa: \"{d['nombre_archivo']}\"" +
        (" -- VENCIDO, no usar para cumplir requisitos de vigencia]" if d.get("vencido") else "]") +
        f"\n{d['texto'][:MAX_CARACTERES_POR_DOCUMENTO]}"
        for d in docs_empresa_recortados
    ) or "(La empresa no ha subido ningún documento propio todavía.)"

    prompt = (
        "Eres un asistente que ayuda a una empresa dominicana a evaluar si puede "
        f"participar en un proceso de compras públicas titulado \"{titulo}\".\n\n"
        "TEXTO DE LOS DOCUMENTOS DEL PROCESO (pliego, TDR, convocatoria, etc.):\n"
        f"{texto_licitacion}\n\n"
        "DOCUMENTOS PROPIOS DE LA EMPRESA (para verificar si cumple los requisitos):\n"
        f"{bloque_docs_empresa}\n\n"
        "Devuelve SOLO un objeto JSON (sin texto adicional, sin markdown) con esta forma exacta:\n"
        "{\n"
        '  "resumen": "resumen en español de qué se compra, presupuesto si aparece, '
        'fecha límite, en máximo 6 líneas",\n'
        '  "requisitos": [\n'
        '    {"descripcion": "un requisito concreto para participar, ej. \'RNC vigente\'", '
        '"estado": "cumple|parcial|no_cumple", '
        '"justificacion": "por qué, en una frase, citando el documento de la empresa si aplicó", '
        '"documento_empresa": "nombre exacto del documento de la empresa usado para evaluar esto, '
        'o null si no hay ninguno relevante o el requisito no se puede evaluar con documentos"}\n'
        "  ],\n"
        '  "estado_cumplimiento": "verde|amarillo|rojo", '
        '"recomendacion": "1-3 frases con tu recomendación sobre si conviene participar y qué falta"\n'
        "}\n\n"
        "Reglas: extrae entre 3 y 10 requisitos reales del texto (no inventes requisitos que no "
        "aparecen). 'estado_cumplimiento' es verde SOLO si TODOS los requisitos son 'cumple', "
        "amarillo si hay una mezcla con al menos un 'cumple', rojo si ninguno se cumple o no hay "
        "documentos de la empresa para evaluar nada. Un documento marcado VENCIDO no cuenta como "
        "'cumple' para requisitos de vigencia -- como máximo 'parcial', explicando que está vencido."
    )

    respuesta = _llamar_claude(prompt)
    respuesta_limpia = _limpiar_fences_markdown(respuesta) if isinstance(respuesta, str) else respuesta
    try:
        data = json.loads(respuesta_limpia)
    except (json.JSONDecodeError, TypeError) as exc:
        logger.warning("Respuesta de Claude no es JSON valido para analisis: %r", respuesta)
        raise AnalisisError("La IA no devolvió una respuesta utilizable, intente de nuevo") from exc

    if not isinstance(data, dict) or "requisitos" not in data:
        raise AnalisisError("La IA no devolvió el formato esperado, intente de nuevo")

    nombre_a_id = {d["nombre_archivo"]: d["id"] for d in docs_empresa_recortados}
    requisitos = []
    for r in data.get("requisitos", []):
        if not isinstance(r, dict) or "descripcion" not in r:
            continue
        estado = r.get("estado") if r.get("estado") in ESTADOS_VALIDOS else "sin_evaluar"
        requisitos.append({
            "descripcion": r["descripcion"][:1000],
            "estado": estado,
            "justificacion": (r.get("justificacion") or "")[:1000] or None,
            "documento_empresa_id": nombre_a_id.get(r.get("documento_empresa")),
        })

    estado_cumplimiento = data.get("estado_cumplimiento")
    if estado_cumplimiento not in {"verde", "amarillo", "rojo"}:
        estado_cumplimiento = "rojo" if not documentos_empresa else "amarillo"

    return {
        "resumen": str(data.get("resumen", ""))[:4000],
        "recomendacion": str(data.get("recomendacion", ""))[:2000] or None,
        "estado_cumplimiento": estado_cumplimiento,
        "requisitos": requisitos,
    }


def documentos_faltantes(
    requisitos: list[dict], tipos_catalogo: list[dict], documentos_empresa: list[dict],
) -> list[dict]:
    """Post-procesamiento puro (sin llamada a IA): para cada tipo de documento del
    catálogo que aparezca mencionado por nombre en algún requisito evaluado como
    'no_cumple' o 'parcial', arma una entrada {"tipo_documento", "motivo"} -- "no
    subido" si ningún documento de empresa de ese tipo existe, "vencido" si existe
    pero está marcado vencido. Solo señala; no genera ni redacta nada."""
    documentos_por_tipo_id = {d["id"]: d for d in documentos_empresa}

    faltantes: list[dict] = []
    vistos: set[str] = set()
    for r in requisitos:
        if r["estado"] not in ("no_cumple", "parcial"):
            continue
        descripcion_baja = r["descripcion"].lower()
        for tipo in tipos_catalogo:
            if tipo["nombre"].lower() not in descripcion_baja:
                continue
            if tipo["nombre"] in vistos:
                continue
            doc_id = r.get("documento_empresa_id")
            doc = documentos_por_tipo_id.get(doc_id) if doc_id else None
            if doc is None:
                motivo = "no subido"
            elif doc.get("vencido"):
                motivo = "vencido"
            else:
                continue  # tiene documento vigente de ese tipo, pero el requisito
                          # sigue 'parcial' por otra razón no relacionada al tipo
            vistos.add(tipo["nombre"])
            faltantes.append({"tipo_documento": tipo["nombre"], "motivo": motivo})
    return faltantes


def ejecutar_analisis_oportunidad(oportunidad_id: int) -> dict:
    """Junta el texto de los documentos de la oportunidad + los de la empresa,
    llama a ``analizar_licitacion`` y guarda el resultado -- función
    compartida entre el endpoint manual "Analizar" (vista) y el scraper
    (orquestador), para que el análisis quede listo automáticamente apenas
    se descubre una oportunidad nueva, sin que el usuario tenga que esperar
    una llamada a la IA al abrir el detalle."""
    # Imports locales para evitar acoplar este módulo (apps.lic.services) al
    # de arriba (apps.legacy.repositories) a nivel de import del paquete.
    from apps.legacy.repositories import lic_repo
    from apps.lic.services import pdf_rubros

    oportunidad = lic_repo.get_oportunidad(oportunidad_id)
    if not oportunidad:
        raise AnalisisError(f"Oportunidad {oportunidad_id} no encontrada")

    textos_licitacion = []
    for doc in lic_repo.list_documentos(oportunidad_id):
        if doc["estado"] != "ok":
            continue
        try:
            textos_licitacion.append(pdf_rubros.extraer_texto_pdf(doc["ruta_archivo"]))
        except Exception:  # noqa: BLE001 - .doc/escaneado sin texto, se omite y se sigue
            logger.warning(
                "lic.analizar: no se pudo extraer texto de %s (oportunidad=%s)",
                doc["nombre_archivo"], oportunidad_id,
            )

    documentos_empresa = []
    for d in lic_repo.list_documentos_empresa(oportunidad["no_cia"]):
        try:
            texto = pdf_rubros.extraer_texto_pdf(d["ruta_archivo"])
        except Exception:  # noqa: BLE001
            continue
        documentos_empresa.append({
            "id": d["id"], "nombre_archivo": d["nombre_archivo"],
            "texto": texto, "vencido": bool(d.get("vencido")),
        })

    if not textos_licitacion:
        raise AnalisisError(
            "Ninguno de los documentos descargados de esta oportunidad tiene "
            "texto extraíble (¿son escaneados o formatos no-PDF?)"
        )

    resultado = analizar_licitacion(oportunidad["titulo"] or "", textos_licitacion, documentos_empresa)

    lic_repo.guardar_analisis_oportunidad(
        oportunidad_id, resultado["resumen"], resultado["estado_cumplimiento"],
        resultado["recomendacion"],
    )
    lic_repo.reemplazar_requisitos(oportunidad_id, resultado["requisitos"])
    resultado["requisitos"] = lic_repo.list_requisitos(oportunidad_id)
    return resultado
