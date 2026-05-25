# Documentación Regal General Clon

Documentación viva del proyecto. Desde aquí se enlaza a los planes, inventarios
y decisiones de arquitectura. Esta página se mantiene al día junto con el código.

## Cómo está organizada

| Archivo | Tema |
|---|---|
| `00_indice.md` | Esta página — punto de entrada |
| `08_plan_definitivo.md` | Plan ejecutivo por fases (Fase 0 → 7) con QA strategy |
| `10_inventario_modulos_activos.md` | Inventario de los 9 módulos en uso real |
| `11_inventario_fat_ncf.md` | Detalle Facturación + manejo NCF/e-CF |
| `12_integraciones_externas.md` | TSS, AFP, ARS, retenciones, archivos bancarios |
| `13_impresion_pendiente.md` | Formatos físicos pendientes de captura |
| `14_fase1_cierre.md` | Cierre de Fase 1 con métricas |
| `30_plan_maestro_modulos.md` | Plan maestro por módulos, incluye CNT y orden de ejecución |
| 31_cnt_plan_detallado.md | Plan CNT completo: menu, rutas, validacion y exportacion |
| 32_cnt_comparacion_legado_pendiente.md | Auditoria pendiente para comparar CNT nuevo vs sistema viejo |
| `33_inv_plan_detallado.md` | Plan INV completo: catálogo de forms legacy, rutas, prioridades |

## Estado actual del proyecto

- ✅ **Fase 0** (decisiones de alcance): completada.
- ✅ **Fase 1** (descubrimiento e inventario): completada.
- 🟡 **Fase 2** (modelo objetivo + capa legacy): en progreso.
  - ✅ `apps/legacy/client.py` — pool oracledb thick mode.
  - ✅ `apps/legacy/repositories/` — 12 repos (transversales + 9 módulos).
  - ✅ Auth con Oracle nativo + JIT provisioning.
  - ✅ Endpoints login / logout / me / change-password / admin users / admin access.
  - ✅ Frontend con dashboard de NCF alerts y datos reales.
  - ✅ Admin de usuarios con CRUD + permisos por módulo.
  - ⏳ Frontend de cada módulo (FAT, CXC, CXP, INV, CHC, ACC, CNT, SDN, ODC).
  - ⏳ Pantalla dedicada de Alertas NCF.
  - ⏳ Pantalla dedicada de Empresas.

## Stack

- Backend: Django 5 + DRF + python-oracledb (thick) + SQLite local.
- Frontend: Vite + React 19 + TypeScript + Tailwind 4 + shadcn-admin.
- DB legado: Oracle 11g (sólo lectura/escritura controlada vía servicios).
- Containers: Docker Compose en VM Hyper-V Ubuntu 22.04.

## Reglas duras del proyecto

1. **Cero Django ORM contra Oracle**. Todo va por `apps.legacy.client`.
2. **Cero rebuild Docker para cambios de código**. Solo rebuild si cambia Dockerfile, requirements.txt o package.json.
3. **Listados siempre con paginación, filtros y orden server-side**. Pattern: `page`, `page_size`, `order_by`, `direction`, `q`.
4. **Asientos contables byte-exact** con el legado (criterio de aceptación duro de Fase 4).
5. **NCF/e-CF: replicar formato — nunca transmitir a la DGII** (eso lo hace el contable manual).
6. **Multi-empresa real**: 5 empresas activas con RNCs distintos.
7. **Auth = Oracle nativo**. Nunca tabla de hash propia.
8. **Cada implementación debe generar/actualizar su propia doc** en `backend/docs/` con título, propósito, endpoints expuestos, cómo se usa desde la UI y casos de prueba. Agregar entrada al README de docs (esta página) con un enlace. Sin esa doc la implementación no se considera cerrada.

## Próximo paso

Construir la pantalla dedicada de **Alertas NCF** (filtrable por empresa, severidad, código)
y la de **Empresas** (con métricas por empresa). Después, primer módulo funcional: **Facturación**
con pantalla de búsqueda de facturas (paginada/filtrable) que consume `FAT.TFAT_FACTURA`.

