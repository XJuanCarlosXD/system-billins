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


def count_productos(search: str = '', grupo: str = '', linea: str = '') -> int:
    params: list = []
    where = ["1=1"]
    if search:
        params.append(f'%{search}%')
        params.append(f'%{search}%')
        where.append("(UPPER(descri) LIKE UPPER(:1) OR UPPER(no_produ) LIKE UPPER(:2))")
    if grupo:
        params.append(grupo)
        where.append(f"grupo_produ = :{len(params)}")
    if linea:
        params.append(linea)
        where.append(f"linea = :{len(params)}")
    row = client.fetch_one(
        f"SELECT COUNT(*) FROM INV.TINV_PRODUCTO WHERE {' AND '.join(where)}",
        params,
    )
    return int(row[0]) if row else 0


def peek_next_producto() -> str:
    """Devuelve el siguiente no_produ del secuencial INV.TINV_NEXT_PRODU.

    Solo lectura (preview). La reserva real ocurre dentro de create_producto
    via FOR UPDATE para evitar carreras.
    """
    rows = client.fetch_dicts(
        "SELECT NVL(MAX(next_produ),1) AS n FROM INV.TINV_NEXT_PRODU", []
    )
    n = int(rows[0]['n']) if rows else 1
    return str(n).zfill(8)


def _reserve_next_producto(cur) -> str:
    """Reserva el siguiente no_produ y avanza TINV_NEXT_PRODU. Misma logica
    que el legacy: SELECT FOR UPDATE -> usar valor -> UPDATE +1.
    """
    row = cur.execute(
        "SELECT NVL(next_produ,1) FROM INV.TINV_NEXT_PRODU FOR UPDATE"
    ).fetchone()
    if row:
        a_usar = int(row[0] or 1)
        cur.execute(
            "UPDATE INV.TINV_NEXT_PRODU SET next_produ = :1", [a_usar + 1]
        )
    else:
        a_usar = 1
        cur.execute(
            "INSERT INTO INV.TINV_NEXT_PRODU(next_produ) VALUES(:1)", [a_usar + 1]
        )
    return str(a_usar).zfill(8)


def create_producto(payload: dict, usuario: str = '') -> dict:
    """Crea un producto con campos mínimos. El resto se rellena con defaults
    sensatos para que cumpla los NOT NULL del schema legado.

    Campos del payload:
      no_produ (str, opcional — si vacio se asigna desde TINV_NEXT_PRODU)
      descripcion (str, requerido, max 40 chars)
      grupo_produ (str, requerido)
      linea (str, requerido)
      sub_linea (str, requerido)
      grupo_contable (str, requerido)
      tiene_impuesto (str 'S'|'N', def='S')
      porciento_impuesto (num, def=18 si tiene_impuesto)
      costo (num, def=0)  -> costo_mercado_rd
      servicio (str 'I'|'S'|'K'|'C', def='I')
      activo (str 'S'|'N', def='S')
      marca (str, opc)
      referencia (str, opc)
      no_proveedor (str, opc)
    """
    no_produ = (payload.get('no_produ') or '').strip().upper()
    descri = (payload.get('descripcion') or '').strip()
    grupo_produ = (payload.get('grupo_produ') or '').strip()
    linea = (payload.get('linea') or '').strip()
    sub_linea = (payload.get('sub_linea') or '').strip()
    grupo_contable = (payload.get('grupo_contable') or '').strip()

    if not descri:
        raise ValueError("descripcion es requerida")
    if len(descri) > 40:
        raise ValueError(
            f"descripcion supera los 40 caracteres permitidos ({len(descri)})"
        )
    if not grupo_produ:
        raise ValueError("grupo_produ es requerido")
    if not linea:
        raise ValueError("linea es requerida")
    if not sub_linea:
        raise ValueError("sub_linea es requerida")
    if not grupo_contable:
        raise ValueError("grupo_contable es requerido")

    # Si el caller envió un código fijo, verifica que no exista; si no, se
    # asignará desde TINV_NEXT_PRODU dentro de la misma transacción.
    if no_produ:
        if client.fetch_one(
            "SELECT 1 FROM INV.TINV_PRODUCTO WHERE no_produ = :1",
            [no_produ],
        ):
            raise ValueError(f"Ya existe un producto con código {no_produ}")

    tiene_imp = str(payload.get('tiene_impuesto') or 'S').upper()[:1]
    porc_imp = float(payload.get('porciento_impuesto') or (18 if tiene_imp == 'S' else 0))
    costo = float(payload.get('costo') or 0)
    servicio = str(payload.get('servicio') or 'I').upper()[:1]
    activo = str(payload.get('activo') or 'S').upper()[:1]
    marca = (payload.get('marca') or '')[:4] or None
    referencia = (payload.get('referencia') or '')[:25] or None
    no_proveedor = (payload.get('no_proveedor') or '')[:6] or None
    upc = (payload.get('upc') or '')[:16] or None
    especificaciones = (payload.get('especificaciones') or '')[:100] or None
    permite_desc = str(payload.get('permite_desc') or 'S').upper()[:1]
    importado = str(payload.get('importado') or 'L').upper()[:1]   # 'L'=Local, 'I'=Importado
    indi_lote = str(payload.get('indi_lote') or 'N').upper()[:1]
    max_desc = payload.get('maximo_descuento')
    max_desc = float(max_desc) if max_desc not in (None, '') else None
    peso = payload.get('peso')
    peso = float(peso) if peso not in (None, '') else None
    medida = payload.get('medida')
    medida = float(medida) if medida not in (None, '') else None
    porc_isc = payload.get('porciento_isc')
    porc_isc = float(porc_isc) if porc_isc not in (None, '') else None
    porc_otros = payload.get('porc_otros_impuestos')
    porc_otros = float(porc_otros) if porc_otros not in (None, '') else None

    with client.cursor() as cur:
        if not no_produ:
            no_produ = _reserve_next_producto(cur)
        cur.execute(
            "INSERT INTO INV.TINV_PRODUCTO ("
            "  NO_PRODU, DESCRI, LINEA, SUB_LINEA, GRUPO_PRODU, "
            "  TIENE_IMPUESTO, PORCIENTO_IMPUESTO, COSTO_MERCADO_RD, "
            "  ACTIVO, INDI_LOTE, FECHA, USUARIO, GRUPO_CONTABLE, "
            "  PERMITE_DESC, SERVICIO, SIMPLE, DESPACHAR_VENCIDO, "
            "  EN_PORCIONES, OFERTA, USA_ENVASE_RETORNABLE, IMPORTADO, "
            "  USA_SERIE, CONTROLAR_EXIST_SERIE, EDITABLE, "
            "  MARCA, REFERENCIA, NO_PROVEEDOR, "
            "  UPC, ESPECIFICACIONES, MAXIMO_DESCUENTO, PESO, MEDIDA, "
            "  PORCIENTO_ISC, PORC_OTROS_IMPUESTOS"
            ") VALUES ("
            "  :no_produ, :descri, :linea, :sub_linea, :grupo_produ, "
            "  :tiene_imp, :porc_imp, :costo, "
            "  :activo, :indi_lote, SYSDATE, :usuario, :grupo_contable, "
            "  :permite_desc, :servicio, 'S', 'N', "
            "  'N', 'N', 'N', :importado, "
            "  'N', 'N', 'S', "
            "  :marca, :referencia, :no_proveedor, "
            "  :upc, :especificaciones, :max_desc, :peso, :medida, "
            "  :porc_isc, :porc_otros"
            ")",
            {
                'no_produ': no_produ, 'descri': descri, 'linea': linea,
                'sub_linea': sub_linea, 'grupo_produ': grupo_produ,
                'tiene_imp': tiene_imp, 'porc_imp': porc_imp, 'costo': costo,
                'activo': activo, 'usuario': (usuario or 'API')[:30],
                'grupo_contable': grupo_contable, 'servicio': servicio,
                'marca': marca, 'referencia': referencia,
                'no_proveedor': no_proveedor,
                'upc': upc, 'especificaciones': especificaciones,
                'max_desc': max_desc, 'peso': peso, 'medida': medida,
                'porc_isc': porc_isc, 'porc_otros': porc_otros,
                'permite_desc': permite_desc, 'importado': importado,
                'indi_lote': indi_lote,
            },
        )
        cur.connection.commit()
    return {
        'no_produ': no_produ, 'descripcion': descri, 'linea': linea,
        'sub_linea': sub_linea, 'grupo_produ': grupo_produ,
        'grupo_contable': grupo_contable, 'activo': activo,
        'servicio': servicio, 'tiene_impuesto': tiene_imp,
        'porciento_impuesto': porc_imp, 'costo': costo,
    }


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
        f"SELECT no_produ, descripcion, linea, desc_linea, sub_linea, "
        f"       grupo_produ, desc_grupo, activo, costo, precio, itbis, "
        f"       unidad, empaque, tiene_impuesto, servicio "
        f"FROM ("
        f"  SELECT p.no_produ, p.descri descripcion, "
        f"         p.linea, l.descri desc_linea, "
        f"         p.sub_linea, "
        f"         p.grupo_produ, g.descri desc_grupo, "
        f"         p.activo, p.tiene_impuesto, p.porciento_impuesto itbis, "
        f"         NVL(p.costo_mercado_rd, p.costo_mercado) costo, "
        f"         NULL precio, "
        f"         p.servicio, "
        f"         NVL(u.descri, e.unidad) unidad, "
        f"         e.empaque, "
        f"         ROWNUM rn "
        f"  FROM INV.TINV_PRODUCTO p "
        f"  LEFT JOIN INV.TINV_LINEA l ON l.linea = p.linea "
        f"  LEFT JOIN INV.TINV_GRUPO_PRODU g ON g.no_grupo = p.grupo_produ "
        f"  LEFT JOIN INV.TINV_EMPAQUE e ON e.no_produ = p.no_produ AND e.por_defecto = 'S' "
        f"  LEFT JOIN INV.TINV_UNIDAD u ON u.unidad = e.unidad "
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
        "p.costo_mercado, p.costo_mercado_rd, p.grupo_contable, p.servicio, "
        "p.marca, p.referencia, p.no_proveedor, "
        "p.upc, p.especificaciones, p.maximo_descuento, p.peso, p.medida, "
        "p.porciento_isc, p.porc_otros_impuestos, "
        "p.permite_desc, p.importado, p.indi_lote "
        "FROM INV.TINV_PRODUCTO p "
        "LEFT JOIN INV.TINV_LINEA l ON l.linea = p.linea "
        "LEFT JOIN INV.TINV_GRUPO_PRODU g ON g.no_grupo = p.grupo_produ "
        "WHERE p.no_produ = :1",
        [no_produ],
    )
    return rows[0] if rows else None


def update_producto(no_produ: str, payload: dict, usuario: str = '') -> dict:
    """Actualiza un producto existente. Solo modifica campos presentes en payload.

    Acepta los mismos nombres que create_producto. La PK no_produ no es editable.
    """
    no_produ = (no_produ or '').strip().upper()
    if not no_produ:
        raise ValueError("no_produ es requerido")

    existing = client.fetch_one(
        "SELECT 1 FROM INV.TINV_PRODUCTO WHERE no_produ = :1",
        [no_produ],
    )
    if not existing:
        raise ValueError(f"Producto {no_produ} no encontrado")

    if 'descripcion' in payload:
        _d = str(payload.get('descripcion') or '').strip()
        if len(_d) > 40:
            raise ValueError(
                f"descripcion supera los 40 caracteres permitidos ({len(_d)})"
            )

    sets: list[str] = []
    binds: dict = {'no_produ': no_produ}

    field_map = {
        'descripcion': ('descri', lambda v: (str(v) or '').strip()[:40]),
        'linea': ('linea', lambda v: (str(v) or '').strip()),
        'sub_linea': ('sub_linea', lambda v: (str(v) or '').strip()),
        'grupo_produ': ('grupo_produ', lambda v: (str(v) or '').strip()),
        'grupo_contable': ('grupo_contable', lambda v: (str(v) or '').strip()),
        'servicio': ('servicio', lambda v: (str(v) or 'I').upper()[:1]),
        'activo': ('activo', lambda v: (str(v) or 'S').upper()[:1]),
        'tiene_impuesto': ('tiene_impuesto', lambda v: (str(v) or 'S').upper()[:1]),
        'porciento_impuesto': ('porciento_impuesto', lambda v: float(v or 0)),
        'costo': ('costo_mercado_rd', lambda v: float(v or 0)),
        'marca': ('marca', lambda v: ((str(v) or '')[:4] or None)),
        'referencia': ('referencia', lambda v: ((str(v) or '')[:25] or None)),
        'no_proveedor': ('no_proveedor', lambda v: ((str(v) or '')[:6] or None)),
        'upc': ('upc', lambda v: ((str(v) or '')[:16] or None)),
        'especificaciones': ('especificaciones', lambda v: ((str(v) or '')[:100] or None)),
        'maximo_descuento': ('maximo_descuento', lambda v: float(v) if v not in (None, '') else None),
        'peso': ('peso', lambda v: float(v) if v not in (None, '') else None),
        'medida': ('medida', lambda v: float(v) if v not in (None, '') else None),
        'porciento_isc': ('porciento_isc', lambda v: float(v) if v not in (None, '') else None),
        'porc_otros_impuestos': ('porc_otros_impuestos', lambda v: float(v) if v not in (None, '') else None),
        'permite_desc': ('permite_desc', lambda v: (str(v) or 'S').upper()[:1]),
        'importado': ('importado', lambda v: (str(v) or 'L').upper()[:1]),
        'indi_lote': ('indi_lote', lambda v: (str(v) or 'N').upper()[:1]),
    }

    for k, (col, conv) in field_map.items():
        if k in payload:
            try:
                binds[col] = conv(payload[k])
            except (TypeError, ValueError):
                raise ValueError(f"Valor inválido para {k}")
            sets.append(f"{col} = :{col}")

    if not sets:
        return {'no_produ': no_produ, 'updated': 0}

    sets.append("usuario = :usuario")
    binds['usuario'] = (usuario or 'API')[:30]

    sql = f"UPDATE INV.TINV_PRODUCTO SET {', '.join(sets)} WHERE no_produ = :no_produ"
    with client.cursor() as cur:
        cur.execute(sql, binds)
        cur.connection.commit()

    return {'no_produ': no_produ, 'updated': 1}


def list_empaques_producto(no_produ: str) -> list[dict]:
    """Lista los empaques (TINV_EMPAQUE) de un producto con nombres de
    unidad y referencia.
    """
    no_produ = (no_produ or '').strip().upper()
    if not no_produ:
        return []
    return client.fetch_dicts(
        "SELECT e.no_produ, e.empaque, e.unidad, u.descri AS unidad_desc, "
        "e.referencia, r.descri AS referencia_desc, "
        "e.cpe, e.por_defecto, e.para_reporte, e.permite_fraccion "
        "FROM INV.TINV_EMPAQUE e "
        "LEFT JOIN INV.TINV_UNIDAD u ON u.unidad = e.unidad "
        "LEFT JOIN INV.TINV_REFERENCIA r ON r.referencia = e.referencia "
        "WHERE e.no_produ = :1 ORDER BY e.empaque",
        [no_produ],
    )


def save_empaques_producto(no_produ: str, empaques: list[dict]) -> dict:
    """Reemplaza la lista de empaques de un producto (DELETE + INSERT).

    Validaciones legacy FINV111: al menos 1 empaque; exactamente 1
    por_defecto='S' y 1 para_reporte='S' (si no se marca ninguno se
    asigna automáticamente al primero).
    """
    no_produ = (no_produ or '').strip().upper()
    if not no_produ:
        raise ValueError("no_produ es requerido")
    if not client.fetch_one(
        "SELECT 1 FROM INV.TINV_PRODUCTO WHERE no_produ = :1", [no_produ]
    ):
        raise ValueError(f"Producto {no_produ} no encontrado")

    rows: list[dict] = []
    for i, e in enumerate(empaques or [], start=1):
        unidad = (e.get('unidad') or '').strip()
        referencia = (e.get('referencia') or '').strip()
        if not unidad:
            raise ValueError(f"Empaque #{i}: unidad es requerida")
        if not referencia:
            raise ValueError(f"Empaque #{i}: referencia es requerida")
        cpe = e.get('cpe')
        try:
            cpe = float(cpe) if cpe not in (None, '') else 0
        except (TypeError, ValueError):
            raise ValueError(f"Empaque #{i}: cpe (cantidad) inválida")
        if cpe <= 0:
            raise ValueError(f"Empaque #{i}: la cantidad debe ser mayor que cero")
        rows.append({
            'empaque': int(e.get('empaque') or i),
            'unidad': unidad,
            'referencia': referencia,
            'cpe': cpe,
            'por_defecto': (str(e.get('por_defecto') or 'N').upper()[:1]),
            'para_reporte': (str(e.get('para_reporte') or 'N').upper()[:1]),
            'permite_fraccion': (str(e.get('permite_fraccion') or 'N').upper()[:1]),
        })

    if not rows:
        raise ValueError("Debe definir al menos un empaque")
    n_def = sum(1 for r in rows if r['por_defecto'] == 'S')
    n_rep = sum(1 for r in rows if r['para_reporte'] == 'S')
    if n_def == 0:
        rows[0]['por_defecto'] = 'S'
    elif n_def > 1:
        raise ValueError("Solo un empaque puede estar marcado como 'Por defecto'")
    if n_rep == 0:
        rows[0]['para_reporte'] = 'S'
    elif n_rep > 1:
        raise ValueError("Solo un empaque puede estar marcado como 'Para reporte'")

    with client.cursor() as cur:
        cur.execute("DELETE FROM INV.TINV_EMPAQUE WHERE no_produ = :1", [no_produ])
        for r in rows:
            cur.execute(
                "INSERT INTO INV.TINV_EMPAQUE("
                "no_produ, empaque, unidad, referencia, cpe, "
                "por_defecto, para_reporte, permite_fraccion"
                ") VALUES("
                ":no_produ, :empaque, :unidad, :referencia, :cpe, "
                ":por_defecto, :para_reporte, :permite_fraccion"
                ")",
                {'no_produ': no_produ, **r},
            )
        cur.connection.commit()
    return {'no_produ': no_produ, 'count': len(rows)}


def list_existencias(
    no_cia: str = '01',
    punto: str = '',
    almacen: str = '',
    no_produ: str = '',
    search: str = '',
    grupo: str = '',
    solo_con_existencia: bool = False,
    solo_sin_existencia: bool = False,
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
        # Match por descripción O código de producto.
        params.append(f'%{search}%')
        i = len(params)
        where_outer.append(
            f"(UPPER(p.descri) LIKE UPPER(:{i}) OR p.no_produ LIKE :{i})"
        )

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

    if solo_con_existencia:
        having_existencia = f"AND ({existencia_expr}) > 0"
    elif solo_sin_existencia:
        having_existencia = f"AND ({existencia_expr}) <= 0"
    else:
        having_existencia = ""

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
        + (f"{'AND' if outer_where else 'WHERE'} 1=1 {having_existencia} " if (solo_con_existencia or solo_sin_existencia) else "")
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
    # Misma regla que list_existencias (verificada 2026-05-28): almacén
    # "controlado" (ctrl_exist_min/max='S') → TINV_EPRODUCTO.exist_actual;
    # almacén no controlado (consignación/custodio) → SUM E−S de movimientos.
    # El ledger de movimientos del clon no tiene el histórico completo de
    # compras, por lo que en almacenes controlados daba negativos falsos
    # (caso producto 00006798 alm 01 → mostraba -37).
    exist_expr = (
        "CASE WHEN NVL(a.ctrl_exist_min,'N')='S' OR NVL(a.ctrl_exist_max,'N')='S' "
        "     THEN NVL(ep.exist_actual, 0) ELSE NVL(mov.net, 0) END"
    )
    fuente_expr = (
        "CASE WHEN NVL(a.ctrl_exist_min,'N')='S' OR NVL(a.ctrl_exist_max,'N')='S' "
        "     THEN 'eproducto' ELSE 'movimientos' END"
    )
    sql = (
        "SELECT a.no_cia, a.punto, a.almacen, a.descri almacen_desc, "
        "       :p_prod AS no_produ, p.descri descripcion, "
        f"       {exist_expr} AS existencia, "
        f"       {fuente_expr} AS fuente_existencia, "
        "       NVL(ep.costo_actual, 0) costo_actual, "
        f"       ROUND(({exist_expr}) * NVL(ep.costo_actual, 0), 2) valor, "
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
        # Solo almacenes con algún dato para este producto (snapshot o ledger),
        # redondeado a 6 decimales para evitar ruido de punto flotante.
        f"  AND ROUND({exist_expr}, 6) != 0 "
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
        f"SELECT q.tipo_docu, q.no_docu, q.punto, q.almacen, q.fecha, "
        f"       q.tipo_movi, q.tipo_transaccion, q.lineas, q.total, "
        f"       q.estado, q.st_anulado, "
        f"       td.descri desc_tipo_docu, "
        f"       al.descri desc_almacen, "
        f"       pt.descripcion desc_punto "
        f"FROM ("
        f"  SELECT t2.*, ROWNUM rn "
        f"  FROM ("
        f"    SELECT m.tipo_docu, m.no_docu, m.punto, m.almacen, "
        f"    TO_CHAR(MIN(m.fecha), 'YYYY-MM-DD') fecha, "
        f"    MIN(m.tipo_movi) tipo_movi, MIN(m.tipo_transaccion) tipo_transaccion, "
        f"    COUNT(*) lineas, SUM(NVL(m.monto_neto, 0)) total, "
        f"    MIN(NVL((SELECT h.estado FROM INV.TINV_RME h "
        f"             WHERE h.no_cia = m.no_cia AND h.punto = m.punto "
        f"             AND h.tipo_docu = m.tipo_docu AND h.no_docu = m.no_docu "
        f"             AND ROWNUM <= 1), 'A')) estado, "
        f"    MIN(NVL((SELECT h.st_anulado FROM INV.TINV_RME h "
        f"             WHERE h.no_cia = m.no_cia AND h.punto = m.punto "
        f"             AND h.tipo_docu = m.tipo_docu AND h.no_docu = m.no_docu "
        f"             AND ROWNUM <= 1), 'N')) st_anulado "
        f"    FROM INV.TINV_MOVIMIENTO m "
        f"    WHERE {' AND '.join(where)} "
        f"    GROUP BY m.no_cia, m.tipo_docu, m.no_docu, m.punto, m.almacen "
        f"    ORDER BY MIN(m.fecha) DESC, m.tipo_docu, m.no_docu"
        f"  ) t2 WHERE ROWNUM <= :{len(params)}"
        f") q "
        f"LEFT JOIN INV.TINV_TDOCU   td ON td.tipo_docu = q.tipo_docu "
        f"LEFT JOIN INV.TINV_ALMACEN al ON al.no_cia = :1 AND al.punto = q.punto AND al.almacen = q.almacen "
        f"LEFT JOIN INV.TINV_PUNTO   pt ON pt.no_cia = :1 AND pt.punto = q.punto"
    )
    return client.fetch_dicts(sql, params)


def get_documento_detalle(no_cia: str, tipo_docu: str, no_docu: str) -> dict | None:
    """Header (TINV_RME) + líneas (TINV_MOVIMIENTO) de un documento de inventario.

    Header rico desde TINV_RME con JOINs a proveedor / cliente / vendedor /
    localidad / tipo_docu para paridad con los forms Finv201..Finv214 del
    legado. Si no hay header en TINV_RME, intenta reconstruir uno mínimo desde
    TINV_MOVIMIENTO (compat con datos viejos sin header).
    """
    # Header from TINV_RME with lookups
    header_rows = client.fetch_dicts(
        "SELECT h.no_cia, h.punto, h.tipo_docu, h.no_docu, "
        "       TO_CHAR(h.fecha,'YYYY-MM-DD') fecha, "
        "       TO_CHAR(h.fecha_sysdate,'YYYY-MM-DD HH24:MI') fecha_sysdate, "
        "       h.no_cliente, h.vendedor, h.afecta_cxc, h.no_proveedor, "
        "       h.tipo_refe, h.no_refe, h.tasa_us, h.porc_impuesto, "
        "       h.impuesto, h.descuento, h.total_linea, h.total_neto, "
        "       h.estado, h.usuario, h.conduce, h.st_generado_cnt, "
        "       h.st_impresion, h.st_anulado, h.tipo_transaccion, h.tipo_movi, "
        "       h.detalle, h.no_localidad, h.no_componente, h.no_depto, "
        "       h.orden_produccion, h.posiciones_fijas_ncf, h.ncf, "
        "       h.tipo_docu_devuelto, h.no_docu_devuelto, h.nota, "
        "       h.valor_bienes, h.valor_servicio, h.isc, h.otros_impuestos, "
        "       h.propina, h.zona, h.entregado, "
        "       TO_CHAR(h.fecha_entrega,'YYYY-MM-DD') fecha_entrega, "
        "       h.usuario_entrego, h.no_motivo, "
        "       h.granulometria, h.viscosidad, h.peso1, h.peso2, "
        "       h.no_orden_ot, h.tipo_orden_op, h.con_restock_almacen, "
        "       h.tipo_docu_rev, h.no_docu_rev, "
        "       td.descri td_descri, td.tipo_movi td_tipo_movi, "
        "       td.tipo_transaccion td_tipo_transaccion, "
        "       p.nombre prov_nombre, p.rnc prov_rnc, "
        "       c.nombre cli_nombre, c.rnc cli_rnc, c.direccion cli_direccion, "
        "       v.nombre vend_nombre, "
        "       loc.descripcion loc_descripcion, "
        "       pt.descripcion punto_descripcion, "
        "       CASE WHEN h.posiciones_fijas_ncf IS NOT NULL AND h.ncf IS NOT NULL "
        "            THEN h.posiciones_fijas_ncf || LPAD(TO_CHAR(h.ncf),8,'0') "
        "            ELSE NULL END ncf_dgi "
        "FROM INV.TINV_RME h "
        "LEFT JOIN INV.TINV_TDOCU td ON td.tipo_docu = h.tipo_docu "
        "LEFT JOIN CXP.TCXP_DPROVEEDOR p ON p.no_proveedor = h.no_proveedor "
        "LEFT JOIN CXC.TCXC_CLIENTE c ON c.no_cia = h.no_cia AND c.punto = h.punto AND c.no_cliente = h.no_cliente "
        "LEFT JOIN CXC.TCXC_VENDEDOR v ON v.no_cia = h.no_cia AND v.vendedor = h.vendedor "
        "LEFT JOIN CNT.TCNT_LOCALIDADES loc ON loc.no_localidad = h.no_localidad "
        "LEFT JOIN INV.TINV_PUNTO pt ON pt.no_cia = h.no_cia AND pt.punto = h.punto "
        "WHERE h.no_cia = :1 AND h.tipo_docu = :2 AND h.no_docu = :3 "
        "AND ROWNUM <= 1",
        [no_cia, tipo_docu, no_docu],
    )

    # Lines from TINV_MOVIMIENTO with empaque/unidad info
    lines = client.fetch_dicts(
        "SELECT m.no_linea, m.almacen, m.no_produ, p.descri descripcion, "
        "m.tipo_movi, m.tipo_transaccion, m.empaque, "
        "NVL(m.cpe, 1) cpe, NVL(u.descri, '') unidad, "
        "NVL(m.cantidad, 0) cantidad, NVL(m.costo, 0) costo, "
        "NVL(m.precio, 0) precio, NVL(m.monto_neto, 0) monto_neto, "
        "NVL(m.impuesto, 0) impuesto, NVL(m.descuento, 0) descuento, "
        "TO_CHAR(m.fecha, 'YYYY-MM-DD') fecha, m.punto, m.no_lote, "
        "m.tipo_refe ref_tipo, m.no_refe ref_no "
        "FROM INV.TINV_MOVIMIENTO m "
        "LEFT JOIN INV.TINV_PRODUCTO p ON p.no_produ = m.no_produ "
        "LEFT JOIN INV.TINV_EMPAQUE e ON e.no_produ = m.no_produ AND e.empaque = m.empaque "
        "LEFT JOIN INV.TINV_UNIDAD u ON u.unidad = e.unidad "
        "WHERE m.no_cia = :1 AND m.tipo_docu = :2 AND m.no_docu = :3 "
        "ORDER BY m.no_linea",
        [no_cia, tipo_docu, no_docu],
    )

    if not lines and not header_rows:
        return None

    if header_rows:
        h = header_rows[0]
        # Normalize keys (oracledb returns lowercase)
        def g(k, d=None):
            return h.get(k.lower(), h.get(k.upper(), d))
        header = {
            'no_cia': g('no_cia', no_cia),
            'punto': g('punto', ''),
            'tipo_docu': g('tipo_docu', tipo_docu),
            'no_docu': g('no_docu', no_docu),
            'tipo_docu_descri': g('td_descri', ''),
            'fecha': g('fecha', ''),
            'fecha_sysdate': g('fecha_sysdate', ''),
            'tipo_movi': g('tipo_movi', ''),
            'tipo_transaccion': g('tipo_transaccion', ''),
            'estado': g('estado', ''),
            'st_anulado': g('st_anulado', 'N'),
            'st_impresion': g('st_impresion', 'N'),
            'st_generado_cnt': g('st_generado_cnt', 'N'),
            'usuario': g('usuario', ''),
            'conduce': g('conduce', ''),
            'afecta_cxc': g('afecta_cxc', 'N'),
            # Proveedor
            'no_proveedor': g('no_proveedor', ''),
            'proveedor_nombre': g('prov_nombre', ''),
            'proveedor_rnc': g('prov_rnc', ''),
            # Cliente
            'no_cliente': g('no_cliente', ''),
            'cliente_nombre': g('cli_nombre', ''),
            'cliente_rnc': g('cli_rnc', ''),
            'cliente_direccion': g('cli_direccion', ''),
            # Vendedor
            'vendedor': g('vendedor', ''),
            'vendedor_nombre': g('vend_nombre', ''),
            # Localidad / contabilidad
            'no_localidad': g('no_localidad', ''),
            'localidad_descripcion': g('loc_descripcion', ''),
            'punto_descripcion': g('punto_descripcion', ''),
            'no_componente': g('no_componente', ''),
            'no_depto': g('no_depto', ''),
            # Referencia / devolución / reverso
            'tipo_refe': g('tipo_refe', ''),
            'no_refe': g('no_refe', ''),
            'tipo_docu_devuelto': g('tipo_docu_devuelto', ''),
            'no_docu_devuelto': g('no_docu_devuelto', ''),
            'tipo_docu_rev': g('tipo_docu_rev', ''),
            'no_docu_rev': g('no_docu_rev', ''),
            'no_motivo': g('no_motivo', ''),
            # NCF
            'posiciones_fijas_ncf': g('posiciones_fijas_ncf', ''),
            'ncf': g('ncf', ''),
            'ncf_dgi': g('ncf_dgi', ''),
            # Totales
            'tasa_us': float(g('tasa_us', 0) or 0),
            'porc_impuesto': float(g('porc_impuesto', 0) or 0),
            'impuesto': float(g('impuesto', 0) or 0),
            'descuento': float(g('descuento', 0) or 0),
            'total_linea': float(g('total_linea', 0) or 0),
            'total_neto': float(g('total_neto', 0) or 0),
            'valor_bienes': float(g('valor_bienes', 0) or 0),
            'valor_servicio': float(g('valor_servicio', 0) or 0),
            'isc': float(g('isc', 0) or 0),
            'otros_impuestos': float(g('otros_impuestos', 0) or 0),
            'propina': float(g('propina', 0) or 0),
            # Detalle / nota
            'detalle': g('detalle', ''),
            'nota': g('nota', ''),
            # Otros
            'zona': g('zona', ''),
            'entregado': g('entregado', 'N'),
            'fecha_entrega': g('fecha_entrega', ''),
            'usuario_entrego': g('usuario_entrego', ''),
            'orden_produccion': g('orden_produccion', ''),
            'no_orden_ot': g('no_orden_ot', ''),
            'tipo_orden_op': g('tipo_orden_op', ''),
            'con_restock_almacen': g('con_restock_almacen', 'N'),
            # Producción (Finv204): granulometría, viscosidad, pesos
            'granulometria': float(g('granulometria', 0) or 0),
            'viscosidad': float(g('viscosidad', 0) or 0),
            'peso1': float(g('peso1', 0) or 0),
            'peso2': float(g('peso2', 0) or 0),
            # Compat con código viejo
            'almacen': lines[0].get('almacen', lines[0].get('ALMACEN', '')) if lines else '',
            'total': float(g('total_neto', 0) or 0)
                or sum(float(r.get('monto_neto', r.get('MONTO_NETO', 0)) or 0) for r in lines),
        }
    else:
        # Sin header en TINV_RME - reconstruir mínimo desde primera línea
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
            'st_anulado': 'N',
            'total': sum(
                float(r.get('MONTO_NETO', r.get('monto_neto', 0)) or 0)
                for r in lines
            ),
        }

    # Resolver descripción de almacén (desde el almacén del header o primera línea)
    alm_code = header.get('almacen') or ''
    pt_code = header.get('punto') or ''
    if alm_code and pt_code and not header.get('almacen_descripcion'):
        alm_rows = client.fetch_dicts(
            "SELECT descri FROM INV.TINV_ALMACEN "
            "WHERE no_cia = :1 AND punto = :2 AND almacen = :3 AND ROWNUM <= 1",
            [no_cia, pt_code, alm_code],
        )
        if alm_rows:
            header['almacen_descripcion'] = (
                alm_rows[0].get('descri') or alm_rows[0].get('DESCRI') or ''
            )
        else:
            header['almacen_descripcion'] = ''
    else:
        header.setdefault('almacen_descripcion', '')

    # Fallback descripción de punto si vino sin header en TINV_RME
    if pt_code and not header.get('punto_descripcion'):
        pt_rows = client.fetch_dicts(
            "SELECT descripcion FROM INV.TINV_PUNTO "
            "WHERE no_cia = :1 AND punto = :2 AND ROWNUM <= 1",
            [no_cia, pt_code],
        )
        if pt_rows:
            header['punto_descripcion'] = (
                pt_rows[0].get('descripcion') or pt_rows[0].get('DESCRIPCION') or ''
            )

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
        where.append(f"TRUNC(m.fecha) >= TO_DATE(:{len(params)}, 'YYYY-MM-DD')")
    if hasta:
        params.append(hasta)
        where.append(f"TRUNC(m.fecha) <= TO_DATE(:{len(params)}, 'YYYY-MM-DD')")

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
                        client.nbinds(
                            no_cia_r, punto_r, tipo_docu, no_docu,
                            almacen_r, no_produ_r, tipo_movi,
                            cantidad, costo, empaque, cpe, usuario[:30],
                            round(cantidad * costo, 2)),
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


# ─── Movimientos de Inventario (procesos diarios) ────────────────────────────
# Soporta los tipos operativos del legado: EA, SA, EC, DC, DV, EP, SP, TA, AE,
# AS. Cada inserción persiste una fila en INV.TINV_MOVIMIENTO con todos los
# NOT NULL cubiertos (empaque/cpe se resuelven contra INV.TINV_EMPAQUE) y
# avanza la secuencia INV.TINV_SECUENCIA. NO toca contabilidad: cada documento
# queda disponible para que el cierre/generación contable lo procese aparte.

def _next_inv_seq(cur, no_cia: str, punto: str, tipo_docu: str) -> str:
    """Obtiene y avanza la secuencia INV para el tipo_docu. Devuelve no_docu(7).

    Resuelve el caso en que TINV_SECUENCIA queda atras del valor maximo real
    en TINV_MOVIMIENTO (frecuente en datos migrados): se usa el max(prox, real+1).
    """
    cur.execute(
        "SELECT NVL(prox_documento, 1) FROM INV.TINV_SECUENCIA "
        "WHERE no_cia=:1 AND punto=:2 AND tipo_docu=:3 FOR UPDATE",
        [no_cia, punto, tipo_docu])
    row = cur.fetchone()
    if not row:
        cur.execute(
            "INSERT INTO INV.TINV_SECUENCIA(no_cia,punto,tipo_docu,prox_documento) "
            "VALUES(:1,:2,:3,1)",
            [no_cia, punto, tipo_docu])
        prox = 1
    else:
        prox = int(row[0] or 1)
    # Defensivo: si en TINV_MOVIMIENTO ya existe no_docu >= prox, saltamos al max+1
    cur.execute(
        "SELECT NVL(MAX(TO_NUMBER(no_docu)), 0) FROM INV.TINV_MOVIMIENTO "
        "WHERE no_cia=:1 AND punto=:2 AND tipo_docu=:3 "
        "  AND REGEXP_LIKE(no_docu, '^[0-9]+$')",
        [no_cia, punto, tipo_docu])
    max_row = cur.fetchone()
    real_max = int(max_row[0] or 0) if max_row else 0
    if real_max >= prox:
        prox = real_max + 1
    cur.execute(
        "UPDATE INV.TINV_SECUENCIA SET prox_documento=:1 "
        "WHERE no_cia=:2 AND punto=:3 AND tipo_docu=:4",
        [prox + 1, no_cia, punto, tipo_docu])
    return str(prox).zfill(7)


def _empaque_cpe(cur, no_produ: str) -> tuple[int, int]:
    """Empaque/CPE por defecto desde TINV_EMPAQUE."""
    cur.execute(
        "SELECT empaque, NVL(cpe, 1) FROM INV.TINV_EMPAQUE "
        "WHERE no_produ=:1 "
        "ORDER BY CASE WHEN NVL(por_defecto,'N')='S' THEN 0 ELSE 1 END, empaque",
        [no_produ])
    row = cur.fetchone()
    if row:
        return int(row[0] or 1), int(row[1] or 1)
    return 1, 1


def _tipo_movi_for(cur, tipo_docu: str) -> tuple[str, str]:
    """Devuelve (tipo_movi, tipo_transaccion) leyendo TINV_TDOCU."""
    cur.execute(
        "SELECT tipo_movi, tipo_transaccion FROM INV.TINV_TDOCU WHERE tipo_docu=:1",
        [tipo_docu])
    row = cur.fetchone()
    if not row:
        raise ValueError(f"Tipo de documento '{tipo_docu}' no esta configurado en INV.TINV_TDOCU")
    return (row[0] or 'E').strip().upper(), (row[1] or 'J').strip().upper()


def _insert_movimiento(cur, *, no_cia, punto, tipo_docu, no_docu, no_linea,
                       almacen, no_produ, tipo_movi, tipo_transaccion,
                       fecha, cantidad, precio, costo, empaque, cpe,
                       usuario, tipo_refe='', no_refe=''):
    """INSERT directo a INV.TINV_MOVIMIENTO con todos los NOT NULL cubiertos."""
    cur.execute(
        "INSERT INTO INV.TINV_MOVIMIENTO("
        "  no_cia, punto, tipo_docu, no_docu, no_linea,"
        "  almacen, no_produ, tipo_movi, tipo_transaccion, servicio,"
        "  fecha, cantidad, precio, costo,"
        "  st_anulado, empaque, cpe, usuario, monto_neto,"
        "  no_localidad, fecha_sysdate, aumento_cxc,"
        "  tipo_refe, no_refe"
        ") VALUES("
        "  :1, :2, :3, :4, :5,"
        "  :6, :7, :8, :9, 'I',"
        "  TO_DATE(:10,'YYYY-MM-DD'), :11, :12, :13,"
        "  'N', :14, :15, :16, :17,"
        "  :18, SYSDATE, 0,"
        "  :19, :20)",
        [no_cia, punto, tipo_docu, no_docu, no_linea,
         almacen, no_produ, tipo_movi, tipo_transaccion,
         fecha, cantidad, precio, costo,
         empaque, cpe, (usuario or '')[:30],
         round((cantidad or 0) * (costo or 0), 2),
         no_cia, tipo_refe, no_refe])


def _adjust_eproducto_stock(cur, *, no_cia, punto, almacen, no_produ,
                            tipo_movi, cantidad):
    """Mantiene sincronizada la existencia que consume el Forms legado."""
    delta = float(cantidad or 0)
    if (tipo_movi or '').upper() == 'S':
        delta = -delta
    cur.execute(
        "UPDATE INV.TINV_EPRODUCTO "
        "SET exist_actual = NVL(exist_actual, 0) + :1 "
        "WHERE no_cia=:2 AND punto=:3 AND almacen=:4 AND no_produ=:5",
        [delta, no_cia, punto, almacen, no_produ])
    if cur.rowcount == 0:
        raise ValueError(
            f"Producto {no_produ} no esta asignado al almacen {almacen}")


def _upsert_rme_header(cur, *, no_cia, punto, tipo_docu, no_docu, fecha,
                       tipo_movi, tipo_transaccion, usuario, nota,
                       total_linea):
    # Binds numerados repetidos (:2,:2 / :11,:11) + lista posicional dan
    # ORA-01008 en modo thick — estos dos statements usan binds nombrados.
    cur.execute(
        "UPDATE INV.TINV_RME SET nota=:nota, total_linea=:total, "
        "total_neto=:total, valor_bienes=:total, usuario=:usuario "
        "WHERE no_cia=:no_cia AND punto=:punto AND tipo_docu=:tipo_docu "
        "AND no_docu=:no_docu",
        {'nota': nota[:4000], 'total': total_linea,
         'usuario': (usuario or '')[:30], 'no_cia': no_cia, 'punto': punto,
         'tipo_docu': tipo_docu, 'no_docu': no_docu})
    if cur.rowcount:
        return
    cur.execute(
        "INSERT INTO INV.TINV_RME("
        "no_cia,punto,tipo_docu,no_docu,fecha,fecha_sysdate,"
        "estado,usuario,st_impresion,st_anulado,st_generado_cnt,"
        "tipo_transaccion,tipo_movi,detalle,nota,no_localidad,afecta_cxc,"
        "tasa_us,porc_impuesto,impuesto,descuento,total_linea,total_neto,"
        "valor_bienes,valor_servicio,isc,otros_impuestos,propina,entregado"
        ") VALUES("
        ":no_cia,:punto,:tipo_docu,:no_docu,TO_DATE(:fecha,'YYYY-MM-DD'),SYSDATE,"
        "'A',:usuario,'N','N','N',"
        ":tipo_transaccion,:tipo_movi,'',:nota,:no_localidad,'N',"
        "1,0,0,0,:total,:total,"
        ":total,0,0,0,0,'N'"
        ")",
        {'no_cia': no_cia, 'punto': punto, 'tipo_docu': tipo_docu,
         'no_docu': no_docu, 'fecha': fecha, 'usuario': (usuario or '')[:30],
         'tipo_transaccion': tipo_transaccion, 'tipo_movi': tipo_movi,
         'nota': nota[:4000], 'no_localidad': no_cia, 'total': total_linea})


def create_movimiento_documento(*, no_cia: str, punto: str, tipo_docu: str,
                                 fecha: str, almacen: str, lineas: list[dict],
                                 almacen_destino: str = '', usuario: str = 'API',
                                 cuenta_contable: str = '', departamento: str = '',
                                 nota: str = '') -> dict:
    """Crea un documento de inventario con N lineas.

    Soporta los 10 tipos del legado:
    - EA, EC, EP, DV, AE: entradas (tipo_movi='E')
    - SA, SP, DC, AS: salidas (tipo_movi='S')
    - TA: transferencia (1 salida del almacen origen + 1 entrada al destino)

    `lineas` lista de dicts {no_produ, cantidad, costo (opcional), precio (opcional)}.
    Si `costo` no se provee, se lee TINV_EPRODUCTO.costo_actual del almacen.
    """
    tipo_docu = (tipo_docu or '').strip().upper()
    nota = (nota or '').strip()
    if not tipo_docu:
        raise ValueError("tipo_docu requerido")
    if not lineas:
        raise ValueError("Se requiere al menos una linea de detalle")

    with client.cursor() as cur:
        tipo_movi_cfg, tipo_transaccion = _tipo_movi_for(cur, tipo_docu)
        es_transferencia = tipo_docu == 'TA'
        if es_transferencia and not almacen_destino:
            raise ValueError("Transferencia requiere almacen_destino")
        # En transferencias la primera linea es SALIDA del almacen origen,
        # y la contraparte es ENTRADA al almacen destino.
        tipo_movi = 'S' if es_transferencia else tipo_movi_cfg

        no_docu = _next_inv_seq(cur, no_cia, punto, tipo_docu)
        creadas = 0
        total_documento = 0.0
        for idx, lin in enumerate(lineas, start=1):
            no_produ = (lin.get('no_produ') or '').strip().upper()
            if not no_produ:
                raise ValueError(f"Linea {idx}: no_produ requerido")
            almacen_origen = (lin.get('almacen') or almacen or '').strip()
            if not almacen_origen:
                raise ValueError(f"Linea {idx}: almacen requerido")
            cantidad = float(lin.get('cantidad') or 0)
            if cantidad <= 0:
                raise ValueError(f"Linea {idx}: cantidad debe ser > 0")
            precio = float(lin.get('precio') or lin.get('costo') or 0)
            costo_in = lin.get('costo')
            if costo_in in (None, '', 0):
                cur.execute(
                    "SELECT NVL(costo_actual, 0) FROM INV.TINV_EPRODUCTO "
                    "WHERE no_cia=:1 AND punto=:2 AND almacen=:3 AND no_produ=:4",
                    [no_cia, punto, almacen_origen, no_produ])
                ep_row = cur.fetchone()
                costo = float(ep_row[0]) if ep_row else 0.0
            else:
                costo = float(costo_in)
            if not precio:
                precio = costo
            empaque, cpe = _empaque_cpe(cur, no_produ)
            total_documento += round(cantidad * costo, 2)

            _insert_movimiento(
                cur, no_cia=no_cia, punto=punto, tipo_docu=tipo_docu,
                no_docu=no_docu, no_linea=idx,
                almacen=almacen_origen, no_produ=no_produ,
                tipo_movi=tipo_movi, tipo_transaccion=tipo_transaccion,
                fecha=fecha, cantidad=cantidad, precio=precio, costo=costo,
                empaque=empaque, cpe=cpe, usuario=usuario)
            _adjust_eproducto_stock(
                cur, no_cia=no_cia, punto=punto, almacen=almacen_origen,
                no_produ=no_produ, tipo_movi=tipo_movi, cantidad=cantidad)
            creadas += 1

            if es_transferencia:
                # Movimiento contraparte de entrada al almacen destino.
                # NO_LINEA es NUMBER(3) -> usamos offset 500 para evitar colision.
                if idx > 499:
                    raise ValueError("Transferencia con mas de 499 lineas no soportada")
                _insert_movimiento(
                    cur, no_cia=no_cia, punto=punto, tipo_docu=tipo_docu,
                    no_docu=no_docu, no_linea=idx + 500,
                    almacen=(lin.get('almacen_destino') or almacen_destino).strip(),
                    no_produ=no_produ,
                    tipo_movi='E', tipo_transaccion=tipo_transaccion,
                    fecha=fecha, cantidad=cantidad, precio=precio, costo=costo,
                    empaque=empaque, cpe=cpe, usuario=usuario,
                    tipo_refe=tipo_docu, no_refe=no_docu)
                _adjust_eproducto_stock(
                    cur, no_cia=no_cia, punto=punto,
                    almacen=(lin.get('almacen_destino') or almacen_destino).strip(),
                    no_produ=no_produ, tipo_movi='E', cantidad=cantidad)
                creadas += 1
        _upsert_rme_header(
            cur, no_cia=no_cia, punto=punto, tipo_docu=tipo_docu,
            no_docu=no_docu, fecha=fecha, tipo_movi=tipo_movi,
            tipo_transaccion=tipo_transaccion, usuario=usuario, nota=nota,
            total_linea=total_documento)
        cur.connection.commit()

    return {
        'no_cia': no_cia, 'punto': punto, 'tipo_docu': tipo_docu,
        'no_docu': no_docu, 'lineas_creadas': creadas,
        'tipo_movi': tipo_movi, 'fecha': fecha, 'nota': nota,
    }


def reversar_documento_inv(*, no_cia: str, punto: str, tipo_docu: str,
                            no_docu: str, motivo: str = '',
                            usuario: str = 'API') -> dict:
    """Reversa un documento INV creando movimiento(s) AF que compensan.

    Patron legacy: el movimiento original conserva sus datos pero se marca
    st_anulado='S'; se inserta un movimiento AF con tipo_movi opuesto y los
    campos tipo_refe / no_refe apuntan al documento original. La existencia
    (sum(E)-sum(S) sobre st_anulado!='S' + AF entries) refleja la reversion.
    """
    tipo_docu = (tipo_docu or '').strip().upper()
    no_docu = (no_docu or '').strip()
    # Acepta el numero con o sin padding — la columna NO_DOCU es VARCHAR2(7) y
    # legacy guarda con LPAD(0,7). Si entran solo digitos los normalizamos.
    if no_docu.isdigit():
        no_docu = no_docu.zfill(7)
    with client.cursor() as cur:
        cur.execute(
            "SELECT no_linea, almacen, no_produ, cantidad, precio, costo,"
            "       tipo_movi, tipo_transaccion, empaque, cpe, "
            "       NVL(st_anulado,'N') "
            "FROM INV.TINV_MOVIMIENTO "
            "WHERE no_cia=:1 AND punto=:2 AND tipo_docu=:3 AND no_docu=:4 "
            "ORDER BY no_linea FOR UPDATE",
            [no_cia, punto, tipo_docu, no_docu])
        rows = cur.fetchall()
        if not rows:
            raise ValueError(f"Documento {tipo_docu}-{no_docu} no encontrado")
        if all((r[10] or 'N') == 'S' for r in rows):
            raise ValueError(f"Documento {tipo_docu}-{no_docu} ya esta anulado")

        cur.execute(
            "UPDATE INV.TINV_MOVIMIENTO SET st_anulado='S' "
            "WHERE no_cia=:1 AND punto=:2 AND tipo_docu=:3 AND no_docu=:4",
            [no_cia, punto, tipo_docu, no_docu])

        no_af = _next_inv_seq(cur, no_cia, punto, 'AF')
        for r in rows:
            no_linea, almacen_o, no_produ_o, cant, precio, costo, tm, tr, emp, cpe, _ = r
            tipo_opuesto = 'E' if (tm or '').upper() == 'S' else 'S'
            _insert_movimiento(
                cur, no_cia=no_cia, punto=punto, tipo_docu='AF', no_docu=no_af,
                no_linea=no_linea, almacen=almacen_o, no_produ=no_produ_o,
                tipo_movi=tipo_opuesto, tipo_transaccion=tr or 'J',
                fecha=__import__('datetime').date.today().isoformat(),
                cantidad=float(cant or 0), precio=float(precio or 0),
                costo=float(costo or 0),
                empaque=int(emp or 1), cpe=int(cpe or 1),
                usuario=usuario, tipo_refe=tipo_docu, no_refe=no_docu)
            _adjust_eproducto_stock(
                cur, no_cia=no_cia, punto=punto, almacen=almacen_o,
                no_produ=no_produ_o, tipo_movi=tipo_opuesto,
                cantidad=float(cant or 0))
        cur.connection.commit()

    return {
        'tipo_docu': tipo_docu, 'no_docu': no_docu,
        'tipo_anula': 'AF', 'no_anula': no_af, 'motivo': motivo,
        'lineas_reversadas': len(rows),
    }

