# Plan de ejecucion ODC (Ordenes de Compras) — construir desde cero

- **Fecha:** 2026-05-30
- **Spec:** `specs/2026-05-30-odc-construir-modulo-design.md`
- **Meta-spec:** `specs/2026-05-30-sigaft-meta-validacion-modulos-design.md`
- **Plantilla a clonar:** CxP (`features/cxp/` cuando exista) o CxC (`features/cxc/` ya completo).
- **Working dir VM:** `facturation-system/` en `jcabreu@10.0.0.99` (deploy via pscp; backend con auto-reload).

Convenciones:
- Cada tarea es atomica (2-5 min) y observable.
- Tras cada edicion: validar (`python -c "import ast; ast.parse(...)"` o `pnpm typecheck`) y subir via pscp.
- `[B]` = backend, `[F]` = frontend, `[Q]` = QA/E2E.

---

## Fase 0 — Inspeccion y preparacion (4 tareas)

- [ ] **0.1 [B]** `cat` en VM `apps/legacy/repositories/odc_repo.py` (12 lineas, stub `count_ordenes`); decidir si la tabla `ODC.TODC_DOCUMENTO` es un alias historico — `grep -r "count_ordenes" facturation-system/backend/` para ver si alguien la consume.
- [ ] **0.2 [B]** `grep -ri "odc" facturation-system/backend/sigaft_backend/urls.py facturation-system/backend/facturation_api/` para confirmar que NO hay include actual de `odc_urls`.
- [ ] **0.3 [F]** Bajar copia local de `routes/_authenticated/cxc.tsx`, `routes/_authenticated/cxc/index.tsx` y un componente `features/cxc/cxc-clientes.tsx` como referencia visual de layout y tabla CRUD.
- [ ] **0.4 [B]** `DESC TODC_ORDEN` y `DESC TODC_ORDENL` ejecutado via `oracle-sigaf-erp` agente; volcar columnas en `notes/odc-schema.md` (campos clave: `NO_CIA, PUNTO, NO_ORDEN, NO_PROVEEDOR, FECHA, FECHA_ENTREGA, NO_LOCALIDAD, TIPO_ORDEN, ESTADO, AUTORIZADA_POR, ST_IMPRESION, ST_ANULADO, TOTAL_NETO`).

## Fase 1 — Layout, routing y sidebar (5 tareas)

- [ ] **1.1 [F]** Crear `routes/_authenticated/odc.tsx` clon literal del layout CxC (Header + `<Main fluid>` + `<Outlet/>`).
- [ ] **1.2 [F]** Crear `routes/_authenticated/odc/index.tsx` que use `Navigate` a `/odc/ordenes`.
- [ ] **1.3 [F]** Crear carpeta `features/odc/` con `index.ts` placeholder de reexports.
- [ ] **1.4 [F]** Editar `components/layout/data/sidebar-data.ts`: convertir "Ordenes de Compras" a `NavCollapsible` con 5 grupos (Configuracion / Ordenes / Requisicion / Consultas / Reportes) y 14 sub-items apuntando a rutas aun-no-existentes.
- [ ] **1.5 [F]** `pnpm typecheck` + smoke browser: abrir `/odc`, redirige a `/odc/ordenes` (404 esperado hasta Fase 3); sidebar muestra grupo ODC anidado.

## Fase 2 — Backend bootstrapping (4 tareas)

- [ ] **2.1 [B]** Crear `apps/legacy/odc_urls.py` (vacio con `urlpatterns = []` y comentario plantilla); crear `apps/legacy/odc_views.py` esqueleto.
- [ ] **2.2 [B]** Editar `facturation_api/urls.py`: agregar `path('api/odc/', include('apps.legacy.odc_urls'))`.
- [ ] **2.3 [B]** Reescribir `repositories/odc_repo.py`: borrar `count_ordenes` (sobre TODC_DOCUMENTO basura), agregar shell con imports y comentarios de secciones (Companias / Puntos / Usuarios / Ordenes / Requisiciones / Reportes).
- [ ] **2.4 [B]** Smoke: `curl http://localhost:8000/api/odc/` debe devolver 404 list (no 500); confirma include OK.

## Fase 3 — Configuracion: 3 catalogos (6 tareas)

- [ ] **3.1 [B]** `odc_repo`: `list_companias`, `create_compania`, `update_compania` (TODC_CIAS con flag `USA_REQUISICION`).
- [ ] **3.2 [B]** `odc_repo`: `list_puntos`, `create_punto`, `update_punto` (TODC_PUNTO con `PROX_ORDEN`, `PROX_REQUISICION`).
- [ ] **3.3 [B]** `odc_repo`: `list_acceso_usuarios`, `upsert_acceso_usuario` (TODC_USUARIO con 13 flags); endpoint GET/POST/PUT.
- [ ] **3.4 [B]** Wirear las 3 secciones en `odc_urls.py` + `odc_views.py` (9 endpoints CRUD); agregar metodos en `lib/regal-general-api.ts`.
- [ ] **3.5 [F]** Crear `features/odc/odc-companias.tsx`, `odc-puntos-trabajo.tsx`, `odc-acceso-usuarios.tsx` (clonando patron `cxc-*` con tabla + Sheet de edicion). Cada uno usa `useQuery` `staleTime: 1000*60*5`.
- [ ] **3.6 [F]** Crear las 3 rutas `routes/_authenticated/odc/{companias,puntos-trabajo,acceso-usuarios}.tsx` que montan los componentes con `noCia/punto` de `useCompany()`.

## Fase 4 — Ordenes de Compra: backend + frontend (7 tareas)

- [ ] **4.1 [B]** `odc_repo.list_ordenes(no_cia, punto, filtros)` con paginacion (no traer >500 filas).
- [ ] **4.2 [B]** `odc_repo.get_orden(no_cia, punto, no_orden)` con detalle de lineas via TODC_ORDENL JOIN TINV_PRODUCTO/TINV_UNIDAD/TINV_REFERENCIA/TINV_EMPAQUE.
- [ ] **4.3 [B]** `odc_repo.create_orden(payload)`: transaccion con `TCXP_SECUENCIA FOR UPDATE` + `UPDATE TODC_PUNTO.PROX_ORDEN` + INSERT TODC_ORDEN + bulk INSERT TODC_ORDENL; valida permisos `CREAR_ODC_INV`, `MONTO_MINIMO/MAXIMO` de TODC_USUARIO.
- [ ] **4.4 [B]** `odc_repo` operaciones laterales: `autorizar_orden`, `cerrar_orden`, `anular_orden`, `marcar_impresion`. Cada una valida permiso correspondiente del usuario.
- [ ] **4.5 [B]** Endpoints REST: `GET /api/odc/ordenes/`, `GET /api/odc/ordenes/<no_cia>/<punto>/<no_orden>/`, `POST`, `PUT`, `POST .../autorizar/`, `POST .../cerrar/`, `POST .../anular/`, `POST .../imprimir/`.
- [ ] **4.6 [F]** Crear `features/odc/odc-ordenes.tsx` (lista + filtros + Sheet de creacion con productos paginados a la INV `useQuery` con `staleTime 30s`) y `odc-orden-detalle.tsx` (ruta `odc/ordenes/$no_cia/$punto/$no_orden`).
- [ ] **4.7 [F]** Crear `odc-autorizar.tsx`, `odc-cerrar-anular.tsx`, `odc-imprimir.tsx` + rutas. Reusan endpoints de 4.5; cada uno respeta el permiso en UI (botones deshabilitados).

## Fase 5 — Requisiciones (5 tareas, condicional `USA_REQUISICION='S'`)

- [ ] **5.1 [B]** `odc_repo` CRUD requisicion: `list_requisiciones`, `get_requisicion`, `create_requisicion`, `update_requisicion`, `autorizar_requisicion`, `cerrar_requisicion`, `anular_requisicion`.
- [ ] **5.2 [B]** `odc_repo.cotizar_requisicion(no_cia, punto, no_req, proveedores[])`: maneja escritura/lectura en `TODC_REQUISICION_TMP` (scratch por usuario).
- [ ] **5.3 [B]** `odc_repo.consolidar_requisicion(no_cia, punto, requisiciones[])`: genera 1 nueva requisicion agrupando lineas; `UPDATE TODC_PUNTO.PROX_REQUISICION`; marca las originales como consolidadas.
- [ ] **5.4 [B]** Endpoints: 5 listados/CRUD + 3 acciones (autorizar, cerrar, anular) + `POST .../cotizar/` + `POST /api/odc/requisiciones/consolidar/`.
- [ ] **5.5 [F]** Crear las 5 vistas + rutas: `odc-requisiciones.tsx`, `odc-autorizar-requisicion.tsx`, `odc-cerrar-requisicion.tsx`, `odc-cotizacion-requisicion.tsx`, `odc-consolidar-requisicion.tsx`. Ocultar el grupo Requisicion en sidebar si `TODC_CIAS.USA_REQUISICION != 'S'` (check via `useQuery` al cargar la sesion).

## Fase 6 — Consultas (2 tareas)

- [ ] **6.1 [F]** Crear `features/odc/odc-consulta-ordenes.tsx` + ruta — reutiliza la lista paginada `list_ordenes` con filtros extendidos (sin acciones de escritura). Drill-down a `odc-orden-detalle`.
- [ ] **6.2 [F]** Crear `odc-consulta-requisicion.tsx` + ruta — analogo para requisiciones.

## Fase 7 — Reportes PDF (8 tareas)

Cada PDF extiende `apps/legacy/pdf_helpers.build_pdf_report` (config columnas / query / totales / header_extra / footer_extra). Las queries vienen del spec §5.

- [ ] **7.1 [B]** `odc_repo.report_movimientos_pendientes(filtros)` -> rows + totales; endpoint `GET .../reportes/movimientos-pendientes/pdf/`.
- [ ] **7.2 [B]** `odc_repo.report_listado_por_documento(filtros)` -> endpoint `GET .../reportes/listado-por-documento/pdf/`. Maneja `cual_fecha in (C, E)`.
- [ ] **7.3 [B]** `odc_repo.report_compra_por_producto(filtros)` -> endpoint `.../reportes/compra-por-producto/pdf/` con agrupacion por linea/sub-linea.
- [ ] **7.4 [B]** `odc_repo.report_requisicion_detalle(filtros)` -> endpoint `.../reportes/requisicion-detalle/pdf/`.
- [ ] **7.5 [B]** `odc_repo.report_resumen_odc(filtros)` -> endpoint `.../reportes/resumen-odc/pdf/` con parametro `autorizacion in (A, N, T)`.
- [ ] **7.6 [B]** `odc_repo.report_ordenes_general(filtros)` -> endpoint `.../reportes/ordenes/pdf/` (alimenta el `Fodc301`).
- [ ] **7.7 [B]** `odc_repo.imprimir_orden(no_cia, punto, no_orden)` y `imprimir_cotizacion_requisicion(no_cia, punto, no_req)` -> endpoints `.../imprimir-orden/<...>/pdf/` y `.../imprimir-cotizacion/<...>/pdf/`. Estos son los documentos formales enviados al proveedor.
- [ ] **7.8 [F]** Crear `features/odc/odc-reportes.tsx` (hub con 7 tabs/botones que abren cada PDF en nueva pestana via window.open) + ruta `/odc/reportes`.

## Fase 8 — Reconciliacion SQL vs legacy (3 tareas)

- [ ] **8.1 [Q]** Para Reporte Movimientos Pendientes: ejecutar query del clon (Fase 7.1) y query equivalente directa en SQL Developer contra legacy mismo periodo; comparar conteo de filas + suma `TOTAL_NETO`. Documentar en `backend/docs/reconciliacion/odc-rodc201.md` con screenshots.
- [ ] **8.2 [Q]** Repetir para `rodc202` (Listado por Documento) y `rodc208` (Compra por Producto). Documentar.
- [ ] **8.3 [Q]** Reconciliacion cross-modulo: query ODC pendientes vs facturas CxP con `NO_ORDEN` referenciado; verificar consistencia (no debe haber OC autorizada cerrada con saldo no consumido).

## Fase 9 — E2E Playwright (5 tareas)

- [ ] **9.1 [Q]** `frontend/e2e/odc/crear-oc.spec.ts` (flujo 1 del spec §4): login -> crear OC -> verificar NO_ORDEN correlativo, estado, total.
- [ ] **9.2 [Q]** `frontend/e2e/odc/autorizar-imprimir.spec.ts` (flujo 2).
- [ ] **9.3 [Q]** `frontend/e2e/odc/requisicion-consolidar.spec.ts` (flujo 3).
- [ ] **9.4 [Q]** `frontend/e2e/odc/reporte-pendientes.spec.ts` (flujo 4) — verifica HTTP 200 y que el PDF descargado tenga >0 bytes.
- [ ] **9.5 [Q]** `frontend/e2e/odc/anular-oc.spec.ts` (flujo 5).

## Fase 10 — Limpieza y cierre DoD (3 tareas)

- [ ] **10.1 [B+F]** `grep -rE "TODO|FIXME|XXX" backend/apps/legacy/odc_*.py backend/apps/legacy/repositories/odc_repo.py frontend/src/features/odc/ frontend/src/routes/_authenticated/odc/` -> debe retornar 0 matches.
- [ ] **10.2 [Q]** Capturar pantalla con Playwright para los 5 flujos criticos; guardar en `backend/docs/captures/odc/`.
- [ ] **10.3 [Q]** Actualizar dashboard `backend/docs/superpowers/00_roadmap_avance.md`: marcar ODC como cerrado (DoD 3.1 / 3.2 / 3.3 / 3.4 todos verde). Crear PR.

---

## Resumen

**Total tareas:** 47 atomicas distribuidas en 11 fases (0 a 10).
Si el plan resulta muy granular para sub-agentes, se pueden agrupar las tareas `[F]` con su `[B]` correspondiente cuando sean modificaciones acopladas; en ese caso el conteo efectivo seria ~28-30.

**Dependencias:**
- Fase 1 antes que Fase 3 (necesita layout para que las rutas existan).
- Fase 2 antes que Fase 3-7 (sin urls/views no hay endpoints).
- Fase 4 antes que Fase 5 (requisicion termina creando una ODC al consolidar).
- Fase 8 (reconciliacion SQL) requiere Fase 7 completa.
- Fase 9 (E2E) requiere Fase 3-7 completas.

**Bloqueo upstream:** modulo CxP en stub bloquea pruebas con proveedores reales — coordinar con plan CxP. Modulo CNT en estabilizacion bloquea selector de localidades — verificar.
