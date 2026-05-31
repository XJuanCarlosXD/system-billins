# Auditoria PDFs FAT clonados vs legado SIGAF

Fecha: 2026-05-31
Fuente legado: `C:\Users\JCABREU\AppData\Local\memorias_sigaft\memorias_por_modulo\memoria_facturacion.md`
Regla del proyecto: "Los reportes deben conservar parametros, totales, cortes y
ordenamientos del legado para comparacion automatica."

## Resumen de PDFs implementados

| PDF clonado | Endpoint | Equivalente legado | Estado |
|---|---|---|---|
| Factura individual | `GET /fat/documentos/<tipo>/<no>/pdf/` | (Oracle Reports custom factura) | OK / fidelidad alta |
| Listado facturas | `GET /fat/reportes/listado/pdf/` | Rfat321 (Ffat307) | **CON GAPS** |
| Conduce individual | `GET /fat/conduces/<tipo>/<no>/pdf/` | Rfat302 | OK / falta validar tipos T/O/F/A |
| Listado conduces | `GET /fat/reportes/listado-conduces/pdf/` | (sin equivalente directo) | OK |

## Gap 1 — Listado facturas vs Rfat321

### Spec legado (Ffat307 → Rfat321.rep)

Parametros:
- `p_no_cia`, `p_punto`
- `p_tipo_docu` ('F'=Credito, 'O'=Contado, 'T'=todos)
- `p_vendedor` (NULL = todos)
- `p_cliente` (NULL = todos)
- `p_fecha_i`, `p_fecha_f`

SQL representativo:
```sql
SELECT A.PUNTO||'-'||A.TIPO_FACTURA||'-'||A.NO_FACTURA documento,
       A.TIPO_FACTURA TIPO_DOCU, A.NO_FACTURA NO_DOCU,
       LPAD(A.NO_CLIENTE,5,'0') NO_CLIENTE, A.VENDEDOR,
       decode(a.st_anulado,'S',0,A.TOTAL_NETO) TOTAL_NETO
FROM TFAT_FACTURA A, ...
WHERE A.NO_CIA = :P_NO_CIA AND A.PUNTO = :P_PUNTO
  AND (A.TIPO_FACTURA = :P_TIPO_DOCU OR :P_TIPO_DOCU = 'T')
  AND (A.VENDEDOR = :P_VENDEDOR OR :P_VENDEDOR IS NULL)
  AND (A.NO_CLIENTE = :P_CLIENTE OR :P_CLIENTE IS NULL)
  AND trunc(A.FECHA) BETWEEN :P_FECHA_I AND :P_FECHA_F
```

### Mi implementacion actual

Parametros: `no_cia, punto, desde, hasta, tipo, estado`
Columnas: `TIPO, NO_FACTURA, FECHA, CLIENTE, NCF, TOTAL`

### Gaps identificados

| # | Gap | Severidad |
|---|---|---|
| G1.1 | Filtro `vendedor` ausente | Media |
| G1.2 | Filtro `no_cliente` ausente | Media |
| G1.3 | Columna `VENDEDOR` ausente | Alta — el legado la muestra |
| G1.4 | Columna `NO_CLIENTE` (LPAD 5) ausente — solo muestro nombre | Media |
| G1.5 | Anulados muestran total real, no 0 (decode) | **Alta — afecta totales** |
| G1.6 | `documento` composite `PUNTO-TIPO-NO_FACTURA` ausente | Baja |
| G1.7 | Estados: yo uso codigo DB (FC/FT), legado usa F/O/T | Baja — solo etiqueta |

### Plan de remediacion

1. Backend `list_facturas`: aceptar kwargs `vendedor` y `no_cliente`.
2. Backend `fat_lista_facturas_pdf`: leer `vendedor` y `no_cliente` de query params.
3. PDF columnas: `PUNTO-TIPO-NO`, `FECHA`, `VENDEDOR`, `NO_CLIENTE`, `CLIENTE`, `NCF`, `TOTAL`.
4. Renderer: si `st_anulado='S'`, mostrar 0.00 en TOTAL (no sumar al gran total).

## Gap 2 — Conduce individual vs Rfat302

### Spec legado (Rfat302.rep)

Parametros:
- `p_no_cia`, `p_punto`
- `p_tipo_tran` (tipos: 'O'=Contado, 'F'=Credito, 'A'=Anulacion, 'T'=todos)
- (otros heredados: cliente, vendedor, fechas)

Lookup secundarios: `TINV_CIAS.DESCRIPCION`, `TCXC_CLIENTE.NOMBRE`,
`TFAT_TIPO_SC.DESCRIPCION` (TIPO_SC = Sin Cargo).

### Mi implementacion actual

`fat_conduce_pdf` muestra: razon social, cliente, RNC, direccion, fecha, vendedor,
condicion pago, NCF DGI, factura vinculada, lineas, totales, nota.

### Gaps identificados

| # | Gap | Severidad |
|---|---|---|
| G2.1 | Mapeo `clase` -> etiqueta: yo uso C/O/P, legado usa O/F/A semantica distinta | Media |
| G2.2 | Falta `TIPO_SC` (Sin Cargo) lookup si aplica | Baja |
| G2.3 | Falta validacion contra `TFAT_TIPO_SC` | Baja |

### Plan de remediacion

1. Confirmar semantica de `TFAT_CONDUCE.clase`: investigar valores reales en DB.
2. Si la pantalla del legado mostraba "Tipo: Contado/Credito" en lugar de
   "Conduce/Cotizacion", ajustar el mapping.
3. Lookup `TFAT_TIPO_SC` opcional, solo si la columna `tipo_sc` esta presente
   en TFAT_CONDUCE (probablemente no — es para sin-cargo).

## Gap 3 — Factura individual

No tiene equivalente .rep directo en el modulo FAT (impresion fisica de factura
es estandar). Validado contra spec interna del proyecto
(`2026-05-29-fat-print-factura-design.md`): razon social, NCF DGI, vendedor
nombre, condicion pago descripcion. **OK, sin gaps relevantes.**

## Gap 4 — Listado conduces

No tiene equivalente .rep directo. Es una utilidad de listado nueva. **OK.**

## Reportes legacy AUN NO CLONADOS

| .rep | Form | Descripcion | Tablas clave | Prioridad |
|---|---|---|---|---|
| Rfat333 | Ffat310 | Listado Lista de Precio | TFAT_LISTA_PRECIO, TINV_PRODUCTO | Alta |
| Rfat319 | — | Listado facturas con filtro ventas exentas/no-exentas | TFAT_NOMBRE | Media |
| Rfat328 | — | Reporte facturas con RNC + TCXC_REFEDOCU | TCXC_DOCUMENTO | Media |
| Rfat302 (margen) | Ffat311 | Margen Beneficio Bruto Cliente/Factura/Producto | TINV_PRODUCTO+TFAT_FACTURA | Alta |

## Decisiones pendientes

- D1 — Aplicar fixes G1.1-G1.7 al listado de facturas? **PROPUESTA: SI**
- D2 — Reordenar clase del conduce para coincidir con legado? Necesita inspeccion
  de la pantalla legacy real con datos. **PROPUESTA: dejar como esta, anotar**
  para validacion en sesion con el usuario.
- D3 — Clonar Rfat333 (lista de precio) y Rfat321 margen? **PROPUESTA: SI, en este
  orden tras los fixes G1.**
