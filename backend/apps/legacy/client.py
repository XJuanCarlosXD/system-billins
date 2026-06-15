"""Cliente único de Oracle 11g (sistema legado).

Reglas duras:
- Lecturas siempre por este cliente (pool oracledb thick mode).
- Escrituras solo via packages PL/SQL existentes; NUNCA SQL DML directo aquí.
- Cero acoplamiento con Django ORM (Django 5 no soporta Oracle <19).
"""
from __future__ import annotations

import logging
import threading
from contextlib import contextmanager
from typing import Iterator

import oracledb
from django.conf import settings

logger = logging.getLogger(__name__)

_pool: oracledb.ConnectionPool | None = None
_init_lock = threading.Lock()
_client_initialized = False


def _ensure_thick_mode() -> None:
    global _client_initialized
    if _client_initialized:
        return
    lib_dir = settings.LEGACY_ORACLE['INSTANT_CLIENT_DIR']
    oracledb.init_oracle_client(lib_dir=lib_dir)
    _client_initialized = True
    logger.info('oracledb thick mode initialized (lib_dir=%s)', lib_dir)


def get_pool() -> oracledb.ConnectionPool:
    """Pool admin (con el usuario configurado en settings)."""
    global _pool
    if _pool is not None:
        return _pool
    with _init_lock:
        if _pool is not None:
            return _pool
        _ensure_thick_mode()
        cfg = settings.LEGACY_ORACLE
        _pool = oracledb.create_pool(
            user=cfg['USER'],
            password=cfg['PASSWORD'],
            dsn=cfg['DSN'],
            min=cfg['POOL_MIN'],
            max=cfg['POOL_MAX'],
            increment=1,
            getmode=oracledb.POOL_GETMODE_WAIT,
        )
        logger.info('oracle legacy pool created (dsn=%s, min=%s, max=%s)',
                    cfg['DSN'], cfg['POOL_MIN'], cfg['POOL_MAX'])
    return _pool


@contextmanager
def connection() -> Iterator[oracledb.Connection]:
    pool = get_pool()
    conn = pool.acquire()
    try:
        yield conn
    finally:
        pool.release(conn)


@contextmanager
def cursor() -> Iterator[oracledb.Cursor]:
    with connection() as conn:
        cur = conn.cursor()
        try:
            yield cur
        finally:
            cur.close()


def fetch_one(sql: str, params: list | dict | None = None) -> tuple | None:
    with cursor() as cur:
        cur.execute(sql, params or [])
        return cur.fetchone()


def fetch_all(sql: str, params: list | dict | None = None) -> list[tuple]:
    with cursor() as cur:
        cur.execute(sql, params or [])
        return cur.fetchall()


def fetch_dicts(sql: str, params: list | dict | None = None) -> list[dict]:
    with cursor() as cur:
        cur.execute(sql, params or [])
        cols = [c[0].lower() for c in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def ping() -> dict:
    """Smoke test ligero: usa la conexión y devuelve metadata básica."""
    row = fetch_one(
        "SELECT USER, SYS_CONTEXT('USERENV','DB_NAME'), "
        "SYS_CONTEXT('USERENV','INSTANCE_NAME'), "
        "(SELECT BANNER FROM v$version WHERE ROWNUM=1) "
        "FROM DUAL"
    )
    if row is None:
        raise RuntimeError('ping returned no row')
    user, db_name, instance, banner = row
    return {
        'user': user,
        'db_name': db_name,
        'instance': instance,
        'banner': banner,
    }


def authenticate_oracle_user(username: str, password: str) -> bool:
    """Intenta CONNECT a Oracle como el usuario dado.

    Retorna True si Oracle autentica (login válido). False si ORA-01017.
    Cualquier otro error se propaga.
    """
    _ensure_thick_mode()
    cfg = settings.LEGACY_ORACLE
    try:
        conn = oracledb.connect(
            user=username,
            password=password,
            dsn=cfg['DSN'],
        )
        conn.close()
        return True
    except oracledb.DatabaseError as e:
        err = e.args[0] if e.args else None
        # ORA-01017: invalid username/password
        if err is not None and 'ORA-01017' in str(err):
            return False
        raise
