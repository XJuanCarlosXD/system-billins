// Contenido del manual de Facturación Electrónica (e-CF), pensado para un
// operador SIN conocimientos técnicos. Se actualiza junto con el código
// -- si cambia el flujo de un paso, actualizar este texto en el mismo PR.
export const FE_AYUDA_MARKDOWN = `
# Manual de Facturación Electrónica (e-CF)

## ¿Qué es esto?

La DGII exige que ciertas empresas emitan sus facturas en un formato
digital especial llamado **e-CF** (Comprobante Fiscal Electrónico), en
vez del NCF de papel de siempre. ZentoryERP ya sabe generar, firmar y
enviar estos comprobantes a la DGII.

## Antes de poder facturar electrónicamente: la Certificación

Antes de emitir e-CF reales, la DGII exige pasar por un proceso de
**Certificación** — un examen técnico donde la empresa demuestra que su
sistema (ZentoryERP) puede generar y enviar comprobantes de prueba
correctamente. Esto se hace UNA SOLA VEZ por empresa, no por cada factura.

### Pasos de la Certificación (resumen)

1. **Postulación**: solicitud formal ante la DGII (ya hecha para
   Abregonza, solicitud núm. 81443).
2. **Paso 2 — Pruebas de Datos e-CF**: la DGII entrega un archivo Excel
   con 21 facturas de prueba + 4 resúmenes. Se suben desde
   *Configuración → Facturación Electrónica → Certificación e-CF*.
3. **Paso 3 — Aprobaciones Comerciales**: la DGII genera 11 "aprobaciones"
   simuladas que hay que reenviarle. Mismo panel.
4. **Pasos 4 en adelante**: pruebas con datos reales de la empresa,
   representación impresa (PDF) con código QR, y activación final en
   producción. (Pendiente de completar — ver estado real en el Portal de
   Certificación de la DGII.)

**Importante**: estos pasos los ejecuta alguien del equipo técnico UNA
VEZ. Un usuario normal de facturación no necesita tocar la pantalla de
Certificación.

## Configurar la empresa (una vez, antes de facturar)

*Configuración → Facturación Electrónica → tab "Configuración"*:

1. Cargar el **certificado digital** (.p12) de la persona autorizada como
   Administrador de e-CF ante la DGII, junto con su clave.
2. Verificar los datos del **Emisor** (RNC, razón social, dirección) —
   deben coincidir EXACTO con lo que la DGII tiene registrado.
3. Elegir el **ambiente**: mientras se está certificando, usar
   *Certificación (CerteCF)*. Solo cuando la DGII confirme la
   certificación completa, cambiar a *Producción (eCF)*.
4. Botón **"Probar conexión con la DGII"** — confirma que el certificado
   funciona antes de intentar facturar.

## Revisar comprobantes enviados

*Configuración → Facturación Electrónica → tab "Comprobante Electrónico"*
muestra todos los e-CF enviados: estado (Aceptado / Rechazado / En
proceso), fecha, y permite:
- **Consultar estado**: le pregunta a la DGII si ya procesó el documento.
- **Reenviar**: solo aparece si el estado es "Rechazado" — corrige el
  problema y reintenta.

## ¿Qué hacer si algo falla?

- **"Rechazado" con un motivo de RNC/dato inválido**: revisar que el dato
  del comprador (RNC, razón social) esté correcto en la factura de
  origen.
- **Error de conexión/certificado**: usar "Probar conexión con la DGII"
  en la pantalla de Configuración para diagnosticar.
- Para cualquier duda sobre el estado de la Certificación (no de una
  factura real), contactar al equipo técnico — el estado real y
  actualizado vive en el propio Portal de Certificación de la DGII
  (\`ecf.dgii.gov.do/certecf/portalcertificacion\`), no solo en
  ZentoryERP.
`.trim()
