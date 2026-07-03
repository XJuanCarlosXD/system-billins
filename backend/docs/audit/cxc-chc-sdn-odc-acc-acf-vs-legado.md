# Auditoría CXC · CHC · SDN · ODC · ACC · ACF — clon vs legado (2026-07-02)

## Resumen

- **111 rutas smoke-testeadas con Playwright en producción: 111 limpias**
  (0 errores de consola, 0 fallos de API, 0 Not Found).
- Muestreo funcional con datos reales por módulo (abajo).
- Todos los cierres/procesos irreversibles: validados **solo-render**
  (regla de producción — NO ejecutados): cxc/cierre, cxc/generar-asiento,
  chc/cierres, acc/cierre, acf/cierre, acf/depreciacion, sdn/gen-cheques,
  sdn/calcular.
- Los fixes sistémicos de hoy (CSRF /api/, binds thick-mode) desbloquearon
  la escritura en estos 6 módulos; el escáner AST confirma 0 binds rotos.

## Verificación funcional (endpoints con datos reales)

| Módulo | Verificado | Resultado |
|--------|-----------|-----------|
| CXC (32 rutas) | clientes (paginado 50), documentos (50), recibo de ingreso E2E con rollback (más temprano hoy), permisos por tipo (11 docs) | ✅ |
| CHC (17 rutas) | cheques (200 por página), bancos (5 cuentas) | ✅ |
| SDN (21 rutas) | empleados, nóminas definidas (1) | ✅ |
| ODC (13 rutas) | órdenes (200 por página), requisiciones (0 — sin pendientes) | ✅ |
| ACC (14 rutas) | documentos de caja chica (200), cajas (2) | ✅ |
| ACF (14 rutas) | activos → **0 filas** | ⚠️ ver gap |

## Gaps

### Conocidos que siguen abiertos
- [ ] **ACF sin datos**: TACF_CIAS/TACF_PUNTO/TACF_ACTIVOS vacíos para las
  empresas — el módulo está construido pero no sembrado (memoria 2026-06-19).
  Requiere migrar los activos del legado o capturarlos.
- [ ] **PDFs**: CHC (Rchc503 cheques por cuenta y demás .rep), SDN (volante
  impreso), CXC (Rcxc* restantes) — las pantallas muestran datos pero varios
  reportes impresos del legado no tienen botón PDF.
- [ ] **Solicitud de pago CxP→CHC** (Fcxp207/209): el puente para generar
  cheques desde CxP no existe (registrado también en cxp-vs-legado.md).
- [ ] SDN: cálculo de nómina completo (calcular) validado solo-render;
  probar en frío cuando haya un período de nómina de prueba.

### Sin hallazgos nuevos
El smoke no encontró pantallas rotas en estos 6 módulos (el único 403
observado fue ruido de navegación, verificado limpio en re-test).

## Evidencia
- Smoke 111 rutas: sesión Playwright 2026-07-02 (una sola pasada, 110/111 +
  re-test de cxc/corregir-ncf limpio).
- CXC recibo: `crear_recibo_cobro` probe con commit suprimido → distribución
  1101-01 DR / 1103-01 CR correcta.
- Muestras: GET /api/chc/cheques (200 filas), /api/odc/ordenes (200),
  /api/acc/documentos (200), /api/sdn/empleados, /api/acf/activos (0).
