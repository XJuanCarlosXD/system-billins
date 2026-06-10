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
