"""Tools de Facturación Electrónica (e-CF) para el chatbot asistente.

Expone tres tools read-only al LLM:
- fe_listar_documentos: lista TFE_DOCUMENTO con filtros estado/tipo_ecf.
- fe_consultar_estado: consulta estado actual en la DGII vía track_id.
- fe_estado_config: muestra config, certificado y secuencias.

Todas usan ``modules_required=['FAT']`` igual que el resto de tools fiscales:
e-CF está anclado al módulo FAT (TFE_CONFIG/TFE_SECUENCIA viven en FAT).
"""
from __future__ import annotations

from typing import Any

from apps.asistente.tools.registry import ToolSpec, register_tool


def _fe_listar_documentos(
    no_cia: str,
    estado: str = "",
    tipo_ecf: str = "",
    page: int = 1,
    page_size: int = 10,
) -> dict[str, Any]:
    from apps.legacy.repositories import fe_repo

    page = max(int(page), 1)
    page_size = min(max(int(page_size), 1), 100)
    filtros: dict[str, Any] = {
        "limit": page_size,
        "offset": (page - 1) * page_size,
    }
    if estado:
        filtros["estado"] = estado.strip().upper()
    if tipo_ecf:
        filtros["tipo_ecf"] = str(tipo_ecf).strip()
    items = fe_repo.list_documentos(no_cia=no_cia, filtros=filtros)
    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "count": len(items),
    }


def _fe_consultar_estado(no_cia: str, e_ncf: str) -> dict[str, Any]:
    from apps.fe import dgii_client
    from apps.legacy.repositories import fe_repo

    doc = fe_repo.get_documento(no_cia, e_ncf)
    if not doc:
        return {"error": f"e-NCF {e_ncf} no encontrado"}
    track_id = doc.get("track_id") or ""
    if not track_id:
        return {
            "e_ncf": e_ncf,
            "estado_local": doc.get("estado"),
            "error": "El documento no tiene track_id — todavía no fue enviado a la DGII",
        }
    cfg = fe_repo.get_config(no_cia)
    ambiente = (cfg or {}).get("ambiente") or "ecf"
    try:
        resultado = dgii_client.consultar_estado(no_cia, ambiente, track_id)
    except Exception as exc:  # noqa: BLE001 — surface DGII error to the LLM
        return {
            "e_ncf": e_ncf,
            "estado_local": doc.get("estado"),
            "track_id": track_id,
            "error": f"No se pudo consultar la DGII: {exc}",
        }
    try:
        fe_repo.actualizar_estado_documento(
            no_cia, e_ncf,
            str(resultado.get("estado") or doc.get("estado") or "EN_PROCESO"),
            respuesta=str(resultado),
        )
    except Exception:
        pass
    return {
        "e_ncf": e_ncf,
        "track_id": track_id,
        "estado_dgii": resultado.get("estado"),
        "codigo": resultado.get("codigo"),
        "mensajes": resultado.get("mensajes"),
        "fecha_recepcion": resultado.get("fechaRecepcion"),
        "secuencia_utilizada": resultado.get("secuenciaUtilizada"),
    }


def _fe_estado_config(no_cia: str) -> dict[str, Any]:
    from apps.legacy.repositories import fe_repo

    cfg = fe_repo.get_config(no_cia)
    if not cfg:
        return {
            "activo": False,
            "mensaje": "No hay configuración e-CF para esta empresa",
        }
    secs = fe_repo.list_secuencias(no_cia)
    return {
        "activo": cfg.get("activo") == "S",
        "ambiente": cfg.get("ambiente"),
        "rnc_emisor": cfg.get("rnc_emisor"),
        "razon_social": cfg.get("razon_social"),
        "estado_cert": cfg.get("estado_cert"),
        "tiene_cert": cfg.get("tiene_cert") == "S",
        "certificado_vence": cfg.get("cert_vence"),
        "secuencias": [
            {
                "tipo": s.get("tipo_ecf"),
                "desde": s.get("secuencia_desde"),
                "hasta": s.get("secuencia_hasta"),
                "proxima": s.get("prox_secuencia"),
                "disponibles": (
                    int(s["secuencia_hasta"]) - int(s["prox_secuencia"]) + 1
                    if s.get("secuencia_hasta") and s.get("prox_secuencia")
                    else None
                ),
                "activa": s.get("activa"),
                "fecha_vence": s.get("fecha_vence"),
            }
            for s in secs
        ],
    }


def _register_all() -> None:
    register_tool(ToolSpec(
        name="fe_listar_documentos",
        description=(
            "Lista los comprobantes electrónicos (e-CF) enviados a la DGII. "
            "Filtros opcionales: estado (ENVIADO, ACEPTADO, RECHAZADO, EN_PROCESO) "
            "y tipo_ecf (31=Crédito Fiscal, 32=Consumo, 33=ND, 34=NC, "
            "41=Compras, 43=Gastos Menores, 44=Rég. Especial, 45=Gubernamental, "
            "46=Exportación, 47=Pago Exterior). Pagina 10 por defecto."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "no_cia": {"type": "string", "description": "Código de empresa"},
                "estado": {
                    "type": "string",
                    "description": "ENVIADO, ACEPTADO, RECHAZADO, EN_PROCESO",
                },
                "tipo_ecf": {
                    "type": "string",
                    "description": "31, 32, 33, 34, 41, 43, 44, 45, 46, 47",
                },
                "page": {"type": "integer", "default": 1},
                "page_size": {"type": "integer", "default": 10},
            },
            "required": ["no_cia"],
        },
        handler=_fe_listar_documentos,
        modules_required=["FAT"],
    ))

    register_tool(ToolSpec(
        name="fe_consultar_estado",
        description=(
            "Consulta en la DGII el estado actual de un e-CF enviado. "
            "Devuelve estado (Aceptado/Rechazado/En Proceso), mensajes DGII "
            "y actualiza TFE_DOCUMENTO con el resultado más reciente."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "no_cia": {"type": "string"},
                "e_ncf": {
                    "type": "string",
                    "description": "e-NCF completo, ej. E310000000141",
                },
            },
            "required": ["no_cia", "e_ncf"],
        },
        handler=_fe_consultar_estado,
        modules_required=["FAT"],
    ))

    register_tool(ToolSpec(
        name="fe_estado_config",
        description=(
            "Muestra el estado de la facturación electrónica: si está activa, "
            "ambiente (ecf/precert/testecf), certificado digital con fecha de "
            "vencimiento y secuencias e-NCF disponibles por tipo."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "no_cia": {"type": "string"},
            },
            "required": ["no_cia"],
        },
        handler=_fe_estado_config,
        modules_required=["FAT"],
    ))


_register_all()
