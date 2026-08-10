# Edición de Orden de Compra (ODC), Entrada de Compra (EC) y Entrada de Mercancía (EM/EI)

Fecha: 2026-08-10
Estado: Aprobado por el usuario (los tres flujos en un solo entregable, "editar siempre" con re-posteo seguro, 4 guardarraíles).

## Objetivo

Permitir **editar** documentos ya creados desde sus pantallas de consulta, reutilizando la
propia vista de entrada en "modo edición":

1. **Orden de Compra (ODC)** — botón *Editar* en `odc-ordenes.tsx` → `odc-nueva-orden.tsx` precargada.
2. **Entrada de Compra (EC)** — botón *Editar* en `consulta-documentos.tsx` → `entrada-compras.tsx` precargada.
3. **Entrada de Mercancía (EM/EI)** — botón *Editar* en `consulta-documentos.tsx` → `entrada-mercancia.tsx` precargada.

El usuario debe poder editar en cualquier estado editable (no solo borrador), con re-posteo
seguro al inventario / CxP y sin corromper kardex, existencia, costo promedio ni el 606.

## Contexto (estado actual del código)

| Documento | Vista entrada | Postea a | Consulta / detalle | Update hoy | Reversa hoy |
|---|---|---|---|---|---|
| ODC | `odc-nueva-orden.tsx` (solo crea, `odcCrearOrden`) | `TODC_ORDEN` + `TODC_ORDENL` (no toca inventario) | `odc-ordenes.tsx` + `api.odcGetOrden` | ❌ | anular |
| EC | `entrada-compras.tsx` (`POST /inv/movimientos/`) | kardex + existencia + **espejo CxP (606)** | `consulta-documentos.tsx` + `inv_documento_detalle` | ❌ | ✅ `inv_reversar_documento` |
| EM/EI | `entrada-mercancia.tsx` (`POST /inv/movimientos/`) | kardex + existencia | `consulta-documentos.tsx` | ❌ | ✅ misma reversa |

Backend relevante:
- `backend/apps/odc/odc_views.py` + `odc_urls.py` (crear/listar/autorizar/cerrar/anular; **no** update).
- `backend/apps/legacy/inv_views.py`: `inv_movimientos` (POST alta), `inv_documento_detalle` (GET),
  `inv_reversar_documento` (POST) → `inv_repo.reversar_documento_inv(...)`.
- Repos: `backend/apps/legacy/repositories/inv_repo.py`, `backend/apps/odc/...` (repo de ODC).
- Frontend API: `frontend/src/lib/regal-general-api.ts` (`odcListOrdenes`, `odcGetOrden`, `odcCrearOrden`).

## Enfoque elegido: Reversar + re-aplicar en una sola transacción

Descartados: (B) update en sitio con deltas del kardex — alto riesgo de valuación/costo promedio/606;
(C) anular + crear nuevo — cambia el número de documento y rompe referencias.

- **ODC**: como no toca inventario, la edición es `UPDATE` directo de `TODC_ORDEN` + reemplazo de
  `TODC_ORDENL`, respetando `cantidad_recibida` existente.
- **EC / EM**: en **una sola transacción Oracle**: reversar el documento existente (deshace kardex +
  existencia + costo promedio + espejo CxP), y re-crear con el payload nuevo reutilizando la lógica de
  `inv_movimientos`. Si el re-alta falla → rollback → el documento queda **exactamente** como estaba.
  El número de documento (`no_docu`) se **conserva** (se re-inserta con el mismo número).

## Guardarraíles (validados en backend, reflejados en UI)

1. **Anulados / reversados no se editan** — hay que crear uno nuevo.
2. **ODC con recepción parcial** — al editar líneas no se permite bajar `cantidad_pedida` por debajo de
   la `cantidad_recibida` ya registrada de esa línea; tampoco eliminar una línea con recibido > 0.
3. **EC con pago aplicado en CxP** — si el espejo 606 (`TCXP_DOCUMENTO`) ya tiene pagos/aplicaciones,
   la edición se bloquea (editar rompería CxP). Se detecta antes de reversar.
4. **Período cerrado** — documentos cuyo mes esté cerrado en INV (o el 606/CxP para EC) no se editan.

En UI: el botón *Editar* se muestra deshabilitado con tooltip del motivo cuando un guardarraíl aplica;
el backend re-valida siempre (fuente de verdad) y responde 409/400 con `{error}` claro.

## Backend — endpoints nuevos

### ODC
- `PUT /api/odc/ordenes/<no_orden>/` → `odc_actualizar_orden(request, no_orden)`.
  - Body: `{ no_cia, punto, cabecera:{...}, lineas:[{no_produ, cantidad_pedida, costo, porc_descuento, descuento, impuesto, monto_neto, porciento_impuesto}] }` (mismo shape que `odcCrearOrden`).
  - Repo: `odc_repo.actualizar_orden(...)` — valida guardarraíles 1,2,4; UPDATE cabecera; borra líneas y re-inserta (preservando `cantidad_recibida` por `no_produ`/`no_linea`); rollback on exception antes de release (patrón legacy pool).

### INV (EC + EM/EI)
- `PUT /api/inv/documentos/<tipo_docu>/<no_docu>/` → `inv_actualizar_documento(request, tipo_docu, no_docu)`.
  - Body: mismo payload que `POST /inv/movimientos/` (`{no_cia, punto, tipo_docu, fecha, almacen, proveedor, rnc, ncf, forma_pago, fecha_vcto, pct_descuento, pct_itbis, tipo, nota, no_orden?, detalle:[...]}`).
  - Repo: `inv_repo.actualizar_documento_inv(...)`:
    1. Validar guardarraíles 1,3,4 (documento existe, no anulado; EC sin pago aplicado en CxP; mes abierto).
    2. Dentro de **una** conexión/transacción: `reversar_documento_inv(..., no_docu, interno=True)` (sin commit intermedio) → luego alta con la misma lógica de `inv_movimientos` **reusando el mismo `no_docu`** (no consumir secuencia nueva).

  **Enlace estructurado EC ↔ FP (2026-08-10):** al crear una EC, `create_movimiento_documento`
  guarda la referencia al FP espejo en el header de la entrada: `TINV_RME.tipo_refe='FP'`,
  `no_refe=<no_docu del FP>` (columnas libres para EC). En la edición, `_resolve_cxp_mirror_fp`
  lee ese enlace exacto desde el header ya cargado; solo cae al heurístico `detalle LIKE
  '%INV <no_docu>%'` (`_find_cxp_mirror_fp`) para entradas creadas antes de esta fecha.
    3. `commit` al final; en cualquier excepción `rollback` + release (patrón legacy pool).
  - Nota: refactor mínimo de `reversar_documento_inv` y de la lógica de alta de `inv_movimientos` para
    aceptar una conexión externa (`conn=None`) y un `no_docu` forzado, de modo que ambos corran en la
    misma transacción sin duplicar SQL.

## Frontend

### API (`regal-general-api.ts`)
- `odcActualizarOrden(noOrden, data)` → `PUT /odc/ordenes/<noOrden>/`.
- `invActualizarDocumento(tipoDocu, noDocu, data)` → `PUT /inv/documentos/<tipoDocu>/<noDocu>/`.

### ODC
- `odc-ordenes.tsx`: en el `DialogFooter` de detalle, botón **Editar** visible solo si
  `st_anulado==='A'` y `estado!=='R'` (y no bloqueado por período) → `nav({ to:'/odc/nueva-orden', search:{ edit: no_orden } })`.
- `odc-nueva-orden.tsx`: leer `edit` de la ruta; si presente → `odcGetOrden`, precargar proveedor,
  cabecera y líneas; banner "Editando ODC-xxxx"; botón "Actualizar orden" → `odcActualizarOrden`;
  al éxito `nav({to:'/odc/ordenes'})` e invalidar `['odc-ordenes']`. Preservar `cantidad_recibida`
  (mostrar como columna informativa y bloquear reducir por debajo).

### INV
- `consulta-documentos.tsx`: botón **Editar** por fila (solo tipos EC/EM/EI activos, no reversados,
  mes abierto) → deep-link a la sección/vista de entrada correspondiente con
  `search:{ ..., edit: `${tipo_docu}-${no_docu}` }`.
- `entrada-compras.tsx` y `entrada-mercancia.tsx`: leer `edit` del search; si presente → cargar
  `inv_documento_detalle`, precargar cabecera + líneas; banner "Editando <tipo>-<no_docu>";
  botón "Actualizar"; al éxito volver a la consulta e invalidar la query de documentos.

## Pruebas (VM 10.0.0.99 = producción real)

- `py_compile` de los `.py` cambiados dentro del contenedor (`docker compose exec -T backend python -m py_compile ...`) = 0.
- Smoke con **datos desechables** (proveedor/producto tipo `ZZTEST` o cía/punto de prueba):
  crear ODC/EC/EM de prueba, editarla, verificar que:
  - Editar **sin cambios** deja existencia, costo promedio, kardex y (EC) el 606 **idénticos**.
  - Editar cantidad/costo ajusta existencia y 606 de forma consistente (reversa+re-alta).
  - Guardarraíles responden 409/400 con mensaje claro (anulado, pago CxP, mes cerrado, pedida<recibida).
  - **Revertir** todo lo creado de prueba (no dejar transacciones reales de negocio).
- Backend a la VM por `pscp`; frontend por push a `main` → Netlify (no pscp de frontend).

## Archivos a tocar

Backend: `apps/odc/odc_views.py`, `apps/odc/odc_urls.py`, `apps/odc/<repo>.py`,
`apps/legacy/inv_views.py`, `apps/legacy/inv_urls.py`, `apps/legacy/repositories/inv_repo.py`.
Frontend: `lib/regal-general-api.ts`, `features/odc/odc-ordenes.tsx`, `features/odc/odc-nueva-orden.tsx`,
`features/inv/consulta-documentos.tsx`, `features/inv/entrada-compras.tsx`, `features/inv/entrada-mercancia.tsx`,
y las rutas `routes/_authenticated/odc/nueva-orden.tsx` (validar/añadir `edit` a `validateSearch`).
