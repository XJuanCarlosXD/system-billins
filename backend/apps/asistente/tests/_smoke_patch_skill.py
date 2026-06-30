"""Smoke: PATCH /api/asistente/conversaciones/<id>/ con skill_activa.

Run dentro del container:
    docker compose exec -T backend python apps/asistente/tests/_smoke_patch_skill.py
"""

import os
import sys

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "facturation_api.settings")
django.setup()

from django.test import Client  # noqa: E402


def main() -> int:
    c = Client()
    r = c.post(
        "/api/auth/login/",
        data={"username": "JCABREU", "password": "508192003"},
        content_type="application/json",
    )
    assert r.status_code == 200, (r.status_code, r.content[:200])

    r = c.post(
        "/api/asistente/conversaciones/",
        data={"titulo": "patch-test"},
        content_type="application/json",
    )
    print("CREATE", r.status_code)
    assert r.status_code == 201, (r.status_code, r.content[:200])
    cid = r.json()["conv_id"]

    r2 = c.patch(
        "/api/asistente/conversaciones/" + cid + "/",
        data={"skill_activa": "facturar"},
        content_type="application/json",
    )
    print("PATCH skill_activa", r2.status_code, r2.content[:80])
    assert r2.status_code == 200, (r2.status_code, r2.content[:200])

    r3 = c.get("/api/asistente/conversaciones/" + cid + "/")
    body = r3.json()
    sk = body["conversacion"].get("skill_activa")
    print("GET skill_activa =", sk)
    assert sk == "facturar", body

    r4 = c.patch(
        "/api/asistente/conversaciones/" + cid + "/",
        data={"titulo": "renombrada"},
        content_type="application/json",
    )
    print("PATCH titulo", r4.status_code)
    assert r4.status_code == 200

    r5 = c.patch(
        "/api/asistente/conversaciones/" + cid + "/",
        data={},
        content_type="application/json",
    )
    print("PATCH empty", r5.status_code)
    assert r5.status_code == 400

    r6 = c.patch(
        "/api/asistente/conversaciones/" + cid + "/",
        data={"skill_activa": None},
        content_type="application/json",
    )
    print("PATCH clear", r6.status_code)
    assert r6.status_code == 200

    c.delete("/api/asistente/conversaciones/" + cid + "/")
    print("ALL OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
