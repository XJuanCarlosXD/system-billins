# Spec modulo ODC (Ordenes de Compras) — construir desde cero

- **Fecha:** 2026-05-30
- **Estado:** Borrador para revision
- **Meta-spec referenciado:** `2026-05-30-sigaft-meta-validacion-modulos-design.md`
- **Memoria tecnica:** `memorias_por_modulo/memoria_ordenes_de_compras.md`
- **Brief MCP:** `sigaf/module-memory-20260530-final/ordenes_de_compras/part-001..019` + `cxp/handoff-build-frontend` (referencia metodologica).
- **Modulo plantilla:** **CxP construir desde cero** (gemelo metodologico; CxC tambien sirve como referencia visual completa).
- **Conteo legacy autoritativo (MCP `project/modules-inventory`):** **19 forms / 9 reports** (segundo modulo mas chico despues de ACC).

---

## 1. Inventario actual del modulo

### 1.1 Frontend (clon)

Estado: **NO EXISTE**.

Verificado en VM `10.0.0.99:facturation-system/` (2026-05-31):
- **NO existe** `frontend/src/features/odc/` ni `frontend/src/features/oc/`.
- **NO existe** `frontend/src/routes/_authenticated/odc/` ni `.../oc/`.
- **NO existe** `routes/_authenticated/odc.tsx` (layout).
- Referencias residuales a "odc" en `sidebar-data.ts` y en `features/auth-mgmt/` (administracion de permisos transversal); sin pantallas funcionales del modulo.
- No hay metodos ODC en `lib/regal-general-api.ts`.

### 1.2 Backend (clon)

Estado: **STUB minimo** (12 lineas).

Archivos confirmados en VM:
- `backend/apps/legacy/repositories/odc_repo.py` (12 lineas, una sola funcion `count_ordenes(no_cia) -> int` consultando `ODC.TODC_DOCUMENTO`).
- **NO existe** `apps/legacy/odc_urls.py` ni `apps/legacy/odc_views.py`.
- **NO existe** `apps/odc/` como app Django.
- Sin endpoint montado (`facturation_api/urls.py` no incluye prefijo `api/odc/`).
- Nota: la tabla `ODC.TODC_DOCUMENTO` referenciada por el stub NO aparece en la memoria tecnica del modulo; el inventario legacy detecta `TODC_ORDEN` y `TODC_ORDENL` para ordenes y `TODC_REQUISICION`/`TODC_REQUISICIONL`/`TODC_REQUISICION_TMP` para requisiciones. El stub probablemente apunta a una vista historica o esta mal nombrado; verificar y corregir.

### 1.3 Bugs conocidos / deuda tecnica

- Stub `count_ordenes` usa tabla `TODC_DOCUMENTO` no reconocida; rehacer.
- Sin app Django ODC: no hay `migrations/`, sin `apps.py`, sin tests.
- No hay sidebar group ni layout.

---

## 2. Gap con el legacy (19 forms / 9 reports)

### 2.1 Menu legacy mapeado desde memoria tecnica

Memoria detecta 44 opciones de menu (muchas redundantes / navegacion a otros modulos). Las **19 formas reales del modulo ODC** (prefijo `Fodc*`) son:

**Configuracion** (3 formas)
1. **Companias** (`Fodc101.fmx` — TODC_CIAS) — flag `USA_REQUISICION`.
2. **Puntos de Trabajo / Sucursales** (`Fodc102.fmx` — TODC_PUNTO) — campos `PROX_ORDEN`, `PROX_REQUISICION`.
3. **Acceso de Usuarios al Sistema / Mantenimiento Acceso** (`Fodc103.fmx`, `Fodc601.fmx` — TODC_USUARIO) — flags `CREAR_ODC_INV`, `ANULAR_ODC`, `IMPRIMIR_ODC`, `REIMPRIMIR_ODC`, `MONTO_MINIMO`, `MONTO_MAXIMO`, `AUTORIZACION_1..3`, `CREAR_REQUISICION`, `AUTORIZAR_REQUISICION`, `CERRAR_REQUISICION`, `ANULAR_REQUISICION`, `CERRAR_ORDEN`.

**Procesos — Ordenes de Compra** (5 formas)
4. **Entrada Ordenes de Compras** (`Fodc201.fmx` — TODC_ORDEN + TODC_ORDENL + TCXP_SECUENCIA + UPDATE TODC_PUNTO.PROX_ORDEN). Operaciones READ/CREATE/UPDATE/DELETE.
5. **Impresion / Reimpresion ODC** (`Fodc202.fmx` + reporte interno) — filtra `ST_IMPRESION='N'`, `ST_ANULADO='A'`, `AUTORIZADA_POR IS NOT NULL`.
6. **Autorizacion Ordenes de Compras** (`Fodc209.fmx`) — filtros `ESTADO='P'`, `TOTAL_NETO BETWEEN :MONTO_MINIMO AND :MONTO_MAXIMO`, niveles `AUTORIZACION_1/2/3`.
7. **Cerrar / Anular Ordenes de Compras** (`Fodc210.fmx`) — permiso `CERRAR_ORDEN`/`ANULAR_ODC`.
8. **Consulta Ordenes de Compras** (`Fodc501.fmx` — TODC_ORDEN + TODC_ORDENL + TCXP_DPROVEEDOR + TINV_PRODUCTO).

**Procesos — Requisicion** (6 formas, condicional `TODC_CIAS.USA_REQUISICION='S'`)
9. **Entrada de Requisicion** (`Fodc203.fmx` — TODC_REQUISICION + TODC_REQUISICIONL + TCXP_SECUENCIA + UPDATE TODC_PUNTO.PROX_REQUISICION).
10. **Autorizacion de Requisicion** (`Fodc204.fmx`).
11. **FODC206.fmx** — vista con persistencia para requisicion (cerrar/anular masivo, parametros `p_no_requisicion`, `p_no_requisicion2`, `p_no_localidad`).
12. **Impresion de Cotizacion de Requisicion** (`Fodc207.fmx` + `Rodc205`).
13. **Consolidar Requisicion** (`Fodc208.fmx`) — genera UPDATE TODC_PUNTO.PROX_REQUISICION; consolida lineas pendientes.
14. **Consulta de Requisicion** (`Fodc502.fmx`).

**Reportes (5 formas-launcher)**
15. **Reporte de Ordenes de Compra (`Fodc301.fmx` -> rodc201/202)**
16. **Reporte Movimientos Pendientes (Fodc + `rodc201.rep`)**
17. **Listado Doc por Documento (`rodc202.rep`)**
18. **Compra por Producto (`rodc208.rep`)**
19. **Requisicion Detalle / Resumen (`rodc206.rep`, `rodc207.rep`)** — agrupa filtros, parametros y autorizacion.

### 2.2 Reportes legacy (9 reports, los autoritativos del modulo)

Por archivos `Rodc*.rep`:
| # | Reporte | Archivo legacy | Dataset principal |
|---|---|---|---|
| R1 | **REPORTE MOVIMIENTOS PENDIENTES** | `rodc201.rep` | TODC_ORDEN + TODC_ORDENL pendientes, filtros fecha/proveedor/localidad/usuario |
| R2 | **LISTADO DE DOC POR DOCUMENTO** | `rodc202.rep` | TODC_ORDEN con `P_CUAL_FECHA in (C=Captura, E=Entrega)`, filtros tipo orden/anulado |
| R3 | **REQUISICION DETALLE** | `rodc206.rep` | TODC_REQUISICION + TODC_REQUISICIONL, filtros departamento/localidad/producto/fecha |
| R4 | **RESUMEN ODC** | `rodc207.rep` | Resumen por orden con parametro `P_autorizacion` (A=No, N=Si, T=Ambas) |
| R5 | **COMPRA POR PRODUCTO** | `rodc208.rep` | Detalle por producto agrupado por linea/sub-linea, filtro tipo producto S/U/I/V |
| R6 | **IMPRESION COTIZACION REQUISICION** | `rodc205.rep` (vinculado a Fodc207) | Cotizacion por proveedor (TODC_REQUISICION_TMP scratch) |
| R7 | **IMPRESION OC** | `rodc203.rep` o `rodc204.rep` (binario impresion documento desde Fodc202) | Detalle de la orden lista para enviar al proveedor |
| R8 | **REPORTE DE ORDENES DE COMPRA** | filtrado parametrizado desde `Fodc301.fmx` (alfa/por estado/tipo orden/usuario) | TODC_ORDEN |
| R9 | **CONSOLIDADO REQUISICION** | desde `Fodc208.fmx` (impresion del consolidado) | TODC_REQUISICIONL agrupado |

Nota: tres reportes adicionales referenciados en la memoria (`rcxp301.rep`, `rcxp202.rep`) pertenecen al modulo CxP y se descartan aqui (ver §6).

### 2.3 Brechas DGI/contables

- ODC **no es modulo fiscalmente DGI-critico**: no emite NCF, no afecta DGII 606/607/623 directamente (eso pasa cuando se factura en CxP la recepcion). PERO debe persistir `NO_LOCALIDAD`, `NO_DEPTO`, fechas y precios al detalle para que CxP/INV puedan auditar.
- Cierre ODC debe coexistir con cierre CxP: la ODC autorizada congelada no debe modificarse despues de generar el documento DR en CxP que la referencia. Verificar columna de relacion (probable `TCXP_DOCUMENTO.NO_ORDEN`).
- Reglas inv: el costo de productos en TODC_ORDENL alimenta promediado solo al recibir en CxP/INV (no aqui).

---

## 3. Trabajo a realizar

### 3.1 Vistas / pantallas frontend (objetivo 14 vistas)

**Configuracion (3)**
1. `odc-companias.tsx` — CRUD TODC_CIAS (flag `USA_REQUISICION`).
2. `odc-puntos-trabajo.tsx` — CRUD TODC_PUNTO (`PROX_ORDEN`, `PROX_REQUISICION`).
3. `odc-acceso-usuarios.tsx` — CRUD TODC_USUARIO con los 13+ flags de permiso.

**Procesos ODC (4)**
4. `odc-ordenes.tsx` — listado + creacion (entrada Fodc201). Selecciona proveedor, productos, empaque, cantidad, precio, fecha entrega, localidad.
5. `odc-autorizar.tsx` — pendientes por autorizar (Fodc209). Filtro monto entre `MONTO_MINIMO`/`MONTO_MAXIMO` del usuario; niveles 1/2/3.
6. `odc-cerrar-anular.tsx` — operaciones masivas (Fodc210).
7. `odc-imprimir.tsx` — selector rango y reimpresion (Fodc202).

**Procesos Requisicion (5)**
8. `odc-requisiciones.tsx` — listado + creacion (Fodc203).
9. `odc-autorizar-requisicion.tsx` (Fodc204).
10. `odc-cerrar-requisicion.tsx` (FODC206).
11. `odc-cotizacion-requisicion.tsx` (Fodc207 — multi-proveedor por requisicion, persiste en `TODC_REQUISICION_TMP`).
12. `odc-consolidar-requisicion.tsx` (Fodc208 — agrupa requisiciones pendientes en una sola).

**Consultas (2)**
13. `odc-consulta-ordenes.tsx` (Fodc501, drill-down a detalle de linea).
14. `odc-consulta-requisicion.tsx` (Fodc502).

**Reportes (1 hub)**
15. `odc-reportes.tsx` — hub con tabs para los 7 PDFs (consume endpoints `*/pdf/`).

Layout: `routes/_authenticated/odc.tsx` (Header + Outlet) y `routes/_authenticated/odc/index.tsx` con `Navigate` a `/odc/ordenes`.

Sidebar: convertir item plano "Ordenes de Compras" en `NavCollapsible` con grupos Configuracion / Ordenes / Requisicion / Consultas / Reportes.

### 3.2 Endpoints backend

Patron: `backend/apps/legacy/odc_urls.py`, `odc_views.py`, `repositories/odc_repo.py` (extender el stub). Montar `path('api/odc/', include('apps.legacy.odc_urls'))` en `facturation_api/urls.py`.

**Catalogos (3 grupos)**
- `GET /api/odc/companias/`, `POST/PUT` — TODC_CIAS.
- `GET/POST/PUT /api/odc/puntos-trabajo/` — TODC_PUNTO.
- `GET/POST/PUT /api/odc/acceso-usuarios/` — TODC_USUARIO.

**Ordenes**
- `GET /api/odc/ordenes/` (filtros: estado, proveedor, fecha_ini, fecha_fin, no_localidad, tipo_orden, anulado).
- `GET /api/odc/ordenes/<no_cia>/<punto>/<no_orden>/` (detalle + lineas).
- `POST /api/odc/ordenes/` (con `TCXP_SECUENCIA FOR UPDATE` + `TODC_PUNTO.PROX_ORDEN`).
- `PUT /api/odc/ordenes/<...>/` (solo si `ST_IMPRESION='N'` y `AUTORIZADA_POR IS NULL`).
- `POST /api/odc/ordenes/<...>/autorizar/` (set `AUTORIZADA_POR`, `ESTADO='A'`).
- `POST /api/odc/ordenes/<...>/cerrar/`.
- `POST /api/odc/ordenes/<...>/anular/` (set `ST_ANULADO='N'`).
- `POST /api/odc/ordenes/<...>/imprimir/` (set `ST_IMPRESION='S'`) -> respuesta PDF.

**Requisiciones**
- Mismo set: `GET listado`, `GET detalle`, `POST crear`, `PUT editar`, `POST autorizar`, `POST cerrar`, `POST anular`, `POST cotizar` (escribe `TODC_REQUISICION_TMP`), `POST consolidar`.

**Reportes PDF** (siete endpoints `*/pdf/`):
- `GET /api/odc/reportes/movimientos-pendientes/pdf/`
- `GET /api/odc/reportes/listado-por-documento/pdf/`
- `GET /api/odc/reportes/compra-por-producto/pdf/`
- `GET /api/odc/reportes/requisicion-detalle/pdf/`
- `GET /api/odc/reportes/resumen-odc/pdf/`
- `GET /api/odc/reportes/ordenes/pdf/` (parametros del `Fodc301`)
- `GET /api/odc/imprimir-orden/<no_cia>/<punto>/<no_orden>/pdf/` (impresion individual)
- `GET /api/odc/imprimir-cotizacion/<no_cia>/<punto>/<no_requisicion>/pdf/`

Todos extienden `apps/legacy/pdf_helpers.build_pdf_report` (header empresa, filtros, totales).

### 3.3 Reportes PDF (9 totales, alineados con la tabla §2.2)

Mapeo legacy -> clon ya cubierto en §2.2 y §3.2. Cada PDF debe documentar:
- Query SQL (en `odc_repo.<reporte>_query`).
- Parametros y defaults.
- Estructura header/body/footer segun §5 del meta-spec.
- Reconciliacion contra Oracle (ver §5 de este spec).

### 3.4 Bugs a corregir

- Reemplazar el stub `count_ordenes` por una consulta sobre `TODC_ORDEN` (no `TODC_DOCUMENTO`); confirmar que no se use desde otro modulo antes de remover.
- Garantizar que el patron `TCXP_SECUENCIA FOR UPDATE` se respete para evitar duplicados en alta concurrencia (mismo bug ya documentado en FAT/CxP).

---

## 4. Flujos criticos para E2E (5)

1. **Crear OC** (`Fodc201`): login -> `/odc/ordenes` -> Nuevo -> seleccionar proveedor, 2 productos con empaque y cantidad, fecha entrega, localidad -> Guardar -> verificar nuevo `NO_ORDEN` correlativo (TODC_PUNTO.PROX_ORDEN +1, TCXP_SECUENCIA +1), `ESTADO='P'`, `AUTORIZADA_POR IS NULL`, `ST_IMPRESION='N'`.

2. **Autorizar OC + Imprimir** (`Fodc209` + `Fodc202`): con OC del flujo 1 -> `/odc/autorizar` -> seleccionar -> Autorizar (set `AUTORIZADA_POR=usuario`, `ESTADO='A'`) -> ir a `/odc/imprimir` -> imprimir -> verificar PDF con datos correctos y `ST_IMPRESION='S'`.

3. **Crear Requisicion + Consolidar** (`Fodc203` + `Fodc208`): crear 2 requisiciones con productos comunes -> autorizarlas -> `/odc/consolidar-requisicion` -> verificar que se genera 1 nueva requisicion consolidada y las originales pasan a estado consolidado.

4. **Generar Reporte Movimientos Pendientes**: `/odc/reportes` -> "Movimientos Pendientes" -> filtros (fecha del mes, todos los proveedores, todas localidades) -> PDF se descarga -> reconciliar conteo y montos con query directa a Oracle (ver §5).

5. **Anular OC + Trazabilidad CxP**: tomar una OC del flujo 1 antes de autorizar -> `/odc/cerrar-anular` -> Anular -> verificar `ST_ANULADO='N'` y que en CxP no aparece como pendiente de facturar.

Tests viven en `frontend/e2e/odc/{crear-oc,autorizar-imprimir,requisicion-consolidar,reporte-pendientes,anular-oc}.spec.ts`.

---

## 5. Queries a reconciliar con legacy

### 5.1 Reporte Movimientos Pendientes (rodc201.rep)

```sql
SELECT o.NO_CIA, o.PUNTO, o.NO_ORDEN, o.FECHA, o.FECHA_ENTREGA,
       p.NOMBRE proveedor, o.NO_LOCALIDAD, o.TOTAL_NETO, o.ESTADO,
       o.AUTORIZADA_POR, o.ST_IMPRESION, o.ST_ANULADO
  FROM TODC_ORDEN o, TCXP_DPROVEEDOR p
 WHERE o.NO_CIA = :no_cia AND o.PUNTO = :punto
   AND (o.NO_LOCALIDAD = :no_localidad OR :no_localidad = 'T')
   AND (o.ST_ANULADO = :anulado OR :anulado = 'T')
   AND TRUNC(o.FECHA) BETWEEN :fecha_i AND :fecha_f
   AND o.ESTADO = 'P'  -- pendientes
   AND p.NO_PROVEEDOR = o.NO_PROVEEDOR
 ORDER BY o.FECHA, o.NO_ORDEN;
```
Legacy equivalente: `Rodc201.rep` ejecutado desde `Fodc301.fmx`.

### 5.2 Listado por Documento (rodc202.rep)

```sql
SELECT o.NO_ORDEN, o.FECHA, o.FECHA_ENTREGA, p.NOMBRE, o.TOTAL_NETO,
       o.ESTADO, o.ST_ANULADO, o.ST_IMPRESION
  FROM TODC_ORDEN o, TCXP_DPROVEEDOR p
 WHERE o.NO_CIA = :no_cia AND o.PUNTO = :punto
   AND p.NO_PROVEEDOR = o.NO_PROVEEDOR
   AND ((:cual_fecha = 'C' AND TRUNC(o.FECHA) BETWEEN :fecha_i AND :fecha_f)
     OR (:cual_fecha = 'E' AND TRUNC(o.FECHA_ENTREGA) BETWEEN :fecha_ei AND :fecha_ef))
   AND (o.TIPO_ORDEN = :tipo_orden OR :tipo_orden = 'T')
   AND (o.ST_ANULADO = :anulado OR :anulado = 'T')
 ORDER BY o.NO_ORDEN;
```

### 5.3 Compra por Producto (rodc208.rep)

```sql
SELECT ol.NO_PRODU, pr.DESCRI, l.DESCRI linea, sl.DESCRI sub_linea,
       SUM(ol.CANTIDAD) cantidad_total, SUM(ol.CANTIDAD * ol.PRECIO) monto,
       p.NOMBRE proveedor
  FROM TODC_ORDEN o, TODC_ORDENL ol, TINV_PRODUCTO pr,
       TINV_LINEA l, TINV_SUB_LINEA sl, TCXP_DPROVEEDOR p
 WHERE o.NO_CIA = :no_cia AND o.PUNTO = :punto
   AND ol.NO_CIA = o.NO_CIA AND ol.PUNTO = o.PUNTO AND ol.NO_ORDEN = o.NO_ORDEN
   AND pr.NO_PRODU = ol.NO_PRODU
   AND l.LINEA = pr.LINEA AND sl.SUB_LINEA = pr.SUB_LINEA
   AND p.NO_PROVEEDOR = o.NO_PROVEEDOR
   AND TRUNC(o.FECHA) BETWEEN :fecha_i AND :fecha_f
   AND (pr.SERVICIO = :tipo OR :tipo = 'T')
   AND (o.NO_LOCALIDAD = :no_localidad OR :no_localidad = 'T')
   AND (o.ST_ANULADO = :anulado OR :anulado = 'T')
   AND (ol.NO_PRODU = :no_produ OR :no_produ IS NULL)
 GROUP BY ol.NO_PRODU, pr.DESCRI, l.DESCRI, sl.DESCRI, p.NOMBRE
 ORDER BY l.DESCRI, sl.DESCRI, pr.DESCRI;
```

### 5.4 Requisicion Detalle (rodc206.rep)

```sql
SELECT r.NO_REQUISICION, r.FECHA, r.NO_LOCALIDAD, r.NO_DEPTO, r.USUARIO,
       rl.NO_PRODU, p.DESCRI, rl.CANTIDAD, rl.EMPAQUE, rl.ST_LINEA
  FROM TODC_REQUISICION r, TODC_REQUISICIONL rl, TINV_PRODUCTO p
 WHERE r.NO_CIA = :no_cia AND r.PUNTO = :punto
   AND rl.NO_CIA = r.NO_CIA AND rl.PUNTO = r.PUNTO
   AND rl.NO_REQUISICION = r.NO_REQUISICION
   AND p.NO_PRODU = rl.NO_PRODU
   AND TRUNC(r.FECHA) BETWEEN :fecha_i AND :fecha_f
   AND (r.NO_LOCALIDAD = :no_localidad OR :no_localidad = 'T')
   AND (r.NO_DEPTO = :depto OR :depto = 'T')
   AND (rl.NO_PRODU = :no_produ OR :no_produ IS NULL)
 ORDER BY r.NO_REQUISICION, rl.NO_PRODU;
```

### 5.5 Resumen ODC (rodc207.rep)

```sql
SELECT o.NO_ORDEN, o.FECHA, p.NOMBRE, o.TOTAL_NETO,
       DECODE(o.AUTORIZADA_POR, NULL, 'No', 'Si') autorizada,
       o.AUTORIZADA_POR, o.ESTADO
  FROM TODC_ORDEN o, TCXP_DPROVEEDOR p
 WHERE o.NO_CIA = :no_cia AND o.PUNTO = :punto
   AND p.NO_PROVEEDOR = o.NO_PROVEEDOR
   AND TRUNC(o.FECHA) BETWEEN :fecha_i AND :fecha_f
   AND (
         (:autorizacion = 'A' AND o.AUTORIZADA_POR IS NULL)
      OR (:autorizacion = 'N' AND o.AUTORIZADA_POR IS NOT NULL)
      OR (:autorizacion = 'T')
       )
 ORDER BY o.NO_ORDEN;
```

### 5.6 Conciliacion con CxP

```sql
-- ODC pendientes de facturar = OC autorizadas con saldo no consumido en CxP
SELECT o.NO_ORDEN, o.TOTAL_NETO,
       NVL((SELECT SUM(d.MONTO_NETO) FROM TCXP_DOCUMENTO d
              WHERE d.NO_CIA = o.NO_CIA AND d.PUNTO = o.PUNTO
                AND d.NO_ORDEN = o.NO_ORDEN
                AND d.ST_ANULADO = 'A'), 0) facturado
  FROM TODC_ORDEN o
 WHERE o.NO_CIA = :no_cia AND o.PUNTO = :punto
   AND o.ESTADO = 'A' AND o.ST_ANULADO = 'A';
```
Verificar que `TCXP_DOCUMENTO.NO_ORDEN` exista (probable; confirmar via `DESC TCXP_DOCUMENTO` durante ejecucion).

Procedimiento de reconciliacion: ver §6 del meta-spec. Evidencia obligatoria en PR.

---

## 6. Opciones legacy descartadas con justificacion

- **Reportes CxP enlazados en memoria (`rcxp301.rep` alfabetico proveedores, `rcxp202.rep` rev. saldos)** — pertenecen a CxP, ya cubiertos en su spec. No se duplican en ODC. Botones de "Alfabetico Proveedores" en menu ODC apuntan al hub de CxP.
- **Formularios "Asignar Proveedores a Sucursales" (`Fcxp107.fmx`), "Mantenimiento Proveedores" (`Fcxp106.fmx`), "Aplicar/Generar Saldos Menores" (`Fcxp204.fmx`, `Fcxp202.fmx`), "Impresion Entrada de Diario" (`Fcxp401-403.fmx`)** — son del menu CxP; aparecen referenciados desde ODC solo como entrypoints navegacionales. Se descartan en ODC.
- **Navegacion cross-module (Fmenu_acf/acc/chc/cnt/cxc/cxp/fat/inv/sdn)** — el sidebar global del clon ya cubre la navegacion entre modulos; no se replican botones dentro del modulo ODC.
- **Mantenimiento Ciudades / Sectores (`Fcxc111`, `Fcxc112`)** — pertenecen a CxC; ODC reutiliza los catalogos compartidos via lookups read-only.
- **Tabla `TODC_DOCUMENTO`** referenciada en el stub actual — no aparece en memoria tecnica; se asume basura y se reemplaza por `TODC_ORDEN`.

---

## 7. Estimacion

- **Tareas atomicas:** ~28 (ver plan).
- **Esfuerzo:** ~14-18 horas de trabajo dirigido (mas chico que CxP por: sin DGI 606/607, sin cheques, sin asientos contables, menos catalogos).
- **Dependencias upstream:** modulo CxP completo (proveedores, tipos proveedor), modulo INV (productos, empaques, lineas/sub-lineas), modulo CNT (localidades, companias). Si CxP esta en stub, partes de ODC se bloquean en pruebas reales.
- **Riesgo principal:** el flag `USA_REQUISICION` por compania puede ocultar/mostrar el bloque entero de requisiciones; testear ambos modos.

---

## 8. Memorias y referencias

- Meta-spec: `specs/2026-05-30-sigaft-meta-validacion-modulos-design.md`.
- Memoria local: `memorias_por_modulo/memoria_ordenes_de_compras.md`.
- MCP: `sigaf/module-memory-20260530-final/ordenes_de_compras/part-001..019`, `sigaf/module-memory-full-20260530/ordenes_de_compras/part-001..011`, `cxp/handoff-build-frontend`, `cxc-cxp/estado-2026-05-27`.
- Plantilla: `specs/2026-05-30-cxp-construir-modulo-design.md` + `plans/2026-05-30-cxp-construir-modulo.md`.
- Patron tecnico: `inv/existencia-empaque-normalization` aplica si se muestran cantidades convertidas; aqui se trabaja en empaque ordenado, NO en empaque base — usar el CPE almacenado en `TODC_ORDENL.EMPAQUE` para mostrar.
