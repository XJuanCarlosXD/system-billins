"""Caja Chica (ACC) — repo de lectura/escritura.

Tablas Oracle (esquema ACC):
- TACC_CIAS, TACC_PUNTO, TACC_USUARIO        configuración
- TACC_CAJA_CHICA                            cajas registradas por punto
- TACC_BENEFICIARIO / TACC_TBENEFICIARIO     beneficiarios + tipos
- TACC_TGASTOS                               tipos de gasto con cuenta contable
- TACC_DOCUMENTO / TACC_DCDOCU               documentos (egresos) + detalle contable
- TACC_REPOSICION                            reposiciones de caja con cheque/NCF
- TACC_CIERRE                                cierre mensual
"""
from __future__ import annotations

from datetime import date
from .. import client


# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------

def list_cias() -> list[dict]:
    return client.fetch_dicts(
        "SELECT no_cia, descripcion, registro_cont, activa "
        "FROM ACC.TACC_CIAS ORDER BY no_cia"
    )


def upsert_cia(no_cia: str, descripcion: str, registro_cont: str = 'N',
               activa: str = 'S') -> None:
    rows = client.fetch_dicts(
        "SELECT 1 FROM ACC.TACC_CIAS WHERE no_cia=:1", [no_cia]
    )
    if rows:
        client.execute(
            "UPDATE ACC.TACC_CIAS SET descripcion=:1, registro_cont=:2, activa=:3 "
            "WHERE no_cia=:4",
            [descripcion, registro_cont, activa, no_cia],
        )
    else:
        client.execute(
            "INSERT INTO ACC.TACC_CIAS (no_cia, descripcion, registro_cont, activa) "
            "VALUES (:1, :2, :3, :4)",
            [no_cia, descripcion, registro_cont, activa],
        )


def list_puntos(no_cia: str) -> list[dict]:
    return client.fetch_dicts(
        "SELECT no_cia, punto, descripcion, activo, ano_proceso, mes_proceso, "
        "       mes_cierre, prox_documento, prox_reposicion "
        "FROM ACC.TACC_PUNTO WHERE no_cia=:1 ORDER BY punto",
        [no_cia],
    )


# ---------------------------------------------------------------------------
# Cajas
# ---------------------------------------------------------------------------

def list_cajas_chicas(no_cia: str, punto: str | None = None) -> list[dict]:
    sql = (
        "SELECT no_cia, punto, no_caja, descripcion, fecha, cuenta, cuenta_prima, "
        "       moneda, monto, monto_mayor, activa, controlar_cc, usuario, "
        "       reponer_con_dife, codigo_ncf "
        "FROM ACC.TACC_CAJA_CHICA WHERE no_cia=:1"
    )
    params: list = [no_cia]
    if punto:
        sql += f" AND punto=:{len(params)+1}"; params.append(punto)
    sql += " ORDER BY no_caja"
    return client.fetch_dicts(sql, params)


def get_caja_chica(no_cia: str, punto: str, no_caja: str) -> dict | None:
    rows = list_cajas_chicas(no_cia, punto)
    return next((r for r in rows if r['no_caja'] == no_caja), None)


def upsert_caja_chica(data: dict) -> None:
    existing = get_caja_chica(data['no_cia'], data['punto'], data['no_caja'])
    if existing:
        client.execute(
            "UPDATE ACC.TACC_CAJA_CHICA SET descripcion=:1, cuenta=:2, "
            " cuenta_prima=:3, moneda=:4, monto=:5, monto_mayor=:6, activa=:7, "
            " controlar_cc=:8, reponer_con_dife=:9, codigo_ncf=:10 "
            " WHERE no_cia=:11 AND punto=:12 AND no_caja=:13",
            [
                data['descripcion'], data['cuenta'], data.get('cuenta_prima'),
                data.get('moneda', 'DOP'), float(data['monto']),
                float(data.get('monto_mayor', 0)), data.get('activa', 'S'),
                data.get('controlar_cc', 'S'),
                data.get('reponer_con_dife', 'N'), data.get('codigo_ncf'),
                data['no_cia'], data['punto'], data['no_caja'],
            ],
        )
    else:
        client.execute(
            "INSERT INTO ACC.TACC_CAJA_CHICA ("
            " no_cia, punto, no_caja, descripcion, fecha, cuenta, cuenta_prima, "
            " moneda, monto, monto_mayor, activa, controlar_cc, usuario, "
            " reponer_con_dife, codigo_ncf"
            ") VALUES ("
            " :1, :2, :3, :4, SYSDATE, :5, :6, :7, :8, :9, :10, :11, :12, :13, :14)",
            [
                data['no_cia'], data['punto'], data['no_caja'],
                data['descripcion'], data['cuenta'], data.get('cuenta_prima'),
                data.get('moneda', 'DOP'), float(data['monto']),
                float(data.get('monto_mayor', 0)), data.get('activa', 'S'),
                data.get('controlar_cc', 'S'), data.get('usuario'),
                data.get('reponer_con_dife', 'N'), data.get('codigo_ncf'),
            ],
        )


# ---------------------------------------------------------------------------
# Beneficiarios / Tipos
# ---------------------------------------------------------------------------

def list_beneficiarios(activo: str = 'S', search: str = '') -> list[dict]:
    sql = (
        "SELECT b.no_bene, b.tipo_bene, t.descripcion AS tipo_desc, b.nombre, "
        "       b.fecha, b.usuario, b.activo, b.rnc "
        "  FROM ACC.TACC_BENEFICIARIO b "
        "  LEFT JOIN ACC.TACC_TBENEFICIARIO t ON t.tipo_bene = b.tipo_bene "
        " WHERE 1=1"
    )
    params: list = []
    if activo:
        sql += f" AND b.activo=:{len(params)+1}"; params.append(activo)
    if search:
        sql += (f" AND (UPPER(b.nombre) LIKE UPPER(:{len(params)+1}) "
                f"      OR b.no_bene LIKE :{len(params)+1}"
                f"      OR b.rnc LIKE :{len(params)+1})")
        params.append(f"%{search}%")
    sql += " ORDER BY b.nombre"
    return client.fetch_dicts(sql, params)


def count_beneficiarios(no_cia: str | None = None) -> int:
    row = client.fetch_one("SELECT COUNT(*) FROM ACC.TACC_BENEFICIARIO")
    return int(row[0]) if row else 0


def list_tipos_bene() -> list[dict]:
    return client.fetch_dicts(
        "SELECT tipo_bene, descripcion, activo FROM ACC.TACC_TBENEFICIARIO ORDER BY tipo_bene"
    )


def list_tipos_gasto() -> list[dict]:
    return client.fetch_dicts(
        "SELECT tipo_gasto, descripcion, activo, cuenta, centro_costo "
        "FROM ACC.TACC_TGASTOS ORDER BY tipo_gasto"
    )


# ---------------------------------------------------------------------------
# Documentos (egresos)
# ---------------------------------------------------------------------------

def list_documentos(no_cia: str, punto: str | None = None,
                    no_caja: str | None = None,
                    fecha_desde: str | None = None,
                    fecha_hasta: str | None = None,
                    anulado: str | None = None,
                    limit: int = 200) -> list[dict]:
    sql = (
        "SELECT d.no_cia, d.punto, d.no_docu, d.no_caja, d.no_bene, "
        "       b.nombre nombre_bene, d.tipo_gasto, t.descripcion desc_gasto, "
        "       d.no_reposicion, d.fecha, d.anulado, d.valor, d.debito, d.credito, "
        "       d.usuario, d.moneda, d.no_formulario, d.cuenta, "
        "       d.st_generado_cnt, d.detalle, d.impuesto, d.ncf, d.rnc "
        "  FROM ACC.TACC_DOCUMENTO d "
        "  LEFT JOIN ACC.TACC_BENEFICIARIO b ON b.no_bene = d.no_bene "
        "  LEFT JOIN ACC.TACC_TGASTOS t ON t.tipo_gasto = d.tipo_gasto "
        " WHERE d.no_cia=:1"
    )
    params: list = [no_cia]
    if punto:
        sql += f" AND d.punto=:{len(params)+1}"; params.append(punto)
    if no_caja:
        sql += f" AND d.no_caja=:{len(params)+1}"; params.append(no_caja)
    if anulado:
        sql += f" AND d.anulado=:{len(params)+1}"; params.append(anulado)
    if fecha_desde:
        sql += f" AND TRUNC(d.fecha) >= TO_DATE(:{len(params)+1},'YYYY-MM-DD')"; params.append(fecha_desde)
    if fecha_hasta:
        sql += f" AND TRUNC(d.fecha) <= TO_DATE(:{len(params)+1},'YYYY-MM-DD')"; params.append(fecha_hasta)
    sql += " ORDER BY d.fecha DESC, d.no_docu DESC"
    if limit:
        sql = f"SELECT * FROM ({sql}) WHERE ROWNUM <= {int(limit)}"
    return client.fetch_dicts(sql, params)


def get_documento(no_cia: str, punto: str, no_docu: str) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT d.*, b.nombre nombre_bene, t.descripcion desc_gasto "
        "  FROM ACC.TACC_DOCUMENTO d "
        "  LEFT JOIN ACC.TACC_BENEFICIARIO b ON b.no_bene = d.no_bene "
        "  LEFT JOIN ACC.TACC_TGASTOS t ON t.tipo_gasto = d.tipo_gasto "
        " WHERE d.no_cia=:1 AND d.punto=:2 AND d.no_docu=:3",
        [no_cia, punto, no_docu],
    )
    return rows[0] if rows else None


def list_lineas_documento(no_cia: str, punto: str, no_docu: str) -> list[dict]:
    return client.fetch_dicts(
        "SELECT cuenta, centro_costo, tipo_movi, no_caja, monto, "
        "       ano_asiento, mes_asiento, no_asiento, no_componente "
        "  FROM ACC.TACC_DCDOCU "
        " WHERE no_cia=:1 AND punto=:2 AND no_docu=:3",
        [no_cia, punto, no_docu],
    )


def next_no_documento(no_cia: str, punto: str) -> str:
    row = client.fetch_one(
        "SELECT NVL(prox_documento,1) FROM ACC.TACC_PUNTO "
        "WHERE no_cia=:1 AND punto=:2 FOR UPDATE",
        [no_cia, punto],
    )
    prox = int(row[0]) if row else 1
    client.execute(
        "UPDATE ACC.TACC_PUNTO SET prox_documento = NVL(prox_documento,0)+1 "
        "WHERE no_cia=:1 AND punto=:2",
        [no_cia, punto],
    )
    return str(prox).zfill(8)


def crear_documento(no_cia: str, punto: str, data: dict, usuario: str) -> str:
    """Crea egreso de caja chica. Genera línea contable básica en DCDOCU."""
    no_docu = next_no_documento(no_cia, punto)
    fecha = data.get('fecha') or date.today().isoformat()
    valor = float(data['valor'])

    client.execute(
        "INSERT INTO ACC.TACC_DOCUMENTO ("
        " no_cia, punto, no_docu, no_caja, no_bene, tipo_gasto, fecha, "
        " anulado, valor, debito, credito, usuario, moneda, cuenta, "
        " st_generado_cnt, detalle, impuesto, ncf, rnc, tipo_gasto_dgii, "
        " forma_pago, no_formulario"
        ") VALUES ("
        " :1, :2, :3, :4, :5, :6, TO_DATE(:7,'YYYY-MM-DD'), "
        " 'N', :8, :8, 0, :9, :10, :11, "
        " 'N', :12, :13, :14, :15, :16, :17, :18)",
        [
            no_cia, punto, no_docu, data['no_caja'], data['no_bene'],
            data['tipo_gasto'], fecha, valor, usuario,
            data.get('moneda', 'DOP'), data['cuenta'], data.get('detalle'),
            float(data.get('impuesto', 0)),
            data.get('ncf'), data.get('rnc'),
            data.get('tipo_gasto_dgii'),
            int(data.get('forma_pago', 1)),
            data.get('no_formulario'),
        ],
    )
    # Línea contable: débito al tipo_gasto.cuenta, crédito al cuenta de caja
    cuenta_gasto = data.get('cuenta_gasto') or data['cuenta']
    client.execute(
        "INSERT INTO ACC.TACC_DCDOCU "
        "(no_cia, punto, no_docu, cuenta, centro_costo, tipo_movi, no_caja, "
        " monto, afecta_presupuesto) VALUES (:1,:2,:3,:4,:5,'D',:6,:7,'S')",
        [no_cia, punto, no_docu, cuenta_gasto,
         data.get('centro_costo', '0000000000'), data['no_caja'], valor],
    )
    client.execute(
        "INSERT INTO ACC.TACC_DCDOCU "
        "(no_cia, punto, no_docu, cuenta, centro_costo, tipo_movi, no_caja, "
        " monto, afecta_presupuesto) VALUES (:1,:2,:3,:4,:5,'C',:6,:7,'S')",
        [no_cia, punto, no_docu, data['cuenta'], '0000000000',
         data['no_caja'], valor],
    )
    return no_docu


def anular_documento(no_cia: str, punto: str, no_docu: str, motivo: str = '') -> None:
    client.execute(
        "UPDATE ACC.TACC_DOCUMENTO SET anulado='S', "
        " detalle = SUBSTR(NVL(detalle,'')||' [ANULADO: '||:1||']',1,2000) "
        " WHERE no_cia=:2 AND punto=:3 AND no_docu=:4",
        [motivo or 'sin motivo', no_cia, punto, no_docu],
    )


# ---------------------------------------------------------------------------
# Reposiciones
# ---------------------------------------------------------------------------

def list_reposiciones(no_cia: str, punto: str | None = None,
                      no_caja: str | None = None,
                      fecha_desde: str | None = None,
                      fecha_hasta: str | None = None,
                      limit: int = 200) -> list[dict]:
    sql = (
        "SELECT no_cia, punto, no_reposicion, no_caja, fecha, tipo_docu_chc, "
        "       no_docu_chc, cuenta_banco, no_cheque, detalle, monto_cc, "
        "       valor_reposicion, efectivo, valor_compro_prov, usuario, ncf, "
        "       valor_ncf, anulada_por, fecha_anulacion, motivo_anulacion "
        "  FROM ACC.TACC_REPOSICION WHERE no_cia=:1"
    )
    params: list = [no_cia]
    if punto:
        sql += f" AND punto=:{len(params)+1}"; params.append(punto)
    if no_caja:
        sql += f" AND no_caja=:{len(params)+1}"; params.append(no_caja)
    if fecha_desde:
        sql += f" AND TRUNC(fecha) >= TO_DATE(:{len(params)+1},'YYYY-MM-DD')"; params.append(fecha_desde)
    if fecha_hasta:
        sql += f" AND TRUNC(fecha) <= TO_DATE(:{len(params)+1},'YYYY-MM-DD')"; params.append(fecha_hasta)
    sql += " ORDER BY fecha DESC, no_reposicion DESC"
    if limit:
        sql = f"SELECT * FROM ({sql}) WHERE ROWNUM <= {int(limit)}"
    return client.fetch_dicts(sql, params)


# ---------------------------------------------------------------------------
# Reportes
# ---------------------------------------------------------------------------

def rep_resumen(no_cia: str, punto: str | None = None,
                fecha_desde: str | None = None,
                fecha_hasta: str | None = None) -> dict:
    sql = (
        "SELECT COUNT(*) total_docs, "
        "       SUM(CASE WHEN anulado='S' THEN 1 ELSE 0 END) anulados, "
        "       NVL(SUM(CASE WHEN anulado<>'S' THEN valor ELSE 0 END),0) monto_total, "
        "       NVL(SUM(CASE WHEN anulado<>'S' THEN impuesto ELSE 0 END),0) impuesto_total "
        "  FROM ACC.TACC_DOCUMENTO WHERE no_cia=:1"
    )
    params: list = [no_cia]
    if punto:
        sql += f" AND punto=:{len(params)+1}"; params.append(punto)
    if fecha_desde:
        sql += f" AND TRUNC(fecha) >= TO_DATE(:{len(params)+1},'YYYY-MM-DD')"; params.append(fecha_desde)
    if fecha_hasta:
        sql += f" AND TRUNC(fecha) <= TO_DATE(:{len(params)+1},'YYYY-MM-DD')"; params.append(fecha_hasta)
    rows = client.fetch_dicts(sql, params)
    return rows[0] if rows else {}


def rep_gastos_por_tipo(no_cia: str, punto: str | None = None,
                        fecha_desde: str | None = None,
                        fecha_hasta: str | None = None) -> list[dict]:
    sql = (
        "SELECT t.tipo_gasto, t.descripcion, t.cuenta, t.centro_costo, "
        "       COUNT(d.no_docu) cantidad, NVL(SUM(d.valor),0) total "
        "  FROM ACC.TACC_TGASTOS t "
        "  LEFT JOIN ACC.TACC_DOCUMENTO d ON d.tipo_gasto=t.tipo_gasto AND d.no_cia=:1 "
        " WHERE 1=1"
    )
    params: list = [no_cia]
    if punto:
        sql += f" AND (d.punto=:{len(params)+1} OR d.punto IS NULL)"; params.append(punto)
    if fecha_desde:
        sql += f" AND (TRUNC(d.fecha) >= TO_DATE(:{len(params)+1},'YYYY-MM-DD') OR d.fecha IS NULL)"; params.append(fecha_desde)
    if fecha_hasta:
        sql += f" AND (TRUNC(d.fecha) <= TO_DATE(:{len(params)+1},'YYYY-MM-DD') OR d.fecha IS NULL)"; params.append(fecha_hasta)
    sql += (" AND (d.anulado<>'S' OR d.anulado IS NULL) "
            " GROUP BY t.tipo_gasto, t.descripcion, t.cuenta, t.centro_costo "
            " ORDER BY total DESC")
    return client.fetch_dicts(sql, params)


# ---------------------------------------------------------------------------
# Reposiciones — CRUD + helpers
# ---------------------------------------------------------------------------

def get_reposicion(no_cia: str, punto: str, no_reposicion: str) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT r.*, c.descripcion AS desc_caja "
        "  FROM ACC.TACC_REPOSICION r "
        "  LEFT JOIN ACC.TACC_CAJA_CHICA c "
        "         ON c.no_cia=r.no_cia AND c.punto=r.punto AND c.no_caja=r.no_caja "
        " WHERE r.no_cia=:1 AND r.punto=:2 AND r.no_reposicion=:3",
        [no_cia, punto, no_reposicion],
    )
    return rows[0] if rows else None


def list_docs_reposicion(no_cia: str, punto: str, no_reposicion: str) -> list[dict]:
    """Documentos (egresos) que pertenecen a una reposición."""
    return client.fetch_dicts(
        "SELECT d.no_docu, d.fecha, d.no_bene, b.nombre AS nombre_bene, "
        "       d.tipo_gasto, t.descripcion AS desc_gasto, d.valor, "
        "       d.impuesto, d.ncf, d.rnc, d.detalle, d.no_caja "
        "  FROM ACC.TACC_DOCUMENTO d "
        "  LEFT JOIN ACC.TACC_BENEFICIARIO b ON b.no_bene = d.no_bene "
        "  LEFT JOIN ACC.TACC_TGASTOS t ON t.tipo_gasto = d.tipo_gasto "
        " WHERE d.no_cia=:1 AND d.punto=:2 AND d.no_reposicion=:3 "
        " ORDER BY d.fecha, d.no_docu",
        [no_cia, punto, no_reposicion],
    )


def list_docs_pendientes_reposicion(no_cia: str, punto: str,
                                    no_caja: str | None = None) -> list[dict]:
    """Egresos no anulados, sin reposición asignada — candidatos a reponer."""
    sql = (
        "SELECT d.no_docu, d.fecha, d.no_bene, b.nombre nombre_bene, "
        "       d.tipo_gasto, t.descripcion desc_gasto, d.valor, d.impuesto, "
        "       d.ncf, d.rnc, d.detalle, d.no_caja "
        "  FROM ACC.TACC_DOCUMENTO d "
        "  LEFT JOIN ACC.TACC_BENEFICIARIO b ON b.no_bene = d.no_bene "
        "  LEFT JOIN ACC.TACC_TGASTOS t ON t.tipo_gasto = d.tipo_gasto "
        " WHERE d.no_cia=:1 AND d.punto=:2 "
        "   AND (d.anulado<>'S' OR d.anulado IS NULL) "
        "   AND d.no_reposicion IS NULL"
    )
    params: list = [no_cia, punto]
    if no_caja:
        sql += f" AND d.no_caja=:{len(params)+1}"; params.append(no_caja)
    sql += " ORDER BY d.fecha, d.no_docu"
    return client.fetch_dicts(sql, params)


def next_no_reposicion(no_cia: str, punto: str) -> str:
    row = client.fetch_one(
        "SELECT NVL(prox_reposicion,1) FROM ACC.TACC_PUNTO "
        "WHERE no_cia=:1 AND punto=:2 FOR UPDATE",
        [no_cia, punto],
    )
    prox = int(row[0]) if row else 1
    client.execute(
        "UPDATE ACC.TACC_PUNTO SET prox_reposicion = NVL(prox_reposicion,0)+1 "
        "WHERE no_cia=:1 AND punto=:2",
        [no_cia, punto],
    )
    return str(prox).zfill(8)


def crear_reposicion(no_cia: str, punto: str, data: dict, usuario: str) -> str:
    """Crea reposición y vincula los documentos seleccionados.

    data debe traer:
      no_caja, fecha, cuenta_banco, no_cheque, detalle, monto_cc,
      valor_reposicion, efectivo, ncf, valor_ncf, forma_pago, posiciones_fijas_ncf
      docs: [no_docu, ...]
    """
    no_rep = next_no_reposicion(no_cia, punto)
    fecha = data.get('fecha') or date.today().isoformat()
    docs = data.get('docs') or []

    client.execute(
        "INSERT INTO ACC.TACC_REPOSICION ("
        " no_cia, punto, no_reposicion, no_caja, fecha, tipo_docu_chc, "
        " no_docu_chc, cuenta_banco, no_cheque, detalle, monto_cc, "
        " valor_reposicion, efectivo, valor_compro_prov, usuario, "
        " ncf, valor_ncf, forma_pago, posiciones_fijas_ncf, tipo_gasto_dgii, "
        " valor_bienes, valor_servicio, isc, otros_impuestos, propina"
        ") VALUES ("
        " :1, :2, :3, :4, TO_DATE(:5,'YYYY-MM-DD'), :6, :7, :8, :9, :10, "
        " :11, :12, :13, :14, :15, :16, :17, :18, :19, :20, :21, :22, :23, :24, :25)",
        [
            no_cia, punto, no_rep, data['no_caja'], fecha,
            data.get('tipo_docu_chc') or 'CC', data.get('no_docu_chc'),
            data.get('cuenta_banco'), data.get('no_cheque'),
            data.get('detalle'),
            float(data.get('monto_cc', 0)),
            float(data['valor_reposicion']),
            float(data.get('efectivo', 0)),
            float(data.get('valor_compro_prov', 0)),
            usuario,
            data.get('ncf'),
            float(data.get('valor_ncf', 0)),
            int(data.get('forma_pago', 1)),
            data.get('posiciones_fijas_ncf'),
            data.get('tipo_gasto_dgii'),
            float(data.get('valor_bienes', 0)),
            float(data.get('valor_servicio', 0)),
            float(data.get('isc', 0)),
            float(data.get('otros_impuestos', 0)),
            float(data.get('propina', 0)),
        ],
    )
    # vincula los documentos seleccionados
    for nd in docs:
        client.execute(
            "UPDATE ACC.TACC_DOCUMENTO SET no_reposicion=:1 "
            " WHERE no_cia=:2 AND punto=:3 AND no_docu=:4",
            [no_rep, no_cia, punto, nd],
        )
    return no_rep


def anular_reposicion(no_cia: str, punto: str, no_reposicion: str,
                      motivo: str = '', usuario: str = '') -> None:
    """Anula la reposición y libera los documentos para una nueva."""
    client.execute(
        "UPDATE ACC.TACC_REPOSICION SET anulada_por=:1, "
        " fecha_anulacion=SYSDATE, motivo_anulacion=SUBSTR(:2,1,200) "
        " WHERE no_cia=:3 AND punto=:4 AND no_reposicion=:5",
        [usuario or 'API', motivo or 'sin motivo', no_cia, punto, no_reposicion],
    )
    client.execute(
        "UPDATE ACC.TACC_DOCUMENTO SET no_reposicion=NULL "
        " WHERE no_cia=:1 AND punto=:2 AND no_reposicion=:3",
        [no_cia, punto, no_reposicion],
    )


# ---------------------------------------------------------------------------
# Asiento contable (TACC_DCDOCU agrupado por cuenta/centro_costo/tipo_movi)
# ---------------------------------------------------------------------------

def preview_asiento(no_cia: str, punto: str, ano: int, mes: int) -> dict:
    """Resumen contable del período: débito/crédito por cuenta del mes."""
    rows = client.fetch_dicts(
        "SELECT dc.cuenta, dc.centro_costo, dc.tipo_movi, "
        "       SUM(dc.monto) AS monto, "
        "       cat.nombre AS desc_cuenta "
        "  FROM ACC.TACC_DCDOCU dc "
        "  JOIN ACC.TACC_DOCUMENTO d "
        "       ON d.no_cia=dc.no_cia AND d.punto=dc.punto AND d.no_docu=dc.no_docu "
        "  LEFT JOIN CNT.TCNT_CATALOGO cat ON cat.cuenta=dc.cuenta "
        " WHERE dc.no_cia=:1 AND dc.punto=:2 "
        "   AND (d.anulado<>'S' OR d.anulado IS NULL) "
        "   AND (d.st_generado_cnt='N' OR d.st_generado_cnt IS NULL) "
        "   AND TO_CHAR(d.fecha,'YYYY')=:3 AND TO_CHAR(d.fecha,'MM')=:4 "
        " GROUP BY dc.cuenta, dc.centro_costo, dc.tipo_movi, cat.nombre "
        " ORDER BY dc.cuenta, dc.tipo_movi",
        [no_cia, punto, str(ano), str(mes).zfill(2)],
    )
    total_db = sum(float(r.get('monto') or 0) for r in rows if r.get('tipo_movi') == 'D')
    total_cr = sum(float(r.get('monto') or 0) for r in rows if r.get('tipo_movi') == 'C')
    cuenta_docs = client.fetch_one(
        "SELECT COUNT(DISTINCT d.no_docu) FROM ACC.TACC_DOCUMENTO d "
        " WHERE d.no_cia=:1 AND d.punto=:2 "
        "   AND (d.anulado<>'S' OR d.anulado IS NULL) "
        "   AND (d.st_generado_cnt='N' OR d.st_generado_cnt IS NULL) "
        "   AND TO_CHAR(d.fecha,'YYYY')=:3 AND TO_CHAR(d.fecha,'MM')=:4",
        [no_cia, punto, str(ano), str(mes).zfill(2)],
    )
    return {
        'lineas': rows,
        'total_debito': total_db,
        'total_credito': total_cr,
        'cuadra': abs(total_db - total_cr) < 0.01,
        'documentos': int(cuenta_docs[0]) if cuenta_docs else 0,
    }


def generar_asiento(no_cia: str, punto: str, ano: int, mes: int) -> dict:
    """Marca los documentos del período como generados a contabilidad."""
    rc = client.execute(
        "UPDATE ACC.TACC_DOCUMENTO SET st_generado_cnt='S' "
        " WHERE no_cia=:1 AND punto=:2 "
        "   AND (anulado<>'S' OR anulado IS NULL) "
        "   AND (st_generado_cnt='N' OR st_generado_cnt IS NULL) "
        "   AND TO_CHAR(fecha,'YYYY')=:3 AND TO_CHAR(fecha,'MM')=:4",
        [no_cia, punto, str(ano), str(mes).zfill(2)],
    )
    return {'documentos_actualizados': rc}


# ---------------------------------------------------------------------------
# Cierre mensual
# ---------------------------------------------------------------------------

def list_cierres(no_cia: str, punto: str, ano: int | None = None) -> list[dict]:
    sql = (
        "SELECT no_cia, punto, ano, mes, "
        "       TO_CHAR(fecha_cierre,'YYYY-MM-DD HH24:MI:SS') fecha_cierre, "
        "       usuario "
        "  FROM ACC.TACC_CIERRE WHERE no_cia=:1 AND punto=:2"
    )
    params: list = [no_cia, punto]
    if ano:
        sql += f" AND ano=:{len(params)+1}"; params.append(int(ano))
    sql += " ORDER BY ano DESC, mes DESC"
    return client.fetch_dicts(sql, params)


def cierre_status(no_cia: str, punto: str) -> dict:
    """Período activo del punto + documentos pendientes / no generados."""
    p = client.fetch_dicts(
        "SELECT no_cia, punto, ano_proceso, mes_proceso, mes_cierre, descripcion "
        "  FROM ACC.TACC_PUNTO WHERE no_cia=:1 AND punto=:2",
        [no_cia, punto],
    )
    if not p:
        return {'error': 'punto no encontrado'}
    cab = p[0]
    ano = int(cab['ano_proceso']); mes = int(cab['mes_proceso'])
    pend = client.fetch_one(
        "SELECT COUNT(*) FROM ACC.TACC_DOCUMENTO "
        " WHERE no_cia=:1 AND punto=:2 "
        "   AND (anulado<>'S' OR anulado IS NULL) "
        "   AND (st_generado_cnt='N' OR st_generado_cnt IS NULL) "
        "   AND TO_CHAR(fecha,'YYYY')=:3 AND TO_CHAR(fecha,'MM')=:4",
        [no_cia, punto, str(ano), str(mes).zfill(2)],
    )
    sin_rep = client.fetch_one(
        "SELECT COUNT(*) FROM ACC.TACC_DOCUMENTO "
        " WHERE no_cia=:1 AND punto=:2 "
        "   AND (anulado<>'S' OR anulado IS NULL) "
        "   AND no_reposicion IS NULL "
        "   AND TO_CHAR(fecha,'YYYY')=:3 AND TO_CHAR(fecha,'MM')=:4",
        [no_cia, punto, str(ano), str(mes).zfill(2)],
    )
    return {
        'punto': cab,
        'documentos_sin_contabilizar': int(pend[0]) if pend else 0,
        'documentos_sin_reposicion': int(sin_rep[0]) if sin_rep else 0,
    }


def aplicar_cierre(no_cia: str, punto: str, usuario: str) -> dict:
    """Cierra el mes actual: insert TACC_CIERRE + avanza mes_proceso."""
    p = client.fetch_dicts(
        "SELECT ano_proceso, mes_proceso, mes_cierre "
        "  FROM ACC.TACC_PUNTO WHERE no_cia=:1 AND punto=:2",
        [no_cia, punto],
    )
    if not p:
        raise ValueError('punto no existe')
    ano = int(p[0]['ano_proceso']); mes = int(p[0]['mes_proceso'])
    mes_cierre = int(p[0]['mes_cierre'] or 12)
    ya = client.fetch_one(
        "SELECT 1 FROM ACC.TACC_CIERRE "
        " WHERE no_cia=:1 AND punto=:2 AND ano=:3 AND mes=:4",
        [no_cia, punto, ano, mes],
    )
    if ya:
        raise ValueError(f'período {mes:02d}/{ano} ya está cerrado')
    pend = client.fetch_one(
        "SELECT COUNT(*) FROM ACC.TACC_DOCUMENTO "
        " WHERE no_cia=:1 AND punto=:2 "
        "   AND (anulado<>'S' OR anulado IS NULL) "
        "   AND (st_generado_cnt='N' OR st_generado_cnt IS NULL) "
        "   AND TO_CHAR(fecha,'YYYY')=:3 AND TO_CHAR(fecha,'MM')=:4",
        [no_cia, punto, str(ano), str(mes).zfill(2)],
    )
    if pend and int(pend[0]) > 0:
        raise ValueError(
            f'hay {int(pend[0])} documentos sin contabilizar en {mes:02d}/{ano}; '
            'genere el asiento antes de cerrar.'
        )
    client.execute(
        "INSERT INTO ACC.TACC_CIERRE "
        "(no_cia, punto, ano, mes, fecha_cierre, fecha_sysdate, usuario) "
        "VALUES (:1, :2, :3, :4, SYSDATE, SYSDATE, :5)",
        [no_cia, punto, ano, mes, (usuario or 'API')[:30]],
    )
    if mes == mes_cierre:
        nuevo_ano = ano + 1; nuevo_mes = 1
    else:
        nuevo_ano = ano; nuevo_mes = mes + 1
    client.execute(
        "UPDATE ACC.TACC_PUNTO SET ano_proceso=:1, mes_proceso=:2 "
        "WHERE no_cia=:3 AND punto=:4",
        [nuevo_ano, nuevo_mes, no_cia, punto],
    )
    return {'cerrado': f'{mes:02d}/{ano}', 'nuevo_periodo': f'{nuevo_mes:02d}/{nuevo_ano}'}


# ---------------------------------------------------------------------------
# CRUD complementario (beneficiarios, tipos_gasto, tipos_bene)
# ---------------------------------------------------------------------------

def upsert_beneficiario(data: dict, usuario: str) -> str:
    no_bene = (data.get('no_bene') or '').strip()
    if no_bene:
        ex = client.fetch_one(
            "SELECT 1 FROM ACC.TACC_BENEFICIARIO WHERE no_bene=:1", [no_bene]
        )
    else:
        ex = None
    if ex:
        client.execute(
            "UPDATE ACC.TACC_BENEFICIARIO SET nombre=:1, tipo_bene=:2, "
            " activo=:3, rnc=:4 WHERE no_bene=:5",
            [data['nombre'], data['tipo_bene'], data.get('activo', 'S'),
             data.get('rnc'), no_bene],
        )
        return no_bene
    if not no_bene:
        row = client.fetch_one(
            "SELECT NVL(prox_bene,1) FROM ACC.TACC_PROX_BENE FOR UPDATE"
        )
        prox = int(row[0]) if row else 1
        client.execute(
            "UPDATE ACC.TACC_PROX_BENE SET prox_bene=NVL(prox_bene,0)+1"
        )
        no_bene = str(prox).zfill(6)
    client.execute(
        "INSERT INTO ACC.TACC_BENEFICIARIO "
        "(no_bene, tipo_bene, nombre, fecha, usuario, activo, rnc) "
        "VALUES (:1, :2, :3, SYSDATE, :4, :5, :6)",
        [no_bene, data['tipo_bene'], data['nombre'], (usuario or '')[:30],
         data.get('activo', 'S'), data.get('rnc')],
    )
    return no_bene


def upsert_tipo_gasto(data: dict) -> str:
    tg = (data['tipo_gasto'] or '').strip().upper()
    ex = client.fetch_one(
        "SELECT 1 FROM ACC.TACC_TGASTOS WHERE tipo_gasto=:1", [tg]
    )
    if ex:
        client.execute(
            "UPDATE ACC.TACC_TGASTOS SET descripcion=:1, activo=:2, "
            " cuenta=:3, centro_costo=:4 WHERE tipo_gasto=:5",
            [data['descripcion'], data.get('activo', 'S'),
             data.get('cuenta'), data.get('centro_costo', '0000000000'), tg],
        )
    else:
        client.execute(
            "INSERT INTO ACC.TACC_TGASTOS "
            "(tipo_gasto, descripcion, activo, cuenta, centro_costo) "
            "VALUES (:1, :2, :3, :4, :5)",
            [tg, data['descripcion'], data.get('activo', 'S'),
             data.get('cuenta'), data.get('centro_costo', '0000000000')],
        )
    return tg


def upsert_tipo_bene(data: dict) -> str:
    tb = (data['tipo_bene'] or '').strip().upper()
    ex = client.fetch_one(
        "SELECT 1 FROM ACC.TACC_TBENEFICIARIO WHERE tipo_bene=:1", [tb]
    )
    if ex:
        client.execute(
            "UPDATE ACC.TACC_TBENEFICIARIO SET descripcion=:1, activo=:2 "
            "WHERE tipo_bene=:3",
            [data['descripcion'], data.get('activo', 'S'), tb],
        )
    else:
        client.execute(
            "INSERT INTO ACC.TACC_TBENEFICIARIO "
            "(tipo_bene, descripcion, activo) VALUES (:1, :2, :3)",
            [tb, data['descripcion'], data.get('activo', 'S')],
        )
    return tb
