---
name: devolucion-ventas
description: Preparar una devolución de ventas (el cliente devuelve mercancía de una factura FT, FC o AF).
when_to_use: ["devolucion de ventas", "el cliente devolvio", "devolver mercancia", "devolver una factura", "devolucion de la factura"]
modules_required: [INV, FAT]
tools_used: [fat_buscar_cliente, fat_listar_facturas, inv_buscar_producto]
estimated_steps: 3-5
---

# Skill: Devolución de Ventas

El registro final se hace en la pantalla **Inventario → Procesos →
Devolución de Ventas** (`/inv?section=procesos&view=devolucion-ventas`).
Tu trabajo es dejar todo listo y verificado para que el usuario solo
capture: factura correcta, productos, cantidades y totales.

## 1. Identificar la factura original

- Si dan cliente: `fat_buscar_cliente(no_cia, search="...")` y luego
  `fat_listar_facturas(no_cia, ...)` filtrando por ese cliente.
- Si dan el número: `fat_listar_facturas` y ubica el documento exacto.
- Tipos de documento válidos para devolver: **FT** (contado), **FC**
  (crédito) y **AF**. No existen tipos CR/CO — no los inventes.

## 2. Verificar los productos a devolver

- Confirma con el usuario qué líneas y cantidades se devuelven
  (devolución parcial es válida; nunca más de lo facturado).
- Usa `inv_buscar_producto(no_cia, search="...")` si hay dudas sobre el
  código o la descripción del producto.

## 3. Calcular el efecto

Muestra una tabla con: producto, cantidad devuelta, precio, ITBIS y
total a acreditar. Explica el efecto: la mercancía reingresa al almacén
y, si la factura fue a crédito (FC), el saldo del cliente en CxC se
reduce.

## 4. Dirigir a la pantalla

Indica al usuario que capture la devolución en **Inventario → Procesos →
Devolución de Ventas** con la factura y las líneas confirmadas. El
número de factura se digita tal como aparece en el listado.

## Reglas

- Nunca asumas la factura: confírmala con número, fecha y total.
- Si el usuario no aparece con acceso a INV o FAT, esta skill ni se
  lista — no intentes rodear permisos.
- Si la factura no aparece, dilo claro (compañía equivocada es la causa
  más común) y sugiere verificar la compañía activa.
