# Auditoría INV — clon vs legado (2026-07-02)

## Resumen

- 86 opciones de menú legacy (memoria_inventario.md).
- 59 vistas del clon (6 secciones) smoke-testeadas con Playwright:
  **37 operativas, 26 declaradas "Planificado"** (placeholders explícitos),
  **2 bugs encontrados y ARREGLADOS**.
- Verificación funcional con datos reales: existencias ✓ (regla almacén
  controlado corregida hoy), kardex Rinv304 (46 movs producto 6798) ✓,
  tipos-docu (10) ✓, entrada de compras E2E ✓ (EC-0002059 + reverso).
- Cierre (entrada diario, generar asiento, cierre mensual): solo-render.

## Bugs arreglados en esta auditoría

| Bug | Causa | Fix |
|-----|-------|-----|
| "Mínimo y Máximo" crasheaba en blanco | doble: `SelectItem value=''` (crash Radix) + campos inexistentes (`no_almacen/no_grupo/no_linea` vs los reales `almacen/grupo_produ/linea` → todos los items con value undefined) | sentinelas `__todos__/__todas__` + campos correctos |
| Popover de existencia mostraba negativos falsos (p.ej. 6798 → −37) | calculaba solo desde TINV_MOVIMIENTO (historial de compras incompleto) | regla del legado aplicada: almacén controlado → exist_actual (arreglado más temprano hoy, commit c247831) |

## Estado por sección

| Sección | Operativas | Planificadas (gap declarado) |
|---------|-----------|------------------------------|
| Configuración (21) | 15 | acceso-usuarios, marca-producto, crear-excel, activar-prod-almacen, ensamblar-productos, envases-retornables |
| Procesos (14) | 8 | entrada-produccion, despacho-cotizacion, salida-ensamblados, listado-recepcion-resumen/detalle, listado-doc-asiento, asignar-series |
| Consultas (4) | 3 | costo-rango-fecha |
| Reportes (14) | 3 | productos-ensamblados, productos-empaque, etiquetas (×4), devoluciones-vendedor, auxiliar-inventario, consumo-proyecto, barras-documentos, cantidad-reservada |
| Conteo Físico (3) | 3 | (consulta-historico-cf planned) |
| Cierre (3) | 3 | — |

Los procesos con persistencia core están operativos y verificados:
entrada-compras / entrada-mercancía / salida / transferencia / devoluciones /
reversar (los INSERT de movimiento + stock se validaron end-to-end hoy).

## Gaps por severidad

### Mayores
- [ ] **Guardar Mínimos/Máximos no persiste**: la pantalla renderiza pero
  `ENDPOINT_EXISTE=false` — falta el endpoint backend de actualización.
- [ ] **Producción/Ensamblados** (entrada-produccion, salida-ensamblados,
  ensamblar-productos): flujo completo del legado (Finv2xx ensamble) sin implementar.
- [ ] **Etiquetas** (Intermec/Monarch/barras): 4 pantallas planned — el
  legado las usa para operación de almacén.

### Menores
- [ ] Listados de recepción (resumen/detalle) y listado doc-asiento (reportes).
- [ ] Auxiliar de inventario, consumo por proyecto, cantidad reservada.
- [ ] Carga masiva desde Excel (crear-excel) y activar/desactivar por almacén.
- [ ] Series (asignar-series) — si el negocio maneja seriales.

### Deuda de datos (no es bug del clon)
- El ledger TINV_MOVIMIENTO no tiene el histórico de compras previo al clon
  → los saldos reales viven en TINV_EPRODUCTO (almacenes controlados).
  Cualquier descuadre puntual se corrige con ajuste AE/AS o Toma Física.

## Evidencia
- Smoke 59 vistas Playwright 2026-07-02.
- `GET /api/inv/existencia/?no_produ=00006798` → 35 (fuente eproducto) tras data-fix.
- `GET /api/inv/movimientos/00006798/` → 46 movimientos (kardex Rinv304).
- Guardado: POST /api/inv/movimientos/ EC-0002059 (201) + reverso AF-0001245.
