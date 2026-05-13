# Plan definitivo Regal General — versión validada

Reemplaza el orden ejecutivo anterior. Decisiones de alcance: ver `06_resumen_propuesta.md`, `07_requerimientos_extra.md`, y memoria `project/scope-decisions`.

## Decisiones cerradas

| Tema | Decisión |
|---|---|
| Fuentes | FMB y RDF originales **disponibles** → clon 1:1 viable |
| Fidelidad funcional | **Paridad total** (mismos cálculos, asientos, reportes, validaciones) |
| Fidelidad UI | **Nueva** con shadcn-admin; permiso para simplificar pasos |
| Fiscal | **NCF tradicional**; e-CF fuera de alcance |
| Asientos contables | **Automáticos** desde Fat/Cxc/Cxp/Sdn/Inv/Chc → Cnt, idénticos al viejo |
| Formatos DGII y bancos | **Byte-exact** (`diff` como prueba) |
| Driver Oracle | python-oracledb thick (Instant Client 19); nunca Django ORM contra Oracle |
| Auth | Backend custom contra usuarios del legado + JIT provisioning |
| Permisos | RBAC módulo × documento × acción, paridad con Regal General |

---

## QA framework — política global (CRÍTICO leer antes de seguir)

### Reglas duras

1. **Cualquier QA que escriba debe estar etiquetado.** Toda fila creada por QA lleva un campo o prefijo único: `QA_RUN_ID = "QA_<uuid4>"`. Sin ese marcador, el cleanup **NO** la toca.
2. **El cleanup borra SOLO filas con ese marcador exacto.** Nunca `DELETE FROM tabla;`. Siempre `DELETE FROM tabla WHERE qa_marker = :run_id` con marcador no vacío y de longitud mínima.
3. **QA jamás corre contra el Oracle legado de producción.** Solo contra **staging** (snapshot del Oracle real, ver Fase 0 punto 5) o contra SQLite de la app nueva.
4. **Si la base de datos objetivo no es staging o sqlite, el QA aborta**. Validación por nombre de DSN/path antes de cualquier escritura.
5. **Cada test maneja su propia transacción.** Cuando sea posible, todo dentro de un `BEGIN; ... ROLLBACK;` para que ni siquiera persista. El marcador y el delete explícito son la red de seguridad por si la transacción no es viable (ej. tests E2E con commits).
6. **Nunca `TRUNCATE`, nunca `DROP`.** Solo `DELETE` con `WHERE` específico.
7. **Auditoría:** todo QA loguea en `backend/data/qa_runs.log` qué creó y qué borró, con `run_id`, tabla, count.

### Variables de entorno (`backend/.env`)

```
QA_MODE=true                      # habilita endpoints y comandos de QA. Default: false en prod.
QA_ALLOW_TARGETS=sqlite,staging   # CSV. Si la DB no está aquí, QA aborta. Nunca incluir 'production'.
QA_MARKER_PREFIX=QA_              # prefijo obligatorio del run_id.
QA_AUTO_CLEANUP=true              # borra al final del test.
ORACLE_DSN_STAGING=10.0.0.51:1521/ABSTAGE  # DSN del Oracle staging (clon).
```

### Capa de código

| Ruta | Propósito |
|---|---|
| `backend/apps/qa/__init__.py` | módulo |
| `backend/apps/qa/markers.py` | genera `QA_RUN_ID`, valida prefijo y longitud mínima (≥8 chars tras el prefijo) |
| `backend/apps/qa/safety.py` | `assert_target_allowed(db_alias_or_dsn)`, aborta si no está en `QA_ALLOW_TARGETS` |
| `backend/apps/qa/cleanup.py` | `delete_marked(table, marker, conn)` con todos los candados |
| `backend/apps/qa/runner.py` | context manager `qa_run()` que crea marker, ejecuta test, hace cleanup, loguea |
| `backend/apps/qa/tests/` | un archivo por fase: `test_phase1_auth.py`, `test_phase1_permissions.py`, etc. |
| `backend/data/qa_runs.log` | bitácora append-only de cada corrida |

### Cómo se ve un test (patrón canónico)

```python
# backend/apps/qa/tests/test_phase1_auth.py
from apps.qa.runner import qa_run
from apps.legacy import client

def test_can_find_legacy_user():
    with qa_run(target='staging') as run:
        # 1. crear fila tagueada
        with client.cursor() as cur:
            cur.execute(
                "INSERT INTO seg_usuarios (usuario, nombre, activo, qa_marker) "
                "VALUES (:1, :2, 'S', :3)",
                [f'qauser_{run.id}', 'QA Test User', run.id]
            )
            cur.connection.commit()

        # 2. validar que el repo lee correctamente
        from apps.legacy.repositories import users_repo
        u = users_repo.find_by_username(f'qauser_{run.id}')
        assert u is not None
        assert u.activo is True

        # 3. cleanup automático al salir del with: borra solo donde qa_marker = run.id
```

### El cleanup (extracto de `cleanup.py`)

```python
def delete_marked(table: str, marker: str, conn):
    if not marker or not marker.startswith(settings.QA_MARKER_PREFIX):
        raise RuntimeError('refusing cleanup: invalid marker')
    if len(marker) < len(settings.QA_MARKER_PREFIX) + 8:
        raise RuntimeError('refusing cleanup: marker too short')
    with conn.cursor() as cur:
        cur.execute(f'DELETE FROM {table} WHERE qa_marker = :1', [marker])
        n = cur.rowcount
        conn.commit()
        log_cleanup(table, marker, n)
        return n
```

### Tabla auxiliar para tablas legadas que NO tienen `qa_marker`

Si una tabla del Oracle legado no tiene columna donde tagear, **no se inserta directamente**. Se usa el patrón:
- Crear copia/extensión de la tabla en un esquema `QA_SHADOW` del staging.
- Probar contra esa copia.
- Nunca tocar la tabla original ni siquiera en staging.

---

## Fase 0 — Decisiones bloqueantes (~3 días)

Solo lo que aún no está cerrado:

| # | Decisión | Salida en |
|---|---|---|
| 0.1 | Multi-empresa en Regal General (¿BD soporta varias?) | sección en `09_decisiones_fase0.md` |
| 0.2 | Migración Oracle 11g → 19c al cierre, o quedarse en 11g | misma |
| 0.3 | Concurrencia: bloqueo optimista con columna `version` | misma |
| 0.4 | Corrida paralela: cuántas semanas | misma |
| 0.5 | Staging del Oracle: snapshot Hyper-V vs RMAN duplicate | misma + `infra/staging.md` |
| 0.6 | Impresión: matricial preservada vs PDF + red | misma |

**QA Fase 0:** ninguno (son decisiones, no código). Cierre de fase = documento `09_decisiones_fase0.md` firmado por el cliente.

---

## Fase 1 — Descubrimiento e inventario (1–2 sem)

Las dos primeras tareas bloquean todo lo demás.

| # | Tarea | Entregable (rutas exactas) |
|---|---|---|
| 1.A | **Auth legado:** identificar tabla de usuarios, mecanismo de password, perfiles | `memorias_sigaft/10_auth_legacy.md` + `facturation-system/backend/apps/legacy/repositories/users_repo.py` con SQL real |
| 1.B | **Permisos legado:** matriz módulo × documento × acción del control de acceso de Regal General | `memorias_sigaft/11_permisos_legacy.md` + dump CSV en `memorias_sigaft/legacy_dumps/permisos.csv` |
| 1.C | **PL/SQL servidor:** packages, procedures, functions, triggers, jobs | `memorias_sigaft/legacy_dumps/plsql/{packages,procedures,functions,triggers,jobs}/*.sql` |
| 1.D | **Inventario módulo Sdn (nómina)** | `memorias_sigaft/12_inventario_sdn.md` + `legacy_dumps/sdn/{tables.csv,fmbs.csv,rdfs.csv}` |
| 1.E | **Inventario módulo Fat (facturación + NCF + DGII)** + asientos contables generados | `memorias_sigaft/13_inventario_fat.md` + `legacy_dumps/fat/...` |
| 1.F | **Integraciones externas:** AFP, ARS, archivos bancarios, retenciones | `memorias_sigaft/14_integraciones_externas.md` + `legacy_dumps/integraciones/{ejemplo_afp.txt,ejemplo_ach.txt,...}` |
| 1.G | **Impresión:** plantillas, posiciones, formatos pre-impresos, cheques MICR | `memorias_sigaft/15_impresion.md` + `legacy_dumps/impresion/*.png` (capturas) |
| 1.H | **Inventario ligero del resto:** Cnt, Cxc, Cxp, Inv, Chc, Odc, Acc, Acf, Man | `memorias_sigaft/16_inventario_resto.md` |

### QA Fase 1 (rutas)

Cada test usa el patrón `qa_run` y borra al salir.

| Test | Ruta | Qué valida |
|---|---|---|
| `test_phase1_auth.py` | `backend/apps/qa/tests/test_phase1_auth.py` | Inserta usuario QA en staging, lo busca con `users_repo.find_by_username`, valida que retorna DTO correcto, borra |
| `test_phase1_permissions.py` | `backend/apps/qa/tests/test_phase1_permissions.py` | Inserta entrada de permiso QA, lee con `permisos_repo`, borra |
| `test_phase1_plsql_dump.py` | `backend/apps/qa/tests/test_phase1_plsql_dump.py` | Verifica que `legacy_dumps/plsql/` no esté vacío, count packages > 0 |
| `test_phase1_inventarios.py` | `backend/apps/qa/tests/test_phase1_inventarios.py` | Verifica existencia de los `.md` y `.csv` esperados |

**Cierre de fase:** todos los tests verdes + revisión humana de los `.md`.

---

## Fase 2 — Reverse engineering funcional (2–4 sem)

Por cada FMB del módulo en curso (orden Sdn → Cnt → Cxc → Cxp → Fat → Inv → Chc → Odc → Acc → Acf → Man):

1. Extraer triggers (`WHEN-VALIDATE-ITEM`, `WHEN-BUTTON-PRESSED`, `KEY-COMMIT`).
2. Mapear bloques, ítems, LOVs, record groups.
3. Documentar SQL embebido y validaciones.
4. Identificar packages PL/SQL invocados.
5. Identificar reportes que dispara.
6. **Asientos contables que genera** (clave para Fat/Cxc/Cxp/Sdn/Inv/Chc).

**Entregable por módulo (rutas):**
- `memorias_sigaft/reverse/{modulo}/{form_name}.md` — un archivo por FMB con todo lo anterior.
- `memorias_sigaft/reverse/{modulo}/asientos.md` — mapa de asientos contables del módulo.

### QA Fase 2 (rutas)

| Test | Ruta | Qué valida |
|---|---|---|
| `test_phase2_coverage.py` | `backend/apps/qa/tests/test_phase2_coverage.py` | Por cada FMB esperado del módulo, existe su `.md` con secciones requeridas (triggers, sql, asientos) |
| `test_phase2_asientos_schema.py` | `backend/apps/qa/tests/test_phase2_asientos_schema.py` | Cada asiento documentado tiene cuenta debe + cuenta haber + signo + condición |

---

## Fase 3 — Modelo objetivo (2–3 sem)

Habilitadores transversales, en este orden:

| # | Componente | Ruta |
|---|---|---|
| 3.1 | `LegacyOracleAuthBackend` + `LegacyUserMap` + JIT provisioning | `backend/apps/auth_legacy/` (`backend.py`, `models.py`, `views.py`, `urls.py`) |
| 3.2 | Motor RBAC módulo × documento × acción | `backend/apps/permissions/` (`models.py`, `services.py`, `decorators.py`, `views.py`) + UI matriz en `frontend/src/features/permissions/` |
| 3.3 | Servicio de **asientos contables** | `backend/apps/contabilidad/posting.py` + catálogo en `backend/apps/contabilidad/models.py` |
| 3.4 | Servicio de **consecutivos** (NCF, cheques, recibos) | `backend/apps/consecutivos/service.py` |
| 3.5 | Servicio de **impresión** PDF con templates | `backend/apps/impresion/{service.py,templates/}` |
| 3.6 | Auditoría transversal | `backend/apps/audit/` |

### QA Fase 3 (rutas)

| Test | Ruta | Qué valida |
|---|---|---|
| `test_phase3_auth_login.py` | `backend/apps/qa/tests/test_phase3_auth_login.py` | Crea usuario QA en staging, hace login con HTTP POST a `/api/auth/login/`, valida sesión, JIT crea `LegacyUserMap`, logout, borra usuario QA + el LegacyUserMap creado |
| `test_phase3_rbac.py` | `backend/apps/qa/tests/test_phase3_rbac.py` | Crea rol QA, asigna permiso QA, evalúa decorador, borra rol y permiso |
| `test_phase3_asientos_balance.py` | `backend/apps/qa/tests/test_phase3_asientos_balance.py` | Genera asiento ficticio, valida que debe = haber, borra |
| `test_phase3_consecutivos.py` | `backend/apps/qa/tests/test_phase3_consecutivos.py` | Reserva NCF QA, libera, valida que el contador NO avanzó en la secuencia real (usa secuencia QA aparte) |
| `test_phase3_impresion.py` | `backend/apps/qa/tests/test_phase3_impresion.py` | Renderiza PDF con datos QA, compara con golden PDF, no escribe en disco persistente |

---

## Fase 4 — MVP core por módulo (6–10 sem)

Por cada módulo, en el orden ya definido (Sdn → Cnt → Cxc → Cxp → Fat → Inv → Chc → Odc → Acc → Acf → Man):

**Estructura por módulo (rutas):**

```
backend/apps/{modulo}/
  ├── models.py            # SQLite local (preferencias, mappings, no datos legados)
  ├── repositories.py      # lecturas/escrituras al Oracle legado vía apps.legacy.client
  ├── services.py          # reglas de negocio (orquestan repo + posting + consecutivos)
  ├── serializers.py       # DRF
  ├── views.py             # DRF ViewSets
  ├── urls.py              # rutas API: /api/{modulo}/...
  └── tests.py             # unit tests con qa_run

frontend/src/features/{modulo}/
  ├── routes.tsx           # TanStack Router
  ├── api.ts               # cliente API tipado
  ├── pages/               # pantallas con shadcn-admin
  └── components/          # componentes específicos
```

### QA Fase 4 por módulo (rutas)

Por cada módulo:

| Test | Ruta | Qué valida |
|---|---|---|
| `test_{modulo}_crud.py` | `backend/apps/qa/tests/modules/test_{modulo}_crud.py` | Crea documento QA (factura, recibo, etc.), lee, edita, anula, borra |
| `test_{modulo}_asientos.py` | `backend/apps/qa/tests/modules/test_{modulo}_asientos.py` | El documento QA generó asientos idénticos al golden dataset; tras anular, asientos contrarios; borra todo |
| `test_{modulo}_reports.py` | `backend/apps/qa/tests/modules/test_{modulo}_reports.py` | Reporte generado coincide byte-exact con el del legado para el mismo input |
| `test_{modulo}_e2e_ui.py` | `frontend/tests/e2e/{modulo}.spec.ts` (Playwright) | Login + flujo completo en navegador; al final llama endpoint de cleanup que borra el run |

**Criterio de aceptación duro por módulo:**
- Tests verdes.
- Asientos contables idénticos al viejo en golden dataset (ver Fase 4.5).
- Reportes byte-exact.
- Revisión humana de UX (especialmente donde simplificamos pasos del viejo).

---

## Fase 4.5 — Estrategia de paridad (1 sem, en paralelo a Fase 4)

| # | Pieza | Ruta |
|---|---|---|
| 4.5.1 | Golden datasets por módulo | `qa_data/golden/{modulo}/{caso}.json` con input + output esperado |
| 4.5.2 | Reporte de conciliación diaria | `backend/apps/qa/reconciliation/runner.py` + cron en staging |
| 4.5.3 | Criterios de cierre por módulo | `qa_data/acceptance/{modulo}.md` |

### QA Fase 4.5

| Test | Ruta | Qué valida |
|---|---|---|
| `test_phase45_reconciliation.py` | `backend/apps/qa/tests/test_phase45_reconciliation.py` | Inyecta diferencia ficticia QA en staging, runner detecta y reporta, borra |

---

## Fase 5 — Reportes legales y operativos (3–6 sem)

| Reporte | Ruta backend | Validación |
|---|---|---|
| 606, 607, 608 (DGII) | `backend/apps/reportes_dgii/{606,607,608}.py` | Output byte-exact vs legado |
| IT-1 + anexos | `backend/apps/reportes_dgii/it1.py` | Idem |
| Bancarios (ACH, débito directo) | `backend/apps/reportes_bancos/{ach,debito}.py` | Idem |
| Estados de cuenta, balance, cierres | `backend/apps/reportes_operativos/*.py` | Idem |

### QA Fase 5

| Test | Ruta | Qué valida |
|---|---|---|
| `test_phase5_dgii_byte_exact.py` | `backend/apps/qa/tests/test_phase5_dgii_byte_exact.py` | `diff` cero contra reporte real del legado para mismo periodo |
| `test_phase5_bancos_byte_exact.py` | `backend/apps/qa/tests/test_phase5_bancos_byte_exact.py` | Idem para archivos ACH |
| `test_phase5_permiso_imprimir.py` | `backend/apps/qa/tests/test_phase5_permiso_imprimir.py` | Usuario sin permiso `imprimir` recibe 403 |

---

## Fase 6 — Migración de datos y cutover (2–4 sem)

| # | Tarea | Ruta |
|---|---|---|
| 6.1 | Snapshot Oracle 11g → staging | `infra/scripts/staging_snapshot.{ps1,sh}` |
| 6.2 | Scripts de carga SQLite (usuarios, mapping, permisos) | `backend/apps/migration/scripts/{load_users,load_perms,...}.py` |
| 6.3 | Continuidad de consecutivos (NCF, cheques) | `backend/apps/consecutivos/cutover.py` |
| 6.4 | Conciliación pre-corte (saldos, inventarios) | `backend/apps/qa/reconciliation/precut.py` |
| 6.5 | Plan de corte + comunicación | `memorias_sigaft/17_cutover_plan.md` |

### QA Fase 6

| Test | Ruta | Qué valida |
|---|---|---|
| `test_phase6_consecutivos_continuity.py` | `backend/apps/qa/tests/test_phase6_consecutivos_continuity.py` | Tras carga, próximo NCF reservado = último del legado + 1 |
| `test_phase6_balances.py` | `backend/apps/qa/tests/test_phase6_balances.py` | Suma de saldos por cuenta en sistema nuevo == sistema viejo |
| `test_phase6_inventario.py` | `backend/apps/qa/tests/test_phase6_inventario.py` | Existencia por producto coincide |

---

## Fase 7 — Pruebas, piloto y salida (2–4 sem)

| # | Pieza | Ruta |
|---|---|---|
| 7.1 | UAT por módulo con usuarios reales | `qa_data/uat/{modulo}/checklist.md` |
| 7.2 | Período paralelo (duración definida en Fase 0) | `infra/scripts/parallel_run/` |
| 7.3 | Soporte post-corte intensivo (2–4 sem) | rotación de incidencias |

### QA Fase 7

| Test | Ruta | Qué valida |
|---|---|---|
| `test_phase7_smoke.py` | `backend/apps/qa/tests/test_phase7_smoke.py` | Suite global: login real, factura simple QA, asiento, reporte, anulación, cleanup |
| Conciliación diaria del paralelo | `backend/apps/qa/reconciliation/runner.py` | Cero diferencias por N días seguidos para promover módulo |

---

## Estimación global ajustada

- **Con FMB/RDF disponibles:** **6–9 meses** para paridad funcional fuerte; MVP utilitario 3–5 meses.
- Áreas de mayor riesgo: Sdn, Fat, Chc, posting contable, formatos DGII/bancos.

---

## Lo primero que ejecutaríamos al dar luz verde

1. **Levantar staging del Oracle** (Fase 0 punto 5) — sin esto no hay QA seguro.
2. **Crear `apps/qa/`** con runner + safety + cleanup + el primer test de smoke.
3. **Tarea 1.A — descubrir tabla de usuarios del legado** (queries solo lectura sobre `ALL_TABLES`/`ALL_TAB_COLUMNS`).
