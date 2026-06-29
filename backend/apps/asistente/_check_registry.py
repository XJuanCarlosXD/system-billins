"""Smoke: confirma que apps.ready() pobla el REGISTRY."""
import os
import sys

_BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "facturation_api.settings")
django.setup()

from apps.asistente.tools.registry import REGISTRY

print("REGISTRY:")
for name in sorted(REGISTRY):
    spec = REGISTRY[name]
    print(f"  {name}  modules_required={spec.modules_required}  write={spec.write}")
print(f"total = {len(REGISTRY)}")
