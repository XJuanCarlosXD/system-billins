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
| 4 | Pruebas Simulación e-CF | 🔲 En ejecución — 4/4 tipo 31 ✅, 0/2 tipo 32≥250Mil (bloqueado por falta de facturas B02 reales con RNC de comprador, ver Hallazgos 3ra corrida) | 2026-09-23 |
| 5 | Pruebas Simulación Representación Impresa | 🔲 Investigado parcialmente (falta formato QR) | 2026-09-17 |
| 6 | Validación Representación Impresa | ⬜ Sin investigar | — |
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

## Bloqueos activos (HOLD — requieren decisión humana, el runner NO debe

reintentar solo)

_Ninguno al 2026-09-22._ El runner agrega aquí cualquier bloqueo nuevo, con
fecha, descripción exacta y qué decisión falta — y NO vuelve a intentar esa
fase hasta que esta sección diga explícitamente que se resolvió.

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
3. Si hay algo en "Bloqueos activos": **no tocar esa fase**, revisar si el
   bloqueo ya se resolvió (p.ej. el usuario dejó una nota, o pasó tiempo
   suficiente para reintentar un paso con retraso de reconciliación
   conocido) — si no, saltar a la fase completa siguiente o parar la
   corrida documentando que sigue bloqueado.
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

## Cuándo detenerse y NO seguir solo (equivalente a HOLD)

**Distinción clave**: "nos falta construirlo" NO es un bloqueo (ver regla
explícita arriba, en el paso 5 del protocolo) — se construye. Un bloqueo
real es cuando ni construyendo se puede seguir porque falta un dato/
decisión que solo la DGII o el usuario pueden dar:

- Un mensaje de la DGII no es literal/claro sobre qué hacer (como pasó
  varias veces en el Paso 2: "reiniciadas", contador que no avanza, etc.)
  y ya se intentó una lectura razonable sin éxito.
- Hace falta enviar un correo o llamar a soporte DGII en nombre de
  Abregonza — eso es correspondencia oficial, el usuario decide si se
  envía, el runner solo puede DEJAR EL BORRADOR listo.
- El REQUISITO en sí (no la capacidad técnica de cumplirlo) no está
  confirmado y no hay forma de confirmarlo sin inventar (ejemplo ya
  vivido: formato exacto del QR — ahí SÍ hay que investigar primero, no
  construir a ciegas; pero una vez confirmado el formato, construir la
  plantilla es trabajo normal de la corrida, no un bloqueo nuevo). Más
  vale parar a confirmar el requisito que adivinarlo y que la DGII lo
  rechace quemando secuencias reales.
- Cualquier acción envía datos reales de Abregonza (facturas, montos,
  RNC de clientes reales) a un ente externo de forma que no se pueda
  deshacer — está permitido (es el propósito de este runner) pero el
  runner debe verificar dos veces que el dato es correcto antes de
  enviarlo, no hay "deshacer" con la DGII.

En cualquiera de estos casos: escribir el bloqueo en la sección "Bloqueos
activos" arriba (fecha + descripción exacta + qué decisión falta) y parar la
corrida limpia (sin dejar código a medias sin commitear).

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

## Log de corridas

Agregar una línea por corrida, más reciente arriba:

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
