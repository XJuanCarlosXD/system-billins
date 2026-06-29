---
name: consultar-cuenta-cliente
description: Estado de cuenta de un cliente CXC con saldo, aging y movimientos.
when_to_use: ["estado de cuenta", "cuánto debe {cliente}", "deuda de {cliente}", "saldo cliente"]
modules_required: [CXC]
tools_used: [cxc_buscar_cliente, cxc_estado_cuenta, cxc_aging, cxc_listar_documentos]
estimated_steps: 2-3
---

# Skill: Consultar cuenta de cliente

Reporta el estado de cuenta de un cliente: saldo, documentos abiertos,
aging y movimientos recientes. **Read-only.**

## 1. Identificar cliente

- `cxc_buscar_cliente(no_cia, q="<nombre o numero>")`.
- Si hay 1 match: continúa. Si hay varios, lista los 5 primeros y pide elegir.

## 2. Estado de cuenta

`cxc_estado_cuenta(no_cia, no_cliente)` → devuelve `saldo`, `docs_abiertos`,
`historico`. Muestra al usuario:

```
Cliente:        <nombre> (RNC <rnc>)
Saldo total:    $<saldo>
Docs abiertos:  N — más antiguo: <fecha>
Crédito asignado: $<limite>
Días promedio mora: <x>
```

## 3. Aging (opcional)

Si el usuario pide "envejecimiento" o quiere ver el detalle:
`cxc_aging(no_cia)` → buckets 0-30, 31-60, 61-90, 90+. Filtra por
`no_cliente` en la presentación.

## 4. Documentos detallados (opcional)

`cxc_listar_documentos(no_cia, no_cliente, tipo_doc="FACT", page_size=30)` → lista facturas pendientes.

## Reglas

- Read-only — esta skill NO modifica nada. Si el usuario pide recibir un pago, sugiere skill `aplicar-cobro` (futuro) o el formulario CXC.
- Si el usuario no tiene CXC, devuelve mensaje claro pidiendo permiso.
