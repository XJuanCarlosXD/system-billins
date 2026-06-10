# Plan módulo ACC (Adm. Caja Chica) — Quick-win

- **Fecha:** 2026-05-30
- **Spec referenciado:** `specs/2026-05-30-acc-construir-modulo-design.md`
- **Meta-spec:** `specs/2026-05-30-sigaft-meta-validacion-modulos-design.md`
- **Modo de ejecución sugerido:** `subagent-driven-development` (tareas independientes paralelizables marcadas con `[P]`).

---

## Orden de ejecución

El plan se divide en 4 fases. Cada fase termina con un checkpoint de revisión (DoD §3 meta-spec).

### Fase 0 — Bootstrap (1 tarea)

1. **Crear estructura de carpetas y stubs**
   - Backend: `apps/acc/__init__.py`, `apps/acc/apps.py`, `apps/acc/urls.py`, `apps/acc/views.py`, `apps/legacy/repositories/acc_repo.py`.
   - Frontend: `frontend/src/features/acc/`, `frontend/src/routes/_authenticated/acc/index.tsx` (layout módulo).
   - Registrar app en `settings.py`, montar `/api/acc/` en `urls.py` raíz.
   - Sidebar global: añadir entrada "Caja Chica" con permisos por TACC_USUARIO.

### Fase 1 — Maestros / Catálogos (6 tareas, paralelizables)

2. **[P] CRUD Tipos de Beneficiario** (Facc106 → `TACC_TBENEFICIARIO`)
   - Repo: list/get/create/update/delete.
   - View + URL `/api/acc/tipos-beneficiario/`.
   - Frontend `acc/maestros/tipos-beneficiario` (lista shadcn DataTable + dialog).

3. **[P] CRUD Tipos de Gasto** (Facc105 → `TACC_TGASTOS`)
   - Lookup contra TCNT_CATALOGO (cuenta) y TCNT_CENTRO_COSTO.
   - Validar duplicados de código.
   - View + frontend `acc/maestros/tipos-gasto`.

4. **[P] CRUD Beneficiarios** (Facc107 → `TACC_BENEFICIARIO`)
   - Secuencia auto vía `TACC_PROX_BENE` (patrón legacy: UPDATE+RETURNING).
   - Validar tipo_bene existe en TACC_TBENEFICIARIO.
   - Frontend con autocompletar tipo_bene.

5. **[P] CRUD Cajas Chicas** (Facc104 → `TACC_CAJA_CHICA`)
   - Campos: descripcion, monto, moneda P/D, cuenta contable (TCNT_CATALOGO acepta_movi='S'), codigo_ncf, controlar_cc, reponer_con_dife.
   - Validar unicidad cuenta por (no_cia, punto).
   - Eliminar TCNT_AUXILIAR asociado al borrar.

6. **[P] CRUD Puntos de Trabajo ACC** (Facc102 → `TACC_PUNTO`)
   - Si CNT ya provee, reusar lookup; si no, CRUD local.
   - Campos período: ano_proceso, mes_proceso.

7. **Permisos Usuario ACC** (Facc103 → `TACC_USUARIO` + `TACC_USUARIOC`)
   - Asignar permisos por usuario (activo, hacer_cierre, crear_caja_chica).
   - Asignación por caja (TACC_USUARIOC: digitar_documento, generar_reposicion, anular_reposicion, generar_pago_cc, por_defecto).
   - Frontend matriz usuario × caja.

### Fase 2 — Transaccional (5 tareas, secuenciales por dependencias de datos)

8. **Entrada de Documentos / Comprobantes** (Facc201 → `TACC_DOCUMENTO` + `TACC_DCDOCU`)
   - Form: caja, fecha, beneficiario, tipo_gasto, NCF (posiciones_fijas + lpad), forma_pago_dgii, monto, detalle, cuenta(s) detalle.
   - Validar período abierto (TACC_PUNTO ano_proceso/mes_proceso) antes de grabar.
   - Validar permiso `digitar_documento` en TACC_USUARIOC.
   - Endpoint `POST/GET /api/acc/documentos/`.

9. **Listado y consulta de documentos** (Facc501)
   - Filtros: caja, fechas, beneficiario, tipo_gasto, saldado, NCF.
   - Paginación server-side.
   - Drill a vista detalle.

10. **Corregir NCF y otros datos** (Facc204)
    - Endpoint `PATCH /api/acc/documentos/:id/ncf` con campos: posiciones_fijas_ncf, ncf, rnc, tipo_gasto_dgii, detalle, no_formulario, fecha_vence_ncf, forma_pago, fecha.
    - Validar permiso + período abierto.

11. **Generar/Imprimir Reposición de Caja Chica** (Facc202 → `TACC_REPOSICION` + `TCNT_HNCF`)
    - Endpoint `POST /api/acc/reposiciones/`: consume `PROX_NCF` de TCNT_NCF (`FOR UPDATE`), inserta log en TCNT_HNCF.
    - Marca documentos de la reposición.
    - PDF reposición usando `pdf_helpers.build_pdf_report` (NCF formato DGI completo, header con razón social real, totales).
    - Validar permiso `generar_reposicion`.

12. **Anular Reposición** (Facc205 → `TACC_DOCU_REPO_NULA`)
    - Endpoint `POST /api/acc/reposiciones/:id/anular`.
    - Inserta TACC_DOCU_REPO_NULA + revierte estado de documentos.
    - Validar permiso `anular_reposicion`.

13. **Solicitud Cheque de Reposición** (Facc203 — integración CHC)
    - Endpoint `POST /api/acc/reposiciones/:id/solicitud-cheque`.
    - Reusa `chc_repo` para crear TCHC_CHEQUE.
    - Validar permiso `generar_pago_cc` (TACC_USUARIOC) + `crear_cheque` (TCHC_USUARIOC).

### Fase 3 — Cierre y contabilidad (3 tareas)

14. **Generación de Asiento Contable** (Facc402 → `TACC_ED` working + integración CNT)
    - Endpoint `POST /api/acc/cierre/asiento`.
    - Construye TACC_ED, llama a CNT para crear asiento, UPDATE TACC_DOCUMENTO ST_GENERADO_CNT='S' + NO_ASIENTO/ANO/MES.
    - DELETE TACC_ED al cerrar.

15. **Cierre Mensual** (Facc403 → `TACC_CIERRE`)
    - Endpoint `POST /api/acc/cierre/mensual`.
    - Validar permiso `hacer_cierre`.
    - Validar todos los documentos del período tienen ST_GENERADO_CNT='S'.
    - INSERT TACC_CIERRE + UPDATE TACC_PUNTO (avanzar período).

16. **Impresión Entrada de Diario PDF** (Facc401)
    - Endpoint `GET /api/acc/cierre/entrada-diario/pdf/`.

### Fase 4 — Reportes PDF (3 tareas, paralelizables)

17. **[P] Reportes movimientos (Racc201, Racc203, Racc302, Racc303)**
    - Endpoints `GET /api/acc/reportes/movimientos-pendientes/pdf/`, `/facturacion/pdf/`, `/por-caja/pdf/`, `/por-moneda/pdf/`.
    - Filtros estándar: no_cia, punto, no_caja, fecha_i, fecha_f, moneda, saldado.
    - Header con razón social TCNT_CIAS, filtros aplicados, fecha emisión, usuario.

18. **[P] Reportes maestros (Racc301, Racc304)**
    - `Racc301` por beneficiario/tipo_gasto.
    - `Racc304` listado beneficiarios (filtros tipo_bene, activo).

19. **[P] Reportes pendientes por descubrir (4 restantes hasta 11/11)**
    - Auditar capturas legacy en `capturas/adm_caja_chica/` y memoria.
    - Documentar nombres reales y queries.
    - Implementar endpoints faltantes.

### Fase 5 — Validación y cierre (3 tareas)

20. **Reconciliación SQL vs legacy (DoD §3.2)**
    - Por cada uno de los 7 reportes Q1-Q7 del spec: ejecutar query del clon vs `.rep` legacy en SQL Developer.
    - Documentar evidencia (screenshot + conteo + totales) en `backend/docs/captures/acc/sql-reconciliation/`.

21. **Suite Playwright E2E (5 flujos críticos del spec §4)**
    - `frontend/e2e/acc/crear-documento.spec.ts`
    - `frontend/e2e/acc/generar-reposicion-ncf.spec.ts`
    - `frontend/e2e/acc/anular-reposicion.spec.ts`
    - `frontend/e2e/acc/generar-asiento.spec.ts`
    - `frontend/e2e/acc/reporte-movimientos.spec.ts`
    - Capturas finales en `backend/docs/captures/acc/`.

22. **Cierre DoD + actualizar roadmap**
    - `grep -rE "TODO|FIXME|XXX" backend/apps/acc/ frontend/src/features/acc/` → cero matches.
    - `pnpm typecheck` limpio.
    - `python -c "import ast; ast.parse(...)"` para cada `.py` antes de deploy.
    - Actualizar `00_roadmap_avance.md` con ACC ✅.
    - Crear PR ACC con evidencia SQL + capturas + tests verdes.

---

## Resumen ejecutivo

- **Tareas totales:** 22 (dentro del rango 15-25 del meta-spec quick-win).
- **Paralelización:** 7 tareas marcadas `[P]` se pueden distribuir en sub-agentes (Fase 1 maestros + Fase 4 reportes).
- **Camino crítico:** Fase 0 → Fase 1 (T7 permisos) → Fase 2 (T8 documentos → T11 reposiciones) → Fase 3 cierre → Fase 5 cierre DoD.
- **Hitos de revisión:** al terminar Fase 1 (maestros funcionando), Fase 2 (flujo principal operativo), Fase 4 (todos los PDFs), Fase 5 (DoD verificada).
