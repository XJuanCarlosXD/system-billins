"""Órdenes de Compra (ODC) — repo de lectura/escritura.

Tablas Oracle del módulo (esquema ODC):
- TODC_CIAS                 config por empresa
- TODC_PUNTO                config por punto + secuencias PROX_ORDEN/PROX_REQUISICION
- TODC_USUARIO              permisos detallados por usuario y punto
- TODC_ORDEN / TODC_ORDENL  cabecera y detalle de orden de compra
- TODC_REQUISICION / TODC_REQUISICIONL  cabecera y detalle de requisición interna
- TODC_REQUISICION_TMP      buffer temporal por usuario (no se expone)

Patrón: funciones puras tipo list_/get_/create_/update_ usando client.fetch_dicts /
fetch_one / execute para mantener paridad con cxp_repo / cxc_repo.
"""
from __future__ import annotations

from datetime import date, datetime
from .. import client


# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------

def list_cias() -> list[dict]:
    return client.fetch_dicts(
        "SELECT no_cia, descripcion, activa, usa_requisicion "
        "FROM ODC.TODC_CIAS ORDER BY no_cia"
    )


def get_cia(no_cia: str) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT no_cia, descripcion, activa, usa_requisicion "
        "FROM ODC.TODC_CIAS WHERE no_cia = :1",
        [no_cia],
    )
    return rows[0] if rows else None


def upsert_cia(no_cia: str, descripcion: str, activa: str = 'S',
               usa_requisicion: str = 'N') -> None:
    existing = get_cia(no_cia)
    if existing:
        client.execute(
            "UPDATE ODC.TODC_CIAS SET descripcion=:1, activa=:2, usa_requisicion=:3 "
            "WHERE no_cia=:4",
            [descripcion, activa, usa_requisicion, no_cia],
        )
    else:
        client.execute(
            "INSERT INTO ODC.TODC_CIAS (no_cia, descripcion, activa, usa_requisicion) "
            "VALUES (:1, :2, :3, :4)",
            [no_cia, descripcion, activa, usa_requisicion],
        )


def list_puntos(no_cia: str) -> list[dict]:
    return client.fetch_dicts(
        "SELECT no_cia, punto, descripcion, activo, prox_orden, prox_requisicion "
        "FROM ODC.TODC_PUNTO WHERE no_cia=:1 ORDER BY punto",
        [no_cia],
    )


def get_punto(no_cia: str, punto: str) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT no_cia, punto, descripcion, activo, prox_orden, prox_requisicion "
        "FROM ODC.TODC_PUNTO WHERE no_cia=:1 AND punto=:2",
        [no_cia, punto],
    )
    return rows[0] if rows else None


def upsert_punto(no_cia: str, punto: str, descripcion: str, activo: str = 'S',
                 prox_orden: int = 1, prox_requisicion: int = 1) -> None:
    existing = get_punto(no_cia, punto)
    if existing:
        client.execute(
            "UPDATE ODC.TODC_PUNTO SET descripcion=:1, activo=:2, "
            "prox_orden=:3, prox_requisicion=:4 WHERE no_cia=:5 AND punto=:6",
            [descripcion, activo, prox_orden, prox_requisicion, no_cia, punto],
        )
    else:
        client.execute(
            "INSERT INTO ODC.TODC_PUNTO "
            "(no_cia, punto, descripcion, activo, prox_orden, prox_requisicion) "
            "VALUES (:1, :2, :3, :4, :5, :6)",
            [no_cia, punto, descripcion, activo, prox_orden, prox_requisicion],
        )


def list_usuarios(no_cia: str, punto: str | None = None) -> list[dict]:
    sql = (
        "SELECT no_cia, punto, usuario, por_defecto, activo, crear_odc_inv, "
        "crear_odc_suministro, generar_rep_odc, imprimir_odc, reimprimir_odc, "
        "anular_odc, crear_requisicion, anular_requisicion, cerrar_requisicion, "
        "autorizar_requisicion, autorizacion_1, autorizacion_2, autorizacion_3, "
        "monto_minimo, monto_maximo, cerrar_orden "
        "FROM ODC.TODC_USUARIO WHERE no_cia=:1 "
    )
    params: list = [no_cia]
    if punto:
        sql += "AND punto=:2 "
        params.append(punto)
    sql += "ORDER BY punto, usuario"
    return client.fetch_dicts(sql, params)


def get_usuario(no_cia: str, punto: str, usuario: str) -> dict | None:
    rows = list_usuarios(no_cia, punto)
    return next((r for r in rows if r['usuario'].upper() == usuario.upper()), None)


def upsert_usuario(no_cia: str, punto: str, usuario: str, data: dict) -> None:
    existing = get_usuario(no_cia, punto, usuario)
    cols = [
        'por_defecto', 'activo', 'crear_odc_inv', 'crear_odc_suministro',
        'generar_rep_odc', 'imprimir_odc', 'reimprimir_odc', 'anular_odc',
        'crear_requisicion', 'anular_requisicion', 'cerrar_requisicion',
        'autorizar_requisicion', 'autorizacion_1', 'autorizacion_2',
        'autorizacion_3', 'monto_minimo', 'monto_maximo', 'cerrar_orden',
    ]
    defaults = {
        'por_defecto': 'N', 'activo': 'S', 'crear_odc_inv': 'N',
        'crear_odc_suministro': 'N', 'generar_rep_odc': 'N',
        'imprimir_odc': 'N', 'reimprimir_odc': 'N', 'anular_odc': 'N',
        'crear_requisicion': 'N', 'anular_requisicion': 'N',
        'cerrar_requisicion': 'N', 'autorizar_requisicion': 'N',
        'autorizacion_1': None, 'autorizacion_2': None, 'autorizacion_3': None,
        'monto_minimo': 0, 'monto_maximo': 0, 'cerrar_orden': 'N',
    }
    values = {c: data.get(c, defaults[c]) for c in cols}

    if existing:
        sets = ', '.join(f"{c}=:{i+1}" for i, c in enumerate(cols))
        params = [values[c] for c in cols] + [no_cia, punto, usuario]
        client.execute(
            f"UPDATE ODC.TODC_USUARIO SET {sets} "
            f"WHERE no_cia=:{len(cols)+1} AND punto=:{len(cols)+2} AND usuario=:{len(cols)+3}",
            params,
        )
    else:
        all_cols = ['no_cia', 'punto', 'usuario'] + cols
        placeholders = ', '.join(f":{i+1}" for i in range(len(all_cols)))
        params = [no_cia, punto, usuario] + [values[c] for c in cols]
        client.execute(
            f"INSERT INTO ODC.TODC_USUARIO ({', '.join(all_cols)}) VALUES ({placeholders})",
            params,
        )


def delete_usuario(no_cia: str, punto: str, usuario: str) -> None:
    client.execute(
        "DELETE FROM ODC.TODC_USUARIO WHERE no_cia=:1 AND punto=:2 AND usuario=:3",
        [no_cia, punto, usuario],
    )


# ---------------------------------------------------------------------------
# Órdenes de Compra
# ---------------------------------------------------------------------------

def count_ordenes(no_cia: str) -> int:
    row = client.fetch_one(
        "SELECT COUNT(*) FROM ODC.TODC_ORDEN WHERE no_cia=:1",
        [no_cia],
    )
    return int(row[0]) if row else 0


def list_ordenes(no_cia: str, punto: str | None = None,
                 estado: str | None = None, st_anulado: str | None = None,
                 no_proveedor: str | None = None,
                 fecha_desde: str | None = None, fecha_hasta: str | None = None,
                 limit: int = 200) -> list[dict]:
    """Lista órdenes con join al nombre del proveedor."""
    sql = (
        "SELECT o.no_cia, o.punto, o.no_orden, o.no_proveedor, "
        "       p.nombre AS nombre_proveedor, p.rnc, "
        "       o.fecha, o.fecha_entrega, o.total_neto, o.impuesto, o.descuento, "
        "       o.total_linea, o.usuario, o.st_impresion, o.st_anulado, o.estado, "
        "       o.tipo_orden, o.plazo_pago, o.condicion_pago, o.detalle, "
        "       o.no_cotizacion, o.no_requisicion, o.no_localidad, o.autorizada_por "
        "  FROM ODC.TODC_ORDEN o "
        "  LEFT JOIN CXP.TCXP_DPROVEEDOR p ON p.no_proveedor = o.no_proveedor "
        " WHERE o.no_cia = :1"
    )
    params: list = [no_cia]
    if punto:
        params.append(punto); sql += f" AND o.punto = :{len(params)}"
    if estado:
        params.append(estado); sql += f" AND o.estado = :{len(params)}"
    if st_anulado:
        params.append(st_anulado); sql += f" AND NVL(o.st_anulado,'A') = :{len(params)}"
    if no_proveedor:
        params.append(no_proveedor); sql += f" AND o.no_proveedor = :{len(params)}"
    if fecha_desde:
        params.append(fecha_desde); sql += f" AND TRUNC(o.fecha) >= TO_DATE(:{len(params)}, 'YYYY-MM-DD')"
    if fecha_hasta:
        params.append(fecha_hasta); sql += f" AND TRUNC(o.fecha) <= TO_DATE(:{len(params)}, 'YYYY-MM-DD')"
    sql += " ORDER BY o.fecha DESC, o.no_orden DESC"
    if limit:
        sql = (
            f"SELECT * FROM ({sql}) WHERE ROWNUM <= {int(limit)}"
        )
    return client.fetch_dicts(sql, params)


def get_orden(no_cia: str, punto: str, no_orden: str) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT o.*, p.nombre AS nombre_proveedor, p.rnc AS rnc_proveedor "
        "  FROM ODC.TODC_ORDEN o "
        "  LEFT JOIN CXP.TCXP_DPROVEEDOR p ON p.no_proveedor = o.no_proveedor "
        " WHERE o.no_cia=:1 AND o.punto=:2 AND o.no_orden=:3",
        [no_cia, punto, no_orden],
    )
    return rows[0] if rows else None


def list_lineas_orden(no_cia: str, punto: str, no_orden: str) -> list[dict]:
    return client.fetch_dicts(
        "SELECT l.no_linea, l.no_produ, p.descri AS descripcion_producto, "
        "       l.cantidad_pedida, l.cantidad_recibida, l.costo, "
        "       l.porc_descuento, l.descuento, l.impuesto, l.monto_neto, "
        "       l.empaque, l.cpe, l.linea_requisicion, l.nota, "
        "       l.porciento_impuesto, l.porc_impuesto "
        "  FROM ODC.TODC_ORDENL l "
        "  LEFT JOIN INV.TINV_PRODUCTO p ON p.no_produ = l.no_produ "
        " WHERE l.no_cia=:1 AND l.punto=:2 AND l.no_orden=:3 "
        " ORDER BY l.no_linea",
        [no_cia, punto, no_orden],
    )


def next_no_orden(no_cia: str, punto: str) -> str:
    row = client.fetch_one(
        "SELECT NVL(prox_orden,1) FROM ODC.TODC_PUNTO "
        " WHERE no_cia=:1 AND punto=:2 FOR UPDATE",
        [no_cia, punto],
    )
    prox = int(row[0]) if row else 1
    client.execute(
        "UPDATE ODC.TODC_PUNTO SET prox_orden = NVL(prox_orden,0)+1 "
        " WHERE no_cia=:1 AND punto=:2",
        [no_cia, punto],
    )
    return str(prox).zfill(8)


def create_orden(no_cia: str, punto: str, cabecera: dict, lineas: list[dict],
                 usuario: str) -> str:
    """Crea orden con cabecera + líneas. Retorna no_orden generado."""
    no_orden = next_no_orden(no_cia, punto)
    fecha = cabecera.get('fecha') or date.today().isoformat()
    fecha_entrega = cabecera.get('fecha_entrega') or fecha
    total_linea = sum(float(l.get('cantidad_pedida', 0)) * float(l.get('costo', 0))
                      for l in lineas)
    descuento = sum(float(l.get('descuento', 0)) for l in lineas)
    impuesto = sum(float(l.get('impuesto', 0)) for l in lineas)
    total_neto = total_linea - descuento + impuesto

    client.execute(
        "INSERT INTO ODC.TODC_ORDEN ("
        " no_cia, punto, no_orden, no_proveedor, fecha, fecha_entrega, "
        " tasa_us, porc_impuesto, impuesto, descuento, total_neto, total_linea, "
        " usuario, st_impresion, st_anulado, estado, tipo_orden, plazo_pago, "
        " condicion_pago, detalle, no_localidad"
        ") VALUES ("
        " :1, :2, :3, :4, TO_DATE(:5,'YYYY-MM-DD'), TO_DATE(:6,'YYYY-MM-DD'),"
        " :7, :8, :9, :10, :11, :12,"
        " :13, 'N', 'A', :14, :15, :16,"
        " :17, :18, :19)",
        [
            no_cia, punto, no_orden, cabecera['no_proveedor'], fecha, fecha_entrega,
            cabecera.get('tasa_us', 1), cabecera.get('porc_impuesto', 18),
            impuesto, descuento, total_neto, total_linea,
            usuario, cabecera.get('estado', 'P'), cabecera.get('tipo_orden', 'I'),
            cabecera.get('plazo_pago', 0),
            cabecera.get('condicion_pago'), cabecera.get('detalle'),
            cabecera.get('no_localidad'),
        ],
    )

    for i, ln in enumerate(lineas, start=1):
        client.execute(
            "INSERT INTO ODC.TODC_ORDENL ("
            " no_cia, punto, no_orden, no_linea, no_produ, "
            " cantidad_pedida, cantidad_recibida, costo, "
            " porc_descuento, descuento, impuesto, monto_neto, "
            " empaque, cpe, linea_requisicion, nota, porciento_impuesto"
            ") VALUES ("
            " :1, :2, :3, :4, :5, :6, 0, :7, :8, :9, :10, :11, :12, :13, :14, :15, :16)",
            [
                no_cia, punto, no_orden, i, ln['no_produ'],
                ln['cantidad_pedida'], ln['costo'],
                ln.get('porc_descuento', 0), ln.get('descuento', 0),
                ln.get('impuesto', 0), ln.get('monto_neto', 0),
                ln.get('empaque', 1), ln.get('cpe', 1),
                ln.get('linea_requisicion'), ln.get('nota'),
                ln.get('porciento_impuesto', 0),
            ],
        )
    return no_orden


def anular_orden(no_cia: str, punto: str, no_orden: str, motivo: str = '') -> None:
    # Dominio real legado: st_anulado 'A'=Activa / 'N'=Anulada.
    # El estado conserva su valor; el rastro de anulación queda en st_anulado y detalle.
    client.execute(
        "UPDATE ODC.TODC_ORDEN SET st_anulado='N', "
        " detalle = SUBSTR(NVL(detalle,'')||' [ANULADA: '||:1||']',1,2000) "
        " WHERE no_cia=:2 AND punto=:3 AND no_orden=:4",
        [motivo or 'sin motivo', no_cia, punto, no_orden],
    )


def autorizar_orden(no_cia: str, punto: str, no_orden: str, usuario: str) -> None:
    # En el legado autorizar = poblar AUTORIZADA_POR. El estado permanece 'P'
    # (Pendiente de recepción) hasta que se reciba (-> 'R').
    client.execute(
        "UPDATE ODC.TODC_ORDEN SET autorizada_por=:1 "
        " WHERE no_cia=:2 AND punto=:3 AND no_orden=:4",
        [usuario, no_cia, punto, no_orden],
    )


def cerrar_orden(no_cia: str, punto: str, no_orden: str) -> None:
    # Cerrar = marcar como Recibida. Dominio real de estado: I/P/R (no C ni N).
    client.execute(
        "UPDATE ODC.TODC_ORDEN SET estado='R' "
        " WHERE no_cia=:1 AND punto=:2 AND no_orden=:3",
        [no_cia, punto, no_orden],
    )


# ---------------------------------------------------------------------------
# Requisiciones internas
# ---------------------------------------------------------------------------

def list_requisiciones(no_cia: str, punto: str | None = None,
                       estado: str | None = None,
                       fecha_desde: str | None = None,
                       fecha_hasta: str | None = None,
                       limit: int = 200) -> list[dict]:
    sql = (
        "SELECT r.no_cia, r.punto, r.no_requisicion, r.fecha, r.fecha_entrega, "
        "       r.usuario, r.procesado_almacen, r.st_anulado, r.estado, "
        "       r.tipo_requisicion, r.cerrada, r.st_impresion, r.detalle, "
        "       r.no_localidad, r.no_depto, r.consolidada "
        "  FROM ODC.TODC_REQUISICION r "
        " WHERE r.no_cia = :1"
    )
    params: list = [no_cia]
    if punto:
        params.append(punto); sql += f" AND r.punto = :{len(params)}"
    if estado:
        params.append(estado); sql += f" AND r.estado = :{len(params)}"
    if fecha_desde:
        params.append(fecha_desde); sql += f" AND TRUNC(r.fecha) >= TO_DATE(:{len(params)},'YYYY-MM-DD')"
    if fecha_hasta:
        params.append(fecha_hasta); sql += f" AND TRUNC(r.fecha) <= TO_DATE(:{len(params)},'YYYY-MM-DD')"
    sql += " ORDER BY r.fecha DESC, r.no_requisicion DESC"
    if limit:
        sql = f"SELECT * FROM ({sql}) WHERE ROWNUM <= {int(limit)}"
    return client.fetch_dicts(sql, params)


def get_requisicion(no_cia: str, punto: str, no_requisicion: str) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT * FROM ODC.TODC_REQUISICION "
        " WHERE no_cia=:1 AND punto=:2 AND no_requisicion=:3",
        [no_cia, punto, no_requisicion],
    )
    return rows[0] if rows else None


def list_lineas_requisicion(no_cia: str, punto: str, no_requisicion: str) -> list[dict]:
    return client.fetch_dicts(
        "SELECT l.no_linea, l.no_produ, p.descri AS descripcion_producto, "
        "       l.cantidad_pedida, l.cantidad_pendiente, l.cantidad_autorizada, "
        "       l.no_orden, l.tipo_salida, l.no_salida, l.nota, l.usuario, "
        "       l.empaque, l.cpe "
        "  FROM ODC.TODC_REQUISICIONL l "
        "  LEFT JOIN INV.TINV_PRODUCTO p ON p.no_produ = l.no_produ "
        " WHERE l.no_cia=:1 AND l.punto=:2 AND l.no_requisicion=:3 "
        " ORDER BY l.no_linea",
        [no_cia, punto, no_requisicion],
    )


def next_no_requisicion(no_cia: str, punto: str) -> str:
    row = client.fetch_one(
        "SELECT NVL(prox_requisicion,1) FROM ODC.TODC_PUNTO "
        " WHERE no_cia=:1 AND punto=:2 FOR UPDATE",
        [no_cia, punto],
    )
    prox = int(row[0]) if row else 1
    client.execute(
        "UPDATE ODC.TODC_PUNTO SET prox_requisicion = NVL(prox_requisicion,0)+1 "
        " WHERE no_cia=:1 AND punto=:2",
        [no_cia, punto],
    )
    return str(prox).zfill(8)


def create_requisicion(no_cia: str, punto: str, cabecera: dict,
                       lineas: list[dict], usuario: str) -> str:
    no_req = next_no_requisicion(no_cia, punto)
    fecha = cabecera.get('fecha') or date.today().isoformat()
    fecha_entrega = cabecera.get('fecha_entrega') or fecha
    client.execute(
        "INSERT INTO ODC.TODC_REQUISICION ("
        " no_cia, punto, no_requisicion, fecha, fecha_entrega, usuario, "
        " procesado_almacen, st_anulado, estado, tipo_requisicion, cerrada, "
        " st_impresion, detalle, no_localidad, no_depto, consolidada"
        ") VALUES ("
        " :1, :2, :3, TO_DATE(:4,'YYYY-MM-DD'), TO_DATE(:5,'YYYY-MM-DD'), :6, "
        " 'N', 'A', :7, :8, 'N', 'N', :9, :10, :11, 'N')",
        [
            no_cia, punto, no_req, fecha, fecha_entrega, usuario,
            cabecera.get('estado', 'P'),
            cabecera.get('tipo_requisicion', 'I'),
            cabecera.get('detalle'),
            cabecera.get('no_localidad'),
            cabecera.get('no_depto'),
        ],
    )
    for i, ln in enumerate(lineas, start=1):
        client.execute(
            "INSERT INTO ODC.TODC_REQUISICIONL ("
            " no_cia, punto, no_requisicion, no_linea, no_produ, "
            " cantidad_pedida, cantidad_pendiente, cantidad_autorizada, "
            " nota, usuario, empaque, cpe"
            ") VALUES ("
            " :1, :2, :3, :4, :5, :6, :6, 0, :7, :8, :9, :10)",
            client.nbinds(
                no_cia, punto, no_req, i, ln['no_produ'],
                ln['cantidad_pedida'], ln.get('nota'), usuario,
                ln.get('empaque', 1), ln.get('cpe', 1),
            ),
        )
    return no_req


def autorizar_requisicion(no_cia: str, punto: str, no_requisicion: str,
                          usuario: str, slot: int = 1) -> None:
    """slot=1/2/3 según autorización en cascada."""
    col = f"autorizacion_{int(slot)}"
    fecha_col = f"fecha_{int(slot)}"
    client.execute(
        f"UPDATE ODC.TODC_REQUISICION SET {col}=:1, {fecha_col}=SYSDATE, estado='A' "
        f" WHERE no_cia=:2 AND punto=:3 AND no_requisicion=:4",
        [usuario, no_cia, punto, no_requisicion],
    )


def anular_requisicion(no_cia: str, punto: str, no_requisicion: str,
                       motivo: str = '') -> None:
    # Dominio legado: st_anulado 'A'=Activa / 'N'=Anulada (igual que TODC_ORDEN).
    client.execute(
        "UPDATE ODC.TODC_REQUISICION SET st_anulado='N', "
        " detalle = SUBSTR(NVL(detalle,'')||' [ANULADA: '||:1||']',1,2000) "
        " WHERE no_cia=:2 AND punto=:3 AND no_requisicion=:4",
        [motivo or 'sin motivo', no_cia, punto, no_requisicion],
    )


def cerrar_requisicion(no_cia: str, punto: str, no_requisicion: str) -> None:
    client.execute(
        "UPDATE ODC.TODC_REQUISICION SET cerrada='S', estado='C' "
        " WHERE no_cia=:1 AND punto=:2 AND no_requisicion=:3",
        [no_cia, punto, no_requisicion],
    )


# ---------------------------------------------------------------------------
# Reportes
# ---------------------------------------------------------------------------

def rep_ordenes_pendientes(no_cia: str, punto: str | None = None,
                           fecha_desde: str | None = None,
                           fecha_hasta: str | None = None) -> list[dict]:
    """Rodc201 — Movimientos pendientes: órdenes sin recibir o parcialmente
    recibidas (cantidad_pedida > cantidad_recibida) y no anuladas."""
    sql = (
        "SELECT o.no_cia, o.punto, o.no_orden, o.no_proveedor, p.nombre, "
        "       o.fecha, o.fecha_entrega, o.estado, "
        "       SUM(l.cantidad_pedida) cantidad_pedida_total, "
        "       SUM(l.cantidad_recibida) cantidad_recibida_total, "
        "       SUM(l.cantidad_pedida - l.cantidad_recibida) pendiente, "
        "       SUM(l.monto_neto) monto_total "
        "  FROM ODC.TODC_ORDEN o "
        "  JOIN ODC.TODC_ORDENL l "
        "    ON l.no_cia=o.no_cia AND l.punto=o.punto AND l.no_orden=o.no_orden "
        "  LEFT JOIN CXP.TCXP_DPROVEEDOR p ON p.no_proveedor = o.no_proveedor "
        " WHERE o.no_cia=:1 AND NVL(o.st_anulado,'A') = 'A' "
    )
    params: list = [no_cia]
    if punto:
        params.append(punto); sql += f" AND o.punto = :{len(params)}"
    if fecha_desde:
        params.append(fecha_desde); sql += f" AND TRUNC(o.fecha) >= TO_DATE(:{len(params)},'YYYY-MM-DD')"
    if fecha_hasta:
        params.append(fecha_hasta); sql += f" AND TRUNC(o.fecha) <= TO_DATE(:{len(params)},'YYYY-MM-DD')"
    sql += (
        " GROUP BY o.no_cia, o.punto, o.no_orden, o.no_proveedor, p.nombre, "
        "          o.fecha, o.fecha_entrega, o.estado "
        " HAVING SUM(l.cantidad_pedida - l.cantidad_recibida) > 0 "
        " ORDER BY o.fecha"
    )
    return client.fetch_dicts(sql, params)


def rep_resumen(no_cia: str, punto: str | None = None,
                fecha_desde: str | None = None,
                fecha_hasta: str | None = None) -> dict:
    """Rodc207 — Resumen: totales del período."""
    sql = (
        "SELECT COUNT(*) total_ordenes, "
        "       SUM(CASE WHEN estado='P' THEN 1 ELSE 0 END) pendientes, "
        "       SUM(CASE WHEN estado='A' THEN 1 ELSE 0 END) autorizadas, "
        "       SUM(CASE WHEN estado='C' THEN 1 ELSE 0 END) cerradas, "
        "       SUM(CASE WHEN NVL(st_anulado,'A')='N' THEN 1 ELSE 0 END) anuladas, "
        "       NVL(SUM(total_neto),0) monto_total "
        "  FROM ODC.TODC_ORDEN WHERE no_cia=:1"
    )
    params: list = [no_cia]
    if punto:
        params.append(punto); sql += f" AND punto=:{len(params)}"
    if fecha_desde:
        params.append(fecha_desde); sql += f" AND TRUNC(fecha) >= TO_DATE(:{len(params)},'YYYY-MM-DD')"
    if fecha_hasta:
        params.append(fecha_hasta); sql += f" AND TRUNC(fecha) <= TO_DATE(:{len(params)},'YYYY-MM-DD')"
    rows = client.fetch_dicts(sql, params)
    return rows[0] if rows else {}


def rep_requisiciones_pendientes(no_cia: str, punto: str | None = None,
                                 limit: int = 200) -> list[dict]:
    """Rodc206 — Requisiciones detalle (sin cerrar)."""
    sql = (
        "SELECT r.no_cia, r.punto, r.no_requisicion, r.fecha, r.usuario, "
        "       r.estado, r.no_localidad, r.no_depto, "
        "       l.no_linea, l.no_produ, p.descri descripcion_producto, "
        "       l.cantidad_pedida, l.cantidad_pendiente, l.cantidad_autorizada "
        "  FROM ODC.TODC_REQUISICION r "
        "  JOIN ODC.TODC_REQUISICIONL l "
        "    ON l.no_cia=r.no_cia AND l.punto=r.punto AND l.no_requisicion=r.no_requisicion "
        "  LEFT JOIN INV.TINV_PRODUCTO p ON p.no_produ = l.no_produ "
        " WHERE r.no_cia=:1 AND NVL(r.st_anulado,'A') = 'A' AND r.cerrada <> 'S' "
    )
    params: list = [no_cia]
    if punto:
        params.append(punto); sql += f" AND r.punto = :{len(params)}"
    sql += " ORDER BY r.fecha DESC, r.no_requisicion DESC, l.no_linea"
    if limit:
        sql = f"SELECT * FROM ({sql}) WHERE ROWNUM <= {int(limit)}"
    return client.fetch_dicts(sql, params)
