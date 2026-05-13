# Plan Maestro de Módulos — Sistema de Facturación

Fecha de análisis: 2026-05-07  
Basado en Oracle 11g (10.0.0.51:1521/AB), 5 empresas activas (01-05).

---

## Resumen de arquitectura

Cada módulo sigue el mismo patrón:
- **TXXX_USUARIO** — acceso del usuario con flags S/N (permiso por acción)
- **TXXX_USUARIOD** — documentos permitidos al usuario
- **TXXX_TDOCU** — catálogo de tipos de documento del módulo
- **TXXX_DCDOCU** — pre-asiento contable (se genera al crear documentos)
- **ST_GENERADO_CNT** — flag en el encabezado del documento: S=ya se generó asiento CNT
- CNT.TCNT_ASIENTO/TCNT_ASIENTOL reciben los asientos de todos los módulos

---

## FAT — Facturación

### Tablas principales
- TFAT_FACTURA / TFAT_FACTURAL — encabezado y líneas de factura
- TFAT_CONDUCE / TFAT_CONDUCEL — conduces
- TFAT_DEVOLUCION / TFAT_DEVOLUCIONL — devoluciones
- TFAT_ORDEN_PEDIDO / TFAT_ORDEN_PEDIDOL — órdenes de pedido
- TFAT_CLIENTES — clientes del módulo
- TFAT_CUADRE_CAJA / TFAT_CAJA / TFAT_CAJERO — cuadre y caja
- TFAT_COMISION / TFAT_COMISION_EMP — comisiones
- TFAT_CERTIFICACION / TFAT_CERTIFICACIONL — certificaciones 607
- TFAT_CONDICION_PAGO — plazos de pago
- TFAT_TIPO_PAGO / TFAT_FORMA_PAGO — formas de pago
- TFAT_LISTA_PRECIO / TFAT_LISTA_PRECIO_GRUPO — listas de precio
- TFAT_OFERTA / TFAT_OFERTA2 — ofertas
- TFAT_TDOCU — tipos de documento: AF, CO, CT, FC, FT
- TFAT_PUNTO / TFAT_CIAS — configuración de puntos y empresas

### Columnas TFAT_FACTURA (header)
NO_CIA, PUNTO, TIPO_FACTURA, NO_FACTURA, NO_CLIENTE, FECHA, VENDEDOR, AFECTA_CXC,
TASA_US, PORC_IMPUESTO, DESCUENTO, IMPUESTO, TOTAL_LINEA, TOTAL_NETO, ESTADO,
USUARIO, NO_FORMULARIO, NO_PEDIDO, ST_GENERADO_CNT, ST_IMPRESION, ST_ANULADO,
TIPO_TRANSACCION, PLACA, NO_REPORTE, TIPO_SC, PLAZO_PAGO, PORC_PRONTO_PAGO,
RUTA, DETALLE, NOTA, TIPO_PEDIDO, NO_CUADRE, NCF, CODIGO_NCF, TIPO_NCF_FISCAL,
VALOR_RECIBIDO, VALOR_DEVUELTO, PROPINA, CAJERO, FECHA_VENTA, ITBIS_RETENIDO,
ISR_RETENIDO, ISC, OTROS_IMPUESTOS

### Columnas TFAT_FACTURAL (líneas)
NO_CIA, PUNTO, TIPO_FACTURA, NO_FACTURA, NO_LINEA, ALMACEN, NO_PRODU, CANTIDAD,
PRECIO, COSTO, PORC_DESCUENTO, DESCUENTO, IMPUESTO, MONTO_NETO, EMPAQUE, CPE,
CANTIDAD_PORCIONES, NO_LOTE, CANTIDAD_REGALIA, PRECIO_DE_LISTA, DESCRIPCION

### Flags de usuario (TFAT_USUARIO)
PERMITE_FACTURAR, GENERAR_ESTADISTICAS, VARIAR_TIPO_PRECIO, VARIAR_PORC_DESCUENTO,
VARIAR_PRECIO, VARIAR_VENDEDOR, VARIAR_PLAZO_PAGO, IMPRIMIR_DOCU, REIMPRIMIR_DOCU,
AUTORIZAR_PEDIDO, ANULAR_PEDIDO, ASIGNAR_OFERTA, INTEGRAR_DOCU, DIGITAR_DEVOLUCION,
ENSAMBLAR_PRODUCTO, ENVIAR_FACTURA, HACER_CUADRE_CAJA, CREAR_CONTROL_FACTURA,
MODIFICAR_CONDUCE_USUARIO

### Extra (no flags): TIPO_PRECIO, ALMACEN, CAJERO, NO_CLIENTE

### Tipos de documento (TFAT_TDOCU)
- AF — Anulación Factura (tipo_transaccion: A)
- CO — Conduce (tipo_transaccion: C)
- CT — Cotización (tipo_transaccion: C)
- FC — Factura a Crédito (NCF: FC-001, tipo_transaccion: F)
- FT — Factura Contado (NCF: FT-001, tipo_transaccion: O)

### Menú FAT
- **Facturas**: Crear Factura, Lista Facturas, Conduces, Devoluciones, Cotizaciones, Órdenes de Pedido
- **Caja**: Cuadre de Caja, Cajas Asignadas, Cajeros
- **Reportes**: Ventas por Período, Ventas por Vendedor, Ventas por Producto, Reporte 607, Certificaciones
- **Mantenimiento**: Clientes, Vendedores, Listas de Precio, Condición de Pago, Tipos de Pago, Cajeros, Almacenes, Ofertas
- **Utilerías**: Cierre, Configuración de Punto, NCF

---

## CXC — Cuentas por Cobrar

### Tablas principales
- TCXC_CLIENTE / TCXC_CLIENTEH — clientes (con historial)
- TCXC_DOCUMENTO — documentos de cobro
- TCXC_DCDOCU — pre-asiento contable
- TCXC_CUOTAS / TCXC_CUOTAS_REFE — cuotas
- TCXC_REFEDOCU — referencias entre documentos
- TCXC_COMI_COBROS / TCXC_VENDEDOR_COMI — comisiones
- TCXC_RUTA / TCXC_ARUTA / TCXC_GRUTA — rutas
- TCXC_ZONA — zonas
- TCXC_VENDEDOR — vendedores
- TCXC_FINANCIAMIENTO / TCXC_TIPO_FINANCIAMIENTO — financiamientos
- TCXC_TDOCU — tipos doc: AC, AD, AF, BC, BI, CD, DV, FC, NC, ND, RI
- TCXC_CTRLDOCU / TCXC_CIERRE — control y cierre

### Flags de usuario (TCXC_USUARIO)
VARIAR_TIPO_DOCU, VARIAR_LIMITE_CREDITO, HACER_TRANSACCIONES, GENERAR_LISTADO_CXC,
CREAR_CLIENTES, ASIGNAR_CLIENTE_RUTA, ASIGNAR_NCF, TRABAJAR_COMISION,
MODIFICAR_VENDEDOR, CREAR_TIPO_FINANCIAMIENTO, CREAR_FINANCIAMIENTO,
EXONERAR_MORA, IMPRIMIR_FINANCIAMIENTO, ANULAR_FINANCIAMIENTO, LIBERAR_CREDITO

### Menú CXC
- **Clientes**: Lista Clientes, Estado de Cuenta, Historial
- **Cobros**: Crear Documento, Lista Documentos, Recibos de Ingreso
- **Crédito**: Cuotas, Financiamientos, Liberar Crédito
- **Comisiones**: Por Vendedor, Por Período
- **Reportes**: Antigüedad de Saldos, Movimientos, Cobros del Día
- **Mantenimiento**: Rutas, Zonas, Vendedores, Supervisores, Tipos de Financiamiento
- **Utilerías**: Cierre, Asignación NCF

---

## CXP — Cuentas por Pagar

### Tablas principales
- TCXP_TPROVEEDOR / TCXP_BPROVEEDOR / TCXP_DPROVEEDOR — proveedores
- TCXP_DOCUMENTO — documentos de pago
- TCXP_DCDOCU — pre-asiento contable
- TCXP_CUOTAS — cuotas
- TCXP_REFEDOCU — referencias
- TCXP_SOLICITUD — solicitudes de pago
- TCXP_TDOCU — tipos doc: BI, FT, BD
- TCXP_CIERRE — cierre
- TCXP_FORMA_PAGO_DGII / TCXP_TIPO_RETENCION_DGII — datos fiscales

### Flags de usuario (TCXP_USUARIO)
HACER_TRANSACCIONES, GENERAR_LISTADO_CXP, CREAR_PROVEEDOR, HACER_CIERRE,
ASIGNAR_PROVEEDOR, ASIGNAR_CUENTA_BANCARIA, LIBERAR_DEBITO, BLOQUEAR_PAGO

### Menú CXP
- **Proveedores**: Lista, Estado de Cuenta
- **Documentos**: Crear, Lista, Solicitudes de Pago
- **Cuotas**: Pendientes, Historial
- **Reportes**: Reporte 606, Antigüedad de Saldos, Retenciones
- **Utilerías**: Cierre

---

## INV — Inventario

### Tablas principales
- TINV_PRODUCTO — catálogo de productos
- TINV_ALMACEN — almacenes
- TINV_TRANSACCIONES — transacciones
- TINV_MOVIMIENTO / TINV_MOVITMP — movimientos
- TINV_EXIST_ACTUAL — existencia actual
- TINV_CONTEO_FISICO / TINV_CONTEO — toma física
- TINV_EPRODUCTO / TINV_ESERIAL — existencia y seriales
- TINV_LINEA / TINV_SUB_LINEA / TINV_GRUPO_PRODU — clasificación
- TINV_UNIDAD / TINV_EMPAQUE / TINV_COLOR / TINV_MODELO — atributos
- TINV_TDOCU — tipos doc: DC, DV, EA
- TINV_CIERRE — cierre

### Flags de usuario (TINV_USUARIO)
DIGITAR_ENTRADA, DIGITAR_DV, HACER_AJUSTES, GENERAR_INV, CERRAR_INV,
CREAR_PRODU, MODIFICAR_COSTO, ASIGNAR_PRODU_ALMACEN, ALMACEN, VER_COSTO,
PREPARAR_TOMA_FISICA

### Menú INV
- **Productos**: Catálogo, Existencia por Almacén, Código de Barras
- **Transacciones**: Entrada, Salida, Devolución, Ajuste
- **Toma Física**: Preparar, Ingresar Conteo, Cerrar
- **Reportes**: Existencia, Movimientos, Kardex, Valorización
- **Mantenimiento**: Almacenes, Líneas, Sublineas, Grupos, Unidades, Empaques, Colores
- **Utilerías**: Cierre

---

## CHC — Bancos / Cheques

### Tablas principales
- TCHC_BCUENTA — cuentas bancarias
- TCHC_COMPROBANTE — comprobantes
- TCHC_CHEQUE / TCHC_DCCHEQUE — cheques y detalle
- TCHC_DCPAGO / TCHC_DCPAGO_CXP — pagos
- TCHC_OTROSDOCU — otros documentos
- TCHC_CONCILIACION_TMP / TCHC_CIERRE_CONCILIACION — conciliación
- TCHC_PAGO_ELECTRONICO — pagos electrónicos
- TCHC_BANCO / TCHC_BANCOS_AFILIADOS — catálogo bancos
- TCHC_TDOCU — tipos doc: CB, SO, NC
- TCHC_CIERRE — cierre

### Flags de usuario (TCHC_USUARIO)
CREAR_CUENTA, ASIGNAR_CUENTA, AFECTAR_CXP, ANULAR_COMPROBANTE_INGRESO

### Menú CHC
- **Cuentas**: Lista de Cuentas Bancarias, Saldo
- **Documentos**: Comprobantes, Cheques, Pagos Electrónicos
- **Conciliación**: Importar Estado de Cuenta, Conciliar, Cerrar
- **Reportes**: Movimientos por Cuenta, Cheques Pendientes
- **Utilerías**: Cierre

---

## ODC — Órdenes de Compra

### Tablas principales
- TODC_ORDEN / TODC_ORDENL — órdenes de compra y líneas
- TODC_REQUISICION / TODC_REQUISICIONL — requisiciones y líneas
- TODC_CIAS / TODC_PUNTO — configuración

### Flags de usuario (TODC_USUARIO)
CREAR_ODC_INV, CREAR_ODC_SUMINISTRO, GENERAR_REP_ODC, IMPRIMIR_ODC,
REIMPRIMIR_ODC, ANULAR_ODC, CREAR_REQUISICION, ANULAR_REQUISICION,
CERRAR_REQUISICION, AUTORIZAR_REQUISICION, CERRAR_ORDEN
Extra: AUTORIZACION_1, AUTORIZACION_2, AUTORIZACION_3, MONTO_MINIMO, MONTO_MAXIMO

### Menú ODC
- **Órdenes de Compra**: Lista, Crear, Aprobar
- **Requisiciones**: Lista, Crear, Autorizar (niveles 1/2/3)
- **Reportes**: Por Proveedor, Por Estado

---

## SDN — Nómina

### Tablas principales
- TSDN_EMPLEADO — empleados
- TSDN_NOMINA / TSDN_NOMINAH / TSDN_DCNOMINA — nóminas
- TSDN_PUESTO / TSDN_DEPTO / TSDN_GERENCIA — organigrama
- TSDN_HORARIO / TSDN_HORARIOL / TSDN_HORARIOH — horarios
- TSDN_VACACIONES / TSDN_VACACIONESH — vacaciones
- TSDN_ACCIONES / TSDN_TIPO_ACCIONES — actas de personal
- TSDN_LISTA_SERVICIO — listas de servicio (seguridad)
- TSDN_INGRESOS / TSDN_DEDUCCIONES — tipos de ingreso/deducción
- TSDN_AFP / TSDN_ARS — AFP y seguros médicos
- TSDN_ESCALA_ISR — escala ISR
- TSDN_CALCULO_INGRESOS / TSDN_CALCULO_DEDUCCIONES / TSDN_CALCULO_REGALIA — cálculos

### Flags de usuario (TSDN_USUARIO)
CREAR_NOMINA, CREAR_PUESTO, CREAR_EMPLEADO, TRASLADAR_EMPLEADO,
CREAR_LISTA_SERVICIOS, CREAR_PUESTO_SERVICIOS, COPIAR_LISTA_SERVICIOS,
MODIFICAR_LS, CREAR_PLANTILLA_HORARIO, CONSULTAR_PLANTILLA_HORARIO

### Menú SDN
- **Empleados**: Lista, Detalle, Historial Salarial, Dependientes
- **Nómina**: Crear, Procesar, Imprimir, Historial
- **Actas de Personal**: Crear, Lista
- **Horarios**: Asignar, Plantillas
- **Vacaciones**: Ingresar, Historial
- **Reportes**: TSS, Banco, 606, Regalía Pascual
- **Mantenimiento**: Puestos, Departamentos, Gerencias, AFP, ARS, Servicios (seguridad)

---

## CNT — Contabilidad

### Tablas principales
- TCNT_CATALOGO — catálogo de cuentas (global, sin no_cia)
  - CUENTA, NOMBRE, TIPO, CLASE, ACEPTA_MOVI, MONEDA, ACTIVA, ESTADO_FINANCIERO, CUENTA_GOB
- TCNT_ASIENTO — asientos contables
  - NO_CIA, PUNTO, ANO, MES, NO_ASIENTO, FECHA, AUTORIZADO, ACTUALIZADO, AUXILIAR, DEBITOS, CREDITOS, TASA_US, ST_ANULADO, DETALLE
- TCNT_ASIENTOL — líneas de asiento
  - NO_CIA, PUNTO, ANO, MES, NO_ASIENTO, NO_LINEA, CUENTA, CENTRO_COSTO, TIPO_MOVI(D/C), AUXILIAR, MONTO, MONTO_US
- TCNT_PERIODO_FISCAL — períodos fiscales
  - MES_INICIAL, MES_FINAL, DESCRIPCION, ACTIVO
- TCNT_NCF — secuencias NCF contabilidad
  - CODIGO_NCF, DESCRIPCION, NCF_INICIAL, NCF_FINAL, PROX_NCF, NCF_MANUAL, TIPO_NCF_FISCAL, CANT_MIN_NCF, FECHA_VENCIMIENTO
- TCNT_CENTRO_COSTO / TCNT_BCENTRO_COSTO — centros de costo
- TCNT_CUENTAS_EF / TCNT_ENCABEZADO_EF / TCNT_LINEAS_EF — estados financieros
- TCNT_PRESUPUESTO / TCNT_PRESUPUESTO_C / TCNT_PRESUPUESTO_DEPTO — presupuesto
- TCNT_MOVIMIENTO — movimientos acumulados
- TCNT_AUXILIAR — auxiliares
- TCNT_CIERRE — cierre

### Flags de usuario (TCNT_USUARIO)
CREAR_CUENTA, DIGITAR_ASIENTO, APROBAR_ASIENTO, ACTUALIZAR_ASIENTO,
DIGITAR_ASIENTO_MA, APROBAR_ASIENTO_MA, ACTUALIZAR_ASIENTO_MA,
GENERAR_ESTADOS, HACER_CIERRE, GENERAR_BALANCE, IMPRIMIR_MAYOR,
CONSULTAR_BALANCE, ADMINISTRAR_NCF

### Menú CNT real

La shell del módulo debe conservar las capacidades propias de CNT, pero el área
de trabajo debe ir a ancho completo, sin `max-w`, y usando solo componentes de
la plantilla. La UI puede simplificar la navegación siempre que mantenga el
comportamiento del legado. Las opciones globales del sistema no entran en este
plan CNT simplificado.

Plan CNT detallado y rutas de validación:
`backend/docs/31_cnt_plan_detallado.md`

- **Configuración**: Compañías, Puntos de Trabajo o Sucursales, Acceso de Usuarios al Módulo, Tipo de Cuenta, Cuentas del Catálogo, Asignar Cuenta a Sucursal, Grupo Contable Sucursal, Catálogo Centro de Costos, Asignar Centros de Costos a Cuentas, Tipo de Proyectos, Proyectos, Componentes de Proyectos, Localidades, Mantenimiento NCF, Desbloquear Usuario.
- **Procesos**: Entrada de Diario, Rep. Verificación de Asientos, Autorizar Asientos, Actualizar Asientos, Procesos Meses Anteriores (Apertura / Reverso / Cierre), Presupuesto (Inicial / Ajustes / Ejecución), Modificar ED de Nómina, Generar Entrada de Nómina, Transacciones en US (Consulta / Registro / Ajuste).
- **Consultas**: Consulta de Asiento, Consulta Movimientos de Cuentas.
- **Reportes**: Catálogo de Cuentas Corporativo, Catálogo de Cuentas por Sucursal, Catálogo Centros de Costos, Listado de Cuentas con Centros de Costos, Catálogo de Proyectos, Balance de Comprobación / Balance Situación, Mayor General, Balance de Comprobación / Bal. de Situación Hist., Estados Financieros / Anexos / Presupuesto (Balance General, Estado de Resultados, Anexos), Gastos por Proyecto/Componente, Histórico de Transacciones, Histórico de Asientos, Estados Financieros en Líneas (Preliminares).
- **Cierres**: Cierre Mensual, Cierre Anual.

### Pantallas CNT ya reutilizables

- `catalogo.tsx` — catálogo de cuentas.
- `asientos.tsx` — lista, detalle, aprobar, actualizar y anular asientos.
- `balance.tsx` — balance de comprobación.
- `mayor.tsx` — mayor por cuenta.
- `ncf.tsx` — mantenimiento NCF.
- `periodos.tsx` — períodos fiscales y cierres.
- `centros-costo.tsx` — catálogo de centros de costo.

### Mejora UI obligatoria

- Usar solo componentes de la plantilla: `Card`, `Button`, `Badge`, `Table`, `Dialog`, `DropdownMenu`, `Tabs`, `Select`, `Input`, `ScrollArea`, `Separator`.
- No inventar colores ni fondos manuales; usar los tokens del tema.
- Quitar `max-w` del workspace CNT y dejar el panel principal expandido.
- Mantener una sola selección de empresa/punto como contexto global desde el sidebar.
- Simplificar la lógica de pantalla: la shell solo navega y el componente hijo resuelve la consulta o edición.
- Las vistas de reporte deben ofrecer salida `PDF` y `Excel` desde la misma consulta.

### Reportes y exportación

- **PDF**: formato de impresión fiel para Balance, Mayor, Diario, Balance General, Estado de Resultados, Anexos y listados.
- **Excel**: exportación tabular para análisis de Catálogo, Asientos, Balance, Mayor, NCF y Centro de Costos.
- La exportación debe reutilizar la misma query del reporte visible; no duplicar lógica.

### Orden de ejecución CNT

1. Ajustar la shell del módulo a layout full width con plantilla.
2. Montar cada menú en su vista real o en un stub claro.
3. Agregar acciones de exportación en los reportes.
4. Implementar endpoints backend de exportación si el reporte no puede salir en cliente.
5. Cerrar QA visual comparando con las capturas del legado.

---

## ACC — Caja Chica

### Tablas principales
- TACC_CAJA_CHICA — cajas chicas
- TACC_DOCUMENTO — documentos de gasto
- TACC_BENEFICIARIO / TACC_TBENEFICIARIO — beneficiarios
- TACC_REPOSICION — reposiciones
- TACC_DCDOCU — pre-asiento contable
- TACC_TGASTOS — tipos de gastos
- TACC_CIERRE — cierre

### Flags de usuario (TACC_USUARIO)
CREAR_BENEFICIARIO, CREAR_CAJA_CHICA, HACER_CIERRE

### Menú ACC
- **Cajas**: Lista de Cajas, Documentos por Caja
- **Reposición**: Crear, Aprobar
- **Reportes**: Gastos por Tipo, Por Beneficiario
- **Mantenimiento**: Beneficiarios, Tipos de Gasto
- **Utilerías**: Cierre

---

## Patrón de integración contable

Todos los módulos generan asientos en CNT mediante:
1. Al crear un documento, se insertan filas en **TXXX_DCDOCU** (pre-asiento)
   - Columnas: NO_CIA, PUNTO, TIPO_DOCU, NO_DOCU, CUENTA, TIPO_MOVI, MONTO, ANO_ASIENTO, MES_ASIENTO, NO_ASIENTO
2. El campo **ST_GENERADO_CNT** del documento pasa de N a S cuando se genera el asiento
3. El asiento se crea en **CNT.TCNT_ASIENTO** + **CNT.TCNT_ASIENTOL**

---

## Prioridad de implementación

### Fase 1 — Módulos centrales operativos
1. **FAT** — Facturación (55K facturas, núcleo del negocio)
2. **CXC** — Cuentas por Cobrar (ligado a FAT)
3. **INV** — Inventario (ligado a FAT para stock)

### Fase 2 — Contabilidad y pagos
4. **CNT** — Contabilidad (recibe asientos de todos)
5. **CXP** — Cuentas por Pagar
6. **CHC** — Bancos/Cheques

### Fase 3 — Módulos de soporte
7. **ODC** — Órdenes de Compra
8. **ACC** — Caja Chica
9. **SDN** — Nómina (módulo complejo, 62 empleados)
