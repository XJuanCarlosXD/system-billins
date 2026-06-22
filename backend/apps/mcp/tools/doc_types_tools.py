"""Tools transversales doc_tipos_listar y doc_tipos_describir."""
from typing import Optional

from ..doc_types import get_module, modulos_disponibles
from ..envelope import ok, error


def doc_tipos_listar(modulo: str, no_cia: str, punto: Optional[str] = None) -> dict:
    """Lista los tipos de documento del modulo (codigos + banderas)."""
    entry = get_module(modulo)
    if entry is None:
        return error(
            "VALIDATION_ERROR",
            f"Modulo desconocido: {modulo}",
            {"modulos_disponibles": modulos_disponibles()},
        )
    return ok({"modulo": modulo, "tipos": entry.listar_fn(no_cia, punto)})


def doc_tipos_describir(
    modulo: str,
    no_cia: str,
    tipo_documento: str,
    punto: Optional[str] = None,
) -> dict:
    """Devuelve schema completo de un tipo de documento (campos, lookups, ejemplo)."""
    entry = get_module(modulo)
    if entry is None:
        return error("VALIDATION_ERROR", f"Modulo desconocido: {modulo}")
    schema = entry.describir_fn(no_cia, punto, tipo_documento)
    if schema is None:
        return error(
            "NOT_FOUND",
            f"Tipo de documento {tipo_documento} no soportado en modulo {modulo}",
        )
    return ok({
        "modulo": modulo,
        "tipo_documento": schema.codigo,
        "descripcion": schema.descripcion,
        "tipo_transaccion": schema.tipo_transaccion,
        "efectos": {
            "afecta_cxc": schema.afecta_cxc,
            "afecta_cxp": schema.afecta_cxp,
            "afecta_inv": schema.afecta_inv,
            "afecta_cnt": schema.afecta_cnt,
            "usa_ncf":    schema.usa_ncf,
        },
        "campos_requeridos": schema.campos_requeridos,
        "ejemplo_payload":   schema.ejemplo_payload,
    })
