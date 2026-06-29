---
name: conciliar-banco
description: Conciliar cheques contra estado de cuenta y hacer cierre mensual.
when_to_use: ["conciliar banco", "conciliación bancaria", "cierre conciliación", "marcar conciliados"]
modules_required: [CHC]
tools_used: [chc_listar_cuentas, chc_listar_cheques, chc_rep_movimientos, chc_conciliar_bulk, chc_cierre_conciliacion]
estimated_steps: 4-6
---

# Skill: Conciliar banco

Marca los cheques que ya aparecen en el estado de cuenta del banco como
conciliados y cierra el período mensual.

## 1. Seleccionar cuenta y período

- `chc_listar_cuentas(no_cia, activa="S")` → lista de cuentas bancarias.
- Pregunta: cuenta + año/mes a conciliar (default: mes anterior).

## 2. Listar cheques pendientes de conciliar

`chc_listar_cheques(no_cia, punto, cuenta_banco, conciliado="N", fecha_desde=..., fecha_hasta=..., status="A", limit=500)`.

Muestra al usuario:
- Cantidad de cheques sin conciliar.
- Monto total pendiente.
- Lista resumida (no_docu, beneficiario, monto, fecha).

## 3. Cruzar contra estado de cuenta

Pide al usuario que pegue (o suba) el estado de cuenta del banco. Por
cada movimiento del estado:
- Buscar match exacto por monto + fecha aproximada.
- Listar los matches encontrados y pedir confirmación.

## 4. Marcar conciliados

Cuando el usuario confirme la lista a conciliar:
`chc_conciliar_bulk(no_cia, punto, items=[{tipo_docu, no_docu}, ...])`.
**Write con confirmación de usuario.**

Muestra resultado: N cheques marcados.

## 5. Reporte de movimientos (opcional)

`chc_rep_movimientos(no_cia, punto, cuenta_banco, fecha_desde, fecha_hasta)`.
Verifica saldo inicial + movimientos = saldo final esperado.

## 6. Cierre mensual

Cuando todo cuadre:
`chc_cierre_conciliacion(no_cia, punto, cuenta_banco, ano, mes, usuario)`.

**Write irreversible** — después del cierre, no se pueden modificar
cheques del período cerrado. Pedir confirmación explícita.

## Reglas

- No cerrar si quedan cheques sin conciliar (avisa y muestra cuántos).
- No re-cerrar período ya cerrado (Oracle bloquea, pero detéctalo antes).
- Si la diferencia banco vs libros > 0.01, NO cierres; alerta al usuario.
