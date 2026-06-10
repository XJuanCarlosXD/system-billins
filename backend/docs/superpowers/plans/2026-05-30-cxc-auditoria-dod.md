# Plan — Auditoría DoD módulo CxC

- **Fecha:** 2026-05-30
- **Spec referenciado:** [2026-05-30-cxc-auditoria-dod-design.md](../specs/2026-05-30-cxc-auditoria-dod-design.md)
- **Meta-spec maestro:** [2026-05-30-sigaft-meta-validacion-modulos-design.md](../specs/2026-05-30-sigaft-meta-validacion-modulos-design.md)
- **Naturaleza:** Auditoría sistemática — NO incluye construcción. Gaps detectados se convierten en issues.
- **VM:** 10.0.0.99 (jcabreu/Temp1234!). Trabajo en `~/facturation-system/`.

---

## Fase 1 — Inventariar vistas (paridad menú)

Objetivo: producir `backend/docs/auditoria_cxc/01_paridad_menu.md` cruzando 31 vistas clon contra 81 forms legacy.

- [ ] **1.1** [SSH `ls frontend/src/routes/_authenticated/cxc/*.tsx`] Listar las 31 rutas clon exactas y volcar nombres en hoja de trabajo.
- [ ] **1.2** [SSH `ls frontend/src/features/cxc/cxc-*.tsx`] Listar los 9 features compartidos y mapear cada ruta → feature → endpoint(s) invocado(s).
- [ ] **1.3** [`grep -rE "useQuery|fetch\\(|apiClient\\." frontend/src/features/cxc/`] Extraer endpoints reales consumidos por cada feature y anotar en la tabla.
- [ ] **1.4** [Leer `memorias_por_modulo/memoria_cuentas_por_cobrar.md`] Extraer los 81 forms legacy (Fcxc*.fmx) con su descripción y sección de menú.
- [ ] **1.5** [Editar `backend/docs/auditoria_cxc/01_paridad_menu.md`] Construir tabla `form_legacy → ruta_clon → estado` con valores `cubierto | parcial | faltante | descartado-justificado` para los 81 forms.
- [ ] **1.6** [Editar mismo archivo, §"Descartes justificados"] Documentar definitivamente los candidatos del spec §6 (Fcxc123, Fcxc319, Fcxc108/109 fusión, etc.) con justificación de una línea cada uno.
- [ ] **1.7** [Editar mismo archivo, §"Resumen"] Calcular % cobertura real = `cubierto / (81 - descartado-justificado)` y firmar PASS/FAIL contra DoD §3.1 (umbral 100 % requerido).

## Fase 2 — Inventariar reportes (paridad PDFs)

Objetivo: producir `backend/docs/auditoria_cxc/02_paridad_reportes.md`.

- [ ] **2.1** [`grep -rE "pdf_helpers|build_pdf_report|HttpResponse.*pdf" backend/apps/legacy/cxc_*.py backend/apps/legacy/repositories/cxc_repo.py`] Confirmar que NO existe endpoint PDF (resultado esperado: 0 matches) y documentarlo.
- [ ] **2.2** [`grep -E "^path\\(|^re_path\\(" backend/apps/legacy/cxc_urls.py`] Listar las 32 rutas backend y clasificar JSON vs PDF.
- [ ] **2.3** [`grep -rEi "Rcxc[0-9]+\\.rep" memorias_por_modulo/memoria_cuentas_por_cobrar.md`] Extraer los 14 `.rep` mencionados con título.
- [ ] **2.4** [`memory_get sigaf/module-memory-20260530-final/cuentas_por_cobrar/part-*` — MCP, una sola llamada] Bajar la lista autoritativa de 154 reports CxC.
- [ ] **2.5** [Editar `02_paridad_reportes.md`] Tabla `report_legacy → endpoint_clon → estado` con `pdf-existe | json-pero-sin-pdf | no-existe | descartado` para los 154 reports.
- [ ] **2.6** [Editar mismo archivo, §"Resumen"] Calcular paridad PDF = `pdf-existe / total` (esperado ~0 %) y firmar FAIL contra DoD §3.2.
- [ ] **2.7** [Editar mismo archivo, §"Top 5 prioritarios"] Listar los 5 reports clave del spec §2.2 con su mapeo legacy → endpoint actual JSON.

## Fase 3 — Reconciliación SQL (5 reportes clave)

Objetivo: crear `backend/docs/auditoria_cxc/03_reconciliacion_sql/<reporte>.md` por cada uno con SQL clon, SQL legacy inferido, conteo+suma+muestra 10 filas, verificación PK compuesta.

- [ ] **3.1** [Crear `03_reconciliacion_sql/01_envejecimiento.md`] Documentar SQL `rep_envejecimiento` desde `cxc_repo.py:~861`, ejecutarlo contra Oracle de la VM con empresa+fecha de prueba, comparar buckets 0-30/31-60/61-90/91-120/>120 vs `Fcxc320`/`Rcxc202`. Verificar `JOIN ON c.no_cia=d.no_cia AND c.no_cliente=d.no_cliente`.
- [ ] **3.2** [Crear `02_estado_cuenta.md`] Extraer las 2 queries (cabecera + detalle) de `cxc_repo.py`, ejecutar para 1 cliente con saldos abiertos, comparar conteo de documentos y suma de saldo vs `Fcxc501`/`Fcxc503`/`Rcxc309`. Verificar PK compuesta.
- [ ] **3.3** [Crear `03_cobros_vendedor.md`] Ejecutar query `rep_cobros_vendedor` para un período mensual, agrupar por vendedor, comparar count+total vs `Rcxc302.rep`. Verificar PK compuesta y descripción de vendedor (no código crudo).
- [ ] **3.4** [Crear `04_ncf_emitidos.md`] Inspeccionar `rep_ncf` SQL: ¿lee `d.ncf` directo o compone? Ejecutar muestra 10 filas y comparar contra el helper `_compose_ncf_dgi` aplicado manualmente. Decidir si hace falta refactor y dejarlo registrado como hallazgo.
- [ ] **3.5** [Crear `05_balance_clientes.md`] Ejecutar `balance_clientes`, verificar buckets aging idénticos a 3.1 pero sin filtro vendedor. Comparar contra `Fcxc314 Mayor Auxiliar`/`Rcxc315.rep`. Verificar PK compuesta.

## Fase 4 — Suite Playwright E2E (5 flujos críticos)

Objetivo: crear `frontend/e2e/cxc/` (no existe) con un spec por flujo. Cada test: HTTP 2xx, `console.error` count = 0, screenshot final, assertion semántica.

- [ ] **4.1** [Crear `frontend/e2e/cxc/01-alta-cliente.spec.ts`] Login → `/cxc/clientes` → Nuevo → completar (nombre, RNC, vendedor, tipo contable, zona) → Guardar → assert toast éxito + fila aparece en lista + `POST /api/cxc/clientes/` 2xx.
- [ ] **4.2** [Crear `02-registrar-cobro.spec.ts`] Precondición: cliente con saldo. `/cxc/documentos` → Nuevo → tipo CR → cliente → monto → aplicar → Guardar → assert fila `tipo_movi='CR'` en lista + saldo cliente recalculado + `next-doc` incrementa.
- [ ] **4.3** [Crear `03-aging.spec.ts`] `/cxc/rep-envejecimiento` → filtro empresa → ejecutar → assert columnas 0-30/31-60/61-90/91-120/>120 presentes + total != null + `GET /api/cxc/rep-envejecimiento/` 2xx.
- [ ] **4.4** [Crear `04-estado-cuenta.spec.ts`] `/cxc/estado-cuenta` → seleccionar cliente con docs pendientes → assert tabla documentos visible + cliente mostrado por nombre (regex `[A-Za-z]` no solo dígitos) + total pendiente > 0.
- [ ] **4.5** [Crear `05-cierre-mensual.spec.ts`] `/cxc/generar-asiento` → mes/año test → preview → confirmar → `/cxc/cierre` → cerrar período → assert `ST_GENERADO_CNT='S'` (vía endpoint consulta) + `MES_PROCESO` avanza + redirect/ok.
- [ ] **4.6** [Editar `frontend/playwright.config.ts` o crear si no existe] Registrar carpeta `e2e/cxc/`, baseURL `http://localhost:5173`, retries 1, screenshot `only-on-failure`, hook global que falla si `console.error` > 0.
- [ ] **4.7** [SSH `cd frontend && npx playwright test e2e/cxc/`] Ejecutar la suite completa, capturar resultado, anotar pass/fail por test en `backend/docs/auditoria_cxc/04_e2e_resultados.md`.

## Fase 5 — Reglas DGI + limpieza de código

Objetivo: validar NCF DGI compuesto, PK compuesta en todos los JOIN, y cero TODO/FIXME en código CxC.

- [ ] **5.1** [`grep -nE "TCXC_CLIENTE" backend/apps/legacy/repositories/cxc_repo.py`] Listar TODOS los JOIN a `TCXC_CLIENTE` y verificar uno por uno que llevan `ON c.no_cia=X.no_cia AND c.no_cliente=X.no_cliente`. Anotar violaciones en `backend/docs/auditoria_cxc/05_pk_compuesta.md`.
- [ ] **5.2** [`grep -nE "d\\.ncf|\\.ncf\\b" backend/apps/legacy/repositories/cxc_repo.py backend/apps/legacy/cxc_views.py`] Identificar lecturas crudas de NCF que deberían usar `_compose_ncf_dgi` (`POSICIONES_FIJAS_NCF || LPAD(NCF,8,'0')`). Anotar cada caso en `05_pk_compuesta.md` §"NCF DGI".
- [ ] **5.3** [`grep -rE "TODO|FIXME|XXX" backend/apps/legacy/cxc_*.py backend/apps/legacy/repositories/cxc_repo.py frontend/src/features/cxc/ frontend/src/routes/_authenticated/cxc/`] Listar pendientes y anotar en `05_pk_compuesta.md` §"Limpieza" (objetivo: 0).
- [ ] **5.4** [`grep -rE "Empresa 01|no_cia.*display|no_cliente.*display" frontend/src/features/cxc/`] Verificar que no hay placeholder de razón social hardcoded ni IDs internos crudos en UI; documentar hallazgos.

## Fase 6 — Issues abiertos + Dashboard

Objetivo: convertir cada gap en issue accionable y reflejar el estado real DoD en el roadmap.

- [ ] **6.1** [Editar `backend/docs/auditoria_cxc/06_issues_abiertos.md`] Crear una entrada por cada gap detectado en Fases 1-5 con: ID `CXC-AUD-NN`, descripción, archivo afectado, criterio DoD violado, esfuerzo estimado.
- [ ] **6.2** [Editar `backend/docs/superpowers/00_roadmap_avance.md`] Actualizar fila CXC con estado real por criterio DoD: §3.1 paridad menú %, §3.2 paridad reports %, §3.3 E2E pass/fail, §3.4 reglas DGI pass/fail. Marcar CxC como **NO CERRADO** si algún criterio falla.
- [ ] **6.3** [SSH `cd ~/facturation-system && git add backend/docs/auditoria_cxc/ frontend/e2e/cxc/ backend/docs/superpowers/00_roadmap_avance.md && git status`] Verificar que todos los artefactos de auditoría quedan trackeados (sin commit aún, lo decide el usuario).

---

## Resumen

- **Total tareas atómicas:** 30
- **Fase 1 (paridad menú):** 7
- **Fase 2 (paridad reportes):** 7
- **Fase 3 (reconciliación SQL):** 5
- **Fase 4 (Playwright E2E):** 7
- **Fase 5 (DGI + limpieza):** 4
- **Fase 6 (issues + dashboard):** 3

**Esfuerzo estimado:** 3-5 horas. **Output:** 8 docs + 5 specs E2E + roadmap actualizado + lista de issues. **NO se construye código nuevo de negocio**; sólo tests E2E y docs.
