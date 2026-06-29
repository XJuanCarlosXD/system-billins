# Plan de implementación — Asistente en página

**Spec base:** `backend/docs/superpowers/specs/2026-06-28-asistente-en-pagina-design.md`
**Repo:** github.com/XJuanCarlosXD/system-billins (main → Netlify)
**VM backend:** `jcabreu@10.0.0.99` (pscp / plink en `C:\Users\JCABREU\bin\`)
**Branch:** `asistente/foundations` (crearla al primer step si no existe)

## Convenciones

- Cada step que toque código en backend: `pscp` al VM + `py_compile` + smoke.
- Cada step que toque frontend: push a `main` (NO pscp del frontend, va por Netlify).
- TDD donde aplica: failing test → impl → passing test → commit.
- Commits: prefijar con `feat(asistente):`, `test(asistente):` o `chore(asistente):`.
- Si un step requiere decisión humana, márcalo `- [?]` y continúa.
- Si está bloqueado por infra (VM down, API key faltante, etc.), márcalo `- [!]`.
- Al cerrar un PR de los 4 grandes, marca el header con ✅.

## PR 1 — Backend foundations

### Task 1: bootstrap apps/asistente

- [x] **Step 1**: crear estructura.
  ```
  backend/apps/asistente/
  ├── __init__.py
  ├── apps.py
  ├── urls.py
  ├── views_chat.py
  ├── views_conversaciones.py
  ├── views_skills.py
  ├── views_admin.py
  ├── agent_loop.py
  ├── providers/
  │   ├── __init__.py
  │   ├── base.py
  │   ├── claude.py
  │   └── ollama.py
  ├── tools/
  │   ├── __init__.py
  │   ├── registry.py
  │   ├── permissions.py
  │   ├── memoria.py        # wrappers in-process de apps.mcp.tools.memoria
  │   ├── doc_types.py
  │   └── skills.py
  ├── skills/               # contenido de los .md (Task 9)
  ├── sql/
  │   └── 001_create_tchat.sql
  ├── migrations/
  └── tests/
      ├── __init__.py
      ├── conftest.py
      └── ...
  ```

  ```bash
  git checkout -b asistente/foundations
  git add backend/apps/asistente/
  git commit -m "feat(asistente): bootstrap apps/asistente"
  ```

- [x] **Step 2**: añadir `apps.asistente` a `INSTALLED_APPS` en `facturation_api/settings.py` y `path('api/', include('apps.asistente.urls'))` en `facturation_api/urls.py`.
- [x] **Step 3**: variables de entorno en `settings.py` (`ANTHROPIC_API_KEY`, `ASISTENTE_DEFAULT_MODEL`, `ASISTENTE_MAX_TURNS`, `ASISTENTE_DAILY_BUDGET_USD`, `ASISTENTE_TOOL_PENDING_TTL_SEC`).
- [x] **Step 4**: añadir `anthropic>=0.40` y `httpx-sse` a `backend/requirements.txt`.
- [x] **Step 5**: smoke `docker compose exec backend python -c "import anthropic; print(anthropic.__version__)"` en VM.

### Task 2: DDL Oracle

- [x] **Step 1**: escribir `apps/asistente/sql/001_create_tchat.sql` con las 4 tablas (`TCHAT_CONVERSACION`, `TCHAT_MENSAJE`, `TCHAT_TOOL_PENDING`, `TCHAT_TOOL_LOG`) según spec § Data model.
- [x] **Step 2**: ejecutar contra Oracle real (sin sqlplus en container → usé `apps/asistente/sql/_run_001.py` con `apps.legacy.client`).
- [x] **Step 3**: verificado con `_verify_001.py`: las 4 tablas existen en `ABREGONZA`.
- [x] **Step 4**: SQL committeado como referencia.

### Task 3: Provider interface + ClaudeProvider

- [x] **Step 1**: failing test `tests/test_providers_claude.py::test_stream_emits_text_deltas` con `MockAnthropic` que devuelve tokens secuenciales.
- [x] **Step 2**: implementar `providers/base.py` con `BaseProvider`, `ProviderEvent` (dataclass union: TextDelta / ToolUse / MessageComplete / Error).
- [x] **Step 3**: implementar `providers/claude.py::ClaudeProvider` (AsyncAnthropic, `messages.create(stream=True)`, prompt cache en system + último tool, traduce raw events → `ProviderEvent`).
- [x] **Step 4**: pasa el test del Step 1.
- [x] **Step 5**: failing test `test_tool_use_emitted_when_model_calls_tool` con MockAnthropic.
- [x] **Step 6**: handling de `tool_use`: acumula `input_json_delta` por índice y emite `ToolUse(call_id, name, args)` al `content_block_stop`.
- [x] **Step 7**: pasa el test del Step 5.
- [x] **Step 8**: `providers/ollama.py::OllamaProvider.stream` con `raise NotImplementedError(...)`.

```bash
git commit -m "feat(asistente): provider interface + ClaudeProvider con prompt cache"
```

### Task 4: Tool registry + permissions

- [x] **Step 1**: failing test `test_tool_registry::test_list_for_user_filters_by_module_flags`.
- [x] **Step 2**: `tools/registry.py::ToolSpec` (dataclass) y `REGISTRY` global.
- [x] **Step 3**: `tools/permissions.py::get_user_module_flags(user)` reusa `apps.legacy.repositories.permissions_repo.list_user_modules`.
- [x] **Step 4**: `list_for_user(user)` con filtrado por `modules_required`.
- [x] **Step 5**: tests verdes (3 tests).
- [x] **Step 6**: tools base registradas: 5 memoria + 2 doc_types + 2 skills = 9.
- [x] **Step 7**: failing test `test_dispatch_rejects_forbidden_cia`.
- [x] **Step 8**: `agent_loop::dispatch_tool(user, name, args)` con las 4 capas (registry / no_cia / punto / USUARIOD).
- [x] **Step 9**: pasa el test del Step 7.

```bash
git commit -m "feat(asistente): tool registry + dispatch con gates de permisos"
```

### Task 5: Agent loop

- [x] **Step 1**: failing test `test_agent_loop::test_simple_text_response_no_tools` con MockProvider.
- [x] **Step 2**: `agent_loop.py::AgentLoop.run(conv_id, user_message, user)` async generator (history via `HistoryStore` DI; provider.stream; itera events; persist assistant message; segundo turno con tool_results).
- [x] **Step 3**: pasa el test del Step 1.
- [x] **Step 4**: failing test `test_agent_loop::test_tool_use_then_text`.
- [x] **Step 5**: pasa el test del Step 4.
- [x] **Step 6**: failing test `test_agent_loop::test_write_tool_pauses_for_confirm`.
- [x] **Step 7**: pause-on-write con `PendingStore.create` + `asyncio.Future` indexed por sig + `signal_confirm(sig, approved, by)` + timeout → USER_TIMEOUT.
- [x] **Step 8**: pasa el test del Step 6.
- [x] **Step 9**: failing test `test_agent_loop::test_max_turns_safety_cap`.
- [x] **Step 10**: caps `ASISTENTE_MAX_TURNS` y `ASISTENTE_DAILY_BUDGET_USD_PER_USER` aplicados al inicio de cada turno.

```bash
git commit -m "feat(asistente): agent loop con SSE + pause-on-write + caps"
```

### Task 6: Endpoints HTTP

- [x] **Step 1**: `views_conversaciones.ConversacionesView` (GET list + POST create) sobre `ABREGONZA.TCHAT_CONVERSACION`. Oracle 11g → `ROWNUM` envolvente.
- [x] **Step 2**: `views_conversaciones.ConversacionDetailView` (GET con mensajes inline + DELETE soft).
- [x] **Step 3**: `views_chat.ChatStreamView` (POST → `StreamingHttpResponse` SSE). Drena el async generator via `asyncio.new_event_loop()` para compatibilidad con WSGI/runserver; refactor a vista async pura queda pendiente.
- [x] **Step 4**: `views_chat.ConfirmView` (POST `/confirm/<sig>/`) marca la fila en TCHAT_TOOL_PENDING + `signal_confirm` despierta el future.
- [x] **Step 5**: `views_admin.ToolsView` (GET `/api/asistente/tools/`) filtra por `list_for_user`.
- [x] **Step 6**: smoke `_smoke_http.sh` OK — login JCABREU → POST conv → GET list devuelve la conv → GET tools lista las 9 base.
- [!] **Step 7**: tests de integración SSE end-to-end (`test_full_round_trip_with_mock_provider`): pendiente; el cliente de test de Django requiere ASGI test client + monkeypatch del provider. Diferido al próximo run.

```bash
git commit -m "feat(asistente): endpoints REST + SSE para conversaciones y chat"
```

### Task 7: Auditoría TCHAT_TOOL_LOG

- [ ] **Step 1**: hook en `dispatch_tool` para INSERT en `TCHAT_TOOL_LOG` con args_hash + preview + duration_ms + ok/error + was_write + confirmed_by.
- [ ] **Step 2**: `views_admin.AuditoriaView` (GET `/api/admin/asistente/auditoria/`) — agregados por usuario/tool/día.
- [ ] **Step 3**: gate sólo DBA.
- [ ] **Step 4**: cron job (1 min) que marca `TCHAT_TOOL_PENDING` expirados.

```bash
git commit -m "feat(asistente): auditoría TCHAT_TOOL_LOG + endpoint admin"
```

### Task 8: Deploy PR1 al VM

- [ ] **Step 1**: `pscp -r backend/apps/asistente jcabreu@10.0.0.99:/home/jcabreu/facturation-system/backend/apps/`
- [ ] **Step 2**: `pscp backend/facturation_api/{settings.py,urls.py}` al VM.
- [ ] **Step 3**: `pscp backend/requirements.txt` al VM.
- [ ] **Step 4**: en VM ejecutar `pip install` dentro del container (o rebuild si requirements cambió). `docker compose up -d backend`.
- [ ] **Step 5**: smoke: `docker compose exec backend pytest apps/asistente/tests/ -q` → all green.
- [ ] **Step 6**: smoke HTTP: login + POST conversación + POST chat con MockProvider activado por flag de entorno → SSE responde.
- [ ] **Step 7**: push `asistente/foundations` a origin → merge a main → Netlify.
- [ ] **Step 8**: marcar header del PR1 con ✅.

---

## PR 2 — Tools por módulo ✅ tras Task 8 del PR1

### Task 9: Tools FAT

- [ ] **Step 1**: `tools/fat.py` con handlers read (buscar_cliente, proximo_ncf, buscar_producto, listar_facturas, cuadre_caja). Cada uno wrappea `apps.legacy.repositories.fat_repo.*` o `apps.fat.*`.
- [ ] **Step 2**: register en REGISTRY con `modules_required=['FAT']`.
- [ ] **Step 3**: failing test por handler. Pasarlos.
- [ ] **Step 4**: handlers write (crear_factura, crear_cotizacion, cerrar_caja). Cada uno valida `has_doc_permission` antes de llamar al repo.
- [ ] **Step 5**: tests con DB real (factura test ZZTEST que se borra después).
- [ ] **Step 6**: smoke vía curl SSE con MockProvider que llama `fat_buscar_cliente`.

```bash
git commit -m "feat(asistente): tools FAT (read + write)"
```

### Task 10: Tools CHC

- [ ] **Step 1**: `tools/chc.py` con read (listar_cheques, listar_cuentas, rep_disponibilidad, rep_movimientos) wrappeando `chc_repo`.
- [ ] **Step 2**: write (conciliar_bulk, cierre_conciliacion).
- [ ] **Step 3**: tests + smoke.

```bash
git commit -m "feat(asistente): tools CHC (read + write)"
```

### Task 11: Tools CXC + CXP

- [ ] **Step 1**: `tools/cxc.py`: buscar_cliente, estado_cuenta, aging, listar_documentos.
- [ ] **Step 2**: `tools/cxp.py`: buscar_proveedor, estado_cuenta, aging.
- [ ] **Step 3**: tests + smoke.

```bash
git commit -m "feat(asistente): tools CXC y CXP (read)"
```

### Task 12: Tools CNT + INV

- [ ] **Step 1**: `tools/cnt.py`: listar_companias (read), crear_compania, crear_punto (write).
- [ ] **Step 2**: `tools/inv.py`: buscar_producto (con existencia y precios), listar_movimientos.
- [ ] **Step 3**: tests + smoke.

```bash
git commit -m "feat(asistente): tools CNT y INV"
```

### Task 13: Deploy PR2

- [ ] **Step 1**: pscp `apps/asistente/tools/*.py` al VM.
- [ ] **Step 2**: pytest in-VM, all green.
- [ ] **Step 3**: smoke con curl SSE: el agente puede hacer una conversación que use 2+ tools (ej. "lista mis facturas pendientes y dime el RNC del primer cliente").
- [ ] **Step 4**: push a main, marcar PR2 ✅.

---

## PR 3 — Skills Fase 1 ✅ tras Task 13

### Task 14: Sistema de skills

- [ ] **Step 1**: `tools/skills.py::read_skill_file(name)` con parse de frontmatter YAML.
- [ ] **Step 2**: `tools/skills.py::skills_listar(user)` filtra por `modules_required`.
- [ ] **Step 3**: `tools/skills.py::skill_cargar(user, args)` con gate + warning si tools_used faltan.
- [ ] **Step 4**: register `skill_listar` y `skill_cargar` en REGISTRY.
- [ ] **Step 5**: tests.
- [ ] **Step 6**: endpoint `GET/PUT/POST/DELETE /api/asistente/skills/...` con gate DBA en mutaciones.

```bash
git commit -m "feat(asistente): sistema de skills (read + CRUD admin)"
```

### Task 15: Skill `facturar`

- [ ] **Step 1**: `apps/asistente/skills/facturar/SKILL.md` con frontmatter completo + cuerpo paso-a-paso (ver spec § Skills).
- [ ] **Step 2**: examples/factura-credito.json + factura-contado.json con args válidos de ejemplo.
- [ ] **Step 3**: test que un agent_loop con MockProvider que llama `skill_cargar('facturar')` recibe el cuerpo correcto y la conversación queda con `SKILL_ACTIVA='facturar'`.

### Task 16: Skill `cotizar`

- [ ] **Step 1**: SKILL.md.
- [ ] **Step 2**: test.

### Task 17: Skill `cerrar-caja`

- [ ] **Step 1**: SKILL.md.
- [ ] **Step 2**: test.

### Task 18: Skill `conciliar-banco`

- [ ] **Step 1**: SKILL.md.
- [ ] **Step 2**: test.

### Task 19: Skill `consultar-cuenta-cliente`

- [ ] **Step 1**: SKILL.md.
- [ ] **Step 2**: test.

### Task 20: Skill `nueva-empresa-onboarding`

- [ ] **Step 1**: SKILL.md.
- [ ] **Step 2**: test.

### Task 21: Deploy PR3

- [ ] **Step 1**: pscp `apps/asistente/skills/` recursivo al VM.
- [ ] **Step 2**: smoke: `curl GET /api/asistente/skills/` lista las 6.
- [ ] **Step 3**: smoke SSE: el agente carga `skill_cargar('facturar')` y la siguiente respuesta sigue el playbook.
- [ ] **Step 4**: push main, marcar PR3 ✅.

---

## PR 4 — Frontend ✅ tras Task 21

### Task 22: Botón flotante

- [ ] **Step 1**: `frontend/src/features/asistente/floating-button.tsx`.
- [ ] **Step 2**: montar en `routes/_authenticated.tsx` (layout root authenticated).
- [ ] **Step 3**: estados (idle / busy / pending-confirm) — el badge `pending-confirm` se hidrata via polling cada 30s a `GET /api/asistente/conversaciones/?has_pending=1`.
- [ ] **Step 4**: tooltip + atajo Ctrl+K.
- [ ] **Step 5**: ocultar en `/asistente`, `/print/*`, `/login`.

### Task 23: Página /asistente layout

- [ ] **Step 1**: `routes/_authenticated/asistente.tsx` (layout 3 columnas).
- [ ] **Step 2**: `routes/_authenticated/asistente/index.tsx` redirige a `?conv_id=new` o última activa.
- [ ] **Step 3**: `features/asistente/asistente-page.tsx` orquestador (sidebar + chat + tool-log).
- [ ] **Step 4**: `features/asistente/sidebar.tsx` con búsqueda + agrupación por fecha + nueva conv + selector modelo.

### Task 24: Chat principal

- [ ] **Step 1**: `features/asistente/chat.tsx` con lista de mensajes + composer.
- [ ] **Step 2**: hook `useChatStream(convId)` que abre `EventSource('/api/asistente/conversaciones/<id>/chat/')` y consume eventos.
- [ ] **Step 3**: estado en `useReducer` que acumula mensajes y tokens.
- [ ] **Step 4**: composer con auto-resize, Enter/Shift+Enter, botón send con loader inline.
- [ ] **Step 5**: render markdown en mensajes con `react-markdown` + tabla/code highlighting.

### Task 25: Tool log

- [ ] **Step 1**: `features/asistente/tool-log.tsx` panel derecho colapsable.
- [ ] **Step 2**: filas con icono (ok/pending/error), nombre, duración, expand para ver args/result JSON.
- [ ] **Step 3**: para filas `pending`: botones inline `[Confirmar] [Cancelar]` que disparan `POST /api/asistente/confirm/<sig>/`.
- [ ] **Step 4**: footer "Auditoría" con tokens + costo acumulado.

### Task 26: Modal de confirmación detallada

- [ ] **Step 1**: `features/asistente/tool-confirm-modal.tsx` que se abre al hacer click en "Ver detalle" de una fila pending.
- [ ] **Step 2**: muestra args JSON formateado + preview en lenguaje natural + warning visual amarillo.
- [ ] **Step 3**: botones `[Confirmar y ejecutar]` `[Cancelar]`.

### Task 27: Skill picker + chip activo

- [ ] **Step 1**: chip "Skill: X" en header del chat → click abre dropdown con skills disponibles para el usuario.
- [ ] **Step 2**: al seleccionar, POST `/api/asistente/conversaciones/<id>/skill/` con `{skill: 'facturar'}` (activación manual) — el backend hace el equivalente de `skill_cargar` server-side.
- [ ] **Step 3**: auto-sugerencia: regex local sobre el último mensaje del usuario → si matchea triggers, mostrar banner sutil "💡 ¿Activo modo facturar?".

### Task 28: Atajos globales

- [ ] **Step 1**: hook `useGlobalShortcuts` con Ctrl+K (toggle /asistente), Esc (cancel stream), Ctrl+/ (focus search), Ctrl+N (nueva conv).

### Task 29: Página de admin skills

- [ ] **Step 1**: `routes/_authenticated/asistente/skills/index.tsx` lista skills.
- [ ] **Step 2**: `routes/_authenticated/asistente/skills/$name.edit.tsx` con Monaco editor split markdown/preview.
- [ ] **Step 3**: gate sólo DBA.

### Task 30: Página de admin auditoría

- [ ] **Step 1**: `routes/_authenticated/admin/asistente/usage.tsx` con KPIs (calls, costo, top tools, top users).
- [ ] **Step 2**: filtros por fecha + tabla detallada paginada.

### Task 31: Deploy PR4

- [ ] **Step 1**: push a `main` → Netlify build.
- [ ] **Step 2**: verificar netlify-status del commit.
- [ ] **Step 3**: smoke E2E con Playwright (si disponible): login → click botón flotante → /asistente abre → escribir "lista mis facturas de hoy" → el bot responde con tool_call visible en el log → no console errors.
- [ ] **Step 4**: marcar PR4 ✅.

---

## Self-review checklist (corre al terminar de leer este plan antes de ejecutar)

- [ ] El DDL Oracle del Step 2 del Task 2 se ejecutó manualmente en sqlplus y las 4 tablas existen.
- [ ] `apps/asistente` está en `INSTALLED_APPS`, `path('api/', include(...))` registrado.
- [ ] `ANTHROPIC_API_KEY` está definida en `.env` del VM (no committeada al repo).
- [ ] El agente responde texto con MockProvider sin tocar Anthropic.
- [ ] El agente respeta `FORBIDDEN_CIA` cuando el usuario pide datos de empresas que no tiene.
- [ ] Un write requiere clic en confirmar — no se ejecuta sin él.
- [ ] Una skill que requiere módulo FAT no se activa para un usuario sin FAT.
- [ ] `/admin/asistente/auditoria` muestra al menos 1 llamada después del smoke.
- [ ] El botón flotante se oculta en `/print/*`.
- [ ] El composer envía con Enter y rompe línea con Shift+Enter.

## Notas para futuras iteraciones

- Cuando haya host con compute, activar `OllamaProvider` (sólo descomentar imports + setear env vars).
- Tools adicionales por módulo restante: SDN, ACF, ODC, ACC, MAN.
- Skills adicionales: anular factura, devolución, ajuste contable, cierre mensual CNT, conciliación tarjetas.
- Voz a texto en el composer.
- Macros: botón "Hacer con AI" en pantallas concretas que dispare una skill pre-seleccionada.
