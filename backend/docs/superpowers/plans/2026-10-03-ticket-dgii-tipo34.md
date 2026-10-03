# Borrador de ticket a soporte DGII — Rechazo persistente tipo 34 (código 615) Fase 4 Postulación 81443

**Estado**: BORRADOR. NO ENVIADO. Esta correspondencia va dirigida a la DGII
en nombre de Abregonza SRL y por lo tanto es una acción legalmente
vinculante — requiere la aprobación/firma expresa de Roberto Abreu Espinal
(gerente, RNC 130217432) antes de enviarse. El runner automático dejó este
borrador listo tras agotar las 3 hipótesis técnicas investigables.

**Canal propuesto para el envío** (elegir uno, según prefiera Roberto):
- Centro de Contacto DGII: 809-689-3444 (línea de soporte técnico Facturación
  Electrónica, en horario 8:00-17:00 UTC-4).
- Mesa de ayuda vía portal interno de la DGII si Abregonza tiene acceso.
- Correo formal con los datos del ticket a `facturaelectronica@dgii.gov.do`
  (dirección pública publicada en `dgii.gov.do/cicloContribuyente/
  facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/preguntasFrecuentes.aspx`).

---

## Asunto

**Postulación 81443 — Rechazo persistente de e-CF tipo 34 (Nota de Crédito)
con código 615 "saldo disponible" en Fase 4 de Pruebas de Simulación.
Agotadas las hipótesis técnicas razonables. Solicitamos verificación del
servicio o guía adicional.**

## Datos del contribuyente

- Razón Social: Abregonza SRL
- RNC: 130217432
- Ambiente: Certificación (certecf)
- Número de postulación: 81443
- Fase del flujo: Paso 4 — Pruebas de Simulación e-CF
- Contacto técnico: Juan Carlos Cabreu / Roberto Abreu Espinal
- Estado actual de Fase 4 al 2026-10-03: 27/N contadores en verde
  (4/4 31 + 2/2 32≥250K + 1/1 33 + 2/2 41 + 2/2 43 + 2/2 44 + 2/2 45 +
  2/2 46 + 2/2 47 + 4/4 RFCE + 4/4 widget "Facturas de consumo <250Mil").
  Único renglón abierto: **0/2 Comprobantes tipo 34**.

## Resumen del problema

En Fase 4 de la postulación 81443, cada envío de un e-CF tipo 34
(Nota de Crédito Electrónica) al servicio
`https://eCF.dgii.gov.do/CerteCF/Recepcion` es rechazado con el mismo
código y mensaje literal, independientemente del `NCFModificado`,
`MontoTotal`, `CodigoModificacion` o momento del envío usado:

> **Código:** 615
> **Mensaje literal del servicio** (confirmado también en la Bandeja de
> Entrada del portal, MensajeId=1593354 y equivalentes):
> "El campo NCFModificado del área Información de Referencia... El monto
> total de la nota de crédito no puede ser mayor al saldo disponible de la
> sumatoria de las operaciones relacionadas al comprobante referenciado."

El rechazo del 34 además dispara el reinicio total de los 11 contadores
del Paso 4 — borra todo el progreso del ciclo, no solo la secuencia del 34.

## Evidencia de intentos agotados

Hemos realizado al menos 5 intentos reales contra el servicio `CerteCF/
Recepcion` con payloads estructuralmente válidos (gate XSD-local previo
pasado, firmados con la App Firma Digital oficial, enviados con el
certificado del contribuyente). Todos rechazados con el mismo código 615.

| # | Fecha (UTC-4) | eNCF | NCFModificado | MontoTotal NC | FechaEmisión 31 referenciada | CodigoModificacion | Resultado |
|---|---------------|------|---------------|---------------|------------------------------|---------------------|-----------|
| 1 | 2026-09-26 16:18:16 | E340000000054 | E310000000079 | 5,900.00 | 20-11-2025 (recién emitido ~45 s antes, Aceptado) | 1 (Anula) | Rechazado 615 |
| 2 | 2026-09-27 (19va corrida) | E340000000053 anterior | E310000000080 ciclo | 5,900.00 | 20-11-2025 | 1 | Rechazado 615 |
| 3 | 2026-09-29 (29va corrida) | (secuencia quemada) | 31 ciclo activo | 5,900.00 | fecha factura real | 3 (Corrige montos) | Rechazado 615 |
| 4 | 2026-09-30 (39va corrida) | E340000000055 | E310000000119 (firmado ~28 h antes del envío) | **100.00** (monto mínimo) | 20-11-2025 | 1 | Rechazado 615 |
| 5 | 2026-10-02 (hipótesis #2 ACECF intermedio) | — | — | — | — | **HTTP 400 "no se encuentra en la etapa de prueba de datos de aprobación comercial"** |

**Patrón observado**: cualquiera sea el `NCFModificado` referenciado
(incluso recién emitido en el mismo ciclo y Aceptado), cualquiera sea el
`MontoTotal` de la nota de crédito (RD$5,900 hasta RD$100), cualquiera sea
el `CodigoModificacion` (1 "Anula" o 3 "Corrige montos"), y aunque hayan
transcurrido >24 h entre la emisión del 31 referenciado y el envío del 34
(hipótesis de reconciliación batch nocturna), el servicio responde con el
mismo mensaje de "saldo disponible". El saldo real del e-CF 31
referenciado es ~RD$682,709 (FC-0007829), varias órdenes de magnitud
superior al `MontoTotal` enviado en la NC — no es un problema de monto.

## Hipótesis técnicas investigadas y descartadas

1. **Reconciliación batch nocturna del servicio DGII** — descartada
   en la 39va corrida (envío con >24 h de separación entre emisión del 31
   y del 34, rechazado idéntico).
2. **Falta de Aprobación Comercial del e-CF 31 referenciado como
   pre-requisito** — descartada en la 44va corrida: construimos endpoint
   para enviar la ACECF Aprobada del e-CF31 al servicio
   `CerteCF/aprobacioncomercial`, pero el servicio responde
   **HTTP 400 "El contribuyente de rnc 130217432 no se encuentra en la
   etapa de prueba de datos de aprobación comercial"** (`codigo=02`,
   `estado="Aprobacion Comercial Rechazada"`). Esto confirma que el
   portal CerteCF implementa una **máquina de estados lineal por fase**:
   una vez cerrada la Fase 3 (Pruebas de Datos de Aprobación Comercial),
   los envíos de ACECF ya no son aceptados, aunque esto pueda ser el
   pre-requisito de los 34 de Fase 4.
3. **Campo obligatorio de facto no documentado en el payload del 34** —
   descartada en la 45va corrida (2026-10-03) tras revisión exhaustiva
   del XSD `e-CF-34-v1.0.xsd` y de la sección "F. Información de
   Referencia" del `Formato-e-CF-V1.0.pdf` oficial:
   - `InformacionReferencia/RNCOtroContribuyente` (opcional en XSD): la
     documentación oficial indica que SOLO aplica cuando el RNC emisor
     del e-CF no coincide con el emisor del `NCFModificado` (debido a
     disolución, fusión o escisión de contribuyentes). En nuestro caso
     Abregonza (130217432) es tanto emisor del 34 como del e-CF 31
     referenciado — el campo no aplica.
   - `InformacionReferencia/FechaNCFModificado`: nuestro valor
     (`20-11-2025` = fecha de la factura real original FC-0007829)
     coincide con la `FechaEmision` que el e-CF 31 llevaba al enviarse
     (verificado en `apps/fe/ecf_builder.py:274`,
     `_sub(em, 'FechaEmision', _fmt_fecha(factura['fecha']))`).
   - `Totales/SaldoAnterior`, `Totales/ValorPagar`, `Totales/MontoAvancePago`,
     `Totales/MontoPeriodo`: todos los documenta el PDF oficial como
     puramente informativos ("Se incluye sólo con fines de ilustrar con
     claridad el cobro"). No tienen semántica funcional para el servicio
     de validación.
   - No se identificó ningún otro campo "opcional en XSD pero obligatorio
     de facto" (patrón que sí existe para otros tipos: `IndicadorMontoGravado`
     en 31, `RNCComprador` en 32≥250K, `MontoITBISRetenido` en 41, etc.
     — todos ya cerrados en nuestro builder).

## Preguntas concretas para la DGII

1. ¿Cómo se computa internamente el "saldo disponible de la sumatoria de
   las operaciones relacionadas al comprobante referenciado" para una
   Nota de Crédito electrónica en la Fase 4 de certificación? ¿Depende
   de operaciones previas registradas en producción (sin propósito en
   certificación), o es específico del ciclo de certificación?
2. ¿Es necesaria una Aprobación Comercial Aceptada del e-CF 31
   referenciado antes de enviar un 34 contra él? Si sí, ¿cómo se emite
   esa ACECF cuando la postulación 81443 ya cerró Fase 3 y el servicio
   `CerteCF/aprobacioncomercial` rechaza nuevos envíos con el mensaje
   mencionado arriba?
3. ¿El rango 1..100 del tipo 34 en la secuencia (que estamos consumiendo
   secuencia a secuencia por cada intento rechazado — vamos por
   E340000000055) tiene alguna condición distinta de validación que los
   demás tipos de 11 dígitos no tienen? ¿Deberíamos ampliar el rango?
4. ¿Existe algún registro interno de DGII donde los e-CF 34 rechazados
   previamente para esta postulación hayan dejado el `NCFModificado`
   "marcado" o "quemado" para futuros intentos (es decir, el saldo
   disponible queda consumido por los rechazos previos también)?
5. En su defecto: ¿pueden revisar manualmente el trackId
   `721d97d9-1553-4e95-b387-eabeb141e5c9` (fechaRecepcion 2026-10-01
   8:18:58 PM UTC-4) y confirmar la razón específica del rechazo, para
   darnos pie a reintentar con el ajuste correcto?

## Impacto operativo

- Fase 4 bloqueada en 27/N (único renglón abierto: 0/2 tipo 34). El resto
  del Paso 4 está técnicamente completo.
- Fase 5 (Representación Impresa) y siguientes no pueden iniciarse
  mientras Fase 4 no esté 29/N o el portal avance a Fase 5 por otra vía.
- Cada reintento rechazado "quema" la secuencia del tipo 34 y arrastra
  el reinicio total de los contadores — tenemos que reconstruir ~20
  envíos consecutivos cada vez (costo ~1 h de operación por intento).

## Anexos (disponibles si DGII los solicita)

- XML firmados completos y respuestas crudas del servicio para los 5
  intentos rechazados (persistidos en nuestra bitácora
  `FAT.TFE_DOCUMENTO`).
- Plan maestro técnico interno con la trazabilidad completa de las 44+
  corridas automáticas del runner de certificación
  (`backend/docs/superpowers/plans/2026-09-22-ecf-certificacion-plan-maestro.md`).
- Payload JSON concreto usado en el último intento (39va corrida) y los
  tests XSD-gate que validaron su estructura localmente antes del envío.

---

Agradecemos de antemano cualquier orientación. Quedamos a la espera.

Atentamente,

**Roberto Abreu Espinal**
Representante legal — Abregonza SRL
RNC 130217432
