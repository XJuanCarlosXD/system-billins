from apps.legacy import client
g = client.fetch_dicts("SELECT * FROM INV.TINV_GRUPO_PRODU WHERE ROWNUM<=2", [])
print("G:", g)
l = client.fetch_dicts("SELECT * FROM INV.TINV_LINEA WHERE ROWNUM<=2", [])
print("L:", l)