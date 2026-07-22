"""Repositorio LIC: acceso a las tablas FAT.TLIC_* vía apps.legacy.client (thick mode)."""
from __future__ import annotations

import oracledb

from apps.legacy import client


def get_credencial(no_cia: str) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT id, no_cia, usuario_portal, estado, ultimo_login_ok, ultimo_error "
        "FROM FAT.TLIC_CREDENCIAL WHERE no_cia = :1",
        [no_cia],
    )
    return rows[0] if rows else None


def get_credencial_con_password(no_cia: str) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT id, no_cia, usuario_portal, password_cifrado, estado "
        "FROM FAT.TLIC_CREDENCIAL WHERE no_cia = :1",
        [no_cia],
    )
    return rows[0] if rows else None


def list_credenciales() -> list[dict]:
    return client.fetch_dicts(
        "SELECT no_cia, usuario_portal, estado, ultimo_login_ok, ultimo_error "
        "FROM FAT.TLIC_CREDENCIAL ORDER BY no_cia",
        [],
    )


def upsert_credencial(no_cia: str, usuario_portal: str, password_cifrado: str) -> None:
    existing = client.fetch_dicts(
        "SELECT id FROM FAT.TLIC_CREDENCIAL WHERE no_cia = :1", [no_cia]
    )
    with client.cursor() as cur:
        if existing:
            cur.execute(
                "UPDATE FAT.TLIC_CREDENCIAL SET usuario_portal = :usuario, "
                "password_cifrado = :password, estado = 'activo', ultimo_error = NULL, "
                "actualizado_en = SYSTIMESTAMP WHERE no_cia = :no_cia",
                {"usuario": usuario_portal, "password": password_cifrado, "no_cia": no_cia},
            )
        else:
            cur.execute(
                "INSERT INTO FAT.TLIC_CREDENCIAL (no_cia, usuario_portal, password_cifrado) "
                "VALUES (:no_cia, :usuario, :password)",
                {"no_cia": no_cia, "usuario": usuario_portal, "password": password_cifrado},
            )
        cur.connection.commit()


def marcar_login_resultado(no_cia: str, ok: bool, mensaje_error: str | None = None) -> None:
    with client.cursor() as cur:
        if ok:
            cur.execute(
                "UPDATE FAT.TLIC_CREDENCIAL SET estado = 'activo', ultimo_login_ok = SYSTIMESTAMP, "
                "ultimo_error = NULL WHERE no_cia = :1",
                [no_cia],
            )
        else:
            cur.execute(
                "UPDATE FAT.TLIC_CREDENCIAL SET estado = 'error_login', ultimo_error = :1 "
                "WHERE no_cia = :2",
                [mensaje_error, no_cia],
            )
        cur.connection.commit()


def upsert_oportunidad(no_cia: str, data: dict) -> tuple[int, bool]:
    """Inserta o actualiza una oportunidad por (no_cia, referencia). Retorna (id, es_nueva)."""
    existing = client.fetch_dicts(
        "SELECT id FROM FAT.TLIC_OPORTUNIDAD WHERE no_cia = :1 AND referencia = :2",
        [no_cia, data["referencia"]],
    )
    # Campos compartidos por INSERT y UPDATE. OJO: cada rama pasa su propio dict de
    # binds (no este mismo reutilizado) porque oracledb thick mode lanza
    # ORA-01036 si el dict trae una clave que no aparece como placeholder en el
    # SQL de esa sentencia (p.ej. no_cia/referencia no se usan en el UPDATE).
    campos = {
        "opportunity_uid": data.get("opportunity_uid"),
        "tipo_proceso": data.get("tipo_proceso"),
        "entidad": data.get("entidad"),
        "titulo": data.get("titulo"),
        "estado_portal": data.get("estado_portal"),
        "ofertas_presentadas": data.get("ofertas_presentadas", 0),
        "ofertas_creadas": data.get("ofertas_creadas", 0),
        "fecha_publicacion": data.get("fecha_publicacion"),
        "fecha_limite": data.get("fecha_limite"),
    }
    with client.cursor() as cur:
        if existing:
            oportunidad_id = existing[0]["id"]
            update_params = dict(campos, id=oportunidad_id)
            cur.execute(
                # opportunity_uid tambien se actualiza: puede venir null en el primer
                # scrape (portal aun no asigna el UID) y llenarse en una pasada posterior.
                "UPDATE FAT.TLIC_OPORTUNIDAD SET opportunity_uid = :opportunity_uid, "
                "tipo_proceso = :tipo_proceso, entidad = :entidad, titulo = :titulo, "
                "estado_portal = :estado_portal, ofertas_presentadas = :ofertas_presentadas, "
                "ofertas_creadas = :ofertas_creadas, "
                "fecha_publicacion = TO_DATE(:fecha_publicacion, 'YYYY-MM-DD HH24:MI'), "
                "fecha_limite = TO_DATE(:fecha_limite, 'YYYY-MM-DD HH24:MI'), "
                "actualizado_en = SYSTIMESTAMP WHERE id = :id",
                update_params,
            )
            cur.connection.commit()
            return oportunidad_id, False

        out_id = cur.var(oracledb.NUMBER)
        insert_params = dict(campos, no_cia=no_cia, referencia=data["referencia"], out_id=out_id)
        cur.execute(
            "INSERT INTO FAT.TLIC_OPORTUNIDAD (no_cia, referencia, opportunity_uid, tipo_proceso, "
            "entidad, titulo, estado_portal, ofertas_presentadas, ofertas_creadas, "
            "fecha_publicacion, fecha_limite) VALUES (:no_cia, :referencia, :opportunity_uid, "
            ":tipo_proceso, :entidad, :titulo, :estado_portal, :ofertas_presentadas, "
            ":ofertas_creadas, TO_DATE(:fecha_publicacion, 'YYYY-MM-DD HH24:MI'), "
            "TO_DATE(:fecha_limite, 'YYYY-MM-DD HH24:MI')) RETURNING id INTO :out_id",
            insert_params,
        )
        cur.connection.commit()
        nuevo_id = int(out_id.getvalue()[0])
        return nuevo_id, True


def list_oportunidades(no_cia: str, estado_portal: str | None = None) -> list[dict]:
    sql = (
        "SELECT id, referencia, tipo_proceso, entidad, titulo, estado_portal, "
        "ofertas_presentadas, ofertas_creadas, fecha_publicacion, fecha_limite "
        "FROM FAT.TLIC_OPORTUNIDAD WHERE no_cia = :1"
    )
    params = [no_cia]
    if estado_portal:
        sql += " AND estado_portal = :2"
        params.append(estado_portal)
    sql += " ORDER BY fecha_limite ASC"
    return client.fetch_dicts(sql, params)


def guardar_documento(oportunidad_id: int, tipo_documento: str, nombre_archivo: str,
                       ruta_archivo: str, estado: str = "ok") -> None:
    with client.cursor() as cur:
        cur.execute(
            "INSERT INTO FAT.TLIC_DOCUMENTO (oportunidad_id, tipo_documento, nombre_archivo, "
            "ruta_archivo, estado) VALUES (:1, :2, :3, :4, :5)",
            [oportunidad_id, tipo_documento, nombre_archivo, ruta_archivo, estado],
        )
        cur.connection.commit()


def list_documentos(oportunidad_id: int) -> list[dict]:
    return client.fetch_dicts(
        "SELECT tipo_documento, nombre_archivo, ruta_archivo, estado, descargado_en "
        "FROM FAT.TLIC_DOCUMENTO WHERE oportunidad_id = :1 ORDER BY descargado_en",
        [oportunidad_id],
    )


def guardar_rubro_pdf(no_cia: str, nombre_archivo: str, ruta_archivo: str) -> int:
    with client.cursor() as cur:
        out_id = cur.var(oracledb.NUMBER)
        cur.execute(
            "INSERT INTO FAT.TLIC_RUBRO_PDF (no_cia, nombre_archivo, ruta_archivo) "
            "VALUES (:1, :2, :3) RETURNING id INTO :4",
            [no_cia, nombre_archivo, ruta_archivo, out_id],
        )
        cur.connection.commit()
        return int(out_id.getvalue()[0])


def marcar_extraccion_rubros(rubro_pdf_id: int, estado: str, mensaje_error: str | None = None) -> None:
    with client.cursor() as cur:
        cur.execute(
            "UPDATE FAT.TLIC_RUBRO_PDF SET estado_extraccion = :1, mensaje_error = :2 WHERE id = :3",
            [estado, mensaje_error, rubro_pdf_id],
        )
        cur.connection.commit()


def guardar_rubros(rubro_pdf_id: int, rubros: list[dict]) -> None:
    with client.cursor() as cur:
        for rubro in rubros:
            cur.execute(
                "INSERT INTO FAT.TLIC_RUBRO (rubro_pdf_id, codigo, descripcion) VALUES (:1, :2, :3)",
                [rubro_pdf_id, rubro.get("codigo"), rubro["descripcion"]],
            )
        cur.connection.commit()


def list_rubros(no_cia: str) -> list[dict]:
    return client.fetch_dicts(
        "SELECT r.codigo, r.descripcion FROM FAT.TLIC_RUBRO r "
        "JOIN FAT.TLIC_RUBRO_PDF p ON p.id = r.rubro_pdf_id "
        "WHERE p.no_cia = :1 ORDER BY r.descripcion",
        [no_cia],
    )
