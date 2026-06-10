import os, sys
sys.path.insert(0, '/app')
os.environ['DJANGO_SETTINGS_MODULE'] = 'facturation_api.settings'
import django
django.setup()
from apps.legacy.repositories import fat_repo

tests = [
    ('conduces', lambda: fat_repo.list_conduces('01', '01', page=1, page_size=3)),
    ('cuadre', lambda: fat_repo.list_cuadre_caja('01', '01')),
    ('cuadre-det', lambda: fat_repo.get_cuadre_caja_detalle('01', '01', '', '2026-01-01', '2026-05-31')),
    ('607', lambda: fat_repo.rep_ncf_607('01', '2026-01-01', '2026-05-31')),
    ('ventas', lambda: fat_repo.rep_ventas_producto('01', '01', '2026-01-01', '2026-05-31')),
    ('analitica', lambda: fat_repo.rep_analitica_mensual('01', '01', 2026)),
    ('ncfnulos', lambda: fat_repo.rep_ncf_nulos('01', '2026-01-01', '2026-05-31')),
    ('clitop5', lambda: fat_repo.rep_ventas_cliente('01', '01', '2026-01-01', '2026-05-31', top=5)),
]
for name, fn in tests:
    try:
        r = fn()
        t = type(r).__name__
        sz = len(r) if isinstance(r, (list, dict)) else '?'
        print(f"{name} OK {t} len={sz}")
    except Exception as e:
        print(f"{name} ERR {str(e)[:250]}")
