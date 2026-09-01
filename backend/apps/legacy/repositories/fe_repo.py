"""Facturación Electrónica (e-CF): TFE_CONFIG, TFE_SECUENCIA, TFE_TOKEN."""
from __future__ import annotations

from datetime import datetime

from .. import client

CONFIG_COLS = (
    "no_cia, ambiente, rnc_emisor, razon_social, nombre_comercial, "
    "direccion_emisor, municipio, provincia, cert_subject, cert_vence, "
    "estado_cert, activo, fecha_actualiza"
)


def get_config(no_cia: str) -> dict | None:
    rows = client.fetch_dicts(
        f"SELECT {CONFIG_COLS}, "
        "CASE WHEN certificado_p12 IS NULL THEN 'N' ELSE 'S' END tiene_cert "
        "FROM FAT.TFE_CONFIG WHERE no_cia = :1",
        [no_cia],
    )
    if not rows:
        return None
    r = rows[0]
    for k in ('cert_vence', 'fecha_actualiza'):
        if r.get(k):
            r[k] = r[k].strftime('%Y-%m-%d')
    return r


def upsert_config(no_cia: str, data: dict) -> None:
    campos = ('ambiente', 'rnc_emisor', 'razon_social', 'nombre_comercial',
              'direccion_emisor', 'municipio', 'provincia', 'estado_cert',
              'activo')
    valores = [data.get(c) for c in campos]
    with client.cursor() as cur:
        cur.execute(
            "MERGE INTO FAT.TFE_CONFIG t "
            "USING (SELECT :b1 no_cia FROM dual) s ON (t.no_cia = s.no_cia) "
            "WHEN MATCHED THEN UPDATE SET ambiente=:b2, rnc_emisor=:b3, "
            " razon_social=:b4, nombre_comercial=:b5, direccion_emisor=:b6, "
            " municipio=:b7, provincia=:b8, estado_cert=:b9, activo=:b10, "
            " fecha_actualiza=SYSDATE "
            "WHEN NOT MATCHED THEN INSERT "
            " (no_cia, ambiente, rnc_emisor, razon_social, nombre_comercial, "
            "  direccion_emisor, municipio, provincia, estado_cert, activo) "
            " VALUES (:b1, :b2, :b3, :b4, :b5, :b6, :b7, :b8, :b9, :b10)",
            {'b1': no_cia, 'b2': valores[0], 'b3': valores[1],
             'b4': valores[2], 'b5': valores[3], 'b6': valores[4],
             'b7': valores[5], 'b8': valores[6], 'b9': valores[7],
             'b10': valores[8]},
        )
        cur.connection.commit()


def save_certificado(no_cia: str, p12_bytes: bytes, password_enc: str,
                     subject: str, vence: datetime) -> None:
    vence_naive = vence.replace(tzinfo=None) if vence.tzinfo else vence
    with client.cursor() as cur:
        cur.execute(
            "UPDATE FAT.TFE_CONFIG SET certificado_p12=:1, "
            "cert_password_enc=:2, cert_subject=:3, cert_vence=:4, "
            "fecha_actualiza=SYSDATE WHERE no_cia=:5",
            [p12_bytes, password_enc, subject[:250], vence_naive, no_cia],
        )
        if cur.rowcount == 0:
            raise ValueError('Configure primero los datos del emisor')
        cur.connection.commit()


def get_certificado(no_cia: str) -> tuple[bytes, str] | None:
    """Devuelve (p12_bytes, password_enc) o None."""
    with client.cursor() as cur:
        cur.execute(
            "SELECT certificado_p12, cert_password_enc "
            "FROM FAT.TFE_CONFIG WHERE no_cia=:1", [no_cia])
        row = cur.fetchone()
        if not row or row[0] is None:
            return None
        # El LOB debe leerse mientras el cursor/conexión sigue vivo: si se
        # lee después de salir del `with`, el pool ya liberó la conexión
        # (DPY-1001 not connected to database).
        blob = row[0].read() if hasattr(row[0], 'read') else row[0]
        return blob, row[1]


def list_secuencias(no_cia: str) -> list[dict]:
    rows = client.fetch_dicts(
        "SELECT no_cia, tipo_ecf, secuencia_desde, secuencia_hasta, "
        "prox_secuencia, fecha_vence, activa "
        "FROM FAT.TFE_SECUENCIA WHERE no_cia=:1 "
        "ORDER BY tipo_ecf, secuencia_desde",
        [no_cia],
    )
    for r in rows:
        if r.get('fecha_vence'):
            r['fecha_vence'] = r['fecha_vence'].strftime('%Y-%m-%d')
    return rows


def upsert_secuencia(no_cia: str, s: dict) -> None:
    with client.cursor() as cur:
        cur.execute(
            "MERGE INTO FAT.TFE_SECUENCIA t "
            "USING (SELECT :b1 no_cia, :b2 tipo_ecf, :b3 secuencia_desde "
            "       FROM dual) s "
            "ON (t.no_cia=s.no_cia AND t.tipo_ecf=s.tipo_ecf "
            "    AND t.secuencia_desde=s.secuencia_desde) "
            "WHEN MATCHED THEN UPDATE SET secuencia_hasta=:b4, "
            " prox_secuencia=:b5, fecha_vence=:b6, activa=:b7 "
            "WHEN NOT MATCHED THEN INSERT (no_cia, tipo_ecf, secuencia_desde, "
            " secuencia_hasta, prox_secuencia, fecha_vence, activa) "
            " VALUES (:b1, :b2, :b3, :b4, :b5, :b6, :b7)",
            {'b1': no_cia, 'b2': s['tipo_ecf'],
             'b3': int(s['secuencia_desde']),
             'b4': int(s['secuencia_hasta']),
             'b5': int(s['prox_secuencia']),
             'b6': datetime.strptime(str(s['fecha_vence'])[:10], '%Y-%m-%d'),
             'b7': s.get('activa', 'S')},
        )
        cur.connection.commit()


def consumir_siguiente_encf(no_cia: str, tipo_ecf: int) -> dict:
    """Reserva atomicamente el siguiente e-NCF de TFE_SECUENCIA.

    Devuelve ``{'e_ncf': ..., 'fecha_vencimiento_secuencia': datetime}``.
    ``fecha_vencimiento_secuencia`` es ``TFE_SECUENCIA.fecha_vence`` del
    rango consumido -- lo necesita ``ecf_builder`` para
    ``IdDoc/FechaVencimientoSecuencia``, obligatorio SOLO en e-CF tipo 31
    segun el XSD real (``e-CF-31-v1.0.xsd`` lo exige minOccurs=1 justo
    despues de ``eNCF``; ``e-CF-32-v1.0.xsd`` no tiene ese elemento en
    absoluto -- confirmado diffeando ambos XSD, no es un campo generico
    de los 10 tipos).

    Mismo patron de reserva (SELECT...FOR UPDATE + UPDATE del contador) que
    fat_repo.create_factura ya usa para el NCF de papel en CNT.TCNT_NCF:
    aqui el contador es TFE_SECUENCIA.prox_secuencia. Toma el primer rango
    activo (activa='S') que todavia no se agoto (prox_secuencia <=
    secuencia_hasta) para (no_cia, tipo_ecf).

    Efecto secundario irreversible: incrementa prox_secuencia en la BD real
    aunque el e-CF que se arme despues nunca se firme/envie (igual que un
    NCF de papel que se reserva y despues se anula) -- llamar solo cuando
    de verdad se va a generar el documento, no en un preview.

    Lanza ValueError si no hay secuencia configurada/activa/disponible.
    """
    tipo = int(tipo_ecf)
    with client.cursor() as cur:
        cur.execute(
            "SELECT secuencia_desde, secuencia_hasta, prox_secuencia, fecha_vence "
            "FROM FAT.TFE_SECUENCIA "
            "WHERE no_cia=:1 AND tipo_ecf=:2 AND NVL(activa,'S')='S' "
            "  AND prox_secuencia <= secuencia_hasta "
            "ORDER BY secuencia_desde FOR UPDATE",
            [no_cia, tipo])
        row = cur.fetchone()
        if not row:
            raise ValueError(
                f"No hay secuencia e-NCF activa/disponible para tipo {tipo} "
                f"en la compania {no_cia}. Configure TFE_SECUENCIA primero.")
        secuencia_desde, _hasta, prox, fecha_vence = (
            int(row[0]), int(row[1]), int(row[2]), row[3])
        cur.execute(
            "UPDATE FAT.TFE_SECUENCIA SET prox_secuencia=:1 "
            "WHERE no_cia=:2 AND tipo_ecf=:3 AND secuencia_desde=:4",
            [prox + 1, no_cia, tipo, secuencia_desde])
        cur.connection.commit()
    return {
        'e_ncf': f"E{tipo:02d}{prox:010d}",
        'fecha_vencimiento_secuencia': fecha_vence,
    }


def get_config_por_rnc(rnc: str) -> dict | None:
    """Busca la config FE cuya empresa emite con este RNC (para recepción P2P)."""
    rows = client.fetch_dicts(
        f"SELECT {CONFIG_COLS} FROM FAT.TFE_CONFIG WHERE rnc_emisor = :1",
        [rnc],
    )
    return rows[0] if rows else None


def save_documento_recibido(no_cia: str, rnc_emisor: str, e_ncf: str | None,
                            tipo: str, xml: str, track_id: str) -> None:
    """Registra un e-CF o ACECF recibido de otro emisor (recepción P2P)."""
    with client.cursor() as cur:
        cur.execute(
            "INSERT INTO FAT.TFE_DOCUMENTO_RECIBIDO "
            "(no_cia, rnc_emisor, e_ncf, tipo, xml_recibido, track_id) "
            "VALUES (:1, :2, :3, :4, :5, :6)",
            [no_cia, rnc_emisor, (e_ncf or '')[:20], tipo, xml, track_id],
        )
        cur.connection.commit()


def get_token(no_cia: str, ambiente: str) -> str | None:
    rows = client.fetch_dicts(
        "SELECT token FROM FAT.TFE_TOKEN "
        "WHERE no_cia=:1 AND ambiente=:2 AND expira > SYSDATE + (5/1440)",
        [no_cia, ambiente],
    )
    return rows[0]['token'] if rows else None


def save_token(no_cia: str, ambiente: str, token: str,
               expira: datetime) -> None:
    expira_naive = expira.replace(tzinfo=None) if expira.tzinfo else expira
    with client.cursor() as cur:
        cur.execute(
            "DELETE FROM FAT.TFE_TOKEN WHERE no_cia=:1 AND ambiente=:2",
            [no_cia, ambiente])
        cur.execute(
            "INSERT INTO FAT.TFE_TOKEN (no_cia, ambiente, token, expira) "
            "VALUES (:1, :2, :3, :4)",
            [no_cia, ambiente, token, expira_naive],
        )
        cur.connection.commit()


# ---------------------------------------------------------------------------
# Bitácora de documentos enviados (TFE_DOCUMENTO) — Fase 2, Task 3
# ---------------------------------------------------------------------------

DOCUMENTO_LIST_COLS = (
    "no_cia, e_ncf, tipo_ecf, punto, tipo_docu, no_docu, rnc_comprador, "
    "monto_total, estado, track_id, codigo_seguridad, es_prueba, intentos, "
    "fecha_firma, fecha_crea, fecha_actualiza"
)


def save_documento_enviado(no_cia: str, e_ncf: str, tipo_ecf: str,
                           track_id: str, xml_firmado: str, respuesta: str,
                           es_prueba: str = 'N') -> None:
    """Registra en la bitácora TFE_DOCUMENTO un e-CF ya firmado y enviado.

    MERGE (mismo patrón que ``upsert_config``/``upsert_secuencia``): la
    primera vez para un ``(no_cia, e_ncf)`` inserta la fila (INTENTOS=1,
    ESTADO='ENVIADO'); si ``dgii_client.enviar_ecf`` se reintenta para el
    mismo e-NCF (p.ej. tras un timeout de red), actualiza track_id/xml/
    respuesta e incrementa INTENTOS en vez de duplicar la fila -- coherente
    con la PK real (NO_CIA, E_NCF).

    ``es_prueba='S'`` marca los envíos hechos contra el Set de Pruebas de
    certificación DGII (ver 2026-08-31-fe-documento-es-prueba.sql) para que
    puedan excluirse de reportes/consultas de producción real; el llamador
    (flujo de certificación, Task 5) es quien decide el valor -- por
    defecto 'N' para no romper el flujo real de facturación ya desplegado.
    """
    with client.cursor() as cur:
        cur.execute(
            "MERGE INTO FAT.TFE_DOCUMENTO t "
            "USING (SELECT :b1 no_cia, :b2 e_ncf FROM dual) s "
            "ON (t.no_cia = s.no_cia AND t.e_ncf = s.e_ncf) "
            "WHEN MATCHED THEN UPDATE SET tipo_ecf=:b3, track_id=:b4, "
            " xml_firmado=:b5, respuesta_dgii=:b6, es_prueba=:b7, "
            " estado='ENVIADO', fecha_firma=SYSDATE, "
            " intentos=NVL(intentos,0)+1, fecha_actualiza=SYSDATE "
            "WHEN NOT MATCHED THEN INSERT "
            " (no_cia, e_ncf, tipo_ecf, track_id, xml_firmado, "
            "  respuesta_dgii, es_prueba, estado, fecha_firma, intentos) "
            " VALUES (:b1, :b2, :b3, :b4, :b5, :b6, :b7, 'ENVIADO', "
            "  SYSDATE, 1)",
            {'b1': no_cia, 'b2': e_ncf, 'b3': tipo_ecf, 'b4': track_id,
             'b5': xml_firmado, 'b6': respuesta, 'b7': es_prueba},
        )
        cur.connection.commit()


def list_documentos(no_cia: str, filtros: dict | None = None) -> list[dict]:
    """Lista la bitácora TFE_DOCUMENTO paginada y filtrada.

    ``filtros`` (todas opcionales):
      - ``estado``: filtra por TFE_DOCUMENTO.estado exacto (p.ej. 'ENVIADO',
        'ACEPTADO', 'RECHAZADO').
      - ``tipo_ecf``: filtra por tipo de e-CF ('31', '32', ...).
      - ``es_prueba``: 'S' o 'N' -- para que el flujo de certificación
        (Task 5) pueda ver solo el Set de Pruebas, y las pantallas de
        producción (Task 4) puedan excluirlo por defecto.
      - ``limit``/``offset``: paginación, mismo patrón ROWNUM de doble
        wrap que ``cxc_repo.list_documentos``/``fat_repo`` (conduce) --
        Oracle 11g no soporta OFFSET...FETCH NEXT. Default limit=50,
        offset=0; limit se acota a 500 para evitar cargas completas.

    No incluye XML_FIRMADO/RESPUESTA_DGII (CLOBs pesados que el listado no
    necesita); quedan disponibles vía consulta directa a la tabla para una
    futura vista de detalle.
    """
    filtros = filtros or {}
    where = ['no_cia = :1']
    params: list = [no_cia]
    if filtros.get('estado'):
        params.append(filtros['estado'])
        where.append(f"estado = :{len(params)}")
    if filtros.get('tipo_ecf'):
        params.append(filtros['tipo_ecf'])
        where.append(f"tipo_ecf = :{len(params)}")
    if filtros.get('es_prueba'):
        params.append(filtros['es_prueba'])
        where.append(f"NVL(es_prueba,'N') = :{len(params)}")
    where_sql = ' AND '.join(where)

    limit = min(int(filtros.get('limit') or 50), 500)
    offset = max(int(filtros.get('offset') or 0), 0)
    end_row_pos = len(params) + 1
    start_row_pos = len(params) + 2
    params_paged = params + [offset + limit, offset]

    sql = (
        "SELECT * FROM ( "
        "  SELECT a.*, ROWNUM rn FROM ( "
        f"    SELECT {DOCUMENTO_LIST_COLS} "
        "    FROM FAT.TFE_DOCUMENTO "
        f"    WHERE {where_sql} "
        "    ORDER BY NVL(fecha_actualiza, fecha_crea) DESC, e_ncf DESC "
        f"  ) a WHERE ROWNUM <= :{end_row_pos} "
        f") WHERE rn > :{start_row_pos}"
    )
    rows = client.fetch_dicts(sql, params_paged)
    for r in rows:
        for k in ('fecha_firma', 'fecha_crea', 'fecha_actualiza'):
            if r.get(k):
                r[k] = r[k].strftime('%Y-%m-%d %H:%M:%S')
        r.pop('rn', None)
    return rows
