"""Ejecuta apps/asistente/sql/001_create_tchat.sql contra Oracle.

Uso (dentro del container backend):
    docker compose exec backend python apps/asistente/sql/_run_001.py

Idempotente: si una tabla ya existe (ORA-00955) o un indice (ORA-00955),
lo saltea con WARN. Errores reales se propagan.
"""

import os
import re
import sys

# Cuando se invoca como `python apps/asistente/sql/_run_001.py`, sys.path
# arranca con el dir del script -> Django no encuentra facturation_api.
# Forzamos /app (backend root) al frente.
_BACKEND_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

import django  # noqa: E402

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "facturation_api.settings")
django.setup()

from apps.legacy import client  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
SQL_PATH = os.path.join(HERE, "001_create_tchat.sql")


def _split_statements(text: str) -> list[str]:
    out: list[str] = []
    buf: list[str] = []
    for line in text.splitlines():
        s = line.strip()
        if s.startswith("--") or not s:
            continue
        if s.upper() in ("COMMIT;", "EXIT;"):
            if buf:
                stmt = " ".join(buf).strip().rstrip(";")
                if stmt:
                    out.append(stmt)
                buf = []
            continue
        buf.append(line)
        if s.endswith(";"):
            stmt = " ".join(buf).strip().rstrip(";")
            if stmt:
                out.append(stmt)
            buf = []
    if buf:
        stmt = " ".join(buf).strip().rstrip(";")
        if stmt:
            out.append(stmt)
    return out


def main() -> int:
    with open(SQL_PATH, encoding="utf-8") as fh:
        sql = fh.read()

    stmts = _split_statements(sql)
    print(f"-> {len(stmts)} statements")

    with client.cursor() as cur:
        for i, stmt in enumerate(stmts, 1):
            head = re.sub(r"\s+", " ", stmt)[:80]
            try:
                cur.execute(stmt)
                print(f"  [{i:02d}] OK   {head}")
            except Exception as exc:  # noqa: BLE001
                msg = str(exc)
                # ORA-00955 name in use, ORA-01408 col list already indexed,
                # ORA-01921 role already granted, ORA-01749 self-grant
                # (JCABREU == ABREGONZA en este entorno: grants y synonyms
                # son no-ops).
                skip_codes = ("ORA-00955", "ORA-01408", "ORA-01921", "ORA-01749")
                if any(code in msg for code in skip_codes):
                    print(f"  [{i:02d}] SKIP {head}  ({msg.splitlines()[0]})")
                else:
                    print(f"  [{i:02d}] FAIL {head}")
                    print(f"        {msg}")
                    return 1
        cur.connection.commit()

    print("DDL applied.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
