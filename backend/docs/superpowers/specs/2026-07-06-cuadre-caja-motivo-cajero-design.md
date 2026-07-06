# Spec — Cuadre de Caja: motivo de anulación + recibido/devuelto + Vista de Cajero

- Fecha: 2026-07-06
- Autor: JCABREU + Claude
- Estado: aprobado para implementación
- Alcance: FAT — Cuadre de Caja, Facturas (detalle POS), Nueva Factura, nueva Vista de Cajero

## 0. Prerequisito — reconciliar el revert de Cuadre de Caja

`frontend/src/features/fat/cuadre-caja.tsx` fue rediseñado (tarjetas separadas
Ventas Contado/Crédito, Cobros por Forma de Pago expandible con checkbox
"incluir en PDF", Facturación a Crédito, casilla manual "Cobros Créd.
Transferencia", switch "Ver detalle de NCF") en el commit `713b236`
(2026-06-17), pero fue revertido 32 min después en `90e0770` sin explicación
registrada. La VM de producción **nunca fue redesplegada con el revert** —
sigue corriendo la versión con tarjetas, que es la que el usuario usa a
diario y describe en este pedido. Decisión del usuario: mantener lo que está
en producción y cerrar la divergencia git↔VM.

Acción: antes de construir las 3 features nuevas, se sincroniza git para que
vuelva a coincidir con lo que corre en la VM:

- `frontend/src/features/fat/cuadre-caja.tsx` — reemplazar por la versión viva
  en la VM (tarjetas Card 1-5).
- `frontend/src/features/pdf/blocks/index.tsx` — reemplazar únicamente el
  componente `BloqueCuadreCaja` (y sus tipos `ResumenPagoItem`/`PorNcfItem`/
  `NcfFormaPagoItem`/`FacturaItem`/`labelNcfHuman`) por la versión de la VM,
  agrupada por forma de pago con cards Ventas/Cobros/Crédito/Matriz NCF
  opcional/Detalle. El resto del archivo (bloques de otros módulos: ODC, ACC,
  CHC, SDN, ACF, etc.) se queda igual — es más nuevo en git que en la VM y no
  se toca.
- `frontend/src/features/pdf/defaults/cuadre-caja.ts` — `showMatrizNcfFormaPago`
  pasa a `false` por default (la matriz NCF es opt-in vía el switch "Ver
  detalle de NCF" → `show_ncf_detail=1`), igual que en la VM.

Nota: el backend (`views_print_data.py`, `fat_repo.py`) y `PrintPage.tsx` /
`use-print-doc.ts` **ya están sincronizados** entre git y VM (diff vacío) —
no requieren reconciliación.

## 1. Problema real encontrado (no solo lo reportado)

Auditando el pipeline de impresión se encontró que el switch "Ver detalle de
NCF", las casillas "incluir esta forma de pago en el PDF" y el campo manual
"Cobros Créd. Transferencia" viajan como query params
(`show_ncf_detail`, `formas_pago_pdf`, `cobros_cred_transfer`) desde
`cuadre-caja.tsx` hacia la ruta `/print/cuadre-caja/:fecha`, pero esa ruta
(`frontend/src/routes/print/$codigo.$id.tsx`) solo reconoce y reenvía
`tipo_doc` e `incluir_detalle` — los otros tres se pierden en el camino. El
hook `usePrintDoc` ya reenvía genéricamente cualquier clave presente en
`extra` (esto se arregló en el commit `ebd0963`, posterior al revert), así
que el único punto que falta arreglar es la ruta. Este es el motivo real por
el que "el detalle no sale igual en el PDF": no es que el bloque PDF esté
mal, es que sus flags nunca llegan.

`formas_pago_pdf` tampoco es consumido en ningún lado (ni backend ni bloque
PDF) — se agrega el filtro que faltaba directo en `BloqueCuadreCaja`.

## 2. Motivo de anulación — end to end

Ya existe casi todo: `TFAT_FACTURA.TIPO_ANULA_DGII` se persiste al anular
(`fat_repo.anular_factura`, ya acepta `tipo_anula_dgii`) y
`FAT.TFAT_TANULACION_DGII` (tipo→descripción) ya se usa con éxito en el
reporte 608 (`rep_ncf_nulos`). Lo que falta:

1. **Backend — catálogo nuevo**: `fat_repo.list_motivos_anulacion_dgii(no_cia)`
   → `SELECT tipo, descripcion FROM FAT.TFAT_TANULACION_DGII ORDER BY tipo`.
   Endpoint `GET /api/fat/anulacion-motivos/` en `views.py` + `urls.py`.
2. **Backend — `list_facturas`** (`fat_repo.py:1508`, usada tanto por la
   lista de Facturas como por `extra.facturas` del cuadre de caja vía
   `incluir_detalle=1`): agregar
   `LEFT JOIN FAT.TFAT_TANULACION_DGII ta ON ta.tipo = f.tipo_anula_dgii`
   y exponer `motivo_anulacion` en cada item. Igual en `get_factura`
   (detalle de una factura individual).
3. **Frontend — modal Anular** (`fat-facturas.tsx`): quitar el `Textarea`
   libre "Motivo (opcional)" (nunca se guardaba — el backend lo descarta) y
   reemplazarlo por un `Select` obligatorio poblado con el catálogo nuevo,
   que envía `tipo_anula_dgii` en vez de `motivo`.
4. **Dónde aparece el motivo una vez persistido** (sin tocar más código que
   el paso 2, porque todos leen del mismo array):
   - Lista de Facturas (`fat-facturas.tsx`) y su detalle modal.
   - Cuadre de Caja — Card "Detalle de Facturas del Día" y su sub-tabla al
     expandir una forma de pago: bajo la fila roja "(ANUL)" se agrega una
     segunda línea pequeña "Motivo: {motivo_anulacion}".
   - PDF (`BloqueCuadreCaja`, sección Detalle) y CSV/Excel export: misma
     línea/columna adicional.

## 3. Recibido / Devuelto (efectivo) en la factura POS

`TFAT_FACTURA.VALOR_RECIBIDO` y `VALOR_DEVUELTO` existen en Oracle sin usar
en ningún lado del código.

1. **Frontend — Nueva Factura** (`fat-nueva-factura.tsx`): nuevo helper
   `esEfectivoLabel = (desc) => /efectivo|cash/i.test(desc)` (más estricto
   que el `esContadoLabel` existente, que también matchea tarjeta/
   transferencia "contado"). Cuando la forma de pago seleccionada matchea,
   se muestran 2 campos junto al total: **Recibido** (input numérico) y
   **Devuelta** (`= max(0, recibido - totalNeto)`, solo lectura). Si
   `recibido < totalNeto` se bloquea el guardado con un toast de validación
   (no se puede facturar en efectivo si no alcanza).
2. **Backend — `crear_factura`** (`fat_repo.py:2286`): agregar
   `valor_recibido, valor_devuelto` al INSERT de `TFAT_FACTURA` (columnas ya
   existen, solo faltan en la lista de columnas/binds). Params nuevos en
   `FatCrearFacturaView` (`views.py`) y en `regalGeneralApi.fatCrearFactura`.
3. **Dónde se muestra**: `get_factura` expone `valor_recibido`/
   `valor_devuelto`; el modal de detalle POS factura (`fat-facturas.tsx`,
   sección de totales) agrega las 2 líneas solo si `valor_recibido > 0`; el
   PDF de factura (registry `factura`) igual.

## 4. Vista de Cajero (nueva)

Ruta nueva `/fat/cajero`, entrada de sidebar bajo Facturación.

- **Backend**: `fat_repo.list_facturas_cajero(no_cia, punto, fecha)` —
  mismo criterio que "Día en progreso" ya usado en cuadre de caja
  (`no_cuadre` nulo para esa fecha vía `list_cuadre_caja`): factura del
  `no_cia`/`punto` cuya fecha no tiene un cuadre de caja cerrado todavía.
  Devuelve `tipo_factura, no_factura, nombre_cliente, total_neto, forma_pago,
  valor_recibido, valor_devuelto, st_anulado, ncf_dgi`. Endpoint
  `GET /api/fat/cajero/pendientes/?no_cia=&punto=&fecha=` (fecha default
  hoy).
- **Frontend** (`frontend/src/features/fat/fat-cajero.tsx`): tabla con esas
  columnas, sin paginación (es el turno del día, volumen bajo). Click en una
  fila reutiliza el mismo modal de detalle que `fat-facturas.tsx` (se
  extrae ese modal a un componente compartido `FacturaDetalleDialog` para no
  duplicar JSX entre las dos pantallas).

## 5. Fuera de alcance

- No se cambia el schema Oracle (todas las columnas usadas ya existen).
- No se toca `list_facturas_pendientes_cnt` (es un concepto distinto:
  pendiente de asiento contable, no de cuadre de caja).
- No se implementa pago dividido (multi-forma-pago por factura) — sigue
  siendo una sola forma de pago por factura, como hoy.
