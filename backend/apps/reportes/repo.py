"""Persistencia de TREP_PROBLEMA / TREP_IMAGEN (modulo Reportes de problemas).

Sin ORM: acceso directo con oracledb, mismo estilo que apps/asistente/persist.py.
Los CLOB/BLOB se leen dentro del bloque `with client.cursor()` — fuera de el la
conexion ya volvio al pool y `lob.read()` lanza DPY-1001 (ver apps/asistente).
"""

from __future__ import annotations

import base64
import os
import uuid
from datetime import datetime

import oracledb
from django.conf import settings

from apps.legacy import client

ESTADOS_VALIDOS = ("ABIERTO", "EN_PROGRESO", "HOLD", "COMPLETADO", "CANCELADO")
MODULOS_VALIDOS = (
    "FAT", "INV", "CXC", "CXP", "CNT", "ACC", "ACF", "CHC", "SDN", "ODC",
    "MAN", "FE", "ASISTENTE", "OTRO",
)
MAX_IMAGENES = 3
MAX_IMAGEN_BYTES = 5 * 1024 * 1024


class ValidationError(Exception):
    pass


def _txt_log_dir() -> str:
    return os.path.join(str(settings.BASE_DIR), "logs", "errores_sistema")


def _write_txt_log(
    error_id: int, *, usuario, modulo, url, status_http, mensaje, detalle,
) -> None:
    """Vuelca el error a un .txt en disco ademas de TSYS_ERROR_LOG, para que
    el runner ZentoryERP-Reportes-AutoFix (u otro agente) pueda leerlo con un
    simple `cat` sin tener que consultar Oracle. Best-effort: nunca debe
    romper el flujo de logueo si el filesystem falla."""
    try:
        d = _txt_log_dir()
        os.makedirs(d, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        path = os.path.join(d, f"error_{error_id}_{ts}.txt")
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(f"ERROR_ID: {error_id}\n")
            fh.write(f"FECHA: {datetime.now().isoformat()}\n")
            fh.write(f"USUARIO: {usuario or ''}\n")
            fh.write(f"MODULO: {modulo or ''}\n")
            fh.write(f"URL: {url or ''}\n")
            fh.write(f"STATUS_HTTP: {status_http if status_http is not None else ''}\n")
            fh.write(f"MENSAJE: {mensaje}\n")
            fh.write("\n--- DETALLE ---\n")
            fh.write(detalle or "(sin detalle)")
    except Exception:  # noqa: BLE001
        pass


def log_error(
    *, usuario: str | None, modulo: str | None, url: str | None,
    status_http: int | None, mensaje: str, detalle: str | None = None,
) -> int:
    """Registro silencioso de un error. Best-effort: si Oracle está caído,
    el caller decide si propagar o tragarse la excepción (la vista se la
    traga, ver ErrorLogView)."""
    with client.cursor() as cur:
        out_id = cur.var(oracledb.NUMBER)
        cur.execute(
            "INSERT INTO ABREGONZA.TSYS_ERROR_LOG "
            "(USUARIO, MODULO, URL, STATUS_HTTP, MENSAJE, DETALLE, FECHA) "
            "VALUES (:1, :2, :3, :4, :5, :6, SYSDATE) "
            "RETURNING ERROR_ID INTO :7",
            [(usuario or "").upper()[:30] or None, (modulo or "").upper()[:20] or None,
             (url or "")[:500] or None, status_http, (mensaje or "")[:1000], detalle,
             out_id],
        )
        cur.connection.commit()
    error_id = int(out_id.getvalue()[0])
    _write_txt_log(
        error_id, usuario=usuario, modulo=modulo, url=url,
        status_http=status_http, mensaje=mensaje, detalle=detalle,
    )
    return error_id


def vincular_reporte(error_log_id: int, reporte_id: str) -> None:
    with client.cursor() as cur:
        cur.execute(
            "UPDATE ABREGONZA.TSYS_ERROR_LOG SET REPORTE_ID = :1 WHERE ERROR_ID = :2",
            [reporte_id, error_log_id],
        )
        cur.connection.commit()


def log_error_ticket(
    *, usuario: str | None, modulo: str | None, url: str | None,
    status_http: int | None, mensaje: str, detalle: str | None = None,
) -> dict:
    """Registra el error (TSYS_ERROR_LOG + .txt) y ademas abre un
    TREP_PROBLEMA ABIERTO vinculado. Sin esto los errores quedaban solo en el
    log, invisibles para el runner ZentoryERP-Reportes-AutoFix que unicamente
    lee TREP_PROBLEMA -- con el ticket entran al mismo ciclo (cada 2h) que
    los reportes que los usuarios abren a mano, sin cambiar el runner."""
    error_id = log_error(
        usuario=usuario, modulo=modulo, url=url,
        status_http=status_http, mensaje=mensaje, detalle=detalle,
    )
    usuario_reporte = (usuario or "SISTEMA").upper()[:30]
    titulo = f"Error automático: {(mensaje or '')[:150]}"
    partes = [mensaje or ""]
    if url:
        partes.append(f"URL: {url}")
    if status_http is not None:
        partes.append(f"HTTP: {status_http}")
    if detalle:
        partes.append(detalle)
    descripcion = "\n\n".join(partes)[:4000]
    reporte_id = None
    try:
        reporte_id = create_reporte(
            usuario=usuario_reporte, modulo=modulo, titulo=titulo,
            descripcion=descripcion, imagenes=[], error_log_id=error_id,
        )
    except Exception:  # noqa: BLE001
        # El log ya quedo en TSYS_ERROR_LOG/.txt aunque el ticket falle --
        # nunca romper el flujo del caller por esto.
        pass
    return {"error_id": error_id, "reporte_id": reporte_id}


def log_fallback(
    *, modulo: str, mensaje: str, detalle: str | None = None,
    usuario: str | None = None, url: str | None = None,
) -> dict:
    """Para usar dentro de bloques `except` que hoy devuelven un valor por
    defecto en silencio. Mismo tratamiento que un error 500 real: queda en
    TSYS_ERROR_LOG + .txt y abre un ticket en Reportes de Problemas para que
    no pase desapercibido."""
    return log_error_ticket(
        usuario=usuario, modulo=modulo, url=url,
        status_http=None, mensaje=mensaje, detalle=detalle,
    )


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
    error_log_id: int | None = None,
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
    if error_log_id:
        vincular_reporte(error_log_id, reporte_id)
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


def list_mensajes(reporte_id: str) -> list[dict]:
    with client.cursor() as cur:
        cur.execute(
            "SELECT MENSAJE_ID, ROL, CONTENIDO, USUARIO, "
            "TO_CHAR(FECHA_CREACION,'YYYY-MM-DD HH24:MI:SS') fecha "
            "FROM ABREGONZA.TREP_MENSAJE WHERE REPORTE_ID = :1 "
            "ORDER BY FECHA_CREACION, MENSAJE_ID",
            [reporte_id],
        )
        cols = [c[0].lower() for c in cur.description]
        out = []
        for row in cur.fetchall():
            d = dict(zip(cols, row))
            if hasattr(d.get("contenido"), "read"):
                d["contenido"] = d["contenido"].read()
            out.append(d)
    return out


def responder_hold(reporte_id: str, *, usuario: str, is_admin: bool, mensaje: str) -> dict:
    """El autor del reporte (o un admin) responde la pregunta que el runner
    dejo en HOLD. Reabre el reporte a ABIERTO para que la proxima corrida del
    runner lo retome -- ve la respuesta al leer TREP_MENSAJE junto con el
    reporte (misma cola normal del Paso 1, sin logica especial de "buscar
    reportes respondidos")."""
    mensaje = (mensaje or "").strip()
    if not mensaje:
        raise ValidationError("mensaje_requerido")

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

        if not is_admin and (autor or "").upper() != (usuario or "").upper():
            raise PermissionError("forbidden")
        if estado_actual != "HOLD":
            raise ValidationError("no_esta_en_hold")

        mensaje_id = str(uuid.uuid4())
        cur.execute(
            "INSERT INTO ABREGONZA.TREP_MENSAJE "
            "(MENSAJE_ID, REPORTE_ID, ROL, CONTENIDO, USUARIO, FECHA_CREACION) "
            "VALUES (:1, :2, 'USUARIO', :3, :4, SYSDATE)",
            [mensaje_id, reporte_id, mensaje, (usuario or "").upper()[:30]],
        )
        cur.execute(
            "UPDATE ABREGONZA.TREP_PROBLEMA SET ESTADO = 'ABIERTO', "
            "FECHA_ACTUALIZACION = SYSDATE WHERE REPORTE_ID = :1",
            [reporte_id],
        )
        cur.connection.commit()
    return {"reporte_id": reporte_id, "estado": "ABIERTO"}


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
    r["mensajes"] = list_mensajes(reporte_id)
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
        elif nuevo_estado == "HOLD":
            # HOLD = "esperando aprobacion externa": el runner automatico lo
            # usa cuando el fix requiere una decision humana (regla de
            # seguridad #4) y no puede avanzar solo. Guarda la nota para que
            # quede claro que se necesita, pero NO marca el reporte como
            # resuelto (sin RESUELTO_POR/FECHA_RESOLUCION).
            cur.execute(
                "UPDATE ABREGONZA.TREP_PROBLEMA SET ESTADO = :1, "
                "NOTA_RESOLUCION = :2, FECHA_ACTUALIZACION = SYSDATE "
                "WHERE REPORTE_ID = :3",
                [nuevo_estado, nota_resolucion, reporte_id],
            )
            if nota_resolucion:
                cur.execute(
                    "INSERT INTO ABREGONZA.TREP_MENSAJE "
                    "(MENSAJE_ID, REPORTE_ID, ROL, CONTENIDO, USUARIO, FECHA_CREACION) "
                    "VALUES (:1, :2, 'RUNNER', :3, :4, SYSDATE)",
                    [str(uuid.uuid4()), reporte_id, nota_resolucion,
                     (usuario or "").upper()[:30]],
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
    # Fuera del bloque `with` de arriba (esa conexion ya volvio al pool):
    # si el reporte estuvo en HOLD antes (el usuario acaba de responder, lo
    # que lo reabre a ABIERTO), trae el hilo de pregunta/respuesta para que
    # el runner tenga el contexto sin tener que adivinar que se le pregunto.
    for r in reportes:
        mensajes = list_mensajes(r["reporte_id"])
        if mensajes:
            r["mensajes"] = mensajes
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
