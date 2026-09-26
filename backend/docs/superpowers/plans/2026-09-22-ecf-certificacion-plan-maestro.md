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
| 4 | Pruebas Simulación e-CF | 🔲 En curso — 11va corrida rehizo los 4×31 (E310000000065-068 Aceptados) desde las mismas 4 facturas reales vía `paso4-factura-real`. Portal: 4/4 tipo 31 + 1/1 tipo 33, sin nuevos reinicios. Falta 2×32≥250K, 2×34, 2×41-47 c/u y RFCE. | 2026-09-25 |
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

## Log de corridas

Agregar una línea por corrida, más reciente arriba:

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
