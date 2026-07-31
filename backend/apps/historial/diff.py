"""Diff campo-por-campo entre dos snapshots de un documento (estilo Odoo
tracked fields). Denylist en vez de allowlist: compara TODAS las claves
presentes en ambos dicts salvo un puñado de columnas técnicas, para que un
campo nuevo del payload nunca se pierda en silencio por falta de registro.
"""

from __future__ import annotations

from typing import Any

DENYLIST_DEFAULT = frozenset({
    "no_cia", "punto", "usuario", "fecha_sysdate", "no_docu", "no_factura",
    "no_documento", "no_conduce", "no_orden", "no_requisicion", "no_cheque",
})


def _fmt(v: Any) -> str:
    if v is None:
        return ""
    return str(v)


def _humanizar(campo: str) -> str:
    return campo.replace("_", " ").capitalize()


def diff_campos(
    antes: dict[str, Any],
    despues: dict[str, Any],
    etiquetas: dict[str, str] | None = None,
    ignorar: frozenset[str] | set[str] | None = None,
) -> list[dict[str, str]]:
    etiquetas = etiquetas or {}
    ignorar = ignorar if ignorar is not None else DENYLIST_DEFAULT
    comunes = sorted(set(antes.keys()) & set(despues.keys()))
    cambios: list[dict[str, str]] = []
    for campo in comunes:
        if campo in ignorar:
            continue
        v_antes, v_despues = antes[campo], despues[campo]
        if v_antes == v_despues:
            continue
        cambios.append({
            "campo": campo,
            "etiqueta": etiquetas.get(campo) or _humanizar(campo),
            "valor_anterior": _fmt(v_antes),
            "valor_nuevo": _fmt(v_despues),
        })
    return cambios
