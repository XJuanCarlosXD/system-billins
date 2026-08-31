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
