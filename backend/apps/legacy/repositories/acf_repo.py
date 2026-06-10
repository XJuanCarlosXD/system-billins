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
