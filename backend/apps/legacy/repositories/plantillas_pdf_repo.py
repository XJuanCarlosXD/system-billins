"""Repositorio de plantillas PDF editables (FAT.TFAT_PLANTILLA_PDF).

Tabla nueva creada por el sistema actual (no es del sistema legado).
DML directo permitido — no hay package PL/SQL.

IMPORTANTE — CLOBs y oracledb thick:
    Los CLOBs no se pueden leer DESPUÉS de que el cursor se cierre porque
    el objeto LOB queda con conexión cerrada (DPY-1001). Todo SELECT con CLOB
    en este módulo lee el .read() ANTES de salir del bloque `with cur`.
"""
from __future__ import annotations

from .. import client


def _read_lob_or_none(v):
    """Lee un CLOB ahora; devuelve None si v es None."""
    if v is None:
        return None
    try:
        return v.read() if hasattr(v, 'read') else str(v)
    except Exception:
        return None


def list_plantillas(no_cia: str) -> list[dict]:
    sql = (
        "SELECT NO_CIA, CODIGO_DOC, NOMBRE, "
        "CASE WHEN DEFINICION_JSON IS NULL THEN 'N' ELSE 'S' END AS PERSONALIZADA, "
        "PAGE_SIZE, PAGE_ORIENTATION, NVL(ACTIVO,'S') AS ACTIVO, "
        "VERSION, FECHA_MOD, USUARIO_MOD "
        "FROM FAT.TFAT_PLANTILLA_PDF WHERE NO_CIA = :1 "
        "ORDER BY CODIGO_DOC"
    )
    rows = client.fetch_dicts(sql, [no_cia])
    out = []
    for r in rows:
        out.append({
            'no_cia': (r['no_cia'] or '').strip(),
            'codigo_doc': (r['codigo_doc'] or '').strip(),
            'nombre': r['nombre'] or '',
            'personalizada': r['personalizada'] == 'S',
            'page_size': r['page_size'] or 'A4',
            'page_orientation': r['page_orientation'] or 'P',
            'activo': r['activo'] == 'S',
            'version': int(r['version'] or 1),
            'fecha_mod': r['fecha_mod'].isoformat() if r['fecha_mod'] else None,
            'usuario_mod': r['usuario_mod'] or '',
        })
    return out


def get_plantilla(no_cia: str, codigo_doc: str) -> dict | None:
    # Leemos el CLOB DENTRO del cursor para evitar DPY-1001 (not connected)
    # que ocurre si oracledb intenta leer el LOB después de cerrar la conexión.
    sql = (
        "SELECT NO_CIA, CODIGO_DOC, NOMBRE, DEFINICION_JSON, "
        "PAGE_SIZE, PAGE_ORIENTATION, NVL(ACTIVO,'S') AS ACTIVO, "
        "VERSION, FECHA_MOD, USUARIO_MOD "
        "FROM FAT.TFAT_PLANTILLA_PDF WHERE NO_CIA = :1 AND CODIGO_DOC = :2"
    )
    with client.cursor() as cur:
        cur.execute(sql, [no_cia, codigo_doc])
        row = cur.fetchone()
        if not row:
            return None
        (no_cia_v, codigo_v, nombre_v, def_lob, page_size, orient,
         activo, version, fecha_mod, usuario_mod) = row
        definicion = _read_lob_or_none(def_lob)
    return {
        'no_cia': (no_cia_v or '').strip(),
        'codigo_doc': (codigo_v or '').strip(),
        'nombre': nombre_v or '',
        'definicion_json': definicion,
        'page_size': page_size or 'A4',
        'page_orientation': orient or 'P',
        'activo': activo == 'S',
        'version': int(version or 1),
        'fecha_mod': fecha_mod.isoformat() if fecha_mod else None,
        'usuario_mod': usuario_mod or '',
    }


def upsert_plantilla(no_cia: str, codigo_doc: str, nombre: str,
                     definicion_json: str | None,
                     page_size: str = 'A4', page_orientation: str = 'P',
                     activo: bool = True,
                     usuario: str = '') -> dict:
    with client.cursor() as cur:
        # Resolver versión actual (si existe) — leemos el CLOB previo
        # ANTES de cualquier otra operación que pueda invalidar la conexión.
        cur.execute(
            "SELECT VERSION, DEFINICION_JSON, PAGE_SIZE, PAGE_ORIENTATION "
            "FROM FAT.TFAT_PLANTILLA_PDF WHERE NO_CIA = :1 AND CODIGO_DOC = :2",
            [no_cia, codigo_doc])
        prev = cur.fetchone()
        prev_json = _read_lob_or_none(prev[1]) if prev else None
        next_version = (int(prev[0]) + 1) if prev else 1

        # Snapshot del estado previo en HIST
        if prev:
            cur.execute(
                "INSERT INTO FAT.TFAT_PLANTILLA_PDF_HIST "
                "(NO_CIA, CODIGO_DOC, VERSION, DEFINICION_JSON, PAGE_SIZE, PAGE_ORIENTATION, FECHA_MOD, USUARIO_MOD) "
                "VALUES (:1, :2, :3, :4, :5, :6, SYSDATE, :7)",
                [no_cia, codigo_doc, int(prev[0]), prev_json, prev[2], prev[3], usuario])

        if prev:
            cur.execute(
                "UPDATE FAT.TFAT_PLANTILLA_PDF SET "
                "NOMBRE = :1, DEFINICION_JSON = :2, "
                "PAGE_SIZE = :3, PAGE_ORIENTATION = :4, "
                "ACTIVO = :5, VERSION = :6, FECHA_MOD = SYSDATE, USUARIO_MOD = :7 "
                "WHERE NO_CIA = :8 AND CODIGO_DOC = :9",
                [nombre, definicion_json, page_size, page_orientation,
                 'S' if activo else 'N', next_version, usuario, no_cia, codigo_doc])
        else:
            cur.execute(
                "INSERT INTO FAT.TFAT_PLANTILLA_PDF "
                "(NO_CIA, CODIGO_DOC, NOMBRE, DEFINICION_JSON, "
                "PAGE_SIZE, PAGE_ORIENTATION, ACTIVO, VERSION, FECHA_MOD, USUARIO_MOD) "
                "VALUES (:1, :2, :3, :4, :5, :6, :7, :8, SYSDATE, :9)",
                [no_cia, codigo_doc, nombre, definicion_json, page_size,
                 page_orientation, 'S' if activo else 'N', next_version, usuario])
        cur.connection.commit()
    return get_plantilla(no_cia, codigo_doc) or {}


def restore_default(no_cia: str, codigo_doc: str, usuario: str = '') -> dict | None:
    """Borra la personalización: el render vuelve a usar el default del registry."""
    with client.cursor() as cur:
        cur.execute(
            "SELECT VERSION, DEFINICION_JSON, PAGE_SIZE, PAGE_ORIENTATION "
            "FROM FAT.TFAT_PLANTILLA_PDF WHERE NO_CIA = :1 AND CODIGO_DOC = :2",
            [no_cia, codigo_doc])
        prev = cur.fetchone()
        if not prev:
            return None
        prev_json = _read_lob_or_none(prev[1])
        cur.execute(
            "INSERT INTO FAT.TFAT_PLANTILLA_PDF_HIST "
            "(NO_CIA, CODIGO_DOC, VERSION, DEFINICION_JSON, PAGE_SIZE, PAGE_ORIENTATION, FECHA_MOD, USUARIO_MOD) "
            "VALUES (:1, :2, :3, :4, :5, :6, SYSDATE, :7)",
            [no_cia, codigo_doc, int(prev[0]), prev_json, prev[2], prev[3], usuario])
        cur.execute(
            "UPDATE FAT.TFAT_PLANTILLA_PDF SET DEFINICION_JSON = NULL, "
            "VERSION = VERSION + 1, FECHA_MOD = SYSDATE, USUARIO_MOD = :1 "
            "WHERE NO_CIA = :2 AND CODIGO_DOC = :3",
            [usuario, no_cia, codigo_doc])
        cur.connection.commit()
    return get_plantilla(no_cia, codigo_doc)


def list_historial(no_cia: str, codigo_doc: str) -> list[dict]:
    sql = (
        "SELECT VERSION, FECHA_MOD, USUARIO_MOD, PAGE_SIZE, PAGE_ORIENTATION, "
        "CASE WHEN DEFINICION_JSON IS NULL THEN 'N' ELSE 'S' END AS TIENE_JSON "
        "FROM FAT.TFAT_PLANTILLA_PDF_HIST "
        "WHERE NO_CIA = :1 AND CODIGO_DOC = :2 "
        "ORDER BY VERSION DESC"
    )
    rows = client.fetch_dicts(sql, [no_cia, codigo_doc])
    return [
        {
            'version': int(r['version']),
            'fecha_mod': r['fecha_mod'].isoformat() if r['fecha_mod'] else None,
            'usuario_mod': r['usuario_mod'] or '',
            'page_size': r['page_size'] or 'A4',
            'page_orientation': r['page_orientation'] or 'P',
            'tiene_json': r['tiene_json'] == 'S',
        }
        for r in rows
    ]


def get_historial_version(no_cia: str, codigo_doc: str, version: int) -> dict | None:
    sql = (
        "SELECT DEFINICION_JSON, PAGE_SIZE, PAGE_ORIENTATION "
        "FROM FAT.TFAT_PLANTILLA_PDF_HIST "
        "WHERE NO_CIA = :1 AND CODIGO_DOC = :2 AND VERSION = :3"
    )
    with client.cursor() as cur:
        cur.execute(sql, [no_cia, codigo_doc, version])
        row = cur.fetchone()
        if not row:
            return None
        def_json = _read_lob_or_none(row[0])
        return {
            'definicion_json': def_json,
            'page_size': row[1] or 'A4',
            'page_orientation': row[2] or 'P',
        }


def rollback_to(no_cia: str, codigo_doc: str, version: int, usuario: str = '') -> dict | None:
    target = get_historial_version(no_cia, codigo_doc, version)
    if target is None:
        return None
    plant = get_plantilla(no_cia, codigo_doc)
    nombre = (plant or {}).get('nombre', codigo_doc)
    return upsert_plantilla(
        no_cia=no_cia, codigo_doc=codigo_doc, nombre=nombre,
        definicion_json=target['definicion_json'],
        page_size=target['page_size'], page_orientation=target['page_orientation'],
        usuario=usuario)
