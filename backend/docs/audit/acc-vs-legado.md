# Auditoría ACC — clon vs legado (2026-07-07)

Profundiza el smoke del 2026-07-02. Método: inventario desde
`memoria_adm_caja_chica.md` (~20 artefactos propios), mapeo forma-por-forma y
sondeo read-only de los 33 endpoints `/api/acc/*` con producción real.

## Resumen

- ~20 artefactos legacy propios (varios compartidos con CXP).
- **Módulo en uso productivo activo**: 200+ documentos ene–jun 2026,
  72 reposiciones, cierres aplicados (64 registros).
- Cobertura casi completa. **1 bug real encontrado** (print del comprobante
  individual sale vacío) y 2 gaps funcionales.
- 0 bloqueantes.

## Verificación en vivo (2026-07-07, producción, read-only)

| Endpoint | Resultado |
|----------|-----------|
| cias/puntos/cajas | 200 — 1/1/2 |
| beneficiarios/tipos-bene/tipos-gasto | 200 — 10/2/12 |
| documentos (cia01) | 200 — 200 filas, keys completas (NCF, RNC, tipo gasto, st_generado_cnt, reposición) |
| reposiciones | 200 — 72 |
| docs-pendientes-reposicion | 200 — 0 (todo repuesto; consistente) |
| cierre/status | 200 — docs sin contabilizar / sin reposición |
| cierre (historial) | 200 — 64 |
| asiento mayo-2021 | 200 — 0 líneas (ACC empezó 2026; esperado) |
| rep-resumen + rep-gastos-tipo | 200 — totales + 12 tipos |
| print-data: resumen (12 filas), listado (2,000 filas), reposición 72 (36 líneas) | 200 ✅ |
| print-data documento individual 00002844 | 200 pero **payload vacío — BUG** |

## Bug encontrado

- [ ] **`acc_documento_print_data` imprime el comprobante sin contenido.**
  En `backend/apps/legacy/docs_print_data.py:1661` el mapeo lee
  `doc_full.get('beneficiario')`, `doc_full.get('monto')/('total')` y
  `doc_full.get('lineas')/('detalle_cuentas')`, pero `acc_repo.get_documento`
  devuelve `nombre_bene`, `valor` y `detalle`, y las líneas contables están en
  `acc_repo.list_lineas_documento()` **que nunca se invoca**. Resultado
  verificado en producción: cabecera OK (ACC-00002844) pero beneficiario
  vacío, `lineas: []` y total 0. Fix: usar las claves reales + llamar
  `list_lineas_documento`.

## Mapeo legacy → clon

Cubiertos: Facc101→cias · Facc102→puntos · Facc104→cajas ·
Facc105→tipos-gasto · Facc106→tipos-bene · Facc107→beneficiarios ·
Facc201→nuevo-egreso · Facc202→reposición print-data · Facc205→anular
reposición · Facc501→documentos · Facc502→reposiciones ·
Facc401/402→asiento · Facc403→cierre · racc201→(consulta docs pendientes) ·
racc301-304→rep-resumen/gastos-tipo + print-data · Facc103/601→admin
usuarios · Fcxp202/204→CXP saldos-menores.

## Gaps por severidad

### Mayores
- [ ] **Facc203 Generar Solicitud de Cheque de Reposición**: la reposición
  clon registra `cuenta_banco`/`no_cheque`/`no_docu_chc` como texto, pero no
  genera la solicitud (SO) en CHC como el puente CxP→CHC ya implementado
  (commit 5ac1a58). Mismo patrón, tabla TCHC_CHEQUE.
- [ ] **Facc204 Corregir NCF y Otros Datos** no existe — con documentos ya
  contabilizados, corregir un NCF mal digitado hoy exige anular y recrear.

### Menores
- [ ] racc203 reporte "FACTURACION" — sin evidencia clara de contenido en la
  memoria legacy (no mapeado; marcar "no evidencia").
- [ ] `documentos/listado/print-data` devolvió 2,000 filas — confirmar tope
  intencional y filtros de fecha por defecto en la UI.

## Evidencia
- Sondeos `/tmp/acc_probe.sh` + `/tmp/acc_doc.sh` (contenedor
  facturation_backend, 2026-07-07). Solo GET/login; sin escrituras.
- Inventario legacy: `memorias_por_modulo/memoria_adm_caja_chica.md`.
- Endpoints: `backend/apps/legacy/acc_urls.py` (33 rutas).
