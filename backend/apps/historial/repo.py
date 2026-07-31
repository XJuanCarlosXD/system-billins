"""Bitácora de auditoría (historial de quién-hizo-qué).

`log_evento` NUNCA abre su propia conexión/cursor ni hace commit: recibe el
cursor ya abierto por la función que está auditando y escribe dentro de esa
MISMA transacción, para que un rollback del documento también deshaga su
entrada de bitácora. El commit lo hace siempre el caller.
"""

from __future__ import annotations

from typing import Any

import oracledb

from apps.legacy import client

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


def _attach_cambios(rows: list[dict]) -> list[dict]:
    if not rows:
        return rows
    ids = [r["bitacora_id"] for r in rows]
    placeholders = ",".join(f":{i+1}" for i in range(len(ids)))
    detalle_rows = client.fetch_dicts(
        f"SELECT BITACORA_ID AS bitacora_id, CAMPO AS campo, ETIQUETA AS etiqueta, "
        f"VALOR_ANTERIOR AS valor_anterior, VALOR_NUEVO AS valor_nuevo "
        f"FROM ABREGONZA.TSYS_BITACORA_DETALLE WHERE BITACORA_ID IN ({placeholders})",
        ids,
    )
    por_id: dict[int, list[dict]] = {}
    for d in detalle_rows:
        por_id.setdefault(d["bitacora_id"], []).append({
            "campo": d["campo"], "etiqueta": d["etiqueta"],
            "valor_anterior": d["valor_anterior"], "valor_nuevo": d["valor_nuevo"],
        })
    for r in rows:
        r["cambios"] = por_id.get(r["bitacora_id"], [])
    return rows


def list_mio(usuario: str, limit: int = 10) -> list[dict]:
    limit = max(1, min(int(limit or 10), 100))
    rows = client.fetch_dicts(
        "SELECT * FROM ("
        " SELECT BITACORA_ID AS bitacora_id, TO_CHAR(FECHA,'YYYY-MM-DD\"T\"HH24:MI:SS') AS fecha, "
        "        USUARIO AS usuario, MODULO AS modulo, TIPO_DOCUMENTO AS tipo_documento, "
        "        NO_DOCUMENTO AS no_documento, ACCION AS accion, MOTIVO AS motivo, "
        "        DESCRIPCION AS descripcion "
        " FROM ABREGONZA.TSYS_BITACORA WHERE UPPER(USUARIO) = :1 ORDER BY FECHA DESC"
        f") WHERE ROWNUM <= {limit}",
        [(usuario or "").upper()],
    )
    return _attach_cambios(rows)


def list_admin(
    *, usuario: str | None = None, modulo: str | None = None,
    tipo_documento: str | None = None, no_documento: str | None = None,
    accion: str | None = None, fecha_desde: str | None = None,
    fecha_hasta: str | None = None, page: int = 1, page_size: int = 25,
) -> dict:
    where = []
    params: list = []
    if usuario:
        params.append(usuario.upper()); where.append(f"UPPER(USUARIO) = :{len(params)}")
    if modulo:
        params.append(modulo.upper()); where.append(f"MODULO = :{len(params)}")
    if tipo_documento:
        params.append(tipo_documento.upper()); where.append(f"TIPO_DOCUMENTO = :{len(params)}")
    if no_documento:
        params.append(no_documento); where.append(f"NO_DOCUMENTO = :{len(params)}")
    if accion:
        params.append(accion.upper()); where.append(f"ACCION = :{len(params)}")
    if fecha_desde:
        params.append(fecha_desde); where.append(f"FECHA >= TO_DATE(:{len(params)},'YYYY-MM-DD')")
    if fecha_hasta:
        params.append(fecha_hasta); where.append(f"FECHA < TO_DATE(:{len(params)},'YYYY-MM-DD') + 1")
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""

    page = max(1, int(page or 1))
    page_size = max(1, min(int(page_size or 25), 100))
    start = (page - 1) * page_size + 1
    end = page * page_size

    total_row = client.fetch_one(
        f"SELECT COUNT(*) FROM ABREGONZA.TSYS_BITACORA {where_sql}", params)
    total = int(total_row[0]) if total_row else 0

    rows = client.fetch_dicts(
        "SELECT bitacora_id, fecha, usuario, modulo, tipo_documento, no_documento, "
        "       accion, motivo, descripcion FROM ("
        " SELECT BITACORA_ID AS bitacora_id, TO_CHAR(FECHA,'YYYY-MM-DD\"T\"HH24:MI:SS') AS fecha, "
        "        USUARIO AS usuario, MODULO AS modulo, TIPO_DOCUMENTO AS tipo_documento, "
        "        NO_DOCUMENTO AS no_documento, ACCION AS accion, MOTIVO AS motivo, "
        "        DESCRIPCION AS descripcion, "
        "        ROW_NUMBER() OVER (ORDER BY FECHA DESC) AS rn "
        f" FROM ABREGONZA.TSYS_BITACORA {where_sql}"
        f") WHERE rn BETWEEN {start} AND {end}",
        params,
    )
    return {"items": _attach_cambios(rows), "total": total}


def list_documento(
    *, no_cia: str, punto: str, modulo: str, tipo_documento: str, no_documento: str,
) -> list[dict]:
    rows = client.fetch_dicts(
        "SELECT BITACORA_ID AS bitacora_id, TO_CHAR(FECHA,'YYYY-MM-DD\"T\"HH24:MI:SS') AS fecha, "
        "       USUARIO AS usuario, MODULO AS modulo, TIPO_DOCUMENTO AS tipo_documento, "
        "       NO_DOCUMENTO AS no_documento, ACCION AS accion, MOTIVO AS motivo, "
        "       DESCRIPCION AS descripcion "
        "FROM ABREGONZA.TSYS_BITACORA "
        "WHERE NO_CIA=:1 AND PUNTO=:2 AND MODULO=:3 AND TIPO_DOCUMENTO=:4 AND NO_DOCUMENTO=:5 "
        "ORDER BY FECHA DESC",
        [no_cia, punto, modulo.upper(), tipo_documento.upper(), no_documento],
    )
    return _attach_cambios(rows)
