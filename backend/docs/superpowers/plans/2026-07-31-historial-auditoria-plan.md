# Historial / Auditoría — Fase base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the cross-module audit trail mechanism (Oracle tables + `apps/historial` + shared frontend component) and prove it end-to-end on two real write paths — FAT factura (CREAR/ANULAR) and CXP corrección de NCF (EDITAR con diff) — exposed via a dashboard widget, an admin page, and a "Historial" tab on the FAT factura detail dialog.

**Architecture:** New Django app `apps/historial` (direct `oracledb` access via `apps.legacy.client`, no ORM — same style as `apps/asistente`/`apps/reportes`) backed by two new Oracle tables in schema `ABREGONZA` (`TSYS_BITACORA`, `TSYS_BITACORA_DETALLE`). `bitacora_repo.log_evento()` is called from inside each existing write function's own cursor/transaction so a rollback of the document also rolls back its log entry. `diff.diff_campos()` computes field-level before/after diffs by denylist (not allowlist) so new fields aren't silently dropped. Frontend: one shared `HistorialTimeline` component reused in the dashboard card, the admin page, and the per-document tab.

**Tech Stack:** Django REST Framework, `oracledb` thick mode (existing `apps.legacy.client`), React + TanStack Router + React Query, shadcn/ui, VM `10.0.0.99` (Docker: `facturation_backend` / `facturation_frontend`) as source of truth.

Spec: `backend/docs/superpowers/specs/2026-07-31-historial-auditoria-design.md`

---

### Task 1: Oracle DDL — TSYS_BITACORA / TSYS_BITACORA_DETALLE

**Files:**
- Create: `backend/apps/historial/__init__.py`
- Create: `backend/apps/historial/apps.py`
- Create: `backend/apps/historial/sql/001_create_tsys_bitacora.sql`
- Create: `backend/apps/historial/sql/_run_001.py`
- Modify: `backend/facturation_api/settings.py` (register app in `INSTALLED_APPS`)

- [ ] **Step 1: Create the Django app skeleton**

`backend/apps/historial/__init__.py`:
```python
```
(empty file)

`backend/apps/historial/apps.py`:
```python
from django.apps import AppConfig


class HistorialConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.historial"
```

- [ ] **Step 2: Register the app**

In `backend/facturation_api/settings.py`, find the `INSTALLED_APPS` list (it already contains `'apps.reportes'` — add right after it):
```python
    'apps.reportes',
    'apps.historial',
```

- [ ] **Step 3: Write the DDL file**

`backend/apps/historial/sql/001_create_tsys_bitacora.sql`:
```sql
-- ============================================================================
-- TSYS_BITACORA / TSYS_BITACORA_DETALLE : historial/auditoría cross-módulo
-- Owner: ABREGONZA
-- Spec : backend/docs/superpowers/specs/2026-07-31-historial-auditoria-design.md
-- NO se ejecuta automaticamente. Correr manualmente:
--   docker compose exec backend python apps/historial/sql/_run_001.py
-- ============================================================================

CREATE TABLE ABREGONZA.TSYS_BITACORA (
    BITACORA_ID     NUMBER GENERATED ALWAYS AS IDENTITY,
    FECHA           DATE          DEFAULT SYSDATE NOT NULL,
    USUARIO         VARCHAR2(30)  NOT NULL,
    NO_CIA          VARCHAR2(2)   NOT NULL,
    PUNTO           VARCHAR2(2),
    MODULO          VARCHAR2(10)  NOT NULL,
    TIPO_DOCUMENTO  VARCHAR2(10)  NOT NULL,
    NO_DOCUMENTO    VARCHAR2(15)  NOT NULL,
    ACCION          VARCHAR2(15)  NOT NULL,
    MOTIVO          VARCHAR2(500),
    DESCRIPCION     VARCHAR2(500) NOT NULL,
    CONSTRAINT PK_TSYS_BITACORA PRIMARY KEY (BITACORA_ID),
    CONSTRAINT CK_TSYS_BITACORA_ACCION CHECK (
        ACCION IN ('CREAR','EDITAR','ANULAR','REVERSAR')
    )
);

CREATE INDEX IX_TSYS_BITACORA_DOC   ON ABREGONZA.TSYS_BITACORA (NO_CIA, MODULO, TIPO_DOCUMENTO, NO_DOCUMENTO, FECHA DESC);
CREATE INDEX IX_TSYS_BITACORA_USR   ON ABREGONZA.TSYS_BITACORA (USUARIO, FECHA DESC);
CREATE INDEX IX_TSYS_BITACORA_FECHA ON ABREGONZA.TSYS_BITACORA (FECHA DESC);

CREATE TABLE ABREGONZA.TSYS_BITACORA_DETALLE (
    DETALLE_ID      NUMBER GENERATED ALWAYS AS IDENTITY,
    BITACORA_ID     NUMBER        NOT NULL,
    CAMPO           VARCHAR2(60)  NOT NULL,
    ETIQUETA        VARCHAR2(60)  NOT NULL,
    VALOR_ANTERIOR  VARCHAR2(1000),
    VALOR_NUEVO     VARCHAR2(1000),
    CONSTRAINT PK_TSYS_BITACORA_DETALLE PRIMARY KEY (DETALLE_ID),
    CONSTRAINT FK_TSYS_BITACORA_DETALLE
        FOREIGN KEY (BITACORA_ID) REFERENCES ABREGONZA.TSYS_BITACORA(BITACORA_ID)
        ON DELETE CASCADE
);

CREATE INDEX IX_TSYS_BITACORA_DET_HDR ON ABREGONZA.TSYS_BITACORA_DETALLE (BITACORA_ID);

GRANT SELECT, INSERT, UPDATE, DELETE ON ABREGONZA.TSYS_BITACORA         TO JCABREU;
GRANT SELECT, INSERT, UPDATE, DELETE ON ABREGONZA.TSYS_BITACORA_DETALLE TO JCABREU;

CREATE OR REPLACE SYNONYM JCABREU.TSYS_BITACORA         FOR ABREGONZA.TSYS_BITACORA;
CREATE OR REPLACE SYNONYM JCABREU.TSYS_BITACORA_DETALLE FOR ABREGONZA.TSYS_BITACORA_DETALLE;

COMMIT;
EXIT;
```

- [ ] **Step 4: Write the runner script (copy of `apps/asistente/sql/_run_001.py`, path updated)**

`backend/apps/historial/sql/_run_001.py`:
```python
"""Ejecuta apps/historial/sql/001_create_tsys_bitacora.sql contra Oracle.

Uso (dentro del container backend):
    docker compose exec backend python apps/historial/sql/_run_001.py

Idempotente: si una tabla ya existe (ORA-00955) o un indice, lo saltea con
WARN. Errores reales se propagan.
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
SQL_PATH = os.path.join(HERE, "001_create_tsys_bitacora.sql")


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

- [ ] **Step 5: Deploy and apply**

```bash
plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "mkdir -p ~/facturation-system/backend/apps/historial/sql"

cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system" && \
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  backend/apps/historial/__init__.py backend/apps/historial/apps.py \
  jcabreu@10.0.0.99:facturation-system/backend/apps/historial/

pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  backend/apps/historial/sql/001_create_tsys_bitacora.sql backend/apps/historial/sql/_run_001.py \
  jcabreu@10.0.0.99:facturation-system/backend/apps/historial/sql/

pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  backend/facturation_api/settings.py \
  jcabreu@10.0.0.99:facturation-system/backend/facturation_api/
```

Expected: no errors from `pscp`.

- [ ] **Step 6: Run the DDL inside the backend container and verify**

```bash
plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "docker compose -f ~/facturation-system/docker-compose.yml exec -T backend python apps/historial/sql/_run_001.py"
```

Expected: `-> N statements` then `[NN] OK ...` for each `CREATE`/`GRANT`/`CREATE SYNONYM`, ending in `DDL applied.` (exit code 0). If Django fails to boot because `apps.historial` isn't a valid app yet, re-check Step 2 was uploaded.

- [ ] **Step 7: Commit**

```bash
git add backend/apps/historial/__init__.py backend/apps/historial/apps.py \
        backend/apps/historial/sql/001_create_tsys_bitacora.sql \
        backend/apps/historial/sql/_run_001.py backend/facturation_api/settings.py
git commit -m "feat(historial): tabla TSYS_BITACORA/DETALLE + app apps.historial"
```

---

### Task 2: `diff_campos` — diff campo por campo (TDD, sin DB)

**Files:**
- Create: `backend/apps/historial/diff.py`
- Test: `backend/apps/historial/tests/__init__.py`
- Test: `backend/apps/historial/tests/test_diff.py`

- [ ] **Step 1: Write the failing tests**

`backend/apps/historial/tests/__init__.py`: (empty file)

`backend/apps/historial/tests/test_diff.py`:
```python
from apps.historial.diff import diff_campos

DENYLIST_DEFAULT = {"no_cia", "punto", "usuario", "fecha_sysdate", "no_docu", "no_factura"}


def test_diff_campos_detects_changed_field():
    antes = {"total": 1500.0, "condicion_pago": "CONTADO"}
    despues = {"total": 1800.0, "condicion_pago": "CONTADO"}
    cambios = diff_campos(antes, despues)
    assert cambios == [
        {"campo": "total", "etiqueta": "Total", "valor_anterior": "1500.0", "valor_nuevo": "1800.0"},
    ]


def test_diff_campos_no_changes_returns_empty_list():
    antes = {"total": 1500.0}
    despues = {"total": 1500.0}
    assert diff_campos(antes, despues) == []


def test_diff_campos_ignores_denylisted_fields():
    antes = {"total": 1500.0, "no_cia": "01", "usuario": "JCABREU"}
    despues = {"total": 1500.0, "no_cia": "02", "usuario": "MPILAR"}
    assert diff_campos(antes, despues) == []


def test_diff_campos_ignores_keys_missing_in_either_side():
    antes = {"total": 1500.0, "solo_antes": "x"}
    despues = {"total": 1500.0, "solo_despues": "y"}
    assert diff_campos(antes, despues) == []


def test_diff_campos_uses_etiqueta_map_when_present():
    antes = {"condicion_pago": "CONTADO"}
    despues = {"condicion_pago": "CREDITO"}
    cambios = diff_campos(antes, despues, etiquetas={"condicion_pago": "Condición de pago"})
    assert cambios == [
        {"campo": "condicion_pago", "etiqueta": "Condición de pago",
         "valor_anterior": "CONTADO", "valor_nuevo": "CREDITO"},
    ]


def test_diff_campos_autohumaniza_etiqueta_sin_mapa():
    antes = {"forma_pago_fat": "01"}
    despues = {"forma_pago_fat": "02"}
    cambios = diff_campos(antes, despues)
    assert cambios[0]["etiqueta"] == "Forma pago fat"


def test_diff_campos_none_values_se_muestran_como_vacio():
    antes = {"nota": None}
    despues = {"nota": "urgente"}
    cambios = diff_campos(antes, despues)
    assert cambios == [
        {"campo": "nota", "etiqueta": "Nota", "valor_anterior": "", "valor_nuevo": "urgente"},
    ]
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system/backend" && \
python -m pytest apps/historial/tests/test_diff.py -v
```

Expected: `ModuleNotFoundError: No module named 'apps.historial.diff'` (or collection error) for all 7 tests.

- [ ] **Step 3: Implement `diff_campos`**

`backend/apps/historial/diff.py`:
```python
"""Diff campo-por-campo entre dos snapshots de un documento (estilo Odoo
tracked fields). Denylist en vez de allowlist: compara TODAS las claves
presentes en ambos dicts salvo un puñado de columnas técnicas, para que un
campo nuevo del payload nunca se pierda en silencio por falta de registro.
"""

from __future__ import annotations

from typing import Any

DENYLIST_DEFAULT = frozenset({
    "no_cia", "punto", "usuario", "fecha_sysdate", "no_docu", "no_factura",
    "no_documento", "no_conduce", "no_orden", "no_requisicion", "no_cheque",
})


def _fmt(v: Any) -> str:
    if v is None:
        return ""
    return str(v)


def _humanizar(campo: str) -> str:
    return campo.replace("_", " ").capitalize()


def diff_campos(
    antes: dict[str, Any],
    despues: dict[str, Any],
    etiquetas: dict[str, str] | None = None,
    ignorar: frozenset[str] | set[str] | None = None,
) -> list[dict[str, str]]:
    etiquetas = etiquetas or {}
    ignorar = ignorar if ignorar is not None else DENYLIST_DEFAULT
    comunes = sorted(set(antes.keys()) & set(despues.keys()))
    cambios: list[dict[str, str]] = []
    for campo in comunes:
        if campo in ignorar:
            continue
        v_antes, v_despues = antes[campo], despues[campo]
        if v_antes == v_despues:
            continue
        cambios.append({
            "campo": campo,
            "etiqueta": etiquetas.get(campo) or _humanizar(campo),
            "valor_anterior": _fmt(v_antes),
            "valor_nuevo": _fmt(v_despues),
        })
    return cambios
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system/backend" && \
python -m pytest apps/historial/tests/test_diff.py -v
```

Expected: `7 passed`.

- [ ] **Step 5: Commit**

```bash
git add backend/apps/historial/diff.py backend/apps/historial/tests/__init__.py backend/apps/historial/tests/test_diff.py
git commit -m "feat(historial): diff_campos con denylist + tests"
```

---

### Task 3: `bitacora_repo.log_evento` (TDD con FakeCursor)

**Files:**
- Create: `backend/apps/historial/repo.py`
- Test: `backend/apps/historial/tests/test_repo.py`

- [ ] **Step 1: Write the failing tests**

`backend/apps/historial/tests/test_repo.py`:
```python
from types import SimpleNamespace

from apps.historial import repo


class FakeCursor:
    def __init__(self):
        self.executed: list[tuple[str, list]] = []
        self.committed = False
        self._next_id = [501]

    def execute(self, sql, params=None):
        self.executed.append((sql, list(params or [])))

    def fetchone(self):
        row = tuple(self._next_id)
        return row

    @property
    def connection(self):
        def _commit():
            self.committed = True
        return SimpleNamespace(commit=_commit)


def test_log_evento_crear_inserta_cabecera_sin_detalle():
    cur = FakeCursor()
    repo.log_evento(
        cur, usuario="jcabreu", no_cia="01", punto="01", modulo="FAT",
        tipo_documento="FT", no_documento="0001234", accion="CREAR",
    )
    inserts = [sql for sql, _ in cur.executed if "INSERT INTO ABREGONZA.TSYS_BITACORA" in sql]
    assert len(inserts) == 1
    assert "TSYS_BITACORA_DETALLE" not in inserts[0]
    # log_evento NO hace commit: es responsabilidad del caller (misma transacción).
    assert cur.committed is False


def test_log_evento_usuario_se_normaliza_a_mayusculas():
    cur = FakeCursor()
    repo.log_evento(
        cur, usuario="jcabreu", no_cia="01", punto="01", modulo="FAT",
        tipo_documento="FT", no_documento="0001234", accion="CREAR",
    )
    _, params = cur.executed[0]
    assert "JCABREU" in params


def test_log_evento_editar_con_cambios_inserta_detalle_por_campo():
    cur = FakeCursor()
    repo.log_evento(
        cur, usuario="JCABREU", no_cia="01", punto="01", modulo="CXP",
        tipo_documento="FP", no_documento="0008347", accion="EDITAR",
        cambios=[
            {"campo": "ncf", "etiqueta": "NCF", "valor_anterior": "123", "valor_nuevo": "456"},
        ],
    )
    detalle_inserts = [sql for sql, _ in cur.executed if "INSERT INTO ABREGONZA.TSYS_BITACORA_DETALLE" in sql]
    assert len(detalle_inserts) == 1


def test_log_evento_editar_sin_cambios_no_inserta_nada():
    cur = FakeCursor()
    repo.log_evento(
        cur, usuario="JCABREU", no_cia="01", punto="01", modulo="CXP",
        tipo_documento="FP", no_documento="0008347", accion="EDITAR",
        cambios=[],
    )
    assert cur.executed == []


def test_log_evento_anular_persiste_motivo():
    cur = FakeCursor()
    repo.log_evento(
        cur, usuario="JCABREU", no_cia="01", punto="01", modulo="FAT",
        tipo_documento="FT", no_documento="0001234", accion="ANULAR",
        motivo="Factura duplicada",
    )
    _, params = cur.executed[0]
    assert "Factura duplicada" in params


def test_descripcion_crear():
    assert repo._descripcion("JCABREU", "CREAR", "FT", "0001234", 0) == \
        "JCABREU creó FT-0001234"


def test_descripcion_editar_con_n_campos():
    assert repo._descripcion("JCABREU", "EDITAR", "FP", "0008347", 3) == \
        "JCABREU editó FP-0008347 (3 campos)"


def test_descripcion_anular():
    assert repo._descripcion("JCABREU", "ANULAR", "FT", "0001234", 0) == \
        "JCABREU anuló FT-0001234"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system/backend" && \
python -m pytest apps/historial/tests/test_repo.py -v
```

Expected: `ModuleNotFoundError: No module named 'apps.historial.repo'`.

- [ ] **Step 3: Implement `repo.py`**

`backend/apps/historial/repo.py`:
```python
"""Bitácora de auditoría (historial de quién-hizo-qué).

`log_evento` NUNCA abre su propia conexión/cursor ni hace commit: recibe el
cursor ya abierto por la función que está auditando y escribe dentro de esa
MISMA transacción, para que un rollback del documento también deshaga su
entrada de bitácora. El commit lo hace siempre el caller.
"""

from __future__ import annotations

from typing import Any

ACCIONES_VALIDAS = ("CREAR", "EDITAR", "ANULAR", "REVERSAR")

_VERBOS = {"CREAR": "creó", "EDITAR": "editó", "ANULAR": "anuló", "REVERSAR": "reversó"}


def _descripcion(usuario: str, accion: str, tipo_documento: str, no_documento: str, n_cambios: int) -> str:
    verbo = _VERBOS.get(accion, accion.lower())
    base = f"{usuario} {verbo} {tipo_documento}-{no_documento}"
    if accion == "EDITAR" and n_cambios:
        base += f" ({n_cambios} campos)"
    return base


def log_evento(
    cur,
    *,
    usuario: str,
    no_cia: str,
    punto: str | None,
    modulo: str,
    tipo_documento: str,
    no_documento: str,
    accion: str,
    motivo: str | None = None,
    cambios: list[dict[str, str]] | None = None,
) -> None:
    if accion not in ACCIONES_VALIDAS:
        raise ValueError(f"accion invalida: {accion}")
    if accion == "EDITAR" and not cambios:
        # Nada cambió de verdad: no se genera evento.
        return

    usuario_u = (usuario or "").upper()[:30]
    n_cambios = len(cambios or [])
    descripcion = _descripcion(usuario_u, accion, tipo_documento, no_documento, n_cambios)[:500]

    cur.execute(
        "INSERT INTO ABREGONZA.TSYS_BITACORA "
        "(USUARIO, NO_CIA, PUNTO, MODULO, TIPO_DOCUMENTO, NO_DOCUMENTO, "
        " ACCION, MOTIVO, DESCRIPCION, FECHA) "
        "VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, SYSDATE)",
        [usuario_u, no_cia, punto, modulo.upper(), tipo_documento.upper(),
         no_documento, accion, (motivo or None), descripcion],
    )
    cur.execute("SELECT ABREGONZA.TSYS_BITACORA_SEQ$IDENTITY.CURRVAL FROM DUAL"
                if False else
                "SELECT MAX(BITACORA_ID) FROM ABREGONZA.TSYS_BITACORA WHERE "
                "USUARIO=:1 AND NO_CIA=:2 AND MODULO=:3 AND TIPO_DOCUMENTO=:4 "
                "AND NO_DOCUMENTO=:5 AND ACCION=:6",
                [usuario_u, no_cia, modulo.upper(), tipo_documento.upper(), no_documento, accion])
    row = cur.fetchone()
    bitacora_id = row[0] if row else None

    if accion == "EDITAR" and cambios and bitacora_id is not None:
        for c in cambios:
            cur.execute(
                "INSERT INTO ABREGONZA.TSYS_BITACORA_DETALLE "
                "(BITACORA_ID, CAMPO, ETIQUETA, VALOR_ANTERIOR, VALOR_NUEVO) "
                "VALUES (:1, :2, :3, :4, :5)",
                [bitacora_id, c["campo"][:60], c["etiqueta"][:60],
                 (c.get("valor_anterior") or "")[:1000], (c.get("valor_nuevo") or "")[:1000]],
            )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system/backend" && \
python -m pytest apps/historial/tests/test_repo.py -v
```

Expected: `8 passed`.

- [ ] **Step 5: Clean up the dead branch in Step 3**

Re-open `backend/apps/historial/repo.py` and replace the `if False else` construct
(left over from drafting) with a plain statement:
```python
    cur.execute(
        "SELECT MAX(BITACORA_ID) FROM ABREGONZA.TSYS_BITACORA WHERE "
        "USUARIO=:1 AND NO_CIA=:2 AND MODULO=:3 AND TIPO_DOCUMENTO=:4 "
        "AND NO_DOCUMENTO=:5 AND ACCION=:6",
        [usuario_u, no_cia, modulo.upper(), tipo_documento.upper(), no_documento, accion])
```
(replaces the two-line `cur.execute(... if False else ...)` call). Run
`python -m pytest apps/historial/tests/test_repo.py -v` again — still `8 passed`.

- [ ] **Step 6: Commit**

```bash
git add backend/apps/historial/repo.py backend/apps/historial/tests/test_repo.py
git commit -m "feat(historial): log_evento comparte transaccion del caller + tests"
```

---

### Task 4: Endpoints de lectura + wiring de URLs

**Files:**
- Modify: `backend/apps/historial/repo.py` (agregar `list_mio`, `list_admin`, `list_documento`)
- Create: `backend/apps/historial/views.py`
- Create: `backend/apps/historial/urls.py`
- Modify: `backend/facturation_api/urls.py`
- Create: `backend/apps/historial/tests/conftest.py`
- Test: `backend/apps/historial/tests/test_views.py`

- [ ] **Step 1: Write the `mock_user` fixture (scoped per-app, no root conftest.py exists)**

`backend/apps/historial/tests/conftest.py`:
```python
"""pytest fixtures comunes a apps.historial.tests."""

import pytest


@pytest.fixture
def mock_user(db):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    return User.objects.create_user(username="ZZTEST", password="x")
```

- [ ] **Step 2: Write the failing view tests**

`backend/apps/historial/tests/test_views.py`:
```python
from rest_framework.test import APIClient


def test_mio_requires_auth():
    client = APIClient()
    resp = client.get("/api/historial/mio/")
    assert resp.status_code in (401, 403)


def test_mio_returns_own_events(monkeypatch, mock_user):
    from apps.historial import repo

    monkeypatch.setattr(
        repo, "list_mio",
        lambda usuario, limit: [{"bitacora_id": 1, "usuario": usuario, "accion": "CREAR",
                                  "descripcion": "x", "cambios": []}],
    )
    client = APIClient()
    client.force_authenticate(mock_user)
    resp = client.get("/api/historial/mio/?limit=5")
    assert resp.status_code == 200
    assert resp.json()["items"][0]["accion"] == "CREAR"


def test_admin_forbidden_for_non_dba(monkeypatch, mock_user):
    monkeypatch.setattr("apps.legacy.repositories.users_repo.is_dba", lambda u: False)
    client = APIClient()
    client.force_authenticate(mock_user)
    resp = client.get("/api/historial/")
    assert resp.status_code == 403


def test_admin_ok_for_dba(monkeypatch, mock_user):
    from apps.historial import repo

    monkeypatch.setattr("apps.legacy.repositories.users_repo.is_dba", lambda u: True)
    monkeypatch.setattr(repo, "list_admin", lambda **kw: {"items": [], "total": 0})
    client = APIClient()
    client.force_authenticate(mock_user)
    resp = client.get("/api/historial/?modulo=FAT")
    assert resp.status_code == 200
    assert resp.json() == {"items": [], "total": 0}


def test_documento_requires_params(mock_user):
    client = APIClient()
    client.force_authenticate(mock_user)
    resp = client.get("/api/historial/documento/?no_cia=01&modulo=FAT&punto=01")
    assert resp.status_code == 400


def test_documento_forbidden_without_doc_permission(monkeypatch, mock_user):
    monkeypatch.setattr("apps.legacy.repositories.users_repo.is_dba", lambda u: False)
    monkeypatch.setattr(
        "apps.legacy.repositories.permissions_repo.list_user_doc_perms",
        lambda usuario, modulo, no_cia, punto: [{"tipo_docu": "FC"}],  # FT no está asignado
    )
    client = APIClient()
    client.force_authenticate(mock_user)
    resp = client.get(
        "/api/historial/documento/?no_cia=01&punto=01&modulo=FAT&tipo_documento=FT&no_documento=0001234"
    )
    assert resp.status_code == 403


def test_documento_ok_when_user_has_doc_permission(monkeypatch, mock_user):
    from apps.historial import repo

    monkeypatch.setattr("apps.legacy.repositories.users_repo.is_dba", lambda u: False)
    monkeypatch.setattr(
        "apps.legacy.repositories.permissions_repo.list_user_doc_perms",
        lambda usuario, modulo, no_cia, punto: [{"tipo_docu": "FT"}],
    )
    monkeypatch.setattr(
        repo, "list_documento",
        lambda **kw: [{"bitacora_id": 1, "accion": "CREAR", "cambios": []}],
    )
    client = APIClient()
    client.force_authenticate(mock_user)
    resp = client.get(
        "/api/historial/documento/?no_cia=01&punto=01&modulo=FAT&tipo_documento=FT&no_documento=0001234"
    )
    assert resp.status_code == 200
    assert resp.json()["items"][0]["accion"] == "CREAR"


def test_documento_ok_for_admin_regardless_of_doc_permission(monkeypatch, mock_user):
    from apps.historial import repo

    monkeypatch.setattr("apps.legacy.repositories.users_repo.is_dba", lambda u: True)
    monkeypatch.setattr(
        "apps.legacy.repositories.permissions_repo.list_user_doc_perms",
        lambda usuario, modulo, no_cia, punto: [],  # admin no necesita tener el doc asignado
    )
    monkeypatch.setattr(repo, "list_documento", lambda **kw: [])
    client = APIClient()
    client.force_authenticate(mock_user)
    resp = client.get(
        "/api/historial/documento/?no_cia=01&punto=01&modulo=FAT&tipo_documento=FT&no_documento=0001234"
    )
    assert resp.status_code == 200
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system/backend" && \
python -m pytest apps/historial/tests/test_views.py -v
```

Expected: 404s / `ModuleNotFoundError` for `apps.historial.views` — all 8 fail.

- [ ] **Step 4: Add the read functions to `repo.py`**

Append to `backend/apps/historial/repo.py`:
```python
from apps.legacy import client


def _attach_cambios(rows: list[dict]) -> list[dict]:
    if not rows:
        return rows
    ids = [r["bitacora_id"] for r in rows]
    placeholders = ",".join(f":{i+1}" for i in range(len(ids)))
    detalle_rows = client.fetch_dicts(
        f"SELECT BITACORA_ID AS bitacora_id, CAMPO AS campo, ETIQUETA AS etiqueta, "
        f"VALOR_ANTERIOR AS valor_anterior, VALOR_NUEVO AS valor_nuevo "
        f"FROM ABREGONZA.TSYS_BITACORA_DETALLE WHERE BITACORA_ID IN ({placeholders})",
        ids,
    )
    por_id: dict[int, list[dict]] = {}
    for d in detalle_rows:
        por_id.setdefault(d["bitacora_id"], []).append({
            "campo": d["campo"], "etiqueta": d["etiqueta"],
            "valor_anterior": d["valor_anterior"], "valor_nuevo": d["valor_nuevo"],
        })
    for r in rows:
        r["cambios"] = por_id.get(r["bitacora_id"], [])
    return rows


def list_mio(usuario: str, limit: int = 10) -> list[dict]:
    limit = max(1, min(int(limit or 10), 100))
    rows = client.fetch_dicts(
        "SELECT * FROM ("
        " SELECT BITACORA_ID AS bitacora_id, TO_CHAR(FECHA,'YYYY-MM-DD\"T\"HH24:MI:SS') AS fecha, "
        "        USUARIO AS usuario, MODULO AS modulo, TIPO_DOCUMENTO AS tipo_documento, "
        "        NO_DOCUMENTO AS no_documento, ACCION AS accion, MOTIVO AS motivo, "
        "        DESCRIPCION AS descripcion "
        " FROM ABREGONZA.TSYS_BITACORA WHERE UPPER(USUARIO) = :1 ORDER BY FECHA DESC"
        f") WHERE ROWNUM <= {limit}",
        [(usuario or "").upper()],
    )
    return _attach_cambios(rows)


def list_admin(
    *, usuario: str | None = None, modulo: str | None = None,
    tipo_documento: str | None = None, no_documento: str | None = None,
    accion: str | None = None, fecha_desde: str | None = None,
    fecha_hasta: str | None = None, page: int = 1, page_size: int = 25,
) -> dict:
    where = []
    params: list = []
    if usuario:
        params.append(usuario.upper()); where.append(f"UPPER(USUARIO) = :{len(params)}")
    if modulo:
        params.append(modulo.upper()); where.append(f"MODULO = :{len(params)}")
    if tipo_documento:
        params.append(tipo_documento.upper()); where.append(f"TIPO_DOCUMENTO = :{len(params)}")
    if no_documento:
        params.append(no_documento); where.append(f"NO_DOCUMENTO = :{len(params)}")
    if accion:
        params.append(accion.upper()); where.append(f"ACCION = :{len(params)}")
    if fecha_desde:
        params.append(fecha_desde); where.append(f"FECHA >= TO_DATE(:{len(params)},'YYYY-MM-DD')")
    if fecha_hasta:
        params.append(fecha_hasta); where.append(f"FECHA < TO_DATE(:{len(params)},'YYYY-MM-DD') + 1")
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""

    page = max(1, int(page or 1))
    page_size = max(1, min(int(page_size or 25), 100))
    start = (page - 1) * page_size + 1
    end = page * page_size

    total_row = client.fetch_one(
        f"SELECT COUNT(*) FROM ABREGONZA.TSYS_BITACORA {where_sql}", params)
    total = int(total_row[0]) if total_row else 0

    rows = client.fetch_dicts(
        "SELECT bitacora_id, fecha, usuario, modulo, tipo_documento, no_documento, "
        "       accion, motivo, descripcion FROM ("
        " SELECT BITACORA_ID AS bitacora_id, TO_CHAR(FECHA,'YYYY-MM-DD\"T\"HH24:MI:SS') AS fecha, "
        "        USUARIO AS usuario, MODULO AS modulo, TIPO_DOCUMENTO AS tipo_documento, "
        "        NO_DOCUMENTO AS no_documento, ACCION AS accion, MOTIVO AS motivo, "
        "        DESCRIPCION AS descripcion, "
        "        ROW_NUMBER() OVER (ORDER BY FECHA DESC) AS rn "
        f" FROM ABREGONZA.TSYS_BITACORA {where_sql}"
        f") WHERE rn BETWEEN {start} AND {end}",
        params,
    )
    return {"items": _attach_cambios(rows), "total": total}


def list_documento(
    *, no_cia: str, modulo: str, tipo_documento: str, no_documento: str,
) -> list[dict]:
    rows = client.fetch_dicts(
        "SELECT BITACORA_ID AS bitacora_id, TO_CHAR(FECHA,'YYYY-MM-DD\"T\"HH24:MI:SS') AS fecha, "
        "       USUARIO AS usuario, MODULO AS modulo, TIPO_DOCUMENTO AS tipo_documento, "
        "       NO_DOCUMENTO AS no_documento, ACCION AS accion, MOTIVO AS motivo, "
        "       DESCRIPCION AS descripcion "
        "FROM ABREGONZA.TSYS_BITACORA "
        "WHERE NO_CIA=:1 AND MODULO=:2 AND TIPO_DOCUMENTO=:3 AND NO_DOCUMENTO=:4 "
        "ORDER BY FECHA DESC",
        [no_cia, modulo.upper(), tipo_documento.upper(), no_documento],
    )
    return _attach_cambios(rows)
```

- [ ] **Step 5: Write `views.py`**

`backend/apps/historial/views.py`:
```python
"""Endpoints /api/historial/ — bitácora de auditoría."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.auth_legacy.views import IsLegacyAdmin

from . import repo


class MiActividadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        limit = request.query_params.get("limit", "10")
        items = repo.list_mio(request.user.username, limit=int(limit))
        return Response({"items": items})


class HistorialAdminView(APIView):
    permission_classes = [IsAuthenticated, IsLegacyAdmin]

    def get(self, request):
        qp = request.query_params
        result = repo.list_admin(
            usuario=qp.get("usuario"),
            modulo=qp.get("modulo"),
            tipo_documento=qp.get("tipo_documento"),
            no_documento=qp.get("no_documento"),
            accion=qp.get("accion"),
            fecha_desde=qp.get("fecha_desde"),
            fecha_hasta=qp.get("fecha_hasta"),
            page=int(qp.get("page", "1")),
            page_size=int(qp.get("page_size", "25")),
        )
        return Response(result)


class HistorialDocumentoView(APIView):
    """El historial de UN documento requiere el mismo permiso que ya protege
    verlo (asignación de tipo_docu por módulo/empresa/punto) — no requiere ser
    admin, salvo que el usuario sea DBA, que ve todo."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.legacy.repositories import permissions_repo, users_repo

        qp = request.query_params
        no_cia = qp.get("no_cia")
        punto = qp.get("punto")
        modulo = qp.get("modulo")
        tipo_documento = qp.get("tipo_documento")
        no_documento = qp.get("no_documento")
        if not all([no_cia, punto, modulo, tipo_documento, no_documento]):
            return Response(
                {"detail": "no_cia, punto, modulo, tipo_documento y no_documento son requeridos"},
                status=400,
            )

        username = request.user.username
        if not users_repo.is_dba(username):
            asignados = permissions_repo.list_user_doc_perms(username, modulo, no_cia, punto)
            tipos_asignados = {d["tipo_docu"] for d in asignados}
            if tipo_documento.upper() not in tipos_asignados:
                return Response({"detail": "forbidden"}, status=403)

        items = repo.list_documento(
            no_cia=no_cia, modulo=modulo,
            tipo_documento=tipo_documento, no_documento=no_documento,
        )
        return Response({"items": items})
```

- [ ] **Step 6: Write `urls.py` and wire into the project**

`backend/apps/historial/urls.py`:
```python
from django.urls import path

from . import views

urlpatterns = [
    path("historial/mio/", views.MiActividadView.as_view()),
    path("historial/documento/", views.HistorialDocumentoView.as_view()),
    path("historial/", views.HistorialAdminView.as_view()),
]
```

In `backend/facturation_api/urls.py`, add after the `apps.reportes.urls` line:
```python
    path('api/', include('apps.reportes.urls')),
    path('api/', include('apps.historial.urls')),
]
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system/backend" && \
python -m pytest apps/historial/tests/ -v
```

Expected: `23 passed` (7 diff + 8 repo + 8 view tests).

- [ ] **Step 8: Deploy and smoke test on VM**

```bash
cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system" && \
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  backend/apps/historial/repo.py backend/apps/historial/views.py backend/apps/historial/urls.py \
  jcabreu@10.0.0.99:facturation-system/backend/apps/historial/

pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  backend/facturation_api/urls.py \
  jcabreu@10.0.0.99:facturation-system/backend/facturation_api/
```

```bash
plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "rm -f /tmp/cookie.txt && \
   curl -s -c /tmp/cookie.txt -X POST -H 'Content-Type: application/json' \
        -d '{\"username\":\"JCABREU\",\"password\":\"Temp1234!\"}' \
        http://localhost:8000/api/auth/login/ -w '\nLOGIN=%{http_code}\n' && \
   curl -s -b /tmp/cookie.txt 'http://localhost:8000/api/historial/mio/?limit=5' -w '\nHTTP=%{http_code}\n'"
```

Expected: `LOGIN=200`, then `HTTP=200` with `{"items": []}` (empty, since nothing has written to the table yet — that's Task 5+).

- [ ] **Step 9: Commit**

```bash
git add backend/apps/historial/repo.py backend/apps/historial/views.py backend/apps/historial/urls.py \
        backend/apps/historial/tests/conftest.py backend/apps/historial/tests/test_views.py \
        backend/facturation_api/urls.py
git commit -m "feat(historial): endpoints mio/admin/documento + wiring de URLs"
```

---

### Task 5: Instrumentar FAT `create_factura` (CREAR)

**Files:**
- Modify: `backend/apps/legacy/repositories/fat_repo.py:2753` (justo antes de `cur.connection.commit()`)

- [ ] **Step 1: Agregar el import y la llamada**

Cerca del inicio de `fat_repo.py`, junto a los demás imports de `apps.legacy` (buscar `from apps.legacy import client` o similar), agregar:
```python
from apps.historial import repo as historial_repo
```

En `fat_repo.py`, dentro de `create_factura`, inmediatamente ANTES de la línea 2753 (`cur.connection.commit()`, la que cierra el `with client.cursor() as cur:` de la función), insertar:
```python
        historial_repo.log_evento(
            cur, usuario=usuario, no_cia=no_cia, punto=punto, modulo="FAT",
            tipo_documento=tf, no_documento=new_no_factura, accion="CREAR",
        )
        cur.connection.commit()
```
(la línea `cur.connection.commit()` ya existía — solo se agrega el bloque `historial_repo.log_evento(...)` justo arriba, misma indentación).

- [ ] **Step 2: Syntax check y deploy**

```bash
cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system" && \
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  backend/apps/legacy/repositories/fat_repo.py \
  jcabreu@10.0.0.99:facturation-system/backend/apps/legacy/repositories/

plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "python3 -c \"import ast; ast.parse(open('/home/jcabreu/facturation-system/backend/apps/legacy/repositories/fat_repo.py').read())\""
```

Expected: no output (valid syntax). Wait ~5s for `StatReloader`.

- [ ] **Step 3: Smoke test — crear una factura de prueba y verificar que aparece en el historial**

```bash
plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "rm -f /tmp/cookie.txt && \
   curl -s -c /tmp/cookie.txt -X POST -H 'Content-Type: application/json' \
        -d '{\"username\":\"JCABREU\",\"password\":\"Temp1234!\"}' \
        http://localhost:8000/api/auth/login/ -w '\nLOGIN=%{http_code}\n' && \
   curl -s -b /tmp/cookie.txt 'http://localhost:8000/api/historial/mio/?limit=1' -w '\nHTTP=%{http_code}\n'"
```

(Este paso solo confirma que el endpoint sigue respondiendo 200 tras el cambio; la
verificación de un evento CREAR real se hace en el Task 13 end-to-end, una vez
también esté instrumentado ANULAR, para no crear facturas de prueba sueltas en
la BD real antes de tiempo).

- [ ] **Step 4: Commit**

```bash
git add backend/apps/legacy/repositories/fat_repo.py
git commit -m "feat(fat): instrumenta create_factura con log_evento CREAR"
```

---

### Task 6: Instrumentar FAT `anular_factura` (ANULAR — persiste el motivo)

**Files:**
- Modify: `backend/apps/legacy/repositories/fat_repo.py:2880` (justo antes de `cur.connection.commit()` de `anular_factura`)

- [ ] **Step 1: Agregar la llamada**

Dentro de `anular_factura`, inmediatamente ANTES de la línea `cur.connection.commit()` (la última línea del `with client.cursor() as cur:` de esta función, justo antes del `return`), insertar:
```python
        historial_repo.log_evento(
            cur, usuario=usuario, no_cia=no_cia, punto=punto, modulo="FAT",
            tipo_documento=tf, no_documento=nf, accion="ANULAR", motivo=motivo,
        )
        cur.connection.commit()
```

- [ ] **Step 2: Syntax check y deploy**

```bash
cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system" && \
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  backend/apps/legacy/repositories/fat_repo.py \
  jcabreu@10.0.0.99:facturation-system/backend/apps/legacy/repositories/

plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "python3 -c \"import ast; ast.parse(open('/home/jcabreu/facturation-system/backend/apps/legacy/repositories/fat_repo.py').read())\""
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add backend/apps/legacy/repositories/fat_repo.py
git commit -m "feat(fat): instrumenta anular_factura con log_evento ANULAR (persiste motivo)"
```

---

### Task 7: Instrumentar CXP `corregir_datos_dgii` (EDITAR — con diff)

**Files:**
- Modify: `backend/apps/legacy/repositories/cxp_repo.py:1446-1510`

- [ ] **Step 1: Agregar el import**

Cerca de los imports de `cxp_repo.py`:
```python
from apps.historial import repo as historial_repo
```

- [ ] **Step 2: Ampliar el SELECT inicial para capturar el "antes" de los campos editables**

En `corregir_datos_dgii`, reemplazar el SELECT inicial (líneas 1458-1463):
```python
    rows = client.fetch_dicts(
        "SELECT status, no_proveedor, "
        "TO_CHAR(fecha,'YYYY-MM') AS periodo_docu "
        "FROM CXP.TCXP_DOCUMENTO "
        "WHERE no_cia=:1 AND punto=:2 AND tipo_docu=:3 AND no_docu=:4",
        [no_cia, punto, tipo_docu, no_docu])
```
por:
```python
    rows = client.fetch_dicts(
        "SELECT status, no_proveedor, "
        "TO_CHAR(fecha,'YYYY-MM') AS periodo_docu, "
        "ncf, posiciones_fijas_ncf, rnc, impuesto, itbis_retenido, "
        "isr_retenido, tipo_gasto, tipo_retencion, forma_pago "
        "FROM CXP.TCXP_DOCUMENTO "
        "WHERE no_cia=:1 AND punto=:2 AND tipo_docu=:3 AND no_docu=:4",
        [no_cia, punto, tipo_docu, no_docu])
```

- [ ] **Step 3: Construir el diff y loguear antes del commit**

Justo después de `_no_prov_actual = rows[0].get('no_proveedor')` (línea 1466), agregar:
```python
    _antes = {
        "ncf": rows[0].get("ncf"),
        "posiciones_fijas_ncf": rows[0].get("posiciones_fijas_ncf"),
        "rnc": rows[0].get("rnc"),
        "impuesto": rows[0].get("impuesto"),
        "itbis_retenido": rows[0].get("itbis_retenido"),
        "isr_retenido": rows[0].get("isr_retenido"),
        "tipo_gasto": rows[0].get("tipo_gasto"),
        "tipo_retencion": rows[0].get("tipo_retencion"),
        "forma_pago": rows[0].get("forma_pago"),
    }
```

Reemplazar el final de la función (líneas 1493-1510):
```python
    with client.cursor() as cur:
        _check_ncf_duplicate(cur, no_cia, _no_prov_actual, _ncf_num, _pos_ncf,
                             exclude=(tipo_docu, no_docu))
        cur.execute(
            "UPDATE CXP.TCXP_DOCUMENTO SET "
            "ncf=:1, posiciones_fijas_ncf=:2, rnc=:3, "
            "impuesto=:4, itbis_retenido=:5, isr_retenido=:6, "
            "tipo_gasto=:7, tipo_retencion=:8, forma_pago=:9 "
            "WHERE no_cia=:10 AND punto=:11 AND tipo_docu=:12 AND no_docu=:13",
            [
                _ncf_num, _pos_ncf, d.get('rnc', ''),
                float(d.get('impuesto') or 0),
                float(d.get('itbis_retenido') or 0),
                float(d.get('isr_retenido') or 0),
                _tipo_gasto, _tipo_ret, _forma_pago,
                no_cia, punto, tipo_docu, no_docu,
            ])
        cur.connection.commit()
```
por:
```python
    _despues = {
        "ncf": _ncf_num,
        "posiciones_fijas_ncf": _pos_ncf,
        "rnc": d.get('rnc', ''),
        "impuesto": float(d.get('impuesto') or 0),
        "itbis_retenido": float(d.get('itbis_retenido') or 0),
        "isr_retenido": float(d.get('isr_retenido') or 0),
        "tipo_gasto": _tipo_gasto,
        "tipo_retencion": _tipo_ret,
        "forma_pago": _forma_pago,
    }
    from apps.historial.diff import diff_campos
    _cambios = diff_campos(_antes, _despues, etiquetas={
        "ncf": "NCF", "posiciones_fijas_ncf": "Tipo NCF", "rnc": "RNC",
        "impuesto": "ITBIS", "itbis_retenido": "ITBIS retenido",
        "isr_retenido": "ISR retenido", "tipo_gasto": "Tipo de gasto",
        "tipo_retencion": "Tipo de retención", "forma_pago": "Forma de pago",
    })

    with client.cursor() as cur:
        _check_ncf_duplicate(cur, no_cia, _no_prov_actual, _ncf_num, _pos_ncf,
                             exclude=(tipo_docu, no_docu))
        cur.execute(
            "UPDATE CXP.TCXP_DOCUMENTO SET "
            "ncf=:1, posiciones_fijas_ncf=:2, rnc=:3, "
            "impuesto=:4, itbis_retenido=:5, isr_retenido=:6, "
            "tipo_gasto=:7, tipo_retencion=:8, forma_pago=:9 "
            "WHERE no_cia=:10 AND punto=:11 AND tipo_docu=:12 AND no_docu=:13",
            [
                _ncf_num, _pos_ncf, d.get('rnc', ''),
                float(d.get('impuesto') or 0),
                float(d.get('itbis_retenido') or 0),
                float(d.get('isr_retenido') or 0),
                _tipo_gasto, _tipo_ret, _forma_pago,
                no_cia, punto, tipo_docu, no_docu,
            ])
        historial_repo.log_evento(
            cur, usuario=d.get("usuario", "API"), no_cia=no_cia, punto=punto,
            modulo="CXP", tipo_documento=tipo_docu, no_documento=no_docu,
            accion="EDITAR", cambios=_cambios,
        )
        cur.connection.commit()
```

Nota: `corregir_datos_dgii(d)` no recibía `usuario` — el frontend de `cxp/corregir-ncf.tsx`
debe ahora incluir `usuario` en el body `d` (Task 7b) para que quede correctamente
atribuido; si no viene, cae a `"API"`.

- [ ] **Step 4: Actualizar el caller del backend para pasar `usuario`**

Buscar la vista que llama `corregir_datos_dgii` (`backend/apps/legacy/cxp_views.py`,
la que atiende `POST` en la ruta de corrección DGII) y confirmar que agrega
`request.data` con `usuario` antes de pasarlo al repo — si el body ya se pasa
tal cual (`repo.corregir_datos_dgii(request.data)`), agregar antes de la llamada:
```python
        body = dict(request.data)
        body["usuario"] = request.user.username
        result = repo.corregir_datos_dgii(body)
```
(reemplazando el `result = repo.corregir_datos_dgii(request.data)` existente en esa vista).

- [ ] **Step 5: Syntax check y deploy**

```bash
cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system" && \
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  backend/apps/legacy/repositories/cxp_repo.py backend/apps/legacy/cxp_views.py \
  jcabreu@10.0.0.99:facturation-system/backend/apps/legacy/

plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "python3 -c \"import ast; ast.parse(open('/home/jcabreu/facturation-system/backend/apps/legacy/repositories/cxp_repo.py').read())\" && \
   python3 -c \"import ast; ast.parse(open('/home/jcabreu/facturation-system/backend/apps/legacy/cxp_views.py').read())\""
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add backend/apps/legacy/repositories/cxp_repo.py backend/apps/legacy/cxp_views.py
git commit -m "feat(cxp): instrumenta corregir_datos_dgii con log_evento EDITAR + diff"
```

---

### Task 8: Frontend — `api-client-historial.ts`

**Files:**
- Create: `frontend/src/lib/api-client-historial.ts`

- [ ] **Step 1: Escribir el cliente**

`frontend/src/lib/api-client-historial.ts`:
```typescript
// Endpoints de Historial/Auditoría. Separado del core como reportes/asistente.
import { ApiError } from './api-client'

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    ...init,
  })
  const text = await res.text()
  const body = text ? JSON.parse(text) : null
  if (!res.ok) throw new ApiError(res.status, body)
  return body as T
}

export type CambioCampo = {
  campo: string
  etiqueta: string
  valor_anterior: string
  valor_nuevo: string
}

export type EventoHistorial = {
  bitacora_id: number
  fecha: string
  usuario: string
  modulo: string
  tipo_documento: string
  no_documento: string
  accion: 'CREAR' | 'EDITAR' | 'ANULAR' | 'REVERSAR'
  motivo: string | null
  descripcion: string
  cambios: CambioCampo[]
}

export function historialMio(limit = 10) {
  return request<{ items: EventoHistorial[] }>(`/historial/mio/?limit=${limit}`)
}

export function historialAdmin(params: {
  usuario?: string
  modulo?: string
  tipo_documento?: string
  no_documento?: string
  accion?: string
  fecha_desde?: string
  fecha_hasta?: string
  page?: number
  page_size?: number
}) {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') q.set(k, String(v))
  })
  const qs = q.toString()
  return request<{ items: EventoHistorial[]; total: number }>(
    `/historial/${qs ? `?${qs}` : ''}`
  )
}

export function historialDocumento(params: {
  no_cia: string
  punto: string
  modulo: string
  tipo_documento: string
  no_documento: string
}) {
  const q = new URLSearchParams(params)
  return request<{ items: EventoHistorial[] }>(`/historial/documento/?${q.toString()}`)
}
```

- [ ] **Step 2: Deploy**

```bash
plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "mkdir -p ~/facturation-system/frontend/src/lib"

cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system" && \
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  frontend/src/lib/api-client-historial.ts \
  jcabreu@10.0.0.99:facturation-system/frontend/src/lib/
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api-client-historial.ts
git commit -m "feat(historial): api-client-historial.ts"
```

---

### Task 9: Frontend — componente compartido `HistorialTimeline`

**Files:**
- Create: `frontend/src/features/historial/historial-timeline.tsx`

- [ ] **Step 1: Escribir el componente**

`frontend/src/features/historial/historial-timeline.tsx`:
```tsx
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, XCircle, Undo2 } from 'lucide-react'
import type { EventoHistorial } from '@/lib/api-client-historial'

const ACCION_META: Record<
  EventoHistorial['accion'],
  { label: string; icon: typeof Plus; className: string }
> = {
  CREAR: { label: 'Creó', icon: Plus, className: 'text-emerald-600' },
  EDITAR: { label: 'Editó', icon: Pencil, className: 'text-blue-600' },
  ANULAR: { label: 'Anuló', icon: XCircle, className: 'text-destructive' },
  REVERSAR: { label: 'Reversó', icon: Undo2, className: 'text-amber-600' },
}

function fmtFecha(iso: string) {
  return iso ? iso.replace('T', ' ').slice(0, 16) : ''
}

function esNumero(v: string) {
  return v !== '' && !isNaN(Number(v))
}

interface Props {
  eventos: EventoHistorial[]
  modo?: 'compacto' | 'completo'
  onDocumentoClick?: (evento: EventoHistorial) => void
}

export function HistorialTimeline({ eventos, modo = 'completo', onDocumentoClick }: Props) {
  if (eventos.length === 0) {
    return (
      <div className='text-sm text-muted-foreground py-4 text-center'>
        Sin actividad registrada.
      </div>
    )
  }

  return (
    <div className='space-y-3'>
      {eventos.map((ev) => {
        const meta = ACCION_META[ev.accion]
        const Icon = meta.icon
        return (
          <div key={ev.bitacora_id} className='flex gap-3 border-b pb-3 last:border-0'>
            <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${meta.className}`} />
            <div className='flex-1 min-w-0'>
              <div className='flex items-center gap-2 flex-wrap'>
                <button
                  type='button'
                  className={onDocumentoClick ? 'font-medium hover:underline text-left' : 'font-medium text-left'}
                  onClick={() => onDocumentoClick?.(ev)}
                  disabled={!onDocumentoClick}
                >
                  {ev.descripcion}
                </button>
                <Badge variant='outline' className='font-mono text-xs'>
                  {ev.modulo}
                </Badge>
              </div>
              <div className='text-xs text-muted-foreground'>{fmtFecha(ev.fecha)}</div>
              {ev.motivo && (
                <div className='text-xs text-muted-foreground mt-1'>
                  Motivo: <span className='text-foreground'>{ev.motivo}</span>
                </div>
              )}
              {modo === 'completo' && ev.cambios.length > 0 && (
                <ul className='mt-2 space-y-1 text-xs'>
                  {ev.cambios.map((c) => (
                    <li key={c.campo} className='text-muted-foreground'>
                      <span className='text-foreground'>{c.etiqueta}:</span>{' '}
                      <span className={esNumero(c.valor_anterior) ? 'tabular-nums' : ''}>
                        {c.valor_anterior || '—'}
                      </span>{' '}
                      →{' '}
                      <span className={esNumero(c.valor_nuevo) ? 'tabular-nums font-medium' : 'font-medium'}>
                        {c.valor_nuevo || '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Deploy**

```bash
plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "mkdir -p ~/facturation-system/frontend/src/features/historial"

cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system" && \
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  frontend/src/features/historial/historial-timeline.tsx \
  jcabreu@10.0.0.99:facturation-system/frontend/src/features/historial/
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/historial/historial-timeline.tsx
git commit -m "feat(historial): componente compartido HistorialTimeline"
```

---

### Task 10: Dashboard — card "Mi actividad reciente"

**Files:**
- Modify: `frontend/src/features/dashboard/index.tsx`

- [ ] **Step 1: Agregar el import y el fetch**

Agregar a los imports existentes (junto a `apiClient`):
```tsx
import { historialMio, type EventoHistorial } from '@/lib/api-client-historial'
import { HistorialTimeline } from '@/features/historial/historial-timeline'
import { History } from 'lucide-react'
```

En el estado del componente `Dashboard`, junto a los demás `useState`:
```tsx
  const [miActividad, setMiActividad] = useState<EventoHistorial[]>([])
```

En `load()`, agregar `historialMio(8)` al `Promise.all` existente:
```tsx
      const [meRes, alertsRes, ventasRes, historialRes] = await Promise.all([
        apiClient.me(),
        apiClient.fatNcfAlerts('low').catch(() => ({ alerts: [] })),
        apiClient.dashboardVentasMes('01').catch(() => null),
        historialMio(8).catch(() => ({ items: [] })),
      ])
      setMe(meRes)
      setAlerts(alertsRes.alerts)
      setVentas(ventasRes)
      setMiActividad(historialRes.items)
```
(reemplaza el `Promise.all` de 3 elementos existente por este de 4, y agrega la línea `setMiActividad(...)`).

- [ ] **Step 2: Agregar la card**

Justo antes del cierre `</Main>` (después de la card "Mis accesos por módulo y empresa"), agregar:
```tsx
        {/* Mi actividad reciente */}
        <Card className='mt-4'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <History className='h-5 w-5' />
              Mi actividad reciente
            </CardTitle>
            <CardDescription>
              Tus últimas acciones registradas en el sistema (crear, editar, anular).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className='h-32 w-full' />
            ) : (
              <HistorialTimeline eventos={miActividad} modo='compacto' />
            )}
          </CardContent>
        </Card>
```

- [ ] **Step 3: Deploy**

```bash
cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system" && \
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  frontend/src/features/dashboard/index.tsx \
  jcabreu@10.0.0.99:facturation-system/frontend/src/features/dashboard/
```

- [ ] **Step 4: Smoke test**

```bash
plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "curl -s -o /dev/null -w 'HTTP=%{http_code}\n' http://localhost:5173/"
```

Expected: `HTTP=200`. Revisar `docker logs --tail 30 facturation_frontend` si no.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/dashboard/index.tsx
git commit -m "feat(dashboard): card 'Mi actividad reciente'"
```

---

### Task 11: Página admin `/sistema/historial`

**Files:**
- Create: `frontend/src/features/historial/historial-admin.tsx`
- Create: `frontend/src/routes/_authenticated/sistema/historial.tsx`
- Modify: `frontend/src/components/layout/data/sidebar-data.ts:734-752`

- [ ] **Step 1: Escribir la vista admin**

`frontend/src/features/historial/historial-admin.tsx`:
```tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { historialAdmin } from '@/lib/api-client-historial'
import { HistorialTimeline } from './historial-timeline'

const MODULOS = ['FAT', 'CXC', 'CXP', 'INV', 'ACC', 'CHC', 'SDN', 'ODC', 'ACF', 'CNT', 'MAN']
const ACCIONES = ['CREAR', 'EDITAR', 'ANULAR', 'REVERSAR']
const PAGE_SIZE = 25

export function HistorialAdmin() {
  const [usuario, setUsuario] = useState('')
  const [modulo, setModulo] = useState('')
  const [accion, setAccion] = useState('')
  const [noDocumento, setNoDocumento] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['historial-admin', usuario, modulo, accion, noDocumento, page],
    queryFn: () =>
      historialAdmin({
        usuario: usuario || undefined,
        modulo: modulo || undefined,
        accion: accion || undefined,
        no_documento: noDocumento || undefined,
        page,
        page_size: PAGE_SIZE,
      }),
    placeholderData: (prev) => prev,
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className='space-y-4'>
      <div>
        <h3 className='text-base font-semibold'>Historial / Auditoría</h3>
        <p className='text-sm text-muted-foreground'>
          Todo lo que los usuarios crearon, editaron o anularon en el sistema.
        </p>
      </div>

      <Card>
        <CardContent className='pt-4'>
          <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
            <div>
              <Label className='text-xs'>Usuario</Label>
              <Input value={usuario} onChange={(e) => { setUsuario(e.target.value); setPage(1) }} placeholder='JCABREU' />
            </div>
            <div>
              <Label className='text-xs'>Módulo</Label>
              <Select value={modulo || 'ALL'} onValueChange={(v) => { setModulo(v === 'ALL' ? '' : v); setPage(1) }}>
                <SelectTrigger><SelectValue placeholder='Todos' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='ALL'>Todos</SelectItem>
                  {MODULOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className='text-xs'>Acción</Label>
              <Select value={accion || 'ALL'} onValueChange={(v) => { setAccion(v === 'ALL' ? '' : v); setPage(1) }}>
                <SelectTrigger><SelectValue placeholder='Todas' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='ALL'>Todas</SelectItem>
                  {ACCIONES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className='text-xs'>No. Documento</Label>
              <Input value={noDocumento} onChange={(e) => { setNoDocumento(e.target.value); setPage(1) }} placeholder='0001234' />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Search className='h-5 w-5' />
            Eventos {isFetching && <span className='text-xs text-muted-foreground'>actualizando…</span>}
          </CardTitle>
          <CardDescription>{total} evento(s) encontrados.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='text-sm text-muted-foreground py-4'>Cargando…</div>
          ) : (
            <HistorialTimeline eventos={data?.items ?? []} modo='completo' />
          )}
          <div className='flex items-center justify-between mt-4'>
            <Button variant='outline' size='sm' disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className='h-4 w-4' /> Anterior
            </Button>
            <span className='text-xs text-muted-foreground'>Página {page} de {totalPages}</span>
            <Button variant='outline' size='sm' disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Siguiente <ChevronRight className='h-4 w-4' />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Crear la ruta**

`frontend/src/routes/_authenticated/sistema/historial.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { HistorialAdmin } from '@/features/historial/historial-admin'

export const Route = createFileRoute('/_authenticated/sistema/historial')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <>
      <Header>
        <h2 className='text-lg font-semibold me-auto'>Historial / Auditoría</h2>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main>
        <HistorialAdmin />
      </Main>
    </>
  )
}
```

(Si `frontend/src/routes/_authenticated/sistema/usuarios.tsx` usa un patrón de
`Header`/`Main` distinto, copiar ESE patrón en su lugar para mantener
consistencia visual — revisar ese archivo antes de subir este paso.)

- [ ] **Step 3: Agregar la hoja al sidebar**

En `frontend/src/components/layout/data/sidebar-data.ts`, importar `History` de `lucide-react` junto a los demás íconos (línea ~7):
```typescript
  FileSearch,
  History,
  LayoutDashboard,
```

Y en el grupo `'Sistema'` (líneas 734-752), agregar la hoja después de `'Permisos'`:
```typescript
        {
          title: 'Permisos',
          icon: ShieldCheck,
          url: '/sistema/usuarios',
        },
        {
          title: 'Historial',
          icon: History,
          url: '/sistema/historial',
        },
```

- [ ] **Step 4: Deploy**

```bash
plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "mkdir -p ~/facturation-system/frontend/src/routes/_authenticated/sistema"

cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system" && \
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  frontend/src/features/historial/historial-admin.tsx \
  jcabreu@10.0.0.99:facturation-system/frontend/src/features/historial/

pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  frontend/src/routes/_authenticated/sistema/historial.tsx \
  jcabreu@10.0.0.99:facturation-system/frontend/src/routes/_authenticated/sistema/

pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  frontend/src/components/layout/data/sidebar-data.ts \
  jcabreu@10.0.0.99:facturation-system/frontend/src/components/layout/data/
```

- [ ] **Step 5: Smoke test**

```bash
plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "sleep 5 && curl -s -o /dev/null -w 'HTTP=%{http_code}\n' http://localhost:5173/sistema/historial"
```

Expected: `HTTP=200` (Vite regeneró `routeTree.gen.ts` automáticamente). Si 404,
revisar `docker logs --tail 30 facturation_frontend` — normalmente indica que
`routeTree.gen.ts` no terminó de regenerarse; esperar unos segundos más y
reintentar.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/historial/historial-admin.tsx \
        frontend/src/routes/_authenticated/sistema/historial.tsx \
        frontend/src/components/layout/data/sidebar-data.ts
git commit -m "feat(historial): pagina admin /sistema/historial + entrada en sidebar"
```

---

### Task 12: Tab "Historial" en el detalle de factura FAT

**Files:**
- Modify: `frontend/src/features/fat/factura-detalle-dialog.tsx`
- Modify: `frontend/src/features/fat/fat-facturas.tsx:341-346`

- [ ] **Step 1: Agregar props y el tab al dialog**

En `factura-detalle-dialog.tsx`, agregar el import y ampliar `Props`:
```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useQuery } from '@tanstack/react-query'
import { historialDocumento } from '@/lib/api-client-historial'
import { HistorialTimeline } from '@/features/historial/historial-timeline'
```
```tsx
interface Props {
  factura: FacturaDetalleData | null
  loading: boolean
  onClose: () => void
  onPrint?: () => void
  noCia: string
  punto: string
}
```

Actualizar la firma del componente:
```tsx
export function FacturaDetalleDialog({ factura, loading, onClose, onPrint, noCia, punto }: Props) {
```

Envolver el bloque `{factura && !loading && (...)}` existente (todo el contenido de detalle actual) dentro de un `Tabs`, agregando un segundo tab que dispara la consulta solo cuando está activo:
```tsx
        {loading && <p className='py-8 text-center text-muted-foreground'>Cargando detalle…</p>}
        {factura && !loading && (
          <Tabs defaultValue='datos'>
            <TabsList>
              <TabsTrigger value='datos'>Datos</TabsTrigger>
              <TabsTrigger value='historial'>Historial</TabsTrigger>
            </TabsList>
            <TabsContent value='datos' className='space-y-4 text-sm'>
              {/* contenido existente de detalle: card de datos + tabla de líneas */}
            </TabsContent>
            <TabsContent value='historial'>
              <FacturaHistorialTab
                noCia={noCia} punto={punto}
                tipoDocumento={factura.tipo_factura} noDocumento={factura.no_factura}
              />
            </TabsContent>
          </Tabs>
        )}
```
(mover el `<div className='space-y-4 text-sm'>...</div>` original completo — el
grid de datos y la `<Table>` de líneas — dentro de `<TabsContent value='datos'
className='space-y-4 text-sm'>`, reemplazando el `<div>` wrapper por el
`TabsContent`).

Agregar el sub-componente al final del archivo:
```tsx
function FacturaHistorialTab({
  noCia, punto, tipoDocumento, noDocumento,
}: { noCia: string; punto: string; tipoDocumento: string; noDocumento: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['historial-documento', 'FAT', noCia, punto, tipoDocumento, noDocumento],
    queryFn: () =>
      historialDocumento({ no_cia: noCia, punto, modulo: 'FAT', tipo_documento: tipoDocumento, no_documento: noDocumento }),
  })
  if (isLoading) return <p className='py-8 text-center text-muted-foreground'>Cargando historial…</p>
  return <div className='py-2'><HistorialTimeline eventos={data?.items ?? []} modo='completo' /></div>
}
```

- [ ] **Step 2: Pasar `noCia`/`punto` desde el caller**

En `fat-facturas.tsx`, el componente `FatFacturas` ya recibe `noCia`/`punto` como
props (línea 18: `interface Props { noCia: string; punto: string; mes: number; ano: number }`).
Actualizar la invocación (líneas 341-346):
```tsx
      <FacturaDetalleDialog
        factura={selected}
        loading={loadingDetail}
        onClose={() => setSelected(null)}
        onPrint={printDetail}
        noCia={noCia}
        punto={punto}
      />
```

- [ ] **Step 3: Deploy**

```bash
cd "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system" && \
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  frontend/src/features/fat/factura-detalle-dialog.tsx frontend/src/features/fat/fat-facturas.tsx \
  jcabreu@10.0.0.99:facturation-system/frontend/src/features/fat/
```

- [ ] **Step 4: Smoke test**

```bash
plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "curl -s -o /dev/null -w 'HTTP=%{http_code}\n' http://localhost:5173/fat/facturas"
```

Expected: `HTTP=200`. Revisar consola/logs del contenedor frontend si hay error de tipos que rompa el render (ver "Don't" en la skill de deploy: no correr `npm run build`, confiar en Vite dev).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fat/factura-detalle-dialog.tsx frontend/src/features/fat/fat-facturas.tsx
git commit -m "feat(fat): tab 'Historial' en el detalle de factura"
```

---

### Task 13: Verificación end-to-end en la VM

**Files:** (ninguno — solo verificación manual con datos reales de prueba)

- [ ] **Step 1: Crear una factura de prueba y verificar CREAR**

```bash
plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "rm -f /tmp/cookie.txt && \
   curl -s -c /tmp/cookie.txt -X POST -H 'Content-Type: application/json' \
        -d '{\"username\":\"JCABREU\",\"password\":\"Temp1234!\"}' \
        http://localhost:8000/api/auth/login/ -w '\nLOGIN=%{http_code}\n' && \
   curl -s -b /tmp/cookie.txt 'http://localhost:8000/api/historial/mio/?limit=5' -w '\nHTTP=%{http_code}\n'"
```

Confirmar manualmente en el navegador (o repetir con `curl`) que, después de
crear una factura desde `/fat/nueva-factura` y anularla desde
`/fat/anular-factura`, ambos eventos aparecen en `GET /api/historial/mio/` con
`accion` `CREAR` y `ANULAR` respectivamente, y que el evento `ANULAR` trae el
`motivo` que se escribió en el diálogo de anulación.

- [ ] **Step 2: Corregir NCF en CXP y verificar EDITAR con diff**

Desde `/cxp/corregir-ncf`, corregir el NCF de un documento de prueba del
período contable en curso. Confirmar con:
```bash
plink -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" jcabreu@10.0.0.99 \
  "curl -s -b /tmp/cookie.txt 'http://localhost:8000/api/historial/?modulo=CXP&accion=EDITAR&page_size=1' -w '\nHTTP=%{http_code}\n'"
```
Expected: `HTTP=200`, `items[0].cambios` contiene al menos una entrada con
`campo: "ncf"` y los valores anterior/nuevo correctos.

- [ ] **Step 3: Verificar las 3 superficies en el navegador**

- Dashboard (`/`) → card "Mi actividad reciente" muestra los eventos de arriba.
- `/sistema/historial` (como JCABREU, que es DBA) → tabla admin muestra los
  mismos eventos, filtrables por módulo/acción/usuario.
- `/fat/facturas` → abrir el detalle de la factura creada en el Step 1 → tab
  "Historial" muestra el evento CREAR (y ANULAR si se anuló esa misma).

- [ ] **Step 4: Actualizar la memoria del proyecto**

Una vez verificado, anotar en memoria (`project_sigaft_historial_auditoria.md`)
que la Fase base quedó desplegada y validada en la VM, con fecha y los 3
endpoints/módulos piloto cubiertos — para que la próxima sesión sepa que la
Fase de cobertura (resto de los 9 módulos) puede arrancar sin re-descubrir el
mecanismo.
