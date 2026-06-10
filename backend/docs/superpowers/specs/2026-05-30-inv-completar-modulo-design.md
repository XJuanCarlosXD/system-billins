# Spec módulo INV (Inventario) — completar paridad y reportes Rinv70x

- **Fecha:** 2026-05-30
- **Estado:** Borrador para revisión
- **Meta-spec referenciado:** `2026-05-30-sigaft-meta-validacion-modulos-design.md`
- **Alcance:** Cerrar gaps de paridad funcional + datos del módulo INV contra legacy SIGAF (82 forms / 82 reports). Incorpora el spec previo aprobado de Rinv70x (Rotación ABC, Sin Movimiento, Bajo Reorden) y lo extiende con limpieza UI + entry-points + reconciliación SQL.
- **NO está en alcance:** rediseño visual de pantallas ya `ready`, reescritura de endpoints PDF ya entregados (`/documentos/.../pdf`, `/reportes/existencia/pdf`, `/reportes/movimientos/pdf`, `/reportes/kardex/pdf`). Tampoco SMT (mercancía en tránsito) ni MPR (producción) — son módulos hermanos accedidos vía sub-menú.

---

## 1. Inventario actual del módulo

### 1.1. Backend (VM 10.0.0.99 → `facturation-system/backend/apps/legacy/`)

| Archivo | Líneas | Estado |
|---|---|---|
| `inv_views.py` | 1199 | Vivo (62 endpoints aprox.) |
| `repositories/inv_repo.py` | 1676 | Vivo |
| `inv_urls.py` | activo | 41 paths registrados |

**Endpoints PDF ya implementados** (URLs definitivas):
- `/api/inv/documentos/<tipo>/<no>/pdf/` — impresión documento INV (Rinv229/220/etc. legacy).
- `/api/inv/reportes/existencia/pdf/` — equivalente al "Reporte Existencia Por Almacén".
- `/api/inv/reportes/movimientos/pdf/` — listado de movimientos genérico.
- `/api/inv/reportes/kardex/pdf/` — kardex valorizado.
- `/api/inv/reportes/valorizacion/pdf/` — valuación inventario por almacén.
- `/api/inv/cierre/entrada-diario/pdf/` — Impresión Entrada de Diario (Finv401.fmx).

**Endpoint Rinv304 (movimientos por producto)** ya existente:
- `GET /api/inv/movimientos/<no_produ>/?no_cia=&punto=&almacen=&desde=&hasta=` → `{ no_produ, items[…balance corrido…], totales }`. Aplica normalización CPE/empaque correcta (memoria `inv/movimientos-endpoint-rinv304`). Smoke validado: producto 00000001 alm 01 totales 2.000, alm 06 1244 — match exacto con el PDF Rinv304 legacy.

**Otros endpoints relevantes**:
- CRUD completo de catálogos: productos, grupos, líneas, sublíneas, unidades, referencias-empaque, grupos-contables, almacenes, tipos-docu, compañías, puntos.
- Existencia (`/existencia/`, `/existencia/<no_produ>/`), kardex, valorización, consulta documentos, detalle documento.
- Conteo físico (pendiente, cargar, aplicar, descartar, histórico).

### 1.2. Frontend (`facturation-system/frontend/src/features/inv/`)

`features/inv/index.tsx` declara **64 acciones** organizadas en 6 secciones (configuracion, procesos, consultas, reportes, conteo-fisico, cierre). Estado actual: **38 `ready` / 26 `planned`**.

Pantallas `ready` relevantes para este spec: Compañías, Puntos de Trabajo, Almacenes, Tipos Documentos, Productos, Asignar Prod. a Cia/Almacén, Modificar Costo, Mínimo/Máximo, Estantes/Tramos, Entrada Compras/Mercancía, Salida Mercancía, Transferencia, Devolución Suplidores/Ventas, Reversar Doc, Impresión Documentos, Consulta Documentos, Existencia Producto, Existencia Grupo, Reporte Existencia (PDF), Reporte Movimientos (PDF), Líneas/Sublíneas, todo Conteo Físico, Entrada Diario, Generar Asiento, Cierre Mensual.

Pantallas `planned` (no implementadas, hoy son stubs): Acceso de Usuarios, Marca de Producto, Crear desde Excel, Activar/Desactivar Prod. Almacén, Ensamblar Productos, Envases Retornables, Entrada Producción, Despacho Cotización, Salida Ensamblados, Listado Recepción Resumen/Detalle, Listado Doc con Asiento, Asignar Series, Costo en Rango Fecha, Productos Ensamblados (PDF), Productos con Empaque (PDF), Etiquetas Intermec/Monarch/Barras/Documentos, Imprimir Etiquetas, Devoluciones por Vendedor, Auxiliar de Inventario, Consumo por Proyecto, Cantidad Reservada.

### 1.3. Bugs/issues conocidos

1. **`inv_repo.list_existencias` mezcla `EXIST_ACTUAL` vs movimientos** (CASE por `CTRL_EXIST_MIN/MAX`). La memoria `inv/existencia-empaque-normalization` advierte: NO usar `TINV_EPRODUCTO.exist_actual` (snapshot stale; dio 188 cuando debía ser 2). Lo correcto es **siempre** sumar `TINV_MOVIMIENTO` con normalización CPE/empaque. La rama "controlado/no-controlado" se eliminó en commits `77f86ea`→`c1b898a` para `get_existencia_producto`, pero `list_existencias` (listado, no detalle) sigue con la lógica vieja → **inconsistencia entre Productos→popover-existencia y el reporte general**.
2. **`inv_repo.list_movimientos`** (listado genérico paginado) NO aplica normalización CPE/empaque, por lo que cuando se invoca desde `Reporte Movimientos (PDF)` los números pueden diferir del Rinv304 por producto. Riesgo de bug 188-vs-2 si el usuario filtra por un producto con empaques mixtos.
3. **Rinv301-328 falsos en el UI** (mencionado por usuario): hay acciones del menú etiquetadas como "Rinv30X" en `features/inv/index.tsx` que no existen como reporte real en el legacy. Hay que confirmarlas contra la memoria técnica y descartarlas o re-mapearlas.
4. **Sin entry-point del modal de movimientos en la vista Productos** del módulo: el modal "Movimientos (Rinv304)" hoy solo se abre desde el popover de existencia en `buscar-producto-modal.tsx` dentro de FAT. La vista `inv/productos.tsx` debería tener su propio botón "Ver movimientos".
5. **Sin reportes Rinv705/706/707** (Rotación ABC, Sin Movimiento, Bajo Reorden) que el legacy ofrece como reportes operativos para compras.

---

## 2. Gap con el legacy 82 forms / 82 reports

### 2.1. Opciones de menú no implementadas (de la memoria local, 86 opciones detectadas)

Bloque relevante a cerrar **en este sprint**:
- **Consultas/Reportes faltantes**: Costo Producto en Rango de Fecha (`Finv504.fmx`), Productos Ensamblados (`Rinv303.rep`), Productos con su Empaque (`Rinv305.rep`), Consumo por Proyecto, Devoluciones de Ventas por Vendedor, Cantidad Reservada, Auxiliar de Inventario.
- **Reportes operativos de compras** (Rinv705/706/707 — no están en la memoria local porque no se genera `.rep` con ese nombre exacto; se infieren del flujo legacy de compras/reposición. Ver §3.3 para detalle de queries).
- **Procesos faltantes**: Ensamblar Productos (`Finv115.fmx`), Entrada de Producción (`Finv210.fmx`), Despacho Orden Producción, Salida de Prod. Ensamblados (`Finv215.fmx`), Digitar Series de Productos a Documentos, Asignar Prod. a Cia y Almacén (está `ready` pero verificar — la legacy es `Finv113.fmx`).
- **Configuración faltante**: Crear Productos desde Excel (`Finv125.fmx`), Activar/Desactivar Productos (`Finv119.fmx`), Mantenimiento Marca de Productos, Digitar Envases Retornables (`Finv118.fmx`), Acceso de Usuarios (`Finv601.fmx` + `Finv103.fmx`).

### 2.2. Reportes legacy explícitos (memoria § "Reportes generados por el modulo")

| Reporte legacy | Estado clon |
|---|---|
| `Rinv_etiqueta.rep` (Imprimir Etiquetas) | planned |
| `Rinv_Monarch9416.rep` (Monarch 9416) | planned |
| `Rinv305.rep` (Productos con Empaque) | planned |
| `Rinv303.rep` (Productos Ensamblados) | planned |

Adicionalmente, en la memoria del clon (`features/inv/index.tsx`) hay acciones nombradas como reportes "Rinv30X" no presentes en el legacy real (la memoria local solo lista 4 reportes `.rep`). Estas **deben auditarse**: si no existen en `O:\gpsc\Inv\Reportes\`, se descartan o se re-etiquetan.

### 2.3. Reglas DGI / contables faltantes

Inventario no es fiscalmente sensible (no emite NCF), pero:
- **Cierre mensual / asiento contable** (`Finv402.fmx` + `Finv401.fmx`) deben generar el mismo número total que el legacy. La paridad SQL aquí es crítica (alimenta CNT).
- **Razón social** en headers PDF: ya cumplido vía `apps/legacy/pdf_helpers.py:build_pdf_report`. Verificar que NO aparezca "Empresa 01".

---

## 3. Trabajo a realizar

### 3.1. Vistas / pantallas frontend

| # | Vista | Archivo | Acción |
|---|---|---|---|
| V1 | `productos.tsx` (lista) | `features/inv/productos.tsx` | Añadir botón "Ver movimientos (Rinv304)" por fila → abre `MovimientosProductoModal` existente (reutilizar de FAT `buscar-producto-modal.tsx`). |
| V2 | `existencia-producto.tsx` | mismo | Añadir botón "Ver movimientos" en detalle. |
| V3 | `reportes-rotacion-abc.tsx` | **nueva** | Form de filtros (rango fechas, almacén, % cortes A/B/C) + tabla preview + botón "Generar PDF". Llama `/api/inv/reportes/rotacion-abc/pdf/`. |
| V4 | `reportes-sin-movimiento.tsx` | **nueva** | Form de filtros (fecha corte, días sin movimiento N, almacén, grupo) + tabla preview + PDF. Llama `/api/inv/reportes/sin-movimiento/pdf/`. |
| V5 | `reportes-bajo-reorden.tsx` | **nueva** | Form de filtros (almacén, grupo, "incluir punto reorden propuesto S/N") + tabla preview + PDF. Llama `/api/inv/reportes/bajo-reorden/pdf/`. |
| V6 | `inv/index.tsx` (menú) | mismo | Limpiar acciones "Rinv301-328" falsas (ver §3.5). Agregar acciones reales: `rotacion-abc`, `sin-movimiento`, `bajo-reorden`, `costo-rango-fecha`, `productos-ensamblados-pdf`, `productos-empaque-pdf` con `status: 'ready'` o `'planned'` según se entrega esta iteración. |
| V7 | `costo-rango-fecha.tsx` | **nueva** | Equivalente `Finv504.fmx`. Filtros producto/almacén/rango → tabla con costo inicial/final/promedio/variación. |
| V8 | `consulta-documentos.tsx` | existente | Ya `ready`. Verificar que ítems linkeen al detalle/PDF correctamente. |

**Restricciones UX** (del meta-spec §4.1/4.2): shadcn/ui, Tailwind, TanStack Router/Query obligatorios. Skeletons de carga, validación inline en formularios de filtros, `staleTime` 30s para previews. NO usar `fetch` directo.

### 3.2. Endpoints backend

Repo: `apps/legacy/repositories/inv_repo.py` (extender, no duplicar). Vistas: `apps/legacy/inv_views.py`. URLs en `apps/legacy/inv_urls.py`.

| # | Endpoint | Repo func | Notas |
|---|---|---|---|
| E1 | `GET /api/inv/reportes/rotacion-abc/?…` | `rotacion_abc(no_cia, punto, almacen, desde, hasta, corte_a, corte_b)` | Devuelve filas `{no_produ, descri, cantidad_movida_normalizada, costo_total, % acumulado, clasificacion}`. |
| E2 | `GET /api/inv/reportes/rotacion-abc/pdf/?…` | usa E1 + `build_pdf_report` | Header con filtros, totales globales A/B/C. |
| E3 | `GET /api/inv/reportes/sin-movimiento/?…` | `sin_movimiento(no_cia, punto, almacen, fecha_corte, dias)` | `{no_produ, descri, exist_actual, ultimo_movi_fecha, dias_inactivo, costo_total_inmovilizado}`. |
| E4 | `GET /api/inv/reportes/sin-movimiento/pdf/?…` | usa E3 + `build_pdf_report` | Totales: # productos, costo total inmovilizado. |
| E5 | `GET /api/inv/reportes/bajo-reorden/?…` | `bajo_reorden(no_cia, punto, almacen, grupo)` | `{no_produ, descri, exist_actual, exist_minima, exist_maxima, faltante, propuesta_compra}`. |
| E6 | `GET /api/inv/reportes/bajo-reorden/pdf/?…` | usa E5 + `build_pdf_report` | Agrupado por almacén/grupo. |
| E7 | `GET /api/inv/reportes/costo-rango-fecha/?…` | `costo_rango_fecha(no_cia, no_produ, almacen, desde, hasta)` | Reproduce `Finv504.fmx`. |
| E8 | `GET /api/inv/reportes/costo-rango-fecha/pdf/?…` | usa E7 + `build_pdf_report` | |
| E9 | **Fix** `inv_repo.list_existencias` | mismo | Migrar a la misma lógica de `get_existencia_producto`: SIEMPRE sumar `TINV_MOVIMIENTO` con normalización CPE/empaque. Eliminar la rama `EXIST_ACTUAL`. |
| E10 | **Fix** `inv_repo.list_movimientos` | mismo | Aplicar la misma normalización CPE/empaque que `get_movimientos_producto`. |

**Aviso de performance (memoria `fat/search-productos-pagination-pattern`)**: las queries de E1/E3/E5 agregan sobre `TINV_MOVIMIENTO`. NO meterlas como subquery en una query paginada con LEFT JOIN. Patrón obligatorio: (1) query base que filtra/lista `TINV_PRODUCTO` o `TINV_EPRODUCTO` paginada, (2) segundo fetch a `TINV_MOVIMIENTO` con `WHERE no_produ IN (:p0..:pN)` sobre la página. Si el reporte se ejecuta sin paginar (PDF completo) está OK aplicar GROUP BY directo, pero **acotar siempre por fecha y almacén** para evitar cuelgues >90s.

### 3.3. Reportes PDF — queries inferidas

**Convención común a las 3 queries**: todas usan `TINV_MOVIMIENTO m` con la normalización empaque/CPE confirmada (memoria `inv/existencia-empaque-normalization`):

```sql
CASE WHEN m.empaque = emp.empaque THEN NVL(m.cantidad,0)
     WHEN NVL(emp.cpe,0) > 0       THEN NVL(m.cantidad,0) / emp.cpe
     ELSE NVL(m.cantidad,0) END AS qty_normalizada
```

con `JOIN INV.TINV_EMPAQUE emp ON emp.no_produ = m.no_produ AND emp.para_reporte = 'S'`.

#### R705 — Rotación ABC
Lógica: por producto, suma `qty_normalizada` de movimientos tipo 'S' (salida) en el rango. Acumulado descendente sobre el costo total movido (`qty × m.costo`). Clasifica A si `% acumulado <= corte_a` (def 80), B si `<= corte_b` (def 95), C el resto.

```sql
SELECT no_produ, descri, qty_salida, costo_total,
       SUM(costo_total) OVER (ORDER BY costo_total DESC) /
       NULLIF(SUM(costo_total) OVER (), 0) AS pct_acumulado
FROM (
  SELECT m.no_produ, p.descri,
         SUM({normalizacion}) qty_salida,
         SUM({normalizacion} * NVL(m.costo,0)) costo_total
  FROM INV.TINV_MOVIMIENTO m
  JOIN INV.TINV_EMPAQUE emp ON emp.no_produ=m.no_produ AND emp.para_reporte='S'
  JOIN INV.TINV_PRODUCTO p ON p.no_produ=m.no_produ
  WHERE m.no_cia=:1 AND NVL(m.st_anulado,'N')='N' AND m.tipo_movi='S'
    AND m.fecha BETWEEN TO_DATE(:2,'YYYY-MM-DD') AND TO_DATE(:3,'YYYY-MM-DD')
    AND (m.punto=:4 OR :4 IS NULL) AND (m.almacen=:5 OR :5 IS NULL)
  GROUP BY m.no_produ, p.descri
)
ORDER BY costo_total DESC
```

#### R706 — Sin Movimiento (N días)
Existencia actual > 0 y MAX(fecha movimiento) más viejo que `(fecha_corte - dias)`.

```sql
SELECT u.no_produ, p.descri,
       NVL(ep.exist_actual, mov.exist_normalizada) exist_actual,
       NVL(ep.costo_actual, 0) costo,
       TRUNC(:fecha_corte) - TRUNC(mov.ultima_fecha) dias_inactivo,
       NVL(ep.exist_actual, mov.exist_normalizada) * NVL(ep.costo_actual,0) costo_inmovilizado
FROM (universo_eproducto_union_movimiento) u
LEFT JOIN INV.TINV_EPRODUCTO ep ON ep…
LEFT JOIN (
  SELECT m.no_cia, m.punto, m.almacen, m.no_produ,
         MAX(m.fecha) ultima_fecha,
         SUM(CASE WHEN m.tipo_movi='E' THEN {norm} WHEN m.tipo_movi='S' THEN -{norm} ELSE 0 END) exist_normalizada
  FROM INV.TINV_MOVIMIENTO m
  JOIN INV.TINV_EMPAQUE emp ON emp.no_produ=m.no_produ AND emp.para_reporte='S'
  WHERE m.no_cia=:1 AND NVL(m.st_anulado,'N')='N'
  GROUP BY m.no_cia, m.punto, m.almacen, m.no_produ
) mov ON …
JOIN INV.TINV_PRODUCTO p ON p.no_produ = u.no_produ
WHERE NVL(ep.exist_actual, mov.exist_normalizada) > 0
  AND (TRUNC(:fecha_corte) - TRUNC(mov.ultima_fecha)) >= :dias
ORDER BY dias_inactivo DESC, costo_inmovilizado DESC
```

> **Decisión:** este reporte SÍ puede usar `EXIST_ACTUAL` como primario (con fallback al sum normalizado de movimientos) porque su intención es "qué hay parado", no validar el saldo real; pero el campo `costo_inmovilizado` debe usar la misma fuente. Para listados de control de stock estricto (R707) usaremos solo movimientos.

#### R707 — Bajo Reorden
Existencia normalizada (sumando movimientos) por debajo de `EXIST_MINIMA`.

```sql
SELECT u.no_produ, p.descri, u.almacen, a.descri almacen_desc,
       ep.exist_minima, ep.exist_maxima,
       NVL(mov.existencia, 0) exist_actual_real,
       GREATEST(NVL(ep.exist_maxima,0) - NVL(mov.existencia,0), 0) propuesta_compra
FROM (universo TINV_EPRODUCTO) u
JOIN INV.TINV_ALMACEN a ON …
JOIN INV.TINV_PRODUCTO p ON p.no_produ=u.no_produ
JOIN INV.TINV_EPRODUCTO ep ON …
LEFT JOIN (
  SELECT m.no_cia, m.punto, m.almacen, m.no_produ,
         SUM(CASE WHEN m.tipo_movi='E' THEN {norm} WHEN m.tipo_movi='S' THEN -{norm} ELSE 0 END) existencia
  FROM INV.TINV_MOVIMIENTO m
  JOIN INV.TINV_EMPAQUE emp ON emp.no_produ=m.no_produ AND emp.para_reporte='S'
  WHERE m.no_cia=:1 AND NVL(m.st_anulado,'N')='N'
  GROUP BY m.no_cia, m.punto, m.almacen, m.no_produ
) mov ON …
WHERE NVL(ep.exist_minima,0) > 0
  AND NVL(mov.existencia,0) < NVL(ep.exist_minima,0)
  AND (u.almacen=:2 OR :2 IS NULL)
  AND (p.grupo_produ=:3 OR :3 IS NULL)
ORDER BY u.almacen, p.descri
```

### 3.4. PDFs (`apps/legacy/pdf_helpers.py:build_pdf_report`)

Cada reporte aporta su configuración (columnas, totales, header_extra). Mantener header DGI estándar (logo + razón social `TCNT_COMPANIAS` real, fecha emisión, usuario, filtros aplicados). No introducir helper duplicado.

### 3.5. Bugs a corregir

| Bug | Detalle | Fix |
|---|---|---|
| B1 | Acciones `Rinv301-328` fantasma en `features/inv/index.tsx` | Auditar contra `O:\gpsc\Inv\Reportes\` (vía memoria local § "Reportes generados por el modulo" — solo Rinv303, Rinv305, Rinv_etiqueta, Rinv_Monarch9416 son reales). Las que no aparezcan se eliminan o re-etiquetan a la opción real (ej. "Movimientos por Producto" si era un alias de Rinv304). |
| B2 | `list_existencias` con `EXIST_ACTUAL` | Migrar a sum(`TINV_MOVIMIENTO`) normalizado. Smoke obligatorio: producto 00000001 alm 01=2, alm 06=1244 (match con `inv/existencia-empaque-normalization`). |
| B3 | `list_movimientos` sin normalización CPE | Aplicar misma normalización que `get_movimientos_producto`. |
| B4 | Sin entry-point movimientos en vista Productos INV | Botón "Ver movimientos" por fila → modal existente. |
| B5 | TODO/FIXME en código INV | `grep -rE "TODO\|FIXME\|XXX" backend/apps/legacy/inv*.py frontend/src/features/inv/` → 0 matches antes del cierre (DoD §3.4). |

---

## 4. Flujos críticos para E2E (Playwright)

Cada flujo vive en `frontend/e2e/inv/<flujo>.spec.ts`. Verificaciones obligatorias: HTTP 2xx, `console.error` vacío, captura final en `backend/docs/captures/inv/<flujo>.png`.

| # | Flujo | Pasos |
|---|---|---|
| F1 | **Consultar existencia con normalización CPE** | Navegar a `inv → existencia-producto`, buscar producto 00000001, verificar alm 01 = 2 unidades, alm 06 = 1244, fuente "movimientos". |
| F2 | **Registrar movimiento** (entrada mercancía simple) | `inv → entrada-mercancia`, llenar tipo_docu, no_docu, producto, cantidad/empaque, guardar → confirmar HTTP 200 y fila visible en `consulta-documentos`. |
| F3 | **Generar Rinv304 desde Productos** | `inv → productos`, clic "Ver movimientos" en fila producto 00000001, abrir modal, verificar balance corrido final = 2.000, exportar CSV. |
| F4 | **Generar Rinv705 (Rotación ABC)** | `inv → rotacion-abc`, filtrar rango mes anterior, almacén 01, generar PDF. Verificar columnas A/B/C presentes, totales coherentes. |
| F5 | **Generar Rinv707 (Bajo Reorden)** | `inv → bajo-reorden`, almacén 01, generar PDF. Verificar que productos con `exist_actual < exist_minima` aparecen y `propuesta_compra >= exist_maxima - exist_actual`. |

---

## 5. Queries a reconciliar con legacy (DoD §3.2)

| Query clon | Reporte legacy equivalente | Validación |
|---|---|---|
| `get_movimientos_producto` (Rinv304) | `Finv504.fmx` PDF "Mov. Producto" | Ya validado: producto 00000001 → 54 items, balance final 2.000. Documentar en PR como evidencia. |
| `list_existencias` (post-fix) | "Consulta Existencia Por Almacén" (Finv502/503) | Producto 00000001 alm 01=2, alm 06=1244 (memoria `inv/existencia-empaque-normalization`). |
| `rotacion_abc` (R705) | Reporte ABC legacy (form Finv502+ con corte). Si no hay `.rep` exacto, comparar contra suma manual sobre TINV_MOVIMIENTO del mismo rango. | Total costo movido = total del kardex en el mismo rango. |
| `sin_movimiento` (R706) | Reporte stock parado del legacy. Validar conteo de productos contra cuenta directa: `SELECT COUNT(*) FROM TINV_EPRODUCTO WHERE exist_actual>0 AND NOT EXISTS (SELECT 1 FROM TINV_MOVIMIENTO m WHERE m.no_produ=...AND fecha>=:hoy-:dias)`. | Diff = 0 filas. |
| `bajo_reorden` (R707) | Reporte reorden legacy. Comparar contra `SELECT COUNT(*) FROM TINV_EPRODUCTO ep WHERE exist_actual < exist_minima` ajustado por normalización. | Diff 0 filas (post-ajuste empaque). |
| `costo_rango_fecha` (Finv504) | `Finv504.fmx` | Producto único, costo inicial = primer `m.costo`, costo final = último `m.costo` del rango. |

---

## 6. Opciones legacy descartadas con justificación

| Opción legacy | Estado | Justificación |
|---|---|---|
| `Rinv_Monarch9416.rep` (Etiquetas Monarch 9416) | descartado para este sprint | Hardware específico (impresora Monarch) obsoleto. Se mantiene como `planned` y se evalúa según demanda real del cliente. |
| Etiquetas Intermec | descartado igual | Mismo motivo. |
| Devoluciones de Ventas por Vendedor | mantener `planned`, no este sprint | Métrica de comisiones de vendedor — pertenece más a reportes FAT que INV. Cubrirla en spec FAT siguiente. |
| Consumo por Proyecto | mantener `planned` | Requiere integración con CNT proyectos; fuera del scope INV puro. |
| Cantidad Reservada | mantener `planned` | Depende de SMT (mercancía en tránsito) — módulo hermano. |
| Crear Productos desde Excel (`Finv125.fmx`) | mantener `planned` | Funcionalidad de carga masiva; ya hay creación 1-a-1 y conteo físico desde Excel cubre el caso operativo. Reabrir si el usuario lo prioriza. |
| Despacho Orden Producción / Salida Ensamblados | mantener `planned` | Pertenecen al flujo MPR (Producción), no al menú principal INV. |

---

## 7. Estimación

- **Vistas frontend nuevas:** 4 (rotacion-abc, sin-movimiento, bajo-reorden, costo-rango-fecha) + edición de `productos.tsx` + limpieza `inv/index.tsx`.
- **Endpoints backend nuevos:** 8 (4 JSON + 4 PDF) + 2 fixes (`list_existencias`, `list_movimientos`).
- **Tareas atómicas del plan hijo:** ~30.
- **Esfuerzo agregado estimado:** 16–22 horas de implementación + 4–6 horas reconciliación SQL + E2E. Total ~24 horas.
- **Riesgos:**
  1. Performance del agregado de TINV_MOVIMIENTO sin paginar — mitigar con bind de almacén+rango fecha obligatorio + `EXPLAIN PLAN` antes de subir.
  2. Diferencias de redondeo en `qty_normalizada` cuando `cpe` no es entero exacto — usar `ROUND(qty/cpe, 4)` y comparar con tolerancia `0.001` en pruebas.
  3. Migración de `list_existencias` puede romper consumers que esperaban `EXIST_ACTUAL` (vistas que ya están `ready`). Auditar usos antes del fix (E9) y ajustar.

---

## 8. Memorias relacionadas

- `inv/existencia-empaque-normalization` (REGLA CRÍTICA)
- `inv/movimientos-endpoint-rinv304` (estado actual Rinv304)
- `fat/search-productos-pagination-pattern` (performance Oracle 11g)
- `inv/backend-arquitectura-y-crud-almacenes-2026-05-25` (estructura backend INV)
- `sigaft/module-memory-full-20260530/inventario/part-005`, `part-009` (memoria técnica chunked)
- Memoria local: `memorias_por_modulo/memoria_inventario.md` (86 opciones, 129 tablas, 4 reportes inferidos)
- Meta-spec maestro: `2026-05-30-sigaft-meta-validacion-modulos-design.md`
