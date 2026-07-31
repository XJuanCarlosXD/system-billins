# Registro y reporte automático de errores Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every error the app surfaces to a user (API error via React Query, or an unhandled JS render crash) gets silently logged to Oracle, and the user gets a "Reportar este error" action that captures a screenshot and files it into the already-existing Reportes/Soporte module (`apps/reportes`).

**Architecture:** Extend `apps/reportes` (no new Django app) with a `TSYS_ERROR_LOG` table and a lightweight `POST /api/reportes/error-log/` endpoint. On the frontend, hook into the **two chokepoints that already centralize error handling app-wide** — `queryCache.onError` and `handleServerError()` in `frontend/src/main.tsx` / `frontend/src/lib/handle-server-error.ts` — so every React Query mutation/query error is auto-logged and gets a "Reportar" action on its existing toast, with zero changes to individual feature files. A new top-level `ErrorBoundary` around `<RouterProvider>` catches JS render crashes the same way. "Reportar" uses `html2canvas` to screenshot the viewport and reuses the existing `createReporte()` client (from `apps/reportes`) — no new reporting system.

**Tech Stack:** Django REST Framework, `oracledb` (via `apps.legacy.client`), React 19, `sonner` toasts, `html2canvas` (new dependency), VM `10.0.0.99` as source of truth.

Spec: `backend/docs/superpowers/specs/2026-07-31-historial-auditoria-design.md` (sección "Adición: registro y reporte automático de errores").

> **Errata (post-implementación, 2026-07-31):** mismas dos desviaciones que en el plan
> hermano de Historial/Auditoría (mismo motivo: Oracle 11g, mismo patrón ya validado
> ahí), aplicadas aquí también:
> 1. **PK sin `IDENTITY`**: `TSYS_ERROR_LOG.ERROR_ID` usa secuencia + trigger
>    `BEFORE INSERT`, no `GENERATED ALWAYS AS IDENTITY`. Ver
>    `backend/apps/reportes/sql/002_create_tsys_error_log.sql`.
> 2. **`RETURNING ... INTO` en vez de `SELECT MAX(...)`**: `repo.log_error()` (Task 2)
>    recupera el `ERROR_ID` recién insertado vía `cur.var(oracledb.NUMBER)` +
>    `RETURNING ERROR_ID INTO :N`, no el `SELECT MAX(...)` racy que muestra el código
>    de Task 2 más abajo. Ver `backend/apps/reportes/repo.py::log_error`.
> 3. **Asimetría 401 corregida**: el código de Task 4 más abajo no distingue el
>    status 401 (sesión expirada) del resto de los errores — se agregó esa exclusión
>    en ambos chokepoints (`handle-server-error.ts` y `main.tsx`) para no
>    loguear/ofrecer "Reportar" en cada expiración de sesión, un evento rutinario.

---

### Task 1: Oracle DDL — TSYS_ERROR_LOG

**Files:**
- Create: `backend/apps/reportes/sql/002_create_tsys_error_log.sql`
- Create: `backend/apps/reportes/sql/_run_002.py`

- [ ] **Step 1: Write the DDL file**

`backend/apps/reportes/sql/002_create_tsys_error_log.sql`:
```sql
-- ============================================================================
-- TSYS_ERROR_LOG : registro automatico de errores para Reportes/Soporte
-- Owner: ABREGONZA
-- Spec : backend/docs/superpowers/specs/2026-07-31-historial-auditoria-design.md
-- NO se ejecuta automaticamente. Correr manualmente:
--   docker compose exec backend python apps/reportes/sql/_run_002.py
-- ============================================================================

CREATE TABLE ABREGONZA.TSYS_ERROR_LOG (
    ERROR_ID        NUMBER GENERATED ALWAYS AS IDENTITY,
    FECHA           DATE          DEFAULT SYSDATE NOT NULL,
    USUARIO         VARCHAR2(30),
    MODULO          VARCHAR2(20),
    URL             VARCHAR2(500),
    STATUS_HTTP     NUMBER(5),
    MENSAJE         VARCHAR2(1000) NOT NULL,
    DETALLE         CLOB,
    REPORTE_ID      VARCHAR2(36),
    CONSTRAINT PK_TSYS_ERROR_LOG PRIMARY KEY (ERROR_ID)
);

CREATE INDEX IX_TSYS_ERROR_LOG_FECHA ON ABREGONZA.TSYS_ERROR_LOG (FECHA DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON ABREGONZA.TSYS_ERROR_LOG TO JCABREU;
CREATE OR REPLACE SYNONYM JCABREU.TSYS_ERROR_LOG FOR ABREGONZA.TSYS_ERROR_LOG;

COMMIT;
EXIT;
```

- [ ] **Step 2: Write the runner script**

`backend/apps/reportes/sql/_run_002.py`:
```python
"""Ejecuta apps/reportes/sql/002_create_tsys_error_log.sql contra Oracle.

Uso (dentro del container backend):
    docker compose exec backend python apps/reportes/sql/_run_002.py
"""

import os
import re
import sys

_BACKEND_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

import django  # noqa: E402

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "facturation_api.settings")
django.setup()

from apps.legacy import client  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
SQL_PATH = os.path.join(HERE, "002_create_tsys_error_log.sql")


def _split_statements(text: str) -> list[str]:
    out: list[str] = []
    buf: list[str] = []
    for line in text.splitlines():
        s = line.strip()
        if s.startswith("--") or not s:
            continue
        if s.upper() in ("COMMIT;", "EXIT;"):
            if buf:
                stmt = " ".join(buf).strip().rstrip(";")
                if stmt:
                    out.append(stmt)
                buf = []
            continue
        buf.append(line)
        if s.endswith(";"):
            stmt = " ".join(buf).strip().rstrip(";")
            if stmt:
                out.append(stmt)
            buf = []
    if buf:
        stmt = " ".join(buf).strip().rstrip(";")
        if stmt:
            out.append(stmt)
    return out


def main() -> int:
    with open(SQL_PATH, encoding="utf-8") as fh:
        sql = fh.read()
    stmts = _split_statements(sql)
    print(f"-> {len(stmts)} statements")
    with client.cursor() as cur:
        for i, stmt in enumerate(stmts, 1):
            head = re.sub(r"\s+", " ", stmt)[:80]
            try:
                cur.execute(stmt)
                print(f"  [{i:02d}] OK   {head}")
            except Exception as exc:  # noqa: BLE001
                msg = str(exc)
                skip_codes = ("ORA-00955", "ORA-01408", "ORA-01921", "ORA-01749")
                if any(code in msg for code in skip_codes):
                    print(f"  [{i:02d}] SKIP {head}  ({msg.splitlines()[0]})")
                else:
                    print(f"  [{i:02d}] FAIL {head}")
                    print(f"        {msg}")
                    return 1
        cur.connection.commit()
    print("DDL applied.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 3: Deploy and apply**

```bash
cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system" && \
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  backend/apps/reportes/sql/002_create_tsys_error_log.sql backend/apps/reportes/sql/_run_002.py \
  jcabreu@10.0.0.99:facturation-system/backend/apps/reportes/sql/

plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "docker compose -f ~/facturation-system/docker-compose.yml exec -T backend python apps/reportes/sql/_run_002.py"
```

Expected: ends in `DDL applied.`

- [ ] **Step 4: Commit**

```bash
git add backend/apps/reportes/sql/002_create_tsys_error_log.sql backend/apps/reportes/sql/_run_002.py
git commit -m "feat(reportes): tabla TSYS_ERROR_LOG para registro automatico de errores"
```

---

### Task 2: Endpoint `POST /api/reportes/error-log/` (TDD)

**Files:**
- Modify: `backend/apps/reportes/repo.py` (agregar `log_error`, `vincular_reporte`)
- Modify: `backend/apps/reportes/views.py` (agregar `ErrorLogView`)
- Modify: `backend/apps/reportes/urls.py`
- Modify: `backend/apps/reportes/repo.py` — `create_reporte` acepta `error_log_id` opcional
- Create: `backend/apps/reportes/tests/__init__.py`
- Create: `backend/apps/reportes/tests/conftest.py`
- Test: `backend/apps/reportes/tests/test_error_log.py`

- [ ] **Step 1: Create the tests package and the `mock_user` fixture**

`apps/reportes` has no `tests/` directory yet (confirmed — this is its first
test file), and there is no root-level `conftest.py` in this repo: `mock_user`
is currently only defined inside `apps/asistente/tests/conftest.py`, scoped to
that subtree. Create both files fresh:

`backend/apps/reportes/tests/__init__.py`: (empty file)

`backend/apps/reportes/tests/conftest.py`:
```python
"""pytest fixtures comunes a apps.reportes.tests."""

import pytest


@pytest.fixture
def mock_user(db):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    return User.objects.create_user(username="ZZTEST", password="x")
```

- [ ] **Step 2: Write the failing tests**

`backend/apps/reportes/tests/test_error_log.py`:
```python
from types import SimpleNamespace

from rest_framework.test import APIClient

from apps.reportes import repo


class FakeCursor:
    def __init__(self):
        self.executed: list[tuple[str, list]] = []

    def execute(self, sql, params=None):
        self.executed.append((sql, list(params or [])))

    def fetchone(self):
        return (777,)

    @property
    def connection(self):
        return SimpleNamespace(commit=lambda: None)


def test_log_error_inserta_fila(monkeypatch):
    cur = FakeCursor()
    monkeypatch.setattr("apps.legacy.client.cursor",
                         lambda: SimpleNamespace(__enter__=lambda s: cur, __exit__=lambda *a: None))
    error_id = repo.log_error(
        usuario="JCABREU", modulo="FAT", url="/fat/nueva-factura",
        status_http=500, mensaje="Internal Server Error", detalle="Traceback...",
    )
    assert error_id == 777
    inserts = [sql for sql, _ in cur.executed if "INSERT INTO ABREGONZA.TSYS_ERROR_LOG" in sql]
    assert len(inserts) == 1


def test_log_error_endpoint_siempre_devuelve_201_aunque_falle_el_insert(monkeypatch, mock_user):
    monkeypatch.setattr(repo, "log_error", lambda **kw: (_ for _ in ()).throw(RuntimeError("db down")))
    client = APIClient()
    client.force_authenticate(mock_user)
    resp = client.post("/api/reportes/error-log/", {
        "mensaje": "Network Error", "url": "/cxp/documentos", "status_http": 0, "modulo": "CXP",
    }, format="json")
    # Best-effort: nunca debe romper la experiencia del usuario por un log que falla.
    assert resp.status_code == 201


def test_log_error_endpoint_ok(monkeypatch, mock_user):
    monkeypatch.setattr(repo, "log_error", lambda **kw: 42)
    client = APIClient()
    client.force_authenticate(mock_user)
    resp = client.post("/api/reportes/error-log/", {
        "mensaje": "404 not found", "url": "/inv/productos", "status_http": 404, "modulo": "INV",
    }, format="json")
    assert resp.status_code == 201
    assert resp.json() == {"error_id": 42}


def test_create_reporte_vincula_error_log_id(monkeypatch):
    calls = {}

    def fake_vincular(error_log_id, reporte_id):
        calls["error_log_id"] = error_log_id
        calls["reporte_id"] = reporte_id

    monkeypatch.setattr(repo, "vincular_reporte", fake_vincular)
    monkeypatch.setattr(repo, "_validar_imagenes", lambda imgs: [])

    class FakeCur:
        def __enter__(self): return self
        def __exit__(self, *a): return None
        def execute(self, sql, params=None): pass
        @property
        def connection(self):
            return SimpleNamespace(commit=lambda: None)

    monkeypatch.setattr("apps.legacy.client.cursor", lambda: FakeCur())

    repo.create_reporte(
        usuario="JCABREU", modulo="FAT", titulo="Error automático: 500",
        descripcion="detalle", imagenes=[], error_log_id=42,
    )
    assert calls["error_log_id"] == 42
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system/backend" && \
python -m pytest apps/reportes/tests/test_error_log.py -v
```

Expected: `AttributeError: module 'apps.reportes.repo' has no attribute 'log_error'` (and similar) — all 4 fail.

- [ ] **Step 4: Implement `log_error` / `vincular_reporte` and extend `create_reporte`**

In `backend/apps/reportes/repo.py`, add near the top (after the existing constants):
```python
def log_error(
    *, usuario: str | None, modulo: str | None, url: str | None,
    status_http: int | None, mensaje: str, detalle: str | None = None,
) -> int:
    """Registro silencioso de un error. Best-effort: si Oracle está caído,
    el caller decide si propagar o tragarse la excepción (la vista se la
    traga, ver ErrorLogView)."""
    with client.cursor() as cur:
        cur.execute(
            "INSERT INTO ABREGONZA.TSYS_ERROR_LOG "
            "(USUARIO, MODULO, URL, STATUS_HTTP, MENSAJE, DETALLE, FECHA) "
            "VALUES (:1, :2, :3, :4, :5, :6, SYSDATE)",
            [(usuario or "").upper()[:30] or None, (modulo or "").upper()[:20] or None,
             (url or "")[:500] or None, status_http, (mensaje or "")[:1000], detalle],
        )
        cur.execute(
            "SELECT MAX(ERROR_ID) FROM ABREGONZA.TSYS_ERROR_LOG WHERE "
            "MENSAJE=:1 AND NVL(URL,'x')=NVL(:2,'x')",
            [(mensaje or "")[:1000], (url or "")[:500] or None],
        )
        row = cur.fetchone()
        cur.connection.commit()
    return int(row[0]) if row and row[0] is not None else 0


def vincular_reporte(error_log_id: int, reporte_id: str) -> None:
    with client.cursor() as cur:
        cur.execute(
            "UPDATE ABREGONZA.TSYS_ERROR_LOG SET REPORTE_ID = :1 WHERE ERROR_ID = :2",
            [reporte_id, error_log_id],
        )
        cur.connection.commit()
```

Modify the existing `create_reporte` signature and body to accept and use `error_log_id`:
```python
def create_reporte(
    *, usuario: str, modulo: str | None, titulo: str | None,
    descripcion: str | None, imagenes: list[dict],
    error_log_id: int | None = None,
) -> str:
    modulo = (modulo or "OTRO").upper()
    if modulo not in MODULOS_VALIDOS:
        modulo = "OTRO"
    titulo = (titulo or "").strip()[:200]
    if not titulo:
        raise ValidationError("titulo_requerido")
    imgs = _validar_imagenes(imagenes or [])

    reporte_id = str(uuid.uuid4())
    with client.cursor() as cur:
        cur.execute(
            "INSERT INTO ABREGONZA.TREP_PROBLEMA "
            "(REPORTE_ID, USUARIO, MODULO, TITULO, DESCRIPCION, ESTADO, "
            " FECHA_CREACION, FECHA_ACTUALIZACION) "
            "VALUES (:1, :2, :3, :4, :5, 'ABIERTO', SYSDATE, SYSDATE)",
            [reporte_id, usuario, modulo, titulo, descripcion or ""],
        )
        for nombre, media_type, contenido in imgs:
            imagen_id = str(uuid.uuid4())
            cur.execute(
                "INSERT INTO ABREGONZA.TREP_IMAGEN "
                "(IMAGEN_ID, REPORTE_ID, NOMBRE_ARCHIVO, MEDIA_TYPE, "
                " CONTENIDO, TAMANO_BYTES, FECHA_CREACION) "
                "VALUES (:1, :2, :3, :4, :5, :6, SYSDATE)",
                [imagen_id, reporte_id, nombre, media_type, contenido,
                 len(contenido)],
            )
        cur.connection.commit()
    if error_log_id:
        vincular_reporte(error_log_id, reporte_id)
    return reporte_id
```
(el único cambio real es agregar el parámetro `error_log_id` a la firma y las
dos líneas finales `if error_log_id: vincular_reporte(...)`; el resto del
cuerpo queda igual al `create_reporte` ya existente).

- [ ] **Step 5: Write `ErrorLogView` and wire the URL**

En `backend/apps/reportes/views.py`, agregar:
```python
class ErrorLogView(APIView):
    """POST /api/reportes/error-log/ — registro silencioso de un error del
    frontend (API error o crash de render). Best-effort: nunca devuelve 4xx/5xx
    por una falla propia, para no interrumpir el flujo del usuario que ya tuvo
    un error."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        body = request.data or {}
        try:
            error_id = repo.log_error(
                usuario=_u(request),
                modulo=body.get("modulo"),
                url=body.get("url"),
                status_http=body.get("status_http"),
                mensaje=body.get("mensaje") or "error desconocido",
                detalle=body.get("detalle"),
            )
        except Exception:  # noqa: BLE001
            error_id = 0
        return Response({"error_id": error_id}, status=201)
```

En `backend/apps/reportes/urls.py`, agregar antes del cierre de `urlpatterns`:
```python
urlpatterns = [
    path("reportes/", views.ReportesView.as_view()),
    path("reportes/error-log/", views.ErrorLogView.as_view()),
    path("reportes/<str:reporte_id>/", views.ReporteDetailView.as_view()),
    path(
        "reportes/<str:reporte_id>/imagen/<str:imagen_id>/",
        views.ReporteImagenView.as_view(),
    ),
]
```
(la única línea nueva es `path("reportes/error-log/", ...)`, agregada ANTES de
la ruta `<str:reporte_id>/` — si quedara después, Django intentaría matchear
`"error-log"` como un `reporte_id` primero).

También actualizar `ReportesView.post` para pasar `error_log_id` si viene en el body:
```python
    def post(self, request):
        body = request.data or {}
        try:
            reporte_id = repo.create_reporte(
                usuario=_u(request),
                modulo=body.get("modulo"),
                titulo=body.get("titulo"),
                descripcion=body.get("descripcion"),
                imagenes=body.get("imagenes") or [],
                error_log_id=body.get("error_log_id"),
            )
        except repo.ValidationError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(
            {"reporte_id": reporte_id, "estado": "ABIERTO"}, status=201
        )
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system/backend" && \
python -m pytest apps/reportes/tests/test_error_log.py -v
```

Expected: `4 passed`.

- [ ] **Step 7: Deploy and smoke test**

```bash
cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system" && \
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  backend/apps/reportes/repo.py backend/apps/reportes/views.py backend/apps/reportes/urls.py \
  jcabreu@10.0.0.99:facturation-system/backend/apps/reportes/

plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "rm -f /tmp/cookie.txt && \
   curl -s -c /tmp/cookie.txt -X POST -H 'Content-Type: application/json' \
        -d '{\"username\":\"JCABREU\",\"password\":\"Temp1234!\"}' \
        http://localhost:8000/api/auth/login/ -w '\nLOGIN=%{http_code}\n' && \
   curl -s -b /tmp/cookie.txt -X POST -H 'Content-Type: application/json' \
        -d '{\"mensaje\":\"smoke test\",\"url\":\"/smoke\",\"status_http\":500,\"modulo\":\"OTRO\"}' \
        http://localhost:8000/api/reportes/error-log/ -w '\nHTTP=%{http_code}\n'"
```

Expected: `LOGIN=200`, then `HTTP=201` with `{"error_id": <n>}`.

- [ ] **Step 8: Commit**

```bash
git add backend/apps/reportes/repo.py backend/apps/reportes/views.py backend/apps/reportes/urls.py \
        backend/apps/reportes/tests/__init__.py backend/apps/reportes/tests/conftest.py \
        backend/apps/reportes/tests/test_error_log.py
git commit -m "feat(reportes): endpoint error-log + vincular_reporte + tests"
```

---

### Task 3: Frontend — helper `report-error.ts`

**Files:**
- Create: `frontend/src/lib/report-error.ts`
- Modify: `frontend/package.json` (agregar `html2canvas`)

- [ ] **Step 1: Agregar la dependencia**

En `frontend/package.json`, dentro de `"dependencies"`, agregar (orden alfabético, junto a `handlebars`):
```json
    "handlebars": "^4.7.9",
    "html2canvas": "^1.4.1",
```

- [ ] **Step 2: Escribir el helper**

`frontend/src/lib/report-error.ts`:
```typescript
// Registro automático + reporte manual de errores. Reusa el módulo de
// Reportes/Soporte ya existente (apps/reportes) — no crea un sistema nuevo.
import { ApiError } from './api-client'
import { createReporte, fileToBase64 } from './api-client-reportes'

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

function currentModulo(): string {
  const seg = window.location.pathname.split('/').filter(Boolean)[0] || ''
  const known = ['fat', 'cxc', 'cxp', 'inv', 'cnt', 'acc', 'acf', 'chc', 'sdn', 'odc', 'man', 'fe']
  return known.includes(seg) ? seg.toUpperCase() : 'OTRO'
}

/** Fire-and-forget: nunca lanza, nunca bloquea al caller. */
export async function logErrorAutomatico(mensaje: string, opts?: {
  statusHttp?: number
  detalle?: string
}): Promise<number | null> {
  try {
    const res = await fetch(`${API_BASE}/reportes/error-log/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mensaje: mensaje.slice(0, 1000),
        url: window.location.pathname,
        status_http: opts?.statusHttp ?? null,
        modulo: currentModulo(),
        detalle: opts?.detalle,
      }),
    })
    if (!res.ok) return null
    const body = await res.json()
    return body.error_id ?? null
  } catch {
    return null
  }
}

export function mensajeDeError(error: unknown): { mensaje: string; statusHttp?: number; detalle?: string } {
  if (error instanceof ApiError) {
    const detail = typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail)
    return { mensaje: detail || `Error ${error.status}`, statusHttp: error.status, detalle: detail }
  }
  if (error instanceof Error) {
    return { mensaje: error.message, detalle: error.stack }
  }
  return { mensaje: String(error) }
}

/** Captura un screenshot del viewport y crea un reporte pre-llenado. */
export async function reportarErrorConCaptura(
  mensaje: string,
  detalle?: string,
): Promise<string> {
  const html2canvas = (await import('html2canvas')).default
  let imagenes: { nombre: string; media_type: string; data: string }[] = []
  try {
    const canvas = await html2canvas(document.body, { logging: false })
    const dataUrl = canvas.toDataURL('image/png')
    const blob = await (await fetch(dataUrl)).blob()
    const file = new File([blob], 'captura.png', { type: 'image/png' })
    imagenes = [{ nombre: 'captura.png', media_type: 'image/png', data: await fileToBase64(file) }]
  } catch {
    // Si el screenshot falla (canvas tainted, etc.), reportar igual sin imagen.
    imagenes = []
  }
  const { reporte_id } = await createReporte({
    titulo: `Error automático: ${mensaje.slice(0, 150)}`,
    modulo: currentModulo(),
    descripcion: `${mensaje}\n\nURL: ${window.location.href}\n\n${detalle || ''}`.slice(0, 4000),
    imagenes,
  })
  return reporte_id
}
```

- [ ] **Step 3: Deploy**

```bash
cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system" && \
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  frontend/package.json \
  jcabreu@10.0.0.99:facturation-system/frontend/

pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  frontend/src/lib/report-error.ts \
  jcabreu@10.0.0.99:facturation-system/frontend/src/lib/
```

- [ ] **Step 4: Instalar la dependencia dentro del container**

```bash
plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "docker compose -f ~/facturation-system/docker-compose.yml exec -T frontend npm install html2canvas@^1.4.1"
```

Expected: `added 1 package` (o similar), sin errores. Esperar ~5s para que Vite recargue.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/src/lib/report-error.ts
git commit -m "feat(reportes): helper report-error.ts + dependencia html2canvas"
```

---

### Task 4: Enganchar auto-log + acción "Reportar" en los chokepoints existentes

**Files:**
- Modify: `frontend/src/lib/handle-server-error.ts`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Actualizar `handle-server-error.ts`**

Reemplazar el archivo completo:
```typescript
import { AxiosError } from 'axios'
import { toast } from 'sonner'
import { logErrorAutomatico, mensajeDeError, reportarErrorConCaptura } from './report-error'

export function handleServerError(error: unknown) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(error)
  }

  let errMsg = 'Something went wrong!'

  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    Number(error.status) === 204
  ) {
    errMsg = 'No content.'
  }

  if (error instanceof AxiosError) {
    const title = error.response?.data?.title
    if (typeof title === 'string' && title.length > 0) {
      errMsg = title
    }
  }

  const { mensaje, statusHttp, detalle } = mensajeDeError(error)
  logErrorAutomatico(mensaje || errMsg, { statusHttp, detalle })

  toast.error(errMsg, {
    action: {
      label: 'Reportar',
      onClick: () => {
        reportarErrorConCaptura(mensaje || errMsg, detalle)
          .then(() => toast.success('Error reportado. Gracias.'))
          .catch(() => toast.error('No se pudo reportar el error.'))
      },
    },
  })
}
```

- [ ] **Step 2: Actualizar el `queryCache.onError` en `main.tsx`**

Agregar el import junto a los demás:
```tsx
import { logErrorAutomatico, mensajeDeError, reportarErrorConCaptura } from '@/lib/report-error'
```

Reemplazar el bloque `queryCache: new QueryCache({...})` (líneas 61-79) por:
```tsx
  queryCache: new QueryCache({
    onError: (error) => {
      const status = errorStatus(error)
      if (status === 401) {
        // Solo redirigir si no estamos ya en sign-in (evita loop).
        const path = router.history.location.pathname
        if (!path.startsWith('/sign-in')) {
          useAuthStore.getState().auth.reset()
          const redirect = router.history.location.href
          router.navigate({ to: '/sign-in', search: { redirect } })
        }
        return
      }
      const { mensaje, statusHttp, detalle } = mensajeDeError(error)
      logErrorAutomatico(mensaje, { statusHttp, detalle })
      if (status === 500 && import.meta.env.PROD) {
        // toast solo, no navegar (la navegacion automatica a /500 saca al
        // usuario de su flujo cuando un endpoint puntual falla).
        toast.error('Error interno del servidor.', {
          action: {
            label: 'Reportar',
            onClick: () => {
              reportarErrorConCaptura(mensaje, detalle)
                .then(() => toast.success('Error reportado. Gracias.'))
                .catch(() => toast.error('No se pudo reportar el error.'))
            },
          },
        })
      }
    },
  }),
```

- [ ] **Step 3: Deploy**

```bash
cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system" && \
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  frontend/src/lib/handle-server-error.ts frontend/src/main.tsx \
  jcabreu@10.0.0.99:facturation-system/frontend/src/
```

Nota: `main.tsx` va en `frontend/src/`, no en `frontend/src/lib/` — confirmar
con `pscp ... jcabreu@10.0.0.99:facturation-system/frontend/src/main.tsx`
explícito si el comando de arriba lo sube al lugar equivocado.

- [ ] **Step 4: Smoke test**

```bash
plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "curl -s -o /dev/null -w 'HTTP=%{http_code}\n' http://localhost:5173/"
```

Expected: `HTTP=200`. Revisar `docker logs --tail 30 facturation_frontend` si hay error de compilación de Vite (import roto, etc.).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/handle-server-error.ts frontend/src/main.tsx
git commit -m "feat(reportes): auto-log + accion 'Reportar' en los toasts de error existentes"
```

---

### Task 5: ErrorBoundary de nivel superior para crashes de render

**Files:**
- Create: `frontend/src/components/app-error-boundary.tsx`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Escribir el ErrorBoundary**

`frontend/src/components/app-error-boundary.tsx`:
```tsx
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { logErrorAutomatico, reportarErrorConCaptura } from '@/lib/report-error'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  reportado: boolean
  reportando: boolean
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, reportando: false, reportado: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logErrorAutomatico(error.message, { detalle: `${error.stack}\n\n${info.componentStack}` })
  }

  handleReportar = async () => {
    if (!this.state.error) return
    this.setState({ reportando: true })
    try {
      await reportarErrorConCaptura(this.state.error.message, this.state.error.stack)
      this.setState({ reportado: true })
    } finally {
      this.setState({ reportando: false })
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className='flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center'>
        <AlertTriangle className='h-12 w-12 text-destructive' />
        <h1 className='text-xl font-semibold'>Algo salió mal</h1>
        <p className='max-w-md text-sm text-muted-foreground'>
          Ocurrió un error inesperado en la pantalla. Ya quedó registrado
          automáticamente; si quieres ayudarnos a resolverlo más rápido,
          puedes adjuntar una captura de lo que estabas viendo.
        </p>
        <div className='flex gap-2'>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className='mr-2 h-4 w-4' /> Recargar página
          </Button>
          <Button
            variant='outline'
            disabled={this.state.reportando || this.state.reportado}
            onClick={this.handleReportar}
          >
            {this.state.reportado ? 'Reportado ✓' : this.state.reportando ? 'Reportando…' : 'Reportar este error'}
          </Button>
        </div>
      </div>
    )
  }
}
```

- [ ] **Step 2: Envolver el árbol en `main.tsx`**

Agregar el import:
```tsx
import { AppErrorBoundary } from './components/app-error-boundary'
```

Envolver el render (reemplazar el bloque `root.render(...)`):
```tsx
  root.render(
    <StrictMode>
      <AppErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <FontProvider>
              <DirectionProvider>
                <CompanyProvider>
                  <RouterProvider router={router} />
                </CompanyProvider>
              </DirectionProvider>
            </FontProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </AppErrorBoundary>
    </StrictMode>
  )
```

- [ ] **Step 3: Deploy**

```bash
cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system" && \
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  frontend/src/components/app-error-boundary.tsx \
  jcabreu@10.0.0.99:facturation-system/frontend/src/components/

pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  frontend/src/main.tsx \
  jcabreu@10.0.0.99:facturation-system/frontend/src/
```

- [ ] **Step 4: Smoke test**

```bash
plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "curl -s -o /dev/null -w 'HTTP=%{http_code}\n' http://localhost:5173/"
```

Expected: `HTTP=200`. Verificación manual en navegador recomendada: no hay forma
de simular un crash de render vía `curl`; abrir la app y confirmar que carga
normalmente (el `ErrorBoundary` no debe activarse en el flujo normal).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/app-error-boundary.tsx frontend/src/main.tsx
git commit -m "feat(reportes): ErrorBoundary de nivel superior con boton Reportar"
```

---

### Task 6: Verificación end-to-end

**Files:** (ninguno — solo verificación manual)

- [ ] **Step 1: Provocar un error de API real y confirmar el registro silencioso**

Desde el navegador, forzar un error conocido (ej. abrir `/cxp/corregir-ncf` y
enviar un NCF duplicado, que ya lanza un `ValueError` manejado como 400/500).
Confirmar:
```bash
plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "curl -s -b /tmp/cookie.txt 'http://localhost:8000/api/reportes/error-log/' -X POST \
        -H 'Content-Type: application/json' -d '{\"mensaje\":\"verificacion manual\"}' \
        -w '\nHTTP=%{http_code}\n'"
```
Expected: `HTTP=201`. Y en el toast de error mostrado en pantalla, confirmar
que aparece el botón "Reportar".

- [ ] **Step 2: Usar el botón "Reportar" y confirmar que llega a Configuración → Reportes**

Click en "Reportar" sobre un toast de error → confirmar el toast de éxito
"Error reportado. Gracias." → navegar a `/reportes` (o la pestaña admin de
Reportes) y confirmar que aparece un reporte nuevo con estado `ABIERTO`,
título `"Error automático: ..."` y una imagen adjunta (la captura de pantalla).

- [ ] **Step 3: Actualizar la memoria del proyecto**

Anotar en memoria (`project_sigaft_historial_auditoria.md`, la misma nota del
Task 13 del plan de Historial) que el registro/reporte automático de errores
también quedó desplegado y validado, con la fecha.
