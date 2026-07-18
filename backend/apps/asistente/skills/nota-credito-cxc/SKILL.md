---
name: nota-credito-cxc
description: Preparar una nota de crédito en Cuentas por Cobrar (reduce el saldo del cliente).
when_to_use: ["nota de credito", "acreditar al cliente", "rebajar saldo del cliente", "NC al cliente", "credito a favor del cliente"]
modules_required: [CXC]
tools_used: [cxc_buscar_cliente, cxc_estado_cuenta, cxc_listar_documentos]
estimated_steps: 3-4
---

# Skill: Nota de Crédito (CxC)

Una nota de crédito **reduce** el saldo pendiente del cliente
(descuentos posteriores, correcciones de facturación, acuerdos). Se
captura en **CxC → Entrada de Transacciones** (`/cxc/transacciones`).
Tu trabajo: identificar cliente y documento, cuantificar el monto y
dejar el resumen listo para capturar.

## 1. Identificar el cliente

`cxc_buscar_cliente(no_cia, search="...")` — confirma código y nombre.
Si hay varios matches, muéstralos en tabla y pide que elija.

## 2. Ver su situación

- `cxc_estado_cuenta(no_cia, no_cliente)` para el saldo actual.
- `cxc_listar_documentos(no_cia, no_cliente)` para ubicar la factura o
  documento que se va a acreditar (número, fecha, saldo pendiente).

## 3. Cuantificar

Confirma con el usuario el monto y el motivo. Reglas:

- El monto de la NC no debe exceder el saldo pendiente del documento
  que afecta (si lo excede, adviértelo).
- Muestra una tabla: documento afectado, saldo antes, monto NC, saldo
  después.

## 4. Dirigir a la pantalla

Indica capturar la nota de crédito en **CxC → Entrada de
Transacciones**, seleccionando el tipo de documento de nota de crédito
configurado en la compañía. El número de documento admite máximo 7
caracteres.

## Reglas

- Nunca inventes tipos de documento: si el usuario duda del código del
  tipo NC, usa `doc_tipos_listar`/`doc_tipos_describir` (módulo CXC).
- Si el usuario no tiene el módulo CXC, esta skill no aparece — no
  intentes otra vía.
