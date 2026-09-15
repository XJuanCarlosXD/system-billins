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

import calendar
from datetime import date as _date

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


# ---------------------------------------------------------------------------
# CRUD upsert/delete para catálogos organizacionales
# ---------------------------------------------------------------------------

def _exists(sql: str, params: list) -> bool:
    r = client.fetch_one(sql, params)
    return bool(r)


def upsert_afp(data: dict) -> str:
    no_afp = str(data['no_afp']).zfill(2)
    if _exists("SELECT 1 FROM SDN.TSDN_AFP WHERE no_afp=:1", [no_afp]):
        client.execute(
            "UPDATE SDN.TSDN_AFP SET descripcion=:1 WHERE no_afp=:2",
            [data['descripcion'], no_afp],
        )
    else:
        client.execute(
            "INSERT INTO SDN.TSDN_AFP (no_afp, descripcion) VALUES (:1, :2)",
            [no_afp, data['descripcion']],
        )
    return no_afp


def delete_afp(no_afp: str) -> None:
    if _exists("SELECT 1 FROM SDN.TSDN_EMPLEADO WHERE no_afp=:1", [no_afp]):
        raise ValueError('AFP en uso por empleados')
    n = client.execute("DELETE FROM SDN.TSDN_AFP WHERE no_afp=:1", [no_afp])
    if not n:
        raise ValueError(f'AFP {no_afp} no existe')


def upsert_ars(data: dict) -> str:
    no_ars = str(data['no_ars']).zfill(2)
    if _exists("SELECT 1 FROM SDN.TSDN_ARS WHERE no_ars=:1", [no_ars]):
        client.execute(
            "UPDATE SDN.TSDN_ARS SET descripcion=:1 WHERE no_ars=:2",
            [data['descripcion'], no_ars],
        )
    else:
        client.execute(
            "INSERT INTO SDN.TSDN_ARS (no_ars, descripcion) VALUES (:1, :2)",
            [no_ars, data['descripcion']],
        )
    return no_ars


def delete_ars(no_ars: str) -> None:
    if _exists("SELECT 1 FROM SDN.TSDN_EMPLEADO WHERE no_ars=:1", [no_ars]):
        raise ValueError('ARS en uso por empleados')
    n = client.execute("DELETE FROM SDN.TSDN_ARS WHERE no_ars=:1", [no_ars])
    if not n:
        raise ValueError(f'ARS {no_ars} no existe')


def upsert_gerencia(data: dict) -> str:
    no_gerencia = str(data['no_gerencia']).zfill(2)
    if _exists("SELECT 1 FROM SDN.TSDN_GERENCIA WHERE no_gerencia=:1", [no_gerencia]):
        client.execute(
            "UPDATE SDN.TSDN_GERENCIA SET descripcion=:1 WHERE no_gerencia=:2",
            [data['descripcion'], no_gerencia],
        )
    else:
        client.execute(
            "INSERT INTO SDN.TSDN_GERENCIA (no_gerencia, descripcion) VALUES (:1, :2)",
            [no_gerencia, data['descripcion']],
        )
    return no_gerencia


def delete_gerencia(no_gerencia: str) -> None:
    if _exists("SELECT 1 FROM SDN.TSDN_AREA WHERE no_gerencia=:1", [no_gerencia]):
        raise ValueError('gerencia con áreas asignadas')
    if _exists("SELECT 1 FROM SDN.TSDN_EMPLEADO WHERE no_gerencia=:1", [no_gerencia]):
        raise ValueError('gerencia en uso por empleados')
    n = client.execute("DELETE FROM SDN.TSDN_GERENCIA WHERE no_gerencia=:1", [no_gerencia])
    if not n:
        raise ValueError(f'gerencia {no_gerencia} no existe')


def upsert_area(data: dict) -> tuple[str, str]:
    ng = str(data['no_gerencia']).zfill(2)
    na = str(data['no_area']).zfill(2)
    if _exists(
        "SELECT 1 FROM SDN.TSDN_AREA WHERE no_gerencia=:1 AND no_area=:2", [ng, na]
    ):
        client.execute(
            "UPDATE SDN.TSDN_AREA SET descripcion=:1 "
            "WHERE no_gerencia=:2 AND no_area=:3",
            [data['descripcion'], ng, na],
        )
    else:
        client.execute(
            "INSERT INTO SDN.TSDN_AREA (no_gerencia, no_area, descripcion) "
            "VALUES (:1, :2, :3)",
            [ng, na, data['descripcion']],
        )
    return ng, na


def delete_area(no_gerencia: str, no_area: str) -> None:
    if _exists(
        "SELECT 1 FROM SDN.TSDN_DEPTO WHERE no_gerencia=:1 AND no_area=:2",
        [no_gerencia, no_area],
    ):
        raise ValueError('área con departamentos asignados')
    if _exists(
        "SELECT 1 FROM SDN.TSDN_EMPLEADO WHERE no_gerencia=:1 AND no_area=:2",
        [no_gerencia, no_area],
    ):
        raise ValueError('área en uso por empleados')
    n = client.execute(
        "DELETE FROM SDN.TSDN_AREA WHERE no_gerencia=:1 AND no_area=:2",
        [no_gerencia, no_area],
    )
    if not n:
        raise ValueError(f'área {no_gerencia}/{no_area} no existe')


def upsert_depto(data: dict) -> tuple[str, str, str]:
    ng = str(data['no_gerencia']).zfill(2)
    na = str(data['no_area']).zfill(2)
    nd = str(data['no_depto']).zfill(2)
    if _exists(
        "SELECT 1 FROM SDN.TSDN_DEPTO "
        "WHERE no_gerencia=:1 AND no_area=:2 AND no_depto=:3",
        [ng, na, nd],
    ):
        client.execute(
            "UPDATE SDN.TSDN_DEPTO SET descripcion=:1 "
            "WHERE no_gerencia=:2 AND no_area=:3 AND no_depto=:4",
            [data['descripcion'], ng, na, nd],
        )
    else:
        client.execute(
            "INSERT INTO SDN.TSDN_DEPTO "
            "(no_gerencia, no_area, no_depto, descripcion) "
            "VALUES (:1, :2, :3, :4)",
            [ng, na, nd, data['descripcion']],
        )
    return ng, na, nd


def delete_depto(no_gerencia: str, no_area: str, no_depto: str) -> None:
    if _exists(
        "SELECT 1 FROM SDN.TSDN_EMPLEADO "
        "WHERE no_gerencia=:1 AND no_area=:2 AND no_depto=:3",
        [no_gerencia, no_area, no_depto],
    ):
        raise ValueError('departamento en uso por empleados')
    n = client.execute(
        "DELETE FROM SDN.TSDN_DEPTO "
        "WHERE no_gerencia=:1 AND no_area=:2 AND no_depto=:3",
        [no_gerencia, no_area, no_depto],
    )
    if not n:
        raise ValueError(f'departamento {no_gerencia}/{no_area}/{no_depto} no existe')


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
    sql += " ORDER BY nombre, apellido"
    if limit:
        sql = f"SELECT * FROM ({sql}) WHERE ROWNUM <= {int(limit)}"
    return client.fetch_dicts(sql, params)


def get_empleado(no_cia: str, no_empleado: int) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT * FROM SDN.TSDN_EMPLEADO WHERE no_cia=:1 AND no_empleado=:2",
        [no_cia, int(no_empleado)],
    )
    return rows[0] if rows else None


# ---- Catálogos de apoyo para Mantenimiento de Empleados (Fsdn117) ----
def list_puestos() -> list[dict]:
    return client.fetch_dicts("SELECT no_puesto, descripcion FROM SDN.TSDN_PUESTO ORDER BY no_puesto")


def list_tipos_empleado() -> list[dict]:
    return client.fetch_dicts("SELECT no_tipo, descripcion FROM SDN.TSDN_TIPO_EMPLEADO ORDER BY no_tipo")


def list_paises() -> list[dict]:
    return client.fetch_dicts("SELECT no_pais, descripcion FROM SDN.TSDN_PAIS ORDER BY no_pais")


def list_profesiones() -> list[dict]:
    return client.fetch_dicts("SELECT no_profesion, descripcion FROM SDN.TSDN_PROFESION ORDER BY no_profesion")


def list_centros_trabajo() -> list[dict]:
    return client.fetch_dicts("SELECT no_centro, descripcion FROM SDN.TSDN_CENTRO_TRABAJO ORDER BY no_centro")


def empleado_catalogos(no_cia: str) -> dict:
    return {
        'nominas': client.fetch_dicts(
            "SELECT no_cia, punto, nomina, descripcion FROM SDN.TSDN_NOMINA "
            "WHERE no_cia=:1 ORDER BY punto, nomina",
            [no_cia],
        ) if no_cia else [],
        'gerencias': list_gerencias(),
        'areas': list_areas(),
        'deptos': list_deptos(),
        'centros_trabajo': list_centros_trabajo(),
        'profesiones': list_profesiones(),
        'puestos': list_puestos(),
        'tipos_empleado': list_tipos_empleado(),
        'paises': list_paises(),
    }


_REQUIRED_EMPLEADO = [
    'no_cia', 'punto', 'nomina', 'centro_trabajo', 'nombre', 'apellido', 'cedula',
    'pais', 'ciudad', 'barrio', 'direccion', 'fecha_ingreso', 'fecha_nacimiento',
    'no_gerencia', 'no_area', 'no_depto', 'no_profesion', 'no_puesto', 'no_tipo',
]


def crear_empleado(data: dict, usuario: str) -> dict:
    faltantes = [f for f in _REQUIRED_EMPLEADO if not data.get(f)]
    if faltantes:
        raise ValueError(f'faltan campos requeridos: {", ".join(faltantes)}')

    no_cia = str(data['no_cia']).zfill(2)
    punto = str(data['punto']).zfill(2)
    if not _exists(
        "SELECT 1 FROM SDN.TSDN_NOMINA WHERE no_cia=:1 AND punto=:2 AND nomina=:3",
        [no_cia, punto, data['nomina']],
    ):
        raise ValueError('la nómina indicada no existe para esa compañía/sucursal')

    row = client.fetch_one("SELECT NVL(prox_empleado,0) FROM SDN.TSDN_CIAS WHERE no_cia=:1", [no_cia])
    if not row:
        raise ValueError(f'compañía {no_cia} no está configurada en Nómina (TSDN_CIAS)')
    no_empleado = int(row[0])
    client.execute(
        "UPDATE SDN.TSDN_CIAS SET prox_empleado=NVL(prox_empleado,0)+1 WHERE no_cia=:1",
        [no_cia],
    )

    client.execute(
        "INSERT INTO SDN.TSDN_EMPLEADO ("
        "  no_cia, no_empleado, punto, nomina, centro_trabajo,"
        "  nombre, apellido, apodo, cedula, pais, ciudad, barrio, direccion,"
        "  email1, telefono1, celular,"
        "  fecha_solicitud, fecha_digitacion, fecha_ingreso, fecha_nacimiento,"
        "  empleado_fijo, estado_civil, sexo,"
        "  no_profesion, no_puesto, no_gerencia, no_area, no_depto,"
        "  no_tipo, tipo_cuenta_banco, cuenta_banco, salario_mensual, usuario"
        ") VALUES ("
        "  :1, :2, :3, :4, :5,"
        "  :6, :7, :8, :9, :10, :11, :12, :13,"
        "  :14, :15, :16,"
        "  SYSDATE, SYSDATE, TO_DATE(:17,'YYYY-MM-DD'), TO_DATE(:18,'YYYY-MM-DD'),"
        "  :19, :20, :21,"
        "  :22, :23, :24, :25, :26,"
        "  :27, :28, :29, :30, :31"
        ")",
        [
            no_cia, no_empleado, punto, data['nomina'], data['centro_trabajo'],
            data['nombre'][:25], data['apellido'][:25], (data.get('apodo') or None),
            data['cedula'][:13], data['pais'], data['ciudad'], data['barrio'], data['direccion'][:60],
            (data.get('email1') or None), (data.get('telefono1') or None), (data.get('celular') or None),
            data['fecha_ingreso'], data['fecha_nacimiento'],
            data.get('empleado_fijo') or 'S', data.get('estado_civil') or 'C', data.get('sexo') or 'M',
            data['no_profesion'], data['no_puesto'], data['no_gerencia'], data['no_area'], data['no_depto'],
            data['no_tipo'], data.get('tipo_cuenta_banco') or '3', (data.get('cuenta_banco') or None),
            float(data.get('salario_mensual') or 0), usuario,
        ],
    )
    return get_empleado(no_cia, no_empleado)


def dar_baja_empleado(no_cia: str, no_empleado: int, fecha_egreso: str | None) -> dict:
    if not fecha_egreso:
        raise ValueError('fecha_egreso es requerida')
    if not _exists(
        "SELECT 1 FROM SDN.TSDN_EMPLEADO WHERE no_cia=:1 AND no_empleado=:2 AND fecha_egreso IS NULL",
        [no_cia, int(no_empleado)],
    ):
        raise ValueError('el empleado no existe o ya está dado de baja')
    client.execute(
        "UPDATE SDN.TSDN_EMPLEADO SET fecha_egreso=TO_DATE(:1,'YYYY-MM-DD') "
        "WHERE no_cia=:2 AND no_empleado=:3 AND fecha_egreso IS NULL",
        [fecha_egreso, no_cia, int(no_empleado)],
    )
    return get_empleado(no_cia, no_empleado)


def reactivar_empleado(no_cia: str, no_empleado: int) -> dict:
    if not _exists(
        "SELECT 1 FROM SDN.TSDN_EMPLEADO WHERE no_cia=:1 AND no_empleado=:2 AND fecha_egreso IS NOT NULL",
        [no_cia, int(no_empleado)],
    ):
        raise ValueError('el empleado no existe o ya está activo')
    client.execute(
        "UPDATE SDN.TSDN_EMPLEADO SET fecha_egreso=NULL "
        "WHERE no_cia=:1 AND no_empleado=:2",
        [no_cia, int(no_empleado)],
    )
    return get_empleado(no_cia, no_empleado)


# ---- Nóminas ----
def list_nominas(no_cia: str, punto: str | None = None,
                 estado: str | None = None,
                 ano: int | None = None, mes: int | None = None,
                 limit: int = 100) -> list[dict]:
    sql = (
        "SELECT no_cia, punto, nomina, descripcion, forma_pago, "
        "       fecha_inicial, fecha_final, cuenta_contable, cuenta_bancaria, "
        "       mes_proceso, ano_proceso, mes_cierre, periodo, "
        "       calculo_nomina, estado, regalia_por_pagar, factor_calculo_diario "
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


# ---- Definición de Nóminas (write) ----
def get_nomina(no_cia: str, punto: str, nomina: str) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT no_cia, punto, nomina, descripcion, forma_pago, "
        "       fecha_inicial, fecha_final, cuenta_contable, cuenta_bancaria, "
        "       mes_proceso, ano_proceso, mes_cierre, periodo, "
        "       calculo_nomina, estado, regalia_por_pagar, gasto_regalia, "
        "       factor_calculo_diario, factor_calculo_horas, metodo_pago, tipo_moneda "
        "  FROM SDN.TSDN_NOMINA "
        " WHERE no_cia=:1 AND punto=:2 AND nomina=:3",
        [no_cia, punto, nomina],
    )
    return rows[0] if rows else None


def crear_nomina(no_cia: str, punto: str, data: dict) -> dict:
    """Inserta una nueva TSDN_NOMINA con defaults seguros."""
    nomina = (data.get('nomina') or '').upper().strip()
    if not nomina or len(nomina) > 2:
        raise ValueError("Código de nómina debe ser 1-2 caracteres")
    descripcion = (data.get('descripcion') or '').strip()
    if not descripcion:
        raise ValueError("Descripción es obligatoria")
    if get_nomina(no_cia, punto, nomina):
        raise ValueError(f"Ya existe nómina {nomina} en empresa {no_cia} punto {punto}")

    forma_pago = (data.get('forma_pago') or 'M').upper()  # M/Q/S
    cuenta_contable = (data.get('cuenta_contable') or '').strip()
    if not cuenta_contable:
        raise ValueError("Cuenta contable es obligatoria")
    cuenta_bancaria = (data.get('cuenta_bancaria') or '').strip() or None
    fecha_inicial = data.get('fecha_inicial')
    fecha_final = data.get('fecha_final')
    ano_proceso = int(data.get('ano_proceso') or 0)
    mes_proceso = int(data.get('mes_proceso') or 0)
    mes_cierre = int(data.get('mes_cierre') or 12)
    periodo = int(data.get('periodo') or 1)
    factor_horas = float(data.get('factor_calculo_horas') or 1)
    factor_diario = float(data.get('factor_calculo_diario') or 30)
    metodo_pago = int(data.get('metodo_pago') or 1)
    gasto_regalia = (data.get('gasto_regalia') or '').strip()
    regalia_por_pagar = (data.get('regalia_por_pagar') or '').strip()
    tipo_moneda = (data.get('tipo_moneda') or 'P').upper()
    if not ano_proceso or not mes_proceso:
        raise ValueError("ano_proceso y mes_proceso son obligatorios")
    if not gasto_regalia or not regalia_por_pagar:
        raise ValueError("Cuentas de regalía (gasto y por pagar) son obligatorias")

    client.execute(
        "INSERT INTO SDN.TSDN_NOMINA ("
        " no_cia, punto, nomina, descripcion, forma_pago, "
        " fecha_inicial, fecha_final, cuenta_contable, cuenta_bancaria, "
        " mes_proceso, ano_proceso, mes_cierre, periodo, "
        " factor_calculo_horas, factor_calculo_diario, "
        " calculo_nomina, estado, "
        " genero_archivo, genero_cheque, genero_archivo_v, genero_cheque_v, "
        " genero_archivo_r, genero_cheque_r, "
        " metodo_pago, gasto_regalia, regalia_por_pagar, tipo_moneda, "
        " cobran_por_hora, genero_especialismo, genero_ingreso_propina "
        ") VALUES ("
        " :1, :2, :3, :4, :5, "
        " CASE WHEN :6 IS NULL THEN NULL ELSE TO_DATE(:6,'YYYY-MM-DD') END, "
        " CASE WHEN :7 IS NULL THEN NULL ELSE TO_DATE(:7,'YYYY-MM-DD') END, "
        " :8, :9, "
        " :10, :11, :12, :13, "
        " :14, :15, "
        " 'N', 'A', "
        " 'N', 'N', 'N', 'N', "
        " 'N', 'N', "
        " :16, :17, :18, :19, "
        " 'N', 'N', 'N'"
        ")",
        client.nbinds(
            no_cia, punto, nomina, descripcion, forma_pago,
            fecha_inicial, fecha_final, cuenta_contable, cuenta_bancaria,
            mes_proceso, ano_proceso, mes_cierre, periodo,
            factor_horas, factor_diario,
            metodo_pago, gasto_regalia, regalia_por_pagar, tipo_moneda),
    )
    return get_nomina(no_cia, punto, nomina)


def actualizar_nomina(no_cia: str, punto: str, nomina: str, data: dict) -> dict:
    """Actualiza una TSDN_NOMINA existente. Solo permite editar si no está calculada."""
    cur = get_nomina(no_cia, punto, nomina)
    if not cur:
        raise ValueError(f"Nómina {nomina} no existe")
    if cur.get('calculo_nomina') == 'S':
        raise ValueError(
            f"Nómina {nomina} ya fue calculada — no se puede modificar la definición")
    if cur.get('estado') != 'A':
        raise ValueError(f"Nómina {nomina} no está activa (estado={cur.get('estado')})")

    descripcion = (data.get('descripcion') or cur['descripcion']).strip()
    forma_pago = (data.get('forma_pago') or cur['forma_pago']).upper()
    cuenta_contable = (data.get('cuenta_contable') or cur['cuenta_contable']).strip()
    cuenta_bancaria = data.get('cuenta_bancaria', cur.get('cuenta_bancaria'))
    fecha_inicial = data.get('fecha_inicial')
    fecha_final = data.get('fecha_final')
    factor_horas = float(data.get('factor_calculo_horas') or cur['factor_calculo_horas'])
    factor_diario = float(data.get('factor_calculo_diario') or cur['factor_calculo_diario'])
    metodo_pago = int(data.get('metodo_pago') or cur['metodo_pago'])
    gasto_regalia = (data.get('gasto_regalia') or cur['gasto_regalia']).strip()
    regalia_por_pagar = (data.get('regalia_por_pagar') or cur['regalia_por_pagar']).strip()
    tipo_moneda = (data.get('tipo_moneda') or cur.get('tipo_moneda') or 'P').upper()
    periodo = int(data.get('periodo') or cur.get('periodo') or 1)

    client.execute(
        "UPDATE SDN.TSDN_NOMINA SET "
        " descripcion=:1, forma_pago=:2, cuenta_contable=:3, "
        " cuenta_bancaria=:4, "
        " fecha_inicial=COALESCE(TO_DATE(:5,'YYYY-MM-DD'), fecha_inicial), "
        " fecha_final  =COALESCE(TO_DATE(:6,'YYYY-MM-DD'), fecha_final), "
        " factor_calculo_horas=:7, factor_calculo_diario=:8, "
        " metodo_pago=:9, gasto_regalia=:10, regalia_por_pagar=:11, "
        " tipo_moneda=:12, periodo=:13 "
        "WHERE no_cia=:14 AND punto=:15 AND nomina=:16",
        [descripcion, forma_pago, cuenta_contable, cuenta_bancaria,
         fecha_inicial, fecha_final, factor_horas, factor_diario,
         metodo_pago, gasto_regalia, regalia_por_pagar, tipo_moneda, periodo,
         no_cia, punto, nomina],
    )
    return get_nomina(no_cia, punto, nomina)


def anular_nomina(no_cia: str, punto: str, nomina: str) -> None:
    cur = get_nomina(no_cia, punto, nomina)
    if not cur:
        raise ValueError(f"Nómina {nomina} no existe")
    if cur.get('calculo_nomina') == 'S':
        raise ValueError(
            f"Nómina {nomina} ya fue calculada — no se puede anular")
    client.execute(
        "UPDATE SDN.TSDN_NOMINA SET estado='I' "
        " WHERE no_cia=:1 AND punto=:2 AND nomina=:3",
        [no_cia, punto, nomina],
    )


# ---- Cálculo de Nómina ----
_DEDUCCIONES_AUTOMATICAS = ('01', '02')  # AFP, SFS/ARS (TSDN_DEDUCCIONES)


def calcular_nomina(no_cia: str, punto: str, nomina: str, usuario: str) -> dict:
    """Marca CALCULO_NOMINA='S' en TSDN_NOMINA y registra auditoría.

    Antes de cerrar el calculo, aplica automaticamente AFP y SFS/ARS
    (deducciones 01/02 del catalogo TSDN_DEDUCCIONES, % + tope legal ya
    configurados) a todos los empleados activos que aun no las tengan en
    este periodo -- MPILAR reporto que tenia que registrarlas a mano cada
    vez; aplicar_deduccion_masiva ya existia y calculaba bien (con tope
    corregido en el mismo cambio), solo faltaba dispararla sola aqui. Si
    un empleado ya tiene el movimiento (por ejemplo alguien la registro a
    mano, o cambio de salario y se recalculo antes), no se duplica.
    Ingresos/otros conceptos por linea siguen pendientes (Fsdn202/Fsdn203).
    """
    cur = get_nomina(no_cia, punto, nomina)
    if not cur:
        raise ValueError(f"Nómina {nomina} no existe")
    if cur.get('estado') != 'A':
        raise ValueError(f"Nómina {nomina} no está activa")
    if cur.get('calculo_nomina') == 'S':
        raise ValueError(f"Nómina {nomina} ya fue calculada")

    ano = int(cur['ano_proceso'])
    mes = int(cur['mes_proceso'])
    periodo = int(cur.get('periodo') or 1)
    deducciones_auto = []
    for no_ded in _DEDUCCIONES_AUTOMATICAS:
        try:
            r = aplicar_deduccion_masiva(
                no_cia=no_cia, punto=punto, nomina=nomina,
                ano=ano, mes=mes, periodo=periodo,
                no_deduccion=no_ded, usuario=usuario)
            deducciones_auto.append({'no_deduccion': no_ded, 'aplicados': r['cantidad'],
                                      'total_monto': r['total_monto']})
        except Exception as exc:
            # No bloquea el calculo si una deduccion no aplica (ej. catalogo
            # inactivo en alguna compania) -- se reporta, no se detiene.
            deducciones_auto.append({'no_deduccion': no_ded, 'error': str(exc)})

    client.execute(
        "UPDATE SDN.TSDN_NOMINA SET calculo_nomina='S' "
        " WHERE no_cia=:1 AND punto=:2 AND nomina=:3",
        [no_cia, punto, nomina],
    )
    client.execute(
        "INSERT INTO SDN.TSDN_AUDITORIA ("
        " no_cia, punto, ano, mes, nomina, periodo, proceso, "
        " fecha_nomina_i, fecha_nomina_f, fecha_sysdate, usuario "
        ") VALUES ( "
        " :1, :2, :3, :4, :5, :6, 'C', "
        " :7, :8, SYSDATE, :9 "
        ")",
        [no_cia, punto,
         int(cur['ano_proceso']), int(cur['mes_proceso']),
         nomina, int(cur.get('periodo') or 1),
         cur.get('fecha_inicial'), cur.get('fecha_final'),
         (usuario or '').upper()[:30]],
    )
    resultado = get_nomina(no_cia, punto, nomina)
    resultado['deducciones_automaticas'] = deducciones_auto
    return resultado


def reabrir_nomina(no_cia: str, punto: str, nomina: str, usuario: str) -> dict:
    """Permite recalcular: vuelve CALCULO_NOMINA a 'N' siempre que no se
    haya generado archivo o cheque para el período."""
    cur = get_nomina(no_cia, punto, nomina)
    if not cur:
        raise ValueError(f"Nómina {nomina} no existe")
    if cur.get('calculo_nomina') != 'S':
        raise ValueError(f"Nómina {nomina} no estaba calculada")
    # Bloqueo si ya generó cheques o archivo de banco.
    row = client.fetch_one(
        "SELECT NVL(genero_archivo,'N'), NVL(genero_cheque,'N') "
        "  FROM SDN.TSDN_NOMINA WHERE no_cia=:1 AND punto=:2 AND nomina=:3",
        [no_cia, punto, nomina],
    )
    if row and (row[0] == 'S' or row[1] == 'S'):
        raise ValueError(
            "No se puede reabrir: ya se generó archivo o solicitud de cheques")
    client.execute(
        "UPDATE SDN.TSDN_NOMINA SET calculo_nomina='N' "
        " WHERE no_cia=:1 AND punto=:2 AND nomina=:3",
        [no_cia, punto, nomina],
    )
    client.execute(
        "INSERT INTO SDN.TSDN_AUDITORIA ("
        " no_cia, punto, ano, mes, nomina, periodo, proceso, "
        " fecha_nomina_i, fecha_nomina_f, fecha_sysdate, usuario "
        ") VALUES ( "
        " :1, :2, :3, :4, :5, :6, 'R', "
        " :7, :8, SYSDATE, :9 "
        ")",
        [no_cia, punto,
         int(cur['ano_proceso']), int(cur['mes_proceso']),
         nomina, int(cur.get('periodo') or 1),
         cur.get('fecha_inicial'), cur.get('fecha_final'),
         (usuario or '').upper()[:30]],
    )
    return get_nomina(no_cia, punto, nomina)


def avanzar_periodo(
    no_cia: str, punto: str, nomina: str, usuario: str, *,
    fecha_inicial: str, fecha_final: str, ano_proceso: int, mes_proceso: int,
    periodo: int,
) -> dict:
    """Mueve la definicion de nomina (unica fila por no_cia/punto/nomina) al
    siguiente periodo de pago. No existia en el codigo -- cada mes se venia
    haciendo con SQL directo (ver TSDN_AUDITORIA proceso='A'/'U' historico),
    riesgoso porque toca la definicion de nomina real. Requiere que el
    periodo actual ya este calculado (mismo candado que impide reabrir sin
    querer un periodo que el usuario todavia esta trabajando)."""
    cur = get_nomina(no_cia, punto, nomina)
    if not cur:
        raise ValueError(f"Nómina {nomina} no existe")
    if cur.get('calculo_nomina') != 'S':
        raise ValueError(
            f"Nómina {nomina} periodo actual no está calculada — "
            "calcúlala antes de avanzar al siguiente período")
    if not fecha_inicial or not fecha_final:
        raise ValueError("fecha_inicial y fecha_final son obligatorias")
    if not ano_proceso or not mes_proceso:
        raise ValueError("ano_proceso y mes_proceso son obligatorios")
    if not periodo:
        raise ValueError("periodo es obligatorio")

    periodo_anterior = int(cur.get('periodo') or 0)
    client.execute(
        "UPDATE SDN.TSDN_NOMINA SET "
        " fecha_inicial=TO_DATE(:1,'YYYY-MM-DD'), "
        " fecha_final=TO_DATE(:2,'YYYY-MM-DD'), "
        " ano_proceso=:3, mes_proceso=:4, periodo=:5, "
        " calculo_nomina='N', "
        " genero_archivo='N', genero_cheque='N', "
        " genero_archivo_v='N', genero_cheque_v='N', "
        " genero_archivo_r='N', genero_cheque_r='N' "
        "WHERE no_cia=:6 AND punto=:7 AND nomina=:8",
        [fecha_inicial, fecha_final, int(ano_proceso), int(mes_proceso),
         int(periodo), no_cia, punto, nomina],
    )
    client.execute(
        "INSERT INTO SDN.TSDN_AUDITORIA ("
        " no_cia, punto, ano, mes, nomina, periodo, proceso, "
        " fecha_nomina_i, fecha_nomina_f, fecha_sysdate, usuario "
        ") VALUES ( "
        " :1, :2, :3, :4, :5, :6, 'U', "
        " TO_DATE(:7,'YYYY-MM-DD'), TO_DATE(:8,'YYYY-MM-DD'), SYSDATE, :9 "
        ")",
        [no_cia, punto, int(ano_proceso), int(mes_proceso), nomina,
         int(periodo), fecha_inicial, fecha_final, (usuario or '').upper()[:30]],
    )
    resultado = get_nomina(no_cia, punto, nomina)
    resultado['periodo_anterior'] = periodo_anterior
    return resultado


def _siguiente_periodo(forma_pago: str, fecha_inicial_actual, ano_proceso: int,
                        mes_proceso: int) -> dict:
    """Calcula fecha_inicial/fecha_final/ano_proceso/mes_proceso del proximo
    periodo de pago segun FORMA_PAGO ('Q'=quincenal, la unica en produccion
    hoy; 'M'=mensual). Reemplaza el calculo "+14 dias" que hacia el
    frontend (sdn-calcular.tsx) -- incorrecto en meses de 28/29/31 dias
    porque no llegaba exactamente al fin de mes."""
    if isinstance(fecha_inicial_actual, str):
        y, m, d = (int(x) for x in fecha_inicial_actual[:10].split('-'))
        fecha_inicial_actual = _date(y, m, d)
    forma = (forma_pago or '').upper()
    if forma == 'Q':
        if fecha_inicial_actual.day == 1:
            ultimo = calendar.monthrange(ano_proceso, mes_proceso)[1]
            return {
                'fecha_inicial': _date(ano_proceso, mes_proceso, 16).isoformat(),
                'fecha_final': _date(ano_proceso, mes_proceso, ultimo).isoformat(),
                'ano_proceso': ano_proceso, 'mes_proceso': mes_proceso,
            }
        sig_ano, sig_mes = (ano_proceso + 1, 1) if mes_proceso == 12 else (ano_proceso, mes_proceso + 1)
        return {
            'fecha_inicial': _date(sig_ano, sig_mes, 1).isoformat(),
            'fecha_final': _date(sig_ano, sig_mes, 15).isoformat(),
            'ano_proceso': sig_ano, 'mes_proceso': sig_mes,
        }
    if forma == 'M':
        sig_ano, sig_mes = (ano_proceso + 1, 1) if mes_proceso == 12 else (ano_proceso, mes_proceso + 1)
        ultimo = calendar.monthrange(sig_ano, sig_mes)[1]
        return {
            'fecha_inicial': _date(sig_ano, sig_mes, 1).isoformat(),
            'fecha_final': _date(sig_ano, sig_mes, ultimo).isoformat(),
            'ano_proceso': sig_ano, 'mes_proceso': sig_mes,
        }
    raise ValueError(f"forma_pago '{forma_pago}' no soportada para avance automático de período")


_REGALIA_TASA = 1 / 12  # provision mensual de regalia (1 mes de sueldo / 12 meses)


def _lineas_asiento_cierre(no_cia: str, punto: str, nomina: str, cab: dict) -> dict:
    """Construye las lineas del asiento contable del periodo ya calculado a
    partir de TSDN_MOVIMIENTO (ingresos/deducciones reales del periodo) mas
    la provision de regalia. Cuentas tomadas de catalogos ya en uso en el
    sistema: TSDN_CUENTA_INGRESO (ingreso+grupo_contable -> cuenta gasto),
    TSDN_DEDUCCIONES.cuenta/cuenta_gasto y TSDN_NOMINA.cuenta_contable
    (nomina por pagar) / gasto_regalia / regalia_por_pagar.

    Verificado contra TSDN_DCNOMINA historico (periodo 2026-07 #13,
    generado por el Fsdn210 legado antes del fork): con estas mismas
    cuentas y reglas se reproducen exactamente las mismas lineas y montos
    para los empleados de ese periodo.

    Limitacion conocida: calcular_nomina() solo aplica automaticamente las
    deducciones del EMPLEADO (AFP 01 / SFS 02) -- los aportes PATRONALES
    (no_deduccion 50/51) no se generan solos todavia, asi que si no hay
    movimiento patronal en TSDN_MOVIMIENTO para el periodo, esas lineas
    simplemente no aparecen en el asiento; esta funcion no las inventa.
    """
    ano, mes, periodo = int(cab['ano_proceso']), int(cab['mes_proceso']), int(cab.get('periodo') or 0)
    cuenta_nomina = cab['cuenta_contable']

    movs = client.fetch_dicts(
        "SELECT m.no_empleado, m.no_transaccion, m.tipo_transaccion, "
        "       m.empleado_patrono, m.monto_transaccion, "
        "       NVL(e.grupo_contable,1) AS grupo_contable "
        "  FROM SDN.TSDN_MOVIMIENTO m "
        "  JOIN SDN.TSDN_EMPLEADO e "
        "    ON e.no_cia=m.no_cia AND e.no_empleado=m.no_empleado "
        " WHERE m.no_cia=:1 AND m.punto=:2 AND m.nomina=:3 "
        "   AND m.ano=:4 AND m.mes=:5 AND m.periodo=:6 "
        "   AND m.monto_transaccion != 0",
        [no_cia, punto, nomina, ano, mes, periodo])

    cuentas_ingreso = {
        (r['no_ingreso'], int(r['grupo_contable'])): r['cuenta']
        for r in client.fetch_dicts(
            "SELECT no_ingreso, grupo_contable, cuenta FROM SDN.TSDN_CUENTA_INGRESO", [])
    }
    deducciones = {
        r['no_deduccion']: r
        for r in client.fetch_dicts(
            "SELECT no_deduccion, cuenta, cuenta_gasto, descripcion "
            "FROM SDN.TSDN_DEDUCCIONES", [])
    }

    detalle: list[dict] = []
    faltantes: list[str] = []

    def _add(no_empleado, cuenta, tipo_movi, empleado_patrono, tipo_ed, monto):
        detalle.append({
            'no_empleado': no_empleado, 'cuenta': cuenta, 'tipo_movi': tipo_movi,
            'empleado_patrono': empleado_patrono, 'tipo_ed': tipo_ed,
            'monto': round(float(monto), 2),
        })

    for m in movs:
        monto = float(m['monto_transaccion'])
        emp = int(m['no_empleado'])
        ep = m['empleado_patrono']
        if m['tipo_transaccion'] == 'I':
            cuenta = cuentas_ingreso.get((m['no_transaccion'], int(m['grupo_contable'])))
            if not cuenta:
                faltantes.append(
                    f"Ingreso {m['no_transaccion']} sin cuenta configurada "
                    f"(grupo contable {m['grupo_contable']})")
                continue
            _add(emp, cuenta, 'D', ep, 'A', monto)
            _add(emp, cuenta_nomina, 'C', ep, 'A', monto)
        elif m['tipo_transaccion'] == 'D':
            ded = deducciones.get(m['no_transaccion'])
            if not ded:
                faltantes.append(f"Deducción {m['no_transaccion']} sin catálogo")
                continue
            if ep == 'P':
                if not ded.get('cuenta_gasto'):
                    faltantes.append(
                        f"Deducción patronal {m['no_transaccion']} sin cuenta_gasto configurada")
                    continue
                _add(emp, ded['cuenta_gasto'], 'D', ep, 'B', monto)
                _add(emp, ded['cuenta'], 'C', ep, 'B', monto)
            else:
                _add(emp, ded['cuenta'], 'C', ep, 'A', monto)
                _add(emp, cuenta_nomina, 'D', ep, 'A', monto)

    # El salario base casi nunca queda como fila 'I' en TSDN_MOVIMIENTO --
    # se calcula al vuelo (mismo fallback que ya usa volante_nomina/
    # sdn-calcular.tsx para "Resumen del calculo": salario_mensual x
    # fraccion_periodo) y solo se materializaba antes en pantalla, nunca en
    # el asiento. Sin esto el asiento quedaba "cuadrado" pero mostrando
    # solo las deducciones, sin el gasto de sueldos real.
    con_ingreso_explicito = {
        int(m['no_empleado']) for m in movs if m['tipo_transaccion'] == 'I'
    }
    fraccion_periodo = _fraccion_salario_periodo(cab)
    empleados_activos = client.fetch_dicts(
        "SELECT no_empleado, NVL(salario_mensual,0) AS salario_mensual, "
        "       NVL(grupo_contable,1) AS grupo_contable "
        "  FROM SDN.TSDN_EMPLEADO "
        " WHERE no_cia=:1 AND punto=:2 AND nomina=:3 AND fecha_egreso IS NULL",
        [no_cia, punto, nomina])
    cuenta_salario_base = cuentas_ingreso.get(('01', 1))
    for e in empleados_activos:
        emp = int(e['no_empleado'])
        if emp in con_ingreso_explicito:
            continue
        bruto = round(float(e['salario_mensual'] or 0) * fraccion_periodo, 2)
        if bruto <= 0:
            continue
        cuenta = cuentas_ingreso.get(('01', int(e['grupo_contable']))) or cuenta_salario_base
        if not cuenta:
            faltantes.append(
                f"Empleado {emp}: sin cuenta de salario configurada "
                f"(grupo contable {e['grupo_contable']})")
            continue
        _add(emp, cuenta, 'D', 'E', 'A', bruto)
        _add(emp, cuenta_nomina, 'C', 'E', 'A', bruto)

    # Provision de regalia por empleado: 1/12 de sus ingresos validos para
    # regalia en el periodo (TSDN_MOVIMIENTO.VALIDO_REGALIA='S'), mas el
    # salario base derivado arriba (valido para regalia por defecto -- ley
    # 16-92 RD, el sueldo siempre cuenta para regalia salvo excepcion).
    base_regalia_dict: dict[int, float] = {}
    for r in client.fetch_dicts(
        "SELECT no_empleado, NVL(SUM(monto_transaccion),0) AS monto "
        "  FROM SDN.TSDN_MOVIMIENTO "
        " WHERE no_cia=:1 AND punto=:2 AND nomina=:3 AND ano=:4 AND mes=:5 "
        "   AND periodo=:6 AND tipo_transaccion='I' AND valido_regalia='S' "
        " GROUP BY no_empleado",
        [no_cia, punto, nomina, ano, mes, periodo],
    ):
        base_regalia_dict[int(r['no_empleado'])] = float(r['monto'] or 0)
    for e in empleados_activos:
        emp = int(e['no_empleado'])
        if emp in con_ingreso_explicito:
            continue  # su regalia, si aplica, ya vino en la query de arriba
        bruto = round(float(e['salario_mensual'] or 0) * fraccion_periodo, 2)
        if bruto > 0:
            base_regalia_dict[emp] = base_regalia_dict.get(emp, 0.0) + bruto
    base_regalia = [{'no_empleado': k, 'monto': v} for k, v in base_regalia_dict.items()]

    monto_regalia_total = 0.0
    tiene_base_regalia = any(float(r['monto'] or 0) > 0 for r in base_regalia)
    if tiene_base_regalia:
        if not cab.get('gasto_regalia') or not cab.get('regalia_por_pagar'):
            faltantes.append("Nómina sin cuentas de regalía configuradas (gasto_regalia/regalia_por_pagar)")
        else:
            for r in base_regalia:
                monto_emp = round(float(r['monto'] or 0) * _REGALIA_TASA, 2)
                if monto_emp <= 0:
                    continue
                _add(int(r['no_empleado']), cab['gasto_regalia'], 'D', 'P', 'S', monto_emp)
                _add(int(r['no_empleado']), cab['regalia_por_pagar'], 'C', 'P', 'S', monto_emp)
                monto_regalia_total = round(monto_regalia_total + monto_emp, 2)

    resumen: dict[str, dict] = {}
    for d in detalle:
        r = resumen.setdefault(d['cuenta'], {'cuenta': d['cuenta'], 'debito': 0.0, 'credito': 0.0})
        if d['tipo_movi'] == 'D':
            r['debito'] = round(r['debito'] + d['monto'], 2)
        else:
            r['credito'] = round(r['credito'] + d['monto'], 2)

    total_debito = round(sum(r['debito'] for r in resumen.values()), 2)
    total_credito = round(sum(r['credito'] for r in resumen.values()), 2)

    return {
        'detalle': detalle,
        'resumen_cuentas': sorted(resumen.values(), key=lambda r: r['cuenta']),
        'total_debito': total_debito,
        'total_credito': total_credito,
        'cuadra': abs(total_debito - total_credito) < 0.01,
        'monto_regalia': monto_regalia_total,
        'faltantes': faltantes,
    }


def resumen_cierre(no_cia: str, punto: str, nomina: str) -> dict:
    """Fsdn210 (asiento) + Fsdn214/216 (avance de periodo) combinados en
    una sola vista: estado del periodo actual, previsualizacion del
    asiento (sin persistir) y el siguiente periodo sugerido. Antes no
    existia ninguna pantalla que mostrara esto junto -- el usuario no
    encontraba por donde cerrar el periodo (TREP_PROBLEMA f5a80e18)."""
    cab = get_nomina(no_cia, punto, nomina)
    if not cab:
        raise ValueError(f"Nómina {nomina} no existe")

    bloqueos = []
    if cab.get('estado') != 'A':
        bloqueos.append('La nómina no está activa')
    if cab.get('calculo_nomina') != 'S':
        bloqueos.append('El período actual todavía no está calculado — calcúlalo primero')

    asiento = None
    siguiente = None
    if not bloqueos:
        asiento = _lineas_asiento_cierre(no_cia, punto, nomina, cab)
        try:
            siguiente = _siguiente_periodo(
                cab['forma_pago'], cab['fecha_inicial'],
                int(cab['ano_proceso']), int(cab['mes_proceso']))
            siguiente['periodo'] = int(cab.get('periodo') or 0) + 1
        except ValueError as exc:
            bloqueos.append(str(exc))

    return {
        'nomina': cab,
        'bloqueos': bloqueos,
        'asiento': asiento,
        'siguiente_periodo': siguiente,
    }


def generar_asiento_y_cerrar(no_cia: str, punto: str, nomina: str, usuario: str) -> dict:
    """Genera el asiento del periodo ya calculado (TSDN_DCNOMINA, detalle
    por empleado) y avanza TSDN_NOMINA al siguiente periodo (avanzar_periodo)
    en un solo paso."""
    cab = get_nomina(no_cia, punto, nomina)
    if not cab:
        raise ValueError(f"Nómina {nomina} no existe")
    if cab.get('calculo_nomina') != 'S':
        raise ValueError('El período actual no está calculado — calcúlalo antes de cerrar')

    ano, mes, periodo = int(cab['ano_proceso']), int(cab['mes_proceso']), int(cab.get('periodo') or 0)

    ya_generado = client.fetch_one(
        "SELECT COUNT(*) FROM SDN.TSDN_DCNOMINA WHERE no_cia=:1 AND punto=:2 "
        "AND nomina=:3 AND ano=:4 AND mes=:5 AND periodo=:6",
        [no_cia, punto, nomina, ano, mes, periodo])
    if ya_generado and int(ya_generado[0]) > 0:
        raise ValueError('Este período ya tiene un asiento generado')

    asiento = _lineas_asiento_cierre(no_cia, punto, nomina, cab)
    if asiento['faltantes']:
        raise ValueError('Faltan cuentas contables: ' + '; '.join(asiento['faltantes']))
    if not asiento['detalle']:
        raise ValueError('El período no tiene movimientos que contabilizar')

    no_asiento_map = {'A': '0001', 'B': '0002', 'C': '0002', 'S': '0003'}

    with client.cursor() as cur:
        for d in asiento['detalle']:
            no_asiento = no_asiento_map.get(d['tipo_ed'], '0001')
            cur.execute(
                "INSERT INTO SDN.TSDN_DCNOMINA ("
                " no_cia, punto, ano, mes, nomina, periodo, no_empleado, "
                " cuenta, tipo_movi, origen, empleado_patrono, monto, "
                " centro_costo, no_asiento, ano_asiento, mes_asiento, "
                " st_generado_cnt, tipo_ed"
                ") VALUES (:1,:2,:3,:4,:5,:6,:7, :8,:9,'N',:10,:11, "
                " '0000000000',:12,:13,:14, 'S',:15)",
                [no_cia, punto, ano, mes, nomina, periodo, d['no_empleado'],
                 d['cuenta'], d['tipo_movi'], d['empleado_patrono'], d['monto'],
                 no_asiento, ano, mes, d['tipo_ed']])
        cur.execute(
            "INSERT INTO SDN.TSDN_AUDITORIA ("
            " no_cia, punto, ano, mes, nomina, periodo, proceso, "
            " fecha_nomina_i, fecha_nomina_f, fecha_sysdate, usuario "
            ") VALUES (:1,:2,:3,:4,:5,:6,'C', :7,:8, SYSDATE,:9)",
            [no_cia, punto, ano, mes, nomina, periodo,
             cab.get('fecha_inicial'), cab.get('fecha_final'), (usuario or '').upper()[:30]])
        cur.connection.commit()

    siguiente = _siguiente_periodo(cab['forma_pago'], cab['fecha_inicial'], ano, mes)
    avance = avanzar_periodo(
        no_cia, punto, nomina, usuario,
        fecha_inicial=siguiente['fecha_inicial'], fecha_final=siguiente['fecha_final'],
        ano_proceso=siguiente['ano_proceso'], mes_proceso=siguiente['mes_proceso'],
        periodo=periodo + 1,
    )

    return {
        'periodo_cerrado': {
            'ano': ano, 'mes': mes, 'periodo': periodo,
            'fecha_inicial': cab.get('fecha_inicial'), 'fecha_final': cab.get('fecha_final'),
        },
        'asiento': asiento,
        'nomina': avance,
    }


def _fraccion_salario_periodo(cabecera: dict) -> float:
    """Fraccion del salario mensual que corresponde a UN periodo de esta
    nomina, segun FORMA_PAGO ('M'=Mensual, 'Q'=Quincenal, 'S'=Semanal;
    dominio ya usado en sdn-def-nominas.tsx). Se deriva de
    FACTOR_CALCULO_DIARIO (dias/mes que la nomina usa para su tarifa diaria,
    tipicamente 30) para no inventar una constante nueva: Mensual = mismo
    factor (fraccion 1, sin cambio de comportamiento), Quincenal = 15 dias,
    Semanal = 7 dias.
    """
    forma_pago = (cabecera.get('forma_pago') or 'M').upper()
    factor_diario = float(cabecera.get('factor_calculo_diario') or 30) or 30
    dias_periodo = {'Q': 15, 'S': 7}.get(forma_pago, factor_diario)
    return dias_periodo / factor_diario


# ---- Volante (Pre-Nómina) ----
def volante_nomina(no_cia: str, punto: str, nomina: str) -> dict:
    """Devuelve la pre-nómina del período actual de la nómina:

    - Cabecera: TSDN_NOMINA (descripcion, período, fechas, estado de cálculo).
    - Por empleado: salario_mensual, suma de ingresos (TIPO_TRANSACCION='I')
      y deducciones ('D') del período, neto.
    - Totales globales.

    Si TSDN_MOVIMIENTO no tiene filas (nómina sin cálculo aún), devuelve
    los empleados activos con su salario base como ingreso bruto.
    """
    cabecera = get_nomina(no_cia, punto, nomina)
    if not cabecera:
        raise ValueError(f"Nómina {nomina} no existe")

    ano = int(cabecera['ano_proceso'])
    mes = int(cabecera['mes_proceso'])
    periodo = int(cabecera.get('periodo') or 1)
    # El salario base por periodo depende de FORMA_PAGO (M/Q/S, ya elegido al
    # crear la nomina en sdn-def-nominas.tsx): un periodo Quincenal (2 por
    # mes) o Semanal solo corresponde a una fraccion del salario mensual, no
    # al mes completo. Se deriva de FACTOR_CALCULO_DIARIO (dias por mes que
    # usa la nomina para su tarifa diaria, tipicamente 30) para mantener la
    # misma base de calculo que el resto del sistema. Antes este fallback
    # usaba siempre el salario mensual completo, duplicando el pago cuando
    # una nomina quincenal se procesaba en sus dos periodos (reporte
    # 2e651537 de MPILAR: "esta calculando los dos periodos de 15 y 30").
    fraccion_periodo = _fraccion_salario_periodo(cabecera)

    rows = client.fetch_dicts(
        "SELECT e.no_empleado, "
        "       e.nombre || ' ' || e.apellido AS nombre_empleado, "
        "       e.cedula, "
        "       NVL(e.salario_mensual, 0) AS salario_mensual, "
        "       NVL((SELECT SUM(m.monto_transaccion) "
        "              FROM SDN.TSDN_MOVIMIENTO m "
        "             WHERE m.no_cia=e.no_cia AND m.punto=e.punto "
        "               AND m.nomina=:nomina AND m.ano=:ano AND m.mes=:mes "
        "               AND m.periodo=:periodo AND m.no_empleado=e.no_empleado "
        "               AND m.tipo_transaccion='I'), 0) AS total_ingresos, "
        "       NVL((SELECT SUM(m.monto_transaccion) "
        "              FROM SDN.TSDN_MOVIMIENTO m "
        "             WHERE m.no_cia=e.no_cia AND m.punto=e.punto "
        "               AND m.nomina=:nomina AND m.ano=:ano AND m.mes=:mes "
        "               AND m.periodo=:periodo AND m.no_empleado=e.no_empleado "
        "               AND m.tipo_transaccion='D'), 0) AS total_deducciones "
        "  FROM SDN.TSDN_EMPLEADO e "
        " WHERE e.no_cia=:no_cia AND e.punto=:punto AND e.nomina=:nomina "
        "   AND e.fecha_egreso IS NULL "
        " ORDER BY e.nombre, e.apellido",
        {'no_cia': no_cia, 'punto': punto, 'nomina': nomina,
         'ano': ano, 'mes': mes, 'periodo': periodo},
    )
    detalle: list[dict] = []
    sum_salario = sum_ingresos = sum_deduc = sum_neto = 0.0
    for r in rows:
        salario = float(r.get('salario_mensual') or 0)
        ingresos = float(r.get('total_ingresos') or 0)
        deduc = float(r.get('total_deducciones') or 0)
        bruto = ingresos if ingresos > 0 else salario * fraccion_periodo
        neto = bruto - deduc
        detalle.append({
            'no_empleado': int(r['no_empleado']),
            'nombre_empleado': r.get('nombre_empleado') or '',
            'cedula': r.get('cedula') or '',
            'salario_mensual': salario,
            'total_ingresos': ingresos,
            'total_deducciones': deduc,
            'bruto': bruto,
            'neto': neto,
        })
        sum_salario += salario
        sum_ingresos += ingresos
        sum_deduc += deduc
        sum_neto += neto

    return {
        'cabecera': {
            'no_cia': no_cia, 'punto': punto, 'nomina': nomina,
            'descripcion': cabecera.get('descripcion'),
            'ano_proceso': ano, 'mes_proceso': mes, 'periodo': periodo,
            'fecha_inicial': cabecera.get('fecha_inicial'),
            'fecha_final': cabecera.get('fecha_final'),
            'estado': cabecera.get('estado'),
            'calculo_nomina': cabecera.get('calculo_nomina'),
            'forma_pago': cabecera.get('forma_pago'),
            'cuenta_contable': cabecera.get('cuenta_contable'),
        },
        'empleados': detalle,
        'totales': {
            'empleados': len(detalle),
            'salario': sum_salario,
            'ingresos': sum_ingresos,
            'deducciones': sum_deduc,
            'neto': sum_neto,
        },
    }


# ---- Movimientos manuales (Fsdn204/205) -------------------------------------

def list_movimientos(no_cia: str, punto: str, nomina: str,
                     ano: int, mes: int, periodo: int = 1,
                     no_empleado: int | None = None,
                     tipo: str | None = None,
                     origen: str | None = None) -> list[dict]:
    """Lista movimientos de la nómina/período. Origen 'M'=manual, 'N'=normal,
    'V'=vacaciones. tipo 'I'=ingreso, 'D'=deducción."""
    sql = (
        "SELECT m.no_cia, m.punto, m.nomina, m.ano, m.mes, m.periodo, "
        "       m.no_empleado, "
        "       e.nombre||' '||e.apellido AS nombre_empleado, "
        "       e.cedula, "
        "       m.no_transaccion, m.tipo_transaccion, m.origen, "
        "       m.clase_transaccion, "
        "       TO_CHAR(m.fecha,'YYYY-MM-DD') AS fecha, "
        "       NVL(m.monto_transaccion,0) AS monto_transaccion, "
        "       NVL(m.salario_mensual,0) AS salario_mensual, "
        "       m.linea, "
        "       CASE WHEN m.tipo_transaccion='I' THEN i.descripcion "
        "            WHEN m.tipo_transaccion='D' THEN d.descripcion END AS descri_concepto "
        "  FROM SDN.TSDN_MOVIMIENTO m "
        "  LEFT JOIN SDN.TSDN_EMPLEADO e "
        "         ON e.no_cia=m.no_cia AND e.no_empleado=m.no_empleado "
        "  LEFT JOIN SDN.TSDN_INGRESOS i "
        "         ON m.tipo_transaccion='I' AND i.no_ingreso=m.no_transaccion "
        "  LEFT JOIN SDN.TSDN_DEDUCCIONES d "
        "         ON m.tipo_transaccion='D' AND d.no_deduccion=m.no_transaccion "
        " WHERE m.no_cia=:1 AND m.punto=:2 AND m.nomina=:3 "
        "   AND m.ano=:4 AND m.mes=:5 AND m.periodo=:6"
    )
    params: list = [no_cia, punto, nomina, int(ano), int(mes), int(periodo)]
    if no_empleado:
        sql += f" AND m.no_empleado=:{len(params)+1}"; params.append(int(no_empleado))
    if tipo in ('I', 'D'):
        sql += f" AND m.tipo_transaccion=:{len(params)+1}"; params.append(tipo)
    if origen:
        sql += f" AND m.origen=:{len(params)+1}"; params.append(origen)
    sql += " ORDER BY m.no_empleado, m.tipo_transaccion, NVL(m.linea,0)"
    return client.fetch_dicts(sql, params)


def crear_movimiento_manual(*, no_cia: str, punto: str, nomina: str,
                            ano: int, mes: int, periodo: int,
                            no_empleado: int, tipo_transaccion: str,
                            no_transaccion: str, monto: float,
                            clase_transaccion: str = 'L',
                            empleado_patrono: str = 'E',
                            usuario: str = '') -> dict:
    """Inserta un movimiento manual (ORIGEN='M').

    tipo_transaccion: 'I'=ingreso, 'D'=deducción
    clase_transaccion: 'L'=fijo, 'O'=otro, según legado
    Reabre el cálculo de la nómina (CALCULO_NOMINA='N') para forzar recálculo.
    """
    tt = (tipo_transaccion or '').upper()
    if tt not in ('I', 'D'):
        raise ValueError("tipo_transaccion debe ser 'I' (ingreso) o 'D' (deducción)")
    nt = (no_transaccion or '').upper().strip()
    if not nt:
        raise ValueError("no_transaccion (concepto) es obligatorio")
    if monto is None:
        raise ValueError("monto es obligatorio")
    nomina = (nomina or '').upper()

    # Empleado válido + salario
    emp = client.fetch_one(
        "SELECT NVL(salario_mensual,0) FROM SDN.TSDN_EMPLEADO "
        " WHERE no_cia=:1 AND no_empleado=:2",
        [no_cia, int(no_empleado)],
    )
    if not emp:
        raise ValueError(f"Empleado {no_empleado} no existe en empresa {no_cia}")
    salario = float(emp[0] or 0)

    # Nómina válida y abierta
    cab = get_nomina(no_cia, punto, nomina)
    if not cab:
        raise ValueError(f"Nómina {nomina} no existe")
    if cab.get('estado') != 'A':
        raise ValueError(f"Nómina {nomina} no está activa")

    # Próxima línea para ese empleado en ese período
    row = client.fetch_one(
        "SELECT NVL(MAX(linea),0)+1 FROM SDN.TSDN_MOVIMIENTO "
        " WHERE no_cia=:1 AND punto=:2 AND nomina=:3 "
        "   AND ano=:4 AND mes=:5 AND periodo=:6 AND no_empleado=:7",
        [no_cia, punto, nomina, int(ano), int(mes), int(periodo), int(no_empleado)],
    )
    linea = int(row[0]) if row else 1

    client.execute(
        "INSERT INTO SDN.TSDN_MOVIMIENTO ("
        " no_cia, punto, ano, mes, nomina, periodo, no_empleado, "
        " no_transaccion, tipo_transaccion, origen, clase_transaccion, "
        " fecha, monto_transaccion, salario_mensual, "
        " valido_regalia, valido_bonificacion, tasa_transaccion, "
        " empleado_patrono, genero_ed, linea "
        ") VALUES ("
        " :1, :2, :3, :4, :5, :6, :7, "
        " :8, :9, 'M', :10, "
        " SYSDATE, :11, :12, "
        " 'N', 'N', 0, "
        " :13, 'N', :14"
        ")",
        [no_cia, punto, int(ano), int(mes), nomina, int(periodo), int(no_empleado),
         nt, tt, clase_transaccion, float(monto), salario,
         empleado_patrono, linea],
    )
    # Reabrir cálculo si estaba cerrado
    client.execute(
        "UPDATE SDN.TSDN_NOMINA SET calculo_nomina='N' "
        " WHERE no_cia=:1 AND punto=:2 AND nomina=:3",
        [no_cia, punto, nomina],
    )
    return {
        'no_cia': no_cia, 'punto': punto, 'nomina': nomina,
        'ano': int(ano), 'mes': int(mes), 'periodo': int(periodo),
        'no_empleado': int(no_empleado), 'linea': linea,
        'tipo_transaccion': tt, 'no_transaccion': nt, 'monto': float(monto),
    }


def aplicar_deduccion_masiva(*, no_cia: str, punto: str, nomina: str,
                             ano: int, mes: int, periodo: int,
                             no_deduccion: str,
                             empleados_ids: list[int] | None = None,
                             usuario: str = '',
                             dry_run: bool = False) -> dict:
    """Aplica una deducción del catálogo (TSDN_DEDUCCIONES) en lote a todos
    los empleados activos de la nómina/período. Útil para AFP/SFS/ARS/ISR.

    Cálculo:
      - Si la deducción tiene porciento_monto > 0 → monto = salario * %
      - Si tiene valor > 0 (fijo) → monto = valor
      - Si tiene ambos → prevalece % (legacy behavior)

    Idempotente: salta empleados que ya tienen una fila con ese
    no_deduccion en el período. Devuelve resumen.

    Si dry_run=True: solo calcula y devuelve la previsualización, no
    inserta nada en TSDN_MOVIMIENTO.
    """
    nomina = (nomina or '').upper()
    no_ded = (no_deduccion or '').upper().strip()
    if not no_ded:
        raise ValueError("no_deduccion es obligatorio")

    # Cabecera deducción
    ded = client.fetch_dicts(
        "SELECT no_deduccion, descripcion, descri_corta, porciento_monto, "
        "       NVL(valor,0) AS valor, empleado_patrono, clase_deduccion, status, "
        "       NVL(tope_salario_deduccion,0) AS tope "
        "  FROM SDN.TSDN_DEDUCCIONES WHERE no_deduccion=:1",
        [no_ded],
    )
    if not ded:
        raise ValueError(f"Deducción {no_ded} no existe en el catálogo")
    d = ded[0]
    if (d.get('status') or 'A').upper() != 'A':
        raise ValueError(f"Deducción {no_ded} está inactiva")

    # En el legacy: porciento_monto es un FLAG (P/M), no un número.
    #   P = el campo 'valor' es % a aplicar sobre el salario.
    #   M = el campo 'valor' es monto fijo a deducir.
    flag = str(d.get('porciento_monto') or '').strip().upper()
    valor_cat = float(d.get('valor') or 0)
    tope = float(d.get('tope') or 0)
    if flag == 'P':
        porc = valor_cat; valor_fijo = 0.0
    else:
        porc = 0.0; valor_fijo = valor_cat
    clase = (d.get('clase_deduccion') or 'L')
    ep = (d.get('empleado_patrono') or 'E')

    # Nómina activa
    cab = get_nomina(no_cia, punto, nomina)
    if not cab:
        raise ValueError(f"Nómina {nomina} no existe")
    if cab.get('estado') != 'A':
        raise ValueError(f"Nómina {nomina} no está activa (estado={cab.get('estado')})")

    # Empleados activos de la nómina
    sql_emp = (
        "SELECT e.no_empleado, e.nombre||' '||e.apellido AS nombre_empleado, "
        "       NVL(e.salario_mensual,0) AS salario "
        "  FROM SDN.TSDN_EMPLEADO e "
        " WHERE e.no_cia=:1 AND e.punto=:2 AND e.nomina=:3 "
        "   AND e.fecha_egreso IS NULL"
    )
    params: list = [no_cia, punto, nomina]
    if empleados_ids:
        ids = ','.join(str(int(i)) for i in empleados_ids if str(i).strip())
        if ids:
            sql_emp += f" AND e.no_empleado IN ({ids})"
    sql_emp += " ORDER BY e.nombre, e.apellido"
    empleados = client.fetch_dicts(sql_emp, params)

    # Movimientos ya existentes en ese período (para no duplicar)
    existentes = client.fetch_dicts(
        "SELECT no_empleado FROM SDN.TSDN_MOVIMIENTO "
        " WHERE no_cia=:1 AND punto=:2 AND nomina=:3 "
        "   AND ano=:4 AND mes=:5 AND periodo=:6 "
        "   AND no_transaccion=:7 AND tipo_transaccion='D'",
        [no_cia, punto, nomina, int(ano), int(mes), int(periodo), no_ded],
    )
    ya = {int(e['no_empleado']) for e in existentes}

    aplicados = []; saltados = []; preview = []
    for e in empleados:
        emp_id = int(e['no_empleado'])
        sal = float(e.get('salario') or 0)
        if porc > 0:
            # TOPE_SALARIO_DEDUCCION (TSDN_DEDUCCIONES) es el tope legal de
            # cotizacion (AFP 120,000 / SFS 110,000): el % no aplica sobre
            # todo el salario si este supera el tope, solo hasta el tope.
            base = min(sal, tope) if tope > 0 else sal
            monto = round(base * porc / 100.0, 2)
        else:
            monto = round(valor_fijo, 2)
        item = {
            'no_empleado': emp_id,
            'nombre_empleado': e.get('nombre_empleado') or '',
            'salario': sal,
            'monto': monto,
        }
        if emp_id in ya:
            saltados.append({**item, 'razon': 'ya tiene movimiento'})
            continue
        if monto <= 0:
            saltados.append({**item, 'razon': 'monto cero (salario o porc 0)'})
            continue
        preview.append(item)

    if dry_run:
        return {
            'deduccion': {'no_deduccion': no_ded, 'descripcion': d.get('descripcion'),
                          'porciento_monto': porc, 'valor': valor_fijo, 'tipo': 'D'},
            'periodo': f"{int(mes):02d}/{int(ano)} P{int(periodo)}",
            'preview': preview,
            'saltados': saltados,
            'total_monto': sum(p['monto'] for p in preview),
            'cantidad': len(preview),
            'dry_run': True,
        }

    # Insert real
    for it in preview:
        # Próxima línea por empleado
        row = client.fetch_one(
            "SELECT NVL(MAX(linea),0)+1 FROM SDN.TSDN_MOVIMIENTO "
            " WHERE no_cia=:1 AND punto=:2 AND nomina=:3 "
            "   AND ano=:4 AND mes=:5 AND periodo=:6 AND no_empleado=:7",
            [no_cia, punto, nomina, int(ano), int(mes), int(periodo), it['no_empleado']],
        )
        linea = int(row[0]) if row else 1
        client.execute(
            "INSERT INTO SDN.TSDN_MOVIMIENTO ("
            " no_cia, punto, ano, mes, nomina, periodo, no_empleado, "
            " no_transaccion, tipo_transaccion, origen, clase_transaccion, "
            " fecha, monto_transaccion, salario_mensual, "
            " valido_regalia, valido_bonificacion, tasa_transaccion, "
            " empleado_patrono, genero_ed, linea "
            ") VALUES ("
            " :1, :2, :3, :4, :5, :6, :7, "
            " :8, 'D', 'M', :9, "
            " SYSDATE, :10, :11, "
            " 'N', 'N', :12, :13, 'N', :14)",
            [no_cia, punto, int(ano), int(mes), nomina, int(periodo), it['no_empleado'],
             no_ded, clase, it['monto'], it['salario'], porc, ep, linea],
        )
        aplicados.append({**it, 'linea': linea})

    # Reabrir cálculo
    client.execute(
        "UPDATE SDN.TSDN_NOMINA SET calculo_nomina='N' "
        " WHERE no_cia=:1 AND punto=:2 AND nomina=:3",
        [no_cia, punto, nomina],
    )
    return {
        'deduccion': {'no_deduccion': no_ded, 'descripcion': d.get('descripcion'),
                      'porciento_monto': porc, 'valor': valor_fijo, 'tipo': 'D'},
        'periodo': f"{int(mes):02d}/{int(ano)} P{int(periodo)}",
        'aplicados': aplicados,
        'saltados': saltados,
        'total_monto': sum(p['monto'] for p in aplicados),
        'cantidad': len(aplicados),
        'dry_run': False,
    }


def eliminar_movimiento_manual(*, no_cia: str, punto: str, nomina: str,
                               ano: int, mes: int, periodo: int,
                               no_empleado: int, linea: int) -> None:
    cab = get_nomina(no_cia, punto, nomina)
    if not cab:
        raise ValueError(f"Nómina {nomina} no existe")
    if cab.get('estado') != 'A':
        raise ValueError(f"Nómina {nomina} no está activa")
    client.execute(
        "DELETE FROM SDN.TSDN_MOVIMIENTO "
        " WHERE no_cia=:1 AND punto=:2 AND nomina=:3 "
        "   AND ano=:4 AND mes=:5 AND periodo=:6 "
        "   AND no_empleado=:7 AND linea=:8 AND origen='M'",
        [no_cia, punto, nomina, int(ano), int(mes), int(periodo),
         int(no_empleado), int(linea)],
    )
    client.execute(
        "UPDATE SDN.TSDN_NOMINA SET calculo_nomina='N' "
        " WHERE no_cia=:1 AND punto=:2 AND nomina=:3",
        [no_cia, punto, nomina],
    )


# ---- Vacaciones — generación (Fsdn401) --------------------------------------

def _meses_trabajados(fecha_ingreso, hasta_ano: int) -> int:
    """Aproxima los meses trabajados a 31-dic del año dado."""
    if not fecha_ingreso:
        return 0
    try:
        anio = int(fecha_ingreso.year)
        mes = int(fecha_ingreso.month)
    except AttributeError:
        s = str(fecha_ingreso)[:10]
        anio, mes = int(s[:4]), int(s[5:7]) if len(s) >= 7 else 1
    total = (int(hasta_ano) - anio) * 12 + (12 - mes + 1)
    return max(0, total)


def generar_vacaciones(*, no_cia: str, punto: str, nomina: str, ano: int,
                       usuario: str = '', dry_run: bool = False) -> dict:
    """Recorre TSDN_EMPLEADO activos con FECHA_INGRESO < año y crea/actualiza
    TSDN_VACACIONES con cantidad_dias según TSDN_ESCALA_MESES (tipo_escala='V').
    """
    nomina = (nomina or '').upper()
    cab = get_nomina(no_cia, punto, nomina)
    if not cab:
        raise ValueError(f"Nómina {nomina} no existe")

    escala = client.fetch_dicts(
        "SELECT escala_inferior, escala_superior, cantidad_dias "
        "  FROM SDN.TSDN_ESCALA_MESES WHERE tipo_escala='V' "
        " ORDER BY escala_inferior"
    )
    if not escala:
        raise ValueError("No hay escala de vacaciones configurada (TSDN_ESCALA_MESES)")

    empleados = client.fetch_dicts(
        "SELECT no_empleado, nombre, apellido, fecha_ingreso "
        "  FROM SDN.TSDN_EMPLEADO "
        " WHERE no_cia=:1 AND punto=:2 AND nomina=:3 "
        "   AND fecha_egreso IS NULL "
        "   AND TO_CHAR(fecha_ingreso,'YYYY') < :4 "
        "   AND NVL(st_vacaciones,'N') = 'N' "
        " ORDER BY nombre, apellido",
        [no_cia, punto, nomina, str(int(ano))],
    )

    plan: list[dict] = []
    for e in empleados:
        meses = _meses_trabajados(e.get('fecha_ingreso'), int(ano))
        dias = 0
        for r in escala:
            inf = int(r['escala_inferior'])
            sup = int(r['escala_superior'])
            if inf <= meses <= sup:
                dias = int(r['cantidad_dias'])
                break
        if dias <= 0:
            continue
        plan.append({
            'no_empleado': int(e['no_empleado']),
            'nombre_empleado': f"{e.get('nombre') or ''} {e.get('apellido') or ''}".strip(),
            'fecha_ingreso': str(e['fecha_ingreso'])[:10] if e.get('fecha_ingreso') else '',
            'meses_trabajados': meses,
            'dias': dias,
        })

    if dry_run:
        return {
            'dry_run': True,
            'ano': int(ano),
            'nomina': nomina,
            'empleados': plan,
            'total_empleados': len(plan),
            'total_dias': sum(p['dias'] for p in plan),
        }

    # DELETE existentes del año y re-insertar (mismo patrón legacy Fsdn401)
    client.execute(
        "DELETE FROM SDN.TSDN_VACACIONES "
        " WHERE no_cia=:1 AND punto=:2 AND nomina=:3 "
        "   AND TO_CHAR(fecha_inicial,'YYYY')=:4",
        [no_cia, punto, nomina, str(int(ano))],
    )
    creados = 0
    for p in plan:
        client.execute(
            "INSERT INTO SDN.TSDN_VACACIONES ("
            " no_cia, punto, nomina, no_empleado, fecha_ingreso, "
            " fecha_inicial, fecha_final, cantidad_dias, usuario, st_vacaciones, "
            " tiempo_ano, tiempo_mes, tiempo_dia "
            ") VALUES ( "
            " :1, :2, :3, :4, "
            " CASE WHEN :5 IS NULL THEN NULL ELSE TO_DATE(:5,'YYYY-MM-DD') END, "
            " TO_DATE(:6,'YYYY-MM-DD'), TO_DATE(:7,'YYYY-MM-DD') + :8 - 1, "
            " :8, :9, 'N', "
            " :10, :11, :12 "
            ")",
            client.nbinds(
                no_cia, punto, nomina, p['no_empleado'],
                p.get('fecha_ingreso') or None,
                f"{int(ano)}-01-01", f"{int(ano)}-01-01", int(p['dias']),
                (usuario or '').upper()[:20],
                p['meses_trabajados'] // 12,
                p['meses_trabajados'] % 12,
                0),
        )
        creados += 1

    return {
        'dry_run': False,
        'ano': int(ano),
        'nomina': nomina,
        'creados': creados,
        'empleados': plan,
        'total_dias': sum(p['dias'] for p in plan),
    }


# ---- Solicitud de Cheques de Nómina (Fsdn409) — preview ---------------------

def preview_solicitud_cheques(*, no_cia: str, punto: str, nomina: str) -> dict:
    """Calcula qué solicitudes de cheque generaría la nómina actual.

    Para cada empleado con neto > 0 (a partir del volante) lista:
    - no_empleado, nombre, cuenta banco, salario, neto.
    El usuario aún no puede generar TCHC_CHEQUE desde el clon porque
    necesita beneficiario/cuenta autorizada — se delega al legado.
    """
    v = volante_nomina(no_cia, punto, nomina)
    detalle = []
    for emp in v['empleados']:
        neto = float(emp.get('neto') or 0)
        if neto <= 0:
            continue
        cta = client.fetch_one(
            "SELECT cuenta_banco FROM SDN.TSDN_EMPLEADO "
            " WHERE no_cia=:1 AND no_empleado=:2",
            [no_cia, int(emp['no_empleado'])],
        )
        detalle.append({
            'no_empleado': emp['no_empleado'],
            'nombre_empleado': emp['nombre_empleado'],
            'cedula': emp.get('cedula') or '',
            'cuenta_banco': (cta[0] if cta else '') or '',
            'neto': neto,
        })
    seq = client.fetch_one(
        "SELECT NVL(ult_docu,0)+1 FROM CHC.TCHC_SECUENCIA "
        " WHERE no_cia=:1 AND punto=:2 AND tipo_docu='SO'",
        [no_cia, punto],
    )
    prox_no_solicitud = int(seq[0]) if seq else 1
    return {
        'cabecera': v['cabecera'],
        'empleados': detalle,
        'totales': {
            'empleados': len(detalle),
            'total_neto': sum(d['neto'] for d in detalle),
            'prox_no_solicitud': prox_no_solicitud,
        },
    }


# ---- Informe de Nómina (Fsdn207) --------------------------------------------

def rep_informe_nomina(*, no_cia: str, punto: str, nomina: str,
                       ano: int, mes: int, periodo: int = 1,
                       no_empleado: int | None = None,
                       no_gerencia: str | None = None,
                       no_area: str | None = None,
                       no_depto: str | None = None) -> dict:
    """Devuelve, por empleado, ingresos/deducciones agregados del período +
    cabecera de la nómina + totales globales."""
    cab = get_nomina(no_cia, punto, nomina)
    if not cab:
        raise ValueError(f"Nómina {nomina} no existe")

    sql = (
        "SELECT e.no_empleado, "
        "       e.nombre||' '||e.apellido AS nombre_empleado, "
        "       e.cedula, e.no_gerencia, e.no_area, e.no_depto, "
        "       NVL(e.salario_mensual,0) AS salario_mensual, "
        "       NVL((SELECT SUM(m.monto_transaccion) "
        "              FROM SDN.TSDN_MOVIMIENTO m "
        "             WHERE m.no_cia=e.no_cia AND m.punto=e.punto "
        "               AND m.nomina=:nomina AND m.ano=:ano AND m.mes=:mes "
        "               AND m.periodo=:periodo AND m.no_empleado=e.no_empleado "
        "               AND m.tipo_transaccion='I'), 0) AS total_ingresos, "
        "       NVL((SELECT SUM(m.monto_transaccion) "
        "              FROM SDN.TSDN_MOVIMIENTO m "
        "             WHERE m.no_cia=e.no_cia AND m.punto=e.punto "
        "               AND m.nomina=:nomina AND m.ano=:ano AND m.mes=:mes "
        "               AND m.periodo=:periodo AND m.no_empleado=e.no_empleado "
        "               AND m.tipo_transaccion='D'), 0) AS total_deducciones "
        "  FROM SDN.TSDN_EMPLEADO e "
        " WHERE e.no_cia=:no_cia AND e.punto=:punto AND e.nomina=:nomina "
        "   AND e.fecha_egreso IS NULL"
    )
    params = {'no_cia': no_cia, 'punto': punto, 'nomina': (nomina or '').upper(),
              'ano': int(ano), 'mes': int(mes), 'periodo': int(periodo)}
    if no_empleado:
        sql += " AND e.no_empleado=:no_empleado"
        params['no_empleado'] = int(no_empleado)
    if no_gerencia:
        sql += " AND e.no_gerencia=:no_gerencia"
        params['no_gerencia'] = no_gerencia
    if no_area:
        sql += " AND e.no_area=:no_area"
        params['no_area'] = no_area
    if no_depto:
        sql += " AND e.no_depto=:no_depto"
        params['no_depto'] = no_depto
    sql += " ORDER BY e.nombre, e.apellido"

    fraccion_periodo = _fraccion_salario_periodo(cab)
    rows = client.fetch_dicts(sql, params)
    detalle = []
    tot_sal = tot_ing = tot_ded = tot_neto = 0.0
    for r in rows:
        sal = float(r.get('salario_mensual') or 0)
        ing = float(r.get('total_ingresos') or 0)
        ded = float(r.get('total_deducciones') or 0)
        bruto = ing if ing > 0 else sal * fraccion_periodo
        neto = bruto - ded
        tot_sal += sal; tot_ing += ing; tot_ded += ded; tot_neto += neto
        detalle.append({
            'no_empleado': int(r['no_empleado']),
            'nombre_empleado': r.get('nombre_empleado') or '',
            'cedula': r.get('cedula') or '',
            'no_gerencia': r.get('no_gerencia') or '',
            'no_area': r.get('no_area') or '',
            'no_depto': r.get('no_depto') or '',
            'salario_mensual': sal,
            'total_ingresos': ing,
            'total_deducciones': ded,
            'bruto': bruto,
            'neto': neto,
        })

    return {
        'cabecera': {
            'no_cia': no_cia, 'punto': punto, 'nomina': params['nomina'],
            'descripcion': cab.get('descripcion'),
            'ano_proceso': int(ano), 'mes_proceso': int(mes), 'periodo': int(periodo),
            'estado': cab.get('estado'),
            'calculo_nomina': cab.get('calculo_nomina'),
        },
        'empleados': detalle,
        'totales': {
            'empleados': len(detalle),
            'salario': tot_sal,
            'ingresos': tot_ing,
            'deducciones': tot_ded,
            'neto': tot_neto,
        },
    }


# ---- RNC Empleados (DGII) ---------------------------------------------------

def rep_empleados_rnc(*, no_cia: str, punto: str | None = None,
                      activos: bool = True, search: str = '') -> list[dict]:
    """Listado de empleados con cédula/RNC, AFP, ARS y salario, formato DGII."""
    sql = (
        "SELECT e.no_cia, e.punto, e.no_empleado, e.cedula, e.nss, "
        "       e.nombre, e.apellido, "
        "       NVL(e.salario_mensual,0) AS salario_mensual, "
        "       e.no_afp, afp.descripcion AS afp, "
        "       e.no_ars, ars.descripcion AS ars, "
        "       TO_CHAR(e.fecha_ingreso,'YYYY-MM-DD') AS fecha_ingreso, "
        "       TO_CHAR(e.fecha_egreso,'YYYY-MM-DD') AS fecha_egreso, "
        "       e.nomina "
        "  FROM SDN.TSDN_EMPLEADO e "
        "  LEFT JOIN SDN.TSDN_AFP afp ON afp.no_afp=e.no_afp "
        "  LEFT JOIN SDN.TSDN_ARS ars ON ars.no_ars=e.no_ars "
        " WHERE e.no_cia=:1"
    )
    params: list = [no_cia]
    if punto:
        sql += f" AND e.punto=:{len(params)+1}"; params.append(punto)
    if activos:
        sql += " AND e.fecha_egreso IS NULL"
    if search:
        sql += (f" AND (UPPER(e.nombre||' '||e.apellido) LIKE UPPER(:{len(params)+1}) "
                f"      OR e.cedula LIKE :{len(params)+1}"
                f"      OR TO_CHAR(e.no_empleado) LIKE :{len(params)+1})")
        params.append(f"%{search}%")
    sql += " ORDER BY e.nombre, e.apellido"
    return client.fetch_dicts(sql, params)


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
