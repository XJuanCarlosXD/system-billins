# Auditoría SDN — clon vs legado (2026-07-07)

Profundiza el smoke del 2026-07-02. Método: inventario desde
`memoria_nomina.md` (~60 artefactos propios), mapeo forma-por-forma y sondeo
read-only de los 24 endpoints `/api/sdn/*` con producción real.

## Resumen

- ~60 artefactos legacy (33 mantenimientos, ~15 nómina/TSS/regalía,
  8 vacaciones, 12 acciones de personal).
- **Ciclo básico de nómina con paridad verificada**: definición → movimientos →
  deducción masiva → calcular → volante → informe → solicitud de cheques.
- **El legado SDN es mucho más ancho que el clon**: TSS/DGT/banco, regalía y
  bonificaciones, y todo el subsistema de acciones de personal no existen.
- Contexto de negocio: 5 empleados activos en cia01, 1 nómina definida
  (ADMINISTRATIVA, quincenal, período jun-2026, sin correr aún).
- 0 bloqueantes técnicos: lo implementado responde bien.

## Verificación en vivo (2026-07-07, producción, read-only)

| Endpoint | Resultado |
|----------|-----------|
| cias/afp/ars/gerencias/areas/deptos | 200 — 5/6/6/1/1/1 |
| ingresos/deducciones (conceptos) | 200 — 7/15 |
| empleados (cia01) | 200 — 5, keys completas (cédula, fechas, centro, nómina) |
| nominas | 200 — 1 (ADMINISTRATIVA Q, 2026-06-16→30, ctas 2104-02/789953791) |
| nominas/volante (nomina=01) | 200 — cabecera+empleados+totales ✅ |
| rep-informe (2026/06 p1) | 200 — cabecera+empleados+totales ✅ |
| informe-nomina/print-data | 200 — filas+totales ✅ |
| rep-rnc + rnc-empleados/print-data | 200 — 5 empleados ✅ |
| rep-empleados (resumen) | 200 — total/activos/egresados/fijos |
| vacaciones, movimientos | 200 — 0 filas (nómina sin correr; esperado) |
| nominas/{01}/print-data | 200 |

Calcular/gen-cheques: solo-render (regla de producción); pendiente correr una
nómina de prueba supervisada (ya registrado el 2026-07-02).

## Mapeo legacy → clon

Cubiertos: Fsdn101→/sdn/cias · Fsdn115→afp · Fsdn116→ars · Fsdn107→gerencias ·
Fsdn108→areas · Fsdn109→deptos · Fsdn124→ingresos · Fsdn125→deducciones ·
Fsdn117/301→empleados · def-nominas · Fsdn204/205→movimientos ·
Fsdn206→calcular · Fsdn207→rep-informe (+print-data) · Fsdn219/409→gen-cheques ·
Fsdn401→gen-vacaciones · volante/pre-nómina · nóminas procesadas ·
catálogo conceptos · RNC empleados (DGII) · Fsdn103/601→admin usuarios.

## Gaps por severidad

### Mayores (obligaciones legales/regulatorias RD)
- [ ] **TSS**: Fsdn310 (generar datos TSS) y Fsdn312 (archivo
  autodeterminación) no existen. La autodeterminación TSS es obligación
  mensual — hoy tendría que hacerse a mano en SUIR+.
- [ ] **Regalía pascual e ISR**: FSDN305 (reporte regalía/ISR), FSDN309
  (constancia pago regalía), FSDN315 (bonificaciones) no existen. Obligación
  legal de diciembre.
- [ ] **DGT (Ministerio de Trabajo)**: FSDN314 DGT4, Fsdn408 DGT3,
  Fsdn405 archivo vacaciones — no existen.
- [ ] **Archivo al banco** (Fsdn209/FSDN313): pago electrónico de nómina no
  existe; hoy la vía es gen-cheques.
- [ ] **Acciones de personal (FSDN501-511)**: variaciones de salario,
  autorización de acciones, traslados entre compañías, consultas — subsistema
  RRHH completo ausente. Con 5 empleados el impacto es bajo, pero las
  variaciones de salario sin traza son riesgo laboral.
- [ ] **Escalas IRS/TSS sin mantenimiento** (Fsdn119/120/122/123): si el
  cálculo las tiene embebidas, cada cambio anual de la DGII exige tocar código.
  Verificar dónde lee el cálculo las escalas.

### Menores
- [ ] Vacaciones parcial: existe generar+listado; faltan mantenimiento
  (Fsdn402), cálculo (Fsdn403), proceso (Fsdn407) y reportes (Fsdn404/406).
- [ ] Histórico de salario (FSDN308) e histórico de nómina (Fsdn213).
- [ ] Horas laboradas por empleado (Fsdn217) · cargar ingresos desde Excel
  (Fsdn222) · distribución de monedas (Fsdn311).
- [ ] Mantenimientos nicho: centros de trabajo, beneficiarios, puestos,
  países, profesión, nivel académico, parentesco, días feriados, cuentas
  ingresos/deducciones (Fsdn126/127), grupo contable (Fsdn132), tipo de
  gastos (Fsdn104).
- [ ] **PDF volante individual** — planificado ('volante-pago'), sigue
  pendiente (el volante existe como vista, no como impreso individual).

## Evidencia
- Sondeos `/tmp/sdn_probe*.sh` (contenedor facturation_backend, 2026-07-07).
  Solo GET/login; sin escrituras.
- Inventario legacy: `memorias_por_modulo/memoria_nomina.md`.
- Endpoints: `backend/apps/legacy/sdn_urls.py` (24 rutas).
