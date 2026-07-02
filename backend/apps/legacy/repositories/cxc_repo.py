"""CXC (Cuentas por Cobrar) - Oracle repository. Schema verified against live DB."""
from __future__ import annotations
from .. import client
from datetime import date


# --- COMPANIAS ---------------------------------------------------------------
# TCXC_CIAS: NO_CIA, DESCRIPCION, ACTIVA

def list_cias():
    return client.fetch_dicts(
        "SELECT no_cia, descripcion, NVL(activa,'S') activa FROM CXC.TCXC_CIAS ORDER BY no_cia")

def save_cia(d: dict):
    exists = client.fetch_one("SELECT 1 FROM CXC.TCXC_CIAS WHERE no_cia=:1", [d['no_cia']])
    with client.cursor() as cur:
        if exists:
            cur.execute("UPDATE CXC.TCXC_CIAS SET descripcion=:1, activa=:2 WHERE no_cia=:3",
                        [d.get('descripcion', ''), d.get('activa', 'S'), d['no_cia']])
        else:
            cur.execute("INSERT INTO CXC.TCXC_CIAS(no_cia,descripcion,activa) VALUES(:1,:2,:3)",
                        [d['no_cia'], d.get('descripcion', ''), d.get('activa', 'S')])
        cur.connection.commit()


# --- PUNTOS DE TRABAJO -------------------------------------------------------
# TCXC_PUNTO: NO_CIA, PUNTO, DESCRIPCION, ANO_PROCESO, MES_PROCESO, PROX_CLIENTE

def list_puntos(no_cia: str):
    return client.fetch_dicts(
        "SELECT no_cia, punto, descripcion, NVL(activo,'S') activo, "
        "NVL(mes_proceso,1) mes_proceso, NVL(ano_proceso,2025) ano_proceso "
        "FROM CXC.TCXC_PUNTO WHERE no_cia=:1 ORDER BY punto",
        [no_cia])

def save_punto(d: dict):
    exists = client.fetch_one(
        "SELECT 1 FROM CXC.TCXC_PUNTO WHERE no_cia=:1 AND punto=:2",
        [d['no_cia'], d['punto']])
    with client.cursor() as cur:
        if exists:
            cur.execute(
                "UPDATE CXC.TCXC_PUNTO SET descripcion=:1 WHERE no_cia=:2 AND punto=:3",
                [d.get('descripcion', ''), d['no_cia'], d['punto']])
        else:
            cur.execute(
                "INSERT INTO CXC.TCXC_PUNTO(no_cia,punto,descripcion,mes_proceso,ano_proceso) "
                "VALUES(:1,:2,:3,:4,:5)",
                [d['no_cia'], d['punto'], d.get('descripcion', ''),
                 d.get('mes_proceso', 1), d.get('ano_proceso', 2025)])
        cur.connection.commit()

def get_punto(no_cia: str, punto: str):
    rows = client.fetch_dicts(
        "SELECT * FROM CXC.TCXC_PUNTO WHERE no_cia=:1 AND punto=:2", [no_cia, punto])
    return rows[0] if rows else None


# --- TIPOS DE DOCUMENTO ------------------------------------------------------
# TCXC_TDOCU: NO_CIA, TIPO_DOCU, TIPO_MOVI, DESCRIPCION, TIPO_TRANSACCION, CODIGO_NCF

def list_tdocu(no_cia: str):
    # Incluye cuenta y centro_costo defaults (FCXC104) para autocompletar en
    # la entrada FCXC201 — el usuario NO selecciona cuenta, viene del tipo doc.
    return client.fetch_dicts(
        "SELECT no_cia, tipo_docu tipo_doc, descripcion, tipo_transaccion, "
        "tipo_movi tipo_movimiento, codigo_ncf, "
        "NVL(cuenta,'') AS cuenta, "
        "NVL(centro_costo,'0000000000') AS centro_costo, "
        "NVL(controlar_entrega,'N') AS controlar_entrega, "
        "NVL(registrar_banco,'N') AS registrar_banco, "
        "'S' activo "
        "FROM CXC.TCXC_TDOCU WHERE no_cia=:1 ORDER BY tipo_docu",
        [no_cia])

def save_tdocu(d: dict):
    exists = client.fetch_one(
        "SELECT 1 FROM CXC.TCXC_TDOCU WHERE no_cia=:1 AND tipo_docu=:2",
        [d['no_cia'], d['tipo_docu']])
    with client.cursor() as cur:
        if exists:
            cur.execute(
                "UPDATE CXC.TCXC_TDOCU SET descripcion=:1, tipo_transaccion=:2, tipo_movi=:3 "
                "WHERE no_cia=:4 AND tipo_docu=:5",
                [d.get('descripcion', ''), d.get('tipo_transaccion', 'D'),
                 d.get('tipo_movi', 'D'), d['no_cia'], d['tipo_docu']])
        else:
            cur.execute(
                "INSERT INTO CXC.TCXC_TDOCU(no_cia,tipo_docu,descripcion,tipo_transaccion,tipo_movi) "
                "VALUES(:1,:2,:3,:4,:5)",
                [d['no_cia'], d['tipo_docu'], d.get('descripcion', ''),
                 d.get('tipo_transaccion', 'D'), d.get('tipo_movi', 'D')])
        cur.connection.commit()

def delete_tdocu(no_cia: str, tipo_docu: str):
    with client.cursor() as cur:
        cur.execute("DELETE FROM CXC.TCXC_TDOCU WHERE no_cia=:1 AND tipo_docu=:2",
                    [no_cia, tipo_docu])
        cur.connection.commit()


# --- TIPOS DE CLIENTES -------------------------------------------------------
# TCXC_TCLI: NO_CIA, TIPO_CLIENTE, DESCRIPCION

def list_tcli(no_cia: str):
    return client.fetch_dicts(
        "SELECT no_cia, tipo_cliente, descripcion FROM CXC.TCXC_TCLI "
        "WHERE no_cia=:1 ORDER BY tipo_cliente",
        [no_cia])

def save_tcli(d: dict):
    exists = client.fetch_one(
        "SELECT 1 FROM CXC.TCXC_TCLI WHERE no_cia=:1 AND tipo_cliente=:2",
        [d['no_cia'], d['tipo_cliente']])
    with client.cursor() as cur:
        if exists:
            cur.execute(
                "UPDATE CXC.TCXC_TCLI SET descripcion=:1 "
                "WHERE no_cia=:2 AND tipo_cliente=:3",
                [d.get('descripcion', ''), d['no_cia'], d['tipo_cliente']])
        else:
            cur.execute(
                "INSERT INTO CXC.TCXC_TCLI(no_cia,tipo_cliente,descripcion) VALUES(:1,:2,:3)",
                [d['no_cia'], d['tipo_cliente'], d.get('descripcion', '')])
        cur.connection.commit()

def delete_tcli(no_cia: str, tipo_cliente: str):
    with client.cursor() as cur:
        cur.execute("DELETE FROM CXC.TCXC_TCLI WHERE no_cia=:1 AND tipo_cliente=:2",
                    [no_cia, tipo_cliente])
        cur.connection.commit()


# --- SUPERVISORES ------------------------------------------------------------
# TCXC_SUPERVISOR: NO_CIA, SUPERVISOR, NOMBRE, COMISION, ACTIVO, CUOTA

def list_supervisores(no_cia: str):
    return client.fetch_dicts(
        "SELECT no_cia, supervisor, nombre, NVL(comision,0) comision, "
        "NVL(activo,'S') activo, NVL(cuota,0) cuota "
        "FROM CXC.TCXC_SUPERVISOR WHERE no_cia=:1 ORDER BY supervisor",
        [no_cia])

def save_supervisor(d: dict):
    exists = client.fetch_one(
        "SELECT 1 FROM CXC.TCXC_SUPERVISOR WHERE no_cia=:1 AND supervisor=:2",
        [d['no_cia'], d['supervisor']])
    with client.cursor() as cur:
        if exists:
            cur.execute(
                "UPDATE CXC.TCXC_SUPERVISOR SET nombre=:1, activo=:2 "
                "WHERE no_cia=:3 AND supervisor=:4",
                [d.get('nombre', ''), d.get('activo', 'S'), d['no_cia'], d['supervisor']])
        else:
            cur.execute(
                "INSERT INTO CXC.TCXC_SUPERVISOR(no_cia,supervisor,nombre,activo) "
                "VALUES(:1,:2,:3,:4)",
                [d['no_cia'], d['supervisor'], d.get('nombre', ''), d.get('activo', 'S')])
        cur.connection.commit()

def delete_supervisor(no_cia: str, supervisor: str):
    with client.cursor() as cur:
        cur.execute("DELETE FROM CXC.TCXC_SUPERVISOR WHERE no_cia=:1 AND supervisor=:2",
                    [no_cia, supervisor])
        cur.connection.commit()


# --- VENDEDORES --------------------------------------------------------------
# TCXC_VENDEDOR: NO_CIA, VENDEDOR, NOMBRE, COMISION, SUPERVISOR, PUNTO,
#                ACTIVO, CUOTA, TIPO_VENDEDOR, CLASE, EMAIL, FLOTA

def list_vendedores(no_cia: str):
    return client.fetch_dicts(
        "SELECT no_cia, vendedor, nombre, supervisor, email, "
        "NVL(activo,'S') activo, tipo_vendedor, clase, "
        "NVL(cuota,0) cuota, flota "
        "FROM CXC.TCXC_VENDEDOR WHERE no_cia=:1 ORDER BY vendedor",
        [no_cia])

def get_vendedor(no_cia: str, vendedor: str):
    rows = client.fetch_dicts(
        "SELECT * FROM CXC.TCXC_VENDEDOR WHERE no_cia=:1 AND vendedor=:2",
        [no_cia, vendedor])
    return rows[0] if rows else None

def save_vendedor(d: dict):
    exists = client.fetch_one(
        "SELECT 1 FROM CXC.TCXC_VENDEDOR WHERE no_cia=:1 AND vendedor=:2",
        [d['no_cia'], d['vendedor']])
    with client.cursor() as cur:
        if exists:
            cur.execute(
                "UPDATE CXC.TCXC_VENDEDOR SET nombre=:1, email=:2, supervisor=:3, activo=:4, "
                "tipo_vendedor=:5, clase=:6, cuota=:7, flota=:8 "
                "WHERE no_cia=:9 AND vendedor=:10",
                [d.get('nombre', ''), d.get('email', ''), d.get('supervisor', ''),
                 d.get('activo', 'S'), d.get('tipo_vendedor', 'P'), d.get('clase', ''),
                 d.get('cuota', 0), d.get('flota', ''),
                 d['no_cia'], d['vendedor']])
        else:
            cur.execute(
                "INSERT INTO CXC.TCXC_VENDEDOR(no_cia,vendedor,nombre,email,supervisor,activo,"
                "tipo_vendedor,clase,cuota,flota) VALUES(:1,:2,:3,:4,:5,:6,:7,:8,:9,:10)",
                [d['no_cia'], d['vendedor'], d.get('nombre', ''), d.get('email', ''),
                 d.get('supervisor', ''), d.get('activo', 'S'), d.get('tipo_vendedor', 'P'),
                 d.get('clase', ''), d.get('cuota', 0), d.get('flota', '')])
        cur.connection.commit()

def delete_vendedor(no_cia: str, vendedor: str):
    with client.cursor() as cur:
        cur.execute(
            "UPDATE CXC.TCXC_VENDEDOR SET activo='N' WHERE no_cia=:1 AND vendedor=:2",
            [no_cia, vendedor])
        cur.connection.commit()


# --- RUTAS -------------------------------------------------------------------
# TCXC_RUTA: NO_CIA, RUTA, DESCRIPCION, PUNTO, VENDEDOR (no ACTIVO column)

def list_rutas(no_cia: str):
    return client.fetch_dicts(
        "SELECT no_cia, ruta, descripcion, punto, vendedor "
        "FROM CXC.TCXC_RUTA WHERE no_cia=:1 ORDER BY ruta",
        [no_cia])

def save_ruta(d: dict):
    exists = client.fetch_one(
        "SELECT 1 FROM CXC.TCXC_RUTA WHERE no_cia=:1 AND ruta=:2",
        [d['no_cia'], d['ruta']])
    with client.cursor() as cur:
        if exists:
            cur.execute(
                "UPDATE CXC.TCXC_RUTA SET descripcion=:1, punto=:2, vendedor=:3 "
                "WHERE no_cia=:4 AND ruta=:5",
                [d.get('descripcion', ''), d.get('punto', ''), d.get('vendedor', ''),
                 d['no_cia'], d['ruta']])
        else:
            cur.execute(
                "INSERT INTO CXC.TCXC_RUTA(no_cia,ruta,descripcion,punto,vendedor) "
                "VALUES(:1,:2,:3,:4,:5)",
                [d['no_cia'], d['ruta'], d.get('descripcion', ''),
                 d.get('punto', ''), d.get('vendedor', '')])
        cur.connection.commit()

def delete_ruta(no_cia: str, ruta: str):
    with client.cursor() as cur:
        cur.execute("DELETE FROM CXC.TCXC_RUTA WHERE no_cia=:1 AND ruta=:2", [no_cia, ruta])
        cur.connection.commit()


# --- TIPO CONTABLE -----------------------------------------------------------
# TCXC_TCONTABLE: NO_CIA, TIPO_CONTABLE, DESCRIPCION, CUENTA_CLIENTE, CUENTA_CH_DEV

def list_tcontable(no_cia: str):
    return client.fetch_dicts(
        "SELECT no_cia, tipo_contable, descripcion "
        "FROM CXC.TCXC_TCONTABLE WHERE no_cia=:1 ORDER BY tipo_contable",
        [no_cia])

def save_tcontable(d: dict):
    exists = client.fetch_one(
        "SELECT 1 FROM CXC.TCXC_TCONTABLE WHERE no_cia=:1 AND tipo_contable=:2",
        [d['no_cia'], d['tipo_contable']])
    with client.cursor() as cur:
        if exists:
            cur.execute(
                "UPDATE CXC.TCXC_TCONTABLE SET descripcion=:1 "
                "WHERE no_cia=:2 AND tipo_contable=:3",
                [d.get('descripcion', ''), d['no_cia'], d['tipo_contable']])
        else:
            cur.execute(
                "INSERT INTO CXC.TCXC_TCONTABLE(no_cia,tipo_contable,descripcion) VALUES(:1,:2,:3)",
                [d['no_cia'], d['tipo_contable'], d.get('descripcion', '')])
        cur.connection.commit()

def delete_tcontable(no_cia: str, tipo_contable: str):
    with client.cursor() as cur:
        cur.execute(
            "DELETE FROM CXC.TCXC_TCONTABLE WHERE no_cia=:1 AND tipo_contable=:2",
            [no_cia, tipo_contable])
        cur.connection.commit()


# --- CIUDADES ----------------------------------------------------------------
# TCXC_CIUDAD: CIUDAD, DESCRIPCION  (no NO_CIA)

def list_ciudades(no_cia: str = ''):
    return client.fetch_dicts(
        "SELECT ciudad, descripcion FROM CXC.TCXC_CIUDAD ORDER BY ciudad")

def save_ciudad(d: dict):
    exists = client.fetch_one(
        "SELECT 1 FROM CXC.TCXC_CIUDAD WHERE ciudad=:1", [d['ciudad']])
    with client.cursor() as cur:
        if exists:
            cur.execute("UPDATE CXC.TCXC_CIUDAD SET descripcion=:1 WHERE ciudad=:2",
                        [d.get('descripcion', ''), d['ciudad']])
        else:
            cur.execute("INSERT INTO CXC.TCXC_CIUDAD(ciudad,descripcion) VALUES(:1,:2)",
                        [d['ciudad'], d.get('descripcion', '')])
        cur.connection.commit()

def delete_ciudad(no_cia: str, ciudad: str):
    with client.cursor() as cur:
        cur.execute("DELETE FROM CXC.TCXC_CIUDAD WHERE ciudad=:1", [ciudad])
        cur.connection.commit()


# --- BARRIOS -----------------------------------------------------------------
# TCXC_BARRIO: CIUDAD, BARRIO, DESCRIPCION  (no NO_CIA)

def list_barrios(no_cia: str = ''):
    return client.fetch_dicts(
        "SELECT ciudad, barrio, descripcion FROM CXC.TCXC_BARRIO ORDER BY ciudad, barrio")

def save_barrio(d: dict):
    exists = client.fetch_one(
        "SELECT 1 FROM CXC.TCXC_BARRIO WHERE ciudad=:1 AND barrio=:2",
        [d['ciudad'], d['barrio']])
    with client.cursor() as cur:
        if exists:
            cur.execute(
                "UPDATE CXC.TCXC_BARRIO SET descripcion=:1 WHERE ciudad=:2 AND barrio=:3",
                [d.get('descripcion', ''), d['ciudad'], d['barrio']])
        else:
            cur.execute(
                "INSERT INTO CXC.TCXC_BARRIO(ciudad,barrio,descripcion) VALUES(:1,:2,:3)",
                [d['ciudad'], d['barrio'], d.get('descripcion', '')])
        cur.connection.commit()

def delete_barrio(no_cia: str, barrio: str):
    with client.cursor() as cur:
        # barrio arg may be "CIUDAD|BARRIO"
        parts = barrio.split('|')
        if len(parts) == 2:
            cur.execute("DELETE FROM CXC.TCXC_BARRIO WHERE ciudad=:1 AND barrio=:2", parts)
        else:
            cur.execute("DELETE FROM CXC.TCXC_BARRIO WHERE barrio=:1", [barrio])
        cur.connection.commit()


# --- ZONAS -------------------------------------------------------------------
# TCXC_ZONA: NO_CIA, ZONA, DESCRIPCION

def list_zonas(no_cia: str):
    return client.fetch_dicts(
        "SELECT no_cia, zona, descripcion FROM CXC.TCXC_ZONA "
        "WHERE no_cia=:1 ORDER BY zona",
        [no_cia])

def save_zona(d: dict):
    exists = client.fetch_one(
        "SELECT 1 FROM CXC.TCXC_ZONA WHERE no_cia=:1 AND zona=:2",
        [d['no_cia'], d['zona']])
    with client.cursor() as cur:
        if exists:
            cur.execute(
                "UPDATE CXC.TCXC_ZONA SET descripcion=:1 WHERE no_cia=:2 AND zona=:3",
                [d.get('descripcion', ''), d['no_cia'], d['zona']])
        else:
            cur.execute(
                "INSERT INTO CXC.TCXC_ZONA(no_cia,zona,descripcion) VALUES(:1,:2,:3)",
                [d['no_cia'], d['zona'], d.get('descripcion', '')])
        cur.connection.commit()

def delete_zona(no_cia: str, zona: str):
    with client.cursor() as cur:
        cur.execute("DELETE FROM CXC.TCXC_ZONA WHERE no_cia=:1 AND zona=:2", [no_cia, zona])
        cur.connection.commit()


# --- CADENAS -----------------------------------------------------------------
# TCXC_CADENA: NO_CIA, NO_CADENA, DESCRIPCION

def list_cadenas(no_cia: str):
    return client.fetch_dicts(
        "SELECT no_cia, no_cadena, descripcion FROM CXC.TCXC_CADENA "
        "WHERE no_cia=:1 ORDER BY no_cadena",
        [no_cia])

def save_cadena(d: dict):
    exists = client.fetch_one(
        "SELECT 1 FROM CXC.TCXC_CADENA WHERE no_cia=:1 AND no_cadena=:2",
        [d['no_cia'], d['no_cadena']])
    with client.cursor() as cur:
        if exists:
            cur.execute(
                "UPDATE CXC.TCXC_CADENA SET descripcion=:1 WHERE no_cia=:2 AND no_cadena=:3",
                [d.get('descripcion', ''), d['no_cia'], d['no_cadena']])
        else:
            cur.execute(
                "INSERT INTO CXC.TCXC_CADENA(no_cia,no_cadena,descripcion) VALUES(:1,:2,:3)",
                [d['no_cia'], d['no_cadena'], d.get('descripcion', '')])
        cur.connection.commit()

def delete_cadena(no_cia: str, no_cadena: str):
    with client.cursor() as cur:
        cur.execute("DELETE FROM CXC.TCXC_CADENA WHERE no_cia=:1 AND no_cadena=:2",
                    [no_cia, no_cadena])
        cur.connection.commit()


# --- CLIENTES ----------------------------------------------------------------
# TCXC_CLIENTE: NO_CIA, PUNTO, NO_CLIENTE, TIPO_CONTABLE, TIPO_CLIENTE, NOMBRE,
#               VENDEDOR, LIMITE_CREDITO, PLAZO, TELEFONO, TELEFONO2, EMAIL1,
#               CIUDAD, BARRIO, ZONA, DIRECCION, RNC, CEDULA, RUTA_ENTREGA,
#               NO_CADENA, SALDO_INICIAL, DEBITOS, CREDITOS

def search_clientes(no_cia: str, q: str = '', page: int = 1, page_size: int = 50):
    offset = (page - 1) * page_size
    like = f'%{q.upper()}%' if q else '%'
    count_row = client.fetch_one(
        "SELECT COUNT(*) FROM CXC.TCXC_CLIENTE "
        "WHERE no_cia=:1 AND (UPPER(nombre) LIKE :2 OR UPPER(no_cliente) LIKE :3)",
        [no_cia, like, like])
    total = count_row[0] if count_row else 0
    sql = (
        "SELECT * FROM ("
        "  SELECT c.*, ROWNUM rn FROM ("
        "    SELECT no_cia, no_cliente, punto, nombre nombre_cliente, tipo_contable tipo_conta,"
        "           tipo_cliente tipo_cli, cedula, rnc, telefono, email1 email, ciudad, zona,"
        "           vendedor, ruta_entrega ruta, codigo_ncf,"
        "           NVL(limite_credito,0) limite_credito, NVL(plazo,0) dias_credito,"
        "           NVL(debitos,0)-NVL(creditos,0) saldo_actual"
        "    FROM CXC.TCXC_CLIENTE"
        "    WHERE no_cia=:1"
        "    AND (UPPER(nombre) LIKE :2 OR UPPER(no_cliente) LIKE :3)"
        "    ORDER BY nombre"
        "  ) c WHERE ROWNUM <= :4"
        ") WHERE rn > :5"
    )
    rows = client.fetch_dicts(sql, [no_cia, like, like, offset + page_size, offset])
    return {'items': rows, 'count': total}

def get_cliente(no_cia: str, no_cliente: str, punto: str = ''):
    filters = ["c.no_cia=:1", "c.no_cliente=:2"]
    params = [no_cia, no_cliente]
    if punto:
        filters.append("c.punto=:3")
        params.append(punto)
    rows = client.fetch_dicts(
        "SELECT c.*, NVL(c.debitos,0)-NVL(c.creditos,0) saldo_actual "
        f"FROM CXC.TCXC_CLIENTE c WHERE {' AND '.join(filters)}",
        params)
    if not rows:
        return None
    cli = rows[0]
    # Punto is part of key for sub-tables
    punto = cli.get('punto', '01')
    cli['contactos'] = client.fetch_dicts(
        "SELECT no_contacto, nombre, telefono, celular, email, area "
        "FROM CXC.TCXC_CONTACTO_CLIENTE "
        "WHERE no_cia=:1 AND no_cliente=:2 ORDER BY no_contacto",
        [no_cia, no_cliente])
    cli['referencias'] = client.fetch_dicts(
        "SELECT tipo_referencia, nombre, telefono, relacion "
        "FROM CXC.TCXC_REFECLIENTE "
        "WHERE no_cia=:1 AND no_cliente=:2",
        [no_cia, no_cliente])
    return cli

def save_cliente(d: dict):
    no_cia = d['no_cia']
    punto = d.get('punto', '01')
    # Accept frontend aliases or legacy field names
    nombre = d.get('nombre_cliente') or d.get('nombre', '')
    tipo_contable = d.get('tipo_conta') or d.get('tipo_contable', '')
    tipo_cliente = d.get('tipo_cli') or d.get('tipo_cliente', '')
    email1 = d.get('email') or d.get('email1', '')
    ruta_entrega = d.get('ruta') or d.get('ruta_entrega', '')
    no_cadena = d.get('cadena') or d.get('no_cadena', '')
    dias_credito = d.get('dias_credito') or d.get('plazo', 0)
    codigo_ncf = (d.get('codigo_ncf') or '').strip().upper()
    with client.cursor() as cur:
        is_new = not d.get('no_cliente')
        if is_new:
            row = cur.execute(
                "SELECT NVL(prox_cliente,1) FROM CXC.TCXC_PUNTO "
                "WHERE no_cia=:1 AND punto=:2", [no_cia, punto]).fetchone()
            next_num = row[0] if row else 1
            d['no_cliente'] = str(next_num).zfill(6)
            cur.execute(
                "UPDATE CXC.TCXC_PUNTO SET prox_cliente=prox_cliente+1 "
                "WHERE no_cia=:1 AND punto=:2", [no_cia, punto])
        exists = cur.execute(
            "SELECT 1 FROM CXC.TCXC_CLIENTE WHERE no_cia=:1 AND no_cliente=:2",
            [no_cia, d['no_cliente']]).fetchone()
        if exists:
            cur.execute(
                "UPDATE CXC.TCXC_CLIENTE SET nombre=:1, tipo_contable=:2, tipo_cliente=:3,"
                "cedula=:4, rnc=:5, telefono=:6, telefono2=:7, email1=:8, direccion=:9,"
                "ciudad=:10, barrio=:11, zona=:12, no_cadena=:13, vendedor=:14,"
                "ruta_entrega=:15, limite_credito=:16, plazo=:17, codigo_ncf=:18 "
                "WHERE no_cia=:19 AND no_cliente=:20",
                [nombre, tipo_contable, tipo_cliente,
                 d.get('cedula', ''), d.get('rnc', ''), d.get('telefono', ''),
                 d.get('telefono2', ''), email1, d.get('direccion', ''),
                 d.get('ciudad', ''), d.get('barrio', ''), d.get('zona', ''),
                 no_cadena, d.get('vendedor', ''), ruta_entrega,
                 d.get('limite_credito', 0), dias_credito, codigo_ncf,
                 no_cia, d['no_cliente']])
        else:
            cur.execute(
                "INSERT INTO CXC.TCXC_CLIENTE"
                "(no_cia,punto,no_cliente,nombre,tipo_contable,tipo_cliente,"
                "cedula,rnc,telefono,telefono2,email1,direccion,ciudad,barrio,zona,"
                "no_cadena,vendedor,ruta_entrega,limite_credito,plazo,codigo_ncf,fecha_ingreso) "
                "VALUES(:1,:2,:3,:4,:5,:6,:7,:8,:9,:10,:11,:12,:13,:14,:15,:16,:17,:18,:19,:20,:21,SYSDATE)",
                [no_cia, punto, d['no_cliente'], nombre,
                 tipo_contable, tipo_cliente,
                 d.get('cedula', ''), d.get('rnc', ''), d.get('telefono', ''),
                 d.get('telefono2', ''), email1, d.get('direccion', ''),
                 d.get('ciudad', ''), d.get('barrio', ''), d.get('zona', ''),
                 no_cadena, d.get('vendedor', ''), ruta_entrega,
                 d.get('limite_credito', 0), dias_credito, codigo_ncf])
        # Sync contactos
        cur.execute(
            "DELETE FROM CXC.TCXC_CONTACTO_CLIENTE "
            "WHERE no_cia=:1 AND no_cliente=:2", [no_cia, d['no_cliente']])
        for i, c in enumerate(d.get('contactos', []), 1):
            cur.execute(
                "INSERT INTO CXC.TCXC_CONTACTO_CLIENTE"
                "(no_cia,punto,no_cliente,no_contacto,nombre,telefono,celular,email) "
                "VALUES(:1,:2,:3,:4,:5,:6,:7,:8)",
                [no_cia, punto, d['no_cliente'], i, c.get('nombre', ''),
                 c.get('telefono', ''), c.get('celular', ''), c.get('email', '')])
        # Sync referencias
        cur.execute(
            "DELETE FROM CXC.TCXC_REFECLIENTE "
            "WHERE no_cia=:1 AND no_cliente=:2", [no_cia, d['no_cliente']])
        for i, r in enumerate(d.get('referencias', []), 1):
            cur.execute(
                "INSERT INTO CXC.TCXC_REFECLIENTE"
                "(no_cia,punto,no_cliente,tipo_referencia,nombre,telefono,relacion) "
                "VALUES(:1,:2,:3,:4,:5,:6,:7)",
                [no_cia, punto, d['no_cliente'], str(i),
                 r.get('nombre', ''), r.get('telefono', ''), r.get('relacion', '')])
        cur.connection.commit()
    return d['no_cliente']

def delete_cliente(no_cia: str, no_cliente: str):
    with client.cursor() as cur:
        cur.execute(
            "UPDATE CXC.TCXC_CLIENTE SET fecha_suspension=SYSDATE "
            "WHERE no_cia=:1 AND no_cliente=:2", [no_cia, no_cliente])
        cur.connection.commit()

def get_clientes_ruta(no_cia: str, ruta: str):
    return client.fetch_dicts(
        "SELECT no_cliente, nombre nombre_cliente, ruta_entrega FROM CXC.TCXC_CLIENTE "
        "WHERE no_cia=:1 AND ruta_entrega=:2 ORDER BY nombre",
        [no_cia, ruta])

def assign_cliente_ruta(no_cia: str, no_cliente: str, ruta: str):
    asignar_cliente_ruta(no_cia, no_cliente, ruta)

def asignar_cliente_ruta(no_cia: str, no_cliente: str, ruta: str):
    with client.cursor() as cur:
        cur.execute(
            "UPDATE CXC.TCXC_CLIENTE SET ruta_entrega=:1 "
            "WHERE no_cia=:2 AND no_cliente=:3",
            [ruta, no_cia, no_cliente])
        cur.connection.commit()


# --- DOCUMENTOS --------------------------------------------------------------
# TCXC_DOCUMENTO: NO_CIA, PUNTO, TIPO_DOCU, NO_DOCU, NO_CLIENTE, FECHA,
#                 VALOR_ORIGINAL, SALDO, ST_ANULADO, DETALLE, NCF, VENDEDOR

def list_documentos(no_cia: str, punto: str = '', tipo_doc: str = '',
                    desde: str = '', hasta: str = '', no_cliente: str = '',
                    no_doc: str = '', ncf: str = '',
                    estado: str = '', page: int = 1, page_size: int = 50):
    params = [no_cia]
    where = "WHERE d.no_cia=:1"
    n = 2
    if punto:
        where += f" AND d.punto=:{n}"; params.append(punto); n += 1
    if tipo_doc:
        where += f" AND d.tipo_docu=:{n}"; params.append(tipo_doc); n += 1
    if no_doc:
        where += f" AND d.no_docu LIKE :{n}"; params.append(f"%{no_doc}%"); n += 1
    if ncf:
        where += f" AND d.ncf LIKE :{n}"; params.append(f"%{ncf}%"); n += 1
    if desde:
        where += f" AND d.fecha>=TO_DATE(:{n},'YYYY-MM-DD')"; params.append(desde); n += 1
    if hasta:
        where += f" AND d.fecha<=TO_DATE(:{n},'YYYY-MM-DD')"; params.append(hasta); n += 1
    if no_cliente:
        where += f" AND d.no_cliente=:{n}"; params.append(no_cliente); n += 1
    if estado == 'pendiente':
        where += " AND NVL(d.st_anulado,'N')='N' AND NVL(d.saldo,0)>0"
    elif estado == 'anulado':
        where += " AND NVL(d.st_anulado,'N')='S'"
    count_row = client.fetch_one(
        f"SELECT COUNT(*) FROM CXC.TCXC_DOCUMENTO d {where}", params)
    total = count_row[0] if count_row else 0
    offset = (page - 1) * page_size
    sql = (
        "SELECT * FROM ("
        "  SELECT d.*, ROWNUM rn FROM ("
        "    SELECT d.no_cia, d.punto, d.tipo_docu tipo_doc, d.no_docu no_doc,"
        "           d.no_cliente, d.fecha,"
        "           NVL(d.valor_original,0) valor, NVL(d.saldo,0) saldo,"
        "           d.ncf, d.detalle,"
        "           CASE NVL(d.st_anulado,'N') WHEN 'S' THEN 'R' ELSE 'A' END estado,"
        "           c.nombre nombre_cliente"
        "    FROM CXC.TCXC_DOCUMENTO d"
        "    LEFT JOIN CXC.TCXC_CLIENTE c"
        "      ON c.no_cia=d.no_cia AND c.no_cliente=d.no_cliente"
        f"    {where} ORDER BY d.fecha DESC, d.no_docu DESC"
        f"  ) d WHERE ROWNUM <= :{n}"
        f") WHERE rn > :{n+1}"
    )
    params += [offset + page_size, offset]
    return {'items': client.fetch_dicts(sql, params), 'count': total}

def get_documento(no_cia: str, no_docu: str, tipo_docu: str = ''):
    sql = (
        "SELECT d.no_cia, d.punto, d.tipo_docu tipo_doc, d.no_docu no_doc, "
        "d.no_cliente, d.fecha, c.nombre nombre_cliente, c.rnc, "
        "NVL(d.valor_original,0) valor, NVL(d.saldo,0) saldo, "
        "d.ncf, d.detalle, "
        "CASE NVL(d.st_anulado,'N') WHEN 'S' THEN 'R' ELSE 'A' END estado "
        "FROM CXC.TCXC_DOCUMENTO d "
        "LEFT JOIN CXC.TCXC_CLIENTE c ON c.no_cia=d.no_cia AND c.no_cliente=d.no_cliente "
        "WHERE d.no_cia=:1 AND d.no_docu=:2"
    )
    params = [no_cia, no_docu]
    if tipo_docu:
        sql += " AND d.tipo_docu=:3"
        params.append(tipo_docu)
    rows = client.fetch_dicts(sql, params)
    if not rows:
        return None
    doc = rows[0]
    # TCXC_DCDOCU NO tiene columna `detalle` — solo cuenta/centro_costo/tipo_movi/monto.
    doc['lineas'] = client.fetch_dicts(
        "SELECT cuenta, centro_costo, tipo_movi, NVL(monto,0) AS monto, "
        "CASE WHEN tipo_movi='D' THEN NVL(monto,0) ELSE 0 END debito, "
        "CASE WHEN tipo_movi='C' THEN NVL(monto,0) ELSE 0 END credito "
        "FROM CXC.TCXC_DCDOCU WHERE no_cia=:1 AND no_docu=:2 "
        "ORDER BY tipo_movi DESC, cuenta",
        [no_cia, no_docu])
    return doc

def get_next_no_doc(no_cia: str, punto: str) -> str:
    row = client.fetch_one(
        "SELECT NVL(MAX(TO_NUMBER(REGEXP_SUBSTR(no_docu,'[0-9]+'))),0)+1 "
        "FROM CXC.TCXC_DOCUMENTO WHERE no_cia=:1 AND punto=:2",
        [no_cia, punto])
    return str(row[0]).zfill(8) if row else '00000001'

def save_documento(d: dict):
    no_cia = d['no_cia']
    punto = d.get('punto', '01')
    # Accept both frontend aliases and legacy field names
    no_docu = d.get('no_doc') or d.get('no_docu', '')
    tipo_docu = d.get('tipo_doc') or d.get('tipo_docu', '')
    valor = d.get('valor') or d.get('valor_original', 0)
    with client.cursor() as cur:
        exists = cur.execute(
            "SELECT 1 FROM CXC.TCXC_DOCUMENTO WHERE no_cia=:1 AND no_docu=:2",
            [no_cia, no_docu]).fetchone()
        fecha = d.get('fecha', date.today().isoformat())
        if exists:
            cur.execute(
                "UPDATE CXC.TCXC_DOCUMENTO "
                "SET tipo_docu=:1, no_cliente=:2, fecha=TO_DATE(:3,'YYYY-MM-DD'),"
                "valor_original=:4, ncf=:5, detalle=:6 "
                "WHERE no_cia=:7 AND no_docu=:8",
                [tipo_docu, d.get('no_cliente', ''), fecha,
                 valor, d.get('ncf', ''), d.get('detalle', ''),
                 no_cia, no_docu])
        else:
            cur.execute(
                "INSERT INTO CXC.TCXC_DOCUMENTO"
                "(no_cia,punto,tipo_docu,no_docu,no_cliente,"
                "fecha,valor_original,saldo,ncf,detalle,st_anulado) "
                "VALUES(:1,:2,:3,:4,:5,TO_DATE(:6,'YYYY-MM-DD'),:7,:7,:8,:9,'N')",
                [no_cia, punto, tipo_docu, no_docu,
                 d.get('no_cliente', ''), fecha,
                 valor, d.get('ncf', ''), d.get('detalle', '')])
        # Replace detail lines
        cur.execute(
            "DELETE FROM CXC.TCXC_DCDOCU WHERE no_cia=:1 AND no_docu=:2",
            [no_cia, no_docu])
        for l in d.get('lineas', []):
            # Frontend sends debito/credito; legacy sends tipo_movi/monto
            if 'debito' in l or 'credito' in l:
                debito = float(l.get('debito') or 0)
                credito = float(l.get('credito') or 0)
                if debito > 0:
                    cur.execute(
                        "INSERT INTO CXC.TCXC_DCDOCU"
                        "(no_cia,punto,tipo_docu,no_docu,cuenta,tipo_movi,monto,centro_costo,no_cliente) "
                        "VALUES(:1,:2,:3,:4,:5,'D',:6,:7,:8)",
                        [no_cia, punto, tipo_docu, no_docu,
                         l.get('cuenta', ''), debito,
                         l.get('centro_costo', ''), d.get('no_cliente', '')])
                if credito > 0:
                    cur.execute(
                        "INSERT INTO CXC.TCXC_DCDOCU"
                        "(no_cia,punto,tipo_docu,no_docu,cuenta,tipo_movi,monto,centro_costo,no_cliente) "
                        "VALUES(:1,:2,:3,:4,:5,'C',:6,:7,:8)",
                        [no_cia, punto, tipo_docu, no_docu,
                         l.get('cuenta', ''), credito,
                         l.get('centro_costo', ''), d.get('no_cliente', '')])
            else:
                cur.execute(
                    "INSERT INTO CXC.TCXC_DCDOCU"
                    "(no_cia,punto,tipo_docu,no_docu,cuenta,tipo_movi,monto,centro_costo,no_cliente) "
                    "VALUES(:1,:2,:3,:4,:5,:6,:7,:8,:9)",
                    [no_cia, punto, tipo_docu, no_docu,
                     l.get('cuenta', ''), l.get('tipo_movi', 'D'),
                     l.get('monto', 0), l.get('centro_costo', ''), d.get('no_cliente', '')])
        cur.connection.commit()
    return no_docu


# --- PROCESOS ----------------------------------------------------------------

def reversar_documento(no_cia: str, no_docu: str, tipo_doc_rev: str = '',
                       fecha_trans: str = '', liberar_ncf: bool = False,
                       usuario: str = ''):
    with client.cursor() as cur:
        cur.execute(
            "UPDATE CXC.TCXC_DOCUMENTO SET st_anulado='S', detalle='ANULADO' "
            "WHERE no_cia=:1 AND no_docu=:2",
            [no_cia, no_docu])
        cur.connection.commit()
    return no_docu

def get_facturas_pendientes_cliente(no_cia: str, no_cliente: str, punto: str = ''):
    """Documentos DR (facturas/débitos) con saldo > 0 del cliente, no aplicados aún
    contra el recibo en curso. Se filtra `tipo_movi='D'` y `saldo > 0`.

    Si `punto` se pasa, se restringe al punto; si no, todas las sucursales del cliente.
    Ordenado por fecha — el legado aplica FIFO por defecto.
    """
    sql = (
        "SELECT d.punto, d.tipo_docu, d.no_docu, d.no_cliente, d.fecha, "
        "       d.detalle, NVL(d.valor_original,0) AS valor_original, "
        "       NVL(d.saldo,0) AS saldo, "
        "       d.ncf, d.tipo_movi, "
        "       d.posiciones_fijas_ncf "
        "  FROM CXC.TCXC_DOCUMENTO d "
        " WHERE d.no_cia=:1 AND d.no_cliente=:2 "
        "   AND NVL(d.st_anulado,'N')='N' "
        "   AND NVL(d.saldo,0) > 0 "
        "   AND NVL(d.tipo_movi,'D')='D' "
    )
    params: list = [no_cia, str(no_cliente)]
    if punto:
        sql += " AND d.punto=:3 "
        params.append(punto)
    sql += " ORDER BY d.fecha, d.no_docu"
    rows = client.fetch_dicts(sql, params)
    out = []
    for r in rows:
        ncf_dgi = ''
        if r.get('posiciones_fijas_ncf') and r.get('ncf'):
            try:
                ncf_dgi = f"{str(r['posiciones_fijas_ncf']).strip()}{int(r['ncf']):08d}"
            except (TypeError, ValueError):
                ncf_dgi = str(r.get('ncf') or '')
        out.append({
            'punto': r['punto'],
            'tipo_doc': (r.get('tipo_docu') or '').strip(),
            'no_doc': str(r.get('no_docu') or '').strip(),
            'no_doc_display': f"{(r.get('tipo_docu') or '').strip()}-{str(r.get('no_docu') or '').strip()}",
            'no_cliente': r['no_cliente'],
            'fecha': str(r.get('fecha') or '')[:10] if r.get('fecha') else None,
            'detalle': r.get('detalle') or '',
            'valor_original': float(r.get('valor_original') or 0),
            'saldo': float(r.get('saldo') or 0),
            'ncf_dgi': ncf_dgi,
        })
    return out


def crear_recibo_cobro(
    *, no_cia: str, punto: str, tipo_doc: str, no_cliente: str,
    fecha: str, ncf: str = '', detalle: str = '',
    vendedor: str = '', cobrador: str = '', plazo: int = 0,
    valor_doc: float = 0,
    aplicaciones: list | None = None,
) -> dict:
    """Crea un recibo de ingreso siguiendo el flujo legado FCXC201:

    1. Lee del tipo de documento (TCXC_TDOCU) la CUENTA y CENTRO_COSTO defaults
       (configurado en FCXC104 — el usuario NO los elige).
    2. Lee del cliente (TCXC_CLIENTE) su Tipo Contable y de ahí el CUENTA_CLIENTE
       (TCXC_TCONTABLE) — la cuenta de Cuentas por Cobrar.
    3. Inserta TCXC_DOCUMENTO (cabecera).
    4. Inserta TCXC_DCDOCU con la distribución contable auto-generada:
         - Cuenta tipo_doc (ej. 1101-01 caja) tipo_movi='D' (débito) por el total
         - Cuenta cliente (ej. 1103-01 CxC) tipo_movi='C' (crédito) por el total
       (Esto es lo que muestra el PDF: 1101-01 caja DR · 1103-01 CxC CR)
    5. Por cada aplicación en TCXC_REFEDOCU y reduce saldo de la factura.
    """
    aplicaciones = aplicaciones or []
    aplicaciones_validas = [a for a in aplicaciones if float(a.get('monto') or 0) > 0]
    total_apl = sum(float(a.get('monto') or 0) for a in aplicaciones_validas)
    total_itbis_retenido = sum(float(a.get('itbis_retenido') or 0) for a in aplicaciones_validas)
    total_isr_retenido = sum(float(a.get('isr_retenido') or 0) for a in aplicaciones_validas)
    total_retenido = total_itbis_retenido + total_isr_retenido
    valor_doc = float(valor_doc or total_apl)
    if valor_doc <= 0 and total_apl <= 0:
        raise ValueError("El recibo no puede tener valor 0. Indique el valor del documento o aplique a alguna factura.")
    if total_retenido - valor_doc > 0.001:
        raise ValueError("La retencion no puede ser mayor que el valor aplicado del recibo.")
    no_doc = get_next_no_doc(no_cia, punto)

    with client.cursor() as cur:
        # 1. Cuenta y centro_costo defaults del tipo de doc (configurado en FCXC104)
        cur.execute(
            "SELECT NVL(cuenta,''), NVL(centro_costo,'0000000000'), tipo_movi "
            "FROM CXC.TCXC_TDOCU WHERE no_cia=:1 AND tipo_docu=:2",
            [no_cia, tipo_doc])
        td = cur.fetchone()
        if not td:
            raise ValueError(f"Tipo de documento {tipo_doc} no existe")
        cuenta_default, centro_costo, tipo_movi_tdocu = td[0], td[1], (td[2] or 'C').upper()

        # 2. Cuenta del cliente (CxC) desde TCXC_CLIENTE.tipo_contable → TCXC_TCONTABLE.cuenta_cliente
        cur.execute(
            "SELECT NVL(t.cuenta_cliente,'') "
            "FROM CXC.TCXC_CLIENTE c "
            "LEFT JOIN CXC.TCXC_TCONTABLE t ON t.no_cia=c.no_cia AND t.tipo_contable=c.tipo_contable "
            "WHERE c.no_cia=:1 AND c.no_cliente=:2",
            [no_cia, str(no_cliente)])
        cli_row = cur.fetchone()
        cuenta_cliente = cli_row[0] if cli_row else ''

        cuenta_itbis_retenido = '2106-02'
        cuenta_isr_retenido = '2106-01'
        try:
            cur.execute(
                "SELECT NVL(cuenta_itbis_retenido,'2106-02'), NVL(cuenta_isr,'2106-01') "
                "FROM CNT.TCNT_CIA WHERE no_cia=:1",
                [no_cia])
            cia_row = cur.fetchone()
            if cia_row:
                cuenta_itbis_retenido = cia_row[0] or cuenta_itbis_retenido
                cuenta_isr_retenido = cia_row[1] or cuenta_isr_retenido
        except Exception:
            pass

        # 3. Cabecera del recibo
        # tipo_movi: 'C' (recibo) → en el documento se guarda como 'C' porque CXC tiene saldo opuesto
        # Para tipos AD/AC depende; aquí confiamos en TCXC_TDOCU.tipo_movi
        cur.execute(
            "INSERT INTO CXC.TCXC_DOCUMENTO ("
            " no_cia, punto, tipo_docu, no_docu, no_cliente, fecha, "
            " valor_original, saldo, ncf, detalle, st_anulado, tipo_movi, "
            " vendedor, cobrador, plazo"
            ") VALUES (:1,:2,:3,:4,:5,TO_DATE(:6,'YYYY-MM-DD'),"
            " :7, 0, :8, :9, 'N', :10, :11, :12, :13)",
            [no_cia, punto, tipo_doc, no_doc, str(no_cliente), fecha,
             valor_doc, ncf, detalle, tipo_movi_tdocu,
             vendedor or '', cobrador or '', int(plazo or 0)])

        # 4. Distribución contable auto-generada:
        #    Cuenta del tipo_doc (ej. CAJA) — DR por el valor
        #    Cuenta del cliente (ej. CxC)   — CR por el valor
        pago_efectivo = max(valor_doc - total_retenido, 0)
        if cuenta_default and pago_efectivo > 0:
            cur.execute(
                "INSERT INTO CXC.TCXC_DCDOCU ("
                " no_cia, punto, tipo_docu, no_docu, cuenta, "
                " tipo_movi, monto, centro_costo, no_cliente"
                ") VALUES (:1,:2,:3,:4,:5,'D',:6,:7,:8)",
                [no_cia, punto, tipo_doc, no_doc, cuenta_default,
                 pago_efectivo, centro_costo, str(no_cliente)])
        if total_itbis_retenido > 0:
            cur.execute(
                "INSERT INTO CXC.TCXC_DCDOCU ("
                " no_cia, punto, tipo_docu, no_docu, cuenta, "
                " tipo_movi, monto, centro_costo, no_cliente"
                ") VALUES (:1,:2,:3,:4,:5,'D',:6,:7,:8)",
                [no_cia, punto, tipo_doc, no_doc, cuenta_itbis_retenido,
                 total_itbis_retenido, centro_costo, str(no_cliente)])
        if total_isr_retenido > 0:
            cur.execute(
                "INSERT INTO CXC.TCXC_DCDOCU ("
                " no_cia, punto, tipo_docu, no_docu, cuenta, "
                " tipo_movi, monto, centro_costo, no_cliente"
                ") VALUES (:1,:2,:3,:4,:5,'D',:6,:7,:8)",
                [no_cia, punto, tipo_doc, no_doc, cuenta_isr_retenido,
                 total_isr_retenido, centro_costo, str(no_cliente)])
        if cuenta_cliente:
            cur.execute(
                "INSERT INTO CXC.TCXC_DCDOCU ("
                " no_cia, punto, tipo_docu, no_docu, cuenta, "
                " tipo_movi, monto, centro_costo, no_cliente"
                ") VALUES (:1,:2,:3,:4,:5,'C',:6,:7,:8)",
                [no_cia, punto, tipo_doc, no_doc, cuenta_cliente,
                 valor_doc, '0000000000', str(no_cliente)])

        # 5. Aplicaciones (TCXC_REFEDOCU) — actualiza saldo de cada factura
        for a in aplicaciones_validas:
            monto = float(a.get('monto') or 0)
            itbis_retenido = float(a.get('itbis_retenido') or 0)
            isr_retenido = float(a.get('isr_retenido') or 0)
            tipo_ref = (a.get('tipo_ref') or a.get('tipo_doc') or '').strip().upper()
            no_ref = str(a.get('no_ref') or a.get('no_doc') or '').strip()
            if not tipo_ref or not no_ref:
                continue
            if itbis_retenido < 0 or isr_retenido < 0:
                raise ValueError("La retencion no puede ser negativa.")
            if itbis_retenido + isr_retenido - monto > 0.001:
                raise ValueError(f"La retencion no puede exceder el valor aplicado de {tipo_ref}-{no_ref}.")
            cur.execute(
                "UPDATE CXC.TCXC_DOCUMENTO "
                "   SET saldo = NVL(saldo,0) - :1 "
                " WHERE no_cia=:2 AND punto=:3 AND tipo_docu=:4 AND no_docu=:5",
                [monto, no_cia, punto, tipo_ref, no_ref])
            cur.execute(
                "INSERT INTO CXC.TCXC_REFEDOCU "
                "(no_cia, punto, tipo_docu, no_docu, no_cliente, tipo_refe, no_refe, "
                " monto, valor_nc, itbis_retenido, isr_retenido) "
                "VALUES (:1, :2, :3, :4, :5, :6, :7, :8, 0, :9, :10)",
                [no_cia, punto, tipo_doc, no_doc, str(no_cliente), tipo_ref, no_ref,
                 monto, itbis_retenido, isr_retenido])

        cur.connection.commit()
    return {
        'no_doc': no_doc, 'tipo_doc': tipo_doc, 'total': valor_doc,
        'pago_efectivo': pago_efectivo,
        'itbis_retenido': total_itbis_retenido,
        'isr_retenido': total_isr_retenido,
        'aplicaciones_count': len(aplicaciones_validas),
        'cuenta_default': cuenta_default,
        'cuenta_cliente': cuenta_cliente,
    }


def get_documentos_pendientes_masivo(no_cia: str, desde: str, hasta: str):
    return client.fetch_dicts(
        "SELECT d.punto, d.tipo_docu tipo_doc, d.no_docu no_doc, "
        "d.no_cliente, c.nombre nombre_cliente, d.fecha,"
        "NVL(d.valor_original,0) valor, NVL(d.saldo,0) saldo "
        "FROM CXC.TCXC_DOCUMENTO d "
        "JOIN CXC.TCXC_CLIENTE c ON c.no_cia=d.no_cia AND c.no_cliente=d.no_cliente "
        "WHERE d.no_cia=:1 AND NVL(d.st_anulado,'N')='N' AND NVL(d.saldo,0)>0 "
        "AND d.fecha BETWEEN TO_DATE(:2,'YYYY-MM-DD') AND TO_DATE(:3,'YYYY-MM-DD') "
        "ORDER BY d.fecha, d.no_docu",
        [no_cia, desde, hasta])

def apply_pagos_masivos(no_cia: str, punto: str = '', tipo_doc: str = '',
                        fecha: str = '', pagos: list = None):
    pagos = pagos or []
    with client.cursor() as cur:
        for p in pagos:
            # Accept frontend (no_doc/valor_pagado) or legacy (no_docu/monto)
            no_docu = p.get('no_doc') or p.get('no_docu', '')
            monto = p.get('valor_pagado') or p.get('monto', 0)
            cur.execute(
                "UPDATE CXC.TCXC_DOCUMENTO SET saldo=NVL(saldo,0)-:1 "
                "WHERE no_cia=:2 AND no_docu=:3",
                [monto, no_cia, no_docu])
        cur.connection.commit()
    return {'applied': len(pagos)}

def get_debitos_cliente(no_cia: str, no_cliente: str, no_docu_cr: str):
    return client.fetch_dicts(
        "SELECT no_docu no_doc, tipo_docu tipo_doc, fecha, "
        "NVL(valor_original,0) valor, NVL(saldo,0) saldo, detalle "
        "FROM CXC.TCXC_DOCUMENTO "
        "WHERE no_cia=:1 AND no_cliente=:2 AND NVL(st_anulado,'N')='N' "
        "AND NVL(saldo,0)>0 AND no_docu<>:3 ORDER BY fecha",
        [no_cia, no_cliente, no_docu_cr])

def liberar_credito(no_cia: str, no_docu_cr: str, debitos: list):
    with client.cursor() as cur:
        for d in debitos:
            # Accept frontend (no_doc_dr/valor_aplica) or legacy (no_docu/monto_aplicar)
            no_docu = d.get('no_doc_dr') or d.get('no_docu', '')
            monto = d.get('valor_aplica') or d.get('monto_aplicar', 0)
            cur.execute(
                "UPDATE CXC.TCXC_DOCUMENTO SET saldo=NVL(saldo,0)-:1 "
                "WHERE no_cia=:2 AND no_docu=:3",
                [monto, no_cia, no_docu])
        cur.execute(
            "UPDATE CXC.TCXC_DOCUMENTO SET saldo=0 WHERE no_cia=:1 AND no_docu=:2",
            [no_cia, no_docu_cr])
        cur.connection.commit()
    return {'ok': True}

def get_max_saldo_menor_aj(no_cia: str, punto: str) -> float:
    """Lee el umbral default desde TCXC_PUNTO (configurable por compañía/punto)."""
    row = client.fetch_one(
        "SELECT NVL(max_saldo_menor_aj,0) FROM CXC.TCXC_PUNTO "
        "WHERE no_cia=:1 AND punto=:2",
        [no_cia, punto])
    return float(row[0]) if row else 0.0


def get_saldos_menores_preview(no_cia: str, punto: str, max_saldo: float):
    """Preview de docs con saldo dentro del rango (-max_saldo, +max_saldo)
    excluyendo 0 y anulados. Agrupado por cliente.

    Retorna { positivos: [{cliente,...,docs:[...], total_saldo}],
              negativos: [...] }
    Los positivos serán cancelados con un AC (Ajuste Crédito).
    Los negativos serán cancelados con un AD (Ajuste Débito).
    """
    if max_saldo <= 0:
        return {'positivos': [], 'negativos': [], 'max_saldo': max_saldo}
    sql = """
        SELECT d.no_cliente, NVL(c.nombre,'') AS nombre_cliente,
               d.punto, d.tipo_docu AS tipo_doc, d.no_docu AS no_doc,
               TO_CHAR(d.fecha,'YYYY-MM-DD') AS fecha,
               NVL(d.valor_original,0) AS valor,
               NVL(d.saldo,0) AS saldo, d.ncf
          FROM CXC.TCXC_DOCUMENTO d
          LEFT JOIN CXC.TCXC_CLIENTE c
            ON c.no_cia=d.no_cia AND c.no_cliente=d.no_cliente
         WHERE d.no_cia=:1 AND d.punto=:2
           AND NVL(d.st_anulado,'N')='N'
           AND ((d.saldo > 0 AND d.saldo <= :3)
                OR (d.saldo < 0 AND d.saldo >= :4))
         ORDER BY d.no_cliente, d.fecha, d.no_docu
    """
    rows = client.fetch_dicts(sql, [no_cia, punto, max_saldo, -max_saldo])
    pos: dict = {}
    neg: dict = {}
    for r in rows:
        bucket = pos if r['saldo'] > 0 else neg
        cli = str(r['no_cliente'] or '').strip()
        if cli not in bucket:
            bucket[cli] = {
                'no_cliente': cli,
                'nombre_cliente': r['nombre_cliente'],
                'docs': [],
                'total_saldo': 0.0,
            }
        bucket[cli]['docs'].append({
            'punto': r['punto'], 'tipo_doc': r['tipo_doc'].strip(),
            'no_doc': r['no_doc'].strip(), 'fecha': r['fecha'],
            'valor': float(r['valor']), 'saldo': float(r['saldo']),
            'ncf': r['ncf'],
        })
        bucket[cli]['total_saldo'] += float(r['saldo'])
    return {
        'max_saldo': max_saldo,
        'positivos': sorted(pos.values(), key=lambda x: -x['total_saldo']),
        'negativos': sorted(neg.values(), key=lambda x: x['total_saldo']),
    }


def aplicar_saldos_menores(no_cia: str, punto: str, max_saldo: float,
                           fecha: str, motivo: str = '',
                           usuario: str = '') -> dict:
    """Genera 1 AC por cliente con docs de saldo positivo <= max_saldo y
    1 AD por cliente con docs de saldo negativo >= -max_saldo, aplicando
    el ajuste contra esos documentos (TCXC_REFEDOCU) y dejándolos en saldo 0.

    Imita Fcxc204 legacy:
    - Cuenta del ajuste viene de TCXC_TDOCU.cuenta para AC/AD (suele 4201-01)
    - Cuenta del cliente viene de TCXC_TCONTABLE.cuenta_cliente
    - Motivo se guarda en detalle del nuevo documento
    """
    if max_saldo <= 0:
        raise ValueError("max_saldo debe ser mayor que 0")
    preview = get_saldos_menores_preview(no_cia, punto, max_saldo)
    motivo = motivo or 'DOC. GENERADO POR SALDOS MENORES POR AJUSTAR'

    # Resolver tipos y cuentas AC/AD una sola vez
    tdoc_rows = client.fetch_dicts(
        "SELECT tipo_docu, tipo_movi, NVL(cuenta,'') AS cuenta, "
        "NVL(centro_costo,'0000000000') AS centro_costo "
        "FROM CXC.TCXC_TDOCU WHERE no_cia=:1 AND tipo_transaccion='A'",
        [no_cia])
    tdocs = {(r['tipo_movi'] or '').upper(): r for r in tdoc_rows}
    if 'C' not in tdocs or 'D' not in tdocs:
        raise ValueError("No están configurados los tipos de ajuste AC/AD en TCXC_TDOCU.")

    docs_creados = []
    with client.cursor() as cur:
        # POSITIVOS → AC (Crédito) que reduce el saldo a 0
        td_ac = tdocs['C']
        for grp in preview['positivos']:
            no_cli = grp['no_cliente']
            total = round(grp['total_saldo'], 2)
            if total <= 0:
                continue
            no_doc = get_next_no_doc(no_cia, punto)
            cuenta_cliente = _get_cuenta_cliente(cur, no_cia, no_cli)
            _insert_ajuste_header(cur, no_cia, punto, td_ac['tipo_docu'], no_doc,
                                  no_cli, fecha, total, motivo, 'C', usuario)
            _insert_ajuste_lineas(cur, no_cia, punto, td_ac['tipo_docu'], no_doc,
                                  no_cli, total,
                                  cuenta_ajuste=td_ac['cuenta'],
                                  centro_costo=td_ac['centro_costo'],
                                  cuenta_cliente=cuenta_cliente,
                                  signo_ajuste='D',  # AC: D 4201-01 | C cuenta_cliente
                                  signo_cliente='C')
            _aplicar_refedocu_y_cerrar(cur, no_cia, punto, td_ac['tipo_docu'],
                                       no_doc, no_cli, grp['docs'])
            docs_creados.append({
                'tipo_doc': td_ac['tipo_docu'], 'no_doc': no_doc,
                'no_cliente': no_cli, 'total': total, 'cancelados': len(grp['docs']),
            })

        # NEGATIVOS → AD (Débito) que sube el saldo a 0
        td_ad = tdocs['D']
        for grp in preview['negativos']:
            no_cli = grp['no_cliente']
            total = round(abs(grp['total_saldo']), 2)
            if total <= 0:
                continue
            no_doc = get_next_no_doc(no_cia, punto)
            cuenta_cliente = _get_cuenta_cliente(cur, no_cia, no_cli)
            _insert_ajuste_header(cur, no_cia, punto, td_ad['tipo_docu'], no_doc,
                                  no_cli, fecha, total, motivo, 'D', usuario)
            _insert_ajuste_lineas(cur, no_cia, punto, td_ad['tipo_docu'], no_doc,
                                  no_cli, total,
                                  cuenta_ajuste=td_ad['cuenta'],
                                  centro_costo=td_ad['centro_costo'],
                                  cuenta_cliente=cuenta_cliente,
                                  signo_ajuste='C',  # AD: D cuenta_cliente | C 4201-01
                                  signo_cliente='D')
            _aplicar_refedocu_y_cerrar(cur, no_cia, punto, td_ad['tipo_docu'],
                                       no_doc, no_cli, grp['docs'])
            docs_creados.append({
                'tipo_doc': td_ad['tipo_docu'], 'no_doc': no_doc,
                'no_cliente': no_cli, 'total': total, 'cancelados': len(grp['docs']),
            })

        cur.connection.commit()
    return {
        'ok': True,
        'docs_creados': docs_creados,
        'clientes_positivos': len(preview['positivos']),
        'clientes_negativos': len(preview['negativos']),
    }


def _get_cuenta_cliente(cur, no_cia, no_cliente):
    cur.execute(
        "SELECT NVL(t.cuenta_cliente,'') "
        "FROM CXC.TCXC_CLIENTE c "
        "LEFT JOIN CXC.TCXC_TCONTABLE t "
        "  ON t.no_cia=c.no_cia AND t.tipo_contable=c.tipo_contable "
        "WHERE c.no_cia=:1 AND c.no_cliente=:2",
        [no_cia, str(no_cliente)])
    row = cur.fetchone()
    return row[0] if row else ''


def _insert_ajuste_header(cur, no_cia, punto, tipo_docu, no_docu,
                          no_cliente, fecha, valor, motivo, tipo_movi, usuario):
    cur.execute(
        "INSERT INTO CXC.TCXC_DOCUMENTO ("
        " no_cia, punto, tipo_docu, no_docu, no_cliente, fecha,"
        " valor_original, saldo, ncf, detalle, st_anulado, tipo_movi"
        ") VALUES (:1,:2,:3,:4,:5,TO_DATE(:6,'YYYY-MM-DD'),:7,0,'',:8,'N',:9)",
        [no_cia, punto, tipo_docu, no_docu, str(no_cliente), fecha,
         valor, motivo, tipo_movi])


def _insert_ajuste_lineas(cur, no_cia, punto, tipo_docu, no_docu, no_cliente,
                          monto, cuenta_ajuste, centro_costo, cuenta_cliente,
                          signo_ajuste, signo_cliente):
    if cuenta_ajuste:
        cur.execute(
            "INSERT INTO CXC.TCXC_DCDOCU ("
            " no_cia, punto, tipo_docu, no_docu, cuenta, tipo_movi,"
            " monto, centro_costo, no_cliente"
            ") VALUES (:1,:2,:3,:4,:5,:6,:7,:8,:9)",
            [no_cia, punto, tipo_docu, no_docu, cuenta_ajuste,
             signo_ajuste, monto, centro_costo, str(no_cliente)])
    if cuenta_cliente:
        cur.execute(
            "INSERT INTO CXC.TCXC_DCDOCU ("
            " no_cia, punto, tipo_docu, no_docu, cuenta, tipo_movi,"
            " monto, centro_costo, no_cliente"
            ") VALUES (:1,:2,:3,:4,:5,:6,:7,'0000000000',:8)",
            [no_cia, punto, tipo_docu, no_docu, cuenta_cliente,
             signo_cliente, monto, str(no_cliente)])


def _aplicar_refedocu_y_cerrar(cur, no_cia, punto, tipo_docu, no_docu,
                                no_cliente, docs_afectados):
    for d in docs_afectados:
        saldo = float(d['saldo'])
        monto = abs(saldo)  # siempre positivo en REFEDOCU
        tipo_ref = d['tipo_doc'].strip()
        no_ref = d['no_doc'].strip()
        cur.execute(
            "INSERT INTO CXC.TCXC_REFEDOCU "
            "(no_cia, punto, tipo_docu, no_docu, no_cliente, tipo_refe, no_refe, monto) "
            "VALUES (:1,:2,:3,:4,:5,:6,:7,:8)",
            [no_cia, punto, tipo_docu, no_docu, str(no_cliente),
             tipo_ref, no_ref, monto])
        cur.execute(
            "UPDATE CXC.TCXC_DOCUMENTO SET saldo=0 "
            "WHERE no_cia=:1 AND punto=:2 AND tipo_docu=:3 AND no_docu=:4",
            [no_cia, punto, tipo_ref, no_ref])


def corregir_ncf(no_cia: str, no_docu: str, ncf: str, ncf_anterior: str = ''):
    with client.cursor() as cur:
        cur.execute(
            "UPDATE CXC.TCXC_DOCUMENTO SET ncf=:1 WHERE no_cia=:2 AND no_docu=:3",
            [ncf, no_cia, no_docu])
        cur.connection.commit()
    return {'ok': True}


# --- CONSULTAS ---------------------------------------------------------------

def estado_cuenta(no_cia: str, no_cliente: str):
    cli = client.fetch_dicts(
        "SELECT no_cliente, nombre, "
        "       NVL(rnc,'') rnc, NVL(direccion,'') direccion, "
        "       NVL(telefono,'') telefono, NVL(telefono2,'') telefono2, "
        "       NVL(email1,'') email, NVL(vendedor,'') vendedor, "
        "       NVL(cobrador,'') cobrador, "
        "       NVL(limite_credito,0) limite, NVL(plazo,0) dias, "
        "       NVL(debitos,0)-NVL(creditos,0) saldo_actual "
        "FROM CXC.TCXC_CLIENTE WHERE no_cia=:1 AND no_cliente=:2",
        [no_cia, no_cliente])
    if not cli:
        return None
    docs = client.fetch_dicts(
        "SELECT d.no_docu no_doc, d.tipo_docu tipo_doc, "
        "       TO_CHAR(d.fecha,'YYYY-MM-DD') fecha, "
        "       NVL(d.valor_original,0) valor, NVL(d.saldo,0) saldo, "
        "       d.ncf, d.detalle, "
        "       TRUNC(SYSDATE)-TRUNC(d.fecha) dias_vencido, "
        "       NVL(t.tipo_movi,'D') tipo_movi, "
        "       NVL(t.descripcion, d.tipo_docu) tipo_label "
        "FROM CXC.TCXC_DOCUMENTO d "
        "LEFT JOIN CXC.TCXC_TDOCU t "
        "  ON t.no_cia=d.no_cia AND t.tipo_docu=d.tipo_docu "
        "WHERE d.no_cia=:1 AND d.no_cliente=:2 "
        "  AND NVL(d.st_anulado,'N')='N' AND NVL(d.saldo,0)<>0 "
        "ORDER BY d.fecha, d.no_docu",
        [no_cia, no_cliente])
    row = cli[0]

    # Aging buckets (basados en saldo positivo = débito pendiente del cliente)
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

    return {
        'cliente': {
            'no_cliente': str(row['no_cliente']).strip(),
            'nombre': row['nombre'],
            'rnc': row['rnc'], 'direccion': row['direccion'],
            'telefono': row['telefono'] or row['telefono2'],
            'email': row['email'],
            'vendedor': row['vendedor'], 'cobrador': row['cobrador'],
            'limite': float(row['limite'] or 0),
            'dias': int(row['dias'] or 0),
            'saldo_actual': float(row['saldo_actual'] or 0),
        },
        'total_pendiente': total_pendiente,
        'total_debito': total_debito,
        'total_credito': total_credito,
        'aging': aging,
        'documentos': docs,
    }

def balance_clientes(no_cia: str, punto: str = ''):
    params = [no_cia]
    extra = " AND d.punto=:2" if punto else ""
    if punto:
        params.append(punto)
    sql = (
        "SELECT c.no_cliente, c.nombre nombre_cliente, c.vendedor, "
        "SUM(CASE WHEN TRUNC(SYSDATE)-TRUNC(d.fecha) BETWEEN 0 AND 30 "
        "     THEN NVL(d.saldo,0) ELSE 0 END) dias_0_30, "
        "SUM(CASE WHEN TRUNC(SYSDATE)-TRUNC(d.fecha) BETWEEN 31 AND 60 "
        "     THEN NVL(d.saldo,0) ELSE 0 END) dias_31_60, "
        "SUM(CASE WHEN TRUNC(SYSDATE)-TRUNC(d.fecha) BETWEEN 61 AND 90 "
        "     THEN NVL(d.saldo,0) ELSE 0 END) dias_61_90, "
        "SUM(CASE WHEN TRUNC(SYSDATE)-TRUNC(d.fecha) > 90 "
        "     THEN NVL(d.saldo,0) ELSE 0 END) mas_90, "
        "SUM(NVL(d.saldo,0)) total_saldo "
        "FROM CXC.TCXC_DOCUMENTO d "
        "JOIN CXC.TCXC_CLIENTE c ON c.no_cia=d.no_cia AND c.no_cliente=d.no_cliente "
        f"WHERE d.no_cia=:1 AND NVL(d.st_anulado,'N')='N' AND NVL(d.saldo,0)<>0{extra} "
        "GROUP BY c.no_cliente, c.nombre, c.vendedor "
        "ORDER BY c.nombre"
    )
    return client.fetch_dicts(sql, params)

def historico_pagos(no_cia: str, no_cliente: str = '', desde: str = '', hasta: str = ''):
    params = [no_cia]
    where = "WHERE d.no_cia=:1 AND NVL(d.st_anulado,'N')='N'"
    n = 2
    if no_cliente:
        where += f" AND d.no_cliente=:{n}"; params.append(no_cliente); n += 1
    if desde:
        where += f" AND d.fecha>=TO_DATE(:{n},'YYYY-MM-DD')"; params.append(desde); n += 1
    if hasta:
        where += f" AND d.fecha<=TO_DATE(:{n},'YYYY-MM-DD')"; params.append(hasta); n += 1
    return client.fetch_dicts(
        f"SELECT d.no_docu no_doc, d.tipo_docu tipo_doc, d.no_cliente, "
        f"c.nombre nombre_cliente, d.fecha, "
        f"NVL(d.valor_original,0) valor, NVL(d.saldo,0) saldo, "
        f"NVL(t.tipo_movi,'DR') tipo_movimiento, d.ncf "
        f"FROM CXC.TCXC_DOCUMENTO d "
        f"LEFT JOIN CXC.TCXC_CLIENTE c ON c.no_cia=d.no_cia AND c.no_cliente=d.no_cliente "
        f"LEFT JOIN CXC.TCXC_TDOCU t ON t.no_cia=d.no_cia AND t.tipo_docu=d.tipo_docu "
        f"{where} ORDER BY d.fecha DESC, d.no_docu DESC",
        params)

def libro_ventas(no_cia: str, desde: str, hasta: str, punto: str = ''):
    params = [no_cia, desde, hasta]
    extra = " AND d.punto=:4" if punto else ""
    if punto:
        params.append(punto)
    return client.fetch_dicts(
        "SELECT d.no_docu no_doc, d.tipo_docu tipo_doc, d.no_cliente, "
        "c.nombre nombre_cliente, c.rnc, d.fecha, "
        "d.ncf, NVL(d.valor_original,0) valor, NVL(d.saldo,0) saldo "
        "FROM CXC.TCXC_DOCUMENTO d "
        "LEFT JOIN CXC.TCXC_CLIENTE c ON c.no_cia=d.no_cia AND c.no_cliente=d.no_cliente "
        "WHERE d.no_cia=:1 AND d.fecha BETWEEN "
        f"TO_DATE(:2,'YYYY-MM-DD') AND TO_DATE(:3,'YYYY-MM-DD'){extra} "
        "ORDER BY d.fecha, d.no_docu",
        params)


# --- REPORTES ----------------------------------------------------------------

def rep_envejecimiento(no_cia: str, punto: str = '', vendedor: str = '',
                       fecha_corte: str = ''):
    params = [no_cia]
    where = "WHERE d.no_cia=:1 AND NVL(d.st_anulado,'N')='N' AND NVL(d.saldo,0)<>0"
    n = 2
    if punto:
        where += f" AND d.punto=:{n}"; params.append(punto); n += 1
    if vendedor:
        where += f" AND c.vendedor=:{n}"; params.append(vendedor); n += 1
    if fecha_corte:
        date_expr = f"TO_DATE(:{n},'YYYY-MM-DD')"
        params.append(fecha_corte)
    else:
        date_expr = "TRUNC(SYSDATE)"
    sql = (
        f"SELECT c.no_cliente, c.nombre nombre_cliente, c.vendedor, "
        f"SUM(CASE WHEN {date_expr}-TRUNC(d.fecha) BETWEEN 0 AND 30 "
        f"     THEN NVL(d.saldo,0) ELSE 0 END) c0, "
        f"SUM(CASE WHEN {date_expr}-TRUNC(d.fecha) BETWEEN 31 AND 60 "
        f"     THEN NVL(d.saldo,0) ELSE 0 END) c30, "
        f"SUM(CASE WHEN {date_expr}-TRUNC(d.fecha) BETWEEN 61 AND 90 "
        f"     THEN NVL(d.saldo,0) ELSE 0 END) c60, "
        f"SUM(CASE WHEN {date_expr}-TRUNC(d.fecha) BETWEEN 91 AND 120 "
        f"     THEN NVL(d.saldo,0) ELSE 0 END) c90, "
        f"SUM(CASE WHEN {date_expr}-TRUNC(d.fecha) > 120 "
        f"     THEN NVL(d.saldo,0) ELSE 0 END) c120, "
        f"SUM(NVL(d.saldo,0)) total "
        f"FROM CXC.TCXC_DOCUMENTO d "
        f"JOIN CXC.TCXC_CLIENTE c ON c.no_cia=d.no_cia AND c.no_cliente=d.no_cliente "
        f"{where} "
        f"GROUP BY c.no_cliente, c.nombre, c.vendedor "
        f"HAVING SUM(NVL(d.saldo,0)) <> 0 "
        f"ORDER BY c.nombre"
    )
    rows = client.fetch_dicts(sql, params)
    total = sum(r.get('total', 0) for r in rows)
    return {'items': rows, 'total': total}

def rep_cobros_vendedor(no_cia: str, desde: str, hasta: str, punto: str = ''):
    params = [no_cia, desde, hasta]
    extra = " AND d.punto=:4" if punto else ""
    if punto:
        params.append(punto)
    rows = client.fetch_dicts(
        "SELECT c.vendedor, v.nombre nombre_vendedor, COUNT(*) cobros, "
        "SUM(NVL(d.valor_original,0)) total_cobrado "
        "FROM CXC.TCXC_DOCUMENTO d "
        "JOIN CXC.TCXC_CLIENTE c ON c.no_cia=d.no_cia AND c.no_cliente=d.no_cliente "
        "LEFT JOIN CXC.TCXC_VENDEDOR v ON v.no_cia=d.no_cia AND v.vendedor=c.vendedor "
        "WHERE d.no_cia=:1 AND NVL(d.st_anulado,'N')='N' "
        f"AND d.fecha BETWEEN TO_DATE(:2,'YYYY-MM-DD') AND TO_DATE(:3,'YYYY-MM-DD'){extra} "
        "GROUP BY c.vendedor, v.nombre ORDER BY c.vendedor",
        params)
    total = sum(r.get('total_cobrado', 0) for r in rows)
    return {'items': rows, 'total': total}

def rep_comisiones(no_cia: str, desde: str, hasta: str, punto: str = ''):
    params = [no_cia, desde, hasta]
    extra = " AND d.punto=:4" if punto else ""
    if punto:
        params.append(punto)
    rows = client.fetch_dicts(
        "SELECT c.vendedor, v.nombre nombre_vendedor, COUNT(*) facturas, "
        "NVL(v.comision,0) porciento, "
        "SUM(NVL(d.valor_original,0)) total_ventas, "
        "SUM(NVL(d.valor_original,0)) * NVL(v.comision,0) / 100 comision "
        "FROM CXC.TCXC_DOCUMENTO d "
        "JOIN CXC.TCXC_CLIENTE c ON c.no_cia=d.no_cia AND c.no_cliente=d.no_cliente "
        "LEFT JOIN CXC.TCXC_VENDEDOR v ON v.no_cia=d.no_cia AND v.vendedor=c.vendedor "
        "WHERE d.no_cia=:1 AND NVL(d.st_anulado,'N')='N' "
        f"AND d.fecha BETWEEN TO_DATE(:2,'YYYY-MM-DD') AND TO_DATE(:3,'YYYY-MM-DD'){extra} "
        "GROUP BY c.vendedor, v.nombre, v.comision ORDER BY c.vendedor",
        params)
    total_comision = sum(r.get('comision', 0) for r in rows)
    return {'items': rows, 'total_comision': total_comision}

def rep_ncf_emitidos(no_cia: str, desde: str, hasta: str, punto: str = ''):
    params = [no_cia, desde, hasta]
    extra = " AND punto=:4" if punto else ""
    if punto:
        params.append(punto)
    rows = client.fetch_dicts(
        "SELECT d.no_docu no_doc, d.tipo_docu tipo_doc, d.no_cliente, "
        "c.nombre nombre_cliente, c.rnc, d.fecha, d.ncf, "
        "NVL(d.valor_original,0) valor, "
        "CASE NVL(d.st_anulado,'N') WHEN 'S' THEN 'R' ELSE 'A' END estado "
        "FROM CXC.TCXC_DOCUMENTO d "
        "LEFT JOIN CXC.TCXC_CLIENTE c ON c.no_cia=d.no_cia AND c.no_cliente=d.no_cliente "
        "WHERE d.no_cia=:1 AND d.ncf IS NOT NULL "
        f"AND d.fecha BETWEEN TO_DATE(:2,'YYYY-MM-DD') AND TO_DATE(:3,'YYYY-MM-DD'){extra} "
        "ORDER BY d.fecha, d.ncf",
        params)
    total = sum(r.get('valor', 0) for r in rows)
    return {'items': rows, 'count': len(rows), 'total': total}


# --- CIERRE ------------------------------------------------------------------

def get_asiento_contable(no_cia: str, punto: str, mes: int, ano: int):
    return client.fetch_dicts(
        "SELECT l.cuenta, l.centro_costo, l.tipo_movi, "
        "SUM(CASE WHEN l.tipo_movi='D' THEN NVL(l.monto,0) ELSE 0 END) total_debito, "
        "SUM(CASE WHEN l.tipo_movi='C' THEN NVL(l.monto,0) ELSE 0 END) total_credito "
        "FROM CXC.TCXC_DCDOCU l "
        "JOIN CXC.TCXC_DOCUMENTO d ON d.no_cia=l.no_cia AND d.no_docu=l.no_docu "
        "WHERE l.no_cia=:1 AND d.punto=:2 "
        "AND EXTRACT(MONTH FROM d.fecha)=:3 AND EXTRACT(YEAR FROM d.fecha)=:4 "
        "AND NVL(d.st_anulado,'N')='N' "
        "GROUP BY l.cuenta, l.centro_costo, l.tipo_movi ORDER BY l.cuenta",
        [no_cia, punto, mes, ano])

def generar_asiento_mayor(no_cia: str, punto: str, mes_proceso: int,
                          ano_proceso: int, cierre_fiscal: bool = False):
    # Mark all CXC documents for this period as posted to CNT
    with client.cursor() as cur:
        cur.execute(
            "UPDATE CXC.TCXC_DOCUMENTO SET st_generado_cnt='S' "
            "WHERE no_cia=:1 AND punto=:2 "
            "AND EXTRACT(MONTH FROM fecha)=:3 AND EXTRACT(YEAR FROM fecha)=:4 "
            "AND NVL(st_anulado,'N')='N' AND NVL(st_generado_cnt,'N')='N'",
            [no_cia, punto, mes_proceso, ano_proceso])
        cur.connection.commit()
    return {'ok': True}

def list_periodos_generados(no_cia: str, punto: str, limit: int = 24):
    """Historico de periodos cuyo asiento contable ya fue generado.
    Como CxC no tiene tabla de cierres, derivamos el historial de
    TCXC_DOCUMENTO agrupando por (ano, mes) donde st_generado_cnt='S'.
    """
    return client.fetch_dicts(
        "SELECT * FROM ("
        "  SELECT EXTRACT(YEAR FROM d.fecha) AS ano, "
        "         EXTRACT(MONTH FROM d.fecha) AS mes, "
        "         COUNT(*) AS documentos, "
        "         SUM(CASE WHEN l.tipo_movi='D' THEN NVL(l.monto,0) ELSE 0 END) AS total_debito, "
        "         SUM(CASE WHEN l.tipo_movi='C' THEN NVL(l.monto,0) ELSE 0 END) AS total_credito, "
        "         MIN(d.fecha) AS fecha_desde, "
        "         MAX(d.fecha) AS fecha_hasta "
        "  FROM CXC.TCXC_DOCUMENTO d "
        "  LEFT JOIN CXC.TCXC_DCDOCU l ON l.no_cia=d.no_cia AND l.no_docu=d.no_docu "
        "  WHERE d.no_cia=:1 AND d.punto=:2 "
        "  AND NVL(d.st_generado_cnt,'N')='S' AND NVL(d.st_anulado,'N')='N' "
        "  GROUP BY EXTRACT(YEAR FROM d.fecha), EXTRACT(MONTH FROM d.fecha) "
        "  ORDER BY 1 DESC, 2 DESC"
        ") WHERE ROWNUM <= :3",
        [no_cia, punto, limit])


def cierre_cxc(no_cia: str, punto: str):
    row = client.fetch_one(
        "SELECT NVL(mes_proceso,1), NVL(ano_proceso,2025) "
        "FROM CXC.TCXC_PUNTO WHERE no_cia=:1 AND punto=:2",
        [no_cia, punto])
    if not row:
        raise ValueError('Punto no encontrado')
    mes, ano = row
    if mes == 12:
        nuevo_mes, nuevo_ano = 1, ano + 1
    else:
        nuevo_mes, nuevo_ano = mes + 1, ano
    with client.cursor() as cur:
        cur.execute(
            "UPDATE CXC.TCXC_PUNTO SET mes_proceso=:1, ano_proceso=:2 "
            "WHERE no_cia=:3 AND punto=:4",
            [nuevo_mes, nuevo_ano, no_cia, punto])
        cur.connection.commit()
    return {'mes': nuevo_mes, 'ano': nuevo_ano}
