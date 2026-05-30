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
    grupo: str = '',
    solo_con_existencia: bool = False,
) -> list[dict]:
    """Existencias por (cia, punto, almacén, producto) replicando la lógica legada.

    REGLA (verificada 2026-05-28 contra producto 00000002 en alm 01,02,03,06,53):

    * Almacén con ``CTRL_EXIST_MIN='S'`` o ``CTRL_EXIST_MAX='S'`` → es un
      almacén "controlado" (entra en el cierre mensual con conteo físico).
      Fuente: ``TINV_EPRODUCTO.EXIST_ACTUAL`` (snapshot del último cierre).
    * Almacén con ambos flags en ``'N'`` (consignación, custodios, etc.) →
      no se cierra. Fuente: ``TINV_MOVIMIENTO`` sumando E − S (sin anulados).

    Esto reproduce lo que muestra la "Consulta de Existencia de Producto en
    Grupo" del legado.
    """
    params: list = [no_cia]
    where_universo = ["a.no_cia = :1"]
    where_outer: list[str] = []
    extra_mov_where: list[str] = []

    if punto:
        params.append(punto)
        i = len(params)
        where_universo.append(f"a.punto = :{i}")
        extra_mov_where.append(f"m.punto = :{i}")
    if almacen:
        params.append(almacen)
        i = len(params)
        where_universo.append(f"a.almacen = :{i}")
        extra_mov_where.append(f"m.almacen = :{i}")
    if no_produ:
        params.append(no_produ)
        i = len(params)
        where_universo.append(f"e.no_produ = :{i}")
        extra_mov_where.append(f"m.no_produ = :{i}")
    if grupo:
        params.append(grupo)
        i = len(params)
        where_outer.append(f"p.grupo_produ = :{i}")
    if search:
        params.append(f'%{search}%')
        i = len(params)
        where_outer.append(f"UPPER(p.descri) LIKE UPPER(:{i})")

    # Universo de filas (cia, punto, almacen, no_produ) — unión de EPRODUCTO y
    # MOVIMIENTO. Productos con alguna evidencia de stock o histórico aparecen.
    extra_mov = (" AND " + " AND ".join(extra_mov_where)) if extra_mov_where else ""
    mov_sum_expr = (
        "SUM(CASE WHEN m.tipo_movi='E' THEN NVL(m.cantidad,0) "
        "         WHEN m.tipo_movi='S' THEN -NVL(m.cantidad,0) ELSE 0 END)"
    )
    universo_sql = (
        "SELECT a.no_cia, a.punto, a.almacen, e.no_produ "
        "FROM INV.TINV_ALMACEN a "
        "JOIN ("
        "  SELECT no_cia, punto, almacen, no_produ FROM INV.TINV_EPRODUCTO "
        "  UNION "
        "  SELECT no_cia, punto, almacen, no_produ FROM INV.TINV_MOVIMIENTO "
        "  WHERE NVL(st_anulado,'N')='N' "
        ") e ON e.no_cia=a.no_cia AND e.punto=a.punto AND e.almacen=a.almacen "
        f"WHERE {' AND '.join(where_universo)} "
        "  AND NVL(a.activo,'S')='S' "
    )

    # CASE para decidir la fuente: EPRODUCTO si el almacén es controlado,
    # MOVIMIENTOS si no. Usamos NVL para soportar filas faltantes en cualquier
    # fuente sin caerse.
    existencia_expr = (
        "CASE WHEN NVL(a.ctrl_exist_min,'N')='S' OR NVL(a.ctrl_exist_max,'N')='S' "
        "     THEN NVL(ep.exist_actual, 0) "
        "     ELSE NVL(mov.existencia, 0) END"
    )

    having_existencia = (
        f"AND ({existencia_expr}) > 0" if solo_con_existencia else ""
    )

    outer_where = " AND ".join(where_outer)
    sql = (
        "SELECT u.no_cia, u.punto, u.no_produ, p.descri descripcion, "
        "p.grupo_produ, p.linea, p.sub_linea, "
        "g.descri AS grupo_descripcion, "
        "u.almacen, a.descri almacen_desc, "
        "a.ctrl_exist_min, a.ctrl_exist_max, "
        # Origen del dato (debug-friendly):
        "CASE WHEN NVL(a.ctrl_exist_min,'N')='S' OR NVL(a.ctrl_exist_max,'N')='S' "
        "     THEN 'eproducto' ELSE 'movimientos' END AS fuente_existencia, "
        f"{existencia_expr} AS existencia, "
        "NVL(ep.costo_actual, 0) costo_prom, "
        f"ROUND(({existencia_expr}) * NVL(ep.costo_actual, 0), 2) valor, "
        "NVL(ep.exist_minima, 0) exist_minima, "
        "NVL(ep.exist_maxima, 0) exist_maxima "
        f"FROM ({universo_sql}) u "
        "JOIN INV.TINV_ALMACEN a "
        "  ON a.no_cia=u.no_cia AND a.punto=u.punto AND a.almacen=u.almacen "
        "JOIN INV.TINV_PRODUCTO p ON p.no_produ = u.no_produ "
        "LEFT JOIN INV.TINV_GRUPO_PRODU g ON g.no_grupo = p.grupo_produ "
        "LEFT JOIN INV.TINV_EPRODUCTO ep "
        "  ON ep.no_cia=u.no_cia AND ep.punto=u.punto "
        "  AND ep.almacen=u.almacen AND ep.no_produ=u.no_produ "
        "LEFT JOIN ("
        f"  SELECT m.no_cia, m.punto, m.almacen, m.no_produ, {mov_sum_expr} AS existencia "
        "  FROM INV.TINV_MOVIMIENTO m "
        f"  WHERE m.no_cia=:1 AND NVL(m.st_anulado,'N')='N' {extra_mov} "
        "  GROUP BY m.no_cia, m.punto, m.almacen, m.no_produ "
        ") mov ON mov.no_cia=u.no_cia AND mov.punto=u.punto "
        "  AND mov.almacen=u.almacen AND mov.no_produ=u.no_produ "
        + (f"WHERE {outer_where} " if outer_where else "")
        + (f"{'AND' if outer_where else 'WHERE'} 1=1 {having_existencia} " if solo_con_existencia else "")
        + "ORDER BY u.punto, u.almacen, p.descri"
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
    """Existencia por almacén para un producto específico.

    Usa ÚNICAMENTE TINV_MOVIMIENTO (SUM E − S), normalizada a unidades de
    reporte mediante TINV_EMPAQUE (para_reporte='S').  Replica exactamente la
    lógica del Rinv304 del legado:

    - JOIN con TINV_EMPAQUE para obtener el empaque "para_reporte" del producto.
    - Normalización: si m.empaque = ep_reporte.empaque la cantidad ya está en
      unidades de reporte; en caso contrario se divide por ep_reporte.cpe.
    - Se incluyen TODOS los movimientos (incluso st_anulado='S') porque el PDF
      legado también los incluye: los movimientos anulados siempre tienen una
      AF (anulación) que los cancela, por lo que el neto es el mismo.

    TINV_EPRODUCTO.exist_actual se usa sólo para costo_actual, exist_minima y
    exist_maxima (snapshot del último cierre, puede quedar desfasado).

    Verificado 2026-05-30 contra producto 00000001 alm 01: bal = 2.000 (PDF).
    """
    sql = (
        "SELECT a.no_cia, a.punto, a.almacen, a.descri almacen_desc, "
        "       :p_prod AS no_produ, p.descri descripcion, "
        "       NVL(mov.net, 0) AS existencia, "
        "       'movimientos' AS fuente_existencia, "
        "       NVL(ep.costo_actual, 0) costo_actual, "
        "       ROUND(NVL(mov.net, 0) * NVL(ep.costo_actual, 0), 2) valor, "
        "       NVL(ep.exist_minima, 0) exist_minima, "
        "       NVL(ep.exist_maxima, 0) exist_maxima "
        "FROM   INV.TINV_ALMACEN a "
        "JOIN   INV.TINV_PRODUCTO p ON p.no_produ = :p_prod "
        "LEFT JOIN INV.TINV_EPRODUCTO ep "
        "       ON ep.no_cia=a.no_cia AND ep.punto=a.punto AND ep.almacen=a.almacen "
        "       AND ep.no_produ = :p_prod "
        # Normalizar cantidad al empaque para_reporte del producto (como Rinv304):
        # si m.empaque = emp.empaque => ya en unidades de reporte, usar cantidad
        # si m.empaque != emp.empaque => convertir: cantidad / emp.cpe
        "LEFT JOIN ("
        "       SELECT m.no_cia, m.punto, m.almacen, "
        "              ROUND(SUM(CASE WHEN m.tipo_movi='E' "
        "                       THEN CASE WHEN m.empaque = emp.empaque THEN NVL(m.cantidad,0) "
        "                                 WHEN NVL(emp.cpe,0) > 0 THEN NVL(m.cantidad,0) / emp.cpe "
        "                                 ELSE NVL(m.cantidad,0) END "
        "                       WHEN m.tipo_movi='S' "
        "                       THEN -(CASE WHEN m.empaque = emp.empaque THEN NVL(m.cantidad,0) "
        "                                   WHEN NVL(emp.cpe,0) > 0 THEN NVL(m.cantidad,0) / emp.cpe "
        "                                   ELSE NVL(m.cantidad,0) END) "
        "                       ELSE 0 END), 6) AS net "
        "       FROM INV.TINV_MOVIMIENTO m "
        "       JOIN INV.TINV_EMPAQUE emp "
        "         ON emp.no_produ = m.no_produ AND emp.para_reporte = 'S' "
        "       WHERE m.no_cia=:p_cia AND m.no_produ=:p_prod "
        "       GROUP BY m.no_cia, m.punto, m.almacen "
        ") mov ON mov.no_cia=a.no_cia AND mov.punto=a.punto AND mov.almacen=a.almacen "
        "WHERE a.no_cia = :p_cia AND NVL(a.activo,'S')='S' "
        # Solo almacenes que tengan historial de movimientos para este producto
        "  AND mov.net IS NOT NULL "
        # Saldo neto redondeado a 6 decimales para evitar ruido de punto flotante
        "  AND ROUND(NVL(mov.net, 0), 6) != 0 "
        "ORDER BY a.punto, a.almacen"
    )
    return client.fetch_dicts(sql, {"p_cia": no_cia, "p_prod": no_produ})


def get_movimientos_producto(
    no_cia: str,
    no_produ: str,
    punto: str = '',
    almacen: str = '',
    desde: str = '',
    hasta: str = '',
) -> dict:
    """Movimientos del producto con balance corrido — equivalente al Rinv304.

    Normaliza las cantidades al empaque para_reporte (TINV_EMPAQUE.para_reporte='S')
    igual que get_existencia_producto, e incluye TODOS los movimientos (incluso
    st_anulado='S') para replicar fielmente el PDF Rinv304 del legado.

    Returns dict con:
      - no_produ: código del producto
      - items: lista de movimientos con campos punto, almacen, tipo_docu, no_docu,
               fecha, entrada, salida, balance (corrido), costo
      - totales: { entradas, salidas, balance }
    """
    params: list = [no_cia, no_produ]
    where = ["m.no_cia=:1", "m.no_produ=:2"]
    if punto:
        params.append(punto)
        where.append(f"m.punto=:{len(params)}")
    if almacen:
        params.append(almacen)
        where.append(f"m.almacen=:{len(params)}")
    if desde:
        params.append(desde)
        where.append(f"m.fecha >= TO_DATE(:{len(params)},'YYYY-MM-DD')")
    if hasta:
        params.append(hasta)
        where.append(f"m.fecha <= TO_DATE(:{len(params)},'YYYY-MM-DD') + 1 - 1/86400")

    # Normalización idéntica a get_existencia_producto:
    # CASE WHEN m.empaque = emp.empaque THEN m.cantidad  (ya en unidades de reporte)
    #      WHEN emp.cpe > 0             THEN m.cantidad / emp.cpe
    #      ELSE m.cantidad END
    norm_expr = (
        "CASE WHEN m.empaque = emp.empaque THEN NVL(m.cantidad,0) "
        "     WHEN NVL(emp.cpe,0) > 0 THEN NVL(m.cantidad,0) / emp.cpe "
        "     ELSE NVL(m.cantidad,0) END"
    )

    sql = (
        "SELECT m.punto, m.almacen, m.tipo_docu, m.no_docu, "
        "       TO_CHAR(m.fecha,'YYYY-MM-DD HH24:MI:SS') AS fecha_iso, "
        "       m.tipo_movi, "
        f"      {norm_expr} AS norm_qty, "
        "       NVL(m.costo, 0) AS costo, "
        "       NVL(m.st_anulado,'N') AS st_anulado "
        "FROM INV.TINV_MOVIMIENTO m "
        "JOIN INV.TINV_EMPAQUE emp "
        "  ON emp.no_produ = m.no_produ AND emp.para_reporte = 'S' "
        "WHERE " + " AND ".join(where) + " "
        "ORDER BY m.fecha, m.no_docu"
    )
    rows = client.fetch_dicts(sql, params)
    items = []
    balance = 0.0
    for r in rows:
        qty = float(r['norm_qty'] or 0)
        is_entrada = (r['tipo_movi'] or '').upper() == 'E'
        delta = qty if is_entrada else -qty
        balance += delta
        items.append({
            'punto': r['punto'],
            'almacen': r['almacen'],
            'tipo_docu': r['tipo_docu'],
            'no_docu': r['no_docu'],
            'fecha': r['fecha_iso'],
            'entrada': round(qty, 4) if is_entrada else 0.0,
            'salida': round(qty, 4) if not is_entrada else 0.0,
            'balance': round(balance, 4),
            'costo': float(r['costo'] or 0),
            'st_anulado': r['st_anulado'],
        })
    total_e = sum(i['entrada'] for i in items)
    total_s = sum(i['salida'] for i in items)
    return {
        'no_produ': no_produ,
        'items': items,
        'totales': {
            'entradas': round(total_e, 4),
            'salidas': round(total_s, 4),
            'balance': round(total_e - total_s, 4),
        },
    }


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


# =============================================================================
# Conteo Físico (FINV705) — Ajuste Conteo Físico Vs. Existencia en Libro
# =============================================================================
#
# Flujo legado replicado:
#   1) Cargar conteo → INSERT TINV_CONTEO_FISICO (pendiente)
#   2) Comparativo  → JOIN pendiente con EPRODUCTO.exist_actual
#   3) Aplicar      → para cada fila pendiente:
#        a) Calcular diferencia = conteo_fisico - exist_actual
#        b) Si diferencia != 0: INSERT TINV_MOVIMIENTO con tipo_docu='AE' (entrada)
#           o 'AS' (salida), tipo_movi='E'/'S', tipo_transaccion='J', servicio='I'.
#           Cantidad = abs(diferencia). Costo = exist.costo_actual.
#        c) UPDATE TINV_EPRODUCTO SET exist_actual = conteo_fisico
#        d) INSERT TINV_CONTEO_FISICOH con fecha_ajuste = SYSDATE, exist_actual
#           = conteo_fisico, usuario_ajusto = usuario.
#        e) DELETE TINV_CONTEO_FISICO de esa fila.
#      Todo en una transacción única con commit al final (rollback si algo
#      falla, para no dejar movimientos sin ajuste de EPRODUCTO o viceversa).


def cargar_conteo_fisico(rows: list[dict], usuario: str) -> dict:
    """Inserta filas pendientes en TINV_CONTEO_FISICO.

    Cada row debe traer: no_cia, punto, almacen, no_produ, conteo_fisico_uni,
    conteo_fisico_cjs (opcional, default 0), contador (opcional), empaque
    (opcional, default 1), cpe (opcional, default 1).
    Si ya existe una fila pendiente para esa PK, se actualiza el conteo.
    Devuelve {inserted, updated}.
    """
    if not rows:
        return {"inserted": 0, "updated": 0}
    inserted = 0
    updated = 0
    with client.connection() as conn:
        cur = conn.cursor()
        for r in rows:
            no_cia   = (r.get('no_cia') or '').strip()
            punto    = (r.get('punto') or '01').strip()
            almacen  = (r.get('almacen') or '').strip()
            no_produ = (r.get('no_produ') or '').strip().upper()
            uni      = float(r.get('conteo_fisico_uni') or 0)
            cjs      = float(r.get('conteo_fisico_cjs') or 0)
            contador = (r.get('contador') or '')[:30]
            empaque  = int(r.get('empaque') or 1)
            cpe      = int(r.get('cpe') or 1)
            if not (no_cia and almacen and no_produ):
                continue
            # Existe ya pendiente? PK = (no_cia, punto, almacen, no_produ)
            cur.execute(
                "SELECT 1 FROM INV.TINV_CONTEO_FISICO "
                "WHERE no_cia=:1 AND punto=:2 AND almacen=:3 AND no_produ=:4",
                [no_cia, punto, almacen, no_produ],
            )
            if cur.fetchone():
                cur.execute(
                    "UPDATE INV.TINV_CONTEO_FISICO SET "
                    "  conteo_fisico_uni=:1, conteo_fisico_cjs=:2, "
                    "  contador=:3, usuario=:4, fecha=SYSDATE, empaque=:5, cpe=:6 "
                    "WHERE no_cia=:7 AND punto=:8 AND almacen=:9 AND no_produ=:10",
                    [uni, cjs, contador, usuario[:30], empaque, cpe,
                     no_cia, punto, almacen, no_produ],
                )
                updated += 1
            else:
                cur.execute(
                    "INSERT INTO INV.TINV_CONTEO_FISICO("
                    "  no_cia, punto, almacen, no_produ, "
                    "  usuario, contador, fecha, "
                    "  empaque, cpe, conteo_fisico_cjs, conteo_fisico_uni"
                    ") VALUES("
                    "  :1, :2, :3, :4, :5, :6, SYSDATE, :7, :8, :9, :10)",
                    [no_cia, punto, almacen, no_produ,
                     usuario[:30], contador, empaque, cpe, cjs, uni],
                )
                inserted += 1
        conn.commit()
    return {"inserted": inserted, "updated": updated}


def comparativo_conteo_fisico(no_cia: str, punto: str = '',
                                almacen: str = '', no_produ: str = '') -> list[dict]:
    """Compara filas pendientes en TINV_CONTEO_FISICO vs EPRODUCTO.exist_actual.

    Devuelve por fila: cia, punto, almacen, almacen_desc, no_produ, descripcion,
    conteo_fisico (uni + cjs * empaque, según cpe), exist_libro, diferencia,
    costo_actual, valor_diferencia, contador, fecha (del conteo).
    """
    if not no_cia:
        return []
    params: list = [no_cia]
    where = ["c.no_cia = :1"]
    if punto:
        params.append(punto)
        where.append(f"c.punto = :{len(params)}")
    if almacen:
        params.append(almacen)
        where.append(f"c.almacen = :{len(params)}")
    if no_produ:
        params.append(no_produ.upper())
        where.append(f"c.no_produ = :{len(params)}")
    sql = (
        "SELECT c.no_cia, c.punto, c.almacen, a.descri AS almacen_desc, "
        "       c.no_produ, p.descri AS descripcion, "
        "       c.contador, c.fecha, c.empaque, c.cpe, "
        "       NVL(c.conteo_fisico_uni,0) AS conteo_fisico_uni, "
        "       NVL(c.conteo_fisico_cjs,0) AS conteo_fisico_cjs, "
        "       NVL(c.conteo_fisico_uni,0) + NVL(c.conteo_fisico_cjs,0) * NVL(c.cpe,1) AS conteo_total, "
        "       NVL(ep.exist_actual,0) AS exist_libro, "
        "       NVL(ep.costo_actual,0) AS costo_actual, "
        "       (NVL(c.conteo_fisico_uni,0) + NVL(c.conteo_fisico_cjs,0) * NVL(c.cpe,1) "
        "        - NVL(ep.exist_actual,0)) AS diferencia, "
        "       ROUND((NVL(c.conteo_fisico_uni,0) + NVL(c.conteo_fisico_cjs,0) * NVL(c.cpe,1) "
        "        - NVL(ep.exist_actual,0)) * NVL(ep.costo_actual,0), 2) AS valor_diferencia "
        "FROM INV.TINV_CONTEO_FISICO c "
        "JOIN INV.TINV_PRODUCTO p ON p.no_produ = c.no_produ "
        "LEFT JOIN INV.TINV_ALMACEN a "
        "  ON a.no_cia=c.no_cia AND a.punto=c.punto AND a.almacen=c.almacen "
        "LEFT JOIN INV.TINV_EPRODUCTO ep "
        "  ON ep.no_cia=c.no_cia AND ep.punto=c.punto "
        "  AND ep.almacen=c.almacen AND ep.no_produ=c.no_produ "
        f"WHERE {' AND '.join(where)} "
        "ORDER BY c.almacen, c.no_produ"
    )
    return client.fetch_dicts(sql, params)


def aplicar_conteo_fisico(no_cia: str, punto: str, usuario: str,
                            almacen: str = '', no_produ: str = '') -> dict:
    """Aplica los ajustes pendientes. Transaccional.

    Devuelve {procesados, entradas_generadas, salidas_generadas, sin_cambio,
    errores}.  Si ``almacen`` o ``no_produ`` se especifican, solo aplica esas
    filas pendientes.
    """
    if not no_cia:
        return {"procesados": 0, "entradas_generadas": 0, "salidas_generadas": 0,
                "sin_cambio": 0, "errores": []}

    # Filtros para la query de pendientes
    params: list = [no_cia, punto]
    where = ["c.no_cia=:1", "c.punto=:2"]
    if almacen:
        params.append(almacen)
        where.append(f"c.almacen=:{len(params)}")
    if no_produ:
        params.append(no_produ.upper())
        where.append(f"c.no_produ=:{len(params)}")

    procesados = entradas = salidas = sin_cambio = 0
    errores: list[str] = []

    with client.connection() as conn:
        cur = conn.cursor()
        try:
            # Lock pendientes y traer datos con EPRODUCTO
            cur.execute(
                "SELECT c.no_cia, c.punto, c.almacen, c.no_produ, "
                "       NVL(c.conteo_fisico_uni,0) + NVL(c.conteo_fisico_cjs,0)*NVL(c.cpe,1) AS conteo_total, "
                "       NVL(c.conteo_fisico_cjs,0) AS cjs, NVL(c.conteo_fisico_uni,0) AS uni, "
                "       NVL(c.empaque,1) AS empaque, NVL(c.cpe,1) AS cpe, "
                "       c.contador, c.usuario, "
                "       NVL(ep.exist_actual,0) AS exist_libro, "
                "       NVL(ep.costo_actual,0) AS costo_actual "
                "FROM INV.TINV_CONTEO_FISICO c "
                "LEFT JOIN INV.TINV_EPRODUCTO ep "
                "  ON ep.no_cia=c.no_cia AND ep.punto=c.punto "
                "  AND ep.almacen=c.almacen AND ep.no_produ=c.no_produ "
                f"WHERE {' AND '.join(where)} FOR UPDATE OF c.no_cia",
                params,
            )
            cols = [d[0].lower() for d in cur.description]
            pendientes = [dict(zip(cols, row)) for row in cur.fetchall()]

            for p in pendientes:
                no_cia_r = p['no_cia']
                punto_r = p['punto']
                almacen_r = p['almacen']
                no_produ_r = p['no_produ']
                conteo = float(p['conteo_total'] or 0)
                libro = float(p['exist_libro'] or 0)
                diferencia = conteo - libro
                costo = float(p['costo_actual'] or 0)
                empaque = int(p['empaque'] or 1)
                cpe = int(p['cpe'] or 1)

                if abs(diferencia) > 0.0001:
                    tipo_docu = 'AE' if diferencia > 0 else 'AS'
                    tipo_movi = 'E' if diferencia > 0 else 'S'
                    cantidad = abs(diferencia)
                    # Tomar siguiente NO_DOCU desde TINV_SECUENCIA (FOR UPDATE para serializar)
                    cur.execute(
                        "SELECT NVL(prox_documento,1) AS prox FROM INV.TINV_SECUENCIA "
                        "WHERE no_cia=:1 AND punto=:2 AND tipo_docu=:3 FOR UPDATE",
                        [no_cia_r, punto_r, tipo_docu],
                    )
                    seq_row = cur.fetchone()
                    if not seq_row:
                        # No hay secuencia configurada — crear arrancando en 1
                        cur.execute(
                            "INSERT INTO INV.TINV_SECUENCIA(no_cia,punto,tipo_docu,prox_documento) "
                            "VALUES(:1,:2,:3,1)",
                            [no_cia_r, punto_r, tipo_docu],
                        )
                        prox = 1
                    else:
                        prox = int(seq_row[0] or 1)
                    no_docu = str(prox).zfill(7)

                    # INSERT en TINV_MOVIMIENTO (cumple todos los NOT NULL)
                    cur.execute(
                        "INSERT INTO INV.TINV_MOVIMIENTO("
                        "  no_cia, punto, tipo_docu, no_docu, no_linea, "
                        "  almacen, no_produ, tipo_movi, tipo_transaccion, servicio, "
                        "  fecha, cantidad, precio, costo, "
                        "  st_anulado, empaque, cpe, usuario, monto_neto, "
                        "  no_localidad, fecha_sysdate, aumento_cxc"
                        ") VALUES("
                        "  :1, :2, :3, :4, 1, "
                        "  :5, :6, :7, 'J', 'I', "
                        "  SYSDATE, :8, :9, :9, "
                        "  'N', :10, :11, :12, :13, "
                        "  :1, SYSDATE, 0)",
                        [no_cia_r, punto_r, tipo_docu, no_docu,
                         almacen_r, no_produ_r, tipo_movi,
                         cantidad, costo, empaque, cpe, usuario[:30],
                         round(cantidad * costo, 2)],
                    )
                    # Avanzar secuencia
                    cur.execute(
                        "UPDATE INV.TINV_SECUENCIA SET prox_documento=:1 "
                        "WHERE no_cia=:2 AND punto=:3 AND tipo_docu=:4",
                        [prox + 1, no_cia_r, punto_r, tipo_docu],
                    )
                    if tipo_movi == 'E':
                        entradas += 1
                    else:
                        salidas += 1
                else:
                    sin_cambio += 1

                # UPDATE TINV_EPRODUCTO.exist_actual = conteo
                # Si no existe la fila en EPRODUCTO, crearla.
                cur.execute(
                    "SELECT 1 FROM INV.TINV_EPRODUCTO "
                    "WHERE no_cia=:1 AND punto=:2 AND almacen=:3 AND no_produ=:4",
                    [no_cia_r, punto_r, almacen_r, no_produ_r],
                )
                if cur.fetchone():
                    cur.execute(
                        "UPDATE INV.TINV_EPRODUCTO SET exist_actual=:1 "
                        "WHERE no_cia=:2 AND punto=:3 AND almacen=:4 AND no_produ=:5",
                        [conteo, no_cia_r, punto_r, almacen_r, no_produ_r],
                    )
                else:
                    cur.execute(
                        "INSERT INTO INV.TINV_EPRODUCTO("
                        "  no_cia, punto, almacen, no_produ, exist_actual, costo_actual, "
                        "  exist_minima, exist_maxima) "
                        "VALUES(:1,:2,:3,:4,:5,:6,0,0)",
                        [no_cia_r, punto_r, almacen_r, no_produ_r, conteo, costo],
                    )

                # INSERT en historico
                cur.execute(
                    "INSERT INTO INV.TINV_CONTEO_FISICOH("
                    "  no_cia, punto, almacen, no_produ, "
                    "  usuario, contador, fecha, "
                    "  conteo_fisico_cjs, conteo_fisico_uni, "
                    "  usuario_ajusto, fecha_ajuste, "
                    "  exist_actual, costo_actual, empaque, cpe"
                    ") VALUES("
                    "  :1, :2, :3, :4, :5, :6, SYSDATE, :7, :8, "
                    "  :9, SYSDATE, :10, :11, :12, :13)",
                    [no_cia_r, punto_r, almacen_r, no_produ_r,
                     (p.get('usuario') or usuario)[:30], (p.get('contador') or '')[:30],
                     float(p.get('cjs') or 0), float(p.get('uni') or 0),
                     usuario[:30], conteo, costo, empaque, cpe],
                )

                # DELETE de pendiente
                cur.execute(
                    "DELETE FROM INV.TINV_CONTEO_FISICO "
                    "WHERE no_cia=:1 AND punto=:2 AND almacen=:3 AND no_produ=:4",
                    [no_cia_r, punto_r, almacen_r, no_produ_r],
                )

                procesados += 1

            conn.commit()
        except Exception as e:
            conn.rollback()
            errores.append(str(e))

    return {
        "procesados": procesados,
        "entradas_generadas": entradas,
        "salidas_generadas": salidas,
        "sin_cambio": sin_cambio,
        "errores": errores,
    }


def historico_conteo_fisico(no_cia: str, no_produ: str = '', almacen: str = '',
                              desde: str = '', hasta: str = '',
                              page: int = 1, page_size: int = 50) -> dict:
    """Pagina TINV_CONTEO_FISICOH con join a almacen + producto."""
    if not no_cia:
        return {"results": [], "count": 0, "page": page, "page_size": page_size}
    params: list = [no_cia]
    where = ["h.no_cia=:1"]
    if no_produ:
        params.append(no_produ.upper())
        where.append(f"h.no_produ=:{len(params)}")
    if almacen:
        params.append(almacen)
        where.append(f"h.almacen=:{len(params)}")
    if desde:
        params.append(desde)
        where.append(f"TRUNC(h.fecha_ajuste) >= TO_DATE(:{len(params)},'YYYY-MM-DD')")
    if hasta:
        params.append(hasta)
        where.append(f"TRUNC(h.fecha_ajuste) <= TO_DATE(:{len(params)},'YYYY-MM-DD')")
    cnt_rows = client.fetch_dicts(
        f"SELECT COUNT(*) AS n FROM INV.TINV_CONTEO_FISICOH h WHERE {' AND '.join(where)}",
        params,
    )
    count = int(cnt_rows[0]['n']) if cnt_rows else 0
    start = (page - 1) * page_size
    end = start + page_size
    params_paged = list(params) + [end, start]
    sql = (
        "SELECT * FROM ("
        "  SELECT a.*, ROWNUM rn FROM ("
        "    SELECT h.no_cia, h.punto, h.almacen, al.descri AS almacen_desc, "
        "           h.no_produ, p.descri AS descripcion, "
        "           h.contador, h.usuario, h.fecha AS fecha_conteo, "
        "           h.usuario_ajusto, h.fecha_ajuste, "
        "           NVL(h.conteo_fisico_uni,0) AS conteo_fisico_uni, "
        "           NVL(h.conteo_fisico_cjs,0) AS conteo_fisico_cjs, "
        "           NVL(h.exist_actual,0) AS exist_actual, "
        "           NVL(h.costo_actual,0) AS costo_actual "
        "    FROM INV.TINV_CONTEO_FISICOH h "
        "    JOIN INV.TINV_PRODUCTO p ON p.no_produ = h.no_produ "
        "    LEFT JOIN INV.TINV_ALMACEN al "
        "      ON al.no_cia=h.no_cia AND al.punto=h.punto AND al.almacen=h.almacen "
        f"    WHERE {' AND '.join(where)} "
        "    ORDER BY h.fecha_ajuste DESC"
        f"  ) a WHERE ROWNUM <= :{len(params_paged)-1}"
        f") WHERE rn > :{len(params_paged)}"
    )
    rows = client.fetch_dicts(sql, params_paged)
    return {"results": rows, "count": count, "page": page, "page_size": page_size}
