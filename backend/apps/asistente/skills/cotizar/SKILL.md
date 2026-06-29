---
name: cotizar
description: Crear una cotización en FAT (sin NCF — no genera transacción contable).
when_to_use: ["cotizar", "hacer una cotización", "precio para {cliente}", "presupuesto"]
modules_required: [FAT]
tools_used: [fat_buscar_cliente, fat_buscar_producto, fat_crear_cotizacion]
estimated_steps: 3-5
---

# Skill: Cotizar

Crea una cotización (presupuesto) sin afectar inventario ni emitir NCF.

## 1. Cliente

- `fat_buscar_cliente(no_cia, search=...)`. Puede ser cliente registrado o "prospecto" (sin no_cliente).
- Captura: identificación (no_cliente o nombre libre), contacto, RNC opcional.

## 2. Productos

- Por cada item: `fat_buscar_producto(no_cia, search=...)`.
- Confirma `codigo`, `descri`, `precio`, `cantidad`. Mostrar existencia es **informativo** — la cotización no reserva stock.

## 3. Validez

Pregunta días de validez (default 30) y condiciones (incluye/excluye ITBIS, transporte, garantía).

## 4. Resumen

```
Cotización para: <cliente>
Items:           N — subtotal X, ITBIS Y, total Z
Válida hasta:    <fecha>
```

Pide confirmación.

## 5. Crear cotización

`fat_crear_cotizacion(no_cia, punto, cliente, items=[...], dias_validez=30, ...)`.

## 6. Resultado

- Devuelve `no_cotizacion`. Ofrece imprimir (`/print/COTI/<id>`) o enviar por email.
- La cotización puede convertirse después en factura (skill `facturar`) reutilizando los ítems.

## Reglas

- No emite NCF, no descuenta inventario.
- No requiere `has_doc_permission` para writes de cotización (es write soft).
- Si el cliente es nuevo, registra los datos como prospecto sin crear cliente formal.
