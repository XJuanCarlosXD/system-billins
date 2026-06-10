# Spec módulo FAT — Cierre de gaps post-backlog

- **Fecha:** 2026-05-30
- **Estado:** Borrador listo para ejecución
- **Meta-spec referenciado:** `2026-05-30-sigaft-meta-validacion-modulos-design.md`
- **Sprint previo:** `2026-05-29-fat-backlog-fixes.md` (12 commits locales, push pendiente). Este spec **NO** rehace Tasks A-I del backlog; solo cubre los 7 gaps documentados en MCP `fat/gaps-pendientes-post-backlog`.

---

## 1. Inventario actual del módulo

### 1.1. Vistas implementadas (rutas TanStack Router por archivo)

Bajo `frontend/src/features/fat/`:

| Ruta UI | Componente |
|---|---|
| `/fat` | `index.tsx` (landing del módulo) |
| `/fat/facturas` | `fat-facturas.tsx` |
| `/fat/facturas/nueva` | `fat-nueva-factura.tsx` |
| `/fat/facturas/anular` | `fat-anular-factura.tsx` |
| `/fat/conduces` | `conduces.tsx` |
| `/fat/conduces/nuevo` | `fat-nuevo-conduce.tsx` |
| `/fat/notas` | `notas.tsx` |
| `/fat/cuadre-caja` | `cuadre-caja.tsx` |
| `/fat/cierre-mensual` | `cierre-mensual.tsx` |
| `/fat/generar-asientos` | `generar-asientos.tsx` |
| `/fat/companias` | `companias.tsx` |
| `/fat/puntos` | `puntos.tsx` |
| `/fat/condiciones-pago` | `condiciones-pago.tsx` |
| `/fat/tipos-pago` | `tipos-pago.tsx` |
| `/fat/tdocu` | `tdocu.tsx` |
| `/fat/listas-precio` | `listas-precio.tsx` |
| `/fat/transportistas` | `transportistas.tsx` |
| `/fat/rep-ventas` | `rep-ventas.tsx` |
| `/fat/rep-607` | `rep-607.tsx` |
| `/fat/rep-ncf-nulos` | `rep-ncf-nulos.tsx` |
| `/fat/rep-ventas-vendedor` | `fat-rep-ventas-vendedor.tsx` |
| `/fat/rep-ventas-cliente` | `fat-rep-ventas-cliente.tsx` |
| `/fat/rep-analitica` | `fat-rep-analitica.tsx` |

Archivos `.bak` presentes (a limpiar al final): `companias.tsx.bak`, `facturas.tsx.bak`, `fat-companias.tsx.bak`, `fat-facturas.tsx.bak`, `fat-notas.tsx.bak`, `fat-transportistas.tsx.bak`, `ncf-fat.tsx.bak`, `notas.tsx.bak`, `tdocu.tsx.bak`, `transportistas.tsx.bak`.

### 1.2. Endpoints backend (`apps/fat/urls.py` + `urls_legacy`)

- Catálogos GET/POST/PATCH: `/api/fat/ncf/`, `/api/fat/documents/`, `/api/fat/condiciones-pago/`, `/api/fat/companias/`, `/api/fat/puntos/`, `/api/fat/tipos-pago/`, `/api/fat/listas-precio/`, `/api/fat/transportistas/`, `/api/fat/notas/`, `/api/fat/vendedores/`, `/api/fat/clientes/`.
- Productos/empaques: `/api/fat/productos/`, `/api/fat/producto-empaques/`.
- Transaccionales: `/api/fat/facturas/`, `/api/fat/facturas/anular/`, `/api/fat/facturas/<tipo>/<no_factura>/`, `/api/fat/conduces/`, `/api/fat/conduces/<tipo>/<no_conduce>/`.
- NCF/secuencias: `/api/fat/proximo-ncf/`, `/api/fat/ncf-usado/`, `/api/fat/proximo-no-factura/`.
- Cuadre/cierre/asientos: `/api/fat/cuadre-caja/`, `/api/fat/cierres/`, `/api/fat/generar-asientos/`.
- Reportes (datos): `/api/fat/rep-ventas/`, `/api/fat/rep-607/`, `/api/fat/rep-ncf-nulos/`, `/api/fat/rep-ventas-vendedor/`, `/api/fat/rep-ventas-cliente/`, `/api/fat/rep-analitica/`.
- PDFs: `/api/fat/documentos/<tipo>/<no_factura>/pdf/`, `/api/fat/reportes/listado/pdf/`.
- Dashboard: `/api/dashboard/ventas-mes/`.

### 1.3. Bugs cerrados en el backlog 2026-05-29 (NO repetir)

12 commits locales (`fat/backlog-2026-05-29-completo`): NCF DGI por empresa, derivación NCF desde cliente, filtros/paginación/total_linea en reportes, dashboard chart, cuadre-caja render+matriz NCF×forma_pago, imprimir lista PDF, conduces detalle/edición/NCF, eliminar `/fat/ncf` duplicado, CRUD condiciones-pago/tipos-pago/companias, existencia normalizada por empaque (commits `77f86ea`/`c1b898a`), card cliente con NCF inline.

---

## 2. Gap con el legacy

### 2.1. Gaps abiertos (memoria `fat/gaps-pendientes-post-backlog`)

| # | Gap | Severidad | Origen |
|---|-----|-----------|--------|
| G1 | `/api/fat/productos/` cuelga >90s post empaque-JOIN, bloquea nueva-factura UX | CRÍTICA | Perf Oracle 11g |
| G2 | Conduce edit mode: Guardar deshabilitado — falta `fat_repo.update_conduce` | ALTA | Funcional |
| G3a | Puntos de Trabajo sin endpoint upsert (`POST /api/fat/puntos/`) | MEDIA | Task I diferido |
| G3b | Listas de Precio: solo lectura; falta UI/endpoint cabecera+detalle CRUD | MEDIA | Task I diferido |
| G3c | Tipos de Pago: no se puede desactivar (TFAT_TIPO_PAGO sin columna status) | MEDIA | Task I diferido |
| G4 | `FatCondicionesPagoView.post` sin `_check_fat_access` (catálogo cross-empresa) | BAJA-decisión | Auditoría |
| G5 | Reporte movimientos producto sin entry-point en vista Inventario/Productos | BAJA | UX |

### 2.2. Reportes legacy aún no cubiertos (prioritarios)

De `memoria_facturacion.md` § Reportes:

| Reporte legacy | `.rep` | Propósito | Equivalente clon |
|---|---|---|---|
| Análisis de ventas por producto | `Rfat321.rep` (Ffat307) | Detalle de ventas filtrado por producto/periodo | NUEVO `/fat/rep-ventas-producto` |
| Relación facturas despachadas | `Rfat227.rep` | Listado facturas con conduce, fecha despacho | NUEVO `/fat/rep-facturas-despachadas` |
| Resumen ventas mensual por línea | `Rfat333.rep` (Ffat310) | Agrupado por línea/sub-línea de producto | NUEVO `/fat/rep-ventas-linea` |
| Movimientos producto (Rinv304-like) | endpoint `/api/inv/movimientos/<no_produ>/` ya existe — falta **entry-point en vista Productos FAT** (G5) | — | Botón en buscar-producto-modal + nueva ruta `/inv/productos/<no_produ>/movimientos` |
| Rfat237 (cobros/movimientos diarios) | `Rfat237.rep` | Detalle día por NCF/forma pago — alimenta cuadre-caja | Ampliar `/api/fat/cuadre-caja/` con `?detalle=true` o nuevo `/fat/cuadre-caja/detalle/pdf` |

`Rfat201`, `Rfat203`, `Rfat225`, `Rfat302`, `Rfat319`, `Rfat328` se descartan en este sprint (ver §6).

### 2.3. Reglas DGI / contables pendientes

Todas las reglas DGI ya están aplicadas tras el backlog (NCF DGI compuesto, RNC, razón social real, lookups, IDs internos ocultos). **No hay gap DGI nuevo** — solo verificación E2E.

---

## 3. Trabajo a realizar

### 3.1. Vistas/pantallas

| ID | Ruta | Componente | Tipo | Notas |
|---|---|---|---|---|
| V1 | `/fat/puntos` (existente) | `puntos.tsx` | UPDATE | Agregar formulario crear/editar punto, columna activo togglable |
| V2 | `/fat/tipos-pago` (existente) | `tipos-pago.tsx` | UPDATE | Agregar toggle status (con migración SQL en backend) |
| V3 | `/fat/listas-precio` (existente) | `listas-precio.tsx` | REFACTOR | Vista master-detail: cabecera CRUD + tabla detalle con buscador-producto inline, edición precio en línea |
| V4 | `/fat/rep-ventas-producto` (NUEVA) | `fat-rep-ventas-producto.tsx` | CREATE | Filtros producto/desde/hasta + tabla + exportPdf |
| V5 | `/fat/rep-facturas-despachadas` (NUEVA) | `fat-rep-facturas-despachadas.tsx` | CREATE | Filtros desde/hasta + tabla NCF/cliente/transportista |
| V6 | `/fat/rep-ventas-linea` (NUEVA) | `fat-rep-ventas-linea.tsx` | CREATE | Filtros desde/hasta + agrupado linea/sub-linea |
| V7 | `/inv/productos/<no_produ>/movimientos` (NUEVA, módulo INV pero entry-point desde FAT) | `inv-rep-movimientos.tsx` | CREATE entry-point | El endpoint ya existe — solo ruta + UI con tabla Rinv304-like + botón "Movimientos" en `/fat/productos` o popover de existencia |
| V8 | `/fat/cuadre-caja` (existente) | `cuadre-caja.tsx` | UPDATE | Agregar acción "Imprimir detalle diario" (Rfat237) → PDF con desglose por NCF×forma_pago×factura |

**Bugs UI a corregir:**

- B1: `fat-nueva-factura.tsx` debe permanecer responsive cuando `/api/fat/productos/` tarda — agregar timeout 30s + skeleton + retry inline. Aplica además del fix G1 backend.
- B2: limpiar 10 archivos `.bak` legacy listados en §1.1 (commit cleanup al final).
- B3: `tdocu.tsx` actualmente solo lista — agregar CRUD POST/PATCH si se descubre que el legacy lo permite (consultar memoria `memoria_facturacion.md` § documentos).

### 3.2. Endpoints backend

| ID | Endpoint | Verbo | Vista | Repo | Notas |
|---|---|---|---|---|---|
| E1 | `/api/fat/productos/` | GET | `FatProductosView` (existe) | `fat_repo.search_productos` | **Fix PERF G1**: mover `LEFT JOIN TINV_EMPAQUE WHERE POR_DEFECTO='S'` fuera de la subquery base; aplicar mismo patrón "post-paginación bulk fetch" usado para existencia. EXPLAIN PLAN obligatorio antes/después. |
| E2 | `/api/fat/conduces/<tipo>/<no_conduce>/` | PATCH (nuevo) | `FatConduceDetailView` | NUEVO `fat_repo.update_conduce` | **G2**: clonar `create_conduce` adaptando a UPDATE encabezado + DELETE+INSERT detalle, transacción. Validar `ST_AUTORIZADO`/`ESTADO` (no se permite editar autorizado). |
| E3 | `/api/fat/puntos/` | POST/PATCH | `FatPuntosView` | NUEVO `fat_repo.upsert_punto_fat` | **G3a**: upsert sobre FAT.TFAT_PUNTO. Campos: no_cia, punto, descripcion, max_descuento, activo, ano_proceso, mes_proceso, mes_cierre. Guard `_check_fat_access` + len(punto)<=2. |
| E4a | `/api/fat/listas-precio/` | POST/PATCH | `FatListasPrecioView` | NUEVO `fat_repo.upsert_tipo_precio` | **G3b cabecera**: upsert TFAT_TIPO_PRECIO (no_cia, no_lista, descripcion, activa, tipo_moneda). |
| E4b | `/api/fat/listas-precio/<no_lista>/items/` | POST/PATCH/DELETE | NUEVO `FatListaPrecioItemView` | NUEVO `fat_repo.upsert_lista_precio_item`/`delete_lista_precio_item` | **G3b detalle**: upsert/delete TFAT_LISTA_PRECIO por (no_cia, punto, no_lista, no_produ). Precio en unidad base (regla CPE-multiplier). |
| E5 | `/api/fat/tipos-pago/` | POST (status) | `FatTiposPagoView` | NUEVO `fat_repo.set_tipo_pago_status` | **G3c**: añadir columna `STATUS VARCHAR2(1) DEFAULT 'A'` a `FAT.TFAT_TIPO_PAGO` (script de migración Oracle 11g aparte). Toggle 'A'/'I' desde UI. Si la migración no se autoriza, alternativa: usar `DESCRIPCION` con prefijo `[INACTIVO]` (descarte explícito). |
| E6 | `/api/fat/condiciones-pago/` | POST/PATCH | `FatCondicionesPagoView` | (sin cambio repo) | **G4**: decisión adoptada → es catálogo cross-empresa; se mantiene **staff-only**. Agregar `permission_classes = [IsAuthenticated, IsAdminUser]` + nota docstring. |
| E7 | `/api/fat/rep-ventas-producto/` | GET | NUEVA `FatRepVentasProductoView` | `fat_repo.rep_ventas_producto` (existe, 727) | Exponer; añadir endpoint PDF asociado `fat_rep_ventas_producto_pdf` en `views_print.py`. |
| E8 | `/api/fat/rep-facturas-despachadas/` | GET | NUEVA `FatRepFacturasDespachadasView` | NUEVO `fat_repo.rep_facturas_despachadas` | Query: TFAT_FACTURA JOIN TFAT_CONDUCE con fecha_despacho. Mapeo legacy `Rfat227.rep`. |
| E9 | `/api/fat/rep-ventas-linea/` | GET | NUEVA `FatRepVentasLineaView` | NUEVO `fat_repo.rep_ventas_linea` | Query agrupada por INV.TINV_LINEA / TINV_SUB_LINEA. Mapeo legacy `Rfat333.rep`. |
| E10 | `/api/fat/cuadre-caja/detalle/pdf/` | GET | NUEVA `fat_cuadre_caja_detalle_pdf` (views_print) | reuso `cuadre_caja_por_ncf_forma_pago` + `get_cuadre_caja_detalle` | PDF Rfat237: matriz + desglose factura-por-factura. |

### 3.3. Reportes PDF

Todos derivan de `apps/legacy/pdf_helpers.build_pdf_report` (chasis común del meta-spec §5):

| ID | Endpoint PDF | Origen |
|---|---|---|
| P1 | `/api/fat/rep-ventas-producto/pdf/` | E7 |
| P2 | `/api/fat/rep-facturas-despachadas/pdf/` | E8 |
| P3 | `/api/fat/rep-ventas-linea/pdf/` | E9 |
| P4 | `/api/fat/cuadre-caja/detalle/pdf/` | E10 |

Cada PDF respeta header (razón social real de `CNT.TCNT_COMPANIAS`, fecha emisión, usuario, filtros activos), body (lookups código→descripción, NCF DGI completo, sin IDs internos), footer (totales + página X/Y).

### 3.4. Bugs a corregir (tabla resumen)

| ID | Bug | Fix |
|---|---|---|
| BG1 | `/api/fat/productos/` cuelga >90s (G1) | Refactor `search_productos` — extraer empaque-JOIN del SQL base, hacer bulk fetch post-paginación (mismo patrón de existencia) |
| BG2 | Conduce edit Guardar deshabilitado (G2) | Implementar PATCH endpoint + `update_conduce` repo |
| BG3 | Toggle activo en Puntos/Tipos Pago no funciona (G3a/G3c) | Endpoints + migración SQL `STATUS` en TFAT_TIPO_PAGO |
| BG4 | Listas de Precio solo lectura (G3b) | Refactor master-detail UI + endpoints CRUD detalle |
| BG5 | Condiciones de Pago accesibles sin staff (G4) | `IsAdminUser` |
| BG6 | Movimientos producto sin entry-point (G5) | Ruta + botón "Movimientos" en buscar-producto-modal y listado productos |
| BG7 | 10 archivos `.bak` muertos (housekeeping) | Eliminar y commit cleanup |

---

## 4. Flujos críticos para E2E (5 flujos Playwright)

Cada flujo respeta meta-spec §3.3 y §7. Tests en `frontend/e2e/fat/`.

### F1 — Crear factura completa (`fat/crear-factura.spec.ts`)
- Precondición: cliente activo con NCF disponible, producto con existencia.
- Pasos: `/fat/facturas/nueva` → seleccionar cliente → ver NCF DGI inline (regla NCF compuesto) → agregar 2 productos vía `buscar-producto-modal` (debe responder <500ms tras fix G1) → seleccionar forma pago → guardar.
- Esperado: HTTP 201 en `POST /api/fat/facturas/`, factura con estado `A`, NCF consumido, sin `console.error`.

### F2 — Anular factura y liberar NCF (`fat/anular-factura.spec.ts`)
- Precondición: factura `ESTADO='A'`.
- Pasos: `/fat/facturas/anular` → buscar factura → ingresar motivo → toggle "Liberar NCF" → confirmar.
- Esperado: factura pasa a estado anulado (legacy semántica `fat/estado-factura-semantica`), NCF queda disponible para reuso, asiento contable no se duplica.

### F3 — Cuadre de caja + detalle Rfat237 PDF (`fat/cuadre-caja.spec.ts`)
- Precondición: ≥2 facturas autorizadas con distintos NCF/formas de pago hoy.
- Pasos: `/fat/cuadre-caja` (default hoy+generado=true) → ver matriz NCF×forma_pago → click "Imprimir detalle diario" → descargar PDF.
- Esperado: PDF tiene header + matriz pivot + tabla factura-por-factura, totales coinciden con resumen UI.

### F4 — Editar conduce (`fat/editar-conduce.spec.ts`) — gap G2
- Precondición: conduce con `ST_AUTORIZADO!='S'`.
- Pasos: `/fat/conduces` → abrir conduce → modo edición → modificar línea → Guardar (debe estar habilitado tras fix G2).
- Esperado: HTTP 200 `PATCH /api/fat/conduces/<tipo>/<no>/`, conduce reflejado en lista.

### F5 — CRUD Lista de Precio cabecera+detalle (`fat/listas-precio.spec.ts`) — gap G3b
- Pasos: `/fat/listas-precio` → crear lista nueva → agregar 3 productos con precio → editar precio de uno → eliminar otro → verificar lista detalle.
- Esperado: HTTP 201/200/204 según operación; precios persistidos en `TFAT_TIPO_PRECIO` + `TFAT_LISTA_PRECIO`.

---

## 5. Queries a reconciliar con legacy

Pares clon-vs-legacy a validar contra Oracle (procedimiento meta-spec §6):

| # | Query del clon | Reporte legacy |
|---|---|---|
| Q1 | `fat_repo.search_productos` post-fix G1 (nuevo plan) | N/A — solo perf, validar mismo total/items que pre-fix |
| Q2 | `fat_repo.rep_ventas_producto` (línea 727) | `Rfat321.rep` |
| Q3 | NUEVA `fat_repo.rep_facturas_despachadas` | `Rfat227.rep` |
| Q4 | NUEVA `fat_repo.rep_ventas_linea` | `Rfat333.rep` |
| Q5 | `fat_repo.cuadre_caja_por_ncf_forma_pago` (671) + `get_cuadre_caja_detalle` (560) — usado en E10 | `Rfat237.rep` |
| Q6 | `fat_repo.list_lista_precio_detalle` post-CRUD G3b | Ffat128 (Crear Lista de Precio Provisional) |
| Q7 | `fat_repo.list_facturas` con `_compose_ncf_dgi` | `Rfat302.rep` (Listado de Facturas) — verificación de paridad NCF DGI |

Cada query se ejecuta en SQL Developer contra cia=01 con rango de fechas idéntico al usado en el `.rep`. Evidencia: screenshots lado-a-lado en PR (`backend/docs/captures/fat/`).

---

## 6. Opciones legacy descartadas con justificación

| Opción legacy | Justificación |
|---|---|
| `Rfat201.rep` (Listado simple ventas día) | Cubierto por `/api/fat/rep-ventas/` + filtros desde/hasta. Sin diferencia funcional. |
| `Rfat203.rep` (Listado por vendedor) | Cubierto por `/api/fat/rep-ventas-vendedor/`. |
| `Rfat225.rep` (Listado por cliente) | Cubierto por `/api/fat/rep-ventas-cliente/`. |
| `Rfat302.rep` (Listado de facturas) | Cubierto por `/api/fat/facturas/` + PDF `fat_lista_facturas_pdf` (commit `3835e09`). Solo reconciliación NCF DGI pendiente (Q7). |
| `Rfat319.rep` (Análisis mensual) | Cubierto por `/api/fat/rep-analitica/`. |
| `Rfat328.rep` (Resumen ventas vendedor anual) | Subset de `rep-ventas-vendedor` con `desde/hasta` anual. Sin reporte nuevo. |
| Migración `STATUS` en `TFAT_TIPO_PAGO` (G3c) | Si el DBA no autoriza ALTER en Oracle 11g productivo, se descarta y se documenta como limitación; el toggle en UI queda deshabilitado con tooltip explicativo. |
| Edición de NCF post-emisión | El legacy lo permite vía Ffat601-similar; el clon mantiene política estricta NCF-DGI inmutable (regla `project-sigaft-ncf-schema`). |

---

## 7. Estimación

| Bloque | Tareas plan | Esfuerzo estimado |
|---|---|---|
| Diagnóstico + perf G1 | 4 | 1.5 h |
| Conduce update G2 | 4 | 1.5 h |
| Puntos/Tipos-Pago/Listas-Precio G3a-c | 9 | 4 h |
| Auditoría G4 (condiciones-pago) | 2 | 0.5 h |
| Movimientos entry-point G5 | 3 | 1 h |
| Reportes legacy Rfat321/227/333/237 | 8 | 4 h |
| E2E Playwright (5 flujos) | 5 | 2 h |
| Reconciliación SQL (Q1-Q7) | 3 | 1.5 h |
| Wrap-up (limpieza .bak, push, dashboard) | 3 | 0.5 h |
| **Total** | **~41 tareas** | **~16 h** |

Estado de cierre DoD esperado tras la ejecución: §3.1 ✅, §3.2 ✅ (con evidencia), §3.3 ✅ (5 tests verdes), §3.4 ✅ (TODO/FIXME=0, reglas DGI verificadas).
