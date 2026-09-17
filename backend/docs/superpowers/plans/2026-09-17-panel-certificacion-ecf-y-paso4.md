# Panel de Certificación e-CF (UI) + continuar Paso 4 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan sintaxis de checkbox (`- [ ]`). Desplegar cada cambio backend/frontend a la VM según la skill `sigaft-deploy-vm` y hacer smoke test antes de marcar un paso como hecho.

**Goal:** Que los Pasos 2 y 3 de la certificación e-CF (ya completados a mano el 2026-09-17 vía scripts ad-hoc en la VM) queden como funcionalidad **real de ZentoryERP** — botones en la UI que ejecutan el mismo código de producción (`ecf_builder`, `dgii_client`), sin que un desarrollador tenga que volver a correr scripts sueltos por SSH. También deja documentado (Ayuda in-app) cómo un operador sin conocimientos técnicos ejecuta facturación electrónica, y define el punto de partida para investigar el Paso 4 en adelante.

**Contexto (no repetir, ya resuelto hoy 2026-09-17):** Certificación e-CF de Abregonza (solicitud 81443) — Pasos 2 y 3 **completos** en el ambiente `certecf`. Causas raíz resueltas: (a) el flujo debía usar `certecf`, no `testecf`; (b) `CodigoSeguridadeCF` son los primeros 6 caracteres CRUDOS del `SignatureValue`, no un hash SHA-256; (c) `certecf` exige los datos EXACTOS del "conjunto de datos entregados" (el Excel de la DGII), no corregidos. Ver memoria `project_dgii_ecf_postulacion_estado_20260831` (sección "RESUELTO 2026-09-17") para el detalle completo y la evidencia. Ver también `backend/docs/superpowers/plans/2026-08-31-fe-ecf-fase2-comprobante-electronico-plan.md` (plan original de Fase 2, del que este plan es continuación).

**Architecture:** Tres endpoints REST nuevos en `apps/fe` (uno por sub-paso: e-CF completo, RFCE, Aprobación Comercial), cada uno recibe el Excel oficial de la DGII por upload y hace en el servidor exactamente lo que los scripts de hoy hicieron a mano (parsear filas → `ecf_builder.construir_*` → `dgii_client.enviar_*`), reutilizando 100% el código ya probado real contra la DGII. Una pantalla nueva "Certificación e-CF" (tab dentro de Configuración → Facturación Electrónica) sube los Excel y dispara los 3 botones. Una tab de Ayuda con contenido markdown embebido explica el flujo completo a un operador no técnico.

**Tech Stack:** Django (views + `openpyxl` ya en `requirements.txt`), React + TanStack Query + shadcn/ui (mismo patrón que `fe-modo-test.tsx`).

---

### Task 1: Mover el builder de ACECF (Aprobación Comercial) a `ecf_builder.py`

**Por qué:** hoy se construyó `construir_acecf()` como función suelta dentro de un script ad-hoc (`send_aprobaciones.py`, corrido vía `manage.py shell` en la VM, nunca comiteado). Hace falta como función real y testeada del módulo, igual que `construir_rfce`/`derivar_codigo_seguridad`.

**Files:**
- Modify: `backend/apps/fe/ecf_builder.py` (agregar `construir_acecf` después de `construir_rfce`, línea ~1546)
- Test: `backend/apps/fe/tests/test_ecf_builder_acecf.py` (nuevo)

- [ ] **Step 1: Escribir el test que falla**

Crear `backend/apps/fe/tests/test_ecf_builder_acecf.py`:

```python
"""Tests de ``apps.fe.ecf_builder.construir_acecf`` -- Aprobacion Comercial
(Paso 3 de certificacion DGII). Formato confirmado 1:1 contra el XSD real
``ACECF v.1.0.xsd`` de dgii.gov.do (probado real 2026-09-17: 11/11
"Aprobacion Comercial Aprobada" contra certecf, ver memoria del proyecto).
"""
from __future__ import annotations

from apps.fe import ecf_builder


ROW = {
    'Version': '1.0',
    'RNCEmisor': '131880681',
    'eNCF': 'E310000000001',
    'FechaEmision': '01-04-2020',
    'MontoTotal': 7080,
    'RNCComprador': '130217432',
    'Estado': 1,
    'DetalleMotivoRechazo': None,
    'FechaHoraAprobacionComercial': '17-09-2026 11:44:23',
}


def test_construir_acecf_incluye_los_9_campos_en_orden():
    xml = ecf_builder.construir_acecf(ROW)
    assert '<ACECF>' in xml
    assert '<DetalleAprobacionComercial>' in xml
    assert '<Version>1.0</Version>' in xml
    assert '<RNCEmisor>131880681</RNCEmisor>' in xml
    assert '<eNCF>E310000000001</eNCF>' in xml
    assert '<FechaEmision>01-04-2020</FechaEmision>' in xml
    assert '<MontoTotal>7080.00</MontoTotal>' in xml
    assert '<RNCComprador>130217432</RNCComprador>' in xml
    assert '<Estado>1</Estado>' in xml
    assert '<FechaHoraAprobacionComercial>17-09-2026 11:44:23</FechaHoraAprobacionComercial>' in xml
    # orden real del XSD: eNCF antes que FechaEmision, MontoTotal antes que RNCComprador
    assert xml.index('<eNCF>') < xml.index('<FechaEmision>')
    assert xml.index('<MontoTotal>') < xml.index('<RNCComprador>')


def test_construir_acecf_monto_total_redondea_a_2_decimales():
    row = {**ROW, 'MontoTotal': 96365.3}
    xml = ecf_builder.construir_acecf(row)
    assert '<MontoTotal>96365.30</MontoTotal>' in xml


def test_construir_acecf_estado_rechazado_incluye_detalle_motivo():
    row = {**ROW, 'Estado': 2, 'DetalleMotivoRechazo': 'Monto no coincide'}
    xml = ecf_builder.construir_acecf(row)
    assert '<Estado>2</Estado>' in xml
    assert '<DetalleMotivoRechazo>Monto no coincide</DetalleMotivoRechazo>' in xml


def test_construir_acecf_sin_motivo_rechazo_omite_el_elemento():
    xml = ecf_builder.construir_acecf(ROW)
    assert 'DetalleMotivoRechazo' not in xml
```

- [ ] **Step 2: Correr el test para confirmar que falla**

Run: `docker exec facturation_backend python -m pytest apps/fe/tests/test_ecf_builder_acecf.py -v`
Expected: `AttributeError: module 'apps.fe.ecf_builder' has no attribute 'construir_acecf'`

- [ ] **Step 3: Implementar `construir_acecf`**

En `backend/apps/fe/ecf_builder.py`, agregar al final del archivo (después de `derivar_codigo_seguridad`):

```python
def construir_acecf(row: dict) -> str:
    """Arma el XML de Aprobacion Comercial (ACECF) "sin firmar" -- Paso 3
    de certificacion DGII (servicio "Recepcion de aprobacion comercial").

    ``row`` es un dict plano con los 9 campos EXACTOS del XSD oficial
    ``ACECF v.1.0.xsd`` (descargado de dgii.gov.do, confirmado 2026-09-17):
    Version, RNCEmisor, eNCF, FechaEmision, MontoTotal, RNCComprador,
    Estado, DetalleMotivoRechazo (opcional), FechaHoraAprobacionComercial
    -- mismos nombres de columna que trae la hoja ``ACEECF_Generadas`` del
    Excel que se descarga del Paso 3 del Portal de Certificacion
    ("Descargar aprobaciones comerciales"), asi que un caller puede pasar
    la fila del Excel directo, sin transformarla.

    A diferencia de ``construir_ecf_generico``, NO hay que sustituir
    ningun valor "raro" (p.ej. RNCEmisor=131880681 en los datos de
    prueba) -- certecf exige el dato EXACTO del "conjunto de datos
    entregados" (mismo aprendizaje que con RNCComprador en Paso 2, ver
    memoria del proyecto).
    """
    acecf = etree.Element('ACECF')
    det = _sub(acecf, 'DetalleAprobacionComercial')
    _sub(det, 'Version', row['Version'])
    _sub(det, 'RNCEmisor', row['RNCEmisor'])
    _sub(det, 'eNCF', row['eNCF'])
    _sub(det, 'FechaEmision', row['FechaEmision'])
    _sub(det, 'MontoTotal', _fmt_monto(row['MontoTotal']))
    _sub(det, 'RNCComprador', row['RNCComprador'])
    _sub(det, 'Estado', int(row['Estado']))
    if row.get('DetalleMotivoRechazo'):
        _sub(det, 'DetalleMotivoRechazo', row['DetalleMotivoRechazo'])
    _sub(det, 'FechaHoraAprobacionComercial', row['FechaHoraAprobacionComercial'])
    return etree.tostring(acecf, xml_declaration=True, encoding='utf-8').decode('utf-8')
```

- [ ] **Step 4: Correr el test para confirmar que pasa**

Run: `docker exec facturation_backend python -m pytest apps/fe/tests/test_ecf_builder_acecf.py -v`
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/apps/fe/ecf_builder.py backend/apps/fe/tests/test_ecf_builder_acecf.py
git commit -m "feat(fe): agrega construir_acecf al ecf_builder (Paso 3 certificacion)"
```

---

### Task 2: Endpoint bulk del Paso 2 (e-CF completo, `POST /api/fe/certificacion/paso2-ecf/`)

**Por qué:** hoy se envió cada uno de los 21 e-CF con un loop en un script Python corrido a mano en la VM (`send_certecf.py`/`resend_certecf_raw.py`). El endpoint `pruebas_enviar_view` ya existe pero espera UNA fila a la vez, copiada a mano por el operador. Este endpoint nuevo recibe el Excel completo y hace el loop en el servidor.

**Files:**
- Modify: `backend/apps/fe/views.py` (agregar `certificacion_paso2_ecf_view`)
- Modify: `backend/apps/fe/urls.py` (agregar la ruta)
- Test: `backend/apps/fe/tests/test_views_certificacion.py` (nuevo)

- [ ] **Step 1: Escribir el test que falla**

Crear `backend/apps/fe/tests/test_views_certificacion.py`:

```python
"""Tests de los endpoints de ``apps.fe.views.certificacion_paso2_ecf_view``
/ ``certificacion_paso2_rfce_view`` / ``certificacion_paso3_view`` --
version "bulk" (sube el Excel oficial de la DGII completo) de lo que
``pruebas_enviar_view`` hace fila por fila.

Misma estrategia que ``test_views_pruebas.py``: nunca se toca Oracle real
ni la DGII real -- se monkeypatchea ``ecf_builder``/``dgii_client`` en la
frontera.
"""
from __future__ import annotations

import io

import openpyxl
import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from apps.fe import dgii_client, ecf_builder


@pytest.fixture
def cliente_autenticado(db):
    User = get_user_model()
    user = User.objects.create_user(username='tester', password='x')
    client = Client()
    client.force_login(user)
    return client


def _excel_ecf_bytes(filas):
    """Arma un .xlsx en memoria con hoja 'ECF', misma forma que el Excel
    real de la DGII: fila 0 = headers, resto = datos."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'ECF'
    headers = ['TipoeCF', 'ENCF', 'RNCEmisor', 'RNCComprador', 'MontoTotal']
    ws.append(headers)
    for fila in filas:
        ws.append([fila.get(h) for h in headers])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()


def test_requiere_login(client, db):
    resp = client.post('/api/fe/certificacion/paso2-ecf/', data={'no_cia': '01'})
    assert resp.status_code in (302, 401, 403)


def test_sin_archivo_da_400(cliente_autenticado):
    resp = cliente_autenticado.post(
        '/api/fe/certificacion/paso2-ecf/', data={'no_cia': '01'})
    assert resp.status_code == 400
    assert 'archivo' in resp.json()['detail'].lower()


def test_envia_cada_fila_y_reporta_resultados(cliente_autenticado, monkeypatch):
    filas = [
        {'TipoeCF': 32, 'ENCF': 'E320000000006', 'RNCEmisor': '130217432',
         'RNCComprador': '131880681', 'MontoTotal': 1180},
        {'TipoeCF': 31, 'ENCF': 'E310000000001', 'RNCEmisor': '130217432',
         'RNCComprador': '131880681', 'MontoTotal': 7080},
    ]
    archivo = _excel_ecf_bytes(filas)

    build_calls = []
    monkeypatch.setattr(
        ecf_builder, 'construir_ecf_generico',
        lambda tipo, encf, datos: build_calls.append((tipo, encf)) or '<ECF/>')

    envios = []

    def fake_enviar_ecf(no_cia, ambiente, e_ncf, xml_sin_firmar):
        envios.append((ambiente, e_ncf))
        return {'trackId': f'TRACK-{e_ncf}', 'xml_firmado': '<ECF firmado/>',
                'respuesta_cruda': {'trackId': f'TRACK-{e_ncf}'}}

    monkeypatch.setattr(dgii_client, 'enviar_ecf', fake_enviar_ecf)
    monkeypatch.setattr(
        'apps.legacy.repositories.fe_repo.save_documento_enviado',
        lambda *a, **k: None)

    resp = cliente_autenticado.post(
        '/api/fe/certificacion/paso2-ecf/',
        data={'no_cia': '01', 'archivo': _as_upload(archivo)},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body['resultados']) == 2
    assert all(r['ok'] for r in body['resultados'])
    assert {e for _, e in envios} == {'E320000000006', 'E310000000001'}
    # SIEMPRE certecf, sin importar TFE_CONFIG.ambiente -- mismo requisito
    # de seguridad que pruebas_enviar_view.
    assert all(amb == 'certecf' for amb, _ in envios)


def test_fila_con_error_no_detiene_las_demas(cliente_autenticado, monkeypatch):
    filas = [
        {'TipoeCF': 32, 'ENCF': 'E320000000006', 'RNCEmisor': '130217432',
         'RNCComprador': '131880681', 'MontoTotal': 1180},
        {'TipoeCF': 31, 'ENCF': 'E310000000001', 'RNCEmisor': '130217432',
         'RNCComprador': '131880681', 'MontoTotal': 7080},
    ]
    archivo = _excel_ecf_bytes(filas)

    def fake_construir(tipo, encf, datos):
        if encf == 'E320000000006':
            raise ecf_builder.ECFBuilderError('dato invalido')
        return '<ECF/>'

    monkeypatch.setattr(ecf_builder, 'construir_ecf_generico', fake_construir)
    monkeypatch.setattr(
        dgii_client, 'enviar_ecf',
        lambda no_cia, ambiente, e_ncf, xml: {
            'trackId': 'T1', 'xml_firmado': '<x/>', 'respuesta_cruda': {}})
    monkeypatch.setattr(
        'apps.legacy.repositories.fe_repo.save_documento_enviado',
        lambda *a, **k: None)

    resp = cliente_autenticado.post(
        '/api/fe/certificacion/paso2-ecf/',
        data={'no_cia': '01', 'archivo': _as_upload(archivo)},
    )
    assert resp.status_code == 200
    resultados = {r['encf']: r for r in resp.json()['resultados']}
    assert resultados['E320000000006']['ok'] is False
    assert resultados['E310000000001']['ok'] is True


def _as_upload(contenido: bytes):
    from django.core.files.uploadedfile import SimpleUploadedFile
    return SimpleUploadedFile(
        'set-pruebas.xlsx', contenido,
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
```

- [ ] **Step 2: Correr el test para confirmar que falla**

Run: `docker exec facturation_backend python -m pytest apps/fe/tests/test_views_certificacion.py -v`
Expected: `404` en vez de `200` (la ruta no existe todavía)

- [ ] **Step 3: Implementar la vista**

En `backend/apps/fe/views.py`, agregar (después de `pruebas_enviar_view`, y agregar `import openpyxl` arriba junto a `import json`):

```python
import openpyxl

# ... (imports existentes sin cambios)

# e-NCF de tipo 32 que NO se envian por este endpoint -- van por RFCE
# (ver certificacion_paso2_rfce_view). Filtrado por convencion, no por
# monto real: en el Set de Pruebas de la DGII estas 4 filas SIEMPRE son
# las de "Facturas de consumo < 250Mil" (hoja RFCE del mismo Excel).
_RFCE_ENCFS_PASO2 = frozenset({
    'E320000000012', 'E320000000013', 'E320000000014', 'E320000000015',
})


def _leer_filas_excel(archivo, hoja: str) -> list[dict]:
    wb = openpyxl.load_workbook(archivo, data_only=True)
    if hoja not in wb.sheetnames:
        raise ValueError(f"El Excel no tiene una hoja '{hoja}'")
    ws = wb[hoja]
    filas = list(ws.iter_rows(values_only=True))
    if not filas:
        return []
    headers = filas[0]
    return [dict(zip(headers, r)) for r in filas[1:]]


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def certificacion_paso2_ecf_view(request):
    """Paso 2 de certificacion DGII (grupos "Primero"+"Segundo", 21
    escenarios): sube el Excel oficial completo (hoja ``ECF``) y envia
    CADA fila contra ``certecf`` -- version "bulk" de
    ``pruebas_enviar_view``, mismo codigo de construccion/envio, sin que
    el operador tenga que copiar filas a mano.

    Las 4 filas de Facturas de Consumo < 250Mil (``_RFCE_ENCFS_PASO2``) se
    saltan aqui -- van por ``certificacion_paso2_rfce_view``, servicio de
    Recepcion distinto (ver ``dgii_client.enviar_rfce``).
    """
    no_cia = request.POST.get('no_cia')
    archivo = request.FILES.get('archivo')
    if not no_cia:
        return _err('no_cia requerido')
    if not archivo:
        return _err('archivo (.xlsx) requerido')
    try:
        filas = _leer_filas_excel(archivo, 'ECF')
    except ValueError as exc:
        return _err(str(exc))

    resultados = []
    for row in filas:
        encf = row.get('ENCF')
        if not encf or encf in _RFCE_ENCFS_PASO2:
            continue
        try:
            tipo_ecf = int(row['TipoeCF'])
            xml_sin_firmar = ecf_builder.construir_ecf_generico(tipo_ecf, encf, row)
            resultado = dgii_client.enviar_ecf(no_cia, _AMBIENTE_MODO_TEST, encf, xml_sin_firmar)
        except (ecf_builder.ECFBuilderError, dgii_client.DgiiError, KeyError, ValueError) as exc:
            resultados.append({'encf': encf, 'ok': False, 'error': str(exc)})
            continue
        fe_repo.save_documento_enviado(
            no_cia, encf, str(tipo_ecf), resultado['trackId'],
            resultado['xml_firmado'], json.dumps(resultado['respuesta_cruda']),
            es_prueba='S')
        resultados.append({'encf': encf, 'ok': True, 'trackId': resultado['trackId']})

    return JsonResponse({'resultados': resultados})
```

- [ ] **Step 4: Agregar la ruta**

En `backend/apps/fe/urls.py`, agregar dentro de `urlpatterns`:

```python
    path('certificacion/paso2-ecf/', views.certificacion_paso2_ecf_view),
```

- [ ] **Step 5: Correr el test para confirmar que pasa**

Run: `docker exec facturation_backend python -m pytest apps/fe/tests/test_views_certificacion.py -v`
Expected: `4 passed`

- [ ] **Step 6: Commit**

```bash
git add backend/apps/fe/views.py backend/apps/fe/urls.py backend/apps/fe/tests/test_views_certificacion.py
git commit -m "feat(fe): endpoint bulk Paso 2 e-CF (sube Excel, ya no requiere script)"
```

---

### Task 3: Endpoint bulk del Paso 2 (RFCE, `POST /api/fe/certificacion/paso2-rfce/`)

**Por qué:** las 4 Facturas de Consumo < 250Mil necesitan un flujo de dos partes (RFCE por API + subida MANUAL del e-CF32 firmado al widget del propio portal DGII, eso NO se puede automatizar porque es una acción de navegador en el sitio de la DGII). Este endpoint hace la parte automatizable (construir+firmar+enviar el RFCE) y devuelve el e-CF32 YA FIRMADO en la respuesta para que el operador lo descargue y lo suba a mano.

**Files:**
- Modify: `backend/apps/fe/views.py` (agregar `certificacion_paso2_rfce_view`)
- Modify: `backend/apps/fe/urls.py`
- Test: `backend/apps/fe/tests/test_views_certificacion.py` (agregar tests)

- [ ] **Step 1: Agregar el test que falla**

Agregar a `backend/apps/fe/tests/test_views_certificacion.py`:

```python
def _excel_rfce_bytes(filas_ecf, filas_rfce):
    wb = openpyxl.Workbook()
    ws_ecf = wb.active
    ws_ecf.title = 'ECF'
    headers = ['TipoeCF', 'ENCF', 'RNCEmisor', 'RNCComprador', 'MontoTotal']
    ws_ecf.append(headers)
    for fila in filas_ecf:
        ws_ecf.append([fila.get(h) for h in headers])
    ws_rfce = wb.create_sheet('RFCE')
    ws_rfce.append(headers)
    for fila in filas_rfce:
        ws_rfce.append([fila.get(h) for h in headers])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()


def test_paso2_rfce_requiere_login(client, db):
    resp = client.post('/api/fe/certificacion/paso2-rfce/', data={'no_cia': '01'})
    assert resp.status_code in (302, 401, 403)


def test_paso2_rfce_devuelve_xml_firmado_para_descargar(cliente_autenticado, monkeypatch):
    fila = {'TipoeCF': 32, 'ENCF': 'E320000000012', 'RNCEmisor': '130217432',
            'RNCComprador': '131880681', 'MontoTotal': 47200}
    archivo = _excel_rfce_bytes([fila], [fila])

    monkeypatch.setattr(ecf_builder, 'construir_ecf_generico', lambda t, e, d: '<ECF/>')
    monkeypatch.setattr(
        dgii_client, '_firmar_para_envio',
        lambda no_cia, xml: ('<ECF firmado><Signature><SignatureValue>abc123XYZ==</SignatureValue></Signature></ECF>', '130217432'))
    monkeypatch.setattr(
        ecf_builder, 'derivar_codigo_seguridad', lambda xml_firmado: 'abc123')
    monkeypatch.setattr(ecf_builder, 'construir_rfce', lambda e, d, c: '<RFCE/>')
    monkeypatch.setattr(
        dgii_client, 'enviar_rfce',
        lambda no_cia, ambiente, e_ncf, xml: {
            'estado': 'Aceptado', 'codigo': 1, 'mensajes': None,
            'encf': e_ncf, 'secuencia_utilizada': True,
            'xml_firmado': '<RFCE firmado/>', 'respuesta_cruda': {}})

    resp = cliente_autenticado.post(
        '/api/fe/certificacion/paso2-rfce/',
        data={'no_cia': '01', 'archivo': _as_upload(archivo)},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body['resultados']) == 1
    r = body['resultados'][0]
    assert r['ok'] is True
    assert r['encf'] == 'E320000000012'
    assert r['estado_rfce'] == 'Aceptado'
    assert 'SignatureValue' in r['ecf32_firmado_xml']
    assert r['nombre_archivo'] == '130217432E320000000012.xml'
```

- [ ] **Step 2: Correr el test para confirmar que falla**

Run: `docker exec facturation_backend python -m pytest apps/fe/tests/test_views_certificacion.py -k rfce -v`
Expected: `404` (ruta no existe)

- [ ] **Step 3: Implementar la vista**

En `backend/apps/fe/views.py`, agregar después de `certificacion_paso2_ecf_view`:

```python
@login_required
@csrf_exempt
@require_http_methods(['POST'])
def certificacion_paso2_rfce_view(request):
    """Paso 2 de certificacion DGII (grupo "Tercero", las 4 Facturas de
    Consumo < RD$250,000): construye+firma el e-CF32 completo, deriva
    ``CodigoSeguridadeCF`` de SU FIRMA REAL (``ecf_builder.
    derivar_codigo_seguridad`` -- primeros 6 caracteres crudos del
    SignatureValue, NO un hash), arma+envia el RFCE, y devuelve el e-CF32
    YA FIRMADO en la respuesta para que el operador lo descargue y lo
    suba a mano en el widget "Facturas de consumo < 250Mil" del propio
    Portal de Certificacion (paso "Cuarto" -- no automatizable, es una
    accion de navegador en el sitio de la DGII, no un servicio REST).
    """
    no_cia = request.POST.get('no_cia')
    archivo = request.FILES.get('archivo')
    if not no_cia:
        return _err('no_cia requerido')
    if not archivo:
        return _err('archivo (.xlsx) requerido')
    try:
        filas_ecf = {r['ENCF']: r for r in _leer_filas_excel(archivo, 'ECF')
                     if r.get('ENCF') in _RFCE_ENCFS_PASO2}
        archivo.seek(0)
        filas_rfce = {r.get('ENCF') or r.get('CasoPrueba'): r
                      for r in _leer_filas_excel(archivo, 'RFCE')}
    except ValueError as exc:
        return _err(str(exc))

    resultados = []
    for encf, ecf_row in filas_ecf.items():
        rfce_row = filas_rfce.get(encf, ecf_row)
        try:
            ecf_sin_firmar = ecf_builder.construir_ecf_generico(32, encf, ecf_row)
            ecf_firmado, rnc_emisor = dgii_client._firmar_para_envio(no_cia, ecf_sin_firmar)
            codigo_seguridad = ecf_builder.derivar_codigo_seguridad(ecf_firmado)
            rfce_sin_firmar = ecf_builder.construir_rfce(encf, rfce_row, codigo_seguridad)
            resultado = dgii_client.enviar_rfce(no_cia, _AMBIENTE_MODO_TEST, encf, rfce_sin_firmar)
        except (ecf_builder.ECFBuilderError, dgii_client.DgiiError, KeyError, ValueError) as exc:
            resultados.append({'encf': encf, 'ok': False, 'error': str(exc)})
            continue
        resultados.append({
            'encf': encf,
            'ok': True,
            'estado_rfce': resultado['estado'],
            'codigo_seguridad': codigo_seguridad,
            'ecf32_firmado_xml': ecf_firmado,
            'nombre_archivo': f'{rnc_emisor}{encf}.xml',
        })

    return JsonResponse({'resultados': resultados})
```

- [ ] **Step 4: Agregar la ruta**

En `backend/apps/fe/urls.py`:

```python
    path('certificacion/paso2-rfce/', views.certificacion_paso2_rfce_view),
```

- [ ] **Step 5: Correr el test para confirmar que pasa**

Run: `docker exec facturation_backend python -m pytest apps/fe/tests/test_views_certificacion.py -k rfce -v`
Expected: `2 passed`

- [ ] **Step 6: Commit**

```bash
git add backend/apps/fe/views.py backend/apps/fe/urls.py backend/apps/fe/tests/test_views_certificacion.py
git commit -m "feat(fe): endpoint bulk Paso 2 RFCE, devuelve e-CF32 firmado para descarga manual"
```

---

### Task 4: Endpoint bulk del Paso 3 (Aprobación Comercial, `POST /api/fe/certificacion/paso3-aprobaciones/`)

**Files:**
- Modify: `backend/apps/fe/views.py` (agregar `certificacion_paso3_view`)
- Modify: `backend/apps/fe/urls.py`
- Test: `backend/apps/fe/tests/test_views_certificacion.py` (agregar tests)

- [ ] **Step 1: Agregar el test que falla**

Agregar a `backend/apps/fe/tests/test_views_certificacion.py`:

```python
def _excel_aprobaciones_bytes(filas):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'ACEECF_Generadas'
    headers = ['Version', 'RNCEmisor', 'eNCF', 'FechaEmision', 'MontoTotal',
               'RNCComprador', 'Estado', 'DetalleMotivoRechazo',
               'FechaHoraAprobacionComercial']
    ws.append(headers)
    for fila in filas:
        ws.append([fila.get(h) for h in headers])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()


def test_paso3_requiere_login(client, db):
    resp = client.post('/api/fe/certificacion/paso3-aprobaciones/', data={'no_cia': '01'})
    assert resp.status_code in (302, 401, 403)


def test_paso3_envia_cada_fila_del_excel(cliente_autenticado, monkeypatch):
    fila = {
        'Version': '1.0', 'RNCEmisor': '131880681', 'eNCF': 'E310000000001',
        'FechaEmision': '01-04-2020', 'MontoTotal': 7080,
        'RNCComprador': '130217432', 'Estado': 1,
        'DetalleMotivoRechazo': None,
        'FechaHoraAprobacionComercial': '17-09-2026 11:44:23',
    }
    archivo = _excel_aprobaciones_bytes([fila])

    monkeypatch.setattr(ecf_builder, 'construir_acecf', lambda row: '<ACECF/>')
    envios = []

    def fake_enviar(no_cia, ambiente, e_ncf, rnc_comprador, xml):
        envios.append((ambiente, e_ncf, rnc_comprador))
        return {'mensaje': [], 'estado': 'Aprobacion Comercial Aprobada.',
                'codigo': '01', 'xml_firmado': '<x/>', 'respuesta_cruda': {}}

    monkeypatch.setattr(dgii_client, 'enviar_aprobacion_comercial', fake_enviar)

    resp = cliente_autenticado.post(
        '/api/fe/certificacion/paso3-aprobaciones/',
        data={'no_cia': '01', 'archivo': _as_upload(archivo)},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body['resultados']) == 1
    assert body['resultados'][0]['ok'] is True
    assert body['resultados'][0]['estado'] == 'Aprobacion Comercial Aprobada.'
    assert envios == [('certecf', 'E310000000001', '130217432')]
```

- [ ] **Step 2: Correr el test para confirmar que falla**

Run: `docker exec facturation_backend python -m pytest apps/fe/tests/test_views_certificacion.py -k paso3 -v`
Expected: `404`

- [ ] **Step 3: Implementar la vista**

En `backend/apps/fe/views.py`:

```python
@login_required
@csrf_exempt
@require_http_methods(['POST'])
def certificacion_paso3_view(request):
    """Paso 3 de certificacion DGII (Aprobaciones Comerciales): sube el
    Excel que se descarga del Portal de Certificacion ("Descargar
    aprobaciones comerciales", hoja ``ACEECF_Generadas``) y envia cada
    fila TAL CUAL viene -- certecf exige los datos exactos del "conjunto
    de datos entregados", no hay que corregir RNCEmisor/RNCComprador aqui
    (a diferencia de lo que se penso al principio con RNCComprador en
    Paso 2, ver memoria del proyecto).
    """
    no_cia = request.POST.get('no_cia')
    archivo = request.FILES.get('archivo')
    if not no_cia:
        return _err('no_cia requerido')
    if not archivo:
        return _err('archivo (.xlsx) requerido')
    try:
        filas = _leer_filas_excel(archivo, 'ACEECF_Generadas')
    except ValueError as exc:
        return _err(str(exc))

    resultados = []
    for row in filas:
        encf = row.get('eNCF')
        if not encf:
            continue
        try:
            xml_sin_firmar = ecf_builder.construir_acecf(row)
            resultado = dgii_client.enviar_aprobacion_comercial(
                no_cia, _AMBIENTE_MODO_TEST, encf, str(row['RNCComprador']), xml_sin_firmar)
        except (ecf_builder.ECFBuilderError, dgii_client.DgiiError, KeyError, ValueError) as exc:
            resultados.append({'encf': encf, 'ok': False, 'error': str(exc)})
            continue
        resultados.append({
            'encf': encf, 'ok': True,
            'estado': resultado['estado'], 'codigo': resultado['codigo'],
        })

    return JsonResponse({'resultados': resultados})
```

- [ ] **Step 4: Agregar la ruta**

En `backend/apps/fe/urls.py`:

```python
    path('certificacion/paso3-aprobaciones/', views.certificacion_paso3_view),
```

- [ ] **Step 5: Correr el test para confirmar que pasa**

Run: `docker exec facturation_backend python -m pytest apps/fe/tests/test_views_certificacion.py -k paso3 -v`
Expected: `2 passed`

- [ ] **Step 6: Correr TODA la suite de `apps.fe` antes de seguir**

Run: `docker exec facturation_backend python -m pytest apps/fe/tests/ -q`
Expected: todos los tests pasan (excepto los 2 que ya fallaban antes de este plan por falta de fixtures XSD en la VM, ver memoria -- no relacionados con este cambio)

- [ ] **Step 7: Commit**

```bash
git add backend/apps/fe/views.py backend/apps/fe/urls.py backend/apps/fe/tests/test_views_certificacion.py
git commit -m "feat(fe): endpoint bulk Paso 3 Aprobacion Comercial"
```

---

### Task 5: Frontend — hooks de API para los 3 endpoints nuevos

**Files:**
- Modify: `frontend/src/features/fe/api.ts`

- [ ] **Step 1: Agregar los tipos y hooks**

Al final de `frontend/src/features/fe/api.ts`, agregar:

```typescript
// ---------------------------------------------------------------------------
// Panel de Certificación e-CF — Pasos 2/3 (sube el Excel oficial completo
// de la DGII, en vez de copiar filas a mano como en Modo Test)
// ---------------------------------------------------------------------------

export interface ResultadoEnvioCertificacion {
  encf: string
  ok: boolean
  error?: string
  trackId?: string
}

export interface ResultadoRfceCertificacion extends ResultadoEnvioCertificacion {
  estado_rfce?: string
  codigo_seguridad?: string
  ecf32_firmado_xml?: string
  nombre_archivo?: string
}

export interface ResultadoAprobacionCertificacion extends ResultadoEnvioCertificacion {
  estado?: string
  codigo?: string
}

export function useCertificacionPaso2Ecf(noCia: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (archivo: File) => {
      const fd = new FormData()
      fd.append('no_cia', noCia)
      fd.append('archivo', archivo)
      return feRequest<{ resultados: ResultadoEnvioCertificacion[] }>(
        `/fe/certificacion/paso2-ecf/`,
        { method: 'POST', body: fd }
      )
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fe-documentos', noCia] }),
  })
}

export function useCertificacionPaso2Rfce(noCia: string) {
  return useMutation({
    mutationFn: (archivo: File) => {
      const fd = new FormData()
      fd.append('no_cia', noCia)
      fd.append('archivo', archivo)
      return feRequest<{ resultados: ResultadoRfceCertificacion[] }>(
        `/fe/certificacion/paso2-rfce/`,
        { method: 'POST', body: fd }
      )
    },
  })
}

export function useCertificacionPaso3(noCia: string) {
  return useMutation({
    mutationFn: (archivo: File) => {
      const fd = new FormData()
      fd.append('no_cia', noCia)
      fd.append('archivo', archivo)
      return feRequest<{ resultados: ResultadoAprobacionCertificacion[] }>(
        `/fe/certificacion/paso3-aprobaciones/`,
        { method: 'POST', body: fd }
      )
    },
  })
}

/** Dispara la descarga de un e-CF32 firmado (texto XML) como archivo local
 * -- para que el operador lo suba a mano al widget del Portal DGII. */
export function descargarXmlComoArchivo(nombreArchivo: string, contenidoXml: string) {
  const blob = new Blob([contenidoXml], { type: 'application/xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 2: Verificar que compila**

Run: `cd frontend && npx tsc -b`
Expected: sin errores nuevos (ver memoria `feedback_node_version_vite8_local` -- usar `tsc -b`, no `vite dev`, el Node local es muy viejo para vite@8)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/fe/api.ts
git commit -m "feat(fe): hooks de API para el Panel de Certificacion e-CF"
```

---

### Task 6: Frontend — pantalla "Certificación e-CF"

**Files:**
- Create: `frontend/src/features/fe/fe-certificacion.tsx`
- Modify: `frontend/src/features/settings/unified/unified-facturacion-electronica.tsx` (agregar tab)

- [ ] **Step 1: Crear el componente**

Crear `frontend/src/features/fe/fe-certificacion.tsx`:

```tsx
// Panel de Certificación e-CF — ejecuta los Pasos 2 y 3 del flujo de
// certificación DGII (Postulación) subiendo los Excel oficiales que se
// descargan del propio Portal de Certificación, en vez de correr scripts
// sueltos contra la VM. El paso "Cuarto" (subida de las Facturas de
// Consumo < 250Mil al widget del portal) sigue siendo manual a propósito
// -- es una acción de navegador en el sitio de la DGII, no un servicio
// REST que se pueda automatizar desde aquí.
import { useRef, useState } from 'react'
import { CheckCircle2, Download, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  descargarXmlComoArchivo,
  useCertificacionPaso2Ecf,
  useCertificacionPaso2Rfce,
  useCertificacionPaso3,
  type ResultadoAprobacionCertificacion,
  type ResultadoEnvioCertificacion,
  type ResultadoRfceCertificacion,
} from '@/features/fe/api'

function FilaResultado({ r }: { r: ResultadoEnvioCertificacion }) {
  return (
    <TableRow>
      <TableCell className='font-mono text-xs'>{r.encf}</TableCell>
      <TableCell>
        {r.ok ? (
          <Badge className='gap-1 bg-emerald-600'>
            <CheckCircle2 className='h-3 w-3' /> OK
          </Badge>
        ) : (
          <Badge variant='destructive' className='gap-1'>
            <XCircle className='h-3 w-3' /> Error
          </Badge>
        )}
      </TableCell>
      <TableCell className='text-muted-foreground text-xs'>
        {r.ok ? r.trackId : r.error}
      </TableCell>
    </TableRow>
  )
}

function PasoUploadCard({
  titulo,
  descripcion,
  onEnviar,
  isPending,
  resultados,
  extraColumna,
}: {
  titulo: string
  descripcion: string
  onEnviar: (archivo: File) => void
  isPending: boolean
  resultados: ResultadoEnvioCertificacion[] | undefined
  extraColumna?: (r: any) => React.ReactNode
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{titulo}</CardTitle>
        <CardDescription>{descripcion}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <input
            ref={inputRef}
            type='file'
            accept='.xlsx'
            className='text-sm'
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          />
          <Button
            disabled={!archivo || isPending}
            onClick={() => archivo && onEnviar(archivo)}
          >
            {isPending ? 'Enviando…' : 'Enviar a la DGII'}
          </Button>
        </div>
        {resultados && resultados.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>e-NCF</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Detalle</TableHead>
                {extraColumna && <TableHead>Acción</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {resultados.map((r) => (
                <>
                  <FilaResultado key={r.encf} r={r} />
                  {extraColumna && (
                    <TableRow key={`${r.encf}-extra`}>
                      <TableCell colSpan={3} />
                      <TableCell>{extraColumna(r)}</TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

export function FeCertificacion({ noCia }: { noCia: string }) {
  const paso2Ecf = useCertificacionPaso2Ecf(noCia)
  const paso2Rfce = useCertificacionPaso2Rfce(noCia)
  const paso3 = useCertificacionPaso3(noCia)

  return (
    <div className='space-y-4'>
      <Alert>
        <AlertTitle>Panel de Certificación e-CF (Postulación DGII)</AlertTitle>
        <AlertDescription>
          Descargue el Excel oficial de cada paso desde el Portal de
          Certificación (
          <code className='text-xs'>
            https://ecf.dgii.gov.do/certecf/portalcertificacion
          </code>
          ) y súbalo aquí. Todos los envíos van SIEMPRE contra el ambiente{' '}
          <code className='text-xs'>certecf</code>, nunca producción.
        </AlertDescription>
      </Alert>

      <PasoUploadCard
        titulo='Paso 2 — Pruebas de Datos e-CF'
        descripcion='Suba el "Set de datos a utilizar" (botón "Descargar comprobantes" del Paso 2, hoja ECF). Envía las facturas ≥ RD$250,000 y el resto de tipos (31/33/34/41/43/44/45/46/47).'
        onEnviar={(archivo) =>
          paso2Ecf.mutate(archivo, {
            onSuccess: (r) =>
              toast.success(`${r.resultados.filter((x) => x.ok).length}/${r.resultados.length} comprobantes aceptados`),
            onError: (e: any) => toast.error(e.message),
          })
        }
        isPending={paso2Ecf.isPending}
        resultados={paso2Ecf.data?.resultados}
      />

      <PasoUploadCard
        titulo='Paso 2 — Facturas de Consumo < RD$250,000 (RFCE)'
        descripcion='Mismo Excel del Paso 2 (hoja RFCE). Envía el Resumen de cada factura y le devuelve el e-CF32 firmado para descargar y subir a mano en el widget "Facturas de consumo < 250Mil" del propio Portal de Certificación.'
        onEnviar={(archivo) =>
          paso2Rfce.mutate(archivo, {
            onSuccess: (r) =>
              toast.success(`${r.resultados.filter((x) => x.ok).length}/${r.resultados.length} resúmenes aceptados — descargue los XML para subirlos al portal`),
            onError: (e: any) => toast.error(e.message),
          })
        }
        isPending={paso2Rfce.isPending}
        resultados={paso2Rfce.data?.resultados}
        extraColumna={(r: ResultadoRfceCertificacion) =>
          r.ok && r.ecf32_firmado_xml ? (
            <Button
              size='sm'
              variant='outline'
              className='gap-1'
              onClick={() =>
                descargarXmlComoArchivo(r.nombre_archivo!, r.ecf32_firmado_xml!)
              }
            >
              <Download className='h-3 w-3' /> Descargar XML
            </Button>
          ) : null
        }
      />

      <PasoUploadCard
        titulo='Paso 3 — Aprobaciones Comerciales'
        descripcion='Suba el Excel del Paso 3 ("Descargar aprobaciones comerciales", hoja ACEECF_Generadas). Reenvía cada aprobación tal cual la generó la DGII.'
        onEnviar={(archivo) =>
          paso3.mutate(archivo, {
            onSuccess: (r) =>
              toast.success(`${r.resultados.filter((x) => x.ok).length}/${r.resultados.length} aprobaciones enviadas`),
            onError: (e: any) => toast.error(e.message),
          })
        }
        isPending={paso3.isPending}
        resultados={paso3.data?.resultados as ResultadoAprobacionCertificacion[] | undefined}
      />
    </div>
  )
}
```

- [ ] **Step 2: Registrar la tab en la pantalla de Configuración**

En `frontend/src/features/settings/unified/unified-facturacion-electronica.tsx`:

Agregar el import (junto al de `FeModoTest`, línea ~54):
```typescript
import { FeCertificacion } from '@/features/fe/fe-certificacion'
```

Agregar el `TabsTrigger` (junto a los otros, después de `modo-test`, línea ~168):
```tsx
        <TabsTrigger value='certificacion'>Certificación e-CF</TabsTrigger>
```

Agregar el `TabsContent` (después del de `modo-test`, línea ~378):
```tsx
      <TabsContent value='certificacion' className='pt-4'>
        <FeCertificacion noCia={noCia} />
      </TabsContent>
```

(`noCia` ya existe como prop/variable en este componente — usar el mismo que usan los otros `TabsContent`.)

- [ ] **Step 3: Verificar que compila**

Run: `cd frontend && npx tsc -b`
Expected: sin errores

- [ ] **Step 4: Smoke test manual en el navegador**

Ir a Configuración → Facturación Electrónica → tab "Certificación e-CF". Subir el Excel real (`backend/docs/superpowers/reference/2026-08-31-set-pruebas-paso2/set-pruebas-130217432.xlsx`) al primer botón y confirmar que la tabla de resultados aparece (puede dar error de "e-NCF ya usado" si se corre contra `certecf` real después de que Paso 2 ya está completo — eso es esperado y CORRECTO, no es un bug del panel).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fe/fe-certificacion.tsx frontend/src/features/settings/unified/unified-facturacion-electronica.tsx
git commit -m "feat(fe): pantalla Certificacion e-CF en Configuracion > Facturacion Electronica"
```

---

### Task 7: Ayuda — Manual de Facturación Electrónica (in-app)

**Por qué:** el usuario pidió documentación para que "una persona X" pueda operar la facturación electrónica sin depender de un desarrollador. El sistema legacy de manuales (`MAN.TMANUAL`, ver `frontend/src/features/man/man-manuales.tsx`) es una tabla migrada de Oracle Forms, sin endpoint de creación y sin ningún módulo `FE` cargado todavía — construir ese INSERT es desproporcionado para una sola entrada. En vez de eso: una tab de Ayuda embebida en la propia pantalla de Facturación Electrónica, con markdown estático (mismo renderer que ya usa `man-manuales.tsx`), así el contenido vive junto al código y no depende de una fila en una tabla legacy.

**Files:**
- Create: `frontend/src/features/fe/fe-ayuda-contenido.ts`
- Create: `frontend/src/features/fe/fe-ayuda.tsx`
- Modify: `frontend/src/features/settings/unified/unified-facturacion-electronica.tsx` (agregar tab)

- [ ] **Step 1: Escribir el contenido del manual**

Crear `frontend/src/features/fe/fe-ayuda-contenido.ts`:

```typescript
// Contenido del manual de Facturación Electrónica (e-CF), pensado para un
// operador SIN conocimientos técnicos. Se actualiza junto con el código
// -- si cambia el flujo de un paso, actualizar este texto en el mismo PR.
export const FE_AYUDA_MARKDOWN = `
# Manual de Facturación Electrónica (e-CF)

## ¿Qué es esto?

La DGII exige que ciertas empresas emitan sus facturas en un formato
digital especial llamado **e-CF** (Comprobante Fiscal Electrónico), en
vez del NCF de papel de siempre. ZentoryERP ya sabe generar, firmar y
enviar estos comprobantes a la DGII.

## Antes de poder facturar electrónicamente: la Certificación

Antes de emitir e-CF reales, la DGII exige pasar por un proceso de
**Certificación** — un examen técnico donde la empresa demuestra que su
sistema (ZentoryERP) puede generar y enviar comprobantes de prueba
correctamente. Esto se hace UNA SOLA VEZ por empresa, no por cada factura.

### Pasos de la Certificación (resumen)

1. **Postulación**: solicitud formal ante la DGII (ya hecha para
   Abregonza, solicitud núm. 81443).
2. **Paso 2 — Pruebas de Datos e-CF**: la DGII entrega un archivo Excel
   con 21 facturas de prueba + 4 resúmenes. Se suben desde
   *Configuración → Facturación Electrónica → Certificación e-CF*.
3. **Paso 3 — Aprobaciones Comerciales**: la DGII genera 11 "aprobaciones"
   simuladas que hay que reenviarle. Mismo panel.
4. **Pasos 4 en adelante**: pruebas con datos reales de la empresa,
   representación impresa (PDF) con código QR, y activación final en
   producción. (Pendiente de completar — ver estado real en el Portal de
   Certificación de la DGII.)

**Importante**: estos pasos los ejecuta alguien del equipo técnico UNA
VEZ. Un usuario normal de facturación no necesita tocar la pantalla de
Certificación.

## Configurar la empresa (una vez, antes de facturar)

*Configuración → Facturación Electrónica → tab "Configuración"*:

1. Cargar el **certificado digital** (.p12) de la persona autorizada como
   Administrador de e-CF ante la DGII, junto con su clave.
2. Verificar los datos del **Emisor** (RNC, razón social, dirección) —
   deben coincidir EXACTO con lo que la DGII tiene registrado.
3. Elegir el **ambiente**: mientras se está certificando, usar
   *Certificación (CerteCF)*. Solo cuando la DGII confirme la
   certificación completa, cambiar a *Producción (eCF)*.
4. Botón **"Probar conexión con la DGII"** — confirma que el certificado
   funciona antes de intentar facturar.

## Revisar comprobantes enviados

*Configuración → Facturación Electrónica → tab "Comprobante Electrónico"*
muestra todos los e-CF enviados: estado (Aceptado / Rechazado / En
proceso), fecha, y permite:
- **Consultar estado**: le pregunta a la DGII si ya procesó el documento.
- **Reenviar**: solo aparece si el estado es "Rechazado" — corrige el
  problema y reintenta.

## ¿Qué hacer si algo falla?

- **"Rechazado" con un motivo de RNC/dato inválido**: revisar que el dato
  del comprador (RNC, razón social) esté correcto en la factura de
  origen.
- **Error de conexión/certificado**: usar "Probar conexión con la DGII"
  en la pantalla de Configuración para diagnosticar.
- Para cualquier duda sobre el estado de la Certificación (no de una
  factura real), contactar al equipo técnico — el estado real y
  actualizado vive en el propio Portal de Certificación de la DGII
  (\`ecf.dgii.gov.do/certecf/portalcertificacion\`), no solo en
  ZentoryERP.
`.trim()
`
```

- [ ] **Step 2: Crear el componente que renderiza el manual**

Crear `frontend/src/features/fe/fe-ayuda.tsx`:

```tsx
// Tab de Ayuda de Facturación Electrónica -- mismo renderer markdown que
// usa el módulo de Manuales (frontend/src/features/man/man-manuales.tsx),
// pero con contenido embebido en el código (ver fe-ayuda-contenido.ts)
// en vez de una fila en MAN.TMANUAL (tabla legacy sin endpoint de
// creación, ver Task 7 del plan de este panel).
import { Card, CardContent } from '@/components/ui/card'
import { renderMarkdown } from '@/features/docs/md'
import { FE_AYUDA_MARKDOWN } from '@/features/fe/fe-ayuda-contenido'

export function FeAyuda() {
  return (
    <Card>
      <CardContent className='pt-6'>
        <article
          className='prose prose-sm dark:prose-invert max-w-none'
          dangerouslySetInnerHTML={{ __html: renderMarkdown(FE_AYUDA_MARKDOWN) }}
        />
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Registrar la tab**

En `frontend/src/features/settings/unified/unified-facturacion-electronica.tsx`:

Agregar el import:
```typescript
import { FeAyuda } from '@/features/fe/fe-ayuda'
```

Agregar el `TabsTrigger` (después de `certificacion`):
```tsx
        <TabsTrigger value='ayuda'>Ayuda</TabsTrigger>
```

Agregar el `TabsContent`:
```tsx
      <TabsContent value='ayuda' className='pt-4'>
        <FeAyuda />
      </TabsContent>
```

- [ ] **Step 4: Verificar que compila**

Run: `cd frontend && npx tsc -b`
Expected: sin errores

- [ ] **Step 5: Smoke test manual**

Ir a Configuración → Facturación Electrónica → tab "Ayuda", confirmar que el manual se ve legible (títulos, listas, código inline).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/fe/fe-ayuda-contenido.ts frontend/src/features/fe/fe-ayuda.tsx frontend/src/features/settings/unified/unified-facturacion-electronica.tsx
git commit -m "docs(fe): manual de Facturacion Electronica embebido (tab Ayuda)"
```

---

### Task 8: Desplegar a la VM y smoke test end-to-end

**Files:** ninguno nuevo — despliegue de todo lo de Tasks 1-7.

- [ ] **Step 1: Sincronizar backend completo a la VM**

Seguir la skill `sigaft-deploy-vm`. Comando base (ajustar credenciales/host según `project_vm_credentials`):

```bash
pscp -pw 'Temp1234!' -hostkey 'SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc' -r \
  backend/apps/fe jcabreu@10.0.0.99:/home/jcabreu/facturation-system/backend/apps/
```

- [ ] **Step 2: Correr la suite completa de tests en la VM**

Run: `plink ... "docker exec facturation_backend python -m pytest apps/fe/tests/ -q"`
Expected: todos pasan salvo los 2 ya-conocidos sin fixtures XSD

- [ ] **Step 3: Push a main/Netlify del frontend**

Commit + push de la rama a `main` (o el flujo de PR habitual del repo) para que Netlify construya el frontend nuevo. Verificar el marker de build en el bundle (ver `reference_netlify_deploy_status_api`).

- [ ] **Step 4: Smoke test real en el navegador**

Con Playwright o el navegador real: loguearse en ZentoryERP, ir a Configuración → Facturación Electrónica → Certificación e-CF, confirmar que las 3 tarjetas se ven y el input de archivo funciona. NO hace falta volver a enviar los 21+4+11 reales (ya están "Aceptado" en `certecf`) — alcanza con confirmar que la UI carga y que un envío de prueba con datos ya usados da el error esperado de la DGII (confirma que el endpoint real está conectado, no mockeado).

- [ ] **Step 5: Actualizar memoria del proyecto**

Anotar en `project_dgii_ecf_postulacion_estado_20260831` que los Pasos 2 y 3 ahora se pueden re-ejecutar desde la UI (Panel de Certificación e-CF), ya no dependen de scripts sueltos en la VM.

---

### Task 9 (investigación, NO implementación): Levantar los requisitos exactos del Paso 4

**Por qué NO tiene código todavía:** el Paso 4 ("Pruebas de Simulación e-CF") pide datos de operaciones REALES de la empresa (no un Excel fijo de la DGII) y representación impresa (PDF) con código QR — un alcance genuinamente nuevo que no se puede planear en detalle sin ver primero qué pide exactamente el portal en cada sub-paso (4 a 15 del flujo). Escribir tareas con código específico ahora sería inventar requisitos.

- [ ] **Step 1:** Loguearse en `https://ecf.dgii.gov.do/certecf/portalcertificacion/Postulacion/PruebasSimulacion` (credenciales en `reference_accesos_portales_gubernamentales_abregonza`) y documentar en la memoria del proyecto, con capturas si hace falta:
  - ¿El Paso 4 da instrucciones de qué facturas reales usar, o hay que generar facturas nuevas ad-hoc (como Paso 2/3) pero con secuencias reales no reusables?
  - ¿Qué exige exactamente sobre la "representación impresa" — un PDF por comprobante, o solo el QR?
  - ¿El pipeline de producción ya construido (`ecf_builder.construir_ecf_31`/`construir_ecf_32`, que SÍ lee `TFAT_FACTURA` real, Fase 1) sirve tal cual para este paso, o hace falta adaptarlo?
- [ ] **Step 2:** Revisar si `sigaft-pdf-templates`/Puck ya tiene o puede adaptarse a una plantilla e-CF con QR (buscar plantillas existentes en `frontend/src/features/pdf/defaults/` para RI de e-CF; si no existe, es trabajo nuevo).
- [ ] **Step 3:** Con las respuestas de los Steps 1-2, escribir un plan nuevo (`backend/docs/superpowers/plans/YYYY-MM-DD-paso4-simulacion-ecf.md`) con el mismo nivel de detalle que este documento — código completo, sin placeholders — antes de tocar nada.

---

## Self-Review (hecho por quien escribió este plan)

**Cobertura del pedido del usuario:**
- ✅ "todo lo que subas salga del sistema de zentory... se pueda usar a través de la UI" → Tasks 1-6 (3 endpoints reales + pantalla nueva, reemplazando los scripts ad-hoc de hoy).
- ✅ "deje documentado todo en manuales y ayuda" → Task 7 (tab de Ayuda in-app) + memoria actualizada (`project_dgii_ecf_postulacion_estado_20260831`).
- ✅ "guardes memorias de todo" → ya hecho en la sesión de hoy (múltiples actualizaciones a `project_dgii_ecf_postulacion_estado_20260831` + `MEMORY.md`), este plan referencia esa memoria en vez de repetirla.
- ✅ "súper plan para completar todo" → Tasks 1-8 (código completo, ejecutable ya) + Task 9 (investigación honesta para lo que todavía no se puede planear en detalle).

**Placeholder scan:** sin TBD/"implementar después" en Tasks 1-8 (todas con código completo). Task 9 es deliberadamente una investigación, no una implementación — está marcado como tal en el título, no es un placeholder disfrazado.
