import os, sys
sys.path.insert(0, '/app')
os.environ['DJANGO_SETTINGS_MODULE'] = 'facturation_api.settings'
import django
django.setup()
from apps.legacy import client
cols = client.fetch_dicts("SELECT column_name FROM all_tab_columns WHERE owner='FAT' AND table_name='TFAT_FORMA_PAGO' ORDER BY column_id")
print("FORMA_PAGO:", [r['column_name'] for r in cols])
cuadre_cols = client.fetch_dicts("SELECT column_name FROM all_tab_columns WHERE owner='FAT' AND table_name='TFAT_CUADRE_CAJA' ORDER BY column_id")
print("CUADRE_CAJA:", [r['column_name'] for r in cuadre_cols])
