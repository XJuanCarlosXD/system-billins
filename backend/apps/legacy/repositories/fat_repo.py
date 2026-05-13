"""Facturación (Fat) — repo de lectura sobre el legado."""
from __future__ import annotations

from .. import client
from ..dtos import NCFRange, DocumentType


def list_document_types(no_cia: str, only_active: bool = True) -> list[DocumentType]:
    sql = (
        "SELECT no_cia, tipo_docu, descripcion, tipo_transaccion, "
        "NVL(activo,'S') AS activo, codigo_ncf "
        "FROM FAT.TFAT_TDOCU WHERE no_cia = :1 "
    )
    if only_active:
        sql += "AND NVL(activo,'S') = 'S' "
    sql += "ORDER BY tipo_docu"
    rows = client.fetch_dicts(sql, [no_cia])
    return [
        DocumentType(
            no_cia=r['no_cia'],
            tipo_docu=r['tipo_docu'],
            descripcion=r['descripcion'] or '',
            tipo_transaccion=r['tipo_transaccion'],
            activo=(r['activo'] == 'S'),
            codigo_ncf=r['codigo_ncf'],
        )
        for r in rows
    ]


def upsert_document_type(
    no_cia: str,
    tipo_docu: str,
    descripcion: str,
    tipo_transaccion: str,
    codigo_ncf: str | None = None,
    activo: bool = True,
) -> dict:
    """Inserta o actualiza un tipo de documento en FAT.TFAT_TDOCU."""
    td = tipo_docu.strip().upper()
    with client.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM FAT.TFAT_TDOCU WHERE no_cia=:1 AND tipo_docu=:2",
            [no_cia, td],
        )
        exists = cur.fetchone() is not None
        values = [
            descripcion.strip(),
            tipo_transaccion.strip(),
            'S' if activo else 'N',
            codigo_ncf.strip().upper() if codigo_ncf else None,
            no_cia,
            td,
        ]
        if exists:
            cur.execute(
                "UPDATE FAT.TFAT_TDOCU "
                "SET descripcion=:1, tipo_transaccion=:2, activo=:3, codigo_ncf=:4 "
                "WHERE no_cia=:5 AND tipo_docu=:6",
                values,
            )
            action = 'updated'
        else:
            cur.execute(
                "INSERT INTO FAT.TFAT_TDOCU "
                "(no_cia, tipo_docu, descripcion, tipo_transaccion, activo, codigo_ncf) "
                "VALUES (:1, :2, :3, :4, :5, :6)",
                [no_cia, td, descripcion.strip(), tipo_transaccion.strip(),
                 'S' if activo else 'N', codigo_ncf.strip().upper() if codigo_ncf else None],
            )
            action = 'created'
        cur.connection.commit()
    return {
        'no_cia': no_cia,
        'tipo_docu': td,
        'descripcion': descripcion.strip(),
        'tipo_transaccion': tipo_transaccion.strip(),
        'activo': activo,
        'codigo_ncf': codigo_ncf.strip().upper() if codigo_ncf else None,
        'action': action,
    }


def list_ncf_ranges(no_cia: str, punto: str) -> list[NCFRange]:
    """Rangos de NCF disponibles para una localidad. Lee de CNT.TCNT_NCF.

    CNT.TCNT_NCF usa NO_LOCALIDAD (concat NO_CIA+PUNTO) en lugar de columnas separadas.
    """
    rows = client.fetch_dicts(
        "SELECT no_localidad, codigo_ncf, tipo_ncf_fiscal, "
        "ncf_inicial, ncf_final, prox_ncf, "
        "NVL(ncf_manual,'N') AS ncf_manual, "
        "NVL(ncf_opcional,'N') AS ncf_opcional, "
        "NVL(cant_min_ncf, 0) AS cant_min_ncf "
        "FROM CNT.TCNT_NCF "
        "WHERE no_localidad = :1 "
        "ORDER BY codigo_ncf",
        [no_cia],
    )
    return [
        NCFRange(
            no_cia=no_cia,
            punto=punto,
            codigo_ncf=r['codigo_ncf'],
            tipo_ncf_fiscal=r['tipo_ncf_fiscal'] or '',
            ncf_inicial=int(r['ncf_inicial'] or 0),
            ncf_final=int(r['ncf_final'] or 0),
            prox_ncf=int(r['prox_ncf'] or 0),
            ncf_manual=(r['ncf_manual'] == 'S'),
            ncf_opcional=(r['ncf_opcional'] == 'S'),
            cant_min_ncf=int(r['cant_min_ncf'] or 0),
        )
        for r in rows
    ]


def upsert_ncf_range(
    no_cia: str,
    codigo_ncf: str,
    tipo_ncf_fiscal: str,
    ncf_inicial: int,
    ncf_final: int,
    prox_ncf: int | None = None,
    ncf_manual: bool = False,
    ncf_opcional: bool = False,
    cant_min_ncf: int = 0,
) -> dict:
    """Inserta o actualiza un rango NCF en CNT.TCNT_NCF."""
    prox = int(prox_ncf if prox_ncf is not None else ncf_inicial)
    with client.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM CNT.TCNT_NCF WHERE no_localidad=:1 AND codigo_ncf=:2",
            [no_cia, codigo_ncf.strip().upper()],
        )
        exists = cur.fetchone() is not None
        params = [
            tipo_ncf_fiscal.strip().upper(),
            int(ncf_inicial),
            int(ncf_final),
            prox,
            'S' if ncf_manual else 'N',
            'S' if ncf_opcional else 'N',
            int(cant_min_ncf),
            no_cia,
            codigo_ncf.strip().upper(),
        ]
        if exists:
            cur.execute(
                "UPDATE CNT.TCNT_NCF SET "
                "tipo_ncf_fiscal=:1, ncf_inicial=:2, ncf_final=:3, prox_ncf=:4, "
                "ncf_manual=:5, ncf_opcional=:6, cant_min_ncf=:7 "
                "WHERE no_localidad=:8 AND codigo_ncf=:9",
                params,
            )
            action = 'updated'
        else:
            cur.execute(
                "INSERT INTO CNT.TCNT_NCF "
                "(no_localidad, codigo_ncf, tipo_ncf_fiscal, ncf_inicial, ncf_final, prox_ncf, "
                "ncf_manual, ncf_opcional, cant_min_ncf) "
                "VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9)",
                [
                    no_cia,
                    codigo_ncf.strip().upper(),
                    tipo_ncf_fiscal.strip().upper(),
                    int(ncf_inicial),
                    int(ncf_final),
                    prox,
                    'S' if ncf_manual else 'N',
                    'S' if ncf_opcional else 'N',
                    int(cant_min_ncf),
                ],
            )
            action = 'created'
        cur.connection.commit()
    return {
        'no_cia': no_cia,
        'codigo_ncf': codigo_ncf.strip().upper(),
        'tipo_ncf_fiscal': tipo_ncf_fiscal.strip().upper(),
        'ncf_inicial': int(ncf_inicial),
        'ncf_final': int(ncf_final),
        'prox_ncf': prox,
        'ncf_manual': ncf_manual,
        'ncf_opcional': ncf_opcional,
        'cant_min_ncf': int(cant_min_ncf),
        'action': action,
    }


def count_facturas(no_cia: str, punto: str) -> int:
    row = client.fetch_one(
        "SELECT COUNT(*) FROM FAT.TFAT_FACTURA WHERE no_cia = :1 AND punto = :2",
        [no_cia, punto],
    )
    return int(row[0]) if row else 0


def list_all_ncf_ranges() -> list[NCFRange]:
    """Todos los rangos NCF de todas las empresas (para dashboards/alertas)."""
    rows = client.fetch_dicts(
        "SELECT no_localidad, codigo_ncf, tipo_ncf_fiscal, "
        "ncf_inicial, ncf_final, prox_ncf, "
        "NVL(ncf_manual,'N') AS ncf_manual, "
        "NVL(ncf_opcional,'N') AS ncf_opcional, "
        "NVL(cant_min_ncf, 0) AS cant_min_ncf "
        "FROM CNT.TCNT_NCF "
        "ORDER BY no_localidad, codigo_ncf"
    )
    return [
        NCFRange(
            no_cia=r['no_localidad'],
            punto='01',
            codigo_ncf=r['codigo_ncf'],
            tipo_ncf_fiscal=r['tipo_ncf_fiscal'] or '',
            ncf_inicial=int(r['ncf_inicial'] or 0),
            ncf_final=int(r['ncf_final'] or 0),
            prox_ncf=int(r['prox_ncf'] or 0),
            ncf_manual=(r['ncf_manual'] == 'S'),
            ncf_opcional=(r['ncf_opcional'] == 'S'),
            cant_min_ncf=int(r['cant_min_ncf'] or 0),
        )
        for r in rows
    ]


def search_invoices(no_cia: str, punto: str = '01', page: int = 1, page_size: int = 25,
                    search: str = '') -> dict:
    """Busca facturas con paginación. Retorna {items, total, page, page_size}."""
    limit = page_size
    offset = (page - 1) * page_size

    where_clauses = ["f.no_cia = :1", "f.punto = :2"]
    params = [no_cia, punto]

    if search:
        where_clauses.append("(f.ncf LIKE :3 OR UPPER(f.cliente) LIKE UPPER(:3))")
        params.append(f'%{search}%')

    where_sql = " AND ".join(where_clauses)

    total_row = client.fetch_one(
        f"SELECT COUNT(*) FROM FAT.TFAT_FACTURA f WHERE {where_sql}",
        params,
    )
    total = int(total_row[0]) if total_row else 0

    if total == 0:
        return {'items': [], 'total': 0, 'page': page, 'page_size': page_size, 'total_pages': 0}

    rows = client.fetch_dicts(
        f"SELECT f.no_cia, f.punto, f.ncf, f.fecha, f.cliente, f.monto, "
        f"NVL(f.estado, 'PENDIENTE') AS estado "
        f"FROM FAT.TFAT_FACTURA f "
        f"WHERE {where_sql} "
        f"ORDER BY f.fecha DESC, f.ncf DESC "
        f"OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY",
        params + [offset, limit],
    )

    items = [
        {
            'no_cia': r['no_cia'],
            'punto': r['punto'],
            'ncf': r['ncf'],
            'fecha': str(r['fecha']) if r['fecha'] else None,
            'cliente': r['cliente'] or '',
            'monto': float(r['monto']) if r['monto'] else 0.0,
            'estado': (r['estado'] or 'PENDIENTE').upper(),
        }
        for r in rows
    ]

    return {
        'items': items,
        'total': total,
        'page': page,
        'page_size': page_size,
        'total_pages': (total + page_size - 1) // page_size,
    }
