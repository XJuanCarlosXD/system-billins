"""Nómina (SDN) — repo de lectura/escritura.

Tablas (esquema SDN):
- TSDN_CIAS, TSDN_USUARIO              configuración por empresa/usuario
- TSDN_NOMINA                          nóminas (definición por mes/período)
- TSDN_EMPLEADO                        maestro de empleados (74 cols)
- TSDN_GERENCIA/TSDN_AREA/TSDN_DEPTO   jerarquía organizacional
- TSDN_INGRESOS/TSDN_DEDUCCIONES       conceptos
- TSDN_MOVIMIENTO                      movimientos (manuales y calculados)
- TSDN_CALCULO_INGRESOS/CALCULO_DEDUCCIONES  cálculos individuales
- TSDN_VACACIONES                      vacaciones generadas
- TSDN_AFP / TSDN_ARS                  catálogos
"""
from __future__ import annotations

from .. import client


# ---- Cias ----
def list_cias() -> list[dict]:
    return client.fetch_dicts(
        "SELECT no_cia, descripcion, razon_social, no_patronal, activa, "
        "       salario_minimo, tope_salario_ss, tope_salario_afp, prox_empleado "
        "FROM SDN.TSDN_CIAS ORDER BY no_cia"
    )


# ---- Catálogos ----
def list_afp() -> list[dict]:
    return client.fetch_dicts(
        "SELECT no_afp, descripcion FROM SDN.TSDN_AFP ORDER BY no_afp"
    )


def list_ars() -> list[dict]:
    return client.fetch_dicts(
        "SELECT no_ars, descripcion FROM SDN.TSDN_ARS ORDER BY no_ars"
    )


def list_gerencias() -> list[dict]:
    return client.fetch_dicts(
        "SELECT no_gerencia, descripcion FROM SDN.TSDN_GERENCIA ORDER BY no_gerencia"
    )


def list_areas() -> list[dict]:
    return client.fetch_dicts(
        "SELECT no_gerencia, no_area, descripcion FROM SDN.TSDN_AREA ORDER BY no_gerencia, no_area"
    )


def list_deptos() -> list[dict]:
    return client.fetch_dicts(
        "SELECT no_gerencia, no_area, no_depto, descripcion "
        "FROM SDN.TSDN_DEPTO ORDER BY no_gerencia, no_area, no_depto"
    )


def list_ingresos(status: str = 'A') -> list[dict]:
    sql = (
        "SELECT no_ingreso, descripcion, descri_corta, tipo_ingreso, "
        "       clase_ingreso, status, multiplicado_por, individual, "
        "       valido_regalia, valido_bonificacion, no_cotiza_tss, "
        "       imprimir_en_el_volante, pagar_en_archivo_electronico "
        "FROM SDN.TSDN_INGRESOS"
    )
    params: list = []
    if status:
        sql += " WHERE status=:1"; params.append(status)
    sql += " ORDER BY no_ingreso"
    return client.fetch_dicts(sql, params)


def list_deducciones(status: str = 'A') -> list[dict]:
    sql = (
        "SELECT no_deduccion, descripcion, descri_corta, tipo_deduccion, "
        "       empleado_patrono, clase_deduccion, porciento_monto, "
        "       status, individual, antes_isr, valor, frecuencia, cuenta, cuenta_gasto "
        "FROM SDN.TSDN_DEDUCCIONES"
    )
    params: list = []
    if status:
        sql += " WHERE status=:1"; params.append(status)
    sql += " ORDER BY no_deduccion"
    return client.fetch_dicts(sql, params)


# ---- Empleados ----
def count_empleados(no_cia: str) -> int:
    row = client.fetch_one(
        "SELECT COUNT(*) FROM SDN.TSDN_EMPLEADO WHERE no_cia=:1",
        [no_cia],
    )
    return int(row[0]) if row else 0


def list_empleados(no_cia: str, punto: str | None = None,
                   nomina: str | None = None,
                   activos: bool = True, search: str = '',
                   limit: int = 200) -> list[dict]:
    sql = (
        "SELECT no_cia, no_empleado, punto, nomina, centro_trabajo, "
        "       nombre, apellido, apodo, cedula, "
        "       fecha_ingreso, fecha_egreso, empleado_fijo, "
        "       email1, ciudad, direccion "
        "  FROM SDN.TSDN_EMPLEADO WHERE no_cia=:1"
    )
    params: list = [no_cia]
    if punto:
        sql += f" AND punto=:{len(params)+1}"; params.append(punto)
    if nomina:
        sql += f" AND nomina=:{len(params)+1}"; params.append(nomina)
    if activos:
        sql += " AND fecha_egreso IS NULL"
    if search:
        sql += (f" AND (UPPER(nombre||' '||apellido) LIKE UPPER(:{len(params)+1}) "
                f"      OR cedula LIKE :{len(params)+1}"
                f"      OR TO_CHAR(no_empleado) LIKE :{len(params)+1})")
        params.append(f"%{search}%")
    sql += " ORDER BY apellido, nombre"
    if limit:
        sql = f"SELECT * FROM ({sql}) WHERE ROWNUM <= {int(limit)}"
    return client.fetch_dicts(sql, params)


def get_empleado(no_cia: str, no_empleado: int) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT * FROM SDN.TSDN_EMPLEADO WHERE no_cia=:1 AND no_empleado=:2",
        [no_cia, int(no_empleado)],
    )
    return rows[0] if rows else None


# ---- Nóminas ----
def list_nominas(no_cia: str, punto: str | None = None,
                 estado: str | None = None,
                 ano: int | None = None, mes: int | None = None,
                 limit: int = 100) -> list[dict]:
    sql = (
        "SELECT no_cia, punto, nomina, descripcion, forma_pago, "
        "       fecha_inicial, fecha_final, cuenta_contable, cuenta_bancaria, "
        "       mes_proceso, ano_proceso, mes_cierre, periodo, "
        "       calculo_nomina, estado, regalia_por_pagar "
        "  FROM SDN.TSDN_NOMINA WHERE no_cia=:1"
    )
    params: list = [no_cia]
    if punto:
        sql += f" AND punto=:{len(params)+1}"; params.append(punto)
    if estado:
        sql += f" AND estado=:{len(params)+1}"; params.append(estado)
    if ano:
        sql += f" AND ano_proceso=:{len(params)+1}"; params.append(int(ano))
    if mes:
        sql += f" AND mes_proceso=:{len(params)+1}"; params.append(int(mes))
    sql += " ORDER BY ano_proceso DESC, mes_proceso DESC, nomina"
    if limit:
        sql = f"SELECT * FROM ({sql}) WHERE ROWNUM <= {int(limit)}"
    return client.fetch_dicts(sql, params)


# ---- Vacaciones ----
def list_vacaciones(no_cia: str, punto: str | None = None,
                    nomina: str | None = None,
                    ano: int | None = None,
                    limit: int = 200) -> list[dict]:
    sql = (
        "SELECT v.no_cia, v.punto, v.nomina, v.no_empleado, "
        "       e.nombre||' '||e.apellido AS nombre_empleado, "
        "       v.fecha_ingreso, v.fecha_inicial, v.fecha_final, "
        "       v.cantidad_dias, v.st_vacaciones, v.tiempo_ano, v.tiempo_mes, v.tiempo_dia "
        "  FROM SDN.TSDN_VACACIONES v "
        "  LEFT JOIN SDN.TSDN_EMPLEADO e ON e.no_cia=v.no_cia AND e.no_empleado=v.no_empleado "
        " WHERE v.no_cia=:1"
    )
    params: list = [no_cia]
    if punto:
        sql += f" AND v.punto=:{len(params)+1}"; params.append(punto)
    if nomina:
        sql += f" AND v.nomina=:{len(params)+1}"; params.append(nomina)
    if ano:
        sql += f" AND TO_CHAR(v.fecha_inicial,'YYYY')=:{len(params)+1}"; params.append(str(ano))
    sql += " ORDER BY v.fecha_inicial DESC"
    if limit:
        sql = f"SELECT * FROM ({sql}) WHERE ROWNUM <= {int(limit)}"
    return client.fetch_dicts(sql, params)


# ---- Reportes ----
def rep_resumen_empleados(no_cia: str) -> dict:
    rows = client.fetch_dicts(
        "SELECT COUNT(*) total, "
        "       SUM(CASE WHEN fecha_egreso IS NULL THEN 1 ELSE 0 END) activos, "
        "       SUM(CASE WHEN fecha_egreso IS NOT NULL THEN 1 ELSE 0 END) egresados, "
        "       SUM(CASE WHEN empleado_fijo='S' THEN 1 ELSE 0 END) fijos, "
        "       SUM(CASE WHEN empleado_fijo='N' THEN 1 ELSE 0 END) no_fijos "
        "  FROM SDN.TSDN_EMPLEADO WHERE no_cia=:1",
        [no_cia],
    )
    return rows[0] if rows else {}


def rep_nominas_resumen(no_cia: str, ano: int | None = None) -> list[dict]:
    sql = (
        "SELECT ano_proceso, mes_proceso, COUNT(*) total_nominas, "
        "       SUM(CASE WHEN estado='A' THEN 1 ELSE 0 END) abiertas, "
        "       SUM(CASE WHEN estado='C' THEN 1 ELSE 0 END) cerradas, "
        "       SUM(CASE WHEN calculo_nomina='S' THEN 1 ELSE 0 END) calculadas "
        "  FROM SDN.TSDN_NOMINA WHERE no_cia=:1"
    )
    params: list = [no_cia]
    if ano:
        sql += f" AND ano_proceso=:{len(params)+1}"; params.append(int(ano))
    sql += " GROUP BY ano_proceso, mes_proceso ORDER BY ano_proceso DESC, mes_proceso DESC"
    return client.fetch_dicts(sql, params)
