# Servicios que no ensucian inventario + Cotización → Factura

Fecha: 2026-09-22

## Contexto / Problema

Dos quejas de usuarios, relacionadas por el mismo campo `TINV_PRODUCTO.SERVICIO`:

1. **Servicios ensucian el inventario.** Cuando se registra una Entrada de Compra
   (u otro tipo de documento INV) con una línea de producto tipo Servicio
   (`SERVICIO='S'`), el sistema igual crea un movimiento de inventario y
   actualiza `TINV_EPRODUCTO.exist_actual` como si fuera un artículo físico.
   Causa raíz: `inv_repo.py::_insert_movimiento` graba el campo `servicio` de
   `TINV_MOVIMIENTO` **hardcodeado a `'I'`** sin mirar el flag real del
   producto, y `create_movimiento_documento` llama a
   `_adjust_eproducto_stock` para toda línea sin excepción.

2. **Cotización → Factura incompleto.** Las cotizaciones (`TFAT_CONDUCE`
   `TIPO_CONDUCE='CT'`) permiten líneas "manuales" con `no_produ='X'` (solo
   marca/descripción libre, sin producto real). No hay forma de pasar una
   cotización a factura desde la Consulta de Documentos, y las líneas `'X'`
   no tienen equivalente real en `TINV_PRODUCTO`, así que facturarlas
   fallaría. Además:
   - `fat-nueva-factura.tsx` ya tiene una función `cargarCotizacion()` que
     autocarga cliente+líneas desde un número de cotización, y ya envía
     `no_cotizacion` al crear la factura — pero el backend
     (`FatFacturasView.post` / `fat_repo.create_factura`) **ignora ese
     parámetro por completo**: nunca se lee del request ni existe en la
     firma de `create_factura`. `TFAT_CONDUCE.NO_FACTURA` nunca se setea.
   - El botón "Anular" en `fat-nuevo-conduce.tsx` existe pero está
     `disabled` (stub). No hay endpoint de anular/reversar para conduces.
   - Si un producto de línea es servicio, `create_factura` hoy exige
     existencia (`exist_disp >= cantidad`) y decrementa
     `TINV_EPRODUCTO.exist_actual` — bloquea facturar cualquier servicio
     con `exist_actual=0`.

## Alcance

### A. Fix: servicios no tocan existencia (INV)

- `inv_repo.py`:
  - `_insert_movimiento` deja de hardcodear `servicio='I'`; recibe el flag
    real del producto (`SERVICIO` de `TINV_PRODUCTO`) y lo graba tal cual.
  - `create_movimiento_documento`: antes de `_insert_eproducto`/
    `_adjust_eproducto_stock` para una línea, consulta
    `TINV_PRODUCTO.SERVICIO` del `no_produ`. Si es `'S'`, se **omite**
    `_insert_eproducto` y `_adjust_eproducto_stock` (no crea/actualiza fila
    en `TINV_EPRODUCTO`), pero el `INSERT` en `TINV_MOVIMIENTO` sí ocurre
    igual (con `servicio='S'`) para trazabilidad/auditoría/reportes.
  - Aplica a los 10 tipos soportados por esa función (EA, EC, EP, DV, DC,
    SA, SP, AE, AS, TA) — un único punto de control, no 10 casos especiales.
  - `registrar_conteo_fisico` (AE/AS por diferencia de conteo) no cambia:
    un conteo físico nunca debería incluir productos servicio (no tienen
    existencia física que contar), así que no hay caso a cubrir ahí.

### B. Fix: servicios no bloquean facturación (FAT)

- `fat_repo.py::create_factura`: al procesar cada línea, además de
  `costo_unit`/`exist_disp` desde `TINV_EPRODUCTO`, se consulta
  `TINV_PRODUCTO.SERVICIO`. Si es `'S'`:
  - Se omite la validación "Existencia insuficiente".
  - Al insertar el movimiento de venta en `TINV_MOVIMIENTO`, se graba
    `servicio='S'` real (mismo fix de hardcoding que en A).
  - Se omite el `UPDATE TINV_EPRODUCTO SET exist_actual = exist_actual - :1`.
  - Se sigue exigiendo que exista una fila en `TINV_EPRODUCTO` para ese
    almacén (el producto debe estar "asignado" — dato barato, sin stock) —
    consistente con el resto del flujo y necesario para que el picker de
    productos lo encuentre por almacén.

### C. Cotización → Factura

**Backend:**
- `FatFacturasView.post` (`apps/fat/views.py`) lee `no_cotizacion` (y
  opcionalmente `tipo_cotizacion`) del `request.data` y lo pasa a
  `create_factura`.
- `create_factura` gana parámetro opcional `no_cotizacion: str = ''`. Si
  viene informado, después de crear la factura exitosamente (misma
  transacción/cursor):
  1. Busca el conduce probando `tipo_conduce IN ('CT','CO')` (mismo orden
     que el frontend) con ese `no_conduce`.
  2. Si no existe → falla silenciosamente (log, no aborta la factura ya
     creada — la factura es la fuente de verdad, el link es best-effort).
  3. Si existe pero ya tiene `NO_FACTURA` o `ST_ANULADO='S'` → error 400
     ANTES de crear la factura (fail-fast, se valida al inicio de
     `create_factura`, no al final).
  4. `UPDATE FAT.TFAT_CONDUCE SET no_factura=:1, tipo_factura=:2 WHERE ...`.

**Frontend:**
- `conduces.tsx`: en el sheet de detalle, si `selected.tipo_conduce==='CT'`
  y `st_anulado!=='S'` y no tiene `no_factura`, se agrega botón
  "Facturar" junto a "Editar"/"Imprimir PDF". Navega a
  `/fat/nueva-factura?cotizacion=<no_conduce>`.
- `fat-nueva-factura.tsx`: lee `search.cotizacion` (TanStack Router) al
  montar y, si viene, llama `cargarCotizacion(cotizacion)` automáticamente
  (mismo código que ya dispara el input manual "Cotización/Pedido" — no se
  duplica lógica).

### D. Side sheet de productos faltantes

- Nuevo componente `missing-products-sheet.tsx` en `features/fat/`.
- Después de `cargarCotizacion` puebla `lineas`, se filtran las que tengan
  `no_produ === 'X'`. Si hay alguna, se abre el side sheet automáticamente:
  "Estos artículos no existen en el inventario" — lista cada línea con su
  descripción/cantidad/precio (de la cotización) y dos botones por fila:
  "Crear como Artículo" / "Crear como Servicio".
- Cada botón abre el `CrearProductoModal` ya existente (reutilizado tal
  cual, sin duplicar formulario), con:
  - `descripcionInicial` = descripción de la línea.
  - Tipo (`servicio` field) preseleccionado según el botón elegido
    (usuario puede cambiarlo si quiere).
  - Nueva prop opcional `preselectAlmacenKey?: string` (formato
    `no_cia|punto|almacen`) para que el almacén de la factura actual quede
    pre-marcado en "Asignar a Empresa/Almacén" — evita que el producto
    recién creado no esté asignado y la factura falle después.
- Al `onCreated`, la línea correspondiente en `fat-nueva-factura.tsx` se
  reemplaza: `no_produ`/`emp`/empaques del producto nuevo, pero
  **mantiene** `cantidad` y `precio` que ya traía de la cotización (precio
  negociado, no el de lista).
- El sheet no deja "Continuar"/cerrar hasta que todas las líneas
  pendientes quedan resueltas (o el usuario cancela y decide editar
  manualmente la línea).

### E. Reversar (Anular) cotización

- Backend: `fat_repo.py::anular_conduce(no_cia, punto, tipo_conduce,
  no_conduce, usuario, motivo='')`. Valida no anulado ya, y que
  `NO_FACTURA` esté vacío (no se puede anular una cotización ya
  facturada — debe anularse la factura primero, patrón consistente con el
  resto del sistema). `UPDATE FAT.TFAT_CONDUCE SET st_anulado='S'`.
- Endpoint `POST /api/fat/conduces/<tipo>/<no_conduce>/anular/` en
  `apps/fat/urls.py` + `apps/fat/views.py`.
- Frontend: el botón "Anular" en `fat-nuevo-conduce.tsx` (hoy `disabled`)
  se activa cuando se está editando un conduce existente no anulado y sin
  factura vinculada; llama al endpoint y navega de vuelta a la consulta.
  También se agrega la misma acción (botón "Anular") en el sheet de
  detalle de `conduces.tsx`, junto a "Editar".
- No se implementa borrado físico — el patrón de todo el sistema
  (CxP/ACC/INV) es anular, nunca hard-delete de documentos.

### F. Verificación end-to-end (Playwright, skill sigaft-legacy-testing)

Contra la VM 10.0.0.99 con datos reales (cliente/productos existentes de
alguna compañía de prueba, ej. patrón ZZTEST usado en otras memorias):

1. Entrada de Compras con una línea de producto tipo Servicio → confirmar
   que el documento se crea pero `TINV_EPRODUCTO.exist_actual` del
   servicio no cambia (o no se crea fila).
2. Crear una cotización (CT) con 1 línea de producto real + 1 línea manual
   (`X`, marca/descripción libre).
3. Desde Consulta de Documentos (conduces.tsx), click "Facturar" → cae en
   Nueva Factura con cliente+líneas cargadas.
4. Confirmar que aparece el side sheet de "artículos no existen" para la
   línea manual; resolverla como Servicio.
5. Guardar la factura → confirmar que no bloquea por existencia
   insuficiente del servicio recién creado.
6. Volver a Consulta de Documentos → confirmar que la cotización ahora
   muestra "Factura vinculada" con el número correcto.
7. Anular la cotización de prueba (cleanup documentado del test, no se
   deja basura de prueba en estado facturable).

Reporte final: pasos ejecutados, capturas/log de red relevantes, y
confirmación explícita de que el cleanup (paso 7) se ejecutó.

## Fuera de alcance

- Borrado físico de cotizaciones/conduces.
- Cambios al flujo de Pedidos (CO) más allá de que comparten el mismo
  `create_movimiento_documento`/`create_factura` (se benefician del mismo
  fix pero no se les agrega un botón "Facturar" propio — ya lo tenían
  vía el campo manual de Nueva Factura; solo cotizaciones (CT) ganan el
  botón dedicado en Consulta de Documentos, por ser lo pedido).
- Reportes/PDF: no se modifican; ya muestran `no_factura` si está seteado.
