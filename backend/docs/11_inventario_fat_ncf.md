# Inventario Fat + NCF / e-CF

## Empresas (multi-empresa real)

5 empresas configuradas en `FAT.TFAT_CIAS`:

| NO_CIA | Estado |
|---|---|
| 01 | Activa, con NCF (FC-001, FT-001) y secuencias en uso |
| 02 | Activa, con NCF (FC-002, FT-002) |
| 03 | Activa, con NCF (FC-003, FT-003) |
| 04 | Activa, con NCF (FC-004, FT-004) |
| 05 | Activa pero **sin CODIGO_NCF asignado** — emite sin NCF (revisar si es válido fiscal) |

Estructura `TFAT_CIAS`: NO_CIA, DESCRIPCION, DIRECCION, **RNC**, TELEFONO, FAX, IMPUESTO (tasa default), COD_DIARIO (link a CNT), MAX_DESCUENTO, **TASA_US** (tasa cambio dólar), PROX_REPORTE, ACTIVA, REGISTRO_CONT, FECHA, FORMULARIO_UNICO.

## Tipos de documento Fat

| Código | Descripción | Tipo Tx | Comentario |
|---|---|---|---|
| FC | FACTURA A CREDITO | F (Crédito) | NCF requerido, controla formulario, afecta CxC |
| FT | FACTURA CONTADO | O (Contado) | NCF requerido, no afecta CxC |
| CO | CONDUCE | C | Sin NCF |
| CT | COTIZACION | C | Sin NCF |
| AF | ANULACION FACTURA | A | Reverso |

Variantes en empresa 03 ("FACTURA CONTANDO" — typo en producción que debe replicarse exactamente).

## Modelo NCF / e-CF

### Tabla maestra: `CNT.TCNT_NCF`

```sql
NO_CIA, PUNTO, CODIGO_NCF (6),
NCF_INICIAL, NCF_FINAL, PROX_NCF,
NCF_MANUAL    -- 'S'/'N': se digita manual o auto-asigna
NCF_OPCIONAL  -- 'S'/'N': se puede emitir sin NCF
TIPO_NCF_FISCAL  -- 3 chars: 'B01' factura fiscal, 'B02' consumo, 'E31'-'E47' eCF
CANT_MIN_NCF  -- alarma cuando quedan pocos
```

### e-CF — soporte detectado

`CNT.TCNT_PUNTO`:
- `FASE_ENCF` (NUMBER) — fase de e-CF en la que está el punto.
- `ENCF_EN_CONTINGENCIA` (S/N) — modo contingencia DGII cuando no hay conexión.

`ESTADO_ENCF` en cada tabla de documento (TFAT_FACTURA, TCXP_DOCUMENTO, TCHC_CHEQUE, TACC_REPOSICION):
- NUMBER que codifica el estado del comprobante electrónico: pendiente, listo para enviar, enviado, aceptado, rechazado, anulado.

### Tablas de archivos DGII detectadas

- `CXP.TCXP_ARCHIVO_606_TMP` — staging del formato **606 (compras)**. Columnas: RNC_CEDULA, NUMERO_COMPROBANTE_FISCAL, NUMERO_COMPROBANTE_MODIFICADO, FECHA_COMPROBANTE...
- `FAT.TFAT_ARCHIVO_607_TMP` — staging del formato **607 (ventas)**. Columnas: NUMERO_NCF, NUMERO_NCF_MODIFICADO, RNC_CEDULA...
- (Pendiente confirmar) tabla del 608 (no detectada con grep — puede llamarse distinto, ej. anulaciones).

### Posiciones fijas

`CNT.TCNT_POSICIONES_FIJAS_NCF.PF_NCF` (VARCHAR2 11) — el formato de posiciones fijas del NCF (ej. "B01" + 11 ceros + secuencial).

Cada documento guarda `POSICIONES_FIJAS_NCF` (VARCHAR2 14) — el NCF completo formateado tal como se imprime y se reporta.

## Secuencias

`FAT.TFAT_SECUENCIA` (clave: NO_CIA, PUNTO, TIPO_DOCU):
- PROX_FORMULARIO — siguiente número de formulario interno
- PROX_DOCUMENTO — siguiente número de documento (no NCF)
- ULT_DOCU_IMPRESO — último impreso

Ejemplos en producción (2026-05-06):
- `01-01-FC` → próximo formulario 8039 (8038 emitidas)
- `01-01-FT` → próximo 1506
- `04-01-FC` → próximo 44 (empresa nueva)

**Continuidad de consecutivos:** crítica — cualquier cutover debe respetar estos números.

## Asientos contables

Cada movimiento de Fat se asienta en CNT vía tablas `TXXX_DCDOCU` (detalle de cuentas del documento) que incluyen `ANO_ASIENTO`, `MES_ASIENTO`, `NO_ASIENTO`, `CUENTA`, montos. Patrón replicado en ACC, CHC, CXC, CXP, INV.

Cada `TXXX_TDOCU` define las cuentas por defecto (ej. `CUENTA_PROPINA`, `CUENTA_CONTADO` en TFAT_TDOCU; `CUENTA`, `CUENTA_BANCO` en CHC).

## Tablas backup manuales (NO migrar)

Son backups que el equipo dejó en la BD con sufijos de fecha:
- `CHC.TCHC_CHEQUE_19022021`
- `CHC.TCHC_CHEQUE_19022021_2`
- `CHC.TCHC_CHEQUE_250423`
- `CXP.TCXP_DOCUMENTO_09112021`

(Y posiblemente más con `_NNNNNNNN` o `_TMP`). Excluir del clon.

## Inventario de Forms (Fat)

`D:\Sigaf\gpsc\Fat\Formas\` contiene **175 FMX**. Sin FMB en disco (pendiente cliente).

`D:\Sigaf\gpsc\Fat\Reportes\` contiene **109 REP**. Sin RDF en disco.

## Lo que falta para QA byte-exact (acción del cliente)

Para cada tipo NCF/e-CF que se use, ejecutar el reporte en el sistema legado para un período de prueba y guardar el archivo en `legacy_dumps/dgii/samples/`:

- 606 (compras del mes)
- 607 (ventas del mes)
- 608 (anulaciones del mes)
- E31, E32 (facturas e-CF)
- E33, E34 (notas crédito/débito e-CF)
- E41 (compras electrónicas)
- E43 (gastos menores)
- E44, E45, E46 (regimen especial / consumo / no contribuyente)
- E47 (pagos al exterior)

Solo el cliente puede correr Forms — yo no.
