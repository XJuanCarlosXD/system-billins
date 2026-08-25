# Recepción de Órdenes de Compra → Entrada de Compra → CxP

Fecha: 2026-08-25
Estado: Aprobado por el usuario (decisiones tomadas con las opciones recomendadas; sin más rondas de preguntas — "usa las memorias, todo está documentado").

## Objetivo

Cerrar el ciclo Orden de Compra (ODC) → recepción de mercancía (INV) → factura de
proveedor (CxP), que hoy está roto: `TODC_ORDENL.cantidad_recibida` nunca se
actualiza en ningún flujo existente, no hay botón que lleve de "Consulta de
Órdenes" a "Entrada de Compra", y no existe selector de destino (stock/reventa)
ni captura de número de serie.

Concretamente:

1. Botón **"Generar Entrada de Compra"** en Consulta de Órdenes (ODC) para una
   orden autorizada y pendiente → navega a la vista de Entrada de Compra (INV)
   con todo precargado (proveedor, líneas, pendientes).
2. Al guardar esa entrada, el sistema **registra la recepción real** contra la
   orden (`cantidad_recibida` por línea) y decide automáticamente si la orden
   queda **completa** (se cierra, `estado='R'`) o **incompleta** (queda
   `estado='P'`, abierta para una entrada futura que complete lo que falta).
3. La factura de proveedor (FP/FT) en CxP se sigue generando automáticamente
   por cada entrada, exactamente como hoy — parcial o completa no cambia eso.
4. Selector **stock vs. reventa** en la cabecera de la entrada (dato informativo).
5. Captura de **número de serie** por línea, solo para productos marcados como
   seriados en el catálogo.

## Contexto (estado actual del código, verificado 2026-08-25)

| Pieza | Archivo | Estado hoy |
|---|---|---|
| Consulta de Órdenes | `frontend/src/features/odc/odc-ordenes.tsx` | Sin botón hacia INV. Acciones: Imprimir, Editar, Autorizar, Marcar Recibida (solo cambia `estado`, no toca inventario), Anular, Historial. |
| "Marcar Recibida" administrativo | `frontend/src/features/odc/odc-recibir.tsx` | Llama `api.odcCerrarOrden` → `UPDATE TODC_ORDEN SET estado='R'`. Banner explícito: "NO actualiza inventario". |
| Backend ODC | `backend/apps/legacy/repositories/odc_repo.py` | `cerrar_orden()` (línea ~447) no valida ni actualiza cantidades. **Ninguna función del archivo incrementa `cantidad_recibida`** — solo se inserta en 0 (`create_orden`) o se preserva (`actualizar_orden`). `rep_ordenes_pendientes` ya calcula `SUM(cantidad_pedida - cantidad_recibida)` como reporte, pero no como estado persistido. |
| Entrada de Compra | `frontend/src/features/inv/entrada-compras.tsx` | Ya tiene "Cargar desde Orden de Compra (ODC)" (líneas ~330-400): input manual de `no_orden`, precarga proveedor/líneas con `cantidad = cantidad_pedida - cantidad_recibida`. Envía `no_orden` en el payload final pero **el backend lo descarta**. |
| Backend INV alta | `backend/apps/legacy/repositories/inv_repo.py` | `create_movimiento_from_payload` (~3366) y `create_movimiento_documento` (~2947-3283) no tienen parámetro `no_orden`; `_insert_movimiento` (~2720) no lo inserta aunque la columna existe en el esquema Oracle de `TINV_MOVIMIENTO` (según docstring del módulo). |
| Espejo CxP | `backend/apps/legacy/repositories/cxp_repo.py::entrada_documento` (línea ~1673) | Ya se dispara automático desde `create_movimiento_documento` (líneas ~3155-3247) cuando `tipo_docu=='EC'` y hay `no_proveedor`. Genera tipo `'FT'` en CxP. Enlaza vía `TINV_RME.tipo_refe='FT'`, `no_refe=<no_docu CxP>`. No bloqueante: si falla, la entrada INV queda guardada igual y el error se muestra como toast. |
| Serial | — | No existe en ningún lado: ni columna en `TINV_PRODUCTO`, ni tabla, ni UI, ni backend. |
| Stock/reventa | — | No existe. `TODC_ORDEN.tipo_orden` (I/S = Inventariable/Servicios) existe pero es solo una etiqueta sin efecto funcional; no es lo mismo que este selector. |

## Decisiones de diseño

- **Botón en ODC, formulario reusado en INV** (no una pantalla nueva dentro de
  ODC): evita duplicar toda la lógica de empaques/costos/impuestos que ya
  existe en `entrada-compras.tsx`.
- **Completitud automática por cantidades**: la orden se cierra sola cuando
  `cantidad_recibida >= cantidad_pedida` en todas las líneas con pedido > 0.
  Sin checkbox de "forzar cierre" — si en el futuro se necesita, es una
  extensión separada (anular + reponer, o similar a "Anular" que ya pide motivo).
- **FP/FT sigue siendo automático por cada entrada**, sin gate de completitud.
  "Completa" en el pedido original se refiere al ciclo de la ORDEN, no a si se
  genera o no la factura — el proveedor factura lo que envía en cada entrega.
- **Vínculo INV↔ODC se implementa dentro de la misma transacción** que crea la
  entrada (`create_movimiento_documento`), mismo patrón non-blocking que ya usa
  el espejo CxP. Se descarta un segundo endpoint separado porque dos
  transacciones independientes pueden dejar la entrada INV guardada sin que la
  orden se actualice.
- **Empaque de línea fijo cuando viene de una orden**: para poder sumar
  `cantidad_recibida` sin convertir unidades, si la línea de la entrada
  proviene de una línea de la orden, el `empaque`/CPE queda bloqueado al de la
  orden (el usuario puede ajustar cantidad, no la unidad de esa línea).
- **Stock/reventa es solo etiqueta**, a nivel de documento (no por línea): no
  cambia inventario ni contabilidad. Simplifica el modelo; si más adelante se
  necesita mezclar destinos en una misma entrada, es una extensión futura.
- **Serial requiere flag de catálogo** (`TINV_PRODUCTO.usa_serial`), no un
  campo opcional libre por línea — así se puede exigir la captura de forma
  consistente para productos que siempre la necesitan (electrodomésticos con
  garantía, etc.).

## Cambios de esquema Oracle (DDL — requieren confirmación de columnas reales con `all_tab_columns` antes de ejecutar en la VM real, y aprobación explícita del usuario antes del `ALTER TABLE`)

1. `TINV_MOVIMIENTO.no_orden` — confirmar si ya existe (el docstring de
   `inv_repo.py` sugiere que sí, pero nunca se ha visto poblada); si no existe,
   agregar `NUMBER` nullable.
2. `TINV_RME.no_orden` — nueva columna `NUMBER` nullable, para poder resolver el
   vínculo a nivel de header (igual que `tipo_refe`/`no_refe` para CxP) sin
   tener que leer el detalle. Se usa para deshacer la recepción al reversar/editar.
3. `TINV_RME.destino` — nueva columna `CHAR(1)` nullable, valores `'S'` (Stock)
   / `'V'` (Reventa/venta directa).
4. `TINV_PRODUCTO.usa_serial` — nueva columna `CHAR(1)` default `'N'`.
5. Tabla nueva `INV.TINV_SERIAL_PRODUCTO`:
   ```sql
   CREATE TABLE INV.TINV_SERIAL_PRODUCTO (
     NO_CIA      VARCHAR2(2)   NOT NULL,
     PUNTO       VARCHAR2(2)   NOT NULL,
     TIPO_DOCU   VARCHAR2(3)   NOT NULL,
     NO_DOCU     VARCHAR2(7)   NOT NULL,
     NO_LINEA    NUMBER        NOT NULL,
     NO_PRODU    VARCHAR2(15)  NOT NULL,
     SERIAL      VARCHAR2(50)  NOT NULL,
     FECHA_CAPTURA DATE DEFAULT SYSDATE,
     CONSTRAINT PK_TINV_SERIAL_PRODUCTO PRIMARY KEY
       (NO_CIA, PUNTO, TIPO_DOCU, NO_DOCU, NO_LINEA, SERIAL)
   );
   ```

## Backend

### ODC (`backend/apps/legacy/repositories/odc_repo.py`, `odc_views.py`, `odc_urls.py`)

- **`registrar_recepcion(no_cia, punto, no_orden, lineas, usuario)`** — función
  nueva. `lineas`: `[{no_produ, cantidad}]` con lo realmente entrado en esta
  Entrada de Compra (ya en el empaque/base de la línea de la orden).
  1. Bloquea la orden `FOR UPDATE`.
  2. Por cada `no_produ` que matchea una línea de `TODC_ORDENL`, hace
     `cantidad_recibida = cantidad_recibida + :cantidad`. Líneas de la entrada
     que no matchean ninguna línea de la orden (productos añadidos a mano) se
     ignoran para este cálculo.
  3. Si **todas** las líneas de `TODC_ORDENL` con `cantidad_pedida>0` quedan con
     `cantidad_recibida >= cantidad_pedida` → `UPDATE TODC_ORDEN SET estado='R'`.
     Si no, `estado` se queda en `'P'`.
  4. Devuelve `{estado_final: 'R'|'P', lineas_actualizadas: [...]}`.
- **`deshacer_recepcion(no_cia, punto, no_orden, lineas, usuario)`** — función
  nueva, inversa de la anterior: resta `cantidad_recibida`, y si la orden
  estaba `estado='R'` la reabre a `'P'`. Se llama desde la reversa/edición de
  la entrada INV (ver abajo) cuando `TINV_RME.no_orden` está poblado.
- Endpoint no es necesario exponerlo aparte: se invoca internamente desde
  `inv_repo.create_movimiento_documento` / `reversar_documento_inv` (mismo
  patrón que el espejo CxP, que tampoco tiene endpoint propio).

### INV (`backend/apps/legacy/repositories/inv_repo.py`, `inv_views.py`)

- `create_movimiento_from_payload` y `create_movimiento_documento`: agregar
  parámetro `no_orden: str | None` y `destino: str | None` ('S'/'V').
  - `_insert_movimiento` inserta `no_orden` en `TINV_MOVIMIENTO` (columna ya
    contemplada en el esquema).
  - `_upsert_rme_header` (o equivalente) guarda `no_orden` y `destino` en
    `TINV_RME`, igual patrón que ya hace con `tipo_refe`/`no_refe`.
  - Tras el alta exitosa y el espejo CxP (bloque existente ~3155-3247), **si
    `no_orden` viene presente**: try/except no-bloqueante que llama a
    `odc_repo.registrar_recepcion(...)` con las líneas de la entrada que
    tengan `no_produ` presente en la orden. Si falla, se agrega
    `recepcion_odc: {error: str(exc)}` a la respuesta (mismo patrón que
    `cxp_mirror.error`), sin revertir la entrada ya guardada.
  - Serial: si el payload trae `detalle[].seriales: string[]` para una línea
    cuyo producto tiene `usa_serial='S'`, valida `len(seriales) == cantidad`
    (si no, 400 antes de insertar nada) e inserta en
    `TINV_SERIAL_PRODUCTO` tras crear el movimiento, dentro de la misma
    transacción.
- `reversar_documento_inv`: si el header (`TINV_RME`) tenía `no_orden`
  poblado, tras revertir kardex/existencia/CxP llama a
  `odc_repo.deshacer_recepcion(...)` con las cantidades del documento
  original (non-blocking, mismo patrón).
- Guardarraíl reusado de la spec de edición 2026-08-10: la reversa/edición de
  una EC con pago aplicado en CxP sigue bloqueada — eso ya protege
  indirectamente contra deshacer una recepción cuyo FP ya se pagó.

### Catálogo de productos (CRUD ya existente)

- Agregar checkbox "Usa número de serie" al formulario de producto
  (`TINV_PRODUCTO.usa_serial`), en el mismo CRUD ya implementado
  (`backend/apps/legacy` create/update de producto + su componente frontend).

## Frontend

### API (`frontend/src/lib/regal-general-api.ts`)
- Sin endpoints nuevos aparte de los ya usados (`odcGetOrden`,
  `invCrearMovimiento`/equivalente) — se extiende el **payload** existente con
  `no_orden`, `destino`, y `detalle[].seriales`.

### ODC
- `odc-ordenes.tsx`: botón **"Generar Entrada de Compra"** junto a los
  existentes, visible cuando `estado==='P'`, `st_anulado==='A'` y
  `autorizada_por` no nulo (mismas condiciones que hoy usa `odc-recibir.tsx`
  para listar). Navega con
  `nav({ to: '/inv/entrada-compras', search: { no_orden } })`.

### INV
- `routes/_authenticated/inv/entrada-compras.tsx`: `validateSearch` agrega
  `no_orden` opcional (además del `edit` ya existente).
- `entrada-compras.tsx`:
  - Si `no_orden` viene en la URL, dispara automáticamente la misma lógica que
    hoy tiene el botón manual "Cargar líneas" (`cargarDesdeOrden`), sin que el
    usuario tenga que escribirlo.
  - Líneas cargadas desde una orden: campo de empaque deshabilitado (bloqueado
    al de la orden), con tooltip explicando por qué.
  - Nuevo selector de cabecera **Destino: Stock / Reventa** (`RadioGroup` o
    `Select` de 2 opciones, default "Stock").
  - Por cada línea cuyo producto tenga `usa_serial='S'` (viene en la respuesta
    del picker de producto / de `cargarDesdeOrden`): campo expandible con N
    inputs de texto (uno por unidad de `cantidad`), validación en cliente de
    que estén todos completos antes de habilitar "Guardar".
  - Tras guardar: si la respuesta trae `recepcion_odc.estado_final === 'R'`,
    toast "Orden ODC-XXXX cerrada (recepción completa)"; si `'P'`, toast
    informativo "Orden ODC-XXXX queda abierta, faltan productos por recibir";
    si `recepcion_odc.error`, toast de advertencia (mismo patrón que
    `cxp_mirror.error` ya existente en este archivo).

## Casos de error / guardarraíles

1. Orden `estado='R'` o `st_anulado='N'`: el botón "Generar Entrada de Compra"
   no aparece en `odc-ordenes.tsx`; si igual se navega con la URL a mano, el
   backend rechaza igual que hoy rechaza cargar una orden cerrada/anulada
   (guardarraíl ya existente en `cargarDesdeOrden`, línea ~345-350).
2. Línea con `seriales.length != cantidad`: 400 antes de tocar inventario.
3. Recepción que excede lo pedido (`cantidad` entrada > pendiente de esa
   línea): se permite (el proveedor a veces manda de más), no bloquea; solo
   deja de contar para el resto — no hay `cantidad_recibida` negativa posible
   porque solo se suma.
4. Fallo del registro de recepción tras guardar la entrada INV exitosamente:
   no revierte la entrada (mismo criterio que el espejo CxP) — se reporta como
   advertencia, la orden puede reconciliarse a mano después.
5. Reversar/editar una entrada con `no_orden`: siempre intenta
   `deshacer_recepcion`; si la orden ya no existe o fue anulada, no falla la
   reversa de INV (non-blocking, log de advertencia).

## Pruebas (VM 10.0.0.99 = producción real)

- `py_compile` de los `.py` cambiados vía `docker compose exec -T backend`.
- Smoke con orden/proveedor/producto **ZZTEST** (datos desechables,
  reversibles):
  1. Crear orden ZZTEST con 2 líneas.
  2. Autorizarla.
  3. Desde Consulta de Órdenes, botón "Generar Entrada de Compra" → verificar
     precarga completa (proveedor, líneas, empaque bloqueado).
  4. Entrada **parcial** (menos cantidad que lo pedido en una línea): guardar,
     verificar `cantidad_recibida` actualizada, orden sigue `estado='P'`, FP/FT
     se generó igual en CxP.
  5. Segunda entrada completando el resto: guardar, verificar orden pasa a
     `estado='R'`.
  6. Producto con `usa_serial='S'`: verificar que exige seriales y quedan en
     `TINV_SERIAL_PRODUCTO`.
  7. Reversar la segunda entrada: verificar que la orden vuelve a `estado='P'`
     y `cantidad_recibida` baja correctamente.
  8. Revertir/limpiar todo lo de prueba (no dejar transacciones reales).
- Backend por `pscp` a la VM; frontend por push a `main` → Netlify.

## Archivos a tocar

Backend: `apps/legacy/repositories/odc_repo.py`, `apps/legacy/odc_views.py`
(si se requiere exponer algo nuevo), `apps/legacy/repositories/inv_repo.py`,
`apps/legacy/inv_views.py`, migración DDL (script SQL documentado, no ORM).

Frontend: `features/odc/odc-ordenes.tsx`, `features/inv/entrada-compras.tsx`,
`routes/_authenticated/inv/entrada-compras.tsx`, formulario de producto
(catálogo INV) para el checkbox `usa_serial`.

## Fuera de alcance (explícitamente descartado en esta iteración)

- Reventa que excluye inventario (cross-dock): se descartó — reventa es solo
  etiqueta, no cambia el movimiento de inventario.
- Checkbox de "forzar cierre" de orden con faltante: no se pidió: la
  completitud es 100% automática por cantidades.
- Serial opcional libre sin flag de catálogo: se descartó a favor del flag en
  `TINV_PRODUCTO`.
- Pantalla de recepción dedicada dentro de ODC (duplicando el formulario de
  INV): se descartó a favor de reusar `entrada-compras.tsx`.
