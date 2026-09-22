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
| 4 | Pruebas Simulación e-CF | 🔲 Construido, NO ejecutado | 2026-09-22 |
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

- Un mensaje de la DGII no es literal/claro sobre qué hacer (como pasó
  varias veces en el Paso 2: "reiniciadas", contador que no avanza, etc.)
  y ya se intentó una lectura razonable sin éxito.
- Hace falta enviar un correo o llamar a soporte DGII en nombre de
  Abregonza — eso es correspondencia oficial, el usuario decide si se
  envía, el runner solo puede DEJAR EL BORRADOR listo.
- La fase pide un dato que no se puede verificar sin inventar (ejemplo ya
  vivido: formato exacto del QR) — más vale parar y dejarlo documentado
  que adivinar un formato y que la DGII lo rechace quemando secuencias
  reales.
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

## Log de corridas

Agregar una línea por corrida, más reciente arriba:

- (vacío todavía — la primera corrida programada la agrega acá)
