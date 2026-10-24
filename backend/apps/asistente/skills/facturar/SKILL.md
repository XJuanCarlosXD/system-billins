---
name: facturar
description: Crear una factura de venta nueva en FAT (NCF B01-B15).
when_to_use: ["hacer una factura", "facturar a {cliente}", "nueva venta", "crear factura"]
modules_required: [FAT]
tools_used: [fat_buscar_cliente, fat_proximo_ncf, fat_buscar_producto, fat_crear_factura, fe_consultar_estado, fe_estado_config]
estimated_steps: 4-7
---

# Skill: Facturar

Guía paso a paso para crear una factura de venta. Sigue el orden; no
pidas datos que ya tienes; confirma SIEMPRE antes de llamar
`fat_crear_factura` (es write).

## 1. Identificar cliente

- Si el usuario dice "factura a Juan Pérez": llama `fat_buscar_cliente(no_cia, search="Juan Perez")`.
- Si hay varios matches, lista los primeros 5 y pide confirmación.
- Si no encuentras nadie, ofrece crear cliente nuevo (separado: skill o flujo manual).
- Captura: `no_cliente`, `nombre`, `rnc`, `condicion_pago`.

## 2. Elegir tipo de NCF

Pregunta o infiere de la condición:

- **B01** Crédito Fiscal — clientes con RNC.
- **B02** Consumo Final — particular sin RNC.
- **B14** Régimen Especial / **B15** Gubernamental — sólo si aplica.

## 3. Reservar próximo NCF

`fat_proximo_ncf(no_cia, codigo_ncf="B01")` → devuelve `prox_ncf` y `ncf_dgi`.
Muestra el NCF al usuario y pide confirmación de que continúa.

## 4. Buscar productos / servicios

Para cada ítem del usuario:

- `fat_buscar_producto(no_cia, search="<descripcion>", solo_existencia=true)`
- Confirma `codigo`, `descri`, `precio`, `existencia` y `cantidad` deseada.
- Calcula subtotal + ITBIS (18% si producto es gravado).

## 5. Resumen y confirmación

Antes de crear la factura, muestra:

```
Cliente:   <nombre> (RNC <rnc>)
NCF:       <ncf_dgi>
Items:     N líneas — subtotal X, ITBIS Y, total Z
Condicion: <contado/credito>
```

Pide confirmación textual del usuario ("ok", "confirmo", "crear").

## 6. Crear factura

`fat_crear_factura(no_cia, punto, no_cliente, tipo_ncf, items=[...], ...)`.
Este es un **write** — el frontend pedirá segundo clic de confirmación.

## 7. Resultado

- Si OK: muestra `no_factura`, `ncf_dgi`, total y ofrece "imprimir" (ruta `/print/FACT/<id>`).
- Si error: explica claramente el motivo (existencia insuficiente, NCF agotado, etc.) y sugiere siguiente paso.

## Reglas

- Nunca asumas no_cia/punto: si el usuario tiene varios, pregunta.
- Si falla un permiso (`FORBIDDEN_CIA`, `FORBIDDEN_DOC`), explica qué permiso falta. No intentes rodear.
- Si el usuario cambia de opinión a mitad, descarta el draft sin tocar Oracle.

## 8. Comprobante electrónico (si aplica)

Si la respuesta de `fat_crear_factura` incluye `ecf`:
- Informa al usuario: "Se generó el e-CF {ecf.e_ncf} y se envió a la DGII (track {ecf.track_id})."
- Si el usuario pregunta por el estado real en la DGII: usa `fe_consultar_estado(no_cia, e_ncf)`.

Si la respuesta NO incluye `ecf` y el usuario pregunta por facturación electrónica:
- Usa `fe_estado_config(no_cia)` para verificar si está activa.
- Si no está activa, explica: "La emisión electrónica no está activa para esta empresa. Se puede activar en Configuración → Facturación Electrónica."
- Si está activa pero no hay secuencias disponibles del tipo correspondiente, avisa al usuario — se requiere pedir nuevo rango a la DGII.
