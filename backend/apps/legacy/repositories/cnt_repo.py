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
    # dict de binds nombrados: ":s" se repite 2 veces en el SQL, con lista
    # posicional el modo thick exige un valor por OCURRENCIA y lanza
    # ORA-01008; con dict se resuelve por nombre (ver client.nbinds).
    params: dict = {}
    if search:
        sql += " AND (UPPER(c.cuenta) LIKE UPPER(:s) OR UPPER(c.nombre) LIKE UPPER(:s))"
        params['s'] = f"%{search}%"
    if tipo is not None:
        sql += " AND c.tipo = :t"
        params['t'] = tipo
    if clase:
        sql += " AND UPPER(c.clase) = UPPER(:cl)"
        params['cl'] = clase
    if activa is not None:
        sql += " AND c.activa = :ac"
        params['ac'] = 'S' if activa else 'N'
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


def list_ncf(no_cia: str = ''):
    if no_cia:
        rows = client.fetch_dicts(
            """SELECT codigo_ncf, ncf_inicial, ncf_final, prox_ncf,
                      ncf_manual, tipo_ncf_fiscal, cant_min_ncf, fecha_vencimiento,
                      posiciones_fijas, descripcion
               FROM CNT.TCNT_NCF
               WHERE no_localidad = :1
               ORDER BY codigo_ncf""",
            [no_cia]
        )
    else:
        rows = client.fetch_dicts(
            """SELECT codigo_ncf, ncf_inicial, ncf_final, prox_ncf,
                      ncf_manual, tipo_ncf_fiscal, cant_min_ncf, fecha_vencimiento,
                      posiciones_fijas, descripcion
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
        r['posiciones_fijas'] = (r.get('posiciones_fijas') or '').strip().upper()
        r['descripcion'] = (r.get('descripcion') or '').strip()
        result.append(r)
    return result


def update_ncf(no_cia: str, codigo_ncf: str, **kwargs):
    """Actualiza una secuencia NCF.

    Campos editables: ncf_inicial, ncf_final, prox_ncf, cant_min_ncf,
    fecha_vencimiento, ncf_manual. Si se intenta cambiar prox_ncf por fuera
    del rango [ncf_inicial, ncf_final+1], se rechaza.
    """
    allowed = {'ncf_inicial', 'ncf_final', 'prox_ncf', 'cant_min_ncf',
               'fecha_vencimiento', 'ncf_manual'}
    # Normaliza ncf_manual booleano/string a 'S'/'N'
    if 'ncf_manual' in kwargs:
        v = kwargs['ncf_manual']
        if isinstance(v, bool):
            kwargs['ncf_manual'] = 'S' if v else 'N'
        elif isinstance(v, str):
            kwargs['ncf_manual'] = 'S' if v.upper() in ('S', 'TRUE', '1', 'Y') else 'N'
    # Valida prox_ncf contra rango
    if 'prox_ncf' in kwargs and kwargs['prox_ncf'] is not None:
        try:
            px = int(kwargs['prox_ncf'])
        except (TypeError, ValueError):
            raise ValueError('prox_ncf inválido')
        with client.connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT ncf_inicial, ncf_final FROM CNT.TCNT_NCF "
                "WHERE no_localidad=:1 AND codigo_ncf=:2",
                [no_cia, codigo_ncf])
            r = cur.fetchone()
        if r:
            ini = int(r[0] or 0)
            fin = int(kwargs.get('ncf_final') or r[1] or 0)
            if px < ini or (fin and px > fin + 1):
                raise ValueError(
                    f'prox_ncf={px} fuera del rango [{ini}, {fin}+1]')
        kwargs['prox_ncf'] = px

    sets = []
    params = []
    for k, v in kwargs.items():
        if k in allowed:
            sets.append(f"{k.upper()}=:{len(params)+1}")
            params.append(v)
    if not sets:
        return
    params.extend([no_cia, codigo_ncf])
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE CNT.TCNT_NCF SET {','.join(sets)} WHERE no_localidad=:{len(params)-1} AND codigo_ncf=:{len(params)}",
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
                client.nbinds(
                    int(no_asiento), centro, tipo_movi, float(monto),
                    no_cia, punto, int(ano), int(mes))
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
               (no_localidad, codigo_ncf, ncf_inicial, ncf_final, prox_ncf, tipo_ncf_fiscal,
                cant_min_ncf, fecha_vencimiento, ncf_manual)
               VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9)""",
            [
                str(no_cia).strip(),
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

# === ADDITIONS TO cnt_repo.py ===


# ------------------------------------------
# COMPAÑÍAS (FCNT101)
# ------------------------------------------

def list_cias():
    return client.fetch_dicts(
        """SELECT no_cia, descripcion, direccion1, direccion2, rnc,
                  telefono1, telefono2, fax, email, website, activa,
                  tasa_us, itbis, fecha, utilidad_retenida,
                  cuenta_itbis_retenido, cuenta_isr
           FROM CNT.TCNT_CIAS ORDER BY no_cia"""
    )


def get_cia(no_cia: str):
    rows = client.fetch_dicts(
        """SELECT no_cia, descripcion, direccion1, direccion2, rnc,
                  telefono1, telefono2, fax, email, website, activa,
                  tasa_us, itbis, fecha, utilidad_retenida,
                  cuenta_itbis_retenido, cuenta_isr
           FROM CNT.TCNT_CIAS WHERE no_cia=:1""",
        [no_cia]
    )
    return rows[0] if rows else None


def update_cia(no_cia: str, **kwargs):
    allowed = {
        'descripcion', 'direccion1', 'direccion2', 'rnc',
        'telefono1', 'telefono2', 'fax', 'email', 'website',
        'activa', 'tasa_us', 'itbis', 'utilidad_retenida',
        'cuenta_itbis_retenido', 'cuenta_isr',
    }
    sets, params = [], []
    for k, v in kwargs.items():
        if k in allowed:
            sets.append(f"{k.upper()}=:{len(params)+1}")
            params.append(v)
    if not sets:
        return
    params.append(no_cia)
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE CNT.TCNT_CIAS SET {','.join(sets)} WHERE NO_CIA=:{len(params)}",
            params
        )
        conn.commit()


# ------------------------------------------
# SUCURSALES / PUNTOS (FCNT102)
# ------------------------------------------

def list_puntos_full(no_cia: str):
    return client.fetch_dicts(
        """SELECT no_cia, punto, descripcion, ano_proceso, mes_proceso, mes_cierre,
                  fecha_inicial, fecha_proceso,
                  direccion1, direccion2, telefono, fax,
                  activa, encargado_sucursal, fecha, grupo_contable,
                  esta_en_cierre_p, genero_ed_cierre_p
           FROM CNT.TCNT_PUNTO WHERE no_cia=:1 ORDER BY punto""",
        [no_cia]
    )


def get_punto_full(no_cia: str, punto: str):
    rows = client.fetch_dicts(
        """SELECT no_cia, punto, descripcion, ano_proceso, mes_proceso, mes_cierre,
                  fecha_inicial, fecha_proceso,
                  direccion1, direccion2, telefono, fax,
                  activa, encargado_sucursal, fecha, grupo_contable,
                  esta_en_cierre_p, genero_ed_cierre_p
           FROM CNT.TCNT_PUNTO WHERE no_cia=:1 AND punto=:2""",
        [no_cia, punto]
    )
    return rows[0] if rows else None


def update_punto(no_cia: str, punto: str, **kwargs):
    allowed = {
        'descripcion', 'direccion1', 'direccion2', 'telefono', 'fax',
        'activa', 'encargado_sucursal', 'grupo_contable', 'mes_cierre',
    }
    sets, params = [], []
    for k, v in kwargs.items():
        if k in allowed:
            sets.append(f"{k.upper()}=:{len(params)+1}")
            params.append(v)
    if not sets:
        return
    params += [no_cia, punto]
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE CNT.TCNT_PUNTO SET {','.join(sets)} WHERE NO_CIA=:{len(params)-1} AND PUNTO=:{len(params)}",
            params
        )
        conn.commit()


# ------------------------------------------
# GRUPOS CONTABLES (FCNT107)
# ------------------------------------------

def list_grupos_contables():
    return client.fetch_dicts(
        """SELECT grupo_contable, descripcion,
                  costo_oferta, venta_credito, venta_contado,
                  desc_venta_cr, desc_venta_co, efectivo,
                  itbis_venta, itbis_compra
           FROM CNT.TCNT_GRUPO_CONTABLE ORDER BY grupo_contable"""
    )


def get_grupo_contable(grupo: str):
    rows = client.fetch_dicts(
        """SELECT grupo_contable, descripcion,
                  costo_oferta, venta_credito, venta_contado,
                  desc_venta_cr, desc_venta_co, efectivo,
                  itbis_venta, itbis_compra
           FROM CNT.TCNT_GRUPO_CONTABLE WHERE grupo_contable=:1""",
        [grupo]
    )
    return rows[0] if rows else None


def update_grupo_contable(grupo: str, **kwargs):
    allowed = {
        'descripcion', 'costo_oferta', 'venta_credito', 'venta_contado',
        'desc_venta_cr', 'desc_venta_co', 'efectivo', 'itbis_venta', 'itbis_compra',
    }
    sets, params = [], []
    for k, v in kwargs.items():
        if k in allowed:
            sets.append(f"{k.upper()}=:{len(params)+1}")
            params.append(v)
    if not sets:
        return
    params.append(grupo)
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE CNT.TCNT_GRUPO_CONTABLE SET {','.join(sets)} WHERE GRUPO_CONTABLE=:{len(params)}",
            params
        )
        conn.commit()


# ------------------------------------------
# AUTORIZAR MES COMPLETO (FCNT202)
# ------------------------------------------

def autorizar_mes(no_cia: str, punto: str, ano: int, mes: int, usuario: str):
    """Autoriza TODOS los asientos pendientes del mes (botón AUTORIZAR del legado)."""
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """UPDATE CNT.TCNT_ASIENTO
               SET AUTORIZADO='S'
               WHERE no_cia=:1 AND punto=:2 AND ano=:3 AND mes=:4
                 AND st_anulado='N' AND AUTORIZADO='N'""",
            [no_cia, punto, int(ano), int(mes)]
        )
        count = cur.rowcount
        conn.commit()
    return count


# ------------------------------------------
# CIERRE MENSUAL (FCNT401)
# ------------------------------------------

def get_cierre_info(no_cia: str, punto: str):
    """Datos para la pantalla de cierre mensual (FCNT401)."""
    import calendar
    import datetime
    p = get_punto_full(no_cia, punto)
    if not p:
        return None
    cia = get_cia(no_cia)
    ano = int(p['ano_proceso'])
    mes = int(p['mes_proceso'])
    _, last_day = calendar.monthrange(ano, mes)
    fecha_proceso = datetime.date(ano, mes, last_day)
    if mes < 12:
        fecha_siguiente = datetime.date(ano, mes + 1, 1)
    else:
        fecha_siguiente = datetime.date(ano + 1, 1, 1)
    pending = client.fetch_dicts(
        """SELECT COUNT(*) AS total FROM CNT.TCNT_ASIENTO
           WHERE no_cia=:1 AND punto=:2 AND ano=:3 AND mes=:4
             AND st_anulado='N' AND AUTORIZADO='N'""",
        [no_cia, punto, ano, mes]
    )
    already = client.fetch_dicts(
        """SELECT COUNT(*) AS total FROM CNT.TCNT_CIERRE
           WHERE no_cia=:1 AND punto=:2 AND ano=:3 AND mes=:4""",
        [no_cia, punto, ano, mes]
    )
    meses_nombres = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                     'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    mes_cierre = int(p['mes_cierre'] or 12)
    return {
        'no_cia': no_cia,
        'punto': punto,
        'ano_proceso': ano,
        'mes_proceso': mes,
        'mes_proceso_nombre': meses_nombres[mes],
        'mes_cierre': mes_cierre,
        'mes_cierre_nombre': meses_nombres[mes_cierre],
        'fecha_inicial': str(p['fecha_inicial'])[:10] if p.get('fecha_inicial') else None,
        'fecha_proceso': str(fecha_proceso),
        'fecha_siguiente': str(fecha_siguiente),
        'utilidad_retenida': cia.get('utilidad_retenida') if cia else None,
        'tasa_us': float(cia.get('tasa_us') or 0) if cia else 0,
        'asientos_pendientes': int(pending[0]['total']) if pending else 0,
        'ya_cerrado': int(already[0]['total'] if already else 0) > 0,
        'es_cierre_fiscal': mes == mes_cierre,
    }


def cierre_mensual(no_cia: str, punto: str, usuario: str):
    """Ejecuta el cierre mensual: inserta TCNT_CIERRE y avanza mes en TCNT_PUNTO."""
    import calendar
    import datetime
    p = get_punto_full(no_cia, punto)
    if not p:
        raise ValueError("Punto no encontrado")
    ano = int(p['ano_proceso'])
    mes = int(p['mes_proceso'])
    already = client.fetch_dicts(
        """SELECT COUNT(*) AS total FROM CNT.TCNT_CIERRE
           WHERE no_cia=:1 AND punto=:2 AND ano=:3 AND mes=:4""",
        [no_cia, punto, ano, mes]
    )
    if int(already[0]['total'] if already else 0) > 0:
        raise ValueError(f"El periodo {mes}/{ano} ya esta cerrado")
    pending = client.fetch_dicts(
        """SELECT COUNT(*) AS total FROM CNT.TCNT_ASIENTO
           WHERE no_cia=:1 AND punto=:2 AND ano=:3 AND mes=:4
             AND st_anulado='N' AND AUTORIZADO='N'""",
        [no_cia, punto, ano, mes]
    )
    n_pending = int(pending[0]['total']) if pending else 0
    if n_pending > 0:
        raise ValueError(
            f"Hay {n_pending} asientos sin autorizar. "
            "Autorice todos los asientos antes de cerrar el periodo."
        )
    if mes < 12:
        next_mes, next_ano = mes + 1, ano
    else:
        next_mes, next_ano = 1, ano + 1
    _, last_day_next = calendar.monthrange(next_ano, next_mes)
    fecha_proceso_next = datetime.date(next_ano, next_mes, last_day_next)
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO CNT.TCNT_CIERRE
               (no_cia, punto, ano, mes, fecha_cierre, fecha_sysdate, usuario)
               VALUES (:1, :2, :3, :4, SYSDATE, SYSDATE, :5)""",
            [no_cia, punto, ano, mes, usuario]
        )
        cur.execute(
            """UPDATE CNT.TCNT_PUNTO
               SET mes_proceso=:1, ano_proceso=:2, fecha_proceso=:3
               WHERE no_cia=:4 AND punto=:5""",
            [next_mes, next_ano, fecha_proceso_next, no_cia, punto]
        )
        conn.commit()
    return {
        'ano_cerrado': ano,
        'mes_cerrado': mes,
        'proximo_mes': next_mes,
        'proximo_ano': next_ano,
    }


# ------------------------------------------
# CATALOGO SUCURSAL (FCNT106)
# ------------------------------------------

def list_catalogo_sucursal(no_cia: str, punto: str):
    """Cuentas del catálogo con flag asignada para el punto dado."""
    return client.fetch_dicts(
        """SELECT c.cuenta, c.nombre, c.tipo, c.clase, c.acepta_movi,
                  CASE WHEN b.cuenta IS NOT NULL THEN 'S' ELSE 'N' END AS asignada
           FROM CNT.TCNT_CATALOGO c
           LEFT JOIN CNT.TCNT_BCUENTA b
               ON b.no_cia = :1 AND b.punto = :2 AND b.cuenta = c.cuenta AND b.activa = 'S'
           WHERE c.activa = 'S'
           ORDER BY c.cuenta""",
        [no_cia, punto]
    )


def assign_cuenta_sucursal(no_cia: str, punto: str, cuenta: str, asignar: bool, usuario: str):
    """Asigna o desasigna una cuenta al punto (TCNT_BCUENTA)."""
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT COUNT(*) FROM CNT.TCNT_BCUENTA WHERE no_cia=:1 AND punto=:2 AND cuenta=:3",
            [no_cia, punto, cuenta]
        )
        exists = cur.fetchone()[0]
        if asignar:
            if exists:
                cur.execute(
                    "UPDATE CNT.TCNT_BCUENTA SET activa='S', usuario=:1 WHERE no_cia=:2 AND punto=:3 AND cuenta=:4",
                    [usuario, no_cia, punto, cuenta]
                )
            else:
                cur.execute(
                    """INSERT INTO CNT.TCNT_BCUENTA
                       (no_cia, punto, cuenta, saldo_periodo_ant, saldo_mes_ant, debitos, creditos,
                        saldo_periodo_ant_us, saldo_mes_ant_us, debitos_us, creditos_us,
                        activa, fecha_creacion, usuario)
                       VALUES (:1, :2, :3, 0, 0, 0, 0, 0, 0, 0, 0, 'S', SYSDATE, :4)""",
                    [no_cia, punto, cuenta, usuario]
                )
        else:
            if exists:
                cur.execute(
                    "UPDATE CNT.TCNT_BCUENTA SET activa='N', usuario=:1 WHERE no_cia=:2 AND punto=:3 AND cuenta=:4",
                    [usuario, no_cia, punto, cuenta]
                )
        conn.commit()


# ------------------------------------------
# CREAR COMPANIA (FCNT101)
# ------------------------------------------

def create_cia(no_cia: str, descripcion: str, usuario: str, **kwargs):
    """Inserta una nueva compania en TCNT_CIAS."""
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO CNT.TCNT_CIAS
               (no_cia, descripcion, activa, tasa_us, itbis, fecha, tipo, usuario,
                cerrar_sin_movi, rnc, direccion1, direccion2, telefono1, telefono2,
                fax, email, website)
               VALUES (:1, :2, 'S', :3, :4, SYSDATE, 'N', :5, 'S', :6, :7, :8, :9, :10, :11, :12, :13)""",
            [
                no_cia, descripcion,
                kwargs.get('tasa_us', 58),
                kwargs.get('itbis', 18),
                usuario,
                kwargs.get('rnc', None),
                kwargs.get('direccion1', None),
                kwargs.get('direccion2', None),
                kwargs.get('telefono1', None),
                kwargs.get('telefono2', None),
                kwargs.get('fax', None),
                kwargs.get('email', None),
                kwargs.get('website', None),
            ]
        )
        conn.commit()


# ------------------------------------------
# CREAR SUCURSAL (FCNT102)
# ------------------------------------------

def create_punto(no_cia: str, punto: str, descripcion: str, ano_proceso: int, usuario: str, **kwargs):
    """Inserta una nueva sucursal en TCNT_PUNTO."""
    import datetime, calendar
    mes_proceso = kwargs.get('mes_proceso', 1)
    mes_cierre = kwargs.get('mes_cierre', 12)
    grupo_contable = kwargs.get('grupo_contable', None)
    fecha_inicial = datetime.date(ano_proceso, 1, 1)
    _, last_day = calendar.monthrange(ano_proceso, int(mes_proceso))
    fecha_proceso = datetime.date(ano_proceso, int(mes_proceso), last_day)
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO CNT.TCNT_PUNTO
               (no_cia, punto, descripcion, ano_proceso, mes_proceso, mes_cierre,
                activa, fecha, fecha_inicial, fecha_proceso, grupo_contable, usuario,
                esta_en_cierre_p, genero_ed_cierre_p, encf_en_contingencia, fase_encf)
               VALUES (:1, :2, :3, :4, :5, :6, 'S', SYSDATE, :7, :8, :9, :10, 'N', 'N', 'N', 0)""",
            [
                no_cia, punto, descripcion, ano_proceso, mes_proceso, mes_cierre,
                fecha_inicial, fecha_proceso, grupo_contable, usuario,
            ]
        )
        conn.commit()

# ---- Tipos de Cuenta CRUD (FCNT104) ----

def get_tcuenta(tipo: str):
    rows = client.fetch_dicts(
        "SELECT tipo, descripcion, clase FROM CNT.TCNT_TCUENTA WHERE tipo=:1",
        [tipo]
    )
    return rows[0] if rows else None


def create_tcuenta(tipo: str, descripcion: str, clase: str):
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO CNT.TCNT_TCUENTA (tipo, descripcion, clase) VALUES (:1,:2,:3)",
            [tipo.upper(), descripcion, clase.upper()]
        )
        conn.commit()


def update_tcuenta(tipo: str, **kwargs):
    allowed = {"descripcion", "clase"}
    sets, params = [], []
    for k, v in kwargs.items():
        if k in allowed:
            sets.append(f"{k.upper()}=:{len(params)+1}")
            params.append(v)
    if not sets:
        return
    params.append(tipo)
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE CNT.TCNT_TCUENTA SET {','.join(sets)} WHERE tipo=:{len(params)}",
            params
        )
        conn.commit()


def delete_tcuenta(tipo: str):
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM CNT.TCNT_TCUENTA WHERE tipo=:1", [tipo])
        conn.commit()


# ---- Cabecera de empresa para PDF ----

def get_cia_header(no_cia: str):
    rows = client.fetch_dicts(
        "SELECT no_cia, descripcion, direccion1, direccion2, rnc, telefono1, logo FROM CNT.TCNT_CIAS WHERE no_cia=:1",
        [no_cia]
    )
    if not rows:
        return None
    row = rows[0]
    # Build logo_url: if logo field has a path/filename, expose via /api/cnt/cia-logo/<no_cia>/
    logo_val = row.get('logo') or ''
    if logo_val.strip():
        row['logo_url'] = f'/api/cnt/cia-logo/{no_cia}/'
    else:
        row['logo_url'] = None
    return row

# ---- Tipos de Proyecto (FCNT110) ----

def list_tipos_proyecto():
    return client.fetch_dicts(
        "SELECT tipo, descripcion FROM CNT.TCNT_TIPO_PROYECTO ORDER BY tipo"
    )

def get_tipo_proyecto(tipo: str):
    rows = client.fetch_dicts(
        "SELECT tipo, descripcion FROM CNT.TCNT_TIPO_PROYECTO WHERE tipo=:1", [tipo]
    )
    return rows[0] if rows else None

def create_tipo_proyecto(tipo: str, descripcion: str):
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO CNT.TCNT_TIPO_PROYECTO (tipo, descripcion) VALUES (:1, :2)",
            [tipo, descripcion]
        )
        conn.commit()

def update_tipo_proyecto(tipo: str, descripcion: str):
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE CNT.TCNT_TIPO_PROYECTO SET DESCRIPCION=:1 WHERE tipo=:2",
            [descripcion, tipo]
        )
        conn.commit()

def delete_tipo_proyecto(tipo: str):
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM CNT.TCNT_TIPO_PROYECTO WHERE tipo=:1", [tipo])
        conn.commit()


# ---- Movimientos de cuentas (FCNT502) ----

def get_movimientos_cuenta(
    no_cia: str, punto: str, cuenta: str,
    desde_ano: int, desde_mes: int,
    hasta_ano: int, hasta_mes: int,
    tipo_movi: str = 'A',
):
    filtro = ''
    if tipo_movi == 'D':
        filtro = "AND m.tipo_movi = 'D'"
    elif tipo_movi == 'C':
        filtro = "AND m.tipo_movi = 'C'"
    q = f"""
        SELECT m.no_asiento, m.fecha, m.auxiliar, m.tipo_movi,
               m.no_componente, m.detalle, m.monto, m.monto_us,
               m.tasa_us, m.st_anulado, m.mes_actual,
               m.ano, m.mes, m.centro_costo, m.afecta_presupuesto
        FROM CNT.TCNT_MOVIMIENTO m
        WHERE m.no_cia=:1 AND m.punto=:2 AND m.cuenta=:3
          AND (m.ano * 100 + m.mes) BETWEEN (:4 * 100 + :5) AND (:6 * 100 + :7)
          {filtro}
        ORDER BY m.ano, m.mes, m.no_asiento, m.no_linea
    """
    rows = client.fetch_dicts(q, [no_cia, punto, cuenta, desde_ano, desde_mes, hasta_ano, hasta_mes])
    saldo = 0.0
    result = []
    for r in rows:
        monto = float(r['monto'] or 0)
        if r['tipo_movi'] == 'D':
            saldo += monto
        else:
            saldo -= monto
        r2 = dict(r)
        if r2.get('fecha'):
            r2['fecha'] = str(r2['fecha'])[:10]
        r2['balance'] = round(saldo, 2)
        result.append(r2)
    return result


# ---- Centros de costo asignados a cuenta (FCNT109) ----

def get_centros_cuenta(no_cia: str, punto: str, cuenta: str):
    todos = client.fetch_dicts(
        "SELECT cc.centro_costo, cc.descripcion, cc.activo, cc.acepta_movi FROM CNT.TCNT_CENTRO_COSTO cc ORDER BY cc.centro_costo"
    )
    asignados = set(
        r['centro_costo']
        for r in client.fetch_dicts(
            "SELECT centro_costo FROM CNT.TCNT_BCENTRO_COSTO WHERE no_cia=:1 AND punto=:2 AND cuenta=:3",
            [no_cia, punto, cuenta]
        )
    )
    return [{**r, 'asignado': r['centro_costo'] in asignados} for r in todos]

def asignar_centro_cuenta(no_cia: str, punto: str, cuenta: str, centro: str):
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO CNT.TCNT_BCENTRO_COSTO (no_cia, punto, cuenta, centro_costo, activo) VALUES (:1, :2, :3, :4, 'S')",
            [no_cia, punto, cuenta, centro]
        )
        conn.commit()

def desasignar_centro_cuenta(no_cia: str, punto: str, cuenta: str, centro: str):
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM CNT.TCNT_BCENTRO_COSTO WHERE no_cia=:1 AND punto=:2 AND cuenta=:3 AND centro_costo=:4",
            [no_cia, punto, cuenta, centro]
        )
        conn.commit()

def list_presupuesto(no_cia: str, punto: str, ano: int) -> list[dict]:
    """Retorna presupuesto anual por cuenta con columnas mes_01..mes_12 y total_anual.
    Fuente: CNT.TCNT_PRESUPUESTO JOIN CNT.TCNT_CATALOGO."""
    rows = client.fetch_dicts(
        """SELECT p.cuenta,
                  c.nombre AS descripcion,
                  c.tipo,
                  c.clase,
                  SUM(CASE WHEN p.mes=1  THEN p.presupuesto ELSE 0 END) AS mes_01,
                  SUM(CASE WHEN p.mes=2  THEN p.presupuesto ELSE 0 END) AS mes_02,
                  SUM(CASE WHEN p.mes=3  THEN p.presupuesto ELSE 0 END) AS mes_03,
                  SUM(CASE WHEN p.mes=4  THEN p.presupuesto ELSE 0 END) AS mes_04,
                  SUM(CASE WHEN p.mes=5  THEN p.presupuesto ELSE 0 END) AS mes_05,
                  SUM(CASE WHEN p.mes=6  THEN p.presupuesto ELSE 0 END) AS mes_06,
                  SUM(CASE WHEN p.mes=7  THEN p.presupuesto ELSE 0 END) AS mes_07,
                  SUM(CASE WHEN p.mes=8  THEN p.presupuesto ELSE 0 END) AS mes_08,
                  SUM(CASE WHEN p.mes=9  THEN p.presupuesto ELSE 0 END) AS mes_09,
                  SUM(CASE WHEN p.mes=10 THEN p.presupuesto ELSE 0 END) AS mes_10,
                  SUM(CASE WHEN p.mes=11 THEN p.presupuesto ELSE 0 END) AS mes_11,
                  SUM(CASE WHEN p.mes=12 THEN p.presupuesto ELSE 0 END) AS mes_12,
                  SUM(p.presupuesto) AS total_anual
           FROM CNT.TCNT_PRESUPUESTO p
           JOIN CNT.TCNT_CATALOGO c ON c.cuenta = p.cuenta
           WHERE p.no_cia=:1 AND p.punto=:2 AND p.ano=:3
           GROUP BY p.cuenta, c.nombre, c.tipo, c.clase
           ORDER BY p.cuenta""",
        [no_cia, punto, int(ano)]
    )
    # Convert Decimal/float to plain float for JSON serialization
    result = []
    for r in rows:
        row = dict(r)
        for k in ['mes_01','mes_02','mes_03','mes_04','mes_05','mes_06',
                  'mes_07','mes_08','mes_09','mes_10','mes_11','mes_12','total_anual']:
            row[k] = float(row.get(k) or 0)
        result.append(row)
    return result


def get_estado_resultados(no_cia: str, punto: str, ano: int,
                          mes_ini: int, mes_fin: int) -> dict:
    """Estado de Resultados (P&L) acumulando debitos/creditos de TCNT_HCUENTA
    para cuentas de clase I (ingresos), E (egresos/gastos) y clase E tipo 60 (costos)."""
    rows = client.fetch_dicts(
        """SELECT h.cuenta, c.nombre AS descripcion, c.tipo, c.clase,
                  SUM(h.debitos)  AS total_deb,
                  SUM(h.creditos) AS total_cred
           FROM CNT.TCNT_HCUENTA h
           JOIN CNT.TCNT_CATALOGO c ON c.cuenta = h.cuenta
           WHERE h.no_cia=:1 AND h.punto=:2 AND h.ano=:3
             AND h.mes >= :4 AND h.mes <= :5
             AND c.clase IN ('I','E')
             AND c.acepta_movi='S'
           GROUP BY h.cuenta, c.nombre, c.tipo, c.clase
           ORDER BY h.cuenta""",
        [no_cia, punto, int(ano), int(mes_ini), int(mes_fin)]
    )

    ingresos = []
    costos = []
    gastos = []

    for r in rows:
        clase = (r.get('clase') or '').upper()
        tipo = (r.get('tipo') or '').strip()
        deb = float(r.get('total_deb') or 0)
        cred = float(r.get('total_cred') or 0)
        # Ingresos: clase I -> saldo = creditos - debitos
        if clase == 'I':
            saldo = round(cred - deb, 2)
            ingresos.append({'cuenta': r['cuenta'], 'descripcion': r['descripcion'],
                             'tipo': tipo, 'saldo': saldo})
        elif clase == 'E':
            # tipo 60 = costo de ventas; resto = gastos operativos
            saldo = round(deb - cred, 2)
            entry = {'cuenta': r['cuenta'], 'descripcion': r['descripcion'],
                     'tipo': tipo, 'saldo': saldo}
            if tipo == '60':
                costos.append(entry)
            else:
                gastos.append(entry)

    total_ingresos = round(sum(r['saldo'] for r in ingresos), 2)
    total_costos = round(sum(r['saldo'] for r in costos), 2)
    total_gastos = round(sum(r['saldo'] for r in gastos), 2)
    utilidad_bruta = round(total_ingresos - total_costos, 2)
    utilidad_neta = round(utilidad_bruta - total_gastos, 2)

    return {
        'ingresos': ingresos,
        'costos': costos,
        'gastos': gastos,
        'total_ingresos': total_ingresos,
        'total_costos': total_costos,
        'utilidad_bruta': utilidad_bruta,
        'total_gastos': total_gastos,
        'utilidad_neta': utilidad_neta,
    }
