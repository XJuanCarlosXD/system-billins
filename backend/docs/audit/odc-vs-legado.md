# Auditoría ODC — clon vs legado (2026-07-07)

Profundiza el smoke del 2026-07-02. Método: inventario desde
`memoria_ordenes_de_compras.md` (~20 artefactos propios; varios compartidos
con CXP/CXC), mapeo forma-por-forma y sondeo read-only de los 20 endpoints
`/api/odc/*` con producción real.

## Resumen

- ~20 artefactos legacy propios (el módulo reusa mantenimientos de CXP/CXC).
- **Ciclo completo con paridad verificada**: entrada de orden → autorizar →
  recibir → cerrar/anular; requisiciones igual; 3 reportes + print-data.
- Es el módulo con mejor cobertura de los 6 auditados. Gaps puntuales.
- 0 bloqueantes.

## Verificación en vivo (2026-07-07, producción, read-only)

| Endpoint | Resultado |
|----------|-----------|
| cias/puntos | 200 — 5/1 |
| ordenes (cia01) | 200 — 200 filas, keys completas (proveedor, RNC, cotización, requisición, condición pago, totales, estado, autorizada_por) |
| ordenes/01/01/00004194/ | 200 — cabecera + líneas ✅ |
| ordenes/00004194/print-data/ | 200 — doc + proveedor + líneas + totales ✅ |
| rep-resumen | 200 — total/pendientes/autorizadas/cerradas/anuladas/monto |
| rep-ordenes-pendientes | 200 — 2,025 filas (283ms) |
| requisiciones + rep-requisiciones-pendientes | 200 — 0 (sin pendientes; esperado) |
| usuarios | 200 — **0 filas** (ver menores) |

Datos reales: órdenes de 2025-07-22 a 2026-07-03 — el módulo está en uso
productivo activo.

## Mapeo legacy → clon

Cubiertos: Fodc101→/odc (cias) · Fodc102→puntos · Fodc201→nueva-orden ·
Fodc203→nueva-requisicion · Fodc204+209→autorizar · Fodc210→anular/cerrar ·
Fodc501→ordenes · Fodc502→requisiciones · rodc201→rep-pendientes ·
rodc206→rep-requisiciones · rodc207→rep-resumen · impresión orden/requisición
→ print-data · recibir mercancía (integración INV, mejora sobre el legado) ·
Fodc103/601→admin usuarios · proveedores/ciudades/sectores→CXP/CXC ·
Fcxp202/204→CXP saldos-menores · Fcxp401-403→CXP cierre.

## Gaps por severidad

### Mayores
- [ ] **Fodc208 Consolidar Requisición** (varias requisiciones → una orden)
  no existe. Si el flujo de requisiciones se activa (hoy 0 pendientes), la
  consolidación es el paso que le da valor.
- [ ] **rodc208 Compra por Producto** (histórico de compras por producto para
  negociar precios) no existe — útil y sin equivalente en el clon.

### Menores
- [ ] rodc202 Listado de doc por documento — cubierto parcialmente por la
  consulta de órdenes con filtros; sin impreso dedicado.
- [ ] FODC207/Rodc205 Impresión de Cotización de Requisición — el print-data
  de requisición existe; falta la variante "cotización" formal.
- [ ] `/api/odc/usuarios/` devuelve 0 filas — verificar de qué tabla lee y
  si la vista que lo consume (autorizaciones) espera datos.
- [ ] `rep-ordenes-pendientes` = 2,025 filas sin tope/paginación (283ms hoy).
  El aging del dato sugiere revisar el criterio "pendiente": ¿órdenes de
  hace años siguen abiertas por falta de cierre masivo?

## Evidencia
- Sondeo `/tmp/odc_probe.sh` (contenedor facturation_backend, 2026-07-07).
  Solo GET/login; sin escrituras.
- Inventario legacy: `memorias_por_modulo/memoria_ordenes_de_compras.md`.
- Endpoints: `backend/apps/legacy/odc_urls.py` (20 rutas).
