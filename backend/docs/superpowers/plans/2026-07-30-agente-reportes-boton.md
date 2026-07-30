# Botón "Resolver todo con Agente" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single admin button in "Reportes de Problemas" that creates an
agent "run", a token-authenticated polling API for an external watcher to
claim it and fetch open tickets, and endpoints to report back the result —
all the plumbing the (separately-run) watcher script needs to invoke Claude
Code headlessly and fix + deploy the tickets.

**Architecture:** New Oracle table `TREP_AGENTE_RUN` tracks one run at a
time (`PENDIENTE → EN_PROCESO → COMPLETADO|ERROR`). Four DRF endpoints in
`apps/reportes`: two session-authenticated (admin lanza, cualquiera ve
estado), two Bearer-token-authenticated for the external watcher
(`pendiente/` claims + returns open tickets, `resultado/` reports outcome).
Frontend adds one button + status line to the existing admin table with
polling while a run is active. A PowerShell watcher script (run manually or
via Scheduled Task — activation is a manual step, not automated by this
plan) polls `pendiente/`, builds a prompt from the open tickets, and pipes it
into `claude --dangerously-skip-permissions -p`.

**Tech Stack:** Django REST Framework, `apps.legacy.client` (raw
`python-oracledb`, no ORM), React + TanStack Query, PowerShell.

**Spec:** `backend/docs/superpowers/specs/2026-07-30-agente-reportes-boton-design.md`

---

### Task 1: Migración SQL de `TREP_AGENTE_RUN`

**Files:**
- Create: `backend/apps/reportes/sql/002_create_trep_agente_run.sql`

- [ ] **Step 1: Escribir el archivo de migración**

```sql
-- ============================================================================
-- TREP_AGENTE_RUN : corridas del boton "Resolver todo con Agente"
-- Owner: ABREGONZA
-- Spec : backend/docs/superpowers/specs/2026-07-30-agente-reportes-boton-design.md
-- NO se ejecuta automaticamente. Correr manualmente:
--   sqlplus JCABREU/508192003@AB @backend/apps/reportes/sql/002_create_trep_agente_run.sql
-- ============================================================================

CREATE TABLE ABREGONZA.TREP_AGENTE_RUN (
    RUN_ID           VARCHAR2(36)  NOT NULL,
    ESTADO           VARCHAR2(20)  DEFAULT 'PENDIENTE' NOT NULL,
    SOLICITADO_POR   VARCHAR2(50)  NOT NULL,
    FECHA_SOLICITUD  DATE DEFAULT SYSDATE NOT NULL,
    FECHA_FIN        DATE,
    RESUMEN          CLOB,
    COMMIT_SHA       VARCHAR2(40),
    CONSTRAINT PK_TREP_AGENTE_RUN PRIMARY KEY (RUN_ID),
    CONSTRAINT CK_TREP_AGENTE_RUN_ESTADO CHECK (
        ESTADO IN ('PENDIENTE','EN_PROCESO','COMPLETADO','ERROR')
    )
);

CREATE INDEX IX_TREP_AGENTE_RUN_ESTADO
    ON ABREGONZA.TREP_AGENTE_RUN (ESTADO, FECHA_SOLICITUD DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON ABREGONZA.TREP_AGENTE_RUN TO JCABREU;

CREATE OR REPLACE SYNONYM JCABREU.TREP_AGENTE_RUN FOR ABREGONZA.TREP_AGENTE_RUN;

COMMIT;
EXIT;
```

- [ ] **Step 2: Commit**

```bash
git add backend/apps/reportes/sql/002_create_trep_agente_run.sql
git commit -m "feat(reportes): migracion TREP_AGENTE_RUN"
```

No se aplica a la VM en este task — eso es un paso manual post-merge (ver
Task 8).

---

### Task 2: `repo.py` — funciones de persistencia del run

**Files:**
- Modify: `backend/apps/reportes/repo.py`
- Test: `backend/apps/reportes/tests/__init__.py` (crear, vacío)
- Test: `backend/apps/reportes/tests/test_agente_repo.py`

- [ ] **Step 1: Crear carpeta de tests**

```bash
mkdir -p backend/apps/reportes/tests
touch backend/apps/reportes/tests/__init__.py
```

- [ ] **Step 2: Escribir los tests (deben fallar — `repo` aún no tiene estas funciones)**

Crear `backend/apps/reportes/tests/test_agente_repo.py`:

```python
import pytest

from apps.reportes import repo


@pytest.fixture
def mock_client(mocker):
    return mocker.patch("apps.reportes.repo.client")


def test_crear_run_returns_pendiente(mock_client):
    cur = mock_client.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = None  # get_run_activo: no hay run activo

    result = repo.crear_run(usuario="JCABREU")

    assert result["estado"] == "PENDIENTE"
    assert cur.execute.call_count == 2  # SELECT get_run_activo + INSERT
    insert_sql = cur.execute.call_args_list[1][0][0]
    assert "INSERT INTO ABREGONZA.TREP_AGENTE_RUN" in insert_sql


def test_crear_run_rejects_if_run_activo(mock_client):
    cur = mock_client.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = ("r1", "PENDIENTE", "JCABREU", None)
    cur.description = [
        ("RUN_ID",), ("ESTADO",), ("SOLICITADO_POR",), ("FECHA_SOLICITUD",),
    ]

    with pytest.raises(repo.ValidationError):
        repo.crear_run(usuario="JCABREU")


def test_reclamar_pendiente_returns_none_if_no_run(mock_client):
    cur = mock_client.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = None

    assert repo.reclamar_pendiente() is None


def test_reclamar_pendiente_claims_and_returns_abiertos(mock_client):
    cur = mock_client.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = ("run-1",)
    cur.rowcount = 1
    cur.fetchall.return_value = [
        ("rep-1", "FAT", "Factura no cuadra", "descripcion larga"),
    ]

    result = repo.reclamar_pendiente()

    assert result["run_id"] == "run-1"
    assert result["reportes"][0]["reporte_id"] == "rep-1"
    assert result["reportes"][0]["descripcion"] == "descripcion larga"


def test_reclamar_pendiente_returns_none_on_race(mock_client):
    cur = mock_client.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = ("run-1",)
    cur.rowcount = 0  # otro proceso ya lo reclamo entre el SELECT y el UPDATE

    assert repo.reclamar_pendiente() is None


def test_finalizar_run_completado(mock_client):
    cur = mock_client.cursor.return_value.__enter__.return_value
    cur.rowcount = 1

    result = repo.finalizar_run(
        "run-1", estado="completado", resumen="ok", commit_sha="abc123"
    )

    assert result == {"run_id": "run-1", "estado": "COMPLETADO"}


def test_finalizar_run_estado_invalido():
    with pytest.raises(repo.ValidationError):
        repo.finalizar_run("run-1", estado="RARO", resumen="", commit_sha=None)


def test_finalizar_run_not_found(mock_client):
    cur = mock_client.cursor.return_value.__enter__.return_value
    cur.rowcount = 0

    with pytest.raises(LookupError):
        repo.finalizar_run("run-1", estado="ERROR", resumen="x", commit_sha=None)
```

- [ ] **Step 3: Correr los tests y verificar que fallan**

Run: `cd backend && pytest apps/reportes/tests/test_agente_repo.py -v`
Expected: `AttributeError: module 'apps.reportes.repo' has no attribute 'crear_run'` (o similar) en todos los tests.

- [ ] **Step 4: Implementar las funciones en `repo.py`**

Agregar al final de `backend/apps/reportes/repo.py`:

```python
RUN_ESTADOS_FINALES = ("COMPLETADO", "ERROR")


def get_run_activo() -> dict | None:
    with client.cursor() as cur:
        cur.execute(
            "SELECT RUN_ID, ESTADO, SOLICITADO_POR, FECHA_SOLICITUD "
            "FROM ABREGONZA.TREP_AGENTE_RUN "
            "WHERE ESTADO IN ('PENDIENTE','EN_PROCESO') "
            "ORDER BY FECHA_SOLICITUD DESC FETCH FIRST 1 ROWS ONLY"
        )
        row = cur.fetchone()
        if not row:
            return None
        cols = [c[0].lower() for c in cur.description]
        return dict(zip(cols, row))


def crear_run(*, usuario: str) -> dict:
    if get_run_activo():
        raise ValidationError("run_activo_existente")

    run_id = str(uuid.uuid4())
    with client.cursor() as cur:
        cur.execute(
            "INSERT INTO ABREGONZA.TREP_AGENTE_RUN "
            "(RUN_ID, ESTADO, SOLICITADO_POR, FECHA_SOLICITUD) "
            "VALUES (:1, 'PENDIENTE', :2, SYSDATE)",
            [run_id, usuario],
        )
        cur.connection.commit()
    return {"run_id": run_id, "estado": "PENDIENTE"}


def get_ultimo_run() -> dict | None:
    with client.cursor() as cur:
        cur.execute(
            "SELECT RUN_ID, ESTADO, SOLICITADO_POR, FECHA_SOLICITUD, "
            "       FECHA_FIN, RESUMEN, COMMIT_SHA "
            "FROM ABREGONZA.TREP_AGENTE_RUN "
            "ORDER BY FECHA_SOLICITUD DESC FETCH FIRST 1 ROWS ONLY"
        )
        row = cur.fetchone()
        if not row:
            return None
        cols = [c[0].lower() for c in cur.description]
        r = dict(zip(cols, row))
        if hasattr(r.get("resumen"), "read"):
            r["resumen"] = r["resumen"].read()
        return r


def reclamar_pendiente() -> dict | None:
    """Marca el run PENDIENTE mas antiguo como EN_PROCESO y devuelve los
    reportes ABIERTO. El UPDATE con WHERE ESTADO='PENDIENTE' hace el reclamo
    atomico: si dos llamadas concurrentes lo intentan, la segunda actualiza
    0 filas y devuelve None en vez de duplicar el trabajo.
    """
    with client.cursor() as cur:
        cur.execute(
            "SELECT RUN_ID FROM ABREGONZA.TREP_AGENTE_RUN "
            "WHERE ESTADO = 'PENDIENTE' "
            "ORDER BY FECHA_SOLICITUD ASC FETCH FIRST 1 ROWS ONLY"
        )
        row = cur.fetchone()
        if not row:
            return None
        run_id = row[0]

        cur.execute(
            "UPDATE ABREGONZA.TREP_AGENTE_RUN SET ESTADO = 'EN_PROCESO' "
            "WHERE RUN_ID = :1 AND ESTADO = 'PENDIENTE'",
            [run_id],
        )
        if cur.rowcount != 1:
            cur.connection.rollback()
            return None
        cur.connection.commit()

        # DESCRIPCION es CLOB: hay que leerlo dentro del bloque `with`,
        # antes de que la conexion vuelva al pool (mismo gotcha que
        # get_reporte() mas arriba en este archivo).
        cur.execute(
            "SELECT REPORTE_ID, MODULO, TITULO, DESCRIPCION "
            "FROM ABREGONZA.TREP_PROBLEMA WHERE ESTADO = 'ABIERTO' "
            "ORDER BY FECHA_CREACION ASC"
        )
        reportes = []
        for reporte_id, modulo, titulo, descripcion in cur.fetchall():
            reportes.append({
                "reporte_id": reporte_id,
                "modulo": modulo,
                "titulo": titulo,
                "descripcion": (
                    descripcion.read() if hasattr(descripcion, "read")
                    else (descripcion or "")
                ),
            })
    return {"run_id": run_id, "reportes": reportes}


def finalizar_run(
    run_id: str, *, estado: str, resumen: str, commit_sha: str | None,
) -> dict:
    estado = (estado or "").upper()
    if estado not in RUN_ESTADOS_FINALES:
        raise ValidationError("estado_invalido")

    with client.cursor() as cur:
        cur.execute(
            "UPDATE ABREGONZA.TREP_AGENTE_RUN SET ESTADO = :1, RESUMEN = :2, "
            "COMMIT_SHA = :3, FECHA_FIN = SYSDATE WHERE RUN_ID = :4",
            [estado, resumen or "", commit_sha, run_id],
        )
        if cur.rowcount != 1:
            raise LookupError("not_found")
        cur.connection.commit()
    return {"run_id": run_id, "estado": estado}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `cd backend && pytest apps/reportes/tests/test_agente_repo.py -v`
Expected: 8 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/apps/reportes/repo.py backend/apps/reportes/tests/
git commit -m "feat(reportes): repo functions para runs del agente"
```

---

### Task 3: Endpoints DRF + token de servicio

**Files:**
- Modify: `backend/facturation_api/settings.py` (agregar `AGENTE_REPORTES_TOKEN`)
- Modify: `backend/apps/reportes/views.py`
- Modify: `backend/apps/reportes/urls.py`
- Test: `backend/apps/reportes/tests/test_agente_views.py`

- [ ] **Step 1: Agregar el env var en settings**

En `backend/facturation_api/settings.py`, junto a la línea de
`ANTHROPIC_API_KEY = env('ANTHROPIC_API_KEY', default='')` (línea ~153),
agregar:

```python
AGENTE_REPORTES_TOKEN = env('AGENTE_REPORTES_TOKEN', default='')
```

- [ ] **Step 2: Escribir los tests de vistas (deben fallar — rutas no existen)**

Crear `backend/apps/reportes/tests/test_agente_views.py`:

```python
from unittest.mock import patch

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.reportes.repo import ValidationError


@pytest.fixture
def user():
    u, _ = User.objects.get_or_create(username="JCABREU")
    return u


@pytest.fixture
def auth_client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.mark.django_db
def test_lanzar_requires_auth():
    c = APIClient()
    r = c.post("/api/reportes/agente/lanzar/")
    assert r.status_code in (401, 403)


@pytest.mark.django_db
def test_lanzar_forbidden_for_non_admin(auth_client):
    with patch("apps.reportes.views.users_repo.is_dba", return_value=False):
        r = auth_client.post("/api/reportes/agente/lanzar/")
    assert r.status_code == 403


@pytest.mark.django_db
def test_lanzar_creates_run_for_admin(auth_client):
    with patch("apps.reportes.views.users_repo.is_dba", return_value=True), \
         patch(
             "apps.reportes.views.repo.crear_run",
             return_value={"run_id": "r1", "estado": "PENDIENTE"},
         ) as create_mock:
        r = auth_client.post("/api/reportes/agente/lanzar/")
    assert r.status_code == 201
    assert r.data["estado"] == "PENDIENTE"
    create_mock.assert_called_once_with(usuario="JCABREU")


@pytest.mark.django_db
def test_lanzar_returns_409_if_ya_hay_run(auth_client):
    with patch("apps.reportes.views.users_repo.is_dba", return_value=True), \
         patch(
             "apps.reportes.views.repo.crear_run",
             side_effect=ValidationError("run_activo_existente"),
         ):
        r = auth_client.post("/api/reportes/agente/lanzar/")
    assert r.status_code == 409


@pytest.mark.django_db
def test_estado_requires_auth():
    c = APIClient()
    r = c.get("/api/reportes/agente/estado/")
    assert r.status_code in (401, 403)


@pytest.mark.django_db
def test_estado_returns_ultimo_run(auth_client):
    with patch(
        "apps.reportes.views.repo.get_ultimo_run",
        return_value={"run_id": "r1", "estado": "COMPLETADO"},
    ):
        r = auth_client.get("/api/reportes/agente/estado/")
    assert r.status_code == 200
    assert r.data["estado"] == "COMPLETADO"


@pytest.mark.django_db
def test_pendiente_rejects_without_token(settings):
    settings.AGENTE_REPORTES_TOKEN = "secreto123"
    c = APIClient()
    r = c.get("/api/reportes/agente/pendiente/")
    assert r.status_code == 403


@pytest.mark.django_db
def test_pendiente_rejects_wrong_token(settings):
    settings.AGENTE_REPORTES_TOKEN = "secreto123"
    c = APIClient()
    r = c.get(
        "/api/reportes/agente/pendiente/",
        HTTP_AUTHORIZATION="Bearer incorrecto",
    )
    assert r.status_code == 403


@pytest.mark.django_db
def test_pendiente_accepts_valid_token(settings):
    settings.AGENTE_REPORTES_TOKEN = "secreto123"
    c = APIClient()
    with patch("apps.reportes.views.repo.reclamar_pendiente", return_value=None):
        r = c.get(
            "/api/reportes/agente/pendiente/",
            HTTP_AUTHORIZATION="Bearer secreto123",
        )
    assert r.status_code == 200
    assert r.data == {"pendiente": False}


@pytest.mark.django_db
def test_resultado_updates_run(settings):
    settings.AGENTE_REPORTES_TOKEN = "secreto123"
    c = APIClient()
    with patch(
        "apps.reportes.views.repo.finalizar_run",
        return_value={"run_id": "r1", "estado": "COMPLETADO"},
    ) as finalizar_mock:
        r = c.post(
            "/api/reportes/agente/resultado/",
            data={
                "run_id": "r1", "estado": "COMPLETADO",
                "resumen": "ok", "commit_sha": "abc123",
            },
            format="json",
            HTTP_AUTHORIZATION="Bearer secreto123",
        )
    assert r.status_code == 200
    finalizar_mock.assert_called_once_with(
        "r1", estado="COMPLETADO", resumen="ok", commit_sha="abc123",
    )
```

- [ ] **Step 3: Correr los tests y verificar que fallan**

Run: `cd backend && pytest apps/reportes/tests/test_agente_views.py -v`
Expected: fallos 404 (rutas no existen todavía).

- [ ] **Step 4: Implementar las vistas**

En `backend/apps/reportes/views.py`, agregar los imports al inicio del
archivo (junto a los ya existentes):

```python
import hmac

from django.conf import settings
```

Y agregar al final del archivo:

```python
def _check_agente_token(request) -> bool:
    auth = request.headers.get("Authorization") or ""
    if not auth.startswith("Bearer "):
        return False
    token = auth[len("Bearer "):]
    expected = settings.AGENTE_REPORTES_TOKEN
    return bool(expected) and hmac.compare_digest(token, expected)


class AgenteLanzarView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not _is_admin(request):
            return Response({"detail": "forbidden"}, status=403)
        try:
            result = repo.crear_run(usuario=_u(request))
        except repo.ValidationError as e:
            return Response({"detail": str(e)}, status=409)
        return Response(result, status=201)


class AgenteEstadoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        row = repo.get_ultimo_run()
        return Response(row or {})


class AgentePendienteView(APIView):
    permission_classes = []

    def get(self, request):
        if not _check_agente_token(request):
            return Response({"detail": "forbidden"}, status=403)
        claimed = repo.reclamar_pendiente()
        if not claimed:
            return Response({"pendiente": False})
        return Response({"pendiente": True, **claimed})


class AgenteResultadoView(APIView):
    permission_classes = []

    def post(self, request):
        if not _check_agente_token(request):
            return Response({"detail": "forbidden"}, status=403)
        body = request.data or {}
        try:
            result = repo.finalizar_run(
                body.get("run_id"),
                estado=body.get("estado"),
                resumen=body.get("resumen"),
                commit_sha=body.get("commit_sha"),
            )
        except repo.ValidationError as e:
            return Response({"detail": str(e)}, status=400)
        except LookupError:
            return Response({"detail": "not_found"}, status=404)
        return Response(result)
```

- [ ] **Step 5: Agregar las rutas**

En `backend/apps/reportes/urls.py`, agregar antes de la línea
`path("reportes/<str:reporte_id>/", ...)`:

```python
    path("reportes/agente/lanzar/", views.AgenteLanzarView.as_view()),
    path("reportes/agente/estado/", views.AgenteEstadoView.as_view()),
    path("reportes/agente/pendiente/", views.AgentePendienteView.as_view()),
    path("reportes/agente/resultado/", views.AgenteResultadoView.as_view()),
```

- [ ] **Step 6: Correr los tests y verificar que pasan**

Run: `cd backend && pytest apps/reportes/tests/test_agente_views.py -v`
Expected: 10 passed.

- [ ] **Step 7: Correr toda la suite de `reportes` para verificar que no se rompió nada**

Run: `cd backend && pytest apps/reportes/ -v`
Expected: todos passed.

- [ ] **Step 8: Commit**

```bash
git add backend/facturation_api/settings.py backend/apps/reportes/views.py \
        backend/apps/reportes/urls.py backend/apps/reportes/tests/test_agente_views.py
git commit -m "feat(reportes): endpoints del boton Resolver todo con Agente"
```

---

### Task 4: Cliente API del frontend

**Files:**
- Modify: `frontend/src/lib/api-client-reportes.ts`

- [ ] **Step 1: Agregar tipos y funciones**

Al final de `frontend/src/lib/api-client-reportes.ts`, agregar:

```ts
export type EstadoRun = 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADO' | 'ERROR'

export type AgenteRun = {
  run_id: string
  estado: EstadoRun
  solicitado_por: string
  fecha_solicitud: string
  fecha_fin: string | null
  resumen: string | null
  commit_sha: string | null
}

export function lanzarAgente() {
  return request<{ run_id: string; estado: EstadoRun }>(
    '/reportes/agente/lanzar/',
    { method: 'POST' }
  )
}

export function getEstadoAgente() {
  return request<AgenteRun | Record<string, never>>('/reportes/agente/estado/')
}
```

- [ ] **Step 2: Verificar que compila**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores nuevos relacionados a `api-client-reportes.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api-client-reportes.ts
git commit -m "feat(reportes): cliente API para runs del agente"
```

---

### Task 5: Botón en la tabla admin

**Files:**
- Modify: `frontend/src/features/reportes/reportes-admin-table.tsx`

- [ ] **Step 1: Agregar imports**

En la parte superior de `reportes-admin-table.tsx`, reemplazar:

```tsx
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  getReporte,
  imagenReporteUrl,
  listReportes,
  MODULOS_REPORTE,
  patchReporte,
  type EstadoReporte,
  type ReporteResumen,
} from '@/lib/api-client-reportes'
```

por:

```tsx
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api-client'
import {
  getEstadoAgente,
  getReporte,
  imagenReporteUrl,
  lanzarAgente,
  listReportes,
  MODULOS_REPORTE,
  patchReporte,
  type EstadoReporte,
  type EstadoRun,
  type ReporteResumen,
} from '@/lib/api-client-reportes'
```

- [ ] **Step 2: Renderizar el botón dentro de `ReportesAdminTable`**

Dentro de `export function ReportesAdminTable() { ... }`, cambiar el inicio
del `return`:

```tsx
  return (
    <div className='space-y-4'>
```

por:

```tsx
  return (
    <div className='space-y-4'>
      <AgenteBoton />
```

(el resto del `return` queda igual).

- [ ] **Step 3: Agregar el componente `AgenteBoton`**

Después del cierre de `export function ReportesAdminTable() { ... }` (antes
de `function ReporteDetailSheet(...)`), agregar:

```tsx
function AgenteBoton() {
  const queryClient = useQueryClient()
  const runAnteriorRef = useRef<EstadoRun | undefined>(undefined)

  const estadoQuery = useQuery({
    queryKey: ['reportes', 'agente', 'estado'],
    queryFn: getEstadoAgente,
    refetchInterval: (query) => {
      const estado = (query.state.data as { estado?: EstadoRun })?.estado
      return estado === 'PENDIENTE' || estado === 'EN_PROCESO' ? 5000 : false
    },
  })

  const run = estadoQuery.data && 'estado' in estadoQuery.data
    ? estadoQuery.data
    : null

  useEffect(() => {
    const estadoActual = run?.estado
    const anterior = runAnteriorRef.current
    if (
      anterior &&
      anterior !== estadoActual &&
      (estadoActual === 'COMPLETADO' || estadoActual === 'ERROR')
    ) {
      queryClient.invalidateQueries({ queryKey: ['reportes', 'admin'] })
    }
    runAnteriorRef.current = estadoActual
  }, [run?.estado, queryClient])

  const lanzar = useMutation({
    mutationFn: lanzarAgente,
    onSuccess: () => {
      toast.success('Agente lanzado, revisando reportes abiertos...')
      queryClient.invalidateQueries({ queryKey: ['reportes', 'agente', 'estado'] })
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        toast.error('Ya hay una corrida del agente en curso')
      } else {
        toast.error('No se pudo lanzar el agente')
      }
    },
  })

  const enCurso = run?.estado === 'PENDIENTE' || run?.estado === 'EN_PROCESO'

  return (
    <div className='flex flex-col gap-1 rounded-md border p-3'>
      <div className='flex items-center justify-between gap-2'>
        <div>
          <p className='text-sm font-medium'>Resolver todo con Agente</p>
          <p className='text-muted-foreground text-xs'>
            Lanza a Claude Code para diagnosticar y corregir ahora mismo
            todos los reportes abiertos.
          </p>
        </div>
        <Button
          disabled={enCurso || lanzar.isPending}
          onClick={() => lanzar.mutate()}
        >
          {(enCurso || lanzar.isPending) && (
            <Loader2 className='mr-2 size-4 animate-spin' />
          )}
          Resolver todo con Agente
        </Button>
      </div>
      {run && (run.estado === 'COMPLETADO' || run.estado === 'ERROR') && (
        <p className='text-muted-foreground text-xs'>
          Última corrida ({run.estado}
          {run.fecha_fin ? `, ${new Date(run.fecha_fin).toLocaleString()}` : ''}
          ): {run.resumen || 'sin resumen'}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verificar que compila**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores nuevos relacionados a `reportes-admin-table.tsx`.

- [ ] **Step 5: Smoke manual**

Run: `cd frontend && npm run dev` y abrir Configuración → Reportes con un
usuario admin.
Expected: se ve el bloque "Resolver todo con Agente" arriba de los filtros,
botón habilitado, sin errores en consola.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/reportes/reportes-admin-table.tsx
git commit -m "feat(reportes): boton Resolver todo con Agente en tabla admin"
```

---

### Task 6: Watcher script (PC de JCABREU)

**Files:**
- Create: `backend/docs/superpowers/agente-reportes/watcher-agente-reportes.ps1`
- Create: `backend/docs/superpowers/agente-reportes/README.md`

- [ ] **Step 1: Escribir el script**

Crear `backend/docs/superpowers/agente-reportes/watcher-agente-reportes.ps1`:

```powershell
# Poll loop: revisa cada 45s si hay una corrida PENDIENTE del boton
# "Resolver todo con Agente" y, si la hay, lanza Claude Code headless.
# Ver spec: backend/docs/superpowers/specs/2026-07-30-agente-reportes-boton-design.md

$RepoDir   = "C:\Users\JCABREU\AppData\Local\memorias_sigaft\facturation-system"
$ApiBase   = "https://grupo-abregonza.hopto.org:8443/api"
$Token     = $env:AGENTE_REPORTES_TOKEN
$LogDir    = Join-Path $PSScriptRoot "logs"
$ClaudeCli = "C:\Users\JCABREU\AppData\Roaming\npm\claude.cmd"

if (-not $Token) {
    Write-Error "Falta la variable de entorno AGENTE_REPORTES_TOKEN"
    exit 1
}
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

while ($true) {
    try {
        $resp = Invoke-RestMethod -Uri "$ApiBase/reportes/agente/pendiente/" `
            -Headers @{ Authorization = "Bearer $Token" } -Method Get
    } catch {
        Write-Host "$(Get-Date -Format s) poll fallo: $_"
        Start-Sleep -Seconds 45
        continue
    }

    if ($resp.pendiente) {
        $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $promptPath = Join-Path $LogDir "prompt-$stamp.txt"
        $logPath    = Join-Path $LogDir "run-$stamp.log"
        $reportesJson = $resp.reportes | ConvertTo-Json -Depth 5

        @"
Sos el agente autonomo de ZentoryERP. Resolve TODOS los reportes de
problemas en estado ABIERTO listados abajo.

Repo: $RepoDir (rama main, working tree limpio)
API_BASE: $ApiBase
run_id de esta corrida: $($resp.run_id)
Token para llamar a la API: $Token

Reportes ABIERTO (JSON):
$reportesJson

Instrucciones obligatorias, en orden:
1. Para cada reporte, si necesitas mas contexto: GET $ApiBase/reportes/{reporte_id}/
2. Diagnostica la causa real en el codigo o los datos. No inventes features
   nuevas, solo corrige el problema reportado.
3. Corre la suite de tests del proyecto (backend: pytest desde backend/;
   frontend: npm run test si el fix toca frontend).
4. SOLO si TODOS los tests pasan: haz commit + push a main, y si cambiaste
   archivos backend, subelos con pscp a
   jcabreu@10.0.0.99:facturation-system/backend/... (credenciales y ruta
   exacta en la skill sigaft-deploy-vm).
5. Si los tests NO pasan, o no encontraste una correccion segura para algun
   reporte, NO hagas push de nada. Deja ese reporte ABIERTO explicando por
   que en el resumen final.
6. Para cada reporte que SI resolviste: PATCH $ApiBase/reportes/{reporte_id}/
   con body {"estado": "COMPLETADO", "nota_resolucion": "..."}
7. Al final, pase lo que pase, reporta el resultado de ESTA corrida:
   POST $ApiBase/reportes/agente/resultado/
   header Authorization: Bearer $Token
   body {"run_id": "$($resp.run_id)", "estado": "COMPLETADO o ERROR",
         "resumen": "que se arreglo, que no y por que", "commit_sha": "sha o null"}
"@ | Set-Content -Path $promptPath -Encoding UTF8

        Get-Content $promptPath -Raw | & $ClaudeCli --dangerously-skip-permissions -p --output-format text *> $logPath
    }

    Start-Sleep -Seconds 45
}
```

- [ ] **Step 2: Escribir el README**

Crear `backend/docs/superpowers/agente-reportes/README.md`:

```markdown
# Watcher del Agente de Reportes

Poll loop que revisa cada 45s si hay una corrida pendiente del botón
"Resolver todo con Agente" (Configuración → Reportes, admin) y, si la hay,
lanza una sesión headless de Claude Code para resolverla. Diseño completo
en `backend/docs/superpowers/specs/2026-07-30-agente-reportes-boton-design.md`.

## Cómo probarlo manualmente (una corrida)

1. Define el token (mismo valor que `AGENTE_REPORTES_TOKEN` en el `.env`
   de la VM):
   ```
   $env:AGENTE_REPORTES_TOKEN = "el-token-real"
   ```
2. Corre el script en primer plano:
   ```
   powershell -File backend\docs\superpowers\agente-reportes\watcher-agente-reportes.ps1
   ```
3. Desde la app, con un usuario admin, click en "Resolver todo con Agente".
4. En 0-45s el script debería detectar `pendiente: true`, escribir
   `logs\prompt-<fecha>.txt` y `logs\run-<fecha>.log`, e invocar Claude Code.
5. Revisa `logs\run-<fecha>.log` para ver qué hizo.

## Cómo dejarlo corriendo siempre (activación real — paso manual, no incluido en el PR)

Esto deja un proceso con credenciales de deploy corriendo sin supervisión.
Actívalo solo cuando quieras que el botón funcione de verdad en producción:

```
$env:AGENTE_REPORTES_TOKEN = "el-token-real"
schtasks /create /tn "ZentoryERP-AgenteReportesWatcher" /tr "powershell -WindowStyle Hidden -File C:\Users\JCABREU\AppData\Local\memorias_sigaft\facturation-system\backend\docs\superpowers\agente-reportes\watcher-agente-reportes.ps1" /sc onlogon /rl highest
```

Para pararlo:
```
schtasks /end /tn "ZentoryERP-AgenteReportesWatcher"
schtasks /delete /tn "ZentoryERP-AgenteReportesWatcher" /f
```
```

- [ ] **Step 3: Commit**

```bash
git add backend/docs/superpowers/agente-reportes/
git commit -m "docs(reportes): watcher script para el boton Resolver todo con Agente"
```

---

### Task 7: Suite completa + self-review final

- [ ] **Step 1: Correr toda la suite backend**

Run: `cd backend && pytest -q`
Expected: todos passed, sin regresiones fuera de `apps/reportes`.

- [ ] **Step 2: Typecheck completo del frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 3: Revisar el diff completo contra `main`**

Run: `git diff main --stat`
Expected: solo los archivos listados en este plan.

---

### Task 8: Pasos manuales post-merge (NO ejecutar en este PR)

Estos pasos tocan la base de datos Oracle de producción y el `.env` de la
VM — se dejan documentados para que el usuario los corra después de
revisar y mergear el PR, no como parte de la implementación automática:

1. Aplicar la migración:
   ```
   plink -batch jcabreu@10.0.0.99 "cd facturation-system && sqlplus JCABREU/508192003@AB @backend/apps/reportes/sql/002_create_trep_agente_run.sql"
   ```
2. Generar un token aleatorio y agregarlo al `.env` de la VM como
   `AGENTE_REPORTES_TOKEN=...` (el backend recarga solo).
3. Subir los archivos backend cambiados con `pscp` (ver skill
   `sigaft-deploy-vm`).
4. Confirmar que Netlify desplegó el frontend (push a `main` ya lo dispara).
5. Solo cuando se quiera activar el watcher de verdad: seguir el README de
   `backend/docs/superpowers/agente-reportes/` para registrar la tarea
   programada con el mismo token.
