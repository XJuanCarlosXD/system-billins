from __future__ import annotations
from .. import client


def list_proveedores(search='', activo=''):
    conditions = ['1=1']
    params = []
    if search:
        params += [f'%{search.upper()}%', f'%{search.upper()}%']
        conditions.append(f"(UPPER(p.nombre) LIKE :{len(params)-1} OR UPPER(p.rnc) LIKE :{len(params)})")
    if activo:
        params.append(activo)
        conditions.append(f"p.activo = :{len(params)}")
    where = ' AND '.join(conditions)
    sql = f"""
        SELECT p.no_proveedor, p.nombre, p.rnc, p.cedula,
               p.telefono, p.celular, p.e_mail,
               p.direccion, p.plazo_pago, p.activo,
               p.excento_itbis, p.categoria, p.clasificacion,
               p.cuenta_banco, p.codigo_banco, p.tipo_cuenta
        FROM CXP.TCXP_DPROVEEDOR p
        WHERE {where}
        ORDER BY p.nombre
    """
    return client.fetch_dicts(sql, params)


def get_proveedor(no_proveedor):
    """Busca un proveedor por su código.

    El usuario suele teclear `199` pero `TCXP_DPROVEEDOR.no_proveedor` está
    almacenado con padding a 6 dígitos (`000199`). Para entradas puramente
    numéricas probamos primero el valor literal y luego con LPAD a 6.
    """
    raw = (str(no_proveedor) if no_proveedor is not None else '').strip()
    candidates: list[str] = []
    if raw:
        candidates.append(raw)
        if raw.isdigit() and len(raw) < 6:
            candidates.append(raw.zfill(6))
        elif raw.isdigit() and len(raw) > 6:
            candidates.append(str(int(raw)))  # quita ceros a la izquierda
    sql = (
        "SELECT p.no_proveedor, p.nombre, p.rnc, p.cedula, "
        "p.telefono, p.celular, p.fax, p.e_mail, p.web_site, "
        "p.direccion, p.encargado, p.plazo_pago, p.activo, "
        "p.excento_itbis, p.categoria, p.clasificacion, "
        "p.cuenta_banco, p.codigo_banco, p.tipo_cuenta "
        "FROM CXP.TCXP_DPROVEEDOR p WHERE p.no_proveedor = :1"
    )
    seen: set[str] = set()
    for cand in candidates:
        if cand in seen:
            continue
        seen.add(cand)
        rows = client.fetch_dicts(sql, [cand])
        if rows:
            return rows[0]
    return None


def save_proveedor(data: dict):
    no_proveedor = (data.get('no_proveedor') or '').strip()
    with client.cursor() as cur:
        if no_proveedor:
            existing_rows = client.fetch_dicts(
                "SELECT * FROM CXP.TCXP_DPROVEEDOR WHERE no_proveedor=:1", [no_proveedor])
            ex = existing_rows[0] if existing_rows else {}
            cur.execute("""
                UPDATE CXP.TCXP_DPROVEEDOR SET
                    nombre=:1, rnc=:2, cedula=:3,
                    telefono=:4, celular=:5, fax=:6,
                    e_mail=:7, web_site=:8, direccion=:9,
                    encargado=:10, plazo_pago=:11, activo=:12,
                    excento_itbis=:13, categoria=:14, clasificacion=:15,
                    cuenta_banco=:16, codigo_banco=:17, tipo_cuenta=:18
                WHERE no_proveedor=:19
            """, [
                data.get('nombre') or ex.get('nombre', ''),
                data.get('rnc') if data.get('rnc') is not None else ex.get('rnc', ''),
                data.get('cedula') if data.get('cedula') is not None else ex.get('cedula', ''),
                data.get('telefono') if data.get('telefono') is not None else ex.get('telefono', ''),
                data.get('celular') if data.get('celular') is not None else ex.get('celular', ''),
                data.get('fax') if data.get('fax') is not None else ex.get('fax', ''),
                data.get('e_mail') if data.get('e_mail') is not None else ex.get('e_mail', ''),
                data.get('web_site') if data.get('web_site') is not None else ex.get('web_site', ''),
                data.get('direccion') if data.get('direccion') is not None else ex.get('direccion', ''),
                data.get('encargado') if data.get('encargado') is not None else ex.get('encargado', ''),
                data.get('plazo_pago') if data.get('plazo_pago') is not None else ex.get('plazo_pago', 0),
                data.get('activo') or ex.get('activo', 'S'),
                data.get('excento_itbis') or ex.get('excento_itbis', 'N'),
                data.get('categoria') if data.get('categoria') is not None else ex.get('categoria', ''),
                data.get('clasificacion') if data.get('clasificacion') is not None else ex.get('clasificacion', ''),
                data.get('cuenta_banco') if data.get('cuenta_banco') is not None else ex.get('cuenta_banco', ''),
                data.get('codigo_banco') if data.get('codigo_banco') is not None else ex.get('codigo_banco', ''),
                data.get('tipo_cuenta') if data.get('tipo_cuenta') is not None else ex.get('tipo_cuenta', ''),
                no_proveedor,
            ])
        else:
            cur.execute("""
                SELECT NVL(MAX(TO_NUMBER(no_proveedor)), 0) + 1
                FROM CXP.TCXP_DPROVEEDOR
                WHERE REGEXP_LIKE(no_proveedor, '^[0-9]+$')
            """, [])
            row = cur.fetchone()
            no_proveedor = str(int(row[0])).zfill(6)
            cur.execute("""
                INSERT INTO CXP.TCXP_DPROVEEDOR
                    (no_proveedor, nombre, rnc, cedula, telefono, celular, fax,
                     e_mail, web_site, direccion, encargado, plazo_pago, activo,
                     excento_itbis, categoria, clasificacion,
                     cuenta_banco, codigo_banco, tipo_cuenta)
                VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9,:10,:11,:12,:13,:14,:15,:16,:17,:18,:19)
            """, [
                no_proveedor,
                data.get('nombre', ''), data.get('rnc', ''), data.get('cedula', ''),
                data.get('telefono', ''), data.get('celular', ''), data.get('fax', ''),
                data.get('e_mail', ''), data.get('web_site', ''), data.get('direccion', ''),
                data.get('encargado', ''), data.get('plazo_pago', 0), data.get('activo', 'S'),
                data.get('excento_itbis', 'N'), data.get('categoria', ''), data.get('clasificacion', ''),
                data.get('cuenta_banco', ''), data.get('codigo_banco', ''), data.get('tipo_cuenta', ''),
            ])
        cur.connection.commit()
    return {'no_proveedor': no_proveedor}


def list_documentos(no_cia, punto, no_proveedor='', tipo='', no_doc='',
                    desde='', hasta='', status='A'):
    conditions = ['d.no_cia=:1', 'd.punto=:2']
    params = [no_cia, punto]
    if no_proveedor:
        params.append(no_proveedor)
        conditions.append(f'd.no_proveedor=:{len(params)}')
    if tipo:
        params.append(tipo)
        conditions.append(f'd.tipo_docu=:{len(params)}')
    if no_doc:
        params.append(f"%{no_doc}%")
        conditions.append(f'd.no_docu LIKE :{len(params)}')
    if desde:
        params.append(desde)
        conditions.append(f"d.fecha>=TO_DATE(:{len(params)},'YYYY-MM-DD')")
    if hasta:
        params.append(hasta)
        conditions.append(f"d.fecha<=TO_DATE(:{len(params)},'YYYY-MM-DD')")
    if status:
        params.append(status)
        conditions.append(f'd.status=:{len(params)}')
    where = ' AND '.join(conditions)
    sql = f"""
        SELECT d.no_cia, d.punto, d.tipo_docu, d.no_docu,
               d.no_proveedor, p.nombre AS nombre_proveedor,
               TO_CHAR(d.fecha,'YYYY-MM-DD') AS fecha,
               TO_CHAR(d.fecha_vence,'YYYY-MM-DD') AS fecha_vence,
               d.valor_original, d.saldo, d.status,
               d.ncf, d.posiciones_fijas_ncf, d.tipo_transaccion,
               d.impuesto, d.itbis_retenido, d.isr_retenido,
               d.tipo_movi, d.forma_pago, d.pago_bloqueado
        FROM CXP.TCXP_DOCUMENTO d
        JOIN CXP.TCXP_DPROVEEDOR p ON p.no_proveedor = d.no_proveedor
        WHERE {where}
        ORDER BY d.fecha DESC, d.no_docu DESC
    """
    return client.fetch_dicts(sql, params)


def get_documento(no_cia, punto, tipo_docu, no_docu):
    sql = """
        SELECT d.no_cia, d.punto, d.tipo_docu, d.no_docu,
               d.no_proveedor, p.nombre AS nombre_proveedor,
               p.direccion AS direccion_proveedor,
               p.telefono AS telefono_proveedor,
               p.celular  AS celular_proveedor,
               TO_CHAR(d.fecha,'YYYY-MM-DD') AS fecha,
               TO_CHAR(d.fecha_vence,'YYYY-MM-DD') AS fecha_vence,
               d.valor_original, d.saldo, d.status,
               d.ncf, d.posiciones_fijas_ncf, d.rnc,
               d.tipo_transaccion, d.impuesto,
               d.itbis_retenido, d.isr_retenido,
               d.tipo_movi, d.forma_pago, d.debito, d.credito,
               d.pago_bloqueado, d.detalle, d.usuario
        FROM CXP.TCXP_DOCUMENTO d
        JOIN CXP.TCXP_DPROVEEDOR p ON p.no_proveedor = d.no_proveedor
        WHERE d.no_cia=:1 AND d.punto=:2 AND d.tipo_docu=:3 AND d.no_docu=:4
    """
    sql_lineas = """
        SELECT dc.cuenta,
               dc.centro_costo,
               dc.no_componente,
               dc.monto,
               dc.tipo_movi
        FROM CXP.TCXP_DCDOCU dc
        WHERE dc.no_cia=:1 AND dc.punto=:2 AND dc.tipo_docu=:3 AND dc.no_docu=:4
        ORDER BY dc.no_componente NULLS FIRST, dc.cuenta
    """
    rows = client.fetch_dicts(sql, [no_cia, punto, tipo_docu, no_docu])
    if not rows:
        return None
    doc = rows[0]
    # NCF DGI compuesto (prefijo + LPAD(NCF,8,'0')) para que el frontend
    # muestre el comprobante completo.
    from .fat_repo import _compose_ncf_dgi
    doc['ncf_dgi'] = _compose_ncf_dgi(doc.get('posiciones_fijas_ncf'), doc.get('ncf'))
    doc['lineas'] = client.fetch_dicts(sql_lineas, [no_cia, punto, tipo_docu, no_docu])
    return doc


def estado_cuenta(no_cia: str, no_proveedor: str, punto: str = ''):
    """Estado de cuenta del proveedor: header con datos + tabla de documentos
    con saldo pendiente y envejecimiento por edad de la fecha de emisión."""
    prov = client.fetch_dicts(
        "SELECT no_proveedor, nombre, "
        "       NVL(rnc,'') rnc, NVL(direccion,'') direccion, "
        "       NVL(telefono,'') telefono, NVL(celular,'') celular, "
        "       NVL(e_mail,'') email, NVL(encargado,'') encargado, "
        "       NVL(plazo_pago,0) dias "
        "FROM CXP.TCXP_DPROVEEDOR WHERE no_proveedor=:1",
        [no_proveedor])
    if not prov:
        return None

    where = "WHERE d.no_cia=:1 AND d.no_proveedor=:2 AND d.status='A' AND NVL(d.saldo,0)<>0"
    params = [no_cia, no_proveedor]
    if punto:
        where += " AND d.punto=:3"
        params.append(punto)
    docs = client.fetch_dicts(
        "SELECT d.no_docu no_doc, d.tipo_docu tipo_doc, d.punto, "
        "       TO_CHAR(d.fecha,'YYYY-MM-DD') fecha, "
        "       TO_CHAR(d.fecha_vence,'YYYY-MM-DD') fecha_vence, "
        "       NVL(d.valor_original,0) valor, NVL(d.saldo,0) saldo, "
        "       d.ncf, d.posiciones_fijas_ncf, d.detalle, "
        "       TRUNC(SYSDATE)-TRUNC(d.fecha) dias_vencido, "
        "       NVL(t.tipo_movi,'D') tipo_movi, "
        "       NVL(t.descri, d.tipo_docu) tipo_label "
        "FROM CXP.TCXP_DOCUMENTO d "
        "LEFT JOIN CXP.TCXP_TDOCU t ON t.tipo_docu=d.tipo_docu "
        f"{where} ORDER BY d.fecha, d.no_docu",
        params)
    # Componer NCF DGI: prefijo (B01..B15) + LPAD(NCF,8,'0') para que el
    # frontend muestre el comprobante completo y no solo el correlativo.
    from .fat_repo import _compose_ncf_dgi
    for d in docs:
        d['ncf'] = _compose_ncf_dgi(d.get('posiciones_fijas_ncf'), d.get('ncf')) or d.get('ncf')

    aging = {'d_0_30': 0.0, 'd_31_60': 0.0, 'd_61_90': 0.0, 'd_mas_90': 0.0}
    total_debito = 0.0
    total_credito = 0.0
    for d in docs:
        sld = float(d.get('saldo') or 0)
        dv = int(d.get('dias_vencido') or 0)
        if sld > 0:
            total_debito += sld
            if dv <= 30: aging['d_0_30'] += sld
            elif dv <= 60: aging['d_31_60'] += sld
            elif dv <= 90: aging['d_61_90'] += sld
            else: aging['d_mas_90'] += sld
        elif sld < 0:
            total_credito += abs(sld)
    total_pendiente = total_debito - total_credito

    row = prov[0]
    return {
        'proveedor': {
            'no_proveedor': str(row['no_proveedor']).strip(),
            'nombre': row['nombre'],
            'rnc': row['rnc'], 'direccion': row['direccion'],
            'telefono': row['telefono'] or row['celular'],
            'email': row['email'],
            'encargado': row['encargado'],
            'dias': int(row['dias'] or 0),
        },
        'total_pendiente': total_pendiente,
        'total_debito': total_debito,
        'total_credito': total_credito,
        'aging': aging,
        'documentos': docs,
    }


def get_documentos_afectados(no_cia, punto, tipo_docu, no_docu):
    """TCXP_REFEDOCU + datos del documento referenciado (saldo actual)."""
    sql = """
        SELECT r.tipo_refe AS tipo_doc, r.no_refe AS no_doc,
               r.no_cuota, r.monto,
               TO_CHAR(rd.fecha,'YYYY-MM-DD') AS fecha,
               NVL(rd.valor_original,0) AS valor_original,
               NVL(rd.saldo,0) AS saldo
        FROM CXP.TCXP_REFEDOCU r
        LEFT JOIN CXP.TCXP_DOCUMENTO rd
          ON rd.no_cia=r.no_cia AND rd.punto=r.punto
         AND rd.tipo_docu=r.tipo_refe AND rd.no_docu=r.no_refe
        WHERE r.no_cia=:1 AND r.punto=:2 AND r.tipo_docu=:3 AND r.no_docu=:4
        ORDER BY r.no_cuota, r.tipo_refe, r.no_refe
    """
    return client.fetch_dicts(sql, [no_cia, punto, tipo_docu, no_docu])


def list_tipos_docu():
    return client.fetch_dicts(
        "SELECT tipo_docu AS codigo, descri AS nombre, tipo_movi FROM CXP.TCXP_TDOCU ORDER BY tipo_docu", [])


def get_aging(no_cia, punto='', no_proveedor=''):
    conditions = ["d.no_cia=:1", "d.status='A'"]
    params = [no_cia]
    if punto:
        params.append(punto)
        conditions.append(f'd.punto=:{len(params)}')
    if no_proveedor:
        params.append(no_proveedor)
        conditions.append(f'd.no_proveedor=:{len(params)}')
    where = ' AND '.join(conditions)
    sql = f"""
        SELECT d.no_proveedor, p.nombre,
               SUM(CASE WHEN d.fecha_vence IS NULL OR SYSDATE - d.fecha_vence <= 0
                        THEN d.saldo ELSE 0 END) AS corriente,
               SUM(CASE WHEN SYSDATE - d.fecha_vence BETWEEN 1  AND 30  THEN d.saldo ELSE 0 END) AS d30,
               SUM(CASE WHEN SYSDATE - d.fecha_vence BETWEEN 31 AND 60  THEN d.saldo ELSE 0 END) AS d60,
               SUM(CASE WHEN SYSDATE - d.fecha_vence BETWEEN 61 AND 90  THEN d.saldo ELSE 0 END) AS d90,
               SUM(CASE WHEN SYSDATE - d.fecha_vence > 90               THEN d.saldo ELSE 0 END) AS mas90,
               SUM(d.saldo) AS total
        FROM CXP.TCXP_DOCUMENTO d
        JOIN CXP.TCXP_DPROVEEDOR p ON p.no_proveedor = d.no_proveedor
        WHERE {where}
        GROUP BY d.no_proveedor, p.nombre
        ORDER BY p.nombre
    """
    return client.fetch_dicts(sql, params)


def list_tipos_gasto():
    return client.fetch_dicts(
        "SELECT tipo_gasto, descripcion FROM CXP.TCXP_TCOSTO_GASTO "
        "ORDER BY tipo_gasto", [])


def list_tipos_retencion():
    return client.fetch_dicts(
        "SELECT tipo_retencion, descripcion, por_defecto "
        "FROM CXP.TCXP_TIPO_RETENCION_DGII ORDER BY tipo_retencion", [])


def list_formas_pago():
    return client.fetch_dicts(
        "SELECT forma_pago, descripcion, por_defecto "
        "FROM CXP.TCXP_FORMA_PAGO_DGII ORDER BY forma_pago", [])


def get_proveedor_ncf_info(no_cia, punto, no_proveedor):
    """Devuelve la configuracion NCF asignada al proveedor para (cia, punto).

    Si TCXP_BPROVEEDOR.codigo_ncf esta NULL → proveedor formal (operador
    digita el NCF que viene en la factura). Si esta lleno (PI-001, etc.)
    → proveedor informal: el sistema toma POSICIONES_FIJAS (B11) y
    PROX_NCF de CNT.TCNT_NCF y los pre-llena en el form.
    """
    rows = client.fetch_dicts(
        "SELECT bp.codigo_ncf, n.posiciones_fijas, n.prox_ncf, "
        "n.ncf_inicial, n.ncf_final, n.descripcion, n.ncf_manual, "
        "n.ncf_opcional "
        "FROM CXP.TCXP_BPROVEEDOR bp "
        "LEFT JOIN CNT.TCNT_NCF n ON n.codigo_ncf = bp.codigo_ncf "
        "WHERE bp.no_cia=:1 AND bp.punto=:2 AND bp.no_proveedor=:3",
        [no_cia, punto, no_proveedor])
    if not rows:
        return {"codigo_ncf": None}
    r = rows[0]
    if not r.get('codigo_ncf'):
        return {"codigo_ncf": None}
    return r


def get_proveedor_cuenta(no_cia, punto, no_proveedor):
    """Account summary for FCXP502/503 header"""
    prov = client.fetch_dicts(
        "SELECT no_proveedor, nombre, rnc, categoria, clasificacion FROM CXP.TCXP_DPROVEEDOR WHERE no_proveedor=:1",
        [no_proveedor])
    if not prov:
        return None
    data = prov[0]
    fin = client.fetch_dicts("""
        SELECT
            NVL(SUM(saldo), 0) AS balance,
            NVL(SUM(CASE WHEN tipo_movi='Credito' THEN valor_original ELSE 0 END), 0) AS compras_acumuladas,
            NVL(SUM(CASE WHEN tipo_movi='Debito'  THEN valor_original ELSE 0 END), 0) AS pagos_acumulados,
            MAX(CASE WHEN tipo_movi='Credito' THEN TO_CHAR(fecha,'YYYY-MM-DD') END) AS fecha_ultima_compra,
            MAX(CASE WHEN tipo_movi='Debito'  THEN TO_CHAR(fecha,'YYYY-MM-DD') END) AS fecha_ultimo_pago
        FROM CXP.TCXP_DOCUMENTO
        WHERE no_cia=:1 AND punto=:2 AND no_proveedor=:3
    """, [no_cia, punto, no_proveedor])
    data.update(fin[0] if fin else {})
    return data


def list_cuentas_proveedor(no_cia, punto, no_proveedor, tipo_movi='', en_cero='N'):
    """FCXP502: document list for one proveedor"""
    conditions = ['d.no_cia=:1', 'd.punto=:2', 'd.no_proveedor=:3']
    params = [no_cia, punto, no_proveedor]
    if tipo_movi:
        params.append(tipo_movi)
        conditions.append(f'd.tipo_movi=:{len(params)}')
    if en_cero == 'N':
        conditions.append('NVL(d.saldo,0) != 0')
    elif en_cero == 'S':
        conditions.append('NVL(d.saldo,0) = 0')
    where = ' AND '.join(conditions)
    return client.fetch_dicts(f"""
        SELECT d.tipo_docu, d.no_docu, d.tipo_movi,
               TO_CHAR(d.fecha,'YYYY-MM-DD') AS fecha,
               TO_CHAR(d.fecha_vence,'YYYY-MM-DD') AS fecha_vence,
               d.valor_original, NVL(d.saldo, 0) AS saldo
        FROM CXP.TCXP_DOCUMENTO d
        WHERE {where}
        ORDER BY d.fecha DESC, d.no_docu DESC
    """, params)


def list_movimientos_proveedor(no_cia, punto, no_proveedor, desde='', hasta=''):
    """FCXP503: movements for one proveedor ordered by date"""
    conditions = ['d.no_cia=:1', 'd.punto=:2', 'd.no_proveedor=:3']
    params = [no_cia, punto, no_proveedor]
    if desde:
        params.append(desde)
        conditions.append(f"d.fecha>=TO_DATE(:{len(params)},'YYYY-MM-DD')")
    if hasta:
        params.append(hasta)
        conditions.append(f"d.fecha<=TO_DATE(:{len(params)},'YYYY-MM-DD')")
    where = ' AND '.join(conditions)
    return client.fetch_dicts(f"""
        SELECT d.tipo_docu, d.no_docu, d.tipo_movi,
               TO_CHAR(d.fecha,'YYYY-MM-DD') AS fecha,
               d.valor_original,
               CASE WHEN d.tipo_movi='Debito'  THEN d.valor_original ELSE 0 END AS debito,
               CASE WHEN d.tipo_movi='Credito' THEN d.valor_original ELSE 0 END AS credito
        FROM CXP.TCXP_DOCUMENTO d
        WHERE {where}
        ORDER BY d.fecha, d.no_docu
    """, params)


# ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────

def list_cias():
    return client.fetch_dicts(
        "SELECT no_cia, descri AS descripcion, NVL(activa,'S') activa "
        "FROM CXP.TCXP_CIAS ORDER BY no_cia", [])


def list_puntos(no_cia: str):
    return client.fetch_dicts(
        "SELECT no_cia, punto, descri AS descripcion, NVL(activo,'S') activo, "
        "NVL(mes_proceso,1) mes_proceso, NVL(ano_proceso,2025) ano_proceso "
        "FROM CXP.TCXP_PUNTO WHERE no_cia=:1 ORDER BY punto",
        [no_cia])


def list_tproveedores():
    return client.fetch_dicts(
        "SELECT tipo_proveedor AS codigo, NVL(descri,'') descripcion, "
        "clase_proveedor, NVL(cuenta,'') cuenta, "
        "NVL(cuenta_prima,'') cuenta_prima, NVL(centro_costo,'') centro_costo "
        "FROM CXP.TCXP_TPROVEEDOR ORDER BY tipo_proveedor", [])


def list_tdocu_config():
    """Full tdocu with all columns for configuration screen."""
    return client.fetch_dicts(
        "SELECT tipo_docu, tipo_movi, NVL(descri,'') descripcion, "
        "tipo_transaccion, NVL(cuenta,'') cuenta, NVL(centro_costo,'') centro_costo "
        "FROM CXP.TCXP_TDOCU ORDER BY tipo_docu", [])


def list_ciudades():
    """Ciudades from shared CXC table (no CXP-specific copy exists)."""
    return client.fetch_dicts(
        "SELECT ciudad, descripcion FROM CXC.TCXC_CIUDAD ORDER BY ciudad", [])


def list_usuarios(no_cia: str = '', punto: str = ''):
    """Acceso de usuarios al módulo CxP (FCXP103)."""
    conditions = ['1=1']
    params = []
    if no_cia:
        params.append(no_cia)
        conditions.append('no_cia=:' + str(len(params)))
    if punto:
        params.append(punto)
        conditions.append('punto=:' + str(len(params)))
    where = ' AND '.join(conditions)
    return client.fetch_dicts(
        "SELECT no_cia, punto, usuario, "
        "NVL(por_defecto,'N') por_defecto, NVL(activo,'S') activo, "
        "NVL(hacer_transacciones,'N') hacer_transacciones, "
        "NVL(generar_listado_cxp,'N') generar_listado_cxp, "
        "NVL(crear_proveedor,'N') crear_proveedor, "
        "NVL(hacer_cierre,'N') hacer_cierre, "
        "NVL(asignar_proveedor,'N') asignar_proveedor, "
        "NVL(asignar_cuenta_bancaria,'N') asignar_cuenta_bancaria, "
        "NVL(liberar_debito,'N') liberar_debito, "
        "NVL(bloquear_pago,'N') bloquear_pago "
        "FROM CXP.TCXP_USUARIO WHERE " + where + " ORDER BY no_cia, punto, usuario",
        params)


_CXP_USUARIO_FLAGS = (
    'por_defecto', 'activo', 'hacer_transacciones', 'generar_listado_cxp',
    'crear_proveedor', 'hacer_cierre', 'asignar_proveedor',
    'asignar_cuenta_bancaria', 'liberar_debito', 'bloquear_pago',
)


def _coerce_sn(v) -> str:
    s = (str(v) if v is not None else '').strip().upper()
    return 'S' if s in ('S', 'Y', '1', 'TRUE') else 'N'


def upsert_usuario(data: dict) -> dict:
    """Crea o actualiza un acceso TCXP_USUARIO (PK: no_cia, punto, usuario)."""
    no_cia  = (data.get('no_cia') or '').strip()
    punto   = (data.get('punto') or '').strip()
    usuario = (data.get('usuario') or '').strip().upper()
    if not no_cia or not punto or not usuario:
        raise ValueError('no_cia, punto y usuario son requeridos')
    flags = {k: _coerce_sn(data.get(k)) for k in _CXP_USUARIO_FLAGS}
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT 1 FROM CXP.TCXP_USUARIO WHERE no_cia=:1 AND punto=:2 AND usuario=:3",
            [no_cia, punto, usuario],
        )
        exists = cur.fetchone() is not None
        if exists:
            cur.execute(
                "UPDATE CXP.TCXP_USUARIO SET "
                "por_defecto=:1, activo=:2, hacer_transacciones=:3, "
                "generar_listado_cxp=:4, crear_proveedor=:5, hacer_cierre=:6, "
                "asignar_proveedor=:7, asignar_cuenta_bancaria=:8, "
                "liberar_debito=:9, bloquear_pago=:10 "
                "WHERE no_cia=:11 AND punto=:12 AND usuario=:13",
                [flags['por_defecto'], flags['activo'], flags['hacer_transacciones'],
                 flags['generar_listado_cxp'], flags['crear_proveedor'], flags['hacer_cierre'],
                 flags['asignar_proveedor'], flags['asignar_cuenta_bancaria'],
                 flags['liberar_debito'], flags['bloquear_pago'],
                 no_cia, punto, usuario],
            )
            action = 'updated'
        else:
            cur.execute(
                "INSERT INTO CXP.TCXP_USUARIO ("
                "no_cia, punto, usuario, por_defecto, activo, hacer_transacciones, "
                "generar_listado_cxp, crear_proveedor, hacer_cierre, asignar_proveedor, "
                "asignar_cuenta_bancaria, liberar_debito, bloquear_pago) VALUES ("
                ":1,:2,:3,:4,:5,:6,:7,:8,:9,:10,:11,:12,:13)",
                [no_cia, punto, usuario,
                 flags['por_defecto'], flags['activo'], flags['hacer_transacciones'],
                 flags['generar_listado_cxp'], flags['crear_proveedor'], flags['hacer_cierre'],
                 flags['asignar_proveedor'], flags['asignar_cuenta_bancaria'],
                 flags['liberar_debito'], flags['bloquear_pago']],
            )
            action = 'created'
        conn.commit()
    return {'ok': True, 'action': action,
            'no_cia': no_cia, 'punto': punto, 'usuario': usuario}


def delete_usuario(no_cia: str, punto: str, usuario: str) -> dict:
    if not no_cia or not punto or not usuario:
        raise ValueError('no_cia, punto y usuario son requeridos')
    with client.connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM CXP.TCXP_USUARIO WHERE no_cia=:1 AND punto=:2 AND usuario=:3",
            [no_cia, punto, usuario.upper()],
        )
        affected = cur.rowcount
        conn.commit()
    return {'ok': True, 'deleted': affected}


def rep_cuadre(no_cia: str, punto: str, mes: int, ano: int):
    """RCXP105 — Cuadre Contable por cuenta. Agrupa TCXP_DOCUMENTO del
    periodo por cuenta contable, sumando debe/haber según tipo_movi."""
    sql = (
        "SELECT cuenta, "
        "SUM(CASE WHEN tipo_movi = 'D' THEN valor_original ELSE 0 END) AS debe, "
        "SUM(CASE WHEN tipo_movi = 'C' THEN valor_original ELSE 0 END) AS haber, "
        "COUNT(*) AS docs "
        "FROM CXP.TCXP_DOCUMENTO "
        "WHERE no_cia = :1 AND punto = :2 "
        "AND EXTRACT(MONTH FROM fecha) = :3 AND EXTRACT(YEAR FROM fecha) = :4 "
        "AND NVL(status,'A') <> 'R' "
        "AND cuenta IS NOT NULL "
        "GROUP BY cuenta ORDER BY cuenta"
    )
    rows = client.fetch_dicts(sql, [no_cia, punto, mes, ano])
    total_debe = sum(float(r.get('debe') or 0) for r in rows)
    total_haber = sum(float(r.get('haber') or 0) for r in rows)
    return {
        'items': rows,
        'total_debe': total_debe,
        'total_haber': total_haber,
        'diferencia': total_debe - total_haber,
    }


def rep_retenciones(no_cia: str, punto: str, ano: int, no_proveedor: str = ''):
    """RCXP108 — Certificado de retenciones por proveedor en un año.
    Devuelve por proveedor el detalle de docs con ITBIS/ISR retenido."""
    conditions = [
        "d.no_cia = :1", "d.punto = :2",
        "EXTRACT(YEAR FROM d.fecha) = :3",
        "(NVL(d.itbis_retenido,0) > 0 OR NVL(d.isr_retenido,0) > 0)",
        "NVL(d.status,'A') <> 'R'",
    ]
    params = [no_cia, punto, ano]
    if no_proveedor:
        params.append(no_proveedor.strip())
        conditions.append('d.no_proveedor = :' + str(len(params)))
    where = ' AND '.join(conditions)
    sql = (
        "SELECT d.no_proveedor, p.nombre AS nombre_proveedor, p.rnc AS rnc_proveedor, "
        "d.tipo_docu, d.no_docu, d.fecha, d.ncf, d.posiciones_fijas_ncf, "
        "d.valor_original, d.impuesto, NVL(d.itbis_retenido,0) AS itbis_retenido, "
        "NVL(d.isr_retenido,0) AS isr_retenido, d.tipo_retencion "
        "FROM CXP.TCXP_DOCUMENTO d "
        "LEFT JOIN CXP.TCXP_BPROVEEDOR b ON b.no_cia = d.no_cia AND b.punto = d.punto AND b.no_proveedor = d.no_proveedor "
        "LEFT JOIN CXP.TCXP_DPROVEEDOR p ON p.no_proveedor = d.no_proveedor "
        f"WHERE {where} "
        "ORDER BY d.no_proveedor, d.fecha"
    )
    rows = client.fetch_dicts(sql, params)
    # Agrupar por proveedor
    grouped: dict[str, dict] = {}
    for r in rows:
        key = (r.get('no_proveedor') or '').strip()
        g = grouped.setdefault(key, {
            'no_proveedor': key,
            'nombre_proveedor': r.get('nombre_proveedor') or '',
            'rnc_proveedor': r.get('rnc_proveedor') or '',
            'documentos': [],
            'total_itbis': 0.0,
            'total_isr': 0.0,
        })
        g['documentos'].append(r)
        g['total_itbis'] += float(r.get('itbis_retenido') or 0)
        g['total_isr'] += float(r.get('isr_retenido') or 0)
    total_itbis = sum(g['total_itbis'] for g in grouped.values())
    total_isr = sum(g['total_isr'] for g in grouped.values())
    return {
        'proveedores': list(grouped.values()),
        'total_itbis': total_itbis,
        'total_isr': total_isr,
        'count_docs': len(rows),
    }


def list_barrios(ciudad: str = ''):
    conditions = ['1=1']
    params = []
    if ciudad:
        params.append(ciudad)
        conditions.append('ciudad=:1')
    where = ' AND '.join(conditions)
    return client.fetch_dicts(
        "SELECT ciudad, barrio, descripcion FROM CXC.TCXC_BARRIO WHERE " + where +
        " ORDER BY ciudad, barrio", params)


# ─── REPORTES READ-ONLY ───────────────────────────────────────────────────────

def rep_alfabetico(no_cia: str = '', punto: str = '', search: str = ''):
    """Listado alfabetico de proveedores activos con saldo."""
    conditions = ["p.activo='S'"]
    params = []
    if search:
        params.append('%' + search.upper() + '%')
        conditions.append('UPPER(p.nombre) LIKE :' + str(len(params)))
    where = ' AND '.join(conditions)
    if no_cia and punto:
        n_cia_idx = len(params) + 1
        n_pun_idx = n_cia_idx + 1
        params += [no_cia, punto]
        sql = (
            "SELECT p.no_proveedor, p.nombre, p.rnc, p.telefono, "
            "p.e_mail, p.encargado, "
            "NVL(b.saldo_inicial,0) saldo_inicial, "
            "NVL(b.compras_acumuladas,0) compras, "
            "NVL(b.pagos_acumulados,0) pagos, "
            "NVL(b.saldo_inicial,0)+NVL(b.creditos,0)-NVL(b.debitos,0) saldo "
            "FROM CXP.TCXP_DPROVEEDOR p "
            "LEFT JOIN CXP.TCXP_BPROVEEDOR b "
            "  ON b.no_proveedor=p.no_proveedor "
            "  AND b.no_cia=:" + str(n_cia_idx) +
            "  AND b.punto=:" + str(n_pun_idx) +
            " WHERE " + where + " ORDER BY p.nombre"
        )
    else:
        sql = (
            "SELECT p.no_proveedor, p.nombre, p.rnc, p.telefono, "
            "p.e_mail, p.encargado, "
            "0 saldo_inicial, 0 compras, 0 pagos, 0 saldo "
            "FROM CXP.TCXP_DPROVEEDOR p "
            "WHERE " + where + " ORDER BY p.nombre"
        )
    rows = client.fetch_dicts(sql, params)
    return {'items': rows, 'count': len(rows)}


def rep_mayor_auxiliar(no_cia: str, punto: str, desde: str, hasta: str,
                       no_proveedor: str = ''):
    """Mayor auxiliar CxP: documentos por proveedor en rango de fechas."""
    conditions = [
        "d.no_cia=:1", "d.punto=:2",
        "d.fecha BETWEEN TO_DATE(:3,'YYYY-MM-DD') AND TO_DATE(:4,'YYYY-MM-DD')"
    ]
    params = [no_cia, punto, desde, hasta]
    if no_proveedor:
        params.append(no_proveedor)
        conditions.append('d.no_proveedor=:' + str(len(params)))
    where = ' AND '.join(conditions)
    sql = (
        "SELECT d.no_proveedor, p.nombre AS nombre_proveedor, "
        "d.tipo_docu, d.no_docu, "
        "TO_CHAR(d.fecha,'YYYY-MM-DD') AS fecha, "
        "TO_CHAR(d.fecha_vence,'YYYY-MM-DD') AS fecha_vence, "
        "d.tipo_movi, d.valor_original, "
        "CASE WHEN d.tipo_movi='Credito' THEN d.valor_original ELSE 0 END credito, "
        "CASE WHEN d.tipo_movi='Debito'  THEN d.valor_original ELSE 0 END debito, "
        "NVL(d.saldo,0) saldo, d.status, d.ncf, d.detalle "
        "FROM CXP.TCXP_DOCUMENTO d "
        "JOIN CXP.TCXP_DPROVEEDOR p ON p.no_proveedor=d.no_proveedor "
        "WHERE " + where + " ORDER BY d.no_proveedor, d.fecha, d.no_docu"
    )
    rows = client.fetch_dicts(sql, params)
    total_credito = sum((r.get('credito') or 0) for r in rows)
    total_debito  = sum((r.get('debito')  or 0) for r in rows)
    return {'items': rows, 'total_credito': total_credito, 'total_debito': total_debito}


def rep_606(no_cia: str, anio: int, mes: int, punto: str = ''):
    """Reporte 606 - ITBIS en compras locales (Formato DGII)."""
    conditions = [
        "d.no_cia=:1",
        "EXTRACT(YEAR FROM d.fecha)=:2",
        "EXTRACT(MONTH FROM d.fecha)=:3",
        "d.tipo_movi='Credito'",
    ]
    params = [no_cia, anio, mes]
    if punto:
        params.append(punto)
        conditions.append('d.punto=:' + str(len(params)))
    where = ' AND '.join(conditions)
    sql = (
        "SELECT d.rnc AS rnc_proveedor, "
        "p.nombre AS nombre_proveedor, "
        "d.tipo_transaccion, "
        "d.ncf, d.posiciones_fijas_ncf AS tipo_ncf, "
        "TO_CHAR(d.fecha,'YYYY-MM-DD') AS fecha, "
        "TO_CHAR(d.fecha_vence,'YYYY-MM-DD') AS fecha_vence, "
        "NVL(d.valor_original,0) monto_facturado, "
        "NVL(d.impuesto,0) itbis_facturado, "
        "NVL(d.itbis_retenido,0) itbis_retenido, "
        "NVL(d.isr_retenido,0) isr_retenido, "
        "NVL(d.valor_bienes,0) valor_bienes, "
        "NVL(d.valor_servicio,0) valor_servicios, "
        "NVL(d.forma_pago,1) forma_pago, "
        "d.no_proveedor, d.tipo_docu, d.no_docu "
        "FROM CXP.TCXP_DOCUMENTO d "
        "LEFT JOIN CXP.TCXP_DPROVEEDOR p ON p.no_proveedor=d.no_proveedor "
        "WHERE " + where + " ORDER BY d.fecha, d.ncf"
    )
    rows = client.fetch_dicts(sql, params)
    total_monto = sum((r.get('monto_facturado') or 0) for r in rows)
    total_itbis = sum((r.get('itbis_facturado') or 0) for r in rows)
    return {'items': rows, 'count': len(rows),
            'total_monto': total_monto, 'total_itbis': total_itbis}


def rep_607(no_cia: str, anio: int, mes: int, punto: str = ''):
    """Reporte 607 - Retenciones del ISR (Formato DGII)."""
    conditions = [
        "d.no_cia=:1",
        "EXTRACT(YEAR FROM d.fecha)=:2",
        "EXTRACT(MONTH FROM d.fecha)=:3",
        "d.tipo_movi='Debito'",
        "NVL(d.isr_retenido,0)>0",
    ]
    params = [no_cia, anio, mes]
    if punto:
        params.append(punto)
        conditions.append('d.punto=:' + str(len(params)))
    where = ' AND '.join(conditions)
    sql = (
        "SELECT d.rnc AS rnc_proveedor, "
        "p.nombre AS nombre_proveedor, "
        "d.tipo_transaccion, d.ncf, "
        "TO_CHAR(d.fecha,'YYYY-MM-DD') AS fecha, "
        "NVL(d.valor_original,0) monto_pago, "
        "NVL(d.isr_retenido,0) isr_retenido, "
        "NVL(d.itbis_retenido,0) itbis_retenido, "
        "NVL(d.tipo_retencion,1) tipo_retencion, "
        "d.no_proveedor, d.tipo_docu, d.no_docu "
        "FROM CXP.TCXP_DOCUMENTO d "
        "LEFT JOIN CXP.TCXP_DPROVEEDOR p ON p.no_proveedor=d.no_proveedor "
        "WHERE " + where + " ORDER BY d.fecha, d.no_docu"
    )
    rows = client.fetch_dicts(sql, params)
    total_isr   = sum((r.get('isr_retenido')   or 0) for r in rows)
    total_itbis = sum((r.get('itbis_retenido') or 0) for r in rows)
    return {'items': rows, 'count': len(rows),
            'total_isr': total_isr, 'total_itbis': total_itbis}


# ─── PROCESOS ESCRITURA ─────────────────────────────────────────────────────


def get_siguiente_no_docu(no_cia, punto, tipo_docu):
    """Preview del siguiente numero de doc (sin commit, solo lectura).

    SEMANTICA LEGACY: TCXP_SECUENCIA.ult_docu = 'siguiente a usar' (NO
    'ultimo usado'). El form legacy lee ult_docu, lo usa como no_docu del
    documento nuevo, y DESPUES incrementa. Por eso NO sumamos 1 aqui.
    """
    rows = client.fetch_dicts(
        "SELECT NVL(ult_docu,0) AS siguiente FROM CXP.TCXP_SECUENCIA "
        "WHERE no_cia=:1 AND punto=:2 AND tipo_docu=:3",
        [no_cia, punto, tipo_docu])
    n = int(rows[0]['siguiente']) if rows else 1
    # Si el row no existe todavia, el primer no_docu sera 1.
    if n == 0:
        n = 1
    return str(n).zfill(7)


def _next_no_docu(cur, no_cia, punto, tipo_docu):
    """Reserva el siguiente no_docu y avanza TCXP_SECUENCIA (FOR UPDATE).

    Semantica legacy: ult_docu = numero a usar AHORA. Tras la INSERT,
    ult_docu pasa a ser el siguiente disponible (ult_docu + 1).
    """
    rows = cur.execute(
        "SELECT ult_docu FROM CXP.TCXP_SECUENCIA "
        "WHERE no_cia=:1 AND punto=:2 AND tipo_docu=:3 FOR UPDATE",
        [no_cia, punto, tipo_docu]).fetchone()
    if rows:
        a_usar = rows[0] or 1
        cur.execute(
            "UPDATE CXP.TCXP_SECUENCIA SET ult_docu=:1 "
            "WHERE no_cia=:2 AND punto=:3 AND tipo_docu=:4",
            [a_usar + 1, no_cia, punto, tipo_docu])
    else:
        row_max = cur.execute(
            "SELECT NVL(MAX(TO_NUMBER(no_docu)),0) FROM CXP.TCXP_DOCUMENTO "
            "WHERE no_cia=:1 AND punto=:2 AND tipo_docu=:3",
            [no_cia, punto, tipo_docu]).fetchone()
        a_usar = (row_max[0] if row_max else 0) + 1
        cur.execute(
            "INSERT INTO CXP.TCXP_SECUENCIA(no_cia,punto,tipo_docu,ult_docu) "
            "VALUES(:1,:2,:3,:4)",
            [no_cia, punto, tipo_docu, a_usar + 1])
    return str(int(a_usar)).zfill(7)


def entrada_documento(d):
    """
    Crea/actualiza un documento CxP (cabecera TCXP_DOCUMENTO + lineas TCXP_DCDOCU).
    Tipos habituales: AC, AD, BD, FP. REVERSIBLE via reversar_documento.
    """
    no_cia        = d["no_cia"]
    punto         = d.get("punto", "01")
    tipo_docu     = d["tipo_docu"]
    no_proveedor  = str(d["no_proveedor"])
    fecha         = d.get("fecha", "")
    fecha_vence   = d.get("fecha_vence", fecha)
    valor         = float(d.get("valor_original") or d.get("valor") or 0)
    # Oracle TIPO_MOVI = 'D' (debito) / 'C' (credito); accept both long and short forms
    _tm_raw       = d.get("tipo_movi", "C")
    tipo_movi     = "D" if str(_tm_raw).upper() in ("D", "DEBITO", "DEBIT") else "C"
    # TIPO_TRANSACCION is VARCHAR2(1): 'K'=compra local, 'C'=compra exterior
    # Accept legacy '01'/'02' or short 'K'/'C' forms
    _tt = str(d.get("tipo_transaccion") or "K").strip()
    tipo_transacc = _tt[0] if len(_tt) == 1 else ("C" if _tt in ("02", "C", "c") else "K")
    detalle       = d.get("detalle", "")
    no_docu       = (d.get("no_docu") or "").strip()

    with client.cursor() as cur:
        # Oracle constraint: debito=credito always; saldo<=0 for D, >=0 for C
        saldo_inicial = -valor if tipo_movi == "D" else valor

        if no_docu:
            cur.execute(
                "UPDATE CXP.TCXP_DOCUMENTO SET "
                "no_proveedor=:1, fecha=TO_DATE(:2,'YYYY-MM-DD'), "
                "fecha_vence=TO_DATE(:3,'YYYY-MM-DD'), "
                "valor_original=:4, debito=:5, credito=:6, saldo=:7, "
                "tipo_movi=:8, tipo_transaccion=:9, detalle=:10, "
                "ncf=:11, rnc=:12, impuesto=:13, "
                "itbis_retenido=:14, isr_retenido=:15, forma_pago=:16 "
                "WHERE no_cia=:17 AND punto=:18 AND tipo_docu=:19 AND no_docu=:20",
                [
                    no_proveedor, fecha, fecha_vence,
                    valor,          # :4 valor_original
                    valor,          # :5 debito (= valor_original always)
                    valor,          # :6 credito (= valor_original always)
                    saldo_inicial,  # :7 saldo
                    tipo_movi, tipo_transacc, detalle,
                    d.get("ncf", ""), d.get("rnc", ""),
                    float(d.get("impuesto") or 0),
                    float(d.get("itbis_retenido") or 0),
                    float(d.get("isr_retenido") or 0),
                    int(d.get("forma_pago") or 1),
                    no_cia, punto, tipo_docu, no_docu,
                ])
        else:
            no_docu = _next_no_docu(cur, no_cia, punto, tipo_docu)
            # NCF: el usuario teclea solo los digitos (o el sistema autoasigna
            # desde TCNT_NCF.PROX_NCF). Lo guardamos como NUMBER y el prefijo
            # (B11/B01/etc) va en POSICIONES_FIJAS_NCF.
            _ncf_raw = str(d.get("ncf") or '').strip()
            _ncf_num = int(_ncf_raw) if _ncf_raw.isdigit() else None
            _pos_ncf = (
                d.get("posiciones_fijas_ncf")
                or d.get("tipo_ncf")
                or ''
            ).strip().upper() or None
            # Campos DGI adicionales (opcionales, NULL si no se envian).
            _isc        = float(d.get("isc") or 0) or None
            _otros_imp  = float(d.get("otros_impuestos") or 0) or None
            _propina    = float(d.get("propina") or 0) or None
            _tipo_gasto = (str(d.get("tipo_gasto") or '').strip() or None)
            _tipo_ret   = d.get("tipo_retencion")
            _tipo_ret   = int(_tipo_ret) if _tipo_ret not in (None, '', 0) else None
            _forma_pago = d.get("forma_pago")
            _forma_pago = int(_forma_pago) if _forma_pago not in (None, '') else None
            cur.execute(
                "INSERT INTO CXP.TCXP_DOCUMENTO("
                "no_cia,punto,tipo_docu,no_docu,no_proveedor,tipo_movi,tipo_transaccion,"
                "fecha,fecha_vence,status,valor_original,debito,credito,saldo,"
                "impuesto,itbis_retenido,isr_retenido,rnc,ncf,posiciones_fijas_ncf,detalle,"
                "isc,otros_impuestos,propina,tipo_gasto,tipo_retencion,forma_pago,"
                "st_generado_cnt,pago_bloqueado,estado_encf,usuario,fecha_sysdate"
                ") VALUES("
                ":1,:2,:3,:4,:5,:6,:7,"
                "TO_DATE(:8,'YYYY-MM-DD'),TO_DATE(:9,'YYYY-MM-DD'),'A',:10,:11,:12,:13,"
                ":14,:15,:16,:17,:18,:19,:20,"
                ":21,:22,:23,:24,:25,:26,"
                "'N','N',0,:27,SYSDATE"
                ")",
                [
                    no_cia, punto, tipo_docu, no_docu, no_proveedor,
                    tipo_movi, tipo_transacc,
                    fecha, fecha_vence,
                    valor,          # :10 valor_original
                    valor,          # :11 debito (= valor_original always)
                    valor,          # :12 credito (= valor_original always)
                    saldo_inicial,  # :13 saldo
                    float(d.get("impuesto") or 0),
                    float(d.get("itbis_retenido") or 0),
                    float(d.get("isr_retenido") or 0),
                    d.get("rnc", ""), _ncf_num, _pos_ncf, detalle,
                    _isc, _otros_imp, _propina,
                    _tipo_gasto, _tipo_ret, _forma_pago,
                    d.get("usuario", "API"),
                ])

        cur.execute(
            "DELETE FROM CXP.TCXP_DCDOCU "
            "WHERE no_cia=:1 AND punto=:2 AND tipo_docu=:3 AND no_docu=:4",
            [no_cia, punto, tipo_docu, no_docu])

        no_prov_num = int(no_proveedor) if no_proveedor.isdigit() else 0
        for linea in d.get("lineas", []):
            tm    = linea.get("tipo_movi", "D")
            monto = float(linea.get("monto") or 0)
            cur.execute(
                "INSERT INTO CXP.TCXP_DCDOCU("
                "no_cia,punto,tipo_docu,no_docu,cuenta,centro_costo,"
                "tipo_movi,no_proveedor,monto,afecta_presupuesto"
                ") VALUES(:1,:2,:3,:4,:5,:6,:7,:8,:9,'N')",
                [no_cia, punto, tipo_docu, no_docu,
                 linea.get("cuenta", ""), linea.get("centro_costo", ""),
                 tm, no_prov_num, monto])

        cur.connection.commit()

    return no_docu


def reversar_documento(no_cia, punto, tipo_docu, no_docu, usuario="API"):
    """
    Marca documento como reversado (status=R, saldo=0).
    Solo sobre docs con status=A. REVERSIBLE en pruebas ZZTEST.
    """
    rows = client.fetch_dicts(
        "SELECT status FROM CXP.TCXP_DOCUMENTO "
        "WHERE no_cia=:1 AND punto=:2 AND tipo_docu=:3 AND no_docu=:4",
        [no_cia, punto, tipo_docu, no_docu])
    if not rows:
        raise ValueError("Documento no encontrado")
    if rows[0]["status"] == "C":
        raise ValueError("Documento ya cerrado, no se puede reversar")
    with client.cursor() as cur:
        cur.execute(
            "UPDATE CXP.TCXP_DOCUMENTO SET status='R', saldo=0, detalle='REVERSADO' "
            "WHERE no_cia=:1 AND punto=:2 AND tipo_docu=:3 AND no_docu=:4",
            [no_cia, punto, tipo_docu, no_docu])
        cur.connection.commit()
    return {"ok": True, "no_docu": no_docu, "status": "R"}


def liberar_debito(no_cia, punto, no_docu_cr, tipo_docu_cr, debitos):
    """
    Aplica credito (tipo_movi=C) contra lista de debitos (tipo_movi=D).
    - Para docs tipo_movi=C: saldo positivo se reduce (saldo - monto).
    - Para docs tipo_movi=D: saldo negativo se mueve hacia 0 (saldo + monto).
    - El doc credito queda con saldo=0 al final.
    REVERSIBLE: restaurar saldos. Solo probar con docs ZZTEST.
    """
    with client.cursor() as cur:
        for deb in debitos:
            nd    = deb.get("no_docu") or deb.get("no_doc", "")
            td    = deb.get("tipo_docu") or deb.get("tipo_doc", tipo_docu_cr)
            monto = float(deb.get("monto") or deb.get("valor_aplica") or 0)
            # Determine tipo_movi of the debit doc to apply correctly
            deb_rows = client.fetch_dicts(
                "SELECT tipo_movi FROM CXP.TCXP_DOCUMENTO "
                "WHERE no_cia=:1 AND punto=:2 AND tipo_docu=:3 AND no_docu=:4",
                [no_cia, punto, td, nd])
            tm = deb_rows[0]["tipo_movi"] if deb_rows else "C"
            if tm == "D":
                # saldo is negative; applying payment moves it toward 0
                cur.execute(
                    "UPDATE CXP.TCXP_DOCUMENTO SET saldo=NVL(saldo,0)+:1 "
                    "WHERE no_cia=:2 AND punto=:3 AND tipo_docu=:4 AND no_docu=:5",
                    [monto, no_cia, punto, td, nd])
            else:
                cur.execute(
                    "UPDATE CXP.TCXP_DOCUMENTO SET saldo=NVL(saldo,0)-:1 "
                    "WHERE no_cia=:2 AND punto=:3 AND tipo_docu=:4 AND no_docu=:5",
                    [monto, no_cia, punto, td, nd])
        cur.execute(
            "UPDATE CXP.TCXP_DOCUMENTO SET saldo=0 "
            "WHERE no_cia=:1 AND punto=:2 AND tipo_docu=:3 AND no_docu=:4",
            [no_cia, punto, tipo_docu_cr, no_docu_cr])
        cur.connection.commit()
    return {"ok": True, "aplicaciones": len(debitos)}


def bloquear_pago(no_cia, punto, tipo_docu, no_docu, bloquear=True):
    """Toggle pago_bloqueado S/N. REVERSIBLE: llamar de nuevo con bloquear=False."""
    rows = client.fetch_dicts(
        "SELECT no_docu FROM CXP.TCXP_DOCUMENTO "
        "WHERE no_cia=:1 AND punto=:2 AND tipo_docu=:3 AND no_docu=:4",
        [no_cia, punto, tipo_docu, no_docu])
    if not rows:
        raise ValueError("Documento no encontrado")
    flag = "S" if bloquear else "N"
    with client.cursor() as cur:
        cur.execute(
            "UPDATE CXP.TCXP_DOCUMENTO SET pago_bloqueado=:1 "
            "WHERE no_cia=:2 AND punto=:3 AND tipo_docu=:4 AND no_docu=:5",
            [flag, no_cia, punto, tipo_docu, no_docu])
        cur.connection.commit()
    return {"ok": True, "pago_bloqueado": flag}


# ─── CIERRE / ASIENTO (IRREVERSIBLES - construidos, NO ejecutar sin supervision) ─


def get_asiento_contable_cxp(no_cia, punto, mes, ano):
    """Consolida lineas TCXP_DCDOCU para el mes/año dado (read-only, seguro)."""
    return client.fetch_dicts(
        "SELECT l.cuenta, l.centro_costo, l.tipo_movi, "
        "SUM(CASE WHEN l.tipo_movi='D' THEN NVL(l.monto,0) ELSE 0 END) total_debito, "
        "SUM(CASE WHEN l.tipo_movi='C' THEN NVL(l.monto,0) ELSE 0 END) total_credito "
        "FROM CXP.TCXP_DCDOCU l "
        "JOIN CXP.TCXP_DOCUMENTO d "
        "  ON d.no_cia=l.no_cia AND d.punto=l.punto "
        "  AND d.tipo_docu=l.tipo_docu AND d.no_docu=l.no_docu "
        "WHERE l.no_cia=:1 AND d.punto=:2 "
        "AND EXTRACT(MONTH FROM d.fecha)=:3 AND EXTRACT(YEAR FROM d.fecha)=:4 "
        "AND d.status='A' "
        "GROUP BY l.cuenta, l.centro_costo, l.tipo_movi ORDER BY l.cuenta",
        [no_cia, punto, mes, ano])


def generar_asiento_mayor_cxp(no_cia, punto, mes_proceso, ano_proceso):
    """
    Marca docs del periodo como generados al mayor (st_generado_cnt=S).
    IRREVERSIBLE sobre datos reales. NO ejecutar sin supervision.
    """
    with client.cursor() as cur:
        cur.execute(
            "UPDATE CXP.TCXP_DOCUMENTO SET st_generado_cnt='S' "
            "WHERE no_cia=:1 AND punto=:2 "
            "AND EXTRACT(MONTH FROM fecha)=:3 AND EXTRACT(YEAR FROM fecha)=:4 "
            "AND status='A' AND NVL(st_generado_cnt,'N')='N'",
            [no_cia, punto, mes_proceso, ano_proceso])
        cur.connection.commit()
    return {"ok": True}


def cierre_cxp(no_cia, punto):
    """
    Avanza mes_proceso en TCXP_PUNTO al mes siguiente.
    IRREVERSIBLE sobre datos reales. NO ejecutar sin supervision.
    """
    row = client.fetch_one(
        "SELECT NVL(mes_proceso,1), NVL(ano_proceso,2025) "
        "FROM CXP.TCXP_PUNTO WHERE no_cia=:1 AND punto=:2",
        [no_cia, punto])
    if not row:
        raise ValueError("Punto no encontrado")
    mes, ano = row
    if mes == 12:
        nuevo_mes, nuevo_ano = 1, ano + 1
    else:
        nuevo_mes, nuevo_ano = mes + 1, ano
    with client.cursor() as cur:
        cur.execute(
            "UPDATE CXP.TCXP_PUNTO SET mes_proceso=:1, ano_proceso=:2 "
            "WHERE no_cia=:3 AND punto=:4",
            [nuevo_mes, nuevo_ano, no_cia, punto])
        cur.connection.commit()
    return {"mes": nuevo_mes, "ano": nuevo_ano}


# ─── SALDOS MENORES POR AJUSTAR (Fcxp204) ──────────────────────────────────

def get_max_saldo_menor_aj(no_cia: str, punto: str) -> float:
    row = client.fetch_one(
        "SELECT NVL(max_saldo_menor_aj,0) FROM CXP.TCXP_PUNTO "
        "WHERE no_cia=:1 AND punto=:2",
        [no_cia, punto])
    return float(row[0]) if row else 0.0


def get_saldos_menores_preview(no_cia: str, punto: str, max_saldo: float):
    """Preview de docs CxP con saldo en (-max_saldo, +max_saldo)\\{0}.
    Positivos → AC (Crédito), Negativos → AD (Débito)."""
    if max_saldo <= 0:
        return {'positivos': [], 'negativos': [], 'max_saldo': max_saldo}
    sql = """
        SELECT d.no_proveedor, NVL(p.nombre,'') AS nombre_proveedor,
               d.tipo_docu AS tipo_doc, d.no_docu AS no_doc,
               TO_CHAR(d.fecha,'YYYY-MM-DD') AS fecha,
               NVL(d.valor_original,0) AS valor,
               NVL(d.saldo,0) AS saldo, d.ncf
          FROM CXP.TCXP_DOCUMENTO d
          LEFT JOIN CXP.TCXP_DPROVEEDOR p ON p.no_proveedor=d.no_proveedor
         WHERE d.no_cia=:1 AND d.punto=:2
           AND d.status='A'
           AND ((d.saldo > 0 AND d.saldo <= :3)
                OR (d.saldo < 0 AND d.saldo >= :4))
         ORDER BY d.no_proveedor, d.fecha, d.no_docu
    """
    rows = client.fetch_dicts(sql, [no_cia, punto, max_saldo, -max_saldo])
    pos: dict = {}
    neg: dict = {}
    for r in rows:
        bucket = pos if r['saldo'] > 0 else neg
        prov = str(r['no_proveedor'] or '').strip()
        if prov not in bucket:
            bucket[prov] = {
                'no_proveedor': prov,
                'nombre_proveedor': r['nombre_proveedor'],
                'docs': [], 'total_saldo': 0.0,
            }
        bucket[prov]['docs'].append({
            'tipo_doc': r['tipo_doc'].strip(),
            'no_doc': r['no_doc'].strip(),
            'fecha': r['fecha'],
            'valor': float(r['valor']),
            'saldo': float(r['saldo']),
            'ncf': r['ncf'],
        })
        bucket[prov]['total_saldo'] += float(r['saldo'])
    return {
        'max_saldo': max_saldo,
        'positivos': sorted(pos.values(), key=lambda x: -x['total_saldo']),
        'negativos': sorted(neg.values(), key=lambda x: x['total_saldo']),
    }


# Cuenta CxP estándar del proveedor (Cuentas por Pagar - Proveedores Locales)
_CUENTA_CXP_PROVEEDOR_DEFAULT = '2101-01'


def aplicar_saldos_menores(no_cia: str, punto: str, max_saldo: float,
                           fecha: str, motivo: str = '',
                           usuario: str = '') -> dict:
    if max_saldo <= 0:
        raise ValueError("max_saldo debe ser mayor que 0")
    preview = get_saldos_menores_preview(no_cia, punto, max_saldo)
    motivo = motivo or 'DOC. GENERADO POR SALDOS MENORES POR AJUSTAR'

    tdoc_rows = client.fetch_dicts(
        "SELECT tipo_docu, tipo_movi, NVL(cuenta,'') AS cuenta, "
        "NVL(centro_costo,'0000000000') AS centro_costo "
        "FROM CXP.TCXP_TDOCU WHERE tipo_transaccion='A'",
        [])
    tdocs = {(r['tipo_movi'] or '').upper(): r for r in tdoc_rows}
    if 'C' not in tdocs or 'D' not in tdocs:
        raise ValueError("Faltan tipos AC/AD configurados en TCXP_TDOCU.")

    docs_creados = []
    with client.cursor() as cur:
        td_ac = tdocs['C']
        for grp in preview['positivos']:
            no_prov = grp['no_proveedor']
            total = round(grp['total_saldo'], 2)
            if total <= 0:
                continue
            no_doc = _next_no_docu(cur, no_cia, punto, td_ac['tipo_docu'])
            _insert_cxp_ajuste_header(cur, no_cia, punto, td_ac['tipo_docu'],
                                       no_doc, no_prov, fecha, total, motivo, 'C',
                                       usuario)
            _insert_cxp_ajuste_lineas(cur, no_cia, punto, td_ac['tipo_docu'],
                                       no_doc, no_prov, total,
                                       cuenta_ajuste=td_ac['cuenta'],
                                       centro_costo=td_ac['centro_costo'],
                                       cuenta_proveedor=_CUENTA_CXP_PROVEEDOR_DEFAULT,
                                       signo_ajuste='C',
                                       signo_proveedor='D')
            _aplicar_refedocu_cxp(cur, no_cia, punto, td_ac['tipo_docu'],
                                  no_doc, no_prov, grp['docs'])
            docs_creados.append({
                'tipo_doc': td_ac['tipo_docu'], 'no_doc': no_doc,
                'no_proveedor': no_prov, 'total': total,
                'cancelados': len(grp['docs']),
            })

        td_ad = tdocs['D']
        for grp in preview['negativos']:
            no_prov = grp['no_proveedor']
            total = round(abs(grp['total_saldo']), 2)
            if total <= 0:
                continue
            no_doc = _next_no_docu(cur, no_cia, punto, td_ad['tipo_docu'])
            _insert_cxp_ajuste_header(cur, no_cia, punto, td_ad['tipo_docu'],
                                       no_doc, no_prov, fecha, total, motivo, 'D',
                                       usuario)
            _insert_cxp_ajuste_lineas(cur, no_cia, punto, td_ad['tipo_docu'],
                                       no_doc, no_prov, total,
                                       cuenta_ajuste=td_ad['cuenta'],
                                       centro_costo=td_ad['centro_costo'],
                                       cuenta_proveedor=_CUENTA_CXP_PROVEEDOR_DEFAULT,
                                       signo_ajuste='D',
                                       signo_proveedor='C')
            _aplicar_refedocu_cxp(cur, no_cia, punto, td_ad['tipo_docu'],
                                  no_doc, no_prov, grp['docs'])
            docs_creados.append({
                'tipo_doc': td_ad['tipo_docu'], 'no_doc': no_doc,
                'no_proveedor': no_prov, 'total': total,
                'cancelados': len(grp['docs']),
            })

        cur.connection.commit()
    return {
        'ok': True,
        'docs_creados': docs_creados,
        'proveedores_positivos': len(preview['positivos']),
        'proveedores_negativos': len(preview['negativos']),
    }


def _insert_cxp_ajuste_header(cur, no_cia, punto, tipo_docu, no_docu,
                               no_proveedor, fecha, valor, motivo, tipo_movi,
                               usuario):
    cur.execute(
        "INSERT INTO CXP.TCXP_DOCUMENTO ("
        " no_cia, punto, tipo_docu, no_docu, no_proveedor, tipo_movi,"
        " tipo_transaccion, fecha, status, valor_original, saldo,"
        " detalle, usuario, st_generado_cnt, st_impresion, debito, credito"
        ") VALUES (:1,:2,:3,:4,:5,:6,'A',TO_DATE(:7,'YYYY-MM-DD'),"
        " 'A',:8,0,:9,:10,'N','N',:11,:12)",
        [no_cia, punto, tipo_docu, no_docu, str(no_proveedor), tipo_movi,
         fecha, valor, motivo, usuario,
         valor if tipo_movi == 'D' else 0,
         valor if tipo_movi == 'C' else 0])


def _insert_cxp_ajuste_lineas(cur, no_cia, punto, tipo_docu, no_docu,
                               no_proveedor, monto, cuenta_ajuste, centro_costo,
                               cuenta_proveedor, signo_ajuste, signo_proveedor):
    if cuenta_ajuste:
        cur.execute(
            "INSERT INTO CXP.TCXP_DCDOCU ("
            " no_cia, punto, tipo_docu, no_docu, cuenta, centro_costo,"
            " tipo_movi, no_proveedor, monto"
            ") VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9)",
            [no_cia, punto, tipo_docu, no_docu, cuenta_ajuste,
             centro_costo, signo_ajuste, str(no_proveedor), monto])
    if cuenta_proveedor:
        cur.execute(
            "INSERT INTO CXP.TCXP_DCDOCU ("
            " no_cia, punto, tipo_docu, no_docu, cuenta, centro_costo,"
            " tipo_movi, no_proveedor, monto"
            ") VALUES (:1,:2,:3,:4,:5,'0000000000',:6,:7,:8)",
            [no_cia, punto, tipo_docu, no_docu, cuenta_proveedor,
             signo_proveedor, str(no_proveedor), monto])


def _aplicar_refedocu_cxp(cur, no_cia, punto, tipo_docu, no_docu,
                           no_proveedor, docs_afectados):
    for d in docs_afectados:
        saldo = float(d['saldo'])
        monto = abs(saldo)
        tipo_ref = d['tipo_doc'].strip()
        no_ref = d['no_doc'].strip()
        cur.execute(
            "INSERT INTO CXP.TCXP_REFEDOCU "
            "(no_cia, punto, tipo_docu, no_docu, no_proveedor, tipo_refe, no_refe, monto) "
            "VALUES (:1,:2,:3,:4,:5,:6,:7,:8)",
            [no_cia, punto, tipo_docu, no_docu, str(no_proveedor),
             tipo_ref, no_ref, monto])
        cur.execute(
            "UPDATE CXP.TCXP_DOCUMENTO SET saldo=0, status='C' "
            "WHERE no_cia=:1 AND punto=:2 AND tipo_docu=:3 AND no_docu=:4",
            [no_cia, punto, tipo_ref, no_ref])
