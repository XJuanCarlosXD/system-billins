# Auditoría FAT — clon vs legado (2026-07-02)

## Resumen

- 88 opciones de menú legacy (memoria_facturacion.md; ~15 son navegación cross-módulo).
- 25 rutas del clon smoke-testeadas con Playwright en producción.
- **3 bugs encontrados y ARREGLADOS** durante la auditoría.
- Verificación funcional con datos reales: facturas ✓, rep-ventas junio (320
  facturas) ✓, cuadre de caja ✓, conduces (30) ✓, analítica anual ✓.
- Cierres (asiento contable, generar asientos, cierre mensual): validados
  solo-render según regla de producción — NO ejecutados.

## Bugs arreglados en esta auditoría

| Bug | Causa | Fix |
|-----|-------|-----|
| `/fat/asiento-contable` daba "Not Found" | la ruta existe como archivo pero `routeTree.gen.ts` (commiteado) nunca se regeneró tras crearla, y el build de Netlify usa el árbol commiteado | routeTree regenerado con `vite build` y commiteado |
| `/fat/generar-asientos` quedaba en "Cargando período…" para siempre | si el punto seleccionado no existe en TFAT_PUNTO, `usePeriodoFat` resuelve `null` y el `useEffect` nunca inicializaba mes/año | fallback al mes/año actual cuando la query termina sin datos |
| `/fat/rep-analitica` disparaba `?ano=undefined` → 400 | la ruta no pasa la prop `ano` que el componente exige | `ano` opcional con default = año actual |

## Mapeo legado → clon (por área)

| Área legado | Clon | Estado |
|-------------|------|--------|
| Facturación (Ffat204 y familia) | /fat/facturas, /fat/nueva-factura, /fat/anular-factura | ✅ (guardado + descarga stock verificados hoy) |
| Conduces / Cotizaciones | /fat/conduces, /fat/nuevo-conduce (CO/CT) | ✅ |
| Notas crédito/débito | /fat/notas | ✅ |
| Cuadre de Caja | /fat/cuadre-caja (con matriz NCF×forma pago) | ✅ |
| Configuración (cias, puntos, tdocu, tipos pago, condiciones, transportistas, listas precio) | /fat/* | ✅ |
| Cierre/Control (Ffat402/403) | /fat/asiento-contable + /fat/generar-asientos + /fat/cierre-mensual | ✅ render (ejecución NO probada) |
| Reportes | 8 pantallas rep-* (ventas, cliente, vendedor, 607, analítica, RNC, margen, NCF nulos) | ✅ |
| Acceso (Ffat601) | /sistema/usuarios (flags + docs por tipo) | ✅ |

## Gaps

### Conocidos (backlog previo, siguen abiertos)
- [ ] Reportes impresos legacy restantes (p.ej. Rfat237) sin PDF en el clon.
- [ ] `/fat/notas` es pantalla mínima (118 chars) — revisar equivalencia
  completa con las notas de crédito/débito del legado.
- [ ] Módulo Telemarketing (Fmenu tm) — fuera de alcance del clon (decisión pendiente).

### Nada nuevo bloqueante
El smoke y los endpoints centrales están sanos; los 3 bugs de arriba eran
los únicos rotos y quedaron arreglados.

## Evidencia
- Smoke 25 rutas Playwright 2026-07-02 (2 pasadas para descartar falsos timeouts).
- `GET /api/fat/rep-ventas/?...junio` → 320 filas.
- `GET /api/fat/rep-analitica/?ano=2026` → mensual + top productos + top clientes.
- INV↔FAT stock: entrada EC-0002059 (+1) y reverso AF-0001245 verificados.
