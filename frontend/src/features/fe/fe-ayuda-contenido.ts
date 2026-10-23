// Contenido del manual de Facturación Electrónica (e-CF), pensado para un
// operador SIN conocimientos técnicos. Se actualiza junto con el código
// -- si cambia el flujo de un paso, actualizar este texto en el mismo PR.
export const FE_AYUDA_MARKDOWN = `
# Manual de Facturación Electrónica (e-CF)

## ¿Qué es esto?

La DGII exige que ciertas empresas emitan sus facturas en un formato
digital especial llamado **e-CF** (Comprobante Fiscal Electrónico), en
vez del NCF de papel de siempre. ZentoryERP ya sabe generar, firmar y
enviar estos comprobantes a la DGII de forma automática.

## ¿Cómo activar la facturación electrónica?

1. Ve a **Configuración → Facturación Electrónica → tab "Configuración"**.
2. Verifica que el estado diga **"Certificado"** y el ambiente sea
   **"Producción (eCF)"**.
3. Activa el switch **"Emisión electrónica activa"**.
4. ¡Listo! A partir de ahora, cada factura que generes en ZentoryERP
   se enviará automáticamente a la DGII como e-CF.

## ¿Qué pasa cuando facturo?

Cuando creas una factura normalmente en ZentoryERP (módulo FAT):

1. ZentoryERP genera el XML del e-CF con los datos de la factura.
2. Lo firma digitalmente con el certificado de la empresa.
3. Lo envía a la DGII y recibe un estado: **Aceptado**, **Rechazado**
   o **En proceso**.
4. El número e-NCF (ej. E310000000001) queda asignado a la factura.

**No tienes que hacer nada diferente** — el proceso es transparente.
Solo verás el e-NCF en vez del NCF tradicional.

## Tipos de comprobantes electrónicos

| Tipo | Código | Uso |
|------|--------|-----|
| Factura de Crédito Fiscal | 31 | Ventas a empresas con RNC |
| Factura de Consumo | 32 | Ventas a consumidores finales |
| Nota de Débito | 33 | Aumentar el monto de una factura |
| Nota de Crédito | 34 | Descuentos o devoluciones |
| Compras | 41 | Comprobante de compras |
| Gastos Menores | 43 | Gastos sin comprobante del proveedor |

## Secuencias e-NCF

Las secuencias e-NCF son rangos de números que la DGII autoriza a la
empresa para emitir comprobantes. Se solicitan en la **Oficina Virtual
(OFV)** de la DGII y se registran en el tab **"Secuencias e-NCF"**.

Cuando una secuencia está por agotarse (quedan pocas), ZentoryERP
te avisará para que solicites más en la OFV.

## Revisar comprobantes enviados

En el tab **"Comprobante Electrónico"** puedes ver todos los e-CF
enviados: estado, fecha, e-NCF, y acciones disponibles:

- **Consultar estado**: le pregunta a la DGII si ya procesó el documento.
- **Reenviar**: solo aparece si el estado es "Rechazado" — corrige el
  problema y reintenta con un nuevo e-NCF.

## ¿Qué hacer si algo falla?

- **"Rechazado" con motivo de RNC/dato inválido**: revisa que los datos
  del comprador (RNC, razón social) estén correctos en la factura.
- **Error de conexión/certificado**: usa "Probar conexión con la DGII"
  en el tab de Configuración.
- **Certificado próximo a vencer**: renovarlo con la misma certificadora
  (INDOTEL) y subirlo nuevamente en Configuración.
- Para cualquier duda, contacta al equipo técnico.
`.trim()

export const FE_TUTORIAL_PASOS = [
  {
    titulo: 'Verificar configuración',
    descripcion:
      'Asegúrate de que el RNC, razón social y dirección del emisor coincidan con los registrados en la DGII. El ambiente debe estar en "Producción (eCF)" y el estado en "Certificado".',
    icono: '⚙️',
  },
  {
    titulo: 'Certificado digital vigente',
    descripcion:
      'El certificado digital (.p12) debe estar cargado y vigente. Puedes verificar la fecha de vencimiento y probar la conexión con la DGII desde esta misma pantalla.',
    icono: '🔐',
  },
  {
    titulo: 'Secuencias e-NCF',
    descripcion:
      'Registra los rangos de e-NCF autorizados por la DGII (se solicitan en la Oficina Virtual). Sin secuencias disponibles, no se pueden emitir comprobantes electrónicos.',
    icono: '🔢',
  },
  {
    titulo: 'Facturar normalmente',
    descripcion:
      'Con la emisión activa, cada factura que generes en ZentoryERP se enviará automáticamente a la DGII. No necesitas hacer nada diferente — el e-NCF se asigna solo.',
    icono: '📄',
  },
  {
    titulo: 'Revisar envíos',
    descripcion:
      'En el tab "Comprobante Electrónico" puedes ver el estado de cada e-CF enviado (Aceptado, Rechazado, En proceso) y reenviar los rechazados después de corregir el problema.',
    icono: '✅',
  },
]
