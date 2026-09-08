# Resultados reales del Paso 2 — RFCE (hoja `RFCE`, "Tercero") — 2026-09-08

Task 5b: los 4 escenarios que faltaban del Set de Pruebas Paso 2
(`E320000000012/013/014/015`, Facturas de Consumo Electrónica < RD$250,000)
requerían primero un RFCE (Resumen de Factura de Consumo Electrónica)
aceptado antes de poder subir manualmente la factura íntegra al portal
("Cuarto" paso). Este lote completa el "Tercero" — el RFCE — para los 4.

## Resumen (4/4 Aceptado, código 1, limpio)

| e-NCF | RNCComprador enviado | CodigoSeguridadeCF | Resultado `enviar_rfce` |
|---|---|---|---|
| E320000000012 | 130941361 (RC HERNANDEZ SRL) | a8fda3 | `estado=Aceptado codigo=1 secuenciaUtilizada=True` |
| E320000000013 | 130941361 (RC HERNANDEZ SRL) | 2f2513 | `estado=Aceptado codigo=1 secuenciaUtilizada=True` |
| E320000000014 | 130941361 (RC HERNANDEZ SRL) | 4c06ef | `estado=Aceptado codigo=1 secuenciaUtilizada=True` |
| E320000000015 | 130941361 (RC HERNANDEZ SRL) | 76c0eb | `estado=Aceptado codigo=1 secuenciaUtilizada=True` |

La respuesta de `enviar_rfce` es **síncrona** (confirmado leyendo
`Descripcion-Tecnica-Servicios-DGII.pdf`, sección "Recepción de resumen
factura de consumo electrónica (RFCE)": "en respuesta retornar Aceptado...
Aceptado condicional... o... Rechazado") — no hay `trackId` ni
`consultar_estado` posterior para el RFCE, a diferencia del e-CF completo.
`mensajes` vino `null` en los 4 (sin advertencias).

Aplicado el mismo gotcha de RNC ya documentado en
`../resultados-paso2-20260904/README.md` hallazgo #2: el `RNCComprador`
real del Excel (`131880681`, "DOCUMENTOS ELECTRONICOS DE 03") no es
contribuyente activo — sustituido por `130941361` / "RC HERNANDEZ SRL" en
AMBOS documentos (e-CF32 y RFCE), consistentemente.

## Algoritmo de `CodigoSeguridadeCF` — cómo se confirmó

Confirmado leyendo el texto real de DOS documentos oficiales de la DGII
(no una hipótesis):

1. `Formato-RFCE-v1.0.pdf`, campo 31 "Código Seguridad Factura de Consumo
   DOP$<250 M": "Corresponde a los 6 primeros caracteres del Hash de la
   firma digital correspondiente a la factura de consumo electrónica
   emitida, menor a DOP$250 M."
2. `Descripcion-Tecnica-Servicios-DGII.pdf`, secciones "Consulta de Resumen
   de Factura de Consumo Electrónica (RFCE)" y "Consulta de estado e-CF":
   "codigoSeguridad: extraído de los primeros seis (6) dígitos del hash
   generado en el SignatureValue de la firma digital [...]".

Ambas fuentes confirman el CONCEPTO (6 primeros caracteres de un hash del
`SignatureValue` del e-CF32 completo ya firmado de la misma factura) pero
NINGUNA nombra el algoritmo de hash exacto (SHA-1/256/MD5) ni la
codificación de salida. Implementado con SHA-256 sobre el texto exacto de
`<SignatureValue>` (UTF-8, sin decodificar el base64), hex, minúsculas,
primeros 6 caracteres (`apps.fe.ecf_builder.derivar_codigo_seguridad`, ver
docstring ahí para el detalle completo).

Esta elección puntual (SHA-256 vs. otro algoritmo) **no arriesgaba el envío
real**: `Formato-RFCE-v1.0.pdf` fila 31 dice literalmente "a) Sin
validación" para este campo, `RFCE-32-v1.0.xsd`
(`CodigoSeguridadeCFType`) solo exige el patrón `.{6}`, y la lista de
motivos de "Rechazado" documentados para el servicio de Recepción RFCE no
incluye el código de seguridad — confirmado empíricamente además: los 4
envíos dieron "Aceptado" limpio.

## XSD de la DGII: 2 typos reales encontrados (RFCE-32-v1.0.xsd)

Al intentar compilar `RFCE-32-v1.0.xsd` con `lxml.etree.XMLSchema` (para
los tests estructurales) se encontraron 2 errores reales de regex en
`FechaType`/`Decimal18D2...Type` que libxml2 rechaza:

1. `[12][$0-9]` — un `$` literal colado en la clase de caracteres, debería
   ser `[12][0-9]` (días 10-29).
2. `(?:19|20)` (y 3 apariciones más) — grupo NO-capturante estilo
   Perl/PCRE; el lenguaje de regex de XML Schema (Parte 2) no soporta
   `(?:...)`, solo grupos capturantes `(...)`. Comparado contra
   `FechaValidationType`/`Decimal18D2...Type` de `e-CF-32-v1.0.xsd` (que SI
   compilan) para confirmar que es un typo real, no una variante válida.

Corregido SOLO en memoria en los tests (`test_ecf_builder_rfce.py`,
`_cargar_xsd_rfce`) — el archivo XSD real descargado de la DGII no se
tocó. Mismo patrón ya usado en `test_ecf_builder_generico.py` para el typo
de `e-CF-31-v1.0.xsd`.

## Archivos en `xml/`

- `130217432E3200000000NN.xml` — el e-CF32 COMPLETO, YA FIRMADO, listo
  para el "Cuarto" paso: subida MANUAL por el widget "Facturas de consumo
  < 250Mil" en `https://ecf.dgii.gov.do/certecf/portalcertificacion/
  Postulacion/Pruebas` (acción de navegador del controlador, no
  automatizada aquí). Nombre de archivo según el estándar oficial
  RNC+eNCF.
- `rfce-firmado-E3200000000NN.xml` — el RFCE ya firmado y enviado (para
  auditoría, no hace falta volver a enviarlo).
- `resultado-E3200000000NN.json` — respuesta cruda de `enviar_rfce` +
  metadata (código de seguridad derivado, rutas).

## Cómo se generó

`python manage.py fe_rfce_consumo_menor` (`apps/fe/management/commands/
fe_rfce_consumo_menor.py`), ejecutado en un contenedor efímero en la VM
10.0.0.99 (`facturation-system-backend:latest` + `mono-runtime` instalado
en la capa efímera, en la red `facturation-system_default` para llegar a
`oracle-xe` y a la DGII real) — **nunca se tocó el contenedor
`facturation_backend` en ejecución ni su checkout en disco**
(`/home/jcabreu/facturation-system/backend`), solo se leyó de él (copia de
`firmar.exe` ya compilado, variables de entorno via `docker inspect`) para
poder firmar con el certificado real de Abregonza sin recompilar nada.
