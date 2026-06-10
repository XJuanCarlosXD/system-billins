import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'facturation.settings')
django.setup()
from apps.legacy import client
try:
    rows = client.fetch_dicts("SELECT * FROM INV.TINV_GRUPO_PRODU WHERE ROWNUM<=2", [])
    print("GRUPO_PRODU columns:", list(rows[0].keys()) if rows else "NO ROWS")
    print("GRUPO_PRODU sample:", rows[:2])
except Exception as e:
    print("GRUPO_PRODU error:", e)
try:
    rows2 = client.fetch_dicts("SELECT * FROM INV.TINV_LINEA WHERE ROWNUM<=2", [])
    print("LINEA columns:", list(rows2[0].keys()) if rows2 else "NO ROWS")
    print("LINEA sample:", rows2[:2])
except Exception as e:
    print("LINEA error:", e)