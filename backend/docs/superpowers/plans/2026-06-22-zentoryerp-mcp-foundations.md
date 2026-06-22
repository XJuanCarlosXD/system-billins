# ZentoryERP MCP — Plan 1: Foundations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levantar el servidor MCP HTTP `/mcp/` con auth Bearer por usuario, vista admin para emitir/revocar tokens, vista de monitoreo del uso, proxy a memory-router y registry de tipos de documento. Al final del plan un cliente MCP real (Claude Desktop) se conecta y puede usar `memoria_*` y `doc_tipos_*` end-to-end. Las tools por módulo (FAT, CNT, INV, etc.) van en planes siguientes.

**Architecture:** App Django `apps/mcp/` integrada al backend existente, expone `/mcp/` (FastMCP montado en ASGI) y `/api/admin/mcp/...` (admin DRF). Tokens hasheados SHA-256 en tabla Oracle `TMCP_TOKEN`, auditoría en `TMCP_TOKEN_USO`. Resolver de contexto cascada cia/punto (libre/default/bloqueado). Frontend React con dos rutas nuevas bajo `/admin/mcp/`.

**Tech Stack:** Django 5 + DRF + oracledb + `mcp` (Anthropic SDK) + `httpx` (proxy memory-router) + Pydantic v2 + React + React Query + shadcn/ui + Recharts.

**Spec:** `backend/docs/superpowers/specs/2026-06-22-zentoryerp-mcp-service-design.md`

---

## File map (Plan 1)

### Backend nuevos
- `apps/mcp/__init__.py`
- `apps/mcp/apps.py`
- `apps/mcp/migrations/__init__.py`
- `apps/mcp/migrations/0001_initial.py` — RunSQL crea `TMCP_TOKEN` y `TMCP_TOKEN_USO`
- `apps/mcp/tokens.py` — generación, hash, lookup con cache LRU
- `apps/mcp/auth.py` — middleware Bearer → usuario+contexto
- `apps/mcp/context_resolver.py` — cascada cia/punto
- `apps/mcp/audit.py` — insert en `TMCP_TOKEN_USO`
- `apps/mcp/ratelimit.py` — 60 calls/min in-memory
- `apps/mcp/memory_proxy.py` — cliente HTTP a memory-router
- `apps/mcp/doc_types.py` — registry declarativo (shell + 2 entradas demo)
- `apps/mcp/envelope.py` — helpers `ok()` / `error(code, msg, detail)`
- `apps/mcp/server.py` — monta FastMCP en `/mcp/`
- `apps/mcp/tools/__init__.py`
- `apps/mcp/tools/memoria.py` — 5 tools proxy memory-router
- `apps/mcp/tools/doc_types_tools.py` — `doc_tipos_listar` + `doc_tipos_describir`
- `apps/mcp/views_admin.py` — endpoints `/api/admin/mcp/`
- `apps/mcp/views_usage.py` — endpoint `/api/admin/mcp/usage/`
- `apps/mcp/urls.py`
- `apps/mcp/tests/__init__.py`
- `apps/mcp/tests/test_tokens.py`
- `apps/mcp/tests/test_auth.py`
- `apps/mcp/tests/test_context_resolver.py`
- `apps/mcp/tests/test_audit.py`
- `apps/mcp/tests/test_ratelimit.py`
- `apps/mcp/tests/test_admin_tokens.py`
- `apps/mcp/tests/test_admin_usage.py`
- `apps/mcp/tests/test_memory_proxy.py`
- `apps/mcp/tests/test_doc_types_tools.py`
- `apps/mcp/tests/test_server_smoke.py`

### Backend modificados
- `backend/facturation_api/settings.py` — `INSTALLED_APPS += ["apps.mcp"]`, env vars `MEMORY_ROUTER_URL/TOKEN/PROJECT`, `MCP_TOKEN_CACHE_TTL`
- `backend/facturation_api/urls.py` — `path("", include("apps.mcp.urls"))`
- `backend/facturation_api/asgi.py` — mount `/mcp/` (FastMCP)
- `backend/requirements.txt` — `mcp`, `httpx`, `pydantic>=2`

### Frontend nuevos
- `frontend/src/features/admin/mcp/api.ts` — React Query hooks
- `frontend/src/features/admin/mcp/types.ts`
- `frontend/src/features/admin/mcp/routes/mcp-tokens-page.tsx`
- `frontend/src/features/admin/mcp/routes/mcp-usage-page.tsx`
- `frontend/src/features/admin/mcp/components/token-list.tsx`
- `frontend/src/features/admin/mcp/components/new-token-dialog.tsx`
- `frontend/src/features/admin/mcp/components/token-generated-dialog.tsx`
- `frontend/src/features/admin/mcp/components/token-usage-drawer.tsx`
- `frontend/src/features/admin/mcp/components/revoke-confirm.tsx`
- `frontend/src/features/admin/mcp/components/usage-kpis.tsx`
- `frontend/src/features/admin/mcp/components/usage-timeseries.tsx`
- `frontend/src/features/admin/mcp/components/usage-top-tools.tsx`
- `frontend/src/features/admin/mcp/components/usage-top-users.tsx`
- `frontend/src/features/admin/mcp/components/usage-recent-errors.tsx`
- `frontend/src/routes/_authenticated/admin/mcp/tokens.tsx`
- `frontend/src/routes/_authenticated/admin/mcp/usage.tsx`

### Frontend modificados
- `frontend/src/components/layout/data/sidebar-data.ts` — entradas "MCP Tokens" y "MCP Usage" bajo "Administración", gateadas por `is_dba`

---

## Task 1: Bootstrap app `apps/mcp/` y registrar en Django

**Files:**
- Create: `backend/apps/mcp/__init__.py`
- Create: `backend/apps/mcp/apps.py`
- Modify: `backend/facturation_api/settings.py` (sección INSTALLED_APPS + env vars MCP)
- Modify: `backend/requirements.txt`

- [x] **Step 1: Crear `apps/mcp/__init__.py` vacío**

```python
```

- [x] **Step 2: Crear `apps/mcp/apps.py`**

```python
from django.apps import AppConfig


class McpConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.mcp"
    label = "mcp"
    verbose_name = "ZentoryERP MCP"
```

- [x] **Step 3: Modificar `backend/facturation_api/settings.py`**

Localizar `INSTALLED_APPS` y agregar `"apps.mcp"` al final del bloque local. Luego al final del archivo agregar:

```python
# === ZentoryERP MCP ===
MEMORY_ROUTER_URL = os.environ.get("MEMORY_ROUTER_URL", "")
MEMORY_ROUTER_TOKEN = os.environ.get("MEMORY_ROUTER_TOKEN", "")
MEMORY_ROUTER_PROJECT = os.environ.get("MEMORY_ROUTER_PROJECT", "facture-project")
MCP_TOKEN_CACHE_TTL = int(os.environ.get("MCP_TOKEN_CACHE_TTL", "60"))
MCP_RATELIMIT_PER_MIN = int(os.environ.get("MCP_RATELIMIT_PER_MIN", "60"))
MCP_DOWNLOAD_TTL_SECONDS = int(os.environ.get("MCP_DOWNLOAD_TTL_SECONDS", "900"))
```

- [x] **Step 4: Modificar `backend/requirements.txt`**

Agregar al final:

```
mcp>=1.0
httpx>=0.27
pydantic>=2.6
```

- [x] **Step 5: Verificar que Django importa la app**

Run: `cd backend && python manage.py check`
Expected: `System check identified no issues (0 silenced).`

- [x] **Step 6: Commit**

```bash
git add backend/apps/mcp/ backend/facturation_api/settings.py backend/requirements.txt
git commit -m "feat(mcp): bootstrap apps/mcp y dependencias base"
```

---

## Task 2: Migration Oracle para TMCP_TOKEN y TMCP_TOKEN_USO

> **PIVOT 2026-06-22 (executor):** Django `default` DB del proyecto es SQLite (settings.py:70). El Oracle legado se accede vía `apps.legacy.client`, NO vía Django ORM/migrations — ninguna otra app tiene carpeta `migrations/`. Por eso la `RunSQL` original fallaba con `unknown database ABREGONZA` (intentaba ejecutar contra SQLite). Reemplazado por DDL plano `migrations/0001_initial.sql` aplicado con `apps.legacy.client.cursor()` (script Python en el container backend). El `.sql` queda versionado como source-of-truth del schema.

**Files:**
- Create: `backend/apps/mcp/migrations/__init__.py` (vacío)
- Create: `backend/apps/mcp/migrations/0001_initial.sql` (DDL Oracle, NO Django RunSQL)

- [x] **Step 1: Crear `migrations/__init__.py` vacío**

```python
```

- [x] **Step 2: Crear `migrations/0001_initial.sql`** (pivot — ver nota arriba)

```python
from django.db import migrations


SQL_UP = [
    """
    CREATE TABLE ABREGONZA.TMCP_TOKEN (
        TOKEN_ID         VARCHAR2(36) NOT NULL,
        USUARIO          VARCHAR2(30) NOT NULL,
        NO_CIA           VARCHAR2(2),
        BLOQUEAR_CIA     CHAR(1)      DEFAULT 'N' NOT NULL,
        PUNTO            VARCHAR2(2),
        BLOQUEAR_PUNTO   CHAR(1)      DEFAULT 'N' NOT NULL,
        NOMBRE           VARCHAR2(100) NOT NULL,
        TOKEN_HASH       VARCHAR2(128) NOT NULL,
        PREFIJO          VARCHAR2(8)   NOT NULL,
        FECHA_CREACION   DATE          DEFAULT SYSDATE NOT NULL,
        FECHA_EXPIRA     DATE,
        FECHA_ULTIMO_USO DATE,
        IP_ULTIMO_USO    VARCHAR2(45),
        ST_ACTIVO        CHAR(1)       DEFAULT 'S' NOT NULL,
        CREADO_POR       VARCHAR2(30)  NOT NULL,
        CONSTRAINT PK_TMCP_TOKEN PRIMARY KEY (TOKEN_ID),
        CONSTRAINT UQ_TMCP_TOKEN_HASH UNIQUE (TOKEN_HASH),
        CONSTRAINT CK_TMCP_TOKEN_BLOQUEAR_CIA   CHECK (BLOQUEAR_CIA   IN ('S','N')),
        CONSTRAINT CK_TMCP_TOKEN_BLOQUEAR_PUNTO CHECK (BLOQUEAR_PUNTO IN ('S','N')),
        CONSTRAINT CK_TMCP_TOKEN_ST_ACTIVO      CHECK (ST_ACTIVO      IN ('S','N'))
    )
    """,
    """
    CREATE INDEX IX_TMCP_TOKEN_USUARIO   ON ABREGONZA.TMCP_TOKEN (USUARIO)
    """,
    """
    CREATE INDEX IX_TMCP_TOKEN_ACTIVO    ON ABREGONZA.TMCP_TOKEN (ST_ACTIVO, FECHA_EXPIRA)
    """,
    """
    CREATE TABLE ABREGONZA.TMCP_TOKEN_USO (
        USO_ID         NUMBER(15) NOT NULL,
        TOKEN_ID       VARCHAR2(36) NOT NULL,
        FECHA          DATE         DEFAULT SYSDATE NOT NULL,
        TOOL           VARCHAR2(80) NOT NULL,
        PARAMS_HASH    VARCHAR2(64),
        IP             VARCHAR2(45),
        OK             CHAR(1)      DEFAULT 'S' NOT NULL,
        ERROR_CODE     VARCHAR2(40),
        DURATION_MS    NUMBER(10),
        CONSTRAINT PK_TMCP_TOKEN_USO PRIMARY KEY (USO_ID),
        CONSTRAINT CK_TMCP_TOKEN_USO_OK CHECK (OK IN ('S','N'))
    )
    """,
    """
    CREATE SEQUENCE ABREGONZA.SQ_TMCP_TOKEN_USO START WITH 1 INCREMENT BY 1 NOCACHE
    """,
    """
    CREATE INDEX IX_TMCP_TOKEN_USO_FECHA       ON ABREGONZA.TMCP_TOKEN_USO (FECHA DESC)
    """,
    """
    CREATE INDEX IX_TMCP_TOKEN_USO_TOKEN_FECHA ON ABREGONZA.TMCP_TOKEN_USO (TOKEN_ID, FECHA DESC)
    """,
    """
    CREATE INDEX IX_TMCP_TOKEN_USO_TOOL_FECHA  ON ABREGONZA.TMCP_TOKEN_USO (TOOL, FECHA DESC)
    """,
]

SQL_DOWN = [
    "DROP INDEX IX_TMCP_TOKEN_USO_TOOL_FECHA",
    "DROP INDEX IX_TMCP_TOKEN_USO_TOKEN_FECHA",
    "DROP INDEX IX_TMCP_TOKEN_USO_FECHA",
    "DROP SEQUENCE ABREGONZA.SQ_TMCP_TOKEN_USO",
    "DROP TABLE ABREGONZA.TMCP_TOKEN_USO",
    "DROP INDEX IX_TMCP_TOKEN_ACTIVO",
    "DROP INDEX IX_TMCP_TOKEN_USUARIO",
    "DROP TABLE ABREGONZA.TMCP_TOKEN",
]


class Migration(migrations.Migration):
    initial = True
    dependencies = []
    operations = [
        migrations.RunSQL(sql=stmt, reverse_sql=down)
        for stmt, down in zip(SQL_UP, list(reversed(SQL_DOWN)))
    ]
```

- [x] **Step 3: Aplicar migration en VM (Oracle real)** — aplicado via `client.cursor()` en container backend

Subir archivo y migrar:

```bash
pscp -batch backend/apps/mcp/migrations/0001_initial.py jcabreu@10.0.0.99:/home/jcabreu/facturation-system/backend/apps/mcp/migrations/
plink -batch jcabreu@10.0.0.99 "cd /home/jcabreu/facturation-system && docker compose exec -T backend python manage.py migrate mcp"
```

Expected: `Applying mcp.0001_initial... OK`

- [x] **Step 4: Verificar tablas creadas** — `ALL_TABLES` devuelve `TMCP_TOKEN` y `TMCP_TOKEN_USO`

Run: `plink -batch jcabreu@10.0.0.99 "echo 'SELECT TABLE_NAME FROM ALL_TABLES WHERE OWNER=\\'ABREGONZA\\' AND TABLE_NAME LIKE \\'TMCP_%\\';' | sqlplus -s JCABREU/508192003@AB"`
Expected: dos filas `TMCP_TOKEN` y `TMCP_TOKEN_USO`.

- [x] **Step 5: Commit**

```bash
git add backend/apps/mcp/migrations/
git commit -m "feat(mcp): migration tablas TMCP_TOKEN y TMCP_TOKEN_USO"
```

---

## Task 3: Tokens (generación, hash, lookup)

> **PIVOT 2026-06-22 (executor):** Igual que Task 2, `tokens.py` usa `apps.legacy.client` (Oracle) en vez de `django.db.connection` (SQLite). Binding `:1, :2` en vez de `%s`. Tambien anadido `backend/pytest.ini` + `pytest`/`pytest-django` a requirements para poder correr la suite TDD del plan.

**Files:**
- Create: `backend/apps/mcp/tokens.py`
- Create: `backend/apps/mcp/tests/__init__.py` (vacío)
- Create: `backend/apps/mcp/tests/test_tokens.py`
- Create: `backend/pytest.ini` (nuevo — pytest discovery)

- [x] **Step 1: Crear `apps/mcp/tests/__init__.py` vacío**

```python
```

- [x] **Step 2: Write the failing test `apps/mcp/tests/test_tokens.py`**

```python
import hashlib
import re

import pytest

from apps.mcp import tokens


def test_generate_token_format():
    plaintext, prefijo = tokens.generate_token_plaintext()
    assert re.fullmatch(r"mcp_[a-zA-Z0-9]{8}_[a-zA-Z0-9]{32}", plaintext)
    assert plaintext.startswith(f"mcp_{prefijo}_")
    assert len(prefijo) == 8


def test_hash_token_is_sha256_hex():
    h = tokens.hash_token("mcp_abcdefgh_" + "X" * 32)
    assert re.fullmatch(r"[0-9a-f]{64}", h)
    expected = hashlib.sha256(("mcp_abcdefgh_" + "X" * 32).encode()).hexdigest()
    assert h == expected


def test_extract_prefix():
    assert tokens.extract_prefix("mcp_abcdefgh_zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz") == "abcdefgh"


def test_extract_prefix_invalid_returns_none():
    assert tokens.extract_prefix("not-a-token") is None
    assert tokens.extract_prefix("") is None
```

- [x] **Step 3: Run test to verify it fails** — fall? con `ImportError: cannot import name 'tokens'`

- [x] **Step 4: Implementar `apps/mcp/tokens.py`** (adaptado a apps.legacy.client + binding :N)

```python
"""Generación, hash y validación de tokens MCP.

Formato: mcp_<prefijo8>_<random32>. Solo el SHA-256 del plaintext se persiste.
"""
from __future__ import annotations

import hashlib
import re
import secrets
import time
from dataclasses import dataclass
from typing import Optional

from django.conf import settings
from django.db import connection


_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
_TOKEN_RE = re.compile(r"^mcp_([a-zA-Z0-9]{8})_([a-zA-Z0-9]{32})$")


def _rand(n: int) -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(n))


def generate_token_plaintext() -> tuple[str, str]:
    prefijo = _rand(8)
    body = _rand(32)
    return f"mcp_{prefijo}_{body}", prefijo


def hash_token(plaintext: str) -> str:
    return hashlib.sha256(plaintext.encode("utf-8")).hexdigest()


def extract_prefix(plaintext: str) -> Optional[str]:
    if not plaintext:
        return None
    m = _TOKEN_RE.match(plaintext)
    return m.group(1) if m else None


@dataclass
class TokenContext:
    token_id: str
    usuario: str
    no_cia: Optional[str]
    bloquear_cia: bool
    punto: Optional[str]
    bloquear_punto: bool
    fecha_expira: Optional[str]


# === Cache LRU manual (ttl) ===
_CACHE: dict[str, tuple[float, Optional[TokenContext]]] = {}


def _cache_get(key: str) -> Optional[TokenContext]:
    now = time.time()
    v = _CACHE.get(key)
    if v is None:
        return None
    expires, ctx = v
    if now > expires:
        _CACHE.pop(key, None)
        return None
    return ctx


def _cache_put(key: str, ctx: Optional[TokenContext]) -> None:
    ttl = getattr(settings, "MCP_TOKEN_CACHE_TTL", 60)
    _CACHE[key] = (time.time() + ttl, ctx)


def lookup_token(plaintext: str) -> Optional[TokenContext]:
    """Resuelve un Bearer plaintext a TokenContext, None si inválido/expirado/revocado."""
    prefijo = extract_prefix(plaintext)
    if prefijo is None:
        return None
    h = hash_token(plaintext)

    cached = _cache_get(h)
    if cached is not None:
        return cached

    with connection.cursor() as cur:
        cur.execute(
            """
            SELECT TOKEN_ID, USUARIO, NO_CIA, BLOQUEAR_CIA, PUNTO, BLOQUEAR_PUNTO,
                   TO_CHAR(FECHA_EXPIRA, 'YYYY-MM-DD"T"HH24:MI:SS')
              FROM ABREGONZA.TMCP_TOKEN
             WHERE PREFIJO = %s
               AND TOKEN_HASH = %s
               AND ST_ACTIVO = 'S'
               AND (FECHA_EXPIRA IS NULL OR FECHA_EXPIRA > SYSDATE)
            """,
            [prefijo, h],
        )
        row = cur.fetchone()

    if row is None:
        _cache_put(h, None)
        return None

    ctx = TokenContext(
        token_id=row[0],
        usuario=row[1],
        no_cia=row[2],
        bloquear_cia=row[3] == "S",
        punto=row[4],
        bloquear_punto=row[5] == "S",
        fecha_expira=row[6],
    )
    _cache_put(h, ctx)
    return ctx


def touch_token(token_id: str, ip: Optional[str]) -> None:
    """Actualiza FECHA_ULTIMO_USO y IP_ULTIMO_USO. Best-effort."""
    with connection.cursor() as cur:
        cur.execute(
            """
            UPDATE ABREGONZA.TMCP_TOKEN
               SET FECHA_ULTIMO_USO = SYSDATE, IP_ULTIMO_USO = %s
             WHERE TOKEN_ID = %s
            """,
            [ip[:45] if ip else None, token_id],
        )


def invalidate_cache(token_hash: Optional[str] = None) -> None:
    if token_hash is None:
        _CACHE.clear()
    else:
        _CACHE.pop(token_hash, None)


def create_token_row(
    *,
    usuario: str,
    nombre: str,
    no_cia: Optional[str],
    bloquear_cia: bool,
    punto: Optional[str],
    bloquear_punto: bool,
    fecha_expira_iso: Optional[str],
    creado_por: str,
) -> tuple[str, str]:
    """Inserta una fila en TMCP_TOKEN. Devuelve (token_id, plaintext)."""
    import uuid

    token_id = str(uuid.uuid4())
    plaintext, prefijo = generate_token_plaintext()
    token_hash = hash_token(plaintext)

    with connection.cursor() as cur:
        cur.execute(
            """
            INSERT INTO ABREGONZA.TMCP_TOKEN
              (TOKEN_ID, USUARIO, NO_CIA, BLOQUEAR_CIA, PUNTO, BLOQUEAR_PUNTO,
               NOMBRE, TOKEN_HASH, PREFIJO, FECHA_EXPIRA, ST_ACTIVO, CREADO_POR)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s,
                    TO_DATE(%s, 'YYYY-MM-DD"T"HH24:MI:SS'), 'S', %s)
            """,
            [
                token_id, usuario, no_cia, "S" if bloquear_cia else "N",
                punto, "S" if bloquear_punto else "N",
                nombre, token_hash, prefijo, fecha_expira_iso, creado_por,
            ],
        )
    return token_id, plaintext


def revoke_token(token_id: str) -> bool:
    with connection.cursor() as cur:
        cur.execute(
            "UPDATE ABREGONZA.TMCP_TOKEN SET ST_ACTIVO='N' WHERE TOKEN_ID=%s",
            [token_id],
        )
        return cur.rowcount > 0
```

- [x] **Step 5: Run test to verify it passes** — 4 passed in 0.14s

- [x] **Step 6: Commit**

---

## Task 4: Resolver de contexto cia/punto (cascada)

**Files:**
- Create: `backend/apps/mcp/context_resolver.py`
- Create: `backend/apps/mcp/envelope.py`
- Create: `backend/apps/mcp/tests/test_context_resolver.py`

- [x] **Step 1: Crear `apps/mcp/envelope.py`**

```python
"""Envelope uniforme para respuestas MCP: {ok, data | error_code, message, detail}."""
from typing import Any, Optional


def ok(data: Any) -> dict:
    return {"ok": True, "data": data}


def error(code: str, message: str, detail: Optional[dict] = None) -> dict:
    out = {"ok": False, "error_code": code, "message": message}
    if detail is not None:
        out["detail"] = detail
    return out


class MCPError(Exception):
    def __init__(self, code: str, message: str, detail: Optional[dict] = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.detail = detail or {}

    def as_dict(self) -> dict:
        return error(self.code, self.message, self.detail)
```

- [x] **Step 2: Write the failing test `apps/mcp/tests/test_context_resolver.py`**

```python
import pytest

from apps.mcp.context_resolver import resolve_context
from apps.mcp.envelope import MCPError
from apps.mcp.tokens import TokenContext


def _tok(**kw):
    base = dict(
        token_id="t1", usuario="JCABREU",
        no_cia=None, bloquear_cia=False,
        punto=None, bloquear_punto=False,
        fecha_expira=None,
    )
    base.update(kw)
    return TokenContext(**base)


ACCESS = {
    "01": ["01", "02"],
    "02": ["01"],
}


def test_locked_cia_uses_token_value():
    ctx = _tok(no_cia="01", bloquear_cia=True, punto="01", bloquear_punto=True)
    out = resolve_context(ctx, arg_no_cia=None, arg_punto=None, access=ACCESS)
    assert out == ("01", "01")


def test_locked_cia_rejects_override():
    ctx = _tok(no_cia="01", bloquear_cia=True)
    with pytest.raises(MCPError) as exc:
        resolve_context(ctx, arg_no_cia="02", arg_punto=None, access=ACCESS)
    assert exc.value.code == "VALIDATION_ERROR"
    assert exc.value.detail["campo"] == "no_cia"


def test_arg_overrides_token_default():
    ctx = _tok(no_cia="01", bloquear_cia=False, punto="01", bloquear_punto=False)
    out = resolve_context(ctx, arg_no_cia="02", arg_punto="01", access=ACCESS)
    assert out == ("02", "01")


def test_token_default_used_when_no_arg():
    ctx = _tok(no_cia="01", punto="02")
    out = resolve_context(ctx, arg_no_cia=None, arg_punto=None, access=ACCESS)
    assert out == ("01", "02")


def test_single_access_used_as_default():
    ctx = _tok()
    out = resolve_context(ctx, arg_no_cia=None, arg_punto=None, access={"03": ["09"]})
    assert out == ("03", "09")


def test_missing_context_raises_with_options():
    ctx = _tok()
    with pytest.raises(MCPError) as exc:
        resolve_context(ctx, arg_no_cia=None, arg_punto=None, access=ACCESS)
    assert exc.value.code == "MISSING_CONTEXT"
    assert exc.value.detail["campo_faltante"] == "no_cia"
    assert "01" in [e["no_cia"] for e in exc.value.detail["empresas_disponibles"]]


def test_arg_cia_not_accessible_fails():
    ctx = _tok()
    with pytest.raises(MCPError) as exc:
        resolve_context(ctx, arg_no_cia="99", arg_punto=None, access=ACCESS)
    assert exc.value.code == "PERMISSION_DENIED"
```

- [x] **Step 3: Run test to verify it fails** — skipped explicit fail-run; deterministic ImportError since context_resolver.py no existia

Run: `cd backend && pytest apps/mcp/tests/test_context_resolver.py -v`
Expected: ImportError for `resolve_context`.

- [x] **Step 4: Implementar `apps/mcp/context_resolver.py`**

```python
"""Resuelve (no_cia, punto) efectivos para una llamada MCP.

Cascada:
  1. Si token.bloquear_cia: cia = token.no_cia; arg distinto -> VALIDATION_ERROR
  2. Si arg presente: validar contra access, usar arg
  3. Si token.no_cia presente (default): usar token.no_cia
  4. Si access tiene exactamente 1 cia: usar esa
  5. Si no: MISSING_CONTEXT con empresas disponibles
Mismo flujo para PUNTO sobre puntos del cia resuelto.
"""
from typing import Optional

from .envelope import MCPError
from .tokens import TokenContext


def _resolve_dim(
    dim: str,
    bloqueado: bool,
    token_val: Optional[str],
    arg_val: Optional[str],
    opciones: list[str],
) -> str:
    if bloqueado:
        if token_val is None:
            raise MCPError(
                "VALIDATION_ERROR",
                f"Token bloqueado sin {dim} configurado",
                {"campo": dim},
            )
        if arg_val is not None and arg_val != token_val:
            raise MCPError(
                "VALIDATION_ERROR",
                f"Token bloqueado a {dim} {token_val}, no se permite override.",
                {"campo": dim, "valor_token": token_val, "valor_recibido": arg_val},
            )
        return token_val

    if arg_val is not None:
        if arg_val not in opciones:
            raise MCPError(
                "PERMISSION_DENIED",
                f"Usuario sin acceso a {dim}={arg_val}",
                {"campo": dim, "valor_recibido": arg_val, "disponibles": opciones},
            )
        return arg_val

    if token_val is not None:
        if token_val not in opciones:
            raise MCPError(
                "PERMISSION_DENIED",
                f"Default del token ({dim}={token_val}) ya no es accesible para el usuario",
                {"campo": dim, "valor_token": token_val, "disponibles": opciones},
            )
        return token_val

    if len(opciones) == 1:
        return opciones[0]

    raise MCPError(
        "MISSING_CONTEXT",
        f"El token no fija {dim} por defecto y el usuario tiene acceso a varias opciones.",
        {"campo_faltante": dim, "opciones_disponibles": opciones},
    )


def resolve_context(
    token: TokenContext,
    *,
    arg_no_cia: Optional[str],
    arg_punto: Optional[str],
    access: dict[str, list[str]],
) -> tuple[str, str]:
    """access: { no_cia: [puntos] } al que tiene acceso el usuario."""
    cias = list(access.keys())

    try:
        cia = _resolve_dim(
            "no_cia",
            token.bloquear_cia,
            token.no_cia,
            arg_no_cia,
            cias,
        )
    except MCPError as e:
        if e.code == "MISSING_CONTEXT":
            e.detail["empresas_disponibles"] = [
                {"no_cia": c, "descripcion": ""} for c in cias
            ]
        raise

    puntos = access.get(cia, [])
    try:
        punto = _resolve_dim(
            "punto",
            token.bloquear_punto,
            token.punto,
            arg_punto,
            puntos,
        )
    except MCPError as e:
        if e.code == "MISSING_CONTEXT":
            e.detail["puntos_disponibles"] = [
                {"no_cia": cia, "punto": p} for p in puntos
            ]
        raise

    return cia, punto
```

- [x] **Step 5: Run test to verify it passes** — 7 passed in 0.23s (VM, docker compose exec backend pytest)

Run: `cd backend && pytest apps/mcp/tests/test_context_resolver.py -v`
Expected: 7 tests PASS.

- [x] **Step 6: Commit**

```bash
git add backend/apps/mcp/context_resolver.py backend/apps/mcp/envelope.py backend/apps/mcp/tests/test_context_resolver.py
git commit -m "feat(mcp): resolver de contexto cia/punto + envelope uniforme"
```

---

## Task 5: Auth middleware MCP (Bearer → TokenContext)

**Files:**
- Create: `backend/apps/mcp/auth.py`
- Create: `backend/apps/mcp/tests/test_auth.py`

- [x] **Step 1: Write the failing test `apps/mcp/tests/test_auth.py`**

```python
from unittest.mock import patch

import pytest

from apps.mcp.auth import authenticate_bearer, AuthError
from apps.mcp.tokens import TokenContext


def _ctx():
    return TokenContext(
        token_id="t1", usuario="JCABREU",
        no_cia="01", bloquear_cia=False,
        punto="01", bloquear_punto=False,
        fecha_expira=None,
    )


def test_authenticate_returns_context_for_valid_bearer():
    with patch("apps.mcp.auth.lookup_token", return_value=_ctx()) as lk, \
         patch("apps.mcp.auth.touch_token") as touch:
        ctx = authenticate_bearer("Bearer mcp_abcdefgh_" + "X" * 32, ip="1.2.3.4")
    assert ctx.token_id == "t1"
    lk.assert_called_once()
    touch.assert_called_once_with("t1", "1.2.3.4")


def test_missing_header_raises():
    with pytest.raises(AuthError) as exc:
        authenticate_bearer(None, ip=None)
    assert exc.value.code == "MISSING_AUTH"


def test_wrong_scheme_raises():
    with pytest.raises(AuthError) as exc:
        authenticate_bearer("Basic abc", ip=None)
    assert exc.value.code == "MISSING_AUTH"


def test_invalid_token_raises():
    with patch("apps.mcp.auth.lookup_token", return_value=None):
        with pytest.raises(AuthError) as exc:
            authenticate_bearer("Bearer mcp_zzzzzzzz_" + "Y" * 32, ip=None)
    assert exc.value.code == "INVALID_TOKEN"
```

- [x] **Step 2: Run test to verify it fails** — deterministic ImportError sin auth.py; skipped explicit fail-run

Run: `cd backend && pytest apps/mcp/tests/test_auth.py -v`
Expected: ImportError.

- [x] **Step 3: Implementar `apps/mcp/auth.py`**

```python
"""Middleware Bearer → TokenContext para tools MCP."""
from typing import Optional

from .tokens import lookup_token, touch_token, TokenContext


class AuthError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def authenticate_bearer(authorization_header: Optional[str], *, ip: Optional[str]) -> TokenContext:
    if not authorization_header:
        raise AuthError("MISSING_AUTH", "Falta header Authorization")
    parts = authorization_header.strip().split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1]:
        raise AuthError("MISSING_AUTH", "Header Authorization debe ser 'Bearer <token>'")

    plaintext = parts[1].strip()
    ctx = lookup_token(plaintext)
    if ctx is None:
        raise AuthError("INVALID_TOKEN", "Token inválido, expirado o revocado")

    try:
        touch_token(ctx.token_id, ip)
    except Exception:
        # touch es best-effort; no rompe la auth
        pass

    return ctx
```

- [x] **Step 4: Run test to verify it passes** — 4 passed in 0.18s (VM)

Run: `cd backend && pytest apps/mcp/tests/test_auth.py -v`
Expected: 4 tests PASS.

- [x] **Step 5: Commit**

```bash
git add backend/apps/mcp/auth.py backend/apps/mcp/tests/test_auth.py
git commit -m "feat(mcp): auth Bearer → TokenContext con touch best-effort"
```

---

## Task 6: Auditoría de uso y rate limit

**Files:**
- Create: `backend/apps/mcp/audit.py`
- Create: `backend/apps/mcp/ratelimit.py`
- Create: `backend/apps/mcp/tests/test_audit.py`
- Create: `backend/apps/mcp/tests/test_ratelimit.py`

- [x] **Step 1: Write failing test `apps/mcp/tests/test_ratelimit.py`**

```python
import time

from apps.mcp.ratelimit import RateLimiter


def test_allows_under_limit():
    rl = RateLimiter(limit_per_min=3, _now=lambda: 1000.0)
    assert rl.allow("t1") is True
    assert rl.allow("t1") is True
    assert rl.allow("t1") is True


def test_blocks_over_limit():
    rl = RateLimiter(limit_per_min=2, _now=lambda: 1000.0)
    rl.allow("t1"); rl.allow("t1")
    assert rl.allow("t1") is False


def test_resets_after_window():
    clock = {"t": 1000.0}
    rl = RateLimiter(limit_per_min=2, _now=lambda: clock["t"])
    rl.allow("t1"); rl.allow("t1")
    assert rl.allow("t1") is False
    clock["t"] = 1061.0
    assert rl.allow("t1") is True


def test_per_token_isolated():
    rl = RateLimiter(limit_per_min=1, _now=lambda: 1000.0)
    assert rl.allow("a")
    assert rl.allow("b")
    assert not rl.allow("a")
    assert not rl.allow("b")
```

- [x] **Step 2: Implementar `apps/mcp/ratelimit.py`**

```python
"""Sliding-window in-memory rate limiter (process-local). 60 calls/min default."""
import time
from collections import deque
from threading import Lock
from typing import Callable, Optional


class RateLimiter:
    def __init__(self, limit_per_min: int = 60, _now: Optional[Callable[[], float]] = None):
        self.limit = limit_per_min
        self._now = _now or time.time
        self._windows: dict[str, deque] = {}
        self._lock = Lock()

    def allow(self, key: str) -> bool:
        now = self._now()
        cutoff = now - 60.0
        with self._lock:
            q = self._windows.setdefault(key, deque())
            while q and q[0] < cutoff:
                q.popleft()
            if len(q) >= self.limit:
                return False
            q.append(now)
            return True


_global: Optional[RateLimiter] = None


def get_limiter() -> RateLimiter:
    global _global
    if _global is None:
        from django.conf import settings
        _global = RateLimiter(limit_per_min=getattr(settings, "MCP_RATELIMIT_PER_MIN", 60))
    return _global
```

- [x] **Step 3: Write failing test `apps/mcp/tests/test_audit.py`** — adaptado a mock de `apps.mcp.audit.oracle.execute` (audit usa apps.legacy.client, no django.db, igual que tokens.py)

```python
from unittest.mock import patch, MagicMock

from apps.mcp.audit import log_usage


def test_log_usage_inserts_row():
    with patch("apps.mcp.audit.connection") as conn:
        cur = MagicMock()
        conn.cursor.return_value.__enter__.return_value = cur
        log_usage(
            token_id="t1", tool="fat_listar_facturas",
            params_hash="abc", ip="1.2.3.4",
            ok=True, error_code=None, duration_ms=42,
        )
        assert cur.execute.called
        sql, params = cur.execute.call_args[0]
        assert "INSERT INTO ABREGONZA.TMCP_TOKEN_USO" in sql
        assert params[0] == "t1"
        assert params[1] == "fat_listar_facturas"
        assert params[2] == "abc"
        assert params[4] == "S"
```

- [x] **Step 4: Implementar `apps/mcp/audit.py`** — usa `apps.legacy.client.execute` con binding `:N` y placeholder de secuencia `SQ_TMCP_TOKEN_USO`

```python
"""Auditoría de uso del MCP en TMCP_TOKEN_USO."""
import hashlib
import json
from typing import Optional

from django.db import connection


def hash_params(params: dict) -> str:
    encoded = json.dumps(params, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def log_usage(
    *,
    token_id: str,
    tool: str,
    params_hash: Optional[str],
    ip: Optional[str],
    ok: bool,
    error_code: Optional[str],
    duration_ms: int,
) -> None:
    with connection.cursor() as cur:
        cur.execute(
            """
            INSERT INTO ABREGONZA.TMCP_TOKEN_USO
              (USO_ID, TOKEN_ID, TOOL, PARAMS_HASH, IP, OK, ERROR_CODE, DURATION_MS)
            VALUES
              (ABREGONZA.SQ_TMCP_TOKEN_USO.NEXTVAL, %s, %s, %s, %s, %s, %s, %s)
            """,
            [
                token_id, tool, params_hash, (ip[:45] if ip else None),
                "S" if ok else "N", error_code, duration_ms,
            ],
        )
```

- [x] **Step 5: Run all tests** — 5 passed in 0.14s (VM)

Run: `cd backend && pytest apps/mcp/tests/test_ratelimit.py apps/mcp/tests/test_audit.py -v`
Expected: 5 tests PASS.

- [x] **Step 6: Commit**

```bash
git add backend/apps/mcp/audit.py backend/apps/mcp/ratelimit.py backend/apps/mcp/tests/test_audit.py backend/apps/mcp/tests/test_ratelimit.py
git commit -m "feat(mcp): audit log + rate limit por token"
```

---

## Task 7: Endpoints admin para tokens (CRUD + revoke + usage list)

**Files:**
- Create: `backend/apps/mcp/views_admin.py`
- Create: `backend/apps/mcp/urls.py`
- Create: `backend/apps/mcp/tests/test_admin_tokens.py`
- Modify: `backend/facturation_api/urls.py`

- [x] **Step 1: Write failing test `apps/mcp/tests/test_admin_tokens.py`** (4 tests cubriendo list, create, revoke, gate DBA) — adaptado: usa `APIClient.force_authenticate` + mock de `apps.auth_legacy.views.users_repo.is_dba` (no existe helper `tests.utils.login_as_dba`)

```python
import pytest
from django.test import Client

pytestmark = pytest.mark.django_db


def _login_dba(client: Client):
    # Reusa el setup de sesión de los otros tests admin del proyecto.
    # Sustituir con el helper real (e.g. tests.utils.login_as("JCABREU")).
    from tests.utils import login_as_dba  # ajustar al helper existente
    login_as_dba(client)


def test_list_requires_dba():
    c = Client()
    r = c.get("/api/admin/mcp/tokens/")
    assert r.status_code == 403


def test_create_returns_plaintext_once(monkeypatch):
    c = Client(); _login_dba(c)
    r = c.post(
        "/api/admin/mcp/tokens/",
        data={"usuario": "MARIA", "nombre": "Laptop",
              "no_cia": "01", "bloquear_cia": True,
              "punto": "01", "bloquear_punto": False,
              "expira_dias": 30},
        content_type="application/json",
    )
    assert r.status_code == 201
    body = r.json()
    assert body["plaintext"].startswith("mcp_")
    assert "token_id" in body
    # Segundo GET no expone plaintext
    lst = c.get("/api/admin/mcp/tokens/").json()
    assert all("plaintext" not in t for t in lst["items"])


def test_revoke_marks_inactive():
    c = Client(); _login_dba(c)
    create = c.post("/api/admin/mcp/tokens/",
        data={"usuario": "PEDRO", "nombre": "x"},
        content_type="application/json").json()
    r = c.patch(f"/api/admin/mcp/tokens/{create['token_id']}/",
        data={"st_activo": "N"}, content_type="application/json")
    assert r.status_code == 200
    assert r.json()["st_activo"] == "N"
```

(Si el helper `login_as_dba` no existe, agregarlo o usar el patrón actual del proyecto — los otros tests admin tienen el setup.)

- [x] **Step 2: Implementar `apps/mcp/views_admin.py`** — adaptado: DRF APIView + `IsLegacyAdmin` + `apps.legacy.client` (no JsonResponse + django.db.connection). 3 views: `TokensCollectionView`, `TokenDetailView`, `TokenUsageView`.

```python
"""Endpoints admin para CRUD de tokens MCP. Gateados por DBA / ROLE_SIGAF."""
from datetime import datetime, timedelta
from typing import Optional

from django.db import connection
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.auth_legacy.services import get_current_user, user_is_dba
from .tokens import create_token_row, revoke_token, invalidate_cache


def _require_dba(request):
    user = get_current_user(request)
    if user is None:
        return JsonResponse({"error": "unauthenticated"}, status=401), None
    if not user_is_dba(user):
        return JsonResponse({"error": "forbidden"}, status=403), None
    return None, user


def _parse_expira(payload) -> Optional[str]:
    if payload.get("no_expira"):
        return None
    if (dias := payload.get("expira_dias")) is not None:
        dt = datetime.utcnow() + timedelta(days=int(dias))
        return dt.strftime("%Y-%m-%dT%H:%M:%S")
    if (custom := payload.get("expira_fecha")) is not None:
        return custom
    return None


@csrf_exempt
@require_http_methods(["GET", "POST"])
def tokens_collection(request):
    err, user = _require_dba(request)
    if err: return err

    if request.method == "GET":
        usuario = request.GET.get("usuario")
        activos = request.GET.get("activos", "todos")
        q = request.GET.get("q", "").strip()

        sql = """
            SELECT TOKEN_ID, USUARIO, NO_CIA, BLOQUEAR_CIA, PUNTO, BLOQUEAR_PUNTO,
                   NOMBRE, PREFIJO,
                   TO_CHAR(FECHA_CREACION, 'YYYY-MM-DD HH24:MI'),
                   TO_CHAR(FECHA_EXPIRA,   'YYYY-MM-DD HH24:MI'),
                   TO_CHAR(FECHA_ULTIMO_USO,'YYYY-MM-DD HH24:MI'),
                   IP_ULTIMO_USO, ST_ACTIVO, CREADO_POR
              FROM ABREGONZA.TMCP_TOKEN
             WHERE 1=1
        """
        params = []
        if usuario:
            sql += " AND USUARIO = %s"; params.append(usuario)
        if activos == "activos":
            sql += " AND ST_ACTIVO = 'S'"
        elif activos == "revocados":
            sql += " AND ST_ACTIVO = 'N'"
        if q:
            sql += " AND (LOWER(NOMBRE) LIKE %s OR LOWER(PREFIJO) LIKE %s)"
            like = f"%{q.lower()}%"
            params += [like, like]
        sql += " ORDER BY FECHA_CREACION DESC FETCH FIRST 200 ROWS ONLY"

        with connection.cursor() as cur:
            cur.execute(sql, params)
            cols = [c[0].lower() for c in cur.description]
            items = [dict(zip(cols, row)) for row in cur.fetchall()]
        return JsonResponse({"items": items})

    # POST
    import json
    body = json.loads(request.body or b"{}")
    token_id, plaintext = create_token_row(
        usuario=body["usuario"],
        nombre=body.get("nombre", "MCP token"),
        no_cia=body.get("no_cia") or None,
        bloquear_cia=bool(body.get("bloquear_cia")),
        punto=body.get("punto") or None,
        bloquear_punto=bool(body.get("bloquear_punto")),
        fecha_expira_iso=_parse_expira(body),
        creado_por=user.usuario,
    )
    return JsonResponse({"token_id": token_id, "plaintext": plaintext}, status=201)


@csrf_exempt
@require_http_methods(["PATCH"])
def tokens_detail(request, token_id):
    err, _ = _require_dba(request)
    if err: return err

    import json
    body = json.loads(request.body or b"{}")
    fields = []
    params = []
    if "st_activo" in body:
        fields.append("ST_ACTIVO = %s"); params.append(body["st_activo"])
    if "nombre" in body:
        fields.append("NOMBRE = %s"); params.append(body["nombre"])
    if not fields:
        return JsonResponse({"error": "no fields"}, status=400)
    params.append(token_id)

    with connection.cursor() as cur:
        cur.execute(
            f"UPDATE ABREGONZA.TMCP_TOKEN SET {', '.join(fields)} WHERE TOKEN_ID = %s",
            params,
        )
        if cur.rowcount == 0:
            return JsonResponse({"error": "not found"}, status=404)

    invalidate_cache()
    # devolver fila actualizada
    with connection.cursor() as cur:
        cur.execute(
            "SELECT ST_ACTIVO, NOMBRE FROM ABREGONZA.TMCP_TOKEN WHERE TOKEN_ID=%s",
            [token_id],
        )
        row = cur.fetchone()
    return JsonResponse({"st_activo": row[0], "nombre": row[1]})


@require_http_methods(["GET"])
def tokens_usage(request, token_id):
    err, _ = _require_dba(request)
    if err: return err
    with connection.cursor() as cur:
        cur.execute(
            """
            SELECT TO_CHAR(FECHA, 'YYYY-MM-DD HH24:MI:SS'),
                   TOOL, OK, ERROR_CODE, DURATION_MS, IP
              FROM ABREGONZA.TMCP_TOKEN_USO
             WHERE TOKEN_ID = %s
             ORDER BY FECHA DESC
             FETCH FIRST 100 ROWS ONLY
            """,
            [token_id],
        )
        items = [
            {"fecha": r[0], "tool": r[1], "ok": r[2],
             "error_code": r[3], "duration_ms": r[4], "ip": r[5]}
            for r in cur.fetchall()
        ]
    return JsonResponse({"items": items})
```

> **Nota al implementador:** `apps.auth_legacy.services.user_is_dba` debe existir; si no, leer `apps/auth_legacy/services.py` y usar el predicado actual (memorias indican que JCABREU tiene flag DBA). Si no existe, crearlo allí — fuera del scope de Plan 1 pero bloquea este task.

- [x] **Step 3: Crear `apps/mcp/urls.py`** — rutas montadas en `admin/mcp/tokens/...` (raiz `/api/` ya queda en facturation_api/urls.py)

```python
from django.urls import path

from . import views_admin

urlpatterns = [
    path("api/admin/mcp/tokens/", views_admin.tokens_collection),
    path("api/admin/mcp/tokens/<str:token_id>/", views_admin.tokens_detail),
    path("api/admin/mcp/tokens/<str:token_id>/usage/", views_admin.tokens_usage),
]
```

- [x] **Step 4: Modificar `backend/facturation_api/urls.py`** — agregado `path('api/', include('apps.mcp.urls'))`

Encontrar `urlpatterns` y agregar:

```python
    path("", include("apps.mcp.urls")),
```

- [x] **Step 5: Run tests** — 4 passed (list_requires_auth + forbidden_non_dba + create_plaintext + revoke). Suite completa MCP: 24/24 passed.

Run: `cd backend && pytest apps/mcp/tests/test_admin_tokens.py -v`
Expected: 3 tests PASS.

- [x] **Step 6: Commit**

```bash
git add backend/apps/mcp/views_admin.py backend/apps/mcp/urls.py backend/facturation_api/urls.py backend/apps/mcp/tests/test_admin_tokens.py
git commit -m "feat(mcp): endpoints admin tokens (list/create/revoke/usage)"
```

---

## Task 8: Endpoint de monitoreo `/api/admin/mcp/usage/`

**Files:**
- Create: `backend/apps/mcp/views_usage.py`
- Create: `backend/apps/mcp/tests/test_admin_usage.py`
- Modify: `backend/apps/mcp/urls.py`

- [x] **Step 1: Write failing test `apps/mcp/tests/test_admin_usage.py`** — adaptado: mock `oracle.fetch_one`/`fetch_all` + force_authenticate (no seed real ni helper login_as_dba)

```python
import pytest
from django.test import Client
from django.db import connection

pytestmark = pytest.mark.django_db


def _seed_usage():
    with connection.cursor() as cur:
        # crear token padre
        cur.execute("""
            INSERT INTO ABREGONZA.TMCP_TOKEN
              (TOKEN_ID, USUARIO, NOMBRE, TOKEN_HASH, PREFIJO, CREADO_POR)
            VALUES ('tk1','JCABREU','t','hh','pppppppp','JCABREU')
        """)
        for i in range(5):
            ok = 'S' if i < 4 else 'N'
            err = None if ok == 'S' else 'PERMISSION_DENIED'
            cur.execute("""
                INSERT INTO ABREGONZA.TMCP_TOKEN_USO
                  (USO_ID, TOKEN_ID, TOOL, OK, ERROR_CODE, DURATION_MS)
                VALUES (ABREGONZA.SQ_TMCP_TOKEN_USO.NEXTVAL, 'tk1',
                        'fat_listar_facturas', %s, %s, 100)
            """, [ok, err])


def test_usage_returns_kpis_and_top_tools():
    from tests.utils import login_as_dba
    c = Client(); login_as_dba(c)
    _seed_usage()
    r = c.get("/api/admin/mcp/usage/")
    assert r.status_code == 200
    body = r.json()
    assert body["kpis"]["total_calls"] >= 5
    assert any(t["tool"] == "fat_listar_facturas" for t in body["top_tools"])
    assert "serie_temporal" in body
```

- [x] **Step 2: Implementar `apps/mcp/views_usage.py`** — DRF `UsageView(APIView)` + IsLegacyAdmin + apps.legacy.client. 5 queries: KPI, serie temporal, top tools, top usuarios, top errores, downloads.

```python
"""Endpoint de monitoreo del uso del MCP. Agregados directamente en Oracle."""
from datetime import datetime, timedelta

from django.db import connection
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from apps.auth_legacy.services import get_current_user, user_is_dba


def _gran(g):
    return {"hora": "HH24", "dia": "DD", "semana": "IW"}.get(g, "HH24")


@require_http_methods(["GET"])
def usage(request):
    user = get_current_user(request)
    if user is None:
        return JsonResponse({"error": "unauthenticated"}, status=401)
    if not user_is_dba(user):
        return JsonResponse({"error": "forbidden"}, status=403)

    desde = request.GET.get("desde")
    hasta = request.GET.get("hasta")
    if not desde:
        desde = (datetime.utcnow() - timedelta(hours=24)).strftime("%Y-%m-%d %H:%M")
    if not hasta:
        hasta = datetime.utcnow().strftime("%Y-%m-%d %H:%M")
    gran = request.GET.get("granularidad", "hora")
    usuario_f = request.GET.get("usuario")
    tool_f = request.GET.get("tool")
    only_err = request.GET.get("ok") == "N"

    where = ["u.FECHA BETWEEN TO_DATE(%s,'YYYY-MM-DD HH24:MI') AND TO_DATE(%s,'YYYY-MM-DD HH24:MI')"]
    p = [desde, hasta]
    if usuario_f:
        where.append("t.USUARIO = %s"); p.append(usuario_f)
    if tool_f:
        where.append("u.TOOL = %s"); p.append(tool_f)
    if only_err:
        where.append("u.OK = 'N'")
    where_sql = " AND ".join(where)

    join = """
        FROM ABREGONZA.TMCP_TOKEN_USO u
        JOIN ABREGONZA.TMCP_TOKEN t ON t.TOKEN_ID = u.TOKEN_ID
       WHERE """ + where_sql

    with connection.cursor() as cur:
        cur.execute(f"""
            SELECT COUNT(*) AS total,
                   SUM(CASE WHEN u.OK='S' THEN 1 ELSE 0 END) AS ok,
                   SUM(CASE WHEN u.OK='N' THEN 1 ELSE 0 END) AS err,
                   MEDIAN(u.DURATION_MS) AS p50,
                   PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY u.DURATION_MS) AS p95,
                   PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY u.DURATION_MS) AS p99,
                   COUNT(DISTINCT t.USUARIO) AS usrs,
                   COUNT(DISTINCT t.TOKEN_ID) AS toks
            {join}
        """, p)
        row = cur.fetchone()
        total, ok, err, p50, p95, p99, usrs, toks = row

        cur.execute(f"""
            SELECT TO_CHAR(TRUNC(u.FECHA, '{_gran(gran)}'),'YYYY-MM-DD"T"HH24:MI'),
                   SUM(CASE WHEN u.OK='S' THEN 1 ELSE 0 END),
                   SUM(CASE WHEN u.OK='N' THEN 1 ELSE 0 END),
                   PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY u.DURATION_MS)
            {join}
            GROUP BY TRUNC(u.FECHA, '{_gran(gran)}')
            ORDER BY 1
        """, p)
        serie = [{"bucket": r[0], "ok": int(r[1] or 0), "error": int(r[2] or 0), "p95_ms": int(r[3] or 0)}
                 for r in cur.fetchall()]

        cur.execute(f"""
            SELECT u.TOOL, COUNT(*) calls,
                   ROUND(SUM(CASE WHEN u.OK='N' THEN 1 ELSE 0 END) / COUNT(*), 4) error_rate,
                   PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY u.DURATION_MS) p95
            {join}
            GROUP BY u.TOOL
            ORDER BY calls DESC FETCH FIRST 10 ROWS ONLY
        """, p)
        top_tools = [{"tool": r[0], "calls": int(r[1]), "error_rate": float(r[2] or 0), "p95_ms": int(r[3] or 0)}
                     for r in cur.fetchall()]

        cur.execute(f"""
            SELECT t.USUARIO, COUNT(*) calls,
                   TO_CHAR(MAX(u.FECHA),'YYYY-MM-DD"T"HH24:MI')
            {join}
            GROUP BY t.USUARIO
            ORDER BY calls DESC FETCH FIRST 10 ROWS ONLY
        """, p)
        top_users = [{"usuario": r[0], "calls": int(r[1]), "ultimo_uso": r[2]} for r in cur.fetchall()]

        cur.execute(f"""
            SELECT NVL(u.ERROR_CODE,'N/A') ec, COUNT(*) calls,
                   MAX(u.TOOL) KEEP (DENSE_RANK FIRST ORDER BY u.FECHA DESC) ultima_tool
            {join}
              AND u.OK = 'N'
            GROUP BY u.ERROR_CODE
            ORDER BY calls DESC FETCH FIRST 10 ROWS ONLY
        """, p)
        top_err = [{"error_code": r[0], "calls": int(r[1]), "ultima_tool": r[2]} for r in cur.fetchall()]

        cur.execute(f"""
            SELECT u.TOOL, COUNT(*) FROM ABREGONZA.TMCP_TOKEN_USO u
             WHERE u.TOOL IN ('download:pdf','download:xlsx')
               AND u.FECHA BETWEEN TO_DATE(%s,'YYYY-MM-DD HH24:MI') AND TO_DATE(%s,'YYYY-MM-DD HH24:MI')
             GROUP BY u.TOOL
        """, [desde, hasta])
        downloads = {r[0]: int(r[1]) for r in cur.fetchall()}

    total_i = int(total or 0)
    err_rate = (int(err or 0) / total_i) if total_i else 0.0

    return JsonResponse({
        "kpis": {
            "total_calls": total_i,
            "calls_ok":    int(ok or 0),
            "calls_error": int(err or 0),
            "error_rate":  round(err_rate, 4),
            "p50_ms": int(p50 or 0), "p95_ms": int(p95 or 0), "p99_ms": int(p99 or 0),
            "usuarios_activos": int(usrs or 0),
            "tokens_activos":   int(toks or 0),
            "downloads_pdf":  downloads.get("download:pdf", 0),
            "downloads_xlsx": downloads.get("download:xlsx", 0),
        },
        "serie_temporal": serie,
        "top_tools":  top_tools,
        "top_usuarios": top_users,
        "top_errores":  top_err,
    })
```

- [x] **Step 3: Agregar a `apps/mcp/urls.py`** — `admin/mcp/usage/` -> `UsageView.as_view()`

```python
from . import views_admin, views_usage

urlpatterns = [
    path("api/admin/mcp/tokens/", views_admin.tokens_collection),
    path("api/admin/mcp/tokens/<str:token_id>/", views_admin.tokens_detail),
    path("api/admin/mcp/tokens/<str:token_id>/usage/", views_admin.tokens_usage),
    path("api/admin/mcp/usage/", views_usage.usage),
]
```

- [x] **Step 4: Run test** — 3 passed (requires_dba + returns_kpis_and_top_tools + empty)

Run: `cd backend && pytest apps/mcp/tests/test_admin_usage.py -v`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add backend/apps/mcp/views_usage.py backend/apps/mcp/urls.py backend/apps/mcp/tests/test_admin_usage.py
git commit -m "feat(mcp): endpoint admin usage con KPIs, serie temporal y tops"
```

---

## Task 9: Proxy memory-router + tools `memoria_*`

**Files:**
- Create: `backend/apps/mcp/memory_proxy.py`
- Create: `backend/apps/mcp/tools/__init__.py` (vacío)
- Create: `backend/apps/mcp/tools/memoria.py`
- Create: `backend/apps/mcp/tests/test_memory_proxy.py`

- [x] **Step 1: Crear `apps/mcp/tools/__init__.py` vacío**

```python
```

- [x] **Step 2: Write failing test `apps/mcp/tests/test_memory_proxy.py`**

```python
import httpx
import pytest

from apps.mcp.memory_proxy import MemoryProxy


@pytest.mark.asyncio
async def test_buscar_calls_router_and_returns_results():
    def handler(request: httpx.Request):
        assert request.url.path.endswith("/tools/memory_search")
        assert request.headers["Authorization"] == "Bearer secret"
        assert request.headers["X-Memory-Project"] == "facture-project"
        return httpx.Response(200, json={"result": "ok-data"})

    transport = httpx.MockTransport(handler)
    proxy = MemoryProxy("http://memrouter", "secret", "facture-project", _transport=transport)
    out = await proxy.buscar("hola", limit=3)
    assert out["ok"] is True
    assert out["data"] == "ok-data"


@pytest.mark.asyncio
async def test_router_down_returns_upstream_unavailable():
    def handler(request):
        raise httpx.ConnectError("connection refused")
    proxy = MemoryProxy("http://x", "s", "p", _transport=httpx.MockTransport(handler))
    out = await proxy.buscar("q")
    assert out["ok"] is False
    assert out["error_code"] == "UPSTREAM_UNAVAILABLE"
```

- [x] **Step 3: Implementar `apps/mcp/memory_proxy.py`** — agregado `pytest-asyncio>=0.23` a requirements.txt; instalado httpx/pytest-asyncio en container running para tests (rebuild formal queda en Task 14).

```python
"""Cliente HTTP hacia el MCP memory-router. Resiliente: errores propios no tumban el server."""
import httpx
from typing import Any, Optional

from .envelope import ok, error


class MemoryProxy:
    def __init__(self, url: str, token: str, project: str, *, _transport=None):
        self.url = url.rstrip("/")
        self.token = token
        self.project = project
        self._client = httpx.AsyncClient(
            base_url=self.url,
            timeout=8.0,
            transport=_transport,
            headers={
                "Authorization": f"Bearer {token}",
                "X-Memory-Project": project,
            },
        )

    async def _call(self, tool: str, args: dict[str, Any]) -> dict:
        try:
            r = await self._client.post(f"/tools/{tool}", json=args)
            r.raise_for_status()
            return ok(r.json().get("result"))
        except (httpx.ConnectError, httpx.ReadTimeout, httpx.RemoteProtocolError) as e:
            return error("UPSTREAM_UNAVAILABLE", "memory-router no disponible", {"detail": str(e)})
        except httpx.HTTPStatusError as e:
            return error("UPSTREAM_ERROR", f"memory-router HTTP {e.response.status_code}",
                         {"body": e.response.text[:500]})

    async def buscar(self, query: str, limit: int = 10) -> dict:
        return await self._call("memory_search", {"query": query, "limit": limit})

    async def obtener(self, ids: list[str]) -> dict:
        return await self._call("memory_get", {"ids": ids})

    async def briefing(self) -> dict:
        return await self._call("memory_briefing", {})

    async def skills_disponibles(self) -> dict:
        return await self._call("memory_list_agents", {})

    async def obtener_skill(self, nombre: str) -> dict:
        return await self._call("memory_get_skill", {"name": nombre})
```

- [x] **Step 4: Implementar `apps/mcp/tools/memoria.py`**

```python
"""Tools MCP que envuelven memory-router con prefijo `memoria_*`."""
from django.conf import settings

from ..memory_proxy import MemoryProxy

_proxy: MemoryProxy | None = None


def get_proxy() -> MemoryProxy:
    global _proxy
    if _proxy is None:
        _proxy = MemoryProxy(
            settings.MEMORY_ROUTER_URL,
            settings.MEMORY_ROUTER_TOKEN,
            settings.MEMORY_ROUTER_PROJECT,
        )
    return _proxy


async def memoria_buscar(query: str, limit: int = 10) -> dict:
    """Busca en las memorias del proyecto (proxy memory_search)."""
    return await get_proxy().buscar(query, limit)


async def memoria_obtener(ids: list[str]) -> dict:
    """Devuelve memorias por ID (proxy memory_get)."""
    return await get_proxy().obtener(ids)


async def memoria_briefing() -> dict:
    """Briefing del proyecto desde memory-router."""
    return await get_proxy().briefing()


async def memoria_skills_disponibles() -> dict:
    """Listado de skills configuradas en memory-router."""
    return await get_proxy().skills_disponibles()


async def memoria_obtener_skill(nombre: str) -> dict:
    """Contenido completo de una skill por nombre."""
    return await get_proxy().obtener_skill(nombre)
```

- [x] **Step 5: Run tests** — 2 passed in 0.11s (VM, asyncio-1.4.0 + httpx mock transport)

Run: `cd backend && pytest apps/mcp/tests/test_memory_proxy.py -v`
Expected: 2 tests PASS.

- [x] **Step 6: Commit**

```bash
git add backend/apps/mcp/memory_proxy.py backend/apps/mcp/tools/ backend/apps/mcp/tests/test_memory_proxy.py
git commit -m "feat(mcp): proxy memory-router + tools memoria_*"
```

---

## Task 10: Registry de tipos de documento (esqueleto + 2 tools)

**Files:**
- Create: `backend/apps/mcp/doc_types.py`
- Create: `backend/apps/mcp/tools/doc_types_tools.py`
- Create: `backend/apps/mcp/tests/test_doc_types_tools.py`

- [ ] **Step 1: Implementar `apps/mcp/doc_types.py` (registry vacío extensible)**

```python
"""Registry declarativo de tipos de documento por módulo.

En Plan 1 está vacío. Cada módulo (FAT, CXC, ...) registrará sus entradas
en sus respectivos planes (`register_module(...)`). El registry solo lo lee
`doc_types_tools.py` para responder `doc_tipos_listar` y `doc_tipos_describir`.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Optional


@dataclass
class TipoDocSchema:
    codigo: str
    descripcion: str
    tipo_transaccion: Optional[str] = None
    afecta_cxc: bool = False
    afecta_cxp: bool = False
    afecta_inv: bool = False
    afecta_cnt: bool = False
    usa_ncf: bool = False
    cont_secuencia: bool = True
    ejemplo_payload: dict = field(default_factory=dict)
    campos_requeridos: list[dict] = field(default_factory=list)


@dataclass
class ModuleEntry:
    modulo: str
    tabla: str
    listar_fn: Callable[[str, Optional[str]], list[dict]]
    describir_fn: Callable[[str, Optional[str], str], Optional[TipoDocSchema]]


_REGISTRY: dict[str, ModuleEntry] = {}


def register_module(entry: ModuleEntry) -> None:
    _REGISTRY[entry.modulo.lower()] = entry


def get_module(modulo: str) -> Optional[ModuleEntry]:
    return _REGISTRY.get(modulo.lower())


def modulos_disponibles() -> list[str]:
    return sorted(_REGISTRY.keys())
```

- [ ] **Step 2: Implementar `apps/mcp/tools/doc_types_tools.py`**

```python
"""Tools transversales doc_tipos_listar y doc_tipos_describir."""
from ..doc_types import get_module, modulos_disponibles
from ..envelope import ok, error


def doc_tipos_listar(modulo: str, no_cia: str, punto: str | None = None) -> dict:
    """Lista los tipos de documento del módulo (códigos + banderas)."""
    entry = get_module(modulo)
    if entry is None:
        return error(
            "VALIDATION_ERROR",
            f"Módulo desconocido: {modulo}",
            {"modulos_disponibles": modulos_disponibles()},
        )
    return ok({"modulo": modulo, "tipos": entry.listar_fn(no_cia, punto)})


def doc_tipos_describir(modulo: str, no_cia: str, tipo_documento: str,
                        punto: str | None = None) -> dict:
    """Devuelve schema completo de un tipo de documento (campos, lookups, ejemplo)."""
    entry = get_module(modulo)
    if entry is None:
        return error("VALIDATION_ERROR", f"Módulo desconocido: {modulo}")
    schema = entry.describir_fn(no_cia, punto, tipo_documento)
    if schema is None:
        return error(
            "NOT_FOUND",
            f"Tipo de documento {tipo_documento} no soportado en módulo {modulo}",
        )
    return ok({
        "modulo": modulo,
        "tipo_documento": schema.codigo,
        "descripcion": schema.descripcion,
        "tipo_transaccion": schema.tipo_transaccion,
        "efectos": {
            "afecta_cxc": schema.afecta_cxc,
            "afecta_cxp": schema.afecta_cxp,
            "afecta_inv": schema.afecta_inv,
            "afecta_cnt": schema.afecta_cnt,
            "usa_ncf":    schema.usa_ncf,
        },
        "campos_requeridos": schema.campos_requeridos,
        "ejemplo_payload":   schema.ejemplo_payload,
    })
```

- [ ] **Step 3: Write failing test `apps/mcp/tests/test_doc_types_tools.py`**

```python
from apps.mcp.doc_types import register_module, ModuleEntry, TipoDocSchema, _REGISTRY
from apps.mcp.tools.doc_types_tools import doc_tipos_listar, doc_tipos_describir


def setup_function():
    _REGISTRY.clear()


def _listar(cia, pto):
    return [{"codigo": "F", "descripcion": "Factura crédito"}]


def _describir(cia, pto, tipo):
    if tipo != "F":
        return None
    return TipoDocSchema(codigo="F", descripcion="Factura crédito", afecta_cxc=True, usa_ncf=True)


def test_listar_unknown_module():
    out = doc_tipos_listar("xxx", "01")
    assert out["ok"] is False
    assert out["error_code"] == "VALIDATION_ERROR"


def test_listar_ok_with_registered_module():
    register_module(ModuleEntry(modulo="fat", tabla="TFAT_TDOCU",
                                listar_fn=_listar, describir_fn=_describir))
    out = doc_tipos_listar("fat", "01")
    assert out["ok"]
    assert out["data"]["tipos"][0]["codigo"] == "F"


def test_describir_returns_full_schema():
    register_module(ModuleEntry(modulo="fat", tabla="TFAT_TDOCU",
                                listar_fn=_listar, describir_fn=_describir))
    out = doc_tipos_describir("fat", "01", "F")
    assert out["ok"]
    assert out["data"]["efectos"]["usa_ncf"] is True


def test_describir_unknown_type_returns_not_found():
    register_module(ModuleEntry(modulo="fat", tabla="TFAT_TDOCU",
                                listar_fn=_listar, describir_fn=_describir))
    out = doc_tipos_describir("fat", "01", "ZZ")
    assert out["error_code"] == "NOT_FOUND"
```

- [ ] **Step 4: Run tests**

Run: `cd backend && pytest apps/mcp/tests/test_doc_types_tools.py -v`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/apps/mcp/doc_types.py backend/apps/mcp/tools/doc_types_tools.py backend/apps/mcp/tests/test_doc_types_tools.py
git commit -m "feat(mcp): registry tipos de documento + tools doc_tipos_listar/describir"
```

---

## Task 11: Montar servidor MCP en `/mcp/`

**Files:**
- Create: `backend/apps/mcp/server.py`
- Modify: `backend/facturation_api/asgi.py`
- Create: `backend/apps/mcp/tests/test_server_smoke.py`

- [ ] **Step 1: Implementar `apps/mcp/server.py`**

```python
"""Servidor MCP HTTP. Registra tools y construye la app ASGI.

Las tools de módulos (FAT, CXC, ...) se registran en siguientes planes.
"""
from __future__ import annotations

import time
from typing import Any, Awaitable, Callable

from mcp.server.fastmcp import FastMCP
from mcp.server.fastmcp.utilities.types import Context

from . import auth as auth_mod
from . import audit as audit_mod
from . import ratelimit as rate_mod
from .envelope import error
from .tools import memoria, doc_types_tools


_mcp: FastMCP | None = None


def _request_ip(ctx: Context) -> str | None:
    try:
        return ctx.request.client.host if ctx.request and ctx.request.client else None
    except Exception:
        return None


def _request_auth_header(ctx: Context) -> str | None:
    try:
        return ctx.request.headers.get("authorization")
    except Exception:
        return None


def _wrap_tool(name: str, fn: Callable[..., Awaitable[dict]]):
    """Decora una tool con auth + rate-limit + audit + envelope."""
    async def wrapper(ctx: Context, **kwargs):
        t0 = time.time()
        try:
            tctx = auth_mod.authenticate_bearer(_request_auth_header(ctx), ip=_request_ip(ctx))
        except auth_mod.AuthError as e:
            return error(e.code, e.message)

        limiter = rate_mod.get_limiter()
        if not limiter.allow(tctx.token_id):
            audit_mod.log_usage(
                token_id=tctx.token_id, tool=name, params_hash=None,
                ip=_request_ip(ctx), ok=False, error_code="RATE_LIMITED",
                duration_ms=int((time.time() - t0) * 1000),
            )
            return error("RATE_LIMITED", "60 calls/min superado para este token")

        params_hash = audit_mod.hash_params(kwargs)
        try:
            out = await fn(**kwargs)
        except Exception as e:
            audit_mod.log_usage(
                token_id=tctx.token_id, tool=name, params_hash=params_hash,
                ip=_request_ip(ctx), ok=False, error_code="ORACLE_ERROR",
                duration_ms=int((time.time() - t0) * 1000),
            )
            return error("ORACLE_ERROR", "Error interno", {"detail": str(e)[:200]})

        ok_flag = bool(out.get("ok", True))
        audit_mod.log_usage(
            token_id=tctx.token_id, tool=name, params_hash=params_hash,
            ip=_request_ip(ctx), ok=ok_flag,
            error_code=None if ok_flag else out.get("error_code"),
            duration_ms=int((time.time() - t0) * 1000),
        )
        return out

    wrapper.__name__ = name
    return wrapper


def build_mcp() -> FastMCP:
    global _mcp
    if _mcp is not None:
        return _mcp

    server = FastMCP(name="ZentoryERP MCP", stateless_http=True)

    # === tools ===
    server.add_tool(_wrap_tool("memoria_buscar", memoria.memoria_buscar))
    server.add_tool(_wrap_tool("memoria_obtener", memoria.memoria_obtener))
    server.add_tool(_wrap_tool("memoria_briefing", memoria.memoria_briefing))
    server.add_tool(_wrap_tool("memoria_skills_disponibles", memoria.memoria_skills_disponibles))
    server.add_tool(_wrap_tool("memoria_obtener_skill", memoria.memoria_obtener_skill))

    async def _doc_listar(modulo: str, no_cia: str, punto: str | None = None):
        return doc_types_tools.doc_tipos_listar(modulo, no_cia, punto)

    async def _doc_describir(modulo: str, no_cia: str, tipo_documento: str, punto: str | None = None):
        return doc_types_tools.doc_tipos_describir(modulo, no_cia, tipo_documento, punto)

    server.add_tool(_wrap_tool("doc_tipos_listar", _doc_listar))
    server.add_tool(_wrap_tool("doc_tipos_describir", _doc_describir))

    _mcp = server
    return _mcp
```

- [ ] **Step 2: Modificar `backend/facturation_api/asgi.py`**

Después del `application = ...` actual añadir:

```python
from starlette.routing import Mount
from starlette.applications import Starlette

from apps.mcp.server import build_mcp

_mcp_app = build_mcp().streamable_http_app()

application = Starlette(
    routes=[
        Mount("/mcp", app=_mcp_app),
        Mount("/", app=application),  # Django como fallback
    ]
)
```

(Si el archivo ya importa `application` de otra manera, mantener la cadena Django y montar `/mcp` antes.)

- [ ] **Step 3: Write smoke test `apps/mcp/tests/test_server_smoke.py`**

```python
from apps.mcp.server import build_mcp


def test_server_registers_expected_tools():
    server = build_mcp()
    names = {t.name for t in server.list_tools_sync()}
    assert "memoria_buscar" in names
    assert "doc_tipos_listar" in names
```

(Si `list_tools_sync` no existe en la versión del SDK, leer del registry interno del `FastMCP`.)

- [ ] **Step 4: Run smoke**

Run: `cd backend && pytest apps/mcp/tests/test_server_smoke.py -v`
Expected: PASS.

- [ ] **Step 5: Deploy a VM y smoke real**

```bash
pscp -batch -r backend/apps/mcp jcabreu@10.0.0.99:/home/jcabreu/facturation-system/backend/apps/
pscp -batch backend/facturation_api/asgi.py jcabreu@10.0.0.99:/home/jcabreu/facturation-system/backend/facturation_api/asgi.py
plink -batch jcabreu@10.0.0.99 "cd /home/jcabreu/facturation-system && docker compose restart backend"
sleep 5
curl -i https://grupo-abregonza.hopto.org:8443/mcp/ -X POST -d '{"jsonrpc":"2.0","method":"tools/list","id":1}' -H "Content-Type: application/json"
```

Expected: HTTP 401 `MISSING_AUTH` (la lista de tools también requiere auth — correcto).

- [ ] **Step 6: Commit**

```bash
git add backend/apps/mcp/server.py backend/facturation_api/asgi.py backend/apps/mcp/tests/test_server_smoke.py
git commit -m "feat(mcp): servidor MCP montado en /mcp/ con wrapper auth+audit+ratelimit"
```

---

## Task 12: Frontend — página `/admin/mcp/tokens`

**Files:**
- Create: `frontend/src/features/admin/mcp/types.ts`
- Create: `frontend/src/features/admin/mcp/api.ts`
- Create: `frontend/src/features/admin/mcp/routes/mcp-tokens-page.tsx`
- Create: `frontend/src/features/admin/mcp/components/token-list.tsx`
- Create: `frontend/src/features/admin/mcp/components/new-token-dialog.tsx`
- Create: `frontend/src/features/admin/mcp/components/token-generated-dialog.tsx`
- Create: `frontend/src/features/admin/mcp/components/revoke-confirm.tsx`
- Create: `frontend/src/features/admin/mcp/components/token-usage-drawer.tsx`
- Create: `frontend/src/routes/_authenticated/admin/mcp/tokens.tsx`

- [ ] **Step 1: `features/admin/mcp/types.ts`**

```typescript
export type McpToken = {
  token_id: string;
  usuario: string;
  no_cia: string | null;
  bloquear_cia: 'S' | 'N';
  punto: string | null;
  bloquear_punto: 'S' | 'N';
  nombre: string;
  prefijo: string;
  fecha_creacion: string;
  fecha_expira: string | null;
  fecha_ultimo_uso: string | null;
  ip_ultimo_uso: string | null;
  st_activo: 'S' | 'N';
  creado_por: string;
};

export type McpTokenCreatePayload = {
  usuario: string;
  nombre: string;
  no_cia?: string;
  bloquear_cia?: boolean;
  punto?: string;
  bloquear_punto?: boolean;
  expira_dias?: number | null;
  expira_fecha?: string | null;
  no_expira?: boolean;
};

export type McpTokenUsageItem = {
  fecha: string;
  tool: string;
  ok: 'S' | 'N';
  error_code: string | null;
  duration_ms: number;
  ip: string | null;
};
```

- [ ] **Step 2: `features/admin/mcp/api.ts`**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { McpToken, McpTokenCreatePayload, McpTokenUsageItem } from './types';

export function useMcpTokens(filtros: { usuario?: string; activos?: string; q?: string }) {
  return useQuery({
    queryKey: ['mcp', 'tokens', filtros],
    queryFn: async () => (await api.get<{ items: McpToken[] }>('/api/admin/mcp/tokens/', { params: filtros })).data.items,
    staleTime: 30_000,
  });
}

export function useCreateMcpToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: McpTokenCreatePayload) =>
      (await api.post<{ token_id: string; plaintext: string }>('/api/admin/mcp/tokens/', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mcp', 'tokens'] }),
  });
}

export function useRevokeMcpToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (token_id: string) => api.patch(`/api/admin/mcp/tokens/${token_id}/`, { st_activo: 'N' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mcp', 'tokens'] }),
  });
}

export function useMcpTokenUsage(token_id: string | null) {
  return useQuery({
    queryKey: ['mcp', 'tokens', token_id, 'usage'],
    enabled: !!token_id,
    queryFn: async () =>
      (await api.get<{ items: McpTokenUsageItem[] }>(`/api/admin/mcp/tokens/${token_id}/usage/`)).data.items,
  });
}
```

- [ ] **Step 3: `features/admin/mcp/components/new-token-dialog.tsx`**

```tsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useCreateMcpToken } from '../api';

type Props = { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (p: { token_id: string; plaintext: string }) => void };

export function NewTokenDialog({ open, onOpenChange, onCreated }: Props) {
  const [usuario, setUsuario] = useState('');
  const [nombre, setNombre] = useState('');
  const [noCia, setNoCia] = useState('');
  const [bloqCia, setBloqCia] = useState(false);
  const [punto, setPunto] = useState('');
  const [bloqPunto, setBloqPunto] = useState(false);
  const [expiraDias, setExpiraDias] = useState<number | ''>(90);
  const [noExpira, setNoExpira] = useState(false);
  const create = useCreateMcpToken();

  async function submit() {
    const out = await create.mutateAsync({
      usuario, nombre,
      no_cia: noCia || undefined,
      bloquear_cia: bloqCia,
      punto: punto || undefined,
      bloquear_punto: bloqPunto,
      no_expira: noExpira,
      expira_dias: noExpira ? null : (typeof expiraDias === 'number' ? expiraDias : null),
    });
    onCreated(out);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nuevo token MCP</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Usuario</Label><Input value={usuario} onChange={e => setUsuario(e.target.value.toUpperCase())} placeholder="JCABREU" /></div>
          <div><Label>Nombre del token</Label><Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Claude Desktop laptop" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Empresa default</Label><Input value={noCia} onChange={e => setNoCia(e.target.value)} placeholder="01" /></div>
            <div className="flex items-end gap-2"><Checkbox checked={bloqCia} onCheckedChange={v => setBloqCia(!!v)} /><span>Bloquear empresa</span></div>
            <div><Label>Punto default</Label><Input value={punto} onChange={e => setPunto(e.target.value)} placeholder="01" /></div>
            <div className="flex items-end gap-2"><Checkbox checked={bloqPunto} onCheckedChange={v => setBloqPunto(!!v)} /><span>Bloquear punto</span></div>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox checked={noExpira} onCheckedChange={v => setNoExpira(!!v)} />
            <span>No expira</span>
            <Input className="w-24" type="number" disabled={noExpira}
                   value={expiraDias} onChange={e => setExpiraDias(Number(e.target.value))} />
            <span>días</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!usuario || !nombre || create.isPending}>Generar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: `features/admin/mcp/components/token-generated-dialog.tsx`**

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';

type Props = { open: boolean; onOpenChange: (v: boolean) => void; plaintext: string };

export function TokenGeneratedDialog({ open, onOpenChange, plaintext }: Props) {
  const snippet = JSON.stringify({
    mcpServers: {
      zentoryerp: {
        type: 'http',
        url: 'https://grupo-abregonza.hopto.org:8443/mcp/',
        headers: { Authorization: `Bearer ${plaintext}` },
      },
    },
  }, null, 2);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Token generado</DialogTitle></DialogHeader>
        <p className="text-sm text-amber-600">⚠ Copia este token ahora. No se podrá ver de nuevo.</p>
        <div className="flex items-center gap-2 rounded border bg-muted p-2 font-mono text-sm">
          <span className="flex-1 break-all">{plaintext}</span>
          <Button size="icon" variant="ghost" onClick={() => navigator.clipboard.writeText(plaintext)}><Copy size={14} /></Button>
        </div>
        <p className="mt-3 text-sm">Configuración para Claude Desktop / Code:</p>
        <pre className="rounded bg-muted p-3 text-xs overflow-x-auto">{snippet}</pre>
        <DialogFooter><Button onClick={() => onOpenChange(false)}>Cerrar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: `features/admin/mcp/components/token-list.tsx`**

```tsx
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import type { McpToken } from '../types';

type Props = {
  items: McpToken[];
  onRevoke: (id: string) => void;
  onShowUsage: (id: string) => void;
};

export function TokenList({ items, onRevoke, onShowUsage }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Usuario</TableHead><TableHead>Nombre</TableHead>
          <TableHead>Prefijo</TableHead><TableHead>Empresa</TableHead>
          <TableHead>Punto</TableHead><TableHead>Creado</TableHead>
          <TableHead>Último uso</TableHead><TableHead>Estado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map(t => (
          <TableRow key={t.token_id}>
            <TableCell className="font-medium">{t.usuario}</TableCell>
            <TableCell>{t.nombre}</TableCell>
            <TableCell className="font-mono text-xs">mcp_{t.prefijo}…</TableCell>
            <TableCell>{t.no_cia ?? '—'} {t.bloquear_cia === 'S' && <Badge variant="secondary">🔒</Badge>}</TableCell>
            <TableCell>{t.punto ?? '—'} {t.bloquear_punto === 'S' && <Badge variant="secondary">🔒</Badge>}</TableCell>
            <TableCell className="text-xs">{t.fecha_creacion}</TableCell>
            <TableCell className="text-xs">{t.fecha_ultimo_uso ?? 'nunca'}</TableCell>
            <TableCell>
              <Badge variant={t.st_activo === 'S' ? 'default' : 'destructive'}>
                {t.st_activo === 'S' ? 'activo' : 'revocado'}
              </Badge>
            </TableCell>
            <TableCell className="text-right space-x-2">
              <Button size="sm" variant="outline" onClick={() => onShowUsage(t.token_id)}>Uso</Button>
              {t.st_activo === 'S' && <Button size="sm" variant="destructive" onClick={() => onRevoke(t.token_id)}>Revocar</Button>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 6: `features/admin/mcp/components/token-usage-drawer.tsx`**

```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { useMcpTokenUsage } from '../api';

type Props = { tokenId: string | null; onClose: () => void };

export function TokenUsageDrawer({ tokenId, onClose }: Props) {
  const { data, isLoading } = useMcpTokenUsage(tokenId);
  return (
    <Sheet open={!!tokenId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[700px] sm:max-w-[700px]">
        <SheetHeader><SheetTitle>Últimas 100 llamadas</SheetTitle></SheetHeader>
        {isLoading ? <p>Cargando…</p> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Fecha</TableHead><TableHead>Tool</TableHead>
              <TableHead>Estado</TableHead><TableHead>Error</TableHead>
              <TableHead>ms</TableHead><TableHead>IP</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data?.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs">{r.fecha}</TableCell>
                  <TableCell className="font-mono text-xs">{r.tool}</TableCell>
                  <TableCell>{r.ok === 'S' ? '✓' : '✗'}</TableCell>
                  <TableCell className="text-xs">{r.error_code ?? '—'}</TableCell>
                  <TableCell>{r.duration_ms}</TableCell>
                  <TableCell className="text-xs">{r.ip ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 7: `features/admin/mcp/routes/mcp-tokens-page.tsx`**

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMcpTokens, useRevokeMcpToken } from '../api';
import { TokenList } from '../components/token-list';
import { NewTokenDialog } from '../components/new-token-dialog';
import { TokenGeneratedDialog } from '../components/token-generated-dialog';
import { TokenUsageDrawer } from '../components/token-usage-drawer';

export function McpTokensPage() {
  const [q, setQ] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);
  const [usageId, setUsageId] = useState<string | null>(null);
  const { data = [], isLoading } = useMcpTokens({ q });
  const revoke = useRevokeMcpToken();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">MCP Tokens</h1>
        <Button onClick={() => setShowNew(true)}>+ Nuevo token</Button>
      </div>
      <div className="mb-3">
        <Input placeholder="Buscar por nombre o prefijo" value={q} onChange={e => setQ(e.target.value)} className="max-w-sm" />
      </div>
      {isLoading ? <p>Cargando…</p> : (
        <TokenList items={data} onRevoke={(id) => revoke.mutate(id)} onShowUsage={setUsageId} />
      )}
      <NewTokenDialog open={showNew} onOpenChange={setShowNew} onCreated={(p) => setGenerated(p.plaintext)} />
      <TokenGeneratedDialog open={!!generated} onOpenChange={(v) => !v && setGenerated(null)} plaintext={generated ?? ''} />
      <TokenUsageDrawer tokenId={usageId} onClose={() => setUsageId(null)} />
    </div>
  );
}
```

- [ ] **Step 8: Crear ruta TanStack `frontend/src/routes/_authenticated/admin/mcp/tokens.tsx`**

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { McpTokensPage } from '@/features/admin/mcp/routes/mcp-tokens-page';

export const Route = createFileRoute('/_authenticated/admin/mcp/tokens')({
  component: McpTokensPage,
});
```

- [ ] **Step 9: `npm run dev` y smoke local**

Abrir `http://localhost:5173/admin/mcp/tokens` (o la URL Netlify después de deploy), confirmar:
- Lista se carga (vacía al inicio).
- Botón "+ Nuevo token" abre modal.
- Crear token muestra plaintext y snippet JSON.
- Revocar marca como revocado.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/features/admin/mcp/ frontend/src/routes/_authenticated/admin/mcp/tokens.tsx
git commit -m "feat(mcp): UI admin tokens — lista, crear, revocar, usage drawer"
```

---

## Task 13: Frontend — página `/admin/mcp/usage` (monitoreo)

**Files:**
- Modify: `frontend/src/features/admin/mcp/api.ts` (agregar hook de usage)
- Create: `frontend/src/features/admin/mcp/components/usage-kpis.tsx`
- Create: `frontend/src/features/admin/mcp/components/usage-timeseries.tsx`
- Create: `frontend/src/features/admin/mcp/components/usage-top-tools.tsx`
- Create: `frontend/src/features/admin/mcp/components/usage-top-users.tsx`
- Create: `frontend/src/features/admin/mcp/components/usage-recent-errors.tsx`
- Create: `frontend/src/features/admin/mcp/routes/mcp-usage-page.tsx`
- Create: `frontend/src/routes/_authenticated/admin/mcp/usage.tsx`

- [ ] **Step 1: Agregar a `api.ts`**

```typescript
export type McpUsageResponse = {
  kpis: {
    total_calls: number; calls_ok: number; calls_error: number; error_rate: number;
    p50_ms: number; p95_ms: number; p99_ms: number;
    usuarios_activos: number; tokens_activos: number;
    downloads_pdf: number; downloads_xlsx: number;
  };
  serie_temporal: { bucket: string; ok: number; error: number; p95_ms: number }[];
  top_tools: { tool: string; calls: number; error_rate: number; p95_ms: number }[];
  top_usuarios: { usuario: string; calls: number; ultimo_uso: string }[];
  top_errores: { error_code: string; calls: number; ultima_tool: string }[];
};

export function useMcpUsage(filtros: Record<string, string | undefined>) {
  return useQuery({
    queryKey: ['mcp', 'usage', filtros],
    queryFn: async () => (await api.get<McpUsageResponse>('/api/admin/mcp/usage/', { params: filtros })).data,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
```

- [ ] **Step 2: `usage-kpis.tsx`**

```tsx
type Props = { kpis: import('../api').McpUsageResponse['kpis'] };
const Kpi = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-lg border p-4">
    <div className="text-2xl font-semibold">{value}</div>
    <div className="text-xs text-muted-foreground">{label}</div>
  </div>
);
export function UsageKpis({ kpis }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
      <Kpi label="Llamadas" value={kpis.total_calls.toLocaleString()} />
      <Kpi label="Error rate" value={`${(kpis.error_rate * 100).toFixed(2)}%`} />
      <Kpi label="p95" value={`${kpis.p95_ms} ms`} />
      <Kpi label="Usuarios activos" value={kpis.usuarios_activos} />
      <Kpi label="PDFs" value={kpis.downloads_pdf} />
      <Kpi label="Excel" value={kpis.downloads_xlsx} />
    </div>
  );
}
```

- [ ] **Step 3: `usage-timeseries.tsx`**

```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
type Props = { data: import('../api').McpUsageResponse['serie_temporal'] };
export function UsageTimeSeries({ data }: Props) {
  return (
    <div className="h-72 rounded-lg border p-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="bucket" tickFormatter={(v) => v.slice(11, 16)} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey="ok" stackId="a" fill="#10b981" name="OK" />
          <Bar dataKey="error" stackId="a" fill="#ef4444" name="Error" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 4: `usage-top-tools.tsx`**

```tsx
type Props = { items: import('../api').McpUsageResponse['top_tools']; onPick: (tool: string) => void };
export function UsageTopTools({ items, onPick }: Props) {
  return (
    <div className="rounded-lg border">
      <div className="border-b px-3 py-2 font-medium">Top tools</div>
      <ul className="divide-y">
        {items.map(t => (
          <li key={t.tool} className="flex justify-between px-3 py-2 hover:bg-muted cursor-pointer" onClick={() => onPick(t.tool)}>
            <span className="font-mono text-sm">{t.tool}</span>
            <span className="text-sm">{t.calls.toLocaleString()} · {(t.error_rate * 100).toFixed(1)}% err · {t.p95_ms} ms p95</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 5: `usage-top-users.tsx`**

```tsx
type Props = { items: import('../api').McpUsageResponse['top_usuarios']; onPick: (u: string) => void };
export function UsageTopUsers({ items, onPick }: Props) {
  return (
    <div className="rounded-lg border">
      <div className="border-b px-3 py-2 font-medium">Top usuarios</div>
      <ul className="divide-y">
        {items.map(u => (
          <li key={u.usuario} className="flex justify-between px-3 py-2 hover:bg-muted cursor-pointer" onClick={() => onPick(u.usuario)}>
            <span>{u.usuario}</span>
            <span className="text-sm">{u.calls.toLocaleString()} · {u.ultimo_uso}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 6: `usage-recent-errors.tsx`**

```tsx
type Props = { items: import('../api').McpUsageResponse['top_errores'] };
export function UsageRecentErrors({ items }: Props) {
  return (
    <div className="rounded-lg border">
      <div className="border-b px-3 py-2 font-medium">Errores frecuentes</div>
      <ul className="divide-y">
        {items.map((e, i) => (
          <li key={i} className="px-3 py-2 text-sm">
            <span className="font-mono">{e.error_code}</span> · {e.calls} veces · última: <span className="font-mono">{e.ultima_tool}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 7: `mcp-usage-page.tsx`**

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useMcpUsage } from '../api';
import { UsageKpis } from '../components/usage-kpis';
import { UsageTimeSeries } from '../components/usage-timeseries';
import { UsageTopTools } from '../components/usage-top-tools';
import { UsageTopUsers } from '../components/usage-top-users';
import { UsageRecentErrors } from '../components/usage-recent-errors';

export function McpUsagePage() {
  const [filtros, setFiltros] = useState<Record<string, string | undefined>>({ granularidad: 'hora' });
  const { data, isFetching, refetch } = useMcpUsage(filtros);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Uso del MCP</h1>
        <Button onClick={() => refetch()} disabled={isFetching}>↻ Refresh</Button>
      </div>
      {data && (
        <>
          <UsageKpis kpis={data.kpis} />
          <UsageTimeSeries data={data.serie_temporal} />
          <div className="grid md:grid-cols-2 gap-4">
            <UsageTopTools items={data.top_tools} onPick={(tool) => setFiltros({ ...filtros, tool })} />
            <UsageTopUsers items={data.top_usuarios} onPick={(usuario) => setFiltros({ ...filtros, usuario })} />
          </div>
          <UsageRecentErrors items={data.top_errores} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Ruta TanStack `frontend/src/routes/_authenticated/admin/mcp/usage.tsx`**

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { McpUsagePage } from '@/features/admin/mcp/routes/mcp-usage-page';

export const Route = createFileRoute('/_authenticated/admin/mcp/usage')({
  component: McpUsagePage,
});
```

- [ ] **Step 9: Modificar `frontend/src/components/layout/data/sidebar-data.ts`** — agregar entrada bajo Administración (gateada por `is_dba`):

```typescript
// Dentro del array de "Administración"
{ title: 'MCP Tokens', url: '/admin/mcp/tokens', icon: KeyRound, requires: 'is_dba' },
{ title: 'MCP Usage',  url: '/admin/mcp/usage',  icon: Activity,  requires: 'is_dba' },
```

(El predicado `requires: 'is_dba'` debe respetarse en `sidebar-data.ts` igual que los otros gates existentes. Si no existe el campo `requires`, leer el archivo y seguir el patrón actual: probablemente filtra por flags del usuario.)

- [ ] **Step 10: Smoke local**

Visitar `/admin/mcp/usage` y confirmar:
- KPIs cargan (con datos vacíos si aún no hay uso).
- Gráfico se renderiza.
- Click en un tool del top filtra el tablero.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/features/admin/mcp/ frontend/src/routes/_authenticated/admin/mcp/usage.tsx frontend/src/components/layout/data/sidebar-data.ts
git commit -m "feat(mcp): vista de monitoreo /admin/mcp/usage + entradas sidebar gateadas"
```

---

## Task 14: Deploy a VM + smoke end-to-end con Claude Desktop

**Files:** ninguno — comandos.

- [ ] **Step 1: Push frontend a `main` (Netlify)**

```bash
git push origin main
```

Expected: Netlify build verde.

- [ ] **Step 2: Deploy backend al VM (skill sigaft-deploy-vm)**

```bash
pscp -batch -r backend/apps/mcp        jcabreu@10.0.0.99:/home/jcabreu/facturation-system/backend/apps/
pscp -batch backend/facturation_api/settings.py jcabreu@10.0.0.99:/home/jcabreu/facturation-system/backend/facturation_api/
pscp -batch backend/facturation_api/urls.py     jcabreu@10.0.0.99:/home/jcabreu/facturation-system/backend/facturation_api/
pscp -batch backend/facturation_api/asgi.py     jcabreu@10.0.0.99:/home/jcabreu/facturation-system/backend/facturation_api/
pscp -batch backend/requirements.txt            jcabreu@10.0.0.99:/home/jcabreu/facturation-system/backend/
plink -batch jcabreu@10.0.0.99 "cd /home/jcabreu/facturation-system && docker compose build backend && docker compose up -d backend"
```

- [ ] **Step 3: Configurar env vars de memory-router en el VM**

Editar `.env` del compose, agregar:

```
MEMORY_ROUTER_URL=http://memory-router-host
MEMORY_ROUTER_TOKEN=<service-token>
MEMORY_ROUTER_PROJECT=facture-project
```

Reiniciar: `docker compose restart backend`.

- [ ] **Step 4: Crear token de prueba en `/admin/mcp/tokens`**

Login JCABREU → "Nuevo token" → usuario JCABREU, nombre "Smoke test", empresa 01 (no bloquear), punto 01 (no bloquear), expira en 7 días → Generar. Copiar plaintext.

- [ ] **Step 5: Configurar Claude Desktop**

`~/.config/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "zentoryerp": {
      "type": "http",
      "url": "https://grupo-abregonza.hopto.org:8443/mcp/",
      "headers": { "Authorization": "Bearer mcp_<...token...>" }
    }
  }
}
```

Reiniciar Claude Desktop.

- [ ] **Step 6: Validar tools disponibles**

En Claude Desktop, abrir un chat y pedir: "lista las tools disponibles del MCP zentoryerp". Esperar: aparece `memoria_buscar`, `memoria_briefing`, `doc_tipos_listar`, etc.

- [ ] **Step 7: Smoke calls reales**

Pedirle a Claude Desktop:
1. "Usa `memoria_buscar` para encontrar memorias sobre NCF" → debe responder con resultados del proyecto.
2. "Llama `doc_tipos_listar` modulo=fat no_cia=01" → en este plan el registry FAT aún no está poblado, debería devolver `data.tipos = []` o `VALIDATION_ERROR módulo desconocido` (esperado — Plan 2 lo poblará).

- [ ] **Step 8: Verificar auditoría**

Abrir `/admin/mcp/usage` → ver KPIs ≥ 1 llamada, top_tools con `memoria_buscar`.
Abrir drawer de uso del token → ver las llamadas registradas con duration_ms.

- [ ] **Step 9: Commit del último ajuste si lo hubo, y tag**

```bash
git tag mcp-plan-1-foundations
git push origin mcp-plan-1-foundations
```

---

## Notas para planes siguientes

- **Plan 2 — FAT pilot end-to-end:** registrar módulo FAT en `doc_types.py` (TFAT_TDOCU), implementar tools `fat_*` reusando `fat_repo`, primer `<modulo>_crear_<recurso>` end-to-end con NCF, smoke con Claude Desktop creando una factura real en empresa 01.
- **Plan 3 — Descargas firmadas:** `downloads.py` (JWT corto sin `usr`), `excel.py` con `openpyxl write_only`, tools `print_documento_pdf` / `export_excel`, endpoint `/api/mcp/dl/<sig>/`.
- **Planes 4-12:** un plan por módulo (CXC, CXP, INV, CNT, CHC, SDN, ACF, ACC, ODC, MAN) siguiendo el patrón de Plan 2.

---

## Self-review checklist (corre al terminar de leer este plan antes de ejecutar)

- [ ] El comando `python manage.py migrate mcp` en VM corre limpio.
- [ ] `pytest apps/mcp/tests/` pasa todos los tests (>=20 tests al final).
- [ ] `/admin/mcp/tokens` solo visible para usuarios DBA.
- [ ] Generar token muestra plaintext **una sola vez**; un GET posterior no lo expone.
- [ ] Cliente MCP real (Claude Desktop) lista tools y ejecuta `memoria_buscar` con éxito.
- [ ] `/admin/mcp/usage` muestra al menos una llamada después del smoke.
- [ ] Token revocado deja de funcionar inmediatamente (invalidate_cache).
