# Paso 4 (Pruebas de Simulación e-CF) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan sintaxis de checkbox (`- [ ]`). Desplegar cada cambio backend/frontend a la VM según la skill `sigaft-deploy-vm` y hacer smoke test antes de marcar un paso como hecho.

**Goal:** Que el Paso 4 de certificación DGII ("Pruebas de Simulación e-CF") se pueda ejecutar desde la UI real de ZentoryERP, usando datos reales de Abregonza (no un Excel de la DGII): botón para enviar un e-CF 31/32 desde una factura real de `TFAT_FACTURA`, y un formulario para enviar manualmente los 8 tipos sin pipeline de producción (33/34/41/43/44/45/46/47), consumiendo siempre secuencia REAL y no reutilizable de `TFE_SECUENCIA`.

**Contexto (no repetir, ya investigado):** ver `backend/docs/superpowers/plans/2026-09-17-paso4-simulacion-ecf.md` (investigación en vivo del portal) y memoria del proyecto `project_dgii_ecf_postulacion_estado_20260831`. Resumen: el Paso 4 exige 4×31, 2×32(≥250Mil), 1×33, 2×34, 2×41, 2×43, 2×44, 2×45, 2×46, 2×47, 4×32 RFCE, mismo orden Primero/Segundo/Tercero/Cuarto que el Paso 2 (Primero: 31,32≥250Mil,41,43,44,45,46,47 · Segundo: 33,34 · Tercero: RFCE · Cuarto: e-CF32 completo <250Mil por widget manual del portal). El PDF con QR se pide en el Paso 5, NO en este paso — fuera de alcance aquí.

**Architecture:** Dos endpoints REST nuevos en `apps/fe`, cada uno reutilizando 100% el código de producción ya probado: (a) `paso4-factura-real` llama `ecf_builder.construir_ecf_31/32` (el mismo pipeline de Fase 1 que ya lee `TFAT_FACTURA` y ya consume secuencia real) sobre una factura real existente; (b) `paso4-manual` reutiliza `ecf_builder.construir_ecf_generico` (el mismo builder de Modo Test) pero, a diferencia de Modo Test, consume una secuencia REAL vía `fe_repo.consumir_siguiente_encf` en vez de aceptar un e-NCF fijo del operador. Antes de poder usar los 7 tipos sin secuencia configurada (33 ya tiene, faltan 41/43/44/45/46/47) hay que sembrar `TFE_SECUENCIA` con `fe_repo.upsert_secuencia` (dato, no código). La UI extiende la pantalla "Certificación e-CF" ya existente con una sección nueva "Paso 4 — Simulación (datos reales)".

**Tech Stack:** Django (views + `apps.fe.ecf_builder`/`dgii_client`/`apps.legacy.repositories.fe_repo` ya existentes), React + TanStack Query + shadcn/ui (mismo patrón que `fe-certificacion.tsx`/`fe-modo-test.tsx`).

---

### Task 0: Sembrar las secuencias e-NCF que faltan (dato, no código)

**Por qué:** `TFE_SECUENCIA` (cía 01) hoy solo tiene filas para tipo 31, 32 y 34 (verificado en vivo, 2026-09-17). Faltan 33, 41, 43, 44, 45, 46 y 47. Sin esto, `fe_repo.consumir_siguiente_encf` lanza `ValueError` para esos tipos y el Paso 4 no puede enviarlos.

**No es un cambio de código** — se hace con la función `fe_repo.upsert_secuencia` ya existente, vía `manage.py shell` en la VM (mismo patrón usado el 2026-09-15 para sembrar el tipo 32). Rango real confirmado por el propio portal: "1 a 10,000,000" (1 a 50,000,000 para tipo 32, ya sembrado). Fecha de vencimiento real ya confirmada en sesiones previas: `2028-12-31`.

- [ ] **Step 1: Ejecutar en la VM**

```bash
plink -batch -pw 'Temp1234!' -hostkey 'SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc' jcabreu@10.0.0.99 "docker exec -i facturation_backend python manage.py shell" <<'EOF'
from apps.legacy.repositories import fe_repo
for tipo in (33, 41, 43, 44, 45, 46, 47):
    fe_repo.upsert_secuencia('01', {
        'tipo_ecf': str(tipo),
        'secuencia_desde': 1,
        'secuencia_hasta': 10_000_000,
        'prox_secuencia': 1,
        'fecha_vence': '2028-12-31',
        'activa': 'S',
    })
for s in fe_repo.list_secuencias('01'):
    print(s)
EOF
```

Expected: imprime 10 filas en total -- 3 preexistentes (31, 32, 34,
verificadas 2026-09-17 con `list_secuencias('01')`) + las 7 sembradas
ahora (33, 41, 43, 44, 45, 46, 47), cada una con `activa: 'S'`.

- [ ] **Step 2: Verificar que NO se pisó la fila de tipo 31 existente**

Run el mismo `list_secuencias('01')` de arriba y confirmar que la fila
`tipo_ecf: '31'` sigue con el `prox_secuencia` que ya tenía antes (54 al
momento de escribir este plan) -- `upsert_secuencia` solo tocó las 7
filas nuevas, no debe haber alterado las 3 que ya existían.

---

### Task 1: Endpoint `POST /api/fe/certificacion/paso4-factura-real/`

**Files:**
- Modify: `backend/apps/fe/views.py`
- Modify: `backend/apps/fe/urls.py`
- Test: `backend/apps/fe/tests/test_views_certificacion.py`

- [ ] **Step 1: Escribir el test que falla**

Agregar a `backend/apps/fe/tests/test_views_certificacion.py`:

```python
def test_paso4_factura_real_requiere_login(client, db):
    resp = client.post('/api/fe/certificacion/paso4-factura-real/', data={'no_cia': '01'})
    assert resp.status_code in (302, 401, 403)


def test_paso4_factura_real_campos_requeridos(cliente_autenticado):
    resp = cliente_autenticado.post(
        '/api/fe/certificacion/paso4-factura-real/',
        data={'no_cia': '01', 'tipo_ecf': '31'})
    assert resp.status_code == 400
    assert 'punto' in resp.json()['detail'].lower()


def test_paso4_factura_real_envia_tipo_31(cliente_autenticado, monkeypatch):
    monkeypatch.setattr(
        ecf_builder, 'construir_ecf_31',
        lambda no_cia, punto, tipo_factura, no_factura: '<ECF/>')
    envios = []

    def fake_enviar_ecf(no_cia, ambiente, e_ncf, xml_sin_firmar):
        envios.append((ambiente, e_ncf))
        return {'trackId': 'TRACK-1', 'xml_firmado': '<ECF firmado/>',
                'respuesta_cruda': {'trackId': 'TRACK-1'}}

    monkeypatch.setattr(dgii_client, 'enviar_ecf', fake_enviar_ecf)
    monkeypatch.setattr(
        'apps.legacy.repositories.fe_repo.save_documento_enviado',
        lambda *a, **k: None)

    resp = cliente_autenticado.post(
        '/api/fe/certificacion/paso4-factura-real/',
        data={'no_cia': '01', 'tipo_ecf': '31', 'punto': '01',
              'tipo_factura': 'FT', 'no_factura': '123'})
    assert resp.status_code == 200
    body = resp.json()
    assert body['ok'] is True
    assert body['trackId'] == 'TRACK-1'
    assert envios == [('certecf', None)] or envios[0][0] == 'certecf'


def test_paso4_factura_real_tipo_invalido_da_400(cliente_autenticado):
    resp = cliente_autenticado.post(
        '/api/fe/certificacion/paso4-factura-real/',
        data={'no_cia': '01', 'tipo_ecf': '99', 'punto': '01',
              'tipo_factura': 'FT', 'no_factura': '123'})
    assert resp.status_code == 400
    assert '31' in resp.json()['detail'] or '32' in resp.json()['detail']


def test_paso4_factura_real_error_de_builder_da_400(cliente_autenticado, monkeypatch):
    def fake_construir(*a, **k):
        raise ecf_builder.ECFBuilderError('factura anulada')

    monkeypatch.setattr(ecf_builder, 'construir_ecf_32', fake_construir)

    resp = cliente_autenticado.post(
        '/api/fe/certificacion/paso4-factura-real/',
        data={'no_cia': '01', 'tipo_ecf': '32', 'punto': '01',
              'tipo_factura': 'FC', 'no_factura': '456'})
    assert resp.status_code == 400
    assert 'factura anulada' in resp.json()['detail']
```

Nota sobre el 3er test: `dgii_client.enviar_ecf(no_cia, ambiente, e_ncf,
xml_sin_firmar)` recibe el `e_ncf` real dentro del XML que armó
`construir_ecf_31` mockeado (que en el mock devuelve `'<ECF/>'` sin
`eNCF` real) -- la vista debe extraer el `e_ncf` real desde el XML
firmado que devuelve `dgii_client.enviar_ecf` en su respuesta
(`resultado['e_ncf']`, ver Step 3) en vez de intentar parsearlo del XML
sin firmar. Por eso el assert de `envios` es flexible arriba: lo que
importa es que el ambiente sea siempre `certecf`.

- [ ] **Step 2: Correr el test para confirmar que falla**

Run: `docker exec facturation_backend python -m pytest apps/fe/tests/test_views_certificacion.py -k paso4_factura_real -v`
Expected: `404` (ruta no existe)

- [ ] **Step 3: Implementar la vista**

En `backend/apps/fe/views.py`, agregar `import re` junto a los imports
existentes del inicio del archivo (junto a `import json`/`import
openpyxl`), y agregar después de `certificacion_paso3_view`:

```python
_TIPOS_ECF_DESDE_FACTURA = {31: ecf_builder.construir_ecf_31,
                             32: ecf_builder.construir_ecf_32}


@login_required
@csrf_exempt
@require_http_methods(['POST'])
def certificacion_paso4_factura_real_view(request):
    """Paso 4 de certificacion DGII (grupo "Primero", tipos 31/32): arma
    el e-CF desde una factura REAL ya emitida en TFAT_FACTURA (mismo
    pipeline de produccion de Fase 1, ``ecf_builder.construir_ecf_31/32``
    -- consume secuencia REAL de TFE_SECUENCIA, no reutilizable) y la
    envia contra ``certecf``. A diferencia del Paso 2, aqui NO hay Excel
    de la DGII: el operador elige que factura real usar.
    """
    no_cia = request.POST.get('no_cia')
    tipo_ecf_raw = request.POST.get('tipo_ecf')
    punto = request.POST.get('punto')
    tipo_factura = request.POST.get('tipo_factura')
    no_factura = request.POST.get('no_factura')
    if not no_cia:
        return _err('no_cia requerido')
    if not all([punto, tipo_factura, no_factura]):
        return _err('punto, tipo_factura y no_factura son requeridos')
    try:
        tipo_ecf = int(tipo_ecf_raw)
    except (TypeError, ValueError):
        return _err('tipo_ecf debe ser 31 o 32')
    builder = _TIPOS_ECF_DESDE_FACTURA.get(tipo_ecf)
    if builder is None:
        return _err('tipo_ecf debe ser 31 (Credito Fiscal) o 32 (Consumo)')
    try:
        xml_sin_firmar = builder(no_cia, punto, tipo_factura, no_factura)
    except ecf_builder.ECFBuilderError as exc:
        return _err(str(exc))
    # ecf_builder ya consumio la secuencia real dentro de xml_sin_firmar;
    # extraer el eNCF asignado para guardar la bitacora.
    m = re.search(r'<eNCF>([^<]+)</eNCF>', xml_sin_firmar)
    e_ncf = m.group(1) if m else None
    try:
        resultado = dgii_client.enviar_ecf(no_cia, _AMBIENTE_MODO_TEST, e_ncf, xml_sin_firmar)
    except dgii_client.DgiiError as exc:
        return _err(str(exc), status=502)
    fe_repo.save_documento_enviado(
        no_cia, e_ncf, str(tipo_ecf), resultado['trackId'],
        resultado['xml_firmado'], json.dumps(resultado['respuesta_cruda']),
        es_prueba='S')
    return JsonResponse({'ok': True, 'encf': e_ncf, 'trackId': resultado['trackId']})
```

- [ ] **Step 4: Agregar la ruta**

En `backend/apps/fe/urls.py`:

```python
    path('certificacion/paso4-factura-real/', views.certificacion_paso4_factura_real_view),
```

- [ ] **Step 5: Correr el test para confirmar que pasa**

Run: `docker exec facturation_backend python -m pytest apps/fe/tests/test_views_certificacion.py -k paso4_factura_real -v`
Expected: `5 passed`

- [ ] **Step 6: Commit**

```bash
git add backend/apps/fe/views.py backend/apps/fe/urls.py backend/apps/fe/tests/test_views_certificacion.py
git commit -m "feat(fe): endpoint Paso 4 desde factura real (tipos 31/32)"
```

---

### Task 2: Endpoint `POST /api/fe/certificacion/paso4-manual/`

**Files:**
- Modify: `backend/apps/fe/views.py`
- Modify: `backend/apps/fe/urls.py`
- Test: `backend/apps/fe/tests/test_views_certificacion.py`

- [ ] **Step 1: Escribir el test que falla**

Agregar a `backend/apps/fe/tests/test_views_certificacion.py`:

```python
def test_paso4_manual_requiere_login(client, db):
    resp = client.post('/api/fe/certificacion/paso4-manual/', data='{}',
                        content_type='application/json')
    assert resp.status_code in (302, 401, 403)


def test_paso4_manual_campos_requeridos(cliente_autenticado):
    resp = cliente_autenticado.post(
        '/api/fe/certificacion/paso4-manual/',
        data=json.dumps({'no_cia': '01'}), content_type='application/json')
    assert resp.status_code == 400


def test_paso4_manual_consume_secuencia_real_y_envia(cliente_autenticado, monkeypatch):
    monkeypatch.setattr(
        fe_repo, 'consumir_siguiente_encf',
        lambda no_cia, tipo_ecf: {'e_ncf': 'E410000001000',
                                   'fecha_vencimiento_secuencia': None})
    build_calls = []
    monkeypatch.setattr(
        ecf_builder, 'construir_ecf_generico',
        lambda tipo, encf, datos: build_calls.append((tipo, encf)) or '<ECF/>')
    monkeypatch.setattr(
        dgii_client, 'enviar_ecf',
        lambda no_cia, ambiente, e_ncf, xml: {
            'trackId': 'TRACK-41', 'xml_firmado': '<x/>', 'respuesta_cruda': {}})
    monkeypatch.setattr(
        'apps.legacy.repositories.fe_repo.save_documento_enviado',
        lambda *a, **k: None)

    resp = cliente_autenticado.post(
        '/api/fe/certificacion/paso4-manual/',
        data=json.dumps({'no_cia': '01', 'tipo_ecf': 41,
                          'datos': {'RNCEmisor': '130217432'}}),
        content_type='application/json')
    assert resp.status_code == 200
    body = resp.json()
    assert body['ok'] is True
    assert body['encf'] == 'E410000001000'
    assert build_calls == [(41, 'E410000001000')]


def test_paso4_manual_sin_secuencia_configurada_da_400(cliente_autenticado, monkeypatch):
    def fake_consumir(no_cia, tipo_ecf):
        raise ValueError('No hay secuencia activa')

    monkeypatch.setattr(fe_repo, 'consumir_siguiente_encf', fake_consumir)

    resp = cliente_autenticado.post(
        '/api/fe/certificacion/paso4-manual/',
        data=json.dumps({'no_cia': '01', 'tipo_ecf': 46, 'datos': {}}),
        content_type='application/json')
    assert resp.status_code == 400
    assert 'secuencia' in resp.json()['detail'].lower()
```

Nota: hace falta importar `fe_repo` directo (no solo
`apps.legacy.repositories.fe_repo` como string) en el archivo de test
para poder monkeypatchear `consumir_siguiente_encf` -- agregar al inicio
del test file: `from apps.legacy.repositories import fe_repo`.

- [ ] **Step 2: Correr el test para confirmar que falla**

Run: `docker exec facturation_backend python -m pytest apps/fe/tests/test_views_certificacion.py -k paso4_manual -v`
Expected: `404` (ruta no existe)

- [ ] **Step 3: Implementar la vista**

En `backend/apps/fe/views.py`, agregar después de
`certificacion_paso4_factura_real_view`:

```python
@login_required
@csrf_exempt
@require_http_methods(['POST'])
def certificacion_paso4_manual_view(request):
    """Paso 4 de certificacion DGII (grupo "Segundo": tipos 33/34; y el
    resto de "Primero" sin pipeline de produccion: 41/43/44/45/46/47).
    Mismo builder que Modo Test (``ecf_builder.construir_ecf_generico``,
    datos planos escritos a mano por el operador) pero, a diferencia de
    Modo Test, consume una secuencia REAL y no reutilizable de
    TFE_SECUENCIA (``fe_repo.consumir_siguiente_encf``) en vez de un
    e-NCF fijo -- el Paso 4 exige datos de operaciones reales, no el
    Set de Pruebas fijo de la DGII.

    Para tipo 34 (Nota de Credito), ``datos`` debe incluir
    ``NCFModificado`` con el e-NCF de un documento YA enviado en el
    grupo "Primero" (el operador lo copia del resultado de
    ``certificacion_paso4_factura_real_view``/otro envio manual previo).
    """
    try:
        data = json.loads(request.body or b'{}')
    except json.JSONDecodeError:
        return _err('JSON invalido')
    no_cia = data.get('no_cia')
    tipo_ecf_raw = data.get('tipo_ecf')
    datos = data.get('datos') if data.get('datos') is not None else {}
    if not no_cia or tipo_ecf_raw in (None, ''):
        return _err('no_cia y tipo_ecf son requeridos')
    if not isinstance(datos, dict):
        return _err("'datos' debe ser un objeto JSON")
    try:
        tipo_ecf = int(tipo_ecf_raw)
    except (TypeError, ValueError):
        return _err('tipo_ecf debe ser un entero del catalogo TipoeCF')
    try:
        secuencia = fe_repo.consumir_siguiente_encf(no_cia, tipo_ecf)
    except ValueError as exc:
        return _err(str(exc))
    e_ncf = secuencia['e_ncf']
    try:
        xml_sin_firmar = ecf_builder.construir_ecf_generico(tipo_ecf, e_ncf, datos)
    except ecf_builder.ECFBuilderError as exc:
        return _err(str(exc))
    try:
        resultado = dgii_client.enviar_ecf(no_cia, _AMBIENTE_MODO_TEST, e_ncf, xml_sin_firmar)
    except dgii_client.DgiiError as exc:
        return _err(str(exc), status=502)
    fe_repo.save_documento_enviado(
        no_cia, e_ncf, str(tipo_ecf), resultado['trackId'],
        resultado['xml_firmado'], json.dumps(resultado['respuesta_cruda']),
        es_prueba='S')
    return JsonResponse({'ok': True, 'encf': e_ncf, 'trackId': resultado['trackId']})
```

- [ ] **Step 4: Agregar la ruta**

En `backend/apps/fe/urls.py`:

```python
    path('certificacion/paso4-manual/', views.certificacion_paso4_manual_view),
```

- [ ] **Step 5: Correr el test para confirmar que pasa**

Run: `docker exec facturation_backend python -m pytest apps/fe/tests/test_views_certificacion.py -k paso4 -v`
Expected: `9 passed` (los 5 de Task 1 + los 4 de este task)

- [ ] **Step 6: Correr TODA la suite de `apps.fe`**

Run: `docker exec facturation_backend python -m pytest apps/fe/tests/ -q --ignore=apps/fe/tests/test_ecf_builder_generico.py --ignore=apps/fe/tests/test_ecf_builder_rfce.py`
Expected: todos pasan (excepto los 2 ya conocidos por fixtures XSD si no
se instaló `poppler-utils`/no se sincronizó `docs/` a la VM)

- [ ] **Step 7: Commit**

```bash
git add backend/apps/fe/views.py backend/apps/fe/urls.py backend/apps/fe/tests/test_views_certificacion.py
git commit -m "feat(fe): endpoint Paso 4 manual (33/34/41/43/44/45/46/47), secuencia real"
```

---

### Task 3: Frontend — hooks de API

**Files:**
- Modify: `frontend/src/features/fe/api.ts`

- [ ] **Step 1: Agregar los tipos y hooks**

Al final de `frontend/src/features/fe/api.ts`, agregar:

```typescript
// ---------------------------------------------------------------------------
// Paso 4 — Simulación e-CF (datos reales de Abregonza, NO el Excel de la
// DGII). Dos vías: factura real ya emitida (31/32) o entrada manual con
// secuencia real (resto de tipos).
// ---------------------------------------------------------------------------

export interface ResultadoPaso4 {
  ok: boolean
  encf?: string
  trackId?: string
  detail?: string
}

export interface EnviarFacturaRealInput {
  tipo_ecf: 31 | 32
  punto: string
  tipo_factura: string
  no_factura: string
}

export function useEnviarPaso4FacturaReal(noCia: string) {
  return useMutation({
    mutationFn: (input: EnviarFacturaRealInput) => {
      const fd = new FormData()
      fd.append('no_cia', noCia)
      fd.append('tipo_ecf', String(input.tipo_ecf))
      fd.append('punto', input.punto)
      fd.append('tipo_factura', input.tipo_factura)
      fd.append('no_factura', input.no_factura)
      return feRequest<ResultadoPaso4>(`/fe/certificacion/paso4-factura-real/`, {
        method: 'POST',
        body: fd,
      })
    },
  })
}

export interface EnviarPaso4ManualInput {
  tipo_ecf: number
  datos: Record<string, unknown>
}

export const TIPOS_ECF_PASO4_MANUAL: Record<string, string> = {
  '33': 'Nota de Débito Electrónica',
  '34': 'Nota de Crédito Electrónica',
  '41': 'Compras Electrónico',
  '43': 'Gastos Menores Electrónico',
  '44': 'Regímenes Especiales Electrónica',
  '45': 'Gubernamental Electrónico',
  '46': 'Exportaciones Electrónico',
  '47': 'Pagos al Exterior Electrónico',
}

export function useEnviarPaso4Manual(noCia: string) {
  return useMutation({
    mutationFn: (input: EnviarPaso4ManualInput) =>
      feRequest<ResultadoPaso4>(`/fe/certificacion/paso4-manual/`, {
        method: 'POST',
        body: JSON.stringify({ no_cia: noCia, ...input }),
      }),
  })
}
```

- [ ] **Step 2: Verificar que compila**

Run: `cd frontend && npx tsc -b`
Expected: sin errores nuevos en `features/fe/api.ts`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/fe/api.ts
git commit -m "feat(fe): hooks de API para el Paso 4 (datos reales)"
```

---

### Task 4: Frontend — sección "Paso 4" en la pantalla de Certificación

**Files:**
- Modify: `frontend/src/features/fe/fe-certificacion.tsx`

- [ ] **Step 1: Agregar el componente de la sección Paso 4**

En `frontend/src/features/fe/fe-certificacion.tsx`, agregar el import
(junto a los demás hooks de `@/features/fe/api`):

```typescript
import {
  TIPOS_ECF_PASO4_MANUAL,
  useEnviarPaso4FacturaReal,
  useEnviarPaso4Manual,
} from '@/features/fe/api'
```

Agregar, antes de `export function FeCertificacion`, el nuevo bloque:

```tsx
function Paso4Card({ noCia }: { noCia: string }) {
  const facturaReal = useEnviarPaso4FacturaReal(noCia)
  const manual = useEnviarPaso4Manual(noCia)
  const [tipoEcf, setTipoEcf] = useState<'31' | '32'>('31')
  const [punto, setPunto] = useState('')
  const [tipoFactura, setTipoFactura] = useState('FT')
  const [noFactura, setNoFactura] = useState('')
  const [tipoManual, setTipoManual] = useState('41')
  const [datosManual, setDatosManual] = useState('{\n  "RNCEmisor": "130217432"\n}')

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>
          Paso 4 — Simulación e-CF (datos reales)
        </CardTitle>
        <CardDescription>
          A diferencia de los Pasos 2/3, este paso NO tiene Excel de la
          DGII: hay que usar operaciones reales de Abregonza. Cantidades
          requeridas: 4×31, 2×32 (≥RD$250,000), 1×33, 2×34, 2×41, 2×43,
          2×44, 2×45, 2×46, 2×47, más 4 resúmenes RFCE (<250Mil, usar el
          mismo flujo del Paso 2 con estos e-NCF reales).
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-6'>
        <div className='space-y-2'>
          <p className='text-sm font-medium'>
            Desde una factura real (tipos 31 y 32)
          </p>
          <div className='flex flex-wrap items-end gap-2'>
            <div className='space-y-1'>
              <label className='text-xs'>Tipo e-CF</label>
              <select
                className='border-input h-9 rounded-md border bg-transparent px-2 text-sm'
                value={tipoEcf}
                onChange={(e) => setTipoEcf(e.target.value as '31' | '32')}
              >
                <option value='31'>31 — Crédito Fiscal</option>
                <option value='32'>32 — Consumo</option>
              </select>
            </div>
            <div className='space-y-1'>
              <label className='text-xs'>Punto</label>
              <input
                className='border-input h-9 w-20 rounded-md border bg-transparent px-2 text-sm'
                value={punto}
                onChange={(e) => setPunto(e.target.value)}
              />
            </div>
            <div className='space-y-1'>
              <label className='text-xs'>Tipo Factura</label>
              <input
                className='border-input h-9 w-24 rounded-md border bg-transparent px-2 text-sm'
                value={tipoFactura}
                onChange={(e) => setTipoFactura(e.target.value)}
              />
            </div>
            <div className='space-y-1'>
              <label className='text-xs'>No. Factura</label>
              <input
                className='border-input h-9 w-28 rounded-md border bg-transparent px-2 text-sm'
                value={noFactura}
                onChange={(e) => setNoFactura(e.target.value)}
              />
            </div>
            <Button
              disabled={!punto || !noFactura || facturaReal.isPending}
              onClick={() =>
                facturaReal.mutate(
                  {
                    tipo_ecf: Number(tipoEcf) as 31 | 32,
                    punto,
                    tipo_factura: tipoFactura,
                    no_factura: noFactura,
                  },
                  {
                    onSuccess: (r) =>
                      toast.success(`Enviado ${r.encf} — trackId ${r.trackId}`),
                    onError: (e: any) => toast.error(e.message),
                  }
                )
              }
            >
              {facturaReal.isPending ? 'Enviando…' : 'Enviar a la DGII'}
            </Button>
          </div>
        </div>

        <div className='space-y-2 border-t pt-4'>
          <p className='text-sm font-medium'>
            Entrada manual (tipos 33/34/41/43/44/45/46/47)
          </p>
          <p className='text-muted-foreground text-xs'>
            Igual que Modo Test, pero consume un e-NCF REAL (no
            reutilizable). Para tipo 34, incluya{' '}
            <code>NCFModificado</code> con el e-NCF de un documento ya
            enviado.
          </p>
          <div className='flex flex-wrap items-end gap-2'>
            <div className='space-y-1'>
              <label className='text-xs'>Tipo e-CF</label>
              <select
                className='border-input h-9 rounded-md border bg-transparent px-2 text-sm'
                value={tipoManual}
                onChange={(e) => setTipoManual(e.target.value)}
              >
                {Object.entries(TIPOS_ECF_PASO4_MANUAL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {k} — {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <textarea
            className='border-input h-32 w-full rounded-md border bg-transparent p-2 font-mono text-xs'
            value={datosManual}
            onChange={(e) => setDatosManual(e.target.value)}
          />
          <Button
            disabled={manual.isPending}
            onClick={() => {
              let datos: Record<string, unknown>
              try {
                datos = JSON.parse(datosManual)
              } catch {
                toast.error('El JSON de datos no es válido')
                return
              }
              manual.mutate(
                { tipo_ecf: Number(tipoManual), datos },
                {
                  onSuccess: (r) =>
                    toast.success(`Enviado ${r.encf} — trackId ${r.trackId}`),
                  onError: (e: any) => toast.error(e.message),
                }
              )
            }}
          >
            {manual.isPending ? 'Enviando…' : 'Enviar a la DGII'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Renderizar la tarjeta nueva dentro de `FeCertificacion`**

En el mismo archivo, agregar `<Paso4Card noCia={noCia} />` como último
hijo del `<div className='space-y-4'>` que devuelve `FeCertificacion`
(después del `PasoUploadCard` de "Paso 3 — Aprobaciones Comerciales").

- [ ] **Step 3: Verificar que compila**

Run: `cd frontend && npx tsc -b`
Expected: sin errores nuevos en `features/fe/fe-certificacion.tsx`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/fe/fe-certificacion.tsx
git commit -m "feat(fe): seccion Paso 4 (datos reales) en pantalla Certificacion e-CF"
```

---

### Task 5: Deploy VM + Netlify + smoke test

- [ ] **Step 1:** Sincronizar `backend/apps/fe/views.py`, `urls.py` a la
  VM (`pscp`, ver `sigaft-deploy-vm`), correr la suite completa de
  `apps/fe/tests/` en la VM.
- [ ] **Step 2:** Push/merge a `main` (confirmar con el usuario antes de
  pushear, mismo patrón que el Panel de Certificación).
- [ ] **Step 3:** Confirmar deploy Netlify `ready` (API pública
  `api.netlify.com/api/v1/sites/abregonza.netlify.app/deploys`).
- [ ] **Step 4:** Smoke test real (Playwright, login
  `JCABREU`/`Temp1234!`): abrir Configuración → Facturación Electrónica →
  Certificación e-CF, confirmar que la tarjeta "Paso 4" se ve con sus dos
  formularios.
- [ ] **Step 5:** Actualizar memoria del proyecto
  (`project_dgii_ecf_postulacion_estado_20260831`) con el resultado.

---

## Self-Review

**Cobertura:** endpoint factura real (31/32) ✅ Task 1, endpoint manual
(33/34/41/43/44/45/46/47) ✅ Task 2, secuencias sembradas ✅ Task 0, UI ✅
Tasks 3-4, deploy ✅ Task 5. El envío RFCE (Tercero/Cuarto del Paso 4)
reutiliza el endpoint `paso2-rfce` ya existente sin cambios de código —
el operador simplemente arma a mano un Excel de 2 hojas con los e-NCF
reales que generó en "Primero" (mismo formato que ya acepta ese
endpoint), no hace falta una ruta nueva para eso.

**Fuera de alcance deliberado (no placeholders, decisión explícita):**
representación impresa/QR (Paso 5, no Paso 4), Pasos 6 en adelante (no
investigados todavía).

**Placeholder scan:** sin TBD/"implementar después" en ningún Task.
