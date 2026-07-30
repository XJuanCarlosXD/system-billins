# Botón "Resolver todo con Agente" en Reportes de Problemas — diseño

**Fecha:** 2026-07-30
**Autores:** JCABREU + Claude
**Estado:** Diseño aprobado, listo para plan de implementación
**Precede a:** este es el "Módulo 2" que
`2026-07-22-reportes-soporte-design.md` dejó explícitamente fuera de alcance
("la automatización que lee reportes ABIERTO, intenta arreglarlos y los
prueba con Claude Code es un proyecto separado").

## Objetivo

Dar al admin de la tabla "Reportes de Problemas" (Configuración → Reportes)
un botón único que dispare, en el momento, una corrida de Claude Code que:

1. Lee todos los reportes en estado `ABIERTO`.
2. Diagnostica y corrige cada uno (código y/o datos, según aplique).
3. Corre la suite de tests existente antes de tocar producción.
4. Si los tests pasan: hace commit + push a `main` (Netlify despliega el
   frontend) y sube los archivos backend cambiados a la VM 10.0.0.99 vía
   `pscp` (el backend recarga solo — `uvicorn --reload`, no hace falta
   reiniciar contenedor).
5. Marca cada reporte resuelto (`COMPLETADO`, con `nota_resolucion`) o, si no
   pudo resolverlo, lo dejo `ABIERTO` con una nota explicando por qué.
6. Si los tests fallan, **no despliega nada** — dejo un registro de "run"
   marcado `ERROR` con el motivo, y ningún reporte cambia de estado.

Decisión explícita del usuario: el despliegue es inmediato, sin aprobación
humana intermedia (no PR + espera). El único gate de seguridad es que la
suite de tests debe pasar antes de tocar `main` o la VM.

## Por qué esta arquitectura (resumen de lo decidido en brainstorming)

- El backend Django corre en Docker en la VM 10.0.0.99, que **no** tiene el
  repo clonado, Claude Code ni credenciales de deploy — no puede ejecutar el
  agente él mismo.
- La única máquina con todo eso (repo, `claude` CLI, `pscp`/`plink`,
  credenciales git) es la PC de JCABREU — la misma donde ya corre el runner
  `run-lic-plan-20260724.cmd` (prompt vía stdin a
  `claude --dangerously-skip-permissions -p --output-format text`).
- Como el backend no puede empujar al PC sin exponer un puerto a internet, se
  usa **polling**: un script en el PC pregunta cada 30-60s si hay una
  solicitud pendiente. Con ese intervalo, el botón surte efecto en
  segundos-a-un-minuto — lo más cercano a "instantáneo" sin abrir el PC al
  exterior.

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────────┐
│ Browser (React) — Configuración → Reportes (admin)                  │
│  [ Resolver todo con Agente ]  ← deshabilitado si hay run EN_PROCESO │
│  Última corrida: COMPLETADO 2026-07-30 14:32 — 3 resueltos, 1 error  │
└───────────────┬─────────────────────────────────────┬───────────────┘
                │ POST /api/reportes/agente/lanzar/    │ GET (poll 5s)
                │ (IsAuthenticated + is_dba)            │ /api/reportes/agente/estado/
                ▼                                       │
┌─────────────────────────────────────────────────────────────────────┐
│ Django — apps/reportes                                               │
│  TREP_AGENTE_RUN: id, estado, solicitado_por, fecha_solicitud,       │
│                   fecha_fin, resumen (CLOB), commit_sha              │
└───────────────┬───────────────────────────────────────▲─────────────┘
                │ GET /api/reportes/agente/pendiente/    │ POST /resultado/
                │ (Bearer AGENTE_REPORTES_TOKEN)         │ (Bearer token)
                ▼                                        │
┌─────────────────────────────────────────────────────────────────────┐
│ PC JCABREU — watcher-agente-reportes.cmd (loop, poll 45s)            │
│  1. Si hay PENDIENTE → lo reclama (PATCH a EN_PROCESO)               │
│  2. Arma prompt (incluye lista ABIERTO + token + instrucciones)      │
│  3. type prompt.txt | claude --dangerously-skip-permissions -p       │
│       --output-format text > run.log 2>&1                           │
│  4. La sesión de Claude, dentro de su propio flujo:                 │
│     - lee cada reporte vía GET /api/reportes/<id>/                   │
│     - corrige código/datos                                          │
│     - corre tests (pytest backend, vitest frontend si aplica)        │
│     - si pasan: git commit+push a main; pscp de archivos backend     │
│       cambiados a 10.0.0.99                                          │
│     - POST /api/reportes/agente/resultado/ con resumen + commit_sha  │
│     - PATCH /api/reportes/<id>/ por cada reporte resuelto            │
└─────────────────────────────────────────────────────────────────────┘
```

## Modelo de datos

Nueva tabla `ABREGONZA.TREP_AGENTE_RUN` (migración
`backend/apps/reportes/sql/002_create_trep_agente_run.sql`, mismo patrón que
`001_create_trep.sql`: `GRANT` + sinónimo a `JCABREU`):

| Columna | Tipo | Notas |
|---|---|---|
| RUN_ID | VARCHAR2(36) PK | uuid |
| ESTADO | VARCHAR2(20) | `PENDIENTE`/`EN_PROCESO`/`COMPLETADO`/`ERROR` |
| SOLICITADO_POR | VARCHAR2(50) | usuario que hizo click |
| FECHA_SOLICITUD | DATE | SYSDATE al crear |
| FECHA_FIN | DATE | NULL hasta terminar |
| RESUMEN | CLOB | texto libre que deja el agente (qué resolvió, qué falló, por qué) |
| COMMIT_SHA | VARCHAR2(40) | NULL si no hubo push |

Solo puede existir **un run activo** (`PENDIENTE` o `EN_PROCESO`) a la vez —
`lanzar/` rechaza con 409 si ya hay uno.

## Backend — endpoints nuevos en `apps/reportes`

Todos bajo `/api/reportes/agente/`:

- `POST lanzar/` — `IsAuthenticated` + `is_dba` (mismo helper `_is_admin` que
  ya usa `views.py`). Crea run `PENDIENTE`. 409 si ya hay uno activo.
- `GET estado/` — `IsAuthenticated` (cualquier usuario logueado puede ver el
  estado, solo admin ve el botón). Devuelve el último run (o `null`).
- `GET pendiente/` — auth por **Bearer token estático**, no sesión de
  usuario: header `Authorization: Bearer <AGENTE_REPORTES_TOKEN>` contra
  `settings.AGENTE_REPORTES_TOKEN` (nuevo env var, mismo patrón que
  `ANTHROPIC_API_KEY` en `settings.py:153`). Si hay un run `PENDIENTE`, lo
  marca `EN_PROCESO` atómicamente (evita doble-reclamo) y devuelve la lista
  de reportes `ABIERTO` (id, módulo, título, descripción). Si no hay
  pendiente, devuelve `{"pendiente": false}`.
- `POST resultado/` — mismo Bearer token. Body: `{run_id, estado, resumen,
  commit_sha}`. Actualiza el run a `COMPLETADO` o `ERROR`.

No se reutiliza el esquema de `TMCP_TOKEN` (tokens hasheados en BD,
pensado para múltiples clientes MCP) porque aquí hay un solo consumidor fijo
(el watcher de esta PC) — un token estático en `.env` de la VM es
proporcional y sigue el mismo espíritu que las demás credenciales ya
hardcodeadas en los scripts de deploy (`sigaft-deploy-vm`).

## Frontend

- `frontend/src/lib/api-client-reportes.ts`: agregar `lanzarAgente()`,
  `getEstadoAgente()`.
- `frontend/src/features/reportes/reportes-admin-table.tsx`: botón arriba de
  la tabla, visible solo si `is_dba` (ya se sabe por el mismo mecanismo que
  gatea la pestaña admin). `useQuery` con `refetchInterval: 5000` sobre
  `estado/` mientras haya un run no terminal; botón `disabled` y con spinner
  mientras `PENDIENTE`/`EN_PROCESO`; al completar, toast con el resumen y
  invalida `['reportes', 'admin']` para refrescar la tabla.

## El script watcher (PC de JCABREU)

Nuevo archivo `backend/docs/superpowers/agente-reportes/` (junto al spec,
como los runners de `lic-plan`):

- `watcher-agente-reportes.cmd`: loop `for /l` o `goto`, cada 45s hace `curl`
  a `pendiente/`; si `pendiente: true`, genera
  `prompt-<run_id>.txt` con: la lista de reportes ABIERTO, instrucciones de
  diagnóstico/fix, la regla de "correr tests antes de push", el `run_id`, el
  token, y las URLs de los endpoints; lo pipea a `claude.cmd
  --dangerously-skip-permissions -p --output-format text` (mismo patrón que
  `run-lic-plan-20260724.cmd`), log a `run-<run_id>.log`.
- `README.md` corto: cómo registrar el `.cmd` en el Programador de Tareas de
  Windows para que corra en loop / se reinicie si muere.

**Activación real de la tarea programada (que la PC quede escuchando de
forma continua con credenciales de deploy) es un paso manual que el usuario
activa cuando quiera — este PR entrega el código y el script, no lo deja
corriendo solo.**

## Manejo de errores

- Test fails → run `ERROR`, `resumen` explica qué test falló, ningún reporte
  cambia de estado, nada se pushea.
- El watcher no puede alcanzar Django (VM caída) → reintenta en el próximo
  poll, no hay estado intermedio corrupto porque `pendiente/` solo se marca
  `EN_PROCESO` cuando el watcher efectivamente la recibe.
- Un reporte que el agente no puede resolver (fuera de su alcance, ambiguo)
  → se queda `ABIERTO` con nota explicando por qué no se tocó; no bloquea a
  los demás.

## Testing

- Backend: tests unitarios de los 4 endpoints nuevos (permisos, transición
  de estados, 409 en doble-lanzar) siguiendo el estilo de tests existente en
  `apps/reportes` (si existen) o `apps/mcp` (para el patrón de Bearer auth).
- Frontend: smoke manual del botón (estados disabled/enabled, polling,
  toast) — no hay suite de componentes en este proyecto para reportes hoy.
- El watcher/loop en sí **no** se prueba automatizado (es un script local);
  se documenta cómo probarlo manualmente con un run de prueba.
