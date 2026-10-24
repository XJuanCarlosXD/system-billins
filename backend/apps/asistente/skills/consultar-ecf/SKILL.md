---
name: consultar-ecf
description: Consultar el estado de un comprobante electrónico (e-CF) enviado a la DGII.
when_to_use: ["estado del e-CF", "comprobante electrónico", "factura electrónica", "DGII rechazó", "e-NCF", "facturación electrónica"]
modules_required: [FAT]
tools_used: [fe_listar_documentos, fe_consultar_estado, fe_estado_config]
estimated_steps: 2-4
---

# Skill: Consultar e-CF

Guía para responder preguntas del usuario sobre el estado de un
comprobante electrónico enviado a la DGII.

## 1. Identificar el comprobante

- Si el usuario da un e-NCF específico (ej. "E310000000141"): ir al paso 2.
- Si dice "la última factura electrónica" o similar:
  `fe_listar_documentos(no_cia, page_size=5)` y muestra los más recientes.
- Si pregunta por rechazados:
  `fe_listar_documentos(no_cia, estado='RECHAZADO')`.
- Si pregunta "¿está activa la facturación electrónica?":
  `fe_estado_config(no_cia)` y responde en lenguaje natural.

## 2. Consultar estado en la DGII

`fe_consultar_estado(no_cia, e_ncf)` → devuelve `estado_dgii`,
`codigo`, `mensajes`, `fecha_recepcion`.

El tool consulta la DGII en vivo (vía track_id guardado en TFE_DOCUMENTO)
y actualiza automáticamente el estado local.

## 3. Interpretar el resultado

- **Aceptado** (código 1): todo OK, no se necesita acción.
- **Rechazado** (código 2): leer `mensajes` de la DGII y explicar en lenguaje
  simple qué dato corregir (no copies el mensaje técnico tal cual).
- **En Proceso** (código 3): la DGII aún no lo ha validado, esperar unos minutos.
- **Aceptado Condicional** (código 4): aceptado pero con observaciones.
- **No encontrado** (código 0): la DGII no tiene registro — probable error de red
  en el envío original, intentar reenviar.

## 4. Acciones

- Si **rechazado**: sugerir corregir el dato (RNC, razón social, monto, etc.) y
  volver a facturar. El e-NCF rechazado ya se quemó — el próximo envío usa uno nuevo.
- Si **en proceso**: avisar que la DGII puede tardar varios minutos; recomendar
  consultar de nuevo en 5–10 minutos.
- Si necesita reenviar manualmente: Configuración → Facturación Electrónica →
  tab "Comprobante Electrónico".

## Errores comunes DGII y cómo explicarlos

| Mensaje DGII | Causa real | Qué decir al usuario |
|--------------|-----------|---------------------|
| RNC inválido / no encontrado | RNC del cliente/proveedor no está en el padrón DGII | "El RNC del cliente no está registrado en la DGII. Verifica en dgii.gov.do." |
| Razón social no coincide | Nombre registrado difiere del maestro DGII | "El nombre del cliente no coincide con el que la DGII tiene. Corrige en el maestro de clientes." |
| NCF duplicado | e-NCF ya fue enviado antes | "Este e-NCF ya fue enviado. No se puede reenviar — crea un nuevo documento." |
| Monto inválido / fuera de rango | Formato o valor rechazado | "Revisa los totales del documento (subtotal, ITBIS, total)." |
| Certificado vencido | El .p12 expiró | "El certificado digital venció. Hay que renovarlo con la certificadora (INDOTEL) y volver a cargarlo en Configuración." |
| Secuencia agotada | Rango e-NCF consumido | "Se agotó el rango de e-NCF del tipo X. Pide un nuevo rango a la DGII desde el portal." |

## Reglas

- No reenvíes un e-NCF rechazado "a ver si pasa" — se quema otra secuencia DGII.
- Si el usuario pide reenviar algo rechazado, explica el motivo primero y
  dirígelo a corregir el documento original.
- Nunca inventes códigos ni mensajes de la DGII; usa solo lo que devuelve `fe_consultar_estado`.
