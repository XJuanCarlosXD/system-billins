# Plan módulo INV — completar paridad + Rinv70x

- **Spec referenciado:** `specs/2026-05-30-inv-completar-modulo-design.md`
- **Meta-spec:** `specs/2026-05-30-sigaft-meta-validacion-modulos-design.md`
- **Estado:** Listo para ejecución
- **VM:** 10.0.0.99 (fuente de verdad). Deploy vía `pscp`.

## Convenciones

- Cada tarea ≤ 5 minutos efectivos. Validar tras cada `pscp` con `python -c "import ast; ast.parse(open('archivo.py').read())"`.
- Antes de tocar código: leer `inv_repo.py` y `inv_views.py` con `Read` (no `cat`) si trabajás en local; si trabajás directo en VM, usar `nano` o `vim`.
- Cada commit referencia ID de tarea: `inv: T07 fix list_existencias usar TINV_MOVIMIENTO normalizado`.
- Validar smoke con producto 00000001 alm 01=2, alm 06=1244 después de tocar existencias.

---

## Fase 0 — Preparación (T01–T03)

- **T01.** Crear rama de trabajo o asegurar workspace limpio en la VM: `cd facturation-system && git status` (debe estar limpio). Si hay basura, mover a `*.bak`.
- **T02.** Verificar que los endpoints PDF existentes responden 200: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/api/inv/reportes/existencia/pdf/?no_cia=01` y similares para movimientos, kardex, valorizacion, cierre/entrada-diario. Documentar baseline en notas.
- **T03.** Auditar UI `features/inv/index.tsx`: listar todas las acciones cuyo `legacy` contenga "Rinv3xx" y validar contra `memorias_por_modulo/memoria_inventario.md` § "Reportes generados por el modulo" (solo Rinv303, Rinv305, Rinv_etiqueta, Rinv_Monarch9416 son `.rep` reales). Producir lista de acciones a renombrar/eliminar.

## Fase 1 — Fixes de paridad de existencia (T04–T08)

- **T04.** En `inv_repo.list_existencias`: copiar a una rama experimental antes de tocar (`list_existencias_old`). Lectura previa para identificar callers (grep `list_existencias` en `inv_views.py` y `frontend/src/features/inv/`).
- **T05.** Reescribir `list_existencias` para SIEMPRE usar `TINV_MOVIMIENTO` con normalización empaque/CPE (igual que `get_existencia_producto`). Eliminar la rama `ctrl_exist_min/max`. Mantener parámetros `solo_con_existencia`, `search`, `grupo`, etc.
- **T06.** Smoke local: `curl 'http://localhost:8000/api/inv/existencia/?no_cia=01&no_produ=00000001'` → verificar alm 01=2.0, alm 06=1244. Si difiere, revisar `JOIN INV.TINV_EMPAQUE … para_reporte='S'`.
- **T07.** Reescribir `inv_repo.list_movimientos` añadiendo `JOIN INV.TINV_EMPAQUE emp ON emp.no_produ=m.no_produ AND emp.para_reporte='S'` y normalizando `cantidad` igual que `get_movimientos_producto`. Mantener filtros y ORDER BY.
- **T08.** Smoke `/api/inv/movimientos/?no_cia=01&no_produ=00000001&almacen=01` → confirmar cantidades en escala "para_reporte" (cajas, no fundas).

## Fase 2 — Endpoints reportes Rinv70x (T09–T18)

- **T09.** En `inv_repo.py` agregar `rotacion_abc(no_cia, punto, almacen, desde, hasta, corte_a=80, corte_b=95)`. SQL con SUM normalizada por producto, WINDOW function `SUM() OVER (ORDER BY costo_total DESC)` para acumulado. Devolver lista con `clasificacion` ('A'|'B'|'C').
- **T10.** Validar SQL en SQL*Plus / SQL Developer con rango pequeño (1 día, alm 01). Verificar pct_acumulado monótono creciente 0→100.
- **T11.** Agregar view en `inv_views.py`: `inv_reporte_rotacion_abc(request)` → JSON paginado (limit 500). `inv_reporte_rotacion_abc_pdf(request)` usa `pdf_helpers.build_pdf_report` con header DGI estándar + columnas: `no_produ, descri, qty, costo_total, % acum, A/B/C`. Totales globales A/B/C.
- **T12.** URL en `inv_urls.py`: `path('reportes/rotacion-abc/', inv_views.inv_reporte_rotacion_abc)` y `path('reportes/rotacion-abc/pdf/', inv_views.inv_reporte_rotacion_abc_pdf)`.
- **T13.** En `inv_repo.py` agregar `sin_movimiento(no_cia, punto, almacen, fecha_corte, dias)`. SQL con MAX(fecha) por producto y filtro `(:fecha_corte - MAX(fecha)) >= :dias`. Incluir `costo_inmovilizado`.
- **T14.** Agregar view `inv_reporte_sin_movimiento` + `inv_reporte_sin_movimiento_pdf`. PDF: columnas `no_produ, descri, exist_actual, ultima_fecha, dias_inactivo, costo`. Totales: # productos, costo total inmovilizado.
- **T15.** URLs `reportes/sin-movimiento/` y `reportes/sin-movimiento/pdf/`.
- **T16.** En `inv_repo.py` agregar `bajo_reorden(no_cia, punto, almacen, grupo)`. SQL con existencia normalizada (SUM TINV_MOVIMIENTO) y filtro `existencia < exist_minima`. Calcular `propuesta_compra = GREATEST(exist_maxima - existencia, 0)`.
- **T17.** Agregar view `inv_reporte_bajo_reorden` + `inv_reporte_bajo_reorden_pdf`. PDF agrupado por almacén; columnas `no_produ, descri, exist_actual, minima, maxima, faltante, propuesta`.
- **T18.** URLs `reportes/bajo-reorden/` y `reportes/bajo-reorden/pdf/`.

## Fase 3 — Endpoint Finv504 costo en rango (T19–T20)

- **T19.** En `inv_repo.py` agregar `costo_rango_fecha(no_cia, no_produ, almacen, desde, hasta)`: SQL sobre `TINV_MOVIMIENTO` ordenado por fecha, devolver primer/último costo, promedio ponderado por qty normalizada, mín/máx.
- **T20.** View `inv_reporte_costo_rango_fecha` + `_pdf` + URLs `reportes/costo-rango-fecha/` y `reportes/costo-rango-fecha/pdf/`.

## Fase 4 — Frontend (T21–T28)

- **T21.** Crear `frontend/src/features/inv/rotacion-abc.tsx`. Form con filtros (fechas, almacén, % cortes), `useQuery` paginada al endpoint JSON, tabla con `Table` shadcn, botón "Descargar PDF" abre `/api/inv/reportes/rotacion-abc/pdf/?…` en nueva pestaña.
- **T22.** Crear `frontend/src/features/inv/sin-movimiento.tsx` con patrón análogo. `staleTime: 60_000`.
- **T23.** Crear `frontend/src/features/inv/bajo-reorden.tsx`. Agregar acción rápida "Generar requisición ODC" si se decide en sprint siguiente (mantener `disabled` con tooltip por ahora).
- **T24.** Crear `frontend/src/features/inv/costo-rango-fecha.tsx`. Form con producto-autocomplete (reutilizar `buscar-producto-modal.tsx` de FAT) + rango + almacén.
- **T25.** Editar `frontend/src/features/inv/productos.tsx`: agregar columna `Acciones` con botón `Ver movimientos` que abre `MovimientosProductoModal` existente (importar desde `features/fat/modals/movimientos-producto-modal.tsx` o moverla a `features/shared/` si conviene reutilizar).
- **T26.** Editar `frontend/src/features/inv/index.tsx`:
  - Agregar 4 acciones nuevas en sección `reportes`: `rotacion-abc`, `sin-movimiento`, `bajo-reorden`, `costo-rango-fecha`, todas `status: 'ready'`.
  - Eliminar/renombrar acciones `Rinv301-328` falsas según lista de T03.
  - Verificar que cada acción `ready` tenga su componente importado al tope.
- **T27.** `pnpm typecheck` en el frontend. Si hay errores de tipo en el `ViewKey` union, ampliarlo. Cero errores antes de seguir.
- **T28.** Smoke manual en navegador: cargar `/inv`, abrir cada nueva pantalla, validar que se renderiza sin warnings de React.

## Fase 5 — Reconciliación SQL + evidencia (T29–T31)

- **T29.** Reconciliación R705: ejecutar `rotacion_abc` para `no_cia='01', almacen='01', desde='2026-04-01', hasta='2026-04-30'`. Comparar `SUM(qty_salida * costo)` con `SELECT SUM(cantidad*costo) FROM TINV_MOVIMIENTO WHERE tipo_movi='S' AND st_anulado='N' AND fecha BETWEEN ... AND ... AND almacen='01'` (sin normalizar — confirmar que la normalización solo afecta cuando el reporte muestra `qty` por unidad, no el total monetario). Anotar en `backend/docs/reconciliacion/inv-r705.md`.
- **T30.** Reconciliación R706: `SELECT COUNT(*) FROM (rotacion_abc.qty=0 + exist_actual>0 + dias>=N)` vs query directa. Documentar en `backend/docs/reconciliacion/inv-r706.md`.
- **T31.** Reconciliación R707: ejecutar `bajo_reorden` y comparar contra `SELECT COUNT(*) FROM TINV_EPRODUCTO WHERE exist_actual<exist_minima` (línea base sin normalizar). Documentar diferencia esperada por empaque normalizado. `backend/docs/reconciliacion/inv-r707.md`.

## Fase 6 — Playwright E2E (T32–T34)

- **T32.** `frontend/e2e/inv/existencia-cpe.spec.ts` — flujo F1 del spec. Validar alm 01=2, alm 06=1244 en UI.
- **T33.** `frontend/e2e/inv/rinv304-movimientos.spec.ts` — flujo F3. Abrir modal desde productos.tsx, verificar balance final 2.000.
- **T34.** `frontend/e2e/inv/rinv70x.spec.ts` — flujos F4 y F5 combinados: generar PDF de rotacion-abc + bajo-reorden, validar `response.status() === 200` y `content-type: application/pdf`.

## Fase 7 — Cierre DoD (T35–T37)

- **T35.** `grep -rE "TODO|FIXME|XXX" backend/apps/legacy/inv*.py frontend/src/features/inv/` → debe ser 0. Mover pendientes a issues nombrados.
- **T36.** Actualizar `backend/docs/superpowers/00_roadmap_avance.md` marcando INV con `DoD 3.1=✅, 3.2=✅, 3.3=✅, 3.4=✅, Cerrado=✅`. Si algún criterio queda en 🟡, documentar el porqué.
- **T37.** Deploy final a VM con `pscp` de los archivos cambiados. Verificar logs del backend (`systemctl status sigaft-backend` o equivalente) sin errores. Reportar al usuario con resumen de cambios.

---

**Total tareas:** 37 atómicas distribuidas en 7 fases.

**Orden de ejecución obligatorio:** Fase 0 → 1 → 2 → 3 → 4 (frontend usa endpoints) → 5 → 6 → 7. NO paralelizar Fase 1 con Fase 4: el frontend depende del fix de `list_existencias` para no mostrar números mixtos.
