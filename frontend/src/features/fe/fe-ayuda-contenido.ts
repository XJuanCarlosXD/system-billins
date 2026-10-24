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

// === TUTORIALES POR MÓDULO ===
// Cada array se consume con <FeTutorialButton pasos={...}> en el header
// de la vista correspondiente. El dialog los lee en voz alta y los
// anima con el avatar sincronizado.

export const FE_TUTORIAL_FAT = [
  {
    titulo: 'e-NCF automático al facturar',
    descripcion:
      'Cada factura que crees se enviará automáticamente a la DGII como e-CF. El e-NCF (por ejemplo E310000000141) se asigna solo. No tienes que hacer nada distinto al proceso normal de facturación.',
    icono: '📄',
  },
  {
    titulo: 'Tipos de comprobante según el cliente',
    descripcion:
      'El sistema elige el tipo de e-CF automáticamente: Crédito Fiscal 31 si el cliente tiene RNC, Consumo 32 para consumidor final, Régimen Especial 44, Gubernamental 45 o Exportación 46 según la configuración del cliente.',
    icono: '🏷️',
  },
  {
    titulo: 'Facturas de Consumo menores a RD$250,000',
    descripcion:
      'Las facturas de consumo bajo los RD$250,000 se envían como RFCE, un resumen que la DGII pide por un canal especial. ZentoryERP lo hace automáticamente, tú solo facturas como siempre.',
    icono: '💰',
  },
  {
    titulo: 'Revisa el estado después de facturar',
    descripcion:
      'Cada envío queda registrado en el tab Comprobante Electrónico con su estado: Aceptado, Rechazado o En Proceso. Si es rechazado, revisa los datos del cliente (RNC, razón social). El e-NCF rechazado no se reutiliza, el próximo intento usa uno nuevo.',
    icono: '✅',
  },
]

export const FE_TUTORIAL_CXP = [
  {
    titulo: 'Comprobante de Compras electrónico (41)',
    descripcion:
      'Al registrar una factura de proveedor (FP), ZentoryERP genera automáticamente el e-CF tipo 41 de Compras. Verifica que el NCF del proveedor esté bien escrito — un NCF incorrecto es la causa más común de rechazo.',
    icono: '🛒',
  },
  {
    titulo: 'Gastos Menores (43)',
    descripcion:
      'Si el proveedor no emite comprobante fiscal (compras informales, pagos a personas sin RNC), se genera un e-CF tipo 43 de Gastos Menores. Aplica solo para montos de hasta RD$50,000 por transacción.',
    icono: '💵',
  },
  {
    titulo: 'Pagos al Exterior (47)',
    descripcion:
      'Pagos a proveedores extranjeros sin RNC dominicano generan e-CF tipo 47. Necesitan datos del beneficiario: nombre completo, país y tipo de documento. Confirma que esos datos estén en el maestro de proveedores.',
    icono: '🌎',
  },
  {
    titulo: 'Sin cambios en tu flujo',
    descripcion:
      'Sigue entrando documentos de CxP como de costumbre. El e-CF se envía después de guardar y queda registrado en Comprobante Electrónico. Si algo falla, el sistema abre un ticket automático para que lo revises.',
    icono: '🔄',
  },
]

export const FE_TUTORIAL_CXC = [
  {
    titulo: 'Notas de Débito electrónicas (33)',
    descripcion:
      'Las Notas de Débito ahora generan un e-CF tipo 33 automáticamente. La DGII exige que toda ND indique el e-NCF de la factura original que modifica, y ZentoryERP lo asigna solo.',
    icono: '📋',
  },
  {
    titulo: 'Notas de Crédito electrónicas (34)',
    descripcion:
      'Las Notas de Crédito (descuentos, devoluciones) generan e-CF tipo 34, también con referencia obligatoria al e-NCF de la factura original. Sin esa referencia la DGII rechaza el documento.',
    icono: '🔗',
  },
  {
    titulo: 'Referencia obligatoria',
    descripcion:
      'Si ves un error de "e-NCF original no encontrado", significa que la factura base se emitió antes de activar e-CF y usó NCF papel. En ese caso la ND o NC se generará con NCF papel también, no con e-CF.',
    icono: '⚠️',
  },
  {
    titulo: 'Clientes con RNC',
    descripcion:
      'Verifica que el cliente tenga RNC o cédula correcto en el maestro antes de emitir la ND/NC. Un RNC inválido es el motivo de rechazo más común en comprobantes electrónicos.',
    icono: '🪪',
  },
]

export const FE_TUTORIAL_ACC = [
  {
    titulo: 'Gastos Menores de Caja Chica (43)',
    descripcion:
      'Los egresos de caja chica que tengan NCF generan automáticamente un e-CF tipo 43 de Gastos Menores. Aplica a gastos hasta RD$50,000 cuando el proveedor no emite comprobante fiscal.',
    icono: '🧾',
  },
  {
    titulo: 'Solo egresos con comprobante',
    descripcion:
      'Si el egreso no tiene posición fija de NCF asignada, no genera e-CF. Esto evita enviar gastos internos (transferencias, reposiciones) que no son comprobantes fiscales.',
    icono: '🧮',
  },
  {
    titulo: 'Sigue registrando como siempre',
    descripcion:
      'No cambia tu flujo diario. Sigue entrando egresos de caja chica normalmente. El e-CF se genera al guardar y aparecerá en el reporte 606 vía ZentoryERP.',
    icono: '✅',
  },
]

export const FE_TUTORIAL_INV = [
  {
    titulo: 'Devoluciones generan Nota de Crédito electrónica',
    descripcion:
      'Cuando registras una devolución de venta (DV o DC), ZentoryERP genera automáticamente una Nota de Crédito electrónica (e-CF tipo 34) que referencia la factura original.',
    icono: '↩️',
  },
  {
    titulo: 'El e-CF fluye por Cuentas por Cobrar',
    descripcion:
      'La devolución en Inventario crea el NCF de la NC desde CxC (misma serie). El envío a la DGII es automático — no necesitas hacer nada en CxC después de la devolución.',
    icono: '🔄',
  },
  {
    titulo: 'Factura original obligatoria',
    descripcion:
      'La devolución debe referenciar una factura. Si la factura original fue emitida con NCF papel (antes de e-CF), la devolución también será en papel. Verifica siempre que el documento origen esté asignado.',
    icono: '🔗',
  },
]
