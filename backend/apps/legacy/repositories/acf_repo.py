"""Activos Fijos (ACF) — repo de lectura/escritura.

Tablas principales (esquema ACF):
- TACF_CIAS / TACF_PUNTO       configuración
- TACF_ACTIVOS / TACF_ACTIVOSH activos + histórico
- TACF_CATEGORIA               categorías de activos
- TACF_GRUPO / TACF_SUBGRUPO   jerarquía
- TACF_MARCA                   catálogo de marcas
- TACF_RESPONSABLE             responsables del activo
- TACF_DEPARTAMENTO            departamento donde está ubicado
- TACF_DOCUMENTO / TACF_DCDOCU documentos (compras, retiros, depreciación)
- TACF_LOTE_ACTIVO             lotes
- TACF_CIERRE                  cierre mensual
"""
from __future__ import annotations

from .. import client


# ---- Config ----
def list_cias() -> list[dict]:
    return client.fetch_dicts(
        "SELECT no_cia, descripcion, registro_cont, activa, cuenta_caja, "
        "       ganancia_por_venta, perdida_por_venta, superavit_por_reva "
        "FROM ACF.TACF_CIAS ORDER BY no_cia"
    )


def list_puntos(no_cia: str) -> list[dict]:
    return client.fetch_dicts(
        "SELECT no_cia, punto, descripcion, activo, metodo_depre, "
        "       fecha_inicial, fecha_proceso, ano_proceso, mes_proceso, prox_activo "
        "FROM ACF.TACF_PUNTO WHERE no_cia=:1 ORDER BY punto",
        [no_cia],
    )


# ---- Catálogos ----
def list_categorias() -> list[dict]:
    rows = client.fetch_dicts(
        "SELECT * FROM ACF.TACF_CATEGORIA ORDER BY 1"
    )
    return rows


def list_grupos() -> list[dict]:
    return client.fetch_dicts("SELECT * FROM ACF.TACF_GRUPO ORDER BY 1")


def list_subgrupos() -> list[dict]:
    return client.fetch_dicts("SELECT * FROM ACF.TACF_SUBGRUPO ORDER BY 1")


def list_marcas() -> list[dict]:
    return client.fetch_dicts("SELECT * FROM ACF.TACF_MARCA ORDER BY 1")


def list_responsables() -> list[dict]:
    return client.fetch_dicts("SELECT * FROM ACF.TACF_RESPONSABLE ORDER BY 1")


def list_departamentos() -> list[dict]:
    return client.fetch_dicts("SELECT * FROM ACF.TACF_DEPARTAMENTO ORDER BY 1")


# ---- Activos ----
def list_activos(no_cia: str, punto: str | None = None,
                 status: str | None = None, tipo: str | None = None,
                 grupo: str | None = None, departamento: str | None = None,
                 search: str = '', limit: int = 200) -> list[dict]:
    sql = (
        "SELECT no_cia, punto, no_activo, descripcion, tipo_contable, tipo, "
        "       grupo, subgrupo, responsable, departamento, marca, "
        "       ano_modelo, fecha_ingreso, fecha_compra, fecha_retiro, "
        "       no_proveedor, serie, status, duracion_ano "
        "  FROM ACF.TACF_ACTIVOS WHERE no_cia=:1"
    )
    params: list = [no_cia]
    if punto:
        sql += f" AND punto=:{len(params)+1}"; params.append(punto)
    if status:
        sql += f" AND status=:{len(params)+1}"; params.append(status)
    if tipo:
        sql += f" AND tipo=:{len(params)+1}"; params.append(tipo)
    if grupo:
        sql += f" AND grupo=:{len(params)+1}"; params.append(grupo)
    if departamento:
        sql += f" AND departamento=:{len(params)+1}"; params.append(departamento)
    if search:
        sql += (f" AND (UPPER(descripcion) LIKE UPPER(:{len(params)+1}) "
                f"      OR no_activo LIKE :{len(params)+1}"
                f"      OR serie LIKE :{len(params)+1})")
        params.append(f"%{search}%")
    sql += " ORDER BY no_activo DESC"
    if limit:
        sql = f"SELECT * FROM ({sql}) WHERE ROWNUM <= {int(limit)}"
    return client.fetch_dicts(sql, params)


def get_activo(no_cia: str, punto: str, no_activo: str) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT * FROM ACF.TACF_ACTIVOS WHERE no_cia=:1 AND punto=:2 AND no_activo=:3",
        [no_cia, punto, no_activo],
    )
    return rows[0] if rows else None


# ---- Reportes ----
def rep_resumen(no_cia: str, punto: str | None = None) -> dict:
    # NVL en cada SUM: sin filas Oracle devuelve NULL en lugar de 0
    # y el frontend renderiza un "—" feo en lugar del cero real.
    sql = (
        "SELECT COUNT(*) total, "
        "       NVL(SUM(CASE WHEN status='A' THEN 1 ELSE 0 END), 0) activos, "
        "       NVL(SUM(CASE WHEN status='R' THEN 1 ELSE 0 END), 0) retirados, "
        "       NVL(SUM(CASE WHEN fecha_retiro IS NULL THEN 1 ELSE 0 END), 0) sin_retirar "
        "  FROM ACF.TACF_ACTIVOS WHERE no_cia=:1"
    )
    params: list = [no_cia]
    if punto:
        sql += f" AND punto=:{len(params)+1}"; params.append(punto)
    rows = client.fetch_dicts(sql, params)
    return rows[0] if rows else {}


def rep_activos_por_grupo(no_cia: str, punto: str | None = None) -> list[dict]:
    sql = (
        "SELECT grupo, COUNT(*) cantidad "
        "  FROM ACF.TACF_ACTIVOS WHERE no_cia=:1"
    )
    params: list = [no_cia]
    if punto:
        sql += f" AND punto=:{len(params)+1}"; params.append(punto)
    sql += " GROUP BY grupo ORDER BY cantidad DESC"
    return client.fetch_dicts(sql, params)


def rep_activos_por_departamento(no_cia: str, punto: str | None = None) -> list[dict]:
    sql = (
        "SELECT departamento, COUNT(*) cantidad, "
        "       NVL(SUM(valor_original), 0) valor_original, "
        "       NVL(SUM(depre_acumu), 0) depre_acumu "
        "  FROM ACF.TACF_ACTIVOS WHERE no_cia=:1 AND status='A'"
    )
    params: list = [no_cia]
    if punto:
        sql += f" AND punto=:{len(params)+1}"; params.append(punto)
    sql += " GROUP BY departamento ORDER BY cantidad DESC"
    return client.fetch_dicts(sql, params)


def rep_valuacion(no_cia: str, punto: str | None = None) -> dict:
    """Valuación contable global: valor original, mejoras, depreciación y valor en libros."""
    sql = (
        "SELECT NVL(SUM(valor_original), 0) valor_original, "
        "       NVL(SUM(mejora), 0) mejoras, "
        "       NVL(SUM(revalorizacion), 0) revalorizacion, "
        "       NVL(SUM(depre_acumu), 0) depre_acumu, "
        "       NVL(SUM(valor_original + NVL(mejora,0) + NVL(revalorizacion,0) - NVL(depre_acumu,0)), 0) valor_libros, "
        "       COUNT(*) cantidad "
        "  FROM ACF.TACF_ACTIVOS WHERE no_cia=:1 AND status='A'"
    )
    params: list = [no_cia]
    if punto:
        sql += f" AND punto=:{len(params)+1}"; params.append(punto)
    rows = client.fetch_dicts(sql, params)
    return rows[0] if rows else {}


# ---------------------------------------------------------------------------
# Helpers — secuencias y siguiente documento
# ---------------------------------------------------------------------------

def _next_no_activo(no_cia: str, punto: str) -> str:
    """Reserva el siguiente número de activo desde TACF_PUNTO.prox_activo."""
    row = client.fetch_one(
        "SELECT NVL(prox_activo, 0) FROM ACF.TACF_PUNTO "
        " WHERE no_cia=:1 AND punto=:2 FOR UPDATE",
        [no_cia, punto],
    )
    if row is None:
        raise ValueError('punto no encontrado en TACF_PUNTO')
    siguiente = int(row[0] or 0) + 1
    client.execute(
        "UPDATE ACF.TACF_PUNTO SET prox_activo=:1 "
        " WHERE no_cia=:2 AND punto=:3",
        [siguiente, no_cia, punto],
    )
    return str(siguiente).zfill(8)


def _next_no_docu(no_cia: str, punto: str, tipo_docu: str) -> str:
    """Próximo correlativo para TACF_DOCUMENTO por tipo."""
    row = client.fetch_one(
        "SELECT NVL(MAX(TO_NUMBER(no_docu)), 0) FROM ACF.TACF_DOCUMENTO "
        " WHERE no_cia=:1 AND punto=:2 AND tipo_docu=:3",
        [no_cia, punto, tipo_docu],
    )
    siguiente = int(row[0] or 0) + 1 if row else 1
    return str(siguiente).zfill(10)


# ---------------------------------------------------------------------------
# Compra de activo fijo (Facf201 equivalente)
# ---------------------------------------------------------------------------

# Convenciones de tipos de documento ACF (2 chars cada uno):
TIPO_DOCU_COMPRA = 'CP'
TIPO_DOCU_RETIRO = 'RT'
TIPO_DOCU_DEPRE  = 'DP'


def crear_compra(data: dict, usuario: str) -> dict:
    """Registra un activo fijo nuevo + documento de compra.

    Campos requeridos: no_cia, punto, descripcion, tipo_contable, tipo, grupo,
    subgrupo, responsable, departamento, valor_original, fecha_compra,
    duracion_ano, depreciable ('S'/'N'), cuenta (cuenta contable).
    Opcionales: marca, ano_modelo, serie, no_proveedor, detalle.
    """
    required = ['no_cia', 'punto', 'descripcion', 'tipo_contable', 'tipo',
                'grupo', 'subgrupo', 'responsable', 'departamento',
                'valor_original', 'fecha_compra', 'cuenta']
    for k in required:
        if data.get(k) in (None, ''):
            raise ValueError(f'campo requerido: {k}')

    no_cia = data['no_cia']
    punto = data['punto']
    no_activo = _next_no_activo(no_cia, punto)
    fecha_compra = data['fecha_compra']  # YYYY-MM-DD
    valor = float(data['valor_original'])
    duracion = int(data.get('duracion_ano') or 0)
    depreciable = (data.get('depreciable') or 'S').upper()

    client.execute(
        "INSERT INTO ACF.TACF_ACTIVOS ("
        " no_cia, punto, no_activo, descripcion, tipo_contable, tipo, grupo, "
        " subgrupo, responsable, departamento, marca, usuario, ano_modelo, "
        " fecha_ingreso, fecha_compra, no_proveedor, serie, status, duracion_ano, "
        " valor_original, mejora, revalorizacion, depre_acumu, depre_mes, "
        " veces_depreciado, depreciable, depreciar_primera_vez, depreciado_mes, "
        " detalle, inventariado, fecha_sysdate"
        ") VALUES ("
        " :1, :2, :3, :4, :5, :6, :7, "
        " :8, :9, :10, :11, :12, :13, "
        " TO_DATE(:14,'YYYY-MM-DD'), TO_DATE(:14,'YYYY-MM-DD'), :15, :16, 'A', :17, "
        " :18, 0, 0, 0, 0, "
        " 0, :19, 'S', 'N', "
        " :20, 'N', SYSDATE"
        ")",
        [
            no_cia, punto, no_activo, data['descripcion'][:50],
            data['tipo_contable'], data['tipo'], data['grupo'],
            data['subgrupo'], data['responsable'], data['departamento'],
            data.get('marca'), (usuario or 'API')[:30],
            int(data['ano_modelo']) if data.get('ano_modelo') else None,
            fecha_compra,
            data.get('no_proveedor'), data.get('serie'),
            duracion, valor, depreciable,
            (data.get('detalle') or '')[:100],
        ],
    )

    no_docu = _next_no_docu(no_cia, punto, TIPO_DOCU_COMPRA)
    client.execute(
        "INSERT INTO ACF.TACF_DOCUMENTO ("
        " no_cia, punto, tipo_docu, no_docu, no_activo, tipo_movi, "
        " tipo_transaccion, no_proveedor, fecha, actualizado, st_nulo, "
        " departamento, responsable, depre_acumu, depre_mes, valor_libro, "
        " monto, debito, credito, usuario, cuenta, st_generado_cnt, "
        " st_impresion, detalle, fecha_sysdate"
        ") VALUES ("
        " :1, :2, :3, :4, :5, 'C', "
        " 'N', :6, TO_DATE(:7,'YYYY-MM-DD'), 'S', 'N', "
        " :8, :9, 0, 0, :10, "
        " :10, :10, 0, :11, :12, 'N', "
        " 'N', :13, SYSDATE"
        ")",
        [
            no_cia, punto, TIPO_DOCU_COMPRA, no_docu, no_activo,
            data.get('no_proveedor'), fecha_compra,
            data['departamento'], data['responsable'], valor,
            (usuario or 'API')[:30], data['cuenta'],
            (data.get('detalle') or 'Compra de activo fijo')[:100],
        ],
    )
    return {'no_activo': no_activo, 'no_docu': no_docu, 'tipo_docu': TIPO_DOCU_COMPRA}


# ---------------------------------------------------------------------------
# Retiro de activo fijo (Facf202 equivalente)
# ---------------------------------------------------------------------------

def crear_retiro(data: dict, usuario: str) -> dict:
    """Da de baja un activo: status='R', fecha_retiro=hoy + documento."""
    required = ['no_cia', 'punto', 'no_activo', 'fecha_retiro', 'motivo', 'cuenta']
    for k in required:
        if data.get(k) in (None, ''):
            raise ValueError(f'campo requerido: {k}')

    no_cia = data['no_cia']
    punto = data['punto']
    no_activo = data['no_activo']

    act = client.fetch_dicts(
        "SELECT valor_original, mejora, revalorizacion, depre_acumu, status, "
        "       departamento, responsable "
        "  FROM ACF.TACF_ACTIVOS WHERE no_cia=:1 AND punto=:2 AND no_activo=:3",
        [no_cia, punto, no_activo],
    )
    if not act:
        raise ValueError(f'activo {no_activo} no encontrado')
    a = act[0]
    if a['status'] == 'R':
        raise ValueError('el activo ya está retirado')

    valor_libros = (float(a['valor_original'] or 0)
                    + float(a['mejora'] or 0)
                    + float(a['revalorizacion'] or 0)
                    - float(a['depre_acumu'] or 0))

    client.execute(
        "UPDATE ACF.TACF_ACTIVOS SET status='R', "
        "       fecha_retiro=TO_DATE(:1,'YYYY-MM-DD') "
        " WHERE no_cia=:2 AND punto=:3 AND no_activo=:4",
        [data['fecha_retiro'], no_cia, punto, no_activo],
    )

    no_docu = _next_no_docu(no_cia, punto, TIPO_DOCU_RETIRO)
    client.execute(
        "INSERT INTO ACF.TACF_DOCUMENTO ("
        " no_cia, punto, tipo_docu, no_docu, no_activo, tipo_movi, "
        " tipo_transaccion, fecha, actualizado, st_nulo, "
        " departamento, responsable, depre_acumu, depre_mes, valor_libro, "
        " monto, debito, credito, usuario, cuenta, st_generado_cnt, "
        " st_impresion, detalle, fecha_sysdate"
        ") VALUES ("
        " :1, :2, :3, :4, :5, 'R', "
        " 'N', TO_DATE(:6,'YYYY-MM-DD'), 'S', 'N', "
        " :7, :8, :9, 0, :10, "
        " :10, 0, :10, :11, :12, 'N', "
        " 'N', :13, SYSDATE"
        ")",
        [
            no_cia, punto, TIPO_DOCU_RETIRO, no_docu, no_activo,
            data['fecha_retiro'],
            a['departamento'], a['responsable'],
            float(a['depre_acumu'] or 0), valor_libros,
            (usuario or 'API')[:30], data['cuenta'],
            (data.get('motivo') or 'Retiro de activo fijo')[:100],
        ],
    )
    return {
        'no_activo': no_activo, 'no_docu': no_docu, 'tipo_docu': TIPO_DOCU_RETIRO,
        'valor_libros': valor_libros,
    }


# ---------------------------------------------------------------------------
# Depreciación mensual (Facf301 equivalente)
# ---------------------------------------------------------------------------

def depreciacion_preview(no_cia: str, punto: str) -> dict:
    """Calcula cuántos activos se depreciarían y el total estimado del mes."""
    p = client.fetch_dicts(
        "SELECT ano_proceso, mes_proceso, metodo_depre "
        "  FROM ACF.TACF_PUNTO WHERE no_cia=:1 AND punto=:2",
        [no_cia, punto],
    )
    if not p:
        return {'error': 'punto no encontrado'}
    ano = int(p[0]['ano_proceso']); mes = int(p[0]['mes_proceso'])
    rows = client.fetch_dicts(
        "SELECT COUNT(*) cantidad, "
        "       NVL(SUM(CASE WHEN duracion_ano>0 "
        "                    THEN (valor_original + NVL(mejora,0)) / (duracion_ano*12) "
        "                    ELSE 0 END), 0) total_estimado "
        "  FROM ACF.TACF_ACTIVOS "
        " WHERE no_cia=:1 AND punto=:2 "
        "   AND status='A' AND depreciable='S' AND depreciado_mes='N' "
        "   AND (duracion_ano > 0) "
        "   AND (depre_acumu < (valor_original + NVL(mejora,0)))",
        [no_cia, punto],
    )
    return {
        'periodo': f'{mes:02d}/{ano}',
        'metodo': p[0]['metodo_depre'],
        'cantidad': int(rows[0]['cantidad']) if rows else 0,
        'total_estimado': float(rows[0]['total_estimado']) if rows else 0,
    }


def aplicar_depreciacion(no_cia: str, punto: str, usuario: str,
                         cuenta_gasto: str, cuenta_acumulada: str) -> dict:
    """Recorre activos depreciables y aplica un mes de depreciación lineal.

    Para cada activo:
      depre_mes = (valor_original + mejora) / (duracion_ano*12)
      ajusta a no pasar (valor_original + mejora - depre_acumu).
    Inserta un TACF_DOCUMENTO de tipo 'D' por activo y marca depreciado_mes='S'.
    """
    p = client.fetch_dicts(
        "SELECT ano_proceso, mes_proceso "
        "  FROM ACF.TACF_PUNTO WHERE no_cia=:1 AND punto=:2",
        [no_cia, punto],
    )
    if not p:
        raise ValueError('punto no encontrado')
    ano = int(p[0]['ano_proceso']); mes = int(p[0]['mes_proceso'])

    activos = client.fetch_dicts(
        "SELECT no_activo, descripcion, valor_original, mejora, depre_acumu, "
        "       duracion_ano, departamento, responsable "
        "  FROM ACF.TACF_ACTIVOS "
        " WHERE no_cia=:1 AND punto=:2 "
        "   AND status='A' AND depreciable='S' AND depreciado_mes='N' "
        "   AND duracion_ano > 0 "
        "   AND (depre_acumu < (valor_original + NVL(mejora,0)))",
        [no_cia, punto],
    )

    total = 0.0
    procesados = 0
    fecha = f'{ano}-{mes:02d}-01'
    for a in activos:
        valor_base = float(a['valor_original'] or 0) + float(a['mejora'] or 0)
        meses = int(a['duracion_ano']) * 12
        cuota = round(valor_base / meses, 2) if meses else 0
        restante = valor_base - float(a['depre_acumu'] or 0)
        cuota = min(cuota, restante)
        if cuota <= 0:
            continue
        client.execute(
            "UPDATE ACF.TACF_ACTIVOS SET "
            "  depre_mes=:1, "
            "  depre_acumu=depre_acumu + :1, "
            "  veces_depreciado=NVL(veces_depreciado,0) + 1, "
            "  fecha_ult_depre=TO_DATE(:2,'YYYY-MM-DD'), "
            "  depreciado_mes='S' "
            " WHERE no_cia=:3 AND punto=:4 AND no_activo=:5",
            [cuota, fecha, no_cia, punto, a['no_activo']],
        )
        no_docu = _next_no_docu(no_cia, punto, TIPO_DOCU_DEPRE)
        client.execute(
            "INSERT INTO ACF.TACF_DOCUMENTO ("
            " no_cia, punto, tipo_docu, no_docu, no_activo, tipo_movi, "
            " tipo_transaccion, fecha, actualizado, st_nulo, "
            " departamento, responsable, depre_acumu, depre_mes, valor_libro, "
            " monto, debito, credito, usuario, cuenta, st_generado_cnt, "
            " st_impresion, detalle, fecha_sysdate"
            ") VALUES ("
            " :1, :2, :3, :4, :5, 'D', "
            " 'N', TO_DATE(:6,'YYYY-MM-DD'), 'S', 'N', "
            " :7, :8, :9, :10, :11, "
            " :10, :10, :10, :12, :13, 'N', "
            " 'N', :14, SYSDATE"
            ")",
            [
                no_cia, punto, TIPO_DOCU_DEPRE, no_docu, a['no_activo'],
                fecha,
                a['departamento'], a['responsable'],
                float(a['depre_acumu'] or 0) + cuota, cuota,
                valor_base - (float(a['depre_acumu'] or 0) + cuota),
                (usuario or 'API')[:30], cuenta_gasto,
                f'Depreciación {mes:02d}/{ano} — {a["descripcion"][:70]}',
            ],
        )
        total += cuota
        procesados += 1

    return {
        'periodo': f'{mes:02d}/{ano}',
        'procesados': procesados,
        'total_depreciado': total,
    }


# ---------------------------------------------------------------------------
# Cierre mensual ACF (Facf403 equivalente)
# ---------------------------------------------------------------------------

def list_cierres(no_cia: str, punto: str, ano: int | None = None) -> list[dict]:
    sql = (
        "SELECT no_cia, punto, ano, mes, "
        "       TO_CHAR(fecha_cierre,'YYYY-MM-DD HH24:MI:SS') fecha_cierre, "
        "       usuario "
        "  FROM ACF.TACF_CIERRE WHERE no_cia=:1 AND punto=:2"
    )
    params: list = [no_cia, punto]
    if ano:
        sql += f" AND ano=:{len(params)+1}"; params.append(int(ano))
    sql += " ORDER BY ano DESC, mes DESC"
    return client.fetch_dicts(sql, params)


def cierre_status(no_cia: str, punto: str) -> dict:
    """Período activo + activos pendientes de depreciar / docs sin contabilizar."""
    p = client.fetch_dicts(
        "SELECT no_cia, punto, ano_proceso, mes_proceso, descripcion, metodo_depre "
        "  FROM ACF.TACF_PUNTO WHERE no_cia=:1 AND punto=:2",
        [no_cia, punto],
    )
    if not p:
        return {'error': 'punto no encontrado'}
    cab = p[0]
    sin_depre = client.fetch_one(
        "SELECT COUNT(*) FROM ACF.TACF_ACTIVOS "
        " WHERE no_cia=:1 AND punto=:2 "
        "   AND status='A' AND depreciable='S' AND depreciado_mes='N' "
        "   AND duracion_ano > 0 "
        "   AND (depre_acumu < (valor_original + NVL(mejora,0)))",
        [no_cia, punto],
    )
    sin_cnt = client.fetch_one(
        "SELECT COUNT(*) FROM ACF.TACF_DOCUMENTO "
        " WHERE no_cia=:1 AND punto=:2 "
        "   AND (st_nulo<>'S' OR st_nulo IS NULL) "
        "   AND (st_generado_cnt='N' OR st_generado_cnt IS NULL)",
        [no_cia, punto],
    )
    return {
        'punto': cab,
        'activos_sin_depreciar': int(sin_depre[0]) if sin_depre else 0,
        'documentos_sin_contabilizar': int(sin_cnt[0]) if sin_cnt else 0,
    }


def aplicar_cierre(no_cia: str, punto: str, usuario: str) -> dict:
    """Inserta TACF_CIERRE + avanza TACF_PUNTO.mes_proceso al siguiente mes.

    Requiere que no haya activos pendientes de depreciar en el mes actual.
    """
    p = client.fetch_dicts(
        "SELECT ano_proceso, mes_proceso "
        "  FROM ACF.TACF_PUNTO WHERE no_cia=:1 AND punto=:2",
        [no_cia, punto],
    )
    if not p:
        raise ValueError('punto no existe')
    ano = int(p[0]['ano_proceso']); mes = int(p[0]['mes_proceso'])

    ya = client.fetch_one(
        "SELECT 1 FROM ACF.TACF_CIERRE "
        " WHERE no_cia=:1 AND punto=:2 AND ano=:3 AND mes=:4",
        [no_cia, punto, ano, mes],
    )
    if ya:
        raise ValueError(f'período {mes:02d}/{ano} ya está cerrado')

    pend = client.fetch_one(
        "SELECT COUNT(*) FROM ACF.TACF_ACTIVOS "
        " WHERE no_cia=:1 AND punto=:2 "
        "   AND status='A' AND depreciable='S' AND depreciado_mes='N' "
        "   AND duracion_ano > 0 "
        "   AND (depre_acumu < (valor_original + NVL(mejora,0)))",
        [no_cia, punto],
    )
    if pend and int(pend[0]) > 0:
        raise ValueError(
            f'hay {int(pend[0])} activos pendientes de depreciar en {mes:02d}/{ano}; '
            'aplique la depreciación del mes antes de cerrar.'
        )

    client.execute(
        "INSERT INTO ACF.TACF_CIERRE "
        "(no_cia, punto, ano, mes, fecha_cierre, fecha_sysdate, usuario) "
        "VALUES (:1, :2, :3, :4, SYSDATE, SYSDATE, :5)",
        [no_cia, punto, ano, mes, (usuario or 'API')[:30]],
    )
    # Reset depreciado_mes para el próximo período
    client.execute(
        "UPDATE ACF.TACF_ACTIVOS SET depreciado_mes='N' "
        " WHERE no_cia=:1 AND punto=:2 AND status='A'",
        [no_cia, punto],
    )
    nuevo_mes = 1 if mes == 12 else mes + 1
    nuevo_ano = ano + 1 if mes == 12 else ano
    client.execute(
        "UPDATE ACF.TACF_PUNTO SET ano_proceso=:1, mes_proceso=:2 "
        " WHERE no_cia=:3 AND punto=:4",
        [nuevo_ano, nuevo_mes, no_cia, punto],
    )
    return {
        'cerrado': f'{mes:02d}/{ano}',
        'nuevo_periodo': f'{nuevo_mes:02d}/{nuevo_ano}',
    }
