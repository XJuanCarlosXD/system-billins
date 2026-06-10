# Plan ejecución — CHC (Cheques y Conciliación Bancaria)

- **Fecha:** 2026-05-31
- **Spec referenciado:** `2026-05-30-chc-completar-modulo-design.md`
- **Meta-spec:** `2026-05-30-sigaft-meta-validacion-modulos-design.md`
- **Estado inicial:** módulo en stub cero (sin backend, sin frontend en la VM).
- **Total de tareas:** 48
- **Convención:** cada tarea ≈2-4h; dependencias indicadas.

---

## Fase 0 — Preparación (3 tareas)

- [ ] **T01.** Auditar capturas legado en `capturas\cheques\*.png` y producir un CSV `chc_legacy_menu_inventory.csv` con (opción menú, label visible, .fmx referenciado, .rep usado). Verifica el inventario inferido en la memoria y resuelve las opciones sin label (Fchc202, Fchc208, Rchc201/208/209/210/213/227/232/233).
- [ ] **T02.** Crear estructura mínima en backend: `apps/chc/__init__.py`, `apps/chc/urls.py`, `apps/chc/views.py`, `apps/legacy/repositories/chc_repo.py` (esqueleto con docstring). Registrar en `urls.py` raíz.
- [ ] **T03.** Crear estructura mínima en frontend: `features/chc/`, `routes/_authenticated/chc/index.tsx`, `routes/_authenticated/chc/layout.tsx` con sidebar provisional. `pnpm typecheck` verde.

## Fase 1 — Catálogos / Configuración (8 tareas)

- [ ] **T04.** `chc_repo`: CRUD `TCHC_BANCO` (list, get, create, update, soft-delete vía ACTIVO). Endpoints `/api/chc/bancos/`. Vista `chc/bancos/`.
- [ ] **T05.** `chc_repo`: CRUD `TCHC_DCUENTA` (cuentas bancarias maestras: CUENTA_BANCO, NOMBRE, BANCO, MONEDA, PERMITIR_SOBREGIRO, DIAS_TRANSITO, CUENTA contable). Endpoints + vista `chc/cuentas-bancarias/`.
- [ ] **T06.** `chc_repo`: matriz `TCHC_BCUENTA` (cuenta×sucursal con saldos). Endpoint `/api/chc/asignaciones-cuenta-sucursal/`. Vista `chc/asignar-cuentas-sucursales/`.
- [ ] **T07.** `chc_repo`: `TCHC_CIAS` + `TCHC_PUNTO` CRUD light (read + activar/desactivar). Vistas `chc/companias/`, `chc/sucursales/`.
- [ ] **T08.** `chc_repo`: `TCHC_TDOCU` tipos de documento de cheques. Vista `chc/tipos-documento/`.
- [ ] **T09.** `chc_repo`: permisos usuario `TCHC_USUARIO`, `TCHC_USUARIOC` (por cuenta), `TCHC_USUARIOD` (por tipo doc). Endpoints + vista `chc/usuarios-permisos/` con sub-tabs.
- [ ] **T10.** `chc_repo`: `TCHC_BANCOS_AFILIADOS` (pago electrónico). Vista `chc/bancos-afiliados-pago-electronico/`.
- [ ] **T11.** Wrapper `permissions_repo.get_for(user,'CHC',no_cia,punto)` reutilizando patrón FAT. Validar 403 en todos los endpoints.

## Fase 2 — Cheques y operaciones (10 tareas)

- [ ] **T12.** `chc_repo.list_cheques(filters)` paginado con bind params, JOIN TCHC_CHEQUE+TCHC_DCUENTA. Endpoint `GET /api/chc/cheques/`. Vista `chc/cheques/` con tabla filtrable.
- [ ] **T13.** `chc_repo.get_cheque_detail(tipo,no)` con encabezado + detalle TCHC_DCCHEQUE. Endpoint + vista `chc/cheques/:id/` con 3 tabs (datos, documentos pagados, reimpresiones).
- [ ] **T14.** `chc_repo.crear_cheque(payload)`: lock TCHC_SECUENCIA, insert TCHC_CHEQUE + TCHC_DCCHEQUE, marcar TCXP_DOCUMENTO pagado, actualizar TCHC_BCUENTA saldo. Transacción única. Endpoint + vista `chc/cheques/nueva/`.
- [ ] **T15.** Solicitudes de cheque: list + emit + impresión (TCHC_OTROSDOCU según operaciones detectadas). Vistas `chc/solicitudes/`.
- [ ] **T16.** Anular cheque: `POST /api/chc/cheques/:tipo/:no/anular/` — revertir saldo TCHC_BCUENTA, devolver documentos CxP a pendiente, set ST_NULO='N'. Vista action confirm.
- [ ] **T17.** Imprimir / reimprimir cheque PDF (template específico para chequera, no es reporte). Registrar reimpresión en TCHC_REIMPRESO con motivo. Endpoint `/api/chc/cheques/:tipo/:no/imprimir/` y `/reimprimir/`.
- [ ] **T18.** Entrega de cheques: `POST /api/chc/cheques/:tipo/:no/entregar/` con captura firma/notas + vista `chc/entrega-cheques/`.
- [ ] **T19.** Corregir NCF: vista + endpoint que actualiza NCF respetando schema DGI (`POSICIONES_FIJAS_NCF || LPAD(NCF,8,'0')`).
- [ ] **T20.** D/C Origen empresa (Fchc703-style): insertar en TCHC_OTROSDOCU + reverso. Vista `chc/debito-credito-origen/`.
- [ ] **T21.** Pagos recurrentes: CRUD TCHC_PAGO_RECURRENTE + acción "Generar" que crea cheques en lote. Vista `chc/pagos-recurrentes/`.

## Fase 3 — Pago electrónico + Saldos menores + Otros (3 tareas)

- [ ] **T22.** Generar archivo Pago Electrónico (ACH): seleccionar cheques, generar archivo bancario según formato Fchc110. Endpoint `/api/chc/pago-electronico/archivo/`. Vista `chc/pago-electronico/`.
- [ ] **T23.** Saldos menores: endpoints `/saldos-menores/generar/` y `/aplicar/`. Vista combinada `chc/saldos-menores-ajuste/`.
- [ ] **T24.** Certificado retención proveedores (Fchc505): generación TCHC_CERTIFICADO_TMP + PDF certificado. Vista `chc/certificado-retencion/` + endpoint PDF.

## Fase 4 — Conciliación bancaria (6 tareas — núcleo)

- [ ] **T25.** `chc_repo.conciliacion_pendientes(cuenta,mes,ano)` con SQL filtrando TCHC_CHEQUE WHERE ST_CONCILIADO='N'. Endpoint `GET /api/chc/conciliacion/pendientes/`.
- [ ] **T26.** Vista `chc/conciliacion/` con selector cuenta+mes y 2 tabs (Por Documento / Por Lote). Tabla con checkbox multi-select.
- [ ] **T27.** `chc_repo.marcar_conciliado(docs)` transaccional: set ST_CONCILIADO='S' + FECHA_CONCILIACION + actualizar TCHC_BCUENTA.SALDO_INICIAL_B según regla DECODE detectada (`'P',valor,'D',valor,-valor`). Endpoint `POST /conciliacion/marcar/`.
- [ ] **T28.** `chc_repo.reversar_conciliacion(docs)` — opera al revés del T27. Vista `chc/conciliacion/reversar/` + endpoint.
- [ ] **T29.** Vista `chc/conciliacion/dr-cr-no-correspondientes/` (Fchc703) + endpoint para registrar partidas que no corresponden a la cuenta.
- [ ] **T30.** Cierre de conciliación: `POST /api/chc/conciliacion/cerrar/` que valida balance, set TCHC_CUENTAH.CONCILIACION_CERRADA='S', genera registro en TCHC_CIERRE_CONCILIACION. Vista `chc/conciliacion/cerrar/`. Validar precondición: no debe haber documentos pendientes ni partidas DR/CR no correspondidas sin resolver.

## Fase 5 — Cierre módulo + integración contable (3 tareas)

- [ ] **T31.** `chc_repo.cierre_diario(fecha)` (Fchc401): genera entrada de diario consolidando movimientos del día. Endpoint + vista `chc/cierre/diario/`.
- [ ] **T32.** `chc_repo.cierre_mensual(cuenta,mes,ano)` (Fchc402+Fchc403): valida conciliación cerrada, valida `CERRAR_SIN_MOVI`, valida saldo coherente con `PERMITIR_SOBREGIRO`, hace UPDATE TCHC_CHEQUE.ST_GENERADO_CNT='S', UPDATE TCHC_DCCHEQUE.NO_ASIENTO/ANO_ASIENTO/MES_ASIENTO, DELETE TCHC_ED WHERE usuario y crea asiento en CNT (vía endpoint CNT existente o `cnt_repo.crear_asiento`). Endpoint + vista `chc/cierre/mensual/`.
- [ ] **T33.** Reversar cierre mensual (rollback con auditoría). Endpoint + acción en vista.

## Fase 6 — Consultas (5 tareas)

- [ ] **T34.** `chc/consultas/cheques/` — búsqueda avanzada multi-filtro con export CSV.
- [ ] **T35.** `chc/consultas/documentos-origen-banco/` — listar documentos asociados a movimientos bancarios.
- [ ] **T36.** `chc/consultas/historico-balance/` — TCHC_CUENTAH histórico por mes/año.
- [ ] **T37.** `chc/consultas/movimientos-cuenta/` — front del Rchc501 con paginación + drill-down.
- [ ] **T38.** `chc/exportar-excel/` — endpoint que devuelve XLSX para conciliación manual offline.

## Fase 7 — Reportes PDF (8 tareas, 22 reportes agrupados)

- [ ] **T39.** **P0 críticos (5 reportes):** Rchc501 Movimiento Cuenta, Rchc502 Balance Cuentas, Rchc505 Disponibilidad Bancaria, Rchc218 Libro Diario Cheques Detalle, Rchc701 Conciliación. Cada uno: endpoint `/api/chc/reportes/.../pdf/` + entrada en hub `chc/reportes/`. Reconciliación SQL legacy obligatoria.
- [ ] **T40.** **P0 listados diarios (3 reportes):** Rchc202 Listado Diario Cheque, Rchc203 Listado Diario D/C, Rchc219 Listado Diario D/C/Depósito. Reconciliación SQL.
- [ ] **T41.** **P1 operativos (5 reportes):** Rchc503 Cheques por Cuenta, Rchc207 Cheques Entregados, Rchc217 Solicitud Detalle, Rchc249 Autorización Pago, Rchc509 Documentos por Proveedor.
- [ ] **T42.** **P1 retenciones:** Rchc505/Fchc505 Certificado Retención Proveedor (PDF cliente final).
- [ ] **T43.** **P2 sin label (8 reportes):** Rchc201, Rchc208, Rchc209, Rchc210, Rchc213, Rchc227, Rchc232, Rchc233. Para cada uno: revisar captura legado (T01), decidir si se mantiene o se descarta con justificación en spec §6.
- [ ] **T44.** Hub `chc/reportes/` UI: 22 tarjetas categorizadas (Movimientos, Listados, Conciliación, Autorización, Certificados). Cada tarjeta abre modal con filtros y dispara descarga PDF.
- [ ] **T45.** Verificar header/footer estándar del meta-spec §5 en TODOS los PDFs CHC (razón social real desde TCNT_CIAS, usuario, fecha, filtros visibles, página X/Y).
- [ ] **T46.** Documentar reconciliación SQL para los 22 reportes en `backend/docs/chc_sql_reconciliation.md` siguiendo procedimiento meta-spec §6.

## Fase 8 — E2E + DoD (2 tareas)

- [ ] **T47.** Implementar 5 tests Playwright en `frontend/e2e/chc/`:
  - `01-emitir-cheque.spec.ts`
  - `02-conciliar-lote-y-cerrar.spec.ts`
  - `03-anular-cheque.spec.ts`
  - `04-reporte-libro-diario.spec.ts` (verifica PDF generado + totales coinciden con SQL contra Oracle)
  - `05-cierre-mensual-con-asiento.spec.ts`
  Cada test: HTTP 2xx, sin console.error, screenshot en `backend/docs/captures/chc/`.
- [ ] **T48.** Cierre del módulo: ejecutar `grep -rE "TODO|FIXME|XXX" backend/apps/chc/ frontend/src/features/chc/` (debe ser cero). `pnpm typecheck` verde. `python -c "import ast; ast.parse(...)"` por archivo Python antes de pscp. Actualizar `00_roadmap_avance.md` con DoD 3.1-3.4 verificado. Crear PR con evidencia de reconciliación SQL + capturas de E2E.

---

## Mapa Tarea → Spec §

| Sección spec | Tareas |
|--------------|--------|
| §3.1 Vistas | T03, T04-T10, T12-T24, T26, T28-T38 |
| §3.2 Endpoints | T04-T10, T12-T24, T25-T33 |
| §3.3 Reportes PDF | T39-T46 |
| §4 Flujos E2E | T47 |
| §5 Reconciliación SQL | T46 + verificación en T39-T43 |
| §6 Descartes | T01 + T43 |
| §7 Estimación | Total 48 tareas |

## Dependencias críticas

- **T02, T03** bloquean a todas las demás (estructura base).
- **T04, T05** bloquean a T06, T12, T22 (necesitan bancos + cuentas).
- **T14** (crear cheque) requiere CxP backend operativo: T14 puede iniciar usando lecturas de `TCXP_DOCUMENTO` aunque CxP frontend siga stub.
- **T27, T28** dependen de T14 (datos para conciliar).
- **T30** depende de T27 y T29 (cierre requiere todo conciliado).
- **T32** depende de T30 (cierre módulo requiere conciliación cerrada) + endpoint CNT activo.
- **T39-T46** pueden ejecutarse en paralelo entre sí una vez T04-T14 están listos (suficientes datos).
- **T47** después de T46 (necesita backend completo).

## Estrategia de ejecución

- Las **Fases 0-2** son secuenciales (~25 tareas).
- Las **Fases 3-6** se pueden paralelizar parcialmente con sub-agentes (Fase 4 conciliación y Fase 7 reportes son los buckets más grandes y se prestan a dispatching).
- La **Fase 7** se entrega en tres oleadas: P0 (T39+T40), P1 (T41+T42), P2 (T43 con descartes).
- Verificación incremental: deploy a VM `pscp` después de cada Fase, verificar sin regresiones en módulos vecinos (FAT, CxP, CNT).

## Riesgos identificados

1. **Saldos descuadrados por race condition** entre emisión de cheque y conciliación. Mitigación: transacción explícita Oracle con SELECT FOR UPDATE en TCHC_BCUENTA al modificar saldos.
2. **TCHC_SECUENCIA contención** si dos usuarios emiten al mismo tiempo. Mitigación: SELECT FOR UPDATE de la fila secuencia.
3. **Diferencia entre 22 reports inferidos y 93 conteo MCP** — T01 + T43 deben acotarlo antes de cerrar; lo que no se halle, se documenta como descarte fundamentado.
4. **Asiento contable del cierre mensual** debe ser idempotente y reversible. Mitigación: dry-run obligatorio antes de commit + endpoint reversal (T33).
