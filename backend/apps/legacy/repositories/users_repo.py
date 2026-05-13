"""Usuarios del sistema viejo Regal General.

Auth = usuario Oracle nativo (CREATE USER). No hay tabla de hash propia.
Operaciones admin (CREATE/ALTER USER) se hacen via apps.auth_legacy.services.
Aquí solo lectura del catálogo Oracle (dba_users / all_users).
"""
from __future__ import annotations

from .. import client
from ..dtos import LegacyUser

# Schemas que NO son humanos — son schemas dueños de las tablas del ERP
_SCHEMA_USERS = (
    'SDN', 'FAT', 'CNT', 'INV', 'CXC', 'CHC', 'SMT', 'CXP', 'ACF',
    'MPR', 'ACC', 'ODC', 'ABREGONZA', 'GUIA', 'MAN', 'REGAL_GENERAL',
)
_SYSTEM_USERS = (
    'SYS', 'SYSTEM', 'OUTLN', 'XDB', 'MDSYS', 'CTXSYS', 'EXFSYS',
    'DBSNMP', 'APPQOSSYS', 'ORDDATA', 'ORDSYS', 'OLAPSYS', 'WMSYS',
    'LBACSYS', 'OWBSYS', 'OWBSYS_AUDIT', 'SYSMAN', 'APEX_030200',
    'APEX_PUBLIC_USER', 'FLOWS_FILES', 'SCOTT', 'HR', 'OE', 'SH',
    'PM', 'IX', 'BI', 'ORACLE_OCM', 'ANONYMOUS', 'XS$NULL',
    'MGMT_VIEW', 'MDDATA', 'SI_INFORMTN_SCHEMA', 'PUBLIC',
    'SPATIAL_CSW_ADMIN_USR', 'SPATIAL_WFS_ADMIN_USR', 'ORDPLUGINS',
)
EXCLUDED = set(_SCHEMA_USERS + _SYSTEM_USERS)


def exists(username: str) -> bool:
    row = client.fetch_one(
        'SELECT 1 FROM all_users WHERE UPPER(username) = UPPER(:1)',
        [username],
    )
    return row is not None


def get(username: str) -> LegacyUser | None:
    if not exists(username):
        return None
    return LegacyUser(username=username.upper())


def get_detail(username: str) -> dict | None:
    """Detalle desde dba_users (incluye status, fecha creación, lock)."""
    rows = client.fetch_dicts(
        "SELECT username, account_status, lock_date, expiry_date, created, profile "
        "FROM dba_users WHERE UPPER(username) = UPPER(:1)",
        [username],
    )
    return rows[0] if rows else None


_ORDER_FIELDS = {
    'username': 'username',
    'created': 'created',
    'status': 'account_status',
}


def list_humans(
    include_locked: bool = True,
    search: str | None = None,
    page: int = 1,
    page_size: int = 25,
    order_by: str = 'created',
    direction: str = 'desc',
) -> dict:
    """Lista paginada de usuarios humanos con su estado de cuenta.

    Filtros server-side: search (username LIKE) e include_locked.
    Orden server-side: username | created | status, asc/desc.
    Excluye schemas dueños y usuarios sistema Oracle.
    """
    page = max(1, int(page))
    page_size = max(1, min(200, int(page_size)))
    order_col = _ORDER_FIELDS.get(order_by, 'created')
    order_dir = 'DESC' if str(direction).lower() != 'asc' else 'ASC'

    placeholders = ', '.join(f':{i}' for i in range(1, len(EXCLUDED) + 1))
    where = f'username NOT IN ({placeholders}) '
    params: list = list(EXCLUDED)
    if not include_locked:
        where += "AND account_status = 'OPEN' "
    if search:
        where += f'AND UPPER(username) LIKE :{len(params) + 1} '
        params.append(f'%{search.upper()}%')

    # COUNT total
    total_row = client.fetch_one(
        f'SELECT COUNT(*) FROM dba_users WHERE {where}',
        params,
    )
    total = int(total_row[0]) if total_row else 0

    # Paginación 11g (no soporta OFFSET / FETCH antes de 12c).
    offset = (page - 1) * page_size
    end = offset + page_size
    sql = f"""
        SELECT username, account_status, lock_date, expiry_date, created
          FROM (
            SELECT u.*, ROWNUM rn FROM (
              SELECT username, account_status, lock_date, expiry_date, created
                FROM dba_users
               WHERE {where}
               ORDER BY {order_col} {order_dir}
            ) u WHERE ROWNUM <= :{len(params) + 1}
          ) WHERE rn > :{len(params) + 2}
    """
    items = client.fetch_dicts(sql, params + [end, offset])
    total_pages = (total + page_size - 1) // page_size if page_size else 1
    return {
        'items': items,
        'total': total,
        'page': page,
        'page_size': page_size,
        'total_pages': total_pages,
        'order_by': order_by,
        'direction': order_dir.lower(),
    }


def is_dba(username: str) -> bool:
    """Determina si el usuario tiene rol DBA o Regal General (admin del sistema)."""
    rows = client.fetch_all(
        "SELECT granted_role FROM dba_role_privs "
        "WHERE UPPER(grantee) = UPPER(:1) "
        "AND granted_role IN ('DBA', 'ROLE_REGAL_GENERAL')",
        [username],
    )
    return len(rows) > 0
