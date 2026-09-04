# Resultados reales del Paso 2 (Pruebas de Datos e-CF) — 2026-09-04

Ejecutado contra `testecf` real, Abregonza RNC 130217432, solicitud de
certificación 81443, usando el endpoint `POST /api/fe/pruebas/enviar/`
(Task 5 Step 1) ya desplegado en la VM.

## Resumen final (21 de 25 escenarios de la hoja `ECF`)

| Resultado | Cantidad | e-NCF |
|---|---|---|
| Aceptado (código 1, limpio) | 18 | E310000000034, E310000000007, E320000000006, E320000000004, E410000000008, E410000000007, E430000000001, E430000000007, E440000000013, E440000000010, E450000000003, E450000000007, E460000000009, E460000000007, E470000000001, E470000000007, E330000000001, E340000000013 |
| Aceptado Condicional (código 4, permanente) | 2 | E310000000001, E310000000010 |
| Rechazado (código 2, permanente) | 1 | E340000000001 |

**Faltan 4 de los 25**: la hoja `RFCE` (E320000000012/013/014/015, Facturas de
Consumo < RD$250,000) requieren primero un RFCE aceptado
(`dgii_client.enviar_rfce`, builder de XML del RFCE aún no construido — XSD
distinto, `RFCE-32-v1.0.xsd`) y luego una carga manual de la factura íntegra
por un widget de subida de archivo en el propio portal, separado de la API.
No se intentaron todavía.

## Hallazgos clave (ver también memoria `project_dgii_ecf_postulacion_estado_20260831`)

1. **`obtener_token()` firmaba la semilla con `firma.firmar_xml()`** (no
   `firmar_con_app_oficial()`) — bloqueaba TODA autenticación real contra
   `testecf` con "Firma del certificado invalida". Corregido, commit
   `4dc3e7f`.
2. **El `RNCComprador` del Set de Pruebas oficial de la DGII
   (`131880681` / "DOCUMENTOS ELECTRONICOS DE 03") no es un contribuyente
   activo/registrado** — pasa el algoritmo de dígito verificador pero la
   DGII lo rechaza igual con "Aceptado Condicional" (no cuenta como
   aceptado). Se repite en las 25 filas del Set de Pruebas sin excepción.
   Sustituirlo por cualquier RNC dominicano real activo (se usó
   `130941361`, RC HERNANDEZ) resuelve el problema — confirmado con
   reenvíos idénticos salvo ese campo.
3. **Un e-NCF se consume/quema al primer envío, sin importar el resultado**
   (Aceptado, Aceptado Condicional o Rechazado) — no se puede corregir y
   reenviar el mismo e-NCF. Por eso los 2 primeros envíos (hechos antes de
   descubrir el hallazgo #2) quedaron con "Aceptado Condicional"
   permanente, y la Nota de Crédito que referenciaba a uno de ellos
   (`E340000000001` → `E310000000001`) quedó "Rechazada" permanente porque
   el RNC del comprador de la ND/NC debe coincidir exactamente con el de la
   factura que modifica.
4. **Orden de envío obligatorio** (modal "Orden de Emisión de Comprobantes
   Para las Pruebas" en el propio portal, no documentado en el Excel):
   Primero 31/32≥250k/41/43/44/45/46/47 → Segundo 33/34 → Tercero RFCE
   → Cuarto Facturas de Consumo <250k íntegras. Se siguió correctamente
   para los 21 escenarios de este lote.
5. **El contador visual del portal ("N/21 Comprobantes Aceptados") seguía
   en `0/21`** incluso después de 18 "Aceptado" limpios confirmados vía
   `consultar_estado` — no se confirmó si es un job de reconciliación con
   retraso o si excluye "Aceptado Condicional"/"Rechazado" del total (lo
   cual dejaría el máximo posible en 18/21 para este lote, nunca 21/21,
   por los 3 e-NCF permanentemente dañados por el hallazgo #2/#3 antes de
   corregirlo). **Pendiente de aclarar con soporte/chat DGII o revisando el
   portal más tarde.**

## Archivos en esta carpeta

- `resultados_primero.json` — respuesta HTTP cruda de cada uno de los 15
  envíos del grupo "Primero" restante (después de los primeros 3 manuales).
- `resumen_estados_primero.json` — resultado de `consultar_estado` para
  esos mismos 15.
- `resultados_segundo.json` — respuesta HTTP cruda del grupo "Segundo"
  (33/34).
