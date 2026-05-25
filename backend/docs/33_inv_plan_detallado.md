# Plan detallado INV — Inventario

## Fuentes legacy

### FMX únicos activos (formularios Oracle Forms)

Los FMX con sufijos `_otro`, `_plus`, `_fecha` son variantes del mismo número base;
se cuentan como un único formulario lógico.

| FMX base | Descripción inferida |
|---|---|
| `Fmenu_inv.fmx` | Menú principal del módulo INV |
| `Finv101.fmx` | Alta y mantenimiento de productos |
| `Finv102.fmx` | Catálogo de líneas de producto |
| `Finv103.fmx` | Catálogo de sublíneas de producto |
| `Finv104.fmx` | Catálogo de grupos de producto |
| `Finv105.fmx` | Catálogo de unidades de medida |
| `Finv106.fmx` | Catálogo de empaques |
| `Finv107.fmx` | Catálogo de colores |
| `Finv108.fmx` | Catálogo de modelos |
| `Finv109.fmx` | Configuración de almacenes |
| `Finv110.fmx` | Configuración de puntos de almacenamiento |
| `Finv111.fmx` | Parámetros de almacén por empresa |
| `Finv112.fmx` | Asignación producto-almacén |
| `Finv113.fmx` | Configuración de depósitos / ubicaciones |
| `Finv114.fmx` | Mantenimiento de proveedores de producto |
| `Finv115.fmx` | Lista de precios por producto |
| `Finv116.fmx` | Historial de costos / precios de costo |
| `Finv117.fmx` | Equivalencias o sustitutos de producto |
| `Finv118.fmx` | Agrupaciones o kits de productos |
| `Finv119.fmx` | Parámetros de reorden (min/max/punto de reorden) |
| `Finv120.fmx` | Configuración de series / lotes |
| `Finv121.fmx` | Mantenimiento de categorías fiscales de producto |
| `Finv122.fmx` | Parámetros adicionales de producto |
| `Finv124.fmx` | Códigos de barras — asignación a producto |
| `Finv125.fmx` | Consulta / impresión de códigos de barras |
| `Finv201.fmx` | Entrada de mercancía (recepción compras) |
| `Finv202.fmx` | Entrada por devolución de cliente |
| `Finv203.fmx` | Entrada por transferencia recibida |
| `Finv204.fmx` | Entrada por producción / fabricación |
| `Finv205.fmx` | Salida por ventas / despacho |
| `Finv206.fmx` | Salida por devolución a proveedor |
| `Finv207.fmx` | Salida por transferencia enviada |
| `Finv208.fmx` | Salida por consumo interno |
| `Finv209.fmx` | Salida por merma / pérdida |
| `Finv210.fmx` | Ajuste positivo de inventario |
| `Finv211.fmx` | Ajuste negativo de inventario |
| `Finv212.fmx` | Ajuste de costo de producto |
| `Finv213.fmx` | Ajuste por diferencia de toma física |
| `Finv214.fmx` | Reclasificación de producto |
| `Finv215.fmx` | Corrección de transacción previa |
| `Finv216.fmx` | Anulación de movimiento |
| `Finv217.fmx` | Reverso de transacción |
| `Finv218.fmx` | Consulta / auditoría de movimientos |
| `Finv301.fmx` | Preparar toma física — generar planilla |
| `Finv302.fmx` | Imprimir planilla de conteo |
| `Finv303.fmx` (FINV303) | Configuración / parámetros de toma física |
| `Finv304.fmx` | Congelar existencias para toma física |
| `Finv305.fmx` | Ingresar conteo — primer conteo |
| `Finv306.fmx` | Ingresar conteo — segundo conteo / verificación |
| `Finv307.fmx` | Aprobar diferencias y generar ajuste de toma física |
| `Finv401.fmx` | Transferencia entre almacenes — cabecera |
| `Finv402.fmx` | Recepción de transferencia entre almacenes |
| `Finv403.fmx` | Consulta y anulación de transferencias |
| `Finv501.fmx` | Proceso de cierre mensual de inventario |
| `Finv502.fmx` | Recálculo de costos promedio |
| `Finv503.fmx` | Validación previa al cierre |
| `Finv504.fmx` | Apertura de período / reversión de cierre |
| `Finv601.fmx` | Mantenimiento de usuarios y accesos INV (TINV_USUARIO) |
| `Finv701.fmx` | Reporte de existencia actual por almacén |
| `Finv702.fmx` | Reporte de movimientos por período |
| `Finv703.fmx` | Kardex de producto |
| `Finv704.fmx` | Valorización de inventario |
| `Finv705.fmx` | Reporte especial / análisis de rotación |
| `Finv706.fmx` | Reporte de productos sin movimiento |
| `Finv707.fmx` | Reporte de productos bajo mínimo (reorden) |
| `Finv708.fmx` | Reporte de entradas por período |
| `Finv709.fmx` | Reporte de salidas por período |
| `Finv710.fmx` | Reporte de ajustes por período |
| `Finv805.fmx` | Mantenimiento avanzado / utilitarios administrativos |
| `Finv901.fmx` | Cierre anual de inventario |

**Total FMX únicos: 63**

---

### REP únicos activos (reportes Oracle Reports)

Los REP con sufijos `_susana`, `_cmjc`, `_plus`, `_otro`, `_301118`, `_Sin_conteo`,
`_ctenis` son variantes del mismo número base; se cuentan como un único reporte lógico.

| REP base | Descripción inferida |
|---|---|
| `Rinv201.rep` | Reporte de entradas — detalle por comprobante |
| `Rinv202.rep` | Reporte de entradas — resumen por proveedor |
| `Rinv203.rep` | Reporte de entradas — por período y almacén |
| `Rinv204.rep` | Reporte de entradas — por tipo de movimiento |
| `Rinv205.rep` | Reporte de salidas — detalle por comprobante |
| `Rinv206.rep` | Reporte de salidas — resumen por cliente |
| `Rinv207.rep` | Reporte de salidas — por período y almacén |
| `Rinv301.rep` | Planilla de toma física para conteo |
| `Rinv302.rep` | Diferencias de toma física — primer conteo |
| `Rinv303.rep` | Diferencias de toma física — segundo conteo |
| `Rinv304.rep` | Resumen de ajustes generados por toma física |
| `Rinv305.rep` | Reporte de productos no contados |
| `Rinv306.rep` | Hoja de conteo por ubicación / depósito |
| `Rinv307.rep` | Acta de toma física (documento formal) |
| `Rinv308.rep` | Comparativo entre conteos (1ro vs 2do) |
| `Rinv309.rep` | Valorización del inventario en toma física |
| `Rinv310.rep` | Listado de productos con diferencias significativas |
| `Rinv311.rep` | Resumen ejecutivo de toma física |
| `Rinv312.rep` | Kardex durante período de toma física |
| `Rinv313.rep` | Existencias congeladas a fecha de toma |
| `Rinv314.rep` | Reporte de toma física por responsable |
| `Rinv315.rep` | Control de planillas entregadas / recibidas |
| `Rinv316.rep` | Análisis de varianza porcentual por producto |
| `Rinv317.rep` | Reporte de productos nuevos detectados en conteo |
| `Rinv318.rep` | Listado de productos con costo cero |
| `Rinv319.rep` | Toma física — exportación a Excel |
| `Rinv320.rep` | Reporte de toma física histórica |
| `Rinv321.rep` | Inventario físico valorizado final |
| `Rinv322.rep` | Ajustes aprobados de toma física |
| `Rinv323.rep` | Diferencias pendientes de aprobación |
| `Rinv324.rep` | Resumen por línea / sublínea de toma física |
| `Rinv325.rep` | Toma física por almacén y zona |
| `Rinv326.rep` | Historial de tomas físicas anteriores |
| `Rinv327.rep` | Certificación de inventario (firma responsable) |
| `Rinv328.rep` | Cierre de toma física — comprobante |
| `Rinv401.rep` | Transferencias emitidas entre almacenes |
| `Rinv402.rep` | Transferencias recibidas entre almacenes |
| `Rinv501.rep` | Reporte de cierre mensual de inventario |
| `Rinv701.rep` | Existencia actual por almacén y producto |
| `Rinv702.rep` | Movimientos de inventario por período |
| `Rinv703.rep` | Kardex de producto |
| `Rinv704.rep` | Valorización de inventario |
| `Rinv705.rep` | Rotación de inventario / análisis ABC |
| `Rinv706.rep` | Productos sin movimiento |
| `Rinv707.rep` | Productos bajo punto de reorden |
| `Rinv708.rep` | Entradas consolidadas por período |
| `Rinv709.rep` | Salidas consolidadas por período |
| `Rinv901.rep` | Reporte de cierre anual de inventario |
| `Rinv_etiqueta.rep` | Etiqueta de producto con código de barras (formato estándar) |
| `Rinv_etiqueta_pequeña.rep` | Etiqueta pequeña de producto |
| `Rinv_etiqueta_grande.rep` | Etiqueta grande de producto |
| `Rinv_etiqueta_precio.rep` | Etiqueta con precio de venta |
| `Rinv_etiqueta_costo.rep` | Etiqueta con costo de producto |
| `Rinv_etiqueta_bodega.rep` | Etiqueta para uso interno de bodega |
| `Rinv_etiqueta_envio.rep` | Etiqueta de envío / despacho |
| `Rinv_etiqueta_lote.rep` | Etiqueta de lote o serie |
| `Rinv_BarCode.rep` | Código de barras estándar (generación) |
| `Rinv_BarCode_128.rep` | Código de barras formato Code 128 |
| `Rinv_BarCode_EAN13.rep` | Código de barras formato EAN-13 |
| `Rinv_BarCode_QR.rep` | Código QR de producto |
| `Rinv_BarCode_interno.rep` | Código de barras para uso interno |
| `Rinv_BarCode_precio.rep` | Código de barras con precio incluido |
| `Rinv_BarCode_lote.rep` | Código de barras por lote |
| `Rinv_BarCode_ubicacion.rep` | Código de barras de ubicación en almacén |
| `Rinv_Monarch9416.rep` | Impresión Monarch 9416 — formato estándar |
| `Rinv_Monarch9416_precio.rep` | Impresión Monarch 9416 — con precio |
| `Rinv_Monarch9416_lote.rep` | Impresión Monarch 9416 — por lote |

**Total REP únicos: 69**

---

## Secciones del módulo en el clon

### 1. Productos (Finv101–Finv125)

**Tablas Oracle:** `TINV_PRODUCTO`, `TINV_ALMACEN`, `TINV_EXIST_ACTUAL`,
`TINV_LINEA`, `TINV_SUB_LINEA`, `TINV_GRUPO_PRODU`, `TINV_UNIDAD`,
`TINV_EMPAQUE`, `TINV_COLOR`, `TINV_MODELO`, `TINV_CODIGO_BARRA`

| FMX | Descripción | Estado | Ruta clon equivalente | Prioridad |
|---|---|---|---|---|
| Finv101 | Alta y mantenimiento de productos | Pendiente | `/inv/productos` | Alta |
| Finv102 | Catálogo de líneas | Pendiente | `/inv/catalogos/lineas` | Alta |
| Finv103 | Catálogo de sublíneas | Pendiente | `/inv/catalogos/sublineas` | Alta |
| Finv104 | Catálogo de grupos | Pendiente | `/inv/catalogos/grupos` | Alta |
| Finv105 | Catálogo de unidades de medida | Pendiente | `/inv/catalogos/unidades` | Alta |
| Finv106 | Catálogo de empaques | Pendiente | `/inv/catalogos/empaques` | Media |
| Finv107 | Catálogo de colores | Pendiente | `/inv/catalogos/colores` | Media |
| Finv108 | Catálogo de modelos | Pendiente | `/inv/catalogos/modelos` | Media |
| Finv109 | Configuración de almacenes | Pendiente | `/inv/almacenes` | Alta |
| Finv110 | Configuración de puntos de almacenamiento | Pendiente | `/inv/almacenes/puntos` | Alta |
| Finv111 | Parámetros de almacén por empresa | Pendiente | `/inv/almacenes/parametros` | Media |
| Finv112 | Asignación producto-almacén | Pendiente | `/inv/productos/almacen` | Alta |
| Finv113 | Configuración de depósitos / ubicaciones | Pendiente | `/inv/almacenes/depositos` | Media |
| Finv114 | Mantenimiento de proveedores de producto | Pendiente | `/inv/productos/proveedores` | Media |
| Finv115 | Lista de precios | Pendiente | `/inv/productos/precios` | Alta |
| Finv116 | Historial de costos | Pendiente | `/inv/productos/costos` | Alta |
| Finv117 | Equivalencias / sustitutos | Pendiente | `/inv/productos/equivalencias` | Baja |
| Finv118 | Kits / agrupaciones de productos | Pendiente | `/inv/productos/kits` | Baja |
| Finv119 | Parámetros de reorden | Pendiente | `/inv/productos/reorden` | Media |
| Finv120 | Series y lotes | Pendiente | `/inv/productos/series` | Media |
| Finv121 | Categorías fiscales de producto | Pendiente | `/inv/productos/fiscal` | Media |
| Finv122 | Parámetros adicionales | Pendiente | `/inv/productos/parametros` | Media |
| Finv124 | Asignación de códigos de barras | Pendiente | `/inv/productos/barcodes` | Media |
| Finv125 | Consulta / impresión de códigos de barras | Pendiente | `/inv/productos/barcodes/print` | Baja |

### 2. Transacciones (Finv201–Finv218)

**Tablas Oracle:** `TINV_TRANSACCIONES`, `TINV_MOVIMIENTO`, `TINV_DETALLE_MOV`

| FMX | Descripción | Estado | Ruta clon equivalente | Prioridad |
|---|---|---|---|---|
| Finv201 | Entrada de mercancía (compras) | Pendiente | `/inv/transacciones/entradas/compras` | Alta |
| Finv202 | Entrada por devolución de cliente | Pendiente | `/inv/transacciones/entradas/devolucion-cliente` | Alta |
| Finv203 | Entrada por transferencia recibida | Pendiente | `/inv/transacciones/entradas/transferencia` | Media |
| Finv204 | Entrada por producción | Pendiente | `/inv/transacciones/entradas/produccion` | Media |
| Finv205 | Salida por ventas / despacho | Pendiente | `/inv/transacciones/salidas/ventas` | Alta |
| Finv206 | Salida por devolución a proveedor | Pendiente | `/inv/transacciones/salidas/devolucion-proveedor` | Alta |
| Finv207 | Salida por transferencia enviada | Pendiente | `/inv/transacciones/salidas/transferencia` | Media |
| Finv208 | Salida por consumo interno | Pendiente | `/inv/transacciones/salidas/consumo` | Media |
| Finv209 | Salida por merma | Pendiente | `/inv/transacciones/salidas/merma` | Media |
| Finv210 | Ajuste positivo | Pendiente | `/inv/ajustes/positivo` | Alta |
| Finv211 | Ajuste negativo | Pendiente | `/inv/ajustes/negativo` | Alta |
| Finv212 | Ajuste de costo | Pendiente | `/inv/ajustes/costo` | Media |
| Finv213 | Ajuste por diferencia de toma física | Pendiente | `/inv/ajustes/toma-fisica` | Media |
| Finv214 | Reclasificación de producto | Pendiente | `/inv/ajustes/reclasificacion` | Baja |
| Finv215 | Corrección de transacción | Pendiente | `/inv/ajustes/correccion` | Media |
| Finv216 | Anulación de movimiento | Pendiente | `/inv/transacciones/anulacion` | Media |
| Finv217 | Reverso de transacción | Pendiente | `/inv/transacciones/reverso` | Media |
| Finv218 | Consulta / auditoría de movimientos | Pendiente | `/inv/transacciones/consulta` | Alta |

### 3. Toma Física (Finv301–Finv307)

**Tablas Oracle:** `TINV_CONTEO_FISICO`, `TINV_CONTEO`, `TINV_PLANILLA_CONTEO`

| FMX | Descripción | Estado | Ruta clon equivalente | Prioridad |
|---|---|---|---|---|
| Finv301 | Generar planilla de toma física | Pendiente | `/inv/toma-fisica/generar` | Media |
| Finv302 | Imprimir planilla de conteo | Pendiente | `/inv/toma-fisica/imprimir` | Media |
| Finv303 | Configuración / parámetros de toma física | Pendiente | `/inv/toma-fisica/parametros` | Media |
| Finv304 | Congelar existencias | Pendiente | `/inv/toma-fisica/congelar` | Media |
| Finv305 | Ingresar primer conteo | Pendiente | `/inv/toma-fisica/conteo/primero` | Media |
| Finv306 | Ingresar segundo conteo / verificación | Pendiente | `/inv/toma-fisica/conteo/segundo` | Media |
| Finv307 | Aprobar diferencias y generar ajuste | Pendiente | `/inv/toma-fisica/aprobar` | Media |

### 4. Transferencias / Especiales (Finv401–Finv403)

**Tablas Oracle:** `TINV_TRANSFERENCIA`, `TINV_DET_TRANSFERENCIA`

| FMX | Descripción | Estado | Ruta clon equivalente | Prioridad |
|---|---|---|---|---|
| Finv401 | Emisión de transferencia entre almacenes | Pendiente | `/inv/transferencias/emitir` | Media |
| Finv402 | Recepción de transferencia | Pendiente | `/inv/transferencias/recibir` | Media |
| Finv403 | Consulta y anulación de transferencias | Pendiente | `/inv/transferencias/consulta` | Media |

### 5. Procesos / Cierre (Finv501–Finv504, Finv901)

**Tablas Oracle:** `TINV_CIERRE`, `TINV_PERIODO`

| FMX | Descripción | Estado | Ruta clon equivalente | Prioridad |
|---|---|---|---|---|
| Finv501 | Proceso de cierre mensual | Pendiente | `/inv/cierres/mensual` | Media |
| Finv502 | Recálculo de costos promedio | Pendiente | `/inv/cierres/recalculo-costo` | Media |
| Finv503 | Validación previa al cierre | Pendiente | `/inv/cierres/validacion` | Media |
| Finv504 | Apertura de período / reversión de cierre | Pendiente | `/inv/cierres/apertura` | Baja |
| Finv901 | Cierre anual de inventario | Pendiente | `/inv/cierres/anual` | Baja |

### 6. Accesos (Finv601)

**Tablas Oracle:** `TINV_USUARIO`, `TINV_ACCESO`

| FMX | Descripción | Estado | Ruta clon equivalente | Prioridad |
|---|---|---|---|---|
| Finv601 | Mantenimiento de usuarios y accesos INV | Pendiente | `/inv/accesos/usuarios` | Media |

### 7. Reportes impresos (Finv701–Finv710 / Rinv*)

**Tablas Oracle:** `TINV_EXIST_ACTUAL`, `TINV_MOVIMIENTO`, `TINV_KARDEX`

| REP base | Descripción | Estado | Ruta clon equivalente | Prioridad |
|---|---|---|---|---|
| Rinv201 | Entradas — detalle por comprobante | Pendiente | `/inv/reportes/entradas/detalle` | Alta |
| Rinv202 | Entradas — resumen por proveedor | Pendiente | `/inv/reportes/entradas/proveedor` | Media |
| Rinv203 | Entradas — por período y almacén | Pendiente | `/inv/reportes/entradas/periodo` | Media |
| Rinv204 | Entradas — por tipo de movimiento | Pendiente | `/inv/reportes/entradas/tipo` | Media |
| Rinv205 | Salidas — detalle por comprobante | Pendiente | `/inv/reportes/salidas/detalle` | Alta |
| Rinv206 | Salidas — resumen por cliente | Pendiente | `/inv/reportes/salidas/cliente` | Media |
| Rinv207 | Salidas — por período y almacén | Pendiente | `/inv/reportes/salidas/periodo` | Media |
| Rinv401 | Transferencias emitidas | Pendiente | `/inv/reportes/transferencias/emitidas` | Media |
| Rinv402 | Transferencias recibidas | Pendiente | `/inv/reportes/transferencias/recibidas` | Media |
| Rinv501 | Cierre mensual | Pendiente | `/inv/reportes/cierres/mensual` | Media |
| Rinv701 | Existencia actual por almacén | Pendiente | `/inv/reportes/existencias` | Alta |
| Rinv702 | Movimientos por período | Pendiente | `/inv/reportes/movimientos` | Alta |
| Rinv703 | Kardex de producto | Pendiente | `/inv/reportes/kardex` | Alta |
| Rinv704 | Valorización de inventario | Pendiente | `/inv/reportes/valorizacion` | Alta |
| Rinv705 | Rotación / análisis ABC | Pendiente | `/inv/reportes/rotacion` | Media |
| Rinv706 | Productos sin movimiento | Pendiente | `/inv/reportes/sin-movimiento` | Media |
| Rinv707 | Productos bajo reorden | Pendiente | `/inv/reportes/reorden` | Media |
| Rinv708 | Entradas consolidadas | Pendiente | `/inv/reportes/entradas/consolidado` | Media |
| Rinv709 | Salidas consolidadas | Pendiente | `/inv/reportes/salidas/consolidado` | Media |
| Rinv901 | Cierre anual | Pendiente | `/inv/reportes/cierres/anual` | Baja |

### 8. Toma Física — Reportes (Rinv301–Rinv328)

| REP base | Descripción | Estado | Ruta clon equivalente | Prioridad |
|---|---|---|---|---|
| Rinv301 | Planilla de toma física | Pendiente | `/inv/toma-fisica/reportes/planilla` | Media |
| Rinv302 | Diferencias — primer conteo | Pendiente | `/inv/toma-fisica/reportes/dif-primer` | Media |
| Rinv303 | Diferencias — segundo conteo | Pendiente | `/inv/toma-fisica/reportes/dif-segundo` | Media |
| Rinv304 | Resumen de ajustes | Pendiente | `/inv/toma-fisica/reportes/ajustes` | Media |
| Rinv305 | Productos no contados | Pendiente | `/inv/toma-fisica/reportes/no-contados` | Baja |
| Rinv306 | Hoja de conteo por ubicación | Pendiente | `/inv/toma-fisica/reportes/ubicacion` | Baja |
| Rinv307 | Acta de toma física | Pendiente | `/inv/toma-fisica/reportes/acta` | Baja |
| Rinv308 | Comparativo 1er vs 2do conteo | Pendiente | `/inv/toma-fisica/reportes/comparativo` | Baja |
| Rinv309 | Valorización en toma física | Pendiente | `/inv/toma-fisica/reportes/valorizacion` | Baja |
| Rinv310 | Diferencias significativas | Pendiente | `/inv/toma-fisica/reportes/diferencias` | Baja |
| Rinv311 | Resumen ejecutivo de toma física | Pendiente | `/inv/toma-fisica/reportes/resumen` | Baja |
| Rinv312 | Kardex durante toma física | Pendiente | `/inv/toma-fisica/reportes/kardex` | Baja |
| Rinv313 | Existencias congeladas | Pendiente | `/inv/toma-fisica/reportes/congeladas` | Baja |
| Rinv314 | Toma física por responsable | Pendiente | `/inv/toma-fisica/reportes/responsable` | Baja |
| Rinv315 | Control de planillas entregadas | Pendiente | `/inv/toma-fisica/reportes/planillas` | Baja |
| Rinv316 | Varianza porcentual por producto | Pendiente | `/inv/toma-fisica/reportes/varianza` | Baja |
| Rinv317 | Productos nuevos detectados | Pendiente | `/inv/toma-fisica/reportes/nuevos` | Baja |
| Rinv318 | Productos con costo cero | Pendiente | `/inv/toma-fisica/reportes/costo-cero` | Baja |
| Rinv319 | Exportación a Excel | Pendiente | `/inv/toma-fisica/reportes/excel` | Baja |
| Rinv320 | Toma física histórica | Pendiente | `/inv/toma-fisica/reportes/historica` | Baja |
| Rinv321 | Inventario físico valorizado final | Pendiente | `/inv/toma-fisica/reportes/valorizado` | Baja |
| Rinv322 | Ajustes aprobados | Pendiente | `/inv/toma-fisica/reportes/aprobados` | Baja |
| Rinv323 | Diferencias pendientes de aprobación | Pendiente | `/inv/toma-fisica/reportes/pendientes` | Baja |
| Rinv324 | Resumen por línea / sublínea | Pendiente | `/inv/toma-fisica/reportes/linea` | Baja |
| Rinv325 | Toma física por almacén y zona | Pendiente | `/inv/toma-fisica/reportes/zona` | Baja |
| Rinv326 | Historial de tomas físicas | Pendiente | `/inv/toma-fisica/reportes/historial` | Baja |
| Rinv327 | Certificación de inventario | Pendiente | `/inv/toma-fisica/reportes/certificacion` | Baja |
| Rinv328 | Cierre de toma física | Pendiente | `/inv/toma-fisica/reportes/cierre` | Baja |

### 9. Etiquetas y Códigos de Barras (Rinv_etiqueta*, Rinv_BarCode*, Rinv_Monarch*)

| REP base | Descripción | Estado | Ruta clon equivalente | Prioridad |
|---|---|---|---|---|
| Rinv_etiqueta | Etiqueta estándar con código de barras | Pendiente | `/inv/etiquetas/estandar` | Baja |
| Rinv_etiqueta_pequeña | Etiqueta pequeña | Pendiente | `/inv/etiquetas/pequena` | Baja |
| Rinv_etiqueta_grande | Etiqueta grande | Pendiente | `/inv/etiquetas/grande` | Baja |
| Rinv_etiqueta_precio | Etiqueta con precio | Pendiente | `/inv/etiquetas/precio` | Baja |
| Rinv_etiqueta_costo | Etiqueta con costo | Pendiente | `/inv/etiquetas/costo` | Baja |
| Rinv_etiqueta_bodega | Etiqueta de bodega interna | Pendiente | `/inv/etiquetas/bodega` | Baja |
| Rinv_etiqueta_envio | Etiqueta de envío | Pendiente | `/inv/etiquetas/envio` | Baja |
| Rinv_etiqueta_lote | Etiqueta de lote | Pendiente | `/inv/etiquetas/lote` | Baja |
| Rinv_BarCode | Código de barras estándar | Pendiente | `/inv/barcodes/estandar` | Baja |
| Rinv_BarCode_128 | Code 128 | Pendiente | `/inv/barcodes/code128` | Baja |
| Rinv_BarCode_EAN13 | EAN-13 | Pendiente | `/inv/barcodes/ean13` | Baja |
| Rinv_BarCode_QR | Código QR | Pendiente | `/inv/barcodes/qr` | Baja |
| Rinv_BarCode_interno | Barcode uso interno | Pendiente | `/inv/barcodes/interno` | Baja |
| Rinv_BarCode_precio | Barcode con precio | Pendiente | `/inv/barcodes/precio` | Baja |
| Rinv_BarCode_lote | Barcode por lote | Pendiente | `/inv/barcodes/lote` | Baja |
| Rinv_BarCode_ubicacion | Barcode de ubicación | Pendiente | `/inv/barcodes/ubicacion` | Baja |
| Rinv_Monarch9416 | Impresión Monarch 9416 estándar | Pendiente | `/inv/barcodes/monarch/estandar` | Baja |
| Rinv_Monarch9416_precio | Monarch 9416 con precio | Pendiente | `/inv/barcodes/monarch/precio` | Baja |
| Rinv_Monarch9416_lote | Monarch 9416 por lote | Pendiente | `/inv/barcodes/monarch/lote` | Baja |

---

## Matriz de cobertura

| Grupo | FMX/REP únicos | Implementado en clon | Pendiente | Capturas confirmadas | Prioridad |
|---|---|---|---|---|---|
| 1. Productos / Configuración (Finv101-125) | 24 FMX | 0 | 24 | Finv101,102,103,104,105,106,107,108,109,111,112,113,114,115,116,117,118,119,125 (19 de 24) | Alta |
| 2. Transacciones (Finv201-218) | 18 FMX | 0 | 18 | Finv201,202,203,204,205,206,210,211,213,214,215,217 (12 de 18) | Alta |
| 3. Toma Física — Forms (Finv301-307 / Finv705-710) | 7 FMX + forms CF | 0 | 7 | Finv702,705,707,708,709,710 (6 capturas CF) | Media |
| 4. Transferencias (Finv401-403) | 3 FMX | 0 | 3 | — | Media |
| 5. Procesos / Cierre (Finv401-403 cierre, Finv501-504, Finv901) | 5 FMX | 0 | 5 | Finv401,402,403 (cierre) confirmados | Media/Baja |
| 6. Accesos (Finv601) | 1 FMX | 0 | 1 | Finv103 (Mantenimiento Privilegios Usuarios) | Media |
| 7. Menú + Administrativo (Fmenu, Finv805) | 2 FMX | 0 | 2 | Menú completo confirmado (5 capturas de submenús) | Media |
| 8. Reportes principales (Rinv201-709, Rinv901) | 20 REP | 0 | 20 | Finv301,302,303,304,305,306 (parámetros reportes) | Alta/Media |
| 9. Toma Física — Reportes (Rinv301-328) | 28 REP | 0 | 28 | Rinv303,305,311,315,324 confirmados | Baja |
| 10. Etiquetas y Barcodes (Rinv_etiqueta*, BarCode*, Monarch*) | 19 REP | 0 | 19 | Rinv_etiqueta_grde, Rinv_Monarch9416 confirmados | Baja |
| **TOTAL** | **63 FMX + 69 REP = 132** | **0** | **132** | **65 capturas, ~40 pantallas únicas** | — |

---

## Notas de implementación

1. **Shell existente:** El módulo INV fue creado con la estructura de carpetas y
   cards planned en el frontend. Ningún formulario es funcional todavía.

2. **Orden sugerido de construcción:**
   - Primero: catálogo de productos (Finv101-105, Finv109-110, Finv112) y
     existencia actual (Rinv701).
   - Segundo: transacciones de entrada y salida (Finv201-209) con su reporte
     de movimientos (Rinv702) y kardex (Rinv703).
   - Tercero: ajustes (Finv210-213), valorización (Rinv704), transferencias
     (Finv401-402).
   - Cuarto: toma física completa (Finv301-307 + Rinv301-328).
   - Quinto: cierres (Finv501-504, Finv901), accesos (Finv601).
   - Último: etiquetas, códigos de barras, variantes de reportes.

3. **Variantes legacy ignoradas en el conteo** (sufijos `_otro`, `_plus`,
   `_fecha`, `_susana`, `_cmjc`, `_301118`, `_Sin_conteo`, `_ctenis`):
   representan personalizaciones puntuales o versiones de desarrollo.
   Se resolverán como parámetros o filtros dentro del reporte único del clon.

4. **Multi-empresa:** Todos los formularios deben respetar la empresa y el
   almacén activo del contexto del usuario, igual que el legado.

5. **Cero Django ORM contra Oracle:** Toda consulta usa
   `apps.legacy.client` (pool python-oracledb thick mode).

---

## Capturas del legacy (2026-05-20)

Navegación completa realizada por JCABREU el 20/05/2026. Total: 65 capturas PNG.

**Observaciones generales del sistema legacy:**
- Sistema: Oracle Forms 6i — "Sistema de Gestión Administrativa y Financiera (SIGAF)"
- Empresa activa en sesión: ABREGONZA, SRL
- Usuario activo: JCABREU / SIGAF
- Barra de título de cada form muestra: código FMX (ej. FINV101), usuario, fecha, hora
- Menú horizontal principal: Configuración | Procesos | Consultas | Reportes | Conteo Físico | Cierre | Acceso | Salir | Sigaf | Window
- Los números de FMX reales difieren de los inferidos: por ejemplo, el form de Líneas es FINV106 (no 102), Sublíneas es FINV107, Grupo Contable es FINV108, Almacenes es FINV104, Unidades es FINV109, Referencia Empaque es FINV110, Mantenimiento Productos es FINV111, Carga desde Excel es FINV125

| # | Archivo | Pantalla identificada | FMX real | Sección menú | Campos clave visibles | Tipo |
|---|---|---|---|---|---|---|
| 1 | Screenshot 2026-05-20 094756.png | Menú Configuración desplegado | Fmenu_inv | Configuración | Compañías, Puntos de Trabajo, Acceso de Usuarios, Almacenes, Tipos de Documentos, Grupo de Productos, Línea de Productos, Sub Línea de Productos, Grupo Contable de Productos, Unidades de Empaque, Referencia de Empaque, Marca de Producto/Activo, Productos, Crear Productos desde Excel, Asignar Prod. A Cia. y Almacén, Activar/Desactivar Prod. Almacén, Modificar Costo, Ensamblar Productos, Digitar Mínimo y Máximo, Modificar Tramo y Estante, Digitar Envases Retornables | menú |
| 2 | Screenshot 2026-05-20 094801.png | Menú Procesos desplegado | Fmenu_inv | Procesos | Generar TXT a Ordenes de Compras, Entrada de Compras, Entrada Mercancía al Almacén, Salida de Mercancía del Almacén, Transferencia de Mercancía, Entrada de Producción (Prod. Compuesto), Despacho Cotización/Orden Producción, Salida de Prod. Ensamblados (Reproceso), Devolución de Compra a Suplidores, Devolución de Ventas Desde Clientes, Reversar Doc. de Movimiento Interno, Impresión de Documentos, Listado de Recepción de Merc. Resumen, Listado de Recepción de Merc. Detalle, Listado de Doc. Con Asiento Contable, Digitar Series de Productos a Documento | menú |
| 3 | Screenshot 2026-05-20 094805.png | Menú Consultas desplegado | Fmenu_inv | Consultas | Consulta de Documentos, Existencia de Producto, Existencia de Prod. En grupo, Costo de Producto en Rango de Fecha | menú |
| 4 | Screenshot 2026-05-20 094818.png | Menú Reportes desplegado | Fmenu_inv | Reportes | Existencia, Movimiento de Productos, Productos Ensamblados, Productos Con su Empaque, Listado de Líneas y Sublíneas, Imprimir Etiquetas Intermec, Imprimir Etiquetas Monarch 9416, Devoluciones de Ventas por Vendedor, Auxiliar de Inventario, Consumo Por Proyecto, Etiquetas y Códigos de Barras Por línea-SubL, Códigos de Barra por Documentos, Imprimir Etiquetas, Cantidad Reservada | menú |
| 5 | Screenshot 2026-05-20 094823.png | Menú Conteo Físico desplegado | Fmenu_inv | Conteo Físico | Reportes Para Conteo Físico / Cancelar CF, Cargar Conteo Físico Desde Excel, Entrada/Mantenimiento Conteo Físico Manual, Reportes Comparativo Físico vs Teórico, Ajuste de Inventario por Conteo Físico, Consulta Histórico de Conteo Físico | menú |
| 6 | Screenshot 2026-05-20 094831.png | Menú Cierre desplegado | Fmenu_inv | Cierre | Entrada de Diario, Generar Asiento a contabilidad, Cierre Mensual | menú |
| 7 | Screenshot 2026-05-20 094840.png | FINV101 — Mantenimiento de Compañías | FINV101 | Configuración | No Cia, Descripción, Activa (checkbox); registros: 01=ABREGONZA SRL, 02=RC HERNANDEZ SRL, 03=EMPRESA SERV. MULTIPLES D CLASE JA SRL, 04=RODRIGUEZ ARLEQUIN & ASOCIADOS SRL, 05=ABRESAN SOLUCIONES AUTOMOTRICES SRL | config |
| 8 | Screenshot 2026-05-20 095327.png | FINV102 — Control Mantenimiento de Sucursales (Puntos de Trabajo) | FINV102 | Configuración | No Cia, Punto, Descripción, Mes en Proceso, Año en Proceso, Activo; flags: Impuesto Parte del Costo, Usar Orden de Compra, Realizar Conteo Físico Usando Talonario | config |
| 9 | Screenshot 2026-05-20 095341.png | FINV112 — Mantenimiento Tipo de Documento | FINV112 | Configuración | Tipo Doc., Descripción, Tipo Transacción (dropdown), Tipo Mov. (dropdown), Cuenta, Centro Costo; tipos: DC, DV, EA, EP, SP, AS, AE, SA, TA, EC | config |
| 10 | Screenshot 2026-05-20 095354.png | FINV105 — Mantenimiento Grupo de Producto | FINV105 | Configuración | No Grupo, Descripción; grupos: CERRAJERIA, CONSTRUCCION, ELECTRICO, HERRAMIENTAS, LIMPIEZA, PINTURA, PLOMERIA, QUIMICOS, TORNILLO, CLAVOS, REPUESTO, SEGURIDAD | config |
| 11 | Screenshot 2026-05-20 095422.png | FINV104 — Mantenimiento de Almacenes | FINV104 | Configuración | Almacén, Descripción, Categoría (De Primera/De Segunda), Se Usará el (Costo Promedio/Fijo), Tipo Almacén, Vende, Ctrl Mín, Ctrl Máx, Activo; flag: Facturar Por Debajo del Costo | config |
| 12 | Screenshot 2026-05-20 095434.png | FINV103 — Mantenimiento Privilegios de Usuarios | FINV103 | Configuración (Acceso de Usuarios al Módulo) | No Cia, Punto de Trabajo, Usuario, Almacén; permisos: Generar Inventario, Digitar Dev. Vta., Digitar Rec. M, Asignar Prod. Almacén, Hacer Ajustes, Modificar Costo, Crear Productos, Cerrar Inventario, Cia. y Punto Por Defecto, Activo, Preparar Toma Física, Visualizar Costo; tabla tipos de documentos permitidos | config |
| 13 | Screenshot 2026-05-20 095509.png | FINV106 — Mantenimiento Línea de Productos | FINV106 | Configuración | Línea (código), Descripción; líneas: ACERO, ADAPTADORES PVC, AGREGADOS, ALAMBRES, ALICATES, ARANDELA, BARRENAS, BISAGRAS, BLOCKS, BOMBILLOS, BREAKERS, BROCHAS… | config |
| 14 | Screenshot 2026-05-20 095519.png | FINV107 — Mantenimiento Sub Línea de Productos | FINV107 | Configuración | Línea, Descripción Líneas, Sub Línea, Descripción Sub Líneas, % Comisión, % Margen de Beneficio | config |
| 15 | Screenshot 2026-05-20 095540.png | FINV108 — Mantenimiento de Grupo Contable | FINV108 | Configuración | Grupo Contable, Descripción, Inventario (cuenta), Ajuste Inventario (cuenta), Costo de Venta al Contado, Costo de Venta a Crédito, Ingreso de Venta al Contado, Ingreso de Venta a Crédito | config |
| 16 | Screenshot 2026-05-20 095549.png | FINV109 — Mantenimiento Unidad de Producto | FINV109 | Configuración | Cod. Unidad, Descripción; unidades: BEEPER, YARDA, FARDO, RESMA, MT2, CUBETA, MT, QUINTAL, PULG., KG, GARRAFON, P2… | config |
| 17 | Screenshot 2026-05-20 095600.png | FINV110 — Mantenimiento Referencia de Empaque | FINV110 | Configuración | Cod. Refe., Descripción; referencias de fracciones (1/20, 1/180, 1/186, 1/16, 1/9, 1/2.2, 1/198…) | config |
| 18 | Screenshot 2026-05-20 095608.png | FACF111 — Mantenimiento Marcas (módulo Activos Fijos) | FACF111 | Configuración (Marca de Producto/Activo) | Marca (código 4 letras), Descripción; marcas: ASHCROFT, CAMSCO, CRAFTSMAN, HIMEL, OMEGA, SCHNEIDER, STECK, SYLVANIA, TIMKEN, YOKOGAWA, EMC, T&J | config |
| 19 | Screenshot 2026-05-20 095621.png | FINV111 — Mantenimiento de Productos | FINV111 | Configuración (Productos) | No Produ, Cod. Anterior, Descripción, Especificaciones, Marca Producto, Grupo Producto, Línea, Sub Línea, Grupo Contable, Tiene Impuesto, Permite Descuento, Máximo Descuento, % MBB, Usa Serie, Simple, Activo, Editable, Controlar Exist. Serie, Fecha, Peso Uni. Mínima Lbs, Medida en Pulgadas, Cod. de Barra, Referencia Prod., Tipo Producto (Inventario/Servicio), Comisión, Clase (Local/Importado), Prove. Preferido, Usuario, Ultimo Costo US$, Ultimo Costo RD$, % Impuesto, Cuenta; detalle de empaques: Empaque, Unidad, Refer. Empaque, Cantidad, Por Defecto, Para Reporte, Fraccionar, Costo Emp. RD$ | form |
| 20 | Screenshot 2026-05-20 095632.png | FINV125 — Carga de Productos Desde Archivo Excel | FINV125 | Configuración (Crear Productos desde Excel) | Almacén, Tasa Us, Lista de Precio, Líneas(s) Título, Ruta Archivo, Ver Formato Hoja Excel, Cargar Datos; columnas: Referencia, Existe?, Descripción de Productos, Cod. De Barras, Grupo, Línea, Sub Línea, Grupo Conta., Unidad, Refe Emp., Cantidad x Empaque, Costo Unitario, Precio Unitario, %ITBIS, Tipo Producto, Clase Producto; Total Registros, No. Produ | form |
| 21 | Screenshot 2026-05-20 095643.png | FINV113 — Asignación de Productos a Compañía y Punto de Trabajo-Almacén | FINV113 | Configuración (Asignar Prod. A Cia. y Almacén) | Cia, Punto de Trab., Almacén; grilla: No Prod., Nombre Producto, Estante, Tramo, Costo, Asignar (checkbox); botón Seleccionar Todos | form |
| 22 | Screenshot 2026-05-20 095704.png | FINV119 — Activar/Desactivar Producto por Almacén | FINV119 | Configuración (Activar Desactivar Prod. Almacén) | No Cia, Punto, Sucursal; Almacén, Categoría Almacén, Fecha, Activo, Permite Desc., Toma Física, tipo (Inventario/Servicio), Itbis; No Producto, nombre; Datos Unidad Mínima: Cantidad Por Empaque, Existencia Inicial Año/Mes, Costo Inicial Año/Mes, Costo/Existencia Actual; Datos Empaque: Exist. En Porciones, Exist. Inicial Año/Mes, Costo Inicial Año/Mes, Costo/Exist. Actual; VALOR INVENTARIO | form |
| 23 | Screenshot 2026-05-20 095721.png | FINV114 — Mantenimiento Costo de Producto | FINV114 | Configuración (Modificar Costo) | No Cia, Punto, Almacén, No Producto, Observación, Fecha, No Documento; Modificar Costo En: radio (Solo Este Almacén / Todos Almacenes Punto / Todos Almacenes Empresa); Datos Unidad Mínima: Cant. Por Emp., Costo Anterior, Nuevo Costo, Existencia; Datos Empaque: Existencia, Costo Anterior, Nuevo Costo | form |
| 24 | Screenshot 2026-05-20 095736.png | FINV115 — Ensamblar Productos | FINV115 | Configuración (Ensamblar Productos) | No Cia, Sucursal, Almacén, Itbis; Prod. a Ensamblar, Emp., Cpe, Costo; grilla: Alm., No Prod. Emp., Nombre Producto, Cpe, Cantidad, Costo Empaque, Costo; totales: Nombre Almacén, Costo Producto Ensamblado, Costo Unidad, Cantidad de Renglones; botón Copiar Formula | form |
| 25 | Screenshot 2026-05-20 095745.png | FINV116 — Digitar Mínimo y Máximo de Productos por Almacén | FINV116 | Configuración (Digitar Mínimo y Máximo) | No Cia, Punto de Trab.; filtro: Productos Con Existencia, Menor que el Mínimo, Mayor que el Máximo, Todos; Almacén, Grupo, Línea, Sub Línea; grilla: No Prod., Nombre Producto, CPE, Exist. Actual, Exist. Mínima, Exist. Máxima; total Unidades Digitadas | form |
| 26 | Screenshot 2026-05-20 095814.png | FINV116 — Digitar Mínimo y Máximo (segunda vista, cargada) | FINV116 | Configuración (Digitar Mínimo y Máximo) | Igual que #25, pantalla después de seleccionar parámetros | form |
| 27 | Screenshot 2026-05-20 095836.png | FINV117 — Mantenimiento de Estantes y Tramos de Productos | FINV117 | Configuración (Modificar Tramo y Estante) | No Cia, Punto de Trab., Almacén; grilla: No Prod., Nombre Producto, Estante, Tramo | form |
| 28 | Screenshot 2026-05-20 095845.png | FINV118 — Digitar Envases Retornables a Productos | FINV118 | Configuración (Digitar Envases Retornables) | Producto (código + nombre), Código Prod. Huacal, Cantidad Por Huacal, Código Prod. Unidad | form |
| 29 | Screenshot 2026-05-20 095951.png | FINV202 — Entrada de Mercancía Con Ordenes de Compras | FINV202 | Procesos (Entrada de Compras) | No Cia, Punto, Tipo Docu (DV), Tipo Trans., Tasa, Itbis, No Docu; Fecha, Tipo Gasto, Forma Pago, Exento Itbis; Proveed, Tipo Doc., No. Loc.; Doc. Prov., NCF, Vence NCF, RNC, P. Pago, Fecha V.; Detalle, Afecta Presup., Dr/Cr, Mes y Año; % ITBIS RET., Alm., Orden Compra; grilla: Alm., No Orden, Línea, No Produ, Nombre Producto, Detalle, Cantidad, Costo, Total, Itbis; totales: Unids Digitadas, Monto Neto, % Desc., Total Bruto, Total Itbis, Total Neto; Valor Bienes, Valor Servicio, Total Bienes, Total Servicio, TBIS Retenido, Total ITBIS Retenido | form |
| 30 | Screenshot 2026-05-20 095959.png | FINV210 — Entrada de Mercancía (entrada general al almacén) | FINV210 | Procesos (Entrada Mercancía al Almacén) | No Cia, Punto, Tipo Docu, Tasa Us, Tipo Movi. (Entrada), Itbis; Fecha, No. Cliente; Tipo Transa. (Entrada Almacén); Componente, No. Depto., Cuenta Cr.; Conduce, No. Localidad; Detalle; Mes y Año; grilla: Alm., No Produ, Emp., Nombre Producto, Estante, Tramo, Cuenta Cr, Cantidad, Costo, Total, Itbis; totales: Unids Digitadas, Costo Actual Emp., Total Entrada; Costo Actual Unid, Linea, Centro Costo, Cant. Por Emp., Fraccionar, Costo Unidad, Controlar Exist. Serie, Total Dr y Cr, Detalle | form |
| 31 | Screenshot 2026-05-20 100010.png | FINV211 — Salida de Mercancía (salida general del almacén) | FINV211 | Procesos (Salida de Mercancía del Almacén) | No Cia, Punto, Tipo Docu, Tasa Us, Tipo Movi. (Entrada), Itbis; Fecha, Afectar Componente Dr/Cr; Componente, Depto., Afecta Presup. Dr/Cr, Cuenta Dr., Centro Costo; Conduce, No. Requisición; Detalle, No. Localidad; grilla: Alm., No Requi, Línea, No Produ, Emp., Nombre Producto, Cuenta Dr, Cantidad, Costo, Total, Itbis; totales: Unids Digitadas, Costo Actual Emp., Serie, Total Entrada; Costo Actual Unid, Exist. Unidad Mín., Centro Costo, Cant. Por Emp., Fraccionar, Exist. En Este Emp., Detalle, Total Dr y Cr; Exist Mínima, Exist. Máxima | form |
| 32 | Screenshot 2026-05-20 100035.png | FINV211 — Salida de Mercancía (segunda instancia abierta) | FINV211 | Procesos (Salida de Mercancía del Almacén) | Mismos campos que #31, segunda ventana simultánea | form |
| 33 | Screenshot 2026-05-20 100044.png | FINV203 — Transferencia de Mercancía Inter Cia.-Sucursales-Almacenes | FINV203 | Procesos (Transferencia de Mercancía) | No Cia, Sucursal Origen, Tipo Doc Salida, Tasa Us, No Docu; Fecha, No. Cliente, No. Cotización/Pedido; Tipo Doc. Entrada, Tipo Movi. (Entrada), Tipo Transa. (Entrada Almacén); Almacén Origen, Cia. Destino, Mes y Año Proc. S.O./S.D.; Sucursal Destino, Alm. Destino; Detalle, Desde Loc., Hasta Loc.; botón Transferir Almacén Completo; grilla: Alm., No Produ, Emp., Nombre Producto, Detalle, Cantidad, Costo, Total, Itbis; totales: Almacén, Cant. Reservada U., Total Bruto; Linea, Costo Unidad, Unids Digitadas, Permite Fraccion, Costo Actual; Exist. Unidades | form |
| 34 | Screenshot 2026-05-20 100056.png | FINV204 — Entrada Productos Ensamblados y/o Producción | FINV204 | Procesos (Entrada de Producción) | No Cia, Punto, Tipo Docu. Entrada, Tasa Us, No Docu; Fecha, Tipo Movimiento (Entrada), Tipo Transacción (Entrada Almacén), Itbis; Tipo Documento de Salida, Conduce, Mes y Año Proc.; No. Localidad; % Granulometría, Viscosidad, Muestreo Peso 1 y 2; Detalle; grilla: Línea, Alm., No Produ, Emp., Nombre Producto, Cantidad, Costo, Total, Itbis; totales: Almacén, Permite Fraccionar, Total Bruto; Cant. Por Emp., Costo Actual, Unids Digitadas, Costo Unidad | form |
| 35 | Screenshot 2026-05-20 100120.png | FINV204 — Entrada Productos Ensamblados y/o Producción (segunda vista) | FINV204 | Procesos (Entrada de Producción) | Mismos campos que #34 | form |
| 36 | Screenshot 2026-05-20 100155.png | FINV217 — Despacho Producción Por Cotización | FINV217 | Procesos (Despacho Cotización/Orden Producción) | Tipo Documento, Fecha, Tasa Us, No Docu; No. Cotización, Cliente; Proyecto, No. Localidad, Mes y Año; Detalle; Desplegar Las Lineas De La Cotización (checkbox); grilla: Lin. Cot., Alm., No Produ, Emp., Nombre Producto, Detalle, Cantidad Por Despachar, Cantidad a Despachar, Costo, Total, Itbis; totales: Almacén, Cantidad Cotizada, Total Bruto; Linea, Costo Unidad, Cantidad Despacha, Permite Fracción; Exist. Unidades, Cant. Por Emp., Existencia Empaque, Costo Actual, Autorizada | form |
| 37 | Screenshot 2026-05-20 100212.png | FINV213 — Salida de Productos Ensamblados/Reproceso | FINV213 | Procesos (Salida de Prod. Ensamblados / Reproceso) | No Cia, Punto, Tipo Docu. Salida, Tasa Us, No Docu; Fecha, Tipo Movimiento (Entrada), Tipo Transacción (Entrada Almacén), Itbis; Tipo Docu. de Entrada, Conduce; No. Localidad; Detalle, Mes y Año Proc.; grilla: Línea, Alm., No Produ, Emp., Nombre Producto, Cantidad, Costo, Total, Itbis; totales: Almacén, Permite Fraccionar, Total Bruto; Cant. Por Emp., Costo Actual, Tipo Costo, Unids Digitadas, Costo Unidad, Exist. Unidad Mín., Exist. En Este Emp. | form |
| 38 | Screenshot 2026-05-20 100224.png | FINV205 — Devolución Compra de Mercancía | FINV205 | Procesos (Devolución de Compra a Suplidores) | No Cia, Punto, Tipo Docu, Tasa Us, No Docu, Moneda; Fecha, Tipo Movi. (Entrada), Tipo Trans. (Entrada Almacén), Exento Itbis, Itbis; Proveed, No. Localidad; Doc. Afectar CxP, Saldo, Doc. Prov., NCF, Tipo Docu CxP; Detalle, Afecta Presupuesto Dr/Cr, Mes y Año; grilla: Alm., No Produ, Emp., Nombre Producto, Detalle, Cantidad, Costo, Total, Itbis; totales: Almacén, Fraccionar, Monto Neto, Total Bruto, Cr Inv.; Exist. Unids., Exist. Actual, Desc., Total Itbis, Cr Itbis; Cant. Por Emp., Costo Unidad, Itbis, Total Neto, Dr CxP; Unids Digitadas, Cant. Reservada U., % Impuesto, Total Dr y Cr; Valor Bienes, Valor Servicio, Total Bienes, Total Servicio; Producto Lleva Itbis | form |
| 39 | Screenshot 2026-05-20 100234.png | FINV201 — Devolución de Venta a Crédito/Contado | FINV201 | Procesos (Devolución de Ventas Desde Clientes) | No Cia, Punto, Tipo Docu (DV), Itbis, Tipo Trans. (Entrada Almacén); Fecha, Tasa Us, Código NCF; Vend., Docu. Devolución; Aplicar al Doc., Recibir del Doc., PV, Mes y Año Proc.; Detalle, No. Localidad; grilla: Alm., Línea, FT, No Produ, Emp., Nombre Producto, Cantidad, Precio, Total, Itbis; totales: Almacén, Serie, Ces, Línea, Ult. Fecha, Total Bruto; Cant. Por Emp., Cant. Vendida, Cant. Dev., Total Impuesto; Cant. Días, Unids Digitadas, Itbis, Ult. Doc., Total Neto | form |
| 40 | Screenshot 2026-05-20 100245.png | FINV214 — Reversar Documento | FINV214 | Procesos (Reversar Doc. de Movimiento Interno) | Mes y Año en Proceso; Punto de Trabajo, Tipo Docu, No. Documento, Tipo Movi. (Entrada), Entrada Almacén; Fecha Doc.; Reversar en Inv. con Tipo de Doc., Tipo Movi., Entrada Almacén; Fecha, Nuevo Documento; Motivo de la Reversión; botón Reversar | form |
| 41 | Screenshot 2026-05-20 100317.png | FINV206 — Impresión de Documentos | FINV206 | Procesos (Impresión de Documentos) | Mes y Año en Proceso, Sucursal, No. Localidad; radio Imprimir/Reimprimir; Imprimir Valores? (Si/No); Tipo Documento (AE=AJUSTE ENTRADA), Desde Documento, Hasta Documento; Tamaño Hoja; ícono impresora con referencia Rinv206/Rinv207 | form |
| 42 | Screenshot 2026-05-20 101047.png | FINV215 — Asignar Serie a Documentos de Entrada o Salida | FINV215 | Procesos (Digitar Series de Productos a Documento) | No Cia, Punto, No. Documento, Fecha, Tipo Movi. (Entrada), Tipo Transacción (Entrada Almacén); Cliente; Detalle; sección "PRODUCTOS QUE USAN SERIE EN EL DOCUMENTO DIGITADO": grilla Línea, Alm., No Produ., Emp., CPE, Nombre Producto, Cantidad, Cant. de Series, botón "Digitar Serie ==>"; totales: Controlar Exist. Serie, Total de Series, Cant. de Series Digitadas Renglón, Total Series Digitadas | form |
| 43 | Screenshot 2026-05-20 101328.png | FINV301 — Maestro de Inventario (reporte existencias) | FINV301 | Reportes (Existencia) | Mes y Año en Proceso; Punto de Trabajo, Almacén, Selección de Almacenes; Grupo Contable, Grupo Producto, Línea Producto, Sub Línea Producto, Marca; Producto Con Exist.?, Tipo Prod. (Inventario), Activos?; Tasa Us; Expresar Inventario en: Peso/Dólar; radio: Detallado (Rinv301), No Detallado (Rinv302), Histórico (Rinv307), Consolidado (Rinv310), Prod. Con Ubicación (Rinv317), Comparar Exist. Con Mínimo y Máximo (Rinv306), P. Con Serie (Rinv312); Reporte de Consumo (Rinv325); Productos Con Fecha de Ultima Entrada/Salida (Rinv328); íconos Excel e impresora | reporte |
| 44 | Screenshot 2026-05-20 101335.png | FINV302 — Movimientos de Productos/Productos Sin Ventas | FINV302 | Reportes (Movimiento de Productos) | Desea Reporte Movimientos de Prods.?; Almacén, Grupo Contable, Grupo Producto, Línea Producto, Sub Línea Producto, Código Producto, Lote; Desde Fecha, Hasta Fecha; Tipo Producto (Todos), Tipo Movimiento (Ambas); íconos impresora (Rinv304, Rinv314) | reporte |
| 45 | Screenshot 2026-05-20 101342.png | Rinv303 — Reporte Oracle Reports: Listado de Productos Ensamblados | Rinv303 | Reportes (Productos Ensamblados) | Pantalla de parámetros Oracle Reports: Almacén Prod. Compuesto, Producto Compuesto Si Desea, Almacén Prod. Componente, Productos que Tienen el Componente, Cantidad a Producir, Imprimir A (Screen) | reporte |
| 46 | Screenshot 2026-05-20 101352.png | Rinv305 — Reporte Oracle Reports: Maestro de Prod. Con su Empaque | Rinv305 | Reportes (Productos Con su Empaque) | Pantalla de parámetros Oracle Reports: No. Producto, Grupo Contable, Grupo Producto, Linea, Sub Linea, Tipo Producto (Todos), Imprimir A (Screen) | reporte |
| 47 | Screenshot 2026-05-20 101406.png | Rinv311 — Reporte Oracle Reports: Reporte de Líneas y Sub-Líneas | Rinv311 | Reportes (Listado de Líneas y Sublíneas) | Pantalla de parámetros Oracle Reports: Línea Inicial, Línea Final, Detalle Sub-Línea (SI/NO), Imprimir a (Preview) | reporte |
| 48 | Screenshot 2026-05-20 101429.png | Rinv_etiqueta_grde — Reporte Oracle Reports: Impresión de Etiquetas (grande) | Rinv_etiqueta_grde | Reportes (Imprimir Etiquetas Intermec) | Pantalla de parámetros Oracle Reports: No. cia, Sucursal, Copias | reporte |
| 49 | Screenshot 2026-05-20 101440.png | Rinv_Monarch9416 — Reporte Oracle Reports: Impresión Etiquetas Monarch 9416 | Rinv_Monarch9416 | Reportes (Imprimir Etiquetas Monarch 9416) | Pantalla de parámetros Oracle Reports: No. Almacen, Con Existencia? (Si/No), Desde Producto, Hasta Producto, Copias | reporte |
| 50 | Screenshot 2026-05-20 101450.png | Rinv315 — Reporte Oracle Reports: Reporte de Devoluciones por Vendedor | Rinv315 | Reportes (Devoluciones de Ventas por Vendedor) | Pantalla de parámetros Oracle Reports: Vendedor Inicial, Vendedor Final, Fecha Inicial, Fecha Final, Desea Resumen (Si/No), Imprimir a (Preview) | reporte |
| 51 | Screenshot 2026-05-20 101500.png | FINV303 — Auxiliar de Inventario | FINV303 | Reportes (Auxiliar de Inventario) | Mes y Año Proceso; Almacén, Grupo Producto, Línea Producto, Sub Línea Producto, Código Producto; Desde Fecha, Hasta Fecha; ícono Excel | reporte |
| 52 | Screenshot 2026-05-20 101521.png | FINV304 — Reporte de Consumo por Proyectos/Componentes | FINV304 | Reportes (Consumo Por Proyecto) | No Cia, Punto; Selección de Almacenes, Selección de Sublinea; Mes y Año en Proceso; No. Localidad, Tipo Proyecto, No. Proyecto, No. Componente, Producto; Deseas (Ambas); Fecha Inicial, Fecha Final; Tipo Reporte (Por Proyecto/Componente); radio: Resumido Por Proyecto / Resumido Por Producto / Detallado; ícono impresora Rinv319/Rinv327 | reporte |
| 53 | Screenshot 2026-05-20 101531.png | FINV305 — Impresión de Etiquetas Y Códigos de Barras (masivo por almacén) | FINV305 | Reportes (Etiquetas y Códigos de Barras Por línea-SubL) | Mes y Año en Proceso; Punto de Trabajo, Almacén; Grupo Contable, Grupo Producto, Línea Producto, Sub Línea Producto, Marca; Producto Con Exist.?, Tipo Prod., Activos?; Lista de Precio; Desde Producto, Hasta Producto; Imprimir el: radio Cód. de Barra / No Produ / Etiqueta Góndola; ícono impresora | reporte |
| 54 | Screenshot 2026-05-20 101540.png | FINV306 — Impresión de Códigos de Barras y Etiquetas por Documento | FINV306 | Reportes (Códigos de Barra por Documentos) | Tipo Impresión (Código Ean13 Peq.), Documento de: radio Facturación/Inventario, No. Docu, Fecha; Cliente; Imprimir el: radio Código de Barra / No Produ; grilla: No Produ, Nombre Producto, Código de Barra, Lista Precio, Cantidad; Precio, Cant. de Códigos; ícono impresora | form |
| 55 | Screenshot 2026-05-20 101551.png | FINV307 — Impresión de Etiquetas (formato manual/individual) | FINV307 | Reportes (Imprimir Etiquetas) | grilla: No Produ, Nombre Producto, Unidad, Peso, Fecha Fab., Bach, Cantidad; Cant. de Etiquetas; ícono impresora | form |
| 56 | Screenshot 2026-05-20 101559.png | Rinv324 — Reporte Oracle Reports: Reporte de Productos Reservados | Rinv324 | Reportes (Cantidad Reservada) | Pantalla de parámetros Oracle Reports: Almacén (Todos), Producto, Resumen (Si/No), Imprimir A (Screen) | reporte |
| 57 | Screenshot 2026-05-20 101629.png | Menú Conteo Físico desplegado (segunda visualización) | Fmenu_inv | Conteo Físico | Reportes Para Conteo Físico / Cancelar CF, Cargar Conteo Físico Desde Excel, Entrada/Mantenimiento Conteo Físico Manual, Reportes Comparativo Físico vs Teórico, Ajuste de Inventario por Conteo Físico, Consulta Histórico de Conteo Físico | menú |
| 58 | Screenshot 2026-05-20 101638.png | FINV708 — Reportes Para Conteo Físico y Cancelación de Conteo Físico | FINV708 | Conteo Físico (Reportes Para Conteo Físico / Cancelar CF) | Almacén, Grupo Contable, Grupo, Línea, Sublinea, Código Producto, Tipo Producto (Inventario), Prods. Con Existencia? (Si/No); botones: Cancelar Conteo Físico, Excel, Impresora (Rinv701/Rinv708) | reporte |
| 59 | Screenshot 2026-05-20 101647.png | FINV709 — Cargar Conteo Físico desde Excel | FINV709 | Conteo Físico (Cargar Conteo Físico Desde Excel) | Líneas(s) Título, Ruta Archivo, Cargar Datos, Ver Formato Hoja Excel; grilla: Contador, Alm., No Prod., Nombre Producto, Ubicación, Emp., Existencia En Libro, Conteo Físico Emp. Mayor / Unidades / Diferencia; totales: Fecha, Cant. Por Emp., Exist. de Unids Libro, Exist. de Unids Físico, Difer. en Unids, Total Cantidad CF | form |
| 60 | Screenshot 2026-05-20 101657.png | FINV707 — Entrada de Conteo Físico (manual) | FINV707 | Conteo Físico (Entrada/Mantenimiento Conteo Físico Manual) | Almacén, No. Produ, Contador, Prod.; grilla: Contador, No Prod., Nombre Producto, Ubicación, Emp., Existencia En Libro, Conteo Físico Emp. Mayor / Unidades / Diferencia; totales: Fecha, CPE, Emp. PF, Emp Uni. PF, Exist. de Unids Libro, Exist. de Unids Físico, Difer. en Unids; ícono TV (cámara/lectura de barras) | form |
| 61 | Screenshot 2026-05-20 101709.png | FINV702 — Reportes Comparativo Físico vs Teórico | FINV702 | Conteo Físico (Reportes Comparativo Físico vs Teórico) | Almacén, Grupo Contable, Grupo, Línea, Sublinea, Código Producto, Tipo Producto (Inventario); Prods. Inventariados?, Más de Una vez?; Que Reporte Desea: radio Comparativo Por Código (Rinv702) / Comparativo Alfabético (Rinv706) / Comparativo Resumido Excel; Resumen?; Desea Productos (Con Diferencia); Contador; íconos impresora y Excel | reporte |
| 62 | Screenshot 2026-05-20 101718.png | FINV705 — Ajuste Conteo Físico vs Existencia en Libro | FINV705 | Conteo Físico (Ajuste de Inventario por Conteo Físico) | Mes y Año en Proceso; Tasa US; No. Localidad, Almacén, No. Producto; Fecha; botón (ejecutar ajuste) | form |
| 63 | Screenshot 2026-05-20 101727.png | FINV710 — Consulta Histórico de Conteo Físico (vacío) | FINV710 | Conteo Físico (Consulta Histórico de Conteo Físico) | Almacén, No. Produ, Contador; Desc. Prod., Fecha Ajuste, Ajustado Por, Fecha Conteo; íconos Excel y TV; grilla: Contador, Alm., No Prod., Nombre Producto, Ubicación, Emp., Existencia En Libro, Conteo Físico Emp. Mayor / Unidades / Diferencia; totales: Ajustado Por, Fecha Ajuste, Exist. de Unids Libro; Digitado Por, Fecha Digit., CPE, Exist. de Unids Físico, Difer. en Unids | consulta |
| 64 | Screenshot 2026-05-20 101736.png | FINV710 — Consulta Histórico de Conteo Físico (con datos) | FINV710 | Conteo Físico (Consulta Histórico de Conteo Físico) | Almacén 01 ALMACEN PRINCIPAL; datos de "CARGA INICIAL": productos 00000001 (CEMENTO GRIS ARGOS), 00000020 (CLAVO ACERO 2" CAJA 1/50), etc.; Ajustado Por AALBURQUERQUE, Fecha Ajuste 10/03/2021, Digitado Por AALBURQUERQUE, Fecha Digit. 10/03/2021; columnas: Exist. En Libro (.00), Conteo Físico Emp. Mayor (.00), Unidades (10.00), Diferencia (-10.00) | consulta |
| 65 | Screenshot 2026-05-20 101753.png | FINV401 — Impresión de Entrada de Diario | FINV401 | Cierre (Entrada de Diario) | Mes y Año en Proceso; Punto de Trabajo (01 SUCURSAL PRINCIPAL); Fecha; radio: Soporte Entrada de Diario Detallado / Entrada de Diario; botón Imprimir | reporte |
| 66 | Screenshot 2026-05-20 101800.png | FINV402 — Generar Asiento al Mayor | FINV402 | Cierre (Generar Asiento a contabilidad) | Mes y Año en Proceso; Mes y Año Contabilidad; Cierre del Período Fiscal (No); Punto de Trabajo (01 SUCURSAL PRINCIPAL); Fecha; botón Generar | form |
| 67 | Screenshot 2026-05-20 101806.png | FINV403 — Cierre Mensual | FINV403 | Cierre (Cierre Mensual) | Mes y Año en Proceso (05 2026); Punto de Trabajo (01 SUCURSAL PRINCIPAL); Fecha (31/05/2026); botón OK | form |

### Notas de la sesión de capturas

- La navegación cubre el menú completo: Configuración (19 opciones), Procesos (16 opciones), Consultas (4 opciones), Reportes (14 opciones), Conteo Físico (6 opciones), Cierre (3 opciones).
- **Discrepancias FMX reales vs. inferidos en doc anterior:** Los números de FMX reales observados difieren de los asignados inicialmente. Por ejemplo:
  - Mantenimiento de Compañías = **FINV101** (correcto)
  - Control Mantenimiento Sucursales = **FINV102** (en doc era Líneas de Producto)
  - Mantenimiento Tipo de Documento = **FINV112** (aparece como config, no como transacción)
  - Mantenimiento Grupo de Producto = **FINV105** (en doc era unidades de medida)
  - Mantenimiento de Almacenes = **FINV104** (correcto)
  - Mantenimiento Privilegios Usuarios = **FINV103** (en doc era sublíneas)
  - Mantenimiento Línea de Productos = **FINV106** (en doc era empaques)
  - Mantenimiento Sub Línea = **FINV107** (en doc era colores)
  - Mantenimiento Grupo Contable = **FINV108** (en doc era modelos)
  - Mantenimiento Unidad = **FINV109** (en doc era almacenes)
  - Mantenimiento Referencia Empaque = **FINV110** (en doc era puntos almacenamiento)
  - Mantenimiento de Productos = **FINV111** (en doc era parámetros almacén empresa)
  - Asignación Producto-Almacén (Asignar Prod. A Cia.) = **FINV113** (en doc era asignación)
  - Activar/Desactivar Prod. Almacén = **FINV119** (en doc era parámetros de reorden)
  - Modificar Costo = **FINV114** (correcto)
  - Ensamblar Productos = **FINV115** (en doc era lista de precios)
  - Digitar Mínimo y Máximo = **FINV116** (en doc era historial de costos)
  - Mantenimiento Estantes y Tramos = **FINV117** (en doc era equivalencias)
  - Digitar Envases Retornables = **FINV118** (en doc era kits)
  - Carga desde Excel = **FINV125** (en doc era consulta/impresión de códigos de barras)
  - Entrada de Compras = **FINV202** (en doc era entrada por devolución cliente)
  - Entrada General Almacén = **FINV210** (en doc era ajuste positivo)
  - Salida General Almacén = **FINV211** (en doc era ajuste negativo)
  - Transferencia = **FINV203** (en doc era entrada por transferencia recibida)
  - Entrada Producción = **FINV204** (correcto)
  - Despacho Cotización = **FINV217** (en doc era reverso de transacción)
  - Salida Ensamblados/Reproceso = **FINV213** (en doc era ajuste por diferencia de toma física)
  - Devolución Compra = **FINV205** (en doc era salida por ventas)
  - Devolución de Venta = **FINV201** (en doc era entrada de mercancía)
  - Reversar Documento = **FINV214** (en doc era reclasificación)
  - Impresión de Documentos = **FINV206** (en doc era salida por devolución a proveedor)
  - Asignar Serie = **FINV215** (en doc era corrección de transacción)
  - Maestro de Inventario (parámetros) = **FINV301** (en doc era generar planilla toma física)
  - Movimientos de Productos = **FINV302** (en doc era imprimir planilla)
  - Auxiliar de Inventario = **FINV303** (en doc era configuración toma física)
  - Consumo por Proyectos = **FINV304** (en doc era congelar existencias)
  - Impresión Etiquetas+Barras (masivo) = **FINV305** (en doc era primer conteo)
  - Impresión Barras por Documento = **FINV306** (en doc era segundo conteo)
  - Impresión Etiquetas (individual) = **FINV307** (en doc era aprobar diferencias)
  - Reportes Conteo Físico = **FINV708**
  - Cargar CF desde Excel = **FINV709**
  - Entrada CF Manual = **FINV707**
  - Comparativo Físico vs Teórico = **FINV702**
  - Ajuste CF vs Libro = **FINV705**
  - Consulta Histórico CF = **FINV710**
  - Impresión Entrada de Diario = **FINV401** (en doc era transferencia entre almacenes)
  - Generar Asiento al Mayor = **FINV402** (en doc era recepción de transferencia)
  - Cierre Mensual = **FINV403** (en doc era consulta de transferencias)
- **El menú Consultas** tiene 4 opciones: Consulta de Documentos, Existencia de Producto, Existencia de Prod. En grupo, Costo de Producto en Rango de Fecha — ninguna fue abierta en esta sesión.
- **Módulo Activos Fijos (FACF111):** La opción "Marca de Producto/Activo" del menú Configuración abre un form del módulo de Activos Fijos (FACF111), no del módulo INV. Esto confirma que el catálogo de marcas es compartido entre módulos.
