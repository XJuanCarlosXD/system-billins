"""Smoke local del endpoint /api/asistente/skills/.

Corre dentro del container:
    docker compose exec -T backend python apps/asistente/tests/_smoke_skills_http.py
"""

import os
import shutil
import sys

# Permite ejecutar como script desde cualquier cwd dentro del container.
_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "facturation_api.settings")
django.setup()

from django.test import Client  # noqa: E402

from apps.asistente.tools import skills as skills_mod  # noqa: E402


def main() -> int:
    c = Client()
    r = c.post(
        "/api/auth/login/",
        data={"username": "JCABREU", "password": "508192003"},
        content_type="application/json",
    )
    assert r.status_code == 200, (r.status_code, r.content[:200])

    # GET list — vacio porque el directorio skills/ no tiene SKILL.md.
    r = c.get("/api/asistente/skills/")
    assert r.status_code == 200, (r.status_code, r.content[:200])
    print("GET list:", r.json())

    # POST crea
    target = os.path.join(skills_mod.SKILLS_DIR, "smoke-test")
    if os.path.exists(target):
        shutil.rmtree(target)

    body = (
        "---\n"
        "name: smoke-test\n"
        "description: smoke\n"
        "modules_required: []\n"
        "tools_used: []\n"
        "---\n\nCuerpo de smoke."
    )
    r = c.post(
        "/api/asistente/skills/",
        data={"name": "smoke-test", "body": body},
        content_type="application/json",
    )
    print("POST:", r.status_code, r.content[:120])
    assert r.status_code == 201, r.content

    # GET detail
    r = c.get("/api/asistente/skills/smoke-test/")
    print("GET detail:", r.status_code)
    assert r.status_code == 200
    assert r.json()["name"] == "smoke-test"

    # PUT update
    new_body = body + "\nLinea extra."
    r = c.put(
        "/api/asistente/skills/smoke-test/",
        data={"body": new_body},
        content_type="application/json",
    )
    print("PUT:", r.status_code)
    assert r.status_code == 200

    # GET detail confirma update
    r = c.get("/api/asistente/skills/smoke-test/")
    assert "Linea extra" in r.json()["body"]

    # DELETE
    r = c.delete("/api/asistente/skills/smoke-test/")
    print("DELETE:", r.status_code)
    assert r.status_code == 200

    # GET detail 404
    r = c.get("/api/asistente/skills/smoke-test/")
    assert r.status_code == 404
    print("OK_SMOKE_SKILLS_CRUD")
    return 0


if __name__ == "__main__":
    sys.exit(main())
