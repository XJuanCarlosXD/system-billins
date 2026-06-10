# Spec módulo CNT (Contabilidad General)

- Fecha: 2026-05-31
- Estado: Borrador para revisión
- Meta-spec referenciado: `2026-05-30-sigaft-meta-validacion-modulos-design.md`
- Skill MCP de referencia: `cnt-legado-architecture` (estructura UI/menús/tabs/opciones/flujos del CNT legado — fuente para clonación exacta).
- Memorias MCP clave: `cnt/estabilizacion-2026-05-11`, `handoff/estado-cnt-2026-05-13`, `cnt/navegacion-global-2026-05-13`, `cnt/comparacion-legado-pendiente-2026-05-13`, `handoff/contexto-cnt-2026-05-13`.
- Conteo legacy autoritativo: **59 forms / 50 reports** (ver §9 del meta-spec). La memoria técnica local infiere 76 opciones / 60 forms / 12 reports, lo que confirma una brecha grande en reportes detectables vs catalogados.

---

## 0. Contexto previo (no rehacer)

CNT fue estabilizado entre 2026-05-11 y 2026-05-13:

- `react-select` eliminado del formulario de asientos, reemplazado por `Popover + Command` de la plantilla.
- Período inicial se toma del punto activo real (`TCNT_PUNTO.ano_proceso/mes_proceso`).
- `TCNT_NCF` tratado como catálogo global con rangos/años unidos.
- Shell CNT sin sidebar interno; navegación por `?section=configuracion|procesos|consultas|reportes|cierres&view=...`.
- Dropdown "Contabilidad" en sidebar global bajo "Administración".
- Selector de empresa/punto único en `team-switcher`; la vista se remonta por `vista+empresa+punto+ano+mes` para evitar data pegada.

Este spec NO altera la decisión arquitectónica: cubre **paridad funcional con el legado** sin replicar el menú literal.

---

## 1. Inventario actual del módulo

### 1.1. Vistas implementadas (`frontend/src/features/cnt/`)

| Vista | Archivo | Sección | Estado |
|---|---|---|---|
| Compañías | `companias.tsx` | configuracion | OK |
| Sucursales / puntos | `sucursales.tsx` | configuracion | OK |
| Tipos de cuenta | `tipos-cuenta.tsx` | configuracion | OK |
| Catálogo de cuentas | `catalogo.tsx` | configuracion | OK (en dialog — debe pasar a inline) |
| Catálogo por sucursal | `catalogo-sucursal.tsx` | configuracion | OK |
| Grupos contables por sucursal | `grupos-sucursal.tsx` | configuracion | OK |
| Centros de costo | `centros-costo.tsx` | configuracion | OK (en dialog — debe pasar a inline) |
| NCF | `ncf.tsx` | configuracion | OK (en dialog — debe pasar a inline) |
| Períodos fiscales | `periodos.tsx` | configuracion | OK |
| Asientos (lista + form) | `asientos.tsx`, `asiento-form.tsx` | procesos | OK estabilizado |
| Verificar asientos | `verificar-asientos.tsx` | procesos | OK |
| Autorizar mes | `autorizar-mes.tsx` | procesos | OK |
| Autorizar mes anterior | `autorizar-mes-anterior.tsx` | procesos | OK |
| Presupuesto | `presupuesto.tsx` | procesos | Stub — sin ajustes ni ejecución |
| Balance comprobación | `balance.tsx` | reportes | OK (sin PDF) |
| Mayor de cuenta | `mayor.tsx` | reportes | OK (sin PDF) |
| Estado de resultados | `estado-resultados.tsx` | reportes | OK (sin PDF) |
| Cierre mensual | `cierre-mensual.tsx` | cierres | OK |

Single entry: `frontend/src/routes/_authenticated/cnt.tsx` con `validateSearch` para `section/view`.

### 1.2. Endpoints backend (`apps/cnt/urls.py` + `apps/cnt/views.py`, repo `apps/legacy/repositories/cnt_repo.py`)

Cubren: config, cias, sucursales, grupos contables, catalogo (list/detail), tcuenta (list/detail), centros-costo, periodos, cierres, ncf (list/detail), asientos (list/detail/aprobar/actualizar/anular), autorizar-mes, balance, mayor, cierre-mensual, autorizar-mes-anterior, catalogo-sucursal, tipos-proyecto (list/detail), movimientos cuenta, centros por cuenta, presupuesto, estado-resultados.

### 1.3. Reportes PDF actualmente expuestos

**Cero.** Ningún endpoint `/pdf/` está montado en `apps/cnt/urls.py`. Balance, Mayor y Estado de Resultados solo devuelven JSON para la vista web — falta la salida PDF que el legado garantiza para los 12 reportes inferidos.

### 1.4. Bugs / pendientes conocidos

- `backend/docs/32_cnt_comparacion_legado_pendiente.md` está referenciado en memorias pero **no existe** en la VM. Hay que crearlo (matriz Área | Opción legado | Qué hace en el viejo | Ruta/UI nueva | API/tabla Oracle | Estado | Gap).
- Catálogo, NCF y Centros de Costo siguen abriéndose en `Dialog`. Deben moverse a vista inline densa (consistente con resto de CNT).
- Presupuesto: solo lista. Faltan flujos de carga inicial, ajustes y ejecución mensual.
- Reportes PDF: 12 reportes legacy sin endpoint `/pdf/` en el clon.

---

## 2. Gap con el legacy

### 2.1. Opciones legacy NO implementadas

| Opción legado | Forma | Estado clon |
|---|---|---|
| Acceso de Usuarios al Módulo | Fcnt103 | **FALTA** (frontend) |
| Mantenimiento de Tipo de Cuenta | Fcnt104 | OK (`tipos-cuenta.tsx`) |
| Tipo de Proyectos | Fcnt115 (memoria) | Backend OK, **falta frontend** |
| Proyectos | Fcnt112 | Backend parcial, **falta frontend** |
| Componentes de Proyectos | Fcnt113 | **FALTA** (front + back) |
| Localidades | Fcnt110 | **FALTA** (front + back) |
| Mantenimiento Departamentos | Fcnt117 | **FALTA** |
| Mantenimiento Dirección Administrativa | Fcnt118 | **FALTA** |
| Tipos de NCF | Fcnt119 | **FALTA** (front) |
| Equivalencia Catálogo Gubernamental-Comercial | Fcnt116 | **FALTA** |
| Desbloquear Usuario | Fcnt121 | **FALTA** |
| Asignar Centros de Costos a Cuentas | Fcnt109 | Backend OK, **falta vista dedicada** |
| Actualizar Asientos en US / Meses Anteriores | Fcnt201/203 | **FALTA** (multi-moneda) |
| Autorizar Asientos en US (mes actual + ant) | — | **FALTA** |
| Entrada de Asientos en US | Fcnt502 hist. | **FALTA** |
| Consulta de Asiento en US | — | **FALTA** |
| Aplicar Saldos Menores Por Ajustar | — | **FALTA** |
| Generar Entrada de Nómina | — | **FALTA** |
| Modificar ED de Nómina | — | **FALTA** |
| Modificar Componente al Histórico | — | **FALTA** |
| Consulta Movimientos de Cuentas | Fcnt502 | Backend OK (`movimientos-cuenta`), **falta vista** |
| Cierre Anual (Fcnt402) | — | **FALTA** (solo está mensual) |
| Mantenimiento de Anexos y Est. Financieros | — | **FALTA** |
| Imprimir Anexos y Est. Financieros | — | **FALTA** |
| Estados Financieros en Líneas | — | Parcial (estado-resultados) — **falta balance general y anexos** |
| Utilitario Anexos y Est. Financieros | — | **FALTA** |

### 2.2. Reportes legacy NO implementados como PDF

Los 12 reportes inferidos en `memoria_contabilidad.md` (con sus `.rep` reales):

| # | Reporte | `.rep` | Estado clon |
|---|---|---|---|
| 1 | Catálogo Centros de Costos | `Rcnt310.rep` | **FALTA PDF** |
| 2 | Catálogo Cuenta | `Rcnt301.rep` | **FALTA PDF** |
| 3 | Catálogo Cuentas por Sucursal | `Rcnt317.rep` | **FALTA PDF** |
| 4 | Catálogo de Proyectos | `Rcnt312.rep` | **FALTA PDF** |
| 5 | Histórico de Asientos | `Rcnt316.rep` | **FALTA PDF** |
| 6 | Histórico de Transacciones | `Rcnt315.rep` | **FALTA PDF** |
| 7 | Listado de Cuentas con Centros | `Rcnt311.rep` | **FALTA PDF** |
| 8 | Rcnt201 (Mayor general detallado) | `Rcnt201.rep` | **FALTA PDF** (existe vista JSON) |
| 9 | Rcnt202 (Presupuesto vs ejecutado) | `Rcnt202.rep` | **FALTA PDF** |
| 10 | Rcnt204 (Presupuesto detallado) | `Rcnt204.rep` | **FALTA PDF** |
| 11 | Verificación de Asientos | `Rcnt210.rep` | **FALTA PDF** (existe vista JSON) |
| 12 | Balance Comprobación / Situación + histórico (Rcnt) | — | **FALTA PDF** (existe JSON) |

Nota: el conteo del MCP dice **50 reports legacy** total — los 12 anteriores son los reconocibles desde `.rep` actuales; los otros 38 corresponden a variantes (consolidados, ED financieros parametrizables) que pueden agruparse en un mismo endpoint con parámetros.

### 2.3. Reglas DGI / contables que faltan

- Balance General y Estado de Resultados con formato regulatorio (CNT.TCNT_CUENTAS_EF, líneas EF agrupadas por `TCNT_LINEAS_EF`).
- Cierre anual: traslado de utilidad retenida vía `TCNT_CIAS.UTILIDAD_RETENIDA` (regla de Fcnt402).
- NCF en tabla `TCNT_NCF`: el módulo ya lo trata como catálogo global; verificar que los rangos consumidos por FAT/CxP no rompen consistencia con CNT (semántica del documento DGI requiere validación cruzada).
- Multi-moneda: tablas `*_US` (TCNT_ASIENTO_US, TCNT_MOVIMIENTO_US, TCNT_BCUENTA columnas `*_US`) — pipeline US sin implementar.

---

## 3. Trabajo a realizar

### 3.1. Vistas / pantallas

1. **Mantenimiento inline** (mover de Dialog a vista): `catalogo`, `ncf`, `centros-costo`.
2. **Nuevas vistas configuración:**
   - Acceso de usuarios al módulo (Fcnt103).
   - Tipos de proyecto (CRUD — backend ya está).
   - Proyectos (CRUD completo).
   - Componentes de proyectos.
   - Localidades.
   - Departamentos.
   - Dirección administrativa.
   - Tipos de NCF.
   - Equivalencia catálogo gubernamental-comercial.
   - Desbloquear usuario.
   - Asignar centros de costo a cuentas (vista dedicada con tabla y toggle).
3. **Nuevas vistas procesos:**
   - Entrada de asientos US (variante de `asiento-form` con flag `afecta_us`).
   - Autorizar/actualizar US (mes actual + anterior).
   - Aplicar saldos menores por ajustar.
   - Generar entrada de nómina.
   - Modificar ED de nómina.
   - Modificar componente al histórico.
   - Presupuesto: pestañas Inicial / Ajustes / Ejecución.
4. **Nuevas vistas consultas:**
   - Consulta de asiento (Fcnt501) — buscador asiento+cia+punto+ano+mes con detalle.
   - Consulta movimientos de cuentas (Fcnt502) — usar endpoint `movimientos-cuenta` existente.
   - Consulta de asiento en US.
5. **Nuevas vistas reportes (UI + PDF):**
   - Balance general (estado financiero — TCNT_LINEAS_EF).
   - Mantenimiento anexos y EF.
   - Estados financieros en líneas (preliminares).
   - Histórico de asientos / transacciones (filtros + tabla + PDF).
   - Gastos por proyecto/componente.
6. **Cierres:** agregar cierre anual (Fcnt402).

### 3.2. Endpoints backend nuevos

- `/cnt/proyectos/` (list/detail CRUD), `/cnt/componentes/`, `/cnt/localidades/`, `/cnt/departamentos/`, `/cnt/direcciones-admin/`, `/cnt/tipos-ncf/`, `/cnt/catalogo-gob/`, `/cnt/usuarios-modulo/`, `/cnt/desbloquear-usuario/`.
- `/cnt/asientos-us/` (espejo del flujo asientos).
- `/cnt/aplicar-saldos-menores/`, `/cnt/generar-entrada-nomina/`, `/cnt/modificar-ed-nomina/`, `/cnt/modificar-historico-componente/`.
- `/cnt/presupuesto/inicial/`, `/cnt/presupuesto/ajustes/`, `/cnt/presupuesto/ejecucion/`.
- `/cnt/asiento/<no>/consulta/` (consulta de asiento agregando documentos origen TCxC/TCxP/TCHC/TACC/TACF).
- `/cnt/balance-general/`, `/cnt/anexos-ef/`, `/cnt/lineas-ef/` (CRUD), `/cnt/gastos-proyecto/`.
- `/cnt/cierre-anual/`.

### 3.3. Reportes PDF (extender `apps/legacy/pdf_helpers.py:build_pdf_report`)

Endpoints `/pdf/` para los 12 reportes listados en §2.2:

- `/cnt/balance/pdf/`
- `/cnt/mayor/pdf/`
- `/cnt/estado-resultados/pdf/`
- `/cnt/balance-general/pdf/`
- `/cnt/verificar-asientos/pdf/` (Rcnt210)
- `/cnt/historico-asientos/pdf/` (Rcnt316)
- `/cnt/historico-transacciones/pdf/` (Rcnt315)
- `/cnt/catalogo/pdf/` (Rcnt301)
- `/cnt/catalogo-sucursal/pdf/` (Rcnt317)
- `/cnt/centros-costo/pdf/` (Rcnt310)
- `/cnt/cuentas-con-centros/pdf/` (Rcnt311)
- `/cnt/proyectos/pdf/` (Rcnt312)
- `/cnt/presupuesto/pdf/` (Rcnt202 + Rcnt204 parametrizado)
- `/cnt/gastos-proyecto/pdf/` (Rcnt204 variante)

### 3.4. Bugs a corregir

- Crear `backend/docs/32_cnt_comparacion_legado_pendiente.md` con matriz completa.
- Cambiar `Dialog` por vista inline en catálogo / NCF / centros de costo.
- Validar reaplicación correcta de saldos en cierre mensual (regla `UPDATE TCNT_BCUENTA SET SALDO_MES_ANT=SALDO_MES_ANT+...`).
- Eliminar TODOs/FIXMEs en `cnt_repo.py` y `views.py` antes de cerrar (DoD §3.4).

---

## 4. Flujos críticos para E2E con Playwright (5)

1. **Crear asiento balanceado + autorizar + actualizar.** Precond: período abierto, catálogo con cuentas que aceptan movi. Pasos: navegar `?section=procesos&view=asientos` → nuevo asiento → 2 líneas D/H balanceadas → guardar → autorizar → actualizar. Verificar inserts en `TCNT_ASIENTO`, `TCNT_ASIENTOL`, `TCNT_MOVIMIENTO`, actualización en `TCNT_HCUENTA`.
2. **Generar Balance de Comprobación PDF.** Filtrar por empresa+punto+año+mes, ejecutar query, comparar suma debe = suma haber, descargar PDF, verificar header (razón social real, no "Empresa 01") y totales.
3. **Cierre mensual.** Período abierto → ejecutar cierre → verificar bloqueo de reproceso, generación de `TCNT_CIERRE`, traslado de saldos `SALDO_MES_ANT`, incremento de `MES_PROCESO`.
4. **Estado de Resultados + Balance General de cierre fiscal.** Generar EF agrupado por líneas `TCNT_LINEAS_EF`, comparar totales con legacy.
5. **Libro diario / histórico de transacciones.** Filtros año+mes+rango cuentas, salida tabular + PDF, conteo de filas idéntico a `TCNT_MOVIMIENTO` filtrado.

---

## 5. Queries a reconciliar con legacy

Procedimiento estándar §6 del meta-spec. Mínimo:

| # | Reporte | Query del clon (resumen) | `.rep` legacy |
|---|---|---|---|
| 1 | Balance comprobación | `SELECT cuenta, nombre, saldo_mes_ant, debitos, creditos, (saldo_mes_ant+debitos-creditos) saldo_final FROM TCNT_BCUENTA JOIN TCNT_CATALOGO USING(cuenta) WHERE no_cia=:1 AND punto=:2 ORDER BY cuenta` | Rcnt (balance) |
| 2 | Mayor general | `SELECT m.fecha, m.cuenta, m.tipo_movi, m.monto, m.no_asiento, m.detalle FROM TCNT_MOVIMIENTO m WHERE no_cia=:1 AND punto=:2 AND cuenta=:3 AND ano=:4 AND mes BETWEEN :5 AND :6 ORDER BY fecha, no_asiento` | Rcnt201.rep |
| 3 | Estado de resultados | Join `TCNT_LINEAS_EF` + `TCNT_CUENTAS_EF` + saldos por mes/cuenta. | Anexos EF |
| 4 | Libro diario | `SELECT a.no_asiento, a.fecha, a.detalle, l.cuenta, l.tipo_movi, l.monto FROM TCNT_ASIENTO a JOIN TCNT_ASIENTOL l USING(no_cia,punto,ano,mes,no_asiento) WHERE no_cia=:1 AND punto=:2 AND ano=:3 AND mes=:4 ORDER BY no_asiento, secuencia` | Rcnt316.rep |
| 5 | Verificación asientos | `SELECT no_asiento, SUM(decode(tipo_movi,'D',monto,0)) deb, SUM(decode(tipo_movi,'C',monto,0)) cre FROM TCNT_ASIENTOL ... GROUP BY no_asiento HAVING ABS(deb-cre)>0.01` | Rcnt210.rep |
| 6 | Presupuesto vs ejecutado | Join `TCNT_PRESUPUESTO` + sum de `TCNT_MOVIMIENTO` por cuenta/mes. | Rcnt202.rep / Rcnt204.rep |
| 7 | Histórico transacciones | `TCNT_MOVIMIENTO` filtrado por origen (CXC, FAT, CXP, CHC) con join al documento origen para descripción. | Rcnt315.rep |

Evidencia obligatoria: ejecutar cada query directa contra Oracle (SQL Developer) y comparar con `.rep` legacy. Subir screenshots a `backend/docs/captures/cnt/`.

Reglas técnicas críticas a respetar (meta-spec §4.4):

- Permisos vía `permissions_repo.get_for(user, 'CNT', no_cia, punto)` antes de cualquier mutación. `digitar_asiento`, `autorizar_asiento`, `hacer_cierre`, `consultar_balance` son flags en `TCNT_USUARIO`.
- Bind variables siempre. Cero string interpolation.
- Períodos cerrados (`TCNT_PUNTO.ESTA_EN_CIERRE_P = 'S'`) bloquean digitación / autorización; UI debe mostrar el estado y deshabilitar acciones.
- `TCNT_ASIENTO.ST_ANULADO` y `ACTUALIZADO` controlan flujo P→A→C; no permitir actualizar un asiento ya `ACTUALIZADO='S'`.

---

## 6. Opciones legacy descartadas con justificación

- **`Acceso de Usuario al Sistema (Fcnt601)`**: shell de login del legacy. Reemplazado por autenticación global del clon (Django auth) — no se replica como vista del módulo.
- **`Mantenimiento de Anexos y Est. Financieros (Fcnt411-419)`** como editor visual del legacy: se conserva la capacidad funcional (CRUD de `TCNT_LINEAS_EF` y `TCNT_CUENTAS_EF`) en una sola vista inline simplificada; no se replica el editor paginado del legacy.
- **Multi-moneda US**: si el usuario confirma que la empresa activa NO opera en US (TCNT_CIAS.TASA_US vacío), se aplaza para un sprint posterior y se documenta como gap consciente; si opera en US, va dentro del scope.
- **Menú `Sigaf/Window/Salir`**: parte del shell global del clon (Header + ProfileDropdown). No es opción CNT.
- **Auditoría TCNT_AUDITA_MOVI / TCNT_AUDITORIA**: tablas legacy de auditoría se mantienen escribibles por triggers Oracle, sin UI de consulta dedicada (auditoría se consulta directo en BD).

---

## 7. Estimación

- **Vistas faltantes (configuración + procesos + consultas + reportes)**: ~18 vistas inline densas.
- **Endpoints backend nuevos**: ~22 (incluye CRUD proyectos / componentes / localidades / depts / direcciones / catálogo gob / tipos-ncf + multi-moneda + procesos + EF).
- **PDF endpoints**: 12-14 reportes envolviendo `build_pdf_report`.
- **Reconciliación SQL**: 7 reportes clave + las variantes (~12 queries documentadas).
- **Playwright E2E**: 5 flujos.
- **Limpieza**: dialog→inline (3 vistas), grep TODOs (0 matches), docs/32 audit matriz.

**Tareas atómicas del plan hijo**: ~36.
**Esfuerzo agregado estimado**: 50-65 horas (1.5-2 sprints).

---

## 8. Memorias relacionadas (MCP `facture-project`)

- `cnt/estabilizacion-2026-05-11`
- `handoff/estado-cnt-2026-05-13`
- `cnt/navegacion-global-2026-05-13`
- `cnt/comparacion-legado-pendiente-2026-05-13`
- `handoff/contexto-cnt-2026-05-13`
- `reference/capturas-legado-ubicacion` (capturas `contabilidad/` con 49 PNGs)
- `sigaf/module-memory-20260530-final/contabilidad/part-*`
- Skill agent: `oracle-sigaf-erp`
- Skill: `cnt-legado-architecture`
