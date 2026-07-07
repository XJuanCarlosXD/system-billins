# Auditoría CXC — clon vs legado (2026-07-07)

Profundiza el smoke del 2026-07-02 (`cxc-chc-sdn-odc-acc-acf-vs-legado.md`).
Método: inventario completo desde `memoria_cuentas_por_cobrar.md` (58 artefactos),
mapeo forma-por-forma a rutas clon, y sondeo read-only de los 27 endpoints
`/api/cxc/*` con datos reales de producción (usuario JCABREU, sin escrituras).

## Resumen

- **58 artefactos legacy** inventariados (21 mantenimientos, 11 transacciones,
  3 procesos, 5 consultas, 18 formas de reporte, ~14 `.rep`, menús/salir excluidos).
- **33 con paridad funcional verificada en vivo** (endpoint 200 + datos reales).
- **4 gaps mayores** (abajo). **8 formas legacy sin equivalente** (menores/nicho).
- **0 bloqueantes**: nada roto; los 27 endpoints respondieron, 38/38 vistas con `@_auth`.

## Verificación en vivo (2026-07-07, producción, read-only)

| Endpoint | Resultado |
|----------|-----------|
| cias/puntos/tdocu/tcli/supervisores/vendedores/tcontable/ciudades/barrios/zonas/cadenas | 200 — 5/1/11/34/2/8/1/9/60/1/1 filas |
| clientes (paginado 50/pág) | 200, keys completas (rnc, límite crédito, vendedor, zona, ruta) |
| documentos (paginado 50/pág) | 200, 150ms |
| estado-cuenta?no_cliente=239 | 200 — totales + aging + documentos ✅ |
| balance-clientes | 200 — 114 clientes con aging 0-30/31-60/61-90/+90 ✅ |
| historico?no_cliente=239 | 200 — 526 movs |
| libro-ventas 2021-Q1 | 200 — 574 filas |
| rep-cobros-vendedor 2021 | 200 — 5 vendedores |
| rep-comisiones 2021 | 200 — 5 filas |
| rep-ncf 2021 | 200 — 2,764 NCF, 81ms |
| asiento-contable mayo-2021 | 200 — 31 líneas |
| documentos/0009450/print-data/ y estado-cuenta print-data | 200 — payload completo p/ impresión |
| rutas, clientes-ruta | 200 pero **0 filas** (negocio no usa rutas — verificar si es esperado) |

Recibo de ingreso E2E (con rollback) ya validado el 2026-07-02: distribución
1101-01 DR / 1103-01 CR correcta.

## Mapeo legacy → clon

Cubiertos (33): Fcxc101→/cxc/cias · Fcxc102→puntos · Fcxc104→tdocu ·
Fcxc105→tcli · Fcxc106→supervisores · Fcxc107→vendedores · Fcxc109→rutas ·
Fcxc110→tcontable · Fcxc111→ciudades · Fcxc112→barrios · Fcxc113→zonas ·
Fcxc114→cadenas · Fcxc115→clientes · Fcxc116→cliente-ruta ·
Fcxc117/118/501→documentos · Fcxc201→transacciones · Fcxc202+204→saldos-menores ·
Fcxc208→reversar · Fcxc209→pagos-masivos · Fcxc210→liberar-credito ·
Fcxc211→corregir-ncf · Fcxc320→rep-envejecimiento · Rcxc302/Fcxc318→rep-cobros-vendedor ·
Fcxc401→asiento-contable · Fcxc402→generar-asiento · Fcxc403→cierre ·
Fcxc502→balance · Fcxc503→historico · Fcxc505→clientes · estado-cuenta ·
libro-ventas · rep-ncf · Fcxc103/601→admin usuarios (plan Settings+Access).

## Gaps por severidad

### Mayores
- [ ] **PDFs CXC: cero endpoints.** El legado tiene ~14 `.rep`
  (rcxc101 recibos, rcxc201 movs pendientes, rcxc202 rev. saldos, rcxc204/207
  listados DR/CR, Rcxc302 ingresos-cobros vendedor, Rcxc309 docs por cobrar,
  Rcxc319 por ciudad, Rcxc315/318/327/329/332/336). El clon solo imprime por
  navegador (print-data de documento y estado de cuenta). CXP y CHC ya usan la
  familia `reporte` con `reporteGenericoDefault` — replicar ese patrón aquí.
- [ ] **Familia de comisiones incompleta.** Legado: 12+ formas (por producto
  Fcxc315/317, zona-producto Fcxc304/306, tipo vend-producto Fcxc302/303,
  supervisores/cobradores Fcxc307, % por rango de días Fcxc308, por factura
  Fcxc309, sobre cobros Fcxc301). Clon: una sola vista rep-comisiones.
  Requiere decisión de negocio: ¿qué esquemas de comisión se usan hoy?
- [ ] **Fcxc314 Mayor Auxiliar de CxC** no existe (balance + estado de cuenta
  cubren parte, pero no el mayor auxiliar contable por cuenta/período).
- [ ] **Fcxc212 Enviar e-NCF a la DGII** no existe. Decisión de negocio:
  ¿la empresa está obligada a e-CF ya? Si sí, es bloqueante fiscal.

### Menores (formas nicho sin equivalente)
- [ ] Fcxc108 Grupo de Ruta · Fcxc119 Cías con maestros iguales ·
  Fcxc120 Cambiar vendedor masivo a clientes/docs · Fcxc123 coordenadas desde
  Excel · Fcxc205 Ingresos mensuales · Fcxc206 Aplicación de movs con saldo ·
  Fcxc207 Cheques futuristas · Fcxc506 Consulta documentos con cuotas.
- [ ] `/api/cxc/historico/` sin filtros devuelve **14,610 filas** (sin tope
  server-side). El frontend siempre manda desde/hasta, pero el endpoint debería
  exigir filtros o paginar (mismo criterio que documentos).
- [ ] `cxc-consultas.tsx` usa `useState` + fetch manual en vez de React Query
  (estándar del repo). Solo registrar — no rediseñar sin pedido.
- [ ] Rutas y clientes-ruta con 0 filas en producción: confirmar con negocio
  si las rutas de venta se van a usar (si no, ocultar del sidebar).

## Evidencia
- Sondeos: `/tmp/cxc_probe.sh` y `/tmp/cxc_probe2.sh` (contenedor
  facturation_backend, 2026-07-07). Solo GET + login; sin escrituras.
- Inventario legacy: `memorias_por_modulo/memoria_cuentas_por_cobrar.md`.
- Endpoints: `backend/apps/legacy/cxc_urls.py` (27 rutas, 38 vistas @_auth).
