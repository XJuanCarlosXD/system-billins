# Facturación Electrónica — Fase 1: Configuración por empresa + conexión DGII

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Módulo "Facturación Electrónica" en Configuración: por empresa se sube el certificado digital, se elige ambiente DGII, se registran secuencias e-NCF y se prueba la conexión real (semilla→firma→token) contra la DGII.

**Architecture:** Tablas nuevas `FAT.TFE_CONFIG/TFE_SECUENCIA/TFE_DOCUMENTO/TFE_TOKEN`; app Django `apps/fe` con cliente DGII (`dgii_client.py` + `firma.py`) y repo `fe_repo.py` sobre el pool legacy; UI en `settings-catalog.tsx` siguiendo el patrón de `unified-companias.tsx`. Spec completo: `backend/docs/superpowers/specs/2026-07-07-fe-ecf-dgii-design.md`.

**Tech Stack:** Django + oracledb (thick, Oracle 11g), `signxml`+`cryptography`+`lxml` para firma XMLDSig, React Query + shadcn/ui.

**Verificación:** este repo no tiene suite pytest; la convención del proyecto (skill `sigaft-deploy-vm`) es `python -m py_compile` + deploy a la VM 10.0.0.99 + smoke con curl/browser. Cada task incluye su verificación así.

---

### Task 1: Tablas Oracle TFE_*

**Files:**
- Create: `backend/docs/sql/2026-07-07-fe-tablas.sql`

- [ ] **Step 1: Escribir el DDL**

Copiar tal cual el bloque `CREATE TABLE` de la sección 3.1 del spec
(`specs/2026-07-07-fe-ecf-dgii-design.md`) a `backend/docs/sql/2026-07-07-fe-tablas.sql`,
añadiendo al final:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON FAT.TFE_CONFIG TO USR_APP;
GRANT SELECT, INSERT, UPDATE, DELETE ON FAT.TFE_SECUENCIA TO USR_APP;
GRANT SELECT, INSERT, UPDATE, DELETE ON FAT.TFE_DOCUMENTO TO USR_APP;
GRANT SELECT, INSERT, UPDATE, DELETE ON FAT.TFE_TOKEN TO USR_APP;
```

(ajustar `USR_APP` al usuario que usa el pool del backend — verificar con
`grep ORACLE_USER backend/.env` en la VM antes de ejecutar).

- [ ] **Step 2: Ejecutar en la VM**

```bash
pscp -pw 'Temp1234!' backend/docs/sql/2026-07-07-fe-tablas.sql jcabreu@10.0.0.99:/tmp/
plink -pw 'Temp1234!' jcabreu@10.0.0.99 "docker compose -f ~/facturation-system/docker-compose.yml exec -T oracle bash -c 'sqlplus FAT/<pass>@XE @/tmp/2026-07-07-fe-tablas.sql'"
```

Expected: `Table created.` x4, `Grant succeeded.` x4. Si ORA-00955 (ya existe), verificar columnas con `DESC FAT.TFE_CONFIG` y continuar.

- [ ] **Step 3: Commit**

```bash
git add backend/docs/sql/2026-07-07-fe-tablas.sql
git commit -m "feat(fe): tablas Oracle TFE_* para facturacion electronica"
```

### Task 2: Cifrado del password del certificado

**Files:**
- Create: `backend/apps/fe/__init__.py` (vacío)
- Create: `backend/apps/fe/apps.py`
- Create: `backend/apps/fe/crypto.py`

- [ ] **Step 1: Crear la app y el módulo de cifrado**

`backend/apps/fe/apps.py`:

```python
from django.apps import AppConfig


class FeConfig(AppConfig):
    name = 'apps.fe'
```

`backend/apps/fe/crypto.py`:

```python
"""Cifrado simétrico del password del certificado digital.

Deriva una clave Fernet estable desde settings.SECRET_KEY para no
introducir secretos nuevos en el despliegue.
"""
from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet
from django.conf import settings


def _fernet() -> Fernet:
    digest = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode()


def decrypt(token: str) -> str:
    return _fernet().decrypt(token.encode()).decode()
```

- [ ] **Step 2: Verificar compilación y round-trip**

```bash
cd backend && python -m py_compile apps/fe/crypto.py apps/fe/apps.py
python -c "import django,os; os.environ.setdefault('DJANGO_SETTINGS_MODULE','facturation_api.settings'); django.setup(); from apps.fe import crypto; assert crypto.decrypt(crypto.encrypt('abc123')) == 'abc123'; print('OK')"
```

Expected: `OK` (si settings no carga local por falta de Oracle, ejecutar este check en la VM tras el deploy de Task 8).

- [ ] **Step 3: Commit**

```bash
git add backend/apps/fe/__init__.py backend/apps/fe/apps.py backend/apps/fe/crypto.py
git commit -m "feat(fe): app fe + cifrado Fernet para password de certificado"
```

### Task 3: Repositorio fe_repo

**Files:**
- Create: `backend/apps/legacy/repositories/fe_repo.py`

- [ ] **Step 1: Implementar el repo**

```python
"""Facturación Electrónica (e-CF): TFE_CONFIG, TFE_SECUENCIA, TFE_TOKEN."""
from __future__ import annotations

from datetime import datetime

from .. import client

CONFIG_COLS = (
    "no_cia, ambiente, rnc_emisor, razon_social, nombre_comercial, "
    "direccion_emisor, municipio, provincia, cert_subject, cert_vence, "
    "estado_cert, activo, fecha_actualiza"
)


def get_config(no_cia: str) -> dict | None:
    rows = client.fetch_dicts(
        f"SELECT {CONFIG_COLS}, "
        "CASE WHEN certificado_p12 IS NULL THEN 'N' ELSE 'S' END tiene_cert "
        "FROM FAT.TFE_CONFIG WHERE no_cia = :1",
        [no_cia],
    )
    return rows[0] if rows else None


def upsert_config(no_cia: str, data: dict) -> None:
    campos = ('ambiente', 'rnc_emisor', 'razon_social', 'nombre_comercial',
              'direccion_emisor', 'municipio', 'provincia', 'estado_cert', 'activo')
    valores = [data.get(c) for c in campos]
    with client.cursor() as cur:
        cur.execute(
            "MERGE INTO FAT.TFE_CONFIG t USING (SELECT :1 no_cia FROM dual) s "
            "ON (t.no_cia = s.no_cia) "
            "WHEN MATCHED THEN UPDATE SET ambiente=:2, rnc_emisor=:3, "
            " razon_social=:4, nombre_comercial=:5, direccion_emisor=:6, "
            " municipio=:7, provincia=:8, estado_cert=:9, activo=:10, "
            " fecha_actualiza=SYSDATE "
            "WHEN NOT MATCHED THEN INSERT "
            " (no_cia, ambiente, rnc_emisor, razon_social, nombre_comercial, "
            "  direccion_emisor, municipio, provincia, estado_cert, activo) "
            " VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10)",
            [no_cia, *valores],
        )


def save_certificado(no_cia: str, p12_bytes: bytes, password_enc: str,
                     subject: str, vence: datetime) -> None:
    with client.cursor() as cur:
        cur.execute(
            "UPDATE FAT.TFE_CONFIG SET certificado_p12=:1, cert_password_enc=:2, "
            "cert_subject=:3, cert_vence=:4, fecha_actualiza=SYSDATE "
            "WHERE no_cia=:5",
            [p12_bytes, password_enc, subject, vence, no_cia],
        )
        if cur.rowcount == 0:
            raise ValueError('Configure primero los datos del emisor')


def get_certificado(no_cia: str) -> tuple[bytes, str] | None:
    """Devuelve (p12_bytes, password_enc) o None."""
    with client.cursor() as cur:
        cur.execute(
            "SELECT certificado_p12, cert_password_enc "
            "FROM FAT.TFE_CONFIG WHERE no_cia=:1", [no_cia])
        row = cur.fetchone()
    if not row or row[0] is None:
        return None
    blob = row[0].read() if hasattr(row[0], 'read') else row[0]
    return blob, row[1]


def list_secuencias(no_cia: str) -> list[dict]:
    return client.fetch_dicts(
        "SELECT no_cia, tipo_ecf, secuencia_desde, secuencia_hasta, "
        "prox_secuencia, fecha_vence, activa "
        "FROM FAT.TFE_SECUENCIA WHERE no_cia=:1 ORDER BY tipo_ecf, secuencia_desde",
        [no_cia],
    )


def upsert_secuencia(no_cia: str, s: dict) -> None:
    with client.cursor() as cur:
        cur.execute(
            "MERGE INTO FAT.TFE_SECUENCIA t USING (SELECT :1 no_cia, :2 tipo_ecf, "
            " :3 secuencia_desde FROM dual) s "
            "ON (t.no_cia=s.no_cia AND t.tipo_ecf=s.tipo_ecf "
            "    AND t.secuencia_desde=s.secuencia_desde) "
            "WHEN MATCHED THEN UPDATE SET secuencia_hasta=:4, prox_secuencia=:5, "
            " fecha_vence=:6, activa=:7 "
            "WHEN NOT MATCHED THEN INSERT (no_cia, tipo_ecf, secuencia_desde, "
            " secuencia_hasta, prox_secuencia, fecha_vence, activa) "
            " VALUES (:1, :2, :3, :4, :5, :6, :7)",
            [no_cia, s['tipo_ecf'], int(s['secuencia_desde']),
             int(s['secuencia_hasta']), int(s['prox_secuencia']),
             datetime.strptime(s['fecha_vence'][:10], '%Y-%m-%d'),
             s.get('activa', 'S')],
        )


def get_token(no_cia: str, ambiente: str) -> str | None:
    rows = client.fetch_dicts(
        "SELECT token FROM FAT.TFE_TOKEN "
        "WHERE no_cia=:1 AND ambiente=:2 AND expira > SYSDATE + (5/1440)",
        [no_cia, ambiente],
    )
    return rows[0]['token'] if rows else None


def save_token(no_cia: str, ambiente: str, token: str, expira: datetime) -> None:
    with client.cursor() as cur:
        cur.execute("DELETE FROM FAT.TFE_TOKEN WHERE no_cia=:1 AND ambiente=:2",
                    [no_cia, ambiente])
        cur.execute(
            "INSERT INTO FAT.TFE_TOKEN (no_cia, ambiente, token, expira) "
            "VALUES (:1, :2, :3, :4)",
            [no_cia, ambiente, token, expira],
        )
```

- [ ] **Step 2: Compilar**

```bash
cd backend && python -m py_compile apps/legacy/repositories/fe_repo.py
```

Expected: sin salida (exit 0).

- [ ] **Step 3: Commit**

```bash
git add backend/apps/legacy/repositories/fe_repo.py
git commit -m "feat(fe): repositorio TFE_CONFIG/TFE_SECUENCIA/TFE_TOKEN"
```

### Task 4: Firma XML con certificado .p12

**Files:**
- Create: `backend/apps/fe/firma.py`
- Modify: `backend/requirements.txt` (añadir `signxml` y `lxml` si no están)

- [ ] **Step 1: Implementar firma**

```python
"""Firma XMLDSig enveloped (RSA-SHA256) para los XML de la DGII."""
from __future__ import annotations

from datetime import datetime

from cryptography.hazmat.primitives.serialization import pkcs12
from lxml import etree
from signxml import SignatureConstructor, SignatureMethod  # signxml >= 3.2


def leer_p12(p12_bytes: bytes, password: str):
    """Devuelve (private_key, cert, subject_str, not_valid_after)."""
    key, cert, _extra = pkcs12.load_key_and_certificates(
        p12_bytes, password.encode())
    subject = cert.subject.rfc4514_string()
    return key, cert, subject, cert.not_valid_after


def firmar_xml(xml_str: str, p12_bytes: bytes, password: str) -> str:
    key, cert, _s, vence = leer_p12(p12_bytes, password)
    if vence < datetime.utcnow():
        raise ValueError(f'El certificado venció el {vence:%d/%m/%Y}')
    root = etree.fromstring(xml_str.encode('utf-8'))
    signed = SignatureConstructor(
        method=SignatureMethod.RSA_SHA256).sign(root, key=key, cert=[cert])
    return etree.tostring(signed, encoding='unicode')
```

Nota: si la versión de signxml instalada es < 3.2, la clase se llama
`XMLSigner(method=methods.enveloped, signature_algorithm='rsa-sha256',
digest_algorithm='sha256')` — usar la variante que exista
(`python -c "import signxml; print(signxml.__version__)"`).

En `backend/requirements.txt` añadir (si faltan):

```
signxml>=3.2
lxml>=4.9
```

- [ ] **Step 2: Compilar e instalar en la VM**

```bash
cd backend && python -m py_compile apps/fe/firma.py
```

En la VM (el contenedor instala requirements en el build):

```bash
plink -pw 'Temp1234!' jcabreu@10.0.0.99 "cd ~/facturation-system && docker compose exec -T backend pip install 'signxml>=3.2' lxml"
```

Expected: `Successfully installed …` (y añadido a requirements para el próximo build).

- [ ] **Step 3: Commit**

```bash
git add backend/apps/fe/firma.py backend/requirements.txt
git commit -m "feat(fe): firma XMLDSig enveloped con certificado p12"
```

### Task 5: Cliente DGII (semilla → firma → token)

**Files:**
- Create: `backend/apps/fe/dgii_client.py`

- [ ] **Step 1: Implementar el cliente**

```python
"""Cliente de los servicios web de la DGII (facturación electrónica).

Fase 1: autenticación semilla→firma→token con cache en TFE_TOKEN.
Fase 2 añadirá recepción, consulta de resultados y RFCE.
"""
from __future__ import annotations

from datetime import datetime, timedelta

import requests

from apps.fe import crypto, firma
from apps.legacy.repositories import fe_repo

AMBIENTES = ('testecf', 'certecf', 'ecf')
BASE = 'https://ecf.dgii.gov.do/{amb}'
TIMEOUT = 30


class DgiiError(Exception):
    pass


def _base(ambiente: str) -> str:
    if ambiente not in AMBIENTES:
        raise DgiiError(f'Ambiente inválido: {ambiente}')
    return BASE.format(amb=ambiente)


def obtener_semilla(ambiente: str) -> str:
    r = requests.get(
        f'{_base(ambiente)}/autenticacion/api/autenticacion/semilla',
        timeout=TIMEOUT)
    if r.status_code != 200:
        raise DgiiError(f'Semilla HTTP {r.status_code}: {r.text[:300]}')
    return r.text


def obtener_token(no_cia: str, ambiente: str, forzar: bool = False) -> str:
    """Token vigente para la cía (cacheado en TFE_TOKEN)."""
    if not forzar:
        cached = fe_repo.get_token(no_cia, ambiente)
        if cached:
            return cached

    cert = fe_repo.get_certificado(no_cia)
    if not cert:
        raise DgiiError('La empresa no tiene certificado digital cargado')
    p12_bytes, password_enc = cert
    password = crypto.decrypt(password_enc)

    semilla = obtener_semilla(ambiente)
    semilla_firmada = firma.firmar_xml(semilla, p12_bytes, password)

    r = requests.post(
        f'{_base(ambiente)}/autenticacion/api/autenticacion/validarsemilla',
        files={'xml': ('semilla.xml', semilla_firmada.encode('utf-8'),
                       'text/xml')},
        timeout=TIMEOUT)
    if r.status_code != 200:
        raise DgiiError(f'ValidarSemilla HTTP {r.status_code}: {r.text[:300]}')
    data = r.json()
    token = data.get('token')
    if not token:
        raise DgiiError(f'Respuesta sin token: {data}')
    expira = _parse_fecha(data.get('expira')) or (
        datetime.now() + timedelta(minutes=55))
    fe_repo.save_token(no_cia, ambiente, token, expira)
    return token


def _parse_fecha(valor) -> datetime | None:
    if not valor:
        return None
    for fmt in ('%Y-%m-%dT%H:%M:%S.%f', '%Y-%m-%dT%H:%M:%S',
                '%m/%d/%Y %I:%M:%S %p'):
        try:
            return datetime.strptime(str(valor)[:26], fmt)
        except ValueError:
            continue
    return None


def probar_conexion(no_cia: str, ambiente: str) -> dict:
    """Semilla→firma→token de punta a punta. Devuelve dict apto para la UI."""
    token = obtener_token(no_cia, ambiente, forzar=True)
    return {'ok': True, 'ambiente': ambiente,
            'token_preview': token[:24] + '…',
            'mensaje': 'Autenticación exitosa contra la DGII'}
```

- [ ] **Step 2: Compilar**

```bash
cd backend && python -m py_compile apps/fe/dgii_client.py
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add backend/apps/fe/dgii_client.py
git commit -m "feat(fe): cliente DGII autenticacion semilla-firma-token con cache"
```

### Task 6: Views + URLs del API

**Files:**
- Create: `backend/apps/fe/views.py`
- Create: `backend/apps/fe/urls.py`
- Modify: `backend/facturation_api/urls.py` (línea ~20, junto a los demás includes)

- [ ] **Step 1: Implementar views**

Seguir el estilo de vistas función + JsonResponse del resto de módulos
(ver `backend/apps/fat/views.py` como referencia de auth/permisos — usar el
mismo decorador/check de sesión que usen las vistas de settings existentes,
p. ej. el de `plantillas_pdf`):

```python
"""API Facturación Electrónica: configuración por empresa (Fase 1)."""
from __future__ import annotations

import json

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from apps.fe import crypto, dgii_client, firma
from apps.legacy.repositories import fe_repo


def _err(msg: str, status: int = 400) -> JsonResponse:
    return JsonResponse({'detail': str(msg)}, status=status)


@require_http_methods(['GET', 'PUT'])
def config_view(request):
    if request.method == 'GET':
        no_cia = request.GET.get('no_cia')
        if not no_cia:
            return _err('no_cia requerido')
        cfg = fe_repo.get_config(no_cia)
        return JsonResponse({'config': cfg})
    data = json.loads(request.body or '{}')
    no_cia = data.get('no_cia')
    if not no_cia or not data.get('rnc_emisor') or not data.get('razon_social'):
        return _err('no_cia, rnc_emisor y razon_social son requeridos')
    if data.get('ambiente') not in dgii_client.AMBIENTES:
        return _err('ambiente debe ser testecf, certecf o ecf')
    fe_repo.upsert_config(no_cia, data)
    return JsonResponse({'config': fe_repo.get_config(no_cia)})


@require_http_methods(['POST'])
def certificado_view(request):
    no_cia = request.POST.get('no_cia')
    password = request.POST.get('password')
    archivo = request.FILES.get('certificado')
    if not (no_cia and password and archivo):
        return _err('no_cia, password y certificado son requeridos')
    p12_bytes = archivo.read()
    try:
        _k, _c, subject, vence = firma.leer_p12(p12_bytes, password)
    except Exception as exc:
        return _err(f'Certificado o contraseña inválidos: {exc}')
    fe_repo.save_certificado(no_cia, p12_bytes, crypto.encrypt(password),
                             subject, vence)
    return JsonResponse({'cert_subject': subject,
                         'cert_vence': vence.strftime('%Y-%m-%d')})


@require_http_methods(['POST'])
def probar_conexion_view(request):
    data = json.loads(request.body or '{}')
    no_cia = data.get('no_cia')
    if not no_cia:
        return _err('no_cia requerido')
    cfg = fe_repo.get_config(no_cia)
    if not cfg:
        return _err('La empresa no tiene configuración FE')
    try:
        return JsonResponse(
            dgii_client.probar_conexion(no_cia, cfg['ambiente']))
    except dgii_client.DgiiError as exc:
        return JsonResponse({'ok': False, 'mensaje': str(exc)}, status=502)
    except Exception as exc:
        return JsonResponse({'ok': False, 'mensaje': str(exc)}, status=500)


@require_http_methods(['GET', 'POST'])
def secuencias_view(request):
    if request.method == 'GET':
        no_cia = request.GET.get('no_cia')
        if not no_cia:
            return _err('no_cia requerido')
        return JsonResponse({'items': fe_repo.list_secuencias(no_cia)})
    data = json.loads(request.body or '{}')
    no_cia = data.get('no_cia')
    requeridos = ('tipo_ecf', 'secuencia_desde', 'secuencia_hasta',
                  'prox_secuencia', 'fecha_vence')
    if not no_cia or any(data.get(k) in (None, '') for k in requeridos):
        return _err(f'Requeridos: no_cia, {", ".join(requeridos)}')
    if int(data['secuencia_hasta']) < int(data['secuencia_desde']):
        return _err('secuencia_hasta debe ser >= secuencia_desde')
    if not (int(data['secuencia_desde']) <= int(data['prox_secuencia'])
            <= int(data['secuencia_hasta']) + 1):
        return _err('prox_secuencia fuera del rango')
    fe_repo.upsert_secuencia(no_cia, data)
    return JsonResponse({'items': fe_repo.list_secuencias(no_cia)})
```

`backend/apps/fe/urls.py`:

```python
from django.urls import path

from apps.fe import views

urlpatterns = [
    path('config/', views.config_view),
    path('config/certificado/', views.certificado_view),
    path('config/probar-conexion/', views.probar_conexion_view),
    path('secuencias/', views.secuencias_view),
]
```

En `backend/facturation_api/urls.py`, añadir junto a los demás:

```python
    path('api/fe/', include('apps.fe.urls')),
```

Y registrar `'apps.fe'` en `INSTALLED_APPS` de `facturation_api/settings.py`
(mismo bloque donde están `apps.fat`, `apps.cnt`, …).

- [ ] **Step 2: Compilar**

```bash
cd backend && python -m py_compile apps/fe/views.py apps/fe/urls.py facturation_api/urls.py facturation_api/settings.py
```

Expected: exit 0.

- [ ] **Step 3: Aplicar el mismo guard de autenticación que usan las demás vistas de settings**

Revisar `backend/apps/legacy/plantillas_pdf_urls.py`/views: si usan un
decorador de sesión/permiso (p. ej. `@login_required_legacy` o check de
usuario en request), aplicar el mismo a las 4 vistas de `apps/fe/views.py`.
No inventar un mecanismo nuevo.

- [ ] **Step 4: Commit**

```bash
git add backend/apps/fe/ backend/facturation_api/urls.py backend/facturation_api/settings.py
git commit -m "feat(fe): API /api/fe config, certificado, probar-conexion, secuencias"
```

### Task 7: Deploy backend a la VM + smoke

**Files:** ninguno nuevo (deploy de los anteriores)

- [ ] **Step 1: Subir archivos (skill sigaft-deploy-vm)**

```bash
pscp -pw 'Temp1234!' -r backend/apps/fe jcabreu@10.0.0.99:~/facturation-system/backend/apps/
pscp -pw 'Temp1234!' backend/apps/legacy/repositories/fe_repo.py jcabreu@10.0.0.99:~/facturation-system/backend/apps/legacy/repositories/
pscp -pw 'Temp1234!' backend/facturation_api/urls.py backend/facturation_api/settings.py jcabreu@10.0.0.99:~/facturation-system/backend/facturation_api/
plink -pw 'Temp1234!' jcabreu@10.0.0.99 "cd ~/facturation-system && docker compose restart backend"
```

- [ ] **Step 2: Smoke por Caddy :8443**

```bash
curl -sk "https://grupo-abregonza.hopto.org:8443/api/fe/config/?no_cia=01"
```

Expected: `{"config": null}` (HTTP 200, aún sin datos) — no 404/500.

```bash
curl -sk -X PUT "https://grupo-abregonza.hopto.org:8443/api/fe/config/" \
  -H 'Content-Type: application/json' \
  -d '{"no_cia":"01","ambiente":"testecf","rnc_emisor":"101000000","razon_social":"PRUEBA","activo":"N"}'
```

Expected: JSON con `config.rnc_emisor = "101000000"`. Luego revertir si se
quiere dejar limpio (o dejarlo: es config de prueba en testecf, inofensiva).

- [ ] **Step 3: Commit de cualquier ajuste que haya surgido del smoke**

```bash
git add -A && git commit -m "fix(fe): ajustes post-smoke API fe" || echo "sin cambios"
```

### Task 8: Frontend — hooks React Query

**Files:**
- Create: `frontend/src/features/fe/api.ts`

- [ ] **Step 1: Implementar hooks**

Seguir el patrón de fetch + React Query del resto (`features/settings/unified/unified-companias.tsx`
importa su api — copiar el mismo `API_BASE`/cliente HTTP que use ese archivo):

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api' // usar el helper real del proyecto

export interface FeConfig {
  no_cia: string
  ambiente: 'testecf' | 'certecf' | 'ecf'
  rnc_emisor: string
  razon_social: string
  nombre_comercial?: string | null
  direccion_emisor?: string | null
  municipio?: string | null
  provincia?: string | null
  cert_subject?: string | null
  cert_vence?: string | null
  estado_cert: string
  activo: 'S' | 'N'
  tiene_cert?: 'S' | 'N'
}

export interface FeSecuencia {
  no_cia: string
  tipo_ecf: string
  secuencia_desde: number
  secuencia_hasta: number
  prox_secuencia: number
  fecha_vence: string
  activa: 'S' | 'N'
}

export const TIPOS_ECF: Record<string, string> = {
  '31': 'Factura de Crédito Fiscal Electrónica',
  '32': 'Factura de Consumo Electrónica',
  '33': 'Nota de Débito Electrónica',
  '34': 'Nota de Crédito Electrónica',
  '41': 'Compras Electrónico',
  '43': 'Gastos Menores Electrónico',
  '44': 'Regímenes Especiales Electrónica',
  '45': 'Gubernamental Electrónico',
  '46': 'Exportaciones Electrónico',
  '47': 'Pagos al Exterior Electrónico',
}

export function useFeConfig(noCia: string) {
  return useQuery({
    queryKey: ['fe-config', noCia],
    queryFn: () =>
      apiFetch<{ config: FeConfig | null }>(`/api/fe/config/?no_cia=${noCia}`),
    enabled: !!noCia,
  })
}

export function useSaveFeConfig(noCia: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<FeConfig>) =>
      apiFetch(`/api/fe/config/`, {
        method: 'PUT',
        body: JSON.stringify({ no_cia: noCia, ...data }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fe-config', noCia] }),
  })
}

export function useUploadCertificado(noCia: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { file: File; password: string }) => {
      const fd = new FormData()
      fd.append('no_cia', noCia)
      fd.append('certificado', input.file)
      fd.append('password', input.password)
      return apiFetch(`/api/fe/config/certificado/`, { method: 'POST', body: fd })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fe-config', noCia] }),
  })
}

export function useProbarConexion(noCia: string) {
  return useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean; mensaje: string }>(`/api/fe/config/probar-conexion/`, {
        method: 'POST',
        body: JSON.stringify({ no_cia: noCia }),
      }),
  })
}

export function useFeSecuencias(noCia: string) {
  return useQuery({
    queryKey: ['fe-secuencias', noCia],
    queryFn: () =>
      apiFetch<{ items: FeSecuencia[] }>(`/api/fe/secuencias/?no_cia=${noCia}`),
    enabled: !!noCia,
  })
}

export function useSaveFeSecuencia(noCia: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (s: Partial<FeSecuencia>) =>
      apiFetch(`/api/fe/secuencias/`, {
        method: 'POST',
        body: JSON.stringify({ no_cia: noCia, ...s }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fe-secuencias', noCia] }),
  })
}
```

Importante: `apiFetch` es ilustrativo — abrir `unified-companias.tsx` y usar
exactamente el mismo helper HTTP (con credenciales/headers) que use ese archivo.
Para el upload multipart NO fijar `Content-Type` manualmente.

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/fe/api.ts
git commit -m "feat(fe): hooks React Query configuracion facturacion electronica"
```

### Task 9: Frontend — vista Facturación Electrónica en Configuración

**Files:**
- Create: `frontend/src/features/settings/unified/unified-facturacion-electronica.tsx`
- Modify: `frontend/src/features/settings/data/settings-catalog.tsx` (~línea 181, categoría "Empresas y Sucursales" o nueva categoría)

- [ ] **Step 1: Implementar la vista**

Estructura (usar los mismos componentes shadcn que `unified-companias.tsx`:
`Card`, `Select`, `Input`, `Button`, `Badge`, `Table`, `Dialog`, `Switch`,
`toast`). Esqueleto completo:

```tsx
import { useState } from 'react'
import {
  TIPOS_ECF, useFeConfig, useFeSecuencias, useProbarConexion,
  useSaveFeConfig, useSaveFeSecuencia, useUploadCertificado,
} from '@/features/fe/api'
// + selector de compañía: reutilizar el mismo componente/hook de cías
// que usa unified-companias.tsx (mismo import).

const ESTADOS_CERT: Record<string, string> = {
  NO_INICIADO: 'No iniciado',
  POSTULACION: 'Postulación enviada',
  PRUEBAS: 'Set de pruebas',
  SIMULACION: 'Simulación',
  CERTIFICADO: 'Certificado ✔',
}

export function UnifiedFacturacionElectronica() {
  const [noCia, setNoCia] = useState('01')
  const { data, isLoading } = useFeConfig(noCia)
  const cfg = data?.config ?? null
  // …formulario controlado con useState inicializado por useEffect cuando
  //   llega cfg (mismo patrón de edición que unified-companias).
  // Cards en este orden:
  // 1. Estado: Badge ESTADOS_CERT[cfg.estado_cert], ambiente, Switch activo,
  //    alerta destructiva si cert_vence < 30 días.
  // 2. Certificado digital: input file .p12/.pfx + input password +
  //    useUploadCertificado; muestra cert_subject y cert_vence.
  // 3. Conexión DGII: Select ambiente {testecf: 'Pruebas', certecf:
  //    'Certificación', ecf: 'Producción'} + botón Probar conexión
  //    (useProbarConexion → toast éxito con mensaje / toast destructive).
  // 4. Secuencias e-NCF: Table de useFeSecuencias con columnas Tipo
  //    (código + TIPOS_ECF[tipo]), Desde, Hasta, Próxima, Vence, Activa;
  //    Dialog "Registrar rango" con Select de TIPOS_ECF + inputs numéricos
  //    + date, submit useSaveFeSecuencia.
  // Guardar (Card 1-3 datos emisor): useSaveFeConfig con
  //    {ambiente, rnc_emisor, razon_social, nombre_comercial,
  //     direccion_emisor, estado_cert, activo}.
  return (/* JSX de las 4 cards */)
}
```

Reglas de calidad ya establecidas: React Query obligatorio (nada de fetch en
useEffect), Selects de Radix nunca con `value=''`, lookups código→descripción
(usar `TIPOS_ECF`), textos "ZentoryERP"/español, no rediseñar el layout de
Configuración.

- [ ] **Step 2: Registrar en el catálogo**

En `frontend/src/features/settings/data/settings-catalog.tsx`:

```tsx
import { UnifiedFacturacionElectronica } from '../unified/unified-facturacion-electronica'
// dentro de la categoría 'Empresas y Sucursales', añadir item:
{
  slug: 'facturacion-electronica',
  title: 'Facturación Electrónica (e-CF)',
  description:
    'Configura por empresa el certificado digital, el ambiente DGII, las secuencias e-NCF y prueba la conexión (Ley 32-23).',
  render: () => <UnifiedFacturacionElectronica />,
},
```

(respetar la forma exacta de los items vecinos: mismos campos, mismo orden).

- [ ] **Step 3: Typecheck + build**

```bash
cd frontend && npx tsc --noEmit && npm run build
```

Expected: build OK.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/settings/unified/unified-facturacion-electronica.tsx frontend/src/features/settings/data/settings-catalog.tsx
git commit -m "feat(fe): vista Facturacion Electronica en Configuracion por empresa"
```

### Task 10: Push, Netlify y smoke end-to-end

- [ ] **Step 1: Push**

```bash
git push origin main
```

- [ ] **Step 2: Verificar deploy Netlify**

Netlify no expone check-runs en GitHub (aprendido 2026-07-03): verificar por
marker en el bundle:

```bash
curl -s https://abregonza.netlify.app | grep -o 'assets/index-[^"]*\.js' | head -1
# fetch del bundle y buscar un string nuevo de esta feature:
curl -s https://abregonza.netlify.app/<bundle> | grep -c "facturacion-electronica"
```

Expected: >= 1 tras el build (~2-3 min).

- [ ] **Step 3: Smoke funcional en el navegador (Chrome/Playwright MCP si disponible)**

1. Login en https://abregonza.netlify.app → Configuración → Facturación
   Electrónica.
2. Seleccionar cía 01, llenar RNC/razón social, ambiente Pruebas, Guardar →
   recargar → los datos persisten.
3. Registrar secuencia tipo 31 desde 1 hasta 100, próxima 1, vence
   31/12/2027 → aparece en la tabla.
4. Probar conexión sin certificado → toast de error claro ("no tiene
   certificado digital cargado"), no un 500 crudo.
5. (Solo si hay un .p12 de prueba disponible) subir certificado → probar
   conexión en `testecf` → toast de éxito.

- [ ] **Step 4: Cierre**

Reportar commits + resultado del smoke. NO iniciar postulación/certificación
real ante la DGII: eso es Fase 4 y requiere OK del usuario y certificados
digitales comprados por cada RNC.

---

## Self-review (hecho al escribir el plan)

- Cobertura vs spec F1: tablas ✔ (T1), cifrado ✔ (T2), repo ✔ (T3), firma ✔
  (T4), auth DGII ✔ (T5), API ✔ (T6), deploy+smoke ✔ (T7), hooks ✔ (T8),
  UI + catálogo ✔ (T9), e2e ✔ (T10). El monitor de documentos queda como
  card vacía/oculta hasta Fase 2 (el endpoint `/api/fe/documentos/` se
  difiere a F2 junto con TFE_DOCUMENTO writes — la tabla ya queda creada).
- Tipos consistentes: `fe_repo.get_certificado → (bytes, str)` usado así en
  `dgii_client.obtener_token`; `firma.leer_p12` devuelve 4-tupla usada en
  `certificado_view`.
- Puntos donde el ejecutor DEBE mirar el código vecino en vez de copiar
  ciegamente: helper HTTP del frontend (T8), guard de auth backend (T6 paso 3),
  API de signxml según versión (T4), usuario Oracle del grant (T1).
