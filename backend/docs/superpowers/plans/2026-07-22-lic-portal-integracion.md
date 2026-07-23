# LIC Fase 1 (Integración con Portal DGCP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `apps/lic` Django app that stores per-empresa DGCP portal credentials, scrapes the "Oportunidades" feed of the SAP-Ariba-based procurement portal (`comunidad.comprasdominicana.gob.do` / `portal.comprasdominicana.gob.do`) with Playwright, downloads tender documents, and extracts RPE rubros from an uploaded PDF as a validation backup — plus the frontend panel to configure it and browse results.

**Architecture:** Business data (credenciales, oportunidades, documentos, rubros) lives in Oracle via raw SQL through the existing `apps.legacy.client` pool, following the exact pattern of `apps/fe` (plain Django views, no DRF, no Django ORM for Oracle). Ephemeral scrape-job status lives in a small Django ORM model backed by the project's sqlite DB (same pattern already used by `apps/mcp`/`apps/asistente` for non-Oracle internal state). A single `services/orchestrator.py` function is shared by the daily cron (`manage.py scrape_licitaciones`, run via an in-container cron job) and the manual "Buscar ahora" API endpoint (run in a background thread).

**Tech Stack:** Django 5 (plain views, not DRF), python-oracledb (thick mode via `apps.legacy.client`), Playwright (Python, headless Chromium — new to the backend), `pypdf` for text extraction, `anthropic` SDK (already configured) for rubro structuring, React + TanStack Query + TanStack Router + shadcn/ui on the frontend.

**Reference spec:** `backend/docs/superpowers/specs/2026-07-22-lic-portal-integracion-design.md`

---

## Entorno de ejecución real (leer antes de cualquier tarea)

Descubierto durante la planificación, corrige suposiciones del texto de las tareas de abajo:

- **No hay Docker local.** El backend real corre en el contenedor `facturation_backend` de la VM
  `10.0.0.99` (usuario `jcabreu`, password `Temp1234!`, hostkey
  `SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc`), proyecto remoto en
  `~/facturation-system`. Cualquier paso que diga `docker exec -it facturation_backend ...`
  debe traducirse a `plink -batch -hostkey "..." -pw "Temp1234!" jcabreu@10.0.0.99 "docker exec
  facturation_backend ..."`. Subir archivos con `pscp` (ver skill `sigaft-deploy-vm`).
- **Riesgo de divergencia VM vs git.** La VM NO es un repo git y está adelante del repo local en
  varios archivos (memoria `deploy/vm-source-of-truth-2026-05-25`). Antes de subir cualquier
  cambio a un archivo que YA EXISTE en la VM (no uno nuevo) — en este plan eso aplica a
  `backend/facturation_api/settings.py`, `backend/facturation_api/urls.py`,
  `backend/requirements.txt`, `backend/Dockerfile.dev`, `docker-compose.yml`,
  `frontend/src/components/layout/data/sidebar-data.ts` — primero descargar la versión viva de
  la VM con `pscp` (dirección inversa), diferenciarla contra el archivo local, y editar sobre esa
  versión. Los archivos nuevos de `apps/lic/` y `features/lic/` no tienen este riesgo.
- **El contenedor backend corre `python manage.py runserver` (StatReloader)**, no
  necesariamente `uvicorn --reload` como sugiere el `docker-compose.yml` local — confirmar el
  comando real en la VM (`plink ... "docker inspect facturation_backend --format '{{.Config.Cmd}}'"`)
  antes de asumir cuál es, especialmente para la Tarea 9.
- **Tarea 9 requiere reconstruir y reiniciar la imagen del backend** (para instalar Playwright/
  Chromium y cron) — esto rompe la regla no-escrita de este VM de "nunca reiniciar contenedores,
  el hot-reload es automático". Como el backend es producción viva (facturación real), **no
  ejecutar la reconstrucción de la Tarea 9 sin pausar primero y pedir confirmación explícita al
  usuario**, incluso en modo de ejecución continua.
- No usar `npm run build` de forma rutinaria (preferencia del usuario) — verificar rutas del
  frontend contra Vite dev en la VM (puerto 5173) en vez de una build completa, salvo que una
  tarea lo requiera explícitamente para regenerar `routeTree.gen.ts`.

---

## File Structure

New/modified files:

```
backend/apps/lic/
  __init__.py
  apps.py
  models.py                # ScrapeJob (sqlite/Django ORM) + migration
  migrations/0001_initial.py
  urls.py
  views.py
  sql/001_create_tlic.sql  # Oracle DDL, run manually once
  services/
    __init__.py
    scraper.py              # Playwright login + list_oportunidades + download_documentos
    pdf_rubros.py            # pypdf text extraction + Claude structuring
    orchestrator.py          # shared by cron command and manual-trigger view
  management/
    __init__.py
    commands/
      __init__.py
      scrape_licitaciones.py
  tests/
    __init__.py
    conftest.py
    test_lic_repo.py
    test_scraper_parsing.py
    test_pdf_rubros.py
    test_orchestrator.py

backend/apps/legacy/repositories/lic_repo.py   # new
backend/facturation_api/settings.py            # INSTALLED_APPS += apps.lic
backend/facturation_api/urls.py                # + path('api/lic/', include('apps.lic.urls'))
backend/requirements.txt                       # + playwright, pypdf
backend/Dockerfile.dev                         # + playwright install, cron package, entrypoint
backend/docker/entrypoint.sh                   # new: starts cron + uvicorn
backend/docker/crontab-lic                     # new: daily schedule
docker-compose.yml                             # backend command -> ./docker/entrypoint.sh

frontend/src/features/lic/
  api.ts                    # React Query hooks (mirrors apps/fe's self-contained api.ts)
  lic-config.tsx            # Configuración page (credenciales + rubros PDF)
  lic-oportunidades.tsx     # Oportunidades list page

frontend/src/routes/_authenticated/lic.tsx           # layout route
frontend/src/routes/_authenticated/lic/config.tsx    # thin route wrapper
frontend/src/routes/_authenticated/lic/oportunidades.tsx  # thin route wrapper

frontend/src/components/layout/data/sidebar-data.ts  # + Licitaciones entry
```

---

### Task 1: Oracle DDL for the LIC business tables

**Files:**
- Create: `backend/apps/lic/sql/001_create_tlic.sql`

- [ ] **Step 1: Write the DDL file**

```sql
-- Ejecutar manualmente contra Oracle (mismo patrón que backend/docs/sql/2026-07-07-fe-tablas.sql)
-- Schema: FAT (mismo schema compartido que usan otros módulos nuevos, ej. TFE_*)
-- Oracle 11g: PK autogenerado via secuencia+trigger, no soporta IDENTITY (12c+)

CREATE TABLE FAT.TLIC_CREDENCIAL (
    ID               NUMBER PRIMARY KEY,
    NO_CIA           VARCHAR2(2) NOT NULL,
    USUARIO_PORTAL   VARCHAR2(100) NOT NULL,
    PASSWORD_CIFRADO VARCHAR2(500) NOT NULL,
    ESTADO           VARCHAR2(20) DEFAULT 'activo' NOT NULL,
    ULTIMO_LOGIN_OK  TIMESTAMP,
    ULTIMO_ERROR     VARCHAR2(1000),
    ACTUALIZADO_EN   TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT UQ_TLIC_CREDENCIAL_CIA UNIQUE (NO_CIA)
);
/

CREATE SEQUENCE FAT.SEQ_TLIC_CREDENCIAL;
/

CREATE OR REPLACE TRIGGER FAT.TRG_TLIC_CREDENCIAL_ID
BEFORE INSERT ON FAT.TLIC_CREDENCIAL
FOR EACH ROW
WHEN (NEW.ID IS NULL)
BEGIN
    :NEW.ID := FAT.SEQ_TLIC_CREDENCIAL.NEXTVAL;
END;
/

CREATE TABLE FAT.TLIC_RUBRO_PDF (
    ID                NUMBER PRIMARY KEY,
    NO_CIA            VARCHAR2(2) NOT NULL,
    NOMBRE_ARCHIVO    VARCHAR2(300) NOT NULL,
    RUTA_ARCHIVO      VARCHAR2(500) NOT NULL,
    ESTADO_EXTRACCION VARCHAR2(20) DEFAULT 'pendiente' NOT NULL,
    MENSAJE_ERROR     VARCHAR2(1000),
    CREADO_EN         TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
);
/

CREATE SEQUENCE FAT.SEQ_TLIC_RUBRO_PDF;
/

CREATE OR REPLACE TRIGGER FAT.TRG_TLIC_RUBRO_PDF_ID
BEFORE INSERT ON FAT.TLIC_RUBRO_PDF
FOR EACH ROW
WHEN (NEW.ID IS NULL)
BEGIN
    :NEW.ID := FAT.SEQ_TLIC_RUBRO_PDF.NEXTVAL;
END;
/

CREATE TABLE FAT.TLIC_RUBRO (
    ID           NUMBER PRIMARY KEY,
    RUBRO_PDF_ID NUMBER NOT NULL,
    CODIGO       VARCHAR2(50),
    DESCRIPCION  VARCHAR2(500) NOT NULL,
    CONSTRAINT FK_TLIC_RUBRO_PDF FOREIGN KEY (RUBRO_PDF_ID) REFERENCES FAT.TLIC_RUBRO_PDF(ID)
);
/

CREATE SEQUENCE FAT.SEQ_TLIC_RUBRO;
/

CREATE OR REPLACE TRIGGER FAT.TRG_TLIC_RUBRO_ID
BEFORE INSERT ON FAT.TLIC_RUBRO
FOR EACH ROW
WHEN (NEW.ID IS NULL)
BEGIN
    :NEW.ID := FAT.SEQ_TLIC_RUBRO.NEXTVAL;
END;
/

CREATE TABLE FAT.TLIC_OPORTUNIDAD (
    ID                   NUMBER PRIMARY KEY,
    NO_CIA               VARCHAR2(2) NOT NULL,
    REFERENCIA           VARCHAR2(60) NOT NULL,
    OPPORTUNITY_UID      VARCHAR2(60),
    TIPO_PROCESO         VARCHAR2(100),
    ENTIDAD              VARCHAR2(200),
    TITULO               VARCHAR2(500),
    ESTADO_PORTAL        VARCHAR2(60),
    OFERTAS_PRESENTADAS  NUMBER DEFAULT 0,
    OFERTAS_CREADAS      NUMBER DEFAULT 0,
    FECHA_PUBLICACION    DATE,
    FECHA_LIMITE         DATE,
    FECHA_FIRMA_CONTRATO DATE,
    UNIDAD_REQUISICION   VARCHAR2(200),
    CODIGO_UNSPSC        VARCHAR2(50),
    LUGAR_ENTREGA        VARCHAR2(500),
    CREADO_EN            TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    ACTUALIZADO_EN       TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT UQ_TLIC_OPORTUNIDAD UNIQUE (NO_CIA, REFERENCIA)
);
/

CREATE SEQUENCE FAT.SEQ_TLIC_OPORTUNIDAD;
/

CREATE OR REPLACE TRIGGER FAT.TRG_TLIC_OPORTUNIDAD_ID
BEFORE INSERT ON FAT.TLIC_OPORTUNIDAD
FOR EACH ROW
WHEN (NEW.ID IS NULL)
BEGIN
    :NEW.ID := FAT.SEQ_TLIC_OPORTUNIDAD.NEXTVAL;
END;
/

CREATE TABLE FAT.TLIC_DOCUMENTO (
    ID              NUMBER PRIMARY KEY,
    OPORTUNIDAD_ID  NUMBER NOT NULL,
    TIPO_DOCUMENTO  VARCHAR2(100),
    NOMBRE_ARCHIVO  VARCHAR2(300) NOT NULL,
    RUTA_ARCHIVO    VARCHAR2(500) NOT NULL,
    ESTADO          VARCHAR2(20) DEFAULT 'ok' NOT NULL,
    DESCARGADO_EN   TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT FK_TLIC_DOCUMENTO_OPP FOREIGN KEY (OPORTUNIDAD_ID) REFERENCES FAT.TLIC_OPORTUNIDAD(ID)
);
/

CREATE SEQUENCE FAT.SEQ_TLIC_DOCUMENTO;
/

CREATE OR REPLACE TRIGGER FAT.TRG_TLIC_DOCUMENTO_ID
BEFORE INSERT ON FAT.TLIC_DOCUMENTO
FOR EACH ROW
WHEN (NEW.ID IS NULL)
BEGIN
    :NEW.ID := FAT.SEQ_TLIC_DOCUMENTO.NEXTVAL;
END;
/
```

**Nota de ejecución real (2026-07-22):** la BD destino es Oracle 11g, que no soporta
`GENERATED ... AS IDENTITY` (eso llegó en 12c). Se sustituyó cada PK por
`ID NUMBER PRIMARY KEY` + `CREATE SEQUENCE FAT.SEQ_TLIC_<TABLA>` +
`CREATE OR REPLACE TRIGGER FAT.TRG_TLIC_<TABLA>_ID ... BEFORE INSERT ... FOR EACH ROW
WHEN (NEW.ID IS NULL) BEGIN :NEW.ID := FAT.SEQ_TLIC_<TABLA>.NEXTVAL; END;`, un patrón por
tabla. El bloque de arriba ya refleja el DDL real ejecutado en
`backend/apps/lic/sql/001_create_tlic.sql`; verificado con `all_objects` (5 tablas +
5 secuencias + 5 triggers = 15 objetos bajo owner FAT) y con un insert/delete de prueba
en `TLIC_CREDENCIAL` que confirmó que el trigger puebla `ID` correctamente.

- [ ] **Step 2: Run it against Oracle once (manual, same as the `fe` tables)**

From inside the backend container (matches how `2026-07-07-fe-tablas.sql` was applied):

```bash
docker exec -it facturation_backend python manage.py shell -c "
from apps.legacy import client
sql = open('apps/lic/sql/001_create_tlic.sql').read()
statements = [s.strip() for s in sql.split(';') if s.strip() and not s.strip().startswith('--')]
with client.cursor() as cur:
    for stmt in statements:
        cur.execute(stmt)
    cur.connection.commit()
print('LIC tables created')
"
```

Expected output: `LIC tables created`. Verify with:

```bash
docker exec -it facturation_backend python manage.py shell -c "
from apps.legacy import client
print(client.fetch_dicts(\"SELECT table_name FROM all_tables WHERE table_name LIKE 'TLIC_%' AND owner='FAT'\", []))
"
```

Expected: 5 rows (`TLIC_CREDENCIAL`, `TLIC_RUBRO_PDF`, `TLIC_RUBRO`, `TLIC_OPORTUNIDAD`, `TLIC_DOCUMENTO`).

- [ ] **Step 3: Commit**

```bash
git add backend/apps/lic/sql/001_create_tlic.sql
git commit -m "feat(lic): agregar DDL de tablas Oracle para módulo de licitaciones"
```

---

### Task 2: Django app skeleton

**Files:**
- Create: `backend/apps/lic/__init__.py`
- Create: `backend/apps/lic/apps.py`
- Create: `backend/apps/lic/urls.py`
- Modify: `backend/facturation_api/settings.py`
- Modify: `backend/facturation_api/urls.py`

- [ ] **Step 1: Create the app package**

`backend/apps/lic/__init__.py`: empty file.

`backend/apps/lic/apps.py`:

```python
from django.apps import AppConfig


class LicConfig(AppConfig):
    name = 'apps.lic'
```

`backend/apps/lic/urls.py` (empty for now, filled in Task 6):

```python
from django.urls import path

urlpatterns = []
```

- [ ] **Step 2: Register the app**

In `backend/facturation_api/settings.py`, find:

```python
    'apps.core', 'apps.legacy', 'apps.auth_legacy', 'apps.fat', 'apps.fe', 'apps.cnt',
    'apps.docs', 'apps.mcp', 'apps.asistente', 'apps.reportes',
```

Change to:

```python
    'apps.core', 'apps.legacy', 'apps.auth_legacy', 'apps.fat', 'apps.fe', 'apps.cnt',
    'apps.docs', 'apps.mcp', 'apps.asistente', 'apps.reportes', 'apps.lic',
```

- [ ] **Step 3: Wire the URL include**

In `backend/facturation_api/urls.py`, find:

```python
    path('api/fe/', include('apps.fe.urls')),
```

Add right after it:

```python
    path('api/fe/', include('apps.fe.urls')),
    path('api/lic/', include('apps.lic.urls')),
```

- [ ] **Step 4: Verify Django loads the app**

```bash
docker exec -it facturation_backend python manage.py check
```

Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 5: Commit**

```bash
git add backend/apps/lic/__init__.py backend/apps/lic/apps.py backend/apps/lic/urls.py \
        backend/facturation_api/settings.py backend/facturation_api/urls.py
git commit -m "feat(lic): scaffolding del app Django apps.lic"
```

---

### Task 3: Repository layer (`lic_repo.py`)

**Files:**
- Create: `backend/apps/legacy/repositories/lic_repo.py`
- Create: `backend/apps/lic/tests/__init__.py`
- Create: `backend/apps/lic/tests/conftest.py`
- Create: `backend/apps/lic/tests/test_lic_repo.py`

- [ ] **Step 1: Write the failing tests**

`backend/apps/lic/tests/__init__.py`: empty file.

`backend/apps/lic/tests/conftest.py`:

```python
import pytest


@pytest.fixture
def mock_client(mocker):
    return mocker.patch("apps.legacy.repositories.lic_repo.client")
```

`backend/apps/lic/tests/test_lic_repo.py`:

```python
from apps.legacy.repositories import lic_repo


def test_get_credencial_returns_none_when_missing(mock_client):
    mock_client.fetch_dicts.return_value = []
    assert lic_repo.get_credencial("01") is None


def test_get_credencial_returns_row(mock_client):
    mock_client.fetch_dicts.return_value = [
        {"no_cia": "01", "usuario_portal": "abregonza", "estado": "activo"}
    ]
    result = lic_repo.get_credencial("01")
    assert result["usuario_portal"] == "abregonza"


def test_upsert_credencial_inserts_when_new(mock_client):
    mock_client.fetch_dicts.return_value = []
    cur = mock_client.cursor.return_value.__enter__.return_value
    lic_repo.upsert_credencial("01", "abregonza", "cifrado123")
    assert cur.execute.call_count == 1
    sql = cur.execute.call_args[0][0]
    assert "INSERT INTO FAT.TLIC_CREDENCIAL" in sql


def test_upsert_credencial_updates_when_existing(mock_client):
    mock_client.fetch_dicts.return_value = [{"id": 1}]
    cur = mock_client.cursor.return_value.__enter__.return_value
    lic_repo.upsert_credencial("01", "abregonza", "cifrado123")
    sql = cur.execute.call_args[0][0]
    assert "UPDATE FAT.TLIC_CREDENCIAL" in sql


def test_upsert_oportunidad_returns_is_new_true_for_first_seen(mock_client):
    mock_client.fetch_dicts.return_value = []
    oportunidad_id, is_new = lic_repo.upsert_oportunidad(
        "01",
        {
            "referencia": "HPDEF-DAF-CM-2026-0021",
            "opportunity_uid": "DO1.OPDOS.5660234",
            "tipo_proceso": "Contratación Menor",
            "entidad": "Hospital Provincial Dr. Elio Fiallo",
            "titulo": "ADQUISICION DE AIRE ACONDICIONADO, TV E IMPRESORA",
            "estado_portal": "SELECCIÓN",
            "ofertas_presentadas": 0,
            "ofertas_creadas": 1,
            "fecha_publicacion": "2026-07-21 14:40",
            "fecha_limite": "2026-07-28 11:00",
        },
    )
    assert is_new is True


def test_upsert_oportunidad_returns_is_new_false_when_seen_before(mock_client):
    mock_client.fetch_dicts.return_value = [{"id": 42}]
    oportunidad_id, is_new = lic_repo.upsert_oportunidad(
        "01",
        {
            "referencia": "HPDEF-DAF-CM-2026-0021",
            "opportunity_uid": "DO1.OPDOS.5660234",
            "tipo_proceso": "Contratación Menor",
            "entidad": "Hospital Provincial Dr. Elio Fiallo",
            "titulo": "ADQUISICION DE AIRE ACONDICIONADO, TV E IMPRESORA",
            "estado_portal": "SELECCIÓN",
            "ofertas_presentadas": 0,
            "ofertas_creadas": 1,
            "fecha_publicacion": "2026-07-21 14:40",
            "fecha_limite": "2026-07-28 11:00",
        },
    )
    assert oportunidad_id == 42
    assert is_new is False
```

- [ ] **Step 2: Run to verify it fails**

```bash
docker exec -it facturation_backend pytest apps/lic/tests/test_lic_repo.py -v
```

Expected: `ModuleNotFoundError: No module named 'apps.legacy.repositories.lic_repo'` (and `pytest-mock`'s `mocker` fixture needs `pytest-mock` — check next step).

Add `pytest-mock>=3.14` to `backend/requirements.txt` if it's not already there (it wasn't found in the dependency scan) and reinstall:

```bash
docker exec -it facturation_backend pip install pytest-mock
```

- [ ] **Step 3: Implement `lic_repo.py`**

```python
"""Repositorio LIC: acceso a las tablas FAT.TLIC_* vía apps.legacy.client (thick mode)."""
from apps.legacy import client


def get_credencial(no_cia: str) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT id, no_cia, usuario_portal, estado, ultimo_login_ok, ultimo_error "
        "FROM FAT.TLIC_CREDENCIAL WHERE no_cia = :1",
        [no_cia],
    )
    return rows[0] if rows else None


def get_credencial_con_password(no_cia: str) -> dict | None:
    rows = client.fetch_dicts(
        "SELECT id, no_cia, usuario_portal, password_cifrado, estado "
        "FROM FAT.TLIC_CREDENCIAL WHERE no_cia = :1",
        [no_cia],
    )
    return rows[0] if rows else None


def list_credenciales() -> list[dict]:
    return client.fetch_dicts(
        "SELECT no_cia, usuario_portal, estado, ultimo_login_ok, ultimo_error "
        "FROM FAT.TLIC_CREDENCIAL ORDER BY no_cia",
        [],
    )


def upsert_credencial(no_cia: str, usuario_portal: str, password_cifrado: str) -> None:
    existing = client.fetch_dicts(
        "SELECT id FROM FAT.TLIC_CREDENCIAL WHERE no_cia = :1", [no_cia]
    )
    with client.cursor() as cur:
        if existing:
            cur.execute(
                "UPDATE FAT.TLIC_CREDENCIAL SET usuario_portal = :usuario, "
                "password_cifrado = :password, estado = 'activo', ultimo_error = NULL, "
                "actualizado_en = SYSTIMESTAMP WHERE no_cia = :no_cia",
                {"usuario": usuario_portal, "password": password_cifrado, "no_cia": no_cia},
            )
        else:
            cur.execute(
                "INSERT INTO FAT.TLIC_CREDENCIAL (no_cia, usuario_portal, password_cifrado) "
                "VALUES (:no_cia, :usuario, :password)",
                {"no_cia": no_cia, "usuario": usuario_portal, "password": password_cifrado},
            )
        cur.connection.commit()


def marcar_login_resultado(no_cia: str, ok: bool, mensaje_error: str | None = None) -> None:
    with client.cursor() as cur:
        if ok:
            cur.execute(
                "UPDATE FAT.TLIC_CREDENCIAL SET estado = 'activo', ultimo_login_ok = SYSTIMESTAMP, "
                "ultimo_error = NULL WHERE no_cia = :1",
                [no_cia],
            )
        else:
            cur.execute(
                "UPDATE FAT.TLIC_CREDENCIAL SET estado = 'error_login', ultimo_error = :1 "
                "WHERE no_cia = :2",
                [mensaje_error, no_cia],
            )
        cur.connection.commit()


def upsert_oportunidad(no_cia: str, data: dict) -> tuple[int, bool]:
    """Inserta o actualiza una oportunidad por (no_cia, referencia).

    Retorna (id, es_nueva).
    """
    existing = client.fetch_dicts(
        "SELECT id FROM FAT.TLIC_OPORTUNIDAD WHERE no_cia = :1 AND referencia = :2",
        [no_cia, data["referencia"]],
    )
    params = {
        "no_cia": no_cia,
        "referencia": data["referencia"],
        "opportunity_uid": data.get("opportunity_uid"),
        "tipo_proceso": data.get("tipo_proceso"),
        "entidad": data.get("entidad"),
        "titulo": data.get("titulo"),
        "estado_portal": data.get("estado_portal"),
        "ofertas_presentadas": data.get("ofertas_presentadas", 0),
        "ofertas_creadas": data.get("ofertas_creadas", 0),
        "fecha_publicacion": data.get("fecha_publicacion"),
        "fecha_limite": data.get("fecha_limite"),
    }
    with client.cursor() as cur:
        if existing:
            oportunidad_id = existing[0]["id"]
            params["id"] = oportunidad_id
            cur.execute(
                "UPDATE FAT.TLIC_OPORTUNIDAD SET tipo_proceso = :tipo_proceso, "
                "entidad = :entidad, titulo = :titulo, estado_portal = :estado_portal, "
                "ofertas_presentadas = :ofertas_presentadas, ofertas_creadas = :ofertas_creadas, "
                "fecha_publicacion = TO_DATE(:fecha_publicacion, 'YYYY-MM-DD HH24:MI'), "
                "fecha_limite = TO_DATE(:fecha_limite, 'YYYY-MM-DD HH24:MI'), "
                "actualizado_en = SYSTIMESTAMP WHERE id = :id",
                params,
            )
            cur.connection.commit()
            return oportunidad_id, False

        cur.execute(
            "INSERT INTO FAT.TLIC_OPORTUNIDAD (no_cia, referencia, opportunity_uid, tipo_proceso, "
            "entidad, titulo, estado_portal, ofertas_presentadas, ofertas_creadas, "
            "fecha_publicacion, fecha_limite) VALUES (:no_cia, :referencia, :opportunity_uid, "
            ":tipo_proceso, :entidad, :titulo, :estado_portal, :ofertas_presentadas, "
            ":ofertas_creadas, TO_DATE(:fecha_publicacion, 'YYYY-MM-DD HH24:MI'), "
            "TO_DATE(:fecha_limite, 'YYYY-MM-DD HH24:MI'))",
            params,
        )
        cur.connection.commit()
        nuevo = client.fetch_dicts(
            "SELECT id FROM FAT.TLIC_OPORTUNIDAD WHERE no_cia = :1 AND referencia = :2",
            [no_cia, data["referencia"]],
        )
        return nuevo[0]["id"], True


def list_oportunidades(no_cia: str, estado_portal: str | None = None) -> list[dict]:
    sql = (
        "SELECT id, referencia, tipo_proceso, entidad, titulo, estado_portal, "
        "ofertas_presentadas, ofertas_creadas, fecha_publicacion, fecha_limite "
        "FROM FAT.TLIC_OPORTUNIDAD WHERE no_cia = :1"
    )
    params = [no_cia]
    if estado_portal:
        sql += " AND estado_portal = :2"
        params.append(estado_portal)
    sql += " ORDER BY fecha_limite ASC"
    return client.fetch_dicts(sql, params)


def guardar_documento(oportunidad_id: int, tipo_documento: str, nombre_archivo: str,
                       ruta_archivo: str, estado: str = "ok") -> None:
    with client.cursor() as cur:
        cur.execute(
            "INSERT INTO FAT.TLIC_DOCUMENTO (oportunidad_id, tipo_documento, nombre_archivo, "
            "ruta_archivo, estado) VALUES (:1, :2, :3, :4, :5)",
            [oportunidad_id, tipo_documento, nombre_archivo, ruta_archivo, estado],
        )
        cur.connection.commit()


def list_documentos(oportunidad_id: int) -> list[dict]:
    return client.fetch_dicts(
        "SELECT tipo_documento, nombre_archivo, ruta_archivo, estado, descargado_en "
        "FROM FAT.TLIC_DOCUMENTO WHERE oportunidad_id = :1 ORDER BY descargado_en",
        [oportunidad_id],
    )


def guardar_rubro_pdf(no_cia: str, nombre_archivo: str, ruta_archivo: str) -> int:
    with client.cursor() as cur:
        cur.execute(
            "INSERT INTO FAT.TLIC_RUBRO_PDF (no_cia, nombre_archivo, ruta_archivo) "
            "VALUES (:1, :2, :3)",
            [no_cia, nombre_archivo, ruta_archivo],
        )
        cur.connection.commit()
    return client.fetch_dicts(
        "SELECT id FROM FAT.TLIC_RUBRO_PDF WHERE no_cia = :1 AND nombre_archivo = :2 "
        "ORDER BY id DESC FETCH FIRST 1 ROW ONLY",
        [no_cia, nombre_archivo],
    )[0]["id"]


def marcar_extraccion_rubros(rubro_pdf_id: int, estado: str, mensaje_error: str | None = None) -> None:
    with client.cursor() as cur:
        cur.execute(
            "UPDATE FAT.TLIC_RUBRO_PDF SET estado_extraccion = :1, mensaje_error = :2 WHERE id = :3",
            [estado, mensaje_error, rubro_pdf_id],
        )
        cur.connection.commit()


def guardar_rubros(rubro_pdf_id: int, rubros: list[dict]) -> None:
    with client.cursor() as cur:
        for rubro in rubros:
            cur.execute(
                "INSERT INTO FAT.TLIC_RUBRO (rubro_pdf_id, codigo, descripcion) VALUES (:1, :2, :3)",
                [rubro_pdf_id, rubro.get("codigo"), rubro["descripcion"]],
            )
        cur.connection.commit()


def list_rubros(no_cia: str) -> list[dict]:
    return client.fetch_dicts(
        "SELECT r.codigo, r.descripcion FROM FAT.TLIC_RUBRO r "
        "JOIN FAT.TLIC_RUBRO_PDF p ON p.id = r.rubro_pdf_id "
        "WHERE p.no_cia = :1 ORDER BY r.descripcion",
        [no_cia],
    )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
docker exec -it facturation_backend pytest apps/lic/tests/test_lic_repo.py -v
```

Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/apps/legacy/repositories/lic_repo.py backend/apps/lic/tests/__init__.py \
        backend/apps/lic/tests/conftest.py backend/apps/lic/tests/test_lic_repo.py \
        backend/requirements.txt
git commit -m "feat(lic): repositorio Oracle lic_repo con credenciales, oportunidades y documentos"
```

---

### Task 4: `ScrapeJob` model (sqlite, Django ORM) + migration

**Files:**
- Create: `backend/apps/lic/models.py`
- Create: `backend/apps/lic/migrations/__init__.py`
- Create: `backend/apps/lic/migrations/0001_initial.py` (generated, not hand-written)

- [ ] **Step 1: Write the model**

`backend/apps/lic/models.py`:

```python
from django.db import models


class ScrapeJob(models.Model):
    TRIGGER_CHOICES = [("auto", "auto"), ("manual", "manual")]
    ESTADO_CHOICES = [
        ("corriendo", "corriendo"),
        ("completado", "completado"),
        ("completado_con_errores", "completado_con_errores"),
        ("error", "error"),
    ]

    trigger = models.CharField(max_length=10, choices=TRIGGER_CHOICES)
    no_cia = models.CharField(max_length=2, null=True, blank=True)
    estado = models.CharField(max_length=30, choices=ESTADO_CHOICES, default="corriendo")
    iniciado_en = models.DateTimeField(auto_now_add=True)
    terminado_en = models.DateTimeField(null=True, blank=True)
    resumen = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-iniciado_en"]
```

- [ ] **Step 2: Generate the migration**

```bash
docker exec -it facturation_backend python manage.py makemigrations lic
```

Expected: `Migrations for 'lic': apps/lic/migrations/0001_initial.py - Create model ScrapeJob`.

- [ ] **Step 3: Apply it**

```bash
docker exec -it facturation_backend python manage.py migrate lic
```

Expected: `Applying lic.0001_initial... OK`.

- [ ] **Step 4: Verify with a quick shell check**

```bash
docker exec -it facturation_backend python manage.py shell -c "
from apps.lic.models import ScrapeJob
job = ScrapeJob.objects.create(trigger='manual', no_cia='01')
print(job.id, job.estado)
"
```

Expected: prints an id and `corriendo`.

- [ ] **Step 5: Commit**

```bash
git add backend/apps/lic/models.py backend/apps/lic/migrations/
git commit -m "feat(lic): modelo ScrapeJob (sqlite) para estado de corridas de scraping"
```

---

### Task 5: Playwright scraper service

**Files:**
- Create: `backend/apps/lic/services/__init__.py`
- Create: `backend/apps/lic/services/scraper.py`
- Create: `backend/apps/lic/tests/test_scraper_parsing.py`

This service drives a real browser. The row-parsing logic (turning one opportunity's HTML into a dict) is pure and testable against a captured HTML fixture; the browser-driving methods (`login`, `list_oportunidades`) are exercised by the smoke test in Task 9, not by unit tests, per the spec's testing section.

**Verified DOM structure** (captured live from the portal with `abregonza`'s credentials on 2026-07-22): each opportunity is a `div.ws_rc_wrapper.ws_rc_wrapper_opportunity` whose `onclick` attribute embeds the Ariba internal id (e.g. `OpportunityDossierUId=DO1.OPDOS.5660234`). Inside it:
- `span.ws_rc_reference` → OD reference text (e.g. `HPDEF-DAF-CM-2026-0021`)
- `span.ws_rc_state` → estado (e.g. `SELECCIÓN`)
- `span.ws_rc_businessOperationLabel` → tipo de proceso (e.g. `Contratación Menor`)
- two `span.ws_rc_description` elements, in order → título, then entidad (format `"DO,  | <entidad>"`)
- `div.ws_rc_replyCounter` (without the second class) → ofertas presentadas; `div.ws_rc_replyCounter.ws_rc_replyCounter_opportunity` → ofertas creadas
- `div.ws_rc_datesContainer` with pairs of `span.ws_rc_dateLabel` (`"Fecha límite:"` / `"Publicado:"`) + `span.ws_rc_date` (e.g. `28/07/2026 11:00`)

The status filter is a real `<select>` with options `Todos/Nuevo/Visualizadas/Invitado/Activo/Sin ofertas/Con ofertas` — usable directly with Playwright's `select_option`.

The document-download flow (opening an opportunity's "Detalle" work area and finding the attached PDFs) was **not** fully mapped during design — that page opens in a separate tab and needs live inspection with the same devtools technique used above. Step 4 of this task covers that inspection explicitly; don't skip it.

- [ ] **Step 1: Write the failing test for row parsing**

`backend/apps/lic/services/__init__.py`: empty file.

`backend/apps/lic/tests/test_scraper_parsing.py`:

```python
from apps.lic.services.scraper import parse_oportunidad_row_html

SAMPLE_ROW_HTML = '''
<div class="ws_rc_wrapper ws_rc_wrapper_opportunity" onclick="javascript:getAction('/DO1BusinessLine/Tendering/OpportunityDossierWorkspace/SelectOpportunityDossier' + '?' + 'OpportunityDossierUId=' + 'DO1.OPDOS.5660234' + '&amp;mkey=90a02203_fe0e_4b8b_b145_7a6513e8ae4d',true);selectWSElement(this);" align="left">
  <div class="ws_rc_topLeft" style="width:60%;" align="left">
    <span class="ws_rc_reference ws_ellipsis" title="HPDEF-DAF-CM-2026-0021">HPDEF-DAF-CM-2026-0021</span>
  </div>
  <div class="ws_rc_topRight ws_ellipsis" align="left">
    <span class="ws_rc_state ws_rc_opportunityDossierActive" title="SELECCIÓN">SELECCIÓN</span>
    <span class="ws_rc_businessOperationLabel ws_ellipsis" title="Contratación Menor">Contratación Menor</span>
  </div>
  <div class="ws_rc_topLeft" style="width:80%" align="left">
    <span class="ws_rc_description ws_ellipsis" title="ADQUISICION DE AIRE ACONDICIONADO, TV E IMPRESORA">ADQUISICION DE AIRE ACONDICIONADO, TV E IMPRESORA</span>
    <span class="ws_rc_description ws_ellipsis" title="DO,  | Hospital Provincial Dr. Elio Fiallo">DO,  | Hospital Provincial Dr. Elio Fiallo</span>
  </div>
  <div class="ws_rc_replyCounter" title="Ofertas presentadas " align="left"><span class="VortalSpan">0</span></div>
  <div class="ws_rc_replyCounter ws_rc_replyCounter_opportunity" title="Ofertas creadas" align="left"><span class="VortalSpan">1</span></div>
  <div class="ws_rc_datesContainer" align="left">
    <span class="ws_rc_dateLabel">Fecha límite:</span><span class="ws_rc_date">28/07/2026 11:00&nbsp;</span>
    <span class="ws_rc_dateLabel">Publicado:</span><span class="ws_rc_date">21/07/2026 14:40</span>
  </div>
</div>
'''


def test_parse_oportunidad_row_extracts_all_fields():
    result = parse_oportunidad_row_html(SAMPLE_ROW_HTML)
    assert result == {
        "referencia": "HPDEF-DAF-CM-2026-0021",
        "opportunity_uid": "DO1.OPDOS.5660234",
        "estado_portal": "SELECCIÓN",
        "tipo_proceso": "Contratación Menor",
        "titulo": "ADQUISICION DE AIRE ACONDICIONADO, TV E IMPRESORA",
        "entidad": "Hospital Provincial Dr. Elio Fiallo",
        "ofertas_presentadas": 0,
        "ofertas_creadas": 1,
        "fecha_limite": "2026-07-28 11:00",
        "fecha_publicacion": "2026-07-21 14:40",
    }
```

- [ ] **Step 2: Run to verify it fails**

```bash
docker exec -it facturation_backend pytest apps/lic/tests/test_scraper_parsing.py -v
```

Expected: `ModuleNotFoundError: No module named 'apps.lic.services'` (or `playwright` import error — install it first per Task 9's requirements.txt change, or temporarily add it now so this task's imports resolve: `docker exec -it facturation_backend pip install playwright beautifulsoup4`).

- [ ] **Step 3: Implement the parsing function and the scraper class**

```python
"""Scraper del portal DGCP (SAP Ariba) vía Playwright."""
from __future__ import annotations

import re
from datetime import datetime

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

LOGIN_URL = "https://comunidad.comprasdominicana.gob.do/STS/DGCP/Login.aspx"
OPORTUNIDADES_URL = (
    "https://portal.comprasdominicana.gob.do/DO1BusinessLine/Tendering/"
    "OpportunityDossierWorkspace/Index"
)

_UID_RE = re.compile(r"OpportunityDossierUId=' \+ '([\w.]+)'|OpportunityDossierUId=([\w.]+)")


def _parse_fecha(texto: str) -> str | None:
    texto = texto.replace("\xa0", "").strip()
    if not texto:
        return None
    dt = datetime.strptime(texto, "%d/%m/%Y %H:%M")
    return dt.strftime("%Y-%m-%d %H:%M")


def parse_oportunidad_row_html(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    wrapper = soup.select_one(".ws_rc_wrapper_opportunity") or soup

    onclick = wrapper.get("onclick", "")
    uid_match = re.search(r"OpportunityDossierUId=' \+ '([\w.]+)'", onclick)
    opportunity_uid = uid_match.group(1) if uid_match else None

    descripciones = wrapper.select(".ws_rc_description")
    titulo = descripciones[0]["title"].strip() if len(descripciones) > 0 else None
    entidad_raw = descripciones[1]["title"].strip() if len(descripciones) > 1 else ""
    entidad = entidad_raw.split("|", 1)[-1].strip() if "|" in entidad_raw else entidad_raw

    contadores = wrapper.select(".ws_rc_replyCounter")
    ofertas_presentadas = int(contadores[0].select_one(".VortalSpan").text.strip()) if contadores else 0
    ofertas_creadas = 0
    for div in contadores:
        if "ws_rc_replyCounter_opportunity" in div.get("class", []):
            ofertas_creadas = int(div.select_one(".VortalSpan").text.strip())

    fechas = {}
    labels = wrapper.select(".ws_rc_dateLabel")
    values = wrapper.select(".ws_rc_date")
    for label, value in zip(labels, values):
        fechas[label.text.strip()] = _parse_fecha(value.text)

    return {
        "referencia": wrapper.select_one(".ws_rc_reference")["title"].strip(),
        "opportunity_uid": opportunity_uid,
        "estado_portal": wrapper.select_one(".ws_rc_state")["title"].strip(),
        "tipo_proceso": wrapper.select_one(".ws_rc_businessOperationLabel")["title"].strip(),
        "titulo": titulo,
        "entidad": entidad,
        "ofertas_presentadas": ofertas_presentadas,
        "ofertas_creadas": ofertas_creadas,
        "fecha_limite": fechas.get("Fecha límite:"),
        "fecha_publicacion": fechas.get("Publicado:"),
    }


class LoginError(Exception):
    pass


class LicitacionesScraper:
    """Una instancia = una sesión de navegador para una empresa."""

    def __init__(self, headless: bool = True):
        self._headless = headless
        self._playwright = None
        self._browser = None
        self._page = None

    def __enter__(self) -> "LicitacionesScraper":
        self._playwright = sync_playwright().start()
        self._browser = self._playwright.chromium.launch(headless=self._headless)
        self._page = self._browser.new_page()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._browser:
            self._browser.close()
        if self._playwright:
            self._playwright.stop()

    def login(self, usuario: str, password: str) -> None:
        page = self._page
        page.goto(LOGIN_URL)
        page.get_by_role("textbox", name="Nombre de usuario").fill(usuario)
        page.get_by_role("textbox", name="Contraseña").fill(password)
        page.get_by_role("button", name="Entrar").click()
        page.wait_for_load_state("networkidle")
        if "Login.aspx" in page.url:
            raise LoginError("Su intento de entrada no se proceso con éxito")

    def list_oportunidades(self, estado_filtro: str = "Todos") -> list[dict]:
        page = self._page
        page.goto(OPORTUNIDADES_URL)
        page.wait_for_load_state("networkidle")
        select = page.locator("select").first
        select.select_option(label=estado_filtro)
        page.wait_for_load_state("networkidle")

        wrappers = page.locator(".ws_rc_wrapper_opportunity")
        count = wrappers.count()
        resultados = []
        for i in range(count):
            html = wrappers.nth(i).evaluate("el => el.outerHTML")
            resultados.append(parse_oportunidad_row_html(html))
        return resultados
```

- [ ] **Step 4: Manually inspect the document-download flow before writing `download_documentos`**

This step is investigative, not code — do it with an authenticated Playwright/browser session (same approach used during design):

1. Open an opportunity's "Detalle" link (`OpportunityDossierWorkspaceDetail/RedirectToWorkAreaInNewWindow?mkey=...`) — it opens a new tab/window; capture it in Playwright with `context.expect_page()`.
2. On that work-area page, locate the documents/attachments section (likely a "Documentos" tab in the Ariba sourcing event workspace) and record the real CSS selectors and the download mechanism (direct `<a href>` to a file, or a JS `getAction(...)` call that triggers a download) — the same way `.ws_rc_wrapper_opportunity` was found for the list view.
3. Only after that inspection, add a `download_documentos(self, referencia: str, destino_dir: Path) -> list[dict]` method to `LicitacionesScraper` using the confirmed selectors, returning `[{"tipo_documento": ..., "nombre_archivo": ..., "ruta_archivo": ...}, ...]`.

Do not fabricate selectors for this method — this step exists precisely because that part of the DOM wasn't captured during design.

- [ ] **Step 5: Run the parsing test to verify it passes**

```bash
docker exec -it facturation_backend pytest apps/lic/tests/test_scraper_parsing.py -v
```

Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/apps/lic/services/__init__.py backend/apps/lic/services/scraper.py \
        backend/apps/lic/tests/test_scraper_parsing.py
git commit -m "feat(lic): scraper Playwright con parsing verificado del feed Oportunidades"
```

---

### Task 6: PDF rubro extraction service

**Files:**
- Create: `backend/apps/lic/services/pdf_rubros.py`
- Create: `backend/apps/lic/tests/test_pdf_rubros.py`

- [ ] **Step 1: Write the failing test**

```python
from unittest.mock import patch

from apps.lic.services.pdf_rubros import structurar_rubros_desde_texto


def test_structurar_rubros_parses_claude_json_response():
    fake_response_text = (
        '[{"codigo": "72101500", "descripcion": "Reparación de equipos electrónicos"}, '
        '{"codigo": "72141500", "descripcion": "Mantenimiento de aires acondicionados"}]'
    )
    with patch("apps.lic.services.pdf_rubros._llamar_claude", return_value=fake_response_text):
        rubros = structurar_rubros_desde_texto("texto extraido del pdf de rpe...")
    assert rubros == [
        {"codigo": "72101500", "descripcion": "Reparación de equipos electrónicos"},
        {"codigo": "72141500", "descripcion": "Mantenimiento de aires acondicionados"},
    ]


def test_structurar_rubros_returns_empty_list_on_malformed_response():
    with patch("apps.lic.services.pdf_rubros._llamar_claude", return_value="no es json"):
        rubros = structurar_rubros_desde_texto("texto")
    assert rubros == []
```

- [ ] **Step 2: Run to verify it fails**

```bash
docker exec -it facturation_backend pytest apps/lic/tests/test_pdf_rubros.py -v
```

Expected: `ModuleNotFoundError: No module named 'apps.lic.services.pdf_rubros'`.

- [ ] **Step 3: Implement it**

```python
"""Extracción de rubros RPE desde el PDF del certificado, con IA para estructurar."""
import json

import anthropic
from django.conf import settings
from pypdf import PdfReader


def extraer_texto_pdf(ruta_archivo: str) -> str:
    reader = PdfReader(ruta_archivo)
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _llamar_claude(texto_pdf: str) -> str:
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    mensaje = client.messages.create(
        model=settings.ASISTENTE_DEFAULT_MODEL,
        max_tokens=2000,
        messages=[{
            "role": "user",
            "content": (
                "Este es el texto extraído de un certificado de Registro de Proveedores del "
                "Estado (RPE) de República Dominicana. Devuelve SOLO un array JSON (sin texto "
                "adicional) con los rubros/categorías en los que la empresa está registrada, "
                "formato [{\"codigo\": \"...\", \"descripcion\": \"...\"}]. "
                f"Texto:\n\n{texto_pdf}"
            ),
        }],
    )
    return mensaje.content[0].text


def structurar_rubros_desde_texto(texto_pdf: str) -> list[dict]:
    respuesta = _llamar_claude(texto_pdf)
    try:
        rubros = json.loads(respuesta)
    except (json.JSONDecodeError, TypeError):
        return []
    if not isinstance(rubros, list):
        return []
    return [r for r in rubros if isinstance(r, dict) and "descripcion" in r]
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
docker exec -it facturation_backend pytest apps/lic/tests/test_pdf_rubros.py -v
```

Expected: 2 passed.

- [ ] **Step 5: Add `pypdf` to requirements and commit**

```bash
git add backend/apps/lic/services/pdf_rubros.py backend/apps/lic/tests/test_pdf_rubros.py \
        backend/requirements.txt
git commit -m "feat(lic): extraccion de rubros RPE desde PDF (pypdf + Claude)"
```

---

### Task 7: Orchestrator (shared by cron and manual trigger)

**Files:**
- Create: `backend/apps/lic/services/orchestrator.py`
- Create: `backend/apps/lic/tests/test_orchestrator.py`

> **Nota post-implementación (2026-07-22):** el borrador original de este task (Steps 1-3
> abajo) solo llamaba a `scraper.list_oportunidades()` y `lic_repo.upsert_oportunidad()` —
> nunca a `scraper.download_documentos()`, pese a que Task 5 lo construyó específicamente para
> esto. Se corrigió durante la implementación real: por cada oportunidad **nueva** se llama
> `download_documentos()` (Task 5) y cada documento se persiste con
> `lic_repo.guardar_documento()`. Además, al inspeccionar `download_documentos()` real y el DDL
> de `FAT.TLIC_DOCUMENTO` (`backend/apps/lic/sql/001_create_tlic.sql`), se encontró que
> `NOMBRE_ARCHIVO` y `RUTA_ARCHIVO` son `NOT NULL` (y Oracle trata `''` como NULL), mientras que
> las entradas con `estado: "error"` que devuelve `download_documentos()` traen esos dos campos
> en `None` — el orquestador sustituye esos casos por un placeholder no vacío antes de llamar a
> `guardar_documento()` para no romper el insert con ORA-01400. El código y los tests reales
> (5, no 2) quedan documentados abajo en vez de los originales.

> **Nota post-review de código (2026-07-22, commit `4593a2a` → fix posterior):** una revisión
> de calidad de ese primer commit encontró 3 issues Important + 1 Minor, todos corregidos en
> el mismo día en un commit separado (no un amend):
> 1. **Aislamiento por documento en la persistencia:** cada llamada a
>    `lic_repo.guardar_documento()` ahora tiene su propio try/except dentro del loop de
>    `_descargar_y_guardar_documentos` — antes, si el INSERT del documento N fallaba (p.ej.
>    ORA-12899), la excepción escapaba sin capturar hasta el `except Exception` a nivel de
>    empresa, saltándose en silencio todos los documentos/oportunidades restantes de esa
>    corrida para esa empresa.
> 2. **Reintento cuando quedan cero documentos:** se agregó `lic_repo.tiene_documentos(id) ->
>    bool` (`SELECT COUNT(*) ... WHERE oportunidad_id = :1`). Antes, `es_nueva` (derivado solo
>    de si la fila ya existía en `TLIC_OPORTUNIDAD`) decidía si se llamaba a
>    `download_documentos` — así que si esa llamada fallaba por completo (excepción, no una
>    fila individual) en el primer avistamiento de una oportunidad, esta quedaba marcada como
>    "no nueva" en la próxima corrida y sus documentos NUNCA se reintentaban. La condición pasó
>    de `if not es_nueva: continue` a `if not es_nueva and lic_repo.tiene_documentos(id):
>    continue` — una oportunidad ya vista pero sin documentos guardados se reintenta.
> 3. **`resumen["errores"]` estructurado:** pasó de ser un `dict` con claves ambiguas (`no_cia`
>    plano para errores de empresa, `"no_cia:referencia:documentos"` concatenado con `:` para
>    errores de documentos — inseguro si algún valor real trajera `:`, y consumido
>    directamente por el endpoint de status de Task 13) a una `list[dict]` con
>    `{"no_cia", "referencia", "contexto", "mensaje"}` (`contexto` ∈
>    `"credencial"|"login"|"empresa"|"documentos"|"persistencia"`; `referencia` es `None` para
>    errores a nivel de empresa). El chequeo "¿hubo errores?" (`resumen["errores"]` truthy →
>    `completado_con_errores`) sigue funcionando igual porque una lista vacía también es
>    falsy.
> 4. **Columna `MENSAJE_ERROR` real:** se agregó `ALTER TABLE FAT.TLIC_DOCUMENTO ADD
>    MENSAJE_ERROR VARCHAR2(1000);` (mismo patrón que `TLIC_RUBRO_PDF.MENSAJE_ERROR`), ejecutado
>    en vivo contra Oracle vía `client.execute(...)` desde un shell de Django dentro del
>    contenedor (no hay `sqlplus` en el VM ni en el contenedor; `apps/legacy/client.py` usa
>    `oracledb` en modo thick con DSN `10.0.0.51:1521/AB`). `lic_repo.guardar_documento()` ahora
>    acepta `mensaje_error: str | None = None` y lo pasa como sexto bind. `ruta_archivo` y
>    `nombre_archivo` dejaron de sobrecargarse con el texto del error (que además arriesgaba
>    truncar con ORA-12899 contra `VARCHAR2(500)`, un fallo no protegido que agravaba el issue
>    #1) — ambos quedan con el placeholder corto `"(descarga fallida)"` y el mensaje real va
>    solo a `MENSAJE_ERROR`. Verificado en vivo contra Oracle real (no solo mocks): insert +
>    `tiene_documentos()` + limpieza, sin dejar filas huérfanas.
>
> El código, los tests (8, no 5) y el DDL reales quedan documentados abajo en vez de la
> primera corrección.

- [ ] **Step 1: Write the failing test**

See `backend/apps/lic/tests/test_orchestrator.py` for the real, current file (8 tests) — too
long to duplicate here twice over two rounds of fixes without drifting from the source of
truth. Summary of the 8 tests: `marks_job_completado_when_no_errors`,
`marks_job_con_errores_when_login_fails`, `marks_job_con_errores_when_credencial_missing`,
`does_not_download_documents_for_existing_oportunidad_con_documentos`,
`retries_documents_for_previously_seen_oportunidad_without_documents` (new, covers fix #2),
`continues_when_document_download_fails`,
`uses_placeholder_and_mensaje_error_for_failed_document_entry` (updated for fix #4),
`continues_when_guardar_documento_fails_for_one_document` (new, covers fix #1).

- [ ] **Step 2: Run to verify it fails**

```bash
docker exec -it facturation_backend pytest apps/lic/tests/test_orchestrator.py -v
```

Expected: `ModuleNotFoundError: No module named 'apps.lic.services.orchestrator'`. (Verificado en vivo el 2026-07-22.)

- [ ] **Step 3: Implement it**

Final version (post code-review fixes) — see `backend/apps/lic/services/orchestrator.py` for
the source of truth. Structure:

```python
"""Orquesta una corrida de scraping: usado tanto por el comando de cron como por el
endpoint de 'Buscar ahora'."""
from __future__ import annotations

from pathlib import Path

from django.conf import settings
from django.utils import timezone

from apps.fe import crypto
from apps.legacy.repositories import lic_repo
from apps.lic.models import ScrapeJob
from apps.lic.services.scraper import LicitacionesScraper, LoginError


def ejecutar_scrape(job: ScrapeJob, empresas: list[str]) -> None:
    resumen = {
        "oportunidades_nuevas": 0,
        "documentos_descargados": 0,
        "empresas_procesadas": [],
        "errores": [],  # list[dict]: {no_cia, referencia, contexto, mensaje}
    }

    for no_cia in empresas:
        credencial = lic_repo.get_credencial_con_password(no_cia)
        if not credencial:
            _agregar_error(resumen, no_cia, "sin credencial configurada", contexto="credencial")
            continue

        try:
            password = crypto.decrypt(credencial["password_cifrado"])
            with LicitacionesScraper() as scraper:
                scraper.login(credencial["usuario_portal"], password)
                lic_repo.marcar_login_resultado(no_cia, ok=True)
                oportunidades = scraper.list_oportunidades()
                for data in oportunidades:
                    oportunidad_id, es_nueva = lic_repo.upsert_oportunidad(no_cia, data)
                    # Reintentar si quedó sin documentos guardados (fallo total previo).
                    if not es_nueva and lic_repo.tiene_documentos(oportunidad_id):
                        continue
                    if es_nueva:
                        resumen["oportunidades_nuevas"] += 1
                    _descargar_y_guardar_documentos(
                        scraper, no_cia, data["referencia"], oportunidad_id, resumen
                    )
            resumen["empresas_procesadas"].append(no_cia)
        except LoginError as exc:
            lic_repo.marcar_login_resultado(no_cia, ok=False, mensaje_error=str(exc))
            _agregar_error(resumen, no_cia, str(exc), contexto="login")
        except Exception as exc:  # noqa: BLE001 - se registra y se sigue con las demás empresas
            _agregar_error(resumen, no_cia, str(exc), contexto="empresa")

    job.resumen = resumen
    job.estado = "completado_con_errores" if resumen["errores"] else "completado"
    job.terminado_en = timezone.now()
    job.save()


def _agregar_error(resumen, no_cia, mensaje, *, referencia=None, contexto):
    resumen["errores"].append(
        {"no_cia": no_cia, "referencia": referencia, "contexto": contexto, "mensaje": mensaje}
    )


def _descargar_y_guardar_documentos(scraper, no_cia, referencia, oportunidad_id, resumen):
    destino_dir = Path(settings.MEDIA_ROOT) / "lic" / no_cia / referencia
    try:
        documentos = scraper.download_documentos(referencia, destino_dir)
    except Exception as exc:  # noqa: BLE001 - un fallo de documentos no debe tumbar la empresa
        _agregar_error(resumen, no_cia, str(exc), referencia=referencia, contexto="documentos")
        return

    for doc in documentos:
        estado = doc.get("estado", "ok")
        nombre_archivo = doc.get("nombre_archivo") or "(descarga fallida)"
        ruta_archivo = doc.get("ruta_archivo") or "(descarga fallida)"
        mensaje_error = doc.get("error") if estado == "error" else None
        try:
            lic_repo.guardar_documento(
                oportunidad_id, doc.get("tipo_documento"), nombre_archivo, ruta_archivo,
                estado=estado, mensaje_error=mensaje_error,
            )
        except Exception as exc:  # noqa: BLE001 - un documento no debe tumbar los demás
            _agregar_error(resumen, no_cia, str(exc), referencia=referencia, contexto="persistencia")
            continue
        if estado == "ok":
            resumen["documentos_descargados"] += 1
```

Companion changes made in the same fix:
- `backend/apps/legacy/repositories/lic_repo.py`: `guardar_documento(...)` gained
  `mensaje_error: str | None = None` (6th bind, inserted into the new column);
  `list_documentos(...)` now also selects `mensaje_error`; added
  `tiene_documentos(oportunidad_id: int) -> bool` (`SELECT COUNT(*) FROM
  FAT.TLIC_DOCUMENTO WHERE oportunidad_id = :1`).
- `backend/apps/lic/sql/001_create_tlic.sql`: appended (not rewritten — table was already
  live) `ALTER TABLE FAT.TLIC_DOCUMENTO ADD MENSAJE_ERROR VARCHAR2(1000);`, run live against
  Oracle via `docker exec facturation_backend python manage.py shell -c "from
  apps.legacy.client import execute; execute('ALTER TABLE FAT.TLIC_DOCUMENTO ADD
  MENSAJE_ERROR VARCHAR2(1000)')"` (no `sqlplus` available on the VM or in the container;
  `apps/legacy/client.py` uses `oracledb` thick mode against DSN `10.0.0.51:1521/AB`).
  Verified afterward with a live insert/read/cleanup smoke test (not just mocks) using
  `lic_repo.guardar_documento`/`tiene_documentos` directly against Oracle, no orphaned rows
  left behind.

- [ ] **Step 4: Run tests to verify they pass**

```bash
docker exec -it facturation_backend pytest apps/lic/ -v
```

First round (commit `4593a2a`): `apps/lic/tests/test_orchestrator.py .....  [100%]`, 5
passed. Full `apps/lic/` suite: 23 passed.

Second round, after the 4 code-review fixes above: `apps/lic/tests/test_orchestrator.py
........  [30%]`, 8 passed (3 new tests: credencial-missing, retry-on-zero-documents,
per-document-persistence-failure-isolation; 2 existing tests updated for the structured
`errores` list and `mensaje_error`). Full `apps/lic/` suite re-run: **26 passed**, no
regressions in `test_lic_repo.py` (8)/`test_pdf_rubros.py` (8)/`test_scraper_parsing.py` (2).

- [ ] **Step 5: Commit**

```bash
# First commit (Task 7 base implementation):
git add backend/apps/lic/services/orchestrator.py backend/apps/lic/tests/test_orchestrator.py \
        backend/docs/superpowers/plans/2026-07-22-lic-portal-integracion.md
git commit -m "feat(lic): orquestador de scraping con descarga de documentos para oportunidades nuevas"

# Second commit, same day, after the code-review fixes (NOT an amend):
git add backend/apps/lic/services/orchestrator.py backend/apps/lic/tests/test_orchestrator.py \
        backend/apps/legacy/repositories/lic_repo.py backend/apps/lic/sql/001_create_tlic.sql \
        backend/docs/superpowers/plans/2026-07-22-lic-portal-integracion.md
git commit -m "fix(lic): aislar fallos por documento, permitir reintento y estructurar errores en orquestador"
```

---

### Task 8: Management command for the daily cron

**Files:**
- Create: `backend/apps/lic/management/__init__.py`
- Create: `backend/apps/lic/management/commands/__init__.py`
- Create: `backend/apps/lic/management/commands/scrape_licitaciones.py`

- [ ] **Step 1: Implement the command**

```python
"""Comando diario (via cron) que corre el scraping para todas las empresas activas.

Idempotente: si ya hubo una corrida automática completada hoy, no vuelve a correr
(protege contra doble ejecución si el proceso ASGI se reinicia/duplica)."""
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.legacy.repositories import lic_repo
from apps.lic.models import ScrapeJob
from apps.lic.services.orchestrator import ejecutar_scrape


class Command(BaseCommand):
    help = "Corre el scraping diario de licitaciones para todas las empresas con credencial activa"

    def handle(self, *args, **options):
        hoy = timezone.now().date()
        ya_corrio_hoy = ScrapeJob.objects.filter(
            trigger="auto",
            iniciado_en__date=hoy,
            estado__in=["completado", "completado_con_errores"],
        ).exists()
        if ya_corrio_hoy:
            self.stdout.write("Ya hubo una corrida automática hoy, se omite.")
            return

        empresas = [c["no_cia"] for c in lic_repo.list_credenciales() if c["estado"] == "activo"]
        if not empresas:
            self.stdout.write("No hay empresas con credencial activa.")
            return

        job = ScrapeJob.objects.create(trigger="auto")
        ejecutar_scrape(job, empresas)
        self.stdout.write(f"Corrida {job.id} terminada con estado {job.estado}: {job.resumen}")
```

- [ ] **Step 2: Verify it runs (dry run with no credentials configured yet)**

```bash
docker exec -it facturation_backend python manage.py scrape_licitaciones
```

Expected: `No hay empresas con credencial activa.` (since Task 3's tables are empty at this point).

- [ ] **Step 3: Commit**

```bash
git add backend/apps/lic/management/
git commit -m "feat(lic): comando scrape_licitaciones para la corrida diaria"
```

---

### Task 9: Docker/requirements changes — Playwright + cron in the container

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/Dockerfile.dev`
- Create: `backend/docker/entrypoint.sh`
- Create: `backend/docker/crontab-lic`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add Python dependencies**

In `backend/requirements.txt`, add these lines (keeping the rest as-is):

```
playwright>=1.48
pypdf>=5.0
beautifulsoup4>=4.12
pytest-mock>=3.14
```

- [ ] **Step 2: Install Playwright's browser + cron in the image**

In `backend/Dockerfile.dev`, after the existing `apt-get install` block that installs `build-essential curl unzip libaio*`, add `cron` to that same list:

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
        unzip \
        cron \
        $(apt-cache show libaio1t64 >/dev/null 2>&1 && echo libaio1t64 || echo libaio1) \
    && rm -rf /var/lib/apt/lists/*
```

After the `RUN pip install --upgrade pip && pip install -r requirements.txt` line, add:

```dockerfile
RUN playwright install --with-deps chromium
```

Replace the final `CMD` line with an entrypoint that starts cron alongside uvicorn:

```dockerfile
COPY docker/entrypoint.sh /entrypoint.sh
COPY docker/crontab-lic /etc/cron.d/lic-cron
RUN chmod +x /entrypoint.sh && chmod 0644 /etc/cron.d/lic-cron && crontab /etc/cron.d/lic-cron

ENTRYPOINT ["/entrypoint.sh"]
CMD ["uvicorn", "facturation_api.asgi:application", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

- [ ] **Step 3: Write the entrypoint and crontab**

`backend/docker/entrypoint.sh`:

```bash
#!/bin/sh
set -e
cron
exec "$@"
```

`backend/docker/crontab-lic` (runs daily at 05:30 server time; must end with a blank line, standard cron file requirement):

```
30 5 * * * root cd /app && python manage.py scrape_licitaciones >> /app/data/lic-cron.log 2>&1

```

- [ ] **Step 4: Rebuild and verify**

```bash
docker compose build backend
docker compose up -d backend
docker exec -it facturation_backend playwright --version
docker exec -it facturation_backend crontab -l
```

Expected: a Playwright version string, and the crontab line shown as installed.

- [ ] **Step 5: Commit**

```bash
git add backend/requirements.txt backend/Dockerfile.dev backend/docker/entrypoint.sh \
        backend/docker/crontab-lic docker-compose.yml
git commit -m "feat(lic): instalar Playwright/cron en el contenedor backend para el scraping diario"
```

---

### Task 10: Views + URL wiring

**Files:**
- Modify: `backend/apps/lic/urls.py`
- Create: `backend/apps/lic/views.py`

- [ ] **Step 1: Implement the views**

```python
"""Vistas planas (sin DRF), mismo estilo que apps/fe/views.py."""
import json
import threading
from pathlib import Path

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.fe import crypto
from apps.legacy.repositories import lic_repo
from apps.lic.models import ScrapeJob
from apps.lic.services import pdf_rubros
from apps.lic.services.orchestrator import ejecutar_scrape


def _err(msg: str, status: int = 400) -> JsonResponse:
    return JsonResponse({"error": msg}, status=status)


@login_required
@csrf_exempt
@require_http_methods(["GET", "POST"])
def credenciales_view(request):
    if request.method == "GET":
        return JsonResponse({"credenciales": lic_repo.list_credenciales()})

    data = json.loads(request.body or b"{}")
    no_cia = data.get("no_cia")
    usuario = data.get("usuario_portal")
    password = data.get("password")
    if not no_cia or not usuario or not password:
        return _err("no_cia, usuario_portal y password son requeridos")
    lic_repo.upsert_credencial(no_cia, usuario, crypto.encrypt(password))
    return JsonResponse({"credencial": lic_repo.get_credencial(no_cia)})


@login_required
@csrf_exempt
@require_http_methods(["POST"])
def probar_conexion_view(request):
    from apps.lic.services.scraper import LicitacionesScraper, LoginError

    data = json.loads(request.body or b"{}")
    no_cia = data.get("no_cia")
    credencial = lic_repo.get_credencial_con_password(no_cia)
    if not credencial:
        return _err("No hay credencial configurada para esta empresa", status=404)

    password = crypto.decrypt(credencial["password_cifrado"])
    try:
        with LicitacionesScraper() as scraper:
            scraper.login(credencial["usuario_portal"], password)
        lic_repo.marcar_login_resultado(no_cia, ok=True)
        return JsonResponse({"ok": True})
    except LoginError as exc:
        lic_repo.marcar_login_resultado(no_cia, ok=False, mensaje_error=str(exc))
        return _err(str(exc), status=401)


@login_required
@csrf_exempt
@require_http_methods(["POST"])
def rubros_pdf_view(request):
    no_cia = request.POST.get("no_cia")
    archivo = request.FILES.get("archivo")
    if not no_cia or not archivo:
        return _err("no_cia y archivo son requeridos")

    destino = Path(settings.MEDIA_ROOT) / "lic" / no_cia / "rubros"
    destino.mkdir(parents=True, exist_ok=True)
    ruta_archivo = destino / archivo.name
    with open(ruta_archivo, "wb") as f:
        for chunk in archivo.chunks():
            f.write(chunk)

    rubro_pdf_id = lic_repo.guardar_rubro_pdf(no_cia, archivo.name, str(ruta_archivo))
    try:
        texto = pdf_rubros.extraer_texto_pdf(str(ruta_archivo))
        rubros = pdf_rubros.structurar_rubros_desde_texto(texto)
        lic_repo.guardar_rubros(rubro_pdf_id, rubros)
        lic_repo.marcar_extraccion_rubros(rubro_pdf_id, "hecho")
    except Exception as exc:  # noqa: BLE001
        lic_repo.marcar_extraccion_rubros(rubro_pdf_id, "error", str(exc))
        return _err(f"Error al extraer rubros: {exc}", status=500)

    return JsonResponse({"rubros": lic_repo.list_rubros(no_cia)})


@login_required
@require_http_methods(["GET"])
def oportunidades_view(request):
    no_cia = request.GET.get("no_cia")
    estado = request.GET.get("estado")
    if not no_cia:
        return _err("no_cia es requerido")
    return JsonResponse({"oportunidades": lic_repo.list_oportunidades(no_cia, estado)})


@login_required
@require_http_methods(["GET"])
def documentos_view(request, oportunidad_id: int):
    return JsonResponse({"documentos": lic_repo.list_documentos(oportunidad_id)})


@login_required
@csrf_exempt
@require_http_methods(["POST"])
def scrape_view(request):
    data = json.loads(request.body or b"{}")
    no_cia = data.get("no_cia")
    empresas = [no_cia] if no_cia else [
        c["no_cia"] for c in lic_repo.list_credenciales() if c["estado"] == "activo"
    ]
    if not empresas:
        return _err("No hay empresas con credencial activa")

    job = ScrapeJob.objects.create(trigger="manual", no_cia=no_cia)
    thread = threading.Thread(target=ejecutar_scrape, args=(job, empresas), daemon=True)
    thread.start()
    return JsonResponse({"job_id": job.id})


@login_required
@require_http_methods(["GET"])
def scrape_job_view(request, job_id: int):
    try:
        job = ScrapeJob.objects.get(id=job_id)
    except ScrapeJob.DoesNotExist:
        return _err("Job no encontrado", status=404)
    return JsonResponse({
        "id": job.id,
        "estado": job.estado,
        "iniciado_en": job.iniciado_en.isoformat(),
        "terminado_en": job.terminado_en.isoformat() if job.terminado_en else None,
        "resumen": job.resumen,
    })
```

- [ ] **Step 2: Wire the URLs**

`backend/apps/lic/urls.py`:

```python
from django.urls import path

from apps.lic import views

urlpatterns = [
    path("credenciales/", views.credenciales_view),
    path("credenciales/probar-conexion/", views.probar_conexion_view),
    path("rubros-pdf/", views.rubros_pdf_view),
    path("oportunidades/", views.oportunidades_view),
    path("oportunidades/<int:oportunidad_id>/documentos/", views.documentos_view),
    path("scrape/", views.scrape_view),
    path("scrape/<int:job_id>/", views.scrape_job_view),
]
```

- [ ] **Step 3: Verify routing**

```bash
docker exec -it facturation_backend python manage.py check
```

Expected: no issues.

- [ ] **Step 4: Commit**

```bash
git add backend/apps/lic/urls.py backend/apps/lic/views.py
git commit -m "feat(lic): endpoints de credenciales, rubros PDF, oportunidades y scrape"
```

---

### Task 11: Frontend — API hooks

**Files:**
- Create: `frontend/src/features/lic/api.ts`

- [ ] **Step 1: Write the hooks file**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const BASE = '/api/lic'

export interface Credencial {
  no_cia: string
  usuario_portal: string
  estado: 'activo' | 'error_login'
  ultimo_login_ok: string | null
  ultimo_error: string | null
}

export interface Oportunidad {
  id: number
  referencia: string
  tipo_proceso: string | null
  entidad: string | null
  titulo: string | null
  estado_portal: string | null
  ofertas_presentadas: number
  ofertas_creadas: number
  fecha_publicacion: string | null
  fecha_limite: string | null
}

export interface Documento {
  tipo_documento: string | null
  nombre_archivo: string
  ruta_archivo: string
  estado: string
  descargado_en: string
}

export interface Rubro {
  codigo: string | null
  descripcion: string
}

export interface ScrapeJobStatus {
  id: number
  estado: 'corriendo' | 'completado' | 'completado_con_errores' | 'error'
  iniciado_en: string
  terminado_en: string | null
  resumen: Record<string, unknown>
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error || 'Error de red')
  }
  return res.json()
}

export function useCredenciales() {
  return useQuery({
    queryKey: ['lic-credenciales'],
    queryFn: () => fetchJson<{ credenciales: Credencial[] }>(`${BASE}/credenciales/`),
  })
}

export function useGuardarCredencial() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { no_cia: string; usuario_portal: string; password: string }) =>
      fetchJson(`${BASE}/credenciales/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lic-credenciales'] }),
  })
}

export function useProbarConexion() {
  return useMutation({
    mutationFn: (no_cia: string) =>
      fetchJson(`${BASE}/credenciales/probar-conexion/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_cia }),
      }),
  })
}

export function useRubros(no_cia: string) {
  return useQuery({
    queryKey: ['lic-rubros', no_cia],
    queryFn: () => fetchJson<{ rubros: Rubro[] }>(`${BASE}/rubros-pdf/?no_cia=${no_cia}`),
    enabled: !!no_cia,
  })
}

export function useSubirRubrosPdf() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { no_cia: string; archivo: File }) => {
      const form = new FormData()
      form.append('no_cia', payload.no_cia)
      form.append('archivo', payload.archivo)
      return fetchJson<{ rubros: Rubro[] }>(`${BASE}/rubros-pdf/`, { method: 'POST', body: form })
    },
    onSuccess: (_data, variables) =>
      qc.invalidateQueries({ queryKey: ['lic-rubros', variables.no_cia] }),
  })
}

export function useOportunidades(no_cia: string, estado?: string) {
  return useQuery({
    queryKey: ['lic-oportunidades', no_cia, estado],
    queryFn: () =>
      fetchJson<{ oportunidades: Oportunidad[] }>(
        `${BASE}/oportunidades/?no_cia=${no_cia}${estado ? `&estado=${estado}` : ''}`
      ),
    enabled: !!no_cia,
  })
}

export function useDocumentos(oportunidadId: number | null) {
  return useQuery({
    queryKey: ['lic-documentos', oportunidadId],
    queryFn: () =>
      fetchJson<{ documentos: Documento[] }>(`${BASE}/oportunidades/${oportunidadId}/documentos/`),
    enabled: !!oportunidadId,
  })
}

export function useBuscarAhora() {
  return useMutation({
    mutationFn: (no_cia?: string) =>
      fetchJson<{ job_id: number }>(`${BASE}/scrape/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_cia }),
      }),
  })
}

export function useScrapeJobStatus(jobId: number | null) {
  return useQuery({
    queryKey: ['lic-scrape-job', jobId],
    queryFn: () => fetchJson<ScrapeJobStatus>(`${BASE}/scrape/${jobId}/`),
    enabled: !!jobId,
    refetchInterval: (query) => (query.state.data?.estado === 'corriendo' ? 2000 : false),
  })
}
```

- [ ] **Step 2: Verify it typechecks**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no new errors from `features/lic/api.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/lic/api.ts
git commit -m "feat(lic): hooks React Query para el modulo de licitaciones"
```

---

### Task 12: Frontend — Configuración page

**Files:**
- Create: `frontend/src/features/lic/lic-config.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  useCredenciales,
  useGuardarCredencial,
  useProbarConexion,
  useRubros,
  useSubirRubrosPdf,
} from './api'

export function LicConfig() {
  const { data, isLoading } = useCredenciales()
  const guardarCredencial = useGuardarCredencial()
  const probarConexion = useProbarConexion()

  const [noCia, setNoCia] = useState('')
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')

  if (isLoading) return <div>Cargando...</div>

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Nueva credencial de portal DGCP</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input placeholder="No. Cía" value={noCia} onChange={(e) => setNoCia(e.target.value)} className="w-24" />
          <Input placeholder="Usuario del portal" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
          <Input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            onClick={() =>
              guardarCredencial.mutate(
                { no_cia: noCia, usuario_portal: usuario, password },
                {
                  onSuccess: () => {
                    toast.success('Credencial guardada')
                    setNoCia('')
                    setUsuario('')
                    setPassword('')
                  },
                  onError: (e) => toast.error(e.message),
                }
              )
            }
          >
            Guardar
          </Button>
        </CardContent>
      </Card>

      {data?.credenciales.map((c) => (
        <EmpresaCard key={c.no_cia} noCia={c.no_cia} estado={c.estado} usuario={c.usuario_portal} />
      ))}
    </div>
  )
}

function EmpresaCard({ noCia, estado, usuario }: { noCia: string; estado: string; usuario: string }) {
  const probarConexion = useProbarConexion()
  const { data: rubrosData } = useRubros(noCia)
  const subirRubros = useSubirRubrosPdf()

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>
          Empresa {noCia} — {usuario}
        </CardTitle>
        <Badge variant={estado === 'activo' ? 'default' : 'destructive'}>{estado}</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button
          variant="outline"
          onClick={() =>
            probarConexion.mutate(noCia, {
              onSuccess: () => toast.success('Conexión exitosa'),
              onError: (e) => toast.error(e.message),
            })
          }
        >
          Probar conexión
        </Button>

        <div>
          <Input
            type="file"
            accept="application/pdf"
            onChange={(e) => {
              const archivo = e.target.files?.[0]
              if (!archivo) return
              subirRubros.mutate(
                { no_cia: noCia, archivo },
                {
                  onSuccess: () => toast.success('Rubros extraídos'),
                  onError: (err) => toast.error(err.message),
                }
              )
            }}
          />
          {rubrosData?.rubros.length ? (
            <ul className="mt-2 list-disc pl-5 text-sm">
              {rubrosData.rubros.map((r, i) => (
                <li key={i}>
                  {r.codigo ? `${r.codigo} — ` : ''}
                  {r.descripcion}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verify it typechecks**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/lic/lic-config.tsx
git commit -m "feat(lic): pagina de configuracion de credenciales y rubros RPE"
```

---

### Task 13: Frontend — Oportunidades page

**Files:**
- Create: `frontend/src/features/lic/lic-oportunidades.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useBuscarAhora, useOportunidades, useScrapeJobStatus } from './api'

const ESTADOS = ['Todos', 'Nuevo', 'Visualizadas', 'Invitado', 'Activo', 'Sin ofertas', 'Con ofertas']

export function LicOportunidades() {
  const [noCia, setNoCia] = useState('01')
  const [estado, setEstado] = useState('Todos')
  const [jobId, setJobId] = useState<number | null>(null)

  const { data, isLoading, refetch } = useOportunidades(noCia, estado === 'Todos' ? undefined : estado)
  const buscarAhora = useBuscarAhora()
  const { data: jobStatus } = useScrapeJobStatus(jobId)

  if (jobStatus && jobStatus.estado !== 'corriendo' && jobId) {
    refetch()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={estado} onValueChange={setEstado}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ESTADOS.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          disabled={jobStatus?.estado === 'corriendo'}
          onClick={() =>
            buscarAhora.mutate(noCia, {
              onSuccess: (res) => {
                setJobId(res.job_id)
                toast.info('Búsqueda iniciada')
              },
              onError: (e) => toast.error(e.message),
            })
          }
        >
          {jobStatus?.estado === 'corriendo' ? 'Buscando...' : 'Buscar ahora'}
        </Button>
      </div>

      {isLoading ? (
        <div>Cargando...</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Referencia</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Entidad</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Fecha límite</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.oportunidades.map((o) => (
              <TableRow key={o.id}>
                <TableCell>{o.referencia}</TableCell>
                <TableCell>{o.tipo_proceso}</TableCell>
                <TableCell>{o.entidad}</TableCell>
                <TableCell>{o.titulo}</TableCell>
                <TableCell>{o.fecha_limite}</TableCell>
                <TableCell>
                  <Badge>{o.estado_portal}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify it typechecks**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/lic/lic-oportunidades.tsx
git commit -m "feat(lic): pagina de oportunidades con buscar ahora y polling de estado"
```

---

### Task 14: Frontend — routes and sidebar entry

**Files:**
- Create: `frontend/src/routes/_authenticated/lic.tsx`
- Create: `frontend/src/routes/_authenticated/lic/config.tsx`
- Create: `frontend/src/routes/_authenticated/lic/oportunidades.tsx`
- Modify: `frontend/src/components/layout/data/sidebar-data.ts`

- [ ] **Step 1: Layout route**

`frontend/src/routes/_authenticated/lic.tsx` (mirrors `odc.tsx`'s layout — check that file for the exact `RequireModule`/`Header`/`Main` import paths before writing this, since those weren't captured verbatim during research):

```tsx
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { RequireModule } from '@/components/require-module'

export const Route = createFileRoute('/_authenticated/lic')({
  component: LicLayout,
})

function LicLayout() {
  return (
    <RequireModule modulo="lic">
      <Header />
      <Main>
        <Outlet />
      </Main>
    </RequireModule>
  )
}
```

- [ ] **Step 2: Page routes**

`frontend/src/routes/_authenticated/lic/config.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { LicConfig } from '@/features/lic/lic-config'

export const Route = createFileRoute('/_authenticated/lic/config')({
  component: LicConfig,
})
```

`frontend/src/routes/_authenticated/lic/oportunidades.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { LicOportunidades } from '@/features/lic/lic-oportunidades'

export const Route = createFileRoute('/_authenticated/lic/oportunidades')({
  component: LicOportunidades,
})
```

- [ ] **Step 3: Regenerate the route tree**

```bash
cd frontend && npm run build 2>&1 | head -50
```

(TanStack Router's Vite plugin regenerates `routeTree.gen.ts` on build/dev — expected to succeed with the two new routes registered.)

- [ ] **Step 4: Add the sidebar entry**

In `frontend/src/components/layout/data/sidebar-data.ts`, find the ODC entry (`title: 'Órdenes de Compra'`) and add a new sibling entry right after it, following the exact same shape:

```ts
{
  title: 'Licitaciones',
  icon: FileSearch,
  items: [
    { title: 'Configuración', items: [
      { title: 'Empresas y Rubros RPE', url: '/lic/config' },
    ]},
    { title: 'Consultas', items: [
      { title: 'Oportunidades', url: '/lic/oportunidades' },
    ]},
  ],
},
```

Add `FileSearch` (or whichever icon from `lucide-react` best fits, matching how other entries import icons) to the top-of-file icon imports if not already imported.

- [ ] **Step 5: Verify the app builds and the module list check passes**

```bash
cd frontend && npx tsc --noEmit && npm run build
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/routes/_authenticated/lic.tsx frontend/src/routes/_authenticated/lic/ \
        frontend/src/components/layout/data/sidebar-data.ts frontend/src/routeTree.gen.ts
git commit -m "feat(lic): rutas y entrada de sidebar para el modulo de licitaciones"
```

---

### Task 15: End-to-end smoke test against the real portal

**Files:** none (verification only, per the spec's testing section — browser automation isn't meaningfully unit-testable)

- [ ] **Step 1: Configure the real credential through the running app**

```bash
curl -sk -X POST https://<vm-host>:8443/api/lic/credenciales/ \
  -H "Content-Type: application/json" \
  -d '{"no_cia": "01", "usuario_portal": "abregonza", "password": "RNC130217432!"}'
```

- [ ] **Step 2: Trigger "buscar ahora" and poll until done**

```bash
JOB_ID=$(curl -sk -X POST https://<vm-host>:8443/api/lic/scrape/ \
  -H "Content-Type: application/json" -d '{"no_cia": "01"}' | jq -r .job_id)
curl -sk https://<vm-host>:8443/api/lic/scrape/$JOB_ID/
```

Expected: eventually `"estado": "completado"` and `resumen.oportunidades_nuevas >= 0` with no entry for `"01"` under `resumen.errores`.

- [ ] **Step 3: Confirm the opportunities list matches the portal**

```bash
curl -sk "https://<vm-host>:8443/api/lic/oportunidades/?no_cia=01"
```

Compare row count and a couple of `referencia` values against what's visible logged into the portal directly — this is the only real confirmation that the scraper's selectors still match DGCP's current markup.

- [ ] **Step 4: Confirm no account lockout occurred**

Log into the portal manually (or re-run "Probar conexión" from the panel) to confirm `abregonza` can still authenticate normally after the automated run.

This task has no commit — it's the manual acceptance check that closes out Phase 1.
