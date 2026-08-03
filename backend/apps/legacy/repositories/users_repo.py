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
# Cuentas de infraestructura Oracle que Oracle NO marca como
# oracle_maintained='Y' (son propias de esta instancia/PDB) pero tampoco
# son un login humano de la aplicacion.
_INFRA_USERS = ('PDBADMIN', 'SYSRAC')
_NON_HUMAN = set(_SCHEMA_USERS + _INFRA_USERS)
# NOTA: las cuentas propias de Oracle (DVSYS, GGSYS, AUDSYS, SYSBACKUP,
# etc.) NO se listan aqui a mano — se excluyen dinamicamente via
# oracle_maintained='Y' en list_humans(). Una lista fija como esta se
# desactualiza en cuanto cambia la version/edicion de Oracle (paso
# exactamente eso al migrar de 11g al fork standalone de 23ai: la lista
# vieja no cubria las cuentas nuevas de 23ai y se colaban en el listado).


def exists(username: str) -> bool:
    row = client.fetch_one(
        'SELECT 1 FROM all_users WHERE UPPER(username) = UPPER(:1)',
        [username],
    )
    return row is not None


def is_human(username: str) -> bool:
    """True si `username` es una cuenta humana administrable desde el panel
    (la misma población que devuelve list_humans()).

    Es el gate real de login: existir en Oracle (exists()) NO basta —
    eso también es cierto para FAT, CXP, CNT y el resto de los schemas
    dueños de las tablas del ERP, y para cuentas internas de Oracle
    (oracle_maintained='Y'). Si alguien conociera la clave de uno de esos
    schemas, antes de este chequeo igual conseguía una sesión Django válida
    aunque el usuario nunca apareciera en Administración de Usuarios.
    """
    placeholders = ', '.join(f':{i}' for i in range(2, len(_NON_HUMAN) + 2))
    row = client.fetch_one(
        f"SELECT 1 FROM dba_users WHERE UPPER(username) = UPPER(:1) "
        f"AND username NOT IN ({placeholders}) "
        "AND NVL(oracle_maintained, 'N') != 'Y'",
        [username] + list(_NON_HUMAN),
    )
    return row is not None


def get(username: str) -> LegacyUser | None:
    if not exists(username):
        return None
    return LegacyUser(username=username.upper())


def get_detail(username: str) -> dict | None:
    """Detalle desde dba_users (incluye status, fecha creación, lock, nombre y rol)."""
    rows = client.fetch_dicts(
        "SELECT d.username, d.account_status, d.lock_date, d.expiry_date, d.created, d.profile, "
        "t.nombre AS full_name, t.descripcion AS role "
        "FROM dba_users d LEFT JOIN MAN.TCSC t ON UPPER(t.usuario) = d.username "
        "WHERE UPPER(d.username) = UPPER(:1)",
        [username],
    )
    return rows[0] if rows else None


def get_profile(username: str) -> dict | None:
    """Nombre completo y rol/puesto desde MAN.TCSC, si el usuario tiene registro ahí.

    MAN.TCSC es la tabla legada de control de sistema: USUARIO + NOMBRE +
    DESCRIPCION (puesto). No todo usuario Oracle tiene fila ahí (p.ej.
    cuentas técnicas como RMMCONSULTING creadas sin ficha de empleado).
    """
    rows = client.fetch_dicts(
        "SELECT nombre AS full_name, descripcion AS role "
        "FROM MAN.TCSC WHERE UPPER(usuario) = UPPER(:1)",
        [username],
    )
    return rows[0] if rows else None


def upsert_profile(username: str, full_name: str, role: str | None, actor: str) -> dict:
    """Crea o actualiza el nombre completo / rol del usuario en MAN.TCSC."""
    u = username.upper()
    full_name = (full_name or u).strip()[:40]
    role = (role or '').strip()[:80] or None
    updated = client.execute(
        "UPDATE MAN.TCSC SET nombre = :1, descripcion = :2 WHERE UPPER(usuario) = UPPER(:3)",
        [full_name, role, u],
    )
    if not updated:
        client.execute(
            "INSERT INTO MAN.TCSC (usuario, nombre, descripcion, creado_por, fecha, activo) "
            "VALUES (:1, :2, :3, :4, SYSDATE, 'S')",
            [u, full_name, role, (actor or u).upper()],
        )
    return {'username': u, 'full_name': full_name, 'role': role}


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
    Excluye schemas dueños de la app, cuentas de infraestructura conocidas
    (PDBADMIN, SYSRAC) y — dinamicamente, sin lista fija — cualquier cuenta
    que Oracle marque como oracle_maintained='Y' (motor/features internos:
    DVSYS, GGSYS, AUDSYS, SYSBACKUP, SYSKM, SYSDG, GSM*, etc).
    """
    page = max(1, int(page))
    page_size = max(1, min(200, int(page_size)))
    order_col = _ORDER_FIELDS.get(order_by, 'created')
    order_dir = 'DESC' if str(direction).lower() != 'asc' else 'ASC'

    placeholders = ', '.join(f':{i}' for i in range(1, len(_NON_HUMAN) + 1))
    where = (
        f'username NOT IN ({placeholders}) '
        "AND NVL(oracle_maintained, 'N') != 'Y' "
    )
    params: list = list(_NON_HUMAN)
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
        SELECT d.username, d.account_status, d.lock_date, d.expiry_date, d.created,
               t.nombre AS full_name, t.descripcion AS role
          FROM (
            SELECT username, account_status, lock_date, expiry_date, created
              FROM (
                SELECT u.*, ROWNUM rn FROM (
                  SELECT username, account_status, lock_date, expiry_date, created
                    FROM dba_users
                   WHERE {where}
                   ORDER BY {order_col} {order_dir}
                ) u WHERE ROWNUM <= :{len(params) + 1}
              ) WHERE rn > :{len(params) + 2}
          ) d
          LEFT JOIN MAN.TCSC t ON UPPER(t.usuario) = d.username
         ORDER BY {order_col} {order_dir}
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
