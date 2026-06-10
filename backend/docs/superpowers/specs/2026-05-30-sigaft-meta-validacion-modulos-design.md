# Meta-spec: Validación y cierre de los 9 módulos SIGAFT

- **Fecha:** 2026-05-30
- **Autor:** Brainstorming colaborativo (Claude + JCabreu)
- **Estado:** Borrador para revisión — incorpora hallazgos del MCP memory-router (`facture-project`)
- **Alcance:** Framework reutilizable para llevar cada módulo del clon SIGAFT a paridad funcional + datos idénticos con el legacy SIGAF, sin romper UX existente.
- **NO está en alcance:** El detalle de implementación por módulo. Eso vive en specs hijos (uno por módulo) que referencian este documento.
- **Infraestructura del clon:** VM 10.0.0.99 es **fuente de verdad** (no hay git en la VM); deploy vía `pscp`; backend Django + cx_Oracle apuntando a Oracle 11g LEGADO REAL — todo cambio es producción.

---

## 1. Propósito

El clon SIGAFT (`facturation-system`) reemplaza al legacy SIGAF (Oracle Forms/Reports `.fmx/.rep/.rdf`) manteniendo la misma base de datos Oracle. El objetivo NO es solo "tener algo que funcione" — es entregar 9 módulos completos donde:

- Cada operación del legacy tiene equivalente en el clon.
- Cada reporte produce un PDF con los mismos números que el legacy (misma BD, mismas queries).
- La UX moderna y consistente (no se sacrifica diseño por velocidad de entrega).
- Las reglas DGI República Dominicana se cumplen donde aplica fiscalmente.

Este meta-spec define el **contrato común** que todos los specs hijos deben cumplir. Sin este contrato, los 9 sub-proyectos divergirían en calidad y harían el clon impredecible.

---

## 2. Arquitectura del proceso

```
Meta-spec (este doc)
     │
     ├─► define DoD, plantilla, estándares, roadmap
     │
     ▼
9 specs hijos (uno por módulo, en docs/superpowers/specs/)
     │
     ▼
9 planes hijos (uno por módulo, en docs/superpowers/plans/)
     │
     ▼
Ejecución con subagent-driven-development por plan
     │
     ▼
PR por módulo → revisión → merge → módulo cerrado
```

**Cada módulo es un sub-proyecto independiente** que se brainstormearía por separado si no fuera por este meta-spec. El meta-spec responde de una vez las preguntas comunes a todos los módulos, dejando solo las preguntas específicas (qué reportes, qué bugs, qué flujos) para el spec hijo.

---

## 3. Definición de Hecho (DoD) — Obligatoria para los 9 módulos

Un módulo se considera **cerrado** solo cuando se cumplen los 4 criterios siguientes. Cualquier falla en un criterio invalida el cierre.

### 3.1. Paridad de menú y reportes con el legacy

- Cada opción `.fmx` del menú legacy tiene una vista equivalente en el clon (ruta + componente React).
- Cada reporte `.rep`/`.rdf` del legacy tiene un endpoint `/api/<modulo>/.../pdf/` en el clon que devuelve un PDF funcional.
- Las opciones que el equipo decide **descartar** se documentan explícitamente en el spec hijo bajo la sección "Descartadas con justificación". No se permite omitir silenciosamente.

**Fuente de verdad por módulo (en orden de autoridad):**

1. **Capturas legado** en `C:\Users\JCABREU\AppData\Local\memorias_sigaft\capturas\<modulo>\` — verdad **visual**. Abrir las PNG con timestamps y leer estructura del menú legado pantalla por pantalla.
2. **MCP memory-router** (`facture-project`) — usar `memory_search` y `memory_get` para reglas de negocio, gaps y estado de cada módulo. Memorias clave: `sigaf/module-memory-20260530-final/<modulo>/part-*`.
3. **Memoria técnica local** en `C:\Users\JCABREU\AppData\Local\memorias_sigaft\memorias_por_modulo\memoria_<modulo>.md` — especificación inferida desde binarios `.fmx/.rep/.rdf`.

**Conteo real del legacy (formas / reportes — desde `project/modules-inventory` del MCP, autoritativo):**

| Módulo legacy | Forms (.fmx) | Reports (.rep/.rdf) |
|---|---|---|
| FAT (facturación) | 176 | 109 |
| SDN (nómina) | 104 | 50 |
| INV (inventario) | 82 | 82 |
| CXC (cobrar) | 81 | 154 |
| CNT (contabilidad) | 59 | 50 |
| CHC (cheques) | 56 | 93 |
| CXP (pagar) | 45 | 30 |
| ACC (caja chica) | 24 | 11 |
| ODC (órdenes compras) | 19 | 9 |

Nota: conteo de OPCIONES de menú (no forms) está en `memorias_por_modulo/`. Las cifras del MCP son las únicas autoritativas para forms/reports. Total legacy: 662 FMX, 591 REP, 15 MMX, 3 PLL, 1 FMB. Limitación reconocida: sin fuentes `.fmb/.rdf` no se reconstruye 100% el catálogo de campos — cada spec hijo debe documentar lo que infiere vs lo que verifica.

### 3.2. Reconciliación SQL vs legacy

- Para cada reporte clave del módulo: documentar la query SQL que ejecuta el clon (o la lista de queries si son varias).
- Ejecutar la misma query directamente contra Oracle y confirmar que arroja los mismos números que el reporte legacy.
- Evidencia obligatoria en el PR: screenshot o log comparativo lado-a-lado (legacy `.rep` vs clon `/pdf/`).
- Si hay diferencias, documentarlas como discrepancias conocidas con justificación (ej. legacy tiene bug ya conocido).

### 3.3. Smoke E2E con Playwright en flujos críticos

- Cada módulo define **3 a 5 flujos críticos** en su spec hijo. Ejemplo FAT: crear factura, anular factura, registrar cobro, imprimir PDF, generar reporte mensual.
- Cada flujo crítico tiene un test Playwright que ejecuta el happy path completo y verifica:
  - HTTP 2xx en respuestas clave
  - Sin errores en `console.error`
  - Estado final esperado (factura guardada, NCF consumido, etc.)
- Los tests viven en `frontend/e2e/<modulo>/` y corren en CI.

### 3.4. Reglas DGI + limpieza de código

**DGI (donde aplique fiscalmente — FAT, CxC, CxP, CNT):**
- NCF en formato real DGI: `POSICIONES_FIJAS_NCF || LPAD(NCF,8,'0')`, serie B01-B15 (ver [[project-sigaft-ncf-schema]]).
- RNC validado: 9 u 11 dígitos, no se permite generar comprobantes sin RNC en el cliente.
- Razón social real de la empresa activa, no placeholders tipo "Empresa 01".
- Lookups código → descripción visibles al usuario (ej. condición pago "30 días" no "C30").
- IDs internos (`no_factura` autoincremental crudo, claves técnicas) nunca visibles en PDFs ni UI usuario.

**Limpieza de código:**
- `grep -rE "TODO|FIXME|XXX" backend/apps/<modulo>/ frontend/src/features/<modulo>/` debe retornar **cero matches** antes del cierre.
- Lo pendiente se registra como issue separado, no como comentario en código.

---

## 4. Restricciones técnicas no-negociables

Aplican a **toda implementación** en cualquier módulo. Un PR que viole estas restricciones se rechaza sin discusión.

### 4.1. Frontend — UI y diseño

- **Mantener el sistema de diseño existente.** Componentes y patrones de `frontend/src/features/fat/` y `frontend/src/features/inv/` son la referencia. Cero divergencia visual entre módulos.
- **Stack obligatorio:** shadcn/ui + Tailwind + TanStack Router + TanStack Query (alias React Query). No introducir librerías UI alternativas.
- **Sin UI desactualizada o no amigable:** loading skeletons (no spinners en blanco), validación inline (no después del submit), mensajes de error accionables en español, atajos de teclado donde aplique.
- **Sin lógica de negocio en JSX.** Componentes pequeños y enfocados; hooks reutilizables; separación clara `data fetching / lógica / presentación`.

### 4.2. Frontend — Data fetching y performance

- **React Query obligatorio.** Toda llamada al backend pasa por `useQuery` / `useMutation`. Cero `fetch` directos o `useEffect+setState` para data del backend.
- **Configurar staleTime apropiado por endpoint.** Datos de catálogos largos (`staleTime: 1000*60*30`), listas operacionales (`staleTime: 1000*30`), realtime (`staleTime: 0`).
- **`invalidateQueries` después de mutaciones**, con keys precisos (no `invalidateQueries(['fat'])` que invalida todo el módulo).
- **Requests óptimos:**
  - Endpoints paginados (limit/offset) donde haya listas potencialmente largas.
  - Filtros server-side (jamás traer 10k filas para filtrar en cliente).
  - Bulk reads en lugar de N+1 (un endpoint que devuelva detalles, no un endpoint por fila).
  - Prefetch de detalles probables al hover/focus en filas de listas.
- **Presupuesto de performance:** ninguna vista del módulo debe exceder 500ms en p95 con datos reales. Si excede, medir con Chrome DevTools y optimizar antes de mergear.

### 4.3. Backend

- **Stack obligatorio:** Django + cx_Oracle / oracledb. El backend NO se reescribe en otra cosa.
- **Vistas en `backend/apps/<modulo>/views.py`** (CBV `View` con `JsonResponse`, `@csrf_exempt` donde aplique). Repositorio en `apps/legacy/repositories/<modulo>_repo.py`. URLs en `apps/<modulo>/urls.py` o `apps/legacy/<modulo>_urls.py`. Seguir el patrón ya establecido en `apps/fat/` y `apps/inv/`.
- **PDFs: extender `apps/legacy/pdf_helpers.py`** (helper `build_pdf_report` compartido). Cada módulo aporta sus configuraciones específicas (columnas, queries, totales, header_extra, footer_extra) pero el chasis es común.
- **Queries Oracle parametrizadas siempre** (cx_Oracle bind variables `:b1`, `:b2`). Cero string interpolation de filtros del usuario.
- **Composición de NCF DGI vía helper `_compose_ncf_dgi`** en `fat_repo.py`. Nunca leer `CODIGO_NCF`/`TIPO_NCF_FISCAL` crudos (son legacy/vacíos en 100% de las facturas).
- **Permisos** vía `permissions_repo.get_for(user, modulo, no_cia, punto)` antes de cualquier operación. Si `None` o `not activo` → HTTP 403.

### 4.4. Reglas técnicas críticas del schema Oracle 11g (de obligado conocimiento)

Estas reglas vienen del MCP memory-router. Violarlas produce bugs de paridad. Cada spec hijo debe leerlas y verificar adherencia.

1. **CXC.TCXC_CLIENTE tiene PK compuesta `(no_cia, no_cliente)`** ([[cxc/tcxc-cliente-pk-composite]]). Todo JOIN a esa tabla debe incluir AMBAS columnas. Bug histórico: `fat_repo.list_facturas` join solo por `no_cliente` produjo 191k filas en lugar de 48k (commit fix `e284c6d`).

2. **TFAT_FACTURA.ESTADO semántica** ([[fat/estado-factura-semantica]]):
   - `P` = Pendiente (sin autorizar, no se imprime).
   - `A` = Autorizada (lista para cobrar/imprimir).
   - `C` = Cerrada/cobrada.
   - Filtros de listados deben respetar esta semántica.

3. **TINV_MOVIMIENTO empaque-CPE normalization** ([[inv/existencia-empaque-normalization]]): la cantidad se almacena en dos escalas según `m.empaque` vs el empaque "para_reporte". Normalizar con `CASE WHEN m.empaque = emp.empaque THEN m.cantidad WHEN emp.cpe > 0 THEN m.cantidad / emp.cpe ELSE m.cantidad END`. NO usar `TINV_EPRODUCTO.exist_actual` (snapshot stale).

4. **TFAT_LISTA_PRECIO.precio se guarda por UNIDAD BASE, no por empaque vendido** ([[fat/precio-lista-cpe-multiplier]]). Al calcular precio de venta multiplicar por CPE del empaque seleccionado.

5. **NCF DGI no está en una columna** ([[project-sigaft-ncf-schema]]): se compone como `POSICIONES_FIJAS_NCF || LPAD(NCF, 8, '0')`. Usar helper `fat_repo._compose_ncf_dgi`.

6. **Performance Oracle 11g**: NUNCA hacer `LEFT JOIN` con `GROUP BY` sobre TINV_MOVIMIENTO en endpoints paginados. Ver patrón en [[fat/search-productos-pagination-pattern]]. Causa cuelgues >90s.

7. **Tabla por módulo/empresa**: las tablas legacy `T<MOD>_USUARIO` (TFAT_USUARIO, TINV_USUARIO, etc.) son las que controlan permisos por módulo+empresa+punto.

### 4.4. Testing y verificación antes de cerrar

- Smoke E2E con Playwright pasa local + CI.
- Reconciliación SQL documentada (ver §3.2).
- Captura visual con Playwright para los flujos críticos, guardada en `backend/docs/captures/<modulo>/`.
- `python -c "import ast; ast.parse(open('archivo.py').read())"` antes de cada `pscp` deploy.
- `pnpm typecheck` sin errores antes de mergear cambios frontend.

---

## 5. Estructura PDF estándar

Todos los PDFs de todos los módulos deben seguir esta estructura. La implementación vive en `apps/legacy/pdf_helpers.py:build_pdf_report`.

### 5.1. Header (siempre)

```
┌─────────────────────────────────────────────────────────────┐
│  [LOGO]  RAZÓN SOCIAL DE LA EMPRESA           Fecha emisión │
│          RNC: 1XX-XXXXX-X                     Usuario       │
│          TÍTULO DEL REPORTE                   Página X/Y    │
│          Filtros activos: <fecha desde> a <hasta>, ...      │
└─────────────────────────────────────────────────────────────┘
```

- **Razón social real** desde tabla `CNT.TCNT_COMPANIAS` (no hardcoded, no "Empresa 01").
- **Fecha emisión** en formato `DD-MM-YYYY HH:MM`.
- **Usuario** que generó el reporte (sesión activa).
- **Filtros aplicados** explícitos para auditoría.

### 5.2. Body

- Tabla con encabezados claros (etiquetas en español del dominio, no nombres técnicos de columna).
- Lookups código → descripción aplicados (sin "C30", debe decir "30 días").
- Numeración de documentos formateada (`FT-00000123` no `123`).
- Subtotales por grupo donde aplique (agrupado por mes, cliente, sucursal, etc.).

### 5.3. Footer

- Totales generales.
- Número de página.
- Línea de firma cuando aplique (cuadres de caja, conduces).

### 5.4. Reglas de contenido

- Cero IDs internos visibles.
- Cero placeholders ("TBD", "lorem ipsum", "Empresa 01").
- NCF en formato DGI completo cuando se imprime un comprobante (B01XXXXXXXX).

---

## 6. Procedimiento de validación SQL vs legacy

Procedimiento estándar a ejecutar **por cada reporte** en cada módulo:

1. **Extraer la query del clon.** Localizar el método del repo (ej. `fat_repo.listado_facturas_mes`) y copiar el SQL final ejecutado (con bind variables resueltos para el caso de prueba).
2. **Identificar el reporte legacy equivalente.** Buscar el `.rep`/`.rdf` correspondiente en la memoria técnica del módulo. Si el legacy ejecuta otra query, documentar las dos.
3. **Ejecutar ambas queries contra Oracle.** Usar SQL Developer / cualquier cliente. Mismas fechas, misma empresa, mismo filtro.
4. **Comparar resultados:**
   - Conteo de filas idéntico.
   - Suma de columnas numéricas idéntica (margen 0.00 — diferencias de centavos no se aceptan).
   - Muestra aleatoria de 10 filas con valores idénticos.
5. **Documentar evidencia** en el PR del módulo:
   - SQL del clon
   - SQL del legacy (si difiere)
   - Captura de ambos resultados
   - Notas sobre cualquier discrepancia
6. **Si hay discrepancia:**
   - Si el clon está mal → fix antes de cerrar.
   - Si el legacy está mal (bug conocido) → documentar y mantener el clon corregido (con bandera de visualización si afecta usuarios).

---

## 7. Pipeline de validación E2E con Playwright

Cada módulo define 3-5 flujos críticos. Para cada flujo:

1. **Definir el escenario** en el spec hijo: precondiciones (qué datos en BD), pasos del usuario, resultado esperado.
2. **Implementar el test** en `frontend/e2e/<modulo>/<flujo>.spec.ts`. Usar `@playwright/test`.
3. **Verificaciones obligatorias en cada flujo:**
   - HTTP 2xx en respuestas clave (`page.on('response', ...)`).
   - Cero entradas en `console.error` (`page.on('console', msg => if (msg.type() === 'error') ...)`).
   - Captura de pantalla del estado final (`screenshot()`) guardada en `backend/docs/captures/<modulo>/<flujo>.png`.
4. **Ejecución:**
   - Local: `pnpm exec playwright test e2e/<modulo>/`
   - CI: workflow de GitHub Actions corre la suite completa antes de permitir merge.

---

## 8. Plantilla reproducible: spec hijo por módulo

Cada uno de los 9 specs hijos debe seguir esta estructura. Ruta: `backend/docs/superpowers/specs/2026-MM-DD-<modulo>-design.md`.

```markdown
# Spec módulo <NOMBRE>

- Fecha:
- Estado:
- Meta-spec referenciado: 2026-05-30-sigaft-meta-validacion-modulos-design.md

## 1. Inventario actual del módulo
- Vistas implementadas (rutas + componentes)
- Reportes implementados (endpoints PDF)
- Bugs conocidos (referencia al backlog)

## 2. Gap con el legacy
- Opciones legacy NO implementadas: <lista>
- Reportes legacy NO implementados: <lista>
- Reglas DGI/contables que faltan: <lista>

## 3. Trabajo a realizar
### 3.1. Vistas/pantallas
### 3.2. Endpoints backend
### 3.3. Reportes PDF
### 3.4. Bugs a corregir

## 4. Flujos críticos para E2E (3-5)
- Flujo 1: ...
- Flujo 2: ...

## 5. Queries a reconciliar con legacy
- Query 1: <SQL> — reporte legacy equivalente: <.rep>
- Query 2: ...

## 6. Opciones legacy descartadas con justificación
- Opción X: descartada porque ...

## 7. Estimación
- Tareas: <N>
- Esfuerzo agregado: <horas>
```

---

## 9. Roadmap de los 9 módulos

Orden por dependencias del flujo contable. Cada módulo es independiente como sub-proyecto pero el orden minimiza retrabajo.

| Orden | Módulo | Estado real (MCP) | Foco del spec hijo |
|-------|--------|-------------------|---------------------|
| 1 | **FAT** (Facturación) | Backlog 2026-05-29 cerrado (12 commits locales, push pendiente). Gaps abiertos: perf `/api/fat/productos/` >90s, conduce edit UPDATE, Puntos Trabajo upsert, Listas Precio cabecera+detalle, Tipos Pago sin status, reportes Rinv304/Rfat237 restantes. | Cerrar los 7 gaps documentados en `fat/gaps-pendientes-post-backlog` + DoD completa. NO rehacer lo del backlog. |
| 2 | **INV** (Inventario) | Spec Rinv70x listo, falta plan. Regla crítica empaque-CPE ya aplicada (commit 77f86ea/c1b898a). Endpoint movimientos Rinv304 ya existe. | Plan + ejecución Rinv705 (ABC), Rinv706 (sin movimiento), Rinv707 (bajo reorden); limpiar Rinv301-328 falsos del UI; entry-point del reporte movimientos en vista Productos. |
| 3 | **CxC** (Cuentas por Cobrar) | **COMPLETO** (estado 2026-05-27): rutas por archivo patrón FAT, 31 vistas reales, backend full en `cxc_repo`. | Auditoría DoD: verificar paridad menú vs legacy (81 forms / 154 reports), reconciliación SQL, suite Playwright. Probablemente solo gaps menores. |
| 4 | **CxP** (Cuentas por Pagar) | **STUB frontend** (solo `routes/_authenticated/cxp/index.tsx`, sin layout ni features). Backend parcial: proveedores, documentos, aging, tipos-docu. Falta: catálogos config, procesos/pagos, reportes 606/607/623, impresiones, cierre. | Construir frontend desde cero clonando arquitectura de CxC (`cxp/handoff-build-frontend`). Completar backend faltante. |
| 5 | **CNT** (Contabilidad) | Estabilizado 2026-05-11/13: react-select reemplazado en formulario asientos; dropdown en sidebar global. Auditoría legado pendiente (`backend/docs/32_cnt_comparacion_legado_pendiente.md`). | Completar auditoría legado; cubrir reportes (59 forms / 50 reports legacy). Aprovechar skill `cnt-legado-architecture` del MCP. |
| 6 | **ODC** (Órdenes de Compras) | Sin spec — 19 forms / 9 reports legacy. Memoria técnica disponible. | Spec + plan + ejecución completos. |
| 7 | **CHC** (Cheques) | Sin spec — 56 forms / 93 reports legacy (¡el de más reportes después de CxC!). | Spec + plan + ejecución. Foco fuerte en reportes (conciliación bancaria). |
| 8 | **ACC** (Caja Chica) | Sin spec — 24 forms / 11 reports legacy. El más chico del lote. | Spec + plan + ejecución. Quick win candidato. |
| 9 | **SDN** (Nómina) | Sin spec — 104 forms / 50 reports legacy. Identificado como #1 en `project/risk-areas`. | Spec + plan + ejecución. El de mayor complejidad y riesgo. |

**Discrepancia de orden:** la memoria del MCP `project/migration-order` sugiere empezar por SDN (nómina) por dependencias. El orden adoptado aquí prioriza **lo que está más cerca de cierre** y **lo que el usuario usa más** (FAT/INV/CxC son el flujo de venta diaria). Es una decisión deliberada del usuario en el brainstorming 2026-05-30.

### 9.1. Paralelización posible

- **Specs hijos** (1-9): se pueden producir en paralelo usando agentes independientes. Cada agente lee este meta-spec, la memoria técnica del módulo (`memorias_por_modulo/memoria_<modulo>.md`), el MCP memory-router (`memory_search` + `memory_get`), y el código actual del módulo en la VM (`facturation-system/backend/apps/<modulo>/` + `facturation-system/frontend/src/features/<modulo>/`). Produce el spec hijo en `backend/docs/superpowers/specs/`.
- **Planes hijos** (1-9): se pueden producir en paralelo una vez los specs estén aprobados.
- **Ejecución**: NO paralelizar entre módulos relacionados (FAT y CxC comparten datos; INV y ODC también). Ejecutar en el orden de la tabla §9.

### 9.2. Skill MCP agent para sub-tareas

El proyecto tiene registrado en el MCP el skill agent `oracle-sigaf-erp` ([listado por `memory_list_agents`]) con triggers explícitos: sigaf, facturación, ERP, Oracle 11g, módulos, permisos, TXXX_USUARIO, FAT, CXC, CXP, INV, CHC, ODC, SDN, CNT, ACC, NCF, asientos contables, clon exacto. Para tareas que entran en su scope:

```
memory_dispatch("oracle-sigaf-erp", task="<descripción concreta>")
```

Skills MCP complementarias disponibles: `cnt-legado-architecture` (CNT), `frontend-design` (UI de alta calidad).

---

## 10. Métricas de avance y reporte

Mantener un dashboard simple en `backend/docs/superpowers/00_roadmap_avance.md` actualizado al cerrar cada módulo:

```
| Módulo | DoD 3.1 | DoD 3.2 | DoD 3.3 | DoD 3.4 | Cerrado |
|--------|---------|---------|---------|---------|---------|
| FAT    | ⏳      | ⏳      | ⏳      | ⏳      | ⏳      |
| INV    | ⏳      | ⏳      | ⏳      | ⏳      | ⏳      |
| ...    | ...     | ...     | ...     | ...     | ...     |
```

Convención: ⏳ pendiente · 🟡 en progreso · ✅ verificado. Sin emojis si el usuario lo prefiere.

---

## 11. Salidas concretas del meta-spec

Al ejecutar este meta-spec se producirán:

1. 9 specs hijos en `backend/docs/superpowers/specs/`
2. 9 planes hijos en `backend/docs/superpowers/plans/`
3. 9 PRs (uno por módulo) cerrando el DoD completo
4. Suite Playwright E2E con ~27-45 tests (3-5 por módulo)
5. Documentación de reconciliación SQL en cada PR
6. Dashboard de avance actualizado

---

## 12. Memorias relacionadas

**Local (`C:\Users\JCABREU\.claude\projects\C--Windows-system32\memory\`):**
- [[project-sigaft-specs-pendientes]]
- [[project-sigaft-backlog-fat]]
- [[project-sigaft-ncf-schema]]
- [[feedback-facturas-dgi]]
- [[feedback-sigaft-frontend-quality]]
- [[project-vm-credentials]]
- [[project-captures-location]]
- [[project-pdf-analysis-task]]

**MCP memory-router (`facture-project`) — consultar con `memory_search`:**
- `project/modules-inventory` — conteo real legacy forms/reports por módulo
- `project/migration-order` — orden recomendado por dependencias (difiere del adoptado)
- `project/risk-areas` — bloques de mayor riesgo (SDN, FAT, CHC, CNT, CxC/CxP, INV, DGII)
- `reference/capturas-legado-ubicacion` — ubicación capturas PNG por módulo
- `fat/backlog-2026-05-29-completo` — 12 commits sprint cerrado, push pendiente
- `fat/gaps-pendientes-post-backlog` — 7 gaps abiertos en FAT
- `fat/cuadre-caja-layout` — patrón cuadre caja con matriz NCF×forma_pago
- `fat/estado-factura-semantica` — P/A/C semántica
- `fat/precio-lista-cpe-multiplier` — precio venta CPE
- `fat/search-productos-pagination-pattern` — performance Oracle 11g
- `inv/existencia-empaque-normalization` — regla crítica TINV_MOVIMIENTO CPE
- `inv/movimientos-endpoint-rinv304` — endpoint reporte movimientos
- `cxc/tcxc-cliente-pk-composite` — PK compuesta obligatoria
- `cxc-cxp/estado-2026-05-27` — CxC completo, CxP stub
- `cxp/handoff-build-frontend` — brief para construir CxP desde cero
- `cnt/estabilizacion-2026-05-11`, `handoff/estado-cnt-2026-05-13`, `cnt/navegacion-global-2026-05-13`, `cnt/comparacion-legado-pendiente-2026-05-13` — estado CNT
- `sigaf/module-memory-20260530-final/<modulo>/part-*` — memoria técnica chunked en MCP
- Skill agent: `oracle-sigaf-erp` (project=facture-project)
- Skill: `cnt-legado-architecture` (CNT)

---

## 13. Anti-objetivos (lo que este meta-spec NO hace)

- No reescribe el backend en otra tecnología.
- No rediseña la UI ya existente en FAT/INV.
- No introduce features que el legacy no tiene (a menos que sean parte del DoD: cumplimiento DGI, dashboard de ventas mensual, etc., ya documentados como issues).
- No exige paridad pixel-perfect con el legacy SIGAF — el clon puede y debe verse mejor.
- No exige cubrir 100% de las opciones legacy si hay justificación documentada para descartar algunas.
