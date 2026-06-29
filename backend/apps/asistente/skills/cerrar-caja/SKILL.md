---
name: cerrar-caja
description: Cuadre de caja al cierre de turno o día y cierre de caja en FAT.
when_to_use: ["cerrar caja", "cuadre de caja", "cierre del día", "cierre turno"]
modules_required: [FAT]
tools_used: [fat_cuadre_caja, fat_listar_facturas, fat_cerrar_caja]
estimated_steps: 3-4
---

# Skill: Cerrar caja

Cierra la caja del día verificando cuadre vs efectivo físico contado.

## 1. Resumen del día

- `fat_cuadre_caja(no_cia, punto, desde=<hoy>, hasta=<hoy>)` → totales por tipo (B01/B02/B14/etc.).
- `fat_listar_facturas(no_cia, punto, fecha_desde=<hoy>, estado="ACTIVA")` → cantidad de facturas y monto.
- Muestra al usuario:
  - Total facturado del día (subtotal + ITBIS).
  - Desglose por tipo de NCF.
  - Desglose por método de pago (contado / crédito).
  - Cantidad de facturas.

## 2. Conteo físico

Pregunta al usuario:
- Efectivo contado.
- Cheques recibidos (cantidad + total).
- Tarjeta (POS).
- Transferencias.

Calcula diferencia = (esperado por tipo de pago) - (contado).

## 3. Análisis diferencias

- Si diferencia ≈ 0: ok, confirma cierre.
- Si hay diferencia, oferta:
  - Verificar facturas anuladas no contadas.
  - Revisar movimientos extra (devoluciones, vales).
  - Pedir conteo de respaldo antes de cerrar.

## 4. Cerrar

`fat_cerrar_caja(no_cia, punto, fecha=<hoy>, ...detalles)` — **write** con confirmación.

Después del cierre:
- No se pueden modificar facturas del día.
- Se imprime el reporte de cierre (`/print/CIER/<id>`).

## Reglas

- Si la caja ya está cerrada hoy: avisa y NO permitas re-cerrar.
- Diferencias > 5% deben tener nota explicativa obligatoria.
- No autorices el cierre si hay facturas en estado "PENDIENTE".
