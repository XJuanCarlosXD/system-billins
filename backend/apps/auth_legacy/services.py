"""Operaciones admin sobre usuarios Oracle del legado Regal General.

Reglas:
- CREATE USER, ALTER USER, ALTER USER ... ACCOUNT LOCK/UNLOCK son DDL.
- Username y password se sanitizan estrictamente (whitelist) antes de
  ejecutar el DDL: alfanumérico + '_'. Nunca interpolar password sin escape.
- Estas operaciones requieren que el usuario actor tenga rol DBA o Regal General.
"""
from __future__ import annotations

import re

from apps.legacy import client


_USERNAME_RE = re.compile(r'^[A-Z][A-Z0-9_]{0,29}$')
# Oracle 11g admite hasta 30 chars en password sin comillas.
# Password sólo permite: alfanumérico y los safe chars siguientes.
_SAFE_PWD_RE = re.compile(r'^[A-Za-z0-9_@#$\-\.\+]{4,30}$')


class InvalidUsername(ValueError):
    pass


class InvalidPassword(ValueError):
    pass


def _validate_username(username: str) -> str:
    u = (username or '').strip().upper()
    if not _USERNAME_RE.match(u):
        raise InvalidUsername(
            'Usuario inválido. Use sólo A-Z, 0-9 y "_", máx 30, debe iniciar con letra.'
        )
    return u


def _validate_password(password: str) -> str:
    if not password or not _SAFE_PWD_RE.match(password):
        raise InvalidPassword(
            'Contraseña inválida. Use 4-30 chars: A-Z a-z 0-9 _ @ # $ - . +'
        )
    return password


def create_user(username: str, password: str, default_tablespace: str | None = None) -> dict:
    u = _validate_username(username)
    pwd = _validate_password(password)
    with client.cursor() as cur:
        # CREATE USER no acepta bind variables; password ya está validada.
        sql = f'CREATE USER {u} IDENTIFIED BY "{pwd}"'
        if default_tablespace:
            ts = _validate_username(default_tablespace)
            sql += f' DEFAULT TABLESPACE {ts}'
        cur.execute(sql)
        # Grants mínimos para que el usuario pueda CONNECT y usar el ERP.
        cur.execute(f'GRANT CONNECT, RESOURCE TO {u}')
        try:
            cur.execute(f'GRANT ROLE_REGAL_GENERAL TO {u}')
        except Exception:
            pass  # rol opcional
        cur.connection.commit()
    return {'username': u, 'created': True}


def change_password(username: str, new_password: str, current_password: str | None = None) -> dict:
    """Cambia la contraseña.

    Si `current_password` viene, se valida primero (modo "cambio propio").
    Si no, se hace ALTER USER directo (modo admin — el caller debe haber
    sido validado como DBA por la view).
    """
    u = _validate_username(username)
    pwd = _validate_password(new_password)
    if current_password is not None:
        ok = client.authenticate_oracle_user(u, current_password)
        if not ok:
            raise InvalidPassword('La contraseña actual no es correcta.')
    with client.cursor() as cur:
        cur.execute(f'ALTER USER {u} IDENTIFIED BY "{pwd}"')
        cur.connection.commit()
    return {'username': u, 'password_changed': True}


def set_account_status(username: str, locked: bool) -> dict:
    u = _validate_username(username)
    action = 'LOCK' if locked else 'UNLOCK'
    with client.cursor() as cur:
        cur.execute(f'ALTER USER {u} ACCOUNT {action}')
        cur.connection.commit()
    return {'username': u, 'locked': locked}
