# Auditoría CHC — clon vs legado (2026-07-07)

Profundiza el smoke del 2026-07-02. Método: inventario desde
`memoria_cheques.md` (~45 artefactos propios), mapeo forma-por-forma,
sondeo read-only de los 26 endpoints `/api/chc/*` con producción real,
y verificación de queries contra Oracle (TCHC_CHEQUE/TCHC_BCUENTA).

## Resumen

- ~45 artefactos legacy propios (12 mantenimientos, 17 transacciones,
  7 conciliación, 7 consultas, ~20 `.rep`).
- **Núcleo operativo con paridad verificada en vivo**: solicitar → imprimir →
  entregar → conciliar → cerrar conciliación, consultas y 4 reportes.
- **1 gap funcional en conciliación** (desconciliar), **3 familias sin
  implementar** (pagos recurrentes, pago electrónico, certificado retención),
  resto de PDFs pendientes.
- 0 bloqueantes: nada roto en lo implementado.

## Verificación en vivo (2026-07-07, producción, read-only)

| Endpoint | Resultado |
|----------|-----------|
| cias/bancos/tipos-docu | 200 — 5/5/9 filas |
| puntos, cuentas, cheques (no_cia=01) | 200 — 1/6/200 filas ✅ |
| cuentas/saldo (030-011926-7) | 200 — saldo_aprox |
| rep-balance, rep-disponibilidad | 200 — 6 cuentas c/u |
| rep-movimientos mayo-2021 (030-011926-7) | 200 — **84 movs, D=2,169,247.44 C=1,925,742.73, saldo corrido** ✅ |
| rep-diario mayo-2021 | 200 — **219 movs (205 activos/14 nulos), neto 598,769.52** ✅ |
| rep-resumen-cuenta | 200 — totales cheques/débito/crédito/nulos/conciliados/entregados |
| cheques/print-data (Rchc503) | 200 — 500 filas + totales |
| print-data: movimientos/diario/disponibilidad/cheque individual | 200 ✅ |

Oracle base verificada: TCHC_CHEQUE cia01 = 6 cuentas, 7,860 cheques activos
2021-2025; TCHC_BCUENTA en período 2025/03 (cta 31530100013957 en 2025/01).

Nota de sondeo: los reportes usan `fecha_desde/fecha_hasta` (no `desde/hasta`);
el frontend los manda bien — sin bug. CHC exige `no_cia` explícito (default '')
mientras CXC usa default '01' — inconsistencia cosmética entre módulos.

## Mapeo legacy → clon

Cubiertos: Fchc101→/chc/cias · Fchc102→puntos · Fchc104→tipos-docu ·
Fchc105→bancos · Fchc106→cuentas · Fchc201→solicitar · Fchc203→(vía tipos
DB/CR en solicitar, sin pantalla dedicada) · Fchc205→imprimir · Fchc206→anular ·
Fchc207→entregar · Fchc701/702→conciliar (+bulk) · Fchc704→rep-balance ·
Fchc706→cierres/conciliacion · Fchc501→cheques · Fchc502→rep-movimientos
(Rchc501) · Fchc503→saldos · Rchc502→rep-balance · Rchc503→cheques/print-data ·
Rchc505→rep-disponibilidad · rchc202/203→rep-diario · Fchc401→rep-diario ·
Fchc103/601→admin usuarios (plan Settings+Access) · Fcxp202/204→CXP
saldos-menores.

## Gaps por severidad

### Mayores
- [ ] **Fchc705 Reversar Conciliación (desconciliar) no existe.**
  `marcar_conciliado` solo marca; si el operador concilia por error no hay
  vuelta atrás desde la UI. Es parte del ciclo mensual de conciliación.
- [ ] **Pagos recurrentes (Fchc212 mantenimiento + Fchc213 generar)** no
  existen. Decisión de negocio: ¿se usan pagos recurrentes hoy?
- [ ] **Fchc505 Certificado de Retención a Proveedores** no existe — documento
  fiscal (retenciones a proveedores para DGII). Verificar obligación.
- [ ] **PDFs restantes**: rchc207 (cheques entregados), rchc217 (solicitudes
  con detalle), rchc218/219 (libro diario con detalle/depósitos), rchc249
  (autorización de pagos), Rchc509 (documentos por proveedores), rchc701
  (balance conciliado impreso), Fchc210 (impresión de solicitud individual),
  Fchc211 (reembolso de fondo). Implementados hoy: 4 print-data + cheque
  individual + listado Rchc503.

### Menores
- [ ] Fchc703 Digitar Dr/Cr que no corresponden (ajustes de conciliación
  manuales) — hoy habría que digitar un documento DB/CR normal.
- [ ] Fchc217 Corregir NCF (lado CHC) — CXC tiene el suyo; CHC no.
- [ ] Fchc504 Consulta de Documentos Origen Banco · Fchc510 Notificación de
  Pago · Fchc107 Asignar Cuentas a Sucursales · Fchc110+Fchc216 pago
  electrónico (archivo banco) — nicho, confirmar si el negocio los usa.
- [ ] `rep-resumen-cuenta` y otros endpoints devuelven datos sin exigir
  filtros de fecha (riesgo de payload grande a futuro; hoy volumen manejable).

## Evidencia
- Sondeos `/tmp/chc_probe*.sh` + `/tmp/chc_oracle.py` (contenedor
  facturation_backend, 2026-07-07). Solo GET/login; sin escrituras.
- Inventario legacy: `memorias_por_modulo/memoria_cheques.md`.
- Endpoints: `backend/apps/legacy/chc_urls.py` (26 rutas).
