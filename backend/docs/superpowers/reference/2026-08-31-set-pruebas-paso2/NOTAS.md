# Set de Pruebas Paso 2 + XSD oficiales — Notas de mapeo

Descargado 2026-08-31 noche desde:
- Portal de Certificación (`ecf.dgii.gov.do/certecf/portalcertificacion/Postulacion/Pruebas`,
  botón "Descargar comprobantes", logueado como RNC 130217432) → `set-pruebas-130217432.xlsx`.
- Documentación pública DGII (`dgii.gov.do/.../documentacionSobreE-CF.aspx`):
  `e-CF-31-v1.0.xsd`, `e-CF-32-v1.0.xsd`, `RFCE-32-v1.0.xsd`,
  `Formato-e-CF-V1.0.pdf`, `Formato-RFCE-v1.0.pdf`, `Descripcion-Tecnica-Servicios-DGII.pdf`.

## 1. HALLAZGO IMPORTANTE — el Set de Pruebas no está limitado a tipos 31/32

El spec (`2026-08-31-fe-ecf-fase2-comprobante-electronico-design.md` §3) asumía que el
Set de Pruebas del Paso 2 cubriría solo 31 (Crédito Fiscal) y 32 (Consumo), que son los
prioritarios para el negocio real de Abregonza. **El archivo real descargado trae 25
escenarios (hoja `ECF`) que cubren los 10 tipos completos del `GrupoComprobante` de la
Postulación** (31,32,33,34,41,43,44,45,46,47), más 4 escenarios RFCE (hoja `RFCE`, todos
tipo 32, resúmenes de consumo):

| CasoPrueba (=RNC+eNCF) | TipoeCF |
|---|---|
| E330000000001 | 33 Nota Débito |
| E320000000006, 000012, 000013, 000014, 000015, 000004 | 32 Consumo (6) |
| E340000000013, 000001 | 34 Nota Crédito (2) |
| E440000000013, 000010 | 44 Régimen Especial (2) |
| E310000000001, 000010, 000034, 000007 | 31 Crédito Fiscal (4) |
| E410000000008, 000007 | 41 Compras (2) |
| E430000000001, 000007 | 43 Gastos Menores (2) |
| E450000000003, 000007 | 45 Gubernamental (2) |
| E460000000009, 000007 | 46 Exportaciones (2) |
| E470000000001, 000007 | 47 Pagos al Exterior (2) |

RFCE (hoja `RFCE`, 4 filas): E320000000014, 000012, 000015, 000013 — todos tipo 32,
resúmenes de factura de consumo (paso previo obligatorio para consumo < RD$250k).

**Implicación práctica:** para que el portal marque "N/N Comprobantes Aceptados" al
100% en el Paso 2, hace falta poder generar/firmar/enviar los 10 tipos, no solo 31/32.
Esto NO cambia el alcance de producción (`ecf_builder.construir_ecf_31/32` sigue
priorizando el mapeo real desde `TFAT_FACTURA` para 31/32, según spec — los otros 8
tipos siguen "fuera de alcance" para el flujo automático de facturación). Pero el
**endpoint de modo test (Task 5)** que arma el e-CF directo desde el payload del Set de
Pruebas debe ser genérico por tipo, no limitado a 31/32, porque los datos ya vienen
completos en el xlsx para cualquier tipo — ver §3.

Documentado también en la memoria `project_dgii_ecf_postulacion_estado_20260831` para
que quede visible sin tener que releer este archivo.

## 2. Estructura del XML — CORRECCIÓN 2026-09-01: NO son idénticos, hay diffs reales

**Corrección importante** (encontrada por el reviewer de Task 1, la afirmación original de
esta sección era incorrecta y llevó a un bug real): los XSD de `e-CF-31` y `e-CF-32` **no
son byte-a-byte el mismo esquema**. Comparten el mismo elemento raíz `<ECF>` y el mismo
`TipoeCFType` (enum con los 10 valores), y la enorme mayoría del árbol es idéntica — pero
hay diffs estructurales reales entre 31 y 32 (`diff` de los nombres de elemento):

- **Solo en `e-CF-31`** (Crédito Fiscal): `FechaVencimientoSecuencia` (dentro de `IdDoc`,
  `minOccurs="1"` — **obligatorio**, viene de `TFE_SECUENCIA.fecha_vence`), y el bloque de
  retenciones `TotalITBISRetenido`/`TotalISRRetencion`/`TotalITBISPercepcion`/
  `TotalISRPercepcion` + por-línea `Retencion`/`IndicadorAgenteRetencionoPercepcion`/
  `MontoITBISRetenido`/`MontoISRRetenido` (Ley 253-12, agentes de retención — aplica solo
  si el comprador es agente de retención, opcional pero solo existe en el 31).
- **Solo en `e-CF-32`** (Consumo): `IdentificadorExtranjero` (comprador extranjero sin RNC)
  y el bloque `Mineria`/`PesoNetoKilogramo`/`PesoNetoMineria`/`TipoAfiliacion`/`Liquidacion`
  (no aplica a Abregonza, sector minería).
- `Comprador/RNCComprador` y `RazonSocialComprador` son **obligatorios en 31**
  (`minOccurs="1"`) pero **opcionales en 32** (consumidor final sin RNC es válido en
  Consumo, no en Crédito Fiscal — tiene sentido, un Crédito Fiscal sin RNC del comprador
  no sirve para que el comprador lo use como gasto deducible).
- El resto de la estructura (Encabezado común, DetallesItems/Item, Totales agregados,
  FechaHoraFirma) sí es idéntica entre ambos.

**No asumir "mismo esquema" para los 8 tipos restantes (33,34,41,43,44,45,46,47) sin
diffearlos también** — cada uno puede tener este mismo patrón de 2-3 campos exclusivos.
Antes de implementar cualquiera de esos 8 (fuera de alcance por ahora), repetir este
mismo `diff` de nombres de elemento contra `e-CF-32.xsd` como baseline.

Sigue siendo cierto que un builder interno compartido (dict de datos → XML) es la forma
más limpia de implementar esto — pero el dict debe incluir los campos exclusivos por tipo
(`fecha_vencimiento_secuencia` para 31, retenciones si aplica) y el código debe **fallar
duro** (no omitir en silencio) si falta un campo obligatorio del tipo solicitado.

Árbol raíz `ECF`:
```
ECF
├── Encabezado (1)
│   ├── Version "1.0" (1)
│   ├── IdDoc (1): TipoeCF, eNCF, TipoIngresos, TipoPago [+ opcionales:
│   │     IndicadorEnvioDiferido, IndicadorMontoGravado, IndicadorServicioTodoIncluido,
│   │     FechaLimitePago, TerminoPago, TablaFormasPago(1-7 FormaDePago),
│   │     TipoCuentaPago, NumeroCuentaPago, BancoPago, FechaDesde/Hasta, TotalPaginas]
│   ├── Emisor (1): RNCEmisor, RazonSocialEmisor, DireccionEmisor, FechaEmision
│   │     [+ opcionales: NombreComercial, Sucursal, Municipio, Provincia,
│   │      TablaTelefonoEmisor(1-3), CorreoEmisor, WebSite, ActividadEconomica,
│   │      CodigoVendedor, NumeroFacturaInterna, NumeroPedidoInterno, ZonaVenta,
│   │      RutaVenta, InformacionAdicionalEmisor]
│   ├── Comprador (1, todo opcional salvo estructura): RNCComprador,
│   │     RazonSocialComprador, DireccionComprador, etc. — Comprador puede ir vacío
│   │     de RNC en consumidor final (tipo 32) pero DGII rechaza si el elemento
│   │     Comprador falta por completo (minOccurs=1 el contenedor)
│   ├── InformacionesAdicionales (0-1): embarque/peso/bultos — no aplica a FAT normal
│   ├── Transporte (0-1): conductor/placa — no aplica a FAT normal
│   ├── Totales (1): MontoGravadoTotal, MontoGravadoI1/I2/I3, MontoExento,
│   │     ITBIS1/2/3 (%), TotalITBIS, TotalITBIS1/2/3, MontoTotal (obligatorio),
│   │     ImpuestosAdicionales(0-1, 1-20 items) — Selectivo al Consumo etc.
│   └── OtraMoneda (0-1): solo si se factura en moneda extranjera
├── DetallesItems (1): Item (1-1000)
│   └── por línea: NumeroLinea, IndicadorFacturacion(0-4: No facturable/ITBIS18/16/0/Exento),
│         NombreItem, IndicadorBienoServicio(1 Bien/2 Servicio), CantidadItem,
│         PrecioUnitarioItem, MontoItem (obligatorios) [+ opcionales: DescripcionItem,
│         UnidadMedida, DescuentoMonto, RecargoMonto, TablaCodigosItem, etc.]
├── Subtotales (0-1) — solo si se agrupan líneas por subtotal visual
├── DescuentosORecargos (0-1) — ajustes a nivel de documento (no por línea)
├── Paginacion (0-1) — solo documentos multi-página
├── InformacionReferencia (0-1): NCFModificado, RNCOtroContribuyente,
│     FechaNCFModificado, CodigoModificacion — OBLIGATORIO para tipo 34 (Nota Crédito)
│     y 33 (Nota Débito) referenciando el NCF que modifican
├── FechaHoraFirma (1, DateTimeValidationType) — la pone el firmante al firmar, NO antes
└── <xs:any> (1) — aquí va el elemento <Signature> XMLDSig que agrega
      `firmar_con_app_oficial()`; el XML "sin firmar" que arma ecf_builder NO debe
      incluir este nodo, se lo agrega la firma.
```

### Tipos de dato / validaciones clave (de los `simpleType` del XSD)
- `eNCF`: exactamente 13 caracteres alfanuméricos (`E` + tipo 2 díg + 10 díg secuencial,
  ej. `E320000000006`) — viene de `TFE_SECUENCIA`, NO es el NCF de papel de `TFAT_FACTURA.ncf`.
- `RNCValidationType`: 9 u 11 dígitos exactos (cédula=11, RNC=9).
- `TipoIngresos`: '01'..'06', catálogo fijo — para FAT normal usar '01' (Ingresos por
  operaciones).
- `TipoPago`: 1=Contado, 2=Crédito, 3=Gratuito (entero, no string).
- `FormaPago` (dentro de `TablaFormasPago`): 1=Efectivo,2=Cheque/Transf/Depósito,
  3=Tarjeta,4=Venta a Crédito,5=Bonos,6=Permuta,7=Nota crédito,8=Otras — mapear desde
  `FAT.TFAT_TIPO_PAGO.tipo_pago_fiscal` si existe esa columna, si no inferir de
  `tipo_pago` legado.
- `IndicadorFacturacion` (por línea): 0=No facturable,1=ITBIS 18%,2=ITBIS 16%,
  3=ITBIS 0%,4=Exento — mapear desde `porciento_impuesto` de `TFAT_FACTURAL`
  (18→1, 16→2, 0→3, null/exento→4).
- Todos los montos son `Decimal18D1or2...` (1 o 2 decimales, sin separador de miles,
  punto decimal) — Python: `f"{valor:.2f}"`.
- Fechas: `FechaValidationType` (revisar patrón exacto en el XSD — formato `dd-mm-aaaa`,
  visto en los datos de ejemplo del Set de Pruebas: `31-12-2028`, `02-04-2020`).
- `FechaHoraFirma`: `DateTimeValidationType` (con hora) — la genera el proceso de firma,
  no `ecf_builder`.

## 3. Mapeo a columnas reales de FAT (`fat_repo.py`, verificado por grep, NO inventado)

| Campo e-CF | Columna/fuente real |
|---|---|
| `Emisor/RNCEmisor` | `TFE_CONFIG.rnc` de la cía (ya cargado, Abregonza 130217432) |
| `Emisor/RazonSocialEmisor` | `TFE_CONFIG` o `FAT.TFAT_CIAS.descripcion` |
| `Emisor/FechaEmision` | `TFAT_FACTURA.fecha` |
| `IdDoc/eNCF` | `TFE_SECUENCIA` (secuencial e-NCF propio, NO `TFAT_FACTURA.ncf`) |
| `IdDoc/TipoeCF` | 31 si `tipo_ncf_fiscal`/`codigo_ncf` de la factura es Crédito Fiscal,
  32 si es Consumo (usar el mismo criterio que ya existe para el NCF de papel en
  `_compose_ncf_dgi`, memoria `project_sigaft_ncf_schema`) |
| `IdDoc/TipoPago` | `TFAT_FACTURA` no tiene columna directa vista; inferir de
  `FAT.TFAT_TIPO_PAGO` vía la forma de pago de la factura (1=Contado si pagada en el
  momento, 2=Crédito si créditox — ver lógica ya usada en Fcxc/FAT crédito automático,
  memoria `project_cxp_fecha_invalida_fat_credito`) |
| `Comprador/RNCComprador` | `CXC.TCXC_CLIENTE.rnc` (join por `no_cliente`) — vacío
  válido para consumidor final tipo 32 |
| `Comprador/RazonSocialComprador` | `CXC.TCXC_CLIENTE.nombre` |
| `Comprador/DireccionComprador` | `CXC.TCXC_CLIENTE.direccion` |
| `Totales/MontoTotal` | `TFAT_FACTURA` total de la factura (columna total/total_neto+impuesto,
  confirmar nombre exacto en el SELECT de detalle de factura, no solo en reportes) |
| `Totales/TotalITBIS` | suma de `TFAT_FACTURAL.impuesto` de las líneas |
| `DetallesItems/Item/NumeroLinea` | `TFAT_FACTURAL.no_linea` |
| `Item/NombreItem` | `TFAT_FACTURAL.descripcion` (o `INV.TINV_PRODUCTO.descripcion` si
  se prefiere el nombre canónico del producto) |
| `Item/CantidadItem` | `TFAT_FACTURAL.cantidad` |
| `Item/PrecioUnitarioItem` | `TFAT_FACTURAL.precio` |
| `Item/IndicadorFacturacion` | derivado de `TFAT_FACTURAL.porciento_impuesto` (ver §2) |
| `Item/MontoItem` | `TFAT_FACTURAL.monto_neto` |
| `InformacionReferencia/NCFModificado` | solo si `tipo_factura` es NC/ND: buscar el NCF
  original vía `CXC.TCXC_REFEDOCU` (mismo patrón que la cola CxP de NCF duplicado,
  memoria `project_cxp_cola_ncf_dup_link_20260824`) |

**Nota:** no se encontró aún una columna `total`/`monto_total` explícita de
`TFAT_FACTURA` en este grep — Task 1 debe confirmar el nombre exacto de esa columna
leyendo el SELECT completo de `get_factura_detalle` (o equivalente) en `fat_repo.py`
antes de escribir `construir_ecf_32`, no asumir `total_neto+impuesto` sin verificarlo
contra una factura real.

## 4. Para Task 5 (modo test, payload directo del Set de Pruebas)

El endpoint `POST /api/fe/pruebas/enviar/` NO debe pasar por `fat_repo`/`TFAT_FACTURA`
en absoluto — su payload es directamente una fila de `set-pruebas-130217432.xlsx`
(hoja `ECF` para e-CF completo, hoja `RFCE` para resúmenes), con headers ya nombrados
igual que los elementos del XSD (`TipoeCF`, `ENCF`, `RNCEmisor`, `FormaPago[1]`,
`MontoPago[1]`, etc. — el `[N]` indica posición dentro de una tabla repetida, ej.
`TablaFormasPago/FormaDePago`). El valor `#e` en una celda significa "campo vacío /
no aplica para este escenario", no un string literal — tratarlo como `None`.

Un builder genérico `construir_ecf(tipo_ecf: int, datos: dict) -> str` que reciba
directamente ese dict (con los mismos nombres de columna del xlsx) cubre los 10 tipos
sin trabajo adicional — Task 1 puede envolver ese genérico para los wrappers 31/32
reales, y Task 5 lo llama directo con el dict armado desde la fila del Excel.

## 5. ACTUALIZACIÓN 2026-09-01 — XSD de los 10 tipos completos + esquema de aplanado real

**Se descargaron los 8 XSD restantes** (`e-CF-33` a `e-CF-47`, mismo origen público DGII)
para que Task 5 tenga estructura real de los 10 tipos, no solo 31/32 — la sección 2 de
este documento ya advertía no asumir "mismo esquema" para los 8 restantes sin diffearlos;
ya están en esta misma carpeta listos para diffear igual que se hizo con 31 vs 32.
Hallazgo rápido: `IndicadorNotaCredito` (visto en el Set de Pruebas) solo existe en
`e-CF-34-v1.0.xsd` (Nota de Crédito) — confirma que cada tipo puede tener 1-2 campos
exclusivos adicionales, como ya se sabía.

**Esquema de aplanado real del Set de Pruebas** (extraído programáticamente de las 25
filas reales de la hoja `ECF`, no de las 5215 columnas teóricas — de esas, solo **347
columnas tienen datos reales no-vacíos** en los 25 escenarios; ver
`campos-usados-set-pruebas.txt` en esta carpeta para la lista completa). El
convenio de nombres de columna del Excel usa corchetes para representar grupos
repetidos del XSD:

- **Campo simple de encabezado**: nombre tal cual, ej. `RNCEmisor`, `FechaEmision`,
  `MontoTotal` → mapea 1:1 a un elemento del árbol `Encabezado` (ver §2 para saber en
  qué sub-sección: `IdDoc`/`Emisor`/`Comprador`/`Totales`/`InformacionesAdicionales`/
  `Transporte`/`InformacionReferencia`).
- **Grupo repetido de encabezado, 1 corchete**: `Nombre[N]`, ej. `FormaPago[1]`/
  `MontoPago[1]`, `FormaPago[2]`/`MontoPago[2]` → los pares con el mismo N arman una
  instancia de `TablaFormasPago/FormaDePago`. Mismo patrón para
  `TelefonoEmisor[1..3]` (`TablaTelefonoEmisor`) y para `TipoImpuesto[1]`/
  `TasaImpuestoAdicional[1]`/... (`Totales/ImpuestosAdicionales/ImpuestoAdicional`,
  **cuidado**: mismo nombre de campo que a nivel ítem pero con UN solo corchete —
  se distingue por la profundidad, ver abajo) y `NumeroLineaDoR[N]`/`TipoAjuste[N]`/...
  (`DescuentosORecargos/DescuentoORecargo`, documento, no confundir con
  `NumeroLinea[N]` que es de ítem).
- **Campo de línea/ítem, 1 corchete**: `Nombre[LineaN]`, ej. `NumeroLinea[1]`,
  `NombreItem[1]`, `CantidadItem[1]`, `MontoItem[1]` → arman la línea N de
  `DetallesItems/Item`. En el Set de Pruebas real se ven hasta 16 líneas (`[1]`..`[16]`)
  en un mismo escenario.
- **Sub-grupo repetido DENTRO de una línea, 2 corchetes**: `Nombre[LineaN][SubM]`, ej.
  `TipoCodigo[1][1]`/`CodigoItem[1][1]` (`TablaCodigosItem/CodigosItem` de la línea 1),
  `Subcantidad[1][1]`/`CodigoSubcantidad[1][1]` (`TablaSubcantidad`),
  `TipoSubDescuento[1][1]`/`MontoSubDescuento[1][1]` (`TablaSubDescuento`),
  `TipoSubRecargo[1][1]`/`SubRecargoPorcentaje[1][1]`/`MontosubRecargo[1][1]`
  (`TablaSubRecargo`), `TipoImpuesto[1][1]`/`TipoImpuesto[1][2]`
  (`TablaImpuestoAdicional` de la línea, hasta 2) — el segundo corchete es el índice
  dentro del sub-grupo de esa línea específica.

Esto es suficiente para un parser genérico: separar cada clave en
`nombre_base` + lista de 0/1/2 índices, tener una tabla `nombre_base → (contenedor
XSD, profundidad_esperada)` construida a partir de los XSD reales, y reconstruir el
árbol agrupando por índice. **No hace falta soportar los ~4868 campos teóricos que el
Excel no usa realmente** — construir el mapeo solo para los 347 campos listados en
`campos-usados-set-pruebas.txt` cubre el 100% de lo que el Set de Pruebas real necesita.

Nota: la API de `POST /api/fe/pruebas/enviar/` (Task 4, ya construida) ya recibe
`{no_cia, tipo_ecf, encf, datos}` con `encf` como parámetro separado — si el operador
pega también una clave `ENCF`/`CasoPrueba` dentro de `datos` (copiada tal cual del
Excel), el builder debe ignorarla y usar el parámetro `encf` explícito como fuente de
verdad, no fallar ni duplicar.
