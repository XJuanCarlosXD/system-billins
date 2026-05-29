# INV — Sprint Rinv70x: limpiar Existencia + 3 nuevos reportes

**Fecha:** 2026-05-29
**Autor:** Claude + JCABREU (brainstorming)
**Estado:** Aprobado, pendiente de plan de implementación
**Tickets relacionados:** BUG-INV-2, BUG-INV-3, BUG-INV-4 (ver `pdf_audit/REPORTE_GAPS_INV.md`)

## Contexto

Durante la auditoría de PDFs del módulo INV se descubrió que:

1. La UI ofrece 9 "variantes" del reporte de Existencia (Rinv301..Rinv328 etiquetadas Detallado / No Detallado / Histórico / Consolidado / Con Ubicación / Comparar Min-Max / Por Serie / Consumo / Por Fecha Últ. E/S).
2. El backend nunca leyó el parámetro `modo` — siempre devolvía el mismo PDF (BUG-INV-2).
3. **Más grave:** según el catálogo legacy real (`backend/docs/33_inv_plan_detallado.md`), los códigos `Rinv301..Rinv328` corresponden a reportes de **Toma Física** (planilla de conteo, diferencias, acta, etc.), no a variantes de un reporte de Existencia. El reporte de "Existencia actual por almacén y producto" en el legado es **Rinv701**, y la familia completa de reportes operativos es **Rinv701..Rinv709**.
4. La UI también envía `con_existencia=1` pero el backend espera `solo_con_existencia` (BUG-INV-4).

Este sprint corrige la nomenclatura de la UI y agrega 3 reportes operativos de alto valor (Rotación / Sin Movimiento / Bajo Reorden) que el legado tiene como Rinv705, Rinv706 y Rinv707.

## Objetivos

- Quitar las 9 variantes falsas del formulario de Existencia y dejar un único botón "Generar PDF (Rinv701)".
- Cerrar BUG-INV-4 (aceptar tanto `con_existencia=` como `solo_con_existencia=`).
- Implementar 3 nuevos endpoints PDF: Rinv705 Rotación/ABC, Rinv706 Sin Movimiento, Rinv707 Bajo Reorden.
- Exponer los nuevos reportes en el menú lateral y el router de la sección INV → Reportes.

## Out of scope

- Rinv702 Movimientos, Rinv703 Kardex, Rinv704 Valorización (ya implementados y arreglados con BUG-INV-1 el 2026-05-29).
- Rinv708 Entradas Consolidadas, Rinv709 Salidas Consolidadas (siguiente sprint).
- Variante JSON paginada en pantalla (Approach C descartado — Approach A: sólo PDF).
- Toma Física Rinv301..Rinv328 (alcance del módulo de Toma Física, no de este sprint).
- Implementar configuración por empresa para "días sin movimiento" (param `dias` en URL es suficiente).

## Arquitectura

### Approach elegido: A — Endpoints separados por reporte

Sigue el patrón ya establecido por `inv_reporte_existencia_pdf`, `inv_reporte_movimientos_pdf`, `inv_reporte_kardex_pdf`, `inv_reporte_valorizacion_pdf`. Cada reporte = 1 URL, 1 view, 1 función repo, 1 entrada en sidebar, 1 componente React.

### Componentes y responsabilidades

| Componente | Archivo | Responsabilidad |
|---|---|---|
| URL routing | `backend/apps/legacy/inv_urls.py` | 3 nuevas líneas `path('reportes/...')` |
| Views | `backend/apps/legacy/inv_views.py` | 3 nuevas funciones `inv_reporte_XXX_pdf` + 2 líneas en `inv_reporte_existencia_pdf` para BUG-INV-4 |
| Repositorio SQL | `backend/apps/legacy/repositories/inv_repo.py` | 3 nuevas funciones `list_rotacion_abc`, `list_sin_movimiento`, `list_bajo_reorden` |
| Helper PDF (reuso) | `inv_views.py:_build_pdf_report` | Sin cambios — ya arreglado por BUG-INV-1 |
| Form components | `frontend/src/features/inv/reportes-parametros.tsx` | Limpiar `ReporteExistencia` (quitar `EXISTENCIA_MODOS`); agregar `ReporteRotacionAbc`, `ReporteSinMovimiento`, `ReporteBajoReorden` |
| Sidebar | `frontend/src/components/layout/data/sidebar-data.ts` | 3 nuevas entradas bajo INV → Reportes |
| Router | `frontend/src/features/inv/index.tsx` | 3 nuevos `case` en el switch de `view` |

## Especificaciones por reporte

### Rinv705 — Rotación / Análisis ABC

**URL:** `GET /api/inv/reportes/rotacion-abc/pdf/?no_cia=01&punto=&almacen=&dias=365`

**Lógica de negocio:**
- Ranking de productos por **valor de salidas** (`SUM(monto_neto)`) en los últimos `dias` días (default 365).
- Filtros: `tipo_movi='S'` (salidas) AND `NVL(st_anulado,'N')='N'`.
- Clase ABC (umbrales clásicos de Pareto). El "% acumulado" se computa **después** de incluir el monto del producto actual (los primeros pueden quedar ya en A aunque su monto individual sea grande):
  - A: `pct_acumulado <= 80`
  - B: `80 < pct_acumulado <= 95`
  - C: `pct_acumulado > 95`
  - Productos sin ventas en el período no aparecen en el reporte (filtro de movimientos).

**SQL (esquema):**
```sql
SELECT p.no_produ, p.descri,
       SUM(m.cantidad)    unidades_vendidas,
       SUM(m.monto_neto)  monto_ventas
  FROM INV.TINV_MOVIMIENTO m
  JOIN INV.TINV_PRODUCTO   p ON p.no_produ = m.no_produ
 WHERE m.no_cia = :1
   AND m.tipo_movi = 'S'
   AND NVL(m.st_anulado,'N') = 'N'
   AND m.fecha >= TRUNC(SYSDATE) - :dias
   [+ punto, + almacen condicionales]
 GROUP BY p.no_produ, p.descri
 ORDER BY SUM(m.monto_neto) DESC
```

Post-procesado en Python:
- `total = sum(monto_ventas)`
- Iterar ordenado descendentemente; acumular `% individual = monto/total`; `% acumulado` running.
- `clase = 'A' if acum <= 80 else 'B' if acum <= 95 else 'C'`.

**Columnas PDF:** `NO_PRODU | DESCRIPCION | UNIDADES_VENDIDAS | MONTO_VENTAS | PCT_INDIVIDUAL | PCT_ACUMULADO | CLASE_ABC`

**Título:** `Rotación ABC — últimos {dias} días — Empresa {no_cia}`

### Rinv706 — Productos Sin Movimiento

**URL:** `GET /api/inv/reportes/sin-movimiento/pdf/?no_cia=01&punto=&almacen=&dias=90`

**Lógica de negocio:**
- Productos con existencia actual > 0 cuyo último movimiento es anterior a `SYSDATE - dias`, o que nunca tuvieron movimiento.
- Incluye valorización del stock inmovilizado.

**SQL (esquema):**
```sql
SELECT e.almacen, e.no_produ, p.descri,
       e.existencia, e.costo_prom,
       ROUND(e.existencia * e.costo_prom, 2) valor_inmovilizado,
       um.ultimo_movimiento,
       CASE WHEN um.ultimo_movimiento IS NULL THEN NULL
            ELSE TRUNC(SYSDATE - um.ultimo_movimiento) END AS dias_sin_mov
  FROM (SELECT ... existencia query base ...) e
  JOIN INV.TINV_PRODUCTO p ON p.no_produ = e.no_produ
  LEFT JOIN (
        SELECT no_cia, almacen, no_produ, MAX(fecha) ultimo_movimiento
          FROM INV.TINV_MOVIMIENTO
         WHERE no_cia = :1 AND NVL(st_anulado,'N') = 'N'
         GROUP BY no_cia, almacen, no_produ
       ) um ON um.no_cia=e.no_cia AND um.almacen=e.almacen AND um.no_produ=e.no_produ
 WHERE e.existencia > 0
   AND (um.ultimo_movimiento IS NULL OR um.ultimo_movimiento < TRUNC(SYSDATE) - :dias)
 ORDER BY valor_inmovilizado DESC
```

**Columnas PDF:** `ALMACEN | NO_PRODU | DESCRIPCION | EXISTENCIA | COSTO_PROM | VALOR_INMOVILIZADO | ULTIMO_MOVIMIENTO | DIAS_SIN_MOV`

**Título:** `Productos Sin Movimiento — más de {dias} días — Empresa {no_cia}`

### Rinv707 — Productos Bajo Punto de Reorden

**URL:** `GET /api/inv/reportes/reorden/pdf/?no_cia=01&punto=&almacen=`

**Lógica de negocio:**
- Productos cuya `EXISTENCIA < EXIST_MINIMA` (con `EXIST_MINIMA > 0` para excluir productos sin política de reorden).
- Sugerencia de compra = `EXIST_MAXIMA - EXISTENCIA`.

**SQL (esquema):**
```sql
SELECT ep.almacen, ep.no_produ, p.descri,
       ep.exist_actual    existencia,
       ep.exist_minima,
       ep.exist_maxima,
       GREATEST(ep.exist_maxima - ep.exist_actual, 0) sugerencia_compra,
       ep.costo_actual    costo_prom,
       ROUND(GREATEST(ep.exist_maxima - ep.exist_actual, 0) * ep.costo_actual, 2) monto_compra_sugerido
  FROM INV.TINV_EPRODUCTO ep
  JOIN INV.TINV_PRODUCTO  p ON p.no_produ = ep.no_produ
 WHERE ep.no_cia = :1
   AND NVL(ep.exist_minima, 0) > 0
   AND NVL(ep.exist_actual, 0) < ep.exist_minima
   [+ punto, + almacen condicionales]
 ORDER BY ep.almacen, monto_compra_sugerido DESC
```

**Columnas PDF:** `ALMACEN | NO_PRODU | DESCRIPCION | EXISTENCIA | EXIST_MINIMA | EXIST_MAXIMA | SUGERENCIA_COMPRA | COSTO_PROM | MONTO_COMPRA_SUGERIDO`

**Título:** `Productos Bajo Punto de Reorden — Empresa {no_cia}`

## Cambios de cosecha (housekeeping)

### Razón social en lugar de código en títulos PDF (feedback usuario 2026-05-29)

Hoy todos los reportes INV se titulan `"... — Empresa {no_cia}"` que renderiza literal `"Empresa 01"`. Es código, no nombre. El usuario espera ver la razón social (ej. `"ABREGONZA, SRL"`).

Fix transversal en `inv_views.py`:
1. Al inicio de cada view PDF: `cia = inv_repo.get_compania(no_cia)` → `nombre_cia = (cia or {}).get('descripcion') or no_cia`.
2. Cambiar título de cada reporte: `f"... — {nombre_cia}"`.
3. Aplica a las 4 funciones PDF actuales (existencia, movimientos, kardex, valorizacion, entrada-diario) + las 3 nuevas (rotacion-abc, sin-movimiento, reorden) = 8 títulos en total.

Costo: ~15 líneas adicionales repartidas. Cero impacto a queries. Si `get_compania` devuelve None (cia inexistente), fallback al código numérico.



### BUG-INV-4: aceptar `con_existencia` además de `solo_con_existencia`

En `inv_views.py:inv_reporte_existencia_pdf` (después del bloque actual de parsing):
```python
solo_con_existencia = (
    request.GET.get('solo_con_existencia',
                    request.GET.get('con_existencia', ''))
    .lower() in {'1','true','yes','y','s'}
)
```
Pasar `solo_con_existencia=solo_con_existencia` a `inv_repo.list_existencias()`.

### Limpieza UI: quitar 9 variantes falsas de Existencia

En `frontend/src/features/inv/reportes-parametros.tsx`:
- Eliminar la constante `EXISTENCIA_MODOS` y el type `ExistenciaModo`.
- En `ReporteExistencia`: eliminar `const [modo, setModo] = useState(...)` y el bloque `<RadioGroup>` de modos.
- En `generate()` eliminar `qs.set('modo', modo)`.
- En el subtítulo del card cambiar "Existencia (multi-reporte PDF)" → "Existencia (Rinv701)".

## Manejo de errores

Cada nueva view sigue el patrón establecido:
- `try ... reportlab probe import` → 500 con mensaje si falta.
- `try ... query + build pdf` → 500 con `str(e)` en caso de excepción.
- `_build_pdf_report` con `rows == []` ya muestra "Sin datos." (verificado en kardex.pdf de la auditoría).
- Validación específica:
  - Rotación ABC y Sin Movimiento: si `dias < 1` → JsonResponse 400 `{"error": "Parámetro 'dias' debe ser >= 1"}`.

## Plan de pruebas

### Unitario / smoke

Para cada nuevo endpoint, verificación con `curl` autenticado:
1. HTTP 200 con `dias` válido.
2. HTTP 400 con `dias=0` o `dias=-5` (sólo Rinv705, Rinv706).
3. Tamaño del PDF > 5 KB (no es respuesta vacía).
4. Filtros opcionales (`almacen`, `punto`) reducen tamaño esperablemente.

### Visual / Playwright

Para cada reporte:
1. Login → navegar al item del menú lateral → abrir formulario.
2. Llenar filtros → presionar "Generar Reporte PDF".
3. Verificar tab nueva con PDF visible y sin error.
4. Descargar PDF y leerlo con Read nativo.

### Validación de negocio (datos reales — empresa 01 ABREGONZA)

- **Rinv705:** SUM(PCT_INDIVIDUAL) ≈ 100%. Conteo: A ≈ 20% productos / 80% valor; C ≈ mayoría productos / 5% valor.
- **Rinv706 con `dias=90`:** verificar que productos con stock que no se ha vendido aparecen y los activos no aparecen.
- **Rinv707:** verificar al menos un producto bajo mínimo con sugerencia de compra > 0.

## Plan de deploy

Patrón validado en sesión 2026-05-29 (fix BUG-INV-1):

1. `pscp inv_views.py jcabreu@10.0.0.99:facturation-system/backend/apps/legacy/`
2. `pscp inv_repo.py jcabreu@10.0.0.99:facturation-system/backend/apps/legacy/repositories/`
3. `pscp inv_urls.py jcabreu@10.0.0.99:facturation-system/backend/apps/legacy/`
4. Django hot reload — esperar ~5 s, smoke test backend (`curl /api/inv/reportes/rotacion-abc/pdf/?no_cia=01`).
5. `pscp` archivos frontend (`reportes-parametros.tsx`, `sidebar-data.ts`, `index.tsx`).
6. Vite HMR — refrescar navegador, smoke test UI completo.

Sin restart de contenedores.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Query Rinv705 muy lenta en empresas con muchos movimientos | Agregar `LIMIT 500` en post-procesado Python (igual que reportes existentes); si la query Oracle es lenta, evaluar índice en `TINV_MOVIMIENTO(no_cia, tipo_movi, fecha)` en sprint siguiente |
| Empresas sin `EXIST_MINIMA` mantenido → Rinv707 vacío | Documentado en spec: el reporte sólo lista productos con `EXIST_MINIMA > 0`. PDF vacío con "Sin datos." es el comportamiento correcto |
| `EXIST_MAXIMA < EXIST_ACTUAL` (mínimo bien definido pero máximo no) → sugerencia negativa | `GREATEST(diff, 0)` evita números negativos |
| Frontend rompe ESLint / TS al eliminar `EXISTENCIA_MODOS` (uso huérfano) | Buscar con grep antes de eliminar; quitar imports también |

## Métricas de éxito

- Los 3 nuevos endpoints devuelven HTTP 200 con datos reales en empresa 01.
- El formulario de Existencia muestra 1 sólo botón "Generar PDF" sin radio buttons.
- `con_existencia=1` ya no es ignorado.
- El menú lateral INV → Reportes lista al menos: Existencia, Movimientos, Líneas/Sublíneas, Rotación ABC, Sin Movimiento, Bajo Reorden.
