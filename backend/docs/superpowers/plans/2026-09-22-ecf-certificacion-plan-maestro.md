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
| 4 | Pruebas Simulación e-CF | 🔲 En curso — 27va corrida (2026-09-29): **1/2 tipo 44 + 1/2 tipo 45 activados** (E440000000003 CORTES HERMANOS 101001811 12:00:53 PM UTC-4 + E450000000002 CONSEJO NACIONAL DE ZONAS FRANCAS 401501406 12:01:56 PM UTC-4). Rango tipo 31 = 10M (usuario amplió post-26va). Cascada intermedia perdió acumulado previo (4/4 31+2/2 32+1/1 33+2/2 41+2/2 43) por primer intento tipo 44 sin RNCComprador (E440000000001 código 1381). Fixes en `apps/fe/ecf_builder.py`: `_TIPO_CAPS[44]['comprador']='rnc_razon_mandatory'` (era `razon_mandatory`, patrón "XSD opcional / DGII exige" #9); y payload 45 requiere `IndicadorMontoGravado=0` de facto (E450000000001 código 176, patrón #10, mismo que tipo 31 aprendió en 1ra corrida). `_PAYLOAD_44_CORRIDA_27` (CORTES 101001811 validado por 14va) + `_PAYLOAD_45_CORRIDA_26` actualizado con IndicadorMontoGravado=0 + test `test_tipo_44_sin_rnc_comprador_lanza_error_corrida27` + tests 25/26 actualizados. 90+ tests módulo pasan. Bloqueo 34 (código 615) sigue activo. Portal final: 0/N el resto (31/32/33/34/41/43/46/47/RFCE). Próxima (28va): reconstruir ciclo Primero+Segundo con builder ya arreglado (4×31 vía paso4-factura-real, 2×32≥250K con RNCs validados RYLCO/VALOIS, 1×33 con NCFModificado del 31 fresco + FechaNCFModificado correcta, 2×41 INDUSTRIAS BISONO, 2×43 exento) + 2do 44 y 2do 45 (mismos payloads, cambiar cosmético NombreItem). | 2026-09-29 |
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
1. La DGII no reconcilia saldos en tiempo real en `certecf` — necesita un batch nocturno para que un e-CF31 aparezca en el "saldo disponible" que consulta el validador del 34. **Comprobar** enviando un 34 al DÍA SIGUIENTE de la emisión del 31 referenciado (>=12 h de separación).
2. Falta un envío intermedio en el flujo del 34 — quizás una Aprobación Comercial del 31 referenciado (paso separado del Servicio de Aprobación Comercial que se probó en Fase 3), o alguna acción en el portal.
3. Existe un campo obligatorio de facto no documentado en el XSD ni en `Formato-e-CF-V1.0.pdf` (revisado en esta corrida: la sección "F. Información de Referencia" solo lista NCFModificado, RNCOtroContribuyente, FechaNCFModificado, CodigoModificacion, RazonModificacion — no hay `MontoNCFModificado` ni equivalente).
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
