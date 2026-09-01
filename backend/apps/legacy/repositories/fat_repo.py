"""Facturación (Fat) — repositorio Oracle completo."""
from __future__ import annotations
from .. import client
from ..dtos import NCFRange, DocumentType
from apps.historial import repo as historial_repo


def _compose_ncf_dgi(posiciones: str | None, ncf_num) -> str:
    """Compone el NCF DGI real: prefijo + LPAD(NCF).

    NCF tradicional (B01..B15) usa 8 dígitos (total 11).
    e-CF (E31/E32) usa 10 dígitos (total 13).

    Devuelve '' si falta cualquiera de los dos datos.
    """
    p = (posiciones or '').strip().upper()
    try:
        n = int(ncf_num) if ncf_num else 0
    except (TypeError, ValueError):
        n = 0
    if not p or n <= 0:
        return ''
    width = 10 if p.startswith('E') else 8
    return f"{p}{n:0{width}d}"


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


def upsert_punto_fat(no_cia: str, punto: str, descripcion: str,
                     max_descuento=None, activo: bool = True,
                     ano_proceso: int = 0, mes_proceso: int = 0,
                     mes_cierre: int = 0) -> dict:
    """Crea o actualiza un Punto de Trabajo en FAT.TFAT_PUNTO.

    Schema real: NO_CIA(2), PUNTO(2), DESCRIPCION(40) NOT NULL,
    MAX_DESCUENTO NUM, ACTIVO(1) S/N, ANO_PROCESO/MES_PROCESO/MES_CIERRE NUM NOT NULL.
    Columnas NOT NULL adicionales (ITBIS_EN_PRECIO, USAR_CONDICION_PAGO, RESERVAR,
    CANTIDAD_COPIAS, USAR_PEDIDO_PUNTO_VENTA) tienen DEFAULT a nivel BD, por lo
    que el INSERT puede omitirlas.
    """
    no_cia_s = str(no_cia).strip()
    punto_s = str(punto).strip()
    desc = str(descripcion or '').strip()
    if not no_cia_s:
        raise ValueError('no_cia es requerido')
    if not punto_s:
        raise ValueError('punto es requerido')
    if len(no_cia_s) > 2:
        raise ValueError('no_cia no puede exceder 2 caracteres')
    if len(punto_s) > 2:
        raise ValueError('punto no puede exceder 2 caracteres')
    if not desc:
        raise ValueError('descripcion es requerida')
    if len(desc) > 40:
        raise ValueError('descripcion no puede exceder 40 caracteres')
    md = None if max_descuento is None or max_descuento == '' else float(max_descuento)
    act = 'S' if (activo is True or str(activo).upper() in ('S', 'TRUE', '1')) else 'N'
    ano = int(ano_proceso or 0)
    mes = int(mes_proceso or 0)
    mcie = int(mes_cierre or 0)
    with client.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM FAT.TFAT_PUNTO WHERE no_cia=:1 AND punto=:2",
            [no_cia_s, punto_s])
        exists = cur.fetchone() is not None
        if exists:
            cur.execute(
                "UPDATE FAT.TFAT_PUNTO SET descripcion=:1, max_descuento=:2, "
                "activo=:3, ano_proceso=:4, mes_proceso=:5, mes_cierre=:6 "
                "WHERE no_cia=:7 AND punto=:8",
                [desc, md, act, ano, mes, mcie, no_cia_s, punto_s])
        else:
            cur.execute(
                "INSERT INTO FAT.TFAT_PUNTO("
                "no_cia, punto, descripcion, max_descuento, activo, "
                "ano_proceso, mes_proceso, mes_cierre) "
                "VALUES(:1,:2,:3,:4,:5,:6,:7,:8)",
                [no_cia_s, punto_s, desc, md, act, ano, mes, mcie])
        cur.connection.commit()
    return {'no_cia': no_cia_s, 'punto': punto_s,
            'descripcion': desc,
            'max_descuento': float(md or 0), 'activo': act == 'S',
            'ano_proceso': ano, 'mes_proceso': mes, 'mes_cierre': mcie,
            'action': 'updated' if exists else 'created'}


# ── Tipos de Pago ─────────────────────────────────────────────────────────────

def list_tipos_pago(no_cia: str, punto: str) -> list[dict]:
    rows = client.fetch_dicts(
        "SELECT no_cia, punto, tipo_pago, tipo_pago_fiscal, descripcion "
        "FROM FAT.TFAT_TIPO_PAGO WHERE no_cia=:1 AND punto=:2 ORDER BY tipo_pago",
        [no_cia, punto])
    return [{'no_cia': r['no_cia'], 'punto': r['punto'], 'tipo_pago': r['tipo_pago'],
             'tipo_pago_fiscal': r['tipo_pago_fiscal'] or '',
             'descripcion': (r['descripcion'] or '').strip()} for r in rows]


def upsert_tipo_pago(no_cia: str, punto: str, tipo_pago: str,
                     tipo_pago_fiscal: str, descripcion: str) -> dict:
    tp = str(tipo_pago).strip()
    with client.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM FAT.TFAT_TIPO_PAGO WHERE no_cia=:1 AND punto=:2 AND tipo_pago=:3",
            [no_cia, punto, tp])
        exists = cur.fetchone() is not None
        if exists:
            cur.execute(
                "UPDATE FAT.TFAT_TIPO_PAGO SET tipo_pago_fiscal=:1, descripcion=:2 "
                "WHERE no_cia=:3 AND punto=:4 AND tipo_pago=:5",
                [str(tipo_pago_fiscal).strip(), str(descripcion).strip(), no_cia, punto, tp])
        else:
            cur.execute(
                "INSERT INTO FAT.TFAT_TIPO_PAGO(no_cia,punto,tipo_pago,tipo_pago_fiscal,descripcion) "
                "VALUES(:1,:2,:3,:4,:5)",
                [no_cia, punto, tp, str(tipo_pago_fiscal).strip(), str(descripcion).strip()])
        cur.connection.commit()
    return {'no_cia': no_cia, 'punto': punto, 'tipo_pago': tp,
            'action': 'updated' if exists else 'created'}


# ── Tipos / Listas de Precio ──────────────────────────────────────────────────

def list_tipos_lista_precio(no_cia: str) -> list[dict]:
    rows = client.fetch_dicts(
        "SELECT no_cia, no_lista, descripcion, NVL(activa,'S') AS activa, "
        "NVL(tipo_moneda,'RD') AS tipo_moneda "
        "FROM FAT.TFAT_TIPO_PRECIO WHERE no_cia=:1 ORDER BY no_lista", [no_cia])
    return [{'no_cia': r['no_cia'], 'no_lista': r['no_lista'],
             'descripcion': (r['descripcion'] or '').strip(),
             'activa': r['activa'] == 'S', 'tipo_moneda': r['tipo_moneda']} for r in rows]


def list_lista_precio_detalle(no_cia: str, punto: str, no_lista: str,
                              no_produ_desde: str = '',
                              no_produ_hasta: str = '') -> list[dict]:
    """Detalle de una lista de precio.

    Alineado con Rfat333 (Ffat310): filtros opcionales por rango de
    producto (no_produ_desde, no_produ_hasta) con LPAD(8,'0') como el
    legado. Ordena por no_produ ascendente.
    """
    filters = ["lp.no_cia=:no_cia", "lp.punto=:punto", "lp.no_lista=:no_lista"]
    params: dict = {'no_cia': no_cia, 'punto': punto, 'no_lista': no_lista}
    if no_produ_desde:
        filters.append("lp.no_produ >= LPAD(:p_desde,8,'0')")
        params['p_desde'] = no_produ_desde.strip()
    if no_produ_hasta:
        filters.append("lp.no_produ <= LPAD(:p_hasta,8,'0')")
        params['p_hasta'] = no_produ_hasta.strip()
    where = " AND ".join(filters)
    rows = client.fetch_dicts(
        f"SELECT lp.no_cia, lp.punto, lp.no_lista, lp.no_produ, lp.precio, "
        f"NVL(lp.activo,'S') AS activo, lp.nota, "
        f"NVL(p.descri, lp.no_produ) AS descripcion "
        f"FROM FAT.TFAT_LISTA_PRECIO lp "
        f"LEFT JOIN INV.TINV_PRODUCTO p ON p.no_produ = lp.no_produ "
        f"WHERE {where} ORDER BY lp.no_produ",
        params)
    return [{'no_produ': r['no_produ'], 'descripcion': (r['descripcion'] or '').strip(),
             'precio': float(r['precio'] or 0), 'activo': r['activo'] == 'S',
             'nota': r['nota'] or ''} for r in rows]


# ── Transportistas ────────────────────────────────────────────────────────────
def _normalize_no_produ(no_produ: str) -> str:
    value = (no_produ or '').strip().upper()
    return value.zfill(8) if value.isdigit() and len(value) < 8 else value


def upsert_tipo_lista_precio(no_cia: str, no_lista: str, descripcion: str,
                             activa=True, tipo_moneda: str = 'RD') -> dict:
    nl = (no_lista or '').strip().upper()
    if not nl:
        raise ValueError("no_lista requerido")
    if len(nl) > 2:
        raise ValueError("no_lista no puede exceder 2 caracteres")
    desc = (descripcion or '').strip()
    if not desc:
        raise ValueError("descripcion requerida")
    moneda = (tipo_moneda or 'RD').strip().upper()
    activo = 'S' if activa else 'N'
    with client.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM FAT.TFAT_TIPO_PRECIO WHERE no_cia=:1 AND no_lista=:2",
            [no_cia, nl])
        exists = cur.fetchone() is not None
        if exists:
            cur.execute(
                "UPDATE FAT.TFAT_TIPO_PRECIO "
                "SET descripcion=:1, activa=:2, tipo_moneda=:3 "
                "WHERE no_cia=:4 AND no_lista=:5",
                [desc, activo, moneda, no_cia, nl])
        else:
            cur.execute(
                "INSERT INTO FAT.TFAT_TIPO_PRECIO(no_cia,no_lista,descripcion,activa,tipo_moneda) "
                "VALUES(:1,:2,:3,:4,:5)",
                [no_cia, nl, desc, activo, moneda])
        cur.connection.commit()
    return {'no_cia': no_cia, 'no_lista': nl, 'action': 'updated' if exists else 'created'}


def delete_tipo_lista_precio(no_cia: str, punto: str, no_lista: str) -> dict:
    nl = (no_lista or '').strip().upper()
    with client.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) FROM FAT.TFAT_LISTA_PRECIO "
            "WHERE no_cia=:1 AND punto=:2 AND no_lista=:3",
            [no_cia, punto, nl])
        detalle_count = int(cur.fetchone()[0] or 0)
        if detalle_count:
            raise ValueError("No se puede eliminar una lista con productos; elimine el detalle primero")
        cur.execute(
            "DELETE FROM FAT.TFAT_TIPO_PRECIO WHERE no_cia=:1 AND no_lista=:2",
            [no_cia, nl])
        deleted = cur.rowcount or 0
        cur.connection.commit()
    return {'no_cia': no_cia, 'no_lista': nl, 'deleted': int(deleted)}


def upsert_lista_precio_detalle(no_cia: str, punto: str, no_lista: str,
                                no_produ: str, precio, activo=True,
                                nota: str = '') -> dict:
    nl = (no_lista or '').strip().upper()
    np = _normalize_no_produ(no_produ)
    if not all([nl, np]):
        raise ValueError("no_lista y no_produ son requeridos")
    precio_f = float(precio or 0)
    if precio_f < 0:
        raise ValueError("precio debe ser mayor o igual a cero")
    activo_s = 'S' if activo else 'N'
    nota_s = (nota or '').strip()
    with client.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM FAT.TFAT_TIPO_PRECIO WHERE no_cia=:1 AND no_lista=:2",
            [no_cia, nl])
        if cur.fetchone() is None:
            raise ValueError("Lista de precio no existe")
        cur.execute("SELECT 1 FROM INV.TINV_PRODUCTO WHERE no_produ=:1", [np])
        if cur.fetchone() is None:
            raise ValueError("Producto no existe")
        cur.execute(
            "SELECT 1 FROM FAT.TFAT_LISTA_PRECIO "
            "WHERE no_cia=:1 AND punto=:2 AND no_lista=:3 AND no_produ=:4",
            [no_cia, punto, nl, np])
        exists = cur.fetchone() is not None
        if exists:
            cur.execute(
                "UPDATE FAT.TFAT_LISTA_PRECIO "
                "SET precio=:1, activo=:2, nota=:3 "
                "WHERE no_cia=:4 AND punto=:5 AND no_lista=:6 AND no_produ=:7",
                [precio_f, activo_s, nota_s, no_cia, punto, nl, np])
        else:
            cur.execute(
                "INSERT INTO FAT.TFAT_LISTA_PRECIO(no_cia,punto,no_lista,no_produ,precio,activo,nota) "
                "VALUES(:1,:2,:3,:4,:5,:6,:7)",
                [no_cia, punto, nl, np, precio_f, activo_s, nota_s])
        cur.connection.commit()
    return {'no_cia': no_cia, 'punto': punto, 'no_lista': nl, 'no_produ': np,
            'action': 'updated' if exists else 'created'}


def delete_lista_precio_detalle(no_cia: str, punto: str, no_lista: str,
                                no_produ: str) -> dict:
    nl = (no_lista or '').strip().upper()
    np = _normalize_no_produ(no_produ)
    with client.cursor() as cur:
        cur.execute(
            "DELETE FROM FAT.TFAT_LISTA_PRECIO "
            "WHERE no_cia=:1 AND punto=:2 AND no_lista=:3 AND no_produ=:4",
            [no_cia, punto, nl, np])
        deleted = cur.rowcount or 0
        cur.connection.commit()
    return {'no_cia': no_cia, 'punto': punto, 'no_lista': nl,
            'no_produ': np, 'deleted': int(deleted)}


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
        filters.append(
            "(UPPER(cl.nombre) LIKE UPPER(:srch) "
            "OR TO_CHAR(c.no_cliente) LIKE :srch "
            "OR c.no_conduce LIKE :srch)"
        )
        params['srch'] = f'%{search}%'

    where = " AND ".join(filters)
    total_row = client.fetch_one(
        f"SELECT COUNT(*) FROM FAT.TFAT_CONDUCE c "
        f"LEFT JOIN ("
        f"  SELECT no_cia, punto, no_cliente, MAX(nombre) AS nombre "
        f"  FROM CXC.TCXC_CLIENTE GROUP BY no_cia, punto, no_cliente"
        f") cl ON cl.no_cia = c.no_cia AND cl.punto = c.punto AND cl.no_cliente = c.no_cliente "
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
                LEFT JOIN (
                  SELECT no_cia, punto, no_cliente, MAX(nombre) AS nombre
                  FROM CXC.TCXC_CLIENTE GROUP BY no_cia, punto, no_cliente
                ) cl ON cl.no_cia = c.no_cia AND cl.punto = c.punto AND cl.no_cliente = c.no_cliente
                WHERE {where}
                ORDER BY NVL(c.fecha_sysdate, c.fecha) DESC, c.fecha DESC, c.no_conduce DESC
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


def _build_conduce_lineas(lineas: list) -> list[dict]:
    """Convierte filas de TFAT_CONDUCEL a dicts con porciento_impuesto derivado.

    TFAT_CONDUCEL almacena el monto itbis pero no el porcentaje.
    Se deriva: porc = itbis / (cantidad*precio - descuento) * 100.
    """
    result = []
    for l in lineas:
        cant = float(l['cantidad'] or 0)
        prec = float(l['precio'] or 0)
        desc = float(l['descuento'] or 0)
        itbis_amt = float(l['itbis_monto'] or 0)
        base = cant * prec - desc
        porc_imp = round(itbis_amt / base * 100, 2) if base > 0 else 0.0
        result.append({
            'no_linea': int(l['no_linea'] or 0),
            'almacen': l['almacen'] or '',
            'no_produ': l['no_produ'] or '',
            'descripcion': (l['descripcion'] or '').strip(),
            'cantidad': cant,
            'precio': prec,
            'porc_descuento': float(l['porc_descuento'] or 0),
            'descuento': desc,
            'itbis': itbis_amt,
            'st_anulado': l['st_anulado'] or 'N',
            'porciento_impuesto': porc_imp,
        })
    return result


def get_conduce(no_cia: str, punto: str, tipo_conduce: str, no_conduce: str) -> dict | None:
    """Retorna el header + lineas de un conduce específico."""
    rows = client.fetch_dicts(
        "SELECT c.no_cia, c.punto, c.tipo_conduce, c.no_conduce, c.no_cliente, "
        "cl.nombre AS nombre_cliente, c.fecha, c.vendedor, "
        "NVL(c.total_linea,0) AS total_linea, NVL(c.descuento,0) AS descuento, "
        "NVL(c.impuesto,0) AS impuesto, NVL(c.total_neto,0) AS total_neto, "
        "NVL(c.st_anulado,'N') AS st_anulado, NVL(c.st_impresion,'N') AS st_impresion, "
        "c.clase, c.tipo_factura, c.no_factura, c.detalle, "
        "c.forma_pago, c.no_condicion_pago, c.tipo_moneda, NVL(c.tasa_us,57.5) AS tasa_us, "
        "c.posiciones_fijas_ncf, c.ncf, c.creado_por "
        "FROM FAT.TFAT_CONDUCE c "
        "LEFT JOIN ("
        "  SELECT no_cia, punto, no_cliente, MAX(nombre) AS nombre "
        "  FROM CXC.TCXC_CLIENTE GROUP BY no_cia, punto, no_cliente"
        ") cl ON cl.no_cia = c.no_cia AND cl.punto = c.punto AND cl.no_cliente = c.no_cliente "
        "WHERE c.no_cia=:1 AND c.punto=:2 AND c.tipo_conduce=:3 AND c.no_conduce=:4",
        [no_cia, punto, tipo_conduce.strip().upper(), no_conduce.strip()])
    if not rows:
        return None
    r = rows[0]
    lineas = client.fetch_dicts(
        "SELECT no_linea, almacen, no_produ, NVL(descripcion,'') AS descripcion, "
        "NVL(cantidad,0) AS cantidad, NVL(precio,0) AS precio, "
        "NVL(porc_descuento,0) AS porc_descuento, NVL(descuento,0) AS descuento, "
        "NVL(itbis,0) AS itbis_monto, NVL(st_anulado,'N') AS st_anulado "
        "FROM FAT.TFAT_CONDUCEL "
        "WHERE no_cia=:1 AND punto=:2 AND tipo_conduce=:3 AND no_conduce=:4 ORDER BY no_linea",
        [no_cia, punto, tipo_conduce.strip().upper(), no_conduce.strip()])
    # NCF from the conduce itself; fallback to linked factura if missing
    ncf_dgi = _compose_ncf_dgi(r['posiciones_fijas_ncf'], r['ncf'])
    no_factura = (r['no_factura'] or '').strip()
    tipo_factura = (r['tipo_factura'] or '').strip()
    if not ncf_dgi and no_factura and tipo_factura:
        fat_row = client.fetch_one(
            "SELECT posiciones_fijas_ncf, ncf FROM FAT.TFAT_FACTURA "
            "WHERE no_cia=:1 AND punto=:2 AND tipo_factura=:3 AND no_factura=:4",
            [no_cia, punto, tipo_factura, no_factura])
        if fat_row:
            ncf_dgi = _compose_ncf_dgi(fat_row[0], fat_row[1])
    return {
        'no_cia': r['no_cia'], 'punto': r['punto'],
        'tipo_conduce': r['tipo_conduce'] or '',
        'no_conduce': r['no_conduce'] or '',
        'no_cliente': int(r['no_cliente'] or 0),
        'nombre_cliente': (r['nombre_cliente'] or '').strip(),
        'fecha': str(r['fecha'])[:10] if r['fecha'] else None,
        'vendedor': r['vendedor'] or '',
        'total_linea': float(r['total_linea'] or 0),
        'descuento': float(r['descuento'] or 0),
        'impuesto': float(r['impuesto'] or 0),
        'total_neto': float(r['total_neto'] or 0),
        'st_anulado': r['st_anulado'] or 'N',
        'st_impresion': r['st_impresion'] or 'N',
        'clase': r['clase'] or '',
        'tipo_factura': tipo_factura,
        'no_factura': no_factura,
        'detalle': r['detalle'] or '',
        'forma_pago': r['forma_pago'] or '',
        'no_condicion_pago': r['no_condicion_pago'] or '',
        'tipo_moneda': r['tipo_moneda'] or 'RD',
        'tasa_us': float(r['tasa_us'] or 57.5),
        'ncf_dgi': ncf_dgi,
        'usuario': (r['creado_por'] or '').strip(),
        'lineas': _build_conduce_lineas(lineas),
    }


# ── Cuadre de Caja ────────────────────────────────────────────────────────────

def find_cuadre_target_fecha(no_cia: str, punto: str) -> str | None:
    """Devuelve la fecha (YYYY-MM-DD) que se debe mostrar por defecto al abrir
    cuadre de caja.

    Prioridad legacy:
      1) MAX(TRUNC(fecha)) con no_cuadre_caja NULL → día en progreso (lo que
         aún no se ha cuadrado todavía).
      2) MAX(TRUNC(fecha)) total → último día con actividad aunque ya
         estuviera cuadrado.
      3) None si la empresa/punto no tiene historial — el caller decide
         fallback (típicamente SYSDATE).
    """
    # Excluimos fechas en el futuro respecto a SYSDATE: hay data sucia con
    # fechas futuras por errores de digitación y el día "en progreso" real
    # nunca debe ser > hoy.
    row = client.fetch_one(
        "SELECT TO_CHAR(MAX(TRUNC(fecha)),'YYYY-MM-DD') "
        "FROM FAT.TFAT_FACTURA "
        "WHERE no_cia=:1 AND punto=:2 "
        "  AND no_cuadre_caja IS NULL "
        "  AND TRUNC(fecha) <= TRUNC(SYSDATE)",
        [no_cia, punto])
    if row and row[0]:
        return row[0]
    row = client.fetch_one(
        "SELECT TO_CHAR(MAX(TRUNC(fecha)),'YYYY-MM-DD') "
        "FROM FAT.TFAT_FACTURA "
        "WHERE no_cia=:1 AND punto=:2 "
        "  AND TRUNC(fecha) <= TRUNC(SYSDATE)",
        [no_cia, punto])
    return row[0] if row and row[0] else None


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
        f"  WHERE fp.no_cia=:p_cia AND fp.punto=:p_pto "
        f"    AND NVL(f.st_anulado,'N')='N' {extra_fat} "
        f"  GROUP BY fp.tipo_pago, NVL(tp.descripcion, fp.tipo_pago) "
        # ── Cobros CXC: recibos de ingreso aplicados a facturas a crédito ──
        f"  UNION ALL "
        f"  SELECT 'C'||NVL(d.forma_pago,'0') AS tipo_pago, "
        f"    'COBRO CRED - '||NVL(tp2.descripcion, NVL(d.forma_pago,'SIN ESPECIFICAR')) AS forma_pago, "
        f"    COUNT(*) AS cantidad, SUM(d.credito) AS total, 2 AS origen "
        f"  FROM CXC.TCXC_DOCUMENTO d "
        f"  LEFT JOIN FAT.TFAT_TIPO_PAGO tp2 ON tp2.no_cia=:p_cia "
        f"    AND tp2.punto=d.punto AND tp2.tipo_pago=d.forma_pago "
        f"  WHERE d.no_cia=:p_cia AND d.punto=:p_pto "
        f"    AND d.tipo_docu='RI' AND NVL(d.st_anulado,'N')='N' "
        f"    {extra_cxc} "
        f"  GROUP BY NVL(d.forma_pago,'0'), "
        f"    NVL(tp2.descripcion, NVL(d.forma_pago,'SIN ESPECIFICAR')) "
        f") ORDER BY origen, tipo_pago"
    )
    rows = client.fetch_dicts(sql, params)
    return [{'tipo_pago': r['tipo_pago'],
             'forma_pago': (r['forma_pago'] or r['tipo_pago'] or '').strip(),
             'cantidad': int(r['cantidad'] or 0),
             'total': float(r['total'] or 0)} for r in rows]


def get_cuadre_caja_ventas_dia(no_cia: str, punto: str, desde: str,
                               hasta: str, no_cuadre: str = '') -> list[dict]:
    params: dict = {'p_cia': no_cia, 'p_pto': punto}
    where = []
    if no_cuadre:
        params['p_cuadre'] = int(no_cuadre)
        where.append("AND f.NO_CUADRE_CAJA = :p_cuadre")
    else:
        if desde:
            params['p_desde'] = desde
            where.append("AND TRUNC(f.fecha) >= TO_DATE(:p_desde,'YYYY-MM-DD')")
        if hasta:
            params['p_hasta'] = hasta
            where.append("AND TRUNC(f.fecha) <= TO_DATE(:p_hasta,'YYYY-MM-DD')")
    extra = ' '.join(where)
    sql = (
        "SELECT clase_venta, COUNT(*) AS cantidad, SUM(total_neto) AS total "
        "FROM ("
        "  SELECT CASE "
        "    WHEN NVL(f.afecta_cxc, NVL(td.afecta_cxc,'N')) = 'S' "
        "      OR UPPER(NVL(td.descripcion,'')) LIKE '%CRED%' "
        "      OR UPPER(f.tipo_factura) IN ('FC') "
        "    THEN 'CREDITO' ELSE 'CONTADO' END AS clase_venta, "
        "    NVL(f.total_neto,0) AS total_neto "
        "  FROM FAT.TFAT_FACTURA f "
        "  LEFT JOIN FAT.TFAT_TDOCU td "
        "    ON td.no_cia=f.no_cia AND td.tipo_docu=f.tipo_factura "
        "  WHERE f.no_cia=:p_cia AND f.punto=:p_pto "
        "    AND NVL(f.st_anulado,'N')='N' "
        f"    {extra} "
        ") GROUP BY clase_venta"
    )
    rows = client.fetch_dicts(sql, params)
    by_key = {
        (r['clase_venta'] or '').strip().upper(): {
            'clase': (r['clase_venta'] or '').strip().upper(),
            'cantidad': int(r['cantidad'] or 0),
            'total': float(r['total'] or 0),
        }
        for r in rows
    }
    labels = {
        'CONTADO': 'Ventas de contado del dia',
        'CREDITO': 'Ventas a credito del dia',
    }
    return [
        {
            'clase': key,
            'descripcion': labels[key],
            'cantidad': by_key.get(key, {}).get('cantidad', 0),
            'total': by_key.get(key, {}).get('total', 0.0),
            'impacta_ingreso': key == 'CONTADO',
        }
        for key in ('CONTADO', 'CREDITO')
    ]


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


def cuadre_caja_por_ncf_forma_pago(no_cia: str, punto: str, desde: str = '',
                                     hasta: str = '', tipo_factura: str = '',
                                     no_cuadre: str = '') -> list[dict]:
    """Desglose 2D: para cada tipo de NCF, monto por forma de pago.

    El usuario quiere ver "de las facturas B02, cuánto en efectivo, cuánto en
    cheque, cuánto en transferencia". Esto une TFAT_FACTURA (para el NCF) con
    TFAT_FORMA_PAGO (rows = formas de pago aplicadas a esa factura).
    """
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
    sql = (
        "SELECT NVL(f.posiciones_fijas_ncf,'—') AS ncf_tipo, "
        "       fp.tipo_pago                     AS tipo_pago, "
        "       NVL(tp.descripcion, fp.tipo_pago) AS forma_pago, "
        "       COUNT(*)                          AS cantidad, "
        "       SUM(NVL(fp.monto,0))              AS total "
        "FROM   FAT.TFAT_FACTURA f "
        "JOIN   FAT.TFAT_FORMA_PAGO fp "
        "  ON fp.no_cia=f.no_cia AND fp.punto=f.punto "
        "  AND fp.tipo_factura=f.tipo_factura AND fp.no_factura=f.no_factura "
        "LEFT JOIN FAT.TFAT_TIPO_PAGO tp "
        "  ON tp.no_cia=fp.no_cia AND tp.tipo_pago=fp.tipo_pago "
        "WHERE  f.no_cia=:p_cia AND f.punto=:p_pto "
        "  AND  NVL(f.st_anulado,'N')='N' "
        f"  {extra} "
        "GROUP BY NVL(f.posiciones_fijas_ncf,'—'), fp.tipo_pago, "
        "         NVL(tp.descripcion, fp.tipo_pago) "
        "ORDER BY NVL(f.posiciones_fijas_ncf,'—'), fp.tipo_pago"
    )
    rows = client.fetch_dicts(sql, params)
    return [{
        'ncf_tipo':   (r['ncf_tipo'] or '').strip().upper(),
        'tipo_pago':  (r['tipo_pago'] or '').strip(),
        'forma_pago': (r['forma_pago'] or '').strip(),
        'cantidad':   int(r['cantidad'] or 0),
        'total':      float(r['total'] or 0),
    } for r in rows]


def cuadre_caja_hoja_por_ncf(no_cia: str, punto: str, fecha: str) -> list[dict]:
    """Hoja de cuadre de caja por tipo de NCF, formato legado (Ffat266):
    "CUADRE DE CAJA B02" con Contado/Cheques/Transferencia del DIA y de
    ANTERIORES, mas el rango de facturas (desde/hasta) de ese NCF emitidas
    ese dia.

    - DEL DIA: facturas de ese NCF FACTURADAS en `fecha`, desglosadas por
      forma de pago (TFAT_FORMA_PAGO).
    - ANTERIORES: recibos de ingreso (CXC.TCXC_DOCUMENTO tipo_docu='RI')
      hechos EN `fecha` que cobraron/aplicaron (via CXC.TCXC_REFEDOCU) una
      factura de ese NCF con fecha ANTERIOR a `fecha`. Es decir: dinero que
      entro hoy por un credito de un dia anterior. NO es el backlog de
      facturas sin cuadrar — confirmado con el usuario 2026-07-21.
    - Factura Desde/Hasta: solo del rango FACTURADO ese dia (no de lo
      cobrado via RI, que pertenece a la numeracion de otro dia).

    tipo_pago/forma_pago fijo en las 5 companias (TFAT_TIPO_PAGO):
    1=EFECTIVO, 2=CHEQUE, 8=TRANSFERENCIA. No incluye tarjeta (3) ni a
    credito (4) — igual que la hoja legado, que solo desglosa esas 3
    formas de pago.
    """
    params = {'p_cia': no_cia, 'p_pto': punto, 'p_fecha': fecha}
    sql_dia = (
        "SELECT NVL(f.posiciones_fijas_ncf,'—') AS ncf_tipo, "
        "  fp.tipo_pago AS tipo_pago, f.no_factura AS no_factura, "
        "  fp.monto AS monto "
        "FROM FAT.TFAT_FACTURA f "
        "JOIN FAT.TFAT_FORMA_PAGO fp ON fp.no_cia=f.no_cia AND fp.punto=f.punto "
        "  AND fp.tipo_factura=f.tipo_factura AND fp.no_factura=f.no_factura "
        "WHERE f.no_cia=:p_cia AND f.punto=:p_pto AND NVL(f.st_anulado,'N')='N' "
        "  AND TRUNC(f.fecha) = TO_DATE(:p_fecha,'YYYY-MM-DD')"
    )
    sql_anterior = (
        "SELECT NVL(f.posiciones_fijas_ncf,'—') AS ncf_tipo, "
        "  rd.forma_pago AS tipo_pago, ref.monto AS monto "
        "FROM CXC.TCXC_DOCUMENTO rd "
        "JOIN CXC.TCXC_REFEDOCU ref ON ref.no_cia=rd.no_cia AND ref.punto=rd.punto "
        "  AND ref.tipo_docu=rd.tipo_docu AND ref.no_docu=rd.no_docu "
        "JOIN FAT.TFAT_FACTURA f ON f.no_cia=rd.no_cia AND f.punto=rd.punto "
        "  AND f.tipo_factura=ref.tipo_refe AND f.no_factura=ref.no_refe "
        "WHERE rd.no_cia=:p_cia AND rd.punto=:p_pto AND rd.tipo_docu='RI' "
        "  AND NVL(rd.st_anulado,'N')='N' "
        "  AND TRUNC(rd.fecha) = TO_DATE(:p_fecha,'YYYY-MM-DD') "
        "  AND ref.tipo_refe IN ('FT','FC') "
        "  AND TRUNC(f.fecha) < TO_DATE(:p_fecha,'YYYY-MM-DD')"
    )
    rows_dia = client.fetch_dicts(sql_dia, params)
    rows_anterior = client.fetch_dicts(sql_anterior, params)

    hojas: dict = {}

    def _get(ncf: str) -> dict:
        h = hojas.get(ncf)
        if not h:
            h = hojas[ncf] = {
                'dia': {'efectivo': 0.0, 'cheques': 0.0, 'transferencia': 0.0},
                'anterior': {'efectivo': 0.0, 'cheques': 0.0, 'transferencia': 0.0},
                'factura_desde': None, 'factura_hasta': None,
            }
        return h

    def _add(bucket: dict, tipo_pago: str, monto: float) -> None:
        tp = (tipo_pago or '').strip()
        if tp == '1':
            bucket['efectivo'] += monto
        elif tp == '2':
            bucket['cheques'] += monto
        elif tp == '8':
            bucket['transferencia'] += monto

    for r in rows_dia:
        ncf = (r['ncf_tipo'] or '—').strip().upper()
        h = _get(ncf)
        _add(h['dia'], r['tipo_pago'], float(r['monto'] or 0))
        no_fact = r['no_factura']
        if no_fact:
            if h['factura_desde'] is None or no_fact < h['factura_desde']:
                h['factura_desde'] = no_fact
            if h['factura_hasta'] is None or no_fact > h['factura_hasta']:
                h['factura_hasta'] = no_fact

    for r in rows_anterior:
        ncf = (r['ncf_tipo'] or '—').strip().upper()
        h = _get(ncf)
        _add(h['anterior'], r['tipo_pago'], float(r['monto'] or 0))
        # Factura Desde/Hasta es solo del rango facturado hoy — un RI cobra
        # una factura de OTRO dia, no toca este rango.

    out = []
    for ncf, h in sorted(hojas.items()):
        total_dia = sum(h['dia'].values())
        total_anterior = sum(h['anterior'].values())
        venta_general = total_dia + total_anterior
        out.append({
            'ncf_tipo': ncf,
            'contado_dia': h['dia']['efectivo'],
            'cheques_dia': h['dia']['cheques'],
            'transferencia_dia': h['dia']['transferencia'],
            'total_venta_dia': total_dia,
            'contado_anterior': h['anterior']['efectivo'],
            'cheques_anterior': h['anterior']['cheques'],
            'transferencia_anterior': h['anterior']['transferencia'],
            'total_venta_anterior': total_anterior,
            'venta_general': venta_general,
            'total_ingreso': venta_general,
            'factura_desde': h['factura_desde'],
            'factura_hasta': h['factura_hasta'],
        })
    return out


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
    """Reporte 607 DGII. Los NCF de Consumo (B02/E32) no se reportan aqui:
    la DGII no exige identificar al comprador en esas ventas, y el usuario
    confirmo que el 607 real del legado solo lista comprobantes con cliente
    identificable (B01 credito fiscal, B14 regimenes especiales, B15
    gubernamental, notas de credito/debito, etc — no factura de consumo).

    Incluye tambien las notas de credito (CXC.TCXC_DOCUMENTO tipo_docu='DV',
    NCF B04) que salen de una devolucion en INV. Antes solo se leia
    TFAT_FACTURA y las NC no aparecian nunca en el 607."""
    # Facturas de venta (TFAT_FACTURA)
    params_f: list = [no_cia]
    extra_f = []
    if desde:
        params_f.append(desde)
        extra_f.append(f"AND TRUNC(f.fecha) >= TO_DATE(:{len(params_f)},'YYYY-MM-DD')")
    if hasta:
        params_f.append(hasta)
        extra_f.append(f"AND TRUNC(f.fecha) <= TO_DATE(:{len(params_f)},'YYYY-MM-DD')")
    extra_sql_f = " ".join(extra_f)
    rows_f = client.fetch_dicts(
        f"SELECT f.ncf, f.codigo_ncf, f.tipo_ncf_fiscal, f.posiciones_fijas_ncf, "
        f"f.no_factura, f.tipo_factura, "
        f"f.fecha, cl.rnc, cl.nombre AS nombre_cliente, "
        f"NVL(f.total_neto,0) AS total_neto, NVL(f.impuesto,0) AS impuesto, "
        f"NVL(f.total_linea,0) AS total_linea "
        f"FROM FAT.TFAT_FACTURA f "
        f"LEFT JOIN CXC.TCXC_CLIENTE cl "
        f"  ON cl.no_cia = f.no_cia AND cl.punto = f.punto AND cl.no_cliente = f.no_cliente "
        f"WHERE f.no_cia=:1 AND f.ncf IS NOT NULL "
        f"AND NVL(f.st_anulado,'N')='N' "
        f"AND NVL(UPPER(f.posiciones_fijas_ncf),'') NOT IN ('B02','E32') {extra_sql_f}",
        params_f)
    # Notas de credito (TCXC_DOCUMENTO tipo_docu='DV'). En TCXC_DOCUMENTO,
    # `credito` es el total del NC (con ITBIS) e `itbis` es la porcion de ITBIS;
    # la base sin ITBIS = credito - itbis (equivalente a total_linea en FAT).
    params_d: list = [no_cia]
    extra_d = []
    if desde:
        params_d.append(desde)
        extra_d.append(f"AND TRUNC(d.fecha) >= TO_DATE(:{len(params_d)},'YYYY-MM-DD')")
    if hasta:
        params_d.append(hasta)
        extra_d.append(f"AND TRUNC(d.fecha) <= TO_DATE(:{len(params_d)},'YYYY-MM-DD')")
    extra_sql_d = " ".join(extra_d)
    rows_d = client.fetch_dicts(
        f"SELECT d.ncf, NULL AS codigo_ncf, NULL AS tipo_ncf_fiscal, "
        f"d.posiciones_fijas_ncf, "
        f"d.no_docu AS no_factura, d.tipo_docu AS tipo_factura, "
        f"d.fecha, cl.rnc, cl.nombre AS nombre_cliente, "
        f"NVL(d.credito,0) AS total_neto, NVL(d.itbis,0) AS impuesto, "
        f"(NVL(d.credito,0) - NVL(d.itbis,0)) AS total_linea "
        f"FROM CXC.TCXC_DOCUMENTO d "
        f"LEFT JOIN CXC.TCXC_CLIENTE cl "
        f"  ON cl.no_cia = d.no_cia AND cl.punto = d.punto AND cl.no_cliente = d.no_cliente "
        f"WHERE d.no_cia=:1 AND d.tipo_docu='DV' AND d.ncf IS NOT NULL "
        f"AND NVL(d.st_anulado,'N')='N' {extra_sql_d}",
        params_d)
    rows = list(rows_f) + list(rows_d)
    rows.sort(key=lambda r: (r['fecha'] or 0, int(r['ncf'] or 0)))
    return [{'ncf': int(r['ncf']), 'codigo_ncf': r['codigo_ncf'] or '',
             'tipo_ncf_fiscal': r['tipo_ncf_fiscal'] or '',
             'posiciones_fijas_ncf': (r['posiciones_fijas_ncf'] or '').strip().upper(),
             'ncf_dgi': _compose_ncf_dgi(r['posiciones_fijas_ncf'], r['ncf']),
             'no_factura': r['no_factura'] or '', 'tipo_factura': r['tipo_factura'] or '',
             'fecha': str(r['fecha'])[:10] if r['fecha'] else None,
             'rnc': r['rnc'] or '', 'nombre_cliente': (r['nombre_cliente'] or '').strip(),
             'total_neto': float(r['total_neto']), 'impuesto': float(r['impuesto']),
             'total_linea': float(r['total_linea'])} for r in rows]


def _tipo_id_de_rnc(rnc: str) -> str:
    """1=RNC (9 digitos), 2=Cedula (11 digitos) -- regla DGII por longitud."""
    solo_digitos = ''.join(ch for ch in (rnc or '') if ch.isdigit())
    return '2' if len(solo_digitos) == 11 else '1'


def archivo_dgii_607(no_cia: str, ano: int, mes: int) -> tuple[str, int]:
    """Genera el contenido del archivo 607 (formato DGII, pipe-delimited) tal
    como lo produce el legado (ver C:\\archivo_ncf\\archivo_607_*.txt).

    Regla clave descubierta comparando contra archivos reales del legado:
    los NCF de Consumo (B02/E32, "factura de consumidor final") NO se
    reportan linea por linea en el 607 -- DGII no exige identificar al
    comprador en esas ventas. Solo se reportan comprobantes con cliente
    identificable (credito fiscal, gubernamental, regimenes especiales,
    notas de credito/debito, etc).

    Incluye tambien las notas de credito (CXC.TCXC_DOCUMENTO tipo_docu='DV',
    NCF B04). Antes solo se leia TFAT_FACTURA y las NC generadas por
    devoluciones en INV nunca salian en el .txt DGII.

    Limitacion conocida (no resuelta): NCF_MODIFICADO (columna 4, para NC/ND
    que referencian la factura original) se deja en blanco -- el clon no
    tiene aun un enlace explicito factura->nota de credito para resolverlo
    (TCXC_DOCUMENTO.tipo_docu_r/no_docu_r estan siempre en NULL en las DV).
    Para las DV tampoco hay forma_pago propia, asi que columnas 17-23 van en
    cero. Revisar con un contador antes de enviar a DGII si el periodo tiene
    notas de credito/debito.
    """
    from .. import client as _client
    rows_f = _client.fetch_dicts(
        "SELECT NVL(f.rnc_factura, cl.rnc) rnc, f.ncf, f.posiciones_fijas_ncf, f.tipo_ingreso, "
        "TO_CHAR(f.fecha,'YYYYMMDD') fecha, TO_CHAR(f.fecha_retencion,'YYYYMMDD') fecha_retencion, "
        "NVL(f.total_neto,0) total_neto, NVL(f.total_linea,0) total_linea, NVL(f.impuesto,0) impuesto, "
        "NVL(f.itbis_retenido,0) itbis_retenido, NVL(f.isr_retenido,0) isr_retenido, "
        "f.forma_pago_fat, tp.tipo_pago_fiscal forma_pago_dgii "
        "FROM FAT.TFAT_FACTURA f "
        "LEFT JOIN CXC.TCXC_CLIENTE cl "
        "  ON cl.no_cia = f.no_cia AND cl.punto = f.punto AND cl.no_cliente = f.no_cliente "
        "LEFT JOIN FAT.TFAT_TIPO_PAGO tp ON tp.no_cia=f.no_cia AND tp.tipo_pago=f.forma_pago_fat "
        "WHERE f.no_cia=:1 AND EXTRACT(YEAR FROM f.fecha)=:2 AND EXTRACT(MONTH FROM f.fecha)=:3 "
        "AND NVL(f.st_anulado,'N')='N' AND f.ncf IS NOT NULL "
        "AND NVL(UPPER(f.posiciones_fijas_ncf),'') NOT IN ('B02','E32') ",
        [no_cia, ano, mes])
    # DV (notas de credito). credito = total con ITBIS; itbis = ITBIS del NC;
    # base sin ITBIS = credito - itbis (equivale a total_linea en FAT).
    rows_d = _client.fetch_dicts(
        "SELECT cl.rnc, d.ncf, d.posiciones_fijas_ncf, "
        "TO_CHAR(d.fecha,'YYYYMMDD') fecha, "
        "NVL(d.credito,0) total_neto, "
        "(NVL(d.credito,0) - NVL(d.itbis,0)) total_linea, "
        "NVL(d.itbis,0) impuesto, "
        "NVL(d.itbis_retenido,0) itbis_retenido, NVL(d.isr_retenido,0) isr_retenido "
        "FROM CXC.TCXC_DOCUMENTO d "
        "LEFT JOIN CXC.TCXC_CLIENTE cl "
        "  ON cl.no_cia = d.no_cia AND cl.punto = d.punto AND cl.no_cliente = d.no_cliente "
        "WHERE d.no_cia=:1 AND d.tipo_docu='DV' AND d.ncf IS NOT NULL "
        "AND NVL(d.st_anulado,'N')='N' "
        "AND EXTRACT(YEAR FROM d.fecha)=:2 AND EXTRACT(MONTH FROM d.fecha)=:3 ",
        [no_cia, ano, mes])

    cia = _client.fetch_one("SELECT rnc FROM FAT.TFAT_CIAS WHERE no_cia=:1", [no_cia])
    rnc_empresa = (cia[0] if cia else '') or ''

    all_rows = [(r, 'FC') for r in rows_f] + [(r, 'DV') for r in rows_d]
    all_rows.sort(key=lambda pr: (pr[0]['fecha'] or '', int(pr[0]['ncf'] or 0)))

    lineas = []
    for r, kind in all_rows:
        ncf_dgi = _compose_ncf_dgi(r['posiciones_fijas_ncf'], r['ncf'])
        montos_pago = ['0.00'] * 7
        if kind == 'FC':
            tipo_ingreso = f"{int(r['tipo_ingreso'] or 1):02d}"
            col_pago = int(r['forma_pago_dgii'] or 0)
            # Columnas 17-23: Efectivo/Cheque-Transf/Tarjeta/Credito/Bonos/Permuta/Otras.
            # NOTA: en TFAT_FACTURA, total_neto es el TOTAL con ITBIS incluido y
            # total_linea es la base sin ITBIS (nombres al reves de lo esperado,
            # verificado contra un documento real: total_neto=7642.54,
            # total_linea=6476.73, impuesto=1165.81 -> 6476.73+1165.81=7642.54).
            total_doc = float(r['total_neto'])
            if 1 <= col_pago <= 7:
                montos_pago[col_pago - 1] = f"{total_doc:.2f}"
            fecha_ret = r['fecha_retencion'] or ''
        else:
            # DV: sin tipo_ingreso propio, sin fecha_retencion, sin forma_pago
            # (ver limitacion en el docstring).
            tipo_ingreso = '01'
            fecha_ret = ''
        campos = [
            r['rnc'] or '', _tipo_id_de_rnc(r['rnc']), ncf_dgi, '',
            tipo_ingreso, r['fecha'] or '', fecha_ret,
            f"{float(r['total_linea']):.2f}", f"{float(r['impuesto']):.2f}",
            f"{float(r['itbis_retenido']):.2f}", '',
            f"{float(r['isr_retenido']):.2f}", '',
            '0.00', '0.00', '0.00',
            *montos_pago,
        ]
        lineas.append('|'.join(campos))

    contenido = f"607|{rnc_empresa}|{ano}{mes:02d}|{len(lineas)}\n" + '\n'.join(lineas) + ('\n' if lineas else '')
    return contenido, len(lineas)


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

# -- Reporte Facturas con RNC (Rfat328) ---------------------------------------

def rep_facturas_rnc(no_cia: str, punto: str, desde: str, hasta: str,
                     tipo_docu: str = 'T', rnc: str = '',
                     no_cliente: str = '') -> list[dict]:
    """Listado Rfat328-like de facturas con RNC y referencias CXC."""
    params: dict = {'no_cia': no_cia, 'punto': punto}
    extra: list[str] = []

    tipo = (tipo_docu or 'T').strip().upper()
    if tipo in {'F', 'FC'}:
        extra.append("AND f.tipo_factura = 'FC'")
    elif tipo in {'O', 'FT'}:
        extra.append("AND f.tipo_factura = 'FT'")

    if desde:
        params['desde'] = desde
        extra.append("AND TRUNC(f.fecha) >= TO_DATE(:desde,'YYYY-MM-DD')")
    if hasta:
        params['hasta'] = hasta
        extra.append("AND TRUNC(f.fecha) <= TO_DATE(:hasta,'YYYY-MM-DD')")
    if rnc:
        params['rnc'] = f"%{rnc.strip()}%"
        extra.append("AND UPPER(NVL(n.rnc, cl.rnc)) LIKE UPPER(:rnc)")
    if no_cliente:
        params['no_cliente'] = int(no_cliente)
        extra.append("AND f.no_cliente = :no_cliente")

    rows = client.fetch_dicts(
        f"""
        SELECT f.punto, f.tipo_factura, f.no_factura, f.no_cliente,
               f.fecha, f.vendedor, NVL(f.st_anulado,'N') AS st_anulado,
               NVL(f.total_neto,0) AS total_neto,
               NVL(n.nombre, cl.nombre) AS nombre,
               NVL(n.rnc, cl.rnc) AS rnc,
               NVL(d.posiciones_fijas_ncf, f.posiciones_fijas_ncf) AS pref_ncf,
               NVL(d.ncf, f.ncf) AS ncf,
               d.tipo_docu AS cxc_tipo_docu,
               d.no_docu AS cxc_no_docu,
               refs.referencias_cxc
        FROM FAT.TFAT_FACTURA f
        LEFT JOIN FAT.TFAT_NOMBRE n
          ON n.no_cia=f.no_cia AND n.punto=f.punto
         AND n.tipo_factura=f.tipo_factura AND n.no_factura=f.no_factura
        LEFT JOIN CXC.TCXC_CLIENTE cl
          ON cl.no_cia=f.no_cia AND cl.punto=f.punto
         AND cl.no_cliente=f.no_cliente
        LEFT JOIN CXC.TCXC_DOCUMENTO d
          ON d.no_cia=f.no_cia AND d.punto=f.punto
         AND d.tipo_docu=f.tipo_factura AND d.no_docu=f.no_factura
        LEFT JOIN (
          SELECT no_cia, punto, tipo_refe, no_refe,
                 LISTAGG(tipo_docu || '-' || no_docu, ', ')
                   WITHIN GROUP (ORDER BY tipo_docu, no_docu) AS referencias_cxc
          FROM CXC.TCXC_REFEDOCU
          GROUP BY no_cia, punto, tipo_refe, no_refe
        ) refs
          ON refs.no_cia=f.no_cia AND refs.punto=f.punto
         AND refs.tipo_refe=f.tipo_factura AND refs.no_refe=f.no_factura
        WHERE f.no_cia=:no_cia AND f.punto=:punto
          {' '.join(extra)}
        ORDER BY f.fecha, f.tipo_factura, f.no_factura
        """,
        params)

    def _ncf_dgi(prefix, ncf_num) -> str:
        prefix_s = (prefix or '').strip().upper()
        if not ncf_num:
            return ''
        try:
            n_int = int(ncf_num)
        except (TypeError, ValueError):
            return str(ncf_num)
        if prefix_s.startswith('B') and len(prefix_s) == 3:
            return f"{prefix_s}{n_int:08d}"
        return str(ncf_num)

    items = []
    for r in rows:
        no_cliente_val = r['no_cliente']
        total = 0.0 if (r['st_anulado'] or 'N') == 'S' else float(r['total_neto'] or 0)
        cxc_documento = ''
        if r.get('cxc_tipo_docu') and r.get('cxc_no_docu'):
            cxc_documento = f"{r['cxc_tipo_docu']}-{r['cxc_no_docu']}"
        referencias_cxc = (r['referencias_cxc'] or '').strip()
        if not referencias_cxc.strip(' -,'):
            referencias_cxc = ''
        items.append({
            'documento': f"{r['punto']}-{r['tipo_factura']}-{r['no_factura']}",
            'punto': r['punto'] or '',
            'tipo_factura': r['tipo_factura'] or '',
            'no_factura': r['no_factura'] or '',
            'fecha': str(r['fecha'])[:10] if r['fecha'] else None,
            'no_cliente': int(no_cliente_val) if no_cliente_val is not None else None,
            'no_cliente_fmt': str(int(no_cliente_val)).zfill(5) if no_cliente_val is not None else '',
            'vendedor': (r['vendedor'] or '').strip(),
            'nombre': (r['nombre'] or '').strip(),
            'rnc': (r['rnc'] or '').strip(),
            'ncf': _ncf_dgi(r['pref_ncf'], r['ncf']),
            'cxc_documento': cxc_documento,
            'referencias_cxc': referencias_cxc,
            'st_anulado': r['st_anulado'] or 'N',
            'total_neto': total,
        })
    return items


# -- Reporte Margen de Beneficio Bruto (Rfat302/Ffat311) ----------------------

def rep_margen_bruto(no_cia: str, punto: str, desde: str, hasta: str,
                     tipo_docu: str = 'T', agrupar: str = 'producto',
                     vendedor: str = '', almacen: str = '',
                     no_cliente: str = '', no_produ: str = '',
                     tipo_transaccion: str = '') -> list[dict]:
    """Reporte Rfat302-like de margen bruto por producto/cliente/factura."""
    params: dict = {'no_cia': no_cia, 'punto': punto}
    extra: list[str] = []

    tipo = (tipo_docu or 'T').strip().upper()
    if tipo in {'F', 'FC'}:
        extra.append("AND f.tipo_factura = 'FC'")
    elif tipo in {'O', 'FT'}:
        extra.append("AND f.tipo_factura = 'FT'")

    if desde:
        params['desde'] = desde
        extra.append("AND TRUNC(f.fecha) >= TO_DATE(:desde,'YYYY-MM-DD')")
    if hasta:
        params['hasta'] = hasta
        extra.append("AND TRUNC(f.fecha) <= TO_DATE(:hasta,'YYYY-MM-DD')")
    if vendedor:
        params['vendedor'] = vendedor.strip().upper()
        extra.append("AND f.vendedor = :vendedor")
    if almacen:
        params['almacen'] = almacen.strip()
        extra.append("AND l.almacen = :almacen")
    if no_cliente:
        params['no_cliente'] = int(no_cliente)
        extra.append("AND f.no_cliente = :no_cliente")
    if no_produ:
        params['no_produ'] = no_produ.strip()
        extra.append("AND l.no_produ = :no_produ")
    if tipo_transaccion:
        params['tipo_transaccion'] = tipo_transaccion.strip().upper()
        extra.append("AND f.tipo_transaccion = :tipo_transaccion")

    agr = (agrupar or 'producto').strip().lower()
    if agr not in {'producto', 'cliente', 'factura'}:
        agr = 'producto'

    if agr == 'cliente':
        select_group = """
               TO_CHAR(f.no_cliente) AS clave,
               MAX(NVL(cl.nombre, TO_CHAR(f.no_cliente))) AS descripcion,
               MAX(cl.rnc) AS rnc,
               NULL AS no_produ,
               NULL AS documento,
               NULL AS fecha,
               COUNT(DISTINCT f.tipo_factura || '-' || f.no_factura) AS facturas,
        """
        group_by = "f.no_cliente"
        order_by = "venta DESC"
    elif agr == 'factura':
        select_group = """
               f.tipo_factura || '-' || f.no_factura AS clave,
               MAX(NVL(cl.nombre, TO_CHAR(f.no_cliente))) AS descripcion,
               MAX(cl.rnc) AS rnc,
               NULL AS no_produ,
               f.tipo_factura || '-' || f.no_factura AS documento,
               f.fecha AS fecha,
               1 AS facturas,
        """
        group_by = "f.tipo_factura, f.no_factura, f.fecha"
        order_by = "f.fecha, f.tipo_factura, f.no_factura"
    else:
        select_group = """
               l.no_produ AS clave,
               MAX(NVL(l.descripcion, p.descri)) AS descripcion,
               NULL AS rnc,
               l.no_produ AS no_produ,
               NULL AS documento,
               NULL AS fecha,
               COUNT(DISTINCT f.tipo_factura || '-' || f.no_factura) AS facturas,
        """
        group_by = "l.no_produ"
        order_by = "venta DESC"

    extra_sql = " ".join(extra)
    rows = client.fetch_dicts(
        f"""
        SELECT {select_group}
               COUNT(*) AS lineas,
               SUM(NVL(l.cantidad,0)) AS cantidad,
               SUM(NVL(l.monto_neto,0)) AS venta,
               SUM(NVL(l.costo,0) * NVL(l.cantidad,0)) AS costo,
               SUM(NVL(l.monto_neto,0) - (NVL(l.costo,0) * NVL(l.cantidad,0))) AS beneficio,
               CASE WHEN SUM(NVL(l.monto_neto,0)) = 0 THEN 0
                    ELSE ROUND(
                      (SUM(NVL(l.monto_neto,0) - (NVL(l.costo,0) * NVL(l.cantidad,0)))
                       / SUM(NVL(l.monto_neto,0))) * 100, 2)
               END AS margen_pct
        FROM FAT.TFAT_FACTURA f
        JOIN FAT.TFAT_FACTURAL l
          ON l.no_cia=f.no_cia AND l.punto=f.punto
         AND l.tipo_factura=f.tipo_factura AND l.no_factura=f.no_factura
        LEFT JOIN INV.TINV_PRODUCTO p
          ON p.no_produ=l.no_produ
        LEFT JOIN CXC.TCXC_CLIENTE cl
          ON cl.no_cia=f.no_cia AND cl.punto=f.punto
         AND cl.no_cliente=f.no_cliente
        WHERE f.no_cia=:no_cia AND f.punto=:punto
          AND NVL(f.st_anulado,'N')='N'
          AND NVL(l.st_anulado,'N')='N'
          {extra_sql}
        GROUP BY {group_by}
        HAVING SUM(NVL(l.monto_neto,0)) <> 0
        ORDER BY {order_by}
        """,
        params)

    return [{
        'agrupar': agr,
        'clave': (r['clave'] or '').strip(),
        'descripcion': (r['descripcion'] or '').strip(),
        'rnc': (r['rnc'] or '').strip(),
        'no_produ': (r['no_produ'] or '').strip(),
        'documento': (r['documento'] or '').strip(),
        'fecha': str(r['fecha'])[:10] if r['fecha'] else None,
        'facturas': int(r['facturas'] or 0),
        'lineas': int(r['lineas'] or 0),
        'cantidad': float(r['cantidad'] or 0),
        'venta': float(r['venta'] or 0),
        'costo': float(r['costo'] or 0),
        'beneficio': float(r['beneficio'] or 0),
        'margen_pct': float(r['margen_pct'] or 0),
    } for r in rows]


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

def get_asiento_contable(no_cia: str, punto: str, mes: int, ano: int) -> list[dict]:
    """Resumen del asiento contable de ventas del período.

    FAT no tiene detalle contable por línea como CxC (TCXC_DCDOCU). El asiento
    de ventas es siempre de la forma:
        DR Cuentas por Cobrar         = total_neto
        CR Ventas                     = total_neto - impuesto
        CR ITBIS por Pagar            = impuesto
    Agrupamos por tipo_factura para que el usuario vea el desglose por serie.
    """
    rows = client.fetch_dicts(
        "SELECT tipo_factura, "
        "SUM(NVL(total_neto,0)) AS total_neto, "
        "SUM(NVL(impuesto,0)) AS impuesto "
        "FROM FAT.TFAT_FACTURA "
        "WHERE no_cia=:1 AND punto=:2 "
        "AND EXTRACT(MONTH FROM fecha)=:3 AND EXTRACT(YEAR FROM fecha)=:4 "
        "AND NVL(st_anulado,'N')='N' "
        "GROUP BY tipo_factura ORDER BY tipo_factura",
        [no_cia, punto, mes, ano])
    out: list[dict] = []
    for r in rows:
        total = float(r['total_neto'] or 0)
        itbis = float(r['impuesto'] or 0)
        subtotal = total - itbis
        tipo = (r['tipo_factura'] or '').strip()
        out.append({'cuenta': f'CxC-{tipo}', 'centro_costo': punto, 'tipo_movi': 'D',
                    'total_debito': total, 'total_credito': 0.0})
        out.append({'cuenta': f'Ventas-{tipo}', 'centro_costo': punto, 'tipo_movi': 'C',
                    'total_debito': 0.0, 'total_credito': subtotal})
        if itbis:
            out.append({'cuenta': f'ITBIS-{tipo}', 'centro_costo': punto, 'tipo_movi': 'C',
                        'total_debito': 0.0, 'total_credito': itbis})
    return out


def list_facturas_pendientes_cnt(no_cia: str, punto: str, mes: int, ano: int) -> list[dict]:
    """Facturas autorizadas que aún no tienen asiento en CNT."""
    rows = client.fetch_dicts(
        "SELECT f.tipo_factura, f.no_factura, f.fecha, f.total_neto, f.impuesto, "
        "cl.nombre AS nombre_cliente "
        "FROM FAT.TFAT_FACTURA f "
        "LEFT JOIN CXC.TCXC_CLIENTE cl "
        "  ON cl.no_cia = f.no_cia AND cl.punto = f.punto AND cl.no_cliente = f.no_cliente "
        "WHERE f.no_cia=:1 AND f.punto=:2 "
        "AND EXTRACT(YEAR FROM f.fecha)=:3 AND EXTRACT(MONTH FROM f.fecha)=:4 "
        "AND NVL(f.st_generado_cnt,'N')='N' AND NVL(f.st_anulado,'N')='N' "
        "ORDER BY f.fecha, f.no_factura",
        [no_cia, punto, ano, mes])
    return [{'tipo_factura': r['tipo_factura'], 'no_factura': r['no_factura'],
             'fecha': str(r['fecha'])[:10] if r['fecha'] else None,
             'total_neto': float(r['total_neto'] or 0), 'impuesto': float(r['impuesto'] or 0),
             'nombre_cliente': (r['nombre_cliente'] or '').strip()} for r in rows]


def list_periodos_generados(no_cia: str, punto: str, limit: int = 24) -> list[dict]:
    """Historial de periodos cuyas facturas ya fueron marcadas como generadas
    en contabilidad (st_generado_cnt='S'). Se agrupa TFAT_FACTURA por
    (ano, mes) para reflejar cada asiento posteado al mayor."""
    rows = client.fetch_dicts(
        "SELECT * FROM ("
        "  SELECT EXTRACT(YEAR FROM fecha) AS ano, "
        "         EXTRACT(MONTH FROM fecha) AS mes, "
        "         COUNT(*) AS facturas, "
        "         SUM(NVL(total_neto,0)) AS total_neto, "
        "         SUM(NVL(impuesto,0)) AS impuesto, "
        "         MIN(fecha) AS fecha_desde, "
        "         MAX(fecha) AS fecha_hasta "
        "  FROM FAT.TFAT_FACTURA "
        "  WHERE no_cia=:1 AND punto=:2 "
        "  AND NVL(st_generado_cnt,'N')='S' AND NVL(st_anulado,'N')='N' "
        "  GROUP BY EXTRACT(YEAR FROM fecha), EXTRACT(MONTH FROM fecha) "
        "  ORDER BY 1 DESC, 2 DESC"
        ") WHERE ROWNUM <= :3",
        [no_cia, punto, limit])
    return [{
        'ano': int(r['ano']),
        'mes': int(r['mes']),
        'facturas': int(r['facturas']),
        'total_neto': float(r['total_neto'] or 0),
        'impuesto': float(r['impuesto'] or 0),
        'fecha_desde': str(r['fecha_desde'])[:10] if r.get('fecha_desde') else None,
        'fecha_hasta': str(r['fecha_hasta'])[:10] if r.get('fecha_hasta') else None,
    } for r in rows]


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
                  fecha_desde: str = '', fecha_hasta: str = '',
                  vendedor: str = '', no_cliente: str = '',
                  con_ventas_exentas: str = 'A') -> dict:
    """Listado de facturas.

    Parametros alineados con Rfat321 (Ffat307) legado: tipo_docu, vendedor,
    cliente, fecha_i/fecha_f. Extras del proyecto: estado, search (cliente
    nombre o NCF). Si tipo='T' se interpreta como 'todos' (no filtra).

    con_ventas_exentas (alineado con Rfat319):
      'S' -> solo facturas con impuesto = 0 (exentas)
      'N' -> solo facturas con impuesto != 0 (gravadas)
      'A' -> todas (default)
    """
    filters = ["f.no_cia = :no_cia", "f.punto = :punto"]
    params: dict = {'no_cia': no_cia, 'punto': punto}
    if tipo and tipo.strip().upper() != 'T':
        filters.append("f.tipo_factura = :tipo")
        params['tipo'] = tipo.strip().upper()
    if estado:
        filters.append("f.estado = :estado")
        params['estado'] = estado.strip().upper()
    if vendedor:
        filters.append("f.vendedor = :vendedor")
        params['vendedor'] = vendedor.strip().upper()
    if no_cliente:
        # LPAD para consistencia con Rfat321 — el legado guarda no_cliente padded
        filters.append("f.no_cliente = :no_cliente")
        params['no_cliente'] = no_cliente.strip()
    cve = (con_ventas_exentas or 'A').strip().upper()
    if cve == 'S':
        filters.append("NVL(f.impuesto,0) = 0")
    elif cve == 'N':
        filters.append("NVL(f.impuesto,0) != 0")
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
        f"LEFT JOIN CXC.TCXC_CLIENTE c "
        f"  ON c.no_cia = f.no_cia AND c.punto = f.punto AND c.no_cliente = f.no_cliente "
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
                    f.plazo_pago, NVL(tp.descripcion, f.forma_pago_fat) AS forma_pago,
                    f.st_anulado, f.st_impresion,
                    f.tipo_anula_dgii, ta.descripcion AS motivo_anulacion
                FROM FAT.TFAT_FACTURA f
                LEFT JOIN CXC.TCXC_CLIENTE c
                  ON c.no_cia = f.no_cia AND c.punto = f.punto AND c.no_cliente = f.no_cliente
                LEFT JOIN FAT.TFAT_TANULACION_DGII ta
                  ON ta.tipo = f.tipo_anula_dgii
                LEFT JOIN FAT.TFAT_TIPO_PAGO tp
                  ON tp.no_cia = f.no_cia AND tp.tipo_pago = f.forma_pago_fat
                WHERE {where}
                ORDER BY NVL(f.fecha_sysdate, f.fecha) DESC, f.no_factura DESC
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
            'plazo_pago': int(r['plazo_pago'] or 0), 'forma_pago': (r['forma_pago'] or '').strip(),
            'st_anulado': r['st_anulado'] or 'N', 'st_impresion': r['st_impresion'] or 'N',
            'tipo_anula_dgii': r['tipo_anula_dgii'] or '',
            'motivo_anulacion': (r['motivo_anulacion'] or '').strip(),
        } for r in rows],
        'total': total, 'page': page, 'page_size': page_size,
        'total_pages': max(1, (total + page_size - 1) // page_size),
    }


def get_factura(no_cia: str, punto: str, tipo_factura: str, no_factura: str) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT f.no_cia, f.punto, f.tipo_factura, f.no_factura, f.no_cliente, "
        "c.nombre AS nombre_cliente, f.nombre_cliente_factura, f.rnc_factura, "
        "f.fecha, f.vendedor, "
        "f.total_linea, f.descuento, f.impuesto, f.total_neto, f.propina, "
        "f.estado, f.ncf, f.posiciones_fijas_ncf, f.codigo_ncf, f.tipo_ncf_fiscal, "
        "f.plazo_pago, NVL(tp.descripcion, f.forma_pago_fat) AS forma_pago, f.no_condicion_pago, "
        "f.tasa_us, f.porc_impuesto, f.nota, f.detalle, f.usuario, "
        "f.st_anulado, f.st_impresion, f.st_generado_cnt, "
        "f.tipo_anula_dgii, ta.descripcion AS motivo_anulacion, "
        "NVL(f.valor_recibido,0) AS valor_recibido, NVL(f.valor_devuelto,0) AS valor_devuelto "
        "FROM FAT.TFAT_FACTURA f "
        "LEFT JOIN CXC.TCXC_CLIENTE c "
        "  ON c.no_cia = f.no_cia AND c.punto = f.punto AND c.no_cliente = f.no_cliente "
        "LEFT JOIN FAT.TFAT_TANULACION_DGII ta "
        "  ON ta.tipo = f.tipo_anula_dgii "
        "LEFT JOIN FAT.TFAT_TIPO_PAGO tp "
        "  ON tp.no_cia = f.no_cia AND tp.tipo_pago = f.forma_pago_fat "
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
    # Notas de credito / devoluciones aplicadas contra esta factura. El
    # espejo en CXC (cxc_repo.crear_dv_mirror, invocado al crear una DV en
    # INV) inserta el enlace en CXC.TCXC_REFEDOCU y reduce el saldo alla,
    # pero nunca tocaba TFAT_FACTURA -- por eso la factura en FAT no
    # mostraba nada aunque CXC ya reflejara el saldo reducido (ticket
    # 77ab905c, MPILAR: FC-1530 / DV-0000038).
    aplicaciones = client.fetch_dicts(
        "SELECT rd.tipo_docu, rd.no_docu, NVL(rd.monto,0) AS monto, "
        "d.fecha, d.ncf, d.posiciones_fijas_ncf "
        "FROM CXC.TCXC_REFEDOCU rd "
        "LEFT JOIN CXC.TCXC_DOCUMENTO d "
        "  ON d.no_cia=rd.no_cia AND d.punto=rd.punto "
        "  AND d.tipo_docu=rd.tipo_docu AND d.no_docu=rd.no_docu "
        "WHERE rd.no_cia=:1 AND rd.tipo_refe=:2 AND rd.no_refe=:3 "
        "ORDER BY d.fecha",
        [no_cia, tipo_factura.strip().upper(), no_factura.strip()])
    return {
        'no_cia': r['no_cia'], 'punto': r['punto'], 'tipo_factura': r['tipo_factura'] or '',
        'no_factura': r['no_factura'] or '', 'no_cliente': int(r['no_cliente'] or 0),
        'nombre_cliente': (r['nombre_cliente'] or '').strip(),
        'nombre_cliente_factura': (r['nombre_cliente_factura'] or '').strip(),
        'rnc_factura': (r['rnc_factura'] or '').strip(),
        'fecha': str(r['fecha'])[:10] if r['fecha'] else None, 'vendedor': r['vendedor'] or '',
        'total_linea': float(r['total_linea'] or 0), 'descuento': float(r['descuento'] or 0),
        'impuesto': float(r['impuesto'] or 0), 'total_neto': float(r['total_neto'] or 0),
        'propina': float(r['propina'] or 0), 'estado': r['estado'] or 'P',
        'ncf': int(r['ncf']) if r['ncf'] else None,
        'posiciones_fijas_ncf': (r['posiciones_fijas_ncf'] or '').strip().upper(),
        'ncf_dgi': _compose_ncf_dgi(r['posiciones_fijas_ncf'], r['ncf']),
        'codigo_ncf': r['codigo_ncf'] or '',
        'tipo_ncf_fiscal': r['tipo_ncf_fiscal'] or '', 'plazo_pago': int(r['plazo_pago'] or 0),
        'forma_pago': (r['forma_pago'] or '').strip(), 'no_condicion_pago': r['no_condicion_pago'] or '',
        'tasa_us': float(r['tasa_us'] or 0), 'porc_impuesto': float(r['porc_impuesto'] or 0),
        'nota': r['nota'] or '', 'detalle': r['detalle'] or '',
        'usuario': (r['usuario'] or '').strip(),
        'st_anulado': r['st_anulado'] or 'N', 'st_impresion': r['st_impresion'] or 'N',
        'st_generado_cnt': r['st_generado_cnt'] or 'N',
        'tipo_anula_dgii': r['tipo_anula_dgii'] or '',
        'motivo_anulacion': (r['motivo_anulacion'] or '').strip(),
        'valor_recibido': float(r['valor_recibido'] or 0),
        'valor_devuelto': float(r['valor_devuelto'] or 0),
        'lineas': [{
            'no_linea': int(l['no_linea'] or 0), 'no_produ': l['no_produ'] or '',
            'descripcion': (l['descripcion'] or '').strip(), 'almacen': l['almacen'] or '',
            'cantidad': float(l['cantidad'] or 0), 'precio': float(l['precio'] or 0),
            'porc_descuento': float(l['porc_descuento'] or 0), 'descuento': float(l['descuento'] or 0),
            'porciento_impuesto': float(l['porciento_impuesto'] or 0),
            'impuesto': float(l['impuesto'] or 0), 'monto_neto': float(l['monto_neto'] or 0),
            'cantidad_regalia': float(l['cantidad_regalia'] or 0), 'st_anulado': l['st_anulado'] or 'N',
        } for l in lineas],
        'notas_credito_aplicadas': [{
            'tipo_docu': a['tipo_docu'] or '',
            'no_docu': (a['no_docu'] or '').strip(),
            'monto': float(a['monto'] or 0),
            'fecha': str(a['fecha'])[:10] if a['fecha'] else None,
            'ncf_dgi': _compose_ncf_dgi(a['posiciones_fijas_ncf'], a['ncf']),
        } for a in aplicaciones],
    }


def get_datos_fiscales_factura(no_cia: str, punto: str, tipo_factura: str,
                               no_factura: str) -> dict | None:
    """Campos fiscales de la factura no expuestos por get_factura(), para e-CF.

    Usado por apps.fe.ecf_builder (Task 1 de Fase 2 e-CF) junto con
    get_factura() para armar el XML del comprobante electronico:
    - rnc_comprador: mismo criterio NVL(rnc_factura, cliente.rnc) que ya usa
      archivo_dgii_607 (ver rows_f mas arriba en este archivo) para no
      divergir del RNC que el 607 ya reporta para esta misma factura.
    - direccion_comprador/cedula_comprador: de CXC.TCXC_CLIENTE (no hay
      TFAT_CLIENTE, los clientes viven en CXC).
    - tipo_ingreso: crudo de TFAT_FACTURA.tipo_ingreso (catalogo '01'..'06'
      de e-CF IdDoc/TipoIngresos), NVL a 1 si nunca se capturo.
    - forma_pago_fat/tipo_pago_fiscal: codigos crudos de TFAT_TIPO_PAGO
      (tipo_pago_fiscal es el mismo campo que archivo_dgii_607 ya usa como
      "forma_pago_dgii" para las columnas 17-23 del 607).
    - lineas_porciento_raw: {no_linea: porciento_impuesto|None} SIN el
      `NVL(...,0)` que get_factura() aplica a sus lineas -- ese NVL colapsa
      "sin ITBIS registrado" (NULL, e-CF IndicadorFacturacion=4 Exento) con
      "ITBIS 0% explicito" (e-CF IndicadorFacturacion=3) en el mismo 0.0, y
      el e-CF SI distingue ambos casos (ver NOTAS.md #2).
    """
    rows = client.fetch_dicts(
        "SELECT NVL(f.rnc_factura, cl.rnc) rnc_comprador, "
        "NVL(cl.direccion,'') direccion_comprador, "
        "NVL(cl.cedula,'') cedula_comprador, "
        "NVL(f.tipo_ingreso,1) tipo_ingreso, "
        "f.forma_pago_fat, NVL(tp.tipo_pago_fiscal,'') tipo_pago_fiscal "
        "FROM FAT.TFAT_FACTURA f "
        "LEFT JOIN CXC.TCXC_CLIENTE cl "
        "  ON cl.no_cia = f.no_cia AND cl.punto = f.punto AND cl.no_cliente = f.no_cliente "
        "LEFT JOIN FAT.TFAT_TIPO_PAGO tp "
        "  ON tp.no_cia = f.no_cia AND tp.tipo_pago = f.forma_pago_fat "
        "WHERE f.no_cia=:1 AND f.punto=:2 AND f.tipo_factura=:3 AND f.no_factura=:4",
        [no_cia, punto, tipo_factura.strip().upper(), no_factura.strip()])
    if not rows:
        return None
    r = rows[0]
    lineas_raw = client.fetch_dicts(
        "SELECT no_linea, porciento_impuesto FROM FAT.TFAT_FACTURAL "
        "WHERE no_cia=:1 AND punto=:2 AND tipo_factura=:3 AND no_factura=:4",
        [no_cia, punto, tipo_factura.strip().upper(), no_factura.strip()])
    return {
        'rnc_comprador': (r['rnc_comprador'] or '').strip(),
        'direccion_comprador': (r['direccion_comprador'] or '').strip(),
        'cedula_comprador': (r['cedula_comprador'] or '').strip(),
        'tipo_ingreso': f"{int(r['tipo_ingreso'] or 1):02d}",
        'forma_pago_fat': (r['forma_pago_fat'] or '').strip(),
        'tipo_pago_fiscal': (r['tipo_pago_fiscal'] or '').strip(),
        'lineas_porciento_raw': {
            int(l['no_linea']): (float(l['porciento_impuesto'])
                                 if l['porciento_impuesto'] is not None else None)
            for l in lineas_raw
        },
    }


def list_vendedores(no_cia: str) -> list[dict]:
    # Misma fuente que /api/cxc/vendedores/ (TCXC_VENDEDOR sin filtrar por activo)
    # para que la lista de vendedores en facturacion/conduce coincida exactamente
    # con la pantalla /settings/cxc-vendedores. Se ordena por nombre para UX
    # de dropdown y se incluye 'activo' para que el frontend pueda filtrar/
    # marcar visualmente si lo desea.
    rows = client.fetch_dicts(
        "SELECT VENDEDOR, NOMBRE, NVL(ACTIVO,'S') ACTIVO, USUARIO "
        "FROM CXC.TCXC_VENDEDOR "
        "WHERE NO_CIA = :1 "
        "ORDER BY NVL(ACTIVO,'S') DESC, NOMBRE",
        [no_cia])
    return [{
        'vendedor': r['vendedor'] or '',
        'nombre': (r['nombre'] or '').strip(),
        'activo': r['activo'] or 'S',
        'usuario': (r['usuario'] or '').strip().upper(),
    } for r in rows]


def vendedor_de_usuario(no_cia: str, usuario: str) -> str:
    """Vendedor por defecto del usuario logueado (TCXC_VENDEDOR.USUARIO).
    Se usa para autoseleccionar el vendedor en Facturación cuando el documento
    es a crédito. Un usuario puede tener varios vendedores asignados; se prefiere
    el activo de menor código para dar un resultado estable. Devuelve '' si el
    usuario no tiene ningún vendedor asignado en la compañía."""
    u = (usuario or '').strip().upper()
    if not u:
        return ''
    rows = client.fetch_dicts(
        "SELECT VENDEDOR FROM CXC.TCXC_VENDEDOR "
        "WHERE NO_CIA = :1 AND UPPER(USUARIO) = :2 "
        "ORDER BY NVL(ACTIVO,'S') DESC, VENDEDOR",
        [no_cia, u])
    return (rows[0]['vendedor'] or '').strip() if rows else ''


def list_clientes(no_cia: str, punto: str = '01', search: str = '', page: int = 1, page_size: int = 30) -> dict:
    filters = ["no_cia = :no_cia", "punto = :punto"]
    params: dict = {'no_cia': no_cia, 'punto': punto}
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
                SELECT punto, no_cliente, nombre, rnc, cedula, telefono,
                    ciudad, direccion, codigo_ncf, NVL(plazo,0) AS plazo
                FROM CXC.TCXC_CLIENTE WHERE {where} ORDER BY nombre
            ) a WHERE ROWNUM <= :end_row
        ) WHERE rn > :start_row
    """
    rows = client.fetch_dicts(sql, params)
    return {
        'items': [{'no_cliente': int(r['no_cliente']), 'nombre': (r['nombre'] or '').strip(),
                   'punto': r['punto'] or '',
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


def upsert_condicion_pago(no_condicion_pago: str, descripcion: str,
                          plazo_pago: int = 0, porciento: float = 0.0,
                          activa: bool = True) -> dict:
    codigo = str(no_condicion_pago).strip().upper()
    activa_flag = 'S' if activa else 'N'
    with client.cursor() as cur:
        cur.execute("SELECT 1 FROM FAT.TFAT_CONDICION_PAGO WHERE no_condicion_pago=:1", [codigo])
        exists = cur.fetchone() is not None
        if exists:
            cur.execute(
                "UPDATE FAT.TFAT_CONDICION_PAGO "
                "SET descripcion=:1, plazo_pago=:2, porciento=:3, activa=:4 "
                "WHERE no_condicion_pago=:5",
                [descripcion, int(plazo_pago), float(porciento), activa_flag, codigo])
        else:
            cur.execute(
                "INSERT INTO FAT.TFAT_CONDICION_PAGO"
                "(no_condicion_pago, descripcion, plazo_pago, porciento, activa) "
                "VALUES(:1,:2,:3,:4,:5)",
                [codigo, descripcion, int(plazo_pago), float(porciento), activa_flag])
        cur.connection.commit()
    return {'no_condicion_pago': codigo, 'action': 'updated' if exists else 'created'}


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


def ncf_ya_usado(no_cia: str, ncf_num: int, codigo_ncf: str = "") -> bool:
    """True si ese NCF ya está usado en alguna factura no anulada."""
    params = [no_cia, int(ncf_num)]
    extra = ""
    if codigo_ncf:
        extra = " AND CODIGO_NCF=:3"
        params.append(codigo_ncf.strip().upper())
    row = client.fetch_one(
        "SELECT COUNT(*) FROM FAT.TFAT_FACTURA "
        f"WHERE NO_CIA=:1 AND NCF=:2{extra} AND NVL(ST_ANULADO,'N')='N'",
        params)
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
        f"LEFT JOIN CXC.TCXC_CLIENTE c "
        f"  ON c.no_cia = f.no_cia AND c.punto = f.punto AND c.no_cliente = f.no_cliente "
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
                    f.total_neto, f.estado, f.ncf, f.codigo_ncf
                FROM FAT.TFAT_FACTURA f
                LEFT JOIN CXC.TCXC_CLIENTE c
                  ON c.no_cia = f.no_cia AND c.punto = f.punto AND c.no_cliente = f.no_cliente
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
        f"LEFT JOIN CXC.TCXC_CLIENTE cl "
        f"  ON cl.no_cia=f.no_cia AND cl.punto=f.punto AND cl.no_cliente=f.no_cliente "
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
        "LEFT JOIN CXC.TCXC_CLIENTE cl "
        "  ON cl.no_cia=f.no_cia AND cl.punto=f.punto AND cl.no_cliente=f.no_cliente "
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
    """Busqueda paginada de productos con existencia normalizada y precio.

    PERF (2026-05-30): la existencia se computa DESPUES de paginar.
    Antes el LEFT JOIN agregaba TINV_MOVIMIENTO entero (millones de filas) por
    cada busqueda → CPU al 100%. Ahora: (1) lista+pagina productos (rapido,
    usa indices por no_produ/descri); (2) UN solo query agrupa TINV_MOVIMIENTO
    filtrado por IN (...) con los no_produ de la pagina (max page_size); (3)
    filtra `solo_existencia` en memoria sobre la pagina.

    PERF (2026-05-31, Gap G1): el `um_join` (TINV_EMPAQUE+TINV_UNIDAD para
    empaque por defecto) tambien se sacó del base_sql paginado. Antes el
    plan hacía NESTED LOOPS OUTER + VIEW PUSHED PREDICATE contra TINV_EMPAQUE
    (Cost 48); ahora el SQL paginado solo toca TINV_PRODUCTO+TFAT_LISTA_PRECIO
    (Cost 2) y los datos de empaque se traen en un bulk WHERE no_produ IN
    (...) con max page_size IDs (Cost 0 via INLIST ITERATOR + INDEX RANGE SCAN).
    Mismo patrón que la existencia. El precio se recalcula como
    `precio_base * NVL(cpe, 1)` en Python.
    Misma normalizacion que get_existencia_producto en inv_repo.py.
    """
    offset = (page - 1) * page_size

    # Codigos exactos candidatos: lo tecleado tal cual y, si es numerico, su
    # version zero-padded a 8 (formato real de TINV_PRODUCTO.no_produ). Un
    # match exacto SIEMPRE se muestra aunque solo_existencia lo dejaria fuera
    # (en Entrada de Compras existencia 0 es lo normal: se esta comprando) y
    # se ordena de primero en la pagina.
    exact_codes: set[str] = set()
    if search:
        _s = search.strip().upper()
        if _s:
            exact_codes.add(_s)
            if _s.isdigit() and len(_s) < 8:
                exact_codes.add(_s.zfill(8))

    select_cols = (
        "p.no_produ, NVL(p.descri, p.no_produ) AS descri, "
        "NVL(p.tiene_impuesto, 'S') AS tiene_impuesto, "
        "NVL(p.porciento_impuesto, 0) AS porciento_impuesto, "
        "NVL(p.activo, 'S') AS activo "
    )
    if no_lista:
        # precio_base = lp.precio (sin multiplicar por CPE todavía; ese paso
        # se hace en Python despues del bulk de empaques).
        base_sql = (
            "SELECT " + select_cols +
            ", NVL(lp.precio, 0) AS precio_base "
            "FROM INV.TINV_PRODUCTO p "
            "LEFT JOIN FAT.TFAT_LISTA_PRECIO lp "
            "  ON lp.no_produ = p.no_produ "
            "  AND lp.no_cia = :no_cia AND lp.punto = :punto AND lp.no_lista = :no_lista "
            "WHERE NVL(p.activo,'S') = 'S' "
        )
        params = {"no_cia": no_cia, "punto": punto, "no_lista": no_lista}
    else:
        base_sql = (
            "SELECT " + select_cols +
            ", 0 AS precio_base "
            "FROM INV.TINV_PRODUCTO p "
            "WHERE NVL(p.activo,'S') = 'S' "
        )
        params = {}
    if search:
        base_sql += "AND (UPPER(p.no_produ) LIKE :srch OR UPPER(p.descri) LIKE :srch) "
        params["srch"] = "%{}%".format(search.upper())
    if exact_codes:
        ex_binds = {"ex{}".format(i): v for i, v in enumerate(sorted(exact_codes))}
        params.update(ex_binds)
        base_sql += (
            "ORDER BY CASE WHEN UPPER(p.no_produ) IN ({}) THEN 0 ELSE 1 END, "
            "p.no_produ".format(",".join(":" + k for k in ex_binds))
        )
    else:
        base_sql += "ORDER BY p.no_produ"

    # COUNT y paginacion rapidos (sin existencia ni empaque).
    count_sql = "SELECT COUNT(*) FROM ({})".format(base_sql)
    total_row = client.fetch_one(count_sql, params)
    total = int(total_row[0]) if total_row else 0
    if total == 0:
        return {"items": [], "total": 0, "page": page, "page_size": page_size, "total_pages": 0}
    paged_sql = (
        "SELECT * FROM ( SELECT a.*, ROWNUM rn FROM ({}) a "
        "WHERE ROWNUM <= :end_row) WHERE rn > :start_row"
    ).format(base_sql)

    def _fetch_rows(chunk_offset: int) -> list[dict]:
        p = dict(params)
        p["end_row"] = chunk_offset + page_size
        p["start_row"] = chunk_offset
        return client.fetch_dicts(paged_sql, p)

    def _build_items(rows: list[dict]) -> list[dict]:
        return _productos_items(rows, no_cia, almacen, punto)

    if solo_existencia:
        # El filtro de existencia es en-memoria sobre cada pagina de DB: si
        # deja la pagina corta hay que seguir trayendo paginas hasta llenar
        # page_size (tope 10 chunks para acotar costo). Antes la pagina podia
        # quedar vacia aunque hubiera productos con existencia mas adelante.
        items: list[dict] = []
        chunk_offset = offset
        for _ in range(10):
            rows = _fetch_rows(chunk_offset)
            if not rows:
                break
            for it in _build_items(rows):
                if it["existencia"] <= 0 and it["no_produ"].strip().upper() not in exact_codes:
                    continue
                items.append(it)
            chunk_offset += page_size
            if len(items) >= page_size or chunk_offset >= total:
                break
        items = items[:page_size]
    else:
        items = _build_items(_fetch_rows(offset))
    return {
        "items": items, "total": total, "page": page, "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
    }


def _productos_items(rows: list[dict], no_cia: str, almacen: str,
                     punto: str = '') -> list[dict]:
    """Enriquece una pagina de TINV_PRODUCTO con empaque por defecto,
    existencia vendible y precio de venta (precio_base * CPE). Los bulk
    fetch usan IN (...) con max page_size IDs — ver notas PERF de
    search_productos."""
    no_produs = [r["no_produ"] for r in rows if r.get("no_produ")]

    # Bulk fetch del empaque por defecto (unidad + CPE) para los productos
    # de la pagina. Patrón identico al de existencia.
    empaque_map: dict[str, dict] = {}
    if no_produs:
        binds = {f"ep{i}": v for i, v in enumerate(no_produs)}
        in_list = ",".join(":{}".format(k) for k in binds.keys())
        emp_sql = (
            "SELECT e.no_produ, NVL(u.descri, e.unidad) AS unidad_empaque, "
            "       NVL(e.cpe, 1) AS cpe "
            "FROM INV.TINV_EMPAQUE e "
            "LEFT JOIN INV.TINV_UNIDAD u ON u.unidad = e.unidad "
            f"WHERE e.por_defecto='S' AND e.no_produ IN ({in_list})"
        )
        for r in client.fetch_dicts(emp_sql, binds):
            empaque_map[r["no_produ"]] = {
                "unidad_empaque": (r["unidad_empaque"] or "").strip(),
                "cpe": float(r["cpe"] or 1) or 1.0,
            }

    # Existencia vendible solo para los productos de la pagina (max page_size).
    # Fuente: TINV_EPRODUCTO.exist_actual — la MISMA que valida create_factura
    # y que protege el CHECK exist_actual >= 0. El calculo anterior sumaba el
    # ledger TINV_MOVIMIENTO, que esta desincronizado historicamente de
    # exist_actual (1,141 productos solo en cia 01/alm 01): mostraba stock
    # que luego no se podia facturar y ocultaba stock vendible.
    exist_map: dict[str, float] = {}
    if no_produs:
        binds = {f"np{i}": v for i, v in enumerate(no_produs)}
        in_list = ",".join(":{}".format(k) for k in binds.keys())
        ex_params = {"no_cia_ex": no_cia, **binds}
        extra_filter = ""
        if punto:
            extra_filter += " AND ep.punto=:punto_ex"
            ex_params["punto_ex"] = punto
        if almacen:
            extra_filter += " AND ep.almacen=:almacen_ex"
            ex_params["almacen_ex"] = almacen
        ex_sql = (
            "SELECT ep.no_produ, SUM(NVL(ep.exist_actual,0)) AS existencia "
            "FROM INV.TINV_EPRODUCTO ep "
            f"WHERE ep.no_cia=:no_cia_ex AND ep.no_produ IN ({in_list}){extra_filter} "
            "GROUP BY ep.no_produ"
        )
        for r in client.fetch_dicts(ex_sql, ex_params):
            exist_map[r["no_produ"]] = float(r["existencia"] or 0)

    items = []
    for r in rows:
        np = r["no_produ"]
        ex = exist_map.get(np, 0.0)
        emp = empaque_map.get(np) or {"unidad_empaque": "", "cpe": 1.0}
        precio_base = float(r["precio_base"] or 0)
        # precio venta = precio unitario × CPE del empaque por defecto.
        precio = round(precio_base * (emp["cpe"] or 1), 4)
        # Producto exento (TIENE_IMPUESTO='N') nunca cobra ITBIS aunque la
        # columna PORCIENTO_IMPUESTO haya quedado con un valor viejo (ej. el
        # 18% por defecto que tenia antes de marcarlo exento) — reportado por
        # MPILAR: producto "exento" seguia saliendo con ITBIS al facturar.
        tiene_imp = (r.get("tiene_impuesto") or "S") == "S"
        items.append({
            "no_produ": np,
            "descri": (r["descri"] or "").strip(),
            "precio": precio,
            "porciento_impuesto": float(r["porciento_impuesto"] or 0) if tiene_imp else 0.0,
            "existencia": ex,
            "unidad_empaque": emp["unidad_empaque"],
            "activo": r["activo"] == "S",
        })
    return items


# -- Empaques (unidades) por producto -----------------------------------------
# INV.TINV_EMPAQUE guarda las variantes de empaque por producto (UNIDAD,
# POR_DEFECTO, CANT_POR_EMP, PRECIO/COSTO). En facturación necesitamos saber
# si un producto tiene más de un empaque para dejar al usuario cambiar la UM.

def list_empaques_producto(no_produ: str) -> list[dict]:
    if not no_produ:
        return []
    rows = client.fetch_dicts(
        "SELECT e.empaque, e.unidad, e.referencia, "
        "       NVL(u.descri, e.unidad) AS descripcion, "
        "       NVL(e.por_defecto, 'N') AS por_defecto, "
        "       NVL(e.permite_fraccion, 'N') AS permite_fraccion, "
        "       NVL(e.cpe, 1) AS cpe "
        "FROM   INV.TINV_EMPAQUE e "
        "LEFT JOIN INV.TINV_UNIDAD u ON u.unidad = e.unidad "
        "WHERE  e.no_produ = :1 "
        "ORDER BY NVL(e.por_defecto,'N') DESC, e.empaque",
        [no_produ.strip().upper()],
    )
    return [{
        "empaque": int(r["empaque"]) if r.get("empaque") is not None else None,
        "unidad": (r["unidad"] or "").strip(),
        "descripcion": (r["descripcion"] or "").strip(),
        "referencia": (r["referencia"] or "").strip(),
        "por_defecto": (r["por_defecto"] or "N") == "S",
        "permite_fraccion": (r["permite_fraccion"] or "N") == "S",
        "cant_por_emp": float(r["cpe"] or 1),
    } for r in rows]


# -- Crear Factura ------------------------------------------------------------

def create_factura(no_cia, punto, tipo_factura, no_cliente, fecha, vendedor,
                   forma_pago, no_lista, nota, lineas, usuario,
                   codigo_ncf: str = "", detalle: str = "",
                   valor_recibido: float = 0.0,
                   nombre_cliente_factura: str = "", rnc_factura: str = ""):
    # Override por documento del nombre/RNC del cliente -- necesario para
    # clientes genericos compartidos (ej. 142 CONSUMIDOR FINAL, RNC
    # generico) donde cada venta puede ser a una persona/empresa real
    # distinta. NUNCA modifica el maestro TCXC_CLIENTE, solo esta factura
    # puntual (impresion/consulta la usan si esta presente, si no cae al
    # nombre/RNC del cliente como siempre). Reportado por MPILAR.
    nombre_cliente_factura = (nombre_cliente_factura or "").strip()[:40] or None
    rnc_factura = (rnc_factura or "").strip()[:16] or None
    tf = tipo_factura.strip().upper()
    fp = forma_pago.strip().upper() if forma_pago else ""
    detalle_s = str(detalle or '').strip()
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
        if new_no_factura.isdigit():
            # Forms numeraba con LPAD a 7 ('0008119'); continuar esa serie
            # evita numeros mixtos frente al historico legacy.
            new_no_factura = new_no_factura.zfill(7)
        cur.execute(
            "SELECT tipo_transaccion, codigo_ncf, NVL(afecta_cxc,'N') AS afecta_cxc "
            "FROM FAT.TFAT_TDOCU WHERE no_cia=:1 AND tipo_docu=:2",
            [no_cia, tf])
        tdocu_row = cur.fetchone()
        tipo_transaccion = tdocu_row[0] if tdocu_row else "V"
        codigo_ncf_doc = (tdocu_row[1] or "").strip().upper() if tdocu_row else ""
        afecta_cxc = (tdocu_row[2] or "N") if tdocu_row else "N"
        # Una factura a credito (afecta_cxc='S', ej. FC) nunca debe quedar
        # registrada con una forma de pago de "ya cobrado" (efectivo, cheque,
        # tarjeta, transferencia) — eso todavia no paso. La forma de pago
        # real la decide el cobrador cuando aplique el RI en CxC. Forzamos
        # tipo_pago='4' (A CREDITO, TFAT_TIPO_PAGO) para no depender de que
        # el facturador se acuerde de escogerlo el mismo.
        if afecta_cxc == 'S':
            fp = '4'
        cur.execute(
            "SELECT NVL(codigo_ncf,''), NVL(rnc,'') FROM CXC.TCXC_CLIENTE "
            "WHERE no_cia=:1 AND punto=:2 AND no_cliente=:3",
            [no_cia, punto, no_cliente])
        cli_ncf_row = cur.fetchone()
        codigo_ncf_cliente = (cli_ncf_row[0] or "").strip().upper() if cli_ncf_row else ""
        cliente_tiene_rnc = bool((cli_ncf_row[1] or "").strip()) if cli_ncf_row else False
        codigo_ncf_emitir = (codigo_ncf or "").strip().upper() or codigo_ncf_cliente
        if not codigo_ncf_emitir:
            # Si el cliente no tiene CODIGO_NCF propio configurado (p.ej. se
            # registro directo en el legado y ese campo quedo vacio), NO
            # asumir ciegamente la serie por defecto del TIPO DE DOCUMENTO
            # (eso daba B02/Consumo aun cuando el cliente tiene RNC y es
            # fiscal, solo porque se facturo como FT en vez de FC). Si el
            # cliente tiene RNC, buscar la serie B01 (Credito Fiscal) real de
            # esta compania en vez de la del tipo de documento.
            if cliente_tiene_rnc:
                cur.execute(
                    "SELECT codigo_ncf FROM CNT.TCNT_NCF "
                    "WHERE no_localidad=:1 AND posiciones_fijas='B01' "
                    "  AND ROWNUM=1",
                    [no_cia])
                b01_row = cur.fetchone()
                if b01_row and b01_row[0]:
                    codigo_ncf_emitir = b01_row[0].strip().upper()
            if not codigo_ncf_emitir:
                codigo_ncf_emitir = codigo_ncf_doc
        ncf_val = None
        tipo_ncf_fiscal = ""
        posiciones_fijas_ncf = ""
        if codigo_ncf_emitir:
            cur.execute(
                "SELECT prox_ncf, tipo_ncf_fiscal, posiciones_fijas, ncf_final FROM CNT.TCNT_NCF "
                "WHERE no_localidad=:1 AND codigo_ncf=:2 FOR UPDATE",
                [no_cia, codigo_ncf_emitir])
            ncf_row = cur.fetchone()
            if ncf_row:
                ncf_val = int(ncf_row[0] or 0)
                tipo_ncf_fiscal = (ncf_row[1] or "").strip()
                posiciones_fijas_ncf = (ncf_row[2] or "").strip().upper()
                ncf_final = int(ncf_row[3] or 0)
                # Auto-fix: si prox_ncf ya está usado en una factura activa,
                # saltar al siguiente disponible. Evita duplicados que se generan
                # cuando se libera un NCF de una factura intermedia.
                while ncf_val and ncf_val <= ncf_final:
                    cur.execute(
                        "SELECT 1 FROM FAT.TFAT_FACTURA "
                        "WHERE no_cia=:1 AND codigo_ncf=:2 AND ncf=:3 "
                        "  AND NVL(st_anulado,'N')<>'S' AND ROWNUM<=1",
                        [no_cia, codigo_ncf_emitir, ncf_val])
                    if cur.fetchone():
                        ncf_val += 1
                    else:
                        break
                if ncf_val > ncf_final:
                    raise ValueError("Serie NCF {} agotada".format(codigo_ncf_emitir))
            else:
                raise ValueError("Serie NCF {} no encontrada para la empresa {}".format(codigo_ncf_emitir, no_cia))
        total_linea = 0.0
        total_descuento = 0.0
        total_impuesto = 0.0
        lineas_calc = []
        pedido_acum: dict = {}
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
            no_produ_norm = lin.get("no_produ", "").strip().upper()
            almacen_norm = lin.get("almacen", "").strip()
            cur.execute(
                "SELECT 1 FROM INV.TINV_PRODUCTO "
                "WHERE no_produ=:1 AND NVL(activo,'S')='S'",
                [no_produ_norm])
            if not cur.fetchone():
                raise ValueError("Producto {} no existe o esta inactivo".format(no_produ_norm))
            cur.execute(
                "SELECT NVL(ep.costo_actual,0), NVL(ep.exist_actual,0) "
                "FROM INV.TINV_EPRODUCTO ep "
                "WHERE ep.no_cia=:1 AND ep.punto=:2 AND ep.almacen=:3 AND ep.no_produ=:4",
                [no_cia, punto, almacen_norm, no_produ_norm])
            row_ep = cur.fetchone()
            if row_ep is None:
                raise ValueError(
                    "Producto {} no esta asignado al almacen {} "
                    "en la empresa {}".format(no_produ_norm, almacen_norm, no_cia))
            costo_unit = float(row_ep[0] or 0)
            exist_disp = float(row_ep[1] or 0)
            # TINV_EPRODUCTO tiene CHECK exist_actual >= 0: si la venta deja
            # existencia negativa Oracle lanza ORA-02290 y el cliente recibe
            # un 500 opaco. Validar aqui (acumulando lineas repetidas del
            # mismo producto/almacen) para responder 400 con mensaje claro.
            key_ped = (almacen_norm, no_produ_norm)
            pedido_acum[key_ped] = pedido_acum.get(key_ped, 0.0) + cant
            if pedido_acum[key_ped] > exist_disp:
                raise ValueError(
                    "Existencia insuficiente del producto {} en almacen {}: "
                    "disponible {:g}, solicitado {:g}".format(
                        no_produ_norm, almacen_norm, exist_disp,
                        pedido_acum[key_ped]))
            cur.execute(
                "SELECT empaque, NVL(cpe,1) FROM INV.TINV_EMPAQUE "
                "WHERE no_produ=:1 "
                "ORDER BY CASE WHEN NVL(por_defecto,'N')='S' THEN 0 ELSE 1 END, empaque",
                [no_produ_norm])
            row_emp = cur.fetchone()
            if row_emp:
                empaque_unit = int(row_emp[0] or 1)
                cpe_unit = float(row_emp[1] or 1)
            else:
                empaque_unit = 1
                cpe_unit = 1.0
            lineas_calc.append({"no_linea": idx,
                "no_produ": no_produ_norm,
                "almacen": almacen_norm,
                "descripcion": lin.get("descripcion", "").strip(),
                "cantidad": cant, "precio": precio, "porc_descuento": porc_desc,
                "descuento": desc_monto, "porciento_impuesto": porc_imp,
                "impuesto": imp_monto, "monto_neto": neto,
                "costo": costo_unit, "empaque": empaque_unit, "cpe": cpe_unit})
        total_neto = total_linea - total_descuento + total_impuesto
        valor_devuelto = round(max(0.0, valor_recibido - total_neto), 2) if valor_recibido else 0.0
        cur.execute(
            "INSERT INTO FAT.TFAT_FACTURA("
            "no_cia,punto,tipo_factura,no_factura,no_cliente,fecha,vendedor,"
            "total_linea,descuento,impuesto,total_neto,estado,"
            "ncf,codigo_ncf,tipo_ncf_fiscal,posiciones_fijas_ncf,"
            "st_anulado,st_impresion,st_generado_cnt,"
            "usuario,nota,no_formulario,tipo_transaccion,"
            "tasa_us,porc_impuesto,no_condicion_pago,tipo_moneda,"
            "propina,plazo_pago,afecta_cxc,forma_pago_fat,fecha_sysdate,detalle,"
            "valor_recibido,valor_devuelto,nombre_cliente_factura,rnc_factura"
            ") VALUES("
            ":1,:2,:3,:4,:5,TO_DATE(:6,'YYYY-MM-DD'),:7,"
            ":8,:9,:10,:11,'A',"
            ":12,:13,:14,:15,"
            "'N','N','N',"
            ":16,:17,:18,:19,"
            "57.5,18,'','RD',"
            "0,0,:20,:21,SYSDATE,:22,"
            ":23,:24,:25,:26"
            ")",
            [no_cia, punto, tf, new_no_factura, no_cliente, fecha, vendedor,
             total_linea, total_descuento, total_impuesto, total_neto,
             ncf_val, codigo_ncf_emitir, tipo_ncf_fiscal, posiciones_fijas_ncf,
             usuario, nota, str(prox_formulario), tipo_transaccion,
             afecta_cxc, fp, detalle_s, valor_recibido, valor_devuelto,
             nombre_cliente_factura, rnc_factura])
        for lin in lineas_calc:
            cur.execute(
                "INSERT INTO FAT.TFAT_FACTURAL("
                "no_cia,punto,tipo_factura,no_factura,no_linea,"
                "almacen,no_produ,cantidad,precio,costo,empaque,cpe,"
                "porc_descuento,descuento,porciento_impuesto,impuesto,monto_neto,"
                "descripcion,st_anulado,cantidad_regalia"
                ") VALUES("
                ":1,:2,:3,:4,:5,:6,:7,:8,:9,:10,:11,:12,:13,:14,:15,:16,:17,:18,'N',0"
                ")",
                [no_cia, punto, tf, new_no_factura, lin["no_linea"],
                 lin["almacen"], lin["no_produ"], lin["cantidad"], lin["precio"],
                 lin["costo"], lin["empaque"], lin["cpe"],
                 lin["porc_descuento"], lin["descuento"],
                 lin["porciento_impuesto"], lin["impuesto"], lin["monto_neto"],
                 lin["descripcion"]])
            # La factura nueva debe descargar inventario en el ledger INV.
            cur.execute(
                "INSERT INTO INV.TINV_MOVIMIENTO("
                "  no_cia, punto, tipo_docu, no_docu, no_linea,"
                "  almacen, no_produ, tipo_movi, tipo_transaccion, servicio,"
                "  fecha, cantidad, precio, costo,"
                "  st_anulado, empaque, cpe, usuario, monto_neto,"
                "  no_localidad, fecha_sysdate, aumento_cxc"
                ") VALUES("
                "  :1, :2, :3, :4, :5,"
                "  :6, :7, 'S', :8, 'I',"
                "  TO_DATE(:9,'YYYY-MM-DD'), :10, :11, :12,"
                "  'N', :13, :14, :15, :16,"
                "  :1, SYSDATE, 0)",
                client.nbinds(
                    no_cia, punto, tf, new_no_factura, lin["no_linea"],
                    lin["almacen"], lin["no_produ"], tipo_transaccion,
                    fecha, lin["cantidad"], lin["precio"], lin["costo"],
                    lin["empaque"], lin["cpe"], usuario[:30],
                    round(lin["cantidad"] * lin["costo"], 2)))
            try:
                cur.execute(
                    "UPDATE INV.TINV_EPRODUCTO "
                    "SET exist_actual = NVL(exist_actual, 0) - :1 "
                    "WHERE no_cia=:2 AND punto=:3 AND almacen=:4 AND no_produ=:5",
                    [lin["cantidad"], no_cia, punto, lin["almacen"], lin["no_produ"]])
            except Exception as exc:
                # Otra venta pudo consumir la existencia entre la validacion
                # y este UPDATE; el CHECK exist_actual >= 0 lo detecta.
                if "ORA-02290" in str(exc):
                    raise ValueError(
                        "Existencia insuficiente del producto {} en almacen {} "
                        "(consumida por otra operacion)".format(
                            lin["no_produ"], lin["almacen"]))
                raise
            if cur.rowcount == 0:
                raise ValueError(
                    "Producto {} no esta asignado al almacen {}".format(
                        lin["no_produ"], lin["almacen"]))
        if fp:
            cur.execute(
                "INSERT INTO FAT.TFAT_FORMA_PAGO("
                "no_cia,punto,tipo_factura,no_factura,tipo_pago,monto,monto_us"
                ") VALUES(:1,:2,:3,:4,:5,:6,0)",
                [no_cia, punto, tf, new_no_factura, fp, total_neto])
        if afecta_cxc == 'S':
            # La factura a credito vive tambien como documento CXC (Forms
            # lo insertaba junto con la factura); sin esta fila no aparece
            # en el picker de recibos de ingreso ni en estados de cuenta.
            # Constraint legado: debito=credito=valor_original, y saldo
            # positivo si tipo_movi='D'.
            cur.execute(
                "SELECT tipo_movi, tipo_transaccion FROM CXC.TCXC_TDOCU "
                "WHERE no_cia=:1 AND tipo_docu=:2",
                [no_cia, tf])
            td_cxc = cur.fetchone()
            tipo_movi_cxc = ((td_cxc[0] if td_cxc else None) or 'D').strip().upper()
            tipo_trans_cxc = ((td_cxc[1] if td_cxc else None) or 'F').strip().upper()
            cur.execute(
                "SELECT NVL(vendedor,'00'), NVL(cobrador,'0050') "
                "FROM CXC.TCXC_CLIENTE WHERE no_cia=:1 AND no_cliente=:2",
                [no_cia, no_cliente])
            row_cli = cur.fetchone()
            vendedor_cxc = (vendedor or '').strip() or (row_cli[0] if row_cli else '00')
            cobrador_cxc = row_cli[1] if row_cli else '0050'
            saldo_cxc = total_neto if tipo_movi_cxc == 'D' else -total_neto
            cur.execute(
                "INSERT INTO CXC.TCXC_DOCUMENTO("
                "no_cia,punto,tipo_docu,no_docu,no_cliente,fecha,fecha_vence,"
                "vendedor,valor_original,debito,credito,descuento,saldo,estado,"
                "itbis,usuario,cuenta,st_generado_cnt,st_impresion,st_anulado,"
                "tipo_transaccion,tipo_movi,tasa_us,posiciones_fijas_ncf,ncf,"
                "cobrador,fecha_sysdate,itbis_retenido,valor_inicial,desde_auxiliar"
                ") VALUES("
                ":1,:2,:3,:4,:5,TO_DATE(:6,'YYYY-MM-DD'),TO_DATE(:6,'YYYY-MM-DD'),"
                ":7,:8,:8,:8,:9,:10,'C',"
                ":11,:12,'1103-01','N','N','N',"
                ":13,:14,57.5,:15,:16,"
                ":17,SYSDATE,0,0,'A')",
                client.nbinds(
                    no_cia, punto, tf, new_no_factura, no_cliente, fecha,
                    vendedor_cxc, total_neto, total_descuento, saldo_cxc,
                    total_impuesto, usuario[:30], tipo_trans_cxc, tipo_movi_cxc,
                    posiciones_fijas_ncf, ncf_val, cobrador_cxc))
        cur.execute(
            "UPDATE FAT.TFAT_SECUENCIA "
            "SET prox_documento=prox_documento+1, ult_docu_impreso=:1 "
            "WHERE no_cia=:2 AND punto=:3 AND tipo_docu=:4",
            [new_no_factura, no_cia, punto, tf])
        if ncf_val is not None and codigo_ncf_emitir:
            # Avanza prox_ncf al siguiente del NCF efectivamente emitido
            # (puede haber saltado por colisiones).
            cur.execute(
                "UPDATE CNT.TCNT_NCF SET prox_ncf=:1 "
                "WHERE no_localidad=:2 AND codigo_ncf=:3",
                [ncf_val + 1, no_cia, codigo_ncf_emitir])
        historial_repo.log_evento(
            cur, usuario=usuario, no_cia=no_cia, punto=punto, modulo="FAT",
            tipo_documento=tf, no_documento=new_no_factura, accion="CREAR",
        )
        cur.connection.commit()
    return {"no_factura": new_no_factura, "tipo_factura": tf, "ncf": ncf_val,
            "total_neto": total_neto, "total_linea": total_linea,
            "descuento": total_descuento, "impuesto": total_impuesto,
            "valor_recibido": valor_recibido, "valor_devuelto": valor_devuelto}


# -- Anular Factura -----------------------------------------------------------

def anular_factura(no_cia, punto, tipo_factura, no_factura, usuario, motivo="", liberar_ncf=False, tipo_anula_dgii=""):
    tf = tipo_factura.strip().upper()
    nf = no_factura.strip()
    with client.cursor() as cur:
        cur.execute(
            "SELECT CODIGO_NCF, NCF, NVL(ST_ANULADO,'N') FROM FAT.TFAT_FACTURA "
            "WHERE no_cia=:1 AND punto=:2 AND tipo_factura=:3 AND no_factura=:4",
            [no_cia, punto, tf, nf])
        row = cur.fetchone()
        if not row:
            raise ValueError("Factura {}/{} no encontrada".format(tf, nf))
        codigo_ncf_fact, ncf_num, st_anulado = row[0], row[1], row[2]
        if st_anulado == 'S':
            raise ValueError("Factura {}/{} ya esta anulada".format(tf, nf))
        # Si la factura es a credito existe como documento CXC: con cobros
        # aplicados (saldo < valor_original) no se puede anular, y al
        # anularse su documento CXC debe anularse tambien.
        cur.execute(
            "SELECT NVL(saldo,0), NVL(valor_original,0) FROM CXC.TCXC_DOCUMENTO "
            "WHERE no_cia=:1 AND punto=:2 AND tipo_docu=:3 AND no_docu=:4 "
            "  AND NVL(st_anulado,'N')='N'",
            [no_cia, punto, tf, nf])
        doc_cxc = cur.fetchone()
        if doc_cxc and float(doc_cxc[0]) != float(doc_cxc[1]):
            raise ValueError(
                "La factura {}/{} tiene cobros aplicados en CXC "
                "(saldo {:g} de {:g}); reverse los recibos antes de anular".format(
                    tf, nf, float(doc_cxc[0]), float(doc_cxc[1])))
        cur.execute(
            "SELECT no_linea, almacen, no_produ, cantidad, precio, costo, "
            "       empaque, cpe, tipo_transaccion "
            "FROM INV.TINV_MOVIMIENTO "
            "WHERE no_cia=:1 AND punto=:2 AND tipo_docu=:3 AND no_docu=:4 "
            "  AND NVL(st_anulado,'N')='N' "
            "ORDER BY no_linea",
            [no_cia, punto, tf, nf])
        movs_orig = cur.fetchall()
        cur.execute(
            "UPDATE FAT.TFAT_FACTURA SET st_anulado='S', tipo_anula_dgii=:1 "
            "WHERE no_cia=:2 AND punto=:3 AND tipo_factura=:4 AND no_factura=:5",
            [(tipo_anula_dgii or "")[:2], no_cia, punto, tf, nf])
        cur.execute(
            "UPDATE FAT.TFAT_FACTURAL SET st_anulado='S' "
            "WHERE no_cia=:1 AND punto=:2 AND tipo_factura=:3 AND no_factura=:4",
            [no_cia, punto, tf, nf])
        if doc_cxc:
            cur.execute(
                "UPDATE CXC.TCXC_DOCUMENTO SET st_anulado='S' "
                "WHERE no_cia=:1 AND punto=:2 AND tipo_docu=:3 AND no_docu=:4",
                [no_cia, punto, tf, nf])
        # Marca los movimientos originales como anulados (consistente con legacy)
        cur.execute(
            "UPDATE INV.TINV_MOVIMIENTO SET st_anulado='S' "
            "WHERE no_cia=:1 AND punto=:2 AND tipo_docu=:3 AND no_docu=:4",
            [no_cia, punto, tf, nf])
        # Crea movimientos AF (entrada) que compensan la salida original.
        # get_existencia_producto suma TODOS los movimientos (anulados o no),
        # por eso la devolucion al stock se hace mediante esta entrada inversa.
        if movs_orig:
            cur.execute(
                "SELECT prox_documento FROM FAT.TFAT_SECUENCIA "
                "WHERE no_cia=:1 AND punto=:2 AND tipo_docu='AF' FOR UPDATE",
                [no_cia, punto])
            seq_af = cur.fetchone()
            if not seq_af:
                cur.execute(
                    "INSERT INTO FAT.TFAT_SECUENCIA(no_cia,punto,tipo_docu,prox_documento) "
                    "VALUES(:1,:2,'AF',1)",
                    [no_cia, punto])
                prox_af = 1
            else:
                prox_af = int(seq_af[0] or 1)
            # Defensivo: INV.reversar_documento_inv tambien genera 'AF' pero
            # usando INV.TINV_SECUENCIA, un contador independiente sobre la
            # misma tabla INV.TINV_MOVIMIENTO (mismo patron que _next_inv_seq
            # en inv_repo.py). Si ese otro contador ya avanzo mas alla de
            # esta secuencia, saltamos al maximo real + 1 para no repetir un
            # no_docu ya usado (causaba ORA-00001 en PK_TINV_MOVIMIENTO).
            cur.execute(
                "SELECT NVL(MAX(TO_NUMBER(no_docu)), 0) FROM INV.TINV_MOVIMIENTO "
                "WHERE no_cia=:1 AND punto=:2 AND tipo_docu='AF' "
                "  AND REGEXP_LIKE(no_docu, '^[0-9]+$')",
                [no_cia, punto])
            real_max_af = int((cur.fetchone() or [0])[0] or 0)
            if real_max_af >= prox_af:
                prox_af = real_max_af + 1
            no_af = str(prox_af).zfill(7)
            next_af = prox_af + 1
            for m in movs_orig:
                no_linea, almacen_m, no_produ_m, cant_m, precio_m, costo_m, empaque_m, cpe_m, tr_m = m
                cur.execute(
                    "INSERT INTO INV.TINV_MOVIMIENTO("
                    "  no_cia, punto, tipo_docu, no_docu, no_linea,"
                    "  almacen, no_produ, tipo_movi, tipo_transaccion, servicio,"
                    "  fecha, cantidad, precio, costo,"
                    "  st_anulado, empaque, cpe, usuario, monto_neto,"
                    "  no_localidad, fecha_sysdate, aumento_cxc,"
                    "  tipo_refe, no_refe"
                    ") VALUES("
                    "  :1, :2, 'AF', :3, :4,"
                    "  :5, :6, 'E', :7, 'I',"
                    "  SYSDATE, :8, :9, :10,"
                    "  'N', :11, :12, :13, :14,"
                    "  :15, SYSDATE, 0,"
                    "  :16, :17)",
                    [no_cia, punto, no_af, no_linea,
                     almacen_m, no_produ_m, tr_m or 'A',
                     cant_m, precio_m or 0, costo_m or 0,
                     empaque_m, cpe_m, usuario[:30],
                     round((cant_m or 0) * (costo_m or 0), 2),
                     no_cia, tf, nf])
                cur.execute(
                    "UPDATE INV.TINV_EPRODUCTO "
                    "SET exist_actual = NVL(exist_actual, 0) + :1 "
                    "WHERE no_cia=:2 AND punto=:3 AND almacen=:4 AND no_produ=:5",
                    [cant_m or 0, no_cia, punto, almacen_m, no_produ_m])
                if cur.rowcount == 0:
                    raise ValueError(
                        "Producto {} no esta asignado al almacen {}".format(
                            no_produ_m, almacen_m))
            cur.execute(
                "UPDATE FAT.TFAT_SECUENCIA SET prox_documento=:1 "
                "WHERE no_cia=:2 AND punto=:3 AND tipo_docu='AF'",
                [next_af, no_cia, punto])
        if liberar_ncf and codigo_ncf_fact and ncf_num:
            # Solo decrementa prox_ncf si el NCF anulado es el último emitido,
            # para evitar reasignar un NCF ya usado por otra factura activa.
            cur.execute(
                "UPDATE CNT.TCNT_NCF SET PROX_NCF = PROX_NCF - 1 "
                "WHERE NO_LOCALIDAD=:1 AND CODIGO_NCF=:2 "
                "  AND PROX_NCF = :3 AND PROX_NCF > NCF_INICIAL",
                [no_cia, codigo_ncf_fact, int(ncf_num) + 1])
        historial_repo.log_evento(
            cur, usuario=usuario, no_cia=no_cia, punto=punto, modulo="FAT",
            tipo_documento=tf, no_documento=nf, accion="ANULAR", motivo=motivo,
        )
        cur.connection.commit()
    return {"no_factura": nf, "tipo_factura": tf, "anulado": True, "motivo": motivo, "libero_ncf": liberar_ncf}


def list_motivos_anulacion_dgii() -> list[dict]:
    """Catalogo DGII de motivos de anulacion (FAT.TFAT_TANULACION_DGII).
    No depende de no_cia -- es un catalogo fijo, igual que su uso en
    rep_ncf_nulos."""
    rows = client.fetch_dicts(
        "SELECT tipo, descripcion FROM FAT.TFAT_TANULACION_DGII ORDER BY tipo",
        [])
    return [{'tipo': (r['tipo'] or '').strip(),
             'descripcion': (r['descripcion'] or '').strip()} for r in rows]


def list_facturas_cajero(no_cia: str, punto: str, fecha: str) -> list[dict]:
    """Facturas del dia que aun no pertenecen a un cuadre de caja cerrado
    -- mismo criterio de 'dia en progreso' que usa el cuadre de caja
    (ausencia de fila en FAT.TFAT_CUADRE_CAJA para esa fecha).

    No se filtra por quien creo la factura: el facturador crea, el
    cajero solo cobra -- son roles distintos, asi que cualquier cajero
    con acceso a este punto ve y cobra todas las facturas pendientes de
    ese punto, sin importar cual facturador las hizo."""
    rows = client.fetch_dicts(
        "SELECT f.tipo_factura, f.no_factura, f.fecha, "
        "TO_CHAR(NVL(f.fecha_sysdate, f.fecha), 'YYYY-MM-DD HH24:MI:SS') AS fecha_hora, "
        "c.nombre AS nombre_cliente, f.total_neto, "
        "NVL(tp.descripcion, f.forma_pago_fat) AS forma_pago, "
        "NVL(f.valor_recibido,0) AS valor_recibido, "
        "NVL(f.valor_devuelto,0) AS valor_devuelto, "
        "f.st_anulado, f.posiciones_fijas_ncf, f.ncf "
        "FROM FAT.TFAT_FACTURA f "
        "LEFT JOIN CXC.TCXC_CLIENTE c "
        "  ON c.no_cia=f.no_cia AND c.punto=f.punto AND c.no_cliente=f.no_cliente "
        "LEFT JOIN FAT.TFAT_TIPO_PAGO tp "
        "  ON tp.no_cia=f.no_cia AND tp.tipo_pago=f.forma_pago_fat "
        "WHERE f.no_cia=:1 AND f.punto=:2 AND TRUNC(f.fecha)=TO_DATE(:3,'YYYY-MM-DD') "
        "AND NOT EXISTS ("
        "  SELECT 1 FROM FAT.TFAT_CUADRE_CAJA cc "
        "  WHERE cc.no_cia=f.no_cia AND cc.punto=f.punto AND TRUNC(cc.fecha)=TRUNC(f.fecha)"
        ") "
        "ORDER BY NVL(f.fecha_sysdate, f.fecha) DESC, f.no_factura DESC",
        [no_cia, punto, fecha])
    return [{
        'tipo_factura': r['tipo_factura'] or '', 'no_factura': r['no_factura'] or '',
        'fecha': str(r['fecha'])[:10] if r['fecha'] else None,
        'fecha_hora': r['fecha_hora'] or '',
        'nombre_cliente': (r['nombre_cliente'] or '').strip(),
        'total_neto': float(r['total_neto'] or 0),
        'forma_pago': (r['forma_pago'] or '').strip(),
        'valor_recibido': float(r['valor_recibido'] or 0),
        'valor_devuelto': float(r['valor_devuelto'] or 0),
        'st_anulado': r['st_anulado'] or 'N',
        'ncf_dgi': _compose_ncf_dgi(r['posiciones_fijas_ncf'], r['ncf']),
    } for r in rows]


def registrar_cobro_efectivo(no_cia: str, punto: str, tipo_factura: str,
                              no_factura: str, valor_recibido: float) -> dict:
    """Registra (o corrige) cuanto recibio el cajero en efectivo por una
    factura pendiente, calculando el vuelto. Usado desde la Vista de
    Cajero para facturas que no capturaron esto al crearse."""
    tf = tipo_factura.strip().upper()
    nf = no_factura.strip()
    row = client.fetch_one(
        "SELECT total_neto, NVL(st_anulado,'N') FROM FAT.TFAT_FACTURA "
        "WHERE no_cia=:1 AND punto=:2 AND tipo_factura=:3 AND no_factura=:4",
        [no_cia, punto, tf, nf])
    if not row:
        raise ValueError("Factura {}/{} no encontrada".format(tf, nf))
    total_neto = float(row[0] or 0)
    if row[1] == 'S':
        raise ValueError("Factura {}/{} esta anulada".format(tf, nf))
    valor_devuelto = round(max(0.0, valor_recibido - total_neto), 2)
    with client.cursor() as cur:
        cur.execute(
            "UPDATE FAT.TFAT_FACTURA SET valor_recibido=:1, valor_devuelto=:2 "
            "WHERE no_cia=:3 AND punto=:4 AND tipo_factura=:5 AND no_factura=:6",
            [valor_recibido, valor_devuelto, no_cia, punto, tf, nf])
        cur.connection.commit()
    return {"tipo_factura": tf, "no_factura": nf, "total_neto": total_neto,
            "valor_recibido": valor_recibido, "valor_devuelto": valor_devuelto}


# -- Crear Conduce / Cotizacion -----------------------------------------------

def create_conduce(no_cia, punto, tipo_conduce, no_cliente, fecha, vendedor,
                   clase, no_lista, lineas, usuario, detalle=None):
    tc = tipo_conduce.strip().upper()
    cl = clase.strip().upper() if clase else "C"
    detalle_s = str(detalle or '').strip()
    # En el sistema legado conduces y cotizaciones NO mueven inventario;
    # el movimiento se aplica al facturar (FT/FC).
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
            no_produ_norm = lin.get("no_produ", "").strip().upper()
            almacen_norm = lin.get("almacen", "").strip()
            cur.execute(
                "SELECT NVL(ep.costo_actual,0) FROM INV.TINV_EPRODUCTO ep "
                "WHERE ep.no_cia=:1 AND ep.punto=:2 AND ep.almacen=:3 AND ep.no_produ=:4",
                [no_cia, punto, almacen_norm, no_produ_norm])
            row_ep = cur.fetchone()
            costo_unit = float(row_ep[0] or 0) if row_ep else 0.0
            cur.execute(
                "SELECT empaque, NVL(cpe,1) FROM INV.TINV_EMPAQUE "
                "WHERE no_produ=:1 "
                "ORDER BY CASE WHEN NVL(por_defecto,'N')='S' THEN 0 ELSE 1 END, empaque",
                [no_produ_norm])
            row_emp = cur.fetchone()
            empaque_unit = int(row_emp[0] or 1) if row_emp else 1
            cpe_unit = float(row_emp[1] or 1) if row_emp else 1.0
            lineas_calc.append({"no_linea": idx,
                "no_produ": no_produ_norm,
                "almacen": almacen_norm,
                "descripcion": lin.get("descripcion", "").strip(),
                "cantidad": cant, "precio": precio, "porc_descuento": porc_desc,
                "descuento": desc_monto, "porciento_impuesto": porc_imp,
                "impuesto": imp_monto, "monto_neto": neto,
                "costo": costo_unit, "empaque": empaque_unit, "cpe": cpe_unit})
        total_neto = total_linea - total_descuento + total_impuesto
        cur.execute(
            "INSERT INTO FAT.TFAT_CONDUCE("
            "no_cia,punto,tipo_conduce,no_conduce,no_cliente,"
            "fecha,vendedor,clase,"
            "total_linea,descuento,impuesto,total_neto,"
            "st_anulado,st_impresion,tipo_factura,no_factura,"
            "no_condicion_pago,tipo_moneda,tasa_us,creado_por,"
            "forma_pago,autorizado,procesado,txt_generado,detalle"
            ") VALUES("
            ":1,:2,:3,:4,:5,TO_DATE(:6,'YYYY-MM-DD'),:7,:8,"
            ":9,:10,:11,:12,"
            "'N','N','','',"
            "'',:13,57.5,:14,"
            "'1','N','N','N',:15"
            ")",
            [no_cia, punto, tc, no_conduce, no_cliente,
             fecha, vendedor, cl,
             total_linea, total_descuento, total_impuesto, total_neto,
             "RD", usuario, detalle_s])
        for lin in lineas_calc:
            cur.execute(
                "INSERT INTO FAT.TFAT_CONDUCEL("
                "no_cia,punto,tipo_conduce,no_conduce,no_linea,"
                "almacen,no_produ,cantidad,precio,empaque,cpe,"
                "porc_descuento,descuento,itbis,descripcion,st_anulado,"
                "produ_oferta,produ_ofertado,cantidad_regalo,"
                "cantidad_facturada,valor_facturado,tipo_oferta"
                ") VALUES("
                ":1,:2,:3,:4,:5,:6,:7,:8,:9,:10,:11,:12,:13,:14,:15,'N',"
                "'N','N',0,0,0,'N'"
                ")",
                [no_cia, punto, tc, no_conduce, lin["no_linea"],
                 lin["almacen"], lin["no_produ"], lin["cantidad"], lin["precio"],
                 lin["empaque"], lin["cpe"],
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


# -- Actualizar Conduce / Cotizacion (Gap G2 2026-05-30) ----------------------

def update_conduce(no_cia, punto, tipo_conduce, no_conduce, no_cliente, fecha,
                   vendedor, clase, lineas, usuario, detalle=None,
                   forma_pago=None, no_condicion_pago=None, tipo_moneda=None,
                   nuevo_tipo_conduce=None):
    """Actualiza un conduce existente (encabezado + líneas) en una transacción.

    Regla de editabilidad (Gap G2): el conduce NO debe estar autorizado
    (AUTORIZADO='S'), ni anulado (ST_ANULADO='S'), ni ya facturado
    (NO_FACTURA con valor). Si alguna condición se cumple, se lanza
    ValueError para que la view responda 422.

    Estructura:
      1. SELECT FOR UPDATE del encabezado, validar reglas.
      2. UPDATE FAT.TFAT_CONDUCE con totales recalculados.
      3. DELETE FAT.TFAT_CONDUCEL del conduce.
      4. INSERT línea por línea desde el parámetro `lineas` (lista de dicts
         con la misma estructura que create_conduce: no_produ, almacen,
         cantidad, precio, porc_descuento, porciento_impuesto, descripcion).
      5. Commit explícito; en error rollback y reraise.
    """
    tc = tipo_conduce.strip().upper()
    nc = no_conduce.strip()
    cl = clase.strip().upper() if clase else "C"
    new_tc = (nuevo_tipo_conduce or tc).strip().upper()
    convertir = bool(new_tc) and new_tc != tc
    if not lineas:
        raise ValueError("Se requiere al menos una linea")
    with client.cursor() as cur:
        try:
            cur.execute(
                "SELECT NVL(AUTORIZADO,'N'), NVL(ST_ANULADO,'N'), NO_FACTURA "
                "FROM FAT.TFAT_CONDUCE "
                "WHERE no_cia=:1 AND punto=:2 AND tipo_conduce=:3 AND no_conduce=:4 "
                "FOR UPDATE",
                [no_cia, punto, tc, nc])
            row = cur.fetchone()
            if not row:
                raise ValueError("Conduce no encontrado")
            autorizado, st_anulado, no_factura = row[0], row[1], (row[2] or '').strip()
            if autorizado == 'S':
                raise ValueError("Conduce no editable: ya esta autorizado")
            if st_anulado == 'S':
                raise ValueError("Conduce no editable: esta anulado")
            if no_factura:
                raise ValueError(
                    "Conduce no editable: ya esta facturado (factura {})".format(no_factura))

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
                lineas_calc.append({
                    "no_linea": idx,
                    "no_produ": (lin.get("no_produ", "") or "").strip().upper(),
                    "almacen": (lin.get("almacen", "") or "").strip(),
                    "descripcion": (lin.get("descripcion", "") or "").strip(),
                    "cantidad": cant, "precio": precio,
                    "porc_descuento": porc_desc,
                    "descuento": desc_monto,
                    "porciento_impuesto": porc_imp,
                    "impuesto": imp_monto, "monto_neto": neto,
                })
            total_neto = total_linea - total_descuento + total_impuesto

            # ¿Conversión de tipo (Conduce CO <-> Cotización CT)? El tipo es parte
            # del PK y hay FK TFAT_CONDUCEL->TFAT_CONDUCE (no diferible). Se resuelve:
            # (1) número nuevo de la secuencia del tipo destino, (2) copiar el
            # encabezado bajo el tipo destino, (3) borrar líneas viejas, (4) borrar
            # encabezado viejo, (5) avanzar secuencia. Luego el UPDATE de campos
            # editados y el reemplazo de líneas se hacen sobre las claves destino.
            target_tc, target_nc = tc, nc
            if convertir:
                cur.execute(
                    "SELECT prox_documento FROM FAT.TFAT_SECUENCIA "
                    "WHERE no_cia=:1 AND punto=:2 AND tipo_docu=:3 FOR UPDATE",
                    [no_cia, punto, new_tc])
                seq_row = cur.fetchone()
                if not seq_row:
                    raise ValueError(
                        "No hay secuencia configurada para {} en {}/{}".format(new_tc, no_cia, punto))
                target_tc = new_tc
                target_nc = str(seq_row[0]).strip() if seq_row[0] else "1"
                cur.execute(
                    "SELECT column_name FROM all_tab_columns "
                    "WHERE owner='FAT' AND table_name='TFAT_CONDUCE' ORDER BY column_id")
                cols = [r[0] for r in cur.fetchall()]
                collist = ",".join(cols)
                sel = ",".join(
                    ("'{}'".format(target_tc) if c == 'TIPO_CONDUCE' else
                     ("'{}'".format(target_nc) if c == 'NO_CONDUCE' else c))
                    for c in cols)
                cur.execute(
                    "INSERT INTO FAT.TFAT_CONDUCE ({}) SELECT {} FROM FAT.TFAT_CONDUCE "
                    "WHERE no_cia=:1 AND punto=:2 AND tipo_conduce=:3 AND no_conduce=:4".format(collist, sel),
                    [no_cia, punto, tc, nc])
                cur.execute(
                    "DELETE FROM FAT.TFAT_CONDUCEL "
                    "WHERE no_cia=:1 AND punto=:2 AND tipo_conduce=:3 AND no_conduce=:4",
                    [no_cia, punto, tc, nc])
                cur.execute(
                    "DELETE FROM FAT.TFAT_CONDUCE "
                    "WHERE no_cia=:1 AND punto=:2 AND tipo_conduce=:3 AND no_conduce=:4",
                    [no_cia, punto, tc, nc])
                cur.execute(
                    "UPDATE FAT.TFAT_SECUENCIA SET prox_documento=prox_documento+1, ult_docu_impreso=:1 "
                    "WHERE no_cia=:2 AND punto=:3 AND tipo_docu=:4",
                    [target_nc, no_cia, punto, target_tc])

            # Construir UPDATE dinámicamente con campos opcionales (sobre claves destino)
            set_clauses = [
                "no_cliente=:1", "fecha=TO_DATE(:2,'YYYY-MM-DD')",
                "vendedor=:3", "clase=:4",
                "total_linea=:5", "descuento=:6", "impuesto=:7", "total_neto=:8",
                "usuario_1=:9",
            ]
            params = [no_cliente, fecha, (vendedor or '').strip(), cl,
                      total_linea, total_descuento, total_impuesto, total_neto,
                      usuario]
            next_bind = 10
            if detalle is not None:
                set_clauses.append("detalle=:{}".format(next_bind))
                params.append((detalle or '').strip()); next_bind += 1
            if forma_pago is not None:
                set_clauses.append("forma_pago=:{}".format(next_bind))
                params.append((forma_pago or '').strip()); next_bind += 1
            if no_condicion_pago is not None:
                set_clauses.append("no_condicion_pago=:{}".format(next_bind))
                params.append((no_condicion_pago or '').strip()); next_bind += 1
            if tipo_moneda is not None:
                set_clauses.append("tipo_moneda=:{}".format(next_bind))
                params.append((tipo_moneda or 'RD').strip()); next_bind += 1
            params.extend([no_cia, punto, target_tc, target_nc])
            where_start = next_bind
            sql_update = (
                "UPDATE FAT.TFAT_CONDUCE SET " + ", ".join(set_clauses) +
                " WHERE no_cia=:{} AND punto=:{} AND tipo_conduce=:{} AND no_conduce=:{}".format(
                    where_start, where_start + 1, where_start + 2, where_start + 3))
            cur.execute(sql_update, params)

            cur.execute(
                "DELETE FROM FAT.TFAT_CONDUCEL "
                "WHERE no_cia=:1 AND punto=:2 AND tipo_conduce=:3 AND no_conduce=:4",
                [no_cia, punto, target_tc, target_nc])

            for lin in lineas_calc:
                # TFAT_CONDUCEL tiene varias columnas NOT NULL sin default:
                # EMPAQUE, CPE, PRODU_OFERTA, PRODU_OFERTADO, CANTIDAD_FACTURADA.
                # Se usan valores neutros tomados de la data legacy.
                # CANTIDAD_FACTURADA=0 al editar: el conduce no puede estar
                # facturado (regla NO_FACTURA IS NULL), así que no hay nada
                # facturado todavía. Reportes que calculan pendientes
                # (cantidad - cantidad_facturada) deben dar cantidad completa.
                cur.execute(
                    "INSERT INTO FAT.TFAT_CONDUCEL("
                    "no_cia,punto,tipo_conduce,no_conduce,no_linea,"
                    "almacen,no_produ,cantidad,precio,"
                    "porc_descuento,descuento,itbis,descripcion,st_anulado,"
                    "empaque,cpe,produ_oferta,produ_ofertado,"
                    "cantidad_facturada,valor_facturado,cantidad_regalo,tipo_oferta"
                    ") VALUES("
                    ":1,:2,:3,:4,:5,:6,:7,:8,:9,:10,:11,:12,:13,'N',"
                    "1,1,'N','N',"
                    "0,0,0,'N'"
                    ")",
                    [no_cia, punto, target_tc, target_nc, lin["no_linea"],
                     lin["almacen"], lin["no_produ"], lin["cantidad"], lin["precio"],
                     lin["porc_descuento"], lin["descuento"],
                     lin["impuesto"], lin["descripcion"]])
            cur.connection.commit()
        except Exception:
            try:
                cur.connection.rollback()
            except Exception:
                pass
            raise
    return {"no_conduce": target_nc, "tipo_conduce": target_tc, "clase": cl,
            "convertido": convertir,
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


def get_proximo_no_factura(no_cia: str, punto: str, tipo_docu: str) -> int:
    """Devuelve el próximo no_factura para la serie tipo_docu en la empresa/punto.

    Usa FAT.TFAT_SECUENCIA.prox_documento (o prox_formulario como fallback),
    que es el mismo contador que usa create_factura. Sin FOR UPDATE — solo lectura.
    """
    if not no_cia or not punto or not tipo_docu:
        return 0
    row = client.fetch_one(
        "SELECT prox_documento, prox_formulario FROM FAT.TFAT_SECUENCIA "
        "WHERE no_cia=:1 AND punto=:2 AND tipo_docu=:3",
        [no_cia, punto, tipo_docu.strip().upper()])
    if not row:
        return 0
    val = row[0] if row[0] is not None else row[1]
    return int(val or 0)
