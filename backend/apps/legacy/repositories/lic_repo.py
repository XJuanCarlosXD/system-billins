"""Repositorio LIC: acceso a las tablas FAT.TLIC_* vía apps.legacy.client (thick mode)."""
from __future__ import annotations

import json

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


def get_oportunidad(oportunidad_id: int) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT id, no_cia, referencia, titulo FROM FAT.TLIC_OPORTUNIDAD WHERE id = :1",
        [oportunidad_id],
    )
    return rows[0] if rows else None


def actualizar_detalle_oportunidad(oportunidad_id: int, detalle: dict) -> None:
    """Guarda datos que el scraper lee directamente del Aviso de Contrato (no
    de la IA): descripción completa (reemplaza el título truncado por el
    portal a ~100 caracteres en el feed de Oportunidades), unidad de
    requisición y presupuesto estimado. Solo actualiza los campos que
    vinieron con valor -- ``detalle`` puede traer alguno en None si esa
    plantilla de proceso no lo expone."""
    sets = []
    params: dict = {"id": oportunidad_id}
    if detalle.get("descripcion_completa"):
        sets.append("titulo = :titulo")
        params["titulo"] = detalle["descripcion_completa"][:500]
    if detalle.get("unidad_requisicion"):
        sets.append("unidad_requisicion = :unidad_requisicion")
        params["unidad_requisicion"] = detalle["unidad_requisicion"][:200]
    if detalle.get("presupuesto_estimado"):
        sets.append("presupuesto_estimado = :presupuesto_estimado")
        params["presupuesto_estimado"] = detalle["presupuesto_estimado"][:50]
    if detalle.get("modalidad_entrega"):
        sets.append("modalidad_entrega = :modalidad_entrega")
        params["modalidad_entrega"] = detalle["modalidad_entrega"]
    if not sets:
        return
    with client.cursor() as cur:
        cur.execute(
            f"UPDATE FAT.TLIC_OPORTUNIDAD SET {', '.join(sets)} WHERE id = :id",
            params,
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


def list_oportunidades(
    no_cia: str, estado_portal: str | None = None, solo_abiertas: bool = True
) -> list[dict]:
    """Por defecto solo trae oportunidades cuya fecha limite de ofertas no ha
    pasado (las unicas en las que realmente se puede participar todavia) --
    el portal en si mantiene el historial completo desde 2020, incluyendo
    procesos ya cerrados/adjudicados hace años, que no son "oportunidades"
    reales de negocio."""
    sql = (
        "SELECT id, referencia, tipo_proceso, entidad, titulo, estado_portal, "
        "ofertas_presentadas, ofertas_creadas, fecha_publicacion, fecha_limite, "
        "resumen_ia, estado_cumplimiento, recomendacion_ia, "
        "unidad_requisicion, presupuesto_estimado "
        "FROM FAT.TLIC_OPORTUNIDAD WHERE no_cia = :1"
    )
    params = [no_cia]
    if estado_portal:
        sql += " AND estado_portal = :2"
        params.append(estado_portal)
    if solo_abiertas:
        sql += " AND fecha_limite >= TRUNC(SYSDATE)"
    sql += " ORDER BY fecha_limite ASC"
    return client.fetch_dicts(sql, params)


def guardar_documento(oportunidad_id: int, tipo_documento: str, nombre_archivo: str,
                       ruta_archivo: str, estado: str = "ok",
                       mensaje_error: str | None = None) -> None:
    with client.cursor() as cur:
        cur.execute(
            "INSERT INTO FAT.TLIC_DOCUMENTO (oportunidad_id, tipo_documento, nombre_archivo, "
            "ruta_archivo, estado, mensaje_error) VALUES (:1, :2, :3, :4, :5, :6)",
            [oportunidad_id, tipo_documento, nombre_archivo, ruta_archivo, estado, mensaje_error],
        )
        cur.connection.commit()


def list_documentos(oportunidad_id: int) -> list[dict]:
    return client.fetch_dicts(
        "SELECT id, tipo_documento, nombre_archivo, ruta_archivo, estado, mensaje_error, "
        "resumen_ia, descargado_en "
        "FROM FAT.TLIC_DOCUMENTO WHERE oportunidad_id = :1 ORDER BY descargado_en",
        [oportunidad_id],
    )


def get_documento(documento_id: int) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT id, ruta_archivo, nombre_archivo, resumen_ia "
        "FROM FAT.TLIC_DOCUMENTO WHERE id = :1",
        [documento_id],
    )
    return rows[0] if rows else None


def guardar_resumen_documento(documento_id: int, resumen: str) -> None:
    with client.cursor() as cur:
        cur.execute(
            "UPDATE FAT.TLIC_DOCUMENTO SET resumen_ia = :1 WHERE id = :2",
            [resumen, documento_id],
        )
        cur.connection.commit()


def tiene_documentos(oportunidad_id: int) -> bool:
    """True si la oportunidad ya tiene al menos un documento registrado (ok o error).

    Usado por el orquestador para permitir reintentar la descarga de documentos en una
    corrida futura cuando ``download_documentos`` falló por completo (excepción, no una
    fila individual) en la primera pasada de una oportunidad ya vista — de lo contrario
    ``es_nueva=False`` en pasadas siguientes la dejaría sin documentos para siempre.
    """
    row = client.fetch_one(
        "SELECT COUNT(*) FROM FAT.TLIC_DOCUMENTO WHERE oportunidad_id = :1",
        [oportunidad_id],
    )
    return bool(row and row[0] > 0)


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
    # Solo se muestran los rubros del ULTIMO PDF cargado para esta empresa,
    # no la union de todos los uploads historicos -- una carga nueva
    # reemplaza la lista visible en vez de acumularse con las anteriores
    # (evita duplicados cuando el mismo PDF se sube mas de una vez).
    # Oracle 11g no soporta "FETCH FIRST ... ROWS ONLY" (12c+) -- se usa el
    # patron clasico de subquery ordenada + ROWNUM = 1 para el top-1.
    return client.fetch_dicts(
        "SELECT r.codigo, r.descripcion FROM FAT.TLIC_RUBRO r "
        "WHERE r.rubro_pdf_id = ("
        "  SELECT id FROM ("
        "    SELECT p.id FROM FAT.TLIC_RUBRO_PDF p "
        "    WHERE p.no_cia = :1 AND p.estado_extraccion = 'hecho' "
        "    ORDER BY p.id DESC"
        "  ) WHERE ROWNUM = 1"
        ") ORDER BY r.descripcion",
        [no_cia],
    )


# --- Documentos propios de la empresa (para validar contra requisitos) ---

def guardar_documento_empresa(
    no_cia: str, punto: str | None, nombre_archivo: str, ruta_archivo: str,
    descripcion: str | None, fecha_vencimiento: str | None,
    tipo_documento_id: int | None = None,
) -> int:
    with client.cursor() as cur:
        out_id = cur.var(oracledb.NUMBER)
        cur.execute(
            "INSERT INTO FAT.TLIC_DOCUMENTO_EMPRESA "
            "(no_cia, punto, nombre_archivo, ruta_archivo, descripcion, fecha_vencimiento, "
            "tipo_documento_id) "
            "VALUES (:no_cia, :punto, :nombre, :ruta, :descripcion, "
            "TO_DATE(:fecha_vencimiento, 'YYYY-MM-DD'), :tipo_documento_id) RETURNING id INTO :out_id",
            {
                "no_cia": no_cia, "punto": punto, "nombre": nombre_archivo,
                "ruta": ruta_archivo, "descripcion": descripcion,
                "fecha_vencimiento": fecha_vencimiento, "tipo_documento_id": tipo_documento_id,
                "out_id": out_id,
            },
        )
        cur.connection.commit()
        return int(out_id.getvalue()[0])


def list_documentos_empresa(no_cia: str) -> list[dict]:
    # vencido se calcula en SQL (no en Python) para que quede consistente
    # sin importar la zona horaria del proceso que lo consuma.
    return client.fetch_dicts(
        "SELECT d.id, d.no_cia, d.punto, d.nombre_archivo, d.ruta_archivo, d.descripcion, "
        "d.fecha_vencimiento, d.tipo_documento_id, t.nombre AS tipo_documento_nombre, "
        "CASE WHEN d.fecha_vencimiento IS NOT NULL AND d.fecha_vencimiento < TRUNC(SYSDATE) "
        "     THEN 1 ELSE 0 END AS vencido, "
        "d.subido_en "
        "FROM FAT.TLIC_DOCUMENTO_EMPRESA d "
        "LEFT JOIN FAT.TLIC_TIPO_DOCUMENTO t ON t.id = d.tipo_documento_id "
        "WHERE d.no_cia = :1 ORDER BY d.nombre_archivo",
        [no_cia],
    )


# --- Catalogo de tipos de documento (Configuracion > Licitacion) ---

def crear_tipo_documento(codigo: str, nombre: str) -> int:
    with client.cursor() as cur:
        out_id = cur.var(oracledb.NUMBER)
        cur.execute(
            "INSERT INTO FAT.TLIC_TIPO_DOCUMENTO (codigo, nombre) VALUES (:1, :2) "
            "RETURNING id INTO :3",
            [codigo, nombre, out_id],
        )
        cur.connection.commit()
        return int(out_id.getvalue()[0])


def list_tipos_documento(solo_activos: bool = True) -> list[dict]:
    sql = "SELECT id, codigo, nombre, activo FROM FAT.TLIC_TIPO_DOCUMENTO"
    if solo_activos:
        sql += " WHERE activo = 'S'"
    sql += " ORDER BY nombre"
    return client.fetch_dicts(sql, [])


def actualizar_tipo_documento(tipo_id: int, nombre: str | None = None, activo: str | None = None) -> None:
    sets = []
    params: dict = {"id": tipo_id}
    if nombre is not None:
        sets.append("nombre = :nombre")
        params["nombre"] = nombre
    if activo is not None:
        sets.append("activo = :activo")
        params["activo"] = activo
    if not sets:
        return
    with client.cursor() as cur:
        cur.execute(f"UPDATE FAT.TLIC_TIPO_DOCUMENTO SET {', '.join(sets)} WHERE id = :id", params)
        cur.connection.commit()


def get_documento_empresa(documento_empresa_id: int) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT id, ruta_archivo, nombre_archivo FROM FAT.TLIC_DOCUMENTO_EMPRESA WHERE id = :1",
        [documento_empresa_id],
    )
    return rows[0] if rows else None


# --- Analisis IA + requisitos por oportunidad ---

def guardar_analisis_oportunidad(
    oportunidad_id: int, resumen_ia: str, estado_cumplimiento: str,
    recomendacion_ia: str | None, documentos_faltantes: list[dict] | None = None,
) -> None:
    with client.cursor() as cur:
        cur.execute(
            "UPDATE FAT.TLIC_OPORTUNIDAD SET resumen_ia = :1, estado_cumplimiento = :2, "
            "recomendacion_ia = :3, documentos_faltantes = :4 WHERE id = :5",
            [
                resumen_ia, estado_cumplimiento, recomendacion_ia,
                json.dumps(documentos_faltantes or [], ensure_ascii=False)[:2000],
                oportunidad_id,
            ],
        )
        cur.connection.commit()


def get_oportunidad_completa(oportunidad_id: int) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT id, no_cia, referencia, titulo, resumen_ia, estado_cumplimiento, "
        "recomendacion_ia, documentos_faltantes "
        "FROM FAT.TLIC_OPORTUNIDAD WHERE id = :1",
        [oportunidad_id],
    )
    return rows[0] if rows else None


def reemplazar_productos(oportunidad_id: int, productos: list[dict]) -> None:
    """Poblada por el SCRAPER (Parte A/orchestrator), no por IA -- cada corrida que
    releé el Aviso de Contrato es una foto nueva completa, mismo patron que
    reemplazar_requisitos."""
    with client.cursor() as cur:
        cur.execute("DELETE FROM FAT.TLIC_PRODUCTO WHERE oportunidad_id = :1", [oportunidad_id])
        for p in productos:
            cur.execute(
                "INSERT INTO FAT.TLIC_PRODUCTO (oportunidad_id, descripcion, cantidad) "
                "VALUES (:1, :2, :3)",
                [oportunidad_id, p["descripcion"], p.get("cantidad")],
            )
        cur.connection.commit()


def list_productos(oportunidad_id: int) -> list[dict]:
    return client.fetch_dicts(
        "SELECT id, descripcion, cantidad, actualizado_en FROM FAT.TLIC_PRODUCTO "
        "WHERE oportunidad_id = :1 ORDER BY id",
        [oportunidad_id],
    )


def buscar_precio_historico(no_cia: str, texto_producto: str) -> list[dict]:
    """Busqueda de CODIGO (LIKE, sin IA) del precio mas reciente al que se
    factuo/cotizo algo con nombre parecido -- join FAT.TFAT_FACTURAL +
    FAT.TFAT_FACTURA por (no_cia, punto, tipo_factura, no_factura), igual
    patron de join que el resto de fat_repo. No intenta fuzzy matching
    avanzado: un LIKE simple sobre la descripcion es suficiente para dar a la
    IA (apps.lic.services.recomendar_precio) contexto real en vez de nada --
    mejorar el matching queda fuera de alcance de este plan."""
    patron = f"%{texto_producto.strip()}%"
    return client.fetch_dicts(
        "SELECT fl.no_produ, fl.descripcion, fl.precio, f.fecha "
        "FROM FAT.TFAT_FACTURAL fl "
        "JOIN FAT.TFAT_FACTURA f ON f.no_cia = fl.no_cia AND f.punto = fl.punto "
        "  AND f.tipo_factura = fl.tipo_factura AND f.no_factura = fl.no_factura "
        "WHERE fl.no_cia = :1 AND UPPER(fl.descripcion) LIKE UPPER(:2) "
        "ORDER BY f.fecha DESC",
        [no_cia, patron],
    )


def reemplazar_requisitos(oportunidad_id: int, requisitos: list[dict]) -> None:
    """Borra los requisitos previos de la oportunidad y guarda los nuevos --
    cada "Analizar" es una foto nueva completa, no un merge incremental."""
    with client.cursor() as cur:
        cur.execute(
            "DELETE FROM FAT.TLIC_REQUISITO WHERE oportunidad_id = :1", [oportunidad_id]
        )
        for r in requisitos:
            cur.execute(
                "INSERT INTO FAT.TLIC_REQUISITO "
                "(oportunidad_id, descripcion, estado, justificacion, documento_empresa_id) "
                "VALUES (:1, :2, :3, :4, :5)",
                [
                    oportunidad_id, r["descripcion"], r.get("estado", "sin_evaluar"),
                    r.get("justificacion"), r.get("documento_empresa_id"),
                ],
            )
        cur.connection.commit()


def list_requisitos(oportunidad_id: int) -> list[dict]:
    return client.fetch_dicts(
        "SELECT id, descripcion, estado, justificacion, documento_empresa_id, actualizado_en "
        "FROM FAT.TLIC_REQUISITO WHERE oportunidad_id = :1 ORDER BY id",
        [oportunidad_id],
    )
