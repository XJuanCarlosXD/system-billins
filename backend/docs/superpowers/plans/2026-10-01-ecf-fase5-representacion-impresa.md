# Sub-plan Fase 5 — Representación Impresa de e-CF (37va corrida)

**Contexto**: `2026-09-22-ecf-certificacion-plan-maestro.md` §"Fase 5 — Pruebas
Simulación Representación Impresa" + §"Formato QR confirmado 2026-10-01".
Fase 4 queda 22/N intacta esta corrida (solo falta tipo 34 bloqueado 615).
Ruta elegida por horario: trabajo seguro de construcción, cero envíos a certecf.

## Entregables de esta corrida

1. **Backend** `GET /api/fe/documentos/<e_ncf>/representacion-impresa/print-data/`
   — nuevo endpoint JSON que devuelve `{cia, doc, cliente, lineas, totales, ecf}`
   para pintar la RI en Puck. Usa la factura FAT original (tipo_docu/no_docu
   guardados en TFE_DOCUMENTO) + los campos fiscales del e-CF firmado.
2. **Frontend** `defaults/ecf-representacion-impresa.ts` — plantilla Puck
   nueva, estilo `cxp-documento` (patrón `sigaft-pdf-simple-design`) +
   bloque `QRCode` ya existente alimentado por `ecf.qr_url`.
3. **Registry** entry `ecf-representacion-impresa` con `printDataPath` al
   endpoint nuevo, familia `documento`, A4 vertical.
4. **UI** — un botón "RI PDF" en el panel Certificación e-CF (Paso 4) para
   cada e-CF Aceptado, abriendo `/print/ecf-representacion-impresa/<e_ncf>`.
   Deferido si el budget aprieta: con tener la URL funcionando el runner y
   el usuario pueden probarla.
5. **Tests TDD** para el helper backend (derivación de `codigo_seguridad`
   desde xml_firmado y armado de QR URL según tipo e-CF normal vs RFCE).

## Decisiones técnicas

- **`ecf.qr_url` se arma SERVER-SIDE** (no en Handlebars) — el formato tiene
  encoding delicado (`%20` en fecha-firma, el `encf` en minúsculas) que es
  más fácil garantizar en Python.
- **`ambiente` para el QR**: por ahora `certecf` fijo (toda esta fase está
  en certecf). Cuando se migre a producción, cambiar a `cfg['ambiente']`
  de `TFE_CONFIG`. Dejo un `_AMBIENTE_QR = 'certecf'` como constante
  nombrada, igual que `_AMBIENTE_MODO_TEST` en `apps/fe/views.py`.
- **RFCE vs e-CF normal**: la URL base cambia (`fc.dgii.gov.do/certecf/
  consultatimbrefc` vs `ecf.dgii.gov.do/certecf/consultatimbre`) y los
  query params también. El criterio del plan maestro: tipo_ecf=32 con
  monto_total<250000 → RFCE; todos los demás → normal. (El 32 ≥250K usa el
  servicio de recepción e-CF normal, no RFCE, por eso también va con
  `consultatimbre`.)
- **`codigo_seguridad`**: TFE_DOCUMENTO ya tiene columna. Para RFCE se
  guarda al enviar (`dgii_client.enviar_rfce`). Para e-CF normales no se
  guarda hoy, pero es derivable desde `xml_firmado` con
  `ecf_builder.derivar_codigo_seguridad()` ya implementado. El endpoint lo
  deriva on-demand si está vacío, sin tocar la BD en caliente — el PDF se
  arma leyendo lo que haya.
- **Fuente de los campos fiscales** (RNCComprador, FechaEmision,
  MontoTotal, FechaFirma): leer desde `xml_firmado` parseado (fuente de
  verdad firmada) y no desde los campos derivados de TFE_DOCUMENTO. Así
  el QR siempre refleja los datos EXACTOS que firmó la App Oficial, no una
  reconstrucción.

## Tests TDD a escribir primero (van en `apps/fe/tests/`)

- `test_views_representacion_impresa.py`:
  1. 404 si el e-NCF no existe en TFE_DOCUMENTO.
  2. 400 si el documento no tiene `xml_firmado` (nunca se envió).
  3. Happy path con e-CF31 (normal): devuelve `ecf.qr_url` con base
     `ecf.dgii.gov.do/certecf/consultatimbre`, encf en minúsculas,
     fechafirma URL-encoded (`%20`), codigo_seguridad = 6 primeros chars
     del SignatureValue del XML.
  4. Happy path con RFCE (tipo 32, monto<250K): devuelve `ecf.qr_url` con
     base `fc.dgii.gov.do/certecf/consultatimbrefc` y los 4 query params
     (rncemisor, encf, montototal, codigoseguridad).
  5. e-CF 32 con monto ≥250K: URL es la de e-CF normal (no RFCE).
  6. `rnccomprador` se omite del QS cuando el XML no lo trae (consumidor
     final sin RNC).

## Secuencia de ejecución

1. Escribir los 6 tests arriba — todos rojos.
2. Implementar helper `_armar_qr_url(xml_firmado, tipo_ecf, monto_total)
   -> str` + helper `_derivar_codigo_seguridad_safe(xml_firmado) -> str`
   en un módulo nuevo `apps/fe/representacion_impresa.py` (TDD puro,
   sin DB).
3. Implementar la vista `fe_documento_ri_print_data_view` en
   `apps/fe/views.py` que compone cia/cliente/doc/lineas/totales
   reusando `fat_repo.get_factura` + `_cia_payload` + el bloque de líneas
   de `fat_factura_print_data` (extraído a helper si es reutilizable, o
   duplicado localmente si cuesta refactor).
4. Agregar URL en `apps/fe/urls.py`.
5. Verificar tests verdes en el contenedor.
6. Frontend: `defaults/ecf-representacion-impresa.ts` + entrada en
   `registry.ts`.
7. Botón en `features/fe/certificacion/...` (dejar para 38va si no da
   el tiempo).
8. Deploy VM (`sigaft-deploy-vm`), smoke test con un e-NCF31 real
   Aceptado (p.ej. E310000000121 del ciclo activo) abriendo
   `/print/ecf-representacion-impresa/E310000000121?no_cia=01&templateDraft=1`
   en el browser real, verificar que el QR renderiza y la URL del QR
   coincide con el ejemplo del PDF oficial salvo por los valores reales.
9. Commit + push a main, actualizar plan maestro con log de la corrida.

## Qué queda para la 38va o posterior

- Botón "RI PDF" en la UI (si no se alcanzó esta corrida).
- Flujo real de "subir las RI al portal" del Paso 5 (widget de archivo
  manual, probablemente vía Playwright como ya se hizo con los e-CF32
  <250K del Paso 4).
- Confirmación empírica del formato del `encf` (lower vs upper) contra
  un ejemplo del portal — hoy decidimos minúsculas por el ejemplo del
  PDF oficial, pero puede que `certecf` acepte ambos.
