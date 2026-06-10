# Integraciones externas

## TSS (Tesorería Seguridad Social)

Tablas:
- `SDN.TSDN_ARCHIVO_TSS` — staging del archivo a enviar.
- `SDN.TSDN_TSS_TMP` — temporal de procesamiento.
- `SDN.TSDN_PUESTOS_TSS` — catálogo de puestos requerido por TSS.
- `SDN.TSDN_NACIONALIDADES_TSS` — catálogo de nacionalidades.
- `SDN.TSDN_INGRESOS.NO_COTIZA_TSS` (S/N) — bandera por concepto.

Campos clave por empleado: `NO_PUESTO_TSS`.

**Pendiente cliente:** capturar un sample real del archivo TSS generado para un mes y guardarlo en `legacy_dumps/integraciones/tss/sample_YYYYMM.txt`.

## AFP (Pensiones)

- `SDN.TSDN_AFP` — catálogo estándar.
- `SDN.TSDN_AFP_ABREGONZA` — variante custom del cliente.
- Empleado: `NO_AFP`.
- `SDN.TSDN_CIAS.TOPE_SALARIO_AFP`.

## ARS (Salud)

- `SDN.TSDN_ARS`
- `SDN.TSDN_ARS_ABREGONZA`
- Empleado: `NO_ARS`.

## Banco (pago nómina)

- `SDN.TSDN_ARCHIVO_BANCO` — registro generado.
- `SDN.TSDN_GENERA_ARCHIVO_BCO` — log de generaciones.
- `CHC.TCHC_BANCOS_AFILIADOS` — lista de bancos afiliados al sistema de pagos.

**Pendiente cliente:** muestra del archivo ACH/transferencia para pago de nómina del último mes.

## Retenciones DGII

- `CXP.TCXP_TIPO_RETENCION_DGII` — catálogo oficial de tipos de retención.
- `CXP.TCXP_DOCUMENTO`: ISR_RETENIDO, ITBIS_RETENIDO, ITBIS_LLEVADO_COSTO, TIPO_RETENCION.
- `CHC.TCHC_CHEQUE`: RETENIDO (S/N), VALOR_RETENCION.
- `FAT.TFAT_FACTURA`: FECHA_RETENCION, ISR_RETENIDO, ITBIS_RETENIDO.
- `CHC.TCHC_PAGO_RECURRENTE`: VALOR_ITBIS_CXP, VALOR_RETENCION.
- `CHC.TCHC_CERTIFICADO_TMP`: certificados de retención emitidos a proveedores.

## ITBIS / ISR / cuentas fiscales

- `CNT.TCNT_CIAS.ITBIS` (tasa por defecto), `CUENTA_ISR`, `CUENTA_ITBIS_RETENIDO`, `UTILIDAD_RETENIDA`.
- `CNT.TCNT_GRUPO_CONTABLE.ITBIS_COMPRA`, `ITBIS_VENTA`.
- `FAT.TFAT_PUNTO.ITBIS_EN_PRECIO` (S/N — si los precios cargados ya incluyen ITBIS).
- `CXC.TCXC_CLIENTE.EXCENTO_ITBIS` (clientes exentos).
- `CXP.TCXP_DPROVEEDOR.EXCENTO_ITBIS` (proveedores exentos).

## Reportes laborales DGII (de la página del fabricante, pendiente confirmar tablas)

- IR-13 (autodeterminación nómina anual)
- DGT4 (planilla DGT)
- Autodeterminación

Estos son reportes de Sdn que generan archivos para enviar a DGII. Pendiente identificar la query/RDF exacto.

## Lo que falta por captura manual del cliente

| Integración | Sample necesario |
|---|---|
| TSS mensual | `legacy_dumps/integraciones/tss/sample_YYYYMM.txt` |
| AFP por afp | `legacy_dumps/integraciones/afp/{afp_codigo}_YYYYMM.txt` |
| ARS por ars | `legacy_dumps/integraciones/ars/{ars_codigo}_YYYYMM.txt` |
| Banco nómina | `legacy_dumps/integraciones/banco_nomina/{banco}_YYYYMM.txt` |
| Banco ACH (CxP) | `legacy_dumps/integraciones/ach/{banco}_YYYYMM.txt` |
| Certificados retención | `legacy_dumps/integraciones/retenciones/cert_proveedor_sample.pdf` |
| IR-13 | `legacy_dumps/integraciones/dgii/ir13_YYYY.txt` |
| DGT4 | `legacy_dumps/integraciones/dgii/dgt4_YYYYMM.txt` |
| Autodeterminación | `legacy_dumps/integraciones/dgii/autodet_YYYY.txt` |

Esto se hace ejecutando los reportes en el sistema legado para un mes/año real.
