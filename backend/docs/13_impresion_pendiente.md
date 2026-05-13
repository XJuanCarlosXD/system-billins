# Impresión y formatos físicos

Esta tarea (Fase 1.G) **no se puede ejecutar automáticamente** desde SQL — requiere capturar cómo se ven hoy los documentos impresos.

## Lo que hay que capturar (responsabilidad cliente)

Para cada documento que se imprime hoy, capturar **un PDF o PNG real** de cómo sale del sistema, junto con metadatos: tipo de impresora (matricial Epson/láser), tamaño de papel, formato pre-impreso vs blanco, posiciones aproximadas de los campos.

Guardar en `legacy_dumps/impresion/{modulo}/`.

| Documento | Módulo | Notas |
|---|---|---|
| Factura crédito (FC) | FAT | Pre-impreso con NCF + RNC, formato fiscal RD |
| Factura contado (FT) | FAT | Igual |
| Conduce (CO) | FAT | Despacho a cliente |
| Cotización (CT) | FAT | Sin NCF |
| Recibo de cobro | CXC | Confirmar plantilla |
| Cheque | CHC | Pre-impreso con MICR (banda magnética). Posiciones críticas |
| Reposición caja chica | ACC | Confirmar |
| Orden de compra | ODC | Pre-impreso o blanco |
| Recibo de pago a proveedor | CXP | Confirmar |
| Volante de nómina | SDN | Por empleado |
| Certificado retención | CXP | Anual al proveedor |
| Estado de cuenta cliente | CXC | Para envío |
| Balance de comprobación | CNT | Reporte interno |
| Diario contable | CNT | Reporte interno |

## Decisiones que se posponen para Fase 3

- ¿Mantener impresión matricial 1:1 (mismas posiciones de pre-impreso) o **modernizar a PDF + impresoras de red**?
- En la decisión global del proyecto el cliente puede priorizar simplificar (PDF moderno) y mantener compatibilidad solo donde el formato sea legalmente requerido (cheques MICR, facturas pre-impresas con NCF si las usa).
