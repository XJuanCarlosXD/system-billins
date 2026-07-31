"""Bitácora de auditoría (historial de quién-hizo-qué).

`log_evento` NUNCA abre su propia conexión/cursor ni hace commit: recibe el
cursor ya abierto por la función que está auditando y escribe dentro de esa
MISMA transacción, para que un rollback del documento también deshaga su
entrada de bitácora. El commit lo hace siempre el caller.
"""

from __future__ import annotations

from typing import Any

import oracledb

ACCIONES_VALIDAS = ("CREAR", "EDITAR", "ANULAR", "REVERSAR")

_VERBOS = {"CREAR": "creó", "EDITAR": "editó", "ANULAR": "anuló", "REVERSAR": "reversó"}


def _descripcion(usuario: str, accion: str, tipo_documento: str, no_documento: str, n_cambios: int) -> str:
    verbo = _VERBOS.get(accion, accion.lower())
    base = f"{usuario} {verbo} {tipo_documento}-{no_documento}"
    if accion == "EDITAR" and n_cambios:
        base += f" ({n_cambios} campos)"
    return base


def log_evento(
    cur,
    *,
    usuario: str,
    no_cia: str,
    punto: str | None,
    modulo: str,
    tipo_documento: str,
    no_documento: str,
    accion: str,
    motivo: str | None = None,
    cambios: list[dict[str, str]] | None = None,
) -> None:
    if accion not in ACCIONES_VALIDAS:
        raise ValueError(f"accion invalida: {accion}")
    if accion == "EDITAR" and not cambios:
        # Nada cambió de verdad: no se genera evento.
        return

    usuario_u = (usuario or "").upper()[:30]
    n_cambios = len(cambios or [])
    descripcion = _descripcion(usuario_u, accion, tipo_documento, no_documento, n_cambios)[:500]
    motivo_trunc = (motivo or "")[:500] or None

    # RETURNING ... INTO recupera el BITACORA_ID generado por el
    # secuencia+trigger directo del INSERT (mismo patrón que
    # apps/legacy/repositories/lic_repo.py). Un SELECT MAX(...) posterior
    # sería racy si otro request inserta una fila entre el INSERT y el
    # SELECT.
    out_id = cur.var(oracledb.NUMBER)
    cur.execute(
        "INSERT INTO ABREGONZA.TSYS_BITACORA "
        "(USUARIO, NO_CIA, PUNTO, MODULO, TIPO_DOCUMENTO, NO_DOCUMENTO, "
        " ACCION, MOTIVO, DESCRIPCION, FECHA) "
        "VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, SYSDATE) "
        "RETURNING BITACORA_ID INTO :10",
        [usuario_u, no_cia, punto, modulo.upper(), tipo_documento.upper(),
         no_documento, accion, motivo_trunc, descripcion, out_id],
    )
    bitacora_id = int(out_id.getvalue()[0])

    if accion == "EDITAR" and cambios:
        for c in cambios:
            cur.execute(
                "INSERT INTO ABREGONZA.TSYS_BITACORA_DETALLE "
                "(BITACORA_ID, CAMPO, ETIQUETA, VALOR_ANTERIOR, VALOR_NUEVO) "
                "VALUES (:1, :2, :3, :4, :5)",
                [bitacora_id, c["campo"][:60], c["etiqueta"][:60],
                 (c.get("valor_anterior") or "")[:1000], (c.get("valor_nuevo") or "")[:1000]],
            )
