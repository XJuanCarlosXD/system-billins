// ============================================================================
//  NOVEDADES DEL SISTEMA — ZentoryERP
// ============================================================================
//
//  Esta es la fuente única de las "Novedades" que se muestran en el sidebar
//  general (/novedades). Cada entrada es una noticia de una actualización que
//  se subió al sistema.
//
//  ────────────────────────────────────────────────────────────────────────
//  REGLA (obligatoria): CADA VEZ QUE SE PUSHEA / DESPLIEGA ALGO
//  ────────────────────────────────────────────────────────────────────────
//  Antes de hacer `git push` a `main` (que dispara el deploy en Netlify) o de
//  subir backend a la VM, AGREGA UNA ENTRADA NUEVA al principio del arreglo
//  `NOVEDADES` de abajo describiendo, en lenguaje de negocio (no jerga
//  técnica), qué cambió para el usuario. Así cada despliegue queda registrado
//  como una noticia visible dentro del sistema.
//
//  Cómo escribir la entrada:
//    • fecha       → fecha del push (YYYY-MM-DD).
//    • tipo        → 'nuevo' (funcionalidad nueva) | 'mejora' | 'correccion'.
//    • modulo      → módulo afectado (ver ModuloNovedad). 'General' si es transversal.
//    • titulo      → una línea corta y clara ("qué es").
//    • descripcion → 1–3 frases: qué cambió y para qué le sirve al usuario.
//    • commit      → (opcional) hash corto del commit, para trazabilidad.
//
//  La entrada más reciente va SIEMPRE de primera (orden descendente por fecha).
//  Documentación de la regla: docs/NOVEDADES.md
// ============================================================================

export type TipoNovedad = 'nuevo' | 'mejora' | 'correccion'

export type ModuloNovedad =
  | 'General'
  | 'Facturación'
  | 'Cuentas por Cobrar'
  | 'Cuentas por Pagar'
  | 'Inventario'
  | 'Órdenes de Compra'
  | 'Contabilidad'
  | 'Nómina'
  | 'Impresión / PDF'
  | 'Asistente AI'

export type Novedad = {
  /** Fecha del despliegue en formato YYYY-MM-DD */
  fecha: string
  tipo: TipoNovedad
  modulo: ModuloNovedad
  titulo: string
  descripcion: string
  /** Hash corto del commit (opcional, para trazabilidad) */
  commit?: string
}

/**
 * Novedades ordenadas de la más reciente a la más antigua.
 * Recuerda: al pushear algo nuevo, agrega la entrada arriba (ver REGLA).
 */
export const NOVEDADES: Novedad[] = [
  {
    fecha: '2026-08-14',
    tipo: 'nuevo',
    modulo: 'General',
    titulo: 'Historial de "quién creó" en más módulos',
    descripcion:
      'El botón "Ver historial" que ya existía en Cuentas por Pagar (para ver quién creó, editó o anuló un documento sin necesidad de ser administrador) ahora está disponible también en Inventario, Cuentas por Cobrar, Órdenes de Compra y Facturación, en sus pantallas de Consulta de Documentos. Es de solo lectura: muestra la línea de tiempo de eventos o, si el documento es viejo y no tiene bitácora detallada, al menos indica quién lo creó. Se corrigió además un caso en Facturación donde el historial de una factura no mostraba quién la había creado.',
    commit: 'PENDIENTE',
  },
  {
    fecha: '2026-08-11',
    tipo: 'mejora',
    modulo: 'Cuentas por Pagar',
    titulo: 'Reporte 606 corregido y exportable a Excel',
    descripcion:
      'El Reporte 606 (compras con NCF) ahora calcula el Monto Facturado sin ITBIS de forma exacta, descontando también ISC, otros impuestos y propina y devolviendo las retenciones — antes subvaluaba montos con retención (p. ej. una factura de honorarios que aparecía en 12,298 ahora sale correctamente en 13,000). Se agregaron las columnas Tipo de Gasto, Monto de Servicios, Monto de Bienes, ISC, Otros Impuestos y Propina, tanto en pantalla como en el PDF, con la clasificación Servicios/Bienes igual a la del sistema anterior. El PDF se ajustó para que no se corten las columnas al imprimir, y ahora hay un botón "Exportar Excel" que descarga el 606 con las mismas columnas del reporte oficial. Se eliminó también un gasto duplicado (mismo NCF capturado dos veces).',
  },
  {
    fecha: '2026-08-11',
    tipo: 'nuevo',
    modulo: 'General',
    titulo: 'Contadores (badges) y resaltado de lo nuevo',
    descripcion:
      'El menú lateral y las tarjetas de módulos del inicio ahora muestran contadores circulares: Novedades sin leer, Reportes de Problemas abiertos (en ámbar) o recién completados (en verde), y documentos nuevos por módulo en Facturación, Cuentas por Cobrar, Cuentas por Pagar e Inventario. Al abrir un módulo, el contador también aparece en su "Consulta de Documentos" para indicar de dónde es la novedad. Además, en las consultas de documentos las filas nuevas se resaltan con un color brillante (light y dark) y aquí mismo las novedades sin leer aparecen destacadas; al entrar a la vista el contador se limpia.',
    commit: '33cfe64',
  },
  {
    fecha: '2026-08-10',
    tipo: 'nuevo',
    modulo: 'General',
    titulo: 'Nueva pantalla de Novedades y Alertas reales',
    descripcion:
      'Se agregó esta sección de Novedades en el menú general: cada vez que se sube una actualización al sistema aparece aquí como una noticia. Además, la pantalla de Alertas ahora muestra alertas reales de rangos de NCF (comprobantes fiscales) por agotarse, en lugar de datos de ejemplo.',
  },
  {
    fecha: '2026-08-10',
    tipo: 'mejora',
    modulo: 'General',
    titulo: 'Las consultas muestran primero lo último creado',
    descripcion:
      'Las consultas de documentos de Facturación, CxC, CxP, Inventario, Órdenes de Compra, Caja Chica y Cheques ahora ordenan por fecha real de creación, mostrando primero el documento más reciente. Al registrar una entrada en CxP/Inventario aparece un aviso "Se ha generado el documento" y se abre su impresión.',
    commit: '1cb690a',
  },
  {
    fecha: '2026-08-10',
    tipo: 'mejora',
    modulo: 'Cuentas por Pagar',
    titulo: 'Reporte 606 sin ITBIS en la base y cola de período no abierto',
    descripcion:
      'El reporte 606 ahora calcula el monto como la base sin ITBIS (antes el bruto inflaba el impuesto). Los documentos de compra de un mes todavía no abierto se guardan en una cola y se materializan al abrir el período, sin bloquear Inventario ni Facturación.',
  },
  {
    fecha: '2026-08-10',
    tipo: 'nuevo',
    modulo: 'Inventario',
    titulo: 'Editar Órdenes de Compra y Entradas de Compra/Mercancía',
    descripcion:
      'Se agregó el botón Editar en la Consulta de Órdenes y en la Consulta de Documentos: abre la entrada en modo edición. La Orden de Compra se actualiza en sitio; la Entrada de Compra/Mercancía se reversa y se vuelve a crear, ajustando también su reflejo en Cuentas por Pagar.',
    commit: '82f5f81',
  },
  {
    fecha: '2026-08-07',
    tipo: 'nuevo',
    modulo: 'Facturación',
    titulo: 'Documento a crédito autoselecciona forma de pago y vendedor',
    descripcion:
      'Al facturar un documento a crédito, el sistema selecciona automáticamente la forma "A CRÉDITO" y el vendedor asociado al usuario, agilizando la captura.',
  },
  {
    fecha: '2026-08-07',
    tipo: 'mejora',
    modulo: 'General',
    titulo: 'Captura más rápida: selectores automáticos',
    descripcion:
      'En Facturación, CxC, CxP e Inventario, cuando un selector tiene una sola opción se elige solo, y el tipo de documento viene preseleccionado por defecto para reducir clics.',
  },
  {
    fecha: '2026-08-07',
    tipo: 'correccion',
    modulo: 'Cuentas por Pagar',
    titulo: 'Se rechazan fechas con año inválido',
    descripcion:
      'La entrada de documentos ahora valida la fecha antes de guardar y bloquea años inválidos (por ejemplo una fecha de vencimiento con año 26810), evitando errores al registrar.',
  },
  {
    fecha: '2026-08-06',
    tipo: 'mejora',
    modulo: 'Impresión / PDF',
    titulo: 'Reportes migrados al estilo de impresión fino',
    descripcion:
      'Se migraron reportes de Facturación, CxC, CxP y Contabilidad (incluyendo asientos contables) al nuevo estilo de impresión limpio, sin barras oscuras y con mejor presentación.',
  },
  {
    fecha: '2026-08-04',
    tipo: 'mejora',
    modulo: 'Impresión / PDF',
    titulo: 'Factura, conduce y cotización con nuevo diseño de impresión',
    descripcion:
      'La factura A4, el conduce y la cotización se rediseñaron con el estilo fino (bloque DocumentoSimple), y el pie "Generado" usa la fecha del documento en lugar de la del navegador.',
  },
]
