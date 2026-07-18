# Smoke manual: indice de skills por permisos + auto-titulo de conversacion.
# Uso: docker exec facturation_backend python manage.py shell -c \
#      "exec(open('/app/apps/asistente/_smoke_autoskills.py').read())"
import json

from django.contrib.auth import get_user_model
from django.test import Client

from apps.asistente.agent_loop import _system_prompt
from apps.asistente.tools.skills import list_skills_index

User = get_user_model()
user = User.objects.filter(username__iexact="JCABREU").first()
print("USER:", user)

idx = list_skills_index(user)
print("SKILLS_INDEX:", [s["name"] for s in idx])
assert any(s["name"] == "devolucion-ventas" for s in idx), "falta devolucion-ventas"
assert any(s["name"] == "nota-credito-cxc" for s in idx), "falta nota-credito-cxc"

sp = _system_prompt("02", "27", idx)
assert "SKILLS DISPONIBLES" in sp and "nota-debito-cxc" in sp
assert "tabla Markdown" in sp
print("SYSTEM_PROMPT_OK len=", len(sp))

c = Client(secure=True)
ok = c.login(username="JCABREU", password="Temp1234!")
print("LOGIN:", ok)

r = c.post(
    "/api/asistente/conversaciones/",
    data=json.dumps({"no_cia": "02", "punto": "27"}),
    content_type="application/json",
)
print("CREATE:", r.status_code, r.json())
conv_id = r.json()["conv_id"]

r2 = c.post(
    f"/api/asistente/conversaciones/{conv_id}/chat/",
    data=json.dumps({"message": "hola, responde solo la palabra hola"}),
    content_type="application/json",
)
print("CHAT status:", r2.status_code)
chunks = b""
for ch in r2.streaming_content:
    chunks += ch
    if len(chunks) > 4000:
        break
print("SSE head:", chunks[:600])

r3 = c.get("/api/asistente/conversaciones/")
items = r3.json()["items"]
mine = [i for i in items if i["conv_id"] == conv_id]
print("TITULO:", mine[0]["titulo"] if mine else "NO_ENCONTRADA")
assert mine and mine[0]["titulo"].startswith("hola"), "auto-titulo fallo"
print("SMOKE_OK")
