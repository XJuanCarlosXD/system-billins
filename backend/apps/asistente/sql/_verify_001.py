"""Verifica que las 4 tablas TCHAT_* existen en ABREGONZA."""

import os
import sys

_BACKEND_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

import django  # noqa: E402

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "facturation_api.settings")
django.setup()

from apps.legacy import client  # noqa: E402

EXPECTED = {
    "TCHAT_CONVERSACION",
    "TCHAT_MENSAJE",
    "TCHAT_TOOL_PENDING",
    "TCHAT_TOOL_LOG",
}

rows = client.fetch_all(
    "SELECT TABLE_NAME FROM ALL_TABLES "
    "WHERE OWNER='ABREGONZA' AND TABLE_NAME LIKE 'TCHAT_%' "
    "ORDER BY 1"
)
found = {r[0] for r in rows}
for t in sorted(found):
    print(f"  {t}")

missing = EXPECTED - found
if missing:
    print(f"FAIL: faltan {missing}")
    sys.exit(1)
print(f"OK: {len(found)} tablas TCHAT_* en ABREGONZA")
