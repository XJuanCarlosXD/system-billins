"""Facturación (Fat) — repositorio Oracle completo."""
from __future__ import annotations
from .. import client
from ..dtos import NCFRange, DocumentType


def _compose_ncf_dgi(posiciones: str | None, ncf_num) -> str:
    """Compone el NCF DGI real: prefijo (B01..B15) + LPAD(NCF, 8, '0').

    Devuelve '' si falta cualquiera de los dos datos.
    """
    p = (posiciones or '').strip().upper()
    try:
        n = int(ncf_num) if ncf_num else 0
    except (TypeError, ValueError):
        n = 0
    if not p or n <= 0:
        return ''
    return f"{p}{n:08d}"


# ── Tipos de Documento ───────────────────────────────────────────────────────

def list_document_types(no_cia: str, only_active: bool = True) -> list[DocumentType]:
    sql = (
        "SELECT no_cia, tipo_docu, descripcion, tipo_transaccion, "
        "NVL(activo,'S') AS activo, codigo_ncf, "
        "cuenta_contado, cuenta_propina, NVL(porciento_propina,0) AS porciento_propina, "
        "NVL(afecta_cxc,'N') AS afecta_cxc, NVL(controlar_formulario,'N') AS controlar_formulario, "
        "almacen "
        "FROM FAT.TFAT_TDOCU WHERE no_cia = :1 "
    )
    if only_active:
        sql += "AND NVL(activo,'S') = 'S' "
    sql += "ORDER BY tipo_docu"
    rows = client.fetch_dicts(sql, [no_cia])
    return [
        DocumentType(
            no_cia=r['no_cia'], tipo_docu=r['tipo_docu'],
            descripcion=r['descripcion'] or '',
            tipo_transaccion=r['tipo_transaccion'],
            activo=(r['activo'] == 'S'), codigo_ncf=r['codigo_ncf'],
            cuenta_contado=r['cuenta_contado'],
            cuenta_propina=r['cuenta_propina'],
            porciento_propina=float(r['porciento_propina']) if r['porciento_propina'] else 0.0,
            afecta_cxc=(r['afecta_cxc'] == 'S'),
            controlar_formulario=(r['controlar_formulario'] == 'S'),
            almacen=r['almacen'],
        )
        for r in rows
    ]


def upsert_document_type(no_cia, tipo_docu, descripcion, tipo_transaccion,
                         codigo_ncf=None, activo=True,
                         cuenta_contado=None, cuenta_propina=None,
                         porciento_propina=0, afecta_cxc=False,
                         controlar_formulario=False, almacen=None) -> dict:
    td = tipo_docu.strip().upper()
    with client.cursor() as cur:
        cur.execute("SELECT 1 FROM FAT.TFAT_TDOCU WHERE no_cia=:1 AND tipo_docu=:2", [no_cia, td])
        exists = cur.fetchone() is not None
        cc = cuenta_contado.strip().upper() if cuenta_contado else None
        cp = cuenta_propina.strip().upper() if cuenta_propina else None
        al = almacen.strip().upper() if almacen else None
        ncf = codigo_ncf.strip().upper() if codigo_ncf else None
        pp = float(porciento_propina) if porciento_propina else 0
        if exists:
            cur.execute(
                "UPDATE FAT.TFAT_TDOCU SET descripcion=:1,tipo_transaccion=:2,activo=:3,codigo_ncf=:4,"
                "cuenta_contado=:5,cuenta_propina=:6,porciento_propina=:7,"
                "afecta_cxc=:8,controlar_formulario=:9,almacen=:10 "
                "WHERE no_cia=:11 AND tipo_docu=:12",
                [descripcion.strip(), tipo_transaccion.strip(), 'S' if activo else 'N', ncf,
                 cc, cp, pp, 'S' if afecta_cxc else 'N', 'S' if controlar_formulario else 'N',
                 al, no_cia, td])
            action = 'updated'
        else:
            cur.execute(
                "INSERT INTO FAT.TFAT_TDOCU(no_cia,tipo_docu,descripcion,tipo_transaccion,activo,codigo_ncf,"
                "cuenta_contado,cuenta_propina,porciento_propina,afecta_cxc,controlar_formulario,almacen) "
                "VALUES(:1,:2,:3,:4,:5,:6,:7,:8,:9,:10,:11,:12)",
                [no_cia, td, descripcion.strip(), tipo_transaccion.strip(),
                 'S' if activo else 'N', ncf, cc, cp, pp,
                 'S' if afecta_cxc else 'N', 'S' if controlar_formulario else 'N', al])
            action = 'created'
        cur.connection.commit()
    return {'no_cia': no_cia, 'tipo_docu': td, 'descripcion': descripcion.strip(),
            'tipo_transaccion': tipo_transaccion.strip(), 'activo': activo,
            'codigo_ncf': ncf, 'cuenta_contado': cc, 'cuenta_propina': cp,
            'porciento_propina': pp, 'afecta_cxc': afecta_cxc,
            'controlar_formulario': controlar_formulario, 'almacen': al, 'action': action}


# ── NCF ──────────────────────────────────────────────────────────────────────

def list_ncf_ranges(no_cia: str, punto: str) -> list[NCFRange]:
    rows = client.fetch_dicts(
        "SELECT no_localidad, codigo_ncf, tipo_ncf_fiscal, ncf_inicial, ncf_final, prox_ncf, "
        "NVL(ncf_manual,'N') AS ncf_manual, NVL(ncf_opcional,'N') AS ncf_opcional, "
        "NVL(cant_min_ncf,0) AS cant_min_ncf, "
        "posiciones_fijas, descripcion "
        "FROM CNT.TCNT_NCF WHERE no_localidad=:1 ORDER BY codigo_ncf", [no_cia])
    return [NCFRange(no_cia=no_cia, punto=punto, codigo_ncf=r['codigo_ncf'],
                     tipo_ncf_fiscal=r['tipo_ncf_fiscal'] or '',
                     ncf_inicial=int(r['ncf_inicial'] or 0), ncf_final=int(r['ncf_final'] or 0),
                     prox_ncf=int(r['prox_ncf'] or 0), ncf_manual=(r['ncf_manual'] == 'S'),
                     ncf_opcional=(r['ncf_opcional'] == 'S'), cant_min_ncf=int(r['cant_min_ncf'] or 0),
                     posiciones_fijas=(r['posiciones_fijas'] or '').strip().upper(),
                     descripcion=(r['descripcion'] or '').strip())
            for r in rows]


def upsert_ncf_range(no_cia, codigo_ncf, tipo_ncf_fiscal, ncf_inicial, ncf_final,
                     prox_ncf=None, ncf_manual=False, ncf_opcional=False, cant_min_ncf=0) -> dict:
    prox = int(prox_ncf if prox_ncf is not None else ncf_inicial)
    with client.cursor() as cur:
        cur.execute("SELECT 1 FROM CNT.TCNT_NCF WHERE no_localidad=:1 AND codigo_ncf=:2",
                    [no_cia, codigo_ncf.strip().upper()])
        exists = cur.fetchone() is not None
        params = [tipo_ncf_fiscal.strip().upper(), int(ncf_inicial), int(ncf_final), prox,
                  'S' if ncf_manual else 'N', 'S' if ncf_opcional else 'N', int(cant_min_ncf),
                  no_cia, codigo_ncf.strip().upper()]
        if exists:
            cur.execute(
                "UPDATE CNT.TCNT_NCF SET tipo_ncf_fiscal=:1,ncf_inicial=:2,ncf_final=:3,prox_ncf=:4,"
                "ncf_manual=:5,ncf_opcional=:6,cant_min_ncf=:7 WHERE no_localidad=:8 AND codigo_ncf=:9",
                params)
        else:
            cur.execute(
                "INSERT INTO CNT.TCNT_NCF(no_localidad,codigo_ncf,tipo_ncf_fiscal,ncf_inicial,ncf_final,"
                "prox_ncf,ncf_manual,ncf_opcional,cant_min_ncf) VALUES(:1,:2,:3,:4,:5,:6,:7,:8,:9)",
                [no_cia, codigo_ncf.strip().upper(), tipo_ncf_fiscal.strip().upper(),
                 int(ncf_inicial), int(ncf_final), prox,
                 'S' if ncf_manual else 'N', 'S' if ncf_opcional else 'N', int(cant_min_ncf)])
        cur.connection.commit()
    return {'no_cia': no_cia, 'codigo_ncf': codigo_ncf.strip().upper(),
            'tipo_ncf_fiscal': tipo_ncf_fiscal.strip().upper(), 'ncf_inicial': int(ncf_inicial),
            'ncf_final': int(ncf_final), 'prox_ncf': prox, 'action': 'updated' if exists else 'created'}


def list_all_ncf_ranges() -> list[NCFRange]:
    rows = client.fetch_dicts(
        "SELECT no_localidad, codigo_ncf, tipo_ncf_fiscal, ncf_inicial, ncf_final, prox_ncf, "
        "NVL(ncf_manual,'N') AS ncf_manual, NVL(ncf_opcional,'N') AS ncf_opcional, "
        "NVL(cant_min_ncf,0) AS cant_min_ncf, "
        "posiciones_fijas, descripcion FROM CNT.TCNT_NCF ORDER BY no_localidad, codigo_ncf")
    return [NCFRange(no_cia=r['no_localidad'], punto='01', codigo_ncf=r['codigo_ncf'],
                     tipo_ncf_fiscal=r['tipo_ncf_fiscal'] or '',
                     ncf_inicial=int(r['ncf_inicial'] or 0), ncf_final=int(r['ncf_final'] or 0),
                     prox_ncf=int(r['prox_ncf'] or 0), ncf_manual=(r['ncf_manual'] == 'S'),
                     ncf_opcional=(r['ncf_opcional'] == 'S'), cant_min_ncf=int(r['cant_min_ncf'] or 0),
                     posiciones_fijas=(r['posiciones_fijas'] or '').strip().upper(),
                     descripcion=(r['descripcion'] or '').strip())
            for r in rows]


# ── Compañías FAT ─────────────────────────────────────────────────────────────

def list_companias_fat() -> list[dict]:
    rows = client.fetch_dicts(
        "SELECT no_cia, descripcion, direccion, rnc, telefono, fax, "
        "NVL(impuesto,0) AS impuesto, NVL(tasa_us,0) AS tasa_us, "
        "NVL(max_descuento,0) AS max_descuento, NVL(activa,'S') AS activa, "
        "fecha, NVL(formulario_unico,'N') AS formulario_unico "
        "FROM FAT.TFAT_CIAS ORDER BY no_cia")
    return [{
        'no_cia': r['no_cia'],
        'descripcion': (r['descripcion'] or '').strip(),
        'direccion': (r['direccion'] or '').strip(),
        'rnc': r['rnc'] or '',
        'telefono': r['telefono'] or '',
        'fax': r['fax'] or '',
        'impuesto': float(r['impuesto'] or 0),
        'tasa_us': float(r['tasa_us'] or 0),
        'max_descuento': float(r['max_descuento'] or 0),
        'activa': r['activa'] == 'S',
        'fecha': str(r['fecha'])[:10] if r['fecha'] else None,
        'formulario_unico': r['formulario_unico'] == 'S',
    } for r in rows]


def upsert_compania_fat(no_cia, descripcion, direccion='', rnc='', telefono='', fax='',
                        impuesto=18.0, tasa_us=0.0, max_descuento=0.0, activa=True) -> dict:
    with client.cursor() as cur:
        cur.execute("SELECT 1 FROM FAT.TFAT_CIAS WHERE no_cia=:1", [no_cia])
        exists = cur.fetchone() is not None
        if exists:
            cur.execute(
                "UPDATE FAT.TFAT_CIAS SET descripcion=:1,direccion=:2,rnc=:3,telefono=:4,fax=:5,"
                "impuesto=:6,tasa_us=:7,max_descuento=:8,activa=:9 WHERE no_cia=:10",
                [descripcion, direccion, rnc, telefono, fax, impuesto, tasa_us, max_descuento,
                 'S' if activa else 'N', no_cia])
        else:
            cur.execute(
                "INSERT INTO FAT.TFAT_CIAS(no_cia,descripcion,direccion,rnc,telefono,fax,"
                "impuesto,tasa_us,max_descuento,activa) VALUES(:1,:2,:3,:4,:5,:6,:7,:8,:9,:10)",
                [no_cia, descripcion, direccion, rnc, telefono, fax, impuesto, tasa_us,
                 max_descuento, 'S' if activa else 'N'])
        cur.connection.commit()
    return {'no_cia': no_cia, 'action': 'updated' if exists else 'created'}


# ── Puntos de Trabajo ─────────────────────────────────────────────────────────

def list_puntos_fat(no_cia: str) -> list[dict]:
    rows = client.fetch_dicts(
        "SELECT no_cia, punto, descripcion, NVL(max_descuento,0) AS max_descuento, "
        "NVL(activo,'S') AS activo, NVL(ano_proceso,0) AS ano_proceso, "
        "NVL(mes_proceso,0) AS mes_proceso, NVL(mes_cierre,0) AS mes_cierre "
        "FROM FAT.TFAT_PUNTO WHERE no_cia=:1 ORDER BY punto", [no_cia])
    return [{
        'no_cia': r['no_cia'], 'punto': r['punto'],
        'descripcion': (r['descripcion'] or '').strip(),
        'max_descuento': float(r['max_descuento'] or 0),
        'activo': r['activo'] == 'S',
        'ano_proceso': int(r['ano_proceso'] or 0),
        'mes_proceso': int(r['mes_proceso'] or 0),
        'mes_cierre': int(r['mes_cierre'] or 0),
    } for r in rows]


# ── Tipos de Pago ─────────────────────────────────────────────────────────────

def list_tipos_pago(no_cia: str, punto: str) -> list[dict]:
    rows = client.fetch_dicts(
        "SELECT no_cia, punto, tipo_pago, tipo_pago_fiscal, descripcion "
        "FROM FAT.TFAT_TIPO_PAGO WHERE no_cia=:1 AND punto=:2 ORDER BY tipo_pago",
        [no_cia, punto])
    return [{'no_cia': r['no_cia'], 'punto': r['punto'], 'tipo_pago': r['tipo_pago'],
             'tipo_pago_fiscal': r['tipo_pago_fiscal'] or '',
             'descripcion': (r['descripcion'] or '').strip()} for r in rows]


# ── Tipos / Listas de Precio ──────────────────────────────────────────────────

def list_tipos_lista_precio(no_cia: str) -> list[dict]:
    rows = client.fetch_dicts(
        "SELECT no_cia, no_lista, descripcion, NVL(activa,'S') AS activa, "
        "NVL(tipo_moneda,'RD') AS tipo_moneda "
        "FROM FAT.TFAT_TIPO_PRECIO WHERE no_cia=:1 ORDER BY no_lista", [no_cia])
    return [{'no_cia': r['no_cia'], 'no_lista': r['no_lista'],
             'descripcion': (r['descripcion'] or '').strip(),
             'activa': r['activa'] == 'S', 'tipo_moneda': r['tipo_moneda']} for r in rows]


def list_lista_precio_detalle(no_cia: str, punto: str, no_lista: str) -> list[dict]:
    rows = client.fetch_dicts(
        "SELECT lp.no_cia, lp.punto, lp.no_lista, lp.no_produ, lp.precio, "
        "NVL(lp.activo,'S') AS activo, lp.nota, "
        "NVL(p.descri, lp.no_produ) AS descripcion "
        "FROM FAT.TFAT_LISTA_PRECIO lp "
        "LEFT JOIN INV.TINV_PRODUCTO p ON p.no_produ = lp.no_produ "
        "WHERE lp.no_cia=:1 AND lp.punto=:2 AND lp.no_lista=:3 ORDER BY lp.no_produ",
        [no_cia, punto, no_lista])
    return [{'no_produ': r['no_produ'], 'descripcion': (r['descripcion'] or '').strip(),
             'precio': float(r['precio'] or 0), 'activo': r['activo'] == 'S',
             'nota': r['nota'] or ''} for r in rows]


# ── Transportistas ────────────────────────────────────────────────────────────

def list_transportistas() -> list[dict]:
    rows = client.fetch_dicts(
        "SELECT codigo, descripcion, direccion, celular, usuario, "
        "NVL(status,'A') AS status, fecha "
        "FROM FAT.TFAT_TRANSPORTISTA ORDER BY descripcion")
    return [{'codigo': int(r['codigo']), 'descripcion': (r['descripcion'] or '').strip(),
             'direccion': r['direccion'] or '', 'celular': r['celular'] or '',
             'usuario': r['usuario'] or '', 'status': r['status'],
             'fecha': str(r['fecha'])[:10] if r['fecha'] else None} for r in rows]


def upsert_transportista(codigo, descripcion, direccion='', celular='', status='A') -> dict:
    with client.cursor() as cur:
        cur.execute("SELECT 1 FROM FAT.TFAT_TRANSPORTISTA WHERE codigo=:1", [int(codigo)])
        exists = cur.fetchone() is not None
        if exists:
            cur.execute(
                "UPDATE FAT.TFAT_TRANSPORTISTA SET descripcion=:1,direccion=:2,celular=:3,status=:4 "
                "WHERE codigo=:5", [descripcion, direccion, celular, status, int(codigo)])
        else:
            cur.execute(
                "INSERT INTO FAT.TFAT_TRANSPORTISTA(codigo,descripcion,direccion,celular,status,fecha) "
                "VALUES(:1,:2,:3,:4,:5,SYSDATE)",
                [int(codigo), descripcion, direccion, celular, status])
        cur.connection.commit()
    return {'codigo': int(codigo), 'action': 'updated' if exists else 'created'}


# ── Notas Pie de Factura ──────────────────────────────────────────────────────

def list_notas_fat() -> list[dict]:
    rows = client.fetch_dicts("SELECT codigo, descripcion FROM FAT.TFAT_NOTA ORDER BY codigo")
    return [{'codigo': r['codigo'], 'descripcion': (r['descripcion'] or '').strip()} for r in rows]


def upsert_nota_fat(codigo, descripcion) -> dict:
    with client.cursor() as cur:
        cur.execute("SELECT 1 FROM FAT.TFAT_NOTA WHERE codigo=:1", [codigo])
        exists = cur.fetchone() is not None
        if exists:
            cur.execute("UPDATE FAT.TFAT_NOTA SET descripcion=:1 WHERE codigo=:2",
                        [descripcion, codigo])
        else:
            cur.execute("INSERT INTO FAT.TFAT_NOTA(codigo,descripcion) VALUES(:1,:2)",
                        [codigo, descripcion])
        cur.connection.commit()
    return {'codigo': codigo, 'action': 'updated' if exists else 'created'}


# ── Conduces ──────────────────────────────────────────────────────────────────

def list_conduces(no_cia: str, punto: str, page: int = 1, page_size: int = 30,
                  search: str = '', tipo: str = '', estado: str = '',
                  fecha_desde: str = '', fecha_hasta: str = '') -> dict:
    filters = ["c.no_cia = :no_cia", "c.punto = :punto"]
    params: dict = {'no_cia': no_cia, 'punto': punto}

    if tipo:
        filters.append("c.tipo_conduce = :tipo")
        params['tipo'] = tipo.strip().upper()
    if estado == 'A':
        filters.append("NVL(c.st_anulado,'N') = 'S'")
    elif estado == 'V':
        filters.append("NVL(c.st_anulado,'N') = 'N'")
    if fecha_desde:
        filters.append("TRUNC(c.fecha) >= TO_DATE(:desde,'YYYY-MM-DD')")
        params['desde'] = fecha_desde
    if fecha_hasta:
        filters.append("TRUNC(c.fecha) <= TO_DATE(:hasta,'YYYY-MM-DD')")
        params['hasta'] = fecha_hasta
    if search:
        filters.append("(UPPER(cl.nombre) LIKE UPPER(:srch) OR c.no_conduce LIKE :srch)")
        params['srch'] = f'%{search}%'

    where = " AND ".join(filters)
    total_row = client.fetch_one(
        f"SELECT COUNT(*) FROM FAT.TFAT_CONDUCE c "
        f"LEFT JOIN CXC.TCXC_CLIENTE cl ON cl.no_cliente = c.no_cliente "
        f"WHERE {where}", params)
    total = int(total_row[0]) if total_row else 0
    if total == 0:
        return {'items': [], 'total': 0, 'page': page, 'page_size': page_size, 'total_pages': 0}

    offset = (page - 1) * page_size
    params['end_row'] = offset + page_size
    params['start_row'] = offset

    sql = f"""
        SELECT * FROM (
            SELECT a.*, ROWNUM rn FROM (
                SELECT c.no_cia, c.punto, c.tipo_conduce, c.no_conduce, c.no_cliente,
                    cl.nombre AS nombre_cliente, c.fecha, c.vendedor,
                    NVL(c.total_neto,0) AS total_neto, NVL(c.total_linea,0) AS total_linea,
                    NVL(c.impuesto,0) AS impuesto, NVL(c.descuento,0) AS descuento,
                    NVL(c.st_anulado,'N') AS st_anulado, NVL(c.st_impresion,'N') AS st_impresion,
                    c.clase, c.tipo_factura, c.no_factura, c.detalle
                FROM FAT.TFAT_CONDUCE c
                LEFT JOIN CXC.TCXC_CLIENTE cl ON cl.no_cliente = c.no_cliente
                WHERE {where}
                ORDER BY c.fecha DESC, c.no_conduce DESC
            ) a WHERE ROWNUM <= :end_row
        ) WHERE rn > :start_row
    """
    rows = client.fetch_dicts(sql, params)
    return {
        'items': [{
            'no_cia': r['no_cia'], 'punto': r['punto'],
            'tipo_conduce': r['tipo_conduce'] or '', 'no_conduce': r['no_conduce'] or '',
            'no_cliente': int(r['no_cliente'] or 0),
            'nombre_cliente': (r['nombre_cliente'] or '').strip(),
            'fecha': str(r['fecha'])[:10] if r['fecha'] else None,
            'vendedor': r['vendedor'] or '',
            'total_neto': float(r['total_neto'] or 0),
            'total_linea': float(r['total_linea'] or 0),
            'impuesto': float(r['impuesto'] or 0),
            'descuento': float(r['descuento'] or 0),
            'st_anulado': r['st_anulado'] or 'N',
            'st_impresion': r['st_impresion'] or 'N',
            'clase': r['clase'] or '',
            'tipo_factura': r['tipo_factura'] or '',
            'no_factura': r['no_factura'] or '',
            'detalle': r['detalle'] or '',
        } for r in rows],
        'total': total, 'page': page, 'page_size': page_size,
        'total_pages': max(1, (total + page_size - 1) // page_size),
    }


# ── Cuadre de Caja ────────────────────────────────────────────────────────────

def list_cuadre_caja(no_cia: str, punto: str, desde: str = '', hasta: str = '') -> list[dict]:
    # Group by date — includes FAT facturas + CXC cobros en el total.
    # Use named params so the UNION ALL can share param names.
    params: dict = {'p_cia': no_cia, 'p_pto': punto}
    where_fat = []
    where_cxc = []
    if desde:
        params['p_desde'] = desde
        where_fat.append("AND TRUNC(f.fecha) >= TO_DATE(:p_desde,'YYYY-MM-DD')")
        where_cxc.append("AND TRUNC(d.fecha) >= TO_DATE(:p_desde,'YYYY-MM-DD')")
    if hasta:
        params['p_hasta'] = hasta
        where_fat.append("AND TRUNC(f.fecha) <= TO_DATE(:p_hasta,'YYYY-MM-DD')")
        where_cxc.append("AND TRUNC(d.fecha) <= TO_DATE(:p_hasta,'YYYY-MM-DD')")
    extra_fat = " ".join(where_fat)
    extra_cxc = " ".join(where_cxc)
    sql = (
        f"SELECT fecha, MAX(no_cuadre_caja) AS no_cuadre_caja, "
        f"MAX(usuario) AS usuario, SUM(total_monto) AS total_monto "
        f"FROM ("
        f"  SELECT TRUNC(f.fecha) AS fecha, "
        f"    MAX(cc.no_cuadre_caja) AS no_cuadre_caja, "
        f"    MAX(f.usuario) AS usuario, "
        f"    SUM(fp.monto) AS total_monto "
        f"  FROM FAT.TFAT_FACTURA f "
        f"  JOIN FAT.TFAT_FORMA_PAGO fp ON fp.no_cia=f.no_cia AND fp.punto=f.punto "
        f"    AND fp.tipo_factura=f.tipo_factura AND fp.no_factura=f.no_factura "
        f"  LEFT JOIN FAT.TFAT_CUADRE_CAJA cc ON cc.no_cia=f.no_cia AND cc.punto=f.punto "
        f"    AND TRUNC(cc.fecha)=TRUNC(f.fecha) "
        f"  WHERE f.no_cia=:p_cia AND f.punto=:p_pto {extra_fat} "
        f"  GROUP BY TRUNC(f.fecha) "
        f"  UNION ALL "
        f"  SELECT TRUNC(d.fecha) AS fecha, "
        f"    NULL AS no_cuadre_caja, "
        f"    MAX(d.usuario) AS usuario, "
        f"    SUM(d.credito) AS total_monto "
        f"  FROM CXC.TCXC_DOCUMENTO d "
        f"  WHERE d.no_cia=:p_cia AND d.punto=:p_pto "
        f"    AND d.tipo_docu='RI' AND NVL(d.st_anulado,'N')='N' "
        f"    {extra_cxc} "
        f"  GROUP BY TRUNC(d.fecha) "
        f") GROUP BY fecha ORDER BY fecha DESC"
    )
    rows = client.fetch_dicts(sql, params)
    return [{'no_cuadre_caja': int(r['no_cuadre_caja'] or 0),
             'fecha': str(r['fecha'])[:10] if r['fecha'] else None,
             'usuario': (r['usuario'] or '').strip(),
             'total_monto': float(r['total_monto'] or 0)} for r in rows]


def get_cuadre_caja_detalle(no_cia: str, punto: str, tipo_factura: str,
                             desde: str, hasta: str, no_cuadre: str = '') -> list[dict]:
    # Use named params (dict) so both branches of the UNION ALL can reuse the same names.
    params: dict = {'p_cia': no_cia, 'p_pto': punto}
    where_fat = []
    where_cxc = []

    if no_cuadre:
        params['p_cuadre'] = int(no_cuadre)
        where_fat.append("AND f.NO_CUADRE_CAJA = :p_cuadre")
        where_cxc.append("AND d.NO_CUADRE_CAJA = :p_cuadre")
    else:
        if tipo_factura:
            params['p_tipo'] = tipo_factura.upper()
            where_fat.append("AND fp.tipo_factura = :p_tipo")
        if desde:
            params['p_desde'] = desde
            where_fat.append("AND TRUNC(f.fecha) >= TO_DATE(:p_desde,'YYYY-MM-DD')")
            where_cxc.append("AND TRUNC(d.fecha) >= TO_DATE(:p_desde,'YYYY-MM-DD')")
        if hasta:
            params['p_hasta'] = hasta
            where_fat.append("AND TRUNC(f.fecha) <= TO_DATE(:p_hasta,'YYYY-MM-DD')")
            where_cxc.append("AND TRUNC(d.fecha) <= TO_DATE(:p_hasta,'YYYY-MM-DD')")

    extra_fat = " ".join(where_fat)
    extra_cxc = " ".join(where_cxc)

    sql = (
        f"SELECT tipo_pago, forma_pago, cantidad, total FROM ("
        # ── Facturas: TFAT_FORMA_PAGO (efectivo, crédito, cheque, tarjeta, etc.) ──
        f"  SELECT fp.tipo_pago AS tipo_pago, "
        f"    NVL(tp.descripcion, fp.tipo_pago) AS forma_pago, "
        f"    COUNT(*) AS cantidad, SUM(fp.monto) AS total, 1 AS origen "
        f"  FROM FAT.TFAT_FORMA_PAGO fp "
        f"  JOIN FAT.TFAT_FACTURA f ON f.no_cia=fp.no_cia AND f.punto=fp.punto "
        f"    AND f.tipo_factura=fp.tipo_factura AND f.no_factura=fp.no_factura "
        f"  LEFT JOIN FAT.TFAT_TIPO_PAGO tp ON tp.no_cia=fp.no_cia AND tp.tipo_pago=fp.tipo_pago "
        f"  WHERE fp.no_cia=:p_cia AND fp.punto=:p_pto {extra_fat} "
        f"  GROUP BY fp.tipo_pago, NVL(tp.descripcion, fp.tipo_pago) "
        # ── Cobros CXC: recibos de ingreso aplicados a facturas a crédito ──
        f"  UNION ALL "
        f"  SELECT 'C'||d.forma_pago AS tipo_pago, "
        f"    'COBRO CRED - '||NVL(tp2.descripcion, d.forma_pago) AS forma_pago, "
        f"    COUNT(*) AS cantidad, SUM(d.credito) AS total, 2 AS origen "
        f"  FROM CXC.TCXC_DOCUMENTO d "
        f"  LEFT JOIN FAT.TFAT_TIPO_PAGO tp2 ON tp2.no_cia=:p_cia "
        f"    AND tp2.tipo_pago=d.forma_pago "
        f"  WHERE d.no_cia=:p_cia AND d.punto=:p_pto "
        f"    AND d.tipo_docu='RI' AND NVL(d.st_anulado,'N')='N' "
        f"    {extra_cxc} "
        f"  GROUP BY d.forma_pago, NVL(tp2.descripcion, d.forma_pago) "
        f") ORDER BY origen, tipo_pago"
    )
    rows = client.fetch_dicts(sql, params)
    return [{'tipo_pago': r['tipo_pago'],
             'forma_pago': (r['forma_pago'] or r['tipo_pago'] or '').strip(),
             'cantidad': int(r['cantidad'] or 0),
             'total': float(r['total'] or 0)} for r in rows]


# ── Cuadre de Caja · desglose por Tipo NCF (B01/B02/etc) ──────────────────────
# El cuadre del sistema viejo necesita ver cuánto se vendió por cada tipo de
# comprobante fiscal (Crédito Fiscal B01, Consumo B02, Notas de Crédito B04, etc.)
# además del breakdown por forma de pago.

def cuadre_caja_por_ncf(no_cia: str, punto: str, desde: str = '', hasta: str = '',
                          tipo_factura: str = '', no_cuadre: str = '') -> list[dict]:
    params: dict = {'p_cia': no_cia, 'p_pto': punto}
    where = []
    if no_cuadre:
        params['p_cuadre'] = int(no_cuadre)
        where.append("AND f.NO_CUADRE_CAJA = :p_cuadre")
    else:
        if tipo_factura:
            params['p_tipo'] = tipo_factura.upper()
            where.append("AND f.tipo_factura = :p_tipo")
        if desde:
            params['p_desde'] = desde
            where.append("AND TRUNC(f.fecha) >= TO_DATE(:p_desde,'YYYY-MM-DD')")
        if hasta:
            params['p_hasta'] = hasta
            where.append("AND TRUNC(f.fecha) <= TO_DATE(:p_hasta,'YYYY-MM-DD')")
    extra = ' '.join(where)
    # Group by POSICIONES_FIJAS_NCF (the real DGI prefix: B01, B02, etc.)
    # tipo_ncf_fiscal / codigo_ncf are legacy fields often empty; POSICIONES_FIJAS_NCF
    # is the authoritative source per the schema standard.
    sql = (
        "SELECT NVL(f.posiciones_fijas_ncf,'—') AS ncf_tipo, "
        "       COUNT(*)                         AS cantidad, "
        "       SUM(NVL(f.total_linea,0))        AS total_linea, "
        "       SUM(NVL(f.descuento,0))          AS descuento, "
        "       SUM(NVL(f.impuesto,0))           AS impuesto, "
        "       SUM(NVL(f.total_neto,0))         AS total_neto "
        "FROM   FAT.TFAT_FACTURA f "
        "WHERE  f.no_cia = :p_cia AND f.punto = :p_pto "
        "  AND  NVL(f.st_anulado,'N') = 'N' "
        f"  {extra} "
        "GROUP BY NVL(f.posiciones_fijas_ncf,'—') "
        "ORDER BY NVL(f.posiciones_fijas_ncf,'—')"
    )
    rows = client.fetch_dicts(sql, params)
    return [{
        'ncf_tipo':    (r['ncf_tipo'] or '').strip().upper(),
        'cantidad':    int(r['cantidad'] or 0),
        'total_linea': float(r['total_linea'] or 0),
        'descuento':   float(r['descuento'] or 0),
        'impuesto':    float(r['impuesto'] or 0),
        'total_neto':  float(r['total_neto'] or 0),
    } for r in rows]


# ── Reporte Ventas por Producto ───────────────────────────────────────────────

def rep_ventas_producto(no_cia: str, punto: str, desde: str, hasta: str,
                        vendedor: str = '', almacen: str = '') -> list[dict]:
    params: list = [no_cia, punto]
    extra = []
    if desde:
        params.append(desde)
        extra.append(f"AND TRUNC(f.fecha) >= TO_DATE(:{len(params)},'YYYY-MM-DD')")
    if hasta:
        params.append(hasta)
        extra.append(f"AND TRUNC(f.fecha) <= TO_DATE(:{len(params)},'YYYY-MM-DD')")
    if vendedor:
        params.append(vendedor.strip().upper())
        extra.append(f"AND f.vendedor = :{len(params)}")
    if almacen:
        params.append(almacen.strip())
        extra.append(f"AND l.almacen = :{len(params)}")
    extra_sql = " ".join(extra)
    rows = client.fetch_dicts(
        f"SELECT l.no_produ, NVL(l.descripcion, l.no_produ) AS descripcion, "
        f"SUM(l.cantidad) AS cantidad, "
        f"SUM(l.monto_neto) AS monto_neto, SUM(l.impuesto) AS impuesto, "
        f"SUM(l.descuento) AS descuento "
        f"FROM FAT.TFAT_FACTURAL l "
        f"JOIN FAT.TFAT_FACTURA f ON f.no_cia=l.no_cia AND f.punto=l.punto "
        f"  AND f.tipo_factura=l.tipo_factura AND f.no_factura=l.no_factura "
        f"WHERE f.no_cia=:1 AND f.punto=:2 "
        f"AND NVL(f.st_anulado,'N')='N' AND NVL(l.st_anulado,'N')='N' "
        f"{extra_sql} "
        f"GROUP BY l.no_produ, l.descripcion ORDER BY monto_neto DESC",
        params)
    return [{'no_produ': r['no_produ'], 'descripcion': (r['descripcion'] or '').strip(),
             'cantidad': float(r['cantidad'] or 0), 'monto_neto': float(r['monto_neto'] or 0),
             'impuesto': float(r['impuesto'] or 0), 'descuento': float(r['descuento'] or 0)}
            for r in rows]


# ── Reporte NCF 607 ───────────────────────────────────────────────────────────

def rep_ncf_607(no_cia: str, desde: str, hasta: str) -> list[dict]:
    params: list = [no_cia]
    extra = []
    if desde:
        params.append(desde)
        extra.append(f"AND TRUNC(f.fecha) >= TO_DATE(:{len(params)},'YYYY-MM-DD')")
    if hasta:
        params.append(hasta)
        extra.append(f"AND TRUNC(f.fecha) <= TO_DATE(:{len(params)},'YYYY-MM-DD')")
    extra_sql = " ".join(extra)
    rows = client.fetch_dicts(
        f"SELECT f.ncf, f.codigo_ncf, f.tipo_ncf_fiscal, f.no_factura, f.tipo_factura, "
        f"f.fecha, cl.rnc, cl.nombre AS nombre_cliente, "
        f"NVL(f.total_neto,0) AS total_neto, NVL(f.impuesto,0) AS impuesto, "
        f"NVL(f.total_linea,0) AS total_linea "
        f"FROM FAT.TFAT_FACTURA f "
        f"LEFT JOIN CXC.TCXC_CLIENTE cl ON cl.no_cliente = f.no_cliente "
        f"WHERE f.no_cia=:1 AND f.ncf IS NOT NULL "
        f"AND NVL(f.st_anulado,'N')='N' {extra_sql} "
        f"ORDER BY f.fecha, f.ncf",
        params)
    return [{'ncf': int(r['ncf']), 'codigo_ncf': r['codigo_ncf'] or '',
             'tipo_ncf_fiscal': r['tipo_ncf_fiscal'] or '',
             'no_factura': r['no_factura'] or '', 'tipo_factura': r['tipo_factura'] or '',
             'fecha': str(r['fecha'])[:10] if r['fecha'] else None,
             'rnc': r['rnc'] or '', 'nombre_cliente': (r['nombre_cliente'] or '').strip(),
             'total_neto': float(r['total_neto']), 'impuesto': float(r['impuesto']),
             'total_linea': float(r['total_linea'])} for r in rows]


# ── Reporte NCF Nulos ─────────────────────────────────────────────────────────

def rep_ncf_nulos(no_cia: str, desde: str, hasta: str) -> list[dict]:
    """Facturas anuladas con NCF asignado (Reporte 608 DGII - NCF Nulos/Anulados)."""
    params: list = [no_cia]
    extra = []
    if desde:
        params.append(desde)
        extra.append(f"AND TRUNC(f.fecha) >= TO_DATE(:{len(params)},'YYYY-MM-DD')")
    if hasta:
        params.append(hasta)
        extra.append(f"AND TRUNC(f.fecha) <= TO_DATE(:{len(params)},'YYYY-MM-DD')")
    extra_sql = " ".join(extra)
    rows = client.fetch_dicts(
        f"SELECT f.ncf, f.codigo_ncf, f.tipo_ncf_fiscal, f.no_factura, f.tipo_factura, "
        f"f.fecha AS fecha_anulacion, "
        f"f.tipo_anula_dgii, ta.descripcion AS motivo_anulacion "
        f"FROM FAT.TFAT_FACTURA f "
        f"LEFT JOIN FAT.TFAT_TANULACION_DGII ta ON ta.tipo = f.tipo_anula_dgii "
        f"WHERE f.no_cia=:1 AND NVL(f.st_anulado,'N')='S' "
        f"AND f.ncf IS NOT NULL {extra_sql} "
        f"ORDER BY f.fecha DESC", params)
    return [{'ncf': int(r['ncf']) if r['ncf'] else None,
             'codigo_ncf': r['codigo_ncf'] or '',
             'tipo_ncf_fiscal': r['tipo_ncf_fiscal'] or '',
             'tipo_ncf': r['codigo_ncf'] or '',
             'no_factura': r['no_factura'] or '',
             'tipo_factura': r['tipo_factura'] or '',
             # DGII 608 campos: fecha_desde/fecha_hasta = fecha de la factura (rango no disponible por factura)
             'fecha_desde': str(r['fecha_anulacion'])[:10] if r['fecha_anulacion'] else None,
             'fecha_hasta': str(r['fecha_anulacion'])[:10] if r['fecha_anulacion'] else None,
             'fecha_anulacion': str(r['fecha_anulacion'])[:10] if r['fecha_anulacion'] else None,
             'tipo_anula_dgii': r['tipo_anula_dgii'] or '',
             'motivo_anulacion': (r['motivo_anulacion'] or r['tipo_anula_dgii'] or '').strip(),
             } for r in rows]


# ── Cierres ────────────────────────────────────────────────────────────────────

def list_cierres(no_cia: str, punto: str) -> list[dict]:
    rows = client.fetch_dicts(
        "SELECT ano, mes, fecha_cierre, fecha_sysdate, usuario "
        "FROM FAT.TFAT_CIERRE WHERE no_cia=:1 AND punto=:2 ORDER BY ano DESC, mes DESC",
        [no_cia, punto])
    return [{'ano': int(r['ano']), 'mes': int(r['mes']),
             'fecha_cierre': str(r['fecha_cierre'])[:10] if r['fecha_cierre'] else None,
             'fecha_sysdate': str(r['fecha_sysdate'])[:10] if r['fecha_sysdate'] else None,
             'usuario': r['usuario'] or ''} for r in rows]


def cierre_mensual(no_cia: str, punto: str, ano: int, mes: int, usuario: str) -> dict:
    """Registra el cierre mensual del módulo de facturación."""
    with client.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM FAT.TFAT_CIERRE WHERE no_cia=:1 AND punto=:2 AND ano=:3 AND mes=:4",
            [no_cia, punto, ano, mes])
        if cur.fetchone():
            return {'status': 'already_closed', 'ano': ano, 'mes': mes}
        cur.execute(
            "INSERT INTO FAT.TFAT_CIERRE(no_cia,punto,ano,mes,fecha_cierre,fecha_sysdate,usuario) "
            "VALUES(:1,:2,:3,:4,SYSDATE,SYSDATE,:5)",
            [no_cia, punto, ano, mes, usuario])
        cur.connection.commit()
    return {'status': 'closed', 'ano': ano, 'mes': mes}


# ── Asientos Contabilidad ─────────────────────────────────────────────────────

def list_facturas_pendientes_cnt(no_cia: str, punto: str, mes: int, ano: int) -> list[dict]:
    """Facturas autorizadas que aún no tienen asiento en CNT."""
    rows = client.fetch_dicts(
        "SELECT f.tipo_factura, f.no_factura, f.fecha, f.total_neto, f.impuesto, "
        "cl.nombre AS nombre_cliente "
        "FROM FAT.TFAT_FACTURA f "
        "LEFT JOIN CXC.TCXC_CLIENTE cl ON cl.no_cliente = f.no_cliente "
        "WHERE f.no_cia=:1 AND f.punto=:2 "
        "AND EXTRACT(YEAR FROM f.fecha)=:3 AND EXTRACT(MONTH FROM f.fecha)=:4 "
        "AND NVL(f.st_generado_cnt,'N')='N' AND NVL(f.st_anulado,'N')='N' "
        "ORDER BY f.fecha, f.no_factura",
        [no_cia, punto, ano, mes])
    return [{'tipo_factura': r['tipo_factura'], 'no_factura': r['no_factura'],
             'fecha': str(r['fecha'])[:10] if r['fecha'] else None,
             'total_neto': float(r['total_neto'] or 0), 'impuesto': float(r['impuesto'] or 0),
             'nombre_cliente': (r['nombre_cliente'] or '').strip()} for r in rows]


def marcar_generado_cnt(no_cia: str, punto: str, mes: int, ano: int) -> dict:
    """Marca las facturas pendientes del mes/ano como generadas en CNT."""
    pendientes = list_facturas_pendientes_cnt(no_cia, punto, mes, ano)
    if not pendientes:
        return {'generados': 0, 'errores': 0}
    generados = 0
    errores = 0
    with client.connection() as conn:
        cur = conn.cursor()
        for f in pendientes:
            try:
                cur.execute(
                    "UPDATE FAT.TFAT_FACTURA SET st_generado_cnt='S' "
                    "WHERE no_cia=:1 AND punto=:2 AND tipo_factura=:3 AND no_factura=:4",
                    [no_cia, punto, f['tipo_factura'], f['no_factura']])
                generados += 1
            except Exception:
                errores += 1
        conn.commit()
    return {'generados': generados, 'errores': errores}


# ── Facturas ──────────────────────────────────────────────────────────────────

def count_facturas(no_cia: str, punto: str) -> int:
    row = client.fetch_one(
        "SELECT COUNT(*) FROM FAT.TFAT_FACTURA WHERE no_cia=:1 AND punto=:2", [no_cia, punto])
    return int(row[0]) if row else 0


def list_facturas(no_cia: str, punto: str, page: int = 1, page_size: int = 30,
                  search: str = '', tipo: str = '', estado: str = '',
                  fecha_desde: str = '', fecha_hasta: str = '') -> dict:
    filters = ["f.no_cia = :no_cia", "f.punto = :punto"]
    params: dict = {'no_cia': no_cia, 'punto': punto}
    if tipo:
        filters.append("f.tipo_factura = :tipo")
        params['tipo'] = tipo.strip().upper()
    if estado:
        filters.append("f.estado = :estado")
        params['estado'] = estado.strip().upper()
    if fecha_desde:
        filters.append("TRUNC(f.fecha) >= TO_DATE(:desde,'YYYY-MM-DD')")
        params['desde'] = fecha_desde
    if fecha_hasta:
        filters.append("TRUNC(f.fecha) <= TO_DATE(:hasta,'YYYY-MM-DD')")
        params['hasta'] = fecha_hasta
    if search:
        filters.append("(UPPER(c.nombre) LIKE UPPER(:srch) OR TO_CHAR(f.ncf) LIKE :srch OR UPPER(f.no_factura) LIKE UPPER(:srch))")
        params['srch'] = f'%{search}%'

    where = " AND ".join(filters)
    total_row = client.fetch_one(
        f"SELECT COUNT(*) FROM FAT.TFAT_FACTURA f "
        f"LEFT JOIN CXC.TCXC_CLIENTE c ON c.no_cliente = f.no_cliente "
        f"WHERE {where}", params)
    total = int(total_row[0]) if total_row else 0
    if total == 0:
        return {'items': [], 'total': 0, 'page': page, 'page_size': page_size, 'total_pages': 0}

    offset = (page - 1) * page_size
    params['end_row'] = offset + page_size
    params['start_row'] = offset

    sql = f"""
        SELECT * FROM (
            SELECT a.*, ROWNUM rn FROM (
                SELECT f.no_cia, f.punto, f.tipo_factura, f.no_factura, f.no_cliente,
                    c.nombre AS nombre_cliente, f.fecha, f.vendedor,
                    f.total_linea, f.descuento, f.impuesto, f.total_neto,
                    f.estado, f.ncf, f.posiciones_fijas_ncf, f.codigo_ncf, f.tipo_ncf_fiscal,
                    f.plazo_pago, f.forma_pago_fat, f.st_anulado, f.st_impresion
                FROM FAT.TFAT_FACTURA f
                LEFT JOIN CXC.TCXC_CLIENTE c ON c.no_cliente = f.no_cliente
                WHERE {where}
                ORDER BY f.fecha DESC, f.no_factura DESC
            ) a WHERE ROWNUM <= :end_row
        ) WHERE rn > :start_row
    """
    rows = client.fetch_dicts(sql, params)
    return {
        'items': [{
            'no_cia': r['no_cia'], 'punto': r['punto'],
            'tipo_factura': r['tipo_factura'] or '', 'no_factura': r['no_factura'] or '',
            'no_cliente': int(r['no_cliente'] or 0),
            'nombre_cliente': (r['nombre_cliente'] or '').strip(),
            'fecha': str(r['fecha'])[:10] if r['fecha'] else None,
            'vendedor': r['vendedor'] or '',
            'total_linea': float(r['total_linea'] or 0), 'descuento': float(r['descuento'] or 0),
            'impuesto': float(r['impuesto'] or 0), 'total_neto': float(r['total_neto'] or 0),
            'estado': r['estado'] or 'P', 'ncf': int(r['ncf']) if r['ncf'] else None,
            'posiciones_fijas_ncf': (r['posiciones_fijas_ncf'] or '').strip().upper(),
            'ncf_dgi': _compose_ncf_dgi(r['posiciones_fijas_ncf'], r['ncf']),
            'codigo_ncf': r['codigo_ncf'] or '', 'tipo_ncf_fiscal': r['tipo_ncf_fiscal'] or '',
            'plazo_pago': int(r['plazo_pago'] or 0), 'forma_pago': r['forma_pago_fat'] or '',
            'st_anulado': r['st_anulado'] or 'N', 'st_impresion': r['st_impresion'] or 'N',
        } for r in rows],
        'total': total, 'page': page, 'page_size': page_size,
        'total_pages': max(1, (total + page_size - 1) // page_size),
    }


def get_factura(no_cia: str, punto: str, tipo_factura: str, no_factura: str) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT f.no_cia, f.punto, f.tipo_factura, f.no_factura, f.no_cliente, "
        "c.nombre AS nombre_cliente, f.fecha, f.vendedor, "
        "f.total_linea, f.descuento, f.impuesto, f.total_neto, f.propina, "
        "f.estado, f.ncf, f.posiciones_fijas_ncf, f.codigo_ncf, f.tipo_ncf_fiscal, "
        "f.plazo_pago, f.forma_pago_fat, f.no_condicion_pago, "
        "f.tasa_us, f.porc_impuesto, f.nota, f.detalle, "
        "f.st_anulado, f.st_impresion, f.st_generado_cnt "
        "FROM FAT.TFAT_FACTURA f "
        "LEFT JOIN CXC.TCXC_CLIENTE c ON c.no_cliente = f.no_cliente "
        "WHERE f.no_cia=:1 AND f.punto=:2 AND f.tipo_factura=:3 AND f.no_factura=:4",
        [no_cia, punto, tipo_factura.strip().upper(), no_factura.strip()])
    if not rows:
        return None
    r = rows[0]
    lineas = client.fetch_dicts(
        "SELECT no_linea, no_produ, NVL(descripcion,'') AS descripcion, "
        "almacen, cantidad, precio, porc_descuento, descuento, "
        "porciento_impuesto, impuesto, monto_neto, cantidad_regalia, "
        "NVL(st_anulado,'N') AS st_anulado "
        "FROM FAT.TFAT_FACTURAL "
        "WHERE no_cia=:1 AND punto=:2 AND tipo_factura=:3 AND no_factura=:4 ORDER BY no_linea",
        [no_cia, punto, tipo_factura.strip().upper(), no_factura.strip()])
    return {
        'no_cia': r['no_cia'], 'punto': r['punto'], 'tipo_factura': r['tipo_factura'] or '',
        'no_factura': r['no_factura'] or '', 'no_cliente': int(r['no_cliente'] or 0),
        'nombre_cliente': (r['nombre_cliente'] or '').strip(),
        'fecha': str(r['fecha'])[:10] if r['fecha'] else None, 'vendedor': r['vendedor'] or '',
        'total_linea': float(r['total_linea'] or 0), 'descuento': float(r['descuento'] or 0),
        'impuesto': float(r['impuesto'] or 0), 'total_neto': float(r['total_neto'] or 0),
        'propina': float(r['propina'] or 0), 'estado': r['estado'] or 'P',
        'ncf': int(r['ncf']) if r['ncf'] else None,
        'posiciones_fijas_ncf': (r['posiciones_fijas_ncf'] or '').strip().upper(),
        'ncf_dgi': _compose_ncf_dgi(r['posiciones_fijas_ncf'], r['ncf']),
        'codigo_ncf': r['codigo_ncf'] or '',
        'tipo_ncf_fiscal': r['tipo_ncf_fiscal'] or '', 'plazo_pago': int(r['plazo_pago'] or 0),
        'forma_pago': r['forma_pago_fat'] or '', 'no_condicion_pago': r['no_condicion_pago'] or '',
        'tasa_us': float(r['tasa_us'] or 0), 'porc_impuesto': float(r['porc_impuesto'] or 0),
        'nota': r['nota'] or '', 'detalle': r['detalle'] or '',
        'st_anulado': r['st_anulado'] or 'N', 'st_impresion': r['st_impresion'] or 'N',
        'st_generado_cnt': r['st_generado_cnt'] or 'N',
        'lineas': [{
            'no_linea': int(l['no_linea'] or 0), 'no_produ': l['no_produ'] or '',
            'descripcion': (l['descripcion'] or '').strip(), 'almacen': l['almacen'] or '',
            'cantidad': float(l['cantidad'] or 0), 'precio': float(l['precio'] or 0),
            'porc_descuento': float(l['porc_descuento'] or 0), 'descuento': float(l['descuento'] or 0),
            'porciento_impuesto': float(l['porciento_impuesto'] or 0),
            'impuesto': float(l['impuesto'] or 0), 'monto_neto': float(l['monto_neto'] or 0),
            'cantidad_regalia': float(l['cantidad_regalia'] or 0), 'st_anulado': l['st_anulado'] or 'N',
        } for l in lineas],
    }


def list_vendedores(no_cia: str) -> list[dict]:
    rows = client.fetch_dicts(
        "SELECT VENDEDOR, NOMBRE FROM CXC.TCXC_VENDEDOR "
        "WHERE NO_CIA = :1 AND NVL(ACTIVO,'S') = 'S' ORDER BY VENDEDOR",
        [no_cia])
    return [{'vendedor': r['vendedor'] or '', 'nombre': (r['nombre'] or '').strip()} for r in rows]


def list_clientes(no_cia: str, search: str = '', page: int = 1, page_size: int = 30) -> dict:
    filters = ["no_cia = :no_cia"]
    params: dict = {'no_cia': no_cia}
    if search:
        filters.append("(UPPER(nombre) LIKE UPPER(:srch) OR TO_CHAR(no_cliente) LIKE :srch)")
        params['srch'] = f'%{search}%'
    where = " AND ".join(filters)
    total_row = client.fetch_one(
        f"SELECT COUNT(*) FROM CXC.TCXC_CLIENTE WHERE {where}", params)
    total = int(total_row[0]) if total_row else 0
    if total == 0:
        return {'items': [], 'total': 0, 'page': page, 'page_size': page_size, 'total_pages': 0}

    offset = (page - 1) * page_size
    params['end_row'] = offset + page_size
    params['start_row'] = offset

    sql = f"""
        SELECT * FROM (
            SELECT a.*, ROWNUM rn FROM (
                SELECT no_cliente, nombre, rnc, cedula, telefono,
                    ciudad, direccion, codigo_ncf, NVL(plazo,0) AS plazo
                FROM CXC.TCXC_CLIENTE WHERE {where} ORDER BY nombre
            ) a WHERE ROWNUM <= :end_row
        ) WHERE rn > :start_row
    """
    rows = client.fetch_dicts(sql, params)
    return {
        'items': [{'no_cliente': int(r['no_cliente']), 'nombre': (r['nombre'] or '').strip(),
                   'rnc': r['rnc'] or '', 'cedula': r['cedula'] or '', 'telefono': r['telefono'] or '',
                   'ciudad': r['ciudad'] or '', 'direccion': r['direccion'] or '',
                   'codigo_ncf': r['codigo_ncf'] or '', 'plazo': int(r['plazo'] or 0)}
                  for r in rows],
        'total': total, 'page': page, 'page_size': page_size,
        'total_pages': max(1, (total + page_size - 1) // page_size),
    }


def list_condiciones_pago() -> list[dict]:
    rows = client.fetch_dicts(
        "SELECT no_condicion_pago, descripcion, NVL(plazo_pago,0) AS plazo_pago, "
        "NVL(porciento,0) AS porciento, NVL(activa,'S') AS activa "
        "FROM FAT.TFAT_CONDICION_PAGO ORDER BY no_condicion_pago")
    return [{'no_condicion_pago': r['no_condicion_pago'] or '',
             'descripcion': (r['descripcion'] or '').strip(),
             'plazo_pago': int(r['plazo_pago'] or 0), 'porciento': float(r['porciento'] or 0),
             'activa': r['activa'] == 'S'} for r in rows]


def get_proximo_ncf(no_cia: str, codigo_ncf: str) -> dict:
    """Devuelve el próximo NCF disponible para una serie + el NCF DGI compuesto.

    Lee CNT.TCNT_NCF.PROX_NCF y POSICIONES_FIJAS para componer el NCF DGI.
    fetch_one devuelve tuple, acceso por índice.
    """
    if not no_cia or not codigo_ncf:
        return {}
    row = client.fetch_one(
        "SELECT PROX_NCF, POSICIONES_FIJAS, NCF_FINAL, DESCRIPCION "
        "FROM CNT.TCNT_NCF WHERE NO_LOCALIDAD=:1 AND CODIGO_NCF=:2",
        [no_cia, codigo_ncf.strip().upper()])
    if not row:
        return {}
    prox = int(row[0] or 0)
    pos = (row[1] or '').strip().upper()
    final = int(row[2] or 0)
    descripcion = (row[3] or '').strip()
    return {
        'codigo_ncf': codigo_ncf.strip().upper(),
        'prox_ncf': prox,
        'posiciones_fijas': pos,
        'descripcion': descripcion,
        'ncf_dgi_proximo': _compose_ncf_dgi(pos, prox),
        'agotado': prox > final,
    }


def ncf_ya_usado(no_cia: str, ncf_num: int) -> bool:
    """True si ese NCF ya está usado en alguna factura no anulada."""
    row = client.fetch_one(
        "SELECT COUNT(*) FROM FAT.TFAT_FACTURA "
        "WHERE NO_CIA=:1 AND NCF=:2 AND NVL(ST_ANULADO,'N')='N'",
        [no_cia, int(ncf_num)])
    return bool(row and row[0] > 0)


def search_invoices(no_cia: str, punto: str = '01', page: int = 1, page_size: int = 25,
                    search: str = '') -> dict:
    filters = ["f.no_cia = :no_cia", "f.punto = :punto"]
    params: dict = {'no_cia': no_cia, 'punto': punto}
    if search:
        filters.append("(UPPER(c.nombre) LIKE UPPER(:srch) OR TO_CHAR(f.ncf) LIKE :srch OR f.no_factura LIKE :srch)")
        params['srch'] = f'%{search}%'
    where = " AND ".join(filters)
    total_row = client.fetch_one(
        f"SELECT COUNT(*) FROM FAT.TFAT_FACTURA f "
        f"LEFT JOIN CXC.TCXC_CLIENTE c ON c.no_cliente = f.no_cliente WHERE {where}", params)
    total = int(total_row[0]) if total_row else 0
    if total == 0:
        return {'items': [], 'total': 0, 'page': page, 'page_size': page_size, 'total_pages': 0}

    offset = (page - 1) * page_size
    params['end_row'] = offset + page_size
    params['start_row'] = offset

    sql = f"""
        SELECT * FROM (
            SELECT a.*, ROWNUM rn FROM (
                SELECT f.no_cia, f.punto, f.tipo_factura, f.no_factura, f.no_cliente,
                    c.nombre AS nombre_cliente, f.fecha, f.vendedor,
                    f.total_neto, f.estado, f.ncf, f.codigo_ncf
                FROM FAT.TFAT_FACTURA f
                LEFT JOIN CXC.TCXC_CLIENTE c ON c.no_cliente = f.no_cliente
                WHERE {where} ORDER BY f.fecha DESC, f.no_factura DESC
            ) a WHERE ROWNUM <= :end_row
        ) WHERE rn > :start_row
    """
    rows = client.fetch_dicts(sql, params)
    return {
        'items': [{'no_cia': r['no_cia'], 'punto': r['punto'],
                   'tipo_factura': r['tipo_factura'] or '', 'no_factura': r['no_factura'] or '',
                   'ncf': int(r['ncf']) if r['ncf'] else None,
                   'fecha': str(r['fecha'])[:10] if r['fecha'] else None,
                   'nombre_cliente': (r['nombre_cliente'] or '').strip(),
                   'total_neto': float(r['total_neto'] or 0),
                   'estado': (r['estado'] or 'P').upper(), 'codigo_ncf': r['codigo_ncf'] or ''}
                  for r in rows],
        'total': total, 'page': page, 'page_size': page_size,
        'total_pages': (total + page_size - 1) // page_size,
    }





# -- Reporte Ventas por Vendedor -----------------------------------------------

def rep_ventas_vendedor(no_cia: str, punto: str, desde: str, hasta: str) -> list[dict]:
    params: list = [no_cia, punto]
    extra = []
    if desde:
        params.append(desde)
        extra.append(f"AND TRUNC(f.fecha) >= TO_DATE(:{len(params)},'YYYY-MM-DD')")
    if hasta:
        params.append(hasta)
        extra.append(f"AND TRUNC(f.fecha) <= TO_DATE(:{len(params)},'YYYY-MM-DD')")
    extra_sql = " ".join(extra)
    rows = client.fetch_dicts(
        f"SELECT NVL(f.vendedor,'---') AS vendedor, "
        f"NVL(v.nombre,'Sin Vendedor') AS nombre_vendedor, "
        f"COUNT(*) AS facturas, "
        f"SUM(NVL(f.total_neto,0)) AS total_neto, "
        f"SUM(NVL(f.impuesto,0)) AS total_itbis, "
        f"SUM(NVL(f.total_neto,0) + NVL(f.impuesto,0)) AS total_bruto "
        f"FROM FAT.TFAT_FACTURA f "
        f"LEFT JOIN CXC.TCXC_VENDEDOR v ON v.no_cia=f.no_cia AND v.vendedor=f.vendedor "
        f"WHERE f.no_cia=:1 AND f.punto=:2 "
        f"AND NVL(f.st_anulado,'N')='N' {extra_sql} "
        f"GROUP BY f.vendedor, v.nombre ORDER BY total_neto DESC",
        params)
    return [{'vendedor': r['vendedor'] or '---',
             'nombre_vendedor': (r['nombre_vendedor'] or 'Sin Vendedor').strip(),
             'facturas': int(r['facturas'] or 0),
             'total_neto': float(r['total_neto'] or 0),
             'total_itbis': float(r['total_itbis'] or 0),
             'total_bruto': float(r['total_bruto'] or 0)} for r in rows]


# -- Reporte Ventas por Cliente ------------------------------------------------

def rep_ventas_cliente(no_cia: str, punto: str, desde: str, hasta: str, top: int = 50) -> list[dict]:
    params: list = [no_cia, punto]
    extra = []
    if desde:
        params.append(desde)
        extra.append(f"AND TRUNC(f.fecha) >= TO_DATE(:{len(params)},'YYYY-MM-DD')")
    if hasta:
        params.append(hasta)
        extra.append(f"AND TRUNC(f.fecha) <= TO_DATE(:{len(params)},'YYYY-MM-DD')")
    extra_sql = " ".join(extra)
    top_val = max(1, int(top))
    params.append(top_val)
    top_param = len(params)
    rows = client.fetch_dicts(
        f"SELECT * FROM ("
        f"SELECT f.no_cliente, NVL(cl.nombre,'Consumidor Final') AS nombre_cliente, "
        f"COUNT(*) AS facturas, "
        f"SUM(NVL(f.total_neto,0)) AS total_neto, "
        f"SUM(NVL(f.impuesto,0)) AS total_itbis, "
        f"SUM(NVL(f.total_neto,0) + NVL(f.impuesto,0)) AS total_bruto "
        f"FROM FAT.TFAT_FACTURA f "
        f"LEFT JOIN CXC.TCXC_CLIENTE cl ON cl.no_cliente=f.no_cliente "
        f"WHERE f.no_cia=:1 AND f.punto=:2 "
        f"AND NVL(f.st_anulado,'N')='N' {extra_sql} "
        f"GROUP BY f.no_cliente, cl.nombre ORDER BY total_neto DESC"
        f") WHERE ROWNUM <= :{top_param}",
        params)
    return [{'no_cliente': int(r['no_cliente'] or 0),
             'nombre_cliente': (r['nombre_cliente'] or 'Consumidor Final').strip(),
             'facturas': int(r['facturas'] or 0),
             'total_neto': float(r['total_neto'] or 0),
             'total_itbis': float(r['total_itbis'] or 0),
             'total_bruto': float(r['total_bruto'] or 0)} for r in rows]


# -- Reporte Analitica Mensual -------------------------------------------------

def rep_analitica_mensual(no_cia: str, punto: str, ano: int) -> dict:
    # Monthly totals for the year
    rows_mes = client.fetch_dicts(
        "SELECT EXTRACT(MONTH FROM f.fecha) AS mes, "
        "COUNT(*) AS facturas, "
        "SUM(NVL(f.total_neto,0)) AS total_neto, "
        "SUM(NVL(f.impuesto,0)) AS total_itbis, "
        "SUM(NVL(f.total_neto,0) + NVL(f.impuesto,0)) AS total_bruto "
        "FROM FAT.TFAT_FACTURA f "
        "WHERE f.no_cia=:1 AND f.punto=:2 "
        "AND EXTRACT(YEAR FROM f.fecha) = :3 "
        "AND NVL(f.st_anulado,'N')='N' "
        "GROUP BY EXTRACT(MONTH FROM f.fecha) ORDER BY mes",
        [no_cia, punto, ano])
    meses = {int(r['mes']): {'mes': int(r['mes']),
                              'facturas': int(r['facturas'] or 0),
                              'total_neto': float(r['total_neto'] or 0),
                              'total_itbis': float(r['total_itbis'] or 0),
                              'total_bruto': float(r['total_bruto'] or 0)} for r in rows_mes}
    mensual = [meses.get(m, {'mes': m, 'facturas': 0, 'total_neto': 0.0,
                              'total_itbis': 0.0, 'total_bruto': 0.0}) for m in range(1, 13)]

    # Top 10 products for the year
    rows_prod = client.fetch_dicts(
        "SELECT * FROM ("
        "SELECT l.no_produ, NVL(l.descripcion, l.no_produ) AS descripcion, "
        "SUM(NVL(l.cantidad,0)) AS cantidad, "
        "SUM(NVL(l.monto_neto,0)) AS total_neto "
        "FROM FAT.TFAT_FACTURAL l "
        "JOIN FAT.TFAT_FACTURA f ON f.no_cia=l.no_cia AND f.punto=l.punto "
        "  AND f.tipo_factura=l.tipo_factura AND f.no_factura=l.no_factura "
        "WHERE f.no_cia=:1 AND f.punto=:2 "
        "AND EXTRACT(YEAR FROM f.fecha) = :3 "
        "AND NVL(f.st_anulado,'N')='N' AND NVL(l.st_anulado,'N')='N' "
        "GROUP BY l.no_produ, l.descripcion ORDER BY total_neto DESC"
        ") WHERE ROWNUM <= 10",
        [no_cia, punto, ano])
    top_productos = [{'no_produ': r['no_produ'],
                      'descripcion': (r['descripcion'] or '').strip(),
                      'cantidad': float(r['cantidad'] or 0),
                      'total_neto': float(r['total_neto'] or 0)} for r in rows_prod]

    # Top 10 clients for the year
    rows_cli = client.fetch_dicts(
        "SELECT * FROM ("
        "SELECT f.no_cliente, NVL(cl.nombre,'Consumidor Final') AS nombre_cliente, "
        "COUNT(*) AS facturas, SUM(NVL(f.total_neto,0)) AS total_neto "
        "FROM FAT.TFAT_FACTURA f "
        "LEFT JOIN CXC.TCXC_CLIENTE cl ON cl.no_cliente=f.no_cliente "
        "WHERE f.no_cia=:1 AND f.punto=:2 "
        "AND EXTRACT(YEAR FROM f.fecha) = :3 "
        "AND NVL(f.st_anulado,'N')='N' "
        "GROUP BY f.no_cliente, cl.nombre ORDER BY total_neto DESC"
        ") WHERE ROWNUM <= 10",
        [no_cia, punto, ano])
    top_clientes = [{'no_cliente': int(r['no_cliente'] or 0),
                     'nombre_cliente': (r['nombre_cliente'] or 'Consumidor Final').strip(),
                     'facturas': int(r['facturas'] or 0),
                     'total_neto': float(r['total_neto'] or 0)} for r in rows_cli]

    total_ano = sum(m['total_neto'] for m in mensual)
    total_itbis_ano = sum(m['total_itbis'] for m in mensual)
    total_facturas = sum(m['facturas'] for m in mensual)

    return {'mensual': mensual, 'top_productos': top_productos, 'top_clientes': top_clientes,
            'total_ano': total_ano, 'total_itbis_ano': total_itbis_ano,
            'total_facturas': total_facturas, 'ano': ano}

# -- Busqueda de Productos ----------------------------------------------------

def search_productos(no_cia, punto, no_lista="", search="", page=1, page_size=20, almacen="", solo_existencia=False):
    offset = (page - 1) * page_size
    end_row = offset + page_size
    # Existencia híbrida (replica del legado, verificado 2026-05-28):
    #  - almacén controlado (ctrl_exist_min='S' o ctrl_exist_max='S') → EPRODUCTO.exist_actual
    #  - almacén no controlado (ambos 'N')                            → suma de movimientos (E - S)
    # Cuando hay filtro de almacén, basta evaluar ese almacén.
    # Cuando NO hay filtro, sumamos por todos los almacenes aplicando la regla por almacén.
    if almacen:
        exist_join = (
            "LEFT JOIN ("
            "  SELECT a.no_produ, SUM(a.existencia) AS existencia FROM ("
            "    SELECT ep.no_produ, NVL(ep.exist_actual,0) AS existencia "
            "    FROM INV.TINV_EPRODUCTO ep "
            "    JOIN INV.TINV_ALMACEN al ON al.no_cia=ep.no_cia AND al.punto=ep.punto AND al.almacen=ep.almacen "
            "    WHERE ep.no_cia=:no_cia_ex AND ep.almacen=:almacen_ex "
            "      AND (NVL(al.ctrl_exist_min,'N')='S' OR NVL(al.ctrl_exist_max,'N')='S') "
            "    UNION ALL "
            "    SELECT m.no_produ, "
            "           SUM(CASE WHEN m.tipo_movi='E' THEN NVL(m.cantidad,0) "
            "                    WHEN m.tipo_movi='S' THEN -NVL(m.cantidad,0) ELSE 0 END) AS existencia "
            "    FROM INV.TINV_MOVIMIENTO m "
            "    JOIN INV.TINV_ALMACEN al ON al.no_cia=m.no_cia AND al.punto=m.punto AND al.almacen=m.almacen "
            "    WHERE m.no_cia=:no_cia_ex AND m.almacen=:almacen_ex "
            "      AND NVL(m.st_anulado,'N')='N' "
            "      AND NVL(al.ctrl_exist_min,'N')='N' AND NVL(al.ctrl_exist_max,'N')='N' "
            "    GROUP BY m.no_produ "
            "  ) a "
            "  GROUP BY a.no_produ"
            ") ex ON ex.no_produ = p.no_produ "
        )
    else:
        exist_join = (
            "LEFT JOIN ("
            "  SELECT a.no_produ, SUM(a.existencia) AS existencia FROM ("
            "    SELECT ep.no_produ, NVL(ep.exist_actual,0) AS existencia "
            "    FROM INV.TINV_EPRODUCTO ep "
            "    JOIN INV.TINV_ALMACEN al ON al.no_cia=ep.no_cia AND al.punto=ep.punto AND al.almacen=ep.almacen "
            "    WHERE ep.no_cia=:no_cia_ex "
            "      AND (NVL(al.ctrl_exist_min,'N')='S' OR NVL(al.ctrl_exist_max,'N')='S') "
            "    UNION ALL "
            "    SELECT m.no_produ, "
            "           SUM(CASE WHEN m.tipo_movi='E' THEN NVL(m.cantidad,0) "
            "                    WHEN m.tipo_movi='S' THEN -NVL(m.cantidad,0) ELSE 0 END) AS existencia "
            "    FROM INV.TINV_MOVIMIENTO m "
            "    JOIN INV.TINV_ALMACEN al ON al.no_cia=m.no_cia AND al.punto=m.punto AND al.almacen=m.almacen "
            "    WHERE m.no_cia=:no_cia_ex AND NVL(m.st_anulado,'N')='N' "
            "      AND NVL(al.ctrl_exist_min,'N')='N' AND NVL(al.ctrl_exist_max,'N')='N' "
            "    GROUP BY m.no_produ "
            "  ) a "
            "  GROUP BY a.no_produ"
            ") ex ON ex.no_produ = p.no_produ "
        )
    um_join = (
        "LEFT JOIN ("
        "  SELECT e.NO_PRODU, NVL(u.DESCRI, e.UNIDAD) AS unidad_empaque "
        "  FROM INV.TINV_EMPAQUE e "
        "  LEFT JOIN INV.TINV_UNIDAD u ON u.UNIDAD = e.UNIDAD "
        "  WHERE e.POR_DEFECTO = 'S'"
        ") um ON um.NO_PRODU = p.no_produ "
    )
    select_cols = (
        "p.no_produ, NVL(p.descri, p.no_produ) AS descri, "
        "NVL(um.unidad_empaque, '') AS unidad_empaque, "
        "NVL(p.porciento_impuesto, 0) AS porciento_impuesto, "
        "NVL(p.activo, 'S') AS activo, "
        "NVL(ex.existencia, 0) AS existencia "
    )
    if no_lista:
        base_sql = (
            "SELECT " + select_cols +
            ", NVL(lp.precio, 0) AS precio "
            "FROM INV.TINV_PRODUCTO p "
            "LEFT JOIN FAT.TFAT_LISTA_PRECIO lp "
            "  ON lp.no_produ = p.no_produ "
            "  AND lp.no_cia = :no_cia AND lp.punto = :punto AND lp.no_lista = :no_lista "
            + exist_join + um_join +
            "WHERE NVL(p.activo,'S') = 'S' "
        )
        params = {"no_cia": no_cia, "punto": punto, "no_lista": no_lista, "no_cia_ex": no_cia}
    else:
        base_sql = (
            "SELECT " + select_cols +
            ", 0 AS precio "
            "FROM INV.TINV_PRODUCTO p "
            + exist_join + um_join +
            "WHERE NVL(p.activo,'S') = 'S' "
        )
        params = {"no_cia_ex": no_cia}
    if almacen:
        params["almacen_ex"] = almacen
    if search:
        base_sql += "AND (UPPER(p.no_produ) LIKE :srch OR UPPER(p.descri) LIKE :srch) "
        params["srch"] = "%{}%".format(search.upper())
    if solo_existencia:
        base_sql += "AND NVL(ex.existencia, 0) > 0 "
    base_sql += "ORDER BY p.no_produ"
    count_sql = "SELECT COUNT(*) FROM ({})".format(base_sql)
    total_row = client.fetch_one(count_sql, params)
    total = int(total_row[0]) if total_row else 0
    if total == 0:
        return {"items": [], "total": 0, "page": page, "page_size": page_size, "total_pages": 0}
    paged_params = dict(params)
    paged_params["end_row"] = end_row
    paged_params["start_row"] = offset
    paged_sql = "SELECT * FROM ( SELECT a.*, ROWNUM rn FROM ({}) a WHERE ROWNUM <= :end_row) WHERE rn > :start_row".format(base_sql)
    rows = client.fetch_dicts(paged_sql, paged_params)
    return {
        "items": [{"no_produ": r["no_produ"], "descri": (r["descri"] or "").strip(),
                   "precio": float(r["precio"] or 0), "porciento_impuesto": float(r["porciento_impuesto"] or 0),
                   "existencia": float(r["existencia"] or 0),
                   "unidad_empaque": (r["unidad_empaque"] or "").strip(),
                   "activo": r["activo"] == "S"} for r in rows],
        "total": total, "page": page, "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
    }


# -- Empaques (unidades) por producto -----------------------------------------
# INV.TINV_EMPAQUE guarda las variantes de empaque por producto (UNIDAD,
# POR_DEFECTO, CANT_POR_EMP, PRECIO/COSTO). En facturación necesitamos saber
# si un producto tiene más de un empaque para dejar al usuario cambiar la UM.

def list_empaques_producto(no_produ: str) -> list[dict]:
    if not no_produ:
        return []
    rows = client.fetch_dicts(
        "SELECT e.unidad, "
        "       NVL(u.descri, e.unidad) AS descripcion, "
        "       NVL(e.por_defecto, 'N') AS por_defecto, "
        "       NVL(e.cant_por_emp, 1) AS cant_por_emp "
        "FROM   INV.TINV_EMPAQUE e "
        "LEFT JOIN INV.TINV_UNIDAD u ON u.unidad = e.unidad "
        "WHERE  e.no_produ = :1 "
        "ORDER BY NVL(e.por_defecto,'N') DESC, e.unidad",
        [no_produ.strip().upper()],
    )
    return [{
        "unidad": (r["unidad"] or "").strip(),
        "descripcion": (r["descripcion"] or "").strip(),
        "por_defecto": (r["por_defecto"] or "N") == "S",
        "cant_por_emp": float(r["cant_por_emp"] or 1),
    } for r in rows]


# -- Crear Factura ------------------------------------------------------------

def create_factura(no_cia, punto, tipo_factura, no_cliente, fecha, vendedor,
                   forma_pago, no_lista, nota, lineas, usuario):
    tf = tipo_factura.strip().upper()
    fp = forma_pago.strip().upper() if forma_pago else ""
    with client.cursor() as cur:
        cur.execute(
            "SELECT prox_formulario, prox_documento FROM FAT.TFAT_SECUENCIA "
            "WHERE no_cia=:1 AND punto=:2 AND tipo_docu=:3 FOR UPDATE",
            [no_cia, punto, tf])
        seq_row = cur.fetchone()
        if not seq_row:
            raise ValueError("No hay secuencia configurada para {} en {}/{}".format(tf, no_cia, punto))
        prox_formulario = int(seq_row[0] or 0)
        new_no_factura = str(seq_row[1]).strip() if seq_row[1] else str(prox_formulario)
        cur.execute(
            "SELECT tipo_transaccion, codigo_ncf, NVL(afecta_cxc,'N') AS afecta_cxc "
            "FROM FAT.TFAT_TDOCU WHERE no_cia=:1 AND tipo_docu=:2",
            [no_cia, tf])
        tdocu_row = cur.fetchone()
        tipo_transaccion = tdocu_row[0] if tdocu_row else "V"
        codigo_ncf_doc = (tdocu_row[1] or "").strip() if tdocu_row else ""
        afecta_cxc = (tdocu_row[2] or "N") if tdocu_row else "N"
        ncf_val = None
        tipo_ncf_fiscal = ""
        if codigo_ncf_doc:
            cur.execute(
                "SELECT prox_ncf, tipo_ncf_fiscal FROM CNT.TCNT_NCF "
                "WHERE no_localidad=:1 AND codigo_ncf=:2 FOR UPDATE",
                [no_cia, codigo_ncf_doc])
            ncf_row = cur.fetchone()
            if ncf_row:
                ncf_val = int(ncf_row[0] or 0)
                tipo_ncf_fiscal = (ncf_row[1] or "").strip()
        total_linea = 0.0
        total_descuento = 0.0
        total_impuesto = 0.0
        lineas_calc = []
        for idx, lin in enumerate(lineas, start=1):
            cant = float(lin.get("cantidad", 0))
            precio = float(lin.get("precio", 0))
            porc_desc = float(lin.get("porc_descuento", 0))
            porc_imp = float(lin.get("porciento_impuesto", 0))
            subtotal = cant * precio
            desc_monto = subtotal * porc_desc / 100.0
            base = subtotal - desc_monto
            imp_monto = base * porc_imp / 100.0
            neto = base + imp_monto
            total_linea += subtotal
            total_descuento += desc_monto
            total_impuesto += imp_monto
            lineas_calc.append({"no_linea": idx,
                "no_produ": lin.get("no_produ", "").strip().upper(),
                "almacen": lin.get("almacen", "").strip(),
                "descripcion": lin.get("descripcion", "").strip(),
                "cantidad": cant, "precio": precio, "porc_descuento": porc_desc,
                "descuento": desc_monto, "porciento_impuesto": porc_imp,
                "impuesto": imp_monto, "monto_neto": neto})
        total_neto = total_linea - total_descuento + total_impuesto
        cur.execute(
            "INSERT INTO FAT.TFAT_FACTURA("
            "no_cia,punto,tipo_factura,no_factura,no_cliente,fecha,vendedor,"
            "total_linea,descuento,impuesto,total_neto,estado,"
            "ncf,codigo_ncf,tipo_ncf_fiscal,"
            "st_anulado,st_impresion,st_generado_cnt,"
            "usuario,nota,no_formulario,tipo_transaccion,"
            "tasa_us,porc_impuesto,no_condicion_pago,tipo_moneda,"
            "propina,plazo_pago,afecta_cxc,forma_pago_fat,fecha_sysdate"
            ") VALUES("
            ":1,:2,:3,:4,:5,TO_DATE(:6,'YYYY-MM-DD'),:7,"
            ":8,:9,:10,:11,'A',"
            ":12,:13,:14,"
            "'N','N','N',"
            ":15,:16,:17,:18,"
            "57.5,18,'','RD',"
            "0,0,:19,:20,SYSDATE"
            ")",
            [no_cia, punto, tf, new_no_factura, no_cliente, fecha, vendedor,
             total_linea, total_descuento, total_impuesto, total_neto,
             ncf_val, codigo_ncf_doc, tipo_ncf_fiscal,
             usuario, nota, str(prox_formulario), tipo_transaccion,
             afecta_cxc, fp])
        for lin in lineas_calc:
            cur.execute(
                "INSERT INTO FAT.TFAT_FACTURAL("
                "no_cia,punto,tipo_factura,no_factura,no_linea,"
                "almacen,no_produ,cantidad,precio,"
                "porc_descuento,descuento,porciento_impuesto,impuesto,monto_neto,"
                "descripcion,st_anulado,cantidad_regalia"
                ") VALUES("
                ":1,:2,:3,:4,:5,:6,:7,:8,:9,:10,:11,:12,:13,:14,:15,'N',0"
                ")",
                [no_cia, punto, tf, new_no_factura, lin["no_linea"],
                 lin["almacen"], lin["no_produ"], lin["cantidad"], lin["precio"],
                 lin["porc_descuento"], lin["descuento"],
                 lin["porciento_impuesto"], lin["impuesto"], lin["monto_neto"],
                 lin["descripcion"]])
        if fp:
            cur.execute(
                "INSERT INTO FAT.TFAT_FORMA_PAGO("
                "no_cia,punto,tipo_factura,no_factura,tipo_pago,monto,monto_us"
                ") VALUES(:1,:2,:3,:4,:5,:6,0)",
                [no_cia, punto, tf, new_no_factura, fp, total_neto])
        cur.execute(
            "UPDATE FAT.TFAT_SECUENCIA "
            "SET prox_documento=prox_documento+1, ult_docu_impreso=:1 "
            "WHERE no_cia=:2 AND punto=:3 AND tipo_docu=:4",
            [new_no_factura, no_cia, punto, tf])
        if ncf_val is not None and codigo_ncf_doc:
            cur.execute(
                "UPDATE CNT.TCNT_NCF SET prox_ncf=prox_ncf+1 "
                "WHERE no_localidad=:1 AND codigo_ncf=:2",
                [no_cia, codigo_ncf_doc])
        cur.connection.commit()
    return {"no_factura": new_no_factura, "tipo_factura": tf, "ncf": ncf_val,
            "total_neto": total_neto, "total_linea": total_linea,
            "descuento": total_descuento, "impuesto": total_impuesto}


# -- Anular Factura -----------------------------------------------------------

def anular_factura(no_cia, punto, tipo_factura, no_factura, usuario, motivo="", liberar_ncf=False, tipo_anula_dgii=""):
    tf = tipo_factura.strip().upper()
    nf = no_factura.strip()
    with client.cursor() as cur:
        cur.execute(
            "SELECT CODIGO_NCF, NCF FROM FAT.TFAT_FACTURA "
            "WHERE no_cia=:1 AND punto=:2 AND tipo_factura=:3 AND no_factura=:4",
            [no_cia, punto, tf, nf])
        row = cur.fetchone()
        if not row:
            raise ValueError("Factura {}/{} no encontrada".format(tf, nf))
        codigo_ncf_fact, ncf_num = row[0], row[1]
        cur.execute(
            "UPDATE FAT.TFAT_FACTURA SET st_anulado='S', tipo_anula=:1, tipo_anula_dgii=:2 "
            "WHERE no_cia=:3 AND punto=:4 AND tipo_factura=:5 AND no_factura=:6",
            [motivo[:20] if motivo else "", tipo_anula_dgii or "", no_cia, punto, tf, nf])
        cur.execute(
            "UPDATE FAT.TFAT_FACTURAL SET st_anulado='S' "
            "WHERE no_cia=:1 AND punto=:2 AND tipo_factura=:3 AND no_factura=:4",
            [no_cia, punto, tf, nf])
        if liberar_ncf and codigo_ncf_fact and ncf_num:
            cur.execute(
                "UPDATE CNT.TCNT_NCF SET PROX_NCF = PROX_NCF - 1 "
                "WHERE NO_LOCALIDAD=:1 AND CODIGO_NCF=:2 AND PROX_NCF > NCF_INICIAL",
                [no_cia, codigo_ncf_fact])
        cur.connection.commit()
    return {"no_factura": nf, "tipo_factura": tf, "anulado": True, "motivo": motivo, "libero_ncf": liberar_ncf}


# -- Crear Conduce / Cotizacion -----------------------------------------------

def create_conduce(no_cia, punto, tipo_conduce, no_cliente, fecha, vendedor,
                   clase, no_lista, lineas, usuario):
    tc = tipo_conduce.strip().upper()
    cl = clase.strip().upper() if clase else "C"
    with client.cursor() as cur:
        cur.execute(
            "SELECT prox_documento FROM FAT.TFAT_SECUENCIA "
            "WHERE no_cia=:1 AND punto=:2 AND tipo_docu=:3 FOR UPDATE",
            [no_cia, punto, tc])
        seq_row = cur.fetchone()
        if not seq_row:
            raise ValueError("No hay secuencia configurada para {} en {}/{}".format(tc, no_cia, punto))
        no_conduce = str(seq_row[0]).strip() if seq_row[0] else "1"
        total_linea = 0.0
        total_descuento = 0.0
        total_impuesto = 0.0
        lineas_calc = []
        for idx, lin in enumerate(lineas, start=1):
            cant = float(lin.get("cantidad", 0))
            precio = float(lin.get("precio", 0))
            porc_desc = float(lin.get("porc_descuento", 0))
            porc_imp = float(lin.get("porciento_impuesto", 0))
            subtotal = cant * precio
            desc_monto = subtotal * porc_desc / 100.0
            base = subtotal - desc_monto
            imp_monto = base * porc_imp / 100.0
            neto = base + imp_monto
            total_linea += subtotal
            total_descuento += desc_monto
            total_impuesto += imp_monto
            lineas_calc.append({"no_linea": idx,
                "no_produ": lin.get("no_produ", "").strip().upper(),
                "almacen": lin.get("almacen", "").strip(),
                "descripcion": lin.get("descripcion", "").strip(),
                "cantidad": cant, "precio": precio, "porc_descuento": porc_desc,
                "descuento": desc_monto, "porciento_impuesto": porc_imp,
                "impuesto": imp_monto, "monto_neto": neto})
        total_neto = total_linea - total_descuento + total_impuesto
        cur.execute(
            "INSERT INTO FAT.TFAT_CONDUCE("
            "no_cia,punto,tipo_conduce,no_conduce,no_cliente,"
            "fecha,vendedor,clase,"
            "total_linea,descuento,impuesto,total_neto,"
            "st_anulado,st_impresion,tipo_factura,no_factura,"
            "no_condicion_pago,tipo_moneda,tasa_us,creado_por"
            ") VALUES("
            ":1,:2,:3,:4,:5,TO_DATE(:6,'YYYY-MM-DD'),:7,:8,"
            ":9,:10,:11,:12,"
            "'N','N','','',"
            "'',:13,57.5,:14"
            ")",
            [no_cia, punto, tc, no_conduce, no_cliente,
             fecha, vendedor, cl,
             total_linea, total_descuento, total_impuesto, total_neto,
             "RD", usuario])
        for lin in lineas_calc:
            cur.execute(
                "INSERT INTO FAT.TFAT_CONDUCEL("
                "no_cia,punto,tipo_conduce,no_conduce,no_linea,"
                "almacen,no_produ,cantidad,precio,"
                "porc_descuento,descuento,itbis,descripcion,st_anulado"
                ") VALUES("
                ":1,:2,:3,:4,:5,:6,:7,:8,:9,:10,:11,:12,:13,'N'"
                ")",
                [no_cia, punto, tc, no_conduce, lin["no_linea"],
                 lin["almacen"], lin["no_produ"], lin["cantidad"], lin["precio"],
                 lin["porc_descuento"], lin["descuento"],
                 lin["impuesto"], lin["descripcion"]])
        cur.execute(
            "UPDATE FAT.TFAT_SECUENCIA "
            "SET prox_documento=prox_documento+1, ult_docu_impreso=:1 "
            "WHERE no_cia=:2 AND punto=:3 AND tipo_docu=:4",
            [no_conduce, no_cia, punto, tc])
        cur.connection.commit()
    return {"no_conduce": no_conduce, "tipo_conduce": tc, "clase": cl,
            "total_neto": total_neto, "total_linea": total_linea,
            "descuento": total_descuento, "impuesto": total_impuesto}


# ── Lookups secundarios usados por views_print (FAT-print sprint) ─────────────

def get_vendedor_nombre(no_cia: str, vendedor: str) -> str:
    """Devuelve el nombre del vendedor o '' si no se encuentra.

    Tabla: CXC.TCXC_VENDEDOR (mismo schema usado por list_vendedores arriba).
    """
    if not vendedor:
        return ''
    row = client.fetch_one(
        "SELECT NOMBRE FROM CXC.TCXC_VENDEDOR WHERE NO_CIA = :1 AND VENDEDOR = :2",
        [no_cia, vendedor.strip().upper()])
    return (row[0] or '').strip() if row else ''


def get_condicion_pago_descripcion(no_condicion_pago: str) -> str:
    """Devuelve la descripción de la condición de pago o '' si no se encuentra.

    Tabla: FAT.TFAT_CONDICION_PAGO (mismo schema usado por list_condiciones_pago).
    """
    if not no_condicion_pago:
        return ''
    row = client.fetch_one(
        "SELECT descripcion FROM FAT.TFAT_CONDICION_PAGO "
        "WHERE no_condicion_pago = :1",
        [no_condicion_pago])
    return (row[0] or '').strip() if row else ''


# ── Dashboard ─────────────────────────────────────────────────────────────────

def ventas_dia_a_dia(no_cia: str, ano: int, mes: int) -> list[dict]:
    """Suma de TOTAL_NETO por día para el mes indicado (facturas no anuladas)."""
    rows = client.fetch_dicts(
        "SELECT TO_CHAR(FECHA,'YYYY-MM-DD') AS DIA, SUM(TOTAL_NETO) AS TOTAL "
        "FROM FAT.TFAT_FACTURA "
        "WHERE NO_CIA=:1 AND EXTRACT(YEAR FROM FECHA)=:2 AND EXTRACT(MONTH FROM FECHA)=:3 "
        "AND NVL(ST_ANULADO,'N')='N' "
        "GROUP BY TO_CHAR(FECHA,'YYYY-MM-DD') ORDER BY DIA",
        [no_cia, int(ano), int(mes)])
    return [{'dia': r['dia'], 'total': float(r['total'] or 0)} for r in rows]
