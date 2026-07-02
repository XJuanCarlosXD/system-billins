"""Permisos por módulo del sistema legado.

Cada módulo activo tiene una tabla TXXX_USUARIO con una clave compuesta
(NO_CIA, PUNTO, USUARIO) y N flags S/N + algunos campos extra (almacén,
cajero, montos, etc.). Y una tabla TXXX_USUARIOD con permisos por tipo
de documento.

Este repo lee esas tablas vía oracledb directo.
"""
from __future__ import annotations

from .. import client
from ..dtos import ModulePermissions

# Mapa modulo (lowercase) → (schema, tabla_usuario, tabla_usuariod, tabla_tdocu)
_MODULES = {
    'fat': ('FAT', 'TFAT_USUARIO', 'TFAT_USUARIOD', 'TFAT_TDOCU'),
    'odc': ('ODC', 'TODC_USUARIO', None, None),
    'cxp': ('CXP', 'TCXP_USUARIO', 'TCXP_USUARIOD', 'TCXP_TDOCU'),
    'inv': ('INV', 'TINV_USUARIO', 'TINV_USUARIOD', 'TINV_TDOCU'),
    'cxc': ('CXC', 'TCXC_USUARIO', 'TCXC_USUARIOD', 'TCXC_TDOCU'),
    'chc': ('CHC', 'TCHC_USUARIO', 'TCHC_USUARIOD', 'TCHC_TDOCU'),
    'sdn': ('SDN', 'TSDN_USUARIO', None, None),
    'cnt': ('CNT', 'TCNT_USUARIO', None, None),
    'acc': ('ACC', 'TACC_USUARIO', None, None),
    'acf': ('ACF', 'TACF_USUARIO', 'TACF_USUARIOD', 'TACF_TDOCU'),
}

# Cache de columnas por tabla — los TDOCU legados NO son homogéneos:
# INV/CXP/CHC no tienen NO_CIA (catálogo global), INV/CXP/CHC usan DESCRI
# en vez de DESCRIPCION, y solo FAT/CHC tienen ACTIVO.
_COLS_CACHE: dict[str, set[str]] = {}


def _table_columns(schema: str, table: str) -> set[str]:
    key = f'{schema}.{table}'
    if key not in _COLS_CACHE:
        rows = client.fetch_dicts(
            "SELECT column_name FROM all_tab_columns "
            "WHERE owner=:1 AND table_name=:2",
            [schema, table],
        )
        _COLS_CACHE[key] = {r['column_name'] for r in rows}
    return _COLS_CACHE[key]

# Columnas que NO son flags S/N (claves o valores no-booleanos).
_NON_FLAG_COLS = {
    'NO_CIA', 'PUNTO', 'USUARIO',
    'TIPO_PRECIO', 'ALMACEN', 'CAJERO', 'NO_CLIENTE',
    'AUTORIZACION_1', 'AUTORIZACION_2', 'AUTORIZACION_3',
    'MONTO_MINIMO', 'MONTO_MAXIMO',
}


def supported_modules() -> list[str]:
    return list(_MODULES.keys())


def get_user_flags(usuario: str, modulo: str, no_cia: str, punto: str) -> dict:
    """Retorna {flag_name: bool} para todos los flags S/N del módulo del usuario."""
    modulo = modulo.lower()
    if modulo not in _MODULES:
        raise ValueError(f'modulo no soportado: {modulo}')
    schema, tab, _d, _td = _MODULES[modulo]
    rows = client.fetch_dicts(
        f"SELECT * FROM {schema}.{tab} "
        "WHERE no_cia=:1 AND punto=:2 AND UPPER(usuario)=UPPER(:3)",
        [no_cia, punto, usuario],
    )
    if not rows:
        raise ValueError('usuario sin acceso a este módulo/empresa/punto')
    r = rows[0]
    flags: dict[str, bool] = {}
    for col, val in r.items():
        col_u = col.upper()
        if col_u in _NON_FLAG_COLS or col_u in {'ACTIVO', 'POR_DEFECTO'}:
            continue
        flags[col_u] = (val == 'S')
    return flags


def set_user_flag(usuario: str, modulo: str, no_cia: str, punto: str,
                  flag: str, value: bool) -> dict:
    """Actualiza un flag S/N específico en TXXX_USUARIO."""
    modulo = modulo.lower()
    if modulo not in _MODULES:
        raise ValueError(f'modulo no soportado: {modulo}')
    flag_u = flag.upper()
    if flag_u in _NON_FLAG_COLS:
        raise ValueError(f'No se puede modificar la columna: {flag_u}')
    schema, tab, _d, _td = _MODULES[modulo]
    with client.cursor() as cur:
        cur.execute(
            f"UPDATE {schema}.{tab} SET {flag_u}=:1 "
            "WHERE no_cia=:2 AND punto=:3 AND UPPER(usuario)=UPPER(:4)",
            ['S' if value else 'N', no_cia, punto, usuario],
        )
        if cur.rowcount == 0:
            raise ValueError('usuario sin acceso a este módulo/empresa/punto')
        cur.connection.commit()
    return {'flag': flag_u, 'value': value}



def get_for(usuario: str, modulo: str, no_cia: str, punto: str) -> ModulePermissions | None:
    """Permisos de un usuario en (módulo, empresa, punto).

    Devuelve None si el usuario no tiene fila en TXXX_USUARIO de ese módulo.
    """
    modulo = modulo.lower()
    if modulo not in _MODULES:
        raise ValueError(f'modulo no soportado: {modulo}')
    schema, tab_usr, tab_usrd, _tdocu = _MODULES[modulo]

    rows = client.fetch_dicts(
        f"SELECT * FROM {schema}.{tab_usr} "
        "WHERE UPPER(usuario) = UPPER(:1) "
        "AND no_cia = :2 AND punto = :3",
        [usuario, no_cia, punto],
    )
    if not rows:
        return None
    r = rows[0]

    flags: dict[str, bool] = {}
    extras: dict = {}
    for col, val in r.items():
        col_u = col.upper()
        if col_u in {'NO_CIA', 'PUNTO', 'USUARIO'}:
            continue
        if col_u in _NON_FLAG_COLS:
            extras[col_u] = val
            continue
        # flag S/N
        flags[col_u] = (val == 'S')

    document_perms: list[dict] = []
    if tab_usrd:
        d_rows = client.fetch_dicts(
            f"SELECT * FROM {schema}.{tab_usrd} "
            "WHERE UPPER(usuario) = UPPER(:1) "
            "AND no_cia = :2 AND punto = :3",
            [usuario, no_cia, punto],
        )
        for d in d_rows:
            entry = {
                'tipo_docu': d.get('tipo_docu'),
                'por_defecto': d.get('por_defecto') == 'S',
            }
            for k, v in d.items():
                ku = k.upper()
                if ku in {'NO_CIA', 'PUNTO', 'USUARIO', 'TIPO_DOCU', 'POR_DEFECTO'}:
                    continue
                entry[ku.lower()] = (v == 'S') if isinstance(v, str) and v in ('S', 'N') else v
            document_perms.append(entry)

    return ModulePermissions(
        no_cia=r['no_cia'],
        punto=r['punto'],
        usuario=r['usuario'],
        modulo=modulo,
        activo=flags.pop('ACTIVO', False),
        por_defecto=flags.pop('POR_DEFECTO', False),
        flags=flags,
        extras=extras,
        document_perms=document_perms,
    )


def list_user_modules(usuario: str) -> list[dict]:
    """Para un usuario, lista en qué (módulo, empresa, punto) tiene permisos."""
    out: list[dict] = []
    for modulo, (schema, tab, _d, _td) in _MODULES.items():
        rows = client.fetch_dicts(
            f"SELECT no_cia, punto, NVL(activo,'N') AS activo, "
            f"NVL(por_defecto,'N') AS por_defecto "
            f"FROM {schema}.{tab} "
            "WHERE UPPER(usuario) = UPPER(:1)",
            [usuario],
        )
        for r in rows:
            out.append({
                'modulo': modulo,
                'no_cia': r['no_cia'],
                'punto': r['punto'],
                'activo': r['activo'] == 'S',
                'por_defecto': r['por_defecto'] == 'S',
            })
    return out


def grant_access(usuario: str, modulo: str, no_cia: str, punto: str,
                 activo: bool = True, por_defecto: bool = False) -> dict:
    """Asigna acceso al usuario en (módulo, cía, punto). Inserta o actualiza
    la fila base en TXXX_USUARIO con clave (NO_CIA, PUNTO, USUARIO).
    NO toca columnas de flags específicos del módulo (esos quedan en N por
    defecto, y se editan después granularmente).
    """
    modulo = modulo.lower()
    if modulo not in _MODULES:
        raise ValueError(f'modulo no soportado: {modulo}')
    schema, tab, _tabd, _td = _MODULES[modulo]
    u = usuario.upper()
    with client.cursor() as cur:
        # ¿ya existe?
        cur.execute(
            f"SELECT 1 FROM {schema}.{tab} "
            "WHERE no_cia=:1 AND punto=:2 AND UPPER(usuario)=UPPER(:3)",
            [no_cia, punto, u],
        )
        existing = cur.fetchone()
        if existing:
            cur.execute(
                f"UPDATE {schema}.{tab} "
                "SET activo=:1, por_defecto=:2 "
                "WHERE no_cia=:3 AND punto=:4 AND UPPER(usuario)=UPPER(:5)",
                ['S' if activo else 'N', 'S' if por_defecto else 'N',
                 no_cia, punto, u],
            )
            action = 'updated'
        else:
            # INSERT mínimo: solo las columnas de la clave + ACTIVO + POR_DEFECTO.
            # Las demás columnas quedan NULL (que el ERP interpreta como 'N').
            cur.execute(
                f"INSERT INTO {schema}.{tab} (no_cia, punto, usuario, activo, por_defecto) "
                "VALUES (:1, :2, :3, :4, :5)",
                [no_cia, punto, u,
                 'S' if activo else 'N',
                 'S' if por_defecto else 'N'],
            )
            action = 'created'
        cur.connection.commit()
    return {'modulo': modulo, 'no_cia': no_cia, 'punto': punto,
            'usuario': u, 'action': action,
            'activo': activo, 'por_defecto': por_defecto}


def revoke_access(usuario: str, modulo: str, no_cia: str, punto: str) -> dict:
    """Quita acceso del usuario al módulo en esa cía/punto.
    Borra la fila de TXXX_USUARIO. Si hay TXXX_USUARIOD también borra los detalles.
    """
    modulo = modulo.lower()
    if modulo not in _MODULES:
        raise ValueError(f'modulo no soportado: {modulo}')
    schema, tab, tabd, _td = _MODULES[modulo]
    u = usuario.upper()
    with client.cursor() as cur:
        if tabd:
            cur.execute(
                f"DELETE FROM {schema}.{tabd} "
                "WHERE no_cia=:1 AND punto=:2 AND UPPER(usuario)=UPPER(:3)",
                [no_cia, punto, u],
            )
        cur.execute(
            f"DELETE FROM {schema}.{tab} "
            "WHERE no_cia=:1 AND punto=:2 AND UPPER(usuario)=UPPER(:3)",
            [no_cia, punto, u],
        )
        deleted = cur.rowcount
        cur.connection.commit()
    return {'modulo': modulo, 'no_cia': no_cia, 'punto': punto,
            'usuario': u, 'deleted_rows': deleted}


def list_available_doc_types(modulo: str, no_cia: str) -> list[dict]:
    """Tipos de documentos disponibles para ese módulo/empresa (de TXXX_TDOCU)."""
    modulo = modulo.lower()
    if modulo not in _MODULES:
        raise ValueError(f'modulo no soportado: {modulo}')
    schema, _tab, _tabd, tdocu = _MODULES[modulo]
    if not tdocu:
        return []
    cols = _table_columns(schema, tdocu)
    if 'DESCRIPCION' in cols:
        desc_col = 'descripcion'
    elif 'DESCRI' in cols:
        desc_col = 'descri'
    else:
        desc_col = 'tipo_docu'
    where = []
    binds: list = []
    if 'NO_CIA' in cols:
        where.append('no_cia = :1')
        binds.append(no_cia)
    if 'ACTIVO' in cols:
        where.append("NVL(activo,'S')='S'")
    sql = f"SELECT tipo_docu, {desc_col} AS descripcion FROM {schema}.{tdocu}"
    if where:
        sql += ' WHERE ' + ' AND '.join(where)
    sql += ' ORDER BY tipo_docu'
    rows = client.fetch_dicts(sql, binds)
    return [{'tipo_docu': r['tipo_docu'], 'descripcion': r['descripcion'] or ''} for r in rows]


def list_user_doc_perms(usuario: str, modulo: str, no_cia: str, punto: str) -> list[dict]:
    """Tipos de documentos asignados al usuario en ese módulo/empresa/punto."""
    modulo = modulo.lower()
    if modulo not in _MODULES:
        raise ValueError(f'modulo no soportado: {modulo}')
    schema, _tab, tabd, _td = _MODULES[modulo]
    if not tabd:
        return []
    rows = client.fetch_dicts(
        f"SELECT tipo_docu, NVL(por_defecto,'N') AS por_defecto "
        f"FROM {schema}.{tabd} "
        "WHERE no_cia=:1 AND punto=:2 AND UPPER(usuario)=UPPER(:3) "
        "ORDER BY tipo_docu",
        [no_cia, punto, usuario.upper()],
    )
    return [{'tipo_docu': r['tipo_docu'], 'por_defecto': r['por_defecto'] == 'S'} for r in rows]


def grant_doc_access(usuario: str, modulo: str, no_cia: str, punto: str,
                     tipo_docu: str, por_defecto: bool = False) -> dict:
    """Asigna un tipo de documento al usuario en ese módulo/empresa/punto."""
    modulo = modulo.lower()
    if modulo not in _MODULES:
        raise ValueError(f'modulo no soportado: {modulo}')
    schema, _tab, tabd, _td = _MODULES[modulo]
    if not tabd:
        raise ValueError(f'El módulo {modulo} no tiene permisos por documento')
    u = usuario.upper()
    td = tipo_docu.upper()
    with client.cursor() as cur:
        cur.execute(
            f"SELECT 1 FROM {schema}.{tabd} "
            "WHERE no_cia=:1 AND punto=:2 AND UPPER(usuario)=UPPER(:3) AND tipo_docu=:4",
            [no_cia, punto, u, td],
        )
        existing = cur.fetchone()
        if existing:
            cur.execute(
                f"UPDATE {schema}.{tabd} SET por_defecto=:1 "
                "WHERE no_cia=:2 AND punto=:3 AND UPPER(usuario)=UPPER(:4) AND tipo_docu=:5",
                ['S' if por_defecto else 'N', no_cia, punto, u, td],
            )
            action = 'updated'
        else:
            # TCXC_USUARIOD tiene ademas VARIAR_FECHA NOT NULL
            extra_cols = ''
            extra_vals = ''
            if 'VARIAR_FECHA' in _table_columns(schema, tabd):
                extra_cols = ', variar_fecha'
                extra_vals = ", 'N'"
            cur.execute(
                f"INSERT INTO {schema}.{tabd} "
                f"(no_cia, punto, usuario, tipo_docu, por_defecto{extra_cols}) "
                f"VALUES (:1, :2, :3, :4, :5{extra_vals})",
                [no_cia, punto, u, td, 'S' if por_defecto else 'N'],
            )
            action = 'created'
        cur.connection.commit()
    return {'modulo': modulo, 'no_cia': no_cia, 'punto': punto,
            'usuario': u, 'tipo_docu': td, 'action': action, 'por_defecto': por_defecto}


def revoke_doc_access(usuario: str, modulo: str, no_cia: str, punto: str, tipo_docu: str) -> dict:
    """Quita un tipo de documento del usuario en ese módulo/empresa/punto."""
    modulo = modulo.lower()
    if modulo not in _MODULES:
        raise ValueError(f'modulo no soportado: {modulo}')
    schema, _tab, tabd, _td = _MODULES[modulo]
    if not tabd:
        raise ValueError(f'El módulo {modulo} no tiene permisos por documento')
    u = usuario.upper()
    td = tipo_docu.upper()
    with client.cursor() as cur:
        cur.execute(
            f"DELETE FROM {schema}.{tabd} "
            "WHERE no_cia=:1 AND punto=:2 AND UPPER(usuario)=UPPER(:3) AND tipo_docu=:4",
            [no_cia, punto, u, td],
        )
        deleted = cur.rowcount
        cur.connection.commit()
    return {'modulo': modulo, 'no_cia': no_cia, 'punto': punto,
            'usuario': u, 'tipo_docu': td, 'deleted_rows': deleted}
