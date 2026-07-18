---
name: nota-debito-cxc
description: Preparar una nota de débito en Cuentas por Cobrar (aumenta el saldo del cliente).
when_to_use: ["nota de debito", "cargar al cliente", "aumentar saldo del cliente", "ND al cliente", "cargo adicional al cliente"]
modules_required: [CXC]
tools_used: [cxc_buscar_cliente, cxc_estado_cuenta, cxc_listar_documentos]
estimated_steps: 3-4
---

# Skill: Nota de Débito (CxC)

Una nota de débito **aumenta** el saldo pendiente del cliente
(intereses por mora, cheques devueltos, cargos adicionales). Se captura
en **CxC → Entrada de Transacciones** (`/cxc/transacciones`). Tu
trabajo: identificar cliente, cuantificar el cargo y dejar el resumen
listo para capturar.

## 1. Identificar el cliente

`cxc_buscar_cliente(no_cia, search="...")` — confirma código y nombre.

## 2. Ver su situación

- `cxc_estado_cuenta(no_cia, no_cliente)` para el saldo actual.
- `cxc_listar_documentos(no_cia, no_cliente)` si el cargo se relaciona
  con un documento existente (ej. cheque devuelto de un pago).

## 3. Cuantificar

Confirma monto y motivo del cargo. Muestra una tabla: cliente, saldo
antes, monto ND, saldo después, motivo.

## 4. Dirigir a la pantalla

Indica capturar la nota de débito en **CxC → Entrada de
Transacciones**, con el tipo de documento de nota de débito de la
compañía. El número de documento admite máximo 7 caracteres.

## Reglas

- Nunca inventes tipos de documento: ante dudas usa
  `doc_tipos_listar`/`doc_tipos_describir` (módulo CXC).
- Si el usuario no tiene el módulo CXC, esta skill no aparece — no
  intentes otra vía.
