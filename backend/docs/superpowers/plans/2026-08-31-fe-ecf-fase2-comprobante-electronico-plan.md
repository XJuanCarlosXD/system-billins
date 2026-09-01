# Facturación Electrónica Fase 2 — Comprobante Electrónico — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Deploy every backend/frontend change to the VM per `sigaft-deploy-vm` skill and smoke-test before checking a step done.

**Goal:** Get ZentoryERP generating, signing and sending real e-CF documents
(tipos 31 y 32) for Abregonza, with a management screen in Configuración,
and complete the DGII certification Paso 2 "Pruebas de Datos e-CF" — all
without touching real production invoices or accounting.

**Spec:** `backend/docs/superpowers/specs/2026-08-31-fe-ecf-fase2-comprobante-electronico-design.md`

**Ya resuelto (no repetir):** firma digital automatizada vía
`apps.fe.firma.firmar_con_app_oficial()` (Mono + App Firma Digital oficial
de la DGII, ya en la rama `feature/fe-endpoints-recepcion-aprobacion`,
probado byte-a-byte idéntico a lo que la DGII acepta). Certificado de
Roberto ya cargado en `TFE_CONFIG` no_cia=01. Endpoints de recepción P2P
ya construidos y probados.

**Credenciales/contexto necesario:** ver memorias `project_dgii_ecf_postulacion_estado_20260831`
y `reference_accesos_portales_gubernamentales_abregonza` — RNC 130217432,
usuario/clave del Portal de Certificación, tarjeta de coordenadas OFV.

---

### Task 0: Obtener los XSD oficiales reales antes de escribir ningún builder

**Por qué primero:** no inventar la estructura del XML de un e-CF real —
ya nos costó 5 intentos fallidos con la Postulación por asumir formato.
Los XSD oficiales (`e-CF31`, `e-CF32`, versión 1.0 oct-2025) están en
`dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/documentacionSobreE-CF.aspx`
y en el "Set de Pruebas" que se descarga desde el Paso 2 del portal de
certificación (ya logueado, ver credenciales arriba) — ese Set trae
ejemplos reales de e-CF 32 con datos que la propia DGII espera recibir de
vuelta.

- [ ] **Step 1:** Descargar el Set de Pruebas del Paso 2
      (`https://ecf.dgii.gov.do/certecf/portalcertificacion/Postulacion/Pruebas`,
      botón "Descargar comprobantes"). Guardar en
      `backend/docs/superpowers/reference/2026-08-31-set-pruebas-paso2/`.
- [ ] **Step 2:** Descargar los XSD oficiales e-CF31.xsd y e-CF32.xsd de
      la documentación pública de la DGII. Mismo directorio de reference.
- [ ] **Step 3:** Documentar en un `NOTAS.md` dentro de esa carpeta: qué
      campos son obligatorios, formatos de fecha/moneda exactos, y cómo
      mapean a columnas ya existentes de `TFAT_FACTURA`/`TFAT_FACTURA_DET`
      (usar `fat_repo.py` como referencia de columnas reales).

### Task 1: Generación de XML e-CF (tipos 31 y 32)

**Files:**
- Create: `backend/apps/fe/ecf_builder.py`
- Modify: `backend/apps/legacy/repositories/fe_repo.py` (helpers de lectura si faltan campos)

- [ ] **Step 1:** `construir_ecf_32(no_cia, punto, no_docu) -> str` — lee la
      factura de `TFAT_FACTURA`/`TFAT_FACTURA_DET`/`TFAT_CLIENTE` vía
      `fat_repo`, arma el XML de Factura de Consumo Electrónica según el
      XSD real (Task 0). Incluye el e-NCF (`E32` + secuencial de
      `TFE_SECUENCIA`, NO el NCF de papel).
- [ ] **Step 2:** `construir_ecf_31(...)` — igual para Crédito Fiscal.
- [ ] **Step 3:** Tests con `pytest` (patrón `pytest-django` ya en
      requirements.txt) contra datos de una factura real de prueba
      (ZZTEST o similar, no una factura real de cliente).

### Task 2: Firma y envío a la DGII

**Files:**
- Modify: `backend/apps/fe/dgii_client.py`

- [ ] **Step 1:** `enviar_ecf(no_cia, ambiente, e_ncf, xml_sin_firmar) -> dict`
      — obtiene el `.p12`/password de `fe_repo.get_certificado`, firma con
      `firma.firmar_con_app_oficial()` (NO `firmar_xml()` — ver nota en
      `firma.py`), hace `POST /recepcion/api/facturaselectronicas` con
      `Authorization: Bearer {token}` (reusar `obtener_token`), devuelve
      `{trackId, xml_firmado, respuesta_cruda}`.
- [ ] **Step 2:** Para RFCE (Resumen de Factura de Consumo, obligatorio
      antes de la factura íntegra si es < RD$250,000): `enviar_rfce(...)`
      → `POST https://fc.dgii.gov.do/{amb}/recepcionfc/api/recepcion/ecf`.
- [ ] **Step 3:** `consultar_estado(no_cia, ambiente, track_id) -> dict` →
      `GET /consultaresultado/api/consultas/estado?trackId=`.

### Task 3: Bitácora — TFE_DOCUMENTO + bandera de prueba

**Files:**
- Create: `backend/docs/sql/2026-08-31-fe-documento-es-prueba.sql`
- Modify: `backend/apps/legacy/repositories/fe_repo.py`

- [ ] **Step 1:** DDL: `ALTER TABLE FAT.TFE_DOCUMENTO ADD ES_PRUEBA VARCHAR2(1) DEFAULT 'N'`
      (columna nueva, ver requisito de aislar el Set de Pruebas de
      producción — spec §Tarea 5). Ejecutar igual que las DDL anteriores
      de esta rama (conexión backend, no sqlplus).
- [ ] **Step 2:** `fe_repo.save_documento_enviado(no_cia, e_ncf, tipo_ecf, track_id, xml_firmado, respuesta, es_prueba='N')`.
- [ ] **Step 3:** `fe_repo.list_documentos(no_cia, filtros: dict) -> list[dict]`
      — paginado, filtros por estado/tipo/es_prueba.

### Task 4: UI — pantalla "Comprobante Electrónico" en Configuración

**Files:**
- Modify: `frontend/src/features/settings/...` (ubicar el archivo real de
  la sección "Facturación Electrónica (e-CF)" ya existente antes de tocar
  nada — buscar `unified-companias` o `TFE_CONFIG` en el frontend)
- Create: componente nuevo de tabla + hook React Query (patrón
  `sigaft-crud-pagination`)

- [ ] **Step 1:** Nueva pestaña/tab "Comprobante Electrónico" dentro de la
      sección existente. Tabla paginada de `TFE_DOCUMENTO`: e-NCF, tipo,
      fecha, estado, trackId, ES_PRUEBA (badge visual "PRUEBA" si aplica).
- [ ] **Step 2:** Acciones por fila: ver XML firmado (modal), ver
      respuesta DGII, botón "Consultar estado" (llama
      `consultar_estado`), botón "Reenviar" si fue rechazado.
- [ ] **Step 3:** Sección separada "Modo Test — Set de Pruebas DGII": un
      formulario simple para cargar/generar un e-CF de prueba (Task 5) y
      un botón "Enviar prueba a DGII" bien diferenciado visualmente
      (color de advertencia) del flujo real, para que no se confunda con
      facturación de producción.

### Task 5: Flujo del Set de Pruebas (modo test, aislado de producción)

**Files:**
- Create: `backend/apps/fe/views.py` — endpoint nuevo (o extender el
  existente) `POST /api/fe/pruebas/enviar/` que reciba los datos de un
  escenario del Set de Pruebas (no un no_docu de FAT real).

- [ ] **Step 1:** Endpoint que arme el e-CF directo desde un payload JSON
      (los datos del escenario de prueba que da la DGII), sin pasar por
      `TFAT_FACTURA`. Firma con `firmar_con_app_oficial()`, envía a
      `testecf`, guarda en `TFE_DOCUMENTO` con `ES_PRUEBA='S'`.
- [ ] **Step 2:** Para cada escenario del Set de Pruebas descargado en
      Task 0: ejecutarlo manualmente vía la UI de Task 4 hasta que el
      portal de certificación marque "N/N Comprobantes Aceptados" al
      100%. Documentar en la memoria del proyecto cada resultado
      (aceptado/rechazado) a medida que se hace — NO asumir que pasó sin
      confirmarlo en el propio portal de certificación de la DGII.

---

## Fuera de alcance (no hacer esta noche)

- Los 8 tipos de comprobante restantes.
- Disparo automático de e-CF al facturar en FAT — sigue siendo manual/test
  hasta que Abregonza esté certificada.
- Aprobación comercial saliente y anulación de rangos (ANECF).
- Rebuild de la imagen Docker para que `mono-complete` persista — coordinar
  aparte por el riesgo de tocar el contenedor compartido con otros
  worktrees (no ejecutar sin avisar).
