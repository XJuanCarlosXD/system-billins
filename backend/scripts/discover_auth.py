"""Fase 1.A — descubrir tablas de auth/seguridad/empresas en el legado.
Solo SELECT. Output JSON a stdout."""
import json
import sys
from apps.legacy import client


def q(sql, params=None):
    try:
        return client.fetch_dicts(sql, params)
    except Exception as e:
        return [{'__error__': str(e)}]


def main():
    out = {}
    out['ctx'] = client.fetch_one(
        "SELECT USER, SYS_CONTEXT('USERENV','DB_NAME') FROM DUAL"
    )
    out['total_tables_owner'] = client.fetch_one(
        'SELECT COUNT(*) FROM all_tables WHERE owner=USER'
    )[0]
    out['auth_tables'] = q(
        "SELECT table_name, num_rows FROM all_tables "
        "WHERE owner=USER AND ("
        "UPPER(table_name) LIKE '%USU%' OR "
        "UPPER(table_name) LIKE '%USER%' OR "
        "UPPER(table_name) LIKE '%LOGIN%' OR "
        "UPPER(table_name) LIKE '%SEG_%' OR "
        "UPPER(table_name) LIKE '%SEGURIDAD%' OR "
        "UPPER(table_name) LIKE '%PERM%' OR "
        "UPPER(table_name) LIKE '%ACCESO%' OR "
        "UPPER(table_name) LIKE '%ROL%' OR "
        "UPPER(table_name) LIKE '%PERFIL%') "
        "ORDER BY table_name"
    )
    out['company_tables'] = q(
        "SELECT table_name, num_rows FROM all_tables "
        "WHERE owner=USER AND ("
        "UPPER(table_name) LIKE '%EMPRESA%' OR "
        "UPPER(table_name) LIKE '%SUCURSAL%' OR "
        "UPPER(table_name) LIKE '%COMPANIA%' OR "
        "UPPER(table_name) LIKE '%COMPANY%') "
        "ORDER BY table_name"
    )
    json.dump(out, sys.stdout, default=str, indent=2)


if __name__ == '__main__':
    main()
