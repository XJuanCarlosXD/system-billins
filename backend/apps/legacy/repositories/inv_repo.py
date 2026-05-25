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


def list_almacenes(no_cia: str) -> list[dict]:
    return client.fetch_dicts(
        "SELECT no_cia, almacen, descri descripcion, activo "
        "FROM INV.TINV_ALMACEN "
        "WHERE no_cia = :1 ORDER BY almacen",
        [no_cia],
    )


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
