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
        [no_cia, punto, nomina, descripcion, forma_pago,
         fecha_inicial, fecha_final, cuenta_contable, cuenta_bancaria,
         mes_proceso, ano_proceso, mes_cierre, periodo,
         factor_horas, factor_diario,
         metodo_pago, gasto_regalia, regalia_por_pagar, tipo_moneda],
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
def calcular_nomina(no_cia: str, punto: str, nomina: str, usuario: str) -> dict:
    """Marca CALCULO_NOMINA='S' en TSDN_NOMINA y registra auditoría.

    MVP: cierra la definición. El cálculo de movimientos detallados
    queda a cargo del proceso legacy hasta que se implemente la lógica
    de ingresos/deducciones por concepto (forma legacy Fsdn202/Fsdn203).
    """
    cur = get_nomina(no_cia, punto, nomina)
    if not cur:
        raise ValueError(f"Nómina {nomina} no existe")
    if cur.get('estado') != 'A':
        raise ValueError(f"Nómina {nomina} no está activa")
    if cur.get('calculo_nomina') == 'S':
        raise ValueError(f"Nómina {nomina} ya fue calculada")

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
    return get_nomina(no_cia, punto, nomina)


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
        " ORDER BY e.apellido, e.nombre",
        {'no_cia': no_cia, 'punto': punto, 'nomina': nomina,
         'ano': ano, 'mes': mes, 'periodo': periodo},
    )
    detalle: list[dict] = []
    sum_salario = sum_ingresos = sum_deduc = sum_neto = 0.0
    for r in rows:
        salario = float(r.get('salario_mensual') or 0)
        ingresos = float(r.get('total_ingresos') or 0)
        deduc = float(r.get('total_deducciones') or 0)
        bruto = ingresos if ingresos > 0 else salario
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
