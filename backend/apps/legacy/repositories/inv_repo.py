"""Inventario (Inv) — repo de lectura.

Schema real INV (Oracle 11g):
- TINV_PRODUCTO:    no_produ, descri, grupo_produ, linea, sub_linea, activo, ...  (sin no_cia, sin descripcion)
- TINV_ALMACEN:     no_cia, almacen, descri, tipo_almacen, cual_costo, activo, categoria, ...
- TINV_EPRODUCTO:   no_cia, punto, almacen, no_produ, exist_actual, costo_actual, exist_minima, exist_maxima, empaque
- TINV_GRUPO_PRODU: no_grupo, descri  (sin no_cia)
- TINV_LINEA:       linea, descri  (sin no_cia)
- TINV_MOVIMIENTO:  no_cia, punto, tipo_docu, no_docu, no_linea, almacen, no_produ, tipo_movi,
                    tipo_transaccion, cantidad, precio, costo, monto_neto, fecha, empaque,
                    no_cliente, no_proveedor, no_orden
- TINV_TDOCU:       tipo_docu, descri, tipo_movi, tipo_transaccion

Oracle 11g: NO soporta OFFSET...FETCH NEXT; usar subconsulta con ROWNUM.
"""
from __future__ import annotations

from .. import client


def count_productos() -> int:
    row = client.fetch_one(
        "SELECT COUNT(*) FROM INV.TINV_PRODUCTO",
        [],
    )
    return int(row[0]) if row else 0


# ─── ALMACENES — CRUD ─────────────────────────────────────────────────────────
# Tabla INV.TINV_ALMACEN. PK = (NO_CIA, PUNTO, ALMACEN), todos VARCHAR2(2).
# NOT NULL: NO_CIA, PUNTO, ALMACEN, TIPO_ALMACEN(1), PRECIO_MENOR_COSTO(1, def 'N'),
#           CLASE_ALMACEN(1, def 'S'). Editables: DESCRI(40), ACTIVO(1), CUAL_COSTO(1),
#           TIPO_ALMACEN(1). 'descripcion' del frontend mapea a la columna real DESCRI.

def list_almacenes(no_cia: str, punto: str | None = None) -> list[dict]:
    params: list = [no_cia]
    where = "no_cia = :1"
    if punto:
        params.append(punto)
        where += f" AND punto = :{len(params)}"
    return client.fetch_dicts(
        "SELECT no_cia, punto, almacen, descri descripcion, "
        "tipo_almacen, cual_costo, activo "
        "FROM INV.TINV_ALMACEN "
        f"WHERE {where} ORDER BY punto, almacen",
        params,
    )


def get_almacen(no_cia: str, punto: str, almacen: str) -> dict | None:
    """Devuelve un almacén por su PK (no_cia, punto, almacen) o None."""
    rows = client.fetch_dicts(
        "SELECT no_cia, punto, almacen, descri descripcion, "
        "tipo_almacen, cual_costo, activo "
        "FROM INV.TINV_ALMACEN "
        "WHERE no_cia = :1 AND punto = :2 AND almacen = :3",
        [no_cia, punto, almacen],
    )
    return rows[0] if rows else None


def create_almacen(
    no_cia: str,
    punto: str,
    almacen: str,
    descripcion: str,
    tipo_almacen: str = 'F',
    cual_costo: str = 'P',
    activo: str = 'S',
    precio_menor_costo: str = 'N',
    clase_almacen: str = 'S',
) -> None:
    """INSERT en INV.TINV_ALMACEN. PK = (no_cia, punto, almacen)."""
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO INV.TINV_ALMACEN "
            "(no_cia, punto, almacen, descri, tipo_almacen, cual_costo, activo, "
            "precio_menor_costo, clase_almacen) "
            "VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9)",
            [no_cia, punto, almacen, descripcion, tipo_almacen, cual_costo,
             activo, precio_menor_costo, clase_almacen],
        )
        conn.commit()


def update_almacen(no_cia: str, punto: str, almacen: str, **kwargs) -> None:
    """UPDATE de columnas editables filtrando SIEMPRE por la PK (no_cia, punto, almacen)."""
    column_map = {
        'descripcion': 'descri',
        'descri': 'descri',
        'tipo_almacen': 'tipo_almacen',
        'cual_costo': 'cual_costo',
        'activo': 'activo',
    }
    sets: list[str] = []
    params: list = []
    for k, v in kwargs.items():
        col = column_map.get(k)
        if col:
            params.append(v)
            sets.append(f"{col.upper()}=:{len(params)}")
    if not sets:
        return
    params.append(no_cia)
    p_cia = len(params)
    params.append(punto)
    p_punto = len(params)
    params.append(almacen)
    p_alm = len(params)
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE INV.TINV_ALMACEN SET {','.join(sets)} "
            f"WHERE no_cia=:{p_cia} AND punto=:{p_punto} AND almacen=:{p_alm}",
            params,
        )
        conn.commit()


def delete_almacen(no_cia: str, punto: str, almacen: str) -> None:
    """DELETE filtrando SIEMPRE por la PK exacta (no_cia, punto, almacen)."""
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM INV.TINV_ALMACEN "
            "WHERE no_cia=:1 AND punto=:2 AND almacen=:3",
            [no_cia, punto, almacen],
        )
        conn.commit()


def list_productos(
    search: str = '',
    grupo: str = '',
    linea: str = '',
    activo: str = '',
    no_cia: str = '01',
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    """Lista productos con paginación compatible Oracle 11g (ROWNUM)."""
    params: list = []
    where_parts = ["1=1"]

    if search:
        where_parts.append(
            "(UPPER(p.descri) LIKE UPPER(:1) OR UPPER(p.no_produ) LIKE UPPER(:2))"
        )
        params.append(f'%{search}%')
        params.append(f'%{search}%')
    if grupo:
        params.append(grupo)
        where_parts.append(f"p.grupo_produ = :{len(params)}")
    if linea:
        params.append(linea)
        where_parts.append(f"p.linea = :{len(params)}")
    if activo:
        params.append(activo)
        where_parts.append(f"p.activo = :{len(params)}")

    where_clause = " AND ".join(where_parts)

    # Oracle 11g pagination via ROWNUM double-wrap
    rn_max = offset + limit
    rn_min = offset
    params.append(rn_max)
    params.append(rn_min)
    rn_max_pos = len(params) - 1
    rn_min_pos = len(params)

    sql = (
        f"SELECT no_produ, descri descripcion, linea, sub_linea, grupo_produ, activo "
        f"FROM ("
        f"  SELECT p.no_produ, p.descri, p.linea, p.sub_linea, p.grupo_produ, p.activo, ROWNUM rn "
        f"  FROM INV.TINV_PRODUCTO p "
        f"  WHERE {where_clause} "
        f"  AND ROWNUM <= :{rn_max_pos} "
        f"  ORDER BY p.descri"
        f") WHERE rn > :{rn_min_pos}"
    )
    return client.fetch_dicts(sql, params)


def get_producto(no_produ: str, no_cia: str = '01') -> dict | None:
    rows = client.fetch_dicts(
        "SELECT p.no_produ, p.descri descripcion, p.linea, l.descri linea_desc, "
        "p.sub_linea, p.grupo_produ, g.descri grupo_desc, "
        "p.activo, p.tiene_impuesto, p.porciento_impuesto, "
        "p.costo_mercado, p.costo_mercado_rd, p.grupo_contable, p.servicio "
        "FROM INV.TINV_PRODUCTO p "
        "LEFT JOIN INV.TINV_LINEA l ON l.linea = p.linea "
        "LEFT JOIN INV.TINV_GRUPO_PRODU g ON g.no_grupo = p.grupo_produ "
        "WHERE p.no_produ = :1",
        [no_produ],
    )
    return rows[0] if rows else None


def list_existencias(
    no_cia: str = '01',
    punto: str = '',
    almacen: str = '',
    no_produ: str = '',
    search: str = '',
) -> list[dict]:
    """Existencias usando TINV_EPRODUCTO (tiene costo_actual y exist_actual por cia/punto/almacen)."""
    params: list = [no_cia]
    where = ["e.no_cia = :1"]

    if punto:
        params.append(punto)
        where.append(f"e.punto = :{len(params)}")
    if almacen:
        params.append(almacen)
        where.append(f"e.almacen = :{len(params)}")
    if no_produ:
        params.append(no_produ)
        where.append(f"e.no_produ = :{len(params)}")
    if search:
        params.append(f'%{search}%')
        where.append(f"UPPER(p.descri) LIKE UPPER(:{len(params)})")

    sql = (
        "SELECT e.no_produ, p.descri descripcion, e.almacen, a.descri almacen_desc, "
        "NVL(e.exist_actual, 0) existencia, NVL(e.costo_actual, 0) costo_prom, "
        "ROUND(NVL(e.exist_actual, 0) * NVL(e.costo_actual, 0), 2) valor, "
        "NVL(e.exist_minima, 0) exist_minima, NVL(e.exist_maxima, 0) exist_maxima "
        "FROM INV.TINV_EPRODUCTO e "
        "JOIN INV.TINV_PRODUCTO p ON p.no_produ = e.no_produ "
        "LEFT JOIN INV.TINV_ALMACEN a ON a.no_cia = e.no_cia AND a.almacen = e.almacen "
        f"WHERE {' AND '.join(where)} "
        "ORDER BY e.almacen, p.descri"
    )
    return client.fetch_dicts(sql, params)


def list_movimientos(
    no_cia: str = '01',
    punto: str = '',
    almacen: str = '',
    no_produ: str = '',
    desde: str = '',
    hasta: str = '',
    tipo: str = '',
) -> list[dict]:
    params: list = [no_cia]
    where = ["m.no_cia = :1"]

    if punto:
        params.append(punto)
        where.append(f"m.punto = :{len(params)}")
    if almacen:
        params.append(almacen)
        where.append(f"m.almacen = :{len(params)}")
    if no_produ:
        params.append(no_produ)
        where.append(f"m.no_produ = :{len(params)}")
    if tipo:
        params.append(tipo)
        where.append(f"m.tipo_docu = :{len(params)}")
    if desde:
        params.append(desde)
        where.append(f"m.fecha >= TO_DATE(:{len(params)}, 'YYYY-MM-DD')")
    if hasta:
        params.append(hasta)
        where.append(f"m.fecha <= TO_DATE(:{len(params)}, 'YYYY-MM-DD')")

    # Oracle 11g: ROWNUM must be applied before ORDER BY in a subquery
    sql = (
        "SELECT tipo_docu, no_docu, no_linea, no_produ, descripcion, "
        "almacen, fecha, cantidad, costo, tipo_movi, monto_neto "
        "FROM ("
        "  SELECT m.tipo_docu, m.no_docu, m.no_linea, m.no_produ, p.descri descripcion, "
        "  m.almacen, m.fecha, NVL(m.cantidad, 0) cantidad, NVL(m.costo, 0) costo, "
        "  m.tipo_movi, NVL(m.monto_neto, 0) monto_neto "
        "  FROM INV.TINV_MOVIMIENTO m "
        "  LEFT JOIN INV.TINV_PRODUCTO p ON p.no_produ = m.no_produ "
        f"  WHERE {' AND '.join(where)} "
        "  ORDER BY m.fecha DESC, m.no_docu DESC"
        ") WHERE ROWNUM <= 500"
    )
    return client.fetch_dicts(sql, params)


def list_transacciones(no_cia: str, limit: int = 50) -> list[dict]:
    return client.fetch_dicts(
        "SELECT tipo_docu, no_transaccion, fecha, almacen, usuario, estado "
        "FROM INV.TINV_TRANSACCIONES WHERE no_cia = :1 "
        "AND ROWNUM <= :2 "
        "ORDER BY fecha DESC, no_transaccion DESC",
        [no_cia, limit],
    )


def list_tipos_docu_inv() -> list[dict]:
    return client.fetch_dicts(
        "SELECT tipo_docu, descri descripcion, tipo_movi, tipo_transaccion "
        "FROM INV.TINV_TDOCU ORDER BY tipo_docu",
        [],
    )


def list_grupos(no_cia: str = '01') -> list[dict]:
    """Grupos de productos (TINV_GRUPO_PRODU no tiene no_cia)."""
    return client.fetch_dicts(
        "SELECT no_grupo grupo_produ, descri descripcion "
        "FROM INV.TINV_GRUPO_PRODU "
        "ORDER BY descri",
        [],
    )


def list_lineas(no_cia: str = '01') -> list[dict]:
    """Líneas de productos (TINV_LINEA no tiene no_cia)."""
    return client.fetch_dicts(
        "SELECT linea, descri descripcion "
        "FROM INV.TINV_LINEA "
        "ORDER BY linea",
        [],
    )


# ─── NEW ENDPOINTS ────────────────────────────────────────────────────────────

def list_companias() -> list[dict]:
    """Compañías/empresas del módulo INV."""
    return client.fetch_dicts(
        "SELECT no_cia, descripcion, activa activo "
        "FROM INV.TINV_CIAS ORDER BY no_cia",
        [],
    )


def list_puntos(no_cia: str) -> list[dict]:
    """Puntos de venta/sucursales para una compañía."""
    return client.fetch_dicts(
        "SELECT no_cia, punto, descripcion, mes_proceso, ano_proceso, activo "
        "FROM INV.TINV_PUNTO WHERE no_cia = :1 ORDER BY punto",
        [no_cia],
    )


def list_unidades() -> list[dict]:
    """Unidades de medida (TINV_UNIDAD)."""
    return client.fetch_dicts(
        "SELECT unidad cod_unidad, descri descripcion "
        "FROM INV.TINV_UNIDAD ORDER BY unidad",
        [],
    )


def list_sublineas(no_cia: str = '01', linea: str = '') -> list[dict]:
    """Sub-líneas de productos."""
    params: list = []
    where_parts = ["1=1"]
    if linea:
        params.append(linea)
        where_parts.append(f"linea = :{len(params)}")
    sql = (
        f"SELECT linea, sub_linea, descri descripcion, "
        f"NVL(comision, 0) pct_comision, NVL(margen, 0) pct_margen "
        f"FROM INV.TINV_SUB_LINEA "
        f"WHERE {' AND '.join(where_parts)} "
        f"ORDER BY linea, sub_linea"
    )
    return client.fetch_dicts(sql, params)


def get_existencia_producto(no_cia: str, no_produ: str) -> list[dict]:
    """Existencia por almacén para un producto específico."""
    return client.fetch_dicts(
        "SELECT e.no_cia, e.punto, e.almacen, a.descri almacen_desc, "
        "e.no_produ, p.descri descripcion, "
        "NVL(e.exist_actual, 0) existencia, "
        "NVL(e.costo_actual, 0) costo_actual, "
        "ROUND(NVL(e.exist_actual, 0) * NVL(e.costo_actual, 0), 2) valor, "
        "NVL(e.exist_minima, 0) exist_minima, NVL(e.exist_maxima, 0) exist_maxima "
        "FROM INV.TINV_EPRODUCTO e "
        "JOIN INV.TINV_PRODUCTO p ON p.no_produ = e.no_produ "
        "LEFT JOIN INV.TINV_ALMACEN a ON a.no_cia = e.no_cia AND a.almacen = e.almacen "
        "WHERE e.no_cia = :1 AND e.no_produ = :2 "
        "ORDER BY e.almacen",
        [no_cia, no_produ],
    )


def list_consulta_documentos(
    no_cia: str = '01',
    punto: str = '',
    tipo_docu: str = '',
    desde: str = '',
    hasta: str = '',
    almacen: str = '',
    limit: int = 100,
) -> list[dict]:
    """Consulta de documentos de inventario (cabecera) desde TINV_MOVIMIENTO."""
    params: list = [no_cia]
    where = ["m.no_cia = :1"]

    if punto:
        params.append(punto)
        where.append(f"m.punto = :{len(params)}")
    if tipo_docu:
        params.append(tipo_docu)
        where.append(f"m.tipo_docu = :{len(params)}")
    if almacen:
        params.append(almacen)
        where.append(f"m.almacen = :{len(params)}")
    if desde:
        params.append(desde)
        where.append(f"m.fecha >= TO_DATE(:{len(params)}, 'YYYY-MM-DD')")
    if hasta:
        params.append(hasta)
        where.append(f"m.fecha <= TO_DATE(:{len(params)}, 'YYYY-MM-DD')")

    params.append(limit)
    # Oracle 11g ROWNUM pagination pattern (triple-wrap with ORDER BY in innermost)
    sql = (
        f"SELECT tipo_docu, no_docu, punto, almacen, fecha, tipo_movi, tipo_transaccion, lineas, total "
        f"FROM ("
        f"  SELECT t2.*, ROWNUM rn "
        f"  FROM ("
        f"    SELECT m.tipo_docu, m.no_docu, m.punto, m.almacen, "
        f"    TO_CHAR(MIN(m.fecha), 'YYYY-MM-DD') fecha, "
        f"    MIN(m.tipo_movi) tipo_movi, MIN(m.tipo_transaccion) tipo_transaccion, "
        f"    COUNT(*) lineas, SUM(NVL(m.monto_neto, 0)) total "
        f"    FROM INV.TINV_MOVIMIENTO m "
        f"    WHERE {' AND '.join(where)} "
        f"    GROUP BY m.tipo_docu, m.no_docu, m.punto, m.almacen "
        f"    ORDER BY MIN(m.fecha) DESC, m.tipo_docu, m.no_docu"
        f"  ) t2 WHERE ROWNUM <= :{len(params)}"
        f")"
    )
    return client.fetch_dicts(sql, params)


def get_documento_detalle(no_cia: str, tipo_docu: str, no_docu: str) -> dict | None:
    """Header y líneas de un documento de inventario."""
    # Lines from TINV_MOVIMIENTO
    lines = client.fetch_dicts(
        "SELECT m.no_linea, m.almacen, m.no_produ, p.descri descripcion, "
        "m.tipo_movi, m.tipo_transaccion, "
        "NVL(m.cantidad, 0) cantidad, NVL(m.costo, 0) costo, "
        "NVL(m.precio, 0) precio, NVL(m.monto_neto, 0) monto_neto, "
        "TO_CHAR(m.fecha, 'YYYY-MM-DD') fecha, m.punto "
        "FROM INV.TINV_MOVIMIENTO m "
        "LEFT JOIN INV.TINV_PRODUCTO p ON p.no_produ = m.no_produ "
        "WHERE m.no_cia = :1 AND m.tipo_docu = :2 AND m.no_docu = :3 "
        "ORDER BY m.no_linea",
        [no_cia, tipo_docu, no_docu],
    )
    if not lines:
        return None
    first = lines[0]
    header = {
        'no_cia': no_cia,
        'tipo_docu': tipo_docu,
        'no_docu': no_docu,
        'fecha': first.get('FECHA', first.get('fecha', '')),
        'almacen': first.get('ALMACEN', first.get('almacen', '')),
        'punto': first.get('PUNTO', first.get('punto', '')),
        'tipo_movi': first.get('TIPO_MOVI', first.get('tipo_movi', '')),
        'tipo_transaccion': first.get('TIPO_TRANSACCION', first.get('tipo_transaccion', '')),
        'total': sum(
            float(r.get('MONTO_NETO', r.get('monto_neto', 0)) or 0)
            for r in lines
        ),
    }
    return {'header': header, 'lines': lines}


def list_kardex(
    no_cia: str,
    no_produ: str,
    almacen: str = '',
    desde: str = '',
    hasta: str = '',
) -> list[dict]:
    """Kardex: todos los movimientos de un producto con saldo acumulado."""
    params: list = [no_cia, no_produ]
    where = ["m.no_cia = :1", "m.no_produ = :2"]

    if almacen:
        params.append(almacen)
        where.append(f"m.almacen = :{len(params)}")
    if desde:
        params.append(desde)
        where.append(f"m.fecha >= TO_DATE(:{len(params)}, 'YYYY-MM-DD')")
    if hasta:
        params.append(hasta)
        where.append(f"m.fecha <= TO_DATE(:{len(params)}, 'YYYY-MM-DD')")

    sql = (
        "SELECT tipo_docu, no_docu, no_linea, almacen, fecha, "
        "tipo_movi, tipo_transaccion, cantidad, costo, monto_neto "
        "FROM ("
        "  SELECT m.tipo_docu, m.no_docu, m.no_linea, m.almacen, "
        "  TO_CHAR(m.fecha, 'YYYY-MM-DD') fecha, "
        "  m.tipo_movi, m.tipo_transaccion, "
        "  NVL(m.cantidad, 0) cantidad, NVL(m.costo, 0) costo, "
        "  NVL(m.monto_neto, 0) monto_neto "
        "  FROM INV.TINV_MOVIMIENTO m "
        f"  WHERE {' AND '.join(where)} "
        "  ORDER BY m.fecha, m.no_docu, m.no_linea"
        ") WHERE ROWNUM <= 500"
    )
    rows = client.fetch_dicts(sql, params)

    # Compute running balance (entradas positive, salidas negative)
    balance = 0.0
    for r in rows:
        tipo_movi = str(r.get('TIPO_MOVI', r.get('tipo_movi', 'E')) or 'E').upper()
        qty = float(r.get('CANTIDAD', r.get('cantidad', 0)) or 0)
        if tipo_movi == 'E':
            balance += qty
        else:
            balance -= qty
        r['saldo'] = round(balance, 4)
    return rows


def get_valoracion_inventario(no_cia: str, almacen: str = '') -> list[dict]:
    """Valoración de inventario: producto + existencia + costo."""
    params: list = [no_cia]
    where = ["e.no_cia = :1"]

    if almacen:
        params.append(almacen)
        where.append(f"e.almacen = :{len(params)}")

    sql = (
        "SELECT e.almacen, a.descri almacen_desc, "
        "e.no_produ, p.descri descripcion, "
        "p.grupo_produ, p.linea, "
        "NVL(e.exist_actual, 0) existencia, "
        "NVL(e.costo_actual, 0) costo_actual, "
        "ROUND(NVL(e.exist_actual, 0) * NVL(e.costo_actual, 0), 2) valor "
        "FROM INV.TINV_EPRODUCTO e "
        "JOIN INV.TINV_PRODUCTO p ON p.no_produ = e.no_produ "
        "LEFT JOIN INV.TINV_ALMACEN a ON a.no_cia = e.no_cia AND a.almacen = e.almacen "
        f"WHERE {' AND '.join(where)} "
        "AND NVL(e.exist_actual, 0) <> 0 "
        "ORDER BY e.almacen, p.descri"
    )
    return client.fetch_dicts(sql, params)


# ═══ CATÁLOGOS MASTER-DATA — CRUD ═════════════════════════════════════════════
# Mismo patrón que ALMACENES: get/create/update/delete por la PK EXACTA y completa.

# ─── GRUPO DE PRODUCTOS — TINV_GRUPO_PRODU ────────────────────────────────────
# PK = (NO_GRUPO) VARCHAR2(4). DESCRI VARCHAR2(30) nullable.

def get_grupo(no_grupo: str) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT no_grupo grupo_produ, descri descripcion "
        "FROM INV.TINV_GRUPO_PRODU WHERE no_grupo = :1",
        [no_grupo],
    )
    return rows[0] if rows else None


def create_grupo(no_grupo: str, descripcion: str = '') -> None:
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO INV.TINV_GRUPO_PRODU (no_grupo, descri) VALUES (:1, :2)",
            [no_grupo, descripcion],
        )
        conn.commit()


def update_grupo(no_grupo: str, descripcion: str) -> None:
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE INV.TINV_GRUPO_PRODU SET descri = :1 WHERE no_grupo = :2",
            [descripcion, no_grupo],
        )
        conn.commit()


def delete_grupo(no_grupo: str) -> None:
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM INV.TINV_GRUPO_PRODU WHERE no_grupo = :1",
            [no_grupo],
        )
        conn.commit()


# ─── LÍNEA DE PRODUCTOS — TINV_LINEA ──────────────────────────────────────────
# PK = (LINEA) VARCHAR2(4). DESCRI VARCHAR2(30) nullable.

def get_linea(linea: str) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT linea, descri descripcion FROM INV.TINV_LINEA WHERE linea = :1",
        [linea],
    )
    return rows[0] if rows else None


def create_linea(linea: str, descripcion: str = '') -> None:
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO INV.TINV_LINEA (linea, descri) VALUES (:1, :2)",
            [linea, descripcion],
        )
        conn.commit()


def update_linea(linea: str, descripcion: str) -> None:
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE INV.TINV_LINEA SET descri = :1 WHERE linea = :2",
            [descripcion, linea],
        )
        conn.commit()


def delete_linea(linea: str) -> None:
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM INV.TINV_LINEA WHERE linea = :1",
            [linea],
        )
        conn.commit()


# ─── SUB LÍNEA DE PRODUCTOS — TINV_SUB_LINEA ──────────────────────────────────
# PK = (LINEA, SUB_LINEA) VARCHAR2(4). DESCRI(30), COMISION, MARGEN nullable.

def get_sublinea(linea: str, sub_linea: str) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT linea, sub_linea, descri descripcion, "
        "NVL(comision, 0) pct_comision, NVL(margen, 0) pct_margen "
        "FROM INV.TINV_SUB_LINEA WHERE linea = :1 AND sub_linea = :2",
        [linea, sub_linea],
    )
    return rows[0] if rows else None


def create_sublinea(linea: str, sub_linea: str, descripcion: str = '',
                    pct_comision=None, pct_margen=None) -> None:
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO INV.TINV_SUB_LINEA (linea, sub_linea, descri, comision, margen) "
            "VALUES (:1, :2, :3, :4, :5)",
            [linea, sub_linea, descripcion, pct_comision, pct_margen],
        )
        conn.commit()


def update_sublinea(linea: str, sub_linea: str, **kwargs) -> None:
    column_map = {
        'descripcion': 'descri', 'descri': 'descri',
        'pct_comision': 'comision', 'comision': 'comision',
        'pct_margen': 'margen', 'margen': 'margen',
    }
    sets: list[str] = []
    params: list = []
    for k, v in kwargs.items():
        col = column_map.get(k)
        if col:
            params.append(v)
            sets.append(f"{col.upper()}=:{len(params)}")
    if not sets:
        return
    params.append(linea)
    p_l = len(params)
    params.append(sub_linea)
    p_sl = len(params)
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE INV.TINV_SUB_LINEA SET {','.join(sets)} "
            f"WHERE linea=:{p_l} AND sub_linea=:{p_sl}",
            params,
        )
        conn.commit()


def delete_sublinea(linea: str, sub_linea: str) -> None:
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM INV.TINV_SUB_LINEA WHERE linea = :1 AND sub_linea = :2",
            [linea, sub_linea],
        )
        conn.commit()


# ─── UNIDADES DE EMPAQUE — TINV_UNIDAD ────────────────────────────────────────
# PK = (UNIDAD) VARCHAR2(2). DESCRI VARCHAR2(10) nullable.

def get_unidad(unidad: str) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT unidad cod_unidad, descri descripcion FROM INV.TINV_UNIDAD WHERE unidad = :1",
        [unidad],
    )
    return rows[0] if rows else None


def create_unidad(unidad: str, descripcion: str = '') -> None:
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO INV.TINV_UNIDAD (unidad, descri) VALUES (:1, :2)",
            [unidad, descripcion],
        )
        conn.commit()


def update_unidad(unidad: str, descripcion: str) -> None:
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE INV.TINV_UNIDAD SET descri = :1 WHERE unidad = :2",
            [descripcion, unidad],
        )
        conn.commit()


def delete_unidad(unidad: str) -> None:
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM INV.TINV_UNIDAD WHERE unidad = :1",
            [unidad],
        )
        conn.commit()


# ─── REFERENCIA DE EMPAQUE — TINV_REFERENCIA ──────────────────────────────────
# PK = (REFERENCIA) VARCHAR2(2). DESCRI VARCHAR2(10) nullable.

def list_referencias() -> list[dict]:
    return client.fetch_dicts(
        "SELECT referencia cod_referencia, descri descripcion "
        "FROM INV.TINV_REFERENCIA ORDER BY referencia",
        [],
    )


def get_referencia(referencia: str) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT referencia cod_referencia, descri descripcion "
        "FROM INV.TINV_REFERENCIA WHERE referencia = :1",
        [referencia],
    )
    return rows[0] if rows else None


def create_referencia(referencia: str, descripcion: str = '') -> None:
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO INV.TINV_REFERENCIA (referencia, descri) VALUES (:1, :2)",
            [referencia, descripcion],
        )
        conn.commit()


def update_referencia(referencia: str, descripcion: str) -> None:
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE INV.TINV_REFERENCIA SET descri = :1 WHERE referencia = :2",
            [descripcion, referencia],
        )
        conn.commit()


def delete_referencia(referencia: str) -> None:
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM INV.TINV_REFERENCIA WHERE referencia = :1",
            [referencia],
        )
        conn.commit()


# ─── GRUPO CONTABLE — TINV_GRUPO_CONTABLE ─────────────────────────────────────
# PK = (GRUPO_CONTABLE) VARCHAR2(2). DESCRI(30) y cuentas contables nullable.

def list_grupos_contables() -> list[dict]:
    return client.fetch_dicts(
        "SELECT grupo_contable, descri descripcion, inventario, ajuste_inv ajuste_inventario, "
        "costo_venta_contado, costo_venta_credito, ingreso_venta_contado, ingreso_venta_credito "
        "FROM INV.TINV_GRUPO_CONTABLE ORDER BY grupo_contable",
        [],
    )


def get_grupo_contable(grupo_contable: str) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT grupo_contable, descri descripcion, inventario, ajuste_inv ajuste_inventario, "
        "costo_venta_contado, costo_venta_credito, ingreso_venta_contado, ingreso_venta_credito "
        "FROM INV.TINV_GRUPO_CONTABLE WHERE grupo_contable = :1",
        [grupo_contable],
    )
    return rows[0] if rows else None


def create_grupo_contable(grupo_contable: str, descripcion: str = '', inventario=None,
                          ajuste_inventario=None, costo_venta_contado=None,
                          costo_venta_credito=None, ingreso_venta_contado=None,
                          ingreso_venta_credito=None) -> None:
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO INV.TINV_GRUPO_CONTABLE "
            "(grupo_contable, descri, inventario, ajuste_inv, costo_venta_contado, "
            "costo_venta_credito, ingreso_venta_contado, ingreso_venta_credito) "
            "VALUES (:1, :2, :3, :4, :5, :6, :7, :8)",
            [grupo_contable, descripcion, inventario, ajuste_inventario,
             costo_venta_contado, costo_venta_credito, ingreso_venta_contado,
             ingreso_venta_credito],
        )
        conn.commit()


def update_grupo_contable(grupo_contable: str, **kwargs) -> None:
    column_map = {
        'descripcion': 'descri', 'descri': 'descri',
        'inventario': 'inventario',
        'ajuste_inventario': 'ajuste_inv', 'ajuste_inv': 'ajuste_inv',
        'costo_venta_contado': 'costo_venta_contado',
        'costo_venta_credito': 'costo_venta_credito',
        'ingreso_venta_contado': 'ingreso_venta_contado',
        'ingreso_venta_credito': 'ingreso_venta_credito',
    }
    sets: list[str] = []
    params: list = []
    for k, v in kwargs.items():
        col = column_map.get(k)
        if col:
            params.append(v)
            sets.append(f"{col.upper()}=:{len(params)}")
    if not sets:
        return
    params.append(grupo_contable)
    p_pk = len(params)
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE INV.TINV_GRUPO_CONTABLE SET {','.join(sets)} "
            f"WHERE grupo_contable=:{p_pk}",
            params,
        )
        conn.commit()


def delete_grupo_contable(grupo_contable: str) -> None:
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM INV.TINV_GRUPO_CONTABLE WHERE grupo_contable = :1",
            [grupo_contable],
        )
        conn.commit()


# ─── TIPOS DE DOCUMENTOS — TINV_TDOCU ─────────────────────────────────────────
# PK = (TIPO_DOCU) VARCHAR2(2). NOT NULL: DESCRI(30), TIPO_MOVI(1), TIPO_TRANSACCION(1),
# NC_OBLIGATORIA(1, def 'N'). CUENTA/CENTRO_COSTO/CODIGO_NCF nullable.

def get_tdocu(tipo_docu: str) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT tipo_docu, descri descripcion, tipo_movi, tipo_transaccion, "
        "nc_obligatoria FROM INV.TINV_TDOCU WHERE tipo_docu = :1",
        [tipo_docu],
    )
    return rows[0] if rows else None


def create_tdocu(tipo_docu: str, descripcion: str, tipo_movi: str = 'E',
                 tipo_transaccion: str = 'E', nc_obligatoria: str = 'N') -> None:
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO INV.TINV_TDOCU "
            "(tipo_docu, descri, tipo_movi, tipo_transaccion, nc_obligatoria) "
            "VALUES (:1, :2, :3, :4, :5)",
            [tipo_docu, descripcion, tipo_movi, tipo_transaccion, nc_obligatoria],
        )
        conn.commit()


def update_tdocu(tipo_docu: str, **kwargs) -> None:
    column_map = {
        'descripcion': 'descri', 'descri': 'descri',
        'tipo_movi': 'tipo_movi',
        'tipo_transaccion': 'tipo_transaccion',
        'nc_obligatoria': 'nc_obligatoria',
    }
    sets: list[str] = []
    params: list = []
    for k, v in kwargs.items():
        col = column_map.get(k)
        if col:
            params.append(v)
            sets.append(f"{col.upper()}=:{len(params)}")
    if not sets:
        return
    params.append(tipo_docu)
    p_pk = len(params)
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE INV.TINV_TDOCU SET {','.join(sets)} WHERE tipo_docu=:{p_pk}",
            params,
        )
        conn.commit()


def delete_tdocu(tipo_docu: str) -> None:
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM INV.TINV_TDOCU WHERE tipo_docu = :1",
            [tipo_docu],
        )
        conn.commit()


# ─── COMPAÑÍAS — TINV_CIAS ────────────────────────────────────────────────────
# PK = (NO_CIA) VARCHAR2(2). NOT NULL: DESCRIPCION(40), ACTIVA(1), REGISTRO_CONT(1).
# 'activo' del frontend mapea a la columna real ACTIVA.

def get_compania(no_cia: str) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT no_cia, descripcion, activa activo, registro_cont "
        "FROM INV.TINV_CIAS WHERE no_cia = :1",
        [no_cia],
    )
    return rows[0] if rows else None


def create_compania(no_cia: str, descripcion: str, activo: str = 'S',
                    registro_cont: str = 'S') -> None:
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO INV.TINV_CIAS (no_cia, descripcion, activa, registro_cont) "
            "VALUES (:1, :2, :3, :4)",
            [no_cia, descripcion, activo, registro_cont],
        )
        conn.commit()


def update_compania(no_cia: str, **kwargs) -> None:
    column_map = {
        'descripcion': 'descripcion',
        'activo': 'activa', 'activa': 'activa',
        'registro_cont': 'registro_cont',
    }
    sets: list[str] = []
    params: list = []
    for k, v in kwargs.items():
        col = column_map.get(k)
        if col:
            params.append(v)
            sets.append(f"{col.upper()}=:{len(params)}")
    if not sets:
        return
    params.append(no_cia)
    p_pk = len(params)
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE INV.TINV_CIAS SET {','.join(sets)} WHERE no_cia=:{p_pk}",
            params,
        )
        conn.commit()


def delete_compania(no_cia: str) -> None:
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM INV.TINV_CIAS WHERE no_cia = :1",
            [no_cia],
        )
        conn.commit()


# ─── PUNTOS DE TRABAJO — TINV_PUNTO ───────────────────────────────────────────
# PK = (NO_CIA, PUNTO) VARCHAR2(2). NOT NULL: DESCRIPCION(40), ANO_PROCESO, MES_PROCESO,
# MES_CIERRE (NUMBER, sin default), REGISTRAR_INV(def 'S'), USAR_ODC(def 'S'),
# IMPUESTO_EN_COSTO(def 'N'), CONTEO_CON_TALONARIO(def 'N'). ACTIVO(1) nullable.

def get_punto(no_cia: str, punto: str) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT no_cia, punto, descripcion, mes_proceso, ano_proceso, mes_cierre, activo "
        "FROM INV.TINV_PUNTO WHERE no_cia = :1 AND punto = :2",
        [no_cia, punto],
    )
    return rows[0] if rows else None


def create_punto(no_cia: str, punto: str, descripcion: str,
                 ano_proceso: int, mes_proceso: int, mes_cierre: int = 12,
                 activo: str = 'S') -> None:
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO INV.TINV_PUNTO "
            "(no_cia, punto, descripcion, ano_proceso, mes_proceso, mes_cierre, "
            "registrar_inv, usar_odc, impuesto_en_costo, conteo_con_talonario, activo) "
            "VALUES (:1, :2, :3, :4, :5, :6, 'S', 'S', 'N', 'N', :7)",
            [no_cia, punto, descripcion, ano_proceso, mes_proceso, mes_cierre, activo],
        )
        conn.commit()


def update_punto(no_cia: str, punto: str, **kwargs) -> None:
    column_map = {
        'descripcion': 'descripcion',
        'ano_proceso': 'ano_proceso',
        'mes_proceso': 'mes_proceso',
        'mes_cierre': 'mes_cierre',
        'activo': 'activo',
    }
    sets: list[str] = []
    params: list = []
    for k, v in kwargs.items():
        col = column_map.get(k)
        if col:
            params.append(v)
            sets.append(f"{col.upper()}=:{len(params)}")
    if not sets:
        return
    params.append(no_cia)
    p_cia = len(params)
    params.append(punto)
    p_punto = len(params)
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE INV.TINV_PUNTO SET {','.join(sets)} "
            f"WHERE no_cia=:{p_cia} AND punto=:{p_punto}",
            params,
        )
        conn.commit()


def delete_punto(no_cia: str, punto: str) -> None:
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM INV.TINV_PUNTO WHERE no_cia = :1 AND punto = :2",
            [no_cia, punto],
        )
        conn.commit()

def list_entrada_diario(no_cia: str, punto: str, ano: str, mes: str,
                        fecha: str = '', tipo: str = 'detallado') -> list[dict]:
    """Retorna los registros de la entrada de diario del cierre INV.
    tipo=detallado -> linea por registro; tipo=resumido -> agrupado por cuenta.
    Usa TINV_ED que acumula las entradas generadas al mayor CNT.
    Si TINV_ED vacia (pre-cierre) cae a TINV_MOVIMIENTO como respaldo."""
    rows = client.fetch_dicts(
        """SELECT e.no_cia, e.punto, e.tipo_docu, e.no_docu,
                  e.cuenta, e.tipo_movi, e.fecha, e.centro_costo,
                  e.monto, e.tasa_us, e.usuario
           FROM INV.TINV_ED e
           WHERE e.no_cia=:1 AND e.punto=:2
             AND EXTRACT(YEAR FROM e.fecha)=:3
             AND EXTRACT(MONTH FROM e.fecha)=:4
           ORDER BY e.fecha, e.tipo_docu, e.no_docu, e.cuenta""",
        [no_cia, punto, int(ano), int(mes)]
    )
    if not rows:
        # Fallback: movimientos del mes como fuente
        rows = client.fetch_dicts(
            """SELECT m.no_cia, m.punto, m.tipo_docu, m.no_docu,
                      m.almacen, m.no_produ, m.tipo_movi, m.fecha,
                      m.cantidad, m.costo, m.monto_neto AS monto
               FROM INV.TINV_MOVIMIENTO m
               WHERE m.no_cia=:1 AND m.punto=:2
                 AND EXTRACT(YEAR FROM m.fecha)=:3
                 AND EXTRACT(MONTH FROM m.fecha)=:4
               ORDER BY m.fecha, m.tipo_docu, m.no_docu""",
            [no_cia, punto, int(ano), int(mes)]
        )
    if tipo == 'resumido':
        summary: dict = {}
        for r in rows:
            key = r.get('cuenta') or r.get('tipo_docu') or ''
            if key not in summary:
                summary[key] = {**r, 'monto': 0.0}
            summary[key]['monto'] = round(float(summary[key].get('monto') or 0)
                                          + float(r.get('monto') or 0), 2)
        rows = list(summary.values())
    return rows
