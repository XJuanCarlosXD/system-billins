"""Smoke test: GET /api/asistente/skills/ lists the 6 skills as JCABREU."""
import django, os, sys
sys.path.insert(0, "/app")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "facturation_api.settings")
django.setup()
from django.test import Client
from django.contrib.auth import get_user_model

c = Client()
u = get_user_model().objects.get(username="JCABREU")
c.force_login(u)

r = c.get("/api/asistente/skills/")
print("STATUS", r.status_code)
print("RAW", r.content.decode()[:1000])
