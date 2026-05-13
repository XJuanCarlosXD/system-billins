from .. import client


def get_config(no_cia: str):
    rows = client.fetch_dicts(
        "SELECT no_cia, descripcion FROM CNT.TCNT_CIAS WHERE no_cia=:1",
        [no_cia]
    )
    cia = rows[0] if rows else {}
    puntos = client.fetch_dicts(
        "SELECT punto, descripcion, ano_proceso, mes_proceso FROM CNT.TCNT_PUNTO WHERE no_cia=:1",
        [no_cia]
    )
    return {"cia": cia, "puntos": puntos}


def list_catalogo(search=None, tipo=None, clase=None, activa=None):
    sql = """
        SELECT c.cuenta, c.nombre AS descripcion, c.tipo, c.clase,
               c.acepta_movi AS acepta_movimiento, c.activa,
               t.descripcion AS tipo_desc
        FROM CNT.TCNT_CATALOGO c
        LEFT JOIN CNT.TCNT_TCUENTA t ON t.tipo = c.tipo
        WHERE 1=1
    """
    params = []
    if search:
        sql += " AND (UPPER(c.cuenta) LIKE UPPER(:s) OR UPPER(c.nombre) LIKE UPPER(:s))"
        params.append(f"%{search}%")
    if tipo is not None:
        sql += " AND c.tipo = :t"
        params.append(tipo)
    if clase:
        sql += " AND UPPER(c.clase) = UPPER(:cl)"
        params.append(clase)
    if activa is not None:
        val = 'S' if activa else 'N'
        sql += " AND c.activa = :ac"
        params.append(val)
    sql += " ORDER BY c.cuenta"
    return client.fetch_dicts(sql, params)


def get_cuenta(cuenta: str):
    rows = client.fetch_dicts(
        """SELECT c.cuenta, c.nombre AS descripcion, c.tipo, c.clase, c.acepta_movi AS acepta_movimiento, c.activa, t.descripcion AS tipo_desc
           FROM CNT.TCNT_CATALOGO c
           LEFT JOIN CNT.TCNT_TCUENTA t ON t.tipo = c.tipo
           WHERE c.cuenta = :1""",
        [cuenta]
    )
    return rows[0] if rows else None


def create_cuenta(cuenta, descripcion, tipo, clase, acepta_movimiento='S', activa='S'):
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO CNT.TCNT_CATALOGO
               (cuenta, nombre, tipo, clase, acepta_movi, activa)
               VALUES (:1,:2,:3,:4,:5,:6)""",
            [cuenta, descripcion, tipo, clase, acepta_movimiento, activa]
        )
        conn.commit()


def update_cuenta(cuenta, **kwargs):
    if not kwargs:
        return
    allowed = {'nombre', 'tipo', 'clase', 'acepta_movi', 'activa'}
    sets = []
    params = []
    for k, v in kwargs.items():
        if k in allowed:
            sets.append(f"{k.upper()}=:{len(params)+1}")
            params.append(v)
    if not sets:
        return
    params.append(cuenta)
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE CNT.TCNT_CATALOGO SET {','.join(sets)} WHERE cuenta=:{len(params)}",
            params
        )
        conn.commit()


def list_tcuenta():
    return client.fetch_dicts(
        "SELECT tipo, descripcion, clase FROM CNT.TCNT_TCUENTA ORDER BY tipo"
    )


def list_centros_costo(no_cia: str):
    return client.fetch_dicts(
        "SELECT centro_costo, descripcion, activo FROM CNT.TCNT_CENTRO_COSTO ORDER BY centro_costo"
    )


def list_periodos(no_cia: str):
    puntos = client.fetch_dicts(
        "SELECT punto, ano_proceso, mes_proceso FROM CNT.TCNT_PUNTO WHERE no_cia=:1 ORDER BY punto",
        [no_cia]
    )
    cierres = client.fetch_dicts(
        "SELECT punto, ano, mes, fecha_cierre FROM CNT.TCNT_CIERRE WHERE no_cia=:1 ORDER BY ano, mes",
        [no_cia]
    )
    rangos = {
        'cierres': client.fetch_dicts(
            "SELECT MIN(ano) AS min_ano, MAX(ano) AS max_ano, COUNT(*) AS total FROM CNT.TCNT_CIERRE WHERE no_cia=:1",
            [no_cia]
        )[0],
        'hcuenta': client.fetch_dicts(
            "SELECT MIN(ano) AS min_ano, MAX(ano) AS max_ano, COUNT(*) AS total FROM CNT.TCNT_HCUENTA WHERE no_cia=:1",
            [no_cia]
        )[0],
        'asientos': client.fetch_dicts(
            "SELECT MIN(ano) AS min_ano, MAX(ano) AS max_ano, COUNT(*) AS total FROM CNT.TCNT_ASIENTO WHERE no_cia=:1",
            [no_cia]
        )[0],
    }
    year_rows = client.fetch_dicts(
        """
        SELECT ano FROM (
            SELECT DISTINCT ano FROM CNT.TCNT_CIERRE WHERE no_cia=:1
            UNION
            SELECT DISTINCT ano FROM CNT.TCNT_HCUENTA WHERE no_cia=:1
            UNION
            SELECT DISTINCT ano FROM CNT.TCNT_ASIENTO WHERE no_cia=:1
        )
        ORDER BY ano DESC
        """,
        [no_cia]
    )
    years = [row['ano'] for row in year_rows if row.get('ano') is not None]
    return {"puntos": puntos, "cierres": cierres, "rangos": rangos, "years": years}


def list_ncf(no_cia: str):
    rows = client.fetch_dicts(
        """SELECT codigo_ncf, ncf_inicial, ncf_final, prox_ncf,
                  ncf_manual, tipo_ncf_fiscal, cant_min_ncf, fecha_vencimiento
           FROM CNT.TCNT_NCF
           ORDER BY codigo_ncf""",
        []
    )
    result = []
    for r in rows:
        disponibles = (r.get('ncf_final') or 0) - (r.get('prox_ncf') or 1) + 1
        cant_min = r.get('cant_min_ncf') or 50
        r['disponibles'] = disponibles
        r['low_stock'] = disponibles <= cant_min
        r['critical'] = disponibles <= max(cant_min // 2, 1)
        result.append(r)
    return result


def update_ncf(no_cia: str, codigo_ncf: str, **kwargs):
    allowed = {'ncf_final', 'cant_min_ncf', 'fecha_vencimiento', 'ncf_manual'}
    sets = []
    params = []
    for k, v in kwargs.items():
        if k in allowed:
            sets.append(f"{k.upper()}=:{len(params)+1}")
            params.append(v)
    if not sets:
        return
    params.append(codigo_ncf)
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE CNT.TCNT_NCF SET {','.join(sets)} WHERE codigo_ncf=:{len(params)}",
            params
        )
        conn.commit()


def _get_next_asiento_no(cur, no_cia, punto, ano, mes):
    cur.execute(
        """SELECT prox_asiento FROM CNT.TCNT_SECUENCIA
           WHERE no_cia=:1 AND punto=:2 AND ano=:3 AND mes=:4
           FOR UPDATE""",
        [no_cia, punto, ano, mes]
    )
    row = cur.fetchone()
    if row:
        no_asiento = row[0]
        cur.execute(
            """UPDATE CNT.TCNT_SECUENCIA SET prox_asiento=prox_asiento+1
               WHERE no_cia=:1 AND punto=:2 AND ano=:3 AND mes=:4""",
            [no_cia, punto, ano, mes]
        )
    else:
        no_asiento = 1
        cur.execute(
            """INSERT INTO CNT.TCNT_SECUENCIA (no_cia,punto,ano,mes,prox_asiento)
               VALUES (:1,:2,:3,:4,2)""",
            [no_cia, punto, ano, mes]
        )
    return no_asiento


def list_asientos(no_cia, punto, ano, mes, page=1, page_size=50,
                  search=None, autorizado=None, actualizado=None, anulado=None):
    filters = ["no_cia=:no_cia", "punto=:punto", "ano=:ano", "mes=:mes"]
    params = {"no_cia": no_cia, "punto": punto, "ano": int(ano), "mes": int(mes)}
    if autorizado is not None:
        filters.append("AUTORIZADO=:aut")
        params["aut"] = 'S' if autorizado else 'N'
    if actualizado is not None:
        filters.append("ACTUALIZADO=:act")
        params["act"] = 'S' if actualizado else 'N'
    if anulado is not None:
        filters.append("ST_ANULADO=:anu")
        params["anu"] = 'S' if anulado else 'N'
    if search:
        filters.append("UPPER(DETALLE) LIKE UPPER(:srch)")
        params["srch"] = f"%{search}%"
    where = " AND ".join(filters)
    count_row = client.fetch_dicts(
        f"SELECT COUNT(*) AS TOTAL FROM CNT.TCNT_ASIENTO WHERE {where}", params
    )
    total = count_row[0]['total'] if count_row else 0
    offset = (page - 1) * page_size
    params["end_row"] = offset + page_size
    params["start_row"] = offset
    sql = f"""
        SELECT * FROM (
            SELECT a.*, ROWNUM rn FROM (
                SELECT no_asiento, fecha, detalle, autorizado, actualizado,
                       st_anulado, debitos, creditos
                FROM CNT.TCNT_ASIENTO
                WHERE {where}
                ORDER BY no_asiento DESC
            ) a WHERE ROWNUM <= :end_row
        ) WHERE rn > :start_row
    """
    rows = client.fetch_dicts(sql, params)
    return {"total": total, "page": page, "page_size": page_size, "items": rows}


def get_asiento(no_cia, punto, ano, mes, no_asiento):
    headers = client.fetch_dicts(
        """SELECT * FROM CNT.TCNT_ASIENTO
           WHERE no_cia=:1 AND punto=:2 AND ano=:3 AND mes=:4 AND no_asiento=:5""",
        [no_cia, punto, int(ano), int(mes), int(no_asiento)]
    )
    if not headers:
        return None
    lines = client.fetch_dicts(
        """SELECT l.no_linea, l.cuenta, l.centro_costo, l.tipo_movi, l.monto, l.monto_us,
                  c.nombre AS cuenta_desc
           FROM CNT.TCNT_ASIENTOL l
           LEFT JOIN CNT.TCNT_CATALOGO c ON c.cuenta = l.cuenta
           WHERE l.no_cia=:1 AND l.punto=:2 AND l.ano=:3 AND l.mes=:4 AND l.no_asiento=:5
           ORDER BY l.no_linea""",
        [no_cia, punto, int(ano), int(mes), int(no_asiento)]
    )
    result = dict(headers[0])
    result['lineas'] = lines
    return result


def create_asiento(usuario, no_cia, punto, ano, mes, fecha, detalle, lineas, afecta_us='N'):
    total_d = sum(float(l.get('monto', 0)) for l in lineas if l.get('tipo_movi') == 'D')
    total_c = sum(float(l.get('monto', 0)) for l in lineas if l.get('tipo_movi') == 'C')
    if abs(total_d - total_c) > 0.001:
        raise ValueError(f"Asiento no cuadra: debitos={total_d} creditos={total_c}")
    with client.connection() as conn:
        cur = conn.cursor()
        no_asiento = _get_next_asiento_no(cur, no_cia, punto, int(ano), int(mes))
        cur.execute(
            """INSERT INTO CNT.TCNT_ASIENTO
               (no_cia,punto,ano,mes,no_asiento,fecha,detalle,
                autorizado,actualizado,debitos,creditos,st_anulado,afecta_us)
               VALUES (:1,:2,:3,:4,:5,:6,:7,'N','N',:8,:9,'N',:10)""",
            [no_cia, punto, int(ano), int(mes), no_asiento, fecha, detalle,
             total_d, total_c, afecta_us]
        )
        for i, linea in enumerate(lineas, 1):
            cur.execute(
                """INSERT INTO CNT.TCNT_ASIENTOL
                   (no_cia,punto,ano,mes,no_asiento,no_linea,cuenta,
                    centro_costo,tipo_movi,monto,monto_us)
                   VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9,:10,:11)""",
                [no_cia, punto, int(ano), int(mes), no_asiento, i,
                 linea['cuenta'],
                 linea.get('centro_costo', ''),
                 linea['tipo_movi'],
                 float(linea['monto']),
                 float(linea.get('monto_us', 0))]
            )
        conn.commit()
    return no_asiento


def _update_hcuenta(cur, no_cia, punto, cuenta, ano, mes, tipo_movi, monto):
    cur.execute(
        """SELECT debitos, creditos FROM CNT.TCNT_HCUENTA
           WHERE no_cia=:1 AND punto=:2 AND cuenta=:3 AND ano=:4 AND mes=:5""",
        [no_cia, punto, cuenta, ano, mes]
    )
    row = cur.fetchone()
    if row:
        if tipo_movi == 'D':
            cur.execute(
                """UPDATE CNT.TCNT_HCUENTA SET debitos=debitos+:1
                   WHERE no_cia=:2 AND punto=:3 AND cuenta=:4 AND ano=:5 AND mes=:6""",
                [monto, no_cia, punto, cuenta, ano, mes]
            )
        else:
            cur.execute(
                """UPDATE CNT.TCNT_HCUENTA SET creditos=creditos+:1
                   WHERE no_cia=:2 AND punto=:3 AND cuenta=:4 AND ano=:5 AND mes=:6""",
                [monto, no_cia, punto, cuenta, ano, mes]
            )
    else:
        d = monto if tipo_movi == 'D' else 0
        c = monto if tipo_movi == 'C' else 0
        cur.execute(
            """INSERT INTO CNT.TCNT_HCUENTA (no_cia,punto,cuenta,ano,mes,debitos,creditos)
               VALUES (:1,:2,:3,:4,:5,:6,:7)""",
            [no_cia, punto, cuenta, ano, mes, d, c]
        )


def aprobar_asiento(no_cia, punto, ano, mes, no_asiento, usuario):
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """UPDATE CNT.TCNT_ASIENTO SET autorizado='S'
               WHERE no_cia=:1 AND punto=:2 AND ano=:3 AND mes=:4
               AND no_asiento=:5 AND st_anulado='N'""",
            [no_cia, punto, int(ano), int(mes), int(no_asiento)]
        )
        if cur.rowcount == 0:
            raise ValueError("Asiento no encontrado o ya anulado")
        conn.commit()


def actualizar_asiento(no_cia, punto, ano, mes, no_asiento, usuario):
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT autorizado, actualizado, st_anulado FROM CNT.TCNT_ASIENTO
               WHERE no_cia=:1 AND punto=:2 AND ano=:3 AND mes=:4 AND no_asiento=:5""",
            [no_cia, punto, int(ano), int(mes), int(no_asiento)]
        )
        row = cur.fetchone()
        if not row:
            raise ValueError("Asiento no encontrado")
        aut, act, anu = row
        if anu == 'S':
            raise ValueError("Asiento anulado")
        if aut != 'S':
            raise ValueError("Asiento debe estar autorizado primero")
        if act == 'S':
            raise ValueError("Asiento ya fue actualizado")
        lines = cur.execute(
            """SELECT cuenta, centro_costo, tipo_movi, monto FROM CNT.TCNT_ASIENTOL
               WHERE no_cia=:1 AND punto=:2 AND ano=:3 AND mes=:4 AND no_asiento=:5""",
            [no_cia, punto, int(ano), int(mes), int(no_asiento)]
        ).fetchall()
        for linea in lines:
            cuenta, centro, tipo_movi, monto = linea
            _update_hcuenta(cur, no_cia, punto, cuenta, int(ano), int(mes), tipo_movi, float(monto))
            cur.execute(
                """INSERT INTO CNT.TCNT_MOVIMIENTO
                   (no_cia,punto,ano,mes,no_asiento,cuenta,centro_costo,tipo_movi,monto,fecha)
                   SELECT no_cia,punto,ano,mes,:1,cuenta,:2,:3,:4,fecha
                   FROM CNT.TCNT_ASIENTO
                   WHERE no_cia=:5 AND punto=:6 AND ano=:7 AND mes=:8 AND no_asiento=:1""",
                [int(no_asiento), centro, tipo_movi, float(monto),
                 no_cia, punto, int(ano), int(mes)]
            )
        cur.execute(
            """UPDATE CNT.TCNT_ASIENTO SET actualizado='S'
               WHERE no_cia=:1 AND punto=:2 AND ano=:3 AND mes=:4 AND no_asiento=:5""",
            [no_cia, punto, int(ano), int(mes), int(no_asiento)]
        )
        conn.commit()


def anular_asiento(no_cia, punto, ano, mes, no_asiento, usuario):
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """UPDATE CNT.TCNT_ASIENTO SET st_anulado='S'
               WHERE no_cia=:1 AND punto=:2 AND ano=:3 AND mes=:4
               AND no_asiento=:5 AND actualizado='N'""",
            [no_cia, punto, int(ano), int(mes), int(no_asiento)]
        )
        if cur.rowcount == 0:
            raise ValueError("No se puede anular: no encontrado o ya actualizado")
        cur.execute(
            """UPDATE CNT.TCNT_MOVIMIENTO SET st_anulado='S'
               WHERE no_cia=:1 AND punto=:2 AND ano=:3 AND mes=:4 AND no_asiento=:5""",
            [no_cia, punto, int(ano), int(mes), int(no_asiento)]
        )
        conn.commit()


def get_balance(no_cia, punto, ano, mes):
    rows = client.fetch_dicts(
        """SELECT h.cuenta, c.nombre AS descripcion, c.tipo, c.clase,
                  h.debitos, h.creditos,
                  NVL(h_ant.debitos,0) AS deb_ant,
                  NVL(h_ant.creditos,0) AS cred_ant
           FROM CNT.TCNT_HCUENTA h
           JOIN CNT.TCNT_CATALOGO c ON c.cuenta = h.cuenta
           LEFT JOIN CNT.TCNT_HCUENTA h_ant
             ON h_ant.no_cia=h.no_cia AND h_ant.punto=h.punto
             AND h_ant.cuenta=h.cuenta AND h_ant.ano=h.ano
             AND h_ant.mes = h.mes - 1
           WHERE h.no_cia=:1 AND h.punto=:2 AND h.ano=:3 AND h.mes=:4
             AND c.acepta_movi='S'
           ORDER BY h.cuenta""",
        [no_cia, punto, int(ano), int(mes)]
    )
    result = []
    for r in rows:
        clase = (r.get('clase') or '').upper()
        d = float(r.get('debitos') or 0)
        c = float(r.get('creditos') or 0)
        d_ant = float(r.get('deb_ant') or 0)
        c_ant = float(r.get('cred_ant') or 0)
        if clase in ('A', 'E'):
            saldo_ant = d_ant - c_ant
            saldo = saldo_ant + d - c
            saldo_d = saldo if saldo >= 0 else 0
            saldo_c = -saldo if saldo < 0 else 0
        else:
            saldo_ant = c_ant - d_ant
            saldo = saldo_ant + c - d
            saldo_c = saldo if saldo >= 0 else 0
            saldo_d = -saldo if saldo < 0 else 0
        result.append({
            **r,
            'saldo_d': round(saldo_d, 2),
            'saldo_c': round(saldo_c, 2),
        })
    return result


def get_mayor(no_cia, punto, cuenta, ano, mes_ini, mes_fin):
    movs = client.fetch_dicts(
        """SELECT m.ano, m.mes, m.no_asiento, m.tipo_movi, m.monto,
                  a.fecha, a.detalle
           FROM CNT.TCNT_MOVIMIENTO m
           JOIN CNT.TCNT_ASIENTO a
             ON a.no_cia=m.no_cia AND a.punto=m.punto
             AND a.ano=m.ano AND a.mes=m.mes AND a.no_asiento=m.no_asiento
           WHERE m.no_cia=:1 AND m.punto=:2 AND m.cuenta=:3
             AND m.ano=:4 AND m.mes>=:5 AND m.mes<=:6
             AND NVL(m.st_anulado,'N')='N'
           ORDER BY m.ano, m.mes, m.no_asiento""",
        [no_cia, punto, cuenta, int(ano), int(mes_ini), int(mes_fin)]
    )
    cuenta_info = get_cuenta(cuenta) or {}
    clase = (cuenta_info.get('clase') or '').upper()
    saldo = 0.0
    for m in movs:
        monto = float(m.get('monto') or 0)
        if clase in ('A', 'E'):
            saldo += monto if m['tipo_movi'] == 'D' else -monto
        else:
            saldo += monto if m['tipo_movi'] == 'C' else -monto
        m['saldo_acumulado'] = round(saldo, 2)
    return {"cuenta": cuenta_info, "movimientos": movs}


def get_cierres(no_cia, punto):
    return client.fetch_dicts(
        "SELECT * FROM CNT.TCNT_CIERRE WHERE no_cia=:1 AND punto=:2 ORDER BY ano DESC, mes DESC",
        [no_cia, punto]
    )

def create_ncf(
    no_cia,
    codigo_ncf,
    ncf_inicial,
    ncf_final,
    tipo_ncf='NORMAL',
    cant_min_ncf=50,
    fecha_vencimiento=None,
    ncf_manual='N',
):
    """Crear una secuencia NCF en TCNT_NCF."""
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO CNT.TCNT_NCF
               (codigo_ncf, ncf_inicial, ncf_final, prox_ncf, tipo_ncf_fiscal,
                cant_min_ncf, fecha_vencimiento, ncf_manual)
               VALUES (:1, :2, :3, :4, :5, :6, :7, :8)""",
            [
                str(codigo_ncf).strip(),
                int(ncf_inicial),
                int(ncf_final),
                int(ncf_inicial),
                tipo_ncf,
                int(cant_min_ncf),
                fecha_vencimiento,
                'S' if str(ncf_manual).upper() in ('S', 'TRUE', '1') else 'N',
            ]
        )
        conn.commit()
    return {
        'no_cia': str(no_cia),
        'codigo_ncf': str(codigo_ncf).strip(),
        'ncf_inicial': int(ncf_inicial),
        'ncf_final': int(ncf_final),
        'prox_ncf': int(ncf_inicial),
    }


def create_centro_costo(centro_costo, descripcion, acepta_movi='N', usuario='REGAL_GENERAL'):
    """Crear centro de costo en TCNT_CENTRO_COSTO."""
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO CNT.TCNT_CENTRO_COSTO
               (centro_costo, descripcion, activo, usuario, acepta_movi)
               VALUES (:1, :2, 'S', :3, :4)""",
            [
                str(centro_costo).strip(),
                descripcion.strip(),
                str(usuario).strip().upper(),
                'S' if str(acepta_movi).upper() in ('S', 'TRUE', '1') else 'N',
            ]
        )
        conn.commit()
    return {
        'centro_costo': str(centro_costo).strip(),
        'descripcion': descripcion.strip(),
        'activo': 'S',
        'acepta_movi': 'S' if str(acepta_movi).upper() in ('S', 'TRUE', '1') else 'N',
    }
