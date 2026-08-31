# Facturación Electrónica DGII (e-CF) — Fase 2: Comprobante Electrónico — Diseño

Fecha: 2026-08-31 · Estado: PROPUESTO (checkpoint real: Paso 1/15 de la certificación APROBADO)

Continúa [[2026-07-07-fe-ecf-dgii-design.md]] (Fase 1: config + autenticación,
ya completada y en producción). Este documento cubre lo que falta para tener
Abregonza emitiendo e-CF reales: generación de comprobantes, firma, envío a
la DGII, bitácora, UI de gestión, y el Set de Pruebas del Paso 2 de la
certificación.

## 1. Dónde estamos (checkpoint 2026-08-31 noche)

- **Fase 1 (auth)**: completa. `TFE_CONFIG` de no_cia=01 (Abregonza, RNC
  130217432) tiene datos reales y el certificado digital de Roberto Abreu
  Espinal (representante) cargado y funcional.
- **Recepción P2P (Fase "1.5", no planeada originalmente pero necesaria para
  la certificación)**: 4 endpoints públicos reales en `/fe/...`
  (`autenticacion/api/semilla`, `autenticacion/api/validacioncertificado`,
  `recepcion/api/ecf`, `aprobacioncomercial/api/ecf`), con tokens propios
  HMAC y tabla `TFE_DOCUMENTO_RECIBIDO`. Probados end-to-end con el
  certificado real. Código en la rama `feature/fe-endpoints-recepcion-aprobacion`.
- **Certificación DGII**: solicitud núm. 81443 — **Paso 1 de 15 APROBADO**.
  Estamos en **Paso 2: Pruebas de Datos e-CF** (portal
  `ecf.dgii.gov.do/certecf/portalcertificacion`).
- **Riesgo abierto y crítico**: la firma XMLDSig generada con código propio
  (`apps/fe/firma.firmar_xml`, signxml + lxml) fue rechazada por el
  validador de la Postulación del Paso 1 ("Error XML. Firma Inválida.",
  repetido en 5 intentos con distintos ajustes de formato). Solo funcionó
  firmando con la **App Firma Digital oficial de la DGII** (ejecutable
  Windows, descargable en Herramientas Recomendadas del portal público).
  **No se sabe todavía si el mismo problema afecta la firma de e-CF reales**
  (los documentos que sí controla mi propio código de extremo a extremo,
  vs. la Postulación que es un formato ad-hoc del portal). Esto es lo
  primero que hay que descartar antes de construir toda la lógica de
  generación (ver §4, tarea 0).

## 2. Objetivo de esta fase

Que ZentoryERP pueda, para Abregonza (y luego las otras 4 empresas):

1. Generar el XML de un e-CF real a partir de una factura/documento ya
   existente en el sistema (FAT, CxP según aplique).
2. Firmarlo digitalmente.
3. Enviarlo a la DGII (`testecf` mientras se certifica, luego `ecf`).
4. Guardar el resultado (aceptado/rechazado, trackId, respuesta) en bitácora.
5. Mostrar todo eso en una pantalla de gestión ("Comprobante Electrónico").
6. Completar el Set de Pruebas del Paso 2 de la certificación con datos que
   la propia DGII entrega (no datos reales de Abregonza).

## 3. Tipos de comprobante en el alcance

Según lo registrado en la Postulación (`GrupoComprobante`):
`31,32,33,34,41,43,44,45,46,47` — Crédito Fiscal, Consumo, Nota Débito,
Nota Crédito, Compras, Gastos Menores, Regímenes Especiales, Gubernamental,
Exportaciones, Pagos al Exterior.

**No implementar los 10 de una vez.** Priorizar por volumen real de
Abregonza: primero **31 (Crédito Fiscal)** y **32 (Consumo)** — son los que
mapean directo a `TFAT_FACTURA` y cubren el Set de Pruebas del Paso 2 según
lo visto en el portal ("Facturas de consumo < 250Mil" ya aparece como
sección propia). El resto se añade cuando aparezca un caso real de negocio.

## 4. Plan de trabajo

### Tarea 0 — Descartar el riesgo de firma (bloqueante, hacer primero)

Generar un e-CF mínimo válido tipo 32 con datos de prueba, firmarlo con
`apps/fe/firma.firmar_xml` (código propio) y por separado con la App Firma
Digital oficial. Diff byte a byte de ambas firmas (`ds:SignedInfo`,
`DigestValue`, orden de elementos, `KeyInfo`). Si `testecf` acepta la firma
propia → seguir con automatización 100% propia. Si la rechaza igual que la
Postulación → decidir con el usuario: (a) aceptar firmar manualmente con la
App oficial cada e-CF durante la certificación (no escalable, pero
desbloquea el Paso 2 ya), o (b) invertir tiempo en replicar exactamente el
comportamiento de la App oficial en Python (puede requerir volcar su
binario .NET o interceptar su tráfico/salida para comparar).

### Tarea 1 — Generación de XML e-CF

Nuevo módulo `apps/fe/ecf_builder.py`: funciones `construir_ecf_31(no_cia,
no_docu)` / `construir_ecf_32(...)` que lean de `TFAT_FACTURA` +
repositorios existentes (`fat_repo`, `cxp_repo` según tipo) y arme el XML
según el XSD oficial v1.0 de la DGII (`e-CF31`, `e-CF32` — descargar XSDs
reales de dgii.gov.do, no inventar estructura). Reusar el mapeo de campos
que ya existe para el NCF de papel donde aplique (cliente, RNC, líneas,
impuestos).

### Tarea 2 — Firma y envío

Extender `dgii_client.py` (ya tiene `obtener_token`/`probar_conexion`) con:
`enviar_ecf(no_cia, ambiente, xml_firmado, e_ncf)` → POST a
`/recepcion/api/facturaselectronicas` → guarda respuesta. Para RFCE
(consumo < RD$250k) usar el host `fc.dgii.gov.do` aparte, según ya
documentado en `reference_dgii_ecf_api.md`.

### Tarea 3 — Bitácora

Usar `FAT.TFE_DOCUMENTO` (ya existe desde el diseño F1, columnas
`E_NCF, TIPO_ECF, ESTADO, TRACK_ID, XML_FIRMADO, RESPUESTA_DGII, ...`).
Repositorio nuevo `fe_repo.save_documento_enviado(...)` /
`fe_repo.list_documentos(no_cia, filtros)`.

### Tarea 4 — UI: pantalla "Comprobante Electrónico"

- Ubicación: dentro de **Configuración → Facturación Electrónica (e-CF)**
  (ya existe esa sección, patrón `settings/unified/unified-companias.tsx`)
  como pestaña/sub-sección nueva, NO una pantalla aparte en Contabilidad —
  mantiene una sola fuente de verdad. Si el contador necesita visibilidad
  desde CNT, se agrega un link cruzado o badge, no una copia de la pantalla.
  **Confirmar este punto con el usuario antes de construir** (pidió
  explícitamente "en contabilidad configuración", puede que quiera un
  acceso directo desde el módulo CNT también).
- Contenido: tabla paginada (patrón `sigaft-crud-pagination`, React Query)
  de `TFE_DOCUMENTO` — columnas e-NCF, tipo, fecha, estado DGII, trackId,
  acciones (ver XML, ver respuesta DGII, reenviar si rechazado, consultar
  estado). Filtros por estado y tipo. Seguir convenciones visuales de
  `sigaft-ui-facturacion`.

### Tarea 5 — Set de Pruebas del Paso 2

El portal de certificación entrega un archivo descargable ("Set de datos a
utilizar") con escenarios de prueba (facturas de consumo ≥ y < RD$250k).
Por cada escenario: generar el e-CF con ESOS datos (no los reales de
Abregonza), firmar, enviar a `testecf`, y para los < 250k generar primero
el Resumen de Factura de Consumo vía RFCE — solo tras aceptado, cargar la
factura íntegra. Repetir hasta que el portal marque "N/N Comprobantes
Aceptados" en 100%.

## 5. Preguntas abiertas para el usuario

1. Ubicación exacta de la pantalla "Comprobante Electrónico" — ¿solo en
   Configuración, o también accesible/visible desde Contabilidad (CNT)?
2. Firma: ¿aceptar firmar manualmente con la App oficial mientras se
   certifica (más lento pero ya funciona), o priorizar resolver la
   discrepancia técnica para automatizar 100% antes de seguir?
3. ¿El envío de e-CF debe dispararse automáticamente al crear cada factura
   en FAT (enganchado al flujo actual), o empezar con un botón manual
   "Generar e-CF" por documento mientras dura la certificación?

## 6. Fuera de alcance de esta fase

- Los 8 tipos de comprobante restantes (crédito/débito, compras, gastos
  menores, régimen especial, gubernamental, exportaciones, pagos al
  exterior) — se añaden bajo demanda.
- Aprobación comercial saliente (ACECF que Abregonza envía a otros) — ya
  existe el endpoint de RECEPCIÓN (`apps/fe/public_views.py`), falta el de
  ENVÍO si Abregonza compra a otro emisor electrónico.
- Anulación de rangos e-NCF (ANECF).
- Las otras 4 empresas del grupo — replicar solo después de que Abregonza
  esté certificada y estable en producción.
