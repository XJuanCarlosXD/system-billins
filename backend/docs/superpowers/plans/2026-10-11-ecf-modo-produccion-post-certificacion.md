# Sub-plan — Modo Producción post-certificación e-CF (ZentoryERP)

**Contexto**: El plan maestro `2026-09-22-ecf-certificacion-plan-maestro.md`
cubre todo lo necesario para que la DGII emita la Resolución de Emisor
Electrónico Certificado para Abregonza (Fases 1-15 contra `certecf`).
**Este sub-plan cubre lo que sigue el día después**: convertir la pila
e-CF ya construida (`apps/fe/`) en el flujo real de emisión de facturas
desde el UI de ZentoryERP contra el ambiente productivo `ecf` de la DGII
(no `certecf`), de forma que cada factura FT que se emita en producción
genere su e-CF, lo firme con el certificado oficial, lo envíe a la DGII,
guarde el trackId y la representación impresa, y refleje el estado
Aceptado/Rechazado al operador.

**No ejecutar nada de este sub-plan hasta que las Fases 12-15 estén
cerradas** — la Resolución de Emisor Electrónico Certificado es
prerrequisito legal para que la DGII acepte envíos al ambiente `ecf`.

## Gap analysis — qué YA existe vs. qué falta

### Lo que YA está construido (reutilizable, no re-hacer)

- `apps/fe/ecf_builder.py` — `construir_ecf_31`, `construir_ecf_32`
  (consumen factura real de `TFAT_FACTURA` + secuencia real de
  `TFE_SECUENCIA`), `construir_ecf_generico` (datos planos para 33/34/
  41/43/44/45/46/47, probado en Fase 4).
- `apps/fe/firma.py` — `firmar_con_app_oficial` (App Firma Digital DGII
  oficial, uso obligatorio para producción), `verificar_xml` (fix 80va
  para ds-prefix).
- `apps/fe/dgii_client.py` — `enviar_ecf`, `enviar_rfce`,
  `consultar_estado`; `AMBIENTES = ('testecf', 'certecf', 'ecf')` ya
  soporta producción (solo hay que pasarlo por parámetro).
- `apps/fe/views.py` — `documentos_view` y `documento_detalle_view`
  listan y muestran e-CFs enviados por no_cia (bitácora completa,
  reutilizable como UI de producción).
- `apps/fe/public_views.py` — endpoints públicos de autenticación,
  recepción y aprobación comercial (Fases 7-11). En producción quedan
  activos exactamente igual, solo cambia la URL base pública (sub-plan
  `2026-10-10-ecf-fase12-infra-productiva.md`).
- Representación impresa Fase 5 (Puck template `defaultTemplate` por
  tipo e-CF, endpoint `/print/<codigo_doc>/<id>`, QR, hash de los
  primeros 20 bytes del `DigestValue`). Ya aceptada por DGII 2026-10-09.
- Pipeline interno smoke end-to-end validado en Fase 8 (73va corrida):
  GET semilla → firma → POST validación cert → POST recepción → trackId
  en `TFE_DOCUMENTO_RECIBIDO`.

### Lo que FALTA — "la última milla" entre `apps/fe/` y el usuario final

**Gap 1 — Ambiente hardcoded a `certecf` en Paso 4**: En
`apps/fe/views.py` existe `_AMBIENTE_MODO_TEST = 'certecf'` (línea 265)
usado por cinco endpoints de certificación. Está correcto para Fase 4,
pero producción debe leer `TFE_CONFIG.ambiente` por `no_cia` y no
hardcodear nada. Hay comentario explícito en el código que lo confirma
(líneas 251-264). No es un refactor grande; es sustituir el símbolo por
`cfg['ambiente']` en los endpoints de producción nuevos (no tocar los
de Paso 4 — ya cerrado).

**Gap 2 — No hay "Emitir e-CF" integrado en el flujo FAT de factura**:
Hoy, el pipeline que ya existe (`certificacion_paso4_factura_real_view`,
`POST /api/fe/certificacion/paso4-factura-real/`) está escondido en el
panel administrativo "Configuración → Facturación Electrónica →
Certificación e-CF". El cajero/vendedor que emite una FT normal no
tiene cómo pedir "y emitime el e-CF también". Falta:
- Botón "Emitir e-CF" en el detalle de factura FAT (o auto-trigger al
  marcar factura como emitida, si el no_cia está en modo producción
  obligatoria según RNC comprador ≥ monto umbral).
- Endpoint productivo paralelo `POST /api/fe/produccion/emitir-ecf/`
  que recibe `{no_cia, punto, tipo_factura, no_factura}`, decide tipo
  (31 vs 32 según RNCComprador y monto, igual que la lógica del
  legado), llama al builder correspondiente, firma con App Oficial,
  envía a `ecf`, guarda bitácora, devuelve `{encf, trackId}`.
- Cuando la factura es Consumo <250K de contribuyente sin RNC, usar
  pipeline RFCE (`fc.dgii.gov.do`) en lugar de ECF — ya hay comando
  `fe_rfce_consumo_menor` que puede moverse a vista.

**Gap 3 — Estado del e-CF no visible en la lista de facturas FAT**: La
vista de facturas (`features/facturas/` en frontend) no muestra una
columna "Estado e-CF" (Aceptado/Rechazado/Pendiente/No emitido). El
operador no sabe cuáles facturas ya se enviaron ni cuáles fallaron.
Falta:
- Endpoint `GET /api/fe/produccion/estado-factura/<punto>/<tipo>/<no>/`
  que devuelve el documento asociado desde `TFE_DOCUMENTO` (o `None`
  si no se emitió e-CF todavía).
- Columna + badge en lista FAT.
- Enlace desde la fila de factura a `/certificacion/documentos/<encf>/`
  (vista detalle existente) para ver XML firmado, trackId, respuesta
  DGII.

**Gap 4 — Representación impresa no auto-renderizada**: Fase 5 cerró
con la plantilla PDF Puck aceptada, pero el `/print/<codigo>/<id>` se
dispara on-demand. En producción, la factura emitida debe guardar PDF
en disco (o re-renderizar bajo pedido con URL estable) y hacerlo
descargable desde la vista FAT. Mejor segunda ruta (sin storage) ya
que Puck es determinístico. Falta:
- Botón "Descargar e-CF (PDF)" en lista/detalle FAT.
- Link imprimible en el ticket impreso tradicional (QR del e-CF al
  pie, patrón del legado SIGAFT impresora térmica).

**Gap 5 — Flujo de rechazo**: Cuando la DGII rechaza (código no 1), el
e-NCF queda quemado (`secuenciaUtilizada:true` casi siempre) pero la
factura FAT ya está emitida. Decisión de producto pendiente:
- Opción A: la factura FAT queda como está, se marca "e-CF rechazado"
  en rojo, el contador queda avisado, no se auto-anula.
- Opción B: anular la factura FAT (devolver inventario, revertir CxC),
  mostrar el motivo del rechazo, re-emitir desde cero.
- Opción C: dejar FAT intacta, emitir Nota de Crédito tipo 34 contra
  el e-NCF anterior, luego emitir e-CF nuevo con factura corregida.

La opción canónica DGII es (C) para transacciones ya cobradas, (B)
para facturas no cobradas. El runner no decide esto — pedirle al
usuario cuando este sub-plan arranque Tarea 5. Mientras tanto, (A)
como default seguro.

**Gap 6 — Nota de crédito/débito desde FAT**: Hoy existe en FAT la
operación "nota de crédito" normal (tabla `TFAT_NOTA_CREDITO` o
similar). Falta integrar con el pipeline del Paso 4 manual
(`paso4-manual-view` ya existe, mapea `datos` planos a
`construir_ecf_generico`). Para producción:
- Endpoint `POST /api/fe/produccion/emitir-nc-nd/` que, dado el id de
  una nota de crédito/débito FAT existente, arma el `datos` plano
  correspondiente (tipo 33 o 34, `CodigoModificacion` según flujo,
  `NCFModificado` desde la factura original), firma, envía, guarda.
- UI: botón "Emitir e-CF" en vista detalle de nota de crédito/débito.
- **Importante**: tipo 34 requiere `IndicadorNotaCredito=1` +
  `CodigoModificacion=2` + `MontoTotal=0` para el patrón canónico
  validado 47va corrida — ver sección "Patrón NC Corrige Texto" del
  plan maestro.

**Gap 7 — Dashboard de salud e-CF**: Un panel que muestre: certificado
digital válido/por vencer (próximo vencimiento 2027-08-31), último
envío exitoso, cantidad de rechazos últimas 24h, cantidad en estado
Pendiente, URLs públicas respondiendo (ping GET semilla), tunnel
levantado. Ayuda al operador a detectar problemas antes de que el
contador fiscal se queje. Útil pero no bloqueante — Tarea opcional.

**Gap 8 — Rate-limiting / cola**: La DGII no publica rate-limits
oficiales, pero bajo carga alta (100+ facturas/hora) puede devolver
`HTTP 429` o `codigo:5 "Servicio no disponible"`. Falta:
- Cola persistente (`django-q`, `celery`, o tabla propia
  `TFE_COLA_ENVIO`) para encolar envíos y reintentar con backoff.
- Idempotencia: nunca re-emitir un e-NCF que ya tiene `trackId`
  (verificar en `TFE_DOCUMENTO` antes de llamar `enviar_ecf`).

## Tareas propuestas (orden de ejecución y tamaño)

| # | Tarea | Tamaño | Dependencias |
|---|-------|--------|--------------|
| 1 | Setear `TFE_CONFIG.ambiente='ecf'` para no_cia='01' + endpoint helper `_cfg_ambiente(no_cia)` que lee de BD; refactor pequeño | 1h | Fases 12-15 cerradas |
| 2 | Endpoint `POST /api/fe/produccion/emitir-ecf/` + UI botón en detalle FAT (reutiliza pipeline Paso 4 factura real) | 4-6h | Tarea 1 |
| 3 | Columna "Estado e-CF" + endpoint `GET /api/fe/produccion/estado-factura/` + link a bitácora | 3-4h | Tarea 2 |
| 4 | Botón "Descargar e-CF (PDF)" en lista/detalle FAT (reutiliza `/print/<codigo>/<id>`) | 2h | Tarea 2 |
| 5 | Decisión de producto sobre flujo de rechazo (A/B/C) + implementación | 4h+ depende | Tarea 2, decisión Roberto |
| 6 | Endpoint `POST /api/fe/produccion/emitir-nc-nd/` + UI en nota de crédito/débito FAT | 4-6h | Tarea 5 (patrón de rechazo definido) |
| 7 | RFCE para consumos <250K sin RNC — mover `fe_rfce_consumo_menor` a vista + botón UI | 3h | Tarea 2 |
| 8 | Dashboard de salud e-CF (opcional, útil para operaciones) | 4h | Tareas 2-3 |
| 9 | Cola persistente + backoff para rate-limiting (opcional, solo si volumen justifica) | 6h | Tarea 2 |
| 10 | Backup off-site de Oracle (sub-plan separado b1, ver 80va run log) | — | — |

**Camino crítico mínimo para producción real**: Tareas 1 → 2 → 3 → 4
→ 5 (opción A como default). Con 1-4 cubiertas, Abregonza puede
operar en producción un flujo FT→e-CF funcional end-to-end, con
visibilidad de estado al operador. Tareas 5-9 refinan la experiencia
pero no bloquean el día cero post-certificación.

## Riesgos y mitigaciones

1. **Certificado digital vence 2027-08-31**: Documentado en sub-plan
   Fase 12. Programar aviso ~2027-07-31 (30 días antes). Si vence sin
   renovación, TODA la emisión productiva de Abregonza queda caída
   hasta re-certificar. Comprar renovación con ≥60 días de anticipación.
2. **Un e-NCF enviado a `ecf` NUNCA se desemite** — mismo principio que
   `certecf` pero con consecuencia fiscal real. Doble-check obligatorio
   en el botón "Emitir e-CF" (modal confirmación con monto y RNC
   receptor explícitos, patrón UI SIGAFT existente).
3. **DGII cambia el XSD en producción**: Riesgo bajo pero posible. La
   suite TDD actual (271 tests) protege contra regresión interna; para
   detectar cambios DGII, suscribirse a avisos oficiales
   (`dgii.gov.do/eCF/avisos`) y correr smoke semanal contra el ambiente
   `testecf` (que recibe cambios primero).
4. **Backup off-site de Oracle** — crítico una vez en producción. Hoy
   no hay plan documentado; crear sub-plan (b1 de 80va run log) antes
   de ir a producción. Datos fiscales de 10+ años de operación no
   deben vivir solo en la VM `10.0.0.99`.
5. **Rotación de tunnel/dominio**: Si en el futuro hay que cambiar las
   URLs públicas (vigentes en el directorio DGII OFV), requiere ticket
   formal a DGII — no autoservice. Elegir dominio estable
   (`fe.abregonza.com.do` o similar permanente) en Opción A del
   sub-plan Fase 12.
6. **Impresora térmica legada**: Las facturas en punto de venta se
   imprimen hoy en ticket térmico. El e-CF agrega QR + e-NCF al pie;
   verificar que el formato térmico (80mm) soporta el QR. Si no, puede
   requerir impresora adicional o fallback a A4 para e-CF obligatorio.

## Alcance explícito fuera de este sub-plan

- Fases 12-15 — plan maestro.
- Infraestructura productiva (dominio, tunnel, TLS) — sub-plan
  `2026-10-10-ecf-fase12-infra-productiva.md`.
- Backup Oracle off-site — sub-plan pendiente (b1 de 80va run log).
- Portal de autoservicio para contribuyentes consultar sus e-CFs
  recibidos — no requerido legalmente, nice-to-have futuro.

## Fuentes

- Plan maestro `2026-09-22-ecf-certificacion-plan-maestro.md`.
- Código real `apps/fe/views.py:251-264,491-532` (hardcode ambiente),
  `:762-831` (ACECF).
- `apps/fe/dgii_client.py:23-29` (AMBIENTES tuple).
- `Descripcion-Tecnica-Servicios-DGII.pdf`
  (`backend/docs/superpowers/reference/2026-08-31-set-pruebas-paso2/`).
- Formato-e-CF-V1.0.pdf oficial DGII.
