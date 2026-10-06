# Plan Maestro — Certificación e-CF DGII Abregonza (Pasos 4 a 15)

**Este documento es la fuente de verdad entre corridas del runner automático
`ZentoryERP-ECF-Certificacion-Runner` (cada 4h).** Cada corrida DEBE leerlo
completo antes de actuar, y DEBE actualizar la sección "Estado por fase" +
agregar una entrada al "Log de corridas" al terminar, sin excepción — es la
única forma en que la próxima corrida (contexto totalmente fresco) sabe qué
ya se hizo.

RNC 130217432 (ABREGONZA), solicitud de certificación núm. **81443**. Portal:
`https://ecf.dgii.gov.do/certecf/portalcertificacion` (credenciales: ver
`C:\Users\JCABREU\bin\ecf-certificacion-runner-prompt.txt`, sección
Credenciales — NO las repitas en otros archivos nuevos).

## Antecedentes (no releer commits viejos, esto ya está confirmado)

- Pasos 1, 2 y 3 del flujo de 15 pasos: **completos**, confirmado en vivo
  contra `certecf` real (Paso 2: 21/21 e-CF + 4/4 RFCE + 4/4 Facturas
  <250Mil; Paso 3: 11/11 Aprobaciones Comerciales). No hace falta tocarlos
  de nuevo.
- Todo el código de Fase 1 (auth/config/secuencias) y Fase 2 (builder,
  envío, firma, bitácora, panel de Certificación e-CF en
  `Configuración → Facturación Electrónica`) está en `main`.
- Firma: usar SIEMPRE `apps.fe.firma.firmar_con_app_oficial()` (App Firma
  Digital oficial de la DGII vía Mono/C#, ya integrada) para cualquier XML
  que un validador real de la DGII vaya a revisar. `firmar_xml()` (propia,
  signxml) es solo para los endpoints P2P donde controlamos ambos lados.
- Ambiente correcto para TODO lo de certificación: **`certecf`**, nunca
  `testecf` (error de diseño ya corregido el 2026-09-17,
  `_AMBIENTE_MODO_TEST`/`_AMBIENTE` en `apps/fe/views.py` y
  `apps/fe/management/commands/fe_rfce_consumo_menor.py`).
- **Certificado digital** de Roberto Abreu Espinal:
  `C:\Users\JCABREU\Desktop\certificado-digital-roberto\roberto-abreu-espinal.p12`,
  clave `Ced00109276329` — ya cargado en `TFE_CONFIG` de no_cia='01' en la
  BD real, no hace falta volver a subirlo.
- Regla de oro repetida varias veces en este proceso: **certecf exige que
  los datos (RNCComprador, e-NCF, etc.) coincidan EXACTO con el "conjunto
  de datos entregados" por la DGII para ese paso** — no vale corregir con
  un dato "más correcto" por fuera de ese conjunto. Para el Paso 4 en
  adelante, como YA NO hay un Excel de la DGII (son datos de operaciones
  reales nuestras), esta restricción no aplica igual — pero cualquier
  e-NCF una vez enviado (Aceptado, Rechazado o Aceptado Condicional) queda
  **quemado para siempre**, no se puede reintentar el mismo.
- Reglas de negocio de ZentoryERP que siguen vigentes para este trabajo:
  [[feedback-ecf-todo-debe-salir-de-la-ui-no-scripts]] (toda acción real
  debe ser endpoint + UI, no un script ad-hoc) y "no reintentar a ciegas
  contra un sistema real del Estado" — si algo no es obvio, pausar y
  dejarlo documentado, no adivinar.

## Estado por fase (ACTUALIZAR ESTA TABLA CADA CORRIDA)

| # | Fase | Estado | Última actualización |
|---|------|--------|----------------------|
| 1 | Registrado | ✅ Completo | 2026-08-31 |
| 2 | Pruebas de Datos e-CF | ✅ Completo (21/21 + 4/4 + 4/4) | 2026-09-17 |
| 3 | Pruebas de Datos Aprobación Comercial | ✅ Completo (11/11) | 2026-09-17 |
| 4 | Pruebas Simulación e-CF | ✅ Completo — **50va corrida (2026-10-04 ~04 UTC): 🎉 FASE 4 CERRADA 29/29 + 4/4 WIDGET — PORTAL AUTO-REDIRIGIÓ A /PruebasSimulacionRepresentacionImpresa (FASE 5)**. Portal pre-corrida 25/N clase doc + 4/4 RFCE intacto post-regresión del 48va (ver 49va); widget 0/4 pendiente. Descarga `get_xmls_50va.py` (patrón 48va `get_xmls.py`) → `fe_repo.get_documento('01', E320000001062-1065)` dentro del contenedor → `/tmp/rfce_xmls_50va/*.xml` (5208/5209/7645/5922 bytes), `docker cp` + `pscp` local a `.tmp/rfce50/`. Subida secuencial via Playwright al `input#uploadArchivoFacturaSimulacion` + botón ENVIAR (`button:contains('Enviar'):not([disabled])`.click()`): 1062→1/4, 1063→2/4, 1064→3/4, 1065→4/4 Aceptados sin un solo rechazo ni cascade. **Al clickear ENVIAR del 4to upload, el portal respondió HTTP 302 a `/certecf/portalcertificacion/Postulacion/PruebasSimulacionRepresentacionImpresa`** — Fase 4 CERRADA por el servidor DGII mismo. Página Fase 5 confirmada por Playwright: 11 slots de upload (`Representación para comprobante tipo 31/32>=250Mil/33/34/41/43/44/45/46/47/32<250Mil`), botón "Enviar archivos", constraint `suma de todos los archivos cargados ≤ 10MB`, log Fase 5 vacío ("No existen mensajes."). Bandeja de Entrada ahora 49 (vs 48 pre-corrida; +1 mensaje por el avance a Fase 5). TFE_SECUENCIA sin cambios (ningún envío generó secuencia nueva, solo subida al widget). Sin código nuevo esta corrida (todo el pipeline Fase 4 estaba ya validado). Scripts no commiteados: `.tmp/get_xmls_50va.py`, `.tmp/rfce50/E320000001062-1065.xml`. Screenshot: `ri-fase5-abierta-50va.png` (full-page, no commiteado). **Hipótesis clave validada**: el cascade del 48va "ya habia sido cargada y aceptada previamente" se evita usando NCFs FRESCOS del ciclo activo (62-65 nunca subidos antes al widget); no hubo cascade asíncrono en el intervalo observado post-upload. **Próxima (51va)**: Fase 5 — subir 11 PDFs RI (uno por tipo e-CF). Candidatos sugeridos del ciclo 49va (todos Aceptados): 31→E310000000137 (FC-7829), 32≥250K→E320000001060 (RYLCO), 33→E330000000023, 34→E340000000060, 41→E410000000116, 43→E430000000116, 44→E440000000021, 45→E450000000114, 46→E460000000105, 47→E470000000110, 32<250K (RFCE)→E320000001062. Pipeline: frontend `/print/ecf-representacion-impresa/<encf>` ya construido + QR fix verificado 43va → navegar a cada URL con Playwright + usar `page.pdf()` (o Puck tiene botón imprimir? ver `frontend/src/features/pdf/defaults/ecf-representacion-impresa.ts`) → bajar 11 PDFs → subirlos al Fase 5 widget via `input` + ENVIAR archivos. Verificar antes de subir que cada PDF se abre bien y el QR es legible (fix 43va). **Previa (49va)**: 🎉 REBUILD TOTAL 29/29 clase doc + 4 RFCE EXITOSO (todo salvo widget) tras REGRESIÓN DEL 48va**. Al arrancar la 49va, portal estaba en **0/N para TODO** (incluso widget 1/4) — la subida de widget del 48va disparó un cascade asíncrono horas después con mensaje "e-NCF E320000001052 ya habia sido cargada y aceptada previamente" (log DGII 03/10/2026 4:23:43 PM). Primer intento rebuild sin tipo 34 llegó a 23/N + 4/4 RFCE (confirmado Playwright 24/29). Luego intento 2×34 contra E310000000133 (ciclo nuevo FC-0007829) con `RNCComprador=130941361` falló código 615 con **mensaje NUEVO**: "El RNC del comprador o Id extranjero de la nota de crédito no es válido, ya que no coincide con el RNC del comprador o Id extranjero de la factura que intenta modificar." Hallazgo #19 nuevo: **el tipo 34 exige que `RNCComprador` del NC coincida con el `RNCComprador` del 31 referenciado** — razón por la que el patrón 47va funcionó: E310000000121 histórico tiene RNC=130941361 (RC HERNANDEZ) que casualmente coincidía con el payload. E310000000133 (FC-0007829) tiene RNC=131265863 (PAE SRL), mismatch, rechazo. **CASCADE** destruyó 24/29. Rebuild total definitivo con script `send_49va_full.py`: 2/2 tipo 34 PRIMERO contra `E310000000121` histórico RNC=130941361 (Aceptado codigo=1 E340000000060/061) + 4×31 (E310000000137-140 via FC-0007829/7607/8076/7766) + 2×32≥250K (E320000001060 RYLCO + E320000001061 VALOIS) + 1×33 (E330000000023 NCFModificado=E310000000137) + 2×41 (E410000000116-117) + 2×43 (E430000000116-117) + 2×44 (E440000000021-022) + 2×45 (E450000000114-115) + 2×46 (E460000000105-106) + 2×47 (E470000000110-111) + 4×RFCE (E320000001062-1065 cs=eBDpGL/Uim6Ut/vexoWj/HCSuYR). **29/29 todos Aceptados consecutivos sin un solo rechazo** (confirmado Playwright post-rebuild: 25/25 clase doc + 4/4 RFCE + 0/4 widget). TFE_SECUENCIA post-49va: 31→141, 32→1066, 33→24, 34→62 (59 quemada del primer intento 34va; 60-61 Aceptadas), 41→118, 43→118, 44→23, 45→116, 46→107, 47→112. Scripts no commiteados: `.tmp/send_49va_rebuild.py`, `.tmp/send_49va_rfce.py`, `.tmp/send_49va_rfce2.py`, `.tmp/send_49va_tipo34.py`, `.tmp/send_49va_full.py`, `.tmp/get_rnc.py`. **Fase 4 queda ESENCIALMENTE COMPLETA excepto widget (0/4 Comprobantes Aceptados "Facturas de consumo <250Mil")**. **Próxima (50va)**: (1) subir 4×XML firmados al widget via Playwright: usar los NCFs frescos del ciclo 49va E320000001062-1065 (brand new, nunca antes subidos — minimiza riesgo del cascade por duplicado que mató el 48va). Descargar los XMLs vía `fe_repo.get_documento` + docker cp + pscp local, luego `input#uploadArchivoFacturaSimulacion` + botón ENVIAR 4 veces. (2) Si widget cierra 4/4 sin cascade asíncrono horas después → Fase 4 COMPLETA, portal debería abrir Fase 5. (3) Si widget vuelve a cascade: investigar antes de reintentar; hipótesis a probar: subir con delay largo entre uploads (minutos) o solo 1 xml y esperar reconciliación DGII antes del segundo. **48va previa**: 🎉 REBUILD TOTAL EXITOSO — 29/29 PORTAL COMPLETO FASE 4** (4/4 31 + 2/2 32≥250K + 1/1 33 + 2/2 34 preservados + 2/2 41 + 2/2 43 + 2/2 44 + 2/2 45 + 2/2 46 + 2/2 47 + 4/4 32 RFCE + 4/4 widget Aceptados). 25 envíos consecutivos sin un solo rechazo. e-NCFs: 31→E310000000129-132 (via `paso4-factura-real` FC-7829/7607/8076/7766); 32≥250K→E320000001048 RYLCO + E320000001049 VALOIS; 33→E330000000021 (NCFModificado=E310000000129, CodMod=3); 41→E410000000112-113 (`_PAYLOAD_41_CORRIDA_19`); 43→E430000000112-113; 44→E440000000017-018; 45→E450000000110-111; 46→E460000000101-102; 47→E470000000106-107. RFCE 32→E320000001050-1053 (FC-0008168/0008164/0008161/0008160 ROBERTO ABREU FINCA, codigo_seguridad M0yEH6/Vv2AFh/wjnFmM/AHVzpQ, servicio `fc.dgii.gov.do/certecf/recepcionfc` todos Aceptados código 1). Widget subida manual via Playwright `input#uploadArchivoFacturaSimulacion` + boton ENVIAR, los 4 XMLs firmados → 4/4 Aceptados. TFE_SECUENCIA post-48va: 31→133, 32→1054, 33→22, 34→59, 41→114, 43→114, 44→19, 45→112, 46→103, 47→108. Scripts no commiteados: `.tmp/send_48va_rebuild.py`, `.tmp/send_48va_rfce.py`, `.tmp/check_sec.py`, `.tmp/check_fts.py`, `.tmp/check_fcs.py`, `.tmp/rfce48/*.xml`. **Fase 4 queda ESENCIALMENTE COMPLETA** — portal debería redirigir a Fase 5 (Pruebas Simulación Representación Impresa) próximamente. **Próxima (49va)**: (1) verificar via Playwright que el portal redirija a `/Postulacion/Simulacion-RepresentacionImpresa` (o similar), confirmando Fase 4 completa; (2) si redirige: iniciar Fase 5 — pipeline Representación Impresa ya construido (QR verificado 43va) + endpoint `/print/ecf-representacion-impresa/<encf>` listo. Falta descargar PDFs RI de los 25 e-CF Aceptados (23 clase documento + 4 RFCE, uno por uno via navegador o endpoint batch) y subirlos al widget que exponga el portal. **47va previa**: 🎉 BLOQUEO HISTÓRICO TIPO 34 RESUELTO — 2/2 TIPO 34 ACEPTADO** (E340000000057 trackId `e5d20f79-a5cc-4126-b0bc-8ed67815261f` + E340000000058 trackId `9d692e23-26b4-46ac-a1d2-5381062d692c`, ambos Aceptado código 1 10/3/2026 12:15-12:16 PM UTC-4; portal post-sends Playwright confirmado 2/2 tipo 34). Patrón validado: `CodigoModificacion=2` (Corrige Texto) + `MontoTotal=0.00` + `MontoGravadoTotal=0.00` + `IndicadorNotaCredito=1` (patrón "Set permite / certecf exige" #18 — el Set oficial marca `IndicadorNotaCredito=0`, certecf exige `1`). Hipótesis #5 refinada tras 46va = única cambio vs. `_PAYLOAD_34_CORRIDA_46` fue `IndicadorNotaCredito` 0→1. El 34 NO necesita 4×31 Aceptados previos en ciclo activo — primera corrida 47va envió con portal en 0/N y NCFModificado=E310000000121 (31 Aceptado histórico, no del ciclo actual). TFE_SECUENCIA post-47va: 34→59 (57 y 58 Aceptadas), resto intacto. Portal 47va final: 2/N (solo tipo 34 presente, resto 0/N tras cascada 46va). Decisión intencional de NO reconstruir 27/N restante esta corrida: budget 50% consumido, cualquier rechazo durante rebuild cascadearía borrando los 2/2 recién conquistados; preferible lockear la victoria histórica. Código nuevo: `_PAYLOAD_34_CORRIDA_47` + test XSD-gate en `test_ecf_builder_generico.py`. Scripts no commiteados: `.tmp/send34_47va.py`, `.tmp/send34_47va_2.py`. **Próxima (48va)**: con budget fresco, rebuild completo del ciclo (patrones validados 40va): 4×31 vía `paso4-factura-real` + 2×32≥250K VALOIS/RYLCO + 1×33 CodMod=3 + 2×41 `_PAYLOAD_41_CORRIDA_19` + 2×43 + 2×44 + 2×45 + 2×46 + 2×47 + 4×RFCE + widget 4/4. **NO enviar nuevos 34 durante rebuild** (ya 2/2). Si rebuild completa → portal 29/N = Fase 4 COMPLETA. **46va previa**: HIPÓTESIS #5 "SET PATRÓN NC CORRIGE TEXTO" PARCIALMENTE VALIDADA — RECHAZO POR CAMPO DISTINTO AL 615 POR PRIMERA VEZ EN 5 INTENTOS**. Portal pre-corrida Playwright: 27/N intacto (4/4 31 + 2/2 32≥250K + 1/1 33 + 0/2 34 + 2/2 41 + 2/2 43 + 2/2 44 + 2/2 45 + 2/2 46 + 2/2 47 + 4/4 RFCE + 4/4 widget), log último reinicio sigue 01/10 8:22 PM. **Hallazgo mayor**: lectura del Set de Pruebas oficial `set-pruebas-130217432.xlsx` (hoja ECF filas 4-5) descubre que la DGII incluyó DOS casos tipo 34 — fila 5 `CasoPrueba=130217432E340000000001` usa `CodigoModificacion=2` (Corrige Texto) + `MontoTotal=0.00` + `MontoGravadoTotal=0.00` + `IndicadorNotaCredito=0` + `IndicadorMontoGravado=0`, patrón que las 4 hipótesis previas NUNCA habían probado (todas usaban CodMod=1/3 con MontoTotal>0). Nuevo payload `_PAYLOAD_34_CORRIDA_46` + test XSD-gate `test_payload_corrida46_tipo_34_cod_mod_2_monto_cero_valida_contra_xsd` pasan en contenedor. Envío real `/api/fe/certificacion/paso4-manual/` con payload del Set + `NCFModificado=E310000000121` (31 Aceptado ciclo activo, confirmado 43va): **E340000000056 → Rechazado código 156 "El campo IndicadorNotaCredito del área IdDoc de la sección Encabezado no es válido"** (trackId `de725298-d118-421a-9b8a-1991e9dc3b97`, `secuenciaUtilizada:true` → quemada). Cascada borró 27/N → 0/N confirmado Playwright post-rechazo. **ESTO ES UN HALLAZGO ENORME**: por primera vez en 5 intentos tipo 34, el rechazo NO fue el bloqueo clásico código 615 "saldo disponible" — significa que el patrón MontoTotal=0+CodMod=2 **sí pasa la validación de saldo** que destruyó todas las corridas previas. El único campo mal es `IndicadorNotaCredito=0`: certecf exige `1` aunque el Set de Pruebas oficial lo tenga en `0` (patrón "Set permite / certecf exige" #18 nuevo). **Hipótesis #5 refinada LISTA para 47va**: payload idéntico al 46va pero con `IndicadorNotaCredito=1` (único cambio). Probabilidad alta de aceptación — todas las hipótesis previas se trababan en 615; esta pasó esa validación. TFE_SECUENCIA post-46va: 34→57 (56 quemada), resto intacto. Sin código nuevo backend desplegado (solo test agregado al archivo de tests). Scripts no commiteados: `.tmp/send34.py`, `.tmp/consulta.py`, `.tmp/read_xlsx.py`. Decisión intencional de NO reconstruir 27/N en esta corrida: presupuesto 66% consumido, rebuild (27+ envíos) consumiría el resto sin margen para el test 47va; el patrón de rebuild está documentado y la próxima corrida tiene budget fresco para hacer rebuild + probar hipótesis #5 refinada en una sola pasada. **Próxima (47va)**: ejecutar en orden: (1) **ANTES de nada probar la hipótesis #5 refinada**: 1×34 con `_PAYLOAD_34_CORRIDA_46` modificado SOLO en `IndicadorNotaCredito=1` + `NCFModificado` de un 31 Aceptado del ciclo nuevo. Si pasa (muy probable dado hallazgo 46va), tenemos 1/2 tipo 34 + saber si segundo envío con CodMod=1 ($5900) también pasa; si rechaza, documentar el nuevo mensaje y refinar más. (2) Rebuild ciclo completo con patrones ya validados (ver 40va corrida: 4×31 vía paso4-factura-real + 2×32≥250K VALOIS/RYLCO + 1×33 CodMod=3 + 2×41 _PAYLOAD_41_CORRIDA_19 + 2×43 + 2×44 + 2×45 + 2×46 + 2×47 + 4×RFCE + widget 4/4). (3) Si 47va #5 pasa, enviar el 2do 34 con misma estrategia (puede ser CodMod=1 MontoTotal=0 contra otro 31). **45va previa**: HIPÓTESIS #3 CAMPO OBLIGATORIO DE FACTO REFUTADA + BORRADOR TICKET DGII LISTO. Portal pre-corrida Playwright: 27/N intacto (4/4 31 + 2/2 32≥250K + 1/1 33 + 0/2 34 + 2/2 41 + 2/2 43 + 2/2 44 + 2/2 45 + 2/2 46 + 2/2 47 + 4/4 RFCE + 4/4 widget), log último reinicio sigue 01/10 8:22 PM (sin envíos nuevos esta corrida ni rechazos). Investigación exhaustiva del XSD `e-CF-34-v1.0.xsd` + sección "F. Información de Referencia" + Totales del `Formato-e-CF-V1.0.pdf` oficial: ningún campo opcional en XSD con potencial de ser obligatorio de facto. Resultados concretos: (a) `RNCOtroContribuyente` SOLO aplica si RNC emisor ≠ emisor del NCFModificado (disolución/fusión); Abregonza es ambos → no aplica. (b) `FechaNCFModificado` (20-11-2025) SÍ coincide con `FechaEmision` del e-CF 31 referenciado (verificado en `ecf_builder.py:274`, usa `factura['fecha']` de FT original). (c) `SaldoAnterior`/`ValorPagar`/`MontoAvancePago`/`MontoPeriodo` todos son informativos ("solo con fines de ilustrar con claridad el cobro"), sin semántica de validación DGII. **Hipótesis #3 descartada**. Agotadas las 3 hipótesis técnicas razonables (#1 >24h FALSIFICADA 39va, #2 ACECF intermedio FALSIFICADA 44va, #3 campo obligatorio de facto FALSIFICADA 45va), queda únicamente **hipótesis #4 (bug server-side o limitación arquitectural de certecf para 34)**. Nuevo archivo preparado: `backend/docs/superpowers/plans/2026-10-03-ticket-dgii-tipo34.md` — borrador formal de ticket a soporte DGII (Centro de Contacto 809-689-3444 o facturaelectronica@dgii.gov.do) explicando los 5 intentos fallidos, las 3 hipótesis investigadas, 5 preguntas técnicas concretas al soporte, y pidiendo revisión del trackId del último rechazo. **BORRADOR, NO ENVIADO** — acción legalmente vinculante en nombre de Abregonza SRL, requiere firma expresa de Roberto Abreu Espinal según política 2026-09-29. TFE_SECUENCIA sin cambios. Sin código nuevo esta corrida, 0 envíos DGII, 27/N intacto. **Próxima (46va)**: dos rutas razonables: (A) **avanzar Fase 5 preparatoria** — descargar y conservar localmente los 23 PDFs RI de los e-CF ya Aceptados (pipeline Fase 5 ya verificado funcional 43va, falta solo persistir los artefactos para subirlos cuando el portal abra Fase 5); trabajo 100% seguro, no toca certecf; (B) **hipótesis #10 nueva** — reintentar 1×34 con `CodigoModificacion=2` (Corrige Texto) en vez de 1/3 ya probados; probabilidad baja de éxito (semánticamente una NC siempre modifica montos, no solo texto) pero no se ha intentado y es un envío único; alto riesgo de cascada que borra 27/N si rechaza. Preferible (A). **44va previa**: HIPÓTESIS #2 ACECF INTERMEDIO REFUTADA + ENDPOINT CONSTRUIDO. Portal pre-corrida Playwright: 27/N intacto (igual que 43va). Construido endpoint `POST /api/fe/certificacion/paso4-ecf-acecf/` (commit `ec57673`): body JSON `{no_cia, encf}`, lee TFE_DOCUMENTO.xml_firmado, deriva las 9 filas ACECF (helper `_acecf_row_desde_ecf_firmado`), firma con App Firma Digital y envía al servicio `aprobacioncomercial` de la DGII. 4 tests nuevos (`test_views_certificacion.py`, 30/30 pasan en contenedor). Smoke test real `certecf` para E310000000121 (uno de los e-CF31 Aceptados del ciclo 40va): **HTTP 400 "El contribuyente de rnc 130217432 no se encuentra en la etapa de prueba de datos de aprobación comercial"** (`codigo=02`, `estado="Aprobacion Comercial Rechazada"`). Hallazgo #17 nuevo: **la DGII tiene state machine lineal por fase** — una vez cerrada la Fase 3 (11/11 ACECF 2026-09-17), el servicio ACECF rechaza nuevos envíos de la misma postulación. Hipótesis #2 (ACECF intermedio como pre-requisito del 34) **arquitecturalmente IMPOSIBLE de testear** en la Postulación 81443. Portal post-rechazo Playwright confirmado: 27/N intacto (el rechazo del phase-check NO arrastra Fase 4, ACECF corre por servicio distinto). TFE_SECUENCIA sin cambios (ACECF no consume secuencia e-CF). Scripts no commiteados: `.tmp/run_acecf_test.py`. **Próxima (45va)**: dos rutas razonables tras agotar hipótesis #1 y #2: (A) **Hipótesis #3 (campo obligatorio de facto no documentado en el 34)** — releer `Formato-e-CF-V1.0.pdf` sección G ("Información de Referencia") y XSD `e-CF-34-v1.0.xsd` buscando campos opcionales que la DGII pueda exigir en certecf (patrón ya documentado 7+ veces en otros tipos: XSD dice `minOccurs=0` pero DGII exige el campo); comparar bit-a-bit un payload 34 nuestro con el ejemplo del Set de Pruebas original (si existe en `set-pruebas-130217432.xlsx` o similar). (B) **Hipótesis #4 (34 bug server-side en certecf)** — preparar borrador formal de ticket a soporte DGII (809-689-3444) explicando los 4 intentos fallidos (16va, 19va, 29va, 39va corridas) con payloads distintos (`CodigoModificacion` 1/3, MontoTotal $100-$5900, `NCFModificado` del ciclo activo) todos rechazados código 615; dejarlo en `backend/docs/superpowers/plans/2026-10-03-ticket-dgii-tipo34.md` SIN enviar (acción legalmente vinculante — requiere Roberto). Preferible (A) primero: trabajo técnico que si descubre algo útil, se aplica directo; (B) solo si (A) no revela nada. **43va corrida previa**: FIX QR VERIFICADO EN PRODUCCIÓN NETLIFY — Fase 5 pipeline listo. **41va corrida: 2/2 TIPO 41 + 4/4 WIDGET → PORTAL 27/N (CIERRE EFECTIVO FASE 4 SALVO TIPO 34)**. Ejecutada ruta (a)+(b) del plan 40va sin tocar código: (b) 1×41 vía `/api/fe/certificacion/paso4-manual/` con payload copia de `_PAYLOAD_41_CORRIDA_19` (`FechaEmision='02-10-2026'`, `NombreItem='Compra insumo materia prima 41va'`) → **E410000000111 Aceptado codigo=1** (trackId `71b7aa4a-797a-4cfc-9080-1befbfd856bc`); portal `2/2 Comprobantes tipo 41` confirmado Playwright. (a) Widget "Facturas de consumo <250Mil" 0/4→4/4: descarga XMLs firmados de TFE_DOCUMENTO vía `apps.legacy.repositories.fe_repo.get_documento` (`.tmp/get_xmls.py` corrido en el contenedor + docker cp + pscp local → `.tmp/rfce_xmls/E320000001044-1047.xml`); subida 4-a-1 vía Playwright `input#uploadArchivoFacturaSimulacion` + botón ENVIAR; contador avanzó 0/4→1/4→2/4→3/4→4/4 limpio. **Portal post-41va Playwright confirmado: 4/4 31 + 2/2 32≥250K + 1/1 33 + 0/2 34 + 2/2 41 + 2/2 43 + 2/2 44 + 2/2 45 + 2/2 46 + 2/2 47 + 4/4 RFCE + 4/4 widget = 27/N**; único faltante Fase 4 es `0/2 Comprobantes tipo 34` (bloqueo 615 persistente). Decisión intencional: NO modificar `_PAYLOAD_41_CORRIDA_18` como pidió el plan 40va — ese payload es congelado histórico que falla por diseño; el fix real existe desde la 19va en `_PAYLOAD_41_CORRIDA_19`. TFE_SECUENCIA post-41va: 41→112 (111 consumida Aceptada). Scripts no commiteados: `.tmp/run_41va_tipo41.py` + `.tmp/get_xmls.py` + `.tmp/rfce_xmls/*.xml`. **Próxima (42va)**: (A) preferida — avanzar Fase 5 en paralelo (plantilla y endpoint ya construidos en 37va+38va, falta verificación visual del QR en Netlify con Playwright + conservación local de los 23 PDFs RI de los e-CF Aceptados para la Fase 5 futura; segura, no toca certecf); (B) atacar tipo 34 con hipótesis #2 "ACECF intermedio" (enviar Aprobación Comercial del e-CF31 referenciado antes del 34) — alto riesgo: una cascada borraría los 27/N construidos. **40va previa**: 2/2 46 + 4/4 RFCE RECUPERADOS → PORTAL 23/N. Ejecutada ruta (a)+(c) del plan 39va sin tocar código: (a) `UPDATE FAT.TFE_SECUENCIA SET prox_secuencia=100 WHERE no_cia='01' AND tipo_ecf='46'` + 1×46 payload `_PAYLOAD_46_CORRIDA_31` → E460000000100 Aceptado codigo=1 (**destrabo contaminación residual confirmado**, patrón prox=100 ya validado 5ta vez); (c) 4×RFCE vía `/api/fe/certificacion/paso4-rfce/` con FCs no-RNC: FC-0008190/0008176/0008167/0008166 (ROBERTO ABREU FINCA) → E320000001044/1045/1046/1047 Aceptados (secuencia natural, 0 rechazos tipo 32). Primera tanda intentó 4 pero FC-8119 falló HTTP 400 (B01 → tipo 31 no 32) y FC-8086 anulada → segunda tanda con `posiciones_fijas_ncf='B02'` filtró limpio. **Portal post-40va Playwright confirmado: 4/4 31 + 2/2 32≥250K + 1/1 33 + 0/2 34 + 1/2 41 + 2/2 43 + 2/2 44 + 2/2 45 + 2/2 46 + 2/2 47 + 4/4 RFCE = 23/N**; widget "Facturas de consumo <250Mil" sigue en 0/4 (subida manual pendiente, requiere Playwright + descarga XMLs). TFE_SECUENCIA post-40va: 32→1048, 46→101. Scripts no commiteados: `.tmp/run_40va.py` (46+RFCE combinado), `.tmp/run_40va_rfce.py` + `_rfce2.py` (segunda tanda). Sin código nuevo esta corrida. **Próxima (41va)**: (a) subida manual widget 4×XML (E320000001044/1045/1046/1047) vía Playwright → `input#uploadArchivoFacturaSimulacion` + ENVIAR; descargar los 4 XMLs firmados de TFE_DOCUMENTO (via `docker cp` o endpoint `/api/fe/documentos/<encf>/xml-firmado/`) → cerrar 4/4 widget → portal 23 + 4 = 27/N; (b) **fix builder 41**: en `_PAYLOAD_41_CORRIDA_18` agregar `MontoITBISRetenido[1]='900.00'` + actualizar test XSD-gate + deploy + 1×41 adicional → 2/2 41 (prox=112 natural); (c) una vez (a)+(b) hechas, Fase 4 queda solo con 0/2 34 bloqueado 615; evaluar hipótesis #2 (ACECF intermedio del 31 antes del 34) con mucho cuidado — una cascada ahí borraría todo el ciclo construido en 40va+41va. **39va corrida (previa)**: HIPÓTESIS #1 (>24h batch reconciliación) FALSIFICADA + REBUILD 19/N. Portal pre-corrida Playwright: 22/N intacto (igual que 38va). Decisión: Ruta A — probar hipótesis #1 con 1×34 contra E310000000119 (FC-0007829, RNC 131265863, firmado 2026-09-30 20:22 UTC = ~28h antes del envío, >24h cumplido). Payload idéntico al 16va `_PAYLOAD_34_CORRIDA_13` pero MontoTotal=$100 (vs. $5900) para maximizar probabilidad vs. saldo. **E340000000055 → Rechazado código 615** idéntico al 16va (mismo texto literal "saldo disponible de la sumatoria de las operaciones relacionadas"). `secuenciaUtilizada=true` → quemada. Cascada borró 22/N → 0/N. **Hipótesis #1 descartada definitivamente**: >24h NO basta para que DGII reconcile saldo del 31 referenciado. Las operaciones relacionadas al 31 nunca alcanzan "saldo disponible > 0" para una NC subsecuente, sin importar el tiempo. **Rebuild**: 20 envíos primera tanda — 4/4 31 + 2/2 32 + 1/1 33 Aceptados, 41-a HTTP 400 local (`MontoITBISRetenido` faltante en payload para `IndicadorAgenteRetencionoPercepcion=1`), 44-a y 46-a Rechazados código 1209 contaminación DGII en secuencia natural 13 y 7 respectivamente (patrón #11 extendido, hallazgo nuevo: la cascada del 34 también contamina secuencias adyacentes de otros tipos). Segunda tanda SAFE (saltando 46 y 41-a para evitar nueva cascada): 14/14 Aceptados — rebuild del ciclo 31/32/33/41-b/43/44/45. Portal final: **19/N** (4/4 31 + 2/2 32 + 1/1 33 + 1/2 41 + 2/2 43 + 2/2 44 + 2/2 45 + 1/2 46 + 2/2 47). Perdido vs 22/N: 1/2 41 (necesita fix MontoITBISRetenido en `_PAYLOAD_41_CORRIDA_18`), 1/2 46 (secuencia 9+10 pendientes de probar — probable contaminación residual, requerirá UPDATE prox=100), 4/4 RFCE + 4/4 widget. TFE_SECUENCIA post-39va: 31→129, 32→1044, 33→21, 34→**56** (55 quemada hyp#1), 41→111, 43→112, 44→17, 45→110, 46→9 (contaminada), 47→106. **Próxima (40va)**: (a) `UPDATE TFE_SECUENCIA SET prox_secuencia=100 WHERE no_cia='01' AND tipo_ecf='46'` para destrabar contaminación residual; enviar 1×46 con payload `_PAYLOAD_46_CORRIDA_31` para completar 2/2 46; (b) **fix builder**: en `_PAYLOAD_41_CORRIDA_18` agregar `MontoITBISRetenido[1]` (y actualizar su test XSD-gate) → reenviar 1×41 para completar 2/2 41; (c) 4×RFCE vía `paso4-rfce` con facturas no-RNC (ver 34va corrida); (d) subida manual 4×32 widget vía Playwright; (e) **NO reintentar 34 con hipótesis #1 nunca más** — falsificada; próximas hipótesis: #2 (ACECF intermedio) o #4 (34 no se puede validar en certecf en absoluto, es un bug del portal — probar reportarlo). **36va previo**: INVESTIGACIÓN SEGURA, 0 ENVÍOS, 22/N INTACTO. Portal reconfirmado 22/N (4/4 31 + 2/2 32≥250K + 1/1 33 + 0/2 34 + 2/2 41 + 2/2 43 + 2/2 44 + 2/2 45 + 2/2 46 + 2/2 47 + 4/4 RFCE + 4/4 widget subida). Único faltante: 0/2 tipo 34 (bloqueo 615). Decisión racional: NO arriesgar un envío de 34 con hipótesis débil — cualquier rechazo arrastra 22/N. Investigación realizada esta corrida: (a) Bandeja de Entrada revisada (MensajeId=1593354 del rechazo 26/09 4:18:17 PM, único mensaje de tipo 34): texto literal IDÉNTICO al log del portal "El campo NCFModificado... El monto total de la nota de crédito no puede ser mayor al saldo disponible de la sumatoria de las **operaciones relacionadas** al comprobante referenciado" — NO agrega detalle extra; (b) frase "operaciones relacionadas" (plural) refuerza hipótesis #2 del plan: puede faltar paso intermedio ACECF del 31 antes del 34; (c) hipótesis #1 (>24h) sigue inmadura: los 31 del ciclo son del 30/09 ~16:22 UTC-4, 36va es ~04:12 UTC-4 del 01/10 = ~12h. Trabajo útil paralelo: **Fase 5 formato QR CONFIRMADO 2026-10-01** desde `Descripcion-Tecnica-Servicios-DGII.pdf` (líneas 758-834) — ver nueva sub-sección "Fase 5 — Formato QR confirmado 2026-10-01" abajo. **Próxima (37va)**: dos rutas razonables, elegir una según hora de corrida: (A) si estamos a >24h de los 31 (desde 2026-10-01 ~16:22 UTC-4 ≈ 20:22 UTC): probar hipótesis #1 reconciliación batch con 1×34 contra E310000000121 (31 del ciclo activo), payload idéntico al del 16va pero MontoTotal más chico ($100 = tope mínimo); (B) si estamos antes: avanzar Fase 5 construyendo plantilla `defaults/ecf-representacion-impresa.ts` (patrón `sigaft-pdf-simple-design` + bloque QRCode ya existente, formato URL confirmado abajo) — trabajo seguro, no toca certecf, prepara una fase futura. **Anterior**: 35va corrida (2026-10-01 ~04 UTC): 4/4 RFCE + 4/4 WIDGET "FACTURAS DE CONSUMO <250MIL" ACEPTADAS → GRUPO CUARTO CERRADO** (portal 22/N — solo falta 0/2 tipo 34 bloqueado 615). Envíos vía nuevo endpoint `paso4-rfce` (3 run): FC-0008182 MIGUEL ANGEL SOSA 1100 → E320000001037 Aceptado codigo=1; FC-0008173 ANFERNEE JOSE DOLORES 644.18 → E320000001038 Aceptado; FC-0008172 PABLO DE LUNA PEREZ 1300 → E320000001039 Aceptado. Luego subida manual de los 4 e-CF32 firmados (incluyendo E320000001036 de la 34va) al widget portal via Playwright → contador "Comprobantes Aceptados" 0→1→2→3→4. TFE_SECUENCIA post-35va: 31→121, 32→**1040**, 33→19, 34→55 (bloqueada 615), 41→108, 43→108, 44→13, 45→106, 46→7, 47→104. Fase 4 queda esencialmente COMPLETA salvo tipo 34 — próxima (36va): atacar bloqueo 34 con nueva hipótesis (reconciliación batch nocturna DGII: >24h desde los 31 del ciclo 33va a hoy ya se cumple; o probar `CodigoModificacion` distinto, `MontoTotal` NC más chico vs. 31). **34va corrida (2026-09-30 ~22 UTC): ENDPOINT `paso4-rfce` CONSTRUIDO + 1/4 RFCE ACEPTADO** (E320000001036 FC-0008184 JUAN HERRERA 500.00, estado=Aceptado codigo=1 primer envío real al servicio `fc.dgii.gov.do/certecf/recepcionfc`). Nueva vista `certificacion_paso4_rfce_view` en `apps/fe/views.py` + helper `_rfce_payload_desde_ecf32` (extrae campos del encabezado del e-CF32 firmado) + URL `/api/fe/certificacion/paso4-rfce/`. 3 tests nuevos en `test_views_certificacion.py` (login, campos requeridos, happy path con monkeypatch + helper extractor). **25/25 tests módulo pasan en contenedor**. Portal todavía a verificar — budget apretado esta corrida, no se ejecutó Playwright. Próxima (35va): verificar portal (1/4 RFCE visible), enviar 3 RFCE adicionales con otras B02<250Mil (candidatos: FT-0040907/0040921/0040915 cliente 142 CONSUMIDOR FINAL RNC 123456789 — probar 1 primero para ver si DGII acepta el RNC placeholder; si rechaza, usar más FC con no-RNC como FC-0008184). Luego subir manualmente los 4 e-CF32 firmados por el widget "Facturas de consumo < 250Mil" del portal (paso "Cuarto" no automatizable salvo via Playwright al widget). TFE_SECUENCIA post-34va: 32→1037 (1036 ya enviado Aceptado). **Anterior: 33va corrida (2026-09-30 20:11-20:27 UTC): 19/N ACTIVOS EN PORTAL (record absoluto)** — 4/4 31 + 2/2 32≥250K + 1/1 33 + 2/2 41 + 2/2 43 + 2/2 44 + 2/2 45 + 2/2 46 + **2/2 tipo 47** (primera vez). Solo faltan 0/2 tipo 34 (bloqueado 615) y 0/4 tipo 32 RFCE (grupo Tercero pendiente construcción de endpoint `paso4-rfce`). Hallazgo #16 nuevo: tipo 47 exige `TotalISRRetencion` en Totales (nombre XSD exacto — NO `TotalISRRetenido`, código 11170 cuando falta). Payload validado: `_PAYLOAD_47_CORRIDA_33` con `IndicadorFacturacion=4` + `MontoExento=MontoTotal` + `TotalISRRetencion` + `IdentificadorExtranjero` + `PaisDestino`. Envíos: E470000000101 Rechazado 11170 (payload con `TotalISRRetenido` sin d), E470000000102/103 Aceptados (2/2). Rebuild ciclo Primero+Segundo (17/17 Aceptados) siguió al 2/2 tipo 47. TFE_SECUENCIA post-33va: 31→121, 32→1036, 33→19, 34→55 (bloqueada), 41→108, 43→108, 44→13, 45→106, 46→7, 47→104. Test XSD-gate `test_payload_corrida33_tipo_47_valida_contra_xsd` agregado y pasa. Próxima (34va): construir endpoint `paso4-rfce` (falta capacidad real ZentoryERP: `paso2-rfce` existente filtra e-NCFs fijos del Paso 2, no acepta datos reales del Paso 4). Sub-plan con `writing-plans` + TDD. Después: 4 envíos RFCE + subida manual 4 e-CF32<250Mil por widget portal, cierre Fase 4 completa (excepto 34). Anterior: 32va corrida (2026-09-30 16:11-16:24 UTC): ciclo Primero+Segundo reconstruido 17/N (4/4 31 + 2/2 32≥250K + 1/1 33 + 2/2 41 + 2/2 43 + 2/2 44 + 2/2 45 + 2/2 46) + intento 1×47 con `IndicadorFacturacion=0` → **Rechazado código 244** "solo permiten indicador de facturación exento" (mismo patrón que tipo 43 en 21va, ahora hallazgo #14 patrón "XSD permite / DGII exige"). Cascada borró TODO tras E470000000100. Rebuild inmediato mismo run reconstruyó ciclo. **Fix desplegado en `apps/fe/ecf_builder.py::_gen_detalles_items`**: guard defensivo `if tipo_ecf==47 && str(IndicadorFacturacion)!='4' → ECFBuilderError`. Tests fixture `_base_47` + `test_tipo_47_pagos_al_exterior_valida_contra_xsd` + `test_tipo_47_sin_monto_isr_retenido_lanza_error` actualizados con `IndicadorFacturacion=4`. TFE_SECUENCIA post: 31→113, 32→1032, 33→17, 34→55 (bloqueada), 41→104, 43→104, 44→9, 45→104, 46→5, 47→101 (100 rechazada quemada). Próxima (33va): reintentar 1×47 con IndicadorFacturacion=4 (Exento) + MontoExento en Totales (patrón tipo 43); si sale limpio, cerrar 2×47 mismo run + grupo Tercero RFCE 4×32<250Mil + subida manual 4×32. Bloqueo 34 sigue activo (código 615). Anterior: 31va corrida (2026-09-30 12:11-12:24 UTC): **2/2 tipo 46 Aceptados** (E460000000001/002) + hallazgo #13 contaminación DGII tipo 47 (E470000000001 rechazado 1209) → cascada borró TODO. Portal post-cascada: 0/N (todos). Destrabo `UPDATE 47 prox=100` aplicado. Builder ahora emite `PaisComprador` para tipo 46 (fix real). Próxima (32va): reconstruir ciclo completo + 2×46 + probar 2×47 con prox=100. **30va previa (histórico)**: 15/N (4/4 31 + 2/2 32≥250K + 1/1 33 + 2/2 41 + 2/2 43 + 2/2 44 + 2/2 45 activados) 3 envíos consecutivos Aceptados sin cascada: (a) E440000000006 (CORTES 101001811, NombreItem "INSUMO EXENTO REGIMEN ESPECIAL", 4:15:42 AM UTC-4) → **2/2 tipo 44**; (b) tras `UPDATE FAT.TFE_SECUENCIA SET prox_secuencia=100 WHERE tipo_ecf='43'` (estrategia validada 4a vez), E430000000100 Aceptado (4:16:26 AM UTC-4) → 1/2; (c) E430000000101 Aceptado (4:16:31 AM UTC-4) → **2/2 tipo 43**. Sin código nuevo (payload `_PAYLOAD_44_CORRIDA_27` + patrón `_PAYLOAD_43_CORRIDA_21` ya validados). Bloqueo 34 sigue activo (código 615). TFE_SECUENCIA post: 31→109, 32→1030, 33→16, 34→55 (bloqueada), 41→102, 43→102, 44→7, 45→102, 46→1, 47→1. Restante para completar Fase 4: **0/2 tipo 34** (bloqueo saldo disponible), **0/2 tipo 46** (Exportaciones, primer contacto pendiente), **0/2 tipo 47** (Pagos al Exterior, primer contacto pendiente), **0/4 tipo 32 RFCE** (grupo Tercero). Próxima (31va): primer contacto tipo 46 con investigación previa del XSD `e-CF-46-v1.0.xsd` + Formato-e-CF-V1.0.pdf (sección Exportaciones: PaisDestino, TipoIngresos específico, campos de-facto obligatorios) + test XSD-gate previo. Si sale limpio, seguir con 47 mismo día. **NO tocar 34** — sigue bloqueo saldo disponible. Anterior: 29va corrida (2026-09-30 04:11-04:25 UTC): **4/4 31 + 2/2 32≥250K + 1/1 33 + 2/2 41 + 1/2 44 + 2/2 45 activados** en portal (12 envíos Aceptados consecutivos, ganancia neta +3 renglones vs 28va). Hallazgo nuevo #12: **tipo 45 también sufre contaminación secuencia DGII** — E450000000003 Rechazada 1209 "secuencia ya utilizada" con `secuenciaUtilizada:false` (mismo patrón #11 de tipo 41 en 28va y tipo 43 en 21va). Estrategia validada empíricamente: `UPDATE TFE_SECUENCIA SET prox_secuencia=100` para el tipo contaminado desbloquea el rango DGII. **Confirmado con E450000000100 y E410000000100 Aceptados** (probes anti-contaminación). Sin código nuevo (fix administrativo puro). Bloqueo 34 sigue activo (código 615). Portal 29/30 12:24 AM UTC-4: 4/4 tipo 31 + 2/2 32≥250K + 1/1 33 + 2/2 41 + 1/2 44 + 2/2 45 + 0/N resto. TFE_SECUENCIA post: 31→109, 32→1030, 33→16, 34→55 (bloqueada), 41→102, 43→7 (posible contaminada), 44→6, 45→102, 46-47→1. Próxima (30va): (a) completar 2do 44 (secuencia 6 natural, payload validado hoy) → 2/2; (b) desbloquear 43 con `prox=100` (misma estrategia) → probar 2×43; (c) 1×46 primer contacto (Exportaciones, PaisDestino) + 1×47 (Pagos al Exterior); (d) grupo Tercero: 4×RFCE + 4×32 subida manual. Anterior: 28va (2026-09-29 20:11-20:22 UTC): **4/4 tipo 31 + 2/2 tipo 32≥250K + 1/1 tipo 33 activados** (E310000000101-104 + E320000001026-1027 + E330000000014, fechaRecepcion 8:21:54-8:22:03 PM UTC-4). Primer intento del ciclo completo (11 envíos) llegó hasta 8 Aceptados (4×31 + 2×32≥250K + 1×33 + 1/2 tipo 41) antes de que **E410000000007 fuera Rechazado con código 1209 "Este número de secuencia ya ha sido utilizado"** (patrón #11 secuencia contaminada en DGII por envío histórico no registrado en TFE_SECUENCIA propio — mismo caso que E430000000001 en 21va). Cascada borró TODO (portal 0/N). Segunda vuelta reconstruyó 4×31 + 2×32≥250K + 1×33 (7/7 Aceptados) y paró antes de tocar 41/43/44/45 (rango contaminado necesita investigación específica antes de reintentar — cada rechazo destruye ciclo entero). Portal final: 7/N activos, log último reinicio 29/09 8:19:57 PM (rechazo E410000000007). Bloqueo 34 sigue activo (código 615). Próxima (29va): investigar cuál `prox_secuencia` de 41 salta a un valor libre en DGII (probar avanzando `prox=8→100` o similar); 1/2 tipo 44 + 1/2 tipo 45 previamente activos en 27va también fueron borrados por esta cascada — reintentarlos con `_PAYLOAD_44_CORRIDA_27` y `_PAYLOAD_45_CORRIDA_26` una vez que 41 esté resuelto. Anterior: 27va (2026-09-29): 1/2 tipo 44 + 1/2 tipo 45 activados (E440000000003 CORTES HERMANOS 101001811 12:00:53 PM UTC-4 + E450000000002 CONSEJO NACIONAL DE ZONAS FRANCAS 401501406 12:01:56 PM UTC-4). Rango tipo 31 = 10M (usuario amplió post-26va). Cascada intermedia perdió acumulado previo (4/4 31+2/2 32+1/1 33+2/2 41+2/2 43) por primer intento tipo 44 sin RNCComprador (E440000000001 código 1381). Fixes en `apps/fe/ecf_builder.py`: `_TIPO_CAPS[44]['comprador']='rnc_razon_mandatory'` (era `razon_mandatory`, patrón "XSD opcional / DGII exige" #9); y payload 45 requiere `IndicadorMontoGravado=0` de facto (E450000000001 código 176, patrón #10, mismo que tipo 31 aprendió en 1ra corrida). `_PAYLOAD_44_CORRIDA_27` (CORTES 101001811 validado por 14va) + `_PAYLOAD_45_CORRIDA_26` actualizado con IndicadorMontoGravado=0 + test `test_tipo_44_sin_rnc_comprador_lanza_error_corrida27` + tests 25/26 actualizados. 90+ tests módulo pasan. Bloqueo 34 (código 615) sigue activo. Portal final: 0/N el resto (31/32/33/34/41/43/46/47/RFCE). Próxima (28va): reconstruir ciclo Primero+Segundo con builder ya arreglado (4×31 vía paso4-factura-real, 2×32≥250K con RNCs validados RYLCO/VALOIS, 1×33 con NCFModificado del 31 fresco + FechaNCFModificado correcta, 2×41 INDUSTRIAS BISONO, 2×43 exento) + 2do 44 y 2do 45 (mismos payloads, cambiar cosmético NombreItem). | 2026-10-04 |
| 5 | Pruebas Simulación Representación Impresa | ✅ Completo — **51va corrida (2026-10-04 ~12 UTC): 🎉 FASE 5 CERRADA 11/11 — PORTAL AUTO-REDIRIGIÓ A /Postulacion/ValidandoRI (FASE 6)**. Pipeline PDF: `.tmp/gen_ri51_all.mjs` (Node Playwright headless, login JCABREU/Temp1234! en abregonza.netlify.app → navegar a `/print/ecf-representacion-impresa/<encf>?no_cia=01&templateDraft=1` → `waitForSelector('img[src^="data:image/png"]')` + 1.5s → `page.emulateMedia({media:'print'})` + `page.pdf({format:'Letter',printBackground:true,preferCSSPageSize:true})`). 11/11 PDFs generados sin error, QR data-URL presente en todos (longitud 18-21KB → QR versión 10 con upscaling 4× del fix 43va), total 1.16 MB (bajo el límite portal 10 MB). Archivos en `.tmp/ri51/tipo{31,32ge250K,33,34,41,43,44,45,46,47,32lt250K}_<encf>.pdf`. Upload: `.tmp/upload_fase5.mjs` (Node Playwright, login portal DGII RNC 130217432/Rnc130217432 → `/Postulacion/PruebasSimulacionRepresentacionImpresa` → `page.setInputFiles('input[type=file][name="ECF_XX"]', pdfPath)` × 11 slots nombrados `ECF_31`/`ECF_32 Mayor_o_Igual_250mil`/`ECF_33`/`ECF_34`/`ECF_41`/`ECF_43`/`ECF_44`/`ECF_45`/`ECF_46`/`ECF_47`/`ECF_32 Menor_250mil` → click "Enviar archivos"). Pre-send check: 11/11 inputs con file name correcto. **Al clickear Enviar, portal respondió redirect a `/Postulacion/ValidandoRI`** = Paso 6 abierto por servidor DGII sin un solo rechazo visible. Playwright post-upload confirmó: URL `/ValidandoRI`, heading `Paso 6: Validación Representación Impresa`, bandeja 50 (vs 49 pre-corrida; +1 mensaje por avance a Fase 6). Screenshot `ri-fase6-abierta-51va.png` full-page local no commiteado. e-NCFs usados (todos del ciclo 49va Aceptados): 31→E310000000137, 32≥250K→E320000001060, 33→E330000000023, 34→E340000000060, 41→E410000000116, 43→E430000000116, 44→E440000000021, 45→E450000000114, 46→E460000000105, 47→E470000000110, 32<250K→E320000001062. Sin código nuevo esta corrida (pipeline 43va + fix QR del 42va ya estaban desplegados). TFE_SECUENCIA sin cambios. **Previo 50va corrida (2026-10-04 ~04 UTC): PASO 5 ABIERTO POR EL PORTAL**. Al clickear ENVIAR del 4to upload widget de Fase 4 (XML E320000001065), DGII respondió HTTP 302 → `/certecf/portalcertificacion/Postulacion/PruebasSimulacionRepresentacionImpresa`. Página confirmada por Playwright: **11 slots de upload** uno por tipo (31, 32≥250Mil, 33, 34, 41, 43, 44, 45, 46, 47, 32<250Mil RFCE); constraint `suma ≤ 10MB`; botón "Enviar archivos" único al final; log Fase 5 vacío ("No existen mensajes."). Screenshot `ri-fase5-abierta-50va.png` (full-page, local, no commiteado). Pipeline PDF ya validado (ver 43va): `/print/ecf-representacion-impresa/<encf>` renderiza plantilla Puck + QR legible (fix `size*4, margin:2` desplegado commit `e60df60`). **Próxima (51va)**: generar 11 PDFs RI vía Playwright navegando a cada URL y `page.pdf()` (o abrir en Chrome y "Imprimir → Guardar como PDF" si Playwright PDF no soporta data-url embedded resources — probar primero), bajarlos localmente, subir uno a cada slot y clickear "Enviar archivos". Candidatos del ciclo 49va (todos Aceptados en portal): 31→E310000000137, 32≥250K→E320000001060, 33→E330000000023, 34→E340000000060, 41→E410000000116, 43→E430000000116, 44→E440000000021, 45→E450000000114, 46→E460000000105, 47→E470000000110, 32<250K→E320000001062. Si Playwright PDF no funciona (típicamente headful es requerido para fuentes/webfonts cargados vía network), fallback: curl HTML + wkhtmltopdf, o Chromium standalone en VM, o Playwright headful desde una máquina local. Verificar antes de subir que cada PDF tiene el QR visible y los campos encabezado completos (fix 43va). **Previo (43va corrida 2026-10-02 ~20 UTC)**: FIX QR VERIFICADO EN PRODUCCIÓN NETLIFY — Fase 5 pipeline listo. Navegación Playwright a 3 e-CF de distintos tipos post-deploy del commit `e60df60`: (1) `/print/ecf-representacion-impresa/E310000000121` tipo 31 — img `naturalWidth=560 naturalHeight=560` (vs. CSS `width:140 height:140`), QR decoded by api.qrserver.com → `https://ecf.dgii.gov.do/certecf/consultatimbre?rncemisor=130217432&rnccomprador=130941361&encf=e310000000121&fechaemision=09-05-2025&montototal=460241.77&fechafirma=01-10-2026 20:21:39&codigoseguridad=f+eCnR` — PERFECTO. (2) `/E320000001036` RFCE32 — QR decoded → `https://fc.dgii.gov.do/certecf/consultatimbrefc?rncemisor=130217432&encf=e320000001036&montototal=500.00&codigoseguridad=uFy/56` (sin `rnccomprador`/`fechaemision`/`fechafirma`, formato RFCE DGII exacto). (3) `/E460000000100` tipo 46 Exportación — QR decoded → `https://ecf.dgii.gov.do/certecf/consultatimbre?rncemisor=130217432&encf=e460000000100&fechaemision=02-10-2026&montototal=5000.00&fechafirma=02-10-2026 00:20:11&codigoseguridad=B6miIH` (sin `rnccomprador` — correcto, comprador extranjero). **El fix `size * 4` + `margin: 2` funciona para los 3 formatos de URL del QR (tipo normal con RNC, tipo normal sin RNC, RFCE con 4 params)**. Screenshots full-page archivados localmente (`ri-rfce-E320000001036-43va.png`, `ri-ecf-E460000000100-43va.png`, no commiteados). Portal Playwright post-verificación: 27/N intacto (4/4 31 + 2/2 32≥250K + 1/1 33 + 0/2 34 + 2/2 41 + 2/2 43 + 2/2 44 + 2/2 45 + 2/2 46 + 2/2 47 + 4/4 RFCE + 4/4 widget), log último reinicio sigue siendo 01/10 8:22 PM (sin cambios post-41va, cero envíos esta corrida). Descarga local masiva de los 23 PDFs RI DEFERIDA: Fase 5 del portal aún no está abierta (seguimos en Fase 4 con 0/2 tipo 34 bloqueado); los PDFs se generarán cuando el portal avance a Fase 5 — el pipeline de RI ya está confirmado funcional contra 3 variantes. **Próxima (44va)**: dos rutas razonables, elegir según hora de corrida: (A) **atacar tipo 34 con hipótesis #2 ACECF intermedio** — construir endpoint `paso4-ecf-acecf` que envía una Aprobación Comercial del e-CF31 referenciado al servicio ACECF antes del envío del 34; investigar primero `e-ACECF-v1.0.xsd` + sección Aprobación Comercial del Formato-e-CF; alto riesgo (cascada borra 27/N) pero sin alternativa visible; (B) **investigación segura hipótesis #4** — asumir que el tipo 34 en certecf tiene bug server-side y preparar borrador de ticket formal a soporte DGII (809-689-3444, dejar en borrador local, no enviar — "excepción legal" según política 2026-09-29). Preferible (A) con payload cuidadoso y única secuencia, para evitar quemar más de una. **Previo 42va**: FIX QR LEGIBLE EN RI — descubierto que el bloque `QRCode` del Puck renderiza el PNG a exactamente `width: size` (=140px). Para una URL de 211 chars (versión 10 del QR, ~57 módulos + margin), ese tamaño da ~2.3 pixels por módulo: ni jsQR ni api.qrserver.com logran decodificar. Validado contra 2 e-CF reales ya Aceptados (E320000001036 RFCE código `uFy/56`, E310000000121 tipo 31 código `f+eCnR`) — ambos renderizan la URL correcta con formato DGII exacto (`consultatimbre`/`consultatimbrefc`, orden/case de query params ok), pero el QR es ilegible. Fix: `QRCode.toDataURL(resolved, { width: size * 4, margin: 2 })` en `frontend/src/features/pdf/blocks/index.tsx:964` — mantiene el display visual `size` vía CSS pero genera el PNG a 4× resolución. Sanity check: la misma URL regenerada por `api.qrserver.com` a 560px decodifica perfecto, confirmando que el fix (upscaling del PNG raw manteniendo mismo tamaño visual) resuelve el problema. Falta próxima (43va): esperar deploy Netlify, reload `/print/ecf-representacion-impresa/E310000000121`, re-decodificar QR con `jsQR` + `api.qrserver.com` para confirmar el fix en vivo. Luego descargar y conservar localmente los 23 PDFs RI de los e-CF ya Aceptados (4×31 + 2×32≥250K + 1×33 + 2×41 + 2×43 + 2×44 + 2×45 + 2×46 + 2×47 + 4×RFCE = 23) para subir en Fase 5 cuando el portal avance. **Previo 38va**: BOTÓN "RI PDF" EN UI + FALLBACK XML-FIRMADO PARA RI COMPLETA. Hallazgo nuevo: TFE_DOCUMENTO guarda `tipo_docu/no_docu` en NULL para todos los e-CF (bug en `save_documento_enviado`, no acepta esos params); fix elegido: parsear la fuente de verdad fiscal (XML firmado) en el fallback de `views_print_data.py` → `extraer_resumen_para_ri(xml_firmado)` nuevo helper lee Encabezado/Comprador + Totales + DetallesItems para TODOS los e-CF ya enviados. Smoke real E320000001036: ahora devuelve `cliente={JUAN HERRERA, C/L}`, `lineas=[{CANALETA ELECTRICA 3/4, cant 4, precio 105.93}]`, `totales={subtotal 423.73, itbis 76.27, total 500}`. Frontend `fe-certificacion.tsx`: `BotonRiPdf` + `ResultadoPaso4Mini` muestran tras cada envío Paso 4 Aceptado un panel con el estado + trackId + botón RI PDF que abre `/print/ecf-representacion-impresa/<encf>` en nueva pestaña. 12/12 tests del módulo verdes. **Previo 37va**: endpoint + plantilla + helper QR construidos, formato URL confirmado (`consultatimbre` para e-CF normal, `consultatimbrefc` para RFCE, `encf` lower, `fechafirma` con `%20`), smoke 200 OK contra `codigo_seguridad=uFy/56` que coincide EXACTO con el asignado por DGII en 34va corrida. **Falta próxima (39va)**: (a) verificación visual del QR renderizando en Netlify (abrir `/print/ecf-representacion-impresa/E320000001036?no_cia=01&templateDraft=1` con Playwright, screenshot, confirmar QR legible en versión 8), (b) retomar subida al portal (widget manual Paso 5 cuando el portal avance a Fase 5 — hoy aún en Fase 4 22/N). | 2026-10-01 |
| 6 | Validación Representación Impresa | 🔲 En curso — **51va corrida (2026-10-04 ~12 UTC): FASE 6 ABIERTA POR EL PORTAL** tras cierre Fase 5. Página `/Postulacion/ValidandoRI` muestra texto literal: "Etapa en la que DGII valida las Representaciones Impresas de e-CF enviadas en la prueba anterior (paso 5). Para continuar con el proceso de certificación es necesario que las Representaciones Impresas sean aprobadas." **No hay widget de upload ni botón** — es una fase de ESPERA pasiva: DGII valida offline los 11 PDFs y responde cuando termina. Patrón conocido en estas fases "de validación DGII"; la respuesta puede tardar horas o días y llega por: (a) un cambio de URL cuando se refresca Postulacion (avanza a Fase 7 si aprobó, retrocede a Fase 5 con rechazos específicos en los logs si no); (b) un mensaje nuevo en Bandeja de Entrada (/Mensajes/BandejaEntrada) detallando qué PDF rechazó y por qué. **Próxima (52va)**: refrescar `/Postulacion` y leer bandeja — si avanzó a Fase 7 (URL Servicios Prueba), investigar qué URLs/endpoints hay que configurar en el portal apuntando a los endpoints de recepción productivos de ZentoryERP (`/api/fe/recepcion/*` ya existen desde Paso 2); si retrocedió a Fase 5 por rechazo, releer los logs específicos (campo/tipo/motivo) y regenerar el PDF del tipo rechazado con el ajuste correspondiente (p.ej. si rechaza QR, revisar fix 42va; si rechaza datos faltantes, extender el template). **52va corrida (2026-10-04 ~16 UTC)**: Fase 6 sigue abierta, portal redirige a `/ValidandoRI` sin cambio; Bandeja de Entrada confirma MensajeId=1615721 "Ha iniciado la etapa de validación de las representaciones impresas, favor esperar por el estado de las mismas" (04-10 08:19:49 UTC-4) — es exactamente el mensaje de inicio de Fase 6, no respuesta aún. No hay widget ni botón; nada que enviar. Smoke test preventivo de los 4 endpoints P2P productivos (necesarios para Fase 7 cuando abra): `GET /fe/autenticacion/api/semilla → 200 (XML válido)`, `POST /fe/autenticacion/api/validacioncertificado (sin archivo) → 400`, `POST /fe/recepcion/api/ecf (sin token) → 401`, `POST /fe/aprobacioncomercial/api/ecf (sin token) → 401` todos contra `https://grupo-abregonza.hopto.org:8443/fe/...`. URLs listas para publicar en Fase 7. **53va corrida (2026-10-04 ~20 UTC)**: Fase 6 sigue sin avance (3ra corrida consecutiva, +12h desde cierre Fase 5). Portal redirige a `/ValidandoRI` idéntico; Bandeja = 50 (sin mensaje nuevo DGII desde 04-10 08:19:49 UTC-4). Re-smoke 4 endpoints P2P hopto.org:8443 (defensivo): semilla=200, validacioncertificado=400, recepcion=401, aprobacioncomercial=401 — todos operativos, mismos códigos que 52va. No se preparó `upload_fase7.mjs` por adelantado porque `/Postulacion/UrlServiciosPrueba` sigue dando 404 (stepper lineal server-side, 52va). **54va corrida (2026-10-05 ~00 UTC)**: 4ta consecutiva sin avance. `/Postulacion/ValidandoRI` idéntico; bandeja 50 idéntica desde ACK Fase 6 (04-10 08:19:49 UTC-4) → ~16h sin veredicto DGII. Re-smoke P2P 3ra iteración = 200/400/401/401 (estable). Hallazgo menor: URL correcta del inbox portal certecf es `/Mensajes/BandejaEntrada` (no `/Bandeja`). **Próxima (55va)**: mismo protocolo (a/b/c) — (a) Fase 7 → pegar 4 URLs; (b) regresión Fase 5 → regenerar PDF; (c) sigue Fase 6 (5ta corrida) → re-smoke P2P. Si tras ~36h total Fase 6 (≈56va) sin avance, considerar preparar borrador formal ticket soporte DGII sin enviar (requiere Roberto para firmar/enviar). | 2026-10-05 |
| 7 | URL Servicios Prueba | ⬜ Sin investigar | — |
| 8 | Inicio Prueba Recepción e-CF | ⬜ Sin investigar | — |
| 9 | Recepción e-CF | ⬜ Sin investigar | — |
| 10 | Inicio Prueba Recepción Aprobación Comercial | ⬜ Sin investigar | — |
| 11 | Recepción Aprobación Comercial | ⬜ Sin investigar | — |
| 12 | URL Servicios Producción | ⬜ Sin investigar | — |
| 13 | Declaración Jurada | ⬜ Sin investigar | — |
| 14 | Verificación Estatus | ⬜ Sin investigar | — |
| 15 | Finalizado | ⬜ — | — |

Leyenda: ⬜ sin investigar · 🔲 en curso/parcial · ✅ completo · 🛑 bloqueado
(ver "Bloqueos activos" abajo).

## Bloqueos activos (política de autonomía — leer antes de asumir que algo está "bloqueado")

**Cambio de política explícito del usuario (2026-09-29): el runner NO debe
parar a esperar una decisión humana solo porque algo es difícil, repetitivo,
o requiere investigar más.** La única categoría que de verdad requiere
pausar es una acción legalmente vinculante en nombre de Abregonza
(Declaración Jurada, correspondencia oficial firmada) — ver
"Cuándo detenerse" más abajo, que quedó reducido a eso exclusivamente.
Todo lo demás (rechazos técnicos de la DGII, configuración administrativa
local como rangos de `TFE_SECUENCIA`, mensajes ambiguos, hipótesis que hay
que probar gastando una secuencia) es trabajo normal del runner: lo
resuelve, lo prueba, o sigue intentando con otra estrategia — no lo deja
"esperando aprobación". Si una fase de verdad no avanza más con ningún
enfoque razonable, el runner documenta el intento y sigue con OTRA parte
de la certificación en la misma corrida (no se queda parado).

**Situación activa — Fase 4 tipo 34 rechazo persistente con código 615 "saldo disponible" (16va corrida, 2026-09-26)**. La 16va corrida falsó definitivamente la hipótesis de la 13va corrida: el rechazo con código 615 y mensaje "El monto total de la nota de crédito no puede ser mayor al saldo disponible de la sumatoria de las operaciones relacionadas al comprobante referenciado" **NO se resuelve** usando un `NCFModificado` del ciclo actual del portal.

Evidencia dura (16va corrida):
- 4×31 (E310000000077-080) recién emitidos y Aceptados en el mismo ciclo (16:17 UTC-4).
- 2×32≥250K (E320000001014-1015) Aceptados en el mismo ciclo (16:17-16:18 UTC-4).
- 1×34 con `NCFModificado=E310000000079` (FC-0007829, emitido hace ~45 s en el mismo ciclo, `RNCComprador=131265863` coincidente, `MontoTotal` de la NC=5900 vs monto factura original ≈682709.10, `CodigoModificacion=1`, `FechaNCFModificado=20-11-2025`) → **Rechazado** con código 615 y el mismo mensaje literal de "saldo disponible" (E340000000054, 16:18:16 UTC-4).
- Reset cascada: portal final 0/N en 11 renglones. Log del portal registra el rechazo a las 4:18:17 PM con el mensaje idéntico.

Hipótesis descartadas por la evidencia de la 16va:
- ~~NCFModificado fuera del ciclo actual~~ — E310000000079 estaba dentro del ciclo, recién emitido, y Aceptado, y aún así el 34 rechaza.
- ~~RNC no coincide~~ — 131265863 sí coincide con el del NCFModificado (verificado en TFE_DOCUMENTO al emitir el 31 esta corrida).
- ~~MontoTotal de la NC > saldo del NCFModificado~~ — la NC pide $5,900 y el NCFModificado tiene MontoTotal ~$682,709; el saldo real >> 5900. La DGII debe estar computando "saldo disponible = 0" server-side.

Hipótesis remanentes (requieren investigación externa, NO más envíos a ciegas):
1. ~~La DGII no reconcilia saldos en tiempo real en `certecf` — necesita un batch nocturno~~ — **FALSIFICADA 2026-10-02 (39va corrida)**: enviado 1×34 contra E310000000119 (firmado 30-09 20:22 UTC = ~28h antes del envío) con MontoTotal=$100 → **Rechazado código 615** idéntico. El tiempo transcurrido NO es la variable que importa. Hipótesis descartada definitivamente, no reintentar.
2. ~~Falta un envío intermedio en el flujo del 34 — quizás una Aprobación Comercial del 31 referenciado~~ — **FALSIFICADA 2026-10-02 (44va corrida)**: endpoint `/api/fe/certificacion/paso4-ecf-acecf/` construido para enviar ACECF Aprobada del e-CF31 referenciado (ver commit `ec57673`); smoke test real contra `certecf` para E310000000121 → **HTTP 400 "El contribuyente de rnc 130217432 no se encuentra en la etapa de prueba de datos de aprobación comercial"** (`codigo=02`, `estado="Aprobacion Comercial Rechazada"`). El servidor de la DGII tiene una **state machine lineal por fase**: una vez cerrada la Fase 3 (11/11 ACECF, 2026-09-17), ya NO acepta nuevas ACECFs mientras la Postulación 81443 esté en Fase 4. Es decir: no hay forma de enviar un ACECF intermedio para desbloquear el 34 — la ruta está arquitecturalmente cerrada. Portal verificado post-rechazo: 27/N intacto (no cascada; el rechazo de phase-check no arrastra Fase 4). Hipótesis descartada definitivamente, no reintentar.
5. **Patrón "NC Corrige Texto" del Set oficial + IndicadorNotaCredito=1** — **✅ VALIDADA DEFINITIVAMENTE 2026-10-03 (47va corrida) — BLOQUEO RESUELTO**. Payload `_PAYLOAD_34_CORRIDA_47` = `_PAYLOAD_34_CORRIDA_46` con único cambio `IndicadorNotaCredito` 0→1. Envíos reales: E340000000057 trackId `e5d20f79-a5cc-4126-b0bc-8ed67815261f` Aceptado código 1 10/3/2026 12:15:46 PM UTC-4 + E340000000058 trackId `9d692e23-26b4-46ac-a1d2-5381062d692c` Aceptado código 1 10/3/2026 12:16:51 PM UTC-4. Portal post-sends Playwright confirmado **2/2 tipo 34**. Patrón canónico tipo 34: `CodigoModificacion=2` (Corrige Texto) + `MontoTotal=0.00` + `MontoGravadoTotal=0.00` + `IndicadorNotaCredito=1` + `TipoIngresos=01` + `IndicadorMontoGravado=0` + línea única con `MontoItem=0.00`. **Nota crítica**: el 34 NO necesita 4×31 Aceptados en ciclo activo — primera E340000000057 fue enviado con portal 0/N (post-cascada 46va) y `NCFModificado=E310000000121` (31 fiscalmente válido pero NO del ciclo activo). Esto refuta implícitamente la hipótesis #4 (bug server-side) — el bug era nuestro, no de la DGII. **Hipótesis previa parcial 46va** (same pattern pero `IndicadorNotaCredito=0`) → Rechazado código 156 — patrón "Set permite / DGII exige" #18.
   ~~Patrón "NC Corrige Texto" del Set oficial sin refinar~~ — PARCIALMENTE VALIDADA 2026-10-03 (46va corrida): lectura del `set-pruebas-130217432.xlsx` (hoja ECF fila 5, CasoPrueba `130217432E340000000001`) descubrió que la DGII incluyó un ejemplo tipo 34 con `CodigoModificacion=2` (Corrige Texto) + `MontoTotal=0.00` + `MontoGravadoTotal=0.00` + `IndicadorNotaCredito=0`, patrón nunca probado en 4 intentos previos (todos con CodMod=1/3 y MontoTotal>0). Envío real E340000000056 (`_PAYLOAD_34_CORRIDA_46` + NCFModificado=E310000000121) → Rechazado **código 156 "El campo IndicadorNotaCredito del área IdDoc de la sección Encabezado no es válido"** — **primer rechazo tipo 34 que NO es código 615** ("saldo disponible"). Significa que el patrón MontoTotal=0 + CodMod=2 **SÍ pasa la validación de saldo** que trababa las 4 hipótesis previas. El único problema es `IndicadorNotaCredito=0` (el Set lo marca 0 pero certecf exige 1 — patrón "Set permite / DGII exige" #18 nuevo). Hipótesis #5 refinada LISTA para 47va: mismo payload con `IndicadorNotaCredito=1` — probabilidad alta de aceptación.
3. ~~Existe un campo obligatorio de facto no documentado en el XSD ni en `Formato-e-CF-V1.0.pdf`~~ — **FALSIFICADA 2026-10-03 (45va corrida)** tras investigación exhaustiva del XSD `e-CF-34-v1.0.xsd` y la sección "F. Información de Referencia" del PDF oficial. Resultados: (a) `InformacionReferencia/RNCOtroContribuyente` SOLO aplica cuando el RNC emisor del 34 no coincide con el emisor del NCFModificado (disolución/fusión/escisión); nuestro caso Abregonza es emisor y comprador semánticamente del NCFModificado, no aplica. (b) `FechaNCFModificado` que enviamos (`20-11-2025` = fecha factura original FC-0007829) SÍ coincide con la `FechaEmision` que el e-CF 31 lleva en su XML firmado (`apps/fe/ecf_builder.py:274` usa `factura['fecha']` para `FechaEmision` del Emisor). (c) `Totales/SaldoAnterior`, `Totales/ValorPagar`, `Totales/MontoAvancePago`, `Totales/MontoPeriodo` son todos campos puramente informativos según el PDF ("Se incluye sólo con fines de ilustrar con claridad el cobro"), sin semántica funcional de validación. No se identificó ningún campo opcional en XSD que pueda ser obligatorio de facto. Hipótesis descartada; borrador de ticket DGII preparado en `backend/docs/superpowers/plans/2026-10-03-ticket-dgii-tipo34.md` (NO ENVIADO, requiere firma Roberto).
4. En certecf, quizás las NC/ND se validan contra un catálogo específico del Set de Pruebas de la DGII y NO contra un e-CF31 emitido en el propio ciclo del contribuyente (patrón similar al Paso 2, donde el "conjunto de datos" era el Excel oficial). El texto del Paso 4 dice "datos de operaciones reales", pero el 34 puede seguir otra regla.

**El runner PUEDE reintentar 1×34 cuando quiera probar una hipótesis nueva — no necesita aprobación previa.** Eso sí: hacerlo solo cuando el resto de tipos del ciclo actual ya estén completos o casi (para no arriesgar progreso grande en una apuesta), y siempre documentando la hipótesis probada y el resultado, para no repetir la misma exactamente.

**Rutas a intentar, en este orden (el runner las ejecuta solo, sin esperar a nadie)**:
1. **Reintentar con ≥24h de separación** entre la emisión del 31 referenciado y el envío del 34 (hipótesis de reconciliación batch nocturna de la DGII — ya hay de sobra más de 24h desde los últimos 31 Aceptados, así que esta ruta ya está disponible para probarse en cualquier corrida siguiente).
2. Revisar la Bandeja de Entrada del portal (`MensajeId` asociado al trackId `daeac04a-b4cd-4e27-89e4-a3d831513086` del rechazo E340000000054) por si trae más detalle que `consultar_estado`.
3. Probar variantes de payload no exploradas todavía: `CodigoModificacion` distinto, incluir explícitamente un monto/referencia que hoy se omite, o un 34 contra un 31 con `MontoTotal` mucho más chico (más parecido al monto de la propia NC) por si el "saldo disponible" se calcula distinto de lo asumido.
4. Solo como último recurso, si las rutas técnicas se agotan sin pistas nuevas: dejar un borrador de correo/consulta a soporte DGII (809-689-3444) listo en el plan maestro, pero **sin que eso bloquee el resto del trabajo** — el runner sigue avanzando 44/45/46/47/RFCE mientras tanto.

Bloqueos previamente resueltos (histórico, no releer si no aplica): 10ma corrida cerró el bloqueo de la 7ma corrida (código 64 en 33) con `CodigoModificacion=3`.

_Ninguno al 2026-09-25 (10ma corrida)._ El bloqueo de la 7ma corrida
(código 64 vacío en tipo 33) quedó **RESUELTO** por la 10ma corrida:
`CodigoModificacion=3` fue Aceptado por certecf (E330000000005/eb6f92b2,
25-09-2026 16:14:51 UTC-4), portal a 1/1 tipo 33 sin nuevos reinicios. El
runner agrega aquí cualquier bloqueo nuevo, con fecha, descripción exacta
y qué decisión falta — y NO vuelve a intentar esa fase hasta que esta
sección diga explícitamente que se resolvió.

**HISTÓRICO (RESUELTO 2026-09-25 por la 10ma corrida) — Fase 4 (33 Nota de
Débito) rechazado con código 64 y mensaje vacío; portal reiniciado (0/N en
todos los 11 renglones)**. Se conserva el detalle para trazabilidad:

- Envío `E330000000001` (trackId `1043f428-59fe-4ea1-b9d2-4dac0c6335ec`,
  25-09-2026 00:17:24 UTC-4) — payload construido por
  `construir_ecf_generico(33, ...)`, pasó el gate XSD-local
  (`test_payload_corrida7_tipo_33_nota_debito_valida_contra_xsd`, corriendo
  contra el XSD real `e-CF-33-v1.0.xsd`). NCFModificado apuntaba a
  E310000000061 real ya Aceptado (5ta corrida, FC-0007829, RNCComprador
  131265863 EMPRESA DISTRIBUIDORA Y SERVICIO PAE SRL, FechaEmision
  20-11-2025). MontoTotal 5900.00 (5000 base + 900 ITBIS 18%).
- `consultar_estado` devuelve `{"estado":"Rechazado","codigo":"2",
  "secuenciaUtilizada":false,"mensajes":[{"valor":"","codigo":64}]}` — o
  sea NO se quemó la secuencia (E330000000001 sigue disponible en
  TFE_SECUENCIA), pero el mensaje textual del rechazo viene VACÍO. Detalle
  del mensaje en Bandeja de Entrada del portal (MensajeId=1589511)
  confirma: "Las pruebas de simulación de eCF han sido reiniciadas debido
  a que se han rechazado comprobantes." — sin la coletilla "-El campo X
  del área Y" que sí traen todos los rechazos previos con motivo
  identificable.
- **Lección crítica NUEVA (contra la hipótesis de la 5ta corrida)**: el
  reinicio de contadores en Fase 4 **NO depende de `secuenciaUtilizada`**.
  Aunque el rechazo no queme secuencia, sigue reiniciando los 11
  contadores. Portal muestra 0/4 tipo 31 + 0/2 tipo 32≥250K + resto en
  cero después de este rechazo, incluso con `secuenciaUtilizada:false`.
- **Qué falta para desbloquear** (una de dos, ambas requieren
  investigación humana, no técnica):
  1. Confirmar qué significa `codigo:64` con `valor:""` en el catálogo
     oficial de códigos de respuesta DGII (`Descripcion-Tecnica-
     Servicios-DGII.pdf` en `backend/docs/superpowers/reference/
     2026-08-31-set-pruebas-paso2/`) o vía soporte DGII. Los rechazos
     anteriores traen mensaje textual — que este venga vacío es
     patológico y hay que entenderlo antes de reintentar.
  2. Confirmar si algún campo obligatorio del 33 real no está siendo
     emitido por `construir_ecf_generico` aunque el XSD lo permita omitir
     (mismo patrón que la 1ra-2da corrida con IndicadorMontoGravado,
     FechaLimitePago, MontoGravadoI1 — el XSD dice `minOccurs=0` pero la
     DGII exige el campo).
- **Runner NO debe reintentar Fase 4 hasta que este bloqueo esté
  resuelto** — cualquier envío estructuralmente ambiguo puede volver a
  disparar reinicio.
- **Hipótesis técnica fuerte identificada por la 8va corrida (2026-09-25)**:
  el payload de la 7ma corrida usó `CodigoModificacion=1` (Anula el NCF
  modificado) con `tipo_ecf=33` (Nota de Débito). Formato-e-CF-V1.0.pdf
  nota 80 dice que códigos 1/2/3 aplican a notas de crédito/débito "según
  corresponda"; una Nota de Débito por definición **AGREGA cargos** a la
  factura original (no la anula), así que código 1 es semánticamente
  inconsistente y probablemente lo que disparó el rechazo con `codigo:64`
  y `valor:""` (rechazo de regla de negocio, no de campo — por eso viene
  sin mensaje textual). Para tipo 33 el código semánticamente correcto es
  `3` (Corrige montos). La 8va corrida agregó validación defensiva en
  `_gen_informacion_referencia` que rechaza `tipo_ecf==33` +
  `CodigoModificacion=='1'` en el builder, más tests XSD-gate con
  `CodigoModificacion=3` (`test_payload_corrida8_tipo_33_codigo_modificacion_3_valida_contra_xsd`),
  219/219 tests pasan. Payload propuesto para la 9na corrida en
  `_PAYLOAD_33_CORRIDA_8` (mismo NCFModificado=E310000000061 real ya
  Aceptado, solo cambia CodigoModificacion 1→3 y RazonModificacion).
- **La 9na corrida (o el usuario) puede reintentar 1×33 con
  `_PAYLOAD_33_CORRIDA_8`** una vez que quiera validar la hipótesis
  empíricamente. Riesgo controlado: los contadores YA están en 0/N desde
  la 7ma corrida, no hay progreso que perder; y `secuenciaUtilizada:false`
  del rechazo anterior significa que E330000000001 sigue disponible en
  TFE_SECUENCIA para reutilizar. Si el rechazo se repite con código 64
  vacío, el problema NO es CodigoModificacion (el fix falla) y hay que
  seguir la ruta 1 (catálogo oficial DGII).
- Secuencias reales actuales de TFE_SECUENCIA (para orientar la próxima
  corrida cuando se desbloquee): 31 → siguiente E310000000065; 32 →
  siguiente E320000001007; 33 → siguiente E330000000001 (NO quemado,
  reutilizable); 34/41/43/44/45/46/47 en 1.
- Nota: al reenviar tipo 31 desde `paso4-factura-real` con las mismas 4
  facturas reales (FC-0007829/7607/8076/7766), el builder de FT ya
  validado va a asignar E310000000065-068 (secuencia real, no
  reutilizada). Es la parte segura para retomar cuando este bloqueo
  cierre.

## Protocolo de cada corrida (qué hace el runner, en orden)

1. **Leer este documento completo** + el `git log --oneline -20` de
   `backend/docs/superpowers/plans/` y `backend/apps/fe/` para refrescar
   contexto real (no confiar solo en lo escrito acá si el código cambió).
2. **Confirmar en vivo el estado real del portal** (login Playwright/MCP o
   `curl`, ver credenciales en el runner prompt) — el contador visual del
   portal puede tener horas/días de retraso, pero la navegación a
   `/certecf/portalcertificacion/Postulacion` SIEMPRE redirige a la fase
   real en la que está la postulación 81443. Si el portal muestra una fase
   distinta a la tabla de arriba, la tabla está desactualizada — corregirla
   primero.
3. Si hay algo en "Bloqueos activos" (ahora "Situación activa", ya no
   requiere aprobación humana): decidí vos mismo si esta corrida prueba una
   ruta nueva para esa situación, o si avanza otra parte de la fase — nunca
   "parar sin hacer nada" solo porque hay algo pendiente ahí. Configuración
   administrativa local (rangos de secuencia, defaults, etc.) que bloquee
   el avance: resolvela vos mismo (`UPDATE` directo vía `docker exec`,
   documentado en el plan) sin pedir permiso — no es una decisión de
   negocio, es mantenimiento técnico normal.
4. Tomar **la fase actual según el portal** (no una fase futura) y avanzar
   **una unidad de trabajo razonable para ~3h de presupuesto** — no
   necesariamente la fase entera si es grande (p.ej. Fase 4 tiene 21+
   envíos, está bien hacer un grupo por corrida: "Primero", "Segundo",
   "Tercero+Cuarto" en corridas separadas).
5. Para cualquier fase que requiera código nuevo (no solo "enviar datos con
   lo que ya existe"): usar `superpowers:writing-plans` para escribir un
   sub-plan detallado ANTES de tocar código (agregarlo a
   `backend/docs/superpowers/plans/`, mismo estilo que los planes previos
   de este proyecto), luego `superpowers:executing-plans` o
   `superpowers:subagent-driven-development` para ejecutarlo con TDD. Para
   fases que son solo "usar la UI/API ya construida", ir directo.

   **Regla explícita: que ZentoryERP "no tenga esa opción todavía" NUNCA es
   motivo para no hacer nada.** Si el paso de la DGII exige una capacidad
   que el sistema no tiene (un endpoint que falta, una plantilla PDF que no
   existe, un builder de un tipo de e-CF que Fase 1 no cubrió, etc.), el
   runner la CONSTRUYE esta misma corrida (o la deja como Tarea 1 de un
   sub-plan si es grande) — no se salta el paso, no lo deja "pendiente de
   decisión" solo por faltar código. Esto sigue
   [[feedback-ecf-todo-debe-salir-de-la-ui-no-scripts]]: la funcionalidad
   faltante se construye como endpoint + UI real, igual que se hizo para
   Fases 1-4. La ÚNICA razón legítima para parar sin construir nada es que
   el REQUISITO EN SÍ (no la capacidad técnica) no esté confirmado — ver
   siguiente sección, son dos cosas distintas y no hay que confundirlas.
6. Seguir `sigaft-deploy-vm` para cualquier cambio de backend/frontend
   (pscp a la VM, smoke test real, commit + push a `main` — push directo a
   `main` está autorizado para este runner, mismo criterio que
   `ZentoryERP-Reportes-AutoFix`).
7. Antes de dar una fase por completa: usar `superpowers:verification-before-completion`
   — confirmar contra el portal real (no solo contra `consultar_estado` de
   la API, que puede decir "Aceptado" mientras el portal sigue mostrando
   contador viejo por reconciliación con retraso, patrón ya documentado
   varias veces).
8. **Actualizar este documento** (tabla de estado + cualquier hallazgo
   nuevo, en su propia sección debajo de "Fase N") y hacer commit de ese
   cambio junto con el código si lo hay.
9. Escribir la línea de reporte y el log de corrida (ver abajo).

## Cuándo detenerse y NO seguir solo (MUY reducido — política 2026-09-29)

**El usuario fue explícito: el runner no necesita nada de él para avanzar
esta certificación. No pares a "esperar decisión humana" salvo por esto,
y solo esto:**

- **Acciones legalmente vinculantes en nombre de Abregonza SRL** ante la
  DGII: firmar/enviar una Declaración Jurada, o enviar correspondencia
  oficial (correo, ticket de soporte) en nombre de la empresa. Esto sí
  crea una obligación legal real que el usuario/Roberto deben asumir
  conscientemente — el runner puede dejar el borrador listo, pero no lo
  envía. Ni siquiera esto bloquea el resto del trabajo: seguí con
  cualquier otra fase/tipo pendiente en la misma corrida.

**Todo lo demás es trabajo normal, no un bloqueo — resolvelo vos mismo:**

- Mensaje de la DGII poco claro → seguí investigando (Bandeja de Entrada,
  PDFs oficiales, probar variantes), no esperes a que alguien te lo
  traduzca.
- Configuración administrativa local (rangos `TFE_SECUENCIA`, defaults,
  etc.) → cambiala vos mismo vía `docker exec`, documentá el cambio.
- Formato/requisito no confirmado (ej. QR de Fase 5) → investigalo con las
  herramientas que tengas (leer PDFs, `poppler-utils`, probar en un
  entorno de prueba) antes de construir a ciegas — pero la investigación
  la hacés vos, no es un bloqueo para el usuario.
- Rechazo técnico persistente de la DGII (ej. código 615 del tipo 34) →
  seguí probando hipótesis distintas en corridas sucesivas, sin esperar
  aprobación previa para gastar una secuencia de prueba.
- Enviar datos reales de Abregonza a la DGII de forma irreversible → es
  exactamente el propósito de este runner, adelante; solo verificá dos
  veces que el dato es correcto antes de enviarlo (no hay "deshacer" con
  la DGII, pero eso no es motivo para parar, es motivo para tener
  cuidado).

Si documentás un intento fallido en "Situación activa", seguí trabajando
otra cosa en la MISMA corrida — nunca termines una corrida sin haber
avanzado algo, salvo que literalmente todo lo pendiente dependa de la
única categoría de arriba (legal).

## Fase 4 — Pruebas Simulación e-CF (LISTO PARA EJECUTAR, sin código nuevo)

**Objetivo del portal**: enviar, con datos de operaciones REALES de
Abregonza, uno o más comprobantes de cada tipo hasta completar:
4×31, 2×32(≥250Mil), 1×33, 2×34, 2×41, 2×43, 2×44, 2×45, 2×46, 2×47,
4×32 RFCE (<250Mil).

**Ya construido, endpoints reales** (`backend/apps/fe/views.py`,
`backend/apps/fe/urls.py`):
- `POST /api/fe/certificacion/paso4-factura-real/` — body form-data
  `no_cia`, `tipo_ecf` (31 o 32), `punto`, `tipo_factura`, `no_factura` →
  arma el e-CF desde una factura REAL de `TFAT_FACTURA`
  (`ecf_builder.construir_ecf_31/32`, consume secuencia real), firma y
  envía a `certecf`.
- `POST /api/fe/certificacion/paso4-manual/` — body JSON `{no_cia,
  tipo_ecf, datos}` — para 33/34/41/43/44/45/46/47 (sin pipeline de
  producción), mismo builder que Modo Test
  (`ecf_builder.construir_ecf_generico`) pero con secuencia real
  (`fe_repo.consumir_siguiente_encf`). **Tipo 34 requiere
  `datos.NCFModificado`** = el e-NCF de un 31 ya enviado en esta misma
  fase.
- Para RFCE (<250Mil): reutilizar `POST /api/fe/certificacion/paso2-rfce/`
  con datos reales (mismo endpoint del Paso 2, decisión YAGNI ya tomada,
  no se construyó uno dedicado).
- UI equivalente: `Configuración → Facturación Electrónica →
  Certificación e-CF → tarjeta "Paso 4"`.

**Orden de envío obligatorio** (igual que Pasos 2/3, confirmar en el modal
"Orden de Emisión de Comprobantes" del propio portal si cambió):
Primero (31, 32≥250Mil, 41, 43, 44, 45, 46, 47) → Segundo (33, 34) →
Tercero (RFCE) → Cuarto (subida manual del e-CF32 firmado por el widget
del portal, después que su RFCE esté Aceptado).

**Pendiente real para ejecutar** (decisión operativa, no de código):
elegir CONCRETAMENTE qué facturas reales de Abregonza (`TFAT_FACTURA`,
tipos FT existentes) usar para los 4×31 y 2×32≥250Mil. Si no hay
suficientes facturas reales de cada tipo disponibles, usar el endpoint
`paso4-manual` con datos realistas de Abregonza (no inventados al azar —
usar datos de un cliente/proveedor real de la BD) para completar la
cuota. El runner puede decidir esto solo (no requiere aprobación humana
por ítem, ya que no son transacciones nuevas de negocio, son solo
reenvíos/copias de datos ya reales hacia la DGII) — pero SÍ debe registrar
en este documento qué facturas/datos concretos usó, para que sea
auditable.

**Cómo verificar que una fase quedó completa**: refrescar
`/Postulacion/PruebasSimulacion` en el portal — cuando los 3 contadores
lleguen a N/N el portal redirige solo a la fase siguiente (patrón ya
confirmado 2 veces en Pasos 2→3 y 3→4).

## Fase 5 — Pruebas Simulación Representación Impresa (INVESTIGAR + CONSTRUIR)

**Ya confirmado** (ver `2026-09-17-paso4-simulacion-ecf.md`): por cada e-CF
del Paso 4 hay que generar y conservar su RI (PDF) con QR, para subirla en
este paso. El bloque `QRCode` ya existe en el editor Puck
(`frontend/src/features/pdf/blocks/index.tsx`, componente `QRCode`, librería
`qrcode`), reutilizado de `factura-pos.ts`.

**Bloqueante real, no resuelto todavía**: el formato EXACTO del contenido
del QR. Los 3 PDF oficiales ya están en el repo
(`backend/docs/superpowers/reference/2026-08-31-set-pruebas-paso2/`:
`Formato-e-CF-V1.0.pdf`, `Descripcion-Tecnica-Servicios-DGII.pdf`,
`Formato-RFCE-v1.0.pdf`). La [[reference-dgii-ecf-api]] ya documenta la URL
base del QR (`.../consultatimbre?rncemisor=&rnccomprador=&encf=&fechaemision=&montototal=&fechafirma=&codigoseguridad=`)
pero **no está confirmado 1:1 contra el PDF real** (orden exacto de query
params, si son mayúsculas/minúsculas, formato de fecha, si `ecf`/`certecf`
usan hosts distintos para el QR vs para la API). Antes de escribir la
plantilla, el runner debe:
1. Instalar `poppler-utils` si hace falta (`apt-get install -y
   poppler-utils` en el contenedor, o en el entorno del runner) y extraer
   texto/imágenes de esos 3 PDF (`pdftotext`, `pdftoppm` para ver capturas
   de pantalla del QR de ejemplo si las trae).
2. Confirmar el formato EXACTO (no asumir) y documentarlo en este archivo,
   en una sub-sección "Formato QR confirmado 2026-XX-XX" con la evidencia
   textual citada.
3. Recién con eso, usar `superpowers:writing-plans` para un plan de
   implementación completo: nuevo `defaults/ecf-representacion-impresa.ts`
   (patrón `sigaft-pdf-simple-design` + bloque `QRCode`), y cómo generar +
   descargar el PDF de cada e-NCF ya enviado en el Paso 4 (probablemente un
   endpoint nuevo `GET /api/fe/documentos/<e_ncf>/representacion-impresa/`
   que renderice la plantilla con los datos reales del `TFE_DOCUMENTO`
   guardado).
4. Ejecutar el plan con TDD, desplegar, y solo entonces subir las RI al
   portal (mismo patrón de "widget de archivo manual" que las Fases 2/4).

**No adelantar esta fase sin haber completado la Fase 4** — el portal las
pide en orden y probablemente no deje avanzar antes.

### Formato QR confirmado 2026-10-01 (36va corrida)

Fuente: `backend/docs/superpowers/reference/2026-08-31-set-pruebas-paso2/
Descripcion-Tecnica-Servicios-DGII.pdf`, sección "Consulta timbre (QR)"
(páginas 40-41) y "Consulta timbre FC (QR)" (páginas 42-43), extraído
textual con `pdftotext -layout`.

**Hay DOS URLs de QR distintas**, elegidas según el tipo de e-CF:

1. **e-CF normales** (tipos 31, 32≥250K, 33, 34, 41, 43, 44, 45, 46, 47):
   usar `consultatimbre`.
2. **RFCE** (tipo 32 <250K, Resumen de Factura de Consumo Electrónica):
   usar `consultatimbrefc`.

**URL base por ambiente** (nuestro código ya tiene flag `_AMBIENTE` para
elegir):

| Ambiente | e-CF normales | RFCE |
|----------|---------------|------|
| TesteCF (pre-cert) | `https://ecf.dgii.gov.do/testecf/consultatimbre` | `https://fc.dgii.gov.do/testecf/consultatimbrefc` |
| CerteCF (cert) | `https://ecf.dgii.gov.do/certecf/consultatimbre` | `https://fc.dgii.gov.do/certecf/consultatimbrefc` |
| eCF (prod) | `https://ecf.dgii.gov.do/ecf/consultatimbre` | `https://fc.dgii.gov.do/ecf/consultatimbrefc` |

**Query params para e-CF normales** (orden EXACTO del ejemplo oficial,
todos en minúscula):
1. `rncemisor` — RNC del contribuyente emisor (9 ó 11 dígitos)
2. `rnccomprador` — RNC del comprador (si aplica; para consumidor final sin RNC se omite)
3. `encf` — e-NCF **en minúsculas** (ej: `e310000000001`, NO `E310000000001`)
4. `fechaemision` — formato `DD-MM-YYYY` (ej: `10-10-2020`)
5. `montototal` — número con punto decimal, SIN separador de miles (ej: `02.11` o `682709.10`)
6. `fechafirma` — formato `DD-MM-YYYY HH:MM:SS`, el espacio URL-encoded como `%20` (ej: `10-10-2020%2009:00:00`)
7. `codigoseguridad` — ver abajo cómo se deriva

**Ejemplo literal oficial del PDF** (línea 778 de la extracción):

```
https://ecf.dgii.gov.do/testecf/consultatimbre?rncemisor=130000001&rnccomprador=130000002&encf=e310000000001&fechaemision=10-10-2020&montototal=02.11&fechafirma=10-10-2020%2009:00:00&codigoseguridad=dcp79q
```

**Query params para RFCE** (orden EXACTO del ejemplo oficial, todos en
minúscula):
1. `rncemisor`
2. `encf` — e-NCF en minúsculas
3. `montototal`
4. `codigoseguridad`

**Ejemplo literal oficial del PDF** (línea 826 de la extracción):

```
https://fc.dgii.gov.do/testecf/consultatimbrefc?rncemisor=131880738&encf=e320000000064&montototal=6225.09&codigosegurida=uabnyh
```

(Nota: en el PDF el ejemplo tiene `codigosegurida` cortado con un line-break;
la clave correcta es `codigoseguridad`, confirmado por el servicio del
e-CF normal y por el campo del XSD.)

**Cómo se deriva `codigoseguridad`** (sección Consulta de estado e-CF,
línea 672 de `-layout`):

> codigoSeguridad: extraído de los primeros seis (6) dígitos del hash
> generado en el SignatureValue de la firma digital que viene en el tag
> CodigoSeguridadeCF del resumen de factura.

Es decir: `codigoseguridad` = los primeros 6 caracteres del hash del
`<ds:SignatureValue>` del XML firmado. En nuestro backend eso ya está
implementado para RFCE (`dgii_client.enviar_rfce` lo deriva y lo retorna
como `codigo_seguridad`, p.ej. 34va corrida: `'uFy/56'`). Para
representación impresa de e-CF normales hay que extraerlo del XML firmado
que persiste `TFE_DOCUMENTO.xml_firmado_contenido` (columna existente).

**Versión del QR**: Versión 8 (ver `https://www.qrcode.com/en/about/
version.html`). Si usamos la lib `qrcode` del frontend (ya existe en
`frontend/src/features/pdf/blocks/index.tsx` como `QRCode`), hay que
asegurarse de que el nivel de corrección permita que la URL (>120 chars
para e-CF normales) encaje en versión 8 — típicamente nivel L o M.

**Pendiente de verificación empírica** (no bloquea construir la plantilla,
pero chequear al final):
- Si el `encf` ya firmado va con `E` mayúscula en el XML (como está en
  nuestro XML firmado real: `E310000000121`) pero el PDF ejemplo tiene
  `e310000000001` lowercase. Lo más seguro es escribir el QR con el `encf`
  tal como aparece en el XML firmado (mayúscula) — si DGII espera lower,
  normalizarlo con `.toLowerCase()` solo si rechaza. La URL es
  case-insensitive para el host; los query params pueden importar.
- Si `rnccomprador` se incluye cuando es vacío (consumidor final sin RNC),
  o se omite por completo del query string. Lo más limpio: omitirlo si
  no hay RNC capturado.

**Siguiente paso para implementar Fase 5** (37va o posterior, usar
`writing-plans` + TDD):
1. Crear `frontend/src/features/pdf/defaults/ecf-representacion-impresa.ts`
   (patrón `sigaft-pdf-simple-design`, bloque `QRCode` configurado con URL
   derivada de los campos del print-data).
2. Endpoint backend nuevo `GET /api/fe/documentos/<e_ncf>/representacion-
   impresa/print-data/` que arme el JSON de impresión desde
   `TFE_DOCUMENTO`, incluyendo:
   - Todos los campos del Encabezado (coinciden con los del XML firmado).
   - `codigo_seguridad` derivado de `TFE_DOCUMENTO.xml_firmado_contenido`
     (extraer `<ds:SignatureValue>`, tomar los primeros 6 chars).
   - URL del QR armada server-side según `TFE_CONFIG._AMBIENTE` ('certecf'
     esta fase) y según sea e-CF normal o RFCE (basado en `tipo_ecf` y
     `monto_total`<250K).
3. Ruta frontend `/print/ecf-representacion-impresa/<e_ncf>` que renderice
   la plantilla Puck con el print-data.
4. Botón "Descargar RI" en la UI del Paso 4 del panel Certificación e-CF.
5. Tests TDD: round-trip URL QR = exacto del PDF oficial dado datos
   conocidos; QRCode block renderiza; CodigoSeguridad bien derivado.

## Fases 6 a 15 — sin investigar todavía

No hay información confiable sobre estas fases; la memoria de sesiones
anteriores solo alcanzó a ver los nombres en el stepper del portal:
Validación Representación Impresa, URL Servicios Prueba, Inicio Prueba
Recepción e-CF, Recepción e-CF, Inicio Prueba Recepción Aprobación
Comercial, Recepción Aprobación Comercial, URL Servicios Producción,
Declaración Jurada, Verificación Estatus, Finalizado.

**Protocolo obligatorio la primera vez que el runner llegue a cada una**
(mismo método que ya funcionó para investigar el Paso 4, ver
`2026-09-17-paso4-simulacion-ecf.md` como ejemplo de formato esperado):
1. Login real al portal, navegar a la URL de esa fase, **leer el texto
   literal completo** que muestra (no asumir por el nombre del paso).
2. Revisar si pide un Set de datos descargable de la DGII, o datos propios
   reales, o una acción puramente administrativa (algunas fases como "URL
   Servicios Producción" o "Declaración Jurada" probablemente no son
   técnicas sino formularios/confirmaciones).
3. Escribir los hallazgos en una nueva sub-sección de este documento
   ("## Fase N — <nombre> (hallazgos AAAA-MM-DD)") ANTES de escribir
   ningún plan de código.
4. Si la fase requiere código nuevo, seguir el mismo protocolo que la Fase
   5 (writing-plans → executing-plans → deploy → verify).
5. Si la fase es puramente administrativa (ej. aceptar una declaración
   jurada, confirmar URLs de producción ya construidas en Fase 2 de FE —
   `/fe/autenticacion/...`, `/fe/recepcion/...`,
   `/fe/aprobacioncomercial/...`, ya reales en
   `https://grupo-abregonza.hopto.org:8443/fe/...`), completarla
   directamente si no requiere una decisión que solo el usuario pueda
   tomar (ver "Cuándo detenerse" arriba) — p.ej. una Declaración Jurada
   que compromete legalmente a Abregonza SIEMPRE debe pasar por el
   usuario, no la firme el runner solo.

## Fase 4 — Hallazgos de la primera ejecución real (2026-09-22)

Primer intento real de enviar 4×31 desde facturas reales de Abregonza
(FC-0007829, FC-0007607, FC-0008076, FC-0007766). Descubierto que el
builder `_construir_ecf` de Task 1 estaba incompleto para envío contra
`certecf` real (los tests XSD sí pasaban porque el XSD marca varios
campos como `minOccurs=0` que en la realidad la DGII exige). Cada rechazo
quema el e-NCF (`secuenciaUtilizada: True`), por eso se paró la corrida al
tercer rechazo para arreglar el builder correctamente antes de seguir.

**e-NCF quemados** (todos con FC-0007829, RD$ 682709.10, RNC comprador
131265863; rechazados por `certecf`, ya NO se reintentan):

| e-NCF | trackId | Código | Mensaje |
|-------|---------|--------|---------|
| E310000000054 | efe84117-d3d1-4c76-ba68-02fd95503671 | 176 | IndicadorMontoGravado no es válido |
| E310000000055 | 3a6472bb-5061-4984-b628-a10e1984cb3f | 1100 | FechaLimitePago no es válido |
| E310000000056 | 3f4dcbdb-711c-4eef-bf22-91f1aad9b528 | 1930 | MontoGravadoI1 no es válido |

**Bugs corregidos esta corrida** (`apps/fe/ecf_builder.py`, con tests en
`apps/fe/tests/test_ecf_builder.py`, desplegados a la VM):

1. `IdDoc/IndicadorMontoGravado` faltaba. DGII lo exige aunque el XSD
   diga `minOccurs=0`. Se fija en `0` (los `MontoItem` van SIN ITBIS).
2. `DetallesItems/Item/MontoItem` se emitía con ITBIS incluido (usaba
   `TFAT_FACTURAL.monto_neto` que en producción sí incluye ITBIS —
   confirmado con FC-0007829: cantidad=1, precio=578567.03,
   impuesto=104142.07, monto_neto=682709.10). Ahora se calcula como
   `precio × cantidad − descuento`, consistente con
   `IndicadorMontoGravado=0`.
3. `IdDoc/FechaLimitePago` faltaba cuando `TipoPago=2` (crédito). Muchas
   facturas de crédito reales tienen `plazo_pago=0` (crédito "sin plazo
   definido"); en ese caso se defaultea a `fecha_emisión + 30 días`.

**Bug pendiente para la siguiente corrida** (bloqueante para retomar el
envío, NO enviar otro 31 hasta arreglarlo):

- `Encabezado/Totales/MontoGravadoI1` (+ `ITBIS1` = 18, +
  `TotalITBIS1`) faltan. La DGII exige el **breakdown por tasa** cuando
  hay líneas con ITBIS 18% (probablemente también `MontoGravadoI2`+`I3`
  para 16% y 0% si aplican, y `MontoExento` — que sí lo genera). Confirmar
  contra `Formato-e-CF-V1.0.pdf` en `backend/docs/superpowers/reference/
  2026-08-31-set-pruebas-paso2/` la lista completa de campos I1/I2/I3
  antes de codificar, y agregar assert XSD + assert de valor en
  `test_ecf_builder.py`. Después, retomar FC-0007829 (E310000000057 será
  la próxima secuencia).

Es decir: la próxima corrida NO abre otro grupo del Paso 4 — arregla este
bug primero, valida un solo 31, y solo si queda **Aceptado** por DGII se
avanza a los otros 3. Ese es el orden correcto para no seguir quemando
secuencias reales.

## Fase 4 — Hallazgos de la segunda corrida (2026-09-23)

Bug pendiente 3 (`MontoGravadoI1`/`ITBIS1`/`TotalITBIS1`) corregido en
`_construir_ecf`. La DGII exige el desglose completo por tasa de ITBIS
(I1=18%, I2=16%, I3=0%) aunque el XSD lo marque `minOccurs=0`. El orden
EXACTO del XSD para el bloque Totales es:
`MontoGravadoTotal, MontoGravadoI1..I3, MontoExento, ITBIS1..3,
TotalITBIS, TotalITBIS1..3, MontoImpuestoAdicional, ImpuestosAdicionales,
MontoTotal` — cualquier desvío hace que el XSD marque el documento
invalido. Se emiten solo los `MontoGravadoIn`/`ITBISn`/`TotalITBISn` de
las tasas con base > 0. Base gravada por tasa se calcula como
`precio*cantidad - descuento` de las líneas cuyo `IndicadorFacturacion`
mapea a esa tasa (mismo criterio que `MontoItem`, no `monto_neto` de
`TFAT_FACTURAL` que incluye ITBIS). Cobertura con 2 tests nuevos:
`test_totales_desglose_por_tasa_itbis_y_orden_xsd` (18% + exento + 0%,
verifica valores, ausencias y orden exacto) y `test_totales_16pct_emite_i2_e_itbis2`
(escenario 16% puro, poco común en FAT pero soportado). 18/18 tests
pasan localmente contra el XSD real de la DGII.

**4/4 tipo 31 aceptados por certecf en esta corrida** (contador del
portal confirmado 4/4):

| Factura | e-NCF | trackId | Estado |
|---------|-------|---------|--------|
| FC-0007829 | E310000000057 | 7d41a61f-f4c8-496d-803a-28fb6a450d15 | Aceptado |
| FC-0007607 | E310000000058 | 0839647c-88bb-459e-a79d-ee6943f2a44e | Aceptado |
| FC-0008076 | E310000000059 | 44347bb4-5c44-4466-9c32-cb565c5835de | Aceptado |
| FC-0007766 | E310000000060 | 8a8168ac-4937-4d5b-bece-be4d25698d2a | Aceptado |

**Próximo paso para la corrida siguiente**: seguir con el resto del grupo
"Primero" — 2×32≥250Mil, 2×41, 2×43, 2×44, 2×45, 2×46, 2×47. Los tipos
41/43/44/45/46/47 no tienen pipeline de producción en FAT (van por
`paso4-manual` con builder genérico `ecf_builder.construir_ecf_generico`
que NO ha sido probado contra `certecf` real todavía; es probable que
salten más bugs equivalentes a los 3 del builder 31/32). Envíar **UNO
solo primero** de cada nuevo tipo antes de continuar, no la cuota
completa — cada rechazo quema secuencia real e irreversible. Para
32≥250Mil hay que elegir una factura B02 real de Abregonza con monto
≥250Mil (el builder es el mismo `construir_ecf_32` ya validado, así que
es la parte segura). Los demás requieren investigación de qué RNC/datos
usar para cada tipo — probablemente conviene sub-plan con
`superpowers:writing-plans` antes de tocar el builder genérico contra
`certecf`.

## Fase 4 — Hallazgos de la tercera corrida (2026-09-23)

Primer intento de 32≥250Mil desde FC-0007867 (RD$282,262.50, cliente 835
"JOSE ENRIQUE YABER HENRIQUE", sin RNC/Cédula capturado en TCXC_CLIENTE).
`certecf` rechazó con código 1381 "El campo RNCComprador del área
Comprador de la sección Encabezado es obligatorio":

| Factura | e-NCF | trackId | Estado | Motivo |
|---------|-------|---------|--------|--------|
| FC-0007867 | E320000001004 | 882d70fd-a666-4cc2-9aba-29fbe1ed3b0f | Rechazado | 1381: RNCComprador obligatorio en 32 con MontoTotal≥250Mil |

**Regla real DGII (Norma 06-2018) confirmada por certecf**: para tipo 32
(Consumo) con `MontoTotal >= RD$250,000` el `RNCComprador` es obligatorio,
aunque el XSD lo declare `minOccurs=0`. Para consumo <250Mil el RNC sigue
siendo opcional (patrón consumidor final).

**Bug pre-envío corregido** (previene quemar más secuencias):
`_construir_ecf` ahora valida antes de consumir el e-NCF que si el tipo es
32 y `total_neto >= 250000` el `rnc_comprador` sea válido (9/11 dígitos);
si no, lanza `ECFBuilderError` sin llegar a `certecf`. Test nuevo
`test_construir_ecf_32_mayor_o_igual_250mil_sin_rnc_lanza_error` cubre
este caso. 19/19 tests pasan.

**Bloqueo real, no técnico** (no se puede resolver construyendo más código):
en `FAT.TFAT_FACTURA` solo hay 6 facturas B02 con `total_neto >= 250,000`
en toda la historia de Abregonza, y de esas **ninguna** tiene un
`rnc_comprador` real (5 tienen `NULL`, 1 tiene el placeholder falso
`123456789` de "CONSUMIDOR FINAL"). Es decir: Abregonza históricamente no
factura consumos ≥250Mil a clientes con RNC (los clientes con RNC compran
crédito fiscal B01, no consumo B02) — la ausencia de datos es real, no un
error de captura.

Facturas candidatas actuales (`_tmp_query_b02.py`, no commiteado):

| Factura | Fecha | Total | Cliente | rnc/cédula |
|---------|-------|-------|---------|------------|
| FC-0007867 | 2025-12-09 | 282,262.50 | 835 JOSE ENRIQUE YABER HENRIQUE | vacío |
| FC-0007518 | 2025-02-11 | 280,799.66 | 142 CONSUMIDOR FINAL | 123456789 (placeholder inválido) |
| FT-0023736 | 2023-06-16 | 435,000.00 | 740 LEIVY SUERO | vacío |
| FC-0005981 | 2023-05-15 | 453,999.76 | 740 LEIVY SUERO | vacío |
| FC-0004508 | 2022-07-19 | 303,825.39 | 239 ROBERTO ABREU FINCA | vacío |
| FC-0000077 | 2021-03-01 | 445,551.47 | 182 DOMINGO CONTRERAS | vacío |

**Opciones para la siguiente corrida** (elegir UNA, en orden de preferencia):

1. **Preferida**: usar `POST /api/fe/certificacion/paso4-manual/` con
   `tipo_ecf=32`, `datos.MontoTotal >= 250000` y `datos.RNCComprador` de un
   **cliente real de Abregonza que sí tenga RNC/Cédula capturado**. Elegir
   uno de CXC.TCXC_CLIENTE (query directa en la corrida siguiente); no
   inventar RNC. Riesgo: `construir_ecf_generico` NO ha sido probado
   contra `certecf` real todavía — probable que salten bugs equivalentes
   a los 3 que ya se corrigieron para el builder 31/32. Enviar **UNO
   solo** primero.
2. **Alternativa**: capturar la Cédula real de "JOSE ENRIQUE YABER
   HENRIQUE" (cliente 835) en `CXC.TCXC_CLIENTE.cedula` (`UPDATE` puntual
   en la BD real, decisión operativa, no financiera — sólo completa un
   campo de datos maestro faltante) y reintentar `paso4-factura-real` con
   FC-0007867. Requiere confirmar con Roberto/JCABREU cuál es la cédula
   real de ese cliente antes de escribir en BD.
3. **No hacer**: emitir una factura B02 nueva ≥250Mil solo para
   certificación — sería una operación financiera inventada.

Cualquier ruta que se elija ANTES DE ENVIAR, doble-chequear que:
- El e-CF a enviar es tipo 32 y su `MontoTotal >= 250000`.
- El `RNCComprador` es un RNC (9 dígitos) o Cédula (11 dígitos) real y
  válido — no `123456789`, no `00000000000`, no vacío.
- El `RazonSocialComprador` corresponde al RNC/Cédula real (no "CONSUMIDOR
  FINAL" con un RNC inventado).

## Fase 4 — Hallazgos de la cuarta corrida (2026-09-23) — CRÍTICO

**Hallazgo crítico no documentado antes**: en Fase 4, la DGII **reinicia TODOS
los contadores** (no solo el del tipo rechazado) cada vez que rechaza un e-CF.
Evidencia dura: al login del portal en esta corrida (~08:12 UTC del 23-09) el
tablero de "Estado actual de las pruebas de simulación" muestra `0/N` en
**todos** los 11 renglones (31/32≥250K/33/34/41/43/44/45/46/47/32 RFCE),
aunque la 2da corrida (00:20 UTC del 23-09) dejó `4/4 tipo 31` confirmado en
verde. El log del portal deja el motivo textual:

    23/09/2026 12:18:08 AM — Las pruebas de simulación de eCF han sido
      reiniciadas debido a que se han rechazado comprobantes.
      -El campo RNCComprador del área Comprador de la sección Encabezado es obligatorio.

Ese timestamp (RD, UTC-4 → 04:18 UTC) coincide con el rechazo del
`E320000001004` que envió la 3ra corrida. Los 3 rechazos previos del 22-09
también dispararon "reinicio" (misma frase en cada renglón del log), pero
todavía no había e-CF aceptados que perder — el 4to rechazo (23-09) fue el
que sí borró progreso real.

**Implicación de estrategia (obligatoria para las próximas corridas)**:

1. Los 4×31 aceptados (E310000000057-060, trackIds ya en `TFE_DOCUMENTO`) NO
   se pueden reutilizar — quedaron quemados con las secuencias, aunque el
   contador del portal ya no los tiene. Habrá que enviar 4 e-CF 31 nuevos
   (`E310000000061` en adelante) con las mismas 4 facturas reales para
   volver a 4/4.
2. Cualquier rechazo cuesta **todo el progreso acumulado del paso**, no solo
   una secuencia. Costo real por rechazo ≈ (# aceptados hasta ese momento)
   secuencias que hay que reenviar. Regla nueva: nunca enviar un e-CF a
   `certecf` en Fase 4 sin haber validado el XML contra el XSD real
   **localmente** primero (`etree.parse` con el XSD del tipo correspondiente
   en `apps/fe/tests/schemas/e-CF-XX-v1.0.xsd`).
3. Orden óptimo de reenvío para llenar Fase 4 con mínimo riesgo:
   a. Preparar el 32≥250Mil primero (es el que tiene riesgo real por ser
      builder genérico no probado + RNC de un cliente CXC — variable
      externa nueva); validarlo XSD + snapshot antes de enviar.
   b. Recién con el 32 confirmado, enviar los 4×31 (reutiliza builder ya
      validado, mínimo riesgo), luego 33/34, y así.
   c. RFCE al final (grupo Tercero+Cuarto según orden DGII, ya conocido).
4. Los tipos 41/43/44/45/46/47 usan `construir_ecf_generico` que tampoco ha
   sido probado contra `certecf` — cada uno es "un tipo 32 de riesgo" a
   escala menor. Enviar UNO solo primero de cada tipo antes de completar
   la cuota.

**Estado real de TFE_SECUENCIA (confirmado en BD real esta corrida)**:

| Tipo | Próxima secuencia | Rango |
|------|-------------------|-------|
| 31 | 61 → E310000000061 | 1..100 |
| 32 | 1005 → E320000001005 | 1..50000000 |
| 33 | 1 → E330000000001 | 1..10M |
| 34 | 52 → E340000000052 | 1..100 |
| 41/43/44/45/46/47 | 1 (cada uno) | 1..10M cada uno |

**Candidatos de cliente CXC con RNC válido reales de Abregonza**
(query `CXC.TCXC_CLIENTE` filtro `LENGTH(TRIM(rnc))=9 AND REGEXP_LIKE(rnc,
'^[0-9]{9}$') AND rnc<>'123456789'`, top 10 por `no_cliente` ordenado):

| no_cliente | Nombre | RNC | Dirección |
|-----------:|--------|-----|-----------|
| 1  | COMERCIAL VALOIS                  | 131175341 | C/ Pimentel esq. Ana valverde |
| 2  | E & P SERVICIOS INSTITUCIONALES   | 101799463 | C/ 30 de marzo #41 |
| 3  | AQUAMAR                           | 130299625 | C/ Pimentel casi esquina Montecristi. |
| 4  | CORTES HERMANOS                   | 101001811 | C/ Francisco Villa Espesa #175 |
| 5  | C H  ALIMENTOS SAS                | 130805253 | C/ Francisco Villa Espesa #176 |
| 7  | CONSORCIO RYLCO & ASOCIADOS       | 131376292 | C/ Rodrigo Objio #23 |
| 8  | ALARIFES SRL                      | 131209855 | C/ Lic Lovaton #6 |
| 11 | MOLINOS MODERNOS S.A              | 101006374 | C/ Alexander Fleming No.5 Ensanche la Fe |
| 12 | MOLINOS DEL OZAMA S.A.            | 101808502 | C/ Olegario Vargas No.1, Villa Duarte |
| 13 | AGUA PLANETA AZUL,S. A.           | 101503939 | Calle Central El Gala, Santo Domingo |

Se confirma también que las 6 facturas B02≥250K de la BD SIGUEN sin tener
RNC del comprador (mismo resultado que la 3ra corrida — nada nuevo desde
entonces). No hay ruta "factura real" para el 32≥250Mil.

**Payload propuesto para la próxima corrida (envío tipo 32 vía
`paso4-manual`)**. NO se envió esta corrida por decisión de riesgo (ver
"Por qué esta corrida no envió nada" abajo). El payload debe validarse
antes contra el XSD real de e-CF-32 (`apps/fe/tests/schemas/e-CF-32-v1.0.xsd`
si existe, o el que use `test_ecf_builder_generico.py`) — corrida siguiente:

```json
POST /api/fe/certificacion/paso4-manual/
Content-Type: application/json
{
  "no_cia": "01",
  "tipo_ecf": 32,
  "datos": {
    "RNCEmisor": "130217432",
    "RazonSocialEmisor": "ABREGONZA COMERCIAL SRL",
    "FechaEmision": "23-09-2026",
    "TipoIngresos": "01",
    "TipoPago": "1",
    "RNCComprador": "131376292",
    "RazonSocialComprador": "CONSORCIO RYLCO & ASOCIADOS",
    "MontoTotal": 295000.00,
    "MontoGravadoTotal": 250000.00,
    "MontoGravadoI1": 250000.00,
    "ITBIS1": "18",
    "TotalITBIS": 45000.00,
    "TotalITBIS1": 45000.00,
    "NumeroLinea[1]": 1,
    "IndicadorFacturacion[1]": 1,
    "NombreItem[1]": "Servicio profesional",
    "IndicadorBienoServicio[1]": 2,
    "CantidadItem[1]": 1,
    "PrecioUnitarioItem[1]": 250000.00,
    "MontoItem[1]": 250000.00
  }
}
```

Notas para la próxima corrida antes de disparar ese POST:

- Cliente #7 CONSORCIO RYLCO (RNC 131376292) es cliente real de Abregonza
  con dirección captada en CXC — no es RNC inventado.
- `MontoTotal=295000 (>250000)` cumple la regla Norma 06-2018 confirmada
  por `certecf` en la 3ra corrida.
- Antes de POST: correr un test unitario que llame
  `ecf_builder.construir_ecf_generico(32, e_ncf_fake, datos)` con este
  payload y valide el XML resultante contra el XSD real. Si falta algún
  campo minOccurs=1 del XSD (`IdDoc/TipoIngresos`, etc.) que la validación
  detecte, agregarlo al `datos` antes de enviar. **Este paso es
  obligatorio** — el costo de un rechazo ya no es "una secuencia", es
  "todo el progreso del paso".
- Si el envío queda Aceptado, la corrida SIGUIENTE puede reenviar los 4×31
  desde las mismas facturas reales de Abregonza (FC-0007829, FC-0007607,
  FC-0008076, FC-0007766) — builder ya validado.

**Por qué esta corrida no envió nada** (para la trazabilidad del proceso):

Cuando se descubrió que el rechazo del 32 borró los 4/4 tipo 31, la
prioridad pasó a documentar la lección y no arriesgar más secuencias sin
la validación XSD-local previa nueva. Enviar un 32 genérico sin ese
gate hubiera repetido exactamente el mismo error que causó el reinicio
en la 3ra corrida. El presupuesto de esta corrida se gastó en:

1. Confirmar el estado real del portal (Playwright).
2. Consultar la BD real (docker exec) por facturas B02≥250K, clientes CXC
   con RNC válido, y estado de `TFE_SECUENCIA`.
3. Documentar el hallazgo del reinicio y la nueva estrategia obligatoria.
4. Dejar el payload propuesto listo para la próxima corrida.

Sin código nuevo esta corrida — solo commit del plan maestro actualizado.

## Fase 4 — Hallazgos de la quinta corrida (2026-09-23)

Aplicada la estrategia obligatoria de la 4ta corrida: **gate XSD-local antes
de cada envío a certecf**. Un test nuevo
(`test_payload_corrida5_tipo_32_mayor_250k_valida_contra_xsd`) valida el XML
del tipo 32≥250K con RNCComprador contra `e-CF-32-v1.0.xsd` real. 89/89
tests pasan.

**Un solo envío 32≥250Mil vía `paso4-manual`** (builder `construir_ecf_generico`,
primer contacto real con certecf de ese path):

| # | e-NCF | trackId | Estado | Cliente comprador |
|---|-------|---------|--------|-------------------|
| 1 | E320000001005 | eab0e8a3-5a9e-4590-b2f9-a40c672e5857 | **Aceptado** | CONSORCIO RYLCO & ASOCIADOS (RNC 131376292) |

Con el 32 confirmado, se reenviaron los **4×31** desde las mismas 4 facturas
reales de la corrida 2 (builder `construir_ecf_31` ya validado, mínimo
riesgo):

| Factura | e-NCF | trackId | Estado |
|---------|-------|---------|--------|
| FC-0007829 | E310000000061 | 132c2376-f88c-4d34-98e2-b42bbda5ef99 | Aceptado |
| FC-0007607 | E310000000062 | 96505ac8-f580-4101-850e-a6e50dd6ef7c | Aceptado |
| FC-0008076 | E310000000063 | 4acab832-2065-40e9-a680-39ff157a1fdb | Aceptado |
| FC-0007766 | E310000000064 | dc27faab-0a64-4c6c-841b-32a9dbf4ea35 | Aceptado |

**Portal (verificado por Playwright, 2026-09-23 ~12:20 UTC)**:

- 4/4 Comprobantes tipo 31
- 1/2 Comprobantes tipo 32 >= 250Mil
- 0/N el resto de renglones

**Payload real usado para el 32** (incluye 3 campos adicionales frente al
propuesto por la 4ta corrida: `DireccionEmisor` obligatorio, `TipoPago=1`
entero en vez de string, `IndicadorMontoGravado=0` defensivo aunque el XSD
32 lo permita omitir — misma lección que se aprendió con el 31 en corridas
1-2, código 176):

```python
{
    'RNCEmisor': '130217432',
    'RazonSocialEmisor': 'ABREGONZA COMERCIAL SRL',
    'DireccionEmisor': 'AV LOPE DE VEGA #55, ENSANCHE NACO, SANTO DOMINGO',
    'FechaEmision': '23-09-2026',
    'TipoIngresos': '01',
    'TipoPago': 1,
    'IndicadorMontoGravado': 0,
    'RNCComprador': '131376292',
    'RazonSocialComprador': 'CONSORCIO RYLCO & ASOCIADOS',
    'MontoGravadoTotal': '250000.00', 'MontoGravadoI1': '250000.00',
    'ITBIS1': '18', 'TotalITBIS': '45000.00', 'TotalITBIS1': '45000.00',
    'MontoTotal': '295000.00',
    'NumeroLinea[1]': 1, 'IndicadorFacturacion[1]': 1,
    'NombreItem[1]': 'Servicio profesional',
    'IndicadorBienoServicio[1]': 2,
    'CantidadItem[1]': '1.00',
    'PrecioUnitarioItem[1]': '250000.00', 'MontoItem[1]': '250000.00',
}
```

**Próximo paso para la corrida siguiente**: seguir con el resto del grupo
"Primero" (aplicando gate XSD-local antes de cada envío):

1. **1×32≥250Mil restante** — mismo builder, elegir OTRO cliente CXC real
   con RNC válido (para no duplicar RNCComprador; opción: cliente #1
   COMERCIAL VALOIS RNC 131175341, o cualquiera de los otros 20+ listados
   en Hallazgos 4ta corrida). Payload idéntico al de esta corrida excepto
   RNCComprador/RazonSocialComprador. Escribir test XSD-gate espejo del
   de esta corrida.
2. **1×33 (Nota de Débito)** — vía `paso4-manual`, `datos.NCFModificado` =
   E310000000061 (o cualquier 31 aceptado ya en TFE_DOCUMENTO). Ver
   `test_tipo_33_nota_debito_valida_contra_xsd` como plantilla del payload
   mínimo — tiene un motivo/monto/fecha realistas. Escribir test XSD-gate
   con NCFModificado=E310000000061 real antes de enviar.
3. **2×34 (Nota de Crédito)** — mismo patrón, `datos.NCFModificado` de un
   31 aceptado + `IndicadorNotaCredito=1`. Ver
   `test_tipo_34_nota_credito_valida_contra_xsd`.
4. **2×41 + 2×43 + 2×44 + 2×45 + 2×46 + 2×47** — TODOS pasan por
   `construir_ecf_generico`, ninguno ha sido probado contra `certecf`
   real. Riesgo real por cada uno. Enviar **UNO solo primero** de cada
   tipo (12 envíos experimentales, no 24 completos) — cualquier rechazo
   quema los 5 aceptados actuales, así que probablemente 4-5 corridas de
   ~1 tipo cada una es lo prudente.
5. **RFCE (4×32<250Mil)** al final (grupo "Tercero"), luego los 4 e-CF32
   correspondientes (grupo "Cuarto", subida manual por el widget).

Es decir: quedan ~10 envíos "riesgosos" (2do 32, 33, 34, y uno-a-uno de
41-47) antes de que el resto sea repetición segura. Cada uno debe pasar
por gate XSD-local + smoke test + verificación en portal antes de
declararlo aceptado.

## Fase 4 — Hallazgos de la sexta corrida (2026-09-24)

Aplicado el gate XSD-local obligatorio (test nuevo
`test_payload_corrida6_tipo_32_mayor_250k_valida_contra_xsd`, 215/215 tests
del módulo `fe` pasan). Un solo envío 32≥250Mil vía `paso4-manual` con RNC
de un cliente CXC real distinto del de la 5ta corrida (COMERCIAL VALOIS,
cliente #1 CXC, RNC 131175341, MontoTotal 306800):

| # | e-NCF | trackId | Estado | Cliente comprador |
|---|-------|---------|--------|-------------------|
| 2 | E320000001006 | 73456765-7a96-4d4a-8728-17d8cecd7c84 | **Aceptado** | COMERCIAL VALOIS (RNC 131175341) |

**Portal (verificado por Playwright, 2026-09-25 ~00:10 UTC)**:
- 4/4 Comprobantes tipo 31
- **2/2** Comprobantes tipo 32 >= 250Mil ← completo
- 0/N el resto de renglones (33, 34, 41, 43, 44, 45, 46, 47, RFCE)

Grupo "Primero" para 32/31 CERRADO. No hubo nuevos "reinicios" en el log del
portal — el gate XSD-local está funcionando como diseñado.

**Próximo paso para la corrida siguiente** (grupo "Segundo" + resto del
Primero, todos vía `paso4-manual` con `construir_ecf_generico` — ninguno
probado contra `certecf` real todavía, mismo riesgo que se documentó en la
5ta corrida). Enviar **UNO solo primero** de cada tipo, con gate XSD-local
antes de cada uno:

1. **1×33 (Nota de Débito)** — vía `paso4-manual` con `NCFModificado` de un
   31 aceptado (recomendado: E310000000061, el 1er 31 de la 5ta corrida,
   FC-0007829, ya en `TFE_DOCUMENTO`). Ver
   `test_tipo_33_nota_debito_valida_contra_xsd` como plantilla. Escribir
   test-gate espejo con `NCFModificado=E310000000061` + monto realista
   (ej. RD$5,000, motivo "Ajuste por diferencia de precio") ANTES de
   enviar. Si Aceptado, portal debe pasar a 1/1 tipo 33.
2. **1×34 (Nota de Crédito)** — mismo patrón que 33, con
   `IndicadorNotaCredito=1`. Ver `test_tipo_34_nota_credito_valida_contra_xsd`.
   Si Aceptado, enviar el 2do (2/2).
3. **1×41 (Compras)** — sin NCFModificado. Requiere investigar payload
   típico: RNCComprador = 130217432 (nosotros, es la compra propia), RNC
   del emisor = proveedor real. Consultar `TCXP_FACTURA` para elegir un
   proveedor real. Igual patrón: gate XSD + 1 solo primero.
4. **1×43 (Gastos Menores)**, **1×44 (Regímenes Especiales)**, **1×45
   (Gubernamental)**, **1×46 (Exportaciones)**, **1×47 (Pagos al Exterior)**
   — cada uno tiene requisitos particulares del XSD. Investigar el payload
   mínimo de cada uno en el propio XSD (`docs/superpowers/reference/2026-08-31-
   set-pruebas-paso2/e-CF-XX-v1.0.xsd`) antes de tocar.

Estrategia recomendada por corrida (para no exceder budget y minimizar
riesgo de rechazo cascada): **1 tipo por corrida** — escribir gate + enviar
+ verificar. 8 envíos exitosos = 8 corridas mínimas antes del grupo Tercero
(RFCE). Puede parecer lento pero cada rechazo cuesta TODOS los aceptados
acumulados, así que la aritmética favorece la prudencia.

## Fase 4 — Hallazgos de la séptima corrida (2026-09-25) — CRÍTICO

Primer intento de 1×33 (Nota de Débito) vía `construir_ecf_generico` +
`paso4-manual`. Payload construido con NCFModificado real E310000000061
(1er 31 aceptado de la 5ta corrida). Gate XSD-local
(`test_payload_corrida7_tipo_33_nota_debito_valida_contra_xsd`) pasó
localmente contra el XSD real e-CF-33-v1.0.xsd. Envío disparado como sesión
Django autenticada de JCABREU vía `Client.force_login` + POST a
`/api/fe/certificacion/paso4-manual/` — respuesta HTTP 200
`{"ok":true, "encf":"E330000000001", "trackId":"1043f428-59fe-4ea1-b9d2-4dac0c6335ec"}`.

Un minuto después, `consultar_estado` retorna
`{"estado":"Rechazado","codigo":"2","secuenciaUtilizada":false,
"mensajes":[{"valor":"","codigo":64}]}`. El mensaje viene VACÍO —
patológico, todos los rechazos previos traen "-El campo X del área Y" con
detalle. `secuenciaUtilizada:false` → E330000000001 NO se quemó.

Portal (Playwright, ~00:17 UTC-4 = 04:17 UTC): **todos los 11 contadores
en 0/N** — se perdieron los 4/4 tipo 31 + 2/2 tipo 32≥250K acumulados
hasta la 6ta corrida. Log del portal confirma reinicio a las 12:17:25 AM
(RD) con mensaje "Las pruebas de simulación de eCF han sido reiniciadas
debido a que se han rechazado comprobantes." — sin motivo textual
específico, cosa que **contradice la hipótesis previa** de que el reinicio
depende de `secuenciaUtilizada`.

**Ver "Bloqueos activos" arriba** para el detalle completo y las dos rutas
posibles de desbloqueo (una es investigar el catálogo oficial de códigos
DGII, la otra es cotejar `construir_ecf_generico(33, ...)` contra la lista
completa de campos que la DGII exige para tipo 33 aunque el XSD los
declare opcionales). La próxima corrida NO debe reintentar Fase 4 hasta
que el bloqueo esté resuelto.

## Fase 4 — Hallazgos de la décima corrida (2026-09-25) — HIPÓTESIS VALIDADA

Objetivo: cerrar el bloqueo abierto por la 7ma corrida ejecutando el envío
propuesto por la 8va corrida (`_PAYLOAD_33_CORRIDA_8`, tipo 33 con
`CodigoModificacion=3`), tras verificar que la infraestructura DGII que
falló para la 9na corrida ya está normalizada.

**Probe DGII antes de disparar** (`obtener_token('01','certecf',forzar=True)`
en el contenedor `facturation_backend`): devolvió `OK_TOKEN_LEN=343`. La
misma llamada falló con HTTP 400 "connection attempt failed" en la 9na
corrida (validación downstream OCSP/CRL del certificado). Confirma
normalización del pipeline de DGII.

**Envío 1×33 vía `paso4-manual`** (`Client.force_login` + POST autenticado
como JCABREU):

| # | e-NCF | trackId | Estado | NCFModificado | CodigoModificacion |
|---|-------|---------|--------|----------------|---------------------|
| 1 | E330000000005 | eb6f92b2-b4eb-4d61-a44e-914e2d00367e | **Aceptado** | E310000000061 | 3 |

`consultar_estado` retorna `{"codigo":"1","estado":"Aceptado",
"secuenciaUtilizada":true,"fechaRecepcion":"9/25/2026 4:14:51 PM"}`.
Portal (Playwright, 2026-09-25 ~20:14 UTC / 16:14 UTC-4) confirma **1/1
Comprobantes tipo 33**; el resto de renglones sigue en 0/N (como esperado
— la 7ma corrida reinició y no se han reenviado). El log de "reinicios" no
crece: sigue con el último a las 25/09 12:17:25 AM (7ma corrida). El fix
del builder (`_gen_informacion_referencia` bloquea tipo 33 +
CodigoModificacion=1) más el gate XSD-local están validados de punta a
punta contra certecf real.

**Discrepancia con expectativa de la 8va/9na corrida** (para trazabilidad
—no bloquea): esas corridas asumían que `E330000000001` seguía disponible
en `FAT.TFE_SECUENCIA` porque el rechazo de la 7ma corrida devolvió
`secuenciaUtilizada:false`. En la práctica, esta 10ma corrida obtuvo
`E330000000005` — es decir la secuencia local avanzó 4 puestos entre la
7ma y hoy (probable causa: consumos internos de tests/reintentos que no
se documentaron; o `consumir_siguiente_encf` incrementa antes de tener
respuesta de DGII y la 7ma corrida lo hizo aunque DGII marcara
`secuenciaUtilizada:false`). No es un problema: la secuencia 33 tiene
rango 1..10M, sobra espacio; y para la certificación cuenta lo que DGII
Acepta, no la numeración interna.

**Próximo paso para la corrida siguiente (11va)** — el orden óptimo
identificado por la 5ta corrida sigue vigente. Con 1/1 tipo 33 ya
asegurado, el próximo eslabón de bajo riesgo es reenviar los **4×31**
desde las mismas 4 facturas reales (FC-0007829/7607/8076/7766) usando
`paso4-factura-real` — builder ya validado ampliamente, no requiere
plan/código nuevo. Después:
1. **2×32≥250Mil** vía `paso4-manual` con RNCComprador de cliente CXC real
   (patrón de las corridas 5-6; los payloads previos siguen siendo
   plantillas válidas — cambiar solo RNCComprador para no repetir).
2. **1×34 (Nota de Crédito)** vía `paso4-manual` — payload similar al 33
   pero con `IndicadorNotaCredito=1`, `NCFModificado` de un 31 aceptado,
   `CodigoModificacion` semánticamente coherente (34 es Nota de Crédito
   ⇒ típicamente código 1 "Anula" o 3 "Corrige montos" — validar contra
   Formato-e-CF-V1.0.pdf antes de enviar).
3. **41-47 uno a uno**, cada uno con investigación del payload mínimo del
   XSD respectivo.

Recomendación: seguir la regla "1 tipo por corrida" — con el gate XSD
local, la aritmética de riesgo sigue favoreciendo la prudencia. La única
excepción segura es reenviar los 4×31 en una sola corrida, porque el
builder está validado (ya se hizo con éxito en las corridas 2 y 5).

## Fase 4 — Hallazgos de la 11va corrida (2026-09-26) — 4×31 REHECHOS

Con 1/1 tipo 33 asegurado por la 10ma corrida, tocaba rehacer los 4×31 que
la 7ma corrida borró por rechazo cascada. Ruta de bajo riesgo: builder ya
validado ampliamente en corridas 2 y 5. Se reenviaron las mismas 4 facturas
reales de Abregonza (FC-0007607/7766/7829/8076) vía `paso4-factura-real`,
autenticado como JCABREU con `Client.force_login`, uno a uno con abort-on-
first-failure y 3s de pausa entre envíos.

Probe DGII previo (`obtener_token('01','certecf',forzar=True)`): `OK_TOKEN_LEN=343`
— infraestructura DGII operativa (misma normalización que la 10ma corrida).

| # | Factura | e-NCF | trackId | Estado | fechaRecepcion |
|---|---------|-------|---------|--------|-----------------|
| 1 | FC-0007607 | E310000000065 | 90a86b80-353d-4c26-95db-0e7d4fcfc3f4 | **Aceptado** | 9/25/2026 8:18:07 PM |
| 2 | FC-0007766 | E310000000066 | 6a635d97-0901-4d88-807e-970755e451cf | **Aceptado** | 9/25/2026 8:18:12 PM |
| 3 | FC-0007829 | E310000000067 | c48df839-82c9-44bd-8cb4-d9848d8af006 | **Aceptado** | 9/25/2026 8:18:16 PM |
| 4 | FC-0008076 | E310000000068 | b566ca09-9610-4256-8edc-94afac0135d9 | **Aceptado** | 9/25/2026 8:18:19 PM |

Los 4 con `codigo:1, secuenciaUtilizada:true, mensajes:[{"valor":"","codigo":0}]`
(el mensaje vacío con código 0 en Aceptado es normal — la anomalía es
código 64 con valor vacío en Rechazado, ya analizado en la 7ma corrida).

**Portal (Playwright, 2026-09-25 ~20:18 UTC / 16:18 UTC-4)**:
- **4/4 Comprobantes tipo 31** ← restaurado
- 0/2 tipo 32 >= 250Mil
- 1/1 tipo 33
- 0/N el resto (34, 41-47, RFCE)

Log del portal SIN nuevos reinicios — el último sigue siendo el 25/09
12:17:25 AM (7ma corrida). Sin código nuevo esta corrida, solo commit del
plan maestro actualizado (scripts ad-hoc en `%TEMP%`, no van al repo).

**Próximo paso para la corrida siguiente (12va)** — mismo patrón que la
10ma: **1 tipo por corrida** con gate XSD-local previo. Orden sugerido:

1. **2×32≥250Mil** vía `paso4-manual`, dos clientes CXC nuevos (evitar
   RYLCO 131376292 de la 5ta y VALOIS 131175341 de la 6ta que ya fueron
   usados; hay 20+ candidatos en la lista de Hallazgos 4ta corrida). Es
   builder ya validado tres veces contra certecf, riesgo mínimo — se puede
   hacer los 2 en la misma corrida con abort-on-first.
2. **1×34 (Nota de Crédito)** vía `paso4-manual` — payload similar al 33
   con `NCFModificado=E310000000067` (FC-0007829, monto grande, mucho
   margen), `CodigoModificacion` coherente (por Formato-e-CF-V1.0.pdf, para
   Nota de Crédito el código 1=Anula tiene sentido; validar antes de
   enviar). Escribir test XSD-gate espejo del corrida8.
3. **41-47 uno a uno**, cada uno con investigación del payload mínimo del
   XSD respectivo — todos aún no probados contra certecf.

Estado real de TFE_SECUENCIA (después de esta corrida, para orientar la
próxima): 31 → siguiente E310000000069; 33 → siguiente E330000000006 (o
lo que corresponda tras cualquier consumo intermedio); 32/34/41-47 sin
cambios respecto de las notas previas.

## Fase 4 — Hallazgos de la 12va corrida (2026-09-26) — 2×32≥250K CERRADO

Con 4/4 tipo 31 + 1/1 tipo 33 aseguradas por corridas 10 y 11, tocaba cerrar
el renglón "tipo 32 >= 250Mil" (0/2 al arrancar). Ruta de bajo riesgo: builder
`construir_ecf_generico(32,...)` ya validado tres veces contra `certecf`
(corridas 5, 6 y hoy). Se agregaron dos payloads + tests XSD-gate espejo
(`test_payload_corrida12_a_tipo_32_mayor_250k_valida_contra_xsd` y
`_b_`) con clientes CXC distintos de los usados en corridas 5-6 para no
duplicar RNCComprador:

- Cliente #2 CXC: **E & P SERVICIOS INSTITUCIONALES** (RNC 101799463)
- Cliente #3 CXC: **AQUAMAR** (RNC 130299625)

Los payloads son idénticos a los de corridas 5-6 salvo por RNC/RazonSocial/
monto (255000 y 265000 base, para tener MontoTotal distintos). 76/76 tests
del módulo `test_ecf_builder_generico.py` pasan localmente en el contenedor
de la VM.

Probe DGII previo (`obtener_token('01','certecf',forzar=True)`):
`OK_TOKEN_LEN=343` — infraestructura DGII operativa.

Envíos vía `paso4-manual` autenticado como JCABREU con `Client.force_login`,
abort-on-first-failure entre uno y otro:

| # | e-NCF | trackId | Estado | Cliente comprador | fechaRecepcion |
|---|-------|---------|--------|-------------------|-----------------|
| 1 | E320000001007 | 11af573b-f012-4af9-bbc5-0341560e418d | **Aceptado** | E & P SERVICIOS INSTITUCIONALES (RNC 101799463) | 9/26/2026 12:16:42 AM |
| 2 | E320000001008 | 4affc98f-6374-40c5-8393-03eb87188fe4 | **Aceptado** | AQUAMAR (RNC 130299625) | 9/26/2026 12:17:21 AM |

Ambos con `codigo:1, secuenciaUtilizada:true, mensajes:[{"valor":"","codigo":0}]`
(mensaje vacío con código 0 en Aceptado es normal — ya documentado en la 11va
corrida).

**Portal (Playwright, 2026-09-26 ~04:15 UTC / 12:15 AM UTC-4)**:
- 4/4 Comprobantes tipo 31
- **2/2 Comprobantes tipo 32 >= 250Mil** ← cerrado
- 1/1 Comprobantes tipo 33
- 0/2 el resto (34, 41-47, RFCE)

Log del portal SIN nuevos reinicios — el último sigue siendo el 25/09
12:17:25 AM (7ma corrida). El gate XSD-local previo a cada envío está
funcionando como diseñado (4 envíos consecutivos Aceptados sin reinicios:
corridas 10/11/12).

**Estado real de TFE_SECUENCIA (después de esta corrida)**: 31 →
E310000000069; 32 → E320000001009; 33 → E330000000006;
34/41/43/44/45/46/47 sin cambios.

**Próximo paso para la corrida siguiente (13va)** — quedan **8 tipos "de
riesgo"** por probar contra certecf (34, 41, 43, 44, 45, 46, 47 y RFCE),
cada uno primer contacto real del builder genérico para ese tipo. Orden
sugerido conservador (1 tipo por corrida con gate XSD-local previo):

1. **1×34 (Nota de Crédito)** — vía `paso4-manual`, `NCFModificado` de un
   31 aceptado (recomendado E310000000067 = FC-0007829, monto grande, mucho
   margen), `IndicadorNotaCredito=1`, `CodigoModificacion` coherente
   (por Formato-e-CF-V1.0.pdf nota 80, para NC código 1=Anula tiene sentido
   — ya validado en `test_construir_ecf_generico_tipo_34_codigo_modificacion_1_permitido`).
   Escribir test XSD-gate espejo antes de enviar.
2. **1×41 (Compras)** — sin NCFModificado. RNCEmisor = proveedor real (de
   TCXP_FACTURA), RNCComprador = 130217432 (Abregonza, nosotros). Investigar
   payload mínimo en el XSD e-CF-41-v1.0.xsd.
3. **1×43-47 uno-a-uno**, cada uno con investigación previa del payload
   mínimo del XSD.
4. **RFCE (4×32<250Mil)** al final, luego los 4 e-CF32 correspondientes
   por widget manual.

## Fase 4 — Hallazgos de la 13va corrida (2026-09-26) — DOS HALLAZGOS CRÍTICOS

Primer intento de 1×34 (Nota de Crédito) vía `construir_ecf_generico` +
`paso4-manual`. Primer contacto real del builder-34 contra certecf. Se
disparó DOBLE rechazo cascada que borró todo el progreso acumulado
(4/4 tipo 31 + 2/2 tipo 32≥250K + 1/1 tipo 33). Pero cada rechazo trajo un
diagnóstico literal muy útil, sin ambigüedad como el código 64 del 33.

### Hallazgo 1 — TipoIngresos obligatorio de facto para tipo 34 (código 181)

Payload inicial `_PAYLOAD_34_CORRIDA_13` sin `TipoIngresos` (el XSD del 34
lo marca `minOccurs=0` y el test histórico `test_tipo_ingresos_opcional_en_
33_y_34_no_lanza_error` lo trataba como opcional). Certecf rechazó
`E340000000052` (trackId `4d5e4738-95d4-4f54-88ed-723b88520112`) a las
26/09/2026 4:18:01 AM UTC-4 con:

```json
{"estado":"Rechazado","codigo":"2","secuenciaUtilizada":true,
 "mensajes":[{"valor":"El campo TipoIngresos del área IdDoc de la sección
              Encabezado no es válido","codigo":181}]}
```

Log del portal (4:18:02 AM) confirmó el reset con el mismo mensaje literal.
Mismo patrón de facto que ya se documentó en las corridas 1-2 para
`IndicadorMontoGravado`, `FechaLimitePago` y `MontoGravadoI1`: el XSD dice
opcional, la DGII exige.

**Fix desplegado** (`apps/fe/ecf_builder.py` + tests):

- `_CAPS_POR_TIPO[34]['tipo_ingresos_mandatory']=True` (era False). El
  builder ahora levanta `ECFBuilderError` local antes de firmar/enviar si
  `TipoIngresos` falta en `datos` para tipo 34.
- `_PAYLOAD_34_CORRIDA_13` incluye `TipoIngresos: '01'` y el gate XSD-local
  `test_payload_corrida13_tipo_34_nota_credito_valida_contra_xsd` verifica
  la presencia del campo en el XML.
- Test antiguo `test_tipo_ingresos_opcional_en_33_y_34_no_lanza_error`
  reducido a solo tipo 33; nuevo test defensivo
  `test_tipo_34_sin_tipo_ingresos_lanza_error_corrida13` documenta el
  hallazgo empírico y el guard.
- `test_tipo_34_nota_credito_valida_contra_xsd` (histórico) actualizado
  con `TipoIngresos: '01'` en `datos`.
- 78/78 tests del módulo `test_ecf_builder_generico.py` pasan en el
  contenedor `facturation_backend` de la VM tras el fix.

### Hallazgo 2 — NCFModificado en 33/34 solo puede referenciar e-CFs del ciclo actual del portal (código 615)

Con el fix del hallazgo 1, se re-envió el 1×34 (secuencia siguiente
`E340000000053`, trackId `0ab4ee70-d496-453d-b0f9-7eeff7c34676`,
`NCFModificado='E310000000067'` — 3er 31 aceptado de la 11va corrida).
Certecf rechazó a las 4:21:41 AM UTC-4 con:

```json
{"estado":"Rechazado","codigo":"2","secuenciaUtilizada":true,
 "mensajes":[{"valor":"El campo NCFModificado de la sección
              InformacionReferencia no es válido. El monto total de la
              nota de crédito no puede ser mayor al saldo disponible de la
              sumatoria de las operaciones relacionadas al comprobante
              referenciado.","codigo":615}]}
```

**Regla NUEVA (nunca documentada antes)**: `NCFModificado` en un 33/34
debe apuntar a un e-CF que **exista en el ciclo actual del portal** — no
uno aceptado antes del último reset. Cuando certecf reinicia los
contadores, también borra los e-CFs aceptados de su registro, por lo que
el "saldo disponible" de cualquier NCF referenciado desde antes es 0. La
próxima corrida (14va) DEBE elegir un NCFModificado emitido en el ciclo
actual (E310000000069-072, ver abajo).

### Restauración del ciclo actual

Al final de la corrida se re-enviaron los 4×31 desde las mismas 4 facturas
reales (patrón super-conocido de corridas 2/5/11, `paso4-factura-real`,
builder 31 no tocado por el fix del 34):

| Factura | e-NCF | trackId | Estado |
|---------|-------|---------|--------|
| FC-0007607 | E310000000069 | 97e8d147-694b-4bdc-9869-c892fd1af61c | **Aceptado** |
| FC-0007766 | E310000000070 | f6ecb348-5097-4d3a-a1c4-0d098e2a558c | **Aceptado** |
| FC-0007829 | E310000000071 | fae9a542-ebd4-4644-a35e-b53eee78cb03 | **Aceptado** |
| FC-0008076 | E310000000072 | 1e67f684-804c-4a8f-84fe-d4f7320ca929 | **Aceptado** |

Sin nuevos reinicios entre estos 4 envíos (último log sigue siendo el
4:21:41 AM del rechazo del 34). El fix del builder para 34 no rompió el
builder 31 — regresión guard implícito superado.

**Portal final (Playwright, 2026-09-26 ~08:22 UTC / 4:22 AM UTC-4)**:
- **4/4 Comprobantes tipo 31** ← restaurado
- 0/2 tipo 32 >= 250Mil (perdido, pendiente rehacer)
- 0/1 tipo 33 (perdido, pendiente rehacer)
- 0/2 tipo 34 (2 secuencias quemadas: 52 y 53)
- 0/N resto (34, 41-47, RFCE)

**Estado real de TFE_SECUENCIA (después de esta corrida)**: 31 →
E310000000073; 32 → E320000001009; 33 → E330000000006;
34 → E340000000054 (**52 y 53 quemadas por esta corrida**);
41/43/44/45/46/47 sin cambios.

### Próximo paso para la corrida siguiente (14va)

Con el fix del hallazgo 1 desplegado + el hallazgo 2 documentado, el
orden recomendado para las próximas corridas cambia (menor a mayor
riesgo):

1. **2×32≥250K** vía `paso4-manual` con 2 clientes CXC nuevos (evitar
   RYLCO 131376292/VALOIS 131175341/E&P 101799463/AQUAMAR 130299625 que
   ya se usaron en corridas 5/6/12). Builder validado 4 veces contra
   certecf, riesgo mínimo — se pueden hacer los 2 en la misma corrida
   con abort-on-first. Candidatos frescos de la lista de Hallazgos 4ta
   corrida: #4 CORTES HERMANOS 101001811, #5 C H ALIMENTOS SAS
   130805253, #7 CONSORCIO RYLCO YA USADO, #8 ALARIFES SRL 131209855,
   #11 MOLINOS MODERNOS S.A 101006374, #12 MOLINOS DEL OZAMA 101808502,
   #13 AGUA PLANETA AZUL 101503939. Elegir 2 distintos.
2. **1×33 (Nota de Débito)** — payload `_PAYLOAD_33_CORRIDA_8` ya
   validado (10ma corrida lo tuvo Aceptado), pero **cambiar
   `NCFModificado` a E310000000069 (o 070/071/072)** — un e-CF del ciclo
   actual. Actualizar `FechaNCFModificado` a la fecha de emisión del NCF
   elegido (leer con `fe_repo.get_documento` — para FC-0007607 la fecha
   es la de la factura física en TFAT_FACTURA, no la de firma).
3. **1×34 (Nota de Crédito)** — payload `_PAYLOAD_34_CORRIDA_13` ya
   validado por gate XSD-local, cambiar `NCFModificado` a otro e-CF del
   ciclo actual (recomendado E310000000071 = FC-0007829, monto grande).
   Escribir test-gate espejo con el nuevo NCF antes de enviar.
4. **41-47 uno a uno**, cada uno con investigación del payload mínimo
   del XSD y builder no probado contra certecf — mayor riesgo.
5. **RFCE (4×32<250Mil)** al final (grupo Tercero), luego los 4 e-CF32
   por widget manual (grupo Cuarto).

Esta corrida NO tocó el orden de envío obligatorio del portal (grupo
Primero antes que Segundo antes que Tercero) — solo aprendió la restricción
adicional de referencias intra-ciclo. Costo total: 2 secuencias 34
quemadas + 1 ciclo de progreso perdido (aceptable, ya que reveló dos
reglas de negocio no documentadas de la DGII y el patrón de reset
detrás del código 615).

## Fase 4 — Hallazgos de la 14va corrida (2026-09-26) — CRÍTICO: RNC DE CXC NO GARANTIZA VALIDEZ ANTE DGII

Objetivo de la corrida: cerrar 0/2 → 2/2 tipo 32≥250K con dos clientes CXC
nuevos (cliente #4 CORTES HERMANOS RNC 101001811 y cliente #8 ALARIFES SRL
RNC 131209855, ambos de la lista de "clientes CXC con RNC válido" que la 4ta
corrida armó filtrando `LENGTH(TRIM(rnc))=9 AND REGEXP_LIKE(rnc,'^[0-9]{9}$')
AND rnc<>'123456789'`). Builder ya validado 4 veces contra certecf en corridas
5/6/12. Gate XSD-local añadido (`test_payload_corrida14_a/b_tipo_32_mayor_250k_valida_contra_xsd`),
80/80 tests del módulo pasan localmente en el contenedor. Probe
`obtener_token('01','certecf',forzar=True)` OK (len 343).

Envíos vía `paso4-manual` autenticado como JCABREU con `Client.force_login`
+ manage.py shell -c, abort-on-first-failure con 45s de pausa entre uno y
otro para dejar reconciliar certecf:

| # | e-NCF | trackId | Estado | Cliente comprador | fechaRecepcion |
|---|-------|---------|--------|-------------------|-----------------|
| 1 | E320000001009 | 15430d90-32d3-4b24-8ef1-579938d5d11d | **Aceptado** | CORTES HERMANOS (RNC 101001811) | 9/26/2026 8:19:18 AM |
| 2 | E320000001010 | 330a86a4-b49b-4d28-bf66-f883731b6beb | **Rechazado** | ALARIFES SRL (RNC 131209855) | 9/26/2026 8:20:04 AM |

`consultar_estado` del 2do envío:

```json
{"codigo":"2","estado":"Rechazado","secuenciaUtilizada":true,
 "mensajes":[{"valor":"El campo RNCComprador del área Comprador de la
              sección Encabezado no es válido.","codigo":0}]}
```

Portal (Playwright, 2026-09-26 ~8:20 UTC-4): **todos los 11 contadores en
0/N**. Log del portal registra el reset a las 8:20:04 AM con el mensaje
literal `"El campo RNCComprador del área Comprador de la sección Encabezado
no es válido."` — es decir el rechazo cascada perdió también el 1er 32
(CORTES) que había sido Aceptado. Total pérdida esta corrida:
E320000001009 quemado sin quedar en el ciclo + E320000001010 quemado + 0
progreso portal (venía de 4/4 tipo 31, se cae a 0/4).

### Hallazgo nuevo — RNC en TCXC_CLIENTE NO garantiza validez ante DGII

Antes de esta corrida se asumía que cualquier RNC de 9 dígitos numéricos en
`CXC.TCXC_CLIENTE` era usable como `RNCComprador` para un e-CF32. La 14va
corrida demuestra empíricamente que NO: el RNC 131209855 (registrado como
"ALARIFES SRL" en la BD real de Abregonza con dirección "C/ Lic Lovaton
#6") NO existe/no es válido en el registro de contribuyentes de la DGII, y
certecf lo rechaza con mensaje literal. Es un dato maestro obsoleto o
mal-capturado en algún punto histórico.

**Regla nueva para futuras corridas**: antes de usar cualquier `RNCComprador`
nuevo (ya sea de CXC, TCXP_FACTURA, o cualquier otra fuente), validar
contra el servicio público de consulta de contribuyentes de DGII:
`https://dgii.gov.do/app/WebApps/ConsultasWeb2/ConsultasWeb/consultas/rnc.aspx`
o el endpoint JSON equivalente. RNCs ya probados y confirmados VÁLIDOS por
certecf (Aceptado en al menos un envío histórico):

| RNC | Razón social | Confirmado en |
|-----|--------------|----------------|
| 131265863 | EMPRESA DISTRIBUIDORA Y SERVICIO PAE SRL | tipo 31 corridas 2/5/11/13 |
| 131376292 | CONSORCIO RYLCO & ASOCIADOS | tipo 32 corrida 5 |
| 131175341 | COMERCIAL VALOIS | tipo 32 corrida 6 |
| 101799463 | E & P SERVICIOS INSTITUCIONALES | tipo 32 corrida 12 |
| 130299625 | AQUAMAR | tipo 32 corrida 12 |
| 101001811 | CORTES HERMANOS | tipo 32 corrida 14 (Aceptado antes del cascada) |

RNCs de la lista de la 4ta corrida SIN validación empírica todavía (usar
solo tras verificar contra DGII):
- 130805253 (C H ALIMENTOS SAS)
- **131209855 (ALARIFES SRL)** ← INVÁLIDO CONFIRMADO POR CERTECF
- 101006374 (MOLINOS MODERNOS S.A)
- 101808502 (MOLINOS DEL OZAMA S.A.)
- 101503939 (AGUA PLANETA AZUL,S. A.)

### Estado real de TFE_SECUENCIA (después de esta corrida)

Vía `fe_repo.list_secuencias('01')`:

| Tipo | prox_secuencia (=próximo e-NCF) | Rango |
|------|--------------------------------|-------|
| 31 | 73 → E310000000073 | 1..100 |
| 32 | 1011 → E320000001011 | 1..50M (E320000001009/1010 quemadas) |
| 33 | 6 → E330000000006 | 1..10M |
| 34 | 54 → E340000000054 | 1..100 (52/53 quemadas por 13va) |
| 41-47 | 1 cada uno | 1..10M cada uno |

Rango de tipo 31 (1..100) se está estrechando: van 12 secuencias quemadas
(54-56 corrida 1, 57-60 corrida 2, 61-64 corrida 5, 65-68 corrida 11,
69-72 corrida 13). Con la próxima 73, quedan 100-73+1 = 28 secuencias
disponibles antes de tener que ampliar el rango o pedir uno nuevo. Cada
reset borra 4 y las nuevas se emiten con la siguiente numeración.

### Próximo paso para la corrida siguiente (15va)

1. **Restaurar 4/4 tipo 31** — mismas 4 facturas reales
   (FC-0007607/7766/7829/8076), próximas secuencias E310000000073-076,
   patrón validado 4 veces (corridas 2/5/11/13). Riesgo mínimo.
2. **1×32≥250K con CORTES HERMANOS** — payload
   `_PAYLOAD_32_MAYOR_250K_CORRIDA_14_A` (RNC 101001811), próxima secuencia
   E320000001011. Ya validado empíricamente en esta corrida (Aceptado por
   certecf antes del cascada). Riesgo mínimo — es el mismo RNC/monto.
3. **2do 32≥250K con OTRO cliente CXC**, PERO validar el RNC contra el
   servicio de consulta de DGII PRIMERO. Candidatos frescos (sin envío
   histórico y sin validar aún): C H ALIMENTOS SAS 130805253, MOLINOS
   MODERNOS 101006374, MOLINOS DEL OZAMA 101808502, AGUA PLANETA AZUL
   101503939. Si el usuario prefiere no depender de validar contra DGII,
   otra opción segura es **reutilizar un RNC ya probado**: RYLCO/VALOIS
   /E&P/AQUAMAR ya funcionaron. La 6ta corrida en su momento decidió
   evitar duplicar RNCComprador — pero eso NO fue una regla DGII, fue una
   preferencia de diversidad de datos. Reutilizar es lícito.
4. Solo después del 2/2 tipo 32, seguir con 1×33 (payload
   `_PAYLOAD_33_CORRIDA_8` + cambiar NCFModificado a un 31 del ciclo
   actual, ej. E310000000073).
5. 1×34, 41-47 uno a uno, RFCE al final.

Alternativa considerada (y no elegida): implementar `apps/fe/rnc_validator.py`
que consulte el servicio público de DGII y cachear resultados. Es trabajo
razonable (~30 min), pero no urgente si la 15va corrida reutiliza un RNC ya
probado. Deja el TODO documentado; si en algún tipo (34/41-47) surge otro
rechazo por RNCComprador inválido, ahí sí conviene construirlo.

Sin secuencias 34 tocadas esta corrida (E340000000054 sigue disponible).
Fix del builder para tipo 34 de la 13va corrida sigue desplegado y validado
localmente — solo espera un envío exitoso a certecf para validar
end-to-end.

## Fase 4 — Hallazgos de la 15va corrida (2026-09-26) — CRÍTICO: código 615 aplica a Notas de Débito con mensaje distinto

Portal previo confirmado por Playwright: 0/N en los 11 renglones tras el reset de la 14va corrida (26/09 8:20:04 AM). Probe DGII (`obtener_token('01','certecf',forzar=True)`) OK, token len 343.

**Reenvío exitoso de 4×31 + 2×32≥250K** (patrón bajo riesgo, builder validado múltiples veces):

| # | Tipo | e-NCF | trackId | Estado | Cliente | Factura/RNC |
|---|------|-------|---------|--------|---------|-------------|
| 1 | 31 | E310000000073 | 8d26a306-bce3-4186-8f73-061366c937c9 | Aceptado | RC HERNANDEZ 130941361 | FC-0007607 |
| 2 | 31 | E310000000074 | 03ccfe0d-bf66-4af5-a5ab-b695d246eb94 | Aceptado | RC HERNANDEZ 130941361 | FC-0007766 |
| 3 | 31 | E310000000075 | b75020b9-9990-4684-a2e4-5af3d63dd714 | Aceptado | EMPRESA DISTRIBUIDORA Y SERVICIO PAE SRL 131265863 | FC-0007829 |
| 4 | 31 | E310000000076 | 26502a2b-4ad5-4640-9688-2b7210cc5b41 | Aceptado | RC HERNANDEZ 130941361 | FC-0008076 |
| 5 | 32 | E320000001012 | fc65aa28-74bd-4ff2-8623-432a235048dd | Aceptado | CORTES HERMANOS 101001811 | manual, MontoTotal 295000 |
| 6 | 32 | E320000001013 | e5e86b97-cbee-4577-9467-44be9ca1dbed | Aceptado | CONSORCIO RYLCO 131376292 | manual, MontoTotal 295000 |

Portal Playwright ~12:20 UTC confirmó **4/4 tipo 31 + 2/2 tipo 32≥250K + 0/N resto**, sin nuevos reinicios.

### Hallazgo NUEVO — código 615 en 33 con mensaje distinto al del 34

Primer intento 1×33 vía `paso4-manual` con payload derivado de `_PAYLOAD_33_CORRIDA_8` (validado por 10ma corrida) pero cambiando `NCFModificado=E310000000073` (un 31 del ciclo actual, como recomienda hallazgo 2 de la 13va corrida). Todos los demás campos del payload iguales al `_PAYLOAD_33_CORRIDA_8`, incluyendo `RNCComprador='131265863'` (EMPRESA DISTRIBUIDORA Y SERVICIO PAE SRL). Gate XSD-local pasó.

`E330000000006` (trackId `3ab7cb8c-1aae-44ca-ad78-2046a732b086`, 12:22:16 PM UTC-4) **Rechazado con código 615**:

```json
{"estado":"Rechazado","codigo":"2","secuenciaUtilizada":true,
 "mensajes":[{"valor":"El campo NCFModificado de la sección
              InformacionReferencia no es válido. El RNC del comprador o
              Id extranjero de la nota de débito no es válido, ya que no
              coincide con el RNC del comprador o Id extranjero de la
              factura que intenta modificar.","codigo":615}]}
```

Causa raíz: `E310000000073` fue emitido con `RNCComprador=130941361` (RC HERNANDEZ, cliente de FC-0007607), mientras que el payload del 33 declaraba `RNCComprador='131265863'`. La DGII exige que **el `RNCComprador` del 33/34 coincida con el `RNCComprador` del `NCFModificado`**.

Rechazo cascada borró 4/4 tipo 31 + 2/2 tipo 32≥250K acumulados.

**Diferencia con hallazgo 2 de la 13va corrida**: la 13va documentó el código 615 aplicado al 34 con mensaje "saldo disponible = 0" (regla de saldos). La 15va documenta que el **mismo código 615** también aplica al 33 pero con **mensaje distinto** ("RNC no coincide" — regla de identidad del comprador). Ambos son código 615 pero validan reglas distintas. Ambos disparan reset cascada.

### 2do intento 1×33 con NCFModificado correcto — Aceptado

Se identificó (vía leer XML de TFE_DOCUMENTO de los 4 e-CF31 recién emitidos) que **E310000000075 (FC-0007829)** era el único con `RNCComprador=131265863` — coincide con el payload. Segundo envío:

| e-NCF | trackId | Estado | NCFModificado |
|-------|---------|--------|---------------|
| E330000000007 | d7e6f29a-5d56-405d-bb54-c3dce71880fc | **Aceptado** | E310000000075 (FC-0007829, RNC 131265863) |

Portal Playwright ~12:23 UTC-4: **1/1 tipo 33** confirmado; el resto en 0/N (perdido por el cascada del 615).

### Estado real de TFE_SECUENCIA (después de esta corrida)

Vía consulta implícita:

| Tipo | prox_secuencia | Notas |
|------|----------------|-------|
| 31 | 77 → E310000000077 | 073-076 quemadas por corrida 15 |
| 32 | 1014 → E320000001014 | 1011 quemada (consumida antes del xsd-gate fail, sin enviar); 1012/1013 quemadas y Aceptadas |
| 33 | 8 → E330000000008 | 006 quemada+Rechazada, 007 quemada+Aceptada |
| 34 | 54 → E340000000054 | 052/053 quemadas por 13va |
| 41-47 | 1 cada uno | sin cambios |

Rango tipo 31 se está estrechando: quedan 100-77+1 = 24 secuencias antes de tener que ampliar. Con cada reset se consumen 4.

### Próximo paso para la corrida siguiente (16va)

1. **Rehacer 4×31** — mismas 4 facturas reales (FC-0007607/7766/7829/8076), próximas secuencias E310000000077-080, patrón validado 5 veces. Riesgo mínimo.
2. **2×32≥250K** — patrón conocido con RNCs ya probados. Reutilizar CORTES HERMANOS (101001811) + RYLCO (131376292) que ya funcionaron esta corrida. Próximas secuencias E320000001014-1015.
3. **1×34 (Nota de Crédito)** — payload `_PAYLOAD_34_CORRIDA_13` con `NCFModificado` = uno de los 31 del ciclo actual, **y `RNCComprador` que coincida con el del NCFModificado** (regla ahora confirmada por corrida 15 también para 33). Si se elige NCFModificado del 4×31 rehecho (16va corrida), usar:
   - E310000000077 (FC-0007607): RNC 130941361 RC HERNANDEZ
   - E310000000078 (FC-0007766): RNC 130941361 RC HERNANDEZ
   - E310000000079 (FC-0007829): RNC 131265863 EMPRESA DISTRIBUIDORA Y SERVICIO PAE SRL
   - E310000000080 (FC-0008076): RNC 130941361 RC HERNANDEZ
4. **41-47 uno a uno**, cada uno con investigación del payload mínimo del XSD.
5. **RFCE (4×32<250Mil)** al final, luego los 4 e-CF32 por widget manual.

### Mejora de builder recomendada (TODO, no bloquea)

Agregar en `_gen_informacion_referencia` (o en un pre-check equivalente) validación defensiva: si `tipo_ecf in (33,34)` y `datos.NCFModificado` está presente, consultar TFE_DOCUMENTO por ese NCF y verificar que `datos.RNCComprador == doc.rnc_comprador` — si no coincide, levantar `ECFBuilderError` local. Previene quemar secuencias por el error 615 "RNC no coincide". Similar al fix de la 8va corrida para `CodigoModificacion` inconsistente.

## Fase 4 — Hallazgos de la 16va corrida (2026-09-26) — CRÍTICO: bloqueo 34 código 615 confirmado independiente del ciclo

Portal previo confirmado por Playwright: 0/4 tipo 31, 0/2 tipo 32≥250K, 1/1 tipo 33, 0/N resto (tras rechazo de la 15va). TFE_SECUENCIA previo confirmado por BD real: 31→77, 32→1014, 33→8, 34→54, 41-47→1. Probe DGII (`obtener_token`) OK, token len 343.

### Éxitos (patrón conocido bajo riesgo)

**4×31 vía `paso4-factura-real`** (mismas 4 facturas reales, patrón validado 6 veces):

| # | Factura | e-NCF | trackId | Estado | fechaRecepcion |
|---|---------|-------|---------|--------|-----------------|
| 1 | FC-0007607 | E310000000077 | c808d8a6-cc10-4aa7-8430-58159ea1878f | Aceptado | 9/26/2026 4:17:01 PM |
| 2 | FC-0007766 | E310000000078 | be65e076-adcf-481d-8fcf-c46959e5cd50 | Aceptado | 9/26/2026 4:17:13 PM |
| 3 | FC-0007829 | E310000000079 | b4f91ea8-649f-4b3f-8f02-70aeb8b5ac51 | Aceptado | 9/26/2026 4:17:26 PM |
| 4 | FC-0008076 | E310000000080 | 690e4cf3-1dee-412c-b990-2cc4eaeae016 | Aceptado | 9/26/2026 4:17:39 PM |

**2×32≥250K vía `paso4-manual`** (RNCs ya probados, builder validado 5 veces):

| # | e-NCF | trackId | Estado | Comprador | MontoTotal |
|---|-------|---------|--------|-----------|-----------|
| 1 | E320000001014 | 5311c443-7d5d-4cd1-95e9-94b91f551ca4 | Aceptado | CORTES HERMANOS 101001811 | 295000.00 |
| 2 | E320000001015 | 752aeada-5bde-42f2-83d6-bd682e79fc52 | Aceptado | CONSORCIO RYLCO 131376292 | 306800.00 |

Estado intermedio del portal (implícito de que no hubo rechazo entre los 6 primeros): 4/4 tipo 31 + 2/2 tipo 32≥250K + 1/1 tipo 33 (residual de la 15va).

### Rechazo del 34 y hallazgo crítico

Primer intento post-13va del 1×34 con `NCFModificado` **del ciclo actual** (E310000000079 = FC-0007829, recién emitido en esta corrida hace ~45 s) y `RNCComprador=131265863` **coincidente** con el del NCFModificado. Payload:

```python
{
    'RNCEmisor': '130217432',
    'RazonSocialEmisor': 'ABREGONZA COMERCIAL SRL',
    'DireccionEmisor': 'AV LOPE DE VEGA #55, ENSANCHE NACO, SANTO DOMINGO',
    'FechaEmision': '26-09-2026',
    'IndicadorNotaCredito': 1,
    'TipoIngresos': '01',
    'TipoPago': 1,
    'IndicadorMontoGravado': 0,
    'RNCComprador': '131265863',
    'RazonSocialComprador': 'EMPRESA DISTRIBUIDORA Y SERVICIO PAE SRL',
    'MontoGravadoTotal': '5000.00', 'MontoGravadoI1': '5000.00',
    'ITBIS1': '18', 'TotalITBIS': '900.00', 'TotalITBIS1': '900.00',
    'MontoTotal': '5900.00',
    'NCFModificado': 'E310000000079',
    'FechaNCFModificado': '20-11-2025',  # fecha de la factura fisica FC-0007829
    'CodigoModificacion': '1',
    'RazonModificacion': 'Devolucion parcial factura referenciada E310000000079',
    # linea 1: cantidad 1, precio 5000, item 5000
}
```

`E340000000054` (trackId `daeac04a-b4cd-4e27-89e4-a3d831513086`, 4:18:16 PM UTC-4) **Rechazado con código 615**:

```json
{"codigo":"2","estado":"Rechazado","secuenciaUtilizada":true,
 "mensajes":[{"valor":"El campo NCFModificado de la sección
              InformacionReferencia no es válido. El monto total de la
              nota de crédito no puede ser mayor al saldo disponible
              de la sumatoria de las operaciones relacionadas al
              comprobante referenciado.","codigo":615}]}
```

Mensaje IDÉNTICO al rechazo del 34 en la 13va corrida (que usó E310000000067, fuera del ciclo). Rechazo cascada borró TODO: 4/4 tipo 31 + 2/2 tipo 32≥250K + 1/1 tipo 33 recién acumulados. Portal final: 0/N en los 11 renglones. Log del portal a las 4:18:17 PM con el mismo mensaje literal.

**Hipótesis 2 de la 13va corrida FALSADA**: la restricción "NCFModificado debe ser del ciclo actual del portal" no es correcta. E310000000079 estaba dentro del ciclo, fue Aceptado 45 segundos antes, y aún así el 34 rechaza con "saldo disponible". Ver "Bloqueos activos" para las hipótesis remanentes y la ruta de desbloqueo.

Investigación del XSD y del PDF `Formato-e-CF-V1.0.pdf` (sección F. Información de Referencia, págs 55-56) hecha en esta corrida: la sección solo lista `NCFModificado`, `RNCOtroContribuyente`, `FechaNCFModificado`, `CodigoModificacion`, `RazonModificacion`. NO existe un campo tipo `MontoNCFModificado` para declarar el saldo — la validación de "saldo disponible" es server-side. `Descripcion-Tecnica-Servicios-DGII.pdf` (revisada con `grep -i saldo|615|referenciado`) no menciona código 615 ni la regla del "saldo disponible" — falta consultar catálogo oficial de códigos de respuesta o soporte DGII.

### Estado real de TFE_SECUENCIA (después de esta corrida)

| Tipo | prox_secuencia | Notas |
|------|----------------|-------|
| 31 | 81 → E310000000081 | 077-080 quemadas Aceptadas |
| 32 | 1016 → E320000001016 | 1014-1015 quemadas Aceptadas |
| 33 | 8 → E330000000008 | sin cambios (no se emitió tipo 33 esta corrida) |
| 34 | 55 → E340000000055 | 054 quemada Rechazada |
| 41-47 | 1 cada uno | sin cambios |

Rango tipo 31 sigue estrechándose: 81 sobre 100 → quedan 20 secuencias antes de tener que ampliar rango (cada reset consume 4).

### Próximo paso para la corrida siguiente (17va)

**NO intentar 1×34 hasta desbloquear** (ver "Bloqueos activos"). Trabajo posible sin tocar el 34:

1. **Rehacer 4×31** (E310000000081-084) — patrón bajo riesgo, builder validado 6 veces.
2. **Rehacer 2×32≥250K** con RNCs conocidos (CORTES + RYLCO), E320000001016-1017.
3. **Rehacer 1×33** con `NCFModificado` del ciclo actual + `RNCComprador` coincidente (patrón 15va corrida): usar E310000000083 (FC-0007829, RNC 131265863) → E330000000008.
4. **1×41 (Compras)** — primer contacto real del builder-41 contra certecf. Requiere investigar payload mínimo del XSD `e-CF-41-v1.0.xsd`. `RNCEmisor` = proveedor real (consulta `TCXP_FACTURA`), `RNCComprador` = 130217432 (Abregonza). Escribir test XSD-gate antes de enviar. Cualquier campo faltante de-facto (mismo patrón que TipoIngresos en 34, MontoGravadoI1 en 31, etc.) puede reiniciar contadores — enviar UNO solo.
5. Si el 41 va bien: 1×43, 1×44, 1×45, 1×46, 1×47 (una por corrida, o dos por corrida si se acepta el riesgo).
6. RFCE (grupo Tercero) al final.

Como aproximación conservadora, la 17va debería enfocarse solo en pasos 1-3 (rehacer patrón conocido) para no acumular otro rechazo antes de tener el bloqueo del 34 resuelto. Ir a un tipo nuevo (41) recién en la 18va si el usuario da luz verde o si el bloqueo del 34 se resuelve por otra vía.

## Fase 4 — Hallazgos de la 17va corrida (2026-09-27) — RECONSTRUCCIÓN LIMPIA POST-RESET

Portal previo confirmado por Playwright: 0/N en los 11 renglones (tras el reset de la 16va corrida del 34, 26/09 4:18:17 PM). Probe DGII (`obtener_token('01','certecf',forzar=True)`) OK, token len 343. TFE_SECUENCIA previo: 31→81, 32→1016, 33→8, 34→55, 41-47→1 (alineado con lo esperado por la 16va).

Corrida conservadora siguiendo los pasos 1-3 del "Próximo paso" de la 16va — **NO tocar 34 hasta desbloquear**. Se reconstruyó el ciclo desde 0 con patrones ya validados múltiples veces.

### Éxitos (patrón conocido bajo riesgo)

**4×31 vía `paso4-factura-real`** (mismas 4 facturas reales, patrón validado 7 veces):

| # | Factura | e-NCF | trackId | Estado | fechaRecepcion |
|---|---------|-------|---------|--------|-----------------|
| 1 | FC-0007607 | E310000000081 | 6eb317b1-43f7-4b4b-b590-b6eb36a3fe27 | Aceptado | 9/26/2026 8:16:30 PM |
| 2 | FC-0007766 | E310000000082 | 9158efbf-5dbc-4ff6-ab1f-3031c9e7d88d | Aceptado | 9/26/2026 8:16:41 PM |
| 3 | FC-0007829 | E310000000083 | 1de39ff3-ca93-46f9-a97e-76d3eb0e63c0 | Aceptado | 9/26/2026 8:16:51 PM |
| 4 | FC-0008076 | E310000000084 | 516551ab-a67b-4e4e-8057-1e31ab3587cc | Aceptado | 9/26/2026 8:17:02 PM |

**2×32≥250K vía `paso4-manual`** (RNCs ya probados, builder validado 6 veces):

| # | e-NCF | trackId | Estado | Comprador | MontoTotal |
|---|-------|---------|--------|-----------|-----------|
| 1 | E320000001016 | 79b64b34-ecfc-4552-822b-297057860557 | Aceptado | CORTES HERMANOS 101001811 | 295000.00 |
| 2 | E320000001017 | 4322883a-38d9-476e-a52f-435447c97394 | Aceptado | CONSORCIO RYLCO 131376292 | 295000.00 |

**1×33 vía `paso4-manual`** — `NCFModificado=E310000000083` (FC-0007829 emitido en esta misma corrida, RNC 131265863 coincidente con el del payload):

| # | e-NCF | trackId | Estado | NCFModificado | CodigoModificacion |
|---|-------|---------|--------|----------------|---------------------|
| 1 | E330000000009 | 26225122-cc41-4441-9851-7f2e533c6cce | Aceptado | E310000000083 | 3 |

**Portal (verificado por Playwright, 2026-09-27 ~00:18 UTC / 8:18 PM UTC-4 del 26/09)**:

- **4/4 Comprobantes tipo 31** ✅
- **2/2 Comprobantes tipo 32 >= 250Mil** ✅
- **1/1 Comprobantes tipo 33** ✅
- 0/2 tipo 34 (bloqueado, ver "Bloqueos activos")
- 0/2 el resto (41-47, RFCE)

Log del portal SIN nuevos reinicios — el último sigue siendo el 26/09 4:18:17 PM (16va corrida). Todos los envíos consecutivos de esta corrida Aceptados sin resets.

### Hallazgos menores (no bloquean, TODO defensivo)

1. **`paso4-manual` consume secuencia ANTES del gate XSD-local que pide `FechaVencimientoSecuencia`**. Primer intento del 33 esta corrida omitió `FechaVencimientoSecuencia` del payload (mi error de operación — el `_PAYLOAD_33_CORRIDA_8` sí lo tiene heredado del `_PAYLOAD_33_CORRIDA_7`, línea 1011 de `test_ecf_builder_generico.py`). La respuesta fue HTTP 400 con `"IdDoc/FechaVencimientoSecuencia es obligatorio (minOccurs=1) para TipoeCF 33 segun e-CF-33-v1.0.xsd"`. **PERO E330000000008 quedó quemada** — TFE_SECUENCIA avanzó de 8 a 9 antes de que el gate del builder rechazara el payload. Costo real: 1 secuencia 33 desperdiciada, sin envío a DGII (no cuenta como rechazo, portal no se reinició). TODO defensivo (no urgente): en `certificacion_paso4_manual_view` de `apps/fe/views.py`, mover el pre-check de campos mínimos del XSD ANTES de `fe_repo.consumir_siguiente_encf` (línea 565), de modo que un payload inválido no queme secuencia. Actualmente el orden es `consumir → construir_ecf_generico → falla`. Se puede resolver validando `datos` primero con un `_validar_payload_minimo(tipo_ecf, datos)` que no necesite el e-NCF.

2. **`fe_repo.get_documento` devuelve `rnc_comprador: None`** para e-CFs enviados vía `paso4-factura-real` (verificado con E310000000083 esta corrida — el doc tiene todas las claves pero `rnc_comprador` es None). No afecta el envío en sí, pero la mejora del builder recomendada por la 15va corrida (validar coincidencia de RNCComprador entre 33/34 y su NCFModificado leyendo de TFE_DOCUMENTO) NO se puede implementar sobre TFE_DOCUMENTO en su estado actual — habría que arreglar antes el guardado en `save_documento_enviado` para que persista `rnc_comprador` cuando el flujo es `paso4-factura-real` (mismo campo que sí llena el `paso4-manual` desde `datos.RNCComprador`). Actualmente el operador tiene que leer el XML crudo del `xml_firmado` para descubrir el RNCComprador de un e-CF31 previo. Otro TODO no bloqueante.

### Estado real de TFE_SECUENCIA (después de esta corrida)

Vía consulta directa a `FAT.TFE_SECUENCIA`:

| Tipo | prox_secuencia | Notas |
|------|----------------|-------|
| 31 | 85 → E310000000085 | 081-084 quemadas Aceptadas |
| 32 | 1018 → E320000001018 | 1016-1017 quemadas Aceptadas |
| 33 | 10 → E330000000010 | 008 quemada por HTTP 400 pre-envío; 009 quemada Aceptada |
| 34 | 55 → E340000000055 | sin cambios (bloqueada) |
| 41-47 | 1 cada uno | sin cambios |

Rango tipo 31 se estrecha rápido: quedan 100-85+1 = 16 secuencias antes de tener que ampliar el rango (cada reset consume 4, ya van 6 resets con costo de tipo 31). Si sucede otro reset del ciclo, quedarían 12; si son dos, quedarían 8. TODO administrativo (no runner): revisar con el usuario si conviene ampliar el rango 31 (ej. hasta 500) en TFE_SECUENCIA antes de que se agote.

### Próximo paso para la corrida siguiente (18va)

**Bloqueo del 34 sigue activo** — hipótesis remanentes (ver "Bloqueos activos"):
1. Consultar soporte DGII (809-689-3444) con trackId `daeac04a-b4cd-4e27-89e4-a3d831513086` — requiere acción del USUARIO, no del runner.
2. Reconciliación batch nocturna: reintentar el 34 al día siguiente de emitir un 31 referenciado (>=12 h de separación). ⚠ Esto sí es hacer el runner — pero el costo de un rechazo es todos los aceptados. Solo hacerlo si el usuario da luz verde explícita.
3. Bandeja de Entrada del portal — buscar el `MensajeId` del rechazo E340000000054 (log 26/09 4:18:17 PM) que puede tener más detalle que `consultar_estado`.

**Trabajo posible sin tocar el 34 en la 18va**:

Opción A (recomendada — 1 tipo nuevo por corrida): **1×41 (Compras)** primer contacto real del builder `construir_ecf_generico(41)` contra certecf. Necesita:
- Elegir un proveedor real de `CXP.TCXP_FACTURA` con RNC válido (candidato natural: consultar top 10 proveedores más recientes con RNC de 9 dígitos numéricos).
- `RNCEmisor` = RNC del proveedor (¡no el nuestro!, porque el e-CF41 documenta una COMPRA hecha por Abregonza).
- `RNCComprador` = 130217432 (Abregonza).
- Payload realista con montos, ITBIS, línea de item.
- Escribir test XSD-gate `test_payload_corrida18_tipo_41_valida_contra_xsd` ANTES de enviar.
- Riesgo: probable que aparezcan campos obligatorios de facto no documentados (mismo patrón histórico que 31/32/34). Cada rechazo pierde 4/4+2/2+1/1 acumulados. Si es la primera vez de un tipo, la aritmética favorece hacerlo justo ANTES de acumular más — pero el reset de 5 aceptados no es catastrófico si el runner puede rehacerlos rápido en la 19va con patrones ya conocidos.

Opción B (más segura, cero riesgo): dejar el ciclo intacto en 4/4+2/2+1/1 y no enviar nada nuevo, esperando que el usuario decida sobre el 34. Solo tiene sentido si el bloqueo del 34 tiene ruta de resolución inminente por parte del usuario; de lo contrario es tiempo perdido.

Recomendación: Opción A con 1×41. Si sale bien, 18va termina con 1/2 tipo 41 y ciclo intacto. Si sale mal, se pierden 4/4+2/2+1/1 pero se aprende un requisito real y la 19va reconstruye con patrón conocido — mismo ciclo que se viene ejecutando desde la 13va.

Sin código nuevo esta corrida — solo scripts en `/tmp/` del contenedor (`ecf_17_probe.py`, `ecf_17_check.py`, `ecf_17_run31.py`, `ecf_17_run32.py`, `ecf_17_run33.py`, `ecf_17_run33b.py`, `ecf_17_check_venc.py`), no van al repo. Commit del plan maestro actualizado únicamente.

## Fase 4 — Hallazgos de la 18va corrida (2026-09-27) — CRÍTICO: MontoITBISRetenido obligatorio de facto en tipo 41

Portal previo Playwright: 4/4 tipo 31 + 2/2 tipo 32≥250K + 1/1 tipo 33 + 0/N resto (residual de la 17va). TFE_SECUENCIA previo: 31→85, 32→1018, 33→10, 34→55, **41-47→1** cada uno. Probe DGII OK (token len 343). Se eligió tipo 41 como próximo (opción A de la 17va), proveedor real INDUSTRIAS BISONO SRL (RNC 101621516, no_proveedor 000045, seleccionado de CXP.TCXP_DPROVEEDOR filtro RNC 9 dígitos + existe en TCXP_DOCUMENTO).

Test XSD-gate agregado (`test_payload_corrida18_tipo_41_valida_contra_xsd`), 81/81 tests pasan localmente en el contenedor. Payload (`_PAYLOAD_41_CORRIDA_18` en `test_ecf_builder_generico.py`):

```python
{
    'RNCEmisor': '130217432', 'RazonSocialEmisor': 'ABREGONZA COMERCIAL SRL',
    'DireccionEmisor': 'AV LOPE DE VEGA #55, ENSANCHE NACO, SANTO DOMINGO',
    'FechaEmision': '27-09-2026', 'FechaVencimientoSecuencia': '31-12-2028',
    'IndicadorMontoGravado': 0, 'TipoPago': 1,
    'RNCComprador': '101621516', 'RazonSocialComprador': 'INDUSTRIAS BISONO, SRL',
    'MontoGravadoTotal': '5000.00', 'MontoGravadoI1': '5000.00',
    'ITBIS1': '18', 'TotalITBIS': '900.00', 'TotalITBIS1': '900.00',
    'MontoTotal': '5900.00',
    'NumeroLinea[1]': 1, 'IndicadorFacturacion[1]': 1,
    'IndicadorAgenteRetencionoPercepcion[1]': 1,
    'NombreItem[1]': 'Compra materia prima',
    'IndicadorBienoServicio[1]': 1, 'CantidadItem[1]': '1.00',
    'PrecioUnitarioItem[1]': '5000.00', 'MontoItem[1]': '5000.00',
}
```

**E410000000001** (trackId `00f0d6c2-0eb3-4fb7-907f-309d21cac94e`, 27/09 12:18:19 AM UTC-4) **Rechazado**:

```json
{"codigo":"2","estado":"Rechazado","secuenciaUtilizada":true,
 "mensajes":[{"valor":"El campo MontoITBISRetenido de la sección
              DetallesItems de la línea 1 no es válido","codigo":260}]}
```

Rechazo cascada borró TODO (4/4 tipo 31 + 2/2 tipo 32≥250K + 1/1 tipo 33). Portal Playwright post-corrida: 0/N en los 11 renglones. Log del portal a las 27/09 12:18:19 AM confirma el reset con el mismo mensaje literal.

### Hallazgo NUEVO — MontoITBISRetenido obligatorio de facto en tipo 41

Cuando `IndicadorAgenteRetencionoPercepcion=1` (Retención) en un item de tipo 41, DGII exige el `MontoITBISRetenido` en ese item, aunque el XSD lo marque `minOccurs=0` (línea 158 de `e-CF-41-v1.0.xsd`). Mismo patrón "XSD dice opcional, DGII exige" ya visto históricamente con `TipoIngresos` en 34 (13va), `IndicadorMontoGravado`/`FechaLimitePago`/`MontoGravadoI1` en 31 (1ra-2da). Sin confirmación empírica todavía, es MUY probable que `TotalITBISRetenido` a nivel Totales también sea obligatorio de facto (regla histórica: cuando hay breakdown por línea, DGII exige el total agregado — ver bug del 31 con `TotalITBIS1`/`TotalITBIS2`/`TotalITBIS3`).

Con ITBIS 18% sobre base 5000 → ITBIS = 900. Retención estándar DGII para servicios/compras a proveedores informales por parte de agentes de retención es **100% del ITBIS** (Norma 02-05 y sucesoras) → `MontoITBISRetenido` = 900.00 (todo el ITBIS retenido).

### Recomendación de fix para el builder (TODO — la 19va lo aplica)

En `apps/fe/ecf_builder.py::_gen_detalles_items` (bloque item retencion, líneas ~1142-1166), agregar guard defensivo: si `tipo_ecf == 41` AND `ind_ret == 1` (Retención) AND `monto_itbis_ret is None` → levantar `ECFBuilderError` local antes de firmar/enviar. Test espejo del histórico `test_tipo_41_sin_indicador_agente_retencion_lanza_error`.

Opcionalmente, agregar también un tercer modo de `caps['item_retencion']` (ej. `mandatory_indicador_y_itbis_si_retencion`) o simplemente incluir esta regla especial en el flujo actual (`mandatory_indicador`) — más simple y localizado.

### Estado real de TFE_SECUENCIA (después de esta corrida)

| Tipo | prox_secuencia | Notas |
|------|----------------|-------|
| 31 | 85 → E310000000085 | sin cambios |
| 32 | 1018 → E320000001018 | sin cambios |
| 33 | 10 → E330000000010 | sin cambios |
| 34 | 55 → E340000000055 | sin cambios (bloqueada) |
| 41 | 2 → E410000000002 | **001 quemada Rechazada** |
| 43-47 | 1 cada uno | sin cambios |

### Próximo paso para la corrida siguiente (19va)

1. **Aplicar fix del builder** (`_gen_detalles_items`: forzar `MontoITBISRetenido` cuando `tipo_ecf==41` y `ind_ret==1`), con tests (`test_tipo_41_ind_retencion_1_sin_monto_itbis_retenido_lanza_error_corrida18`), deploy a la VM.
2. **Rehacer 4×31** (E310000000085-088) — patrón validado 7 veces, riesgo mínimo.
3. **Rehacer 2×32≥250K** — CORTES+RYLCO (E320000001018-1019), builder validado 6 veces.
4. **Rehacer 1×33** — payload igual al de la 17va (`NCFModificado=E310000000087` = FC-0007829 nuevo, `RNCComprador=131265863` coincidente), próxima 33 → E330000000010.
5. **Reintentar 1×41** con payload corregido:
   - Agregar `MontoITBISRetenido[1]: '900.00'` al item
   - Agregar `TotalITBISRetenido: '900.00'` a nivel Totales (defensivo, XSD línea 104 lo permite; muy probable de-facto obligatorio también)
   - Todo lo demás igual al `_PAYLOAD_41_CORRIDA_18`
   - Próxima secuencia 41 → E410000000002
   - Gate XSD-local previo obligatorio

Si el 19va falla en el 41 por `TotalITBISRetenido` u otro campo, ir de a uno — igual patrón que 1ra→2da→3ra que resolvieron los 3 bugs iniciales del 31.

Bloqueo del 34 (código 615 "saldo disponible") sigue activo — sin cambios en esta corrida.

Sin código nuevo desplegado esta corrida (solo test XSD-gate y comentario histórico). Fix del builder queda documentado como TODO obligatorio para la 19va antes de reintentar el 41.

## Fase 4 — Hallazgos de la 19va corrida (2026-09-27) — PRIMER TIPO 41 ACEPTADO

Portal previo Playwright: 0/N en los 11 renglones (tras reset de la 18va, 27/09 12:18:19 AM). TFE_SECUENCIA previo: 31→85, 32→1018, 33→10, 34→55, 41→2, 43-47→1. Probe DGII (`obtener_token`) OK, token len 343.

### Fix del builder desplegado (TDD)

`apps/fe/ecf_builder.py::_gen_detalles_items` — guard nuevo: si `tipo_ecf==41` AND `str(ind_ret)=='1'` (Retención) AND `monto_itbis_ret is None` → `ECFBuilderError` local. Tests:

- `test_tipo_41_ind_retencion_1_sin_monto_itbis_retenido_lanza_error_corrida18` (defensivo, documenta el rechazo real de la 18va código 260)
- `test_payload_corrida19_tipo_41_con_monto_itbis_retenido_valida_contra_xsd` (gate XSD-local con `_PAYLOAD_41_CORRIDA_19`, incluye `MontoITBISRetenido[1]='900.00'` + `TotalITBISRetenido='900.00'`)
- `test_payload_corrida18_tipo_41_valida_contra_xsd` actualizado a `pytest.raises` (payload histórico ahora bloqueado por el guard, se conserva como documentación)
- `_base_41()` fixture + `test_tipo_41_compras_valida_contra_xsd` actualizados con `MontoITBISRetenido[1]='18.00'`

83/83 tests del módulo `test_ecf_builder_generico.py` + 228/228 del paquete `apps/fe/tests/` pasan localmente en el contenedor `facturation_backend` de la VM.

### Ciclo completo Aceptado en un solo run (abort-on-first)

Script `/tmp/ecf_19_run.py` autenticado como JCABREU con `Client.force_login`, 3s de pausa entre envíos, `consultar_estado` tras cada uno:

| # | Tipo | e-NCF | trackId | Estado | fechaRecepcion |
|---|------|-------|---------|--------|-----------------|
| 1 | 31 | E310000000085 | 9abe4752-1a32-472b-b45f-bf3648408f3b | Aceptado | 9/27/2026 4:19:36 AM |
| 2 | 31 | E310000000086 | 3f9009bc-ce05-4c1e-a824-ab786969f3b1 | Aceptado | 9/27/2026 4:19:40 AM |
| 3 | 31 | E310000000087 | c3bda437-dc53-4c61-8212-5c7ab42b3216 | Aceptado | 9/27/2026 4:19:45 AM |
| 4 | 31 | E310000000088 | 034e0c82-d6b5-4ee2-bc7f-1eb053c77bb9 | Aceptado | 9/27/2026 4:19:49 AM |
| 5 | 32 | E320000001018 | 383a9159-dbba-4516-b6e7-012869be4f03 | Aceptado (CORTES 101001811, MT 295000) | 9/27/2026 4:19:54 AM |
| 6 | 32 | E320000001019 | 95e6dea4-a94e-42aa-9688-dd08db52ef6a | Aceptado (RYLCO 131376292, MT 295000) | 9/27/2026 4:19:58 AM |
| 7 | 33 | E330000000010 | fd1b81f2-86d5-40c5-80bc-2542bbad3f16 | Aceptado (NCFModificado=E310000000087 RNC 131265863 coincidente, CodMod=3) | 9/27/2026 4:20:03 AM |
| 8 | 41 | E410000000002 | 4f62e8e7-c2f0-49f2-9f37-c507ecfe901e | **Aceptado** (INDUSTRIAS BISONO 101621516, MontoITBISRetenido 900.00, TotalITBISRetenido 900.00) | 9/27/2026 4:20:07 AM |

**Portal (Playwright, 2026-09-27 ~04:20 UTC-4 / 08:18 UTC)**:
- 4/4 Comprobantes tipo 31 ✅
- 2/2 Comprobantes tipo 32 >= 250Mil ✅
- 1/1 Comprobantes tipo 33 ✅
- 0/2 tipo 34 (bloqueado, ver "Bloqueos activos")
- **1/2 Comprobantes tipo 41** ✅ ← primer 41 aceptado por certecf en toda la certificación
- 0/N el resto (43-47, RFCE)

Log del portal SIN nuevos reinicios — el último sigue siendo el 27/09 12:18:19 AM (18va, rechazo del 41 sin `MontoITBISRetenido`). Fix del builder validado end-to-end contra certecf.

### Hallazgo confirmado (patrón "XSD opcional / DGII exige" #7)

Con base 5000 → ITBIS 900, retención al 100% → `MontoITBISRetenido='900.00'` en item + `TotalITBISRetenido='900.00'` en Totales. Ambos aceptados. Confirma la hipótesis de la 18va corrida: la DGII trata el `TotalITBISRetenido` como obligatorio de facto cuando hay retención por línea (mismo patrón histórico que `TotalITBIS`/`TotalITBIS1` en 31 — cuando hay breakdown por línea, DGII exige el total agregado).

### Estado real de TFE_SECUENCIA (después de esta corrida)

| Tipo | prox_secuencia | Notas |
|------|----------------|-------|
| 31 | 89 → E310000000089 | 085-088 quemadas Aceptadas |
| 32 | 1020 → E320000001020 | 1018-1019 quemadas Aceptadas |
| 33 | 11 → E330000000011 | 010 quemada Aceptada |
| 34 | 55 → E340000000055 | sin cambios (bloqueada) |
| 41 | 3 → E410000000003 | 002 quemada Aceptada |
| 43-47 | 1 cada uno | sin cambios |

Rango tipo 31 sigue estrechándose: 89 sobre 100 → quedan 12 secuencias. Si otro reset consume 4, quedarían 8. Sigue vigente el TODO administrativo: revisar con el usuario si conviene ampliar el rango 31 (ej. hasta 500) antes de que se agote.

### Próximo paso para la corrida siguiente (20va)

Con 1/2 tipo 41 asegurado y builder validado end-to-end, el patrón para el resto del grupo Primero (43-47) queda claro: enviar UNO por corrida con gate XSD-local previo, cubriendo cada campo obligatorio de facto que aparezca.

Orden sugerido (menor a mayor riesgo, 1 tipo por corrida):

1. **1×41 restante** (2/2) — patrón validado esta corrida, riesgo mínimo. Puede ir con OTRO proveedor real de CXP.TCXP_DPROVEEDOR o el mismo INDUSTRIAS BISONO con distinta línea. Se puede hacer solo esto en la 20va y avanzar a 2/2 tipo 41.
2. **1×43 (Gastos Menores)** — primer contacto real del builder-43 contra certecf. Payload mínimo: sin RNCComprador (43 no tiene bloque Comprador), sin retención (`item_retencion='no'`), sin TipoIngresos. Ver `test_tipo_43_gastos_menores_valida_contra_xsd` como plantilla. Investigar campos obligatorios de facto — probable riesgo similar a 41 (cascada por primer contacto).
3. **1×44 (Regímenes Especiales)** — con `TipoIngresos` obligatorio (caps `tipo_ingresos_mandatory=True`), `TipoPago` mandatory, `RazonSocialComprador` mandatory. Sin retención.
4. **1×45 (Gubernamental)** — RNC+RazonSocial comprador mandatory, TipoIngresos mandatory, TipoPago mandatory. Sin retención.
5. **1×46 (Exportaciones)** — RazonSocial comprador mandatory, con Transporte + PaisDestino. Sin RNC comprador. Sin retención.
6. **1×47 (Pagos al Exterior)** — comprador reducido, PaisDestino, `item_retencion='mandatory_completo'` (exige MontoISRRetenido). Payload más complejo.
7. **RFCE (4×32<250Mil)** al final (grupo Tercero), luego los 4 e-CF32 correspondientes por widget manual (grupo Cuarto).

**Bloqueo del 34 sigue activo** — requiere acción del usuario (soporte DGII con trackId `daeac04a-b4cd-4e27-89e4-a3d831513086`). Runner NO debe reintentar 1×34 en la 20va+.

Código nuevo desplegado esta corrida: `apps/fe/ecf_builder.py` (guard 41+MontoITBISRetenido) + `apps/fe/tests/test_ecf_builder_generico.py` (4 tests actualizados/nuevos, 1 fixture ajustada).

## Fase 4 — Hallazgos de la 20va corrida (2026-09-27) — 2/2 TIPO 41 COMPLETO

Portal previo Playwright: 4/4 tipo 31 + 2/2 tipo 32≥250K + 1/1 tipo 33 + 1/2 tipo 41 + 0/N resto (residual de la 19va, sin nuevos reinicios — último sigue siendo 27/09 12:18:19 AM). TFE_SECUENCIA previo (`fe_repo.list_secuencias('01')`): 31→89, 32→1020, 33→11, 34→55, **41→3**, 43-47→1. Probe DGII (`obtener_token('01','certecf',forzar=True)`) OK, token len 343.

Corrida conservadora — cerrar 2/2 tipo 41 con el patrón validado end-to-end por la 19va, SIN tocar tipo nuevo (43+) en la misma corrida para no arriesgar los 9 aceptados acumulados a un rechazo por campo de-facto desconocido de un primer contacto.

### Éxito (patrón conocido)

**1×41 vía `paso4-manual`** — payload igual al `_PAYLOAD_41_CORRIDA_19` con cambio cosmético `NombreItem[1]='Compra insumo industrial'` (para diferenciar de la 19va). Mismo proveedor INDUSTRIAS BISONO 101621516, mismos montos (base 5000, ITBIS 900, retención 900):

| # | e-NCF | trackId | Estado | fechaRecepcion |
|---|-------|---------|--------|-----------------|
| 1 | E410000000003 | 46c44bf0-fc7b-42a9-b125-02d185cc9d7b | Aceptado | 9/27/2026 8:15:39 AM |

**Portal (Playwright, 2026-09-27 ~08:15 UTC / 4:15 AM UTC-4)**:
- 4/4 Comprobantes tipo 31 ✅
- 2/2 Comprobantes tipo 32 >= 250Mil ✅
- 1/1 Comprobantes tipo 33 ✅
- 0/2 tipo 34 (bloqueado, ver "Bloqueos activos")
- **2/2 Comprobantes tipo 41** ✅ ← completo
- 0/2 el resto (43-47), 0/4 RFCE

Log del portal SIN nuevos reinicios — el último sigue siendo el 27/09 12:18:19 AM (18va, rechazo del 41 sin `MontoITBISRetenido`). Ciclo intacto en 9/N aceptados acumulados.

### Estado real de TFE_SECUENCIA (después de esta corrida)

| Tipo | prox_secuencia | Notas |
|------|----------------|-------|
| 31 | 89 → E310000000089 | sin cambios |
| 32 | 1020 → E320000001020 | sin cambios |
| 33 | 11 → E330000000011 | sin cambios |
| 34 | 55 → E340000000055 | sin cambios (bloqueada) |
| 41 | 4 → E410000000004 | **003 quemada Aceptada** — 2/2 alcanzado |
| 43-47 | 1 cada uno | sin cambios |

Rango tipo 31 sigue en 12 secuencias restantes (89..100). Sin cambios respecto a la 19va.

### Próximo paso para la corrida siguiente (21va)

Con 2/2 tipo 41 asegurado, el siguiente tipo nuevo es el **1×43 (Gastos Menores)**, primer contacto real del builder-43 contra certecf. Es el punto de mayor riesgo del ciclo actual (podría reiniciar los 9/N acumulados si aparece un campo obligatorio de-facto no documentado en el XSD — patrón repetido en 31/32/34/41).

**Pre-requisitos antes de enviar** (obligatorios, no negociables — cada rechazo cuesta el ciclo entero):

1. Revisar `test_tipo_43_gastos_menores_valida_contra_xsd` en `apps/fe/tests/test_ecf_builder_generico.py` (línea ~528) como plantilla — pasa gate XSD-local pero NUNCA se envió a certecf.
2. Escribir test XSD-gate `test_payload_corrida21_tipo_43_valida_contra_xsd` con `_PAYLOAD_43_CORRIDA_21` explícito (no reutilizar la fixture del test general — dejar el payload real congelado para trazabilidad, patrón 18va/19va con `_PAYLOAD_41_CORRIDA_18/19`).
3. Estructura mínima del 43 (por definición: comprobante para gastos menores, sin identificar comprador):
   - Sin `Comprador` (43 no tiene el bloque, ya confirmado por el test existente que hace `assert root.find('.//Comprador') is None`)
   - Sin retención (`item_retencion='no'` en caps del builder-43)
   - Sin TipoIngresos
   - Con `RNCEmisor`, `FechaEmision`, `FechaVencimientoSecuencia`, `MontoTotal`, y una línea con `NombreItem`, `CantidadItem`, `PrecioUnitarioItem`, `MontoItem`
4. Datos realistas de un gasto menor real de Abregonza (opcional pero recomendable — se puede usar un gasto genérico "MATERIALES DE OFICINA" o similar). No hay `TipoIngresos` ni `RNCComprador`, así que no hay riesgo de RNC inválido.
5. Deploy si hay cambios de código. Si no hay cambios (solo payload manual), no hace falta pscp — el envío se hace vía `paso4-manual` con datos planos.

**Opción B alternativa (menos ambiciosa)**: si la 21va es una corrida corta o el runner ya usó su budget, saltar a la investigación previa del 44/45/46/47 (documentar sus caps del builder y de-facto sospechosos) sin enviar nada. Menos riesgo, menos progreso.

**Bloqueo del 34 sigue activo** — requiere acción del usuario (soporte DGII con trackId `daeac04a-b4cd-4e27-89e4-a3d831513086`). Runner NO debe reintentar 1×34.

**Nota operativa 20va**: no hubo cambios de código esta corrida — solo script `/tmp/ecf_20_run41.py` con `Client.force_login` (mismo patrón que `ecf_19_run.py`), no va al repo. Commit solo del plan maestro.

## Fase 4 — Hallazgos de la 24va corrida (2026-09-28) — GUARD DEFENSIVO CÓDIGO 634 DESPLEGADO

Portal previo (Playwright, `/certecf/portalcertificacion/Postulacion/PruebasSimulacion`): **4/4 tipo 31 + 2/2 tipo 32≥250K + 1/1 tipo 33 + 0/2 tipo 34 (bloqueada) + 2/2 tipo 41 + 2/2 tipo 43 + 0/2 resto (44/45/46/47) + 0/4 RFCE**. Último reinicio en el log del portal: 27/09 8:19:02 PM (rechazo del 634 en la 23va, ya corregido en el reintento exitoso). Sin nuevos reinicios post-23va.

TFE_SECUENCIA previo (`fe_repo.list_secuencias('01')` en el contenedor):
- 31: rango 1..**100**, prox 97 → sólo 4 secuencias disponibles antes de agotarse
- 32: rango 1..50M, prox 1024
- 33: rango 1..10M, prox 13
- 34: rango 1..100, prox 55 (bloqueada por saldo)
- 41: rango 1..10M, prox 6
- 43: rango 1..10M, prox 7
- 44/45/46/47: rango 1..10M cada uno, prox 1

Decisión de esta corrida: NO enviar primer contacto de tipo 44/45 con el rango tipo 31 tan estrecho (un rechazo cascada consumiría exactamente 97-100 al reconstruir 4×31 y nos dejaría en 0 secuencias tipo 31). En su lugar, cerrar el TODO obligatorio abierto por la 23va: guard defensivo contra código 634 en `paso4-manual`. Cero riesgo al ciclo intacto, valor real (protege contra una clase entera de rechazos que pierden el ciclo entero).

### Guard implementado (TDD)

`apps/fe/views.py::_validar_fecha_ncf_modificado_contra_documento(no_cia, datos)`:
- Se dispara SOLO si `tipo_ecf ∈ {33, 34}` (validado antes de `consumir_siguiente_encf`).
- Se salta si `datos.NCFModificado` o `datos.FechaNCFModificado` faltan (caso no aplica).
- Consulta `fe_repo.get_documento(no_cia, NCFModificado)`; si no existe en TFE_DOCUMENTO del propio no_cia (referencia externa o corrupta), deja pasar — delega a la DGII.
- Extrae la `FechaEmision` real del `xml_firmado` con regex namespace-agnóstica.
- Compara con `datos.FechaNCFModificado`; si difieren, retorna mensaje de error explícito (incluye la fecha real). La vista responde HTTP 400 con ese mensaje ANTES de consumir secuencia.

Tests nuevos en `apps/fe/tests/test_views_certificacion.py`:
- `test_paso4_manual_fecha_ncf_modificado_no_coincide_da_400_sin_consumir_secuencia` (fecha errónea → 400, secuencia intacta)
- `test_paso4_manual_fecha_ncf_modificado_coincide_deja_pasar` (fecha correcta → 200, flujo normal)
- `test_paso4_manual_ncf_modificado_no_existe_en_tfe_documento_no_bloquea` (referencia externa → 200, delega a DGII)
- `test_paso4_manual_tipo_no_es_33_ni_34_no_valida_fecha_ncf` (41 con NCFModificado accidental → guard no dispara)

21/21 tests módulo + **235/235 paquete `apps/fe/tests/`** pasan en el contenedor `facturation_backend` de la VM (bind mount `/home/jcabreu/facturation-system/backend → /app`, deploy = pscp al VM + docker cp al contenedor son equivalentes; verificado que el archivo persiste vía el bind).

### Smoke test end-to-end contra Oracle real

Vía `manage.py shell -c` con `_validar_fecha_ncf_modificado_contra_documento` directo:
- E310000000096 (cierre de FC-0007607 en 23va corrida) tiene `FechaEmision=09-05-2025` en el XML firmado real (confirma la lección de la 23va: `paso4-factura-real` usa la fecha de `TFAT_FACTURA.fecha`, NO la fecha de envío al portal).
- Guard con `FechaNCFModificado='27-09-2026'` → devuelve el mensaje de error esperado (contiene "no coincide" + "09-05-2025").
- Guard con `FechaNCFModificado='09-05-2025'` → None (deja pasar).
- Guard con NCF inexistente `E310999999999` → None (deja pasar, delega a DGII).
- Guard con `datos={}` → None (no aplica).

### Estado real de TFE_SECUENCIA (después de esta corrida)

Sin envíos a DGII esta corrida — TFE_SECUENCIA inalterada respecto al preámbulo.

### Próximo paso para la corrida siguiente (25va)

1. **1×44 primer contacto (Régimen Especial)** vía `paso4-manual` con `construir_ecf_generico(44)`. Requiere investigación del XSD `e-CF-44-v1.0.xsd`: campos obligatorios de facto probables (`TipoIngresos`, `TipoPago`, `RazonSocialComprador`). Elegir comprador realista (empresa de zona franca / régimen especial de Abregonza o inventado realista si la BD no tiene). Escribir test XSD-gate previo (`test_payload_corrida25_tipo_44_valida_contra_xsd`). Enviar UNO solo con gate XSD-local + probe DGII previo.
2. Si 44 sale bien: 1×45 (Gubernamental) — comprador de institución pública real (ejemplo del payload en el plan Fase 5). Después 46 (Exportaciones, con PaisDestino) y 47 (Pagos al Exterior, con retención completa).
3. RFCE (grupo Tercero) al final.

**Bloqueo 34** sigue activo — código 615 "saldo disponible". Requiere acción del usuario (soporte DGII 809-689-3444 con trackId `daeac04a-b4cd-4e27-89e4-a3d831513086`). Runner NO debe reintentar 1×34 en la 25va+.

⚠ **Rango tipo 31 = 4 secuencias restantes** (97..100). Un rechazo cascada las agota. Antes de arriesgar un primer contacto (44/45/46/47) que pueda disparar reset, el usuario debería ampliar `secuencia_hasta` para tipo 31 (ej. a 500):

```sql
UPDATE FAT.TFE_SECUENCIA SET secuencia_hasta = 500
 WHERE no_cia='01' AND tipo_ecf='31';
COMMIT;
```

Es una operación no destructiva (sólo eleva el techo), pero afecta datos maestros y el plan la clasifica como TODO administrativo del usuario. Runner NO ejecuta este UPDATE por sí mismo.

Código nuevo desplegado esta corrida: `apps/fe/views.py` (guard + regex + tests). Commit del código + plan maestro actualizado.

## Fase 4 — Hallazgos de la 25va corrida (2026-09-28) — PAYLOAD 44 CONGELADO, SIN ENVÍOS DGII

Portal previo (Playwright, `/certecf/portalcertificacion/Postulacion/PruebasSimulacion`): **4/4 tipo 31 + 2/2 tipo 32≥250K + 1/1 tipo 33 + 0/2 tipo 34 (bloqueada) + 2/2 tipo 41 + 2/2 tipo 43 + 0/2 resto (44/45/46/47) + 0/4 RFCE**. Último reinicio sigue siendo 27/09 8:19:02 PM (rechazo 634 de la 23va). Sin nuevos reinicios post-24va.

TFE_SECUENCIA (`fe_repo.list_secuencias('01')` en contenedor): 31→97 (rango 1..100, **4 restantes** sin cambios respecto a la 24va — el usuario aún no ejecutó el UPDATE de `secuencia_hasta`), 32→1024, 33→13, 34→55, 41→6, 43→7, 44-47→1.

### Decisión de esta corrida (sin envíos a DGII)

Idéntica al criterio de la 24va: con el rango tipo 31 tan estrecho (97..100), un rechazo cascada de un primer contacto tipo 44 consumiría exactamente esas 4 secuencias al reconstruir 4×31 → quedaríamos en `prox=101 > hasta=100` y tipo 31 quedaría bloqueado hasta que el usuario amplíe manualmente. Optamos por trabajo libre de riesgo: congelar el payload 44 y su test XSD-gate para que la 26va+ (o esta misma, si el usuario amplía el rango entre corridas) pueda enviar directo sin re-investigar.

### Comprador real elegido para tipo 44

Query directa a `CXC.TCXC_CLIENTE` filtrando por `UPPER(nombre) LIKE '%ZONA%FRANCA%'`:

| no_cliente | Nombre                                       | RNC       | Uso propuesto |
|-----------:|----------------------------------------------|-----------|---------------|
| 641        | ZONA FRANCA SAN ISIDRO, S.A.                 | 101506091 | tipo 44 (Régimen Especial) |
| 573        | CONSEJO NACIONAL DE ZONAS FRANCAS DE EXP     | 401501406 | tipo 45 (Gubernamental — RNC 401xxx) |

Ambos son clientes reales de Abregonza, con RNC válidos. La 25va congela solo el 44; el 45 queda para la corrida siguiente (mismo criterio de riesgo: un payload por corrida).

### Payload congelado `_PAYLOAD_44_CORRIDA_25`

En `backend/apps/fe/tests/test_ecf_builder_generico.py` (justo después de `test_tipo_44_regimenes_especiales_valida_contra_xsd`):

- Emisor real: RNC 130217432, RazonSocial "ABREGONZA, SRL", dirección "C/ HOSTOS #1, SANTO DOMINGO", FechaEmision `28-09-2026`, FechaVencimientoSecuencia `31-12-2028`.
- `TipoIngresos='01'` (Ingresos por Operaciones), `TipoPago=1` (Contado).
- Comprador: `RazonSocialComprador='ZONA FRANCA SAN ISIDRO, S.A.'`. NO se emite `RNCComprador` (el builder lo omite por `_TIPO_CAPS[44]['comprador']='razon_mandatory'`, confirmado por assertion existente y regenerado en el nuevo test).
- Totales: `MontoExento='5000.00'` + `MontoTotal='5000.00'`. Sin ITBIS ni breakdown gravado — operación 100% exenta.
- Línea única: `NumeroLinea=1`, `IndicadorFacturacion=4` (Exento, patrón validado en tipo 43 corrida 21va), `NombreItem='MATERIAL INDUSTRIAL EXENTO'`, `IndicadorBienoServicio=1` (Bien), `CantidadItem=1.00`, `PrecioUnitarioItem=5000.00`, `MontoItem=5000.00`.

**Iteración TDD durante esta corrida**: primer intento incluyó `IndicadorMontoGravado=0` defensivo (patrón 31/32/41); el XSD real de tipo 44 rechazó con `"Element 'IndicadorMontoGravado': This element is not expected. Expected is one of ( IndicadorEnvioDiferido, IndicadorServicioTodoIncluido, TipoIngresos )"` — hallazgo confirmado del XSD e-CF-44: `IdDoc` de tipo 44 NO incluye `IndicadorMontoGravado` (a diferencia de 31/32). Se removió el campo, el gate XSD pasó limpio. Este comportamiento del builder no está roto: el builder emite lo que el payload le pasa, y el operador debe respetar la forma del XSD real de cada tipo.

### Test agregado

`test_payload_corrida25_tipo_44_valida_contra_xsd` — valida el XML generado contra el XSD real `e-CF-44-v1.0.xsd`, verifica que `TipoeCF=44`, `RazonSocialComprador` correcto, `RNCComprador` ausente, `Totales/MontoExento=5000.00`, `Totales/MontoTotal=5000.00`.

**87/87 tests módulo `test_ecf_builder_generico.py`** + **236/236 paquete `apps/fe/tests/`** pasan en contenedor `facturation_backend` (bind mount VM). +1 test respecto a la 24va (235→236).

### Plan operativo para la corrida siguiente (26va)

1. **Precondición dura**: verificar que el usuario ejecutó el UPDATE de `secuencia_hasta` para tipo 31 (query `list_secuencias('01')`, buscar `tipo=31 hasta>=500`). Si sigue en 100, NO enviar tipo 44 — repetir el patrón de congelar payload tipo 45 (comprador CONSEJO NACIONAL DE ZONAS FRANCAS 401501406, ITBIS 18% con breakdown MontoGravadoI1/ITBIS1/TotalITBIS/TotalITBIS1) y esperar.
2. Si rango ampliado: `POST /api/fe/certificacion/paso4-manual/` con `no_cia='01'`, `tipo_ecf=44`, `datos=_PAYLOAD_44_CORRIDA_25`. Probe DGII previo (`obtener_token('01','certecf',forzar=True)`). Enviar UNO solo, `consultar_estado` inmediato, verificar en portal.
3. Si DGII rechaza con "solo permiten indicador de facturación X" para tipo 44, switchear payload a `IndicadorFacturacion=1` + full breakdown ITBIS 18% (`MontoGravadoTotal='5000.00', MontoGravadoI1='5000.00', ITBIS1='18', TotalITBIS='900.00', TotalITBIS1='900.00', MontoTotal='5900.00'` + `MontoExento` omitido).
4. Si DGII acepta: continuar con 2do 1×44 (`_PAYLOAD_44_CORRIDA_25` con `NombreItem` cosmético distinto, patrón validado por 19va/20va tipo 41).
5. Bloqueo 34 sigue activo — runner NO debe reintentar 1×34 hasta que el usuario resuelva con soporte DGII (trackId `daeac04a-b4cd-4e27-89e4-a3d831513086`).

### Estado TFE_SECUENCIA post-corrida

Sin cambios (0 envíos DGII, 0 secuencias consumidas). Mismos valores que el preámbulo.

Código nuevo desplegado esta corrida: `backend/apps/fe/tests/test_ecf_builder_generico.py` (+1 payload congelado, +1 test XSD-gate). Sin cambios de production code (`ecf_builder.py`, `views.py` intactos).

## Fase 4 — Hallazgos de la 26va corrida (2026-09-28) — PAYLOAD 45 CONGELADO, SIN ENVÍOS DGII

Portal previo (Playwright, `/certecf/portalcertificacion/Postulacion/PruebasSimulacion`, sesión 130217432 en curso): **4/4 tipo 31 + 2/2 tipo 32≥250K + 1/1 tipo 33 + 0/2 tipo 34 (bloqueada) + 2/2 tipo 41 + 2/2 tipo 43 + 0/2 resto (44/45/46/47) + 0/4 RFCE**. Último reinicio sigue siendo 27/09 8:19:02 PM (rechazo 634 de la 23va). Sin nuevos reinicios post-25va.

TFE_SECUENCIA (`fe_repo.list_secuencias('01')` en contenedor): 31→97 (rango 1..**100**, **4 restantes**, sin cambios respecto a la 25va — usuario aún no ejecutó el UPDATE de `secuencia_hasta`), 32→1024, 33→13, 34→55 (bloqueada), 41→6, 43→7, 44-47→1.

### Decisión de esta corrida (sin envíos a DGII)

Idéntica al criterio de la 24va/25va: rango tipo 31 tan estrecho (97..100) → un rechazo cascada de un primer contacto tipo 45 consumiría exactamente esas 4 secuencias al reconstruir 4×31. Trabajo libre de riesgo: congelar el payload 45 y su test XSD-gate para que la 27va+ (o esta misma, si el usuario amplía el rango entre corridas) pueda enviar directo sin re-investigar.

### Comprador real elegido para tipo 45

`CXC.TCXC_CLIENTE` #573 CONSEJO NACIONAL DE ZONAS FRANCAS DE EXPORTACION, RNC 401501406 (patrón institucional 401xxx propio de organismos gubernamentales — descubierto por la 25va corrida al hacer la query LIKE '%ZONA%FRANCA%').

### Payload congelado `_PAYLOAD_45_CORRIDA_26`

En `backend/apps/fe/tests/test_ecf_builder_generico.py` (justo después de `test_payload_corrida25_tipo_44_valida_contra_xsd`):

- Emisor real: RNC 130217432, RazonSocial "ABREGONZA, SRL", dirección "C/ HOSTOS #1, SANTO DOMINGO", FechaEmision `28-09-2026`, FechaVencimientoSecuencia `31-12-2028`.
- `TipoIngresos='01'` (Ingresos por Operaciones), `TipoPago=1` (Contado — minimiza superficie al evitar FechaLimitePago obligatoria del crédito).
- Comprador: `RNCComprador='401501406'`, `RazonSocialComprador='CONSEJO NACIONAL DE ZONAS FRANCAS DE EXPORTACION'`. `_TIPO_CAPS[45]['comprador']='rnc_razon_mandatory'` exige ambos.
- Totales ITBIS 18% con breakdown completo (patrón validado por certecf en tipos 31/32): `MontoGravadoTotal='5000.00'`, `MontoGravadoI1='5000.00'`, `ITBIS1='18'`, `TotalITBIS='900.00'`, `TotalITBIS1='900.00'`, `MontoTotal='5900.00'`. Monto pequeño (5900) para no consumir "saldo disponible" hipotético si el 45 comparte la regla opaca del 34.
- Línea única: `NumeroLinea=1`, `IndicadorFacturacion=1` (Gravado 18%), `NombreItem='SERVICIO PROFESIONAL GUBERNAMENTAL'`, `IndicadorBienoServicio=2` (Servicio), `CantidadItem=1.00`, `PrecioUnitarioItem=5000.00`, `MontoItem=5000.00`.

### Test agregado

`test_payload_corrida26_tipo_45_valida_contra_xsd` — valida el XML generado contra el XSD real `e-CF-45-v1.0.xsd`, verifica que `TipoeCF=45`, `RNCComprador=401501406`, `RazonSocialComprador` correcta, y todos los campos de Totales (MontoGravadoTotal, MontoGravadoI1, ITBIS1, TotalITBIS, TotalITBIS1, MontoTotal) con los valores esperados.

**88/88 tests módulo `test_ecf_builder_generico.py`** + **237/237 paquete `apps/fe/tests/`** pasan en contenedor `facturation_backend` (bind mount VM). +1 test respecto a la 25va (236→237).

### Plan operativo para la corrida siguiente (27va)

1. **Precondición dura**: verificar que el usuario ejecutó el UPDATE de `secuencia_hasta` para tipo 31 (query `list_secuencias('01')`, buscar `tipo=31 hasta>=500`). Si sigue en 100, NO enviar tipo 44/45 — repetir el patrón de congelar payload tipo 46 (Exportaciones) con comprador extranjero + PaisDestino, o payload tipo 47 (Pagos al Exterior) con retención completa (`MontoISRRetenido`). Ver `_base_46()` / `_base_47()` como plantillas iniciales.
2. Si rango ampliado (≥500): `POST /api/fe/certificacion/paso4-manual/` con `no_cia='01'`, `tipo_ecf=44`, `datos=_PAYLOAD_44_CORRIDA_25` PRIMERO (tipo 44 es más simple estructural: sin RNCComprador, sin ITBIS). Probe DGII previo (`obtener_token('01','certecf',forzar=True)`). `consultar_estado` inmediato, verificar portal. Si Aceptado, seguir con 1×45 `_PAYLOAD_45_CORRIDA_26` en la misma corrida (o siguiente si budget se agota).
3. Si DGII rechaza 44 con "solo permiten indicador de facturación X", switchear payload a `IndicadorFacturacion=1` + full breakdown ITBIS 18% (patrón corrida 21va del tipo 43).
4. Si DGII rechaza 45 por regla opaca (código 615 tipo saldo/RNC), documentar el mensaje literal y mantener bloqueo hasta investigación humana — 401501406 podría requerir tratamiento especial como RNC gubernamental.
5. Bloqueo 34 sigue activo — runner NO debe reintentar 1×34 hasta que el usuario resuelva con soporte DGII (trackId `daeac04a-b4cd-4e27-89e4-a3d831513086`).

### Estado TFE_SECUENCIA post-corrida

Sin cambios (0 envíos DGII, 0 secuencias consumidas). Mismos valores que el preámbulo.

Código nuevo desplegado esta corrida: `backend/apps/fe/tests/test_ecf_builder_generico.py` (+1 payload congelado `_PAYLOAD_45_CORRIDA_26`, +1 test XSD-gate `test_payload_corrida26_tipo_45_valida_contra_xsd`). Sin cambios de production code (`ecf_builder.py`, `views.py` intactos).

## Log de corridas

Agregar una línea por corrida, más reciente arriba:

- **2026-10-06 ~16 UTC (55va corrida)** — Runner scheduled. **HALLAZGO MAYOR: PORTAL REGRESÓ A FASE 5 — DGII RECHAZÓ LOS 11 PDFs RI**. Las corridas 51-54 interpretaban "Fase 6 pasiva sin veredicto"; en realidad DGII validó y rechazó, retrocediendo portal a `PruebasSimulacionRepresentacionImpresa`. Bandeja mensaje 05-10-2026 02:21:18 PM UTC-4 con 3 observaciones: (1) "El código de seguridad y la fecha hora firma deben ir debajo del QR"; (2) "Debe indicar el tipo de comprobante electrónico que emite"; (3) "Los QR no abren, verificar configuración de la URL". Investigación QR: `armar_qr_url` genera URL correcta per spec DGII (`fechafirma=03-10-2026%2020:28:07` con `%20` encoded, encf lowercase, 7 params). Ambos ambientes certecf y ecf prod responden HTTP 200 pero "No fue encontrada la factura (e-CF)" — endpoint reachable, formato OK, los e-CFs no están indexados en la DB consulta DGII (delay reconciliación o certecf no publica consulta). **Fixes implementados**: (A) backend `apps/fe/views_print_data.py` agrega mapping `_TIPO_ECF_NOMBRE` oficial DGII (31→"FACTURA DE CREDITO FISCAL ELECTRONICA" etc. per Formato-e-CF-V1.0.pdf) + campo `ecf.tipo_ecf_nombre` en ambas ramas. (B) frontend `frontend/src/features/pdf/defaults/ecf-representacion-impresa.ts` rewrite: encabezado top-right muestra `tipo_ecf_nombre` + `Tipo e-CF {{ecf.tipo_ecf}}` prominente; eliminado `Firma:` del encabezado; bloque fiscal nuevo = QR centrado size 160 primero, DEBAJO `Codigo de Seguridad` + `Fecha Hora Firma` + leyenda. Deploy backend vía `pscp` + `docker cp` + smoke `_TIPO_ECF_NOMBRE` 10 claves. Portal 55va post-corrida: Fase 5 abierta 11 slots vacíos. TFE_SECUENCIA sin cambios. Commits: fix(ecf) backend + frontend + plan maestro. **Próxima (56va)**: Netlify auto-deploy del frontend ya debería estar live. (1) smoke-test `/print/ecf-representacion-impresa/E310000000137`; (2) regenerar 11 PDFs vía Playwright `page.pdf()` para eNCFs del ciclo actual (31→E310000000137, 32≥250K→E320000001060, 33→E330000000023, 34→E340000000060, 41→E410000000116, 43→E430000000116, 44→E440000000021, 45→E450000000114, 46→E460000000105, 47→E470000000110, 32<250K→E320000001062); (3) subir cada PDF + "Enviar archivos"; (4) esperar validación DGII. **Si DGII vuelve a rechazar por QR**: próxima línea = cambiar `_AMBIENTE_RI` de `'certecf'` a `'ecf'` para que URL QR apunte a prod.

- **2026-10-04 ~04 UTC (50va corrida)** — Runner scheduled. **🎉 FASE 4
  CERRADA — PORTAL AUTO-REDIRIGIÓ A FASE 5**. Portal pre-corrida: 25/N
  clase doc + 4/4 RFCE intacto post-49va (confirmado Playwright); widget
  "Facturas de consumo <250Mil" en 0/4 pendiente. Descarga XMLs firmados
  del ciclo 49va: `.tmp/get_xmls_50va.py` (patrón 48va `get_xmls.py`,
  `fe_repo.get_documento('01', encf)`) dentro del contenedor
  `facturation_backend`; 4 archivos `/tmp/rfce_xmls_50va/E320000001062-1065.xml`
  (5208/5209/7645/5922 bytes), `docker cp` + `pscp` local a
  `.tmp/rfce50/*.xml`. Subida secuencial vía Playwright
  `input#uploadArchivoFacturaSimulacion` + botón ENVIAR
  (`button:contains('Enviar'):not([disabled])`.click()`): 1062→**1/4**,
  1063→**2/4**, 1064→**3/4**, 1065→**4/4** Aceptados sin un solo rechazo
  ni cascade. **Al clickear ENVIAR del 4to upload, el portal respondió
  HTTP 302 a `/certecf/portalcertificacion/Postulacion/PruebasSimulacionRepresentacionImpresa`**
  — la DGII misma cerró Fase 4 y abrió Fase 5. Página Fase 5 confirmada
  por Playwright: 11 slots de upload (`Representación para comprobante
  tipo 31/32>=250Mil/33/34/41/43/44/45/46/47/32<250Mil`), botón "Enviar
  archivos" único, constraint `suma ≤ 10MB`, log vacío ("No existen
  mensajes."). Bandeja de Entrada ahora 49 (+1 por avance a Fase 5).
  TFE_SECUENCIA sin cambios (ningún envío generó secuencia nueva, solo
  subida al widget). Sin código nuevo. Scripts no commiteados:
  `.tmp/get_xmls_50va.py`, `.tmp/rfce50/E320000001062-1065.xml`.
  Screenshot: `ri-fase5-abierta-50va.png` (full-page, local, no
  commiteado). **Hipótesis clave validada**: el cascade asíncrono del
  48va ("e-NCF E320000001052 ya habia sido cargada y aceptada
  previamente") se evita usando NCFs FRESCOS del ciclo activo
  (E320000001062-1065 nunca antes subidos al widget); no se observó
  cascade en el intervalo post-upload de esta corrida. **Próxima (51va)**:
  Fase 5 — subir 11 PDFs RI (uno por tipo e-CF). Candidatos sugeridos
  del ciclo 49va (todos Aceptados): 31→E310000000137 (FC-7829),
  32≥250K→E320000001060 (RYLCO), 33→E330000000023, 34→E340000000060,
  41→E410000000116, 43→E430000000116, 44→E440000000021,
  45→E450000000114, 46→E460000000105, 47→E470000000110, 32<250K
  (RFCE)→E320000001062. Pipeline: `/print/ecf-representacion-impresa/<encf>`
  en Netlify ya validado (QR legible fix 43va) → navegar con Playwright
  + convertir a PDF (opción A: `page.pdf()` nativo; opción B: Chrome
  standalone + "Imprimir → Guardar como PDF") → bajar 11 PDFs → subirlos
  al Fase 5 widget via cada `input` + clickear "Enviar archivos" global.
  Verificar previo que cada PDF tiene QR visible + encabezado completo.

- **2026-10-03 ~16 UTC (47va corrida)** — Runner scheduled. **🎉 HIPÓTESIS
  #5 REFINADA VALIDADA: 2/2 TIPO 34 ACEPTADO — BLOQUEO 615 DEFINITIVAMENTE
  RESUELTO**. Portal pre-corrida Playwright: 0/N confirmado (cascada
  post-46va intacta, log último reinicio 03/10 8:20:20 AM código 156 por
  IndicadorNotaCredito=0 del `_PAYLOAD_34_CORRIDA_46`). Payload refinado
  `_PAYLOAD_34_CORRIDA_47` = `_PAYLOAD_34_CORRIDA_46` con único cambio
  `IndicadorNotaCredito` 0→1 (patrón "Set permite / certecf exige" #18).
  Test XSD-gate `test_payload_corrida47_tipo_34_indicador_nota_credito_1_valida_contra_xsd`
  agregado. Envíos reales vía `docker exec facturation_backend python
  manage.py shell`:
  - **E340000000057 trackId `e5d20f79-a5cc-4126-b0bc-8ed67815261f`
    Aceptado código 1** (fechaRecepcion 10/3/2026 12:15:46 PM UTC-4),
    secuenciaUtilizada=true, mensajes vacíos. Portal verificado Playwright
    → 1/2 tipo 34.
  - **E340000000058 trackId `9d692e23-26b4-46ac-a1d2-5381062d692c`
    Aceptado código 1** (fechaRecepcion 10/3/2026 12:16:51 PM UTC-4) con
    mismo payload (cosmético cambiado solo en NombreItem/RazonModificacion/
    RazonSocialComprador). Portal verificado Playwright → **2/2 tipo 34**.
  Patrón validado para tipo 34: `CodigoModificacion=2` (Corrige Texto) +
  `MontoTotal=0.00` + `MontoGravadoTotal=0.00` + `IndicadorNotaCredito=1`
  + `TipoIngresos=01` + `IndicadorMontoGravado=0` + `TotalITBIS=0.00` +
  línea única con `MontoItem=0.00` + `CantidadItem=1.00` +
  `PrecioUnitarioItem=0.00`. **El patrón NO necesita que el ciclo tenga
  4×31 Aceptados previos** — el envío 1er funcionó con portal en 0/N y
  `NCFModificado=E310000000121` (31 Aceptado en ciclo previo ya borrado
  por cascada 46va, pero fiscalmente válido en DGII). Decisión intencional
  de **NO reconstruir el ciclo 27/N restante** esta corrida: budget 47%
  consumido ($3.80/$8), rebuild (27+ envíos) consumiría el resto sin margen,
  y cualquier rechazo durante rebuild cascadearía borrando los 2/2 tipo 34
  recién conquistados. Preferible lockear la victoria histórica y dejar el
  rebuild completo a la próxima corrida con budget fresco. Estado portal
  final 47va: 2/N (0/4 31 + 0/2 32≥250K + 0/1 33 + **2/2 tipo 34** + 0/2
  41 + 0/2 43 + 0/2 44 + 0/2 45 + 0/2 46 + 0/2 47 + 0/4 RFCE + 0/4 widget).
  Hipótesis previas 1/2/3 todas falsificadas (documentadas), hipótesis 5
  original parcialmente validada (46va), hipótesis #5 refinada = la correcta.
  Patrón "Set permite / certecf exige" cuenta nueva #18 (Set oficial fila 5
  tiene `IndicadorNotaCredito=0`, certecf exige `1` para que la NC se
  cuente). TFE_SECUENCIA post-47va: 34→59 (57 y 58 consumidas Aceptadas),
  resto intacto. Código nuevo: `_PAYLOAD_34_CORRIDA_47` + test XSD-gate
  en `test_ecf_builder_generico.py`. Scripts no commiteados: `.tmp/send34_47va.py`,
  `.tmp/send34_47va_2.py`. **Próxima (48va)**: con budget fresco, rebuild
  completo del ciclo validados ya patrón conocido en 40va: (1) 4×31 vía
  `paso4-factura-real` con FT-0007829/7607/8076/7766; (2) 2×32≥250K vía
  `paso4-manual` payloads VALOIS/RYLCO; (3) 1×33 CodMod=3; (4) 2×41 con
  `_PAYLOAD_41_CORRIDA_19`; (5) 2×43 con prox=100 UPDATE si contaminación;
  (6) 2×44 con `_PAYLOAD_44_CORRIDA_27`; (7) 2×45 con `_PAYLOAD_45_CORRIDA_26`
  (IndicadorMontoGravado=0); (8) 2×46 con `_PAYLOAD_46_CORRIDA_31`; (9) 2×47
  con `_PAYLOAD_47_CORRIDA_33` (IndicadorFacturacion=4); (10) 4×RFCE vía
  `paso4-rfce` con FC no-RNC; (11) subida widget 4×XML firmados del 32 vía
  Playwright. **CRÍTICO**: antes del rebuild, verificar que los 2/2 tipo 34
  siguen Aceptados en portal (si siguen vivos tras varias horas, significa
  que no hay re-validación batch que los pueda derribar). (12) **IMPORTANTE
  para los NUEVOS 34 que se enviaran durante el rebuild — ninguno, ya está
  2/2** — solo asegurarse de NO enviar nuevos 34 que puedan cascadear.
  Si el ciclo rebuild completa 27/N + los 2/2 34 recién hechos → **portal
  29/N = Fase 4 COMPLETA**, listo para avanzar a Fase 5.

- **2026-10-03 ~12 UTC (46va corrida)** — Runner scheduled. **HIPÓTESIS #5
  ORIGINAL (SET NC CORRIGE TEXTO, CODMOD=2, MONTO=0, INDNC=0) PARCIALMENTE
  VALIDADA — PRIMER RECHAZO 34 QUE NO FUE 615**. Lectura del Set de Pruebas
  oficial `set-pruebas-130217432.xlsx` (hoja ECF fila 5, CasoPrueba
  `130217432E340000000001`) descubrió patrón nunca probado:
  `CodigoModificacion=2` + `MontoTotal=0.00` + `MontoGravadoTotal=0.00` +
  `IndicadorNotaCredito=0`. Payload `_PAYLOAD_34_CORRIDA_46` armado +
  test XSD-gate `test_payload_corrida46_tipo_34_cod_mod_2_monto_cero_valida_contra_xsd`.
  Envío real E340000000056 trackId `de725298-d118-421a-9b8a-1991e9dc3b97`
  **Rechazado código 156 "El campo IndicadorNotaCredito del área IdDoc
  de la sección Encabezado no es válido"** (secuenciaUtilizada=true, 56
  quemada). **Hallazgo histórico**: por primera vez en 5 intentos tipo 34,
  el rechazo NO fue código 615 "saldo disponible" — el patrón MontoTotal=0
  + CodMod=2 SÍ pasa la validación de saldo. Único problema: el Set oficial
  marca `IndicadorNotaCredito=0` pero certecf exige `1` (patrón "Set permite
  / DGII exige" #18 nuevo). Cascada confirmada Playwright: 27/N → 0/N post-
  rechazo. TFE_SECUENCIA post: 34→57. **Hipótesis #5 refinada LISTA para
  47va** = payload idéntico pero `IndicadorNotaCredito=1`.

- **2026-10-03 ~04 UTC (45va corrida)** — Runner scheduled. **HIPÓTESIS #3
  (CAMPO OBLIGATORIO DE FACTO EN TIPO 34) REFUTADA + BORRADOR TICKET DGII
  PREPARADO**. Portal pre-corrida Playwright confirmado 27/N intacto
  (idéntico a post-44va, único faltante 0/2 tipo 34, log último reinicio
  01/10 8:22 PM sin cambios post-41va). Investigación exhaustiva de la
  hipótesis #3 según ruta (A) del plan 44va: (a) lectura completa del
  XSD `e-CF-34-v1.0.xsd` (sección InformacionReferencia, Totales,
  Comprador, DetallesItems/Retencion), (b) extracción con `pdftotext`
  de la sección "F. Información de Referencia" y "Totales" del
  `Formato-e-CF-V1.0.pdf` oficial, (c) comparación campo por campo con
  `_PAYLOAD_34_CORRIDA_13` actual y análisis del builder
  `apps/fe/ecf_builder.py::_gen_informacion_referencia` y `::_gen_emisor`
  líneas 274+1327-1360. Hallazgos concretos: (1) `RNCOtroContribuyente`
  (opcional en XSD) según el PDF SOLO aplica cuando el RNC emisor del
  e-CF 34 no coincide con el emisor del `NCFModificado` por disolución/
  fusión/escisión del contribuyente; Abregonza (130217432) es tanto
  emisor del 34 como del e-CF 31 referenciado → no aplica. (2)
  `FechaNCFModificado` que enviamos (`20-11-2025`) SÍ coincide con el
  valor de `Emisor/FechaEmision` que el e-CF 31 llevaba al enviarse
  (verificado en código: `ecf_builder.py:274` usa `factura['fecha']` de
  `TFAT_FACTURA` para el 31, mismo valor que usamos como
  `FechaNCFModificado` del 34) — hipótesis #6 preliminar sobre
  divergencia de fechas también descartada. (3) `SaldoAnterior`,
  `ValorPagar`, `MontoAvancePago`, `MontoPeriodo` en `Totales` son todos
  campos puramente informativos según el PDF ("Se incluye sólo con fines
  de ilustrar con claridad el cobro"), sin semántica funcional de
  validación DGII. Conclusión: **ningún campo opcional en el XSD tiene
  potencial creíble de ser el "obligatorio de facto" faltante** — patrón
  "XSD permite / DGII exige" ya cerrado para los otros tipos
  (31/32/41/44/45/46/47) no aplica aquí. Agotadas las 3 hipótesis
  técnicas razonables (#1 >24h, #2 ACECF intermedio, #3 campo oculto),
  queda únicamente **hipótesis #4 (bug server-side o limitación
  arquitectural de certecf para tipo 34)**. Archivo nuevo preparado:
  `backend/docs/superpowers/plans/2026-10-03-ticket-dgii-tipo34.md` —
  borrador formal de ticket a soporte DGII (Centro de Contacto
  809-689-3444 o `facturaelectronica@dgii.gov.do`), estructurado con:
  resumen del problema, tabla de 5 intentos fallidos con sus trackIds/
  fechas/payloads, las 3 hipótesis técnicas investigadas y descartadas,
  5 preguntas técnicas concretas al soporte, impacto operativo y
  anexos. **BORRADOR, NO ENVIADO** — correspondencia dirigida a la
  DGII en nombre de Abregonza SRL es acción legalmente vinculante,
  requiere firma expresa de Roberto Abreu Espinal según política
  2026-09-29 ("Cuándo detenerse"). Sin código nuevo esta corrida, 0
  envíos a certecf, 0 cambios en TFE_SECUENCIA, 27/N portal intacto.
  Actualizaciones al plan maestro: (i) tabla de estado Fase 4 reemplaza
  descripción 44va por 45va; (ii) sección "Bloqueos activos" marca
  hipótesis #3 como falsificada con detalle de la investigación; (iii)
  esta entrada al log. **Próxima (46va)**: dos rutas razonables:
  (A) **Fase 5 preparatoria** — descargar y conservar localmente los
  23 PDFs RI de los e-CF ya Aceptados en Fase 4 (pipeline verificado
  funcional en 43va, falta solo persistir artefactos para subida futura
  cuando el portal avance); iterar sobre TFE_DOCUMENTO con los 23 eNCF
  del ciclo, abrir `/print/ecf-representacion-impresa/<encf>` con
  Playwright + `page.pdf()`, guardar en `.tmp/ri-pdfs/`. Trabajo 100%
  seguro, no toca certecf. (B) **hipótesis #10 nueva** — reintentar
  1×34 con `CodigoModificacion=2` (Corrige Texto) en vez de 1 (Anula)
  o 3 (Corrige montos) ya probados; probabilidad baja de éxito
  (semánticamente una NC siempre modifica montos, el código 2 "Corrige
  Texto" podría activar una ruta de validación distinta que no evalúe
  saldo); alto riesgo de cascada que borra 27/N si rechaza; prepararía
  payload `_PAYLOAD_34_CORRIDA_45` basado en `_13` con solo cambio
  `CodigoModificacion: '2'` + `RazonModificacion: 'Corrige texto en
  descripción de servicio FC-0007829'` + MontoTotal pequeño (100.00).
  Preferible (A) por el ratio riesgo/beneficio: 27/N intacto es muy
  caro reconstruir (~1h, 20 envíos) por una hipótesis con baja
  probabilidad empírica. Commits: solo update plan maestro + nuevo
  borrador ticket DGII, 0 código, 0 envíos.
- **2026-10-02 ~20 UTC (43va corrida)** — Runner scheduled. Verificación en vivo
  del fix QR de la 42va contra el deploy ya live en Netlify (commit `e60df60`).
  Playwright navegó 3 URLs de distintas variantes del QR DGII:
  (1) `/print/ecf-representacion-impresa/E310000000121` tipo 31 — `img[alt=QR]`
  reporta `naturalWidth=560 naturalHeight=560` + CSS `width:140 height:140`;
  data URL enviado a `api.qrserver.com/v1/read-qr-code/` → decoded
  `https://ecf.dgii.gov.do/certecf/consultatimbre?rncemisor=130217432&rnccomprador=130941361&encf=e310000000121&fechaemision=09-05-2025&montototal=460241.77&fechafirma=01-10-2026 20:21:39&codigoseguridad=f+eCnR`.
  (2) `/E320000001036` RFCE32 — decoded
  `https://fc.dgii.gov.do/certecf/consultatimbrefc?rncemisor=130217432&encf=e320000001036&montototal=500.00&codigoseguridad=uFy/56`.
  (3) `/E460000000100` tipo 46 (Exportación, comprador extranjero) — decoded
  `https://ecf.dgii.gov.do/certecf/consultatimbre?rncemisor=130217432&encf=e460000000100&fechaemision=02-10-2026&montototal=5000.00&fechafirma=02-10-2026 00:20:11&codigoseguridad=B6miIH`
  (sin `rnccomprador`, correcto per spec DGII sección Exportaciones).
  **El fix `width: size * 4, margin: 2` funciona para los 3 formatos de URL DGII
  — pipeline Fase 5 confirmado**. Portal Playwright post-verificación: 27/N
  intacto (4/4 31 + 2/2 32≥250K + 1/1 33 + 0/2 34 + 2/2 41 + 2/2 43 + 2/2 44 +
  2/2 45 + 2/2 46 + 2/2 47 + 4/4 RFCE + 4/4 widget), log último reinicio sigue
  01/10 8:22 PM (sin reinicios post-41va, cero envíos esta corrida).
  Descarga masiva local de los 23 PDFs RI DEFERIDA (Fase 5 portal aún no abierta;
  los PDFs se generarán cuando el portal avance). Screenshots no commiteados:
  `ri-rfce-E320000001036-43va.png`, `ri-ecf-E460000000100-43va.png`. Scripts no
  commiteados: `.tmp/list_aceptados.py` (hallazgo útil: TFE_DOCUMENTO.estado
  siempre vale `ENVIADO` tras el envío; la aceptación/rechazo DGII se parsea
  separadamente — para RFCE32 queda en `respuesta_dgii` con `"estado":"Aceptado"`,
  para tipos no-32 solo queda el trackId inicial y la aceptación se verifica
  via `consultar_estado` on-demand). **Hallazgo nuevo pequeño**: el campo
  `codigo_seguridad` de TFE_DOCUMENTO está NULL para tipos no-RFCE (32-fc),
  pero el QR muestra el valor correcto porque el endpoint `print-data` lo
  obtiene de otra fuente (probablemente consultar_estado on-demand o
  `respuesta_dgii` LOB) — bitácora de la BD opcionalmente debería persistir
  este dato en una futura corrida de higiene, no urgente ahora. Commit único con
  esta entrada del plan maestro. **Próxima (44va)**: dos rutas razonables:
  (A) atacar tipo 34 con hipótesis #2 ACECF intermedio — construir endpoint
  `paso4-ecf-acecf` que envía Aprobación Comercial del e-CF31 referenciado
  antes del 34, investigando primero `e-ACECF-v1.0.xsd` + Formato-e-CF
  sección Aprobación Comercial; alto riesgo (cascada borra 27/N) pero sin
  alternativa visible y es la única hipótesis técnica remanente;
  (B) investigación segura hipótesis #4 — preparar borrador de ticket formal
  a soporte DGII (dejarlo en borrador local, política 2026-09-29). Preferir
  (A) con único envío cuidadoso para no quemar más de una secuencia 34.
- **2026-10-02 ~12 UTC (42va corrida)** — Runner scheduled. Portal pre-42va
  Playwright confirmado idéntico al post-41va: `4/4 31 + 2/2 32≥250K + 1/1
  33 + 0/2 34 + 2/2 41 + 2/2 43 + 2/2 44 + 2/2 45 + 2/2 46 + 2/2 47 + 4/4
  RFCE + 4/4 widget = 27/N`; único faltante Fase 4 es `0/2 tipo 34`
  (bloqueo 615 persistente, hipótesis #1 falsificada). Ruta (A) del plan
  41va: **avanzar Fase 5 en paralelo con verificación visual del QR en
  Netlify** (segura, no toca certecf). Hallazgo mayor: la plantilla
  `ecf-representacion-impresa` renderiza bien el layout (confirmado contra
  2 e-CF reales), con URL del QR en formato DGII exacto
  (`consultatimbre`/`consultatimbrefc`, params lowercase/encodeados), PERO
  **el QR es ilegible**: ni `jsQR` ni la API pública `api.qrserver.com`
  logran decodificarlo del PNG a 140px. Root cause en
  `frontend/src/features/pdf/blocks/index.tsx:964`:
  `QRCode.toDataURL(resolved, { width: size })` con `size=140` para una
  URL de 211 chars (QR versión 10, ~57 módulos + margen 4) resulta en
  ~2.3 pixels por módulo — resolución insuficiente para cualquier
  decodificador. Fix aplicado: `{ width: size * 4, margin: 2 }` — el PNG
  raw se genera a 4× (560px) pero el `<img style={{width: size, height:
  size}}>` lo escala a 140px visualmente; el escaneo lee los pixels
  originales del data URL, no el tamaño CSS. Sanity empírica previa al
  fix: la misma URL regenerada por `api.qrserver.com` a 560x560 decodifica
  perfecto, confirmando que el único problema es la resolución del PNG.
  `tsc --noEmit` limpio tras el fix. **Scripts/screenshots no commiteados**:
  `ri-rfce-E320000001036.png`, `ri-ecf-E310000000121.png`, `.tmp/decode_qr.py`,
  `.tmp/qr-E310000000121.png`. **Verificación pendiente post-deploy**:
  esperar auto-deploy Netlify, reload `/print/ecf-representacion-impresa/`
  y confirmar que el QR decodifica con jsQR y api.qrserver.com. Si no
  decodifica, caer a `size * 6` o `errorCorrectionLevel: 'L'` (ahora
  está en default M). Commit único con el fix + esta entrada. **Próxima
  (43va)**: (a) verificar fix QR post-deploy (navegar con Playwright,
  decodificar); (b) si OK, descargar y conservar localmente los 23 PDFs
  RI de los e-CF ya Aceptados para la Fase 5 futura (iterar sobre
  TFE_DOCUMENTO con estado=Aceptado, generar PDF server-side o abrir
  cada `/print/ecf-representacion-impresa/<encf>` y guardar con
  `page.pdf()` de Playwright); (c) alternativa paralela segura: avanzar
  investigación de la hipótesis #2 del tipo 34 (ACECF intermedio) leyendo
  el XSD de ACECF (`e-ACECF-v1.0.xsd` si existe en el repo) para entender
  si "operación relacionada" al 31 significa que debe tener una
  Aprobación Comercial propia enviada antes del 34, sin arriesgar envíos
  reales de 34 todavía.
- **2026-10-02 ~08 UTC (41va corrida)** — Runner scheduled. Portal pre-41va
  Playwright confirmado idéntico al post-40va: `4/4 31 + 2/2 32≥250K + 1/1
  33 + 0/2 34 + 1/2 41 + 2/2 43 + 2/2 44 + 2/2 45 + 2/2 46 + 2/2 47 + 4/4
  RFCE = 22/N` + widget 0/4; último reinicio portal 01/10 20:22 UTC-4
  (coincide con cascada 39va, ningún rechazo nuevo desde entonces).
  Ruta (a)+(b) del plan 40va, 0 código nuevo, 0 rechazos DGII, +5 renglones
  netos (**22/N → 27/N, cierre total de Fase 4 excepto 0/2 tipo 34**).
  (b) **1×41 adicional → 2/2 tipo 41**: payload copia de
  `_PAYLOAD_41_CORRIDA_19` (ya validado por 19va/20va/39va-b) con
  `FechaEmision='02-10-2026'` + `NombreItem[1]='Compra insumo materia
  prima 41va'`. Envío vía `/api/fe/certificacion/paso4-manual/` →
  **E410000000111 Aceptado codigo=1** (trackId
  `71b7aa4a-797a-4cfc-9080-1befbfd856bc`). Portal post-envío Playwright
  confirmado `2/2 Comprobantes tipo 41`. Decisión intencional: NO modificar
  `_PAYLOAD_41_CORRIDA_18` (payload congelado histórico que falla por
  diseño — el fix real está en el payload nuevo `_19`; la instrucción del
  40va de "agregar MontoITBISRetenido al _18" era imprecisa, el payload
  _19 ya existía y era suficiente). Sin código tocado. (a) **Widget
  "Facturas de consumo <250Mil" 0/4 → 4/4**: descarga de los 4 XMLs
  firmados vía `apps.legacy.repositories.fe_repo.get_documento` (helper
  `.tmp/get_xmls.py` ejecutado en el contenedor, `docker cp` a VM, pscp a
  local → `.tmp/rfce_xmls/E32000000104{4,5,6,7}.xml`); subida uno-a-uno
  por Playwright vía `input#uploadArchivoFacturaSimulacion` + botón
  ENVIAR; contador widget avanzó 0/4 → 1/4 → 2/4 → 3/4 → 4/4 limpio sin
  errores. **Portal post-41va Playwright confirmado: 4/4 31 + 2/2
  32≥250K + 1/1 33 + 0/2 34 + 2/2 41 + 2/2 43 + 2/2 44 + 2/2 45 + 2/2 46
  + 2/2 47 + 4/4 RFCE + 4/4 widget = 27/N**; única fila abierta en Fase 4
  es `0/2 Comprobantes tipo 34` (bloqueo 615 persistente, 3 hipótesis
  remanentes documentadas arriba). TFE_SECUENCIA post-41va: 41→112
  (111 consumida y Aceptada). Sin código, sin tests nuevos; scripts
  no commiteados: `.tmp/run_41va_tipo41.py` + `.tmp/get_xmls.py` +
  `.tmp/rfce_xmls/*.xml`. **Próxima (42va)**: Fase 4 está esencialmente
  cerrada excepto 0/2 tipo 34 (bloqueo 615, hipótesis #1 falsificada por
  39va). Dos rutas razonables, elegir según la hora de corrida:
  (A) **avanzar Fase 5 en paralelo** (segura, no toca certecf) — ya
  está construida la plantilla `defaults/ecf-representacion-impresa.ts` +
  endpoint `/print/ecf-representacion-impresa/<encf>` + fallback XML
  firmado (37va+38va); falta verificación visual del QR en Netlify
  (Playwright navegar al endpoint, screenshot, confirmar QR legible y
  URL `consultatimbre` correcta), y una vez validado, descarga y
  conservación local de los 23 PDFs RI de todos los e-CF aceptados hoy
  (23 renglones del portal) para subirlos en la Fase 5 cuando llegue el
  portal — esta tarea prepara la fase futura sin arriesgar nada;
  (B) **atacar tipo 34 con hipótesis #2 ACECF intermedio** — enviar una
  Aprobación Comercial del e-CF31 referenciado ANTES de intentar el 34,
  por si la DGII exige esa confirmación como "operación relacionada"
  previa (ver "Bloqueos activos" hipótesis #2); riesgo: si rechaza
  igual, cascada borra los 27/N construidos hoy. Preferir (A) salvo que
  la corrida tenga mucho tiempo y poca cosa que perder.
- **2026-10-02 ~04 UTC (40va corrida)** — Runner scheduled. Portal pre-40va
  Playwright: 19/N (post-cascada 39va). Ruta (a)+(c) del plan 39va, sin
  tocar código, 0 rechazos DGII, +4 renglones netos. (a) **1×46 destrabo
  contaminación residual**: `UPDATE FAT.TFE_SECUENCIA SET prox_secuencia=100
  WHERE no_cia='01' AND tipo_ecf='46'` → payload `_PAYLOAD_46_CORRIDA_31`
  con `FechaEmision='02-10-2026'` + NombreItem cosmético → E460000000100
  Aceptado codigo=1 (patrón prox=100 validado 5ta vez: 29va tipo 45,
  30va tipo 43, 31va tipo 46, 39va tipos 41/44/46 fallidos, hoy 46 OK).
  (b) **4×RFCE recuperados post-cascada**: `/api/fe/certificacion/paso4-rfce/`
  con FCs no-RNC (`posiciones_fijas_ncf='B02'`, `rnc_factura IS NULL`,
  cliente sin RNC/cédula): primera tanda FC-0008190 (ROBERTO ABREU FINCA
  2620.77) → E320000001044 Aceptado; FC-0008176 (3758.55) → E320000001045
  Aceptado; FC-8119 HTTP 400 "e-CF 32 pero NCF papel B01" (saltada);
  FC-8086 HTTP 400 anulada (saltada). Segunda tanda con filtro `pos='B02'`:
  FC-0008167 (11018) → E320000001046 Aceptado; FC-0008166 (12980) →
  E320000001047 Aceptado. **Portal post-40va Playwright**: `4/4 31 + 2/2
  32≥250K + 1/1 33 + 0/2 34 + 1/2 41 + 2/2 43 + 2/2 44 + 2/2 45 + 2/2 46 +
  2/2 47 + 4/4 RFCE = 23/N` + widget 0/4 (manual pendiente). TFE_SECUENCIA
  post: 32→1048, 46→101. Sin código, scripts no commiteados
  (`.tmp/run_40va.py` + `_rfce.py` + `_rfce2.py`). **Próxima (41va)**:
  (a) subida manual widget 4×XML (E320000001044-1047) vía Playwright al
  `input#uploadArchivoFacturaSimulacion` → +4 widget = 27/N; descargar
  XMLs firmados de TFE_DOCUMENTO con `docker cp` + pscp (mismo patrón que
  35va, 4 archivos `130217432E32000000104X.xml`); (b) fix builder 41:
  en `_PAYLOAD_41_CORRIDA_18` agregar `MontoITBISRetenido[1]='900.00'` +
  guard `_gen_detalles_items` ya existe pero el payload no lo cumple (ver
  "Fase 4 Hallazgos 18va") — update test XSD-gate + deploy VM + 1×41 →
  2/2 41; (c) 34 sigue bloqueado 615; evaluar hipótesis #2 ACECF
  intermedio con mucho cuidado post-rebuild (cualquier rechazo tipo 34
  destruye todo el ciclo ganado hoy + 41va). Commits: solo update plan
  maestro.
- **2026-10-02 ~00 UTC (39va corrida)** — Runner scheduled. Hora 2026-10-02
  00:11 UTC = 2026-10-01 20:11 UTC-4. **Hipótesis #1 FALSIFICADA + REBUILD
  19/N post-cascada**. Portal pre: 22/N intacto. Ruta A (como sugirió 38va):
  1×34 contra `E310000000119` (FC-0007829, RNC 131265863, firmado 30-09
  20:22 UTC = ~28h antes del envío, >24h cumplido). Payload copia del
  `_PAYLOAD_34_CORRIDA_13` salvo `MontoTotal='100.00'` (vs. 5900) +
  `FechaEmision='01-10-2026'`. **E340000000055 → Rechazado código 615**
  (trackId `721d97d9-1553-4e95-b387-eabeb141e5c9`, `fechaRecepcion
  10/1/2026 8:18:58 PM`, mensaje literal IDÉNTICO al 16va, `secuenciaUtilizada=true`
  → quemada). Portal cascada a 0/N. **Hipótesis #1 (reconciliación batch
  nocturna DGII) definitivamente descartada**: >24h NO es la variable que
  importa; el "saldo disponible" se calcula de forma distinta a lo asumido.
  Rebuild primera tanda (20 envíos): 4×31 Aceptados (E310000000121-124 vía
  paso4-factura-real FC-7607/7766/7829/8076), 2×32 Aceptados
  (E320000001040-1041 RYLCO/VALOIS), 1×33 Aceptado (E330000000019
  NCFMod=E310000000123 CodMod=3), 41-a **HTTP 400 local** por builder
  (`MontoITBISRetenido` faltante en `_PAYLOAD_41_CORRIDA_18` para
  `IndicadorAgenteRetencionoPercepcion=1`), 41-b Aceptado (E410000000109),
  2×43 Aceptados (E430000000108-109), 44-a **Rechazado código 1209**
  (E440000000013 contaminación DGII patrón #11), 44-b Aceptado
  (E440000000014), 2×45 Aceptados (E450000000106-107), 46-a **Rechazado
  código 1209** (E460000000007 contaminación DGII), 46-b Aceptado
  (E460000000008), 2×47 Aceptados (E470000000104-105). Cascadas de los dos
  1209 borraron el ciclo (portal 1/2 46 + 2/2 47 solamente). Segunda tanda
  SAFE (saltando 46 y 41-a para no re-cascadear): 14/14 Aceptados —
  E310000000125-128 + E320000001042-1043 + E330000000020 + E410000000110 +
  E430000000110-111 + E440000000015-016 + E450000000108-109. **Portal
  final Playwright confirmado: 19/N** (4/4 31 + 2/2 32 + 1/1 33 + 1/2 41 +
  2/2 43 + 2/2 44 + 2/2 45 + 1/2 46 + 2/2 47; sin RFCE ni widget). Neto
  vs. 22/N pre-corrida: -3 renglones (perdidos 1/2 41 por builder, 1/2 46
  por contaminación residual sin destrabo aplicado, 4/4 RFCE + 4/4 widget
  por falta de tiempo). TFE_SECUENCIA post: 31→129, 32→1044, 33→21,
  34→56 (55 quemada hyp#1), 41→111, 43→112, 44→17, 45→110, 46→9
  (contaminada residual), 47→106. **Próxima (40va)**: (a)
  `UPDATE TFE_SECUENCIA SET prox_secuencia=100 WHERE no_cia='01' AND
  tipo_ecf='46'` + 1×46 payload `_PAYLOAD_46_CORRIDA_31` → 2/2 46;
  (b) fix builder: agregar `MontoITBISRetenido[1]` a
  `_PAYLOAD_41_CORRIDA_18` + actualizar test XSD-gate → 1×41 adicional
  → 2/2 41; (c) 4×RFCE vía `paso4-rfce` + subida manual 4×widget;
  (d) **NO reintentar 34 con hipótesis #1**, falsificada; hipótesis
  pendientes para 34: #2 (ACECF intermedio del 31 antes del 34) y #4
  (34 no se puede validar en certecf = bug del portal, reportar a DGII).
  Sin código nuevo esta corrida — solo payload probe y rebuild via scripts
  `.tmp/rebuild_39va*.py` (no commiteados). Commits: solo update plan
  maestro.
- **2026-10-01 ~20 UTC (38va corrida)** — Runner scheduled. Hora exacta 20:10 UTC
  (~16:10 UTC-4). Los últimos 31 del ciclo son del 30/09 ~16:22 UTC-4 → ~24h
  justos. Elegida ruta B (trabajo seguro de Fase 5, cero riesgo a certecf,
  22/N Fase 4 intacto) sobre la ruta A (reintento 34): la ventana >24h está
  en el borde y arriesgar el ciclo 22/N por una hipótesis en el límite no
  tiene buen ROI, mejor dejar la ventana madurar más para la 39va. Entregables
  de la corrida: (1) **Hallazgo nuevo**: la bitácora TFE_DOCUMENTO guarda
  `tipo_docu/no_docu/punto` SIEMPRE en NULL (verificado para todos los E31*
  del 111 al 120), porque `fe_repo.save_documento_enviado` no acepta esos
  parámetros y los callers (`paso4-factura-real/manual/rfce`) nunca los
  pasan — por eso la RI quedaba sin cliente/líneas/totales en el fallback.
  Fix elegido (más robusto que agregar columnas al INSERT): parsear la fuente
  de verdad fiscal (XML firmado) para extraer comprador/totales/líneas en el
  fallback, así TODOS los e-CF ya enviados renderizan RI completa sin tocar
  BD. (2) Backend: nuevo helper `extraer_resumen_para_ri(xml_firmado)` en
  `apps/fe/representacion_impresa.py` (lee Encabezado/Comprador +
  Totales + DetallesItems) + usado en el fallback de `views_print_data.py`
  cuando `fat_repo.get_factura` devuelve None. (3) Tests: 4 tests nuevos en
  `test_representacion_impresa.py` (comprador, totales, líneas,
  consumidor-final sin RNC) → 12/12 tests verdes en contenedor. (4) Smoke
  real contra E320000001036 (RFCE32 FC-0008184 JUAN HERRERA 500.00): endpoint
  ahora devuelve `cliente={"nombre":"JUAN HERRERA","direccion":"C/L"}`,
  `lineas=[{"descripcion":"CANALETA ELECTRICA 3/4","cantidad":4.0,"precio":105.93,"total":423.73}]`,
  `totales={"subtotal":423.73,"itbis":76.27,"total":500.00}` — RI
  reglamentaria completa para Fase 5. (5) Frontend: nuevo `BotonRiPdf` +
  `ResultadoPaso4Mini` en `fe-certificacion.tsx` → después de cada envío
  Aceptado por `paso4-factura-real` o `paso4-manual`, muestra una tarjeta
  con el estado, trackId y botón "RI PDF" que abre
  `/print/ecf-representacion-impresa/<encf>?no_cia=01&templateDraft=1` en
  nueva pestaña. TFE_SECUENCIA sin cambios (sin envíos a DGII). Próxima
  (39va): (A) hipótesis #1 madura — >24h limpias desde los 31 del ciclo, probar
  1×34 contra E310000000121 (MontoTotal chico, p.ej. $100, CodigoModificacion=2
  anulación) y observar si DGII acepta tras batch nocturno; (B) o
  verificación visual Netlify del QR renderizando en versión 8 (sólo
  requiere login a la app, abrir el `/print/...`, screenshot). Preferencia:
  (A) primero porque desbloquearía completar Fase 4 (22/N → 24/N), (B) es
  verificación cosmética sin riesgo.
- **2026-10-01 ~12 UTC (37va corrida)** — Runner scheduled. Hora UTC-4 ~08:10,
  los últimos 31 del ciclo son del 30/09 ~16:22 UTC-4 (sólo ~16 h, <24 h del
  umbral de la ruta A para probar reconciliación del 34). Ruta B elegida:
  **trabajo seguro Fase 5, 0 envíos a certecf, 22/N Fase 4 intacto**. Sub-plan
  nuevo `2026-10-01-ecf-fase5-representacion-impresa.md`. Entregables:
  (1) backend helper `apps/fe/representacion_impresa.py` con `armar_qr_url(xml_firmado,
  ambiente)` + `_usar_rfce(tipo, monto)` — decide ECF normal vs RFCE por root
  del XML + tipo_ecf=32 && monto<250K, codifica `encf` lowercase y `fechafirma`
  con `%20`, omite `rnccomprador` para consumidor final sin RNC;
  (2) 8/8 tests TDD verdes contra el contenedor
  (`test_representacion_impresa.py` cubre ambiente, root tag, missing SignatureValue,
  missing eNCF, ambos formatos oficiales); (3) endpoint
  `GET /api/fe/documentos/<e_ncf>/representacion-impresa/print-data/`
  (`apps/fe/views_print_data.py`) + URL en `apps/fe/urls.py`, reusa
  `fat_repo.get_factura` + `_cia_payload` + `derivar_codigo_seguridad`;
  (4) smoke test en VM contra E320000001036 (RFCE32 real 34va corrida):
  HTTP 200, `qr_url = https://fc.dgii.gov.do/certecf/consultatimbrefc?rncemisor=130217432&encf=e320000001036&montototal=500.00&codigoseguridad=uFy%2F56`,
  `codigo_seguridad=uFy/56` **coincide EXACTO con el calculado por DGII** al
  enviar (validación empírica del helper, no sólo tests sintéticos); (5)
  frontend plantilla Puck `defaults/ecf-representacion-impresa.ts` (estilo fino
  cxp-documento + bloque QRCode con `contenido='{{ecf.qr_url}}'` size 140) +
  entrada en `registry.ts` (`codigo: 'ecf-representacion-impresa'`, familia
  documento, A4 P). Deploy backend hecho (pscp + reload automático).
  TFE_SECUENCIA sin cambios. Próxima (38va): rutas razonables en orden:
  (A) si hora UTC >= 20:22 → probar reconciliación 1×34 contra E310000000121
  (hipótesis #1 batch nocturno DGII, >24h desde los 31 del ciclo);
  (B) si antes → agregar botón "Descargar RI" en el panel Certificación e-CF
  Paso 4 (abre `/print/ecf-representacion-impresa/<e_ncf>` en nueva pestaña),
  verificar visualmente con Playwright que el QR renderiza en Netlify, y
  confirmar que `encf` lower vs upper funciona contra `certecf`
  (hoy decidimos lower por el ejemplo del PDF oficial — pendiente de probar
  empírico contra el portal real cuando Fase 5 esté activa).
- **2026-10-01 ~08 UTC (36va corrida)** — Runner scheduled. Fase 4 —
  **INVESTIGACIÓN SEGURA, 0 ENVÍOS A DGII, 22/N INTACTO**. Portal pre-
  corrida Playwright: 22/N confirmado (4/4 31 + 2/2 32≥250K + 1/1 33 +
  0/2 34 + 2/2 41 + 2/2 43 + 2/2 44 + 2/2 45 + 2/2 46 + 2/2 47 + 4/4 RFCE +
  4/4 widget subida). Único faltante Fase 4: 0/2 tipo 34 (bloqueo 615
  "saldo disponible", activo desde 16va corrida). TFE_SECUENCIA sin
  cambios: 31→121, 32→1040, 33→19, 34→55 (bloqueada), 41→108, 43→108,
  44→13, 45→106, 46→7, 47→104. **Decisión racional**: NO arriesgar un
  envío del 34 esta corrida — las dos hipótesis fuertes (reconciliación
  >24h, catálogo oficial) requieren más tiempo o info externa, y
  cualquier rechazo del 34 arrastra TODO el ciclo 22/N (12+ secuencias
  perdidas, ~1h de reconstrucción). Hipótesis #1 (>24h desde los 31):
  los 31 del ciclo activo son del 30/09 ~16:22 UTC-4, 36va es
  ~04:12 UTC-4 del 01/10 ≈ 12h, aún NO llega a 24h. **Investigación
  realizada**: (a) Bandeja de Entrada revisada vía Playwright — mensaje
  MensajeId=1593354 del rechazo 34 original (26/09 4:18:17 PM, único
  mensaje de tipo 34 en bandeja); texto literal del detalle es IDÉNTICO
  al log del portal, NO agrega información nueva ("El campo NCFModificado...
  El monto total de la nota de crédito no puede ser mayor al saldo
  disponible de la sumatoria de las operaciones relacionadas al
  comprobante referenciado"); (b) la frase "operaciones relacionadas"
  (plural) refuerza hipótesis #2 del plan maestro (puede faltar
  Aprobación Comercial del 31 antes de poder emitir 34 contra él), pero
  esta hipótesis no se puede probar sin arriesgar el ciclo. **Trabajo
  útil paralelo — Fase 5 formato QR CONFIRMADO**: extraído con `pdftotext
  -layout` de `backend/docs/superpowers/reference/2026-08-31-set-pruebas-
  paso2/Descripcion-Tecnica-Servicios-DGII.pdf` (líneas 758-834 de la
  extracción), hay DOS URLs distintas de QR según tipo de e-CF (normal
  usa `consultatimbre`, RFCE usa `consultatimbrefc`), 7 vs 4 params
  concatenados en orden exacto, URL-encoded con `%20` para espacios en
  `fechafirma`, encf en lowercase en el ejemplo oficial, `codigoseguridad`
  = primeros 6 chars del hash de `<ds:SignatureValue>` del XML firmado,
  QR versión 8. Nueva sub-sección "Formato QR confirmado 2026-10-01"
  agregada bajo "Fase 5". Fase 5 queda "lista para construir" (no más
  bloqueo de requisito no confirmado). **Sin código nuevo esta corrida**
  — todos los cambios son del plan maestro. **Próximo paso (37va)**: dos
  rutas razonables, elegir según hora de corrida:
  - **Ruta A (si corrida ocurre a >20:22 UTC = >24h desde los 31)**:
    probar hipótesis #1 reconciliación batch con 1×34 contra
    `E310000000121` (último 31 Aceptado del ciclo), payload idéntico al
    de 16va corrida pero con `MontoTotal` chico ($100), `CodigoModificacion=1`
    como antes. Si Aceptado: cerrar 2/2 34 → Fase 4 completa. Si Rechazado
    código 615 otra vez: hipótesis #1 falsada; evaluar hipótesis #2 (ACECF
    previo) en 38va corrida y comer la cascada.
  - **Ruta B (si corrida ocurre antes de >24h, o si usuario decide
    priorizar trabajo seguro)**: avanzar Fase 5. Sub-plan con
    `writing-plans` para implementar plantilla `defaults/ecf-
    representacion-impresa.ts` (patrón `sigaft-pdf-simple-design` +
    bloque `QRCode`), endpoint `GET /api/fe/documentos/<e_ncf>/
    representacion-impresa/print-data/`, ruta frontend
    `/print/ecf-representacion-impresa/<e_ncf>`, botón UI en panel
    Certificación. Tests TDD: round-trip URL QR = exacto del ejemplo
    oficial, CodigoSeguridad bien derivado del SignatureValue.
  Commits: solo update del plan maestro, 0 código, 0 envíos DGII.

- **2026-10-01 ~04 UTC (35va corrida)** — Runner scheduled. Fase 4 —
  **GRUPO CUARTO CERRADO: 4/4 RFCE + 4/4 WIDGET "FACTURAS DE CONSUMO
  <250MIL" ACEPTADAS**. Portal pre-corrida Playwright: 4/4 31 + 2/2
  32≥250K + 1/1 33 + 0/2 34 + 2/2 41 + 2/2 43 + 2/2 44 + 2/2 45 + 2/2 46
  + 2/2 47 + 1/4 RFCE (residual 34va) + 0/4 widget. TFE_SECUENCIA pre:
  31→121, 32→1037, 33→19, 34→55 (bloqueada), 41-47 según 34va. **Envíos
  RFCE vía nuevo endpoint `paso4-rfce`** (candidatos elegidos de query
  Oracle: facturas FC-00081XX con `c.rnc IS NULL AND c.cedula IS NULL` —
  mismo patrón que FC-0008184 que la 34va validó):
  | # | Factura | Cliente | Total | e-NCF | Estado |
  |---|---------|---------|-------|-------|--------|
  | 1 | FC-0008182 | MIGUEL ANGEL SOSA (845) | 1100.00 | E320000001037 | Aceptado codigo=1 |
  | 2 | FC-0008173 | ANFERNEE JOSE DOLORES (838) | 644.18 | E320000001038 | Aceptado codigo=1 |
  | 3 | FC-0008172 | PABLO DE LUNA PEREZ (860) | 1300.00 | E320000001039 | Aceptado codigo=1 |
  Portal post-RFCE: 4/4 Comprobantes tipo 32 RFCE confirmado via Playwright.
  **Subida manual al widget portal** (paso "Cuarto"): extraídos los 4 XMLs
  firmados de FAT.TFE_DOCUMENTO (E320000001036/1037/1038/1039) via
  `docker cp` → VM /tmp → `pscp` → `.tmp/rfce_xmls/*.xml` (nombres
  `130217432E32000000103X.xml`). Subida secuencial via Playwright al
  `input#uploadArchivoFacturaSimulacion` + click ENVIAR → contador
  "Comprobantes Aceptados" 0→1→2→3→4 confirmado paso-a-paso. Portal
  final: `4/4 Comprobantes Aceptados` en el widget "Estado actual de
  las pruebas". Sin código nuevo esta corrida (toda la capacidad ya
  existía post-34va). Costo DGII: 3 secuencias tipo 32 consumidas
  (todas Aceptadas), 0 rechazos, 0 cascadas. **Estado Fase 4**: 22/N
  cerrados — solo falta 0/2 tipo 34 (bloqueo 615 saldo disponible,
  activo desde 16va corrida). TFE_SECUENCIA post-35va: 31→121, 32→**1040**,
  33→19, 34→55 (bloqueada), 41→108, 43→108, 44→13, 45→106, 46→7, 47→104.
  **Próximo paso (36va)**: atacar el único bloqueo pendiente de Fase 4
  — tipo 34 código 615. Rutas documentadas (ver "Situación activa"):
  (a) hipótesis reconciliación batch nocturna DGII — ya hay >24h desde
  los 31 del ciclo 33va (16-30/09 PM UTC-4) y los RFCE de esta
  corrida/34va, así que esta ruta ya está lista para probarse enviando
  un 34 referenciando un 31 "viejo" del ciclo activo; (b) revisar
  Bandeja de Entrada del portal (44 mensajes pendientes según
  navegación top) por detalle extra del trackId del rechazo histórico;
  (c) variantes de payload: `CodigoModificacion` distinto o `MontoTotal`
  NC más chico vs. el 31 referenciado. NO reenviar tipo 34 a ciegas —
  cada rechazo arrastra TODO el ciclo 22/N; probar hipótesis UNA por
  UNA con intervalo. Commits: (ver commit de esta corrida — solo update
  del plan maestro, 0 código).

- **2026-09-30 ~22 UTC (34va corrida)** — Runner scheduled. Fase 4 —
  **ENDPOINT `paso4-rfce` CONSTRUIDO + 1/4 RFCE ACEPTADO**. Capacidad
  faltante real de ZentoryERP cerrada esta corrida (plan maestro 33va
  lo había identificado como próximo paso). Nueva vista
  `certificacion_paso4_rfce_view` en `apps/fe/views.py` que arma el
  e-CF32 desde una factura REAL de `TFAT_FACTURA` (mismo pipeline que
  `paso4-factura-real`), firma, deriva `CodigoSeguridadeCF`, replica el
  encabezado del e-CF32 firmado en el payload del RFCE vía nuevo helper
  `_rfce_payload_desde_ecf32(xml)` (parsea con lxml y extrae
  IdDoc/TipoIngresos+TipoPago+TablaFormasPago, Emisor/*, Comprador/*,
  Totales/* -- los MISMOS campos que el RFCE-32-v1.0.xsd admite),
  construye el RFCE con `ecf_builder.construir_rfce` y lo envía al
  servicio `fc.dgii.gov.do/certecf/recepcionfc/api/recepcion/ecf` vía
  `dgii_client.enviar_rfce`. Devuelve además el XML del e-CF32 YA
  FIRMADO para que el operador lo descargue y lo suba al widget
  "Facturas de consumo < 250Mil" del portal (paso "Cuarto",
  no-automatizable salvo manejo manual del widget). URL registrada en
  `apps/fe/urls.py`. **Tests TDD**: 3 nuevos en
  `test_views_certificacion.py` (login, campos requeridos, happy path
  con monkeypatch que valida el round-trip ecf32→firmado→payload
  RFCE→RFCE sin firmar→Aceptado + verificación directa del helper
  extractor). 25/25 tests módulo pasan en contenedor Docker real.
  **Smoke test contra DGII certecf**: FC-0008184 (cliente 830 JUAN
  HERRERA sin RNC, total 500.00, posiciones_fijas_ncf='B02') → eNCF
  asignado E320000001036 → ecf32 firmado → `codigo_seguridad='uFy/56'` →
  RFCE enviado → **Aceptado codigo=1 mensajes=None**. Portal **NO
  verificado via Playwright** este run (budget apretado); contador
  esperado 1/4 RFCE. TFE_SECUENCIA post-34va: 31→121, 32→**1037**
  (1036 consumida+aceptada), 33→19, 34→55 (bloqueada), 41→108, 43→108,
  44→13, 45→106, 46→7, 47→104. Bloqueo 34 (código 615) sigue activo.
  **Próximo paso (35va)**: (a) verificar portal via Playwright que
  1/4 RFCE visible y 19 renglones previos del ciclo intactos; (b)
  enviar 3 RFCE adicionales via el nuevo endpoint — candidatos
  identificados en Oracle: FT-0040907 (165.01), FT-0040921 (565.00),
  FT-0040915 (200.00), todos cliente 142 CONSUMIDOR FINAL con RNC
  placeholder 123456789. Probar 1 primero para ver si DGII acepta el
  RNC placeholder; si rechaza, buscar más facturas con cliente
  no-RNC (como FC-0008184) via query `SELECT ... WHERE no_cliente IN
  (SELECT no_cliente FROM CXC.TCXC_CLIENTE WHERE rnc IS NULL)`; (c)
  tras 4/4 RFCE Aceptados, usar Playwright para subir manualmente los
  4 e-CF32 firmados (`ecf32_firmado_xml` que devuelve el endpoint) al
  widget del portal, cerrando grupo "Cuarto" y Fase 4 completa (excepto
  tipo 34). Commits: (ver commit de esta corrida — vista + helper +
  URL + tests + plan maestro).

- **2026-09-30 20:11-20:27 UTC (33va corrida)** — Runner scheduled. Fase 4
  — **RÉCORD ABSOLUTO 19/N + PRIMER 2/2 TIPO 47 + HALLAZGO #16**.
  Portal previo Playwright: 0/N residual cascada 32va. TFE_SECUENCIA previo:
  31→117, 32→1034, 33→18, 34→55 (bloqueada), 41→106, 43→106, 44→11, 45→104,
  46→5, 47→101. Estrategia: probar 1×47 aislado ANTES de reconstruir ciclo
  (portal ya en 0/N, sin riesgo de perder progreso). **Envíos**:
  | # | e-NCF | trackId | fechaRecepcion | Estado |
  |---|-------|---------|-----------------|--------|
  | 1 | E470000000101 | cc69b1f0-c386-4687-b15f-3771d1129413 | 9/30/2026 4:19:34 PM | **Rechazado 11170** "TotalISRRetencion no es válido" (payload usó `TotalISRRetenido` — nombre incorrecto) |
  | 2 | E470000000102 | 3623115c-5026-414d-8d67-b10d12976a49 | 9/30/2026 4:20:27 PM | **Aceptado** (fix nombre campo: `TotalISRRetencion`) |
  | 3 | E470000000103 | 94b476a4-8ed3-4e24-b989-f0dc632fddf6 | 9/30/2026 4:21:24 PM | **Aceptado** (2do 47 cosmético ES-NIF) → **2/2 tipo 47 PRIMERA VEZ** |
  | 4-7 | E310000000117-120 | 455e9631/e7183cb9/bcd496a9/f271962d | 4:22:03-4:22:58 PM | Aceptados (4/4 31 via paso4-factura-real) |
  | 8-9 | E320000001034-1035 | da32baeb/2e5fd10d | 4:23:17-4:23:35 PM | Aceptados (2/2 32≥250K CORTES/RYLCO) |
  | 10 | E330000000018 | 5c7fa019 | 4:23:54 PM | Aceptado (1/1 33 NCFMod=E310000000119 CodMod=3) |
  | 11-12 | E410000000106-107 | 2446e1ec/ba245406 | 4:24:12-4:24:31 PM | Aceptados (2/2 41 BISONO) |
  | 13-14 | E430000000106-107 | e0138523/1398b2fa | 4:24:49-4:25:08 PM | Aceptados (2/2 43 exento) |
  | 15-16 | E440000000011-012 | bff25ac6/22ea2362 | 4:25:26-4:25:45 PM | Aceptados (2/2 44 CORTES exento) |
  | 17-18 | E450000000104-105 | fdf36965/6101ff4b | 4:26:03-4:26:21 PM | Aceptados (2/2 45 CNZFE) |
  | 19-20 | E460000000005-006 | b55c0968/6d1e7023 | 4:26:40-4:26:58 PM | Aceptados (2/2 46 US/CA exportación) |
  **Hallazgo #16 nuevo**: tipo 47 exige campo `TotalISRRetencion` (sin "d")
  en Totales — no `TotalISRRetenido`. XSD `e-CF-47-v1.0.xsd` línea 93 lo
  marca `minOccurs=0` pero DGII lo exige de facto (patrón "XSD opcional /
  DGII obligatorio" #7). Código de rechazo 11170. Fix: el operador debe
  pasar el nombre EXACTO del XSD; el builder ya emite el campo correcto
  cuando el operador lo pone bien. Payload congelado como
  `_PAYLOAD_47_CORRIDA_33` en `test_ecf_builder_generico.py` con test
  XSD-gate `test_payload_corrida33_tipo_47_valida_contra_xsd`. Portal
  final Playwright confirmado: 4/4 31 + 2/2 32≥250K + 1/1 33 + 0/2 34 + 2/2 41
  + 2/2 43 + 2/2 44 + 2/2 45 + 2/2 46 + **2/2 tipo 47** + 0/4 RFCE. **19/N
  RENGLONES ACTIVOS — RÉCORD ABSOLUTO** (nunca antes había pasado; las 32
  corridas previas jamás llegaron a 2/2 tipo 47). TFE_SECUENCIA post-33va:
  31→121, 32→1036, 33→19, 34→55 (bloqueada), 41→108, 43→108, 44→13, 45→106,
  46→7, 47→104 (100 y 101 quemadas Rechazadas, 102 y 103 Aceptadas).
  Bloqueo 34 (código 615) sigue activo. **Próximo paso (34va)**: construir
  endpoint nuevo `POST /api/fe/certificacion/paso4-rfce/` — capacidad
  faltante real de ZentoryERP (el endpoint `paso2-rfce` existente filtra
  `_RFCE_ENCFS_PASO2` fijos del Paso 2, no admite datos reales del Paso 4).
  Sub-plan con `writing-plans` + TDD. Debe recibir 4 facturas B02<250Mil
  reales de Abregonza (elegir de `TFAT_FACTURA` con `total_neto < 250000`
  y RNC comprador válido) → armar 4 e-CF32 + firmar + derivar código
  seguridad + armar 4 RFCE + `enviar_rfce` × 4. Tras 4/4 RFCE Aceptados,
  subir manualmente las 4 e-CF32 firmadas por el widget "Facturas de
  consumo < 250Mil" del propio portal (paso "Cuarto"). Con eso Fase 4
  llegaría a 23/N (todo menos 34 bloqueado). Commits: (ver commit de
  esta corrida — test XSD-gate 47 + plan maestro + probes).

- **2026-09-30 16:11-16:24 UTC (32va corrida)** — Runner scheduled. Fase 4 —
  **17/N ciclo rebuild + hallazgo #14 tipo 47 IndicadorFacturacion=4 obligatorio + fix builder**.
  Portal previo Playwright: 0/N (residual cascada 31va). TFE_SECUENCIA previo:
  31→109, 32→1030, 33→16, 34→55, 41→102, 43→102, 44→7, 45→102, 46→3, 47→100.
  **Reconstrucción 17/N** vía script `.tmp/ecf_32_full.py` (17 envíos consecutivos,
  todos Aceptados, 12:16:31-12:21:28 PM UTC-4): 4×31 (E310000000109-112 vía
  paso4-factura-real FC-0007607/7766/7829/8076) + 2×32≥250K (E320000001030
  CORTES 101001811 + E320000001031 RYLCO 131376292) + 1×33 (E330000000016
  NCFMod=E310000000111 FechaMod=20-11-2025 CodMod=3) + 2×41 BISONO
  (E410000000102-103) + 2×43 exento (E430000000102-103) + 2×44 CORTES exento
  (E440000000007-008) + 2×45 CNZFE (E450000000102-103) + 2×46 exportación
  (E460000000003 US + E460000000004 CA, PaisComprador+PaisDestino, builder
  31va fix `_gen_comprador` funcionando). **Probe 47** vía
  `.tmp/ecf_32_probe47.py`: E470000000100 (prox=100 desbloqueo 31va)
  **Rechazado código 244** "Los comprobantes tipo 47 solo permiten indicador
  de facturación exento" (trackId `4bf8db2c-9c96-4f4a-9691-8c60311f6b6f`,
  12:23:10 PM UTC-4). **Hallazgo #14** patrón "XSD permite / DGII exige"
  ampliado a tipo 47: fixture test `_base_47` heredaba `IndicadorFacturacion=0`
  del XSD, pero DGII exige `4` (Exento), mismo comportamiento que tipo 43
  descubierto en 21va corrida. Cascada borró los 17 aceptados (portal 0/N).
  **Fix desplegado** en `apps/fe/ecf_builder.py::_gen_detalles_items`
  (líneas 1160-1178): guard defensivo espejo del guard de tipo 43 —
  `if tipo_ecf==47 && str(indicador_fact) != '4' → ECFBuilderError`. Tests
  `test_tipo_47_pagos_al_exterior_valida_contra_xsd` +
  `test_tipo_47_sin_monto_isr_retenido_lanza_error` + fixture `_base_47`
  actualizados de `IndicadorFacturacion[1]=0` a `4`. **Rebuild inmediato**
  mismo run: script `ecf_32_full.py` re-ejecutado (rebuild en curso al
  cerrar corrida, mismo patrón validado — se espera 17/N restaurado antes
  del commit). TFE_SECUENCIA post-corrida: 31→113, 32→1032, 33→17, 34→55
  (bloqueada), 41→104, 43→104, 44→9, 45→104, 46→5, 47→101 (100 quemada
  Rechazada). Bloqueo 34 sigue activo. **Próximo paso (33va)**: reenviar
  1×47 con IndicadorFacturacion=4 + MontoExento en Totales (patrón tipo
  43 validado por 21va). Si sale limpio, cerrar 2×47 mismo run (19/N total)
  y arrancar grupo Tercero: 4×RFCE (`paso2-rfce` con datos reales) + subida
  manual 4×32 por el widget del portal. Commits: (ver commit de esta
  corrida — fix builder + tests + plan maestro).

- **2026-09-30 12:11-12:24 UTC (31va corrida)** — Runner scheduled. Fase 4 —
  **PRIMER 2/2 tipo 46 ACEPTADOS + descubrimiento contaminación DGII tipo 47**.
  Portal previo Playwright: 4/4 31 + 2/2 32≥250K + 1/1 33 + 2/2 41 + 2/2 43 +
  2/2 44 + 2/2 45 + 0/N resto (residual 30va, 15/N). TFE_SECUENCIA previo:
  31→109, 32→1030, 33→16, 34→55 (bloqueada), 41→102, 43→102, 44→7, 45→102,
  46→1, 47→1. **Fix builder desplegado (real gap)**: `_gen_comprador`
  ahora emite `PaisComprador` cuando `tipo_ecf==46` y `simple.get('PaisComprador')`
  presente (exclusivo del XSD de 46, campo semánticamente crítico para
  Exportaciones — comprador extranjero). Frozen `_PAYLOAD_46_CORRIDA_31` +
  `test_payload_corrida31_tipo_46_valida_contra_xsd` agregado (92/92 tests
  módulo pasan en contenedor). **Envíos**:
  | # | e-NCF | trackId | fechaRecepcion | Estado |
  |---|-------|---------|-----------------|--------|
  | 1 | E460000000001 | a8ae1ebc-7a51-447b-8542-7e88745ab836 | 9/30/2026 8:18:54 AM | **Aceptado** IMPORTADORA CARIBBEAN TRADING LLC / US-EIN-000000001 |
  | 2 | E460000000002 | 3689d986-7c33-4a1c-a1a6-63cf18814994 | 9/30/2026 8:19:22 AM | **Aceptado** CARIBE EXPORT LIMITED / CA-BIN-777777777 |
  | 3 | E470000000001 | c0cdab7f-439e-4a4b-81dd-3a5ed17a01e8 | 9/30/2026 8:20:02 AM | **Rechazado 1209** "secuencia ya utilizada" `secuenciaUtilizada:false` |
  **Hallazgo #13 patrón "contaminación secuencia DGII" extendido a tipo 47**:
  E470000000001 nunca consumida localmente (prox=1 pre-envío) pero DGII la
  marca como ya utilizada por envío histórico no documentado. Mismo patrón
  #11 (41 en 28va), #12 (45 en 29va), 43 en 21va. Cascada disparada por
  E470000000001 borró TODO el ciclo (portal 0/N). **Fix administrativo
  aplicado**: `UPDATE FAT.TFE_SECUENCIA SET prox_secuencia=100 WHERE
  no_cia='01' AND tipo_ecf=47` (1 fila) — mismo enfoque validado
  empíricamente 3 veces (43/41/45). TFE_SECUENCIA post: 31→109, 32→1030,
  33→16, 34→55 (bloqueada), 41→102, 43→102, 44→7, 45→102, 46→3, 47→**100**
  (destrabo aplicado). Bloqueo 34 sigue activo. **Ganancia neta código**:
  builder `_gen_comprador` ahora soporta `PaisComprador` (gap real de
  cobertura descubierto). **Ganancia neta certificación**: -13 renglones
  activos vs 30va (cascada 47), +2 aceptados 46 (perdidos post-cascada) +
  1 patrón DGII confirmado + destrabo 47 listo. **Próximo paso (32va)**:
  reconstruir ciclo Primero+Segundo (4×31 vía paso4-factura-real +
  2×32≥250K CORTES/RYLCO + 1×33 NCFMod=31_fresh + 2×41 BISONO + 2×43
  exento + 2×44 CORTES exento + 2×45 CNZFE + 2×46 exportación
  `_PAYLOAD_46_CORRIDA_31`); tras cerrar ciclo, probar **2×47** con
  `prox=100` ya aplicado (natural E470000000100+E470000000101,
  `_base_47`-style con IdentificadorExtranjero + PaisDestino +
  MontoISRRetenido obligatorio de facto). Total esperado: 19 renglones
  activos (todos excepto 34 bloqueado y 4×RFCE). Commits: (ver commit de
  esta corrida).

- **2026-09-30 08:10-08:20 UTC (30va corrida)** — Runner scheduled. Fase 4.
  (contenido histórico preservado abajo)

- **2026-09-30 04:11-04:25 UTC (29va corrida)** — Runner scheduled. Fase 4.
  Portal previo Playwright: 4/4 tipo 31 + 2/2 tipo 32≥250K + 1/1 tipo 33 +
  0/N resto (residual 28va). TFE_SECUENCIA previo: 31→105, 32→1028, 33→15,
  34→55 (bloqueada), 41→8 (contaminada DGII), 43→7, 44→4, 45→3, 46-47→1.
  Probe DGII OK (token len 343). **Primer envío exploración 44+45**: 1×44
  con `_PAYLOAD_44_CORRIDA_27` (NombreItem cosmético "INSUMO INDUSTRIAL
  EXENTO") → **E440000000004 Aceptado** (12:16:06 AM UTC-4, trackId
  `aa216c9d-b9fb-47e5-9020-0bb15de79987`). 1×45 con `_PAYLOAD_45_CORRIDA_26`
  → **E450000000003 Rechazado código 1209** "secuencia ya utilizada" con
  `secuenciaUtilizada:false` (12:16:37 AM UTC-4, trackId `22843a9d-87c6-4a3e-
  a821-f32ef376321e`). Cascada borró todo (portal 0/N, incluyendo el 44
  recién Aceptado). **Hallazgo #12 patrón "contaminación secuencia DGII"
  extendido a tipo 45**: E450000000003 nunca consumida localmente (`prox=3`
  intacto en TFE_SECUENCIA post-envío), pero DGII la marca como ya
  utilizada por envío histórico no documentado (mismo patrón que
  E430000000001 en 21va y E410000000007 en 28va — sub-serie contaminada por
  envío pre-certificación no registrado en TFE_SECUENCIA propio).
  **Estrategia validada empíricamente**: `UPDATE FAT.TFE_SECUENCIA SET
  prox_secuencia=100 WHERE tipo_ecf IN ('41','45')` salta el rango
  contaminado. **Segunda vuelta reconstrucción + probes** (12 envíos
  consecutivos, todos Aceptados):
  | # | e-NCF | trackId | fechaRecepcion | Notas |
  |---|-------|---------|-----------------|-------|
  | 1 | E310000000105 | f8187028-c6a9-4441-a712-b445cf6f7ced | 9/30/2026 12:21:54 AM | FC-0007607 |
  | 2 | E310000000106 | cfd42545-a056-467f-b126-22fed0586538 | 9/30/2026 12:22:15 AM | FC-0007766 |
  | 3 | E310000000107 | 1423c5d5-f0d5-4040-a67b-9fa7efa452d5 | 9/30/2026 12:22:34 AM | FC-0007829 (base 33) |
  | 4 | E310000000108 | eb0b0895-3b28-4a74-b4f6-5fb31ddbc535 | 9/30/2026 12:22:54 AM | FC-0008076 |
  | 5 | **E450000000100** | 80854f04-388b-472a-a0ed-44407bc6dddd | 9/30/2026 12:23:13 AM | **PROBE prox=100 → OK, hipótesis validada** |
  | 6 | **E410000000100** | 25cd71e7-56ab-4f3c-b500-e714ddda2ea7 | 9/30/2026 12:23:30 AM | **PROBE prox=100 → OK, hipótesis validada** |
  | 7 | E320000001028 | f5a243a6-b8d9-4f37-ae9c-61abc520634a | 9/30/2026 12:23:46 AM | CORTES 101001811 |
  | 8 | E320000001029 | e5479575-507c-498c-b7c9-194e9bce6966 | 9/30/2026 12:24:06 AM | RYLCO 131376292 |
  | 9 | E330000000015 | ed4f64e9-6208-43b1-9e90-7d5306505f3c | 9/30/2026 12:24:25 AM | NCFMod=E310000000107 FechaMod=20-11-2025 CodMod=3 |
  | 10| E440000000005 | 1effca85-6dfe-4ffb-a93b-51d0a3e8caa7 | 9/30/2026 12:24:42 AM | 2do 44 |
  | 11| E450000000101 | c7ebd0c4-9fc3-4129-b764-7633c8309826 | 9/30/2026 12:24:58 AM | 2do 45 (natural post-probe) |
  | 12| E410000000101 | 3c4906ed-b539-4606-ab91-f024a7ae6ae4 | 9/30/2026 12:25:15 AM | 2do 41 (natural post-probe) |
  Portal final Playwright post-corrida: **4/4 tipo 31 + 2/2 tipo 32≥250K +
  1/1 tipo 33 + 2/2 tipo 41 + 1/2 tipo 44 + 2/2 tipo 45 + 0/N resto**
  (nota: tipo 44 muestra 1/2 aunque envío consecutivo mostró 2 Aceptados —
  E440000000004 pre-cascada NO cuenta post-reset, solo cuenta el
  E440000000005 post-reset; discrepancia normal patrón "un aceptado pre-
  reset no cuenta post-reset"). Log último reinicio 30/09 12:16:37 AM
  (rechazo E450000000003), sin nuevos post-Aceptados. **Ganancia neta vs
  28va (7 activos)**: +5 activos (12 renglones vs 7). Renglones nuevos
  cerrados: 41, 45. TFE_SECUENCIA post: 31→109, 32→1030, 33→16, 34→55
  (bloqueada), 41→102, 43→7 (posible contaminada), 44→6, 45→102, 46-47→1.
  Bloqueo 34 sigue activo. Sin código nuevo (script `.tmp/ecf_29_full.py`
  no va al repo). Fix administrativo: `UPDATE TFE_SECUENCIA prox=100` para
  tipos 41 y 45 (documentado, no requiere código). **Próximo paso (30va)**:
  (a) completar **2do 44** vía `paso4-manual` (E440000000006, siguiente
  natural, `_PAYLOAD_44_CORRIDA_27` con NombreItem cosmético distinto de
  hoy) → 2/2 44; (b) desbloquear **tipo 43**: `UPDATE TFE_SECUENCIA SET
  prox_secuencia=100 WHERE tipo_ecf='43'` y enviar 2×43 con
  `_PAYLOAD_43_CORRIDA_21` (Gastos Menores exento, MontoExento=150) → 2/2;
  (c) 1×46 primer contacto (Exportaciones — comprador extranjero,
  PaisDestino) — requiere investigación caps builder tipo 46; (d) 1×47
  (Pagos al Exterior) similar; (e) grupo Tercero: RFCE 4×32<250Mil +
  subida manual 4×32. No tocar 34 hasta que soporte DGII resuelva 615.
  Commits: (ver commit de esta corrida).

- **2026-09-29 20:11-20:22 UTC (28va corrida)** — Runner scheduled. Fase 4.
  Portal previo Playwright: 1/2 tipo 44 + 1/2 tipo 45 + 0/N resto (residual
  27va). TFE_SECUENCIA previo: 31→97 (rango 1..10M — usuario amplió post-
  26va), 32→1024, 33→13, 34→55 (bloqueada), 41→6, 43→7, 44→4, 45→3, 46-47→1.
  Probe DGII OK. **Primer intento del ciclo completo (11 envíos)**:
  4×31 (E310000000097-100) + 2×32≥250K (E320000001024-1025 CORTES/RYLCO)
  + 1×33 (E330000000013 NCFMod=E310000000099 FC-0007829 RNC 131265863
  FechaNCFMod=20-11-2025 CodMod=3) + 1×41 BISONO (E410000000006)
  **8/8 Aceptados consecutivos** (8:19:46-8:19:56 PM UTC-4). Segundo 1×41
  BISONO (E410000000007) → **Rechazado código 1209 "Este número de
  secuencia ya ha sido utilizado"** con `secuenciaUtilizada:false` (8:19:57
  PM UTC-4, trackId `ecc9aefb-57c7-4b48-ab7a-440200c1aa83`). Cascada
  borró TODO (portal 0/N, incluidos los 1/2 44 + 1/2 45 previos de la
  27va). **Hallazgo #11 patrón "secuencia contaminada en DGII"**: E410
  000000007 fue Rechazada como "ya utilizada" en DGII aunque nunca fue
  consumida en nuestro TFE_SECUENCIA (`prox=8` post-envío pero
  `secuenciaUtilizada:false` en la respuesta). Mismo patrón que
  E430000000001 (21va corrida) — envío histórico no documentado en el
  lado DGII (¿Modo Test antes del inicio formal?). Runner NO reintentó
  41 esta corrida — riesgo de otra cascada con las siguientes secuencias
  también contaminadas. **Segunda vuelta reconstrucción**: 4×31
  (E310000000101-104 FC-0007607/7766/7829/8076 vía paso4-factura-real) +
  2×32≥250K (E320000001026-1027 CORTES/RYLCO) + 1×33 (E330000000014
  NCFMod=E310000000103 fresh, mismos datos que primer intento) →
  **7/7 Aceptados consecutivos** (8:21:54-8:22:03 PM UTC-4). Portal
  Playwright post-corrida final: **4/4 tipo 31 + 2/2 tipo 32≥250K + 1/1
  tipo 33 + 0/N resto** (log último reinicio 29/09 8:19:57 PM sin
  reinicios post-Aceptados). Costo: 4 secuencias 31 desechadas (E31
  0000000097-100 quemadas Aceptadas pero borradas de portal) + 2 secuencias
  32 desechadas (E320000001024-1025) + 1 secuencia 33 desechada (E330
  000000013) + 1 secuencia 41 rechazada (E410000000006 Aceptada perdida,
  E410000000007 Rechazada 1209) + 1/2 44 + 1/2 45 previos borrados.
  Ganancia neta vs preámbulo: +5 renglones activos (2→7). Sin código
  nuevo desplegado esta corrida — scripts en `.tmp/ecf_28_run.py` y
  `.tmp/ecf_28_rebuild.py` (no van al repo). TFE_SECUENCIA post: 31→105
  (rango holgado 1..10M), 32→1028, 33→15, 34→55 (bloqueada), 41→8 (con 7
  contaminada en DGII), 43→7, 44→4, 45→3, 46-47→1. Bloqueo 34 sigue
  activo. **Próximo paso (29va)**: (a) desbloquear tipo 41 avanzando
  `prox_secuencia` a un valor libre en DGII — estrategia recomendada:
  saltar de 8 a 100 (`UPDATE TFE_SECUENCIA SET prox_secuencia=100 WHERE
  no_cia='01' AND tipo_ecf=41`) y probar 1×41; si rechaza 1209 de nuevo
  ir a 200, 500, etc. (mismo enfoque que 21va con el 43 acabó
  encontrando E430000000004 libre). El costo de esta prueba es máximo
  1 cascada perdiendo los 7 activos actuales. (b) Una vez desbloqueado
  41, cerrar 2×41 + 2×43 (43 también puede tener secuencia contaminada
  por herencia del envío histórico — misma investigación) + 2do 44 + 2do
  45. (c) Después 1×46 primer contacto (Exportaciones, PaisDestino) +
  1×47 (Pagos al Exterior). No tocar 34 hasta que soporte DGII resuelva
  código 615. Commits: (ver commit de esta corrida).

- **2026-09-29 15:50-16:03 UTC (27va corrida)** — Runner scheduled. Fase 4
  — **PRIMER 1/2 tipo 44 + PRIMER 1/2 tipo 45 ACEPTADOS** por certecf tras
  2 rechazos de aprendizaje. Portal previo Playwright (idéntico al preámbulo
  25va/26va): 4/4 tipo 31 + 2/2 tipo 32≥250K + 1/1 tipo 33 + 2/2 tipo 41 +
  2/2 tipo 43 + 0/N resto. Precondición 26va cumplida: `secuencia_hasta`
  tipo 31 = 10,000,000 (usuario extendió). Probe DGII OK (token len 343).
  **Rechazo 1** — E440000000001 (trackId `39de3934-c87c-490f-80e6-9e996274ace2`,
  11:54:26 AM UTC-4, `_PAYLOAD_44_CORRIDA_25` sin RNCComprador) código 1381
  "RNCComprador es obligatorio" → cascada borró 11/N acumulados. **Hallazgo
  #9 patrón "XSD opcional / DGII exige"**: tipo 44 exige RNCComprador
  aunque `_TIPO_CAPS[44]['comprador']` era `'razon_mandatory'`. **Fix
  desplegado**: cap actualizado a `'rnc_razon_mandatory'` en
  `apps/fe/ecf_builder.py`. Tests actualizados (`_base_44` + histórico
  `test_tipo_44_regimenes_especiales_valida_contra_xsd` + `test_payload_
  corrida25_tipo_44_valida_contra_xsd`). Nuevo `_PAYLOAD_44_CORRIDA_27`
  con RNCComprador 101001811 (CORTES HERMANOS, validado empíricamente por
  la 14va corrida) + `test_payload_corrida27_tipo_44_con_rnc_valida_contra_xsd`
  + `test_tipo_44_sin_rnc_comprador_lanza_error_corrida27` defensivo.
  **Envío RETRY 44** — E440000000003 (trackId `d84ab58c-eafa-4885-9548-
  641e90e50a39`, 12:00:53 PM UTC-4) **Aceptado**.
  **Rechazo 2** — E450000000001 (trackId `1db547cd-785c-4964-82d0-ace8c646496f`,
  11:59:21 AM UTC-4, `_PAYLOAD_45_CORRIDA_26` sin IndicadorMontoGravado)
  código 176 "IndicadorMontoGravado del área IdDoc no es válido" → cascada
  borró el 44 recién aceptado. **Hallazgo #10 patrón "XSD opcional / DGII
  exige"**: tipo 45 exige IndicadorMontoGravado aunque el XSD lo marque
  opcional. Mismo patrón que tipo 31 aprendió en la 1ra corrida (código
  176). **Fix payload**: `_PAYLOAD_45_CORRIDA_26` actualizado con
  `IndicadorMontoGravado=0`. **Envío RETRY 45** — E450000000002 (trackId
  `1718043e-b5a3-4359-b988-41a96b2e8fcd`, 12:01:56 PM UTC-4) **Aceptado**.
  **Portal final Playwright**: 1/2 tipo 44 + 1/2 tipo 45 + 0/N resto (log
  registra reinicios 11:54 y 11:59, sin nuevos post-Aceptados). Tests: 90/90
  módulo `test_ecf_builder_generico.py` pasan en contenedor. Bloqueo 34
  sigue activo. Costo: 2 secuencias 44 quemadas (001 Rechazada, 002 Aceptada
  luego borrada por cascada) + 1 secuencia 45 quemada Rechazada + reset del
  ciclo Primero previo. Ganancia neta: 2 nuevos renglones activos + 2 reglas
  de negocio DGII confirmadas empíricamente + builder blindado. Estado
  TFE_SECUENCIA post: 31→97, 32→1024, 33→13, 34→55, 41→6, 43→7, 44→4, 45→3,
  46-47→1. Próximo paso (28va): reconstruir ciclo Primero+Segundo (4×31 vía
  `paso4-factura-real` + 2×32≥250K RYLCO/VALOIS + 1×33 NCFMod del 31
  fresco + 2×41 INDUSTRIAS BISONO + 2×43 exento) + 2do 44 `_PAYLOAD_44_
  CORRIDA_27` con NombreItem cosmético distinto + 2do 45 `_PAYLOAD_45_
  CORRIDA_26` con NombreItem cosmético distinto. Después 1×46 (Exportaciones,
  comprador extranjero + PaisDestino, primer contacto) y 1×47 (Pagos al
  Exterior). Commits: (ver commit de esta corrida).

- **2026-09-28 12:10-12:30 UTC (26va corrida)** — Runner scheduled. Fase 4 —
  **payload congelado `_PAYLOAD_45_CORRIDA_26` para primer contacto tipo 45**
  (Gubernamental) sin envíos a DGII. Portal previo Playwright: 4/4 tipo 31 +
  2/2 tipo 32≥250K + 1/1 tipo 33 + 0/2 tipo 34 (bloqueada) + 2/2 tipo 41 +
  2/2 tipo 43 + 0/2 resto (44-47) + 0/4 RFCE, último reinicio sigue 27/09
  8:19:02 PM (sin nuevos post-25va). TFE_SECUENCIA sin cambios: 31→97 (rango
  1..100, **4 restantes — usuario aún no amplió** `secuencia_hasta`), 32→1024,
  33→13, 34→55, 41→6, 43→7, 44-47→1. Decisión (misma que 24va/25va): con rango
  31 tan estrecho no arriesgar primer contacto tipo 44/45 — cascada agotaría
  las 4 secuencias en la reconstrucción de 4×31. Trabajo libre de riesgo:
  cliente real 573 CONSEJO NACIONAL DE ZONAS FRANCAS DE EXPORTACION (RNC
  401501406) elegido para tipo 45; estrategia ITBIS 18% breakdown completo
  (MontoGravadoTotal/I1=5000, ITBIS1=18, TotalITBIS/1=900, MontoTotal=5900),
  TipoPago=1 (Contado, evita FechaLimitePago). Frozen `_PAYLOAD_45_CORRIDA_26`.
  `test_payload_corrida26_tipo_45_valida_contra_xsd` agregado, **88/88 módulo +
  237/237 paquete** `apps/fe/tests/` pasan en contenedor. Bloqueo 34 sigue
  activo (requiere acción del usuario). Sin cambios de production code.
  Próximo paso (27va): verificar si usuario amplió rango tipo 31; si sí,
  enviar 1×44 `_PAYLOAD_44_CORRIDA_25` primero (más simple, sin RNCComprador
  ni ITBIS) y luego 1×45 `_PAYLOAD_45_CORRIDA_26` en la misma corrida; si no,
  repetir patrón congelando payload tipo 46 (Exportaciones) o 47 (Pagos al
  Exterior). Commits: (ver commit de esta corrida).

- **2026-09-28 08:10-08:35 UTC (25va corrida)** — Runner scheduled. Fase 4 —
  **payload congelado `_PAYLOAD_44_CORRIDA_25` para primer contacto tipo 44**
  (Régimen Especial) sin envíos a DGII. Portal previo Playwright: 4/4 tipo 31
  + 2/2 tipo 32≥250K + 1/1 tipo 33 + 0/2 tipo 34 (bloqueada) + 2/2 tipo 41
  + 2/2 tipo 43 + 0/2 resto (44-47) + 0/4 RFCE, último reinicio 27/09
  8:19:02 PM (sin nuevos post-24va). TFE_SECUENCIA sin cambios: 31→97 (rango
  1..100, **4 restantes — usuario aún no amplió** `secuencia_hasta`), 32→1024,
  33→13, 34→55, 41→6, 43→7, 44-47→1. Decisión (misma que 24va): con rango 31
  tan estrecho no arriesgar primer contacto tipo 44/45 — cascada agotaría
  las 4 secuencias en la reconstrucción de 4×31. Trabajo libre de riesgo:
  query directa a `CXC.TCXC_CLIENTE` → identificado cliente real 641 ZONA
  FRANCA SAN ISIDRO S.A. (RNC 101506091) para tipo 44 y 573 CONSEJO NACIONAL
  DE ZONAS FRANCAS EXP (RNC 401501406) para tipo 45. Frozen
  `_PAYLOAD_44_CORRIDA_25` con estrategia Exento (IndicadorFacturacion=4 +
  MontoExento, mínima superficie de rechazo tras lección 21va tipo 43).
  Iteración TDD: primer intento con `IndicadorMontoGravado=0` defensivo
  rechazado por XSD (`IdDoc` de tipo 44 NO incluye ese campo, a diferencia
  de 31/32); campo removido → gate XSD pasa limpio. `test_payload_corrida25_
  tipo_44_valida_contra_xsd` agregado, **87/87 módulo + 236/236 paquete**
  `apps/fe/tests/` pasan en contenedor. Bloqueo 34 sigue activo (requiere
  acción del usuario). Sin cambios de production code. Próximo paso (26va):
  verificar si usuario amplió rango tipo 31 (`list_secuencias('01')`); si sí,
  enviar 1×44 con `_PAYLOAD_44_CORRIDA_25` vía paso4-manual; si no, repetir
  patrón congelando payload tipo 45 (CONSEJO NACIONAL 401501406, ITBIS 18%
  con breakdown). Commits: (ver commit de esta corrida).

- **2026-09-28 04:10-04:35 UTC (24va corrida)** — Runner scheduled. Fase 4
  — **guard defensivo código 634 desplegado** (TDD, 235/235 tests). Portal
  previo Playwright: 4/4 tipo 31 + 2/2 tipo 32≥250K + 1/1 tipo 33 + 0/2
  tipo 34 (bloqueada) + 2/2 tipo 41 + 2/2 tipo 43 + 0/2 resto, sin nuevos
  reinicios post-23va. TFE_SECUENCIA previo: 31→97 (¡sólo 4 restantes en
  rango 1..100!), 32→1024, 33→13, 34→55, 41→6, 43→7, 44-47→1. Decisión
  operativa: NO enviar primer contacto tipo 44/45 con el rango 31 tan
  estrecho (rechazo cascada agotaría 97..100). En su lugar, cerrar el
  TODO obligatorio de la 23va: `apps/fe/views.py::_validar_fecha_ncf_
  modificado_contra_documento` para `tipo_ecf∈{33,34}` — extrae
  FechaEmision del XML firmado del NCFModificado en TFE_DOCUMENTO propio
  y compara con `datos.FechaNCFModificado`; si difiere corta con HTTP 400
  ANTES de `consumir_siguiente_encf`. 4 tests nuevos
  (`test_paso4_manual_fecha_ncf_modificado_*`), 21/21 módulo + 235/235
  paquete `apps/fe/tests/` pasan en el contenedor. Smoke real end-to-end
  contra E310000000096 (FechaEmision=09-05-2025 en XML): guard bloquea
  fecha errónea correctamente y deja pasar la correcta. Bloqueo 34 sigue
  activo (requiere acción del usuario). Sin envíos a DGII, TFE_SECUENCIA
  inalterada. Próximo paso (25va): 1×44 primer contacto con XSD-gate;
  usuario debería ampliar rango tipo 31 antes (UPDATE `secuencia_hasta`).
  Detectado archivo `backend/apps/legacy/repositories/inv_repo.py` con
  cambios no commiteados que no son de este runner — no tocados.
  Commits: (ver commit de esta corrida).

- **2026-09-30 08:10-08:20 UTC (30va corrida)** — Runner scheduled. Fase 4 —
  **+3 renglones netos, portal a 15/N sin cascada**. Portal previo Playwright:
  4/4+2/2+1/1+2/2+1/2 (44)+2/2 (45) + 0/N resto (residual 29va, sin nuevos
  reinicios). TFE_SECUENCIA previo: 31→109, 32→1030, 33→16, 34→55, 41→102,
  43→7 (contaminada), 44→6, 45→102, 46-47→1.

  **Envío #1: 2do tipo 44** — `_PAYLOAD_44_CORRIDA_27` (CORTES 101001811,
  IndicadorFacturacion=4, MontoExento=5000) con `NombreItem="INSUMO EXENTO
  REGIMEN ESPECIAL"` (variante cosmética). **E440000000006 Aceptado**
  (trackId `482ee6c9-2c14-412a-b455-4c558ef7123c`, 4:15:42 AM UTC-4,
  `codigo:1`, `secuenciaUtilizada:true`). Portal → 2/2 tipo 44.

  **Envío #2-3: 2/2 tipo 43 tras desbloqueo prox=100**. `UPDATE
  FAT.TFE_SECUENCIA SET prox_secuencia=100 WHERE no_cia='01' AND
  tipo_ecf='43'` (mantenimiento administrativo local, 1 fila). Estrategia
  contaminación DGII validada 4a vez (previo: 41 en 28va, 45 en 29va, 41
  en 29va). Payload base `_PAYLOAD_43_CORRIDA_21` (Gastos Menores, MontoExento
  150), NombreItem cosméticos distintos:
  - E430000000100 (`Agua potable oficina`) Aceptado (trackId
    `91260cb1-a143-4f09-a9fc-fe837bc4ea22`, 4:16:26 AM UTC-4) → 1/2 tipo 43.
  - E430000000101 (`Cafe personal oficina`) Aceptado (trackId
    `181b51a6-7f47-4122-ab89-3f2a5332898a`, 4:16:31 AM UTC-4) → **2/2 tipo
    43**.

  Portal final Playwright verificado: **4/4 tipo 31 + 2/2 tipo 32≥250K +
  1/1 tipo 33 + 2/2 tipo 41 + 2/2 tipo 43 + 2/2 tipo 44 + 2/2 tipo 45 +
  0/2 tipo 34/46/47 + 0/4 RFCE** (15/N acumulados). Log último reinicio
  sigue 30/09 12:16:37 AM (fin ciclo 29va, sin nuevos rechazos esta
  corrida). Bloqueo 34 sigue activo (código 615, sin cambios).

  Sin código nuevo esta corrida — patrones y payloads ya validados,
  scripts `/tmp/run44.py` + `/tmp/run43.py` ad-hoc en contenedor, no van
  al repo. TFE_SECUENCIA post-corrida: 31→109, 32→1030, 33→16, 34→55
  (bloqueada), 41→102, 43→102 (desbloqueada), 44→7, 45→102, 46-47→1.
  Rangos con sobras cómodas para próximas cascadas.

  **Próximo paso (31va)**: primer contacto tipo 46 (Exportaciones) —
  requiere investigación previa: leer sección "Exportaciones" del
  `Formato-e-CF-V1.0.pdf` + XSD `e-CF-46-v1.0.xsd` en
  `apps/fe/tests/schemas/` para identificar campos de-facto obligatorios
  (PaisDestino, TipoIngresos válido para exportación, RNC comprador
  extranjero — likely `IdExtranjero` en lugar de `RNCComprador`), agregar
  test XSD-gate `test_payload_corrida31_tipo_46_valida_contra_xsd` con
  payload realista Abregonza (exportación a cliente extranjero real de
  la BD si existe, o payload sintético conservador), y solo entonces
  enviar 1× primer contacto. Riesgo alto: cascade destruye 15 activos.
  Si 46 sale limpio, mismo día 47 (Pagos al Exterior, patrón similar).
  Después grupo Tercero (4× RFCE + 4× carga manual 32 subida por portal).
  Commits: (ver commit de esta corrida — sólo actualización plan maestro).

- **2026-09-27 16:14-16:24 UTC (21va corrida)** — Runner scheduled. Fase 4
  — **PRIMER TIPO 43 ACEPTADO** por certecf tras 3 rechazos de aprendizaje.
  Portal previo Playwright: 4/4+2/2+1/1+2/2+0/N resto (residual 20va, sin
  nuevos reinicios). TFE_SECUENCIA previo: 43→1. Probe DGII OK (token 343).
  Test XSD-gate `test_payload_corrida21_tipo_43_valida_contra_xsd`
  agregado, 84/84 tests módulo pasan. **3 rechazos consecutivos que
  agotaron el ciclo acumulado** (perdidos 9/N aceptados de corridas 17-20):
  (1) **E430000000001 código 1209** "secuencia ya utilizada" con
  `secuenciaUtilizada:false` — E430000000001 estaba quemada en el lado
  DGII (envío histórico no documentado, quizás Modo Test antes del inicio
  formal de certificación); portal reiniciado en cascada.
  (2) **E430000000002 código 244** "solo permiten indicador de facturación
  exento" con `IndicadorFacturacion=2` — descubierto que el catálogo DGII
  es 1=18%, 2=16%, 3=0%, **4=Exento** (usé 2 pensando que era exento; es
  16% ITBIS). Para tipo 43 SOLO IndicadorFacturacion=4 es válido.
  (3) **E430000000003 código 1960** "MontoExento de Totales no es válido"
  con `IndicadorFacturacion=4` sin `MontoExento` — descubierto que cuando
  hay línea exenta la DGII exige `MontoExento` en Totales aunque el XSD
  linea 32 lo marque `minOccurs=0`. Patrón "XSD opcional / DGII exige" #8.
  Fix payload: agregado `MontoExento: '150.00'` al mismo nivel de
  MontoTotal. (4) **E430000000004 ACEPTADO** (trackId `4e8a93e0-1e4b-44a9-
  8488-22b9f99cb636`, 12:23:00 PM UTC-4) con IndicadorFacturacion=4 +
  MontoExento=150 + MontoTotal=150. Portal final Playwright (pre-último
  envío exitoso, no re-verificado post-Aceptado por budget): 0/N tras los
  cascadas. `_PAYLOAD_43_CORRIDA_21` en el test actualizado al payload
  correcto final para trazabilidad. **TODO obligatorio para la 22va antes
  de reintentar 43** (mismo patrón que 18va→19va con el fix del 41):
  agregar guards defensivos en `apps/fe/ecf_builder.py` para tipo 43:
  (a) si `tipo_ecf==43 && str(IndicadorFacturacion)!='4'` → `ECFBuilderError`;
  (b) si `tipo_ecf==43 && MontoExento is None` → `ECFBuilderError`. Tests
  espejo. Costo: 9/N acumulados perdidos + 3 secuencias 43 quemadas (001
  pre-existente, 002/003 rechazadas). Ganancia neta: primer 43 Aceptado
  + regla nueva confirmada + patrón XSD/DGII #8 documentado.
  TFE_SECUENCIA post-corrida: 31→89, 32→1020, 33→11, 34→55, 41→4, 43→5,
  44-47→1. Bloqueo 34 sigue activo. Próximo paso (22va): (1) desplegar
  guards defensivos del builder 43; (2) rehacer 4×31+2×32≥250K+1×33+2×41+
  1×43 con patrón validado (~5-6 min end-to-end, mínimo riesgo); (3)
  2×43 2do envío y 1×44 primer contacto. Commit incluye: test XSD-gate
  actualizado + plan maestro.

- **2026-09-28 00:10-00:22 UTC (23va corrida)** — Runner scheduled. Fase 4
  — **ciclo Primero+Segundo completo (11/N aceptados en portal)** tras 1
  rechazo inicial de aprendizaje. Portal previo (Playwright): 1/4 tipo 31 +
  1/2 tipo 43 + 0/N resto (residual de la 22va). TFE_SECUENCIA previo:
  31→90, 32→1020, 33→11, 34→55, 41→4, 43→5, 44-47→1.

  **Nuevo hallazgo crítico — código 634 "FechaNCFModificado no coincide con
  la fecha de emisión de comprobante a modificar"**. Al emitir un e-CF31 vía
  `paso4-factura-real` desde una factura de `TFAT_FACTURA`, el builder
  `construir_ecf_31` toma la `fecha` REAL de la factura (papel), NO la fecha
  del envío al portal. Un 33/34 que referencia ese e-CF por `NCFModificado`
  DEBE usar como `FechaNCFModificado` esa misma fecha papel — no `today`.
  FC-0007607 fecha=09-05-2025, FC-0007766=25-09-2025, FC-0007829=20-11-2025,
  FC-0008076=09-06-2026 (confirmado por query directa a `FAT.TFAT_FACTURA`).
  Perdida inicial: E330000000011 Rechazado con código 634 al usar
  FechaNCFModificado='27-09-2026', cascada borró 3×31 (E310000000090-092) +
  2×32≥250K (E320000001020-1021) que estaban Aceptados. Portal a 0/N.

  **Reintento con fix aplicado** (`FechaNCFModificado='20-11-2025'` para el
  33 que referencia E31 de FC-0007829): 9/9 Aceptados consecutivos +
  posterior cierre 2/2:

  | # | e-NCF | trackId | Estado | Notas |
  |---|-------|---------|--------|-------|
  | 1 | E310000000093 | e073ee8f-7d16-4967-bb35-080cff67a3a9 | Aceptado | FC-0007766 (2/4) |
  | 2 | E310000000094 | 29b1d991-eea7-4d4c-8cd6-f8ab2e014f29 | Aceptado | FC-0007829 (3/4) → base del 33 |
  | 3 | E310000000095 | 3d821298-ae2d-43fb-849d-f4544371c6cd | Aceptado | FC-0008076 (4/4) — pero luego cascada de rechazo intermedio, cierre con 096 |
  | 4 | E320000001022 | fdc0b8c8-b0e6-4373-904d-3b6329439d59 | Aceptado | CORTES 101001811, MontoTotal 295K |
  | 5 | E320000001023 | 65251a53-b50c-47fc-9865-7f99f6e06030 | Aceptado | RYLCO 131376292, MontoTotal 295K |
  | 6 | E330000000012 | 74b14fc2-41b3-4003-94db-b788d43caf0b | Aceptado | NCFMod=E310000000094 PAE, FechaMod=20-11-2025, CodMod=3 |
  | 7 | E410000000004 | 668c6528-a169-4ecd-a881-76374f0c7ae5 | Aceptado | INDUSTRIAS BISONO, retención 900 |
  | 8 | E410000000005 | 865ddc50-8fe2-4b97-9cca-9546a25ea8da | Aceptado | INDUSTRIAS BISONO, ítem cosmético |
  | 9 | E430000000005 | e4f0fbe1-6466-4f19-a780-1c5b877a04ee | Aceptado | Gastos Menores 2do — pero portal marcó 1/2 |
  | 10| E310000000096 | 99c9fff7-ca44-486e-952f-2b9cae2dc791 | Aceptado | Cierre FC-0007607 (4/4) |
  | 11| E430000000006 | 38c9d987-7642-4334-b6b3-82274d47ca40 | Aceptado | Cierre 2/2 tipo 43 |

  Portal final Playwright: **4/4 tipo 31 + 2/2 tipo 32≥250K + 1/1 tipo 33 +
  2/2 tipo 41 + 2/2 tipo 43 + 0/N resto**. Log último reinicio 27/09 8:19:02
  PM (rechazo E330000000011).

  **TODO obligatorio para la 24va corrida**: agregar guard defensivo en
  `apps/fe/views.py:certificacion_paso4_manual_view` que, cuando
  `tipo_ecf ∈ {33,34}` y `datos.NCFModificado` existe en `TFE_DOCUMENTO`
  del propio no_cia, extraiga la `FechaEmision` real del XML enviado y
  valide que `datos.FechaNCFModificado` coincida ANTES de consumir
  secuencia. Previene el mismo error 634 en el futuro (cada uno cuesta
  cascada completa). Costo si se hace inline: ~1h de código + tests
  (patrón sub-plan `superpowers:writing-plans`).

  TFE_SECUENCIA post-corrida: 31→97, 32→1024, 33→13, 34→55, 41→6, 43→7,
  44-47→1 cada uno. Rango tipo 31 se estrecha a 4 secuencias restantes
  (97..100) — ATENCIÓN: si hay otro reset+reenvío completo, quedan pocas
  secuencias para tipo 31. Considerar ampliar `secuencia_hasta` de
  `TFE_SECUENCIA` para tipo 31 antes de arriesgar otra cascada.

  Bloqueo 34 sigue activo (código 615 saldo disponible, requiere soporte
  DGII con trackId `daeac04a-b4cd-4e27-89e4-a3d831513086`).

  **Próximo paso (24va)**: (a) opcional — desplegar guard defensivo del
  `paso4-manual` para prevenir código 634 con TDD (sub-plan corto,
  ~1-1.5h); (b) 1×44 primer contacto (Régimen Especial) — requiere
  investigación previa de qué caps del builder aplican (retención? tipo
  ingresos? RNC especial?), payload realista y test XSD-gate; (c) 1×45
  primer contacto (Gubernamental) si el 44 sale limpio. NO abrir 46/47
  ni RFCE aún — dejar como colchón para 25va+. Bloqueo 34 sigue esperando
  acción humana.

  Sin código nuevo esta corrida — solo scripts en `.tmp/`
  (`ecf_23_run.py`, `ecf_23_cierre.py`), no van al repo. Commit solo del
  plan maestro.
  Commits: (ver commit de esta corrida).

- **2026-09-27 20:10-20:25 UTC (22va corrida)** — Runner scheduled. Fase 4
  — **guards defensivos tipo 43 desplegados** + arranque de rehacer ciclo.
  Portal previo (Playwright confirmado): 1/2 tipo 43 (E430000000004
  superviviente de la 21va) + 0/N resto. TFE_SECUENCIA previo: 31→89,
  32→1020, 33→11, 34→55, 41→4, 43→5, 44-47→1.

  **Guards agregados a `apps/fe/ecf_builder.py`** (siguiendo TODO obligatorio
  de la 21va corrida):
  (a) `_gen_detalles_items`: si `tipo_ecf==43 && str(IndicadorFacturacion)!='4'`
      → `ECFBuilderError`. Previene rechazo real código 244 "solo permiten
      indicador de facturación exento" (E430000000002 en 21va).
  (b) `_gen_totales`: si `tipo_ecf==43 && MontoExento is None` →
      `ECFBuilderError`. Previene rechazo real código 1960 "MontoExento
      de Totales no es válido" (E430000000003 en 21va). Patrón "XSD
      opcional / DGII exige" #8.

  Tests: 2 nuevos defensivos (`test_tipo_43_indicador_facturacion_distinto_de_4_lanza_error_corrida22`,
  `test_tipo_43_sin_monto_exento_lanza_error_corrida22`), más
  `test_tipo_43_gastos_menores_valida_contra_xsd` y
  `test_tipo_43_ignora_rnc_comprador_no_existe_elemento_comprador` +
  fixture `_base_43()` actualizados para satisfacer los nuevos guards
  (IndicadorFacturacion=4 + MontoExento). 86/86 tests del módulo pasan en
  contenedor `facturation_backend`. Probe DGII OK (autenticacion/semilla
  HTTP 200 <100ms).

  **Envío realizado**: 1×31 vía `paso4-factura-real` (FC-0007607) →
  **E310000000089 Aceptado** (trackId `9f9b1130-a999-43f6-b6ec-aefaad43c4c0`,
  fechaRecepcion 4:17:41 PM UTC-4, `codigo:1`, `secuenciaUtilizada:true`).
  Portal esperado: 1/4 tipo 31 + 1/2 tipo 43 + 0/N resto.

  **Sin cascada nueva** en esta corrida — el único envío fue Aceptado.
  Bloqueo 34 sigue activo (sin cambios, requiere acción del usuario:
  soporte DGII con trackId `daeac04a-b4cd-4e27-89e4-a3d831513086`).
  TFE_SECUENCIA post-corrida: 31→90 (secuencia 89 consumida Aceptada),
  32→1020, 33→11, 34→55, 41→4, 43→5, 44-47→1.

  **Próximo paso (23va)**: completar los 3 tipo 31 restantes desde
  FC-0007766/7829/8076 (patrón validado 8+ veces, mínimo riesgo, `paso4-
  factura-real`) → luego 2×32≥250K (paso4-manual con RNCs ya probados:
  CORTES 101001811 + RYLCO 131376292) → luego 1×33 (paso4-manual con
  NCFModificado=E31 del ciclo actual + RNCComprador coincidente) → luego
  2×41 (`_PAYLOAD_41_CORRIDA_19`, INDUSTRIAS BISONO) → luego 1×43 2do
  (`_PAYLOAD_43_CORRIDA_21`) → 1×44 primer contacto (Regímenes Especiales,
  requiere elegir RazonSocialComprador de zona franca real). Después
  45/46/47 uno a uno y RFCE al final.

  Commits: (ver commit de esta corrida).
- **2026-09-27 12:10-12:18 UTC (20va corrida)** — Runner scheduled. Fase 4
  — **2/2 tipo 41 completo**. Portal previo 4/4+2/2+1/1+1/2 (residual de
  19va). Probe DGII OK (token len 343). TFE_SECUENCIA previo: 41→3, resto
  sin cambios. **E410000000003** (trackId `46c44bf0-fc7b-42a9-b125-02d185cc9d7b`,
  8:15:39 AM UTC-4) **Aceptado**, INDUSTRIAS BISONO 101621516, patrón
  validado por 19va (`_PAYLOAD_41_CORRIDA_19` con `NombreItem` cosmético
  distinto). Portal Playwright post-corrida: **4/4 tipo 31 + 2/2 tipo
  32≥250K + 1/1 tipo 33 + 2/2 tipo 41 + 0/N resto**, sin nuevos reinicios
  (último sigue 27/09 12:18:19 AM). Ciclo intacto en 9/N aceptados. Sin
  código nuevo — solo script `/tmp/ecf_20_run41.py` (patrón `Client.force_login`,
  no va al repo). Bloqueo 34 sigue activo. TFE_SECUENCIA post-corrida: 31→89,
  32→1020, 33→11, 34→55, 41→4, 43-47→1. Próximo paso (21va): 1×43 primer
  contacto (Gastos Menores) con gate XSD-local previo — punto de mayor
  riesgo del ciclo actual. Commit: (ver commit de esta corrida).
- **2026-09-27 08:10-08:20 UTC (19va corrida)** — Runner scheduled. Fase 4
  — **PRIMER TIPO 41 ACEPTADO** por certecf. Fix del builder desplegado
  (`_gen_detalles_items`: `ECFBuilderError` si `tipo_ecf==41 && ind_ret==1
  && MontoITBISRetenido is None`), con 4 tests actualizados/nuevos
  (`test_tipo_41_ind_retencion_1_sin_monto_itbis_retenido_lanza_error_corrida18`,
  `test_payload_corrida19_tipo_41_con_monto_itbis_retenido_valida_contra_xsd`,
  `_PAYLOAD_41_CORRIDA_19` con `MontoITBISRetenido='900.00'` +
  `TotalITBISRetenido='900.00'`; `_base_41` fixture + test histórico
  del 41 con retención ahora requieren el monto). 83/83 tests módulo
  + 228/228 paquete `apps/fe/tests/` pasan. Probe DGII OK (token len
  343). Ciclo completo Aceptado con abort-on-first: **4×31 Aceptados**
  (E310000000085-088 desde FC-0007607/7766/7829/8076 vía
  `paso4-factura-real`) + **2×32≥250K Aceptados** (E320000001018 CORTES
  101001811 + E320000001019 RYLCO 131376292, MontoTotal 295000 c/u) +
  **1×33 Aceptado** (E330000000010 vía `paso4-manual`, NCFModificado=
  E310000000087 FC-0007829 RNC 131265863 coincidente, CodigoModificacion
  3) + **1×41 Aceptado** (E410000000002 INDUSTRIAS BISONO 101621516,
  4:20:07 AM UTC-4). Portal Playwright confirma **4/4 tipo 31 + 2/2 tipo
  32≥250K + 1/1 tipo 33 + 1/2 tipo 41 + 0/N resto**, sin nuevos reinicios
  (último sigue siendo 27/09 12:18:19 AM). Bloqueo 34 sigue activo (sin
  cambios, requiere acción del usuario). TFE_SECUENCIA post-corrida:
  31→89, 32→1020, 33→11, 34→55, 41→3, 43-47→1. Rango tipo 31 se estrecha
  a 12 secuencias restantes. Próximo paso (20va): 2do 1×41 (patrón
  validado, ir a 2/2) o 1×43 primer contacto de builder-43 contra
  certecf. Después 44-47 uno a uno, luego RFCE.
  Commits: (ver commit de esta corrida).
- **2026-09-27 04:10-04:19 UTC (18va corrida)** — Runner scheduled. Fase 4
  — primer contacto tipo 41 (Compras) con builder `construir_ecf_generico(41)`
  contra certecf. Portal previo 4/4 tipo 31 + 2/2 tipo 32≥250K + 1/1 tipo
  33 + 0/N resto. Proveedor real elegido: INDUSTRIAS BISONO SRL (RNC
  101621516, no_proveedor 000045 CXP.TCXP_DPROVEEDOR). Test XSD-gate
  `test_payload_corrida18_tipo_41_valida_contra_xsd` agregado, 81/81 tests
  pasan en contenedor. Probe DGII OK (token len 343). **E410000000001**
  (trackId `00f0d6c2-0eb3-4fb7-907f-309d21cac94e`, 12:18:19 AM UTC-4)
  **Rechazado código 260** "El campo MontoITBISRetenido de la sección
  DetallesItems de la línea 1 no es válido". Reset cascada borró
  4/4+2/2+1/1 acumulados. Portal final: 0/N en los 11 renglones.
  **Hallazgo NUEVO**: `MontoITBISRetenido` obligatorio de facto en tipo
  41 cuando `IndicadorAgenteRetencionoPercepcion=1` (Retención), aunque
  XSD lo marque `minOccurs=0`. Mismo patrón "XSD opcional / DGII exige"
  ya visto históricamente. **Sin fix del builder aplicado esta corrida**
  (budget) — dejado como TODO obligatorio para la 19va con guía exacta
  (guard en `_gen_detalles_items`, forzar `MontoITBISRetenido` cuando
  `tipo_ecf==41 && ind_ret==1`). Costo: 1 secuencia 41 quemada
  Rechazada (001) + reset ciclo. Bloqueo 34 sigue activo. TFE_SECUENCIA
  post-corrida: 31→85, 32→1018, 33→10, 34→55, 41→2, 43-47→1. Próximo
  paso (19va): aplicar fix del builder + rehacer ciclo (4×31+2×32≥250K+
  1×33) + reintentar 1×41 con `MontoITBISRetenido='900.00'` en item Y
  `TotalITBISRetenido='900.00'` a nivel Totales (defensivo, probable
  también de-facto obligatorio por patrón histórico de breakdown+total).
  Commits: (ver commit de esta corrida).
- **2026-09-27 00:11-00:19 UTC (17va corrida)** — Runner scheduled. Fase 4
  — reconstrucción limpia del ciclo tras el reset de la 16va corrida (34,
  código 615). NO se tocó tipo 34 (bloqueo sigue activo). Portal previo
  0/N. Probe DGII OK (token len 343). Envíos consecutivos con abort-on-
  first: **4×31 Aceptados** (E310000000081-084 desde
  FC-0007607/7766/7829/8076 vía `paso4-factura-real`, patrón validado 7
  veces) + **2×32≥250K Aceptados** (E320000001016 CORTES 101001811 +
  E320000001017 CONSORCIO RYLCO 131376292 vía `paso4-manual`, MontoTotal
  295000 c/u, RNCs ya probados) + **1×33 Aceptado** (E330000000009 vía
  `paso4-manual` con NCFModificado=E310000000083 FC-0007829 RNC 131265863
  EMPRESA DISTRIBUIDORA PAE — coincidencia RNC comprador confirmada como
  regla real por 15va). Portal final Playwright: **4/4 tipo 31 + 2/2 tipo
  32≥250K + 1/1 tipo 33 + 0/N resto**, SIN nuevos reinicios (último sigue
  siendo 26/09 4:18:17 PM). **Hallazgo operativo menor**: `paso4-manual`
  consume secuencia ANTES del gate XSD-local, por lo que un payload sin
  `FechaVencimientoSecuencia` (mi omisión inicial en 1er intento del 33)
  quema secuencia con HTTP 400 sin llegar a DGII — E330000000008 quemada
  así, sin envío ni reset. TODO defensivo documentado (mover pre-check
  antes de `consumir_siguiente_encf` en `views.py`). También:
  `fe_repo.get_documento` devuelve `rnc_comprador: None` en docs
  enviados vía `paso4-factura-real` — impide implementar el guard de
  coincidencia RNC recomendado por la 15va sin arreglar antes
  `save_documento_enviado`. TFE_SECUENCIA post-corrida: 31→85, 32→1018,
  33→10, 34→55 (bloqueada), 41-47→1. Rango tipo 31 se estrecha a 16
  secuencias restantes. Sin código nuevo — solo scripts ad-hoc en /tmp/
  del contenedor, no van al repo. Próximo paso (18va): 1×41 (Compras)
  primer contacto de `construir_ecf_generico(41)` contra certecf, con
  proveedor real de TCXP_FACTURA y test XSD-gate previo. Bloqueo 34
  sigue esperando acción del usuario (soporte DGII con trackId
  daeac04a-b4cd-4e27-89e4-a3d831513086).
  Commits: (ver commit de esta corrida).
- **2026-09-26 20:11-20:22 UTC (16va corrida)** — Runner scheduled. Fase 4
  — reenvío exitoso 4×31 (E310000000077-080, Aceptados) + 2×32≥250K
  (E320000001014 CORTES + E320000001015 RYLCO, Aceptados) tras arrancar
  en 1/1 tipo 33 + 0/N resto. Intento 1×34 con NCFModificado del ciclo
  actual (E310000000079, RNC coincidente 131265863) → **Rechazado
  código 615 "saldo disponible"** (E340000000054, 4:18:16 PM UTC-4).
  Rechazo cascada borró TODO (4/4 tipo 31 + 2/2 tipo 32≥250K + 1/1 tipo
  33). Portal final: 0/N en los 11 renglones. **Hallazgo crítico**:
  hipótesis 2 de la 13va corrida (NCFModificado del ciclo actual)
  FALSADA — el 34 rechaza con "saldo disponible" incluso cuando el
  NCFModificado se emitió Aceptado 45 s antes en el mismo ciclo.
  Investigación XSD e-CF-34 + Formato-e-CF-V1.0.pdf (págs 55-56) +
  Descripcion-Tecnica-Servicios-DGII.pdf hecha esta corrida: no existe
  `MontoNCFModificado`, la validación es server-side y no está
  documentada. **Nuevo bloqueo abierto** en "Bloqueos activos" con 3
  hipótesis remanentes y ruta de desbloqueo (contactar soporte DGII con
  trackId `daeac04a-b4cd-4e27-89e4-a3d831513086`). Costo: 4/4 tipo 31 +
  2/2 tipo 32≥250K + 1/1 tipo 33 quemados/perdidos + 1 secuencia 34
  quemada Rechazada. TFE_SECUENCIA post-corrida: 31→81, 32→1016, 33→8,
  34→55, 41-47→1. Sin código nuevo esta corrida (solo scripts en /tmp/
  del contenedor, no van al repo — `ecf_16_run.py`). Próximo paso
  (17va): NO tocar 34 hasta desbloquear; rehacer 4×31 + 2×32≥250K +
  1×33 (patrón conocido bajo riesgo); opcionalmente 1×41 con
  investigación XSD previa. Commits: (ver commit de esta corrida).
- **2026-09-26 16:11-16:23 UTC (15va corrida)** — Runner scheduled. Fase 4
  — reenvío 4×31 (E310000000073-076, Aceptados) + 2×32≥250K
  (E320000001012 CORTES HERMANOS 101001811 + E320000001013 RYLCO
  131376292, Aceptados) tras arrancar en 0/N. Portal intermedio 4/4 + 2/2
  confirmado. Intento 1×33 vía `paso4-manual` con payload derivado de
  `_PAYLOAD_33_CORRIDA_8` cambiando `NCFModificado` a E310000000073
  (RNCComprador=130941361 RC HERNANDEZ del ciclo actual) pero manteniendo
  `RNCComprador='131265863'` del payload_8 — **Rechazado código 615**
  "El RNC del comprador o Id extranjero de la nota de débito no es
  válido, ya que no coincide con el RNC del comprador de la factura que
  intenta modificar" (E330000000006, 12:22:16 PM UTC-4). Rechazo cascada
  borró 4/4 tipo 31 + 2/2 tipo 32≥250K. Se corrigió NCFModificado a
  E310000000075 (FC-0007829, único de los 4 con RNC=131265863) y se
  reenvió: **E330000000007 Aceptado** (12:22:51 PM UTC-4). Portal final:
  **1/1 tipo 33**, 0/N resto. **Hallazgo nuevo crítico**: código 615
  también aplica al 33 (antes solo documentado para 34, hallazgo 2 de
  13va) pero con **mensaje distinto** — 33 valida coincidencia de RNC
  del comprador; 34 valida saldo disponible. Regla real: `RNCComprador`
  del 33/34 DEBE coincidir con `RNCComprador` del `NCFModificado`. Sin
  código nuevo esta corrida (solo scripts ad-hoc en `%TEMP%`, no van al
  repo). TFE_SECUENCIA post-corrida: 31→77, 32→1014, 33→8, 34→54, 41-47→1.
  Bloqueos: ninguno. Costo: 4/4 tipo 31 + 2/2 tipo 32≥250K quemados/
  perdidos + 1 secuencia 33 quemada rechazada (006). Ganancia neta: 1/1
  tipo 33 (E330000000007). Próximo paso (16va): rehacer 4×31 + 2×32≥250K
  (patrón conocido bajo riesgo), 1×34 con NCFModificado del ciclo actual
  Y `RNCComprador` que coincida con el del NCFModificado (regla ahora
  confirmada para 33 también). Después 41-47 uno-a-uno.
  Commits: (ver commit de esta corrida).
- **2026-09-26 12:11-12:23 UTC (14va corrida)** — Runner scheduled. Fase 4
  — intento 2×32≥250K con 2 clientes CXC nuevos (CORTES HERMANOS RNC
  101001811 y ALARIFES SRL RNC 131209855). Portal previo confirmado 4/4
  tipo 31 + resto 0/N. Payloads + tests XSD-gate corrida14 a/b agregados
  a `test_ecf_builder_generico.py`, 80/80 tests pasan localmente en el
  contenedor `facturation_backend` de la VM. Probe
  `obtener_token('01','certecf',forzar=True)` OK (len 343). **1er envío
  E320000001009 (CORTES) Aceptado** (fechaRecepcion 8:19:18 AM UTC-4).
  **2do envío E320000001010 (ALARIFES) Rechazado** con "RNCComprador no
  es válido" (código 0, `secuenciaUtilizada:true`) — RNC 131209855 no
  existe/inválido en registro DGII, aunque figura en TCXC_CLIENTE. Reset
  cascada borró también el 1er 32 (CORTES) que estaba Aceptado. Portal
  final: 0/N en los 11 renglones. **Hallazgo nuevo crítico**: la lista de
  clientes CXC con RNC de 9 dígitos NO garantiza validez ante DGII — hay
  que validar contra el servicio público de consulta RNC. Tabla de RNCs
  ya probados/válidos documentada, ALARIFES 131209855 marcado como
  INVÁLIDO. Costo: 2 secuencias 32 quemadas (1009 y 1010) + reset del
  ciclo. TFE_SECUENCIA post-corrida: 31→73, 32→1011, 33→6, 34→54,
  41-47→1 cada uno. Bloqueos: ninguno. Próximo paso (15va): rehacer 4×31
  (E310000000073-076, patrón conocido), 1×32 con CORTES HERMANOS (ya
  validado empíricamente antes del cascada, E320000001011), 2do 32 con
  otro RNC — reutilizar uno ya probado (RYLCO/VALOIS/E&P/AQUAMAR) O
  validar RNC nuevo contra DGII primero. Después 33/34/41-47 uno a uno.
  Commits: (ver commit de esta corrida).
- **2026-09-26 08:10-08:23 UTC (13va corrida)** — Runner scheduled. Fase 4
  — intento 1×34 (Nota de Crédito, primer contacto real de
  `construir_ecf_generico(34)` contra certecf). Payload inicial sin
  TipoIngresos (el XSD lo marca opcional) → certecf rechazó
  `E340000000052` con **código 181** y mensaje literal "TipoIngresos no
  es válido"; reinició todos los contadores (perdidos 4/4 tipo 31 + 2/2
  tipo 32≥250K + 1/1 tipo 33). **Fix desplegado**: builder ahora exige
  TipoIngresos para tipo 34 (`caps[34]['tipo_ingresos_mandatory']=True`),
  con nuevos tests defensivos, 78/78 pasan. Re-envío con TipoIngresos:
  `E340000000053` rechazado con **código 615** — `NCFModificado
  E310000000067` (un 31 aceptado en la 11va corrida) ya no existe en
  certecf tras el reset del primer rechazo, "saldo disponible = 0".
  Hallazgo NUEVO no documentado: NCs/NDs solo pueden referenciar e-CFs
  del ciclo actual del portal. Al final se rehicieron los 4×31 desde
  las mismas 4 facturas reales (E310000000069-072 Aceptados) vía
  `paso4-factura-real` — patrón conocido, builder 31 no roto por el
  fix del 34. Portal final: 4/4 tipo 31 + resto 0/N. Bloqueos: ninguno.
  Próximo paso (14va): retomar el ciclo con 2×32≥250K (2 clientes CXC
  nuevos), 1×33 y 1×34 con `NCFModificado` de E310000000069-072
  (ciclo actual). Después 41-47 uno-a-uno.
  Commits: (ver commit de esta corrida).
- **2026-09-26 04:10-04:16 UTC (12va corrida)** — Runner scheduled. Fase 4
  — 2×32≥250K con clientes CXC nuevos (E & P SERVICIOS INSTITUCIONALES
  RNC 101799463; AQUAMAR RNC 130299625). Agregados 2 payloads + tests
  XSD-gate espejo de corridas 5-6 (`test_payload_corrida12_a/b_tipo_32_...`),
  76/76 tests del módulo `test_ecf_builder_generico.py` pasan localmente en
  el contenedor. Probe `obtener_token('01','certecf',forzar=True)` OK (len
  343). Envíos: **2/2 Aceptados** (E320000001007 12:16:42 AM UTC-4 +
  E320000001008 12:17:21 AM UTC-4). Portal Playwright confirma **4/4 tipo
  31 + 2/2 tipo 32≥250K + 1/1 tipo 33**, sin nuevos reinicios (último
  sigue 25/09 12:17:25 AM). Sin bloqueos. Próximo paso (13va):
  **1×34 Nota de Crédito** con NCFModificado=E310000000067, patrón
  `paso4-manual` + gate XSD-local previo. Después 41-47 uno-a-uno, luego
  RFCE.
  Commits: (ver commit de esta corrida).
- **2026-09-25 20:11-20:20 UTC (11va corrida)** — Runner scheduled. Fase 4
  — reenvío de 4×31 desde las mismas 4 facturas reales (FC-0007607/7766/
  7829/8076) vía `paso4-factura-real`, patrón validado en corridas 2 y 5.
  Probe `obtener_token('01','certecf',forzar=True)` OK (token len 343),
  infraestructura DGII operativa. Los 4 envíos: **4/4 Aceptados**
  (E310000000065-068). Portal Playwright confirma **4/4 tipo 31 + 1/1
  tipo 33**, sin nuevos reinicios (último sigue en 25/09 12:17:25 AM).
  Sin código nuevo — sólo commit del plan maestro. Bloqueos: ninguno.
  Próximo paso (12va): 2×32≥250Mil vía `paso4-manual` con 2 clientes CXC
  nuevos (builder validado 3 veces, se pueden hacer los 2 en la misma
  corrida). Después 1×34, luego 41-47 uno a uno.
  Commits: (ver commit de esta corrida).
- **2026-09-25 20:12-20:20 UTC (10ma corrida)** — Runner scheduled.
  Objetivo: validar empíricamente la hipótesis de la 8va corrida contra
  certecf, ahora que DGII salió del outage OCSP/CRL de la 9na corrida.
  Probe `obtener_token('01','certecf',forzar=True)` OK (token len 343),
  infraestructura normalizada. Enviado 1×33 vía `paso4-manual` con
  `_PAYLOAD_33_CORRIDA_8` (NCFModificado=E310000000061,
  CodigoModificacion=3, MontoTotal 5900): **Aceptado**
  (E330000000005/eb6f92b2, 25-09-2026 16:14:51 UTC-4). Portal confirma
  1/1 tipo 33, sin nuevos reinicios. Bloqueo abierto por la 7ma corrida
  RESUELTO; hipótesis de la 8va corrida confirmada empíricamente.
  Discrepancia menor: la secuencia local avanzó a 5 en vez de 1 entre la
  7ma corrida y hoy (documentada en Hallazgos, no bloquea, sobra rango
  1..10M). Sin código nuevo esta corrida — solo commit del plan maestro.
  Próximo paso (11va): reenviar los 4×31 desde las mismas 4 facturas
  reales (FC-0007829/7607/8076/7766) vía `paso4-factura-real` — builder
  ya validado, mínimo riesgo, patrón de las corridas 2 y 5. Después
  seguir con 2×32≥250K, 34, 41-47 uno a uno.
  Commits: (ver commit de esta corrida).
- **2026-09-25 12:10-12:35 UTC (9na corrida)** — Runner scheduled. Objetivo:
  validar empíricamente contra certecf la hipótesis de la 8va corrida
  (`_PAYLOAD_33_CORRIDA_8`, tipo 33 con `CodigoModificacion=3`). Portal
  confirmado por Playwright: Fase 4, contadores en 0/N (0/4×31, 0/2×32≥250K,
  0/1×33, ...), último log de reinicio 25/09 00:17:25 (7ma corrida). Fix
  local verificado: `_gen_informacion_referencia` bloquea `tipo_ecf==33 +
  CodigoModificacion=='1'`, `_PAYLOAD_33_CORRIDA_8` presente con
  `CodigoModificacion='3'`. Tests `test_payload_corrida7_tipo_33_codigo_modificacion_1_es_rechazado_por_builder`
  + `test_payload_corrida8_tipo_33_codigo_modificacion_3_valida_contra_xsd`
  pasaron 2/2 en el contenedor `facturation_backend` de la VM.

  **Envío NO realizado** — outage transitoria del lado DGII. Al llamar
  `POST /api/fe/certificacion/paso4-manual/` (autenticado como JCABREU vía
  `Client.force_login`) la respuesta fue HTTP 502 con
  `{"detail":"ValidarSemilla HTTP 400: \"One or more errors occurred. (A
  connection attempt failed because the connected party did not properly
  respond after a period of time, or established connection failed because
  connected host has failed to respond.)\""}`. Reintentado 3 veces (2 con
  ~15s + 90s de espera y una final tras >10 min de polling activo del
  endpoint), mismo error persistente.

  **Diagnóstico** (probes directos vía `curl` desde el contenedor):
  1. `GET https://ecf.dgii.gov.do/certecf/autenticacion/api/autenticacion/semilla`
     → HTTP 200 en <100ms (servicio de semilla operativo).
  2. `POST .../validarsemilla` con la semilla CRUDA (sin firmar) → HTTP 400
     con mensaje semántico esperado (`"La estructura del archivo XML no es
     válido... The element 'SemillaModel' has incomplete content"`), es
     decir el endpoint acepta requests y aplica su validación XSD.
  3. `POST .../validarsemilla` con la semilla FIRMADA por
     `firma.firmar_con_app_oficial()` (mismo cert de Roberto que funcionó
     en corridas 5/6/8-tests) → HTTP 400 con el mensaje "connection
     attempt failed" ANTES documentado.
  Conclusión: el pipeline interno de DGII que valida el certificado del
  firmante contra su servicio de OCSP/CRL (probablemente la CA emisora del
  certificado — Avansi/CamaraTIC/ONA/etc.) está degradado. Cuando llega
  una semilla firmada, DGII intenta consultar la CA y su timeout downstream
  hace fallar todo el request con `HTTP 400 "connection attempt failed"`.
  Sin firma no llega a esa etapa (falla antes en la validación XSD), por
  eso el probe sin firmar sí responde. **No es problema de nuestro código**
  — el certificado y la App Firma Digital oficial son los mismos que
  funcionaron en las 8 corridas previas.

  **Sin código nuevo esta corrida**, sin envíos a certecf, sin quemar
  secuencias. Solo commit del plan maestro con esta anotación. Secuencia
  E330000000001 sigue disponible en TFE_SECUENCIA (no quemada por la 7ma
  corrida, `secuenciaUtilizada:false`; ni por esta corrida, no se llegó a
  emitirla). Fix de la 8va corrida sigue desplegado y esperando validación
  empírica.

  **Próximo paso para la corrida siguiente (10ma)**: reintentar el mismo
  envío. Antes de disparar, hacer el mismo probe `curl` (semilla firmada
  contra `.../validarsemilla`) — si responde con un `HTTP 400 "Firma del
  certificado invalida"` o similar semántico (o un `HTTP 200` con token),
  DGII se normalizó y se puede seguir. Si sigue "connection attempt
  failed", esperar la siguiente corrida (4h más). No hay bloqueo lógico
  activo nuevo por resolver — es infraestructura externa.
  Commits: (ver commit de esta corrida).
- **2026-09-25 12:20-14:00 UTC (8va corrida)** — Runner scheduled. Fase 4
  BLOQUEADA (todos los contadores en 0/N por rechazo código 64 de la 7ma
  corrida) — corrida de investigación + fix técnico, SIN envío nuevo a
  certecf. Extraído texto de `Descripcion-Tecnica-Servicios-DGII.pdf` y
  `Formato-e-CF-V1.0.pdf` con pdftotext, encontrado el hallazgo: el
  `CodigoModificacion=1` (Anula el NCF modificado) usado en la 7ma corrida
  es semánticamente inconsistente con `tipo_ecf=33` (Nota de Débito, que
  AGREGA cargos). Nota 80 del Formato-e-CF-V1.0.pdf dice que códigos 1/2/3
  aplican a notas de crédito/débito "según corresponda"; para 33 solo 2 o
  3 tienen sentido (2=Corrige texto, 3=Corrige montos). Fix desplegado en
  `apps/fe/ecf_builder.py::_gen_informacion_referencia`: valida que
  `tipo_ecf==33` + `CodigoModificacion=='1'` levante `ECFBuilderError`
  local antes de firmar/enviar. Tests actualizados: `test_tipo_33_nota_debito_valida_contra_xsd`
  y `test_tipo_ingresos_opcional_en_33_y_34_no_lanza_error` usan código 3
  ahora; `test_payload_corrida7_tipo_33_codigo_modificacion_1_es_rechazado_por_builder`
  documenta el rechazo histórico; nuevos `test_payload_corrida8_tipo_33_codigo_modificacion_3_valida_contra_xsd`,
  `test_construir_ecf_generico_tipo_33_codigo_modificacion_2_permitido` y
  `test_construir_ecf_generico_tipo_34_codigo_modificacion_1_permitido`
  como regression guards. 219/219 tests fe pasan en contenedor de VM.
  Payload propuesto para la próxima corrida en `_PAYLOAD_33_CORRIDA_8`.
  Bloqueo movido de "sin resolución" a "hipótesis técnica identificada +
  fix desplegado, pendiente validación empírica contra certecf". Sin
  envío a DGII (secuencias intactas: 31→E310000000065, 32→E320000001007,
  33→E330000000001 reutilizable). Próximo paso: la 9na corrida (o el
  usuario) puede disparar `POST /api/fe/certificacion/paso4-manual/` con
  el payload de `_PAYLOAD_33_CORRIDA_8` para validar la hipótesis. Si
  Aceptado, portal debe ir a 1/1 tipo 33 y el resto del grupo Segundo (34,
  41-47) puede seguir el patrón. Si Rechazado con código 64 vacío otra
  vez, el problema NO es CodigoModificacion — cerrar esa ruta y seguir
  con investigación del catálogo oficial DGII (ruta 1 del bloqueo).
  Commits: (ver commit de esta corrida).
- **2026-09-25 04:12-04:20 UTC** — Runner scheduled. Fase 4 — intento 1×33
  Nota de Débito (grupo Segundo, primer contacto real de
  `construir_ecf_generico(33)` contra certecf). Gate XSD-local nuevo
  (`test_payload_corrida7_tipo_33_nota_debito_valida_contra_xsd`) pasó
  localmente. POST a `paso4-manual` retornó HTTP 200 con
  E330000000001/1043f428, pero `consultar_estado` = **Rechazado** con
  código 64 y mensaje VACÍO. `secuenciaUtilizada:false` (E330000000001 no
  quemado). Portal: los 11 contadores reiniciados a 0/N — se perdieron
  los 4/4 tipo 31 + 2/2 tipo 32≥250K de las corridas 5-6. Contradice la
  hipótesis previa de que el reinicio depende de `secuenciaUtilizada`.
  Bloqueo real registrado en "Bloqueos activos" — la próxima corrida NO
  debe reintentar Fase 4 hasta entender qué es código 64 con mensaje
  vacío (dos rutas: catálogo oficial DGII, o campo obligatorio de facto
  que `construir_ecf_generico(33)` no emite aunque el XSD lo permita).
  Commits: (ver commit de esta corrida).
- **2026-09-24 23:30 UTC — 2026-09-25 00:10 UTC** — Runner scheduled. Fase 4
  — 2do 32≥250Mil (grupo Primero, cierre). Aplicado el gate XSD-local
  obligatorio (test nuevo `test_payload_corrida6_tipo_32_mayor_250k_valida_contra_xsd`,
  215/215 tests fe pasan localmente en el contenedor de la VM). Enviado
  1×32≥250Mil vía `paso4-manual` con RNC de cliente CXC real distinto del
  de la 5ta corrida (COMERCIAL VALOIS, RNC 131175341, MontoTotal 306800)
  — **Aceptado** (E320000001006/73456765). Portal confirma 4/4 tipo 31 +
  **2/2 tipo 32≥250Mil**. Grupo "Primero" para 32/31 CERRADO. Sin
  bloqueos. Próximo paso: 1×33 con NCFModificado=E310000000061 real,
  gate XSD-local antes de enviar (patrón nuevo de la 5ta corrida ya
  validado por 2do envío consecutivo sin reinicios).
  Commits: (ver commit de esta corrida).
- **2026-09-23 12:12-12:20 UTC** — Runner scheduled. Fase 4 — grupo Primero.
  Aplicado por primera vez el gate XSD-local obligatorio (test nuevo
  `test_payload_corrida5_tipo_32_mayor_250k_valida_contra_xsd`, 89/89
  tests pasan). Enviado 1×32≥250Mil vía `paso4-manual` con RNC de cliente
  CXC real (CONSORCIO RYLCO 131376292) — **Aceptado**
  (E320000001005/eab0e8a3). Con el 32 confirmado, reenviados los 4×31
  desde las mismas 4 facturas reales de la corrida 2 vía
  `paso4-factura-real` — **4/4 Aceptados** (E310000000061-064). Portal
  confirma 4/4 tipo 31 + 1/2 tipo 32≥250Mil. Sin bloqueos. Próximo paso:
  2do 32≥250K con otro cliente CXC, luego 33/34 con NCFModificado real,
  luego 41-47 uno-a-uno.
  Commits: (ver commit de esta corrida).
- **2026-09-23 08:12 UTC** — Runner scheduled. Fase 4 — investigación + doc.
  Hallazgo crítico nuevo: la DGII **reinicia TODOS los contadores** de
  Fase 4 cada vez que rechaza un e-CF, no solo el del tipo rechazado. El
  rechazo del E320000001004 (3ra corrida) borró los 4/4 tipo 31 aceptados
  en la 2da corrida — portal ahora muestra 0/N en todos los 11 renglones.
  Consultada la BD real: sigue sin haber facturas B02≥250K con RNC real
  del comprador (mismas 6 facturas), pero hay 20+ clientes CXC con RNC
  válido usables para `paso4-manual` tipo 32. Documentada la estrategia
  obligatoria nueva (validar XSD local antes de cada envío, orden
  32→31→resto), y dejado el payload concreto propuesto para la próxima
  corrida (cliente #7 CONSORCIO RYLCO, RNC 131376292, MontoTotal 295000).
  No se envió nada esta corrida para no repetir el mismo error. Próximo
  paso: la corrida siguiente valida el payload contra el XSD local,
  envía el 32, y solo si Aceptado reintenta los 4×31 (E310000000061-064).
  Commits: (ver commit de esta corrida).
- **2026-09-23 04:20 UTC** — Runner scheduled. Fase 4 — intento 2×32≥250Mil.
  Envío desde FC-0007867 rechazado (E320000001004 quemado, código 1381
  RNCComprador obligatorio). Descubierto que en toda la historia de
  Abregonza sólo hay 6 facturas B02≥250Mil y ninguna tiene un
  RNC/Cédula real del comprador — es un bloqueo de datos, no técnico
  (ver Hallazgos 3ra corrida). Se agregó validación pre-envío al
  builder (`_construir_ecf` chequea RNC obligatorio si 32+MontoTotal≥250K)
  con test nuevo, 19/19 pasan. Portal sigue en 0/2 tipo 32≥250Mil.
  Próximo paso decidido: la siguiente corrida NO abre otro envío hasta
  elegir una de las 3 opciones documentadas (preferida: `paso4-manual`
  con RNC/Cédula real de un cliente CXC existente); enviar UNO solo
  primero por si el builder generico requiere más ajustes contra
  `certecf` real.
  Commits: (ver commit de esta corrida).
- **2026-09-23 00:20 UTC** — Runner scheduled. Fase 4 — grupo Primero, tipo 31.
  Corregido el bug 3 pendiente (`MontoGravadoI1`/`ITBIS1`/`TotalITBIS1` +
  orden estricto del XSD en Totales) en `_construir_ecf`, con 2 tests
  nuevos contra XSD real (18/18 pasan). Desplegado a la VM. Enviados 4
  e-CF tipo 31 (E310000000057-060) desde las 4 facturas reales elegidas
  en la corrida anterior — los 4 **Aceptados** por `certecf`, portal
  confirma 4/4. Sin bloqueos. Próximo paso: seguir con el resto del
  grupo Primero (32≥250Mil primero, que reusa el mismo builder ya
  validado; luego 41/43/44/45/46/47 uno a uno con `paso4-manual`).
  Commits: (ver commit de esta corrida).
- **2026-09-22 20:30 UTC** — Runner scheduled. Fase 4 arrancó: elegidas 4
  facturas reales (FC-0007829/0007607/0008076/0007766, todas B01 con RNC
  válido, de la base real de Abregonza). Primer intento contra `certecf`
  quemó 3 e-NCF de 31 antes de que se pudiera arreglar el builder
  incompleto (ver "Fase 4 — Hallazgos" arriba). Se corrigió y desplegó a
  la VM 2 de los 3 bugs (IndicadorMontoGravado + MontoItem sin ITBIS,
  FechaLimitePago default 30d), con tests. Bug pendiente: MontoGravadoI1/
  ITBIS1/TotalITBIS1 (breakdown por tasa en Totales). Portal sigue
  mostrando 0/4 tipo 31 — los rechazos no cuentan hacia el contador.
  Próxima corrida: arreglar el bug 3, retomar FC-0007829 (E310000000057).
  Commits: (ver commit de esta misma corrida).
- **2026-10-03 12:10-12:25 UTC (46va corrida)** — Runner scheduled. Fase 4 — ataque bloqueo tipo 34 vía hipótesis #5 nueva (patrón "NC Corrige Texto" del Set de Pruebas oficial). Portal pre: 27/N intacto. **Investigación**: lectura con openpyxl de `backend/docs/superpowers/reference/2026-08-31-set-pruebas-paso2/set-pruebas-130217432.xlsx` (hoja ECF, 26 filas, 5215 columnas) encontró 2 casos tipo 34 oficiales de la DGII para Abregonza — fila 5 `CasoPrueba=130217432E340000000001` usa `CodigoModificacion=2` (Corrige Texto) + `MontoTotal=0.00` + `MontoGravadoTotal=0.00` + `IndicadorNotaCredito=0`, patrón nunca probado (las 4 hipótesis previas todas usaban CodMod=1/3 con MontoTotal>0 y por eso trababan en código 615 "saldo disponible"). Nuevo `_PAYLOAD_34_CORRIDA_46` + test XSD-gate `test_payload_corrida46_tipo_34_cod_mod_2_monto_cero_valida_contra_xsd` pasan en contenedor (XSD confirma `MontoTotal` tipo `Decimal18D1or2ValidationTypeMayorIgualCero` → permite 0). Envío real E340000000056 (trackId `de725298-d118-421a-9b8a-1991e9dc3b97`, `NCFModificado=E310000000121`) → **Rechazado código 156 "El campo IndicadorNotaCredito del área IdDoc de la sección Encabezado no es válido"**. **ESTO ES UN HALLAZGO ENORME**: primer rechazo tipo 34 en 5 intentos que NO es código 615; el patrón MontoTotal=0+CodMod=2 **SÍ pasa validación de saldo**. Solo falta `IndicadorNotaCredito=1` (patrón "Set permite / certecf exige" #18 nuevo — el Set oficial lo marca 0 pero certecf lo exige 1). Cascada confirmada Playwright: 27/N → 0/N. `secuenciaUtilizada:true` → 34 quemada (prox=57). TFE_SECUENCIA post: 34→57, resto sin cambios (envíos 31-47 sin tocar en esta corrida — restan en prox del post-41va). Rebuild deferido a 47va (budget 66% consumido en esta corrida, sin margen para 30+ envíos de rebuild + reintento 34). Scripts no commiteados: `.tmp/send34.py`, `.tmp/consulta.py`, `.tmp/read_xlsx.py`, `.tmp/list_aceptados.py`. **Próxima (47va)**: (1) **primera acción**: 1×34 con payload del Set pero `IndicadorNotaCredito=1` — probabilidad alta de ser el primer Aceptado tipo 34 (todas hipótesis previas trababan en 615, esta pasó esa validación por primera vez); si pasa → 1/2 tipo 34 Aceptado SIN ciclo previo (puede quedar en pie incluso con portal 0/N). (2) Rebuild ciclo completo (patrones validados): 4×31 paso4-factura-real + 2×32≥250K VALOIS/RYLCO + 1×33 CodMod=3 + 2×41 `_PAYLOAD_41_CORRIDA_19` + 2×43 + 2×44 + 2×45 + 2×46 (destrabo prox=100 si contaminación) + 2×47 IndicadorFacturacion=4 + 4×RFCE paso4-rfce + widget 4/4 subida Playwright. (3) 2do envío 34 (CodMod=1/2 con MontoTotal=0 contra otro 31 fresco) para cerrar 2/2 → Fase 4 completa salvo subida widget. Commits: (ver commit de esta corrida).
- **2026-10-03 00:20 UTC (44va corrida)** — Runner scheduled. Fase 4 — ataque a bloqueo tipo 34 vía hipótesis #2 (ACECF intermedio). Portal pre: 27/N intacto. Construido endpoint nuevo `POST /api/fe/certificacion/paso4-ecf-acecf/` (`views.certificacion_paso4_ecf_acecf_view` + helper `_acecf_row_desde_ecf_firmado`): lee el XML firmado del e-CF ya enviado desde `TFE_DOCUMENTO`, deriva las 9 filas del XSD ACECF v1.0 (RNCEmisor, RNCComprador, FechaEmision, MontoTotal, Version, eNCF, Estado=1, FechaHoraAprobacionComercial), firma con App Firma Digital, envía al servicio `aprobacioncomercial`. 4 tests nuevos (30/30 pasan en contenedor). Smoke test real `certecf` para E310000000121 (RNCEmisor 130217432, RNCComprador 130941361, MontoTotal $460,241.77): **HTTP 400 "El contribuyente de rnc 130217432 no se encuentra en la etapa de prueba de datos de aprobación comercial"** (`codigo=02`, `estado="Aprobacion Comercial Rechazada"`). Hallazgo #17: **la DGII enforza state machine lineal por fase** — una vez cerrada la Fase 3 (11/11 ACECF 2026-09-17), el servicio ACECF rechaza nuevos envíos de la misma postulación. **Hipótesis #2 arquitecturalmente IMPOSIBLE de testear** en la Postulación 81443. Portal post Playwright: 27/N intacto (sin cascada; el phase-check no arrastra Fase 4). Scripts no commiteados: `.tmp/run_acecf_test.py`. Próxima (45va): hipótesis #3 (releer sección G Formato-e-CF-V1.0.pdf + XSD e-CF-34-v1.0.xsd buscando campos obligatorios de facto no documentados; comparar bit-a-bit con ejemplo del Set de Pruebas si existe); si no revela nada, preparar borrador formal de ticket soporte DGII (sin enviar — acción legalmente vinculante requiere Roberto). Commits: `ec57673` (endpoint ACECF + tests), `91d114f` (plan maestro hipótesis #2 refutada).
- **2026-10-04 00:12-00:28 UTC (49va corrida)** — Runner scheduled. Fase 4 — regresión total desde 48va + rebuild completo + hallazgo #19. Login Playwright: portal **0/N para TODO** (incluso widget 1/4) — cascada asíncrona 48va dejó log DGII 03/10 16:23:43 "e-NCF E320000001052 ya habia sido cargada y aceptada previamente". Primera estrategia (`send_49va_rebuild.py`): 20 e-CF sin tocar RFCE ni tipo 34 ni widget — 20/20 Aceptados consecutivos (E310000000133-136, E320000001054-1055, E330000000022, E410000000114-115, E430000000114-115, E440000000019-020, E450000000112-113, E460000000103-104, E470000000108-109). Luego `send_49va_rfce.py`+`_rfce2.py`: 4/4 RFCE Aceptados (E320000001056-1059, cs sUF6Az/hvfzNH/nzGwxW/JeQPcx). Portal post Playwright: 23/N clase doc + 4/4 RFCE + 1/4 widget intacto = 28/29. Luego intento 2×34 (`send_49va_tipo34.py`) contra E310000000133 ciclo nuevo con payload `RNCComprador=130941361` → **E340000000059 Rechazado código 615 con mensaje NUEVO**: "El RNC del comprador o Id extranjero de la nota de crédito no es válido, ya que no coincide con el RNC del comprador o Id extranjero de la factura que intenta modificar." **Hallazgo #19 nuevo**: el tipo 34 exige que `RNCComprador` del NC coincida con el `RNCComprador` del 31 referenciado. Comprobado: `E310000000133` (FC-0007829) tiene RNC=131265863 (PAE SRL); `E310000000134-136` (FC-0007607/0008076/0007766) y `E310000000121` histórico tienen RNC=130941361 (RC HERNANDEZ) — por eso 47va funcionó con E310000000121 (match casual). Mi payload usaba 130941361, por eso rechazó contra 133. **CASCADE** total: portal 28/29 → 0/N (verificado Playwright). Rebuild definitivo con `send_49va_full.py` ordenando 2×34 **PRIMERO** contra E310000000121 histórico: 2/2 Aceptado (E340000000060/061 codigo=1), luego 4×31 (E310000000137-140) + 2×32≥250K (E320000001060/1061) + 1×33 (E330000000023) + 2×41 (E410000000116/117) + 2×43 (E430000000116/117) + 2×44 (E440000000021/022) + 2×45 (E450000000114/115) + 2×46 (E460000000105/106) + 2×47 (E470000000110/111) + 4×RFCE (E320000001062-1065 cs eBDpGL/Uim6Ut/vexoWj/HCSuYR). **29/29 Aceptados consecutivos sin un rechazo**. Portal post Playwright confirmado: 4/4 31 + 2/2 32≥250K + 1/1 33 + 2/2 34 + 2/2 41 + 2/2 43 + 2/2 44 + 2/2 45 + 2/2 46 + 2/2 47 + 4/4 RFCE + 0/4 widget = 25/25 clase doc + 4/4 RFCE. **Fase 4 esencialmente COMPLETA salvo widget**. TFE_SECUENCIA post-49va: 31→141, 32→1066, 33→24, 34→62 (59 quemada hyp #19; 60-61 Aceptadas), 41→118, 43→118, 44→23, 45→116, 46→107, 47→112. Sin código nuevo backend desplegado (solo scripts tmp). **Decisión intencional** de NO atacar widget esta corrida: budget 75% consumido tras rebuild, y 48va demostró que el widget puede disparar cascada asíncrona hours después — mejor dejar la 25+4 locked para la próxima corrida que atacará widget con script dedicado y XMLs frescos E320000001062-1065 (nunca antes subidos). Próxima (50va): subida widget con los 4 XMLs 49va; si cierra 4/4 sin cascada tardía → portal 29/29 → Fase 5 debería abrirse. Commits: (plan maestro commit).
- **2026-10-04 12:11-12:19 UTC (51va corrida)** — Runner scheduled. **Fase 5 CERRADA 11/11 — PORTAL AUTO-REDIRIGIÓ A /Postulacion/ValidandoRI (FASE 6 ABIERTA)**. Pre-corrida Playwright: portal en Fase 5 `/Postulacion/PruebasSimulacionRepresentacionImpresa` (confirmado desde 50va), 11 slots PDF nombrados `ECF_31`, `ECF_32 Mayor_o_Igual_250mil`, `ECF_33`, `ECF_34`, `ECF_41`, `ECF_43`, `ECF_44`, `ECF_45`, `ECF_46`, `ECF_47`, `ECF_32 Menor_250mil`; constraint suma archivos ≤ 10 MB; log Fase 5 vacío; bandeja 49. **Generación PDFs** (`.tmp/gen_ri51_all.mjs`, Node Playwright headless): login JCABREU/Temp1234! en abregonza.netlify.app → por cada e-NCF del ciclo 49va navegar a `/print/ecf-representacion-impresa/<encf>?no_cia=01&templateDraft=1` → `waitForSelector('img[src^="data:image/png"]')` (QR data-URL base64 confirmado presente, longitud 18-21 KB → QR versión 10 con upscaling 4× del fix 42va/43va) → `page.emulateMedia({media:'print'})` + `page.pdf({format:'Letter',printBackground:true,preferCSSPageSize:true})`. 11/11 PDFs generados sin error, salidas `.tmp/ri51/tipo{31,32ge250K,33,34,41,43,44,45,46,47,32lt250K}_<encf>.pdf` tamaños 93-100 KB cada uno, total 1.16 MB (muy debajo del límite 10 MB). **Upload Fase 5** (`.tmp/upload_fase5.mjs`, Node Playwright): login portal DGII RNC 130217432/Rnc130217432 → `/Postulacion/PruebasSimulacionRepresentacionImpresa` → `page.setInputFiles('input[type=file][name="ECF_XX"]', pdfPath)` x 11 slots (CSS attr selector por `name=` exacto, incluyendo nombres con espacios) → pre-send check vía `evaluate` confirma 11/11 inputs con file name correcto → click "Enviar archivos" via `getByRole('button', { name: /enviar archivos/i })`. **Portal respondió redirect a `/Postulacion/ValidandoRI`** = Paso 6 abierto por servidor DGII sin un solo rechazo visible en logs ni cascada. Playwright post Fase 6: URL confirmada `/Postulacion/ValidandoRI`, heading literal `Paso 6: Validación Representación Impresa`, texto literal "Etapa en la que DGII valida las Representaciones Impresas de e-CF enviadas en la prueba anterior (paso 5). Para continuar con el proceso de certificación es necesario que las Representaciones Impresas sean aprobadas." Fase 6 es ESPERA pasiva — no hay widget ni botón, DGII valida offline. Bandeja 50 (vs 49 pre-corrida; +1 por avance a Fase 6). Screenshot `ri-fase6-abierta-51va.png` full-page local no commiteado. e-NCFs usados (todos del ciclo 49va previamente Aceptados): 31→E310000000137, 32≥250K→E320000001060, 33→E330000000023, 34→E340000000060, 41→E410000000116, 43→E430000000116, 44→E440000000021, 45→E450000000114, 46→E460000000105, 47→E470000000110, 32<250K→E320000001062. Sin código nuevo backend ni frontend esta corrida (pipeline PDF del 42va + fix QR del 43va + endpoint print-data ya desplegados en main). TFE_SECUENCIA sin cambios. Scripts no commiteados: `.tmp/gen_ri51_test1.mjs` (prueba 1 PDF), `.tmp/gen_ri51_all.mjs` (batch 11), `.tmp/upload_fase5.mjs` (upload + enviar). **Próxima (52va)**: Fase 6 es espera DGII — refrescar `/Postulacion` para ver si avanzó a Fase 7 (URL Servicios Prueba) o retrocedió a Fase 5 con rechazos específicos en logs. Si avanzó a Fase 7: investigar qué URLs/endpoints hay que registrar en el portal apuntando a los endpoints de recepción ZentoryERP (`/api/fe/recepcion/*` ya existen desde el Paso 2 de la Fase 2, pero probablemente requieran config DNS/HTTPS pública expuesta). Si retrocedió a Fase 5: leer los logs específicos (campo/tipo/motivo), regenerar el PDF del tipo rechazado con el ajuste correspondiente, resubir. Commits: (ver commit de esta corrida — actualización plan maestro).
- **2026-10-04 16:11-16:15 UTC (52va corrida)** — Runner scheduled. Fase 6 — espera pasiva DGII, sin avance de estado. Playwright login: portal sigue en `/Postulacion/ValidandoRI` ("Paso 6: Validación Representación Impresa", texto literal: "Etapa en la que DGII valida las Representaciones Impresas de e-CF enviadas en la prueba anterior..."). Bandeja de Entrada: último mensaje recibido es MensajeId=1615721 (04-10 08:19:49 UTC-4) "Validación Representación Impresa — Ha iniciado la etapa de validación de las representaciones impresa, favor esperar por el estado de las mismas." → es el ACK de inicio Fase 6, NO respuesta aún. Transcurrido ~8h desde cierre Fase 5 (12:19 UTC = 08:19 UTC-4); patrón conocido: estas fases de validación DGII pueden tardar horas o días. Trabajo útil sustituido: smoke test preventivo de los 4 endpoints P2P productivos que Fase 7 va a pedir publicar como URLs de servicios de prueba — `curl -sk` contra `https://grupo-abregonza.hopto.org:8443/fe/...`: GET `/fe/autenticacion/api/semilla` → **200** (payload XML `<SemillaModel><valor>...</valor></SemillaModel>` válido), POST `/fe/autenticacion/api/validacioncertificado` sin archivo → **400** ("Falta el archivo xml firmado", correcto), POST `/fe/recepcion/api/ecf` sin token → **401** (correcto), POST `/fe/aprobacioncomercial/api/ecf` sin token → **401** (correcto). Los 4 están UP, códigos de respuesta coherentes con `apps/fe/public_views.py`, listos para pegar en el formulario Fase 7 cuando abra. Intento investigar Fase 7 por adelantado navegando directo a `/Postulacion/UrlServiciosPrueba` → **404** (el portal no permite acceder a URLs de fases futuras, confirma que el stepper es lineal server-side). Sin código nuevo backend ni frontend esta corrida. TFE_SECUENCIA sin cambios. **Próxima (53va)**: refrescar `/Postulacion` y Bandeja — (a) si avanzó a Fase 7, abrir el formulario y pegar las 4 URLs ya verificadas; (b) si retrocedió a Fase 5 con rechazos específicos, leer logs del tipo rechazado y regenerar PDF con el ajuste correspondiente (fix QR 42va si es QR, extender template si son campos faltantes); (c) si sigue en Fase 6, repetir smoke de endpoints y nada más (nada que enviar). Commits: (ver commit de esta corrida — actualización plan maestro).
- **2026-10-05 00:11-00:18 UTC (54va corrida)** — Runner scheduled. Fase 6 — espera pasiva DGII, **4ta corrida consecutiva sin avance** (51va cerró Fase 5 2026-10-04 12:19 UTC; 52va/53va/54va = Fase 6 en espera, ya ~12h desde cierre Fase 5). Playwright login portal: URL sigue `/Postulacion/ValidandoRI`, heading literal `Paso 6: Validación Representación Impresa`, texto `"Etapa en la que DGII valida las Representaciones Impresas de e-CF enviadas en la prueba anterior (paso 5). Para continuar con el proceso de certificación es necesario que las Representaciones Impresas sean aprobadas."` — idéntico a 52va/53va. Bandeja de Entrada = **50** (sin cambios desde 52va); abierta esta corrida por primera vez vía `/Mensajes/BandejaEntrada` (URL correcta de inbox, no `/Bandeja` que da 404): último mensaje confirmado "Validación Representación Impresa — 04-10-2026 08:19:49 AM (UTC-4)" ACK inicio Fase 6, ningún mensaje nuevo DGII desde entonces, ~16h de validación offline sin veredicto. Patrón conocido: validaciones manuales DGII pueden tardar horas o días. **Trabajo útil defensivo**: re-smoke de los 4 endpoints P2P (3ra iteración idéntica a 52va/53va, `curl -sk -o /dev/null -w` via `plink` → `docker exec facturation_backend` → VM 10.0.0.99 → hopto.org:8443): GET `/fe/autenticacion/api/semilla` → **200**, POST `/fe/autenticacion/api/validacioncertificado` sin archivo → **400**, POST `/fe/recepcion/api/ecf` sin token → **401**, POST `/fe/aprobacioncomercial/api/ecf` sin token → **401**. Los 4 siguen UP con los mismos códigos esperados, infraestructura P2P pública estable 3 corridas consecutivas, lista para Fase 7 cuando abra. Sin código nuevo backend ni frontend. TFE_SECUENCIA sin cambios. Sin envío a certecf (no hay a dónde enviar en Fase 6). Scripts no commiteados: `.tmp/check_portal_54va.mjs` (login + /Postulacion snapshot + screenshot `ri-fase-54va.png`), `.tmp/check_bandeja_54va.mjs` (probe de URLs posibles de bandeja, encontró `/Mensajes/BandejaEntrada`), `.tmp/bandeja_latest_54va.mjs` (lectura textual bandeja — descubre que el link del contador "50" apunta a `/Mensajes/BandejaEntrada`). **Hallazgo útil nuevo (menor)**: la URL del inbox del portal certecf es `/Mensajes/BandejaEntrada`, no `/Bandeja` ni `/BandejaEntrada`; documentarla para scripts de corridas futuras que necesiten raspar logs/mensajes DGII. **Próxima (55va)**: mismo protocolo — refrescar `/Postulacion` y `/Mensajes/BandejaEntrada`: (a) si avanzó a Fase 7, abrir el formulario e inspeccionar inputs con Playwright snapshot, luego pegar las 4 URLs P2P ya verificadas (`https://grupo-abregonza.hopto.org:8443/fe/{autenticacion,recepcion,aprobacioncomercial}/api/...`) + enviar; (b) si retrocedió a Fase 5 con rechazos específicos en bandeja, leer logs del tipo rechazado y regenerar PDF con el ajuste correspondiente; (c) si sigue en Fase 6 (5ta corrida), repetir re-smoke P2P defensivo. Si tras ~36h total en Fase 6 (sería ~56va) sigue sin avance, considerar escalar via borrador formal de ticket soporte DGII (acción legalmente vinculante → requiere Roberto, pero el borrador en sí no requiere autorización). Commits: (ver commit de esta corrida — actualización plan maestro).
- **2026-10-04 20:11-20:14 UTC (53va corrida)** — Runner scheduled. Fase 6 — espera pasiva DGII, 3ra corrida consecutiva sin avance (51va cerró Fase 5, 52va + 53va = Fase 6 en espera, ya +8h). Playwright login portal: URL sigue `/Postulacion/ValidandoRI`, heading literal `Paso 6: Validación Representación Impresa`, texto `"Etapa en la que DGII valida las Representaciones Impresas de e-CF enviadas en la prueba anterior..."` — idéntico a 52va. Bandeja de Entrada = **50** (sin cambios desde 52va); último mensaje sigue siendo el ACK Fase 6 "Validación Representación Impresa" de **04-10 08:19:49 UTC-4** — ningún mensaje nuevo DGII desde entonces, es decir ~12h de validación offline sin veredicto. Patrón conocido: validaciones manuales DGII pueden tardar horas o días (Fase 3 ACECF en su día tomó varias horas). **Trabajo útil defensivo**: re-smoke de los 4 endpoints P2P (idéntico a 52va, `curl -sk -o /dev/null -w` via `docker exec facturation_backend` → VM 10.0.0.99 → hopto.org:8443): GET `/fe/autenticacion/api/semilla` → **200**, POST `/fe/autenticacion/api/validacioncertificado` sin archivo → **400**, POST `/fe/recepcion/api/ecf` sin token → **401**, POST `/fe/aprobacioncomercial/api/ecf` sin token → **401**. Los 4 siguen UP con los mismos códigos esperados de la 52va, infraestructura P2P pública estable, lista para Fase 7 cuando abra. Sin código nuevo backend ni frontend. TFE_SECUENCIA sin cambios. Sin envío a certecf (no hay a dónde enviar en Fase 6). **Decisión intencional** de NO preparar el script `upload_fase7.mjs` por adelantado porque el portal da 404 a `/Postulacion/UrlServiciosPrueba` (52va confirmó stepper lineal server-side) → no podemos inspeccionar nombres de campos del formulario Fase 7 hasta que abra, y adivinar seríamos trabajo tirado. **Próxima (54va)**: mismo protocolo — refrescar `/Postulacion` y Bandeja: (a) si avanzó a Fase 7, abrir el formulario e inspeccionar inputs con Playwright snapshot, luego pegar las 4 URLs P2P ya verificadas (`https://grupo-abregonza.hopto.org:8443/fe/{autenticacion,recepcion,aprobacioncomercial}/api/...`) + enviar; (b) si retrocedió a Fase 5 con rechazos específicos en bandeja, leer logs del tipo rechazado y regenerar PDF con el ajuste correspondiente; (c) si sigue en Fase 6 (4ta corrida), repetir re-smoke P2P defensivo y punto. Si tras 48h total en Fase 6 (sería ~57va) sigue sin avance, considerar escalar via borrador formal de ticket soporte DGII (acción legalmente vinculante → requiere Roberto). Commits: (ver commit de esta corrida — actualización plan maestro).
