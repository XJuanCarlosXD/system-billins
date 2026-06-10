"""Bancos / Cheques / Conciliación (CHC) — repo de lectura/escritura.

Tablas principales (esquema CHC):
- TCHC_BANCO              catálogo de bancos
- TCHC_CIAS / TCHC_PUNTO  configuración
- TCHC_BCUENTA            cuentas bancarias por empresa/punto
- TCHC_CHEQUE             cheques / depósitos / movimientos
- TCHC_TDOCU              tipos de documento
- TCHC_CIERRE_CONCILIACION  cierres mensuales
- TCHC_CUENTAH            saldo inicial por mes/año por cuenta
"""
from __future__ import annotations

from .. import client


# ---- Bancos ----
def list_bancos(activo: str = '') -> list[dict]:
    sql = "SELECT banco, descri, activo, rnc, siglas_banco FROM CHC.TCHC_BANCO"
    params: list = []
    if activo:
        sql += " WHERE activo=:1"; params.append(activo)
    sql += " ORDER BY banco"
    return client.fetch_dicts(sql, params)


def upsert_banco(banco: str, descri: str, activo: str = 'S',
                 rnc: str | None = None, siglas: str | None = None) -> None:
    row = client.fetch_one("SELECT 1 FROM CHC.TCHC_BANCO WHERE banco=:1", [banco])
    if row:
        client.execute(
            "UPDATE CHC.TCHC_BANCO SET descri=:1, activo=:2, rnc=:3, siglas_banco=:4 "
            "WHERE banco=:5",
            [descri, activo, rnc, siglas, banco],
        )
    else:
        client.execute(
            "INSERT INTO CHC.TCHC_BANCO (banco, descri, activo, rnc, siglas_banco) "
            "VALUES (:1,:2,:3,:4,:5)",
            [banco, descri, activo, rnc, siglas],
        )


# ---- Configuración ----
def list_cias() -> list[dict]:
    return client.fetch_dicts(
        "SELECT no_cia, descri, activa, no_formulario, registro_cont, "
        "       formulario_unico, secuencia_op, id_del_banco "
        "FROM CHC.TCHC_CIAS ORDER BY no_cia"
    )


def list_puntos(no_cia: str) -> list[dict]:
    return client.fetch_dicts(
        "SELECT no_cia, punto, descri, activo, modelo_cheque, afectar_cxp, "
        "       no_formulario, registrar_docu_fecha_futura "
        "FROM CHC.TCHC_PUNTO WHERE no_cia=:1 ORDER BY punto",
        [no_cia],
    )


# ---- Cuentas bancarias ----
def list_cuentas_bancarias(no_cia: str, punto: str | None = None,
                           activa: str = '') -> list[dict]:
    sql = (
        "SELECT no_cia, punto, cuenta_banco, moneda, fecha, ano_proceso, "
        "       mes_proceso, mes_cierre, activa, imprimir, "
        "       che_por_entregar, saldo_inicial, che_mes, deposito_mes, "
        "       deb_mes, cre_mes, prox_cheque "
        "  FROM CHC.TCHC_BCUENTA WHERE no_cia=:1"
    )
    params: list = [no_cia]
    if punto:
        sql += f" AND punto=:{len(params)+1}"; params.append(punto)
    if activa:
        sql += f" AND activa=:{len(params)+1}"; params.append(activa)
    sql += " ORDER BY cuenta_banco"
    return client.fetch_dicts(sql, params)


def get_saldo_cuenta(no_cia: str, punto: str, cuenta_banco: str) -> dict:
    """Calcula saldo aproximado: saldo_inicial + (depósito_mes - cheque_mes + cre_mes - deb_mes)."""
    rows = client.fetch_dicts(
        "SELECT saldo_inicial, che_mes, deposito_mes, deb_mes, cre_mes "
        "FROM CHC.TCHC_BCUENTA WHERE no_cia=:1 AND punto=:2 AND cuenta_banco=:3",
        [no_cia, punto, cuenta_banco],
    )
    if not rows:
        return {'saldo_aprox': 0}
    r = rows[0]
    saldo = float(r['saldo_inicial'] or 0) + float(r['deposito_mes'] or 0) - float(r['che_mes'] or 0) \
            + float(r['cre_mes'] or 0) - float(r['deb_mes'] or 0)
    return {**r, 'saldo_aprox': round(saldo, 2)}


# ---- Cheques ----
def list_cheques(no_cia: str, punto: str | None = None,
                 cuenta_banco: str | None = None,
                 status: str | None = None,
                 conciliado: str | None = None,
                 entregado: str | None = None,
                 fecha_desde: str | None = None,
                 fecha_hasta: str | None = None,
                 no_proveedor: str | None = None,
                 limit: int = 200) -> list[dict]:
    sql = (
        "SELECT c.no_cia, c.punto, c.tipo_docu, c.no_docu, c.cuenta_banco, "
        "       c.no_proveedor, p.nombre nombre_proveedor, "
        "       c.tipo_movi, c.tipo_transaccion, c.fecha_solicitud, c.fecha_cheque, "
        "       c.beneficiario, c.status, c.st_impresion, c.st_nulo, "
        "       c.autorizado, c.conciliado, c.entregado, c.retenido, "
        "       c.debito, c.credito, c.valor_original, c.saldo, "
        "       c.usuario, c.autorizado_por, c.moneda_cuenta "
        "  FROM CHC.TCHC_CHEQUE c "
        "  LEFT JOIN CXP.TCXP_DPROVEEDOR p ON p.no_proveedor = c.no_proveedor "
        " WHERE c.no_cia=:1"
    )
    params: list = [no_cia]
    if punto:
        sql += f" AND c.punto=:{len(params)+1}"; params.append(punto)
    if cuenta_banco:
        sql += f" AND c.cuenta_banco=:{len(params)+1}"; params.append(cuenta_banco)
    if status:
        sql += f" AND c.status=:{len(params)+1}"; params.append(status)
    if conciliado:
        sql += f" AND c.conciliado=:{len(params)+1}"; params.append(conciliado)
    if entregado:
        sql += f" AND c.entregado=:{len(params)+1}"; params.append(entregado)
    if no_proveedor:
        sql += f" AND c.no_proveedor=:{len(params)+1}"; params.append(no_proveedor)
    if fecha_desde:
        sql += f" AND TRUNC(c.fecha_cheque) >= TO_DATE(:{len(params)+1},'YYYY-MM-DD')"; params.append(fecha_desde)
    if fecha_hasta:
        sql += f" AND TRUNC(c.fecha_cheque) <= TO_DATE(:{len(params)+1},'YYYY-MM-DD')"; params.append(fecha_hasta)
    sql += " ORDER BY c.fecha_cheque DESC, c.no_docu DESC"
    if limit:
        sql = f"SELECT * FROM ({sql}) WHERE ROWNUM <= {int(limit)}"
    return client.fetch_dicts(sql, params)


def get_cheque(no_cia: str, punto: str, tipo_docu: str, no_docu: str) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT c.*, p.nombre nombre_proveedor "
        "  FROM CHC.TCHC_CHEQUE c "
        "  LEFT JOIN CXP.TCXP_DPROVEEDOR p ON p.no_proveedor = c.no_proveedor "
        " WHERE c.no_cia=:1 AND c.punto=:2 AND c.tipo_docu=:3 AND c.no_docu=:4",
        [no_cia, punto, tipo_docu, no_docu],
    )
    return rows[0] if rows else None


def list_tipos_docu() -> list[dict]:
    return client.fetch_dicts(
        "SELECT tipo_docu, descri, tipo_movi, tipo_transaccion, cuenta, "
        "       activo, centro_costo "
        "FROM CHC.TCHC_TDOCU ORDER BY tipo_docu"
    )


def anular_cheque(no_cia: str, punto: str, tipo_docu: str, no_docu: str,
                  motivo: str = '') -> None:
    # Dominio real legado: st_nulo 'A'=Activo / 'N'=Nulo (anulado).
    # status 'A'=Activo / 'C'=Cobrado/Conciliado / 'N'=Nulo. Al anular pasa a 'N'.
    client.execute(
        "UPDATE CHC.TCHC_CHEQUE SET st_nulo='N', status='N' "
        " WHERE no_cia=:1 AND punto=:2 AND tipo_docu=:3 AND no_docu=:4",
        [no_cia, punto, tipo_docu, no_docu],
    )


def marcar_entregado(no_cia: str, punto: str, tipo_docu: str, no_docu: str,
                     usuario: str) -> None:
    client.execute(
        "UPDATE CHC.TCHC_CHEQUE SET entregado='S' "
        " WHERE no_cia=:1 AND punto=:2 AND tipo_docu=:3 AND no_docu=:4",
        [no_cia, punto, tipo_docu, no_docu],
    )


def marcar_conciliado(no_cia: str, punto: str, tipo_docu: str, no_docu: str) -> None:
    client.execute(
        "UPDATE CHC.TCHC_CHEQUE SET conciliado='S' "
        " WHERE no_cia=:1 AND punto=:2 AND tipo_docu=:3 AND no_docu=:4",
        [no_cia, punto, tipo_docu, no_docu],
    )


# ---- Cierres de conciliación ----
def list_cierres(no_cia: str, punto: str | None = None,
                 cuenta_banco: str | None = None) -> list[dict]:
    sql = ("SELECT no_cia, punto, ano, mes, cuenta_banco, fecha_sysdate, usuario "
           "FROM CHC.TCHC_CIERRE_CONCILIACION WHERE no_cia=:1")
    params: list = [no_cia]
    if punto:
        sql += f" AND punto=:{len(params)+1}"; params.append(punto)
    if cuenta_banco:
        sql += f" AND cuenta_banco=:{len(params)+1}"; params.append(cuenta_banco)
    sql += " ORDER BY ano DESC, mes DESC, cuenta_banco"
    return client.fetch_dicts(sql, params)


# ---- Reportes ----
def rep_resumen_cuenta(no_cia: str, punto: str, cuenta_banco: str,
                       fecha_desde: str, fecha_hasta: str) -> dict:
    rows = client.fetch_dicts(
        "SELECT COUNT(*) total_cheques, "
        "       SUM(CASE WHEN tipo_movi='D' THEN valor_original ELSE 0 END) total_debito, "
        "       SUM(CASE WHEN tipo_movi='C' THEN valor_original ELSE 0 END) total_credito, "
        "       SUM(CASE WHEN st_nulo='N' THEN 1 ELSE 0 END) nulos, "
        "       SUM(CASE WHEN conciliado='S' THEN 1 ELSE 0 END) conciliados, "
        "       SUM(CASE WHEN entregado='S' THEN 1 ELSE 0 END) entregados "
        "  FROM CHC.TCHC_CHEQUE "
        " WHERE no_cia=:1 AND punto=:2 AND cuenta_banco=:3 "
        "   AND TRUNC(fecha_cheque) BETWEEN TO_DATE(:4,'YYYY-MM-DD') AND TO_DATE(:5,'YYYY-MM-DD')",
        [no_cia, punto, cuenta_banco, fecha_desde, fecha_hasta],
    )
    return rows[0] if rows else {}


def rep_balance_cuentas(no_cia: str, punto: str | None = None) -> list[dict]:
    rows = list_cuentas_bancarias(no_cia, punto, activa='S')
    out = []
    for c in rows:
        saldo = float(c['saldo_inicial'] or 0) + float(c['deposito_mes'] or 0) \
                - float(c['che_mes'] or 0) + float(c['cre_mes'] or 0) - float(c['deb_mes'] or 0)
        out.append({**c, 'saldo_aprox': round(saldo, 2)})
    return out
