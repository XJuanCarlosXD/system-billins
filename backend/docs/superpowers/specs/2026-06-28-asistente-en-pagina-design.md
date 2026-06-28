# Asistente en página — diseño

**Fecha:** 2026-06-28
**Autores:** JCABREU + Claude
**Estado:** Diseño aprobado, listo para plan de implementación

## Objetivo

Añadir a ZentoryERP un **asistente conversacional embebido** que:

- Aparezca como botón flotante en cualquier página autenticada.
- Abra una vista `/asistente` full-screen con sidebar de historial, chat central y panel de tool-use.
- Esté potenciado por Claude (Anthropic API, Haiku 4.5 por defecto) y, en el futuro, opcionalmente por Ollama.
- Pueda invocar los tools del MCP server (`memoria_*`, `doc_tipos_*`) y nuevos handlers in-process para los repos de cada módulo (FAT, CHC, INV, CXC, CXP, CNT, etc.).
- Soporte **skills** estilo playbook (markdown) que enseñen al agente flujos de negocio completos (facturar, cotizar, conciliar, cerrar caja, etc.).
- Esté **estrictamente limitado** a los accesos del usuario logueado — no puede hacer nada que el usuario no pueda hacer manualmente.

Deja la opción **provider-agnostic**: hoy entregamos `ClaudeProvider`, mañana se puede activar `OllamaProvider` sin tocar el resto del sistema.

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (React)                                                │
│  ┌────────────────┐    ┌────────────────────────────────────┐   │
│  │ Floating btn   │ →  │  /asistente   (full-screen)        │   │
│  │ (bottom-right) │    │  ┌────────────┐  ┌──────────────┐  │   │
│  └────────────────┘    │  │ Chat hist. │  │ Tool-use log │  │   │
│                        │  │ + composer │  │ (collapsible)│  │   │
│                        │  └────────────┘  └──────────────┘  │   │
│                        └─────────────┬──────────────────────┘   │
└──────────────────────────────────────┼──────────────────────────┘
                                       │ POST /api/asistente/.../chat/  (SSE)
                                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Django backend (apps/asistente)                                │
│                                                                 │
│  views.ChatStreamView                                           │
│      │                                                          │
│      ▼                                                          │
│  agent_loop.run(conversacion_id, mensaje_usuario)               │
│      │                                                          │
│      ├─ load history from Oracle                                │
│      ├─ provider = ClaudeProvider | OllamaProvider              │
│      ├─ tools = ToolRegistry.list_for(usuario)                  │
│      │                                                          │
│      ├─ while LLM pide tool_use:                                │
│      │     - validate user permissions (6 capas)                │
│      │     - si write → emit SSE "tool_pending", pausa hasta    │
│      │       confirm/reject                                     │
│      │     - else ejecuta in-process                            │
│      │     - emit SSE "tool_result"                             │
│      │     - feed result back al LLM                            │
│      │                                                          │
│      └─ emit SSE "message_complete" → persiste en Oracle        │
│                                                                 │
│  Tablas nuevas (schema ABREGONZA):                              │
│    TCHAT_CONVERSACION                                           │
│    TCHAT_MENSAJE                                                │
│    TCHAT_TOOL_PENDING                                           │
│    TCHAT_TOOL_LOG                                               │
└─────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                              ┌────────────────────┐
                              │  Anthropic SDK     │
                              │  (claude-haiku-4-5)│
                              │  + prompt cache    │
                              └────────────────────┘
```

### Decisiones clave

- **Agent loop en backend Django** (no en browser): la API key Anthropic vive en `ANTHROPIC_API_KEY` del `.env` de la VM, nunca llega al cliente. El audit y el rate limit son centrales.
- **Tools in-process** (no HTTP roundtrip al MCP server): los handlers del agent loop importan directamente `apps.legacy.repositories.*` y `apps.mcp.tools.*`. La capa MCP HTTP queda para clientes externos (Claude Desktop).
- **SSE para streaming**: `text/event-stream` desde Django (Starlette/uvicorn ya manejan esto bien). El browser usa `EventSource` o `fetch` + `ReadableStream`.
- **Persistencia Oracle**: cuatro tablas nuevas en `ABREGONZA`, no en los schemas de módulo. El usuario tiene `ON DELETE CASCADE` desde mensajes a conversación.
- **Tool-use confirmation**: la tabla `TCHAT_TOOL_PENDING` actúa como cola in-DB con expiración 5 min. El agent loop espera con un `asyncio.Future` indexado por `sig` en memoria del proceso.

### Provider interface

```python
# apps/asistente/providers/base.py
class BaseProvider(ABC):
    @abstractmethod
    async def stream(
        self, *, model: str, system: str, messages: list,
        tools: list, max_tokens: int = 4096,
    ) -> AsyncIterator[ProviderEvent]:
        """Yields TextDelta, ToolUse, MessageComplete, Error."""

# apps/asistente/providers/claude.py
class ClaudeProvider(BaseProvider):
    """Usa anthropic SDK con prompt caching en system + tools."""
    # cache_control en system y en cada tool del array

# apps/asistente/providers/ollama.py
class OllamaProvider(BaseProvider):
    async def stream(self, ...):
        raise NotImplementedError(
            "Pendiente de activación — requiere host con Ollama. "
            "Spec acordó dejar la implementación pero no desplegarla."
        )
```

## Data model

### `ABREGONZA.TCHAT_CONVERSACION`

| Col              | Tipo              | Notas                                          |
|------------------|-------------------|------------------------------------------------|
| CONV_ID          | VARCHAR2(36) PK   | UUID                                            |
| USUARIO          | VARCHAR2(30)      | = TCSC.USUARIO                                  |
| NO_CIA           | VARCHAR2(2)       | Contexto activo al abrir; congelado             |
| PUNTO            | VARCHAR2(2)       |                                                |
| TITULO           | VARCHAR2(200)     | Auto-titled tras 1er turno                      |
| MODEL            | VARCHAR2(40)      | `claude-haiku-4-5` (default)                    |
| SKILL_ACTIVA     | VARCHAR2(60)      | NULL o el nombre de la skill activa             |
| FECHA_CREACION   | DATE              | SYSDATE                                         |
| FECHA_ULTIMO     | DATE              | SYSDATE en cada turno                           |
| ARCHIVADA        | CHAR(1)           | 'S'/'N', soft delete                            |
| TOKENS_IN_TOT    | NUMBER(10)        | Acumulado                                       |
| TOKENS_OUT_TOT   | NUMBER(10)        |                                                |
| COSTO_USD        | NUMBER(12,6)      |                                                |

Índice: `(USUARIO, FECHA_ULTIMO DESC)` para sidebar.

### `ABREGONZA.TCHAT_MENSAJE`

| Col              | Tipo              | Notas                                          |
|------------------|-------------------|------------------------------------------------|
| MENSAJE_ID       | VARCHAR2(36) PK   |                                                |
| CONV_ID          | VARCHAR2(36) FK   | ON DELETE CASCADE                               |
| SEQ              | NUMBER(6)         | 1, 2, 3... UNIQUE(CONV_ID, SEQ)                 |
| ROLE             | VARCHAR2(15)      | 'user' \| 'assistant' \| 'tool'                |
| CONTENIDO        | CLOB              | Texto markdown o JSON tool_result               |
| TOOL_CALLS_JSON  | CLOB              | Si role=assistant y pidió tools                 |
| TOOL_CALL_ID     | VARCHAR2(40)      | Si role=tool, a qué call corresponde            |
| TOKENS_IN        | NUMBER(8)         |                                                |
| TOKENS_OUT       | NUMBER(8)         |                                                |
| CACHE_HIT_IN     | NUMBER(8)         |                                                |
| COSTO_USD        | NUMBER(12,6)      |                                                |
| FECHA_CREACION   | DATE              |                                                |

### `ABREGONZA.TCHAT_TOOL_PENDING`

| Col              | Tipo              | Notas                                          |
|------------------|-------------------|------------------------------------------------|
| SIG              | VARCHAR2(32) PK   | `tpx_a1b2c3...`                                |
| CONV_ID          | VARCHAR2(36)      |                                                |
| MENSAJE_ID       | VARCHAR2(36)      | Mensaje assistant que la solicitó               |
| TOOL_NAME        | VARCHAR2(60)      |                                                |
| ARGS_JSON        | CLOB              |                                                |
| PREVIEW          | VARCHAR2(500)     | "Factura FT-001 → JUAN PEREZ por RD$5,250.00"  |
| STATUS           | CHAR(1)           | 'P' Pending, 'A' Approved, 'R' Rejected, 'X' Expired |
| USUARIO          | VARCHAR2(30)      | Quien debe confirmar                            |
| FECHA_CREACION   | DATE              |                                                |
| FECHA_EXPIRA     | DATE              | creación + 5min                                 |
| FECHA_RESUELTA   | DATE              |                                                |

Cron cada 1 min: marca `STATUS='X'` donde `STATUS='P' AND FECHA_EXPIRA < SYSDATE`.

### `ABREGONZA.TCHAT_TOOL_LOG`

| Col              | Tipo              | Notas                                          |
|------------------|-------------------|------------------------------------------------|
| LOG_ID           | VARCHAR2(36) PK   |                                                |
| CONV_ID          | VARCHAR2(36)      |                                                |
| MENSAJE_ID       | VARCHAR2(36)      |                                                |
| USUARIO          | VARCHAR2(30)      |                                                |
| NO_CIA           | VARCHAR2(2)       |                                                |
| PUNTO            | VARCHAR2(2)       |                                                |
| TOOL_NAME        | VARCHAR2(60)      |                                                |
| ARGS_HASH        | VARCHAR2(64)      | sha256(json) — para auditoría sin datos sensibles |
| ARGS_PREVIEW     | VARCHAR2(500)     | "no_cliente=001234, monto=5250.00"             |
| OK               | CHAR(1)           |                                                |
| ERROR_CODE       | VARCHAR2(40)      |                                                |
| DURATION_MS      | NUMBER(8)         |                                                |
| WAS_WRITE        | CHAR(1)           |                                                |
| CONFIRMED_BY     | VARCHAR2(30)      | Quien aprobó el modal                           |
| FECHA            | DATE              |                                                |

Índices: `(USUARIO, FECHA DESC)`, `(CONV_ID, FECHA)`.

## API

### Endpoints

| Método | Path | Propósito |
|--------|------|-----------|
| GET    | `/api/asistente/conversaciones/` | Lista mis conversaciones (paginada, búsqueda por título). |
| POST   | `/api/asistente/conversaciones/` | Crea conversación nueva. |
| GET    | `/api/asistente/conversaciones/<id>/` | Trae mensajes (con tool_calls/tool_results inline). |
| DELETE | `/api/asistente/conversaciones/<id>/` | Borra (soft delete). |
| POST   | `/api/asistente/conversaciones/<id>/chat/` | **SSE stream**, envía `{message}`, recibe events. |
| POST   | `/api/asistente/confirm/<sig>/` | Aprueba/rechaza un `tool_pending`. Body: `{"approve": true \| false}`. |
| GET    | `/api/asistente/tools/` | Lista de tools disponibles para el usuario. |
| GET    | `/api/asistente/skills/` | Lista skills (frontmatter only). |
| GET    | `/api/asistente/skills/<name>/` | Skill completa (markdown + frontmatter). |
| PUT    | `/api/asistente/skills/<name>/` | Edita (sólo DBA). |
| POST   | `/api/asistente/skills/` | Crea nueva skill (sólo DBA). |
| DELETE | `/api/asistente/skills/<name>/` | Soft-delete (mueve a `.archived/`). |
| GET    | `/api/admin/asistente/auditoria/` | Vista admin del log de tools (sólo DBA). |

### SSE event stream

```
event: turn_started
data: {"conversacion_id": "uuid", "model": "claude-haiku-4-5"}

event: token
data: {"text": "Voy a buscar tus facturas pen"}

event: token
data: {"text": "dientes de cobro..."}

event: tool_pending           ← writes (confirm_required)
data: {"sig": "tpx_a1b2c3", "tool": "fat_crear_factura",
       "args": {...}, "preview": "Factura FT-001 → JUAN PEREZ por RD$5,250.00",
       "expires_at": "2026-06-28T20:35:00Z"}

event: tool_call              ← reads (auto-ejecutado)
data: {"call_id":"tc_001","tool":"chc_rep_disponibilidad",
       "args":{"no_cia":"01","punto":"01"}}

event: tool_result
data: {"call_id":"tc_001","ok":true,"duration_ms":342,"data":{...}}

event: tool_error
data: {"call_id":"tc_002","ok":false,"error_code":"VALIDATION_ERROR",
       "message":"Cliente 001234 no existe"}

event: skill_activated
data: {"skill":"facturar"}

event: message_complete
data: {"mensaje_id":"msg_999","tokens_in":1240,"tokens_out":86,
       "cost_usd":0.00091,"stopped_for_confirm":false}
```

## Tool registry

`apps/asistente/tools/registry.py`:

```python
@dataclass
class ToolSpec:
    name: str
    description: str
    input_schema: dict           # JSON schema (compatible Anthropic)
    handler: Callable            # async fn(user, args) → dict
    write: bool = False          # True ⇒ confirm_required
    modules_required: list[str] = field(default_factory=list)  # ['FAT'], ['CHC'], etc.

REGISTRY: dict[str, ToolSpec] = { ... }

def list_for_user(user) -> list[ToolSpec]:
    flags = get_user_module_flags(user)
    return [t for t in REGISTRY.values()
            if all(flags.get(m) == 'S' for m in t.modules_required)]
```

### Tools de Fase 1

**Memoria (existentes en MCP, wrappeados in-process):**
- `memoria_buscar`, `memoria_obtener`, `memoria_briefing`, `memoria_skills_disponibles`, `memoria_obtener_skill`

**Doc types (existentes):**
- `doc_tipos_listar`, `doc_tipos_describir`

**Skills:**
- `skill_listar` (read), `skill_cargar(nombre)` (read)

**FAT** (módulo FAT requerido):
- `fat_buscar_cliente(query)` read
- `fat_proximo_ncf(no_cia, tipo_ncf)` read
- `fat_buscar_producto(query)` read
- `fat_listar_facturas(no_cia, punto, fecha_desde, fecha_hasta, no_cliente?)` read
- `fat_cuadre_caja(no_cia, punto, fecha)` read
- `fat_crear_factura(...)` **write**
- `fat_crear_cotizacion(...)` **write**
- `fat_cerrar_caja(no_cia, punto, fecha)` **write**

**CHC** (módulo CHC requerido):
- `chc_listar_cheques(no_cia, punto, cuenta_banco?, status?, fecha_desde, fecha_hasta)` read
- `chc_listar_cuentas(no_cia, punto)` read
- `chc_rep_disponibilidad(no_cia, punto)` read
- `chc_rep_movimientos(no_cia, punto, cuenta_banco, fecha_desde, fecha_hasta)` read
- `chc_conciliar_bulk(...)` **write**
- `chc_cierre_conciliacion(...)` **write**

**CXC** (módulo CXC requerido):
- `cxc_buscar_cliente(query)` read
- `cxc_estado_cuenta(no_cliente)` read
- `cxc_aging(no_cia, punto)` read
- `cxc_listar_documentos(no_cliente, fecha_desde, fecha_hasta)` read

**CXP** (módulo CXP requerido):
- `cxp_buscar_proveedor(query)` read
- `cxp_estado_cuenta(no_proveedor)` read
- `cxp_aging(no_cia, punto)` read

**CNT** (módulo CNT requerido):
- `cnt_listar_companias()` read
- `cnt_crear_compania(...)` **write**
- `cnt_crear_punto(...)` **write**

**INV** (módulo INV requerido):
- `inv_buscar_producto(query)` read (existencia + lista de precios)
- `inv_listar_movimientos(no_produ)` read

## Skills (playbooks)

Cada skill es un markdown con frontmatter + cuerpo, guardado en:

```
backend/apps/asistente/skills/
├── facturar/
│   ├── SKILL.md
│   └── examples/
│       ├── factura-credito.json
│       └── factura-contado.json
├── cotizar/
│   └── SKILL.md
├── cerrar-caja/
│   └── SKILL.md
├── conciliar-banco/
│   └── SKILL.md
├── consultar-cuenta-cliente/
│   └── SKILL.md
└── nueva-empresa-onboarding/
    └── SKILL.md
```

### Formato

```markdown
---
name: facturar
description: Crear una factura de venta nueva en FAT.
when_to_use:
  - "hacer una factura"
  - "facturar a {cliente}"
  - "nueva venta"
modules_required: [FAT]
tools_used:
  - fat_buscar_cliente
  - fat_proximo_ncf
  - fat_buscar_producto
  - fat_crear_factura
estimated_steps: 4-7
---

# Skill: Facturar

(playbook paso a paso aquí)
```

### Activación (3 vías)

1. **Manual desde UI**: chip "Skill: ..." en el header del chat → dropdown filtrado por permisos.
2. **Auto-sugerencia**: regex sobre `when_to_use` triggers → banner sutil "¿Activo modo facturar?".
3. **Tool-driven**: el agente llama `skill_cargar(nombre)` cuando detecta la necesidad.

Al activar, el contenido del `SKILL.md` se inyecta al system prompt de la siguiente llamada al LLM. La conversación recuerda la skill activa en `TCHAT_CONVERSACION.SKILL_ACTIVA`.

### Skills entregadas en Fase 1

| Skill | Descripción | Tools usados |
|-------|-------------|---------------|
| `facturar` | Crear factura de venta (B01-B15) | fat_buscar_cliente, fat_proximo_ncf, fat_buscar_producto, **fat_crear_factura** |
| `cotizar` | Crear cotización (sin NCF) | fat_buscar_cliente, fat_buscar_producto, **fat_crear_cotizacion** |
| `cerrar-caja` | Cuadre de caja + cierre | fat_cuadre_caja, fat_listar_facturas, **fat_cerrar_caja** |
| `conciliar-banco` | Marcar conciliados + cierre mensual | chc_listar_cheques, **chc_conciliar_bulk**, **chc_cierre_conciliacion** |
| `consultar-cuenta-cliente` | Estado de cuenta + movimientos | cxc_buscar_cliente, cxc_estado_cuenta, cxc_aging |
| `nueva-empresa-onboarding` | Wizard registro empresa nueva | cnt_listar_companias, **cnt_crear_compania**, **cnt_crear_punto** |

### Editor de skills

UI `/asistente/skills` (lista) + `/asistente/skills/<name>/edit` (Monaco editor, split markdown/preview). Sólo DBA. Cambios commiteables al repo principal por un flujo de PR opcional.

## Autorización per-usuario (6 capas)

Regla dura: **el agente es exactamente tan poderoso como el usuario logueado**.

1. **Tool registry filtrado**: `list_for_user(user)` esconde tools cuyo `modules_required` el usuario no tiene activos. El LLM ni siquiera ve la tool.
2. **Validación de `no_cia`/`punto`**: cada tool call comprueba contra `get_user_cias(user, modulo)` y `get_user_puntos(...)`. Si el LLM intenta `fat_listar_facturas(no_cia='03')` y el usuario sólo tiene `01`, devuelve `FORBIDDEN_CIA`.
3. **Permisos a nivel documento (`TXXX_USUARIOD`)**: writes específicos heredan el gate existente de `permissions_repo.has_doc_permission(...)`.
4. **Handler ejecuta como el usuario**: `usuario=user.username` siempre se propaga al repo, y los `VALIDA_USUARIO_*` triggers Oracle se aplican.
5. **Skills no eluden permisos**: `skill_cargar` valida `modules_required` de la skill antes de devolver el contenido. Si la skill menciona tools que el usuario no tiene, le añade un aviso al cuerpo.
6. **System prompt no engañoso**: el system prompt fijo del agente le dice explícitamente:
   - No afirmes que puedes hacer algo que el sistema rechazó por permisos.
   - Si recibes `FORBIDDEN_*`, explica qué permiso falta y sugiere pedirle al DBA.
   - Nunca intentes "rodear" el límite con otro tool.

### Tabla de comportamiento

| Petición del usuario | Resultado |
|---|---|
| "Lista mis facturas de hoy" | ✅ ejecuta `fat_listar_facturas(no_cia=su_cia)` |
| "Lista las facturas de empresa 03" | ❌ `FORBIDDEN_CIA` — bot explica |
| "Crea una factura" | ✅ `fat_crear_factura` con modal de confirmación |
| "Modifica el catálogo contable" | ❌ `FORBIDDEN_MODULE` o tool no visible |
| "Anula la factura FT-999" | ❌ si no tiene `TFAT_USUARIOD` para tipo AN |
| "Cierra el banco del mes" | ✅ con modal si tiene CHC, ❌ si no |

## UX

### Botón flotante

- Posición: `fixed; bottom: 24px; right: 24px; z-index: 50`.
- Tamaño 56×56, sombra, icono chat lucide.
- Estados:
  - `idle`: icono chat.
  - `busy`: 3 puntos animados (conversación corriendo en otra tab).
  - `pending-confirm`: badge ámbar `1` (hay un `tool_pending` esperando).
- Tooltip "Asistente · Ctrl+K".
- Click → `navigate({ to: '/asistente', search: { conv_id: lastActive ?? 'new' } })`.
- Oculto en `/asistente`, `/print/*` y `/login`.

### Página `/asistente`

Layout dedicado (no usa `Header` del módulo), 3 columnas:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ┌── Sidebar (260px) ────┐  ┌── Chat ────────────────┐  ┌── Tool log ────┐  │
│ │ 🔍 Buscar conv...     │  │  ZentoryERP Asistente  │  │ ▼ Tool calls   │  │
│ │ + Nueva conversación  │  │  Empresa 01 · Punto 01 │  │ 🔵 listar_facs │  │
│ │ ▼ Hoy                 │  │  Skill: facturar       │  │   ok · 342ms   │  │
│ │ • Facturas pendientes │  │ ┌────────────────────┐ │  │ 🟡 crear_fact  │  │
│ │ • Cierre CHC junio    │  │ │ [usuario] ...      │ │  │   PENDING ⏳   │  │
│ │ ▼ Ayer                │  │ │ [asistente] ...    │ │  │   [Confirmar]  │  │
│ │ ...                   │  │ │ ↳ tool_use         │ │  │   [Cancelar]   │  │
│ │ ⚙ Modelo: Haiku 4.5 ▼ │  │ │                    │ │  │ 🔴 chc_concil  │  │
│ │ 🎓 Skills...          │  │ │                    │ │  │   error: ...   │  │
│ │ 🗑 Archivar todas     │  │ │  Escribe...     ↵  │ │  │ ▼ Auditoría    │  │
│ │ Tokens hoy: 12.4k     │  │ └────────────────────┘ │  │ tokens:1240    │  │
│ │ Costo hoy: $0.12      │  │                        │  │ costo:$0.001   │  │
│ └───────────────────────┘  └────────────────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Comportamiento

- **Stream**: tokens carácter-a-carácter via SSE.
- **Tool log** (panel 320px, colapsable):
  - Filas con icono (🔵 ok, 🟡 pending, 🔴 error), nombre, duración, link "Ver detalle".
  - `pending` muestra botones inline `[Confirmar] [Cancelar]` → `POST /api/asistente/confirm/<sig>/`.
  - Sección "Auditoría" al fondo: tokens, cache hits, costo acumulado.
- **Composer**: textarea auto-resize, Enter envía, Shift+Enter newline.
- **Sidebar**: agrupada por fecha. Búsqueda full-text en backend (LIKE sobre TITULO + primeros 200 chars).
- **Atajos**: `Ctrl+K` toggle, `Esc` cancela stream, `Ctrl+/` foca búsqueda, `Ctrl+N` nueva.
- **Empresa congelada**: el contexto `no_cia/punto` se fija al inicio de la conversación. Si el usuario cambia de empresa en el sidebar global, banner discreto avisa.

### Modal de confirmación (write)

Al recibir SSE `tool_pending`, la UI:
1. Muestra la fila en el tool-log con borde ámbar y botones `[Confirmar] [Cancelar]`.
2. Sub-modal opcional con detalle expandido: args completos en JSON formateado + preview en lenguaje natural.
3. Si pasa 5 min sin acción, la fila se marca `EXPIRADO` y el agente recibe `USER_TIMEOUT` como resultado.

## Configuración

`.env` del backend VM (variables nuevas):

```
ANTHROPIC_API_KEY=sk-ant-...
ASISTENTE_DEFAULT_MODEL=claude-haiku-4-5
ASISTENTE_MAX_TURNS_PER_CONVERSATION=200
ASISTENTE_DAILY_BUDGET_USD_PER_USER=2.00
ASISTENTE_TOOL_PENDING_TTL_SEC=300
# Futuro (Ollama):
# OLLAMA_BASE_URL=http://ollama-host:11434
# OLLAMA_DEFAULT_MODEL=qwen2.5:3b
```

`Settings.py`:

```python
ANTHROPIC_API_KEY = env('ANTHROPIC_API_KEY')
ASISTENTE_DEFAULT_MODEL = env('ASISTENTE_DEFAULT_MODEL', default='claude-haiku-4-5')
ASISTENTE_MAX_TURNS = env.int('ASISTENTE_MAX_TURNS_PER_CONVERSATION', default=200)
ASISTENTE_DAILY_BUDGET_USD = env.float('ASISTENTE_DAILY_BUDGET_USD_PER_USER', default=2.0)
```

## Seguridad y privacidad

- **API key**: en `.env` server-side, jamás expuesta al cliente.
- **Datos sensibles en logs**: `TCHAT_TOOL_LOG.ARGS_HASH` es sha256, no se guardan los args completos. `ARGS_PREVIEW` es una representación corta (sin RNC, sin montos completos en algunos casos).
- **Rate limit**: por usuario, configurable. Default 100 turnos/hora, presupuesto $2/día por usuario.
- **Cost cap**: si la conversación supera `ASISTENTE_DAILY_BUDGET_USD_PER_USER`, el siguiente turn devuelve un error UI-friendly antes de llamar al provider.
- **Prompt injection**: el system prompt es explícito sobre seguir órdenes del *sistema* y no del usuario para casos de bypass de permisos. El gate real está en las capas 1-5, no en el LLM.

## Testing

Cada componente probable independientemente:

- `tests/test_tool_registry.py`: filtrado por usuario, validación de `no_cia/punto`, manejo de `FORBIDDEN_*`.
- `tests/test_agent_loop.py`: ciclo con MockProvider, write requiere confirm, expired tool, multi-turn.
- `tests/test_skills.py`: parse frontmatter, filtrado por permisos, inyección al system prompt.
- `tests/test_persistence.py`: secuenciación de mensajes, cascada al borrar conversación.
- `tests/test_providers_claude.py`: con MockAnthropic, validar prompt caching y serialización de tools.
- `tests/test_views_chat.py`: SSE end-to-end con MockProvider.

Smoke real con MockProvider que devuelve una secuencia determinística de `text → tool_use → text → done`.

## Plan en alto nivel (deja el detalle para `writing-plans`)

Cuatro entregables grandes, cada uno es un PR:

1. **Backend foundations** — apps/asistente con providers/, tools/registry, tools/skills, agent_loop, DDL, endpoints CRUD conversaciones + chat SSE + confirm. Tests con MockProvider.
2. **Tools por módulo** — handlers para FAT, CHC, CXC, CXP, CNT, INV (read + write). Tests por handler.
3. **Skills Fase 1** — 6 SKILL.md + editor admin + endpoints CRUD skills.
4. **Frontend** — botón flotante, página /asistente, sidebar + chat + tool log, modal de confirmación, atajos. Wire de SSE con EventSource.

Cada PR es desplegable y testeable solo. El frontend es lo último para asegurar que el backend está cerrado antes de pintar nada.

## Migración / coexistencia

- No toca `apps/mcp` — esa capa queda intacta para clientes externos (Claude Desktop). El agent loop in-page **reusa los handlers** de los tools pero no pasa por la API HTTP `/mcp/`.
- `features/chats/` (chat people-to-people demo existente) se queda como está, sin tocarlo. El nuevo asistente vive en `features/asistente/`.

## Métricas a medir

- Activaciones de skill por nombre (qué skills se usan más).
- Tasa de confirmación vs rechazo en writes.
- Tiempo medio del agent loop por turno.
- Costo/día/usuario.
- Tasa de `FORBIDDEN_*` (puede revelar problemas de UX de permisos).

## Roadmap post-Fase 1

- OllamaProvider activado (cuando haya host con compute).
- Tools adicionales: SDN, ACF, ODC, ACC, MAN (los módulos restantes).
- Skills adicionales: anular factura, devolución, ajuste contable, conciliación de tarjetas, cierre mensual CNT.
- Voz a texto en el composer.
- Reutilización de skills como "macros" disparables desde botones en cualquier pantalla del módulo (ej. botón "Facturar con AI" en /fat/nueva-factura).
