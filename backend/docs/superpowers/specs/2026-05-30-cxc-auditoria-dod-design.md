# Spec módulo CXC — Auditoría DoD

- **Fecha:** 2026-05-30
- **Estado:** Borrador para revisión
- **Meta-spec referenciado:** [2026-05-30-sigaft-meta-validacion-modulos-design.md](./2026-05-30-sigaft-meta-validacion-modulos-design.md)
- **Naturaleza:** Spec de **AUDITORÍA DoD**, no de construcción. CxC fue marcado COMPLETO en MCP (`cxc-cxp/estado-2026-05-27`). Este spec verifica si efectivamente cumple los 4 criterios del DoD (§3 del meta-spec) y lista los gaps reales.

---

## 0. Contexto y fuente de verdad

- **MCP memory `cxc-cxp/estado-2026-05-27`:** CxC declarado completo con 31 vistas + backend full.
- **MCP memory `cxc/tcxc-cliente-pk-composite`:** PK compuesta `(no_cia, no_cliente)` obligatoria en todo JOIN a `TCXC_CLIENTE`. Verificación de adherencia incluida en §3.3.
- **Memoria técnica local:** `memorias_por_modulo/memoria_cuentas_por_cobrar.md` — 90 opciones de menú, 71 forms referenciados, 14 reportes inferidos. Conteo MCP autoritativo: **81 forms / 154 reports** legacy.
- **Capturas legado:** `C:\Users\JCABREU\AppData\Local\memorias_sigaft\capturas\cuentas_por_cobrar\` (40+ PNGs).
- **VM 10.0.0.99** es fuente de verdad para el estado real del clon.

---

## 1. Inventario actual del módulo

### 1.1. Vistas implementadas — 31 rutas hijas (patrón FAT por archivo)

Ubicación: `frontend/src/routes/_authenticated/cxc/*.tsx` + layout `frontend/src/routes/_authenticated/cxc.tsx`. Features en `frontend/src/features/cxc/cxc-*.tsx` (9 archivos compartidos).

| # | Ruta | Componente feature | Sección sidebar |
|---|------|-------------------|------------------|
| 1 | `cxc/index.tsx` | redirect → `/cxc/clientes` | — |
| 2 | `cxc/cias.tsx` | `cxc-catalogo-base` | Configuración |
| 3 | `cxc/puntos.tsx` | `cxc-catalogo-base` | Configuración |
| 4 | `cxc/tdocu.tsx` | `cxc-catalogo-base` | Configuración |
| 5 | `cxc/tcli.tsx` | `cxc-catalogo-base` | Configuración |
| 6 | `cxc/supervisores.tsx` | `cxc-catalogos` | Configuración |
| 7 | `cxc/vendedores.tsx` | `cxc-vendedores` | Configuración |
| 8 | `cxc/rutas.tsx` | `cxc-catalogos` | Configuración |
| 9 | `cxc/tcontable.tsx` | `cxc-catalogos` | Configuración |
| 10 | `cxc/ciudades.tsx` | `cxc-catalogos` | Configuración |
| 11 | `cxc/barrios.tsx` | `cxc-catalogos` | Configuración |
| 12 | `cxc/zonas.tsx` | `cxc-catalogos` | Configuración |
| 13 | `cxc/cadenas.tsx` | `cxc-catalogos` | Configuración (bug stub ya arreglado) |
| 14 | `cxc/clientes.tsx` | `cxc-clientes` | Clientes |
| 15 | `cxc/cliente-ruta.tsx` | `cxc-clientes` | Clientes |
| 16 | `cxc/documentos.tsx` | `cxc-transacciones` | Documentos |
| 17 | `cxc/transacciones.tsx` | `cxc-transacciones` | Documentos |
| 18 | `cxc/reversar.tsx` | `cxc-procesos` | Procesos |
| 19 | `cxc/pagos-masivos.tsx` | `cxc-procesos` | Procesos |
| 20 | `cxc/liberar-credito.tsx` | `cxc-procesos` | Procesos |
| 21 | `cxc/corregir-ncf.tsx` | `cxc-procesos` | Procesos |
| 22 | `cxc/estado-cuenta.tsx` | `cxc-consultas` | Consultas |
| 23 | `cxc/balance.tsx` | `cxc-consultas` | Consultas |
| 24 | `cxc/historico.tsx` | `cxc-consultas` | Consultas |
| 25 | `cxc/libro-ventas.tsx` | `cxc-consultas` | Consultas |
| 26 | `cxc/rep-envejecimiento.tsx` | `cxc-reportes` | Reportes |
| 27 | `cxc/rep-cobros-vendedor.tsx` | `cxc-reportes` | Reportes |
| 28 | `cxc/rep-comisiones.tsx` | `cxc-reportes` | Reportes |
| 29 | `cxc/rep-ncf.tsx` | `cxc-reportes` | Reportes |
| 30 | `cxc/asiento-contable.tsx` | `cxc-cierre` | Cierre |
| 31 | `cxc/generar-asiento.tsx` | `cxc-cierre` | Cierre |
| 32 | `cxc/cierre.tsx` | `cxc-cierre` | Cierre |

### 1.2. Endpoints backend — 32 rutas en `apps/legacy/cxc_urls.py`

Repositorio: `apps/legacy/repositories/cxc_repo.py` (45 KB, ~50 funciones). Vistas: `apps/legacy/cxc_views.py` (22 KB, 32 clases `APIView`).

Cobertura por sección:
- **Configuración:** `cias`, `puntos`, `tdocu`, `tcli`, `supervisores`, `vendedores`, `rutas`, `tcontable`, `ciudades`, `barrios`, `zonas`, `cadenas`.
- **Clientes:** `clientes` (lista+CRUD+detalle), `clientes-ruta` (asignación).
- **Documentos:** `documentos`, `documentos/<no_cia>/<no_doc>/`, `next-doc`.
- **Procesos:** `reversar`, `pagos-masivos`, `liberar-credito`, `corregir-ncf`.
- **Consultas:** `estado-cuenta`, `balance-clientes`, `historico`, `libro-ventas`.
- **Reportes (JSON):** `rep-envejecimiento`, `rep-cobros-vendedor`, `rep-comisiones`, `rep-ncf`.
- **Cierre:** `asiento-contable`, `generar-asiento`, `cierre`.

### 1.3. Reportes PDF implementados

**CERO.** No existe ningún endpoint `/api/cxc/.../pdf/`. No hay imports de `pdf_helpers` ni de `build_pdf_report` en `cxc_views.py`/`cxc_repo.py`/`cxc_urls.py`. Los 4 endpoints `rep-*` devuelven JSON únicamente.

### 1.4. Suite E2E Playwright

**No existe.** No hay carpeta `frontend/e2e/` en la VM. No hay tests E2E para CxC ni para ningún módulo.

### 1.5. Bugs/notas conocidas (memoria + MCP)

- `cxc/cadenas.tsx` era stub vacío (ya arreglado, ahora usa `cxc-catalogos`).
- Memoria MCP `cxc-cxp/estado-2026-05-27` describe estado "completo" en cobertura funcional, pero no certifica reportes PDF ni E2E.

---

## 2. Gap con el legacy

### 2.1. Paridad de menú — 81 forms legacy vs 31 vistas clon

**Paridad funcional estimada: ~60-70 %** (31 vistas en clon cubren las opciones de mayor uso). Forms legacy detectados en `memorias_por_modulo/memoria_cuentas_por_cobrar.md` que **NO tienen vista equivalente**:

**Comisiones (alta granularidad legacy):**
- Fcxc302 Comisiones Por Tipo Vend-Producto
- Fcxc303 Reporte Comisiones Tipo Vend-producto
- Fcxc304 Comisiones Por Zona-Producto (digitar)
- Fcxc306 Reporte Comisiones Por Zona-Producto
- Fcxc307 Reporte Comisiones Supervisores/Cobradores
- Fcxc308 Porciento de Comisiones en rango de días
- Fcxc309 Digitar comisión por factura
- Fcxc310 Reporte de Cobros Por Líneas y Sublíneas
- Fcxc313 Reporte de Estadísticas de Cobros y Descuentos
- Fcxc315 Comisiones Por Productos
- Fcxc317 Reporte de Comisiones Por Producto
- En el clon solo hay 1 vista genérica `rep-comisiones.tsx`. **Gap: 10+ variantes de comisiones legacy a auditar.**

**Procesos legacy faltantes:**
- Fcxc201 Entrada de Documentos DR/CR (manual DR/CR distinto de `documentos.tsx`).
- Fcxc202 Genear Saldos Menores Por Ajustar.
- Fcxc204 Aplicar Saldos Menores Por Ajustar (`CANCELACIONDESALDOSMENORES`).
- Fcxc205 INGRESOS MENSUALES.
- Fcxc206 APLICACIONDEMOVSCONSALDO.
- Fcxc207 Aplicación de Cheques Futuristas.
- Fcxc212 Enviar Documentos e-NCF a la DGII (**crítico DGI**).

**Mantenimientos:**
- Fcxc108 Mantenimiento Grupo de Ruta.
- Fcxc116 Asignación de Clientes a Ruta (clon tiene `cliente-ruta`, validar paridad).
- Fcxc118 Mantenimiento Documentos genérico.
- Fcxc120 Cambiar Vendedor a Clientes/Doc.
- Fcxc123 Actualizar Coordenadas de Clientes desde Excel (.fmx no existe en O:\gpsc).
- Fcxc319 Envío de Documentos a Excel.

**Consultas/Reportes (Fcxc3xx, 5xx):**
- Fcxc314 Mayor Auxiliar Cuentas por Cobrar.
- Fcxc318 Relación de documentos por Vendedor/cobrador.
- Fcxc320 Análisis Antigüedad de Saldos (clon tiene `rep-envejecimiento`, validar paridad de columnas).
- Fcxc501 Consulta de Documentos DR/CR (`ESTADO DE CUENTA`).
- Fcxc502 Consulta de Cuentas Por Cobrar.
- Fcxc503 Consulta Movimientos de Clientes (`HISTORIAL DE DOCUMENTOS`, clon tiene `historico`, validar paridad).
- Fcxc505 Consulta Alfabética de Clientes.
- Fcxc506 Consulta de Documentos Con Cuotas.

**Conclusión menú:** ~50 forms legacy con candidatura a estar mapeados/descartados. Hay que clasificarlos uno por uno en la auditoría (cubierto / no cubierto / descartado-con-justificación).

### 2.2. Paridad de reportes — 154 reports legacy vs 0 PDFs clon

Memoria local detecta 14 `.rep` referenciados en CxC (subset del total 154 del MCP). Reportes legacy con nombre conocido:
- `Rcxc101.rep` REPORTE DE RECIBOS
- `Rcxc201.rep` REPORTE MOVIMIENTOS PENDIENTES
- `Rcxc202.rep` REPORTE REV. DE SALDOS
- `Rcxc204.rep` LISTADO DE DOCUMENTO POR DOC
- `Rcxc207.rep` LISTADO DE DOCUMENTOS DRCR
- `Rcxc302.rep` INGRESOS COBROS VENDEDOR
- `Rcxc309.rep` LISTADO DOCUMENTOS POR COBRAR
- `Rcxc315.rep`, `Rcxc318.rep`, `Rcxc319.rep` LISTADO CXC POR CIUDAD/COBRA, `Rcxc327.rep`, `Rcxc329.rep`, `Rcxc332.rep`, `Rcxc336.rep`.

**Gap real (DoD §3.1):** 0 / ≥14 reportes PDF implementados en el clon. **Paridad de reports estimada: ~0 %.**

Reports clave para implementación obligatoria en este DoD:
1. **Estado de cuenta por cliente** (consulta crítica usuaria).
2. **Aging / envejecimiento** (= análisis antigüedad saldos `Fcxc320` + `Rcxc202`).
3. **Listado documentos por cobrar** (`Rcxc309`).
4. **Cobros por vendedor** (`Rcxc302`).
5. **Libro de ventas / NCF emitidos** (insumo DGI 606/607).

### 2.3. Reglas DGI/contables que faltan

- Envío de Documentos e-NCF a la DGII (Fcxc212) — sin equivalente clon.
- Validación NCF DGI completo (`POSICIONES_FIJAS_NCF || LPAD(NCF,8,'0')`) en `corregir-ncf.tsx` y en lectura `rep-ncf`. El backend hoy lee `d.ncf` crudo; debe componer con helper `_compose_ncf_dgi` (CXC.TCXC_DOCUMENTO `ncf` también es legacy/parcial).
- Razón social real (no "Empresa 01") en headers PDF cuando se construyan.
- Lookups código → descripción en outputs UI: validar que `tipo_doc`, `vendedor`, `tipo_contable`, `zona` muestren descripción (no código crudo).

### 2.4. Reconciliación SQL pendiente

Hoy no existe ningún documento que cruce SQL del clon contra resultados del `.rep` legacy. Procedimiento §6 del meta-spec sin ejecutar para CxC.

---

## 3. Trabajo a realizar (auditoría, no construcción)

### 3.1. Inventario sistemático (vistas)

- Para cada uno de los 31 archivos de ruta en `routes/_authenticated/cxc/`, abrir, identificar el feature usado y los endpoints invocados. Construir tabla **clon → form legacy → memoria_cuentas_por_cobrar.md**.
- Para cada form legacy en la memoria (81 según MCP), marcar `cubierto / parcial / faltante / descartado-justificado`.
- Resultado: `backend/docs/auditoria_cxc/01_paridad_menu.md`.

### 3.2. Inventario sistemático (reportes)

- Listar los 14 `.rep` de memoria local + los 154 reportes del MCP (consultar `memory_get sigaf/module-memory-20260530-final/cuentas_por_cobrar/part-*`).
- Para cada uno: indicar si existe endpoint JSON equivalente en `cxc_urls.py`, si hay PDF, y marcar como `pdf-existe / json-pero-sin-pdf / no-existe / descartado`.
- Resultado: `backend/docs/auditoria_cxc/02_paridad_reportes.md`.

### 3.3. Reconciliación SQL por reporte clave (5 reports priorizados)

Para cada uno, documentar:
- SQL del clon (extraído de `cxc_repo.py`).
- SQL legacy inferido (de `.rep` analyzer en memoria + capturas de pantalla).
- Resultado de ambas queries con un caso de prueba (misma empresa, mismo mes).
- Diff de filas / suma de columnas / muestra 10 filas.
- **Verificación obligatoria PK compuesta**: cada JOIN a `TCXC_CLIENTE` debe llevar `ON c.no_cia=d.no_cia AND c.no_cliente=d.no_cliente`.
- Resultado: `backend/docs/auditoria_cxc/03_reconciliacion_sql/<reporte>.md` (5 archivos).

Reports a reconciliar:
1. `rep_envejecimiento` vs `Rcxc202.rep` REV. DE SALDOS + Fcxc320 Análisis Antigüedad.
2. `estado_cuenta` vs Fcxc501/Fcxc503 + `Rcxc309.rep`.
3. `rep_cobros_vendedor` vs `Rcxc302.rep` INGRESOS COBROS VENDEDOR.
4. `rep_ncf_emitidos` vs libro ventas DGI 606/607 (FAT) cruzado por documentos CxC.
5. `balance_clientes` vs Fcxc314 Mayor Auxiliar / `Rcxc315.rep`.

### 3.4. Smoke E2E con Playwright — 5 flujos críticos

Crear `frontend/e2e/cxc/` (no existe). Cada flujo en su `.spec.ts`. Verificaciones obligatorias del meta-spec §3.3 (HTTP 2xx, cero `console.error`, screenshot final guardado).

### 3.5. Auditoría DGI + limpieza código

- `grep -rE "TODO|FIXME|XXX" backend/apps/legacy/cxc_*.py backend/apps/legacy/repositories/cxc_repo.py frontend/src/features/cxc/ frontend/src/routes/_authenticated/cxc/` → debe retornar 0.
- Verificar que `corregir-ncf` y `rep_ncf_emitidos` compongan NCF DGI correcto.
- Verificar que ningún componente muestre `no_cia` / `no_cliente` crudo como ID interno en PDFs (cuando existan).

### 3.6. Gaps NO se resuelven en este spec

Si la auditoría encuentra gaps (forms legacy faltantes, reports PDF inexistentes, queries divergentes), se **listan en el reporte final** y se abre issue por cada uno. Este spec **NO incluye construcción** — sólo verificación.

---

## 4. Flujos críticos para E2E (5)

### Flujo 1: Crear cliente
- **Precondiciones:** BD con empresa activa, punto y vendedor.
- **Pasos:** Login → `/cxc/clientes` → Nuevo → completar nombre, RNC, vendedor, tipo contable, zona → Guardar.
- **Resultado esperado:** Cliente persiste con PK `(no_cia, no_cliente)`; aparece en listado; HTTP 2xx en `POST /api/cxc/clientes/`; toast éxito.

### Flujo 2: Registrar cobro (documento CR)
- **Precondiciones:** Cliente con saldo pendiente.
- **Pasos:** `/cxc/documentos` → Nuevo → tipo CR → seleccionar cliente → monto → aplicar a deuda → Guardar.
- **Resultado esperado:** `TCXC_DOCUMENTO` recibe fila con `tipo_movi='CR'`; saldo del cliente se actualiza; `next-doc` incrementa.

### Flujo 3: Consultar aging
- **Precondiciones:** Empresa con clientes y documentos vencidos > 30/60/90 días.
- **Pasos:** `/cxc/rep-envejecimiento` → filtro empresa → ejecutar.
- **Resultado esperado:** `GET /api/cxc/rep-envejecimiento/` 2xx; tabla muestra columnas 0-30 / 31-60 / 61-90 / 91-120 / >120; total no nulo; PK compuesta respetada (verificable por SQL).

### Flujo 4: Generar estado de cuenta
- **Precondiciones:** Cliente con documentos pendientes.
- **Pasos:** `/cxc/estado-cuenta` → seleccionar cliente → ver detalle.
- **Resultado esperado:** Lista de documentos abiertos; total pendiente correcto; cliente identificado por nombre (no por `no_cliente` crudo).

### Flujo 5: Cierre mensual
- **Precondiciones:** Mes con documentos no contabilizados; usuario con permisos.
- **Pasos:** `/cxc/generar-asiento` → mes/año → preview asiento → confirmar → `/cxc/cierre` → cerrar período.
- **Resultado esperado:** `TCXC_DOCUMENTO.ST_GENERADO_CNT='S'` para todos los documentos del mes; `TCXC_PUNTO.MES_PROCESO` avanza; no se permite reabrir sin permiso explícito.

---

## 5. Queries a reconciliar con legacy

### 5.1. `rep_envejecimiento` vs Rcxc202.rep / Fcxc320

Query del clon (de `cxc_repo.py:861`):
```sql
SELECT c.no_cliente, c.nombre, c.vendedor,
  SUM(CASE WHEN <date_expr>-TRUNC(d.fecha) BETWEEN 0 AND 30 THEN NVL(d.saldo,0) ELSE 0 END) c0,
  SUM(CASE WHEN <date_expr>-TRUNC(d.fecha) BETWEEN 31 AND 60 THEN NVL(d.saldo,0) ELSE 0 END) c30,
  SUM(CASE WHEN <date_expr>-TRUNC(d.fecha) BETWEEN 61 AND 90 THEN NVL(d.saldo,0) ELSE 0 END) c60,
  SUM(CASE WHEN <date_expr>-TRUNC(d.fecha) BETWEEN 91 AND 120 THEN NVL(d.saldo,0) ELSE 0 END) c90,
  SUM(CASE WHEN <date_expr>-TRUNC(d.fecha) > 120 THEN NVL(d.saldo,0) ELSE 0 END) c120,
  SUM(NVL(d.saldo,0)) total
FROM CXC.TCXC_DOCUMENTO d
JOIN CXC.TCXC_CLIENTE c ON c.no_cia=d.no_cia AND c.no_cliente=d.no_cliente   -- PK COMPUESTA OK
WHERE d.no_cia=:1 AND NVL(d.st_anulado,'N')='N' AND NVL(d.saldo,0)<>0
GROUP BY c.no_cliente, c.nombre, c.vendedor
HAVING SUM(NVL(d.saldo,0)) <> 0
ORDER BY c.nombre
```
A reconciliar contra: legacy ejecuta `Fcxc320`/`Rcxc202` con misma fecha corte y empresa. Verificar buckets idénticos y total.

### 5.2. `estado_cuenta` vs Fcxc501 / Fcxc503 / Rcxc309
Clon ejecuta dos queries: cabecera (cliente) + detalle (documentos abiertos). PK compuesta correcta. Reconciliar conteo de filas y suma de saldo.

### 5.3. `rep_cobros_vendedor` vs Rcxc302
Clon agrupa por `c.vendedor`, JOIN PK compuesta correcto. Reconciliar count(*) y total por vendedor.

### 5.4. `rep_ncf_emitidos` vs libro DGI 606
Clon lee `d.ncf` crudo. **Riesgo:** el NCF DGI real es `POSICIONES_FIJAS_NCF || LPAD(NCF,8,'0')` ([[project-sigaft-ncf-schema]]). A reconciliar: ¿`TCXC_DOCUMENTO.NCF` ya contiene el NCF compuesto, o requiere helper `_compose_ncf_dgi`? Decidir y documentar.

### 5.5. `balance_clientes` vs Fcxc314 Mayor Auxiliar / Rcxc315
Buckets aging idénticos a `rep_envejecimiento` pero por cliente sin filtro vendedor. Reconciliar.

---

## 6. Opciones legacy descartadas con justificación

A documentar definitivamente durante la auditoría (§3.1). Candidatos iniciales a descartar:

- **Fcxc123 Actualizar Coordenadas Clientes desde Excel** — `.fmx` no existe en `O:\gpsc` (legacy roto). Justificación: feature legado fantasma.
- **Fcxc319 Envío de Documentos a Excel** — el clon expone "Exportar a Excel/CSV" en todas las listas TanStack Table por convención UI. Descartar como pantalla dedicada.
- **Fcxc114 Mantenimiento Cadenas de Negocios** — cubierto por `cxc/cadenas.tsx` (no descartar, validar paridad).
- **Fcxc104 Mantenimiento Tipo Documentos** — cubierto por `cxc/tdocu.tsx`.
- **Fcxc108 Mantenimiento Grupo Ruta + Fcxc109 Ruta** — el clon expone `cxc/rutas.tsx` que probablemente cubre ambas; validar y justificar fusión.

---

## 7. Estimación

- **Tareas atómicas (2-5 min cada una):** ~30.
- **Esfuerzo agregado:** ~3-5 horas para auditoría completa (sin construir nada nuevo).
- **Salida:**
  - `backend/docs/auditoria_cxc/01_paridad_menu.md`
  - `backend/docs/auditoria_cxc/02_paridad_reportes.md`
  - `backend/docs/auditoria_cxc/03_reconciliacion_sql/<5 archivos>.md`
  - `frontend/e2e/cxc/<5 tests>.spec.ts`
  - Issues abiertos por gap detectado (no resueltos en este sprint de auditoría).
  - Dashboard `00_roadmap_avance.md` actualizado para CXC con estado real DoD por criterio.

### 7.1. Predicción de hallazgos (para validar)

- **DoD §3.1 paridad menú:** ~60-70 % cubierto (31/81 vistas, gaps en comisiones granulares y procesos legacy raros). **Probable FALLO sin justificaciones.**
- **DoD §3.2 reconciliación SQL:** sin ejecutar — **FALLO**.
- **DoD §3.3 E2E Playwright:** sin tests — **FALLO**.
- **DoD §3.4 reglas DGI + limpieza:** parcial — el NCF compuesto puede no estar bien; e-NCF DGII no existe.

CxC NO está cerrado bajo el DoD del meta-spec aunque MCP lo marque como "completo en cobertura". Este spec lo formaliza.

---

## 8. Memorias relacionadas

**MCP memory-router (`facture-project`):**
- `cxc-cxp/estado-2026-05-27`
- `cxc/tcxc-cliente-pk-composite`
- `sigaf/module-memory-20260530-final/cuentas_por_cobrar/part-*`
- `project/modules-inventory` (81 forms / 154 reports CxC autoritativo)
- Skill agent: `oracle-sigaf-erp`

**Local (`~/.claude/projects/.../memory/`):**
- [[project-sigaft-specs-pendientes]]
- [[project-sigaft-ncf-schema]]
- [[feedback-facturas-dgi]]
- [[project-captures-location]]

**Memoria técnica:** `memorias_por_modulo/memoria_cuentas_por_cobrar.md`.
