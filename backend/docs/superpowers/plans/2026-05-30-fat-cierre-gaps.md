# Plan ejecución FAT — Cierre de gaps post-backlog

- **Fecha:** 2026-05-30
- **Spec:** `2026-05-30-fat-cierre-gaps-design.md`
- **Meta-spec:** `2026-05-30-sigaft-meta-validacion-modulos-design.md`
- **Modo ejecución:** `superpowers:executing-plans` con checkpoints de revisión por bloque. Cada tarea es atómica (2-5 min), con input/output claros.
- **Pre-condición:** los 12 commits del backlog 2026-05-29 están en `main` local de la VM. NO se hace push hasta el wrap-up final (T41).
- **Convenciones de prefijo de tareas:**
  - `DX-n` diagnóstico, `FX-n` fix/implementación, `EX-n` E2E, `RX-n` reconciliación SQL, `WX-n` wrap-up.

---

## Bloque 0 — Setup (T01-T02)

### T01. Verificar estado VM y branch
- **Input:** acceso SSH 10.0.0.99.
- **Acción:** `plink ... "cd facturation-system && git status && git log --oneline -15"`. Confirmar 12 commits backlog presentes en `main`.
- **Output:** log con HEAD esperado (`c1b898a` o posterior). Si difiere, abortar y notificar.

### T02. Crear rama de trabajo
- **Input:** estado limpio.
- **Acción:** `git checkout -b fat-cierre-gaps-2026-05-30`.
- **Output:** rama nueva creada.

---

## Bloque 1 — Gap G1 PERF `/api/fat/productos/` (T03-T06)

### T03. Diagnóstico perf con EXPLAIN PLAN
- **Input:** query actual `search_productos` (líneas 1348-1476 `fat_repo.py`).
- **Acción:** abrir SQL Developer o `sqlplus` en VM, ejecutar `EXPLAIN PLAN FOR <SQL base + um_join + count>` con bind `no_cia='01', no_lista='01', search=''`. Capturar plan.
- **Output:** evidencia del plan en `backend/docs/captures/fat/g1-explain-before.txt` (full table scan en TINV_EMPAQUE esperado).

### T04. Refactor `search_productos` — extraer empaque del SQL base
- **Input:** archivo `apps/legacy/repositories/fat_repo.py`.
- **Acción:** eliminar `um_join` del `base_sql`. Bulk fetch post-paginación de `TINV_EMPAQUE WHERE POR_DEFECTO='S' AND NO_PRODU IN (...)` siguiendo el mismo patrón del bloque de existencia (líneas 1418-1463). Mantener `lp.precio * NVL(um.cpe,1)` recalculando en Python para los items de la página.
- **Output:** patch del repo. Validar con `python -c "import ast; ast.parse(open('fat_repo.py').read())"`.

### T05. Smoke perf con Playwright
- **Input:** backend re-deployado vía `pscp`.
- **Acción:** Playwright login → `/fat/facturas/nueva` → abrir buscar-producto-modal → escribir "001" → medir tiempo respuesta `/api/fat/productos/`. Target <500ms p95.
- **Output:** screenshot + log de DevTools en `backend/docs/captures/fat/g1-after.png`. Si >500ms, iterar query.

### T06. Frontend resiliencia (B1)
- **Input:** `frontend/src/features/fat/components/buscar-producto-modal.tsx` (o similar).
- **Acción:** agregar `useQuery({ staleTime: 30_000, retry: 1 })` + skeleton mientras carga. Mostrar mensaje accionable si error >5s.
- **Output:** patch frontend + `pnpm typecheck` limpio.

**Checkpoint 1.** Revisar perf G1 antes de continuar.

---

## Bloque 2 — Gap G2 Conduce edit mode (T07-T10)

### T07. Diagnóstico create_conduce vs UPDATE
- **Input:** `fat_repo.create_conduce` (línea 1651).
- **Acción:** leer función completa, identificar tablas: TFAT_CONDUCE (encabezado) + TFAT_DCCONDUCE (detalle). Documentar columnas clave en mini-tabla.
- **Output:** notas internas (no archivo) sobre PK y transacción.

### T08. Implementar `fat_repo.update_conduce`
- **Input:** `fat_repo.py`.
- **Acción:** nueva función `update_conduce(no_cia, punto, tipo_conduce, no_conduce, ...campos..., lineas)`. Validar `ESTADO != 'C'` y `ST_AUTORIZADO != 'S'` antes de update; transacción `UPDATE TFAT_CONDUCE ...` + `DELETE TFAT_DCCONDUCE WHERE ...` + `INSERT TFAT_DCCONDUCE ...` por línea. Commit explícito.
- **Output:** función nueva + `ast.parse` OK.

### T09. Exponer PATCH en `FatConduceDetailView`
- **Input:** `apps/fat/views.py` línea 609.
- **Acción:** agregar `def patch(self, request, tipo, no_conduce)`. Guard `_check_fat_access`. Pasar body a `update_conduce`. Respuesta 200 con conduce actualizado.
- **Output:** patch + `ast.parse` OK + restart backend.

### T10. E2E F4 — editar conduce
- **Input:** Playwright suite.
- **Acción:** test `fat/editar-conduce.spec.ts`: navegar a conduce existente no autorizado, editar línea, guardar, verificar HTTP 200 + sin `console.error`. Screenshot final.
- **Output:** test verde + captura en `backend/docs/captures/fat/f4-conduce-edit.png`.

**Checkpoint 2.** Revisar G2 antes de continuar.

---

## Bloque 3 — Gap G3a Puntos de Trabajo upsert (T11-T13)

### T11. Implementar `fat_repo.upsert_punto_fat`
- **Input:** `fat_repo.py` (siguiendo patrón `upsert_tipo_pago` línea 235).
- **Acción:** función `upsert_punto_fat(no_cia, punto, descripcion, max_descuento, activo, ano_proceso, mes_proceso, mes_cierre)`. SELECT 1 / UPDATE / INSERT en FAT.TFAT_PUNTO. Commit.
- **Output:** función nueva.

### T12. Agregar POST/PATCH en `FatPuntosView`
- **Input:** `apps/fat/views.py` línea 369.
- **Acción:** método `post` con `_check_fat_access`, guards de longitud (`len(punto)<=2`). PATCH idem.
- **Output:** vista actualizada + restart backend.

### T13. Frontend `puntos.tsx` — formulario crear/editar
- **Input:** `frontend/src/features/fat/puntos.tsx`.
- **Acción:** agregar `Dialog` con form (descripcion, max_descuento, activo Switch, periodos). `useMutation` + `invalidateQueries(['fat','puntos',no_cia])`. Validación inline.
- **Output:** UI funcional + `pnpm typecheck` limpio.

---

## Bloque 4 — Gap G3b Listas de Precio cabecera+detalle (T14-T18)

### T14. Implementar `fat_repo.upsert_tipo_precio`
- **Input:** `fat_repo.py`.
- **Acción:** función nueva: upsert sobre TFAT_TIPO_PRECIO (no_cia, no_lista, descripcion, activa, tipo_moneda). Guard `no_lista` ≤4 chars.
- **Output:** función + ast OK.

### T15. Implementar `fat_repo.upsert_lista_precio_item` y `delete_lista_precio_item`
- **Input:** `fat_repo.py`.
- **Acción:** dos funciones. `upsert_lista_precio_item(no_cia, punto, no_lista, no_produ, precio, activo, nota)` — recordar que `precio` se guarda en **unidad base** (regla `fat/precio-lista-cpe-multiplier`). `delete_lista_precio_item(no_cia, punto, no_lista, no_produ)`.
- **Output:** funciones + ast OK.

### T16. Crear `FatListaPrecioItemView` + URLs
- **Input:** `apps/fat/views.py` + `urls.py`.
- **Acción:** nueva vista con POST/PATCH/DELETE. URL `path('fat/listas-precio/<str:no_lista>/items/', FatListaPrecioItemView.as_view())`. Agregar POST/PATCH a `FatListasPrecioView` para cabecera.
- **Output:** rutas registradas + restart backend.

### T17. Frontend `listas-precio.tsx` master-detail
- **Input:** vista existente.
- **Acción:** refactor a layout 2-paneles: lista de cabeceras (CRUD inline) + tabla detalle del seleccionado con buscar-producto-modal embebido para agregar items, edición precio inline, botón eliminar por fila. `useMutation` por operación.
- **Output:** UI + `pnpm typecheck` limpio.

### T18. E2E F5 — Listas de Precio CRUD
- **Input:** Playwright.
- **Acción:** test `fat/listas-precio.spec.ts`: crear lista, agregar 3 productos, editar uno, eliminar otro. Verificar persistencia en GET.
- **Output:** test verde + captura.

---

## Bloque 5 — Gap G3c Tipos de Pago status (T19-T21)

### T19. Decisión migración + script SQL
- **Input:** discusión con DBA / aprobación usuario.
- **Acción:** redactar script `ALTER TABLE FAT.TFAT_TIPO_PAGO ADD (STATUS VARCHAR2(1) DEFAULT 'A')` + `UPDATE ... SET STATUS='A' WHERE STATUS IS NULL`. Si DBA NO autoriza, documentar descarte en spec §6 y saltar T20-T21.
- **Output:** archivo `backend/docs/migrations/2026-05-30-tfat-tipo-pago-status.sql`.

### T20. Aplicar migración + adaptar `fat_repo.list_tipos_pago` / `upsert_tipo_pago`
- **Input:** migración aprobada.
- **Acción:** ejecutar script en Oracle (con backup snapshot previo). Agregar campo `status` a SELECT y a INSERT/UPDATE. Nueva función `set_tipo_pago_status(no_cia, punto, tipo_pago, activo: bool)`.
- **Output:** SQL aplicado + funciones repo.

### T21. Frontend toggle en `tipos-pago.tsx`
- **Input:** vista existente.
- **Acción:** columna "Activo" con Switch, mutation `PATCH /api/fat/tipos-pago/` (campo `status`). `invalidateQueries`.
- **Output:** UI + `pnpm typecheck` limpio.

---

## Bloque 6 — Gap G4 Condiciones de Pago staff-only (T22-T23)

### T22. Decisión + endurecer view
- **Input:** spec §3.2 E6 decisión adoptada (staff-only).
- **Acción:** en `FatCondicionesPagoView` cambiar `permission_classes = [IsAuthenticated, IsAdminUser]`. Agregar docstring "Catálogo cross-empresa, solo staff". Restart backend.
- **Output:** patch view.

### T23. Smoke staff vs no-staff
- **Input:** Playwright con 2 usuarios.
- **Acción:** test rápido: usuario regular `POST /api/fat/condiciones-pago/` → 403; staff → 201.
- **Output:** assertion en `frontend/e2e/fat/condiciones-pago.spec.ts`.

---

## Bloque 7 — Gap G5 Movimientos producto entry-point (T24-T26)

### T24. Crear ruta `/inv/productos/<no_produ>/movimientos`
- **Input:** `frontend/src/features/inv/` + `inv-rep-movimientos.tsx` (nuevo).
- **Acción:** clonar el modal Rinv304-like actual a una página standalone. Param `no_produ` desde la URL. `useQuery` contra `/api/inv/movimientos/<no_produ>/` (endpoint ya existe).
- **Output:** archivo nuevo + ruta registrada.

### T25. Agregar botón "Movimientos" en buscar-producto-modal
- **Input:** componente buscar-producto-modal (frontend FAT).
- **Acción:** botón "Ver movimientos" por fila → `navigate(/inv/productos/<no_produ>/movimientos)` (target=_blank). Mismo botón en `/fat/listas-precio` detalle.
- **Output:** UX entry-point disponible.

### T26. Smoke E2E movimientos
- **Input:** Playwright.
- **Acción:** abrir buscar-producto → click "Movimientos" → verificar tabla con filas y totales coincidentes con popover.
- **Output:** test rápido + captura.

---

## Bloque 8 — Reportes legacy faltantes (T27-T34)

### T27. Diagnosticar `Rfat321.rep` (ventas producto)
- **Input:** `memoria_facturacion.md` líneas 611-640 + `fat_repo.rep_ventas_producto` (727).
- **Acción:** comparar columnas esperadas (NCF, fecha, cliente, producto, cantidad, monto). Verificar query del repo cubre todas.
- **Output:** notas de columnas faltantes (si hay).

### T28. Exponer view + PDF `rep-ventas-producto`
- **Input:** views + views_print.
- **Acción:** `FatRepVentasProductoView` GET → JSON; `fat_rep_ventas_producto_pdf` en `views_print.py` usando `build_pdf_report`. URLs registradas.
- **Output:** endpoints disponibles.

### T29. Crear `fat-rep-ventas-producto.tsx`
- **Input:** clonar layout de `fat-rep-ventas-cliente.tsx`.
- **Acción:** filtros producto (autocompletar) + desde/hasta + tabla + botón "Exportar PDF". `useQuery` + `useExportPdf`.
- **Output:** vista nueva + ruta.

### T30. Implementar `fat_repo.rep_facturas_despachadas` + view + PDF
- **Input:** Query TFAT_FACTURA JOIN TFAT_CONDUCE.
- **Acción:** repo function (no_cia, punto, desde, hasta) → lista con ncf_dgi, cliente, transportista, fecha_despacho, montos. View + PDF + ruta.
- **Output:** endpoint /api/fat/rep-facturas-despachadas/ + /pdf/.

### T31. Crear `fat-rep-facturas-despachadas.tsx`
- **Input:** patrón rep-*.tsx existente.
- **Acción:** filtros + tabla + exportPdf.
- **Output:** vista nueva.

### T32. Implementar `fat_repo.rep_ventas_linea` + view + PDF
- **Input:** Query agrupada por INV.TINV_LINEA / TINV_SUB_LINEA usando TFAT_DCFACTURA.
- **Acción:** repo + view + PDF con subtotales por línea/sub-línea.
- **Output:** endpoint + PDF.

### T33. Crear `fat-rep-ventas-linea.tsx`
- **Input:** patrón rep-*.tsx.
- **Acción:** filtros + tabla agrupada + exportPdf.
- **Output:** vista nueva.

### T34. PDF cuadre-caja detalle Rfat237 (E10)
- **Input:** views_print.py + funciones `cuadre_caja_por_ncf_forma_pago` + `get_cuadre_caja_detalle`.
- **Acción:** función `fat_cuadre_caja_detalle_pdf` que arma 2 secciones: matriz NCF×forma_pago + tabla detalle factura-por-factura. Header con fecha + usuario. Footer con totales.
- **Output:** endpoint `/api/fat/cuadre-caja/detalle/pdf/` + botón en `cuadre-caja.tsx`.

---

## Bloque 9 — E2E críticos restantes (T35-T37)

### T35. E2E F1 — crear factura completa
- **Input:** Playwright + datos test.
- **Acción:** test `fat/crear-factura.spec.ts` cubriendo flujo completo del spec §4 F1. Verificar tiempo `/api/fat/productos/` (regresión G1).
- **Output:** test verde.

### T36. E2E F2 — anular factura
- **Input:** Playwright.
- **Acción:** test `fat/anular-factura.spec.ts` con motivo + liberar NCF.
- **Output:** test verde.

### T37. E2E F3 — cuadre caja + PDF Rfat237
- **Input:** Playwright.
- **Acción:** test `fat/cuadre-caja.spec.ts`: matriz visible al entrar (default hoy+generado), descargar PDF detalle, verificar archivo non-empty.
- **Output:** test verde.

---

## Bloque 10 — Reconciliación SQL (T38-T40)

### T38. Reconciliación Q1-Q3
- **Input:** SQL Developer.
- **Acción:** ejecutar contra Oracle queries del clon vs legacy (perf antes/después, rep_ventas_producto vs Rfat321, rep_facturas_despachadas vs Rfat227). Comparar totales/conteos.
- **Output:** capturas en `backend/docs/captures/fat/recon-q1-q3/`.

### T39. Reconciliación Q4-Q5
- **Input:** SQL Developer.
- **Acción:** rep_ventas_linea vs Rfat333; cuadre_caja_detalle vs Rfat237.
- **Output:** capturas + notas discrepancias (si las hay).

### T40. Reconciliación Q6-Q7
- **Input:** SQL Developer.
- **Acción:** list_lista_precio_detalle vs Ffat128; list_facturas con ncf_dgi vs Rfat302 (verificar B01/B02/B14/B15 correctamente compuestos).
- **Output:** capturas + cierre §3.2 DoD.

---

## Bloque 11 — Wrap-up (T41-T43)

### T41. Limpieza housekeeping
- **Input:** archivos `.bak` listados en spec §1.1.
- **Acción:** eliminar 10 `.bak` + `grep -rE "TODO|FIXME|XXX" backend/apps/fat/ frontend/src/features/fat/` → 0 matches (meta-spec §3.4). Commit `chore(fat): cleanup .bak files + TODO sweep`.
- **Output:** repo limpio.

### T42. Actualizar dashboard de avance + memoria MCP
- **Input:** `backend/docs/superpowers/00_roadmap_avance.md` (crear si no existe siguiendo meta-spec §10).
- **Acción:** marcar FAT con DoD 3.1-3.4 ✅. Crear memoria MCP nueva `fat/cierre-gaps-2026-05-30-completo` resumiendo trabajo. Marcar `fat/gaps-pendientes-post-backlog` como obsoleta.
- **Output:** dashboard actualizado + memoria MCP creada.

### T43. Push + PR
- **Input:** rama `fat-cierre-gaps-2026-05-30` con todos los commits + los 12 previos del backlog.
- **Acción:** `git push origin fat-cierre-gaps-2026-05-30 && gh pr create --title "fat: cierre gaps post-backlog 2026-05-30" --body "<resumen tareas + evidencia reconciliación SQL>"`.
- **Output:** PR URL retornada al usuario.

**Checkpoint final.** Revisar PR, verificar DoD §3.1-3.4 cumplido.

---

## Notas de ejecución

- **Cada deploy a VM:** `python -c "import ast; ast.parse(open('<archivo>').read())"` antes de `pscp` (meta-spec §4.4).
- **Cada cambio frontend:** `pnpm typecheck` antes de subir.
- **No paralelizar bloques 1-7** (dependencias en repo/views compartido). Bloque 8 puede paralelizar T28/T30/T32 si se dispatchan agentes (cada uno en archivo distinto).
- **Si T19 (migración SQL G3c) se descarta:** saltar T20-T21 y documentar en spec §6.
- **Riesgo identificado:** la migración `STATUS` en TFAT_TIPO_PAGO es la única operación DDL — requiere aprobación explícita del usuario antes de ejecutar.
