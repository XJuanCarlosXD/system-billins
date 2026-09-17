# Facturación Electrónica DGII (e-CF) — Fase 2: Comprobante Electrónico — Diseño

Fecha: 2026-08-31 · Estado: EN PROGRESO (Paso 1/15 APROBADO, firma automatizada resuelta — ver §4 Tarea 0)

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
- **Firma DGII: RESUELTA Y AUTOMATIZADA (ver Tarea 0).** La firma XMLDSig
  propia (`apps/fe/firma.firmar_xml`, signxml+lxml) fue rechazada por el
  validador de la Postulación ("Error XML. Firma Inválida.", 5 intentos).
  Se resolvió invocando la lógica REAL de la App Firma Digital oficial de
  la DGII directo desde el backend Linux vía Mono — sin GUI, sin Windows,
  sin clave visible en la lista de procesos. Función lista para usar:
  `apps.fe.firma.firmar_con_app_oficial(xml_str, p12_bytes, password)`.

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

### Tarea 0 — COMPLETADA: firma automatizada con la lógica real de la App oficial, sin GUI, nativa en el backend Linux

La App Firma Digital (`App Firma Digital.exe`, Herramientas Recomendadas de
la DGII) es un **ensamblado .NET/Mono**, no un binario nativo. Expone una
clase de servicio separada de la UI:

```
wfFirma.Services.SignServices.FirmarXml(pathFile, pathCert, passCert, fhFirma) -> XmlDocument
```

`fhFirma=false` (si es `true` agrega `<FechaHoraFirma>`, que la Postulación
aceptada no tenía).

**Integrado y probado end-to-end en el backend real:**
- `apps/fe/tools/App Firma Digital.exe` — el binario oficial, en el repo.
- `apps/fe/tools/firmar_wrapper.cs` — wrapper CLI compilado con `mcs`
  (compilador de Mono) que llama `SignServices.FirmarXml` directo (clave
  por stdin, no por argv).
- `apps/fe/firma.firmar_con_app_oficial(xml_str, p12_bytes, password) -> str`
  — invoca `mono firmar.exe` vía subprocess.
- `Dockerfile.dev` + `docker/entrypoint.sh` — `mono-complete` como
  dependencia del sistema; `firmar_wrapper.cs` se compila en cada arranque
  del contenedor (el `.exe` base viaja por volumen junto al código).

Verificado: el `DigestValue` firmado bajo Mono/Linux es **idéntico byte a
byte** al que la DGII ya aceptó desde Windows (única diferencia CRLF/LF,
irrelevante). `firmar_xml()` (signxml/lxml) se conserva para los endpoints
propios de recepción P2P donde YO controlo ambos lados (firmante y
verificador) — no usar `firmar_xml()` para nada que un validador real de
la DGII vaya a revisar; usar siempre `firmar_con_app_oficial()` para eso.

**Pendiente menor:** `mono-complete` se instaló en caliente en el
contenedor corriendo (no en un rebuild de imagen) — sobrevive mientras el
contenedor no se recree. Falta un `docker compose build` + up controlado
del backend para que persista a través de un reinicio real (no se hizo el
2026-08-31 por el riesgo de tocar un contenedor compartido con otros
worktrees en paralelo — coordinarlo antes de ejecutarlo).

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

### Tarea 5 — Set de Pruebas del Paso 2 — MODO TEST, aislado de producción

El portal de certificación entrega un archivo descargable ("Set de datos a
utilizar") con escenarios de prueba (facturas de consumo ≥ y < RD$250k).

**Requisito explícito del usuario: estas pruebas NO pueden afectar
producción ni la contabilidad real de Abregonza.** Diseño: un "modo test"
separado del flujo normal de facturación —
- Los documentos del Set de Pruebas NO se crean como `TFAT_FACTURA` reales
  (no tocan inventario, CxC, ni el asiento/cuadre de caja real).
- Se genera el e-CF directo desde los datos que entrega la DGII (una
  pantalla/formulario de captura mínima, o importando el archivo del Set
  de Pruebas tal cual), sin pasar por el flujo de facturación de FAT.
- Se firma con `firmar_con_app_oficial()` y se envía a `testecf` con un
  botón explícito ("Enviar prueba a DGII"), registrando el resultado en
  `TFE_DOCUMENTO` marcado con una bandera `ES_PRUEBA='S'` (columna nueva a
  agregar) para poder filtrarlo/excluirlo de cualquier reporte real.
- Repetir hasta que el portal marque "N/N Comprobantes Aceptados" al 100%.

## 5. Preguntas abiertas — RESUELTAS (2026-08-31 noche)

1. **UI**: solo en Configuración (dentro de la sección existente
   "Facturación Electrónica (e-CF)"), no una pantalla aparte en
   Contabilidad.
2. **Firma**: resuelta y automatizada por completo (Tarea 0) — no hace
   falta firmar a mano con la App oficial nunca más.
3. **Disparo**: modo manual/test explícito para el Set de Pruebas del
   Paso 2 (botón, aislado de producción — ver Tarea 5). El disparo
   automático al facturar en FAT queda para cuando Abregonza esté
   certificada y en producción real (fuera del alcance de esta fase).

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
