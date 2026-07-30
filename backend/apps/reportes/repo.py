"""Persistencia de TREP_PROBLEMA / TREP_IMAGEN (modulo Reportes de problemas).

Sin ORM: acceso directo con oracledb, mismo estilo que apps/asistente/persist.py.
Los CLOB/BLOB se leen dentro del bloque `with client.cursor()` — fuera de el la
conexion ya volvio al pool y `lob.read()` lanza DPY-1001 (ver apps/asistente).
"""

from __future__ import annotations

import base64
import uuid

from apps.legacy import client

ESTADOS_VALIDOS = ("ABIERTO", "EN_PROGRESO", "COMPLETADO", "CANCELADO")
MODULOS_VALIDOS = (
    "FAT", "INV", "CXC", "CXP", "CNT", "ACC", "ACF", "CHC", "SDN", "ODC",
    "MAN", "FE", "ASISTENTE", "OTRO",
)
MAX_IMAGENES = 3
MAX_IMAGEN_BYTES = 5 * 1024 * 1024


class ValidationError(Exception):
    pass


def _validar_imagenes(imagenes: list[dict]) -> list[tuple[str, str, bytes]]:
    if len(imagenes) > MAX_IMAGENES:
        raise ValidationError(f"max_{MAX_IMAGENES}_imagenes")
    out = []
    for img in imagenes:
        media_type = (img.get("media_type") or "").lower()
        if not media_type.startswith("image/"):
            raise ValidationError("solo_imagenes")
        try:
            contenido = base64.b64decode(img.get("data") or "", validate=True)
        except Exception:
            raise ValidationError("imagen_invalida")
        if not contenido:
            raise ValidationError("imagen_invalida")
        if len(contenido) > MAX_IMAGEN_BYTES:
            raise ValidationError("imagen_muy_grande")
        nombre = (img.get("nombre") or img.get("name") or "imagen")[:200]
        out.append((nombre, media_type, contenido))
    return out


def create_reporte(
    *, usuario: str, modulo: str | None, titulo: str | None,
    descripcion: str | None, imagenes: list[dict],
) -> str:
    modulo = (modulo or "OTRO").upper()
    if modulo not in MODULOS_VALIDOS:
        modulo = "OTRO"
    titulo = (titulo or "").strip()[:200]
    if not titulo:
        raise ValidationError("titulo_requerido")
    imgs = _validar_imagenes(imagenes or [])

    reporte_id = str(uuid.uuid4())
    with client.cursor() as cur:
        cur.execute(
            "INSERT INTO ABREGONZA.TREP_PROBLEMA "
            "(REPORTE_ID, USUARIO, MODULO, TITULO, DESCRIPCION, ESTADO, "
            " FECHA_CREACION, FECHA_ACTUALIZACION) "
            "VALUES (:1, :2, :3, :4, :5, 'ABIERTO', SYSDATE, SYSDATE)",
            [reporte_id, usuario, modulo, titulo, descripcion or ""],
        )
        for nombre, media_type, contenido in imgs:
            imagen_id = str(uuid.uuid4())
            cur.execute(
                "INSERT INTO ABREGONZA.TREP_IMAGEN "
                "(IMAGEN_ID, REPORTE_ID, NOMBRE_ARCHIVO, MEDIA_TYPE, "
                " CONTENIDO, TAMANO_BYTES, FECHA_CREACION) "
                "VALUES (:1, :2, :3, :4, :5, :6, SYSDATE)",
                [imagen_id, reporte_id, nombre, media_type, contenido,
                 len(contenido)],
            )
        cur.connection.commit()
    return reporte_id


def list_reportes(
    *, usuario: str, is_admin: bool, mine: bool,
    estado: str | None = None, modulo: str | None = None,
) -> list[dict]:
    where = []
    params: list = []
    if mine or not is_admin:
        where.append("UPPER(p.USUARIO) = :{}".format(len(params) + 1))
        params.append((usuario or "").upper())
    if estado:
        where.append("p.ESTADO = :{}".format(len(params) + 1))
        params.append(estado.upper())
    if modulo:
        where.append("p.MODULO = :{}".format(len(params) + 1))
        params.append(modulo.upper())
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""

    return client.fetch_dicts(
        "SELECT * FROM ("
        "  SELECT p.REPORTE_ID, p.USUARIO, p.MODULO, p.TITULO, p.ESTADO, "
        "         p.FECHA_CREACION, p.FECHA_ACTUALIZACION, "
        "         p.FECHA_RESOLUCION, p.RESUELTO_POR, "
        "         (SELECT COUNT(*) FROM ABREGONZA.TREP_IMAGEN i "
        "          WHERE i.REPORTE_ID = p.REPORTE_ID) AS NUM_IMAGENES "
        "  FROM ABREGONZA.TREP_PROBLEMA p "
        f"  {where_sql} "
        "  ORDER BY p.FECHA_CREACION DESC"
        ") WHERE ROWNUM <= 200",
        params,
    )


def get_reporte(reporte_id: str, *, usuario: str, is_admin: bool) -> dict | None:
    with client.cursor() as cur:
        cur.execute(
            "SELECT REPORTE_ID, USUARIO, MODULO, TITULO, DESCRIPCION, ESTADO, "
            "       NOTA_RESOLUCION, RESUELTO_POR, FECHA_CREACION, "
            "       FECHA_ACTUALIZACION, FECHA_RESOLUCION "
            "FROM ABREGONZA.TREP_PROBLEMA WHERE REPORTE_ID = :1",
            [reporte_id],
        )
        cols = [c[0].lower() for c in cur.description]
        row = cur.fetchone()
        if not row:
            return None
        r = dict(zip(cols, row))
        if hasattr(r.get("descripcion"), "read"):
            r["descripcion"] = r["descripcion"].read()
        if hasattr(r.get("nota_resolucion"), "read"):
            r["nota_resolucion"] = r["nota_resolucion"].read()

        if not is_admin and (r["usuario"] or "").upper() != (usuario or "").upper():
            raise PermissionError("forbidden")

        cur.execute(
            "SELECT IMAGEN_ID, NOMBRE_ARCHIVO, MEDIA_TYPE, TAMANO_BYTES "
            "FROM ABREGONZA.TREP_IMAGEN WHERE REPORTE_ID = :1 "
            "ORDER BY FECHA_CREACION",
            [reporte_id],
        )
        icols = [c[0].lower() for c in cur.description]
        r["imagenes"] = [dict(zip(icols, row)) for row in cur.fetchall()]
    return r


def get_imagen(
    reporte_id: str, imagen_id: str, *, usuario: str, is_admin: bool,
) -> tuple[str, bytes] | None:
    with client.cursor() as cur:
        cur.execute(
            "SELECT p.USUARIO, i.MEDIA_TYPE, i.CONTENIDO "
            "FROM ABREGONZA.TREP_IMAGEN i "
            "JOIN ABREGONZA.TREP_PROBLEMA p ON p.REPORTE_ID = i.REPORTE_ID "
            "WHERE i.REPORTE_ID = :1 AND i.IMAGEN_ID = :2",
            [reporte_id, imagen_id],
        )
        row = cur.fetchone()
        if not row:
            return None
        autor, media_type, contenido = row
        if not is_admin and (autor or "").upper() != (usuario or "").upper():
            raise PermissionError("forbidden")
        data = contenido.read() if hasattr(contenido, "read") else bytes(contenido)
    return media_type, data


def update_estado(
    reporte_id: str, *, usuario: str, is_admin: bool, nuevo_estado: str | None,
    nota_resolucion: str | None = None,
) -> dict:
    nuevo_estado = (nuevo_estado or "").upper()
    if nuevo_estado not in ESTADOS_VALIDOS or nuevo_estado == "ABIERTO":
        raise ValidationError("estado_invalido")

    with client.cursor() as cur:
        cur.execute(
            "SELECT ESTADO, USUARIO FROM ABREGONZA.TREP_PROBLEMA "
            "WHERE REPORTE_ID = :1",
            [reporte_id],
        )
        row = cur.fetchone()
        if not row:
            raise LookupError("not_found")
        estado_actual, autor = row

        if not is_admin:
            if (autor or "").upper() != (usuario or "").upper():
                raise PermissionError("forbidden")
            if nuevo_estado != "CANCELADO":
                raise PermissionError("forbidden")
            if estado_actual not in ("ABIERTO", "EN_PROGRESO"):
                raise ValidationError("transicion_invalida")

        resuelto = nuevo_estado in ("COMPLETADO", "CANCELADO")
        if resuelto:
            cur.execute(
                "UPDATE ABREGONZA.TREP_PROBLEMA SET ESTADO = :1, "
                "NOTA_RESOLUCION = :2, RESUELTO_POR = :3, "
                "FECHA_RESOLUCION = SYSDATE, FECHA_ACTUALIZACION = SYSDATE "
                "WHERE REPORTE_ID = :4",
                [nuevo_estado, nota_resolucion, usuario, reporte_id],
            )
        else:
            cur.execute(
                "UPDATE ABREGONZA.TREP_PROBLEMA SET ESTADO = :1, "
                "FECHA_ACTUALIZACION = SYSDATE WHERE REPORTE_ID = :2",
                [nuevo_estado, reporte_id],
            )
        cur.connection.commit()
    return {"reporte_id": reporte_id, "estado": nuevo_estado}


RUN_ESTADOS_FINALES = ("COMPLETADO", "ERROR")


def get_run_activo() -> dict | None:
    with client.cursor() as cur:
        cur.execute(
            "SELECT RUN_ID, ESTADO, SOLICITADO_POR, FECHA_SOLICITUD "
            "FROM ABREGONZA.TREP_AGENTE_RUN "
            "WHERE ESTADO IN ('PENDIENTE','EN_PROCESO') "
            "ORDER BY FECHA_SOLICITUD DESC FETCH FIRST 1 ROWS ONLY"
        )
        row = cur.fetchone()
        if not row:
            return None
        cols = [c[0].lower() for c in cur.description]
        return dict(zip(cols, row))


def crear_run(*, usuario: str) -> dict:
    if get_run_activo():
        raise ValidationError("run_activo_existente")

    run_id = str(uuid.uuid4())
    with client.cursor() as cur:
        cur.execute(
            "INSERT INTO ABREGONZA.TREP_AGENTE_RUN "
            "(RUN_ID, ESTADO, SOLICITADO_POR, FECHA_SOLICITUD) "
            "VALUES (:1, 'PENDIENTE', :2, SYSDATE)",
            [run_id, usuario],
        )
        cur.connection.commit()
    return {"run_id": run_id, "estado": "PENDIENTE"}


def get_ultimo_run() -> dict | None:
    with client.cursor() as cur:
        cur.execute(
            "SELECT RUN_ID, ESTADO, SOLICITADO_POR, FECHA_SOLICITUD, "
            "       FECHA_FIN, RESUMEN, COMMIT_SHA "
            "FROM ABREGONZA.TREP_AGENTE_RUN "
            "ORDER BY FECHA_SOLICITUD DESC FETCH FIRST 1 ROWS ONLY"
        )
        row = cur.fetchone()
        if not row:
            return None
        cols = [c[0].lower() for c in cur.description]
        r = dict(zip(cols, row))
        if hasattr(r.get("resumen"), "read"):
            r["resumen"] = r["resumen"].read()
        return r


def reclamar_pendiente() -> dict | None:
    """Marca el run PENDIENTE mas antiguo como EN_PROCESO y devuelve los
    reportes ABIERTO. El UPDATE con WHERE ESTADO='PENDIENTE' hace el reclamo
    atomico: si dos llamadas concurrentes lo intentan, la segunda actualiza
    0 filas y devuelve None en vez de duplicar el trabajo.
    """
    with client.cursor() as cur:
        cur.execute(
            "SELECT RUN_ID FROM ABREGONZA.TREP_AGENTE_RUN "
            "WHERE ESTADO = 'PENDIENTE' "
            "ORDER BY FECHA_SOLICITUD ASC FETCH FIRST 1 ROWS ONLY"
        )
        row = cur.fetchone()
        if not row:
            return None
        run_id = row[0]

        cur.execute(
            "UPDATE ABREGONZA.TREP_AGENTE_RUN SET ESTADO = 'EN_PROCESO' "
            "WHERE RUN_ID = :1 AND ESTADO = 'PENDIENTE'",
            [run_id],
        )
        if cur.rowcount != 1:
            cur.connection.rollback()
            return None
        cur.connection.commit()

        # DESCRIPCION es CLOB: hay que leerlo dentro del bloque `with`,
        # antes de que la conexion vuelva al pool (mismo gotcha que
        # get_reporte() mas arriba en este archivo).
        cur.execute(
            "SELECT REPORTE_ID, MODULO, TITULO, DESCRIPCION "
            "FROM ABREGONZA.TREP_PROBLEMA WHERE ESTADO = 'ABIERTO' "
            "ORDER BY FECHA_CREACION ASC"
        )
        reportes = []
        for reporte_id, modulo, titulo, descripcion in cur.fetchall():
            reportes.append({
                "reporte_id": reporte_id,
                "modulo": modulo,
                "titulo": titulo,
                "descripcion": (
                    descripcion.read() if hasattr(descripcion, "read")
                    else (descripcion or "")
                ),
            })
    return {"run_id": run_id, "reportes": reportes}


def finalizar_run(
    run_id: str, *, estado: str, resumen: str, commit_sha: str | None,
) -> dict:
    estado = (estado or "").upper()
    if estado not in RUN_ESTADOS_FINALES:
        raise ValidationError("estado_invalido")

    with client.cursor() as cur:
        cur.execute(
            "UPDATE ABREGONZA.TREP_AGENTE_RUN SET ESTADO = :1, RESUMEN = :2, "
            "COMMIT_SHA = :3, FECHA_FIN = SYSDATE WHERE RUN_ID = :4",
            [estado, resumen or "", commit_sha, run_id],
        )
        if cur.rowcount != 1:
            raise LookupError("not_found")
        cur.connection.commit()
    return {"run_id": run_id, "estado": estado}
